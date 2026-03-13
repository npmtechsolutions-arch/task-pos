import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, AuthState } from '@/types';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

interface AuthStore extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

// Remove mock user

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });

        try {
          const response = await axios.post(`${API_URL}/auth/login`, {
            email,
            password
          });

          const { access_token } = response.data;
          const apiUser = response.data.user;
          const userObj = {
            id: apiUser.id,
            email: apiUser.email,
            firstName: apiUser.first_name || apiUser.firstName || '',
            lastName: apiUser.last_name || apiUser.lastName || '',
            role: apiUser.role,
            isActive: apiUser.is_active,
            timezone: apiUser.timezone,
            language: apiUser.language,
            createdAt: apiUser.created_at,
          };

          // Store token in localStorage
          localStorage.setItem('token', access_token);
          axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;

          set({
            user: userObj as any,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (err: any) {
          const errorMessage = err.response?.data?.detail || 'Invalid email or password';
          set({
            error: errorMessage,
            isLoading: false,
          });
          throw new Error(errorMessage);
        }
      },

      logout: () => {
        localStorage.removeItem('token');
        delete axios.defaults.headers.common['Authorization'];
        set({
          user: null,
          isAuthenticated: false,
          error: null,
        });
      },

      updateUser: (userData: Partial<User>) => {
        const currentUser = get().user;
        if (currentUser) {
          set({
            user: { ...currentUser, ...userData },
          });
        }
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      setError: (error: string | null) => {
        set({ error });
      },
    }),
    {
      name: 'auth-session-v2', // Definitive cache wipe
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated
      }),
    }
  )
);
