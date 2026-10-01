import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import {
  TrendingUp,
  Users,
  Filter,
  RefreshCw,
  ArrowRight,
  ShieldAlert,
  BarChart3
} from 'lucide-react';

interface FunnelStep {
  key: string;
  label: string;
  count: number;
  overallConversionPercentage: number;
  stepConversionPercentage: number;
}

interface FunnelData {
  totalShopsTracked: number;
  steps: FunnelStep[];
  filterApplied: string;
}

export const AdminFunnelPage: React.FC = () => {
  const [funnelData, setFunnelData] = useState<FunnelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weekFilter, setWeekFilter] = useState<string>('');

  const fetchFunnel = async (filter?: string) => {
    try {
      setLoading(true);
      setError(null);
      const url = filter ? `/conversion/admin/funnel?weekFilter=${encodeURIComponent(filter)}` : '/conversion/admin/funnel';
      const res = await api.get(url);
      if (res.data?.success) {
        setFunnelData(res.data.data);
      } else {
        setError(res.data?.error?.message || 'Failed to load funnel telemetry');
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Access denied or server error loading admin funnel.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFunnel();
  }, []);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setWeekFilter(e.target.value);
    fetchFunnel(e.target.value);
  };

  const handleResetFilter = () => {
    setWeekFilter('');
    fetchFunnel('');
  };

  if (error) {
    return (
      <div className="max-w-4xl mx-auto my-12 p-8 rounded-2xl bg-white border border-rose-200 shadow-sm text-center space-y-4">
        <div className="h-12 w-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Admin Telemetry Unavailable</h2>
        <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">{error}</p>
        <button
          onClick={() => fetchFunnel(weekFilter)}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-[11px] font-bold">
            <BarChart3 className="h-3 w-3" />
            <span>Super-Admin Telemetry</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1">
            Conversion Funnel Analysis
          </h1>
          <p className="text-xs text-slate-500">
            Real-time step progression across all onboarding, aha moment, and subscription upgrade stages.
          </p>
        </div>

        {/* Filter Bar */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-2xs text-xs">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <input
              type="date"
              value={weekFilter}
              onChange={handleFilterChange}
              className="outline-none text-slate-700 font-medium"
              title="Filter by signup week"
            />
          </div>
          {weekFilter && (
            <button
              onClick={handleResetFilter}
              className="text-xs text-slate-500 hover:text-slate-800 underline font-semibold"
            >
              Reset
            </button>
          )}
          <button
            onClick={() => fetchFunnel(weekFilter)}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition"
            title="Refresh funnel"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Registered Shops</span>
          <div className="mt-1 text-2xl font-black text-slate-900">
            {funnelData?.totalShopsTracked ?? 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">All tenant ateliers tracked</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Aha Reached</span>
          <div className="mt-1 text-2xl font-black text-blue-600">
            {funnelData?.steps.find(s => s.key === 'aha_reached')?.count ?? 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">First order WhatsApp update previewed</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Paid Subscribers</span>
          <div className="mt-1 text-2xl font-black text-emerald-600">
            {funnelData?.steps.find(s => s.key === 'payment_succeeded')?.count ?? 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Successfully converted shops</div>
        </div>
      </div>

      {/* Funnel Steps Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">Conversion Funnel Progression</h2>
          <span className="text-xs text-slate-400">
            Filter: {funnelData?.filterApplied === 'all_time' ? 'All time' : `Week starting ${funnelData?.filterApplied}`}
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500 space-y-2">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto text-blue-600" />
            <p>Aggregating funnel events...</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {funnelData?.steps.map((step, index) => {
              const barWidth = Math.max(step.overallConversionPercentage, 4);
              return (
                <div key={step.key} className="p-4 sm:p-5 hover:bg-slate-50/70 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-bold text-slate-800">{step.label}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
                        {step.key}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-semibold">
                      <div>
                        <span className="text-slate-400 font-normal">Count: </span>
                        <span className="text-slate-900 font-extrabold">{step.count}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-normal">Overall: </span>
                        <span className="text-blue-700 font-extrabold">{step.overallConversionPercentage}%</span>
                      </div>
                      {index > 0 && (
                        <div>
                          <span className="text-slate-400 font-normal">Step-to-step: </span>
                          <span className="text-emerald-700 font-extrabold">{step.stepConversionPercentage}%</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Visual Bar */}
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
