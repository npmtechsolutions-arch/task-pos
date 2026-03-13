# Technical Architecture Document
## Project Management & Communication Platform
### Version: 1.0
### Stack: React + FastAPI + PostgreSQL

---

## 1. Architecture Overview

### 1.1 System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         React Frontend                               │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │   │
│  │  │  Dashboard  │  │   Kanban    │  │   Tasks     │  │   Team     │ │   │
│  │  │    Module   │  │   Board     │  │   Module    │  │  Module    │ │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘ │   │
│  │                                                                     │   │
│  │  State: Zustand + React Query    UI: Tailwind + shadcn/ui         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ HTTPS / WebSocket
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API LAYER                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        FastAPI Backend                               │   │
│  │                                                                      │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │   │
│  │  │   Auth      │  │  Project    │  │    Task     │  │   Team     │  │   │
│  │  │   Router    │  │   Router    │  │   Router    │  │   Router   │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘  │   │
│  │                                                                      │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │   │
│  │  │   Time      │  │    File     │  │  Calendar   │  │  Search    │  │   │
│  │  │   Router    │  │   Router    │  │   Router    │  │   Router   │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘  │   │
│  │                                                                      │   │
│  │  Middleware: JWT Auth, Rate Limiting, CORS, Request Validation      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ SQL / Async
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA LAYER                                         │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐  │
│  │     PostgreSQL      │  │       Redis         │  │   Elasticsearch     │  │
│  │   (Primary DB)      │  │    (Cache/Queue)    │  │     (Search)        │  │
│  │                     │  │                     │  │                     │  │
│  │  - Users            │  │  - Session Store    │  │  - Full-text        │  │
│  │  - Projects         │  │  - Rate Limiting    │  │  - Faceted          │  │
│  │  - Tasks            │  │  - Job Queue        │  │  - Aggregations     │  │
│  │  - Comments         │  │  - Real-time Pub/Sub│  │                     │  │
│  │  - Time Entries     │  │                     │  │                     │  │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ Async Processing
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        BACKGROUND SERVICES                                   │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐  │
│  │    Celery Workers   │  │   WebSocket Server  │  │   Notification      │  │
│  │                     │  │                     │  │      Service        │  │
│  │  - Email Sending    │  │  - Real-time        │  │  - Push             │  │
│  │  - Report Generation│  │    Updates          │  │  - Email            │  │
│  │  - Data Import/Export│  │  - Presence         │  │  - In-app           │  │
│  │  - Scheduled Tasks  │  │  - Typing Indicators│  │                     │  │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Technology Stack Summary

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | React 18 + TypeScript | UI Framework |
| **Styling** | Tailwind CSS 3.4 | Utility-first CSS |
| **Components** | shadcn/ui | Component library |
| **State Management** | Zustand | Global state |
| **Server State** | TanStack Query | API caching |
| **Routing** | React Router v6 | Navigation |
| **Forms** | React Hook Form + Zod | Form handling |
| **Backend** | FastAPI (Python 3.11+) | API Framework |
| **ORM** | SQLAlchemy 2.0 | Database abstraction |
| **Migrations** | Alembic | Schema migrations |
| **Database** | PostgreSQL 15+ | Primary database |
| **Cache** | Redis 7+ | Caching & sessions |
| **Search** | Elasticsearch 8+ | Full-text search |
| **Queue** | Celery + Redis | Background tasks |
| **WebSocket** | Socket.io | Real-time communication |
| **Auth** | JWT + bcrypt | Authentication |

---

## 2. Frontend Architecture

### 2.1 Project Structure

```
frontend/
├── public/
│   ├── favicon.ico
│   ├── logo.svg
│   └── manifest.json
├── src/
│   ├── api/                    # API client and endpoints
│   │   ├── client.ts           # Axios/Fetch configuration
│   │   ├── auth.ts             # Auth API calls
│   │   ├── projects.ts         # Project API calls
│   │   ├── tasks.ts            # Task API calls
│   │   ├── teams.ts            # Team API calls
│   │   ├── comments.ts         # Comment API calls
│   │   ├── timeTracking.ts     # Time tracking API calls
│   │   ├── files.ts            # File API calls
│   │   ├── calendar.ts         # Calendar API calls
│   │   ├── search.ts           # Search API calls
│   │   └── notifications.ts    # Notification API calls
│   │
│   ├── components/             # React components
│   │   ├── ui/                 # shadcn/ui components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── input.tsx
│   │   │   ├── select.tsx
│   │   │   ├── table.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── toast.tsx
│   │   │   └── ...
│   │   │
│   │   ├── layout/             # Layout components
│   │   │   ├── AppLayout.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── Breadcrumb.tsx
│   │   │   └── Footer.tsx
│   │   │
│   │   ├── common/             # Shared components
│   │   │   ├── Avatar.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   ├── LoadingSpinner.tsx
│   │   │   ├── Pagination.tsx
│   │   │   ├── SearchInput.tsx
│   │   │   └── UserMenu.tsx
│   │   │
│   │   ├── kanban/             # Kanban-specific components
│   │   │   ├── KanbanBoard.tsx
│   │   │   ├── KanbanColumn.tsx
│   │   │   ├── KanbanCard.tsx
│   │   │   ├── KanbanDragOverlay.tsx
│   │   │   └── KanbanFilters.tsx
│   │   │
│   │   ├── tasks/              # Task-specific components
│   │   │   ├── TaskCard.tsx
│   │   │   ├── TaskList.tsx
│   │   │   ├── TaskForm.tsx
│   │   │   ├── TaskDetail.tsx
│   │   │   ├── TaskComments.tsx
│   │   │   ├── TaskActivity.tsx
│   │   │   └── TaskFilters.tsx
│   │   │
│   │   ├── projects/           # Project-specific components
│   │   │   ├── ProjectCard.tsx
│   │   │   ├── ProjectList.tsx
│   │   │   ├── ProjectForm.tsx
│   │   │   ├── ProjectHeader.tsx
│   │   │   └── ProjectStats.tsx
│   │   │
│   │   ├── dashboard/          # Dashboard components
│   │   │   ├── StatCard.tsx
│   │   │   ├── ActivityFeed.tsx
│   │   │   ├── MyTasksWidget.tsx
│   │   │   ├── TeamWidget.tsx
│   │   │   └── ProjectChart.tsx
│   │   │
│   │   └── notifications/      # Notification components
│   │       ├── NotificationCenter.tsx
│   │       ├── NotificationItem.tsx
│   │       └── NotificationBadge.tsx
│   │
│   ├── hooks/                  # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── useProjects.ts
│   │   ├── useTasks.ts
│   │   ├── useTeams.ts
│   │   ├── useComments.ts
│   │   ├── useTimeTracking.ts
│   │   ├── useSearch.ts
│   │   ├── useNotifications.ts
│   │   ├── useDebounce.ts
│   │   ├── useLocalStorage.ts
│   │   └── useWebSocket.ts
│   │
│   ├── stores/                 # Zustand stores
│   │   ├── authStore.ts
│   │   ├── uiStore.ts
│   │   ├── projectStore.ts
│   │   ├── taskStore.ts
│   │   └── notificationStore.ts
│   │
│   ├── types/                  # TypeScript types
│   │   ├── auth.ts
│   │   ├── user.ts
│   │   ├── project.ts
│   │   ├── task.ts
│   │   ├── team.ts
│   │   ├── comment.ts
│   │   ├── timeEntry.ts
│   │   ├── notification.ts
│   │   ├── api.ts
│   │   └── index.ts
│   │
│   ├── lib/                    # Utility libraries
│   │   ├── utils.ts            # General utilities
│   │   ├── constants.ts        # App constants
│   │   ├── formatters.ts       # Date, number formatters
│   │   ├── validators.ts       # Validation schemas
│   │   └── permissions.ts      # Permission checks
│   │
│   ├── context/                # React contexts
│   │   ├── AuthContext.tsx
│   │   ├── ThemeContext.tsx
│   │   └── SocketContext.tsx
│   │
│   ├── pages/                  # Page components
│   │   ├── auth/
│   │   │   ├── Login.tsx
│   │   │   ├── Register.tsx
│   │   │   ├── ForgotPassword.tsx
│   │   │   └── ResetPassword.tsx
│   │   │
│   │   ├── dashboard/
│   │   │   └── Dashboard.tsx
│   │   │
│   │   ├── projects/
│   │   │   ├── ProjectsList.tsx
│   │   │   ├── ProjectDetail.tsx
│   │   │   └── ProjectSettings.tsx
│   │   │
│   │   ├── tasks/
│   │   │   ├── TasksList.tsx
│   │   │   ├── TaskBoard.tsx
│   │   │   ├── TaskCalendar.tsx
│   │   │   └── TaskDetailPage.tsx
│   │   │
│   │   ├── team/
│   │   │   ├── TeamList.tsx
│   │   │   ├── MemberProfile.tsx
│   │   │   └── Workload.tsx
│   │   │
│   │   ├── calendar/
│   │   │   └── Calendar.tsx
│   │   │
│   │   ├── reports/
│   │   │   ├── Reports.tsx
│   │   │   └── CustomReport.tsx
│   │   │
│   │   ├── settings/
│   │   │   ├── ProfileSettings.tsx
│   │   │   ├── OrganizationSettings.tsx
│   │   │   └── NotificationSettings.tsx
│   │   │
│   │   └── errors/
│   │       ├── NotFound.tsx
│   │       └── ServerError.tsx
│   │
│   ├── routes/                 # Route configuration
│   │   ├── AppRoutes.tsx
│   │   ├── ProtectedRoute.tsx
│   │   └── routePaths.ts
│   │
│   ├── styles/                 # Global styles
│   │   ├── globals.css
│   │   └── animations.css
│   │
│   ├── App.tsx
│   ├── main.tsx
│   └── vite-env.d.ts
│
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── eslint.config.js
```

### 2.2 State Management Architecture

#### Zustand Store Pattern
```typescript
// stores/authStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, AuthState } from '@/types';

interface AuthStore extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      
      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authApi.login(email, password);
          set({ 
            user: response.user, 
            isAuthenticated: true, 
            isLoading: false 
          });
        } catch (error) {
          set({ 
            error: error.message, 
            isLoading: false 
          });
        }
      },
      
      logout: () => {
        authApi.logout();
        set({ 
          user: null, 
          isAuthenticated: false 
        });
      },
      
      // ... other actions
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);
```

#### TanStack Query Pattern
```typescript
// hooks/useTasks.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi } from '@/api/tasks';
import { Task, CreateTaskInput, UpdateTaskInput } from '@/types';

const TASKS_KEY = 'tasks';

export const useTasks = (filters?: TaskFilters) => {
  return useQuery({
    queryKey: [TASKS_KEY, filters],
    queryFn: () => tasksApi.getTasks(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useTask = (taskId: string) => {
  return useQuery({
    queryKey: [TASKS_KEY, taskId],
    queryFn: () => tasksApi.getTask(taskId),
    enabled: !!taskId,
  });
};

export const useCreateTask = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreateTaskInput) => tasksApi.createTask(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASKS_KEY] });
    },
  });
};

export const useUpdateTask = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTaskInput }) => 
      tasksApi.updateTask(id, data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: [TASKS_KEY, variables.id] });
      queryClient.invalidateQueries({ queryKey: [TASKS_KEY] });
    },
  });
};
```

### 2.3 Component Architecture

#### Compound Component Pattern
```typescript
// components/kanban/KanbanBoard.tsx
import { createContext, useContext, useState } from 'react';
import { DndContext, DragOverlay } from '@dnd-kit/core';

interface KanbanContextValue {
  activeId: string | null;
  setActiveId: (id: string | null) => void;
}

const KanbanContext = createContext<KanbanContextValue | null>(null);

export const KanbanBoard = ({ children, onDragEnd }: KanbanBoardProps) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  
  return (
    <KanbanContext.Provider value={{ activeId, setActiveId }}>
      <DndContext onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto">
          {children}
        </div>
        <DragOverlay>
          {activeId ? <KanbanDragOverlay id={activeId} /> : null}
        </DragOverlay>
      </DndContext>
    </KanbanContext.Provider>
  );
};

export const KanbanColumn = ({ id, title, children }: KanbanColumnProps) => {
  const { setNodeRef } = useDroppable({ id });
  
  return (
    <div ref={setNodeRef} className="w-80 flex-shrink-0">
      <div className="bg-gray-100 rounded-lg p-3">
        <h3 className="font-semibold mb-3">{title}</h3>
        <div className="space-y-2">{children}</div>
      </div>
    </div>
  );
};

export const KanbanCard = ({ task }: KanbanCardProps) => {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: task.id,
  });
  
  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;
  
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="bg-white p-3 rounded-md shadow-sm cursor-grab"
    >
      <p className="font-medium">{task.title}</p>
      {/* ... */}
    </div>
  );
};
```

---

## 3. Backend Architecture

### 3.1 Project Structure

```
backend/
├── alembic/                    # Database migrations
│   ├── versions/
│   ├── env.py
│   └── alembic.ini
│
├── app/                        # Main application
│   ├── __init__.py
│   ├── main.py                 # FastAPI application entry
│   ├── config.py               # Configuration settings
│   │
│   ├── api/                    # API layer
│   │   ├── __init__.py
│   │   ├── deps.py             # Dependencies (auth, db)
│   │   ├── errors.py           # Error handlers
│   │   └── v1/
│   │       ├── __init__.py
│   │       ├── router.py       # Main API router
│   │       ├── auth.py         # Auth endpoints
│   │       ├── users.py        # User endpoints
│   │       ├── projects.py     # Project endpoints
│   │       ├── tasks.py        # Task endpoints
│   │       ├── teams.py        # Team endpoints
│   │       ├── comments.py     # Comment endpoints
│   │       ├── time_tracking.py # Time tracking endpoints
│   │       ├── files.py        # File endpoints
│   │       ├── calendar.py     # Calendar endpoints
│   │       ├── search.py       # Search endpoints
│   │       ├── notifications.py # Notification endpoints
│   │       └── reports.py      # Report endpoints
│   │
│   ├── core/                   # Core utilities
│   │   ├── __init__.py
│   │   ├── security.py         # JWT, password hashing
│   │   ├── permissions.py      # Permission checks
│   │   ├── exceptions.py       # Custom exceptions
│   │   ├── logging.py          # Logging configuration
│   │   └── events.py           # Event handlers
│   │
│   ├── models/                 # SQLAlchemy models
│   │   ├── __init__.py
│   │   ├── base.py             # Base model class
│   │   ├── user.py             # User model
│   │   ├── organization.py     # Organization model
│   │   ├── project.py          # Project model
│   │   ├── task.py             # Task model
│   │   ├── comment.py          # Comment model
│   │   ├── time_entry.py       # Time entry model
│   │   ├── file.py             # File model
│   │   ├── milestone.py        # Milestone model
│   │   ├── notification.py     # Notification model
│   │   ├── activity.py         # Activity log model
│   │   └── associations.py     # Many-to-many associations
│   │
│   ├── schemas/                # Pydantic schemas
│   │   ├── __init__.py
│   │   ├── base.py             # Base schema classes
│   │   ├── auth.py             # Auth schemas
│   │   ├── user.py             # User schemas
│   │   ├── project.py          # Project schemas
│   │   ├── task.py             # Task schemas
│   │   ├── comment.py          # Comment schemas
│   │   ├── time_entry.py       # Time entry schemas
│   │   ├── file.py             # File schemas
│   │   ├── notification.py     # Notification schemas
│   │   └── search.py           # Search schemas
│   │
│   ├── services/               # Business logic
│   │   ├── __init__.py
│   │   ├── auth_service.py
│   │   ├── user_service.py
│   │   ├── project_service.py
│   │   ├── task_service.py
│   │   ├── comment_service.py
│   │   ├── time_tracking_service.py
│   │   ├── file_service.py
│   │   ├── notification_service.py
│   │   ├── search_service.py
│   │   └── email_service.py
│   │
│   ├── db/                     # Database
│   │   ├── __init__.py
│   │   ├── session.py          # Database session
│   │   └── base_class.py       # Declarative base
│   │
│   ├── tasks/                  # Background tasks
│   │   ├── __init__.py
│   │   ├── celery_app.py       # Celery configuration
│   │   ├── email_tasks.py      # Email tasks
│   │   ├── report_tasks.py     # Report generation
│   │   └── cleanup_tasks.py    # Maintenance tasks
│   │
│   ├── websocket/              # WebSocket handlers
│   │   ├── __init__.py
│   │   ├── manager.py          # Connection manager
│   │   ├── events.py           # Event handlers
│   │   └── handlers/
│   │       ├── task_handlers.py
│   │       ├── comment_handlers.py
│   │       └── notification_handlers.py
│   │
│   └── utils/                  # Utilities
│       ├── __init__.py
│       ├── validators.py
│       ├── formatters.py
│       └── helpers.py
│
├── tests/                      # Test suite
│   ├── __init__.py
│   ├── conftest.py
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── requirements/
│   ├── base.txt
│   ├── dev.txt
│   └── prod.txt
│
├── Dockerfile
├── docker-compose.yml
├── pytest.ini
└── .env.example
```

### 3.2 FastAPI Application Structure

```python
# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from contextlib import asynccontextmanager

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.events import create_start_app_handler, create_stop_app_handler
from app.websocket.manager import websocket_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await create_start_app_handler(app)()
    yield
    # Shutdown
    await create_stop_app_handler(app)()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    lifespan=lifespan,
)

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_HOSTS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Routes
app.include_router(api_router, prefix=settings.API_V1_STR)
app.include_router(websocket_router, prefix="/ws")

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
```

### 3.3 Database Models

```python
# app/models/user.py
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Table
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.db.base_class import Base

user_teams = Table(
    'user_teams',
    Base.metadata,
    Column('user_id', UUID(as_uuid=True), ForeignKey('users.id'), primary_key=True),
    Column('team_id', UUID(as_uuid=True), ForeignKey('teams.id'), primary_key=True)
)

class User(Base):
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    avatar_url = Column(String(500), nullable=True)
    
    # Status
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    is_superuser = Column(Boolean, default=False)
    
    # Settings
    timezone = Column(String(50), default="UTC")
    language = Column(String(10), default="en")
    notification_preferences = Column(JSONB, default={})
    
    # Organization
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"))
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_login = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    organization = relationship("Organization", back_populates="users")
    teams = relationship("Team", secondary=user_teams, back_populates="members")
    assigned_tasks = relationship("Task", back_populates="assignee")
    comments = relationship("Comment", back_populates="author")
    time_entries = relationship("TimeEntry", back_populates="user")
    notifications = relationship("Notification", back_populates="user")
    
    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"


# app/models/project.py
class Project(Base):
    __tablename__ = "projects"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    key = Column(String(10), nullable=False)  # Short code like "PROJ"
    
    # Status
    status = Column(String(50), default="active")  # active, archived, deleted
    visibility = Column(String(20), default="private")  # private, internal, public
    
    # Settings
    settings = Column(JSONB, default={})
    custom_fields = Column(JSONB, default={})
    
    # Organization
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"))
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    
    # Timestamps
    start_date = Column(DateTime(timezone=True), nullable=True)
    end_date = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    organization = relationship("Organization", back_populates="projects")
    owner = relationship("User")
    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")
    members = relationship("ProjectMember", back_populates="project")
    milestones = relationship("Milestone", back_populates="project")


# app/models/task.py
class Task(Base):
    __tablename__ = "tasks"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_number = Column(Integer, nullable=False)  # Sequential within project
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    
    # Status
    status = Column(String(50), default="todo")  # todo, in_progress, review, done
    priority = Column(String(20), default="medium")  # lowest, low, medium, high, highest
    
    # Time tracking
    estimated_hours = Column(Numeric(8, 2), nullable=True)
    actual_hours = Column(Numeric(8, 2), default=0)
    
    # Dates
    due_date = Column(DateTime(timezone=True), nullable=True)
    start_date = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"))
    assignee_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    reporter_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    parent_id = Column(UUID(as_uuid=True), ForeignKey("tasks.id"), nullable=True)
    
    # Custom fields
    custom_fields = Column(JSONB, default={})
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    project = relationship("Project", back_populates="tasks")
    assignee = relationship("User", foreign_keys=[assignee_id], back_populates="assigned_tasks")
    reporter = relationship("User", foreign_keys=[reporter_id])
    parent = relationship("Task", remote_side=[id], backref="subtasks")
    comments = relationship("Comment", back_populates="task", cascade="all, delete-orphan")
    time_entries = relationship("TimeEntry", back_populates="task")
    
    # Self-referential many-to-many for dependencies
    dependencies = relationship(
        "Task",
        secondary="task_dependencies",
        primaryjoin="Task.id==task_dependencies.c.task_id",
        secondaryjoin="Task.id==task_dependencies.c.depends_on_id",
        backref="dependent_tasks"
    )

# Task dependencies association table
task_dependencies = Table(
    'task_dependencies',
    Base.metadata,
    Column('task_id', UUID(as_uuid=True), ForeignKey('tasks.id'), primary_key=True),
    Column('depends_on_id', UUID(as_uuid=True), ForeignKey('tasks.id'), primary_key=True)
)
```

### 3.4 API Endpoints

```python
# app/api/v1/tasks.py
from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional
from uuid import UUID

from app.api.deps import get_current_user, get_db
from app.schemas.task import Task, TaskCreate, TaskUpdate, TaskList
from app.services.task_service import TaskService
from app.models import User

router = APIRouter()

@router.get("/", response_model=TaskList)
async def list_tasks(
    project_id: Optional[UUID] = Query(None),
    status: Optional[str] = Query(None),
    assignee_id: Optional[UUID] = Query(None),
    priority: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List tasks with filtering and pagination."""
    service = TaskService(db)
    return await service.get_tasks(
        organization_id=current_user.organization_id,
        project_id=project_id,
        status=status,
        assignee_id=assignee_id,
        priority=priority,
        search=search,
        page=page,
        page_size=page_size,
    )

@router.post("/", response_model=Task, status_code=status.HTTP_201_CREATED)
async def create_task(
    task_in: TaskCreate,
    db = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new task."""
    service = TaskService(db)
    return await service.create_task(
        obj_in=task_in,
        reporter_id=current_user.id,
    )

@router.get("/{task_id}", response_model=Task)
async def get_task(
    task_id: UUID,
    db = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get task by ID."""
    service = TaskService(db)
    task = await service.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

@router.put("/{task_id}", response_model=Task)
async def update_task(
    task_id: UUID,
    task_in: TaskUpdate,
    db = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update task."""
    service = TaskService(db)
    task = await service.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return await service.update_task(task, task_in, current_user.id)

@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: UUID,
    db = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete task."""
    service = TaskService(db)
    task = await service.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    await service.delete_task(task, current_user.id)

@router.post("/{task_id}/comments", response_model=Comment)
async def add_comment(
    task_id: UUID,
    comment_in: CommentCreate,
    db = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add comment to task."""
    service = TaskService(db)
    return await service.add_comment(task_id, comment_in, current_user.id)

@router.post("/{task_id}/time-entries", response_model=TimeEntry)
async def log_time(
    task_id: UUID,
    time_in: TimeEntryCreate,
    db = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Log time for task."""
    service = TaskService(db)
    return await service.log_time(task_id, time_in, current_user.id)
```

### 3.5 Service Layer

```python
# app/services/task_service.py
from typing import List, Optional
from uuid import UUID
from sqlalchemy import select, and_, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Task, Project, User
from app.schemas.task import TaskCreate, TaskUpdate
from app.services.notification_service import NotificationService
from app.websocket.manager import websocket_manager

class TaskService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.notification_service = NotificationService(db)
    
    async def get_tasks(
        self,
        organization_id: UUID,
        project_id: Optional[UUID] = None,
        status: Optional[str] = None,
        assignee_id: Optional[UUID] = None,
        priority: Optional[str] = None,
        search: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> TaskList:
        query = select(Task).join(Project).where(
            Project.organization_id == organization_id
        )
        
        if project_id:
            query = query.where(Task.project_id == project_id)
        if status:
            query = query.where(Task.status == status)
        if assignee_id:
            query = query.where(Task.assignee_id == assignee_id)
        if priority:
            query = query.where(Task.priority == priority)
        if search:
            query = query.where(
                or_(
                    Task.title.ilike(f"%{search}%"),
                    Task.description.ilike(f"%{search}%"),
                )
            )
        
        # Count total
        count_query = select(func.count()).select_from(query.subquery())
        total = await self.db.scalar(count_query)
        
        # Paginate
        query = query.offset((page - 1) * page_size).limit(page_size)
        query = query.order_by(Task.created_at.desc())
        
        result = await self.db.execute(query)
        tasks = result.scalars().all()
        
        return TaskList(
            items=tasks,
            total=total,
            page=page,
            page_size=page_size,
            pages=(total + page_size - 1) // page_size,
        )
    
    async def create_task(
        self,
        obj_in: TaskCreate,
        reporter_id: UUID,
    ) -> Task:
        # Get next task number for project
        result = await self.db.execute(
            select(func.max(Task.task_number)).where(
                Task.project_id == obj_in.project_id
            )
        )
        max_number = result.scalar() or 0
        
        task = Task(
            **obj_in.dict(),
            task_number=max_number + 1,
            reporter_id=reporter_id,
        )
        
        self.db.add(task)
        await self.db.commit()
        await self.db.refresh(task)
        
        # Send notifications
        if task.assignee_id:
            await self.notification_service.send_task_assigned(task)
            await websocket_manager.send_notification(
                user_id=task.assignee_id,
                data={
                    "type": "task_assigned",
                    "task_id": str(task.id),
                    "title": task.title,
                }
            )
        
        # Broadcast task creation
        await websocket_manager.broadcast_to_project(
            project_id=task.project_id,
            data={
                "type": "task_created",
                "task": task.to_dict(),
            }
        )
        
        return task
    
    async def update_task(
        self,
        task: Task,
        obj_in: TaskUpdate,
        user_id: UUID,
    ) -> Task:
        old_assignee = task.assignee_id
        
        # Update fields
        for field, value in obj_in.dict(exclude_unset=True).items():
            setattr(task, field, value)
        
        await self.db.commit()
        await self.db.refresh(task)
        
        # Handle assignee change
        if obj_in.assignee_id and obj_in.assignee_id != old_assignee:
            await self.notification_service.send_task_reassigned(task, old_assignee)
        
        # Broadcast update
        await websocket_manager.broadcast_to_project(
            project_id=task.project_id,
            data={
                "type": "task_updated",
                "task": task.to_dict(),
            }
        )
        
        return task
```

---

## 4. Database Schema

### 4.1 Entity Relationship Diagram

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  organizations  │     │      users       │     │     teams       │
├─────────────────┤     ├──────────────────┤     ├─────────────────┤
│ id (PK)         │◄────┤ organization_id  │     │ id (PK)         │
│ name            │     │ id (PK)          │     │ name            │
│ slug            │     │ email            │     │ description     │
│ settings        │     │ hashed_password  │     │ organization_id │◄──┐
│ created_at      │     │ first_name       │     │ created_at      │   │
└─────────────────┘     │ last_name        │     └─────────────────┘   │
                        │ avatar_url       │            ▲              │
                        │ is_active        │            │              │
                        │ is_superuser     │     ┌──────┴──────┐       │
                        │ timezone         │     │  user_teams │       │
                        │ created_at       │     ├─────────────┤       │
                        └──────────────────┘     │ user_id(FK) │───────┘
                              │   │   │          │ team_id(FK) │◄──────┘
                              │   │   │          └─────────────┘
                              │   │   │
        ┌─────────────────────┘   │   └─────────────────────┐
        │                         │                         │
        ▼                         ▼                         ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│    projects     │     │  project_members │     │    tasks        │
├─────────────────┤     ├──────────────────┤     ├─────────────────┤
│ id (PK)         │◄────┤ project_id (FK)  │     │ id (PK)         │
│ organization_id │◄────┤ user_id (FK)     │     │ project_id (FK) │◄──┐
│ owner_id (FK)   │◄────┤ role             │     │ task_number     │   │
│ name            │     │ joined_at        │     │ title           │   │
│ key             │     └──────────────────┘     │ description     │   │
│ description     │                              │ status          │   │
│ status          │                              │ priority        │   │
│ visibility      │                              │ assignee_id(FK) │◄──┤
│ settings        │                              │ reporter_id(FK)│◄──┤
│ created_at      │                              │ parent_id (FK) │◄─┐│
└─────────────────┘                              │ due_date       │  ││
        ▲                                        │ estimated_hours│  ││
        │                                        │ actual_hours   │  ││
        │                                        │ created_at     │  ││
        │                                        └────────────────┘  ││
        │                                                   ▲        ││
        │                                                   │        ││
        │                              ┌────────────────────┘        ││
        │                              │                             ││
        │                         ┌────┴────┐                        ││
        │                         │comments │                        ││
        │                         ├─────────┤                        ││
        │                         │id (PK)  │                        ││
        │                         │task_id  │◄───────────────────────┘│
        │                         │author_id│◄────────────────────────┤
        │                         │content  │                         │
        │                         │created_at                         │
        │                         └─────────┘                         │
        │                                                           │
        │                              ┌──────────────────┐         │
        │                              │   time_entries   │         │
        │                              ├──────────────────┤         │
        └──────────────────────────────┤ project_id (FK)  │         │
                                       │ task_id (FK)     │◄────────┘
                                       │ user_id (FK)     │◄────────┐
                                       │ hours            │         │
                                       │ description      │         │
                                       │ date             │         │
                                       │ is_billable      │         │
                                       └──────────────────┘         │
                                                                    │
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐│
│   milestones    │     │  notifications   │     │  attachments    ││
├─────────────────┤     ├──────────────────┤     ├─────────────────┤│
│ id (PK)         │     │ id (PK)          │     │ id (PK)         ││
│ project_id (FK) │◄────┤ user_id (FK)     │◄────┤ uploaded_by(FK)│┘
│ title           │     │ type             │     │ task_id (FK)    │◄──┐
│ description     │     │ title            │     │ project_id (FK) │◄──┤
│ due_date        │     │ message          │     │ filename        │   │
│ status          │     │ data (JSON)      │     │ file_path       │   │
│ created_at      │     │ is_read          │     │ file_size       │   │
└─────────────────┘     │ created_at       │     │ mime_type       │   │
                        └──────────────────┘     │ created_at      │   │
                                                 └─────────────────┘   │
                                                                       │
                                                 ┌─────────────────┐   │
                                                 │task_dependencies│   │
                                                 ├─────────────────┤   │
                                                 │ task_id (FK)    │◄──┘
                                                 │ depends_on_id(FK)◄──┘
                                                 └─────────────────┘
```

### 4.2 Indexes

```sql
-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_organization ON users(organization_id);

-- Projects
CREATE INDEX idx_projects_organization ON projects(organization_id);
CREATE INDEX idx_projects_status ON projects(status);

-- Tasks
CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_project_status ON tasks(project_id, status);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_search ON tasks USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '')));

-- Comments
CREATE INDEX idx_comments_task ON comments(task_id);
CREATE INDEX idx_comments_author ON comments(author_id);
CREATE INDEX idx_comments_created ON comments(created_at);

-- Time Entries
CREATE INDEX idx_time_entries_user ON time_entries(user_id);
CREATE INDEX idx_time_entries_task ON time_entries(task_id);
CREATE INDEX idx_time_entries_date ON time_entries(date);

-- Notifications
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(user_id, is_read);
```

---

## 5. Real-time Communication

### 5.1 WebSocket Architecture

```python
# app/websocket/manager.py
from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, List, Set
from uuid import UUID
import json

class ConnectionManager:
    def __init__(self):
        # user_id -> set of WebSocket connections
        self.user_connections: Dict[UUID, Set[WebSocket]] = {}
        # project_id -> set of user_ids
        self.project_subscriptions: Dict[UUID, Set[UUID]] = {}
    
    async def connect(self, websocket: WebSocket, user_id: UUID):
        await websocket.accept()
        if user_id not in self.user_connections:
            self.user_connections[user_id] = set()
        self.user_connections[user_id].add(websocket)
    
    def disconnect(self, websocket: WebSocket, user_id: UUID):
        if user_id in self.user_connections:
            self.user_connections[user_id].discard(websocket)
            if not self.user_connections[user_id]:
                del self.user_connections[user_id]
    
    async def send_to_user(self, user_id: UUID, message: dict):
        if user_id in self.user_connections:
            disconnected = set()
            for connection in self.user_connections[user_id]:
                try:
                    await connection.send_json(message)
                except:
                    disconnected.add(connection)
            # Clean up disconnected
            for conn in disconnected:
                self.user_connections[user_id].discard(conn)
    
    async def broadcast_to_project(self, project_id: UUID, message: dict):
        if project_id in self.project_subscriptions:
            for user_id in self.project_subscriptions[project_id]:
                await self.send_to_user(user_id, message)
    
    def subscribe_to_project(self, user_id: UUID, project_id: UUID):
        if project_id not in self.project_subscriptions:
            self.project_subscriptions[project_id] = set()
        self.project_subscriptions[project_id].add(user_id)
    
    def unsubscribe_from_project(self, user_id: UUID, project_id: UUID):
        if project_id in self.project_subscriptions:
            self.project_subscriptions[project_id].discard(user_id)

websocket_manager = ConnectionManager()

# WebSocket endpoint
from fastapi import APIRouter, Depends, WebSocket

websocket_router = APIRouter()

@websocket_router.websocket("/{user_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    user_id: UUID,
    token: str,
):
    # Validate token
    user = await validate_token(token)
    if not user or user.id != user_id:
        await websocket.close(code=4001)
        return
    
    await websocket_manager.connect(websocket, user_id)
    
    try:
        while True:
            data = await websocket.receive_json()
            
            # Handle different message types
            if data["type"] == "subscribe_project":
                project_id = UUID(data["project_id"])
                websocket_manager.subscribe_to_project(user_id, project_id)
            
            elif data["type"] == "unsubscribe_project":
                project_id = UUID(data["project_id"])
                websocket_manager.unsubscribe_from_project(user_id, project_id)
            
            elif data["type"] == "typing":
                # Broadcast typing indicator
                await websocket_manager.broadcast_to_project(
                    UUID(data["project_id"]),
                    {
                        "type": "user_typing",
                        "user_id": str(user_id),
                        "task_id": data.get("task_id"),
                    }
                )
    
    except WebSocketDisconnect:
        websocket_manager.disconnect(websocket, user_id)
```

---

## 6. Security Implementation

### 6.1 Authentication

```python
# app/core/security.py
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    
    to_encode.update({"exp": expire, "type": "access"})
    encoded_jwt = jwt.encode(
        to_encode, 
        settings.SECRET_KEY, 
        algorithm=settings.ALGORITHM
    )
    return encoded_jwt

def create_refresh_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=7)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(
        to_encode, 
        settings.SECRET_KEY, 
        algorithm=settings.ALGORITHM
    )
    return encoded_jwt

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(
            credentials.credentials, 
            settings.SECRET_KEY, 
            algorithms=[settings.ALGORITHM]
        )
        user_id: str = payload.get("sub")
        token_type: str = payload.get("type")
        
        if user_id is None or token_type != "access":
            raise credentials_exception
    
    except JWTError:
        raise credentials_exception
    
    user = await db.get(User, UUID(user_id))
    if user is None:
        raise credentials_exception
    
    return user

async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user
```

### 6.2 Permission System

```python
# app/core/permissions.py
from enum import Enum
from uuid import UUID
from fastapi import HTTPException, status

class Permission(str, Enum):
    # Project permissions
    PROJECT_CREATE = "project:create"
    PROJECT_READ = "project:read"
    PROJECT_UPDATE = "project:update"
    PROJECT_DELETE = "project:delete"
    
    # Task permissions
    TASK_CREATE = "task:create"
    TASK_READ = "task:read"
    TASK_UPDATE = "task:update"
    TASK_DELETE = "task:delete"
    TASK_ASSIGN = "task:assign"
    
    # Team permissions
    TEAM_MANAGE = "team:manage"
    MEMBER_INVITE = "member:invite"
    MEMBER_REMOVE = "member:remove"
    
    # Admin permissions
    ADMIN = "admin"

# Role-based permissions
ROLE_PERMISSIONS = {
    "owner": [Permission.ADMIN],
    "admin": [
        Permission.PROJECT_CREATE,
        Permission.PROJECT_UPDATE,
        Permission.PROJECT_DELETE,
        Permission.TEAM_MANAGE,
        Permission.MEMBER_INVITE,
        Permission.MEMBER_REMOVE,
    ],
    "manager": [
        Permission.PROJECT_CREATE,
        Permission.PROJECT_UPDATE,
        Permission.TASK_CREATE,
        Permission.TASK_UPDATE,
        Permission.TASK_ASSIGN,
        Permission.MEMBER_INVITE,
    ],
    "member": [
        Permission.PROJECT_READ,
        Permission.TASK_CREATE,
        Permission.TASK_READ,
        Permission.TASK_UPDATE,
    ],
    "viewer": [
        Permission.PROJECT_READ,
        Permission.TASK_READ,
    ],
}

class PermissionChecker:
    def __init__(self, required_permission: Permission):
        self.required_permission = required_permission
    
    async def __call__(
        self,
        project_id: UUID,
        user: User = Depends(get_current_user),
        db = Depends(get_db),
    ):
        # Check if user is superuser
        if user.is_superuser:
            return user
        
        # Get user's role in project
        result = await db.execute(
            select(ProjectMember).where(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id == user.id,
            )
        )
        member = result.scalar_one_or_none()
        
        if not member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not a member of this project",
            )
        
        # Check permissions
        user_permissions = ROLE_PERMISSIONS.get(member.role, [])
        
        if (
            Permission.ADMIN not in user_permissions 
            and self.required_permission not in user_permissions
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        
        return user

def require_permission(permission: Permission):
    return PermissionChecker(permission)

# Usage in routes
@router.put("/{project_id}", response_model=Project)
async def update_project(
    project_id: UUID,
    project_in: ProjectUpdate,
    user: User = Depends(require_permission(Permission.PROJECT_UPDATE)),
    db = Depends(get_db),
):
    ...
```

---

## 7. Deployment Architecture

### 7.1 Docker Configuration

```dockerfile
# Dockerfile (Backend)
FROM python:3.11-slim as builder

WORKDIR /app

# Install dependencies
COPY requirements/prod.txt .
RUN pip install --no-cache-dir -r prod.txt

# Production stage
FROM python:3.11-slim

WORKDIR /app

# Copy dependencies from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy application
COPY app/ ./app/
COPY alembic/ ./alembic/
COPY alembic.ini .

# Run migrations and start
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
```

```dockerfile
# Dockerfile (Frontend)
FROM node:20-alpine as builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### 7.2 Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "80:80"
    depends_on:
      - backend
    networks:
      - app-network

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/projectmgmt
      - REDIS_URL=redis://redis:6379/0
      - SECRET_KEY=${SECRET_KEY}
    depends_on:
      - postgres
      - redis
      - elasticsearch
    networks:
      - app-network

  postgres:
    image: postgres:15-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_DB=projectmgmt
    ports:
      - "5432:5432"
    networks:
      - app-network

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    networks:
      - app-network

  elasticsearch:
    image: elasticsearch:8.11.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data
    ports:
      - "9200:9200"
    networks:
      - app-network

  celery:
    build:
      context: ./backend
      dockerfile: Dockerfile
    command: celery -A app.tasks.celery_app worker --loglevel=info
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/projectmgmt
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - postgres
      - redis
    networks:
      - app-network

  celery-beat:
    build:
      context: ./backend
      dockerfile: Dockerfile
    command: celery -A app.tasks.celery_app beat --loglevel=info
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/projectmgmt
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - postgres
      - redis
    networks:
      - app-network

volumes:
  postgres_data:
  redis_data:
  elasticsearch_data:

networks:
  app-network:
    driver: bridge
```

---

## 8. Performance Optimization

### 8.1 Caching Strategy

```python
# app/core/cache.py
import json
from typing import Optional, Any
from redis.asyncio import Redis

from app.core.config import settings

redis_client = Redis.from_url(settings.REDIS_URL, decode_responses=True)

class Cache:
    @staticmethod
    async def get(key: str) -> Optional[Any]:
        value = await redis_client.get(key)
        if value:
            return json.loads(value)
        return None
    
    @staticmethod
    async def set(key: str, value: Any, expire: int = 300):
        await redis_client.setex(key, expire, json.dumps(value))
    
    @staticmethod
    async def delete(key: str):
        await redis_client.delete(key)
    
    @staticmethod
    async def delete_pattern(pattern: str):
        keys = await redis_client.keys(pattern)
        if keys:
            await redis_client.delete(*keys)

# Cache decorators
from functools import wraps

def cached(key_prefix: str, expire: int = 300):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate cache key
            cache_key = f"{key_prefix}:{hash(str(args) + str(kwargs))}"
            
            # Try to get from cache
            cached_value = await Cache.get(cache_key)
            if cached_value is not None:
                return cached_value
            
            # Execute function
            result = await func(*args, **kwargs)
            
            # Cache result
            await Cache.set(cache_key, result, expire)
            
            return result
        return wrapper
    return decorator

# Usage
class ProjectService:
    @cached("project", expire=600)
    async def get_project(self, project_id: UUID) -> Project:
        return await self.db.get(Project, project_id)
```

### 8.2 Database Optimization

```python
# Connection pooling
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=20,
    max_overflow=30,
    pool_pre_ping=True,
    pool_recycle=3600,
    echo=settings.DEBUG,
)

# Query optimization with selectinload
from sqlalchemy.orm import selectinload

async def get_task_with_relations(task_id: UUID):
    result = await db.execute(
        select(Task)
        .options(
            selectinload(Task.assignee),
            selectinload(Task.reporter),
            selectinload(Task.comments).selectinload(Comment.author),
            selectinload(Task.time_entries),
        )
        .where(Task.id == task_id)
    )
    return result.scalar_one_or_none()
```

---

## 9. Testing Strategy

### 9.1 Test Structure

```
tests/
├── unit/
│   ├── test_models.py
│   ├── test_schemas.py
│   ├── test_services.py
│   └── test_utils.py
├── integration/
│   ├── test_auth.py
│   ├── test_projects.py
│   ├── test_tasks.py
│   └── test_websocket.py
├── e2e/
│   ├── test_user_flows.py
│   └── test_project_flows.py
├── conftest.py
└── factories.py
```

### 9.2 Test Configuration

```python
# tests/conftest.py
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.db.base_class import Base
from app.api.deps import get_db

# Test database
TEST_DATABASE_URL = "postgresql+asyncpg://test:test@localhost/test_db"

engine = create_async_engine(TEST_DATABASE_URL)
TestingSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

@pytest.fixture(scope="session")
async def setup_database():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest.fixture
async def db_session(setup_database):
    async with TestingSessionLocal() as session:
        yield session
        await session.rollback()

@pytest.fixture
def client(db_session):
    def override_get_db():
        yield db_session
    
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

# Factory fixtures
@pytest.fixture
async def user_factory(db_session):
    async def create_user(**kwargs):
        user = UserFactory(**kwargs)
        db_session.add(user)
        await db_session.commit()
        return user
    return create_user
```

---

## 10. Monitoring & Logging

### 10.1 Logging Configuration

```python
# app/core/logging.py
import logging
import sys
from pythonjsonlogger import jsonlogger

from app.core.config import settings

def setup_logging():
    log_handler = logging.StreamHandler(sys.stdout)
    
    if settings.ENVIRONMENT == "production":
        formatter = jsonlogger.JsonFormatter(
            '%(timestamp)s %(level)s %(name)s %(message)s'
        )
    else:
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
    
    log_handler.setFormatter(formatter)
    
    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    root_logger.addHandler(log_handler)
    
    # Configure app logger
    app_logger = logging.getLogger("app")
    app_logger.setLevel(logging.DEBUG if settings.DEBUG else logging.INFO)
    
    return app_logger

logger = setup_logging()
```

### 10.2 Metrics

```python
# app/core/metrics.py
from prometheus_client import Counter, Histogram, Gauge

# Request metrics
request_count = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status']
)

request_duration = Histogram(
    'http_request_duration_seconds',
    'HTTP request duration',
    ['method', 'endpoint']
)

# Business metrics
active_users = Gauge(
    'active_users',
    'Number of active users'
)

tasks_created = Counter(
    'tasks_created_total',
    'Total tasks created',
    ['project_id']
)
```

---

**Document Owner**: Engineering Team  
**Review Cycle**: Monthly  
**Related Documents**: PRD.md, DESIGN.md
