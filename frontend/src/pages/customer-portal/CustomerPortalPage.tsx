import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { api } from '../../api/client';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency } from '../../utils/currency';
import { 
  Package, Calendar, Ruler, LogOut, 
  Sparkles
} from 'lucide-react';

interface OrderItem {
  id: string;
  itemNumber: string;
  garmentType: { name: string };
  styleOptions?: Record<string, string>;
  status: string;
  unitPrice: number;
}

interface Order {
  id: string;
  orderNumber: string;
  createdAt: string;
  deliveryDueDate: string;
  status: string;
  paymentStatus: string;
  grandTotal: number;
  advancePaid: number;
  balanceDue: number;
  customerRemarks?: string;
  items: OrderItem[];
  trialDate?: string;
}

interface MeasurementProfile {
  id: string;
  garmentType: { name: string };
  values: Record<string, number | string>;
  isApproved: boolean;
  updatedAt: string;
}

export default function CustomerPortalPage() {
  const { user, logout } = useAuth();
  const { tenant } = useTenant();
  const [activeTab, setActiveTab] = useState<'orders' | 'measurements'>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [measurements, setMeasurements] = useState<MeasurementProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => {
    fetchPortalData();
  }, []);

  const fetchPortalData = async () => {
    setLoading(true);
    try {
      const [ordersRes, measRes] = await Promise.all([
        api.get('/customer-portal/orders'),
        api.get('/customer-portal/measurements')
      ]);
      setOrders(ordersRes.data?.data || []);
      setMeasurements(measRes.data?.data || []);
      if (ordersRes.data?.data?.length > 0) {
        setSelectedOrder(ordersRes.data.data[0]);
      }
    } catch (err) {
      console.error('Failed to load customer portal data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getTimelineSteps = (status: string) => {
    const steps = [
      { key: 'CONFIRMED', label: 'Order Placed' },
      { key: 'IN_PRODUCTION', label: 'In Tailoring' },
      { key: 'READY_FOR_TRIAL', label: 'Ready for Trial' },
      { key: 'READY_FOR_DELIVERY', label: 'Ready for Delivery' },
      { key: 'DELIVERED', label: 'Delivered' }
    ];

    const statusWeights: Record<string, number> = {
      'DRAFT': 0,
      'CONFIRMED': 1,
      'IN_PRODUCTION': 2,
      'READY_FOR_TRIAL': 3,
      'TRIAL_SCHEDULED': 3,
      'ALTERATION_IN_PROGRESS': 2,
      'READY_FOR_DELIVERY': 4,
      'DELIVERED': 5,
      'COMPLETED': 5,
      'CANCELLED': -1
    };

    const currentWeight = statusWeights[status] || 1;

    return steps.map((step, idx) => {
      const stepWeight = idx + 1;
      const isComplete = currentWeight >= stepWeight;
      const isCurrent = currentWeight === stepWeight;
      return { ...step, isComplete, isCurrent };
    });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-slate-900 text-white shadow-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center font-bold text-amber-400">
              {tenant?.name?.[0] || 'T'}
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">{tenant?.name || 'Bespoke Atelier'}</h1>
              <p className="text-xs text-slate-400">Customer Client Portal</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-slate-200">{user?.name || 'Valued Customer'}</p>
              <p className="text-xs text-slate-400">{user?.mobile || user?.email}</p>
            </div>
            <button
              onClick={logout}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-800 text-sm transition"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-400/10 text-amber-400 border border-amber-400/30 mb-2">
                <Sparkles size={12} className="mr-1.5" /> Welcome Back
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Hello, {user?.name || 'Client'}
              </h2>
              <p className="text-slate-400 text-sm mt-1">
                Track your orders in real-time, view verified measurements, and check delivery dates.
              </p>
            </div>

            {/* Quick Status Pill */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center space-x-6">
              <div>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Active Orders</p>
                <p className="text-2xl font-bold text-amber-400">
                  {orders.filter(o => !['COMPLETED', 'DELIVERED', 'CANCELLED'].includes(o.status)).length}
                </p>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Balance Due</p>
                <p className="text-2xl font-bold text-white">
                  {formatCurrency(orders.reduce((sum, o) => sum + (o.balanceDue || 0), 0))}
                </p>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex space-x-2 mt-8 border-b border-slate-700/60">
            <button
              onClick={() => setActiveTab('orders')}
              className={`pb-3 px-4 font-medium text-sm flex items-center space-x-2 border-b-2 transition ${
                activeTab === 'orders'
                  ? 'border-amber-400 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Package size={18} />
              <span>My Orders ({orders.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('measurements')}
              className={`pb-3 px-4 font-medium text-sm flex items-center space-x-2 border-b-2 transition ${
                activeTab === 'measurements'
                  ? 'border-amber-400 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Ruler size={18} />
              <span>My Fit Profile ({measurements.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {loading ? (
          <div className="py-24 text-center">
            <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-500">Loading your profile & orders...</p>
          </div>
        ) : activeTab === 'orders' ? (
          orders.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <Package size={48} className="mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-bold text-slate-700">No Orders Found</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                You do not have any active or past tailoring orders registered with your mobile number.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Order List / Selector */}
              <div className="lg:col-span-1 space-y-3">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">Order History</h3>
                {orders.map((order) => {
                  const isSelected = selectedOrder?.id === order.id;
                  return (
                    <div
                      key={order.id}
                      onClick={() => setSelectedOrder(order)}
                      className={`cursor-pointer rounded-xl p-4 transition border ${
                        isSelected 
                          ? 'bg-amber-50/70 border-amber-300 shadow-sm'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-sm text-slate-900">{order.orderNumber}</span>
                        <StatusBadge status={order.status} />
                      </div>
                      <p className="text-xs text-slate-500 mb-2">
                        Placed: {new Date(order.createdAt).toLocaleDateString()}
                      </p>
                      <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                        <span className="text-slate-600 font-medium">
                          {order.items?.length || 1} Item(s)
                        </span>
                        <span className="font-bold text-slate-800">
                          {formatCurrency(order.grandTotal)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Order Detail View */}
              <div className="lg:col-span-2">
                {selectedOrder && (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    {/* Order Head */}
                    <div className="p-6 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 bg-slate-50/50">
                      <div>
                        <div className="flex items-center space-x-3">
                          <h3 className="text-xl font-bold text-slate-900">{selectedOrder.orderNumber}</h3>
                          <StatusBadge status={selectedOrder.status} />
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Placed on {new Date(selectedOrder.createdAt).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-xs text-slate-500">Expected Delivery</p>
                        <p className="text-base font-bold text-amber-600 flex items-center justify-end">
                          <Calendar size={16} className="mr-1" />
                          {new Date(selectedOrder.deliveryDueDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {/* Stepper / Timeline */}
                    <div className="p-6 border-b border-slate-100">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-6">
                        Live Production Tracking
                      </h4>
                      <div className="relative flex items-center justify-between max-w-lg mx-auto">
                        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-200 -translate-y-1/2 z-0" />
                        {getTimelineSteps(selectedOrder.status).map((step, idx) => (
                          <div key={idx} className="relative z-10 flex flex-col items-center">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition ${
                                step.isComplete
                                  ? 'bg-emerald-600 text-white shadow-sm'
                                  : step.isCurrent
                                  ? 'bg-amber-500 text-white ring-4 ring-amber-100 animate-pulse'
                                  : 'bg-slate-100 text-slate-400 border border-slate-300'
                              }`}
                            >
                              {step.isComplete ? '✓' : idx + 1}
                            </div>
                            <span className="text-[11px] font-medium text-slate-600 mt-2 text-center max-w-[80px] leading-tight">
                              {step.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Order Items */}
                    <div className="p-6 border-b border-slate-100">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
                        Garments & Styles
                      </h4>
                      <div className="space-y-3">
                        {selectedOrder.items?.map((item) => (
                          <div key={item.id} className="p-3.5 rounded-xl border border-slate-200 flex items-start justify-between">
                            <div>
                              <p className="font-bold text-sm text-slate-800">{item.garmentType?.name || 'Custom Garment'}</p>
                              <p className="text-xs text-slate-400">Item #{item.itemNumber}</p>
                              {item.styleOptions && (
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                  {Object.entries(item.styleOptions).map(([k, v]) => (
                                    <span key={k} className="px-2 py-0.5 rounded bg-slate-100 text-[11px] text-slate-600">
                                      <strong className="capitalize">{k}</strong>: {v}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <StatusBadge status={item.status} />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Customer Remarks (Internal Notes are strictly omitted for privacy) */}
                    {selectedOrder.customerRemarks && (
                      <div className="p-6 border-b border-slate-100 bg-amber-50/30">
                        <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider mb-1">
                          Special Requests & Notes
                        </h4>
                        <p className="text-xs text-amber-800 italic">"{selectedOrder.customerRemarks}"</p>
                      </div>
                    )}

                    {/* Financial Summary */}
                    <div className="p-6 bg-slate-50">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                        Billing & Payment Summary
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between text-slate-600">
                          <span>Total Amount:</span>
                          <span className="font-medium">{formatCurrency(selectedOrder.grandTotal)}</span>
                        </div>
                        <div className="flex justify-between text-emerald-700">
                          <span>Advance Paid:</span>
                          <span className="font-medium">{formatCurrency(selectedOrder.advancePaid)}</span>
                        </div>
                        <div className="flex justify-between font-bold text-base pt-2 border-t border-slate-200">
                          <span className={selectedOrder.balanceDue > 0 ? 'text-rose-600' : 'text-slate-800'}>
                            Balance Remaining:
                          </span>
                          <span className={selectedOrder.balanceDue > 0 ? 'text-rose-600' : 'text-emerald-700'}>
                            {formatCurrency(selectedOrder.balanceDue)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        ) : (
          /* Measurements Profile View */
          <div>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Your Master Fit Profile</h3>
                <p className="text-xs text-slate-500">
                  These verified dimensions are calibrated by the master cutter for your customized fit.
                </p>
              </div>
            </div>

            {measurements.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                <Ruler size={48} className="mx-auto text-slate-300 mb-4" />
                <h4 className="text-base font-bold text-slate-700">No Measurements on File</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Visit the atelier for an in-person measurement session or during your next trial.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {measurements.map((profile) => (
                  <div key={profile.id} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                    <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold">
                          <Ruler size={16} />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-800">{profile.garmentType?.name || 'Garment Profile'}</h4>
                          <span className="text-[11px] text-slate-400">
                            Verified on {new Date(profile.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Approved
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
                      {Object.entries(profile.values || {}).map(([key, val]) => (
                        <div key={key} className="bg-slate-50 rounded-lg p-2.5 border border-slate-200/70">
                          <p className="text-[11px] text-slate-400 uppercase font-medium">{key}</p>
                          <p className="text-sm font-bold text-slate-800 mt-0.5">{String(val)}"</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
