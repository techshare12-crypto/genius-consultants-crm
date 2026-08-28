import React, { useState, useEffect } from 'react';
import { ShortlistRecord, User } from '../types';
import { shortlistApi, authApi, reportsApi, documentsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatPhone, getWhatsAppUrl, formatDate } from '../utils/helpers';
import { Modal } from '../components/common/Modal';
import { DocumentUploadModal } from '../components/candidate/DocumentUploadModal';
import {
  Download,
  RefreshCw,
  ExternalLink,
  MessageSquare,
  Send,
  CheckCircle2,
  FileText,
  UploadCloud,
  ArrowRight,
  ShieldCheck,
  Building2,
  Search,
  Filter,
  Layers,
  Sparkles,
  Check,
} from 'lucide-react';

interface ShortlistedPipelineProps {
  onOpenCandidateProfile: (candidateId: string) => void;
}

export const ShortlistedPipeline: React.FC<ShortlistedPipelineProps> = ({
  onOpenCandidateProfile,
}) => {
  const { user } = useAuth();
  const [records, setRecords] = useState<ShortlistRecord[]>([]);
  const [stats, setStats] = useState<any>({
    totalShortlisted: 0,
    formPendingCount: 0,
    formSentCount: 0,
    formCompletedCount: 0,
    cvPendingCount: 0,
    cvReceivedCount: 0,
    readyToSendCount: 0,
    sentToHrCount: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [executives, setExecutives] = useState<User[]>([]);

  // Filters
  const [dateRange, setDateRange] = useState<string>('ALL');
  const [selectedExec, setSelectedExec] = useState<string>('ALL');
  const [shortlistStatus, setShortlistStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals state
  const [selectedRecordForSendHr, setSelectedRecordForSendHr] = useState<ShortlistRecord | null>(null);
  const [sendHrModalOpen, setSendHrModalOpen] = useState<boolean>(false);
  const [hrForm, setHrForm] = useState({
    hrContactName: '',
    hrContactPhone: '',
    hrContactEmail: '',
    submissionMethod: 'WHATSAPP',
    notes: '',
  });

  // CV Upload modal state
  const [uploadCvModalOpen, setUploadCvModalOpen] = useState<boolean>(false);
  const [candidateForUpload, setCandidateForUpload] = useState<any>(null);

  const fetchShortlist = async () => {
    setLoading(true);
    try {
      const res = await shortlistApi.list({
        dateRange,
        executiveId: selectedExec,
        shortlistStatus: shortlistStatus !== 'ALL' ? shortlistStatus : undefined,
      });
      setRecords(res.data.records);
      setStats(res.data.stats);
    } catch (err) {
      console.error('Failed to load shortlisted candidates:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchExecutives = async () => {
    try {
      const res = await authApi.getExecutives();
      setExecutives(res.data.executives);
    } catch (err) {
      console.error('Failed to fetch executives:', err);
    }
  };

  useEffect(() => {
    fetchExecutives();
  }, []);

  useEffect(() => {
    fetchShortlist();
  }, [dateRange, selectedExec, shortlistStatus]);

  // Action: Send Google Form
  const handleSendGoogleForm = async (record: ShortlistRecord) => {
    try {
      const res = await shortlistApi.sendGoogleForm(record.id);
      window.open(res.data.whatsappUrl, '_blank');
      fetchShortlist();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to send Google Form');
    }
  };

  // Action: Mark Form Completed
  const handleMarkFormCompleted = async (recordId: string) => {
    try {
      await shortlistApi.markFormCompleted(recordId);
      fetchShortlist();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to mark form completed');
    }
  };

  // Action: Request CV
  const handleRequestCv = async (record: ShortlistRecord) => {
    try {
      const res = await shortlistApi.requestCv(record.id);
      window.open(res.data.whatsappUrl, '_blank');
      fetchShortlist();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to request CV');
    }
  };

  // Action: Mark Ready to Send
  const handleMarkReadyToSend = async (recordId: string) => {
    try {
      await shortlistApi.markReadyToSend(recordId);
      fetchShortlist();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to mark ready to send');
    }
  };

  // Action: Open Send to HR Modal
  const handleOpenSendHr = (record: ShortlistRecord) => {
    setSelectedRecordForSendHr(record);
    setHrForm({
      hrContactName: record.jobOrder?.hrContactName || record.jobOrder?.client?.contactPersonName || '',
      hrContactPhone: record.jobOrder?.hrContactPhone || record.jobOrder?.client?.mobileNumber || '',
      hrContactEmail: record.jobOrder?.hrContactEmail || record.jobOrder?.client?.email || '',
      submissionMethod: 'WHATSAPP',
      notes: `Delivered candidate ${record.candidate.name} package to HR.`,
    });
    setSendHrModalOpen(true);
  };

  // Submit Send to HR
  const handleConfirmSendToHr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecordForSendHr) return;

    try {
      await shortlistApi.sendToHr(selectedRecordForSendHr.id, hrForm);
      alert(`Candidate package delivered to Company HR (${hrForm.hrContactName || 'HR'})! Workflow completed.`);
      setSendHrModalOpen(false);
      fetchShortlist();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to deliver to HR');
    }
  };

  const handleExportExcel = () => {
    const url = reportsApi.getExportUrl('SHORTLISTED', 'xlsx');
    window.open(url, '_blank');
  };

  const filteredRecords = records.filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.candidate.name.toLowerCase().includes(q) ||
      r.candidate.primaryPhone.includes(q) ||
      (r.jobRole && r.jobRole.toLowerCase().includes(q)) ||
      (r.clientName && r.clientName.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-5 animate-fade-in pb-12">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 text-white p-6 rounded-2xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-blue-500/20 text-blue-300 font-semibold text-xs border border-blue-500/30 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" />
              Core Operations Pipeline
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Shortlist → Google Form → CV → Ready to Send → Send to HR
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight mt-1">
            Shortlisted Candidates Processing Pipeline
          </h1>
          <p className="text-xs text-slate-300 mt-0.5">
            Send WhatsApp Google Form links, record candidate CVs, verify checklist, and deliver completed candidate packages to Company HR.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchShortlist}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* 6-Stage Telemetry Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div className="text-[10px] text-slate-400 uppercase font-bold">1. Total Shortlisted</div>
          <div className="text-xl font-black text-slate-900 mt-1">{stats.totalShortlisted}</div>
        </div>
        <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 shadow-sm">
          <div className="text-[10px] text-blue-700 uppercase font-bold">2. Google Form Sent</div>
          <div className="text-xl font-black text-blue-800 mt-1">{stats.formSentCount}</div>
        </div>
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 shadow-sm">
          <div className="text-[10px] text-amber-700 uppercase font-bold">3. Form Completed</div>
          <div className="text-xl font-black text-amber-800 mt-1">{stats.formCompletedCount}</div>
        </div>
        <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200 shadow-sm">
          <div className="text-[10px] text-purple-700 uppercase font-bold">4. CV Received</div>
          <div className="text-xl font-black text-purple-800 mt-1">{stats.cvReceivedCount}</div>
        </div>
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 shadow-sm ring-1 ring-emerald-400/30">
          <div className="text-[10px] text-emerald-800 uppercase font-bold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>5. Ready to Send</span>
          </div>
          <div className="text-xl font-black text-emerald-900 mt-1">{stats.readyToSendCount}</div>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900 text-white shadow-sm">
          <div className="text-[10px] text-slate-400 uppercase font-bold">6. Sent to Company HR</div>
          <div className="text-xl font-black text-white mt-1">{stats.sentToHrCount}</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search candidate name, phone, company, or job role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full p-2 border border-slate-200 rounded-xl"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={shortlistStatus}
            onChange={(e) => setShortlistStatus(e.target.value)}
            className="p-2 border border-slate-200 rounded-xl bg-white font-semibold text-slate-700"
          >
            <option value="ALL">All Stages</option>
            <option value="SHORTLISTED">Shortlisted</option>
            <option value="FORM_SENT">Google Form Sent</option>
            <option value="FORM_COMPLETED">Form Completed</option>
            <option value="CV_REQUESTED">CV Requested</option>
            <option value="CV_RECEIVED">CV Received</option>
            <option value="READY_TO_SEND">Ready to Send (Checklist Met)</option>
            <option value="SENT_TO_HR">Sent to Company HR (Completed)</option>
          </select>

          {user?.role !== 'EXECUTIVE' && (
            <select
              value={selectedExec}
              onChange={(e) => setSelectedExec(e.target.value)}
              className="p-2 border border-slate-200 rounded-xl bg-white font-semibold text-slate-700"
            >
              <option value="ALL">All Executives</option>
              {executives.map((ex) => (
                <option key={ex.id} value={ex.id}>{ex.name}</option>
              ))}
            </select>
          )}

          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="p-2 border border-slate-200 rounded-xl bg-white font-semibold text-slate-700"
          >
            <option value="ALL">All Time</option>
            <option value="TODAY">Today</option>
            <option value="WEEK">This Week</option>
            <option value="MONTH">This Month</option>
          </select>
        </div>
      </div>

      {/* Main Pipeline Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3">Candidate</th>
                <th className="p-3">Company & Vacancy</th>
                <th className="p-3 text-center">Google Form</th>
                <th className="p-3 text-center">CV Status</th>
                <th className="p-3">Checklist & Pipeline Stage</th>
                <th className="p-3 text-right">Operations Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400">
                    No shortlisted candidates found for the selected filter.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => {
                  const isFormDone = r.formFilled === 'COMPLETED';
                  const isCvDone = r.cvReceivedWhatsapp === 'RECEIVED' || r.cvReceivedWhatsapp === 'UPLOADED';
                  const isReady = isFormDone && isCvDone;
                  const isSentToHr = r.shortlistStatus === 'SENT_TO_HR' || r.shortlistStatus === 'COMPLETED';

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition">
                      {/* Candidate Column */}
                      <td className="p-3">
                        <button
                          onClick={() => onOpenCandidateProfile(r.candidateId)}
                          className="font-bold text-slate-900 hover:text-blue-600 transition text-left"
                        >
                          {r.candidate.name}
                        </button>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {formatPhone(r.candidate.primaryPhone)} • {r.candidate.displaySlNo}
                        </div>
                        <div className="text-[10px] text-slate-400">{r.candidate.currentLocation || 'Location N/A'}</div>
                      </td>

                      {/* Company & Role */}
                      <td className="p-3">
                        <div className="font-semibold text-blue-700">
                          {r.jobRole || r.jobOrder?.jobTitle || 'Sales Executive'}
                        </div>
                        <div className="text-[11px] text-slate-600 flex items-center gap-1 font-medium">
                          <Building2 className="w-3 h-3 text-slate-400" />
                          <span>{r.clientName || r.jobOrder?.client?.companyName || 'Corporate Client'}</span>
                        </div>
                      </td>

                      {/* Google Form Status */}
                      <td className="p-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                            r.formFilled === 'COMPLETED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : r.formFilled === 'SENT'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {r.formFilled === 'COMPLETED' && <Check className="w-3 h-3" />}
                          {r.formFilled}
                        </span>
                      </td>

                      {/* CV Status */}
                      <td className="p-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                            isCvDone
                              ? 'bg-purple-100 text-purple-800'
                              : r.cvReceivedWhatsapp === 'REQUESTED'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {isCvDone && <Check className="w-3 h-3" />}
                          {r.cvReceivedWhatsapp}
                        </span>
                      </td>

                      {/* Checklist & Stage */}
                      <td className="p-3">
                        <div className="space-y-1">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-sm inline-block ${
                              isSentToHr
                                ? 'bg-slate-900 text-white'
                                : r.shortlistStatus === 'READY_TO_SEND' || isReady
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 font-black'
                                : 'bg-blue-50 text-blue-800 border border-blue-200'
                            }`}
                          >
                            {isSentToHr ? 'SENT TO COMPANY HR' : r.shortlistStatus}
                          </span>

                          <div className="flex items-center gap-2 text-[10px] text-slate-500">
                            <span className={isFormDone ? 'text-emerald-700 font-bold' : 'text-slate-400'}>
                              {isFormDone ? '✓ Form' : '○ Form'}
                            </span>
                            <span>•</span>
                            <span className={isCvDone ? 'text-purple-700 font-bold' : 'text-slate-400'}>
                              {isCvDone ? '✓ CV' : '○ CV'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {/* Send Google Form */}
                          {r.formFilled !== 'COMPLETED' && (
                            <button
                              onClick={() => handleSendGoogleForm(r)}
                              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg transition flex items-center gap-1"
                              title="Send Google Form via WhatsApp"
                            >
                              <Send className="w-3 h-3 text-blue-600" />
                              <span>Send Form</span>
                            </button>
                          )}

                          {/* Mark Form Completed */}
                          {r.formFilled !== 'COMPLETED' && (
                            <button
                              onClick={() => handleMarkFormCompleted(r.id)}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition"
                              title="Confirm Form Filled"
                            >
                              Mark Form Done
                            </button>
                          )}

                          {/* Request CV */}
                          {!isCvDone && (
                            <button
                              onClick={() => handleRequestCv(r)}
                              className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold rounded-lg transition flex items-center gap-1"
                              title="Request CV via WhatsApp"
                            >
                              <FileText className="w-3 h-3 text-purple-600" />
                              <span>Request CV</span>
                            </button>
                          )}

                          {/* Upload CV */}
                          <button
                            onClick={() => {
                              setCandidateForUpload(r.candidate);
                              setUploadCvModalOpen(true);
                            }}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                            title="Upload CV PDF"
                          >
                            <UploadCloud className="w-3.5 h-3.5 text-blue-600" />
                          </button>

                          {/* Mark Ready to Send */}
                          {isReady && r.shortlistStatus !== 'READY_TO_SEND' && !isSentToHr && (
                            <button
                              onClick={() => handleMarkReadyToSend(r.id)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition shadow-sm"
                            >
                              Mark Ready to Send
                            </button>
                          )}

                          {/* Send to Company HR */}
                          {!isSentToHr && (
                            <button
                              onClick={() => handleOpenSendHr(r)}
                              className="px-3 py-1 bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-600 hover:to-indigo-600 text-white font-bold rounded-lg transition shadow-sm flex items-center gap-1 active:scale-95"
                            >
                              <span>Send to HR</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}

                          {isSentToHr && (
                            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 font-bold text-[11px] border border-emerald-200">
                              ✓ Completed
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Send to Company HR Modal */}
      {selectedRecordForSendHr && (
        <Modal
          isOpen={sendHrModalOpen}
          onClose={() => setSendHrModalOpen(false)}
          maxWidth="md"
          title="Deliver Candidate Package to Company HR"
        >
          <form onSubmit={handleConfirmSendToHr} className="space-y-4 text-xs">
            {/* Candidate & Requirement Summary */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-sm">
                  {selectedRecordForSendHr.candidate.name} ({selectedRecordForSendHr.candidate.displaySlNo})
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                  Checklist Verified
                </span>
              </div>
              <div className="text-slate-600">
                Company: <strong className="text-slate-800">{selectedRecordForSendHr.clientName || selectedRecordForSendHr.jobOrder?.client?.companyName || 'Corporate Client'}</strong>
              </div>
              <div className="text-slate-600">
                Vacancy: <strong className="text-blue-700">{selectedRecordForSendHr.jobRole || selectedRecordForSendHr.jobOrder?.jobTitle}</strong>
              </div>
            </div>

            {/* HR Contact Details */}
            <div className="space-y-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Company HR Contact Person *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mr. Ramesh Sharma (HR Head)"
                  value={hrForm.hrContactName}
                  onChange={(e) => setHrForm({ ...hrForm, hrContactName: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">HR Mobile / WhatsApp</label>
                  <input
                    type="text"
                    placeholder="e.g. +91 98765 43210"
                    value={hrForm.hrContactPhone}
                    onChange={(e) => setHrForm({ ...hrForm, hrContactPhone: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">HR Email Address</label>
                  <input
                    type="email"
                    placeholder="e.g. hr@maruti.com"
                    value={hrForm.hrContactEmail}
                    onChange={(e) => setHrForm({ ...hrForm, hrContactEmail: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Delivery / Submission Method</label>
                <select
                  value={hrForm.submissionMethod}
                  onChange={(e) => setHrForm({ ...hrForm, submissionMethod: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-white font-semibold text-slate-800"
                >
                  <option value="WHATSAPP">WhatsApp Candidate Package</option>
                  <option value="EMAIL">Email Submission</option>
                  <option value="MANUAL">Direct Client Portal / Handover</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Submission Notes / Summary</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Candidate completed Google Form, verified two-wheeler and 2 years auto sales experience. CV attached."
                  value={hrForm.notes}
                  onChange={(e) => setHrForm({ ...hrForm, notes: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl"
                />
              </div>
            </div>

            {/* Submit */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSendHrModalOpen(false)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl font-bold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-600 hover:to-indigo-600 text-white font-bold rounded-xl shadow-md shadow-blue-500/20 active:scale-95 transition"
              >
                Confirm Send to Company HR
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* CV Upload Modal */}
      <DocumentUploadModal
        isOpen={uploadCvModalOpen}
        onClose={() => {
          setUploadCvModalOpen(false);
          setCandidateForUpload(null);
        }}
        candidate={candidateForUpload}
        defaultDocType="CV_RESUME"
        onSuccess={() => {
          fetchShortlist();
        }}
      />
    </div>
  );
};
