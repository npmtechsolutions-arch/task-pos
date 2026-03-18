import { create } from 'zustand';
import type { Project, ProjectFilters, User } from '@/types';
import {
  fetchProjects,
  fetchProjectById,
  createProject as apiCreateProject,
  updateProject as apiUpdateProject,
  archiveProject as apiArchiveProject,
  transitionProjectStatus as apiTransitionStatus,
  type ApiProject,
  type ApiProjectDetail,
  type ProjectCreatePayload,
  type ProjectUpdatePayload,
} from '@/api/projects';

// ─── Helper: map API project → frontend Project ────────────────────────────

function mapApiProject(p: ApiProject): Project {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    key: p.key,
    status: p.status as any,
    visibility: p.visibility as any,
    owner: {
      id: p.owner.id,
      email: p.owner.email,
      firstName: p.owner.first_name ?? '',
      lastName: p.owner.last_name ?? '',
      fullName: p.owner.full_name,
      isActive: true,
      timezone: 'UTC',
      language: 'en',
      role: 'member',
      createdAt: '',
    } as User,
    members: [],
    settings: {
      issueTypes: [],
      priorities: [],
      statuses: [],
    },
    startDate: p.start_date,
    endDate: p.end_date,
    actualStartDate: p.actual_start_date,
    actualEndDate: p.actual_end_date,
    budget: p.budget,
    budgetSpent: p.budget_spent,
    department: p.department,
    businessUnit: p.business_unit,
    clientName: p.client_name,
    objectives: Array.isArray(p.objectives) ? p.objectives : [],
    keyResults: Array.isArray(p.key_results) ? p.key_results : [],
    successCriteria: Array.isArray(p.success_criteria) ? p.success_criteria : [],
    progress: p.progress_percentage ?? 0,
    taskCount: p.total_tasks ?? 0,
    completedTaskCount: p.completed_tasks ?? 0,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  } as Project;
}

function mapApiProjectDetail(p: ApiProjectDetail): Project {
  const base = mapApiProject(p);
  base.members = (p.members ?? []).map((m) => ({
    id: m.user_id,
    role: m.role as any,
    joinedAt: m.joined_at,
    user: {
      id: m.user.id,
      email: m.user.email,
      firstName: m.user.first_name ?? '',
      lastName: m.user.last_name ?? '',
      fullName: m.user.full_name,
      isActive: true,
      timezone: 'UTC',
      language: 'en',
      role: 'member',
      createdAt: '',
    } as User,
  }));
  return base;
}

// ─── Store ─────────────────────────────────────────────────────────────────

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  filters: ProjectFilters;
  isLoading: boolean;
  isLoadingDetail: boolean;
  error: string | null;

  // Actions
  fetchProjects: () => Promise<void>;
  fetchProjectById: (id: string) => Promise<void>;
  createProject: (data: ProjectCreatePayload) => Promise<Project | null>;
  updateProjectApi: (id: string, data: ProjectUpdatePayload) => Promise<Project | null>;
  archiveProjectApi: (id: string) => Promise<boolean>;
  transitionStatus: (id: string, status: string) => Promise<Project | null>;

  // In-memory helpers (used by older code paths)
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

// Lazy import to avoid circular dependency
function getDashboardStore() {
  // Dynamic so it doesn't cause circular-import at module level
  return import('@/stores/dashboardStore').then((m) => m.useDashboardStore.getState());
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProject: null,
  filters: {},
  isLoading: false,
  isLoadingDetail: false,
  error: null,

  // ── Fetch all projects ──────────────────────────────────────────────────
  fetchProjects: async () => {
    set({ isLoading: true, error: null });
    try {
      const { filters } = get();
      const response = await fetchProjects({
        status: (filters as any).status,
        search: filters.search,
      });
      const mapped = response.items.map(mapApiProject);
      set({ projects: mapped, isLoading: false });
    } catch (err: any) {
      set({
        error: err.response?.data?.detail || 'Failed to fetch projects',
        isLoading: false,
      });
    }
  },

  // ── Fetch single project by ID ──────────────────────────────────────────
  fetchProjectById: async (id: string) => {
    set({ isLoadingDetail: true, error: null });
    try {
      const data = await fetchProjectById(id);
      const mapped = mapApiProjectDetail(data);
      // Merge into the projects list if not already there
      set((state) => {
        const exists = state.projects.some((p) => p.id === id);
        return {
          currentProject: mapped,
          isLoadingDetail: false,
          projects: exists
            ? state.projects.map((p) => (p.id === id ? mapped : p))
            : [mapped, ...state.projects],
        };
      });
    } catch (err: any) {
      set({
        error: err.response?.data?.detail || 'Failed to fetch project',
        isLoadingDetail: false,
      });
    }
  },

  // ── Create project (calls real API) ────────────────────────────────────
  createProject: async (data: ProjectCreatePayload) => {
    try {
      const apiProject = await apiCreateProject(data);
      const mapped = mapApiProject(apiProject);
      set((state) => ({ projects: [mapped, ...state.projects] }));
      // Refresh dashboard stats
      getDashboardStore().then((store) => store.fetchAll());
      return mapped;
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Failed to create project';
      set({ error: msg });
      throw new Error(msg);
    }
  },

  // ── Update project (calls real API) ────────────────────────────────────
  updateProjectApi: async (id: string, data: ProjectUpdatePayload) => {
    try {
      const apiProject = await apiUpdateProject(id, data);
      const mapped = mapApiProject(apiProject);
      set((state) => ({
        projects: state.projects.map((p) => (p.id === id ? mapped : p)),
        currentProject: state.currentProject?.id === id ? mapped : state.currentProject,
      }));
      getDashboardStore().then((store) => store.fetchAll());
      return mapped;
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Failed to update project';
      set({ error: msg });
      throw new Error(msg);
    }
  },

  // ── Archive project (calls real API) ───────────────────────────────────
  archiveProjectApi: async (id: string) => {
    try {
      await apiArchiveProject(id);
      set((state) => ({
        projects: state.projects.filter((p) => p.id !== id),
        currentProject: state.currentProject?.id === id ? null : state.currentProject,
      }));
      getDashboardStore().then((store) => store.fetchAll());
      return true;
    } catch (err: any) {
      set({ error: err.response?.data?.detail || 'Failed to archive project' });
      return false;
    }
  },

  // ── Transition project status ───────────────────────────────────────────
  transitionStatus: async (id: string, status: string) => {
    try {
      const apiProject = await apiTransitionStatus(id, status);
      const mapped = mapApiProject(apiProject);
      set((state) => ({
        projects: state.projects.map((p) => (p.id === id ? mapped : p)),
        currentProject: state.currentProject?.id === id ? mapped : state.currentProject,
      }));
      getDashboardStore().then((store) => store.fetchAll());
      return mapped;
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Failed to transition status';
      set({ error: msg });
      throw new Error(msg);
    }
  },

  // ── In-memory helpers ──────────────────────────────────────────────────
  setProjects: (projects) => set({ projects }),

  addProject: (project) =>
    set((state) => ({ projects: [project, ...state.projects] })),

  updateProject: (project) =>
    set((state) => ({
      projects: state.projects.map((p) => (p.id === project.id ? project : p)),
      currentProject:
        state.currentProject?.id === project.id ? project : state.currentProject,
    })),

  deleteProject: (projectId) =>
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== projectId),
      currentProject:
        state.currentProject?.id === projectId ? null : state.currentProject,
    })),

  setCurrentProject: (project) => set({ currentProject: project }),
  setFilters: (filters) => set({ filters }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  // ── Computed ───────────────────────────────────────────────────────────
  getFilteredProjects: () => {
    const { projects, filters } = get();
    return projects.filter((project) => {
      if (filters.status && project.status !== filters.status) return false;
      if (filters.visibility && project.visibility !== filters.visibility) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (
          !project.name.toLowerCase().includes(q) &&
          !project.description?.toLowerCase().includes(q) &&
          !project.key.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  },

  getProjectById: (id) => get().projects.find((p) => p.id === id),
}));
