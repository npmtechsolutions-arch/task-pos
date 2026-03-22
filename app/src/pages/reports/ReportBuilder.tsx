import { useState } from 'react';
import { reportsApi } from '@/api/analytics';
import './reports.css';

type Entity = 'tasks' | 'projects' | 'timesheets' | 'time_entries' | 'users';
type AggFunc = 'count' | 'sum' | 'avg' | 'min' | 'max';
type Operator = '=' | '!=' | 'gte' | 'lte' | 'in' | 'contains';

const ENTITY_FIELDS: Record<Entity, string[]> = {
  tasks: ['id', 'title', 'status', 'priority', 'project_id', 'estimated_hours', 'due_date', 'created_at', 'updated_at'],
  projects: ['id', 'name', 'status', 'start_date', 'end_date', 'total_estimated_hours', 'total_actual_hours', 'created_at'],
  time_entries: ['id', 'task_id', 'user_id', 'duration_minutes', 'started_at'],
  timesheets: ['id', 'project_id', 'task_id', 'hours', 'is_billable', 'date_logged'],
  users: ['id', 'email', 'first_name', 'last_name', 'is_active', 'created_at'],
};

export function ReportBuilder() {
  const [entity, setEntity] = useState<Entity>('tasks');
  const [groupBy, setGroupBy] = useState<string[]>([]);
  const [aggregations, setAggregations] = useState<{ func: AggFunc; field: string; alias: string }[]>([]);
  const [filters, setFilters] = useState<{ field: string; op: Operator; value: string }[]>([]);
  const [limit, setLimit] = useState(100);
  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reportName, setReportName] = useState('');
  const [saved, setSaved] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [exportFmt, setExportFmt] = useState<'csv' | 'excel' | 'json' | 'pdf'>('csv');
  const [exporting, setExporting] = useState(false);

  const fields = ENTITY_FIELDS[entity];

  const buildDefinition = () => ({
    entity,
    filters: filters.filter(f => f.field && f.value).map(f => ({ field: f.field, op: f.op, value: f.value })),
    group_by: groupBy.filter(Boolean),
    aggregations: aggregations.filter(a => a.field).map(a => ({ func: a.func, field: a.field, alias: a.alias || undefined })),
    limit,
  });

  const runReport = async () => {
    setRunning(true); setError(null); setRows(null);
    try {
      const result = await reportsApi.runAdHoc(buildDefinition());
      setRows(result.rows || []);
    } catch (e: any) {
      setError(e.message || 'Report failed');
    } finally {
      setRunning(false);
    }
  };

  const saveReport = async () => {
    if (!reportName.trim()) return alert('Enter a report name first');
    try {
      await reportsApi.createReport({ name: reportName, definition: buildDefinition() });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const doExport = async () => {
    setExporting(true);
    try {
      const { blob, filename } = await reportsApi.export(buildDefinition(), exportFmt, reportName || 'Report');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setExporting(false); setShowExport(false);
    }
  };

  return (
    <div className="reports-page">
      <div className="reports-header">
        <div>
          <h1>🛠 Report Builder</h1>
          <p style={{ color: '#6b7280', fontSize: '.9rem', marginTop: '.25rem' }}>
            Build safe, parameterized queries with no raw SQL
          </p>
        </div>
        <div style={{ display: 'flex', gap: '.75rem' }}>
          <input
            className="builder-input"
            style={{ width: '200px', marginBottom: 0 }}
            placeholder="Report name…"
            value={reportName}
            onChange={e => setReportName(e.target.value)}
          />
          <button className="btn-ghost" onClick={saveReport}>{saved ? '✅ Saved!' : '💾 Save'}</button>
          <button className="btn-ghost" onClick={() => setShowExport(true)}>📤 Export</button>
          <button className="btn-primary" onClick={runReport} disabled={running}>
            {running ? '⏳ Running…' : '▶ Run Report'}
          </button>
        </div>
      </div>

      <div className="builder-layout">
        {/* Left config panel */}
        <div>
          {/* Entity */}
          <div className="builder-panel" style={{ marginBottom: '1rem' }}>
            <div className="builder-section-title">Data Source</div>
            <select className="builder-select" value={entity} onChange={e => { setEntity(e.target.value as Entity); setGroupBy([]); setAggregations([]); setFilters([]); }}>
              {Object.keys(ENTITY_FIELDS).map(e => (
                <option key={e} value={e}>{e.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
              ))}
            </select>
          </div>

          {/* Filters */}
          <div className="builder-panel" style={{ marginBottom: '1rem' }}>
            <div className="builder-section-title">
              Filters
              <button style={{ float: 'right', background: 'none', border: 'none', color: '#4f46e5', cursor: 'pointer', fontSize: '.75rem' }}
                onClick={() => setFilters([...filters, { field: fields[0], op: '=', value: '' }])}>
                + Add
              </button>
            </div>
            {filters.map((f, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto', gap: '.5rem', marginBottom: '.5rem' }}>
                <select className="builder-select" style={{ marginBottom: 0 }} value={f.field}
                  onChange={e => setFilters(filters.map((x, j) => j === i ? { ...x, field: e.target.value } : x))}>
                  {fields.map(fld => <option key={fld}>{fld}</option>)}
                </select>
                <select className="builder-select" style={{ marginBottom: 0 }} value={f.op}
                  onChange={e => setFilters(filters.map((x, j) => j === i ? { ...x, op: e.target.value as Operator } : x))}>
                  {(['=','!=','gte','lte','contains','in'] as Operator[]).map(op => <option key={op}>{op}</option>)}
                </select>
                <input className="builder-input" style={{ marginBottom: 0 }} value={f.value} placeholder="value"
                  onChange={e => setFilters(filters.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} />
                <button style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }}
                  onClick={() => setFilters(filters.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
            {filters.length === 0 && <p style={{ fontSize: '.8rem', color: '#9ca3af' }}>No filters — all rows included</p>}
          </div>

          {/* Group By */}
          <div className="builder-panel" style={{ marginBottom: '1rem' }}>
            <div className="builder-section-title">Group By</div>
            {fields.map(fld => (
              <label key={fld} style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '.35rem', fontSize: '.875rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={groupBy.includes(fld)}
                  onChange={e => setGroupBy(e.target.checked ? [...groupBy, fld] : groupBy.filter(x => x !== fld))} />
                {fld}
              </label>
            ))}
          </div>

          {/* Aggregations */}
          <div className="builder-panel" style={{ marginBottom: '1rem' }}>
            <div className="builder-section-title">
              Aggregations
              <button style={{ float: 'right', background: 'none', border: 'none', color: '#4f46e5', cursor: 'pointer', fontSize: '.75rem' }}
                onClick={() => setAggregations([...aggregations, { func: 'count', field: 'id', alias: '' }])}>
                + Add
              </button>
            </div>
            {aggregations.map((a, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr auto', gap: '.5rem', marginBottom: '.5rem' }}>
                <select className="builder-select" style={{ marginBottom: 0 }} value={a.func}
                  onChange={e => setAggregations(aggregations.map((x, j) => j === i ? { ...x, func: e.target.value as AggFunc } : x))}>
                  {(['count','sum','avg','min','max'] as AggFunc[]).map(f => <option key={f}>{f}</option>)}
                </select>
                <select className="builder-select" style={{ marginBottom: 0 }} value={a.field}
                  onChange={e => setAggregations(aggregations.map((x, j) => j === i ? { ...x, field: e.target.value } : x))}>
                  {fields.map(fld => <option key={fld}>{fld}</option>)}
                </select>
                <input className="builder-input" style={{ marginBottom: 0 }} value={a.alias} placeholder="alias (opt.)"
                  onChange={e => setAggregations(aggregations.map((x, j) => j === i ? { ...x, alias: e.target.value } : x))} />
                <button style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }}
                  onClick={() => setAggregations(aggregations.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
          </div>

          {/* Limit */}
          <div className="builder-panel">
            <div className="builder-section-title">Row Limit</div>
            <input type="number" className="builder-input" value={limit} min={1} max={5000}
              onChange={e => setLimit(parseInt(e.target.value) || 100)} />
          </div>
        </div>

        {/* Right results panel */}
        <div>
          <div className="builder-panel" style={{ minHeight: '400px' }}>
            <div className="builder-section-title">
              Results {rows !== null && <span style={{ color: '#4f46e5' }}>({rows.length} rows)</span>}
            </div>
            {error && <div style={{ background: '#fee2e2', color: '#dc2626', padding: '.75rem', borderRadius: '.5rem', marginBottom: '1rem', fontSize: '.875rem' }}>{error}</div>}
            {running && <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', color: '#6b7280' }}>
              <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: '3px solid #4f46e5', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
              Running query…
            </div>}
            {rows !== null && !running && (
              rows.length === 0
                ? <p style={{ color: '#6b7280' }}>No results found.</p>
                : <div className="results-table-wrap">
                    <table className="results-table">
                      <thead>
                        <tr>{Object.keys(rows[0]).map(k => <th key={k}>{k}</th>)}</tr>
                      </thead>
                      <tbody>
                        {rows.slice(0, 500).map((row, i) => (
                          <tr key={i}>
                            {Object.values(row).map((v: any, j) => (
                              <td key={j}>{typeof v === 'boolean' ? (v ? '✅' : '❌') : String(v ?? '—')}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
            )}
            {rows === null && !running && (
              <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#9ca3af' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
                <p>Configure your query on the left, then click <strong>Run Report</strong></p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Export Modal */}
      {showExport && (
        <div className="export-modal-overlay" onClick={() => setShowExport(false)}>
          <div className="export-modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 .5rem', fontSize: '1.1rem', fontWeight: 700 }}>📤 Export Report</h3>
            <p style={{ color: '#6b7280', fontSize: '.875rem', marginBottom: 0 }}>Choose your download format:</p>
            <div className="format-grid">
              {(['csv','excel','json','pdf'] as const).map(fmt => (
                <button key={fmt} className={`format-btn ${exportFmt === fmt ? 'selected' : ''}`}
                  onClick={() => setExportFmt(fmt)}>
                  {{ csv: '📄 CSV', excel: '📊 Excel', json: '🔧 JSON', pdf: '📑 PDF' }[fmt]}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button className="btn-ghost" onClick={() => setShowExport(false)}>Cancel</button>
              <button className="btn-primary" onClick={doExport} disabled={exporting}>
                {exporting ? '⏳ Generating…' : `Download ${exportFmt.toUpperCase()}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
