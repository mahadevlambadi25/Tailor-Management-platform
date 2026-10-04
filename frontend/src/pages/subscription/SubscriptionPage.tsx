import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import { formatCurrency } from '../../utils/currency';
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
  Crown,
  FileText,
  CreditCard,
  Printer,
  Eye,
  X,
  Calendar,
  DollarSign
} from 'lucide-react';
import { loadRazorpayScript } from '../../utils/razorpay';
import { Modal } from '../../components/common/Modal';

interface PlanDefinition {
  name: string;
  displayName: string;
  monthlyPrice: number;
  annualPrice: number;
  price?: string;
  priceValue?: number;
  period?: string;
  maxOrdersPerMonth: number;
  maxStaff: number;
  maxBranches: number;
  features: string[];
  popular?: boolean;
  recommendedTag?: string;
}

interface BillingTransaction {
  id: string;
  orderId: string;
  paymentId: string | null;
  amount: number | string;
  currency: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';
  planName: string;
  paidAt: string | null;
  failureReason: string | null;
  createdAt: string;
  invoice?: {
    id: string;
    invoiceNumber: string;
    status: string;
    amount: number | string;
  } | null;
}

interface SubscriptionInvoice {
  id: string;
  invoiceNumber: string;
  planName: string;
  amount: number | string;
  currency: string;
  status: 'ISSUED' | 'PAID' | 'VOID';
  billingPeriodStart: string;
  billingPeriodEnd: string;
  paidAt: string | null;
  providerPaymentId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  billingAddress: string | null;
  createdAt: string;
  payment?: {
    id: string;
    orderId: string;
    paymentId: string | null;
    status: string;
  } | null;
  tenant?: {
    id: string;
    name: string;
    slug: string;
    email: string | null;
    phone: string;
    address: string | null;
    gstNumber: string | null;
    currency: string;
  } | null;
}

const PLANS: PlanDefinition[] = [
  {
    name: 'STARTER',
    displayName: 'Starter Atelier',
    monthlyPrice: 999,
    annualPrice: 9990,
    price: '₹999',
    priceValue: 999,
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
    monthlyPrice: 2499,
    annualPrice: 24990,
    price: '₹2,499',
    priceValue: 2499,
    period: '/ month',
    maxOrdersPerMonth: 2000,
    maxStaff: 50,
    maxBranches: 5,
    popular: true,
    recommendedTag: 'Recommended for Ateliers',
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
    name: 'BUSINESS',
    displayName: 'Enterprise Haute Couture',
    monthlyPrice: 5999,
    annualPrice: 59990,
    price: '₹5,999',
    priceValue: 5999,
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
  const [isStartingTrial, setIsStartingTrial] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>('PROFESSIONAL');
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'ANNUAL'>('ANNUAL');
  const [infoNotice, setInfoNotice] = useState<string | null>(null);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Dynamic discount calculation based on actual monthly & annual plan prices
  const calculateDiscountPercentage = (monthly: number, annual: number): number => {
    if (!monthly || !annual) return 0;
    const yearlyAtMonthlyRate = monthly * 12;
    const savings = yearlyAtMonthlyRate - annual;
    return Math.round((savings / yearlyAtMonthlyRate) * 100);
  };

  const discountPercent = calculateDiscountPercentage(PLANS[0].monthlyPrice, PLANS[0].annualPrice);

  // Billing History & Invoices state
  const [transactions, setTransactions] = useState<BillingTransaction[]>([]);
  const [invoices, setInvoices] = useState<SubscriptionInvoice[]>([]);
  const [loadingBilling, setLoadingBilling] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<SubscriptionInvoice | null>(null);

  const isExpiredQuery = searchParams.get('expired') === 'true';
  const canManageBilling = user?.role === 'SHOP_OWNER' || user?.role === 'MANAGER';

  const fetchBillingHistory = async () => {
    if (!canManageBilling) return;
    try {
      setLoadingBilling(true);
      const [txRes, invRes] = await Promise.all([
        api.get('/subscriptions/transactions'),
        api.get('/subscriptions/invoices')
      ]);

      if (txRes.data?.success) {
        setTransactions(txRes.data.data || []);
      }
      if (invRes.data?.success) {
        setInvoices(invRes.data.data || []);
      }
    } catch (err) {
      console.warn('Could not load billing history', err);
    } finally {
      setLoadingBilling(false);
    }
  };

  useEffect(() => {
    refreshTenant();
    fetchBillingHistory();
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
        setPaymentSuccess('14-Day Free Trial activated successfully! Welcome to Tailor Management.');
        await refreshTenant();
        await fetchBillingHistory();
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
    if (processingPlan) return;

    setSelectedPlan(plan.name);
    setPaymentError(null);
    setPaymentSuccess(null);
    setInfoNotice(null);
    setProcessingPlan(plan.name);

    try {
      // 1. Call checkout endpoint (passing cycle: billingCycle; supports both conversion and subscriptions routes)
      let checkoutRes;
      try {
        checkoutRes = await api.post('/conversion/checkout', {
          plan: plan.name,
          cycle: billingCycle
        });
      } catch {
        checkoutRes = await api.post('/subscriptions/checkout', {
          plan: plan.name
        });
      }

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
        description: `${plan.displayName} Subscription (${billingCycle === 'ANNUAL' ? 'Annual' : 'Monthly'})`,
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
              setPaymentSuccess(`Payment verified successfully! Your atelier is now active on the ${plan.displayName} tier.`);
              await refreshTenant();
              await fetchBillingHistory();
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
            setProcessingPlan(null);
            setPaymentError('Checkout window was closed. Payment was cancelled.');
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (failureResponse: any) => {
        setProcessingPlan(null);
        setPaymentError(failureResponse.error?.description || 'Payment was declined or failed.');
        fetchBillingHistory();
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

  const handleOpenInvoiceModal = async (invoiceId: string) => {
    try {
      const res = await api.get(`/subscriptions/invoices/${invoiceId}`);
      if (res.data?.success) {
        setSelectedInvoice(res.data.data);
      }
    } catch (e) {
      console.error('Failed to load invoice details', e);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUCCESS':
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            {status}
          </span>
        );
      case 'PENDING':
      case 'ISSUED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
            <Clock className="w-3 h-3 text-amber-600" />
            {status}
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
            <AlertTriangle className="w-3 h-3 text-rose-600" />
            {status}
          </span>
        );
      case 'REFUNDED':
      case 'VOID':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
            {status}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4" />
            <span>Atelier Subscription & SaaS Billing</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
            {tenant?.name ? `${tenant.name} Subscription` : 'Subscription Management'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage your Tailor SaaS subscription tier, billing period, online renewals, and tax invoices.
          </p>
        </div>

        <button
          onClick={() => {
            refreshTenant();
            fetchBillingHistory();
          }}
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
            <h3 className="text-sm font-bold text-amber-900">Atelier Operations Locked: Active Subscription Required</h3>
            <p className="text-xs text-amber-700 mt-1 leading-relaxed">
              Your 14-day free trial or subscription period has elapsed. Orders, measurements, fittings, and reports are temporarily in view/locked mode. Your atelier records, staff accounts, and business data remain 100% safe.
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
                You're currently on your free trial. Add your own customers, orders, measurements, and production records while you explore Tailor Management. Your business data remains in your workspace when you upgrade to a paid plan.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  id="start-free-trial-btn"
                  disabled={isStartingTrial}
                  onClick={handleStartTrial}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/25 transition-all disabled:opacity-50 cursor-pointer"
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
            <div className="space-y-2 max-w-xl">
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
                14-Day Free Trial &mdash; {trialDaysRemaining} {trialDaysRemaining === 1 ? 'day' : 'days'} remaining
              </h2>

              <p className="text-xs text-slate-600 leading-relaxed">
                You're currently on your free trial. Add your own customers, orders, measurements, and production records while you explore Tailor Management. Your business data remains in your workspace when you upgrade to a paid plan.
              </p>

              <div className="text-xs text-slate-500 space-y-0.5 pt-1">
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
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 shadow-sm hover:shadow-md hover:shadow-indigo-500/20 active:scale-[0.98] transition-all cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300 fill-amber-300/20 shrink-0" />
                  <span>Choose a Paid Plan</span>
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
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 shadow-md shadow-indigo-500/20 active:scale-[0.98] transition-all cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300 fill-amber-300/20 shrink-0" />
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

              <p className="text-xs text-emerald-800 font-medium">
                Your subscription is active. Your workspace is ready for production.
              </p>

              <div className="text-xs text-slate-500 space-y-0.5 pt-0.5">
                {subscription?.currentPeriodStart && subscription?.currentPeriodEnd && (
                  <p>
                    Current Period: {new Date(subscription.currentPeriodStart).toLocaleDateString()} &mdash; {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                  </p>
                )}
                {subscription?.currentPeriodEnd && (
                  <p className="font-medium text-emerald-900">
                    Renews on: {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
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
                Your {subscription?.planName || 'paid'} subscription is currently {subscription?.status?.toLowerCase() || 'inactive'}. Choose a plan below to reactivate full atelier features.
              </p>

              <div className="pt-1">
                <button
                  type="button"
                  id="reactivate-plan-btn"
                  onClick={scrollToPlans}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 shadow-md shadow-indigo-500/20 active:scale-[0.98] transition-all cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300 fill-amber-300/20 shrink-0" />
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
      <div id="pricing-plans" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Available Subscription Plans</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Transparent pricing designed specifically for high-craft bespoke tailoring boutiques.
            </p>
          </div>

          {/* Monthly / Annual Billing Toggle */}
          <div className="flex flex-col items-start sm:items-end gap-1.5 shrink-0">
            <div className="inline-flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200 shadow-2xs">
              <button
                type="button"
                onClick={() => setBillingCycle('MONTHLY')}
                className={`px-3.5 py-1.5 min-h-[36px] text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  billingCycle === 'MONTHLY'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Monthly Billing
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('ANNUAL')}
                className={`px-3.5 py-1.5 min-h-[36px] text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  billingCycle === 'ANNUAL'
                    ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Annual Billing</span>
                <span className="text-[10px] bg-amber-300 text-amber-950 font-extrabold px-1.5 py-0.5 rounded-full shrink-0">
                  Save ~{discountPercent}%
                </span>
              </button>
            </div>
            {billingCycle === 'ANNUAL' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2.5 py-0.5 rounded-full">
                <Sparkles className="w-3 h-3 text-amber-500 fill-amber-500/20" />
                <span>Pay yearly, get 2 months free</span>
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {PLANS.map((plan) => {
            const isCurrent = subscription?.planName === plan.name && isSubscriptionActive;
            const price = billingCycle === 'ANNUAL' ? plan.annualPrice : plan.monthlyPrice;
            const formattedPrice = `₹${price.toLocaleString('en-IN')}`;
            const periodLabel = billingCycle === 'ANNUAL' ? '/ year' : '/ month';

            return (
              <div
                key={plan.name}
                className={`rounded-2xl p-6 transition-all flex flex-col justify-between relative bg-white border ${
                  plan.popular
                    ? 'border-2 border-indigo-500/80 ring-4 ring-indigo-500/10 shadow-lg shadow-indigo-500/5'
                    : 'border-slate-200 hover:border-slate-300 shadow-sm'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white text-[10px] font-bold uppercase tracking-wider px-3.5 py-1 rounded-full shadow-xs flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-amber-300 fill-amber-300/20" />
                    <span>{plan.recommendedTag || 'Recommended for Ateliers'}</span>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-base text-slate-900">{plan.displayName}</h3>
                    {isCurrent && (
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">
                        Current Tier
                      </span>
                    )}
                  </div>

                  <div className="mt-4 flex items-baseline gap-1.5">
                    <span className="text-3xl font-black text-slate-900 tracking-tight">{formattedPrice}</span>
                    <span className="text-xs text-slate-500 font-medium">{periodLabel}</span>
                  </div>
                  {billingCycle === 'ANNUAL' && (
                    <div className="text-[11px] text-emerald-700 font-semibold mt-0.5 flex items-center gap-1">
                      <span>₹{Math.round(plan.annualPrice / 12).toLocaleString('en-IN')}/mo &bull; 2 months free included</span>
                    </div>
                  )}

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
                          ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white cursor-wait opacity-90'
                          : processingPlan
                            ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                            : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 active:scale-[0.98] text-white shadow-md shadow-indigo-500/20 cursor-pointer'
                    }`}
                  >
                    {isCurrent ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Active Tier</span>
                      </>
                    ) : processingPlan === plan.name ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Processing Checkout...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-amber-300 fill-amber-300/20 shrink-0" />
                        <span>
                          {isStateE
                            ? `Reactivate with ${plan.displayName}`
                            : isStateA || isStateC
                              ? `Choose ${plan.displayName}`
                              : `Upgrade to ${plan.displayName}`}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Data Safety Assurance Card */}
      <div className="rounded-2xl bg-slate-50 border border-slate-200 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-blue-100 text-blue-700 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">Your Business Data is Always Safe</h4>
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
              All your customer profiles, orders, measurements, and payments remain permanently safe in your workspace when upgrading to a paid plan.
            </p>
          </div>
        </div>
      </div>

      {/* BILLING HISTORY & INVOICES SECTIONS (Accessible to SHOP_OWNER and MANAGER) */}
      {canManageBilling && (
        <div className="space-y-8 pt-4">
          {/* Section: Invoices */}
          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>SaaS Subscription Invoices</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tax invoices generated for each successful subscription billing cycle.
                </p>
              </div>
            </div>

            {loadingBilling ? (
              <div className="py-8 text-center text-xs text-slate-400">Loading invoices...</div>
            ) : invoices.length === 0 ? (
              <div className="py-8 text-center rounded-xl bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-400">
                No subscription invoices generated yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">Invoice #</th>
                      <th className="py-2.5 px-3 font-semibold">Plan</th>
                      <th className="py-2.5 px-3 font-semibold">Billing Period</th>
                      <th className="py-2.5 px-3 font-semibold">Amount</th>
                      <th className="py-2.5 px-3 font-semibold">Status</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-3 font-semibold text-slate-900">{inv.invoiceNumber}</td>
                        <td className="py-3 px-3 text-slate-600">{inv.planName}</td>
                        <td className="py-3 px-3 text-slate-500">
                          {new Date(inv.billingPeriodStart).toLocaleDateString()} &mdash; {new Date(inv.billingPeriodEnd).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-900">
                          {formatCurrency(Number(inv.amount))}
                        </td>
                        <td className="py-3 px-3">{getStatusBadge(inv.status)}</td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => handleOpenInvoiceModal(inv.id)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section: Transactions */}
          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-blue-600" />
                  <span>SaaS Payment Transactions</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Detailed payment transaction log and payment gateway references.
                </p>
              </div>
            </div>

            {loadingBilling ? (
              <div className="py-8 text-center text-xs text-slate-400">Loading transactions...</div>
            ) : transactions.length === 0 ? (
              <div className="py-8 text-center rounded-xl bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-400">
                No payment transactions recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">Date & Time</th>
                      <th className="py-2.5 px-3 font-semibold">Plan</th>
                      <th className="py-2.5 px-3 font-semibold">Amount</th>
                      <th className="py-2.5 px-3 font-semibold">Order ID</th>
                      <th className="py-2.5 px-3 font-semibold">Payment ID</th>
                      <th className="py-2.5 px-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-3 text-slate-500">
                          {new Date(tx.createdAt).toLocaleString()}
                        </td>
                        <td className="py-3 px-3 font-medium text-slate-800">{tx.planName}</td>
                        <td className="py-3 px-3 font-semibold text-slate-900">
                          {formatCurrency(Number(tx.amount))}
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px] text-slate-500">{tx.orderId}</td>
                        <td className="py-3 px-3 font-mono text-[11px] text-slate-500">
                          {tx.paymentId || '&mdash;'}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex flex-col gap-0.5">
                            {getStatusBadge(tx.status)}
                            {tx.failureReason && (
                              <span className="text-[10px] text-rose-600 font-medium">
                                {tx.failureReason}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* INVOICE MODAL / PRINTABLE DIALOG */}
      <Modal
        isOpen={Boolean(selectedInvoice)}
        onClose={() => setSelectedInvoice(null)}
        maxWidth="max-w-2xl"
        className="rounded-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 p-6 md:p-8 space-y-6"
        ariaLabel="Subscription Tax Invoice"
      >
        {selectedInvoice && (
          <div className="w-full space-y-6">
            {/* Header & Close */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-lg text-slate-900">Subscription Tax Invoice</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Invoice Content */}
            <div className="space-y-6 text-xs text-slate-600">
              {/* Shop & Issuer Info */}
              <div className="grid grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl">
                <div>
                  <div className="font-bold text-slate-900 text-sm">Billed To (Atelier):</div>
                  <div className="font-semibold text-slate-800 mt-1">{selectedInvoice.customerName || tenant?.name}</div>
                  {selectedInvoice.billingAddress && <div>{selectedInvoice.billingAddress}</div>}
                  {selectedInvoice.customerEmail && <div>{selectedInvoice.customerEmail}</div>}
                  {tenant?.phone && <div>Phone: {tenant.phone}</div>}
                  {tenant?.gstNumber && <div>GSTIN: {tenant.gstNumber}</div>}
                </div>
                <div className="text-right space-y-1">
                  <div>
                    <span className="text-slate-400">Invoice Number:</span>{' '}
                    <span className="font-bold text-slate-900">{selectedInvoice.invoiceNumber}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Date:</span>{' '}
                    <span>{new Date(selectedInvoice.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Status:</span>{' '}
                    <span className="font-bold text-emerald-700 uppercase">{selectedInvoice.status}</span>
                  </div>
                  {selectedInvoice.providerPaymentId && (
                    <div className="pt-1">
                      <span className="text-slate-400">Payment ID:</span>{' '}
                      <span className="font-mono text-[10px] text-slate-700">{selectedInvoice.providerPaymentId}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Line Items */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-700">
                    <tr>
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-3">Billing Period</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-900">
                          {selectedInvoice.planName} SaaS Subscription Plan
                        </div>
                        <div className="text-slate-400 text-[11px]">Monthly Recurring Atelier Access</div>
                      </td>
                      <td className="py-3 px-3 text-slate-500">
                        {new Date(selectedInvoice.billingPeriodStart).toLocaleDateString()} &mdash; {new Date(selectedInvoice.billingPeriodEnd).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-900 text-right">
                        {formatCurrency(Number(selectedInvoice.amount))}
                      </td>
                    </tr>
                  </tbody>
                  <tfoot className="bg-slate-50 border-t border-slate-200 font-bold text-slate-900">
                    <tr>
                      <td colSpan={2} className="py-2.5 px-3 text-right">Total Paid:</td>
                      <td className="py-2.5 px-3 text-right text-sm text-blue-600">
                        {formatCurrency(Number(selectedInvoice.amount))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Payment Receipt Acknowledgement */}
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-[11px] leading-relaxed">
                <span className="font-semibold">Payment Confirmed:</span> Online payment received via Razorpay Gateway. Thank you for your business!
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                className="px-5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default SubscriptionPage;
