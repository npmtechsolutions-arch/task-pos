import { create } from 'zustand';
import axios from 'axios';
import type { Project, ProjectFilters, User } from '@/types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  filters: ProjectFilters;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchProjects: () => Promise<void>;
  setProjects: (projects: Project[]) => void;
  addProject: (project: Project) => void;
  updateProject: (project: Project) => void;
  deleteProject: (projectId: string) => void;
  setCurrentProject: (project: Project | null) => void;
  setFilters: (filters: ProjectFilters) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Computed
  getFilteredProjects: () => Project[];
  getProjectById: (id: string) => Project | undefined;
}

// Stores
export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProject: null,
  filters: {},
  isLoading: false,
  error: null,

  fetchProjects: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await axios.get(`${API_URL}/projects`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      // Map backend response properties (e.g., total_tasks) to frontend React expectations (e.g., taskCount)
      const formattedProjects = response.data.items.map((p: any) => ({
        ...p,
        taskCount: p.total_tasks,
        completedTaskCount: p.completed_tasks,
        progress: p.progress_percentage,
        startDate: p.start_date,
        endDate: p.end_date,
        owner: {
          id: p.owner.id,
          email: p.owner.email,
          firstName: p.owner.first_name || '',
          lastName: p.owner.last_name || '',
          fullName: p.owner.full_name,
        } as User,
      })) as Project[];

      set({ projects: formattedProjects, isLoading: false });
    } catch (err: any) {
      set({
        error: err.response?.data?.detail || 'Failed to fetch projects',
        isLoading: false
      });
    }
  },

  setProjects: (projects) => set({ projects }),

  addProject: (project) => {
    set((state) => ({
      projects: [project, ...state.projects],
    }));
  },

  updateProject: (project) => {
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === project.id ? project : p
      ),
      currentProject: state.currentProject?.id === project.id
        ? project
        : state.currentProject,
    }));
  },

  deleteProject: (projectId) => {
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== projectId),
      currentProject: state.currentProject?.id === projectId
        ? null
        : state.currentProject,
    }));
  },

  setCurrentProject: (project) => set({ currentProject: project }),

  setFilters: (filters) => set({ filters }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  getFilteredProjects: () => {
    const { projects, filters } = get();
    return projects.filter((project) => {
      if (filters.status && project.status !== filters.status) return false;
      if (filters.visibility && project.visibility !== filters.visibility) return false;
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesName = project.name.toLowerCase().includes(searchLower);
        const matchesDescription = project.description?.toLowerCase().includes(searchLower);
        const matchesKey = project.key.toLowerCase().includes(searchLower);
        if (!matchesName && !matchesDescription && !matchesKey) return false;
      }
      return true;
    });
  },

  getProjectById: (id) => {
    return get().projects.find((p) => p.id === id);
  },
}));
