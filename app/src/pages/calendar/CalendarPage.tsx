import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Loader2, CheckSquare, Target, AlertTriangle, Plus, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useProjectStore } from '@/stores';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
const authHeader = () => {
  const token = localStorage.getItem('token') || localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

type EventType = 'task' | 'milestone' | 'overdue' | 'meeting' | 'deadline' | 'other';
interface CalEvent {
  id: string;
  title: string;
  date: string;
  start_date: string;
  event_type: EventType;
  color: string;
  all_day: boolean;
  source: 'manual' | 'task' | 'milestone';
  source_id?: string;
  project_id?: string;
  status?: string;
  is_overdue?: boolean;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const TYPE_COLORS: Record<string, string> = {
  task:      'bg-blue-500 text-white',
  milestone: 'bg-emerald-500 text-white',
  overdue:   'bg-red-500 text-white',
  meeting:   'bg-orange-400 text-white',
  deadline:  'bg-red-700 text-white',
  other:     'bg-indigo-500 text-white',
};

// ── New Event Modal ────────────────────────────────────────────────────────────
function NewEventModal({ onClose, onCreated, defaultDate }: {
  onClose: () => void;
  onCreated: (e: CalEvent) => void;
  defaultDate?: string;
}) {
  const [form, setForm] = useState({
    title: '', description: '', start_date: defaultDate || '',
    event_type: 'other', color: '#6366F1', all_day: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k: string) => (e: any) =>
    setForm(prev => ({ ...prev, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form.title || !form.start_date) { setError('Title and date required'); return; }
    setSaving(true); setError('');
    try {
      const res = await axios.post(`${API_URL}/calendar/events`, {
        title: form.title,
        description: form.description || undefined,
        start_date: new Date(form.start_date + 'T00:00:00').toISOString(),
        event_type: form.event_type,
        color: form.color,
        all_day: form.all_day,
      }, { headers: authHeader() });
      onCreated({ ...res.data, date: form.start_date, source: 'manual' });
      onClose();
    } catch (e: any) {
      setError(e.response?.data?.detail ?? e.message ?? 'Failed to create event');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-500" /> New Event
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg text-gray-400"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input autoFocus className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={form.title} onChange={set('title')} placeholder="Event title" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
              <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                value={form.start_date} onChange={set('start_date')} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={form.event_type} onChange={set('event_type')}>
                <option value="meeting">Meeting</option>
                <option value="deadline">Deadline</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={form.description} onChange={set('description')} placeholder="Optional" />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Color</label>
              <input type="color" className="w-8 h-8 rounded cursor-pointer"
                value={form.color} onChange={set('color')} />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-200 rounded-lg py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-2 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Create Event
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── New Milestone Modal ─────────────────────────────────────────────────────────
function NewMilestoneModal({ onClose, onCreated, defaultDate }: {
  onClose: () => void;
  onCreated: () => void;
  defaultDate?: string;
}) {
  const { projects, fetchProjects } = useProjectStore();
  const [form, setForm] = useState({ name: '', project_id: '', due_date: defaultDate || '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (projects.length === 0) fetchProjects(); }, []);

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form.name || !form.due_date || !form.project_id) { setError('Name, project and date required'); return; }
    setSaving(true); setError('');
    try {
      await axios.post(`${API_URL}/milestones`, {
        name: form.name,
        project_id: form.project_id,
        milestone_type: 'date_based',
        due_date: new Date(form.due_date + 'T00:00:00').toISOString(),
      }, { headers: authHeader() });
      onCreated(); // Reload calendar events entirely since ID format maps differently
      onClose();
    } catch (e: any) {
      setError(e.response?.data?.detail ?? e.message ?? 'Failed to create milestone');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Target className="w-5 h-5 text-emerald-500" /> New Milestone
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg text-gray-400"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</div>}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project *</label>
            <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              value={form.project_id} onChange={(e) => setForm(f => ({ ...f, project_id: e.target.value }))} required>
              <option value="">Select a project</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input autoFocus className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Milestone name" required />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Due Date *</label>
            <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              value={form.due_date} onChange={(e) => setForm(f => ({ ...f, due_date: e.target.value }))} required />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-200 rounded-lg py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving || projects.length === 0}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg py-2 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Create Milestone
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Calendar Page ─────────────────────────────────────────────────────────
export function CalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | EventType>('all');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [showNewMilestone, setShowNewMilestone] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/calendar/events`, { headers: authHeader() });
      setEvents(res.data);
    } catch (e) {
      console.error('Calendar load error:', e);
    } finally { setLoading(false); }
  };

  useEffect(() => { loadEvents(); }, []);

  const deleteManualEvent = async (id: string) => {
    if (!window.confirm('Delete this event?')) return;
    setDeletingId(id);
    try {
      await axios.delete(`${API_URL}/calendar/events/${id}`, { headers: authHeader() });
      setEvents(prev => prev.filter(e => e.id !== id));
    } catch (e: any) {
      alert(e.response?.data?.detail ?? 'Delete failed');
    } finally { setDeletingId(null); }
  };

  const prev = () => { if (month === 0) { setYear(y => y-1); setMonth(11); } else setMonth(m => m-1); };
  const next = () => { if (month === 11) { setYear(y => y+1); setMonth(0); } else setMonth(m => m+1); };

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i+1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const todayKey = today.toISOString().slice(0, 10);

  const filteredEvents = filter === 'all' ? events : events.filter(e => e.event_type === filter);

  const eventsForDay = (day: number | null) => {
    if (!day) return [];
    const key = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    return filteredEvents.filter(e => e.date === key);
  };

  const selectedEvents = selectedDate ? filteredEvents.filter(e => e.date === selectedDate) : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {showNewEvent && (
          <NewEventModal
            defaultDate={selectedDate ?? ''}
            onClose={() => setShowNewEvent(false)}
            onCreated={e => { setEvents(prev => [...prev, e]); }}
          />
        )}
        {showNewMilestone && (
          <NewMilestoneModal
            defaultDate={selectedDate ?? ''}
            onClose={() => setShowNewMilestone(false)}
            onCreated={() => { loadEvents(); }} // Reload all to get milestone
          />
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Calendar className="w-6 h-6 text-indigo-600" /> Calendar
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">All events, tasks, and milestones</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Filter pills */}
            {(['all', 'task', 'milestone', 'overdue', 'meeting', 'deadline'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors ${
                  filter === f ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300'
                }`}>
                {f === 'all' ? 'All' : f}
              </button>
            ))}
            <button onClick={() => setShowNewMilestone(true)}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-full text-xs font-semibold transition-colors">
              <Plus className="w-3.5 h-3.5" /> Milestone
            </button>
            <button onClick={() => setShowNewEvent(true)}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-full text-xs font-semibold transition-colors">
              <Plus className="w-3.5 h-3.5" /> Event
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
          {/* Calendar */}
          <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <button onClick={prev} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronLeft className="w-5 h-5" /></button>
              <h2 className="text-lg font-bold text-gray-800">{MONTHS[month]} {year}</h2>
              <button onClick={next} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronRight className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-7 border-b border-gray-100">
              {DAYS.map(d => <div key={d} className="py-2 text-center text-xs font-semibold text-gray-400 uppercase">{d}</div>)}
            </div>
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
              </div>
            ) : (
              <div className="grid grid-cols-7">
                {cells.map((day, i) => {
                  const dayKey = day ? `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}` : '';
                  const dayEvents = eventsForDay(day);
                  const isToday = dayKey === todayKey;
                  const isSelected = dayKey === selectedDate;
                  return (
                    <div key={i} onClick={() => day && setSelectedDate(isSelected ? null : dayKey)}
                      className={`min-h-[88px] p-1.5 border-b border-r border-gray-50 cursor-pointer transition-colors ${
                        !day ? 'bg-gray-50/50' : isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50'
                      }`}>
                      {day && (
                        <>
                          <div className={`w-7 h-7 flex items-center justify-center text-sm font-medium rounded-full mb-1 ${
                            isToday ? 'bg-indigo-600 text-white' : 'text-gray-700'
                          }`}>{day}</div>
                          <div className="space-y-0.5">
                            {dayEvents.slice(0, 3).map(ev => (
                              <div key={ev.id}
                                className={`text-[10px] px-1.5 py-0.5 rounded truncate font-medium ${TYPE_COLORS[ev.event_type] ?? TYPE_COLORS.other}`}
                                title={ev.title}>{ev.title}</div>
                            ))}
                            {dayEvents.length > 3 && <div className="text-[10px] text-gray-400 px-1">+{dayEvents.length - 3} more</div>}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Legend */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Legend</p>
              {[
                { label: 'Task', icon: <CheckSquare className="w-3.5 h-3.5" />, cls: 'text-blue-600' },
                { label: 'Milestone', icon: <Target className="w-3.5 h-3.5" />, cls: 'text-emerald-600' },
                { label: 'Overdue', icon: <AlertTriangle className="w-3.5 h-3.5" />, cls: 'text-red-600' },
                { label: 'Meeting / Other', icon: <Calendar className="w-3.5 h-3.5" />, cls: 'text-orange-500' },
              ].map(l => (
                <div key={l.label} className={`flex items-center gap-2 text-sm mb-2 ${l.cls}`}>
                  {l.icon} {l.label}
                </div>
              ))}
            </div>

            {/* Selected day */}
            {selectedDate && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday:'long', month:'short', day:'numeric' })}
                  </p>
                  <button onClick={() => setShowNewEvent(true)}
                    className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Add
                  </button>
                </div>
                {selectedEvents.length === 0
                  ? <p className="text-sm text-gray-400 italic">No events</p>
                  : selectedEvents.map(ev => (
                    <div key={ev.id} className={`p-2.5 rounded-xl border mb-2 ${
                      ev.event_type === 'overdue' ? 'border-red-100 bg-red-50'
                      : ev.event_type === 'milestone' ? 'border-emerald-100 bg-emerald-50'
                      : ev.event_type === 'task' ? 'border-blue-100 bg-blue-50'
                      : 'border-orange-100 bg-orange-50'
                    }`}>
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-800 text-xs truncate">{ev.title}</p>
                          {ev.source === 'task' && ev.source_id && (
                            <Link to={`/tasks/${ev.source_id}`} className="text-[10px] text-indigo-600 hover:underline">View Task →</Link>
                          )}
                          <span className="text-[10px] text-gray-500 capitalize block">{ev.event_type}</span>
                        </div>
                        {ev.source === 'manual' && (
                          <button onClick={() => deleteManualEvent(ev.id)} disabled={deletingId === ev.id}
                            className="text-red-400 hover:text-red-600 p-0.5 text-xs">
                            {deletingId === ev.id ? '…' : '✕'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {/* Upcoming 7 days */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Upcoming (7 days)</p>
              {(() => {
                const upcoming = events.filter(e => {
                  const d = new Date(e.date + 'T00:00:00');
                  const diff = (d.getTime() - today.getTime()) / 86400000;
                  return diff >= 0 && diff <= 7;
                }).slice(0, 8);
                return upcoming.length === 0
                  ? <p className="text-sm text-gray-400 italic">Nothing in next 7 days</p>
                  : upcoming.map(ev => (
                    <div key={ev.id} className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        ev.event_type === 'overdue' ? 'bg-red-500' : ev.event_type === 'milestone' ? 'bg-emerald-500' : ev.event_type === 'task' ? 'bg-blue-500' : 'bg-orange-400'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-700 truncate">{ev.title}</p>
                        <p className="text-[10px] text-gray-400">{new Date(ev.date + 'T00:00:00').toLocaleDateString('en-US', { month:'short', day:'numeric' })}</p>
                      </div>
                    </div>
                  ));
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
