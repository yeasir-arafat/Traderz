from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional, List
from uuid import UUID
from datetime import datetime, timezone

from app.models.notification import Notification, NotificationType
from app.core.errors import AppException
from app.core.responses import ErrorCodes
from app.schemas.misc import NotificationResponse, NotificationListResponse


async def create_notification(
    db: AsyncSession,
    user_id: UUID,
    notification_type: NotificationType,
    title: str,
    message: str,
    order_id: Optional[UUID] = None,
    listing_id: Optional[UUID] = None,
    conversation_id: Optional[UUID] = None
) -> Notification:
    """Create notification for user"""
    notification = Notification(
        user_id=user_id,
        notification_type=notification_type,
        title=title,
        message=message,
        order_id=order_id,
        listing_id=listing_id,
        conversation_id=conversation_id
    )
    
    db.add(notification)
    await db.commit()
    await db.refresh(notification)
    return notification


async def get_notifications(
    db: AsyncSession,
    user_id: UUID,
    unread_only: bool = False,
    limit: int = 50
) -> NotificationListResponse:
    """Get user notifications"""
    query = select(Notification).where(Notification.user_id == user_id)
    
    if unread_only:
        query = query.where(Notification.is_read == False)
    
    query = query.order_by(Notification.created_at.desc()).limit(limit)
    
    result = await db.execute(query)
    notifications = result.scalars().all()
    
    # Count unread
    unread_result = await db.execute(
        select(func.count(Notification.id)).where(
            Notification.user_id == user_id,
            Notification.is_read == False
        )
    )
    unread_count = unread_result.scalar() or 0
    
    return NotificationListResponse(
        notifications=[NotificationResponse.model_validate(n) for n in notifications],
        total=len(notifications),
        unread_count=unread_count
    )


async def mark_notification_read(
    db: AsyncSession,
    notification_id: UUID,
    user_id: UUID
) -> Notification:
    """Mark notification as read"""
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == user_id
        )
    )
    notification = result.scalar_one_or_none()
    
    if not notification:
        raise AppException(ErrorCodes.NOT_FOUND, "Notification not found", 404)
    
    notification.is_read = True
    notification.read_at = datetime.now(timezone.utc)
    
    await db.commit()
    await db.refresh(notification)
    return notification


async def mark_all_read(db: AsyncSession, user_id: UUID) -> int:
    """Mark all notifications as read"""
    result = await db.execute(
        select(Notification).where(
            Notification.user_id == user_id,
            Notification.is_read == False
        )
    )
    notifications = result.scalars().all()
    
    now = datetime.now(timezone.utc)
    for n in notifications:
        n.is_read = True
        n.read_at = now
    
    await db.commit()
    return len(notifications)
