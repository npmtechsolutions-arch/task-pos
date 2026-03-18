import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  MessageSquare, 
  Paperclip, 
  Calendar,
  MoreHorizontal,
  Edit,
  Trash2,
  Share,
  Link as LinkIcon,
  CheckSquare,
  Plus,
  X,
  CheckCircle2
} from 'lucide-react';
import { cn, formatDate, formatDuration, getPriorityColor } from '@/lib/utils';
import { useTaskStore, useUIStore, useTeamStore, useTimeStore } from '@/stores';
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

export function TaskDetail({ taskId: taskIdProp }: { taskId?: string } = {}) {
  const { taskId: routeTaskId } = useParams<{ taskId: string }>();
  const taskId = taskIdProp ?? routeTaskId;
  const { getTaskById, updateTask, fetchTaskDetail, addSubtask, deleteSubtask, transitionTask, fetchTaskWorkflows } = useTaskStore();
  const { allUsers, fetchAllUsers } = useTeamStore();
  const { logTime } = useTimeStore();
  const { addToast } = useUIStore();
  
  const [comment, setComment] = useState('');
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [isLoggingTime, setIsLoggingTime] = useState(false);
  const [logHours, setLogHours] = useState('1.0');
  const [logDescription, setLogDescription] = useState('');
  
  useEffect(() => {
    if (taskId) {
      fetchTaskDetail(taskId);
      if (allUsers.length === 0) {
        fetchAllUsers();
      }
    }
  }, [taskId, fetchTaskDetail, allUsers.length, fetchAllUsers]);
  
  const task = getTaskById(taskId || '');
  
  useEffect(() => {
    if (task?.projectId) {
      fetchTaskWorkflows(task.projectId).then(setWorkflows);
    }
  }, [task?.projectId, fetchTaskWorkflows]);
  
  if (!task) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Task not found</p>
      </div>
    );
  }

  const handlePriorityChange = (priority: string) => {
    updateTask(task.id, { priority: priority as any });
  };

  const handleAssigneeChange = (assigneeId: string) => {
    const actualAssigneeId = assigneeId === 'unassigned' ? undefined : assigneeId;
    updateTask(task.id, { 
      primaryAssigneeId: actualAssigneeId,
    });
  };

  const handleAddSubtask = async () => {
    if (!newSubtaskTitle.trim()) return;
    await addSubtask(task.id, newSubtaskTitle);
    setNewSubtaskTitle('');
    setIsAddingSubtask(false);
    addToast({ type: 'success', title: 'Subtask added' });
  };

  const handleWorkflowTransition = async (stateId: string) => {
    await transitionTask(task.id, stateId);
    addToast({ type: 'success', title: 'Task status updated' });
  };

  const handleAddComment = () => {
    if (!comment.trim()) return;
    addToast({ type: 'success', title: 'Comment added' });
    setComment('');
  };

  const handleLogTime = async () => {
    try {
      await logTime(task.id, parseFloat(logHours), logDescription);
      setIsLoggingTime(false);
      setLogHours('1.0');
      setLogDescription('');
      addToast({ type: 'success', title: 'Time logged successfully' });
      fetchTaskDetail(task.id); // Refresh task to see updated hours
    } catch (err) {
      addToast({ type: 'error', title: 'Failed to log time' });
    }
  };

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'done';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm text-gray-500">
              {task.project?.key || 'TASK'}-{task.taskNumber}
            </span>
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: getPriorityColor(task.priority) }}
            />
            <span className="text-sm text-gray-500 capitalize">{task.priority} priority</span>
          </div>
          <h2 className="text-xl font-semibold text-gray-900">{task.title}</h2>
          
          <div className="flex items-center gap-4 mt-2">
            <div className="flex flex-col">
              <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Priority Score</span>
              <div className="flex items-center gap-1.5">
                <div className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-bold border border-blue-100">
                  {task.priorityScore?.toFixed(1) || '0.0'}
                </div>
                <div className="h-1.5 w-24 bg-gray-100 rounded-full overflow-hidden">
                   <div 
                      className="h-full bg-blue-500 transition-all duration-500" 
                      style={{ width: `${Math.min((task.priorityScore || 0) * 10, 100)}%` }} 
                   />
                </div>
              </div>
            </div>
          </div>
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
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-700">
                Subtasks ({task.subtasks?.filter(s => s.status === 'done').length || 0}/{task.subtasks?.length || 0})
              </h3>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                onClick={() => setIsAddingSubtask(true)}
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Subtask
              </Button>
            </div>
            
            <div className="space-y-1">
              {isAddingSubtask && (
                <div className="flex items-center gap-2 mb-2 p-2 rounded-lg border border-blue-100 bg-blue-50/30">
                  <input
                    autoFocus
                    className="flex-1 bg-transparent border-none text-sm focus:ring-0 placeholder:text-gray-400"
                    placeholder="What needs to be done?"
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask()}
                  />
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-gray-400" onClick={() => setIsAddingSubtask(false)}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" className="h-6 px-2 text-[10px]" onClick={handleAddSubtask}>Add</Button>
                  </div>
                </div>
              )}

              {task.subtasks && task.subtasks.map((subtask) => (
                <div
                  key={subtask.id}
                  className="group flex items-center justify-between p-2 rounded-md hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-4 h-4 rounded border flex items-center justify-center transition-colors cursor-pointer",
                      subtask.status === 'done' ? "bg-green-500 border-green-500" : "border-gray-300"
                    )}>
                      {subtask.status === 'done' && <CheckCircle2 className="w-3 h-3 text-white" />}
                    </div>
                    <span className={cn(
                      'text-sm transition-all',
                      subtask.status === 'done' ? 'line-through text-gray-400' : 'text-gray-700'
                    )}>
                      {subtask.title}
                    </span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500"
                    onClick={() => deleteSubtask(task.id, subtask.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
              
              {(!task.subtasks || task.subtasks.length === 0) && !isAddingSubtask && (
                <p className="text-xs text-gray-400 italic text-center py-2">No subtasks yet</p>
              )}
            </div>
          </div>

          {/* Attachments */}
          {task.attachments && task.attachments.length > 0 && (
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
              Comments ({task.comments?.length || 0})
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
            {task.comments && task.comments.length > 0 ? (
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
          {/* Status / Workflow */}
          <div>
            <Label className="text-sm text-gray-500">Workflow State</Label>
            <Select
              value={task.workflowStateId || task.status}
              onValueChange={handleWorkflowTransition}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {workflows.length > 0 && workflows[0].states ? workflows[0].states.map((state: any) => (
                  <SelectItem key={state.id} value={state.id}>
                    <div className="flex items-center gap-2">
                       <div className="w-2 h-2 rounded-full" style={{ backgroundColor: state.color }} />
                       {state.name}
                    </div>
                  </SelectItem>
                )) : TASK_STATUSES.map((status) => (
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
              value={task.primaryAssigneeId || ''}
              onValueChange={handleAssigneeChange}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {allUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    <div className="flex items-center gap-2">
                      <Avatar className="w-5 h-5">
                        <AvatarImage src={user.avatar_url} />
                        <AvatarFallback className="text-[10px]">
                          {user.first_name?.[0] || '?'}{user.last_name?.[0] || '?'}
                        </AvatarFallback>
                      </Avatar>
                      {user.first_name} {user.last_name}
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
            <div className="flex items-center justify-between mb-1">
              <Label className="text-sm text-gray-500">Time Tracking</Label>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 text-[10px] font-bold"
                onClick={() => setIsLoggingTime(true)}
              >
                Log Time
              </Button>
            </div>

            {isLoggingTime && (
              <div className="mb-4 p-3 rounded-lg border border-blue-100 bg-blue-50/30 space-y-3 animate-in slide-in-from-top-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <Label className="text-[10px] text-gray-400 uppercase font-bold">Hours</Label>
                    <input 
                      type="number" 
                      step="0.5"
                      className="w-full bg-white border border-gray-200 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                      value={logHours}
                      onChange={(e) => setLogHours(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-[10px] text-gray-400 uppercase font-bold">Description (Optional)</Label>
                  <input 
                    className="w-full bg-white border border-gray-200 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                    placeholder="What did you do?"
                    value={logDescription}
                    onChange={(e) => setLogDescription(e.target.value)}
                  />
                </div>
                <div className="flex items-center justify-end gap-2">
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setIsLoggingTime(false)}>Cancel</Button>
                  <Button size="sm" className="h-7 text-xs bg-blue-600" onClick={handleLogTime}>Save Entry</Button>
                </div>
              </div>
            )}

            <div className="mt-1 space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Estimated:</span>
                <span className="font-medium">
                  {task.estimatedHours ? formatDuration(task.estimatedHours) : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Logged:</span>
                <span className="font-medium">{formatDuration(task.actualHours || 0)}</span>
              </div>
              {task.estimatedHours && (
                <div className="mt-2">
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        (task.actualHours || 0) > task.estimatedHours
                          ? 'bg-red-500'
                          : 'bg-blue-500'
                      )}
                      style={{
                        width: `${Math.min(
                          ((task.actualHours || 0) / task.estimatedHours) * 100,
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
          {task.labels && task.labels.length > 0 && (
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
                <AvatarImage src={task.reporter?.avatarUrl} />
                <AvatarFallback className="bg-blue-600 text-white text-[10px]">
                  {task.reporter?.firstName?.[0] || '?'}{task.reporter?.lastName?.[0] || '?'}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm text-gray-700">
                {task.reporter?.firstName} {task.reporter?.lastName}
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
