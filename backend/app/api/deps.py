from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from uuid import UUID

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User
from app.core.errors import AppException
from app.core.responses import ErrorCodes


security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Get current authenticated user"""
    if not credentials:
        raise AppException(ErrorCodes.AUTHENTICATION_ERROR, "Not authenticated", 401)
    
    token = credentials.credentials
    payload = decode_access_token(token)
    
    if not payload:
        raise AppException(ErrorCodes.AUTHENTICATION_ERROR, "Invalid or expired token", 401)
    
    user_id = payload.get("sub")
    if not user_id:
        raise AppException(ErrorCodes.AUTHENTICATION_ERROR, "Invalid token", 401)
    
    result = await db.execute(
        select(User).where(User.id == UUID(user_id))
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise AppException(ErrorCodes.AUTHENTICATION_ERROR, "User not found", 401)
    
    if not user.is_active:
        raise AppException(ErrorCodes.AUTHENTICATION_ERROR, "Account is disabled", 401)
    
    return user


async def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> Optional[User]:
    """Get current user if authenticated, None otherwise"""
    if not credentials:
        return None
    
    try:
        return await get_current_user(credentials, db)
    except:
        return None


def require_roles(*roles: str):
    """Dependency to require specific roles"""
    async def check_roles(user: User = Depends(get_current_user)) -> User:
        if not any(role in user.roles for role in roles):
            raise AppException(ErrorCodes.AUTHORIZATION_ERROR, "Insufficient permissions", 403)
        return user
    return check_roles


def require_seller(user: User = Depends(get_current_user)) -> User:
    """Require seller role"""
    if "seller" not in user.roles:
        raise AppException(ErrorCodes.AUTHORIZATION_ERROR, "Seller access required", 403)
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    """Require admin or super_admin role"""
    if "admin" not in user.roles and "super_admin" not in user.roles:
        raise AppException(ErrorCodes.AUTHORIZATION_ERROR, "Admin access required", 403)
    return user


def require_super_admin(user: User = Depends(get_current_user)) -> User:
    """Require super_admin role"""
    if "super_admin" not in user.roles:
        raise AppException(ErrorCodes.AUTHORIZATION_ERROR, "Super admin access required", 403)
    return user


def require_terms_accepted(user: User = Depends(get_current_user)) -> User:
    """Require terms acceptance"""
    if not user.terms_accepted:
        raise AppException(ErrorCodes.TERMS_NOT_ACCEPTED, "Please accept terms and conditions", 403)
    return user
