import React, { useState, useEffect } from 'react';
import { RegistrationLink } from '../types';
import { registrationsApi } from '../services/api';
import { RegistrationReviewModal } from '../components/candidate/RegistrationReviewModal';
import { formatDate, formatDateTime, getWhatsAppUrl } from '../utils/helpers';
import {
  Link2,
  Copy,
  Check,
  MessageSquare,
  Search,
  Filter,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Layers,
  XCircle,
} from 'lucide-react';

export const RegistrationsManagement: React.FC = () => {
  const [links, setLinks] = useState<RegistrationLink[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Review modal state
  const [reviewModalOpen, setReviewModalOpen] = useState<boolean>(false);
  const [selectedLinkForReview, setSelectedLinkForReview] = useState<RegistrationLink | null>(null);

  const fetchRegistrations = async () => {
    setLoading(true);
    try {
      const [listRes, analRes] = await Promise.all([
        registrationsApi.list({ status: statusFilter !== 'ALL' ? statusFilter : undefined }),
        registrationsApi.getAnalytics(),
      ]);
      setLinks(listRes.data.links || []);
      setAnalytics(analRes.data);
    } catch (err) {
      console.error('Failed to load registration links:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegistrations();
  }, [statusFilter]);

  const getRegistrationUrl = (token: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    return `${origin}/register/${token}`;
  };

  const handleCopyLink = (link: RegistrationLink) => {
    const fullUrl = getRegistrationUrl(link.token);
    navigator.clipboard.writeText(fullUrl);
    setCopiedId(link.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleWhatsApp = (link: RegistrationLink) => {
    const fullUrl = getRegistrationUrl(link.token);
    const msg = `Dear ${link.candidate?.name || 'Candidate'}, please complete your candidate onboarding profile through this secure Genius Consultants registration link: ${fullUrl}`;
    const waUrl = getWhatsAppUrl(link.candidate?.primaryPhone || '', msg);
    window.open(waUrl, '_blank');
  };

  const handleDisable = async (linkId: string) => {
    if (!confirm('Are you sure you want to disable this registration link token?')) return;
    try {
      await registrationsApi.disable(linkId);
      fetchRegistrations();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to disable link');
    }
  };

  const filteredLinks = links.filter((l) => {
    const matchesSearch =
      !searchQuery ||
      l.candidate?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.candidate?.primaryPhone?.includes(searchQuery) ||
      l.jobOrder?.jobTitle?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 text-white p-6 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-blue-500/20 text-blue-300 font-semibold text-xs border border-blue-500/30 flex items-center gap-1">
              <Link2 className="w-3.5 h-3.5" />
              Candidate Self-Service Registration Hub
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Secure Zero-Password Profile Completion
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight mt-1">
            Registration Links & Profile Review Queue
          </h1>
          <p className="text-xs text-slate-300 mt-0.5">
            Tokenized mobile registration forms, draft resume saving, candidate diff review, and safe master merging.
          </p>
        </div>

        <button
          onClick={fetchRegistrations}
          className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Telemetry Strip */}
      {analytics && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <div className="text-[10px] text-slate-400 uppercase font-bold">Total Generated</div>
            <div className="text-lg font-black text-slate-900 mt-1">{analytics.totalGenerated}</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200 shadow-sm">
            <div className="text-[10px] text-blue-700 uppercase font-bold">Active Tokens</div>
            <div className="text-lg font-black text-blue-800 mt-1">{analytics.activeCount}</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 shadow-sm">
            <div className="text-[10px] text-amber-700 uppercase font-bold">Draft In Progress</div>
            <div className="text-lg font-black text-amber-800 mt-1">{analytics.draftCount}</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-purple-50 border border-purple-200 shadow-sm">
            <div className="text-[10px] text-purple-700 uppercase font-bold">Submitted Review</div>
            <div className="text-lg font-black text-purple-800 mt-1">{analytics.submittedCount}</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 shadow-sm">
            <div className="text-[10px] text-emerald-700 uppercase font-bold">Approved in Master</div>
            <div className="text-lg font-black text-emerald-800 mt-1">{analytics.approvedCount}</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 shadow-sm">
            <div className="text-[10px] text-rose-700 uppercase font-bold">Correction Req</div>
            <div className="text-lg font-black text-rose-800 mt-1">{analytics.correctionRequiredCount}</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 shadow-sm">
            <div className="text-[10px] text-slate-500 uppercase font-bold">Expired / Disabled</div>
            <div className="text-lg font-black text-slate-700 mt-1">{analytics.expiredCount}</div>
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search candidate name, phone, or job title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full p-2 border border-slate-200 rounded-xl"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="p-2 border border-slate-200 rounded-xl bg-white font-semibold text-slate-700"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active (Unopened)</option>
            <option value="DRAFT">Draft In Progress</option>
            <option value="SUBMITTED">Submitted (Needs Review)</option>
            <option value="APPROVED">Approved & Applied</option>
            <option value="CORRECTION_REQUIRED">Correction Required</option>
            <option value="EXPIRED">Expired</option>
            <option value="DISABLED">Disabled</option>
          </select>
        </div>
      </div>

      {/* Registration Links Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3">Candidate</th>
                <th className="p-3">Linked Job Order</th>
                <th className="p-3">Token Status</th>
                <th className="p-3">Generated / Expires</th>
                <th className="p-3">Generated By</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLinks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400">
                    No registration links match your current filter.
                  </td>
                </tr>
              ) : (
                filteredLinks.map((link) => (
                  <tr key={link.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{link.candidate?.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {link.candidate?.primaryPhone} • {link.candidate?.displaySlNo}
                      </div>
                    </td>

                    <td className="p-3">
                      {link.jobOrder ? (
                        <div>
                          <div className="font-semibold text-blue-700">{link.jobOrder.jobTitle}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{link.jobOrder.displayJobId}</div>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">General Candidate Portal</span>
                      )}
                    </td>

                    <td className="p-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-sm ${
                          link.status === 'SUBMITTED'
                            ? 'bg-purple-100 text-purple-800 border border-purple-300 animate-pulse'
                            : link.status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : link.status === 'DRAFT'
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : link.status === 'CORRECTION_REQUIRED'
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : link.status === 'ACTIVE'
                            ? 'bg-blue-100 text-blue-800 border border-blue-300'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {link.status}
                      </span>
                    </td>

                    <td className="p-3">
                      <div className="text-slate-700 font-mono text-[11px]">{formatDate(link.createdAt)}</div>
                      <div className="text-[10px] text-slate-400 font-mono">Exp: {formatDate(link.expiresAt)}</div>
                    </td>

                    <td className="p-3">
                      <div className="text-slate-800 font-medium">{link.createdBy?.name}</div>
                    </td>

                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {link.status === 'SUBMITTED' && (
                          <button
                            onClick={() => {
                              setSelectedLinkForReview(link);
                              setReviewModalOpen(true);
                            }}
                            className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition shadow-sm"
                          >
                            Review & Diff
                          </button>
                        )}

                        <button
                          onClick={() => handleCopyLink(link)}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                          title="Copy Link URL"
                        >
                          {copiedId === link.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>

                        <button
                          onClick={() => handleWhatsApp(link)}
                          className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition"
                          title="Send via WhatsApp"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>

                        {link.status === 'ACTIVE' && (
                          <button
                            onClick={() => handleDisable(link.id)}
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg transition"
                            title="Disable Link Token"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review Modal */}
      <RegistrationReviewModal
        isOpen={reviewModalOpen}
        onClose={() => {
          setReviewModalOpen(false);
          setSelectedLinkForReview(null);
        }}
        registration={selectedLinkForReview}
        onSuccess={() => fetchRegistrations()}
      />
    </div>
  );
};
