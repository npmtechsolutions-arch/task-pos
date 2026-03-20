import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CheckSquare, MoreHorizontal, Clock, Calendar, Loader2 } from 'lucide-react';
import { cn, formatDueDate, getPriorityColor, getStatusBgColor, getStatusLabel } from '@/lib/utils';
import { useTaskStore, useAuthStore } from '@/stores';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import type { Task } from '@/types';

interface TaskItemProps {
  task: Task;
  onToggle: (taskId: string, completed: boolean) => void;
}

function TaskItem({ task, onToggle }: TaskItemProps) {
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'done';
  
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
      <Checkbox
        checked={task.status === 'done'}
        onCheckedChange={(checked) => onToggle(task.id, checked as boolean)}
        className="mt-0.5"
      />
      
      <div className="flex-1 min-w-0">
        <Link
          to={`/tasks/${task.id}`}
          className={cn(
            'text-sm font-medium hover:text-blue-600 transition-colors',
            task.status === 'done' && 'line-through text-gray-400'
          )}
        >
          {task.title}
        </Link>
        
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <Badge variant="secondary" className={cn('text-xs', getStatusBgColor(task.status))}>
            {getStatusLabel(task.status)}
          </Badge>
          
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: getPriorityColor(task.priority) }}
            title={`Priority: ${task.priority}`}
          />
          
          <span className="text-xs text-gray-500">{task.project.key}-{task.taskNumber}</span>
          
          {task.dueDate && (
            <div className={cn(
              'flex items-center gap-1 text-xs',
              isOverdue ? 'text-red-500' : 'text-gray-500'
            )}>
              <Calendar className="w-3 h-3" />
              <span>{formatDueDate(task.dueDate)}</span>
            </div>
          )}
          
          {task.estimatedHours && (
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Clock className="w-3 h-3" />
              <span>{task.estimatedHours}h</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface MyTasksWidgetProps {
  limit?: number;
}

export function MyTasksWidget({ limit = 5 }: MyTasksWidgetProps) {
  const { user } = useAuthStore();
  const { tasks, updateTask, fetchTasks, isLoading } = useTaskStore();

  // Fetch tasks for current user independently when the widget mounts
  useEffect(() => {
    if (user?.id) {
      fetchTasks({ primary_assignee_id: user.id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Get tasks assigned to current user, sorted by due date
  const myTasks = tasks
    .filter((task) => task.primaryAssigneeId === user?.id && task.status !== 'done')
    .sort((a, b) => {
      // Sort by due date (nulls last), then by priority
      if (a.dueDate && b.dueDate) {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;

      const priorityOrder = { highest: 0, high: 1, medium: 2, low: 3, lowest: 4 };
      return (priorityOrder as any)[a.priority] - (priorityOrder as any)[b.priority];
    })
    .slice(0, limit);

  const handleToggleTask = (taskId: string, completed: boolean) => {
    updateTask(taskId, {
      status: completed ? 'done' : 'todo',
      completedAt: completed ? new Date().toISOString() : undefined,
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <CheckSquare className="w-5 h-5 text-blue-600" />
          <CardTitle className="text-lg font-semibold">My Tasks</CardTitle>
        </div>
        <Button variant="ghost" size="icon">
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
          </div>
        ) : myTasks.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500">No tasks assigned to you</p>
            <Button variant="link" className="text-blue-600 mt-2" asChild>
              <Link to="/tasks">View all tasks</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-100">
              {myTasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onToggle={handleToggleTask}
                />
              ))}
            </div>
            
            <Button variant="ghost" className="w-full mt-4 text-blue-600 hover:text-blue-700" asChild>
              <Link to="/tasks">View all tasks</Link>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
