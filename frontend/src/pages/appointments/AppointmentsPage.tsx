import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Calendar as CalendarIcon, Clock, Plus, User, CheckCircle2, XCircle } from 'lucide-react';

export const AppointmentsPage: React.FC = () => {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [form, setForm] = useState({
    customerId: '',
    staffId: '',
    type: 'FITTING',
    scheduledAt: '2026-09-18T11:00',
    durationMinutes: 45,
    bufferMinutes: 15,
    notes: ''
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [appRes, custRes, staffRes] = await Promise.all([
        api.get('/appointments'),
        api.get('/customers?limit=50'),
        api.get('/users')
      ]);

      if (appRes.data.success) setAppointments(appRes.data.data);
      if (custRes.data.success) setCustomers(custRes.data.data.customers);
      if (staffRes.data.success) setStaff(staffRes.data.data);
    } catch (e) {
      console.error('Failed to load appointments', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/appointments', form);
      if (res.data.success) {
        setShowModal(false);
        fetchData();
      }
    } catch (e) {
      alert('Failed to schedule appointment');
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      const res = await api.put(`/appointments/${id}`, { status });
      if (res.data.success) {
        fetchData();
      }
    } catch (e) {
      alert('Failed to update status');
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
          <h1 className="text-xl font-bold text-slate-900">Appointments & Fitting Calendar</h1>
          <p className="text-xs text-slate-500">Manage client trial sessions, measurements, and pickup appointments.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-md shadow-blue-500/20"
        >
          <Plus className="h-4 w-4" /> Schedule Appointment
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        {appointments.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">No appointments scheduled.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50 text-slate-500 font-semibold uppercase">
                <tr>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Assigned Staff</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {appointments.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/60">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <CalendarIcon className="h-3.5 w-3.5 text-blue-600" />
                        {new Date(a.scheduledAt).toLocaleString()}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-blue-700">{a.type}</td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{a.customer?.firstName} {a.customer?.lastName}</div>
                      <div className="text-[10px] text-slate-400">{a.customer?.mobile}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 font-medium">{a.staff?.name || 'Any Staff'}</td>
                    <td className="py-3.5 px-4 text-slate-600">{a.durationMinutes} min (+{a.bufferMinutes}m buffer)</td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={a.status} size="sm" />
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2">
                      {a.status === 'SCHEDULED' && (
                        <>
                          <button
                            onClick={() => handleUpdateStatus(a.id, 'COMPLETED')}
                            className="rounded bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100"
                          >
                            Mark Done
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(a.id, 'CANCELLED')}
                            className="rounded bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-700 hover:bg-rose-100"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-slate-900">Schedule New Appointment</h2>
            <form onSubmit={handleCreate} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Customer *</label>
                <select
                  required
                  value={form.customerId}
                  onChange={(e) => setForm({ ...form, customerId: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs"
                >
                  <option value="">-- Select Customer --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.firstName} {c.lastName} ({c.mobile})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Appointment Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs"
                >
                  <option value="MEASUREMENT">Measurement Session</option>
                  <option value="FITTING">Garment Fitting</option>
                  <option value="TRIAL">Trial Session</option>
                  <option value="PICKUP">Order Pickup</option>
                  <option value="OTHER">Other Consultation</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Date & Time *</label>
                <input
                  type="datetime-local"
                  required
                  value={form.scheduledAt}
                  onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Assigned Staff</label>
                <select
                  value={form.staffId}
                  onChange={(e) => setForm({ ...form, staffId: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs"
                >
                  <option value="">-- Anyone Available --</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 mt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700"
                >
                  Confirm Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
