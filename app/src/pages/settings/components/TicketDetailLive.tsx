/**
 * TicketDetailLive — Real-time ticket detail with chat
 * Connects to WebSocket room for instant message delivery
 */

import { useState, useRef, useEffect, useCallback, memo } from 'react';
import {
  AlertCircle, Box, CheckCircle2, ArrowLeft, Send, Shield, User as UserIcon, X
} from 'lucide-react';
import { toast } from 'sonner';
import type { Ticket, TicketMessage } from '@/api/support';
import { useTicketWebSocket } from '@/hooks/useTicketWebSocket';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const STATUS_OPTIONS = [
  { value: 'OPEN', label: 'Open' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'WAITING_FOR_USER', label: 'Waiting for User' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' }
];

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
  ASSIGNED: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400',
  IN_PROGRESS: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
  WAITING_FOR_USER: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400',
  RESOLVED: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
  CLOSED: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// ─── Message Bubble ───────────────────────────────────────────────────────────
const MessageBubble = memo(({
  msg, isOwn
}: { msg: TicketMessage; isOwn: boolean }) => {
  const name = msg.sender?.full_name ?? 'Unknown';
  const initial = name.charAt(0).toUpperCase();

  return (
    <div className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : 'flex-row'} group`}>
      <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold shadow-sm ${
        isOwn
          ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400'
          : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
      }`}>
        {initial}
      </div>
      <div className={`flex-1 max-w-[75%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{name}</span>
          <span className="text-[10px] text-slate-400">{formatTime(msg.timestamp)}</span>
        </div>
        <div className={`p-3 rounded-2xl text-sm leading-relaxed shadow-sm transition-shadow group-hover:shadow-md ${
          isOwn
            ? 'bg-indigo-600 text-white rounded-tr-none'
            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-slate-700 rounded-tl-none'
        }`}>
          {msg.message}
        </div>
      </div>
    </div>
  );
});
MessageBubble.displayName = 'MessageBubble';

// ─── Props ────────────────────────────────────────────────────────────────────
interface TicketDetailLiveProps {
  ticket: Ticket;
  isAdmin: boolean;
  currentUserId: string;
  token: string;
  onStatusChange: (ticketId: string, status: Ticket['status']) => Promise<void>;
  onSendMessage: (ticketId: string, message: string) => Promise<void>;
  onWsUpdate: (ticketId: string, newStatus: string) => void;
  onBack: () => void;
}

// ─── Main Component ────────────────────────────────────────────────────────────
export const TicketDetailLive = memo(({
  ticket,
  isAdmin,
  currentUserId,
  token,
  onStatusChange,
  onSendMessage,
  onWsUpdate,
  onBack,
}: TicketDetailLiveProps) => {
  const [messages, setMessages] = useState<TicketMessage[]>(ticket.messages ?? []);
  const [reply, setReply] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(ticket.status);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const userId = currentUserId;

  // Sync messages when ticket prop changes (new ticket selected)
  useEffect(() => {
    setMessages(ticket.messages ?? []);
    setCurrentStatus(ticket.status);
  }, [ticket.id, ticket.messages, ticket.status]);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // WebSocket — receive real-time messages
  const handleWsMessage = useCallback((wsMsg: NonNullable<{ id: string; sender_id: string; sender_name: string; message: string; timestamp: string; is_admin: boolean }>) => {
    // Don't duplicate messages we sent ourselves
    setMessages(prev => {
      if (prev.some(m => m.id === wsMsg.id)) return prev;
      const newMsg: TicketMessage = {
        id: wsMsg.id,
        ticket_id: ticket.id,
        sender_id: wsMsg.sender_id,
        message: wsMsg.message,
        timestamp: wsMsg.timestamp,
        sender: { id: wsMsg.sender_id, first_name: wsMsg.sender_name, last_name: '', full_name: wsMsg.sender_name, avatar_url: undefined },
      };
      return [...prev, newMsg];
    });
  }, [ticket.id]);

  const handleWsStatusUpdate = useCallback((newStatus: string) => {
    setCurrentStatus(newStatus as Ticket['status']);
    onWsUpdate(ticket.id, newStatus);
    toast.info(`Status changed to ${newStatus.replace(/_/g, ' ')}`);
  }, [ticket.id, onWsUpdate]);

  useTicketWebSocket({
    userId,
    token,
    ticketId: ticket.id,
    onNewMessage: handleWsMessage,
    onTicketUpdate: handleWsStatusUpdate,
  });

  // Send a reply
  const handleSend = useCallback(async () => {
    const msg = reply.trim();
    if (!msg) return;
    setIsSending(true);
    setReply('');
    try {
      await onSendMessage(ticket.id, msg);
    } catch {
      toast.error('Failed to send message');
      setReply(msg);
    } finally {
      setIsSending(false);
    }
  }, [reply, ticket.id, onSendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // Status change
  const handleStatusChange = useCallback(async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const s = e.target.value as Ticket['status'];
    setIsUpdatingStatus(true);
    try {
      await onStatusChange(ticket.id, s);
      setCurrentStatus(s);
    } finally {
      setIsUpdatingStatus(false);
    }
  }, [ticket.id, onStatusChange]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm z-10">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            {/* Back button (mobile) */}
            <button
              onClick={onBack}
              className="md:hidden flex-shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all mt-0.5"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 tracking-wider">
                  {ticket.ticket_id}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${STATUS_COLORS[currentStatus] ?? ''}`}>
                  {currentStatus.replace(/_/g, ' ')}
                </span>
              </div>
              <h1 className="text-lg font-extrabold text-slate-900 dark:text-white leading-snug truncate">
                {ticket.title}
              </h1>
              <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-slate-500 font-medium">
                <span className="flex items-center gap-1.5 capitalize">
                  <AlertCircle className="w-3.5 h-3.5" /> {ticket.priority} Priority
                </span>
                <span className="flex items-center gap-1.5 capitalize">
                  <Box className="w-3.5 h-3.5" /> {ticket.category}
                </span>
                <span className="flex items-center gap-1.5">
                  <UserIcon className="w-3.5 h-3.5" />
                  {ticket.created_by?.full_name ?? 'Unknown user'}
                </span>
              </div>
            </div>
          </div>

          {/* Admin Controls */}
          {isAdmin && (
            <div className="flex-shrink-0 flex flex-col sm:flex-row items-start sm:items-center gap-2">
              <select
                value={currentStatus}
                onChange={handleStatusChange}
                disabled={isUpdatingStatus}
                className="text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 transition-all cursor-pointer min-w-[150px]"
              >
                {STATUS_OPTIONS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              {currentStatus !== 'RESOLVED' && currentStatus !== 'CLOSED' && (
                <button
                  onClick={() => onStatusChange(ticket.id, 'RESOLVED')}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold border border-green-200 text-green-700 bg-green-50 rounded-xl hover:bg-green-100 dark:border-green-500/30 dark:text-green-400 dark:bg-green-500/10 transition-all active:scale-95"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Mark Resolved
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Description (collapsible intro) */}
      {ticket.description && (
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-800">
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-2">
            <span className="font-semibold text-slate-700 dark:text-slate-300 mr-1">Description:</span>
            {ticket.description}
          </p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 scroll-smooth">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-slate-400 text-center">
            <Shield className="w-10 h-10 mb-3 opacity-20" />
            <p className="text-sm font-medium">No messages yet.</p>
            <p className="text-xs mt-1">Send the first message below.</p>
          </div>
        )}
        {messages.map(msg => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            isOwn={msg.sender_id === currentUserId}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply Box */}
      <div className="p-4 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 shadow-[0_-2px_12px_rgba(0,0,0,0.04)]">
        <div className="relative">
          <textarea
            value={reply}
            onChange={e => setReply(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={3}
            placeholder="Type a reply... (Ctrl+Enter to send)"
            className="w-full resize-none px-4 py-3 pb-14 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-slate-400 leading-relaxed"
          />
          <div className="absolute bottom-3 right-3 flex items-center gap-2">
            {reply.trim() && (
              <button
                onClick={() => setReply('')}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={handleSend}
              disabled={!reply.trim() || isSending}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 shadow-md shadow-indigo-200 dark:shadow-none"
            >
              {isSending
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Send className="w-4 h-4" />
              }
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

TicketDetailLive.displayName = 'TicketDetailLive';
