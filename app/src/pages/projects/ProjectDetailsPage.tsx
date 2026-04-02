import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Edit2, Save, X, Loader2, DollarSign, Target,
  Calendar, Users, Building2, Tag, BarChart3, Kanban, Flag
} from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
const authHeader = () => {
  const t = localStorage.getItem('token') || localStorage.getItem('access_token');
  return t ? { Authorization: `Bearer ${t}` } : {};
};

const STATUS_COLORS: Record<string, string> = {
  draft:     'bg-gray-100 text-gray-600',
  planning:  'bg-blue-100 text-blue-700',
  active:    'bg-green-100 text-green-700',
  on_hold:   'bg-amber-100 text-amber-700',
  completed: 'bg-indigo-100 text-indigo-700',
  cancelled: 'bg-red-100 text-red-700',
  archived:  'bg-slate-100 text-slate-600',
};

interface EditableFields {
  name: string;
  description: string;
  budget: string;
  objectives: string;
  department: string;
  business_unit: string;
}

/**
 * Standalone Project Details page at /projects/:projectId/details
 * Shows all editable metadata fields for the project with inline editing.
 */
export function ProjectDetailsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { projects, currentProject, isLoadingDetail, fetchProjectById } = useProjectStore();

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const project = projects.find((p) => p.id === projectId) ?? currentProject;

  const [fields, setFields] = useState<EditableFields>({
    name: '',
    description: '',
    budget: '',
    objectives: '',
    department: '',
    business_unit: '',
  });

  useEffect(() => {
    if (projectId) fetchProjectById(projectId);
  }, [projectId]);

  useEffect(() => {
    if (project) {
      setFields({
        name: project.name ?? '',
        description: project.description ?? '',
        budget: String((project as any).budget ?? ''),
        objectives: (project as any).objectives ?? '',
        department: (project as any).department ?? '',
        business_unit: (project as any).business_unit ?? '',
      });
    }
  }, [project]);

  const handleSave = async () => {
    if (!projectId) return;
    setSaving(true); setError('');
    try {
      await axios.patch(`${API_URL}/projects/${projectId}`, {
        name: fields.name,
        description: fields.description,
        budget: fields.budget ? parseFloat(fields.budget) : undefined,
      }, { headers: authHeader() });
      setIsEditing(false);
      fetchProjectById(projectId);
    } catch (e: any) {
      setError(e.response?.data?.detail ?? 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  if (isLoadingDetail && !project) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p className="text-lg font-medium">Project not found</p>
        <Link to="/projects" className="text-indigo-600 text-sm mt-2 inline-block hover:underline">
          ← Back to projects
        </Link>
      </div>
    );
  }

  const progress = project.progress ?? 0;
  const statusClass = STATUS_COLORS[project.status] ?? STATUS_COLORS.draft;

  return (
    <div className="max-w-4xl mx-auto">
      {/* ── Breadcrumb ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <Link to="/projects" className="hover:text-gray-700 transition-colors">Projects</Link>
        <span>/</span>
        <Link to={`/projects/${projectId}`} className="hover:text-gray-700 transition-colors truncate max-w-[200px]">
          {project.name}
        </Link>
        <span>/</span>
        <span className="text-gray-700 font-medium">Details</span>
      </div>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl shadow-md flex-shrink-0">
              {project.key?.slice(0, 2).toUpperCase() ?? 'PR'}
            </div>
            <div>
              {isEditing ? (
                <input
                  className="text-2xl font-bold text-gray-900 dark:text-white border-b-2 border-indigo-400 bg-transparent focus:outline-none w-full"
                  value={fields.name}
                  onChange={e => setFields(f => ({ ...f, name: e.target.value }))}
                />
              ) : (
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{project.name}</h1>
              )}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge className={cn('text-xs border-0 capitalize', statusClass)}>
                  {project.status?.replace('_', ' ')}
                </Badge>
                <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded font-mono">
                  {project.key}
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-2 flex-shrink-0">
            {isEditing ? (
              <>
                <Button size="sm" variant="outline" onClick={() => setIsEditing(false)} disabled={saving}>
                  <X className="w-4 h-4 mr-1" /> Cancel
                </Button>
                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                  Save
                </Button>
              </>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
                <Edit2 className="w-4 h-4 mr-1" /> Edit Details
              </Button>
            )}
          </div>
        </div>
        {error && <p className="text-sm text-red-500 mt-3 bg-red-50 rounded-lg p-3">{error}</p>}
      </div>

      {/* ── Quick Actions ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Kanban Board', icon: Kanban, href: `/kanban/${projectId}`, color: 'bg-purple-600' },
          { label: 'Phases',       icon: Flag,   href: `/projects/${projectId}?tab=phases`,      color: 'bg-blue-600' },
          { label: 'Milestones',   icon: Target, href: `/projects/${projectId}?tab=milestones`,  color: 'bg-emerald-600' },
          { label: 'Team',         icon: Users,  href: `/projects/${projectId}?tab=team`,        color: 'bg-amber-600' },
        ].map(action => {
          const Icon = action.icon;
          return (
            <Link
              key={action.label}
              to={action.href}
              className={cn(
                'flex items-center gap-3 p-4 rounded-xl text-white font-medium text-sm hover:opacity-90 transition-opacity',
                action.color
              )}
            >
              <Icon className="w-5 h-5" />
              {action.label}
            </Link>
          );
        })}
      </div>

      {/* ── Stats ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Tasks',    value: project.taskCount ?? 0,       icon: BarChart3,  color: 'text-indigo-600' },
          { label: 'Progress', value: `${Math.round(progress)}%`,   icon: Target,     color: 'text-green-600' },
          { label: 'Members',  value: project.members?.length ?? 0, icon: Users,      color: 'text-blue-600' },
          { label: 'Budget',   value: (project as any).budget ? `$${((project as any).budget).toLocaleString()}` : '—', icon: DollarSign, color: 'text-amber-600' },
        ].map(stat => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon className={cn('w-4 h-4', stat.color)} />
                <span className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</span>
              </div>
              <div className={cn('text-2xl font-bold', stat.color)}>{stat.value}</div>
              {stat.label === 'Progress' && (
                <div className="mt-2 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: `${progress}%` }} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Editable Details Grid ─────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 space-y-6">
        <h2 className="text-base font-bold text-gray-800 dark:text-white">Project Information</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Description */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Description</label>
            {isEditing ? (
              <textarea
                rows={3}
                className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
                value={fields.description}
                onChange={e => setFields(f => ({ ...f, description: e.target.value }))}
              />
            ) : (
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {project.description || <span className="italic text-gray-400">No description provided</span>}
              </p>
            )}
          </div>

          {/* Budget */}
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1 flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5" /> Budget
            </label>
            {isEditing ? (
              <input
                type="number"
                className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                value={fields.budget}
                onChange={e => setFields(f => ({ ...f, budget: e.target.value }))}
                placeholder="0.00"
              />
            ) : (
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {(project as any).budget ? `$${((project as any).budget).toLocaleString()}` : <span className="italic text-gray-400">Not set</span>}
              </p>
            )}
          </div>

          {/* Start / End dates */}
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> Timeline
            </label>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {(project as any).startDate
                ? `${new Date((project as any).startDate).toLocaleDateString()} → ${(project as any).endDate ? new Date((project as any).endDate).toLocaleDateString() : 'TBD'}`
                : <span className="italic text-gray-400">No timeline set</span>
              }
            </p>
          </div>

          {/* Department */}
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5" /> Department
            </label>
            {isEditing ? (
              <input
                className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                value={fields.department}
                onChange={e => setFields(f => ({ ...f, department: e.target.value }))}
                placeholder="e.g. Engineering"
              />
            ) : (
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {fields.department || <span className="italic text-gray-400">Not set</span>}
              </p>
            )}
          </div>

          {/* Business Unit */}
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1 flex items-center gap-1">
              <Tag className="w-3.5 h-3.5" /> Business Unit
            </label>
            {isEditing ? (
              <input
                className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                value={fields.business_unit}
                onChange={e => setFields(f => ({ ...f, business_unit: e.target.value }))}
                placeholder="e.g. Core Platform"
              />
            ) : (
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {fields.business_unit || <span className="italic text-gray-400">Not set</span>}
              </p>
            )}
          </div>
        </div>

        {/* Members */}
        {project.members && project.members.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-2 flex items-center gap-1">
              <Users className="w-3.5 h-3.5" /> Team Members
            </label>
            <div className="flex flex-wrap gap-2">
              {project.members.map((m: any) => (
                <div key={m.id ?? m.userId} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-full px-3 py-1.5">
                  <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold">
                    {(m.user?.firstName ?? m.firstName ?? '?')[0]?.toUpperCase()}
                  </div>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {m.user?.fullName ?? m.fullName ?? m.user?.email ?? m.email ?? 'Unknown'}
                  </span>
                  <span className="text-[10px] text-gray-400 capitalize">{m.role}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
