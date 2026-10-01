import { prisma } from '../../core/prisma';
import { logger } from '../../core/logger';
import { config } from '../../config';

export type FunnelEventType =
  | 'landing_cta_clicked'
  | 'signup_completed'
  | 'onboarding_answered'
  | 'onboarding_skipped'
  | 'sample_cleared'
  | 'first_customer'
  | 'first_measurement'
  | 'first_order'
  | 'aha_reached'
  | 'aha_sent_to_self'
  | 'staff_invited'
  | 'import_completed'
  | 'tour_completed'
  | 'upgrade_viewed'
  | 'checkout_started'
  | 'payment_succeeded'
  | 'payment_failed'
  | 'trial_expired'
  | 'readonly_blocked_action';

export class FunnelService {
  /**
   * Records a conversion funnel event safely.
   * GUARANTEE: Never throws or breaks calling operation if logging fails.
   */
  static async track(
    shopId: string,
    event: FunnelEventType | string,
    props?: Record<string, any>,
    userId?: string | null
  ): Promise<any> {
    if (!config.conversionV1) {
      return null;
    }

    try {
      const resolvedShopId = shopId || 'anonymous';
      return await prisma.funnelEvent.create({
        data: {
          shopId: resolvedShopId,
          userId: userId || null,
          event,
          props: props ? (props as any) : undefined
        }
      });
    } catch (err: any) {
      logger.warn(`[FunnelService] Failed to track event '${event}': ${err?.message}`);
      return null;
    }
  }
}

export const track = FunnelService.track.bind(FunnelService);
