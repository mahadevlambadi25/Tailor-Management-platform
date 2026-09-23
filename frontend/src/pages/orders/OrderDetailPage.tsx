import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import { PaymentReceiptModal } from '../../components/payments/PaymentReceiptModal';
import { formatCurrency } from '../../utils/currency';
import {
  Calendar,
  Clock,
  Printer,
  CreditCard,
  Ruler,
  Scissors,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  User,
  AlertCircle,
  Activity,
  Edit,
  X,
  RotateCcw,
  Receipt,
  ShieldCheck
} from 'lucide-react';

export const OrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Payment recording form state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState('UPI');
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [isRefund, setIsRefund] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  // Receipt Modal State
  const [selectedReceiptPayment, setSelectedReceiptPayment] = useState<any | null>(null);

  // Cancel / Reversal Modal State
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelPaymentId, setCancelPaymentId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState('');

  // Status Update Modal State
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [revisedDate, setRevisedDate] = useState('');
  const [delayReason, setDelayReason] = useState('');
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState('');

  const isManagerOrOwner = user?.role === 'SHOP_OWNER' || user?.role === 'MANAGER';

  const fetchOrder = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/orders/${id}`);
      if (res.data.success) {
        const ord = res.data.data;
        setOrder(ord);
        setNewStatus(ord.status);
        setPayAmount(Number(ord.balanceAmount) > 0 ? Number(ord.balanceAmount) : 0);
      } else {
        setError(res.data.error?.message || 'Order not found.');
      }
    } catch (e: any) {
      console.error('Failed to load order', e);
      setError(e.response?.data?.error?.message || 'Failed to load order.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
  }, [id]);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayError(null);

    const amountNum = Number(payAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setPayError('Please enter a valid payment amount greater than zero.');
      return;
    }

    if (!isRefund && amountNum > Number(order.balanceAmount)) {
      setPayError(
        `Payment amount cannot exceed the remaining balance of ${formatCurrency(order.balanceAmount)}.`
      );
      return;
    }

    setPayLoading(true);
    try {
      const res = await api.post(`/orders/${id}/payments`, {
        amount: amountNum,
        paymentMethod: payMethod,
        referenceNumber: payRef || undefined,
        notes: payNotes || undefined,
        isRefund
      });

      if (res.data.success) {
        setShowPaymentModal(false);
        setPayRef('');
        setPayNotes('');
        setIsRefund(false);
        setPayError(null);
        await fetchOrder();

        // Automatically prompt printable receipt for the newly created payment
        const newPayment = res.data.data;
        if (newPayment) {
          setSelectedReceiptPayment({
            ...newPayment,
            order: {
              ...order,
              paidAmount: newPayment.updatedOrder?.paidAmount || order.paidAmount,
              balanceAmount: newPayment.updatedOrder?.balanceAmount || order.balanceAmount,
              paymentStatus: newPayment.updatedOrder?.paymentStatus || order.paymentStatus
            },
            customer: order.customer
          });
        }
      }
    } catch (err: any) {
      setPayError(err.response?.data?.error?.message || 'Failed to record payment');
    } finally {
      setPayLoading(false);
    }
  };

  const handleCancelPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelPaymentId) return;

    if (!cancelReason.trim()) {
      setCancelError('Please provide a mandatory cancellation / reversal reason.');
      return;
    }

    setCancelLoading(true);
    setCancelError('');
    try {
      const res = await api.post(`/payments/${cancelPaymentId}/cancel`, {
        reason: cancelReason.trim()
      });

      if (res.data.success) {
        setShowCancelModal(false);
        setCancelPaymentId(null);
        setCancelReason('');
        fetchOrder();
      }
    } catch (err: any) {
      setCancelError(err.response?.data?.error?.message || 'Failed to cancel payment record.');
    } finally {
      setCancelLoading(false);
    }
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusError('');

    if (revisedDate && !delayReason.trim()) {
      setStatusError('Please provide a reason for the revised delivery date.');
      return;
    }

    setStatusLoading(true);
    try {
      const payload: any = {
        status: newStatus
      };
      if (revisedDate) {
        payload.revisedDeliveryDate = new Date(revisedDate).toISOString();
        payload.delayReason = delayReason.trim();
      } else if (delayReason.trim()) {
        payload.delayReason = delayReason.trim();
      }

      const res = await api.patch(`/orders/${id}/status`, payload);
      if (res.data.success) {
        setShowStatusModal(false);
        fetchOrder();
      }
    } catch (err: any) {
      setStatusError(err.response?.data?.error?.message || 'Failed to update order status');
    } finally {
      setStatusLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center space-y-3">
        <AlertCircle className="mx-auto h-8 w-8 text-rose-500" />
        <h2 className="text-base font-bold text-slate-800">{error || 'Order not found.'}</h2>
        <Link
          to="/orders"
          className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
        >
          Return to Orders List
        </Link>
      </div>
    );
  }

  const isFullyPaid = order.paymentStatus === 'FULLY_PAID' || Number(order.balanceAmount) <= 0;
  const isPartiallyPaid = order.paymentStatus === 'PARTIALLY_PAID' && Number(order.paidAmount) > 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header & Quick Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            to="/orders"
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Orders
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
              {order.orderNumber}
            </h1>
            <StatusBadge status={order.status} />
            {order.priority === 'URGENT' && (
              <span className="rounded bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-600 border border-rose-200">
                URGENT
              </span>
            )}
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider border ${
                isFullyPaid
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : isPartiallyPaid
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}
            >
              {isFullyPaid
                ? 'Fully Paid'
                : isPartiallyPaid
                ? `Partial (${formatCurrency(order.balanceAmount)} Due)`
                : 'Unpaid'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Booked on {new Date(order.createdAt).toLocaleDateString()} • Client:{' '}
            <Link
              to={`/customers/${order.customer?.id}`}
              className="font-semibold text-blue-600 hover:underline"
            >
              {order.customer?.firstName} {order.customer?.lastName} ({order.customer?.customerId})
            </Link>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setNewStatus(order.status);
              setRevisedDate(order.revisedDeliveryDate ? order.revisedDeliveryDate.substring(0, 10) : '');
              setDelayReason(order.delayReason || '');
              setStatusError('');
              setShowStatusModal(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-2xs cursor-pointer"
          >
            <Edit className="h-3.5 w-3.5 text-slate-500" />
            Update Status
          </button>
          <Link
            to={`/documents?orderId=${order.id}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-2xs"
          >
            <Printer className="h-3.5 w-3.5 text-slate-500" />
            Print Job Card
          </Link>
          <button
            onClick={() => {
              setPayAmount(Number(order.balanceAmount) > 0 ? Number(order.balanceAmount) : 0);
              setPayError(null);
              setShowPaymentModal(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
          >
            <CreditCard className="h-3.5 w-3.5" />
            Record Payment
          </button>
        </div>
      </div>

      {/* Overview Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Customer Information */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block border-b border-slate-100 pb-1.5">
            Client Profile
          </span>
          <div className="mt-2.5 space-y-1 text-xs text-slate-600">
            <div className="text-sm font-bold text-slate-900">
              {order.customer?.firstName} {order.customer?.lastName}
            </div>
            <div>
              Phone: <span className="font-semibold text-slate-800">{order.customer?.mobile}</span>
            </div>
            {order.customer?.email && <div>Email: {order.customer?.email}</div>}
            <div className="text-slate-500 mt-1">{order.customer?.address || 'Bangalore'}</div>
            <Link
              to={`/customers/${order.customer?.id}`}
              className="mt-2 inline-block font-semibold text-blue-600 hover:underline text-[11px]"
            >
              View Complete Customer Profile →
            </Link>
          </div>
        </div>

        {/* Schedule & Delivery Commitment */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block border-b border-slate-100 pb-1.5">
            Delivery Commitment
          </span>
          <div className="mt-2.5 space-y-2">
            <div className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
              <Calendar className="h-4 w-4 text-blue-600" />
              {new Date(order.deliveryDate).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}
            </div>
            {order.revisedDeliveryDate ? (
              <div className="p-2.5 bg-amber-50 rounded-xl text-xs text-amber-900 border border-amber-200">
                <span className="font-bold block">
                  Revised Date: {new Date(order.revisedDeliveryDate).toLocaleDateString()}
                </span>
                <span className="text-[11px] text-amber-800">
                  Reason: {order.delayReason || 'Workshop scheduling'}
                </span>
              </div>
            ) : (
              <p className="text-[11px] text-slate-500">
                Order is on schedule for standard workshop delivery.
              </p>
            )}
          </div>
        </div>

        {/* Billing Summary Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Billing Summary
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                isFullyPaid
                  ? 'bg-emerald-100 text-emerald-800'
                  : isPartiallyPaid
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-rose-100 text-rose-800'
              }`}
            >
              {order.paymentStatus || (isFullyPaid ? 'FULLY_PAID' : 'UNPAID')}
            </span>
          </div>

          <div className="mt-2.5 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Gross Amount:</span>
              <span className="font-semibold text-slate-800 font-mono">
                {formatCurrency(order.totalAmount)}
              </span>
            </div>
            {Number(order.discountAmount) > 0 && (
              <div className="flex justify-between text-rose-600 font-semibold">
                <span>Discount:</span>
                <span className="font-mono">-{formatCurrency(order.discountAmount)}</span>
              </div>
            )}
            {Number(order.gstAmount) > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>GST:</span>
                <span className="font-mono">+{formatCurrency(order.gstAmount)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-100 pt-1 font-bold text-slate-900">
              <span>Final Order Value:</span>
              <span className="font-mono">{formatCurrency(order.netAmount)}</span>
            </div>
            <div className="flex justify-between text-emerald-700 font-semibold">
              <span>Total Paid:</span>
              <span className="font-mono font-bold">{formatCurrency(order.paidAmount)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-1 font-bold text-sm">
              <span className="text-slate-700">Balance Due:</span>
              <span
                className={`font-mono ${
                  Number(order.balanceAmount) > 0 ? 'text-rose-600' : 'text-emerald-700'
                }`}
              >
                {Number(order.balanceAmount) > 0
                  ? formatCurrency(order.balanceAmount)
                  : 'Settled (₹0)'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Garments & Immutable Measurement Snapshots */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
        <h2 className="text-sm font-bold text-slate-900">Garment Items & Measurement Snapshots</h2>

        <div className="space-y-4">
          {order.items?.map((item: any, idx: number) => (
            <div key={item.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-[10px]">
                    {idx + 1}
                  </span>
                  <span className="font-bold text-sm text-slate-900">{item.garmentType?.name}</span>
                  <span className="text-xs text-slate-500">({item.garmentType?.category})</span>
                  <span className="text-xs text-slate-600 font-medium">Qty: {item.quantity}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-xs text-slate-900">
                    Total: {formatCurrency(item.totalItemPrice)}
                  </span>
                  <StatusBadge status={item.status} size="sm" />
                </div>
              </div>

              {/* Measurement Snapshot Box */}
              {item.measurementSnapshot ? (
                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 mb-2">
                    <span className="flex items-center gap-1">
                      <Ruler className="h-3.5 w-3.5 text-blue-600" />
                      Historical Measurement Snapshot (Immutable):
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Unit: {item.measurementSnapshot.unit}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
                    {Object.entries(item.measurementSnapshot.valuesSnapshot || {}).map(
                      ([k, v]: any) => (
                        <div key={k} className="p-1.5 rounded bg-slate-50 border border-slate-100">
                          <div className="text-[10px] text-slate-400 font-medium">{k}</div>
                          <div className="text-xs font-bold text-slate-800">{String(v)}"</div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-400 italic">No measurement snapshot attached.</div>
              )}

              {/* Styles & Production details */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 pt-1">
                <div>
                  Styles:{' '}
                  <span className="font-semibold">
                    {item.styles?.map((s: any) => s.style?.name).join(', ') || 'Standard cut'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  Assigned Tailor:{' '}
                  <span className="font-bold text-slate-900">
                    {item.productionJob?.assignedTo?.name || 'Workshop Queue'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Payment Ledger & In-Place Record Payment */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Payment Transactions</h2>
            <p className="text-xs text-slate-500">
              Manual staff records of advance, installments, settlements, and reversals.
            </p>
          </div>
          <button
            onClick={() => {
              setPayAmount(Number(order.balanceAmount) > 0 ? Number(order.balanceAmount) : 0);
              setPayError(null);
              setShowPaymentModal(true);
            }}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl border border-emerald-200 transition cursor-pointer"
          >
            <CreditCard className="h-3.5 w-3.5" />
            + Record Payment
          </button>
        </div>

        {!order.payments || order.payments.length === 0 ? (
          <p className="text-xs text-slate-500 bg-slate-50 p-4 rounded-xl text-center">
            No payment transactions recorded yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50 text-slate-500 font-semibold uppercase">
                <tr>
                  <th className="py-2.5 px-3">Receipt #</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">Method</th>
                  <th className="py-2.5 px-3">Reference / Notes</th>
                  <th className="py-2.5 px-3">Recorded By</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {order.payments.map((p: any) => {
                  const receiptNo =
                    p.receipts?.[0]?.receiptNumber || `REC-${p.id.substring(0, 8).toUpperCase()}`;
                  const isReversalEntry = p.isRefund || p.isCorrection;

                  return (
                    <tr
                      key={p.id}
                      className={p.isCorrection && !p.isRefund ? 'opacity-60 bg-slate-50/50' : ''}
                    >
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-700">
                        {receiptNo}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {new Date(p.createdAt).toLocaleDateString()}
                      </td>
                      <td
                        className={`py-2.5 px-3 font-bold font-mono text-sm ${
                          p.isRefund ? 'text-rose-600' : 'text-emerald-700'
                        }`}
                      >
                        {formatCurrency(p.isRefund ? -Number(p.amount) : Number(p.amount))}
                      </td>
                      <td className="py-2.5 px-3 text-slate-800">
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                          {p.paymentMethod}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">
                        {p.referenceNumber && (
                          <span className="font-mono text-slate-700 font-medium">
                            {p.referenceNumber}
                          </span>
                        )}
                        {p.notes && (
                          <div className="text-[11px] text-slate-400 italic">{p.notes}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {p.recordedBy?.name || 'Staff'}
                      </td>
                      <td className="py-2.5 px-3">
                        {p.isRefund ? (
                          <span className="text-rose-700 font-bold text-[10px] bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
                            REVERSAL
                          </span>
                        ) : p.isCorrection ? (
                          <span className="text-amber-700 font-bold text-[10px] bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                            CANCELLED
                          </span>
                        ) : (
                          <span className="text-emerald-700 font-bold text-[10px] bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                            PAYMENT
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Print Receipt Action */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedReceiptPayment({
                                ...p,
                                order,
                                customer: order.customer
                              });
                            }}
                            title="Print Customer Receipt"
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                          >
                            <Printer className="h-3 w-3 text-slate-500" />
                            Receipt
                          </button>

                          {/* Cancel / Reversal Action (Restricted to SHOP_OWNER & MANAGER) */}
                          {isManagerOrOwner && !isReversalEntry && (
                            <button
                              type="button"
                              onClick={() => {
                                setCancelPaymentId(p.id);
                                setCancelReason('');
                                setCancelError('');
                                setShowCancelModal(true);
                              }}
                              title="Cancel / Reverse Payment Entry"
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50/70 hover:bg-rose-100 px-2 py-1 text-[11px] font-semibold text-rose-700 transition cursor-pointer"
                            >
                              <RotateCcw className="h-3 w-3" />
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order Status History & Audit Timeline */}
      {order.auditLogs && order.auditLogs.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900">Order Timeline & History</h2>
          <div className="space-y-3">
            {order.auditLogs.map((log: any) => (
              <div
                key={log.id}
                className="flex items-start gap-3 text-xs p-3 rounded-xl bg-slate-50 border border-slate-100"
              >
                <Activity className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-bold text-slate-800">{log.action.replace(/_/g, ' ')}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {new Date(log.createdAt).toLocaleString()} • Performed by:{' '}
                    {log.user?.name || 'Staff'}
                  </div>
                  {log.details && (
                    <div className="text-[11px] text-slate-600 mt-1 font-mono bg-white p-2 rounded border border-slate-200">
                      {JSON.stringify(log.details)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status Update Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">Update Order Status</h2>
              <button
                onClick={() => setShowStatusModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {statusError && (
              <div className="mt-3 rounded-lg bg-rose-50 p-2.5 text-xs font-semibold text-rose-700 border border-rose-200 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{statusError}</span>
              </div>
            )}

            {/* Delivery Payment Notice */}
            {newStatus === 'DELIVERED' && Number(order.balanceAmount) > 0 && (
              <div className="mt-3 rounded-xl bg-amber-50 p-3 text-xs border border-amber-200 text-amber-900 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                  Outstanding Balance Notice
                </div>
                <p className="text-[11px]">
                  This order has an unpaid balance of{' '}
                  <strong className="text-rose-700 font-mono">
                    {formatCurrency(order.balanceAmount)}
                  </strong>{' '}
                  (Status: {order.paymentStatus}). You can settle the payment now or confirm delivery on credit.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowStatusModal(false);
                    setPayAmount(Number(order.balanceAmount));
                    setShowPaymentModal(true);
                  }}
                  className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-white px-2 py-1 rounded border border-amber-300 hover:bg-emerald-50 cursor-pointer"
                >
                  <CreditCard className="h-3 w-3" />
                  Record Settlement Payment First
                </button>
              </div>
            )}

            <form onSubmit={handleUpdateStatus} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700">Order Status *</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 py-2 px-3 text-xs bg-white focus:border-blue-500 focus:outline-hidden"
                >
                  <option value="RECEIVED">Received</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="TRIAL_PENDING">Trial Pending</option>
                  <option value="ALTERATION_PENDING">Alteration Pending</option>
                  <option value="READY_FOR_PICKUP">Ready for Pickup</option>
                  <option value="DELIVERED">Delivered</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700">
                  Revise Delivery Commitment Date (Optional)
                </label>
                <input
                  type="date"
                  value={revisedDate}
                  onChange={(e) => setRevisedDate(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs bg-white"
                />
              </div>

              {(revisedDate ||
                newStatus === 'ALTERATION_PENDING' ||
                newStatus === 'CANCELLED') && (
                <div>
                  <label className="block font-semibold text-slate-700">
                    Delay / Adjustment Reason *
                  </label>
                  <input
                    type="text"
                    required={Boolean(revisedDate)}
                    value={delayReason}
                    onChange={(e) => setDelayReason(e.target.value)}
                    placeholder="e.g. Imported fabric shipment delayed / Fitting adjustment needed"
                    className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs bg-white"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 mt-4">
                <button
                  type="button"
                  onClick={() => setShowStatusModal(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={statusLoading}
                  className="rounded-lg bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                >
                  {statusLoading
                    ? 'Updating...'
                    : newStatus === 'DELIVERED' && Number(order.balanceAmount) > 0
                    ? 'Confirm Delivery (On Credit)'
                    : 'Update Status'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">Record Payment</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Manual shop entry of client payment. Online gateway is not used.
                </p>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {payError && (
              <div className="mt-3 rounded-lg bg-rose-50 p-2.5 text-xs font-semibold text-rose-700 border border-rose-200 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{payError}</span>
              </div>
            )}

            <div className="mt-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs flex justify-between items-center">
              <span className="text-slate-600">Current Balance Due:</span>
              <span className="font-mono font-bold text-rose-600">
                {formatCurrency(order.balanceAmount)}
              </span>
            </div>

            <form onSubmit={handleRecordPayment} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700">Amount (₹) *</label>
                <input
                  type="number"
                  required
                  min={1}
                  max={!isRefund ? Number(order.balanceAmount) : undefined}
                  value={payAmount}
                  onChange={(e) => setPayAmount(Number(e.target.value))}
                  className="mt-1 block w-full rounded-lg border border-slate-300 py-2 px-3 text-xs font-bold font-mono text-slate-900 bg-white"
                />
                {!isRefund && (
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Maximum payable: {formatCurrency(order.balanceAmount)}
                  </span>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700">Payment Mode *</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 py-2 px-3 text-xs bg-white"
                >
                  <option value="UPI">UPI (Google Pay, PhonePe, Paytm)</option>
                  <option value="CASH">Cash at Store Desk</option>
                  <option value="CARD">Debit / Credit Card (POS swipe)</option>
                  <option value="BANK_TRANSFER">Bank Wire / IMPS / NEFT</option>
                  <option value="OTHER">Other / Cheque</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700">
                  Reference / Transaction ID (Optional)
                </label>
                <input
                  type="text"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  placeholder="e.g. UPI Ref #, POS Auth Code, Cheque #"
                  className="mt-1 block w-full rounded-lg border border-slate-300 py-2 px-3 text-xs font-mono bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700">Payment Notes (Optional)</label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="e.g. Advance deposit, trial balance settlement"
                  className="mt-1 block w-full rounded-lg border border-slate-300 py-2 px-3 text-xs bg-white"
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
                <label
                  htmlFor="refundCheck"
                  className="text-xs font-medium text-slate-700 cursor-pointer"
                >
                  This transaction is a refund to the client
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 mt-4">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={payLoading}
                  className="rounded-lg bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer shadow-md shadow-emerald-500/20"
                >
                  {payLoading ? 'Saving...' : 'Save & Print Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel / Reversal Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                  <RotateCcw className="h-4 w-4 text-rose-600" />
                  Cancel / Reverse Payment
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Reverses transaction and recalculates balance due.
                </p>
              </div>
              <button
                onClick={() => setShowCancelModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {cancelError && (
              <div className="rounded-lg bg-rose-50 p-2.5 text-xs font-semibold text-rose-700 border border-rose-200 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{cancelError}</span>
              </div>
            )}

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
              <span className="font-bold block">Double-Entry Audit Policy:</span>
              <span>
                Financial records cannot be deleted. An offsetting reversal entry will be created and logged
                in the permanent audit trail.
              </span>
            </div>

            <form onSubmit={handleCancelPayment} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700">
                  Mandatory Cancellation Reason *
                </label>
                <textarea
                  required
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Customer changed payment method / Cashier accidental duplicate entry"
                  className="mt-1 block w-full rounded-lg border border-slate-300 p-2 text-xs bg-white focus:border-rose-500 focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Discard
                </button>
                <button
                  type="submit"
                  disabled={cancelLoading}
                  className="rounded-lg bg-rose-600 px-5 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
                >
                  {cancelLoading ? 'Cancelling...' : 'Confirm Reversal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Receipt Modal */}
      <PaymentReceiptModal
        isOpen={Boolean(selectedReceiptPayment)}
        onClose={() => setSelectedReceiptPayment(null)}
        payment={selectedReceiptPayment}
      />
    </div>
  );
};
