import React, { useState } from 'react';
import { RegistrationLink } from '../../types';
import { registrationsApi } from '../../services/api';
import { Modal } from '../common/Modal';
import { CheckCircle2, RotateCcw, XCircle, AlertCircle, Sparkles, FileText, ArrowRight, UserCheck } from 'lucide-react';

interface RegistrationReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  registration: RegistrationLink | null;
  onSuccess?: () => void;
}

export const RegistrationReviewModal: React.FC<RegistrationReviewModalProps> = ({
  isOpen,
  onClose,
  registration,
  onSuccess,
}) => {
  const [reviewNotes, setReviewNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [actionType, setActionType] = useState<'APPROVE' | 'CORRECTION'>('APPROVE');

  if (!registration) return null;

  const candidate = registration.candidate;
  const submitted = registration.submittedData ? (typeof registration.submittedData === 'string' ? JSON.parse(registration.submittedData) : registration.submittedData) : {};

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (actionType === 'APPROVE') {
        await registrationsApi.approve(registration.id, { reviewNotes });
        alert('Candidate registration approved and applied to Candidate Master!');
      } else {
        if (!reviewNotes.trim()) {
          alert('Please enter review notes for the requested correction.');
          setSubmitting(false);
          return;
        }
        await registrationsApi.requestCorrection(registration.id, { reviewNotes });
        alert('Correction request recorded and candidate token unlocked.');
      }
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to process review action');
    } finally {
      setSubmitting(false);
    }
  };

  const diffFields = [
    { label: 'Full Name', master: candidate?.name, submitted: submitted.name },
    { label: 'Email Address', master: candidate?.email, submitted: submitted.email },
    { label: 'Current Location', master: candidate?.currentLocation, submitted: submitted.currentCity || submitted.currentLocation },
    { label: 'Highest Education', master: candidate?.education, submitted: submitted.qualification || submitted.education },
    { label: 'Current Designation', master: candidate?.currentJobTitle, submitted: submitted.currentDesignation || submitted.currentJobTitle },
    { label: 'Current Company', master: candidate?.currentCompany, submitted: submitted.currentCompany },
    { label: 'Total Experience', master: `${candidate?.totalExperienceYears || 0} Years`, submitted: submitted.totalExperience ? `${submitted.totalExperience} Years` : '-' },
    { label: 'Current Salary', master: candidate?.currentSalary || '-', submitted: submitted.currentSalary || '-' },
    { label: 'Expected Salary', master: candidate?.expectedSalary || '-', submitted: submitted.expectedSalary || '-' },
    { label: 'Key Skills', master: candidate?.skills || '-', submitted: submitted.skills || '-' },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="xl"
      title="Candidate Registration Profile Review & Diff"
    >
      <form onSubmit={handleAction} className="space-y-4 text-xs">
        {/* Candidate Context Header */}
        <div className="p-3.5 bg-slate-900 text-white rounded-2xl flex items-center justify-between">
          <div>
            <div className="font-bold text-sm">{candidate?.name} ({candidate?.displaySlNo})</div>
            <div className="text-[11px] text-slate-300 font-mono">
              Phone: {candidate?.primaryPhone} • Status: <span className="text-amber-400 font-bold">{registration.status}</span>
            </div>
          </div>
          {registration.jobOrder && (
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block uppercase">Applied Job</span>
              <span className="font-bold text-blue-300">{registration.jobOrder.jobTitle}</span>
            </div>
          )}
        </div>

        {/* Side-by-Side Diff Table */}
        <div className="space-y-2">
          <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
            Side-by-Side Data Comparison (Master vs Submitted)
          </h4>

          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-2.5">Field</th>
                  <th className="p-2.5">Current Candidate Master</th>
                  <th className="p-2.5 bg-blue-50 text-blue-900">Submitted in Self-Service Form</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {diffFields.map((field, idx) => {
                  const isDifferent = field.master !== field.submitted && field.submitted;
                  return (
                    <tr key={idx} className={isDifferent ? 'bg-amber-50/40' : 'bg-white'}>
                      <td className="p-2.5 font-bold text-slate-700">{field.label}</td>
                      <td className="p-2.5 text-slate-500 font-mono text-[11px]">{field.master || '-'}</td>
                      <td className={`p-2.5 font-semibold font-mono text-[11px] ${isDifferent ? 'text-blue-700 font-bold' : 'text-slate-700'}`}>
                        {field.submitted || '-'}
                        {isDifferent && <span className="ml-2 px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-[9px]">UPDATED</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action Toggle */}
        <div className="space-y-2">
          <label className="block font-bold text-slate-700">Select Review Outcome</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setActionType('APPROVE')}
              className={`p-3 rounded-2xl border flex items-center justify-center gap-2 font-bold transition ${
                actionType === 'APPROVE'
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-sm'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Approve & Apply to Candidate Master</span>
            </button>

            <button
              type="button"
              onClick={() => setActionType('CORRECTION')}
              className={`p-3 rounded-2xl border flex items-center justify-center gap-2 font-bold transition ${
                actionType === 'CORRECTION'
                  ? 'bg-amber-50 border-amber-500 text-amber-900 shadow-sm'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <RotateCcw className="w-4 h-4 text-amber-600" />
              <span>Request Corrections from Candidate</span>
            </button>
          </div>
        </div>

        {/* Review Remarks */}
        <div>
          <label className="block font-bold text-slate-700 mb-1">
            Reviewer Remarks {actionType === 'CORRECTION' ? '*' : '(Optional)'}
          </label>
          <textarea
            rows={2}
            required={actionType === 'CORRECTION'}
            placeholder={
              actionType === 'APPROVE'
                ? 'e.g. Verified educational qualification and experience details.'
                : 'e.g. Please update your current employer relieving date and exact CTC in step 2.'
            }
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
            className="w-full p-2.5 border border-slate-200 rounded-xl"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl font-bold text-slate-600"
          >
            Close
          </button>
          <button
            type="submit"
            disabled={submitting}
            className={`px-5 py-2 text-white font-bold rounded-xl shadow-md transition active:scale-95 ${
              actionType === 'APPROVE'
                ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
                : 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/20'
            }`}
          >
            {submitting ? 'Processing...' : actionType === 'APPROVE' ? 'Confirm Approval' : 'Send Correction Request'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
