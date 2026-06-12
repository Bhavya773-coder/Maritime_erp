import React from 'react';
import type { CertificateStatus } from '../../api/certifications';

interface CertificationStatusBadgeProps {
  status: CertificateStatus;
}

export const CertificationStatusBadge: React.FC<CertificationStatusBadgeProps> = ({ status }) => {
  const getStyles = () => {
    switch (status) {
      case 'VALID':
        return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';
      case 'EXPIRING_SOON':
        return 'bg-amber-500/10 border-amber-500/30 text-amber-400';
      case 'EXPIRED':
        return 'bg-rose-500/10 border-rose-500/30 text-rose-400';
      default:
        return 'bg-slate-500/10 border-slate-500/30 text-slate-400';
    }
  };

  const getLabel = () => {
    switch (status) {
      case 'VALID':
        return 'Valid';
      case 'EXPIRING_SOON':
        return 'Expiring Soon';
      case 'EXPIRED':
        return 'Expired';
      default:
        return status;
    }
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border ${getStyles()}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current mr-1.5"></span>
      {getLabel()}
    </span>
  );
};
