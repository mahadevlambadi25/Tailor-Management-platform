import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { api } from '../../api/client';
import { Trash2, AlertCircle, X, Loader2 } from 'lucide-react';

interface DeleteStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: { id: string; name: string; email: string } | null;
  onSuccess?: (message: string) => void;
}

export const DeleteStaffModal: React.FC<DeleteStaffModalProps> = ({
  isOpen,
  onClose,
  staff,
  onSuccess
}) => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleDelete = async () => {
    if (!staff) return;
    setErrorMsg('');

    try {
      setLoading(true);
      const res = await api.delete(`/users/${staff.id}`);

      if (res.data.success) {
        onClose();
        if (onSuccess) {
          onSuccess(res.data.message || `Staff member ${staff.name} was removed successfully.`);
        }
      }
    } catch (err: any) {
      setErrorMsg(
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        'Failed to delete staff member. Workspace owners cannot be deleted.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { setErrorMsg(''); onClose(); }}
      maxWidth="max-w-md"
      className="rounded-2xl shadow-2xl overflow-hidden"
      ariaLabel="Delete Staff Member?"
    >
      <div className="w-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 p-4 sm:px-6 sm:py-4 bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600 border border-rose-200">
              <Trash2 className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Delete Staff Member?</h2>
              <p className="text-xs text-rose-600 font-medium">Permanent destructive action</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { setErrorMsg(''); onClose(); }}
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 space-y-4">
          {errorMsg && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 flex items-start gap-2 shadow-2xs">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
              <div className="flex-1 font-medium">{errorMsg}</div>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
              Are you sure you want to permanently remove{' '}
              <span className="font-bold text-slate-900">{staff?.name}</span> from this workspace?
            </p>
            <p className="text-xs text-rose-600 font-medium leading-relaxed">
              This action cannot be undone.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs flex justify-between items-center">
            <span className="text-slate-500">Staff Account</span>
            <div className="text-right">
              <span className="font-bold text-slate-900 block">{staff?.name}</span>
              <span className="text-[11px] text-slate-500 font-mono">{staff?.email}</span>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => { setErrorMsg(''); onClose(); }}
              disabled={loading}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white shadow-md shadow-rose-600/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <span>Delete Staff</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
