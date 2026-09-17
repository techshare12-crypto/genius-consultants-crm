'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Badge, StageBadge } from '@/components/common/Badge';
import { Modal } from '@/components/common/Modal';
import {
  FileCheck2,
  CheckCircle,
  XCircle,
  Clock,
  Send,
  UserCheck,
  Building2,
  Bike,
  CreditCard,
  AlertCircle,
  Plus,
} from 'lucide-react';

export default function ScreeningPage() {
  const { hasPermission } = useAuth();
  const [applications, setApplications] = useState<any[]>([]);
  const [tab, setTab] = useState<'QUEUE' | 'SCREENING_PASSED' | 'SCREENING_HOLD' | 'FINAL_SHORTLIST'>('QUEUE');
  const [selectedAppIds, setSelectedAppIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Evaluate Modal
  const [evalApp, setEvalApp] = useState<any | null>(null);
  const [evalStatus, setEvalStatus] = useState<'PASS' | 'FAIL' | 'HOLD'>('PASS');
  const [evalRemarks, setEvalRemarks] = useState('');
  const [holdDate, setHoldDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Finalize Shortlist Modal
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [finalizeRemarks, setFinalizeRemarks] = useState('');

  useEffect(() => {
    fetchScreeningData();
  }, [tab]);

  const fetchScreeningData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/screenings?stage=${tab}`);
      if (res.ok) {
        const d = await res.json();
        setApplications(d.data || []);
      }
    } catch (err) {
      console.error('Error loading screening data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateDocStatus = async (appId: string, formStatus: string, cvStatus: string) => {
    try {
      await fetch('/api/screenings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'DOCUMENT_UPDATE',
          applicationId: appId,
          formStatus,
          cvStatus,
        }),
      });
      await fetchScreeningData();
    } catch (err) {
      console.error('Error updating document status', err);
    }
  };

  const handleEvaluateScreening = async () => {
    if (!evalApp || !evalRemarks) return;
    setSubmitting(true);

    try {
      const res = await fetch('/api/screenings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: evalApp.id,
          screeningStatus: evalStatus,
          remarks: evalRemarks,
          holdFollowupDate: evalStatus === 'HOLD' && holdDate ? holdDate : null,
        }),
      });

      if (res.ok) {
        setEvalApp(null);
        setEvalRemarks('');
        setHoldDate('');
        await fetchScreeningData();
      }
    } catch (err) {
      console.error('Error submitting screening evaluation', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddToFinalShortlist = async () => {
    if (selectedAppIds.length === 0) return;
    setSubmitting(true);

    try {
      const firstApp = applications.find((a) => a.id === selectedAppIds[0]);
      const res = await fetch('/api/shortlists/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationIds: selectedAppIds,
          jobId: firstApp?.jobId,
          remarks: finalizeRemarks || 'Final Shortlist Batch',
        }),
      });

      if (res.ok) {
        setShowFinalizeModal(false);
        setSelectedAppIds([]);
        setFinalizeRemarks('');
        await fetchScreeningData();
      }
    } catch (err) {
      console.error('Error finalizing shortlist', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-teal-600 uppercase tracking-wider">
            INTERNAL SCREENING HUB
          </span>
          <h2 className="text-lg font-bold text-slate-900 mt-0.5">Screening Center & Final Shortlist</h2>
          <p className="text-xs text-slate-500">
            Verify candidate Google Forms & WhatsApp CVs, submit PASS/FAIL/HOLD, and create Final Shortlists.
          </p>
        </div>

        {/* Tab Selector & Finalize Action */}
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-xl gap-1 text-xs font-semibold">
            <button
              onClick={() => setTab('QUEUE')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                tab === 'QUEUE' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              Screening Queue
            </button>
            <button
              onClick={() => setTab('SCREENING_PASSED')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                tab === 'SCREENING_PASSED' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600'
              }`}
            >
              Passed (Eligible)
            </button>
            <button
              onClick={() => setTab('SCREENING_HOLD')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                tab === 'SCREENING_HOLD' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-600'
              }`}
            >
              Hold
            </button>
            <button
              onClick={() => setTab('FINAL_SHORTLIST')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                tab === 'FINAL_SHORTLIST' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-600'
              }`}
            >
              Final Shortlist
            </button>
          </div>

          {tab === 'SCREENING_PASSED' && hasPermission('shortlist.finalize') && (
            <button
              disabled={selectedAppIds.length === 0}
              onClick={() => setShowFinalizeModal(true)}
              className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50"
            >
              <UserCheck className="w-4 h-4" />
              <span>Add to Final Shortlist ({selectedAppIds.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Candidates List / Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                {tab === 'SCREENING_PASSED' && (
                  <th className="py-3 px-4 w-10">
                    <input
                      type="checkbox"
                      onChange={(e) =>
                        setSelectedAppIds(e.target.checked ? applications.map((a) => a.id) : [])
                      }
                      checked={selectedAppIds.length === applications.length && applications.length > 0}
                    />
                  </th>
                )}
                <th className="py-3 px-4">Candidate & Contact</th>
                <th className="py-3 px-4">Target Job Requirement</th>
                <th className="py-3 px-4">Form & CV Checklist</th>
                <th className="py-3 px-4">Assets & Criteria</th>
                <th className="py-3 px-4">Current Stage</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {applications.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No candidates in this screening queue.
                  </td>
                </tr>
              ) : (
                applications.map((app) => (
                  <tr key={app.id} className="hover:bg-slate-50/80 transition-colors">
                    {tab === 'SCREENING_PASSED' && (
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={selectedAppIds.includes(app.id)}
                          onChange={() =>
                            setSelectedAppIds((prev) =>
                              prev.includes(app.id) ? prev.filter((i) => i !== app.id) : [...prev, app.id]
                            )
                          }
                        />
                      </td>
                    )}
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{app.candidate?.fullName}</div>
                      <div className="font-mono text-[11px] text-teal-700">{app.candidate?.normalizedPhone}</div>
                      <div className="text-[10px] text-slate-400">{app.candidate?.currentLocation}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">{app.job?.jobTitle}</div>
                      <div className="text-[11px] text-slate-500">{app.job?.company?.companyName}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-slate-500 font-medium">Form:</span>
                          <button
                            onClick={() =>
                              handleUpdateDocStatus(
                                app.id,
                                app.formStatus === 'RECEIVED' ? 'PENDING' : 'RECEIVED',
                                app.cvStatus
                              )
                            }
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors ${
                              app.formStatus === 'RECEIVED'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}
                          >
                            {app.formStatus === 'RECEIVED' ? '✅ Form Received' : '⏳ Form Pending'}
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-slate-500 font-medium">CV:</span>
                          <button
                            onClick={() =>
                              handleUpdateDocStatus(
                                app.id,
                                app.formStatus,
                                app.cvStatus === 'CV_RECEIVED' ? 'CV_REQUIRED' : 'CV_RECEIVED'
                              )
                            }
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors ${
                              app.cvStatus === 'CV_RECEIVED' || app.cvStatus === 'VERIFIED'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}
                          >
                            {app.cvStatus === 'CV_RECEIVED' || app.cvStatus === 'VERIFIED'
                              ? '✅ CV Received'
                              : '⏳ CV Pending'}
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-[11px] text-slate-700 space-y-0.5">
                        <div>Bike: {app.candidate?.hasTwoWheeler ? '✅ Yes' : '❌ No'}</div>
                        <div>DL: {app.candidate?.hasDrivingLicense ? '✅ Yes' : '❌ No'}</div>
                        <div>Exp: {app.candidate?.experienceYears} Yrs</div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <StageBadge stage={app.currentStage} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      {hasPermission('screening.evaluate') && (
                        <button
                          onClick={() => setEvalApp(app)}
                          className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
                        >
                          Evaluate Decision
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

      {/* Evaluate Decision Modal */}
      <Modal
        isOpen={!!evalApp}
        onClose={() => setEvalApp(null)}
        title="Internal Candidate Screening Evaluation"
        subtitle={`Reviewing candidate ${evalApp?.candidate?.fullName} for ${evalApp?.job?.jobTitle}`}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Screening Decision</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setEvalStatus('PASS')}
                className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all ${
                  evalStatus === 'PASS'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                }`}
              >
                PASS
              </button>
              <button
                type="button"
                onClick={() => setEvalStatus('FAIL')}
                className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all ${
                  evalStatus === 'FAIL'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}
              >
                FAIL
              </button>
              <button
                type="button"
                onClick={() => setEvalStatus('HOLD')}
                className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all ${
                  evalStatus === 'HOLD'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}
              >
                SCREENING HOLD
              </button>
            </div>
          </div>

          {evalStatus === 'HOLD' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Hold Follow-up Date</label>
              <input
                type="date"
                value={holdDate}
                onChange={(e) => setHoldDate(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg text-xs"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Screening Remarks / Assessment Notes
            </label>
            <textarea
              rows={3}
              required
              value={evalRemarks}
              onChange={(e) => setEvalRemarks(e.target.value)}
              placeholder="e.g. Candidate verified, has bike & DL, strong Gujarati and Hindi communication, ready for client submission."
              className="w-full p-2.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setEvalApp(null)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleEvaluateScreening}
              disabled={!evalRemarks || submitting}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
            >
              Submit Screening Decision
            </button>
          </div>
        </div>
      </Modal>

      {/* Add To Final Shortlist Modal */}
      <Modal
        isOpen={showFinalizeModal}
        onClose={() => setShowFinalizeModal(false)}
        title="Add Candidates to Final Shortlist"
        subtitle={`Moving ${selectedAppIds.length} candidate(s) to Final Shortlist`}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Batch Notes</label>
            <input
              type="text"
              value={finalizeRemarks}
              onChange={(e) => setFinalizeRemarks(e.target.value)}
              placeholder="e.g. Approved Batch 1 for TVS Field Sales Interview"
              className="w-full p-2 border border-slate-200 rounded-lg text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setShowFinalizeModal(false)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleAddToFinalShortlist}
              disabled={submitting}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
            >
              Confirm Final Shortlist
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
