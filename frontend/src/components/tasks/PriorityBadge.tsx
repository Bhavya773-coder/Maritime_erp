import React from 'react';

interface PriorityBadgeProps {
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority }) => {
  const styles = {
    HIGH: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    MEDIUM: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    LOW: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  };

  const labels = {
    HIGH: 'High',
    MEDIUM: 'Medium',
    LOW: 'Low',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${styles[priority] || styles.LOW}`}>
      {labels[priority] || priority}
    </span>
  );
};
