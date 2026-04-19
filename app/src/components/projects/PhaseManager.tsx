import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Loader2, Calendar, Target, ChevronRight, Trash2, Edit2 } from 'lucide-react';
import axios from 'axios';
import { format, parseISO } from 'date-fns';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('token')}` };
}

interface Phase {
  id: string;
  project_id: string;
  name: string;
  description?: string;
  status: string;
  color: string;
  start_date?: string;
  end_date?: string;
  progress_percentage: number;
  position: number;
}

const PHASE_STATUS: Record<string, { label: string; color: string }> = {
  planned:     { label: 'Planned',     color: 'bg-gray-100 text-gray-700' },
  active:      { label: 'Active',      color: 'bg-blue-100 text-blue-700' },
  completed:   { label: 'Completed',   color: 'bg-emerald-100 text-emerald-700' },
  on_hold:     { label: 'On Hold',     color: 'bg-amber-100 text-amber-700' },
  cancelled:   { label: 'Cancelled',   color: 'bg-red-100 text-red-700' },
};

const COLOR_OPTIONS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#3B82F6', '#EC4899'];

interface Props { projectId: string; }

export function PhaseManager({ projectId }: Props) {
  const [phases, setPhases] = useState<Phase[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editPhase, setEditPhase] = useState<Phase | null>(null);
  const [form, setForm] = useState({ name: '', description: '', status: 'planned', start_date: '', end_date: '', color: '#6366F1' });
  const [submitting, setSubmitting] = useState(false);

  const loadPhases = async () => {
    try {
      const res = await axios.get(`${API_URL}/projects/${projectId}/phases`, { headers: authHeaders() });
      setPhases(res.data || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadPhases(); }, [projectId]);

  const resetForm = () => setForm({ name: '', description: '', status: 'planned', start_date: '', end_date: '', color: '#6366F1' });

  const openCreate = () => { resetForm(); setEditPhase(null); setShowForm(true); };
  const openEdit = (p: Phase) => {
    setForm({ name: p.name, description: p.description || '', status: p.status, start_date: p.start_date?.slice(0, 10) || '', end_date: p.end_date?.slice(0, 10) || '', color: p.color });
    setEditPhase(p);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    setSubmitting(true);
    try {
      const payload = { ...form, start_date: form.start_date || null, end_date: form.end_date || null };
      if (editPhase) {
        await axios.put(`${API_URL}/projects/${projectId}/phases/${editPhase.id}`, payload, { headers: authHeaders() });
      } else {
        await axios.post(`${API_URL}/projects/${projectId}/phases`, payload, { headers: authHeaders() });
      }
      await loadPhases();
      setShowForm(false);
      resetForm();
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Failed to save phase');
    }
    setSubmitting(false);
  };

  const handleDelete = async (phaseId: string) => {
    if (!confirm('Delete this phase?')) return;
    await axios.delete(`${API_URL}/projects/${projectId}/phases/${phaseId}`, { headers: authHeaders() });
    loadPhases();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800">Project Phases</h2>
        <Button id="btn-add-phase" size="sm" onClick={openCreate} className="bg-indigo-600 hover:bg-indigo-700">
          <Plus className="h-4 w-4 mr-1" /> Add Phase
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-indigo-500" /></div>
      ) : phases.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="py-10 text-center text-gray-400">
            <Target className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="font-medium">No phases yet</p>
            <p className="text-sm mt-1">Organize your project into phases for better tracking</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={openCreate}>Create First Phase</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {phases.map((phase, i) => {
            const cfg = PHASE_STATUS[phase.status] || PHASE_STATUS.planned;
            return (
              <Card key={phase.id} className="border hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-3 h-12 rounded-full flex-shrink-0" style={{ backgroundColor: phase.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-gray-900">{phase.name}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
                        </div>
                        {phase.description && <p className="text-sm text-gray-500 mt-0.5 truncate">{phase.description}</p>}
                        {(phase.start_date || phase.end_date) && (
                          <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {phase.start_date ? format(parseISO(phase.start_date), 'MMM d') : '?'}
                            {' → '}
                            {phase.end_date ? format(parseISO(phase.end_date), 'MMM d, yyyy') : 'TBD'}
                          </p>
                        )}
                        {/* Progress bar */}
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                            <div className="h-1.5 rounded-full bg-indigo-500 transition-all" style={{ width: `${phase.progress_percentage}%` }} />
                          </div>
                          <span className="text-[11px] font-semibold text-gray-500">{Math.round(phase.progress_percentage)}%</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(phase)}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={() => handleDelete(phase.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Phase Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editPhase ? 'Edit Phase' : 'Create Phase'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Phase Name *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Discovery & Planning" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start Date</Label>
                <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div>
                <Label>End Date</Label>
                <Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PHASE_STATUS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Color</Label>
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {COLOR_OPTIONS.map(c => (
                    <button key={c} className={`w-6 h-6 rounded-full border-2 transition-all ${form.color === c ? 'border-gray-900 scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: c }} onClick={() => setForm(f => ({ ...f, color: c }))} />
                  ))}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button id="btn-save-phase" onClick={handleSubmit} disabled={!form.name.trim() || submitting} className="bg-indigo-600 hover:bg-indigo-700">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {editPhase ? 'Save Changes' : 'Create Phase'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
