import { useState, useEffect } from 'react';
import { GitBranch, AlertTriangle, Zap, Clock, ChevronRight, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

interface TaskNode {
  id: string;
  name: string;
  duration_hours: number;
  earliest_start: number;
  earliest_finish: number;
  latest_start: number;
  latest_finish: number;
  float: number;
  is_critical: boolean;
}

interface CriticalPathResult {
  project_id: string;
  critical_path: string[];
  critical_path_names: string[];
  task_data: Record<string, TaskNode>;
  project_duration_hours: number;
  project_duration_days: number;
  total_tasks: number;
  critical_task_count: number;
  error?: string;
}

interface DelaySimResult {
  task_id: string;
  delay_hours_applied: number;
  baseline_project_duration_hours: number;
  delayed_project_duration_hours: number;
  impact_hours: number;
  impact_days: number;
  newly_critical_tasks: string[];
}

interface CriticalPathViewProps {
  projectId: string;
}

export function CriticalPathView({ projectId }: CriticalPathViewProps) {
  const [data, setData] = useState<CriticalPathResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [simResult, setSimResult] = useState<DelaySimResult | null>(null);
  const [simLoading, setSimLoading] = useState(false);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [delayHours, setDelayHours] = useState(8);

  const fetchCriticalPath = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/projects/${projectId}/critical-path`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setData(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCriticalPath(); }, [projectId]);

  const simulateDelay = async () => {
    if (!selectedTask) return;
    setSimLoading(true);
    try {
      const res = await axios.post(
        `${API_URL}/projects/${projectId}/simulate-delay`,
        { task_id: selectedTask, delay_hours: delayHours },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      setSimResult(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setSimLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse h-16" />
        ))}
      </div>
    );
  }

  if (!data || data.error) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
        <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
        <h3 className="font-semibold text-gray-700 mb-1">
          {data?.error === 'circular_dependency' ? 'Circular Dependency Detected!' : 'No task data available'}
        </h3>
        <p className="text-gray-400 text-sm max-w-sm mx-auto">
          {data?.error === 'circular_dependency'
            ? 'Two or more tasks create a circular dependency chain. Please fix the dependencies to use critical path analysis.'
            : 'Create tasks and set up dependencies to compute the critical path.'}
        </p>
      </div>
    );
  }

  const allTasks = Object.values(data.task_data);
  const criticalTasks = allTasks.filter(t => t.is_critical);
  const nonCriticalTasks = allTasks.filter(t => !t.is_critical);

  return (
    <div className="space-y-6">
      {/* Summary Header */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
            <Clock className="w-4 h-4" /> Project Duration
          </div>
          <div className="text-3xl font-bold text-gray-900">{data.project_duration_days}d</div>
          <div className="text-xs text-gray-400 mt-0.5">{data.project_duration_hours}h total</div>
        </div>
        <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-2xl border border-red-100 shadow-sm p-5">
          <div className="flex items-center gap-2 text-red-600 text-sm mb-2">
            <Zap className="w-4 h-4" /> Critical Tasks
          </div>
          <div className="text-3xl font-bold text-red-700">{data.critical_task_count}</div>
          <div className="text-xs text-red-400 mt-0.5">{data.total_tasks} total tasks</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
            <GitBranch className="w-4 h-4" /> Float Tasks
          </div>
          <div className="text-3xl font-bold text-gray-900">{nonCriticalTasks.length}</div>
          <div className="text-xs text-gray-400 mt-0.5">have schedule flexibility</div>
        </div>
      </div>

      {/* Critical Path Flow */}
      {criticalTasks.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-red-500" />
            Critical Path ({data.critical_path_names.length} tasks)
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            {data.critical_path_names.map((name, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm">
                  {name}
                </div>
                {idx < data.critical_path_names.length - 1 && (
                  <ChevronRight className="w-4 h-4 text-red-400 flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Task Data Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 pt-5 pb-3 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Task Analysis</h3>
          <Button variant="ghost" size="sm" onClick={fetchCriticalPath}>
            <RefreshCw className="w-4 h-4 mr-1" /> Refresh
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-y border-gray-100">
                <th className="text-left px-6 py-3 text-gray-500 font-medium text-xs uppercase tracking-wider">Task</th>
                <th className="text-center px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wider">ES</th>
                <th className="text-center px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wider">EF</th>
                <th className="text-center px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wider">LS</th>
                <th className="text-center px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wider">LF</th>
                <th className="text-center px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wider">Float</th>
                <th className="text-center px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {allTasks.map(task => (
                <tr
                  key={task.id}
                  onClick={() => setSelectedTask(task.id === selectedTask ? null : task.id)}
                  className={cn(
                    "cursor-pointer transition-colors",
                    selectedTask === task.id ? "bg-indigo-50" : "hover:bg-gray-50",
                    task.is_critical && "bg-red-50/40 hover:bg-red-50"
                  )}
                >
                  <td className="px-6 py-3 font-medium text-gray-800">
                    <div className="flex items-center gap-2">
                      {task.is_critical && <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />}
                      {task.name}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-500">{task.earliest_start}h</td>
                  <td className="px-4 py-3 text-center text-gray-500">{task.earliest_finish}h</td>
                  <td className="px-4 py-3 text-center text-gray-500">{task.latest_start}h</td>
                  <td className="px-4 py-3 text-center text-gray-500">{task.latest_finish}h</td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn("font-semibold", task.float === 0 ? "text-red-600" : "text-green-600")}>
                      {task.float}h
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {task.is_critical ? (
                      <Badge className="bg-red-100 text-red-700 border-0 text-[10px]">Critical</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">Float {task.float}h</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* What-If Simulator */}
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100 shadow-sm p-6">
        <h3 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
          <Zap className="w-4 h-4 text-indigo-500" /> 
          What-If Delay Simulator
        </h3>
        <p className="text-gray-500 text-sm mb-4">Select a task in the table above, then simulate a delay to see its cascade impact.</p>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="bg-white rounded-lg border border-indigo-200 px-3 py-2 text-sm flex items-center gap-2">
            <span className="text-gray-500">Delay:</span>
            <input
              type="number"
              min={1}
              max={200}
              value={delayHours}
              onChange={e => setDelayHours(Number(e.target.value))}
              className="w-16 text-gray-800 font-semibold outline-none"
            />
            <span className="text-gray-400">hours</span>
          </div>
          <Button
            onClick={simulateDelay}
            disabled={!selectedTask || simLoading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
            size="sm"
          >
            {simLoading ? 'Simulating...' : 'Simulate Delay'}
          </Button>
          {selectedTask && (
            <span className="text-xs text-indigo-600 font-medium">
              Selected: {data.task_data[selectedTask]?.name}
            </span>
          )}
        </div>

        {simResult && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl p-3 text-center shadow-sm">
              <div className="text-xs text-gray-400 mb-1">Baseline</div>
              <div className="font-bold text-gray-800">{simResult.baseline_project_duration_hours}h</div>
            </div>
            <div className="bg-white rounded-xl p-3 text-center shadow-sm">
              <div className="text-xs text-gray-400 mb-1">After Delay</div>
              <div className="font-bold text-gray-800">{simResult.delayed_project_duration_hours}h</div>
            </div>
            <div className="bg-red-50 rounded-xl p-3 text-center shadow-sm col-span-2">
              <div className="text-xs text-red-400 mb-1">Impact</div>
              <div className="font-bold text-red-700">
                +{simResult.impact_hours}h (+{simResult.impact_days} days)
              </div>
              {simResult.newly_critical_tasks.length > 0 && (
                <div className="text-xs text-red-400 mt-1">
                  {simResult.newly_critical_tasks.length} tasks become critical
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
