import React from 'react';
import { formatCurrency } from '../../utils/currency';
import { Printer, X, CheckCircle2, ShieldCheck, Scissors } from 'lucide-react';

interface ReceiptProps {
  isOpen: boolean;
  onClose: () => void;
  payment: {
    id: string;
    amount: number;
    paymentMethod: string;
    referenceNumber?: string | null;
    notes?: string | null;
    isRefund?: boolean;
    isCorrection?: boolean;
    createdAt: string;
    receipts?: Array<{ receiptNumber: string }>;
    recordedBy?: { name: string; role: string } | null;
    order?: {
      id: string;
      orderNumber: string;
      totalAmount: number;
      discountAmount?: number;
      gstAmount?: number;
      netAmount: number;
      paidAmount: number;
      balanceAmount: number;
      paymentStatus: string;
    };
    customer?: {
      firstName: string;
      lastName: string;
      mobile: string;
      email?: string | null;
      address?: string | null;
      city?: string | null;
    };
  } | null;
  shopInfo?: {
    name?: string;
    address?: string;
    phone?: string;
    gstin?: string;
  };
}

export const PaymentReceiptModal: React.FC<ReceiptProps> = ({
  isOpen,
  onClose,
  payment,
  shopInfo = {
    name: 'Bespoke Couture Tailoring Studio',
    address: '100 Feet Road, Indiranagar, Bangalore - 560038',
    phone: '+91 98765 43210',
    gstin: '29ABCDE1234F1Z5'
  }
}) => {
  if (!isOpen || !payment) return null;

  const receiptNumber =
    payment.receipts?.[0]?.receiptNumber || `REC-${payment.id.substring(0, 8).toUpperCase()}`;

  const handlePrint = () => {
    window.print();
  };

  const isReversal = payment.isRefund || payment.isCorrection;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-receipt, #printable-receipt * {
            visibility: visible;
          }
          #printable-receipt {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 20px;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl overflow-hidden my-6">
        {/* Modal Top Actions (Hidden on Print) */}
        <div className="no-print flex items-center justify-between px-6 py-3 bg-slate-800 text-white">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            Official Financial Receipt
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-500 transition shadow-xs cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
              Print Receipt
            </button>
            <button
              onClick={onClose}
              type="button"
              className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 transition cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Container */}
        <div id="printable-receipt" className="p-8 text-slate-800 font-sans space-y-6 bg-white">
          {/* Studio Header */}
          <div className="text-center border-b border-slate-200 pb-5">
            <div className="inline-flex items-center justify-center gap-2 mb-1">
              <Scissors className="h-5 w-5 text-slate-900" />
              <h1 className="text-xl font-extrabold uppercase tracking-widest text-slate-900">
                {shopInfo.name}
              </h1>
            </div>
            <p className="text-xs text-slate-500 font-medium">{shopInfo.address}</p>
            <p className="text-xs text-slate-500 font-medium">
              Phone: {shopInfo.phone} {shopInfo.gstin ? `• GSTIN: ${shopInfo.gstin}` : ''}
            </p>
            <div className="mt-3">
              <span className={`inline-block px-3 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase border ${
                isReversal
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
              }`}>
                {isReversal ? 'Payment Reversal / Refund Voucher' : 'Payment Acknowledgment Receipt'}
              </span>
            </div>
          </div>

          {/* Receipt Meta & Order Reference */}
          <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
            <div>
              <div className="text-slate-400 font-semibold uppercase text-[10px]">Receipt Number</div>
              <div className="font-mono font-bold text-slate-900 text-sm">{receiptNumber}</div>
              <div className="text-slate-400 font-semibold uppercase text-[10px] mt-2">Date & Time</div>
              <div className="text-slate-700 font-medium">
                {new Date(payment.createdAt).toLocaleString('en-IN', {
                  dateStyle: 'medium',
                  timeStyle: 'short'
                })}
              </div>
            </div>
            <div className="text-right">
              <div className="text-slate-400 font-semibold uppercase text-[10px]">Order Number</div>
              <div className="font-mono font-bold text-blue-700 text-sm">
                {payment.order?.orderNumber || 'N/A'}
              </div>
              <div className="text-slate-400 font-semibold uppercase text-[10px] mt-2">Payment Status</div>
              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                payment.order?.paymentStatus === 'FULLY_PAID'
                  ? 'bg-emerald-100 text-emerald-800'
                  : payment.order?.paymentStatus === 'PARTIALLY_PAID'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-rose-100 text-rose-800'
              }`}>
                {payment.order?.paymentStatus || 'RECORDED'}
              </span>
            </div>
          </div>

          {/* Customer Details */}
          <div className="border border-slate-200 rounded-xl p-3.5 text-xs space-y-1">
            <div className="text-slate-400 font-semibold uppercase text-[10px] mb-1">Received From (Customer)</div>
            <div className="font-bold text-slate-900 text-sm">
              {payment.customer?.firstName} {payment.customer?.lastName}
            </div>
            <div className="text-slate-600 flex items-center gap-4">
              <span>Mobile: <strong className="text-slate-800">{payment.customer?.mobile}</strong></span>
              {payment.customer?.email && <span>Email: {payment.customer.email}</span>}
            </div>
            {payment.customer?.address && (
              <div className="text-slate-500 text-[11px]">{payment.customer.address}</div>
            )}
          </div>

          {/* Transaction Summary Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
            <div className="bg-slate-100 px-4 py-2 font-bold text-slate-700 border-b border-slate-200 uppercase text-[10px] tracking-wider">
              Transaction Details
            </div>
            <div className="p-4 space-y-2">
              <div className="flex justify-between items-center text-sm py-1 border-b border-slate-100">
                <span className="font-semibold text-slate-600">Amount Received:</span>
                <span className={`font-mono font-extrabold text-base ${isReversal ? 'text-rose-600' : 'text-emerald-700'}`}>
                  {formatCurrency(payment.amount)}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs py-1">
                <span className="text-slate-500">Payment Mode:</span>
                <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                  {payment.paymentMethod}
                </span>
              </div>
              {payment.referenceNumber && (
                <div className="flex justify-between items-center text-xs py-1">
                  <span className="text-slate-500">Reference / Txn ID:</span>
                  <span className="font-mono text-slate-700 font-semibold">{payment.referenceNumber}</span>
                </div>
              )}
              {payment.notes && (
                <div className="flex justify-between items-start text-xs py-1">
                  <span className="text-slate-500">Notes / Remarks:</span>
                  <span className="text-slate-700 italic max-w-[280px] text-right">{payment.notes}</span>
                </div>
              )}
            </div>
          </div>

          {/* Cumulative Order Balance Statement */}
          {payment.order && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-2">
              <div className="font-bold text-slate-700 uppercase text-[10px] tracking-wider border-b border-slate-200 pb-1.5">
                Cumulative Order Statement
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Final Order Amount:</span>
                <span className="font-semibold text-slate-800 font-mono">
                  {formatCurrency(payment.order.netAmount)}
                </span>
              </div>
              <div className="flex justify-between text-emerald-700">
                <span>Total Amount Paid to Date:</span>
                <span className="font-bold font-mono">
                  {formatCurrency(payment.order.paidAmount)}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-200 text-sm font-bold">
                <span className="text-slate-800">Remaining Balance Due:</span>
                <span className={`font-mono ${Number(payment.order.balanceAmount) > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                  {Number(payment.order.balanceAmount) > 0
                    ? formatCurrency(payment.order.balanceAmount)
                    : '₹0.00 (Fully Settled)'}
                </span>
              </div>
            </div>
          )}

          {/* Signatures & Footer */}
          <div className="pt-8 border-t border-slate-200 grid grid-cols-2 gap-8 text-xs text-center">
            <div>
              <div className="text-slate-800 font-bold">
                {payment.recordedBy?.name || 'Authorized Cashier'}
              </div>
              <div className="text-[10px] text-slate-500 uppercase">Received By (Staff)</div>
            </div>
            <div>
              <div className="h-6 border-b border-dashed border-slate-400 w-36 mx-auto mb-1"></div>
              <div className="text-[10px] text-slate-500 uppercase">Authorized Signatory</div>
            </div>
          </div>

          <div className="text-[10px] text-center text-slate-400 pt-2">
            * This is a computer-generated receipt issued at the store desk. Payments are manual records entered by authorized staff.
          </div>
        </div>

        {/* Modal Bottom Actions (Hidden on Print) */}
        <div className="no-print bg-slate-50 border-t border-slate-200 px-6 py-3 flex justify-between items-center">
          <span className="text-[11px] text-slate-500">
            Press <strong>Ctrl+P</strong> or click <strong>Print</strong> for standard A4 / thermal voucher.
          </span>
          <button
            onClick={onClose}
            type="button"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
