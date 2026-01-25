from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.exceptions import RequestValidationError
from starlette.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
import logging

from app.core.config import settings
from app.core.database import engine, init_db
from app.core.firebase import init_firebase
from app.core.logging import setup_logging
from app.core.errors import (
    AppException, app_exception_handler,
    validation_exception_handler, generic_exception_handler
)

# Import all routes
from app.api.routes import (
    auth, users, sellers, listings, orders, wallet,
    chats, notifications, kyc, games, giftcards, faq,
    config_routes, admin, superadmin, health, reviews, upload
)

setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting PlayTraderz API...")
    
    # Initialize Firebase
    try:
        init_firebase()
    except Exception as e:
        logger.error(f"Firebase init failed: {e}")
    
    # Initialize database
    try:
        await init_db()
        logger.info("Database initialized")
    except Exception as e:
        logger.error(f"Database init failed: {e}")
    
    # Run seed if needed
    try:
        from scripts.seed import run_seed
        await run_seed()
    except Exception as e:
        logger.error(f"Seed failed: {e}")
    
    yield
    
    # Shutdown
    logger.info("Shutting down...")
    await engine.dispose()


app = FastAPI(
    title="PlayTraderz API",
    description="Game Account Marketplace API",
    version="1.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS.split(",") if settings.CORS_ORIGINS != "*" else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception handlers
app.add_exception_handler(AppException, app_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)

# Mount uploads directory
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# Include all routers under /api prefix
api_prefix = "/api"

app.include_router(health.router, prefix=api_prefix)
app.include_router(auth.router, prefix=api_prefix)
app.include_router(users.router, prefix=api_prefix)
app.include_router(sellers.router, prefix=api_prefix)
app.include_router(listings.router, prefix=api_prefix)
app.include_router(orders.router, prefix=api_prefix)
app.include_router(wallet.router, prefix=api_prefix)
app.include_router(chats.router, prefix=api_prefix)
app.include_router(notifications.router, prefix=api_prefix)
app.include_router(kyc.router, prefix=api_prefix)
app.include_router(games.router, prefix=api_prefix)
app.include_router(giftcards.router, prefix=api_prefix)
app.include_router(faq.router, prefix=api_prefix)
app.include_router(config_routes.router, prefix=api_prefix)
app.include_router(reviews.router, prefix=api_prefix)
app.include_router(upload.router, prefix=api_prefix)
app.include_router(admin.router, prefix=api_prefix)
app.include_router(superadmin.router, prefix=api_prefix)


@app.get("/api/")
async def root():
    return {"success": True, "data": {"message": "PlayTraderz API v1.0"}}
