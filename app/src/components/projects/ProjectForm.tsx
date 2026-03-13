import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useProjectStore, useAuthStore, useUIStore } from '@/stores';
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
import { PROJECT_VISIBILITIES } from '@/lib/constants';

const projectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(200, 'Name is too long'),
  key: z.string().min(2, 'Key must be at least 2 characters').max(10, 'Key is too long'),
  description: z.string().optional(),
  visibility: z.enum(['private', 'internal', 'public']),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
});

type ProjectFormData = z.infer<typeof projectSchema>;

interface ProjectFormProps {
  onSuccess?: () => void;
}

export function ProjectForm({ onSuccess }: ProjectFormProps) {
  const { addProject } = useProjectStore();
  const { user } = useAuthStore();
  const { addToast } = useUIStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      visibility: 'private',
    },
  });

  const startDate = watch('startDate');
  const endDate = watch('endDate');

  // Auto-generate key from name
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    if (name && !watch('key')) {
      const key = name
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 5);
      setValue('key', key);
    }
  };

  const onSubmit = async (data: ProjectFormData) => {
    setIsSubmitting(true);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Create new project
      const newProject = {
        id: `p${Date.now()}`,
        name: data.name,
        key: data.key.toUpperCase(),
        description: data.description,
        status: 'active' as const,
        visibility: data.visibility,
        owner: user!,
        members: [{
          id: '1',
          user: user!,
          role: 'owner' as const,
          joinedAt: new Date().toISOString(),
        }],
        settings: {
          issueTypes: [],
          priorities: [],
          statuses: [],
        },
        progress: 0,
        taskCount: 0,
        completedTaskCount: 0,
        startDate: data.startDate?.toISOString(),
        endDate: data.endDate?.toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      addProject(newProject as any);
      
      addToast({
        type: 'success',
        title: 'Project created successfully',
      });
      
      onSuccess?.();
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Failed to create project',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="name">Project Name *</Label>
        <Input
          id="name"
          placeholder="Enter project name"
          {...register('name')}
          onChange={(e) => {
            register('name').onChange(e);
            handleNameChange(e);
          }}
          className={cn(errors.name && 'border-red-500')}
        />
        {errors.name && (
          <p className="text-sm text-red-500">{errors.name.message}</p>
        )}
      </div>

      {/* Key */}
      <div className="space-y-2">
        <Label htmlFor="key">Project Key *</Label>
        <Input
          id="key"
          placeholder="e.g., PROJ"
          {...register('key')}
          className={cn(errors.key && 'border-red-500', 'uppercase')}
          maxLength={10}
        />
        {errors.key && (
          <p className="text-sm text-red-500">{errors.key.message}</p>
        )}
        <p className="text-xs text-gray-500">
          A short identifier for your project (2-10 characters)
        </p>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="Enter project description"
          rows={3}
          {...register('description')}
        />
      </div>

      {/* Visibility */}
      <div className="space-y-2">
        <Label htmlFor="visibility">Visibility</Label>
        <Select
          onValueChange={(value: any) => setValue('visibility', value)}
          defaultValue="private"
        >
          <SelectTrigger>
            <SelectValue placeholder="Select visibility" />
          </SelectTrigger>
          <SelectContent>
            {PROJECT_VISIBILITIES.map((visibility) => (
              <SelectItem key={visibility.value} value={visibility.value}>
                <div>
                  <div className="font-medium">{visibility.label}</div>
                  <div className="text-xs text-gray-500">{visibility.description}</div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Start Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !startDate && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startDate ? format(startDate, 'PPP') : 'Pick a date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={(date) => setValue('startDate', date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label>End Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !endDate && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {endDate ? format(endDate, 'PPP') : 'Pick a date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={(date) => setValue('endDate', date)}
                initialFocus
                disabled={(date) =>
                  startDate ? date < startDate : false
                }
              />
            </PopoverContent>
          </Popover>
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
          {isSubmitting ? 'Creating...' : 'Create Project'}
        </Button>
      </div>
    </form>
  );
}
