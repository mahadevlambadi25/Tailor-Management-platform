import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import { StatusBadge } from '../../components/common/StatusBadge';
import {
  ShoppingBag,
  Clock,
  CheckCircle2,
  AlertTriangle,
  IndianRupee,
  PlusCircle,
  Users,
  KanbanSquare
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<any>(null);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoading(true);
        if (user?.role === 'TAILOR' || user?.role === 'CUTTER' || user?.role === 'FINISHER') {
          const res = await api.get('/reports/tailor-dashboard');
          if (res.data.success) setMetrics(res.data.data);
        } else if (user?.role === 'MANAGER') {
          const res = await api.get('/reports/manager-dashboard');
          if (res.data.success) setMetrics(res.data.data);
        } else {
          // Default: Owner Overview
          const [statsRes, ordersRes] = await Promise.all([
            api.get('/reports/owner-dashboard'),
            api.get('/orders?limit=6')
          ]);
          if (statsRes.data.success) setMetrics(statsRes.data.data);
          if (ordersRes.data.success) setRecentOrders(ordersRes.data.data.orders);
        }
      } catch (e) {
        console.error('Failed to load dashboard', e);
      } finally {
        setLoading(false);
      }
    };
    loadDashboard();
  }, [user?.id, user?.role]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  // Tailor Dashboard View
  if (user?.role === 'TAILOR' || user?.role === 'CUTTER' || user?.role === 'FINISHER') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Tailor Workshop Dashboard</h1>
          <p className="text-xs text-slate-500">Your assigned production tasks and deadlines.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <span className="text-xs font-semibold text-slate-500">Assigned Jobs</span>
            <div className="mt-2 text-2xl font-bold text-slate-900">{metrics?.assignedJobs?.length || 0}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <span className="text-xs font-semibold text-slate-500">Completed Today</span>
            <div className="mt-2 text-2xl font-bold text-emerald-600">{metrics?.completedToday || 0}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <span className="text-xs font-semibold text-slate-500">Overdue Tasks</span>
            <div className="mt-2 text-2xl font-bold text-rose-600">{metrics?.overdue || 0}</div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
          <h2 className="text-sm font-bold text-slate-900 mb-4">My Current Assignments</h2>
          {metrics?.assignedJobs?.length === 0 ? (
            <p className="text-xs text-slate-500">No active jobs assigned at the moment.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {metrics?.assignedJobs?.map((job: any) => (
                <div key={job.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-900">{job.orderItem?.garmentType?.name}</div>
                    <div className="text-[11px] text-slate-500">
                      Order #{job.orderItem?.order?.orderNumber} ? Client: {job.orderItem?.order?.customer?.firstName}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={job.currentStage} />
                    <Link to="/production" className="text-xs font-semibold text-blue-600 hover:underline">
                      Open Board ?
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Shop Operating Overview</h1>
          <p className="text-xs text-slate-500">Live operational indicators, revenue reconciliation and delivery queues.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/orders/new"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition-all"
          >
            <PlusCircle className="h-4 w-4" />
            New Walk-in Order
          </Link>
          <Link
            to="/production"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all"
          >
            <KanbanSquare className="h-4 w-4" />
            Production Board
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Today's Orders</span>
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600"><ShoppingBag className="h-4 w-4" /></div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{metrics?.todayOrdersCount || 0}</div>
          <div className="text-[10px] text-slate-400 mt-1">Total booked: {metrics?.totalOrders || 0}</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Due Today</span>
            <div className="rounded-lg bg-amber-50 p-2 text-amber-600"><Clock className="h-4 w-4" /></div>
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-600">{metrics?.dueTodayCount || 0}</div>
          <div className="text-[10px] text-slate-400 mt-1">Overdue: {metrics?.overdueCount || 0}</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Collected</span>
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600"><IndianRupee className="h-4 w-4" /></div>
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-600">?{(metrics?.totalRevenue || 0).toLocaleString()}</div>
          <div className="text-[10px] text-slate-400 mt-1">Real database payments</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Outstanding Balance</span>
            <div className="rounded-lg bg-rose-50 p-2 text-rose-600"><AlertTriangle className="h-4 w-4" /></div>
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-600">?{(metrics?.outstandingReceivables || 0).toLocaleString()}</div>
          <div className="text-[10px] text-slate-400 mt-1">Pending receivables</div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-slate-900">Recent Customer Orders</h2>
          <Link to="/orders" className="text-xs font-semibold text-blue-600 hover:underline">
            View All Orders ?
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <p className="text-xs text-slate-500">No orders booked yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/50 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Order #</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3">Garments</th>
                  <th className="py-2.5 px-3">Net Total</th>
                  <th className="py-2.5 px-3">Paid / Balance</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-3 font-bold text-slate-900">{order.orderNumber}</td>
                    <td className="py-3 px-3 font-medium text-slate-800">
                      {order.customer?.firstName} {order.customer?.lastName}
                      <div className="text-[10px] text-slate-400">{order.customer?.mobile}</div>
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      {order.items?.map((i: any) => i.garmentType?.name).join(', ') || 'Custom'}
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-900">?{Number(order.netAmount).toLocaleString()}</td>
                    <td className="py-3 px-3 text-slate-700">
                      <span className="text-emerald-700 font-semibold">?{Number(order.paidAmount).toLocaleString()}</span>
                      {Number(order.balanceAmount) > 0 && (
                        <span className="text-rose-600 font-semibold ml-1.5">(-?{Number(order.balanceAmount).toLocaleString()})</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Link
                        to={`/orders/${order.id}`}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                      >
                        Details ?
                      </Link>
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
