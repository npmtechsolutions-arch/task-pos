import { useState, useEffect } from 'react';
import { Flag, Plus, ChevronDown, ChevronRight, CheckCircle2, Clock, PlayCircle, PauseCircle, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

interface Phase {
  id: string;
  name: string;
  description?: string;
  position: number;
  status: string;
  color: string;
  start_date?: string;
  end_date?: string;
  phase_budget?: number;
  budget_spent: number;
  progress_percentage: number;
  owner_id?: string;
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; bg: string; text: string }> = {
  planned:   { label: 'Planned',   icon: <Clock className="w-3 h-3" />,        bg: 'bg-gray-100',   text: 'text-gray-600'  },
  active:    { label: 'Active',    icon: <PlayCircle className="w-3 h-3" />,    bg: 'bg-green-100',  text: 'text-green-700' },
  on_hold:   { label: 'On Hold',   icon: <PauseCircle className="w-3 h-3" />,   bg: 'bg-amber-100',  text: 'text-amber-700' },
  completed: { label: 'Completed', icon: <CheckCircle2 className="w-3 h-3" />,  bg: 'bg-indigo-100', text: 'text-indigo-700'},
  cancelled: { label: 'Cancelled', icon: <Clock className="w-3 h-3" />,         bg: 'bg-red-100',    text: 'text-red-700'   },
};

function getAuthHeader() {
  const token = localStorage.getItem('token') || localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

interface PhasesPanelProps {
  projectId: string;
}

// ── Add Phase Modal ────────────────────────────────────────────────────────────
function AddPhaseModal({ projectId, onClose, onCreated }: { projectId: string; onClose: () => void; onCreated: (p: Phase) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#6366F1');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [budget, setBudget] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Phase name is required'); return; }
    setSaving(true); setError('');
    try {
      const res = await axios.post(
        `${API_URL}/projects/${projectId}/phases`,
        {
          name: name.trim(),
          description: description.trim() || undefined,
          color,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          phase_budget: budget ? parseFloat(budget) : undefined,
          position: 0,
        },
        { headers: getAuthHeader() }
      );
      onCreated(res.data);
      onClose();
    } catch (e: any) {
      setError(e.response?.data?.detail ?? e.message ?? 'Failed to create phase');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Flag className="w-5 h-5 text-indigo-500" /> Add Phase
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phase Name *</label>
            <input autoFocus className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Discovery, Development…" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
              value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
              <div className="flex items-center gap-2">
                <input type="color" className="w-8 h-8 rounded cursor-pointer border-0" value={color} onChange={e => setColor(e.target.value)} />
                <span className="text-sm text-gray-500 font-mono">{color}</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Budget ($)</label>
              <input type="number" min="0" step="100" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                value={budget} onChange={e => setBudget(e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 rounded-lg py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-2 text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</> : 'Create Phase'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function PhasesPanel({ projectId }: PhasesPanelProps) {
  const [phases, setPhases] = useState<Phase[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);

  const fetchPhases = async () => {
    try {
      const res = await axios.get(`${API_URL}/projects/${projectId}/phases`, {
        headers: getAuthHeader(),
      });
      setPhases(res.data);
    } catch (e) {
      console.error('PhasesPanel fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPhases(); }, [projectId]);

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handlePhaseCreated = (newPhase: Phase) => {
    setPhases(prev => [...prev, newPhase]);
  };

  const overallProgress = phases.length
    ? Math.round(phases.reduce((sum, p) => sum + p.progress_percentage, 0) / phases.length)
    : 0;

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse h-20" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {showModal && (
        <AddPhaseModal
          projectId={projectId}
          onClose={() => setShowModal(false)}
          onCreated={handlePhaseCreated}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Project Phases</h2>
          <p className="text-sm text-gray-400 mt-0.5">{phases.length} phases · {overallProgress}% overall progress</p>
        </div>
        <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4 mr-1" /> Add Phase
        </Button>
      </div>

      {/* Phase Timeline Bar */}
      {phases.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wider">Phase Progress</p>
          <div className="flex gap-1 h-3 rounded-full overflow-hidden">
            {phases.map(phase => (
              <div
                key={phase.id}
                className="relative group flex-1"
                style={{ backgroundColor: `${phase.color}30` }}
                title={phase.name}
              >
                <div
                  className="h-full rounded-sm transition-all"
                  style={{ width: `${phase.progress_percentage}%`, backgroundColor: phase.color }}
                />
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 hidden group-hover:block text-[10px] bg-gray-800 text-white px-2 py-0.5 rounded whitespace-nowrap z-10">
                  {phase.name} — {Math.round(phase.progress_percentage)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {phases.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
          <Flag className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No phases yet</p>
          <p className="text-gray-400 text-sm mt-1">Break your project into manageable phases</p>
          <Button size="sm" className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => setShowModal(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add First Phase
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {phases.map((phase, idx) => {
            const status = STATUS_CONFIG[phase.status] ?? STATUS_CONFIG.planned;
            const isOpen = expanded.has(phase.id);
            const budgetUtil = phase.phase_budget
              ? Math.round((phase.budget_spent / phase.phase_budget) * 100)
              : null;

            return (
              <div
                key={phase.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
              >
                <button
                  onClick={() => toggleExpand(phase.id)}
                  className="w-full flex items-center gap-4 p-5 text-left"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: phase.color }}
                  >
                    {idx + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className="font-semibold text-gray-800">{phase.name}</span>
                      <Badge className={cn("flex items-center gap-1 text-[10px] border-0 px-2 py-0.5", status.bg, status.text)}>
                        {status.icon} {status.label}
                      </Badge>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${phase.progress_percentage}%`, backgroundColor: phase.color }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-500 flex-shrink-0">
                    <span className="font-semibold" style={{ color: phase.color }}>
                      {Math.round(phase.progress_percentage)}%
                    </span>
                    {phase.start_date && (
                      <span className="text-xs text-gray-400 hidden sm:block">
                        {new Date(phase.start_date).toLocaleDateString()} — {phase.end_date ? new Date(phase.end_date).toLocaleDateString() : 'TBD'}
                      </span>
                    )}
                    {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 border-t border-gray-50 space-y-3">
                    {phase.description && (
                      <p className="text-sm text-gray-500 pt-3">{phase.description}</p>
                    )}
                    {phase.phase_budget != null && (
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-gray-400">Budget:</span>
                        <span className="font-medium text-gray-700">${phase.phase_budget.toLocaleString()}</span>
                        <span className="text-gray-400">·</span>
                        <span className="text-gray-400">Spent:</span>
                        <span className={cn("font-medium", budgetUtil != null && budgetUtil > 90 ? 'text-red-600' : 'text-gray-700')}>
                          ${phase.budget_spent.toLocaleString()} {budgetUtil != null ? `(${budgetUtil}%)` : ''}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
