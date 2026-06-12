import React from 'react';
import { Link } from 'react-router-dom';
import type { Certification } from '../../api/certifications';
import { CertificationStatusBadge } from './CertificationStatusBadge';
import { FileText, ChevronRight, HardHat, Ship } from 'lucide-react';

interface CertificationCardProps {
  cert: Certification;
}

export const CertificationCard: React.FC<CertificationCardProps> = ({ cert }) => {
  const formattedExpiry = new Date(cert.expiryDate).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  const getDaysClass = () => {
    if (cert.daysToExpiry <= 0) return 'text-rose-500 font-bold';
    if (cert.daysToExpiry <= 30) return 'text-amber-500 font-bold';
    return 'text-emerald-500';
  };

  const isVesselLinked = !!cert.vesselId;

  return (
    <div className="rounded-xl bg-slate-900 border border-slate-800 p-5 hover:border-slate-700 transition-all flex flex-col justify-between group shadow-lg">
      <div>
        <div className="flex items-start justify-between mb-4">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {cert.certNumber}
            </span>
            <h3 className="text-base font-bold text-white mt-1 group-hover:text-brand-400 transition-colors">
              {cert.certType}
            </h3>
          </div>
          <CertificationStatusBadge status={cert.status} />
        </div>

        {/* Linkages display */}
        <div className="mb-4 bg-slate-950/40 rounded-lg p-2.5 border border-slate-850 flex items-center space-x-2 text-xs">
          {isVesselLinked ? (
            <>
              <Ship className="h-4 w-4 text-sky-400" />
              <div className="overflow-hidden">
                <span className="text-slate-500">Vessel: </span>
                <Link to={`/fleet/${cert.vesselId}`} className="font-semibold text-sky-400 hover:underline">
                  {cert.vessel?.name || 'Unnamed Vessel'}
                </Link>
              </div>
            </>
          ) : (
            <>
              <HardHat className="h-4 w-4 text-amber-500" />
              <div className="overflow-hidden">
                <span className="text-slate-500">Asset: </span>
                <span className="font-semibold text-slate-300">
                  {cert.assetType || 'Non-Vessel'}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-xs border-t border-slate-850 pt-4 mb-4">
          <div>
            <span className="block text-slate-500 font-medium">Issuer</span>
            <span className="block text-slate-300 font-semibold truncate mt-0.5" title={cert.issuingAuthority}>
              {cert.issuingAuthority}
            </span>
          </div>
          <div>
            <span className="block text-slate-500 font-medium">Expiry</span>
            <span className="block text-slate-300 font-semibold mt-0.5">
              {formattedExpiry}
            </span>
          </div>
          <div className="col-span-2 flex items-center justify-between mt-1.5 bg-slate-950/20 px-2.5 py-1.5 rounded border border-slate-850/50">
            <span className="text-slate-500">Days to Expiry:</span>
            <span className={`text-xs font-semibold ${getDaysClass()}`}>
              {cert.daysToExpiry <= 0 ? 'Expired' : `${cert.daysToExpiry} days`}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-slate-850 pt-4 mt-2">
        <div>
          {cert.documentUrl ? (
            <a 
              href={cert.documentUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-xs text-brand-400 hover:text-brand-350 hover:underline flex items-center space-x-1 font-semibold"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>View PDF</span>
            </a>
          ) : (
            <span className="text-xs text-slate-650 flex items-center space-x-1 select-none">
              <FileText className="h-3.5 w-3.5 text-slate-600" />
              <span>No document</span>
            </span>
          )}
        </div>

        <Link 
          to={`/certifications/${cert.id}`} 
          className="text-xs font-bold text-brand-400 group-hover:text-brand-300 transition-all flex items-center space-x-0.5 hover:underline"
        >
          <span>Details</span>
          <ChevronRight className="h-3.5 w-3.5 mt-0.5" />
        </Link>
      </div>
    </div>
  );
};
