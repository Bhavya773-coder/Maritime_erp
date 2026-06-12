import React from 'react';
import type { Certification } from '../../api/certifications';
import { Shield, ShieldAlert, AlertTriangle, ShieldCheck } from 'lucide-react';

interface ComplianceSummaryCardsProps {
  certifications: Certification[];
}

export const ComplianceSummaryCards: React.FC<ComplianceSummaryCardsProps> = ({ certifications }) => {
  const total = certifications.length;
  const valid = certifications.filter(c => c.status === 'VALID').length;
  const expiringSoon = certifications.filter(c => c.status === 'EXPIRING_SOON').length;
  const expired = certifications.filter(c => c.status === 'EXPIRED').length;

  const expiring7 = certifications.filter(c => c.daysToExpiry >= 0 && c.daysToExpiry <= 7).length;
  const expiring30 = certifications.filter(c => c.daysToExpiry >= 0 && c.daysToExpiry <= 30).length;
  const expiring90 = certifications.filter(c => c.daysToExpiry >= 0 && c.daysToExpiry <= 90).length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Total Card */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 p-5 flex items-center space-x-4">
        <div className="p-3 bg-brand-500/10 rounded-lg text-brand-400">
          <Shield className="h-6 w-6" />
        </div>
        <div>
          <p className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Total Certificates</p>
          <p className="text-2xl font-bold text-white mt-1">{total}</p>
        </div>
      </div>

      {/* Valid Card */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 p-5 flex items-center space-x-4">
        <div className="p-3 bg-emerald-500/10 rounded-lg text-emerald-400">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div>
          <p className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Valid (Active)</p>
          <p className="text-2xl font-bold text-green-400 mt-1">{valid}</p>
        </div>
      </div>

      {/* Expiring Soon Card */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 p-5 flex flex-col justify-between">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-amber-500/10 rounded-lg text-amber-400">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Expiring Soon</p>
            <p className="text-2xl font-bold text-amber-400 mt-1">{expiringSoon}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 border-t border-slate-850 mt-4 pt-3 text-[10px] text-slate-400">
          <div>
            <span className="block font-bold text-white">{expiring7}</span>
            <span>&le; 7 days</span>
          </div>
          <div>
            <span className="block font-bold text-white">{expiring30}</span>
            <span>&le; 30 days</span>
          </div>
          <div>
            <span className="block font-bold text-white">{expiring90}</span>
            <span>&le; 90 days</span>
          </div>
        </div>
      </div>

      {/* Expired Card */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 p-5 flex items-center space-x-4">
        <div className="p-3 bg-rose-500/10 rounded-lg text-rose-400">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <div>
          <p className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Expired</p>
          <p className="text-2xl font-bold text-red-400 mt-1">{expired}</p>
        </div>
      </div>
    </div>
  );
};
