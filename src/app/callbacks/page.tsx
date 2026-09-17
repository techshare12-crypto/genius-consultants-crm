'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Badge, StageBadge } from '@/components/common/Badge';
import { Modal } from '@/components/common/Modal';
import { formatISTDateTime } from '@/server/utils/date';
import {
  CalendarClock,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  PhoneCall,
  User,
  Check,
} from 'lucide-react';

export default function CallbacksPage() {
  const { user } = useAuth();
  const [callbacks, setCallbacks] = useState<any[]>([]);
  const [tab, setTab] = useState<'ALL' | 'TODAY' | 'OVERDUE' | 'UPCOMING' | 'COMPLETED'>('TODAY');
  const [loading, setLoading] = useState(true);

  // Complete Callback Modal
  const [selectedCb, setSelectedCb] = useState<any | null>(null);
  const [completionRemarks, setCompletionRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCallbacks();
  }, [tab]);

  const fetchCallbacks = async () => {
    setLoading(true);
    try {
      let url = '/api/callbacks';
      if (tab === 'COMPLETED') {
        url += '?status=COMPLETED';
      } else if (tab !== 'ALL') {
        url += `?type=${tab}`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const d = await res.json();
        setCallbacks(d.data || []);
      }
    } catch (err) {
      console.error('Error loading callbacks', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteCallback = async () => {
    if (!selectedCb || !completionRemarks) return;
    setSubmitting(true);

    try {
      const res = await fetch(`/api/callbacks/${selectedCb.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completionRemarks }),
      });

      if (res.ok) {
        setSelectedCb(null);
        setCompletionRemarks('');
        await fetchCallbacks();
      }
    } catch (err) {
      console.error('Error completing callback', err);
    } finally {
      setSubmitting(false);
    }
  };

  const overdueCount = callbacks.filter((c) => c.isOverdue).length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-teal-600 uppercase tracking-wider">
            INDEPENDENT CALLBACK MANAGEMENT
          </span>
          <h2 className="text-lg font-bold text-slate-900 mt-0.5">Scheduled Callbacks & Follow-up Queue</h2>
          <p className="text-xs text-slate-500">
            Never miss a candidate follow-up. Dynamic overdue detection and 1-click completion.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
          <button
            onClick={() => setTab('TODAY')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              tab === 'TODAY' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Today's Callbacks
          </button>
          <button
            onClick={() => setTab('OVERDUE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              tab === 'OVERDUE' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Overdue</span>
          </button>
          <button
            onClick={() => setTab('UPCOMING')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              tab === 'UPCOMING' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Upcoming
          </button>
          <button
            onClick={() => setTab('COMPLETED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              tab === 'COMPLETED' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Completed
          </button>
        </div>
      </div>

      {/* Callbacks Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Candidate & Phone</th>
                <th className="py-3 px-4">Job Requirement</th>
                <th className="py-3 px-4">Scheduled Time</th>
                <th className="py-3 px-4">Status & Priority</th>
                <th className="py-3 px-4">Reason / Notes</th>
                <th className="py-3 px-4">Executive</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {callbacks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No callbacks found for this view.
                  </td>
                </tr>
              ) : (
                callbacks.map((cb) => (
                  <tr key={cb.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{cb.candidate?.fullName}</div>
                      <div className="font-mono text-[11px] text-teal-700">{cb.candidate?.normalizedPhone}</div>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-700">
                      {cb.application?.job?.jobTitle || 'General Opening'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{new Date(cb.scheduledAt).toLocaleDateString()}</div>
                      <div className="text-[11px] text-slate-500">{new Date(cb.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-1 items-start">
                        {cb.isOverdue ? (
                          <Badge variant="danger">OVERDUE</Badge>
                        ) : cb.status === 'COMPLETED' ? (
                          <Badge variant="success">COMPLETED</Badge>
                        ) : (
                          <Badge variant="warning">PENDING</Badge>
                        )}
                        <span className="text-[10px] text-slate-400 font-semibold">{cb.priority} Priority</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 max-w-xs">
                      <p className="text-slate-800 line-clamp-2">{cb.reason}</p>
                      {cb.completionRemarks && (
                        <p className="text-[11px] text-emerald-700 mt-0.5">Note: {cb.completionRemarks}</p>
                      )}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-600">{cb.executive?.fullName}</td>
                    <td className="py-3 px-4 text-right">
                      {cb.status === 'PENDING' && (
                        <button
                          onClick={() => setSelectedCb(cb)}
                          className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-semibold text-xs transition-colors shadow-sm"
                        >
                          Complete Callback
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Complete Callback Modal */}
      <Modal
        isOpen={!!selectedCb}
        onClose={() => setSelectedCb(null)}
        title="Complete Scheduled Callback"
        subtitle={`Log completion notes for ${selectedCb?.candidate?.fullName}`}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Completion Remarks</label>
            <textarea
              rows={3}
              required
              value={completionRemarks}
              onChange={(e) => setCompletionRemarks(e.target.value)}
              placeholder="e.g. Connected with candidate, confirmed willingness for field sales, scheduled screening."
              className="w-full p-2.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setSelectedCb(null)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleCompleteCallback}
              disabled={!completionRemarks || submitting}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
            >
              Mark Completed
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
