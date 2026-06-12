import React from 'react';
import type { VesselStatus } from '../../api/vessels';

interface VesselStatusBadgeProps {
  status: VesselStatus;
}

export const VesselStatusBadge: React.FC<VesselStatusBadgeProps> = ({ status }) => {
  const getStyles = () => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25';
      case 'IN_PORT':
        return 'bg-sky-500/10 text-sky-400 border-sky-500/25';
      case 'MAINTENANCE':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/25';
      case 'NON_COMPLIANT':
        return 'bg-red-500/10 text-red-400 border-red-500/25 animate-pulse';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/25';
    }
  };

  const formatText = (text: string) => {
    return text.replace('_', ' ');
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStyles()}`}>
      {formatText(status)}
    </span>
  );
};
