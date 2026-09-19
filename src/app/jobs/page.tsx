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
} from 'lucide-react';

export default function JobRequirementsPage() {
  const { hasPermission } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Add Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newJob, setNewJob] = useState({
    companyId: '',
    jobTitle: '',
    department: 'Field Sales',
    vacancies: 10,
    location: 'Rajkot, Gujarat',
    salaryMin: 18000,
    salaryMax: 25000,
    salaryText: '18,000 - 25,000 + Fuel Allowance',
    experienceMin: 0,
    experienceMax: 4,
    educationRequirement: 'Graduate (Any stream)',
    twoWheelerRequired: true,
    drivingLicenseRequired: true,
    skillsRequired: 'Field Sales, Counter Sales, Communication',
  });
  const [submitting, setSubmitting] = useState(false);

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

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJob.companyId) return;
    setSubmitting(true);

    try {
      const locList = newJob.location
        .split(',')
        .map((l) => l.trim())
        .filter(Boolean);

      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newJob,
          location: locList.join(', '),
          locations: locList.map((city) => ({ city, vacancies: 1 })),
          vacancies: Number(newJob.vacancies),
          salaryMin: Number(newJob.salaryMin),
          salaryMax: Number(newJob.salaryMax),
          experienceMin: Number(newJob.experienceMin),
          experienceMax: Number(newJob.experienceMax),
          skillsRequired: newJob.skillsRequired.split(',').map((s) => s.trim()).filter(Boolean),
        }),
      });

      if (res.ok) {
        setShowAddModal(false);
        await fetchJobs();
      }
    } catch (err) {
      console.error('Error creating job', err);
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
        onClose={() => setShowAddModal(false)}
        title="Create Job Requirement Mandate"
        subtitle="Specify client company, vacancies, and candidate criteria"
      >
        <form onSubmit={handleCreateJob} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Client Company</label>
            <select
              required
              value={newJob.companyId}
              onChange={(e) => setNewJob({ ...newJob, companyId: e.target.value })}
              className="w-full p-2 border border-slate-200 rounded-lg text-xs"
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">Job Title</label>
              <input
                type="text"
                required
                value={newJob.jobTitle}
                onChange={(e) => setNewJob({ ...newJob, jobTitle: e.target.value })}
                placeholder="e.g. Sales Executive - Rajkot"
                className="w-full p-2 border border-slate-200 rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Vacancies</label>
              <input
                type="number"
                min="1"
                required
                value={newJob.vacancies}
                onChange={(e) => setNewJob({ ...newJob, vacancies: Number(e.target.value) })}
                className="w-full p-2 border border-slate-200 rounded-lg text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Location</label>
              <input
                type="text"
                required
                value={newJob.location}
                onChange={(e) => setNewJob({ ...newJob, location: e.target.value })}
                placeholder="e.g. Rajkot, Gujarat"
                className="w-full p-2 border border-slate-200 rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Salary Text Bracket</label>
              <input
                type="text"
                value={newJob.salaryText}
                onChange={(e) => setNewJob({ ...newJob, salaryText: e.target.value })}
                placeholder="e.g. 18,000 - 25,000 + Fuel"
                className="w-full p-2 border border-slate-200 rounded-lg text-xs"
              />
            </div>
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={newJob.twoWheelerRequired}
                onChange={(e) => setNewJob({ ...newJob, twoWheelerRequired: e.target.checked })}
              />
              <span>Bike Mandatory</span>
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={newJob.drivingLicenseRequired}
                onChange={(e) => setNewJob({ ...newJob, drivingLicenseRequired: e.target.checked })}
              />
              <span>Driving License Mandatory</span>
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
              Save Job Requirement
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
