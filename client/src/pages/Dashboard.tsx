import React, { useState, useEffect } from 'react';
import { dashboardApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  PhoneCall,
  UserCheck,
  Star,
  CheckCircle2,
  Clock,
  TrendingUp,
  Award,
  Users,
  UploadCloud,
  UserPlus,
  ArrowUpRight,
  PhoneForwarded,
  ShieldAlert,
  ShieldCheck,
  Building2,
  Briefcase,
  Send,
  FileText,
  Layers,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { StageBadge } from '../components/common/Badge';
import { formatPhone, formatDate } from '../utils/helpers';

interface DashboardProps {
  onNavigate: (tab: any) => void;
  onOpenCandidateProfile: (candidateId: string) => void;
  onOpenAddCandidate: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onNavigate,
  onOpenCandidateProfile,
  onOpenAddCandidate,
}) => {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await dashboardApi.getMetrics();
      setData(res.data);
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-slate-500">Loading operations dashboard...</p>
        </div>
      </div>
    );
  }

  const { today, month, allTime, trend, statusDistribution, upcomingCallbacks, recentActivities, userStats, companyRequirements } = data;
  const isAdminOrSuper = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  return (
    <div className="space-y-6 pb-12 animate-fade-in text-xs">
      {/* Header & Quick Operations Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-blue-500/20 text-blue-300 font-semibold text-xs border border-blue-500/30 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" />
              Telecalling & HR Delivery Operations
            </span>
            <span className="text-xs text-slate-400 font-mono">
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight mt-1">
            Welcome back, {user?.name}
          </h1>
          <p className="text-xs text-slate-300 mt-0.5">
            WorkIndia Leads → Calling Workspace → Google Form → CV → Send to Company HR
          </p>
        </div>

        {/* Quick Actions Grid */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onNavigate('CALLING_WORKSPACE')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 font-bold text-xs shadow-lg shadow-emerald-500/20 transition active:scale-95 text-white"
          >
            <PhoneCall className="w-4 h-4 animate-bounce" />
            <span>Calling Workspace</span>
          </button>

          <button
            onClick={() => onNavigate('SHORTLISTED')}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white shadow transition active:scale-95"
          >
            <Star className="w-4 h-4" />
            <span>Shortlisted Pipeline</span>
          </button>

          {isAdminOrSuper && (
            <>
              <button
                onClick={() => onNavigate('IMPORT')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition"
              >
                <UploadCloud className="w-4 h-4 text-sky-400" />
                <span>Import Leads</span>
              </button>
              <button
                onClick={() => onNavigate('ASSIGNMENTS')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition"
              >
                <UserPlus className="w-4 h-4 text-amber-400" />
                <span>Assign Leads</span>
              </button>
            </>
          )}

          <button
            onClick={onOpenAddCandidate}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white border border-slate-700 transition"
          >
            <Users className="w-4 h-4 text-slate-300" />
            <span>+ Candidate</span>
          </button>
        </div>
      </div>

      {/* OVERDUE CALLBACKS ALERT BANNER IF ANY */}
      {today.overdueCallbacks > 0 && (
        <div
          onClick={() => onNavigate('CALLBACKS')}
          className="flex items-center justify-between p-4 bg-rose-50 border border-rose-200 rounded-2xl cursor-pointer hover:bg-rose-100/80 transition"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-600 text-white animate-pulse">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-rose-900 text-sm flex items-center gap-2">
                <span>{today.overdueCallbacks} Overdue Callbacks Require Immediate Attention</span>
              </div>
              <p className="text-xs text-rose-700">
                Candidates missed on scheduled callback dates. Click here to open Callback Center.
              </p>
            </div>
          </div>
          <ArrowUpRight className="w-5 h-5 text-rose-600" />
        </div>
      )}

      {/* SECTION 1: TODAY'S TELEMETRY & OPERATIONS FUNNEL */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" />
            Today's Telecalling & Shortlist Operations
          </h2>
          <span className="text-xs text-slate-500 font-medium">
            Pending Leads Today: <strong className="text-slate-800">{today.pendingCalls}</strong>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Card 1: Attempts */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:shadow transition">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Calls Attempted</span>
              <PhoneCall className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2">{today.totalCallsAttempted}</div>
            <div className="text-[11px] text-slate-400 mt-1">Assigned: {today.totalLeadsAssigned}</div>
          </div>

          {/* Card 2: Connected */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:shadow transition">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Connected</span>
              <UserCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-emerald-700 mt-2">{today.connectedCalls}</div>
            <div className="text-[11px] text-emerald-600 mt-1 font-semibold">
              {today.totalCallsAttempted > 0 ? `${((today.connectedCalls / today.totalCallsAttempted) * 100).toFixed(0)}% Connected` : '0%'}
            </div>
          </div>

          {/* Card 3: Shortlisted */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:shadow transition">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Shortlisted</span>
              <Star className="w-4 h-4 text-sky-600" />
            </div>
            <div className="text-2xl font-black text-sky-700 mt-2">{today.shortlisted}</div>
            <div className="text-[11px] text-sky-600 mt-1 font-semibold">Requirement Match</div>
          </div>

          {/* Card 4: Google Forms Sent */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:shadow transition">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Forms Sent</span>
              <Send className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-black text-blue-700 mt-2">{today.formsSent}</div>
            <div className="text-[11px] text-slate-400 mt-1">Completed: {today.formsCompleted}</div>
          </div>

          {/* Card 5: CV Received */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:shadow transition">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>CV Received</span>
              <FileText className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-2xl font-black text-purple-700 mt-2">{today.cvReceived}</div>
            <div className="text-[11px] text-purple-600 mt-1 font-semibold">Ready: {today.readyToSend}</div>
          </div>

          {/* Card 6: Sent to Company HR */}
          <div className="p-4 rounded-2xl bg-slate-900 text-white shadow-sm hover:shadow transition">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>Sent to HR</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-emerald-400 mt-2">{today.sentToHr}</div>
            <div className="text-[11px] text-slate-400 mt-1 font-semibold">Completed Workflow</div>
          </div>
        </div>
      </div>

      {/* SECTION 2: CHARTS & ACTIVE COMPANY REQUIREMENTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calling Trend Chart (2 columns) */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                7-Day Telecalling & Shortlist Trend
              </h3>
              <p className="text-xs text-slate-500">Call attempts vs successful candidate connections</p>
            </div>
            <button
              onClick={() => onNavigate('DAILY_TRACKER')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              Daily Tracker <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0284c7" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0284c7" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorConnected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area type="monotone" dataKey="totalCalls" name="Total Calls" stroke="#0284c7" strokeWidth={2} fillOpacity={1} fill="url(#colorCalls)" />
                <Area type="monotone" dataKey="connected" name="Connected" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorConnected)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Active Company Requirements (1 column) */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <Briefcase className="w-4 h-4 text-blue-600" />
              <span>Active Job Requirements</span>
            </h3>
            <button
              onClick={() => onNavigate('JOB_ORDERS')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              View All
            </button>
          </div>

          <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
            {companyRequirements && companyRequirements.length > 0 ? (
              companyRequirements.map((job: any) => (
                <div key={job.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <div className="font-bold text-slate-900 text-xs flex items-center justify-between">
                    <span>{job.jobTitle}</span>
                    <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px]">
                      {job.numberOfVacancies} Vacancies
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-slate-400" />
                    <span>{job.client?.companyName} • {job.jobLocation}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-slate-400 text-xs">No active requirements.</div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 3: UPCOMING CALLBACKS & RECENT ACTIVITY FEED */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scheduled Callbacks */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-orange-600" />
                Scheduled Callbacks (Today & Overdue)
              </h3>
              <p className="text-xs text-slate-500">Upcoming candidates expecting follow-up</p>
            </div>
            <button
              onClick={() => onNavigate('CALLBACKS')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              Open Center
            </button>
          </div>

          {upcomingCallbacks.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">No pending callbacks for today.</div>
          ) : (
            <div className="space-y-2">
              {upcomingCallbacks.map((cb: any) => (
                <div
                  key={cb.id}
                  onClick={() => onOpenCandidateProfile(cb.candidateId)}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/60 cursor-pointer transition"
                >
                  <div className="space-y-0.5">
                    <div className="font-bold text-xs text-slate-900 flex items-center gap-2">
                      <span>{cb.candidate?.name}</span>
                      <span className="text-[10px] font-mono text-slate-500 font-normal">{formatPhone(cb.candidate?.primaryPhone)}</span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {cb.candidate?.currentLocation || 'Location N/A'} • Exec: {cb.executive?.name}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${cb.priority === 'HIGH' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>
                      {cb.callbackTime}
                    </span>
                    <div className="text-[10px] text-slate-400 mt-0.5">{formatDate(cb.callbackDate)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Live Operational Activity Log */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Award className="w-4 h-4 text-purple-600" />
              Live Calling Activity Feed
            </h3>
            {user?.role !== 'EXECUTIVE' && (
              <button
                onClick={() => onNavigate('ACTIVITY_LOGS')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                Full Audit Trail
              </button>
            )}
          </div>

          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {recentActivities.map((act: any) => (
              <div key={act.id} className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/70 text-xs flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800">{act.user?.name || 'System'}</span>
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold">
                      {act.action}
                    </span>
                  </div>
                  <div className="text-slate-600 text-[11px] line-clamp-1">{act.details}</div>
                </div>
                <div className="text-[10px] text-slate-400 font-mono whitespace-nowrap pl-2">
                  {new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
