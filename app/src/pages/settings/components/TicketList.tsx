import React, { memo } from 'react';
import { Search, Filter, Clock, AlertCircle } from 'lucide-react';

interface Ticket {
  id: string;
  ticket_id: string;
  title: string;
  status: 'open' | 'in_progress' | 'waiting_for_user' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  created_at: string;
}

interface TicketListProps {
  tickets: Ticket[];
  selectedTicketId: string | undefined;
  onSelectTicket: (ticket: Ticket) => void;
  onNewTicket: () => void;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'open': return 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400';
    case 'in_progress': return 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400';
    case 'resolved': return 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400';
    default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400';
  }
};

const getPriorityIcon = (priority: string) => {
  switch (priority) {
    case 'critical': return <AlertCircle className="w-4 h-4 text-red-500" />;
    case 'high': return <AlertCircle className="w-4 h-4 text-orange-500" />;
    case 'medium': return <AlertCircle className="w-4 h-4 text-amber-500" />;
    case 'low': return <AlertCircle className="w-4 h-4 text-blue-500" />;
    default: return null;
  }
};

export const TicketList = memo(({ tickets, selectedTicketId, onSelectTicket, onNewTicket }: TicketListProps) => {
  return (
    <div className={`flex flex-col border-r border-slate-200 dark:border-slate-800 h-full ${selectedTicketId ? 'w-full md:w-1/3' : 'w-full'}`}>
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900 dark:text-white">Support Tickets</h3>
        <button 
          onClick={onNewTicket}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-all active:scale-95 shadow-sm"
        >
          New Ticket
        </button>
      </div>
      
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search tickets..." 
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
          />
        </div>
        <div className="flex gap-2">
          <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 dark:border-slate-800 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            <Filter className="w-3 h-3" />
            Status
          </button>
          <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 dark:border-slate-800 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            <Filter className="w-3 h-3" />
            Priority
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
        {tickets.map((ticket) => (
          <button
            key={ticket.id}
            onClick={() => onSelectTicket(ticket)}
            className={`w-full text-left p-3 rounded-lg transition-all border ${
              selectedTicketId === ticket.id 
                ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-500/10 dark:border-indigo-500/20 shadow-sm' 
                : 'bg-white border-transparent hover:border-slate-200 dark:bg-slate-950 dark:hover:border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-slate-500">{ticket.ticket_id}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider ${getStatusColor(ticket.status)}`}>
                {ticket.status.replace('_', ' ')}
              </span>
            </div>
            <h4 className="text-sm font-medium text-slate-900 dark:text-white truncate mb-2">
              {ticket.title}
            </h4>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-1.5">
                {getPriorityIcon(ticket.priority)}
                <span className="capitalize">{ticket.priority}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>2h ago</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
});

TicketList.displayName = 'TicketList';
