'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/common/Badge';
import { Modal } from '@/components/common/Modal';
import {
  Briefcase,
  Plus,
  Search,
  Building2,
  MapPin,
  Users,
  Bike,
  CreditCard,
  Banknote,
  AlertCircle,
  Trash2,
} from 'lucide-react';

interface JobLocationInput {
  city: string;
  vacancies: number;
}

const initialJobState = {
  companyId: '',
  jobTitle: '',
  department: 'Field Sales',
  vacancies: 10,
  locations: [{ city: 'Kalaburagi', vacancies: 10 }] as JobLocationInput[],
  salaryMin: 18000,
  salaryMax: 25000,
  salaryText: '18,000 - 25,000 + Fuel Allowance',
  experienceMin: 0,
  experienceMax: 4,
  educationRequirement: 'Graduate (Any stream)',
  twoWheelerRequired: true,
  drivingLicenseRequired: true,
  skillsRequired: 'Field Sales, Counter Sales, Communication',
};

export default function JobRequirementsPage() {
  const { hasPermission } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Add Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newJob, setNewJob] = useState(initialJobState);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    fetchJobs();
    fetchCompanies();
  }, []);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/jobs');
      if (res.ok) {
        const d = await res.json();
        setJobs(d.data || []);
      }
    } catch (err) {
      console.error('Error fetching jobs', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanies = async () => {
    try {
      const res = await fetch('/api/companies');
      if (res.ok) {
        const d = await res.json();
        setCompanies(d.data || []);
      }
    } catch (err) {
      console.error('Error fetching companies', err);
    }
  };

  const handleVacanciesChange = (totalVac: number) => {
    setNewJob((prev) => {
      // If single location exists, auto-sync its vacancies to total vacancies
      if (prev.locations.length === 1) {
        return {
          ...prev,
          vacancies: totalVac,
          locations: [{ ...prev.locations[0], vacancies: totalVac }],
        };
      }
      return { ...prev, vacancies: totalVac };
    });
  };

  const handleAddLocation = () => {
    setNewJob((prev) => {
      const allocated = prev.locations.reduce((acc, l) => acc + (Number(l.vacancies) || 0), 0);
      const remaining = Math.max(1, prev.vacancies - allocated);
      return {
        ...prev,
        locations: [...prev.locations, { city: '', vacancies: remaining }],
      };
    });
  };

  const handleRemoveLocation = (index: number) => {
    setNewJob((prev) => {
      const updated = prev.locations.filter((_, i) => i !== index);
      if (updated.length === 1) {
        updated[0] = { ...updated[0], vacancies: prev.vacancies };
      }
      return { ...prev, locations: updated };
    });
  };

  const handleLocationChange = (index: number, field: 'city' | 'vacancies', value: any) => {
    setNewJob((prev) => {
      const updated = [...prev.locations];
      updated[index] = {
        ...updated[index],
        [field]: field === 'vacancies' ? (value === '' ? '' : Number(value)) : value,
      };
      return { ...prev, locations: updated };
    });
  };

  const totalAllocated = newJob.locations.reduce((acc, l) => acc + (Number(l.vacancies) || 0), 0);
  const isAllocationMatching = totalAllocated === Number(newJob.vacancies);
  const hasEmptyCity = newJob.locations.some((l) => !l.city || !l.city.trim());
  const hasInvalidVacancy = newJob.locations.some((l) => !l.vacancies || Number(l.vacancies) < 1);

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJob.companyId) {
      setFormError('Please select a client company.');
      return;
    }

    if (newJob.locations.length === 0) {
      setFormError('At least one location is required.');
      return;
    }

    if (hasEmptyCity) {
      setFormError('All location city fields must be filled.');
      return;
    }

    if (hasInvalidVacancy) {
      setFormError('Every location must have at least 1 vacancy.');
      return;
    }

    if (!isAllocationMatching) {
      setFormError(
        `Location vacancy allocation must equal total vacancies. Allocated: ${totalAllocated} / ${newJob.vacancies}.`
      );
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const locSummary = newJob.locations
        .map((l) => l.city.trim())
        .filter(Boolean)
        .join(', ');

      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: newJob.companyId,
          jobTitle: newJob.jobTitle,
          department: newJob.department,
          vacancies: Number(newJob.vacancies),
          location: locSummary || 'N/A',
          locations: newJob.locations.map((l) => ({
            city: l.city.trim(),
            vacancies: Number(l.vacancies),
          })),
          salaryMin: Number(newJob.salaryMin),
          salaryMax: Number(newJob.salaryMax),
          salaryText: newJob.salaryText,
          experienceMin: Number(newJob.experienceMin),
          experienceMax: Number(newJob.experienceMax),
          educationRequirement: newJob.educationRequirement,
          twoWheelerRequired: newJob.twoWheelerRequired,
          drivingLicenseRequired: newJob.drivingLicenseRequired,
          skillsRequired: newJob.skillsRequired
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });

      if (res.ok) {
        setShowAddModal(false);
        setNewJob(initialJobState);
        setFormError(null);
        await fetchJobs();
      } else {
        const d = await res.json().catch(() => ({}));
        setFormError(d.error || 'Unable to create job requirement. Please check the details and try again.');
      }
    } catch (err: any) {
      console.error('Error creating job', err);
      setFormError('Network error. Unable to reach the server. Please try again.');
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
            RECRUITMENT MANDATES
          </span>
          <h2 className="text-lg font-bold text-slate-900 mt-0.5">Job Requirements Master</h2>
          <p className="text-xs text-slate-500">
            Active client hiring openings, salary structures, eligibility criteria, and candidate applications.
          </p>
        </div>

        {hasPermission('job.manage') && (
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Post Job Requirement</span>
          </button>
        )}
      </div>

      {/* Jobs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {jobs.map((job) => (
          <div
            key={job.id}
            className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow transition-shadow flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-mono text-[10px] text-slate-400 font-bold">{job.jobCode}</span>
                  <h3 className="text-base font-bold text-slate-900 mt-0.5">{job.jobTitle}</h3>
                  <p className="text-xs font-semibold text-teal-700 flex items-center gap-1 mt-0.5">
                    <Building2 className="w-3.5 h-3.5 text-teal-600" />
                    <span>{job.company?.companyName}</span>
                  </p>
                </div>
                <Badge variant={job.jobStatus === 'OPEN' ? 'success' : 'neutral'}>{job.jobStatus}</Badge>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-xs">
                <div className="flex items-start justify-between text-slate-600 gap-2">
                  <span className="text-slate-400 flex items-center gap-1 shrink-0 mt-0.5">
                    <MapPin className="w-3.5 h-3.5" />
                    Locations:
                  </span>
                  <div className="text-right">
                    {job.locations && job.locations.length > 0 ? (
                      <div className="flex flex-wrap justify-end gap-1">
                        {job.locations.map((loc: any) => (
                          <span
                            key={loc.id}
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-800 border border-slate-200"
                          >
                            {loc.city} {loc.vacancies > 1 ? `(${loc.vacancies})` : ''}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="font-semibold text-slate-800">{job.location}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-slate-600">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    Vacancies:
                  </span>
                  <span className="font-bold text-slate-900">{job.vacancies} Openings</span>
                </div>

                <div className="flex items-center justify-between text-slate-600">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Banknote className="w-3.5 h-3.5" />
                    Salary:
                  </span>
                  <span className="font-semibold text-slate-800">{job.salaryText || 'As per norms'}</span>
                </div>

                <div className="flex items-center justify-between text-slate-600">
                  <span className="text-slate-400">Two-Wheeler:</span>
                  <span className="font-semibold text-emerald-700">
                    {job.twoWheelerRequired ? 'Mandatory Bike ✅' : 'Not Mandatory'}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">
                {job._count?.applications || 0} Total Applied
              </span>
              <span className="text-teal-600 font-semibold">{job._count?.submissions || 0} Sent to HR</span>
            </div>
          </div>
        ))}
      </div>

      {/* Add Job Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          if (!submitting) {
            setShowAddModal(false);
            setFormError(null);
          }
        }}
        title="Create Job Requirement Mandate"
        subtitle="Specify client company, vacancies, locations, and candidate eligibility criteria"
      >
        <form onSubmit={handleCreateJob} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-start gap-2 animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Unable to create job requirement</p>
                <p className="text-[11px] mt-0.5 text-rose-600">{formError}</p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Client Company *</label>
            <select
              required
              value={newJob.companyId}
              onChange={(e) => {
                setNewJob({ ...newJob, companyId: e.target.value });
                if (formError) setFormError(null);
              }}
              className="w-full p-2 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
            >
              <option value="">Select Company...</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.companyName} ({c.city})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Job Title *</label>
              <input
                type="text"
                required
                value={newJob.jobTitle}
                onChange={(e) => {
                  setNewJob({ ...newJob, jobTitle: e.target.value });
                  if (formError) setFormError(null);
                }}
                placeholder="e.g. Sales Executive"
                className="w-full p-2 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Total Vacancies *</label>
              <input
                type="number"
                min="1"
                required
                value={newJob.vacancies}
                onChange={(e) => {
                  handleVacanciesChange(Math.max(1, Number(e.target.value) || 1));
                  if (formError) setFormError(null);
                }}
                className="w-full p-2 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-teal-500 focus:border-teal-500 font-bold"
              />
            </div>
          </div>

          {/* Structured Multi-Location & Vacancy Section */}
          <div className="space-y-2 border border-slate-200 rounded-lg p-3 bg-slate-50/70">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-teal-600" />
                Job Locations & Vacancies
              </label>
              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                  isAllocationMatching && !hasEmptyCity && !hasInvalidVacancy
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-amber-100 text-amber-800 border border-amber-300'
                }`}
              >
                Allocated: {totalAllocated} / {newJob.vacancies} {isAllocationMatching ? '✓' : '⚠️'}
              </span>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {newJob.locations.map((loc, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                  <div className="flex-1">
                    <input
                      type="text"
                      required
                      placeholder="City (e.g. Kalaburagi)"
                      value={loc.city}
                      onChange={(e) => {
                        handleLocationChange(idx, 'city', e.target.value);
                        if (formError) setFormError(null);
                      }}
                      className="w-full p-1.5 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                    />
                  </div>
                  <div className="w-28 flex items-center gap-1">
                    <span className="text-[11px] text-slate-400 font-medium">Vac:</span>
                    <input
                      type="number"
                      min="1"
                      required
                      value={loc.vacancies}
                      onChange={(e) => {
                        handleLocationChange(idx, 'vacancies', e.target.value);
                        if (formError) setFormError(null);
                      }}
                      className="w-full p-1.5 border border-slate-200 rounded text-xs text-center font-bold focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                    />
                  </div>
                  {newJob.locations.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        handleRemoveLocation(idx);
                        if (formError) setFormError(null);
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                      title="Remove location"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => {
                  handleAddLocation();
                  if (formError) setFormError(null);
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-teal-600 hover:text-teal-800 py-1 px-2 hover:bg-teal-50 rounded transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Location</span>
              </button>
              {!isAllocationMatching && (
                <span className="text-[11px] text-amber-700 font-medium">
                  Sum of location vacancies must equal {newJob.vacancies}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
              <input
                type="text"
                value={newJob.department}
                onChange={(e) => setNewJob({ ...newJob, department: e.target.value })}
                placeholder="e.g. Field Sales"
                className="w-full p-2 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Salary Text Bracket</label>
              <input
                type="text"
                value={newJob.salaryText}
                onChange={(e) => setNewJob({ ...newJob, salaryText: e.target.value })}
                placeholder="e.g. 18,000 - 25,000 + Fuel"
                className="w-full p-2 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
          </div>

          <div className="flex gap-4 pt-1">
            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={newJob.twoWheelerRequired}
                onChange={(e) => setNewJob({ ...newJob, twoWheelerRequired: e.target.checked })}
                className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              <span>Bike Mandatory</span>
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={newJob.drivingLicenseRequired}
                onChange={(e) => setNewJob({ ...newJob, drivingLicenseRequired: e.target.checked })}
                className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              <span>Driving License Mandatory</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                setShowAddModal(false);
                setFormError(null);
              }}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !isAllocationMatching || hasEmptyCity || hasInvalidVacancy}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5 shadow-sm transition-colors"
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Job Requirement</span>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
