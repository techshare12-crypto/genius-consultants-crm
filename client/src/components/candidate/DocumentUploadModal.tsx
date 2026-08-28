import React, { useState } from 'react';
import { Candidate, CandidateDocument } from '../../types';
import { documentsApi } from '../../services/api';
import { Modal } from '../common/Modal';
import { UploadCloud, FileText, CheckCircle2, AlertCircle, File } from 'lucide-react';

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidate: Candidate | null;
  defaultDocType?: string;
  onSuccess?: (doc: CandidateDocument) => void;
}

export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
  isOpen,
  onClose,
  candidate,
  defaultDocType = 'CV_RESUME',
  onSuccess,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<string>(defaultDocType);
  const [notes, setNotes] = useState<string>('');
  const [uploading, setUploading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      setErrorMsg('');
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidate || !selectedFile) {
      setErrorMsg('Please select a file to upload');
      return;
    }

    setUploading(true);
    setErrorMsg('');
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('candidateId', candidate.id);
      formData.append('documentType', documentType);
      if (notes) formData.append('notes', notes);

      const res = await documentsApi.upload(formData);
      if (onSuccess) onSuccess(res.data.document);
      setSelectedFile(null);
      setNotes('');
      onClose();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  if (!candidate) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="md"
      title="Upload Candidate Document / CV"
    >
      <form onSubmit={handleUpload} className="space-y-4 text-xs">
        {/* Candidate Context Banner */}
        <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 flex items-center justify-between">
          <div>
            <div className="font-bold text-slate-900">
              {candidate.name} ({candidate.displaySlNo})
            </div>
            <div className="text-[11px] text-blue-800 font-mono">
              UUID: {candidate.id}
            </div>
          </div>
          <span className="px-2 py-0.5 rounded bg-blue-200/80 text-blue-900 font-bold text-[10px]">
            Auto-Versioning Active
          </span>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Document Type Selector */}
        <div>
          <label className="block font-bold text-slate-700 mb-1">Document Category / Type *</label>
          <select
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value)}
            className="w-full p-2.5 border border-slate-200 rounded-xl bg-white font-semibold text-slate-800"
          >
            <option value="CV_RESUME">📄 CV / Resume (Master Resume)</option>
            <option value="UPDATED_CV">📄 Updated CV / Resume</option>
            <option value="AADHAAR_ID">🪪 Aadhaar Card / National Identity</option>
            <option value="PAN_TAX">💳 PAN Card / Tax Document</option>
            <option value="EDUCATION_CERT">🎓 Education Degree / Certificate</option>
            <option value="EXPERIENCE_CERT">💼 Experience Letter / Relieving Letter</option>
            <option value="SALARY_SLIP">💰 Recent Salary Slip (3 Months)</option>
            <option value="OFFER_LETTER">📑 Offer Letter / Appointment Letter</option>
            <option value="PHOTO">🖼️ Passport Size Photo</option>
            <option value="DRIVING_LICENSE">🚗 Driving License</option>
            <option value="OTHER">📁 Other Supporting Document</option>
          </select>
        </div>

        {/* File Dropzone */}
        <div>
          <label className="block font-bold text-slate-700 mb-1">Select File (PDF, DOCX, DOC, JPG, PNG - Max 10MB) *</label>
          <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-6 text-center bg-slate-50 transition cursor-pointer relative">
            <input
              type="file"
              required
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="space-y-1.5 pointer-events-none">
              <UploadCloud className="w-8 h-8 text-blue-600 mx-auto" />
              <div className="font-bold text-slate-800 text-xs">
                {selectedFile ? selectedFile.name : 'Click to browse or drag and drop file here'}
              </div>
              {selectedFile && (
                <div className="text-[11px] text-slate-500 font-mono">
                  {(selectedFile.size / 1024).toFixed(1)} KB • {selectedFile.type}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block font-bold text-slate-700 mb-1">Document Notes / Version Remarks</label>
          <input
            type="text"
            placeholder="e.g. Updated with recent Tata Motors experience (Aug 2026)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full p-2.5 border border-slate-200 rounded-xl"
          />
        </div>

        {/* Action Buttons */}
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
            disabled={uploading || !selectedFile}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md shadow-blue-500/20 active:scale-95 transition disabled:opacity-50"
          >
            <UploadCloud className="w-4 h-4" />
            <span>{uploading ? 'Uploading...' : 'Upload & Save Version'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
