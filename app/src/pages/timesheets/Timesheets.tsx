import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import {
  Clock, Plus, Send, CheckCircle2, XCircle, ChevronLeft,
  ChevronRight, Trash2, RefreshCw, BarChart3, Timer, DollarSign
} from 'lucide-react';
import { useAuthStore } from '@/stores';
import {
  getCurrentWeekTimesheet, getMyTimesheets, getAllTimesheets,
  addEntry, deleteEntry, submitTimesheet, approveTimesheet,
  rejectTimesheet, type Timesheet, type TimesheetEntry, type ActivityType
} from '@/api/timesheets';

const ACTIVITY_OPTIONS: { value: ActivityType; label: string }[] = [
  { value: 'development', label: 'Development' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'research', label: 'Research' },
  { value: 'review', label: 'Code Review' },
  { value: 'testing', label: 'Testing' },
  { value: 'design', label: 'Design' },
  { value: 'documentation', label: 'Docs' },
  { value: 'other', label: 'Other' },
];

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  submitted: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function TimesheetsPage() {
  const { token, user } = useAuthStore();
  const isAdmin = ['admin', 'owner', 'manager'].includes(user?.role ?? '');

  const [view, setView] = useState<'my' | 'admin'>('my');
  const [currentSheet, setCurrentSheet] = useState<Timesheet | null>(null);
  const [adminSheets, setAdminSheets] = useState<Timesheet[]>([]);
  const [selectedAdmin, setSelectedAdmin] = useState<Timesheet | null>(null);
  const [loading, setLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState<string | null>(null);

  // Timer state
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // New entry form
  const [entryForm, setEntryForm] = useState({
    hours: '', description: '', activity_type: 'development' as ActivityType,
    is_billable: true, task_id: '', project_id: '',
  });
  const [showForm, setShowForm] = useState(false);

  const loadCurrentWeek = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const sheet = await getCurrentWeekTimesheet(token);
      setCurrentSheet(sheet);
    } catch { toast.error('Failed to load timesheet'); }
    finally { setLoading(false); }
  }, [token]);

  const loadAdminSheets = useCallback(async () => {
    if (!token || !isAdmin) return;
    try {
      const res = await getAllTimesheets(token, { status: 'submitted', per_page: 50 });
      setAdminSheets(res.items);
    } catch { toast.error('Failed to load submissions'); }
  }, [token, isAdmin]);

  useEffect(() => { loadCurrentWeek(); }, [loadCurrentWeek]);
  useEffect(() => { if (view === 'admin') loadAdminSheets(); }, [view, loadAdminSheets]);

  // Timer
  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => setTimerSeconds(s => s + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerRunning]);

  const stopAndLogTimer = () => {
    setTimerRunning(false);
    const hrs = timerSeconds / 3600;
    setEntryForm(f => ({ ...f, hours: hrs.toFixed(2) }));
    setTimerSeconds(0);
    setShowForm(true);
    toast.info(`Timer stopped: ${(hrs).toFixed(2)}h logged`);
  };

  const handleAddEntry = async () => {
    if (!token || !currentSheet || !entryForm.hours) return;
    try {
      const entry = await addEntry(token, currentSheet.id, {
        date_logged: new Date().toISOString().split('T')[0],
        hours: parseFloat(entryForm.hours),
        description: entryForm.description || undefined,
        activity_type: entryForm.activity_type,
        is_billable: entryForm.is_billable,
        task_id: entryForm.task_id || undefined,
        project_id: entryForm.project_id || undefined,
      });
      setCurrentSheet(prev => prev ? {
        ...prev,
        entries: [...(prev.entries ?? []), entry],
        total_hours: prev.total_hours + entry.hours,
        billable_hours: entry.is_billable ? prev.billable_hours + entry.hours : prev.billable_hours,
      } : prev);
      setEntryForm({ hours: '', description: '', activity_type: 'development', is_billable: true, task_id: '', project_id: '' });
      setShowForm(false);
      toast.success('Time entry logged!');
    } catch { toast.error('Failed to log entry'); }
  };

  const handleDeleteEntry = async (entry: TimesheetEntry) => {
    if (!token) return;
    try {
      await deleteEntry(token, entry.id);
      setCurrentSheet(prev => prev ? {
        ...prev,
        entries: (prev.entries ?? []).filter(e => e.id !== entry.id),
        total_hours: prev.total_hours - entry.hours,
        billable_hours: entry.is_billable ? prev.billable_hours - entry.hours : prev.billable_hours,
      } : prev);
      toast.success('Entry deleted');
    } catch { toast.error('Failed to delete entry'); }
  };

  const handleSubmit = async () => {
    if (!token || !currentSheet) return;
    try {
      const updated = await submitTimesheet(token, currentSheet.id);
      setCurrentSheet(updated);
      toast.success('Timesheet submitted for approval!');
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? 'Submit failed');
    }
  };

  const handleApprove = async (id: string) => {
    if (!token) return;
    try {
      await approveTimesheet(token, id);
      toast.success('Timesheet approved ✅');
      loadAdminSheets();
    } catch { toast.error('Approval failed'); }
  };

  const handleReject = async (id: string) => {
    if (!token || !rejectReason.trim()) { toast.error('Enter a rejection reason'); return; }
    try {
      await rejectTimesheet(token, id, rejectReason);
      toast.success('Timesheet rejected');
      setShowReject(null);
      setRejectReason('');
      loadAdminSheets();
    } catch { toast.error('Rejection failed'); }
  };

  const timerDisplay = `${String(Math.floor(timerSeconds / 3600)).padStart(2, '0')}:${String(Math.floor((timerSeconds % 3600) / 60)).padStart(2, '0')}:${String(timerSeconds % 60).padStart(2, '0')}`;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 md:p-8">
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Timesheets</h1>
          <p className="text-slate-500 mt-1 text-sm">Track, submit, and manage your work hours.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setView('my')} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${view === 'my' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'}`}>My Timesheet</button>
          {isAdmin && <button onClick={() => setView('admin')} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${view === 'admin' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'}`}>Approval Inbox</button>}
        </div>
      </div>

      {view === 'my' && currentSheet && (
        <div className="space-y-6">
          {/* Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Hours', value: `${currentSheet.total_hours.toFixed(1)}h`, icon: Clock, color: 'text-indigo-600' },
              { label: 'Billable', value: `${currentSheet.billable_hours.toFixed(1)}h`, icon: DollarSign, color: 'text-green-600' },
              { label: 'Utilization', value: `${Math.min(100, (currentSheet.total_hours / 40) * 100).toFixed(0)}%`, icon: BarChart3, color: 'text-blue-600' },
              { label: 'Status', value: currentSheet.status.toUpperCase(), icon: CheckCircle2, color: 'text-slate-600' },
            ].map(stat => (
              <div key={stat.label} className="bg-white dark:bg-slate-950 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center ${stat.color}`}><stat.icon className="w-5 h-5" /></div>
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{stat.label}</p>
                  <p className="text-lg font-extrabold text-slate-900 dark:text-white">{stat.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Period + Status */}
          <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-1">Period</p>
                <p className="text-base font-semibold text-slate-900 dark:text-white">{fmt(currentSheet.period_start)} → {fmt(currentSheet.period_end)}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${STATUS_STYLE[currentSheet.status]}`}>{currentSheet.status}</span>
                {currentSheet.status === 'draft' && (
                  <>
                    <button onClick={() => setShowForm(f => !f)} className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-bold transition-all"><Plus className="w-4 h-4" />Log Time</button>
                    <button onClick={handleSubmit} disabled={!currentSheet.entries?.length} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold disabled:opacity-40 transition-all shadow-md shadow-indigo-200 dark:shadow-none"><Send className="w-4 h-4" />Submit</button>
                  </>
                )}
                {currentSheet.status === 'rejected' && (
                  <div className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2 border border-red-200"><span className="font-bold">Rejected:</span> {currentSheet.rejection_reason}</div>
                )}
              </div>
            </div>

            {/* Timer */}
            {currentSheet.status === 'draft' && (
              <div className="mb-5 flex items-center gap-4 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl p-4 border border-indigo-100 dark:border-indigo-500/20">
                <Timer className="w-5 h-5 text-indigo-600" />
                <span className="text-2xl font-mono font-bold text-indigo-700 dark:text-indigo-400">{timerDisplay}</span>
                {!timerRunning
                  ? <button onClick={() => setTimerRunning(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-all">Start Timer</button>
                  : <button onClick={stopAndLogTimer} className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-bold hover:bg-red-600 transition-all">Stop & Log</button>
                }
              </div>
            )}

            {/* Quick entry form */}
            {showForm && currentSheet.status === 'draft' && (
              <div className="mb-5 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <input type="number" step="0.25" min="0.25" max="24" value={entryForm.hours} onChange={e => setEntryForm(f => ({ ...f, hours: e.target.value }))} placeholder="Hours *" className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <select value={entryForm.activity_type} onChange={e => setEntryForm(f => ({ ...f, activity_type: e.target.value as ActivityType }))} className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {ACTIVITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <input type="text" value={entryForm.description} onChange={e => setEntryForm(f => ({ ...f, description: e.target.value }))} placeholder="Description (optional)" className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={entryForm.is_billable} onChange={e => setEntryForm(f => ({ ...f, is_billable: e.target.checked }))} className="w-4 h-4 rounded accent-indigo-600" />
                  <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">Billable</span>
                </label>
                <div className="flex gap-2 sm:col-span-2">
                  <button onClick={handleAddEntry} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-all">Add Entry</button>
                  <button onClick={() => setShowForm(false)} className="px-3 py-2 text-slate-500 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-sm">Cancel</button>
                </div>
              </div>
            )}

            {/* Entry table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-100 dark:border-slate-800 text-xs text-slate-500 uppercase tracking-wider">
                  <th className="py-2 text-left">Date</th><th className="py-2 text-left">Activity</th><th className="py-2 text-left">Description</th>
                  <th className="py-2 text-right">Hours</th><th className="py-2 text-center">Billable</th>
                  {currentSheet.status === 'draft' && <th className="py-2" />}
                </tr></thead>
                <tbody>
                  {(currentSheet.entries ?? []).length === 0 && (
                    <tr><td colSpan={6} className="py-10 text-center text-slate-400 italic">No entries yet. Log your first time entry above.</td></tr>
                  )}
                  {(currentSheet.entries ?? []).map(entry => (
                    <tr key={entry.id} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors group">
                      <td className="py-3 text-slate-600 dark:text-slate-400 font-medium">{new Date(entry.date_logged).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</td>
                      <td className="py-3"><span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 rounded text-xs font-semibold capitalize">{entry.activity_type}</span></td>
                      <td className="py-3 text-slate-500 max-w-[200px] truncate">{entry.description || '—'}</td>
                      <td className="py-3 text-right font-bold text-slate-900 dark:text-white">{entry.hours.toFixed(2)}h</td>
                      <td className="py-3 text-center">{entry.is_billable ? <span className="text-green-600 font-bold text-xs">YES</span> : <span className="text-slate-400 text-xs">NO</span>}</td>
                      {currentSheet.status === 'draft' && (
                        <td className="py-3 text-right"><button onClick={() => handleDeleteEntry(entry)} className="p-1.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10"><Trash2 className="w-4 h-4" /></button></td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Admin Approval View */}
      {view === 'admin' && isAdmin && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Submitted Timesheets</h2>
            <button onClick={loadAdminSheets} className="p-2 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-all"><RefreshCw className="w-4 h-4" /></button>
          </div>
          {adminSheets.length === 0 && <div className="text-center py-16 text-slate-400"><CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-20" /><p className="font-medium">No pending submissions</p></div>}
          {adminSheets.map(sheet => (
            <div key={sheet.id} className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 rounded-full flex items-center justify-center text-sm font-bold">{sheet.user?.full_name?.charAt(0) ?? '?'}</div>
                    <span className="font-bold text-slate-900 dark:text-white">{sheet.user?.full_name ?? 'Unknown'}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${STATUS_STYLE[sheet.status]}`}>{sheet.status}</span>
                  </div>
                  <p className="text-sm text-slate-500">{fmt(sheet.period_start)} → {fmt(sheet.period_end)} &bull; <strong>{sheet.total_hours.toFixed(1)}h total</strong> ({sheet.billable_hours.toFixed(1)}h billable)</p>
                  {sheet.submitted_at && <p className="text-xs text-slate-400 mt-1">Submitted {new Date(sheet.submitted_at).toLocaleString()}</p>}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => handleApprove(sheet.id)} className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 transition-all shadow-md shadow-green-200 dark:shadow-none"><CheckCircle2 className="w-4 h-4" />Approve</button>
                  <button onClick={() => setShowReject(sheet.id)} className="flex items-center gap-1.5 px-4 py-2 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-bold hover:bg-red-100 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-400 transition-all"><XCircle className="w-4 h-4" />Reject</button>
                </div>
              </div>
              {showReject === sheet.id && (
                <div className="mt-4 flex gap-2">
                  <input value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Rejection reason (required)..." className="flex-1 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500" />
                  <button onClick={() => handleReject(sheet.id)} className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-all">Confirm Reject</button>
                  <button onClick={() => { setShowReject(null); setRejectReason(''); }} className="px-3 py-2 text-slate-500 rounded-xl border border-slate-200 dark:border-slate-700 text-sm hover:bg-slate-100 dark:hover:bg-slate-800">Cancel</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-20"><div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /></div>
      )}
    </div>
  );
}
