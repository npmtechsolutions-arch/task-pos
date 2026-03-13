# ProjectFlow Backend

Enterprise-grade project management platform backend built with FastAPI, SQLAlchemy, and PostgreSQL.

## Features

- **Authentication & Authorization**: JWT-based auth with role-based access control
- **Multi-tenancy**: Schema-based tenant isolation
- **Real-time Communication**: WebSocket support for live updates
- **Task Management**: Full CRUD with Kanban board support
- **Time Tracking**: Built-in time logging and reporting
- **Notifications**: In-app and email notifications
- **API Documentation**: Auto-generated OpenAPI/Swagger docs

## Tech Stack

- **Framework**: FastAPI 0.104+
- **Database**: PostgreSQL 15+ with SQLAlchemy 2.0+
- **Cache**: Redis 7+
- **Message Queue**: Celery with Redis broker
- **Authentication**: JWT with python-jose
- **Validation**: Pydantic 2.0+

## Quick Start

### Prerequisites

- Python 3.11+
- PostgreSQL 15+
- Redis 7+
- Docker & Docker Compose (optional)

### Installation

1. **Clone and navigate to backend directory:**
```bash
cd backend
```

2. **Install dependencies with Poetry:**
```bash
pip install poetry
poetry install
```

3. **Set up environment variables:**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Run database migrations:**
```bash
poetry run alembic upgrade head
```

5. **Start the development server:**
```bash
poetry run uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`

### Docker Setup

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f api

# Run migrations
docker-compose exec api poetry run alembic upgrade head
```

## API Endpoints

### Authentication
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/logout` - User logout
- `GET /api/v1/auth/me` - Get current user

### Users
- `GET /api/v1/users` - List users
- `POST /api/v1/users` - Create user
- `GET /api/v1/users/me` - Get current user profile
- `PUT /api/v1/users/me` - Update current user
- `GET /api/v1/users/{id}` - Get user by ID

### Projects
- `GET /api/v1/projects` - List projects
- `POST /api/v1/projects` - Create project
- `GET /api/v1/projects/{id}` - Get project
- `PUT /api/v1/projects/{id}` - Update project
- `DELETE /api/v1/projects/{id}` - Archive project
- `POST /api/v1/projects/{id}/members` - Add member

### Tasks
- `GET /api/v1/tasks` - List tasks
- `POST /api/v1/tasks` - Create task
- `GET /api/v1/tasks/{id}` - Get task
- `PUT /api/v1/tasks/{id}` - Update task
- `DELETE /api/v1/tasks/{id}` - Delete task
- `POST /api/v1/tasks/{id}/comments` - Add comment
- `POST /api/v1/tasks/{id}/time-entries` - Log time

### Boards
- `GET /api/v1/boards/project/{project_id}` - Get project board
- `POST /api/v1/boards` - Create board
- `POST /api/v1/boards/{id}/columns` - Add column
- `POST /api/v1/boards/{id}/cards/move` - Move card

### Notifications
- `GET /api/v1/notifications` - List notifications
- `PUT /api/v1/notifications/read` - Mark as read
- `GET /api/v1/notifications/preferences` - Get preferences

## Development

### Running Tests

```bash
# Run all tests
poetry run pytest

# Run with coverage
poetry run pytest --cov=app --cov-report=html

# Run specific test file
poetry run pytest tests/test_auth.py
```

### Code Quality

```bash
# Run linter
poetry run ruff check .

# Run type checker
poetry run mypy .

# Format code
poetry run ruff format .
```

### Database Migrations

```bash
# Create new migration
poetry run alembic revision --autogenerate -m "description"

# Apply migrations
poetry run alembic upgrade head

# Rollback migration
poetry run alembic downgrade -1
```

## Project Structure

```
backend/
├── app/
│   ├── api/
│   │   ├── deps.py          # Dependencies
│   │   └── v1/              # API routes
│   ├── core/
│   │   ├── config.py        # Configuration
│   │   ├── logging.py       # Logging setup
│   │   └── security.py      # Security utilities
│   ├── db/
│   │   ├── base.py          # SQLAlchemy base
│   │   └── session.py       # Database session
│   ├── models/              # Database models
│   ├── schemas/             # Pydantic schemas
│   ├── services/            # Business logic
│   └── main.py              # Application entry
├── alembic/                 # Database migrations
├── tests/                   # Test files
├── pyproject.toml          # Dependencies
└── Dockerfile              # Container image
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection URL | - |
| `REDIS_URL` | Redis connection URL | - |
| `JWT_SECRET_KEY` | Secret for JWT signing | - |
| `SECRET_KEY` | General secret key | - |
| `DEBUG` | Enable debug mode | `false` |
| `ENVIRONMENT` | Environment name | `production` |

## License

MIT License - see LICENSE file for details.
