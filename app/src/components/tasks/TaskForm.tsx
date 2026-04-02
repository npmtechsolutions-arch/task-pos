import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { CalendarIcon, Clock, User, GitBranch, Loader2, AlertCircle, X } from 'lucide-react';
import { format } from 'date-fns';
import MDEditor from '@uiw/react-md-editor';
import { cn } from '@/lib/utils';
import { useTaskStore, useProjectStore, useUIStore, useAuthStore } from '@/stores';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { TASK_PRIORITIES } from '@/lib/constants';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const taskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500, 'Title is too long'),
  description: z.string().optional(),
  projectId: z.string().min(1, 'Project is required'),
  priority: z.enum(['lowest', 'low', 'medium', 'high', 'highest']),
  assigneeIds: z.array(z.string()).optional(),
  dueDate: z.date().optional(),
  estimatedHours: z.string().optional(),
  parentId: z
    .string()
    .optional()
    .refine(
      (val) => !val || !val.trim() || UUID_REGEX.test(val.trim()),
      { message: 'Parent Task ID must be a valid UUID (e.g. xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)' }
    ),
});

type TaskFormData = z.infer<typeof taskSchema>;

interface Member {
  id: string;
  firstName: string;
  lastName: string;
}

interface TaskFormProps {
  onSuccess?: () => void;
  defaultProjectId?: string;
  parentId?: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  lowest: '#94a3b8',
  low: '#60a5fa',
  medium: '#f59e0b',
  high: '#ef4444',
  highest: '#7c3aed',
};

export function TaskForm({ onSuccess, defaultProjectId, parentId }: TaskFormProps) {
  const { createTask } = useTaskStore();
  const { projects, fetchProjects } = useProjectStore();
  const { addToast } = useUIStore();
  const { user } = useAuthStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState(defaultProjectId || '');
  const [members, setMembers] = useState<Member[]>([]);
  const [isFetchingMembers, setIsFetchingMembers] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      priority: 'medium',
      projectId: defaultProjectId || '',
      parentId: parentId || undefined,
      assigneeIds: user?.id ? [user.id] : [],
    },
  });

  const dueDate = watch('dueDate');
  const assigneeIds = watch('assigneeIds') || [];
  const description = watch('description') || '';

  // Ensure projects are loaded
  useEffect(() => {
    if (projects.length === 0) {
      fetchProjects();
    }
  }, []);

  // When a project is selected → fetch its detail to get members
  useEffect(() => {
    if (!selectedProjectId) {
      setMembers([]);
      return;
    }
    setIsFetchingMembers(true);
    axios
      .get(`${API_URL}/projects/${selectedProjectId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      })
      .then(async (res) => {
        const projectMembers: Member[] = (res.data.members ?? []).map((m: any) => ({
          id: m.user_id ?? m.user?.id,
          firstName: m.user?.first_name ?? m.user?.firstName ?? '',
          lastName: m.user?.last_name ?? m.user?.lastName ?? '',
        }));
        
        if (projectMembers.length > 0) {
          setMembers(projectMembers);
        } else {
          try {
            const allUsersRes = await axios.get(`${API_URL}/users`, {
              headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            const usersList = allUsersRes.data?.items || allUsersRes.data || [];
            setMembers(usersList.map((u: any) => ({
              id: u.id,
              firstName: u.first_name || u.firstName || '',
              lastName: u.last_name || u.lastName || ''
            })));
          } catch (e) {
            console.error('Failed fallback users fetch:', e);
            setMembers([]);
          }
        }
      })
      .catch((err) => {
        console.error('Failed to fetch project members:', err);
        setMembers([]);
      })
      .finally(() => setIsFetchingMembers(false));
  }, [selectedProjectId]);

  // If defaultProjectId is provided, load members immediately
  useEffect(() => {
    if (defaultProjectId) {
      setSelectedProjectId(defaultProjectId);
      setValue('projectId', defaultProjectId);
    }
  }, [defaultProjectId]);

  const onSubmit = async (data: TaskFormData) => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await createTask({
        title: data.title.trim(),
        description: data.description?.trim() || undefined,
        project_id: data.projectId,
        parent_id: data.parentId?.trim() || parentId || null,
        primary_assignee_id: assigneeIds.length > 0 ? assigneeIds[0] : null,
        assignee_ids: assigneeIds,
        priority: data.priority,
        due_date: data.dueDate ? data.dueDate.toISOString() : null,
        estimated_hours: data.estimatedHours ? parseFloat(data.estimatedHours) : null,
      });

      addToast({
        type: 'success',
        title: 'Task created',
        message: `"${data.title}" saved to the database.`,
      });
      onSuccess?.();
    } catch (error: any) {
      // FastAPI 422 returns detail as an array of {loc, msg} objects
      // Regular errors return detail as a string
      let msg = 'Failed to create task';
      const detail = error?.response?.data?.detail;
      if (typeof detail === 'string') {
        msg = detail;
      } else if (Array.isArray(detail) && detail.length > 0) {
        // Flatten FastAPI validation errors into a readable string
        msg = detail
          .map((d: any) => {
            const field = d.loc ? d.loc.slice(1).join(' → ') : '';
            return field ? `${field}: ${d.msg}` : d.msg;
          })
          .join('  |  ');
      } else if (error instanceof Error) {
        msg = error.message;
      }
      setSubmitError(msg);
      addToast({ type: 'error', title: 'Failed to create task', message: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* API Error */}
      {submitError && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{submitError}</span>
        </div>
      )}

      {/* Title */}
      <div className="space-y-1.5">
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          placeholder="What needs to be done?"
          {...register('title')}
          className={cn(errors.title && 'border-red-500')}
          autoFocus
        />
        {errors.title && <p className="text-sm text-red-500">{errors.title.message}</p>}
      </div>

      {/* Description */}
      <div className="space-y-1.5" data-color-mode="light">
        <Label htmlFor="description">Description</Label>
        <MDEditor
          id="description"
          value={description}
          onChange={(val) => setValue('description', val || '')}
          preview="edit"
          height={200}
          className="border border-gray-200 rounded-lg shadow-none"
        />
      </div>

      {/* Project + Priority */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Project *</Label>
          {projects.length === 0 ? (
            <div className="flex items-center gap-2 h-10 px-3 border rounded-md text-sm text-gray-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading projects…
            </div>
          ) : (
            <Select
              onValueChange={(value) => {
                setValue('projectId', value, { shouldValidate: true });
                setSelectedProjectId(value);
              }}
              defaultValue={defaultProjectId}
            >
              <SelectTrigger className={cn(errors.projectId && 'border-red-500')}>
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    <span className="font-mono text-xs text-indigo-600 mr-1">{project.key}</span>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {errors.projectId && (
            <p className="text-sm text-red-500">{errors.projectId.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Priority</Label>
          <Select
            onValueChange={(value: any) => setValue('priority', value)}
            defaultValue="medium"
          >
            <SelectTrigger>
              <SelectValue placeholder="Select priority" />
            </SelectTrigger>
            <SelectContent>
              {TASK_PRIORITIES.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: PRIORITY_COLORS[p.value] }}
                    />
                    {p.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Assignee + Due Date */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1">
            <User className="w-3.5 h-3.5" /> Assignees ({assigneeIds.length})
          </Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start font-normal flex flex-wrap h-auto py-1 min-h-[40px]">
                {assigneeIds.length === 0 ? 'Unassigned' : (
                  <div className="flex flex-wrap gap-1">
                    {assigneeIds.map(uid => {
                      const m = members.find(x => x.id === uid);
                      return m ? (
                        <Badge key={uid} variant="secondary" className="text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 flex items-center gap-1">
                          {m.firstName} {m.lastName}
                          <X className="w-3 h-3 hover:text-indigo-900 cursor-pointer" onClick={(e) => {
                            e.stopPropagation();
                            setValue('assigneeIds', assigneeIds.filter(id => id !== uid));
                          }} />
                        </Badge>
                      ) : null;
                    })}
                  </div>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-2" align="start">
              <div className="font-semibold text-sm mb-2 text-gray-700">Select Assignees</div>
              <div className="max-h-[200px] overflow-y-auto space-y-1">
                {members.map((m) => {
                  const isSelected = assigneeIds.includes(m.id);
                  return (
                    <div 
                      key={m.id} 
                      className={`px-2 py-1.5 text-sm rounded cursor-pointer ${isSelected ? 'bg-indigo-50 text-indigo-700 font-medium' : 'hover:bg-gray-50'}`}
                      onClick={() => {
                        if (isSelected) setValue('assigneeIds', assigneeIds.filter(id => id !== m.id));
                        else setValue('assigneeIds', [...assigneeIds, m.id]);
                      }}
                    >
                      ✓ <span className={!isSelected ? 'opacity-0' : ''}></span> {m.firstName} {m.lastName}
                    </div>
                  );
                })}
                {members.length === 0 && <div className="text-sm text-gray-500 italic p-2">Select a project first</div>}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-1.5">
          <Label className="flex items-center gap-1">
            <CalendarIcon className="w-3.5 h-3.5" /> Due Date
          </Label>
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
      </div>

      {/* Estimated Hours + Parent Task */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="estimatedHours" className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> Estimated Hours
          </Label>
          <Input
            id="estimatedHours"
            type="number"
            min="0"
            step="0.5"
            placeholder="e.g. 4"
            {...register('estimatedHours')}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="parentId" className="flex items-center gap-1">
            <GitBranch className="w-3.5 h-3.5" /> Parent Task ID
          </Label>
          <Input
            id="parentId"
            placeholder="UUID (optional)"
            {...register('parentId')}
            defaultValue={parentId}
          />
        </div>
      </div>

      {/* Badge */}
      <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
        <Badge variant="outline" className="text-xs gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
          Saved to PostgreSQL
        </Badge>
        <span>Visible to all project members after creation</span>
      </div>

      {/* Submit */}
      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <Button type="button" variant="outline" onClick={onSuccess}>
          Cancel
        </Button>
        <Button
          type="submit"
          className="bg-indigo-600 hover:bg-indigo-700"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Creating…
            </span>
          ) : (
            'Create Task'
          )}
        </Button>
      </div>
    </form>
  );
}
