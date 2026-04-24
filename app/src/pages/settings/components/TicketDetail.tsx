import React, { memo } from 'react';
import { MessageSquare, CheckCircle2, AlertCircle, Box } from 'lucide-react';

interface Ticket {
  id: string;
  ticket_id: string;
  title: string;
  status: 'open' | 'in_progress' | 'waiting_for_user' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  created_at: string;
}

interface TicketDetailProps {
  ticket: Ticket;
  onResolve: (id: string) => void;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'open': return 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400';
    case 'in_progress': return 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400';
    case 'resolved': return 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400';
    default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400';
  }
};

export const TicketDetail = memo(({ ticket, onResolve }: TicketDetailProps) => {
  return (
    <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-900/50 h-full overflow-hidden">
      <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm z-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{ticket.ticket_id}</h2>
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium uppercase tracking-wider ${getStatusColor(ticket.status)}`}>
              {ticket.status.replace('_', ' ')}
            </span>
          </div>
          <div className="flex gap-2">
            {ticket.status !== 'resolved' && ticket.status !== 'closed' && (
              <button 
                onClick={() => onResolve(ticket.id)}
                className="flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium border border-green-200 text-green-700 bg-green-50 rounded-md hover:bg-green-100 dark:border-green-500/20 dark:text-green-400 dark:bg-green-500/10 transition-colors shadow-sm active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4" />
                Mark Resolved
              </button>
            )}
          </div>
        </div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white mb-2 leading-tight">{ticket.title}</h1>
        <div className="flex flex-wrap gap-4 text-sm text-slate-500">
          <span className="flex items-center gap-1.5 capitalize font-medium">
            <AlertCircle className="w-4 h-4 text-slate-400" /> 
            {ticket.priority} Priority
          </span>
          <span className="flex items-center gap-1.5 capitalize font-medium">
            <Box className="w-4 h-4 text-slate-400" /> 
            {ticket.category}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth">
        {/* Chat Messages Mock */}
        <div className="flex gap-4 group">
          <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-800 flex-shrink-0 flex items-center justify-center text-sm font-semibold text-slate-600 dark:text-slate-300 shadow-sm">
            U
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 dark:text-white text-sm">User</span>
              <span className="text-xs text-slate-400">2 hours ago</span>
            </div>
            <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-sm text-slate-700 dark:text-slate-300 shadow-sm group-hover:shadow-md transition-shadow leading-relaxed">
              Hi, I'm experiencing an issue where my tasks are not loading after I log in. The page just shows a loading spinner indefinitely.
            </div>
          </div>
        </div>

        <div className="flex gap-4 group">
          <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex-shrink-0 flex items-center justify-center text-sm font-semibold text-indigo-600 dark:text-indigo-400 shadow-sm">
            A
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 dark:text-white text-sm">Support Admin</span>
              <span className="text-xs text-slate-400">1 hour ago</span>
            </div>
            <div className="bg-indigo-50 dark:bg-indigo-500/10 p-4 rounded-xl border border-indigo-100 dark:border-indigo-500/20 text-sm text-slate-700 dark:text-slate-300 shadow-sm group-hover:shadow-md transition-shadow leading-relaxed">
              Hello! I'm looking into this for you. Could you please let me know which browser and version you are using? Also, if possible, could you attach a screenshot of the browser console?
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 shadow-[0_-2px_10px_rgba(0,0,0,0.02)]">
        <div className="relative">
          <textarea 
            rows={3}
            placeholder="Type your reply here..."
            className="w-full resize-none p-4 pb-14 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-slate-400"
          />
          <div className="absolute bottom-4 right-4">
            <button className="flex items-center gap-2 px-5 py-2 text-sm font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all shadow-md active:scale-95">
              <MessageSquare className="w-4 h-4" />
              Reply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

TicketDetail.displayName = 'TicketDetail';
