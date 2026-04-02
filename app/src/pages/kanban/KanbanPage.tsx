import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';

/**
 * Standalone Kanban Board page at /kanban/:projectId
 * Isolated from the ProjectDetail page so it can be opened directly.
 */
export function KanbanPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  if (!projectId) return null;

  return (
    <div className="flex flex-col h-full">
      {/* Breadcrumb header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => navigate(`/projects/${projectId}`)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Project
        </button>
        <span className="text-sm text-gray-400">/ Kanban Board</span>
      </div>

      {/* Full-height Kanban Board */}
      <div className="flex-1 -mx-6 -mb-6">
        <KanbanBoard projectId={projectId} />
      </div>
    </div>
  );
}
