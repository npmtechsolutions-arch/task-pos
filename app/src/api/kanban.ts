import axios from 'axios';
import type { TaskStatus, TaskPriority, TaskType } from '@/types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

// ─── Types ────────────────────────────────────────────────────────────────

export interface KanbanLabel {
  id: string;
  name: string;
  color: string;
  projectId?: string;
  createdAt: string;
}

export interface KanbanAssignee {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  avatarUrl?: string;
  role: string;
}

export interface KanbanTaskCard {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  taskType: TaskType;
  position: number;
  boardColumnId?: string;
  projectId: string;
  primaryAssigneeId?: string;
  primaryAssignee?: KanbanAssignee;
  labels: KanbanLabel[];
  dueDate?: string;
  estimatedHours?: number;
  actualHours: number;
  isOverdue: boolean;
  commentCount: number;
  assigneeCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface KanbanColumn {
  id: string;
  name: string;
  position: number;
  color: string;
  wipLimit?: number;
  columnType: string;
  tasks: KanbanTaskCard[];
  taskCount: number;
}

export interface KanbanBoardView {
  boardId: string;
  boardName: string;
  projectId: string;
  columns: KanbanColumn[];
  totalTasks: number;
  wipLimitsEnabled: boolean;
}

export interface DragMoveRequest {
  taskId: string;
  targetColumnId: string;
  newPosition: number;
  sourceColumnId?: string;
}

export interface KanbanTaskCreatePayload {
  title: string;
  project_id: string;
  board_column_id?: string;
  status?: string;
  priority?: string;
  description?: string;
  primary_assignee_id?: string;
  due_date?: string;
  estimated_hours?: number;
  position?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────

const getHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('token')}`,
});

function mapTask(task: any): KanbanTaskCard {
  return {
    ...task,
    boardColumnId: task.board_column_id,
    taskType: task.task_type,
    projectId: task.project_id,
    primaryAssigneeId: task.primary_assignee_id,
    dueDate: task.due_date,
    estimatedHours: task.estimated_hours,
    actualHours: task.actual_hours ?? 0,
    isOverdue: task.is_overdue ?? false,
    commentCount: task.comment_count ?? 0,
    assigneeCount: task.assignee_count ?? 0,
    createdAt: task.created_at,
    updatedAt: task.updated_at,
    labels: (task.labels ?? []).map((lbl: any) => ({
      id: lbl.id,
      name: lbl.name,
      color: lbl.color,
      projectId: lbl.project_id,
      createdAt: lbl.created_at,
    })),
    primaryAssignee: task.assignee
      ? {
          id: task.assignee.id,
          email: task.assignee.email,
          firstName: task.assignee.first_name,
          lastName: task.assignee.last_name,
          fullName: task.assignee.full_name,
          avatarUrl: task.assignee.avatar_url,
          role: task.assignee.role,
        }
      : undefined,
  };
}

// ─── API ─────────────────────────────────────────────────────────────────

export const kanbanApi = {
  /** Initialize board for a project (idempotent) */
  initBoard: async (projectId: string): Promise<{ boardId: string; created: boolean }> => {
    const res = await axios.post(`${API_URL}/kanban/boards/init/${projectId}`, null, {
      headers: getHeaders(),
    });
    return { boardId: res.data.board_id, created: res.data.created };
  },

  /** Fetch the full board view */
  getBoard: async (projectId: string): Promise<KanbanBoardView> => {
    const res = await axios.get(`${API_URL}/kanban/board/${projectId}`, {
      headers: getHeaders(),
    });
    const data = res.data;
    return {
      boardId: data.board_id,
      boardName: data.board_name,
      projectId: data.project_id,
      totalTasks: data.total_tasks,
      wipLimitsEnabled: data.wip_limits_enabled,
      columns: data.columns.map((col: any) => ({
        id: col.id,
        name: col.name,
        position: col.position,
        color: col.color,
        wipLimit: col.wip_limit,
        columnType: col.column_type,
        taskCount: col.task_count,
        tasks: col.tasks.map(mapTask),
      })),
    };
  },

  /** Create a task directly on the Kanban board */
  createTask: async (data: KanbanTaskCreatePayload): Promise<KanbanTaskCard> => {
    const res = await axios.post(`${API_URL}/kanban/tasks`, data, {
      headers: getHeaders(),
    });
    return mapTask(res.data);
  },

  /** Delete a task card */
  deleteTask: async (taskId: string): Promise<void> => {
    await axios.delete(`${API_URL}/kanban/tasks/${taskId}`, {
      headers: getHeaders(),
    });
  },

  /** Move a task via drag and drop */
  moveCard: async (moveData: DragMoveRequest): Promise<KanbanTaskCard> => {
    const res = await axios.put(
      `${API_URL}/kanban/tasks/${moveData.taskId}/move`,
      {
        task_id: moveData.taskId,
        target_column_id: moveData.targetColumnId,
        new_position: moveData.newPosition,
        source_column_id: moveData.sourceColumnId,
      },
      { headers: getHeaders() }
    );
    return mapTask(res.data);
  },

  /** Get labels for a project */
  getLabels: async (projectId: string): Promise<KanbanLabel[]> => {
    const res = await axios.get(`${API_URL}/kanban/labels/${projectId}`, {
      headers: getHeaders(),
    });
    return res.data.map((lbl: any) => ({
      id: lbl.id,
      name: lbl.name,
      color: lbl.color,
      projectId: lbl.project_id,
      createdAt: lbl.created_at,
    }));
  },
};
