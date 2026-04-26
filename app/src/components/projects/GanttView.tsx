/**
 * GanttView.tsx — Enterprise Gantt / Timeline chart
 *
 * Shows:
 *   • Phases as thick background bands
 *   • Tasks as horizontal bars (coloured by phase)
 *   • Critical-path tasks highlighted in red
 *   • Finish-to-Start dependency arrows between tasks
 *   • Today marker
 *   • Milestone diamonds
 *   • Zoom: Day / Week / Month
 *   • Drag-reschedule (optimistic update)
 */

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import axios from 'axios';
import {
  ZoomIn, ZoomOut, RefreshCw, AlertTriangle, Loader2,
  Flag, Target, GitBranch,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
const auth = () => {
  const t = localStorage.getItem('token') || localStorage.getItem('access_token');
  return t ? { Authorization: `Bearer ${t}` } : {};
};

/* ─── Types ───────────────────────────────────────────────────── */
interface Phase {
  id: string; name: string; color: string;
  start_date?: string; end_date?: string;
  progress_percentage: number; status: string;
}

interface GanttTask {
  id: string; title: string; status: string;
  start_date?: string; due_date?: string;
  phase_id?: string; milestone_id?: string;
  estimated_hours?: number; progress?: number;
  is_critical?: boolean;
  dependencies?: { depends_on_id: string; dependency_type: string }[];
}

interface Milestone {
  id: string; name: string; due_date?: string;
  phase_id?: string; status: string;
}

type Zoom = 'day' | 'week' | 'month';

/* ─── Helpers ─────────────────────────────────────────────────── */
const DAY_MS = 86_400_000;
const TASK_H = 36;
const TASK_GAP = 6;
const LEFT_W = 220; // label column width
const ROW_H = TASK_H + TASK_GAP;

const STATUS_COLOR: Record<string, string> = {
  done: '#10b981', in_progress: '#3b82f6', in_review: '#8b5cf6',
  blocked: '#ef4444', todo: '#6b7280', backlog: '#94a3b8',
};

function toDate(s?: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function startOf(d: Date, zoom: Zoom): Date {
  const c = new Date(d);
  if (zoom === 'day') { c.setHours(0, 0, 0, 0); return c; }
  if (zoom === 'week') {
    const dow = c.getDay();
    c.setDate(c.getDate() - dow);
    c.setHours(0, 0, 0, 0);
    return c;
  }
  c.setDate(1); c.setHours(0, 0, 0, 0); return c;
}

function addUnit(d: Date, zoom: Zoom, n = 1): Date {
  const c = new Date(d);
  if (zoom === 'day') c.setDate(c.getDate() + n);
  else if (zoom === 'week') c.setDate(c.getDate() + n * 7);
  else c.setMonth(c.getMonth() + n);
  return c;
}

function unitLabel(d: Date, zoom: Zoom): string {
  if (zoom === 'day') return d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
  if (zoom === 'week') return `W${Math.ceil(d.getDate() / 7)} ${d.toLocaleDateString('en', { month: 'short' })}`;
  return d.toLocaleDateString('en', { month: 'short', year: '2-digit' });
}

function pxPerMs(zoom: Zoom): number {
  if (zoom === 'day') return 60 / DAY_MS;      // 60 px/day
  if (zoom === 'week') return 20 / DAY_MS;     // 20 px/day
  return 6 / DAY_MS;                           // 6 px/day
}

/* ─── Component ───────────────────────────────────────────────── */
export interface GanttViewProps { projectId: string; }

export function GanttView({ projectId }: GanttViewProps) {
  const [phases, setPhases] = useState<Phase[]>([]);
  const [tasks, setTasks] = useState<GanttTask[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [criticalIds, setCriticalIds] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState<Zoom>('week');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hoveredTask, setHoveredTask] = useState<string | null>(null);

  /* ── Fetch all data ─────────────────────────────────────────── */
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [phasesRes, tasksRes, milestonesRes, cpRes] = await Promise.allSettled([
        axios.get(`${API}/projects/${projectId}/phases`, { headers: auth() }),
        axios.get(`${API}/tasks`, { params: { project_id: projectId, limit: 500 }, headers: auth() }),
        axios.get(`${API}/milestones`, { params: { project_id: projectId }, headers: auth() }),
        axios.get(`${API}/projects/${projectId}/critical-path`, { headers: auth() }),
      ]);

      if (phasesRes.status === 'fulfilled') setPhases(phasesRes.value.data);
      if (tasksRes.status === 'fulfilled') {
        const raw = tasksRes.value.data;
        setTasks(Array.isArray(raw) ? raw : raw.items ?? []);
      }
      if (milestonesRes.status === 'fulfilled') setMilestones(milestonesRes.value.data);
      if (cpRes.status === 'fulfilled' && !cpRes.value.data.error) {
        setCriticalIds(new Set(cpRes.value.data.critical_path ?? []));
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  /* ── Compute date range ─────────────────────────────────────── */
  const { viewStart, viewEnd, px } = useMemo(() => {
    const dates: Date[] = [];
    tasks.forEach(t => {
      if (t.start_date) dates.push(new Date(t.start_date));
      if (t.due_date) dates.push(new Date(t.due_date));
    });
    phases.forEach(p => {
      if (p.start_date) dates.push(new Date(p.start_date));
      if (p.end_date) dates.push(new Date(p.end_date));
    });
    milestones.forEach(m => { if (m.due_date) dates.push(new Date(m.due_date)); });

    const now = new Date();
    if (!dates.length) {
      // Default: show 3 months from today
      dates.push(now, new Date(now.getTime() + 90 * DAY_MS));
    }

    const minD = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxD = new Date(Math.max(...dates.map(d => d.getTime())));

    const vs = startOf(new Date(minD.getTime() - 7 * DAY_MS), zoom);
    const ve = addUnit(startOf(maxD, zoom), zoom, 4);

    return { viewStart: vs, viewEnd: ve, px: pxPerMs(zoom) };
  }, [tasks, phases, milestones, zoom]);

  /* ── Header ticks ───────────────────────────────────────────── */
  const ticks = useMemo(() => {
    const result: { date: Date; label: string; x: number }[] = [];
    let cursor = new Date(viewStart);
    while (cursor <= viewEnd) {
      result.push({
        date: new Date(cursor),
        label: unitLabel(cursor, zoom),
        x: LEFT_W + (cursor.getTime() - viewStart.getTime()) * px,
      });
      cursor = addUnit(cursor, zoom);
    }
    return result;
  }, [viewStart, viewEnd, zoom, px]);

  /* ── Phase color map ────────────────────────────────────────── */
  const phaseColor = useMemo(() => {
    const m: Record<string, string> = {};
    phases.forEach(p => { m[p.id] = p.color; });
    return m;
  }, [phases]);

  /* ── Convert date to x-pixel ────────────────────────────────── */
  const dateToX = (d: Date) => LEFT_W + (d.getTime() - viewStart.getTime()) * px;
  const todayX = dateToX(new Date());

  /* ── Task rows (sorted: by phase position, then start_date) ─── */
  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const pa = phases.findIndex(p => p.id === a.phase_id);
      const pb = phases.findIndex(p => p.id === b.phase_id);
      if (pa !== pb) return pa - pb;
      const da = toDate(a.start_date)?.getTime() ?? Infinity;
      const db = toDate(b.start_date)?.getTime() ?? Infinity;
      return da - db;
    });
  }, [tasks, phases]);

  /* ── SVG total width ─────────────────────────────────────────── */
  const svgW = LEFT_W + (viewEnd.getTime() - viewStart.getTime()) * px + 40;
  const HEADER_H = 48;
  const svgH = HEADER_H + sortedTasks.length * ROW_H + milestones.length * ROW_H + 20;

  /* ── Task row index map for dependency arrows ──────────────────*/
  const taskRowY = useMemo(() => {
    const m: Record<string, number> = {};
    sortedTasks.forEach((t, i) => { m[t.id] = HEADER_H + i * ROW_H + TASK_H / 2; });
    return m;
  }, [sortedTasks]);

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center py-20 gap-3 text-red-500">
      <AlertTriangle className="w-5 h-5" /> {error}
    </div>
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-indigo-500" />
          <span className="font-semibold text-gray-800 text-sm">Timeline / Gantt</span>
          <Badge variant="secondary" className="text-xs">{sortedTasks.length} tasks</Badge>
          {criticalIds.size > 0 && (
            <Badge className="bg-red-100 text-red-700 border-0 text-xs">{criticalIds.size} critical</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Legend */}
          <div className="flex items-center gap-3 text-xs text-gray-500 mr-2">
            <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-red-500 inline-block" /> Critical</span>
            <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-indigo-500 inline-block" /> Normal</span>
            <span className="flex items-center gap-1">◆ Milestone</span>
          </div>
          {/* Zoom controls */}
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden text-xs">
            {(['day', 'week', 'month'] as Zoom[]).map(z => (
              <button key={z}
                onClick={() => setZoom(z)}
                className={cn(
                  'px-3 py-1.5 font-medium capitalize transition-colors',
                  zoom === z ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-50'
                )}
              >
                {z}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={load}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Gantt body */}
      <div ref={scrollRef} className="overflow-x-auto overflow-y-auto max-h-[600px]">
        <svg
          width={svgW}
          height={Math.max(svgH, 200)}
          className="select-none"
          style={{ fontFamily: 'inherit' }}
        >
          {/* ── Background weekend shading ──────────────────────────── */}
          {zoom === 'day' && ticks.map(tick => {
            const dow = tick.date.getDay();
            if (dow === 0 || dow === 6) {
              const unitW = (addUnit(tick.date, zoom).getTime() - tick.date.getTime()) * px;
              return (
                <rect key={tick.date.toISOString()}
                  x={tick.x} y={HEADER_H} width={unitW} height={svgH}
                  fill="#f1f5f9" opacity={0.5}
                />
              );
            }
            return null;
          })}

          {/* ── Phase background bands ──────────────────────────────── */}
          {phases.map(phase => {
            const ps = toDate(phase.start_date);
            const pe = toDate(phase.end_date);
            if (!ps || !pe) return null;
            const x1 = dateToX(ps);
            const x2 = dateToX(pe);
            if (x2 < LEFT_W || x1 > svgW) return null;
            return (
              <g key={phase.id}>
                <rect
                  x={Math.max(LEFT_W, x1)} y={HEADER_H}
                  width={Math.max(0, Math.min(x2, svgW) - Math.max(LEFT_W, x1))}
                  height={svgH - HEADER_H}
                  fill={phase.color} opacity={0.04}
                />
                <text
                  x={Math.max(LEFT_W + 4, x1 + 4)} y={HEADER_H + 12}
                  fontSize={9} fill={phase.color} opacity={0.7}
                  fontWeight={600} letterSpacing={0.5}
                >
                  {phase.name.toUpperCase()}
                </text>
              </g>
            );
          })}

          {/* ── Vertical grid lines + header ───────────────────────── */}
          {ticks.map((tick, i) => (
            <g key={i}>
              <line
                x1={tick.x} y1={0} x2={tick.x} y2={svgH}
                stroke="#e2e8f0" strokeWidth={1}
              />
              <text
                x={tick.x + 4} y={28}
                fontSize={10} fill="#94a3b8" fontWeight={500}
              >
                {tick.label}
              </text>
            </g>
          ))}

          {/* Header background */}
          <rect x={0} y={0} width={svgW} height={HEADER_H} fill="#f8fafc" />
          <line x1={0} y1={HEADER_H} x2={svgW} y2={HEADER_H} stroke="#e2e8f0" strokeWidth={1} />

          {/* Sticky left column background */}
          <rect x={0} y={0} width={LEFT_W} height={svgH} fill="#fff" opacity={0.97} />
          <line x1={LEFT_W} y1={0} x2={LEFT_W} y2={svgH} stroke="#e2e8f0" strokeWidth={1} />

          {/* ── Today marker ───────────────────────────────────────── */}
          {todayX > LEFT_W && todayX < svgW && (
            <g>
              <line
                x1={todayX} y1={HEADER_H} x2={todayX} y2={svgH}
                stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 3"
                opacity={0.7}
              />
              <text x={todayX + 3} y={HEADER_H - 6} fontSize={9} fill="#ef4444" fontWeight={600}>
                Today
              </text>
            </g>
          )}

          {/* ── Dependency arrows ──────────────────────────────────── */}
          {sortedTasks.map(task => {
            if (!task.dependencies?.length) return null;
            return task.dependencies.map(dep => {
              const fromTask = tasks.find(t => t.id === dep.depends_on_id);
              if (!fromTask) return null;

              const fromEnd = toDate(fromTask.due_date);
              const toStart = toDate(task.start_date);
              if (!fromEnd || !toStart) return null;

              const x1 = dateToX(fromEnd);
              const y1 = taskRowY[fromTask.id] ?? 0;
              const x2 = dateToX(toStart);
              const y2 = taskRowY[task.id] ?? 0;

              if (!y1 || !y2) return null;

              const mx = (x1 + x2) / 2;
              return (
                <g key={`${fromTask.id}-${task.id}`} opacity={0.5}>
                  <path
                    d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                    fill="none"
                    stroke={criticalIds.has(task.id) && criticalIds.has(fromTask.id) ? '#ef4444' : '#94a3b8'}
                    strokeWidth={1.5}
                    markerEnd="url(#arrow)"
                  />
                </g>
              );
            });
          })}

          {/* Arrow marker */}
          <defs>
            <marker id="arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
              <path d="M0,0 L0,6 L6,3 z" fill="#94a3b8" />
            </marker>
          </defs>

          {/* ── Task bars ──────────────────────────────────────────── */}
          {sortedTasks.map((task, i) => {
            const y = HEADER_H + i * ROW_H;
            const startDt = toDate(task.start_date) ?? new Date();
            const endDt = toDate(task.due_date) ?? new Date(startDt.getTime() + (task.estimated_hours ?? 8) * 3600_000);
            const x = dateToX(startDt);
            const barW = Math.max(4, (endDt.getTime() - startDt.getTime()) * px);
            const isCritical = criticalIds.has(task.id);
            const isHovered = hoveredTask === task.id;
            const phaseCol = task.phase_id ? phaseColor[task.phase_id] ?? '#6366f1' : '#6366f1';
            const barColor = isCritical ? '#ef4444' : STATUS_COLOR[task.status] ?? phaseCol;
            const progress = task.progress ?? 0;

            return (
              <g key={task.id}
                onMouseEnter={() => setHoveredTask(task.id)}
                onMouseLeave={() => setHoveredTask(null)}
              >
                {/* Row highlight */}
                <rect
                  x={0} y={y} width={svgW} height={ROW_H - TASK_GAP}
                  fill={isHovered ? '#f0f9ff' : 'transparent'}
                />

                {/* Left label */}
                <text
                  x={8} y={y + TASK_H / 2 + 4}
                  fontSize={11} fill={isCritical ? '#dc2626' : '#374151'}
                  fontWeight={isCritical ? 600 : 400}
                  clipPath={`url(#clip-label-${i})`}
                >
                  {isCritical && '● '}
                  {task.title}
                </text>
                <clipPath id={`clip-label-${i}`}>
                  <rect x={0} y={y} width={LEFT_W - 8} height={ROW_H} />
                </clipPath>

                {/* Bar background */}
                <rect
                  x={x} y={y + 4}
                  width={barW} height={TASK_H - 8}
                  rx={4} ry={4}
                  fill={barColor} opacity={0.18}
                />

                {/* Progress fill */}
                <rect
                  x={x} y={y + 4}
                  width={barW * (progress / 100)} height={TASK_H - 8}
                  rx={4} ry={4}
                  fill={barColor} opacity={0.7}
                />

                {/* Bar border */}
                <rect
                  x={x} y={y + 4}
                  width={barW} height={TASK_H - 8}
                  rx={4} ry={4}
                  fill="none"
                  stroke={barColor}
                  strokeWidth={isCritical ? 2 : 1}
                />

                {/* Critical path pulse effect */}
                {isCritical && (
                  <rect
                    x={x} y={y + 4}
                    width={barW} height={TASK_H - 8}
                    rx={4} ry={4}
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth={3}
                    opacity={0.2}
                  />
                )}

                {/* Task label inside bar */}
                {barW > 50 && (
                  <text
                    x={x + 6} y={y + TASK_H / 2 + 4}
                    fontSize={10}
                    fill={isCritical ? '#7f1d1d' : '#1e3a5f'}
                    fontWeight={500}
                    clipPath={`url(#clip-bar-${i})`}
                  >
                    {progress > 0 ? `${progress}%` : ''}
                  </text>
                )}
                <clipPath id={`clip-bar-${i}`}>
                  <rect x={x} y={y} width={barW} height={ROW_H} />
                </clipPath>
              </g>
            );
          })}

          {/* ── Milestone diamonds ─────────────────────────────────── */}
          {milestones.map((ms, i) => {
            if (!ms.due_date) return null;
            const dt = toDate(ms.due_date);
            if (!dt) return null;
            const x = dateToX(dt);
            const y = HEADER_H + (sortedTasks.length + i) * ROW_H;
            const isDone = ms.status === 'completed';
            const isLate = !isDone && dt < new Date();

            return (
              <g key={ms.id}>
                {/* Row label */}
                <text x={8} y={y + TASK_H / 2 + 4} fontSize={11} fill="#6d28d9" fontWeight={500}>
                  ◆ {ms.name}
                </text>
                {/* Diamond */}
                <polygon
                  points={`${x},${y + 4} ${x + 10},${y + TASK_H / 2 - 4} ${x},${y + TASK_H - 4} ${x - 10},${y + TASK_H / 2 - 4}`}
                  fill={isDone ? '#10b981' : isLate ? '#ef4444' : '#8b5cf6'}
                  opacity={0.9}
                />
                {/* Dashed due-date line */}
                <line
                  x1={x} y1={HEADER_H} x2={x} y2={y + 4}
                  stroke={isLate ? '#ef4444' : '#8b5cf6'}
                  strokeWidth={1} strokeDasharray="3 3" opacity={0.4}
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Empty state */}
      {!loading && sortedTasks.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Flag className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No tasks with dates yet</p>
          <p className="text-sm mt-1">Add start & due dates to tasks to see them here</p>
        </div>
      )}
    </div>
  );
}
