import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Settings, Users, Flag, BarChart3, GitBranch,
  Plus, Calendar, DollarSign, Target, AlertTriangle, CheckCircle2,
  Clock, TrendingUp, PlayCircle, PauseCircle, Archive, Loader2,
  ChevronDown, Edit2, Save, X, Github, FileText, Download, Check,
} from 'lucide-react';
import { useProjectStore, useUIStore } from '@/stores';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn, debounce } from '@/lib/utils';
import { addProjectMembersBulk, downloadProjectPrd } from '@/api/projects';
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
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500 mb-3">
            <Link to="/projects" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">Projects</Link>
            <span>/</span>
            <span className="text-gray-700 dark:text-gray-200 font-medium">{project.name}</span>
          </div>

          {/* Project Header */}
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
            <div className="flex flex-col sm:flex-row sm:items-start gap-4 flex-1">
              {/* Color swatch */}
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-md flex-shrink-0">
                {project.key.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{project.name}</h1>
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
            <div className="flex flex-wrap items-center gap-4 flex-shrink-0 w-full lg:w-auto">
              {/* Details page link */}
              <Link
                to={`/projects/${projectId}/details`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-700 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
              >
                <Settings className="w-3.5 h-3.5" />
                Details
              </Link>
              {/* Quick stats */}
              <div className="flex items-center gap-6 text-sm flex-1 sm:flex-none justify-around sm:justify-start">
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
                <div className="flex-shrink-0">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="sm"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1 w-full sm:w-auto"
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
                </div>
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
          <div className="flex gap-1 mt-6 -mb-4 overflow-x-auto pb-1 scrollbar-hide">
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
          <ProjectOverview
            project={project}
            budgetUtil={budgetUtil}
            onDownloadPrd={() =>
              project.prdFile &&
              downloadProjectPrd(project.id, project.prdFile.fileName)
            }
          />
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
          <TeamPanel members={project.members ?? []} projectId={project.id} />
        )}
        {activeTab === 'settings' && (
          <SettingsPanel project={project} />
        )}
      </div>
    </div>
  );
}

/* ─── Sub-panels ─────────────────────────────────────────────────────────── */

function ProjectOverview({
  project,
  budgetUtil,
  onDownloadPrd,
}: {
  project: any;
  budgetUtil: number | null;
  onDownloadPrd: () => void;
}) {
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [budgetValue, setBudgetValue] = useState(project.budget || '');
  const { updateProjectApi } = useProjectStore();

  const handleBudgetSave = async () => {
    try {
      await updateProjectApi(project.id, { budget: Number(budgetValue) });
      setIsEditingBudget(false);
    } catch {}
  };

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
        {/* Budget Card with Inline Edit */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow relative group">
          <div className="flex items-center justify-between mb-3 text-gray-500 text-sm">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-500" /> Budget
            </div>
            {!isEditingBudget && (
              <button onClick={() => setIsEditingBudget(true)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-400 hover:text-indigo-600">
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {isEditingBudget ? (
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <Input type="number" autoFocus value={budgetValue} onChange={e => setBudgetValue(e.target.value)} className="pl-6 h-8 text-lg font-bold" />
              </div>
              <Button size="icon" variant="ghost" onClick={handleBudgetSave} className="h-8 w-8 text-green-600 hover:bg-green-50"><Save className="w-4 h-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => { setIsEditingBudget(false); setBudgetValue(project.budget); }} className="h-8 w-8 text-gray-400 hover:bg-gray-50"><X className="w-4 h-4" /></Button>
            </div>
          ) : (
            <>
              <div className={cn('text-2xl font-bold', budgetUtil != null && budgetUtil > 90 ? 'text-red-500' : 'text-green-600')}>
                {project.budget ? `$${project.budget.toLocaleString()}` : 'Not set'}
              </div>
              {budgetUtil != null && <div className="text-xs text-gray-400 mt-1">{budgetUtil}% utilized</div>}
            </>
          )}
        </div>

        {cards.slice(1).map((card) => (
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

      {(project.githubUrl || project.prdFile) && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="font-semibold text-gray-800 flex items-center gap-2 mb-1">
              <FileText className="w-4 h-4 text-violet-500" /> Links &amp; PRD
            </h3>
            <p className="text-sm text-gray-500">Repository and product requirements for this project.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {project.githubUrl && (
              <a
                href={project.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800"
              >
                <Github className="w-4 h-4" /> GitHub
              </a>
            )}
            {project.prdFile && (
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => onDownloadPrd()}
              >
                <Download className="w-4 h-4" />
                PRD (v{project.prdFile.version}) — {project.prdFile.fileName}
              </Button>
            )}
          </div>
        </div>
      )}

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

function TeamPanel({ members: initialMembers, projectId }: { members: any[]; projectId: string }) {
  const [members, setMembers] = useState<any[]>(initialMembers);
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [role, setRole] = useState('member');
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [modalError, setModalError] = useState('');

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
  const getAuthHeader = () => {
    const token = localStorage.getItem('token') || localStorage.getItem('access_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  useEffect(() => {
    setMembers(initialMembers);
  }, [initialMembers]);

  const runSearch = useMemo(
    () =>
      debounce((q: string) => {
        if (!q.trim()) {
          setSearchResults([]);
          return;
        }
        axios
          .get(`${API_URL}/users/search`, {
            params: { q: q.trim(), limit: 15 },
            headers: getAuthHeader(),
          })
          .then((res) => setSearchResults(res.data?.items ?? []))
          .catch(() => setSearchResults([]));
      }, 300),
    [API_URL]
  );

  const toggleSelect = (userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleBulkAdd = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) {
      setModalError('Select at least one user');
      return;
    }
    setSaving(true);
    setModalError('');
    try {
      const added = await addProjectMembersBulk(projectId, {
        user_ids: ids,
        role: role as 'owner' | 'admin' | 'manager' | 'member' | 'viewer',
      });
      setMembers((prev) => {
        const have = new Set(prev.map((m) => m.user_id ?? m.user?.id));
        const fresh = added.filter((m) => !have.has(m.user_id));
        return [...prev, ...fresh];
      });
      setShowModal(false);
      setSelectedIds(new Set());
      setSearchQuery('');
      setSearchResults([]);
      setRole('member');
    } catch (e: any) {
      const d = e.response?.data?.detail;
      setModalError(typeof d === 'string' ? d : e.message ?? 'Failed to add members');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (userId: string) => {
    if (!window.confirm('Remove this member from the project?')) return;
    setRemoving(userId);
    try {
      await axios.delete(`${API_URL}/projects/${projectId}/members/${userId}`, { headers: getAuthHeader() });
      setMembers(prev => prev.filter(m => (m.user_id ?? m.user?.id) !== userId));
    } catch (e: any) {
      alert(e.response?.data?.detail ?? e.message ?? 'Failed to remove member');
    } finally { setRemoving(null); }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      {/* Add Member Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-500" /> Add Member
              </h3>
              <button onClick={() => { setShowModal(false); setModalError(''); setSelectedIds(new Set()); setSearchQuery(''); setSearchResults([]); }}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">✕</button>
            </div>
            <div className="p-6 space-y-4">
              {modalError && <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{modalError}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Search users</label>
                <input autoFocus className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  placeholder="Type name or email…"
                  value={searchQuery}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSearchQuery(v);
                    runSearch(v);
                  }}
                />
                {selectedIds.size > 0 && (
                  <p className="text-xs text-indigo-600 mt-1">{selectedIds.size} selected — add in one request</p>
                )}
                {searchResults.length > 0 && (
                  <div className="mt-1 border border-gray-200 rounded-lg overflow-hidden shadow-sm max-h-48 overflow-y-auto">
                    {searchResults.map((u) => {
                      const onProject = members.some((m) => (m.user_id ?? m.user?.id) === u.id);
                      const sel = selectedIds.has(u.id);
                      return (
                        <button
                          key={u.id}
                          type="button"
                          disabled={onProject}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors',
                            onProject ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'hover:bg-indigo-50',
                            sel && !onProject && 'bg-indigo-50'
                          )}
                          onClick={() => !onProject && toggleSelect(u.id)}
                        >
                          <div
                            className={cn(
                              'w-5 h-5 rounded border flex items-center justify-center flex-shrink-0',
                              sel ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'
                            )}
                          >
                            {sel && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {u.first_name?.[0] ?? '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">
                              {u.first_name} {u.last_name}
                              {onProject && <span className="text-gray-400 font-normal"> (already on project)</span>}
                            </p>
                            <p className="text-xs text-gray-400 truncate">{u.email}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={role} onChange={e => setRole(e.target.value)}>
                  <option value="member">Member</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 border border-gray-200 rounded-lg py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
                <button type="button" onClick={handleBulkAdd} disabled={selectedIds.size === 0 || saving}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-2 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
                  {saving ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Adding…</>
                  ) : selectedIds.size ? (
                    `Add ${selectedIds.size} member${selectedIds.size === 1 ? '' : 's'}`
                  ) : (
                    'Select users'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-gray-800">Team Members ({members.length})</h2>
        <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4 mr-1" /> Add Member
        </Button>
      </div>
      {members.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p>No team members yet</p>
          <button onClick={() => setShowModal(true)} className="mt-3 text-indigo-600 text-sm hover:underline">+ Add first member</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {members.map((member) => {
            const uid = member.user_id ?? member.user?.id ?? member.id;
            return (
              <div key={uid} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors group">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                  {(member.user?.firstName ?? member.user?.first_name ?? '?')[0]}
                  {(member.user?.lastName ?? member.user?.last_name ?? '')[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 text-sm truncate">
                    {member.user?.firstName ?? member.user?.first_name}{' '}
                    {member.user?.lastName ?? member.user?.last_name}
                  </p>
                  <Badge variant="secondary" className="text-[10px] capitalize">{member.role}</Badge>
                </div>
                {removing === uid ? (
                  <Loader2 className="w-4 h-4 text-gray-400 animate-spin flex-shrink-0" />
                ) : (
                  <button onClick={() => handleRemove(uid)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600 p-1 rounded"
                    title="Remove member">✕</button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SettingsPanel({ project }: { project: any }) {
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
  const token = localStorage.getItem('token') || localStorage.getItem('access_token');
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  // Determine current user's role
  const storedUser = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; } })();
  const userRole: string = storedUser?.role ?? '';
  const memberRole = project.members?.find((m: any) => m.user_id === storedUser?.id)?.role;
  const canEdit = ['admin', 'owner', 'manager'].includes(userRole) || ['admin', 'owner'].includes(memberRole);

  const [form, setForm] = useState({
    name: project.name ?? '',
    department: project.department ?? '',
    client_name: project.clientName ?? project.client_name ?? '',
    budget: project.budget ?? '',
    visibility: project.visibility ?? 'private',
    start_date: project.startDate ? project.startDate.slice(0, 10) : '',
    end_date: project.endDate ? project.endDate.slice(0, 10) : '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const handleSave = async () => {
    setSaving(true); setSaveError(''); setSaved(false);
    try {
      await axios.put(`${API_URL}/projects/${project.id}`, {
        name: form.name || undefined,
        department: form.department || undefined,
        client_name: form.client_name || undefined,
        budget: form.budget ? Number(form.budget) : undefined,
        visibility: form.visibility,
        start_date: form.start_date ? new Date(form.start_date).toISOString() : undefined,
        end_date: form.end_date ? new Date(form.end_date).toISOString() : undefined,
      }, { headers });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setSaveError(e.response?.data?.detail ?? e.message ?? 'Save failed');
    } finally { setSaving(false); }
  };

  if (!canEdit) {
    // Read-only view for members/viewers
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4 max-w-2xl">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <Settings className="w-5 h-5 text-gray-500" /> Project Settings
          <span className="ml-auto text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Read Only</span>
        </h2>
        <div className="space-y-1 text-sm">
          {[
            { label: 'Project Name', value: project.name },
            { label: 'Department', value: project.department ?? '—' },
            { label: 'Client', value: project.clientName ?? project.client_name ?? '—' },
            { label: 'Budget', value: project.budget ? `$${Number(project.budget).toLocaleString()}` : '—' },
            { label: 'Visibility', value: project.visibility },
            { label: 'Start Date', value: project.startDate ? new Date(project.startDate).toLocaleDateString() : '—' },
            { label: 'End Date', value: project.endDate ? new Date(project.endDate).toLocaleDateString() : '—' },
            { label: 'Project ID', value: project.id },
          ].map(row => (
            <div key={row.label} className="flex justify-between py-3 border-b border-gray-50">
              <span className="text-gray-500">{row.label}</span>
              <span className="font-medium text-gray-800 font-mono text-xs">{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <Settings className="w-5 h-5 text-gray-500" /> Project Settings
        </h2>
        {saved && <span className="text-green-600 text-sm font-medium flex items-center gap-1">✓ Saved</span>}
      </div>

      {saveError && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg p-3">{saveError}</div>
      )}

      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={form.name} onChange={set('name')} placeholder="Project name" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={form.department} onChange={set('department')} placeholder="Engineering, Marketing…" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={form.client_name} onChange={set('client_name')} placeholder="Client name" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Budget ($)</label>
            <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={form.budget} onChange={set('budget')} placeholder="0" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={form.start_date} onChange={set('start_date')} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={form.end_date} onChange={set('end_date')} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Visibility</label>
          <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            value={form.visibility} onChange={set('visibility')}>
            <option value="private">Private</option>
            <option value="internal">Internal</option>
            <option value="public">Public</option>
          </select>
        </div>

        <div className="border-t border-gray-100 pt-4 flex items-center justify-between">
          <div className="text-xs text-gray-400">
            Project ID: <code className="font-mono">{project.id}</code>
          </div>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
