// App constants
export const APP_NAME = 'ProjectFlow';
export const APP_VERSION = '1.0.0';

// API constants
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
export const API_TIMEOUT = 30000;

// Pagination
export const DEFAULT_PAGE_SIZE = 20;
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

// Task priorities
export const TASK_PRIORITIES = [
  { value: 'lowest', label: 'Lowest', color: '#6B7280' },
  { value: 'low', label: 'Low', color: '#3B82F6' },
  { value: 'medium', label: 'Medium', color: '#F59E0B' },
  { value: 'high', label: 'High', color: '#EF4444' },
  { value: 'highest', label: 'Highest', color: '#DC2626' },
] as const;

// Task statuses
export const TASK_STATUSES = [
  { value: 'todo', label: 'To Do', color: '#6B7280', category: 'todo' },
  { value: 'in_progress', label: 'In Progress', color: '#3B82F6', category: 'in_progress' },
  { value: 'review', label: 'Review', color: '#8B5CF6', category: 'in_progress' },
  { value: 'done', label: 'Done', color: '#10B981', category: 'done' },
] as const;

// Project statuses
export const PROJECT_STATUSES = [
  { value: 'draft', label: 'Draft', color: '#6B7280' },
  { value: 'planning', label: 'Planning', color: '#3B82F6' },
  { value: 'active', label: 'Active', color: '#10B981' },
  { value: 'on_hold', label: 'On Hold', color: '#F59E0B' },
  { value: 'completed', label: 'Completed', color: '#6366F1' },
  { value: 'cancelled', label: 'Cancelled', color: '#EF4444' },
  { value: 'archived', label: 'Archived', color: '#475569' },
] as const;

// Project visibilities
export const PROJECT_VISIBILITIES = [
  { value: 'private', label: 'Private', description: 'Only project members can access' },
  { value: 'internal', label: 'Internal', description: 'All organization members can access' },
  { value: 'public', label: 'Public', description: 'Anyone can access' },
] as const;

// User roles
export const USER_ROLES = [
  { value: 'owner', label: 'Owner', description: 'Full control of the organization' },
  { value: 'admin', label: 'Admin', description: 'Can manage most settings and users' },
  { value: 'manager', label: 'Manager', description: 'Can manage projects and teams' },
  { value: 'member', label: 'Member', description: 'Can work on assigned tasks' },
  { value: 'viewer', label: 'Viewer', description: 'Can only view content' },
] as const;

// Team roles
export const TEAM_ROLES = [
  { value: 'lead', label: 'Team Lead' },
  { value: 'member', label: 'Member' },
] as const;

// Notification types
export const NOTIFICATION_TYPES = [
  { value: 'task_assigned', label: 'Task Assigned', icon: 'UserCheck' },
  { value: 'task_updated', label: 'Task Updated', icon: 'Edit' },
  { value: 'task_completed', label: 'Task Completed', icon: 'CheckCircle' },
  { value: 'comment_mentioned', label: 'Mentioned in Comment', icon: 'AtSign' },
  { value: 'comment_replied', label: 'Comment Replied', icon: 'MessageCircle' },
  { value: 'milestone_approaching', label: 'Milestone Approaching', icon: 'Flag' },
  { value: 'project_invitation', label: 'Project Invitation', icon: 'Mail' },
] as const;

// Time tracking
export const TIME_ENTRY_CATEGORIES = [
  { value: 'development', label: 'Development' },
  { value: 'design', label: 'Design' },
  { value: 'testing', label: 'Testing' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'research', label: 'Research' },
  { value: 'documentation', label: 'Documentation' },
  { value: 'other', label: 'Other' },
] as const;

// File upload
export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
export const ALLOWED_FILE_TYPES = [
  'image/*',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'application/json',
  'application/zip',
];

// Date formats
export const DATE_FORMATS = {
  short: 'MMM d',
  medium: 'MMM d, yyyy',
  long: 'MMMM d, yyyy',
  full: 'EEEE, MMMM d, yyyy',
  time: 'h:mm a',
  datetime: 'MMM d, yyyy h:mm a',
  iso: 'yyyy-MM-dd',
} as const;

// Sidebar navigation
export const SIDEBAR_NAVIGATION = [
  { name: 'Dashboard', href: '/', icon: 'LayoutDashboard' },
  { name: 'Projects', href: '/projects', icon: 'FolderKanban' },
  { name: 'My Tasks', href: '/tasks', icon: 'CheckSquare' },
  { name: 'Team', href: '/team', icon: 'Users' },
  { name: 'Calendar', href: '/calendar', icon: 'Calendar' },
  { name: 'Reports', href: '/reports', icon: 'BarChart3' },
] as const;

// Settings navigation
export const SETTINGS_NAVIGATION = [
  { name: 'Profile', href: '/settings/profile', icon: 'User' },
  { name: 'Organization', href: '/settings/organization', icon: 'Building2' },
  { name: 'Notifications', href: '/settings/notifications', icon: 'Bell' },
  { name: 'Integrations', href: '/settings/integrations', icon: 'Plug' },
] as const;

// Theme options
export const THEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: 'Sun' },
  { value: 'dark', label: 'Dark', icon: 'Moon' },
  { value: 'system', label: 'System', icon: 'Monitor' },
] as const;

// Keyboard shortcuts
export const KEYBOARD_SHORTCUTS = [
  { key: 'g', modifier: 'cmd', action: 'Global search' },
  { key: 'n', modifier: 'cmd', action: 'New task' },
  { key: 'p', modifier: 'cmd', action: 'New project' },
  { key: '/', modifier: '', action: 'Focus search' },
  { key: 'esc', modifier: '', action: 'Close modal/exit' },
  { key: '?', modifier: 'shift', action: 'Show shortcuts' },
] as const;

// Chart colors
export const CHART_COLORS = {
  primary: '#3B82F6',
  secondary: '#8B5CF6',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#06B6D4',
  gray: '#6B7280',
} as const;

// Status colors for charts
export const STATUS_COLORS = {
  todo: '#6B7280',
  in_progress: '#3B82F6',
  review: '#8B5CF6',
  done: '#10B981',
} as const;

// Priority colors for charts
export const PRIORITY_COLORS = {
  lowest: '#9CA3AF',
  low: '#60A5FA',
  medium: '#FBBF24',
  high: '#F87171',
  highest: '#DC2626',
} as const;

// Error messages
export const ERROR_MESSAGES = {
  generic: 'Something went wrong. Please try again.',
  network: 'Network error. Please check your connection.',
  unauthorized: 'You are not authorized to perform this action.',
  notFound: 'The requested resource was not found.',
  validation: 'Please check your input and try again.',
  server: 'Server error. Please try again later.',
} as const;

// Success messages
export const SUCCESS_MESSAGES = {
  created: 'Successfully created.',
  updated: 'Successfully updated.',
  deleted: 'Successfully deleted.',
  saved: 'Successfully saved.',
  sent: 'Successfully sent.',
  copied: 'Copied to clipboard.',
} as const;
