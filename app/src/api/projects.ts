// Projects API client

import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('token')}` };
}

// ─── Request Payloads ──────────────────────────────────────────────────────

export interface ProjectCreatePayload {
  name: string;
  key: string;
  description?: string;
  visibility: 'private' | 'internal' | 'public';
  start_date?: string | null;
  end_date?: string | null;
  budget?: number | null;
  department?: string | null;
  business_unit?: string | null;
  github_url?: string | null;
  settings?: Record<string, unknown>;
}

export interface ProjectPrdFileApi {
  id: string;
  file_name: string;
  version: number;
  file_type?: string | null;
  file_size_bytes?: number | null;
  uploaded_by: string;
  created_at: string;
}

export interface ProjectUpdatePayload {
  name?: string;
  description?: string;
  status?: string;
  visibility?: string;
  start_date?: string | null;
  end_date?: string | null;
  budget?: number | null;
  department?: string | null;
  business_unit?: string | null;
  settings?: Record<string, unknown>;
  custom_fields?: Record<string, unknown>;
}

export interface AddMemberPayload {
  user_id: string;
  role?: 'owner' | 'admin' | 'manager' | 'member' | 'viewer';
}

// ─── Response types (mirrors backend schemas) ──────────────────────────────

export interface ApiUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  avatar_url?: string;
}

export interface ApiProjectMember {
  user_id: string;
  role: string;
  joined_at: string;
  user: ApiUser;
}

export interface ApiProject {
  id: string;
  name: string;
  description?: string;
  key: string;
  status: string;
  visibility: string;
  start_date?: string;
  end_date?: string;
  actual_start_date?: string;
  actual_end_date?: string;
  owner_id: string;
  owner: ApiUser;
  budget?: number;
  budget_spent: number;
  department?: string;
  business_unit?: string;
  client_name?: string;
  objectives: string[];
  key_results: string[];
  success_criteria: string[];
  total_tasks: number;
  completed_tasks: number;
  in_progress_tasks: number;
  progress_percentage: number;
  total_estimated_hours: number;
  total_actual_hours: number;
  settings: Record<string, unknown>;
  custom_fields: Record<string, unknown>;
  github_url?: string | null;
  prd_file?: ProjectPrdFileApi | null;
  created_at: string;
  updated_at: string;
  archived_at?: string;
}

export interface ApiProjectDetail extends ApiProject {
  members: ApiProjectMember[];
}

export interface ApiProjectList {
  items: ApiProject[];
  total: number;
  page: number;
  per_page: number;
}

// ─── API Functions ─────────────────────────────────────────────────────────

export async function fetchProjects(params?: {
  status?: string;
  search?: string;
  page?: number;
  per_page?: number;
}): Promise<ApiProjectList> {
  const response = await axios.get(`${API_URL}/projects`, {
    headers: authHeaders(),
    params,
  });
  return response.data;
}

export async function fetchProjectById(projectId: string): Promise<ApiProjectDetail> {
  const response = await axios.get(`${API_URL}/projects/${projectId}`, {
    headers: authHeaders(),
  });
  return response.data;
}

export async function createProject(data: ProjectCreatePayload | FormData): Promise<ApiProject> {
  const headers = authHeaders();
  if (data instanceof FormData) {
    const response = await axios.post(`${API_URL}/projects`, data, {
      headers: { Authorization: headers.Authorization ?? '' },
    });
    return response.data;
  }
  const response = await axios.post(`${API_URL}/projects`, data, {
    headers,
  });
  return response.data;
}

export async function downloadProjectPrd(projectId: string, fallbackName: string): Promise<void> {
  const response = await axios.get(`${API_URL}/projects/${projectId}/prd/download`, {
    headers: authHeaders(),
    responseType: 'blob',
  });
  const cd = response.headers['content-disposition'] as string | undefined;
  let name = fallbackName;
  if (cd) {
    const m = /filename\*?=(?:UTF-8'')?["']?([^\"';]+)/i.exec(cd);
    if (m) name = decodeURIComponent(m[1]);
  }
  const url = window.URL.createObjectURL(response.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  window.URL.revokeObjectURL(url);
}

export interface BulkMembersPayload {
  user_ids: string[];
  role?: 'owner' | 'admin' | 'manager' | 'member' | 'viewer';
}

export async function addProjectMembersBulk(
  projectId: string,
  body: BulkMembersPayload
): Promise<ApiProjectMember[]> {
  const response = await axios.post(`${API_URL}/projects/${projectId}/members/bulk`, body, {
    headers: authHeaders(),
  });
  return response.data;
}

export async function updateProject(
  projectId: string,
  data: ProjectUpdatePayload
): Promise<ApiProject> {
  const response = await axios.put(`${API_URL}/projects/${projectId}`, data, {
    headers: authHeaders(),
  });
  return response.data;
}

export async function transitionProjectStatus(
  projectId: string,
  status: string
): Promise<ApiProject> {
  const response = await axios.post(
    `${API_URL}/projects/${projectId}/transition`,
    null,
    {
      headers: authHeaders(),
      params: { status },
    }
  );
  return response.data;
}

export async function archiveProject(projectId: string): Promise<void> {
  await axios.delete(`${API_URL}/projects/${projectId}`, {
    headers: authHeaders(),
  });
}

export async function addProjectMember(
  projectId: string,
  data: AddMemberPayload
): Promise<ApiProjectMember> {
  const response = await axios.post(
    `${API_URL}/projects/${projectId}/members`,
    data,
    { headers: authHeaders() }
  );
  return response.data;
}

export async function removeProjectMember(
  projectId: string,
  userId: string
): Promise<void> {
  await axios.delete(`${API_URL}/projects/${projectId}/members/${userId}`, {
    headers: authHeaders(),
  });
}
