import { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Clock, User, Calendar, Flag, MessageSquare,
  Timer, GitBranch, Trash2, Plus, CheckCircle2, Circle,
  AlertCircle, Loader2, ChevronRight,
  Tag, Hash, Users
} from 'lucide-react';
import MDEditor from '@uiw/react-md-editor';
import { useTaskStore, useUIStore } from '@/stores';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn, getStatusBgColor, getStatusLabel, getPriorityColor } from '@/lib/utils';
import { CommentsSection } from '@/components/communication/CommentsSection';

type Tab = 'details' | 'subtasks' | 'comments' | 'timelog';

// Status workflow state machine
const STATUS_TRANSITIONS: Record<string, { value: string; label: string; color: string }[]> = {
  backlog:     [{ value: 'todo', label: 'Move to To Do', color: 'bg-slate-100 text-slate-700' }],
  todo:        [{ value: 'in_progress', label: 'Start Working', color: 'bg-blue-100 text-blue-700' }],
  in_progress: [{ value: 'review', label: 'Send for Review', color: 'bg-purple-100 text-purple-700' }, { value: 'todo', label: 'Back to To Do', color: 'bg-slate-100 text-slate-600' }],
  review:      [{ value: 'done', label: 'Mark Done ✓', color: 'bg-green-100 text-green-700' }, { value: 'in_progress', label: 'Return to Progress', color: 'bg-blue-100 text-blue-600' }],
  done:        [{ value: 'in_progress', label: 'Reopen', color: 'bg-blue-100 text-blue-600' }],
};

const PRIORITY_BADGES: Record<string, string> = {
  highest: 'bg-purple-100 text-purple-700',
  high:    'bg-red-100 text-red-700',
  medium:  'bg-amber-100 text-amber-700',
  low:     'bg-blue-100 text-blue-700',
  lowest:  'bg-gray-100 text-gray-600',
};

export function TaskDetail() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const {
    currentTask,
    isLoadingDetail,
    error,
    fetchTaskDetail,
    updateTaskApi,
    deleteTaskApi,
    logTimeApi,
    addSubtask,
    deleteSubtask,
    moveTask,
  } = useTaskStore();
  const { addToast } = useUIStore();

  const [activeTab, setActiveTab] = useState<Tab>('details');
  const [logHours, setLogHours] = useState('');
  const [logDesc, setLogDesc] = useState('');
  const [isLoggingTime, setIsLoggingTime] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const subtaskInputRef = useRef<HTMLInputElement>(null);

  const task = currentTask?.id === taskId ? currentTask : null;

  useEffect(() => {
    if (!taskId) return;
    fetchTaskDetail(taskId);
  }, [taskId]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleStatusTransition = async (targetStatus: string) => {
    if (!taskId) return;
    setIsTransitioning(true);
    try {
      await moveTask(taskId, targetStatus as any);
      addToast({ type: 'success', title: 'Status updated', message: `Task moved to ${getStatusLabel(targetStatus)}` });
    } catch {
      addToast({ type: 'error', title: 'Update failed', message: 'Could not update status.' });
    } finally {
      setIsTransitioning(false);
    }
  };

  const handleLogTime = async () => {
    if (!taskId || !logHours) return;
    const hours = parseFloat(logHours);
    if (isNaN(hours) || hours <= 0) {
      addToast({ type: 'error', title: 'Invalid hours', message: 'Enter a positive number.' });
      return;
    }
    setIsLoggingTime(true);
    try {
      await logTimeApi(taskId, hours, logDesc || undefined);
      setLogHours('');
      setLogDesc('');
      addToast({ type: 'success', title: `${hours}h logged`, message: 'Time entry saved to DB.' });
    } catch {
      addToast({ type: 'error', title: 'Failed to log time' });
    } finally {
      setIsLoggingTime(false);
    }
  };

  const handleAddSubtask = async () => {
    if (!taskId || !newSubtaskTitle.trim()) return;
    setIsAddingSubtask(true);
    try {
      await addSubtask(taskId, newSubtaskTitle.trim());
      setNewSubtaskTitle('');
      addToast({ type: 'success', title: 'Subtask added' });
    } catch {
      addToast({ type: 'error', title: 'Failed to add subtask' });
    } finally {
      setIsAddingSubtask(false);
    }
  };

  const handleSubtaskToggle = async (subtaskId: string, currentStatus: string) => {
    if (!taskId) return;
    const newStatus = currentStatus === 'done' ? 'todo' : 'done';
    try {
      await updateTaskApi(subtaskId, { status: newStatus });
    } catch {
      addToast({ type: 'error', title: 'Failed to update subtask' });
    }
  };

  const handleDeleteTask = async () => {
    if (!taskId || !window.confirm(`Delete "${task?.title}"? This cannot be undone.`)) return;
    setIsDeleting(true);
    try {
      await deleteTaskApi(taskId);
      addToast({ type: 'success', title: 'Task deleted' });
      navigate('/tasks');
    } catch {
      addToast({ type: 'error', title: 'Failed to delete task' });
      setIsDeleting(false);
    }
  };

  // ── Loading / Error States ────────────────────────────────────────────────

  if (isLoadingDetail && !task) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
          <span>Loading task…</span>
        </div>
      </div>
    );
  }

  if (!task && !isLoadingDetail) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertCircle className="w-12 h-12 text-amber-500" />
        <p className="text-gray-600">{error ?? 'Task not found'}</p>
        <Link to="/tasks">
          <Button variant="outline" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> Back to Tasks</Button>
        </Link>
      </div>
    );
  }

  if (!task) return null;

  const availableTransitions = STATUS_TRANSITIONS[task.status] ?? [];
  const comments = (task as any).comments ?? [];
  const subtasks = (task as any).subtasks ?? [];
  const completedSubtasks = subtasks.filter((s: any) => s.status === 'done').length;

  const TABS: { id: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'details',   label: 'Details',   icon: <Flag className="w-3.5 h-3.5" /> },
    { id: 'subtasks',  label: 'Subtasks',  icon: <GitBranch className="w-3.5 h-3.5" />, count: subtasks.length },
    { id: 'comments',  label: 'Comments',  icon: <MessageSquare className="w-3.5 h-3.5" />, count: comments.length },
    { id: 'timelog',   label: 'Time Log',  icon: <Timer className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-gray-900 transition-colors">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 px-6 py-4 sticky top-0 z-10 transition-colors">
        <div className="max-w-5xl mx-auto">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-sm text-gray-400 mb-3">
            <Link to="/tasks" className="hover:text-gray-600 dark:hover:text-gray-300 flex items-center gap-1 transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> Tasks
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-gray-500 font-mono text-xs">{task.projectId?.slice(0, 8)}</span>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {/* Title */}
              <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-snug">{task.title}</h1>

              {/* Meta badges */}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge className={cn('text-xs border-0', getStatusBgColor(task.status))}>
                  {getStatusLabel(task.status)}
                </Badge>
                <Badge className={cn('text-xs border-0', PRIORITY_BADGES[task.priority] ?? 'bg-gray-100 text-gray-600')}>
                  <div className="w-1.5 h-1.5 rounded-full mr-1" style={{ backgroundColor: getPriorityColor(task.priority) }} />
                  {task.priority}
                </Badge>
                {(task as any).tags?.map((tag: any) => (
                  <Badge key={tag.id} variant="outline" className="text-xs gap-1" style={{ borderColor: tag.color, color: tag.color }}>
                    <Tag className="w-2.5 h-2.5" /> {tag.name}
                  </Badge>
                ))}
                {isLoadingDetail && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Status transitions */}
              {availableTransitions.map((t) => (
                <Button
                  key={t.value}
                  size="sm"
                  variant="outline"
                  className={cn('text-xs border-0 font-medium', t.color)}
                  onClick={() => handleStatusTransition(t.value)}
                  disabled={isTransitioning}
                >
                  {isTransitioning ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                  {t.label}
                </Button>
              ))}

              <Button
                size="sm"
                variant="outline"
                className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 text-xs font-semibold"
                onClick={() => navigate(`/kanban/${task.projectId}`)}
              >
                View Kanban
              </Button>

              <Button
                size="sm"
                variant="ghost"
                className="text-red-500 hover:bg-red-50 hover:text-red-600"
                onClick={handleDeleteTask}
                disabled={isDeleting}
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* Progress bar for subtasks */}
          {subtasks.length > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                <span>Subtasks</span>
                <span>{completedSubtasks}/{subtasks.length}</span>
              </div>
              <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all"
                  style={{ width: `${subtasks.length ? Math.round(completedSubtasks / subtasks.length * 100) : 0}%` }}
                />
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 mt-4 -mb-4">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors',
                  activeTab === tab.id
                    ? 'border-indigo-600 text-indigo-600 bg-indigo-50/60 dark:bg-indigo-900/40 dark:text-indigo-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
                )}
              >
                {tab.icon} {tab.label}
                {tab.count != null && tab.count > 0 && (
                  <span className={cn('text-[10px] px-1.5 rounded-full', activeTab === tab.id ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400')}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-5xl mx-auto px-6 py-6">
        {activeTab === 'details' && <DetailsTab task={task} />}
        {activeTab === 'subtasks' && (
          <SubtasksTab
            subtasks={subtasks}
            newSubtaskTitle={newSubtaskTitle}
            setNewSubtaskTitle={setNewSubtaskTitle}
            isAddingSubtask={isAddingSubtask}
            onAdd={handleAddSubtask}
            onToggle={handleSubtaskToggle}
            onDelete={(subtaskId: string) => taskId && deleteSubtask(taskId, subtaskId)}
            inputRef={subtaskInputRef}
          />
        )}
        {activeTab === 'comments' && (
          <CommentsSection taskId={taskId!} projectId={task.projectId} />
        )}
        {activeTab === 'timelog' && (
          <TimeLogTab
            task={task}
            logHours={logHours}
            setLogHours={setLogHours}
            logDesc={logDesc}
            setLogDesc={setLogDesc}
            isLoggingTime={isLoggingTime}
            onLog={handleLogTime}
          />
        )}
      </div>
    </div>
  );
}

/* ─── Details Tab ─────────────────────────────────────────────────────────── */

function DetailsTab({ task }: { task: any }) {
  const fields = [
    {
      label: 'Assignees',
      icon: <Users className="w-4 h-4 text-indigo-400" />,
      value: (task.assignees?.length > 0)
        ? (
          <div className="flex flex-wrap gap-2">
            {task.assignees.map((assignee: any) => (
              <div key={assignee.id} className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-700/50 px-2 py-1 rounded-md text-xs border border-gray-100 dark:border-gray-600">
                <Avatar className="w-5 h-5">
                  <AvatarImage src={assignee.avatarUrl} />
                  <AvatarFallback className="text-[9px]">
                    {(assignee.firstName?.[0] ?? '')}{(assignee.lastName?.[0] ?? '')}
                  </AvatarFallback>
                </Avatar>
                <span>{assignee.firstName} {assignee.lastName}</span>
                {assignee.id === task.primaryAssigneeId && (
                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 ml-1 bg-indigo-50 text-indigo-600 border-indigo-200">Primary</Badge>
                )}
              </div>
            ))}
          </div>
        )
        : <span className="text-gray-400 italic">Unassigned</span>,
    },
    {
      label: 'Reporter',
      icon: <User className="w-4 h-4 text-gray-400" />,
      value: task.reporter
        ? <span>{task.reporter.firstName} {task.reporter.lastName}</span>
        : <span className="text-gray-400">—</span>,
    },
    {
      label: 'Due Date',
      icon: <Calendar className="w-4 h-4 text-amber-400" />,
      value: task.dueDate
        ? (
          <span className={cn(new Date(task.dueDate) < new Date() && task.status !== 'done' ? 'text-red-600 font-medium' : '')}>
            {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        )
        : <span className="text-gray-400">Not set</span>,
    },
    {
      label: 'Estimated',
      icon: <Clock className="w-4 h-4 text-blue-400" />,
      value: task.estimatedHours != null ? `${task.estimatedHours}h` : <span className="text-gray-400">—</span>,
    },
    {
      label: 'Actual',
      icon: <Timer className="w-4 h-4 text-green-400" />,
      value: `${task.actualHours ?? 0}h`,
    },
    {
      label: 'Progress',
      icon: <Flag className="w-4 h-4 text-purple-400" />,
      value: `${Math.round(task.progress_percentage ?? 0)}%`,
    },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Description */}
      <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 transition-colors">
        <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-3 text-sm uppercase tracking-wide">Description</h3>
        {task.description ? (
          <div data-color-mode="light" className="dark:hidden">
            <MDEditor.Markdown source={task.description} className="text-sm leading-relaxed" />
          </div>
        ) : (
          <p className="text-gray-400 italic text-sm">No description provided.</p>
        )}
        {task.description && (
          <div data-color-mode="dark" className="hidden dark:block text-gray-300">
            <MDEditor.Markdown source={task.description} className="text-sm leading-relaxed" style={{ backgroundColor: 'transparent' }} />
          </div>
        )}
      </div>

      {/* Meta fields */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 space-y-4 transition-colors">
        <h3 className="font-semibold text-gray-700 dark:text-gray-200 text-sm uppercase tracking-wide mb-4">Details</h3>
        {fields.map((f) => (
          <div key={f.label} className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-gray-700/50 last:border-0">
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm">
              {f.icon} {f.label}
            </div>
            <div className="text-sm text-gray-800 dark:text-gray-200 font-medium">{f.value}</div>
          </div>
        ))}

        {/* Dependencies */}
        {(task.dependencies ?? []).length > 0 && (
          <div className="pt-2">
            <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Dependencies</p>
            {(task.dependencies ?? []).map((dep: any) => (
              <div key={dep.id} className="flex items-center gap-2 text-sm text-gray-600 py-1">
                <GitBranch className="w-3.5 h-3.5 text-gray-400" />
                <span className="capitalize text-xs text-gray-400">{dep.dependencyType.replace('_', ' ')}</span>
                <Link to={`/tasks/${dep.dependsOnId}`} className="text-indigo-600 hover:underline text-xs font-mono truncate">
                  <Hash className="w-3 h-3 inline" />{dep.dependsOnId.slice(0, 8)}
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Subtasks Tab ────────────────────────────────────────────────────────── */

function SubtasksTab({ subtasks, newSubtaskTitle, setNewSubtaskTitle, isAddingSubtask, onAdd, onToggle, onDelete, inputRef }: any) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 transition-colors">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-semibold text-gray-800 dark:text-gray-200">Subtasks ({subtasks.length})</h3>
      </div>

      {/* Add subtask */}
      <div className="flex gap-2 mb-5">
        <Input
          ref={inputRef}
          placeholder="Add subtask title…"
          value={newSubtaskTitle}
          onChange={(e) => setNewSubtaskTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onAdd()}
          className="flex-1"
        />
        <Button size="sm" onClick={onAdd} disabled={isAddingSubtask || !newSubtaskTitle.trim()} className="bg-indigo-600 hover:bg-indigo-700">
          {isAddingSubtask ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
        </Button>
      </div>

      {/* Subtask list */}
      {subtasks.length === 0 ? (
        <p className="text-gray-400 dark:text-gray-500 text-sm italic text-center py-8">No subtasks yet. Add one above.</p>
      ) : (
        <div className="space-y-2">
          {subtasks.map((subtask: any) => (
            <div key={subtask.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 group transition-colors">
              <button
                onClick={() => onToggle(subtask.id, subtask.status)}
                className="flex-shrink-0"
              >
                {subtask.status === 'done'
                  ? <CheckCircle2 className="w-5 h-5 text-green-500" />
                  : <Circle className="w-5 h-5 text-gray-300 hover:text-indigo-400 transition-colors" />}
              </button>
              <Link
                to={`/tasks/${subtask.id}`}
                className={cn('flex-1 text-sm', subtask.status === 'done' && 'line-through text-gray-400')}
              >
                {subtask.title}
              </Link>
              <Badge variant="secondary" className={cn('text-[10px]', getStatusBgColor(subtask.status))}>
                {getStatusLabel(subtask.status)}
              </Badge>
              <button
                onClick={() => onDelete(subtask.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Time Log Tab ────────────────────────────────────────────────────────── */

function TimeLogTab({ task, logHours, setLogHours, logDesc, setLogDesc, isLoggingTime, onLog }: any) {
  const estimatedHours = task.estimatedHours ?? 0;
  const actualHours = task.actualHours ?? 0;
  const utilPercent = estimatedHours > 0 ? Math.min(Math.round(actualHours / estimatedHours * 100), 100) : 0;

  return (
    <div className="space-y-4">
      {/* Summary card */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Estimated', value: `${estimatedHours}h`, color: 'text-blue-600 dark:text-blue-400' },
          { label: 'Logged', value: `${actualHours}h`, color: 'text-green-600 dark:text-green-400' },
          { label: 'Remaining', value: `${Math.max(0, estimatedHours - actualHours)}h`, color: estimatedHours > 0 && actualHours > estimatedHours ? 'text-red-600' : 'text-gray-700 dark:text-gray-300' },
        ].map((s) => (
          <div key={s.label} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 text-center transition-colors">
            <div className={cn('text-3xl font-bold', s.color)}>{s.value}</div>
            <div className="text-gray-400 text-xs mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Progress */}
      {estimatedHours > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-500">Time utilization</span>
            <span className={cn('font-medium', actualHours > estimatedHours ? 'text-red-600' : 'text-green-600')}>
              {utilPercent}%
            </span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', actualHours > estimatedHours ? 'bg-red-500' : 'bg-gradient-to-r from-green-400 to-emerald-500')}
              style={{ width: `${utilPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Log Time form */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 transition-colors">
        <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
          <Timer className="w-4 h-4 text-indigo-500" /> Log Time
        </h4>
        <div className="flex gap-3">
          <div className="w-32">
            <Input
              type="number"
              step="0.25"
              min="0.25"
              placeholder="Hours"
              value={logHours}
              onChange={(e) => setLogHours(e.target.value)}
            />
          </div>
          <Input
            placeholder="Description (optional)"
            value={logDesc}
            onChange={(e) => setLogDesc(e.target.value)}
            className="flex-1"
            onKeyDown={(e) => e.key === 'Enter' && onLog()}
          />
          <Button
            onClick={onLog}
            disabled={isLoggingTime || !logHours}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {isLoggingTime ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Log'}
          </Button>
        </div>
        <p className="text-xs text-gray-400 mt-2">Enter hours (e.g. 1.5 = 1h 30m). Press Enter or click Log.</p>
      </div>
    </div>
  );
}
