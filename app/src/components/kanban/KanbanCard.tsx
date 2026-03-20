import { useState, memo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MessageSquare, Clock, Calendar, MoreHorizontal, Trash2, ExternalLink, AlertCircle } from 'lucide-react';
import { cn, formatDueDate, getPriorityColor } from '@/lib/utils';
import type { KanbanTaskCard } from '@/api/kanban';
import { useKanbanStore } from '@/stores/kanbanStore';
import { useUIStore } from '@/stores';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNavigate } from 'react-router-dom';

interface KanbanCardProps {
  task: KanbanTaskCard;
  isDragging?: boolean;
}

const PRIORITY_LABELS: Record<string, string> = {
  highest: 'Highest',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  lowest: 'Lowest',
};

export const KanbanCard = memo(function KanbanCard({ task, isDragging: isOverlay }: KanbanCardProps) {
  const { deleteTask } = useKanbanStore();
  const { addToast } = useUIStore();
  const navigate = useNavigate();
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { type: 'Task', task },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    willChange: 'transform',
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${task.title}"?`)) return;
    setIsDeleting(true);
    try {
      await deleteTask(task.id);
      addToast({ type: 'success', title: 'Task deleted', message: task.title });
    } catch {
      addToast({ type: 'error', title: 'Delete failed', message: 'Could not delete the task.' });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleViewDetail = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/tasks/${task.id}`);
  };

  // Ghost while dragging
  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="bg-white/50 border-2 border-dashed border-indigo-300 rounded-lg h-16"
      />
    );
  }

  // Overlay (floating card over board)
  if (isOverlay) {
    return (
      <div className="bg-white p-3 rounded-lg border border-indigo-400 shadow-2xl rotate-1 opacity-95">
        <p className="font-medium text-sm text-gray-900 line-clamp-2">{task.title}</p>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'group bg-white rounded-lg border border-gray-200 shadow-sm p-3',
        'hover:shadow-md hover:border-indigo-300 transition-all duration-150',
        'cursor-grab active:cursor-grabbing select-none',
        isDeleting && 'opacity-50 pointer-events-none',
        task.isOverdue && 'border-l-2 border-l-red-400',
      )}
    >
      {/* Header: ID, priority dot, menu */}
      <div className="flex items-center justify-between gap-1.5 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[10px] text-gray-400 font-mono">#{task.id.slice(0, 5)}</span>
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: getPriorityColor(task.priority) }}
            title={`Priority: ${PRIORITY_LABELS[task.priority as string] ?? task.priority}`}
          />
          {task.isOverdue && (
            <AlertCircle className="w-3 h-3 text-red-500 flex-shrink-0" aria-label="Overdue" />
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreHorizontal className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="text-sm">
            <DropdownMenuItem onClick={handleViewDetail}>
              <ExternalLink className="w-3.5 h-3.5 mr-2" /> View Details
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleDelete}
              className="text-red-600 focus:text-red-600 focus:bg-red-50"
            >
              <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Title */}
      <p className="font-medium text-sm text-gray-900 mb-2.5 line-clamp-2 leading-snug">
        {task.title}
      </p>

      {/* Labels */}
      {task.labels?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2.5">
          {task.labels.slice(0, 3).map((lbl) => (
            <span
              key={lbl.id}
              className="inline-flex items-center h-4 px-1.5 rounded text-[10px] font-medium"
              style={{ backgroundColor: `${lbl.color}22`, color: lbl.color }}
            >
              {lbl.name}
            </span>
          ))}
          {task.labels.length > 3 && (
            <span className="text-[10px] text-gray-400">+{task.labels.length - 3}</span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-1">
        <div className="flex items-center gap-2">
          {/* Assignee */}
          {task.primaryAssignee ? (
            <Avatar className="w-5 h-5" title={task.primaryAssignee.fullName}>
              <AvatarImage src={task.primaryAssignee.avatarUrl} />
              <AvatarFallback className="bg-indigo-600 text-white text-[8px]">
                {task.primaryAssignee.firstName?.[0]}{task.primaryAssignee.lastName?.[0]}
              </AvatarFallback>
            </Avatar>
          ) : (
            <div className="w-5 h-5 rounded-full bg-gray-100 border border-gray-200" title="Unassigned" />
          )}

          {/* Multiple assignees badge */}
          {task.assigneeCount > 1 && (
            <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center -ml-2 border border-white">
              <span className="text-gray-500 text-[8px] font-medium">+{task.assigneeCount - 1}</span>
            </div>
          )}

          {/* Due date */}
          {task.dueDate && (
            <div className={cn(
              'flex items-center gap-0.5 text-[10px]',
              task.isOverdue ? 'text-red-500 font-medium' : 'text-gray-400',
            )}>
              <Calendar className="w-2.5 h-2.5" />
              {formatDueDate(task.dueDate)}
            </div>
          )}
        </div>

        {/* Meta */}
        <div className="flex items-center gap-2 text-gray-400">
          {task.estimatedHours && (
            <div className="flex items-center gap-0.5 text-[10px]">
              <Clock className="w-2.5 h-2.5" />
              {task.estimatedHours}h
            </div>
          )}
          {task.commentCount > 0 && (
            <div className="flex items-center gap-0.5 text-[10px]">
              <MessageSquare className="w-2.5 h-2.5" />
              {task.commentCount}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
