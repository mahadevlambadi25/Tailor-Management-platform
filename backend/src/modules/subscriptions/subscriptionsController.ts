import { Request, Response, NextFunction } from 'express';
import { SubscriptionService, SUBSCRIPTION_PLANS, SubscriptionStatus } from './subscriptionService';
import { config } from '../../config';

export class SubscriptionsController {
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
