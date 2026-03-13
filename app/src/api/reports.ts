// Reports API client

import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('token')}` };
}

export interface ProjectProgressReport {
  project_id: string;
  project_name: string;
  project_key: string;
  status: string;
  total_tasks: number;
  completed_tasks: number;
  in_progress_tasks: number;
  todo_tasks: number;
  overdue_tasks: number;
  progress_percentage: number;
  total_estimated_hours: number;
  total_actual_hours: number;
  start_date?: string;
  end_date?: string;
}

export interface UserTimeReport {
  user_id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
  total_minutes: number;
  total_hours: number;
  task_count: number;
}

export interface TimeReportData {
  month: number;
  year: number;
  total_hours: number;
  user_reports: UserTimeReport[];
}

export interface OverviewReportData {
  total_projects: number;
  active_projects: number;
  completed_projects: number;
  total_tasks: number;
  completed_tasks: number;
  overdue_tasks: number;
  overall_progress: number;
  projects: ProjectProgressReport[];
  top_contributors: UserTimeReport[];
}

export async function fetchProjectProgress(projectId: string): Promise<ProjectProgressReport> {
  const response = await axios.get(`${API_URL}/reports/project-progress/${projectId}`, {
    headers: authHeaders(),
  });
  return response.data;
}

export async function fetchTimeSummary(): Promise<TimeReportData> {
  const response = await axios.get(`${API_URL}/reports/time-summary`, {
    headers: authHeaders(),
  });
  return response.data;
}

export async function fetchOverviewReport(): Promise<OverviewReportData> {
  const response = await axios.get(`${API_URL}/reports/overview`, {
    headers: authHeaders(),
  });
  return response.data;
}
