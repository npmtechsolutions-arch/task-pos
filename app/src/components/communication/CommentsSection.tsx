import { useCallback, useEffect, useRef, useState } from 'react';
import { Send, Reply, CheckCircle, Circle, Loader2, Smile, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

interface Author {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
}

interface Comment {
  id: string;
  content: string;
  author: Author;
  author_id?: string;
  parent_id: string | null;
  mentions: string[];
  is_edited: boolean;
  is_resolved: boolean;
  created_at: string;
  replies: Comment[];
  reactions?: Record<string, number>;
}

// Common emojis for reactions
const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '🎉', '🙏'];

function timeAgo(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (d < 60) return `${d}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function initials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

// ── Typing Indicator ─────────────────────────────────────────────────────────

function TypingIndicator({ typers }: { typers: string[] }) {
  if (typers.length === 0) return null;
  const names = typers.slice(0, 2).join(', ');
  const extra = typers.length > 2 ? ` +${typers.length - 2}` : '';
  return (
    <div className="flex items-center gap-2 px-2 py-1 text-xs text-gray-500 italic">
      <span className="flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </span>
      <span>{names}{extra} {typers.length === 1 ? 'is' : 'are'} typing…</span>
    </div>
  );
}

// ── Single Comment ──────────────────────────────────────────────────────────

interface CommentItemProps {
  comment: Comment;
  currentUserId?: string;
  token: string;
  taskId: string;
  depth: number;
  onReply: (comment: Comment) => void;
  onReload: () => void;
}

function CommentItem({ comment, currentUserId, token, taskId, depth, onReply, onReload }: CommentItemProps) {
  const [showEmoji, setShowEmoji] = useState(false);
  const [reactions, setReactions] = useState<Record<string, number>>(comment.reactions ?? {});
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const isOwn = comment.author?.id === currentUserId;

  const handleReact = async (emoji: string) => {
    try {
      const res = await axios.post(
        `${API_URL}/tasks/${taskId}/comments/${comment.id}/reactions`,
        { emoji },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setReactions(res.data.reactions ?? {});
    } catch {}
    setShowEmoji(false);
  };

  const handleResolve = async () => {
    try {
      await axios.post(
        `${API_URL}/tasks/${taskId}/comments/${comment.id}/resolve`,
        null,
        {
          params: { resolved: !comment.is_resolved },
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      onReload();
    } catch {}
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this comment?')) return;
    try {
      await axios.delete(`${API_URL}/tasks/${taskId}/comments/${comment.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      onReload();
    } catch {}
  };

  const handleEdit = async () => {
    try {
      await axios.put(
        `${API_URL}/tasks/${taskId}/comments/${comment.id}`,
        { content: editContent },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setEditing(false);
      onReload();
    } catch {}
  };

  return (
    <div
      className={cn(
        'group flex gap-2.5',
        depth > 0 && 'ml-8 mt-2',
        comment.is_resolved && 'opacity-60'
      )}
    >
      <Avatar className="w-7 h-7 flex-shrink-0 mt-0.5">
        <AvatarImage src={comment.author?.avatar_url} />
        <AvatarFallback className="text-[9px] bg-indigo-100 text-indigo-600">
          {initials(comment.author?.full_name ?? '?')}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-baseline gap-2">
          <span className="font-medium text-xs text-gray-800">{comment.author?.full_name}</span>
          <span className="text-[10px] text-gray-400">{timeAgo(comment.created_at)}</span>
          {comment.is_edited && <span className="text-[10px] text-gray-400 italic">(edited)</span>}
        </div>

        {/* Content or edit input */}
        {editing ? (
          <div className="mt-1 flex gap-2">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={2}
              className="flex-1 text-sm border border-indigo-300 rounded-lg p-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <div className="flex flex-col gap-1">
              <Button size="sm" className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700" onClick={handleEdit}>Save</Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <p className={cn('text-sm text-gray-700 mt-0.5 whitespace-pre-wrap break-words', comment.is_resolved && 'line-through')}>
            {comment.content}
          </p>
        )}

        {/* Reactions */}
        {Object.keys(reactions).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {Object.entries(reactions).map(([emoji, count]) => (
              <button
                key={emoji}
                onClick={() => handleReact(emoji)}
                className="flex items-center gap-0.5 px-1.5 py-0.5 bg-gray-100 hover:bg-indigo-50 rounded-full text-xs text-gray-600 transition-colors"
              >
                {emoji} <span className="text-[10px]">{count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Action bar */}
        <div className="flex items-center gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {depth < 3 && (
            <button
              onClick={() => onReply(comment)}
              className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-indigo-500 transition-colors"
            >
              <Reply className="w-3 h-3" /> Reply
            </button>
          )}

          {/* Emoji picker toggle */}
          <div className="relative">
            <button
              onClick={() => setShowEmoji((v) => !v)}
              className="text-[10px] text-gray-400 hover:text-yellow-500 transition-colors"
            >
              <Smile className="w-3 h-3" />
            </button>
            {showEmoji && (
              <div className="absolute bottom-6 left-0 flex gap-1 bg-white border border-gray-200 rounded-xl shadow-lg p-1.5 z-10">
                {QUICK_REACTIONS.map((e) => (
                  <button
                    key={e}
                    onClick={() => handleReact(e)}
                    className="text-base hover:scale-125 transition-transform"
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Resolve (top-level only) */}
          {!comment.parent_id && (
            <button
              onClick={handleResolve}
              className={cn(
                'flex items-center gap-1 text-[10px] transition-colors',
                comment.is_resolved
                  ? 'text-green-500 hover:text-gray-400'
                  : 'text-gray-400 hover:text-green-500'
              )}
            >
              {comment.is_resolved
                ? <CheckCircle className="w-3 h-3" />
                : <Circle className="w-3 h-3" />}
              {comment.is_resolved ? 'Resolved' : 'Resolve'}
            </button>
          )}

          {isOwn && (
            <>
              <button
                onClick={() => setEditing(true)}
                className="text-[10px] text-gray-400 hover:text-blue-500 transition-colors"
              >
                <Pencil className="w-3 h-3" />
              </button>
              <button
                onClick={handleDelete}
                className="text-[10px] text-gray-400 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </>
          )}
        </div>

        {/* Replies (recursive) */}
        {comment.replies?.length > 0 && (
          <div className="mt-2 space-y-3 border-l-2 border-gray-100 pl-3">
            {comment.replies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                currentUserId={currentUserId}
                token={token}
                taskId={taskId}
                depth={depth + 1}
                onReply={onReply}
                onReload={onReload}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Mention Input ────────────────────────────────────────────────────────────

interface MentionInputProps {
  value: string;
  onChange: (v: string) => void;
  onTyping: () => void;
  placeholder?: string;
  rows?: number;
  members: { id: string; full_name: string; email: string }[];
}

function MentionInput({ value, onChange, onTyping, placeholder, rows = 3, members }: MentionInputProps) {
  const [mentionQuery, setMentionQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    onChange(val);
    onTyping();

    // Detect @mention
    const match = val.slice(0, e.target.selectionStart).match(/@(\w*)$/);
    if (match) {
      setMentionQuery(match[1]);
      setShowDropdown(true);
    } else {
      setShowDropdown(false);
    }
  };

  const insertMention = (member: { full_name: string; email: string }) => {
    const before = value.slice(0, value.lastIndexOf('@'));
    onChange(`${before}@${member.email} `);
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  const filtered = members.filter(
    (m) =>
      m.full_name.toLowerCase().includes(mentionQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(mentionQuery.toLowerCase())
  ).slice(0, 5);

  return (
    <div className="relative">
      <textarea
        ref={inputRef}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        rows={rows}
        className="w-full text-sm border border-gray-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all"
      />
      {showDropdown && filtered.length > 0 && (
        <div className="absolute z-20 bottom-full mb-1 left-0 w-60 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          {filtered.map((m) => (
            <button
              key={m.id}
              onMouseDown={(e) => { e.preventDefault(); insertMention(m); }}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-indigo-50 text-left"
            >
              <Avatar className="w-6 h-6">
                <AvatarFallback className="text-[9px] bg-indigo-100 text-indigo-600">
                  {initials(m.full_name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-xs font-medium text-gray-800">{m.full_name}</p>
                <p className="text-[10px] text-gray-400">{m.email}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main CommentsSection ─────────────────────────────────────────────────────

interface CommentsSectionProps {
  taskId: string;
  projectId: string;
}

export function CommentsSection({ taskId, projectId }: CommentsSectionProps) {
  const { token, user } = useAuthStore();
  const [comments, setComments] = useState<Comment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [content, setContent] = useState('');
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [typers, setTypers] = useState<string[]>([]);
  const [members, setMembers] = useState<{ id: string; full_name: string; email: string }[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const PER_PAGE = 20;

  const load = useCallback(async (p = 1, reset = false) => {
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await axios.get(`${API_URL}/tasks/${taskId}/comments`, {
        params: { page: p, per_page: PER_PAGE },
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = res.data;
      setComments((prev) => reset ? data.items : [...prev, ...data.items]);
      setTotal(data.total);
    } catch {}
    setIsLoading(false);
  }, [taskId, token]);

  // Load project members for @mention autocomplete
  useEffect(() => {
    if (!token || !projectId) return;
    axios.get(`${API_URL}/team`, {
      params: { project_id: projectId },
      headers: { Authorization: `Bearer ${token}` },
    }).then((res) => {
      const items = res.data?.members ?? res.data?.items ?? [];
      setMembers(items.map((m: any) => ({
        id: m.user_id ?? m.id,
        full_name: m.user?.full_name ?? m.full_name ?? '',
        email: m.user?.email ?? m.email ?? '',
      })));
    }).catch(() => {});
  }, [token, projectId]);

  // Initial load
  useEffect(() => {
    load(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  // WebSocket: join task room for real-time comments
  useEffect(() => {
    if (!token || !user?.id) return;
    const ws = new WebSocket(`ws://localhost:8000/ws/${user.id}?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'join_room', room: `task:${taskId}` }));
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);

        if (msg.type === 'comment_added') {
          // Re-load to get full comment with author details
          load(1, true);
        }

        if (msg.type === 'comment_edited') {
          setComments((prev) =>
            prev.map((c) =>
              c.id === msg.comment_id
                ? { ...c, content: msg.content, is_edited: true }
                : c
            )
          );
        }

        if (msg.type === 'typing') {
          const name = msg.user_name || 'Someone';
          setTypers((prev) => {
            if (prev.includes(name)) return prev;
            return [...prev, name];
          });
          // Auto-clear typing indicator after 2.5s
          setTimeout(() => {
            setTypers((prev) => prev.filter((n) => n !== name));
          }, 2500);
        }
      } catch {}
    };

    ws.onerror = () => ws.close();

    return () => {
      ws.send(JSON.stringify({ type: 'leave_room', room: `task:${taskId}` }));
      ws.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, token, user?.id]);

  // Typing indicator: debounce 500ms, auto-stop after 2s inactivity
  const handleTyping = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({
      type: 'typing',
      room: `task:${taskId}`,
      user_name: user?.firstName ? `${user.firstName} ${user.lastName ?? ''}`.trim() : 'Someone',
    }));
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      // Stopped typing — no explicit stop event needed; clients timeout at 2.5s
    }, 500);
  }, [taskId, user]);

  const handleSubmit = async () => {
    if (!content.trim() || !token) return;
    setIsSubmitting(true);
    try {
      await axios.post(
        `${API_URL}/tasks/${taskId}/comments`,
        { content: content.trim(), parent_id: replyTo?.id ?? null },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setContent('');
      setReplyTo(null);
      load(1, true);
    } catch {}
    setIsSubmitting(false);
  };

  const hasMore = comments.length < total;

  return (
    <div className="space-y-4">
      {/* Comment list */}
      <div ref={listRef} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-gray-700">Comments ({total})</h4>
        </div>

        {isLoading && comments.length === 0 ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-sm text-gray-400 italic text-center py-6">No comments yet. Be the first!</p>
        ) : (
          <div className="space-y-4">
            {comments.map((c) => (
              <CommentItem
                key={c.id}
                comment={c}
                currentUserId={user?.id}
                token={token ?? ''}
                taskId={taskId}
                depth={0}
                onReply={setReplyTo}
                onReload={() => load(1, true)}
              />
            ))}
          </div>
        )}

        {hasMore && (
          <button
            onClick={() => { const next = page + 1; setPage(next); load(next); }}
            disabled={isLoading}
            className="w-full text-xs text-indigo-500 hover:text-indigo-700 py-2 flex items-center justify-center gap-1"
          >
            {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : `Load more (${total - comments.length} remaining)`}
          </button>
        )}

        {/* Typing indicator */}
        <TypingIndicator typers={typers} />
      </div>

      {/* Composer */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        {replyTo && (
          <div className="flex items-center justify-between mb-2 px-2 py-1 bg-indigo-50 rounded-lg">
            <p className="text-xs text-indigo-600">
              Replying to <strong>{replyTo.author.full_name}</strong>:{' '}
              <span className="text-gray-500">{replyTo.content.slice(0, 50)}…</span>
            </p>
            <button
              onClick={() => setReplyTo(null)}
              className="text-gray-400 hover:text-red-500 text-xs"
            >
              ✕
            </button>
          </div>
        )}

        <MentionInput
          value={content}
          onChange={setContent}
          onTyping={handleTyping}
          placeholder="Write a comment… Use @ to mention someone"
          members={members}
        />

        <div className="flex justify-between items-center mt-2">
          <p className="text-xs text-gray-400">Tip: Type @ to mention a teammate</p>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={isSubmitting || !content.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 gap-1.5"
          >
            {isSubmitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            {replyTo ? 'Reply' : 'Comment'}
          </Button>
        </div>
      </div>
    </div>
  );
}
