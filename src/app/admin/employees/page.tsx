'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { PresenceBadge, Badge } from '@/components/common/Badge';
import { Modal } from '@/components/common/Modal';
import {
  Users,
  UserPlus,
  Edit2,
  KeyRound,
  UserCheck,
  UserX,
  Search,
  Building,
  Phone,
  Mail,
  AlertCircle,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';

interface RoleDetail {
  id: string;
  name: string;
  description?: string;
}

interface TeamDetail {
  id: string;
  name: string;
}

interface Employee {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  presenceStatus: string;
  createdAt: string;
  lastLoginAt: string | null;
  lastActivityAt?: string | null;
  teamId: string | null;
  team: { id: string; name: string } | null;
  roles: string[];
  roleDetails?: RoleDetail[];
  assignedCount: number;
  callsCount: number;
}

export default function AdminEmployeesPage() {
  const { user: currentUser, hasRole, hasPermission } = useAuth();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [availableRoles, setAvailableRoles] = useState<RoleDetail[]>([]);
  const [availableTeams, setAvailableTeams] = useState<TeamDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [teamFilter, setTeamFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [showStatusConfirmModal, setShowStatusConfirmModal] = useState(false);

  // Form State - Add
  const [addFullName, setAddFullName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addTeamId, setAddTeamId] = useState('');
  const [addRoles, setAddRoles] = useState<string[]>(['EXECUTIVE']);

  // Form State - Edit
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editTeamId, setEditTeamId] = useState('');
  const [editStatus, setEditStatus] = useState<'ACTIVE' | 'INACTIVE' | 'SUSPENDED'>('ACTIVE');
  const [editRoles, setEditRoles] = useState<string[]>([]);

  // Form State - Password Reset
  const [resetPasswordVal, setResetPasswordVal] = useState('');

  // Submit states & error
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const d = await res.json();
        setEmployees(d.data || []);
        if (d.roles && Array.isArray(d.roles)) {
          setAvailableRoles(d.roles);
        }
        if (d.teams && Array.isArray(d.teams)) {
          setAvailableTeams(d.teams);
        }
      } else {
        showToast('Failed to load employee directory', 'error');
      }
    } catch (err) {
      console.error('Error fetching employees:', err);
      showToast('Network error while loading data', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // Filtered employees list
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        emp.fullName.toLowerCase().includes(query) ||
        emp.email.toLowerCase().includes(query) ||
        (emp.phone && emp.phone.toLowerCase().includes(query));

      const matchesRole =
        roleFilter === 'ALL' || (emp.roles && emp.roles.includes(roleFilter));

      const matchesTeam =
        teamFilter === 'ALL' ||
        (teamFilter === 'UNASSIGNED' ? !emp.teamId : emp.teamId === teamFilter);

      const matchesStatus =
        statusFilter === 'ALL' || emp.status === statusFilter;

      return matchesSearch && matchesRole && matchesTeam && matchesStatus;
    });
  }, [employees, searchQuery, roleFilter, teamFilter, statusFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = employees.length;
    const active = employees.filter((e) => e.status === 'ACTIVE').length;
    const inactive = employees.filter((e) => e.status !== 'ACTIVE').length;
    const teamsCount = new Set(employees.map((e) => e.teamId).filter(Boolean)).size;
    return { total, active, inactive, teamsCount };
  }, [employees]);

  // Add Employee Handlers
  const handleOpenAdd = () => {
    setAddFullName('');
    setAddEmail('');
    setAddPassword('Genius@2026');
    setAddPhone('');
    setAddTeamId('');
    setAddRoles(['EXECUTIVE']);
    setFormError('');
    setShowAddModal(true);
  };

  const toggleAddRole = (roleName: string) => {
    setAddRoles((prev) =>
      prev.includes(roleName) ? prev.filter((r) => r !== roleName) : [...prev, roleName]
    );
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (addRoles.length === 0) {
      setFormError('At least one role must be selected');
      return;
    }
    setFormError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: addFullName,
          email: addEmail,
          password: addPassword,
          phone: addPhone || undefined,
          teamId: addTeamId || null,
          roles: addRoles,
        }),
      });

      const d = await res.json();
      if (!res.ok) {
        setFormError(d.error || 'Failed to create employee');
        setSubmitting(false);
        return;
      }

      setShowAddModal(false);
      showToast(`Employee ${addFullName} created successfully!`);
      await fetchData();
    } catch (err) {
      setFormError('Connection error while creating employee');
    } finally {
      setSubmitting(false);
    }
  };

  // Edit Employee Handlers
  const handleOpenEdit = (emp: Employee) => {
    setSelectedEmployee(emp);
    setEditFullName(emp.fullName);
    setEditPhone(emp.phone || '');
    setEditTeamId(emp.teamId || '');
    setEditStatus(emp.status);
    setEditRoles(emp.roles || []);
    setFormError('');
    setShowEditModal(true);
  };

  const toggleEditRole = (roleName: string) => {
    setEditRoles((prev) =>
      prev.includes(roleName) ? prev.filter((r) => r !== roleName) : [...prev, roleName]
    );
  };

  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    if (editRoles.length === 0) {
      setFormError('At least one role must be assigned');
      return;
    }
    setFormError('');
    setSubmitting(true);

    try {
      const res = await fetch(`/api/users/${selectedEmployee.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: editFullName,
          phone: editPhone || null,
          teamId: editTeamId || null,
          status: editStatus,
          roles: editRoles,
        }),
      });

      const d = await res.json();
      if (!res.ok) {
        setFormError(d.error || 'Failed to update employee');
        setSubmitting(false);
        return;
      }

      setShowEditModal(false);
      showToast(`Employee ${editFullName} updated successfully!`);
      await fetchData();
    } catch (err) {
      setFormError('Connection error while updating employee');
    } finally {
      setSubmitting(false);
    }
  };

  // Password Reset Handlers
  const handleOpenResetPassword = (emp: Employee) => {
    setSelectedEmployee(emp);
    setResetPasswordVal('');
    setFormError('');
    setShowResetPasswordModal(true);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    if (resetPasswordVal.length < 8) {
      setFormError('Password must be at least 8 characters');
      return;
    }
    setFormError('');
    setSubmitting(true);

    try {
      const res = await fetch(`/api/users/${selectedEmployee.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: resetPasswordVal }),
      });

      const d = await res.json();
      if (!res.ok) {
        setFormError(d.error || 'Failed to reset password');
        setSubmitting(false);
        return;
      }

      setShowResetPasswordModal(false);
      showToast(`Password for ${selectedEmployee.fullName} has been reset successfully!`);
    } catch (err) {
      setFormError('Connection error while resetting password');
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle Status / Deactivate / Activate
  const handleOpenStatusConfirm = (emp: Employee) => {
    setSelectedEmployee(emp);
    setShowStatusConfirmModal(true);
  };

  const handleToggleStatus = async () => {
    if (!selectedEmployee) return;
    setSubmitting(true);
    const newStatus = selectedEmployee.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    try {
      const res = await fetch(`/api/users/${selectedEmployee.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      const d = await res.json();
      if (!res.ok) {
        showToast(d.error || 'Failed to update account status', 'error');
        setSubmitting(false);
        return;
      }

      setShowStatusConfirmModal(false);
      showToast(
        `Employee account ${newStatus === 'ACTIVE' ? 'activated' : 'deactivated'} successfully!`
      );
      await fetchData();
    } catch (err) {
      showToast('Connection error updating status', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const defaultRoleList = [
    { name: 'SUPER_ADMIN', description: 'Super Admin / Owner (Full System Authority)' },
    { name: 'OPERATIONS_HEAD', description: 'Operations Head (Lead Assignment & Workload)' },
    { name: 'SCREENING_MANAGER', description: 'Screening Manager (Form Review & Shortlisting)' },
    { name: 'EXECUTIVE', description: 'Recruitment Executive (Calling & Callbacks)' },
    { name: 'BUSINESS_DEVELOPMENT_MANAGER', description: 'Business Development Manager (Clients & JDs)' },
    { name: 'FINANCE_MANAGER', description: 'Finance Manager (Billings & Invoices)' },
  ];

  const renderedRoleList = availableRoles.length > 0 ? availableRoles : defaultRoleList;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg border text-xs font-semibold flex items-center gap-2 animate-in slide-in-from-top-2 duration-200 ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-teal-600 uppercase tracking-wider">
              SUPER ADMIN / HR OPERATIONS
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-100 text-teal-800">
              V1.1
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1 flex items-center gap-2">
            <Users className="w-5 h-5 text-teal-600" />
            Employee & User Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Create staff accounts, reconcile multi-role RBAC permissions, manage team placements, reset passwords, and control access.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors text-xs flex items-center gap-1 font-medium"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-teal-600' : ''}`} />
          </button>

          {(hasPermission('user.manage') || hasRole('SUPER_ADMIN')) && (
            <button
              onClick={handleOpenAdd}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-sm transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Employee</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Staff</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{stats.total}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Configured in CRM</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Active Accounts</span>
            <UserCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">{stats.active}</div>
          <div className="text-[11px] text-emerald-700 mt-0.5">Can login and dial</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Deactivated</span>
            <UserX className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-600 mt-1">{stats.inactive}</div>
          <div className="text-[11px] text-rose-700 mt-0.5">Login restricted</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Active Teams</span>
            <Building className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-purple-600 mt-1">{availableTeams.length || stats.teamsCount}</div>
          <div className="text-[11px] text-purple-700 mt-0.5">Operational units</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative md:col-span-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, phone..."
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all outline-none"
            />
          </div>

          <div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-700 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none bg-white"
            >
              <option value="ALL">All Roles ({employees.length})</option>
              {renderedRoleList.map((r) => (
                <option key={r.name} value={r.name}>
                  {r.name.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-700 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none bg-white"
            >
              <option value="ALL">All Teams</option>
              <option value="UNASSIGNED">Unassigned Team</option>
              {availableTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-700 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none bg-white"
            >
              <option value="ALL">All Account Statuses</option>
              <option value="ACTIVE">Active Accounts Only</option>
              <option value="INACTIVE">Inactive Accounts Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Employees Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Employee Details</th>
                <th className="py-3 px-4">Assigned Roles (Multi-Role)</th>
                <th className="py-3 px-4">Team Placement</th>
                <th className="py-3 px-4">Live Presence</th>
                <th className="py-3 px-4 text-center">Workload (Leads / Calls)</th>
                <th className="py-3 px-4">Account Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-teal-600" />
                      <span>Loading employee directory...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No employees match your search or filter criteria.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => (
                  <tr
                    key={emp.id}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      emp.status !== 'ACTIVE' ? 'bg-slate-50/40 text-slate-400' : ''
                    }`}
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                        <span>{emp.fullName}</span>
                        {emp.id === currentUser?.id && (
                          <span className="text-[10px] px-1.5 py-0.2 bg-teal-100 text-teal-800 rounded font-semibold">
                            You
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{emp.email}</span>
                      </div>
                      {emp.phone && (
                        <div className="text-[11px] text-slate-600 flex items-center gap-1 font-mono mt-0.5">
                          <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{emp.phone}</span>
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="flex flex-wrap gap-1">
                        {emp.roles && emp.roles.length > 0 ? (
                          emp.roles.map((r) => {
                            let variant: 'purple' | 'info' | 'success' | 'warning' | 'neutral' = 'purple';
                            if (r === 'SUPER_ADMIN') variant = 'purple';
                            else if (r === 'OPERATIONS_HEAD') variant = 'warning';
                            else if (r === 'SCREENING_MANAGER') variant = 'info';
                            else if (r === 'EXECUTIVE') variant = 'success';

                            return (
                              <Badge key={r} variant={variant}>
                                {r.replace(/_/g, ' ')}
                              </Badge>
                            );
                          })
                        ) : (
                          <span className="text-slate-400 italic">No roles</span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      {emp.team?.name ? (
                        <span className="inline-flex items-center gap-1 text-slate-700 font-semibold bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                          <Building className="w-3 h-3 text-slate-500" />
                          {emp.team.name}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Unassigned</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <PresenceBadge status={emp.presenceStatus} />
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <div className="inline-flex items-center gap-3 font-mono">
                        <span className="text-slate-800 font-bold" title="Assigned candidate leads">
                          {emp.assignedCount ?? 0} leads
                        </span>
                        <span className="text-slate-400">/</span>
                        <span className="text-teal-700 font-bold" title="Total calls logged">
                          {emp.callsCount ?? 0} calls
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <Badge variant={emp.status === 'ACTIVE' ? 'success' : 'danger'}>
                        {emp.status}
                      </Badge>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {(hasPermission('user.manage') || hasRole('SUPER_ADMIN')) && (
                          <>
                            <button
                              onClick={() => handleOpenEdit(emp)}
                              className="p-1.5 text-slate-600 hover:text-teal-700 hover:bg-slate-100 rounded transition-colors"
                              title="Edit Employee & Roles"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleOpenResetPassword(emp)}
                              className="p-1.5 text-slate-600 hover:text-amber-700 hover:bg-slate-100 rounded transition-colors"
                              title="Reset Password"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleOpenStatusConfirm(emp)}
                              className={`p-1.5 rounded transition-colors ${
                                emp.status === 'ACTIVE'
                                  ? 'text-rose-600 hover:text-rose-700 hover:bg-rose-50'
                                  : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
                              }`}
                              title={emp.status === 'ACTIVE' ? 'Deactivate Account' : 'Reactivate Account'}
                            >
                              {emp.status === 'ACTIVE' ? (
                                <UserX className="w-3.5 h-3.5" />
                              ) : (
                                <UserCheck className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </>
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

      {/* ADD EMPLOYEE MODAL */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add New Employee"
        subtitle="Create staff account, set temporary credentials, and configure multi-role permissions"
        maxWidth="xl"
      >
        <form onSubmit={handleCreateEmployee} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={addFullName}
                onChange={(e) => setAddFullName(e.target.value)}
                placeholder="e.g. Priya Sharma"
                className="w-full p-2.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Official Email <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                required
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                placeholder="priya@geniusconsultancy.com"
                className="w-full p-2.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Temporary Password <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                minLength={8}
                value={addPassword}
                onChange={(e) => setAddPassword(e.target.value)}
                placeholder="Enter at least 8 characters"
                className="w-full p-2.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
              />
              <p className="text-[10px] text-slate-400 mt-1">Minimum 8 characters</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Phone Number (Optional)
              </label>
              <input
                type="tel"
                value={addPhone}
                onChange={(e) => setAddPhone(e.target.value)}
                placeholder="e.g. 9876543210"
                className="w-full p-2.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Team Placement</label>
            <select
              value={addTeamId}
              onChange={(e) => setAddTeamId(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none bg-white"
            >
              <option value="">No Team / Unassigned</option>
              {availableTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
              Assign Operational Roles (Multi-Role Supported) <span className="text-rose-500">*</span>
            </label>
            <div className="space-y-2 border border-slate-200 rounded-lg p-3 text-xs bg-slate-50 max-h-48 overflow-y-auto">
              {renderedRoleList.map((r) => {
                const isSelected = addRoles.includes(r.name);
                return (
                  <label
                    key={r.name}
                    className={`flex items-start gap-2.5 p-2 rounded-md cursor-pointer transition-colors ${
                      isSelected ? 'bg-teal-50/80 border border-teal-200' : 'hover:bg-slate-100'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleAddRole(r.name)}
                      className="mt-0.5 rounded text-teal-600 focus:ring-teal-500"
                    />
                    <div>
                      <div className="font-semibold text-slate-900">{r.name.replace(/_/g, ' ')}</div>
                      {r.description && (
                        <div className="text-[11px] text-slate-500">{r.description}</div>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || addRoles.length === 0 || addPassword.length < 8}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5"
            >
              {submitting ? 'Creating...' : 'Create Employee'}
            </button>
          </div>
        </form>
      </Modal>

      {/* EDIT EMPLOYEE MODAL */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title={`Edit Employee: ${selectedEmployee?.fullName || ''}`}
        subtitle="Update profile details, status, team, and multi-role assignments"
        maxWidth="lg"
      >
        <form onSubmit={handleUpdateEmployee} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={editFullName}
                onChange={(e) => setEditFullName(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Official Email</label>
              <input
                type="email"
                disabled
                value={selectedEmployee?.email || ''}
                className="w-full p-2.5 border border-slate-200 rounded-lg text-xs bg-slate-100 text-slate-500 cursor-not-allowed"
              />
              <p className="text-[10px] text-slate-400 mt-1">Email is permanent identifier</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
              <input
                type="tel"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="e.g. 9876543210"
                className="w-full p-2.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Account Status</label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as any)}
                className="w-full p-2.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none bg-white"
              >
                <option value="ACTIVE">ACTIVE (Allowed to login)</option>
                <option value="INACTIVE">INACTIVE (Login blocked)</option>
                <option value="SUSPENDED">SUSPENDED (Restricted)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Team Placement</label>
            <select
              value={editTeamId}
              onChange={(e) => setEditTeamId(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none bg-white"
            >
              <option value="">No Team / Unassigned</option>
              {availableTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
              Assigned Operational Roles (Multi-Role Supported) <span className="text-rose-500">*</span>
            </label>
            <div className="space-y-2 border border-slate-200 rounded-lg p-3 text-xs bg-slate-50 max-h-48 overflow-y-auto">
              {renderedRoleList.map((r) => {
                const isSelected = editRoles.includes(r.name);
                return (
                  <label
                    key={r.name}
                    className={`flex items-start gap-2.5 p-2 rounded-md cursor-pointer transition-colors ${
                      isSelected ? 'bg-teal-50/80 border border-teal-200' : 'hover:bg-slate-100'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleEditRole(r.name)}
                      className="mt-0.5 rounded text-teal-600 focus:ring-teal-500"
                    />
                    <div>
                      <div className="font-semibold text-slate-900">{r.name.replace(/_/g, ' ')}</div>
                      {r.description && (
                        <div className="text-[11px] text-slate-500">{r.description}</div>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowEditModal(false)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || editRoles.length === 0}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5"
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* RESET PASSWORD MODAL */}
      <Modal
        isOpen={showResetPasswordModal}
        onClose={() => setShowResetPasswordModal(false)}
        title={`Reset Password: ${selectedEmployee?.fullName || ''}`}
        subtitle={`Configure a new password for ${selectedEmployee?.email || ''}`}
        maxWidth="md"
      >
        <form onSubmit={handleResetPassword} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              New Password <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              minLength={8}
              value={resetPasswordVal}
              onChange={(e) => setResetPasswordVal(e.target.value)}
              placeholder="Enter at least 8 characters"
              className="w-full p-2.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none font-mono"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              The user can use this new password immediately to log into the CRM (minimum 8 characters).
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowResetPasswordModal(false)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || resetPasswordVal.length < 8}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5"
            >
              {submitting ? 'Resetting...' : 'Set New Password'}
            </button>
          </div>
        </form>
      </Modal>

      {/* STATUS CONFIRM MODAL */}
      <Modal
        isOpen={showStatusConfirmModal}
        onClose={() => setShowStatusConfirmModal(false)}
        title={
          selectedEmployee?.status === 'ACTIVE'
            ? `Deactivate Employee: ${selectedEmployee?.fullName}`
            : `Reactivate Employee: ${selectedEmployee?.fullName}`
        }
        subtitle="Account access confirmation"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div
            className={`p-4 rounded-xl border text-xs ${
              selectedEmployee?.status === 'ACTIVE'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
          >
            {selectedEmployee?.status === 'ACTIVE' ? (
              <div className="space-y-2">
                <p className="font-semibold flex items-center gap-1.5 text-rose-900">
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                  Are you sure you want to deactivate this account?
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-700 text-[11px]">
                  <li>The employee will be blocked from logging into the CRM immediately.</li>
                  <li>Existing assigned candidates, screening notes, and logged calls remain fully intact.</li>
                  <li>You can reactivate this employee at any time.</li>
                </ul>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="font-semibold flex items-center gap-1.5 text-emerald-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Reactivate this employee account?
                </p>
                <p className="text-[11px] text-slate-700">
                  The employee will immediately be able to log in with their existing credentials and resume their calling station workload.
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowStatusConfirmModal(false)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleToggleStatus}
              className={`px-4 py-2 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 ${
                selectedEmployee?.status === 'ACTIVE'
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {submitting
                ? 'Processing...'
                : selectedEmployee?.status === 'ACTIVE'
                ? 'Confirm Deactivation'
                : 'Confirm Reactivation'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
