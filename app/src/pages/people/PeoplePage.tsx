import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

interface Employee {
  id: string;
  email: string;
  full_name: string;
  first_name?: string;
  avatar_url?: string;
  role: string;
  is_active: boolean;
  title?: string;
  department?: string;
  hire_date?: string;
  skills: Array<{
    skill: { name: string; category?: { name: string; color: string } };
    proficiency_level: number;
    validation_status: string;
  }>;
}

const PROFICIENCY_LABELS = ['', 'Beginner', 'Elementary', 'Intermediate', 'Advanced', 'Expert'];
const UTILIZATION_COLOR = (pct: number) =>
  pct >= 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : '#22c55e';

function UtilizationBar({ userId }: { userId: string }) {
  const [util, setUtil] = useState<number | null>(null);

  useEffect(() => {
    axios
      .get(`${API}/capacity/users/${userId}/workload`, { headers: headers() })
      .then(r => setUtil(r.data.utilization_percentage))
      .catch(() => setUtil(0));
  }, [userId]);

  if (util === null) return <div className="people-util-bar loading" />;
  const color = UTILIZATION_COLOR(util);
  return (
    <div className="people-util-wrap">
      <div className="people-util-bar-bg">
        <div
          className="people-util-bar-fill"
          style={{ width: `${Math.min(util, 100)}%`, background: color }}
        />
      </div>
      <span className="people-util-label" style={{ color }}>
        {util.toFixed(0)}%
      </span>
    </div>
  );
}

export function PeoplePage() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [departments, setDepartments] = useState<string[]>([]);

  useEffect(() => {
    load();
  }, [search, department]);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ per_page: '50' });
      if (search) params.append('search', search);
      if (department) params.append('department', department);
      const r = await axios.get(`${API}/employees?${params}`, { headers: headers() });
      const items: Employee[] = r.data.items;
      setEmployees(items);
      const depts = Array.from(new Set(items.map(e => e.department).filter(Boolean))) as string[];
      setDepartments(depts);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="people-page">
      <div className="people-header">
        <div>
          <h1 className="people-title">People</h1>
          <p className="people-subtitle">Org directory · {employees.length} employees</p>
        </div>
        <div className="people-controls">
          <button className="people-btn-secondary" onClick={() => navigate('/people/org-chart')}>
            🌳 Org Chart
          </button>
          <button className="people-btn-secondary" onClick={() => navigate('/people/skills')}>
            📊 Skill Matrix
          </button>
          <button className="people-btn-primary" onClick={() => navigate('/people/capacity')}>
            ⚡ Capacity
          </button>
        </div>
      </div>

      <div className="people-filters">
        <input
          className="people-search"
          placeholder="🔍 Search by name or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="people-dept-select"
          value={department}
          onChange={e => setDepartment(e.target.value)}
        >
          <option value="">All Departments</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="people-loading">
          <div className="people-spinner" />
          <span>Loading employees…</span>
        </div>
      ) : (
        <div className="people-grid">
          {employees.map(emp => (
            <div
              key={emp.id}
              className="people-card"
              onClick={() => navigate(`/people/${emp.id}`)}
            >
              <div className="people-card-header">
                <div className="people-avatar">
                  {emp.avatar_url ? (
                    <img src={emp.avatar_url} alt={emp.full_name} />
                  ) : (
                    <span>{(emp.first_name?.[0] ?? emp.full_name[0]).toUpperCase()}</span>
                  )}
                </div>
                <div className="people-card-info">
                  <div className="people-card-name">{emp.full_name}</div>
                  <div className="people-card-title">{emp.title || 'No title set'}</div>
                  {emp.department && (
                    <span className="people-dept-badge">{emp.department}</span>
                  )}
                </div>
              </div>

              <UtilizationBar userId={emp.id} />

              <div className="people-skills-row">
                {emp.skills.slice(0, 4).map(us => (
                  <span
                    key={us.skill.name}
                    className="people-skill-chip"
                    style={{ borderColor: us.skill.category?.color ?? '#6366F1' }}
                    title={`${us.skill.name} — ${PROFICIENCY_LABELS[us.proficiency_level]}`}
                  >
                    {us.skill.name}
                  </span>
                ))}
                {emp.skills.length > 4 && (
                  <span className="people-skill-more">+{emp.skills.length - 4}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
