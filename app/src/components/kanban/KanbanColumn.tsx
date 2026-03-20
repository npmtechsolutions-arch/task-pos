import { useRef, useState, memo, useCallback } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { KanbanTaskCard } from '@/api/kanban';
import type { SwimlaneMode, WipMode } from '@/stores/kanbanStore';
import { useKanbanStore } from '@/stores/kanbanStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { KanbanCard } from './KanbanCard';

interface KanbanColumnProps {
  id: string;
  name: string;
  color: string;
  wipLimit?: number;
  wipMode: WipMode;
  swimlaneMode: SwimlaneMode;
  tasks: KanbanTaskCard[];
  count: number;
  projectId: string;
}

const COLUMN_TYPE_COLORS: Record<string, string> = {
  todo: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  review: 'bg-amber-100 text-amber-700',
  done: 'bg-green-100 text-green-700',
  backlog: 'bg-slate-100 text-slate-600',
  archive: 'bg-purple-100 text-purple-600',
};

export const KanbanColumn = memo(function KanbanColumn({
  id, name, color, wipLimit, wipMode, swimlaneMode, tasks, count, projectId,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const { getSwimlanes, quickAddTask } = useKanbanStore();

  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const swimlanes = getSwimlanes(id);
  const isExceeded = wipLimit !== undefined && count >= wipLimit;
  const colColorClass = COLUMN_TYPE_COLORS[id] || 'bg-gray-100 text-gray-700';

  const handleStartAdd = () => {
    setIsAdding(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleQuickAdd = useCallback(async () => {
    if (!newTitle.trim()) { setIsAdding(false); return; }
    setIsSubmitting(true);
    await quickAddTask(id, newTitle.trim(), projectId);
    setNewTitle('');
    setIsSubmitting(false);
    setIsAdding(false);
  }, [newTitle, id, projectId, quickAddTask]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleQuickAdd();
    if (e.key === 'Escape') { setIsAdding(false); setNewTitle(''); }
  };

  return (
    <div
      className={cn(
        'w-72 flex-shrink-0 flex flex-col rounded-xl transition-colors duration-150',
        isOver && !isExceeded && 'bg-indigo-50/60',
        isOver && isExceeded && wipMode !== 'visual' && 'bg-red-50/60',
      )}
    >
      {/* ── Column Header ──────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-3 py-2.5 mb-1 rounded-t-xl"
        style={{ borderTop: `3px solid ${color || '#E5E7EB'}` }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="font-semibold text-gray-900 text-sm truncate">{name}</h3>
          <span
            className={cn(
              'px-1.5 py-0.5 text-xs font-semibold rounded-full tabular-nums',
              isExceeded ? 'bg-red-100 text-red-700' : colColorClass,
            )}
          >
            {count}
            {wipLimit && <span className="text-[10px] opacity-60">/{wipLimit}</span>}
          </span>
          {isExceeded && (
            <AlertTriangle
              className="w-3.5 h-3.5 text-red-500 flex-shrink-0"
              aria-label={`WIP limit ${wipLimit} exceeded`}
            />
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-gray-400 hover:text-indigo-600 flex-shrink-0"
          onClick={handleStartAdd}
          title="Add a card"
        >
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* ── Cards area ─────────────────────────────────────────────────── */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 rounded-b-xl p-2 min-h-[160px] space-y-1.5 transition-colors',
          'bg-gray-100/60',
          isOver && !isExceeded && 'bg-indigo-100/40',
        )}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {swimlaneMode === 'none' ? (
            tasks.map((task) => <KanbanCard key={task.id} task={task} />)
          ) : (
            swimlanes.map((lane) => (
              <div key={lane.id}>
                {lane.label && (
                  <div className="flex items-center gap-2 py-1 px-1">
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                      {lane.label}
                    </span>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>
                )}
                {lane.tasks.map((task) => <KanbanCard key={task.id} task={task} />)}
              </div>
            ))
          )}
        </SortableContext>

        {tasks.length === 0 && !isAdding && (
          <div
            className="flex flex-col items-center justify-center h-24 text-gray-300 text-xs cursor-pointer gap-1"
            onClick={handleStartAdd}
          >
            <Plus className="w-5 h-5" />
            <span>Add a card</span>
          </div>
        )}

        {/* ── Quick-add card ────────────────────────────────────────────── */}
        {isAdding && (
          <div className="rounded-lg border border-indigo-300 bg-white shadow-sm p-2 space-y-2">
            <Input
              ref={inputRef}
              placeholder="Card title…"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-8 text-sm border-0 p-0 focus-visible:ring-0 shadow-none"
              disabled={isSubmitting}
            />
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                className="h-6 text-xs bg-indigo-600 hover:bg-indigo-700 px-2"
                onClick={handleQuickAdd}
                disabled={isSubmitting || !newTitle.trim()}
              >
                {isSubmitting ? '…' : 'Add'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-xs px-2 text-gray-400"
                onClick={() => { setIsAdding(false); setNewTitle(''); }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* WIP hard-block overlay hint */}
        {isOver && isExceeded && wipMode === 'hard' && (
          <div className="flex items-center gap-1.5 justify-center text-xs text-red-500 py-2 font-medium">
            <AlertTriangle className="w-3.5 h-3.5" />
            WIP limit reached — drop blocked
          </div>
        )}
        {isOver && !isExceeded && (
          <div className="flex items-center gap-1.5 justify-center text-xs text-indigo-400 py-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Drop here
          </div>
        )}
      </div>
    </div>
  );
});
