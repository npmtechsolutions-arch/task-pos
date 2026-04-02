// Tasks API client
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('token')}` };
}

// ─── Payload Types ──────────────────────────────────────────────────────────

export interface TaskCreatePayload {
  title: string;
  description?: string;
  project_id: string;
  parent_id?: string | null;
  primary_assignee_id?: string | null;
  assignee_ids?: string[];
  priority?: 'lowest' | 'low' | 'medium' | 'high' | 'highest';
  task_type?: 'task' | 'bug' | 'story' | 'epic' | 'subtask';
  due_date?: string | null;
  start_date?: string | null;
  estimated_hours?: number | null;
  tag_ids?: string[];
  custom_fields?: Record<string, unknown>;
}

export interface TaskUpdatePayload {
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  primary_assignee_id?: string | null;
  assignee_ids?: string[];
  due_date?: string | null;
  start_date?: string | null;
  estimated_hours?: number | null;
  tag_ids?: string[];
  custom_fields?: Record<string, unknown>;
}

export interface CommentCreatePayload {
  content: string;
  parent_id?: string | null;
}

export interface TimeEntryCreatePayload {
  started_at: string;
  ended_at?: string | null;
  duration_minutes: number;
  description?: string;
  is_billable?: boolean;
}

export interface DependencyCreatePayload {
  depends_on_id: string;
  dependency_type?: 'blocks' | 'blocked_by' | 'relates_to' | 'duplicates';
}

export interface BatchUpdatePayload {
  task_ids: string[];
  status?: string;
  priority?: string;
  assignee_id?: string | null;
  due_date?: string | null;
}

export interface TaskListFilters {
  project_id?: string;
  status?: string;
  priority?: string;
  primary_assignee_id?: string;
  search?: string;
  page?: number;
  per_page?: number;
}

// ─── Response Types ──────────────────────────────────────────────────────────

export interface ApiUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  avatar_url?: string;
}

export interface ApiTag {
  id: string;
  name: string;
  color: string;
}

export interface ApiComment {
  id: string;
  task_id: string;
  author_id: string;
  author: ApiUser;
  content: string;
  mentions: string[];
  is_edited: boolean;
  edited_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ApiTimeEntry {
  id: string;
  task_id: string;
  user_id: string;
  user: ApiUser;
  started_at: string;
  ended_at?: string;
  duration_minutes: number;
  description?: string;
  is_billable: boolean;
  source: string;
  created_at: string;
}

export interface ApiDependency {
  id: string;
  task_id: string;
  depends_on_id: string;
  dependency_type: string;
  created_at: string;
}

export interface ApiTask {
  id: string;
  title: string;
  description?: string;
  task_type: string;
  status: string;
  priority: string;
  project_id: string;
  parent_id?: string;
  primary_assignee_id?: string;
  primary_assignee?: ApiUser;
  reporter_id: string;
  reporter: ApiUser;
  due_date?: string;
  start_date?: string;
  started_at?: string;
  completed_at?: string;
  estimated_hours?: number;
  actual_hours: number;
  position: number;
  board_column_id?: string;
  priority_score: number;
  workflow_id?: string;
  workflow_state_id?: string;
  custom_fields: Record<string, unknown>;
  tags: ApiTag[];
  is_overdue: boolean;
  progress_percentage: number;
  created_at: string;
  updated_at: string;
}

export interface ApiTaskDetail extends ApiTask {
  subtasks: ApiTask[];
  comments: ApiComment[];
  dependencies: ApiDependency[];
  time_entries?: ApiTimeEntry[];
}

export interface ApiTaskList {
  items: ApiTask[];
  total: number;
  page: number;
  per_page: number;
}

// ─── API Functions ────────────────────────────────────────────────────────────

export async function listTasks(filters?: TaskListFilters): Promise<ApiTaskList> {
  const res = await axios.get(`${API_URL}/tasks`, {
    headers: authHeaders(),
    params: filters,
  });
  return res.data;
}

export async function getMyTasks(status?: string): Promise<ApiTask[]> {
  const res = await axios.get(`${API_URL}/tasks/my-tasks`, {
    headers: authHeaders(),
    params: status ? { status } : undefined,
  });
  return res.data;
}

export async function getTask(taskId: string): Promise<ApiTaskDetail> {
  const res = await axios.get(`${API_URL}/tasks/${taskId}`, {
    headers: authHeaders(),
  });
  return res.data;
}

export async function createTask(data: TaskCreatePayload): Promise<ApiTask> {
  const res = await axios.post(`${API_URL}/tasks`, data, {
    headers: authHeaders(),
  });
  return res.data;
}

export async function updateTask(taskId: string, data: TaskUpdatePayload): Promise<ApiTask> {
  const res = await axios.put(`${API_URL}/tasks/${taskId}`, data, {
    headers: authHeaders(),
  });
  return res.data;
}

export async function deleteTask(taskId: string): Promise<void> {
  await axios.delete(`${API_URL}/tasks/${taskId}`, {
    headers: authHeaders(),
  });
}

export async function batchUpdateTasks(data: BatchUpdatePayload): Promise<{ message: string }> {
  const res = await axios.post(`${API_URL}/tasks/batch-update`, data, {
    headers: authHeaders(),
  });
  return res.data;
}

// ─── Comments ────────────────────────────────────────────────────────────────

export async function addComment(taskId: string, data: CommentCreatePayload): Promise<ApiComment> {
  const res = await axios.post(`${API_URL}/tasks/${taskId}/comments`, data, {
    headers: authHeaders(),
  });
  return res.data;
}

export async function deleteComment(taskId: string, commentId: string): Promise<void> {
  await axios.delete(`${API_URL}/tasks/${taskId}/comments/${commentId}`, {
    headers: authHeaders(),
  });
}

// ─── Time Entries ─────────────────────────────────────────────────────────────

export async function getTimeEntries(taskId: string): Promise<ApiTimeEntry[]> {
  const res = await axios.get(`${API_URL}/tasks/${taskId}/time-entries`, {
    headers: authHeaders(),
  });
  return res.data;
}

export async function addTimeEntry(taskId: string, data: TimeEntryCreatePayload): Promise<ApiTimeEntry> {
  const res = await axios.post(`${API_URL}/tasks/${taskId}/time-entries`, data, {
    headers: authHeaders(),
  });
  return res.data;
}

export async function logTime(taskId: string, hours: number, description?: string): Promise<ApiTimeEntry> {
  const res = await axios.post(
    `${API_URL}/tasks/${taskId}/log-time`,
    null,
    {
      headers: authHeaders(),
      params: { hours, description },
    }
  );
  return res.data;
}

// ─── Dependencies ─────────────────────────────────────────────────────────────

export async function addDependency(taskId: string, data: DependencyCreatePayload): Promise<ApiDependency> {
  const res = await axios.post(`${API_URL}/tasks/${taskId}/dependencies`, data, {
    headers: authHeaders(),
  });
  return res.data;
}

export async function removeDependency(taskId: string, dependencyId: string): Promise<void> {
  await axios.delete(`${API_URL}/tasks/${taskId}/dependencies/${dependencyId}`, {
    headers: authHeaders(),
  });
}
