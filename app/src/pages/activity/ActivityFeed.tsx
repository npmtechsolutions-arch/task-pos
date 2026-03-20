import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, RefreshCw, User, Folder, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

type FeedTab = 'personal' | 'project';

interface ActivityItem {
  id: string;
  task_id: string;
  project_id?: string;
  action: string;
  description: string;
  metadata: Record<string, any>;
  created_at: string;
  actor?: {
    id: string;
    full_name: string;
    email: string;
    avatar_url?: string;
  };
}

const ACTION_COLORS: Record<string, string> = {
  created: 'bg-green-100 text-green-700',
  updated: 'bg-blue-100 text-blue-700',
  deleted: 'bg-red-100 text-red-700',
  commented: 'bg-purple-100 text-purple-700',
  status_changed: 'bg-amber-100 text-amber-700',
  assigned: 'bg-indigo-100 text-indigo-700',
  completed: 'bg-emerald-100 text-emerald-700',
  reopened: 'bg-orange-100 text-orange-700',
};

const ACTION_ICONS: Record<string, string> = {
  created: '✨',
  updated: '✏️',
  deleted: '🗑️',
  commented: '💬',
  status_changed: '🔄',
  assigned: '👤',
  completed: '✅',
  reopened: '🔓',
};

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const action = item.action?.toLowerCase() ?? '';
  const colorClass = ACTION_COLORS[action] ?? 'bg-gray-100 text-gray-600';
  const icon = ACTION_ICONS[action] ?? '📋';
  const actor = item.actor;

  return (
    <div className="flex items-start gap-3 py-3 px-4 hover:bg-gray-50 rounded-xl transition-colors group">
      {/* Avatar */}
      <Avatar className="w-8 h-8 flex-shrink-0 mt-0.5">
        <AvatarImage src={actor?.avatar_url} />
        <AvatarFallback className="text-[10px] bg-indigo-100 text-indigo-600">
          {actor ? initials(actor.full_name) : '?'}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm text-gray-800">
            {actor?.full_name ?? 'Unknown'}
          </span>
          {/* Action badge */}
          <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', colorClass)}>
            {icon} {action.replace('_', ' ')}
          </span>
        </div>

        <p className="text-sm text-gray-600 mt-0.5">{item.description}</p>

        <div className="flex items-center gap-3 mt-1">
          <span className="text-[10px] text-gray-400">{timeAgo(item.created_at)}</span>
          {item.task_id && (
            <Link
              to={`/tasks/${item.task_id}`}
              className="text-[10px] text-indigo-500 hover:text-indigo-700 font-mono"
            >
              #{item.task_id.slice(0, 8)}
            </Link>
          )}
        </div>
      </div>

      {/* Right timestamp */}
      <span className="text-[10px] text-gray-300 flex-shrink-0 hidden group-hover:hidden">
        {new Date(item.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  );
}

export function ActivityFeed() {
  const { token } = useAuthStore();
  const [tab, setTab] = useState<FeedTab>('personal');
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async (cursor: string | null = null, reset = false) => {
    if (!token || isLoading) return;
    setIsLoading(true);
    try {
      const endpoint = tab === 'personal'
        ? `${API_URL}/activity/personal`
        : `${API_URL}/activity/personal`; // fallback for now

      const res = await axios.get(endpoint, {
        params: { per_page: 30, cursor: cursor || undefined },
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = res.data;
      const fetched: ActivityItem[] = data.items ?? [];

      setItems((prev) => reset ? fetched : [...prev, ...fetched]);
      setNextCursor(data.next_cursor ?? null);
      setHasMore(fetched.length === 30);
    } catch {
      setHasMore(false);
    }
    setIsLoading(false);
  }, [tab, token]);

  // Re-load when tab changes
  useEffect(() => {
    setItems([]);
    setNextCursor(null);
    setHasMore(true);
    load(null, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Infinite scroll with IntersectionObserver
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          load(nextCursor);
        }
      },
      { threshold: 0.5 }
    );
    if (sentinelRef.current) observerRef.current.observe(sentinelRef.current);
    return () => observerRef.current?.disconnect();
  }, [hasMore, isLoading, nextCursor, load]);

  const tabs: { id: FeedTab; label: string; icon: React.ReactNode }[] = [
    { id: 'personal', label: 'My Activity', icon: <User className="w-3.5 h-3.5" /> },
    { id: 'project', label: 'Project Feed', icon: <Folder className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Activity Feed</h1>
              <p className="text-xs text-gray-400">Track all changes across your tasks and projects</p>
            </div>
          </div>
          <button
            onClick={() => { setItems([]); setNextCursor(null); setHasMore(true); load(null, true); }}
            className="p-2 hover:bg-white rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-xl border border-gray-100 p-1 shadow-sm mb-4">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-all',
                tab === t.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              )}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Feed */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {isLoading && items.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-16">
              <Activity className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">No activity yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {items.map((item) => (
                <ActivityRow key={item.id} item={item} />
              ))}
            </div>
          )}

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className="py-2 flex justify-center">
            {isLoading && items.length > 0 && (
              <Loader2 className="w-4 h-4 animate-spin text-gray-300" />
            )}
            {!hasMore && items.length > 0 && (
              <p className="text-xs text-gray-300 py-2">You're all caught up!</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
