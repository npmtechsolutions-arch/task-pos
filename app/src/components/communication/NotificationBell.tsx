import { useEffect, useRef, useState, useCallback } from 'react';
import { Bell, Check, CheckCheck, Trash2, ExternalLink, Loader2, Volume2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useNotificationStore } from '@/stores/notificationStore';
import { useAuthStore, useUIStore } from '@/stores';
import { Button } from '@/components/ui/button';

const POLL_INTERVAL = 30_000; // 30 seconds

// Request browser notification permission once
async function requestPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
}

// Vibrate + browser push for new notification
function triggerNotificationAlert(title: string, body: string) {
  // Vibration API (mobile/some browsers)
  if ('vibrate' in navigator) {
    navigator.vibrate([200, 100, 200]);
  }
  // Browser Notification
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const n = new Notification(title, {
        body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'app-notification',
        renotify: true,
      });
      setTimeout(() => n.close(), 5000);
    } catch {}
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const TYPE_ICON: Record<string, string> = {
  task_mentioned: '💬',
  task_commented: '📝',
  task_assigned: '👤',
  task_status_changed: '🔄',
  task_due_soon: '⏰',
  task_overdue: '🚨',
  project_invitation: '📧',
  system_announcement: '📢',
};

export function NotificationBell() {
  const { token } = useAuthStore();
  const {
    notifications,
    unreadCount,
    isLoading,
    hasMore,
    fetchNotifications,
    markRead,
    markAllRead,
    deleteNotification,
  } = useNotificationStore();
  const { user } = useAuthStore();
  const { addToast } = useUIStore();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);

  // Request browser notification permission on mount
  useEffect(() => { requestPermission(); }, []);

  // Initial load
  useEffect(() => {
    if (token) fetchNotifications(token, true);
  }, [token]);

  // WebSocket connection for real-time notifications
  useEffect(() => {
    if (!token || !user?.id) return;

    // Connect to global WS (same one used for chat)
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = import.meta.env.VITE_API_URL 
      ? new URL(import.meta.env.VITE_API_URL).host 
      : 'localhost:8000';
    
    // Fallback if VITE_API_URL contains a path, just take the origin
    const wsUrl = `${wsProtocol}//${wsHost}/ws/${user.id}?token=${token}`;
    
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "NEW_NOTIFICATION" && data.data) {
          // Push to state
          useNotificationStore.getState().pushNotification(data.data);
          
          // Show Toast
          addToast({
            type: 'info',
            title: data.data.title,
            message: data.data.message || 'You have a new notification',
          });

          // Trigger Vibrate/System alert
          triggerNotificationAlert(data.data.title, data.data.message || '');
        }
      } catch (e) {
        console.error("WS Message Error", e);
      }
    };

    return () => {
      ws.close();
    };
  }, [token, user?.id, addToast]);


  // Fetch on open
  useEffect(() => {
    if (open && token) {
      fetchNotifications(token, true);
    }
  }, [open, token]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleNotificationClick = async (n: typeof notifications[0]) => {
    if (!n.is_read && token) {
      await markRead(token, [n.id]);
    }
    if (n.action_url) {
      navigate(n.action_url);
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
        aria-label="Notifications"
      >
        <Bell className={cn(
            "w-5 h-5 text-gray-600",
            unreadCount > 0 && "animate-[bell-shake_0.5s_ease-in-out]"
          )} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Slide-in panel */}
      {open && (
        <div
          className={cn(
            'absolute right-0 top-10 w-96 max-h-[520px] bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col z-50',
            'animate-in slide-in-from-top-2 duration-200'
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-indigo-500" />
              <h3 className="font-semibold text-gray-800 text-sm">Notifications</h3>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-[10px] font-bold rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && token && (
              <Button
                size="sm"
                variant="ghost"
                className="text-xs text-indigo-500 hover:text-indigo-700 px-2 h-6"
                onClick={() => markAllRead(token)}
              >
                <CheckCheck className="w-3 h-3 mr-1" />
                Mark all read
              </Button>
            )}
          </div>

          {/* Notification list */}
          <div className="overflow-y-auto flex-1">
            {isLoading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-12">
                <Bell className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">All caught up!</p>
              </div>
            ) : (
              <>
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={cn(
                      'flex gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 group',
                      !n.is_read && 'bg-indigo-50/40'
                    )}
                    onClick={() => handleNotificationClick(n)}
                  >
                    {/* Emoji icon */}
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 text-sm">
                      {TYPE_ICON[n.notification_type] ?? '🔔'}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm text-gray-800 truncate', !n.is_read && 'font-medium')}>
                        {n.title}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                    </div>

                    {/* Actions on hover */}
                    <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!n.is_read && token && (
                        <button
                          title="Mark as read"
                          onClick={(e) => { e.stopPropagation(); markRead(token, [n.id]); }}
                          className="p-1 rounded hover:bg-indigo-100"
                        >
                          <Check className="w-3 h-3 text-indigo-500" />
                        </button>
                      )}
                      {n.action_url && (
                        <button
                          title="Go to item"
                          onClick={(e) => { e.stopPropagation(); navigate(n.action_url!); setOpen(false); }}
                          className="p-1 rounded hover:bg-gray-100"
                        >
                          <ExternalLink className="w-3 h-3 text-gray-400" />
                        </button>
                      )}
                      {token && (
                        <button
                          title="Delete"
                          onClick={(e) => { e.stopPropagation(); deleteNotification(token, n.id); }}
                          className="p-1 rounded hover:bg-red-50"
                        >
                          <Trash2 className="w-3 h-3 text-red-400" />
                        </button>
                      )}
                    </div>

                    {/* Unread dot */}
                    {!n.is_read && (
                      <div className="w-2 h-2 bg-indigo-500 rounded-full flex-shrink-0 mt-1.5" />
                    )}
                  </div>
                ))}

                {/* Load more */}
                {hasMore && (
                  <button
                    className="w-full py-3 text-xs text-indigo-500 hover:bg-gray-50 flex items-center justify-center gap-1"
                    onClick={() => token && fetchNotifications(token)}
                    disabled={isLoading}
                  >
                    {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Load more'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
