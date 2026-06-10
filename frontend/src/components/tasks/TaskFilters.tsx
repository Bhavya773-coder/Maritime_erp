import React from 'react';

interface TaskFiltersProps {
  filters: {
    type: string;
    status: string;
    priority: string;
    overdue: boolean;
  };
  setFilters: React.Dispatch<React.SetStateAction<{
    type: string;
    status: string;
    priority: string;
    overdue: boolean;
  }>>;
}

export const TaskFilters: React.FC<TaskFiltersProps> = ({ filters, setFilters }) => {
  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFilters(prev => ({ ...prev, [name]: checked }));
  };

  return (
    <div className="glassmorphism p-5 rounded-xl grid grid-cols-1 sm:grid-cols-4 gap-4 items-end text-sm">
      <div>
        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Task Type</label>
        <select
          name="type"
          value={filters.type}
          onChange={handleSelectChange}
          className="block w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer"
        >
          <option value="all">All Types</option>
          <option value="assigned">Assigned</option>
          <option value="personal">Personal</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Status</label>
        <select
          name="status"
          value={filters.status}
          onChange={handleSelectChange}
          className="block w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="delegated">Delegated</option>
          <option value="completed">Completed</option>
          <option value="overdue">Overdue</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Priority</label>
        <select
          name="priority"
          value={filters.priority}
          onChange={handleSelectChange}
          className="block w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer"
        >
          <option value="all">All Priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      <div className="flex items-center space-x-2 py-3">
        <input
          type="checkbox"
          id="overdue-checkbox"
          name="overdue"
          checked={filters.overdue}
          onChange={handleCheckboxChange}
          className="h-4 w-4 rounded border-slate-800 bg-slate-900 text-brand-600 focus:ring-brand-500 focus:ring-offset-slate-950 focus:ring-offset-2 cursor-pointer"
        />
        <label htmlFor="overdue-checkbox" className="text-slate-300 font-semibold cursor-pointer select-none">
          Show Overdue Only
        </label>
      </div>
    </div>
  );
};
