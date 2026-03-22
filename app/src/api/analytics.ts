/**
 * Analytics & Reports API client
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

async function authFetch(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('access_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string>),
  };
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res;
}

// ── Analytics / KPIs ─────────────────────────────────────────────────────────
export const analyticsApi = {
  getKpis: async () => (await authFetch('/analytics/kpis')).json(),
  getTaskTrend: async (days = 30) => (await authFetch(`/analytics/task-trend?days=${days}`)).json(),
  getContributors: async (days = 30, limit = 10) =>
    (await authFetch(`/analytics/contributors?days=${days}&limit=${limit}`)).json(),
  getTimeAnalytics: async (days = 30) => (await authFetch(`/analytics/time?days=${days}`)).json(),
  getResourceReport: async () => (await authFetch('/analytics/resource')).json(),
  getForecast: async (weeks = 8) => (await authFetch(`/analytics/forecast?weeks=${weeks}`)).json(),
  getWidgets: async () => (await authFetch('/analytics/widgets')).json(),
};

// ── Reports ───────────────────────────────────────────────────────────────────
export const reportsApi = {
  getOverview: async () => (await authFetch('/reports/overview')).json(),
  getTimeSummary: async () => (await authFetch('/reports/time-summary')).json(),
  listReports: async () => (await authFetch('/reports')).json(),
  createReport: async (data: object) =>
    (await authFetch('/reports', { method: 'POST', body: JSON.stringify(data) })).json(),
  getReport: async (id: string) => (await authFetch(`/reports/${id}`)).json(),
  runReport: async (id: string) =>
    (await authFetch(`/reports/${id}/run`, { method: 'POST' })).json(),
  runAdHoc: async (definition: object) =>
    (await authFetch('/reports/run', { method: 'POST', body: JSON.stringify(definition) })).json(),
  deleteReport: async (id: string) =>
    authFetch(`/reports/${id}`, { method: 'DELETE' }),
  getHistory: async (id: string) => (await authFetch(`/reports/${id}/history`)).json(),
  createSchedule: async (id: string, data: object) =>
    (await authFetch(`/reports/${id}/schedule`, { method: 'POST', body: JSON.stringify(data) })).json(),
  listSchedules: async (id: string) => (await authFetch(`/reports/${id}/schedule`)).json(),
  deleteSchedule: async (scheduleId: string) =>
    authFetch(`/reports/schedule/${scheduleId}`, { method: 'DELETE' }),

  /** Export: returns Blob */
  export: async (definition: object, format: 'csv' | 'excel' | 'json' | 'pdf', title = 'Report') => {
    const token = localStorage.getItem('access_token');
    const res = await fetch(`${API_BASE}/reports/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ definition, format, title }),
    });
    if (!res.ok) throw new Error(`Export failed: ${res.status}`);
    const blob = await res.blob();
    const disposition = res.headers.get('content-disposition') || '';
    const name = disposition.match(/filename="([^"]+)"/)?.[1] || `report.${format}`;
    return { blob, filename: name };
  },
};
