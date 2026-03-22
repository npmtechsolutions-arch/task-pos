import { useEffect, useState, memo } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { analyticsApi } from '@/api/analytics';
import './reports.css';

// ── Skeleton ───────────────────────────────────────────────────────────────
const Skeleton = ({ w = '100%', h = '2rem' }: { w?: string; h?: string }) => (
  <div className="skeleton" style={{ width: w, height: h, borderRadius: '.5rem' }} />
);

// ── MetricCard ─────────────────────────────────────────────────────────────
const MetricCard = memo(({ label, value, icon, trend, trendDir, color }: {
  label: string; value: string | number; icon: string;
  trend?: string; trendDir?: 'up' | 'down' | 'flat'; color: string;
}) => (
  <div className="kpi-card">
    <div className="kpi-icon" style={{ background: `${color}20` }}>
      <span style={{ fontSize: '1.25rem' }}>{icon}</span>
    </div>
    <div className="kpi-value">{value}</div>
    <div className="kpi-label">{label}</div>
    {trend && (
      <span className={`kpi-trend ${trendDir || 'flat'}`}>
        {trendDir === 'up' ? '↑' : trendDir === 'down' ? '↓' : '•'} {trend}
      </span>
    )}
  </div>
));


// ── Main Page ───────────────────────────────────────────────────────────────
export function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<any>(null);
  const [trend, setTrend] = useState<any>(null);
  const [contributors, setContributors] = useState<any>(null);
  const [resource, setResource] = useState<any>(null);
  const [forecast, setForecast] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'time' | 'resource' | 'forecast'>('overview');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      analyticsApi.getKpis(),
      analyticsApi.getTaskTrend(30),
      analyticsApi.getContributors(30, 8),
    ]).then(([k, t, c]) => {
      setKpis(k); setTrend(t); setContributors(c);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (activeTab === 'resource' && !resource) {
      analyticsApi.getResourceReport().then(setResource).catch(console.error);
    }
    if (activeTab === 'forecast' && !forecast) {
      analyticsApi.getForecast(8).then(setForecast).catch(console.error);
    }
  }, [activeTab]);

  const ph = kpis?.project_health;
  const tt = kpis?.task_throughput;

  return (
    <div className="reports-page">
      {/* Header */}
      <div className="reports-header">
        <div>
          <h1>📊 Analytics &amp; Reports</h1>
          <p style={{ color: '#6b7280', marginTop: '.25rem', fontSize: '.9rem' }}>
            Real-time insights · Last refreshed {new Date().toLocaleTimeString()}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '.75rem' }}>
          <Link to="/reports/builder" className="btn-primary">🛠 Report Builder</Link>
          <Link to="/reports/history" className="btn-ghost">📁 History</Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div className="kpi-card" key={i}>
              <Skeleton w="3rem" h="3rem" />
              <Skeleton w="60%" h="2rem" />
              <Skeleton w="80%" h="1rem" />
            </div>
          ))
        ) : kpis ? (
          <>
            <MetricCard label="Total Projects" value={ph?.total ?? '—'} icon="📂" color="#4f46e5" trend={`${ph?.active} active`} trendDir="flat" />
            <MetricCard label="On-Track Projects" value={ph?.on_track ?? '—'} icon="✅" color="#16a34a" trend={`${ph?.at_risk} at-risk`} trendDir={ph?.at_risk > 0 ? 'down' : 'up'} />
            <MetricCard label="Overdue Tasks" value={kpis.overdue_tasks ?? '—'} icon="⚠️" color="#dc2626" />
            <MetricCard label="Completed This Month" value={tt?.completed_this_month ?? '—'} icon="🏆" color="#4f46e5" trend={`${tt?.completed_this_week} this week`} trendDir="up" />
            <MetricCard label="Hours Logged (Month)" value={`${kpis.total_hours_this_month ?? 0}h`} icon="⏱️" color="#7c3aed" />
            <MetricCard label="Avg Utilization" value={`${kpis.avg_utilization_pct ?? 0}%`} icon="📈" color="#0891b2" trendDir={kpis.avg_utilization_pct > 85 ? 'down' : 'up'} trend={kpis.avg_utilization_pct > 85 ? 'Overloaded' : 'Healthy'} />
          </>
        ) : null}
      </div>

      {/* Tab bar */}
      <div className="tab-bar">
        {(['overview','time','resource','forecast'] as const).map(tab => (
          <button key={tab} className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}>
            {{ overview:'📊 Overview', time:'⏱ Time', resource:'👥 Resources', forecast:'🔮 Forecast' }[tab]}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {activeTab === 'overview' && (
        <div className="charts-grid">
          {/* Task Trend Line Chart */}
          <div className="chart-card">
            <div className="chart-title">Task Completion Trend (30 days)</div>
            {!trend ? <Skeleton w="100%" h="220px" /> : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trend.points}>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="completed" stroke="#4f46e5" strokeWidth={2} dot={false} name="Completed" />
                  <Line type="monotone" dataKey="created" stroke="#818cf8" strokeWidth={2} dot={false} name="Created" strokeDasharray="4 2" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Project Health Donut */}
          <div className="chart-card">
            <div className="chart-title">Project Health</div>
            {!ph ? <Skeleton w="100%" h="220px" /> : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'On Track', value: ph.on_track },
                      { name: 'At Risk', value: ph.at_risk },
                      { name: 'Completed', value: ph.completed },
                    ]}
                    cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                    dataKey="value" paddingAngle={3}
                  >
                    {['#4f46e5','#f59e0b','#10b981'].map((c, i) => <Cell key={i} fill={c} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Top Contributors */}
          <div className="chart-card" style={{ gridColumn: '1 / -1' }}>
            <div className="chart-title">🏆 Top Contributors (30 days)</div>
            {!contributors ? (
              Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} w="100%" h="2.5rem" />)
            ) : (
              contributors.contributors?.slice(0, 8).map((c: any) => (
                <div className="contributor-row" key={c.user_id}>
                  <div className="contributor-avatar">
                    {c.avatar_url ? (
                      <img src={c.avatar_url} alt={c.full_name} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                    ) : c.full_name?.[0]}
                  </div>
                  <span className="contributor-name">{c.full_name}</span>
                  <span className="contributor-stat">{c.completed_tasks} tasks</span>
                  <span className="contributor-stat">{c.hours_logged}h</span>
                  <div className="efficiency-bar">
                    <div className="efficiency-fill" style={{ width: `${Math.round(c.efficiency * 100)}%` }} />
                  </div>
                  <span className="contributor-stat" style={{ color: '#4f46e5', fontSize: '.8rem' }}>
                    {Math.round(c.efficiency * 100)}%
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Time tab */}
      {activeTab === 'time' && <TimeTab />}

      {/* Resource tab */}
      {activeTab === 'resource' && <ResourceTab data={resource} />}

      {/* Forecast tab */}
      {activeTab === 'forecast' && <ForecastTab data={forecast} />}
    </div>
  );
}

// ── Time Tab ─────────────────────────────────────────────────────────────────
function TimeTab() {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    analyticsApi.getTimeAnalytics(30).then(setData).catch(console.error);
  }, []);

  return (
    <div>
      {!data ? <Skeleton w="100%" h="300px" /> : (
        <>
          <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
            <MetricCard label="Total Hours" value={`${data.total_hours}h`} icon="⏱" color="#4f46e5" />
            <MetricCard label="Billable" value={`${data.billable_hours}h`} icon="💰" color="#16a34a" trend={`${Math.round(data.billable_ratio * 100)}%`} trendDir="up" />
            <MetricCard label="Non-billable" value={`${data.non_billable_hours}h`} icon="📋" color="#6b7280" />
          </div>
          <div className="chart-card">
            <div className="chart-title">Hours per Project</div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.projects?.slice(0, 10)} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="project_name" type="category" tick={{ fontSize: 10 }} width={120} />
                <Tooltip />
                <Legend />
                <Bar dataKey="billable_hours" stackId="a" fill="#4f46e5" name="Billable" />
                <Bar dataKey="non_billable_hours" stackId="a" fill="#a5b4fc" name="Non-billable" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}

// ── Resource Tab ─────────────────────────────────────────────────────────────
function ResourceTab({ data }: { data: any }) {
  if (!data) return <Skeleton w="100%" h="300px" />;
  return (
    <div>
      <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
        <MetricCard label="Total Users" value={data.total_users} icon="👥" color="#4f46e5" />
        <MetricCard label="Avg Utilization" value={`${data.avg_utilization_pct}%`} icon="📊" color="#7c3aed" />
        <MetricCard label="Overloaded" value={data.overloaded_count} icon="🔥" color="#dc2626" />
      </div>
      <div className="chart-card">
        <div className="chart-title">Capacity vs Allocation</div>
        <div className="results-table-wrap">
          <table className="results-table">
            <thead>
              <tr>
                <th>Member</th><th>Capacity (h/wk)</th><th>Allocated (h)</th><th>Utilization</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.users?.map((u: any) => (
                <tr key={u.user_id}>
                  <td>{u.full_name}</td>
                  <td>{u.capacity_hours}h</td>
                  <td>{u.allocated_hours}h</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                      <div className="efficiency-bar" style={{ width: '60px' }}>
                        <div className="efficiency-fill" style={{ width: `${Math.min(u.utilization_pct, 100)}%`, background: u.is_overloaded ? '#dc2626' : undefined }} />
                      </div>
                      <span>{u.utilization_pct}%</span>
                    </div>
                  </td>
                  <td>
                    <span style={{ padding: '.2rem .6rem', borderRadius: '99px', fontSize: '.75rem', fontWeight: 700,
                      background: u.is_overloaded ? '#fee2e2' : '#dcfce7',
                      color: u.is_overloaded ? '#dc2626' : '#16a34a' }}>
                      {u.is_overloaded ? '🔥 Overloaded' : '✅ OK'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Forecast Tab ──────────────────────────────────────────────────────────────
function ForecastTab({ data }: { data: any }) {
  if (!data) return <Skeleton w="100%" h="300px" />;
  return (
    <div>
      <div className="chart-card" style={{ marginBottom: '1.5rem' }}>
        <div className="chart-title">8-Week Capacity Forecast</div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data.forecast}>
            <XAxis dataKey="week_start" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="capacity_hours" fill="#e5e7eb" name="Capacity" />
            <Bar dataKey="predicted_hours" fill="#4f46e5" name="Predicted Load" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="forecast-grid">
        {data.forecast?.map((wk: any, i: number) => (
          <div key={i} className={`forecast-week ${wk.surplus_hours >= 0 ? 'surplus' : 'overload'}`}>
            <div className="forecast-week-label">{wk.week_start}</div>
            <div className="forecast-hours" style={{ color: wk.surplus_hours >= 0 ? '#16a34a' : '#dc2626' }}>
              {wk.predicted_hours}h
            </div>
            <div className="forecast-surplus">
              {wk.surplus_hours >= 0 ? `+${wk.surplus_hours}h free` : `${Math.abs(wk.surplus_hours)}h over`}
            </div>
            {wk.overloaded_users?.length > 0 && (
              <div style={{ fontSize: '.65rem', color: '#dc2626', marginTop: '.25rem' }}>
                {wk.overloaded_users.length} overloaded
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
