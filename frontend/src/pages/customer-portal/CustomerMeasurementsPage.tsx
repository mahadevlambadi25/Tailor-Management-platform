import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';
import {
  Ruler,
  CheckCircle2,
  AlertCircle,
  Calendar,
  ShieldCheck,
  Scissors
} from 'lucide-react';

export const CustomerMeasurementsPage: React.FC = () => {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMeasurements = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/portal/measurements');
      if (res.data.success) {
        setProfiles(res.data.data?.fitProfiles || []);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load measurement profiles.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeasurements();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs text-slate-500 font-medium">Loading your verified fit profiles...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center space-y-3">
        <AlertCircle className="h-8 w-8 text-red-500 mx-auto" />
        <h3 className="font-bold text-sm text-red-900">{error}</h3>
        <button
          onClick={fetchMeasurements}
          className="px-4 py-1.5 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* ------------------------------------------------------------- */}
      {/* Page Header                                                   */}
      {/* ------------------------------------------------------------- */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <Ruler className="h-6 w-6 text-indigo-600" />
          Master Fit Profiles
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Hand-calibrated dimensions recorded and verified by our master cutting craftsmen.
        </p>
      </div>

      {/* Notice Banner */}
      <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-900 flex items-start gap-2.5">
        <ShieldCheck className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold block">Certified Master Dimensions (Read-Only)</span>
          <span className="text-[11px] text-indigo-800">
            These measurements represent your approved anatomical fit calibrated for drafting. To make adjustments for changes in posture or fit preferences, please visit the atelier during your next trial session.
          </span>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Fit Profile Cards                                             */}
      {/* ------------------------------------------------------------- */}
      {profiles.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center space-y-3 shadow-2xs">
          <Scissors className="h-12 w-12 text-slate-300 mx-auto" />
          <h3 className="font-bold text-base text-slate-800">No Fit Profiles On Record</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Your body measurements have not yet been recorded. During your first atelier consultation or order booking, the master cutter will establish your verified fit profile.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {profiles.map((profile) => (
            <div
              key={profile.id}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center font-bold text-indigo-700">
                    <Ruler className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">{profile.garmentName}</h3>
                    <span className="text-[11px] text-slate-400">
                      {profile.category} • Calibrated in {profile.unit}
                    </span>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>Approved</span>
                </span>
              </div>

              {/* Dimensions Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {Object.entries(profile.values || {}).map(([key, val]) => (
                  <div
                    key={key}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-100/80 text-center"
                  >
                    <span className="text-[10px] text-slate-400 font-bold uppercase block truncate">
                      {key}
                    </span>
                    <span className="text-base font-extrabold text-slate-900 mt-0.5 block">
                      {String(val)}"
                    </span>
                  </div>
                ))}
              </div>

              <div className="text-[11px] text-slate-400 text-right pt-1">
                Last updated on {new Date(profile.updatedAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
export default CustomerMeasurementsPage;
