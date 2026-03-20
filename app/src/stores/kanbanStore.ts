import { create } from 'zustand';
import { kanbanApi, type KanbanBoardView, type KanbanColumn, type KanbanTaskCard } from '@/api/kanban';

// ─── Filter & Swimlane Types ─────────────────────────────────────────────

export type SwimlaneMode = 'none' | 'priority' | 'assignee';
export type WipMode = 'hard' | 'soft' | 'visual';

export interface KanbanFilters {
  search: string;
  priority: string;   // '' = all
  assigneeId: string; // '' = all
  labelId: string;    // '' = all
}

export interface SwimlaneGroup {
  id: string;
  label: string;
  tasks: KanbanTaskCard[];
}

// ─── Store State ─────────────────────────────────────────────────────────

interface KanbanState {
  board: KanbanBoardView | null;
  columns: KanbanColumn[];
  isLoading: boolean;
  error: string | null;
  filters: KanbanFilters;
  swimlaneMode: SwimlaneMode;
  wipMode: WipMode;

  // Actions
  fetchBoard: (projectId: string) => Promise<void>;
  moveTask: (taskId: string, sourceColId: string, targetColId: string, newPosition: number) => Promise<void>;
  quickAddTask: (columnId: string, title: string, projectId: string) => Promise<KanbanTaskCard | null>;
  deleteTask: (taskId: string) => Promise<void>;
  setFilters: (f: Partial<KanbanFilters>) => void;
  clearFilters: () => void;
  setSwimlaneMode: (m: SwimlaneMode) => void;
  setWipMode: (m: WipMode) => void;

  // Derived
  getFilteredColumns: () => KanbanColumn[];
  getSwimlanes: (columnId: string) => SwimlaneGroup[];
  isWipExceeded: (columnId: string) => boolean;
}

// ─── Default filters ─────────────────────────────────────────────────────

const DEFAULT_FILTERS: KanbanFilters = { search: '', priority: '', assigneeId: '', labelId: '' };

// ─── Store ────────────────────────────────────────────────────────────────

export const useKanbanStore = create<KanbanState>((set, get) => ({
  board: null,
  columns: [],
  isLoading: false,
  error: null,
  filters: DEFAULT_FILTERS,
  swimlaneMode: 'none',
  wipMode: 'visual',

  // ── Fetch board from API ───────────────────────────────────────────────
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
    }
  },

  // ── Move task with optimistic update + rollback ────────────────────────
  moveTask: async (taskId, sourceColId, targetColId, newPosition) => {
    // Snapshot for rollback
    const snapshot = get().columns;

    // Optimistic: move card instantly
    const { columns } = get();
    let movedTask: KanbanTaskCard | undefined;
    const afterRemove = columns.map((col) => {
      if (col.id === sourceColId) {
        movedTask = col.tasks.find((t) => t.id === taskId);
        return { ...col, tasks: col.tasks.filter((t) => t.id !== taskId), taskCount: col.taskCount - 1 };
      }
      return col;
    });

    if (!movedTask) return;
    const taskCopy = { ...movedTask, boardColumnId: targetColId, position: newPosition };

    const afterInsert = afterRemove.map((col) => {
      if (col.id === targetColId) {
        const tasks = [...col.tasks];
        // Insert at correct position
        const insertIdx = tasks.findIndex((t) => t.position >= newPosition);
        if (insertIdx === -1) tasks.push(taskCopy);
        else tasks.splice(insertIdx, 0, taskCopy);
        return { ...col, tasks, taskCount: col.taskCount + 1 };
      }
      return col;
    });

    set({ columns: afterInsert });

    try {
      await kanbanApi.moveCard({ taskId, targetColumnId: targetColId, sourceColumnId: sourceColId, newPosition });
    } catch (err: any) {
      // Rollback on failure
      set({ columns: snapshot });
      console.error('Move failed — rolled back:', err);
    }
  },

  // ── Quick-add a card to a column ─────────────────────────────────────
  quickAddTask: async (columnId, title, projectId) => {
    const { columns } = get();
    const col = columns.find((c) => c.id === columnId);
    const position = col ? col.tasks.length : 0;
    try {
      const newTask = await kanbanApi.createTask({
        title,
        project_id: projectId,
        board_column_id: columnId,
        position,
        status: col?.columnType || 'todo',
      });
      set((state) => ({
        columns: state.columns.map((c) =>
          c.id === columnId
            ? { ...c, tasks: [...c.tasks, newTask], taskCount: c.taskCount + 1 }
            : c
        ),
      }));
      return newTask;
    } catch (err) {
      console.error('Quick-add failed:', err);
      return null;
    }
  },

  // ── Delete a task ─────────────────────────────────────────────────────
  deleteTask: async (taskId) => {
    const snapshot = get().columns;
    // Optimistic remove
    set((state) => ({
      columns: state.columns.map((col) => {
        const has = col.tasks.some((t) => t.id === taskId);
        if (!has) return col;
        return { ...col, tasks: col.tasks.filter((t) => t.id !== taskId), taskCount: col.taskCount - 1 };
      }),
    }));
    try {
      await kanbanApi.deleteTask(taskId);
    } catch (err) {
      set({ columns: snapshot });
      console.error('Delete failed — rolled back:', err);
    }
  },

  // ── Filter actions ────────────────────────────────────────────────────
  setFilters: (f) => set((state) => ({ filters: { ...state.filters, ...f } })),
  clearFilters: () => set({ filters: DEFAULT_FILTERS }),
  setSwimlaneMode: (m) => set({ swimlaneMode: m }),
  setWipMode: (m) => set({ wipMode: m }),

  // ── Derived: apply filters to columns ────────────────────────────────
  getFilteredColumns: () => {
    const { columns, filters } = get();
    return columns.map((col) => ({
      ...col,
      tasks: col.tasks.filter((task) => {
        if (filters.search && !task.title.toLowerCase().includes(filters.search.toLowerCase())) return false;
        if (filters.priority && task.priority !== filters.priority) return false;
        if (filters.assigneeId && task.primaryAssigneeId !== filters.assigneeId) return false;
        if (filters.labelId && !task.labels.some((l) => l.id === filters.labelId)) return false;
        return true;
      }),
    }));
  },

  // ── Derived: group tasks in a column into swimlanes ──────────────────
  getSwimlanes: (columnId) => {
    const { columns, swimlaneMode } = get();
    const col = columns.find((c) => c.id === columnId);
    if (!col) return [];
    const tasks = col.tasks;

    if (swimlaneMode === 'none') {
      return [{ id: 'all', label: '', tasks }];
    }

    if (swimlaneMode === 'priority') {
      const order = ['highest', 'high', 'medium', 'low', 'lowest'];
      const groups: Record<string, KanbanTaskCard[]> = {};
      tasks.forEach((t) => {
        const p = t.priority as string;
        if (!groups[p]) groups[p] = [];
        groups[p].push(t);
      });
      return order
        .filter((p) => groups[p]?.length)
        .map((p) => ({ id: p, label: p.charAt(0).toUpperCase() + p.slice(1), tasks: groups[p] }));
    }

    if (swimlaneMode === 'assignee') {
      const groups: Record<string, { label: string; tasks: KanbanTaskCard[] }> = {};
      tasks.forEach((t) => {
        const key = t.primaryAssigneeId || 'unassigned';
        const label = t.primaryAssignee?.fullName || 'Unassigned';
        if (!groups[key]) groups[key] = { label, tasks: [] };
        groups[key].tasks.push(t);
      });
      return Object.entries(groups).map(([id, g]) => ({ id, label: g.label, tasks: g.tasks }));
    }

    return [{ id: 'all', label: '', tasks }];
  },

  // ── Derived: WIP exceeded check ───────────────────────────────────────
  isWipExceeded: (columnId) => {
    const col = get().columns.find((c) => c.id === columnId);
    if (!col || !col.wipLimit) return false;
    return col.taskCount >= col.wipLimit;
  },
}));
