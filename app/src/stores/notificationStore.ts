import { create } from 'zustand';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export interface AppNotification {
  id: string;
  notification_type: string;
  title: string;
  message: string;
  task_id?: string;
  project_id?: string;
  comment_id?: string;
  action_url?: string;
  is_read: boolean;
  read_at?: string;
  created_at: string;
}

interface NotificationState {
  notifications: AppNotification[];
  unreadCount: number;
  isLoading: boolean;
  hasMore: boolean;
  page: number;
  // Actions
  fetchNotifications: (token: string, reset?: boolean) => Promise<void>;
  markRead: (token: string, ids: string[]) => Promise<void>;
  markAllRead: (token: string) => Promise<void>;
  deleteNotification: (token: string, id: string) => Promise<void>;
  pushNotification: (notif: AppNotification) => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  hasMore: true,
  page: 1,

  fetchNotifications: async (token: string, reset = false) => {
    const { isLoading, hasMore, page } = get();
    if (isLoading || (!hasMore && !reset)) return;
    const nextPage = reset ? 1 : page;
    set({ isLoading: true });
    try {
      const res = await axios.get(`${API_URL}/notifications`, {
        params: { page: nextPage, per_page: 20 },
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = res.data;
      const items: AppNotification[] = data.items || [];
      set((state) => ({
        notifications: reset ? items : [...state.notifications, ...items],
        unreadCount: data.unread_count ?? 0,
        page: nextPage + 1,
        hasMore: items.length === 20,
        isLoading: false,
      }));
    } catch {
      set({ isLoading: false });
    }
  },

  markRead: async (token: string, ids: string[]) => {
    try {
      await axios.put(
        `${API_URL}/notifications/read`,
        { notification_ids: ids },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      set((state) => {
        const unreadRemoved = ids.filter((id) => {
          const n = state.notifications.find((x) => x.id === id);
          return n && !n.is_read;
        }).length;
        return {
          notifications: state.notifications.map((n) =>
            ids.includes(n.id) ? { ...n, is_read: true } : n
          ),
          unreadCount: Math.max(0, state.unreadCount - unreadRemoved),
        };
      });
    } catch {}
  },

  markAllRead: async (token: string) => {
    try {
      await axios.put(
        `${API_URL}/notifications/read-all`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, is_read: true })),
        unreadCount: 0,
      }));
    } catch {}
  },

  deleteNotification: async (token: string, id: string) => {
    try {
      await axios.delete(`${API_URL}/notifications/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id),
        unreadCount: state.notifications.find((n) => n.id === id && !n.is_read)
          ? Math.max(0, state.unreadCount - 1)
          : state.unreadCount,
      }));
    } catch {}
  },

  pushNotification: (notif: AppNotification) => {
    set((state) => ({
      notifications: [notif, ...state.notifications],
      unreadCount: state.unreadCount + 1,
    }));
  },
}));
