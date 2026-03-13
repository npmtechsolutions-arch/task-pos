import { useEffect } from 'react';
import {
  FolderKanban,
  CheckSquare,
  Clock,
  Users,
  TrendingUp,
  AlertCircle,
  Calendar
} from 'lucide-react';
import { useAuthStore, useDashboardStore } from '@/stores';
import { StatCard } from '@/components/dashboard/StatCard';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { MyTasksWidget } from '@/components/dashboard/MyTasksWidget';
import { ProjectChart } from '@/components/dashboard/ProjectChart';
import { TeamWidget } from '@/components/dashboard/TeamWidget';

export function Dashboard() {
  const { user } = useAuthStore();
  const { stats, fetchStats, isLoadingStats } = useDashboardStore();

  useEffect(() => {
    if (!stats && !isLoadingStats) {
      fetchStats();
    }
  }, [stats, fetchStats, isLoadingStats]);

  const defaultStats = {
    total_projects: 0,
    active_projects: 0,
    my_tasks: 0,
    my_tasks_completed: 0,
    my_tasks_in_progress: 0,
    overdue_tasks: 0,
    due_this_week: 0,
    hours_logged: 0,
    hours_this_month: 0,
    team_members: 0,
  };

  const currentStats = stats || defaultStats;

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user?.firstName}! 👋
          </h1>
          <p className="text-gray-500 mt-1">
            Here&apos;s what&apos;s happening with your projects today.
          </p>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-sm text-gray-500">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Projects"
          value={currentStats.total_projects}
          description={`${currentStats.active_projects} active`}
          icon={FolderKanban}
          color="blue"
        />
        <StatCard
          title="My Tasks"
          value={currentStats.my_tasks}
          description={`${currentStats.my_tasks_completed} completed`}
          icon={CheckSquare}
          color="green"
        />
        <StatCard
          title="Hours Logged"
          value={`${currentStats.hours_logged}h`}
          description={`${currentStats.hours_this_month}h this month`}
          icon={Clock}
          color="purple"
        />
        <StatCard
          title="Team Members"
          value={currentStats.team_members}
          description="Across your projects"
          icon={Users}
          color="yellow"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - 2/3 width */}
        <div className="lg:col-span-2 space-y-6">
          {/* Project Progress */}
          <ProjectChart />

          {/* Activity Feed */}
          <ActivityFeed limit={5} />
        </div>

        {/* Right Column - 1/3 width */}
        <div className="space-y-6">
          {/* My Tasks */}
          <MyTasksWidget limit={5} />

          {/* Team Workload */}
          <TeamWidget />

          {/* Quick Stats */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-4">Quick Stats</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="text-sm text-gray-600">In Progress</span>
                </div>
                <span className="font-semibold text-gray-900">{currentStats.my_tasks_in_progress}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                  </div>
                  <span className="text-sm text-gray-600">Overdue</span>
                </div>
                <span className="font-semibold text-red-600">{currentStats.overdue_tasks}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-yellow-100 flex items-center justify-center">
                    <Calendar className="w-4 h-4 text-yellow-600" />
                  </div>
                  <span className="text-sm text-gray-600">Due this week</span>
                </div>
                <span className="font-semibold text-gray-900">{currentStats.due_this_week}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

