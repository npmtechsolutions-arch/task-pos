# ProjectFlow - System Design Document

## 1. Architecture Overview

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Web App   │  │  Mobile App │  │   Desktop   │  │   Third-party       │ │
│  │   (React)   │  │(React Native│  │   (Electron)│  │   Integrations      │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
└─────────┼────────────────┼────────────────┼────────────────────┼────────────┘
          │                │                │                    │
          └────────────────┴────────────────┴────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           GATEWAY LAYER                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                        API Gateway (Kong/Nginx)                          ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ ││
│  │  │   Routing   │  │ Rate Limit  │  │   Auth      │  │   Load Balancer │ ││
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────┘ ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         APPLICATION LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                    FastAPI Application Servers                           ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ ││
│  │  │  REST API   │  │ WebSocket   │  │  GraphQL    │  │   Background    │ ││
│  │  │  (HTTP/2)   │  │  (Socket.io)│  │  (Optional) │  │   Workers       │ ││
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────┘ ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SERVICE LAYER                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐│
│  │   Identity   │ │   Project    │ │    Task      │ │   Communication      ││
│  │   Service    │ │   Service    │ │   Service    │ │   Service            ││
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────────────┘│
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐│
│  │     Time     │ │   Resource   │ │   Report     │ │   Notification       ││
│  │   Service    │ │   Service    │ │   Service    │ │   Service            ││
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DATA LAYER                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │   PostgreSQL    │  │     Redis       │  │   Elasticsearch             │  │
│  │  (Primary DB)   │  │   (Cache/Queue) │  │   (Search/Analytics)        │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────────┘  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │   MinIO/S3      │  │   RabbitMQ/     │  │   ClickHouse/TimescaleDB    │  │
│  │  (File Storage) │  │   Redis Streams │  │   (Time-series Analytics)   │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | React 18+, TypeScript | User interface |
| State Management | Zustand/Redux Toolkit | Client state |
| UI Components | shadcn/ui, Tailwind CSS | Component library |
| Backend | FastAPI, Python 3.11+ | API framework |
| Database | PostgreSQL 15+ | Primary data store |
| Cache | Redis 7+ | Caching, sessions, pub/sub |
| Message Queue | RabbitMQ / Redis Streams | Async processing |
| Search | Elasticsearch 8+ | Full-text search |
| File Storage | MinIO / AWS S3 | Object storage |
| WebSocket | Socket.io | Real-time communication |
| Container | Docker, Kubernetes | Deployment |

---

## 2. Multi-Tenancy Architecture

### 2.1 Tenant Isolation Strategy

ProjectFlow implements a **hybrid multi-tenancy** approach supporting migration from shared database to isolated databases:

```
┌─────────────────────────────────────────────────────────────────┐
│                    TENANT ISOLATION LEVELS                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Level 1: Shared Database (Default)                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Database: projectflow_shared                           │    │
│  │  ├── Schema: tenant_abc123 (Tenant A)                   │    │
│  │  ├── Schema: tenant_def456 (Tenant B)                   │    │
│  │  └── Schema: tenant_ghi789 (Tenant C)                   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Level 2: Dedicated Database (Enterprise)                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Database: tenant_abc123_prod (Tenant A)                │    │
│  │  Database: tenant_def456_prod (Tenant B)                │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Level 3: Sharded Database (Scale)                               │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Shard 1: tenants_001_100                               │    │
│  │  Shard 2: tenants_101_200                               │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Tenant Context Resolution

```python
# Tenant resolution middleware
class TenantMiddleware:
    async def resolve_tenant(self, request: Request):
        # 1. Extract tenant identifier
        tenant_id = (
            request.headers.get('X-Tenant-ID') or
            request.query_params.get('tenant') or
            self._extract_from_jwt(request) or
            self._extract_from_subdomain(request)
        )
        
        # 2. Validate tenant
        tenant = await self.tenant_service.get_tenant(tenant_id)
        if not tenant or not tenant.is_active:
            raise TenantNotFoundError()
            
        # 3. Set tenant context
        request.state.tenant = tenant
        request.state.db_schema = f"tenant_{tenant.id}"
        
        return tenant
```

### 2.3 Database Connection Management

```python
# SQLAlchemy with dynamic schema
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, scoped_session

class TenantAwareSession:
    def __init__(self):
        self.engine = create_engine(
            DATABASE_URL,
            pool_size=20,
            max_overflow=30,
            pool_pre_ping=True,
            connect_args={
                "options": "-c statement_timeout=30000"
            }
        )
        
    def get_session(self, tenant_id: str):
        schema = f"tenant_{tenant_id}"
        
        # Set search path for this connection
        @event.listens_for(self.engine, "connect")
        def set_search_path(dbapi_conn, connection_record):
            cursor = dbapi_conn.cursor()
            cursor.execute(f"SET search_path TO {schema}, public")
            cursor.close()
            
        return sessionmaker(bind=self.engine)()
```

### 2.4 Tenant Data Model

```python
class Tenant(Base):
    """Master tenant record in public schema"""
    __tablename__ = "tenants"
    __table_args__ = {"schema": "public"}
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    slug = Column(String(100), unique=True, nullable=False)
    tier = Column(Enum("free", "starter", "professional", "enterprise"))
    isolation_level = Column(Enum("shared", "dedicated", "sharded"))
    
    # Configuration
    settings = Column(JSONB, default={})
    features = Column(JSONB, default={})
    limits = Column(JSONB, default={})  # User count, storage, etc.
    
    # Status
    status = Column(Enum("active", "suspended", "cancelled"))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Database routing
    database_url = Column(String(500))  # For dedicated databases
    shard_key = Column(String(50))  # For sharded setup
```

---

## 3. Core Domain Modules

### 3.1 Identity & Access Management (IAM)

#### 3.1.1 User Model
```python
class User(Base):
    __tablename__ = "users"
    
    id = Column(String(36), primary_key=True)
    email = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    
    # Profile
    first_name = Column(String(100))
    last_name = Column(String(100))
    avatar_url = Column(String(500))
    timezone = Column(String(50), default="UTC")
    language = Column(String(10), default="en")
    
    # Status
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    last_login_at = Column(DateTime)
    
    # MFA
    mfa_enabled = Column(Boolean, default=False)
    mfa_secret = Column(String(255))
    
    # Relationships
    roles = relationship("UserRole", back_populates="user")
    sessions = relationship("UserSession", back_populates="user")
```

#### 3.1.2 RBAC System
```python
class Role(Base):
    __tablename__ = "roles"
    
    id = Column(String(36), primary_key=True)
    name = Column(String(100), nullable=False)
    description = Column(String(500))
    is_system = Column(Boolean, default=False)  # Built-in roles
    
    # Permissions as JSON array
    permissions = Column(JSONB, default=[])
    
class Permission(Enum):
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
    USER_INVITE = "user:invite"
    
    # Admin permissions
    ADMIN_FULL = "admin:full"
    SETTINGS_MANAGE = "settings:manage"
```

### 3.2 Project Domain

```python
class Project(Base):
    __tablename__ = "projects"
    
    id = Column(String(36), primary_key=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    status = Column(Enum("planning", "active", "on_hold", "completed", "cancelled"))
    
    # Timeline
    start_date = Column(Date)
    end_date = Column(Date)
    
    # Configuration
    workflow_id = Column(String(36), ForeignKey("workflows.id"))
    settings = Column(JSONB, default={})
    
    # Team
    owner_id = Column(String(36), ForeignKey("users.id"))
    members = relationship("ProjectMember", back_populates="project")
    
    # Metrics (denormalized for performance)
    total_tasks = Column(Integer, default=0)
    completed_tasks = Column(Integer, default=0)
    progress_percentage = Column(Float, default=0.0)

class ProjectMember(Base):
    __tablename__ = "project_members"
    
    project_id = Column(String(36), ForeignKey("projects.id"), primary_key=True)
    user_id = Column(String(36), ForeignKey("users.id"), primary_key=True)
    role = Column(Enum("owner", "admin", "member", "viewer"))
    joined_at = Column(DateTime, default=datetime.utcnow)
```

### 3.3 Task Domain

```python
class Task(Base):
    __tablename__ = "tasks"
    
    id = Column(String(36), primary_key=True)
    project_id = Column(String(36), ForeignKey("projects.id"))
    
    # Content
    title = Column(String(500), nullable=False)
    description = Column(Text)
    
    # Status & Priority
    status = Column(Enum("todo", "in_progress", "review", "done", "cancelled"))
    priority = Column(Enum("low", "medium", "high", "urgent"))
    
    # Assignment
    assignee_id = Column(String(36), ForeignKey("users.id"))
    reporter_id = Column(String(36), ForeignKey("users.id"))
    
    # Timeline
    due_date = Column(DateTime)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    
    # Time tracking
    estimated_hours = Column(Float)
    actual_hours = Column(Float, default=0.0)
    
    # Positioning (for Kanban)
    position = Column(Float, default=0.0)
    column_id = Column(String(36), ForeignKey("board_columns.id"))
    
    # Relationships
    tags = relationship("Tag", secondary="task_tags")
    subtasks = relationship("Task", backref=backref("parent", remote_side=[id]))
    dependencies = relationship("Task", secondary="task_dependencies",
                               primaryjoin=id==task_dependencies.c.task_id,
                               secondaryjoin=id==task_dependencies.c.depends_on_id)
    
    # Custom fields
    custom_fields = Column(JSONB, default={})
    
    # Audit
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)
    created_by = Column(String(36), ForeignKey("users.id"))

class TaskComment(Base):
    __tablename__ = "task_comments"
    
    id = Column(String(36), primary_key=True)
    task_id = Column(String(36), ForeignKey("tasks.id"))
    author_id = Column(String(36), ForeignKey("users.id"))
    content = Column(Text, nullable=False)
    
    # Mentions stored as JSON array of user IDs
    mentions = Column(JSONB, default=[])
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)
```

### 3.4 Kanban Domain

```python
class Board(Base):
    __tablename__ = "boards"
    
    id = Column(String(36), primary_key=True)
    project_id = Column(String(36), ForeignKey("projects.id"))
    name = Column(String(255), nullable=False)
    
    # Configuration
    settings = Column(JSONB, default={
        "wip_limits_enabled": False,
        "swimlanes_enabled": False
    })

class BoardColumn(Base):
    __tablename__ = "board_columns"
    
    id = Column(String(36), primary_key=True)
    board_id = Column(String(36), ForeignKey("boards.id"))
    name = Column(String(255), nullable=False)
    
    # Position in board
    position = Column(Integer, default=0)
    
    # WIP limit
    wip_limit = Column(Integer, nullable=True)
    
    # Column type for automation
    column_type = Column(Enum("backlog", "todo", "in_progress", "review", "done", "archive"))
    
    # Color coding
    color = Column(String(7), default="#E5E7EB")

class BoardSwimlane(Base):
    __tablename__ = "board_swimlanes"
    
    id = Column(String(36), primary_key=True)
    board_id = Column(String(36), ForeignKey("boards.id"))
    name = Column(String(255), nullable=False)
    criteria = Column(JSONB)  # Filter criteria for swimlane
    position = Column(Integer, default=0)
```

### 3.5 Time Tracking Domain

```python
class TimeEntry(Base):
    __tablename__ = "time_entries"
    
    id = Column(String(36), primary_key=True)
    task_id = Column(String(36), ForeignKey("tasks.id"))
    user_id = Column(String(36), ForeignKey("users.id"))
    
    # Time
    started_at = Column(DateTime, nullable=False)
    ended_at = Column(DateTime)
    duration_minutes = Column(Integer)
    
    # Description
    description = Column(String(500))
    
    # Billing
    is_billable = Column(Boolean, default=True)
    hourly_rate = Column(Decimal(10, 2))
    
    # Approval
    status = Column(Enum("draft", "submitted", "approved", "rejected"))
    approved_by = Column(String(36), ForeignKey("users.id"))
    approved_at = Column(DateTime)
    
    # Source (timer, manual, integration)
    source = Column(String(50), default="manual")
    
    created_at = Column(DateTime, default=datetime.utcnow)
```

---

## 4. API Design

### 4.1 REST API Structure

```
/api/v1/
├── /auth
│   ├── POST /login
│   ├── POST /register
│   ├── POST /refresh
│   ├── POST /logout
│   ├── POST /forgot-password
│   └── POST /reset-password
│
├── /users
│   ├── GET / (list)
│   ├── POST / (create)
│   ├── GET /{id}
│   ├── PUT /{id}
│   ├── DELETE /{id}
│   ├── GET /{id}/tasks
│   ├── GET /{id}/time-entries
│   └── PUT /{id}/profile
│
├── /projects
│   ├── GET / (list)
│   ├── POST / (create)
│   ├── GET /{id}
│   ├── PUT /{id}
│   ├── DELETE /{id}
│   ├── GET /{id}/members
│   ├── POST /{id}/members
│   ├── DELETE /{id}/members/{userId}
│   ├── GET /{id}/tasks
│   ├── GET /{id}/board
│   ├── GET /{id}/activity
│   └── POST /{id}/archive
│
├── /tasks
│   ├── GET / (list)
│   ├── POST / (create)
│   ├── GET /{id}
│   ├── PUT /{id}
│   ├── DELETE /{id}
│   ├── POST /{id}/assign
│   ├── POST /{id}/status
│   ├── GET /{id}/comments
│   ├── POST /{id}/comments
│   ├── GET /{id}/time-entries
│   ├── POST /{id}/time-entries
│   ├── POST /{id}/attachments
│   └── POST /{id}/subtasks
│
├── /boards
│   ├── GET /{id}
│   ├── PUT /{id}/columns
│   ├── POST /{id}/columns
│   ├── DELETE /{id}/columns/{columnId}
│   └── POST /{id}/cards/move
│
├── /time-entries
│   ├── GET / (list)
│   ├── POST / (create)
│   ├── GET /{id}
│   ├── PUT /{id}
│   ├── DELETE /{id}
│   ├── POST /{id}/submit
│   ├── POST /{id}/approve
│   └── GET /reports/summary
│
├── /notifications
│   ├── GET / (list)
│   ├── PUT /{id}/read
│   ├── PUT /read-all
│   └── GET /unread-count
│
└── /reports
    ├── GET /project/{id}/progress
    ├── GET /team/utilization
    ├── GET /time/summary
    └── POST /custom
```

### 4.2 WebSocket Events

```javascript
// Connection
socket.emit('join', { tenantId: 'abc123', userId: 'user456' });

// Real-time events
{
  // Task events
  'task:created': { taskId, projectId, task },
  'task:updated': { taskId, changes, userId },
  'task:deleted': { taskId, projectId },
  'task:moved': { taskId, fromColumn, toColumn, position },
  'task:assigned': { taskId, assigneeId, previousAssigneeId },
  
  // Comment events
  'comment:added': { commentId, taskId, authorId, mentions },
  'comment:updated': { commentId, taskId, changes },
  
  // Project events
  'project:member_joined': { projectId, userId, role },
  'project:member_left': { projectId, userId },
  
  // Notification events
  'notification:new': { notificationId, type, data },
  
  // Presence events
  'presence:update': { userId, status, lastSeen }
}
```

### 4.3 API Response Format

```json
{
  "success": true,
  "data": {
    "id": "task_123",
    "title": "Implement authentication",
    "status": "in_progress"
  },
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 150,
    "total_pages": 8
  },
  "links": {
    "self": "/api/v1/tasks/task_123",
    "next": "/api/v1/tasks?page=2",
    "prev": null
  }
}
```

---

## 5. Data Persistence Design

### 5.1 Database Schema Overview

```sql
-- Tenant isolation with schema per tenant
CREATE SCHEMA IF NOT EXISTS tenant_abc123;

-- Core tables
CREATE TABLE tenant_abc123.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    avatar_url VARCHAR(500),
    timezone VARCHAR(50) DEFAULT 'UTC',
    language VARCHAR(10) DEFAULT 'en',
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    mfa_enabled BOOLEAN DEFAULT false,
    mfa_secret VARCHAR(255),
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tenant_abc123.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'planning',
    start_date DATE,
    end_date DATE,
    owner_id UUID REFERENCES tenant_abc123.users(id),
    workflow_id UUID,
    settings JSONB DEFAULT '{}',
    total_tasks INTEGER DEFAULT 0,
    completed_tasks INTEGER DEFAULT 0,
    progress_percentage FLOAT DEFAULT 0.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tenant_abc123.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES tenant_abc123.projects(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES tenant_abc123.tasks(id),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'todo',
    priority VARCHAR(50) DEFAULT 'medium',
    assignee_id UUID REFERENCES tenant_abc123.users(id),
    reporter_id UUID REFERENCES tenant_abc123.users(id),
    due_date TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    estimated_hours FLOAT,
    actual_hours FLOAT DEFAULT 0.0,
    position FLOAT DEFAULT 0.0,
    column_id UUID,
    custom_fields JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_tasks_project ON tenant_abc123.tasks(project_id);
CREATE INDEX idx_tasks_assignee ON tenant_abc123.tasks(assignee_id);
CREATE INDEX idx_tasks_status ON tenant_abc123.tasks(status);
CREATE INDEX idx_tasks_due_date ON tenant_abc123.tasks(due_date);
CREATE INDEX idx_tasks_custom_fields ON tenant_abc123.tasks USING GIN(custom_fields);

-- Full-text search
CREATE INDEX idx_tasks_search ON tenant_abc123.tasks 
    USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '')));
```

### 5.2 Caching Strategy

| Cache Type | Key Pattern | TTL | Use Case |
|------------|-------------|-----|----------|
| Session | `session:{token}` | 24h | User authentication |
| User | `user:{id}` | 1h | User profile data |
| Project | `project:{id}` | 30m | Project metadata |
| Task List | `tasks:{project_id}:{filter_hash}` | 5m | Filtered task lists |
| Board | `board:{project_id}` | 1m | Kanban board state |
| Rate Limit | `ratelimit:{user_id}:{endpoint}` | 1m | API rate limiting |

### 5.3 Data Retention & Archival

```python
# Archival strategy for old data
class DataArchivalService:
    ARCHIVAL_RULES = {
        "completed_tasks": {"older_than_days": 365, "archive_to": "s3"},
        "time_entries": {"older_than_days": 730, "archive_to": "s3"},
        "activity_logs": {"older_than_days": 90, "aggregate": True},
        "notifications": {"older_than_days": 30, "delete": True},
    }
    
    async def archive_old_data(self, tenant_id: str):
        for table, rule in self.ARCHIVAL_RULES.items():
            cutoff_date = datetime.utcnow() - timedelta(days=rule["older_than_days"])
            
            # Export to S3
            if rule.get("archive_to") == "s3":
                await self.export_to_s3(tenant_id, table, cutoff_date)
                
            # Aggregate and delete
            if rule.get("aggregate"):
                await self.aggregate_and_delete(tenant_id, table, cutoff_date)
                
            # Direct delete
            if rule.get("delete"):
                await self.delete_old_records(tenant_id, table, cutoff_date)
```

---

## 6. Security Architecture

### 6.1 Authentication Flow

```
┌─────────┐         ┌─────────────┐         ┌─────────────┐         ┌─────────┐
│  Client │────────▶│   Login     │────────▶│   Verify    │────────▶│  JWT    │
│         │         │   Endpoint  │         │ Credentials │         │ Tokens  │
└─────────┘         └─────────────┘         └─────────────┘         └────┬────┘
                                                                         │
                              ┌──────────────────────────────────────────┘
                              ▼
                    ┌─────────────────┐
                    │  Access Token   │─────▶ Short-lived (15 min)
                    │  Refresh Token  │─────▶ Long-lived (7 days)
                    └─────────────────┘
```

### 6.2 Authorization Flow

```python
# Permission checking decorator
from functools import wraps

def require_permission(permission: Permission):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            request = args[0]  # FastAPI request
            user = request.state.user
            tenant = request.state.tenant
            
            # Check if user has permission
            has_permission = await auth_service.check_permission(
                user_id=user.id,
                tenant_id=tenant.id,
                permission=permission,
                resource_id=kwargs.get("resource_id")
            )
            
            if not has_permission:
                raise HTTPException(status_code=403, detail="Insufficient permissions")
                
            return await func(*args, **kwargs)
        return wrapper
    return decorator

# Usage
@app.put("/tasks/{task_id}")
@require_permission(Permission.TASK_UPDATE)
async def update_task(request: Request, task_id: str, data: TaskUpdate):
    pass
```

### 6.3 Data Encryption

```python
# Field-level encryption for PII
from cryptography.fernet import Fernet

class EncryptedField:
    def __init__(self, key: bytes):
        self.cipher = Fernet(key)
        
    def encrypt(self, value: str) -> str:
        return self.cipher.encrypt(value.encode()).decode()
        
    def decrypt(self, value: str) -> str:
        return self.cipher.decrypt(value.encode()).decode()

# Usage in models
class User(Base):
    # Regular fields
    email = Column(String(255))
    
    # Encrypted fields
    _phone = Column("phone", String(500))
    
    @property
    def phone(self) -> str:
        return encryption.decrypt(self._phone) if self._phone else None
        
    @phone.setter
    def phone(self, value: str):
        self._phone = encryption.encrypt(value) if value else None
```

---

## 7. Deployment Architecture

### 7.1 Docker Compose (Development)

```yaml
version: '3.8'

services:
  # Frontend
  web:
    build: ./frontend
    ports:
      - "3000:3000"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    environment:
      - VITE_API_URL=http://localhost:8000
      
  # Backend API
  api:
    build: ./backend
    ports:
      - "8000:8000"
    volumes:
      - ./backend:/app
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/projectflow
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=dev-secret
    depends_on:
      - db
      - redis
      
  # PostgreSQL
  db:
    image: postgres:15-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=projectflow
    ports:
      - "5432:5432"
      
  # Redis
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
      
  # Background Worker
  worker:
    build: ./backend
    command: celery -A tasks worker --loglevel=info
    volumes:
      - ./backend:/app
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/projectflow
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis

volumes:
  postgres_data:
```

### 7.2 Kubernetes (Production)

```yaml
# api-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: projectflow-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: projectflow-api
  template:
    metadata:
      labels:
        app: projectflow-api
    spec:
      containers:
      - name: api
        image: projectflow/api:latest
        ports:
        - containerPort: 8000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: redis-credentials
              key: url
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: projectflow-api
spec:
  selector:
    app: projectflow-api
  ports:
  - port: 80
    targetPort: 8000
  type: ClusterIP
```

---

## 8. Monitoring & Observability

### 8.1 Logging Strategy

```python
import structlog

logger = structlog.get_logger()

# Structured logging with context
async def create_task(task_data: dict, user_id: str, tenant_id: str):
    logger.info(
        "task_creation_started",
        user_id=user_id,
        tenant_id=tenant_id,
        task_title=task_data.get("title"),
        project_id=task_data.get("project_id")
    )
    
    try:
        task = await task_service.create(task_data)
        logger.info(
            "task_created",
            task_id=task.id,
            duration_ms=timer.elapsed_ms
        )
        return task
    except Exception as e:
        logger.error(
            "task_creation_failed",
            error=str(e),
            error_type=type(e).__name__
        )
        raise
```

### 8.2 Metrics Collection

```python
from prometheus_client import Counter, Histogram, Gauge

# Define metrics
task_created_total = Counter(
    'task_created_total',
    'Total tasks created',
    ['tenant_id', 'priority']
)

api_request_duration = Histogram(
    'api_request_duration_seconds',
    'API request duration',
    ['method', 'endpoint', 'status_code']
)

active_users = Gauge(
    'active_users',
    'Number of active users',
    ['tenant_id']
)

# Usage
@app.post("/tasks")
async def create_task_endpoint(request: Request, data: TaskCreate):
    with timer() as t:
        task = await create_task(data)
        
    task_created_total.labels(
        tenant_id=request.state.tenant.id,
        priority=task.priority
    ).inc()
    
    api_request_duration.labels(
        method="POST",
        endpoint="/tasks",
        status_code=201
    ).observe(t.elapsed_seconds)
    
    return task
```

### 8.3 Health Checks

```python
@app.get("/health")
async def health_check():
    checks = {
        "database": await check_database(),
        "redis": await check_redis(),
        "elasticsearch": await check_elasticsearch(),
    }
    
    all_healthy = all(checks.values())
    
    return {
        "status": "healthy" if all_healthy else "unhealthy",
        "checks": checks,
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/ready")
async def readiness_check():
    # Check if application is ready to receive traffic
    if not app_state.is_initialized:
        raise HTTPException(status_code=503, detail="Not ready")
    return {"status": "ready"}
```

---

## 9. Appendix

### 9.1 Database Migration Strategy

```python
# Alembic migration for multi-tenancy
from alembic import op
import sqlalchemy as sa

def upgrade():
    # Create tenant schema
    op.execute("CREATE SCHEMA IF NOT EXISTS tenant_new_tenant")
    
    # Create tables in tenant schema
    op.create_table(
        'users',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('email', sa.String(255), unique=True, nullable=False),
        # ... other columns
        schema='tenant_new_tenant'
    )
    
def downgrade():
    op.execute("DROP SCHEMA IF EXISTS tenant_new_tenant CASCADE")
```

### 9.2 Backup & Recovery

```bash
#!/bin/bash
# backup.sh

# Daily backup script
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/$DATE"

# Backup each tenant schema
for schema in $(psql -t -c "SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%'"); do
    pg_dump --schema=$schema projectflow > "$BACKUP_DIR/$schema.sql"
done

# Upload to S3
aws s3 sync $BACKUP_DIR s3://projectflow-backups/$DATE/

# Clean old backups (keep 30 days)
find /backups -type d -mtime +30 -exec rm -rf {} \;
```

### 9.3 Performance Benchmarks

| Operation | Target | Test Method |
|-----------|--------|-------------|
| Login | < 200ms | Load test with 1000 concurrent users |
| Task List (100 items) | < 100ms | API response time |
| Kanban Board Load | < 500ms | Full board with 500 cards |
| Search Results | < 100ms | Elasticsearch query |
| Real-time Update | < 50ms | WebSocket message latency |
| Report Generation | < 5s | Complex report with aggregations |
