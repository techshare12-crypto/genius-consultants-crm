import React, { useState, useEffect } from 'react';
import { Candidate, CallOutcome, JobOrder } from '../types';
import { callingApi, jobOrdersApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { StageBadge, OutcomeBadge } from '../components/common/Badge';
import { formatPhone, getWhatsAppUrl, getTelUrl, formatDate } from '../utils/helpers';
import {
  PhoneCall,
  Phone,
  MessageSquare,
  Copy,
  Check,
  Clock,
  ChevronRight,
  Briefcase,
  RefreshCw,
  Edit2,
  CheckCircle2,
  Building2,
} from 'lucide-react';

interface CallingWorkspaceProps {
  initialCandidate?: Candidate | null;
  onOpenCandidateProfile: (candidateId: string) => void;
}

export const CallingWorkspace: React.FC<CallingWorkspaceProps> = ({
  initialCandidate,
  onOpenCandidateProfile,
}) => {
  const { user } = useAuth();
  const [workspaceData, setWorkspaceData] = useState<any>(null);
  const [activeCandidate, setActiveCandidate] = useState<Candidate | null>(null);
  const [loadingQueue, setLoadingQueue] = useState<boolean>(true);
  const [loggingCall, setLoggingCall] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Job Order Context
  const [jobOrdersList, setJobOrdersList] = useState<JobOrder[]>([]);
  const [selectedJobOrderId, setSelectedJobOrderId] = useState<string>('');

  // Call logging form state
  const [selectedOutcome, setSelectedOutcome] = useState<CallOutcome>('CONFIRMED');
  const [remarks, setRemarks] = useState<string>('');
  const [callbackDate, setCallbackDate] = useState<string>('');
  const [callbackTime, setCallbackTime] = useState<string>('11:00');
  const [callbackPriority, setCallbackPriority] = useState<'HIGH' | 'MEDIUM' | 'LOW'>('MEDIUM');

  // Candidate inline edit state
  const [isEditingCandidate, setIsEditingCandidate] = useState<boolean>(false);
  const [candidateForm, setCandidateForm] = useState<any>({});

  const fetchWorkspaceQueue = async (preferCandidateId?: string) => {
    setLoadingQueue(true);
    try {
      const [queueRes, jobsRes] = await Promise.all([
        callingApi.getWorkspaceQueue(),
        jobOrdersApi.list({ status: 'OPEN' }),
      ]);

      setWorkspaceData(queueRes.data);
      setJobOrdersList(jobsRes.data.jobOrders);

      if (jobsRes.data.jobOrders.length > 0 && !selectedJobOrderId) {
        setSelectedJobOrderId(jobsRes.data.jobOrders[0].id);
      }

      if (preferCandidateId) {
        const found = queueRes.data.queue.find((c: Candidate) => c.id === preferCandidateId);
        if (found) {
          selectCandidate(found);
          return;
        }
      }

      if (initialCandidate) {
        selectCandidate(initialCandidate);
      } else if (queueRes.data.queue.length > 0 && !activeCandidate) {
        selectCandidate(queueRes.data.queue[0]);
      }
    } catch (err) {
      console.error('Failed to load calling queue:', err);
    } finally {
      setLoadingQueue(false);
    }
  };

  useEffect(() => {
    fetchWorkspaceQueue(initialCandidate?.id);
  }, [user, initialCandidate]);

  const selectCandidate = (candidate: Candidate) => {
    setActiveCandidate(candidate);
    setCandidateForm({
      education: candidate.education || '',
      totalExperienceYears: candidate.totalExperienceYears ?? 0,
      currentCompany: candidate.currentCompany || '',
      currentSalary: candidate.currentSalary || '',
      expectedSalary: candidate.expectedSalary || '',
      noticePeriod: candidate.noticePeriod || 'Immediate',
      hasTwoWheeler: candidate.hasTwoWheeler,
      hasDrivingLicense: candidate.hasDrivingLicense,
      interestedInFieldSales: candidate.interestedInFieldSales,
      interestedInAutomobile: candidate.interestedInAutomobile,
      generalNotes: candidate.generalNotes || '',
    });
    setSelectedOutcome('CONFIRMED');
    setRemarks('');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setCallbackDate(tomorrow.toISOString().slice(0, 10));
    setIsEditingCandidate(false);
  };

  const handleCopy = () => {
    if (activeCandidate?.primaryPhone) {
      navigator.clipboard.writeText(activeCandidate.primaryPhone);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleLogCall = async () => {
    if (!activeCandidate) return;
    setLoggingCall(true);
    try {
      const res = await callingApi.logCall({
        candidateId: activeCandidate.id,
        jobOrderId: selectedJobOrderId || undefined,
        outcome: selectedOutcome,
        remarks,
        callbackDate: (selectedOutcome === 'CALL_BACK' || selectedOutcome === 'BUSY') ? callbackDate : undefined,
        callbackTime: (selectedOutcome === 'CALL_BACK' || selectedOutcome === 'BUSY') ? callbackTime : undefined,
        callbackPriority,
        updateCandidateDetails: candidateForm,
      });

      const currentQueue = workspaceData?.queue || [];
      const currentIndex = currentQueue.findIndex((c: Candidate) => c.id === activeCandidate.id);
      const nextCandidate = currentQueue[currentIndex + 1] || currentQueue[0] || null;

      await fetchWorkspaceQueue();
      if (nextCandidate && nextCandidate.id !== activeCandidate.id) {
        selectCandidate(nextCandidate);
      } else {
        setActiveCandidate(res.data.candidate);
      }
    } catch (err) {
      console.error('Failed to log call:', err);
    } finally {
      setLoggingCall(false);
    }
  };

  const activeJob = jobOrdersList.find(j => j.id === selectedJobOrderId);

  const outcomes: { code: CallOutcome; label: string; color: string; requireCallback?: boolean }[] = [
    { code: 'SHORTLISTED', label: '⭐ Shortlisted (Interested + Matches)', color: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
    { code: 'CONFIRMED', label: 'Interested Candidate', color: 'bg-teal-600 hover:bg-teal-700 text-white' },
    { code: 'CALL_BACK', label: 'Callback Scheduled', color: 'bg-amber-600 hover:bg-amber-700 text-white', requireCallback: true },
    { code: 'BUSY', label: 'Call Done / Connected', color: 'bg-blue-600 hover:bg-blue-700 text-white' },
    { code: 'RNR', label: 'RNR / No Answer', color: 'bg-amber-500 hover:bg-amber-600 text-white' },
    { code: 'SWITCHED_OFF', label: 'Switched Off', color: 'bg-slate-600 hover:bg-slate-700 text-white' },
    { code: 'NOT_INTERESTED', label: 'Not Interested', color: 'bg-rose-600 hover:bg-rose-700 text-white' },
    { code: 'NOT_ELIGIBLE', label: 'Not Eligible / Requirement Mismatch', color: 'bg-stone-600 hover:bg-stone-700 text-white' },
    { code: 'WRONG_NUMBER', label: 'Wrong Number', color: 'bg-red-700 hover:bg-red-800 text-white' },
  ];

  return (
    <div className="space-y-4 animate-fade-in pb-12">
      {/* Top Bar with Current Job Order Context Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
            <PhoneCall className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-slate-900">
              High-Velocity Telecalling Workspace
            </h1>
            <p className="text-xs text-slate-500">
              Smart Prioritized Queue: Overdue Callbacks → Today's Callbacks → Fresh Leads → Follow-ups
            </p>
          </div>
        </div>

        {/* Current Job Order Dropdown Selector */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <span className="font-bold text-slate-600">Current Job Order:</span>
            <select
              value={selectedJobOrderId}
              onChange={(e) => setSelectedJobOrderId(e.target.value)}
              className="bg-transparent font-bold text-blue-600 focus:outline-none max-w-[200px] truncate"
            >
              <option value="">General Candidate Calling</option>
              {jobOrdersList.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.jobTitle} ({job.client?.companyName})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => fetchWorkspaceQueue()}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
            title="Refresh Queue"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingQueue ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Active Vacancy Briefing Banner */}
      {activeJob && (
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-4 rounded-2xl shadow-md flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-blue-500/30 text-blue-200 font-mono text-[10px] font-bold">
                {activeJob.displayJobId}
              </span>
              <span className="font-black text-sm text-white">{activeJob.jobTitle}</span>
              <span className="text-slate-300">•</span>
              <span className="font-semibold text-sky-300">{activeJob.client?.companyName}</span>
            </div>
            <div className="text-slate-300 text-[11px] flex flex-wrap items-center gap-3">
              <span>Location: <strong>{activeJob.jobLocation}</strong></span>
              <span>Openings: <strong>{activeJob.numberOfVacancies} Posts</strong></span>
              <span>
                Salary: <strong>{activeJob.minSalary && activeJob.maxSalary ? `₹${(activeJob.minSalary / 100000).toFixed(1)}L - ${(activeJob.maxSalary / 100000).toFixed(1)}L` : 'Standard'}</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[10px]">
            {activeJob.twoWheelerRequired && <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">2W Required</span>}
            {activeJob.drivingLicenseRequired && <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">DL Required</span>}
            {activeJob.fieldSalesRequired && <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold">Field Sales</span>}
          </div>
        </div>
      )}

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* LEFT: Smart Work Queue */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col max-h-[82vh] overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-700">
              Work Queue
            </h2>
            <div className="flex items-center gap-1.5 text-[11px]">
              {workspaceData?.summary?.overdueCount > 0 && (
                <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold">
                  {workspaceData.summary.overdueCount} Overdue
                </span>
              )}
              {workspaceData?.summary?.todayCallbackCount > 0 && (
                <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
                  {workspaceData.summary.todayCallbackCount} Today
                </span>
              )}
            </div>
          </div>

          <div className="space-y-2 mt-3 overflow-y-auto flex-1 pr-1">
            {loadingQueue ? (
              <div className="py-12 text-center text-xs text-slate-400">Loading queue...</div>
            ) : !workspaceData?.queue || workspaceData.queue.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">No leads pending in your queue!</div>
            ) : (
              workspaceData.queue.map((candidate: Candidate) => {
                const isActive = activeCandidate?.id === candidate.id;
                const hasPendingCallback = candidate.callbacks && candidate.callbacks.length > 0;
                const isOverdue = hasPendingCallback && candidate.callbacks![0].callbackDate < new Date().toISOString().slice(0, 10);
                const isToday = hasPendingCallback && candidate.callbacks![0].callbackDate === new Date().toISOString().slice(0, 10);

                return (
                  <div
                    key={candidate.id}
                    onClick={() => selectCandidate(candidate)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer text-xs space-y-1.5 ${
                      isActive
                        ? 'bg-blue-50/80 border-blue-500 shadow-md ring-1 ring-blue-500'
                        : 'bg-slate-50/60 hover:bg-slate-100 border-slate-200/80'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span>{candidate.name}</span>
                        {isOverdue && (
                          <span className="px-1.5 py-0.2 bg-rose-600 text-white rounded text-[10px] font-bold">
                            OVERDUE
                          </span>
                        )}
                        {isToday && (
                          <span className="px-1.5 py-0.2 bg-amber-600 text-white rounded text-[10px] font-bold">
                            CALLBACK
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-[10px] text-slate-400 font-semibold">
                        {candidate.displaySlNo}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>{candidate.currentLocation || 'Location N/A'} • {candidate.totalExperienceYears}y exp</span>
                      <StageBadge stage={candidate.leadStage} />
                    </div>

                    {candidate.callActivities && candidate.callActivities.length > 0 && (
                      <div className="text-[10px] text-slate-400 italic flex items-center gap-1 pt-1 border-t border-slate-100">
                        <span>Last:</span>
                        <OutcomeBadge outcome={candidate.callActivities[0].outcome} />
                        <span className="truncate">{candidate.callActivities[0].remarks || 'No remarks'}</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT: Active Candidate Calling Workspace */}
        <div className="lg:col-span-8 space-y-4">
          {!activeCandidate ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center text-slate-400 text-sm">
              Select a candidate from the queue to start calling.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Candidate Calling Bar */}
              <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-5 rounded-2xl shadow-lg space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-black tracking-tight">{activeCandidate.name}</h2>
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-xs">
                        {activeCandidate.displaySlNo}
                      </span>
                      <StageBadge stage={activeCandidate.leadStage} />
                    </div>
                    <div className="text-xs text-slate-400 font-mono mt-0.5">
                      Candidate ID: <span className="text-slate-200">{activeCandidate.id}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => onOpenCandidateProfile(activeCandidate.id)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                  >
                    View 360° Profile
                  </button>
                </div>

                {/* Big Dialer Action Bar */}
                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-700/60">
                  <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800/90 border border-slate-700 font-mono font-bold text-sm text-sky-400">
                    <Phone className="w-4 h-4 text-sky-400" />
                    <span>{formatPhone(activeCandidate.primaryPhone)}</span>
                  </div>

                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                    <span>{copied ? 'Copied Number' : 'Copy Number'}</span>
                  </button>

                  <a
                    href={getTelUrl(activeCandidate.primaryPhone)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold shadow-md shadow-emerald-500/20 transition active:scale-95"
                  >
                    <PhoneCall className="w-4 h-4 animate-pulse" />
                    <span>Click to Dial</span>
                  </a>

                  <a
                    href={getWhatsAppUrl(activeCandidate.primaryPhone, activeCandidate.name)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Open WhatsApp</span>
                  </a>
                </div>
              </div>

              {/* Candidate Quick Details & Inline Editor */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-blue-600" />
                    Candidate Profile & Eligibility Snapshot
                  </h3>
                  <button
                    onClick={() => setIsEditingCandidate(!isEditingCandidate)}
                    className="text-xs font-medium text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <Edit2 className="w-3 h-3" />
                    {isEditingCandidate ? 'View Mode' : 'Quick Edit During Call'}
                  </button>
                </div>

                {isEditingCandidate ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <label className="block font-medium text-slate-600 mb-1">Education</label>
                      <input
                        type="text"
                        value={candidateForm.education}
                        onChange={(e) => setCandidateForm({ ...candidateForm, education: e.target.value })}
                        className="w-full p-1.5 border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-600 mb-1">Experience (Yrs)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={candidateForm.totalExperienceYears}
                        onChange={(e) => setCandidateForm({ ...candidateForm, totalExperienceYears: e.target.value })}
                        className="w-full p-1.5 border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-600 mb-1">Current CTC</label>
                      <input
                        type="text"
                        value={candidateForm.currentSalary}
                        onChange={(e) => setCandidateForm({ ...candidateForm, currentSalary: e.target.value })}
                        className="w-full p-1.5 border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-600 mb-1">Expected CTC</label>
                      <input
                        type="text"
                        value={candidateForm.expectedSalary}
                        onChange={(e) => setCandidateForm({ ...candidateForm, expectedSalary: e.target.value })}
                        className="w-full p-1.5 border rounded-lg"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Location</div>
                      <div className="font-semibold text-slate-800 mt-0.5">{activeCandidate.currentLocation || 'N/A'}</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Experience & Role</div>
                      <div className="font-semibold text-slate-800 mt-0.5">{activeCandidate.totalExperienceYears} Yrs • {activeCandidate.currentJobTitle || 'Sales'}</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Current Company</div>
                      <div className="font-semibold text-slate-800 mt-0.5 truncate">{activeCandidate.currentCompany || 'N/A'}</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Expected CTC</div>
                      <div className="font-semibold text-emerald-700 mt-0.5">{activeCandidate.expectedSalary || 'Negotiable'}</div>
                    </div>
                  </div>
                )}

                {/* Eligibility Badges */}
                <div className="flex flex-wrap gap-2 pt-1 text-xs">
                  <span className={`px-2.5 py-1 rounded-lg font-medium flex items-center gap-1 ${activeCandidate.hasTwoWheeler ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                    <CheckCircle2 className="w-3.5 h-3.5" /> Two-Wheeler
                  </span>
                  <span className={`px-2.5 py-1 rounded-lg font-medium flex items-center gap-1 ${activeCandidate.hasDrivingLicense ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                    <CheckCircle2 className="w-3.5 h-3.5" /> Driving License
                  </span>
                  <span className={`px-2.5 py-1 rounded-lg font-medium flex items-center gap-1 ${activeCandidate.interestedInFieldSales ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-500'}`}>
                    <CheckCircle2 className="w-3.5 h-3.5" /> Field Sales Ready
                  </span>
                </div>
              </div>

              {/* Call Outcome Logging Section */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Select Call Outcome & Log Result
                </h3>

                {/* Outcome Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                  {outcomes.map((opt) => {
                    const isSelected = selectedOutcome === opt.code;
                    return (
                      <button
                        key={opt.code}
                        type="button"
                        onClick={() => setSelectedOutcome(opt.code)}
                        className={`p-2.5 rounded-xl text-xs font-bold border transition-all text-center ${
                          isSelected
                            ? `${opt.color} shadow-md ring-2 ring-blue-400 scale-[1.02]`
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>

                {/* Conditional Callback Scheduler */}
                {(selectedOutcome === 'CALL_BACK' || selectedOutcome === 'BUSY') && (
                  <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl space-y-3 animate-scale-in">
                    <div className="font-bold text-xs text-orange-900 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-orange-600" />
                      Schedule Callback Reminder
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Callback Date</label>
                        <input
                          type="date"
                          value={callbackDate}
                          onChange={(e) => setCallbackDate(e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Callback Time</label>
                        <input
                          type="time"
                          value={callbackTime}
                          onChange={(e) => setCallbackTime(e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Priority</label>
                        <select
                          value={callbackPriority}
                          onChange={(e) => setCallbackPriority(e.target.value as any)}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                        >
                          <option value="HIGH">High Priority</option>
                          <option value="MEDIUM">Medium Priority</option>
                          <option value="LOW">Low Priority</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Remarks Textarea */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Call Remarks / Interview Discussion Notes:
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Enter call notes, interview feedback, current status, salary negotiation details..."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="w-full p-3 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                  />
                </div>

                {/* Action CTA: Log Call & Go to Next */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    onClick={handleLogCall}
                    disabled={loggingCall}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-lg shadow-blue-500/20 transition active:scale-95 disabled:opacity-50"
                  >
                    <span>{loggingCall ? 'Saving Record...' : 'Log Call & Next Lead'}</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Past Call History for this Candidate */}
              {activeCandidate.callActivities && activeCandidate.callActivities.length > 0 && (
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                    Past Calling History for {activeCandidate.name} ({activeCandidate.callActivities.length} Attempts)
                  </h3>
                  <div className="space-y-2">
                    {activeCandidate.callActivities.map((call) => (
                      <div key={call.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs flex items-center justify-between">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <OutcomeBadge outcome={call.outcome} />
                            <span className="font-semibold text-slate-800">{call.executive?.name || 'Executive'}</span>
                          </div>
                          {call.remarks && (
                            <div className="text-slate-600 text-[11px] mt-0.5">{call.remarks}</div>
                          )}
                        </div>
                        <div className="text-slate-400 font-mono text-[10px]">
                          {formatDate(call.callDate)} {call.callTime}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
