"""Main FastAPI application."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.logging import configure_logging, get_logger

# Configure logging
configure_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    logger.info("Starting up", app_name=settings.app_name)

    # Auto-create tables in development
    from app.db.base import Base
    from app.db.session import engine
    # Ensure all models are imported so SQLAlchemy creates their tables
    import app.models.calendar  # noqa: F401
    import app.models.hr_hierarchy  # noqa: F401
    import app.models.hr_records  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all, checkfirst=True)
        logger.info("Database tables created/verified")

    yield

    logger.info("Shutting down")
    from app.db.session import engine as _engine
    await _engine.dispose()


# Create FastAPI app
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Enterprise Project Management Platform API",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_origin_regex=settings.allowed_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=1000)

# Include API routes
from app.api.v1 import api_router  # noqa: E402
app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "version": settings.app_version,
        "environment": settings.environment,
    }


@app.get("/ready")
async def readiness_check():
    """Readiness check - verify DB connectivity."""
    try:
        from app.db.session import AsyncSessionLocal
        from sqlalchemy import text
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        return {"status": "ready", "database": "connected"}
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={"status": "not ready", "database": str(e)},
        )


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler."""
    logger.error("Unhandled exception", error=str(exc), path=request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


from fastapi import WebSocket, WebSocketDisconnect, Query
from app.websocket.manager import manager


@app.websocket("/ws/{user_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    user_id: str,
    token: str = Query(None),
):
    """Authenticated WebSocket endpoint.
    
    Client connects with: ws://host/ws/{user_id}?token=<jwt>
    Supports messages:
      {type: 'join_room', room: 'task:uuid'}
      {type: 'leave_room', room: 'task:uuid'}
      {type: 'typing', room: 'task:uuid'}  → broadcasts to room (debounced on client)
    """
    # Auth: verify JWT token
    if token:
        try:
            from app.core.security import decode_token
            payload = decode_token(token)
            token_user_id = payload.get("sub") or payload.get("user_id")
            # Reject if token belongs to a different user
            if token_user_id and token_user_id != user_id:
                await websocket.close(code=4001)
                return
        except Exception:
            await websocket.close(code=4001)
            return

    await manager.connect(websocket, user_id)
    try:
        while True:
            import json
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except Exception:
                continue

            msg_type = data.get("type")
            room = data.get("room")

            if msg_type == "join_room" and room:
                await manager.join_room(user_id, room)
                await websocket.send_json({"type": "joined", "room": room})

            elif msg_type == "leave_room" and room:
                await manager.leave_room(user_id, room)

            elif msg_type == "typing" and room:
                # Get user's name for typing indicator
                actor_name = data.get("user_name", "Someone")
                await manager.send_to_room_except(room, user_id, {
                    "type": "typing",
                    "room": room,
                    "user_id": user_id,
                    "user_name": actor_name,
                })

            elif msg_type == "ping":
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
        # Clean up all rooms this user was in
        for room_name in list(manager.rooms.keys()):
            manager.rooms.get(room_name, set()).discard(user_id)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.is_development,
    )
