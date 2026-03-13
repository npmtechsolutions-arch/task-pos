import { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Paperclip, 
  Calendar,
  MoreHorizontal,
  Edit,
  Trash2,
  Share,
  Link as LinkIcon,
  CheckSquare
} from 'lucide-react';
import { cn, formatDate, formatDuration, getPriorityColor, getStatusLabel } from '@/lib/utils';
import { useTaskStore, useUIStore } from '@/stores';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TASK_PRIORITIES, TASK_STATUSES } from '@/lib/constants';

interface TaskDetailProps {
  taskId: string;
}

// Mock users for assignee selection
const mockUsers = [
  { id: '1', name: 'Admin User', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin' },
  { id: '2', name: 'John Doe', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=john' },
  { id: '3', name: 'Jane Smith', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=jane' },
  { id: '4', name: 'Bob Wilson', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=bob' },
];

export function TaskDetail({ taskId }: TaskDetailProps) {
  const { getTaskById, updateTask, moveTask, fetchTaskDetail } = useTaskStore();
  const { addToast } = useUIStore();
  const [comment, setComment] = useState('');
  
  useEffect(() => {
    if (taskId) {
      fetchTaskDetail(taskId);
    }
  }, [taskId, fetchTaskDetail]);
  
  const task = getTaskById(taskId);
  
  if (!task) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Task not found</p>
      </div>
    );
  }

  const handleStatusChange = (status: string) => {
    moveTask(task.id, status as any);
    addToast({
      type: 'success',
      title: `Task moved to ${getStatusLabel(status)}`,
    });
  };

  const handlePriorityChange = (priority: string) => {
    updateTask(task.id, { priority: priority as any });
  };

  const handleAssigneeChange = (assigneeId: string) => {
    const actualAssigneeId = assigneeId === 'unassigned' ? undefined : assigneeId;
    const assignee = actualAssigneeId ? mockUsers.find(u => u.id === actualAssigneeId) : null;
    updateTask(task.id, { 
      assigneeId: actualAssigneeId,
      assignee: assignee ? {
        id: assignee.id,
        email: '',
        firstName: assignee.name.split(' ')[0],
        lastName: assignee.name.split(' ')[1] || '',
        fullName: assignee.name,
        avatarUrl: assignee.avatar,
        isActive: true,
        timezone: 'UTC',
        language: 'en',
        role: 'member',
        createdAt: new Date().toISOString(),
      } : undefined,
    });
  };

  const handleAddComment = () => {
    if (!comment.trim()) return;
    
    addToast({
      type: 'success',
      title: 'Comment added',
    });
    setComment('');
  };

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'done';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm text-gray-500">
              {task.project.key}-{task.taskNumber}
            </span>
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: getPriorityColor(task.priority) }}
            />
            <span className="text-sm text-gray-500 capitalize">{task.priority} priority</span>
          </div>
          <h2 className="text-xl font-semibold text-gray-900">{task.title}</h2>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon">
            <Share className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon">
            <LinkIcon className="w-4 h-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem>
                <CheckSquare className="w-4 h-4 mr-2" />
                Mark as Complete
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-600">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2 space-y-6">
          {/* Description */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Description</h3>
            {task.description ? (
              <p className="text-gray-600 whitespace-pre-wrap">{task.description}</p>
            ) : (
              <p className="text-gray-400 italic">No description provided</p>
            )}
          </div>

          {/* Subtasks */}
          {task.subtasks && task.subtasks.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Subtasks ({task.subtasks.filter(s => s.status === 'done').length}/{task.subtasks.length})
              </h3>
              <div className="space-y-2">
                {task.subtasks.map((subtask) => (
                  <div
                    key={subtask.id}
                    className="flex items-center gap-2 p-2 rounded hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={subtask.status === 'done'}
                      className="rounded border-gray-300"
                      readOnly
                    />
                    <span className={cn(
                      'text-sm',
                      subtask.status === 'done' && 'line-through text-gray-400'
                    )}>
                      {subtask.title}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Attachments */}
          {task.attachments.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Attachments ({task.attachments.length})
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {task.attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center gap-2 p-2 rounded border border-gray-200 hover:bg-gray-50"
                  >
                    <Paperclip className="w-4 h-4 text-gray-400" />
                    <span className="text-sm truncate">{attachment.filename}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Dependencies */}
          {task.dependencies && task.dependencies.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Dependencies ({task.dependencies.length})
              </h3>
              <div className="space-y-2">
                {task.dependencies.map((dep) => {
                  const relatedTask = getTaskById(dep.dependsOnId);
                  return (
                    <div
                      key={dep.id}
                      className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 bg-white hover:border-gray-200 transition-colors shadow-sm"
                    >
                      <LinkIcon className="w-4 h-4 text-gray-400 shrink-0" />
                      <div>
                        <Badge variant="secondary" className="text-[10px] uppercase font-semibold mb-1 tracking-wider block w-max">
                          {dep.dependencyType.replace('_', ' ')}
                        </Badge>
                        <p className="text-sm text-gray-800 font-medium leading-none">
                          {relatedTask ? relatedTask.title : `Task #${dep.dependsOnId.substring(0, 8)}`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <Separator />

          {/* Comments */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-4">
              Comments ({task.comments.length})
            </h3>
            
            {/* Add Comment */}
            <div className="space-y-3 mb-6">
              <Textarea
                placeholder="Add a comment..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
              />
              <div className="flex justify-end">
                <Button 
                  onClick={handleAddComment}
                  disabled={!comment.trim()}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Add Comment
                </Button>
              </div>
            </div>

            {/* Comments List */}
            {task.comments.length > 0 ? (
              <div className="space-y-4">
                {task.comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={comment.author.avatarUrl} />
                      <AvatarFallback className="bg-blue-600 text-white text-xs">
                        {comment.author.firstName[0]}{comment.author.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {comment.author.firstName} {comment.author.lastName}
                        </span>
                        <span className="text-xs text-gray-400">
                          {formatDate(comment.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{comment.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-sm text-center py-4">
                No comments yet. Be the first to comment!
              </p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status */}
          <div>
            <Label className="text-sm text-gray-500">Status</Label>
            <Select
              value={task.status}
              onValueChange={handleStatusChange}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_STATUSES.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: status.color }}
                      />
                      {status.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Assignee */}
          <div>
            <Label className="text-sm text-gray-500">Assignee</Label>
            <Select
              value={task.assigneeId || ''}
              onValueChange={handleAssigneeChange}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {mockUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    <div className="flex items-center gap-2">
                      <Avatar className="w-5 h-5">
                        <AvatarImage src={user.avatar} />
                        <AvatarFallback className="text-[10px]">
                          {user.name[0]}
                        </AvatarFallback>
                      </Avatar>
                      {user.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Priority */}
          <div>
            <Label className="text-sm text-gray-500">Priority</Label>
            <Select
              value={task.priority}
              onValueChange={handlePriorityChange}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_PRIORITIES.map((priority) => (
                  <SelectItem key={priority.value} value={priority.value}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: priority.color }}
                      />
                      {priority.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Due Date */}
          {task.dueDate && (
            <div>
              <Label className="text-sm text-gray-500">Due Date</Label>
              <div className={cn(
                'flex items-center gap-2 mt-1 text-sm',
                isOverdue ? 'text-red-600' : 'text-gray-700'
              )}>
                <Calendar className="w-4 h-4" />
                <span>{formatDate(task.dueDate, 'MMM d, yyyy')}</span>
                {isOverdue && <span className="text-xs">(Overdue)</span>}
              </div>
            </div>
          )}

          {/* Time Tracking */}
          <div>
            <Label className="text-sm text-gray-500">Time Tracking</Label>
            <div className="mt-1 space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Estimated:</span>
                <span className="font-medium">
                  {task.estimatedHours ? formatDuration(task.estimatedHours) : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Logged:</span>
                <span className="font-medium">{formatDuration(task.actualHours)}</span>
              </div>
              {task.estimatedHours && (
                <div className="mt-2">
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        task.actualHours > task.estimatedHours
                          ? 'bg-red-500'
                          : 'bg-blue-500'
                      )}
                      style={{
                        width: `${Math.min(
                          (task.actualHours / task.estimatedHours) * 100,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Labels */}
          {task.labels.length > 0 && (
            <div>
              <Label className="text-sm text-gray-500">Labels</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {task.labels.map((label) => (
                  <Badge
                    key={label.id}
                    variant="secondary"
                    style={{
                      backgroundColor: `${label.color}20`,
                      color: label.color,
                    }}
                  >
                    {label.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Reporter */}
          <div>
            <Label className="text-sm text-gray-500">Reporter</Label>
            <div className="flex items-center gap-2 mt-1">
              <Avatar className="w-6 h-6">
                <AvatarImage src={task.reporter.avatarUrl} />
                <AvatarFallback className="bg-blue-600 text-white text-[10px]">
                  {task.reporter.firstName[0]}{task.reporter.lastName[0]}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm text-gray-700">
                {task.reporter.firstName} {task.reporter.lastName}
              </span>
            </div>
          </div>

          {/* Created */}
          <div>
            <Label className="text-sm text-gray-500">Created</Label>
            <p className="text-sm text-gray-700 mt-1">
              {formatDate(task.createdAt, 'MMM d, yyyy')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
