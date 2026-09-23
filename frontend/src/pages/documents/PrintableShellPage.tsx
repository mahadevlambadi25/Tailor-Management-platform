import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../../api/client';
import { formatCurrency } from '../../utils/currency';
import { Printer, ArrowLeft, Scissors, QrCode } from 'lucide-react';

export const PrintableShellPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [orderId, setOrderId] = useState(searchParams.get('orderId') || '');
  const [orders, setOrders] = useState<any[]>([]);
  const [printData, setPrintData] = useState<any>(null);
  const [docType, setDocType] = useState('JOB_CARD'); // JOB_CARD, INVOICE, RECEIPT, CUTTING_SHEET
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadOrders = async () => {
      try {
        const res = await api.get('/orders?limit=30');
        if (res.data.success && res.data.data.orders.length > 0) {
          setOrders(res.data.data.orders);
          if (!orderId) {
            setOrderId(res.data.data.orders[0].id);
          }
        }
      } catch (e) {
        console.error('Failed to load orders for print', e);
      }
    };
    loadOrders();
  }, []);

  useEffect(() => {
    if (!orderId) return;
    const fetchPrintDoc = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/documents/orders/${orderId}/print?docType=${docType}`);
        if (res.data.success) {
          setPrintData(res.data.data);
        }
      } catch (e) {
        console.error('Failed to fetch print document', e);
      } finally {
        setLoading(false);
      }
    };
    fetchPrintDoc();
  }, [orderId, docType]);

  const handlePrint = () => {
    window.print();
  };

  const order = printData?.order;

  return (
    <div className="space-y-6">
      {/* Controls Bar (Hidden during printing) */}
      <div className="print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <Link to="/orders" className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 mr-2">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Link>

          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400">Select Order</label>
            <select
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              className="text-xs font-bold text-slate-900 border border-slate-200 rounded-lg p-1.5"
            >
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.orderNumber} - {o.customer?.firstName} {o.customer?.lastName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400">Document Type</label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="text-xs font-bold text-slate-900 border border-slate-200 rounded-lg p-1.5"
            >
              <option value="JOB_CARD">Workshop Job Card</option>
              <option value="CUTTING_SHEET">Cutting Specification Sheet</option>
              <option value="MEASUREMENT_SHEET">Measurement Specification Sheet</option>
              <option value="DELIVERY_RECEIPT">Delivery & Handover Receipt</option>
              <option value="RECEIPT">Customer Payment Receipt</option>
              <option value="INVOICE">Tax Invoice (GST Format)</option>
            </select>
          </div>
        </div>

        <button
          onClick={handlePrint}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-md shadow-blue-500/20"
        >
          <Printer className="h-4 w-4" /> Print Document
        </button>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      ) : !order ? (
        <div className="p-8 text-center text-slate-500">Document not available.</div>
      ) : (
        /* Printable Shell Container */
        <div className="mx-auto max-w-3xl rounded-2xl border border-slate-300 bg-white p-8 shadow-sm print:m-0 print:max-w-none print:border-none print:p-4 text-slate-900">
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Scissors className="h-6 w-6 text-blue-700" />
                <h1 className="text-2xl font-bold tracking-tight">{order.tenant?.name || 'Royal Bespoke Tailors'}</h1>
              </div>
              <p className="text-xs text-slate-600 mt-1">{order.tenant?.address}, {order.tenant?.city}</p>
              <p className="text-xs text-slate-600">Phone: {order.tenant?.phone} • GSTIN: {order.tenant?.gstNumber || '29ABCDE1234F1Z5'}</p>
            </div>

            <div className="text-right flex flex-col items-end">
              {printData?.qrDataUrl && (
                <img src={printData.qrDataUrl} alt="Order QR" className="h-20 w-20 object-contain border border-slate-200 p-1 mb-1" />
              )}
              <span className="font-mono font-bold text-xs uppercase tracking-wider">{docType.replace(/_/g, ' ')}</span>
              <span className="font-mono font-bold text-sm text-blue-700">{order.orderNumber}</span>
            </div>
          </div>

          {/* Customer & Order Metadata */}
          <div className="grid grid-cols-2 gap-4 py-4 border-b border-slate-200 text-xs">
            <div>
              <span className="font-bold text-slate-500 uppercase text-[10px]">Client Details:</span>
              <div className="font-bold text-sm text-slate-900 mt-0.5">{order.customer?.firstName} {order.customer?.lastName}</div>
              <div className="text-slate-600">Mobile: {order.customer?.mobile}</div>
              <div className="text-slate-600">{order.customer?.address}</div>
            </div>

            <div className="text-right space-y-1">
              <div><span className="text-slate-500">Order Date:</span> <span className="font-bold">{new Date(order.createdAt).toLocaleDateString()}</span></div>
              <div><span className="text-slate-500">Delivery Due:</span> <span className="font-bold text-blue-900">{new Date(order.deliveryDate).toLocaleDateString()}</span></div>
              <div><span className="text-slate-500">Status:</span> <span className="font-bold uppercase">{order.status}</span></div>
            </div>
          </div>

          {/* Garment Items & Snapshots */}
          <div className="py-4 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Garment Specifications & Historical Measurements
            </h3>

            <div className="space-y-3">
              {order.items?.map((item: any, idx: number) => (
                <div key={item.id} className="rounded-lg border border-slate-200 p-3 text-xs space-y-2">
                  <div className="flex justify-between font-bold text-slate-900 border-b border-slate-100 pb-1">
                    <span>{idx + 1}. {item.garmentType?.name} (Qty: {item.quantity})</span>
                    <span>{formatCurrency(item.totalItemPrice)}</span>
                  </div>

                  {item.measurementSnapshot && (
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase">
                        Measurement Snapshot ({item.measurementSnapshot.unit}):
                      </span>
                      <div className="grid grid-cols-6 gap-1 mt-1 text-center font-mono">
                        {Object.entries(item.measurementSnapshot.valuesSnapshot || {}).map(([k, v]: any) => (
                          <div key={k} className="p-1 rounded bg-slate-50 border border-slate-100">
                            <div className="text-[9px] text-slate-400">{k}</div>
                            <div className="text-xs font-bold">{String(v)}"</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {item.internalNotes && (
                    <div className="text-[10px] text-slate-500 italic">Notes: {item.internalNotes}</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Financial Summary */}
          <div className="border-t-2 border-slate-900 pt-4 flex justify-end">
            <div className="w-64 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-600">Total Garments:</span>
                <span className="font-bold">{formatCurrency(order.totalAmount)}</span>
              </div>
              {Number(order.discountAmount) > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>Discount:</span>
                  <span className="font-bold">-{formatCurrency(order.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-200 pt-1 font-bold text-sm">
                <span>Net Total:</span>
                <span>{formatCurrency(order.netAmount)}</span>
              </div>
              <div className="flex justify-between text-emerald-700 font-semibold">
                <span>Paid / Advance:</span>
                <span>{formatCurrency(order.paidAmount)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-900 pt-1 font-bold text-sm text-rose-600">
                <span>Remaining Balance:</span>
                <span>{formatCurrency(order.balanceAmount)}</span>
              </div>
            </div>
          </div>

          {/* Handover & Delivery Acknowledgment (Visible on Delivery Receipts) */}
          {docType === 'DELIVERY_RECEIPT' && (
            <div className="mt-6 pt-4 border-t border-dashed border-slate-300 text-xs">
              <p className="font-semibold text-slate-700 mb-6">
                Handover Acknowledgment: I confirm that I have inspected and tried on the tailored garments above and received them in satisfactory condition.
              </p>
              <div className="grid grid-cols-2 gap-8 text-center pt-8">
                <div className="border-t border-slate-400 pt-1 text-slate-600 font-medium">Customer Signature & Date</div>
                <div className="border-t border-slate-400 pt-1 text-slate-600 font-medium">Store Staff Sign-Off</div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-8 pt-4 border-t border-slate-200 text-center text-[10px] text-slate-400">
            Thank you for choosing {order.tenant?.name || 'Royal Bespoke Tailors'}. Please present this job card / receipt during fitting or trial pickups.
          </div>
        </div>
      )}
    </div>
  );
};
