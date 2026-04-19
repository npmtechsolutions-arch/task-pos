/**
 * ChatPage — WhatsApp-style project conversation module
 * Features: Rooms list, messages, file sharing, @mentions, notifications
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import {
  MessageCircle, Plus, Send, Paperclip, Search, X, Users,
  Hash, Bell, BellOff, Check, CheckCheck, Trash2, AtSign,
  Loader2, ChevronRight, Image, FileText, Reply
} from 'lucide-react';
import { cn } from '@/lib/utils';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
const auth = () => {
  const t = localStorage.getItem('token') || localStorage.getItem('access_token');
  return t ? { Authorization: `Bearer ${t}` } : {};
};
const me = () => { try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; } };

interface Room {
  id: string; name: string; description?: string;
  project_id?: string; task_id?: string; is_direct: boolean;
  created_by: string; created_at: string;
  unread_count: number; last_message?: string; last_message_at?: string;
}
interface Message {
  id: string; room_id: string; sender_id: string; sender_name: string;
  message_type: string; content: string;
  file_url?: string; file_name?: string; file_size?: number;
  reply_to_id?: string; is_deleted: boolean; mentions?: string[];
  created_at: string; updated_at: string;
}
interface TenantUser { id: string; email: string; first_name?: string; last_name?: string; }

const POLL_INTERVAL = 4000; // 4s polling (simulate near real-time)

export default function ChatPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [showNewRoom, setShowNewRoom] = useState(false);
  const [search, setSearch] = useState('');
  const [tenantUsers, setTenantUsers] = useState<TenantUser[]>([]);
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentUser = me();

  // Load rooms
  const loadRooms = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/chat/rooms`, { headers: auth() });
      setRooms(r.data || []);
    } catch {}
    setLoadingRooms(false);
  }, []);

  // Load users for @mention
  const loadUsers = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/hr/users`, { headers: auth() });
      setTenantUsers(r.data || []);
    } catch {}
  }, []);

  // Load notifications
  const loadNotifications = useCallback(async () => {
    try {
      const [nr, cr] = await Promise.all([
        axios.get(`${API}/chat/notifications?limit=20`, { headers: auth() }),
        axios.get(`${API}/chat/notifications/unread-count`, { headers: auth() }),
      ]);
      setNotifications(nr.data || []);
      setUnreadCount(cr.data?.count || 0);
    } catch {}
  }, []);

  useEffect(() => {
    loadRooms();
    loadUsers();
    loadNotifications();
  }, []);

  // Fetch messages for active room
  const fetchMessages = useCallback(async (roomId: string) => {
    try {
      const r = await axios.get(`${API}/chat/rooms/${roomId}/messages?limit=80`, { headers: auth() });
      setMessages(r.data || []);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch {}
    setLoadingMsgs(false);
  }, []);

  // Start polling when room selected
  useEffect(() => {
    if (!activeRoom) return;
    setLoadingMsgs(true);
    fetchMessages(activeRoom.id);
    loadNotifications();
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      fetchMessages(activeRoom.id);
      loadNotifications();
    }, POLL_INTERVAL);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeRoom?.id]);

  const sendMessage = async () => {
    if (!text.trim() || !activeRoom || sending) return;
    setSending(true);
    const mentions: string[] = [];
    const regex = /@\[([^\]]+)\]\(([^)]+)\)/g;
    let m;
    while ((m = regex.exec(text)) !== null) mentions.push(m[2]);

    const cleanContent = text.replace(/@\[([^\]]+)\]\(([^)]+)\)/g, '@$1');
    try {
      const r = await axios.post(
        `${API}/chat/rooms/${activeRoom.id}/messages`,
        { content: cleanContent, message_type: 'text', mentions, reply_to_id: replyTo?.id },
        { headers: auth() }
      );
      setMessages(prev => [...prev, r.data]);
      setText(''); setReplyTo(null);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch {}
    setSending(false);
  };

  const deleteMessage = async (msgId: string) => {
    try {
      await axios.delete(`${API}/chat/messages/${msgId}`, { headers: auth() });
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, is_deleted: true, content: '[Message deleted]' } : m));
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await axios.post(`${API}/chat/notifications/mark-all-read`, {}, { headers: auth() });
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch {}
  };

  // Handle @mention input
  const handleTextChange = (v: string) => {
    setText(v);
    const lastAt = v.lastIndexOf('@');
    if (lastAt >= 0 && lastAt === v.length - 1) {
      setMentionQuery(''); setShowMentions(true);
    } else if (lastAt >= 0 && !v.slice(lastAt + 1).includes(' ')) {
      setMentionQuery(v.slice(lastAt + 1)); setShowMentions(true);
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (user: TenantUser) => {
    const name = `${user.first_name || ''} ${user.last_name || ''}`.trim();
    const lastAt = text.lastIndexOf('@');
    setText(text.slice(0, lastAt) + `@[${name}](${user.id}) `);
    setShowMentions(false);
  };

  const filteredRooms = rooms.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );
  const mentionResults = tenantUsers.filter(u => {
    const full = `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase();
    return full.includes(mentionQuery.toLowerCase()) && u.id !== currentUser.id;
  }).slice(0, 6);

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-lg border border-gray-100 dark:border-gray-800">

      {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
      <div className="w-72 border-r border-gray-100 dark:border-gray-800 flex flex-col bg-gray-50 dark:bg-gray-900">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between mb-3">
            <h1 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-violet-600" /> Conversations
            </h1>
            <div className="flex gap-1">
              {/* Notifications bell */}
              <button
                id="btn-notifications"
                onClick={() => { setShowNotifs(!showNotifs); if (!showNotifs) loadNotifications(); }}
                className="relative p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg"
              >
                <Bell className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              <button
                id="btn-new-room"
                onClick={() => setShowNewRoom(true)}
                className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg"
              >
                <Plus className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-gray-400" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search rooms…"
              className="w-full pl-7 pr-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
          </div>
        </div>

        {/* Notification panel */}
        {showNotifs && (
          <div className="border-b border-gray-100 dark:border-gray-800 max-h-60 overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Notifications</span>
              <button onClick={markAllRead} className="text-[10px] text-violet-600 hover:underline">Mark all read</button>
            </div>
            {notifications.length === 0 ? (
              <p className="text-center text-xs text-gray-400 py-4">No notifications</p>
            ) : notifications.map(n => (
              <div key={n.id} className={cn('px-4 py-2.5 text-sm border-b border-gray-50 dark:border-gray-800', !n.is_read && 'bg-violet-50 dark:bg-violet-900/20')}>
                <p className="font-medium text-gray-800 dark:text-white text-xs">{n.title}</p>
                <p className="text-gray-500 text-[11px] truncate">{n.message}</p>
              </div>
            ))}
          </div>
        )}

        {/* Room list */}
        <div className="flex-1 overflow-y-auto">
          {loadingRooms ? (
            <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-violet-400" /></div>
          ) : filteredRooms.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <Hash className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No rooms yet</p>
              <button onClick={() => setShowNewRoom(true)} className="text-violet-600 text-xs mt-1 hover:underline">Create one</button>
            </div>
          ) : filteredRooms.map(room => (
            <button
              key={room.id}
              onClick={() => setActiveRoom(room)}
              className={cn(
                'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors border-b border-gray-100 dark:border-gray-800',
                activeRoom?.id === room.id
                  ? 'bg-violet-50 dark:bg-violet-900/30'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-800'
              )}
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                {room.name[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-800 dark:text-white text-sm truncate">{room.name}</span>
                  {room.unread_count > 0 && (
                    <span className="bg-violet-600 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 flex-shrink-0 ml-1">
                      {room.unread_count}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 truncate mt-0.5">{room.last_message || 'No messages yet'}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Chat Area ─────────────────────────────────────────────────────────── */}
      {activeRoom ? (
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold">
              {activeRoom.name[0].toUpperCase()}
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white text-sm">{activeRoom.name}</h2>
              {activeRoom.description && <p className="text-xs text-gray-400">{activeRoom.description}</p>}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 bg-gray-50 dark:bg-gray-950">
            {loadingMsgs ? (
              <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-violet-400" /></div>
            ) : messages.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">No messages yet</p>
                <p className="text-xs mt-1">Start the conversation!</p>
              </div>
            ) : messages.map(msg => {
              const isMe = msg.sender_id === currentUser.id;
              return (
                <div key={msg.id} className={cn('flex gap-2 group', isMe && 'flex-row-reverse')}>
                  {/* Avatar */}
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {(msg.sender_name?.[0] || '?').toUpperCase()}
                  </div>
                  <div className={cn('max-w-[70%] space-y-0.5', isMe && 'items-end flex flex-col')}>
                    {!isMe && <span className="text-[11px] text-gray-500 font-medium ml-1">{msg.sender_name}</span>}
                    <div
                      className={cn(
                        'px-3.5 py-2 rounded-2xl text-sm shadow-sm relative',
                        isMe
                          ? 'bg-violet-600 text-white rounded-tr-sm'
                          : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-white rounded-tl-sm border border-gray-100 dark:border-gray-700',
                        msg.is_deleted && 'opacity-50 italic'
                      )}
                    >
                      {/* Reply preview */}
                      {msg.reply_to_id && (
                        <div className={cn('text-[10px] opacity-70 border-l-2 pl-2 mb-1', isMe ? 'border-white/50' : 'border-violet-400')}>
                          Replied to a message
                        </div>
                      )}
                      {/* File attachment */}
                      {msg.file_url && !msg.is_deleted && (
                        <a href={msg.file_url} target="_blank" rel="noreferrer"
                          className={cn('flex items-center gap-2 mb-1.5 px-2 py-1.5 rounded-lg text-xs', isMe ? 'bg-white/20' : 'bg-gray-100 dark:bg-gray-700')}>
                          <FileText className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate max-w-[180px]">{msg.file_name || 'Attachment'}</span>
                        </a>
                      )}
                      <span>{msg.content}</span>
                      <span className={cn('text-[10px] ml-2 opacity-60 whitespace-nowrap')}>
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {/* Actions */}
                    {!msg.is_deleted && (
                      <div className={cn('flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity', isMe && 'flex-row-reverse')}>
                        <button onClick={() => setReplyTo(msg)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-400">
                          <Reply className="w-3 h-3" />
                        </button>
                        {isMe && (
                          <button onClick={() => deleteMessage(msg.id)} className="p-1 hover:bg-red-100 rounded text-red-400">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply bar */}
          {replyTo && (
            <div className="flex items-center gap-2 px-4 py-2 bg-violet-50 dark:bg-violet-900/20 border-t border-violet-100 dark:border-violet-800">
              <Reply className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />
              <span className="text-xs text-violet-700 dark:text-violet-300 truncate flex-1">
                Replying to <strong>{replyTo.sender_name}</strong>: {replyTo.content.slice(0, 60)}
              </span>
              <button onClick={() => setReplyTo(null)} className="text-violet-400 hover:text-violet-600">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* @Mention dropdown */}
          {showMentions && mentionResults.length > 0 && (
            <div className="mx-4 mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden">
              {mentionResults.map(u => (
                <button key={u.id} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-violet-50 dark:hover:bg-violet-900/30 text-left"
                  onClick={() => insertMention(u)}>
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold">
                    {(u.first_name?.[0] || u.email[0]).toUpperCase()}
                  </div>
                  <span className="text-sm text-gray-700 dark:text-gray-200">
                    {u.first_name} {u.last_name}
                  </span>
                  <span className="text-xs text-gray-400 ml-auto">{u.email}</span>
                </button>
              ))}
            </div>
          )}

          {/* Input bar */}
          <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
            <div className="flex items-end gap-2">
              <div className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5">
                <textarea
                  id="chat-input"
                  rows={1}
                  value={text}
                  onChange={e => handleTextChange(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder={`Message ${activeRoom.name}… (@ to mention)`}
                  className="w-full bg-transparent text-sm text-gray-800 dark:text-white placeholder-gray-400 outline-none resize-none max-h-28"
                />
              </div>
              <button
                id="btn-send-message"
                onClick={sendMessage}
                disabled={!text.trim() || sending}
                className="p-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl transition-colors"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-gray-400 mt-1 ml-1">Enter to send · Shift+Enter for new line · @ to mention</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 to-violet-50/30 dark:from-gray-900 dark:to-gray-800">
          <div className="text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
              <MessageCircle className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">Team Conversations</h2>
            <p className="text-gray-500 text-sm mt-2 max-w-xs">Select a conversation or create a new chat room to start collaborating</p>
            <button id="btn-start-chat" onClick={() => setShowNewRoom(true)}
              className="mt-4 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold">
              + New Conversation
            </button>
          </div>
        </div>
      )}

      {/* ── New Room Modal ──────────────────────────────────────────────────── */}
      {showNewRoom && (
        <NewRoomModal
          tenantUsers={tenantUsers}
          onClose={() => setShowNewRoom(false)}
          onCreated={(room) => { setRooms(prev => [room, ...prev]); setActiveRoom(room); setShowNewRoom(false); }}
        />
      )}
    </div>
  );
}

function NewRoomModal({ tenantUsers, onClose, onCreated }: {
  tenantUsers: TenantUser[];
  onClose: () => void;
  onCreated: (r: Room) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggle = (uid: string) =>
    setSelectedMembers(prev => prev.includes(uid) ? prev.filter(x => x !== uid) : [...prev, uid]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Room name is required'); return; }
    setSaving(true); setError('');
    try {
      const r = await axios.post(
        `${API}/chat/rooms`,
        { name, description: description || undefined, member_ids: selectedMembers },
        { headers: auth() }
      );
      onCreated(r.data);
    } catch (e: any) { setError(e.response?.data?.detail ?? e.message); }
    setSaving(false);
  };

  const filtered = tenantUsers.filter(u => {
    const full = `${u.first_name || ''} ${u.last_name || ''} ${u.email}`.toLowerCase();
    return full.includes(search.toLowerCase());
  });

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white">New Conversation</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-400"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleCreate} className="p-6 space-y-4">
          {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Room Name *</label>
            <input autoFocus value={name} onChange={e => setName(e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white dark:bg-gray-700 dark:text-white"
              placeholder="e.g. design-team, project-alpha" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <input value={description} onChange={e => setDescription(e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white dark:bg-gray-700 dark:text-white"
              placeholder="Optional description" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Add Members ({selectedMembers.length} selected)
            </label>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search users…"
              className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white dark:bg-gray-700 dark:text-white mb-2" />
            <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden max-h-40 overflow-y-auto">
              {filtered.slice(0, 20).map(u => (
                <button key={u.id} type="button"
                  onClick={() => toggle(u.id)}
                  className={cn('w-full flex items-center gap-2 px-3 py-2 text-left transition-colors text-sm',
                    selectedMembers.includes(u.id) ? 'bg-violet-50 dark:bg-violet-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700')}>
                  <div className={cn('w-4 h-4 rounded border flex items-center justify-center flex-shrink-0',
                    selectedMembers.includes(u.id) ? 'bg-violet-600 border-violet-600' : 'border-gray-300')}>
                    {selectedMembers.includes(u.id) && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {(u.first_name?.[0] || u.email[0]).toUpperCase()}
                  </div>
                  <span className="text-gray-700 dark:text-gray-200">{u.first_name} {u.last_name}</span>
                  <span className="text-gray-400 text-xs ml-auto">{u.email}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-200 rounded-lg py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={!name.trim() || saving} id="btn-create-room"
              className="flex-1 bg-violet-600 hover:bg-violet-700 text-white rounded-lg py-2 text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Create Room
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
