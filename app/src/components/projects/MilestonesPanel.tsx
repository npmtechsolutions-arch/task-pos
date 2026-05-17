import { useState, useEffect, useCallback } from 'react';
import {
  Target, AlertTriangle, CheckCircle2, Clock, TrendingUp,
  Plus, X, Loader2, Trash2, ChevronDown, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

function getAuthHeader() {
  const token = localStorage.getItem('token') || localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

interface Milestone {
  id: string;
  name: string;
  description?: string;
  milestone_type: string;
  status: string;
  due_date?: string;
  completion_percentage: number;
  risk_indicator: string;
  requires_approval: boolean;
  is_approved: boolean;
}

const RISK_CONFIG: Record<string, { bg: string; text: string; dot: string; bar: string }> = {
  low:      { bg: 'bg-green-50',  text: 'text-green-700',  dot: 'bg-green-400',  bar: 'bg-green-500'  },
  medium:   { bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-400',  bar: 'bg-amber-500'  },
  high:     { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-400', bar: 'bg-orange-500' },
  critical: { bg: 'bg-red-50',    text: 'text-red-700',    dot: 'bg-red-500',    bar: 'bg-red-500'    },
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending:     <Clock className="w-4 h-4 text-gray-400" />,
  in_progress: <TrendingUp className="w-4 h-4 text-blue-500" />,
  at_risk:     <AlertTriangle className="w-4 h-4 text-amber-500" />,
  completed:   <CheckCircle2 className="w-4 h-4 text-green-500" />,
  missed:      <AlertTriangle className="w-4 h-4 text-red-500" />,
};

// ── Inline controls: %, Complete, Status ────────────────────────────────────
function MilestoneControls({
  milestone,
  onUpdate,
}: {
  milestone: Milestone;
  onUpdate: (updated: Milestone) => void;
}) {
  const [pct, setPct] = useState(Math.round(milestone.completion_percentage));
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    setPct(Math.round(milestone.completion_percentage));
  }, [milestone.completion_percentage]);

  const save = useCallback(
    async (overridePct?: number, overrideStatus?: string) => {
      const newPct = overridePct ?? pct;
      const newStatus = overrideStatus ?? milestone.status;
      setSaving(true);
      try {
        const res = await axios.put(
          `${API_URL}/milestones/${milestone.id}`,
          { completion_percentage: newPct, status: newStatus },
          { headers: getAuthHeader() }
        );
        onUpdate(res.data);
      } catch (e) {
        console.error('Milestone update failed:', e);
      } finally {
        setSaving(false);
        setCompleting(false);
      }
    },
    [milestone.id, milestone.status, pct, onUpdate]
  );

  const handleComplete = async () => {
    setCompleting(true);
    await save(100, 'completed');
  };

  const isCompleted = milestone.status === 'completed';
  const riskCfg = RISK_CONFIG[milestone.risk_indicator] ?? RISK_CONFIG.low;

  return (
    <div
      className="flex items-center gap-3 flex-wrap mt-3 pt-3 border-t border-gray-50"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Slider + number */}
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
          className={cn(
            'flex-1 h-1.5 rounded-full cursor-pointer disabled:cursor-not-allowed',
            `accent-[${riskCfg.bar}]`
          )}
          style={{ accentColor: isCompleted ? '#22c55e' : undefined }}
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
          className="w-14 border border-gray-200 rounded-md px-2 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:bg-gray-50"
        />
      </div>

      {/* Status picker */}
      <select
        value={milestone.status}
        disabled={isCompleted || saving}
        onChange={(e) => save(undefined, e.target.value)}
        className="border border-gray-200 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:bg-gray-50"
      >
        <option value="pending">Pending</option>
        <option value="in_progress">In Progress</option>
        <option value="at_risk">At Risk</option>
        <option value="completed">Completed</option>
        <option value="missed">Missed</option>
      </select>

      {/* Complete / already done */}
      {!isCompleted ? (
        <button
          onClick={handleComplete}
          disabled={saving || completing}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60"
        >
          {completing ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
          Mark Complete
        </button>
      ) : (
        <span className="flex items-center gap-1 text-xs text-green-700 font-medium">
          <CheckCircle2 className="w-3.5 h-3.5" /> Completed
        </span>
      )}

      {saving && !completing && <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />}
    </div>
  );
}

// ── Add Modal ────────────────────────────────────────────────────────────────
function AddMilestoneModal({
  projectId,
  onClose,
  onCreated,
}: {
  projectId: string;
  onClose: () => void;
  onCreated: (m: Milestone) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [type, setType] = useState<'date_based' | 'percentage_based' | 'condition_based'>('date_based');
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Milestone name is required'); return; }
    setSaving(true); setError('');
    try {
      const res = await axios.post(
        `${API_URL}/milestones`,
        {
          project_id: projectId,
          name: name.trim(),
          description: description.trim() || undefined,
          milestone_type: type,
          due_date: dueDate ? new Date(dueDate).toISOString() : undefined,
          requires_approval: requiresApproval,
        },
        { headers: getAuthHeader() }
      );
      onCreated(res.data);
      onClose();
    } catch (e: any) {
      setError(e.response?.data?.detail ?? e.message ?? 'Failed to create milestone');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Target className="w-5 h-5 text-indigo-500" /> Add Milestone
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Milestone Name *</label>
            <input
              autoFocus
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. MVP Launch, Beta Release…"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                value={type}
                onChange={(e) => setType(e.target.value as any)}
              >
                <option value="date_based">Date Based</option>
                <option value="percentage_based">Percentage Based</option>
                <option value="condition_based">Condition Based</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
              <input
                type="date"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="rounded"
              checked={requiresApproval}
              onChange={(e) => setRequiresApproval(e.target.checked)}
            />
            <span className="text-sm text-gray-700">Requires approval</span>
          </label>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 rounded-lg py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-2 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</> : 'Create Milestone'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Panel ─────────────────────────────────────────────────────────────────
interface MilestonesPanelProps { projectId: string; }

export function MilestonesPanel({ projectId }: MilestonesPanelProps) {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchMilestones = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/milestones?project_id=${projectId}`, {
        headers: getAuthHeader(),
      });
      setMilestones(res.data);
    } catch (e) {
      console.error('MilestonesPanel error:', e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchMilestones(); }, [fetchMilestones]);

  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const handleUpdated = (updated: Milestone) =>
    setMilestones((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this milestone?')) return;
    setDeleting(id);
    try {
      await axios.delete(`${API_URL}/milestones/${id}`, { headers: getAuthHeader() });
      setMilestones((prev) => prev.filter((m) => m.id !== id));
    } catch {
      alert('Failed to delete milestone');
    } finally {
      setDeleting(null);
    }
  };

  const completedCount = milestones.filter((m) => m.status === 'completed').length;
  const avgCompletion = milestones.length
    ? Math.round(milestones.reduce((s, m) => s + m.completion_percentage, 0) / milestones.length)
    : 0;

  const riskGroups = {
    critical: milestones.filter((m) => m.risk_indicator === 'critical'),
    high:     milestones.filter((m) => m.risk_indicator === 'high'),
    medium:   milestones.filter((m) => m.risk_indicator === 'medium'),
    low:      milestones.filter((m) => !m.risk_indicator || m.risk_indicator === 'low'),
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse h-24" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {showModal && (
        <AddMilestoneModal
          projectId={projectId}
          onClose={() => setShowModal(false)}
          onCreated={(m) => setMilestones((prev) => [...prev, m])}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Milestones</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {completedCount}/{milestones.length} completed · {avgCompletion}% avg progress
          </p>
        </div>
        <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4 mr-1" /> Add Milestone
        </Button>
      </div>

      {/* Overall completion bar */}
      {milestones.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Overall Completion</p>
            <span className="text-sm font-bold text-indigo-600">{avgCompletion}%</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-green-500 rounded-full transition-all duration-700"
              style={{ width: `${avgCompletion}%` }}
            />
          </div>

          {/* Risk pills */}
          <div className="flex gap-3 flex-wrap mt-3">
            {Object.entries(riskGroups).map(([risk, items]) => {
              if (items.length === 0) return null;
              const cfg = RISK_CONFIG[risk];
              return (
                <div key={risk} className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', cfg.bg, cfg.text)}>
                  <span className={cn('w-2 h-2 rounded-full', cfg.dot)} />
                  {items.length} {risk.charAt(0).toUpperCase() + risk.slice(1)} Risk
                </div>
              );
            })}
          </div>
        </div>
      )}

      {milestones.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
          <Target className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No milestones yet</p>
          <p className="text-gray-400 text-sm mt-1">Add your first milestone to track key achievements</p>
          <Button size="sm" className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => setShowModal(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add First Milestone
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {milestones.map((milestone) => {
            const risk = RISK_CONFIG[milestone.risk_indicator] ?? RISK_CONFIG.low;
            const isOpen = expanded.has(milestone.id);
            const isCompleted = milestone.status === 'completed';

            return (
              <div
                key={milestone.id}
                className={cn(
                  'bg-white rounded-2xl border shadow-sm overflow-hidden hover:shadow-md transition-all',
                  isCompleted ? 'border-green-200' : 'border-gray-100'
                )}
              >
                {/* Header row */}
                <button
                  onClick={() => toggleExpand(milestone.id)}
                  className="w-full flex items-center gap-4 p-5 text-left"
                >
                  {/* Risk colour strip */}
                  <div className={cn('w-1.5 self-stretch rounded-full flex-shrink-0', risk.dot)} />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      {STATUS_ICONS[milestone.status]}
                      <span className="font-semibold text-gray-800">{milestone.name}</span>
                      <Badge variant="secondary" className="text-[10px] capitalize">
                        {milestone.milestone_type.replace('_', ' ')}
                      </Badge>
                      {milestone.requires_approval && !milestone.is_approved && (
                        <Badge className="text-[10px] bg-purple-100 text-purple-700 border-0">Pending Approval</Badge>
                      )}
                    </div>
                    {/* Progress bar */}
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden max-w-sm">
                      <div
                        className={cn('h-full rounded-full transition-all duration-500', isCompleted ? 'bg-green-500' : risk.bar)}
                        style={{ width: `${milestone.completion_percentage}%` }}
                      />
                    </div>
                  </div>

                  {/* Right meta */}
                  <div className="flex items-center gap-3 text-sm text-gray-500 flex-shrink-0">
                    <span className={cn('font-bold text-base', isCompleted ? 'text-green-600' : 'text-gray-700')}>
                      {Math.round(milestone.completion_percentage)}%
                    </span>
                    {milestone.due_date && (
                      <span className="text-xs hidden sm:block">
                        {new Date(milestone.due_date).toLocaleDateString()}
                      </span>
                    )}
                    {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </div>
                </button>

                {/* Expanded: controls */}
                {isOpen && (
                  <div className="px-5 pb-5 border-t border-gray-50">
                    {milestone.description && (
                      <p className="text-sm text-gray-500 pt-3 mb-2">{milestone.description}</p>
                    )}

                    {/* ── CONTROLS ── */}
                    <MilestoneControls milestone={milestone} onUpdate={handleUpdated} />

                    {/* Delete */}
                    <div className="flex justify-end mt-3">
                      <button
                        onClick={() => handleDelete(milestone.id)}
                        disabled={deleting === milestone.id}
                        className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 transition-colors"
                      >
                        {deleting === milestone.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                        Delete milestone
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
