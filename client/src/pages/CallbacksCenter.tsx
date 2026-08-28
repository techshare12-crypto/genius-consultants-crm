import React, { useState, useEffect } from 'react';
import { Callback, User } from '../types';
import { callbacksApi, authApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatPhone, formatDate } from '../utils/helpers';
import { Modal } from '../components/common/Modal';
import {
  PhoneCall,
  CheckCircle2,
  RefreshCw,
  XCircle,
} from 'lucide-react';

interface CallbacksCenterProps {
  onOpenCandidateProfile: (candidateId: string) => void;
  onStartCall: (candidate: any) => void;
}

export const CallbacksCenter: React.FC<CallbacksCenterProps> = ({
  onOpenCandidateProfile,
  onStartCall,
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'TODAY' | 'OVERDUE' | 'UPCOMING' | 'COMPLETED'>('TODAY');
  const [callbacks, setCallbacks] = useState<Callback[]>([]);
  const [counts, setCounts] = useState({ today: 0, overdue: 0, upcoming: 0, completed: 0 });
  const [loading, setLoading] = useState<boolean>(true);
  const [executives, setExecutives] = useState<User[]>([]);
  const [selectedExec, setSelectedExec] = useState<string>('ALL');

  // Reschedule Modal
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState<boolean>(false);
  const [targetCallback, setTargetCallback] = useState<Callback | null>(null);
  const [newDate, setNewDate] = useState<string>('');
  const [newTime, setNewTime] = useState<string>('11:00');
  const [newPriority, setNewPriority] = useState<string>('MEDIUM');

  const fetchCallbacks = async () => {
    setLoading(true);
    try {
      const res = await callbacksApi.list({
        tab: activeTab,
        executiveId: selectedExec,
      });
      setCallbacks(res.data.callbacks);
      setCounts(res.data.counts);
    } catch (err) {
      console.error('Failed to load callbacks:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchExecs = async () => {
    try {
      const res = await authApi.getExecutives();
      setExecutives(res.data.executives);
    } catch (err) {
      console.error('Failed to fetch executives:', err);
    }
  };

  useEffect(() => {
    fetchExecs();
  }, []);

  useEffect(() => {
    fetchCallbacks();
  }, [activeTab, selectedExec, user]);

  const handleMarkComplete = async (callbackId: string) => {
    try {
      await callbacksApi.updateStatus(callbackId, { status: 'COMPLETED' });
      fetchCallbacks();
    } catch (err) {
      console.error('Failed to complete callback:', err);
    }
  };

  const handleCancelCallback = async (callbackId: string) => {
    const reason = prompt('Please enter reason for cancellation:') || 'Cancelled by executive';
    try {
      await callbacksApi.updateStatus(callbackId, { status: 'CANCELLED', cancelReason: reason });
      fetchCallbacks();
    } catch (err) {
      console.error('Failed to cancel callback:', err);
    }
  };

  const handleRescheduleSubmit = async () => {
    if (!targetCallback || !newDate) return;
    try {
      await callbacksApi.updateStatus(targetCallback.id, {
        status: 'PENDING',
        callbackDate: newDate,
        callbackTime: newTime,
        priority: newPriority,
      });
      setRescheduleModalOpen(false);
      fetchCallbacks();
    } catch (err) {
      console.error('Failed to reschedule:', err);
    }
  };

  const openReschedule = (cb: Callback) => {
    setTargetCallback(cb);
    setNewDate(cb.callbackDate);
    setNewTime(cb.callbackTime);
    setNewPriority(cb.priority);
    setRescheduleModalOpen(true);
  };

  return (
    <div className="space-y-4 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black tracking-tight text-slate-900">
              Callback & Follow-up Center
            </h1>
            {counts.overdue > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 animate-pulse">
                {counts.overdue} Overdue
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Never miss a promised follow-up. Scheduled callbacks are automatically tracked per Candidate ID.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {user?.role !== 'EXECUTIVE' && (
            <select
              value={selectedExec}
              onChange={(e) => setSelectedExec(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 font-medium text-slate-700"
            >
              <option value="ALL">All Executives</option>
              {executives.map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          )}

          <button
            onClick={fetchCallbacks}
            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {[
          { id: 'TODAY', label: "Today's Callbacks", count: counts.today, color: 'bg-amber-100 text-amber-800' },
          { id: 'OVERDUE', label: 'Overdue Callbacks', count: counts.overdue, color: 'bg-rose-100 text-rose-800', alert: true },
          { id: 'UPCOMING', label: 'Upcoming Callbacks', count: counts.upcoming, color: 'bg-blue-100 text-blue-800' },
          { id: 'COMPLETED', label: 'Completed History', count: counts.completed, color: 'bg-slate-100 text-slate-700' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
                activeTab === tab.id ? 'bg-white/20 text-white' : tab.color
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Main Callbacks List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading callbacks...</div>
        ) : callbacks.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            No callbacks found in the "{activeTab}" category.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {callbacks.map((cb) => (
              <div
                key={cb.id}
                className="p-4 hover:bg-slate-50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Candidate Info */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onOpenCandidateProfile(cb.candidateId)}
                      className="font-bold text-sm text-slate-900 hover:text-blue-600 transition text-left"
                    >
                      {cb.candidate?.name || 'Candidate'}
                    </button>
                    <span className="font-mono text-xs text-slate-400 font-semibold">
                      {cb.candidate?.displaySlNo}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        cb.priority === 'HIGH'
                          ? 'bg-rose-100 text-rose-800'
                          : cb.priority === 'MEDIUM'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {cb.priority} Priority
                    </span>
                  </div>

                  <div className="text-xs text-slate-500 flex flex-wrap items-center gap-3">
                    <span className="font-mono font-semibold text-slate-700">
                      {formatPhone(cb.candidate?.primaryPhone)}
                    </span>
                    <span>Location: {cb.candidate?.currentLocation || 'N/A'}</span>
                    <span>Executive: {cb.executive?.name}</span>
                  </div>

                  {cb.callActivity?.remarks && (
                    <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 max-w-2xl">
                      <span className="font-semibold text-slate-500">Prior Call Remark: </span>
                      {cb.callActivity.remarks}
                    </div>
                  )}
                </div>

                {/* Date/Time badge & Action buttons */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right">
                    <div className="text-xs font-bold font-mono text-slate-800">
                      {formatDate(cb.callbackDate)} at {cb.callbackTime}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Status: <span className="font-semibold text-slate-700">{cb.status}</span>
                    </div>
                  </div>

                  {cb.status === 'PENDING' && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onStartCall(cb.candidate)}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition"
                      >
                        <PhoneCall className="w-3.5 h-3.5" />
                        <span>Call Now</span>
                      </button>

                      <button
                        onClick={() => openReschedule(cb)}
                        className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition"
                      >
                        Reschedule
                      </button>

                      <button
                        onClick={() => handleMarkComplete(cb.id)}
                        className="p-2 rounded-xl border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition"
                        title="Mark Completed"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleCancelCallback(cb.id)}
                        className="p-2 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 transition"
                        title="Cancel Callback"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reschedule Callback Modal */}
      <Modal
        isOpen={rescheduleModalOpen}
        onClose={() => setRescheduleModalOpen(false)}
        maxWidth="md"
        title="Reschedule Callback"
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">New Callback Date</label>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">New Callback Time</label>
            <input
              type="time"
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Priority</label>
            <select
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-lg"
            >
              <option value="HIGH">High Priority</option>
              <option value="MEDIUM">Medium Priority</option>
              <option value="LOW">Low Priority</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <button
              onClick={() => setRescheduleModalOpen(false)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleRescheduleSubmit}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow"
            >
              Save Reschedule
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
