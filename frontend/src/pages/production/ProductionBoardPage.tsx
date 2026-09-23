import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  KanbanSquare,
  Clock,
  User,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Scissors,
  Search,
  X,
  Filter,
  Eye,
  RotateCcw,
  Sparkles,
  Layers,
  Phone,
  RefreshCw,
  SlidersHorizontal,
  ChevronRight,
  CreditCard
} from 'lucide-react';
import { formatCurrency } from '../../utils/currency';

interface StaffMember {
  id: string;
  name: string;
  role: string;
  phone?: string | null;
}

interface MeasurementSnapshot {
  unit: string;
  valuesSnapshot: Record<string, any>;
  notes?: string | null;
}

export const ProductionBoardPage: React.FC = () => {
  const { user } = useAuth();

  const [board, setBoard] = useState<Record<string, any[]>>({});
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters State
  const [search, setSearch] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [delayedOnly, setDelayedOnly] = useState(false);
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [myTasksOnly, setMyTasksOnly] = useState(false);

  // Mobile Active Stage Tab (on mobile, viewing one stage at a time is much cleaner)
  const [mobileActiveStage, setMobileActiveStage] = useState<string>('ALL');

  // Modals
  const [delayModalJob, setDelayModalJob] = useState<any>(null);
  const [delayReason, setDelayReason] = useState('');
  const [revisedDate, setRevisedDate] = useState('');
  const [delayError, setDelayError] = useState('');
  const [savingDelay, setSavingDelay] = useState(false);

  // Measurement Modal
  const [measurementModalJob, setMeasurementModalJob] = useState<any>(null);

  // Staff Assignment Modal
  const [assignModalJob, setAssignModalJob] = useState<any>(null);
  const [selectedCutter, setSelectedCutter] = useState('');
  const [selectedTailor, setSelectedTailor] = useState('');
  const [selectedFinisher, setSelectedFinisher] = useState('');
  const [assignNotes, setAssignNotes] = useState('');
  const [assignError, setAssignError] = useState('');
  const [savingAssign, setSavingAssign] = useState(false);

  // Return for Alteration Modal (DELIVERED -> ALTERATION)
  const [returnModalJob, setReturnModalJob] = useState<any>(null);
  const [returnReason, setReturnReason] = useState('');
  const [returnNotes, setReturnNotes] = useState('');
  const [returnError, setReturnError] = useState('');
  const [savingReturn, setSavingReturn] = useState(false);

  // Delivery confirmation modal when outstanding balance exists
  const [deliveryConfirmJob, setDeliveryConfirmJob] = useState<any>(null);

  const stages = [
    { key: 'RECEIVED', label: 'Received', color: 'slate' },
    { key: 'CUTTING', label: 'Cutting', color: 'indigo' },
    { key: 'STITCHING', label: 'Stitching', color: 'blue' },
    { key: 'FINISHING', label: 'Finishing', color: 'cyan' },
    { key: 'TRIAL', label: 'Trial Ready', color: 'purple' },
    { key: 'ALTERATION', label: 'Alteration Pending', color: 'amber' },
    { key: 'READY', label: 'Completed / Ready', color: 'emerald' },
    { key: 'DELIVERED', label: 'Delivered', color: 'teal' }
  ];

  const fetchBoardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (search.trim()) params.append('search', search.trim());
      if (selectedStaffId) params.append('assignedStaffId', selectedStaffId);
      if (delayedOnly) params.append('isDelayed', 'true');
      if (urgentOnly) params.append('priority', 'URGENT');
      if (myTasksOnly) params.append('myTasks', 'true');

      const [boardRes, staffRes] = await Promise.all([
        api.get(`/production/board?${params.toString()}`),
        api.get('/users')
      ]);

      if (boardRes.data?.success) {
        setBoard(boardRes.data.data || {});
      } else {
        throw new Error(boardRes.data?.error?.message || 'Failed to load production board');
      }

      if (staffRes.data?.success) {
        setStaffList(staffRes.data.data || []);
      }
    } catch (e: any) {
      console.error('Failed to load production board', e);
      setError(e.response?.data?.error?.message || e.message || 'Unable to load production data');
    } finally {
      setLoading(false);
    }
  }, [search, selectedStaffId, delayedOnly, urgentOnly, myTasksOnly]);

  useEffect(() => {
    fetchBoardData();
  }, [fetchBoardData]);

  // Handle stage advance
  const handleStageAdvance = async (job: any, nextStage: string) => {
    // If advancing to DELIVERED and order has balance due, prompt confirmation modal
    if (nextStage === 'DELIVERED' && Number(job.orderItem?.order?.balanceAmount) > 0 && !deliveryConfirmJob) {
      setDeliveryConfirmJob(job);
      return;
    }

    try {
      const res = await api.post(`/production/jobs/${job.id}/stage`, {
        stage: nextStage
      });
      if (res.data?.success) {
        setDeliveryConfirmJob(null);
        fetchBoardData();
      }
    } catch (e: any) {
      alert(e.response?.data?.error?.message || 'Failed to update stage');
    }
  };

  // Open Assign Modal
  const openAssignModal = (job: any) => {
    setAssignModalJob(job);
    setSelectedCutter(job.assignments?.cutter?.id || job.rawAssignments?.cutterId || '');
    setSelectedTailor(job.assignments?.tailor?.id || job.rawAssignments?.tailorId || '');
    setSelectedFinisher(job.assignments?.finisher?.id || job.rawAssignments?.finisherId || '');
    setAssignNotes(job.userNotes || '');
    setAssignError('');
  };

  // Submit Staff Assignment
  const handleSaveAssignments = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignModalJob) return;

    setSavingAssign(true);
    setAssignError('');
    try {
      const res = await api.post(`/production/jobs/${assignModalJob.id}/assign`, {
        cutterId: selectedCutter || null,
        tailorId: selectedTailor || null,
        finisherId: selectedFinisher || null,
        notes: assignNotes
      });

      if (res.data?.success) {
        setAssignModalJob(null);
        fetchBoardData();
      }
    } catch (err: any) {
      setAssignError(err.response?.data?.error?.message || 'Failed to save staff assignments');
    } finally {
      setSavingAssign(false);
    }
  };

  // Save Delay
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
      if (res.data?.success) {
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

  // Submit Return for Alteration
  const handleSaveReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    setReturnError('');

    if (!returnReason.trim()) {
      setReturnError('Return reason is mandatory.');
      return;
    }

    setSavingReturn(true);
    try {
      const res = await api.post(`/production/jobs/${returnModalJob.id}/return-for-alteration`, {
        reason: returnReason,
        notes: returnNotes
      });
      if (res.data?.success) {
        setReturnModalJob(null);
        setReturnReason('');
        setReturnNotes('');
        fetchBoardData();
      }
    } catch (err: any) {
      setReturnError(err.response?.data?.error?.message || 'Failed to process return for alteration');
    } finally {
      setSavingReturn(false);
    }
  };

  // Filtered staff by craft role
  const cutters = useMemo(
    () => staffList.filter((s) => s.role === 'CUTTER' || s.role === 'SHOP_OWNER' || s.role === 'MANAGER'),
    [staffList]
  );
  const tailors = useMemo(
    () => staffList.filter((s) => s.role === 'TAILOR' || s.role === 'SHOP_OWNER' || s.role === 'MANAGER'),
    [staffList]
  );
  const finishers = useMemo(
    () => staffList.filter((s) => s.role === 'FINISHER' || s.role === 'SHOP_OWNER' || s.role === 'MANAGER'),
    [staffList]
  );

  // Total active count across all stages
  const totalJobsCount = useMemo(() => {
    return Object.values(board).reduce((sum, list) => sum + (list?.length || 0), 0);
  }, [board]);

  const hasActiveFilters = Boolean(
    search.trim() || selectedStaffId || delayedOnly || urgentOnly || myTasksOnly
  );

  const clearFilters = () => {
    setSearch('');
    setSelectedStaffId('');
    setDelayedOnly(false);
    setUrgentOnly(false);
    setMyTasksOnly(false);
  };

  // Render Job Card
  const renderJobCard = (job: any, sIdx: number) => {
    const nextStage = stages[sIdx + 1];
    const isOverdue =
      job.orderItem?.order?.deliveryDate &&
      new Date(job.orderItem.order.deliveryDate) < new Date() &&
      job.currentStage !== 'DELIVERED';

    return (
      <div
        key={job.id}
        className={`rounded-xl border bg-white p-3.5 shadow-xs space-y-2.5 transition-all hover:shadow-md ${
          job.isDelayed
            ? 'border-rose-300 ring-1 ring-rose-200'
            : job.orderItem?.order?.priority === 'URGENT'
            ? 'border-amber-300'
            : 'border-slate-200 hover:border-blue-400'
        }`}
      >
        {/* Top Header: Order #, Priority, Garment */}
        <div className="flex items-start justify-between gap-1">
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-mono font-bold text-xs text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                {job.orderItem?.order?.orderNumber}
              </span>
              {job.orderItem?.order?.priority === 'URGENT' && (
                <span className="rounded bg-rose-50 px-1 py-0.5 text-[9px] font-bold text-rose-600 border border-rose-200 uppercase">
                  Urgent
                </span>
              )}
              {job.orderItem?.order && (
                job.orderItem.order.paymentStatus === 'FULLY_PAID' || Number(job.orderItem.order.balanceAmount) <= 0 ? (
                  <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 border border-emerald-200 uppercase">
                    Paid
                  </span>
                ) : job.orderItem.order.paymentStatus === 'PARTIALLY_PAID' ? (
                  <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 border border-amber-200">
                    Due: {formatCurrency(job.orderItem.order.balanceAmount)}
                  </span>
                ) : (
                  <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[9px] font-bold text-rose-700 border border-rose-200">
                    Unpaid
                  </span>
                )
              )}
            </div>
            <div className="font-bold text-xs text-slate-900 mt-1">
              {job.orderItem?.garmentType?.name || 'Custom Garment'}
            </div>
            <div className="text-[11px] text-slate-500 truncate max-w-[200px]">
              Client: {job.orderItem?.order?.customer?.firstName} {job.orderItem?.order?.customer?.lastName}
            </div>
          </div>
        </div>

        {/* Due Date & Delay Banner */}
        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100">
          <span className={`flex items-center gap-1 font-medium ${isOverdue ? 'text-rose-600' : 'text-slate-500'}`}>
            <Clock className="h-3 w-3" />
            Due: {job.orderItem?.order?.deliveryDate ? new Date(job.orderItem.order.deliveryDate).toLocaleDateString() : 'N/A'}
          </span>
          {job.isDelayed && (
            <span className="flex items-center gap-0.5 text-rose-600 font-bold text-[10px]">
              <AlertTriangle className="h-3 w-3" /> Delayed
            </span>
          )}
        </div>

        {/* Delay Reason Alert */}
        {job.isDelayed && job.delayReason && (
          <div className="p-1.5 rounded-lg bg-rose-50 text-[10px] text-rose-700 border border-rose-200 leading-tight">
            <span className="font-bold">Reason:</span> {job.delayReason}
          </div>
        )}

        {/* Assigned Craftsmen Overview */}
        <div className="rounded-lg bg-slate-50/80 p-2 text-[10px] space-y-1 border border-slate-100">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">✂️ Cutter:</span>
            <span className="font-semibold text-slate-800">
              {job.assignments?.cutter?.name || 'Unassigned'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">🧵 Tailor:</span>
            <span className="font-semibold text-slate-800">
              {job.assignments?.tailor?.name || 'Unassigned'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">✨ Finisher:</span>
            <span className="font-semibold text-slate-800">
              {job.assignments?.finisher?.name || 'Unassigned'}
            </span>
          </div>
        </div>

        {/* Action Row: Measurements, Assign Staff, Stage Update */}
        <div className="flex items-center justify-between pt-1 gap-1 border-t border-slate-100 flex-wrap">
          <div className="flex items-center gap-1">
            {/* View Measurements Snapshot */}
            <button
              type="button"
              onClick={() => setMeasurementModalJob(job)}
              title="View Historical Measurements Snapshot"
              className="inline-flex items-center gap-1 rounded-md bg-slate-100 hover:bg-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-700 transition"
            >
              <Eye className="h-2.5 w-2.5" />
              <span>Sizes</span>
            </button>

            {/* Assign Staff Button */}
            {(user?.role === 'SHOP_OWNER' || user?.role === 'MANAGER') && (
              <button
                type="button"
                onClick={() => openAssignModal(job)}
                title="Assign Cutter, Tailor or Finisher"
                className="inline-flex items-center gap-1 rounded-md bg-blue-50 hover:bg-blue-100 px-2 py-1 text-[10px] font-semibold text-blue-700 transition"
              >
                <Scissors className="h-2.5 w-2.5" />
                <span>Assign</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* Flag Delay Button */}
            {job.currentStage !== 'DELIVERED' && (
              <button
                type="button"
                onClick={() => {
                  setDelayModalJob(job);
                  setDelayReason(job.delayReason || '');
                  setRevisedDate(
                    job.revisedDeliveryDate
                      ? job.revisedDeliveryDate.split('T')[0]
                      : ''
                  );
                }}
                className="text-[10px] font-bold text-amber-700 hover:text-amber-900 transition underline"
              >
                + Delay
              </button>
            )}

            {/* Delivered Job: Return for Alteration Action */}
            {job.currentStage === 'DELIVERED' ? (
              <button
                type="button"
                onClick={() => {
                  setReturnModalJob(job);
                  setReturnReason('');
                  setReturnNotes('');
                  setReturnError('');
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-amber-700 shadow-xs transition"
              >
                <RotateCcw className="h-2.5 w-2.5" />
                <span>Return for Alteration</span>
              </button>
            ) : (
              nextStage && (
                <button
                  type="button"
                  onClick={() => handleStageAdvance(job, nextStage.key)}
                  className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-blue-700 shadow-xs transition"
                >
                  <span>{nextStage.label}</span>
                  <ArrowRight className="h-2.5 w-2.5" />
                </button>
              )
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Workshop Production Board</h1>
            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700">
              {totalJobsCount} Garments Active
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Stage progression, craft assignments (Cutter, Tailor, Finisher), and delay validations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchBoardData}
            title="Refresh Production Board"
            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition shadow-2xs"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Keyword Search */}
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Order #, Customer, Mobile..."
              className="w-full rounded-xl border border-slate-200 pl-9 pr-8 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Staff Filter Dropdown */}
          <div>
            <select
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 py-1.5 px-3 text-xs bg-white text-slate-700 focus:border-blue-500 focus:outline-none"
            >
              <option value="">All Workshop Staff</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.role})
                </option>
              ))}
            </select>
          </div>

          {/* Quick Toggle: My Assigned Tasks */}
          <button
            type="button"
            onClick={() => setMyTasksOnly(!myTasksOnly)}
            className={`rounded-xl border px-3 py-1.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
              myTasksOnly
                ? 'border-blue-600 bg-blue-50 text-blue-700'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <User className="h-3.5 w-3.5" />
            My Assigned Tasks
          </button>

          {/* Quick Toggle: Delayed Only */}
          <button
            type="button"
            onClick={() => setDelayedOnly(!delayedOnly)}
            className={`rounded-xl border px-3 py-1.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
              delayedOnly
                ? 'border-rose-500 bg-rose-50 text-rose-700 font-bold'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Delayed Only
          </button>
        </div>

        {/* Filter Badges and Clear Action */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
            <span className="text-slate-500 text-[11px]">Active filters applied</span>
            <button
              type="button"
              onClick={clearFilters}
              className="font-bold text-blue-600 hover:underline text-[11px]"
            >
              Clear All Filters
            </button>
          </div>
        )}
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="w-72 shrink-0 rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3 animate-pulse">
              <div className="h-5 w-24 bg-slate-200 rounded" />
              <div className="h-32 bg-white rounded-xl border border-slate-100" />
              <div className="h-32 bg-white rounded-xl border border-slate-100" />
            </div>
          ))}
        </div>
      )}

      {/* Error Banner */}
      {!loading && error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-6 text-center space-y-3">
          <AlertCircle className="h-8 w-8 text-rose-600 mx-auto" />
          <h3 className="text-sm font-bold text-slate-900">Failed to Load Production Board</h3>
          <p className="text-xs text-slate-600 max-w-md mx-auto">{error}</p>
          <button
            type="button"
            onClick={fetchBoardData}
            className="rounded-xl bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700 shadow-xs"
          >
            Retry
          </button>
        </div>
      )}

      {/* Mobile Stage Switcher Pills (visible only on small viewports) */}
      {!loading && !error && (
        <div className="block lg:hidden overflow-x-auto pb-2 scrollbar-none">
          <div className="flex gap-1.5 min-w-max">
            <button
              type="button"
              onClick={() => setMobileActiveStage('ALL')}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                mobileActiveStage === 'ALL'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              All Stages ({totalJobsCount})
            </button>
            {stages.map((stage) => {
              const count = board[stage.key]?.length || 0;
              const isActive = mobileActiveStage === stage.key;
              return (
                <button
                  key={stage.key}
                  type="button"
                  onClick={() => setMobileActiveStage(stage.key)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <span>{stage.label}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-800'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Desktop Kanban Board & Mobile Stage View */}
      {!loading && !error && (
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
          {stages
            .filter((stage) => mobileActiveStage === 'ALL' || mobileActiveStage === stage.key)
            .map((stage, sIdx) => {
              const jobs = board[stage.key] || [];

              return (
                <div
                  key={stage.key}
                  className="w-full lg:w-72 shrink-0 rounded-2xl border border-slate-200 bg-slate-100/70 flex flex-col max-h-[calc(100vh-230px)] shadow-2xs"
                >
                  {/* Column Header */}
                  <div className="p-3 border-b border-slate-200/80 bg-white rounded-t-2xl flex items-center justify-between sticky top-0 z-10">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                        {stage.label}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 border border-slate-200">
                        {jobs.length}
                      </span>
                    </div>
                  </div>

                  {/* Jobs List in Column */}
                  <div className="p-2.5 flex-1 overflow-y-auto space-y-2.5">
                    {jobs.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400 italic">
                        No garments in {stage.label}
                      </div>
                    ) : (
                      jobs.map((job) => renderJobCard(job, sIdx))
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* MODAL 1: Historical Measurement Snapshot Modal */}
      {measurementModalJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                  <Scissors className="h-4 w-4 text-blue-600" />
                  Garment Measurement Snapshot (Immutable)
                </h3>
                <p className="text-xs text-slate-500">
                  {measurementModalJob.orderItem?.garmentType?.name} • Order {measurementModalJob.orderItem?.order?.orderNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMeasurementModalJob(null)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Customer Details */}
            <div className="rounded-xl bg-slate-50 p-3 text-xs flex justify-between items-center">
              <div>
                <span className="text-slate-500">Customer:</span>{' '}
                <span className="font-bold text-slate-800">
                  {measurementModalJob.orderItem?.order?.customer?.firstName} {measurementModalJob.orderItem?.order?.customer?.lastName}
                </span>
              </div>
              <div className="text-slate-600 font-mono">
                {measurementModalJob.orderItem?.order?.customer?.mobile}
              </div>
            </div>

            {/* Measurement Grid */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Recorded Body Measurements
                </span>
                <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                  Unit: {measurementModalJob.orderItem?.measurementSnapshot?.unit || 'INCHES'}
                </span>
              </div>

              {measurementModalJob.orderItem?.measurementSnapshot?.valuesSnapshot &&
              Object.keys(measurementModalJob.orderItem.measurementSnapshot.valuesSnapshot).length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(measurementModalJob.orderItem.measurementSnapshot.valuesSnapshot).map(
                    ([param, val]) => (
                      <div
                        key={param}
                        className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs"
                      >
                        <div className="text-[10px] uppercase font-bold text-slate-500 truncate" title={param}>
                          {param}
                        </div>
                        <div className="text-lg font-bold text-slate-900 mt-0.5 font-mono">
                          {String(val)}{' '}
                          <span className="text-xs font-normal text-slate-400 lowercase">
                            {measurementModalJob.orderItem?.measurementSnapshot?.unit === 'CENTIMETERS' ? 'cm' : 'in'}
                          </span>
                        </div>
                      </div>
                    )
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
                  No discrete measurements recorded for this garment item.
                </div>
              )}
            </div>

            {/* Measurement Notes if any */}
            {measurementModalJob.orderItem?.measurementSnapshot?.notes && (
              <div className="rounded-xl bg-amber-50/70 p-3 text-xs text-amber-900 border border-amber-200">
                <span className="font-bold">Tailoring Instructions:</span> {measurementModalJob.orderItem.measurementSnapshot.notes}
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setMeasurementModalJob(null)}
                className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white hover:bg-slate-800"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Staff Assignment Modal (Cutter, Tailor, Finisher) */}
      {assignModalJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                  <Scissors className="h-4 w-4 text-blue-600" />
                  Assign Workshop Craftsmen
                </h3>
                <p className="text-xs text-slate-500">
                  Order {assignModalJob.orderItem?.order?.orderNumber} • {assignModalJob.orderItem?.garmentType?.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAssignModalJob(null)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {assignError && (
              <div className="rounded-lg bg-rose-50 p-2.5 text-xs font-medium text-rose-700 border border-rose-200">
                {assignError}
              </div>
            )}

            <form onSubmit={handleSaveAssignments} className="space-y-3 text-xs">
              {/* Assign Cutter */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  ✂️ Assign Cutter
                </label>
                <select
                  value={selectedCutter}
                  onChange={(e) => setSelectedCutter(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2 text-xs bg-white text-slate-800"
                >
                  <option value="">-- No Cutter Assigned --</option>
                  {cutters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Assign Tailor */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  🧵 Assign Tailor
                </label>
                <select
                  value={selectedTailor}
                  onChange={(e) => setSelectedTailor(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2 text-xs bg-white text-slate-800"
                >
                  <option value="">-- No Tailor Assigned --</option>
                  {tailors.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Assign Finisher */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  ✨ Assign Finisher
                </label>
                <select
                  value={selectedFinisher}
                  onChange={(e) => setSelectedFinisher(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2 text-xs bg-white text-slate-800"
                >
                  <option value="">-- No Finisher Assigned --</option>
                  {finishers.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Craftsman Instructions & Notes
                </label>
                <textarea
                  rows={2}
                  value={assignNotes}
                  onChange={(e) => setAssignNotes(e.target.value)}
                  placeholder="Special instructions for cutting or sewing..."
                  className="w-full rounded-xl border border-slate-200 p-2 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAssignModalJob(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAssign}
                  className="rounded-xl bg-blue-600 px-5 py-2 font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingAssign ? 'Saving...' : 'Confirm Assignments'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Mandatory Delay Reason Modal */}
      {delayModalJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
              <AlertTriangle className="h-5 w-5" />
              Flag Production Delay — Mandatory Requirements
            </div>
            <p className="text-xs text-slate-500">
              An order delay cannot be recorded without both a verified reason and a revised customer delivery date.
            </p>

            {delayError && (
              <div className="rounded-lg bg-rose-50 p-2 text-xs font-medium text-rose-700 border border-rose-200">
                {delayError}
              </div>
            )}

            <form onSubmit={handleSaveDelay} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700">Delay Reason *</label>
                <textarea
                  required
                  rows={3}
                  value={delayReason}
                  onChange={(e) => setDelayReason(e.target.value)}
                  placeholder="e.g. Fabric import customs clearance delay / Customer requested fit changes"
                  className="mt-1 block w-full rounded-xl border border-slate-300 p-2.5 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700">Revised Delivery Date *</label>
                <input
                  type="date"
                  required
                  value={revisedDate}
                  onChange={(e) => setRevisedDate(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-slate-300 py-1.5 px-3 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDelayModalJob(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingDelay}
                  className="rounded-xl bg-rose-600 px-5 py-2 font-bold text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  {savingDelay ? 'Validating...' : 'Confirm Delay Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Return for Alteration Modal (Explicit DELIVERED -> ALTERATION) */}
      {returnModalJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-amber-700 font-bold text-sm">
              <RotateCcw className="h-5 w-5" />
              Customer Returned Garment for Alteration
            </div>
            <p className="text-xs text-slate-500">
              Order {returnModalJob.orderItem?.order?.orderNumber} is currently marked Delivered. Provide the customer feedback to reopen alteration tailoring.
            </p>

            {returnError && (
              <div className="rounded-lg bg-rose-50 p-2 text-xs font-medium text-rose-700 border border-rose-200">
                {returnError}
              </div>
            )}

            <form onSubmit={handleSaveReturn} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700">Customer Return Reason *</label>
                <textarea
                  required
                  rows={3}
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="e.g. Waist too tight by 1 inch / Sleeve length adjustment requested"
                  className="mt-1 block w-full rounded-xl border border-slate-300 p-2.5 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700">Internal Workshop Notes (Optional)</label>
                <input
                  type="text"
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  placeholder="e.g. Assigned to Master Tailor Ramesh"
                  className="mt-1 block w-full rounded-xl border border-slate-300 py-1.5 px-3 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReturnModalJob(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingReturn}
                  className="rounded-xl bg-amber-600 px-5 py-2 font-bold text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  {savingReturn ? 'Processing...' : 'Confirm Reopen for Alteration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delivery Confirmation Modal for Outstanding Balance */}
      {deliveryConfirmJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Delivery Settlement Notice
              </h3>
              <button
                type="button"
                onClick={() => setDeliveryConfirmJob(null)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-xl bg-amber-50 p-4 border border-amber-200 text-xs text-amber-900 space-y-2">
              <div className="font-bold text-sm">
                Outstanding Balance: {formatCurrency(deliveryConfirmJob.orderItem?.order?.balanceAmount)}
              </div>
              <p className="text-[11px] text-amber-800">
                Order <strong>{deliveryConfirmJob.orderItem?.order?.orderNumber}</strong> for client{' '}
                <strong>
                  {deliveryConfirmJob.orderItem?.order?.customer?.firstName}{' '}
                  {deliveryConfirmJob.orderItem?.order?.customer?.lastName}
                </strong>{' '}
                has an unpaid balance.
              </p>
              <p className="text-[11px] text-slate-600">
                Payment status is currently{' '}
                <span className="font-bold uppercase text-amber-700">
                  {deliveryConfirmJob.orderItem?.order?.paymentStatus || 'PARTIALLY_PAID'}
                </span>
                . You may record settlement payment on the order or proceed to deliver on credit.
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-end">
              <button
                type="button"
                onClick={() => setDeliveryConfirmJob(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <a
                href={`/orders/${deliveryConfirmJob.orderItem?.order?.id}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition cursor-pointer shadow-xs"
              >
                <CreditCard className="h-3.5 w-3.5" />
                Record Settlement
              </a>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await api.post(`/production/jobs/${deliveryConfirmJob.id}/stage`, {
                      stage: 'DELIVERED'
                    });
                    if (res.data?.success) {
                      setDeliveryConfirmJob(null);
                      fetchBoardData();
                    }
                  } catch (e: any) {
                    alert(e.response?.data?.error?.message || 'Failed to update stage');
                  }
                }}
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition cursor-pointer shadow-xs"
              >
                Deliver on Credit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
