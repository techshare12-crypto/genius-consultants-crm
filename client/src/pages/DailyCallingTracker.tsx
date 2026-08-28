import React, { useState, useEffect } from 'react';
import { DailyCallingSummary, User } from '../types';
import { dailyTrackerApi, authApi, reportsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils/helpers';
import {
  Download,
  RefreshCw,
} from 'lucide-react';

export const DailyCallingTracker: React.FC = () => {
  const { user } = useAuth();
  const [summaries, setSummaries] = useState<DailyCallingSummary[]>([]);
  const [totals, setTotals] = useState<any>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [executives, setExecutives] = useState<User[]>([]);

  const [view, setView] = useState<string>('DAILY');
  const [selectedExec, setSelectedExec] = useState<string>('ALL');

  const fetchTrackerData = async () => {
    setLoading(true);
    try {
      const res = await dailyTrackerApi.getSummary({
        view,
        executiveId: selectedExec,
      });
      setSummaries(res.data.summaries);
      setTotals(res.data.totals);
    } catch (err) {
      console.error('Failed to load daily tracker:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchExecs = async () => {
    try {
      const res = await authApi.getExecutives();
      setExecutives(res.data.executives);
    } catch (err) {
      console.error('Failed to load executives:', err);
    }
  };

  useEffect(() => {
    fetchExecs();
  }, []);

  useEffect(() => {
    fetchTrackerData();
  }, [view, selectedExec, user]);

  const handleExportExcel = () => {
    const url = reportsApi.getExportUrl('DAILY_CALLING', 'xlsx', { executiveId: selectedExec });
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-4 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black tracking-tight text-slate-900">
              Daily Calling Tracker & Historical Log
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
              Permanent Audit Records
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Automatic day-by-day telemetry. Past calling statistics remain permanently preserved.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {user?.role !== 'EXECUTIVE' && (
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Excel</span>
            </button>
          )}

          <button
            onClick={fetchTrackerData}
            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Aggregate Totals Snapshot Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div className="text-[10px] font-semibold uppercase text-slate-400">Total Attempts</div>
          <div className="text-xl font-black text-slate-900 mt-0.5">{totals.totalAttempts || 0}</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div className="text-[10px] font-semibold uppercase text-slate-400">Unique Called</div>
          <div className="text-xl font-black text-blue-700 mt-0.5">{totals.totalUniqueCalled || 0}</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div className="text-[10px] font-semibold uppercase text-slate-400">Shortlisted</div>
          <div className="text-xl font-black text-sky-700 mt-0.5">{totals.totalShortlisted || 0}</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div className="text-[10px] font-semibold uppercase text-slate-400">Confirmed</div>
          <div className="text-xl font-black text-emerald-700 mt-0.5">{totals.totalConfirmed || 0}</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div className="text-[10px] font-semibold uppercase text-slate-400">RNR</div>
          <div className="text-xl font-black text-amber-700 mt-0.5">{totals.totalRNR || 0}</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div className="text-[10px] font-semibold uppercase text-slate-400">Busy / Callback</div>
          <div className="text-xl font-black text-orange-700 mt-0.5">{totals.totalBusy || 0}</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div className="text-[10px] font-semibold uppercase text-slate-400">Conversion Rate</div>
          <div className="text-xl font-black text-indigo-700 mt-0.5">{totals.overallConversion || 0}%</div>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-600">View Window:</span>
          {['DAILY', 'WEEKLY', 'MONTHLY'].map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-xl font-bold transition ${
                view === v ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        {user?.role !== 'EXECUTIVE' && (
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-600">Executive:</span>
            <select
              value={selectedExec}
              onChange={(e) => setSelectedExec(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-xl bg-slate-50 font-medium text-slate-700"
            >
              <option value="ALL">All Executives</option>
              {executives.map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Tracker Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px] sticky top-0 z-10">
                <th className="p-3.5 whitespace-nowrap">Date</th>
                <th className="p-3.5 whitespace-nowrap">Executive Name</th>
                <th className="p-3.5 whitespace-nowrap text-center">Assigned</th>
                <th className="p-3.5 whitespace-nowrap text-center">Unique Contacted</th>
                <th className="p-3.5 whitespace-nowrap text-center">Total Attempts</th>
                <th className="p-3.5 whitespace-nowrap text-center text-emerald-700">Confirmed</th>
                <th className="p-3.5 whitespace-nowrap text-center text-sky-700">Shortlisted</th>
                <th className="p-3.5 whitespace-nowrap text-center text-amber-700">RNR</th>
                <th className="p-3.5 whitespace-nowrap text-center text-orange-700">Busy / Callback</th>
                <th className="p-3.5 whitespace-nowrap text-center text-rose-700">Not Int.</th>
                <th className="p-3.5 whitespace-nowrap text-center">Pending</th>
                <th className="p-3.5 whitespace-nowrap text-right pr-4">Conversion %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={12} className="p-12 text-center text-slate-400">Loading daily summaries...</td>
                </tr>
              ) : summaries.length === 0 ? (
                <tr>
                  <td colSpan={12} className="p-12 text-center text-slate-400">No daily calling records recorded for this period.</td>
                </tr>
              ) : (
                summaries.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 font-mono font-bold text-slate-900 whitespace-nowrap">
                      {formatDate(s.date)}
                    </td>
                    <td className="p-3.5 whitespace-nowrap font-bold text-slate-800">
                      {s.executive?.name}
                    </td>
                    <td className="p-3.5 text-center font-bold">{s.assignedLeadsCount}</td>
                    <td className="p-3.5 text-center font-bold text-blue-700">{s.uniqueCalledCount}</td>
                    <td className="p-3.5 text-center font-bold text-slate-900">{s.totalAttemptsCount}</td>
                    <td className="p-3.5 text-center font-bold text-emerald-600">{s.confirmedCount}</td>
                    <td className="p-3.5 text-center font-bold text-sky-600">{s.shortlistedCount}</td>
                    <td className="p-3.5 text-center font-bold text-amber-600">{s.rnrCount}</td>
                    <td className="p-3.5 text-center font-bold text-orange-600">{s.busyCallbackCount}</td>
                    <td className="p-3.5 text-center font-bold text-rose-600">{s.notInterestedCount}</td>
                    <td className="p-3.5 text-center text-slate-400">{s.pendingCount}</td>
                    <td className="p-3.5 text-right pr-4 font-mono font-bold text-indigo-700">
                      {s.conversionRate}%
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
