import { useState } from 'react';
import { PRDUploader } from '@/components/documents/PRDUploader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Sparkles, Zap, CheckCircle2, UploadCloud } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { useEffect } from 'react';

export default function PRDUploadPage() {
  const { projects, fetchProjects } = useProjectStore();
  const [selectedProject, setSelectedProject] = useState<string | undefined>();
  const [insertCount, setInsertCount] = useState<number | null>(null);

  useEffect(() => {
    fetchProjects();
  }, []);

  return (
    <div className="container mx-auto p-6 max-w-5xl animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center">
              <FileText className="h-4 w-4 text-indigo-600" />
            </div>
            <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">PRD Upload</h1>
          </div>
          <p className="text-gray-500">Upload a Product Requirements Document. AI will automatically extract tasks and structure your project.</p>
        </div>
      </div>

      {/* Feature Pills */}
      <div className="flex flex-wrap gap-2 mb-8">
        {[
          { icon: Sparkles, label: 'AI-Powered Parsing', color: 'bg-violet-50 text-violet-700 border-violet-100' },
          { icon: Zap, label: 'Auto Task Generation', color: 'bg-amber-50 text-amber-700 border-amber-100' },
          { icon: CheckCircle2, label: 'One-Click Insert', color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
          { icon: UploadCloud, label: 'PDF · DOCX · TXT', color: 'bg-blue-50 text-blue-700 border-blue-100' },
        ].map(({ icon: Icon, label, color }) => (
          <div key={label} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold ${color}`}>
            <Icon className="h-3.5 w-3.5" /> {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Panel (main) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Project Selector */}
          <Card className="border shadow-sm">
            <CardContent className="p-4">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-2">
                Target Project (optional)
              </label>
              <Select onValueChange={setSelectedProject} value={selectedProject}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a project to auto-insert tasks..." />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-400 mt-2">
                If selected, you can insert generated tasks directly into this project with one click.
              </p>
            </CardContent>
          </Card>

          {/* Success Banner */}
          {insertCount !== null && (
            <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4 animate-in slide-in-from-top-4">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <p className="font-bold text-emerald-800 text-sm">{insertCount} tasks added to project!</p>
                <p className="text-xs text-emerald-600">Tasks are now visible in your project's board and task list.</p>
              </div>
            </div>
          )}

          <PRDUploader
            projectId={selectedProject}
            onTasksInserted={(count) => setInsertCount(count)}
          />
        </div>

        {/* Sidebar: How It Works */}
        <div className="space-y-4">
          <Card className="border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-gray-700">How It Works</CardTitle>
              <CardDescription>The agentic loop in 4 steps</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pb-4">
              {[
                { step: '01', label: 'Upload PRD', desc: 'Drag & drop or browse a PDF, DOCX, or TXT file.', color: 'bg-indigo-50 text-indigo-600' },
                { step: '02', label: 'AI Analyzes', desc: 'NLP engine extracts sections, tasks, and dependencies.', color: 'bg-violet-50 text-violet-600' },
                { step: '03', label: 'Review & Select', desc: 'Review generated tasks, deselect any you don\'t need.', color: 'bg-blue-50 text-blue-600' },
                { step: '04', label: 'Insert to Project', desc: 'Push selected tasks directly into your project board.', color: 'bg-emerald-50 text-emerald-600' },
              ].map(({ step, label, desc, color }) => (
                <div key={step} className="flex gap-3 items-start">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 font-black text-xs ${color}`}>
                    {step}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{label}</p>
                    <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border border-indigo-100 bg-indigo-50">
            <CardContent className="p-4">
              <p className="text-xs font-bold text-indigo-800 mb-1 flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5" /> AI Capabilities
              </p>
              <ul className="text-xs text-indigo-700 space-y-1 leading-relaxed list-disc list-inside">
                <li>Detects project name automatically</li>
                <li>Classifies tasks by category</li>
                <li>Assigns priority from keywords</li>
                <li>Estimates effort in hours</li>
                <li>Groups into development phases</li>
                <li>Identifies missing requirements</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
