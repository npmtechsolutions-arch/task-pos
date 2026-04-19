/**
 * HRPage — Complete HR & Organisation management
 * Features: User list, Create user, Edit role/dept, Deactivate, Department management
 */
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Users, Plus, Search, RefreshCw, Building2, UserCheck, UserX,
  Edit3, Trash2, X, Loader2, ChevronDown, Shield, Mail,
  Phone, Calendar, Star, AlertCircle, Check, Eye, EyeOff,
  Download, Filter, MoreVertical, UserPlus
} from 'lucide-react';
import { cn } from '@/lib/utils';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
const auth = () => {
  const t = localStorage.getItem('token') || localStorage.getItem('access_token');
  return t ? { Authorization: `Bearer ${t}` } : {};
};
const storedUser = () => { try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; } };
const isAdmin = () => ['admin', 'owner'].includes(storedUser()?.role);

// ── Types ──────────────────────────────────────────────────────────────────────
interface TenantUser {
  id: string; email: string; first_name?: string; last_name?: string;
  role: string; status?: string; is_active: boolean;
  created_at?: string; title?: string; department?: string | null;
}
interface Department {
  id: string; name: string; description?: string; head_id?: string;
  member_count?: number;
}

const ROLE_COLORS: Record<string, string> = {
  owner:   'bg-purple-100 text-purple-700 border-purple-200',
  admin:   'bg-red-100 text-red-700 border-red-200',
  manager: 'bg-orange-100 text-orange-700 border-orange-200',
  member:  'bg-blue-100 text-blue-700 border-blue-200',
  viewer:  'bg-gray-100 text-gray-600 border-gray-200',
};
const STATUS_COLORS: Record<string, string> = {
  active:    'bg-emerald-100 text-emerald-700',
  inactive:  'bg-gray-100 text-gray-500',
  suspended: 'bg-red-100 text-red-600',
  pending:   'bg-yellow-100 text-yellow-700',
};

// ── Create / Edit User Modal ──────────────────────────────────────────────────
function UserModal({
  user, departments, onClose, onSaved
}: {
  user?: TenantUser | null;
  departments: Department[];
  onClose: () => void;
  onSaved: (u: TenantUser) => void;
}) {
  const isEdit = !!user;
  const [form, setForm] = useState({
    first_name: user?.first_name || '',
    last_name:  user?.last_name  || '',
    email:      user?.email      || '',
    password:   '',
    role:       user?.role       || 'member',
    title:      user?.title      || '',
    department: user?.department || '',
  });
  const [showPwd, setShowPwd] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email)      { setError('Email is required'); return; }
    if (!isEdit && !form.password) { setError('Password is required for new users'); return; }
    setSaving(true); setError('');
    try {
      const payload: any = {
        first_name: form.first_name || undefined,
        last_name:  form.last_name  || undefined,
        email:      form.email,
        role:       form.role,
        title:      form.title      || undefined,
        department: form.department || undefined,
      };
      if (!isEdit) payload.password = form.password;

      let res;
      if (isEdit) {
        res = await axios.patch(`${API}/admin/users/${user!.id}`, payload, { headers: auth() });
      } else {
        res = await axios.post(`${API}/hr/users`, { ...payload, password: form.password }, { headers: auth() });
      }
      onSaved(res.data);
    } catch (e: any) { setError(e.response?.data?.detail ?? e.message ?? 'Operation failed'); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-indigo-500" />
            {isEdit ? 'Edit User' : 'Add New User'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-xl p-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">First Name</label>
              <input autoFocus value={form.first_name} onChange={set('first_name')} placeholder="John"
                className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:bg-gray-700 dark:text-white" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Last Name</label>
              <input value={form.last_name} onChange={set('last_name')} placeholder="Doe"
                className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:bg-gray-700 dark:text-white" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Email *</label>
            <input type="email" value={form.email} onChange={set('email')} placeholder="john@company.com" required
              className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:bg-gray-700 dark:text-white" />
          </div>
          {!isEdit && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Password *</label>
              <div className="relative">
                <input type={showPwd ? 'text' : 'password'} value={form.password} onChange={set('password')}
                  placeholder="Min 8 characters" required
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:bg-gray-700 dark:text-white" />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Role</label>
              <select value={form.role} onChange={set('role')}
                className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:bg-gray-700 dark:text-white">
                <option value="member">Member</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Department</label>
              <select value={form.department} onChange={set('department')}
                className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:bg-gray-700 dark:text-white">
                <option value="">No Department</option>
                {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Job Title</label>
            <input value={form.title} onChange={set('title')} placeholder="e.g. Senior Developer"
              className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:bg-gray-700 dark:text-white" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" id="btn-save-user" disabled={saving}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2.5 text-sm font-semibold
                         disabled:opacity-60 flex items-center justify-center gap-2 transition-colors">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {isEdit ? 'Save Changes' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Department Modal ───────────────────────────────────────────────────────────
function DepartmentModal({ onClose, onCreated }: { onClose: () => void; onCreated: (d: Department) => void }) {
  const [name, setName]   = useState('');
  const [desc, setDesc]   = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError]  = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Department name is required'); return; }
    setSaving(true); setError('');
    try {
      const res = await axios.post(`${API}/hr/departments`, { name, description: desc || undefined }, { headers: auth() });
      onCreated(res.data);
    } catch (e: any) { setError(e.response?.data?.detail ?? e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-500" /> New Department
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg text-gray-400"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="text-sm text-red-600 bg-red-50 rounded-xl p-3">{error}</div>}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Name *</label>
            <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Engineering, Marketing…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Description</label>
            <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Optional description"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-2.5 text-sm font-semibold
                         disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main HR Page ───────────────────────────────────────────────────────────────
export function HRPage() {
  const [users, setUsers]         = useState<TenantUser[]>([]);
  const [departments, setDepts]   = useState<Department[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [roleFilter, setRole]     = useState('all');
  const [tab, setTab]             = useState<'users' | 'departments'>('users');
  const [showUserModal, setShowUserModal]   = useState(false);
  const [showDeptModal, setShowDeptModal]   = useState(false);
  const [editingUser, setEditingUser]       = useState<TenantUser | null>(null);
  const canManage = isAdmin();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ur, dr] = await Promise.all([
        axios.get(`${API}/hr/users`, { headers: auth() }),
        axios.get(`${API}/hr/departments`, { headers: auth() }).catch(() => ({ data: [] })),
      ]);
      setUsers(ur.data || []);
      setDepts(dr.data || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, []);

  const deactivateUser = async (uid: string) => {
    if (!confirm('Deactivate this user? They will lose system access.')) return;
    try {
      await axios.patch(`${API}/admin/users/${uid}`, { is_active: false }, { headers: auth() });
      setUsers(prev => prev.map(u => u.id === uid ? { ...u, is_active: false } : u));
    } catch (e: any) { alert(e.response?.data?.detail ?? 'Failed'); }
  };

  const activateUser = async (uid: string) => {
    try {
      await axios.patch(`${API}/admin/users/${uid}`, { is_active: true }, { headers: auth() });
      setUsers(prev => prev.map(u => u.id === uid ? { ...u, is_active: true } : u));
    } catch (e: any) { alert(e.response?.data?.detail ?? 'Failed'); }
  };

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const name = `${u.first_name || ''} ${u.last_name || ''} ${u.email}`.toLowerCase();
    const matchSearch = !q || name.includes(q);
    const matchRole   = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const stats = {
    total:    users.length,
    active:   users.filter(u => u.is_active).length,
    admins:   users.filter(u => ['admin','owner'].includes(u.role)).length,
    managers: users.filter(u => u.role === 'manager').length,
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      {/* Modals */}
      {(showUserModal || editingUser) && (
        <UserModal
          user={editingUser}
          departments={departments}
          onClose={() => { setShowUserModal(false); setEditingUser(null); }}
          onSaved={u => {
            setUsers(prev => editingUser
              ? prev.map(x => x.id === u.id ? u : x)
              : [...prev, u]
            );
            setShowUserModal(false); setEditingUser(null);
          }}
        />
      )}
      {showDeptModal && (
        <DepartmentModal
          onClose={() => setShowDeptModal(false)}
          onCreated={d => { setDepts(prev => [...prev, d]); setShowDeptModal(false); }}
        />
      )}

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">HR & Organisation</h1>
            <p className="text-gray-500 text-sm mt-0.5">Manage team members, roles, and departments</p>
          </div>
          <div className="flex items-center gap-2.5">
            <button onClick={load}
              className="flex items-center gap-1.5 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 transition-colors">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            {canManage && tab === 'departments' && (
              <button id="btn-new-dept" onClick={() => setShowDeptModal(true)}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors">
                <Plus className="w-4 h-4" /> New Department
              </button>
            )}
            {canManage && tab === 'users' && (
              <button id="btn-add-user" onClick={() => setShowUserModal(true)}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors">
                <UserPlus className="w-4 h-4" /> Add User
              </button>
            )}
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Users',   value: stats.total,    color: 'from-indigo-500 to-blue-600',    icon: Users },
            { label: 'Active',        value: stats.active,   color: 'from-emerald-500 to-teal-600',   icon: UserCheck },
            { label: 'Admins',        value: stats.admins,   color: 'from-red-500 to-rose-600',       icon: Shield },
            { label: 'Managers',      value: stats.managers, color: 'from-orange-500 to-amber-600',   icon: Star },
          ].map(s => (
            <div key={s.label} className={`bg-gradient-to-br ${s.color} rounded-2xl p-4 text-white shadow-md`}>
              <s.icon className="w-5 h-5 opacity-80 mb-2" />
              <div className="text-2xl font-bold">{loading ? '—' : s.value}</div>
              <div className="text-xs opacity-80 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit">
          {(['users', 'departments'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize',
                tab === t ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-700')}>
              {t === 'users' ? `Users (${users.length})` : `Departments (${departments.length})`}
            </button>
          ))}
        </div>

        {/* Users Tab */}
        {tab === 'users' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            {/* Filters */}
            <div className="flex items-center gap-3 p-4 border-b border-gray-100 dark:border-gray-700">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name or email…"
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:bg-gray-700 dark:text-white" />
              </div>
              <select value={roleFilter} onChange={e => setRole(e.target.value)}
                className="border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
                <option value="all">All Roles</option>
                <option value="owner">Owner</option>
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
              </select>
              <span className="text-sm text-gray-500">{filtered.length} of {users.length}</span>
            </div>

            {/* User Table */}
            {loading ? (
              <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-indigo-400" /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="font-medium">No users found</p>
                {canManage && <button onClick={() => setShowUserModal(true)}
                  className="mt-2 text-indigo-600 text-sm hover:underline">+ Add the first user</button>}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100 dark:border-gray-700">
                      <th className="text-left px-4 py-3 font-semibold">User</th>
                      <th className="text-left px-4 py-3 font-semibold">Role</th>
                      <th className="text-left px-4 py-3 font-semibold">Department</th>
                      <th className="text-left px-4 py-3 font-semibold">Status</th>
                      <th className="text-left px-4 py-3 font-semibold">Joined</th>
                      {canManage && <th className="text-right px-4 py-3 font-semibold">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                    {filtered.map(u => {
                      const name = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email;
                      const initials = (u.first_name?.[0] || u.email[0]).toUpperCase() + (u.last_name?.[0] || '').toUpperCase();
                      return (
                        <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                                {initials}
                              </div>
                              <div>
                                <p className="font-medium text-gray-800 dark:text-white text-sm">{name}</p>
                                <p className="text-xs text-gray-400">{u.email}</p>
                                {u.title && <p className="text-xs text-gray-500 italic">{u.title}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn('text-xs px-2.5 py-1 rounded-full font-medium border capitalize', ROLE_COLORS[u.role] || ROLE_COLORS.member)}>
                              {u.role}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                            {u.department || <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn('text-xs px-2.5 py-1 rounded-full font-medium capitalize',
                              u.is_active ? STATUS_COLORS.active : STATUS_COLORS.inactive)}>
                              {u.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-400">
                            {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                          </td>
                          {canManage && (
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-1.5">
                                <button onClick={() => setEditingUser(u)}
                                  className="p-1.5 hover:bg-indigo-50 rounded-lg text-indigo-500 transition-colors" title="Edit">
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                {u.is_active ? (
                                  <button onClick={() => deactivateUser(u.id)}
                                    className="p-1.5 hover:bg-red-50 rounded-lg text-red-400 transition-colors" title="Deactivate">
                                    <UserX className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  <button onClick={() => activateUser(u.id)}
                                    className="p-1.5 hover:bg-emerald-50 rounded-lg text-emerald-500 transition-colors" title="Activate">
                                    <UserCheck className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Departments Tab */}
        {tab === 'departments' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading ? (
              <div className="col-span-3 flex justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
              </div>
            ) : departments.length === 0 ? (
              <div className="col-span-3 text-center py-16 text-gray-400">
                <Building2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="font-medium">No departments yet</p>
                {canManage && <button onClick={() => setShowDeptModal(true)}
                  className="mt-2 text-emerald-600 text-sm hover:underline">+ Create first department</button>}
              </div>
            ) : departments.map(d => {
              const deptUsers = users.filter(u => u.department === d.name);
              return (
                <div key={d.id}
                  className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-lg">
                      {deptUsers.length} member{deptUsers.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <h3 className="font-bold text-gray-800 dark:text-white">{d.name}</h3>
                  {d.description && <p className="text-xs text-gray-500 mt-1">{d.description}</p>}
                  {deptUsers.length > 0 && (
                    <div className="mt-3 flex -space-x-2">
                      {deptUsers.slice(0, 5).map(u => (
                        <div key={u.id}
                          className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 border-2 border-white flex items-center justify-center text-white text-xs font-bold"
                          title={`${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email}>
                          {(u.first_name?.[0] || u.email[0]).toUpperCase()}
                        </div>
                      ))}
                      {deptUsers.length > 5 && (
                        <div className="w-7 h-7 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-gray-600 text-xs font-bold">
                          +{deptUsers.length - 5}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {canManage && (
              <button onClick={() => setShowDeptModal(true)}
                className="border-2 border-dashed border-gray-200 rounded-2xl p-5 flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-emerald-400 hover:text-emerald-500 transition-colors min-h-[140px]">
                <Plus className="w-8 h-8" />
                <span className="text-sm font-medium">Add Department</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
