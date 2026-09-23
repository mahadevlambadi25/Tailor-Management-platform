import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { formatCurrency } from '../../utils/currency';
import {
  Package,
  Calendar,
  ArrowRight,
  Search,
  AlertCircle,
  Clock,
  CheckCircle2,
  Filter
} from 'lucide-react';

export const CustomerOrdersListPage: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'READY' | 'DELIVERED'>('ALL');

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/portal/orders');
      if (res.data.success) {
        setOrders(res.data.data || []);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load orders. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const filteredOrders = orders.filter((order) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !query ||
      order.orderNumber.toLowerCase().includes(query) ||
      order.items?.some((i: any) => i.garmentName?.toLowerCase().includes(query));

    if (!matchesSearch) return false;

    if (statusFilter === 'ACTIVE') {
      return !['DELIVERED', 'CANCELLED'].includes(order.status);
    }
    if (statusFilter === 'READY') {
      return order.status === 'READY_FOR_PICKUP';
    }
    if (statusFilter === 'DELIVERED') {
      return order.status === 'DELIVERED';
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* ------------------------------------------------------------- */}
      {/* Header & Search Bar                                           */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Package className="h-6 w-6 text-blue-600" />
            My Bespoke Orders
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Track real-time workshop tailoring progress and promised delivery dates.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search order # or garment..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs focus:border-blue-500 focus:outline-none shadow-2xs"
          />
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Filter Tabs                                                   */}
      {/* ------------------------------------------------------------- */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 pb-3 overflow-x-auto">
        {(['ALL', 'ACTIVE', 'READY', 'DELIVERED'] as const).map((f) => {
          const active = statusFilter === f;
          return (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                active
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {f === 'ALL'
                ? `All Orders (${orders.length})`
                : f === 'ACTIVE'
                ? `In Progress (${orders.filter((o) => !['DELIVERED', 'CANCELLED'].includes(o.status)).length})`
                : f === 'READY'
                ? `Ready for Pickup (${orders.filter((o) => o.status === 'READY_FOR_PICKUP').length})`
                : `Delivered (${orders.filter((o) => o.status === 'DELIVERED').length})`}
            </button>
          );
        })}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Loading / Error States                                        */}
      {/* ------------------------------------------------------------- */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-xs text-slate-500 font-medium">Fetching your order history...</p>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center space-y-3">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto" />
          <h3 className="font-bold text-sm text-red-900">{error}</h3>
          <button
            onClick={fetchOrders}
            className="px-4 py-1.5 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition"
          >
            Retry
          </button>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center space-y-3 shadow-2xs">
          <Package className="h-12 w-12 text-slate-300 mx-auto" />
          <h3 className="font-bold text-base text-slate-800">No Orders Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery
              ? `No orders matching "${searchQuery}". Try a different keyword.`
              : 'You have no tailoring orders registered under this category.'}
          </p>
        </div>
      ) : (
        /* ----------------------------------------------------------- */
        /* Orders List Cards                                           */
        /* ----------------------------------------------------------- */
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const isDelivered = order.status === 'DELIVERED';
            const isReady = order.status === 'READY_FOR_PICKUP';

            return (
              <div
                key={order.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs hover:border-slate-300 hover:shadow-xs transition space-y-3.5"
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="font-extrabold text-base text-slate-900">{order.orderNumber}</span>
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        isDelivered
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : isReady
                          ? 'bg-teal-50 text-teal-700 border border-teal-200'
                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}
                    >
                      {order.friendlyStatus?.title || order.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" /> Placed: {new Date(order.createdAt).toLocaleDateString()}
                    </span>
                    <span className="font-semibold text-amber-700 flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> Due: {new Date(order.deliveryDate).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Items summary */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-slate-400 font-medium">Garments:</span>
                  {order.items?.map((item: any) => (
                    <span
                      key={item.id}
                      className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200/80 font-bold text-slate-800"
                    >
                      {item.garmentName} (x{item.quantity})
                    </span>
                  ))}
                </div>

                {/* Financial bar & Action */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-2 border-t border-slate-100 gap-3">
                  <div className="flex items-center gap-4 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Amount</span>
                      <span className="font-bold text-slate-900">{formatCurrency(order.grandTotal)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Advance Paid</span>
                      <span className="font-bold text-emerald-700">{formatCurrency(order.totalPaid)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Balance Due</span>
                      <span
                        className={`font-bold ${
                          order.balanceDue > 0 ? 'text-amber-700' : 'text-emerald-700'
                        }`}
                      >
                        {formatCurrency(order.balanceDue)}
                      </span>
                    </div>
                  </div>

                  <Link
                    to={`/portal/orders/${order.id}`}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 shadow-2xs transition"
                  >
                    <span>View Order Details</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
export default CustomerOrdersListPage;
