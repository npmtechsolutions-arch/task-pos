import { Link } from 'react-router-dom';
import { 
  CheckSquare, 
  MessageSquare, 
  UserPlus, 
  FolderPlus, 
  Clock,
  MoreHorizontal
} from 'lucide-react';
import { formatRelativeDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import type { Activity } from '@/types';

// Mock activities
const mockActivities: Activity[] = [
  {
    id: '1',
    type: 'task_completed',
    description: 'completed the task',
    user: {
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
    task: {
      id: 't1',
      title: 'Design homepage mockups',
    } as any,
    metadata: {},
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: '2',
    type: 'comment_added',
    description: 'commented on',
    user: {
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
    task: {
      id: 't2',
      title: 'Implement responsive navigation',
    } as any,
    metadata: {
      comment: 'Looking great! Just a few minor adjustments needed.',
    },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: '3',
    type: 'task_created',
    description: 'created a new task',
    user: {
      id: '1',
      email: 'admin@projectflow.com',
      firstName: 'Admin',
      lastName: 'User',
      fullName: 'Admin User',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin',
      isActive: true,
      timezone: 'UTC',
      language: 'en',
      role: 'owner',
      createdAt: new Date().toISOString(),
    },
    task: {
      id: 't3',
      title: 'Set up CMS integration',
    } as any,
    metadata: {},
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
  },
  {
    id: '4',
    type: 'member_joined',
    description: 'joined the project',
    user: {
      id: '4',
      email: 'bob@projectflow.com',
      firstName: 'Bob',
      lastName: 'Wilson',
      fullName: 'Bob Wilson',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=bob',
      isActive: true,
      timezone: 'UTC',
      language: 'en',
      role: 'member',
      createdAt: new Date().toISOString(),
    },
    project: {
      id: '1',
      name: 'Website Redesign',
    } as any,
    metadata: {},
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
  },
  {
    id: '5',
    type: 'time_logged',
    description: 'logged 4 hours on',
    user: {
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
    task: {
      id: 't2',
      title: 'Implement responsive navigation',
    } as any,
    metadata: {
      hours: 4,
    },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
  },
];

const activityIcons: Record<string, typeof CheckSquare> = {
  task_completed: CheckSquare,
  comment_added: MessageSquare,
  task_created: FolderPlus,
  member_joined: UserPlus,
  time_logged: Clock,
};

interface ActivityFeedProps {
  limit?: number;
}

export function ActivityFeed({ limit = 5 }: ActivityFeedProps) {
  const activities = mockActivities.slice(0, limit);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-semibold">Recent Activity</CardTitle>
        <Button variant="ghost" size="icon">
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity) => {
            const Icon = activityIcons[activity.type] || CheckSquare;
            
            return (
              <div key={activity.id} className="flex items-start gap-3">
                <Avatar className="w-8 h-8 flex-shrink-0">
                  <AvatarImage src={activity.user.avatarUrl} />
                  <AvatarFallback className="bg-blue-600 text-white text-xs">
                    {activity.user.firstName[0]}{activity.user.lastName[0]}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">
                    <span className="font-medium">
                      {activity.user.firstName} {activity.user.lastName}
                    </span>{' '}
                    <span className="text-gray-600">{activity.description}</span>{' '}
                    {activity.task && (
                      <Link
                        to={`/tasks/${activity.task.id}`}
                        className="font-medium text-blue-600 hover:text-blue-700"
                      >
                        {activity.task.title}
                      </Link>
                    )}
                    {activity.project && (
                      <Link
                        to={`/projects/${activity.project.id}`}
                        className="font-medium text-blue-600 hover:text-blue-700"
                      >
                        {activity.project.name}
                      </Link>
                    )}
                  </p>
                  
                  {activity.metadata?.comment && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                      &ldquo;{activity.metadata.comment}&rdquo;
                    </p>
                  )}
                  
                  <p className="text-xs text-gray-400 mt-1">
                    {formatRelativeDate(activity.createdAt)}
                  </p>
                </div>
                
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-gray-500" />
                </div>
              </div>
            );
          })}
        </div>
        
        <Button variant="ghost" className="w-full mt-4 text-blue-600 hover:text-blue-700">
          View all activity
        </Button>
      </CardContent>
    </Card>
  );
}
