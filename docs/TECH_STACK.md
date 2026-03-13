# ProjectFlow - Technical Stack Documentation

## 1. Overview

ProjectFlow is built using a modern, scalable technology stack designed for enterprise-grade project management. The architecture follows a microservices-ready approach with clear separation between frontend, backend, and data layers.

**Core Philosophy:**
- **Type Safety**: Full TypeScript frontend + Python type hints
- **Performance**: Sub-200ms API responses, real-time updates
- **Scalability**: Horizontal scaling with containerized deployment
- **Security**: Defense in depth with encryption at rest and in transit

---

## 2. Frontend Stack

### 2.1 Core Framework

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.2+ | UI library with concurrent features |
| TypeScript | 5.0+ | Type safety and developer experience |
| Vite | 4.0+ | Build tool with HMR and optimization |

**Key React Features Used:**
- Concurrent rendering with `startTransition`
- Suspense for data fetching
- Custom hooks for stateful logic
- Context API for dependency injection

### 2.2 State Management

| Technology | Purpose |
|------------|---------|
| Zustand | Primary state management |
| React Query | Server state caching |
| Immer | Immutable state updates |

**State Architecture:**
```typescript
// Store composition pattern
export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set, get) => ({
        // Auth state
        ...createAuthSlice(set, get),
        // Project state  
        ...createProjectSlice(set, get),
        // Task state
        ...createTaskSlice(set, get),
        // UI state
        ...createUISlice(set, get),
      }),
      { name: 'app-storage', partialize: (state) => ({ user: state.user }) }
    )
  )
);
```

### 2.3 UI Components

| Technology | Purpose |
|------------|---------|
| Tailwind CSS | Utility-first styling |
| shadcn/ui | Headless component primitives |
| Radix UI | Accessible component foundations |
| Framer Motion | Animations and transitions |
| Lucide React | Icon library |

**Design Tokens:**
```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#EEF2FF',
          100: '#E0E7FF',
          500: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA',
        },
        // ... other colors
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-in': 'slideIn 0.3s ease-out',
      },
    },
  },
};
```

### 2.4 Data Fetching

| Technology | Purpose |
|------------|---------|
| Axios | HTTP client |
| React Query | Caching, synchronization |
| WebSocket Client | Real-time updates |

**API Client Setup:**
```typescript
// api/client.ts
import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for auth
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const tenantId = localStorage.getItem('tenant_id');
  if (tenantId) {
    config.headers['X-Tenant-ID'] = tenantId;
  }
  return config;
});

// Response interceptor for token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await refreshToken();
      return apiClient.request(error.config);
    }
    return Promise.reject(error);
  }
);
```

### 2.5 Real-time Communication

| Technology | Purpose |
|------------|---------|
| Socket.io-client | WebSocket connection |
| EventEmitter3 | Local event bus |

```typescript
// Real-time hook
export function useRealtime(events: string[]) {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    const socket = getSocket();
    
    events.forEach((event) => {
      socket.on(event, (data) => {
        // Invalidate relevant queries
        queryClient.invalidateQueries({ queryKey: [data.resource] });
      });
    });
    
    return () => {
      events.forEach((event) => socket.off(event));
    };
  }, [events, queryClient]);
}
```

### 2.6 Form Handling

| Technology | Purpose |
|------------|---------|
| React Hook Form | Form state management |
| Zod | Schema validation |
| Hookform Resolvers | Integration between RHF and Zod |

```typescript
// Form with validation
const taskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  dueDate: z.date().optional(),
  assigneeId: z.string().optional(),
});

type TaskFormData = z.infer<typeof taskSchema>;

function TaskForm({ onSubmit }: { onSubmit: (data: TaskFormData) => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
  });
  
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Input {...register('title')} error={errors.title?.message} />
      {/* ... other fields */}
    </form>
  );
}
```

### 2.7 Drag and Drop

| Technology | Purpose |
|------------|---------|
| @dnd-kit | Modern drag-and-drop |
| @dnd-kit/sortable | Sortable lists |

```typescript
// Kanban board with DnD
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

function KanbanBoard({ columns, tasks }: KanbanBoardProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragEnd={handleDragEnd}
    >
      {columns.map((column) => (
        <SortableContext
          key={column.id}
          items={tasks[column.id]}
          strategy={verticalListSortingStrategy}
        >
          <KanbanColumn column={column} tasks={tasks[column.id]} />
        </SortableContext>
      ))}
    </DndContext>
  );
}
```

---

## 3. Backend Stack

### 3.1 Core Framework

| Technology | Version | Purpose |
|------------|---------|---------|
| Python | 3.11+ | Programming language |
| FastAPI | 0.100+ | Web framework |
| Uvicorn | 0.23+ | ASGI server |
| Pydantic | 2.0+ | Data validation |

**FastAPI Application Structure:**
```python
# main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="ProjectFlow API",
    version="1.0.0",
    docs_url="/docs" if settings.DEBUG else None,
)

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth_router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(users_router, prefix="/api/v1/users", tags=["users"])
app.include_router(projects_router, prefix="/api/v1/projects", tags=["projects"])
app.include_router(tasks_router, prefix="/api/v1/tasks", tags=["tasks"])
```

### 3.2 Database

| Technology | Version | Purpose |
|------------|---------|---------|
| PostgreSQL | 15+ | Primary database |
| SQLAlchemy | 2.0+ | ORM |
| Alembic | 1.11+ | Migrations |
| asyncpg | 0.28+ | Async PostgreSQL driver |

**Database Configuration:**
```python
# database.py
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import declarative_base, sessionmaker

engine = create_async_engine(
    DATABASE_URL,
    pool_size=20,
    max_overflow=30,
    pool_pre_ping=True,
    echo=settings.DEBUG,
)

async_session = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

Base = declarative_base()

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
```

### 3.3 Authentication

| Technology | Purpose |
|------------|---------|
| python-jose | JWT handling |
| passlib | Password hashing |
| bcrypt | Hashing algorithm |

```python
# auth/jwt.py
from jose import jwt, JWTError
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
```

### 3.4 Caching

| Technology | Version | Purpose |
|------------|---------|---------|
| Redis | 7+ | Cache and pub/sub |
| redis-py | 4.6+ | Redis client |

```python
# cache/redis.py
import redis.asyncio as redis

redis_client = redis.Redis(
    host=settings.REDIS_HOST,
    port=settings.REDIS_PORT,
    password=settings.REDIS_PASSWORD,
    decode_responses=True,
)

class Cache:
    @staticmethod
    async def get(key: str) -> Optional[str]:
        return await redis_client.get(key)
    
    @staticmethod
    async def set(key: str, value: str, ttl: int = 3600):
        await redis_client.setex(key, ttl, value)
    
    @staticmethod
    async def delete(key: str):
        await redis_client.delete(key)
    
    @staticmethod
    async def delete_pattern(pattern: str):
        keys = await redis_client.keys(pattern)
        if keys:
            await redis_client.delete(*keys)
```

### 3.5 Background Tasks

| Technology | Version | Purpose |
|------------|---------|---------|
| Celery | 5.3+ | Task queue |
| Flower | 2.0+ | Task monitoring |

```python
# tasks/celery.py
from celery import Celery

celery_app = Celery(
    "projectflow",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["tasks.notifications", "tasks.reports", "tasks.exports"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,
    worker_prefetch_multiplier=1,
)

# Task definition
@celery_app.task(bind=True, max_retries=3)
def send_notification(self, user_id: str, notification_type: str, data: dict):
    try:
        notification_service.send(user_id, notification_type, data)
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60)
```

### 3.6 Real-time Communication

| Technology | Version | Purpose |
|------------|---------|---------|
| Socket.io | 4.7+ | WebSocket server |
| python-socketio | 5.8+ | Python Socket.io implementation |

```python
# realtime/socketio.py
import socketio

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=settings.ALLOWED_ORIGINS,
    namespace="/realtime",
)

@sio.event
async def connect(sid, environ):
    token = environ.get("HTTP_AUTHORIZATION", "").replace("Bearer ", "")
    user = await authenticate_socket(token)
    if not user:
        raise ConnectionRefusedError("Unauthorized")
    
    await sio.save_session(sid, {"user_id": user.id, "tenant_id": user.tenant_id})
    await sio.enter_room(sid, f"tenant:{user.tenant_id}")

@sio.event
async def join_project(sid, project_id):
    session = await sio.get_session(sid)
    await sio.enter_room(sid, f"project:{project_id}")

async def broadcast_task_update(tenant_id: str, project_id: str, task: dict):
    await sio.emit(
        "task:updated",
        {"task": task},
        room=f"project:{project_id}",
        namespace="/realtime",
    )
```

### 3.7 Search

| Technology | Version | Purpose |
|------------|---------|---------|
| Elasticsearch | 8.8+ | Full-text search |
| elasticsearch-py | 8.8+ | Python client |

```python
# search/elasticsearch.py
from elasticsearch import AsyncElasticsearch

es = AsyncElasticsearch([settings.ELASTICSEARCH_URL])

class TaskSearch:
    INDEX = "tasks"
    
    @classmethod
    async def index_task(cls, task: Task):
        await es.index(
            index=cls.INDEX,
            id=task.id,
            document={
                "title": task.title,
                "description": task.description,
                "status": task.status,
                "priority": task.priority,
                "project_id": task.project_id,
                "assignee_id": task.assignee_id,
                "tenant_id": task.tenant_id,
            },
        )
    
    @classmethod
    async def search(cls, tenant_id: str, query: str, filters: dict = None):
        search_body = {
            "query": {
                "bool": {
                    "must": [
                        {"term": {"tenant_id": tenant_id}},
                        {
                            "multi_match": {
                                "query": query,
                                "fields": ["title^3", "description"],
                                "type": "best_fields",
                            }
                        },
                    ],
                    "filter": [
                        {"term": {k: v}} for k, v in (filters or {}).items()
                    ],
                }
            },
            "highlight": {
                "fields": {
                    "title": {},
                    "description": {"fragment_size": 150},
                }
            },
        }
        
        response = await es.search(index=cls.INDEX, body=search_body)
        return response["hits"]["hits"]
```

---

## 4. DevOps & Infrastructure

### 4.1 Containerization

| Technology | Version | Purpose |
|------------|---------|---------|
| Docker | 24+ | Container runtime |
| Docker Compose | 2.20+ | Local orchestration |
| BuildKit | Latest | Image building |

**Multi-stage Dockerfile:**
```dockerfile
# Dockerfile (Frontend)
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

# Dockerfile (Backend)
FROM python:3.11-slim AS builder
WORKDIR /app
RUN pip install poetry
COPY pyproject.toml poetry.lock ./
RUN poetry config virtualenvs.create false
RUN poetry install --no-dev

FROM python:3.11-slim
WORKDIR /app
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 4.2 Orchestration

| Technology | Version | Purpose |
|------------|---------|---------|
| Kubernetes | 1.27+ | Container orchestration |
| Helm | 3.12+ | Package management |
| ArgoCD | 2.8+ | GitOps deployment |

### 4.3 CI/CD

| Technology | Purpose |
|------------|---------|
| GitHub Actions | CI/CD pipelines |
| SonarQube | Code quality |
| Trivy | Security scanning |

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: |
          pip install poetry
          poetry install
      
      - name: Run tests
        run: poetry run pytest --cov=app --cov-report=xml
      
      - name: Run linting
        run: poetry run ruff check .
      
      - name: Run type checking
        run: poetry run mypy .

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build and push
        uses: docker/build-push-action@v4
        with:
          push: true
          tags: |
            projectflow/api:${{ github.sha }}
            projectflow/api:latest

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Kubernetes
        run: |
          kubectl set image deployment/api api=projectflow/api:${{ github.sha }}
          kubectl rollout status deployment/api
```

### 4.4 Monitoring

| Technology | Version | Purpose |
|------------|---------|---------|
| Prometheus | 2.47+ | Metrics collection |
| Grafana | 10.1+ | Visualization |
| Loki | 2.9+ | Log aggregation |
| Jaeger | 1.49+ | Distributed tracing |

### 4.5 Cloud Providers

**Primary: AWS**
| Service | Purpose |
|---------|---------|
| EKS | Kubernetes cluster |
| RDS | Managed PostgreSQL |
| ElastiCache | Managed Redis |
| S3 | File storage |
| CloudFront | CDN |
| Route 53 | DNS |
| ALB | Load balancing |

**Alternative: GCP**
| Service | Purpose |
|---------|---------|
| GKE | Kubernetes cluster |
| Cloud SQL | Managed PostgreSQL |
| Memorystore | Managed Redis |
| Cloud Storage | File storage |

---

## 5. Development Tools

### 5.1 Code Quality

| Tool | Purpose |
|------|---------|
| ESLint | JavaScript/TypeScript linting |
| Prettier | Code formatting |
| Ruff | Python linting (replaces flake8, black, isort) |
| MyPy | Python type checking |

### 5.2 Testing

| Tool | Purpose |
|------|---------|
| Vitest | Unit testing (frontend) |
| React Testing Library | Component testing |
| Playwright | E2E testing |
| pytest | Python testing |
| pytest-asyncio | Async test support |
| Factory Boy | Test data generation |

### 5.3 Documentation

| Tool | Purpose |
|------|---------|
| Storybook | Component documentation |
| MkDocs | API documentation |
| OpenAPI | API specification |

---

## 6. Security Stack

### 6.1 Application Security

| Tool | Purpose |
|------|---------|
| OWASP ZAP | Security scanning |
| Snyk | Dependency vulnerability scanning |
| Bandit | Python security linter |
| npm audit | Node.js security audit |

### 6.2 Secrets Management

| Tool | Purpose |
|------|---------|
| AWS Secrets Manager | Cloud secrets |
| HashiCorp Vault | Self-hosted secrets |
| Mozilla SOPS | Git-encrypted secrets |

---

## 7. Version Summary

```yaml
# stack-versions.yaml
frontend:
  node: "18.x"
  react: "18.2.0"
  typescript: "5.2.0"
  vite: "4.4.0"
  tailwindcss: "3.3.0"
  zustand: "4.4.0"

backend:
  python: "3.11"
  fastapi: "0.103.0"
  sqlalchemy: "2.0.0"
  pydantic: "2.3.0"
  celery: "5.3.0"

infrastructure:
  postgresql: "15.4"
  redis: "7.2"
  elasticsearch: "8.9"
  kubernetes: "1.28"
  docker: "24.0"
```

---

## 8. Getting Started

### 8.1 Prerequisites

- Node.js 18+
- Python 3.11+
- Docker & Docker Compose
- Git

### 8.2 Quick Start

```bash
# Clone repository
git clone https://github.com/projectflow/platform.git
cd projectflow

# Start infrastructure
docker-compose up -d db redis

# Setup backend
cd backend
python -m venv venv
source venv/bin/activate
pip install poetry
poetry install
poetry run alembic upgrade head
poetry run uvicorn main:app --reload

# Setup frontend (new terminal)
cd frontend
npm install
npm run dev

# Access application
open http://localhost:3000
```

---

## 9. References

- [FastAPI Documentation](https://fastapi.tiangolo.com)
- [React Documentation](https://react.dev)
- [SQLAlchemy Documentation](https://docs.sqlalchemy.org)
- [Tailwind CSS Documentation](https://tailwindcss.com)
- [Kubernetes Documentation](https://kubernetes.io/docs)
