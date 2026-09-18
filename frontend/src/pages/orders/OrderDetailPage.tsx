import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../api/client';
import { StatusBadge } from '../../components/common/StatusBadge';
import {
  Calendar,
  Clock,
  Printer,
  CreditCard,
  Ruler,
  Scissors,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft
} from 'lucide-react';

export const OrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Payment recording form state
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState('UPI');
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [isRefund, setIsRefund] = useState(false);
  const [payLoading, setPayLoading] = useState(false);

  const fetchOrder = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/orders/${id}`);
      if (res.data.success) {
        setOrder(res.data.data);
        setPayAmount(Number(res.data.data.balanceAmount) || 0);
      }
    } catch (e) {
      console.error('Failed to load order', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
  }, [id]);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayLoading(true);
    try {
      const res = await api.post('/payments', {
        orderId: id,
        amount: payAmount,
        paymentMethod: payMethod,
        referenceNumber: payRef,
        notes: payNotes,
        isRefund
      });
      if (res.data.success) {
        setShowPaymentModal(false);
        fetchOrder();
      }
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to record payment');
    } finally {
      setPayLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!order) {
    return <div className="p-8 text-center text-slate-500">Order not found.</div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Back Link & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link to="/orders" className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 mb-2">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Orders
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold font-mono text-slate-900">{order.orderNumber}</h1>
            <StatusBadge status={order.status} />
            {order.priority === 'URGENT' && (
              <span className="rounded bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-600 border border-rose-200">
                URGENT
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Booked on {new Date(order.createdAt).toLocaleDateString()} ? Customer: {order.customer?.firstName} {order.customer?.lastName}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to={`/documents?orderId=${order.id}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-xs"
          >
            <Printer className="h-4 w-4 text-slate-500" />
            Print Job Card / Invoices
          </Link>
          <button
            onClick={() => setShowPaymentModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-md shadow-emerald-500/20 transition-all"
          >
            <CreditCard className="h-4 w-4" />
            Record Payment
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Customer Information */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Client Profile</span>
          <div className="mt-2 text-sm font-bold text-slate-900">{order.customer?.firstName} {order.customer?.lastName}</div>
          <div className="text-xs text-slate-600 mt-0.5">Phone: {order.customer?.mobile}</div>
          <div className="text-xs text-slate-500 mt-1">{order.customer?.address || 'Bangalore'}</div>
          <Link to={`/customers/${order.customer?.id}`} className="mt-3 inline-block text-xs font-semibold text-blue-600 hover:underline">
            View Full Profile ?
          </Link>
        </div>

        {/* Schedule & Delivery */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Delivery Commitment</span>
          <div className="mt-2 flex items-center gap-1.5 text-sm font-bold text-slate-900">
            <Calendar className="h-4 w-4 text-blue-600" />
            {new Date(order.deliveryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          {order.revisedDeliveryDate && (
            <div className="mt-2 p-2 bg-amber-50 rounded-lg text-xs text-amber-800 border border-amber-200">
              Revised Delivery: {new Date(order.revisedDeliveryDate).toLocaleDateString()}
              <div className="text-[10px] mt-0.5">Reason: {order.delayReason}</div>
            </div>
          )}
        </div>

        {/* Financial Summary */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Commercial Summary</span>
          <div className="mt-2 space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Gross Total:</span>
              <span className="font-semibold text-slate-800">?{Number(order.totalAmount).toLocaleString()}</span>
            </div>
            {Number(order.discountAmount) > 0 && (
              <div className="flex justify-between text-rose-600 font-semibold">
                <span>Discount:</span>
                <span>-?{Number(order.discountAmount).toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-100 pt-1 font-bold text-slate-900">
              <span>Net Total:</span>
              <span>?{Number(order.netAmount).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-emerald-700 font-semibold">
              <span>Paid:</span>
              <span>?{Number(order.paidAmount).toLocaleString()}</span>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-1 font-bold text-rose-600 text-sm">
              <span>Balance Due:</span>
              <span>?{Number(order.balanceAmount).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Order Items Table & Immutable Measurement Snapshots */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <h2 className="text-sm font-bold text-slate-900">Garment Items & Measurement Snapshots</h2>

        <div className="space-y-4">
          {order.items?.map((item: any, idx: number) => (
            <div key={item.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-800 font-bold text-xs">
                    {idx + 1}
                  </span>
                  <span className="font-bold text-sm text-slate-900">{item.garmentType?.name}</span>
                  <span className="text-xs text-slate-500">({item.garmentType?.category})</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-xs text-slate-900">Price: ?{Number(item.totalItemPrice).toLocaleString()}</span>
                  <StatusBadge status={item.status} size="sm" />
                </div>
              </div>

              {/* Measurement Snapshot Box */}
              {item.measurementSnapshot ? (
                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 mb-2">
                    <span className="flex items-center gap-1"><Ruler className="h-3.5 w-3.5 text-blue-600" /> Historical Measurement Snapshot (Immutable):</span>
                    <span className="text-[10px] text-slate-400">Unit: {item.measurementSnapshot.unit}</span>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
                    {Object.entries(item.measurementSnapshot.valuesSnapshot || {}).map(([k, v]: any) => (
                      <div key={k} className="p-1.5 rounded bg-slate-50 border border-slate-100">
                        <div className="text-[10px] text-slate-400 font-medium">{k}</div>
                        <div className="text-xs font-bold text-slate-800">{String(v)}"</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-400 italic">No measurement snapshot attached.</div>
              )}

              {/* Styles & Production details */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 pt-1">
                <div>
                  Styles: {item.styles?.map((s: any) => s.style?.name).join(', ') || 'Standard cut'}
                </div>
                <div className="flex items-center gap-2 font-medium">
                  Assigned Tailor: <span className="font-bold text-slate-900">{item.productionJob?.assignedTo?.name || 'Unassigned'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Payment Ledger */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">Payment Transactions</h2>
          <button
            onClick={() => setShowPaymentModal(true)}
            className="text-xs font-bold text-emerald-600 hover:underline"
          >
            + Record Payment
          </button>
        </div>

        {order.payments?.length === 0 ? (
          <p className="text-xs text-slate-500">No payments recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50 text-slate-500 font-semibold uppercase">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">Method</th>
                  <th className="py-2.5 px-3">Reference</th>
                  <th className="py-2.5 px-3">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {order.payments?.map((p: any) => (
                  <tr key={p.id}>
                    <td className="py-2.5 px-3 text-slate-600">{new Date(p.createdAt).toLocaleDateString()}</td>
                    <td className="py-2.5 px-3 font-bold text-emerald-700">?{Number(p.amount).toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-slate-800">{p.paymentMethod}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-500">{p.referenceNumber || '-'}</td>
                    <td className="py-2.5 px-3">
                      {p.isRefund ? (
                        <span className="text-rose-600 font-bold text-[10px]">REFUND</span>
                      ) : (
                        <span className="text-emerald-700 font-bold text-[10px]">PAYMENT</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-slate-900">Record Payment</h2>
            <p className="text-xs text-slate-500 mt-0.5">Capture full, advance, or partial payment against balance.</p>

            <form onSubmit={handleRecordPayment} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Amount (?) *</label>
                <input
                  type="number"
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(Number(e.target.value))}
                  className="mt-1 block w-full rounded-lg border border-slate-300 py-2 px-3 text-xs font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Payment Mode</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 py-2 px-3 text-xs"
                >
                  <option value="UPI">UPI</option>
                  <option value="CASH">Cash</option>
                  <option value="CARD">Debit / Credit Card</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Reference / Transaction ID</label>
                <input
                  type="text"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  placeholder="e.g. UPI-12345678"
                  className="mt-1 block w-full rounded-lg border border-slate-300 py-2 px-3 text-xs font-mono"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="refundCheck"
                  checked={isRefund}
                  onChange={(e) => setIsRefund(e.target.checked)}
                  className="rounded text-rose-600 focus:ring-rose-500"
                />
                <label htmlFor="refundCheck" className="text-xs font-medium text-slate-700">
                  This transaction is a refund to the customer
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 mt-4">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={payLoading}
                  className="rounded-lg bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {payLoading ? 'Saving...' : 'Save & Reconcile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
