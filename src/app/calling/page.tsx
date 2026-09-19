'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { StageBadge, Badge } from '@/components/common/Badge';
import { Modal } from '@/components/common/Modal';
import {
  PhoneCall,
  Copy,
  Check,
  Calendar,
  Clock,
  MessageSquare,
  Bike,
  CreditCard,
  Building2,
  Send,
  AlertCircle,
  CheckCircle2,
  Search,
  Filter,
  RefreshCw,
  PhoneForwarded,
  Sparkles,
  History,
  PhoneOff,
  User,
  ChevronRight,
  ChevronLeft,
  CalendarClock,
  ExternalLink,
  ShieldAlert
} from 'lucide-react';

interface ApplicationItem {
  id: string;
  applicationCode: string;
  candidateId: string;
  jobId: string;
  companyId: string;
  currentStage: string;
  formStatus: string;
  cvStatus: string;
  updatedAt: string;
  candidate: {
    id: string;
    fullName: string;
    phone: string;
    normalizedPhone: string;
    alternatePhone?: string | null;
    email?: string | null;
    currentLocation?: string | null;
    currentCompany?: string | null;
    currentJob?: string | null;
    experienceYears?: number;
    experienceMonths?: number;
    currentSalary?: number | null;
    expectedSalary?: number | null;
    hasTwoWheeler?: boolean;
    hasDrivingLicense?: boolean;
    skills?: string[];
  };
  job: {
    id: string;
    jobTitle: string;
    location?: string;
    vacancies?: number;
    company: {
      id: string;
      companyName: string;
    };
  };
  company: {
    id: string;
    companyName: string;
  };
  assignedExecutive?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  _count?: {
    callLogs: number;
    callbacks: number;
  };
}

interface CallbackItem {
  id: string;
  applicationId: string;
  candidateId: string;
  scheduledAt: string;
  reason?: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
  isOverdue?: boolean;
  displayCategory?: 'OVERDUE' | 'TODAY' | 'UPCOMING';
}

interface CallLogItem {
  id: string;
  applicationId: string;
  candidateId: string;
  executiveId: string;
  callOutcome: string;
  remarks?: string | null;
  callbackRequired: boolean;
  callbackDateTime?: string | null;
  createdAt: string;
  executive?: {
    id: string;
    fullName: string;
  };
}

export default function ExecutiveCallingWorkspacePage() {
  const { user } = useAuth();

  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [callbacks, setCallbacks] = useState<CallbackItem[]>([]);
  const [selectedApp, setSelectedApp] = useState<ApplicationItem | null>(null);
  const [callLogs, setCallLogs] = useState<CallLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Clipboard feedbacks
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Queue Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'CALLBACKS_DUE' | 'FOLLOWUPS_DUE' | 'NEW_ASSIGNED' | 'WORKED_TODAY' | 'NOT_WORKED'>('ALL');
  const [jobFilter, setJobFilter] = useState('ALL');
  const [companyFilter, setCompanyFilter] = useState('ALL');
  const [autoAdvance, setAutoAdvance] = useState(true);

  // Call Logging Form State
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);

  // Callback Scheduling Modal & Inputs
  const [showCallbackModal, setShowCallbackModal] = useState(false);
  const [cbDate, setCbDate] = useState('');
  const [cbTime, setCbTime] = useState('14:00');
  const [cbReason, setCbReason] = useState('');
  const [cbPriority, setCbPriority] = useState<'HIGH' | 'MEDIUM' | 'LOW'>('MEDIUM');

  // WhatsApp Templates Modal
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsAppType, setWhatsAppType] = useState<'FORM' | 'CV_REQUEST' | 'INTERVIEW_INVITE'>('FORM');

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedApp) {
      fetchCallHistory(selectedApp.id, selectedApp.candidateId);
      setRemarks('');
      setSelectedOutcome(null);
    }
  }, [selectedApp?.id]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [appRes, cbRes] = await Promise.all([
        fetch('/api/applications?limit=200'),
        fetch('/api/callbacks?status=PENDING'),
      ]);

      let appsData: ApplicationItem[] = [];
      let cbData: CallbackItem[] = [];

      if (appRes.ok) {
        const d = await appRes.json();
        appsData = d.data || [];
        setApplications(appsData);
      }

      if (cbRes.ok) {
        const d = await cbRes.json();
        cbData = d.data || [];
        setCallbacks(cbData);
      }

      if (appsData.length > 0) {
        // Set first candidate in prioritized order
        const prioritized = prioritizeList(appsData, cbData);
        if (prioritized.length > 0) {
          setSelectedApp(prioritized[0].app);
        }
      }
    } catch (err) {
      console.error('Error loading calling queue:', err);
      showToast('Failed to load calling queue', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchCallHistory = async (applicationId: string, candidateId: string) => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/calling/log?applicationId=${applicationId}&candidateId=${candidateId}`);
      if (res.ok) {
        const d = await res.json();
        setCallLogs(d.data || []);
      }
    } catch (err) {
      console.error('Error loading call logs:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchInitialData();
  };

  // Prioritization Engine
  const prioritizeList = (apps: ApplicationItem[], cbs: CallbackItem[]) => {
    const cbMap = new Map<string, CallbackItem>();
    cbs.forEach((c) => {
      if (c.applicationId) cbMap.set(c.applicationId, c);
    });

    const now = new Date();

    return apps.map((app) => {
      const cb = cbMap.get(app.id);
      let rank = 4; // Default: Remaining Leads
      let tag = 'Active Queue';
      let tagVariant: 'purple' | 'warning' | 'danger' | 'info' | 'neutral' = 'neutral';

      if (cb) {
        const isOverdue = new Date(cb.scheduledAt) < now;
        rank = 1;
        tag = isOverdue ? 'Callback Overdue' : 'Callback Due';
        tagVariant = isOverdue ? 'danger' : 'warning';
      } else if (app.currentStage === 'INTERESTED' || app.currentStage === 'CALLING') {
        rank = 2;
        tag = 'Follow-up Due';
        tagVariant = 'info';
      } else if (app.currentStage === 'NEW' || app.currentStage === 'ASSIGNED') {
        rank = 3;
        tag = 'Newly Assigned';
        tagVariant = 'purple';
      }

      return {
        app,
        callback: cb,
        rank,
        tag,
        tagVariant,
      };
    }).sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      return new Date(b.app.updatedAt).getTime() - new Date(a.app.updatedAt).getTime();
    });
  };

  // Filtered & Prioritized Queue
  const prioritizedQueue = useMemo(() => {
    const prioritized = prioritizeList(applications, callbacks);

    return prioritized.filter(({ app, callback, rank }) => {
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        app.candidate.fullName.toLowerCase().includes(query) ||
        app.candidate.phone.includes(query) ||
        app.candidate.normalizedPhone.includes(query) ||
        app.applicationCode.toLowerCase().includes(query) ||
        app.job.jobTitle.toLowerCase().includes(query) ||
        app.company.companyName.toLowerCase().includes(query);

      const matchesJob = jobFilter === 'ALL' || app.jobId === jobFilter;
      const matchesCompany = companyFilter === 'ALL' || app.companyId === companyFilter;

      let matchesTab = true;
      if (activeTab === 'CALLBACKS_DUE') {
        matchesTab = !!callback;
      } else if (activeTab === 'FOLLOWUPS_DUE') {
        matchesTab = app.currentStage === 'INTERESTED' || app.currentStage === 'CALLING';
      } else if (activeTab === 'NEW_ASSIGNED') {
        matchesTab = app.currentStage === 'NEW' || app.currentStage === 'ASSIGNED';
      } else if (activeTab === 'WORKED_TODAY') {
        matchesTab = (app._count?.callLogs ?? 0) > 0;
      } else if (activeTab === 'NOT_WORKED') {
        matchesTab = (app._count?.callLogs ?? 0) === 0;
      }

      return matchesSearch && matchesJob && matchesCompany && matchesTab;
    });
  }, [applications, callbacks, searchQuery, activeTab, jobFilter, companyFilter]);

  // Unique Job and Company options for dropdown filters
  const uniqueJobs = useMemo(() => {
    const map = new Map<string, string>();
    applications.forEach((a) => map.set(a.jobId, a.job.jobTitle));
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
  }, [applications]);

  const uniqueCompanies = useMemo(() => {
    const map = new Map<string, string>();
    applications.forEach((a) => map.set(a.companyId, a.company.companyName));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [applications]);

  // Top Summary Metrics
  const metrics = useMemo(() => {
    const total = applications.length;
    const callbacksDue = callbacks.length;
    const followupsDue = applications.filter((a) => a.currentStage === 'INTERESTED' || a.currentStage === 'CALLING').length;
    const workedToday = applications.filter((a) => (a._count?.callLogs ?? 0) > 0).length;
    const connectedCount = applications.filter((a) => a.currentStage === 'INTERESTED' || a.currentStage === 'SHORTLISTED').length;
    const shortlistedCount = applications.filter((a) => a.currentStage === 'SHORTLISTED').length;

    return { total, callbacksDue, followupsDue, workedToday, connectedCount, shortlistedCount };
  }, [applications, callbacks]);

  const handleCopy = (text: string, isPhone = true) => {
    navigator.clipboard.writeText(text);
    if (isPhone) {
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
      showToast('Candidate phone number copied to clipboard');
    } else {
      setCopiedMsg(true);
      setTimeout(() => setCopiedMsg(false), 2000);
      showToast('WhatsApp template copied to clipboard');
    }
  };

  const advanceToNext = (currentAppId: string) => {
    if (!autoAdvance) return;
    const currentIndex = prioritizedQueue.findIndex((item) => item.app.id === currentAppId);
    if (currentIndex !== -1 && currentIndex + 1 < prioritizedQueue.length) {
      setSelectedApp(prioritizedQueue[currentIndex + 1].app);
    }
  };

  const handleLogOutcome = async (outcome: string) => {
    if (!selectedApp) return;

    if (outcome === 'CALLBACK') {
      // Set default callback date to tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setCbDate(tomorrow.toISOString().split('T')[0]);
      setCbReason('Candidate requested callback');
      setShowCallbackModal(true);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/calling/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: selectedApp.id,
          candidateId: selectedApp.candidateId,
          callOutcome: outcome,
          remarks: remarks || `Call outcome recorded as ${outcome}`,
        }),
      });

      const d = await res.json();
      if (!res.ok) {
        showToast(d.error || 'Failed to log call outcome', 'error');
        setSubmitting(false);
        return;
      }

      showToast(`Call logged as ${outcome.replace(/_/g, ' ')}!`);
      const currentId = selectedApp.id;

      // Refresh applications and call history
      await fetchInitialData();
      if (currentId) {
        await fetchCallHistory(currentId, selectedApp.candidateId);
      }

      advanceToNext(currentId);
    } catch (err) {
      showToast('Network error while logging call', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleScheduleCallback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp || !cbDate) return;

    setSubmitting(true);
    try {
      const scheduledDateTime = new Date(`${cbDate}T${cbTime}:00`);

      const res = await fetch('/api/calling/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: selectedApp.id,
          candidateId: selectedApp.candidateId,
          callOutcome: 'CALLBACK',
          remarks: remarks || cbReason || 'Callback scheduled',
          callbackRequired: true,
          callbackDateTime: scheduledDateTime.toISOString(),
          callbackReason: cbReason,
          callbackPriority: cbPriority,
        }),
      });

      const d = await res.json();
      if (!res.ok) {
        showToast(d.error || 'Failed to schedule callback', 'error');
        setSubmitting(false);
        return;
      }

      setShowCallbackModal(false);
      showToast('Callback scheduled successfully!');
      const currentId = selectedApp.id;

      await fetchInitialData();
      advanceToNext(currentId);
    } catch (err) {
      showToast('Connection error while scheduling callback', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const getWhatsAppMessageText = () => {
    if (!selectedApp) return '';
    const cName = selectedApp.candidate.fullName;
    const jTitle = selectedApp.job.jobTitle;
    const cNameComp = selectedApp.company.companyName;

    switch (whatsAppType) {
      case 'FORM':
        return `Hello ${cName},

Thank you for speaking with Genius Consultancy regarding the *${jTitle}* opening at *${cNameComp}*.

Please complete your official candidate application form using the secure link below:
https://geniusconsultancy.in/form/${selectedApp.applicationCode}

Kindly share your confirmation here once submitted.

Best Regards,
Genius Consultancy Operations`;
      case 'CV_REQUEST':
        return `Hello ${cName},

We have received your profile for *${jTitle}* at *${cNameComp}*. Please share your updated CV / Resume document directly on this WhatsApp chat for immediate screening review.

Thank you,
Genius Consultancy Team`;
      case 'INTERVIEW_INVITE':
        return `Congratulations ${cName}!

Your profile has been shortlisted for an in-person interview for the *${jTitle}* position at *${cNameComp}*.

📅 Date & Time: Tomorrow 11:00 AM
📍 Venue: Company Office

Please carry 2 copies of your updated resume and ID proof.

Best of luck,
Genius Consultancy`;
      default:
        return '';
    }
  };

  return (
    <div className="space-y-5 select-none">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg border text-xs font-semibold flex items-center gap-2 animate-in slide-in-from-top-2 duration-200 ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-teal-600 uppercase tracking-wider">
              RECRUITMENT OPERATIONS
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-100 text-teal-800 flex items-center gap-1">
              <PhoneCall className="w-3 h-3" />
              Manual Dialing Workspace
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1 flex items-center gap-2">
            Executive Calling Workspace
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Work your assigned candidates, make calls using your external phone/dialer, and record the outcome in CRM.
          </p>
        </div>

        {/* Right Header Controls */}
        <div className="flex items-center gap-3">
          {/* Auto Advance Toggle */}
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <input
              type="checkbox"
              checked={autoAdvance}
              onChange={(e) => setAutoAdvance(e.target.checked)}
              className="rounded text-teal-600 focus:ring-teal-500"
            />
            <span>Auto-Advance Queue</span>
          </label>

          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors text-xs flex items-center gap-1 font-medium"
            title="Refresh Queue"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-teal-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Top Summary Queue Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm">
          <div className="text-[11px] font-medium text-slate-500">Assigned Queue</div>
          <div className="text-xl font-bold text-slate-900 mt-0.5">{metrics.total}</div>
        </div>

        <div className="bg-white rounded-xl border border-amber-200 bg-amber-50/30 p-3.5 shadow-sm">
          <div className="text-[11px] font-semibold text-amber-800 flex items-center gap-1">
            <CalendarClock className="w-3 h-3 text-amber-600" />
            Callbacks Due
          </div>
          <div className="text-xl font-bold text-amber-700 mt-0.5">{metrics.callbacksDue}</div>
        </div>

        <div className="bg-white rounded-xl border border-sky-200 bg-sky-50/30 p-3.5 shadow-sm">
          <div className="text-[11px] font-semibold text-sky-800">Follow-ups Due</div>
          <div className="text-xl font-bold text-sky-700 mt-0.5">{metrics.followupsDue}</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm">
          <div className="text-[11px] font-medium text-slate-500">Worked Today</div>
          <div className="text-xl font-bold text-slate-800 mt-0.5">{metrics.workedToday}</div>
        </div>

        <div className="bg-white rounded-xl border border-teal-200 bg-teal-50/30 p-3.5 shadow-sm">
          <div className="text-[11px] font-semibold text-teal-800">Connected / Active</div>
          <div className="text-xl font-bold text-teal-700 mt-0.5">{metrics.connectedCount}</div>
        </div>

        <div className="bg-white rounded-xl border border-purple-200 bg-purple-50/30 p-3.5 shadow-sm">
          <div className="text-[11px] font-semibold text-purple-800">Shortlisted</div>
          <div className="text-xl font-bold text-purple-700 mt-0.5">{metrics.shortlistedCount}</div>
        </div>
      </div>

      {/* Main Calling Workspace Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* ========================================================================= */}
        {/* LEFT COLUMN: PRIORITIZED CALLING QUEUE (5 Columns) */}
        {/* ========================================================================= */}
        <div className="lg:col-span-5 flex flex-col space-y-3">
          {/* Queue Filter Tabs */}
          <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm space-y-2.5">
            <div className="flex flex-wrap gap-1 border-b border-slate-100 pb-2 text-[11px]">
              <button
                onClick={() => setActiveTab('ALL')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                  activeTab === 'ALL'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                All ({applications.length})
              </button>
              <button
                onClick={() => setActiveTab('CALLBACKS_DUE')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                  activeTab === 'CALLBACKS_DUE'
                    ? 'bg-amber-600 text-white'
                    : 'text-amber-700 bg-amber-50 hover:bg-amber-100'
                }`}
              >
                Callbacks ({callbacks.length})
              </button>
              <button
                onClick={() => setActiveTab('FOLLOWUPS_DUE')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                  activeTab === 'FOLLOWUPS_DUE'
                    ? 'bg-sky-600 text-white'
                    : 'text-sky-700 bg-sky-50 hover:bg-sky-100'
                }`}
              >
                Follow-ups
              </button>
              <button
                onClick={() => setActiveTab('NEW_ASSIGNED')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                  activeTab === 'NEW_ASSIGNED'
                    ? 'bg-purple-600 text-white'
                    : 'text-purple-700 bg-purple-50 hover:bg-purple-100'
                }`}
              >
                New Leads
              </button>
              <button
                onClick={() => setActiveTab('NOT_WORKED')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                  activeTab === 'NOT_WORKED'
                    ? 'bg-rose-600 text-white'
                    : 'text-rose-700 bg-rose-50 hover:bg-rose-100'
                }`}
              >
                Unworked
              </button>
            </div>

            {/* Search & Dropdown Filters */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search candidate, phone, code..."
                  className="w-full pl-8 pr-2.5 py-1.5 border border-slate-200 rounded-lg text-xs outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <select
                  value={jobFilter}
                  onChange={(e) => setJobFilter(e.target.value)}
                  className="px-2 py-1.5 border border-slate-200 rounded-lg text-[11px] text-slate-700 outline-none bg-white truncate"
                >
                  <option value="ALL">All Jobs ({uniqueJobs.length})</option>
                  {uniqueJobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.title}
                    </option>
                  ))}
                </select>

                <select
                  value={companyFilter}
                  onChange={(e) => setCompanyFilter(e.target.value)}
                  className="px-2 py-1.5 border border-slate-200 rounded-lg text-[11px] text-slate-700 outline-none bg-white truncate"
                >
                  <option value="ALL">All Companies ({uniqueCompanies.length})</option>
                  {uniqueCompanies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Queue Cards List */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col min-h-[520px] max-h-[640px]">
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-700">
              <span>Prioritized Queue ({prioritizedQueue.length})</span>
              <span className="text-[11px] text-slate-500 font-normal">Sorted by urgency</span>
            </div>

            <div className="overflow-y-auto divide-y divide-slate-100 flex-1">
              {loading ? (
                <div className="py-16 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-teal-600" />
                  <span>Loading calling queue...</span>
                </div>
              ) : prioritizedQueue.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-xs">
                  No candidates in this queue view.
                </div>
              ) : (
                prioritizedQueue.map(({ app, callback, tag, tagVariant }) => {
                  const isSelected = selectedApp?.id === app.id;
                  return (
                    <div
                      key={app.id}
                      onClick={() => setSelectedApp(app)}
                      className={`p-3 cursor-pointer transition-all flex flex-col gap-1.5 border-l-4 ${
                        isSelected
                          ? 'bg-teal-50/90 border-teal-600 shadow-sm'
                          : 'hover:bg-slate-50 border-transparent'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                            <span>{app.candidate.fullName}</span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              #{app.applicationCode}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-600 font-medium truncate max-w-[220px]">
                            {app.job.jobTitle} • <span className="text-slate-500">{app.company.companyName}</span>
                          </div>
                        </div>

                        <Badge variant={tagVariant}>{tag}</Badge>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 mt-0.5">
                        <div className="font-mono font-semibold text-slate-700">
                          {app.candidate.phone}
                        </div>
                        <StageBadge stage={app.currentStage} />
                      </div>

                      {callback && (
                        <div className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded flex items-center justify-between">
                          <span className="font-medium">Callback:</span>
                          <span className="font-mono font-semibold">
                            {new Date(callback.scheduledAt).toLocaleString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: ACTIVE CANDIDATE CALLING CARD (7 Columns) */}
        {/* ========================================================================= */}
        <div className="lg:col-span-7 flex flex-col space-y-4">
          {selectedApp ? (
            <>
              {/* Candidate Calling Card */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-5">
                {/* Header & Prominent Phone Number Banner */}
                <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="text-xs text-slate-300 flex items-center gap-2">
                      <span>#{selectedApp.applicationCode}</span>
                      <span>•</span>
                      <span className="text-teal-400 font-semibold">
                        {selectedApp.job.jobTitle}
                      </span>
                    </div>
                    <div className="text-xl font-bold text-white mt-0.5">
                      {selectedApp.candidate.fullName}
                    </div>
                    <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                      <Building2 className="w-3.5 h-3.5" />
                      <span>{selectedApp.company.companyName}</span>
                    </div>
                  </div>

                  {/* Prominent Copyable Phone Box */}
                  <div className="bg-slate-950/70 border border-slate-700 rounded-lg p-3 flex items-center gap-3">
                    <div>
                      <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                        Candidate Phone
                      </div>
                      <div className="text-lg font-mono font-bold text-teal-300">
                        {selectedApp.candidate.phone}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => handleCopy(selectedApp.candidate.phone, true)}
                        className="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded text-xs font-semibold flex items-center gap-1 transition-colors shadow-sm"
                        title="Copy phone number"
                      >
                        {copiedPhone ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedPhone ? 'Copied!' : 'Copy'}</span>
                      </button>

                      <a
                        href={`tel:${selectedApp.candidate.phone}`}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-medium flex items-center gap-1 transition-colors text-center justify-center"
                        title="Open device dialer to call externally (does not log call automatically)"
                      >
                        <PhoneCall className="w-3 h-3 text-teal-400" />
                        <span>Call Externally</span>
                      </a>
                    </div>
                  </div>
                </div>

                {/* Candidate Operational Attributes Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Experience</span>
                    <span className="font-bold text-slate-800">
                      {selectedApp.candidate.experienceYears ?? 0}y {selectedApp.candidate.experienceMonths ?? 0}m
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Current Company</span>
                    <span className="font-semibold text-slate-800 truncate block">
                      {selectedApp.candidate.currentCompany || 'Not specified'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Current CTC</span>
                    <span className="font-bold text-slate-800">
                      {selectedApp.candidate.currentSalary ? `₹${selectedApp.candidate.currentSalary.toLocaleString()}` : 'N/A'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Expected CTC</span>
                    <span className="font-bold text-teal-700">
                      {selectedApp.candidate.expectedSalary ? `₹${selectedApp.candidate.expectedSalary.toLocaleString()}` : 'Negotiable'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Location</span>
                    <span className="font-semibold text-slate-800">
                      {selectedApp.candidate.currentLocation || 'Not specified'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Current Stage</span>
                    <div className="mt-0.5"><StageBadge stage={selectedApp.currentStage} /></div>
                  </div>

                  <div className="col-span-2 flex items-center gap-3 pt-1">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                        selectedApp.candidate.hasTwoWheeler
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      <Bike className="w-3.5 h-3.5" />
                      {selectedApp.candidate.hasTwoWheeler ? 'Has 2-Wheeler' : 'No Bike'}
                    </span>

                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                        selectedApp.candidate.hasDrivingLicense
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      {selectedApp.candidate.hasDrivingLicense ? 'Driving License' : 'No License'}
                    </span>

                    <button
                      onClick={() => setShowWhatsAppModal(true)}
                      className="ml-auto px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-sm transition-colors"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </button>
                  </div>
                </div>

                {/* Call Notes Textarea */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span>Call Observations & Remarks</span>
                    <span className="text-[11px] text-slate-400 font-normal">Recorded with call log</span>
                  </label>
                  <textarea
                    rows={2}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Type candidate response, salary discussion, notice period, location preference, or callback reason..."
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                  />
                </div>

                {/* FAST CALL OUTCOME BUTTONS GRID */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Record Call Interaction Outcome
                    </label>
                    <span className="text-[10px] text-slate-400">
                      Creates CallLog & updates operational activity
                    </span>
                  </div>

                  {/* Positive / Stage Advancing Outcomes */}
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <button
                        onClick={() => handleLogOutcome('CONNECTED')}
                        disabled={submitting}
                        className="p-2.5 bg-teal-50 hover:bg-teal-100 border border-teal-300 text-teal-800 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 shadow-sm"
                      >
                        <PhoneCall className="w-4 h-4 text-teal-600" />
                        <span>Connected</span>
                      </button>

                      <button
                        onClick={() => handleLogOutcome('SHORTLISTED')}
                        disabled={submitting}
                        className="p-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 shadow-sm"
                      >
                        <Sparkles className="w-4 h-4 text-purple-200" />
                        <span>Shortlisted</span>
                      </button>

                      <button
                        onClick={() => handleLogOutcome('INTERESTED')}
                        disabled={submitting}
                        className="p-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 shadow-sm"
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                        <span>Interested</span>
                      </button>

                      <button
                        onClick={() => handleLogOutcome('CALLBACK')}
                        disabled={submitting}
                        className="p-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 shadow-sm"
                      >
                        <CalendarClock className="w-4 h-4 text-amber-200" />
                        <span>Schedule Callback</span>
                      </button>
                    </div>

                    {/* Unreachable / Busy Outcomes */}
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => handleLogOutcome('RNR')}
                        disabled={submitting}
                        className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all disabled:opacity-50"
                      >
                        <PhoneOff className="w-3.5 h-3.5 text-slate-500" />
                        <span>RNR (No Response)</span>
                      </button>

                      <button
                        onClick={() => handleLogOutcome('BUSY')}
                        disabled={submitting}
                        className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all disabled:opacity-50"
                      >
                        <PhoneForwarded className="w-3.5 h-3.5 text-slate-500" />
                        <span>Line Busy</span>
                      </button>

                      <button
                        onClick={() => handleLogOutcome('SWITCHED_OFF')}
                        disabled={submitting}
                        className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all disabled:opacity-50"
                      >
                        <PhoneOff className="w-3.5 h-3.5 text-slate-500" />
                        <span>Switched Off</span>
                      </button>
                    </div>

                    {/* Disqualification Outcomes */}
                    <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100">
                      <button
                        onClick={() => handleLogOutcome('NOT_INTERESTED')}
                        disabled={submitting}
                        className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all disabled:opacity-50"
                      >
                        <span>Not Interested</span>
                      </button>

                      <button
                        onClick={() => handleLogOutcome('NOT_ELIGIBLE')}
                        disabled={submitting}
                        className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all disabled:opacity-50"
                      >
                        <span>Not Eligible</span>
                      </button>

                      <button
                        onClick={() => handleLogOutcome('WRONG_NUMBER')}
                        disabled={submitting}
                        className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all disabled:opacity-50"
                      >
                        <span>Wrong Number</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Chronological Call History Timeline */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-slate-500" />
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Candidate Call History ({callLogs.length})
                    </h3>
                  </div>
                  {loadingHistory && (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-teal-600" />
                  )}
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1 divide-y divide-slate-100">
                  {callLogs.length === 0 ? (
                    <div className="py-6 text-center text-slate-400 text-xs">
                      No calls logged yet for this candidate.
                    </div>
                  ) : (
                    callLogs.map((log) => (
                      <div key={log.id} className="pt-2 first:pt-0 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Badge variant={log.callOutcome === 'SHORTLISTED' || log.callOutcome === 'INTERESTED' ? 'success' : log.callOutcome === 'CALLBACK' ? 'warning' : 'neutral'}>
                              {log.callOutcome.replace(/_/g, ' ')}
                            </Badge>
                            <span className="text-[11px] text-slate-500">
                              by {log.executive?.fullName || 'Executive'}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(log.createdAt).toLocaleString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        {log.remarks && (
                          <p className="text-[11px] text-slate-700 bg-slate-50 p-1.5 rounded border border-slate-100">
                            {log.remarks}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-16 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-3">
              <PhoneCall className="w-8 h-8 text-slate-300" />
              <p>Select a candidate from the prioritized queue on the left to begin calling.</p>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CALLBACK SCHEDULING MODAL */}
      {/* ========================================================================= */}
      <Modal
        isOpen={showCallbackModal}
        onClose={() => setShowCallbackModal(false)}
        title="Schedule Candidate Callback"
        subtitle={`Set follow-up reminder for ${selectedApp?.candidate.fullName || 'Candidate'}`}
        maxWidth="md"
      >
        <form onSubmit={handleScheduleCallback} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Callback Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={cbDate}
                onChange={(e) => setCbDate(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Callback Time <span className="text-rose-500">*</span>
              </label>
              <input
                type="time"
                required
                value={cbTime}
                onChange={(e) => setCbTime(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Priority Level
            </label>
            <select
              value={cbPriority}
              onChange={(e) => setCbPriority(e.target.value as any)}
              className="w-full p-2.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none bg-white"
            >
              <option value="HIGH">HIGH - Urgent Interested Lead</option>
              <option value="MEDIUM">MEDIUM - Standard Callback</option>
              <option value="LOW">LOW - Follow-up if time permits</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Callback Reason / Notes
            </label>
            <textarea
              rows={2}
              value={cbReason}
              onChange={(e) => setCbReason(e.target.value)}
              placeholder="e.g. Candidate was in office meeting, asked to call tomorrow 2 PM."
              className="w-full p-2.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowCallbackModal(false)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !cbDate}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5"
            >
              {submitting ? 'Scheduling...' : 'Save & Schedule Callback'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* WHATSAPP TEMPLATES MODAL */}
      {/* ========================================================================= */}
      <Modal
        isOpen={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
        title="WhatsApp Quick Templates"
        subtitle="Copy ready-made message templates to send to candidate via external WhatsApp"
        maxWidth="lg"
      >
        <div className="space-y-4 text-xs">
          <div className="flex gap-2 border-b border-slate-100 pb-2">
            <button
              type="button"
              onClick={() => setWhatsAppType('FORM')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                whatsAppType === 'FORM'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              1. Screening Form Link
            </button>
            <button
              type="button"
              onClick={() => setWhatsAppType('CV_REQUEST')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                whatsAppType === 'CV_REQUEST'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              2. CV / Resume Request
            </button>
            <button
              type="button"
              onClick={() => setWhatsAppType('INTERVIEW_INVITE')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                whatsAppType === 'INTERVIEW_INVITE'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              3. Interview Invite
            </button>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 font-mono text-xs whitespace-pre-wrap text-slate-800">
            {getWhatsAppMessageText()}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <div className="text-[11px] text-slate-500">
              Target: <span className="font-mono font-semibold text-slate-800">{selectedApp?.candidate.phone}</span>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowWhatsAppModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>

              <button
                type="button"
                onClick={() => handleCopy(getWhatsAppMessageText(), false)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
              >
                {copiedMsg ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedMsg ? 'Copied to Clipboard!' : 'Copy Template Message'}</span>
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
