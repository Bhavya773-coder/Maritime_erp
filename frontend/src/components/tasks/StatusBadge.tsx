import React from 'react';

interface StatusBadgeProps {
  status: 'PENDING' | 'IN_PROGRESS' | 'DELEGATED' | 'COMPLETED' | 'OVERDUE';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const styles = {
    PENDING: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    IN_PROGRESS: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    DELEGATED: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    COMPLETED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    OVERDUE: 'bg-red-500/10 text-red-400 border-red-500/20',
  };

  const labels = {
    PENDING: 'Pending',
    IN_PROGRESS: 'In Progress',
    DELEGATED: 'Delegated',
    COMPLETED: 'Completed',
    OVERDUE: 'Overdue',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles[status] || styles.PENDING}`}>
      {labels[status] || status}
    </span>
  );
};
