/**
 * TerminationsTab — Fire Flow
 *
 * HR: submit termination request (select employee, reason, last working day)
 * Admin/Owner: Approve → disables user login + removes from projects
 *              Reject  → request archived with reason
 */
import { useState, useEffect } from 'react';
import axios from 'axios';
import { Loader2, UserX, CheckCircle, XCircle, AlertTriangle, Calendar, FileText } from 'lucide-react';
import { useAuthStore, useUIStore } from '@/stores';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('token') || localStorage.getItem('access_token')}` });

interface TerminationReq {
  id: string;
  target_user_id: string;
  reason?: string;
  last_working_day?: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string;
  created_at: string;
}

interface TenantUser {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: string;
  is_active: boolean;
}

const STATUS_STYLE: Record<string, string> = {
  pending:  'bg-yellow-100 text-yellow-700 border-yellow-200',
  approved: 'bg-red-100 text-red-700 border-red-200',
  rejected: 'bg-gray-100 text-gray-600 border-gray-200',
};

export function TerminationsTab({ users }: { users: TenantUser[] }) {
  const { user } = useAuthStore();
  const { addToast } = useUIStore();
  const [requests, setRequests] = useState<TerminationReq[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<TerminationReq | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [form, setForm] = useState({ target_user_id: '', reason: '', last_working_day: '' });

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/hr-records/terminations`, { headers: auth() });
      setRequests(Array.isArray(res.data) ? res.data : []);
    } catch { }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.target_user_id) return;
    try {
      const payload = {
        target_user_id: form.target_user_id,
        reason: form.reason || undefined,
        last_working_day: form.last_working_day ? new Date(form.last_working_day).toISOString() : undefined,
      };
      const res = await axios.post(`${API}/hr-records/terminations`, payload, { headers: auth() });
      setRequests(p => [res.data, ...p]);
      setShowModal(false);
      setForm({ target_user_id: '', reason: '', last_working_day: '' });
      addToast({ type: 'info', title: 'Termination Request Submitted', message: 'Sent to admins for approval' });
    } catch (e: any) {
      addToast({ type: 'error', title: 'Error', message: e.response?.data?.detail || 'Failed' });
    }
  };

  const approve = async (req: TerminationReq) => {
    if (!window.confirm(`Approve termination? This will immediately disable the employee's account.`)) return;
    setActing(req.id);
    try {
      const res = await axios.post(`${API}/hr-records/terminations/${req.id}/approve`, {}, { headers: auth() });
      setRequests(p => p.map(r => r.id === req.id ? res.data : r));
      addToast({ type: 'success', title: 'Termination Approved', message: "Employee account has been disabled." });
    } catch (e: any) {
      addToast({ type: 'error', title: 'Failed', message: e.response?.data?.detail });
    }
    setActing(null);
  };

  const reject = async (req: TerminationReq) => {
    setActing(req.id);
    try {
      const res = await axios.post(`${API}/hr-records/terminations/${req.id}/reject`,
        { reason: rejectReason }, { headers: auth() });
      setRequests(p => p.map(r => r.id === req.id ? res.data : r));
      setRejectTarget(null);
      setRejectReason('');
      addToast({ type: 'info', title: 'Termination Request Rejected' });
    } catch (e: any) {
      addToast({ type: 'error', title: 'Failed', message: e.response?.data?.detail });
    }
    setActing(null);
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'owner';
  const isHR = isAdmin || user?.role === 'hr';
  const activeEmployees = users.filter(u => u.is_active && u.id !== user?.id);

  const getName = (uid: string) => {
    const u = users.find(x => x.id === uid);
    if (!u) return uid;
    return `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
      {/* Reject modal */}
      {rejectTarget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold mb-1 text-gray-800 dark:text-white">Reject Termination</h3>
            <p className="text-sm text-gray-500 mb-4">For: <strong>{getName(rejectTarget.target_user_id)}</strong></p>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              placeholder="Reason for rejection (optional)"
              className="w-full border rounded-xl px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 h-20 resize-none mb-3 focus:outline-none focus:ring-2 focus:ring-gray-300" />
            <div className="flex gap-2">
              <button onClick={() => setRejectTarget(null)}
                className="flex-1 border border-gray-200 rounded-xl py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={() => reject(rejectTarget)} disabled={!!acting}
                className="flex-1 bg-gray-700 hover:bg-gray-800 text-white rounded-xl py-2 text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
                {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Reject Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700 flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <UserX className="w-5 h-5 text-red-500" /> Termination Requests
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">HR submits → Admin approves → Account disabled automatically</p>
        </div>
        {isHR && (
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors">
            <UserX className="w-4 h-4" /> Request Termination
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-red-400" /></div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <UserX className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">No termination requests</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100 dark:border-gray-700">
                <th className="text-left px-4 py-3 font-semibold">Employee</th>
                <th className="text-left px-4 py-3 font-semibold">Reason</th>
                <th className="text-left px-4 py-3 font-semibold">Last Working Day</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                {isAdmin && <th className="text-right px-4 py-3 font-semibold">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {requests.map(req => (
                <tr key={req.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                        <UserX className="w-4 h-4 text-red-500" />
                      </div>
                      <div>
                        <p className="font-medium text-sm text-gray-800 dark:text-white">{getName(req.target_user_id)}</p>
                        <p className="text-xs text-gray-400">Submitted {new Date(req.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 max-w-xs">
                    {req.reason || <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {req.last_working_day ? new Date(req.last_working_day).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium border capitalize ${STATUS_STYLE[req.status]}`}>
                      {req.status}
                    </span>
                    {req.status === 'rejected' && req.rejection_reason && (
                      <p className="text-xs text-gray-500 mt-1">{req.rejection_reason}</p>
                    )}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-right">
                      {req.status === 'pending' && (
                        <div className="flex justify-end gap-2">
                          <button onClick={() => approve(req)} disabled={acting === req.id}
                            className="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors">
                            {acting === req.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                            Approve
                          </button>
                          <button onClick={() => setRejectTarget(req)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg text-xs font-semibold transition-colors">
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

      {/* Submit Termination Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" /> Request Termination
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 p-1">✕</button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1 block">Select Employee *</label>
                <select value={form.target_user_id} onChange={e => setForm({ ...form, target_user_id: e.target.value })} required
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-red-300">
                  <option value="">— Choose employee —</option>
                  {activeEmployees.map(u => (
                    <option key={u.id} value={u.id}>
                      {`${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email} ({u.role})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1 block">Reason</label>
                <div className="relative">
                  <FileText className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })}
                    placeholder="Performance issues, restructuring, misconduct…"
                    className="w-full pl-9 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-red-300 h-20 resize-none" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1 block">Last Working Day</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <input type="date" value={form.last_working_day} onChange={e => setForm({ ...form, last_working_day: e.target.value })}
                    className="w-full pl-9 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-red-300" />
                </div>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 text-xs text-red-700 dark:text-red-300">
                ⚠️ This request requires Super Admin approval before any action is taken.
                The employee's account will only be disabled after admin approves.
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 border border-gray-200 rounded-xl py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
                <button type="submit"
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl py-2 text-sm font-semibold transition-colors flex items-center justify-center gap-2">
                  <UserX className="w-4 h-4" /> Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
