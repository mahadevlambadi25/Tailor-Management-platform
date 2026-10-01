import React, { useEffect, useState } from 'react';
import { Modal } from '../../components/common/Modal';
import { api } from '../../api/client';
import {
  User,
  UserPlus,
  Shield,
  CheckCircle2,
  X,
  Lock,
  Eye,
  EyeOff,
  RefreshCw,
  Copy,
  Check,
  Loader2,
  Building2,
  Mail,
  AlertCircle
} from 'lucide-react';

interface CreatedStaffInfo {
  name: string;
  email: string;
  role: string;
  branchName: string;
  temporaryPassword: string;
}

export const StaffPage: React.FC = () => {
  const [staff, setStaff] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Helper to generate a clean, secure, memorable temporary password
  const generateTempPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    const special = '!@#$%&*';
    let res = 'Tailor@';
    for (let i = 0; i < 4; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    res += special.charAt(Math.floor(Math.random() * special.length));
    return res;
  };

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'TAILOR',
    password: generateTempPassword(),
    branchId: '',
    staffCode: '',
    skills: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const [createdStaff, setCreatedStaff] = useState<CreatedStaffInfo | null>(null);

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
        if (branchRes.data.data.length > 0 && !form.branchId) {
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

  const handleOpenModal = () => {
    setErrorMsg('');
    setCreatedStaff(null);
    setCopied(false);
    setShowPassword(false);
    setForm({
      name: '',
      email: '',
      phone: '',
      role: 'TAILOR',
      password: generateTempPassword(),
      branchId: branches[0]?.id || '',
      staffCode: '',
      skills: ''
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setCreatedStaff(null);
    setErrorMsg('');
    setCopied(false);
  };

  const handleRegeneratePassword = () => {
    setForm((prev) => ({ ...prev, password: generateTempPassword() }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // Field validations
    const trimmedName = form.name.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setErrorMsg('Full name is required (minimum 2 characters).');
      return;
    }

    const trimmedEmail = form.email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    const tempPassword = form.password.trim();
    if (!tempPassword || tempPassword.length < 6) {
      setErrorMsg('Temporary password must be at least 6 characters long.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: trimmedName,
        email: trimmedEmail,
        role: form.role,
        branchId: form.branchId || null,
        password: tempPassword,
        phone: form.phone.trim() || undefined,
        staffCode: form.staffCode.trim() || undefined,
        skills: form.skills.split(',').map((s) => s.trim()).filter(Boolean)
      };

      const res = await api.post('/users', payload);
      if (res.data.success) {
        const branchObj = branches.find((b) => b.id === form.branchId);
        setCreatedStaff({
          name: trimmedName,
          email: trimmedEmail,
          role: form.role,
          branchName: branchObj ? `${branchObj.name} (${branchObj.code || 'Main'})` : 'All Facilities',
          temporaryPassword: res.data.temporaryPassword || tempPassword
        });
        fetchData();
      }
    } catch (e: any) {
      setErrorMsg(
        e.response?.data?.error?.message ||
        e.response?.data?.error ||
        'Failed to create staff member. Please check details and try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!createdStaff) return;
    const loginUrl = `${window.location.origin}/login`;
    const text = `Tailor Management Staff Credentials:\nName: ${createdStaff.name}\nEmail: ${createdStaff.email}\nTemporary Password: ${createdStaff.temporaryPassword}\nRole: ${createdStaff.role}\nFacility: ${createdStaff.branchName}\nSign in: ${loginUrl}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
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
          id="btn-add-staff"
          onClick={handleOpenModal}
          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-md shadow-blue-500/20 cursor-pointer transition-all"
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

      {/* Create Staff Modal */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        maxWidth="max-w-lg"
        className="rounded-2xl shadow-2xl flex flex-col my-auto max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3.5rem)] overflow-hidden"
        ariaLabel={createdStaff ? 'Staff Account Created' : 'Create Staff User'}
      >
        <div className="w-full flex flex-col">
          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-slate-100 p-4 sm:px-6 sm:py-4 bg-white shrink-0">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">
                    {createdStaff ? 'Staff Account Created' : 'Create Staff User'}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {createdStaff
                      ? 'Account successfully provisioned. Share temporary credentials below.'
                      : 'Provision workshop credentials and role-based permissions.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Close modal"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Body */}
              {createdStaff ? (
                /* SUCCESS VIEW */
                <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
                  <div className="flex items-start gap-3 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-xs font-bold">Staff Account Provisioned Successfully</h3>
                      <p className="text-[11px] text-emerald-700 mt-0.5">
                        {createdStaff.name} is now registered in your atelier with the{' '}
                        <span className="font-semibold underline">{createdStaff.role}</span> role.
                      </p>
                    </div>
                  </div>

                  {/* Account Summary Details */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-500">Full Name</span>
                      <span className="font-bold text-slate-800">{createdStaff.name}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-500">Login Email</span>
                      <span className="font-mono font-medium text-slate-800">{createdStaff.email}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-500">System Role</span>
                      <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                        {createdStaff.role}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">Branch Facility</span>
                      <span className="font-medium text-slate-700">{createdStaff.branchName}</span>
                    </div>
                  </div>

                  {/* Temporary Password Box */}
                  <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                        <Lock className="h-3.5 w-3.5 text-amber-600" />
                        Temporary Login Password
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-[11px] text-amber-800 hover:text-amber-950 font-medium inline-flex items-center gap-1 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        <span>{showPassword ? 'Hide' : 'Reveal'}</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-white border border-amber-200/80 shadow-2xs">
                      <span className="font-mono text-xs sm:text-sm font-extrabold tracking-wider text-slate-800 selection:bg-amber-200">
                        {showPassword ? createdStaff.temporaryPassword : '••••••••••••'}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyCredentials}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                      >
                        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>{copied ? 'Copied!' : 'Copy Credentials'}</span>
                      </button>
                    </div>

                    <p className="text-[11px] text-amber-800/90 leading-relaxed">
                      Share this temporary password securely with the staff member. They will sign in at the normal
                      staff login page using their email and this password.
                    </p>
                  </div>
                </div>
              ) : (
                /* FORM VIEW */
                <form id="create-staff-form" onSubmit={handleCreate} className="flex flex-col flex-1 overflow-hidden">
                  <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
                    {/* Error Alert */}
                    {errorMsg && (
                      <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
                        <div className="flex-1 font-medium">{errorMsg}</div>
                      </div>
                    )}

                    {/* Full Name */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Full Name *</label>
                      <input
                        id="staff-name-input"
                        type="text"
                        required
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="e.g. Deepak Verma"
                        className="mt-1 block w-full rounded-xl border border-slate-300 py-2 px-3 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-hidden transition-all"
                      />
                    </div>

                    {/* Staff Email */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Staff Email *</label>
                      <div className="relative mt-1">
                        <Mail className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                        <input
                          id="staff-email-input"
                          type="email"
                          required
                          value={form.email}
                          onChange={(e) => setForm({ ...form, email: e.target.value })}
                          placeholder="deepak@royalbespoke.com"
                          className="block w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-hidden transition-all"
                        />
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">Used for authenticating into the atelier dashboard.</p>
                    </div>

                    {/* System Role */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">System Role *</label>
                      <select
                        id="staff-role-select"
                        value={form.role}
                        onChange={(e) => setForm({ ...form, role: e.target.value })}
                        className="mt-1 block w-full rounded-xl border border-slate-300 py-2 px-3 text-xs font-medium text-slate-900 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-hidden transition-all cursor-pointer"
                      >
                        <option value="MANAGER">Manager (Operational Control & Staff Supervision)</option>
                        <option value="RECEPTIONIST">Receptionist (Client Intake, Measurements & Appointments)</option>
                        <option value="TAILOR">Master Tailor (Stitching, Assembly & Fitting Adjustments)</option>
                        <option value="CUTTER">Cutter (Pattern Grading & Fabric Laying)</option>
                        <option value="FINISHER">Finisher (Ironing, Hand-finishing & Buttonholes)</option>
                        <option value="CASHIER">Cashier (Billing Intake & Ledger Payments)</option>
                      </select>
                    </div>

                    {/* Branch Facility */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Branch Facility</label>
                      <select
                        id="staff-branch-select"
                        value={form.branchId}
                        onChange={(e) => setForm({ ...form, branchId: e.target.value })}
                        className="mt-1 block w-full rounded-xl border border-slate-300 py-2 px-3 text-xs text-slate-900 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-hidden transition-all cursor-pointer"
                      >
                        <option value="">All Branches / Main Atelier</option>
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name} ({b.code || 'HQ'})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Skills */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Skills / Specializations</label>
                      <input
                        id="staff-skills-input"
                        type="text"
                        value={form.skills}
                        onChange={(e) => setForm({ ...form, skills: e.target.value })}
                        placeholder="e.g. Suit Stitching, Canvas Padding, Sherwani Tailoring"
                        className="mt-1 block w-full rounded-xl border border-slate-300 py-2 px-3 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-hidden transition-all"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">Separate individual skills with commas.</p>
                    </div>

                    {/* Temporary Password Configuration */}
                    <div className="pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold text-slate-700">
                          Temporary Password *
                        </label>
                        <button
                          type="button"
                          onClick={handleRegeneratePassword}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
                        >
                          <RefreshCw className="h-3 w-3" />
                          <span>Generate New</span>
                        </button>
                      </div>

                      <div className="relative mt-1">
                        <Lock className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                        <input
                          id="staff-password-input"
                          type={showPassword ? 'text' : 'password'}
                          required
                          value={form.password}
                          onChange={(e) => setForm({ ...form, password: e.target.value })}
                          placeholder="Minimum 6 characters"
                          className="block w-full rounded-xl border border-slate-300 py-2 pl-9 pr-20 text-xs font-mono text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-hidden transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2.5 top-2 text-[11px] font-medium text-slate-500 hover:text-slate-800 cursor-pointer"
                        >
                          {showPassword ? 'Hide' : 'Show'}
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">
                        This temporary password will be hashed with bcrypt. You can share it directly with the staff member.
                      </p>
                    </div>
                  </div>

                  {/* Form Footer */}
                  <div className="flex items-center justify-end gap-2.5 p-3.5 sm:px-6 sm:py-3.5 bg-slate-50 border-t border-slate-100 shrink-0 rounded-b-2xl">
                    <button
                      type="button"
                      onClick={handleCloseModal}
                      disabled={submitting}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-md shadow-blue-500/20 disabled:opacity-50 transition-all cursor-pointer"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Creating...</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="h-3.5 w-3.5" />
                          <span>Create Staff Account</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* Success View Footer */}
              {createdStaff && (
                <div className="flex items-center justify-end gap-2.5 p-3.5 sm:px-6 sm:py-3.5 bg-slate-50 border-t border-slate-100 shrink-0 rounded-b-2xl">
                  <button
                    type="button"
                    onClick={handleOpenModal}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Add Another Staff
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
      </Modal>
    </div>
  );
};
