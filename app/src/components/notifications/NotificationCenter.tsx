import { Link } from 'react-router-dom';
import { 
  Check, 
  Trash2, 
  UserCheck, 
  Edit, 
  CheckCircle, 
  AtSign, 
  MessageCircle, 
  Flag, 
  Mail,
  Bell
} from 'lucide-react';
import { cn, formatRelativeDate } from '@/lib/utils';
import { useNotificationStore, useUIStore } from '@/stores';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import type { Notification } from '@/types';

type NotificationType = Notification['type'];

const notificationIcons: Record<NotificationType, typeof UserCheck> = {
  task_assigned: UserCheck,
  task_updated: Edit,
  task_completed: CheckCircle,
  comment_mentioned: AtSign,
  comment_replied: MessageCircle,
  milestone_approaching: Flag,
  project_invitation: Mail,
};

const notificationColors: Record<NotificationType, string> = {
  task_assigned: 'bg-blue-100 text-blue-600',
  task_updated: 'bg-gray-100 text-gray-600',
  task_completed: 'bg-green-100 text-green-600',
  comment_mentioned: 'bg-purple-100 text-purple-600',
  comment_replied: 'bg-indigo-100 text-indigo-600',
  milestone_approaching: 'bg-yellow-100 text-yellow-600',
  project_invitation: 'bg-pink-100 text-pink-600',
};

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
}

function NotificationItem({ notification, onMarkAsRead, onDelete }: NotificationItemProps) {
  const Icon = notificationIcons[notification.type];
  
  const getNotificationLink = () => {
    const data = notification.data;
    if (data.taskId) return `/tasks/${data.taskId}`;
    if (data.projectId) return `/projects/${data.projectId}`;
    return '#';
  };

  return (
    <div
      className={cn(
        'group flex items-start gap-3 p-3 rounded-lg transition-colors',
        notification.isRead ? 'bg-white' : 'bg-blue-50/50'
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
          notificationColors[notification.type]
        )}
      >
        <Icon className="w-5 h-5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <Link
          to={getNotificationLink()}
          className="block hover:underline"
          onClick={() => !notification.isRead && onMarkAsRead(notification.id)}
        >
          <p className={cn(
            'text-sm',
            notification.isRead ? 'text-gray-700' : 'text-gray-900 font-medium'
          )}>
            {notification.title}
          </p>
          <p className="text-sm text-gray-500 mt-0.5">{notification.message}</p>
        </Link>
        <p className="text-xs text-gray-400 mt-1">
          {formatRelativeDate(notification.createdAt)}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {!notification.isRead && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onMarkAsRead(notification.id)}
            title="Mark as read"
          >
            <Check className="w-4 h-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-gray-400 hover:text-red-600"
          onClick={() => onDelete(notification.id)}
          title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

export function NotificationCenter() {
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead, 
    deleteNotification 
  } = useNotificationStore();
  const { addToast } = useUIStore();

  const handleMarkAsRead = (id: string) => {
    markAsRead(id);
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead();
    addToast({
      type: 'success',
      title: 'All notifications marked as read',
    });
  };

  const handleDelete = (id: string) => {
    deleteNotification(id);
  };

  const handleClearAll = () => {
    notifications.forEach((n) => deleteNotification(n.id));
    addToast({
      type: 'success',
      title: 'All notifications cleared',
    });
  };

  return (
    <div className="flex flex-col h-[600px]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold">Notifications</h2>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
              {unreadCount} new
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllAsRead}
            >
              <Check className="w-4 h-4 mr-1" />
              Mark all read
            </Button>
          )}
          {notifications.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={handleClearAll}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Clear all
            </Button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <ScrollArea className="flex-1">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <Bell className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500 font-medium">No notifications</p>
            <p className="text-sm text-gray-400 mt-1">
              You&apos;re all caught up!
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {/* Unread notifications */}
            {notifications.filter(n => !n.isRead).length > 0 && (
              <>
                <p className="text-xs font-medium text-gray-500 uppercase px-3 py-2">
                  New
                </p>
                {notifications
                  .filter(n => !n.isRead)
                  .map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onMarkAsRead={handleMarkAsRead}
                      onDelete={handleDelete}
                    />
                  ))}
                <Separator className="my-2" />
              </>
            )}

            {/* Read notifications */}
            {notifications.filter(n => n.isRead).length > 0 && (
              <>
                <p className="text-xs font-medium text-gray-500 uppercase px-3 py-2">
                  Earlier
                </p>
                {notifications
                  .filter(n => n.isRead)
                  .map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onMarkAsRead={handleMarkAsRead}
                      onDelete={handleDelete}
                    />
                  ))}
              </>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      <div className="p-3 border-t bg-gray-50">
        <Button variant="ghost" className="w-full text-blue-600 hover:text-blue-700">
          View all notifications
        </Button>
      </div>
    </div>
  );
}
