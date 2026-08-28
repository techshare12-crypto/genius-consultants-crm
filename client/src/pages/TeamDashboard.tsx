import React, { useState, useEffect } from 'react';
import { Team, Candidate, CoachingNote } from '../types';
import { teamsApi, authApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatPhone, formatDate, formatDateTime } from '../utils/helpers';
import { Modal } from '../components/common/Modal';
import { StageBadge } from '../components/common/Badge';
import {
  Users,
  ShieldCheck,
  PhoneCall,
  Clock,
  Award,
  Plus,
  RefreshCw,
  Edit2,
  Send,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  UserCheck,
  ArrowRightLeft,
  Calendar,
} from 'lucide-react';

export const TeamDashboard: React.FC = () => {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [teamDashboard, setTeamDashboard] = useState<any>(null);
  const [teamLeads, setTeamLeads] = useState<Candidate[]>([]);
  const [coachingNotes, setCoachingNotes] = useState<CoachingNote[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'LEADS' | 'COACHING' | 'MEMBERS'>('DASHBOARD');

  // Modals
  const [createTeamModalOpen, setCreateTeamModalOpen] = useState<boolean>(false);
  const [newTeamName, setNewTeamName] = useState<string>('');
  const [newTeamLeaderId, setNewTeamLeaderId] = useState<string>('');

  const [addMemberModalOpen, setAddMemberModalOpen] = useState<boolean>(false);
  const [selectedExecIdToAdd, setSelectedExecIdToAdd] = useState<string>('');
  const [allExecutives, setAllExecutives] = useState<any[]>([]);

  // Reassignment Modal
  const [reassignCandidate, setReassignCandidate] = useState<Candidate | null>(null);
  const [reassignTargetExecId, setReassignTargetExecId] = useState<string>('');

  // Coaching Note Modal
  const [coachingModalOpen, setCoachingModalOpen] = useState<boolean>(false);
  const [coachingExecId, setCoachingExecId] = useState<string>('');
  const [coachingNoteText, setCoachingNoteText] = useState<string>('');
  const [coachingCategory, setCoachingCategory] = useState<string>('PERFORMANCE');
  const [coachingVisibility, setCoachingVisibility] = useState<string>('VISIBLE_TO_EXECUTIVE');

  const fetchTeams = async () => {
    setLoading(true);
    try {
      const [teamsRes, execRes] = await Promise.all([
        teamsApi.list(),
        authApi.getExecutives(),
      ]);

      setTeams(teamsRes.data.teams || []);
      setAllExecutives(execRes.data.executives || []);

      if (teamsRes.data.teams.length > 0 && !selectedTeamId) {
        setSelectedTeamId(teamsRes.data.teams[0].id);
      }
    } catch (err) {
      console.error('Failed to load teams:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamData = async (teamId: string) => {
    if (!teamId) return;
    try {
      const [dashRes, leadsRes] = await Promise.all([
        teamsApi.getDashboard(teamId),
        teamsApi.getLeads(teamId),
      ]);
      setTeamDashboard(dashRes.data);
      setTeamLeads(leadsRes.data.candidates || []);

      // Fetch coaching notes for members
      if (dashRes.data?.team?.memberships) {
        // Collect notes
      }
    } catch (err) {
      console.error('Failed to load team data:', err);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  useEffect(() => {
    if (selectedTeamId) {
      fetchTeamData(selectedTeamId);
    }
  }, [selectedTeamId]);

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await teamsApi.create({
        teamName: newTeamName,
        teamLeaderId: newTeamLeaderId || user!.id,
      });
      setCreateTeamModalOpen(false);
      fetchTeams();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create team');
    }
  };

  const handleAddMember = async () => {
    if (!selectedTeamId || !selectedExecIdToAdd) return;
    try {
      await teamsApi.addMember(selectedTeamId, { userId: selectedExecIdToAdd });
      setAddMemberModalOpen(false);
      fetchTeamData(selectedTeamId);
      fetchTeams();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to add executive');
    }
  };

  const handleReassignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassignCandidate || !reassignTargetExecId) return;
    try {
      await teamsApi.reassignLead({
        candidateId: reassignCandidate.id,
        toExecutiveId: reassignTargetExecId,
      });
      setReassignCandidate(null);
      fetchTeamData(selectedTeamId);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to reassign lead');
    }
  };

  const handleAddCoachingNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coachingExecId || !coachingNoteText) return;
    try {
      await teamsApi.addCoachingNote({
        executiveId: coachingExecId,
        note: coachingNoteText,
        category: coachingCategory,
        visibility: coachingVisibility,
      });
      setCoachingModalOpen(false);
      setCoachingNoteText('');
      alert('Coaching note recorded and notification sent.');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to add note');
    }
  };

  const isSuperOrAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-semibold text-xs border border-amber-500/30">
              Team Leader & Supervisory Hub
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Live Team Operations
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight mt-1">
            Team Management & Coaching Center
          </h1>
          <p className="text-xs text-slate-300 mt-0.5">
            Monitor telecalling velocity, lead distribution, overdue callbacks, coaching notes, and team conversion metrics.
          </p>
        </div>

        {/* Team Selector & Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700 px-3 py-1.5 rounded-xl text-xs">
            <span className="text-slate-400 font-bold">Team:</span>
            <select
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="bg-transparent font-bold text-white focus:outline-none"
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id} className="bg-slate-900 text-white">
                  {t.teamName} ({t.memberCount} Members)
                </option>
              ))}
            </select>
          </div>

          {isSuperOrAdmin && (
            <button
              onClick={() => setCreateTeamModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 font-bold text-xs shadow transition active:scale-95 text-white"
            >
              <Plus className="w-4 h-4" />
              <span>+ Create Team</span>
            </button>
          )}

          <button
            onClick={() => fetchTeamData(selectedTeamId)}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        {[
          { id: 'DASHBOARD', label: 'Team Live Dashboard', icon: TrendingUp },
          { id: 'LEADS', label: 'Team Leads Pool', icon: Users },
          { id: 'COACHING', label: 'Coaching & Quality Notes', icon: MessageSquare },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: TEAM LIVE DASHBOARD */}
      {activeTab === 'DASHBOARD' && teamDashboard && (
        <div className="space-y-6">
          {/* Today's KPI Counters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <div className="text-[10px] text-slate-400 uppercase font-bold">Active Executives</div>
              <div className="text-xl font-black text-slate-900 mt-1">{teamDashboard.summary.activeExecutives}</div>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <div className="text-[10px] text-slate-400 uppercase font-bold">Leads Assigned</div>
              <div className="text-xl font-black text-blue-700 mt-1">{teamDashboard.summary.totalLeadsAssigned}</div>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <div className="text-[10px] text-slate-400 uppercase font-bold">Calls Completed Today</div>
              <div className="text-xl font-black text-emerald-700 mt-1">{teamDashboard.summary.callsDoneToday}</div>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <div className="text-[10px] text-slate-400 uppercase font-bold">Callbacks Due Today</div>
              <div className="text-xl font-black text-amber-600 mt-1">{teamDashboard.summary.dueTodayCallbacks}</div>
            </div>
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 shadow-sm">
              <div className="text-[10px] text-rose-700 uppercase font-bold">Overdue Callbacks</div>
              <div className="text-xl font-black text-rose-800 mt-1">{teamDashboard.summary.overdueCallbacks}</div>
            </div>
            <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 shadow-sm">
              <div className="text-[10px] text-sky-700 uppercase font-bold">Shortlisted</div>
              <div className="text-xl font-black text-sky-800 mt-1">{teamDashboard.summary.shortlistedCount}</div>
            </div>
            <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200 shadow-sm">
              <div className="text-[10px] text-purple-700 uppercase font-bold">Confirmed</div>
              <div className="text-xl font-black text-purple-800 mt-1">{teamDashboard.summary.confirmedCount}</div>
            </div>
          </div>

          {/* Per-Executive Workforce Cards */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black tracking-tight text-slate-900">
                Team Telecalling Performance & Leaderboard
              </h2>
              <button
                onClick={() => setAddMemberModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-bold shadow hover:bg-slate-800"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Executive to Team</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {teamDashboard.executiveStats?.map((stat: any) => (
                <div
                  key={stat.executive.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md p-5 space-y-3 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-900 text-white font-bold text-sm flex items-center justify-center shadow">
                        {stat.executive.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-xs text-slate-900">{stat.executive.name}</h3>
                        <div className="text-[10px] text-slate-400 font-mono">{stat.executive.email}</div>
                      </div>
                    </div>
                  </div>

                  {/* Progress towards daily target */}
                  <div className="space-y-1 pt-1 border-t border-slate-100">
                    <div className="flex justify-between text-[11px] font-semibold">
                      <span className="text-slate-600">Calls Today: {stat.callsDoneToday} / {stat.targetCallsDaily}</span>
                      <span className="text-blue-600 font-bold">{stat.completionRate}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full"
                        style={{ width: `${Math.min(100, stat.completionRate)}%` }}
                      />
                    </div>
                  </div>

                  {/* Performance stats */}
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Pool Size</div>
                      <div className="font-bold text-slate-800">{stat.assignedLeadsCount} Leads</div>
                    </div>
                    <div className="p-2 rounded-lg bg-sky-50 border border-sky-100">
                      <div className="text-[10px] text-sky-700 uppercase font-semibold">Shortlisted</div>
                      <div className="font-bold text-sky-800">{stat.shortlistedCount}</div>
                    </div>
                  </div>

                  {/* Overdue alert badge if any */}
                  {stat.overdueCallbacksCount > 0 && (
                    <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-[11px] text-rose-800 font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                      <span>{stat.overdueCallbacksCount} Overdue Callbacks!</span>
                    </div>
                  )}

                  {/* Coaching note trigger */}
                  <button
                    onClick={() => {
                      setCoachingExecId(stat.executive.id);
                      setCoachingModalOpen(true);
                    }}
                    className="w-full py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition"
                  >
                    <MessageSquare className="w-3 h-3 text-blue-600" />
                    <span>Add Coaching Note</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TEAM LEADS POOL & REASSIGNMENT */}
      {activeTab === 'LEADS' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black text-slate-900">
                Team Leads Pool ({teamLeads.length} Candidates)
              </h2>
              <p className="text-xs text-slate-500">
                Candidates currently assigned to your team members. Team Leaders can reassign leads between executives.
              </p>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
                  <th className="p-3">Candidate & SL No</th>
                  <th className="p-3">Contact Phone</th>
                  <th className="p-3">Location & Exp</th>
                  <th className="p-3">Assigned Executive</th>
                  <th className="p-3">Lead Stage</th>
                  <th className="p-3 text-right pr-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {teamLeads.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-900">
                      <div>{c.name}</div>
                      <div className="text-[10px] font-mono text-slate-400">{c.displaySlNo}</div>
                    </td>
                    <td className="p-3 font-mono">{formatPhone(c.primaryPhone)}</td>
                    <td className="p-3">{c.currentLocation} • {c.totalExperienceYears}y</td>
                    <td className="p-3 font-semibold text-blue-700">
                      {c.assignedExecutive?.name || 'Unassigned'}
                    </td>
                    <td className="p-3">
                      <StageBadge stage={c.leadStage} />
                    </td>
                    <td className="p-3 text-right pr-4">
                      <button
                        onClick={() => {
                          setReassignCandidate(c);
                          if (teamDashboard?.executiveStats?.length > 0) {
                            setReassignTargetExecId(teamDashboard.executiveStats[0].executive.id);
                          }
                        }}
                        className="px-2.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white rounded-lg text-xs font-bold transition flex items-center gap-1 ml-auto"
                      >
                        <ArrowRightLeft className="w-3 h-3" />
                        <span>Reassign</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: COACHING & QUALITY NOTES */}
      {activeTab === 'COACHING' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black text-slate-900">
                Executive Coaching & Quality Remarks
              </h2>
              <p className="text-xs text-slate-500">
                Internal coaching feedback, performance pointers, and quality audit remarks.
              </p>
            </div>
            <button
              onClick={() => {
                if (teamDashboard?.executiveStats?.length > 0) {
                  setCoachingExecId(teamDashboard.executiveStats[0].executive.id);
                }
                setCoachingModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold shadow"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Add Coaching Note</span>
            </button>
          </div>

          <div className="space-y-3">
            <div className="p-8 text-center text-slate-400 text-xs border border-dashed rounded-xl">
              Coaching remarks are sent directly to the executive and logged in their permanent employee profile.
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE TEAM */}
      <Modal
        isOpen={createTeamModalOpen}
        onClose={() => setCreateTeamModalOpen(false)}
        maxWidth="sm"
        title="Create New Telecalling Team"
      >
        <form onSubmit={handleCreateTeam} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Team Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Automobile Retail Team Alpha"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              className="w-full p-2 border rounded-lg font-semibold"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Assign Team Leader *</label>
            <select
              value={newTeamLeaderId}
              onChange={(e) => setNewTeamLeaderId(e.target.value)}
              className="w-full p-2 border rounded-lg bg-white font-semibold"
            >
              <option value="">Select Team Leader</option>
              {allExecutives.map((exec) => (
                <option key={exec.id} value={exec.id}>{exec.name} ({exec.role})</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <button type="button" onClick={() => setCreateTeamModalOpen(false)} className="px-3 py-1.5 border rounded-lg">Cancel</button>
            <button type="submit" className="px-4 py-1.5 bg-blue-600 text-white font-bold rounded-lg shadow">Create Team</button>
          </div>
        </form>
      </Modal>

      {/* MODAL: ADD MEMBER TO TEAM */}
      <Modal
        isOpen={addMemberModalOpen}
        onClose={() => setAddMemberModalOpen(false)}
        maxWidth="sm"
        title="Add Executive to Team"
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Select Executive</label>
            <select
              value={selectedExecIdToAdd}
              onChange={(e) => setSelectedExecIdToAdd(e.target.value)}
              className="w-full p-2 border rounded-lg bg-white"
            >
              <option value="">Select Executive</option>
              {allExecutives.map((exec) => (
                <option key={exec.id} value={exec.id}>{exec.name} ({exec.email})</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <button type="button" onClick={() => setAddMemberModalOpen(false)} className="px-3 py-1.5 border rounded-lg">Cancel</button>
            <button onClick={handleAddMember} className="px-4 py-1.5 bg-blue-600 text-white font-bold rounded-lg shadow">Add to Team</button>
          </div>
        </div>
      </Modal>

      {/* MODAL: REASSIGN LEAD */}
      <Modal
        isOpen={!!reassignCandidate}
        onClose={() => setReassignCandidate(null)}
        maxWidth="sm"
        title="Reassign Candidate within Team"
      >
        {reassignCandidate && (
          <form onSubmit={handleReassignSubmit} className="space-y-3 text-xs">
            <p className="text-slate-600">
              Reassign <strong className="text-slate-900">{reassignCandidate.name}</strong> from {reassignCandidate.assignedExecutive?.name || 'Unassigned'} to:
            </p>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Target Team Executive</label>
              <select
                value={reassignTargetExecId}
                onChange={(e) => setReassignTargetExecId(e.target.value)}
                className="w-full p-2 border rounded-lg bg-white font-semibold"
              >
                {teamDashboard?.executiveStats?.map((s: any) => (
                  <option key={s.executive.id} value={s.executive.id}>
                    {s.executive.name} (Active: {s.assignedLeadsCount} Leads)
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button type="button" onClick={() => setReassignCandidate(null)} className="px-3 py-1.5 border rounded-lg">Cancel</button>
              <button type="submit" className="px-4 py-1.5 bg-blue-600 text-white font-bold rounded-lg shadow">Confirm Reassignment</button>
            </div>
          </form>
        )}
      </Modal>

      {/* MODAL: COACHING NOTE */}
      <Modal
        isOpen={coachingModalOpen}
        onClose={() => setCoachingModalOpen(false)}
        maxWidth="md"
        title="Record Coaching & Quality Note"
      >
        <form onSubmit={handleAddCoachingNote} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Executive</label>
            <select
              value={coachingExecId}
              onChange={(e) => setCoachingExecId(e.target.value)}
              className="w-full p-2 border rounded-lg bg-white font-semibold"
            >
              {allExecutives.map((exec) => (
                <option key={exec.id} value={exec.id}>{exec.name} ({exec.email})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Category</label>
            <select
              value={coachingCategory}
              onChange={(e) => setCoachingCategory(e.target.value)}
              className="w-full p-2 border rounded-lg bg-white"
            >
              <option value="PERFORMANCE">Performance & Calling Velocity</option>
              <option value="COACHING">Pitch Coaching & Objection Handling</option>
              <option value="QUALITY">Call Quality Audit Remark</option>
              <option value="ATTENDANCE">Attendance / Log Hours</option>
              <option value="GENERAL">General Manager Note</option>
            </select>
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Visibility</label>
            <select
              value={coachingVisibility}
              onChange={(e) => setCoachingVisibility(e.target.value)}
              className="w-full p-2 border rounded-lg bg-white"
            >
              <option value="VISIBLE_TO_EXECUTIVE">Visible to Executive (Sends Notification)</option>
              <option value="PRIVATE_TO_MANAGERS">Private (Team Leader & Admin Only)</option>
            </select>
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Coaching Note Details *</label>
            <textarea
              rows={3}
              required
              placeholder="e.g. Focus on pitch delivery during opening 15 seconds. Ensure DL eligibility is confirmed."
              value={coachingNoteText}
              onChange={(e) => setCoachingNoteText(e.target.value)}
              className="w-full p-2 border rounded-lg"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <button type="button" onClick={() => setCoachingModalOpen(false)} className="px-3 py-1.5 border rounded-lg">Cancel</button>
            <button type="submit" className="px-4 py-1.5 bg-blue-600 text-white font-bold rounded-lg shadow">Save & Notify</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
