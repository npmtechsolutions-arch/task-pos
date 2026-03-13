import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MoreHorizontal, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useDashboardStore } from '@/stores';
import { cn } from '@/lib/utils';
import type { ProjectProgress } from '@/api/dashboard';

interface ProjectProgressItemProps {
  project: ProjectProgress;
}

function ProjectProgressItem({ project }: ProjectProgressItemProps) {
  return (
    <Link
      to={`/projects/${project.project_id}`}
      className="block p-4 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50/50 transition-colors mb-3"
    >
      <div className="flex items-center justify-between mb-2">
        <div>
          <h4 className="font-medium text-gray-900">{project.name}</h4>
          <p className="text-sm text-gray-500">{project.key}</p>
        </div>
        <div className="text-right">
          <span className={cn(
            'text-lg font-semibold',
            project.progress_percentage === 100 ? 'text-green-600' : 'text-blue-600'
          )}>
            {project.progress_percentage}%
          </span>
        </div>
      </div>
      
      <Progress 
        value={project.progress_percentage} 
        className="h-2 mb-2"
      />
      
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>{project.completed_tasks} of {project.total_tasks} tasks completed</span>
        {project.progress_percentage === 100 && (
          <span className="text-green-600 font-medium">Completed</span>
        )}
      </div>
    </Link>
  );
}

export function ProjectChart() {
  const { projectsProgress, fetchProjectsProgress, isLoadingProjects } = useDashboardStore();

  useEffect(() => {
    if (!projectsProgress && !isLoadingProjects) {
      fetchProjectsProgress();
    }
  }, [projectsProgress, fetchProjectsProgress, isLoadingProjects]);

  const stats = projectsProgress || {
    total: 0,
    active: 0,
    completed: 0,
    avg_progress: 0,
  };
  
  const activeProjects = projectsProgress?.projects
    ? [...projectsProgress.projects]
        .filter((p) => p.status === 'active')
        .sort((a, b) => b.progress_percentage - a.progress_percentage)
        .slice(0, 4)
    : [];

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          <CardTitle className="text-lg font-semibold">Project Progress</CardTitle>
        </div>
        <Button variant="ghost" size="icon">
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {/* Stats Overview */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            <p className="text-xs text-gray-500">Total</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{stats.active}</p>
            <p className="text-xs text-gray-500">Active</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
            <p className="text-xs text-gray-500">Completed</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-600">{stats.avg_progress}%</p>
            <p className="text-xs text-gray-500">Avg Progress</p>
          </div>
        </div>

        {/* Project List */}
        <div className="space-y-3">
          {isLoadingProjects ? (
            <div className="text-center text-sm text-gray-500 py-4">Loading projects...</div>
          ) : activeProjects.length === 0 ? (
            <div className="text-center text-sm text-gray-500 py-4">No active projects</div>
          ) : (
            activeProjects.map((project) => (
              <ProjectProgressItem key={project.project_id} project={project} />
            ))
          )}
        </div>

        <Button variant="ghost" className="w-full mt-4 text-blue-600 hover:text-blue-700" asChild>
          <Link to="/projects">View all projects</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

