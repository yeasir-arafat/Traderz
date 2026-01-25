from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.responses import success_response
from app.api.deps import get_current_user
from app.models.user import User
from app.services import auth_service
from app.schemas.auth import (
    RegisterRequest, LoginRequest, FirebaseAuthRequest,
    CompleteProfileRequest, PasswordForgotRequest, PasswordResetRequest,
    PasswordChangeRequest, AcceptTermsRequest, AuthResponse, UserResponse
)


router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register")
async def register(data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Register new user with email/password"""
    result = await auth_service.register_user(db, data)
    return success_response(result.model_dump())


@router.post("/login")
async def login(data: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    """Login with email/password"""
    result = await auth_service.login_user(db, data)
    
    # Set refresh token in httpOnly cookie
    if hasattr(result, 'refresh_token') and result.refresh_token:
        response.set_cookie(
            key="refresh_token",
            value=result.refresh_token,
            httponly=True,
            secure=True,
            samesite="lax",
            max_age=7 * 24 * 60 * 60  # 7 days
        )
    
    return success_response(result.model_dump(exclude={"refresh_token"}))


@router.post("/firebase")
async def firebase_auth(data: FirebaseAuthRequest, response: Response, db: AsyncSession = Depends(get_db)):
    """Authenticate with Firebase (Google/Facebook)"""
    result = await auth_service.firebase_auth(db, data)
    
    if result.access_token and hasattr(result, 'refresh_token') and result.refresh_token:
        response.set_cookie(
            key="refresh_token",
            value=result.refresh_token,
            httponly=True,
            secure=True,
            samesite="lax",
            max_age=7 * 24 * 60 * 60
        )
    
    return success_response(result.model_dump(exclude={"refresh_token"}))


@router.post("/complete-profile")
async def complete_profile(
    data: CompleteProfileRequest,
    firebase_uid: str,
    email: str,
    provider: str,
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    """Complete profile for social login users"""
    result = await auth_service.complete_profile(db, firebase_uid, email, provider, data)
    
    if hasattr(result, 'refresh_token') and result.refresh_token:
        response.set_cookie(
            key="refresh_token",
            value=result.refresh_token,
            httponly=True,
            secure=True,
            samesite="lax",
            max_age=7 * 24 * 60 * 60
        )
    
    return success_response(result.model_dump(exclude={"refresh_token"}))


@router.post("/accept-terms")
async def accept_terms(
    data: AcceptTermsRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Accept terms and conditions"""
    updated_user = await auth_service.accept_terms(db, user)
    return success_response(UserResponse.model_validate(updated_user).model_dump())


@router.post("/password/forgot")
async def forgot_password(data: PasswordForgotRequest, db: AsyncSession = Depends(get_db)):
    """Request password reset"""
    await auth_service.request_password_reset(db, data.email)
    return success_response({"message": "If the email exists, a reset link has been sent"})


@router.post("/password/reset")
async def reset_password(data: PasswordResetRequest, db: AsyncSession = Depends(get_db)):
    """Reset password with token"""
    await auth_service.reset_password(db, data.token, data.new_password)
    return success_response({"message": "Password reset successful"})


@router.post("/password/change")
async def change_password(
    data: PasswordChangeRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Change password"""
    await auth_service.change_password(db, user, data.current_password, data.new_password)
    return success_response({"message": "Password changed successfully"})


@router.get("/me")
async def get_me(user: User = Depends(get_current_user)):
    """Get current user profile"""
    return success_response(UserResponse.model_validate(user).model_dump())


@router.post("/logout")
async def logout(response: Response):
    """Logout user"""
    response.delete_cookie("refresh_token")
    return success_response({"message": "Logged out successfully"})
