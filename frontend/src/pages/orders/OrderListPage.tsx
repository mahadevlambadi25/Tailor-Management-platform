import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Search, PlusCircle, Filter, Calendar, Printer, Eye, ChevronLeft, ChevronRight } from 'lucide-react';

export const OrderListPage: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1, limit: 20 });

  const fetchOrders = async (targetPage = page) => {
    try {
      setLoading(true);
      let url = `/orders?page=${targetPage}&limit=20&search=${encodeURIComponent(search)}`;
      if (statusFilter) url += `&status=${statusFilter}`;
      const res = await api.get(url);
      if (res.data.success) {
        setOrders(res.data.data.orders);
        if (res.data.data.pagination) {
          setPagination(res.data.data.pagination);
          setPage(res.data.data.pagination.page);
        }
      }
    } catch (e) {
      console.error('Failed to load orders', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    fetchOrders(1);
  }, [statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchOrders(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Order Management</h1>
          <p className="text-xs text-slate-500">Track bespoke tailoring orders, payment balances, and delivery dates.</p>
        </div>
        <Link
          to="/orders/new"
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition-all"
        >
          <PlusCircle className="h-4 w-4" />
          New Walk-in Order
        </Link>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <form onSubmit={handleSearch} className="flex-1 min-w-[240px] flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by order #, customer name, mobile..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-4 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-hidden"
            />
          </div>
          <button type="submit" className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-bold text-white">
            Search
          </button>
        </form>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-medium text-slate-700"
          >
            <option value="">All Statuses</option>
            <option value="RECEIVED">Received</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="TRIAL_PENDING">Trial Pending</option>
            <option value="READY_FOR_PICKUP">Ready for Pickup</option>
            <option value="DELIVERED">Delivered</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          </div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No orders found matching the filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/50 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Order #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Garments</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4">Net Total</th>
                  <th className="py-3 px-4">Payment Balance</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-bold text-blue-700 font-mono">
                      {o.orderNumber}
                      {o.priority === 'URGENT' && (
                        <span className="ml-1.5 rounded bg-rose-50 px-1.5 py-0.5 text-[9px] font-bold text-rose-600 border border-rose-200">
                          URGENT
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800">
                      {o.customer?.firstName} {o.customer?.lastName}
                      <div className="text-[10px] text-slate-400">{o.customer?.mobile}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {o.items?.map((i: any) => i.garmentType?.name).join(', ') || 'Custom Garment'}
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-slate-400" />
                        {new Date(o.deliveryDate).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      ?{Number(o.netAmount).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      {Number(o.balanceAmount) > 0 ? (
                        <span className="font-bold text-rose-600">?{Number(o.balanceAmount).toLocaleString()} due</span>
                      ) : (
                        <span className="font-semibold text-emerald-700">Settled (?0)</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <Link
                        to={`/documents?orderId=${o.id}`}
                        title="Print Job Card / Receipt"
                        className="inline-flex items-center p-1.5 text-slate-500 hover:text-slate-800"
                      >
                        <Printer className="h-3.5 w-3.5" />
                      </Link>
                      <Link
                        to={`/orders/${o.id}`}
                        className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination.pages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-100 px-4 py-3 bg-slate-50/60 text-xs text-slate-600 gap-2">
            <div>
              Showing <span className="font-semibold text-slate-800">{Math.min((page - 1) * pagination.limit + 1, pagination.total)}</span> to{' '}
              <span className="font-semibold text-slate-800">{Math.min(page * pagination.limit, pagination.total)}</span> of{' '}
              <span className="font-semibold text-slate-800">{pagination.total}</span> orders
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fetchOrders(page - 1)}
                disabled={page <= 1 || loading}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none font-medium transition shadow-xs"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Previous
              </button>
              <span className="px-2 font-semibold text-slate-700">Page {page} of {pagination.pages}</span>
              <button
                type="button"
                onClick={() => fetchOrders(page + 1)}
                disabled={page >= pagination.pages || loading}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none font-medium transition shadow-xs"
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
