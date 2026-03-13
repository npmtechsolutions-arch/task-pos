import { create } from 'zustand';
import {
  fetchAllUsers,
  fetchProjectTeam,
  addTeamMember,
  updateTeamMemberRole,
  removeTeamMember,
  type TeamListData,
  type TeamMemberUser,
} from '@/api/team';

interface TeamState {
  // All users (for the "add member" lookup)
  allUsers: TeamMemberUser[];
  // Team members keyed by projectId
  projectTeams: Record<string, TeamListData>;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchAllUsers: () => Promise<void>;
  fetchProjectTeam: (projectId: string) => Promise<void>;
  addMember: (projectId: string, userId: string, role: string) => Promise<void>;
  updateRole: (projectId: string, userId: string, role: string) => Promise<void>;
  removeMember: (projectId: string, userId: string) => Promise<void>;

  // Helpers
  getProjectTeam: (projectId: string) => TeamListData | null;
}

export const useTeamStore = create<TeamState>((set, get) => ({
  allUsers: [],
  projectTeams: {},
  isLoading: false,
  error: null,

  fetchAllUsers: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await fetchAllUsers();
      set({ allUsers: data.users, isLoading: false });
    } catch (err: any) {
      set({
        error: err.response?.data?.detail || 'Failed to fetch users',
        isLoading: false,
      });
    }
  },

  fetchProjectTeam: async (projectId: string) => {
    set({ isLoading: true, error: null });
    try {
      const data = await fetchProjectTeam(projectId);
      set((state) => ({
        projectTeams: { ...state.projectTeams, [projectId]: data },
        isLoading: false,
      }));
    } catch (err: any) {
      set({
        error: err.response?.data?.detail || 'Failed to fetch team',
        isLoading: false,
      });
    }
  },

  addMember: async (projectId: string, userId: string, role: string) => {
    try {
      await addTeamMember(projectId, userId, role);
      // Refresh team data for this project
      await get().fetchProjectTeam(projectId);
    } catch (err: any) {
      set({ error: err.response?.data?.detail || 'Failed to add member' });
      throw err;
    }
  },

  updateRole: async (projectId: string, userId: string, role: string) => {
    try {
      await updateTeamMemberRole(projectId, userId, role);
      await get().fetchProjectTeam(projectId);
    } catch (err: any) {
      set({ error: err.response?.data?.detail || 'Failed to update role' });
      throw err;
    }
  },

  removeMember: async (projectId: string, userId: string) => {
    try {
      await removeTeamMember(projectId, userId);
      set((state) => {
        const team = state.projectTeams[projectId];
        if (!team) return state;
        return {
          projectTeams: {
            ...state.projectTeams,
            [projectId]: {
              ...team,
              members: team.members.filter((m) => m.user_id !== userId),
              total: team.total - 1,
            },
          },
        };
      });
    } catch (err: any) {
      set({ error: err.response?.data?.detail || 'Failed to remove member' });
      throw err;
    }
  },

  getProjectTeam: (projectId: string) => {
    return get().projectTeams[projectId] ?? null;
  },
}));
