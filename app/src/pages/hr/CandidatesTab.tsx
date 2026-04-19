import { useState, useEffect } from 'react';
import axios from 'axios';
import { Loader2, UserPlus, CheckCircle, XCircle } from 'lucide-react';
import { useAuthStore, useUIStore } from '@/stores';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

interface Candidate {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
}

export function CandidatesTab() {
  const { user } = useAuthStore();
  const { addToast } = useUIStore();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', role: 'member' });

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/hr-records/candidates`, { headers: auth() });
      setCandidates(res.data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API}/hr-records/candidates`, form, { headers: auth() });
      setCandidates(p => [res.data, ...p]);
      setShowModal(false);
      addToast({ type: 'success', title: 'Candidate Submitted', message: 'Sent to Admins for approval' });
    } catch (e: any) {
      addToast({ type: 'error', title: 'Error', message: e.response?.data?.detail || 'Failed' });
    }
  };

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    try {
      const res = await axios.post(`${API}/hr-records/candidates/${id}/${action}`, {}, { headers: auth() });
      setCandidates(p => p.map(c => c.id === id ? res.data : c));
      addToast({ type: 'success', title: `Candidate ${action}d` });
    } catch (e: any) {
      addToast({ type: 'error', title: 'Admin Required', message: e.response?.data?.detail });
    }
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'owner';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
        <h3 className="text-lg font-bold">Hiring Pipeline</h3>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold">
          <UserPlus className="w-4 h-4" /> Propose Candidate
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin" /></div>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100 dark:border-gray-700">
              <th className="text-left px-4 py-3 font-semibold">Candidate</th>
              <th className="text-left px-4 py-3 font-semibold">Role</th>
              <th className="text-left px-4 py-3 font-semibold">Status</th>
              {isAdmin && <th className="text-right px-4 py-3 font-semibold">Admin Overrides</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
            {candidates.map(c => (
              <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-3">
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-gray-500">{c.email}</p>
                </td>
                <td className="px-4 py-3 text-sm">{c.role}</td>
                <td className="px-4 py-3 text-sm">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium uppercase tracking-wide
                    ${c.status === 'approved' ? 'bg-green-100 text-green-700' :
                      c.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {c.status}
                  </span>
                </td>
                {isAdmin && (
                  <td className="px-4 py-3 text-right">
                    {c.status === 'pending' && (
                      <div className="flex justify-end gap-2">
                        <button onClick={() => handleAction(c.id, 'approve')} title="Approve & Hire"
                          className="p-1.5 bg-emerald-100 text-emerald-600 hover:bg-emerald-200 rounded-lg">
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleAction(c.id, 'reject')} title="Reject"
                          className="p-1.5 bg-rose-100 text-rose-600 hover:bg-rose-200 rounded-lg">
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold mb-4">Propose Setup</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Name" required
                className="w-full border rounded-xl px-3 py-2 text-sm dark:bg-gray-700" />
              <input value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="Email" type="email" required
                className="w-full border rounded-xl px-3 py-2 text-sm dark:bg-gray-700" />
              <select value={form.role} onChange={e => setForm({...form, role: e.target.value})}
                className="w-full border rounded-xl px-3 py-2 text-sm dark:bg-gray-700">
                <option value="member">Member</option>
                <option value="manager">Manager</option>
                <option value="hr">HR</option>
              </select>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border rounded-xl">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl">Submit</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
