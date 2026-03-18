import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Settings, Users, Flag, BarChart3, GitBranch,
  Plus, Calendar, DollarSign, Target, AlertTriangle, CheckCircle2,
  Clock, TrendingUp, PlayCircle, PauseCircle, Archive, Loader2,
  ChevronDown
} from 'lucide-react';
import { useProjectStore, useUIStore } from '@/stores';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { PhasesPanel } from '@/components/projects/PhasesPanel';
import { MilestonesPanel } from '@/components/projects/MilestonesPanel';
import { CriticalPathView } from '@/components/projects/CriticalPathView';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

type Tab = 'overview' | 'phases' | 'milestones' | 'critical-path' | 'team' | 'settings';

const LIFECYCLE_STYLES: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  draft:     { bg: 'bg-gray-100',    text: 'text-gray-600',   icon: <Clock className="w-3 h-3" /> },
  planning:  { bg: 'bg-blue-100',   text: 'text-blue-700',   icon: <Target className="w-3 h-3" /> },
  active:    { bg: 'bg-green-100',  text: 'text-green-700',  icon: <PlayCircle className="w-3 h-3" /> },
  on_hold:   { bg: 'bg-amber-100',  text: 'text-amber-700',  icon: <PauseCircle className="w-3 h-3" /> },
  completed: { bg: 'bg-indigo-100', text: 'text-indigo-700', icon: <CheckCircle2 className="w-3 h-3" /> },
  cancelled: { bg: 'bg-red-100',    text: 'text-red-700',    icon: <AlertTriangle className="w-3 h-3" /> },
  archived:  { bg: 'bg-slate-100',  text: 'text-slate-500',  icon: <Archive className="w-3 h-3" /> },
};

// Status transitions allowed from each state
const TRANSITIONS: Record<string, { value: string; label: string }[]> = {
  draft:     [{ value: 'planning', label: 'Move to Planning' }, { value: 'active', label: 'Activate' }],
  planning:  [{ value: 'active', label: 'Activate' }, { value: 'on_hold', label: 'Put On Hold' }],
  active:    [{ value: 'on_hold', label: 'Put On Hold' }, { value: 'completed', label: 'Mark Complete' }],
  on_hold:   [{ value: 'active', label: 'Resume' }, { value: 'cancelled', label: 'Cancel' }],
  completed: [{ value: 'archived', label: 'Archive' }],
  cancelled: [{ value: 'archived', label: 'Archive' }],
  archived:  [],
};

export function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const { projects, currentProject, isLoadingDetail, error, fetchProjectById, transitionStatus, archiveProjectApi } = useProjectStore();
  const { addToast } = useUIStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!projectId) return;
    // Always fetch fresh data from DB when landing on detail page
    fetchProjectById(projectId);
  }, [projectId]);

  const project = projects.find((p) => p.id === projectId) ?? currentProject;

  // ── Loading state ──────────────────────────────────────────────────────
  if (isLoadingDetail && !project) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mx-auto" />
          <p className="text-gray-500 text-sm">Loading project…</p>
        </div>
      </div>
    );
  }

  // ── Error / not found ─────────────────────────────────────────────────
  if (!project && !isLoadingDetail) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
          <p className="text-gray-600 font-medium">
            {error ?? 'Project not found'}
          </p>
          <Link to="/projects">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Projects
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!project) return null;

  const style = LIFECYCLE_STYLES[project.status] ?? LIFECYCLE_STYLES.draft;
  const progress = project.progress ?? 0;
  const budgetUtil = (project as any).budget
    ? Math.round(((project as any).budgetSpent ?? 0) / (project as any).budget * 100)
    : null;

  const availableTransitions = TRANSITIONS[project.status] ?? [];

  const handleTransition = async (targetStatus: string) => {
    if (!projectId) return;
    setIsTransitioning(true);
    try {
      await transitionStatus(projectId, targetStatus);
      addToast({
        type: 'success',
        title: 'Status updated',
        message: `Project moved to ${targetStatus.replace('_', ' ')}`,
      });
    } catch (e: any) {
      addToast({
        type: 'error',
        title: 'Failed to update status',
        message: e.message,
      });
    } finally {
      setIsTransitioning(false);
    }
  };

  const handleArchive = async () => {
    if (!projectId) return;
    if (!window.confirm(`Archive "${project?.name}"? It will be removed from the active projects list.`)) return;
    setIsArchiving(true);
    try {
      await archiveProjectApi(projectId);
      addToast({ type: 'success', title: 'Project archived', message: 'Project has been archived successfully.' });
      navigate('/projects');
    } catch (e: any) {
      addToast({ type: 'error', title: 'Archive failed', message: e.message });
      setIsArchiving(false);
    }
  };

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview',      label: 'Overview',      icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'phases',        label: 'Phases',         icon: <Flag className="w-4 h-4" /> },
    { id: 'milestones',    label: 'Milestones',     icon: <Target className="w-4 h-4" /> },
    { id: 'critical-path', label: 'Critical Path',  icon: <GitBranch className="w-4 h-4" /> },
    { id: 'team',          label: 'Team',           icon: <Users className="w-4 h-4" /> },
    { id: 'settings',      label: 'Settings',       icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-3">
            <Link to="/projects" className="hover:text-gray-600 transition-colors">Projects</Link>
            <span>/</span>
            <span className="text-gray-700 font-medium">{project.name}</span>
          </div>

          {/* Project Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 flex-1">
              {/* Color swatch */}
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-md flex-shrink-0">
                {project.key.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
                  <Badge className={cn('flex items-center gap-1 capitalize border-0 text-xs px-2 py-0.5', style.bg, style.text)}>
                    {style.icon}
                    {project.status.replace('_', ' ')}
                  </Badge>
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded font-mono">
                    {project.key}
                  </span>
                  {/* Sync indicator */}
                  {isLoadingDetail && (
                    <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" />
                  )}
                </div>
                <p className="text-gray-500 text-sm mt-1 max-w-2xl">
                  {project.description ?? 'No description provided.'}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Quick stats */}
              <div className="flex items-center gap-6 text-sm mr-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{project.taskCount ?? 0}</div>
                  <div className="text-gray-400 text-xs">Tasks</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-indigo-600">{Math.round(progress)}%</div>
                  <div className="text-gray-400 text-xs">Complete</div>
                </div>
                {project.members && (
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{project.members.length}</div>
                    <div className="text-gray-400 text-xs">Members</div>
                  </div>
                )}
              </div>

              {/* Lifecycle transition */}
              {project.status !== 'archived' && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="sm"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1"
                      disabled={isTransitioning || isArchiving}
                    >
                      {isTransitioning ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <>
                          Transition <ChevronDown className="w-3.5 h-3.5" />
                        </>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {availableTransitions.map((t) => (
                      <DropdownMenuItem
                        key={t.value}
                        onClick={() => handleTransition(t.value)}
                        className={cn(t.value === 'cancelled' && 'text-red-600', t.value === 'archived' && 'text-gray-500')}
                      >
                        {t.label}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-red-600"
                      onClick={handleArchive}
                      disabled={isArchiving}
                    >
                      {isArchiving ? (
                        <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Archiving…</>
                      ) : (
                        <><Archive className="w-3.5 h-3.5 mr-1" /> Archive Project</>
                      )}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-4 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-700"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4 -mb-4">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors',
                  activeTab === tab.id
                    ? 'border-indigo-600 text-indigo-600 bg-indigo-50/60'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {activeTab === 'overview' && (
          <ProjectOverview project={project} budgetUtil={budgetUtil} />
        )}
        {activeTab === 'phases' && (
          <PhasesPanel projectId={project.id} />
        )}
        {activeTab === 'milestones' && (
          <MilestonesPanel projectId={project.id} />
        )}
        {activeTab === 'critical-path' && (
          <CriticalPathView projectId={project.id} />
        )}
        {activeTab === 'team' && (
          <TeamPanel members={project.members ?? []} />
        )}
        {activeTab === 'settings' && (
          <SettingsPanel project={project} />
        )}
      </div>
    </div>
  );
}

/* ─── Sub-panels ─────────────────────────────────────────────────────────── */

function ProjectOverview({ project, budgetUtil }: { project: any; budgetUtil: number | null }) {
  const cards = [
    {
      label: 'Budget',
      icon: <DollarSign className="w-5 h-5 text-green-500" />,
      value: project.budget ? `$${project.budget.toLocaleString()}` : 'Not set',
      sub: budgetUtil != null ? `${budgetUtil}% utilized` : '',
      color: budgetUtil != null && budgetUtil > 90 ? 'text-red-500' : 'text-green-600',
    },
    {
      label: 'Start Date',
      icon: <Calendar className="w-5 h-5 text-blue-500" />,
      value: project.startDate ? new Date(project.startDate).toLocaleDateString() : '—',
      sub: 'Start date',
      color: 'text-blue-600',
    },
    {
      label: 'End Date',
      icon: <Calendar className="w-5 h-5 text-amber-500" />,
      value: project.endDate ? new Date(project.endDate).toLocaleDateString() : '—',
      sub: 'Target completion',
      color: 'text-amber-600',
    },
    {
      label: 'Progress',
      icon: <TrendingUp className="w-5 h-5 text-indigo-500" />,
      value: `${Math.round(project.progress ?? 0)}%`,
      sub: `${project.completedTaskCount ?? 0} / ${project.taskCount ?? 0} tasks done`,
      color: 'text-indigo-600',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-3">
              {card.icon}
              {card.label}
            </div>
            <div className={cn('text-2xl font-bold', card.color)}>{card.value}</div>
            {card.sub && <div className="text-xs text-gray-400 mt-1">{card.sub}</div>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Objectives */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Target className="w-4 h-4 text-indigo-500" /> Objectives
          </h3>
          {Array.isArray(project.objectives) && project.objectives.length > 0 ? (
            <ul className="space-y-2">
              {project.objectives.map((obj: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-2 flex-shrink-0" />
                  {obj}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-400 text-sm italic">No objectives defined</p>
          )}
        </div>

        {/* Key Results */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500" /> Key Results
          </h3>
          {Array.isArray(project.keyResults) && project.keyResults.length > 0 ? (
            <ul className="space-y-2">
              {project.keyResults.map((kr: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 mt-2 flex-shrink-0" />
                  {kr}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-400 text-sm italic">No key results defined</p>
          )}
        </div>
      </div>
    </div>
  );
}

function TeamPanel({ members }: { members: any[] }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-gray-800">Team Members ({members.length})</h2>
        <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">
          <Plus className="w-4 h-4 mr-1" /> Add Member
        </Button>
      </div>
      {members.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p>No team members yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {members.map((member) => (
            <div
              key={member.user_id ?? member.id}
              className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-sm font-semibold">
                {(member.user?.firstName ?? member.user?.first_name ?? '?')[0]}
                {(member.user?.lastName ?? member.user?.last_name ?? '')[0]}
              </div>
              <div>
                <p className="font-medium text-gray-800 text-sm">
                  {member.user?.firstName ?? member.user?.first_name}{' '}
                  {member.user?.lastName ?? member.user?.last_name}
                </p>
                <Badge variant="secondary" className="text-[10px] capitalize">
                  {member.role}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SettingsPanel({ project }: { project: any }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6 max-w-2xl">
      <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
        <Settings className="w-5 h-5 text-gray-500" /> Project Settings
      </h2>
      <div className="space-y-4 text-sm">
        {[
          { label: 'Department', value: project.department ?? '—' },
          { label: 'Business Unit', value: project.businessUnit ?? project.business_unit ?? '—' },
          { label: 'Client', value: project.clientName ?? project.client_name ?? '—' },
          { label: 'Budget', value: project.budget ? `$${project.budget.toLocaleString()}` : '—' },
          { label: 'Budget Spent', value: project.budgetSpent != null ? `$${project.budgetSpent.toLocaleString()}` : '—' },
        ].map((row) => (
          <div key={row.label} className="flex justify-between py-3 border-b border-gray-100">
            <span className="text-gray-500">{row.label}</span>
            <span className="font-medium text-gray-800">{row.value}</span>
          </div>
        ))}
        <div className="flex justify-between py-3 border-b border-gray-100">
          <span className="text-gray-500">Visibility</span>
          <Badge variant="secondary" className="capitalize">{project.visibility}</Badge>
        </div>
        <div className="flex justify-between py-3 border-b border-gray-100">
          <span className="text-gray-500">Project ID</span>
          <span className="font-mono text-xs text-gray-500">{project.id}</span>
        </div>
        <div className="flex justify-between py-3 border-b border-gray-100">
          <span className="text-gray-500">Created</span>
          <span className="text-gray-700">
            {project.createdAt ? new Date(project.createdAt).toLocaleDateString() : '—'}
          </span>
        </div>
      </div>
    </div>
  );
}
