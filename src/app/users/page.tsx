'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { PresenceBadge, Badge } from '@/components/common/Badge';
import { Modal } from '@/components/common/Modal';
import {
  UserCog,
  Plus,
  Shield,
  Users,
  CheckCircle,
  XCircle,
  AlertCircle,
  Mail,
  Phone,
} from 'lucide-react';

export default function UserManagementPage() {
  const { hasRole, hasPermission } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Add User Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('Password@123');
  const [phone, setPhone] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>(['EXECUTIVE']);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const availableRoles = [
    { name: 'SUPER_ADMIN', label: 'Super Admin / Owner (Highest Authority)' },
    { name: 'OPERATIONS_HEAD', label: 'Operations Head (Lead Assignment & Quality)' },
    { name: 'SCREENING_MANAGER', label: 'Screening Manager (Form, CV, Pass/Fail, Shortlists)' },
    { name: 'EXECUTIVE', label: 'Recruitment Executive (Calling & Callbacks)' },
    { name: 'BUSINESS_DEVELOPMENT_MANAGER', label: 'Business Development Manager (Companies & JDs)' },
    { name: 'FINANCE_MANAGER', label: 'Finance Manager' },
  ];

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const d = await res.json();
        setUsers(d.data || []);
      }
    } catch (err) {
      console.error('Error loading users', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleToggle = (roleName: string) => {
    setSelectedRoles((prev) =>
      prev.includes(roleName) ? prev.filter((r) => r !== roleName) : [...prev, roleName]
    );
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRoles.length === 0) return;
    setError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          email,
          password,
          phone,
          roles: selectedRoles,
        }),
      });

      const d = await res.json();
      if (!res.ok) {
        setError(d.error || 'Failed to create user');
        setSubmitting(false);
        return;
      }

      setShowAddModal(false);
      setFullName('');
      setEmail('');
      setPhone('');
      setSelectedRoles(['EXECUTIVE']);
      await fetchUsers();
    } catch (err) {
      setError('Connection error creating user');
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
            SYSTEM ADMINISTRATION
          </span>
          <h2 className="text-lg font-bold text-slate-900 mt-0.5">User & Multi-Role RBAC Management</h2>
          <p className="text-xs text-slate-500">
            Configure internal staff accounts, assign multiple responsibilities, and monitor CRM presence.
          </p>
        </div>

        {hasPermission('user.manage') && (
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Organization User</span>
          </button>
        )}
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">User & Email</th>
                <th className="py-3 px-4">Assigned Roles (Multi-Role Support)</th>
                <th className="py-3 px-4">Team</th>
                <th className="py-3 px-4">CRM Activity Presence</th>
                <th className="py-3 px-4 text-center">Assigned Leads</th>
                <th className="py-3 px-4">Account Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-900">{u.fullName}</div>
                    <div className="text-[11px] text-slate-500">{u.email}</div>
                    {u.phone && <div className="text-[10px] font-mono text-teal-700">{u.phone}</div>}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1">
                      {u.roles?.map((r: string) => (
                        <Badge key={r} variant="purple">
                          {r.replace(/_/g, ' ')}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-700">{u.team?.name || 'Unassigned'}</td>
                  <td className="py-3 px-4">
                    <PresenceBadge status={u.presenceStatus} />
                  </td>
                  <td className="py-3 px-4 text-center font-bold text-slate-900">{u.assignedCount}</td>
                  <td className="py-3 px-4">
                    <Badge variant={u.status === 'ACTIVE' ? 'success' : 'danger'}>{u.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Create Internal Staff User"
        subtitle="Configure credentials and assign multiple operational roles"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                className="w-full p-2 border border-slate-200 rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Official Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@geniusconsultancy.com"
                className="w-full p-2 border border-slate-200 rounded-lg text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="10-digit mobile"
                className="w-full p-2 border border-slate-200 rounded-lg text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
              Assign Roles (Multi-Role Selection Supported)
            </label>
            <div className="space-y-2 border border-slate-200 rounded-lg p-3 text-xs bg-slate-50">
              {availableRoles.map((r) => (
                <label key={r.name} className="flex items-center gap-2 cursor-pointer hover:text-teal-700">
                  <input
                    type="checkbox"
                    checked={selectedRoles.includes(r.name)}
                    onChange={() => handleRoleToggle(r.name)}
                  />
                  <span className="font-semibold">{r.name.replace(/_/g, ' ')}</span>
                  <span className="text-[11px] text-slate-400">({r.label})</span>
                </label>
              ))}
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
              disabled={submitting || selectedRoles.length === 0}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
            >
              Save User
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
