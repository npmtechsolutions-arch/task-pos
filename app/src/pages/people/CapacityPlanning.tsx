import { useState, useEffect } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

interface WorkloadMember {
  user_id: string;
  full_name: string;
  avatar_url?: string;
  utilization_percentage: number;
  available_hours: number;
  allocated_hours: number;
  is_overloaded: boolean;
  open_task_count: number;
  effective_capacity_hours: number;
  project_breakdown: Array<{ project_name: string; allocated_hours: number; task_count: number }>;
}

interface Candidate {
  user_id: string;
  full_name: string;
  title?: string;
  department?: string;
  overall_score: number;
  skill_match_score: number;
  availability_score: number;
  workload_score: number;
  utilization_percentage: number;
  available_hours: number;
  matched_skills: string[];
  missing_skills: string[];
}

const utilColor = (pct: number) =>
  pct >= 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : '#22c55e';

export function CapacityPlanning() {
  const [employees, setEmployees] = useState<WorkloadMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [taskId, setTaskId] = useState('');
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [selectedUser, setSelectedUser] = useState<WorkloadMember | null>(null);

  useEffect(() => {
    loadAllWorkloads();
  }, []);

  const loadAllWorkloads = async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/employees?per_page=50`, { headers: headers() });
      const users = r.data.items;
      const workloads = await Promise.all(
        users.map((u: any) =>
          axios.get(`${API}/capacity/users/${u.id}/workload`, { headers: headers() })
            .then(r => r.data)
            .catch(() => null)
        )
      );
      setEmployees(workloads.filter(Boolean));
    } finally {
      setLoading(false);
    }
  };

  const getRecommendations = async () => {
    if (!taskId.trim()) return;
    setAssigning(true);
    try {
      const r = await axios.get(`${API}/capacity/recommend?task_id=${taskId}&top_n=5`, { headers: headers() });
      setCandidates(r.data.candidates);
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="cap-page">
      <div className="cap-header">
        <div>
          <h1 className="cap-title">Capacity Planning</h1>
          <p className="cap-subtitle">Real-time workload across the organization</p>
        </div>
        <div className="cap-summary-chips">
          <span className="cap-chip overloaded">
            🔴 {employees.filter(e => e.is_overloaded).length} Overloaded
          </span>
          <span className="cap-chip ok">
            🟢 {employees.filter(e => !e.is_overloaded && e.utilization_percentage > 0).length} Active
          </span>
          <span className="cap-chip avg">
            📊 {employees.length > 0
              ? (employees.reduce((s, e) => s + e.utilization_percentage, 0) / employees.length).toFixed(0)
              : 0}% Avg
          </span>
        </div>
      </div>

      {/* Smart Assignment Panel */}
      <div className="cap-smart-section">
        <h2 className="cap-section-title">🤖 Smart Assignment</h2>
        <p className="cap-smart-desc">Enter a Task ID to get AI-ranked assignees based on skills + availability + workload.</p>
        <div className="cap-smart-input-row">
          <input
            className="cap-task-input"
            placeholder="Paste Task ID (UUID)…"
            value={taskId}
            onChange={e => setTaskId(e.target.value)}
          />
          <button className="cap-btn-primary" onClick={getRecommendations} disabled={assigning}>
            {assigning ? '⏳ Analysing…' : '🚀 Recommend'}
          </button>
        </div>
        {candidates && (
          <div className="cap-candidates">
            {candidates.map((c, i) => (
              <div key={c.user_id} className={`cap-candidate ${i === 0 ? 'best' : ''}`}>
                <div className="cap-cand-rank">#{i + 1}</div>
                <div className="cap-cand-info">
                  <div className="cap-cand-name">{c.full_name}</div>
                  {c.title && <div className="cap-cand-title">{c.title}</div>}
                  {c.department && <div className="cap-cand-dept">{c.department}</div>}
                </div>
                <div className="cap-cand-scores">
                  <div className="cap-score-bar">
                    <span className="cap-score-label">Overall</span>
                    <div className="cap-score-track"><div className="cap-score-fill" style={{ width: `${c.overall_score * 100}%`, background: '#6366f1' }} /></div>
                    <span>{(c.overall_score * 100).toFixed(0)}%</span>
                  </div>
                  <div className="cap-score-bar">
                    <span className="cap-score-label">Skills</span>
                    <div className="cap-score-track"><div className="cap-score-fill" style={{ width: `${c.skill_match_score * 100}%`, background: '#22c55e' }} /></div>
                    <span>{(c.skill_match_score * 100).toFixed(0)}%</span>
                  </div>
                  <div className="cap-score-bar">
                    <span className="cap-score-label">Avail.</span>
                    <div className="cap-score-track"><div className="cap-score-fill" style={{ width: `${c.availability_score * 100}%`, background: '#3b82f6' }} /></div>
                    <span>{(c.availability_score * 100).toFixed(0)}%</span>
                  </div>
                </div>
                <div className="cap-cand-util" style={{ color: utilColor(c.utilization_percentage) }}>
                  {c.utilization_percentage.toFixed(0)}% used
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Team Workload Chart */}
      <div className="cap-workload-section">
        <h2 className="cap-section-title">📊 Team Workload</h2>
        {loading ? (
          <div className="cap-loading"><div className="cap-spinner" /></div>
        ) : (
          <div className="cap-workload-list">
            {employees
              .sort((a, b) => b.utilization_percentage - a.utilization_percentage)
              .map(emp => (
                <div
                  key={emp.user_id}
                  className={`cap-workload-row ${emp.is_overloaded ? 'overloaded' : ''}`}
                  onClick={() => setSelectedUser(selectedUser?.user_id === emp.user_id ? null : emp)}
                >
                  <div className="cap-wl-avatar">
                    {emp.avatar_url
                      ? <img src={emp.avatar_url} alt={emp.full_name} />
                      : <span>{emp.full_name[0]}</span>
                    }
                  </div>
                  <div className="cap-wl-name">{emp.full_name}</div>
                  <div className="cap-wl-bar-wrap">
                    <div className="cap-wl-bar-bg">
                      <div
                        className="cap-wl-bar-fill"
                        style={{
                          width: `${Math.min(emp.utilization_percentage, 100)}%`,
                          background: utilColor(emp.utilization_percentage),
                        }}
                      />
                    </div>
                  </div>
                  <div className="cap-wl-pct" style={{ color: utilColor(emp.utilization_percentage) }}>
                    {emp.utilization_percentage.toFixed(0)}%
                  </div>
                  <div className="cap-wl-hours">{emp.allocated_hours}h / {emp.effective_capacity_hours}h</div>
                  {emp.is_overloaded && <span className="cap-wl-overload-badge">⚠ Over</span>}
                </div>
              ))}
          </div>
        )}

        {/* Expanded row detail */}
        {selectedUser && (
          <div className="cap-expanded-detail">
            <h3>{selectedUser.full_name} — Project Breakdown</h3>
            {selectedUser.project_breakdown?.length === 0 ? (
              <p>No project allocations found.</p>
            ) : (
              <table className="cap-breakdown-table">
                <thead>
                  <tr>
                    <th>Project</th><th>Hours</th><th>Tasks</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedUser.project_breakdown?.map((p, i) => (
                    <tr key={i}>
                      <td>{p.project_name}</td>
                      <td>{p.allocated_hours}h</td>
                      <td>{p.task_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
