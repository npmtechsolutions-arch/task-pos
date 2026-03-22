import { useEffect, useState } from 'react';
import { reportsApi } from '@/api/analytics';
import './reports.css';

export function ReportHistory() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, any>>({});

  useEffect(() => {
    reportsApi.listReports()
      .then(setReports)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const runReport = async (id: string) => {
    setRunningId(id);
    try {
      const result = await reportsApi.runReport(id);
      setResults(prev => ({ ...prev, [id]: result }));
    } catch (e: any) {
      alert(e.message);
    } finally {
      setRunningId(null);
    }
  };

  const exportReport = async (id: string, name: string, fmt: 'csv' | 'excel' | 'json' | 'pdf') => {
    try {
      const report = await reportsApi.getReport(id);
      const { blob, filename } = await reportsApi.export(report.definition, fmt, name);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const deleteReport = async (id: string) => {
    if (!confirm('Delete this report?')) return;
    await reportsApi.deleteReport(id);
    setReports(r => r.filter(x => x.id !== id));
  };

  return (
    <div className="reports-page">
      <div className="reports-header">
        <h1>📁 Report History</h1>
      </div>

      {loading ? (
        Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ marginBottom: '1rem' }}>
            <div className="skeleton" style={{ height: '80px', borderRadius: '1rem' }} />
          </div>
        ))
      ) : reports.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '5rem 1rem', color: '#9ca3af' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📂</div>
          <p>No saved reports yet. <a href="/reports/builder" style={{ color: '#4f46e5' }}>Create one →</a></p>
        </div>
      ) : (
        reports.map(r => (
          <div key={r.id} className="builder-panel" style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', justifyContent: 'space-between' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '.25rem' }}>{r.name}</div>
                {r.description && <div style={{ color: '#6b7280', fontSize: '.875rem', marginBottom: '.5rem' }}>{r.description}</div>}
                <div style={{ display: 'flex', gap: '1rem', fontSize: '.8rem', color: '#9ca3af' }}>
                  <span>Entity: <strong style={{ color: '#4f46e5' }}>{r.definition?.entity}</strong></span>
                  <span>Runs: {r.run_count}</span>
                  {r.last_run_at && <span>Last run: {new Date(r.last_run_at).toLocaleDateString()}</span>}
                  <span>Created: {new Date(r.created_at).toLocaleDateString()}</span>
                  {r.is_public && <span style={{ background: '#f5f3ff', color: '#4f46e5', padding: '.1rem .4rem', borderRadius: '4px' }}>Public</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '.5rem', flexShrink: 0 }}>
                <button className="btn-primary" style={{ fontSize: '.8rem', padding: '.45rem .9rem' }}
                  onClick={() => runReport(r.id)} disabled={runningId === r.id}>
                  {runningId === r.id ? '⏳' : '▶ Run'}
                </button>
                <div style={{ position: 'relative' }}>
                  <select className="builder-select" style={{ marginBottom: 0, fontSize: '.8rem', padding: '.45rem .7rem', width: 'auto' }}
                    defaultValue=""
                    onChange={async e => { if (!e.target.value) return; await exportReport(r.id, r.name, e.target.value as any); e.target.value = ''; }}>
                    <option value="">📤 Export</option>
                    <option value="csv">CSV</option>
                    <option value="excel">Excel</option>
                    <option value="json">JSON</option>
                    <option value="pdf">PDF</option>
                  </select>
                </div>
                <button className="btn-ghost" style={{ fontSize: '.8rem', padding: '.45rem .7rem', color: '#dc2626', borderColor: '#fecaca' }}
                  onClick={() => deleteReport(r.id)}>🗑</button>
              </div>
            </div>

            {/* Inline results */}
            {results[r.id] && (
              <div style={{ marginTop: '1rem' }}>
                <div className="builder-section-title">Results ({results[r.id].row_count} rows)</div>
                {results[r.id].rows?.length > 0 && (
                  <div className="results-table-wrap">
                    <table className="results-table">
                      <thead>
                        <tr>{Object.keys(results[r.id].rows[0]).map((k: string) => <th key={k}>{k}</th>)}</tr>
                      </thead>
                      <tbody>
                        {results[r.id].rows.slice(0, 20).map((row: any, i: number) => (
                          <tr key={i}>
                            {Object.values(row).map((v: any, j) => (
                              <td key={j}>{typeof v === 'boolean' ? (v ? '✅' : '❌') : String(v ?? '—')}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {results[r.id].rows.length > 20 && (
                      <div style={{ padding: '.5rem 1rem', color: '#6b7280', fontSize: '.8rem' }}>
                        Showing 20 of {results[r.id].row_count} rows
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
