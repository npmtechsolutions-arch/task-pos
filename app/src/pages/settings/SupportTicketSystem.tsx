import { useState, useEffect } from 'react';
import { Plus, Search, Filter, MessageSquare, Clock, AlertCircle, CheckCircle2, Box, TicketIcon } from 'lucide-react';
// We'd import an actual API service here. Using mock data for demo.

interface Ticket {
  id: string;
  ticket_id: string;
  title: string;
  status: 'open' | 'in_progress' | 'waiting_for_user' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  created_at: string;
}

export function SupportTicketSystem() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  useEffect(() => {
    // Fetch tickets mock
    setTickets([
      { id: '1', ticket_id: 'TKT-0001', title: 'Task not loading after login', status: 'open', priority: 'high', category: 'bug', created_at: new Date().toISOString() },
      { id: '2', ticket_id: 'TKT-0002', title: 'Need help with workflows', status: 'resolved', priority: 'medium', category: 'other', created_at: new Date(Date.now() - 86400000).toISOString() }
    ]);
  }, []);

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

  return (
    <div className="flex h-[800px]">
      {/* Ticket List */}
      <div className={`flex flex-col border-r border-slate-200 dark:border-slate-800 ${selectedTicket ? 'w-1/3' : 'w-full'}`}>
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 dark:text-white">Support Tickets</h3>
          <button 
            onClick={() => { setIsCreating(true); setSelectedTicket(null); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Ticket
          </button>
        </div>
        
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search tickets..." 
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex gap-2">
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 dark:border-slate-800 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
              <Filter className="w-3 h-3" />
              Status
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 dark:border-slate-800 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
              <Filter className="w-3 h-3" />
              Priority
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {tickets.map((ticket) => (
            <button
              key={ticket.id}
              onClick={() => { setSelectedTicket(ticket); setIsCreating(false); }}
              className={`w-full text-left p-3 rounded-lg transition-colors border ${
                selectedTicket?.id === ticket.id 
                  ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-500/10 dark:border-indigo-500/20' 
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

      {/* Detail / Create Area */}
      {selectedTicket && !isCreating && (
        <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-900/50">
          <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">{selectedTicket.ticket_id}</h2>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium uppercase tracking-wider ${getStatusColor(selectedTicket.status)}`}>
                  {selectedTicket.status.replace('_', ' ')}
                </span>
              </div>
              <div className="flex gap-2">
                {selectedTicket.status !== 'resolved' && selectedTicket.status !== 'closed' && (
                  <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-green-200 text-green-700 bg-green-50 rounded-md hover:bg-green-100 dark:border-green-500/20 dark:text-green-400 dark:bg-green-500/10">
                    <CheckCircle2 className="w-4 h-4" />
                    Mark Resolved
                  </button>
                )}
              </div>
            </div>
            <h1 className="text-xl font-medium text-slate-900 dark:text-white mb-2">{selectedTicket.title}</h1>
            <div className="flex gap-4 text-sm text-slate-500">
              <span className="flex items-center gap-1.5 capitalize"><AlertCircle className="w-4 h-4" /> {selectedTicket.priority} Priority</span>
              <span className="flex items-center gap-1.5 capitalize"><Box className="w-4 h-4" /> {selectedTicket.category}</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Chat Messages Mock */}
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex-shrink-0 flex items-center justify-center text-sm font-medium text-slate-600 dark:text-slate-300">
                U
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-900 dark:text-white text-sm">User</span>
                  <span className="text-xs text-slate-500">2 hours ago</span>
                </div>
                <div className="bg-white dark:bg-slate-950 p-4 rounded-lg border border-slate-200 dark:border-slate-800 text-sm text-slate-700 dark:text-slate-300">
                  Hi, I'm experiencing an issue where my tasks are not loading after I log in. The page just shows a loading spinner indefinitely.
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex-shrink-0 flex items-center justify-center text-sm font-medium text-indigo-600 dark:text-indigo-400">
                A
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-900 dark:text-white text-sm">Support Admin</span>
                  <span className="text-xs text-slate-500">1 hour ago</span>
                </div>
                <div className="bg-indigo-50 dark:bg-indigo-500/10 p-4 rounded-lg border border-indigo-100 dark:border-indigo-500/20 text-sm text-slate-700 dark:text-slate-300">
                  Hello! I'm looking into this for you. Could you please let me know which browser and version you are using? Also, if possible, could you attach a screenshot of the browser console?
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800">
            <div className="relative">
              <textarea 
                rows={3}
                placeholder="Type your reply here..."
                className="w-full resize-none p-3 pb-12 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="absolute bottom-3 right-3">
                <button className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors shadow-sm">
                  <MessageSquare className="w-4 h-4" />
                  Reply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isCreating && (
        <div className="flex-1 p-8 bg-slate-50 dark:bg-slate-900/50 overflow-y-auto">
          <div className="max-w-2xl mx-auto bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Create Support Ticket</h2>
            
            <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); setIsCreating(false); }}>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Subject</label>
                <input 
                  type="text" 
                  required
                  placeholder="Brief description of the issue"
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Category</label>
                  <select className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="bug">Bug / Error</option>
                    <option value="feature">Feature Request</option>
                    <option value="performance">Performance Issue</option>
                    <option value="account">Account Issue</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Priority</label>
                  <select className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Description</label>
                <textarea 
                  rows={6}
                  required
                  placeholder="Please provide as much detail as possible..."
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button 
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 shadow-sm"
                >
                  Submit Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {!selectedTicket && !isCreating && (
        <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-slate-900/50">
          <div className="text-center">
            <TicketIcon className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700 mb-3" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-white">No Ticket Selected</h3>
            <p className="text-sm text-slate-500 mt-1">Select a ticket from the list or create a new one.</p>
          </div>
        </div>
      )}
    </div>
  );
}
