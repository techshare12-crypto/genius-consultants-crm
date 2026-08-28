import React, { useState } from 'react';
import { CandidateDocument } from '../../types';
import { documentsApi } from '../../services/api';
import { Modal } from '../common/Modal';
import { CheckCircle2, XCircle, RotateCcw, AlertTriangle, FileText } from 'lucide-react';

interface DocumentVerifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: CandidateDocument | null;
  onSuccess?: () => void;
}

export const DocumentVerifyModal: React.FC<DocumentVerifyModalProps> = ({
  isOpen,
  onClose,
  document,
  onSuccess,
}) => {
  const [verificationStatus, setVerificationStatus] = useState<'VERIFIED' | 'REJECTED' | 'REUPLOAD_REQUIRED'>('VERIFIED');
  const [verificationRemarks, setVerificationRemarks] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!document) return;

    if ((verificationStatus === 'REJECTED' || verificationStatus === 'REUPLOAD_REQUIRED') && !verificationRemarks.trim()) {
      setErrorMsg('Remarks are required when rejecting or requesting re-upload.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    try {
      await documentsApi.verify(document.id, {
        verificationStatus,
        verificationRemarks: verificationRemarks.trim() || undefined,
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Failed to update document verification');
    } finally {
      setSubmitting(false);
    }
  };

  if (!document) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="md"
      title="Verify / Audit Candidate Document"
    >
      <form onSubmit={handleVerify} className="space-y-4 text-xs">
        {/* Document Info Card */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-900">{document.originalFileName}</span>
            <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold font-mono text-[10px]">
              v{document.versionNumber} {document.isCurrentVersion ? '[Current]' : ''}
            </span>
          </div>
          <div className="text-[11px] text-slate-500">
            Type: {document.documentType} • Size: {(document.fileSizeBytes / 1024).toFixed(1)} KB
          </div>
          {document.notes && (
            <div className="text-[11px] text-slate-600 italic">
              Notes: "{document.notes}"
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Verification Status Selector */}
        <div className="space-y-2">
          <label className="block font-bold text-slate-700">Verification Outcome *</label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setVerificationStatus('VERIFIED')}
              className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 font-bold transition ${
                verificationStatus === 'VERIFIED'
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-sm'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>Verify & Approve</span>
            </button>

            <button
              type="button"
              onClick={() => setVerificationStatus('REUPLOAD_REQUIRED')}
              className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 font-bold transition ${
                verificationStatus === 'REUPLOAD_REQUIRED'
                  ? 'bg-amber-50 border-amber-500 text-amber-900 shadow-sm'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <RotateCcw className="w-5 h-5 text-amber-600" />
              <span>Request Re-upload</span>
            </button>

            <button
              type="button"
              onClick={() => setVerificationStatus('REJECTED')}
              className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 font-bold transition ${
                verificationStatus === 'REJECTED'
                  ? 'bg-rose-50 border-rose-500 text-rose-800 shadow-sm'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <XCircle className="w-5 h-5 text-rose-600" />
              <span>Reject Document</span>
            </button>
          </div>
        </div>

        {/* Verification Remarks */}
        <div>
          <label className="block font-bold text-slate-700 mb-1">
            Verification Remarks {verificationStatus !== 'VERIFIED' ? '*' : '(Optional)'}
          </label>
          <textarea
            rows={3}
            required={verificationStatus !== 'VERIFIED'}
            placeholder={
              verificationStatus === 'VERIFIED'
                ? 'e.g. Verified experience letter and skills match requirements.'
                : 'e.g. Please upload latest CV including your current 2026 automobile experience.'
            }
            value={verificationRemarks}
            onChange={(e) => setVerificationRemarks(e.target.value)}
            className="w-full p-2.5 border border-slate-200 rounded-xl"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl font-bold text-slate-600"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md shadow-blue-500/20 active:scale-95 transition"
          >
            {submitting ? 'Saving...' : 'Confirm Verification'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
