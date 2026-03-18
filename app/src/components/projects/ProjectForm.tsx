import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { CalendarIcon, DollarSign, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useProjectStore, useUIStore } from '@/stores';
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
  key: z
    .string()
    .min(2, 'Key must be at least 2 characters')
    .max(20, 'Key is too long')
    .regex(/^[A-Za-z0-9_-]+$/, 'Only letters, numbers, - and _ allowed'),
  description: z.string().optional(),
  visibility: z.enum(['private', 'internal', 'public']),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  // Keep as string in the form, convert manually on submit
  budget: z.string().optional(),
  department: z.string().max(100).optional(),
  businessUnit: z.string().max(100).optional(),
});

type ProjectFormData = z.infer<typeof projectSchema>;

interface ProjectFormProps {
  onSuccess?: () => void;
}

export function ProjectForm({ onSuccess }: ProjectFormProps) {
  const { createProject } = useProjectStore();
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

  // Auto-generate key from name (only if key not yet typed)
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    register('name').onChange(e);
    const name = e.target.value;
    if (name && !watch('key')) {
      const key = name
        .split(' ')
        .map((word) => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 5);
      setValue('key', key);
    }
  };

  const onSubmit = async (data: ProjectFormData) => {
    setIsSubmitting(true);
    try {
      const budgetVal = data.budget ? parseFloat(data.budget as unknown as string) : null;
      await createProject({
        name: data.name,
        key: data.key.toUpperCase(),
        description: data.description,
        visibility: data.visibility,
        start_date: data.startDate ? format(data.startDate, 'yyyy-MM-dd') : null,
        end_date: data.endDate ? format(data.endDate, 'yyyy-MM-dd') : null,
        budget: budgetVal,
        department: data.department || null,
        business_unit: data.businessUnit || null,
      });

      addToast({
        type: 'success',
        title: 'Project created successfully',
        message: `${data.name} has been added to PostgreSQL.`,
      });
      onSuccess?.();
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Failed to create project',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
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
          onChange={handleNameChange}
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
          maxLength={20}
        />
        {errors.key && (
          <p className="text-sm text-red-500">{errors.key.message}</p>
        )}
        <p className="text-xs text-gray-500">
          Unique identifier for your project (2–20 characters). Auto-generated from name.
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

      {/* Budget & Department */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="budget" className="flex items-center gap-1">
            <DollarSign className="w-3.5 h-3.5 text-green-500" /> Budget
          </Label>
          <Input
            id="budget"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            {...register('budget')}
            className={cn(errors.budget && 'border-red-500')}
          />
          {errors.budget && (
            <p className="text-sm text-red-500">{errors.budget.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="department" className="flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5 text-blue-500" /> Department
          </Label>
          <Input
            id="department"
            placeholder="e.g., Engineering"
            {...register('department')}
          />
        </div>
      </div>

      {/* Business Unit */}
      <div className="space-y-2">
        <Label htmlFor="businessUnit">Business Unit</Label>
        <Input
          id="businessUnit"
          placeholder="e.g., Product"
          {...register('businessUnit')}
        />
      </div>

      {/* Submit Buttons */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
        <Button type="button" variant="outline" onClick={onSuccess}>
          Cancel
        </Button>
        <Button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Creating…
            </span>
          ) : (
            'Create Project'
          )}
        </Button>
      </div>
    </form>
  );
}
