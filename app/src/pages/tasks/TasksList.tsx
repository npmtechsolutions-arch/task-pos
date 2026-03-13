import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Filter, 
  LayoutGrid, 
  List, 
  Calendar as CalendarIcon,
  MoreHorizontal,
  CheckSquare
} from 'lucide-react';
import { cn, formatDueDate, getPriorityColor, getStatusBgColor, getStatusLabel } from '@/lib/utils';
import { useTaskStore, useProjectStore } from '@/stores';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { TaskForm } from '@/components/tasks/TaskForm';
import { EmptyState } from '@/components/common/EmptyState';
import { TASK_STATUSES } from '@/lib/constants';
import type { Task } from '@/types';

export function TasksList() {
  const { filters, setFilters, getFilteredTasks } = useTaskStore();
  const { projects } = useProjectStore();
  const [viewMode, setViewMode] = useState<'board' | 'list' | 'calendar'>('board');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTasks = getFilteredTasks();

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setFilters({ ...filters, search: value });
  };

  const handleProjectFilter = (value: string) => {
    setFilters({ ...filters, projectId: value === 'all' ? undefined : value });
  };

  const handleStatusFilter = (value: string) => {
    setFilters({ ...filters, status: value === 'all' ? undefined : value as any });
  };

  const clearFilters = () => {
    setSearchQuery('');
    setFilters({});
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Tasks</h1>
          <p className="text-gray-500 mt-1">
            Manage and track your tasks across all projects
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              New Task
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Create New Task</DialogTitle>
              <DialogDescription>
                Add a new task to your project.
              </DialogDescription>
            </DialogHeader>
            <TaskForm onSuccess={() => setIsDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select
            value={filters.projectId || 'all'}
            onValueChange={handleProjectFilter}
          >
            <SelectTrigger className="w-[160px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={(filters.status as string) || 'all'}
            onValueChange={handleStatusFilter}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {TASK_STATUSES.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex border rounded-lg overflow-hidden">
            <Button
              variant={viewMode === 'board' ? 'default' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('board')}
              className={cn(
                'rounded-none',
                viewMode === 'board' && 'bg-blue-600 hover:bg-blue-700'
              )}
              title="Board View"
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('list')}
              className={cn(
                'rounded-none',
                viewMode === 'list' && 'bg-blue-600 hover:bg-blue-700'
              )}
              title="List View"
            >
              <List className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'calendar' ? 'default' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('calendar')}
              className={cn(
                'rounded-none',
                viewMode === 'calendar' && 'bg-blue-600 hover:bg-blue-700'
              )}
              title="Calendar View"
            >
              <CalendarIcon className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Active Filters */}
      {(filters.projectId || filters.status || filters.search) && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-500">Filters:</span>
          {filters.projectId && (
            <Badge variant="secondary" className="gap-1">
              Project: {projects.find(p => p.id === filters.projectId)?.name}
              <button onClick={() => setFilters({ ...filters, projectId: undefined })}>
                ×
              </button>
            </Badge>
          )}
          {filters.status && (
            <Badge variant="secondary" className="gap-1">
              Status: {TASK_STATUSES.find(s => s.value === filters.status)?.label}
              <button onClick={() => setFilters({ ...filters, status: undefined })}>
                ×
              </button>
            </Badge>
          )}
          {filters.search && (
            <Badge variant="secondary" className="gap-1">
              Search: {filters.search}
              <button onClick={() => handleSearch('')}>
                ×
              </button>
            </Badge>
          )}
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear all
          </Button>
        </div>
      )}

      {/* Tasks View */}
      {filteredTasks.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="No tasks found"
          description={
            filters.projectId || filters.status || filters.search
              ? "Try adjusting your filters to see more results."
              : "Get started by creating your first task."
          }
          action={
            filters.projectId || filters.status || filters.search
              ? { label: 'Clear filters', onClick: clearFilters }
              : { label: 'Create task', onClick: () => setIsDialogOpen(true) }
          }
        />
      ) : viewMode === 'board' ? (
        <KanbanBoard />
      ) : viewMode === 'list' ? (
        <TaskListTable tasks={filteredTasks} />
      ) : (
        <TaskCalendar tasks={filteredTasks} />
      )}
    </div>
  );
}

interface TaskListTableProps {
  tasks: Task[];
}

function TaskListTable({ tasks }: TaskListTableProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Task</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Status</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Priority</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Assignee</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Due Date</th>
            <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {tasks.map((task) => (
            <tr key={task.id} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <div>
                  <Link
                    to={`/tasks/${task.id}`}
                    className="font-medium text-gray-900 hover:text-blue-600"
                  >
                    {task.title}
                  </Link>
                  <p className="text-sm text-gray-500">
                    {task.project.key}-{task.taskNumber}
                  </p>
                </div>
              </td>
              <td className="px-4 py-3">
                <Badge variant="secondary" className={getStatusBgColor(task.status)}>
                  {getStatusLabel(task.status)}
                </Badge>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: getPriorityColor(task.priority) }}
                  />
                  <span className="text-sm capitalize">{task.priority}</span>
                </div>
              </td>
              <td className="px-4 py-3">
                {task.assignee ? (
                  <div className="flex items-center gap-2">
                    <Avatar className="w-6 h-6">
                      <AvatarImage src={task.assignee.avatarUrl} />
                      <AvatarFallback className="text-[10px]">
                        {task.assignee.firstName[0]}{task.assignee.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-gray-600">
                      {task.assignee.firstName} {task.assignee.lastName}
                    </span>
                  </div>
                ) : (
                  <span className="text-sm text-gray-400">Unassigned</span>
                )}
              </td>
              <td className="px-4 py-3">
                <span className={cn(
                  'text-sm',
                  task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'done'
                    ? 'text-red-600'
                    : 'text-gray-600'
                )}>
                  {task.dueDate ? formatDueDate(task.dueDate) : '—'}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TaskCalendar({ tasks }: TaskListTableProps) {
  // Simple calendar view - in a real app, use a proper calendar library
  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).getDay();

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const emptyDays = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  const getTasksForDay = (day: number) => {
    return tasks.filter(task => {
      if (!task.dueDate) return false;
      const dueDate = new Date(task.dueDate);
      return dueDate.getDate() === day && 
             dueDate.getMonth() === today.getMonth() &&
             dueDate.getFullYear() === today.getFullYear();
    });
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">
          {today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h3>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
            {day}
          </div>
        ))}
        {emptyDays.map(i => (
          <div key={`empty-${i}`} className="h-24 border border-gray-100 rounded" />
        ))}
        {days.map(day => {
          const dayTasks = getTasksForDay(day);
          const isToday = day === today.getDate();
          return (
            <div
              key={day}
              className={cn(
                'h-24 border border-gray-100 rounded p-1 overflow-hidden',
                isToday && 'bg-blue-50 border-blue-200'
              )}
            >
              <span className={cn(
                'text-sm font-medium',
                isToday ? 'text-blue-600' : 'text-gray-700'
              )}>
                {day}
              </span>
              <div className="mt-1 space-y-1">
                {dayTasks.slice(0, 2).map(task => (
                  <div
                    key={task.id}
                    className="text-xs p-1 rounded bg-blue-100 text-blue-700 truncate"
                  >
                    {task.title}
                  </div>
                ))}
                {dayTasks.length > 2 && (
                  <div className="text-xs text-gray-500">
                    +{dayTasks.length - 2} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
