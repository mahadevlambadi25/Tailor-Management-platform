import React, { useState } from 'react';
import { api } from '../../api/client';
import { trackFunnelEvent } from '../../utils/funnel';
import { Sparkles, Trash2, UserPlus, AlertCircle, X, Check } from 'lucide-react';

interface SampleDataBannerProps {
  hasSampleData: boolean;
  onClearSampleData: () => Promise<void>;
  onAddCustomerClick: () => void;
  showFirstCustomerPrompt?: boolean;
  onDismissFirstCustomerPrompt?: () => void;
}

export const SampleDataBanner: React.FC<SampleDataBannerProps> = ({
  hasSampleData,
  onClearSampleData,
  onAddCustomerClick,
  showFirstCustomerPrompt = false,
  onDismissFirstCustomerPrompt
}) => {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [clearing, setClearing] = useState(false);

  if (!hasSampleData) return null;

  const handleClearConfirm = async () => {
    try {
      setClearing(true);
      await api.post('/conversion/sample-data/clear');
      await onClearSampleData();
      setShowConfirmModal(false);
    } catch (err) {
      console.error('Failed to clear sample data', err);
    } finally {
      setClearing(false);
    }
  };

  return (
    <>
      {/* 1. Persistent Top Sample Shop Banner */}
      <div className="w-full bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500 text-white px-3 sm:px-6 py-2.5 shadow-xs transition-all">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-4 text-center sm:text-left">
          
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <span className="flex h-6 w-6 sm:h-7 sm:w-7 rounded-lg bg-white/20 items-center justify-center shrink-0">
              <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </span>
            <p className="text-xs sm:text-sm font-semibold tracking-tight text-white leading-snug">
              This is a sample shop, so you can see how a full day looks. Add your first real customer whenever you're ready.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-center sm:justify-end">
            <button
              type="button"
              onClick={onAddCustomerClick}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-amber-900 font-bold text-xs hover:bg-amber-50 shadow-xs transition-colors"
            >
              <UserPlus className="h-3.5 w-3.5 text-amber-700" />
              <span>Add my customer</span>
            </button>
            <button
              type="button"
              onClick={() => setShowConfirmModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-700/80 hover:bg-amber-800 text-white font-bold text-xs border border-amber-400/40 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5 text-amber-200" />
              <span>Clear sample data</span>
            </button>
          </div>

        </div>
      </div>

      {/* 2. One-Time Post-First-Customer Suggestion Card */}
      {showFirstCustomerPrompt && (
        <div className="mx-3 sm:mx-6 mt-4 p-4 rounded-2xl bg-white border border-blue-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-left animate-in slide-in-from-top-2">
          <div className="flex items-start sm:items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
              <Check className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                You added your first customer! Ready to clear the sample data?
              </h4>
              <p className="text-xs text-slate-600 mt-0.5">
                Your own customer and their measurements stay completely safe. Only the demo orders and sample records will be cleared.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => setShowConfirmModal(true)}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors"
            >
              Clear sample data
            </button>
            {onDismissFirstCustomerPrompt && (
              <button
                type="button"
                onClick={onDismissFirstCustomerPrompt}
                className="px-3 py-1.5 rounded-xl text-slate-500 hover:text-slate-800 font-semibold text-xs transition-colors"
              >
                Keep it for now
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3. Clear Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-100 text-left space-y-4">
            
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
                <AlertCircle className="h-5 w-5" />
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base sm:text-lg font-bold text-slate-950">
                Clear the sample shop?
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Clear the sample shop? Your own customers and orders stay safe. Only the sample ones go.
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5 sm:justify-end">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={clearing}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearConfirm}
                disabled={clearing}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md shadow-amber-600/20 transition-all active:scale-[0.98]"
              >
                {clearing ? 'Clearing...' : 'Yes, clear sample data'}
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
};
