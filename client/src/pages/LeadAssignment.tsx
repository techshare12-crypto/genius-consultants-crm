import React, { useState, useEffect } from 'react';
import { assignmentsApi, authApi, candidatesApi } from '../services/api';
import { User, LeadAssignment as ILeadAssignment } from '../types';
import { formatDateTime, formatPhone } from '../utils/helpers';
import {
  Shuffle,
  CheckCircle2,
  RefreshCw,
  History,
} from 'lucide-react';

export const LeadAssignmentPage: React.FC = () => {
  const [executives, setExecutives] = useState<User[]>([]);
  const [unassignedCount, setUnassignedCount] = useState<number>(0);
  const [history, setHistory] = useState<ILeadAssignment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [distributing, setDistributing] = useState<boolean>(false);
  const [distributionResult, setDistributionResult] = useState<any>(null);

  const [selectedExecIds, setSelectedExecIds] = useState<Set<string>>(new Set());

  const fetchData = async () => {
    setLoading(true);
    try {
      const [execRes, unassignedRes, histRes] = await Promise.all([
        authApi.getExecutives(),
        candidatesApi.list({ executiveId: 'UNASSIGNED', limit: 1 }),
        assignmentsApi.history(),
      ]);
      setExecutives(execRes.data.executives);
      setUnassignedCount(unassignedRes.data.pagination.total);
      setHistory(histRes.data.history);
      setSelectedExecIds(new Set(execRes.data.executives.map((e: any) => e.id)));
    } catch (err) {
      console.error('Failed to load assignment data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleExec = (id: string) => {
    const next = new Set(selectedExecIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedExecIds(next);
  };

  const handleAutoDistribute = async () => {
    if (selectedExecIds.size === 0) {
      alert('Please select at least 1 executive for distribution');
      return;
    }
    setDistributing(true);
    try {
      const res = await assignmentsApi.autoDistribute({
        executiveIds: Array.from(selectedExecIds),
      });
      setDistributionResult(res.data);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to distribute leads');
    } finally {
      setDistributing(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black tracking-tight text-slate-900">
              Lead Assignment & Equal Distribution Engine
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
              {unassignedCount} Unassigned Leads
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Round-robin automated distribution, bulk lead allocation, and permanent reassignment auditing.
          </p>
        </div>

        <button
          onClick={fetchData}
          className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* AUTO EQUAL DISTRIBUTION CARD */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
              <Shuffle className="w-4 h-4" /> Automatic Equal Distribution
            </div>
            <h2 className="text-lg font-black mt-1">Distribute Unassigned Leads Across Active Executives</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Evenly balances {unassignedCount} fresh leads across selected telecallers in 1 click.
            </p>
          </div>

          <button
            onClick={handleAutoDistribute}
            disabled={distributing || unassignedCount === 0 || selectedExecIds.size === 0}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/25 transition active:scale-95 disabled:opacity-50 text-white flex-shrink-0"
          >
            <Shuffle className="w-4 h-4" />
            <span>{distributing ? 'Distributing...' : 'Auto-Distribute All Leads'}</span>
          </button>
        </div>

        {/* Executive Selector checkboxes */}
        <div>
          <div className="text-xs font-semibold text-slate-300 mb-2">
            Select Executives to Include in Distribution:
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {executives.map((exec) => {
              const isSelected = selectedExecIds.has(exec.id);
              return (
                <div
                  key={exec.id}
                  onClick={() => toggleExec(exec.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition text-xs flex items-center justify-between ${
                    isSelected
                      ? 'bg-blue-600/30 border-blue-400 text-white font-bold'
                      : 'bg-slate-800/60 border-slate-700 text-slate-400 font-medium'
                  }`}
                >
                  <div>
                    <div>{exec.name}</div>
                    <div className="text-[10px] text-slate-400 font-normal">Active Pool: {(exec as any)._count?.assignedCandidates || 0} Leads</div>
                  </div>
                  {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Distribution Summary Result */}
        {distributionResult && (
          <div className="p-4 bg-emerald-950/60 border border-emerald-500/40 rounded-xl space-y-2 text-xs text-emerald-200 animate-scale-in">
            <div className="font-bold text-sm text-emerald-300">
              ✅ Successfully Distributed {distributionResult.totalDistributed} Leads!
            </div>
            <div className="flex flex-wrap gap-4 pt-1">
              {distributionResult.distribution?.map((d: any, idx: number) => (
                <span key={idx} className="px-2.5 py-1 rounded bg-emerald-900/60 border border-emerald-700/60 font-semibold">
                  {d.executiveName}: +{d.count} Leads
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Assignment History Log */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
          <History className="w-4 h-4 text-blue-600" />
          Permanent Lead Assignment & Reassignment Audit Trail
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
                <th className="p-3">Candidate</th>
                <th className="p-3">Contact</th>
                <th className="p-3">Assigned To</th>
                <th className="p-3">Assigned By</th>
                <th className="p-3">Assignment Mode</th>
                <th className="p-3 text-right pr-4">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {history.map((h) => (
                <tr key={h.id} className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-slate-900">
                    <div>{h.candidate?.name}</div>
                    <div className="text-[10px] font-mono text-slate-400">{h.candidate?.displaySlNo}</div>
                  </td>
                  <td className="p-3 font-mono">{formatPhone(h.candidate?.primaryPhone)}</td>
                  <td className="p-3 font-semibold text-blue-700">{h.assignedTo?.name}</td>
                  <td className="p-3 text-slate-500">{h.assignedBy?.name}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-[10px] text-slate-700 font-bold">
                      {h.assignmentMode}
                    </span>
                  </td>
                  <td className="p-3 text-right pr-4 font-mono text-slate-400">{formatDateTime(h.assignedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
