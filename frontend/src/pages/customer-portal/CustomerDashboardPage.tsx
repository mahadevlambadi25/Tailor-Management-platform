import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../../api/client';
import { formatCurrency } from '../../utils/currency';
import {
  Package,
  Calendar,
  Ruler,
  ShoppingBag,
  Sparkles,
  ArrowRight,
  Clock,
  Phone,
  AlertCircle,
  RefreshCw,
  CheckCircle2
} from 'lucide-react';

export const CustomerDashboardPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/portal/dashboard');
      if (res.data.success) {
        setData(res.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load dashboard. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs font-semibold text-slate-500">Loading your bespoke tailoring portal...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center space-y-3">
        <AlertCircle className="h-8 w-8 text-red-500 mx-auto" />
        <h3 className="font-bold text-sm text-red-900">{error}</h3>
        <button
          onClick={fetchDashboard}
          className="px-4 py-1.5 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition"
        >
          Retry
        </button>
      </div>
    );
  }

  const { customer, kpis, currentOrderSpotlight } = data || {};

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* ------------------------------------------------------------- */}
      {/* Welcome Banner                                                */}
      {/* ------------------------------------------------------------- */}
      <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 sm:p-8 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-400/20 text-amber-300 border border-amber-400/30 mb-2">
              <Sparkles className="h-3 w-3 mr-1.5" /> Client Portal
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Hello, {customer?.name || 'Valued Client'}
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-lg">
              Track your bespoke tailoring orders, check fitting trial schedules, and view your verified master fit profile.
            </p>
          </div>

          {customer?.shop?.phone && (
            <a
              href={`tel:${customer.shop.phone}`}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-bold text-white transition self-start md:self-center"
            >
              <Phone className="h-4 w-4 text-amber-400" />
              <span>Contact Atelier</span>
            </a>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4 Summary KPI Cards                                           */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {/* Active Orders */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Orders</div>
          <div className="text-2xl font-extrabold text-blue-700 mt-1">
            {kpis?.activeOrdersCount || 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">In tailoring queue</div>
        </div>

        {/* Ready for Pickup */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Ready for Pickup</div>
          <div className="text-2xl font-extrabold text-teal-600 mt-1">
            {kpis?.readyForPickupCount || 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">At the store desk</div>
        </div>

        {/* Balance Due */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Balance Due</div>
          <div className={`text-xl sm:text-2xl font-extrabold mt-1 ${
            kpis?.totalBalanceDue > 0 ? 'text-amber-700' : 'text-emerald-700'
          }`}>
            {formatCurrency(kpis?.totalBalanceDue || 0)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {kpis?.totalBalanceDue > 0 ? 'Payable at store' : 'Fully settled'}
          </div>
        </div>

        {/* Nearest Delivery */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Target Delivery</div>
          <div className="text-sm sm:text-base font-extrabold text-slate-900 mt-1 truncate">
            {kpis?.nearestDeliveryDate
              ? new Date(kpis.nearestDeliveryDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
              : 'No Active Orders'}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Promised SLA</div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Current Order Spotlight                                       */}
      {/* ------------------------------------------------------------- */}
      {currentOrderSpotlight ? (
        <div className="rounded-3xl border border-amber-200/80 bg-gradient-to-b from-amber-50/50 to-white p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-amber-100 pb-3 gap-2">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md">
                Active Order Spotlight
              </span>
              <h2 className="text-xl font-bold text-slate-900 mt-1.5 flex items-center gap-2">
                <span>{currentOrderSpotlight.orderNumber}</span>
                <span className="text-sm font-medium text-slate-500">({currentOrderSpotlight.garmentSummary})</span>
              </h2>
            </div>

            <div className="text-left sm:text-right">
              <span className="text-xs text-slate-500 block">Promised Delivery</span>
              <span className="text-sm font-bold text-amber-700 flex items-center gap-1 sm:justify-end">
                <Calendar className="h-4 w-4" />
                {new Date(currentOrderSpotlight.deliveryDate).toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Customer Friendly Stage Info */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-600" />
                {currentOrderSpotlight.friendlyStatus?.title || 'Order Confirmed'}
              </span>
              <span className="font-semibold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full text-xs">
                Step {currentOrderSpotlight.friendlyStatus?.stepIndex || 1} of 7
              </span>
            </div>
            <p className="text-xs text-slate-600">
              {currentOrderSpotlight.friendlyStatus?.description || 'Your order has been booked.'}
            </p>
          </div>

          {/* Action Button */}
          <div className="flex items-center justify-between pt-1">
            <div className="text-xs text-slate-500">
              Balance: <span className="font-bold text-slate-900">{formatCurrency(currentOrderSpotlight.balanceAmount)}</span>
            </div>
            <Link
              to={`/portal/orders/${currentOrderSpotlight.id}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 shadow-sm transition"
            >
              <span>Track Full Progress</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center space-y-3">
          <Package className="h-12 w-12 text-slate-300 mx-auto" />
          <h3 className="font-bold text-base text-slate-800">No Active Orders In Progress</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            You do not currently have any orders undergoing tailoring. When you book a bespoke garment at the atelier, its live progress will appear here.
          </p>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Quick Action Navigation Grid                                  */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Order History Card */}
        <Link
          to="/portal/orders"
          className="group p-5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs transition flex items-center justify-between"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 group-hover:text-blue-700 transition">
                My Order History
              </h3>
              <p className="text-xs text-slate-500">View active bookings, receipts, and past bespoke orders</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-blue-700 group-hover:translate-x-1 transition" />
        </Link>

        {/* Master Fit Profile Card */}
        <Link
          to="/portal/measurements"
          className="group p-5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs transition flex items-center justify-between"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
              <Ruler className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 group-hover:text-indigo-700 transition">
                Master Fit Profile
              </h3>
              <p className="text-xs text-slate-500">Inspect verified body dimensions calibrated by master cutter</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-indigo-700 group-hover:translate-x-1 transition" />
        </Link>
      </div>
    </div>
  );
};
export default CustomerDashboardPage;
