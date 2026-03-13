// Team API client

import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('token')}` };
}

export interface TeamMemberUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  avatar_url?: string;
  role: string;
}

export interface TeamMember {
  user_id: string;
  role: string;
  joined_at: string;
  user: TeamMemberUser;
  task_count: number;
  completed_task_count: number;
  hours_logged: number;
}

export interface TeamListData {
  project_id: string;
  project_name: string;
  members: TeamMember[];
  total: number;
}

export interface AllUsersData {
  users: TeamMemberUser[];
  total: number;
}

export async function fetchAllUsers(): Promise<AllUsersData> {
  const response = await axios.get(`${API_URL}/team`, {
    headers: authHeaders(),
  });
  return response.data;
}

export async function fetchProjectTeam(projectId: string): Promise<TeamListData> {
  const response = await axios.get(`${API_URL}/team/project/${projectId}`, {
    headers: authHeaders(),
  });
  return response.data;
}

export async function addTeamMember(
  projectId: string,
  userId: string,
  role: string
): Promise<TeamMember> {
  const response = await axios.post(
    `${API_URL}/team/project/${projectId}`,
    { user_id: userId, role },
    { headers: authHeaders() }
  );
  return response.data;
}

export async function updateTeamMemberRole(
  projectId: string,
  userId: string,
  role: string
): Promise<TeamMember> {
  const response = await axios.put(
    `${API_URL}/team/project/${projectId}/${userId}`,
    { role },
    { headers: authHeaders() }
  );
  return response.data;
}

export async function removeTeamMember(projectId: string, userId: string): Promise<void> {
  await axios.delete(`${API_URL}/team/project/${projectId}/${userId}`, {
    headers: authHeaders(),
  });
}
