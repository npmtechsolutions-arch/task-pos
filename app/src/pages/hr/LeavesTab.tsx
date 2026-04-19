import { useState, useEffect } from 'react';
import axios from 'axios';
import { Loader2, Plus, CheckCircle, XCircle } from 'lucide-react';
import { useAuthStore, useUIStore } from '@/stores';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

interface Leave {
  id: string;
  user_id: string;
  from_date: string;
  to_date: string;
  reason: string;
  status: string;
  created_at: string;
}

export function LeavesTab() {
  const { user } = useAuthStore();
  const { addToast } = useUIStore();
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ from_date: '', to_date: '', reason: '' });

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/hr-records/leaves`, { headers: auth() });
      setLeaves(res.data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API}/hr-records/leaves`, form, { headers: auth() });
      setLeaves(p => [res.data, ...p]);
      setShowModal(false);
      addToast({ type: 'success', title: 'Leave Applied', message: 'Sent for approval' });
    } catch (e: any) {
      addToast({ type: 'error', title: 'Error', message: e.response?.data?.detail });
    }
  };

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    try {
      const res = await axios.post(`${API}/hr-records/leaves/${id}/${action}`, {}, { headers: auth() });
      setLeaves(p => p.map(l => l.id === id ? res.data : l));
      addToast({ type: 'success', title: `Leave ${action}d` });
    } catch (e: any) {
      addToast({ type: 'error', title: 'Approval Failed', message: e.response?.data?.detail });
    }
  };

  const canApprove = user?.role === 'admin' || user?.role === 'owner' || user?.role === 'hr';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
        <h3 className="text-lg font-bold">Leave Requests</h3>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold">
          <Plus className="w-4 h-4" /> Apply Leave
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin" /></div>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100 dark:border-gray-700">
              <th className="text-left px-4 py-3 font-semibold">Dates</th>
              <th className="text-left px-4 py-3 font-semibold">Reason</th>
              <th className="text-left px-4 py-3 font-semibold">Status</th>
              {canApprove && <th className="text-right px-4 py-3 font-semibold">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
            {leaves.map(l => (
              <tr key={l.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-3 text-sm">
                  {new Date(l.from_date).toLocaleDateString()} &rarr; {new Date(l.to_date).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-sm">{l.reason}</td>
                <td className="px-4 py-3 text-sm">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium uppercase tracking-wide
                    ${l.status === 'approved' ? 'bg-green-100 text-green-700' :
                      l.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {l.status}
                  </span>
                </td>
                {canApprove && (
                  <td className="px-4 py-3 text-right">
                    {l.status === 'pending' && (
                      <div className="flex justify-end gap-2">
                        <button onClick={() => handleAction(l.id, 'approve')}
                          className="p-1.5 bg-emerald-100 text-emerald-600 hover:bg-emerald-200 rounded-lg">
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleAction(l.id, 'reject')}
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
            <h3 className="text-lg font-bold mb-4">Apply Leave</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <input type="datetime-local" value={form.from_date} onChange={e => setForm({...form, from_date: e.target.value})} required
                className="w-full border rounded-xl px-3 py-2 text-sm dark:bg-gray-700" />
              <input type="datetime-local" value={form.to_date} onChange={e => setForm({...form, to_date: e.target.value})} required
                className="w-full border rounded-xl px-3 py-2 text-sm dark:bg-gray-700" />
              <textarea value={form.reason} onChange={e => setForm({...form, reason: e.target.value})} placeholder="Reason for leave..." required
                className="w-full border rounded-xl px-3 py-2 text-sm dark:bg-gray-700 h-24" />
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
