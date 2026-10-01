import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '../../context/TenantContext';
import { api } from '../../api/client';
import { trackFunnelEvent } from '../../utils/funnel';
import { AlertCircle, Lock, ArrowRight, X, Sparkles } from 'lucide-react';
import { Modal } from '../common/Modal';

export const ExpiredTrialBanner: React.FC = () => {
  const navigate = useNavigate();
  const { subscription } = useTenant();
  const [counts, setCounts] = useState<{ customers: number; orders: number }>({ customers: 0, orders: 0 });
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [blockedActionMessage, setBlockedActionMessage] = useState<string | null>(null);

  const isExpired =
    subscription?.status === 'EXPIRED' ||
    (subscription?.status === 'TRIAL' && subscription?.trialEnd && new Date(subscription.trialEnd).getTime() <= Date.now());

  useEffect(() => {
    if (isExpired) {
      // Track trial_expired once
      trackFunnelEvent('trial_expired');

      // Fetch actual counts
      api.get('/conversion/upgrade/progress').then(res => {
        if (res.data?.success) {
          setCounts({
            customers: res.data.data.customerCount || 0,
            orders: res.data.data.orderCount || 0
          });
        }
      }).catch(() => {});
    }
  }, [isExpired]);

  useEffect(() => {
    // Listen for readonly_blocked_action dispatched by api client
    const handleBlockedAction = (e: any) => {
      trackFunnelEvent('readonly_blocked_action', { detail: e.detail });
      setBlockedActionMessage(e.detail?.error?.message || null);
      setIsSheetOpen(true);
    };

    window.addEventListener('readonly_blocked_action', handleBlockedAction);
    return () => {
      window.removeEventListener('readonly_blocked_action', handleBlockedAction);
    };
  }, []);

  if (!isExpired) return null;

  return (
    <>
      {/* Top Banner */}
      <div className="bg-amber-600 text-white px-4 py-2.5 shadow-sm border-b border-amber-700/30">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Lock className="h-4 w-4 shrink-0 text-amber-200" />
            <p className="text-xs sm:text-sm font-semibold tracking-wide">
              Your trial has ended, but your shop is still here. {counts.customers} customers and {counts.orders} orders are waiting for you.
            </p>
          </div>
          <button
            onClick={() => navigate('/upgrade')}
            className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-lg bg-white px-3.5 py-1.5 text-xs font-bold text-amber-900 shadow-xs hover:bg-amber-50 active:scale-98 transition-all shrink-0"
          >
            <span>Continue my shop</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Upgrade Sheet Modal */}
      <Modal
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        maxWidth="max-w-lg"
        containerClassName="items-end sm:items-center justify-center p-0 sm:p-4"
        className="rounded-t-2xl sm:rounded-2xl p-6 border border-slate-200 space-y-4"
        ariaLabel="View-only mode active"
      >
        <div className="w-full space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">View-only mode active</h3>
                  <span className="text-[11px] text-slate-500">Trial period finished</span>
                </div>
              </div>
              <button
                onClick={() => setIsSheetOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-xs sm:text-sm text-slate-700 font-medium">
                Your shop is in view-only mode. Continue your plan and pick up right where you left off.
              </p>
              {blockedActionMessage && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                  <span>{blockedActionMessage}</span>
                </div>
              )}
              <p className="text-xs text-slate-500">
                You can freely browse all existing customers, measurements, and orders. To add or update records, activate your subscription.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                onClick={() => {
                  setIsSheetOpen(false);
                  navigate('/upgrade');
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 text-white text-xs sm:text-sm font-bold shadow-md shadow-blue-500/20 hover:bg-blue-700 transition flex items-center justify-center gap-1.5"
              >
                <span>Continue my shop</span>
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => setIsSheetOpen(false)}
                className="py-2.5 px-4 rounded-xl border border-slate-200 text-slate-600 text-xs sm:text-sm font-semibold hover:bg-slate-50 transition"
              >
                Browse records
              </button>
            </div>
          </div>
      </Modal>
    </>
  );
};
