import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { api } from '../../api/client';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatNumber } from '../../utils/currency';
import {
  ShoppingBag,
  Clock,
  AlertTriangle,
  IndianRupee,
  PlusCircle,
  KanbanSquare,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  Layers,
  Calendar
} from 'lucide-react';
import { OnboardingModal } from '../../components/conversion/OnboardingModal';
import { FirstWinChecklistCard } from '../../components/conversion/FirstWinChecklistCard';
import { DashboardVideoCard } from '../../components/conversion/DashboardVideoCard';
import { AhaModal } from '../../components/conversion/AhaModal';
import { TeamInviteModal } from '../../components/conversion/TeamInviteModal';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const currentTenantId = user?.tenant?.id || tenant?.id;
  const [metrics, setMetrics] = useState<any>(null);
  const [managerMetrics, setManagerMetrics] = useState<any>(null);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Conversion V1 states
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showAhaModal, setShowAhaModal] = useState(false);
  const [showTeamInvite, setShowTeamInvite] = useState(false);
  const [ahaData, setAhaData] = useState<any>(null);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (user?.role === 'TAILOR' || user?.role === 'CUTTER' || user?.role === 'FINISHER') {
        const res = await api.get('/reports/tailor-dashboard');
        if (res.data?.success) {
          setMetrics(res.data.data);
        } else {
          throw new Error(res.data?.error?.message || 'Failed to load tailor dashboard');
        }
      } else if (user?.role === 'MANAGER') {
        // Managers receive full operational stats, workload distribution, and recent orders
        const [statsRes, managerRes, ordersRes] = await Promise.all([
          api.get('/reports/owner-dashboard'),
          api.get('/reports/manager-dashboard'),
          api.get('/orders?limit=6')
        ]);
        if (statsRes.data?.success) setMetrics(statsRes.data.data);
        if (managerRes.data?.success) setManagerMetrics(managerRes.data.data);
        if (ordersRes.data?.success) setRecentOrders(ordersRes.data.data.orders || []);
      } else {
        // Default: Owner Overview
        const [statsRes, ordersRes] = await Promise.all([
          api.get('/reports/owner-dashboard'),
          api.get('/orders?limit=6')
        ]);
        if (statsRes.data?.success) setMetrics(statsRes.data.data);
        if (ordersRes.data?.success) setRecentOrders(ordersRes.data.data.orders || []);
      }
    } catch (e: any) {
      console.error('Failed to load dashboard', e);
      setError(e.response?.data?.error?.message || e.message || 'Unable to connect to service. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user?.role]);

  useEffect(() => {
    loadDashboard();

    if (user?.role === 'SHOP_OWNER') {
      const tenantId = user?.tenant?.id || tenant?.id;
      const completedKey = tenantId ? `onboarding_completed_${tenantId}` : null;
      const dismissedKey = tenantId ? `onboarding_dismissed_${tenantId}` : null;

      // Fast check: if completed or dismissed locally for this tenant, do not show
      if (
        (completedKey && localStorage.getItem(completedKey) === 'true') ||
        (dismissedKey && (localStorage.getItem(dismissedKey) === 'true' || sessionStorage.getItem(dismissedKey) === 'true'))
      ) {
        setShowOnboarding(false);
        return;
      }

      let isCancelled = false;

      api.get('/conversion/onboarding/status').then(res => {
        if (isCancelled) return;
        const data = res.data?.data;
        const isCompleted = Boolean(data?.onboardingCompleted ?? data?.completed);

        if (isCompleted) {
          if (completedKey) localStorage.setItem(completedKey, 'true');
          setShowOnboarding(false);
        } else if (res.data?.success) {
          // Double-check local dismissal in case user dismissed while call was in flight
          const isDismissed = dismissedKey && (
            localStorage.getItem(dismissedKey) === 'true' ||
            sessionStorage.getItem(dismissedKey) === 'true'
          );
          if (!isDismissed) {
            setShowOnboarding(true);
          }
        }
      }).catch(() => {});

      return () => {
        isCancelled = true;
      };
    } else {
      setShowOnboarding(false);
    }
  }, [loadDashboard, user?.role, user?.tenant?.id, tenant?.id]);

  // Loading State with Shimmer Skeletons
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-pulse">
          <div className="space-y-2">
            <div className="h-6 w-52 bg-slate-200 rounded-md" />
            <div className="h-3 w-80 bg-slate-100 rounded-md" />
          </div>
          <div className="flex gap-2">
            <div className="h-9 w-36 bg-slate-200 rounded-xl" />
            <div className="h-9 w-36 bg-slate-200 rounded-xl" />
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 rounded-xl border border-slate-200 bg-white p-4 animate-pulse">
              <div className="flex justify-between items-center mb-3">
                <div className="h-3 w-20 bg-slate-200 rounded" />
                <div className="h-8 w-8 bg-slate-100 rounded-lg" />
              </div>
              <div className="h-7 w-28 bg-slate-200 rounded" />
              <div className="h-2.5 w-24 bg-slate-100 rounded mt-2" />
            </div>
          ))}
        </div>

        <div className="h-64 rounded-xl border border-slate-200 bg-white p-6 animate-pulse">
          <div className="h-4 w-40 bg-slate-200 rounded mb-4" />
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-10 bg-slate-100 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error State Banner
  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-6 text-center space-y-3 my-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900">Dashboard Unavailable</h3>
        <p className="text-xs text-slate-600 max-w-md mx-auto">{error}</p>
        <button
          onClick={loadDashboard}
          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition shadow-xs"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Try Again
        </button>
      </div>
    );
  }

  // Tailor Workshop View
  if (user?.role === 'TAILOR' || user?.role === 'CUTTER' || user?.role === 'FINISHER') {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Tailor Workshop Dashboard</h1>
            <p className="text-xs text-slate-500">Your assigned garment production tasks, deadlines, and active queue.</p>
          </div>
          <Link
            to="/production"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition-all self-start sm:self-auto"
          >
            <KanbanSquare className="h-4 w-4" />
            Production Board
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <span className="text-xs font-semibold text-slate-500">Assigned Jobs</span>
            <div className="mt-2 text-2xl font-bold text-slate-900">
              {formatNumber(metrics?.assignedJobs?.length || 0)}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">Active workshop jobs</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <span className="text-xs font-semibold text-slate-500">Completed Today</span>
            <div className="mt-2 text-2xl font-bold text-emerald-600">
              {formatNumber(metrics?.completedToday || 0)}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">Finished & passed inspection</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <span className="text-xs font-semibold text-slate-500">Overdue Tasks</span>
            <div className="mt-2 text-2xl font-bold text-rose-600">
              {formatNumber(metrics?.overdue || 0)}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">Requires immediate attention</div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-900">My Current Assignments</h2>
            <Link to="/production" className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1">
              Open Board <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {(!metrics?.assignedJobs || metrics.assignedJobs.length === 0) ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No active jobs assigned at the moment.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {metrics.assignedJobs.map((job: any) => (
                <div key={job.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 px-2 rounded-lg transition-colors">
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      {job.orderItem?.garmentType?.name || 'Custom Tailoring'}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <span>Order #{job.orderItem?.order?.orderNumber || 'N/A'}</span>
                      <span className="text-slate-300">•</span>
                      <span>Client: {job.orderItem?.order?.customer?.firstName} {job.orderItem?.order?.customer?.lastName}</span>
                      {job.orderItem?.order?.deliveryDate && (
                        <>
                          <span className="text-slate-300">•</span>
                          <span className="text-amber-700 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Due: {new Date(job.orderItem.order.deliveryDate).toLocaleDateString()}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={job.currentStage} size="sm" />
                    <Link
                      to="/production"
                      className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
                    >
                      Open Board <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Owner / Manager Dashboard View
  return (
    <div className="space-y-6">
      {/* Conversion First-Win Checklist Card */}
      <FirstWinChecklistCard
        onOpenAhaModal={(orderData: any) => {
          setAhaData(orderData);
          setShowAhaModal(true);
        }}
        onInviteTeamClick={() => setShowTeamInvite(true)}
      />

      {/* Conversion Demo Video Card */}
      <DashboardVideoCard />

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
            {user?.role === 'RECEPTIONIST' ? 'Front Desk Operating Overview' : 'Shop Operating Overview'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {user?.role === 'RECEPTIONIST'
              ? 'Daily intake orders, customer deliveries due today, and recent bookings.'
              : 'Live operational indicators, revenue reconciliation and delivery queues.'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          <button
            onClick={loadDashboard}
            title="Refresh dashboard data"
            className="p-2.5 min-h-touch min-w-touch rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all shadow-2xs flex items-center justify-center"
            aria-label="Refresh data"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <Link
            to="/orders/new"
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 min-h-touch text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-98"
          >
            <PlusCircle className="h-4 w-4" />
            <span>New Walk-in Order</span>
          </Link>
          {(user?.role === 'SHOP_OWNER' || user?.role === 'MANAGER') && (
            <Link
              to="/production"
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 min-h-touch text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-2xs active:scale-98"
            >
              <KanbanSquare className="h-4 w-4" />
              <span>Production Board</span>
            </Link>
          )}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Today's Orders */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-4 shadow-xs transition-shadow hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold text-slate-500">Today's Orders</span>
            <div className="rounded-lg bg-blue-50 p-1.5 sm:p-2 text-blue-600">
              <ShoppingBag className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-1.5 sm:mt-2 text-lg sm:text-2xl font-bold text-slate-900">
            {formatNumber(metrics?.todayOrdersCount || 0)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 truncate">
            Booked: <span className="font-semibold text-slate-600">{formatNumber(metrics?.totalOrders || 0)}</span>
          </div>
        </div>

        {/* Due Today */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-4 shadow-xs transition-shadow hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold text-slate-500">Due Today</span>
            <div className="rounded-lg bg-amber-50 p-1.5 sm:p-2 text-amber-600">
              <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-1.5 sm:mt-2 text-lg sm:text-2xl font-bold text-amber-600">
            {formatNumber(metrics?.dueTodayCount || 0)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 truncate">
            Overdue: <span className="font-semibold text-rose-600">{formatNumber(metrics?.overdueCount || 0)}</span>
          </div>
        </div>

        {/* Total Collected */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-4 shadow-xs transition-shadow hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold text-slate-500">Total Collected</span>
            <div className="rounded-lg bg-emerald-50 p-1.5 sm:p-2 text-emerald-600">
              <IndianRupee className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-1.5 sm:mt-2 text-lg sm:text-2xl font-bold text-emerald-600 truncate">
            {formatCurrency(metrics?.totalRevenue)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 truncate">Reconciled payments</div>
        </div>

        {/* Outstanding Balance */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-4 shadow-xs transition-shadow hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold text-slate-500">Outstanding</span>
            <div className="rounded-lg bg-rose-50 p-1.5 sm:p-2 text-rose-600">
              <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-1.5 sm:mt-2 text-lg sm:text-2xl font-bold text-rose-600 truncate">
            {formatCurrency(metrics?.outstandingReceivables)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 truncate">Pending receivables</div>
        </div>
      </div>

      {/* Workshop Production Workload Integration */}
      {managerMetrics && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Workshop Production Operations</h2>
            <Link to="/production" className="text-xs font-semibold text-blue-600 hover:underline">
              Open Board →
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
            <Link
              to="/production"
              className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-2.5 sm:p-3 hover:bg-indigo-50 transition shadow-2xs group min-h-[48px]"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">✂️ Cutting</span>
              <div className="text-lg sm:text-xl font-bold text-indigo-900 mt-0.5">
                {formatNumber(managerMetrics.pendingCutting || 0)}
              </div>
              <div className="text-[10px] text-slate-500 group-hover:text-indigo-700 truncate">In cutting queue</div>
            </Link>

            <Link
              to="/production"
              className="rounded-2xl border border-blue-100 bg-blue-50/50 p-2.5 sm:p-3 hover:bg-blue-50 transition shadow-2xs group min-h-[48px]"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">🧵 Stitching</span>
              <div className="text-lg sm:text-xl font-bold text-blue-900 mt-0.5">
                {formatNumber(managerMetrics.pendingStitching || 0)}
              </div>
              <div className="text-[10px] text-slate-500 group-hover:text-blue-700 truncate">In tailoring</div>
            </Link>

            <Link
              to="/production"
              className="rounded-2xl border border-purple-100 bg-purple-50/50 p-2.5 sm:p-3 hover:bg-purple-50 transition shadow-2xs group min-h-[48px]"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700">👔 Trial Ready</span>
              <div className="text-lg sm:text-xl font-bold text-purple-900 mt-0.5">
                {formatNumber(managerMetrics.trialPending || 0)}
              </div>
              <div className="text-[10px] text-slate-500 group-hover:text-purple-700 truncate">Fitting trials</div>
            </Link>

            <Link
              to="/production"
              className="rounded-2xl border border-amber-100 bg-amber-50/50 p-2.5 sm:p-3 hover:bg-amber-50 transition shadow-2xs group min-h-[48px]"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">🔄 Alterations</span>
              <div className="text-lg sm:text-xl font-bold text-amber-900 mt-0.5">
                {formatNumber(managerMetrics.alterationPending || 0)}
              </div>
              <div className="text-[10px] text-slate-500 group-hover:text-amber-700 truncate">Fit adjustments</div>
            </Link>

            <Link
              to="/production"
              className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-2.5 sm:p-3 hover:bg-emerald-50 transition shadow-2xs group min-h-[48px]"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">✅ Ready</span>
              <div className="text-lg sm:text-xl font-bold text-emerald-900 mt-0.5">
                {formatNumber(managerMetrics.readyForDelivery || 0)}
              </div>
              <div className="text-[10px] text-slate-500 group-hover:text-emerald-700 truncate">For pickup</div>
            </Link>

            <Link
              to="/production"
              className="rounded-2xl border border-rose-100 bg-rose-50/50 p-2.5 sm:p-3 hover:bg-rose-50 transition shadow-2xs group min-h-[48px]"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">⚠️ Delayed</span>
              <div className="text-lg sm:text-xl font-bold text-rose-900 mt-0.5">
                {formatNumber(managerMetrics.delayedJobs || 0)}
              </div>
              <div className="text-[10px] text-slate-500 group-hover:text-rose-700 truncate">Over schedule</div>
            </Link>
          </div>
        </div>
      )}

      {/* Recent Customer Orders Table & Mobile Cards */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Recent Customer Orders</h2>
            <p className="text-[11px] text-slate-500">Latest bespoke commissions and booking status.</p>
          </div>
          <Link
            to="/orders"
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
          >
            <span>View All</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <p className="text-xs text-slate-500">No orders booked yet.</p>
            <Link
              to="/orders/new"
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 px-3.5 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 transition min-h-touch"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              Book First Order
            </Link>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[650px]">
                <thead className="border-b border-slate-100 bg-slate-50/50 text-slate-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-4">Order #</th>
                    <th className="py-2.5 px-3">Customer</th>
                    <th className="py-2.5 px-3">Garments</th>
                    <th className="py-2.5 px-3">Net Total</th>
                    <th className="py-2.5 px-3">Paid / Balance</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentOrders.map((order) => {
                    const net = Number(order.netAmount || 0);
                    const paid = Number(order.paidAmount || 0);
                    const balance = Number(order.balanceAmount || 0);

                    return (
                      <tr key={order.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          {order.orderNumber}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-medium text-slate-800 truncate max-w-[160px]" title={`${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`}>
                            {order.customer?.firstName} {order.customer?.lastName}
                          </div>
                          <div className="text-[10px] text-slate-400">{order.customer?.mobile || 'No Mobile'}</div>
                        </td>
                        <td className="py-3 px-3 text-slate-600 max-w-[180px] truncate" title={order.items?.map((i: any) => i.garmentType?.name).join(', ')}>
                          {order.items?.map((i: any) => i.garmentType?.name).join(', ') || 'Custom Garment'}
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-900">
                          {formatCurrency(net)}
                        </td>
                        <td className="py-3 px-3 text-slate-700">
                          <span className="text-emerald-700 font-semibold">
                            {formatCurrency(paid)}
                          </span>
                          {balance > 0 && (
                            <span className="text-rose-600 font-semibold ml-1.5 text-[11px]">
                              (-{formatCurrency(balance)})
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <StatusBadge status={order.status} size="sm" />
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Link
                            to={`/orders/${order.id}`}
                            className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
                          >
                            Details <ArrowRight className="h-3 w-3" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Responsive Order Cards */}
            <div className="block md:hidden divide-y divide-slate-100 -mx-4">
              {recentOrders.map((order) => {
                const net = Number(order.netAmount || 0);
                const paid = Number(order.paidAmount || 0);
                const balance = Number(order.balanceAmount || 0);

                return (
                  <div key={order.id} className="p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Link to={`/orders/${order.id}`} className="font-mono font-bold text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                          {order.orderNumber}
                        </Link>
                        {order.priority === 'URGENT' && (
                          <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[9px] font-bold text-rose-600 border border-rose-200">
                            URGENT
                          </span>
                        )}
                      </div>
                      <StatusBadge status={order.status} size="sm" />
                    </div>

                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm font-bold text-slate-900">
                          {order.customer?.firstName} {order.customer?.lastName}
                        </div>
                        {order.customer?.mobile && (
                          <a href={`tel:${order.customer.mobile}`} className="text-xs text-slate-500 hover:text-blue-600 mt-0.5 block">
                            {order.customer.mobile}
                          </a>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-slate-900">{formatCurrency(net)}</div>
                        {balance > 0 ? (
                          <div className="text-[10px] font-bold text-rose-600">Due: {formatCurrency(balance)}</div>
                        ) : (
                          <div className="text-[10px] font-semibold text-emerald-600">Settled ({formatCurrency(paid)})</div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 bg-slate-50/80 p-2 rounded-xl border border-slate-100">
                      <span className="truncate max-w-[190px]">
                        {order.items?.map((i: any) => i.garmentType?.name).filter(Boolean).join(', ') || 'Custom Garment'}
                      </span>
                      {order.deliveryDate && (
                        <span className="shrink-0 font-medium text-slate-700 flex items-center gap-1">
                          <Clock className="h-3 w-3 text-slate-400" />
                          {new Date(order.deliveryDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>

                    <Link
                      to={`/orders/${order.id}`}
                      className="w-full min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold transition-colors active:scale-99"
                    >
                      <span>View Order Details</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Conversion Modals */}
      <OnboardingModal
        isOpen={showOnboarding}
        firstName={user?.name?.split(' ')[0] || 'there'}
        tenantId={currentTenantId}
        onComplete={() => {
          if (currentTenantId) {
            localStorage.setItem(`onboarding_completed_${currentTenantId}`, 'true');
          }
          setShowOnboarding(false);
        }}
        onSkip={() => {
          if (currentTenantId) {
            localStorage.setItem(`onboarding_dismissed_${currentTenantId}`, 'true');
            sessionStorage.setItem(`onboarding_dismissed_${currentTenantId}`, 'true');
          }
          setShowOnboarding(false);
        }}
      />

      <AhaModal
        isOpen={showAhaModal}
        onClose={() => setShowAhaModal(false)}
        customerName={ahaData?.customerName || 'Priya Sharma'}
        orderNumber={ahaData?.orderNumber || 'ORD-101'}
        stage={ahaData?.stage || 'CUTTING'}
        orderTotal={ahaData?.orderTotal || 2500}
        balanceDue={ahaData?.balanceDue || 1000}
        deliveryDate={ahaData?.deliveryDate}
      />

      <TeamInviteModal
        isOpen={showTeamInvite}
        onClose={() => setShowTeamInvite(false)}
        onSuccess={() => {
          setShowTeamInvite(false);
          loadDashboard();
        }}
      />
    </div>
  );
};
