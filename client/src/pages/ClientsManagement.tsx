import React, { useState, useEffect } from 'react';
import { Client } from '../types';
import { clientsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatPhone, formatDate, formatCurrency } from '../utils/helpers';
import { Modal } from '../components/common/Modal';
import {
  Building2,
  Plus,
  Search,
  RefreshCw,
  Edit2,
  ExternalLink,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  Users,
  CheckCircle2,
  Globe,
  Award,
  DollarSign,
  Clock,
} from 'lucide-react';

export const ClientsManagement: React.FC = () => {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [industryFilter, setIndustryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [profileModalClient, setProfileModalClient] = useState<any>(null);

  // Form State
  const [formData, setFormData] = useState<any>({
    companyName: '',
    industry: 'Automobile',
    companyWebsite: '',
    companyAddress: '',
    city: 'New Delhi',
    state: 'Delhi NCR',
    contactPersonName: '',
    designation: 'HR Manager',
    mobileNumber: '',
    whatsappNumber: '',
    email: '',
    secondaryContactPerson: '',
    secondaryContactNumber: '',
    hrContact: '',
    recruitmentFeeType: 'PERCENTAGE',
    feeAmountOrPercent: 8.33,
    paymentTerms: '30 Days from Date of Joining',
    replacementPeriodDays: 90,
    status: 'ACTIVE',
  });
  const [savingClient, setSavingClient] = useState<boolean>(false);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const res = await clientsApi.list({
        industry: industryFilter,
        status: statusFilter,
        search,
      });
      setClients(res.data.clients);
    } catch (err) {
      console.error('Failed to load clients:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, [industryFilter, statusFilter, search]);

  const handleOpenCreate = () => {
    setFormData({
      companyName: '',
      industry: 'Automobile',
      companyWebsite: '',
      companyAddress: '',
      city: 'New Delhi',
      state: 'Delhi NCR',
      contactPersonName: '',
      designation: 'Head of Talent Acquisition',
      mobileNumber: '',
      whatsappNumber: '',
      email: '',
      secondaryContactPerson: '',
      secondaryContactNumber: '',
      hrContact: '',
      recruitmentFeeType: 'PERCENTAGE',
      feeAmountOrPercent: 8.33,
      paymentTerms: '30 Days from Date of Joining',
      replacementPeriodDays: 90,
      status: 'ACTIVE',
    });
    setCreateModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingClient(true);
    try {
      await clientsApi.create(formData);
      setCreateModalOpen(false);
      fetchClients();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create client');
    } finally {
      setSavingClient(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editClient) return;
    setSavingClient(true);
    try {
      await clientsApi.update(editClient.id, editClient);
      setEditClient(null);
      fetchClients();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update client');
    } finally {
      setSavingClient(false);
    }
  };

  const openClientProfile = async (clientId: string) => {
    try {
      const res = await clientsApi.get(clientId);
      setProfileModalClient(res.data.client);
    } catch (err) {
      console.error('Failed to open client profile:', err);
    }
  };

  const industries = ['Automobile', 'BFSI', 'IT & Software', 'Retail & FMCG', 'Logistics & Supply Chain', 'Manufacturing', 'Healthcare', 'E-Commerce', 'Hospitality', 'Other'];

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-blue-500/20 text-blue-300 font-semibold text-xs border border-blue-500/30">
              Corporate Account Master
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Client & Billing Management
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight mt-1">
            Corporate Client Directory
          </h1>
          <p className="text-xs text-slate-300 mt-0.5">
            Manage client accounts, contact persons, commercial billing terms, and track vacancies across corporate employers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {user?.role !== 'EXECUTIVE' && (
            <button
              onClick={handleOpenCreate}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 font-bold text-xs shadow-lg shadow-blue-500/25 transition active:scale-95 text-white"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add Corporate Client</span>
            </button>
          )}

          <button
            onClick={fetchClients}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search clients by company name, contact person, client ID, city, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <select
            value={industryFilter}
            onChange={(e) => setIndustryFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 font-medium text-slate-700"
          >
            <option value="ALL">All Industries</option>
            {industries.map(ind => (
              <option key={ind} value={ind}>{ind}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 font-medium text-slate-700"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="BLACKLISTED">Blacklisted</option>
          </select>
        </div>
      </div>

      {/* Clients Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-3 py-16 text-center text-xs text-slate-400">Loading corporate clients...</div>
        ) : clients.length === 0 ? (
          <div className="col-span-3 py-16 text-center text-xs text-slate-400">No corporate clients found.</div>
        ) : (
          clients.map((c) => (
            <div
              key={c.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all p-5 space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-3">
                {/* Header info */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-slate-900 text-white font-bold text-sm flex items-center justify-center shadow-md flex-shrink-0">
                      <Building2 className="w-5 h-5 text-sky-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 line-clamp-1">{c.companyName}</h3>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                        <span className="font-mono text-slate-400 font-semibold">{c.displayClientId}</span>
                        <span>•</span>
                        <span className="font-medium text-blue-700">{c.industry}</span>
                      </div>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      c.status === 'ACTIVE'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {c.status}
                  </span>
                </div>

                {/* Contact person snapshot */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1 text-xs">
                  <div className="font-semibold text-slate-800 flex items-center justify-between">
                    <span>{c.contactPersonName}</span>
                    <span className="text-[10px] text-slate-500 font-normal">{c.designation || 'POC'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-600 text-[11px]">
                    <span className="flex items-center gap-1 font-mono">
                      <Phone className="w-3 h-3 text-slate-400" /> {formatPhone(c.mobileNumber)}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-400" /> {c.city || 'India'}
                    </span>
                  </div>
                </div>

                {/* Commercial Terms Banner */}
                <div className="flex items-center justify-between text-[11px] px-3 py-1.5 rounded-lg bg-blue-50/70 border border-blue-100 text-blue-900 font-medium">
                  <span>Fee: <strong className="font-bold">{c.recruitmentFeeType === 'PERCENTAGE' ? `${c.feeAmountOrPercent}% CTC` : formatCurrency(c.feeAmountOrPercent)}</strong></span>
                  <span>Replacement: <strong className="font-bold">{c.replacementPeriodDays} Days</strong></span>
                </div>
              </div>

              {/* Stats Footer & Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs">
                  <div>
                    <span className="font-bold text-slate-900">{c.stats?.totalJobOrders || 0}</span>
                    <span className="text-[10px] text-slate-400 ml-1">Jobs</span>
                  </div>
                  <div>
                    <span className="font-bold text-blue-700">{c.stats?.totalSubmissions || 0}</span>
                    <span className="text-[10px] text-slate-400 ml-1">CVs</span>
                  </div>
                  <div>
                    <span className="font-bold text-emerald-600">{c.stats?.totalJoined || 0}</span>
                    <span className="text-[10px] text-slate-400 ml-1">Joined</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => openClientProfile(c.id)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-blue-600 hover:text-white text-xs font-semibold text-slate-700 transition"
                  >
                    <span>Profile</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>

                  {user?.role !== 'EXECUTIVE' && (
                    <button
                      onClick={() => setEditClient(c)}
                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODAL: CREATE CLIENT */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        maxWidth="lg"
        title="Add New Corporate Client Account"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Company Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Tata Motors Passenger Vehicles Ltd."
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                className="w-full p-2 border rounded-lg font-semibold"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Industry Vertical *</label>
              <select
                value={formData.industry}
                onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                className="w-full p-2 border rounded-lg bg-white"
              >
                {industries.map(ind => (
                  <option key={ind} value={ind}>{ind}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Website URL</label>
              <input
                type="url"
                placeholder="https://www.company.com"
                value={formData.companyWebsite}
                onChange={(e) => setFormData({ ...formData, companyWebsite: e.target.value })}
                className="w-full p-2 border rounded-lg"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">City</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full p-2 border rounded-lg"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">State / Province</label>
              <input
                type="text"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                className="w-full p-2 border rounded-lg"
              />
            </div>

            <div className="col-span-2 pt-2 border-t font-bold text-slate-800">
              Primary Contact Person
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Contact Person Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Rajesh Kumar"
                value={formData.contactPersonName}
                onChange={(e) => setFormData({ ...formData, contactPersonName: e.target.value })}
                className="w-full p-2 border rounded-lg"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Designation</label>
              <input
                type="text"
                placeholder="e.g. VP - Talent Acquisition"
                value={formData.designation}
                onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                className="w-full p-2 border rounded-lg"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Mobile Number *</label>
              <input
                type="tel"
                required
                placeholder="e.g. 9811122334"
                value={formData.mobileNumber}
                onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value })}
                className="w-full p-2 border rounded-lg font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Email Address *</label>
              <input
                type="email"
                required
                placeholder="e.g. rajesh.k@company.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full p-2 border rounded-lg"
              />
            </div>

            <div className="col-span-2 pt-2 border-t font-bold text-slate-800">
              Commercial & Billing Agreement
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Fee Model</label>
              <select
                value={formData.recruitmentFeeType}
                onChange={(e) => setFormData({ ...formData, recruitmentFeeType: e.target.value })}
                className="w-full p-2 border rounded-lg bg-white"
              >
                <option value="PERCENTAGE">Percentage of Annual CTC (%)</option>
                <option value="FIXED">Fixed Amount per Hire (₹)</option>
                <option value="RETAINER">Retainer Monthly</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Fee Amount or % *</label>
              <input
                type="number"
                step="0.01"
                value={formData.feeAmountOrPercent}
                onChange={(e) => setFormData({ ...formData, feeAmountOrPercent: Number(e.target.value) })}
                className="w-full p-2 border rounded-lg font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Replacement Guarantee (Days)</label>
              <input
                type="number"
                value={formData.replacementPeriodDays}
                onChange={(e) => setFormData({ ...formData, replacementPeriodDays: Number(e.target.value) })}
                className="w-full p-2 border rounded-lg font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Payment Terms</label>
              <input
                type="text"
                value={formData.paymentTerms}
                onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                className="w-full p-2 border rounded-lg"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="px-4 py-2 rounded-lg border text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingClient}
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shadow disabled:opacity-50"
            >
              {savingClient ? 'Saving...' : 'Create Client Account'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: EDIT CLIENT */}
      <Modal
        isOpen={!!editClient}
        onClose={() => setEditClient(null)}
        maxWidth="lg"
        title={`Edit Corporate Client: ${editClient?.companyName}`}
      >
        {editClient && (
          <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Company Name</label>
                <input
                  type="text"
                  required
                  value={editClient.companyName}
                  onChange={(e) => setEditClient({ ...editClient, companyName: e.target.value })}
                  className="w-full p-2 border rounded-lg font-semibold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Industry</label>
                <select
                  value={editClient.industry}
                  onChange={(e) => setEditClient({ ...editClient, industry: e.target.value })}
                  className="w-full p-2 border rounded-lg bg-white"
                >
                  {industries.map(ind => (
                    <option key={ind} value={ind}>{ind}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Account Status</label>
                <select
                  value={editClient.status}
                  onChange={(e) => setEditClient({ ...editClient, status: e.target.value as any })}
                  className="w-full p-2 border rounded-lg bg-white"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="BLACKLISTED">BLACKLISTED</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Contact Person Name</label>
                <input
                  type="text"
                  required
                  value={editClient.contactPersonName}
                  onChange={(e) => setEditClient({ ...editClient, contactPersonName: e.target.value })}
                  className="w-full p-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Mobile Number</label>
                <input
                  type="tel"
                  required
                  value={editClient.mobileNumber}
                  onChange={(e) => setEditClient({ ...editClient, mobileNumber: e.target.value })}
                  className="w-full p-2 border rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={editClient.email}
                  onChange={(e) => setEditClient({ ...editClient, email: e.target.value })}
                  className="w-full p-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Fee % or Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={editClient.feeAmountOrPercent}
                  onChange={(e) => setEditClient({ ...editClient, feeAmountOrPercent: Number(e.target.value) })}
                  className="w-full p-2 border rounded-lg font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setEditClient(null)}
                className="px-4 py-2 rounded-lg border text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingClient}
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shadow disabled:opacity-50"
              >
                {savingClient ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* MODAL: 360 CLIENT PROFILE */}
      <Modal
        isOpen={!!profileModalClient}
        onClose={() => setProfileModalClient(null)}
        maxWidth="xl"
        title="Corporate Client 360° Profile"
      >
        {profileModalClient && (
          <div className="space-y-6 text-xs max-h-[75vh] overflow-y-auto pr-1">
            {/* Top Banner */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono text-[10px] font-bold border border-blue-500/30">
                    {profileModalClient.displayClientId}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                    {profileModalClient.status}
                  </span>
                </div>
                <h2 className="text-lg font-black">{profileModalClient.companyName}</h2>
                <div className="text-slate-400 text-xs flex items-center gap-2">
                  <span>{profileModalClient.industry}</span>
                  <span>•</span>
                  <span>{profileModalClient.city}, {profileModalClient.state}</span>
                </div>
              </div>

              <div className="text-right p-3 rounded-xl bg-slate-800/80 border border-slate-700">
                <div className="text-[10px] text-slate-400 uppercase">Recruitment Terms</div>
                <div className="text-sm font-black text-amber-400 mt-0.5">
                  {profileModalClient.recruitmentFeeType === 'PERCENTAGE' ? `${profileModalClient.feeAmountOrPercent}% CTC` : formatCurrency(profileModalClient.feeAmountOrPercent)}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">{profileModalClient.paymentTerms}</div>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-slate-400 text-[10px] uppercase font-bold">Total Job Orders</div>
                <div className="text-xl font-black text-slate-900 mt-1">{profileModalClient.summary.totalJobOrders} Vacancies</div>
              </div>
              <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200">
                <div className="text-blue-700 text-[10px] uppercase font-bold">Active Openings</div>
                <div className="text-xl font-black text-blue-700 mt-1">{profileModalClient.summary.activeJobOrders} Active</div>
              </div>
              <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200">
                <div className="text-sky-700 text-[10px] uppercase font-bold">CVs Submitted</div>
                <div className="text-xl font-black text-sky-700 mt-1">{profileModalClient.summary.totalSubmissions} Profiles</div>
              </div>
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
                <div className="text-emerald-700 text-[10px] uppercase font-bold">Total Joined</div>
                <div className="text-xl font-black text-emerald-700 mt-1">{profileModalClient.summary.totalJoined} Placements</div>
              </div>
            </div>

            {/* Job Orders List */}
            <div className="space-y-3">
              <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-blue-600" />
                Job Orders & Open Vacancies ({profileModalClient.jobOrders?.length || 0})
              </h3>
              <div className="space-y-2">
                {profileModalClient.jobOrders?.map((job: any) => (
                  <div key={job.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 flex items-center gap-2">
                        <span>{job.jobTitle}</span>
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                          {job.displayJobId}
                        </span>
                      </div>
                      <div className="text-slate-500 text-[11px] mt-0.5">
                        {job.jobLocation} • {job.numberOfVacancies} Vacancies • {job.minExperienceYears}-{job.maxExperienceYears}y Exp
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${job.status === 'OPEN' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>
                        {job.status}
                      </span>
                      <div className="text-[10px] text-slate-400 mt-1 font-mono">
                        {job._count?.applications || 0} Sourced • {job._count?.placements || 0} Joined
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
