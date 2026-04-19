import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Clock, LogIn, LogOut, Calendar, CheckCircle2, 
  AlertCircle, Wifi, Home, BarChart3, Users, Loader2, Shield
} from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '@/stores';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('token')}` };
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface AttendanceRecord {
  id: string;
  user_id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  status: string;
  notes: string | null;
  is_remote: boolean;
  hours_worked: number;
  user_name?: string;
  user_email?: string;
}

interface MonthStats {
  month: number;
  year: number;
  total_days_recorded: number;
  working_days_in_month: number;
  total_hours_worked: number;
  by_status: Record<string, number>;
}

// ── Status Config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  present:        { label: 'Present',       color: 'text-emerald-700', bg: 'bg-emerald-100' },
  absent:         { label: 'Absent',        color: 'text-red-700',     bg: 'bg-red-100' },
  late:           { label: 'Late',          color: 'text-amber-700',   bg: 'bg-amber-100' },
  half_day:       { label: 'Half Day',      color: 'text-blue-700',    bg: 'bg-blue-100' },
  work_from_home: { label: 'Work From Home', color: 'text-purple-700', bg: 'bg-purple-100' },
  on_leave:       { label: 'On Leave',      color: 'text-gray-700',    bg: 'bg-gray-100' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(iso: string | null) {
  if (!iso) return '--:--';
  try { return format(parseISO(iso), 'hh:mm a'); } catch { return '--:--'; }
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: 'text-gray-700', bg: 'bg-gray-100' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AttendancePage() {
  const { user } = useAuthStore();
  const isAdminUser = ['admin', 'owner', 'manager'].includes((user as any)?.role || '');
  const [activeTab, setActiveTab] = useState<'my' | 'team'>('my');
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState<MonthStats | null>(null);
  const [allAttendance, setAllAttendance] = useState<AttendanceRecord[]>([]);
  const [loadingAll, setLoadingAll] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [isRemote, setIsRemote] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Load data
  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [todayRes, histRes, statsRes] = await Promise.all([
        axios.get(`${API_URL}/attendance/today`, { headers: authHeaders() }),
        axios.get(`${API_URL}/attendance/history`, { headers: authHeaders() }),
        axios.get(`${API_URL}/attendance/stats`, { headers: authHeaders() }),
      ]);
      setTodayRecord(todayRes.data);
      setHistory(histRes.data || []);
      setStats(statsRes.data);
    } catch {}
    setLoading(false);
  };

  const loadTeamAttendance = async () => {
    if (!isAdminUser) return;
    setLoadingAll(true);
    try {
      const now = new Date();
      const res = await axios.get(
        `${API_URL}/attendance/all?month=${now.getMonth() + 1}&year=${now.getFullYear()}`,
        { headers: authHeaders() }
      );
      setAllAttendance(res.data || []);
    } catch {}
    setLoadingAll(false);
  };

  const handleCheckIn = async () => {
    setActionLoading(true);
    try {
      const res = await axios.post(`${API_URL}/attendance/check-in`, { is_remote: isRemote }, { headers: authHeaders() });
      setTodayRecord(res.data);
      loadAll();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Check-in failed');
    }
    setActionLoading(false);
  };

  const handleCheckOut = async () => {
    setActionLoading(true);
    try {
      const res = await axios.post(`${API_URL}/attendance/check-out`, {}, { headers: authHeaders() });
      setTodayRecord(res.data);
      loadAll();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Check-out failed');
    }
    setActionLoading(false);
  };

  const checkedIn = !!todayRecord?.check_in;
  const checkedOut = !!todayRecord?.check_out;

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Attendance</h1>
          <p className="text-gray-500 mt-1">Track daily attendance and work hours</p>
        </div>
        <div className="flex items-end gap-4">
          {isAdminUser && (
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
              <button onClick={() => setActiveTab('my')}
                className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  activeTab === 'my' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
                My Attendance
              </button>
              <button onClick={() => { setActiveTab('team'); loadTeamAttendance(); }}
                className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1',
                  activeTab === 'team' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
                <Shield className="w-3.5 h-3.5" /> Team View
              </button>
            </div>
          )}
          <div className="text-right">
            <p className="text-3xl font-mono font-black text-indigo-600">{format(currentTime, 'hh:mm:ss a')}</p>
            <p className="text-sm text-gray-500">{format(currentTime, 'EEEE, MMMM d yyyy')}</p>
          </div>
        </div>
      </div>

      {/* ── TEAM VIEW (Admin only) ───────────────────────────────────────────── */}
      {activeTab === 'team' && isAdminUser && (
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-gray-700 flex items-center gap-2">
              <Users className="h-4 w-4" /> All Employee Attendance — {format(new Date(), 'MMMM yyyy')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingAll ? (
              <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-indigo-400" /></div>
            ) : allAttendance.length === 0 ? (
              <p className="text-center text-gray-400 py-10">No attendance records found for this month.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      {['Employee', 'Date', 'Status', 'Check In', 'Check Out', 'Hours', 'Type'].map(h => (
                        <th key={h} className="text-left py-2 px-3 text-xs font-bold text-gray-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allAttendance.map(r => (
                      <tr key={r.id} className="border-b hover:bg-gray-50 transition-colors">
                        <td className="py-2.5 px-3">
                          <div>
                            <p className="font-semibold text-gray-800">{r.user_name || '—'}</p>
                            <p className="text-xs text-gray-400">{r.user_email || ''}</p>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-semibold">{format(parseISO(r.date), 'MMM dd, yyyy')}</td>
                        <td className="py-2.5 px-3"><StatusBadge status={r.status} /></td>
                        <td className="py-2.5 px-3 font-mono text-gray-600">{formatTime(r.check_in)}</td>
                        <td className="py-2.5 px-3 font-mono text-gray-600">{formatTime(r.check_out)}</td>
                        <td className="py-2.5 px-3 font-bold text-indigo-600">{r.hours_worked > 0 ? `${r.hours_worked}h` : '—'}</td>
                        <td className="py-2.5 px-3">
                          {r.is_remote
                            ? <span className="flex items-center gap-1 text-purple-600 text-xs font-semibold"><Home className="h-3 w-3" />Remote</span>
                            : <span className="text-xs text-gray-400">Office</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── MY ATTENDANCE VIEW ───────────────────────────────────────────────── */}
      {activeTab === 'my' && (<>

      {/* Today Card */}
      <Card className="border-none shadow-xl bg-gradient-to-br from-indigo-600 to-violet-700 text-white overflow-hidden">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <p className="text-indigo-100 text-sm font-semibold uppercase tracking-widest">Today's Attendance</p>
              <h2 className="text-4xl font-black mt-1">
                {checkedOut ? 'Work Complete ✓' : checkedIn ? 'Currently Working' : 'Not Yet Clocked In'}
              </h2>
              {todayRecord && (
                <div className="flex gap-6 mt-3 text-indigo-100">
                  <span>🟢 In: <strong className="text-white">{formatTime(todayRecord.check_in)}</strong></span>
                  <span>🔴 Out: <strong className="text-white">{formatTime(todayRecord.check_out)}</strong></span>
                  {todayRecord.hours_worked > 0 && (
                    <span>⏱ Hours: <strong className="text-white">{todayRecord.hours_worked}h</strong></span>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3">
              {/* Remote Toggle */}
              {!checkedIn && (
                <label className="flex items-center gap-2 text-white cursor-pointer">
                  <div 
                    className={`w-10 h-5 rounded-full transition-colors ${isRemote ? 'bg-emerald-400' : 'bg-white/30'} relative`}
                    onClick={() => setIsRemote(!isRemote)}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${isRemote ? 'left-5' : 'left-0.5'}`} />
                  </div>
                  <Home className="h-4 w-4" />
                  <span className="text-sm">Work from Home</span>
                </label>
              )}

              {/* Check In / Check Out Buttons */}
              {!checkedIn ? (
                <Button
                  id="btn-check-in"
                  size="lg"
                  className="bg-white text-indigo-700 hover:bg-indigo-50 font-black shadow-lg px-8"
                  onClick={handleCheckIn}
                  disabled={actionLoading}
                >
                  {actionLoading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <LogIn className="h-5 w-5 mr-2" />}
                  Check In
                </Button>
              ) : !checkedOut ? (
                <Button
                  id="btn-check-out"
                  size="lg"
                  className="bg-red-500 hover:bg-red-600 text-white font-black shadow-lg px-8"
                  onClick={handleCheckOut}
                  disabled={actionLoading}
                >
                  {actionLoading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <LogOut className="h-5 w-5 mr-2" />}
                  Check Out
                </Button>
              ) : (
                <div className="flex items-center gap-2 bg-white/20 rounded-xl px-4 py-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                  <span className="font-bold">Day Complete</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Row */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Days This Month', value: stats.total_days_recorded, icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Hours Worked', value: `${stats.total_hours_worked}h`, icon: Clock, color: 'text-indigo-600', bg: 'bg-indigo-50' },
            { label: 'Present Days', value: stats.by_status.present || 0, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Absent Days', value: stats.by_status.absent || 0, icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <Card key={label} className="border shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${bg}`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <div>
                  <p className="text-2xl font-black text-gray-900">{value}</p>
                  <p className="text-xs text-gray-500">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Monthly Calendar Grid */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-gray-700 flex items-center gap-2">
            <Calendar className="h-4 w-4" /> Monthly Attendance Calendar
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <div key={d} className="text-center text-[10px] font-bold text-gray-400 py-1">{d}</div>
              ))}
              {Array.from({ length: 35 }, (_, i) => {
                const now = new Date();
                const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
                const day = i - firstDay + 1;
                const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                if (day < 1 || day > daysInMonth) return <div key={i} />;
                const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const record = history.find(h => h.date === dateStr);
                const isToday = day === now.getDate();
                const cfg = record ? STATUS_CONFIG[record.status] : null;
                return (
                  <div
                    key={i}
                    className={`aspect-square flex flex-col items-center justify-center rounded-lg text-xs font-semibold transition-all
                      ${isToday ? 'ring-2 ring-indigo-500' : ''}
                      ${cfg ? `${cfg.bg} ${cfg.color}` : 'bg-gray-50 text-gray-400'}`}
                    title={record ? `${cfg?.label} | In: ${formatTime(record.check_in)} Out: ${formatTime(record.check_out)}` : `Day ${day}`}
                  >
                    <span>{day}</span>
                    {record && <span className="text-[8px] mt-0.5">{record.hours_worked > 0 ? `${record.hours_worked}h` : '—'}</span>}
                  </div>
                );
              })}
            </div>
          )}
          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t">
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <span key={key} className={`flex items-center gap-1 text-xs font-medium ${cfg.color}`}>
                <span className={`w-3 h-3 rounded-full ${cfg.bg} border`} />
                {cfg.label}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent History Table */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-gray-700">Recent Attendance Log</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  {['Date', 'Status', 'Check In', 'Check Out', 'Hours', 'Type'].map(h => (
                    <th key={h} className="text-left py-2 px-3 text-xs font-bold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 15).map(r => (
                  <tr key={r.id} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="py-2.5 px-3 font-semibold">{format(parseISO(r.date), 'MMM dd, yyyy')}</td>
                    <td className="py-2.5 px-3"><StatusBadge status={r.status} /></td>
                    <td className="py-2.5 px-3 font-mono text-gray-600">{formatTime(r.check_in)}</td>
                    <td className="py-2.5 px-3 font-mono text-gray-600">{formatTime(r.check_out)}</td>
                    <td className="py-2.5 px-3 font-bold text-indigo-600">{r.hours_worked > 0 ? `${r.hours_worked}h` : '—'}</td>
                    <td className="py-2.5 px-3">
                      {r.is_remote ? (
                        <span className="flex items-center gap-1 text-purple-600 text-xs font-semibold"><Home className="h-3 w-3" />Remote</span>
                      ) : (
                        <span className="text-xs text-gray-400">Office</span>
                      )}
                    </td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-gray-400">No attendance records yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      </>)} {/* end activeTab === 'my' */}
    </div>
  );
}
