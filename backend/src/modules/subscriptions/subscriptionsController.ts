import { Request, Response, NextFunction } from 'express';
import { SubscriptionService, SUBSCRIPTION_PLANS, SubscriptionStatus } from './subscriptionService';
import { RazorpayService } from './razorpayService';
import { prisma } from '../../core/prisma';
import { logger } from '../../core/logger';
import { config } from '../../config';

export class SubscriptionsController {
  /**
   * Creates a Razorpay checkout order for SaaS subscription payments.
   * - Requires authenticated tenant context (req.tenantId).
   * - Validates plan against existing subscription tiers.
   * - Calculates amount strictly on the server; ignores client-supplied amount or tenantId.
   * - Never returns RAZORPAY_KEY_SECRET.
   * - Does NOT activate the subscription or purge demo data yet (order creation != payment).
   */
  static async checkout(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const { plan } = req.body;

      if (!plan || typeof plan !== 'string') {
        return res.status(400).json({
          success: false,
          error: { message: 'Plan name is required (e.g. STARTER, PROFESSIONAL, ENTERPRISE)', code: 'INVALID_PLAN' }
        });
      }

      const normalizedPlan = plan.trim().toUpperCase();
      const planConfig = SUBSCRIPTION_PLANS[normalizedPlan];

      if (!planConfig || normalizedPlan === 'FREE_TRIAL') {
        return res.status(400).json({
          success: false,
          error: {
            message: `Invalid subscription plan "${plan}". Allowed paid plans: STARTER, PROFESSIONAL, ENTERPRISE, BUSINESS`,
            code: 'INVALID_PLAN'
          }
        });
      }

      // Calculate amount strictly on server side from plan configuration
      const amount = planConfig.amountInPaise;
      const currency = planConfig.currency || 'INR';

      // Create Razorpay payment order
      const receipt = `rcpt_sub_${tenantId.replace(/-/g, '').substring(0, 10)}_${Date.now()}`;
      const razorpayOrder = await RazorpayService.createOrder({
        amountInPaise: amount,
        currency,
        receipt,
        notes: {
          tenantId,
          plan: planConfig.name
        }
      });

      // Return ONLY the required public parameters to open Razorpay Checkout on frontend
      return res.status(200).json({
        success: true,
        data: {
          orderId: razorpayOrder.id,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency,
          keyId: config.razorpayKeyId || 'rzp_test_placeholder_key',
          plan: planConfig.name
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Verifies Razorpay payment signature returned after frontend checkout.
   * - Requires authenticated tenant context (req.tenantId).
   * - Validates razorpay_order_id, razorpay_payment_id, razorpay_signature.
   * - Verifies HMAC-SHA256 signature using RAZORPAY_KEY_SECRET on server.
   * - Rejects invalid signatures with HTTP 400 without activating subscription.
   * - Idempotent: does not reactivate or purge twice if already verified.
   * - Activates subscription for authenticated tenant with requested plan.
   * - Stores paymentId and 'razorpay' provider on subscription.
   * - Purges demo data for this tenant only.
   * - Preserves all real customer/business data.
   */
  static async verifyPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } = req.body;

      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Missing required payment verification parameters: razorpay_order_id, razorpay_payment_id, and razorpay_signature',
            code: 'MISSING_PAYMENT_DETAILS'
          }
        });
      }

      // Verify Razorpay signature mathematically using server-side secret
      const isValid = RazorpayService.verifyPaymentSignature({
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        signature: razorpay_signature
      });

      if (!isValid) {
        logger.warn(`[SubscriptionsController] Invalid payment signature for tenant ${tenantId}, order ${razorpay_order_id}`);
        return res.status(400).json({
          success: false,
          error: {
            message: 'Payment verification failed: invalid signature. Subscription was not activated.',
            code: 'INVALID_SIGNATURE'
          }
        });
      }

      // Check idempotency: If already ACTIVE with this paymentId, don't re-activate or re-purge
      const currentSub = await prisma.subscription.findUnique({ where: { tenantId } });
      if (currentSub?.status === SubscriptionStatus.ACTIVE && currentSub?.providerSubscriptionId === razorpay_payment_id) {
        const summary = await SubscriptionService.getSubscriptionSummary(tenantId);
        return res.status(200).json({
          success: true,
          message: 'Payment already verified and subscription is active.',
          data: summary,
          idempotent: true
        });
      }

      // Determine validated plan
      const normalizedPlan = (typeof plan === 'string' && plan.trim())
        ? plan.trim().toUpperCase()
        : (currentSub?.planName && currentSub.planName !== 'FREE_TRIAL' ? currentSub.planName : 'PROFESSIONAL');
      const planConfig = SUBSCRIPTION_PLANS[normalizedPlan] || SUBSCRIPTION_PLANS.PROFESSIONAL;

      // Activate subscription & purge tenant demo data
      const { subscription, purgeResult } = await SubscriptionService.activateSubscription(tenantId, planConfig.name, {
        clearDemo: true,
        paymentId: razorpay_payment_id,
        paymentProvider: 'razorpay'
      });

      const summary = await SubscriptionService.getSubscriptionSummary(tenantId);

      return res.status(200).json({
        success: true,
        message: 'Payment successfully verified. Subscription activated!',
        data: {
          subscription: summary,
          paymentId: razorpay_payment_id,
          orderId: razorpay_order_id,
          plan: planConfig.name,
          purgeResult
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Webhook endpoint for Razorpay payment and subscription events.
   * - Signature verification using x-razorpay-signature and webhook secret.
   * - Rejects invalid signatures with HTTP 400.
   * - Idempotent: checks event id and payment id to prevent duplicate activations.
   * - Extracts tenantId and plan from server-side order/payment notes.
   * - On payment.captured or order.paid: activates subscription and purges demo data.
   * - On payment.failed: records failure, sets status PAST_DUE without activating or purging.
   */
  static async handleWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const signature = req.headers['x-razorpay-signature'] as string;
      if (!signature) {
        return res.status(400).json({
          success: false,
          error: { message: 'Missing x-razorpay-signature header', code: 'MISSING_SIGNATURE' }
        });
      }

      // Raw payload for cryptographic HMAC signature verification
      const rawPayload = (req as any).rawBody || (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
      const isValid = RazorpayService.verifyWebhookSignature(rawPayload, signature);

      if (!isValid) {
        logger.warn('[SubscriptionsController] Webhook signature verification failed');
        return res.status(400).json({
          success: false,
          error: { message: 'Invalid webhook signature', code: 'INVALID_SIGNATURE' }
        });
      }

      const eventPayload = req.body;
      const eventType = eventPayload?.event;
      const eventId = eventPayload?.id || eventPayload?.payload?.payment?.entity?.id || `evt_${Date.now()}`;

      logger.info(`[SubscriptionsController] Processing verified Razorpay webhook: ${eventType} (ID: ${eventId})`);

      // Handle payment failure event
      if (eventType === 'payment.failed') {
        const paymentEntity = eventPayload?.payload?.payment?.entity;
        const tenantId = paymentEntity?.notes?.tenantId;
        const failureReason = paymentEntity?.error_description || 'Payment failed';

        if (tenantId) {
          const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
          if (tenant) {
            await prisma.subscription.updateMany({
              where: { tenantId },
              data: { status: SubscriptionStatus.PAST_DUE }
            });
            await prisma.auditLog.create({
              data: {
                tenantId,
                action: 'RAZORPAY_PAYMENT_FAILED',
                entity: 'Subscription',
                entityId: eventId,
                details: { eventId, reason: failureReason, paymentId: paymentEntity?.id }
              }
            }).catch(() => {});
          }
        }

        return res.status(200).json({
          success: true,
          message: 'Payment failure recorded. Subscription not activated.',
          data: { status: 'PAST_DUE', reason: failureReason }
        });
      }

      // Handle payment success events (payment.captured, order.paid, subscription.charged)
      if (eventType === 'payment.captured' || eventType === 'order.paid' || eventType === 'subscription.charged') {
        const paymentEntity = eventPayload?.payload?.payment?.entity;
        const orderEntity = eventPayload?.payload?.order?.entity;

        const tenantId = paymentEntity?.notes?.tenantId || orderEntity?.notes?.tenantId;
        const planName = paymentEntity?.notes?.plan || orderEntity?.notes?.plan || 'PROFESSIONAL';
        const paymentId = paymentEntity?.id || orderEntity?.id || eventId;

        if (!tenantId) {
          logger.warn(`[SubscriptionsController] Webhook event ${eventId} missing tenantId in metadata notes`);
          return res.status(400).json({
            success: false,
            error: { message: 'Missing tenantId in event metadata notes', code: 'MISSING_TENANT' }
          });
        }

        const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
        if (!tenant) {
          logger.warn(`[SubscriptionsController] Webhook tenantId ${tenantId} not found`);
          return res.status(404).json({
            success: false,
            error: { message: 'Tenant not found', code: 'TENANT_NOT_FOUND' }
          });
        }

        // Idempotency check:
        // Check if audit log exists or if subscription already active with this paymentId
        const existingAudit = await prisma.auditLog.findFirst({
          where: {
            tenantId,
            action: 'RAZORPAY_WEBHOOK_PROCESSED',
            entityId: eventId
          }
        });

        const currentSub = await prisma.subscription.findUnique({ where: { tenantId } });
        if (existingAudit || (currentSub?.status === SubscriptionStatus.ACTIVE && currentSub?.providerSubscriptionId === paymentId)) {
          logger.info(`[SubscriptionsController] Idempotent webhook: event ${eventId} already processed for tenant ${tenantId}`);
          return res.status(200).json({
            success: true,
            message: 'Webhook event already processed (idempotent)',
            idempotent: true
          });
        }

        const normalizedPlan = (typeof planName === 'string' && planName.trim()) ? planName.trim().toUpperCase() : 'PROFESSIONAL';
        const planConfig = SUBSCRIPTION_PLANS[normalizedPlan] || SUBSCRIPTION_PLANS.PROFESSIONAL;

        // Activate subscription and purge demo data
        const { subscription, purgeResult } = await SubscriptionService.activateSubscription(tenantId, planConfig.name, {
          clearDemo: true,
          paymentId,
          paymentProvider: 'razorpay'
        });

        // Record audit log for idempotency and auditability
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
              plan: planConfig.name,
              purgeResult: purgeResult ? (purgeResult as any) : null
            }
          }
        }).catch((err) => logger.error('[SubscriptionsController] Failed to record audit log', err));

        return res.status(200).json({
          success: true,
          message: 'Webhook processed: subscription activated successfully',
          data: {
            subscriptionId: subscription.id,
            status: subscription.status,
            planName: subscription.planName,
            purgeResult
          }
        });
      }

      // Default acknowledgement for unhandled event types
      return res.status(200).json({
        success: true,
        message: `Webhook event '${eventType}' acknowledged.`
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Retrieves sanitized subscription details and trial countdown for the current tenant.
   */
  static async getCurrentSubscription(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const summary = await SubscriptionService.getSubscriptionSummary(tenantId);

      return res.json({
        success: true,
        data: summary
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Returns available plan tiers and features.
   */
  static async getPlans(req: Request, res: Response, next: NextFunction) {
    try {
      return res.json({
        success: true,
        data: {
          plans: Object.values(SUBSCRIPTION_PLANS),
          tiers: SUBSCRIPTION_PLANS,
          ...SUBSCRIPTION_PLANS
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Development-only state simulation helper.
   * Completely disabled in production.
   */
  static async devSimulate(req: Request, res: Response, next: NextFunction) {
    try {
      if (config.nodeEnv === 'production') {
        return res.status(404).json({
          success: false,
          error: { message: 'Not found', code: 'NOT_FOUND' }
        });
      }

      const tenantId = req.tenantId!;
      const { status, planName } = req.body;

      if (!status || !Object.values(SubscriptionStatus).includes(status)) {
        return res.status(400).json({
          success: false,
          error: {
            message: `Invalid simulation status. Allowed: ${Object.values(SubscriptionStatus).join(', ')}`,
            code: 'INVALID_STATUS'
          }
        });
      }

      const updated = await SubscriptionService.devSimulateStatus(tenantId, status, planName);
      const summary = await SubscriptionService.getSubscriptionSummary(tenantId);

      return res.json({
        success: true,
        message: `[DEV ONLY] Tenant subscription simulated to ${status}.`,
        data: summary
      });
    } catch (err) {
      next(err);
    }
  }
}
