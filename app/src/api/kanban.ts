import axios from 'axios';
import type { TaskStatus, TaskPriority, TaskType } from '@/types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

// ─── Interfaces ─────────────────────────────────────────────────────────

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
  assigneeId?: string;
  assignee?: KanbanAssignee;
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
  columnType: TaskStatus;
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

// ─── API Methods ────────────────────────────────────────────────────────

const getHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('token')}`,
});

export const kanbanApi = {
  /**
   * Fetch the full board view including all columns and tasks
   */
  getBoard: async (projectId: string): Promise<KanbanBoardView> => {
    const response = await axios.get(`${API_URL}/kanban/board/${projectId}`, {
      headers: getHeaders(),
    });
    
    // Convert snake_case from backend to camelCase for frontend components
    const data = response.data;
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
        tasks: col.tasks.map((task: any) => ({
          ...task,
          boardColumnId: task.board_column_id,
          taskType: task.task_type,
          projectId: task.project_id,
          assigneeId: task.assignee_id,
          dueDate: task.due_date,
          estimatedHours: task.estimated_hours,
          actualHours: task.actual_hours,
          isOverdue: task.is_overdue,
          commentCount: task.comment_count,
          assigneeCount: task.assignee_count,
          createdAt: task.created_at,
          updatedAt: task.updated_at,
          assignee: task.assignee ? {
            id: task.assignee.id,
            email: task.assignee.email,
            firstName: task.assignee.first_name,
            lastName: task.assignee.last_name,
            fullName: task.assignee.full_name,
            avatarUrl: task.assignee.avatar_url,
            role: task.assignee.role,
          } : undefined,
          labels: task.labels.map((lbl: any) => ({
            id: lbl.id,
            name: lbl.name,
            color: lbl.color,
            projectId: lbl.project_id,
            createdAt: lbl.created_at,
          }))
        }))
      }))
    };
  },

  /**
   * Move a task via drag and drop
   */
  moveCard: async (moveData: DragMoveRequest): Promise<KanbanTaskCard> => {
    const response = await axios.put(
      `${API_URL}/kanban/tasks/${moveData.taskId}/move`,
      {
        task_id: moveData.taskId,
        target_column_id: moveData.targetColumnId,
        new_position: moveData.newPosition,
        source_column_id: moveData.sourceColumnId
      },
      { headers: getHeaders() }
    );
    
    const task = response.data;
    return {
      ...task,
      boardColumnId: task.board_column_id,
      taskType: task.task_type,
      projectId: task.project_id,
      assigneeId: task.assignee_id,
      dueDate: task.due_date,
      estimatedHours: task.estimated_hours,
      actualHours: task.actual_hours,
      isOverdue: task.is_overdue,
      commentCount: task.comment_count,
      assigneeCount: task.assignee_count,
      createdAt: task.created_at,
      updatedAt: task.updated_at,
      assignee: task.assignee ? {
        id: task.assignee.id,
        email: task.assignee.email,
        firstName: task.assignee.first_name,
        lastName: task.assignee.last_name,
        fullName: task.assignee.full_name,
        avatarUrl: task.assignee.avatar_url,
        role: task.assignee.role,
      } : undefined,
    };
  },
};
