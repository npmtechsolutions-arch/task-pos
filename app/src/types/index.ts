// User Types
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName?: string;
  avatarUrl?: string;
  isActive: boolean;
  timezone: string;
  language: string;
  role: 'owner' | 'admin' | 'manager' | 'member' | 'viewer';
  createdAt: string;
  lastLogin?: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// Organization Types
export interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  settings: OrganizationSettings;
  createdAt: string;
}

export interface OrganizationSettings {
  defaultTimezone: string;
  defaultLanguage: string;
  workingHours: WorkingHours;
  weekStartsOn: number;
}

export interface WorkingHours {
  start: string;
  end: string;
}

// Team Types
export interface Team {
  id: string;
  name: string;
  description?: string;
  members: TeamMember[];
  createdAt: string;
}

export interface TeamMember {
  id: string;
  user: User;
  role: 'lead' | 'member';
  joinedAt: string;
}

// Project Types
export type ProjectStatus = 'draft' | 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled' | 'archived';
export type ProjectVisibility = 'private' | 'internal' | 'public';
export type TemplateType = 'organization' | 'personal' | 'system';
export type PhaseStatus = 'planned' | 'active' | 'on_hold' | 'completed' | 'cancelled';
export type MilestoneStatus = 'pending' | 'in_progress' | 'at_risk' | 'completed' | 'missed';
export type MilestoneType = 'date_based' | 'duration_based' | 'conditional' | 'decision';
export type MilestoneRisk = 'low' | 'medium' | 'high' | 'critical';

export interface ProjectPhase {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  position: number;
  status: PhaseStatus;
  color: string;
  startDate?: string;
  endDate?: string;
  phaseBudget?: number;
  budgetSpent: number;
  progressPercentage: number;
  ownerId?: string;
}

export interface Milestone {
  id: string;
  projectId: string;
  phaseId?: string;
  name: string;
  description?: string;
  milestoneType: MilestoneType;
  status: MilestoneStatus;
  dueDate?: string;
  completionPercentage: number;
  riskIndicator: MilestoneRisk;
  requiresApproval: boolean;
  isApproved: boolean;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  key: string;
  status: ProjectStatus;
  visibility: ProjectVisibility;
  owner: User;
  members: ProjectMember[];
  settings: ProjectSettings;
  // Timeline
  startDate?: string;
  endDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  // Enterprise fields
  budget?: number;
  budgetSpent?: number;
  department?: string;
  businessUnit?: string;
  clientName?: string;
  objectives?: string[];
  keyResults?: string[];
  successCriteria?: string[];
  // Metrics
  progress: number;
  taskCount: number;
  completedTaskCount: number;
  // Relations
  phases?: ProjectPhase[];
  milestones?: Milestone[];
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMember {
  id: string;
  user: User;
  role: 'owner' | 'admin' | 'manager' | 'member' | 'viewer';
  joinedAt: string;
}

export interface ProjectSettings {
  defaultAssignee?: string;
  issueTypes: IssueType[];
  priorities: Priority[];
  statuses: Status[];
}

export interface IssueType {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface Priority {
  id: string;
  name: string;
  color: string;
  order: number;
}

export interface Status {
  id: string;
  name: string;
  color: string;
  order: number;
  category: 'todo' | 'in_progress' | 'done';
}

// Task Types
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';
export type TaskPriority = 'lowest' | 'low' | 'medium' | 'high' | 'highest';
export type TaskType = 'feature' | 'bug' | 'task' | 'epic';

export interface Task {
  id: string;
  taskNumber: number;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  project: Project;
  projectId: string;
  assignee?: User;
  assigneeId?: string;
  reporter: User;
  reporterId: string;
  parent?: Task;
  parentId?: string;
  subtasks: Task[];
  labels: Label[];
  dueDate?: string;
  startDate?: string;
  completedAt?: string;
  estimatedHours?: number;
  actualHours: number;
  attachments: Attachment[];
  comments: Comment[];
  dependencies: TaskDependency[];
  customFields: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface TaskDependency {
  id: string;
  taskId: string;
  dependsOnId: string;
  dependencyType: 'blocks' | 'blocked_by' | 'relates_to' | 'duplicates';
  createdAt?: string;
}

export interface Label {
  id: string;
  name: string;
  color: string;
}

export interface Attachment {
  id: string;
  filename: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: User;
  createdAt: string;
}

// Comment Types
export interface Comment {
  id: string;
  content: string;
  author: User;
  task: Task;
  taskId: string;
  parent?: Comment;
  parentId?: string;
  replies: Comment[];
  mentions: User[];
  reactions: Reaction[];
  createdAt: string;
  updatedAt: string;
}

export interface Reaction {
  id: string;
  emoji: string;
  user: User;
}

// Time Entry Types
export interface TimeEntry {
  id: string;
  task: Task;
  taskId: string;
  user: User;
  userId: string;
  project: Project;
  projectId: string;
  hours: number;
  description?: string;
  date: string;
  isBillable: boolean;
  isRunning: boolean;
  startedAt?: string;
  endedAt?: string;
  createdAt: string;
}

// Milestone Types (legacy - kept for compatibility)
export interface ProjectMilestone {
  id: string;
  title: string;
  description?: string;
  project: Project;
  projectId: string;
  dueDate?: string;
  status: 'open' | 'closed';
  tasks: Task[];
  progress: number;
  createdAt: string;
}


// Notification Types
export type NotificationType = 
  | 'task_assigned'
  | 'task_updated'
  | 'task_completed'
  | 'comment_mentioned'
  | 'comment_replied'
  | 'milestone_approaching'
  | 'project_invitation';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  data: Record<string, any>;
  user: User;
  userId: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

// Activity Types
export interface Activity {
  id: string;
  type: string;
  description: string;
  user: User;
  project?: Project;
  task?: Task;
  metadata: Record<string, any>;
  createdAt: string;
}

// Search Types
export interface SearchResult {
  type: 'task' | 'project' | 'user' | 'comment';
  item: Task | Project | User | Comment;
  score: number;
}

// Filter Types
export interface TaskFilters {
  projectId?: string;
  status?: TaskStatus | TaskStatus[];
  priority?: TaskPriority | TaskPriority[];
  assigneeId?: string;
  reporterId?: string;
  labelIds?: string[];
  dueDateFrom?: string;
  dueDateTo?: string;
  search?: string;
}

export interface ProjectFilters {
  status?: ProjectStatus;
  visibility?: ProjectVisibility;
  search?: string;
}

// Dashboard Types
export interface DashboardStats {
  totalProjects: number;
  activeProjects: number;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  totalHoursLogged: number;
  teamMembers: number;
}

export interface ProjectProgress {
  project: Project;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  progress: number;
}

// Calendar Types
export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  type: 'task' | 'milestone' | 'event';
  item: Task | Milestone | any;
  allDay: boolean;
}

// API Types
export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}

export interface ApiError {
  message: string;
  code: string;
  details?: Record<string, string[]>;
}
