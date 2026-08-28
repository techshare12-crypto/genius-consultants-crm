import React, { useState, useEffect } from 'react';
import {
  Candidate,
  CallOutcome,
  CommunicationActivity,
  CandidateFormTracking,
  CommunicationReminder,
  CandidateDocument,
} from '../../types';
import { candidatesApi, shortlistApi, communicationsApi, documentsApi } from '../../services/api';
import { StageBadge, OutcomeBadge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { WhatsAppModal } from './WhatsAppModal';
import { DocumentUploadModal } from './DocumentUploadModal';
import { DocumentVerifyModal } from './DocumentVerifyModal';
import { GenerateRegistrationLinkModal } from './GenerateRegistrationLinkModal';
import { formatPhone, getWhatsAppUrl, getTelUrl, formatDateTime, formatDate } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';
import {
  Phone,
  MessageSquare,
  Copy,
  Calendar,
  Building2,
  GraduationCap,
  Briefcase,
  MapPin,
  Clock,
  History,
  FileCheck,
  Check,
  Edit2,
  Save,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Send,
  Sparkles,
  FileText,
  UploadCloud,
  Eye,
  Download,
  ShieldCheck,
  File,
  RotateCcw,
  Link2,
} from 'lucide-react';

interface CandidateProfileModalProps {
  candidateId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onCandidateUpdated?: () => void;
  onStartCall?: (candidate: Candidate) => void;
}

export const CandidateProfileModal: React.FC<CandidateProfileModalProps> = ({
  candidateId,
  isOpen,
  onClose,
  onCandidateUpdated,
  onStartCall,
}) => {
  const { user } = useAuth();
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'DOCUMENTS' | 'COMMUNICATIONS' | 'CALLS' | 'SHORTLIST' | 'ASSIGNMENTS' | 'AUDIT'>('OVERVIEW');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [formData, setFormData] = useState<any>({});

  // Communications State
  const [communications, setCommunications] = useState<CommunicationActivity[]>([]);
  const [formTrackings, setFormTrackings] = useState<CandidateFormTracking[]>([]);
  const [reminders, setReminders] = useState<CommunicationReminder[]>([]);
  const [whatsAppModalOpen, setWhatsAppModalOpen] = useState<boolean>(false);
  const [generateLinkModalOpen, setGenerateLinkModalOpen] = useState<boolean>(false);

  // Documents State
  const [documents, setDocuments] = useState<CandidateDocument[]>([]);
  const [uploadModalOpen, setUploadModalOpen] = useState<boolean>(false);
  const [uploadDocType, setUploadDocType] = useState<string>('CV_RESUME');
  const [verifyModalOpen, setVerifyModalOpen] = useState<boolean>(false);
  const [selectedDocForVerify, setSelectedDocForVerify] = useState<CandidateDocument | null>(null);

  const fetchCandidate = async () => {
    if (!candidateId) return;
    setLoading(true);
    try {
      const [candRes, commRes, docsRes] = await Promise.all([
        candidatesApi.get(candidateId),
        communicationsApi.getHistory(candidateId).catch(() => ({ data: { communications: [], formTrackings: [], reminders: [] } })),
        documentsApi.listByCandidate(candidateId).catch(() => ({ data: { documents: [] } })),
      ]);
      setCandidate(candRes.data.candidate);
      setFormData(candRes.data.candidate);
      setCommunications(commRes.data.communications || []);
      setFormTrackings(commRes.data.formTrackings || []);
      setReminders(commRes.data.reminders || []);
      setDocuments(docsRes.data.documents || []);
    } catch (err) {
      console.error('Failed to load candidate profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendFormLink = async () => {
    if (!candidate) return;
    try {
      await communicationsApi.sendForm({ candidateId: candidate.id });
      alert('Registration form link sent and 2-day reminder scheduled.');
      fetchCandidate();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to send form link');
    }
  };

  const handleRequestCv = async () => {
    if (!candidate) return;
    try {
      await communicationsApi.requestCv({ candidateId: candidate.id });
      alert('CV requested from candidate and follow-up reminder scheduled.');
      fetchCandidate();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to request CV');
    }
  };

  useEffect(() => {
    if (isOpen && candidateId) {
      fetchCandidate();
      setIsEditing(false);
      setActiveTab('OVERVIEW');
    }
  }, [isOpen, candidateId]);

  const handleCopyPhone = () => {
    if (candidate?.primaryPhone) {
      navigator.clipboard.writeText(candidate.primaryPhone);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSaveProfile = async () => {
    if (!candidate) return;
    try {
      const res = await candidatesApi.update(candidate.id, formData);
      setCandidate(res.data.candidate);
      setIsEditing(false);
      if (onCandidateUpdated) onCandidateUpdated();
    } catch (err) {
      console.error('Failed to update candidate:', err);
    }
  };

  const handleUpdateShortlist = async (updates: any) => {
    if (!candidate?.shortlistRecord) return;
    try {
      await shortlistApi.update(candidate.shortlistRecord.id, updates);
      fetchCandidate();
      if (onCandidateUpdated) onCandidateUpdated();
    } catch (err) {
      console.error('Failed to update shortlist:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="4xl"
      title={
        candidate ? (
          <div className="flex flex-wrap items-center justify-between gap-4 w-full pr-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center text-sm shadow-md">
                {candidate.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900">{candidate.name}</h2>
                  <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    {candidate.displaySlNo}
                  </span>
                  <StageBadge stage={candidate.leadStage} />
                </div>
                <div className="text-xs text-slate-500 font-mono">
                  Permanent UUID: <span className="text-slate-700">{candidate.id}</span>
                </div>
              </div>
            </div>

            {/* Header action buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyPhone}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                <span>{copied ? 'Copied!' : formatPhone(candidate.primaryPhone)}</span>
              </button>

              <a
                href={getWhatsAppUrl(candidate.primaryPhone, candidate.name)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium transition shadow-sm"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </a>

              {onStartCall && (
                <button
                  onClick={() => {
                    onClose();
                    onStartCall(candidate);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition shadow-sm"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call Workspace</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          'Candidate Profile'
        )
      }
    >
      {loading ? (
        <div className="py-16 text-center text-slate-400">Loading candidate profile...</div>
      ) : !candidate ? (
        <div className="py-16 text-center text-rose-500">Candidate not found</div>
      ) : (
        <div className="space-y-6">
          {/* Sub Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            {[
              { id: 'OVERVIEW', label: 'Overview & Details', icon: UserCheckIcon },
              { id: 'DOCUMENTS', label: `Documents & CVs (${documents.filter(d => d.isCurrentVersion).length})`, icon: FileText },
              { id: 'COMMUNICATIONS', label: `Communications (${communications.length})`, icon: MessageSquare },
              { id: 'CALLS', label: `Call History (${candidate.callActivities?.length || 0})`, icon: Phone },
              { id: 'SHORTLIST', label: 'Shortlist & Form Status', icon: FileCheck },
              { id: 'ASSIGNMENTS', label: 'Assignment History', icon: History },
              { id: 'AUDIT', label: 'Audit Trail', icon: Clock },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                    activeTab === tab.id
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}

            <div className="ml-auto">
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700"
                >
                  <Edit2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>Edit Profile</span>
                </button>
              ) : (
                <button
                  onClick={handleSaveProfile}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium shadow-sm"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </button>
              )}
            </div>
          </div>

          {/* TAB 1: OVERVIEW & DETAILS */}
          {activeTab === 'OVERVIEW' && (
            <div className="space-y-6">
              {/* Quick Key Highlights Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                  <div className="text-[11px] font-medium text-slate-500 uppercase">Assigned Executive</div>
                  <div className="text-sm font-semibold text-slate-800 mt-0.5">
                    {candidate.assignedExecutive?.name || 'Unassigned'}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                  <div className="text-[11px] font-medium text-slate-500 uppercase">Lead Priority Score</div>
                  <div className="text-sm font-semibold text-blue-700 mt-0.5">
                    {candidate.leadPriorityScore} / 100
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                  <div className="text-[11px] font-medium text-slate-500 uppercase">Data Quality Score</div>
                  <div className="text-sm font-semibold text-emerald-700 mt-0.5">
                    {candidate.dataQualityScore} %
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                  <div className="text-[11px] font-medium text-slate-500 uppercase">Lead Source</div>
                  <div className="text-sm font-semibold text-slate-800 mt-0.5 truncate">
                    {candidate.leadSource}
                  </div>
                </div>
              </div>

              {/* Form details or view details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left: Basic & Contact details */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-4 shadow-sm">
                  <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2 border-b pb-2">
                    <MapPin className="w-4 h-4 text-blue-600" />
                    Personal & Contact Information
                  </h3>

                  {isEditing ? (
                    <div className="space-y-3 text-xs">
                      <div>
                        <label className="block font-medium text-slate-700 mb-1">Full Name</label>
                        <input
                          type="text"
                          value={formData.name || ''}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full p-2 border rounded-lg"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block font-medium text-slate-700 mb-1">Primary Phone</label>
                          <input
                            type="text"
                            value={formData.primaryPhone || ''}
                            onChange={(e) => setFormData({ ...formData, primaryPhone: e.target.value })}
                            className="w-full p-2 border rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block font-medium text-slate-700 mb-1">Secondary Phone</label>
                          <input
                            type="text"
                            value={formData.secondaryPhone || ''}
                            onChange={(e) => setFormData({ ...formData, secondaryPhone: e.target.value })}
                            className="w-full p-2 border rounded-lg"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block font-medium text-slate-700 mb-1">Email</label>
                        <input
                          type="email"
                          value={formData.email || ''}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="w-full p-2 border rounded-lg"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block font-medium text-slate-700 mb-1">Current Location</label>
                          <input
                            type="text"
                            value={formData.currentLocation || ''}
                            onChange={(e) => setFormData({ ...formData, currentLocation: e.target.value })}
                            className="w-full p-2 border rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block font-medium text-slate-700 mb-1">Native Location</label>
                          <input
                            type="text"
                            value={formData.nativeLocation || ''}
                            onChange={(e) => setFormData({ ...formData, nativeLocation: e.target.value })}
                            className="w-full p-2 border rounded-lg"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2.5 text-xs">
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Primary Phone:</span>
                        <span className="font-semibold font-mono text-slate-800">{formatPhone(candidate.primaryPhone)}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">WhatsApp:</span>
                        <span className="font-semibold font-mono text-slate-800">{formatPhone(candidate.whatsappNumber || candidate.primaryPhone)}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Email:</span>
                        <span className="font-medium text-slate-800">{candidate.email || 'Not provided'}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Current Location:</span>
                        <span className="font-medium text-slate-800">{candidate.currentLocation || 'Not provided'}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Native Location:</span>
                        <span className="font-medium text-slate-800">{candidate.nativeLocation || 'Not provided'}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-slate-500">Age & Gender:</span>
                        <span className="font-medium text-slate-800">
                          {candidate.age ? `${candidate.age} yrs` : '-'} | {candidate.gender || '-'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: Professional details */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-4 shadow-sm">
                  <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2 border-b pb-2">
                    <Briefcase className="w-4 h-4 text-blue-600" />
                    Professional & Job Preferences
                  </h3>

                  {isEditing ? (
                    <div className="space-y-3 text-xs">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block font-medium text-slate-700 mb-1">Education</label>
                          <input
                            type="text"
                            value={formData.education || ''}
                            onChange={(e) => setFormData({ ...formData, education: e.target.value })}
                            className="w-full p-2 border rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block font-medium text-slate-700 mb-1">Experience (Years)</label>
                          <input
                            type="number"
                            step="0.5"
                            value={formData.totalExperienceYears ?? 0}
                            onChange={(e) => setFormData({ ...formData, totalExperienceYears: e.target.value })}
                            className="w-full p-2 border rounded-lg"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block font-medium text-slate-700 mb-1">Current Company</label>
                          <input
                            type="text"
                            value={formData.currentCompany || ''}
                            onChange={(e) => setFormData({ ...formData, currentCompany: e.target.value })}
                            className="w-full p-2 border rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block font-medium text-slate-700 mb-1">Current Role</label>
                          <input
                            type="text"
                            value={formData.currentJobTitle || ''}
                            onChange={(e) => setFormData({ ...formData, currentJobTitle: e.target.value })}
                            className="w-full p-2 border rounded-lg"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block font-medium text-slate-700 mb-1">Current Salary</label>
                          <input
                            type="text"
                            value={formData.currentSalary || ''}
                            onChange={(e) => setFormData({ ...formData, currentSalary: e.target.value })}
                            className="w-full p-2 border rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block font-medium text-slate-700 mb-1">Expected Salary</label>
                          <input
                            type="text"
                            value={formData.expectedSalary || ''}
                            onChange={(e) => setFormData({ ...formData, expectedSalary: e.target.value })}
                            className="w-full p-2 border rounded-lg"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block font-medium text-slate-700 mb-1">Notice Period</label>
                        <input
                          type="text"
                          value={formData.noticePeriod || ''}
                          onChange={(e) => setFormData({ ...formData, noticePeriod: e.target.value })}
                          className="w-full p-2 border rounded-lg"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2.5 text-xs">
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Education:</span>
                        <span className="font-semibold text-slate-800">{candidate.education || 'Not provided'}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Total Experience:</span>
                        <span className="font-semibold text-slate-800">{candidate.totalExperienceYears} Years</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Current Company & Role:</span>
                        <span className="font-medium text-slate-800">
                          {candidate.currentCompany || '-'} ({candidate.currentJobTitle || '-'})
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Current CTC:</span>
                        <span className="font-semibold text-slate-800">{candidate.currentSalary || '-'}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Expected CTC:</span>
                        <span className="font-semibold text-emerald-700">{candidate.expectedSalary || '-'}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-slate-500">Notice Period:</span>
                        <span className="font-medium text-slate-800">{candidate.noticePeriod || 'Immediate'}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Eligibility Badges */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Eligibility & Assets</div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <span className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 ${candidate.hasTwoWheeler ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                    <CheckCircle2 className="w-3.5 h-3.5" /> Two-Wheeler {candidate.hasTwoWheeler ? 'Available' : 'No'}
                  </span>
                  <span className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 ${candidate.hasDrivingLicense ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                    <CheckCircle2 className="w-3.5 h-3.5" /> Driving License {candidate.hasDrivingLicense ? 'Valid' : 'No'}
                  </span>
                  <span className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 ${candidate.interestedInFieldSales ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-600'}`}>
                    <CheckCircle2 className="w-3.5 h-3.5" /> Field Sales Ready
                  </span>
                  <span className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 ${candidate.interestedInAutomobile ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-600'}`}>
                    <CheckCircle2 className="w-3.5 h-3.5" /> Automobile Ready
                  </span>
                </div>
              </div>

              {/* General Notes */}
              {candidate.generalNotes && (
                <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 text-xs">
                  <div className="font-semibold text-amber-900 mb-1">Executive Notes:</div>
                  <p className="text-slate-700">{candidate.generalNotes}</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DOCUMENTS & CV MANAGEMENT */}
          {activeTab === 'DOCUMENTS' && (
            <div className="space-y-5">
              {/* Document Actions Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 text-white flex flex-wrap items-center justify-between gap-3 shadow-md">
                <div>
                  <div className="font-black text-sm">Document & CV Repository</div>
                  <p className="text-[11px] text-slate-300">
                    CV version control, ID proofs, salary slips, and verification audits with secure streaming.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setUploadDocType('CV_RESUME');
                      setUploadModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-xs shadow transition active:scale-95 text-white"
                  >
                    <UploadCloud className="w-4 h-4" />
                    <span>Upload CV / Document</span>
                  </button>
                </div>
              </div>

              {/* Documents List */}
              <div className="space-y-3">
                {documents.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 text-xs border border-dashed rounded-2xl space-y-2">
                    <FileText className="w-8 h-8 mx-auto text-slate-300" />
                    <div className="font-bold text-slate-700">No documents uploaded for this candidate yet.</div>
                    <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                      Click "+ Upload CV / Document" to upload a PDF or image with automatic version control.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Current Documents */}
                    <div className="space-y-2">
                      <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                        Current Active Documents ({documents.filter((d) => d.isCurrentVersion).length})
                      </h4>

                      <div className="grid grid-cols-1 gap-2.5">
                        {documents
                          .filter((d) => d.isCurrentVersion)
                          .map((doc) => {
                            const isTLOrAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' || user?.role === 'TEAM_LEADER';
                            return (
                              <div
                                key={doc.id}
                                className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm hover:border-slate-300 transition space-y-2.5"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-2.5">
                                    <div className="p-2 rounded-xl bg-blue-50 text-blue-700 font-bold text-xs">
                                      <FileText className="w-4 h-4" />
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <span className="font-bold text-xs text-slate-900">{doc.originalFileName}</span>
                                        <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-mono font-bold text-[10px]">
                                          v{doc.versionNumber} [Current]
                                        </span>
                                      </div>
                                      <div className="text-[10px] text-slate-400 font-mono">
                                        {doc.documentType} • {(doc.fileSizeBytes / 1024).toFixed(1)} KB • Uploaded by {doc.uploadedBy?.name} on {formatDate(doc.createdAt)}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Verification Status Badge */}
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold shadow-sm ${
                                        doc.verificationStatus === 'VERIFIED'
                                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                          : doc.verificationStatus === 'REJECTED'
                                          ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                          : doc.verificationStatus === 'REUPLOAD_REQUIRED'
                                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                          : 'bg-blue-50 text-blue-800 border border-blue-200'
                                      }`}
                                    >
                                      {doc.verificationStatus}
                                    </span>
                                  </div>
                                </div>

                                {doc.verificationRemarks && (
                                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-700 italic">
                                    Audit Remarks: "{doc.verificationRemarks}" {doc.verifiedBy && `(by ${doc.verifiedBy.name})`}
                                  </div>
                                )}

                                {/* Action Buttons */}
                                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                                  <div className="flex items-center gap-2">
                                    <a
                                      href={documentsApi.getPreviewUrl(doc.id)}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold flex items-center gap-1 transition"
                                    >
                                      <Eye className="w-3.5 h-3.5 text-blue-600" />
                                      <span>Preview</span>
                                    </a>

                                    <a
                                      href={documentsApi.getDownloadUrl(doc.id)}
                                      download
                                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold flex items-center gap-1 transition"
                                    >
                                      <Download className="w-3.5 h-3.5 text-emerald-600" />
                                      <span>Download</span>
                                    </a>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => {
                                        setUploadDocType(doc.documentType);
                                        setUploadModalOpen(true);
                                      }}
                                      className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold flex items-center gap-1 transition"
                                    >
                                      <UploadCloud className="w-3.5 h-3.5" />
                                      <span>Upload New Version</span>
                                    </button>

                                    {isTLOrAdmin && (
                                      <button
                                        onClick={() => {
                                          setSelectedDocForVerify(doc);
                                          setVerifyModalOpen(true);
                                        }}
                                        className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold flex items-center gap-1 transition"
                                      >
                                        <ShieldCheck className="w-3.5 h-3.5" />
                                        <span>Verify / Audit</span>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>

                    {/* Historical Versions Section */}
                    {documents.some((d) => !d.isCurrentVersion) && (
                      <div className="space-y-2 pt-3 border-t border-slate-200">
                        <h4 className="font-bold text-xs text-slate-500 uppercase tracking-wider">
                          Archived Version History ({documents.filter((d) => !d.isCurrentVersion).length})
                        </h4>
                        <div className="space-y-1.5 opacity-75">
                          {documents
                            .filter((d) => !d.isCurrentVersion)
                            .map((doc) => (
                              <div
                                key={doc.id}
                                className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-slate-700">{doc.originalFileName}</span>
                                  <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 font-mono text-[10px]">
                                    v{doc.versionNumber} [Archived]
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-slate-400">
                                    {formatDate(doc.createdAt)} by {doc.uploadedBy?.name}
                                  </span>
                                  <a
                                    href={documentsApi.getDownloadUrl(doc.id)}
                                    download
                                    className="p-1 rounded hover:bg-slate-200 text-slate-600"
                                    title="Download Archived Version"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </a>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: COMMUNICATIONS TIMELINE & WHATSAPP */}
          {activeTab === 'COMMUNICATIONS' && (
            <div className="space-y-5">
              {/* Quick Action Toolbar */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-900 via-slate-900 to-indigo-950 text-white flex flex-wrap items-center justify-between gap-3 shadow-md">
                <div>
                  <div className="font-black text-sm">Direct Candidate Communication Center</div>
                  <p className="text-[11px] text-slate-300">
                    Send templated WhatsApp messages, register form links, request CVs, and track timeline.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setGenerateLinkModalOpen(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-xs shadow transition active:scale-95 text-white"
                  >
                    <Link2 className="w-4 h-4" />
                    <span>Generate Registration Link</span>
                  </button>

                  <button
                    onClick={() => setWhatsAppModalOpen(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-xs shadow transition active:scale-95 text-white"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>WhatsApp Candidate</span>
                  </button>

                  <button
                    onClick={handleSendFormLink}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-xs shadow transition active:scale-95 text-white"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Form Link</span>
                  </button>

                  <button
                    onClick={handleRequestCv}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 font-bold text-xs shadow transition active:scale-95 text-white"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Request CV</span>
                  </button>
                </div>
              </div>

              {/* Form & Reminder Status Overview Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-800">Registration Form Tracking</span>
                    <span className="text-[10px] font-mono text-slate-400">GC-Form-Engine</span>
                  </div>
                  {formTrackings.length === 0 ? (
                    <div className="text-xs text-slate-400">No registration forms sent yet.</div>
                  ) : (
                    <div className="space-y-1.5">
                      {formTrackings.map((f) => (
                        <div key={f.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                          <div>
                            <div className="font-semibold text-slate-800">{f.formName}</div>
                            <div className="text-[10px] text-slate-500">Sent by {f.sentBy?.name} on {formatDateTime(f.sentDate)}</div>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            f.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {f.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-800">Scheduled Follow-up Reminders</span>
                    <span className="text-[10px] font-mono text-slate-400">Auto-Reminders</span>
                  </div>
                  {reminders.length === 0 ? (
                    <div className="text-xs text-slate-400">No pending reminders for this candidate.</div>
                  ) : (
                    <div className="space-y-1.5">
                      {reminders.map((r) => (
                        <div key={r.id} className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-200 flex items-center justify-between text-xs">
                          <div>
                            <div className="font-semibold text-slate-900">{r.reminderType.replace('_', ' ')}</div>
                            <div className="text-[10px] text-amber-800">Due on {formatDate(r.dueDate)}</div>
                          </div>
                          <span className="px-2 py-0.5 rounded bg-amber-200 text-amber-900 text-[10px] font-bold">
                            {r.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Chronological Communication Timeline */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                  Communication History Timeline ({communications.length})
                </h4>

                {communications.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 text-xs border border-dashed rounded-2xl">
                    No communication history logged for this candidate yet.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {communications.map((c) => (
                      <div
                        key={c.id}
                        className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2 hover:border-slate-300 transition"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                              {c.channel}
                            </span>
                            <span className="font-bold text-xs text-slate-900">
                              {c.communicationType.replace('_', ' ')}
                            </span>
                            {c.jobOrder && (
                              <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                                {c.jobOrder.jobTitle}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px] font-semibold">
                              Status: {c.deliveryStatus}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {formatDateTime(c.sentAt || c.createdAt)}
                            </span>
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs font-sans text-slate-700 whitespace-pre-wrap leading-relaxed">
                          {c.messageContent}
                        </div>

                        <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1">
                          <span>Initiated by: <strong>{c.user?.name || 'System'}</strong></span>
                          <span>Provider: {c.provider}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: CALL HISTORY */}
          {activeTab === 'CALLS' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-800 text-sm">
                  Complete Call Activity History (Immutable Record)
                </h3>
                <span className="text-xs text-slate-500 font-medium">
                  Total Attempts: {candidate.callActivities?.length || 0}
                </span>
              </div>

              {!candidate.callActivities || candidate.callActivities.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  No call activities recorded for this candidate yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {candidate.callActivities.map((call, idx) => (
                    <div
                      key={call.id}
                      className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition shadow-sm space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 font-bold text-xs flex items-center justify-center">
                            #{candidate.callActivities!.length - idx}
                          </span>
                          <OutcomeBadge outcome={call.outcome} />
                          <span className="text-xs font-semibold text-slate-800">
                            {call.executive?.name || 'Executive'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 font-mono flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          {formatDate(call.callDate)} {call.callTime}
                        </div>
                      </div>

                      {call.remarks && (
                        <div className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          <span className="font-semibold text-slate-500">Remarks: </span>
                          {call.remarks}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SHORTLIST & PIPELINE */}
          {activeTab === 'SHORTLIST' && (
            <div className="space-y-5">
              {!candidate.shortlistRecord ? (
                <div className="p-6 rounded-xl border border-dashed border-slate-300 text-center space-y-3">
                  <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
                  <div className="text-sm font-semibold text-slate-700">Candidate Not Yet Shortlisted</div>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Shortlisting attaches a permanent shortlist pipeline tracking record to this Candidate ID without creating spreadsheet duplicates.
                  </p>
                </div>
              ) : (
                <div className="p-5 rounded-2xl border border-blue-200 bg-blue-50/30 space-y-5">
                  <div className="flex items-center justify-between border-b border-blue-200/60 pb-3">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-blue-900">Shortlisted Pipeline Record</div>
                      <div className="text-xs text-slate-500">
                        Shortlisted on {formatDate(candidate.shortlistRecord.shortlistedAt)} by {candidate.shortlistRecord.shortlistedBy?.name}
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-blue-600 text-white font-bold text-xs shadow-sm">
                      {candidate.shortlistRecord.shortlistStatus}
                    </span>
                  </div>

                  {/* Form & CV Status Interactive Toggles */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-2">
                      <div className="text-xs font-semibold text-slate-700">Candidate Registration Form:</div>
                      <div className="flex gap-2">
                        {['PENDING', 'COMPLETED', 'NOT_REQUIRED'].map((st) => (
                          <button
                            key={st}
                            onClick={() => handleUpdateShortlist({ formFilled: st })}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                              candidate.shortlistRecord?.formFilled === st
                                ? 'bg-emerald-600 text-white shadow'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-2">
                      <div className="text-xs font-semibold text-slate-700">CV Received on WhatsApp:</div>
                      <div className="flex gap-2">
                        {['PENDING', 'RECEIVED', 'REJECTED'].map((st) => (
                          <button
                            key={st}
                            onClick={() => handleUpdateShortlist({ cvReceivedWhatsapp: st })}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                              candidate.shortlistRecord?.cvReceivedWhatsapp === st
                                ? 'bg-emerald-600 text-white shadow'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Job role & Client details */}
                  <div className="grid grid-cols-2 gap-4 text-xs bg-white p-4 rounded-xl border border-slate-200">
                    <div>
                      <span className="text-slate-500 font-medium">Target Client:</span>
                      <div className="font-semibold text-slate-800 text-sm mt-0.5">{candidate.shortlistRecord.clientName || 'General / Internal Pool'}</div>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium">Job Role:</span>
                      <div className="font-semibold text-slate-800 text-sm mt-0.5">{candidate.shortlistRecord.jobRole || 'Field Sales Executive'}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: ASSIGNMENTS */}
          {activeTab === 'ASSIGNMENTS' && (
            <div className="space-y-4">
              <h3 className="font-bold text-slate-800 text-sm">Lead Assignment & Reassignment History</h3>
              {!candidate.leadAssignments || candidate.leadAssignments.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  No historical reassignments recorded.
                </div>
              ) : (
                <div className="space-y-2">
                  {candidate.leadAssignments.map((a) => (
                    <div key={a.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-slate-800">Assigned to: {a.assignedTo?.name}</span>
                        <span className="text-slate-500 ml-2">by {a.assignedBy?.name}</span>
                        <span className="ml-2 px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] font-mono">
                          {a.assignmentMode}
                        </span>
                      </div>
                      <div className="text-slate-400 text-xs font-mono">{formatDateTime(a.assignedAt)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: AUDIT LOGS */}
          {activeTab === 'AUDIT' && (
            <div className="space-y-4">
              <h3 className="font-bold text-slate-800 text-sm">Activity & Modification Audit Log</h3>
              {!candidate.activityLogs || candidate.activityLogs.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  No audit logs recorded yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {candidate.activityLogs.map((log) => (
                    <div key={log.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
                      <div>
                        <span className="font-bold text-blue-700">{log.action}</span>
                        <span className="text-slate-600 ml-2">{log.details || 'No extra details'}</span>
                        {log.user && <span className="text-slate-400 ml-2">({log.user.name})</span>}
                      </div>
                      <div className="text-slate-400 font-mono text-[11px]">{formatDateTime(log.createdAt)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* WhatsApp Modal */}
      <WhatsAppModal
        isOpen={whatsAppModalOpen}
        onClose={() => setWhatsAppModalOpen(false)}
        candidate={candidate}
        onSuccess={() => fetchCandidate()}
      />

      {/* Document Upload Modal */}
      <DocumentUploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        candidate={candidate}
        defaultDocType={uploadDocType}
        onSuccess={() => fetchCandidate()}
      />

      {/* Document Verify Modal */}
      <DocumentVerifyModal
        isOpen={verifyModalOpen}
        onClose={() => {
          setVerifyModalOpen(false);
          setSelectedDocForVerify(null);
        }}
        document={selectedDocForVerify}
        onSuccess={() => fetchCandidate()}
      />

      {/* Generate Registration Link Modal */}
      <GenerateRegistrationLinkModal
        isOpen={generateLinkModalOpen}
        onClose={() => setGenerateLinkModalOpen(false)}
        candidate={candidate}
        onSuccess={() => fetchCandidate()}
      />
    </Modal>
  );
};

function UserCheckIcon(props: any) {
  return <Briefcase {...props} />;
}
