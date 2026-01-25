from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text

from app.core.database import get_db
from app.core.responses import success_response


router = APIRouter(prefix="/health", tags=["Health"])


@router.get("")
async def health_check():
    """Basic health check"""
    return success_response({"status": "healthy"})


@router.get("/db")
async def db_health_check(db: AsyncSession = Depends(get_db)):
    """Database health check"""
    try:
        await db.execute(text("SELECT 1"))
        return success_response({"status": "healthy", "database": "connected"})
    except Exception as e:
        return success_response({"status": "unhealthy", "database": str(e)})
