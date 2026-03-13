import { create } from 'zustand';
import {
  fetchDashboardStats,
  fetchProjectsProgress,
  type DashboardStats,
  type DashboardProjectsData,
} from '@/api/dashboard';

interface DashboardState {
  stats: DashboardStats | null;
  projectsProgress: DashboardProjectsData | null;
  isLoadingStats: boolean;
  isLoadingProjects: boolean;
  error: string | null;

  // Actions
  fetchStats: () => Promise<void>;
  fetchProjectsProgress: () => Promise<void>;
  fetchAll: () => Promise<void>;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  stats: null,
  projectsProgress: null,
  isLoadingStats: false,
  isLoadingProjects: false,
  error: null,

  fetchStats: async () => {
    set({ isLoadingStats: true, error: null });
    try {
      const data = await fetchDashboardStats();
      set({ stats: data, isLoadingStats: false });
    } catch (err: any) {
      set({
        error: err.response?.data?.detail || 'Failed to fetch dashboard stats',
        isLoadingStats: false,
      });
    }
  },

  fetchProjectsProgress: async () => {
    set({ isLoadingProjects: true, error: null });
    try {
      const data = await fetchProjectsProgress();
      set({ projectsProgress: data, isLoadingProjects: false });
    } catch (err: any) {
      set({
        error: err.response?.data?.detail || 'Failed to fetch project progress',
        isLoadingProjects: false,
      });
    }
  },

  fetchAll: async () => {
    // Fire both in parallel
    await Promise.allSettled([
      useDashboardStore.getState().fetchStats(),
      useDashboardStore.getState().fetchProjectsProgress(),
    ]);
  },
}));
