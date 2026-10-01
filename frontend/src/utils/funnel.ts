import { api } from '../api/client';

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

/**
 * Safely dispatches a conversion funnel event.
 * Never throws, never interrupts user actions.
 */
export async function trackFunnelEvent(event: FunnelEventType | string, props?: Record<string, any>): Promise<void> {
  try {
    const isConversionEnabled = import.meta.env.VITE_CONVERSION_V1 !== 'false';
    if (!isConversionEnabled) return;

    await api.post('/conversion/funnel/track', { event, props });
  } catch {
    // Fail silently to never degrade user experience
  }
}
