// Dashboard API client

import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('token')}` };
}

export interface DashboardStats {
  total_projects: number;
  active_projects: number;
  my_tasks: number;
  my_tasks_completed: number;
  my_tasks_in_progress: number;
  overdue_tasks: number;
  due_this_week: number;
  hours_logged: number;
  hours_this_month: number;
  team_members: number;
}

export interface ProjectProgress {
  project_id: string;
  name: string;
  key: string;
  status: string;
  total_tasks: number;
  completed_tasks: number;
  in_progress_tasks: number;
  overdue_tasks: number;
  progress_percentage: number;
}

export interface DashboardProjectsData {
  projects: ProjectProgress[];
  total: number;
  active: number;
  completed: number;
  avg_progress: number;
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const response = await axios.get(`${API_URL}/dashboard`, {
    headers: authHeaders(),
  });
  return response.data;
}

export async function fetchProjectsProgress(): Promise<DashboardProjectsData> {
  const response = await axios.get(`${API_URL}/dashboard/projects`, {
    headers: authHeaders(),
  });
  return response.data;
}
