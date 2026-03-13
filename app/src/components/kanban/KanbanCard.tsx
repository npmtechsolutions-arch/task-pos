import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
  MessageSquare, 
  Clock, 
  Calendar,
  MoreHorizontal
} from 'lucide-react';
import { cn, formatDueDate, getPriorityColor } from '@/lib/utils';
import type { KanbanTaskCard } from '@/api/kanban';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TaskDetail } from '@/components/tasks/TaskDetail';

interface KanbanCardProps {
  task: KanbanTaskCard;
  isDragging?: boolean;
}

export function KanbanCard({ task, isDragging: isOverlayDragging }: KanbanCardProps) {
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: {
      type: 'Task',
      task,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  if (isDragging || isOverlayDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="bg-white p-4 rounded-lg shadow-lg border-2 border-blue-400 opacity-90 rotate-2"
      >
        <p className="font-medium text-gray-900">{task.title}</p>
      </div>
    );
  }

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className={cn(
          'group bg-white p-3 rounded-lg border border-gray-200 shadow-sm',
          'hover:shadow-md hover:border-blue-300 transition-all cursor-grab active:cursor-grabbing'
        )}
        onClick={() => setIsDetailOpen(true)}
      >
        {/* Card Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-xs text-gray-500 font-medium">
             {/* Note: The backend KanbanTaskCard doesn't embed the project key/task number right now, using ID suffix */}
              #{task.id.slice(0, 5)}
            </span>
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: getPriorityColor(task.priority) }}
              title={`Priority: ${task.priority}`}
            />
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreHorizontal className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setIsDetailOpen(true); }}>
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                Edit Task
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => e.stopPropagation()} className="text-red-600">
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Card Title */}
        <h4 className="font-medium text-gray-900 mb-3 line-clamp-2">
          {task.title}
        </h4>

        {/* Labels */}
        {task.labels && task.labels.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {task.labels.map((label) => (
              <Badge
                key={label.id}
                variant="secondary"
                className="text-xs"
                style={{ 
                  backgroundColor: `${label.color}20`,
                  color: label.color,
                  borderColor: label.color,
                }}
              >
                {label.name}
              </Badge>
            ))}
          </div>
        )}

        {/* Card Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Assignee */}
            {task.assignee ? (
              <Avatar className="w-6 h-6" title={task.assignee.fullName}>
                <AvatarImage src={task.assignee.avatarUrl} />
                <AvatarFallback className="bg-blue-600 text-white text-[10px]">
                  {task.assignee.firstName[0]}{task.assignee.lastName[0]}
                </AvatarFallback>
              </Avatar>
            ) : (
              <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                <span className="text-gray-400 text-xs">?</span>
              </div>
            )}

            {/* Multiple Assignees visual hint */}
            {task.assigneeCount > 1 && (
               <div className="w-6 h-6 rounded-full bg-gray-100 border border-white flex items-center justify-center -ml-2">
                 <span className="text-gray-500 text-[10px]">+{task.assigneeCount - 1}</span>
               </div>
            )}

            {/* Due Date */}
            {task.dueDate && (
              <div className={cn(
                'flex items-center gap-1 text-xs',
                task.isOverdue ? 'text-red-500' : 'text-gray-500'
              )}>
                <Calendar className="w-3 h-3" />
                <span>{formatDueDate(task.dueDate)}</span>
              </div>
            )}
          </div>

          {/* Meta Info */}
          <div className="flex items-center gap-2 text-gray-400">
            {task.estimatedHours && (
              <div className="flex items-center gap-1 text-xs">
                <Clock className="w-3 h-3" />
                <span>{task.estimatedHours}h</span>
              </div>
            )}
            
            {task.commentCount > 0 && (
              <div className="flex items-center gap-1 text-xs">
                <MessageSquare className="w-3 h-3" />
                <span>{task.commentCount}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Task Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="sr-only">Task Details</DialogTitle>
          </DialogHeader>
          <TaskDetail taskId={task.id} />
        </DialogContent>
      </Dialog>
    </>
  );
}
