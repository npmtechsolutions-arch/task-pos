import { useState, useEffect } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

// Proficiency level → background color (0 = grey, 1-5 = indigo scale)
const LEVEL_COLORS = ['#1e1e2e', '#312e81', '#3730a3', '#4338ca', '#4f46e5', '#6366f1'];
const LEVEL_TEXT = ['', 'Beg', 'Elem', 'Int', 'Adv', 'Exp'];

export function SkillMatrix() {
  const [matrix, setMatrix] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filterDept, setFilterDept] = useState('');
  const [filterSkill, setFilterSkill] = useState('');

  useEffect(() => {
    axios.get(`${API}/rbac/skills/matrix`, { headers: headers() })
      .then(r => setMatrix(r.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="matrix-loading">
        <div className="matrix-spinner" />
        <span>Loading skill matrix…</span>
      </div>
    );
  }

  if (!matrix) return <div className="matrix-error">Could not load matrix.</div>;

  const departments = Array.from(new Set(matrix.rows.map((r: any) => r.department).filter(Boolean))) as string[];
  const skills: any[] = filterSkill
    ? matrix.skill_columns.filter((s: any) => s.name.toLowerCase().includes(filterSkill.toLowerCase()))
    : matrix.skill_columns;
  const rows: any[] = filterDept
    ? matrix.rows.filter((r: any) => r.department === filterDept)
    : matrix.rows;

  const getLevel = (row: any, skillId: string) => {
    const match = row.skills.find((s: any) => s.skill_id === skillId);
    return match ? match.proficiency_level : 0;
  };

  return (
    <div className="matrix-page">
      <div className="matrix-header">
        <div>
          <h1 className="matrix-title">Skill Matrix</h1>
          <p className="matrix-subtitle">
            {matrix.total_employees} employees · {matrix.total_skills} skills tracked
          </p>
        </div>
        <div className="matrix-filters">
          <input
            className="matrix-filter-input"
            placeholder="Filter skill…"
            value={filterSkill}
            onChange={e => setFilterSkill(e.target.value)}
          />
          <select
            className="matrix-filter-select"
            value={filterDept}
            onChange={e => setFilterDept(e.target.value)}
          >
            <option value="">All Departments</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      <div className="matrix-legend">
        {[0, 1, 2, 3, 4, 5].map(lvl => (
          <span key={lvl} className="matrix-legend-item">
            <span className="matrix-legend-cell" style={{ background: LEVEL_COLORS[lvl] }} />
            {lvl === 0 ? 'None' : LEVEL_TEXT[lvl]}
          </span>
        ))}
      </div>

      <div className="matrix-scroll-wrap">
        <table className="matrix-table">
          <thead>
            <tr>
              <th className="matrix-th-name">Employee</th>
              {skills.map((s: any) => (
                <th key={s.id} className="matrix-th-skill">
                  <span className="matrix-th-skill-label">{s.name}</span>
                  {s.category && (
                    <span className="matrix-th-cat" style={{ color: s.category.color }}>
                      {s.category.name}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row: any) => (
              <tr key={row.user_id} className="matrix-row">
                <td className="matrix-td-name">
                  <div className="matrix-employee">
                    <div className="matrix-avatar">
                      {row.avatar_url
                        ? <img src={row.avatar_url} alt={row.full_name} />
                        : <span>{row.full_name[0]}</span>
                      }
                    </div>
                    <div>
                      <div className="matrix-emp-name">{row.full_name}</div>
                      {row.department && <div className="matrix-emp-dept">{row.department}</div>}
                    </div>
                  </div>
                </td>
                {skills.map((s: any) => {
                  const level = getLevel(row, s.id);
                  const cellSkill = row.skills.find((rs: any) => rs.skill_id === s.id);
                  return (
                    <td
                      key={s.id}
                      className="matrix-td-cell"
                      title={level > 0 ? `${row.full_name}: ${s.name} — Level ${level} (${cellSkill?.validation_status})` : `${row.full_name}: No skill`}
                    >
                      <div
                        className="matrix-cell"
                        style={{ background: LEVEL_COLORS[level] }}
                      >
                        {level > 0 && <span className="matrix-cell-label">{LEVEL_TEXT[level]}</span>}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
