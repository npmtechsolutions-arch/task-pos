/**
 * SupportTicketSystem — Production-ready, fully dynamic
 * Connects to FastAPI /api/v1/support endpoints with real-time WebSocket chat.
 */

import {
  useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense
} from 'react';
import { toast } from 'sonner';
import {
  TicketIcon, Plus, Search, Filter, Clock, AlertCircle,
  CheckCircle2, Circle, X, ChevronDown, RefreshCw
} from 'lucide-react';
import type { Ticket } from '@/api/support';
import {
  getMyTickets, getAllTickets, getTicket, createTicket,
  updateTicket, sendMessage
} from '@/api/support';
import { useAuthStore } from '@/stores';

// ─── Lazy components ─────────────────────────────────────────────────────────
const TicketCreateForm = lazy(() =>
  import('./components/TicketCreateForm').then(m => ({ default: m.TicketCreateForm }))
);
const TicketDetail = lazy(() =>
  import('./components/TicketDetailLive').then(m => ({ default: m.TicketDetailLive }))
);

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
  assigned: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400',
  in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
  waiting_for_user: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400',
  resolved: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
  closed: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-blue-500',
  medium: 'text-amber-500',
  high: 'text-orange-500',
  critical: 'text-red-500',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${STATUS_COLORS[status] ?? 'bg-slate-100 text-slate-600'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function timeAgo(iso: string) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// ─── Main Component ────────────────────────────────────────────────────────────
export function SupportTicketSystem() {
  const { token, user } = useAuthStore();
  const isAdmin = user?.role && ['admin', 'owner'].includes(user.role);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterPriority, setFilterPriority] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  // ─── Fetch ticket list ────────────────────────────────────────────────────
  const fetchTickets = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const fn = isAdmin ? getAllTickets : getMyTickets;
      const res = await fn(token, {
        status: filterStatus || undefined,
        priority: filterPriority || undefined,
      });
      setTickets(res.items);
    } catch {
      toast.error('Failed to load tickets');
    } finally {
      setIsLoading(false);
    }
  }, [token, isAdmin, filterStatus, filterPriority]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  // ─── Select ticket and load details ───────────────────────────────────────
  const handleSelectTicket = useCallback(async (ticket: Ticket) => {
    setIsCreating(false);
    setSelectedTicket(ticket);
    if (!token) return;
    try {
      const detail = await getTicket(token, ticket.id);
      setSelectedTicket(detail);
    } catch {
      toast.error('Failed to load ticket details');
    }
  }, [token]);

  // ─── Create ticket ────────────────────────────────────────────────────────
  const handleCreate = useCallback(async (data: {
    title: string; description: string;
    category: Ticket['category']; priority: Ticket['priority'];
  }) => {
    if (!token) return;
    try {
      const created = await createTicket(token, data);
      toast.success(`Ticket ${created.ticket_id} created!`);
      setTickets(prev => [created, ...prev]);
      setIsCreating(false);
      setSelectedTicket(created);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? 'Failed to create ticket';
      toast.error(msg);
      throw err; // re-throw so react-hook-form shows submitting=false
    }
  }, [token]);

  // ─── Status update (admin) ─────────────────────────────────────────────────
  const handleStatusChange = useCallback(async (ticketId: string, newStatus: Ticket['status']) => {
    if (!token) return;
    try {
      const updated = await updateTicket(token, ticketId, { status: newStatus });
      setSelectedTicket(prev => prev?.id === ticketId ? { ...prev, ...updated } : prev);
      setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: newStatus } : t));
      toast.success('Status updated');
    } catch {
      toast.error('Failed to update status');
    }
  }, [token]);

  // ─── Send message (lifted here so we can update selectedTicket messages) ──
  const handleSendMessage = useCallback(async (ticketId: string, message: string) => {
    if (!token) return;
    const msg = await sendMessage(token, ticketId, message);
    setSelectedTicket(prev => {
      if (!prev || prev.id !== ticketId) return prev;
      return { ...prev, messages: [...(prev.messages ?? []), msg] };
    });
  }, [token]);

  // ─── Patch ticket in list when WS sends an update ────────────────────────
  const handleWsTicketUpdate = useCallback((ticketId: string, newStatus: string) => {
    setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: newStatus as Ticket['status'] } : t));
    setSelectedTicket(prev =>
      prev?.id === ticketId ? { ...prev, status: newStatus as Ticket['status'] } : prev
    );
    toast.info(`Ticket status changed to ${newStatus.replace(/_/g, ' ')}`);
  }, []);

  // ─── Filtered list ────────────────────────────────────────────────────────
  const filteredTickets = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return tickets.filter(t =>
      !q || t.title.toLowerCase().includes(q) || t.ticket_id.toLowerCase().includes(q)
    );
  }, [tickets, searchQuery]);

  // ─── Empty & loading states ───────────────────────────────────────────────
  const emptyState = (
    <div className="flex-1 flex items-center justify-center h-full p-8 text-center">
      <div className="max-w-sm">
        <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-2xl shadow-xl flex items-center justify-center mx-auto mb-6 rotate-3 hover:rotate-0 transition-transform duration-500">
          <TicketIcon className="w-10 h-10 text-indigo-500" />
        </div>
        <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mb-2">No Ticket Selected</h3>
        <p className="text-sm text-slate-500 font-medium">
          Select a ticket from the list, or{' '}
          <button onClick={() => setIsCreating(true)} className="text-indigo-600 underline underline-offset-2 hover:text-indigo-700">
            create a new one
          </button>.
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex h-[calc(100vh-180px)] min-h-[600px] overflow-hidden bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl">

      {/* ── Left Panel: Ticket List ─────────────────────────────────────────── */}
      <div className={`flex flex-col border-r border-slate-200 dark:border-slate-800 transition-all duration-300 ${selectedTicket || isCreating ? 'hidden md:flex md:w-80' : 'w-full md:w-80'}`}>

        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
          <h3 className="font-extrabold text-slate-900 dark:text-white tracking-tight">
            {isAdmin ? 'All Tickets' : 'My Tickets'}
          </h3>
          <div className="flex gap-2">
            <button onClick={fetchTickets} title="Refresh" className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-all">
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => { setIsCreating(true); setSelectedTicket(null); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all active:scale-95 shadow-md shadow-indigo-200 dark:shadow-none"
            >
              <Plus className="w-4 h-4" />
              New
            </button>
          </div>
        </div>

        {/* Search + Filters */}
        <div className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search tickets..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>
          <button
            onClick={() => setShowFilters(f => !f)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-200 dark:border-slate-800 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors w-full"
          >
            <Filter className="w-3 h-3" />
            Filters
            <ChevronDown className={`w-3 h-3 ml-auto transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>

          {showFilters && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="text-xs px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Status</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
              <select
                value={filterPriority}
                onChange={e => setFilterPriority(e.target.value)}
                className="text-xs px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Priority</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          )}
        </div>

        {/* Ticket Items */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {isLoading && tickets.length === 0 && (
            <div className="flex flex-col gap-2 p-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-20 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
              ))}
            </div>
          )}
          {!isLoading && filteredTickets.length === 0 && (
            <div className="p-8 text-center text-slate-400">
              <Circle className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">No tickets yet</p>
            </div>
          )}
          {filteredTickets.map(ticket => (
            <button
              key={ticket.id}
              onClick={() => handleSelectTicket(ticket)}
              className={`w-full text-left p-3 rounded-xl transition-all border ${
                selectedTicket?.id === ticket.id
                  ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-500/10 dark:border-indigo-500/30 shadow-sm'
                  : 'border-transparent hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-900/50'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-slate-400 tracking-wider">{ticket.ticket_id}</span>
                <StatusBadge status={ticket.status} />
              </div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white truncate mb-2 leading-snug">
                {ticket.title}
              </h4>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-1">
                  <AlertCircle className={`w-3.5 h-3.5 ${PRIORITY_COLORS[ticket.priority] ?? ''}`} />
                  <span className="capitalize font-medium">{ticket.priority}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{timeAgo(ticket.created_at)}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Right Panel: Detail / Create / Empty ───────────────────────────── */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <Suspense fallback={
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        }>
          {isCreating ? (
            <TicketCreateForm
              onSubmit={handleCreate}
              onCancel={() => setIsCreating(false)}
            />
          ) : selectedTicket ? (
            <TicketDetail
              ticket={selectedTicket}
              isAdmin={!!isAdmin}
              currentUserId={user?.id ?? ''}
              token={token ?? ''}
              onStatusChange={handleStatusChange}
              onSendMessage={handleSendMessage}
              onWsUpdate={handleWsTicketUpdate}
              onBack={() => setSelectedTicket(null)}
            />
          ) : (
            emptyState
          )}
        </Suspense>
      </div>
    </div>
  );
}
