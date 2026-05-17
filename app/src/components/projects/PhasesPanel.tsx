import { useState, useEffect, useCallback } from 'react';
import {
  Flag, Plus, CheckCircle2, Clock, PlayCircle, PauseCircle,
  X, Loader2, Edit3, Trash2, ChevronDown, ChevronRight, Save,
} from 'lucide-react';
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
  completed: { label: 'Completed', icon: <CheckCircle2 className="w-3 h-3" />,  bg: 'bg-indigo-100', text: 'text-indigo-700' },
  cancelled: { label: 'Cancelled', icon: <Clock className="w-3 h-3" />,         bg: 'bg-red-100',    text: 'text-red-700'   },
};

function getAuthHeader() {
  const token = localStorage.getItem('token') || localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── Inline progress + complete controls for each phase card ──────────────────
function PhaseControls({
  phase,
  onUpdate,
}: {
  phase: Phase;
  onUpdate: (updated: Phase) => void;
}) {
  const [pct, setPct] = useState(Math.round(phase.progress_percentage));
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    setPct(Math.round(phase.progress_percentage));
  }, [phase.progress_percentage]);

  const save = useCallback(async (overridePct?: number, overrideStatus?: string) => {
    const newPct = overridePct ?? pct;
    const newStatus = overrideStatus ?? phase.status;
    setSaving(true);
    try {
      const res = await axios.put(
        `${API_URL}/projects/phases/${phase.id}`,
        { progress_percentage: newPct, status: newStatus },
        { headers: getAuthHeader() }
      );
      onUpdate(res.data);
    } catch (e) {
      console.error('Phase update failed:', e);
    } finally {
      setSaving(false);
      setCompleting(false);
    }
  }, [phase.id, phase.status, pct, onUpdate]);

  const handleComplete = async () => {
    setCompleting(true);
    await save(100, 'completed');
  };

  const isCompleted = phase.status === 'completed';

  return (
    <div
      className="flex items-center gap-3 flex-wrap mt-3 pt-3 border-t border-gray-50"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Percentage slider + input */}
      <div className="flex items-center gap-2 flex-1 min-w-[200px]">
        <span className="text-xs text-gray-400 w-6 text-right">{pct}%</span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={pct}
          disabled={isCompleted || saving}
          onChange={(e) => setPct(Number(e.target.value))}
          onMouseUp={() => save()}
          onTouchEnd={() => save()}
          className="flex-1 h-1.5 rounded-full accent-indigo-600 cursor-pointer disabled:cursor-not-allowed"
        />
        <input
          type="number"
          min={0}
          max={100}
          value={pct}
          disabled={isCompleted || saving}
          onChange={(e) => setPct(Math.min(100, Math.max(0, Number(e.target.value))))}
          onBlur={() => save()}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          className="w-14 border border-gray-200 rounded-md px-2 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:bg-gray-50 disabled:cursor-not-allowed"
        />
      </div>

      {/* Status quick change */}
      <select
        value={phase.status}
        disabled={isCompleted || saving}
        onChange={(e) => save(undefined, e.target.value)}
        className="border border-gray-200 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:bg-gray-50"
      >
        <option value="planned">Planned</option>
        <option value="active">Active</option>
        <option value="on_hold">On Hold</option>
        <option value="completed">Completed</option>
        <option value="cancelled">Cancelled</option>
      </select>

      {/* Complete button */}
      {!isCompleted ? (
        <button
          onClick={handleComplete}
          disabled={saving || completing}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60"
        >
          {completing ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <CheckCircle2 className="w-3 h-3" />
          )}
          Mark Complete
        </button>
      ) : (
        <span className="flex items-center gap-1 text-xs text-green-700 font-medium">
          <CheckCircle2 className="w-3.5 h-3.5" /> Completed
        </span>
      )}

      {saving && !completing && (
        <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
      )}
    </div>
  );
}

// ── Add Phase Modal ────────────────────────────────────────────────────────────
function AddPhaseModal({
  projectId,
  onClose,
  onCreated,
}: {
  projectId: string;
  onClose: () => void;
  onCreated: (p: Phase) => void;
}) {
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
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phase Name *</label>
            <input
              autoFocus
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Discovery, Development…"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
              <div className="flex items-center gap-2">
                <input type="color" className="w-8 h-8 rounded cursor-pointer border-0" value={color} onChange={(e) => setColor(e.target.value)} />
                <span className="text-sm text-gray-500 font-mono">{color}</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Budget ($)</label>
              <input
                type="number"
                min="0"
                step="100"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-200 rounded-lg py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-2 text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</> : 'Create Phase'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Panel ─────────────────────────────────────────────────────────────────
interface PhasesPanelProps { projectId: string; }

export function PhasesPanel({ projectId }: PhasesPanelProps) {
  const [phases, setPhases] = useState<Phase[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchPhases = useCallback(async () => {
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
  }, [projectId]);

  useEffect(() => { fetchPhases(); }, [fetchPhases]);

  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const handlePhaseUpdated = (updated: Phase) =>
    setPhases((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this phase?')) return;
    setDeleting(id);
    try {
      await axios.delete(`${API_URL}/projects/phases/${id}`, { headers: getAuthHeader() });
      setPhases((prev) => prev.filter((p) => p.id !== id));
    } catch {
      alert('Failed to delete phase');
    } finally {
      setDeleting(null);
    }
  };

  const overallProgress = phases.length
    ? Math.round(phases.reduce((sum, p) => sum + p.progress_percentage, 0) / phases.length)
    : 0;

  const completedCount = phases.filter((p) => p.status === 'completed').length;

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
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
          onCreated={(p) => setPhases((prev) => [...prev, p])}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Project Phases</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {phases.length} phases · {completedCount}/{phases.length} completed · {overallProgress}% overall
          </p>
        </div>
        <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4 mr-1" /> Add Phase
        </Button>
      </div>

      {/* Overall progress bar */}
      {phases.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Overall Phase Progress</p>
            <span className="text-sm font-bold text-indigo-600">{overallProgress}%</span>
          </div>
          {/* Segmented bar */}
          <div className="flex gap-1 h-3 rounded-full overflow-hidden mb-3">
            {phases.map((phase) => (
              <div
                key={phase.id}
                className="relative group flex-1"
                style={{ backgroundColor: `${phase.color}25` }}
                title={`${phase.name}: ${Math.round(phase.progress_percentage)}%`}
              >
                <div
                  className="h-full rounded-sm transition-all duration-500"
                  style={{ width: `${phase.progress_percentage}%`, backgroundColor: phase.color }}
                />
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 hidden group-hover:block text-[10px] bg-gray-900 text-white px-2 py-0.5 rounded whitespace-nowrap z-10">
                  {phase.name} — {Math.round(phase.progress_percentage)}%
                </div>
              </div>
            ))}
          </div>
          {/* Phase legend */}
          <div className="flex flex-wrap gap-3">
            {phases.map((phase) => (
              <div key={phase.id} className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: phase.color }} />
                {phase.name}
                <span className="font-semibold" style={{ color: phase.color }}>
                  {Math.round(phase.progress_percentage)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {phases.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
          <Flag className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No phases yet</p>
          <p className="text-gray-400 text-sm mt-1">Break your project into manageable phases to track progress</p>
          <Button size="sm" className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => setShowModal(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add First Phase
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {phases.map((phase, idx) => {
            const statusCfg = STATUS_CONFIG[phase.status] ?? STATUS_CONFIG.planned;
            const isOpen = expanded.has(phase.id);
            const budgetUtil = phase.phase_budget
              ? Math.round((phase.budget_spent / phase.phase_budget) * 100)
              : null;

            return (
              <div
                key={phase.id}
                className={cn(
                  'bg-white rounded-2xl border shadow-sm overflow-hidden hover:shadow-md transition-all',
                  phase.status === 'completed' ? 'border-green-200' : 'border-gray-100'
                )}
              >
                {/* Phase header row — click to expand */}
                <button
                  onClick={() => toggleExpand(phase.id)}
                  className="w-full flex items-center gap-4 p-5 text-left"
                >
                  {/* Number badge */}
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: phase.color }}
                  >
                    {phase.status === 'completed' ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                  </div>

                  {/* Name + progress bar */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className="font-semibold text-gray-800">{phase.name}</span>
                      <Badge className={cn('flex items-center gap-1 text-[10px] border-0 px-2 py-0.5', statusCfg.bg, statusCfg.text)}>
                        {statusCfg.icon} {statusCfg.label}
                      </Badge>
                    </div>
                    {/* Visual progress bar */}
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${phase.progress_percentage}%`,
                          backgroundColor: phase.status === 'completed' ? '#22c55e' : phase.color,
                        }}
                      />
                    </div>
                  </div>

                  {/* Right meta */}
                  <div className="flex items-center gap-3 text-sm text-gray-500 flex-shrink-0">
                    <span className="font-bold text-base" style={{ color: phase.status === 'completed' ? '#22c55e' : phase.color }}>
                      {Math.round(phase.progress_percentage)}%
                    </span>
                    {phase.start_date && (
                      <span className="text-xs text-gray-400 hidden lg:block">
                        {new Date(phase.start_date).toLocaleDateString()} →{' '}
                        {phase.end_date ? new Date(phase.end_date).toLocaleDateString() : 'TBD'}
                      </span>
                    )}
                    {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </div>
                </button>

                {/* Expanded detail — inline controls */}
                {isOpen && (
                  <div className="px-5 pb-5 border-t border-gray-50">
                    {phase.description && (
                      <p className="text-sm text-gray-500 pt-3 mb-3">{phase.description}</p>
                    )}

                    {/* Budget row */}
                    {phase.phase_budget != null && (
                      <div className="flex items-center gap-4 text-sm mb-3">
                        <span className="text-gray-400">Budget:</span>
                        <span className="font-medium text-gray-700">${phase.phase_budget.toLocaleString()}</span>
                        <span className="text-gray-400">·</span>
                        <span className="text-gray-400">Spent:</span>
                        <span className={cn('font-medium', budgetUtil != null && budgetUtil > 90 ? 'text-red-600' : 'text-gray-700')}>
                          ${phase.budget_spent.toLocaleString()}
                          {budgetUtil != null && ` (${budgetUtil}%)`}
                        </span>
                      </div>
                    )}

                    {/* ── CONTROLS: Complete + % input ── */}
                    <PhaseControls phase={phase} onUpdate={handlePhaseUpdated} />

                    {/* Delete */}
                    <div className="flex justify-end mt-3">
                      <button
                        onClick={() => handleDelete(phase.id)}
                        disabled={deleting === phase.id}
                        className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 transition-colors"
                      >
                        {deleting === phase.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                        Delete phase
                      </button>
                    </div>
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
