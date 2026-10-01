import React, { useState } from 'react';
import { api } from '../../api/client';
import { trackFunnelEvent } from '../../utils/funnel';
import { Users, UserPlus, Check, X, Send } from 'lucide-react';
import { Modal } from '../common/Modal';

interface TeamInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const TeamInviteModal: React.FC<TeamInviteModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('CUTTER');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [invitedResult, setInvitedResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const roles = [
    { key: 'CUTTER', label: 'Cutter (Cutting queue & pattern specs)' },
    { key: 'TAILOR', label: 'Tailor (Stitching board & measurements)' },
    { key: 'FINISHER', label: 'Finisher (Handwork & buttonhole)' },
    { key: 'MANAGER', label: 'Production Manager (Full workshop board)' },
    { key: 'RECEPTIONIST', label: 'Receptionist (Front desk orders)' }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      setError('Please provide staff name and mobile phone number.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await api.post('/conversion/team/invite', {
        name: name.trim(),
        phone: phone.trim(),
        role,
        email: email.trim() || undefined
      });

      if (res.data?.success) {
        setInvitedResult(res.data.data);
        await trackFunnelEvent('staff_invited', { role, name: name.trim() });
        if (onSuccess) onSuccess();
      }
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || 'Failed to send invite');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-md"
      className="rounded-3xl p-6 sm:p-8 border border-slate-100 text-left space-y-5"
      ariaLabel="Invite your team"
    >
      <div className="w-full relative space-y-5">
        
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="space-y-1.5 pr-6">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[11px] font-bold uppercase tracking-wider">
            <Users className="h-3 w-3" />
            Team Collaboration
          </div>
          <h3 className="text-lg sm:text-xl font-extrabold text-slate-950">
            Invite your team
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Your cutter shouldn't have to walk up to the counter to ask. Invite them, and they'll see only their own jobs.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
            {error}
          </div>
        )}

        {!invitedResult ? (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Staff Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Deepak Cutter"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Mobile Phone *
              </label>
              <input
                type="tel"
                placeholder="e.g. 9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Workshop Role *
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs text-slate-900 bg-white focus:border-blue-500 focus:outline-none"
              >
                {roles.map(r => (
                  <option key={r.key} value={r.key}>{r.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Email Address (Optional)
              </label>
              <input
                type="email"
                placeholder="e.g. deepak@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all active:scale-[0.98]"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>{loading ? 'Sending...' : 'Invite my team'}</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="py-4 text-center space-y-4 animate-in fade-in">
            <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <Check className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-900">
                Invitation Prepared for {invitedResult.user?.name}
              </h4>
              <p className="text-xs text-slate-600">
                Role: {invitedResult.user?.role} • Mobile: {invitedResult.user?.phone}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-left text-xs space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Preview message:</span>
              <p className="text-slate-700 font-mono text-[11px]">{invitedResult.outbox?.rendered}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800"
            >
              Done
            </button>
          </div>
        )}

      </div>
    </Modal>
  );
};
