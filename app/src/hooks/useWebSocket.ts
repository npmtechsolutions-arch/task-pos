import { useEffect, useRef } from 'react';
import { useNotificationStore } from '@/stores/notificationStore';

const WS_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1')
  .replace(/^http/, 'ws')
  .replace('/api/v1', '');

interface UseWebSocketOptions {
  userId: string;
  token: string;
  enabled?: boolean;
}

/**
 * Connects to the backend WebSocket at /ws/{userId}?token=<jwt>
 * Listens for notification events and pushes them to the notification store.
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
          if ((msg.type === 'notification' || msg.type === 'NEW_NOTIFICATION') && msg.data) {
            useNotificationStore.getState().pushNotification(msg.data);
          }
          // Future: handle 'dashboard_update', 'typing', etc.
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
