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
  currentProjectId: string | null;
  board: KanbanBoardView | null;
  columns: KanbanColumn[];
  isLoading: boolean;
  /** Set of task IDs currently being moved (API in-flight). Does NOT
   *  set isLoading so it won't block board renders or the WS refetch guard. */
  movingTaskIds: Set<string>;
  error: string | null;
  filters: KanbanFilters;
  swimlaneMode: SwimlaneMode;
  wipMode: WipMode;

  // Actions
  fetchBoard: (projectId: string) => Promise<void>;
  moveTask: (taskId: string, sourceColId: string, targetColId: string, newPosition: number) => Promise<void>;
  /** Apply a move that came in via WebSocket from another user. */
  applyRemoteMove: (taskId: string, sourceColId: string | undefined, targetColId: string, newPosition: number, serverCard?: Partial<KanbanTaskCard>) => void;
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

// ─── Helpers ─────────────────────────────────────────────────────────────

/** Move a task between/within columns in a column array. Pure, no mutation. */
function applyMoveToColumns(
  columns: KanbanColumn[],
  taskId: string,
  sourceColId: string | undefined,
  targetColId: string,
  newPosition: number,
  patchTask?: Partial<KanbanTaskCard>,
): KanbanColumn[] {
  let movedTask: KanbanTaskCard | undefined;

  // 1. Remove from source
  const afterRemove = columns.map((col) => {
    if (sourceColId ? col.id === sourceColId : col.tasks.some((t) => t.id === taskId)) {
      movedTask = col.tasks.find((t) => t.id === taskId);
      if (!movedTask) return col;
      return {
        ...col,
        tasks: col.tasks.filter((t) => t.id !== taskId),
        taskCount: Math.max(0, col.taskCount - 1),
      };
    }
    return col;
  });

  if (!movedTask) return columns; // task not found — leave board unchanged

  // 2. Build the updated task
  const updatedTask: KanbanTaskCard = {
    ...movedTask,
    boardColumnId: targetColId,
    position: newPosition,
    ...(patchTask ?? {}),
  };

  // 3. Insert into target at the correct index
  return afterRemove.map((col) => {
    if (col.id !== targetColId) return col;
    const tasks = [...col.tasks];
    const clampedIdx = Math.min(Math.max(newPosition, 0), tasks.length);
    tasks.splice(clampedIdx, 0, updatedTask);
    return { ...col, tasks, taskCount: col.taskCount + 1 };
  });
}

// ─── Store ────────────────────────────────────────────────────────────────

export const useKanbanStore = create<KanbanState>((set, get) => ({
  currentProjectId: null,
  board: null,
  columns: [],
  isLoading: false,
  movingTaskIds: new Set(),
  error: null,
  filters: DEFAULT_FILTERS,
  swimlaneMode: 'none',
  wipMode: 'visual',

  // ── Fetch board from API ───────────────────────────────────────────────
  fetchBoard: async (projectId: string) => {
    const isNewProject = get().currentProjectId !== projectId;
    set({
      isLoading: true,
      error: null,
      currentProjectId: projectId,
      // Only clear the board when switching to a completely new project
      ...(isNewProject && { columns: [], board: null }),
    });

    try {
      const board = await kanbanApi.getBoard(projectId);
      // Guard: ignore response if user navigated away
      if (get().currentProjectId === projectId) {
        set({ board, columns: board.columns, isLoading: false });
      }
    } catch (err: any) {
      if (get().currentProjectId === projectId) {
        set({
          error: err.response?.data?.detail || 'Failed to fetch Kanban board',
          isLoading: false,
        });
      }
    }
  },

  // ── Move task — optimistic + server sync, NO isLoading toggle ────────
  moveTask: async (taskId, sourceColId, targetColId, newPosition) => {
    // Don't process if already moving this task (double-drag guard)
    if (get().movingTaskIds.has(taskId)) return;

    // Snapshot for rollback
    const snapshot = get().columns;

    // Stamp optimistic updatedAt so the WS timestamp guard knows our local
    // copy is current and blocks any stale broadcast from overwriting it.
    const optimisticNow = new Date().toISOString();

    // Optimistic update — instant, no isLoading toggle (avoids board re-render lag)
    const optimisticColumns = applyMoveToColumns(
      get().columns,
      taskId,
      sourceColId,
      targetColId,
      newPosition,
      { updatedAt: optimisticNow },
    );

    set((state) => ({
      columns: optimisticColumns,
      movingTaskIds: new Set([...state.movingTaskIds, taskId]),
    }));

    try {
      const serverCard = await kanbanApi.moveCard({
        taskId,
        targetColumnId: targetColId,
        sourceColumnId: sourceColId,
        newPosition,
      });

      // Patch only the moved task with canonical server data (status, updatedAt…)
      set((state) => ({
        movingTaskIds: new Set([...state.movingTaskIds].filter((id) => id !== taskId)),
        columns: state.columns.map((col) => {
          if (col.id !== targetColId) return col;
          return {
            ...col,
            tasks: col.tasks.map((t) =>
              t.id === taskId
                ? { ...t, ...serverCard, boardColumnId: targetColId }
                : t
            ),
          };
        }),
      }));
    } catch (err: any) {
      // Rollback on failure
      set((state) => ({
        columns: snapshot,
        movingTaskIds: new Set([...state.movingTaskIds].filter((id) => id !== taskId)),
      }));
      console.error('[Kanban] Move failed — rolled back:', err);
    }
  },

  // ── Apply a real-time move from another user (WebSocket) ──────────────
  applyRemoteMove: (taskId, sourceColId, targetColId, newPosition, serverCard) => {
    // Don't apply if we are currently moving this task ourselves
    if (get().movingTaskIds.has(taskId)) return;

    set((state) => ({
      columns: applyMoveToColumns(
        state.columns,
        taskId,
        sourceColId,
        targetColId,
        newPosition,
        serverCard,
      ),
    }));
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
      console.error('[Kanban] Quick-add failed:', err);
      return null;
    }
  },

  // ── Delete a task ─────────────────────────────────────────────────────
  deleteTask: async (taskId) => {
    const snapshot = get().columns;
    set((state) => ({
      columns: state.columns.map((col) => {
        const has = col.tasks.some((t) => t.id === taskId);
        if (!has) return col;
        return {
          ...col,
          tasks: col.tasks.filter((t) => t.id !== taskId),
          taskCount: Math.max(0, col.taskCount - 1),
        };
      }),
    }));
    try {
      await kanbanApi.deleteTask(taskId);
    } catch (err) {
      set({ columns: snapshot });
      console.error('[Kanban] Delete failed — rolled back:', err);
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
    if (!filters.search && !filters.priority && !filters.assigneeId && !filters.labelId) {
      return columns; // fast path — no filters active
    }
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

    if (swimlaneMode === 'none') return [{ id: 'all', label: '', tasks }];

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
