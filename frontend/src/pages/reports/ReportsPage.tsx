import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { formatCurrency, formatNumber } from '../../utils/currency';
import { useAuth } from '../../context/AuthContext';
import {
  BarChart3,
  Download,
  IndianRupee,
  PieChart,
  Users,
  ShoppingBag,
  Printer,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Filter,
  RefreshCw,
  Scissors,
  ArrowRight,
  TrendingUp,
  FileSpreadsheet
} from 'lucide-react';

type DatePreset = 'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'LAST_MONTH' | 'CUSTOM';
type ActiveTab = 'overview' | 'orders' | 'payments' | 'production' | 'customers' | 'staff';

interface Branch {
  id: string;
  name: string;
  code?: string;
}

export const ReportsPage: React.FC = () => {
  const { user } = useAuth();

  // Filters State
  const [preset, setPreset] = useState<DatePreset>('THIS_MONTH');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [branches, setBranches] = useState<Branch[]>([]);

  // Active Tab
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');

  // Data States
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [overviewData, setOverviewData] = useState<any>(null);
  const [ordersData, setOrdersData] = useState<any>(null);
  const [paymentsData, setPaymentsData] = useState<any>(null);
  const [productionData, setProductionData] = useState<any>(null);
  const [customersData, setCustomersData] = useState<any>(null);
  const [staffData, setStaffData] = useState<any>(null);

  // Load Branches
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const res = await api.get('/branches');
        if (res.data.success && Array.isArray(res.data.data)) {
          setBranches(res.data.data);
        }
      } catch (err) {
        // Silently handle if branches endpoint is not available or multi-branch disabled
      }
    };
    fetchBranches();
  }, []);

  // Set default initial custom dates
  useEffect(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const today = now.toISOString().slice(0, 10);
    setCustomStart(firstDay);
    setCustomEnd(today);
  }, []);

  // Fetch Report Data based on Active Tab
  const fetchActiveReport = async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set('range', preset);
    if (preset === 'CUSTOM') {
      if (!customStart || !customEnd) {
        setError('Please select both start date and end date for custom range.');
        setLoading(false);
        return;
      }
      params.set('startDate', customStart);
      params.set('endDate', customEnd);
    }
    if (selectedBranch) {
      params.set('branchId', selectedBranch);
    }

    try {
      const qs = params.toString();
      if (activeTab === 'overview') {
        const res = await api.get(`/reports/overview?${qs}`);
        if (res.data.success) setOverviewData(res.data.data);
      } else if (activeTab === 'orders') {
        const res = await api.get(`/reports/orders?${qs}`);
        if (res.data.success) setOrdersData(res.data.data);
      } else if (activeTab === 'payments') {
        const res = await api.get(`/reports/payments?${qs}`);
        if (res.data.success) setPaymentsData(res.data.data);
      } else if (activeTab === 'production') {
        const res = await api.get(`/reports/production?${qs}`);
        if (res.data.success) setProductionData(res.data.data);
      } else if (activeTab === 'customers') {
        const res = await api.get(`/reports/customers?${qs}`);
        if (res.data.success) setCustomersData(res.data.data);
      } else if (activeTab === 'staff') {
        const res = await api.get(`/reports/staff?${qs}`);
        if (res.data.success) setStaffData(res.data.data);
      }
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Failed to fetch report data. Please retry.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveReport();
  }, [activeTab, preset, selectedBranch]);

  // CSV Export Helper
  const handleExportCsv = (entity: string) => {
    const params = new URLSearchParams();
    params.set('range', preset);
    if (preset === 'CUSTOM' && customStart && customEnd) {
      params.set('startDate', customStart);
      params.set('endDate', customEnd);
    }
    if (selectedBranch) {
      params.set('branchId', selectedBranch);
    }
    const token = localStorage.getItem('tailor_token');
    const url = `/api/v1/import-export/export/${entity}?${params.toString()}`;
    // Fetch with authorization header for proper auth
    fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Export failed');
        const blob = await res.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `${entity.toLowerCase()}_export_${preset.toLowerCase()}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      })
      .catch((err) => {
        alert('Failed to export CSV: ' + err.message);
      });
  };

  // Determine allowed tabs based on role
  const role = user?.role || 'SHOP_OWNER';
  const isOwnerOrManager = role === 'SHOP_OWNER' || role === 'MANAGER' || role === 'SAAS_OWNER';
  const isCashier = role === 'CASHIER';
  const isReceptionist = role === 'RECEPTIONIST';
  const isCraftsman = role === 'TAILOR' || role === 'CUTTER' || role === 'FINISHER';

  const visibleTabs: { key: ActiveTab; label: string; icon: any }[] = [];
  if (isOwnerOrManager) {
    visibleTabs.push(
      { key: 'overview', label: 'Overview', icon: BarChart3 },
      { key: 'orders', label: 'Orders', icon: ShoppingBag },
      { key: 'payments', label: 'Payments & Billing', icon: IndianRupee },
      { key: 'production', label: 'Production Pipeline', icon: Scissors },
      { key: 'customers', label: 'Customers', icon: Users },
      { key: 'staff', label: 'Staff Operations', icon: Clock }
    );
  } else if (isCashier) {
    visibleTabs.push(
      { key: 'overview', label: 'Overview', icon: BarChart3 },
      { key: 'payments', label: 'Payments & Billing', icon: IndianRupee }
    );
  } else if (isReceptionist) {
    visibleTabs.push(
      { key: 'overview', label: 'Overview', icon: BarChart3 },
      { key: 'orders', label: 'Orders', icon: ShoppingBag },
      { key: 'customers', label: 'Customers', icon: Users }
    );
  } else if (isCraftsman) {
    visibleTabs.push(
      { key: 'production', label: 'Production Pipeline', icon: Scissors }
    );
  } else {
    visibleTabs.push({ key: 'overview', label: 'Overview', icon: BarChart3 });
  }

  return (
    <div className="space-y-6 pb-12 print:p-0 print:space-y-4">
      {/* ------------------------------------------------------------- */}
      {/* Page Header (Hidden in Print)                                 */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <BarChart3 className="h-6 w-6 text-blue-600" />
            Reports & Operational Intelligence
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Factual shop floor metrics, order workflows, and manual ledger accounting.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* CSV Export Dropdown */}
          <div className="relative group">
            <button className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-2xs transition">
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Export CSV
            </button>
            <div className="absolute right-0 mt-1 w-44 rounded-xl border border-slate-200 bg-white shadow-lg p-1.5 hidden group-hover:block z-30">
              <button
                onClick={() => handleExportCsv('CUSTOMERS')}
                className="w-full text-left px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded-lg flex items-center gap-2"
              >
                <Users className="h-3.5 w-3.5 text-slate-400" /> Customers CSV
              </button>
              <button
                onClick={() => handleExportCsv('ORDERS')}
                className="w-full text-left px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded-lg flex items-center gap-2"
              >
                <ShoppingBag className="h-3.5 w-3.5 text-slate-400" /> Orders CSV
              </button>
              <button
                onClick={() => handleExportCsv('PAYMENTS')}
                className="w-full text-left px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded-lg flex items-center gap-2"
              >
                <IndianRupee className="h-3.5 w-3.5 text-slate-400" /> Payments CSV
              </button>
              <button
                onClick={() => handleExportCsv('PRODUCTION')}
                className="w-full text-left px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded-lg flex items-center gap-2"
              >
                <Scissors className="h-3.5 w-3.5 text-slate-400" /> Production CSV
              </button>
            </div>
          </div>

          {/* Browser Print Button */}
          <button
            onClick={() => window.print()}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-2xs transition"
          >
            <Printer className="h-4 w-4 text-slate-600" /> Print Summary
          </button>

          {/* Refresh Button */}
          <button
            onClick={fetchActiveReport}
            disabled={loading}
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-50 shadow-2xs transition"
            title="Refresh Data"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Filter Bar (Date Presets + Custom Range + Branch)             */}
      {/* ------------------------------------------------------------- */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3 print:hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> Range:
            </span>
            {(['TODAY', 'YESTERDAY', 'THIS_WEEK', 'THIS_MONTH', 'LAST_MONTH', 'CUSTOM'] as DatePreset[]).map((p) => {
              const active = preset === p;
              return (
                <button
                  key={p}
                  onClick={() => setPreset(p)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition ${
                    active
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
                  }`}
                >
                  {p.replace('_', ' ')}
                </button>
              );
            })}
          </div>

          {/* Branch Selector */}
          {branches.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Filter className="h-3.5 w-3.5" /> Branch:
              </span>
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} {b.code ? `(${b.code})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Custom Date Range Controls */}
        {preset === 'CUSTOM' && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 animate-in fade-in duration-200">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500 font-medium">From:</span>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="rounded-xl border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500 font-medium">To:</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="rounded-xl border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <button
              onClick={fetchActiveReport}
              className="rounded-xl bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800 transition"
            >
              Apply Filter
            </button>
            <span className="text-[11px] text-slate-400">Maximum reporting window is 366 days (1 year).</span>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Navigation Tabs (Hidden in Print)                             */}
      {/* ------------------------------------------------------------- */}
      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto pb-px print:hidden">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold whitespace-nowrap border-b-2 transition ${
                active
                  ? 'border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-xl'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              <Icon className={`h-4 w-4 ${active ? 'text-blue-600' : 'text-slate-400'}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Print-Only Executive Header                                   */}
      {/* ------------------------------------------------------------- */}
      <div className="hidden print:block border-b-2 border-slate-900 pb-3 mb-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-slate-900">TAILOR SHOP MANAGEMENT — EXECUTIVE REPORT</h1>
            <p className="text-xs text-slate-600">
              Reporting Preset: {preset.replace('_', ' ')} | Scope: {selectedBranch ? 'Specific Branch' : 'All Branches'}
            </p>
          </div>
          <div className="text-right text-xs text-slate-500">
            Printed: {new Date().toLocaleString()}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Loading / Error States                                        */}
      {/* ------------------------------------------------------------- */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="text-xs text-slate-500 mt-3 font-medium">Aggregating real-time records from PostgreSQL database...</p>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50/50 p-6 text-center space-y-3">
          <AlertTriangle className="h-8 w-8 text-red-500 mx-auto" />
          <div className="font-bold text-sm text-red-900">{error}</div>
          <button
            onClick={fetchActiveReport}
            className="px-4 py-1.5 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition"
          >
            Retry Request
          </button>
        </div>
      ) : (
        /* ----------------------------------------------------------- */
        /* Active Tab Panels                                           */
        /* ----------------------------------------------------------- */
        <div>
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && overviewData && (
            <OverviewPanel kpis={overviewData.kpis} preset={preset} />
          )}

          {/* TAB 2: ORDERS */}
          {activeTab === 'orders' && ordersData && (
            <OrdersPanel data={ordersData} />
          )}

          {/* TAB 3: PAYMENTS */}
          {activeTab === 'payments' && paymentsData && (
            <PaymentsPanel data={paymentsData} />
          )}

          {/* TAB 4: PRODUCTION */}
          {activeTab === 'production' && productionData && (
            <ProductionPanel data={productionData} />
          )}

          {/* TAB 5: CUSTOMERS */}
          {activeTab === 'customers' && customersData && (
            <CustomersPanel data={customersData} />
          )}

          {/* TAB 6: STAFF */}
          {activeTab === 'staff' && staffData && (
            <StaffPanel data={staffData} />
          )}
        </div>
      )}
    </div>
  );
};

// =============================================================================
// SUB-PANEL 1: OVERVIEW (12 Dashboard KPIs)
// =============================================================================
const OverviewPanel: React.FC<{ kpis: any; preset: DatePreset }> = ({ kpis, preset }) => {
  return (
    <div className="space-y-6">
      {/* 1. Commercial & Collections Section */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
          <IndianRupee className="h-3.5 w-3.5 text-emerald-600" /> Commercial & Cash Collections
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            title="Today's Collection"
            value={formatCurrency(kpis.todayCollection)}
            subtitle="Net desk collections today"
            color="emerald"
            highlight
          />
          <KpiCard
            title="Period Collection"
            value={formatCurrency(kpis.periodCollection)}
            subtitle={`Net collections (${preset.replace('_', ' ')})`}
            color="emerald"
          />
          <KpiCard
            title="Total Period Revenue"
            value={formatCurrency(kpis.totalRevenue)}
            subtitle="Gross book sales in range"
            color="blue"
          />
          <KpiCard
            title="Outstanding Receivables"
            value={formatCurrency(kpis.outstandingReceivables)}
            subtitle="Active unpaid order balance"
            color="amber"
            highlight={kpis.outstandingReceivables > 0}
          />
        </div>
      </div>

      {/* 2. Order Workflow & Floor Throughput */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
          <ShoppingBag className="h-3.5 w-3.5 text-blue-600" /> Order Workflow & Shop Floor
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            title="New Bookings"
            value={formatNumber(kpis.newOrders)}
            subtitle={`Orders booked (${preset.replace('_', ' ')})`}
            color="blue"
          />
          <KpiCard
            title="In Production"
            value={formatNumber(kpis.ordersInProgress)}
            subtitle="Active tailoring floor queue"
            color="indigo"
          />
          <KpiCard
            title="Ready for Pickup"
            value={formatNumber(kpis.ordersReadyForPickup)}
            subtitle="Completed, awaiting customer"
            color="teal"
          />
          <KpiCard
            title="Delayed / At Risk"
            value={formatNumber(kpis.delayedOrders)}
            subtitle="Past SLA delivery date"
            color="rose"
            highlight={kpis.delayedOrders > 0}
          />
        </div>
      </div>

      {/* 3. Clients & Ledger Status */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-slate-600" /> Customer Growth & Outstanding Accounts
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            title="Total Registered Clients"
            value={formatNumber(kpis.totalCustomers)}
            subtitle="Active customer accounts"
            color="slate"
          />
          <KpiCard
            title="New Clients"
            value={formatNumber(kpis.newCustomers)}
            subtitle={`Intake (${preset.replace('_', ' ')})`}
            color="slate"
          />
          <KpiCard
            title="Delivered Orders"
            value={formatNumber(kpis.deliveredOrders)}
            subtitle="Handed over in period"
            color="emerald"
          />
          <KpiCard
            title="Pending Payment Orders"
            value={formatNumber(kpis.pendingPaymentOrders)}
            subtitle="Unpaid or partial orders"
            color="amber"
          />
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// SUB-PANEL 2: ORDERS REPORT
// =============================================================================
const OrdersPanel: React.FC<{ data: any }> = ({ data }) => {
  const { summary, ordersByStatus, ordersByGarment, dailyTimeline } = data;

  return (
    <div className="space-y-6">
      {/* Summary KPI Badges */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          title="Total Bookings"
          value={formatNumber(summary.totalOrders)}
          subtitle="Orders created in period"
          color="blue"
        />
        <KpiCard
          title="Average Order Value"
          value={formatCurrency(summary.averageOrderValue)}
          subtitle="Revenue per active order"
          color="indigo"
        />
        <KpiCard
          title="On-Time Delivery Rate"
          value={`${summary.onTimeDeliveryRate}%`}
          subtitle={`${summary.onTimeDeliveredCount} of ${summary.deliveredCount} delivered`}
          color={summary.onTimeDeliveryRate >= 90 ? 'emerald' : 'amber'}
        />
        <KpiCard
          title="Cancellation Rate"
          value={`${summary.cancellationRate}%`}
          subtitle={`${summary.cancelledOrders} cancelled orders`}
          color={summary.cancellationRate > 5 ? 'rose' : 'slate'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <ShoppingBag className="h-4 w-4 text-blue-600" /> Orders by Stage Status
            </h3>
            <span className="text-xs text-slate-400 font-medium">{summary.totalOrders} total</span>
          </div>

          <div className="space-y-2.5">
            {ordersByStatus.map((item: any) => {
              const pct = summary.totalOrders > 0
                ? Math.round((item.count / summary.totalOrders) * 100)
                : 0;
              return (
                <div key={item.status} className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">{item.status.replace(/_/g, ' ')}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-600">{item.count} orders ({pct}%)</span>
                      <span className="font-bold text-blue-700">{formatCurrency(item.totalAmount)}</span>
                    </div>
                  </div>
                  {/* Progress Bar */}
                  <div className="w-full bg-slate-200/80 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-blue-600 h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Garment Revenue Breakdown */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Scissors className="h-4 w-4 text-indigo-600" /> Revenue by Garment Category
            </h3>
            <span className="text-xs text-slate-400 font-medium">{ordersByGarment.length} garment types</span>
          </div>

          {ordersByGarment.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">No garment items booked in this period.</div>
          ) : (
            <div className="space-y-2.5">
              {ordersByGarment.map((g: any) => (
                <div key={g.garmentId} className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-800">{g.garmentName}</span>
                      <span className="text-[11px] text-slate-400 ml-2">({g.unitsSold} units tailored)</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-slate-900">{formatCurrency(g.totalRevenue)}</span>
                      <span className="text-[11px] text-slate-400 ml-1.5">({g.revenueSharePercentage}%)</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-200/80 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${g.revenueSharePercentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Daily Timeline */}
      {dailyTimeline && dailyTimeline.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5 border-b border-slate-100 pb-3">
            <TrendingUp className="h-4 w-4 text-emerald-600" /> Daily Order Activity
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 pt-2">
            {dailyTimeline.map((d: any) => (
              <div key={d.date} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-center">
                <div className="text-[11px] text-slate-400 font-medium">{d.date.slice(5)}</div>
                <div className="text-sm font-bold text-slate-900 mt-0.5">{d.orderCount} orders</div>
                <div className="text-[11px] font-semibold text-emerald-600 mt-0.5">{formatCurrency(d.revenue)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// SUB-PANEL 3: PAYMENTS REPORT
// =============================================================================
const PaymentsPanel: React.FC<{ data: any }> = ({ data }) => {
  const { summary, collectionsByMethod, paymentStatusBreakdown, dailyTimeline } = data;

  return (
    <div className="space-y-6">
      {/* Financial Collections Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          title="Gross Collections"
          value={formatCurrency(summary.grossCollections)}
          subtitle={`${summary.transactionCount} transactions`}
          color="emerald"
        />
        <KpiCard
          title="Customer Refunds"
          value={formatCurrency(summary.refunds)}
          subtitle="Reversals & adjustments"
          color="rose"
        />
        <KpiCard
          title="Net Collections"
          value={formatCurrency(summary.netCollections)}
          subtitle="Net funds deposited"
          color="emerald"
          highlight
        />
        <KpiCard
          title="Overdue Receivables"
          value={formatCurrency(summary.overdueReceivables)}
          subtitle="Balances past delivery date"
          color="amber"
          highlight={summary.overdueReceivables > 0}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Methods Breakdown with SVG Donut */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <PieChart className="h-4 w-4 text-emerald-600" /> Collections by Payment Method
            </h3>
            <span className="text-xs text-slate-400 font-medium">Manual ledger records only</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-6 pt-2">
            {/* SVG Donut Visualizer */}
            <div className="relative h-36 w-36 shrink-0 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.915" fill="none" stroke="#f1f5f9" strokeWidth="3" />
                {renderSvgDonutSegments(collectionsByMethod)}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Net Total</span>
                <span className="text-xs font-extrabold text-slate-900">{formatCurrency(summary.netCollections)}</span>
              </div>
            </div>

            {/* Methods List */}
            <div className="flex-1 w-full space-y-2">
              {collectionsByMethod.map((m: any, idx: number) => {
                const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#64748b'];
                return (
                  <div key={m.method} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors[idx % colors.length] }} />
                      <span className="font-bold text-slate-800">{m.method}</span>
                      <span className="text-[11px] text-slate-400">({m.count} txns)</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-slate-900">{formatCurrency(m.amount)}</span>
                      <span className="text-[11px] text-slate-400 ml-1.5">({m.percentage}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Order Payment Status Distribution */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <IndianRupee className="h-4 w-4 text-blue-600" /> Order Settlement Status
            </h3>
            <span className="text-xs text-slate-400 font-medium">Orders created in period</span>
          </div>

          <div className="grid grid-cols-1 gap-3 pt-1">
            <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-100 flex items-center justify-between">
              <div>
                <div className="font-bold text-xs text-emerald-900">Fully Paid Orders</div>
                <div className="text-[11px] text-emerald-600 mt-0.5">
                  {paymentStatusBreakdown.fullyPaid.count} orders cleared
                </div>
              </div>
              <div className="text-right font-extrabold text-sm text-emerald-700">
                {formatCurrency(paymentStatusBreakdown.fullyPaid.paidAmount)}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-100 flex items-center justify-between">
              <div>
                <div className="font-bold text-xs text-amber-900">Partially Paid Orders</div>
                <div className="text-[11px] text-amber-600 mt-0.5">
                  {paymentStatusBreakdown.partiallyPaid.count} orders with pending balance
                </div>
              </div>
              <div className="text-right">
                <div className="font-extrabold text-sm text-amber-700">
                  {formatCurrency(paymentStatusBreakdown.partiallyPaid.paidAmount)}
                </div>
                <div className="text-[10px] text-amber-800 font-semibold">
                  Due: {formatCurrency(paymentStatusBreakdown.partiallyPaid.balanceAmount)}
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-50/60 border border-rose-100 flex items-center justify-between">
              <div>
                <div className="font-bold text-xs text-rose-900">Completely Unpaid Orders</div>
                <div className="text-[11px] text-rose-600 mt-0.5">
                  {paymentStatusBreakdown.unpaid.count} orders with ₹0 advance
                </div>
              </div>
              <div className="text-right font-extrabold text-sm text-rose-700">
                {formatCurrency(paymentStatusBreakdown.unpaid.balanceAmount)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Collections Timeline */}
      {dailyTimeline && dailyTimeline.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5 border-b border-slate-100 pb-3">
            <TrendingUp className="h-4 w-4 text-emerald-600" /> Daily Intake Trend (Cash vs Digital)
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 pt-2">
            {dailyTimeline.map((d: any) => (
              <div key={d.date} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-center">
                <div className="text-[11px] text-slate-400 font-medium">{d.date.slice(5)}</div>
                <div className="text-xs font-bold text-slate-900 mt-0.5">{formatCurrency(d.total)}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Cash: {formatCurrency(d.cash)} | Dig: {formatCurrency(d.digital)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// SUB-PANEL 4: PRODUCTION REPORT
// =============================================================================
const ProductionPanel: React.FC<{ data: any }> = ({ data }) => {
  const { summary, stageCounts, delayedJobs, craftWorkload } = data;

  return (
    <div className="space-y-6">
      {/* Summary KPI Badges */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          title="Active Workshop Jobs"
          value={formatNumber(summary.totalActiveJobs)}
          subtitle="Non-delivered floor jobs"
          color="indigo"
        />
        <KpiCard
          title="Ready for Handover"
          value={formatNumber(summary.readyForHandover)}
          subtitle="Awaiting client fitting/pickup"
          color="teal"
        />
        <KpiCard
          title="Delayed Garments"
          value={formatNumber(summary.totalDelayedJobs)}
          subtitle="Flagged delayed or overdue"
          color="rose"
          highlight={summary.totalDelayedJobs > 0}
        />
        <KpiCard
          title="Completed & Delivered"
          value={formatNumber(summary.completedDelivered)}
          subtitle="Total delivered jobs"
          color="emerald"
        />
      </div>

      {/* 8-Stage Pipeline Pipeline Flow */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
            <Scissors className="h-4 w-4 text-indigo-600" /> Workshop Stage Pipeline Throughput
          </h3>
          <span className="text-xs text-slate-400 font-medium">8 standardized production stages</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 pt-2">
          {stageCounts.map((sc: any, idx: number) => {
            const isDelivered = sc.stage === 'DELIVERED';
            return (
              <div
                key={sc.stage}
                className={`p-3 rounded-xl border text-center transition ${
                  isDelivered
                    ? 'bg-emerald-50/50 border-emerald-100'
                    : sc.count > 0
                    ? 'bg-blue-50/40 border-blue-100'
                    : 'bg-slate-50 border-slate-100'
                }`}
              >
                <div className="text-[10px] text-slate-400 font-bold uppercase">Stage {idx + 1}</div>
                <div className="text-xs font-bold text-slate-800 mt-1 truncate" title={sc.stage}>
                  {sc.stage.replace(/_/g, ' ')}
                </div>
                <div className="text-lg font-extrabold text-slate-900 mt-1">{sc.count}</div>
                {!isDelivered && (
                  <div className="text-[10px] text-slate-400 mt-0.5">{sc.percentage}% active</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Delayed Garments Alert Table */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-rose-600" /> Delayed Workshop Jobs ({delayedJobs.total})
            </h3>
            <span className="text-xs text-slate-400 font-medium">Flagged jobs requiring attention</span>
          </div>

          {delayedJobs.jobs.length === 0 ? (
            <div className="py-12 text-center text-xs text-emerald-600 flex flex-col items-center gap-1.5">
              <CheckCircle2 className="h-6 w-6 text-emerald-500" />
              <span>Great job! No garments are currently delayed.</span>
            </div>
          ) : (
            <div className="space-y-2 overflow-x-auto max-h-80">
              {delayedJobs.jobs.map((j: any) => (
                <div key={j.id} className="p-3 rounded-xl bg-rose-50/40 border border-rose-100 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-slate-900">
                      {j.orderNumber} — <span className="text-slate-600">{j.garmentName}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Stage: <span className="font-semibold text-slate-700">{j.stage}</span> | Assignee: {j.assignedStaff}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 text-[10px] font-bold">
                      {j.delayReason}
                    </span>
                    {j.deliveryDate && (
                      <div className="text-[10px] text-slate-400 mt-1">Due: {j.deliveryDate.slice(0, 10)}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Craft Workload Distribution */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Scissors className="h-4 w-4 text-blue-600" /> Craft Workload Distribution
            </h3>
            <span className="text-xs text-slate-400 font-medium">By Craft Role</span>
          </div>

          {/* Craft Role Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-center">
              <div className="text-[10px] font-bold text-slate-400 uppercase">Cutter Craft</div>
              <div className="text-base font-extrabold text-slate-900 mt-1">
                {craftWorkload.byRole.CUTTER?.activeJobs || 0}
              </div>
              <div className="text-[10px] text-slate-400">{craftWorkload.byRole.CUTTER?.staffCount || 0} cutters</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-center">
              <div className="text-[10px] font-bold text-slate-400 uppercase">Tailor Craft</div>
              <div className="text-base font-extrabold text-slate-900 mt-1">
                {craftWorkload.byRole.TAILOR?.activeJobs || 0}
              </div>
              <div className="text-[10px] text-slate-400">{craftWorkload.byRole.TAILOR?.staffCount || 0} tailors</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-center">
              <div className="text-[10px] font-bold text-slate-400 uppercase">Finisher Craft</div>
              <div className="text-base font-extrabold text-slate-900 mt-1">
                {craftWorkload.byRole.FINISHER?.activeJobs || 0}
              </div>
              <div className="text-[10px] text-slate-400">{craftWorkload.byRole.FINISHER?.staffCount || 0} finishers</div>
            </div>
          </div>

          {/* Staff Roster Workload */}
          <div className="space-y-2 pt-1 max-h-56 overflow-y-auto">
            {craftWorkload.staff.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                <div>
                  <span className="font-bold text-slate-800">{s.name}</span>
                  <span className="text-[10px] text-slate-400 ml-2 uppercase font-semibold">({s.role})</span>
                </div>
                <div className="font-bold text-slate-900">
                  {s.activeJobs} active {s.activeJobs === 1 ? 'job' : 'jobs'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// SUB-PANEL 5: CUSTOMERS REPORT
// =============================================================================
const CustomersPanel: React.FC<{ data: any }> = ({ data }) => {
  const { summary, topCustomers } = data;

  return (
    <div className="space-y-6">
      {/* Summary KPI Badges */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          title="Total Client Base"
          value={formatNumber(summary.totalCustomers)}
          subtitle="Registered customer accounts"
          color="slate"
        />
        <KpiCard
          title="New Clients"
          value={formatNumber(summary.newCustomers)}
          subtitle="Added within selected period"
          color="blue"
        />
        <KpiCard
          title="Repeat Client Rate"
          value={`${summary.repeatCustomerRate}%`}
          subtitle={`${summary.repeatCustomers} repeat of ${summary.activeCustomerAccounts} ordered`}
          color={summary.repeatCustomerRate >= 40 ? 'emerald' : 'indigo'}
        />
        <KpiCard
          title="Clients with Balance"
          value={formatNumber(summary.customersWithBalanceCount)}
          subtitle={`Total: ${formatCurrency(summary.totalReceivables)}`}
          color="amber"
          highlight={summary.customersWithBalanceCount > 0}
        />
      </div>

      {/* Top Clients by Commercial Value */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
            <Users className="h-4 w-4 text-blue-600" /> Top Clients by Cumulative Order Value
          </h3>
          <span className="text-xs text-slate-400 font-medium">Top 10 customer accounts</span>
        </div>

        {topCustomers.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">No customer spend records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-2.5 px-3">Client ID</th>
                  <th className="py-2.5 px-3">Customer Name</th>
                  <th className="py-2.5 px-3">Mobile</th>
                  <th className="py-2.5 px-3 text-center">Orders</th>
                  <th className="py-2.5 px-3 text-right">Total Spend</th>
                  <th className="py-2.5 px-3 text-right">Balance Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {topCustomers.map((c: any) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">{c.customerId}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">{c.name}</td>
                    <td className="py-2.5 px-3 text-slate-500">{c.mobile}</td>
                    <td className="py-2.5 px-3 text-center">{c.orderCount}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-blue-700">{formatCurrency(c.totalSpend)}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-amber-700">
                      {c.balanceDue > 0 ? formatCurrency(c.balanceDue) : '₹0'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// =============================================================================
// SUB-PANEL 6: STAFF OPERATIONAL REPORT
// =============================================================================
const StaffPanel: React.FC<{ data: any }> = ({ data }) => {
  const { staff, staffCount } = data;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-blue-600" /> Workshop Operational Tallies
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Pure factual job assignments and completions. Zero subjective ratings or performance scores.
            </p>
          </div>
          <span className="text-xs text-slate-400 font-medium">{staffCount} active workshop staff</span>
        </div>

        {staff.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">No active workshop staff members found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-2.5 px-3">Staff Member</th>
                  <th className="py-2.5 px-3">Craft Role</th>
                  <th className="py-2.5 px-3">Branch</th>
                  <th className="py-2.5 px-3 text-center">Assigned Jobs</th>
                  <th className="py-2.5 px-3 text-center">Completed in Range</th>
                  <th className="py-2.5 px-3 text-center">Overdue / Delayed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {staff.map((s: any) => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-900">{s.name}</div>
                      <div className="text-[11px] text-slate-400">{s.email}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-bold">
                        {s.role}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">{s.branchName}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-blue-700">{s.assignedJobs}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-emerald-700">{s.completedJobs}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-rose-600">
                      {s.delayedJobs > 0 ? s.delayedJobs : 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// =============================================================================
// REUSABLE KPI CARD
// =============================================================================
interface KpiCardProps {
  title: string;
  value: string;
  subtitle: string;
  color?: 'emerald' | 'blue' | 'indigo' | 'amber' | 'rose' | 'teal' | 'slate';
  highlight?: boolean;
}

const KpiCard: React.FC<KpiCardProps> = ({ title, value, subtitle, color = 'slate', highlight = false }) => {
  const colorStyles: Record<string, { border: string; valueColor: string; bg: string }> = {
    emerald: { border: 'border-emerald-200/80', valueColor: 'text-emerald-700', bg: 'bg-emerald-50/30' },
    blue: { border: 'border-blue-200/80', valueColor: 'text-blue-700', bg: 'bg-blue-50/30' },
    indigo: { border: 'border-indigo-200/80', valueColor: 'text-indigo-700', bg: 'bg-indigo-50/30' },
    amber: { border: 'border-amber-200/80', valueColor: 'text-amber-700', bg: 'bg-amber-50/30' },
    rose: { border: 'border-rose-200/80', valueColor: 'text-rose-700', bg: 'bg-rose-50/30' },
    teal: { border: 'border-teal-200/80', valueColor: 'text-teal-700', bg: 'bg-teal-50/30' },
    slate: { border: 'border-slate-200', valueColor: 'text-slate-900', bg: 'bg-white' }
  };

  const style = colorStyles[color] || colorStyles.slate;

  return (
    <div
      className={`rounded-2xl border p-4 shadow-2xs transition ${style.border} ${highlight ? style.bg : 'bg-white'}`}
    >
      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{title}</div>
      <div className={`text-xl sm:text-2xl font-extrabold mt-1 tracking-tight ${style.valueColor}`}>{value}</div>
      <div className="text-[11px] text-slate-400 mt-1 truncate" title={subtitle}>{subtitle}</div>
    </div>
  );
};

// =============================================================================
// SVG DONUT HELPER (Pure CSS/SVG — Zero external libraries)
// =============================================================================
function renderSvgDonutSegments(methods: any[]) {
  const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#64748b'];
  let currentOffset = 0;

  return methods.map((m, idx) => {
    if (m.percentage <= 0) return null;
    const strokeDash = `${m.percentage} ${100 - m.percentage}`;
    const strokeOffset = 100 - currentOffset + 25; // 25 to start at top (12 o'clock)
    currentOffset += m.percentage;

    return (
      <circle
        key={m.method}
        cx="18"
        cy="18"
        r="15.915"
        fill="none"
        stroke={colors[idx % colors.length]}
        strokeWidth="3.5"
        strokeDasharray={strokeDash}
        strokeDashoffset={strokeOffset}
      />
    );
  });
}
