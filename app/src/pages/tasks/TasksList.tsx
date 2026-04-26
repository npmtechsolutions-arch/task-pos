/**
 * TasksList — Enhanced My Tasks Dashboard
 * Features: Smart sections (Today/Overdue/Completed), Card/List/Board/Calendar views,
 *           Priority & due-date filters, Inline task detail drawer, Optimistic status updates
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus, Search, Filter, LayoutGrid, List, Calendar as CalendarIcon,
  MoreHorizontal, CheckSquare, Trash2, Loader2, ChevronRight, ChevronDown,
  User, Users2, Clock, AlertTriangle, CheckCircle2, ArrowRight, X,
  Flag, Tag, MessageSquare, Paperclip, Timer, ChevronLeft, RefreshCw,
  Zap, TrendingUp,
} from 'lucide-react';
import { cn, formatDueDate, getPriorityColor, getStatusBgColor, getStatusLabel } from '@/lib/utils';
import { useTaskStore, useProjectStore, useUIStore, useAuthStore } from '@/stores';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { TaskForm } from '@/components/tasks/TaskForm';
import { EmptyState } from '@/components/common/EmptyState';
import { TASK_STATUSES } from '@/lib/constants';
import type { Task } from '@/types';

// ── Smart section types ────────────────────────────────────────────────────────
type SmartTab = 'all' | 'today' | 'overdue' | 'completed' | 'upcoming';

const SMART_TABS: { id: SmartTab; label: string; icon: React.ElementType; color: string }[] = [
  { id: 'all',       label: 'All Tasks',   icon: CheckSquare,    color: 'text-indigo-600' },
  { id: 'today',     label: 'Due Today',   icon: Clock,          color: 'text-blue-600' },
  { id: 'overdue',   label: 'Overdue',     icon: AlertTriangle,  color: 'text-red-600' },
  { id: 'upcoming',  label: 'Upcoming',    icon: TrendingUp,     color: 'text-amber-600' },
  { id: 'completed', label: 'Completed',   icon: CheckCircle2,   color: 'text-emerald-600' },
];

const PRIORITY_LABELS: Record<string, string> = {
  highest: '🔴 Highest', high: '🟠 High', medium: '🟡 Medium',
  low: '🔵 Low', lowest: '⚪ Lowest',
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function isToday(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}
function isOverdue(task: Task) {
  if (!task.dueDate) return false;
  return new Date(task.dueDate) < new Date() && !['done', 'cancelled'].includes(task.status);
}
function isUpcoming(task: Task) {
  if (!task.dueDate) return false;
  const d = new Date(task.dueDate);
  const now = new Date();
  const in7 = new Date(); in7.setDate(now.getDate() + 7);
  return d > now && d <= in7 && !isToday(task.dueDate);
}

function filterBySmartTab(tasks: Task[], tab: SmartTab): Task[] {
  switch (tab) {
    case 'today':     return tasks.filter(t => t.dueDate && isToday(t.dueDate));
    case 'overdue':   return tasks.filter(t => isOverdue(t));
    case 'completed': return tasks.filter(t => ['done', 'cancelled'].includes(t.status));
    case 'upcoming':  return tasks.filter(t => isUpcoming(t));
    default:          return tasks;
  }
}

function countTab(tasks: Task[], tab: SmartTab): number {
  return filterBySmartTab(tasks, tab).length;
}

// ── Priority color helper ─────────────────────────────────────────────────────
const PRIORITY_BG: Record<string, string> = {
  highest: 'bg-red-100 text-red-700 border-red-200',
  high:    'bg-orange-100 text-orange-700 border-orange-200',
  medium:  'bg-yellow-100 text-yellow-700 border-yellow-200',
  low:     'bg-blue-100 text-blue-700 border-blue-200',
  lowest:  'bg-gray-100 text-gray-500 border-gray-200',
};

// ── Task Card (grid view) ─────────────────────────────────────────────────────
function TaskCard({ task, onClick }: { task: Task; onClick: () => void }) {
  const overdue = isOverdue(task);
  const today = task.dueDate && isToday(task.dueDate);
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white dark:bg-gray-800 rounded-xl border p-4 cursor-pointer shadow-sm hover:shadow-md transition-all duration-200 group',
        overdue ? 'border-red-200 bg-red-50/30 dark:bg-red-900/10'
          : today ? 'border-blue-200 bg-blue-50/20 dark:bg-blue-900/10'
          : 'border-gray-100 dark:border-gray-700 hover:border-indigo-200'
      )}
    >
      {/* Priority strip */}
      <div className={cn('h-0.5 w-full rounded-full mb-3', {
        'bg-red-500': task.priority === 'highest',
        'bg-orange-400': task.priority === 'high',
        'bg-yellow-400': task.priority === 'medium',
        'bg-blue-400': task.priority === 'low',
        'bg-gray-200': !task.priority || task.priority === 'lowest',
      })} />

      {/* Title */}
      <h3 className="font-semibold text-gray-800 dark:text-white text-sm line-clamp-2 mb-2 group-hover:text-indigo-600 transition-colors">
        {task.title}
      </h3>

      {/* Project chip */}
      {task.project?.name && (
        <span className="text-[10px] font-semibold text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full mb-2 inline-block">
          {task.project.key} • {task.project.name}
        </span>
      )}

      {/* Status & Priority */}
      <div className="flex items-center gap-1.5 flex-wrap mt-2">
        <Badge variant="secondary" className={cn('text-[10px] h-5 px-1.5', getStatusBgColor(task.status))}>
          {getStatusLabel(task.status)}
        </Badge>
        {task.priority && (
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded-md border font-medium capitalize', PRIORITY_BG[task.priority] || 'bg-gray-100 text-gray-500')}>
            {task.priority}
          </span>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-50 dark:border-gray-700">
        {/* Due date */}
        <span className={cn('text-[11px] flex items-center gap-1', overdue ? 'text-red-600 font-semibold' : today ? 'text-blue-600 font-semibold' : 'text-gray-400')}>
          {task.dueDate && <><Clock className="w-3 h-3" />{formatDueDate(task.dueDate)}</>}
        </span>
        {/* Assignee */}
        {task.primaryAssignee && (
          <Avatar className="w-6 h-6">
            <AvatarImage src={task.primaryAssignee.avatarUrl} />
            <AvatarFallback className="text-[9px] bg-indigo-100 text-indigo-600">
              {task.primaryAssignee.firstName?.[0]}{task.primaryAssignee.lastName?.[0]}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    </div>
  );
}

// ── Inline Task Drawer ─────────────────────────────────────────────────────────
function TaskDrawer({ task, onClose }: { task: Task; onClose: () => void }) {
  const navigate = useNavigate();
  const overdue = isOverdue(task);
  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      {/* Backdrop */}
      <div className="flex-1 bg-black/20 backdrop-blur-[1px]" />
      {/* Panel */}
      <div
        className="w-full max-w-lg bg-white dark:bg-gray-800 h-full shadow-2xl overflow-y-auto flex flex-col animate-in slide-in-from-right-6 duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
          <div className="flex items-center gap-3 min-w-0">
            <Badge variant="secondary" className={cn('text-xs flex-shrink-0', getStatusBgColor(task.status))}>
              {getStatusLabel(task.status)}
            </Badge>
            {task.priority && (
              <span className={cn('text-xs px-2 py-0.5 rounded-md border font-medium capitalize flex-shrink-0', PRIORITY_BG[task.priority])}>
                {task.priority}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => navigate(`/tasks/${task.id}`)}
              className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2 py-1 rounded-lg transition-colors"
            >
              Full Detail <ArrowRight className="w-3 h-3" />
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-400">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 px-6 py-5 space-y-5">
          {/* Title */}
          <div>
            {task.project && (
              <p className="text-xs font-semibold text-indigo-500 mb-1">{task.project.key} • {task.project.name}</p>
            )}
            <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">{task.title}</h2>
            {task.description && (
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{task.description}</p>
            )}
          </div>

          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Assignee', value: task.primaryAssignee
                ? `${task.primaryAssignee.firstName || ''} ${task.primaryAssignee.lastName || ''}`.trim()
                : 'Unassigned' },
              { label: 'Due Date', value: task.dueDate ? formatDueDate(task.dueDate) : '—', extra: overdue ? 'text-red-600 font-semibold' : '' },
              { label: 'Created', value: new Date(task.createdAt).toLocaleDateString() },
              { label: 'Updated', value: new Date(task.updatedAt).toLocaleDateString() },
            ].map(({ label, value, extra }) => (
              <div key={label} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
                <p className={cn('text-sm font-medium text-gray-800 dark:text-white', extra)}>{value}</p>
              </div>
            ))}
          </div>

          {/* Due alert */}
          {overdue && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700 font-medium">This task is overdue</p>
            </div>
          )}

          {/* Tags */}
          {task.tags && task.tags.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Tags</p>
              <div className="flex gap-1.5 flex-wrap">
                {task.tags.map((tag: any) => (
                  <span key={tag.id || tag} className="text-xs bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-full border border-indigo-100">
                    #{tag.name || tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Quick links */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => navigate(`/tasks/${task.id}`)}
              className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors"
            >
              <MessageSquare className="w-4 h-4" /> View Comments
            </button>
            <button
              onClick={() => navigate(`/tasks/${task.id}#attachments`)}
              className="flex items-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-xl px-3 py-2.5 text-sm transition-colors"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate(`/tasks/${task.id}#time`)}
              className="flex items-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-xl px-3 py-2.5 text-sm transition-colors"
            >
              <Timer className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main TasksList Component ───────────────────────────────────────────────────
export function TasksList() {
  const { filters, setFilters, getFilteredTasks, fetchTasks, fetchMyTasks, isLoading } = useTaskStore();
  const { projects, fetchProjects } = useProjectStore();
  const { user } = useAuthStore();
  const [viewMode, setViewMode] = useState<'board' | 'list' | 'card' | 'calendar'>('list');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [boardProjectId, setBoardProjectId] = useState<string>('');
  const [smartTab, setSmartTab] = useState<SmartTab>('all');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [dueDateFilter, setDueDateFilter] = useState('all');

  const isAdmin = ['admin', 'super_admin', 'owner'].includes(user?.role ?? '');
  const [adminView, setAdminView] = useState<'mine' | 'all'>('all');

  useEffect(() => {
    if (!user?.id) return;
    // Always fetch ALL tasks from DB (including completed) so they survive logout/login
    if (isAdmin && adminView === 'all') {
      fetchTasks({});
    } else {
      // fetchMyTasks now returns all statuses including DONE
      fetchMyTasks();
    }
    if (projects.length === 0) fetchProjects();
  }, [user?.id, adminView]);

  useEffect(() => {
    if (!boardProjectId && projects.length > 0) setBoardProjectId(projects[0].id);
  }, [projects, boardProjectId]);

  const baseFiltered = getFilteredTasks();

  // Apply priority filter
  const afterPriority = useMemo(() => {
    if (priorityFilter === 'all') return baseFiltered;
    return baseFiltered.filter(t => t.priority === priorityFilter);
  }, [baseFiltered, priorityFilter]);

  // Apply due-date filter
  const afterDue = useMemo(() => {
    const now = new Date();
    switch (dueDateFilter) {
      case 'today':    return afterPriority.filter(t => t.dueDate && isToday(t.dueDate));
      case 'overdue':  return afterPriority.filter(t => isOverdue(t));
      case 'upcoming': return afterPriority.filter(t => isUpcoming(t));
      default:         return afterPriority;
    }
  }, [afterPriority, dueDateFilter]);

  // Apply smart tab
  const filteredTasks = useMemo(() => filterBySmartTab(afterDue, smartTab), [afterDue, smartTab]);

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setFilters({ ...filters, search: value });
  };

  const handleProjectFilter = (value: string) => setFilters({ ...filters, projectId: value === 'all' ? undefined : value });
  const handleStatusFilter  = (value: string) => setFilters({ ...filters, status: value === 'all' ? undefined : value as any });
  const clearFilters = () => {
    setSearchQuery(''); setPriorityFilter('all'); setDueDateFilter('all');
    setFilters({});
  };

  const refresh = useCallback(() => {
    if (isAdmin && adminView === 'all') fetchTasks({});
    else fetchMyTasks();
  }, [adminView, isAdmin]);

  const pageTitle = isAdmin ? (adminView === 'all' ? 'All Tasks' : 'My Tasks') : 'My Tasks';

  return (
    <div className="space-y-5">
      {/* Drawer */}
      {selectedTask && <TaskDrawer task={selectedTask} onClose={() => setSelectedTask(null)} />}

      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{pageTitle}</h1>
            {isAdmin && (
              <div className="flex border rounded-lg overflow-hidden text-sm">
                {(['mine', 'all'] as const).map(v => (
                  <button key={v}
                    className={cn('flex items-center gap-1.5 px-3 py-1.5 transition-colors',
                      adminView === v ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 hover:bg-gray-50')}
                    onClick={() => setAdminView(v)}
                  >
                    {v === 'mine' ? <User className="w-3.5 h-3.5" /> : <Users2 className="w-3.5 h-3.5" />}
                    {v === 'mine' ? 'Mine' : 'All'}
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''} {smartTab !== 'all' ? `in "${SMART_TABS.find(t => t.id === smartTab)?.label}"` : ''}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={refresh}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500 transition-colors">
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
          </button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button id="btn-new-task" className="bg-indigo-600 hover:bg-indigo-700">
                <Plus className="w-4 h-4 mr-2" /> New Task
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Create New Task</DialogTitle>
                <DialogDescription>Add a new task to a project.</DialogDescription>
              </DialogHeader>
              <TaskForm onSuccess={() => { setIsDialogOpen(false); refresh(); }} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ── Smart Section Tabs ──────────────────────────── */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
        {SMART_TABS.map(tab => {
          const count = countTab(afterDue, tab.id);
          const Icon = tab.icon;
          return (
            <button key={tab.id}
              onClick={() => setSmartTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all',
                smartTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 border border-gray-100 dark:border-gray-700'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
              {count > 0 && (
                <span className={cn('px-1.5 py-0.5 rounded-full text-[9px] font-bold',
                  smartTab === tab.id ? 'bg-white/30 text-white' : `${tab.color} bg-current/10`)}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Filters Row ────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search tasks…" value={searchQuery} onChange={e => handleSearch(e.target.value)} className="pl-10" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Project */}
          <Select value={filters.projectId || 'all'} onValueChange={handleProjectFilter}>
            <SelectTrigger className="w-[150px]">
              <Filter className="w-4 h-4 mr-1.5" /><SelectValue placeholder="Project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* Status */}
          <Select value={(filters.status as string) || 'all'} onValueChange={handleStatusFilter}>
            <SelectTrigger className="w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {TASK_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* Priority */}
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[130px]"><Zap className="w-3.5 h-3.5 mr-1.5" /><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              {Object.entries(PRIORITY_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* Due Date */}
          <Select value={dueDateFilter} onValueChange={setDueDateFilter}>
            <SelectTrigger className="w-[130px]"><Clock className="w-3.5 h-3.5 mr-1.5" /><SelectValue placeholder="Due Date" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any Date</SelectItem>
              <SelectItem value="today">Due Today</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="upcoming">Next 7 Days</SelectItem>
            </SelectContent>
          </Select>

          {/* View Mode */}
          <div className="flex border rounded-lg overflow-hidden">
            {(['list', 'card', 'board', 'calendar'] as const).map(mode => (
              <Button key={mode} variant={viewMode === mode ? 'default' : 'ghost'} size="icon"
                onClick={() => setViewMode(mode)}
                className={cn('rounded-none', viewMode === mode && 'bg-indigo-600 hover:bg-indigo-700')}
                title={mode.charAt(0).toUpperCase() + mode.slice(1) + ' View'}
              >
                {mode === 'board' ? <LayoutGrid className="w-4 h-4" /> :
                  mode === 'list' ? <List className="w-4 h-4" /> :
                  mode === 'card' ? <CheckSquare className="w-4 h-4" /> :
                  <CalendarIcon className="w-4 h-4" />}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Active Filters */}
      {(filters.projectId || filters.status || filters.search || priorityFilter !== 'all' || dueDateFilter !== 'all') && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-500">Filters:</span>
          {filters.projectId && (
            <Badge variant="secondary" className="gap-1">
              Project: {projects.find(p => p.id === filters.projectId)?.name}
              <button onClick={() => setFilters({ ...filters, projectId: undefined })}>×</button>
            </Badge>
          )}
          {filters.status && (
            <Badge variant="secondary" className="gap-1">
              Status: {TASK_STATUSES.find(s => s.value === filters.status)?.label}
              <button onClick={() => setFilters({ ...filters, status: undefined })}>×</button>
            </Badge>
          )}
          {priorityFilter !== 'all' && (
            <Badge variant="secondary" className="gap-1">
              Priority: {priorityFilter}
              <button onClick={() => setPriorityFilter('all')}>×</button>
            </Badge>
          )}
          {dueDateFilter !== 'all' && (
            <Badge variant="secondary" className="gap-1">
              Due: {dueDateFilter}
              <button onClick={() => setDueDateFilter('all')}>×</button>
            </Badge>
          )}
          <Button variant="ghost" size="sm" onClick={clearFilters}>Clear all</Button>
        </div>
      )}

      {/* ── Main View ────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center h-52">
          <div className="flex flex-col items-center gap-3 text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
            <p className="text-sm">Loading tasks…</p>
          </div>
        </div>
      ) : filteredTasks.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="No tasks found"
          description={
            smartTab === 'today' ? 'No tasks due today. Great!'
            : smartTab === 'overdue' ? 'No overdue tasks. You\'re on track!'
            : smartTab === 'completed' ? 'No completed tasks yet.'
            : 'Try adjusting your filters or create a new task.'
          }
          action={{ label: 'Create task', onClick: () => setIsDialogOpen(true) }}
        />
      ) : viewMode === 'board' ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 font-medium">Project:</span>
            <Select value={boardProjectId || ''} onValueChange={setBoardProjectId}>
              <SelectTrigger className="w-[220px] h-8 text-sm"><SelectValue placeholder="Select a project…" /></SelectTrigger>
              <SelectContent>
                {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <KanbanBoard projectId={boardProjectId || undefined} />
        </div>
      ) : viewMode === 'card' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredTasks.map(task => (
            <TaskCard key={task.id} task={task} onClick={() => setSelectedTask(task)} />
          ))}
        </div>
      ) : viewMode === 'list' ? (
        <TaskListTable tasks={filteredTasks} onTaskClick={setSelectedTask} />
      ) : (
        <TaskCalendar tasks={filteredTasks} />
      )}
    </div>
  );
}

// ── Task List Table ─────────────────────────────────────────────────────────────
function TaskListTable({ tasks, onTaskClick }: { tasks: Task[]; onTaskClick: (t: Task) => void }) {
  const navigate = useNavigate();
  const { deleteTaskApi } = useTaskStore();
  const { addToast } = useUIStore();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const toggleExpand = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setExpandedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const handleDelete = async (task: Task) => {
    if (!window.confirm(`Delete "${task.title}"? This cannot be undone.`)) return;
    setDeletingId(task.id);
    try {
      await deleteTaskApi(task.id);
      addToast({ type: 'success', title: 'Task deleted', message: `"${task.title}" has been deleted.` });
    } catch {
      addToast({ type: 'error', title: 'Delete failed', message: 'Could not delete the task.' });
    } finally { setDeletingId(null); }
  };

  const rootTasks = tasks.filter(t => !t.parentId);

  const renderRow = (task: Task, level: number = 0): React.ReactNode => {
    const children = tasks.filter(t => t.parentId === task.id);
    const hasChildren = children.length > 0;
    const isExpanded = expandedIds.has(task.id);
    const overdue = isOverdue(task);
    const today = task.dueDate && isToday(task.dueDate);

    return (
      <React.Fragment key={task.id}>
        <tr
          className={cn(
            'border-b border-gray-50 dark:border-gray-700 cursor-pointer transition-colors',
            overdue ? 'hover:bg-red-50/40' : 'hover:bg-indigo-50/30 dark:hover:bg-gray-700/40'
          )}
          onClick={() => onTaskClick(task)}
        >
          {/* Title */}
          <td className="px-4 py-3 min-w-[280px]">
            <div className="flex items-start" style={{ paddingLeft: `${level * 1.5}rem` }}>
              {hasChildren ? (
                <button className="mr-2 p-0.5 mt-0.5 hover:bg-gray-200 rounded text-gray-500"
                  onClick={e => toggleExpand(e, task.id)}>
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
              ) : <div className="w-6 h-6 mr-2" />}
              <div>
                <div className={cn('font-semibold text-gray-900 dark:text-white text-sm', overdue && 'text-red-700')}>
                  {task.title}
                </div>
                <div className="text-xs text-gray-400 line-clamp-1 mt-0.5">
                  {task.project?.key ?? ''} {task.description ? '· ' + task.description : ''}
                </div>
              </div>
            </div>
          </td>
          {/* Status */}
          <td className="px-3 py-3">
            <Badge variant="secondary" className={cn('text-xs', getStatusBgColor(task.status))}>
              {getStatusLabel(task.status)}
            </Badge>
          </td>
          {/* Priority */}
          <td className="px-3 py-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getPriorityColor(task.priority) }} />
              <span className="text-xs capitalize text-gray-600 dark:text-gray-300">{task.priority || '—'}</span>
            </div>
          </td>
          {/* Assignee */}
          <td className="px-3 py-3 whitespace-nowrap">
            {task.primaryAssignee ? (
              <div className="flex items-center gap-2">
                <Avatar className="w-6 h-6">
                  <AvatarImage src={task.primaryAssignee.avatarUrl} />
                  <AvatarFallback className="text-[9px]">
                    {task.primaryAssignee.firstName?.[0]}{task.primaryAssignee.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-gray-600 dark:text-gray-300">
                  {task.primaryAssignee.firstName} {task.primaryAssignee.lastName}
                </span>
              </div>
            ) : <span className="text-xs text-gray-400">Unassigned</span>}
          </td>
          {/* Due Date */}
          <td className="px-3 py-3 whitespace-nowrap">
            <span className={cn('text-xs flex items-center gap-1',
              overdue ? 'text-red-600 font-semibold' : today ? 'text-blue-600 font-semibold' : 'text-gray-500')}>
              {task.dueDate ? <><Clock className="w-3 h-3" />{formatDueDate(task.dueDate)}</> : '—'}
            </span>
          </td>
          {/* Actions */}
          <td className="px-3 py-3 text-right" onClick={e => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" disabled={deletingId === task.id}>
                  {deletingId === task.id
                    ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                    : <MoreHorizontal className="w-4 h-4 text-gray-400" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onTaskClick(task)}>Quick View</DropdownMenuItem>
                <DropdownMenuItem asChild><Link to={`/tasks/${task.id}`}>Full Details</Link></DropdownMenuItem>
                <DropdownMenuItem className="text-red-600"
                  onClick={() => handleDelete(task)} disabled={deletingId === task.id}>
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </td>
        </tr>
        {isExpanded && children.map(child => renderRow(child, level + 1))}
      </React.Fragment>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
      <table className="w-full">
        <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-600">
          <tr>
            {['Task', 'Status', 'Priority', 'Assignee', 'Due Date', 'Actions'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rootTasks.length === 0
            ? <tr><td colSpan={6} className="text-center py-12 text-gray-400 text-sm">No tasks found.</td></tr>
            : rootTasks.map(t => renderRow(t, 0))}
        </tbody>
      </table>
    </div>
  );
}

// ── Calendar View ─────────────────────────────────────────────────────────────
function TaskCalendar({ tasks }: { tasks: Task[] }) {
  const [month, setMonth] = useState(new Date());
  const year = month.getFullYear(), m = month.getMonth();
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const firstDay = new Date(year, m, 1).getDay();
  const today = new Date();

  const getTasksForDay = (day: number) => tasks.filter(t => {
    if (!t.dueDate) return false;
    const d = new Date(t.dueDate);
    return d.getDate() === day && d.getMonth() === m && d.getFullYear() === year;
  });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setMonth(new Date(year, m - 1))} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h3 className="font-semibold text-gray-800 dark:text-white">
          {month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h3>
        <button onClick={() => setMonth(new Date(year, m + 1))} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
          <div key={d} className="text-center text-xs font-semibold text-gray-400 py-2">{d}</div>
        ))}
        {Array.from({ length: firstDay }, (_, i) => <div key={`e${i}`} className="h-20 rounded-lg" />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const dayTasks = getTasksForDay(day);
          const isCurrentDay = day === today.getDate() && m === today.getMonth() && year === today.getFullYear();
          const hasOverdue = dayTasks.some(isOverdue);
          return (
            <div key={day} className={cn(
              'h-20 border rounded-lg p-1.5 overflow-hidden transition-colors',
              isCurrentDay ? 'bg-indigo-50 border-indigo-300 dark:bg-indigo-900/30' : 'border-gray-100 dark:border-gray-700 hover:bg-gray-50',
              hasOverdue && 'border-red-200 bg-red-50/30'
            )}>
              <span className={cn('text-xs font-semibold', isCurrentDay ? 'text-indigo-600' : 'text-gray-600 dark:text-gray-400')}>
                {day}
              </span>
              <div className="mt-0.5 space-y-0.5">
                {dayTasks.slice(0, 2).map(t => (
                  <div key={t.id} className={cn('text-[10px] px-1 py-0.5 rounded truncate',
                    isOverdue(t) ? 'bg-red-100 text-red-700' : 'bg-indigo-100 text-indigo-700')}>
                    {t.title}
                  </div>
                ))}
                {dayTasks.length > 2 && <div className="text-[9px] text-gray-400">+{dayTasks.length - 2} more</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
