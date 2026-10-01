import { BillingService } from '../subscriptions/billingService';
import { track } from './funnelService';

export interface PlanPricing {
  name: string;
  displayName: string;
  monthlyPriceInInr: number;
  annualPriceInInr: number;
  popular?: boolean;
  maxOrdersPerMonth: number;
  maxStaff: number;
  maxBranches: number;
  features: string[];
}

export const CONVERSION_PRICING_PLANS: Record<string, PlanPricing> = {
  STARTER: {
    name: 'STARTER',
    displayName: 'Starter',
    monthlyPriceInInr: 999,
    annualPriceInInr: 9990,
    maxOrdersPerMonth: 500,
    maxStaff: 15,
    maxBranches: 2,
    features: ['Up to 500 orders / mo', 'Up to 15 staff members', '2 shop branches', 'Kanban Production Board', 'Customer Portal']
  },
  PROFESSIONAL: {
    name: 'PROFESSIONAL',
    displayName: 'Professional',
    monthlyPriceInInr: 2499,
    annualPriceInInr: 24990,
    popular: true,
    maxOrdersPerMonth: 2000,
    maxStaff: 50,
    maxBranches: 5,
    features: ['Up to 2,000 orders / mo', 'Up to 50 staff members', '5 shop branches', 'Advanced Reports', 'Audit Logs', 'Priority Support']
  },
  BUSINESS: {
    name: 'BUSINESS',
    displayName: 'Business',
    monthlyPriceInInr: 5999,
    annualPriceInInr: 59990,
    maxOrdersPerMonth: 10000,
    maxStaff: 200,
    maxBranches: 20,
    features: ['Up to 10,000 orders / mo', 'Up to 200 staff members', '20 shop branches', 'Unlimited Everything', 'Dedicated Telemetry', 'SLA Guarantee']
  }
};

export class PaymentGatewayService {
  /**
   * Initiates real Razorpay checkout order.
   * STRICT GUARANTEE: Never simulates payments.
   */
  static async createCheckout(
    plan: string,
    cycle: 'MONTHLY' | 'ANNUAL' = 'ANNUAL',
    tenantId: string,
    userId?: string
  ) {
    const normalizedPlan = (plan || 'PROFESSIONAL').toUpperCase();
    const planConfig = CONVERSION_PRICING_PLANS[normalizedPlan] || CONVERSION_PRICING_PLANS.PROFESSIONAL;
    const amount = cycle === 'ANNUAL' ? planConfig.annualPriceInInr : planConfig.monthlyPriceInInr;

    // Track checkout_started
    await track(tenantId, 'checkout_started', {
      plan: normalizedPlan,
      cycle,
      amount
    }, userId);

    // Call real BillingService checkout to generate Razorpay order
    const checkoutData = await BillingService.createCheckout(tenantId, normalizedPlan);
    return {
      provider: 'razorpay',
      orderId: checkoutData.orderId,
      amount: checkoutData.amount,
      currency: checkoutData.currency,
      keyId: checkoutData.keyId,
      plan: checkoutData.plan,
      transactionId: checkoutData.transactionId
    };
  }
}
