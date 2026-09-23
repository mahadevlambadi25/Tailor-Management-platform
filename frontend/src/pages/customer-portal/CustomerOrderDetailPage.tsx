import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../api/client';
import { formatCurrency } from '../../utils/currency';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Package,
  Ruler,
  CheckCircle2,
  AlertCircle,
  Scissors,
  IndianRupee,
  FileText,
  ShieldCheck
} from 'lucide-react';

export const CustomerOrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrderDetail = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/portal/orders/${id}`);
      if (res.data.success) {
        setOrder(res.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load order details. Please verify your access.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderDetail();
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-semibold text-slate-500">Loading order progress and garments...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="space-y-4">
        <Link
          to="/portal/orders"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Orders
        </Link>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center space-y-3">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto" />
          <h3 className="font-bold text-sm text-red-900">{error || 'Order not found.'}</h3>
        </div>
      </div>
    );
  }

  const { orderNumber, createdAt, deliveryDate, friendlyStatus, customerNotes, billing, items } = order;

  const timelineSteps = [
    { index: 1, key: 'ORDER_RECEIVED', label: 'Order Confirmed' },
    { index: 2, key: 'CUTTING', label: 'Cutting & Drafting' },
    { index: 3, key: 'STITCHING', label: 'Tailoring & Assembly' },
    { index: 4, key: 'TRIAL', label: 'Fitting Trial' },
    { index: 5, key: 'ALTERATION', label: 'Alterations' },
    { index: 6, key: 'READY', label: 'Ready for Pickup' },
    { index: 7, key: 'DELIVERED', label: 'Delivered' }
  ];

  const currentStep = friendlyStatus?.stepIndex || 1;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* ------------------------------------------------------------- */}
      {/* Back Link & Order Heading                                     */}
      {/* ------------------------------------------------------------- */}
      <div className="space-y-3">
        <Link
          to="/portal/orders"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition"
        >
          <ArrowLeft className="h-4 w-4" /> Back to My Orders
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">{orderNumber}</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                {friendlyStatus?.title || 'Order Confirmed'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Booked on {new Date(createdAt).toLocaleDateString()}
            </p>
          </div>

          <div className="text-left sm:text-right">
            <span className="text-xs text-slate-400 block font-medium">Promised Delivery Date</span>
            <span className="text-sm sm:text-base font-extrabold text-amber-700 flex items-center gap-1 sm:justify-end">
              <Calendar className="h-4 w-4" />
              {new Date(deliveryDate).toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })}
            </span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Visual 7-Stage Progress Stepper                               */}
      {/* ------------------------------------------------------------- */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-100 pb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-blue-600" /> Live Workshop Progress
          </h2>
          <span className="text-xs text-slate-400 font-medium">
            Stage {currentStep > 0 ? currentStep : 1} of 7
          </span>
        </div>

        {/* Stepper Graphic */}
        <div className="overflow-x-auto pb-4">
          <div className="min-w-[620px] px-4">
            <div className="relative flex items-center justify-between">
              {/* Connecting background bar */}
              <div className="absolute top-4 left-4 right-4 h-1 bg-slate-200 z-0" />
              {/* Active filled connecting bar */}
              <div
                className="absolute top-4 left-4 h-1 bg-blue-600 z-0 transition-all duration-500"
                style={{
                  width: `${Math.max(0, Math.min(100, ((currentStep - 1) / (timelineSteps.length - 1)) * 100))}%`
                }}
              />

              {timelineSteps.map((step) => {
                const isComplete = currentStep > step.index;
                const isCurrent = currentStep === step.index;

                return (
                  <div key={step.key} className="relative z-10 flex flex-col items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition ${
                        isComplete
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : isCurrent
                          ? 'bg-amber-500 text-white ring-4 ring-amber-100 animate-pulse'
                          : 'bg-white text-slate-400 border-2 border-slate-300'
                      }`}
                    >
                      {isComplete ? <CheckCircle2 className="h-4 w-4" /> : step.index}
                    </div>
                    <span
                      className={`text-[11px] font-bold text-center mt-2 max-w-[80px] leading-tight ${
                        isCurrent
                          ? 'text-amber-700'
                          : isComplete
                          ? 'text-slate-800'
                          : 'text-slate-400'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Stage Status Description */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-600 flex items-start gap-2.5">
          <Scissors className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-slate-900 block">{friendlyStatus?.title}</span>
            <span>{friendlyStatus?.description}</span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Garments & Custom Styling Section                             */}
      {/* ------------------------------------------------------------- */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5 border-b border-slate-100 pb-3">
          <Package className="h-4 w-4 text-indigo-600" /> Garments in this Order ({items?.length || 0})
        </h2>

        <div className="space-y-4">
          {items?.map((item: any) => (
            <div
              key={item.id}
              className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200/60 pb-2.5 gap-2">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">{item.garmentName}</h3>
                  <span className="text-[11px] text-slate-400">{item.category} • Item #{item.itemNumber}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-500 font-medium">Quantity: {item.quantity}</span>
                  <span className="font-extrabold text-sm text-slate-900 ml-3">{formatCurrency(item.totalPrice)}</span>
                </div>
              </div>

              {/* Selected Styles & Options */}
              {item.styles && item.styles.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Custom Styling Options
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {item.styles.map((s: any, sIdx: number) => (
                      <span
                        key={sIdx}
                        className="px-2.5 py-1 rounded-md bg-white border border-slate-200 text-xs text-slate-700 font-medium"
                      >
                        <strong className="text-slate-900">{s.styleName}</strong>
                        {s.options && Object.keys(s.options).length > 0 && (
                          <span className="text-slate-500 ml-1">
                            ({Object.entries(s.options).map(([k, v]) => `${k}: ${v}`).join(', ')})
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Historical Measurement Snapshot */}
              {item.measurementSnapshot?.values && Object.keys(item.measurementSnapshot.values).length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <Ruler className="h-3 w-3 text-indigo-600" />
                    <span>Calibrated Measurements Snapshot ({item.measurementSnapshot.unit})</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                    {Object.entries(item.measurementSnapshot.values).map(([key, val]) => (
                      <div key={key} className="p-2 rounded-lg bg-white border border-slate-200/80 text-center">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block truncate">{key}</span>
                        <span className="text-xs font-extrabold text-slate-800">{String(val)}"</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Customer Remarks */}
              {item.customerNotes && (
                <div className="text-xs text-slate-600 bg-amber-50/60 p-2.5 rounded-lg border border-amber-200/60">
                  <strong className="text-amber-900">Custom Request:</strong> "{item.customerNotes}"
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Financial & In-Store Payment Ledger Summary                   */}
      {/* ------------------------------------------------------------- */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
            <IndianRupee className="h-4 w-4 text-emerald-600" /> Billing & Payment Ledger
          </h2>
          <span
            className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
              billing?.paymentStatus === 'PAID'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}
          >
            {billing?.paymentStatus === 'PAID' ? 'Fully Paid' : 'Balance Pending'}
          </span>
        </div>

        {/* Calculation Table */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2 text-xs">
          <div className="flex justify-between text-slate-600">
            <span>Gross Order Amount:</span>
            <span className="font-semibold text-slate-800">{formatCurrency(billing?.grossAmount || 0)}</span>
          </div>
          {billing?.discountAmount > 0 && (
            <div className="flex justify-between text-emerald-700">
              <span>Applied Discount:</span>
              <span className="font-semibold">- {formatCurrency(billing.discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-200">
            <span>Net Order Total:</span>
            <span>{formatCurrency(billing?.netAmount || 0)}</span>
          </div>
          <div className="flex justify-between text-emerald-700">
            <span>Total Payments Recorded:</span>
            <span className="font-bold">{formatCurrency(billing?.paidAmount || 0)}</span>
          </div>
          <div className="flex justify-between text-sm font-extrabold pt-2 border-t border-slate-200">
            <span className={billing?.balanceAmount > 0 ? 'text-amber-800' : 'text-slate-900'}>
              Balance Due at Collection:
            </span>
            <span className={billing?.balanceAmount > 0 ? 'text-amber-700' : 'text-emerald-700'}>
              {formatCurrency(billing?.balanceAmount || 0)}
            </span>
          </div>
        </div>

        {/* In-Store Notice Banner */}
        <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-100 text-xs text-blue-900 flex items-start gap-2">
          <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block">In-Store Manual Payment Record</span>
            <span className="text-[11px] text-blue-800">
              Payments are recorded manually by atelier desk staff. We accept Cash, UPI, or Card at your fitting session or garment pickup.
            </span>
          </div>
        </div>

        {/* Payment History Receipts */}
        {billing?.payments && billing.payments.length > 0 && (
          <div className="space-y-2 pt-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Payment Receipts On File ({billing.payments.length})
            </span>
            <div className="space-y-2">
              {billing.payments.map((p: any) => (
                <div
                  key={p.id}
                  className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-slate-400" />
                    <div>
                      <span className="font-bold text-slate-900">
                        {p.receiptNumber ? `Receipt #${p.receiptNumber}` : 'In-Store Payment'}
                      </span>
                      <span className="text-[11px] text-slate-400 ml-2">
                        via {p.method} • {new Date(p.date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <span className="font-extrabold text-sm text-emerald-700">{formatCurrency(p.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default CustomerOrderDetailPage;
