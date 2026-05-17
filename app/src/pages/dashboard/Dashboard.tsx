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
import { ErrorBoundary } from '@/components/ErrorBoundary';

export function Dashboard() {
  const { user } = useAuthStore();
  const { stats, fetchAll } = useDashboardStore();

  // Fetch both stats and project progress in parallel on mount
  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    const wsUrl = `ws://localhost:8000/ws/${user.id}`;
    let ws: WebSocket | null = null;

    const connect = () => {
      ws = new WebSocket(wsUrl);
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'dashboard_update' && data.action === 'reload') {
            // Re-fetch in the background, no spinner
            useDashboardStore.getState().fetchAll();
          }
        } catch {
          // ignore parse errors
        }
      };
      ws.onerror = () => ws?.close();
    };

    connect();
    return () => ws?.close();
  }, [user?.id]);

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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Welcome back, {user?.firstName || user?.email?.split('@')[0] || 'there'}! 👋
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Here&apos;s what&apos;s happening with your projects today.
          </p>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-sm text-gray-500">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ErrorBoundary>
          <StatCard
            title="Total Projects"
            value={currentStats.total_projects}
            description={`${currentStats.active_projects} active`}
            icon={FolderKanban}
            color="blue"
          />
        </ErrorBoundary>
        <ErrorBoundary>
          <StatCard
            title="My Tasks"
            value={currentStats.my_tasks}
            description={`${currentStats.my_tasks_completed} completed`}
            icon={CheckSquare}
            color="green"
          />
        </ErrorBoundary>
        <ErrorBoundary>
          <StatCard
            title="Hours Logged"
            value={`${currentStats.hours_logged}h`}
            description={`${currentStats.hours_this_month}h this month`}
            icon={Clock}
            color="purple"
          />
        </ErrorBoundary>
        <ErrorBoundary>
          <StatCard
            title="Team Members"
            value={currentStats.team_members}
            description="Across your projects"
            icon={Users}
            color="yellow"
          />
        </ErrorBoundary>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - 2/3 width */}
        <div className="lg:col-span-2 space-y-6">
          {/* Project Progress */}
          <ErrorBoundary>
            <ProjectChart />
          </ErrorBoundary>

          {/* Activity Feed */}
          <ErrorBoundary>
            <ActivityFeed limit={5} />
          </ErrorBoundary>
        </div>

        {/* Right Column - 1/3 width */}
        <div className="space-y-6">
          {/* My Tasks */}
          <ErrorBoundary>
            <MyTasksWidget limit={5} />
          </ErrorBoundary>

          {/* Team Workload */}
          <ErrorBoundary>
            <TeamWidget />
          </ErrorBoundary>

          {/* Quick Stats */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Quick Stats</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">In Progress</span>
                </div>
                <span className="font-semibold text-gray-900 dark:text-white">{currentStats.my_tasks_in_progress}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Overdue</span>
                </div>
                <span className="font-semibold text-red-600">{currentStats.overdue_tasks}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-yellow-100 flex items-center justify-center">
                    <Calendar className="w-4 h-4 text-yellow-600" />
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Due this week</span>
                </div>
                <span className="font-semibold text-gray-900 dark:text-white">{currentStats.due_this_week}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

