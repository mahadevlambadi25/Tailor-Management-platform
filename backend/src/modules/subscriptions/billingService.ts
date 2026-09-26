import { prisma } from '../../core/prisma';
import { logger } from '../../core/logger';
import { config } from '../../config';
import {
  SubscriptionStatus,
  SubscriptionPaymentStatus,
  SubscriptionInvoiceStatus
} from '@prisma/client';
import { SubscriptionService, SUBSCRIPTION_PLANS } from './subscriptionService';
import { RazorpayService } from './razorpayService';
import { purgeTenantDemoData } from '../demo/demoService';

export class BillingService {
  /**
   * Generates a sequential invoice number for a tenant:
   * Format: INV-SUB-YYYY-XXXX (e.g. INV-SUB-2026-0001)
   */
  static async generateInvoiceNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await prisma.subscriptionInvoice.count({
      where: { tenantId }
    });
    const seq = String(count + 1).padStart(4, '0');
    return `INV-SUB-${year}-${seq}`;
  }

  /**
   * Creates a Razorpay checkout order and records a PENDING SubscriptionPayment.
   * - Validates plan against SUBSCRIPTION_PLANS (cannot checkout FREE_TRIAL).
   * - Calculates price strictly on server side from single source of truth.
   * - Does NOT activate subscription or purge demo data at this stage.
   */
  static async createCheckout(tenantId: string, planName: string) {
    if (!planName || typeof planName !== 'string') {
      const err: any = new Error('Plan name is required (e.g. STARTER, PROFESSIONAL, ENTERPRISE, BUSINESS)');
      err.statusCode = 400;
      err.code = 'INVALID_PLAN';
      throw err;
    }

    const normalizedPlan = planName.trim().toUpperCase();
    const planConfig = SUBSCRIPTION_PLANS[normalizedPlan];

    if (!planConfig || normalizedPlan === 'FREE_TRIAL') {
      const err: any = new Error(`Invalid subscription plan "${planName}". Allowed paid plans: STARTER, PROFESSIONAL, ENTERPRISE, BUSINESS`);
      err.statusCode = 400;
      err.code = 'INVALID_PLAN';
      throw err;
    }

    // Ensure tenant subscription exists (or auto-provision initial/trial)
    const subscription = await SubscriptionService.getTenantSubscription(tenantId);

    // Calculate price and currency strictly from configuration
    const amountInPaise = planConfig.amountInPaise;
    const priceInInr = planConfig.priceInInr;
    const currency = planConfig.currency || 'INR';

    const receipt = `rcpt_sub_${tenantId.replace(/-/g, '').substring(0, 10)}_${Date.now()}`;

    // Create Razorpay payment order
    const razorpayOrder = await RazorpayService.createOrder({
      amountInPaise,
      currency,
      receipt,
      notes: {
        tenantId,
        plan: planConfig.name
      }
    });

    // Record PENDING transaction in database
    const payment = await prisma.subscriptionPayment.create({
      data: {
        tenantId,
        subscriptionId: subscription.id,
        provider: 'razorpay',
        orderId: razorpayOrder.id,
        amount: priceInInr,
        currency,
        status: SubscriptionPaymentStatus.PENDING,
        planName: planConfig.name,
        billingPeriod: 'MONTHLY',
        metadata: {
          receipt,
          orderAmountInPaise: razorpayOrder.amount,
          createdAt: razorpayOrder.createdAt
        }
      }
    });

    logger.info(`[BillingService] Created checkout transaction ${payment.id} (Order: ${razorpayOrder.id}) for tenant ${tenantId}`);

    return {
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId: config.razorpayKeyId || 'rzp_test_placeholder_key',
      plan: planConfig.name,
      transactionId: payment.id
    };
  }

  /**
   * Verifies Razorpay payment signature and activates the subscription.
   * - Cryptographically verifies HMAC signature with server-side secret.
   * - Idempotent: safe against duplicate callbacks or duplicate user clicks.
   * - Updates transaction to SUCCESS with paymentId, signature, and timestamps.
   * - Generates a formal SubscriptionInvoice record with status PAID.
   * - Activates tenant subscription and executes idempotent demo data purge if demo tenant.
   * - If verification fails, marks transaction FAILED and rejects without activating subscription.
   */
  static async verifyPayment(tenantId: string, params: {
    orderId: string;
    paymentId: string;
    signature: string;
    plan?: string;
  }) {
    const { orderId, paymentId, signature, plan } = params;

    if (!orderId || !paymentId || !signature) {
      const err: any = new Error('Missing required payment parameters: orderId, paymentId, and signature are mandatory');
      err.statusCode = 400;
      err.code = 'MISSING_PAYMENT_DETAILS';
      throw err;
    }

    // Cryptographic signature check
    const isValid = RazorpayService.verifyPaymentSignature({
      orderId,
      paymentId,
      signature
    });

    if (!isValid) {
      logger.warn(`[BillingService] Cryptographic signature check FAILED for tenant ${tenantId}, order ${orderId}`);

      // Record failure on existing transaction if found
      await prisma.subscriptionPayment.updateMany({
        where: { tenantId, orderId },
        data: {
          status: SubscriptionPaymentStatus.FAILED,
          paymentId,
          signature,
          failureReason: 'Invalid HMAC signature verification'
        }
      });

      // Audit log signature failure
      await prisma.auditLog.create({
        data: {
          tenantId,
          action: 'RAZORPAY_SIGNATURE_VERIFICATION_FAILED',
          entity: 'SubscriptionPayment',
          entityId: orderId,
          details: { orderId, paymentId }
        }
      }).catch(() => {});

      const err: any = new Error('Payment verification failed: invalid signature. Subscription was not activated.');
      err.statusCode = 400;
      err.code = 'INVALID_SIGNATURE';
      throw err;
    }

    // Idempotency Check:
    // If this payment was already verified and marked SUCCESS
    const existingSuccessfulPayment = await prisma.subscriptionPayment.findFirst({
      where: {
        tenantId,
        paymentId,
        status: SubscriptionPaymentStatus.SUCCESS
      },
      include: { invoice: true }
    });

    const currentSub = await prisma.subscription.findUnique({ where: { tenantId } });

    if (existingSuccessfulPayment || (currentSub?.status === SubscriptionStatus.ACTIVE && currentSub?.providerSubscriptionId === paymentId)) {
      logger.info(`[BillingService] Payment ${paymentId} already verified and active for tenant ${tenantId}. Returning idempotent response.`);
      const summary = await SubscriptionService.getSubscriptionSummary(tenantId);
      const invoice = existingSuccessfulPayment?.invoice || await prisma.subscriptionInvoice.findFirst({
        where: { tenantId, providerPaymentId: paymentId }
      });
      return {
        subscription: summary,
        transaction: existingSuccessfulPayment,
        invoice,
        idempotent: true
      };
    }

    // Determine validated plan
    const normalizedPlan = (typeof plan === 'string' && plan.trim())
      ? plan.trim().toUpperCase()
      : (currentSub?.planName && currentSub.planName !== 'FREE_TRIAL' ? currentSub.planName : 'PROFESSIONAL');
    const planConfig = SUBSCRIPTION_PLANS[normalizedPlan] || SUBSCRIPTION_PLANS.PROFESSIONAL;

    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30-day monthly cycle

    // Retrieve tenant details for invoice
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      const err: any = new Error('Tenant not found');
      err.statusCode = 404;
      err.code = 'TENANT_NOT_FOUND';
      throw err;
    }

    // Update existing transaction or create new one with SUCCESS
    let paymentRecord = await prisma.subscriptionPayment.findFirst({
      where: { tenantId, orderId }
    });

    if (paymentRecord) {
      paymentRecord = await prisma.subscriptionPayment.update({
        where: { id: paymentRecord.id },
        data: {
          status: SubscriptionPaymentStatus.SUCCESS,
          paymentId,
          signature,
          paidAt: now,
          periodStart: now,
          periodEnd,
          planName: planConfig.name,
          amount: planConfig.priceInInr
        }
      });
    } else {
      // Transaction was not pre-created or alternate path
      paymentRecord = await prisma.subscriptionPayment.create({
        data: {
          tenantId,
          subscriptionId: currentSub?.id || (await SubscriptionService.getTenantSubscription(tenantId)).id,
          provider: 'razorpay',
          orderId,
          paymentId,
          signature,
          amount: planConfig.priceInInr,
          currency: planConfig.currency || 'INR',
          status: SubscriptionPaymentStatus.SUCCESS,
          planName: planConfig.name,
          billingPeriod: 'MONTHLY',
          periodStart: now,
          periodEnd,
          paidAt: now
        }
      });
    }

    // Generate Invoice
    const invoiceNumber = await this.generateInvoiceNumber(tenantId);
    const invoice = await prisma.subscriptionInvoice.create({
      data: {
        tenantId,
        subscriptionId: paymentRecord.subscriptionId,
        paymentId: paymentRecord.id,
        invoiceNumber,
        planName: planConfig.name,
        amount: planConfig.priceInInr,
        currency: planConfig.currency || 'INR',
        status: SubscriptionInvoiceStatus.PAID,
        billingPeriodStart: now,
        billingPeriodEnd: periodEnd,
        paidAt: now,
        providerPaymentId: paymentId,
        customerName: tenant.name,
        customerEmail: tenant.email,
        billingAddress: tenant.address
      }
    });

    // Activate subscription & purge demo data
    const { subscription, purgeResult } = await SubscriptionService.activateSubscription(tenantId, planConfig.name, {
      clearDemo: true,
      paymentId,
      paymentProvider: 'razorpay'
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        tenantId,
        action: 'SUBSCRIPTION_PAYMENT_VERIFIED',
        entity: 'SubscriptionPayment',
        entityId: paymentRecord.id,
        details: {
          orderId,
          paymentId,
          invoiceNumber,
          amount: planConfig.priceInInr,
          plan: planConfig.name,
          purgeResult: purgeResult ? (purgeResult as any) : null
        }
      }
    }).catch(() => {});

    logger.info(`[BillingService] Subscription activated for tenant ${tenantId} on plan ${planConfig.name}, Invoice: ${invoiceNumber}`);

    const summary = await SubscriptionService.getSubscriptionSummary(tenantId);

    return {
      subscription: summary,
      transaction: paymentRecord,
      invoice,
      purgeResult,
      idempotent: false
    };
  }

  /**
   * Handles incoming Razorpay webhook events securely and idempotently.
   */
  static async handleWebhook(rawPayload: string | Buffer, signature: string, eventPayload: any) {
    if (!signature) {
      const err: any = new Error('Missing x-razorpay-signature header');
      err.statusCode = 400;
      err.code = 'MISSING_SIGNATURE';
      throw err;
    }

    const isValid = RazorpayService.verifyWebhookSignature(rawPayload, signature);
    if (!isValid) {
      logger.warn('[BillingService] Webhook signature verification FAILED');
      const err: any = new Error('Invalid webhook signature');
      err.statusCode = 400;
      err.code = 'INVALID_SIGNATURE';
      throw err;
    }

    const eventType = eventPayload?.event;
    const eventId = eventPayload?.id || `evt_${Date.now()}`;

    logger.info(`[BillingService] Processing verified webhook: ${eventType} (ID: ${eventId})`);

    // 1. Payment Failed Event
    if (eventType === 'payment.failed') {
      const paymentEntity = eventPayload?.payload?.payment?.entity;
      const tenantId = paymentEntity?.notes?.tenantId;
      const failureReason = paymentEntity?.error_description || paymentEntity?.error_reason || 'Payment failed';
      const orderId = paymentEntity?.order_id;
      const paymentId = paymentEntity?.id;

      if (tenantId) {
        if (orderId) {
          await prisma.subscriptionPayment.updateMany({
            where: { tenantId, orderId },
            data: {
              status: SubscriptionPaymentStatus.FAILED,
              paymentId,
              failureReason
            }
          });
        }

        const currentSub = await prisma.subscription.findUnique({ where: { tenantId } });
        if (currentSub?.status === SubscriptionStatus.ACTIVE) {
          await prisma.subscription.update({
            where: { tenantId },
            data: { status: SubscriptionStatus.PAST_DUE }
          });
        }

        await prisma.auditLog.create({
          data: {
            tenantId,
            action: 'RAZORPAY_PAYMENT_FAILED',
            entity: 'SubscriptionPayment',
            entityId: eventId,
            details: { eventId, paymentId, orderId, failureReason }
          }
        }).catch(() => {});
      }

      return {
        handled: true,
        eventType,
        status: 'FAILED',
        message: 'Payment failure recorded. Subscription not activated.'
      };
    }

    // 2. Payment Captured / Order Paid / Subscription Charged Events
    if (eventType === 'payment.captured' || eventType === 'order.paid' || eventType === 'subscription.charged') {
      const paymentEntity = eventPayload?.payload?.payment?.entity;
      const orderEntity = eventPayload?.payload?.order?.entity;

      const tenantId = paymentEntity?.notes?.tenantId || orderEntity?.notes?.tenantId;
      const planName = paymentEntity?.notes?.plan || orderEntity?.notes?.plan || 'PROFESSIONAL';
      const paymentId = paymentEntity?.id || orderEntity?.id || eventId;
      const orderId = paymentEntity?.order_id || orderEntity?.id;

      if (!tenantId) {
        logger.warn(`[BillingService] Webhook event ${eventId} missing tenantId in metadata notes`);
        const err: any = new Error('Missing tenantId in event metadata notes');
        err.statusCode = 400;
        err.code = 'MISSING_TENANT';
        throw err;
      }

      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant) {
        const err: any = new Error('Tenant not found');
        err.statusCode = 404;
        err.code = 'TENANT_NOT_FOUND';
        throw err;
      }

      // Webhook Idempotency Check
      const existingAudit = await prisma.auditLog.findFirst({
        where: {
          tenantId,
          action: 'RAZORPAY_WEBHOOK_PROCESSED',
          entityId: eventId
        }
      });

      const existingSuccess = await prisma.subscriptionPayment.findFirst({
        where: { tenantId, paymentId, status: SubscriptionPaymentStatus.SUCCESS }
      });

      if (existingAudit || existingSuccess) {
        logger.info(`[BillingService] Idempotent webhook: event ${eventId} already processed for tenant ${tenantId}`);
        return {
          handled: true,
          eventType,
          idempotent: true,
          message: 'Webhook event already processed (idempotent)'
        };
      }

      const normalizedPlan = (typeof planName === 'string' && planName.trim()) ? planName.trim().toUpperCase() : 'PROFESSIONAL';
      const planConfig = SUBSCRIPTION_PLANS[normalizedPlan] || SUBSCRIPTION_PLANS.PROFESSIONAL;

      const now = new Date();
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      // Upsert transaction
      let paymentRecord = orderId ? await prisma.subscriptionPayment.findFirst({ where: { tenantId, orderId } }) : null;
      if (paymentRecord) {
        paymentRecord = await prisma.subscriptionPayment.update({
          where: { id: paymentRecord.id },
          data: {
            status: SubscriptionPaymentStatus.SUCCESS,
            paymentId,
            paidAt: now,
            periodStart: now,
            periodEnd,
            amount: planConfig.priceInInr,
            planName: planConfig.name
          }
        });
      } else {
        const sub = await SubscriptionService.getTenantSubscription(tenantId);
        paymentRecord = await prisma.subscriptionPayment.create({
          data: {
            tenantId,
            subscriptionId: sub.id,
            provider: 'razorpay',
            orderId: orderId || `order_${eventId}`,
            paymentId,
            amount: planConfig.priceInInr,
            currency: planConfig.currency || 'INR',
            status: SubscriptionPaymentStatus.SUCCESS,
            planName: planConfig.name,
            billingPeriod: 'MONTHLY',
            periodStart: now,
            periodEnd,
            paidAt: now
          }
        });
      }

      // Generate invoice if not already generated
      let invoice = await prisma.subscriptionInvoice.findUnique({
        where: { paymentId: paymentRecord.id }
      });

      if (!invoice) {
        const invoiceNumber = await this.generateInvoiceNumber(tenantId);
        invoice = await prisma.subscriptionInvoice.create({
          data: {
            tenantId,
            subscriptionId: paymentRecord.subscriptionId,
            paymentId: paymentRecord.id,
            invoiceNumber,
            planName: planConfig.name,
            amount: planConfig.priceInInr,
            currency: planConfig.currency || 'INR',
            status: SubscriptionInvoiceStatus.PAID,
            billingPeriodStart: now,
            billingPeriodEnd: periodEnd,
            paidAt: now,
            providerPaymentId: paymentId,
            customerName: tenant.name,
            customerEmail: tenant.email,
            billingAddress: tenant.address
          }
        });
      }

      // Activate subscription and purge demo data
      const { subscription, purgeResult } = await SubscriptionService.activateSubscription(tenantId, planConfig.name, {
        clearDemo: true,
        paymentId,
        paymentProvider: 'razorpay'
      });

      // Audit log for idempotency
      await prisma.auditLog.create({
        data: {
          tenantId,
          action: 'RAZORPAY_WEBHOOK_PROCESSED',
          entity: 'Subscription',
          entityId: eventId,
          details: {
            eventId,
            eventType,
            paymentId,
            invoiceNumber: invoice.invoiceNumber,
            plan: planConfig.name,
            purgeResult: purgeResult ? (purgeResult as any) : null
          }
        }
      }).catch(() => {});

      return {
        handled: true,
        eventType,
        subscriptionId: subscription.id,
        invoiceNumber: invoice.invoiceNumber,
        status: subscription.status,
        planName: subscription.planName,
        purgeResult
      };
    }

    // 3. Refund Processed Event
    if (eventType === 'refund.processed' || eventType === 'payment.refunded') {
      const paymentEntity = eventPayload?.payload?.payment?.entity;
      const paymentId = paymentEntity?.id;
      const tenantId = paymentEntity?.notes?.tenantId;

      if (paymentId) {
        const paymentRecord = await prisma.subscriptionPayment.findFirst({
          where: { paymentId }
        });

        if (paymentRecord) {
          await prisma.subscriptionPayment.update({
            where: { id: paymentRecord.id },
            data: { status: SubscriptionPaymentStatus.REFUNDED }
          });

          await prisma.subscriptionInvoice.updateMany({
            where: { paymentId: paymentRecord.id },
            data: { status: SubscriptionInvoiceStatus.VOID }
          });

          if (tenantId) {
            await prisma.auditLog.create({
              data: {
                tenantId,
                action: 'RAZORPAY_REFUND_PROCESSED',
                entity: 'SubscriptionPayment',
                entityId: paymentRecord.id,
                details: { eventId, paymentId }
              }
            }).catch(() => {});
          }
        }
      }

      return {
        handled: true,
        eventType,
        message: 'Refund acknowledged and recorded.'
      };
    }

    // Default acknowledgement
    return {
      handled: true,
      eventType,
      message: `Event '${eventType}' acknowledged.`
    };
  }

  /**
   * Retrieves all subscription payment transactions for a tenant (tenant isolated).
   */
  static async getTenantTransactions(tenantId: string) {
    return prisma.subscriptionPayment.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            amount: true
          }
        }
      }
    });
  }

  /**
   * Retrieves all subscription invoices for a tenant (tenant isolated).
   */
  static async getTenantInvoices(tenantId: string) {
    return prisma.subscriptionInvoice.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        payment: {
          select: {
            id: true,
            orderId: true,
            paymentId: true,
            status: true
          }
        }
      }
    });
  }

  /**
   * Retrieves a single subscription invoice by ID, strictly enforcing tenant isolation.
   */
  static async getTenantInvoiceById(tenantId: string, invoiceId: string) {
    const invoice = await prisma.subscriptionInvoice.findFirst({
      where: {
        id: invoiceId,
        tenantId
      },
      include: {
        payment: true,
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            email: true,
            phone: true,
            address: true,
            gstNumber: true,
            currency: true
          }
        }
      }
    });

    if (!invoice) {
      const err: any = new Error('Invoice not found');
      err.statusCode = 404;
      err.code = 'INVOICE_NOT_FOUND';
      throw err;
    }

    return invoice;
  }
}

export const billingService = BillingService;
