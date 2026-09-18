import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { CreditCard, Download, Search, CheckCircle2, IndianRupee } from 'lucide-react';

export const PaymentsPage: React.FC = () => {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const res = await api.get('/payments');
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
  }, []);

  const totalCollected = payments
    .filter((p) => !p.isRefund)
    .reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Payments & Financial Ledger</h1>
          <p className="text-xs text-slate-500">All recorded receipts, advances, balance collections, and refunds.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-right">
            <span className="text-[10px] uppercase font-bold text-emerald-700">Total Collected</span>
            <div className="text-sm font-bold text-emerald-900">?{totalCollected.toLocaleString()}</div>
          </div>
          <button
            onClick={() => window.open('/api/v1/import-export/export/ORDERS', '_blank')}
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
          >
            <Download className="h-3.5 w-3.5" /> Export Ledger
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          </div>
        ) : payments.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">No payment transactions recorded.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50 text-slate-500 font-semibold uppercase">
                <tr>
                  <th className="py-3 px-4">Receipt #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Order #</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4">Recorded Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/60">
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-700">
                      {p.receipts?.[0]?.receiptNumber || 'REC-AUTO'}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-800">
                      {p.customer?.firstName} {p.customer?.lastName}
                      <div className="text-[10px] text-slate-400">{p.customer?.mobile}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-700">
                      {p.order?.orderNumber}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-emerald-700 text-sm">
                      {p.isRefund ? `-?${Number(p.amount).toLocaleString()}` : `?${Number(p.amount).toLocaleString()}`}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                        {p.paymentMethod}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-500 text-[11px]">
                      {p.referenceNumber || 'N/A'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
