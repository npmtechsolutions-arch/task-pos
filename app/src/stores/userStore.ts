/**
 * Global User Store — fetches all tenant users, used across the app
 * for task assignment, HR forms, member pickers, etc.
 */
import { create } from 'zustand';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('token')}` };
}

export interface TenantUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  status: string;
  tenant_id: string;
  created_at: string;
  full_name?: string;
}

interface UserStore {
  users: TenantUser[];
  loading: boolean;
  error: string | null;
  fetchUsers: (search?: string) => Promise<void>;
  createUser: (data: {
    first_name: string;
    last_name: string;
    email: string;
    password: string;
    role?: string;
    department_id?: string;
    hr_role?: string;
  }) => Promise<TenantUser>;
  getUserById: (id: string) => TenantUser | undefined;
  getFullName: (id: string) => string;
}

export const useUserStore = create<UserStore>((set, get) => ({
  users: [],
  loading: false,
  error: null,

  fetchUsers: async (search?: string) => {
    set({ loading: true, error: null });
    try {
      const params = search ? { search } : {};
      const res = await axios.get(`${API_URL}/hr/users`, {
        headers: authHeaders(),
        params,
      });
      const users = (res.data as TenantUser[]).map((u) => ({
        ...u,
        full_name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email,
      }));
      set({ users, loading: false });
    } catch (err: any) {
      set({ error: err.response?.data?.detail || 'Failed to load users', loading: false });
    }
  },

  createUser: async (data) => {
    const res = await axios.post(`${API_URL}/hr/users`, data, {
      headers: authHeaders(),
    });
    const user = { ...res.data, full_name: `${res.data.first_name || ''} ${res.data.last_name || ''}`.trim() };
    set((state) => ({ users: [...state.users, user] }));
    return user;
  },

  getUserById: (id: string) => get().users.find((u) => u.id === id),

  getFullName: (id: string) => {
    const u = get().users.find((u) => u.id === id);
    return u ? u.full_name || u.email : id;
  },
}));
