import { useState, useEffect } from 'react';
import {
  Users, Plus, Building2, ChevronRight, ChevronDown, Loader2, X,
  ShieldCheck, UserCheck, UserCog, User, Trash2, RefreshCw
} from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
const authHeader = () => {
  const token = localStorage.getItem('token') || localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const storedUser = () => { try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; } };
const isAdminOrCEO = () => ['admin', 'owner', 'ceo'].includes(storedUser()?.role ?? '');

type HRRole = 'manager' | 'hr' | 'team_leader' | 'member';
const ROLE_LABEL: Record<HRRole, string> = {
  manager: 'Manager', hr: 'HR Officer', team_leader: 'Team Leader', member: 'Member',
};
const ROLE_ICON: Record<HRRole, React.ReactNode> = {
  manager: <ShieldCheck className="w-4 h-4 text-purple-600" />,
  hr: <UserCog className="w-4 h-4 text-blue-600" />,
  team_leader: <UserCheck className="w-4 h-4 text-emerald-600" />,
  member: <User className="w-4 h-4 text-gray-500" />,
};
const ROLE_COLORS: Record<HRRole, string> = {
  manager: 'bg-purple-100 text-purple-700',
  hr: 'bg-blue-100 text-blue-700',
  team_leader: 'bg-emerald-100 text-emerald-700',
  member: 'bg-gray-100 text-gray-600',
};

interface Department { id: string; name: string; description?: string; manager_id?: string; }
interface Member {
  id: string; user_id: string; hr_role: HRRole;
  first_name?: string; last_name?: string; email?: string; reports_to_id?: string;
}

// ── Add Member Modal ──────────────────────────────────────────────────────────
function AddMemberModal({ dept, onClose, onAdded, actorRole }: {
  dept: Department;
  onClose: () => void;
  onAdded: (m: Member) => void;
  actorRole: HRRole | null;
}) {
  const ROLE_CAN_ADD: Record<HRRole, HRRole> = {
    manager: 'hr', hr: 'team_leader', team_leader: 'member', member: 'member',
  };
  const allowedRole: HRRole = actorRole ? ROLE_CAN_ADD[actorRole] : 'member';
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [role, setRole] = useState<HRRole>(isAdminOrCEO() ? 'member' : allowedRole);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const searchUsers = async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return; }
    try {
      const res = await axios.get(`${API_URL}/users?search=${encodeURIComponent(q)}&per_page=10`, { headers: authHeader() });
      setSearchResults(res.data?.items || res.data || []);
    } catch { setSearchResults([]); }
  };

  const handleAdd = async () => {
    if (!selectedUser) { setError('Select a user first'); return; }
    setSaving(true); setError('');
    try {
      const res = await axios.post(`${API_URL}/hr/departments/${dept.id}/members`, {
        user_id: selectedUser.id, hr_role: role,
      }, { headers: authHeader() });
      onAdded({ id: res.data.id, user_id: selectedUser.id, hr_role: role,
        first_name: selectedUser.first_name, last_name: selectedUser.last_name, email: selectedUser.email });
      onClose();
    } catch (e: any) {
      setError(e.response?.data?.detail ?? e.message ?? 'Failed to add member');
    } finally { setSaving(false); }
  };

  const AVAILABLE_ROLES: HRRole[] = isAdminOrCEO()
    ? ['manager', 'hr', 'team_leader', 'member']
    : [allowedRole];

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white">Add Member to {dept.name}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg text-gray-400"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search User</label>
            <input autoFocus className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="Name or email…" value={search}
              onChange={e => { setSearch(e.target.value); searchUsers(e.target.value); setSelectedUser(null); }} />
            {searchResults.length > 0 && !selectedUser && (
              <div className="mt-1 border border-gray-200 rounded-lg overflow-hidden shadow-sm max-h-40 overflow-y-auto">
                {searchResults.map(u => (
                  <button key={u.id} type="button"
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-indigo-50 text-left"
                    onClick={() => { setSelectedUser(u); setSearch(`${u.first_name} ${u.last_name} (${u.email})`); setSearchResults([]); }}>
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                      {u.first_name?.[0] ?? '?'}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{u.first_name} {u.last_name}</p>
                      <p className="text-xs text-gray-400">{u.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">HR Role</label>
            <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={role} onChange={e => setRole(e.target.value as HRRole)}>
              {AVAILABLE_ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-200 rounded-lg py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
            <button type="button" onClick={handleAdd} disabled={!selectedUser || saving}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-2 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Add Member
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Create Department Modal ───────────────────────────────────────────────────
function CreateDeptModal({ onClose, onCreated }: { onClose: () => void; onCreated: (d: Department) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Name required'); return; }
    setSaving(true); setError('');
    try {
      const res = await axios.post(`${API_URL}/hr/departments`, { name, description }, { headers: authHeader() });
      onCreated(res.data); onClose();
    } catch (e: any) { setError(e.response?.data?.detail ?? e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white">New Department</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg text-gray-400"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleCreate} className="p-6 space-y-4">
          {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input autoFocus className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={name} onChange={e => setName(e.target.value)} placeholder="Engineering, Marketing…" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-200 rounded-lg py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-2 text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Department Card ───────────────────────────────────────────────────────────
function DeptCard({ dept, currentUserRole }: { dept: Department; currentUserRole: HRRole | null }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    axios.get(`${API_URL}/hr/departments/${dept.id}/members`, { headers: authHeader() })
      .then(r => setMembers(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dept.id]);

  const handleRemove = async (userId: string) => {
    if (!window.confirm('Remove this member?')) return;
    setRemoving(userId);
    try {
      await axios.delete(`${API_URL}/hr/departments/${dept.id}/members/${userId}`, { headers: authHeader() });
      setMembers(prev => prev.filter(m => m.user_id !== userId));
    } catch (e: any) { alert(e.response?.data?.detail ?? 'Remove failed'); }
    finally { setRemoving(null); }
  };

  const canAddMember = isAdminOrCEO() || (['manager', 'hr', 'team_leader'] as HRRole[]).includes(currentUserRole!);

  const grouped: Record<HRRole, Member[]> = { manager: [], hr: [], team_leader: [], member: [] };
  for (const m of members) { if (grouped[m.hr_role]) grouped[m.hr_role].push(m); }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
      {showAddModal && (
        <AddMemberModal dept={dept} actorRole={currentUserRole}
          onClose={() => setShowAddModal(false)}
          onAdded={m => setMembers(prev => [...prev, m])} />
      )}
      <button onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-6 py-4 text-left hover:bg-gray-50 transition-colors">
        <Building2 className="w-5 h-5 text-indigo-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-800 dark:text-white">{dept.name}</h3>
          {dept.description && <p className="text-xs text-gray-500 truncate">{dept.description}</p>}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">{members.length} members</span>
          {expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {expanded && (
        <div className="px-6 pb-5 pt-2 border-t border-gray-50">
          {loading ? (
            <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-indigo-400" /></div>
          ) : (
            <>
              {/* Hierarchy lanes */}
              {(['manager', 'hr', 'team_leader', 'member'] as HRRole[]).map(lane => {
                const laneMembers = grouped[lane];
                if (laneMembers.length === 0) return null;
                return (
                  <div key={lane} className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      {ROLE_ICON[lane]}
                      <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{ROLE_LABEL[lane]}s</span>
                      <span className="text-xs text-gray-400">({laneMembers.length})</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 ml-6">
                      {laneMembers.map(m => (
                        <div key={m.user_id} className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-50 border border-gray-100 group">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {(m.first_name?.[0] ?? m.email?.[0] ?? '?').toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-800 truncate">{m.first_name} {m.last_name}</p>
                            <p className="text-[10px] text-gray-400 truncate">{m.email}</p>
                          </div>
                          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${ROLE_COLORS[m.hr_role]}`}>
                            {ROLE_LABEL[m.hr_role]}
                          </span>
                          {(isAdminOrCEO() || (currentUserRole && ['manager','hr','team_leader'].includes(currentUserRole))) && (
                            removing === m.user_id
                              ? <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin flex-shrink-0" />
                              : <button onClick={() => handleRemove(m.user_id)}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600 p-0.5 flex-shrink-0">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {canAddMember && (
                <button onClick={() => setShowAddModal(true)}
                  className="w-full mt-2 border-2 border-dashed border-gray-200 hover:border-indigo-300 rounded-xl py-2.5 text-sm text-gray-400 hover:text-indigo-600 transition-colors flex items-center justify-center gap-1.5">
                  <Plus className="w-4 h-4" /> Add Member
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main HR Page ───────────────────────────────────────────────────────────────
export function HRPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const currentUser = storedUser();
  const canManage = isAdminOrCEO() || currentUser?.role === 'manager';

  const loadData = async () => {
    setLoading(true);
    try {
      const [deptsRes, statsRes] = await Promise.all([
        axios.get(`${API_URL}/hr/departments`, { headers: authHeader() }),
        isAdminOrCEO() ? axios.get(`${API_URL}/hr/stats`, { headers: authHeader() }).catch(() => ({ data: null })) : Promise.resolve({ data: null }),
      ]);
      setDepartments(deptsRes.data);
      setStats(statsRes.data);
    } catch (e) { console.error('HR load error:', e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      {showCreate && (
        <CreateDeptModal
          onClose={() => setShowCreate(false)}
          onCreated={d => setDepartments(prev => [...prev, d])} />
      )}

      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Users className="w-7 h-7 text-indigo-600" /> HR & Organisation
            </h1>
            <p className="text-gray-500 text-sm mt-1">Department hierarchy and personnel</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={loadData} className="flex items-center gap-1.5 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            {canManage && (
              <button onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold">
                <Plus className="w-4 h-4" /> New Department
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Departments', value: stats.total_departments, color: 'text-indigo-600' },
              { label: 'Total Staff', value: stats.total_members, color: 'text-gray-800' },
              { label: 'Managers', value: stats.by_role?.manager ?? 0, color: 'text-purple-600' },
              { label: 'Team Leaders', value: stats.by_role?.team_leader ?? 0, color: 'text-emerald-600' },
            ].map(s => (
              <div key={s.label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-4">
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-gray-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Hierarchy rules note */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-6 text-sm text-indigo-700">
          <strong>Hierarchy:</strong> Manager → can add HR Officers · HR Officers → can add Team Leaders · Team Leaders → can add Members · CEO/Admin → can add anyone
        </div>

        {/* Departments */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
          </div>
        ) : departments.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No departments yet</p>
            {canManage && <button onClick={() => setShowCreate(true)} className="mt-3 text-indigo-600 hover:underline text-sm">+ Create first department</button>}
          </div>
        ) : (
          <div className="space-y-4">
            {departments.map(dept => (
              <DeptCard key={dept.id} dept={dept} currentUserRole={null} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
