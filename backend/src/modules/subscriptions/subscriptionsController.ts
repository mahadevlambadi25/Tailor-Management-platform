import { Request, Response, NextFunction } from 'express';
import { SubscriptionService, SUBSCRIPTION_PLANS, SubscriptionStatus } from './subscriptionService';
import { BillingService } from './billingService';
import { prisma } from '../../core/prisma';
import { logger } from '../../core/logger';
import { config } from '../../config';

export class SubscriptionsController {
  /**
   * Creates a Razorpay checkout order for SaaS subscription payments and records a pending transaction.
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

      const checkoutData = await BillingService.createCheckout(tenantId, plan);

      return res.status(200).json({
        success: true,
        data: checkoutData
      });
    } catch (err: any) {
      if (err.code === 'INVALID_PLAN') {
        return res.status(400).json({
          success: false,
          error: { message: err.message, code: 'INVALID_PLAN' }
        });
      }
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
   * - Creates a SubscriptionInvoice record.
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

      const result = await BillingService.verifyPayment(tenantId, {
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        signature: razorpay_signature,
        plan
      });

      return res.status(200).json({
        success: true,
        message: result.idempotent
          ? 'Payment already verified and subscription is active.'
          : 'Payment successfully verified. Subscription activated!',
        idempotent: result.idempotent,
        data: {
          subscription: result.subscription,
          paymentId: razorpay_payment_id,
          orderId: razorpay_order_id,
          plan: result.transaction?.planName || plan,
          invoice: result.invoice,
          transaction: result.transaction,
          purgeResult: result.purgeResult,
          idempotent: result.idempotent
        }
      });
    } catch (err: any) {
      if (err.code === 'INVALID_SIGNATURE') {
        return res.status(400).json({
          success: false,
          error: {
            message: err.message || 'Payment verification failed: invalid signature. Subscription was not activated.',
            code: 'INVALID_SIGNATURE'
          }
        });
      }
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
   * - On refund: marks transaction REFUNDED and invoice VOID.
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
      const result = await BillingService.handleWebhook(rawPayload, signature, req.body);

      return res.status(200).json({
        success: true,
        message: result.message || 'Webhook processed successfully',
        idempotent: (result as any).idempotent,
        data: result
      });
    } catch (err: any) {
      if (err.code === 'INVALID_SIGNATURE' || err.code === 'MISSING_SIGNATURE' || err.code === 'MISSING_TENANT') {
        return res.status(400).json({
          success: false,
          error: { message: err.message, code: err.code }
        });
      }
      if (err.code === 'TENANT_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          error: { message: err.message, code: err.code }
        });
      }
      next(err);
    }
  }

  /**
   * Retrieves SaaS subscription payment transactions for the authenticated tenant.
   */
  static async getTransactions(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const transactions = await BillingService.getTenantTransactions(tenantId);

      return res.status(200).json({
        success: true,
        data: transactions
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Retrieves SaaS subscription invoices for the authenticated tenant.
   */
  static async getInvoices(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const invoices = await BillingService.getTenantInvoices(tenantId);

      return res.status(200).json({
        success: true,
        data: invoices
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Retrieves a single SaaS subscription invoice by ID (enforcing tenant isolation).
   */
  static async getInvoiceById(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;
      const invoiceId = req.params.id;

      const invoice = await BillingService.getTenantInvoiceById(tenantId, invoiceId);

      return res.status(200).json({
        success: true,
        data: invoice
      });
    } catch (err: any) {
      if (err.code === 'INVOICE_NOT_FOUND' || err.statusCode === 404) {
        return res.status(404).json({
          success: false,
          error: { message: 'Invoice not found', code: 'INVOICE_NOT_FOUND' }
        });
      }
      next(err);
    }
  }

  /**
   * Starts the 14-day free trial for the authenticated tenant.
   * - Enforces one-time trial limit (rejects second trial attempt with TRIAL_ALREADY_USED).
   * - Server calculates 14 days duration from current server time.
   * - Idempotently purges demo data for this tenant only.
   * - Preserves all real customer/business data.
   */
  static async startTrial(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;

      const { subscription, purgeResult } = await SubscriptionService.startTrial(tenantId);
      const summary = await SubscriptionService.getSubscriptionSummary(tenantId);

      return res.status(200).json({
        success: true,
        message: '14-Day Free Trial activated successfully. Explore the system with sample data.',
        data: {
          subscription: summary,
          purgeResult
        }
      });
    } catch (err: any) {
      if (err.code === 'TRIAL_ALREADY_USED') {
        return res.status(400).json({
          success: false,
          error: 'TRIAL_ALREADY_USED',
          code: 'TRIAL_ALREADY_USED',
          message: err.message || 'Free trial has already been used for this atelier. Please choose a paid subscription plan.'
        });
      }
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
