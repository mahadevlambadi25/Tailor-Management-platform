import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { BarChart3, Download, IndianRupee, PieChart, Users, ShoppingBag } from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await api.get('/reports/analytics');
      if (res.data.success) {
        setData(res.data.data);
      }
    } catch (e) {
      console.error('Failed to load reports', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Reports & Operational Intelligence</h1>
          <p className="text-xs text-slate-500">Live data reconciled directly from PostgreSQL database records.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => window.open('/api/v1/import-export/export/CUSTOMERS', '_blank')}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-2xs"
          >
            <Download className="h-3.5 w-3.5" /> Customers CSV
          </button>
          <button
            onClick={() => window.open('/api/v1/import-export/export/ORDERS', '_blank')}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-2xs"
          >
            <Download className="h-3.5 w-3.5" /> Orders CSV
          </button>
          <button
            onClick={() => window.open('/api/v1/import-export/export/PAYMENTS', '_blank')}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-2xs"
          >
            <Download className="h-3.5 w-3.5" /> Payments CSV
          </button>
          <button
            onClick={() => window.open('/api/v1/import-export/export/APPOINTMENTS', '_blank')}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-2xs"
          >
            <Download className="h-3.5 w-3.5" /> Appointments CSV
          </button>
          <button
            onClick={() => window.open('/api/v1/import-export/export/PRODUCTION', '_blank')}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-2xs"
          >
            <Download className="h-3.5 w-3.5" /> Production CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Garment Revenue Breakdown */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 font-bold text-sm text-slate-900 border-b border-slate-100 pb-3">
            <ShoppingBag className="h-4 w-4 text-blue-600" />
            Revenue by Garment Type
          </div>

          <div className="space-y-3">
            {data?.ordersByGarment?.map((g: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div>
                  <div className="font-bold text-xs text-slate-900">{g.garmentName}</div>
                  <div className="text-[11px] text-slate-500">{g.unitsSold} units tailored</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-xs text-blue-700">?{Number(g.totalRevenue).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Methods Breakdown */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 font-bold text-sm text-slate-900 border-b border-slate-100 pb-3">
            <IndianRupee className="h-4 w-4 text-emerald-600" />
            Collection by Payment Method
          </div>

          <div className="space-y-3">
            {data?.paymentsByMethod?.map((p: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div>
                  <div className="font-bold text-xs text-slate-900">{p.paymentMethod}</div>
                  <div className="text-[11px] text-slate-500">{p._count?.id || 0} transactions</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-xs text-emerald-700">
                    ?{Number(p._sum?.amount || 0).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
