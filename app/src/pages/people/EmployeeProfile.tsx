import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const STARS = (level: number) => '★'.repeat(level) + '☆'.repeat(5 - level);
const VALIDATION_COLORS: Record<string, string> = {
  self: '#94a3b8',
  peer: '#3b82f6',
  certified: '#22c55e',
};

export function EmployeeProfile() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [emp, setEmp] = useState<any>(null);
  const [workload, setWorkload] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    Promise.all([
      axios.get(`${API}/employees/${userId}`, { headers: headers() }),
      axios.get(`${API}/capacity/users/${userId}/workload`, { headers: headers() }),
    ]).then(([empR, wR]) => {
      setEmp(empR.data);
      setWorkload(wR.data);
    }).finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return (
      <div className="ep-loading">
        <div className="ep-spinner" />
      </div>
    );
  }

  if (!emp) return <div className="ep-error">Employee not found.</div>;

  const utilColor = workload
    ? workload.utilization_percentage >= 100 ? '#ef4444'
      : workload.utilization_percentage >= 80 ? '#f59e0b'
      : '#22c55e'
    : '#6b7280';

  const hireDate = emp.hire_date
    ? new Date(emp.hire_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  return (
    <div className="ep-page">
      <button className="ep-back" onClick={() => navigate('/people')}>← Back to People</button>

      {/* Header */}
      <div className="ep-header-card">
        <div className="ep-avatar-wrap">
          {emp.avatar_url ? (
            <img src={emp.avatar_url} alt={emp.full_name} className="ep-avatar" />
          ) : (
            <div className="ep-avatar-placeholder">
              {emp.full_name?.[0]?.toUpperCase()}
            </div>
          )}
          <div className={`ep-status-dot ${emp.is_active ? 'active' : 'inactive'}`} />
        </div>
        <div className="ep-header-info">
          <h1 className="ep-name">{emp.full_name}</h1>
          {emp.title && <p className="ep-title-line">{emp.title}</p>}
          <div className="ep-meta-row">
            {emp.department && <span className="ep-meta-chip dept">{emp.department}</span>}
            <span className="ep-meta-chip role">{emp.role}</span>
            {hireDate && <span className="ep-meta-chip hire">📅 Since {hireDate}</span>}
            {emp.location && <span className="ep-meta-chip loc">📍 {emp.location}</span>}
          </div>
          <a href={`mailto:${emp.email}`} className="ep-email">{emp.email}</a>
        </div>
      </div>

      <div className="ep-body">
        {/* Workload Section */}
        {workload && (
          <section className="ep-section ep-workload-section">
            <h2 className="ep-section-title">⚡ Workload</h2>
            <div className="ep-workload-gauge-wrap">
              <div className="ep-gauge-number" style={{ color: utilColor }}>
                {workload.utilization_percentage.toFixed(0)}%
              </div>
              <p className="ep-gauge-label">utilization</p>
              <div className="ep-util-bar-bg">
                <div
                  className="ep-util-bar-fill"
                  style={{
                    width: `${Math.min(workload.utilization_percentage, 100)}%`,
                    background: utilColor,
                  }}
                />
              </div>
              {workload.is_overloaded && (
                <div className="ep-overload-badge">⚠ OVERLOADED</div>
              )}
            </div>
            <div className="ep-workload-stats">
              <div className="ep-stat"><span className="ep-stat-val">{workload.allocated_hours}h</span><span className="ep-stat-lbl">Allocated</span></div>
              <div className="ep-stat"><span className="ep-stat-val">{workload.effective_capacity_hours}h</span><span className="ep-stat-lbl">Capacity/wk</span></div>
              <div className="ep-stat"><span className="ep-stat-val">{workload.open_task_count}</span><span className="ep-stat-lbl">Open Tasks</span></div>
              <div className="ep-stat"><span className="ep-stat-val" style={{ color: workload.available_hours < 0 ? '#ef4444' : '#22c55e' }}>{workload.available_hours}h</span><span className="ep-stat-lbl">Available</span></div>
            </div>
            {workload.project_breakdown?.length > 0 && (
              <div className="ep-project-breakdown">
                {workload.project_breakdown.map((p: any) => (
                  <div key={p.project_id} className="ep-pb-row">
                    <span className="ep-pb-name">{p.project_name}</span>
                    <span className="ep-pb-hours">{p.allocated_hours}h · {p.task_count} tasks</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Skills Section */}
        <section className="ep-section ep-skills-section">
          <h2 className="ep-section-title">🧠 Skills</h2>
          {emp.skills?.length === 0 ? (
            <p className="ep-empty">No skills added yet.</p>
          ) : (
            <div className="ep-skills-grid">
              {emp.skills?.map((us: any) => (
                <div key={us.id} className="ep-skill-card">
                  <div className="ep-skill-header">
                    <span className="ep-skill-name">{us.skill.name}</span>
                    <span
                      className="ep-skill-val-badge"
                      style={{ background: VALIDATION_COLORS[us.validation_status] }}
                    >
                      {us.validation_status}
                    </span>
                  </div>
                  {us.skill.category && (
                    <span className="ep-skill-cat">{us.skill.category.name}</span>
                  )}
                  <div className="ep-skill-stars" title={`Level ${us.proficiency_level}/5`}>
                    {STARS(us.proficiency_level)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
