import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Filter, 
  Grid3X3, 
  List, 
  MoreHorizontal,
  Calendar,
  CheckSquare,
  Users,
  Archive,
  Loader2
} from 'lucide-react';
import { cn, formatDate, getProjectStatusColor } from '@/lib/utils';
import { useProjectStore, useUIStore } from '@/stores';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { ProjectForm } from '@/components/projects/ProjectForm';
import { EmptyState } from '@/components/common/EmptyState';
import { PROJECT_STATUSES } from '@/lib/constants';
import type { Project } from '@/types';

export function ProjectsList() {
  const { filters, setFilters, getFilteredProjects, fetchProjects, isLoading } = useProjectStore();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch projects from PostgreSQL on mount
  useEffect(() => {
    fetchProjects();
  }, []);

  const filteredProjects = getFilteredProjects();

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setFilters({ ...filters, search: value });
  };

  const handleStatusFilter = (value: string) => {
    setFilters({ ...filters, status: value as any });
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
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-500 mt-1">
            Manage and track all your projects
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Create New Project</DialogTitle>
              <DialogDescription>
                Fill in the details below to create a new project.
              </DialogDescription>
            </DialogHeader>
            <ProjectForm onSuccess={() => setIsDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Select
            value={filters.status || 'all'}
            onValueChange={handleStatusFilter}
          >
            <SelectTrigger className="w-[140px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {PROJECT_STATUSES.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex border rounded-lg overflow-hidden">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('grid')}
              className={cn(
                'rounded-none',
                viewMode === 'grid' && 'bg-blue-600 hover:bg-blue-700'
              )}
            >
              <Grid3X3 className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('list')}
              className={cn(
                'rounded-none',
                viewMode === 'list' && 'bg-blue-600 hover:bg-blue-700'
              )}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Active Filters */}
      {(filters.status || filters.search) && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Filters:</span>
          {filters.status && (
            <Badge variant="secondary" className="gap-1">
              Status: {PROJECT_STATUSES.find(s => s.value === filters.status)?.label}
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

      {/* Projects Grid/List */}
      {isLoading && (
        <div className="flex items-center justify-center h-32">
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Loading projects from database…
          </div>
        </div>
      )}
      {!isLoading && filteredProjects.length === 0 ? (
        <EmptyState
          icon={viewMode === 'grid' ? Grid3X3 : List}
          title="No projects found"
          description={
            filters.status || filters.search
              ? "Try adjusting your filters to see more results."
              : "Get started by creating your first project."
          }
          action={
            filters.status || filters.search
              ? { label: 'Clear filters', onClick: clearFilters }
              : { label: 'Create project', onClick: () => setIsDialogOpen(true) }
          }
        />
      ) : !isLoading && viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      ) : (
        <ProjectListTable projects={filteredProjects} />
      )}
    </div>
  );
}

interface ProjectCardProps {
  project: Project;
}

function ProjectCard({ project }: ProjectCardProps) {
  const { archiveProjectApi } = useProjectStore();
  const { addToast } = useUIStore();
  const [isArchiving, setIsArchiving] = useState(false);

  const handleArchive = async () => {
    if (!window.confirm(`Archive "${project.name}"? It will be removed from the active list.`)) return;
    setIsArchiving(true);
    try {
      await archiveProjectApi(project.id);
      addToast({ type: 'success', title: 'Project archived', message: `"${project.name}" has been archived.` });
    } catch {
      addToast({ type: 'error', title: 'Archive failed', message: 'Could not archive the project. Please try again.' });
    } finally {
      setIsArchiving(false);
    }
  };
  return (
    <Card className="hover:shadow-md transition-shadow group">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <span className="text-blue-600 font-bold text-sm">{project.key}</span>
            </div>
            <div>
              <Link
                to={`/projects/${project.id}`}
                className="font-semibold text-gray-900 hover:text-blue-600 transition-colors"
              >
                {project.name}
              </Link>
              <Badge
                variant="secondary"
                className={cn('text-xs mt-1', getProjectStatusColor(project.status))}
              >
                {project.status}
              </Badge>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link to={`/projects/${project.id}`}>View Details</Link>
              </DropdownMenuItem>
              <DropdownMenuItem className="text-red-600" onClick={handleArchive} disabled={isArchiving}>
                {isArchiving ? (
                  <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Archiving…</>
                ) : (
                  <><Archive className="w-3.5 h-3.5 mr-1" /> Archive</>
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <p className="text-sm text-gray-500 line-clamp-2 mb-4">
          {project.description || 'No description provided'}
        </p>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Progress</span>
            <span className="font-medium">{project.progress}%</span>
          </div>
          <Progress value={project.progress} className="h-2" />
        </div>

        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <CheckSquare className="w-4 h-4" />
              <span>{project.completedTaskCount}/{project.taskCount}</span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              <span>{project.members.length}</span>
            </div>
          </div>
          {project.endDate && (
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <Calendar className="w-4 h-4" />
              <span>{formatDate(project.endDate, 'MMM d')}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface ProjectListTableProps {
  projects: Project[];
}

function ProjectListTable({ projects }: ProjectListTableProps) {
  const { archiveProjectApi } = useProjectStore();
  const { addToast } = useUIStore();
  const [archivingId, setArchivingId] = useState<string | null>(null);

  const handleArchive = async (project: Project) => {
    if (!window.confirm(`Archive "${project.name}"? It will be removed from the active list.`)) return;
    setArchivingId(project.id);
    try {
      await archiveProjectApi(project.id);
      addToast({ type: 'success', title: 'Project archived', message: `"${project.name}" has been archived.` });
    } catch {
      addToast({ type: 'error', title: 'Archive failed', message: 'Could not archive. Please try again.' });
    } finally {
      setArchivingId(null);
    }
  };
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Project</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Status</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Progress</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Tasks</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Due Date</th>
            <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {projects.map((project) => (
            <tr key={project.id} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-blue-100 flex items-center justify-center">
                    <span className="text-blue-600 font-bold text-xs">{project.key}</span>
                  </div>
                  <div>
                    <Link
                      to={`/projects/${project.id}`}
                      className="font-medium text-gray-900 hover:text-blue-600"
                    >
                      {project.name}
                    </Link>
                    <p className="text-sm text-gray-500 truncate max-w-xs">
                      {project.description}
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">
                <Badge variant="secondary" className={getProjectStatusColor(project.status)}>
                  {project.status}
                </Badge>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <Progress value={project.progress} className="w-20 h-2" />
                  <span className="text-sm text-gray-600">{project.progress}%</span>
                </div>
              </td>
              <td className="px-4 py-3">
                <span className="text-sm text-gray-600">
                  {project.completedTaskCount}/{project.taskCount}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className="text-sm text-gray-600">
                  {project.endDate ? formatDate(project.endDate, 'MMM d, yyyy') : '—'}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link to={`/projects/${project.id}`}>View Details</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-red-600"
                      onClick={() => handleArchive(project)}
                      disabled={archivingId === project.id}
                    >
                      {archivingId === project.id ? (
                        <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Archiving…</>
                      ) : (
                        <><Archive className="w-3.5 h-3.5 mr-1" /> Archive</>
                      )}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
