import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { StatusBadge } from '../../components/common/StatusBadge';
import {
  KanbanSquare,
  Clock,
  User,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Calendar,
  AlertCircle
} from 'lucide-react';

export const ProductionBoardPage: React.FC = () => {
  const [board, setBoard] = useState<Record<string, any[]>>({});
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Delay Modal State
  const [delayModalJob, setDelayModalJob] = useState<any>(null);
  const [delayReason, setDelayReason] = useState('');
  const [revisedDate, setRevisedDate] = useState('');
  const [delayError, setDelayError] = useState('');
  const [savingDelay, setSavingDelay] = useState(false);

  const stages = [
    { key: 'RECEIVED', label: 'Received' },
    { key: 'CUTTING', label: 'Cutting' },
    { key: 'STITCHING', label: 'Stitching' },
    { key: 'FINISHING', label: 'Finishing' },
    { key: 'TRIAL', label: 'Trial' },
    { key: 'ALTERATION', label: 'Alteration' },
    { key: 'READY', label: 'Ready' },
    { key: 'DELIVERED', label: 'Delivered' }
  ];

  const fetchBoardData = async () => {
    try {
      setLoading(true);
      const [boardRes, staffRes] = await Promise.all([
        api.get('/production/board'),
        api.get('/users')
      ]);

      if (boardRes.data.success) {
        setBoard(boardRes.data.data);
      }
      if (staffRes.data.success) {
        setStaffList(staffRes.data.data);
      }
    } catch (e) {
      console.error('Failed to load production board', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBoardData();
  }, []);

  const handleStageAdvance = async (job: any, nextStage: string) => {
    try {
      const res = await api.post(`/production/jobs/${job.id}/stage`, {
        stage: nextStage
      });
      if (res.data.success) {
        fetchBoardData();
      }
    } catch (e: any) {
      alert(e.response?.data?.error?.message || 'Failed to update stage');
    }
  };

  const handleAssignStaff = async (jobId: string, staffId: string) => {
    try {
      const res = await api.post(`/production/jobs/${jobId}/assign`, { staffId });
      if (res.data.success) {
        fetchBoardData();
      }
    } catch (e) {
      alert('Failed to assign staff member');
    }
  };

  const handleSaveDelay = async (e: React.FormEvent) => {
    e.preventDefault();
    setDelayError('');

    if (!delayReason.trim()) {
      setDelayError('Delay reason is mandatory.');
      return;
    }
    if (!revisedDate) {
      setDelayError('Revised delivery date is mandatory.');
      return;
    }

    setSavingDelay(true);
    try {
      const res = await api.post(`/production/jobs/${delayModalJob.id}/stage`, {
        isDelayed: true,
        delayReason,
        revisedDeliveryDate: revisedDate
      });
      if (res.data.success) {
        setDelayModalJob(null);
        setDelayReason('');
        setRevisedDate('');
        fetchBoardData();
      }
    } catch (err: any) {
      setDelayError(err.response?.data?.error?.message || 'Failed to save delay details');
    } finally {
      setSavingDelay(false);
    }
  };

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
          <h1 className="text-xl font-bold text-slate-900">Workshop Production Kanban</h1>
          <p className="text-xs text-slate-500">Track stage progress, manual staff assignment, fittings, and delay validations.</p>
        </div>
      </div>

      {/* Kanban Stages Board */}
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
        {stages.map((stage, sIdx) => {
          const jobs = board[stage.key] || [];
          const nextStageKey = stages[sIdx + 1]?.key;

          return (
            <div
              key={stage.key}
              className="w-72 shrink-0 rounded-2xl border border-slate-200 bg-slate-100/70 flex flex-col max-h-[calc(100vh-210px)]"
            >
              {/* Stage Header */}
              <div className="p-3 border-b border-slate-200/80 bg-white rounded-t-2xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-slate-800 uppercase tracking-wider">{stage.label}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                    {jobs.length}
                  </span>
                </div>
              </div>

              {/* Jobs List */}
              <div className="p-2.5 flex-1 overflow-y-auto space-y-2.5">
                {jobs.length === 0 ? (
                  <div className="p-4 text-center text-[11px] text-slate-400">Empty stage</div>
                ) : (
                  jobs.map((job) => (
                    <div
                      key={job.id}
                      className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs space-y-2.5 hover:border-blue-400 transition-all"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div>
                          <span className="font-mono font-bold text-xs text-blue-700">
                            {job.orderItem?.order?.orderNumber}
                          </span>
                          <div className="font-bold text-xs text-slate-900 mt-0.5">
                            {job.orderItem?.garmentType?.name}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Client: {job.orderItem?.order?.customer?.firstName} {job.orderItem?.order?.customer?.lastName}
                          </div>
                        </div>
                        {job.orderItem?.order?.priority === 'URGENT' && (
                          <span className="rounded bg-rose-50 px-1 py-0.5 text-[9px] font-bold text-rose-600 border border-rose-200">
                            URGENT
                          </span>
                        )}
                      </div>

                      {/* Due Date & Delay Warning */}
                      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100">
                        <span className="flex items-center gap-1 text-slate-500">
                          <Clock className="h-3 w-3" />
                          Due: {new Date(job.orderItem?.order?.deliveryDate).toLocaleDateString()}
                        </span>
                        {job.isDelayed && (
                          <span className="flex items-center gap-0.5 text-rose-600 font-bold text-[10px]">
                            <AlertTriangle className="h-3 w-3" /> Delayed
                          </span>
                        )}
                      </div>

                      {job.isDelayed && job.delayReason && (
                        <div className="p-1.5 rounded bg-rose-50 text-[10px] text-rose-700 border border-rose-200">
                          Reason: {job.delayReason}
                        </div>
                      )}

                      {/* Manual Staff Assignment Dropdown */}
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">Assigned To:</label>
                        <select
                          value={job.assignedToId || ''}
                          onChange={(e) => handleAssignStaff(job.id, e.target.value)}
                          className="w-full rounded border border-slate-200 py-1 px-1.5 text-[11px] bg-slate-50 font-medium"
                        >
                          <option value="">-- Unassigned --</option>
                          {staffList.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} ({s.role})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Advance Stage Button & Delay Trigger */}
                      <div className="flex items-center justify-between pt-1 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setDelayModalJob(job);
                            setDelayReason(job.delayReason || '');
                            setRevisedDate(job.revisedDeliveryDate ? job.revisedDeliveryDate.split('T')[0] : '');
                          }}
                          className="text-[10px] font-bold text-amber-700 hover:underline"
                        >
                          + Flag Delay
                        </button>

                        {nextStageKey && (
                          <button
                            type="button"
                            onClick={() => handleStageAdvance(job, nextStageKey)}
                            className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-blue-700 shadow-xs"
                          >
                            <span>Move to {stages[sIdx + 1]?.label}</span>
                            <ArrowRight className="h-2.5 w-2.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mandatory Delay Reason & Revised Date Modal */}
      {delayModalJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
              <AlertTriangle className="h-5 w-5" />
              Flag Production Delay ? Mandatory Requirements
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Per quality standards, an order delay cannot be recorded without both a verified reason and a revised customer delivery date.
            </p>

            {delayError && (
              <div className="mt-3 rounded-lg bg-rose-50 p-2 text-xs font-medium text-rose-700 border border-rose-200">
                {delayError}
              </div>
            )}

            <form onSubmit={handleSaveDelay} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Delay Reason *</label>
                <textarea
                  required
                  rows={3}
                  value={delayReason}
                  onChange={(e) => setDelayReason(e.target.value)}
                  placeholder="e.g. Imported fabric clearance delayed at customs / Alteration requested by customer"
                  className="mt-1 block w-full rounded-lg border border-slate-300 p-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Revised Delivery Date *</label>
                <input
                  type="date"
                  required
                  value={revisedDate}
                  onChange={(e) => setRevisedDate(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 mt-4">
                <button
                  type="button"
                  onClick={() => setDelayModalJob(null)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingDelay}
                  className="rounded-lg bg-rose-600 px-5 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  {savingDelay ? 'Validating & Saving...' : 'Confirm Delay Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
