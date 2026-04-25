/**
 * useTicketWebSocket
 * Attaches to the existing /ws/{user_id} endpoint and joins a ticket room.
 * Provides real-time new_message and ticket_update events.
 */

import { useEffect, useRef, useCallback } from 'react';

const WS_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1')
  .replace(/^http/, 'ws')       // http → ws, https → wss
  .replace('/api/v1', '');       // strip path prefix

interface TicketWSMessage {
  type: 'new_message' | 'ticket_update' | 'pong' | 'joined';
  ticket_id?: string;
  message?: {
    id: string;
    sender_id: string;
    sender_name: string;
    message: string;
    timestamp: string;
    is_admin: boolean;
  };
  new_status?: string;
  ticket_ref?: string;
}

interface UseTicketWebSocketOptions {
  userId: string | undefined;
  token: string | undefined;
  ticketId: string | undefined;
  onNewMessage?: (msg: NonNullable<TicketWSMessage['message']>) => void;
  onTicketUpdate?: (status: string, ticketRef: string) => void;
}

export function useTicketWebSocket({
  userId,
  token,
  ticketId,
  onNewMessage,
  onTicketUpdate,
}: UseTicketWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (!userId || !token || !ticketId) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const url = `${WS_BASE}/ws/${userId}?token=${token}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      // Join the ticket room so the backend routes messages here
      ws.send(JSON.stringify({ type: 'join', room: `ticket:${ticketId}` }));

      // Keep-alive ping every 25 s
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
      }, 25_000);
    };

    ws.onmessage = (event) => {
      try {
        const data: TicketWSMessage = JSON.parse(event.data);
        if (data.type === 'new_message' && data.message && data.ticket_id === ticketId) {
          onNewMessage?.(data.message);
        }
        if (data.type === 'ticket_update' && data.ticket_id === ticketId) {
          onTicketUpdate?.(data.new_status ?? '', data.ticket_ref ?? '');
        }
      } catch {
        // ignore malformed frames
      }
    };

    ws.onclose = () => {
      if (pingRef.current) clearInterval(pingRef.current);
      // Auto-reconnect after 3 s
      reconnectRef.current = setTimeout(connect, 3_000);
    };

    ws.onerror = () => ws.close();
  }, [userId, token, ticketId, onNewMessage, onTicketUpdate]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      if (pingRef.current) clearInterval(pingRef.current);
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
    };
  }, [connect]);
}
