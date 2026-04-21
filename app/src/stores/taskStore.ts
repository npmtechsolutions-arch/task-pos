import { create } from 'zustand';
import type { Task, TaskFilters, TaskStatus, TaskWorkflow } from '@/types';
import {
  listTasks,
  getMyTasks,
  getTask,
  createTask as apiCreateTask,
  updateTask as apiUpdateTask,
  deleteTask as apiDeleteTask,
  addComment as apiAddComment,
  deleteComment as apiDeleteComment,
  logTime as apiLogTime,
  addTimeEntry as apiAddTimeEntry,
  addDependency as apiAddDependency,
  removeDependency as apiRemoveDependency,
  type ApiTask,
  type ApiTaskDetail,
  type TaskCreatePayload,
  type TaskUpdatePayload,
  type CommentCreatePayload,
  type TimeEntryCreatePayload,
  type DependencyCreatePayload,
} from '@/api/tasks';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

// ─── Mapper ───────────────────────────────────────────────────────────────────

function mapApiTask(t: ApiTask): Task {
  return {
    ...t,
    projectId: t.project_id,
    primaryAssigneeId: t.primary_assignee_id,
    primaryAssignee: t.primary_assignee
      ? {
          id: t.primary_assignee.id,
          email: t.primary_assignee.email,
          firstName: t.primary_assignee.first_name ?? '',
          lastName: t.primary_assignee.last_name ?? '',
          fullName: t.primary_assignee.full_name,
          avatarUrl: t.primary_assignee.avatar_url,
          isActive: true,
          timezone: 'UTC',
          language: 'en',
          role: 'member',
          createdAt: '',
        }
      : undefined,
    reporter: {
      id: t.reporter.id,
      email: t.reporter.email,
      firstName: t.reporter.first_name ?? '',
      lastName: t.reporter.last_name ?? '',
      fullName: t.reporter.full_name,
      avatarUrl: t.reporter.avatar_url,
      isActive: true,
      timezone: 'UTC',
      language: 'en',
      role: 'member',
      createdAt: '',
    },
    reporterId: t.reporter_id,
    dueDate: t.due_date,
    startDate: t.start_date,
    actualHours: t.actual_hours,
    estimatedHours: t.estimated_hours,
    priorityScore: t.priority_score,
    workflowId: t.workflow_id,
    workflowStateId: t.workflow_state_id,
    completedAt: t.completed_at,
    labels: t.tags || [],
    subtasks: [],
    attachments: [],
    comments: [],
    dependencies: [],
    customFields: t.custom_fields ?? {},
    taskNumber: 0, // Will be set by backend task number if available
  } as unknown as Task;
}

function mapApiTaskDetail(t: ApiTaskDetail): Task {
  const base = mapApiTask(t);
  return {
    ...base,
    subtasks: (t.subtasks ?? []).map(mapApiTask),
    comments: (t.comments ?? []).map((c) => ({
      id: c.id,
      taskId: c.task_id,
      authorId: c.author_id,
      author: {
        id: c.author.id,
        email: c.author.email,
        firstName: c.author.first_name ?? '',
        lastName: c.author.last_name ?? '',
        fullName: c.author.full_name,
        isActive: true,
        timezone: 'UTC',
        language: 'en',
        role: 'member',
        createdAt: '',
      },
      content: c.content,
      mentions: c.mentions ?? [],
      isEdited: c.is_edited,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    })),
    dependencies: (t.dependencies ?? []).map((d) => ({
      id: d.id,
      taskId: d.task_id,
      dependsOnId: d.depends_on_id,
      dependencyType: d.dependency_type,
      createdAt: d.created_at,
    })),
  } as unknown as Task;
}

// ─── Store Interface ──────────────────────────────────────────────────────────

interface TaskState {
  tasks: Task[];
  currentTask: Task | null;
  filters: TaskFilters;
  isLoading: boolean;
  isLoadingDetail: boolean;
  error: string | null;

  // Real API actions
  fetchTasks: (filters?: TaskListFilters) => Promise<void>;
  fetchMyTasks: (status?: string) => Promise<void>;
  fetchTaskDetail: (taskId: string) => Promise<void>;
  createTask: (data: TaskCreatePayload) => Promise<Task | null>;
  updateTaskApi: (taskId: string, data: TaskUpdatePayload) => Promise<Task | null>;
  deleteTaskApi: (taskId: string) => Promise<boolean>;
  addCommentApi: (taskId: string, data: CommentCreatePayload) => Promise<void>;
  deleteCommentApi: (taskId: string, commentId: string) => Promise<void>;
  logTimeApi: (taskId: string, hours: number, description?: string) => Promise<void>;
  addTimeEntryApi: (taskId: string, data: TimeEntryCreatePayload) => Promise<void>;
  addDependencyApi: (taskId: string, data: DependencyCreatePayload) => Promise<void>;
  removeDependencyApi: (taskId: string, dependencyId: string) => Promise<void>;
  moveTask: (taskId: string, newStatus: TaskStatus) => Promise<void>;

  // In-memory helpers (backward compat)
  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  deleteTask: (taskId: string) => void;
  setCurrentTask: (task: Task | null) => void;
  setFilters: (filters: TaskFilters) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Enterprise actions (existing, already real)
  addSubtask: (parentId: string, title: string) => Promise<void>;
  deleteSubtask: (parentId: string, subtaskId: string) => Promise<void>;
  fetchTaskWorkflows: (projectId: string) => Promise<TaskWorkflow[]>;
  transitionTask: (taskId: string, targetStateId: string) => Promise<void>;

  // Computed
  getFilteredTasks: () => Task[];
  getTasksByProject: (projectId: string) => Task[];
  getTasksByStatus: (status: TaskStatus) => Task[];
  getMyTasks: (userId: string) => Task[];
  getTaskById: (id: string) => Task | undefined;
}

type TaskListFilters = Parameters<typeof listTasks>[0];

// ─── Store ────────────────────────────────────────────────────────────────────

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  currentTask: null,
  filters: {},
  isLoading: false,
  isLoadingDetail: false,
  error: null,

  // ── Fetch all tasks from DB ───────────────────────────────────────────────
  fetchTasks: async (filters) => {
    set({ isLoading: true, error: null });
    try {
      const storeFilters = get().filters;
      const merged = {
        project_id: (storeFilters as any).projectId,
        status: (storeFilters as any).status,
        primary_assignee_id: (storeFilters as any).primaryAssigneeId,
        search: storeFilters.search,
        ...filters,
      };
      const res = await listTasks(merged);
      set({ tasks: res.items.map(mapApiTask), isLoading: false });
    } catch (err: any) {
      set({
        error: err.response?.data?.detail || 'Failed to fetch tasks',
        isLoading: false,
      });
    }
  },

  // ── Fetch my tasks ────────────────────────────────────────────────────────
  fetchMyTasks: async (status) => {
    set({ isLoading: true, error: null });
    try {
      const items = await getMyTasks(status);
      set({ tasks: items.map(mapApiTask), isLoading: false });
    } catch (err: any) {
      set({
        error: err.response?.data?.detail || 'Failed to fetch tasks',
        isLoading: false,
      });
    }
  },

  // ── Fetch task detail ──────────────────────────────────────────────────────
  fetchTaskDetail: async (taskId) => {
    set({ isLoadingDetail: true });
    try {
      const data = await getTask(taskId);
      const mapped = mapApiTaskDetail(data);
      set((state) => {
        const exists = state.tasks.some((t) => t.id === taskId);
        return {
          currentTask: mapped,
          isLoadingDetail: false,
          tasks: exists
            ? state.tasks.map((t) => (t.id === taskId ? mapped : t))
            : [mapped, ...state.tasks],
        };
      });
    } catch (err: any) {
      set({ error: err.response?.data?.detail || 'Failed to fetch task', isLoadingDetail: false });
    }
  },

  // ── Create task (real API) ────────────────────────────────────────────────
  createTask: async (data: TaskCreatePayload) => {
    try {
      const apiTask = await apiCreateTask(data);
      const mapped = mapApiTask(apiTask);
      set((state) => ({ tasks: [mapped, ...state.tasks] }));
      return mapped;
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map((d: any) => `${d.loc?.slice(1)?.join(' → ') ?? ''}: ${d.msg}`).join(' | ')
          : 'Failed to create task';
      set({ error: msg });
      throw err; // Re-throw original Axios error so caller can read response.data.detail
    }
  },

  // ── Update task (real API) ────────────────────────────────────────────────
  updateTaskApi: async (taskId, data) => {
    try {
      const apiTask = await apiUpdateTask(taskId, data);
      const mapped = mapApiTask(apiTask);
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, ...mapped } : t)),
        currentTask: state.currentTask?.id === taskId ? { ...state.currentTask, ...mapped } : state.currentTask,
      }));
      return mapped;
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Failed to update task';
      set({ error: msg });
      throw new Error(msg);
    }
  },

  // ── Delete task (real API) ────────────────────────────────────────────────
  deleteTaskApi: async (taskId) => {
    try {
      await apiDeleteTask(taskId);
      set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== taskId),
        currentTask: state.currentTask?.id === taskId ? null : state.currentTask,
      }));
      return true;
    } catch (err: any) {
      set({ error: err.response?.data?.detail || 'Failed to delete task' });
      return false;
    }
  },

  // ── Move task status (real API) ───────────────────────────────────────────
  moveTask: async (taskId, newStatus) => {
    // Optimistically update in store
    const updates: Partial<Task> = { status: newStatus };
    if (newStatus === 'done') updates.completedAt = new Date().toISOString();
    else updates.completedAt = undefined;
    get().updateTask(taskId, updates);

    try {
      await apiUpdateTask(taskId, { status: newStatus });
    } catch (err) {
      // Rollback is complex - at minimum log the error
      console.error('Failed to persist status change:', err);
    }
  },

  // ── Comments ──────────────────────────────────────────────────────────────
  addCommentApi: async (taskId, data) => {
    const comment = await apiAddComment(taskId, data);
    const mapped = {
      id: comment.id,
      taskId: comment.task_id,
      authorId: comment.author_id,
      author: {
        id: comment.author.id,
        email: comment.author.email,
        firstName: comment.author.first_name ?? '',
        lastName: comment.author.last_name ?? '',
        fullName: comment.author.full_name,
        isActive: true,
        timezone: 'UTC',
        language: 'en',
        role: 'member',
        createdAt: '',
      },
      content: comment.content,
      mentions: comment.mentions ?? [],
      isEdited: comment.is_edited,
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
    };
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId ? { ...t, comments: [...(t.comments ?? []), mapped as any] } : t
      ),
      currentTask:
        state.currentTask?.id === taskId
          ? { ...state.currentTask, comments: [...(state.currentTask.comments ?? []), mapped as any] }
          : state.currentTask,
    }));
  },

  deleteCommentApi: async (taskId, commentId) => {
    await apiDeleteComment(taskId, commentId);
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId ? { ...t, comments: (t.comments ?? []).filter((c: any) => c.id !== commentId) } : t
      ),
      currentTask:
        state.currentTask?.id === taskId
          ? { ...state.currentTask, comments: (state.currentTask.comments ?? []).filter((c: any) => c.id !== commentId) }
          : state.currentTask,
    }));
  },

  // ── Time Logging ──────────────────────────────────────────────────────────
  logTimeApi: async (taskId, hours, description) => {
    await apiLogTime(taskId, hours, description);
    // Refresh task detail to get updated actual_hours
    const { fetchTaskDetail } = get();
    await fetchTaskDetail(taskId);
  },

  addTimeEntryApi: async (taskId, data) => {
    await apiAddTimeEntry(taskId, data);
    const { fetchTaskDetail } = get();
    await fetchTaskDetail(taskId);
  },

  // ── Dependencies ──────────────────────────────────────────────────────────
  addDependencyApi: async (taskId, data) => {
    const dep = await apiAddDependency(taskId, data);
    const mapped = {
      id: dep.id,
      taskId: dep.task_id,
      dependsOnId: dep.depends_on_id,
      dependencyType: dep.dependency_type,
      createdAt: dep.created_at,
    };
    set((state) => ({
      currentTask: state.currentTask?.id === taskId
        ? { ...state.currentTask, dependencies: [...(state.currentTask.dependencies ?? []), mapped as any] }
        : state.currentTask,
    }));
  },

  removeDependencyApi: async (taskId, dependencyId) => {
    await apiRemoveDependency(taskId, dependencyId);
    set((state) => ({
      currentTask: state.currentTask?.id === taskId
        ? { ...state.currentTask, dependencies: (state.currentTask.dependencies ?? []).filter((d: any) => d.id !== dependencyId) }
        : state.currentTask,
    }));
  },

  // ── In-memory helpers ──────────────────────────────────────────────────────
  setTasks: (tasks) => set({ tasks }),
  addTask: (task) => set((state) => ({ tasks: [task, ...state.tasks] })),
  updateTask: (taskId, updates) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
      ),
      currentTask:
        state.currentTask?.id === taskId
          ? { ...state.currentTask, ...updates, updatedAt: new Date().toISOString() }
          : state.currentTask,
    })),
  deleteTask: (taskId) =>
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== taskId),
      currentTask: state.currentTask?.id === taskId ? null : state.currentTask,
    })),
  setCurrentTask: (task) => set({ currentTask: task }),
  setFilters: (filters) => set({ filters }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  // ── Enterprise (existing real API) ─────────────────────────────────────────
  addSubtask: async (parentId, title) => {
    try {
      const parent = get().getTaskById(parentId);
      if (!parent) return;
      const response = await axios.post(
        `${API_URL}/tasks`,
        { title, project_id: parent.projectId, parent_id: parentId, priority: parent.priority, task_type: 'subtask' },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      const newSubtask = mapApiTask(response.data);
      set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === parentId ? { ...t, subtasks: [...(t.subtasks || []), newSubtask] } : t
        ),
        currentTask:
          state.currentTask?.id === parentId
            ? { ...state.currentTask, subtasks: [...(state.currentTask.subtasks || []), newSubtask] }
            : state.currentTask,
      }));
    } catch (error) {
      console.error('Failed to add subtask:', error);
    }
  },

  deleteSubtask: async (parentId, subtaskId) => {
    try {
      await axios.delete(`${API_URL}/tasks/${subtaskId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === parentId ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== subtaskId) } : t
        ),
        currentTask:
          state.currentTask?.id === parentId
            ? { ...state.currentTask, subtasks: state.currentTask.subtasks.filter((s) => s.id !== subtaskId) }
            : state.currentTask,
      }));
    } catch (error) {
      console.error('Failed to delete subtask:', error);
    }
  },

  fetchTaskWorkflows: async (projectId) => {
    try {
      const response = await axios.get(`${API_URL}/workflows`, {
        params: { project_id: projectId },
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      return response.data as TaskWorkflow[];
    } catch {
      return [];
    }
  },

  transitionTask: async (taskId, targetStateId) => {
    try {
      const response = await axios.post(
        `${API_URL}/workflows/transition`,
        { task_id: taskId, target_state_id: targetStateId },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      const updatedTask = response.data;
      get().updateTask(taskId, {
        status: updatedTask.status,
        workflowStateId: updatedTask.workflow_state_id,
      });
    } catch (error) {
      console.error('Failed to transition task:', error);
    }
  },

  // ── Computed ───────────────────────────────────────────────────────────────
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
      if (filters.primaryAssigneeId && task.primaryAssigneeId !== filters.primaryAssigneeId) return false;
      if (filters.reporterId && task.reporterId !== filters.reporterId) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (!task.title.toLowerCase().includes(q) && !task.description?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  },

  getTasksByProject: (projectId) => get().tasks.filter((t) => t.projectId === projectId),
  getTasksByStatus: (status) => get().tasks.filter((t) => t.status === status),
  getTaskById: (id) => get().tasks.find((t) => t.id === id),
  getMyTasks: (userId) => get().tasks.filter((t) => t.primaryAssigneeId === userId),
}));
