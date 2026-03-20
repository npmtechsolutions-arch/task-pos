import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DropAnimation,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Search, SlidersHorizontal, Users, AlertTriangle, Loader2, RefreshCw, X } from 'lucide-react';
import { KanbanColumn } from './KanbanColumn';
import { KanbanCard } from './KanbanCard';
import { useKanbanStore, type SwimlaneMode, type WipMode } from '@/stores/kanbanStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const PRIORITY_OPTIONS = [
  { value: 'highest', label: '🔴 Highest' },
  { value: 'high', label: '🟠 High' },
  { value: 'medium', label: '🟡 Medium' },
  { value: 'low', label: '🔵 Low' },
  { value: 'lowest', label: '⚪ Lowest' },
];

interface KanbanBoardProps {
  projectId?: string;
}

export function KanbanBoard({ projectId }: KanbanBoardProps) {
  const {
    columns, isLoading, error, filters, swimlaneMode, wipMode,
    fetchBoard, moveTask, getFilteredColumns, setFilters, clearFilters,
    setSwimlaneMode, setWipMode, isWipExceeded,
  } = useKanbanStore();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Load the board on mount / project change
  useEffect(() => {
    if (projectId) {
      fetchBoard(projectId);
    }
  }, [projectId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Find the dragged task across all columns
  const activeTask = useMemo(() => {
    if (!activeId) return null;
    for (const col of columns) {
      const t = col.tasks.find((x) => x.id === activeId);
      if (t) return t;
    }
    return null;
  }, [activeId, columns]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const activeIdStr = active.id as string;
    const overIdStr = over.id as string;

    // Find source column
    const sourceCol = columns.find((c) => c.tasks.some((t) => t.id === activeIdStr));
    if (!sourceCol) return;

    // Find target column — dropped over a column id or a task id
    let targetCol = columns.find((c) => c.id === overIdStr);
    if (!targetCol) targetCol = columns.find((c) => c.tasks.some((t) => t.id === overIdStr));
    if (!targetCol) return;

    // Hard WIP check
    if (sourceCol.id !== targetCol.id && wipMode === 'hard' && isWipExceeded(targetCol.id)) {
      return; // blocked — column header will show a red indicator
    }

    // Calculate new position
    let newPosition: number;
    if (targetCol.id === sourceCol.id) {
      // reorder within same column
      const oldIdx = sourceCol.tasks.findIndex((t) => t.id === activeIdStr);
      const newIdx = sourceCol.tasks.findIndex((t) => t.id === overIdStr);
      if (oldIdx === newIdx) return;
      newPosition = newIdx;
    } else {
      const overTaskIdx = targetCol.tasks.findIndex((t) => t.id === overIdStr);
      newPosition = overTaskIdx >= 0 ? overTaskIdx : targetCol.tasks.length;
    }

    moveTask(activeIdStr, sourceCol.id, targetCol.id, newPosition);
  }, [columns, wipMode, moveTask, isWipExceeded]);

  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }),
  };

  const filteredColumns = useMemo(() => getFilteredColumns(), [columns, filters]);
  const hasActiveFilters = filters.search || filters.priority || filters.assigneeId || filters.labelId;

  if (!projectId) {
    return (
      <div className="flex items-center justify-center min-h-[420px] text-gray-400 text-sm">
        Select a project above to view its Kanban board.
      </div>
    );
  }

  if (isLoading && columns.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[420px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-9 h-9 text-indigo-500 animate-spin" />
          <p className="text-sm text-gray-500">Loading board…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[420px]">
        <div className="text-center space-y-3">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
          <p className="text-gray-600 text-sm">{error}</p>
          <Button size="sm" variant="outline" onClick={() => fetchBoard(projectId)}>
            <RefreshCw className="w-4 h-4 mr-2" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <Input
            placeholder="Search cards…"
            value={filters.search}
            onChange={(e) => setFilters({ search: e.target.value })}
            className="pl-8 h-8 text-sm"
          />
        </div>

        {/* Filter toggle */}
        <Button
          size="sm"
          variant={showFilters ? 'secondary' : 'outline'}
          className="h-8 gap-1.5"
          onClick={() => setShowFilters((v) => !v)}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filters
          {hasActiveFilters && (
            <Badge className="ml-1 h-4 px-1 text-[10px] bg-indigo-500 text-white">!</Badge>
          )}
        </Button>

        {hasActiveFilters && (
          <Button size="sm" variant="ghost" className="h-8 gap-1 text-gray-400" onClick={clearFilters}>
            <X className="w-3.5 h-3.5" /> Clear
          </Button>
        )}

        <div className="flex-1" />

        {/* Swimlane selector */}
        <div className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-gray-400" />
          <Select value={swimlaneMode} onValueChange={(v) => setSwimlaneMode(v as SwimlaneMode)}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Swimlanes</SelectItem>
              <SelectItem value="priority">By Priority</SelectItem>
              <SelectItem value="assignee">By Assignee</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* WIP mode */}
        <Select value={wipMode} onValueChange={(v) => setWipMode(v as WipMode)}>
          <SelectTrigger className="h-8 w-28 text-xs">
            <SelectValue placeholder="WIP Mode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="visual">WIP: Visual</SelectItem>
            <SelectItem value="soft">WIP: Soft</SelectItem>
            <SelectItem value="hard">WIP: Hard</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Expanded filter row */}
      {showFilters && (
        <div className="flex flex-wrap gap-2 p-3 rounded-lg bg-gray-50 border border-gray-200">
          <Select value={filters.priority || 'all'} onValueChange={(v) => setFilters({ priority: v === 'all' ? '' : v })}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue placeholder="All Priorities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              {PRIORITY_OPTIONS.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* ── Board ────────────────────────────────────────────────────────── */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className={cn(
          'flex gap-4 overflow-x-auto pb-4',
          'min-h-[calc(100vh-340px)]',
        )}>
          {filteredColumns.map((col) => (
            <KanbanColumn
              key={col.id}
              id={col.id}
              name={col.name}
              color={col.color}
              wipLimit={col.wipLimit}
              wipMode={wipMode}
              swimlaneMode={swimlaneMode}
              tasks={col.tasks}
              count={col.taskCount}
              projectId={projectId}
            />
          ))}

          {filteredColumns.length === 0 && (
            <div className="flex items-center justify-center w-full text-gray-400 text-sm">
              No columns found for this board.
            </div>
          )}
        </div>

        <DragOverlay dropAnimation={dropAnimation}>
          {activeTask ? <KanbanCard task={activeTask} isDragging /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
