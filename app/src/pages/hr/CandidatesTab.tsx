/**
 * CandidatesTab — Hire Flow
 *
 * HR: submit hire form (name, personal email, job title, role, join date, resume)
 * Admin/Owner: Approve → auto-creates user + shows credentials
 *              Reject  → notifies HR with reason
 */
import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Loader2, UserPlus, CheckCircle, XCircle, Eye, EyeOff,
  Calendar, Briefcase, Mail, Link2, Clock, Key, Copy, Check,
} from 'lucide-react';
import { useAuthStore, useUIStore } from '@/stores';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('token') || localStorage.getItem('access_token')}` });

interface Candidate {
  id: string;
  name: string;
  email: string;
  role: string;
  job_title?: string;
  join_date?: string;
  resume_url?: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string;
  generated_email?: string;
  generated_password?: string;
  created_at: string;
}

const STATUS_STYLE: Record<string, string> = {
  pending:  'bg-yellow-100 text-yellow-700 border-yellow-200',
  approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-100 text-red-700 border-red-200',
};

// ── Credentials Modal (shown after approval) ─────────────────────────────────
function CredentialsModal({ c, onClose }: { c: Candidate; onClose: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-t-2xl p-6 text-white">
          <div className="flex items-center gap-3 mb-1">
            <CheckCircle className="w-7 h-7" />
            <h3 className="text-xl font-bold">Hire Approved!</h3>
          </div>
          <p className="text-emerald-100 text-sm">{c.name} is now a system user. Share these credentials securely.</p>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 space-y-3">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Company Email</p>
              <div className="flex items-center gap-2">
                <p className="font-mono text-sm text-gray-800 dark:text-white flex-1">{c.generated_email}</p>
                <button onClick={() => copy(c.generated_email!, 'email')}
                  className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-500 transition-colors">
                  {copied === 'email' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Temporary Password</p>
              <div className="flex items-center gap-2">
                <p className="font-mono text-sm text-gray-800 dark:text-white flex-1">
                  {showPw ? c.generated_password : '•'.repeat((c.generated_password || '').length)}
                </p>
                <button onClick={() => setShowPw(p => !p)}
                  className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-500 transition-colors">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button onClick={() => copy(c.generated_password!, 'pw')}
                  className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-500 transition-colors">
                  {copied === 'pw' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
          <p className="text-xs text-amber-600 bg-amber-50 p-3 rounded-xl">
            ⚠️ Save these credentials now — the password will not be shown again.
          </p>
          <button onClick={onClose}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Reject Modal ─────────────────────────────────────────────────────────────
function RejectModal({ id, name, onClose, onRejected }: {
  id: string; name: string; onClose: () => void; onRejected: (c: Candidate) => void;
}) {
  const { addToast } = useUIStore();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await axios.post(`${API}/hr-records/candidates/${id}/reject`, { reason }, { headers: auth() });
      onRejected(res.data);
      addToast({ type: 'info', title: 'Candidate Rejected' });
    } catch (e: any) {
      addToast({ type: 'error', title: 'Error', message: e.response?.data?.detail });
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="text-lg font-bold mb-1 text-red-600">Reject Hire Request</h3>
        <p className="text-sm text-gray-500 mb-4">Rejecting: <strong>{name}</strong></p>
        <form onSubmit={submit} className="space-y-3">
          <textarea value={reason} onChange={e => setReason(e.target.value)}
            placeholder="Reason for rejection (optional)"
            className="w-full border rounded-xl px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 h-24 resize-none focus:outline-none focus:ring-2 focus:ring-red-300" />
          <div className="flex gap-2">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-200 rounded-xl py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl py-2 text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Reject
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export function CandidatesTab() {
  const { user } = useAuthStore();
  const { addToast } = useUIStore();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [approving, setApproving] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Candidate | null>(null);
  const [credTarget, setCredTarget] = useState<Candidate | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [form, setForm] = useState({
    name: '', email: '', role: 'member', job_title: '', join_date: '', resume_url: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/hr-records/candidates`, { headers: auth() });
      setCandidates(Array.isArray(res.data) ? res.data : res.data.items ?? []);
    } catch { }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        join_date: form.join_date ? new Date(form.join_date).toISOString() : undefined,
        resume_url: form.resume_url || undefined,
        job_title: form.job_title || undefined,
      };
      const res = await axios.post(`${API}/hr-records/candidates`, payload, { headers: auth() });
      setCandidates(p => [res.data, ...p]);
      setShowModal(false);
      setForm({ name: '', email: '', role: 'member', job_title: '', join_date: '', resume_url: '' });
      addToast({ type: 'success', title: '✅ Request Sent Successfully', message: 'Hiring request sent to Super Admin for approval' });
    } catch (e: any) {
      addToast({ type: 'error', title: 'Error', message: e.response?.data?.detail || 'Failed to submit' });
    } finally {
      setSubmitting(false);
    }
  };

  const approve = async (c: Candidate) => {
    setApproving(c.id);
    try {
      const res = await axios.post(`${API}/hr-records/candidates/${c.id}/approve`, {}, { headers: auth() });
      const updated: Candidate = res.data;
      setCandidates(p => p.map(x => x.id === c.id ? updated : x));
      if (updated.generated_email) setCredTarget(updated);
      addToast({ type: 'success', title: 'Candidate Approved', message: `User account created for ${c.name}` });
    } catch (e: any) {
      addToast({ type: 'error', title: 'Approval Failed', message: e.response?.data?.detail });
    }
    setApproving(null);
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'owner';
  const isHR = isAdmin || user?.role === 'hr';

  const visible = candidates.filter(c =>
    filterStatus === 'all' || c.status === filterStatus
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
      {/* Credentials modal */}
      {credTarget && <CredentialsModal c={credTarget} onClose={() => setCredTarget(null)} />}
      {/* Reject modal */}
      {rejectTarget && (
        <RejectModal
          id={rejectTarget.id} name={rejectTarget.name}
          onClose={() => setRejectTarget(null)}
          onRejected={updated => { setCandidates(p => p.map(x => x.id === updated.id ? updated : x)); setRejectTarget(null); }}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700 flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-bold text-gray-800 dark:text-white">Hiring Pipeline</h3>
          <p className="text-xs text-gray-500 mt-0.5">Propose candidates → Admin approves → Auto-creates user account</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs dark:bg-gray-700 dark:border-gray-600 focus:outline-none">
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          {isHR && (
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors">
              <UserPlus className="w-4 h-4" /> Propose Hire
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-emerald-400" /></div>
      ) : visible.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <UserPlus className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">No candidates yet</p>
          {isHR && <button onClick={() => setShowModal(true)} className="mt-2 text-emerald-600 text-sm hover:underline">+ Propose a hire</button>}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100 dark:border-gray-700">
                <th className="text-left px-4 py-3 font-semibold">Candidate</th>
                <th className="text-left px-4 py-3 font-semibold">Job Title</th>
                <th className="text-left px-4 py-3 font-semibold">Join Date</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="text-right px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {visible.map(c => (
                <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800 dark:text-white text-sm">{c.name}</p>
                    <p className="text-xs text-gray-400">{c.email}</p>
                    {c.resume_url && (
                      <a href={c.resume_url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-indigo-500 hover:underline flex items-center gap-1 mt-0.5">
                        <Link2 className="w-3 h-3" /> Resume
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-gray-700 dark:text-gray-300">{c.job_title || '—'}</p>
                    <p className="text-xs text-gray-400 capitalize">{c.role}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {c.join_date ? new Date(c.join_date).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium border capitalize ${STATUS_STYLE[c.status]}`}>
                      {c.status}
                    </span>
                    {c.status === 'rejected' && c.rejection_reason && (
                      <p className="text-xs text-red-500 mt-1">{c.rejection_reason}</p>
                    )}
                    {c.status === 'approved' && c.generated_email && (
                      <button onClick={() => setCredTarget(c)}
                        className="text-xs text-emerald-600 hover:underline mt-0.5 flex items-center gap-1">
                        <Key className="w-3 h-3" /> View Credentials
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {c.status === 'pending' && isAdmin && (
                      <div className="flex justify-end gap-2">
                        <button onClick={() => approve(c)} disabled={approving === c.id}
                          title="Approve & Create User"
                          className="flex items-center gap-1 px-3 py-1.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors">
                          {approving === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                          Approve
                        </button>
                        <button onClick={() => setRejectTarget(c)} title="Reject"
                          className="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg text-xs font-semibold transition-colors">
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </button>
                      </div>
                    )}
                    {c.status !== 'pending' && (
                      <span className="text-xs text-gray-400">{new Date(c.created_at).toLocaleDateString()}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Hire Proposal Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-500" /> Propose a Hire
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 p-1">✕</button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1 block">Full Name *</label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="Rishie Kumar" required autoFocus
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1 block">Personal Email *</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                    <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                      placeholder="candidate@gmail.com" required
                      className="w-full pl-9 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1 block">Job Title</label>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                    <input value={form.job_title} onChange={e => setForm({ ...form, job_title: e.target.value })}
                      placeholder="Sr. Developer"
                      className="w-full pl-9 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1 block">System Role</label>
                  <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-400">
                    <option value="member">Member</option>
                    <option value="manager">Manager</option>
                    <option value="viewer">Viewer</option>
                    <option value="hr">HR</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1 block">Date of Joining</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                    <input type="date" value={form.join_date} onChange={e => setForm({ ...form, join_date: e.target.value })}
                      className="w-full pl-9 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1 block">Resume URL</label>
                  <div className="relative">
                    <Link2 className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                    <input value={form.resume_url} onChange={e => setForm({ ...form, resume_url: e.target.value })}
                      placeholder="https://drive.google.com/…"
                      className="w-full pl-9 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                  </div>
                </div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-xs text-blue-700 dark:text-blue-300">
                After submission, Admins receive a notification and can approve or reject this request.
                On approval, a company email + temporary password will be auto-generated.
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 border border-gray-200 rounded-xl py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={submitting}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-2.5 text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed relative overflow-hidden">
                  {submitting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
                  ) : (
                    <><UserPlus className="w-4 h-4" /> Submit for Approval</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
