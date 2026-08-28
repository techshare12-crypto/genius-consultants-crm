import React, { useState, useEffect } from 'react';
import { activityLogsApi } from '../services/api';
import { ActivityLog } from '../types';
import { formatDateTime } from '../utils/helpers';
import { RefreshCw } from 'lucide-react';

export const ActivityLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionFilter, setActionFilter] = useState<string>('ALL');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await activityLogsApi.list({ action: actionFilter });
      setLogs(res.data.logs);
    } catch (err) {
      console.error('Failed to load activity logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [actionFilter]);

  return (
    <div className="space-y-4 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black tracking-tight text-slate-900">
              System Audit & Activity Trail
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800">
              Immutable Log
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Full operational accountability tracking user actions, candidate status updates, shortlists, and imports.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-600">Action Type:</span>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-xl bg-slate-50 font-medium text-slate-700"
          >
            <option value="ALL">All System Actions</option>
            <option value="USER_LOGIN">User Logins</option>
            <option value="CALL_LOGGED">Call Attempts Logged</option>
            <option value="CANDIDATE_CREATED">Candidate Created</option>
            <option value="CANDIDATE_UPDATED">Candidate Updated</option>
            <option value="CANDIDATE_SHORTLISTED">Candidate Shortlisted</option>
            <option value="LEAD_ASSIGNED">Lead Assigned</option>
            <option value="LEADS_IMPORTED">Leads Imported</option>
            <option value="AUTO_DISTRIBUTE_LEADS">Auto Distribute</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
                <th className="p-3.5 whitespace-nowrap">Timestamp</th>
                <th className="p-3.5 whitespace-nowrap">User</th>
                <th className="p-3.5 whitespace-nowrap">Action Type</th>
                <th className="p-3.5 whitespace-nowrap">Candidate Reference</th>
                <th className="p-3.5">Details & Modification Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-slate-400">Loading audit logs...</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-slate-400">No logs found.</td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="p-3.5 whitespace-nowrap font-mono text-slate-400 text-[11px]">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="p-3.5 whitespace-nowrap font-bold text-slate-800">
                      {log.user ? `${log.user.name} (${log.user.role})` : 'System'}
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 font-mono font-bold text-[10px]">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3.5 whitespace-nowrap font-semibold text-slate-900">
                      {log.candidate ? `${log.candidate.name} (${log.candidate.displaySlNo})` : '-'}
                    </td>
                    <td className="p-3.5 text-slate-600">
                      {log.details || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
