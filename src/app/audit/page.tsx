'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/common/Badge';
import { ShieldCheck, Search, Filter, Clock, User } from 'lucide-react';

export default function AuditTrailPage() {
  const { hasPermission } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [entityFilter, setEntityFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, [entityFilter, actionFilter]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let url = '/api/audit?limit=100';
      if (entityFilter) url += `&entity=${entityFilter}`;
      if (actionFilter) url += `&action=${actionFilter}`;

      const res = await fetch(url);
      if (res.ok) {
        const d = await res.json();
        setLogs(d.data || []);
      }
    } catch (err) {
      console.error('Error fetching audit logs', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-teal-600 uppercase tracking-wider">
            GOVERNANCE & COMPLIANCE
          </span>
          <h2 className="text-lg font-bold text-slate-900 mt-0.5">Immutable Audit Trail Logs</h2>
          <p className="text-xs text-slate-500">
            Chronological record of every lead assignment, call logging, screening decision, submission, and role modification.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium"
          >
            <option value="">All Entities</option>
            <option value="Application">Application</option>
            <option value="CallLog">CallLog</option>
            <option value="Screening">Screening</option>
            <option value="ClientSubmission">ClientSubmission</option>
            <option value="Interview">Interview</option>
            <option value="Candidate">Candidate</option>
            <option value="User">User</option>
            <option value="ImportBatch">ImportBatch</option>
          </select>

          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium"
          >
            <option value="">All Actions</option>
            <option value="APPLICATION_ASSIGNED">Application Assigned</option>
            <option value="APPLICATION_REASSIGNED">Application Reassigned</option>
            <option value="CALL_LOGGED">Call Logged</option>
            <option value="SCREENING_EVALUATED">Screening Evaluated</option>
            <option value="ADDED_TO_FINAL_SHORTLIST">Added to Final Shortlist</option>
            <option value="CLIENT_SUBMISSION_CREATED">Client Submission</option>
            <option value="INTERVIEW_SCHEDULED">Interview Scheduled</option>
            <option value="INTERVIEW_OUTCOME_UPDATED">Interview Outcome</option>
            <option value="JOINING_STATUS_UPDATED">Joining Updated</option>
            <option value="USER_CREATED">User Created</option>
            <option value="USER_LOGIN">User Login</option>
          </select>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Timestamp (IST)</th>
                <th className="py-3 px-4">Action Event</th>
                <th className="py-3 px-4">Target Entity</th>
                <th className="py-3 px-4">Actor / Performed By</th>
                <th className="py-3 px-4">State Delta / Changes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 font-sans">
                    No audit records match the selected filters.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 text-slate-500 font-sans">
                      {new Date(log.createdAt).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-4 font-bold text-teal-700 font-sans">
                      <Badge variant="purple">{log.action}</Badge>
                    </td>
                    <td className="py-3 px-4 font-sans">
                      <span className="font-semibold text-slate-900">{log.entity}</span>
                      <span className="text-slate-400 text-[10px] block font-mono">ID: {log.entityId}</span>
                    </td>
                    <td className="py-3 px-4 font-sans font-semibold text-slate-800">
                      {log.user?.fullName || 'System Event'}
                    </td>
                    <td className="py-3 px-4 max-w-md truncate text-slate-600">
                      {log.newValues || '-'}
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
}
