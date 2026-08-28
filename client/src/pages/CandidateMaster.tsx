import React, { useState, useEffect } from 'react';
import { Candidate, User } from '../types';
import { candidatesApi, authApi, assignmentsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { StageBadge } from '../components/common/Badge';
import { formatPhone, getWhatsAppUrl, formatDate } from '../utils/helpers';
import {
  Search,
  Filter,
  ArrowUpDown,
  Plus,
  Phone,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ExternalLink,
  CheckSquare,
  Square,
  Sparkles,
} from 'lucide-react';

interface CandidateMasterProps {
  onOpenCandidateProfile: (candidateId: string) => void;
  onOpenAddCandidate: () => void;
  onStartCall: (candidate: Candidate) => void;
  onlyMyLeads?: boolean;
}

export const CandidateMaster: React.FC<CandidateMasterProps> = ({
  onOpenCandidateProfile,
  onOpenAddCandidate,
  onStartCall,
  onlyMyLeads = false,
}) => {
  const { user } = useAuth();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [executives, setExecutives] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });

  // Filters & Sorting state
  const [search, setSearch] = useState<string>('');
  const [stage, setStage] = useState<string>('ALL');
  const [executiveId, setExecutiveId] = useState<string>(onlyMyLeads && user ? user.id : 'ALL');
  const [location, setLocation] = useState<string>('ALL');
  const [source, setSource] = useState<string>('ALL');
  const [minExp, setMinExp] = useState<string>('');
  const [hasTwoWheeler, setHasTwoWheeler] = useState<boolean>(false);
  const [hasLicense, setHasLicense] = useState<boolean>(false);
  const [fieldSales, setFieldSales] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<string>('createdAt_desc');
  const [showFilters, setShowFilters] = useState<boolean>(false);

  // Bulk actions state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkExecId, setBulkExecId] = useState<string>('');
  const [bulkAssigning, setBulkAssigning] = useState<boolean>(false);

  const fetchCandidates = async () => {
    setLoading(true);
    try {
      const params: any = {
        page: pagination.page,
        limit: pagination.limit,
        search,
        stage,
        executiveId: onlyMyLeads && user ? user.id : executiveId,
        location,
        source,
        minExp: minExp || undefined,
        hasTwoWheeler: hasTwoWheeler ? 'true' : undefined,
        hasLicense: hasLicense ? 'true' : undefined,
        fieldSales: fieldSales ? 'true' : undefined,
        sortBy,
      };

      const res = await candidatesApi.list(params);
      setCandidates(res.data.candidates);
      setPagination(res.data.pagination);
    } catch (err) {
      console.error('Failed to fetch candidates:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchExecutives = async () => {
    try {
      const res = await authApi.getExecutives();
      setExecutives(res.data.executives);
    } catch (err) {
      console.error('Failed to load executives:', err);
    }
  };

  useEffect(() => {
    fetchExecutives();
  }, []);

  useEffect(() => {
    fetchCandidates();
  }, [pagination.page, pagination.limit, stage, executiveId, location, source, minExp, hasTwoWheeler, hasLicense, fieldSales, sortBy, onlyMyLeads]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination(p => ({ ...p, page: 1 }));
    fetchCandidates();
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === candidates.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(candidates.map(c => c.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleBulkAssign = async () => {
    if (!bulkExecId || selectedIds.size === 0) return;
    setBulkAssigning(true);
    try {
      await assignmentsApi.assignBulk({
        candidateIds: Array.from(selectedIds),
        executiveId: bulkExecId,
      });
      setSelectedIds(new Set());
      setBulkExecId('');
      fetchCandidates();
    } catch (err) {
      console.error('Bulk assign failed:', err);
    } finally {
      setBulkAssigning(false);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in pb-12">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black tracking-tight text-slate-900">
              {onlyMyLeads ? 'My Assigned Leads' : 'Candidate Master Database'}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
              {pagination.total} Candidates
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Central repository with permanent database IDs and immutable calling timeline.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition ${
              showFilters ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filters</span>
          </button>

          <button
            onClick={fetchCandidates}
            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={onOpenAddCandidate}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Candidate</span>
          </button>
        </div>
      </div>

      {/* Search & Quick Controls */}
      <div className="flex flex-col md:flex-row items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by candidate name, phone number, location, candidate ID (e.g. GC-2026-0001)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-24 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-900"
          >
            Search
          </button>
        </form>

        {/* Sort Selector */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <ArrowUpDown className="w-4 h-4 text-slate-400" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700 w-full md:w-auto"
          >
            <option value="createdAt_desc">Newest First</option>
            <option value="createdAt_asc">Oldest First</option>
            <option value="name_asc">Name (A → Z)</option>
            <option value="name_desc">Name (Z → A)</option>
            <option value="priority_desc">Priority Score (High → Low)</option>
            <option value="location_asc">Location (A → Z)</option>
          </select>
        </div>
      </div>

      {/* Advanced Collapsible Filter Panel */}
      {showFilters && (
        <div className="bg-slate-50/90 border border-slate-200 p-4 rounded-2xl grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs animate-scale-in">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Lead Stage</label>
            <select
              value={stage}
              onChange={(e) => { setStage(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
              className="w-full p-2 border border-slate-200 rounded-lg bg-white"
            >
              <option value="ALL">All Stages</option>
              <option value="NEW">New</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="CALLING_IN_PROGRESS">In Progress</option>
              <option value="SHORTLISTED">Shortlisted</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="RNR">RNR</option>
              <option value="NOT_INTERESTED">Not Interested</option>
            </select>
          </div>

          {!onlyMyLeads && (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Assigned Executive</label>
              <select
                value={executiveId}
                onChange={(e) => { setExecutiveId(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
                className="w-full p-2 border border-slate-200 rounded-lg bg-white"
              >
                <option value="ALL">All Executives</option>
                <option value="UNASSIGNED">Unassigned Only</option>
                {executives.map(e => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">City / Location</label>
            <select
              value={location}
              onChange={(e) => { setLocation(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
              className="w-full p-2 border border-slate-200 rounded-lg bg-white"
            >
              <option value="ALL">All Locations</option>
              <option value="New Delhi">New Delhi</option>
              <option value="Noida">Noida</option>
              <option value="Gurugram">Gurugram</option>
              <option value="Mumbai">Mumbai</option>
              <option value="Pune">Pune</option>
              <option value="Bengaluru">Bengaluru</option>
              <option value="Kolkata">Kolkata</option>
              <option value="Rajkot">Rajkot</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Min Experience (Yrs)</label>
            <input
              type="number"
              placeholder="e.g. 1.0"
              value={minExp}
              onChange={(e) => { setMinExp(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
              className="w-full p-2 border border-slate-200 rounded-lg bg-white"
            />
          </div>

          <div className="col-span-2 flex items-center gap-4 pt-4">
            <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
              <input
                type="checkbox"
                checked={hasTwoWheeler}
                onChange={(e) => { setHasTwoWheeler(e.target.checked); setPagination(p => ({ ...p, page: 1 })); }}
                className="rounded text-blue-600"
              />
              <span>Has 2-Wheeler</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
              <input
                type="checkbox"
                checked={hasLicense}
                onChange={(e) => { setHasLicense(e.target.checked); setPagination(p => ({ ...p, page: 1 })); }}
                className="rounded text-blue-600"
              />
              <span>Has License</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
              <input
                type="checkbox"
                checked={fieldSales}
                onChange={(e) => { setFieldSales(e.target.checked); setPagination(p => ({ ...p, page: 1 })); }}
                className="rounded text-blue-600"
              />
              <span>Field Sales</span>
            </label>
          </div>
        </div>
      )}

      {/* Bulk Action Bar (when rows selected) */}
      {selectedIds.size > 0 && user?.role !== 'EXECUTIVE' && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-blue-50 border border-blue-200 rounded-xl animate-scale-in">
          <div className="flex items-center gap-2 text-xs font-bold text-blue-900">
            <span>{selectedIds.size} candidates selected</span>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={bulkExecId}
              onChange={(e) => setBulkExecId(e.target.value)}
              className="px-3 py-1.5 text-xs border border-blue-300 rounded-lg bg-white font-medium"
            >
              <option value="">Select Executive to Assign</option>
              {executives.map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>

            <button
              onClick={handleBulkAssign}
              disabled={!bulkExecId || bulkAssigning}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition disabled:opacity-50"
            >
              {bulkAssigning ? 'Assigning...' : 'Assign Selected'}
            </button>
          </div>
        </div>
      )}

      {/* Main Candidate Master Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px] sticky top-0 z-10">
                <th className="p-3.5 w-10 text-center">
                  <button onClick={toggleSelectAll} className="text-slate-400 hover:text-slate-700">
                    {selectedIds.size === candidates.length && candidates.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="p-3.5 whitespace-nowrap">SL NO & Name</th>
                <th className="p-3.5 whitespace-nowrap">Contact & WhatsApp</th>
                <th className="p-3.5 whitespace-nowrap">Location</th>
                <th className="p-3.5 whitespace-nowrap">Experience & Company</th>
                <th className="p-3.5 whitespace-nowrap">Salary / CTC</th>
                <th className="p-3.5 whitespace-nowrap">Eligibility</th>
                <th className="p-3.5 whitespace-nowrap">Stage</th>
                <th className="p-3.5 whitespace-nowrap">Assigned Exec</th>
                <th className="p-3.5 whitespace-nowrap text-right pr-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="p-12 text-center text-slate-400">
                    Loading candidates...
                  </td>
                </tr>
              ) : candidates.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-12 text-center text-slate-400">
                    No candidates match the selected filters or search query.
                  </td>
                </tr>
              ) : (
                candidates.map((c) => {
                  const isSelected = selectedIds.has(c.id);
                  return (
                    <tr
                      key={c.id}
                      className={`hover:bg-slate-50/80 transition-colors group ${
                        isSelected ? 'bg-blue-50/40' : ''
                      }`}
                    >
                      <td className="p-3.5 text-center">
                        <button onClick={() => toggleSelectOne(c.id)} className="text-slate-400 hover:text-slate-700">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* Name & SL NO (Permanent link) */}
                      <td className="p-3.5">
                        <button
                          onClick={() => onOpenCandidateProfile(c.id)}
                          className="text-left group-hover:text-blue-600 transition"
                        >
                          <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                            <span>{c.name}</span>
                            {c.leadPriorityScore >= 75 && (
                              <Sparkles className="w-3 h-3 text-amber-500 inline" />
                            )}
                          </div>
                          <div className="text-[11px] font-mono text-slate-400">
                            {c.displaySlNo}
                          </div>
                        </button>
                      </td>

                      {/* Phone & WhatsApp */}
                      <td className="p-3.5">
                        <div className="font-mono font-semibold text-slate-800 text-xs">
                          {formatPhone(c.primaryPhone)}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <a
                            href={getWhatsAppUrl(c.primaryPhone, c.name)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] text-emerald-600 hover:underline font-medium flex items-center gap-0.5"
                          >
                            <MessageSquare className="w-2.5 h-2.5" /> WA Chat
                          </a>
                        </div>
                      </td>

                      {/* Location */}
                      <td className="p-3.5 whitespace-nowrap text-slate-700 font-medium">
                        {c.currentLocation || '-'}
                      </td>

                      {/* Experience & Company */}
                      <td className="p-3.5">
                        <div className="font-semibold text-slate-800">{c.totalExperienceYears} Yrs Exp</div>
                        <div className="text-[11px] text-slate-500 truncate max-w-[140px]">
                          {c.currentCompany || c.education || '-'}
                        </div>
                      </td>

                      {/* Salary */}
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="text-slate-700 font-medium">{c.currentSalary || '-'}</div>
                        <div className="text-emerald-700 font-bold text-[11px]">Exp: {c.expectedSalary || '-'}</div>
                      </td>

                      {/* Eligibility */}
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1 text-[11px]">
                          <span className={`px-1.5 py-0.5 rounded font-mono ${c.hasTwoWheeler ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`} title="Two-Wheeler">
                            2W
                          </span>
                          <span className={`px-1.5 py-0.5 rounded font-mono ${c.hasDrivingLicense ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`} title="Driving License">
                            DL
                          </span>
                          <span className={`px-1.5 py-0.5 rounded font-mono ${c.interestedInFieldSales ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-500'}`} title="Field Sales">
                            FS
                          </span>
                        </div>
                      </td>

                      {/* Stage */}
                      <td className="p-3.5 whitespace-nowrap">
                        <StageBadge stage={c.leadStage} />
                      </td>

                      {/* Assigned Executive */}
                      <td className="p-3.5 whitespace-nowrap text-slate-700 font-medium">
                        {c.assignedExecutive ? (
                          <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-800 text-[11px] font-semibold">
                            {c.assignedExecutive.name}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Unassigned</span>
                        )}
                      </td>

                      {/* Actions (Call, Profile) */}
                      <td className="p-3.5 text-right whitespace-nowrap pr-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onStartCall(c)}
                            title="Open in Calling Workspace"
                            className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white transition shadow-sm"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => onOpenCandidateProfile(c.id)}
                            title="View 360 Candidate Profile"
                            className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-blue-600 hover:text-white transition"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 bg-slate-50/50 text-xs text-slate-500">
          <div>
            Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} leads
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPagination(p => ({ ...p, page: Math.max(1, p.page - 1) }))}
              disabled={pagination.page <= 1}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-semibold text-slate-700">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => setPagination(p => ({ ...p, page: Math.min(p.totalPages, p.page + 1) }))}
              disabled={pagination.page >= pagination.totalPages}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
