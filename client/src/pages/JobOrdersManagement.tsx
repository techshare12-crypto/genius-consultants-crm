import React, { useState, useEffect } from 'react';
import { JobOrder, Client, Candidate, CandidateJobApplication } from '../types';
import { jobOrdersApi, clientsApi, candidatesApi, authApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatPhone, formatDate, formatCurrency } from '../utils/helpers';
import { Modal } from '../components/common/Modal';
import {
  Briefcase,
  Plus,
  Search,
  RefreshCw,
  Edit2,
  ExternalLink,
  Building2,
  MapPin,
  Clock,
  Users,
  CheckCircle2,
  Send,
  Calendar,
  ChevronRight,
  TrendingUp,
  Filter,
  Layers,
  FileText,
  Link2,
} from 'lucide-react';

export const JobOrdersManagement: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'ALL_REQUIREMENTS' | 'ACTIVE_VACANCIES' | 'REQUIREMENT_DETAIL'>('ALL_REQUIREMENTS');
  const [jobOrders, setJobOrders] = useState<JobOrder[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [executives, setExecutives] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [selectedClientId, setSelectedClientId] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');

  // Selected Job for Detail & Pipeline View
  const [selectedJob, setSelectedJob] = useState<any | null>(null);

  // Create Job Modal
  const [createJobModalOpen, setCreateJobModalOpen] = useState<boolean>(false);
  const [jobForm, setJobForm] = useState<any>({
    clientId: '',
    jobTitle: '',
    department: 'Sales',
    clientContactPerson: '',
    jobLocation: 'Kalaburagi',
    numberOfVacancies: 5,
    employmentType: 'FULL_TIME',
    jobDescription: '',
    requiredSkills: 'Automobile sales, customer handling, negotiation',
    requiredEducation: 'Graduate / 12th Pass',
    minExperienceYears: 0.5,
    maxExperienceYears: 3.0,
    minSalary: 180000,
    maxSalary: 300000,
    salaryType: 'ANNUAL_CTC',
    incentives: 'Performance based monthly incentives',
    googleFormUrl: 'https://forms.gle/genius-consultants-candidate-form',
    hrContactName: '',
    hrContactPhone: '',
    hrContactWhatsapp: '',
    hrContactEmail: '',
    minAge: 20,
    maxAge: 32,
    genderPreference: 'ANY',
    twoWheelerRequired: true,
    drivingLicenseRequired: true,
    fieldSalesRequired: true,
    automobileExpRequired: false,
    languagesRequired: 'Kannada, Hindi, English',
    priority: 'HIGH',
    targetCandidates: 50,
  });
  const [savingJob, setSavingJob] = useState<boolean>(false);

  // Sourcing: Add Candidates to Job Modal
  const [sourcingModalOpen, setSourcingModalOpen] = useState<boolean>(false);
  const [availableCandidates, setAvailableCandidates] = useState<Candidate[]>([]);
  const [selectedCandIds, setSelectedCandIds] = useState<Set<string>>(new Set());
  const [candSearch, setCandSearch] = useState<string>('');
  const [sourcingExecId, setSourcingExecId] = useState<string>('');
  const [sourcingLoading, setSourcingLoading] = useState<boolean>(false);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [jobsRes, clientsRes, execsRes] = await Promise.all([
        jobOrdersApi.list({
          clientId: selectedClientId !== 'ALL' ? selectedClientId : undefined,
          status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
          priority: selectedPriority !== 'ALL' ? selectedPriority : undefined,
          search: search || undefined,
        }),
        clientsApi.list({ limit: 100 }),
        authApi.getExecutives(),
      ]);

      setJobOrders(jobsRes.data.jobOrders);
      setClients(clientsRes.data.clients);
      setExecutives(execsRes.data.executives);

      if (clientsRes.data.clients.length > 0 && !jobForm.clientId) {
        setJobForm((prev: any) => ({ ...prev, clientId: clientsRes.data.clients[0].id }));
      }
    } catch (err) {
      console.error('Failed to load job requirements:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, [selectedClientId, selectedStatus, selectedPriority, search]);

  const openJobDetail = async (jobId: string) => {
    try {
      const res = await jobOrdersApi.get(jobId);
      setSelectedJob(res.data.jobOrder);
      setActiveTab('REQUIREMENT_DETAIL');
    } catch (err) {
      console.error('Failed to load job detail:', err);
    }
  };

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingJob(true);
    try {
      await jobOrdersApi.create(jobForm);
      setCreateJobModalOpen(false);
      fetchInitialData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create requirement');
    } finally {
      setSavingJob(false);
    }
  };

  const openSourcingModal = async () => {
    if (!selectedJob) return;
    setSourcingLoading(true);
    try {
      const res = await candidatesApi.list({ limit: 50, search: candSearch });
      setAvailableCandidates(res.data.candidates);
      setSelectedCandIds(new Set());
      setSourcingModalOpen(true);
    } catch (err) {
      console.error('Failed to load candidate master:', err);
    } finally {
      setSourcingLoading(false);
    }
  };

  const handleSourcingSubmit = async () => {
    if (!selectedJob || selectedCandIds.size === 0) return;
    setSourcingLoading(true);
    try {
      await jobOrdersApi.addCandidates(selectedJob.id, {
        candidateIds: Array.from(selectedCandIds),
        assignedExecutiveId: sourcingExecId || undefined,
      });
      setSourcingModalOpen(false);
      openJobDetail(selectedJob.id);
      fetchInitialData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to attach candidates');
    } finally {
      setSourcingLoading(false);
    }
  };

  const filteredJobs = jobOrders;

  return (
    <div className="space-y-5 animate-fade-in pb-12 text-xs">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 text-white p-6 rounded-2xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-blue-500/20 text-blue-300 font-semibold text-xs border border-blue-500/30 flex items-center gap-1">
              <Briefcase className="w-3.5 h-3.5" />
              Company Requirements & Vacancies
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Corporate Job Orders Master
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight mt-1">
            Job Requirements & Vacancies
          </h1>
          <p className="text-xs text-slate-300 mt-0.5">
            Manage company openings, eligibility criteria, Google Form URLs, and HR contact points.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCreateJobModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>+ New Job Requirement</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('ALL_REQUIREMENTS')}
          className={`px-4 py-2 rounded-xl font-bold transition text-xs ${
            activeTab === 'ALL_REQUIREMENTS'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          All Requirements ({jobOrders.length})
        </button>

        <button
          onClick={() => setActiveTab('ACTIVE_VACANCIES')}
          className={`px-4 py-2 rounded-xl font-bold transition text-xs ${
            activeTab === 'ACTIVE_VACANCIES'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Active Openings ({jobOrders.filter((j) => j.status === 'OPEN').length})
        </button>

        {selectedJob && (
          <button
            onClick={() => setActiveTab('REQUIREMENT_DETAIL')}
            className={`px-4 py-2 rounded-xl font-bold transition text-xs ${
              activeTab === 'REQUIREMENT_DETAIL'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Requirement Detail ({selectedJob.jobTitle})
          </button>
        )}
      </div>

      {/* TAB 1: ALL / ACTIVE REQUIREMENTS LIST */}
      {(activeTab === 'ALL_REQUIREMENTS' || activeTab === 'ACTIVE_VACANCIES') && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search job title, location, skills, or company..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-xl"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="p-2 border border-slate-200 rounded-xl bg-white font-semibold text-slate-700"
              >
                <option value="ALL">All Companies</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.companyName}</option>
                ))}
              </select>

              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
                className="p-2 border border-slate-200 rounded-xl bg-white font-semibold text-slate-700"
              >
                <option value="ALL">All Priorities</option>
                <option value="HIGH">High Priority</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
          </div>

          {/* Grid of Job Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredJobs
              .filter((j) => (activeTab === 'ACTIVE_VACANCIES' ? j.status === 'OPEN' : true))
              .map((job) => (
                <div
                  key={job.id}
                  onClick={() => openJobDetail(job.id)}
                  className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md hover:border-blue-300 transition cursor-pointer space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] text-slate-400">{job.displayJobId}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${job.status === 'OPEN' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>
                        {job.status}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-black text-slate-900 text-sm">{job.jobTitle}</h3>
                      <div className="text-slate-600 text-xs font-semibold flex items-center gap-1 mt-0.5">
                        <Building2 className="w-3.5 h-3.5 text-blue-600" />
                        <span>{job.client?.companyName || 'Corporate Client'}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 pt-1">
                      <div>
                        <span className="text-slate-400">Location:</span> <strong className="text-slate-700">{job.jobLocation}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400">Vacancies:</span> <strong className="text-blue-700">{job.numberOfVacancies} Positions</strong>
                      </div>
                      <div>
                        <span className="text-slate-400">Salary:</span> <strong className="text-slate-700">₹{job.minSalary ? (job.minSalary/100000).toFixed(1) : '1.8'}L - {job.maxSalary ? (job.maxSalary/100000).toFixed(1) : '3.0'}L</strong>
                      </div>
                      <div>
                        <span className="text-slate-400">Exp:</span> <strong className="text-slate-700">{job.minExperienceYears}-{job.maxExperienceYears} Yrs</strong>
                      </div>
                    </div>

                    {/* Eligibility Tags */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {job.twoWheelerRequired && (
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 text-[10px] font-semibold border border-emerald-200">
                          Two-Wheeler
                        </span>
                      )}
                      {job.drivingLicenseRequired && (
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 text-[10px] font-semibold border border-blue-200">
                          DL Required
                        </span>
                      )}
                      {job.fieldSalesRequired && (
                        <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-800 text-[10px] font-semibold border border-purple-200">
                          Field Sales
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Google Form configured</span>
                    <span className="font-bold text-blue-600 flex items-center gap-1">
                      View Details <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* TAB 2: REQUIREMENT DETAIL */}
      {activeTab === 'REQUIREMENT_DETAIL' && selectedJob && (
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-slate-400">{selectedJob.displayJobId}</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs">
                    {selectedJob.status}
                  </span>
                </div>
                <h2 className="text-xl font-black text-slate-900 mt-1">{selectedJob.jobTitle}</h2>
                <div className="text-sm font-semibold text-slate-600 flex items-center gap-1.5 mt-0.5">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <span>{selectedJob.client?.companyName} • {selectedJob.jobLocation}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={openSourcingModal}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow transition"
                >
                  <Users className="w-4 h-4" />
                  <span>+ Attach Candidates</span>
                </button>
              </div>
            </div>

            {/* Google Form & HR Contacts Strip */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="space-y-1">
                <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <Link2 className="w-4 h-4 text-blue-600" />
                  Google Form URL for Candidates:
                </span>
                <div className="font-mono text-xs text-blue-700 bg-white p-2 rounded-xl border border-slate-200 truncate">
                  {selectedJob.googleFormUrl || 'https://forms.gle/genius-consultants-candidate-form'}
                </div>
              </div>

              <div className="space-y-1">
                <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-purple-600" />
                  Company HR Contact Details:
                </span>
                <div className="text-xs text-slate-600 bg-white p-2 rounded-xl border border-slate-200">
                  <strong>{selectedJob.hrContactName || selectedJob.client?.contactPersonName || 'HR Manager'}</strong> • {selectedJob.hrContactPhone || selectedJob.client?.mobileNumber || 'N/A'} • {selectedJob.hrContactEmail || selectedJob.client?.email || 'N/A'}
                </div>
              </div>
            </div>

            {/* Attached Candidates List */}
            <div className="space-y-2 pt-2">
              <h3 className="font-bold text-slate-900 text-sm">
                Candidates Attached to this Requirement ({selectedJob.applications?.length || 0})
              </h3>

              {selectedJob.applications?.length === 0 ? (
                <div className="py-8 text-center text-slate-400">
                  No candidates attached yet. Click "+ Attach Candidates" to source from Candidate Master.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-700 font-bold border-b">
                      <tr>
                        <th className="p-3">Candidate</th>
                        <th className="p-3">Phone</th>
                        <th className="p-3">Assigned Executive</th>
                        <th className="p-3">Operations Stage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedJob.applications.map((app: any) => (
                        <tr key={app.id} className="hover:bg-slate-50">
                          <td className="p-3 font-bold text-slate-900">{app.candidate?.name}</td>
                          <td className="p-3 font-mono text-slate-600">{formatPhone(app.candidate?.primaryPhone)}</td>
                          <td className="p-3 text-slate-600">{app.assignedExecutive?.name || 'Unassigned'}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 font-bold text-[10px]">
                              {app.applicationStage}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Job Requirement Modal */}
      <Modal
        isOpen={createJobModalOpen}
        onClose={() => setCreateJobModalOpen(false)}
        maxWidth="lg"
        title="Create New Company Job Requirement"
      >
        <form onSubmit={handleCreateJob} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Corporate Client *</label>
              <select
                required
                value={jobForm.clientId}
                onChange={(e) => setJobForm({ ...jobForm, clientId: e.target.value })}
                className="w-full p-2.5 border rounded-xl bg-white font-semibold"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.companyName} ({c.city || 'India'})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Job Title *</label>
              <input
                type="text"
                required
                placeholder="e.g. Showroom Sales Executive"
                value={jobForm.jobTitle}
                onChange={(e) => setJobForm({ ...jobForm, jobTitle: e.target.value })}
                className="w-full p-2.5 border rounded-xl"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Job Location *</label>
              <input
                type="text"
                required
                placeholder="e.g. Kalaburagi"
                value={jobForm.jobLocation}
                onChange={(e) => setJobForm({ ...jobForm, jobLocation: e.target.value })}
                className="w-full p-2.5 border rounded-xl"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Number of Vacancies *</label>
              <input
                type="number"
                min="1"
                required
                value={jobForm.numberOfVacancies}
                onChange={(e) => setJobForm({ ...jobForm, numberOfVacancies: parseInt(e.target.value) || 1 })}
                className="w-full p-2.5 border rounded-xl font-bold"
              />
            </div>
          </div>

          {/* Google Form Link */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Google Form URL for Shortlisted Candidates *</label>
            <input
              type="url"
              required
              placeholder="https://forms.gle/..."
              value={jobForm.googleFormUrl}
              onChange={(e) => setJobForm({ ...jobForm, googleFormUrl: e.target.value })}
              className="w-full p-2.5 border rounded-xl font-mono text-blue-700"
            />
          </div>

          {/* HR Contact Details */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
            <span className="font-bold text-slate-800 block">Company HR Contact for Submissions</span>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-medium text-slate-600 mb-1">HR Contact Name</label>
                <input
                  type="text"
                  placeholder="e.g. Mr. Ramesh Sharma"
                  value={jobForm.hrContactName}
                  onChange={(e) => setJobForm({ ...jobForm, hrContactName: e.target.value })}
                  className="w-full p-2 border rounded-xl bg-white"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-600 mb-1">HR WhatsApp/Phone</label>
                <input
                  type="text"
                  placeholder="+91 98765 43210"
                  value={jobForm.hrContactPhone}
                  onChange={(e) => setJobForm({ ...jobForm, hrContactPhone: e.target.value })}
                  className="w-full p-2 border rounded-xl bg-white font-mono"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-600 mb-1">HR Email</label>
                <input
                  type="email"
                  placeholder="hr@company.com"
                  value={jobForm.hrContactEmail}
                  onChange={(e) => setJobForm({ ...jobForm, hrContactEmail: e.target.value })}
                  className="w-full p-2 border rounded-xl bg-white"
                />
              </div>
            </div>
          </div>

          {/* Eligibility Criteria */}
          <div className="grid grid-cols-3 gap-3">
            <label className="flex items-center gap-2 p-2 border rounded-xl bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                checked={jobForm.twoWheelerRequired}
                onChange={(e) => setJobForm({ ...jobForm, twoWheelerRequired: e.target.checked })}
              />
              <span className="font-bold text-slate-700">Two-Wheeler Required</span>
            </label>

            <label className="flex items-center gap-2 p-2 border rounded-xl bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                checked={jobForm.drivingLicenseRequired}
                onChange={(e) => setJobForm({ ...jobForm, drivingLicenseRequired: e.target.checked })}
              />
              <span className="font-bold text-slate-700">DL Required</span>
            </label>

            <label className="flex items-center gap-2 p-2 border rounded-xl bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                checked={jobForm.fieldSalesRequired}
                onChange={(e) => setJobForm({ ...jobForm, fieldSalesRequired: e.target.checked })}
              />
              <span className="font-bold text-slate-700">Field Sales</span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              onClick={() => setCreateJobModalOpen(false)}
              className="px-4 py-2 border rounded-xl text-slate-600 hover:bg-slate-50 font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingJob}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow transition"
            >
              {savingJob ? 'Saving...' : 'Save Job Requirement'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Sourcing Modal */}
      <Modal
        isOpen={sourcingModalOpen}
        onClose={() => setSourcingModalOpen(false)}
        maxWidth="lg"
        title="Attach Candidates to Job Requirement"
      >
        <div className="space-y-4 text-xs">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search candidate by name, phone, or location..."
              value={candSearch}
              onChange={(e) => setCandSearch(e.target.value)}
              className="w-full p-2 border rounded-xl"
            />
          </div>

          <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 border rounded-xl">
            {availableCandidates.map((c) => {
              const isSelected = selectedCandIds.has(c.id);
              return (
                <div
                  key={c.id}
                  onClick={() => {
                    const next = new Set(selectedCandIds);
                    if (isSelected) next.delete(c.id);
                    else next.add(c.id);
                    setSelectedCandIds(next);
                  }}
                  className={`p-3 flex items-center justify-between cursor-pointer transition ${
                    isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <div className="font-bold text-slate-900">{c.name}</div>
                    <div className="text-slate-500 font-mono text-[11px]">{formatPhone(c.primaryPhone)} • {c.currentLocation}</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-3 border-t">
            <span className="font-bold text-slate-700">{selectedCandIds.size} Candidates Selected</span>
            <button
              type="button"
              onClick={handleSourcingSubmit}
              disabled={selectedCandIds.size === 0 || sourcingLoading}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow disabled:opacity-50"
            >
              {sourcingLoading ? 'Attaching...' : 'Attach to Requirement'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
