import React from 'react';

interface VesselFiltersProps {
  filters: {
    type: string;
    status: string;
    search: string;
  };
  setFilters: React.Dispatch<React.SetStateAction<{
    type: string;
    status: string;
    search: string;
  }>>;
}

export const VesselFilters: React.FC<VesselFiltersProps> = ({ filters, setFilters }) => {
  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="glassmorphism p-5 rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-4 items-end text-sm">
      <div>
        <label htmlFor="search-input" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Search Vessel</label>
        <input
          type="text"
          id="search-input"
          name="search"
          value={filters.search}
          onChange={handleTextChange}
          placeholder="Search by name or reg number..."
          className="block w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      <div>
        <label htmlFor="type-select" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Vessel Type</label>
        <select
          id="type-select"
          name="type"
          value={filters.type}
          onChange={handleSelectChange}
          className="block w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer"
        >
          <option value="all">All Types</option>
          <option value="BARGE">Barge</option>
          <option value="TUG">Tug</option>
        </select>
      </div>

      <div>
        <label htmlFor="status-select" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Status</label>
        <select
          id="status-select"
          name="status"
          value={filters.status}
          onChange={handleSelectChange}
          className="block w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer"
        >
          <option value="all">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="IN_PORT">In Port</option>
          <option value="MAINTENANCE">Maintenance</option>
          <option value="NON_COMPLIANT">Non Compliant</option>
        </select>
      </div>
    </div>
  );
};
