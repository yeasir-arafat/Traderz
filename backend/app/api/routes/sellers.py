from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from uuid import UUID

from app.core.database import get_db
from app.core.responses import success_response
from app.api.deps import get_current_user
from app.models.user import User
from app.services import user_service


router = APIRouter(prefix="/sellers", tags=["Sellers"])


@router.get("/{seller_id}")
async def get_seller_profile(
    seller_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get public seller profile"""
    profile = await user_service.get_seller_profile(db, seller_id)
    return success_response(profile)
