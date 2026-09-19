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
  FileText,
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
  ShieldAlert,
  Save,
  CheckCircle,
  XCircle,
  HelpCircle,
  Briefcase,
  MapPin,
  IndianRupee,
  GraduationCap,
  Car,
} from 'lucide-react';

interface VerificationData {
  id?: string;
  applicationId?: string;
  email?: string;
  age?: number | null;
  gender?: string;
  currentLocation?: string;
  appliedLocation?: string;
  education?: string;
  experienceYears?: number | null;
  experienceMonths?: number | null;
  currentCompany?: string;
  previousCompany?: string;
  currentSalary?: number | null;
  expectedSalary?: number | null;
  noticePeriod?: string;
  hasTwoWheeler?: boolean | null;
  hasDrivingLicense?: boolean | null;
  interestedInFieldSales?: boolean | null;
  interestedInAutomobile?: boolean | null;
  skills?: string[];
  languages?: string[];
}

interface ApplicationItem {
  id: string;
  applicationCode: string;
  candidateId: string;
  jobId: string;
  companyId: string;
  targetLocation?: string | null;
  currentStage: string;
  formStatus: string;
  cvStatus: string;
  updatedAt: string;
  candidate: {
    id: string;
    candidateCode?: string;
    fullName: string;
    phone: string;
    normalizedPhone: string;
    alternatePhone?: string | null;
    email?: string | null;
    gender?: string | null;
    age?: number | null;
    currentLocation?: string | null;
    currentCompany?: string | null;
    currentJob?: string | null;
    highestEducation?: string | null;
    experienceYears?: number;
    experienceMonths?: number;
    currentSalary?: number | null;
    expectedSalary?: number | null;
    noticePeriod?: string | null;
    hasTwoWheeler?: boolean;
    hasDrivingLicense?: boolean;
    skills?: string[];
  };
  job: {
    id: string;
    jobTitle: string;
    location?: string;
    locations?: any[];
    vacancies?: number;
    salaryMin?: number | null;
    salaryMax?: number | null;
    experienceMin?: number;
    experienceMax?: number | null;
    twoWheelerRequired?: boolean;
    drivingLicenseRequired?: boolean;
    educationRequirement?: string | null;
    genderRequirement?: string | null;
    ageRequirement?: string | null;
    jobDescription?: string | null;
    company: {
      id: string;
      companyName: string;
    };
  };
  company: {
    id: string;
    companyName: string;
  };
  verification?: VerificationData | null;
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

  // Active Tab inside Candidate View
  const [activeRightTab, setActiveRightTab] = useState<'VERIFICATION' | 'DOCUMENTS' | 'CALL_LOG' | 'HISTORY'>('VERIFICATION');
  const [docSubmitting, setDocSubmitting] = useState(false);
  const [shortlisting, setShortlisting] = useState(false);

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
  const [savingVerification, setSavingVerification] = useState(false);

  // Candidate Verification Form State
  const [verifForm, setVerifForm] = useState<VerificationData>({
    email: '',
    age: null,
    gender: 'Male',
    currentLocation: '',
    appliedLocation: '',
    education: '',
    experienceYears: null,
    experienceMonths: null,
    currentCompany: '',
    previousCompany: '',
    currentSalary: null,
    expectedSalary: null,
    noticePeriod: 'Immediate',
    hasTwoWheeler: null,
    hasDrivingLicense: null,
    interestedInFieldSales: null,
    interestedInAutomobile: null,
    skills: [],
    languages: ['Hindi', 'English'],
  });

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
      fetchVerification(selectedApp.id, selectedApp);
      setRemarks('');
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
        const prioritized = prioritizeList(appsData, cbData);
        if (prioritized.length > 0 && !selectedApp) {
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

  const fetchVerification = async (applicationId: string, app: ApplicationItem) => {
    try {
      const res = await fetch(`/api/applications/${applicationId}/verification`);
      if (res.ok) {
        const d = await res.json();
        if (d.data?.verification) {
          const v = d.data.verification;
          setVerifForm({
            email: v.email ?? '',
            age: v.age ?? null,
            gender: v.gender ?? 'Male',
            currentLocation: v.currentLocation ?? '',
            appliedLocation: v.appliedLocation ?? '',
            education: v.education ?? '',
            experienceYears: v.experienceYears ?? null,
            experienceMonths: v.experienceMonths ?? null,
            currentCompany: v.currentCompany ?? '',
            previousCompany: v.previousCompany ?? '',
            currentSalary: v.currentSalary ? Number(v.currentSalary) : null,
            expectedSalary: v.expectedSalary ? Number(v.expectedSalary) : null,
            noticePeriod: v.noticePeriod ?? 'Immediate',
            hasTwoWheeler: v.hasTwoWheeler ?? null,
            hasDrivingLicense: v.hasDrivingLicense ?? null,
            interestedInFieldSales: v.interestedInFieldSales ?? null,
            interestedInAutomobile: v.interestedInAutomobile ?? null,
            skills: Array.isArray(v.skills) ? v.skills : [],
            languages: Array.isArray(v.languages) && v.languages.length > 0 ? v.languages : ['Hindi', 'English'],
          });
          return;
        }
      }

      // Initial unverified state (authoritative verification is empty until entered or pre-filled)
      setVerifForm({
        email: '',
        age: null,
        gender: 'Male',
        currentLocation: '',
        appliedLocation: '',
        education: '',
        experienceYears: null,
        experienceMonths: null,
        currentCompany: '',
        previousCompany: '',
        currentSalary: null,
        expectedSalary: null,
        noticePeriod: 'Immediate',
        hasTwoWheeler: null,
        hasDrivingLicense: null,
        interestedInFieldSales: null,
        interestedInAutomobile: null,
        skills: [],
        languages: ['Hindi', 'English'],
      });
    } catch (err) {
      console.error('Error fetching verification:', err);
    }
  };

  const prefillFromSource = () => {
    if (!selectedApp) return;
    const c = selectedApp.candidate;
    setVerifForm({
      email: c.email ?? '',
      age: c.age ?? null,
      gender: c.gender ?? 'Male',
      currentLocation: c.currentLocation ?? '',
      appliedLocation: selectedApp.targetLocation || selectedApp.job?.location || '',
      education: c.highestEducation ?? '',
      experienceYears: c.experienceYears ?? 0,
      experienceMonths: c.experienceMonths ?? 0,
      currentCompany: c.currentCompany ?? '',
      previousCompany: '',
      currentSalary: c.currentSalary ?? null,
      expectedSalary: c.expectedSalary ?? null,
      noticePeriod: c.noticePeriod ?? 'Immediate',
      hasTwoWheeler: c.hasTwoWheeler ?? false,
      hasDrivingLicense: c.hasDrivingLicense ?? false,
      interestedInFieldSales: false,
      interestedInAutomobile: false,
      skills: c.skills ?? [],
      languages: ['Hindi', 'English'],
    });
    showToast('Pre-filled verification form from source master reference.');
  };

  const handleDocumentAction = async (action: 'FORM_SENT' | 'FORM_RECEIVED' | 'CV_REQUESTED' | 'CV_RECEIVED') => {
    if (!selectedApp) return;
    setDocSubmitting(true);
    try {
      const res = await fetch(`/api/applications/${selectedApp.id}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        const d = await res.json();
        setSelectedApp((prev: any) => ({
          ...prev,
          formStatus: d.data.formStatus,
          cvStatus: d.data.cvStatus,
          currentStage: d.data.currentStage,
          readyForScreeningAt: d.data.readyForScreeningAt,
        }));
        setApplications((prev) =>
          prev.map((a) =>
            a.id === selectedApp.id
              ? {
                  ...a,
                  formStatus: d.data.formStatus,
                  cvStatus: d.data.cvStatus,
                  currentStage: d.data.currentStage,
                }
              : a
          )
        );
        showToast(`Document updated: ${action.replace(/_/g, ' ')}`);
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to update document', 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Error updating document', 'error');
    } finally {
      setDocSubmitting(false);
    }
  };

  const handleShortlistApplication = async () => {
    if (!selectedApp) return;
    setShortlisting(true);
    try {
      const res = await fetch(`/api/applications/${selectedApp.id}/shortlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: remarks || 'Shortlisted by calling executive' }),
      });
      if (res.ok) {
        const d = await res.json();
        setSelectedApp((prev: any) => ({
          ...prev,
          currentStage: d.data.currentStage,
        }));
        setApplications((prev) =>
          prev.map((a) =>
            a.id === selectedApp.id ? { ...a, currentStage: d.data.currentStage } : a
          )
        );
        showToast('Candidate shortlisted successfully! Document collection is now active.');
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to shortlist', 'error');
      }
    } catch (e: any) {
      showToast('Failed to shortlist application', 'error');
    } finally {
      setShortlisting(false);
    }
  };

  const getNextActionPrompt = (app: ApplicationItem) => {
    const isFormReady = app.formStatus === 'RECEIVED';
    const isCvReady = ['CV_RECEIVED', 'VERIFIED'].includes(app.cvStatus);

    if (app.currentStage === 'NEW' || app.currentStage === 'ASSIGNED') {
      return { text: 'Next: Call candidate & confirm details', variant: 'purple' as const };
    }
    if (app.currentStage === 'CALLING') {
      return { text: 'Next: Complete call & log outcome', variant: 'info' as const };
    }
    if (app.currentStage === 'INTERESTED') {
      return { text: 'Next: Shortlist candidate if suitable', variant: 'warning' as const };
    }
    if (app.currentStage === 'SHORTLISTED') {
      if (!isFormReady && !isCvReady) {
        return {
          text: app.formStatus === 'SENT' ? 'Next: Follow up for Google Form' : 'Next: Send Google Form',
          variant: 'warning' as const,
        };
      }
      if (isFormReady && !isCvReady) {
        return {
          text: app.cvStatus === 'CV_REQUESTED' ? 'Next: Follow up for WhatsApp CV' : 'Next: Request CV via WhatsApp',
          variant: 'warning' as const,
        };
      }
      if (!isFormReady && isCvReady) {
        return {
          text: app.formStatus === 'SENT' ? 'Next: Follow up for Google Form' : 'Next: Send Google Form',
          variant: 'warning' as const,
        };
      }
      return { text: '✓ Ready for Screening Gate', variant: 'success' as const };
    }
    if (app.currentStage === 'SCREENING_PENDING') {
      return { text: '✓ In Screening Queue (Waiting for Screening Manager)', variant: 'success' as const };
    }
    if (app.currentStage === 'SCREENING_PASSED') {
      return { text: '✓ Passed Screening (Eligible for Final Shortlist)', variant: 'success' as const };
    }
    if (app.currentStage === 'FINAL_SHORTLIST') {
      return { text: '✓ Final Shortlisted (Ready for Client Submission)', variant: 'purple' as const };
    }
    if (app.currentStage === 'SENT_TO_CLIENT') {
      return { text: '✓ Submitted to Client (Interview Scheduling)', variant: 'info' as const };
    }
    return { text: `Stage: ${app.currentStage}`, variant: 'neutral' as const };
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
      let rank = 4;
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

  const prioritizedQueue = useMemo(() => {
    const prioritized = prioritizeList(applications, callbacks);

    return prioritized.filter(({ app, callback }) => {
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

  const metrics = useMemo(() => {
    const total = applications.length;
    const callbacksDue = callbacks.length;
    const followupsDue = applications.filter((a) => a.currentStage === 'INTERESTED' || a.currentStage === 'CALLING').length;
    const workedToday = applications.filter((a) => (a._count?.callLogs ?? 0) > 0).length;
    const connectedCount = applications.filter((a) => a.currentStage === 'INTERESTED' || a.currentStage === 'SHORTLISTED').length;
    const shortlistedCount = applications.filter((a) => a.currentStage === 'SHORTLISTED').length;

    return { total, callbacksDue, followupsDue, workedToday, connectedCount, shortlistedCount };
  }, [applications, callbacks]);

  // Real-time Qualification Matching Engine (Rule-based vs Job Requirement)
  const qualificationResults = useMemo(() => {
    if (!selectedApp) return null;

    const job = selectedApp.job;
    const rules: {
      rule: string;
      status: 'MATCH' | 'MISMATCH' | 'REVIEW';
      reason: string;
      verifiedValue: string;
      requirement: string;
    }[] = [];

    // 1. Age Rule
    if (job.ageRequirement) {
      const numbers = job.ageRequirement.match(/\d+/g)?.map(Number) || [];
      if (verifForm.age != null) {
        if (numbers.length >= 2) {
          const [min, max] = numbers;
          const status = verifForm.age >= min && verifForm.age <= max ? 'MATCH' : 'MISMATCH';
          rules.push({
            rule: 'Age Criteria',
            requirement: job.ageRequirement,
            verifiedValue: `${verifForm.age} Yrs`,
            status,
            reason: status === 'MATCH' ? `Verified age ${verifForm.age} fits requirement (${min}-${max} yrs)` : `Verified age ${verifForm.age} outside criteria (${min}-${max} yrs)`,
          });
        } else if (numbers.length === 1) {
          const isMax = job.ageRequirement.toLowerCase().includes('max') || job.ageRequirement.toLowerCase().includes('under');
          const status = isMax ? (verifForm.age <= numbers[0] ? 'MATCH' : 'MISMATCH') : (verifForm.age >= numbers[0] ? 'MATCH' : 'MISMATCH');
          rules.push({
            rule: 'Age Criteria',
            requirement: job.ageRequirement,
            verifiedValue: `${verifForm.age} Yrs`,
            status,
            reason: `Verified age evaluated vs threshold (${numbers[0]})`,
          });
        } else {
          rules.push({
            rule: 'Age Criteria',
            requirement: job.ageRequirement,
            verifiedValue: `${verifForm.age} Yrs`,
            status: 'REVIEW',
            reason: 'Age format requires manual review',
          });
        }
      } else {
        rules.push({
          rule: 'Age Criteria',
          requirement: job.ageRequirement,
          verifiedValue: 'Not Verified',
          status: 'REVIEW',
          reason: 'Candidate age has not been confirmed on call',
        });
      }
    } else {
      rules.push({
        rule: 'Age Criteria',
        requirement: 'Open / Any Age',
        verifiedValue: verifForm.age != null ? `${verifForm.age} Yrs` : 'Not required',
        status: 'MATCH',
        reason: 'No age constraints for this position',
      });
    }

    // 2. Experience Rule
    const expMin = job.experienceMin ?? 0;
    const expMax = job.experienceMax;
    let expReqStr = `Min ${expMin} yr`;
    if (expMax) expReqStr += ` - Max ${expMax} yrs`;

    if (verifForm.experienceYears != null || verifForm.experienceMonths != null) {
      const candExpYears = (verifForm.experienceYears ?? 0) + ((verifForm.experienceMonths ?? 0) / 12);
      const candExpDisplay = `${verifForm.experienceYears ?? 0}y ${verifForm.experienceMonths ?? 0}m`;

      let expStatus: 'MATCH' | 'MISMATCH' | 'REVIEW' = 'MATCH';
      let expNotes = 'Verified experience satisfies job requirement';

      if (candExpYears < expMin) {
        expStatus = 'MISMATCH';
        expNotes = `${candExpDisplay} is below required minimum (${expMin} yrs)`;
      } else if (expMax && candExpYears > expMax) {
        expStatus = 'REVIEW';
        expNotes = `${candExpDisplay} exceeds maximum target (${expMax} yrs) - overqualification review`;
      }

      rules.push({
        rule: 'Experience Level',
        requirement: expReqStr,
        verifiedValue: candExpDisplay,
        status: expStatus,
        reason: expNotes,
      });
    } else if (expMin > 0) {
      rules.push({
        rule: 'Experience Level',
        requirement: expReqStr,
        verifiedValue: 'Not Verified',
        status: 'REVIEW',
        reason: 'Experience not yet confirmed with candidate',
      });
    } else {
      rules.push({
        rule: 'Experience Level',
        requirement: expReqStr,
        verifiedValue: 'Fresher / Open',
        status: 'MATCH',
        reason: 'Fresher / open experience accepted',
      });
    }

    // 3. Expected Salary Rule
    const maxSal = job.salaryMax != null ? Number(job.salaryMax) : null;
    const expSal = verifForm.expectedSalary != null ? Number(verifForm.expectedSalary) : null;

    if (maxSal != null) {
      if (expSal != null) {
        let salStatus: 'MATCH' | 'MISMATCH' | 'REVIEW' = 'MATCH';
        let salNotes = `Expected ₹${expSal.toLocaleString()} is within budget (max ₹${maxSal.toLocaleString()})`;

        if (expSal > maxSal) {
          salStatus = 'MISMATCH';
          salNotes = `Expected ₹${expSal.toLocaleString()} exceeds job max budget ₹${maxSal.toLocaleString()}`;
        }

        rules.push({
          rule: 'Salary Alignment',
          requirement: `Budget up to ₹${maxSal.toLocaleString()}`,
          verifiedValue: `₹${expSal.toLocaleString()}`,
          status: salStatus,
          reason: salNotes,
        });
      } else {
        rules.push({
          rule: 'Salary Alignment',
          requirement: `Budget up to ₹${maxSal.toLocaleString()}`,
          verifiedValue: 'Not Verified',
          status: 'REVIEW',
          reason: 'Expected salary not yet confirmed with candidate',
        });
      }
    } else {
      rules.push({
        rule: 'Salary Alignment',
        requirement: 'Negotiable / Open',
        verifiedValue: expSal != null ? `₹${expSal.toLocaleString()}` : 'Open',
        status: 'MATCH',
        reason: 'Salary open / negotiable',
      });
    }

    // 4. Location Match Rule
    const validJobLocations: string[] = [];
    if (job.locations && Array.isArray(job.locations) && job.locations.length > 0) {
      job.locations.forEach((loc: any) => {
        const cityName = typeof loc === 'string' ? loc : loc.city;
        if (cityName) validJobLocations.push(cityName.trim());
      });
    }
    if (job.location) {
      job.location.split(',').forEach((l: string) => {
        const trimmed = l.trim();
        if (trimmed && !validJobLocations.includes(trimmed)) validJobLocations.push(trimmed);
      });
    }
    if (selectedApp.targetLocation && !validJobLocations.includes(selectedApp.targetLocation.trim())) {
      validJobLocations.push(selectedApp.targetLocation.trim());
    }

    const jobRequirementDisplay = validJobLocations.length > 0 ? validJobLocations.join(', ') : job.location || 'Open / Flexible';
    const candLoc = (verifForm.currentLocation || '').trim().toLowerCase();
    const applLoc = (verifForm.appliedLocation || '').trim().toLowerCase();

    if (validJobLocations.length > 0) {
      if (candLoc || applLoc) {
        const isMatched = validJobLocations.some((jLoc) => {
          const normJ = jLoc.toLowerCase();
          return candLoc.includes(normJ) || normJ.includes(candLoc) || applLoc.includes(normJ) || normJ.includes(applLoc);
        });

        if (isMatched) {
          rules.push({
            rule: 'Location Match',
            requirement: jobRequirementDisplay,
            verifiedValue: verifForm.appliedLocation || verifForm.currentLocation || 'Confirmed',
            status: 'MATCH',
            reason: `Candidate location matches opening (${jobRequirementDisplay})`,
          });
        } else {
          rules.push({
            rule: 'Location Match',
            requirement: jobRequirementDisplay,
            verifiedValue: verifForm.currentLocation || verifForm.appliedLocation || 'Different',
            status: 'REVIEW',
            reason: `Candidate in ${verifForm.currentLocation || 'Unknown'}, job in ${jobRequirementDisplay}. Verify relocation willingness.`,
          });
        }
      } else {
        rules.push({
          rule: 'Location Match',
          requirement: jobRequirementDisplay,
          verifiedValue: 'Not Verified',
          status: 'REVIEW',
          reason: 'Candidate location preference has not been confirmed on call',
        });
      }
    } else {
      rules.push({
        rule: 'Location Match',
        requirement: 'Open / Flexible',
        verifiedValue: verifForm.currentLocation || 'Open',
        status: 'MATCH',
        reason: 'Flexible location criteria',
      });
    }

    // 5. Two-Wheeler Requirement
    if (job.twoWheelerRequired) {
      if (verifForm.hasTwoWheeler === true) {
        rules.push({
          rule: 'Two-Wheeler Requirement',
          requirement: 'Mandatory',
          verifiedValue: 'Yes (Confirmed Owns Bike)',
          status: 'MATCH',
          reason: 'Candidate owns/has 2-wheeler as required',
        });
      } else if (verifForm.hasTwoWheeler === false) {
        rules.push({
          rule: 'Two-Wheeler Requirement',
          requirement: 'Mandatory',
          verifiedValue: 'No (Confirmed No Bike)',
          status: 'MISMATCH',
          reason: 'Mandatory 2-wheeler missing for field/delivery role',
        });
      } else {
        rules.push({
          rule: 'Two-Wheeler Requirement',
          requirement: 'Mandatory',
          verifiedValue: 'Not Verified',
          status: 'REVIEW',
          reason: 'Two-wheeler ownership has not been confirmed with candidate',
        });
      }
    } else {
      rules.push({
        rule: 'Two-Wheeler Requirement',
        requirement: 'Not required',
        verifiedValue: verifForm.hasTwoWheeler ? 'Has Bike (Bonus)' : 'Not required',
        status: 'MATCH',
        reason: 'Two-wheeler not mandatory',
      });
    }

    // 6. Driving License Requirement
    if (job.drivingLicenseRequired) {
      if (verifForm.hasDrivingLicense === true) {
        rules.push({
          rule: 'Driving License',
          requirement: 'Mandatory',
          verifiedValue: 'Yes (Valid DL Confirmed)',
          status: 'MATCH',
          reason: 'Candidate holds valid Driving License as required',
        });
      } else if (verifForm.hasDrivingLicense === false) {
        rules.push({
          rule: 'Driving License',
          requirement: 'Mandatory',
          verifiedValue: 'No (Confirmed No License)',
          status: 'MISMATCH',
          reason: 'Mandatory Driving License missing for this position',
        });
      } else {
        rules.push({
          rule: 'Driving License',
          requirement: 'Mandatory',
          verifiedValue: 'Not Verified',
          status: 'REVIEW',
          reason: 'Driving license validity has not been confirmed with candidate',
        });
      }
    } else {
      rules.push({
        rule: 'Driving License',
        requirement: 'Not required',
        verifiedValue: verifForm.hasDrivingLicense ? 'Has License (Bonus)' : 'Not required',
        status: 'MATCH',
        reason: 'Driving license not mandatory',
      });
    }

    // 7. Field Sales Interest
    const isFieldRole = (job.jobTitle || '').toLowerCase().includes('field') || (job.jobTitle || '').toLowerCase().includes('sales') || (job.jobDescription?.toLowerCase().includes('field visit') ?? false);
    if (isFieldRole) {
      if (verifForm.interestedInFieldSales === true) {
        rules.push({
          rule: 'Field Sales Willingness',
          requirement: 'Required for Field Position',
          verifiedValue: 'Yes (Confirmed Willing for Field)',
          status: 'MATCH',
          reason: 'Candidate confirmed interest in on-field client visits',
        });
      } else if (verifForm.interestedInFieldSales === false) {
        rules.push({
          rule: 'Field Sales Willingness',
          requirement: 'Required for Field Position',
          verifiedValue: 'No (Not Willing for Field)',
          status: 'MISMATCH',
          reason: 'Candidate not willing for required on-field travel',
        });
      } else {
        rules.push({
          rule: 'Field Sales Willingness',
          requirement: 'Required for Field Position',
          verifiedValue: 'Not Verified',
          status: 'REVIEW',
          reason: 'Field sales willingness has not been confirmed on call',
        });
      }
    } else {
      rules.push({
        rule: 'Field Sales Willingness',
        requirement: 'Office / Non-Field',
        verifiedValue: 'Standard Fit',
        status: 'MATCH',
        reason: 'Standard desk role',
      });
    }

    // 8. Automobile Domain Interest
    const isAutoRole = (job.jobTitle || '').toLowerCase().includes('auto') || (job.company?.companyName?.toLowerCase().includes('motors') ?? false) || (job.jobDescription?.toLowerCase().includes('automobile') ?? false);
    if (isAutoRole) {
      if (verifForm.interestedInAutomobile === true) {
        rules.push({
          rule: 'Automobile Sector Fit',
          requirement: 'Automobile Opening',
          verifiedValue: 'Yes (Confirmed Auto Interest)',
          status: 'MATCH',
          reason: 'Candidate confirmed interest in automotive sector',
        });
      } else if (verifForm.interestedInAutomobile === false) {
        rules.push({
          rule: 'Automobile Sector Fit',
          requirement: 'Automobile Opening',
          verifiedValue: 'No Prior Preference',
          status: 'REVIEW',
          reason: 'Candidate has no prior auto preference - assess interest',
        });
      } else {
        rules.push({
          rule: 'Automobile Sector Fit',
          requirement: 'Automobile Opening',
          verifiedValue: 'Not Verified',
          status: 'REVIEW',
          reason: 'Automobile sector interest not confirmed with candidate',
        });
      }
    } else {
      rules.push({
        rule: 'Industry Alignment',
        requirement: 'General Opening',
        verifiedValue: 'Standard Fit',
        status: 'MATCH',
        reason: 'General industry alignment',
      });
    }

    // Overall Status Computation
    const hasMismatch = rules.some((r) => r.status === 'MISMATCH');
    const hasReview = rules.some((r) => r.status === 'REVIEW');
    const overallStatus: 'MATCH' | 'MISMATCH' | 'REVIEW' = hasMismatch ? 'MISMATCH' : hasReview ? 'REVIEW' : 'MATCH';

    return { overallStatus, rules };
  }, [selectedApp, verifForm]);

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

  const handleSaveVerification = async (advanceQueue = false) => {
    if (!selectedApp) return;

    setSavingVerification(true);
    try {
      const res = await fetch(`/api/applications/${selectedApp.id}/verification`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: verifForm.email || undefined,
          age: verifForm.age ? Number(verifForm.age) : undefined,
          gender: verifForm.gender || undefined,
          currentLocation: verifForm.currentLocation || undefined,
          appliedLocation: verifForm.appliedLocation || undefined,
          education: verifForm.education || undefined,
          experienceYears: verifForm.experienceYears !== undefined ? Number(verifForm.experienceYears) : undefined,
          experienceMonths: verifForm.experienceMonths !== undefined ? Number(verifForm.experienceMonths) : undefined,
          currentCompany: verifForm.currentCompany || undefined,
          previousCompany: verifForm.previousCompany || undefined,
          currentSalary: verifForm.currentSalary ? Number(verifForm.currentSalary) : undefined,
          expectedSalary: verifForm.expectedSalary ? Number(verifForm.expectedSalary) : undefined,
          noticePeriod: verifForm.noticePeriod || undefined,
          hasTwoWheeler: verifForm.hasTwoWheeler,
          hasDrivingLicense: verifForm.hasDrivingLicense,
          interestedInFieldSales: verifForm.interestedInFieldSales,
          interestedInAutomobile: verifForm.interestedInAutomobile,
          skills: verifForm.skills || [],
          languages: verifForm.languages || [],
        }),
      });

      const d = await res.json();
      if (!res.ok) {
        showToast(d.error || 'Failed to save candidate verification', 'error');
        return;
      }

      showToast('Candidate verification saved successfully! (Stage preserved)');

      const currentId = selectedApp.id;
      await fetchInitialData();

      if (advanceQueue) {
        advanceToNext(currentId);
      }
    } catch (err) {
      showToast('Network error while saving verification', 'error');
    } finally {
      setSavingVerification(false);
    }
  };

  const handleLogOutcome = async (outcome: string) => {
    if (!selectedApp) return;

    if (outcome === 'CALLBACK') {
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
        return `Hello ${cName},\n\nThank you for speaking with Genius Consultancy regarding the *${jTitle}* opening at *${cNameComp}*.\n\nPlease complete your official candidate application form using the secure link below:\nhttps://geniusconsultancy.in/form/${selectedApp.applicationCode}\n\nKindly share your confirmation here once submitted.\n\nBest Regards,\nGenius Consultancy Operations`;
      case 'CV_REQUEST':
        return `Hello ${cName},\n\nWe have received your profile for *${jTitle}* at *${cNameComp}*. Please share your updated CV / Resume document directly on this WhatsApp chat for immediate screening review.\n\nThank you,\nGenius Consultancy Team`;
      case 'INTERVIEW_INVITE':
        return `Congratulations ${cName}!\n\nYour profile has been shortlisted for an in-person interview for the *${jTitle}* position at *${cNameComp}*.\n\n📅 Date & Time: Tomorrow 11:00 AM\n📍 Venue: Company Office\n\nPlease carry 2 copies of your updated resume and ID proof.\n\nBest of luck,\nGenius Consultancy`;
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
              Calling & Verification Workspace
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1 flex items-center gap-2">
            Executive Calling & Candidate Verification
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Call candidates externally, verify qualifications vs job criteria in real time, and log outcomes with zero stage conflation.
          </p>
        </div>

        {/* Right Header Controls */}
        <div className="flex items-center gap-3">
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
          <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm space-y-2.5">
            <div className="flex flex-wrap gap-1 border-b border-slate-100 pb-2 text-[11px]">
              <button
                onClick={() => setActiveTab('ALL')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                  activeTab === 'ALL' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                All ({applications.length})
              </button>
              <button
                onClick={() => setActiveTab('CALLBACKS_DUE')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                  activeTab === 'CALLBACKS_DUE' ? 'bg-amber-600 text-white' : 'text-amber-700 hover:bg-amber-50'
                }`}
              >
                Callbacks ({callbacks.length})
              </button>
              <button
                onClick={() => setActiveTab('FOLLOWUPS_DUE')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                  activeTab === 'FOLLOWUPS_DUE' ? 'bg-sky-600 text-white' : 'text-sky-700 hover:bg-sky-50'
                }`}
              >
                Follow-ups ({metrics.followupsDue})
              </button>
              <button
                onClick={() => setActiveTab('NEW_ASSIGNED')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                  activeTab === 'NEW_ASSIGNED' ? 'bg-purple-600 text-white' : 'text-purple-700 hover:bg-purple-50'
                }`}
              >
                New
              </button>
            </div>

            {/* Search and Dropdown Filters */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name, phone, code..."
                  className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <select
                  value={jobFilter}
                  onChange={(e) => setJobFilter(e.target.value)}
                  className="p-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 text-slate-700 outline-none truncate"
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
                  className="p-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 text-slate-700 outline-none truncate"
                >
                  <option value="ALL">All Companies</option>
                  {uniqueCompanies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Candidate List Pane */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-[650px] overflow-hidden">
            <div className="p-3 border-b border-slate-100 flex items-center justify-between text-xs font-bold text-slate-700 uppercase tracking-wider">
              <span>Candidate Calling Queue</span>
              <span className="font-mono text-teal-600 font-bold">{prioritizedQueue.length} leads</span>
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
        {/* RIGHT COLUMN: ACTIVE CANDIDATE WORKSPACE (7 Columns) */}
        {/* ========================================================================= */}
        <div className="lg:col-span-7 flex flex-col space-y-4">
          {selectedApp ? (
            <>
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
                  <div className="text-xs text-slate-300 flex flex-wrap items-center gap-2.5 mt-1">
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      <span>{selectedApp.company.companyName}</span>
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-teal-300 font-medium">
                      <MapPin className="w-3.5 h-3.5 text-teal-400" />
                      <span>Target Location: {selectedApp.targetLocation || selectedApp.job?.location || 'Any'}</span>
                    </span>
                    {selectedApp.candidate.currentLocation && (
                      <>
                        <span>•</span>
                        <span className="text-slate-400">
                          Residence: {selectedApp.candidate.currentLocation}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Honest Dialing Box */}
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

              {/* Next Action Indicator & Stage Progression Banner */}
              <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="font-bold text-slate-700">Stage:</span>
                  <span className="px-2 py-0.5 rounded font-bold bg-slate-100 text-slate-800 border border-slate-200">
                    {selectedApp.currentStage}
                  </span>
                  <span>•</span>
                  <span className="font-bold text-slate-700">Action:</span>
                  <span
                    className={`px-2.5 py-1 rounded-lg font-bold border ${
                      getNextActionPrompt(selectedApp).variant === 'success'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : getNextActionPrompt(selectedApp).variant === 'warning'
                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                        : getNextActionPrompt(selectedApp).variant === 'purple'
                        ? 'bg-purple-50 text-purple-800 border-purple-300'
                        : 'bg-teal-50 text-teal-800 border-teal-300'
                    }`}
                  >
                    {getNextActionPrompt(selectedApp).text}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {(selectedApp.currentStage === 'INTERESTED' || selectedApp.currentStage === 'CALLING') && (
                    <button
                      onClick={handleShortlistApplication}
                      disabled={shortlisting}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Shortlist Candidate</span>
                    </button>
                  )}

                  {selectedApp.currentStage === 'SCREENING_PENDING' && (
                    <a
                      href="/screening"
                      className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors"
                    >
                      <span>Screening Queue ➔</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="bg-white rounded-xl border border-slate-200 p-2 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs overflow-x-auto">
                  <button
                    onClick={() => setActiveRightTab('VERIFICATION')}
                    className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors ${
                      activeRightTab === 'VERIFICATION'
                        ? 'bg-teal-600 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Candidate Verification</span>
                  </button>

                  <button
                    onClick={() => setActiveRightTab('DOCUMENTS')}
                    className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors ${
                      activeRightTab === 'DOCUMENTS'
                        ? 'bg-teal-600 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Documents & Screening Gate</span>
                    {selectedApp.formStatus === 'RECEIVED' && (selectedApp.cvStatus === 'CV_RECEIVED' || selectedApp.cvStatus === 'VERIFIED') ? (
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    ) : selectedApp.formStatus === 'RECEIVED' || selectedApp.cvStatus === 'CV_RECEIVED' ? (
                      <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                    ) : null}
                  </button>

                  <button
                    onClick={() => setActiveRightTab('CALL_LOG')}
                    className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors ${
                      activeRightTab === 'CALL_LOG'
                        ? 'bg-teal-600 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    <span>Record Call</span>
                  </button>

                  <button
                    onClick={() => setActiveRightTab('HISTORY')}
                    className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors ${
                      activeRightTab === 'HISTORY'
                        ? 'bg-teal-600 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>Call History ({callLogs.length})</span>
                  </button>
                </div>

                <button
                  onClick={() => setShowWhatsAppModal(true)}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-sm transition-colors self-start md:self-auto"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </button>
              </div>

              {/* TAB 1: DOCUMENTS & SCREENING GATE */}
              {activeRightTab === 'DOCUMENTS' && (
                <div className="space-y-4">
                  {/* Screening Gate Overview Card */}
                  <div className={`rounded-xl border p-4 shadow-sm text-xs ${
                    selectedApp.formStatus === 'RECEIVED' && (selectedApp.cvStatus === 'CV_RECEIVED' || selectedApp.cvStatus === 'VERIFIED')
                      ? 'bg-emerald-50/70 border-emerald-200'
                      : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          Internal Screening Gate Status
                        </div>
                        <div className="text-sm font-bold text-slate-900 mt-0.5 flex items-center gap-2">
                          {selectedApp.formStatus === 'RECEIVED' && (selectedApp.cvStatus === 'CV_RECEIVED' || selectedApp.cvStatus === 'VERIFIED') ? (
                            <>
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              <span className="text-emerald-800">All Required Documents Received — Ready for Screening Queue</span>
                            </>
                          ) : (
                            <>
                              <Clock className="w-4 h-4 text-amber-600" />
                              <span className="text-slate-800">Documents Incomplete — Awaiting Collection</span>
                            </>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Candidate enters the Screening Center queue only when both Google Form and WhatsApp CV are verified.
                        </p>
                      </div>

                      {selectedApp.currentStage !== 'SHORTLISTED' && selectedApp.currentStage !== 'SCREENING_PENDING' && (
                        <button
                          onClick={handleShortlistApplication}
                          disabled={shortlisting}
                          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-xs flex items-center gap-1 shrink-0 shadow-sm transition-colors disabled:opacity-50"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Shortlist Candidate First</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 2-Column Document Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Google Form Card */}
                    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-teal-600" />
                          <h4 className="text-xs font-bold text-slate-900">Google Form Status</h4>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                            selectedApp.formStatus === 'RECEIVED'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : selectedApp.formStatus === 'SENT'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {selectedApp.formStatus === 'RECEIVED'
                            ? '🟢 Received'
                            : selectedApp.formStatus === 'SENT'
                            ? '🟡 Form Sent'
                            : '⚪ Not Sent'}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-500">
                        Tracks candidate registration and background confirmation form.
                      </p>

                      <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => handleDocumentAction('FORM_SENT')}
                          disabled={docSubmitting || selectedApp.formStatus === 'RECEIVED'}
                          className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                        >
                          Mark Form Sent
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDocumentAction('FORM_RECEIVED')}
                          disabled={docSubmitting || selectedApp.formStatus === 'RECEIVED'}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                            selectedApp.formStatus === 'RECEIVED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                          }`}
                        >
                          {selectedApp.formStatus === 'RECEIVED' ? '✓ Received' : 'Mark Form Received'}
                        </button>
                      </div>
                    </div>

                    {/* WhatsApp CV Card */}
                    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="w-4 h-4 text-emerald-600" />
                          <h4 className="text-xs font-bold text-slate-900">WhatsApp CV Status</h4>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                            selectedApp.cvStatus === 'CV_RECEIVED' || selectedApp.cvStatus === 'VERIFIED'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : selectedApp.cvStatus === 'CV_REQUESTED'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {selectedApp.cvStatus === 'CV_RECEIVED' || selectedApp.cvStatus === 'VERIFIED'
                            ? '🟢 Received'
                            : selectedApp.cvStatus === 'CV_REQUESTED'
                            ? '🟡 Requested'
                            : '⚪ Not Requested'}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-500">
                        CV is received manually via WhatsApp. (File is not uploaded to CRM).
                      </p>

                      <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => handleDocumentAction('CV_REQUESTED')}
                          disabled={docSubmitting || selectedApp.cvStatus === 'CV_RECEIVED' || selectedApp.cvStatus === 'VERIFIED'}
                          className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                        >
                          Request CV
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDocumentAction('CV_RECEIVED')}
                          disabled={docSubmitting || selectedApp.cvStatus === 'CV_RECEIVED' || selectedApp.cvStatus === 'VERIFIED'}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                            selectedApp.cvStatus === 'CV_RECEIVED' || selectedApp.cvStatus === 'VERIFIED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                          }`}
                        >
                          {selectedApp.cvStatus === 'CV_RECEIVED' || selectedApp.cvStatus === 'VERIFIED' ? '✓ Received' : 'Mark CV Received'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 1: CANDIDATE VERIFICATION & LIVE QUALIFICATION MATCHING */}
              {activeRightTab === 'VERIFICATION' && (
                <div className="space-y-4">
                  {/* Source Reference vs Candidate-Verified Notice */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                    <div className="flex items-start gap-2.5">
                      <ShieldAlert className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-slate-800">Authoritative Qualification Rule: </span>
                        <span className="text-slate-600">
                          Candidate-verified data confirmed during this call is authoritative for qualification against the Job Requirement. Source data (WorkIndia, Naukri, Excel) is reference only. Differences (e.g. 25 → 27) are never mismatches.
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={prefillFromSource}
                      className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg font-bold flex items-center gap-1.5 shrink-0 transition-colors shadow-sm"
                      title="Copy all source reference fields into the verified form to review and edit with candidate"
                    >
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                      <span>Pre-fill from Source</span>
                    </button>
                  </div>

                  {/* Top: Source Reference Quick Comparison Strip */}
                  <div className="bg-slate-900 text-white rounded-xl p-3.5 shadow-sm">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-950/60 border border-amber-800/60 px-2 py-0.5 rounded">
                          Source Reference (Master / Platform Import)
                        </span>
                        <span className="text-[11px] text-slate-400">Reference info from WorkIndia / Naukri / Excel</span>
                      </div>
                      <span className="text-[10px] text-slate-400">Read-Only Reference</span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-[11px]">
                      <div className="bg-slate-800/60 p-2 rounded-lg border border-slate-700/50">
                        <div className="text-slate-400 text-[10px] uppercase font-semibold">Source Age</div>
                        <div className="font-bold text-slate-200 mt-0.5">
                          {selectedApp.candidate.age != null ? `${selectedApp.candidate.age} Yrs` : 'Not provided'}
                        </div>
                      </div>

                      <div className="bg-slate-800/60 p-2 rounded-lg border border-slate-700/50">
                        <div className="text-slate-400 text-[10px] uppercase font-semibold">Source Exp</div>
                        <div className="font-bold text-slate-200 mt-0.5">
                          {selectedApp.candidate.experienceYears ?? 0}y {selectedApp.candidate.experienceMonths ?? 0}m
                        </div>
                      </div>

                      <div className="bg-slate-800/60 p-2 rounded-lg border border-slate-700/50">
                        <div className="text-slate-400 text-[10px] uppercase font-semibold">Source Expected CTC</div>
                        <div className="font-bold text-slate-200 mt-0.5">
                          {selectedApp.candidate.expectedSalary ? `₹${selectedApp.candidate.expectedSalary.toLocaleString()}` : 'Not provided'}
                        </div>
                      </div>

                      <div className="bg-slate-800/60 p-2 rounded-lg border border-slate-700/50">
                        <div className="text-slate-400 text-[10px] uppercase font-semibold">Source Education</div>
                        <div className="font-bold text-slate-200 mt-0.5 truncate" title={selectedApp.candidate.highestEducation || 'Not provided'}>
                          {selectedApp.candidate.highestEducation || 'Not provided'}
                        </div>
                      </div>

                      <div className="bg-slate-800/60 p-2 rounded-lg border border-slate-700/50">
                        <div className="text-slate-400 text-[10px] uppercase font-semibold">Source Location</div>
                        <div className="font-bold text-slate-200 mt-0.5 truncate" title={selectedApp.candidate.currentLocation || 'Not provided'}>
                          {selectedApp.candidate.currentLocation || 'Not provided'}
                        </div>
                      </div>

                      <div className="bg-slate-800/60 p-2 rounded-lg border border-slate-700/50">
                        <div className="text-slate-400 text-[10px] uppercase font-semibold">Source Assets</div>
                        <div className="font-bold text-slate-200 mt-0.5 text-[10px]">
                          {selectedApp.candidate.hasTwoWheeler ? 'Bike: Yes' : 'Bike: No'} • {selectedApp.candidate.hasDrivingLicense ? 'DL: Yes' : 'DL: No'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Live Qualification Status Card */}
                  {qualificationResults && (
                    <div className={`p-4 rounded-xl border shadow-sm ${
                      qualificationResults.overallStatus === 'MATCH'
                        ? 'bg-emerald-50/70 border-emerald-200'
                        : qualificationResults.overallStatus === 'MISMATCH'
                        ? 'bg-rose-50/70 border-rose-200'
                        : 'bg-amber-50/70 border-amber-200'
                    }`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                            Live Qualification Engine (Candidate-Verified vs Job Requirement)
                          </span>
                          <span className="text-[11px] text-slate-500">
                            Opening: {selectedApp.job.jobTitle}
                          </span>
                        </div>

                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                          qualificationResults.overallStatus === 'MATCH'
                            ? 'bg-emerald-600 text-white'
                            : qualificationResults.overallStatus === 'MISMATCH'
                            ? 'bg-rose-600 text-white'
                            : 'bg-amber-600 text-white'
                        }`}>
                          {qualificationResults.overallStatus === 'MATCH' && <CheckCircle2 className="w-3.5 h-3.5" />}
                          {qualificationResults.overallStatus === 'MISMATCH' && <XCircle className="w-3.5 h-3.5" />}
                          {qualificationResults.overallStatus === 'REVIEW' && <HelpCircle className="w-3.5 h-3.5" />}
                          <span>
                            {qualificationResults.overallStatus === 'MATCH' ? 'QUALIFIED MATCH' : qualificationResults.overallStatus === 'MISMATCH' ? 'QUALIFICATION MISMATCH' : 'UNDER REVIEW'}
                          </span>
                        </span>
                      </div>

                      {/* Rule Results Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                        {qualificationResults.rules.map((r, idx) => (
                          <div
                            key={idx}
                            className={`p-2.5 rounded-lg border flex items-start justify-between gap-2 ${
                              r.status === 'MATCH'
                                ? 'bg-white border-emerald-200 text-slate-800 shadow-2xs'
                                : r.status === 'MISMATCH'
                                ? 'bg-white border-rose-200 text-rose-900 shadow-2xs'
                                : 'bg-white border-amber-200 text-amber-900 shadow-2xs'
                            }`}
                          >
                            <div className="space-y-0.5">
                              <div className="font-bold text-[11px] text-slate-800">{r.rule}</div>
                              <div className="text-[10px] text-slate-500">
                                <span className="font-semibold text-slate-600">Req:</span> {r.requirement} • <span className="font-semibold text-slate-600">Verified:</span> {r.verifiedValue}
                              </div>
                              <div className="text-[11px] text-slate-600">{r.reason}</div>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                              r.status === 'MATCH'
                                ? 'bg-emerald-100 text-emerald-800'
                                : r.status === 'MISMATCH'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}>
                              {r.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Candidate Verification Editable Form */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                            Candidate-Verified Profile Data
                          </h3>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800">
                            Authoritative
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Confirm details directly with candidate during phone conversation. (Source master remains intact).
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleSaveVerification(false)}
                          disabled={savingVerification}
                          className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm disabled:opacity-50 transition-colors"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>{savingVerification ? 'Saving...' : 'Save Verification'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSaveVerification(true)}
                          disabled={savingVerification}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm disabled:opacity-50 transition-colors"
                        >
                          <span>Save & Next</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Verification Form Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Age (Years)
                        </label>
                        <input
                          type="number"
                          value={verifForm.age ?? ''}
                          onChange={(e) => setVerifForm({ ...verifForm, age: e.target.value ? parseInt(e.target.value) : null })}
                          placeholder="e.g. 24"
                          className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:border-teal-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Gender
                        </label>
                        <select
                          value={verifForm.gender || 'Male'}
                          onChange={(e) => setVerifForm({ ...verifForm, gender: e.target.value })}
                          className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:border-teal-500 bg-white"
                        >
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Verified Email
                        </label>
                        <input
                          type="email"
                          value={verifForm.email || ''}
                          onChange={(e) => setVerifForm({ ...verifForm, email: e.target.value })}
                          placeholder="candidate@email.com"
                          className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:border-teal-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Current Location / City
                        </label>
                        <input
                          type="text"
                          value={verifForm.currentLocation || ''}
                          onChange={(e) => setVerifForm({ ...verifForm, currentLocation: e.target.value })}
                          placeholder="e.g. Mumbai, Andheri"
                          className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:border-teal-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Applied / Preferred Location
                        </label>
                        <input
                          type="text"
                          value={verifForm.appliedLocation || ''}
                          onChange={(e) => setVerifForm({ ...verifForm, appliedLocation: e.target.value })}
                          placeholder="e.g. Pune / Mumbai"
                          className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:border-teal-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Highest Education
                        </label>
                        <input
                          type="text"
                          value={verifForm.education || ''}
                          onChange={(e) => setVerifForm({ ...verifForm, education: e.target.value })}
                          placeholder="e.g. Graduate, B.Com, 12th"
                          className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:border-teal-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Experience (Years & Months)
                        </label>
                        <div className="grid grid-cols-2 gap-1">
                          <input
                            type="number"
                            min="0"
                            value={verifForm.experienceYears ?? ''}
                            onChange={(e) => setVerifForm({ ...verifForm, experienceYears: e.target.value ? parseInt(e.target.value) : null })}
                            placeholder="Years"
                            className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:border-teal-500"
                          />
                          <input
                            type="number"
                            min="0"
                            max="11"
                            value={verifForm.experienceMonths ?? ''}
                            onChange={(e) => setVerifForm({ ...verifForm, experienceMonths: e.target.value ? parseInt(e.target.value) : null })}
                            placeholder="Months"
                            className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:border-teal-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Current Company
                        </label>
                        <input
                          type="text"
                          value={verifForm.currentCompany || ''}
                          onChange={(e) => setVerifForm({ ...verifForm, currentCompany: e.target.value })}
                          placeholder="e.g. ABC Pvt Ltd"
                          className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:border-teal-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Previous Company
                        </label>
                        <input
                          type="text"
                          value={verifForm.previousCompany || ''}
                          onChange={(e) => setVerifForm({ ...verifForm, previousCompany: e.target.value })}
                          placeholder="e.g. XYZ Logistics"
                          className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:border-teal-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Current In-Hand CTC (₹)
                        </label>
                        <input
                          type="number"
                          value={verifForm.currentSalary ?? ''}
                          onChange={(e) => setVerifForm({ ...verifForm, currentSalary: e.target.value ? parseFloat(e.target.value) : null })}
                          placeholder="e.g. 25000"
                          className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:border-teal-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Expected In-Hand CTC (₹)
                        </label>
                        <input
                          type="number"
                          value={verifForm.expectedSalary ?? ''}
                          onChange={(e) => setVerifForm({ ...verifForm, expectedSalary: e.target.value ? parseFloat(e.target.value) : null })}
                          placeholder="e.g. 30000"
                          className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:border-teal-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Notice Period
                        </label>
                        <select
                          value={verifForm.noticePeriod || 'Immediate'}
                          onChange={(e) => setVerifForm({ ...verifForm, noticePeriod: e.target.value })}
                          className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:border-teal-500 bg-white"
                        >
                          <option value="Immediate">Immediate / 0 Days</option>
                          <option value="7 Days">7 Days</option>
                          <option value="15 Days">15 Days</option>
                          <option value="30 Days">30 Days</option>
                          <option value="45+ Days">45+ Days</option>
                        </select>
                      </div>
                    </div>

                    {/* Checkbox Attributes */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer bg-slate-50 p-2 rounded-lg border border-slate-200">
                        <input
                          type="checkbox"
                          checked={verifForm.hasTwoWheeler === true}
                          onChange={(e) => setVerifForm({ ...verifForm, hasTwoWheeler: e.target.checked })}
                          className="rounded text-teal-600 focus:ring-teal-500"
                        />
                        <Bike className="w-3.5 h-3.5 text-slate-500" />
                        <span>Has 2-Wheeler</span>
                      </label>

                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer bg-slate-50 p-2 rounded-lg border border-slate-200">
                        <input
                          type="checkbox"
                          checked={verifForm.hasDrivingLicense === true}
                          onChange={(e) => setVerifForm({ ...verifForm, hasDrivingLicense: e.target.checked })}
                          className="rounded text-teal-600 focus:ring-teal-500"
                        />
                        <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                        <span>Has Driving License</span>
                      </label>

                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer bg-slate-50 p-2 rounded-lg border border-slate-200">
                        <input
                          type="checkbox"
                          checked={verifForm.interestedInFieldSales === true}
                          onChange={(e) => setVerifForm({ ...verifForm, interestedInFieldSales: e.target.checked })}
                          className="rounded text-teal-600 focus:ring-teal-500"
                        />
                        <Briefcase className="w-3.5 h-3.5 text-slate-500" />
                        <span>Willing for Field Sales</span>
                      </label>

                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer bg-slate-50 p-2 rounded-lg border border-slate-200">
                        <input
                          type="checkbox"
                          checked={verifForm.interestedInAutomobile === true}
                          onChange={(e) => setVerifForm({ ...verifForm, interestedInAutomobile: e.target.checked })}
                          className="rounded text-teal-600 focus:ring-teal-500"
                        />
                        <Car className="w-3.5 h-3.5 text-slate-500" />
                        <span>Automobile Sector Fit</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: RECORD CALL OUTCOME & NOTES */}
              {activeRightTab === 'CALL_LOG' && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1 flex items-center justify-between">
                      <span>Call Observations & Remarks</span>
                      <span className="text-[11px] text-slate-400 font-normal">Recorded with call log</span>
                    </label>
                    <textarea
                      rows={3}
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Type candidate response, salary discussion, notice period, location preference, or callback reason..."
                      className="w-full p-2.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Record Call Interaction Outcome
                      </label>
                      <span className="text-[10px] text-slate-400">
                        Creates CallLog & updates operational activity
                      </span>
                    </div>

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
              )}

              {/* TAB 3: CALL HISTORY */}
              {activeRightTab === 'HISTORY' && (
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

                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1 divide-y divide-slate-100">
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
              )}
            </>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-16 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-3">
              <PhoneCall className="w-8 h-8 text-slate-300" />
              <p>Select a candidate from the prioritized queue on the left to begin calling and verification.</p>
            </div>
          )}
        </div>
      </div>

      {/* CALLBACK SCHEDULING MODAL */}
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
                Callback Date *
              </label>
              <input
                type="date"
                required
                value={cbDate}
                onChange={(e) => setCbDate(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Callback Time *
              </label>
              <input
                type="time"
                required
                value={cbTime}
                onChange={(e) => setCbTime(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Priority
            </label>
            <select
              value={cbPriority}
              onChange={(e) => setCbPriority(e.target.value as any)}
              className="w-full p-2 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
            >
              <option value="HIGH">High Priority (Strong interest)</option>
              <option value="MEDIUM">Medium Priority (Standard callback)</option>
              <option value="LOW">Low Priority (Tentative)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Reason / Candidate Notes
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

      {/* WHATSAPP TEMPLATES MODAL */}
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
