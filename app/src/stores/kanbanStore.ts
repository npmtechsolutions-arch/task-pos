import { create } from 'zustand';
import { kanbanApi, type KanbanBoardView, type KanbanColumn, type KanbanTaskCard } from '@/api/kanban';

interface KanbanState {
  board: KanbanBoardView | null;
  columns: KanbanColumn[];
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchBoard: (projectId: string) => Promise<void>;
  moveTask: (taskId: string, sourceColId: string, targetColId: string, newPosition: number) => Promise<void>;
  
  // Local optimistic updates
  optimisticMoveTask: (taskId: string, sourceColId: string, targetColId: string, newPosition: number) => void;
}

export const useKanbanStore = create<KanbanState>((set, get) => ({
  board: null,
  columns: [],
  isLoading: false,
  error: null,

  fetchBoard: async (projectId: string) => {
    set({ isLoading: true, error: null });
    try {
      const board = await kanbanApi.getBoard(projectId);
      set({ board, columns: board.columns, isLoading: false });
    } catch (err: any) {
      set({
        error: err.response?.data?.detail || 'Failed to fetch Kanban board',
        isLoading: false,
      });
      console.error('Board fetch error:', err);
    }
  },

  optimisticMoveTask: (taskId, sourceColId, targetColId, newPosition) => {
    const { columns } = get();
    
    // Find the task in the source column
    let targetTask: KanbanTaskCard | null = null;
    const newColumns = columns.map((col) => {
      if (col.id === sourceColId) {
        targetTask = col.tasks.find((t) => t.id === taskId) || null;
        return {
          ...col,
          tasks: col.tasks.filter((t) => t.id !== taskId),
          taskCount: col.taskCount - 1
        };
      }
      return col;
    });

    if (!targetTask) return;

    // TypeScript doesn't know targetTask is non-null despite early return
    // Cast it explicitly to satisfy the type checker
    const updatedTargetTask = targetTask as KanbanTaskCard;

    // Update task's column and position
    updatedTargetTask.boardColumnId = targetColId;
    updatedTargetTask.position = newPosition;
    
    // Optional: update status locally if col type maps to standard status 
    const targetCol = columns.find((c) => c.id === targetColId);
    if (targetCol) {
      updatedTargetTask.status = targetCol.columnType;
    }

    // Insert into target column at correct position
    const finalColumns = newColumns.map(col => {
      if (col.id === targetColId) {
        const tasks = [...col.tasks];
        // For simplicity in optimistic update, just append to the end.
        // A full sortable tree requires complex splice math depending on drag direction.
        tasks.push(targetTask!);
        // Sort by position
        tasks.sort((a, b) => a.position - b.position);
        
        return {
          ...col,
          tasks,
          taskCount: col.taskCount + 1
        };
      }
      return col;
    });

    set({ columns: finalColumns });
  },

  moveTask: async (taskId, sourceColId, targetColId, newPosition) => {
    // 1. Optimistic Update UI instantly
    get().optimisticMoveTask(taskId, sourceColId, targetColId, newPosition);

    try {
      // 2. Commit to backend
      await kanbanApi.moveCard({
        taskId,
        sourceColumnId: sourceColId,
        targetColumnId: targetColId,
        newPosition,
      });
      
      // If needed, we can reconcile the updatedTask back into the store here,
      // but usually optimistic update is sufficient.
    } catch (err: any) {
      console.error('Failed to move task:', err);
      // 3. Rollback on failure by refetching board state
      const { board } = get();
      if (board?.projectId) {
        get().fetchBoard(board.projectId);
      }
    }
  },
}));
