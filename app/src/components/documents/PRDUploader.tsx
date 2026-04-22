import { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Upload, FileText, Sparkles, Check, AlertTriangle, 
  LucideFileInput, Loader2, Zap, Plus, ChevronRight, X 
} from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ParsedTask {
  title: string;
  description: string;
  category: string;
  priority: string;
  estimated_hours: number;
  position: number;
}

interface PRDResult {
  document_id: string;
  project_name: string;
  tasks_generated: number;
  phases: { name: string; category: string; task_count: number }[];
  tasks: ParsedTask[];
  insights: string[];
  notifications: { type: string; message: string }[];
}

// ── Priority Badge ────────────────────────────────────────────────────────────

const PriorityBadge = ({ priority }: { priority: string }) => {
  const colors = {
    high: 'bg-red-100 text-red-700 border-red-200',
    medium: 'bg-amber-100 text-amber-700 border-amber-200',
    low: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  };
  return (
    <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${colors[priority as keyof typeof colors] || colors.medium}`}>
      {priority}
    </span>
  );
};

// ── Category Badge ────────────────────────────────────────────────────────────

const CategoryBadge = ({ category }: { category: string }) => {
  const colors: Record<string, string> = {
    Development: 'bg-blue-100 text-blue-700',
    Design: 'bg-purple-100 text-purple-700',
    Testing: 'bg-orange-100 text-orange-700',
    Research: 'bg-teal-100 text-teal-700',
    Meeting: 'bg-gray-100 text-gray-700',
  };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${colors[category] || 'bg-gray-100 text-gray-600'}`}>
      {category}
    </span>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

interface PRDUploaderProps {
  projectId?: string;
  onTasksInserted?: (count: number) => void;
}

export function PRDUploader({ projectId, onTasksInserted }: PRDUploaderProps) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [inserting, setInserting] = useState(false);
  const [result, setResult] = useState<PRDResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedTasks, setSelectedTasks] = useState<Set<number>>(new Set());
  const [insertSuccess, setInsertSuccess] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setResult(null);
    setInsertSuccess(false);

    const allowedTypes = ['text/plain', 'application/pdf', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'];

    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(txt|pdf|docx?)$/i)) {
      setError('Please upload a PDF, DOCX, or TXT file.');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (projectId) formData.append('project_id', projectId);

      const response = await axios.post(`${API_URL}/documents/upload-prd`, formData, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      setResult(response.data);
      // Select all tasks by default
      setSelectedTasks(new Set(response.data.tasks.map((_: any, i: number) => i)));
    } catch (err: any) {
      console.error("PRD Upload Error:", err.response?.data || err.message);
      const detail = err.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : 
                  (Array.isArray(detail) ? detail[0]?.msg : 'Failed to process document.');
      setError(msg);
    } finally {
      setUploading(false);
    }
  }, [projectId]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const toggleTask = (i: number) => {
    setSelectedTasks(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const handleInsert = async () => {
    if (!result || !projectId) return;
    const tasksToInsert = result.tasks.filter((_, i) => selectedTasks.has(i));
    if (tasksToInsert.length === 0) return;

    setInserting(true);
    try {
      await axios.post(`${API_URL}/documents/insert-prd-tasks/${projectId}`, tasksToInsert, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setInsertSuccess(true);
      onTasksInserted?.(tasksToInsert.length);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to insert tasks.');
    } finally {
      setInserting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* ── Drop Zone ── */}
      {!result && (
        <Card className="border-2 border-dashed overflow-hidden transition-all duration-300 bg-white dark:bg-gray-900"
          style={{ borderColor: dragOver ? '#6366f1' : undefined }}
        >
          <CardContent
            className={`p-8 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all duration-300 ${dragOver ? 'bg-indigo-50 dark:bg-indigo-950/30' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept=".txt,.pdf,.docx,.doc"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />

            {uploading ? (
              <div className="flex flex-col items-center gap-3">
                <div className="h-16 w-16 rounded-2xl bg-indigo-100 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
                </div>
                <div className="text-center">
                  <p className="font-bold text-gray-900 dark:text-white">AI is analyzing your PRD...</p>
                  <p className="text-sm text-gray-500 mt-1">Extracting tasks, phases, and requirements</p>
                </div>
              </div>
            ) : (
              <>
                <div className={`h-16 w-16 rounded-2xl flex items-center justify-center transition-all duration-300 ${dragOver ? 'bg-indigo-500' : 'bg-indigo-100'}`}>
                  <Upload className={`h-8 w-8 transition-colors ${dragOver ? 'text-white' : 'text-indigo-600'}`} />
                </div>
                <div className="text-center">
                  <p className="font-bold text-gray-900 dark:text-white">Drop your PRD here</p>
                  <p className="text-sm text-gray-500 mt-1">PDF, DOCX, or TXT • AI will auto-generate tasks</p>
                </div>
                <Button variant="outline" size="sm" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50">
                  <LucideFileInput className="h-4 w-4 mr-2" /> Browse File
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
          <button className="ml-auto" onClick={() => setError(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* ── Results ── */}
      {result && !insertSuccess && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Summary Header */}
          <Card className="border-none bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-indigo-100 text-xs font-semibold uppercase tracking-widest mb-1">PRD Analyzed</p>
                  <h3 className="text-xl font-black leading-tight">{result.project_name}</h3>
                  <p className="text-indigo-100 text-sm mt-1">{result.tasks_generated} tasks extracted across {result.phases.length} phases</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Insights */}
          {result.insights.length > 0 && (
            <Card className="border border-amber-100 bg-amber-50">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-bold text-amber-900 flex items-center gap-2">
                  <Zap className="h-4 w-4" /> AI Insights
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                {result.insights.map((ins, i) => (
                  <p key={i} className="text-xs text-amber-800 leading-relaxed">{ins}</p>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Task List */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold text-gray-700">Generated Tasks</CardTitle>
                <div className="flex gap-2">
                  <button className="text-xs text-indigo-600 hover:underline" onClick={() => setSelectedTasks(new Set(result.tasks.map((_, i) => i)))}>Select all</button>
                  <span className="text-gray-300">|</span>
                  <button className="text-xs text-gray-500 hover:underline" onClick={() => setSelectedTasks(new Set())}>Clear</button>
                </div>
              </div>
              <CardDescription>{selectedTasks.size} of {result.tasks.length} selected</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2 max-h-80 overflow-y-auto">
              {result.tasks.map((task, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all duration-200 ${selectedTasks.has(i) ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-gray-100 hover:border-gray-200'}`}
                  onClick={() => toggleTask(i)}
                >
                  <div className={`h-5 w-5 rounded border-2 flex items-center justify-center mt-0.5 shrink-0 transition-all ${selectedTasks.has(i) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>
                    {selectedTasks.has(i) && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 leading-snug">{task.title}</p>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      <CategoryBadge category={task.category} />
                      <PriorityBadge priority={task.priority} />
                      <span className="text-[10px] text-gray-400">{task.estimated_hours}h est.</span>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Action Buttons */}
          {projectId && (
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => { setResult(null); setSelectedTasks(new Set()); }}>
                Upload Another
              </Button>
              <Button 
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-lg shadow-indigo-200"
                disabled={selectedTasks.size === 0 || inserting}
                onClick={handleInsert}
              >
                {inserting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Insert {selectedTasks.size} Tasks
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Success ── */}
      {insertSuccess && (
        <div className="flex flex-col items-center gap-4 py-10 animate-in fade-in zoom-in-95 duration-400">
          <div className="h-20 w-20 rounded-full bg-emerald-100 flex items-center justify-center">
            <Check className="h-10 w-10 text-emerald-600" />
          </div>
          <div className="text-center">
            <h3 className="text-xl font-black text-gray-900">Tasks Created!</h3>
            <p className="text-gray-500 text-sm mt-1">{selectedTasks.size} tasks from your PRD have been added to the project.</p>
          </div>
          <Button variant="outline" onClick={() => { setResult(null); setInsertSuccess(false); }}>
            Upload Another PRD
          </Button>
        </div>
      )}
    </div>
  );
}
