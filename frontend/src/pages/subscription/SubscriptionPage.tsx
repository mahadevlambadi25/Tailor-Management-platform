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
  const { tenant, subscription, refreshTenant, trialDaysRemaining, isSubscriptionActive, isSubscriptionExpired, isTrial } = useTenant();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationMessage, setSimulationMessage] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string>('PROFESSIONAL');
  const [infoNotice, setInfoNotice] = useState<string | null>(null);

  const isExpiredQuery = searchParams.get('expired') === 'true';
  const isDevMode = import.meta.env.DEV;

  useEffect(() => {
    refreshTenant();
  }, []);

  const handleSelectPlan = (plan: PlanDefinition) => {
    setSelectedPlan(plan.name);
    setInfoNotice(
      `Selected ${plan.displayName}. Real payment gateway integration (Razorpay/Stripe) is scheduled for the next release. In development, you can use the Dev Simulator below to activate this plan immediately.`
    );
  };

  const handleDevSimulate = async (status: 'TRIAL' | 'EXPIRED' | 'ACTIVE', planName?: string) => {
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

      {/* Current Status Banner */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6 overflow-hidden relative">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-medium text-slate-500">Current Status:</span>
              {isSubscriptionExpired ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                  EXPIRED
                </span>
              ) : isTrial ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  FREE TRIAL ({trialDaysRemaining} {trialDaysRemaining === 1 ? 'day' : 'days'} left)
                </span>
              ) : isSubscriptionActive ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  ACTIVE ({subscription?.planName || 'PROFESSIONAL'})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800">
                  {subscription?.status || 'PENDING'}
                </span>
              )}
            </div>

            <div className="text-lg font-bold text-slate-900">
              {subscription?.planName || 'FREE_TRIAL'} Tier
            </div>

            <div className="text-xs text-slate-500 space-y-0.5">
              {subscription?.trialEnd && (
                <p>
                  Trial Window: {new Date(subscription.trialStart || Date.now()).toLocaleDateString()} &mdash; {new Date(subscription.trialEnd).toLocaleDateString()}
                </p>
              )}
              {subscription?.currentPeriodEnd && (
                <p>
                  Active Period End: {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 border-t md:border-t-0 md:border-l border-slate-200 pt-4 md:pt-0 md:pl-6 text-center">
            <div>
              <div className="text-xs text-slate-500 font-medium">Monthly Orders</div>
              <div className="text-base font-bold text-slate-900 mt-0.5">
                {subscription?.maxOrdersPerMonth || 1000}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">Max Staff</div>
              <div className="text-base font-bold text-slate-900 mt-0.5">
                {subscription?.maxStaff || 50}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">Max Branches</div>
              <div className="text-base font-bold text-slate-900 mt-0.5">
                {subscription?.maxBranches || 5}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Info Notice Banner */}
      {infoNotice && (
        <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-xs text-blue-800 flex items-start gap-2.5">
          <HelpCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <span>{infoNotice}</span>
        </div>
      )}

      {/* Plan Tiers Grid */}
      <div className="space-y-4">
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
                    onClick={() => handleSelectPlan(plan)}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 hover:bg-blue-700'
                        : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    {isCurrent ? 'Current Tier' : isSelected ? 'Selected Tier' : 'Select Plan'}
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
