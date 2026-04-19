import { useState, useEffect } from 'react';
import axios from 'axios';
import { Loader2, UserPlus } from 'lucide-react';
import { useAuthStore, useUIStore } from '@/stores';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

interface Intern {
  id: string;
  name: string;
  email: string;
  college: string;
  duration_months: number;
  status: string;
  created_at: string;
}

export function InternsTab() {
  const { user } = useAuthStore();
  const { addToast } = useUIStore();
  const [interns, setInterns] = useState<Intern[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', college: '', duration_months: 3 });

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/hr-records/interns`, { headers: auth() });
      setInterns(res.data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API}/hr-records/interns`, form, { headers: auth() });
      setInterns(p => [res.data, ...p]);
      setShowModal(false);
      addToast({ type: 'success', title: 'Intern Added' });
    } catch (e: any) {
      addToast({ type: 'error', title: 'Error', message: e.response?.data?.detail });
    }
  };

  const isAdminOrHR = user?.role === 'admin' || user?.role === 'owner' || user?.role === 'hr';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
        <h3 className="text-lg font-bold">Internship Program</h3>
        {isAdminOrHR && (
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold">
            <UserPlus className="w-4 h-4" /> Add Intern
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin" /></div>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100 dark:border-gray-700">
              <th className="text-left px-4 py-3 font-semibold">Intern</th>
              <th className="text-left px-4 py-3 font-semibold">College</th>
              <th className="text-left px-4 py-3 font-semibold">Duration</th>
              <th className="text-left px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
            {interns.map(i => (
              <tr key={i.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-3">
                  <p className="font-medium">{i.name}</p>
                  <p className="text-xs text-gray-500">{i.email}</p>
                </td>
                <td className="px-4 py-3 text-sm">{i.college || '—'}</td>
                <td className="px-4 py-3 text-sm">{i.duration_months} months</td>
                <td className="px-4 py-3 text-sm">
                  <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium uppercase tracking-wide">
                    {i.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold mb-4">Add Intern</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Name" required
                className="w-full border rounded-xl px-3 py-2 text-sm dark:bg-gray-700" />
              <input value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="Email" type="email" required
                className="w-full border rounded-xl px-3 py-2 text-sm dark:bg-gray-700" />
              <input value={form.college} onChange={e => setForm({...form, college: e.target.value})} placeholder="College / University"
                className="w-full border rounded-xl px-3 py-2 text-sm dark:bg-gray-700" />
              <input type="number" value={form.duration_months} onChange={e => setForm({...form, duration_months: parseInt(e.target.value)})} placeholder="Duration (Months)" required
                className="w-full border rounded-xl px-3 py-2 text-sm dark:bg-gray-700" />
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border rounded-xl">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
