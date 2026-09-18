import React from 'react';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const s = status.toUpperCase();

  let colors = 'bg-slate-100 text-slate-700 border-slate-300';

  if (['RECEIVED', 'PENDING', 'UNPAID'].includes(s)) {
    colors = 'bg-amber-50 text-amber-700 border-amber-300';
  } else if (['CUTTING', 'STITCHING', 'FINISHING', 'IN_PROGRESS', 'PARTIAL'].includes(s)) {
    colors = 'bg-blue-50 text-blue-700 border-blue-300';
  } else if (['TRIAL', 'TRIAL_PENDING', 'ALTERATION', 'ALTERATION_PENDING'].includes(s)) {
    colors = 'bg-purple-50 text-purple-700 border-purple-300';
  } else if (['READY', 'READY_FOR_PICKUP'].includes(s)) {
    colors = 'bg-teal-50 text-teal-700 border-teal-300';
  } else if (['DELIVERED', 'PAID', 'COMPLETED', 'APPROVED'].includes(s)) {
    colors = 'bg-emerald-50 text-emerald-700 border-emerald-300';
  } else if (['CANCELLED', 'OVERDUE', 'FAILED'].includes(s)) {
    colors = 'bg-rose-50 text-rose-700 border-rose-300';
  }

  const px = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-semibold';

  return (
    <span className={`inline-flex items-center rounded-full border font-medium uppercase tracking-wider ${px} ${colors}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
};
