import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, AuthState } from '@/types';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

interface AuthStore extends AuthState {
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  initAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      /**
       * Called once on app startup. Re-applies the stored JWT token to axios
       * so that API calls work after a page refresh without re-logging in.
       */
      initAuth: async () => {
        const token = localStorage.getItem('token');
        if (!token) {
          set({ isAuthenticated: false, user: null, token: null });
          return;
        }

        // Re-apply to axios defaults
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

        // Validate the token is still good by fetching the current user
        try {
          const response = await axios.get(`${API_URL}/auth/me`);
          const apiUser = response.data;
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
          set({ user: userObj as any, isAuthenticated: true });
        } catch {
          // Token is invalid or expired → clear session
          localStorage.removeItem('token');
          delete axios.defaults.headers.common['Authorization'];
          set({ user: null, token: null, isAuthenticated: false });
        }
      },

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

          // Store token and apply to all future axios requests
          localStorage.setItem('token', access_token);
          axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;

          set({
            user: userObj as any,
            token: access_token,
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
          token: null,
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
      name: 'auth-session-v3',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
