import { useEffect, useRef } from 'react';
import { useNotificationStore } from '@/stores/notificationStore';
import { useKanbanStore } from '@/stores/kanbanStore';
import { getQueryClient } from '@/lib/queryClient';

const WS_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1')
  .replace(/^http/, 'ws')
  .replace('/api/v1', '');

interface UseWebSocketOptions {
  userId: string;
  token: string;
  enabled?: boolean;
}

// Global task-event dispatcher — Kanban/Reports subscribe to this
type TaskEventHandler = (event: { type: string; data: any }) => void;
const taskEventListeners = new Set<TaskEventHandler>();

export function subscribeToTaskEvents(handler: TaskEventHandler) {
  taskEventListeners.add(handler);
  return () => taskEventListeners.delete(handler);
}

/**
 * Connects to the backend WebSocket at /ws/{userId}?token=<jwt>
 * Listens for notification events and pushes them to the notification store.
 * Also dispatches task.updated / task.created events to subscribers (Kanban, Reports).
 * Automatically reconnects on disconnect (exponential back-off, max 30s).
 */
export function useWebSocket({ userId, token, enabled = true }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelay = useRef(1000);

  useEffect(() => {
    if (!enabled || !userId || !token) return;

    const connect = () => {
      const url = `${WS_BASE}/ws/${userId}?token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.debug('[WS] Connected');
        reconnectDelay.current = 1000; // reset on success
        // Send a ping every 25s to keep connection alive
        const pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          } else {
            clearInterval(pingInterval);
          }
        }, 25000);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          // ── Notification events → push to Zustand store + bust RQ cache ───
          if ((msg.type === 'notification' || msg.type === 'NEW_NOTIFICATION') && msg.data) {
            useNotificationStore.getState().pushNotification(msg.data);
            // Immediately invalidate React Query unread-count cache
            try {
              getQueryClient().invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
            } catch { /* safe to ignore */ }
          }

          // ── Task lifecycle events → dispatch to all subscribers ──────────
          // TIMESTAMP GUARD: only forward if the incoming event is newer than
          // what we already have locally. This prevents stale WS broadcasts
          // (e.g. reconnect replays or delayed server events) from overwriting
          // a recent optimistic Kanban move with old data.
          if (
            msg.type === 'task.updated' ||
            msg.type === 'task.created' ||
            msg.type === 'task.moved' ||
            msg.type === 'task.completed' ||
            msg.type === 'dashboard_update'
          ) {
            const incomingUpdatedAt = msg.data?.updated_at
              ? new Date(msg.data.updated_at).getTime()
              : Infinity; // no timestamp → always forward (safe default)

            // Pull the local task's updated_at from the Kanban store (synchronous)
            let localUpdatedAt = 0;
            if (msg.data?.id || msg.data?.task_id) {
              const taskId = msg.data?.id || msg.data?.task_id;
              try {
                const { columns } = useKanbanStore.getState();
                for (const col of columns) {
                  const t = col.tasks.find((x) => x.id === taskId);
                  if (t) {
                    localUpdatedAt = new Date(t.updatedAt || 0).getTime();
                    break;
                  }
                }
              } catch { /* ignore — store not ready */ }
            }

            // Only dispatch if WS data is actually newer (or no local copy)
            if (incomingUpdatedAt >= localUpdatedAt) {
              taskEventListeners.forEach((handler) => {
                try { handler(msg); } catch { /* ignore handler errors */ }
              });
            }
          }
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = (e) => {
        console.debug('[WS] Disconnected', e.code);
        if (e.code !== 1000) {
          // Abnormal close — reconnect with back-off
          reconnectTimeout.current = setTimeout(() => {
            reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30000);
            connect();
          }, reconnectDelay.current);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      reconnectTimeout.current && clearTimeout(reconnectTimeout.current);
      wsRef.current?.close(1000, 'component unmount');
    };
  }, [userId, token, enabled]);

  return wsRef;
}
