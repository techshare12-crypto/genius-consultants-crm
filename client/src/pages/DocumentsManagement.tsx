import React, { useState, useEffect } from 'react';
import { CandidateDocument } from '../types';
import { documentsApi, candidatesApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatDate, formatDateTime } from '../utils/helpers';
import { DocumentVerifyModal } from '../components/candidate/DocumentVerifyModal';
import {
  FileText,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RotateCcw,
  Eye,
  Download,
  ShieldCheck,
  Search,
  Filter,
  RefreshCw,
  Sparkles,
  Layers,
} from 'lucide-react';

export const DocumentsManagement: React.FC = () => {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<any>(null);
  const [documents, setDocuments] = useState<CandidateDocument[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  // Verify modal
  const [verifyModalOpen, setVerifyModalOpen] = useState<boolean>(false);
  const [selectedDocForVerify, setSelectedDocForVerify] = useState<CandidateDocument | null>(null);

  const fetchDocumentData = async () => {
    setLoading(true);
    try {
      const [analRes] = await Promise.all([
        documentsApi.getAnalytics(),
      ]);
      setAnalytics(analRes.data);
    } catch (err) {
      console.error('Failed to load document analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocumentData();
  }, []);

  const isTLOrAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' || user?.role === 'TEAM_LEADER';

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 text-white p-6 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-blue-500/20 text-blue-300 font-semibold text-xs border border-blue-500/30 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5" />
              Document & CV Management Center
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Secure Storage & Verification Engine
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight mt-1">
            Candidate Documents & CV Verification
          </h1>
          <p className="text-xs text-slate-300 mt-0.5">
            Automatic CV version control, government ID verification audits, client submission attachments, and secure document streaming.
          </p>
        </div>

        <button
          onClick={fetchDocumentData}
          className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Telemetry Counter Strip */}
      {analytics && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <div className="text-[10px] text-slate-400 uppercase font-bold">Total Active Documents</div>
            <div className="text-xl font-black text-slate-900 mt-1">{analytics.totalDocuments}</div>
          </div>
          <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 shadow-sm">
            <div className="text-[10px] text-blue-700 uppercase font-bold">Active CVs in Master</div>
            <div className="text-xl font-black text-blue-800 mt-1">{analytics.activeCVs}</div>
          </div>
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 shadow-sm">
            <div className="text-[10px] text-amber-700 uppercase font-bold">Pending Verification</div>
            <div className="text-xl font-black text-amber-800 mt-1">{analytics.pendingVerification}</div>
          </div>
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 shadow-sm">
            <div className="text-[10px] text-emerald-700 uppercase font-bold">Verified & Approved</div>
            <div className="text-xl font-black text-emerald-800 mt-1">{analytics.verifiedCount}</div>
          </div>
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 shadow-sm">
            <div className="text-[10px] text-rose-700 uppercase font-bold">Rejected Documents</div>
            <div className="text-xl font-black text-rose-800 mt-1">{analytics.rejectedCount}</div>
          </div>
          <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200 shadow-sm">
            <div className="text-[10px] text-purple-700 uppercase font-bold">Re-upload Required</div>
            <div className="text-xl font-black text-purple-800 mt-1">{analytics.reuploadRequiredCount}</div>
          </div>
        </div>
      )}

      {/* Info Card & Guidance */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center gap-2 font-bold text-slate-900">
            <Layers className="w-4 h-4 text-blue-600" />
            <span>Automatic CV Versioning</span>
          </div>
          <p className="text-slate-600 leading-relaxed">
            When a candidate submits an updated resume, the portal preserves all prior versions with immutable timestamps and sets the newest as <code>v[N] (Current)</code>.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center gap-2 font-bold text-slate-900">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Client Submission Integrity</span>
          </div>
          <p className="text-slate-600 leading-relaxed">
            When submitting candidates to Corporate Clients (e.g. Maruti Suzuki, ICICI), recruiters select the exact verified CV version to maintain 100% compliance.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center gap-2 font-bold text-slate-900">
            <Sparkles className="w-4 h-4 text-purple-600" />
            <span>Candidate Profile Integration</span>
          </div>
          <p className="text-slate-600 leading-relaxed">
            Access complete document history, inline PDF previews, and instant downloads directly from any candidate's 360° profile modal.
          </p>
        </div>
      </div>

      {/* Verification Modal */}
      <DocumentVerifyModal
        isOpen={verifyModalOpen}
        onClose={() => {
          setVerifyModalOpen(false);
          setSelectedDocForVerify(null);
        }}
        document={selectedDocForVerify}
        onSuccess={() => fetchDocumentData()}
      />
    </div>
  );
};
