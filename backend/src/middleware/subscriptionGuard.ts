import { Request, Response, NextFunction } from 'express';
import { SubscriptionService, SubscriptionStatus } from '../modules/subscriptions/subscriptionService';
import { config } from '../config';
import { track } from '../modules/conversion/funnelService';

/**
 * Subscription Guard Middleware.
 * Enforces that the target tenant currently possesses a valid, active subscription
 * or an unexpired trial before accessing paid business functionality.
 *
 * Distinct error code: SUBSCRIPTION_REQUIRED (HTTP 402)
 *
 * NOTE: Authentication (authGuard) and Tenant Isolation (tenantContext) must execute FIRST.
 * Does NOT replace or modify RBAC guards (requireRoles).
 */
export async function subscriptionGuard(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: { message: 'Missing tenant context for subscription evaluation.', code: 'TENANT_REQUIRED' }
      });
    }

    // Resolve tenant subscription and evaluate trial expiration idempotently
    const subscription = await SubscriptionService.checkSubscriptionStatus(tenantId);
    const isActive = SubscriptionService.isSubscriptionActive(subscription);

    if (isActive) {
      (req as any).subscription = subscription;
      return next();
    }

    // Conversion V1: Expired Trial Read-Only Mode
    if (config.conversionV1 && subscription.status === SubscriptionStatus.EXPIRED) {
      const isSafeMethod = ['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase());
      if (isSafeMethod) {
        // Allow read operations: viewing customers, measurements, orders, reports
        (req as any).subscription = subscription;
        (req as any).isReadOnlyExpired = true;
        return next();
      }

      // Mutating action blocked in expired trial mode
      await track(tenantId, 'readonly_blocked_action', {
        method: req.method,
        path: req.originalUrl,
        planName: subscription.planName
      }, req.user?.id);

      return res.status(402).json({
        success: false,
        error: {
          message: 'Your shop is in view-only mode. Continue your plan and pick up right where you left off.',
          code: 'READONLY_TRIAL_EXPIRED',
          details: {
            status: subscription.status,
            planName: subscription.planName,
            trialEnd: subscription.trialEnd,
            readOnly: true,
            renewable: true
          }
        }
      });
    }

    // Subscription is not active (EXPIRED, CANCELLED, PAST_DUE, or PENDING)
    const isPending = subscription.status === SubscriptionStatus.PENDING;

    return res.status(402).json({
      success: false,
      error: {
        message: isPending
          ? 'Subscription checkout pending payment confirmation.'
          : 'Active subscription required. Your atelier trial or subscription has expired.',
        code: isPending ? 'SUBSCRIPTION_PENDING' : 'SUBSCRIPTION_REQUIRED',
        details: {
          status: subscription.status,
          planName: subscription.planName,
          trialEnd: subscription.trialEnd,
          currentPeriodEnd: subscription.currentPeriodEnd,
          renewable: true
        }
      }
    });
  } catch (err: any) {
    next(err);
  }
}
