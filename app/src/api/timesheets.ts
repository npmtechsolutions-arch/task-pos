/**
 * Timesheet API Client — typed wrappers for all backend endpoints
 */

import axios from 'axios';

const BASE = `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/timesheets`;

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export type TimesheetStatus = 'draft' | 'submitted' | 'approved' | 'rejected';
export type ActivityType =
  | 'development' | 'meeting' | 'research' | 'review'
  | 'testing' | 'design' | 'documentation' | 'other';

export interface TimesheetEntry {
  id: string;
  timesheet_id: string;
  tenant_id: string;
  date_logged: string;     // ISO date string
  hours: number;
  description?: string;
  activity_type: ActivityType;
  is_billable: boolean;
  task_id?: string;
  project_id?: string;
  started_at?: string;
  ended_at?: string;
  task?: { id: string; title: string };
  project?: { id: string; name: string };
  created_at: string;
  updated_at: string;
}

export interface TimesheetUser {
  id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
}

export interface Timesheet {
  id: string;
  tenant_id: string;
  user_id: string;
  period_start: string;
  period_end: string;
  status: TimesheetStatus;
  total_hours: number;
  billable_hours: number;
  submitted_at?: string;
  approved_at?: string;
  rejection_reason?: string;
  user?: TimesheetUser;
  approver?: TimesheetUser;
  entries?: TimesheetEntry[];
  created_at: string;
  updated_at: string;
}

export interface TimesheetListResponse {
  items: Timesheet[];
  total: number;
  page: number;
  per_page: number;
}

export interface CreateEntryPayload {
  date_logged: string;
  hours: number;
  description?: string;
  activity_type: ActivityType;
  is_billable: boolean;
  task_id?: string;
  project_id?: string;
  started_at?: string;
  ended_at?: string;
}

export interface ReportResponse {
  period_start: string;
  period_end: string;
  total_hours: number;
  billable_hours: number;
  non_billable_hours: number;
  submitted_count: number;
  approved_count: number;
  pending_count: number;
  by_user: Array<{
    user_id: string; full_name: string;
    total_hours: number; billable_hours: number;
    non_billable_hours: number; timesheet_count: number;
  }>;
  by_project: Array<{
    project_id: string; project_name: string;
    total_hours: number; billable_hours: number; user_count: number;
  }>;
}

// ─── API Functions ─────────────────────────────────────────────────────────────

/** Get the current ISO week's timesheet (auto-creates if missing) */
export async function getCurrentWeekTimesheet(token: string): Promise<Timesheet> {
  const r = await axios.get(`${BASE}/current-week`, { headers: authHeaders(token) });
  return r.data;
}

/** Get paginated list of user's own timesheets */
export async function getMyTimesheets(
  token: string,
  params?: { status?: string; page?: number; per_page?: number }
): Promise<TimesheetListResponse> {
  const r = await axios.get(`${BASE}/my`, { headers: authHeaders(token), params });
  return r.data;
}

/** Get single timesheet with full entry list */
export async function getTimesheet(token: string, id: string): Promise<Timesheet> {
  const r = await axios.get(`${BASE}/${id}`, { headers: authHeaders(token) });
  return r.data;
}

/** Admin: get all timesheets */
export async function getAllTimesheets(
  token: string,
  params?: { status?: string; user_id?: string; page?: number; per_page?: number }
): Promise<TimesheetListResponse> {
  const r = await axios.get(BASE, { headers: authHeaders(token), params });
  return r.data;
}

/** Add a time entry to a timesheet */
export async function addEntry(
  token: string, timesheetId: string, data: CreateEntryPayload
): Promise<TimesheetEntry> {
  const r = await axios.post(`${BASE}/${timesheetId}/entries`, data, { headers: authHeaders(token) });
  return r.data;
}

/** Update an entry */
export async function updateEntry(
  token: string, entryId: string, data: Partial<CreateEntryPayload>
): Promise<TimesheetEntry> {
  const r = await axios.patch(`${BASE}/entries/${entryId}`, data, { headers: authHeaders(token) });
  return r.data;
}

/** Delete an entry */
export async function deleteEntry(token: string, entryId: string): Promise<void> {
  await axios.delete(`${BASE}/entries/${entryId}`, { headers: authHeaders(token) });
}

/** Submit timesheet for approval */
export async function submitTimesheet(token: string, id: string): Promise<Timesheet> {
  const r = await axios.post(`${BASE}/${id}/submit`, {}, { headers: authHeaders(token) });
  return r.data;
}

/** Admin: approve timesheet */
export async function approveTimesheet(token: string, id: string): Promise<Timesheet> {
  const r = await axios.post(`${BASE}/${id}/approve`, {}, { headers: authHeaders(token) });
  return r.data;
}

/** Admin: reject timesheet */
export async function rejectTimesheet(
  token: string, id: string, reason: string
): Promise<Timesheet> {
  const r = await axios.post(`${BASE}/${id}/reject`, { reason }, { headers: authHeaders(token) });
  return r.data;
}

/** Admin: get summary report for a date range */
export async function getTimesheetReport(
  token: string, period_start: string, period_end: string
): Promise<ReportResponse> {
  const r = await axios.get(`${BASE}/reports/summary`, {
    headers: authHeaders(token),
    params: { period_start, period_end },
  });
  return r.data;
}
