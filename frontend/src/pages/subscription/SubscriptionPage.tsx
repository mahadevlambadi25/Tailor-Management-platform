import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Zap,
  Building2,
  Users,
  Scissors,
  HelpCircle,
  RefreshCw,
  Crown
} from 'lucide-react';
import { loadRazorpayScript } from '../../utils/razorpay';

interface PlanDefinition {
  name: string;
  displayName: string;
  price: string;
  period: string;
  maxOrdersPerMonth: number;
  maxStaff: number;
  maxBranches: number;
  features: string[];
  popular?: boolean;
}

const PLANS: PlanDefinition[] = [
  {
    name: 'STARTER',
    displayName: 'Starter Atelier',
    price: '₹999',
    period: '/ month',
    maxOrdersPerMonth: 500,
    maxStaff: 15,
    maxBranches: 2,
    features: [
      'Up to 500 Bespoke Orders / month',
      'Up to 15 Atelier Staff Accounts',
      'Up to 2 Workshop Branches',
      'Client Measurement History & Profiles',
      'Walk-in & Fitting Appointments',
      'Fabric & Style Catalog Management',
      'Basic Financial & Payment Receipts',
      'Client OTP Portal Access'
    ]
  },
  {
    name: 'PROFESSIONAL',
    displayName: 'Professional Boutique',
    price: '₹2,499',
    period: '/ month',
    maxOrdersPerMonth: 2000,
    maxStaff: 50,
    maxBranches: 5,
    popular: true,
    features: [
      'Up to 2,000 Bespoke Orders / month',
      'Up to 50 Atelier Staff Accounts',
      'Up to 5 Workshop Branches',
      'Kanban Production Stage Tracking',
      'Advanced Multi-Language (EN, HI, KN)',
      'Business Analytics & Tax Reports',
      'Trial Fittings & Alterations Workflow',
      'Full Audit Logging & Tenant Isolation',
      'Priority Customer Success Support'
    ]
  },
  {
    name: 'ENTERPRISE',
    displayName: 'Enterprise Haute Couture',
    price: '₹5,999',
    period: '/ month',
    maxOrdersPerMonth: 10000,
    maxStaff: 200,
    maxBranches: 20,
    features: [
      'Unlimited Bespoke Orders',
      'Up to 200 Staff & Tailors',
      'Up to 20 Workshop Branches',
      'Dedicated Account Executive',
      'Custom Pattern & Measurement Schemas',
      'Full CSV/Excel Bulk Import & Export',
      'Custom Thermal & Invoice Printing Templates',
      '99.9% SLA & 24/7 Concierge Support'
    ]
  }
];

export const SubscriptionPage: React.FC = () => {
  const { tenant, subscription, refreshTenant, trialDaysRemaining, isSubscriptionActive, isSubscriptionExpired, isTrial, startTrial } = useTenant();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [isSimulating, setIsSimulating] = useState(false);
  const [isStartingTrial, setIsStartingTrial] = useState(false);
  const [simulationMessage, setSimulationMessage] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string>('PROFESSIONAL');
  const [infoNotice, setInfoNotice] = useState<string | null>(null);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const isExpiredQuery = searchParams.get('expired') === 'true';
  const isDevMode = import.meta.env.DEV;

  useEffect(() => {
    refreshTenant();
  }, []);

  // UI State Mapping
  const trialUsed = subscription?.trialUsed === true;
  const isPaidPlan = !!subscription?.planName && subscription.planName !== 'FREE_TRIAL';

  // State A: New Tenant / Trial Not Used
  const isStateA = !trialUsed && subscription?.status !== 'ACTIVE' && subscription?.status !== 'TRIAL';

  // State B: Trial Active
  const isStateB = !isStateA && subscription?.status === 'TRIAL' && isSubscriptionActive;

  // State C: Trial Expired
  const isStateC = !isStateA && !isStateB && (isSubscriptionExpired || subscription?.status === 'TRIAL') && !isPaidPlan;

  // State D: Paid Subscription Active
  const isStateD = subscription?.status === 'ACTIVE' && isPaidPlan;

  // State E: Paid Subscription Expired / Cancelled / Past Due
  const isStateE = !isStateA && !isStateB && !isStateC && !isStateD;

  const scrollToPlans = () => {
    document.getElementById('pricing-plans')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleStartTrial = async () => {
    if (isStartingTrial) return;
    try {
      setIsStartingTrial(true);
      setPaymentError(null);
      setPaymentSuccess(null);
      const res = await startTrial();
      if (res.success) {
        setPaymentSuccess('14-Day Free Trial activated successfully! Demo data has been purged.');
        await refreshTenant();
      } else {
        setPaymentError(res.error || 'Failed to start free trial.');
      }
    } catch (err: any) {
      setPaymentError(err.message || 'Failed to start free trial.');
    } finally {
      setIsStartingTrial(false);
    }
  };

  const handleInitiateCheckout = async (plan: PlanDefinition) => {
    // Prevent duplicate clicks while payment is in flight
    if (processingPlan) return;

    setSelectedPlan(plan.name);
    setPaymentError(null);
    setPaymentSuccess(null);
    setInfoNotice(null);
    setProcessingPlan(plan.name);

    try {
      // 1. Call POST /api/v1/subscriptions/checkout (never sending amount from frontend)
      const checkoutRes = await api.post('/subscriptions/checkout', {
        plan: plan.name
      });

      if (!checkoutRes.data?.success || !checkoutRes.data?.data) {
        throw new Error(checkoutRes.data?.error?.message || 'Failed to initialize subscription checkout');
      }

      // 2. Read parameters strictly from backend response
      const { orderId, amount, currency, keyId } = checkoutRes.data.data;

      // 3. Load Razorpay Checkout SDK via reusable loader
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded || !window.Razorpay) {
        throw new Error('Razorpay Checkout SDK failed to load. Please verify your internet connection and try again.');
      }

      // 4. Configure and open Razorpay modal using backend-supplied values only
      const options = {
        key: keyId,
        amount,
        currency,
        order_id: orderId,
        name: tenant?.name || 'Tailor Management System',
        description: `${plan.displayName} Subscription (${plan.period})`,
        prefill: {
          name: user?.name,
          email: user?.email,
          contact: tenant?.phone
        },
        theme: {
          color: '#2563eb'
        },
        handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          try {
            setProcessingPlan(plan.name);
            setPaymentError(null);

            // 5. On payment completion, call backend verify-payment endpoint
            const verifyRes = await api.post('/subscriptions/verify-payment', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              plan: plan.name
            });

            if (verifyRes.data?.success) {
              // 7. Refresh subscription info and show success
              setPaymentSuccess(`Payment verified successfully! Your atelier is now active on the ${plan.displayName} tier.`);
              await refreshTenant();
            } else {
              setPaymentError(verifyRes.data?.error?.message || 'Payment verification failed on the server.');
            }
          } catch (verifyErr: any) {
            setPaymentError(
              verifyErr.response?.data?.error?.message ||
              verifyErr.message ||
              'Payment verification failed. Please contact support if your account was debited.'
            );
          } finally {
            setProcessingPlan(null);
          }
        },
        modal: {
          ondismiss: () => {
            // 8. User closed or cancelled modal
            setProcessingPlan(null);
            setPaymentError('Checkout window was closed. Payment was cancelled.');
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (failureResponse: any) => {
        setProcessingPlan(null);
        setPaymentError(failureResponse.error?.description || 'Payment was declined or failed.');
      });

      rzp.open();
    } catch (err: any) {
      setProcessingPlan(null);
      setPaymentError(
        err.response?.data?.error?.message ||
        err.message ||
        'Unable to initialize checkout. Please try again.'
      );
    }
  };

  const handleSelectPlan = (plan: PlanDefinition) => {
    handleInitiateCheckout(plan);
  };

  const handleDevSimulate = async (status: 'TRIAL' | 'EXPIRED' | 'ACTIVE' | 'PENDING', planName?: string) => {
    try {
      setIsSimulating(true);
      setSimulationMessage(null);
      const res = await api.post('/subscriptions/dev-simulate', {
        status,
        planName: planName || selectedPlan
      });
      if (res.data.success) {
        setSimulationMessage(`Simulator updated status to ${status}!`);
        await refreshTenant();
      }
    } catch (err: any) {
      setSimulationMessage(err.response?.data?.error?.message || 'Simulation failed');
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4" />
            <span>Atelier Subscription & Billing</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
            {tenant?.name ? `${tenant.name} Subscription` : 'Subscription Management'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Review your atelier subscription tier, trial countdown, and platform limits.
          </p>
        </div>

        <button
          onClick={() => refreshTenant()}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-xs w-fit"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Status</span>
        </button>
      </div>

      {/* Expiry Query Alert */}
      {(isExpiredQuery || isSubscriptionExpired) && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 shadow-xs flex items-start gap-3.5">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-bold text-amber-900">Atelier Operations Locked — Active Subscription Required</h3>
            <p className="text-xs text-amber-700 mt-1 leading-relaxed">
              Your 14-day free trial or subscription period has elapsed. Orders, measurements, fittings, and reports are temporarily in view/locked mode. Your atelier records, staff accounts, and demo data remain 100% safe.
            </p>
          </div>
        </div>
      )}

      {/* STATE A: NEW TENANT / TRIAL NOT USED */}
      {isStateA && (
        <div className="rounded-2xl bg-gradient-to-br from-blue-50/80 via-indigo-50/30 to-white border border-blue-200 shadow-sm p-6 overflow-hidden relative">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-3 max-w-xl">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>New Atelier</span>
              </div>
              <h2 className="text-2xl font-bold text-slate-900">14-Day Free Trial</h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Try TailorPro free for 14 days. Explore bespoke measurements, Kanban workflow, and client portals with zero upfront commitment.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  id="start-free-trial-btn"
                  disabled={isStartingTrial}
                  onClick={handleStartTrial}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/25 transition-all disabled:opacity-50"
                >
                  {isStartingTrial ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Activating Free Trial...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      <span>Start 14-Day Free Trial</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="w-full md:w-auto grid grid-cols-3 gap-4 border-t md:border-t-0 md:border-l border-blue-200 pt-4 md:pt-0 md:pl-8 text-center bg-white/70 p-4 rounded-xl border md:border-y-0 md:border-r-0">
              <div>
                <div className="text-xs text-slate-500 font-medium">Monthly Orders</div>
                <div className="text-xl font-bold text-slate-900 mt-1">{subscription?.maxOrdersPerMonth || 100}</div>
                <div className="text-[10px] text-slate-400">trial quota</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 font-medium">Max Staff</div>
                <div className="text-xl font-bold text-slate-900 mt-1">{subscription?.maxStaff || 5}</div>
                <div className="text-[10px] text-slate-400">accounts</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 font-medium">Max Branches</div>
                <div className="text-xl font-bold text-slate-900 mt-1">{subscription?.maxBranches || 1}</div>
                <div className="text-[10px] text-slate-400">workshop</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STATE B: TRIAL ACTIVE */}
      {isStateB && (
        <div className="rounded-2xl bg-gradient-to-br from-amber-50/80 via-amber-50/40 to-white border border-amber-200 shadow-sm p-6 overflow-hidden relative">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                  <Clock className="w-3.5 h-3.5 text-amber-700 animate-pulse" />
                  <span>Free Trial Active</span>
                </span>
                <span className="text-xs font-bold text-amber-700">
                  {trialDaysRemaining} {trialDaysRemaining === 1 ? 'day' : 'days'} remaining
                </span>
              </div>

              <h2 className="text-xl font-bold text-slate-900">
                Free Trial Active &mdash; {trialDaysRemaining} {trialDaysRemaining === 1 ? 'day' : 'days'} remaining
              </h2>

              <div className="text-xs text-slate-600 space-y-0.5">
                {subscription?.trialStart && (
                  <p>
                    Trial started: {new Date(subscription.trialStart).toLocaleDateString()}
                  </p>
                )}
                {subscription?.trialEnd && (
                  <p className="font-semibold text-amber-900">
                    Trial ends: {new Date(subscription.trialEnd).toLocaleDateString()}
                  </p>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  id="choose-paid-plan-btn"
                  onClick={scrollToPlans}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 shadow-sm transition-all"
                >
                  <span>Choose a Paid Plan</span>
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                </button>
              </div>
            </div>

            <div className="w-full md:w-auto grid grid-cols-3 gap-4 border-t md:border-t-0 md:border-l border-amber-200 pt-4 md:pt-0 md:pl-8 text-center bg-white/70 p-4 rounded-xl border md:border-y-0 md:border-r-0">
              <div>
                <div className="text-xs text-slate-500 font-medium">Monthly Orders</div>
                <div className="text-xl font-bold text-slate-900 mt-1">{subscription?.maxOrdersPerMonth || 100}</div>
                <div className="text-[10px] text-slate-400">trial quota</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 font-medium">Max Staff</div>
                <div className="text-xl font-bold text-slate-900 mt-1">{subscription?.maxStaff || 5}</div>
                <div className="text-[10px] text-slate-400">accounts</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 font-medium">Max Branches</div>
                <div className="text-xl font-bold text-slate-900 mt-1">{subscription?.maxBranches || 1}</div>
                <div className="text-[10px] text-slate-400">workshop</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STATE C: TRIAL EXPIRED */}
      {isStateC && (
        <div className="rounded-2xl bg-gradient-to-br from-rose-50 via-red-50/40 to-white border border-rose-200 shadow-sm p-6 overflow-hidden relative">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-3 max-w-xl">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                <span>Free Trial Ended</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900">Free Trial Ended</h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Your 14-day free trial has ended. Choose a subscription to continue using business features.
              </p>
              <div className="pt-1">
                <button
                  type="button"
                  id="view-plans-btn"
                  onClick={scrollToPlans}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/25 transition-all"
                >
                  <span>View Plans</span>
                </button>
              </div>
            </div>

            <div className="w-full md:w-auto p-4 rounded-xl bg-white border border-rose-100 text-xs text-slate-600 space-y-1.5">
              <div className="font-semibold text-rose-900">Trial Period Record</div>
              {subscription?.trialStart && (
                <div>Started: {new Date(subscription.trialStart).toLocaleDateString()}</div>
              )}
              {subscription?.trialEnd && (
                <div>Ended: {new Date(subscription.trialEnd).toLocaleDateString()}</div>
              )}
              <div className="text-[11px] text-slate-400 pt-1">
                Atelier data and client records are safe.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STATE D: PAID SUBSCRIPTION ACTIVE */}
      {isStateD && (
        <div className="rounded-2xl bg-gradient-to-br from-emerald-50/60 via-emerald-50/20 to-white border border-emerald-200 shadow-sm p-6 overflow-hidden relative">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>ACTIVE</span>
                </span>
                <span className="text-xs font-bold text-slate-600">
                  {subscription?.planName} Tier
                </span>
              </div>

              <h2 className="text-xl font-bold text-slate-900">
                {subscription?.planName} Atelier Plan
              </h2>

              <div className="text-xs text-slate-500 space-y-0.5">
                {subscription?.currentPeriodStart && (
                  <p>
                    Current Period: {new Date(subscription.currentPeriodStart).toLocaleDateString()} &mdash; {new Date(subscription.currentPeriodEnd || Date.now()).toLocaleDateString()}
                  </p>
                )}
                {subscription?.currentPeriodEnd && !subscription?.currentPeriodStart && (
                  <p>
                    Billing Period Ends: {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>

            <div className="w-full md:w-auto grid grid-cols-3 gap-4 border-t md:border-t-0 md:border-l border-emerald-200 pt-4 md:pt-0 md:pl-8 text-center bg-white/70 p-4 rounded-xl border md:border-y-0 md:border-r-0">
              <div>
                <div className="text-xs text-slate-500 font-medium">Monthly Orders</div>
                <div className="text-xl font-bold text-slate-900 mt-1">{subscription?.maxOrdersPerMonth || 2000}</div>
                <div className="text-[10px] text-slate-400">orders / mo</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 font-medium">Max Staff</div>
                <div className="text-xl font-bold text-slate-900 mt-1">{subscription?.maxStaff || 50}</div>
                <div className="text-[10px] text-slate-400">accounts</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 font-medium">Max Branches</div>
                <div className="text-xl font-bold text-slate-900 mt-1">{subscription?.maxBranches || 5}</div>
                <div className="text-[10px] text-slate-400">workshops</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STATE E: PAID SUBSCRIPTION EXPIRED / CANCELLED / PAST DUE */}
      {isStateE && (
        <div className="rounded-2xl bg-gradient-to-br from-amber-50 via-rose-50/30 to-white border border-amber-300 shadow-sm p-6 overflow-hidden relative">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-3 max-w-xl">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                  <span>{subscription?.status || 'EXPIRED'}</span>
                </span>
                <span className="text-xs font-medium text-slate-500">
                  Previous Tier: {subscription?.planName || 'Paid'}
                </span>
              </div>

              <h2 className="text-xl font-bold text-slate-900">Subscription Inactive</h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Your {subscription?.planName || 'paid'} subscription is currently {subscription?.status?.toLowerCase() || 'inactive'}. Choose a plan to reactivate full atelier features.
              </p>

              <div className="pt-1">
                <button
                  type="button"
                  id="reactivate-plan-btn"
                  onClick={scrollToPlans}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/25 transition-all"
                >
                  <span>Reactivate Subscription</span>
                </button>
              </div>
            </div>

            <div className="w-full md:w-auto p-4 rounded-xl bg-white border border-amber-200 text-xs text-slate-600 space-y-1">
              <div className="font-semibold text-slate-900">Subscription History</div>
              {subscription?.currentPeriodEnd && (
                <div>Period Ended: {new Date(subscription.currentPeriodEnd).toLocaleDateString()}</div>
              )}
              <div className="text-[11px] text-slate-400 pt-1">
                Atelier records are preserved.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info Notice Banner */}
      {infoNotice && (
        <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-xs text-blue-800 flex items-start gap-2.5">
          <HelpCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <span>{infoNotice}</span>
        </div>
      )}

      {/* Payment Success Alert */}
      {paymentSuccess && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-xs text-emerald-800 flex items-start gap-2.5 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-emerald-900">Payment Verified</p>
            <p className="mt-0.5 text-emerald-700">{paymentSuccess}</p>
          </div>
        </div>
      )}

      {/* Payment Error / Cancellation Alert */}
      {paymentError && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs text-rose-800 flex items-start gap-2.5 shadow-xs">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-rose-900">Payment Notice</p>
            <p className="mt-0.5 text-rose-700">{paymentError}</p>
          </div>
        </div>
      )}

      {/* Plan Tiers Grid */}
      <div id="pricing-plans" className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Available Subscription Plans</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Transparent pricing designed specifically for high-craft bespoke tailoring boutiques.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => {
            const isCurrent = subscription?.planName === plan.name && isSubscriptionActive;
            const isSelected = selectedPlan === plan.name;

            return (
              <div
                key={plan.name}
                className={`rounded-2xl p-6 transition-all flex flex-col justify-between relative bg-white border ${
                  plan.popular
                    ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-md'
                    : 'border-slate-200 hover:border-slate-300 shadow-sm'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-xs flex items-center gap-1">
                    <Crown className="w-3 h-3" />
                    Recommended for Ateliers
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-base text-slate-900">{plan.displayName}</h3>
                    {isCurrent && (
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                        Current
                      </span>
                    )}
                  </div>

                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-3xl font-black text-slate-900 tracking-tight">{plan.price}</span>
                    <span className="text-xs text-slate-500 font-medium">{plan.period}</span>
                  </div>

                  <div className="mt-4 space-y-1 text-xs text-slate-600 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <Scissors className="w-3.5 h-3.5 text-slate-400" />
                      <span>{plan.maxOrdersPerMonth.toLocaleString()} orders / month</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span>Up to {plan.maxStaff} staff members</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      <span>Up to {plan.maxBranches} branches</span>
                    </div>
                  </div>

                  <ul className="mt-4 space-y-2.5">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs text-slate-600">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    disabled={isCurrent || !!processingPlan}
                    onClick={() => handleInitiateCheckout(plan)}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      isCurrent
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default'
                        : processingPlan === plan.name
                          ? 'bg-blue-500 text-white cursor-wait opacity-90'
                          : processingPlan
                            ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                            : isSelected || plan.popular
                              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 hover:bg-blue-700'
                              : 'bg-slate-900 text-white hover:bg-slate-800'
                    }`}
                  >
                    {isCurrent ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Active Tier</span>
                      </>
                    ) : processingPlan === plan.name ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Processing Checkout...</span>
                      </>
                    ) : isStateE ? (
                      <span>Reactivate with {plan.displayName}</span>
                    ) : isStateA || isStateC ? (
                      <span>Choose {plan.displayName}</span>
                    ) : (
                      <span>Upgrade to {plan.displayName}</span>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Preservation Assurance Card */}
      <div className="rounded-2xl bg-slate-50 border border-slate-200 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-blue-100 text-blue-700 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">Your Data is 100% Preserved</h4>
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
              Trial expiration does NOT delete demo data or customer measurements. Demo records are only purged when you explicitly confirm an active paid subscription or clear them via shop settings.
            </p>
          </div>
        </div>
      </div>

      {/* Developer Simulation Box (Strictly Development Only) */}
      {isDevMode && (
        <div className="rounded-2xl bg-slate-900 text-white p-6 shadow-xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Developer Lifecycle Simulator (Non-Production Only)
              </h3>
            </div>
            <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-md font-mono">
              DEV_SIMULATE
            </span>
          </div>

          <p className="text-xs text-slate-400">
            Simulate trial expiration and renewal states to test business guard enforcement and UI responsiveness without real payment gateways.
          </p>

          <div className="flex flex-wrap gap-2.5">
            <button
              disabled={isSimulating}
              onClick={() => handleDevSimulate('PENDING', 'FREE_TRIAL')}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-300 border border-sky-800 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
            >
              Simulate New Atelier (Trial Unused)
            </button>
            <button
              disabled={isSimulating}
              onClick={() => handleDevSimulate('TRIAL', 'FREE_TRIAL')}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
            >
              Simulate 14-Day Free Trial
            </button>
            <button
              disabled={isSimulating}
              onClick={() => handleDevSimulate('EXPIRED', 'FREE_TRIAL')}
              className="px-3 py-1.5 bg-rose-950/70 hover:bg-rose-900 text-rose-300 border border-rose-800 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
            >
              Simulate Expired Trial (Trigger 402)
            </button>
            <button
              disabled={isSimulating}
              onClick={() => handleDevSimulate('ACTIVE', 'PROFESSIONAL')}
              className="px-3 py-1.5 bg-emerald-950/70 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
            >
              Simulate Active (Professional)
            </button>
            <button
              disabled={isSimulating}
              onClick={() => handleDevSimulate('ACTIVE', 'ENTERPRISE')}
              className="px-3 py-1.5 bg-blue-950/70 hover:bg-blue-900 text-blue-300 border border-blue-800 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
            >
              Simulate Active (Enterprise)
            </button>
          </div>

          {simulationMessage && (
            <div className="text-xs font-mono text-amber-300 bg-slate-950/50 p-2.5 rounded-lg border border-slate-800">
              {simulationMessage}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SubscriptionPage;
