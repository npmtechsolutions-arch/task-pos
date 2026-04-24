import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { TicketIcon } from 'lucide-react';
import { TicketList } from './components/TicketList';

// Lazy load detail and form components for better initial load performance
const TicketDetail = lazy(() => import('./components/TicketDetail').then(m => ({ default: m.TicketDetail })));
const TicketCreateForm = lazy(() => import('./components/TicketCreateForm').then(m => ({ default: m.TicketCreateForm })));

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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate API fetch
    const fetchTickets = async () => {
      setIsLoading(true);
      await new Promise(resolve => setTimeout(resolve, 800)); // Simulate network latency
      setTickets([
        { id: '1', ticket_id: 'TKT-0001', title: 'Task not loading after login', status: 'open', priority: 'high', category: 'bug', created_at: new Date().toISOString() },
        { id: '2', ticket_id: 'TKT-0002', title: 'Need help with workflows', status: 'resolved', priority: 'medium', category: 'other', created_at: new Date(Date.now() - 86400000).toISOString() }
      ]);
      setIsLoading(false);
    };
    fetchTickets();
  }, []);

  // Use useCallback to prevent unnecessary re-renders of child components
  const handleSelectTicket = useCallback((ticket: Ticket) => {
    setSelectedTicket(ticket);
    setIsCreating(false);
  }, []);

  const handleNewTicketClick = useCallback(() => {
    setIsCreating(true);
    setSelectedTicket(null);
  }, []);

  const handleCancelCreate = useCallback(() => {
    setIsCreating(false);
  }, []);

  const handleFormSubmit = useCallback(async (data: any) => {
    // Simulate API submission
    console.log('Submitting ticket:', data);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const newTicket: Ticket = {
      id: Math.random().toString(36).substring(7),
      ticket_id: `TKT-000${tickets.length + 1}`,
      title: data.title,
      status: 'open',
      priority: data.priority,
      category: data.category,
      created_at: new Date().toISOString()
    };
    
    setTickets(prev => [newTicket, ...prev]);
    setIsCreating(false);
    setSelectedTicket(newTicket);
  }, [tickets.length]);

  const handleResolveTicket = useCallback((id: string) => {
    setTickets(prev => prev.map(t => t.id === id ? { ...t, status: 'resolved' } : t));
    setSelectedTicket(prev => prev?.id === id ? { ...prev, status: 'resolved' } : prev);
  }, []);

  // Memoize empty state to avoid re-calculating JSX
  const emptyState = useMemo(() => (
    <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-slate-900/50 h-full p-8 text-center">
      <div className="max-w-sm">
        <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-2xl shadow-xl flex items-center justify-center mx-auto mb-6 transform rotate-3 transition-transform hover:rotate-0 duration-500">
          <TicketIcon className="w-10 h-10 text-indigo-500" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">No Ticket Selected</h3>
        <p className="text-sm text-slate-500 font-medium">
          Select a ticket from the left panel to view its details, or start a new conversation by creating a ticket.
        </p>
      </div>
    </div>
  ), []);

  const loadingState = (
    <div className="flex-1 flex items-center justify-center h-full">
      <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="flex h-[calc(100vh-120px)] min-h-[600px] overflow-hidden bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl relative">
      <TicketList 
        tickets={tickets}
        selectedTicketId={selectedTicket?.id}
        onSelectTicket={handleSelectTicket}
        onNewTicket={handleNewTicketClick}
      />

      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <Suspense fallback={loadingState}>
          {isCreating ? (
            <TicketCreateForm 
              onSubmit={handleFormSubmit}
              onCancel={handleCancelCreate}
            />
          ) : selectedTicket ? (
            <TicketDetail 
              ticket={selectedTicket}
              onResolve={handleResolveTicket}
            />
          ) : (
            emptyState
          )}
        </Suspense>
      </div>
    </div>
  );
}
