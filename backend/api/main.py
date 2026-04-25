"""
Narc Kart API - FastAPI Application Entry Point.
India Drug Seizure Tracker - Matrix/Military Intelligence Style.
"""

import asyncio
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from backend.database import init_db, close_db
from .routes import (
    seizures_router,
    stats_router,
    map_router,
    refresh_router,
)
from .models import HealthResponse

__version__ = "1.0.0"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for startup and shutdown events.
    Initializes database on startup, cleans up on shutdown.
    """
    # Startup
    await init_db()
    yield
    # Shutdown
    await close_db()


app = FastAPI(
    title="Narc Kart API",
    description=(
        "India Drug Seizure Tracker - Backend API. "
        "Provides seizure records, statistics, and map data "
        "for the Narc Kart intelligence platform."
    ),
    version=__version__,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)


# ─── CORS Configuration ────────────────────────────────────
# Allow frontend (Vite dev server), production Vercel, and Cloudflare tunnels
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",      # Vite dev
        "http://localhost:3000",      # React dev
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "https://dist-dbgpov1vu-aayushbhat07s-projects.vercel.app",
        "https://frontend-8fk4gwfgt-aayushbhat07s-projects.vercel.app",
        "https://dist-*.vercel.app",
        "https://*.trycloudflare.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


# ─── Exception Handlers ────────────────────────────────────

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError
):
    """Handle Pydantic validation errors with structured JSON response."""
    errors = []
    for error in exc.errors():
        loc = " -> ".join(str(l) for l in error["loc"])
        errors.append({
            "field": loc,
            "message": error["msg"],
            "type": error["type"],
        })

    return JSONResponse(
        status_code=422,
        content={
            "error": "VALIDATION_ERROR",
            "message": "Request validation failed",
            "errors": errors,
            "body": str(exc.body) if hasattr(exc, "body") else None,
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(
    request: Request,
    exc: Exception
):
    """Catch-all handler for unexpected server errors."""
    return JSONResponse(
        status_code=500,
        content={
            "error": "INTERNAL_SERVER_ERROR",
            "message": str(exc),
            "type": type(exc).__name__,
        }
    )


# ─── Routes ────────────────────────────────────────────────

app.include_router(seizures_router)
app.include_router(stats_router)
app.include_router(map_router)
app.include_router(refresh_router)

# Serve React frontend static files (must be last to not shadow API routes)
app.mount("/", StaticFiles(directory="frontend/dist", html=True), name="static")


@app.get("/", tags=["Root"])
async def root():
    """Root endpoint - API welcome message."""
    return {
        "name": "Narc Kart API",
        "version": __version__,
        "status": "operational",
        "docs": "/docs",
        "redoc": "/redoc",
        "message": "Narc Kart - India Drug Seizure Intelligence System",
    }


@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """Health check endpoint for monitoring."""
    return HealthResponse(
        status="ok",
        version=__version__,
        database="connected",
        timestamp=datetime.now(),
    )