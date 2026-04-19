/**
 * ═══════════════════════════════════════════════════════
 *  ENTERPRISE ANALYTICS & REPORTS — FULL DASHBOARD
 *  Charts: Recharts (Bar, Line, Pie, Area, Radar, Radial)
 * ═══════════════════════════════════════════════════════
 */
import { useEffect, useState, memo, useMemo } from 'react';
import {
  AreaChart, Area,
  BarChart, Bar,
  LineChart, Line,
  PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  RadialBarChart, RadialBar,
  ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Users, CheckSquare, Clock, Target,
  BarChart2, Layers, Award, AlertTriangle, RefreshCw, Download, Zap,
  Calendar, FolderOpen, Activity,
} from 'lucide-react';
import './reports.css';

// ── Token helper (matches authStore key) ──────────────────────────────────────
const getToken = () =>
  localStorage.getItem('token') || localStorage.getItem('access_token') || '';

async function apiFetch(path: string) {
  const token = getToken();
  const base = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000/api/v1';
  const res = await fetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

// ── Colour Palette ─────────────────────────────────────────────────────────────
const C = {
  indigo:  '#4f46e5',
  violet:  '#7c3aed',
  sky:     '#0ea5e9',
  emerald: '#10b981',
  amber:   '#f59e0b',
  rose:    '#f43f5e',
  slate:   '#64748b',
  teal:    '#14b8a6',
  fuchsia: '#d946ef',
  orange:  '#f97316',
};

const PIE_PALETTE  = [C.indigo, C.amber, C.emerald, C.rose, C.sky, C.violet];
const GRAD_PAIRS: [string,string][] = [
  ['#4f46e5','#818cf8'], ['#10b981','#6ee7b7'],
  ['#f59e0b','#fcd34d'], ['#f43f5e','#fda4af'],
];

// ── Skeleton ───────────────────────────────────────────────────────────────────
const SK = ({ h = '220px', w = '100%' }: { h?: string; w?: string }) => (
  <div className="skeleton" style={{ height: h, width: w, borderRadius: '1rem' }} />
);

// ── Gradient definitions ───────────────────────────────────────────────────────
function Defs() {
  return (
    <defs>
      {GRAD_PAIRS.map(([s, e], i) => (
        <linearGradient key={i} id={`grad${i}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%"  stopColor={s} stopOpacity={0.35} />
          <stop offset="95%" stopColor={e} stopOpacity={0.02} />
        </linearGradient>
      ))}
    </defs>
  );
}

// ── Custom tooltip ─────────────────────────────────────────────────────────────
const CustomTip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rp-tooltip">
      <div className="rp-tooltip-label">{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} className="rp-tooltip-row">
          <span className="rp-tooltip-dot" style={{ background: p.color }} />
          <span>{p.name}</span>
          <strong>{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</strong>
        </div>
      ))}
    </div>
  );
};

// ── KPI Card ───────────────────────────────────────────────────────────────────
const KpiCard = memo(function KpiCard({
  label, value, icon: Icon, trend, trendDir, color, sub,
}: {
  label: string; value: string | number; icon: any;
  trend?: string; trendDir?: 'up' | 'down' | 'flat'; color: string; sub?: string;
}) {
  return (
    <div className="rp-kpi" style={{ '--kpi-color': color } as any}>
      <div className="rp-kpi-icon"><Icon size={20} /></div>
      <div className="rp-kpi-body">
        <div className="rp-kpi-value">{value}</div>
        <div className="rp-kpi-label">{label}</div>
        {sub && <div className="rp-kpi-sub">{sub}</div>}
        {trend && (
          <span className={`rp-kpi-badge ${trendDir}`}>
            {trendDir === 'up' ? <TrendingUp size={11} /> : trendDir === 'down' ? <TrendingDown size={11} /> : null}
            {trend}
          </span>
        )}
      </div>
    </div>
  );
});

// ── Section header ─────────────────────────────────────────────────────────────
const SectionHeading = ({ icon: Icon, title, sub }: { icon: any; title: string; sub?: string }) => (
  <div className="rp-section-heading">
    <div className="rp-section-icon"><Icon size={18} /></div>
    <div>
      <h2 className="rp-section-title">{title}</h2>
      {sub && <p className="rp-section-sub">{sub}</p>}
    </div>
  </div>
);

// ── Card wrapper ───────────────────────────────────────────────────────────────
const Card = ({ children, className = '', col }: { children: React.ReactNode; className?: string; col?: string }) => (
  <div className={`rp-card ${className}`} style={col ? { gridColumn: col } : undefined}>
    {children}
  </div>
);

// ── Progress bar ───────────────────────────────────────────────────────────────
const ProgressBar = ({ pct, color = C.indigo }: { pct: number; color?: string }) => (
  <div className="rp-progress-track">
    <div className="rp-progress-fill" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
  </div>
);

// ── Sparkline data generator (for demo when no data) ──────────────────────────
function sparkline(n = 12, base = 40, variance = 30) {
  return Array.from({ length: n }, (_, i) => ({
    i, v: Math.max(0, base + Math.sin(i * 0.7) * variance + Math.random() * 15),
  }));
}

// ── MAIN COMPONENT ─────────────────────────────────────────────────────────────
export function ReportsPage() {
  const [tab, setTab]   = useState<'overview' | 'projects' | 'tasks' | 'team' | 'time'>('overview');
  const [kpis, setKpis] = useState<any>(null);
  const [trend, setTrend] = useState<any>(null);
  const [contributors, setContributors] = useState<any>(null);
  const [resource, setResource] = useState<any>(null);
  const [timeData, setTimeData] = useState<any>(null);
  const [forecast, setForecast] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      apiFetch('/analytics/kpis'),
      apiFetch('/analytics/task-trend?days=30'),
      apiFetch('/analytics/contributors?days=30&limit=10'),
      apiFetch('/analytics/time?days=30'),
      apiFetch('/analytics/resource'),
      apiFetch('/analytics/forecast?weeks=8'),
    ])
      .then(([k, t, c, tm, r, f]) => {
        setKpis(k); setTrend(t); setContributors(c);
        setTimeData(tm); setResource(r); setForecast(f);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const ph  = kpis?.project_health;
  const tt  = kpis?.task_throughput;

  // Build composite trend data with 7-day MA
  const trendPoints = useMemo(() => {
    const raw: any[] = trend?.points || sparkline(30, 10, 8).map((x, i) => ({
      date: `Day ${i + 1}`, completed: Math.round(x.v), created: Math.round(x.v * 1.2),
    }));
    return raw.map((p: any, i: number, arr: any[]) => {
      const window = arr.slice(Math.max(0, i - 6), i + 1);
      const ma = window.reduce((s: number, w: any) => s + (w.completed || 0), 0) / window.length;
      return { ...p, ma: +ma.toFixed(1) };
    });
  }, [trend]);

  // Project breakdown for pie
  const projectPieData = useMemo(() => [
    { name: 'On Track',  value: ph?.on_track  || 0 },
    { name: 'At Risk',   value: ph?.at_risk    || 0 },
    { name: 'Completed', value: ph?.completed  || 0 },
    { name: 'Delayed',   value: ph?.delayed    || 0 },
  ].filter(d => d.value > 0), [ph]);

  // Task status donut
  const taskDonutData = useMemo(() => [
    { name: 'Done',        value: tt?.completed_this_month || 0,  fill: C.emerald },
    { name: 'In Progress', value: tt?.in_progress           || 0,  fill: C.amber   },
    { name: 'Overdue',     value: kpis?.overdue_tasks        || 0,  fill: C.rose    },
    { name: 'Backlog',     value: tt?.backlog                || 0,  fill: C.slate   },
  ].filter(d => d.value > 0), [tt, kpis]);

  // Radar data: team performance dimensions
  const radarData = useMemo(() => {
    const cs = contributors?.contributors || [];
    if (!cs.length) return [];
    const avg = (key: string) => cs.reduce((s: number, c: any) => s + (c[key] || 0), 0) / cs.length;
    return [
      { metric: 'Completed', score: Math.min(avg('completed_tasks') * 5, 100) },
      { metric: 'Hours',     score: Math.min(avg('hours_logged') * 2, 100) },
      { metric: 'Efficiency',score: Math.round(avg('efficiency') * 100) },
      { metric: 'On-time',   score: Math.round(avg('on_time_rate' as any) * 100) || 72 },
      { metric: 'Quality',   score: 80 },
    ];
  }, [contributors]);

  // Utilization radial
  const utilizationData = useMemo(() => (resource?.users || []).map((u: any, i: number) => ({
    name: u.full_name?.split(' ')[0] || `User ${i + 1}`,
    uv: u.utilization_pct || 0,
    fill: u.is_overloaded ? C.rose : C.indigo,
  })), [resource]);

  // Monthly growth sparkline (computed from trend)
  const growthData = useMemo(() => {
    const pts = trendPoints;
    if (pts.length < 2) return [];
    const weekly: any[] = [];
    for (let i = 0; i < pts.length; i += 7) {
      const slice = pts.slice(i, i + 7);
      const total = slice.reduce((s: number, p: any) => s + (p.completed || 0), 0);
      weekly.push({ week: `W${Math.floor(i / 7) + 1}`, tasks: total });
    }
    return weekly.map((w, i, arr) => ({
      ...w,
      growth: i === 0 ? 0 : +(((w.tasks - arr[i - 1].tasks) / (arr[i - 1].tasks || 1)) * 100).toFixed(1),
    }));
  }, [trendPoints]);

  const TABS = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'projects', label: '📁 Projects' },
    { id: 'tasks',    label: '✅ Tasks' },
    { id: 'team',     label: '👥 Team' },
    { id: 'time',     label: '⏱ Time' },
  ] as const;

  const [exporting, setExporting] = useState(false);
  const [exportTarget, setExportTarget] = useState<'projects'|'tasks'|'users'>('projects');

  const handleExport = async (fmt: 'csv' | 'json' = 'csv') => {
    setExporting(true);
    try {
      const token = getToken();
      const base = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000/api/v1';
      const url = `${base}/export/${exportTarget}?fmt=${fmt}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Export failed: ${res.status}`);
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = `${exportTarget}_report_${new Date().toISOString().slice(0,10)}.${fmt}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objUrl);
    } catch (e: any) {
      alert('Export failed: ' + e.message);
    }
    setExporting(false);
  };

  return (
    <div className="rp-page">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="rp-header">
        <div>
          <h1 className="rp-title">Analytics &amp; Reports</h1>
          <p className="rp-subtitle">
            Real-time project intelligence · {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <div className="rp-header-actions">
          <select
            value={exportTarget}
            onChange={e => setExportTarget(e.target.value as any)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 bg-white mr-2"
          >
            <option value="projects">Projects</option>
            <option value="tasks">Tasks</option>
            <option value="users">Users</option>
          </select>
          <button className="rp-btn-ghost" onClick={() => setRefreshKey(k => k + 1)}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button className="rp-btn-primary" id="btn-export-csv" onClick={() => handleExport('csv')} disabled={exporting}>
            <Download size={14} /> {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
          <button className="rp-btn-ghost" id="btn-export-json" onClick={() => handleExport('json')} disabled={exporting}>
            <Download size={14} /> JSON
          </button>
        </div>
      </div>

      {/* ── Error banner ───────────────────────────────────────────────────── */}
      {error && (
        <div className="rp-error">
          <AlertTriangle size={16} /> Could not load analytics data — {error}
        </div>
      )}

      {/* ── KPI Row ────────────────────────────────────────────────────────── */}
      <div className="rp-kpi-grid">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <SK key={i} h="100px" />)
        ) : (
          <>
            <KpiCard icon={FolderOpen}  color={C.indigo}  label="Total Projects"      value={ph?.total ?? '—'}                   trend={`${ph?.active ?? 0} active`} trendDir="flat" />
            <KpiCard icon={CheckSquare} color={C.emerald} label="Tasks Completed"      value={tt?.completed_this_month ?? '—'}    trend={`${tt?.completed_this_week ?? 0} this week`} trendDir="up" />
            <KpiCard icon={AlertTriangle} color={C.rose}  label="Overdue Tasks"        value={kpis?.overdue_tasks ?? '—'}         trendDir="down" />
            <KpiCard icon={Clock}        color={C.violet} label="Hours Logged"         value={`${kpis?.total_hours_this_month ?? 0}h`} sub="this month" />
            <KpiCard icon={TrendingUp}   color={C.sky}    label="Avg Utilization"      value={`${kpis?.avg_utilization_pct ?? 0}%`} trendDir={kpis?.avg_utilization_pct > 85 ? 'down' : 'up'} trend={kpis?.avg_utilization_pct > 85 ? 'Overloaded' : 'Healthy'} />
            <KpiCard icon={Target}       color={C.amber}  label="Completion Rate"      value={`${ph && ph.total ? Math.round((ph.completed / ph.total) * 100) : 0}%`} trendDir="up" sub="all time" />
          </>
        )}
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div className="rp-tabs">
        {TABS.map(t => (
          <button key={t.id} className={`rp-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id as any)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/*  OVERVIEW TAB                                                       */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {tab === 'overview' && (
        <div className="rp-grid-full">
          {/* 1. Task Completion Trend — Area + MA Line */}
          <Card col="1 / 3">
            <SectionHeading icon={Activity} title="Task Completion Trend" sub="30-day view with 7-day moving average" />
            {loading ? <SK h="260px" /> : (
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={trendPoints}>
                  <Defs />
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f8" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d: string) => d.slice(-5)} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip content={<CustomTip />} />
                  <Legend />
                  <Area type="monotone" dataKey="completed" name="Completed" fill="url(#grad0)" stroke={C.indigo} strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="created"   name="Created"   fill="url(#grad2)" stroke={C.amber}  strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="ma" name="7-Day MA" stroke={C.rose} strokeWidth={2} dot={false} strokeDasharray="6 3" />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* 2. Project Health Donut */}
          <Card>
            <SectionHeading icon={FolderOpen} title="Project Health" />
            {loading ? <SK h="220px" /> : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={projectPieData.length ? projectPieData : [{ name: 'No data', value: 1 }]}
                    cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                    dataKey="value" paddingAngle={3} label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`}
                    labelLine={false}
                  >
                    {projectPieData.map((_, i) => <Cell key={i} fill={PIE_PALETTE[i % PIE_PALETTE.length]} />)}
                  </Pie>
                  <Tooltip content={<CustomTip />} />
                </PieChart>
              </ResponsiveContainer>
            )}
            {/* Legend */}
            <div className="rp-pie-legend">
              {projectPieData.map((d, i) => (
                <div key={i} className="rp-pie-legend-item">
                  <span className="rp-pie-dot" style={{ background: PIE_PALETTE[i % PIE_PALETTE.length] }} />
                  <span>{d.name}</span>
                  <strong>{d.value}</strong>
                </div>
              ))}
            </div>
          </Card>

          {/* 3. Weekly Growth Rate */}
          <Card col="1 / -1">
            <SectionHeading icon={TrendingUp} title="Weekly Growth Rate" sub="Task output week-over-week" />
            {loading ? <SK h="200px" /> : (
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={growthData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f8" />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 10 }} />
                  <Tooltip content={<CustomTip />} />
                  <Legend />
                  <Bar yAxisId="left"  dataKey="tasks"  name="Tasks Done" fill={C.indigo} radius={[6, 6, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="growth" name="Growth %" stroke={C.emerald} strokeWidth={2.5} dot={{ r: 4, fill: C.emerald }} />
                  <ReferenceLine yAxisId="right" y={0} stroke="#e5e7eb" strokeDasharray="4 2" />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/*  PROJECTS TAB                                                       */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {tab === 'projects' && (
        <div className="rp-grid-full">
          {/* Project Completion Bars */}
          <Card col="1 / 3">
            <SectionHeading icon={BarChart2} title="Project Completion Status" sub="Completed vs total tasks per project" />
            {loading ? <SK h="300px" /> : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={(timeData?.projects || []).slice(0, 10).map((p: any) => ({
                    name: p.project_name?.slice(0, 18) || 'Project',
                    billable: p.billable_hours || 0,
                    non: p.non_billable_hours || 0,
                    total: (p.billable_hours || 0) + (p.non_billable_hours || 0),
                  }))}
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f8" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={130} />
                  <Tooltip content={<CustomTip />} />
                  <Legend />
                  <Bar dataKey="billable" name="Billable Hours"     stackId="a" fill={C.indigo}  radius={[0, 0, 0, 0]} />
                  <Bar dataKey="non"      name="Non-billable Hours" stackId="a" fill={C.sky}     radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Project Status Pie */}
          <Card>
            <SectionHeading icon={Target} title="Status Breakdown" />
            {loading ? <SK h="240px" /> : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={projectPieData.length ? projectPieData : [{ name: 'No data', value: 1 }]}
                    cx="50%" cy="50%" outerRadius={90} dataKey="value" paddingAngle={4}>
                    {projectPieData.map((_, i) => <Cell key={i} fill={PIE_PALETTE[i]} />)}
                  </Pie>
                  <Tooltip content={<CustomTip />} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Project health table */}
          <Card col="1 / -1">
            <SectionHeading icon={Layers} title="Project Health Summary" />
            <div className="rp-table-wrap">
              <table className="rp-table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>Count</th>
                    <th>Visual</th>
                    <th>Share</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: '✅ Completed',  value: ph?.completed || 0, color: C.emerald },
                    { label: '🟢 On Track',   value: ph?.on_track  || 0, color: C.indigo  },
                    { label: '🟡 At Risk',    value: ph?.at_risk   || 0, color: C.amber   },
                    { label: '🔴 Delayed',    value: ph?.delayed   || 0, color: C.rose    },
                    { label: '⏸ Planning',   value: ph?.planning  || 0, color: C.slate   },
                  ].map(row => {
                    const total = ph?.total || 1;
                    const pct   = Math.round((row.value / total) * 100);
                    return (
                      <tr key={row.label}>
                        <td><strong>{row.label}</strong></td>
                        <td><strong style={{ color: row.color }}>{row.value}</strong></td>
                        <td style={{ minWidth: 200 }}><ProgressBar pct={pct} color={row.color} /></td>
                        <td>{pct}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/*  TASKS TAB                                                          */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {tab === 'tasks' && (
        <div className="rp-grid-full">
          {/* Task status donut */}
          <Card>
            <SectionHeading icon={CheckSquare} title="Task Status Overview" />
            {loading ? <SK h="240px" /> : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={taskDonutData.length ? taskDonutData : [{ name: 'No data', value: 1, fill: '#e5e7eb' }]}
                    cx="50%" cy="50%" innerRadius={60} outerRadius={100}
                    dataKey="value" paddingAngle={3}>
                    {taskDonutData.map((d: any, i: number) => <Cell key={i} fill={d.fill} />)}
                  </Pie>
                  <Tooltip content={<CustomTip />} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Throughput stacked bar */}
          <Card col="span 2">
            <SectionHeading icon={Zap} title="Daily Task Throughput" sub="Created vs Completed per day" />
            {loading ? <SK h="240px" /> : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={trendPoints.slice(-14)}>
                  <Defs />
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f8" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d: string) => d.slice(-5)} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip content={<CustomTip />} />
                  <Legend />
                  <Bar dataKey="created"   name="Created"   fill={C.sky}    radius={[4, 4, 0, 0]} />
                  <Bar dataKey="completed" name="Completed" fill={C.emerald} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Task KPIs */}
          <Card col="1 / -1">
            <SectionHeading icon={Award} title="Productivity Metrics" />
            <div className="rp-kpi-grid" style={{ marginTop: '1rem' }}>
              <KpiCard icon={CheckSquare} color={C.emerald} label="Done This Month"  value={tt?.completed_this_month ?? 0} />
              <KpiCard icon={CheckSquare} color={C.sky}     label="Done This Week"   value={tt?.completed_this_week  ?? 0} />
              <KpiCard icon={AlertTriangle} color={C.rose}  label="Overdue"          value={kpis?.overdue_tasks       ?? 0} trendDir="down" />
              <KpiCard icon={Clock}       color={C.violet}  label="Avg Days to Done" value={`${tt?.avg_days_to_done ?? '—'}d`} />
            </div>
          </Card>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/*  TEAM TAB                                                           */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {tab === 'team' && (
        <div className="rp-grid-full">
          {/* Radar — team skill dimensions */}
          <Card>
            <SectionHeading icon={Activity} title="Team Performance Radar" sub="Multi-dimension score" />
            {loading ? <SK h="260px" /> : (
              <ResponsiveContainer width="100%" height={260}>
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius={100}>
                  <PolarGrid stroke="#e5e7eb" />
                  <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} />
                  <Radar name="Team" dataKey="score" stroke={C.indigo} fill={C.indigo} fillOpacity={0.3} />
                  <Tooltip content={<CustomTip />} />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Radial utilization */}
          <Card>
            <SectionHeading icon={Users} title="Utilization Radial" sub="% of capacity used" />
            {loading ? <SK h="260px" /> : (
              <ResponsiveContainer width="100%" height={260}>
                <RadialBarChart cx="50%" cy="50%" innerRadius={20} outerRadius={120}
                  data={utilizationData.slice(0, 6)} startAngle={180} endAngle={-180}>
                  <RadialBar minAngle={15} label={{ position: 'insideStart', fill: '#fff', fontSize: 9 }}
                    background dataKey="uv" />
                  <Legend iconSize={10} layout="vertical" verticalAlign="middle" align="right" />
                  <Tooltip content={<CustomTip />} formatter={(v: any) => `${v}%`} />
                </RadialBarChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Top contributors bar */}
          <Card col="1 / -1">
            <SectionHeading icon={Award} title="Top Contributors" sub="Tasks completed + hours logged (30 days)" />
            {loading ? <SK h="280px" /> : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={(contributors?.contributors || []).slice(0, 8).map((c: any) => ({
                  name: c.full_name?.split(' ')[0] || 'User',
                  tasks: c.completed_tasks || 0,
                  hours: c.hours_logged    || 0,
                  efficiency: Math.round((c.efficiency || 0) * 100),
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f8" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip content={<CustomTip />} />
                  <Legend />
                  <Bar dataKey="tasks"      name="Tasks Done"   fill={C.indigo}  radius={[6, 6, 0, 0]} />
                  <Bar dataKey="hours"      name="Hours Logged" fill={C.sky}     radius={[6, 6, 0, 0]} />
                  <Bar dataKey="efficiency" name="Efficiency %" fill={C.emerald} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Contributors detailed table */}
          <Card col="1 / -1">
            <SectionHeading icon={Users} title="Member Leaderboard" />
            <div className="rp-table-wrap">
              <table className="rp-table">
                <thead>
                  <tr>
                    <th>#</th><th>Member</th><th>Tasks Done</th><th>Hours</th>
                    <th>Efficiency</th><th>Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {(contributors?.contributors || []).slice(0, 10).map((c: any, i: number) => (
                    <tr key={c.user_id}>
                      <td>
                        <span style={{
                          fontWeight: 800, color: [C.amber, C.slate, C.orange][i] || '#6b7280',
                        }}>
                          {i < 3 ? ['🥇','🥈','🥉'][i] : `#${i + 1}`}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                          <div className="rp-avatar">{c.full_name?.[0] || '?'}</div>
                          <strong>{c.full_name}</strong>
                        </div>
                      </td>
                      <td><strong style={{ color: C.indigo }}>{c.completed_tasks}</strong></td>
                      <td>{c.hours_logged}h</td>
                      <td>
                        <span style={{
                          color: c.efficiency > 0.75 ? C.emerald : c.efficiency > 0.5 ? C.amber : C.rose,
                          fontWeight: 700,
                        }}>
                          {Math.round(c.efficiency * 100)}%
                        </span>
                      </td>
                      <td style={{ minWidth: 150 }}>
                        <ProgressBar pct={Math.round(c.efficiency * 100)} color={c.efficiency > 0.75 ? C.emerald : C.amber} />
                      </td>
                    </tr>
                  ))}
                  {!contributors?.contributors?.length && (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>No data yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/*  TIME TAB                                                           */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {tab === 'time' && (
        <div className="rp-grid-full">
          {/* Billable ratio donut */}
          <Card>
            <SectionHeading icon={Clock} title="Billable vs Non-Billable" />
            {loading ? <SK h="240px" /> : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Billable',     value: timeData?.billable_hours     || 0 },
                      { name: 'Non-billable', value: timeData?.non_billable_hours || 0 },
                    ]}
                    cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                    dataKey="value" paddingAngle={3}
                  >
                    <Cell fill={C.emerald} />
                    <Cell fill={C.slate}   />
                  </Pie>
                  <Tooltip content={<CustomTip />} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
            <div className="rp-stat-row">
              <div><span>Total</span><strong>{timeData?.total_hours || 0}h</strong></div>
              <div><span>Billable</span><strong style={{ color: C.emerald }}>{timeData?.billable_hours || 0}h</strong></div>
              <div><span>Ratio</span><strong>{timeData ? Math.round(timeData.billable_ratio * 100) : 0}%</strong></div>
            </div>
          </Card>

          {/* Hours per project bar */}
          <Card col="span 2">
            <SectionHeading icon={BarChart2} title="Hours Logged per Project" sub="Stacked billable / non-billable" />
            {loading ? <SK h="260px" /> : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={(timeData?.projects || []).slice(0, 10).map((p: any) => ({
                    name: (p.project_name || 'Project').slice(0, 16),
                    billable: p.billable_hours     || 0,
                    non:      p.non_billable_hours || 0,
                  }))}
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f8" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={130} />
                  <Tooltip content={<CustomTip />} />
                  <Legend />
                  <Bar dataKey="billable" name="Billable"     stackId="a" fill={C.indigo}  />
                  <Bar dataKey="non"      name="Non-billable" stackId="a" fill={C.sky}     radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* 8-week forecast area */}
          <Card col="1 / -1">
            <SectionHeading icon={Calendar} title="8-Week Capacity Forecast" sub="Predicted workload vs available capacity" />
            {loading ? <SK h="260px" /> : (
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={forecast?.forecast || []}>
                  <Defs />
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f8" />
                  <XAxis dataKey="week_start" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip content={<CustomTip />} />
                  <Legend />
                  <Area type="monotone" dataKey="capacity_hours"  name="Capacity"       fill="url(#grad1)" stroke={C.emerald} strokeWidth={2} />
                  <Area type="monotone" dataKey="predicted_hours" name="Predicted Load" fill="url(#grad3)" stroke={C.rose}    strokeWidth={2} />
                  <ReferenceLine y={0} stroke="#e5e7eb" />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Weeks grid */}
          <Card col="1 / -1">
            <SectionHeading icon={Calendar} title="Weekly Surplus / Deficit" />
            <div className="rp-forecast-grid">
              {(forecast?.forecast || []).map((wk: any, i: number) => (
                <div key={i} className={`rp-forecast-week ${wk.surplus_hours >= 0 ? 'surplus' : 'overload'}`}>
                  <div className="rp-fw-label">{wk.week_start}</div>
                  <div className="rp-fw-hours">{wk.predicted_hours}h</div>
                  <div className="rp-fw-delta" style={{ color: wk.surplus_hours >= 0 ? C.emerald : C.rose }}>
                    {wk.surplus_hours >= 0 ? `+${wk.surplus_hours}h free` : `${Math.abs(wk.surplus_hours)}h over`}
                  </div>
                  {wk.overloaded_users?.length > 0 && (
                    <div className="rp-fw-warn">⚠ {wk.overloaded_users.length} overloaded</div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
