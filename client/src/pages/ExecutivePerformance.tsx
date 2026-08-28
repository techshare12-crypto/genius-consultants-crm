import React, { useState, useEffect } from 'react';
import { dailyTrackerApi, usersApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Trophy,
  Edit2,
} from 'lucide-react';
import { Modal } from '../components/common/Modal';

export const ExecutivePerformance: React.FC = () => {
  const { user } = useAuth();
  const [performanceList, setPerformanceList] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Target Edit Modal
  const [targetModalOpen, setTargetModalOpen] = useState<boolean>(false);
  const [editingExec, setEditingExec] = useState<any>(null);
  const [callTarget, setCallTarget] = useState<number>(100);
  const [shortlistTarget, setShortlistTarget] = useState<number>(10);

  const fetchPerformance = async () => {
    setLoading(true);
    try {
      const res = await dailyTrackerApi.getPerformance();
      setPerformanceList(res.data.performanceList);
    } catch (err) {
      console.error('Failed to load performance tracker:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPerformance();
  }, []);

  const openTargetEdit = (exec: any) => {
    setEditingExec(exec);
    setCallTarget(exec.targetCallsDaily || 100);
    setShortlistTarget(exec.targetShortlistDaily || 10);
    setTargetModalOpen(true);
  };

  const handleSaveTarget = async () => {
    if (!editingExec) return;
    try {
      await usersApi.update(editingExec.id, {
        targetCallsDaily: callTarget,
        targetShortlistDaily: shortlistTarget,
      });
      setTargetModalOpen(false);
      fetchPerformance();
    } catch (err) {
      console.error('Failed to update target:', err);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black tracking-tight text-slate-900">
              Executive Performance & Leaderboard
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 flex items-center gap-1">
              <Trophy className="w-3.5 h-3.5" /> Team Ranking
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Operational metrics, call completion rates, conversion percentages, and daily KPI target progress.
          </p>
        </div>
      </div>

      {/* Leaderboard Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          <div className="col-span-4 py-12 text-center text-xs text-slate-400">Loading performance data...</div>
        ) : (
          performanceList.map((item, idx) => {
            const isTop = idx === 0 && item.today.callsDone > 0;
            return (
              <div
                key={item.executive.id}
                className={`p-5 rounded-2xl bg-white border transition-all relative overflow-hidden shadow-sm hover:shadow-md ${
                  isTop ? 'border-amber-400 ring-2 ring-amber-400/20' : 'border-slate-200'
                }`}
              >
                {isTop && (
                  <div className="absolute top-0 right-0 px-3 py-1 bg-amber-500 text-white font-bold text-[10px] rounded-bl-xl shadow-sm flex items-center gap-1">
                    <Trophy className="w-3 h-3" /> #1 Rank
                  </div>
                )}

                <div className="flex items-center gap-3 mb-4">
                  <div className="w-11 h-11 rounded-xl bg-slate-900 text-white font-bold text-sm flex items-center justify-center shadow-md">
                    {item.executive.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">{item.executive.name}</h3>
                    <div className="text-[11px] text-slate-500">Telecalling Executive</div>
                  </div>
                </div>

                {/* Progress bar towards daily target */}
                <div className="space-y-1.5 pb-4 border-b border-slate-100">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-600">Daily Target: {item.today.callsDone} / {item.executive.targetCallsDaily} Calls</span>
                    <span className="text-blue-600 font-bold">{item.today.targetAchievement}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500"
                      style={{ width: `${Math.min(100, item.today.targetAchievement)}%` }}
                    />
                  </div>
                </div>

                {/* Performance stats */}
                <div className="grid grid-cols-2 gap-2 pt-3 text-xs">
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Today Unique</div>
                    <div className="font-bold text-slate-800 text-sm mt-0.5">{item.today.uniqueContacted} Leads</div>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Today Shortlist</div>
                    <div className="font-bold text-sky-700 text-sm mt-0.5">{item.today.shortlisted}</div>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Completion Rate</div>
                    <div className="font-bold text-emerald-700 text-sm mt-0.5">{item.today.completionRate}%</div>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Shortlist Conv.</div>
                    <div className="font-bold text-purple-700 text-sm mt-0.5">{item.today.shortlistConversion}%</div>
                  </div>
                </div>

                {/* Month Snapshot */}
                <div className="mt-3 p-2.5 rounded-xl bg-slate-900 text-white text-[11px] flex items-center justify-between">
                  <span>Month: {item.month.totalCalls} Calls</span>
                  <span className="font-bold text-amber-400">{item.month.totalShortlisted} Shortlisted</span>
                </div>

                {/* Admin button to adjust target */}
                {user?.role !== 'EXECUTIVE' && (
                  <button
                    onClick={() => openTargetEdit(item.executive)}
                    className="w-full mt-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-[11px] font-semibold text-slate-600 flex items-center justify-center gap-1 transition"
                  >
                    <Edit2 className="w-3 h-3" /> Adjust Targets
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Target Edit Modal */}
      <Modal
        isOpen={targetModalOpen}
        onClose={() => setTargetModalOpen(false)}
        maxWidth="sm"
        title="Update Executive Target"
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Daily Calls Target</label>
            <input
              type="number"
              value={callTarget}
              onChange={(e) => setCallTarget(Number(e.target.value))}
              className="w-full p-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Daily Shortlist Target</label>
            <input
              type="number"
              value={shortlistTarget}
              onChange={(e) => setShortlistTarget(Number(e.target.value))}
              className="w-full p-2 border rounded-lg"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <button
              onClick={() => setTargetModalOpen(false)}
              className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveTarget}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow"
            >
              Save Targets
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
