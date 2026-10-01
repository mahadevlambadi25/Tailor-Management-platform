import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import {
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp,
  X,
  Sparkles,
  ArrowRight,
  UserPlus,
  Ruler,
  ShoppingBag,
  KanbanSquare,
  Users
} from 'lucide-react';

export interface ChecklistState {
  step1_addCustomer: boolean;
  step2_saveMeasurements: boolean;
  step3_createOrder: boolean;
  step4_moveStage: boolean;
  step5_inviteTeam: boolean;
  completedStepsCount: number;
  totalSteps: number;
  allCompleted: boolean;
  isDismissed: boolean;
  customerNameForAha?: string;
  latestOrderId?: string;
  latestOrderNumber?: string;
}

export interface FirstWinChecklistCardProps {
  status?: ChecklistState | null;
  onRefresh?: () => void;
  onOpenImportModal?: () => void;
  onOpenTeamInviteModal?: () => void;
  onOpenAhaModal?: (orderData?: any) => void;
  onInviteTeamClick?: () => void;
  onAddCustomerClick?: () => void;
  onNewOrderClick?: () => void;
}

export const FirstWinChecklistCard: React.FC<FirstWinChecklistCardProps> = ({
  status: initialStatus,
  onRefresh,
  onOpenImportModal,
  onOpenTeamInviteModal,
  onOpenAhaModal,
  onInviteTeamClick,
  onAddCustomerClick,
  onNewOrderClick
}) => {
  const [status, setStatus] = useState<ChecklistState | null>(initialStatus || null);
  const [collapsed, setCollapsed] = useState(false);
  const [dismissedLocally, setDismissedLocally] = useState(false);
  const navigate = useNavigate();

  const fetchStatus = async () => {
    try {
      const res = await api.get('/conversion/checklist');
      if (res.data?.success) {
        setStatus(res.data.data);
      }
    } catch {
      // Safe fallback
    }
  };

  useEffect(() => {
    if (initialStatus) {
      setStatus(initialStatus);
    } else {
      fetchStatus();
    }
  }, [initialStatus]);

  if (!status || status.allCompleted || status.isDismissed || dismissedLocally) {
    return null;
  }

  const handleDismiss = async () => {
    try {
      setDismissedLocally(true);
      await api.post('/conversion/checklist/dismiss');
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Failed to dismiss checklist', err);
    }
  };

  const inviteAction = onInviteTeamClick || onOpenTeamInviteModal || (() => navigate('/staff'));

  const steps = [
    {
      id: 1,
      title: 'Add your first customer',
      completed: status.step1_addCustomer,
      action: onAddCustomerClick || (() => navigate('/customers')),
      actionLabel: 'Add customer',
      secondaryAction: onOpenImportModal,
      secondaryLabel: 'Import customers',
      icon: UserPlus
    },
    {
      id: 2,
      title: 'Save their measurements',
      completed: status.step2_saveMeasurements,
      action: () => navigate('/measurements'),
      actionLabel: 'Enter measurements',
      icon: Ruler
    },
    {
      id: 3,
      title: 'Create an order with a delivery date',
      completed: status.step3_createOrder,
      action: () => {
        if (status.step3_createOrder && onOpenAhaModal) {
          onOpenAhaModal({
            customerName: status.customerNameForAha || 'Client',
            orderNumber: status.latestOrderNumber || 'ORD-101'
          });
        } else if (onNewOrderClick) {
          onNewOrderClick();
        } else {
          navigate('/orders/new');
        }
      },
      actionLabel: status.step3_createOrder && onOpenAhaModal ? 'Preview WhatsApp update' : 'New order',
      icon: ShoppingBag
    },
    {
      id: 4,
      title: 'Move it to the next stage',
      completed: status.step4_moveStage,
      action: () => navigate('/production'),
      actionLabel: 'Production board',
      icon: KanbanSquare
    },
    {
      id: 5,
      title: 'Invite someone from your team',
      completed: status.step5_inviteTeam,
      action: inviteAction,
      actionLabel: 'Invite team',
      icon: Users
    }
  ];

  const progressPercentage = Math.round((status.completedStepsCount / 5) * 100);

  return (
    <div className="rounded-2xl sm:rounded-3xl border border-blue-200/80 bg-gradient-to-b from-blue-50/60 to-white shadow-sm overflow-hidden text-left transition-all mb-5">
      {/* Header Bar */}
      <div className="p-4 sm:p-5 flex items-center justify-between border-b border-blue-100/60">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-blue-500/20">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-bold text-slate-950 truncate tracking-tight">
              Your shop, in five small steps
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-500">
              {status.completedStepsCount} of 5 completed ({progressPercentage}%)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white/80 transition-colors"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white/80 transition-colors"
            title="Dismiss card"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-blue-100/60 h-1.5">
        <div
          className="bg-blue-600 h-1.5 transition-all duration-500 ease-out"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>

      {/* Steps List */}
      {!collapsed && (
        <div className="p-4 sm:p-6 divide-y divide-slate-100/80">
          {steps.map(step => {
            const StepIcon = step.icon;
            return (
              <div
                key={step.id}
                className="py-3 sm:py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="shrink-0">
                    {step.completed ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <Circle className="h-5 w-5 text-slate-300 group-hover:text-blue-500 transition-colors" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <span
                      className={`text-xs sm:text-sm font-semibold transition-colors ${
                        step.completed
                          ? 'text-slate-400 line-through'
                          : 'text-slate-800 group-hover:text-blue-900'
                      }`}
                    >
                      {step.title}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pl-8 sm:pl-0 shrink-0">
                  {step.secondaryAction && !step.completed && (
                    <button
                      type="button"
                      onClick={step.secondaryAction}
                      className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      {step.secondaryLabel}
                    </button>
                  )}

                  {!step.completed ? (
                    <button
                      type="button"
                      onClick={step.action}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-[11px] sm:text-xs font-bold hover:bg-blue-700 shadow-2xs transition-all"
                    >
                      <span>{step.actionLabel}</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  ) : step.id === 3 && onOpenAhaModal ? (
                    <button
                      type="button"
                      onClick={step.action}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold hover:bg-emerald-100 transition-colors"
                    >
                      <span>Preview update</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  ) : (
                    <span className="text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md">
                      Done
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
