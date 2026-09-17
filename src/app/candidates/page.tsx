'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Badge, StageBadge } from '@/components/common/Badge';
import { Modal } from '@/components/common/Modal';
import {
  Users,
  Search,
  Plus,
  Bike,
  CreditCard,
  Building2,
  Briefcase,
  Phone,
  Mail,
  MapPin,
  AlertCircle,
  Clock,
  Eye,
} from 'lucide-react';

export default function CandidateMasterPage() {
  const { hasPermission } = useAuth();
  const [candidates, setCandidates] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Profile Modal
  const [selectedCandidate, setSelectedCandidate] = useState<any | null>(null);

  // Create Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCandidate, setNewCandidate] = useState({
    fullName: '',
    phone: '',
    email: '',
    currentLocation: '',
    education: 'Graduate',
    experienceYears: 0,
    currentJob: '',
    currentSalary: '',
    expectedSalary: '',
    hasTwoWheeler: true,
    hasDrivingLicense: true,
    skills: 'Sales, Communication',
  });
  const [addError, setAddError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCandidates();
  }, [search, page]);

  const fetchCandidates = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/candidates?page=${page}&limit=20&search=${encodeURIComponent(search)}`);
      if (res.ok) {
        const d = await res.json();
        setCandidates(d.data || []);
        setTotalPages(d.pagination?.totalPages || 1);
      }
    } catch (err) {
      console.error('Error fetching candidates', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newCandidate,
          experienceYears: Number(newCandidate.experienceYears),
          currentSalary: newCandidate.currentSalary ? Number(newCandidate.currentSalary) : null,
          expectedSalary: newCandidate.expectedSalary ? Number(newCandidate.expectedSalary) : null,
          skills: newCandidate.skills.split(',').map((s) => s.trim()).filter(Boolean),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setAddError(data.message || data.error || 'Failed to create candidate');
        setSubmitting(false);
        return;
      }

      setShowAddModal(false);
      await fetchCandidates();
    } catch (err: any) {
      setAddError('Connection error creating candidate');
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
            PERMANENT TALENT DATABASE
          </span>
          <h2 className="text-lg font-bold text-slate-900 mt-0.5">Candidate Master Records</h2>
          <p className="text-xs text-slate-500">
            Decoupled individual master profiles with duplicate detection and cross-job application history.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by name, phone, email, ID..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {hasPermission('candidate.manage') && (
            <button
              onClick={() => setShowAddModal(true)}
              className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Candidate</span>
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Candidate Code & Name</th>
                <th className="py-3 px-4">Phone & Email</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4">Experience & Current Role</th>
                <th className="py-3 px-4">Assets</th>
                <th className="py-3 px-4">Active Applications</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {candidates.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No candidates found.
                  </td>
                </tr>
              ) : (
                candidates.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{c.fullName}</div>
                      <div className="font-mono text-[11px] text-slate-400">{c.candidateCode}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-mono font-semibold text-teal-700">{c.normalizedPhone}</div>
                      <div className="text-[11px] text-slate-400">{c.email || '-'}</div>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-700">{c.currentLocation || 'N/A'}</td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">{c.experienceYears} Years Exp</div>
                      <div className="text-[11px] text-slate-500 truncate max-w-xs">{c.currentJob || c.education}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-1.5">
                        {c.hasTwoWheeler && (
                          <span className="p-1 bg-emerald-50 text-emerald-700 rounded border border-emerald-200" title="Has 2-Wheeler">
                            <Bike className="w-3.5 h-3.5" />
                          </span>
                        )}
                        {c.hasDrivingLicense && (
                          <span className="p-1 bg-sky-50 text-sky-700 rounded border border-sky-200" title="Has Driving License">
                            <CreditCard className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-1">
                        {c.applications?.map((app: any) => (
                          <div key={app.id} className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-800">{app.job?.jobTitle}</span>
                            <StageBadge stage={app.currentStage} />
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedCandidate(c)}
                        className="px-2.5 py-1 text-slate-600 hover:text-teal-700 hover:bg-teal-50 rounded-lg text-xs font-medium border border-slate-200 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5 inline mr-1" />
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1 bg-white border border-slate-200 rounded disabled:opacity-50"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 bg-white border border-slate-200 rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Candidate Profile Modal */}
      <Modal
        isOpen={!!selectedCandidate}
        onClose={() => setSelectedCandidate(null)}
        title={selectedCandidate?.fullName || 'Candidate Profile'}
        subtitle={`Candidate Code: ${selectedCandidate?.candidateCode}`}
        maxWidth="2xl"
      >
        {selectedCandidate && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div>
                <span className="text-slate-400 block text-[11px]">Primary Phone</span>
                <span className="font-mono font-bold text-teal-700 text-sm">{selectedCandidate.normalizedPhone}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Email</span>
                <span className="font-medium text-slate-800">{selectedCandidate.email || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Current Location</span>
                <span className="font-medium text-slate-800">{selectedCandidate.currentLocation || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Education</span>
                <span className="font-medium text-slate-800">{selectedCandidate.education || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Experience</span>
                <span className="font-medium text-slate-800">{selectedCandidate.experienceYears} Years</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Vehicles & DL</span>
                <span className="font-medium text-slate-800">
                  {selectedCandidate.hasTwoWheeler ? 'Bike ✅' : 'No Bike ❌'} |{' '}
                  {selectedCandidate.hasDrivingLicense ? 'DL ✅' : 'No DL ❌'}
                </span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                Application History across Clients
              </h4>
              <div className="space-y-2">
                {selectedCandidate.applications?.map((app: any) => (
                  <div key={app.id} className="p-3 bg-white rounded-lg border border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 text-xs">{app.job?.jobTitle}</div>
                      <div className="text-[11px] text-slate-500">
                        Assigned to: {app.assignedExecutive?.fullName || 'Unassigned'}
                      </div>
                    </div>
                    <StageBadge stage={app.currentStage} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Add Candidate Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Permanent Candidate Master"
        subtitle="Create candidate profile with phone duplicate verification"
      >
        <form onSubmit={handleCreateCandidate} className="space-y-4">
          {addError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{addError}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={newCandidate.fullName}
                onChange={(e) => setNewCandidate({ ...newCandidate, fullName: e.target.value })}
                className="w-full p-2 border border-slate-200 rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
              <input
                type="tel"
                required
                value={newCandidate.phone}
                onChange={(e) => setNewCandidate({ ...newCandidate, phone: e.target.value })}
                placeholder="10-digit mobile"
                className="w-full p-2 border border-slate-200 rounded-lg text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Current Location</label>
              <input
                type="text"
                value={newCandidate.currentLocation}
                onChange={(e) => setNewCandidate({ ...newCandidate, currentLocation: e.target.value })}
                placeholder="e.g. Rajkot, Gujarat"
                className="w-full p-2 border border-slate-200 rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Experience (Years)</label>
              <input
                type="number"
                min="0"
                value={newCandidate.experienceYears}
                onChange={(e) => setNewCandidate({ ...newCandidate, experienceYears: Number(e.target.value) })}
                className="w-full p-2 border border-slate-200 rounded-lg text-xs"
              />
            </div>
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={newCandidate.hasTwoWheeler}
                onChange={(e) => setNewCandidate({ ...newCandidate, hasTwoWheeler: e.target.checked })}
              />
              <span>Has 2-Wheeler / Bike</span>
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={newCandidate.hasDrivingLicense}
                onChange={(e) => setNewCandidate({ ...newCandidate, hasDrivingLicense: e.target.checked })}
              />
              <span>Has Driving License</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
            >
              Save Candidate
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
