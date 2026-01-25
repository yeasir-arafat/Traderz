from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.core.database import get_db
from app.core.responses import success_response
from app.api.deps import get_current_user
from app.models.user import User
from app.services import notification_service
from app.schemas.misc import NotificationResponse


router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("")
async def get_notifications(
    unread_only: bool = False,
    limit: int = Query(50, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get user notifications"""
    result = await notification_service.get_notifications(db, user.id, unread_only, limit)
    return success_response(result.model_dump())


@router.post("/{notification_id}/read")
async def mark_read(
    notification_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Mark notification as read"""
    notification = await notification_service.mark_notification_read(db, notification_id, user.id)
    return success_response(NotificationResponse.model_validate(notification).model_dump())


@router.post("/read-all")
async def mark_all_read(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Mark all notifications as read"""
    count = await notification_service.mark_all_read(db, user.id)
    return success_response({"marked_count": count})
