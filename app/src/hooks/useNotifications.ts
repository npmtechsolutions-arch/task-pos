/**
 * useNotifications.ts
 *
 * Replaces the manual setInterval polling with React Query:
 * - Unread count: refetches every 60s (or instantly via WS push)
 * - Notification list: fetched once when bell is opened, cached 2 min
 * - Mark-as-read: optimistic update + invalidate
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

function authHeaders() {
  const token = localStorage.getItem('token') || localStorage.getItem('access_token') || '';
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  notification_type: string;
  is_read: boolean;
  action_url?: string;
  created_at: string;
}

// ── Unread count (polled every 60 s, invalidated by WS push) ────────────────
export function useUnreadCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async (): Promise<number> => {
      const res = await axios.get(`${API}/notifications/unread-count`, {
        headers: authHeaders(),
      });
      return res.data.unread_count ?? 0;
    },
    staleTime: 60_000,       // consider fresh for 60 s
    refetchInterval: 60_000, // background refetch every 60 s
    refetchOnWindowFocus: true,
  });
}

// ── Notification list (loaded on demand when bell opens) ────────────────────
export function useNotificationList(enabled = false, page = 1) {
  return useQuery({
    queryKey: ['notifications', 'list', page],
    queryFn: async (): Promise<{ items: NotificationItem[]; total: number; unread_count: number }> => {
      const res = await axios.get(`${API}/notifications`, {
        headers: authHeaders(),
        params: { page, per_page: 20 },
      });
      return res.data;
    },
    enabled,
    staleTime: 2 * 60_000, // cache 2 min
    placeholderData: (prev) => prev,
  });
}

// ── Mark as read (optimistic) ────────────────────────────────────────────────
export function useMarkAsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids?: string[]) => {
      await axios.put(
        `${API}/notifications/read`,
        { notification_ids: ids ?? null },
        { headers: authHeaders() }
      );
    },
    onMutate: async (ids) => {
      // Optimistically set is_read = true in the cached list
      await qc.cancelQueries({ queryKey: ['notifications'] });
      qc.setQueriesData({ queryKey: ['notifications', 'list'] }, (old: any) => {
        if (!old?.items) return old;
        return {
          ...old,
          items: old.items.map((n: NotificationItem) =>
            !ids || ids.includes(n.id) ? { ...n, is_read: true } : n
          ),
          unread_count: ids
            ? Math.max(0, (old.unread_count ?? 0) - ids.length)
            : 0,
        };
      });
      qc.setQueryData(['notifications', 'unread-count'], ids ? (prev: number) => Math.max(0, (prev ?? 0) - ids.length) : 0);
    },
    onSettled: () => {
      // Always re-sync after mutation
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

/**
 * Call this from useWebSocket when a `notification` event arrives — 
 * instantly bumps the cached count without a network round-trip.
 */
export function invalidateNotificationCount(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
}
