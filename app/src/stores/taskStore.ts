import { create } from 'zustand';
import axios from 'axios';
import type { Task, TaskFilters, TaskStatus, Comment } from '@/types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

interface TaskState {
  tasks: Task[];
  currentTask: Task | null;
  filters: TaskFilters;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchTasks: () => Promise<void>;
  fetchTaskDetail: (taskId: string) => Promise<void>;
  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  deleteTask: (taskId: string) => void;
  setCurrentTask: (task: Task | null) => void;
  setFilters: (filters: TaskFilters) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Task operations
  moveTask: (taskId: string, newStatus: TaskStatus) => void;
  addComment: (taskId: string, comment: Comment) => void;
  assignTask: (taskId: string, assigneeId: string | undefined) => void;

  // Computed
  getFilteredTasks: () => Task[];
  getTasksByProject: (projectId: string) => Task[];
  getTasksByStatus: (status: TaskStatus) => Task[];
  getTaskById: (id: string) => Task | undefined;
  getMyTasks: (userId: string) => Task[];
}

// Stores
export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  currentTask: null,
  filters: {},
  isLoading: false,
  error: null,

  fetchTasks: async () => {
    set({ isLoading: true, error: null });
    try {
      // For the dashboard, we want the current user's tasks
      const response = await axios.get(`${API_URL}/tasks/my-tasks`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      const formattedTasks = response.data.map((t: any) => ({
        ...t,
        projectId: t.project_id,
        assigneeId: t.assignee_id,
        reporterId: t.reporter_id,
        dueDate: t.due_date,
        startDate: t.start_date,
        actualHours: t.actual_hours,
        estimatedHours: t.estimated_hours,
        completedAt: t.completed_at,
        // Ensure complex relationships exist as expected fallback empty arrays
        subtasks: [],
        labels: t.tags || [],
        attachments: [],
        comments: [],
        dependencies: [],
      })) as Task[];

      set({ tasks: formattedTasks, isLoading: false });
    } catch (err: any) {
      set({
        error: err.response?.data?.detail || 'Failed to fetch tasks',
        isLoading: false
      });
    }
  },

  fetchTaskDetail: async (taskId: string) => {
    try {
      const response = await axios.get(`${API_URL}/tasks/${taskId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const t = response.data;
      const formattedTask = {
        ...t,
        projectId: t.project_id,
        assigneeId: t.assignee_id,
        reporterId: t.reporter_id,
        dueDate: t.due_date,
        startDate: t.start_date,
        actualHours: t.actual_hours,
        estimatedHours: t.estimated_hours,
        completedAt: t.completed_at,
        labels: t.tags || [],
        dependencies: t.dependencies?.map((d: any) => ({
          id: d.id,
          taskId: d.task_id,
          dependsOnId: d.depends_on_id,
          dependencyType: d.dependency_type,
          createdAt: d.created_at,
        })) || [],
      };
      
      // Create a shallow copy of tasks to insert or update the task
      const { tasks } = get();
      const existingKey = tasks.findIndex((tsk) => tsk.id === taskId);
      if (existingKey >= 0) {
        get().updateTask(taskId, formattedTask);
      } else {
        set({ tasks: [...tasks, formattedTask as Task] });
      }
    } catch (error) {
      console.error("Failed to fetch task details:", error);
    }
  },

  setTasks: (tasks) => set({ tasks }),

  addTask: (task) => {
    set((state) => ({
      tasks: [task, ...state.tasks],
    }));
  },

  updateTask: (taskId, updates) => {
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
      ),
      currentTask: state.currentTask?.id === taskId
        ? { ...state.currentTask, ...updates, updatedAt: new Date().toISOString() }
        : state.currentTask,
    }));
  },

  deleteTask: (taskId) => {
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== taskId),
      currentTask: state.currentTask?.id === taskId ? null : state.currentTask,
    }));
  },

  setCurrentTask: (task) => set({ currentTask: task }),

  setFilters: (filters) => set({ filters }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  moveTask: (taskId, newStatus) => {
    const updates: Partial<Task> = { status: newStatus };
    if (newStatus === 'done') {
      updates.completedAt = new Date().toISOString();
    } else {
      updates.completedAt = undefined;
    }
    get().updateTask(taskId, updates);
  },

  addComment: (taskId, comment) => {
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId
          ? { ...t, comments: [...t.comments, comment] }
          : t
      ),
    }));
  },

  assignTask: (taskId, assigneeId) => {
    // In a dynamic app, we only need the ID and the backend handles resolving the full user object.
    get().updateTask(taskId, { assigneeId });
  },

  getFilteredTasks: () => {
    const { tasks, filters } = get();
    return tasks.filter((task) => {
      if (filters.projectId && task.projectId !== filters.projectId) return false;
      if (filters.status) {
        const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
        if (!statuses.includes(task.status)) return false;
      }
      if (filters.priority) {
        const priorities = Array.isArray(filters.priority) ? filters.priority : [filters.priority];
        if (!priorities.includes(task.priority)) return false;
      }
      if (filters.assigneeId && task.assigneeId !== filters.assigneeId) return false;
      if (filters.reporterId && task.reporterId !== filters.reporterId) return false;
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(searchLower);
        const matchesDescription = task.description?.toLowerCase().includes(searchLower);
        if (!matchesTitle && !matchesDescription) return false;
      }
      return true;
    });
  },

  getTasksByProject: (projectId) => {
    return get().tasks.filter((t) => t.projectId === projectId);
  },

  getTasksByStatus: (status) => {
    return get().tasks.filter((t) => t.status === status);
  },

  getTaskById: (id) => {
    return get().tasks.find((t) => t.id === id);
  },

  getMyTasks: (userId) => {
    return get().tasks.filter((t) => t.assigneeId === userId);
  },
}));
