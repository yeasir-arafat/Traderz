from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional

from app.core.database import get_db
from app.core.responses import success_response
from app.api.deps import get_current_user, require_terms_accepted
from app.models.user import User
from app.models.telegram_link import TelegramLink
from app.services import user_service
from app.schemas.auth import ProfileUpdateRequest, UserResponse


router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me")
async def get_profile(user: User = Depends(get_current_user)):
    """Get current user profile"""
    return success_response(UserResponse.model_validate(user).model_dump())


@router.put("/me")
async def update_profile(
    data: ProfileUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update user profile"""
    updated = await user_service.update_profile(db, user, data)
    return success_response(UserResponse.model_validate(updated).model_dump())


@router.post("/become-seller")
async def become_seller(
    user: User = Depends(require_terms_accepted),
    db: AsyncSession = Depends(get_db)
):
    """Add seller role to user"""
    updated = await user_service.become_seller(db, user)
    return success_response(UserResponse.model_validate(updated).model_dump())


@router.get("/seller/{username}")
async def get_seller_profile(
    username: str,
    db: AsyncSession = Depends(get_db)
):
    """Get public seller profile"""
    profile = await user_service.get_seller_public_profile(db, username)
    return success_response(profile)


@router.get("/me/telegram-status")
async def get_telegram_status(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Check whether the current user is linked to the Telegram bot.

    Logic:
    - If the user already has telegram_chat_id -> linked = True.
    - Else, if they have a telegram_username, try to find a matching
      record in the telegram_links table (created by the bot when the
      user sends /start). If found, copy chat_id onto the user so we
      can send future notifications.
    """
    # Already linked
    if user.telegram_chat_id:
        return success_response({"linked": True})

    if not user.telegram_username:
        return success_response({"linked": False})

    username = user.telegram_username.lstrip("@")

    result = await db.execute(
        select(TelegramLink).where(
            func.lower(TelegramLink.telegram_username) == username.lower()
        )
    )
    link = result.scalar_one_or_none()

    if not link:
        return success_response({"linked": False})

    # We found a TelegramLink for this username – persist chat_id on user
    user.telegram_chat_id = link.chat_id
    user.telegram_notifications_enabled = True
    await db.commit()

    return success_response({"linked": True})
