'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { StageBadge } from '@/components/common/Badge';
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
  User,
  Building2,
  ChevronRight,
  Send,
  AlertCircle,
} from 'lucide-react';

export default function CallingStationPage() {
  const { user } = useAuth();
  const [applications, setApplications] = useState<any[]>([]);
  const [selectedApp, setSelectedApp] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);

  // Modals
  const [showCallbackModal, setShowCallbackModal] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsAppType, setWhatsAppType] = useState<'FORM' | 'CV_REQUEST' | 'INTERVIEW_INVITE'>('FORM');

  // Callback Form
  const [cbDate, setCbDate] = useState('');
  const [cbTime, setCbTime] = useState('14:00');
  const [cbReason, setCbReason] = useState('');
  const [cbPriority, setCbPriority] = useState<'HIGH' | 'MEDIUM' | 'LOW'>('MEDIUM');

  // Shortlist / Call Log
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCallingQueue();
  }, []);

  const fetchCallingQueue = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/applications?limit=100');
      if (res.ok) {
        const d = await res.json();
        setApplications(d.data || []);
        if (d.data?.length > 0 && !selectedApp) {
          setSelectedApp(d.data[0]);
        }
      }
    } catch (err) {
      console.error('Error loading queue', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, isPhone = true) => {
    navigator.clipboard.writeText(text);
    if (isPhone) {
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
    } else {
      setCopiedMsg(true);
      setTimeout(() => setCopiedMsg(false), 2000);
    }
  };

  const handleLogOutcome = async (outcome: string) => {
    if (!selectedApp) return;

    if (outcome === 'CALLBACK') {
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
          remarks: remarks || `Outcome marked as ${outcome}`,
        }),
      });

      if (res.ok) {
        setRemarks('');
        await fetchCallingQueue();
      }
    } catch (err) {
      console.error('Error logging outcome', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleScheduleCallback = async () => {
    if (!selectedApp || !cbDate) return;
    setSubmitting(true);

    try {
      const scheduledDateTime = new Date(`${cbDate}T${cbTime}:00`).toISOString();
      const res = await fetch('/api/calling/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: selectedApp.id,
          candidateId: selectedApp.candidateId,
          callOutcome: 'CALLBACK',
          callbackRequired: true,
          callbackDateTime: scheduledDateTime,
          callbackReason: cbReason || 'Candidate follow-up requested',
          callbackPriority: cbPriority,
          remarks: `Callback scheduled for ${cbDate} ${cbTime}`,
        }),
      });

      if (res.ok) {
        setShowCallbackModal(false);
        setCbDate('');
        setCbReason('');
        await fetchCallingQueue();
      }
    } catch (err) {
      console.error('Error scheduling callback', err);
    } finally {
      setSubmitting(false);
    }
  };

  const candidate = selectedApp?.candidate;
  const job = selectedApp?.job;

  const getWhatsAppMessageText = () => {
    if (!candidate || !job) return '';
    if (whatsAppType === 'FORM') {
      return `Hello ${candidate.fullName},\n\nThank you for speaking with Genius Consultancy regarding the *${job.jobTitle}* opening at *${selectedApp.company.companyName}*.\n\nPlease complete your candidate application form using the link below:\nhttps://forms.gle/sample-form\n\nKindly share your CV on this WhatsApp number once completed.\n\nBest Regards,\nGenius Consultancy`;
    }
    if (whatsAppType === 'CV_REQUEST') {
      return `Hello ${candidate.fullName},\n\nWe have received your details for *${job.jobTitle}*. Please share a clear PDF/image of your CV/Resume here on WhatsApp for internal screening.\n\nThank you,\nGenius Consultancy`;
    }
    return `Hello ${candidate.fullName},\n\nYour profile has been shortlisted for an interview for *${job.jobTitle}* at *${selectedApp.company.companyName}*. Please carry your resume, Aadhar Card, and Driving License.\n\nRegards,\nGenius Consultancy`;
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-teal-600 uppercase tracking-wider">
            CALLING STATION (HEYO EXTERNAL DIALER)
          </span>
          <h2 className="text-lg font-bold text-slate-900 mt-0.5">Executive Outreach Workspace</h2>
          <p className="text-xs text-slate-500">
            Dial candidate on HEYO, then click outcome buttons to update CRM state instantly.
          </p>
        </div>

        {/* Counter Pills */}
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-center">
            <span className="text-[10px] text-slate-500 block uppercase font-semibold">Queue Total</span>
            <span className="text-sm font-bold text-slate-900">{applications.length}</span>
          </div>
          <div className="px-3 py-1.5 bg-teal-50 border border-teal-200 rounded-lg text-center">
            <span className="text-[10px] text-teal-600 block uppercase font-semibold">Shortlisted</span>
            <span className="text-sm font-bold text-teal-700">
              {applications.filter((a) => a.currentStage === 'SHORTLISTED').length}
            </span>
          </div>
        </div>
      </div>

      {/* Main Calling Layout: Queue on Left, Active Candidate on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Queue List (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-[720px] overflow-hidden">
          <div className="p-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">Assigned Leads Queue</span>
            <span className="text-[11px] text-slate-400 font-medium">{applications.length} leads</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {applications.map((app) => (
              <button
                key={app.id}
                onClick={() => setSelectedApp(app)}
                className={`w-full p-3.5 text-left transition-all flex items-start justify-between ${
                  selectedApp?.id === app.id ? 'bg-teal-50/80 border-l-4 border-teal-600' : 'hover:bg-slate-50'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">{app.candidate?.fullName}</span>
                    <StageBadge stage={app.currentStage} />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-slate-400" />
                    <span>{app.job?.jobTitle}</span>
                  </p>
                  <p className="text-[11px] font-mono text-slate-600 mt-0.5">{app.candidate?.normalizedPhone}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 mt-1 shrink-0" />
              </button>
            ))}
          </div>
        </div>

        {/* Right Active Lead Action Panel (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {selectedApp && candidate ? (
            <>
              {/* Candidate Info Card */}
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                <div className="flex items-start justify-between pb-4 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-bold text-slate-900">{candidate.fullName}</h3>
                      <StageBadge stage={selectedApp.currentStage} />
                      <span className="text-xs font-mono text-slate-400">{candidate.candidateCode}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Applied for <strong className="text-slate-800">{job?.jobTitle}</strong> at{' '}
                      <strong className="text-slate-800">{selectedApp.company?.companyName}</strong>
                    </p>
                  </div>

                  {/* Phone & HEYO Dial Helper */}
                  <div className="flex items-center gap-2">
                    <div className="px-3 py-2 bg-slate-900 text-white rounded-xl font-mono text-sm font-bold flex items-center gap-2">
                      <PhoneCall className="w-4 h-4 text-teal-400" />
                      <span>{candidate.normalizedPhone}</span>
                    </div>
                    <button
                      onClick={() => handleCopy(candidate.normalizedPhone, true)}
                      className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors"
                      title="Copy Phone Number for HEYO dialer"
                    >
                      {copiedPhone ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => setShowWhatsAppModal(true)}
                      className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 shadow-sm"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>Copy WhatsApp Msg</span>
                    </button>
                  </div>
                </div>

                {/* Candidate Attributes Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4 border-b border-slate-100 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Location</span>
                    <span className="font-semibold text-slate-800">{candidate.currentLocation || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Experience</span>
                    <span className="font-semibold text-slate-800">{candidate.experienceYears} Years</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Education</span>
                    <span className="font-semibold text-slate-800">{candidate.education || 'Graduate'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Current Role</span>
                    <span className="font-semibold text-slate-800">{candidate.currentJob || 'Fresher'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">2-Wheeler Readiness</span>
                    <span className="font-semibold text-emerald-700 flex items-center gap-1">
                      <Bike className="w-3.5 h-3.5" />
                      {candidate.hasTwoWheeler ? 'Has Bike' : 'No Bike'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Driving License</span>
                    <span className="font-semibold text-emerald-700 flex items-center gap-1">
                      <CreditCard className="w-3.5 h-3.5" />
                      {candidate.hasDrivingLicense ? 'Has License' : 'No License'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Expected Salary</span>
                    <span className="font-semibold text-slate-800">
                      {candidate.expectedSalary ? `₹${candidate.expectedSalary}` : 'As per industry'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Form / CV Status</span>
                    <span className="font-semibold text-purple-700">
                      Form: {selectedApp.formStatus} | CV: {selectedApp.cvStatus}
                    </span>
                  </div>
                </div>

                {/* Remarks Input */}
                <div className="pt-4">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Call Notes / Candidate Remarks
                  </label>
                  <textarea
                    rows={2}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Enter discussion notes, salary expectations, language skills..."
                    className="w-full p-2.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50"
                  />
                </div>
              </div>

              {/* Fast Action Buttons Grid */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <p className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
                  Log External Call Outcome
                </p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <button
                    disabled={submitting}
                    onClick={() => handleLogOutcome('CONNECTED')}
                    className="p-3 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-xl font-bold text-xs transition-colors flex flex-col items-center justify-center gap-1"
                  >
                    <span>CONNECTED</span>
                    <span className="text-[10px] text-teal-600 font-normal">Call Picked Up</span>
                  </button>

                  <button
                    disabled={submitting}
                    onClick={() => handleLogOutcome('SHORTLISTED')}
                    className="p-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs transition-colors flex flex-col items-center justify-center gap-1 shadow-sm"
                  >
                    <span>SHORTLIST</span>
                    <span className="text-[10px] text-purple-200 font-normal">Send Form & CV</span>
                  </button>

                  <button
                    disabled={submitting}
                    onClick={() => handleLogOutcome('CALLBACK')}
                    className="p-3 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl font-bold text-xs transition-colors flex flex-col items-center justify-center gap-1"
                  >
                    <span>CALLBACK</span>
                    <span className="text-[10px] text-amber-600 font-normal">Schedule Follow-up</span>
                  </button>

                  <button
                    disabled={submitting}
                    onClick={() => handleLogOutcome('INTERESTED')}
                    className="p-3 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 rounded-xl font-bold text-xs transition-colors flex flex-col items-center justify-center gap-1"
                  >
                    <span>INTERESTED</span>
                    <span className="text-[10px] text-sky-600 font-normal">Positive Response</span>
                  </button>

                  <button
                    disabled={submitting}
                    onClick={() => handleLogOutcome('RNR')}
                    className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors flex flex-col items-center justify-center gap-1"
                  >
                    <span>RNR</span>
                    <span className="text-[10px] text-slate-500 font-normal">Ringing No Response</span>
                  </button>

                  <button
                    disabled={submitting}
                    onClick={() => handleLogOutcome('NOT_INTERESTED')}
                    className="p-3 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-xl font-bold text-xs transition-colors flex flex-col items-center justify-center gap-1"
                  >
                    <span>NOT INTERESTED</span>
                    <span className="text-[10px] text-rose-600 font-normal">Declined Opening</span>
                  </button>

                  <button
                    disabled={submitting}
                    onClick={() => handleLogOutcome('NOT_ELIGIBLE')}
                    className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors flex flex-col items-center justify-center gap-1"
                  >
                    <span>NOT ELIGIBLE</span>
                    <span className="text-[10px] text-slate-500 font-normal">No Bike / DL / Criteria</span>
                  </button>

                  <button
                    disabled={submitting}
                    onClick={() => handleLogOutcome('WRONG_NUMBER')}
                    className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors flex flex-col items-center justify-center gap-1"
                  >
                    <span>WRONG NUMBER</span>
                    <span className="text-[10px] text-slate-500 font-normal">Invalid / Switched Off</span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
              No lead selected
            </div>
          )}
        </div>
      </div>

      {/* Callback Scheduler Modal */}
      <Modal
        isOpen={showCallbackModal}
        onClose={() => setShowCallbackModal(false)}
        title="Schedule Follow-up Callback"
        subtitle={`Schedule callback for ${candidate?.fullName} (${candidate?.normalizedPhone})`}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Callback Date</label>
              <input
                type="date"
                required
                value={cbDate}
                onChange={(e) => setCbDate(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Callback Time</label>
              <input
                type="time"
                value={cbTime}
                onChange={(e) => setCbTime(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Priority</label>
            <select
              value={cbPriority}
              onChange={(e) => setCbPriority(e.target.value as any)}
              className="w-full p-2 border border-slate-200 rounded-lg text-xs"
            >
              <option value="HIGH">High Priority</option>
              <option value="MEDIUM">Medium Priority</option>
              <option value="LOW">Low Priority</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Callback Reason / Notes</label>
            <input
              type="text"
              value={cbReason}
              onChange={(e) => setCbReason(e.target.value)}
              placeholder="e.g. Call back after 2 PM to confirm field sales interest"
              className="w-full p-2 border border-slate-200 rounded-lg text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setShowCallbackModal(false)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleScheduleCallback}
              disabled={!cbDate || submitting}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
            >
              Confirm Callback
            </button>
          </div>
        </div>
      </Modal>

      {/* WhatsApp Message Generator Modal */}
      <Modal
        isOpen={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
        title="WhatsApp Message Template"
        subtitle="Copy formatted text to manually paste into WhatsApp"
      >
        <div className="space-y-4">
          <div className="flex gap-2">
            <button
              onClick={() => setWhatsAppType('FORM')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                whatsAppType === 'FORM' ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              Candidate Form Link
            </button>
            <button
              onClick={() => setWhatsAppType('CV_REQUEST')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                whatsAppType === 'CV_REQUEST' ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              CV / Resume Request
            </button>
            <button
              onClick={() => setWhatsAppType('INTERVIEW_INVITE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                whatsAppType === 'INTERVIEW_INVITE' ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              Interview Invite
            </button>
          </div>

          <div className="p-4 bg-slate-900 text-emerald-300 font-mono text-xs rounded-xl whitespace-pre-wrap leading-relaxed">
            {getWhatsAppMessageText()}
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => handleCopy(getWhatsAppMessageText(), false)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm"
            >
              {copiedMsg ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedMsg ? 'Copied to Clipboard!' : 'Copy WhatsApp Message'}</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
