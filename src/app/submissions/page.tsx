'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Badge, StageBadge } from '@/components/common/Badge';
import { Modal } from '@/components/common/Modal';
import {
  Send,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  Building2,
  Briefcase,
  User,
  MapPin,
  AlertCircle,
} from 'lucide-react';

export default function ClientSubmissionsPage() {
  const { hasPermission } = useAuth();
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [interviews, setInterviews] = useState<any[]>([]);
  const [finalShortlistApps, setFinalShortlistApps] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [tab, setTab] = useState<'SUBMISSIONS' | 'INTERVIEWS'>('SUBMISSIONS');
  const [loading, setLoading] = useState(true);

  // New Submission Modal
  const [showNewSubModal, setShowNewSubModal] = useState(false);
  const [subCompanyId, setSubCompanyId] = useState('');
  const [subJobId, setSubJobId] = useState('');
  const [selectedAppIds, setSelectedAppIds] = useState<string[]>([]);
  const [subMethod, setSubMethod] = useState<'EMAIL' | 'WHATSAPP_MANUAL' | 'PORTAL'>('WHATSAPP_MANUAL');
  const [subRemarks, setSubRemarks] = useState('');

  // Schedule Interview Modal
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [targetAppId, setTargetAppId] = useState('');
  const [roundName, setRoundName] = useState('Round 1 - Face to Face');
  const [roundNumber, setRoundNumber] = useState(1);
  const [scheduledAt, setScheduledAt] = useState('');
  const [interviewMode, setInterviewMode] = useState<'OFFLINE' | 'VIRTUAL'>('OFFLINE');
  const [interviewLocation, setInterviewLocation] = useState('');

  // Interview Outcome Modal
  const [selectedInterview, setSelectedInterview] = useState<any | null>(null);
  const [outcome, setOutcome] = useState<'PENDING' | 'SELECTED_FOR_NEXT_ROUND' | 'SELECTED' | 'REJECTED' | 'HOLD'>('SELECTED');
  const [feedback, setFeedback] = useState('');
  const [scheduleNextRound, setScheduleNextRound] = useState(false);
  const [nextRoundDate, setNextRoundDate] = useState('');
  const [nextRoundName, setNextRoundName] = useState('Round 2 - Branch Manager');

  // Joining Modal
  const [joiningApp, setJoiningApp] = useState<any | null>(null);
  const [joiningStatus, setJoiningStatus] = useState<'JOINING_PENDING' | 'JOINED' | 'NOT_JOINED'>('JOINED');
  const [joiningDate, setJoiningDate] = useState('');
  const [joiningReason, setJoiningReason] = useState('');

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resSub, resInv, resApps, resComp, resJobs] = await Promise.all([
        fetch('/api/submissions'),
        fetch('/api/interviews'),
        fetch('/api/applications?stage=FINAL_SHORTLIST,SENT_TO_CLIENT,INTERVIEW_SCHEDULED,SELECTED,JOINING_PENDING'),
        fetch('/api/companies'),
        fetch('/api/jobs'),
      ]);

      if (resSub.ok) setSubmissions((await resSub.json()).data || []);
      if (resInv.ok) setInterviews((await resInv.json()).data || []);
      if (resApps.ok) setFinalShortlistApps((await resApps.json()).data || []);
      if (resComp.ok) setCompanies((await resComp.json()).data || []);
      if (resJobs.ok) setJobs((await resJobs.json()).data || []);
    } catch (err) {
      console.error('Error loading submissions', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubmission = async () => {
    if (!subCompanyId || !subJobId || selectedAppIds.length === 0) return;
    setSubmitting(true);

    try {
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: subCompanyId,
          jobId: subJobId,
          applicationIds: selectedAppIds,
          submissionMethod: subMethod,
          remarks: subRemarks || 'Shortlist Batch Submission',
        }),
      });

      if (res.ok) {
        setShowNewSubModal(false);
        setSelectedAppIds([]);
        setSubRemarks('');
        await fetchData();
      }
    } catch (err) {
      console.error('Error creating submission', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleScheduleInterview = async () => {
    if (!targetAppId || !scheduledAt) return;
    setSubmitting(true);

    try {
      const res = await fetch('/api/interviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: targetAppId,
          roundName,
          roundNumber: Number(roundNumber),
          scheduledAt: new Date(scheduledAt).toISOString(),
          mode: interviewMode,
          location: interviewLocation || 'Client Regional Office',
        }),
      });

      if (res.ok) {
        setShowScheduleModal(false);
        setScheduledAt('');
        setInterviewLocation('');
        await fetchData();
      }
    } catch (err) {
      console.error('Error scheduling interview', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateOutcome = async () => {
    if (!selectedInterview || !feedback) return;
    setSubmitting(true);

    try {
      const res = await fetch(`/api/interviews/${selectedInterview.id}/outcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'COMPLETED',
          outcome,
          feedback,
          scheduleNextRound,
          nextRoundScheduledAt: scheduleNextRound && nextRoundDate ? new Date(nextRoundDate).toISOString() : undefined,
          nextRoundName: scheduleNextRound ? nextRoundName : undefined,
        }),
      });

      if (res.ok) {
        setSelectedInterview(null);
        setFeedback('');
        await fetchData();
      }
    } catch (err) {
      console.error('Error updating outcome', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateJoining = async () => {
    if (!joiningApp) return;
    setSubmitting(true);

    try {
      const res = await fetch(`/api/applications/${joiningApp.id}/joining`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: joiningStatus,
          joiningDate: joiningDate || null,
          reason: joiningReason || null,
        }),
      });

      if (res.ok) {
        setJoiningApp(null);
        setJoiningDate('');
        setJoiningReason('');
        await fetchData();
      }
    } catch (err) {
      console.error('Error updating joining', err);
    } finally {
      setSubmitting(false);
    }
  };

  const eligibleForSubmission = finalShortlistApps.filter((a) => a.currentStage === 'FINAL_SHORTLIST');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-teal-600 uppercase tracking-wider">
            CLIENT OPERATIONS
          </span>
          <h2 className="text-lg font-bold text-slate-900 mt-0.5">Client Submissions & Multi-Round Interviews</h2>
          <p className="text-xs text-slate-500">
            Batch candidate delivery to client HR, track multi-round interviews, selections, and joining dates.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-xl gap-1 text-xs font-semibold">
            <button
              onClick={() => setTab('SUBMISSIONS')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                tab === 'SUBMISSIONS' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              Submissions ({submissions.length})
            </button>
            <button
              onClick={() => setTab('INTERVIEWS')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                tab === 'INTERVIEWS' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              Interviews & Joining ({interviews.length})
            </button>
          </div>

          {hasPermission('submission.manage') && (
            <button
              onClick={() => setShowNewSubModal(true)}
              className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Send className="w-4 h-4" />
              <span>Create Client Submission</span>
            </button>
          )}
        </div>
      </div>

      {tab === 'SUBMISSIONS' ? (
        /* Client Submissions Table */
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Submission Code</th>
                  <th className="py-3 px-4">Client Company</th>
                  <th className="py-3 px-4">Job Requirement</th>
                  <th className="py-3 px-4">Method & Date</th>
                  <th className="py-3 px-4">Submitted Candidates</th>
                  <th className="py-3 px-4">Submitted By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {submissions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      No client submissions created yet.
                    </td>
                  </tr>
                ) : (
                  submissions.map((sub) => (
                    <tr key={sub.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-teal-700">{sub.submissionCode}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{sub.company?.companyName}</td>
                      <td className="py-3 px-4 font-medium text-slate-700">{sub.job?.jobTitle}</td>
                      <td className="py-3 px-4">
                        <Badge variant="purple">{sub.submissionMethod.replace(/_/g, ' ')}</Badge>
                        <div className="text-[10px] text-slate-400 mt-1">
                          {new Date(sub.submittedAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          {sub.items?.map((item: any) => (
                            <div key={item.id} className="flex items-center gap-1.5 text-slate-800">
                              <span className="font-semibold">{item.candidate?.fullName}</span>
                              <span className="text-slate-400 text-[10px]">({item.candidate?.normalizedPhone})</span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-600">{sub.submittedBy?.fullName}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Multi-Round Interviews & Outcomes Table */
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Multi-Round Client Interview Schedule</h3>
              <p className="text-xs text-slate-500">Track round progression, feedback, and final client selection outcomes.</p>
            </div>
            {hasPermission('interview.manage') && (
              <button
                onClick={() => setShowScheduleModal(true)}
                className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Schedule Interview Round</span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Candidate & Job</th>
                  <th className="py-3 px-4">Round & Mode</th>
                  <th className="py-3 px-4">Scheduled Date & Venue</th>
                  <th className="py-3 px-4">Outcome</th>
                  <th className="py-3 px-4">Feedback / Notes</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {interviews.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      No interviews scheduled yet.
                    </td>
                  </tr>
                ) : (
                  interviews.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{inv.application?.candidate?.fullName}</div>
                        <div className="text-[11px] text-slate-500">{inv.application?.job?.jobTitle}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-900 block">{inv.roundName}</span>
                        <Badge variant="info">{inv.mode}</Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">
                          {new Date(inv.scheduledAt).toLocaleDateString()} at{' '}
                          {new Date(inv.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="text-[10px] text-slate-400">{inv.location || 'Client Office'}</div>
                      </td>
                      <td className="py-3 px-4">
                        {inv.outcome === 'SELECTED' ? (
                          <Badge variant="success">SELECTED</Badge>
                        ) : inv.outcome === 'SELECTED_FOR_NEXT_ROUND' ? (
                          <Badge variant="purple">NEXT ROUND APPROVED</Badge>
                        ) : inv.outcome === 'REJECTED' ? (
                          <Badge variant="danger">REJECTED</Badge>
                        ) : inv.outcome === 'HOLD' ? (
                          <Badge variant="warning">HOLD</Badge>
                        ) : (
                          <Badge variant="neutral">PENDING</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 max-w-xs text-slate-700">{inv.feedback || 'Awaiting client feedback'}</td>
                      <td className="py-3 px-4 text-right space-x-1.5">
                        {hasPermission('interview.manage') && (
                          <button
                            onClick={() => setSelectedInterview(inv)}
                            className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 font-semibold rounded-lg text-xs border border-teal-200 transition-colors"
                          >
                            Update Outcome
                          </button>
                        )}
                        {inv.outcome === 'SELECTED' && hasPermission('joining.manage') && (
                          <button
                            onClick={() => setJoiningApp(inv.application)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs shadow-sm transition-colors"
                          >
                            Joining
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Client Submission Modal */}
      <Modal
        isOpen={showNewSubModal}
        onClose={() => setShowNewSubModal(false)}
        title="Create Client Candidate Submission"
        subtitle="Batch dispatch shortlisted candidates to client HR"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Target Client Company</label>
            <select
              value={subCompanyId}
              onChange={(e) => setSubCompanyId(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-lg text-xs"
            >
              <option value="">Select Company...</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.companyName} ({c.city || 'HQ'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Job Opening</label>
            <select
              value={subJobId}
              onChange={(e) => setSubJobId(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-lg text-xs"
            >
              <option value="">Select Job Opening...</option>
              {jobs
                .filter((j) => !subCompanyId || j.companyId === subCompanyId)
                .map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.jobTitle} ({j.vacancies} vacancies)
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Final Shortlisted Candidates ({eligibleForSubmission.length} available)
            </label>
            <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 p-2 text-xs">
              {eligibleForSubmission.length === 0 ? (
                <div className="text-slate-400 p-2">No candidates in FINAL_SHORTLIST stage.</div>
              ) : (
                eligibleForSubmission.map((app) => (
                  <label key={app.id} className="flex items-center gap-2 p-1.5 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedAppIds.includes(app.id)}
                      onChange={(e) =>
                        setSelectedAppIds((prev) =>
                          e.target.checked ? [...prev, app.id] : prev.filter((i) => i !== app.id)
                        )
                      }
                    />
                    <span className="font-bold text-slate-900">{app.candidate?.fullName}</span>
                    <span className="text-slate-400">({app.job?.jobTitle})</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Delivery Method</label>
            <select
              value={subMethod}
              onChange={(e) => setSubMethod(e.target.value as any)}
              className="w-full p-2 border border-slate-200 rounded-lg text-xs"
            >
              <option value="WHATSAPP_MANUAL">WhatsApp (Manual Dispatch)</option>
              <option value="EMAIL">Official Client Email</option>
              <option value="PORTAL">Client HR Portal</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setShowNewSubModal(false)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateSubmission}
              disabled={!subCompanyId || !subJobId || selectedAppIds.length === 0 || submitting}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
            >
              Confirm Client Submission
            </button>
          </div>
        </div>
      </Modal>

      {/* Schedule Interview Modal */}
      <Modal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        title="Schedule Client Interview Round"
        subtitle="Set round number, date, venue, and interview mode"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Candidate Application</label>
            <select
              value={targetAppId}
              onChange={(e) => setTargetAppId(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-lg text-xs"
            >
              <option value="">Select Candidate Application...</option>
              {finalShortlistApps.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.candidate?.fullName} — {app.job?.jobTitle} ({app.currentStage})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Round Name</label>
              <input
                type="text"
                value={roundName}
                onChange={(e) => setRoundName(e.target.value)}
                placeholder="e.g. Technical Round / Branch Mgr"
                className="w-full p-2 border border-slate-200 rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Round Number</label>
              <input
                type="number"
                min="1"
                value={roundNumber}
                onChange={(e) => setRoundNumber(Number(e.target.value))}
                className="w-full p-2 border border-slate-200 rounded-lg text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Date & Time</label>
              <input
                type="datetime-local"
                required
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Interview Mode</label>
              <select
                value={interviewMode}
                onChange={(e) => setInterviewMode(e.target.value as any)}
                className="w-full p-2 border border-slate-200 rounded-lg text-xs"
              >
                <option value="OFFLINE">In-Person (Client Office)</option>
                <option value="VIRTUAL">Virtual / Google Meet / Zoom</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Interview Venue / Meeting Link</label>
            <input
              type="text"
              value={interviewLocation}
              onChange={(e) => setInterviewLocation(e.target.value)}
              placeholder="e.g. TVS Showroom, Gondal Road, Rajkot"
              className="w-full p-2 border border-slate-200 rounded-lg text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setShowScheduleModal(false)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleScheduleInterview}
              disabled={!targetAppId || !scheduledAt || submitting}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
            >
              Schedule Interview
            </button>
          </div>
        </div>
      </Modal>

      {/* Update Interview Outcome Modal */}
      <Modal
        isOpen={!!selectedInterview}
        onClose={() => setSelectedInterview(null)}
        title="Update Interview Outcome & Feedback"
        subtitle={`Outcome for ${selectedInterview?.application?.candidate?.fullName} (${selectedInterview?.roundName})`}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Client Decision Outcome</label>
            <select
              value={outcome}
              onChange={(e) => setOutcome(e.target.value as any)}
              className="w-full p-2 border border-slate-200 rounded-lg text-xs font-bold"
            >
              <option value="SELECTED_FOR_NEXT_ROUND">Selected for Next Round</option>
              <option value="SELECTED">Final Client Selection (Offer Approved)</option>
              <option value="REJECTED">Client Disqualified / Rejected</option>
              <option value="HOLD">Client Decision On Hold</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Client HR Feedback Remarks</label>
            <textarea
              rows={3}
              required
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="e.g. Strong candidate, approved by Branch Manager. Released offer."
              className="w-full p-2.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50"
            />
          </div>

          {outcome === 'SELECTED_FOR_NEXT_ROUND' && (
            <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 space-y-3">
              <label className="flex items-center gap-2 text-xs font-bold text-purple-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={scheduleNextRound}
                  onChange={(e) => setScheduleNextRound(e.target.checked)}
                />
                <span>Auto-Schedule Next Interview Round</span>
              </label>

              {scheduleNextRound && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">Next Round Name</label>
                    <input
                      type="text"
                      value={nextRoundName}
                      onChange={(e) => setNextRoundName(e.target.value)}
                      className="w-full p-1.5 border border-slate-200 rounded text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">Scheduled Date & Time</label>
                    <input
                      type="datetime-local"
                      value={nextRoundDate}
                      onChange={(e) => setNextRoundDate(e.target.value)}
                      className="w-full p-1.5 border border-slate-200 rounded text-xs"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setSelectedInterview(null)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleUpdateOutcome}
              disabled={!feedback || submitting}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
            >
              Confirm Outcome
            </button>
          </div>
        </div>
      </Modal>

      {/* Joining Status Modal */}
      <Modal
        isOpen={!!joiningApp}
        onClose={() => setJoiningApp(null)}
        title="Candidate Placement & Joining Confirmation"
        subtitle={`Candidate: ${joiningApp?.candidate?.fullName} | Job: ${joiningApp?.job?.jobTitle}`}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Joining Outcome</label>
            <select
              value={joiningStatus}
              onChange={(e) => setJoiningStatus(e.target.value as any)}
              className="w-full p-2 border border-slate-200 rounded-lg text-xs font-bold"
            >
              <option value="JOINED">Candidate Joined (Placement Closed ✅)</option>
              <option value="JOINING_PENDING">Joining Pending (Notice Period)</option>
              <option value="NOT_JOINED">Candidate Did Not Join / Backed Out ❌</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Actual / Expected Joining Date</label>
            <input
              type="date"
              value={joiningDate}
              onChange={(e) => setJoiningDate(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-lg text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / Remarks</label>
            <input
              type="text"
              value={joiningReason}
              onChange={(e) => setJoiningReason(e.target.value)}
              placeholder="e.g. Reported to Rajkot branch, documentation verified"
              className="w-full p-2 border border-slate-200 rounded-lg text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setJoiningApp(null)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleUpdateJoining}
              disabled={submitting}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
            >
              Save Joining Status
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
