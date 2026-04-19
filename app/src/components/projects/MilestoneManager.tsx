import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Loader2, Flag, Calendar, CheckCircle2, AlertTriangle, Clock, Trash2, Edit2 } from 'lucide-react';
import axios from 'axios';
import { format, parseISO } from 'date-fns';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
function authHeaders() { return { Authorization: `Bearer ${localStorage.getItem('token')}` }; }

interface Milestone {
  id: string;
  project_id: string;
  phase_id?: string;
  name: string;
  description?: string;
  status: string;
  due_date?: string;
  completion_percentage: number;
  risk_indicator: string;
}
interface Phase { id: string; name: string; }
interface Props { projectId: string; }

const MS_STATUS: Record<string, { label: string; color: string; icon: any }> = {
  pending:     { label: 'Pending',    color: 'bg-gray-100 text-gray-700',     icon: Clock },
  in_progress: { label: 'In Progress',color: 'bg-blue-100 text-blue-700',     icon: Clock },
  at_risk:     { label: 'At Risk',    color: 'bg-amber-100 text-amber-700',   icon: AlertTriangle },
  completed:   { label: 'Completed',  color: 'bg-emerald-100 text-emerald-700',icon: CheckCircle2 },
  missed:      { label: 'Missed',     color: 'bg-red-100 text-red-700',       icon: AlertTriangle },
};

const RISK_COLORS: Record<string, string> = { low: 'text-emerald-500', medium: 'text-amber-500', high: 'text-orange-500', critical: 'text-red-600' };

export function MilestoneManager({ projectId }: Props) {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editMs, setEditMs] = useState<Milestone | null>(null);
  const [form, setForm] = useState({ name: '', description: '', status: 'pending', due_date: '', phase_id: '', risk_indicator: 'low' });
  const [submitting, setSubmitting] = useState(false);

  const loadAll = async () => {
    try {
      const [msRes, phRes] = await Promise.all([
        axios.get(`${API_URL}/projects/${projectId}/milestones`, { headers: authHeaders() }),
        axios.get(`${API_URL}/projects/${projectId}/phases`, { headers: authHeaders() }),
      ]);
      setMilestones(msRes.data || []);
      setPhases(phRes.data || []);
    } catch {}
    setLoading(false);
  };
  useEffect(() => { loadAll(); }, [projectId]);

  const resetForm = () => setForm({ name: '', description: '', status: 'pending', due_date: '', phase_id: '', risk_indicator: 'low' });
  const openCreate = () => { resetForm(); setEditMs(null); setShowForm(true); };
  const openEdit = (m: Milestone) => {
    setForm({ name: m.name, description: m.description || '', status: m.status, due_date: m.due_date?.slice(0, 10) || '', phase_id: m.phase_id || '', risk_indicator: m.risk_indicator });
    setEditMs(m); setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    setSubmitting(true);
    try {
      const payload = { ...form, due_date: form.due_date || null, phase_id: form.phase_id || null };
      if (editMs) {
        await axios.put(`${API_URL}/milestones/${editMs.id}`, payload, { headers: authHeaders() });
      } else {
        await axios.post(`${API_URL}/projects/${projectId}/milestones`, payload, { headers: authHeaders() });
      }
      await loadAll(); setShowForm(false); resetForm();
    } catch (e: any) { alert(e.response?.data?.detail || 'Failed to save milestone'); }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this milestone?')) return;
    await axios.delete(`${API_URL}/milestones/${id}`, { headers: authHeaders() });
    loadAll();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800">Milestones</h2>
        <Button id="btn-add-milestone" size="sm" onClick={openCreate} className="bg-violet-600 hover:bg-violet-700">
          <Plus className="h-4 w-4 mr-1" /> Add Milestone
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-violet-500" /></div>
      ) : milestones.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="py-10 text-center text-gray-400">
            <Flag className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="font-medium">No milestones yet</p>
            <p className="text-sm mt-1">Define key achievements and deadlines for your project</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={openCreate}>Add First Milestone</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {milestones.map(ms => {
            const cfg = MS_STATUS[ms.status] || MS_STATUS.pending;
            const Icon = cfg.icon;
            const phase = phases.find(p => p.id === ms.phase_id);
            return (
              <Card key={ms.id} className="border hover:shadow-sm transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${cfg.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900">{ms.name}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${cfg.color}`}>{cfg.label}</span>
                          {phase && <span className="text-[11px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">📌 {phase.name}</span>}
                        </div>
                        <div className="flex items-center gap-4 mt-1">
                          {ms.due_date && (
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                              <Calendar className="h-3 w-3" />
                              Due: {format(parseISO(ms.due_date), 'MMM d, yyyy')}
                            </span>
                          )}
                          <span className={`text-xs font-semibold ${RISK_COLORS[ms.risk_indicator]}`}>
                            Risk: {ms.risk_indicator.charAt(0).toUpperCase() + ms.risk_indicator.slice(1)}
                          </span>
                          <span className="text-xs text-indigo-600 font-semibold">{Math.round(ms.completion_percentage)}% done</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(ms)}><Edit2 className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => handleDelete(ms.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editMs ? 'Edit Milestone' : 'Create Milestone'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Milestone Name *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. MVP Launch" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Due Date</Label>
                <Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
              </div>
              <div>
                <Label>Phase (optional)</Label>
                <Select value={form.phase_id} onValueChange={v => setForm(f => ({ ...f, phase_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {phases.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(MS_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Risk Level</Label>
                <Select value={form.risk_indicator} onValueChange={v => setForm(f => ({ ...f, risk_indicator: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['low', 'medium', 'high', 'critical'].map(r => <SelectItem key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button id="btn-save-milestone" onClick={handleSubmit} disabled={!form.name.trim() || submitting} className="bg-violet-600 hover:bg-violet-700">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {editMs ? 'Save Changes' : 'Create Milestone'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
