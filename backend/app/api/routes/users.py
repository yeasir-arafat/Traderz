from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.responses import success_response
from app.api.deps import get_current_user, require_terms_accepted
from app.models.user import User
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
