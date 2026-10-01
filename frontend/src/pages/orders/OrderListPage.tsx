import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency } from '../../utils/currency';
import {
  Search,
  PlusCircle,
  Filter,
  Calendar,
  Printer,
  Eye,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  RefreshCw,
  X,
  Clock,
  User,
  ShoppingBag
} from 'lucide-react';

export const OrderListPage: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [deliveryDateFilter, setDeliveryDateFilter] = useState(searchParams.get('deliveryDate') || '');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1, limit: 20 });

  const fetchOrders = async (targetPage = page) => {
    try {
      setLoading(true);
      setError(null);
      let url = `/orders?page=${targetPage}&limit=20&search=${encodeURIComponent(search)}`;
      if (statusFilter) url += `&status=${encodeURIComponent(statusFilter)}`;
      if (deliveryDateFilter) url += `&deliveryDate=${encodeURIComponent(deliveryDateFilter)}`;

      const res = await api.get(url);
      if (res.data.success) {
        setOrders(res.data.data.orders);
        if (res.data.data.pagination) {
          setPagination(res.data.data.pagination);
          setPage(res.data.data.pagination.page);
        }
      } else {
        setError(res.data.error?.message || 'Failed to load orders.');
      }
    } catch (e: any) {
      console.error('Failed to load orders', e);
      setError(e.response?.data?.error?.message || 'Unable to connect to orders service.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    fetchOrders(1);
  }, [statusFilter, deliveryDateFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchOrders(1);
  };

  const handleClearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setDeliveryDateFilter('');
    setPage(1);
    // Refresh without filters
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await api.get('/orders?page=1&limit=20');
        if (res.data.success) {
          setOrders(res.data.data.orders);
          if (res.data.data.pagination) {
            setPagination(res.data.data.pagination);
            setPage(1);
          }
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load orders.');
      } finally {
        setLoading(false);
      }
    })();
  };

  const hasActiveFilters = Boolean(search || statusFilter || deliveryDateFilter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Order Management</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Track bespoke tailoring orders, payment balances, and delivery commitments.
          </p>
        </div>
        <Link
          to="/orders/new"
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 min-h-[44px] text-xs sm:text-sm font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition-all cursor-pointer w-full sm:w-auto"
        >
          <PlusCircle className="h-4 w-4" />
          New Walk-in Order
        </Link>
      </div>

      {/* Search & Filters Bar */}
      <div className="flex flex-col gap-2.5">
        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search order #, customer, mobile..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-9 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-hidden shadow-2xs min-h-[44px]"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  fetchOrders(1);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            type="submit"
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-slate-800 transition-all cursor-pointer min-h-[44px] shrink-0"
          >
            Search
          </button>
        </form>

        {/* Filters - Horizontal scroll on mobile */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-2xs shrink-0 min-h-[40px]">
            <Filter className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-xs font-medium text-slate-700 focus:outline-hidden cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="RECEIVED">Received</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="TRIAL_PENDING">Trial Pending</option>
              <option value="ALTERATION_PENDING">Alteration Pending</option>
              <option value="READY_FOR_PICKUP">Ready for Pickup</option>
              <option value="DELIVERED">Delivered</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-2xs shrink-0 min-h-[40px]">
            <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <input
              type="date"
              value={deliveryDateFilter}
              onChange={(e) => setDeliveryDateFilter(e.target.value)}
              className="bg-transparent text-xs font-medium text-slate-700 focus:outline-hidden cursor-pointer"
              title="Filter by delivery date"
            />
          </div>

          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-all shrink-0 min-h-[40px]"
            >
              <X className="h-3.5 w-3.5" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center space-y-3">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
            <p className="text-xs text-slate-500 font-medium">Loading orders...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center space-y-3">
            <AlertCircle className="mx-auto h-8 w-8 text-rose-500" />
            <p className="text-xs font-semibold text-slate-800">{error}</p>
            <button
              onClick={() => fetchOrders(page)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <ShoppingBag className="h-6 w-6" />
            </div>
            {hasActiveFilters ? (
              <>
                <p className="text-xs font-semibold text-slate-800">No orders match the selected filters.</p>
                <p className="text-xs text-slate-500">Try changing status or search keywords.</p>
                <button
                  onClick={handleClearFilters}
                  className="rounded-lg bg-slate-100 px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200"
                >
                  Clear Filters
                </button>
              </>
            ) : (
              <>
                <p className="text-xs font-semibold text-slate-800">No orders placed yet.</p>
                <p className="text-xs text-slate-500">Book bespoke orders for clients with measurement snapshots.</p>
                <Link
                  to="/orders/new"
                  className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-md shadow-blue-500/20"
                >
                  <PlusCircle className="h-4 w-4" /> Book First Order
                </Link>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 bg-slate-50/75 text-slate-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Order #</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Garment(s)</th>
                    <th className="py-3 px-4">Order Date</th>
                    <th className="py-3 px-4">Delivery Due</th>
                    <th className="py-3 px-4">Net Total</th>
                    <th className="py-3 px-4">Paid / Balance</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4">
                        <Link
                          to={`/orders/${o.id}`}
                          className="font-mono font-bold text-blue-700 hover:underline"
                        >
                          {o.orderNumber}
                        </Link>
                        {o.priority === 'URGENT' && (
                          <span className="ml-1.5 rounded bg-rose-50 px-1.5 py-0.5 text-[9px] font-bold text-rose-600 border border-rose-200">
                            URGENT
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <Link
                          to={`/customers/${o.customer?.id}`}
                          className="font-bold text-slate-900 hover:text-blue-600"
                        >
                          {o.customer?.firstName} {o.customer?.lastName}
                        </Link>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <span>{o.customer?.mobile}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700">
                        <div className="font-medium">
                          {o.items?.map((i: any) => i.garmentType?.name).filter(Boolean).join(', ') || 'Custom Garment'}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {o.items?.length || 1} {o.items?.length === 1 ? 'item' : 'items'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {new Date(o.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700">
                        <div className="flex items-center gap-1 font-medium">
                          <Calendar className="h-3 w-3 text-slate-400" />
                          {new Date(o.deliveryDate).toLocaleDateString()}
                        </div>
                        {o.revisedDeliveryDate && (
                          <div className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1 rounded mt-0.5 inline-block">
                            Rev: {new Date(o.revisedDeliveryDate).toLocaleDateString()}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {formatCurrency(o.netAmount)}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-[11px] text-slate-600">
                          Paid: <span className="font-semibold text-emerald-700">{formatCurrency(o.paidAmount)}</span>
                        </div>
                        <div className="text-[11px] mt-0.5">
                          {Number(o.balanceAmount) > 0 ? (
                            <span className="font-bold text-rose-600">Due: {formatCurrency(o.balanceAmount)}</span>
                          ) : (
                            <span className="font-semibold text-emerald-700">Settled</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={o.status} />
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <Link
                            to={`/documents?orderId=${o.id}`}
                            title="Print Job Card"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
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
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card Layout */}
            <div className="block md:hidden divide-y divide-slate-100">
              {orders.map((o) => (
                <div key={o.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Link to={`/orders/${o.id}`} className="font-mono font-bold text-blue-700 text-xs">
                          {o.orderNumber}
                        </Link>
                        {o.priority === 'URGENT' && (
                          <span className="rounded bg-rose-50 px-1 py-0.2 text-[9px] font-bold text-rose-600 border border-rose-200">
                            URGENT
                          </span>
                        )}
                      </div>
                      <Link to={`/customers/${o.customer?.id}`} className="block font-bold text-sm text-slate-900 mt-1">
                        {o.customer?.firstName} {o.customer?.lastName}
                      </Link>
                      <div className="text-xs text-slate-500">{o.customer?.mobile}</div>
                    </div>
                    <StatusBadge status={o.status} size="sm" />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-lg">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Garments</span>
                      <span className="font-semibold text-slate-800">
                        {o.items?.map((i: any) => i.garmentType?.name).filter(Boolean).join(', ') || 'Custom'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Delivery Due</span>
                      <span className="font-semibold text-slate-800">
                        {new Date(o.deliveryDate).toLocaleDateString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Net Amount</span>
                      <span className="font-bold text-slate-900">{formatCurrency(o.netAmount)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Balance</span>
                      <span className={Number(o.balanceAmount) > 0 ? 'font-bold text-rose-600' : 'font-semibold text-emerald-700'}>
                        {Number(o.balanceAmount) > 0 ? formatCurrency(o.balanceAmount) : 'Settled'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="text-[11px] text-slate-400">
                      Booked {new Date(o.createdAt).toLocaleDateString()}
                    </span>
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/documents?orderId=${o.id}`}
                        className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-500 bg-slate-100 hover:bg-slate-200"
                        title="Print"
                      >
                        <Printer className="h-4 w-4" />
                      </Link>
                      <Link
                        to={`/orders/${o.id}`}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 min-h-[40px] text-xs font-bold text-white hover:bg-blue-700 shadow-xs"
                      >
                        View Order
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Pagination Footer */}
        {pagination.pages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-100 px-4 py-3 bg-slate-50/60 text-xs text-slate-600 gap-3">
            <div className="text-center sm:text-left">
              Showing <span className="font-semibold text-slate-800">{Math.min((page - 1) * pagination.limit + 1, pagination.total)}</span> to{' '}
              <span className="font-semibold text-slate-800">{Math.min(page * pagination.limit, pagination.total)}</span> of{' '}
              <span className="font-semibold text-slate-800">{pagination.total}</span> orders
            </div>
            <div className="flex items-center justify-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => fetchOrders(page - 1)}
                disabled={page <= 1 || loading}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1 px-3 py-2 min-h-[40px] rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none font-medium transition shadow-2xs cursor-pointer text-xs"
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </button>
              <span className="px-2 font-semibold text-slate-700 text-xs shrink-0">Page {page} of {pagination.pages}</span>
              <button
                type="button"
                onClick={() => fetchOrders(page + 1)}
                disabled={page >= pagination.pages || loading}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1 px-3 py-2 min-h-[40px] rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none font-medium transition shadow-2xs cursor-pointer text-xs"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
