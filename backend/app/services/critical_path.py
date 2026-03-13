"""Critical path analysis service — Topological sort + longest path algorithm."""

from collections import defaultdict, deque
from typing import Dict, List, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.task import Task, TaskDependency

logger = get_logger(__name__)


class CriticalPathService:
    """
    Computes the Critical Path for a project using topological sort.
    Uses the standard CPM (Critical Path Method) algorithm:
      - Forward pass: earliest start/finish for each task
      - Backward pass: latest start/finish for each task
      - Float = Latest Start - Earliest Start (0 float = critical)
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_project_tasks(self, project_id: str) -> List[Task]:
        """Fetch all tasks for a given project."""
        result = await self.db.execute(
            select(Task).where(Task.project_id == project_id)
        )
        return list(result.scalars().all())

    async def get_project_dependencies(self, project_id: str) -> List[TaskDependency]:
        """Fetch all task dependencies for a project."""
        # Join through tasks to filter by project
        result = await self.db.execute(
            select(TaskDependency)
            .join(Task, TaskDependency.task_id == Task.id)
            .where(Task.project_id == project_id)
        )
        return list(result.scalars().all())

    def detect_cycle(
        self,
        task_ids: List[str],
        dependencies: List[TaskDependency],
    ) -> Optional[List[str]]:
        """
        Detect circular dependencies using DFS coloring.
        Returns the cycle path if found, else None.
        """
        # Build adjacency: task_id -> [depends_on_ids]
        graph: Dict[str, List[str]] = defaultdict(list)
        for dep in dependencies:
            graph[dep.task_id].append(dep.depends_on_id)

        WHITE, GRAY, BLACK = 0, 1, 2
        color = {tid: WHITE for tid in task_ids}
        parent: Dict[str, Optional[str]] = {tid: None for tid in task_ids}

        def dfs(node: str) -> Optional[List[str]]:
            color[node] = GRAY
            for neighbor in graph.get(node, []):
                if color.get(neighbor) == GRAY:
                    # Found cycle — reconstruct path
                    cycle = [neighbor]
                    cur = node
                    while cur != neighbor:
                        cycle.append(cur)
                        cur = parent.get(cur, "")
                    cycle.append(neighbor)
                    return list(reversed(cycle))
                if color.get(neighbor) == WHITE:
                    parent[neighbor] = node
                    result = dfs(neighbor)
                    if result:
                        return result
            color[node] = BLACK
            return None

        for tid in task_ids:
            if color[tid] == WHITE:
                cycle = dfs(tid)
                if cycle:
                    return cycle
        return None

    def _build_graph(
        self,
        tasks: List[Task],
        dependencies: List[TaskDependency],
    ) -> Tuple[Dict[str, List[str]], Dict[str, List[str]], Dict[str, float]]:
        """
        Build adjacency lists and duration map.
        predecessors[task_id] = list of tasks that must complete before task_id
        successors[task_id] = list of tasks that depend on task_id
        durations[task_id] = estimated_hours (default 1 day = 8h)
        """
        predecessors: Dict[str, List[str]] = defaultdict(list)
        successors: Dict[str, List[str]] = defaultdict(list)
        durations: Dict[str, float] = {}

        for task in tasks:
            # Duration in hours, default 8h if unset
            durations[task.id] = task.estimated_hours or 8.0

        for dep in dependencies:
            # dep.task_id depends on dep.depends_on_id
            predecessors[dep.task_id].append(dep.depends_on_id)
            successors[dep.depends_on_id].append(dep.task_id)

        return predecessors, successors, durations

    def _topological_sort(
        self, task_ids: List[str], predecessors: Dict[str, List[str]]
    ) -> List[str]:
        """Kahn's algorithm for topological ordering."""
        in_degree = {tid: len(predecessors.get(tid, [])) for tid in task_ids}
        queue = deque([tid for tid in task_ids if in_degree[tid] == 0])
        order = []

        # Build successor map from predecessors
        successors: Dict[str, List[str]] = defaultdict(list)
        for tid in task_ids:
            for pred in predecessors.get(tid, []):
                successors[pred].append(tid)

        while queue:
            node = queue.popleft()
            order.append(node)
            for succ in successors.get(node, []):
                in_degree[succ] -= 1
                if in_degree[succ] == 0:
                    queue.append(succ)

        return order

    def compute_critical_path(
        self,
        tasks: List[Task],
        dependencies: List[TaskDependency],
    ) -> dict:
        """
        Run CPM algorithm and return critical path details.
        Returns:
          - critical_path: ordered list of task IDs on critical path
          - task_data: per-task ES, EF, LS, LF, float
          - project_duration: total minimum project duration
        """
        if not tasks:
            return {"critical_path": [], "task_data": {}, "project_duration": 0}

        task_ids = [t.id for t in tasks]
        task_name_map = {t.id: t.title for t in tasks}
        preds, succs, durations = self._build_graph(tasks, dependencies)

        # --- Topological order ---
        topo = self._topological_sort(task_ids, preds)

        # --- Forward pass: compute ES (Earliest Start) and EF (Earliest Finish) ---
        ES: Dict[str, float] = {tid: 0.0 for tid in task_ids}
        EF: Dict[str, float] = {}

        for tid in topo:
            es = max((EF.get(pred, 0.0) for pred in preds.get(tid, [])), default=0.0)
            ES[tid] = es
            EF[tid] = es + durations.get(tid, 8.0)

        project_duration = max(EF.values(), default=0.0)

        # --- Backward pass: compute LF (Latest Finish) and LS (Latest Start) ---
        LF: Dict[str, float] = {}
        LS: Dict[str, float] = {}

        for tid in reversed(topo):
            lf = min(
                (LS.get(succ, project_duration) for succ in succs.get(tid, [])),
                default=project_duration,
            )
            LF[tid] = lf
            LS[tid] = lf - durations.get(tid, 8.0)

        # --- Float and Critical Flag ---
        task_data = {}
        for tid in task_ids:
            float_val = round(LS.get(tid, 0) - ES.get(tid, 0), 2)
            task_data[tid] = {
                "id": tid,
                "name": task_name_map.get(tid, tid),
                "duration_hours": durations.get(tid, 8.0),
                "earliest_start": round(ES.get(tid, 0), 2),
                "earliest_finish": round(EF.get(tid, 0), 2),
                "latest_start": round(LS.get(tid, 0), 2),
                "latest_finish": round(LF.get(tid, 0), 2),
                "float": float_val,
                "is_critical": float_val <= 0,
            }

        critical_path = [tid for tid in topo if task_data[tid]["is_critical"]]

        return {
            "critical_path": critical_path,
            "critical_path_names": [task_data[tid]["name"] for tid in critical_path],
            "task_data": task_data,
            "project_duration_hours": round(project_duration, 2),
            "project_duration_days": round(project_duration / 8, 1),
        }

    async def analyze_project(self, project_id: str) -> dict:
        """Full critical path analysis for a project."""
        tasks = await self.get_project_tasks(project_id)
        dependencies = await self.get_project_dependencies(project_id)

        task_ids = [t.id for t in tasks]

        # Check for cycles first
        cycle = self.detect_cycle(task_ids, dependencies)
        if cycle:
            return {
                "error": "circular_dependency",
                "message": "Circular dependency detected in project tasks",
                "cycle": cycle,
            }

        result = self.compute_critical_path(tasks, dependencies)
        result["project_id"] = project_id
        result["total_tasks"] = len(tasks)
        result["critical_task_count"] = len(result.get("critical_path", []))
        return result

    async def simulate_delay(
        self, project_id: str, task_id: str, delay_hours: float
    ) -> dict:
        """
        What-if analysis: simulate the delay of a task and show cascade impact.
        """
        tasks = await self.get_project_tasks(project_id)
        dependencies = await self.get_project_dependencies(project_id)

        # Run baseline
        baseline = self.compute_critical_path(tasks, dependencies)

        # Apply delay: artificially extend the task's duration
        for task in tasks:
            if task.id == task_id:
                task.estimated_hours = (task.estimated_hours or 8.0) + delay_hours
                break

        # Recompute with delay
        delayed = self.compute_critical_path(tasks, dependencies)

        baseline_duration = baseline.get("project_duration_hours", 0)
        delayed_duration = delayed.get("project_duration_hours", 0)
        impact_hours = delayed_duration - baseline_duration

        return {
            "task_id": task_id,
            "delay_hours_applied": delay_hours,
            "baseline_project_duration_hours": baseline_duration,
            "delayed_project_duration_hours": delayed_duration,
            "impact_hours": round(impact_hours, 2),
            "impact_days": round(impact_hours / 8, 1),
            "newly_critical_tasks": [
                tid for tid in delayed.get("critical_path", [])
                if tid not in baseline.get("critical_path", [])
            ],
            "delayed_task_data": delayed.get("task_data", {}),
        }
