import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { formatCurrency } from '../../utils/currency';
import { PaymentReceiptModal } from '../../components/payments/PaymentReceiptModal';
import {
  CreditCard,
  Download,
  Search,
  CheckCircle2,
  IndianRupee,
  Printer,
  X,
  Filter,
  RefreshCw,
  ArrowUpRight,
  ShieldCheck,
  RotateCcw
} from 'lucide-react';

export const PaymentsPage: React.FC = () => {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('ALL');

  // Receipt Modal State
  const [selectedReceiptPayment, setSelectedReceiptPayment] = useState<any | null>(null);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search.trim()) params.append('search', search.trim());
      if (selectedMethod !== 'ALL') params.append('paymentMethod', selectedMethod);

      const res = await api.get(`/payments?${params.toString()}`);
      if (res.data.success) {
        setPayments(res.data.data);
      }
    } catch (e) {
      console.error('Failed to load payments', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [selectedMethod]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPayments();
  };

  // Metrics calculation
  const totalCollected = useMemo(() => {
    return payments
      .filter((p) => !p.isRefund)
      .reduce((sum, p) => sum + Number(p.amount), 0);
  }, [payments]);

  const cashCollected = useMemo(() => {
    return payments
      .filter((p) => !p.isRefund && p.paymentMethod === 'CASH')
      .reduce((sum, p) => sum + Number(p.amount), 0);
  }, [payments]);

  const upiCollected = useMemo(() => {
    return payments
      .filter((p) => !p.isRefund && p.paymentMethod === 'UPI')
      .reduce((sum, p) => sum + Number(p.amount), 0);
  }, [payments]);

  const cardAndOtherCollected = useMemo(() => {
    return payments
      .filter((p) => !p.isRefund && p.paymentMethod !== 'CASH' && p.paymentMethod !== 'UPI')
      .reduce((sum, p) => sum + Number(p.amount), 0);
  }, [payments]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Payments & Financial Ledger</h1>
          <p className="text-xs text-slate-500">
            Manual store desk entries of advances, installments, full settlements, and audit reversals.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchPayments()}
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-2xs transition cursor-pointer"
            title="Refresh Ledger"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => window.open('/api/v1/import-export/export/ORDERS', '_blank')}
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" /> Export Ledger
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-emerald-700 tracking-wider">
            Total Net Collected
          </span>
          <div className="text-xl font-extrabold text-emerald-950 mt-1 font-mono">
            {formatCurrency(totalCollected)}
          </div>
          <span className="text-[10px] text-emerald-700 font-medium">
            {payments.filter((p) => !p.isRefund).length} successful collections
          </span>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4 shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-blue-700 tracking-wider">
            UPI / QR Collections
          </span>
          <div className="text-xl font-extrabold text-blue-950 mt-1 font-mono">
            {formatCurrency(upiCollected)}
          </div>
          <span className="text-[10px] text-blue-700 font-medium">GooglePay, PhonePe, Paytm</span>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-amber-700 tracking-wider">
            Cash at Store Desk
          </span>
          <div className="text-xl font-extrabold text-amber-950 mt-1 font-mono">
            {formatCurrency(cashCollected)}
          </div>
          <span className="text-[10px] text-amber-700 font-medium">Hand cash reconciliations</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
            Card & Bank Transfer
          </span>
          <div className="text-xl font-extrabold text-slate-900 mt-1 font-mono">
            {formatCurrency(cardAndOtherCollected)}
          </div>
          <span className="text-[10px] text-slate-500 font-medium">POS Swipe & Wire Transfers</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Receipt #, Order #, Customer Name, Mobile, Reference #..."
              className="w-full rounded-xl border border-slate-200 pl-9 pr-8 py-2 text-xs focus:border-blue-500 focus:outline-hidden"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  fetchPayments();
                }}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedMethod}
              onChange={(e) => setSelectedMethod(e.target.value)}
              className="rounded-xl border border-slate-200 py-2 px-3 text-xs bg-white text-slate-700 focus:border-blue-500 focus:outline-hidden"
            >
              <option value="ALL">All Payment Methods</option>
              <option value="UPI">UPI (QR Code / Apps)</option>
              <option value="CASH">Cash</option>
              <option value="CARD">Debit / Credit Card</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="OTHER">Other / Cheque</option>
            </select>

            <button
              type="submit"
              className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition cursor-pointer shadow-xs"
            >
              Search
            </button>
          </div>
        </form>
      </div>

      {/* Transactions Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          </div>
        ) : payments.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No payment transactions match the filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Receipt #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Order #</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4">Recorded By</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p) => {
                  const receiptNo =
                    p.receipts?.[0]?.receiptNumber || `REC-${p.id.substring(0, 8).toUpperCase()}`;

                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-slate-50/60 ${
                        p.isCorrection && !p.isRefund ? 'opacity-60 bg-slate-50/30' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-blue-700">
                        {receiptNo}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-800">
                        {p.customer ? (
                          <Link
                            to={`/customers/${p.customer.id}`}
                            className="hover:text-blue-600 hover:underline"
                          >
                            {p.customer.firstName} {p.customer.lastName}
                          </Link>
                        ) : (
                          'Store Client'
                        )}
                        <div className="text-[10px] text-slate-400 font-normal">
                          {p.customer?.mobile}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {p.order ? (
                          <Link
                            to={`/orders/${p.order.id}`}
                            className="font-mono font-semibold text-slate-700 hover:text-blue-600 hover:underline flex items-center gap-1"
                          >
                            <span>{p.order.orderNumber}</span>
                            <ArrowUpRight className="h-3 w-3 text-slate-400" />
                          </Link>
                        ) : (
                          <span className="font-mono text-slate-400">N/A</span>
                        )}
                      </td>
                      <td
                        className={`py-3.5 px-4 font-bold font-mono text-sm ${
                          p.isRefund ? 'text-rose-600' : 'text-emerald-700'
                        }`}
                      >
                        {formatCurrency(p.isRefund ? -Number(p.amount) : Number(p.amount))}
                        {p.isRefund && (
                          <span className="ml-1 text-[9px] font-bold text-rose-600 bg-rose-50 px-1 py-0.2 rounded border border-rose-200 uppercase">
                            Reversal
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                          {p.paymentMethod}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-500 text-[11px]">
                        {p.referenceNumber || '-'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {p.recordedBy?.name || 'Staff'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {new Date(p.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedReceiptPayment(p)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs cursor-pointer"
                        >
                          <Printer className="h-3 w-3 text-slate-500" />
                          Print
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Printable Receipt Modal */}
      <PaymentReceiptModal
        isOpen={Boolean(selectedReceiptPayment)}
        onClose={() => setSelectedReceiptPayment(null)}
        payment={selectedReceiptPayment}
      />
    </div>
  );
};
