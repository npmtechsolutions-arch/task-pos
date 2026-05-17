/**
 * InternsTab — Intern Approval Flow
 *
 * HR: add intern (name, email, college, duration, stipend)
 * Admin/Owner: Approve → creates limited VIEWER account + shows credentials
 *              Reject  → archived with reason
 */
import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Loader2, UserPlus, CheckCircle, XCircle, GraduationCap,
  Key, Copy, Check, Eye, EyeOff, Clock,
} from 'lucide-react';
import { useAuthStore, useUIStore } from '@/stores';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('token') || localStorage.getItem('access_token')}` });

interface Intern {
  id: string;
  name: string;
  email: string;
  college?: string;
  duration_months: number;
  stipend?: string;
  approval_status: 'pending' | 'approved' | 'rejected';
  status: string;
  generated_email?: string;
  generated_password?: string;
  created_at: string;
}

const STATUS_STYLE: Record<string, string> = {
  pending:  'bg-yellow-100 text-yellow-700 border-yellow-200',
  approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-100 text-red-700 border-red-200',
};

function CredentialsModal({ intern, onClose }: { intern: Intern; onClose: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);
  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => { setCopied(key); setTimeout(() => setCopied(null), 2000); });
  };
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="bg-gradient-to-br from-violet-500 to-indigo-600 rounded-t-2xl p-6 text-white">
          <div className="flex items-center gap-3 mb-1">
            <GraduationCap className="w-7 h-7" />
            <h3 className="text-xl font-bold">Intern Approved!</h3>
          </div>
          <p className="text-violet-100 text-sm">{intern.name} now has limited system access. Share credentials securely.</p>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 space-y-3">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Intern Email</p>
              <div className="flex items-center gap-2">
                <p className="font-mono text-sm text-gray-800 dark:text-white flex-1">{intern.generated_email}</p>
                <button onClick={() => copy(intern.generated_email!, 'email')}
                  className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-500 transition-colors">
                  {copied === 'email' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Temporary Password</p>
              <div className="flex items-center gap-2">
                <p className="font-mono text-sm text-gray-800 dark:text-white flex-1">
                  {showPw ? intern.generated_password : '•'.repeat((intern.generated_password || '').length)}
                </p>
                <button onClick={() => setShowPw(p => !p)}
                  className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-500 transition-colors">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button onClick={() => copy(intern.generated_password!, 'pw')}
                  className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-500 transition-colors">
                  {copied === 'pw' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
          <p className="text-xs text-amber-600 bg-amber-50 p-3 rounded-xl">
            ⚠️ Intern account has <strong>Viewer</strong> access only. Save these credentials now.
          </p>
          <button onClick={onClose}
            className="w-full bg-violet-600 hover:bg-violet-700 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export function InternsTab() {
  const { user } = useAuthStore();
  const { addToast } = useUIStore();
  const [interns, setInterns] = useState<Intern[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [credTarget, setCredTarget] = useState<Intern | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [form, setForm] = useState({ name: '', email: '', college: '', duration_months: 3, stipend: '' });

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/hr-records/interns`, { headers: auth() });
      setInterns(Array.isArray(res.data) ? res.data : []);
    } catch { }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API}/hr-records/interns`, {
        ...form, stipend: form.stipend || undefined, college: form.college || undefined,
      }, { headers: auth() });
      setInterns(p => [res.data, ...p]);
      setShowModal(false);
      setForm({ name: '', email: '', college: '', duration_months: 3, stipend: '' });
      addToast({ type: 'success', title: 'Intern Added', message: 'Sent to admins for approval' });
    } catch (e: any) {
      addToast({ type: 'error', title: 'Error', message: e.response?.data?.detail });
    }
  };

  const approve = async (intern: Intern) => {
    setActing(intern.id);
    try {
      const res = await axios.post(`${API}/hr-records/interns/${intern.id}/approve`, {}, { headers: auth() });
      const updated: Intern = res.data;
      setInterns(p => p.map(x => x.id === intern.id ? updated : x));
      if (updated.generated_email) setCredTarget(updated);
      addToast({ type: 'success', title: 'Intern Approved' });
    } catch (e: any) {
      addToast({ type: 'error', title: 'Failed', message: e.response?.data?.detail });
    }
    setActing(null);
  };

  const reject = async (id: string) => {
    setActing(id);
    try {
      const res = await axios.post(`${API}/hr-records/interns/${id}/reject`,
        { reason: rejectReason }, { headers: auth() });
      setInterns(p => p.map(x => x.id === id ? res.data : x));
      setRejectId(null);
      setRejectReason('');
      addToast({ type: 'info', title: 'Intern Rejected' });
    } catch (e: any) {
      addToast({ type: 'error', title: 'Failed', message: e.response?.data?.detail });
    }
    setActing(null);
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'owner';
  const isHR = isAdmin || user?.role === 'hr';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
      {credTarget && <CredentialsModal intern={credTarget} onClose={() => setCredTarget(null)} />}

      {/* Reject modal */}
      {rejectId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold mb-3">Reject Intern</h3>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              placeholder="Reason (optional)"
              className="w-full border rounded-xl px-3 py-2 text-sm dark:bg-gray-700 h-20 resize-none mb-3 focus:outline-none focus:ring-2 focus:ring-gray-300" />
            <div className="flex gap-2">
              <button onClick={() => setRejectId(null)}
                className="flex-1 border border-gray-200 rounded-xl py-2 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={() => reject(rejectId)} disabled={!!acting}
                className="flex-1 bg-red-600 text-white rounded-xl py-2 text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
                {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700 flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-violet-500" /> Internship Program
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">Interns get limited Viewer access after admin approval</p>
        </div>
        {isHR && (
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors">
            <UserPlus className="w-4 h-4" /> Add Intern
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-violet-400" /></div>
      ) : interns.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">No interns yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100 dark:border-gray-700">
                <th className="text-left px-4 py-3 font-semibold">Intern</th>
                <th className="text-left px-4 py-3 font-semibold">College</th>
                <th className="text-left px-4 py-3 font-semibold">Duration</th>
                <th className="text-left px-4 py-3 font-semibold">Stipend</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                {isAdmin && <th className="text-right px-4 py-3 font-semibold">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {interns.map(i => (
                <tr key={i.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-sm text-gray-800 dark:text-white">{i.name}</p>
                    <p className="text-xs text-gray-400">{i.email}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{i.college || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-gray-400" /> {i.duration_months}mo
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{i.stipend || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium border capitalize ${STATUS_STYLE[i.approval_status]}`}>
                      {i.approval_status}
                    </span>
                    {i.approval_status === 'approved' && i.generated_email && (
                      <button onClick={() => setCredTarget(i)}
                        className="text-xs text-violet-600 hover:underline mt-0.5 flex items-center gap-1">
                        <Key className="w-3 h-3" /> View Credentials
                      </button>
                    )}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-right">
                      {i.approval_status === 'pending' && (
                        <div className="flex justify-end gap-2">
                          <button onClick={() => approve(i)} disabled={acting === i.id}
                            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors">
                            {acting === i.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                            Approve
                          </button>
                          <button onClick={() => setRejectId(i.id)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg text-xs font-semibold transition-colors">
                            <XCircle className="w-3.5 h-3.5" /> Reject
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Intern Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-violet-500" /> Add Intern
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 p-1">✕</button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1 block">Full Name *</label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="Aryan Sharma" required autoFocus
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-400" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1 block">Personal Email *</label>
                  <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                    placeholder="intern@college.edu" required
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-400" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1 block">College / Institution</label>
                  <input value={form.college} onChange={e => setForm({ ...form, college: e.target.value })}
                    placeholder="IIT Delhi, MIT, etc."
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-400" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1 block">Duration (months) *</label>
                  <input type="number" min={1} max={24} value={form.duration_months}
                    onChange={e => setForm({ ...form, duration_months: parseInt(e.target.value) })}
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-400" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1 block">Stipend</label>
                  <input value={form.stipend} onChange={e => setForm({ ...form, stipend: e.target.value })}
                    placeholder="₹15,000/mo"
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-400" />
                </div>
              </div>
              <div className="bg-violet-50 dark:bg-violet-900/20 rounded-xl p-3 text-xs text-violet-700 dark:text-violet-300">
                On approval, a limited <strong>Viewer</strong> account will be auto-created for this intern.
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 border border-gray-200 rounded-xl py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
                <button type="submit"
                  className="flex-1 bg-violet-600 hover:bg-violet-700 text-white rounded-xl py-2 text-sm font-semibold transition-colors flex items-center justify-center gap-2">
                  <UserPlus className="w-4 h-4" /> Submit for Approval
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
