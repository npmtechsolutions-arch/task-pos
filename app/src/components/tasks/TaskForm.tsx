import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useTaskStore, useProjectStore, useAuthStore, useUIStore } from '@/stores';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { TASK_PRIORITIES, TASK_STATUSES } from '@/lib/constants';

const taskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500, 'Title is too long'),
  description: z.string().optional(),
  projectId: z.string().min(1, 'Project is required'),
  status: z.enum(['todo', 'in_progress', 'review', 'done']),
  priority: z.enum(['lowest', 'low', 'medium', 'high', 'highest']),
  assigneeId: z.string().optional(),
  dueDate: z.date().optional(),
  estimatedHours: z.number().min(0).optional(),
});

type TaskFormData = z.infer<typeof taskSchema>;

interface TaskFormProps {
  onSuccess?: () => void;
  defaultProjectId?: string;
}

// Mock users for assignee selection
const mockUsers = [
  { id: '1', name: 'Admin User' },
  { id: '2', name: 'John Doe' },
  { id: '3', name: 'Jane Smith' },
  { id: '4', name: 'Bob Wilson' },
];

export function TaskForm({ onSuccess, defaultProjectId }: TaskFormProps) {
  const { addTask } = useTaskStore();
  const { projects } = useProjectStore();
  const { user } = useAuthStore();
  const { addToast } = useUIStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      status: 'todo',
      priority: 'medium',
      projectId: defaultProjectId || '',
    },
  });

  const dueDate = watch('dueDate');

  const onSubmit = async (data: TaskFormData) => {
    setIsSubmitting(true);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Get project details
      const project = projects.find(p => p.id === data.projectId);
      if (!project) throw new Error('Project not found');
      
      // Get assignee details
      const actualAssigneeId = data.assigneeId === 'unassigned' ? undefined : data.assigneeId;
      const assignee = actualAssigneeId ? mockUsers.find(u => u.id === actualAssigneeId) : null;
      
      // Create new task
      const newTask = {
        id: `t${Date.now()}`,
        taskNumber: Math.floor(Math.random() * 1000),
        title: data.title,
        description: data.description,
        status: data.status,
        priority: data.priority,
        project: project as any,
        projectId: data.projectId,
        assignee: assignee ? {
          id: assignee.id,
          email: '',
          firstName: assignee.name.split(' ')[0],
          lastName: assignee.name.split(' ')[1] || '',
          isActive: true,
          timezone: 'UTC',
          language: 'en',
          role: 'member',
          createdAt: new Date().toISOString(),
        } : undefined,
        assigneeId: actualAssigneeId,
        reporter: user!,
        reporterId: user!.id,
        labels: [],
        dueDate: data.dueDate?.toISOString(),
        estimatedHours: data.estimatedHours,
        actualHours: 0,
        attachments: [],
        comments: [],
        dependencies: [],
        subtasks: [],
        customFields: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      addTask(newTask as any);
      
      addToast({
        type: 'success',
        title: 'Task created successfully',
      });
      
      onSuccess?.();
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Failed to create task',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          placeholder="Enter task title"
          {...register('title')}
          className={cn(errors.title && 'border-red-500')}
        />
        {errors.title && (
          <p className="text-sm text-red-500">{errors.title.message}</p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="Enter task description"
          rows={3}
          {...register('description')}
        />
      </div>

      {/* Project & Status Row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="project">Project *</Label>
          <Select
            onValueChange={(value) => setValue('projectId', value)}
            defaultValue={defaultProjectId}
          >
            <SelectTrigger className={cn(errors.projectId && 'border-red-500')}>
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.projectId && (
            <p className="text-sm text-red-500">{errors.projectId.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select
            onValueChange={(value: any) => setValue('status', value)}
            defaultValue="todo"
          >
            <SelectTrigger>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {TASK_STATUSES.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Priority & Assignee Row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="priority">Priority</Label>
          <Select
            onValueChange={(value: any) => setValue('priority', value)}
            defaultValue="medium"
          >
            <SelectTrigger>
              <SelectValue placeholder="Select priority" />
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

        <div className="space-y-2">
          <Label htmlFor="assignee">Assignee</Label>
          <Select
            onValueChange={(value) => setValue('assigneeId', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {mockUsers.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Due Date & Estimated Hours Row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Due Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !dueDate && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dueDate ? format(dueDate, 'PPP') : 'Pick a date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dueDate}
                onSelect={(date) => setValue('dueDate', date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label htmlFor="estimatedHours">Estimated Hours</Label>
          <Input
            id="estimatedHours"
            type="number"
            min="0"
            step="0.5"
            placeholder="e.g., 4"
            {...register('estimatedHours', { valueAsNumber: true })}
          />
        </div>
      </div>

      {/* Submit Buttons */}
      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onSuccess}>
          Cancel
        </Button>
        <Button 
          type="submit" 
          className="bg-blue-600 hover:bg-blue-700"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Creating...' : 'Create Task'}
        </Button>
      </div>
    </form>
  );
}
