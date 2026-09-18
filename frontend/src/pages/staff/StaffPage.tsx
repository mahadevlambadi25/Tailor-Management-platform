import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { User, UserPlus, Shield, CheckCircle2 } from 'lucide-react';

export const StaffPage: React.FC = () => {
  const [staff, setStaff] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'TAILOR',
    password: 'Password@123',
    branchId: '',
    staffCode: '',
    skills: ''
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [staffRes, branchRes] = await Promise.all([
        api.get('/users'),
        api.get('/branches')
      ]);
      if (staffRes.data.success) setStaff(staffRes.data.data);
      if (branchRes.data.success) {
        setBranches(branchRes.data.data);
        if (branchRes.data.data.length > 0) {
          setForm((prev) => ({ ...prev, branchId: branchRes.data.data[0].id }));
        }
      }
    } catch (e) {
      console.error('Failed to load staff list', e);
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
      const payload = {
        ...form,
        skills: form.skills.split(',').map((s) => s.trim()).filter(Boolean)
      };
      const res = await api.post('/users', payload);
      if (res.data.success) {
        setShowModal(false);
        setForm({
          name: '',
          email: '',
          phone: '',
          role: 'TAILOR',
          password: 'Password@123',
          branchId: branches[0]?.id || '',
          staffCode: '',
          skills: ''
        });
        fetchData();
      }
    } catch (e: any) {
      alert(e.response?.data?.error?.message || 'Failed to create staff member');
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
          <h1 className="text-xl font-bold text-slate-900">Staff & Role-Based Access Control</h1>
          <p className="text-xs text-slate-500">Manage workshop tailors, cutters, finishers, cashiers, and managers.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-md shadow-blue-500/20"
        >
          <UserPlus className="h-4 w-4" /> Add Staff Account
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 bg-slate-50 text-slate-500 font-semibold uppercase">
              <tr>
                <th className="py-3 px-4">Staff Member</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Branch Location</th>
                <th className="py-3 px-4">Skills / Specializations</th>
                <th className="py-3 px-4">Last Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {staff.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/60">
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-slate-900">{s.name}</div>
                    <div className="text-[11px] text-slate-500">{s.email}</div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700 font-mono">
                      {s.role}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-700 font-medium">
                    {s.branch?.name || 'All Facilities'}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex flex-wrap gap-1">
                      {s.skills?.map((sk: string, idx: number) => (
                        <span key={idx} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                          {sk}
                        </span>
                      )) || '-'}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                    {s.lastLoginAt ? new Date(s.lastLoginAt).toLocaleString() : 'Never'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-slate-900">Create Staff User</h2>
            <form onSubmit={handleCreate} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Full Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Deepak Verma"
                  className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Staff Email *</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="deepak@royalbespoke.com"
                  className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">System Role *</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs font-medium"
                >
                  <option value="MANAGER">Manager (Operational Control)</option>
                  <option value="RECEPTIONIST">Receptionist (Intake & Bookings)</option>
                  <option value="TAILOR">Master Tailor (Stitching & Fitting)</option>
                  <option value="CUTTER">Cutter (Pattern & Canvas Layout)</option>
                  <option value="FINISHER">Finisher (Ironing & Buttonholes)</option>
                  <option value="CASHIER">Cashier (Billing & Ledger)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Branch Facility</label>
                <select
                  value={form.branchId}
                  onChange={(e) => setForm({ ...form, branchId: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs"
                >
                  <option value="">All Branches</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Skills (comma separated)</label>
                <input
                  type="text"
                  value={form.skills}
                  onChange={(e) => setForm({ ...form, skills: e.target.value })}
                  placeholder="e.g. Suit Stitching, Shirt Fitting, Canvas Layout"
                  className="mt-1 block w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs"
                />
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
                  Create Staff Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
