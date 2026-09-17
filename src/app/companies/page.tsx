'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/common/Badge';
import { Modal } from '@/components/common/Modal';
import {
  Building2,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  ExternalLink,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';

export default function CompaniesPage() {
  const { hasPermission } = useAuth();
  const [companies, setCompanies] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Add Company Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newComp, setNewComp] = useState({
    companyName: '',
    industry: 'Automobile',
    companyType: 'Corporate',
    city: 'Rajkot',
    state: 'Gujarat',
    status: 'ACTIVE',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    designation: 'HR Manager',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCompanies();
  }, [search]);

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/companies?search=${encodeURIComponent(search)}`);
      if (res.ok) {
        const d = await res.json();
        setCompanies(d.data || []);
      }
    } catch (err) {
      console.error('Error loading companies', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: newComp.companyName,
          industry: newComp.industry,
          companyType: newComp.companyType,
          city: newComp.city,
          state: newComp.state,
          status: newComp.status,
          primaryContact: newComp.contactName
            ? {
                contactName: newComp.contactName,
                phone: newComp.contactPhone,
                email: newComp.contactEmail,
                designation: newComp.designation,
              }
            : undefined,
        }),
      });

      if (res.ok) {
        setShowAddModal(false);
        setNewComp({
          companyName: '',
          industry: 'Automobile',
          companyType: 'Corporate',
          city: 'Rajkot',
          state: 'Gujarat',
          status: 'ACTIVE',
          contactName: '',
          contactPhone: '',
          contactEmail: '',
          designation: 'HR Manager',
        });
        await fetchCompanies();
      }
    } catch (err) {
      console.error('Error creating company', err);
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
            BUSINESS DEVELOPMENT & ACQUISITION
          </span>
          <h2 className="text-lg font-bold text-slate-900 mt-0.5">Client Companies Directory</h2>
          <p className="text-xs text-slate-500">
            Manage client accounts, contact persons, requirement negotiations, and active recruitment mandates.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search company, city, code..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {hasPermission('company.manage') && (
            <button
              onClick={() => setShowAddModal(true)}
              className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Company</span>
            </button>
          )}
        </div>
      </div>

      {/* Companies Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {companies.map((comp) => {
          const primaryContact = comp.contacts?.find((c: any) => c.isPrimary) || comp.contacts?.[0];
          return (
            <div
              key={comp.id}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow transition-shadow flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-[10px] text-slate-400 font-bold">{comp.companyCode}</span>
                    <h3 className="text-base font-bold text-slate-900 mt-0.5">{comp.companyName}</h3>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{comp.city || 'N/A'}, {comp.state}</span>
                    </p>
                  </div>
                  <Badge variant={comp.status === 'ACTIVE' ? 'success' : 'neutral'}>
                    {comp.status}
                  </Badge>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-slate-400">Industry:</span>
                    <span className="font-semibold text-slate-800">{comp.industry || 'General'}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-slate-400">Active Job Orders:</span>
                    <span className="font-bold text-teal-700">{comp.jobRequirements?.length || 0} Mandates</span>
                  </div>
                </div>

                {primaryContact && (
                  <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Primary Contact
                    </span>
                    <div className="font-bold text-slate-900 mt-0.5">{primaryContact.contactName}</div>
                    <div className="text-[11px] text-slate-500">{primaryContact.designation}</div>
                    <div className="font-mono text-[11px] text-teal-700 mt-1">{primaryContact.phone}</div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Company Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Onboard Client Company"
        subtitle="Add company details and primary HR contact person"
      >
        <form onSubmit={handleCreateCompany} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Company Name</label>
              <input
                type="text"
                required
                value={newComp.companyName}
                onChange={(e) => setNewComp({ ...newComp, companyName: e.target.value })}
                placeholder="e.g. TVS Motor Company"
                className="w-full p-2 border border-slate-200 rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Industry</label>
              <input
                type="text"
                value={newComp.industry}
                onChange={(e) => setNewComp({ ...newComp, industry: e.target.value })}
                placeholder="e.g. Automobile / Finance"
                className="w-full p-2 border border-slate-200 rounded-lg text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
              <input
                type="text"
                value={newComp.city}
                onChange={(e) => setNewComp({ ...newComp, city: e.target.value })}
                className="w-full p-2 border border-slate-200 rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">State</label>
              <input
                type="text"
                value={newComp.state}
                onChange={(e) => setNewComp({ ...newComp, state: e.target.value })}
                className="w-full p-2 border border-slate-200 rounded-lg text-xs"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-2">
              HR Contact Person
            </span>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                placeholder="Contact Name"
                value={newComp.contactName}
                onChange={(e) => setNewComp({ ...newComp, contactName: e.target.value })}
                className="p-2 border border-slate-200 rounded-lg text-xs"
              />
              <input
                type="text"
                placeholder="Designation"
                value={newComp.designation}
                onChange={(e) => setNewComp({ ...newComp, designation: e.target.value })}
                className="p-2 border border-slate-200 rounded-lg text-xs"
              />
              <input
                type="tel"
                placeholder="Phone Number"
                value={newComp.contactPhone}
                onChange={(e) => setNewComp({ ...newComp, contactPhone: e.target.value })}
                className="p-2 border border-slate-200 rounded-lg text-xs"
              />
            </div>
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
              Save Company
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
