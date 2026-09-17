'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Modal } from '@/components/common/Modal';
import { Award, Star, Plus, User, Building2, Calendar } from 'lucide-react';

export default function QualityPage() {
  const { user, hasPermission } = useAuth();
  const [executives, setExecutives] = useState<any[]>([]);
  const [selectedExecId, setSelectedExecId] = useState('');
  const [qualitySummary, setQualitySummary] = useState<any>(null);
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New Review Modal
  const [showAddReviewModal, setShowAddReviewModal] = useState(false);
  const [reviewAppId, setReviewAppId] = useState('');
  const [reviewExecId, setReviewExecId] = useState('');
  const [commScore, setCommScore] = useState(4);
  const [jobScore, setJobScore] = useState(4);
  const [processScore, setProcessScore] = useState(4);
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedExecId) {
      fetchExecutiveQuality(selectedExecId);
    }
  }, [selectedExecId]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [resUsers, resApps] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/applications?limit=100'),
      ]);

      if (resUsers.ok) {
        const d = await resUsers.json();
        const execs = (d.data || []).filter((u: any) => u.roles.includes('EXECUTIVE') || u.roles.includes('SCREENING_MANAGER'));
        setExecutives(execs);
        if (execs.length > 0) {
          setSelectedExecId(execs[0].id);
        }
      }
      if (resApps.ok) {
        const a = await resApps.json();
        setApplications(a.data || []);
      }
    } catch (err) {
      console.error('Error fetching quality data', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchExecutiveQuality = async (execId: string) => {
    try {
      const res = await fetch(`/api/quality?executiveId=${execId}`);
      if (res.ok) {
        const d = await res.json();
        setQualitySummary(d.data);
      }
    } catch (err) {
      console.error('Error loading quality summary', err);
    }
  };

  const handleCreateReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewAppId || !reviewExecId || !reviewRemarks) return;
    setSubmitting(true);

    try {
      const res = await fetch('/api/quality', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: reviewAppId,
          executiveId: reviewExecId,
          communicationScore: Number(commScore),
          jobExplanationScore: Number(jobScore),
          processAdherenceScore: Number(processScore),
          remarks: reviewRemarks,
        }),
      });

      if (res.ok) {
        setShowAddReviewModal(false);
        setReviewRemarks('');
        await fetchExecutiveQuality(selectedExecId);
      }
    } catch (err) {
      console.error('Error creating quality review', err);
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
            OPERATIONS QUALITY ASSURANCE
          </span>
          <h2 className="text-lg font-bold text-slate-900 mt-0.5">Executive Quality Management</h2>
          <p className="text-xs text-slate-500">
            Manual coaching reviews, communication standards, and process discipline assessment (1–5 scale).
          </p>
        </div>

        {hasPermission('quality.review') && (
          <button
            onClick={() => {
              setReviewExecId(selectedExecId);
              setShowAddReviewModal(true);
            }}
            className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Conduct Quality Review</span>
          </button>
        )}
      </div>

      {/* Executive Selector & Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Executive List (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-2">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
            Select Executive
          </span>
          {executives.map((exec) => (
            <button
              key={exec.id}
              onClick={() => setSelectedExecId(exec.id)}
              className={`w-full p-3 rounded-xl text-left transition-all flex items-center justify-between ${
                selectedExecId === exec.id
                  ? 'bg-teal-50 border-2 border-teal-600 text-teal-900'
                  : 'bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800'
              }`}
            >
              <div>
                <div className="font-bold text-xs">{exec.fullName}</div>
                <div className="text-[10px] text-slate-500">{exec.email}</div>
              </div>
              <span className="text-xs font-bold text-amber-600">
                ★ {exec.qualityRating || 'N/A'}
              </span>
            </button>
          ))}
        </div>

        {/* Right: Reviews List (8 cols) */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Quality Review Scorecard
              </h3>
              <p className="text-xs text-slate-500">
                Total Reviews: {qualitySummary?.totalReviews || 0} | Average Rating:{' '}
                <strong className="text-amber-600">★ {qualitySummary?.averageRating || 0}/5</strong>
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {qualitySummary?.reviews?.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No quality reviews recorded for this executive yet.
              </div>
            ) : (
              qualitySummary?.reviews?.map((r: any) => (
                <div key={r.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-xs text-slate-900">
                        {r.application?.candidate?.fullName} — {r.application?.job?.jobTitle}
                      </span>
                      <span className="text-[11px] text-slate-400 block">
                        Reviewed by {r.reviewer?.fullName} on {new Date(r.reviewedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <span className="px-2.5 py-1 bg-amber-100 text-amber-800 font-bold rounded-lg text-xs">
                      ★ {r.rating} / 5.0
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-[11px] bg-white p-2.5 rounded-lg border border-slate-100">
                    <div>
                      <span className="text-slate-400 block">Communication:</span>
                      <span className="font-bold text-slate-800">{r.communicationScore} / 5</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Job Explanation:</span>
                      <span className="font-bold text-slate-800">{r.jobExplanationScore} / 5</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Process Discipline:</span>
                      <span className="font-bold text-slate-800">{r.processAdherenceScore} / 5</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-700 bg-white p-2.5 rounded-lg border border-slate-100">
                    "{r.remarks}"
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Add Review Modal */}
      <Modal
        isOpen={showAddReviewModal}
        onClose={() => setShowAddReviewModal(false)}
        title="Conduct Executive Quality Review"
        subtitle="Evaluate calling performance and CRM discipline on a 1–5 scale"
      >
        <form onSubmit={handleCreateReview} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Target Application / Lead</label>
            <select
              required
              value={reviewAppId}
              onChange={(e) => setReviewAppId(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-lg text-xs"
            >
              <option value="">Select Candidate Application...</option>
              {applications.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.candidate?.fullName} — {a.job?.jobTitle}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Communication (1-5)</label>
              <input
                type="number"
                min="1"
                max="5"
                required
                value={commScore}
                onChange={(e) => setCommScore(Number(e.target.value))}
                className="w-full p-2 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Job Accuracy (1-5)</label>
              <input
                type="number"
                min="1"
                max="5"
                required
                value={jobScore}
                onChange={(e) => setJobScore(Number(e.target.value))}
                className="w-full p-2 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">CRM Process (1-5)</label>
              <input
                type="number"
                min="1"
                max="5"
                required
                value={processScore}
                onChange={(e) => setProcessScore(Number(e.target.value))}
                className="w-full p-2 border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Coaching Remarks & Notes</label>
            <textarea
              rows={3}
              required
              value={reviewRemarks}
              onChange={(e) => setReviewRemarks(e.target.value)}
              placeholder="e.g. Good polite introduction. Need to explain the 2-wheeler petrol allowance clearly."
              className="w-full p-2.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddReviewModal(false)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
            >
              Save Quality Review
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
