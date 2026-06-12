import React from 'react';
import type { AlertLog } from '../../api/certifications';
import { Bell, Calendar } from 'lucide-react';

interface AlertHistoryTableProps {
  logs: AlertLog[];
}

export const AlertHistoryTable: React.FC<AlertHistoryTableProps> = ({ logs }) => {
  if (!logs || logs.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
        <Bell className="h-10 w-10 text-slate-700 mx-auto mb-3" />
        <h4 className="text-slate-400 font-semibold text-sm">No Expiry Alerts Logged</h4>
        <p className="text-slate-650 text-xs mt-1 max-w-sm mx-auto">
          No compliance expiry alerts have been triggered or registered for this certificate yet.
        </p>
      </div>
    );
  }

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
      <div className="px-5 py-4 border-b border-slate-800 flex items-center space-x-2.5">
        <Bell className="h-4 w-4 text-brand-400" />
        <h3 className="font-bold text-sm text-slate-200">Alert Notification History</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-950/40 text-slate-400 font-semibold border-b border-slate-800">
              <th className="p-4">Alert Trigger Event</th>
              <th className="p-4">Check Window Trigger</th>
              <th className="p-4 text-right">Logged At</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-850">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-slate-850/25 transition-colors">
                <td className="p-4 flex items-center space-x-2 font-medium text-slate-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                  <span>Compliance warning log generated</span>
                </td>
                <td className="p-4">
                  <span className="bg-slate-800 text-slate-300 font-bold px-2 py-0.5 rounded border border-slate-700">
                    {log.alertWindow} days before expiry
                  </span>
                </td>
                <td className="p-4 text-right text-slate-450 flex items-center justify-end space-x-1.5">
                  <Calendar className="h-3.5 w-3.5 text-slate-600" />
                  <span>{formatDateTime(log.sentAt)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
