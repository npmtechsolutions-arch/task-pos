import { useEffect, useState, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
  type DropAnimation,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { KanbanColumn } from './KanbanColumn';
import { KanbanCard } from './KanbanCard';
import { useKanbanStore } from '@/stores';
import { Loader2 } from 'lucide-react';

interface KanbanBoardProps {
  projectId?: string;
}

export function KanbanBoard({ projectId }: KanbanBoardProps) {
  const { columns, isLoading, error, fetchBoard, moveTask } = useKanbanStore();
  const [activeId, setActiveId] = useState<string | null>(null);

  // Load the board dynamically if we have a project ID
  useEffect(() => {
    if (projectId) {
      fetchBoard(projectId);
    }
  }, [projectId, fetchBoard]);

  // Sensors for drag detection
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Find active task across all columns for the drag overlay
  const activeTask = useMemo(() => {
    if (!activeId || !columns) return null;
    for (const column of columns) {
      const task = column.tasks.find((t) => t.id === activeId);
      if (task) return task;
    }
    return null;
  }, [activeId, columns]);

  // Find current column of a task
  const findColumnOfTask = (taskId: string) => {
    return columns.find((c) => c.tasks.some((t) => t.id === taskId));
  };

  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (_event: DragOverEvent) => {
    // handled primarily in handleDragEnd with optimistic insert
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) {
      setActiveId(null);
      return;
    }

    const activeIdStr = active.id as string;
    const overIdStr = over.id as string;

    const sourceCol = findColumnOfTask(activeIdStr);
    
    // Find the target column. It might be we're hovering a column dropzone or another task.
    let targetCol = columns.find((c) => c.id === overIdStr);
    if (!targetCol) {
      // If we dropped over a task, find its column
      targetCol = findColumnOfTask(overIdStr);
    }

    if (sourceCol && targetCol) {
      // Basic position calculation appending to end for now
      // A more robust app would calculate the exact position idx
      const newPosition = targetCol.tasks.length > 0
          ? targetCol.tasks[targetCol.tasks.length - 1].position + 1
          : 0;

      // Only trigger if column changed (or if you calculate exact position, if position changed)
      if (sourceCol.id !== targetCol.id) {
        moveTask(activeIdStr, sourceCol.id, targetCol.id, newPosition);
      }
    }

    setActiveId(null);
  };

  // Drop animation
  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: '0.5',
        },
      },
    }),
  };

  // Default loading & error states
  if (!projectId) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-gray-500">
        Please select a project to view its Kanban board.
      </div>
    );
  }

  if (isLoading && columns.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-red-500">
        Error loading board: {error}
      </div>
    );
  }

  if (columns.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-gray-500">
        No columns defined for this board. Update the board settings.
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[calc(100vh-280px)]">
        {columns.map((col) => (
          <KanbanColumn
            key={col.id}
            id={col.id}
            title={col.name}
            tasks={col.tasks}
            count={col.taskCount}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={dropAnimation}>
        {activeTask ? (
          <KanbanCard task={activeTask} isDragging />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

