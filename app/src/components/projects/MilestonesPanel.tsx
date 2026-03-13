import { useState, useEffect } from 'react';
import { Target, AlertTriangle, CheckCircle2, Clock, TrendingUp, Plus, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

interface Milestone {
  id: string;
  name: string;
  description?: string;
  milestone_type: string;
  status: string;
  due_date?: string;
  completion_percentage: number;
  risk_indicator: string;
  requires_approval: boolean;
  is_approved: boolean;
}

const RISK_CONFIG: Record<string, { bg: string; text: string; dot: string }> = {
  low:      { bg: 'bg-green-50',  text: 'text-green-700', dot: 'bg-green-400' },
  medium:   { bg: 'bg-amber-50',  text: 'text-amber-700', dot: 'bg-amber-400' },
  high:     { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-400' },
  critical: { bg: 'bg-red-50',    text: 'text-red-700',   dot: 'bg-red-500' },
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending:     <Clock className="w-4 h-4 text-gray-400" />,
  in_progress: <TrendingUp className="w-4 h-4 text-blue-500" />,
  at_risk:     <AlertTriangle className="w-4 h-4 text-amber-500" />,
  completed:   <CheckCircle2 className="w-4 h-4 text-green-500" />,
  missed:      <AlertTriangle className="w-4 h-4 text-red-500" />,
};

interface MilestonesPanelProps {
  projectId: string;
}

export function MilestonesPanel({ projectId }: MilestonesPanelProps) {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchMilestones = async () => {
      try {
        const res = await axios.get(`${API_URL}/milestones?project_id=${projectId}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        setMilestones(res.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchMilestones();
  }, [projectId]);

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const riskGroups = {
    critical: milestones.filter(m => m.risk_indicator === 'critical'),
    high:     milestones.filter(m => m.risk_indicator === 'high'),
    medium:   milestones.filter(m => m.risk_indicator === 'medium'),
    low:      milestones.filter(m => m.risk_indicator === 'low'),
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse h-24" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Milestones</h2>
          <p className="text-sm text-gray-400 mt-0.5">{milestones.length} milestones tracked</p>
        </div>
        <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">
          <Plus className="w-4 h-4 mr-1" /> Add Milestone
        </Button>
      </div>

      {/* Risk Summary Pills */}
      <div className="flex gap-3 flex-wrap">
        {Object.entries(riskGroups).map(([risk, items]) => {
          if (items.length === 0) return null;
          const cfg = RISK_CONFIG[risk];
          return (
            <div key={risk} className={cn("flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium", cfg.bg, cfg.text)}>
              <span className={cn("w-2 h-2 rounded-full", cfg.dot)} />
              {items.length} {risk.charAt(0).toUpperCase() + risk.slice(1)} Risk
            </div>
          );
        })}
      </div>

      {milestones.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
          <Target className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No milestones yet</p>
          <p className="text-gray-400 text-sm mt-1">Add your first milestone to track key achievements</p>
        </div>
      ) : (
        <div className="space-y-3">
          {milestones.map(milestone => {
            const risk = RISK_CONFIG[milestone.risk_indicator] ?? RISK_CONFIG.low;
            const isOpen = expanded.has(milestone.id);
            return (
              <div
                key={milestone.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
              >
                <button
                  onClick={() => toggleExpand(milestone.id)}
                  className="w-full flex items-center gap-4 p-5 text-left"
                >
                  <div className={cn("w-2 self-stretch rounded-full flex-shrink-0", risk.dot)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {STATUS_ICONS[milestone.status]}
                      <span className="font-semibold text-gray-800">{milestone.name}</span>
                      <Badge variant="secondary" className="text-[10px] capitalize">
                        {milestone.milestone_type.replace('_', ' ')}
                      </Badge>
                      {milestone.requires_approval && !milestone.is_approved && (
                        <Badge className="text-[10px] bg-purple-100 text-purple-700 border-0">
                          Pending Approval
                        </Badge>
                      )}
                    </div>
                    {/* Progress bar */}
                    <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden max-w-sm">
                      <div
                        className={cn("h-full rounded-full transition-all", 
                          milestone.completion_percentage === 100 ? "bg-green-500" 
                          : milestone.risk_indicator === 'critical' ? "bg-red-500" 
                          : "bg-indigo-500"
                        )}
                        style={{ width: `${milestone.completion_percentage}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500 flex-shrink-0">
                    <span className="font-semibold">{Math.round(milestone.completion_percentage)}%</span>
                    {milestone.due_date && (
                      <span className="text-xs">{new Date(milestone.due_date).toLocaleDateString()}</span>
                    )}
                    {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </div>
                </button>

                {isOpen && milestone.description && (
                  <div className="px-5 pb-5 pt-0 ml-6 text-sm text-gray-500 border-t border-gray-50 mt-0">
                    <p className="pt-3">{milestone.description}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
