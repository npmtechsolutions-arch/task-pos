import { useState, useEffect } from 'react';
import { Plus, ShieldCheck, Loader2, X, RefreshCw, Eye, EyeOff, Trash2, Key } from 'lucide-react';
import axios, { AxiosError } from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1';
const authHeader = () => {
  const token = localStorage.getItem('token') || localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

function getApiErrorMessage(error: unknown): string {
  const err = error as AxiosError<any>;

  if (err.response) {
    const detail = err.response.data?.detail;
    if (Array.isArray(detail)) {
      return detail.map((item) => item?.msg || JSON.stringify(item)).join(', ');
    }
    if (typeof detail === 'string') return detail;
    return `Request failed with status ${err.response.status}`;
  }

  if (err.request) {
    return 'Network error: backend unreachable or blocked by CORS/HTTPS mismatch';
  }

  return err.message || 'Create failed';
}

function isNetworkError(error: unknown): boolean {
  const err = error as AxiosError;
  return !!err.request && !err.response;
}

type UserRole = 'admin' | 'manager' | 'member' | 'viewer' | 'owner';
const ROLES: UserRole[] = ['owner', 'admin', 'manager', 'member', 'viewer'];
const ROLE_COLORS: Record<UserRole, string> = {
  owner: 'bg-purple-100 text-purple-700',
  admin: 'bg-red-100 text-red-700',
  manager: 'bg-orange-100 text-orange-700',
  member: 'bg-blue-100 text-blue-700',
  viewer: 'bg-gray-100 text-gray-600',
};

interface AdminUser {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  title?: string;
  department?: string;
}

interface CustomRole {
  id: string;
  name: string;
  description?: string;
  is_system: boolean;
  created_at: string;
}

// ── Create User Modal ─────────────────────────────────────────────────────────
function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: (u: AdminUser) => void }) {
  const [form, setForm] = useState({
    email: '', first_name: '', last_name: '', password: '',
    role: 'member' as UserRole, title: '', department: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password) { setError('Email and password are required'); return; }
    setSaving(true); setError('');
    const payload = {
      email: form.email,
      first_name: form.first_name,
      last_name: form.last_name,
      password: form.password,
      role: form.role,
      title: form.title || undefined,
      department: form.department || undefined,
    };

    console.log('[CreateUser] API URL:', `${API_URL}/admin/users`);
    console.log('[CreateUser] payload:', payload);
    try {
      const res = await axios.post(`${API_URL}/admin/users`, payload, {
        headers: {
          ...authHeader(),
          'Content-Type': 'application/json',
        },
      });
      onCreated(res.data); onClose();
    } catch (e: unknown) {
      const err = e as AxiosError;
      console.error('[CreateUser] error message:', err.message);
      console.error('[CreateUser] error response:', err.response);
      console.error('[CreateUser] full error object:', err);
      console.error('[CreateUser] frontend origin:', window.location.origin);
      console.error('[CreateUser] resolved API URL:', API_URL);

      // Recovery path: if network dropped after backend committed,
      // verify by email and treat as success to avoid duplicate creation attempts.
      if (isNetworkError(e)) {
        try {
          const check = await axios.get(`${API_URL}/admin/users`, {
            headers: authHeader(),
            params: { search: form.email, per_page: 20 },
          });
          const created = (check.data as AdminUser[]).find(
            (u) => u.email.toLowerCase() === form.email.toLowerCase()
          );
          if (created) {
            console.warn('[CreateUser] recovered after network error: user exists');
            onCreated(created);
            onClose();
            return;
          }
        } catch (verifyError) {
          console.error('[CreateUser] post-error verification failed:', verifyError);
        }
      }

      setError(getApiErrorMessage(e));
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-500" /> Create User
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg text-gray-400"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                value={form.first_name} onChange={set('first_name')} placeholder="John" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                value={form.last_name} onChange={set('last_name')} placeholder="Doe" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <input type="email" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={form.email} onChange={set('email')} placeholder="john@company.com" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                value={form.password} onChange={set('password')} placeholder="Min 8 characters" required />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                value={form.role} onChange={set('role')}>
                {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                value={form.department} onChange={set('department')} placeholder="Engineering" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title / Job Role</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={form.title} onChange={set('title')} placeholder="Senior Developer" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 rounded-lg py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-2 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</> : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Create Role Modal ─────────────────────────────────────────────────────────
function CreateRoleModal({ onClose, onCreated }: { onClose: () => void; onCreated: (r: CustomRole) => void }) {
  const [form, setForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true); setError('');
    try {
      const res = await axios.post(`${API_URL}/rbac/roles`, form, { headers: authHeader() });
      onCreated(res.data); onClose();
    } catch (e: any) {
      setError(e.response?.data?.detail ?? e.message ?? 'Create failed');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Key className="w-5 h-5 text-indigo-500" /> Create Custom Role
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg text-gray-400"><X className="w-5 h-5"/></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role Name *</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Guest Writer" autoFocus required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm" value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="What does this role do?" rows={2} />
          </div>
          <div className="flex gap-3 pt-2">
             <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 hover:bg-gray-50 py-2 rounded-lg text-sm font-medium">Cancel</button>
             <button type="submit" disabled={saving} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center justify-center text-sm font-semibold disabled:opacity-60 gap-2">
               {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Create'}
             </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Reset Password Modal ───────────────────────────────────────────────────────
function ResetPasswordModal({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setSaving(true); setError('');
    try {
      await axios.post(`${API_URL}/admin/users/${user.id}/reset-password`, { new_password: password }, { headers: authHeader() });
      setDone(true);
    } catch (e: any) {
      setError(e.response?.data?.detail ?? e.message);
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-800">Reset Password</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg text-gray-400"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6">
          {done ? (
            <div className="text-center py-4">
              <div className="text-4xl mb-3">✅</div>
              <p className="font-semibold text-gray-800">Password reset successfully!</p>
              <p className="text-sm text-gray-500 mt-1">for {user.email}</p>
              <button onClick={onClose} className="mt-4 bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm">Done</button>
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              <p className="text-sm text-gray-600">Setting new password for <strong>{user.email}</strong></p>
              {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</div>}
              <div className="relative">
                <input type={showPw ? 'text' : 'password'}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  value={password} onChange={e => setPassword(e.target.value)} placeholder="New password" autoFocus />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={onClose} className="flex-1 border border-gray-200 rounded-lg py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-lg py-2 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Reset
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Super Admin Page ──────────────────────────────────────────────────────
export function SuperAdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showCreateRole, setShowCreateRole] = useState(false);
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null);
  const [deactivating, setDeactivating] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users');
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersRes, statsRes, rolesRes] = await Promise.all([
        axios.get(`${API_URL}/admin/users?per_page=100`, { headers: authHeader() }),
        axios.get(`${API_URL}/admin/stats`, { headers: authHeader() }),
        axios.get(`${API_URL}/rbac/roles`, { headers: authHeader() }).catch(() => ({ data: { items: [] } })),
      ]);
      setUsers(usersRes.data);
      setStats(statsRes.data);
      setCustomRoles(rolesRes.data.items || []);
    } catch (e) {
      console.error('Admin fetch failed:', e);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const deactivate = async (user: AdminUser) => {
    if (!window.confirm(`Deactivate ${user.email}?`)) return;
    setDeactivating(user.id);
    try {
      await axios.delete(`${API_URL}/admin/users/${user.id}`, { headers: authHeader() });
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_active: false } : u));
    } catch (e: any) {
      alert(e.response?.data?.detail ?? e.message);
    } finally { setDeactivating(null); }
  };

  const filtered = users.filter(u => {
    const matchSearch = !search || `${u.first_name} ${u.last_name} ${u.email}`.toLowerCase().includes(search.toLowerCase());
    const matchRole = !roleFilter || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={u => setUsers(prev => [u, ...prev])}
        />
      )}
      {resetTarget && (
        <ResetPasswordModal user={resetTarget} onClose={() => setResetTarget(null)} />
      )}

      {/* Page Header */}
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <ShieldCheck className="w-7 h-7 text-indigo-600" /> Super Admin Panel
            </h1>
            <p className="text-gray-500 text-sm mt-1">User management, roles, and access control</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowCreateRole(true)}
              className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-xl text-sm font-semibold transition-colors">
              <Plus className="w-4 h-4 text-gray-500" /> Custom Role
            </button>
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors">
              <Plus className="w-4 h-4" /> Create User
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-6 border-b border-gray-200 mb-6">
          <button
            onClick={() => setActiveTab('users')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'users' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            Users
          </button>
          <button
            onClick={() => setActiveTab('roles')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'roles' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            Custom Roles
          </button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Total Users', value: stats.total_users, color: 'text-indigo-600' },
                { label: 'Active Users', value: stats.active_users, color: 'text-green-600' },
                { label: 'Admins', value: stats.by_role?.admin ?? 0, color: 'text-red-600' },
                { label: 'Members', value: stats.by_role?.member ?? 0, color: 'text-blue-600' },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                  <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-gray-500 mt-1">{s.label}</div>
                </div>
              ))}
            </div>

            {stats.by_custom_role && Object.keys(stats.by_custom_role).length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wider">Department Allocation (By Role)</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {Object.entries(stats.by_custom_role).map(([name, count]: [string, any]) => (
                    <div key={name} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm border-l-4 border-l-indigo-500">
                      <div className="text-xl font-bold text-gray-900">{count}</div>
                      <div className="text-[10px] text-gray-500 uppercase font-medium mt-1 truncate" title={name}>{name}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'users' ? (
          <>
            {/* Filters */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4 flex gap-3 flex-wrap">
              <input className="flex-1 min-w-[200px] border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="Search by name or email…" value={search} onChange={e => setSearch(e.target.value)} />
              <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
                <option value="">All Roles</option>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <button onClick={fetchData} className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
                <RefreshCw className="w-4 h-4" /> Refresh
              </button>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              {loading ? (
                <div className="p-12 text-center text-gray-400">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-indigo-400" />
                  <p>Loading users…</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">User</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Department</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Joined</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 && (
                      <tr><td colSpan={6} className="text-center py-12 text-gray-400">No users found</td></tr>
                    )}
                    {filtered.map(user => (
                      <tr key={user.id} className="border-b border-gray-50 hover:bg-indigo-50/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                              {(user.first_name?.[0] ?? user.email[0]).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-gray-800">{user.first_name} {user.last_name}</p>
                              <p className="text-xs text-gray-400">{user.email}</p>
                              {user.title && <p className="text-xs text-indigo-400">{user.title}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${ROLE_COLORS[user.role] ?? 'bg-gray-100 text-gray-600'}`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{user.department ?? '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium ${user.is_active ? 'text-green-600' : 'text-red-400'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${user.is_active ? 'bg-green-500' : 'bg-red-400'}`} />
                            {user.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">
                          {new Date(user.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 justify-end">
                            <button onClick={() => setResetTarget(user)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Reset Password">
                              <RefreshCw className="w-4 h-4" />
                            </button>
                            {user.is_active && (
                              <button onClick={() => deactivate(user)} disabled={deactivating === user.id}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Deactivate">
                                {deactivating === user.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-gray-400">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-indigo-400" />
                <p>Loading roles…</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Role Name</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {customRoles.length === 0 && (
                    <tr><td colSpan={3} className="text-center py-12 text-gray-400">No custom roles found</td></tr>
                  )}
                  {customRoles.map(role => (
                    <tr key={role.id} className="border-b border-gray-50 hover:bg-indigo-50/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-800">{role.name}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{role.description || '—'}</td>
                      <td className="px-4 py-3">
                        {role.is_system ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600">System</span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-700">Custom</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
      {showCreateRole && (
        <CreateRoleModal
          onClose={() => setShowCreateRole(false)}
          onCreated={r => setCustomRoles(prev => [r, ...prev])}
        />
      )}
    </div>
  );
}
