import { create } from 'zustand';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

export interface Employee {
  id: string;
  email: string;
  full_name: string;
  first_name?: string;
  avatar_url?: string;
  role: string;
  is_active: boolean;
  title?: string;
  department?: string;
  hire_date?: string;
  skills: Array<{
    skill: { name: string; category?: { name: string; color: string } };
    proficiency_level: number;
    validation_status: string;
  }>;
}

interface EmployeeState {
  employees: Employee[];
  teams: any[];
  isLoading: boolean;
  error: string | null;
  fetchEmployees: (search?: string, department?: string) => Promise<void>;
  fetchTeams: () => Promise<void>;
}

export const useEmployeeStore = create<EmployeeState>((set) => ({
  employees: [],
  teams: [],
  isLoading: false,
  error: null,
  fetchEmployees: async (search?: string, department?: string) => {
    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams({ per_page: '50' });
      if (search) params.append('search', search);
      if (department) params.append('department', department);
      const res = await axios.get(`${API_URL}/employees?${params}`, { headers: headers() });
      set({ employees: res.data.items || res.data || [], isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },
  fetchTeams: async () => {
    try {
      const res = await axios.get(`${API_URL}/org-teams`, { headers: headers() });
      set({ teams: res.data || [] });
    } catch (err) {
      console.error(err);
    }
  }
}));
