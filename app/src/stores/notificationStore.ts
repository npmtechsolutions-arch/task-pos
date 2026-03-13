import { create } from 'zustand';
import type { Notification, User } from '@/types';

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  
  // Actions
  setNotifications: (notifications: Notification[]) => void;
  addNotification: (notification: Notification) => void;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  deleteNotification: (notificationId: string) => void;
  setLoading: (loading: boolean) => void;
}

// Mock users for notifications
const mockUsers: User[] = [
  {
    id: '2',
    email: 'john@projectflow.com',
    firstName: 'John',
    lastName: 'Doe',
    fullName: 'John Doe',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=john',
    isActive: true,
    timezone: 'UTC',
    language: 'en',
    role: 'member',
    createdAt: new Date().toISOString(),
  },
  {
    id: '3',
    email: 'jane@projectflow.com',
    firstName: 'Jane',
    lastName: 'Smith',
    fullName: 'Jane Smith',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=jane',
    isActive: true,
    timezone: 'UTC',
    language: 'en',
    role: 'manager',
    createdAt: new Date().toISOString(),
  },
];

// Mock notifications
const mockNotifications: Notification[] = [
  {
    id: 'n1',
    type: 'task_assigned',
    title: 'Task assigned to you',
    message: 'John Doe assigned you "Implement responsive navigation"',
    data: {
      taskId: 't2',
      taskTitle: 'Implement responsive navigation',
      projectId: '1',
      projectName: 'Website Redesign',
    },
    user: mockUsers[0],
    userId: '1',
    isRead: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 mins ago
  },
  {
    id: 'n2',
    type: 'comment_mentioned',
    title: 'You were mentioned',
    message: 'Jane Smith mentioned you in a comment on "Design homepage mockups"',
    data: {
      taskId: 't1',
      taskTitle: 'Design homepage mockups',
      commentId: 'c1',
    },
    user: mockUsers[1],
    userId: '1',
    isRead: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
  },
  {
    id: 'n3',
    type: 'task_completed',
    title: 'Task completed',
    message: 'Bob Wilson completed "Set up React Native project"',
    data: {
      taskId: 't6',
      taskTitle: 'Set up React Native project',
      projectId: '2',
      projectName: 'Mobile App Development',
    },
    user: mockUsers[0],
    userId: '1',
    isRead: true,
    readAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(), // 4 hours ago
  },
  {
    id: 'n4',
    type: 'milestone_approaching',
    title: 'Milestone approaching',
    message: 'Website launch milestone is due in 3 days',
    data: {
      milestoneId: 'm1',
      milestoneTitle: 'Website Launch',
      projectId: '1',
      projectName: 'Website Redesign',
      dueDate: '2025-03-30T00:00:00Z',
    },
    user: mockUsers[0],
    userId: '1',
    isRead: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(), // 6 hours ago
  },
  {
    id: 'n5',
    type: 'project_invitation',
    title: 'Project invitation',
    message: 'You have been invited to join "Marketing Campaign Q2"',
    data: {
      projectId: '5',
      projectName: 'Marketing Campaign Q2',
      invitedBy: 'Jane Smith',
    },
    user: mockUsers[1],
    userId: '1',
    isRead: true,
    readAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
  },
];

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: mockNotifications,
  unreadCount: mockNotifications.filter((n) => !n.isRead).length,
  isLoading: false,

  setNotifications: (notifications) => {
    set({
      notifications,
      unreadCount: notifications.filter((n) => !n.isRead).length,
    });
  },

  addNotification: (notification) => {
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + (notification.isRead ? 0 : 1),
    }));
  },

  markAsRead: (notificationId) => {
    set((state) => {
      const notification = state.notifications.find((n) => n.id === notificationId);
      if (!notification || notification.isRead) return state;

      return {
        notifications: state.notifications.map((n) =>
          n.id === notificationId
            ? { ...n, isRead: true, readAt: new Date().toISOString() }
            : n
        ),
        unreadCount: state.unreadCount - 1,
      };
    });
  },

  markAllAsRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.isRead
          ? n
          : { ...n, isRead: true, readAt: new Date().toISOString() }
      ),
      unreadCount: 0,
    }));
  },

  deleteNotification: (notificationId) => {
    set((state) => {
      const notification = state.notifications.find((n) => n.id === notificationId);
      return {
        notifications: state.notifications.filter((n) => n.id !== notificationId),
        unreadCount: notification && !notification.isRead
          ? state.unreadCount - 1
          : state.unreadCount,
      };
    });
  },

  setLoading: (loading) => set({ isLoading: loading }),
}));
