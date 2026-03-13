import { useDroppable } from '@dnd-kit/core';
import { Plus } from 'lucide-react';
import { cn, getStatusBgColor } from '@/lib/utils';
import type { TaskStatus } from '@/types';
import type { KanbanTaskCard } from '@/api/kanban';
import { Button } from '@/components/ui/button';
import { KanbanCard } from './KanbanCard';

interface KanbanColumnProps {
  id: string; // Now mapping to the DB column id instead of task status directly for dnd
  title: string;
  tasks: KanbanTaskCard[];
  count: number;
}

export function KanbanColumn({ id, title, tasks, count }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
  });

  // We fallback to checking if it's a standard status for the UI color, otherwise default
  const statusColor = getStatusBgColor(id as TaskStatus) || 'bg-gray-100 text-gray-800';

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'w-80 flex-shrink-0 flex flex-col rounded-lg transition-colors',
        isOver && 'bg-blue-50/50'
      )}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between px-3 py-2 mb-2">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <span
            className={cn(
              'px-2 py-0.5 text-xs font-medium rounded-full',
              statusColor
            )}
          >
            {count}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-gray-400 hover:text-gray-600"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* Column Content */}
      <div className="flex-1 bg-gray-100/50 rounded-lg p-2 min-h-[200px]">
        <div className="space-y-2">
          {tasks.map((task) => (
            <KanbanCard key={task.id} task={task} />
          ))}
        </div>

        {tasks.length === 0 && (
          <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
            No tasks
          </div>
        )}
      </div>
    </div>
  );
}

