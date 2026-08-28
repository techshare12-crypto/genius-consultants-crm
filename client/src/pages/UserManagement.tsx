import React, { useState, useEffect } from 'react';
import { User, Role, Permission } from '../types';
import { usersApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatDateTime, formatDate, formatPhone } from '../utils/helpers';
import { Modal } from '../components/common/Modal';
import {
  Users,
  UserPlus,
  Shield,
  PhoneCall,
  Lock,
  Search,
  RefreshCw,
  Edit2,
  KeyRound,
  UserX,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Plus,
  Save,
  Clock,
  Briefcase,
  Phone,
  Mail,
  Award,
} from 'lucide-react';

interface UserManagementProps {
  initialTab?: 'ALL' | 'ADD_USER' | 'ADMINS' | 'EXECUTIVES' | 'ROLES' | 'DEACTIVATED';
}

export const UserManagement: React.FC<UserManagementProps> = ({ initialTab = 'ALL' }) => {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'ALL' | 'ADD_USER' | 'ADMINS' | 'EXECUTIVES' | 'ROLES' | 'DEACTIVATED'>(initialTab);
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');

  // Add User Form State
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: 'EXECUTIVE',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
    joiningDate: new Date().toISOString().slice(0, 10),
    targetCallsDaily: 100,
    targetShortlistDaily: 10,
    profilePhoto: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [savingUser, setSavingUser] = useState<boolean>(false);

  // Modals state
  const [viewUserModal, setViewUserModal] = useState<User | null>(null);
  const [editUserModal, setEditUserModal] = useState<User | null>(null);
  const [resetPassModal, setResetPassModal] = useState<User | null>(null);
  const [statusConfirmModal, setStatusConfirmModal] = useState<{ user: User; nextStatus: string } | null>(null);
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmNewPassword, setConfirmNewPassword] = useState<string>('');
  const [passResetMsg, setPassResetMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New Role Modal
  const [newRoleModalOpen, setNewRoleModalOpen] = useState<boolean>(false);
  const [newRoleName, setNewRoleName] = useState<string>('');
  const [newRoleCode, setNewRoleCode] = useState<string>('');
  const [newRoleDesc, setNewRoleDesc] = useState<string>('');
  const [newRolePerms, setNewRolePerms] = useState<Set<string>>(new Set());

  // Role permissions editing
  const [selectedRoleForPerms, setSelectedRoleForPerms] = useState<Role | null>(null);
  const [rolePermSet, setRolePermSet] = useState<Set<string>>(new Set());
  const [savingRolePerms, setSavingRolePerms] = useState<boolean>(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      let roleFilter = 'ALL';
      let statusFilter = 'ALL';

      if (activeTab === 'ADMINS') {
        roleFilter = 'ADMIN';
        statusFilter = 'ACTIVE';
      } else if (activeTab === 'EXECUTIVES') {
        roleFilter = 'EXECUTIVE';
        statusFilter = 'ACTIVE';
      } else if (activeTab === 'DEACTIVATED') {
        statusFilter = 'DEACTIVATED';
      }

      const [usersRes, rolesRes, permsRes] = await Promise.all([
        usersApi.list({ role: roleFilter, status: statusFilter, search }),
        usersApi.getRoles(),
        usersApi.getPermissions(),
      ]);

      setUsers(usersRes.data.users);
      setRoles(rolesRes.data.roles);
      setPermissions(permsRes.data.permissions);

      if (!selectedRoleForPerms && rolesRes.data.roles.length > 0) {
        const defaultRole = rolesRes.data.roles.find((r: Role) => r.code === 'ADMIN') || rolesRes.data.roles[0];
        setSelectedRoleForPerms(defaultRole);
        setRolePermSet(new Set(defaultRole.permissions || []));
      }
    } catch (err) {
      console.error('Failed to load user management data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [activeTab, search]);

  const handleSelectRoleToEdit = (role: Role) => {
    setSelectedRoleForPerms(role);
    setRolePermSet(new Set(role.permissions || []));
  };

  const handleToggleRolePermission = (permCode: string) => {
    if (selectedRoleForPerms?.code === 'SUPER_ADMIN') return;
    const next = new Set(rolePermSet);
    if (next.has(permCode)) next.delete(permCode);
    else next.add(permCode);
    setRolePermSet(next);
  };

  const handleSaveRolePermissions = async () => {
    if (!selectedRoleForPerms) return;
    setSavingRolePerms(true);
    try {
      await usersApi.updateRolePermissions(selectedRoleForPerms.id, {
        permissions: Array.from(rolePermSet),
      });
      alert(`Permissions for role "${selectedRoleForPerms.name}" saved successfully.`);
      fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update permissions');
    } finally {
      setSavingRolePerms(false);
    }
  };

  const handleCreateNewRole = async () => {
    if (!newRoleName || !newRoleCode) {
      alert('Please provide Role Name and Role Code');
      return;
    }
    try {
      await usersApi.createRole({
        name: newRoleName,
        code: newRoleCode,
        description: newRoleDesc,
        permissions: Array.from(newRolePerms),
      });
      setNewRoleModalOpen(false);
      setNewRoleName('');
      setNewRoleCode('');
      setNewRoleDesc('');
      setNewRolePerms(new Set());
      fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create role');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (formData.password !== formData.confirmPassword) {
      setFormError('Password confirmation does not match');
      return;
    }

    setSavingUser(true);
    try {
      const res = await usersApi.create(formData);
      setFormSuccess(`User ${res.data.user.name} created successfully as ${res.data.user.role}!`);
      setFormData({
        name: '',
        username: '',
        email: '',
        phone: '',
        password: '',
        confirmPassword: '',
        role: 'EXECUTIVE',
        status: 'ACTIVE',
        joiningDate: new Date().toISOString().slice(0, 10),
        targetCallsDaily: 100,
        targetShortlistDaily: 10,
        profilePhoto: '',
      });
      fetchUsers();
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Failed to create user');
    } finally {
      setSavingUser(false);
    }
  };

  const handleEditUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUserModal) return;
    try {
      await usersApi.update(editUserModal.id, editUserModal);
      setEditUserModal(null);
      fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update user');
    }
  };

  const handleStatusChangeConfirm = async () => {
    if (!statusConfirmModal) return;
    try {
      await usersApi.updateStatus(statusConfirmModal.user.id, {
        status: statusConfirmModal.nextStatus,
      });
      setStatusConfirmModal(null);
      fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to change status');
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPassModal) return;
    setPassResetMsg(null);

    if (newPassword !== confirmNewPassword) {
      setPassResetMsg({ type: 'error', text: 'Passwords do not match' });
      return;
    }

    try {
      await usersApi.resetPassword(resetPassModal.id, {
        newPassword,
        confirmPassword: confirmNewPassword,
      });
      setPassResetMsg({ type: 'success', text: 'Password reset successfully!' });
      setTimeout(() => {
        setResetPassModal(null);
        setNewPassword('');
        setConfirmNewPassword('');
        setPassResetMsg(null);
      }, 1500);
    } catch (err: any) {
      setPassResetMsg({ type: 'error', text: err.response?.data?.error || 'Failed to reset password' });
    }
  };

  // Group permissions by category
  const permissionCategories: Record<string, Permission[]> = {};
  for (const p of permissions) {
    if (!permissionCategories[p.category]) permissionCategories[p.category] = [];
    permissionCategories[p.category].push(p);
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-blue-500/20 text-blue-300 font-semibold text-xs border border-blue-500/30">
              Access Control & RBAC
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Multi-Role Security Engine
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight mt-1">
            User Management & Role-Based Permissions
          </h1>
          <p className="text-xs text-slate-300 mt-0.5">
            Manage system users, telecalling executives, administrators, and customize dynamic permission matrices.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab('ADD_USER')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 font-bold text-xs shadow-lg shadow-blue-500/25 transition active:scale-95 text-white"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Add New User</span>
          </button>

          {currentUser?.role === 'SUPER_ADMIN' && (
            <button
              onClick={() => setActiveTab('ROLES')}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition"
            >
              <Shield className="w-4 h-4 text-purple-400" />
              <span>Roles & Permissions</span>
            </button>
          )}

          <button
            onClick={fetchUsers}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        {[
          { id: 'ALL', label: 'All Users', icon: Users, count: users.length },
          { id: 'ADD_USER', label: 'Add New User', icon: UserPlus },
          { id: 'ADMINS', label: 'Admins & Managers', icon: Shield },
          { id: 'EXECUTIVES', label: 'Telecalling Executives', icon: PhoneCall },
          { id: 'ROLES', label: 'Roles & Permissions', icon: KeyRound },
          { id: 'DEACTIVATED', label: 'Deactivated Accounts', icon: UserX, alert: true },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* VIEW 1: ADD NEW USER FORM */}
      {activeTab === 'ADD_USER' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6 max-w-4xl mx-auto animate-scale-in">
          <div className="border-b pb-4">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-blue-600" />
              Add New User Account
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Create an Administrator or Telecalling Executive profile with secure credentials and KPI targets.
            </p>
          </div>

          {formError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {formSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{formSuccess}</span>
            </div>
          )}

          <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Chandra"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 bg-slate-50"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Username (Unique) *</label>
                <input
                  type="text"
                  placeholder="e.g. ramesh_sales"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 bg-slate-50 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email Address (Login ID) *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. ramesh@genius.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 bg-slate-50"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Mobile Number</label>
                <input
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 bg-slate-50 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Password *</label>
                <input
                  type="password"
                  required
                  placeholder="Minimum 6 characters"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 bg-slate-50"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Confirm Password *</label>
                <input
                  type="password"
                  required
                  placeholder="Confirm password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 bg-slate-50"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Assigned Role *</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-white font-semibold text-slate-800"
                >
                  <option value="EXECUTIVE">Telecalling Executive</option>
                  {currentUser?.role === 'SUPER_ADMIN' && <option value="ADMIN">Admin / Operations Manager</option>}
                  {currentUser?.role === 'SUPER_ADMIN' && <option value="SUPER_ADMIN">Super Admin / Owner</option>}
                  <option value="TEAM_LEADER">Team Leader</option>
                  <option value="HR_MANAGER">HR / Recruitment Manager</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Account Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-white font-semibold"
                >
                  <option value="ACTIVE">Active (Can Login Immediately)</option>
                  <option value="INACTIVE">Inactive (Login Blocked)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Joining Date</label>
                <input
                  type="date"
                  value={formData.joiningDate}
                  onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Daily Calls KPI Target</label>
                <input
                  type="number"
                  value={formData.targetCallsDaily}
                  onChange={(e) => setFormData({ ...formData, targetCallsDaily: Number(e.target.value) })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveTab('ALL')}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingUser}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-500/20 transition disabled:opacity-50"
              >
                {savingUser ? 'Creating User...' : 'Create User Account'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* VIEW 2: ROLES & PERMISSIONS MATRIX */}
      {activeTab === 'ROLES' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-scale-in">
          {/* Roles Selector Column */}
          <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-black text-sm text-slate-900">System & Custom Roles</h3>
                <p className="text-[11px] text-slate-500">Select a role to configure its permissions</p>
              </div>
              {currentUser?.role === 'SUPER_ADMIN' && (
                <button
                  onClick={() => setNewRoleModalOpen(true)}
                  className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition"
                  title="Create New Role"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="space-y-2">
              {roles.map((r) => {
                const isSelected = selectedRoleForPerms?.id === r.id;
                return (
                  <div
                    key={r.id}
                    onClick={() => handleSelectRoleToEdit(r)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition text-xs space-y-1 ${
                      isSelected
                        ? 'bg-blue-50 border-blue-500 shadow-sm ring-1 ring-blue-500'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{r.name}</span>
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-semibold">
                        {r.code}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500">{r.description || 'No description'}</div>
                    <div className="text-[10px] text-blue-700 font-semibold pt-1">
                      {r.code === 'SUPER_ADMIN' ? 'All Permissions (Global Bypass)' : `${r.permissions?.length || 0} permissions granted`}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Permissions Matrix Column */}
          <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 p-6 space-y-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-base text-slate-900">
                    Permissions Matrix: {selectedRoleForPerms?.name}
                  </h3>
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">
                    {selectedRoleForPerms?.code}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Check or uncheck the specific system capabilities granted to users with this role.
                </p>
              </div>

              {currentUser?.role === 'SUPER_ADMIN' && selectedRoleForPerms?.code !== 'SUPER_ADMIN' && (
                <button
                  onClick={handleSaveRolePermissions}
                  disabled={savingRolePerms}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow transition disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingRolePerms ? 'Saving...' : 'Save Permissions'}</span>
                </button>
              )}
            </div>

            {selectedRoleForPerms?.code === 'SUPER_ADMIN' ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <Shield className="w-10 h-10 text-purple-600 mx-auto" />
                <div className="font-bold text-slate-900 text-sm">Super Admin Has Global Unrestricted Access</div>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  The Super Admin / Owner role has absolute permissions across all current and future modules.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(permissionCategories).map(([category, perms]) => (
                  <div key={category} className="space-y-2">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1">
                      {category.replace('_', ' ')} Capabilities
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {perms.map((p) => {
                        const isChecked = rolePermSet.has(p.code);
                        return (
                          <label
                            key={p.code}
                            className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition text-xs ${
                              isChecked
                                ? 'bg-blue-50/50 border-blue-300 ring-1 ring-blue-300'
                                : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleRolePermission(p.code)}
                              className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                            />
                            <div className="space-y-0.5">
                              <div className="font-bold text-slate-900">{p.name}</div>
                              <div className="text-[11px] text-slate-500">{p.description}</div>
                              <div className="text-[10px] font-mono text-slate-400">{p.code}</div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 3: USERS LIST TABLE (ALL / ADMINS / EXECUTIVES / DEACTIVATED) */}
      {['ALL', 'ADMINS', 'EXECUTIVES', 'DEACTIVATED'].includes(activeTab) && (
        <div className="space-y-4">
          {/* Search bar & summary */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search user by name, email, username, or phone number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
              />
            </div>

            <div className="text-xs font-bold text-slate-500">
              Showing <span className="text-slate-900">{users.length}</span> Accounts
            </div>
          </div>

          {/* User Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto min-h-[350px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px] sticky top-0 z-10">
                    <th className="p-3.5 whitespace-nowrap">User Profile</th>
                    <th className="p-3.5 whitespace-nowrap">Role</th>
                    <th className="p-3.5 whitespace-nowrap">Status</th>
                    <th className="p-3.5 whitespace-nowrap">Contact Number</th>
                    <th className="p-3.5 whitespace-nowrap">Joining Date</th>
                    <th className="p-3.5 whitespace-nowrap">Last Login</th>
                    <th className="p-3.5 whitespace-nowrap text-center">Assigned Leads</th>
                    <th className="p-3.5 whitespace-nowrap text-center">Calls Done</th>
                    <th className="p-3.5 whitespace-nowrap text-center">Shortlists</th>
                    <th className="p-3.5 whitespace-nowrap text-right pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="p-12 text-center text-slate-400">Loading users...</td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-12 text-center text-slate-400">No users found matching current filters.</td>
                    </tr>
                  ) : (
                    users.map((u) => {
                      const isSuperAdmin = u.role === 'SUPER_ADMIN';
                      const isDeactivated = u.status === 'DEACTIVATED';
                      return (
                        <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                          {/* Profile */}
                          <td className="p-3.5">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-slate-900 text-white font-bold text-xs flex items-center justify-center shadow-sm flex-shrink-0">
                                {u.name.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                                  <span>{u.name}</span>
                                  {isSuperAdmin && <Shield className="w-3 h-3 text-purple-600" />}
                                </div>
                                <div className="text-[11px] text-slate-500">{u.email}</div>
                                <div className="text-[10px] font-mono text-slate-400">@{u.username || 'user'}</div>
                              </div>
                            </div>
                          </td>

                          {/* Role */}
                          <td className="p-3.5 whitespace-nowrap">
                            <span
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                                u.role === 'SUPER_ADMIN'
                                  ? 'bg-purple-100 text-purple-800'
                                  : u.role === 'ADMIN'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {u.roleName || u.role}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="p-3.5 whitespace-nowrap">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                u.status === 'ACTIVE'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : u.status === 'DEACTIVATED'
                                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}
                            >
                              {u.status}
                            </span>
                          </td>

                          {/* Phone */}
                          <td className="p-3.5 whitespace-nowrap font-mono text-slate-700 font-semibold">
                            {formatPhone(u.phone)}
                          </td>

                          {/* Joining Date */}
                          <td className="p-3.5 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                            {formatDate(u.joiningDate)}
                          </td>

                          {/* Last Login */}
                          <td className="p-3.5 whitespace-nowrap text-slate-400 font-mono text-[11px]">
                            {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'Never'}
                          </td>

                          {/* Stats */}
                          <td className="p-3.5 text-center font-bold text-slate-800">{u.stats?.leadsAssigned || 0}</td>
                          <td className="p-3.5 text-center font-bold text-blue-700">{u.stats?.callsCompleted || 0}</td>
                          <td className="p-3.5 text-center font-bold text-sky-700">{u.stats?.shortlistedCount || 0}</td>

                          {/* Actions */}
                          <td className="p-3.5 text-right pr-4 whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setViewUserModal(u)}
                                className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-blue-600 hover:text-white transition"
                                title="View User 360° Profile"
                              >
                                <Briefcase className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => setEditUserModal(u)}
                                className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
                                title="Edit User Details"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => {
                                  setResetPassModal(u);
                                  setNewPassword('');
                                  setConfirmNewPassword('');
                                  setPassResetMsg(null);
                                }}
                                className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-amber-600 hover:text-white transition"
                                title="Reset User Password"
                              >
                                <KeyRound className="w-3.5 h-3.5" />
                              </button>

                              {!isSuperAdmin && (
                                <>
                                  {isDeactivated ? (
                                    <button
                                      onClick={() => setStatusConfirmModal({ user: u, nextStatus: 'ACTIVE' })}
                                      className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white transition"
                                      title="Reactivate User"
                                    >
                                      <UserCheck className="w-3.5 h-3.5" />
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => setStatusConfirmModal({ user: u, nextStatus: 'DEACTIVATED' })}
                                      className="p-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white transition"
                                      title="Deactivate User (Preserve Data)"
                                    >
                                      <UserX className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: VIEW USER 360 PROFILE */}
      <Modal
        isOpen={!!viewUserModal}
        onClose={() => setViewUserModal(null)}
        maxWidth="md"
        title="User Account Details"
      >
        {viewUserModal && (
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-2xl bg-slate-900 text-white flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white font-black text-lg flex items-center justify-center shadow-lg">
                {viewUserModal.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="space-y-0.5">
                <h3 className="text-base font-black">{viewUserModal.name}</h3>
                <div className="text-slate-400 font-mono">@{viewUserModal.username || 'user'} • {viewUserModal.email}</div>
                <div className="pt-1 flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold uppercase text-[10px]">
                    {viewUserModal.role}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px]">
                    {viewUserModal.status}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Assigned Leads Pool</div>
                <div className="font-bold text-slate-900 text-sm mt-0.5">{viewUserModal.stats?.leadsAssigned || 0} Candidates</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Calls Completed</div>
                <div className="font-bold text-blue-700 text-sm mt-0.5">{viewUserModal.stats?.callsCompleted || 0} Calls</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Shortlisted Qualified</div>
                <div className="font-bold text-sky-700 text-sm mt-0.5">{viewUserModal.stats?.shortlistedCount || 0} Leads</div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Contact Phone:</span>
                <span className="font-mono font-bold text-slate-800">{formatPhone(viewUserModal.phone)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Joining Date:</span>
                <span className="font-mono text-slate-800">{formatDate(viewUserModal.joiningDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Last Login Recorded:</span>
                <span className="font-mono text-slate-800">{viewUserModal.lastLoginAt ? formatDateTime(viewUserModal.lastLoginAt) : 'Never'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Daily Calling Target:</span>
                <span className="font-bold text-slate-800">{viewUserModal.targetCallsDaily} Calls / Day</span>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL 2: EDIT USER */}
      <Modal
        isOpen={!!editUserModal}
        onClose={() => setEditUserModal(null)}
        maxWidth="md"
        title="Edit User Profile"
      >
        {editUserModal && (
          <form onSubmit={handleEditUserSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editUserModal.name}
                  onChange={(e) => setEditUserModal({ ...editUserModal, name: e.target.value })}
                  className="w-full p-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Username</label>
                <input
                  type="text"
                  value={editUserModal.username || ''}
                  onChange={(e) => setEditUserModal({ ...editUserModal, username: e.target.value })}
                  className="w-full p-2 border rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={editUserModal.email}
                  onChange={(e) => setEditUserModal({ ...editUserModal, email: e.target.value })}
                  className="w-full p-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={editUserModal.phone || ''}
                  onChange={(e) => setEditUserModal({ ...editUserModal, phone: e.target.value })}
                  className="w-full p-2 border rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Role</label>
                <select
                  value={editUserModal.role}
                  onChange={(e) => setEditUserModal({ ...editUserModal, role: e.target.value })}
                  disabled={editUserModal.role === 'SUPER_ADMIN' && currentUser?.role !== 'SUPER_ADMIN'}
                  className="w-full p-2 border rounded-lg bg-white"
                >
                  <option value="EXECUTIVE">Telecalling Executive</option>
                  <option value="ADMIN">Admin / Operations Manager</option>
                  {currentUser?.role === 'SUPER_ADMIN' && <option value="SUPER_ADMIN">Super Admin / Owner</option>}
                  <option value="TEAM_LEADER">Team Leader</option>
                  <option value="HR_MANAGER">HR Manager</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Status</label>
                <select
                  value={editUserModal.status}
                  onChange={(e) => setEditUserModal({ ...editUserModal, status: e.target.value as any })}
                  disabled={editUserModal.role === 'SUPER_ADMIN'}
                  className="w-full p-2 border rounded-lg bg-white"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="DEACTIVATED">DEACTIVATED</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Daily Calls Target</label>
                <input
                  type="number"
                  value={editUserModal.targetCallsDaily}
                  onChange={(e) => setEditUserModal({ ...editUserModal, targetCallsDaily: Number(e.target.value) })}
                  className="w-full p-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Daily Shortlist Target</label>
                <input
                  type="number"
                  value={editUserModal.targetShortlistDaily}
                  onChange={(e) => setEditUserModal({ ...editUserModal, targetShortlistDaily: Number(e.target.value) })}
                  className="w-full p-2 border rounded-lg"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setEditUserModal(null)}
                className="px-4 py-2 rounded-lg border text-slate-600 hover:bg-slate-50 font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shadow"
              >
                Save Changes
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* MODAL 3: RESET PASSWORD */}
      <Modal
        isOpen={!!resetPassModal}
        onClose={() => setResetPassModal(null)}
        maxWidth="sm"
        title="Reset User Password"
      >
        {resetPassModal && (
          <form onSubmit={handleResetPasswordSubmit} className="space-y-4 text-xs">
            <p className="text-slate-600">
              Set a new password for <span className="font-bold text-slate-900">{resetPassModal.name}</span> ({resetPassModal.email}).
            </p>

            {passResetMsg && (
              <div className={`p-3 rounded-xl text-xs font-semibold ${passResetMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                {passResetMsg.text}
              </div>
            )}

            <div>
              <label className="block font-semibold text-slate-700 mb-1">New Password</label>
              <input
                type="password"
                required
                placeholder="Minimum 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full p-2.5 border rounded-xl"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Confirm New Password</label>
              <input
                type="password"
                required
                placeholder="Re-enter new password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                className="w-full p-2.5 border rounded-xl"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setResetPassModal(null)}
                className="px-4 py-2 rounded-lg border text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold shadow"
              >
                Reset Password
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* MODAL 4: DEACTIVATION / REACTIVATION CONFIRMATION */}
      <Modal
        isOpen={!!statusConfirmModal}
        onClose={() => setStatusConfirmModal(null)}
        maxWidth="sm"
        title={statusConfirmModal?.nextStatus === 'DEACTIVATED' ? 'Deactivate User Account' : 'Reactivate User Account'}
      >
        {statusConfirmModal && (
          <div className="space-y-4 text-xs">
            {statusConfirmModal.nextStatus === 'DEACTIVATED' ? (
              <div className="space-y-3">
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" /> Are you sure you want to deactivate {statusConfirmModal.user.name}?
                  </div>
                  <p className="mt-1 text-[11px] text-rose-700">
                    The account will be blocked from logging in immediately. All historical call activities, lead assignments, and performance logs will remain permanently preserved.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800">
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Reactivate {statusConfirmModal.user.name}?
                  </div>
                  <p className="mt-1 text-[11px] text-emerald-700">
                    The user will immediately be able to log in and resume their telecalling workspace and assigned leads.
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                onClick={() => setStatusConfirmModal(null)}
                className="px-4 py-2 rounded-lg border text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleStatusChangeConfirm}
                className={`px-5 py-2 rounded-lg text-white font-bold shadow ${
                  statusConfirmModal.nextStatus === 'DEACTIVATED'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {statusConfirmModal.nextStatus === 'DEACTIVATED' ? 'Confirm Deactivation' : 'Confirm Reactivation'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL 5: CREATE NEW CUSTOM ROLE */}
      <Modal
        isOpen={newRoleModalOpen}
        onClose={() => setNewRoleModalOpen(false)}
        maxWidth="md"
        title="Create Custom System Role"
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Role Display Name *</label>
            <input
              type="text"
              placeholder="e.g. Data Entry Operator, Recruiter"
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              className="w-full p-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Role Code (Uppercase Identifier) *</label>
            <input
              type="text"
              placeholder="e.g. DATA_ENTRY_OPERATOR"
              value={newRoleCode}
              onChange={(e) => setNewRoleCode(e.target.value.toUpperCase().replace(/\s+/g, '_'))}
              className="w-full p-2 border rounded-lg font-mono"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Description</label>
            <textarea
              rows={2}
              placeholder="Describe the operational purpose of this role..."
              value={newRoleDesc}
              onChange={(e) => setNewRoleDesc(e.target.value)}
              className="w-full p-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-2">Assign Initial Permissions</label>
            <div className="max-h-56 overflow-y-auto space-y-1.5 p-2 border rounded-lg bg-slate-50">
              {permissions.map((p) => {
                const checked = newRolePerms.has(p.code);
                return (
                  <label key={p.code} className="flex items-center gap-2 p-1.5 hover:bg-white rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        const next = new Set(newRolePerms);
                        if (next.has(p.code)) next.delete(p.code);
                        else next.add(p.code);
                        setNewRolePerms(next);
                      }}
                      className="rounded text-blue-600"
                    />
                    <span className="font-semibold text-slate-800">{p.name}</span>
                    <span className="font-mono text-[10px] text-slate-400">({p.code})</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <button
              onClick={() => setNewRoleModalOpen(false)}
              className="px-4 py-2 rounded-lg border text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateNewRole}
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shadow"
            >
              Create Role
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
