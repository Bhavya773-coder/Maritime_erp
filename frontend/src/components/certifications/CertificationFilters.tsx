import React from 'react';
import type { VesselSummary } from '../../api/certifications';

interface CertificationFiltersProps {
  filters: {
    status: string;
    certType: string;
    vesselId: string;
    assetType: string;
    expiringWithinDays: string;
    search: string;
  };
  setFilters: React.Dispatch<React.SetStateAction<{
    status: string;
    certType: string;
    vesselId: string;
    assetType: string;
    expiringWithinDays: string;
    search: string;
  }>>;
  vessels: VesselSummary[];
}

export const CertificationFilters: React.FC<CertificationFiltersProps> = ({ 
  filters, 
  setFilters,
  vessels 
}) => {
  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const certTypes = [
    'Survey Certificate',
    'GMB Registration',
    'MMD Registration',
    'Hull Insurance',
    'Condition Valuation',
    'Car & Bike Insurance',
    'Workman Compensation Insurance',
    'Land & Hotel Insurance'
  ];

  const assetTypes = [
    'Car & Bike Insurance',
    'Workman Compensation Insurance',
    'Land & Hotel Insurance'
  ];

  return (
    <div className="glassmorphism p-5 rounded-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 items-end text-sm">
      {/* Search Input */}
      <div>
        <label htmlFor="search" className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Search</label>
        <input
          type="text"
          id="search"
          name="search"
          value={filters.search}
          onChange={handleTextChange}
          placeholder="Number or issuer..."
          className="block w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      {/* Status Filter */}
      <div>
        <label htmlFor="status" className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Status</label>
        <select
          id="status"
          name="status"
          value={filters.status}
          onChange={handleSelectChange}
          className="block w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer"
        >
          <option value="all">All Statuses</option>
          <option value="VALID">Valid</option>
          <option value="EXPIRING_SOON">Expiring Soon</option>
          <option value="EXPIRED">Expired</option>
        </select>
      </div>

      {/* Expiring Within Days */}
      <div>
        <label htmlFor="expiringWithinDays" className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Expiring Within</label>
        <select
          id="expiringWithinDays"
          name="expiringWithinDays"
          value={filters.expiringWithinDays}
          onChange={handleSelectChange}
          className="block w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer"
        >
          <option value="all">Any Window</option>
          <option value="7">7 Days</option>
          <option value="30">30 Days</option>
          <option value="90">90 Days</option>
        </select>
      </div>

      {/* Cert Type Filter */}
      <div>
        <label htmlFor="certType" className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Cert Type</label>
        <select
          id="certType"
          name="certType"
          value={filters.certType}
          onChange={handleSelectChange}
          className="block w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer"
        >
          <option value="all">All Types</option>
          {certTypes.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>

      {/* Vessel Link Filter */}
      <div>
        <label htmlFor="vesselId" className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Vessel Link</label>
        <select
          id="vesselId"
          name="vesselId"
          value={filters.vesselId}
          onChange={handleSelectChange}
          className="block w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer"
        >
          <option value="all">All Vessels</option>
          {vessels.map(v => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>
      </div>

      {/* Asset Type Link Filter */}
      <div>
        <label htmlFor="assetType" className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Asset Type</label>
        <select
          id="assetType"
          name="assetType"
          value={filters.assetType}
          onChange={handleSelectChange}
          className="block w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer"
        >
          <option value="all">All Assets</option>
          {assetTypes.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>
    </div>
  );
};
