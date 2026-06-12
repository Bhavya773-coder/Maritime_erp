import React from 'react';
import type { LocationHistory } from '../../api/vessels';
import { MapPin, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface VesselHistoryTableProps {
  history: LocationHistory[];
  page: number;
  totalPages: number;
  onPageChange: (newPage: number) => void;
  total: number;
}

export const VesselHistoryTable: React.FC<VesselHistoryTableProps> = ({
  history,
  page,
  totalPages,
  onPageChange,
  total,
}) => {
  if (history.length === 0) {
    return (
      <div className="glassmorphism p-8 text-center rounded-xl border border-slate-800/60">
        <MapPin className="h-8 w-8 text-slate-650 mx-auto mb-3" />
        <p className="text-slate-400 text-xs">No location history found for this vessel.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="glassmorphism rounded-2xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900/60 border-b border-slate-800 text-slate-400 font-semibold select-none">
                <th className="px-6 py-4">Location</th>
                <th className="px-6 py-4">Coordinates</th>
                <th className="px-6 py-4">Updated At</th>
                <th className="px-6 py-4">Updated By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850">
              {history.map((item) => (
                <tr key={item.id} className="hover:bg-slate-900/20 transition-all group">
                  <td className="px-6 py-4 font-medium text-slate-200 group-hover:text-white transition-colors">
                    <div className="flex items-center space-x-2">
                      <MapPin className="h-3.5 w-3.5 text-slate-550 shrink-0" />
                      <span>{item.location}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-300 font-mono text-[11px]">
                    {item.latitude.toFixed(4)}° N, {item.longitude.toFixed(4)}° E
                  </td>
                  <td className="px-6 py-4 text-slate-400">
                    <div className="flex items-center space-x-1.5">
                      <Calendar className="h-3.5 w-3.5 text-slate-550 shrink-0" />
                      <span>{new Date(item.updatedAt).toLocaleString()}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-300">
                    <div className="flex items-center space-x-2">
                      <div className="h-6 w-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400">
                        {item.updatedBy?.name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-200 leading-tight">
                          {item.updatedBy?.name || 'System'}
                        </div>
                        <div className="text-[9px] text-slate-500 capitalize leading-none mt-0.5">
                          {item.updatedBy?.role?.toLowerCase().replace('_', ' ') || 'Unknown'}
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2 text-xs select-none">
          <span className="text-slate-400">
            Showing page <strong className="text-slate-200">{page}</strong> of <strong className="text-slate-200">{totalPages}</strong> ({total} records total)
          </span>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
