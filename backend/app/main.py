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

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
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


from fastapi import WebSocket, WebSocketDisconnect
from app.websocket.manager import manager

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(websocket, client_id)
    try:
        while True:
            data = await websocket.receive_text()
            # For now, we only push data from the server, client just listens
    except WebSocketDisconnect:
        manager.disconnect(websocket, client_id)



if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.is_development,
    )
