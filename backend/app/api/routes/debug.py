"""Debug endpoints - only available in development"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.responses import success_response
from app.core.config import settings
from app.jobs.scheduler import get_job_info, auto_complete_orders_job, release_pending_earnings_job


router = APIRouter(prefix="/debug", tags=["Debug"])


@router.get("/jobs")
async def get_jobs_status():
    """Get background job scheduler status and next run times"""
    return success_response(get_job_info())


@router.post("/jobs/auto-complete/run")
async def trigger_auto_complete():
    """Manually trigger auto-complete orders job (dev only)"""
    await auto_complete_orders_job()
    return success_response({"message": "Job executed", "job": "auto_complete_orders"})


@router.post("/jobs/release-pending/run")
async def trigger_release_pending():
    """Manually trigger release pending earnings job (dev only)"""
    await release_pending_earnings_job()
    return success_response({"message": "Job executed", "job": "release_pending_earnings"})


@router.get("/config")
async def get_debug_config():
    """Get current configuration (non-sensitive)"""
    return success_response({
        "app_name": settings.APP_NAME,
        "debug": settings.DEBUG,
        "allowed_origins": settings.get_cors_origins(),
        "firebase_configured": bool(settings.FIREBASE_PROJECT_ID and settings.FIREBASE_CLIENT_EMAIL),
        "upload_dir": settings.UPLOAD_DIR,
        "max_file_size_mb": settings.MAX_FILE_SIZE // (1024 * 1024)
    })
