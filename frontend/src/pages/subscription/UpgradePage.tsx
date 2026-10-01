import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { trackFunnelEvent } from '../../utils/funnel';
import {
  CheckCircle2,
  Sparkles,
  Zap,
  ArrowRight,
  Clock,
  Building2,
  Users,
  Scissors,
  Check,
  AlertCircle
} from 'lucide-react';
import { loadRazorpayScript } from '../../utils/razorpay';

interface PricingPlan {
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

interface ProgressData {
  firstName: string;
  customerCount: number;
  orderCount: number;
  staffCount: number;
  recommendedPlan: string;
  teamSize?: string;
  shopCount?: string;
  shopType?: string;
  currentSubscription?: any;
}

export const UpgradePage: React.FC = () => {
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState<'ANNUAL' | 'MONTHLY'>('ANNUAL');
  const [plans, setPlans] = useState<Record<string, PricingPlan>>({
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
  });

  const [progress, setProgress] = useState<ProgressData>({
    firstName: 'Tailor',
    customerCount: 0,
    orderCount: 0,
    staffCount: 0,
    recommendedPlan: 'PROFESSIONAL'
  });

  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [paymentSuccessMessage, setPaymentSuccessMessage] = useState<string | null>(null);
  const [paymentErrorMessage, setPaymentErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // Track upgrade_viewed
    trackFunnelEvent('upgrade_viewed', { source: 'upgrade_page' });

    // Load progress and config in parallel
    Promise.all([
      api.get('/conversion/upgrade/progress').catch(() => null),
      api.get('/conversion/config').catch(() => null)
    ]).then(([progressRes, configRes]) => {
      if (progressRes?.data?.success) {
        setProgress(progressRes.data.data);
      }
      if (configRes?.data?.success && configRes.data.data?.pricing) {
        setPlans(configRes.data.data.pricing);
      }
      setLoading(false);
    });
  }, []);

  const handleStartCheckout = async (planKey: string) => {
    try {
      setCheckoutLoading(planKey);
      setPaymentErrorMessage(null);
      setPaymentSuccessMessage(null);

      // Track checkout_started
      await trackFunnelEvent('checkout_started', { plan: planKey, billingCycle });

      const res = await api.post('/conversion/checkout', {
        plan: planKey,
        cycle: billingCycle
      });

      if (!res.data?.success || !res.data?.data) {
        throw new Error(res.data?.error?.message || 'Failed to initialize subscription checkout');
      }

      const { orderId, amount, currency, keyId } = res.data.data;

      // Load Razorpay Checkout SDK
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded || !window.Razorpay) {
        throw new Error('Razorpay Checkout SDK failed to load. Please verify your internet connection and try again.');
      }

      const options = {
        key: keyId,
        amount,
        currency: currency || 'INR',
        order_id: orderId,
        name: 'Tailor Management Platform',
        description: `${plans[planKey]?.displayName || planKey} Subscription (${billingCycle})`,
        theme: {
          color: '#2563eb'
        },
        handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          try {
            setCheckoutLoading(planKey);
            setPaymentErrorMessage(null);

            const verifyRes = await api.post('/subscriptions/verify-payment', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              plan: planKey
            });

            if (verifyRes.data?.success) {
              await trackFunnelEvent('payment_succeeded', { plan: planKey, cycle: billingCycle });
              setPaymentSuccessMessage(`Payment confirmed! Your atelier is now active on the ${plans[planKey]?.displayName || planKey} tier.`);
              setTimeout(() => {
                navigate('/dashboard');
              }, 2000);
            } else {
              setPaymentErrorMessage(verifyRes.data?.error?.message || 'Payment verification failed on the server.');
            }
          } catch (verifyErr: any) {
            setPaymentErrorMessage(
              verifyErr.response?.data?.error?.message ||
              verifyErr.message ||
              'Payment verification failed. Please contact support if your account was debited.'
            );
          } finally {
            setCheckoutLoading(null);
          }
        },
        modal: {
          ondismiss: () => {
            setCheckoutLoading(null);
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (failureResponse: any) => {
        setCheckoutLoading(null);
        setPaymentErrorMessage(failureResponse.error?.description || 'Payment was declined or failed.');
        trackFunnelEvent('payment_failed', { plan: planKey, cycle: billingCycle, reason: failureResponse.error?.description });
      });

      rzp.open();
    } catch (err: any) {
      setPaymentErrorMessage(err.response?.data?.error?.message || err.message || 'Failed to initiate checkout.');
    } finally {
      setCheckoutLoading(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16">
      {/* Header and Storytelling */}
      <div className="text-center space-y-3 pt-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Keep your atelier growing</span>
        </div>
        <h1 className="text-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          You've built something real, {progress.firstName}.
        </h1>
        <p className="text-xs sm:text-base text-slate-600 max-w-2xl mx-auto">
          {progress.customerCount} customers. {progress.orderCount} orders. {progress.staffCount} people on your team. Keep it all moving.
        </p>
        <p className="text-[11px] sm:text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl py-2 px-3 sm:px-4 inline-block">
          Your data stays exactly where it is. Nothing to set up again.
        </p>
      </div>

      {paymentSuccessMessage && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-900 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <div className="text-xs sm:text-sm font-semibold">{paymentSuccessMessage}</div>
        </div>
      )}

      {paymentErrorMessage && (
        <div className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-rose-900 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
          <div className="text-xs sm:text-sm font-semibold">{paymentErrorMessage}</div>
        </div>
      )}

      {/* Progress Cards Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-2xs text-center">
          <div className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">Real Customers</div>
          <div className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">{progress.customerCount}</div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">Measurements and profiles saved</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-2xs text-center">
          <div className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">Orders Tracked</div>
          <div className="text-xl sm:text-2xl font-extrabold text-blue-600 mt-1">{progress.orderCount}</div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">Garments stitched and delivered</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-2xs text-center">
          <div className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">Team Connected</div>
          <div className="text-xl sm:text-2xl font-extrabold text-emerald-600 mt-1">{progress.staffCount}</div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">Cutters, tailors, and finishers</div>
        </div>
      </div>

      {/* Monthly / Annual Toggle */}
      <div className="flex flex-col items-center justify-center gap-2.5">
        <div className="inline-flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200 w-full sm:w-auto">
          <button
            onClick={() => setBillingCycle('MONTHLY')}
            className={`flex-1 sm:flex-none px-3.5 py-2.5 min-h-[44px] text-xs font-bold rounded-lg transition-all cursor-pointer ${
              billingCycle === 'MONTHLY'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Monthly Billing
          </button>
          <button
            onClick={() => setBillingCycle('ANNUAL')}
            className={`flex-1 sm:flex-none px-3.5 py-2.5 min-h-[44px] text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              billingCycle === 'ANNUAL'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Annual Billing</span>
            <span className="text-[10px] bg-amber-300 text-amber-950 font-extrabold px-1.5 py-0.5 rounded-full shrink-0">
              Save ~17%
            </span>
          </button>
        </div>
        {billingCycle === 'ANNUAL' && (
          <span className="text-[11px] sm:text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full">
            Pay yearly, get 2 months free
          </span>
        )}
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {Object.values(plans).map((plan) => {
          const isRecommended = progress.recommendedPlan === plan.name;
          const isPopular = plan.popular;
          const price = billingCycle === 'ANNUAL' ? plan.annualPriceInInr : plan.monthlyPriceInInr;
          const cycleLabel = billingCycle === 'ANNUAL' ? '/ year' : '/ month';

          return (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-2xl bg-white p-6 sm:p-8 transition-all ${
                isPopular
                  ? 'border-2 border-blue-600 shadow-xl shadow-blue-500/10 ring-4 ring-blue-50'
                  : 'border border-slate-200 shadow-xs hover:border-slate-300'
              }`}
            >
              {isPopular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-3 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-white shadow-sm">
                  Most popular
                </div>
              )}

              {isRecommended && !isPopular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-emerald-600 px-3 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-white shadow-sm">
                  Tailored for your shop size
                </div>
              )}

              <div className="mb-4">
                <h3 className="text-lg font-bold text-slate-900">{plan.displayName}</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Ideal for {plan.name === 'STARTER' ? 'solo tailor boutiques' : plan.name === 'PROFESSIONAL' ? 'growing ateliers' : 'multi-branch operations'}.
                </p>
              </div>

              <div className="mb-6 flex items-baseline gap-1">
                <span className="text-3xl sm:text-4xl font-black text-slate-900">
                  ₹{price.toLocaleString('en-IN')}
                </span>
                <span className="text-xs font-semibold text-slate-500">{cycleLabel}</span>
              </div>

              <ul className="mb-8 space-y-3 text-xs text-slate-600 flex-1">
                <li className="flex items-center gap-2.5 font-medium text-slate-900">
                  <Scissors className="h-4 w-4 text-blue-600 shrink-0" />
                  <span>{plan.maxOrdersPerMonth.toLocaleString('en-IN')} orders per month</span>
                </li>
                <li className="flex items-center gap-2.5 font-medium text-slate-900">
                  <Users className="h-4 w-4 text-blue-600 shrink-0" />
                  <span>Up to {plan.maxStaff} staff members</span>
                </li>
                <li className="flex items-center gap-2.5 font-medium text-slate-900">
                  <Building2 className="h-4 w-4 text-blue-600 shrink-0" />
                  <span>{plan.maxBranches} shop branches</span>
                </li>
                {plan.features.map((feat, i) => (
                  <li key={i} className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleStartCheckout(plan.name)}
                disabled={checkoutLoading === plan.name}
                className={`w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-2 ${
                  isPopular
                    ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/20 active:scale-98'
                    : 'bg-slate-900 text-white hover:bg-slate-800 active:scale-98'
                }`}
              >
                {checkoutLoading === plan.name ? (
                  <span>Processing...</span>
                ) : (
                  <>
                    <span>Choose {plan.displayName}</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>


    </div>
  );
};
