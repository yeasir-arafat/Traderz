from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
from uuid import UUID

from app.models.user import User, UserRole, AuthProvider
from app.models.user_session import UserSession
from app.models.password_reset import PasswordReset, EmailChange
from app.models.platform_config import PlatformConfig
from app.core.security import (
    get_password_hash, verify_password, validate_password,
    create_access_token, create_refresh_token,
    generate_token, hash_token, verify_token_hash
)
from app.core.firebase import verify_firebase_token
from app.core.errors import AppException
from app.core.responses import ErrorCodes
from app.schemas.auth import (
    RegisterRequest, LoginRequest, FirebaseAuthRequest,
    CompleteProfileRequest, UserResponse, AuthResponse
)


async def get_current_terms_version(db: AsyncSession) -> Tuple[str, str]:
    """Get current terms and privacy versions from config"""
    terms_q = await db.execute(
        select(PlatformConfig).where(PlatformConfig.key == "terms_version")
    )
    terms = terms_q.scalar_one_or_none()
    
    privacy_q = await db.execute(
        select(PlatformConfig).where(PlatformConfig.key == "privacy_version")
    )
    privacy = privacy_q.scalar_one_or_none()
    
    return (
        terms.value if terms else "v1.0",
        privacy.value if privacy else "v1.0"
    )


async def register_user(db: AsyncSession, data: RegisterRequest) -> AuthResponse:
    """Register new user with email/password"""
    # Validate password
    valid, msg = validate_password(data.password)
    if not valid:
        raise AppException(ErrorCodes.VALIDATION_ERROR, msg)
    
    # Check terms acceptance
    if not data.terms_accepted:
        raise AppException(ErrorCodes.VALIDATION_ERROR, "You must accept the terms and conditions")
    
    # Check username exists
    existing_username = await db.execute(
        select(User).where(User.username == data.username.lower())
    )
    if existing_username.scalar_one_or_none():
        raise AppException(ErrorCodes.CONFLICT, "Username already taken", field_errors={"username": "Username already taken"})
    
    # Check email exists
    existing_email = await db.execute(
        select(User).where(User.email == data.email.lower())
    )
    if existing_email.scalar_one_or_none():
        raise AppException(ErrorCodes.CONFLICT, "Email already registered", field_errors={"email": "Email already registered"})
    
    # Get current terms version
    terms_ver, privacy_ver = await get_current_terms_version(db)
    
    # Create user
    user = User(
        username=data.username.lower(),
        email=data.email.lower(),
        password_hash=get_password_hash(data.password),
        full_name=data.full_name,
        phone_number=data.phone_number,
        address_line1=data.address_line1,
        address_line2=data.address_line2,
        city=data.city,
        state=data.state,
        country=data.country,
        postal_code=data.postal_code,
        roles=["buyer"],
        auth_provider=AuthProvider.EMAIL,
        terms_accepted=True,
        terms_accepted_at=datetime.now(timezone.utc),
        terms_version=terms_ver,
        privacy_version=privacy_ver,
        profile_completed=True
    )
    
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    # Create tokens
    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})
    
    # Store refresh token
    session = UserSession(
        user_id=user.id,
        refresh_token_hash=hash_token(refresh_token),
        expires_at=datetime.now(timezone.utc) + timedelta(days=7)
    )
    db.add(session)
    await db.commit()
    
    return AuthResponse(
        user=UserResponse.model_validate(user),
        access_token=access_token,
        refresh_token=refresh_token
    )


async def login_user(db: AsyncSession, data: LoginRequest) -> AuthResponse:
    """Login with email/password"""
    result = await db.execute(
        select(User).where(User.email == data.email.lower())
    )
    user = result.scalar_one_or_none()
    
    if not user or not user.password_hash:
        raise AppException(ErrorCodes.AUTHENTICATION_ERROR, "Invalid email or password", 401)
    
    if not verify_password(data.password, user.password_hash):
        raise AppException(ErrorCodes.AUTHENTICATION_ERROR, "Invalid email or password", 401)
    
    if not user.is_active:
        raise AppException(ErrorCodes.AUTHENTICATION_ERROR, "Account is disabled", 401)
    
    # Check terms acceptance
    terms_ver, privacy_ver = await get_current_terms_version(db)
    needs_terms = not user.terms_accepted or user.terms_version != terms_ver
    
    # Update last login
    user.last_login_at = datetime.now(timezone.utc)
    
    # Create tokens
    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})
    
    # Store refresh token
    session = UserSession(
        user_id=user.id,
        refresh_token_hash=hash_token(refresh_token),
        expires_at=datetime.now(timezone.utc) + timedelta(days=7)
    )
    db.add(session)
    await db.commit()
    
    return AuthResponse(
        user=UserResponse.model_validate(user),
        access_token=access_token,
        refresh_token=refresh_token,
        needs_terms_acceptance=needs_terms
    )


async def firebase_auth(db: AsyncSession, data: FirebaseAuthRequest) -> AuthResponse:
    """Handle Firebase social login"""
    # Verify Firebase token
    decoded = verify_firebase_token(data.id_token)
    if not decoded:
        raise AppException(ErrorCodes.AUTHENTICATION_ERROR, "Invalid Firebase token", 401)
    
    firebase_uid = decoded.get("uid")
    email = decoded.get("email")
    name = decoded.get("name", "")
    provider = decoded.get("firebase", {}).get("sign_in_provider", "google.com")
    
    # Determine auth provider
    auth_provider = AuthProvider.GOOGLE if "google" in provider else AuthProvider.FACEBOOK
    
    # Check if user exists by firebase_uid
    result = await db.execute(
        select(User).where(User.firebase_uid == firebase_uid)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        # Check if email exists
        result = await db.execute(
            select(User).where(User.email == email.lower())
        )
        existing_user = result.scalar_one_or_none()
        
        if existing_user:
            # Link firebase to existing account
            existing_user.firebase_uid = firebase_uid
            existing_user.auth_provider = auth_provider
            user = existing_user
        else:
            # New user - return needs_profile_completion
            return AuthResponse(
                user=None,
                access_token="",
                needs_profile_completion=True,
                needs_terms_acceptance=True,
                firebase_data={
                    "uid": firebase_uid,
                    "email": email,
                    "name": name,
                    "provider": auth_provider.value
                }
            )
    
    if not user.is_active:
        raise AppException(ErrorCodes.AUTHENTICATION_ERROR, "Account is disabled", 401)
    
    # Check profile completion
    if not user.profile_completed:
        return AuthResponse(
            user=UserResponse.model_validate(user),
            access_token="",
            needs_profile_completion=True,
            needs_terms_acceptance=not user.terms_accepted
        )
    
    # Check terms
    terms_ver, privacy_ver = await get_current_terms_version(db)
    needs_terms = not user.terms_accepted or user.terms_version != terms_ver
    
    # Update last login
    user.last_login_at = datetime.now(timezone.utc)
    
    # Create tokens
    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})
    
    # Store refresh token
    session = UserSession(
        user_id=user.id,
        refresh_token_hash=hash_token(refresh_token),
        expires_at=datetime.now(timezone.utc) + timedelta(days=7)
    )
    db.add(session)
    await db.commit()
    
    return AuthResponse(
        user=UserResponse.model_validate(user),
        access_token=access_token,
        refresh_token=refresh_token,
        needs_terms_acceptance=needs_terms
    )


async def complete_profile(
    db: AsyncSession,
    firebase_uid: str,
    email: str,
    provider: str,
    data: CompleteProfileRequest
) -> AuthResponse:
    """Complete profile for social login users"""
    if not data.terms_accepted:
        raise AppException(ErrorCodes.VALIDATION_ERROR, "You must accept the terms and conditions")
    
    # Check username exists
    existing = await db.execute(
        select(User).where(User.username == data.username.lower())
    )
    if existing.scalar_one_or_none():
        raise AppException(ErrorCodes.CONFLICT, "Username already taken", field_errors={"username": "Username already taken"})
    
    # Get current terms version
    terms_ver, privacy_ver = await get_current_terms_version(db)
    
    # Create user
    user = User(
        username=data.username.lower(),
        email=email.lower(),
        full_name=data.full_name,
        phone_number=data.phone_number,
        address_line1=data.address_line1,
        address_line2=data.address_line2,
        city=data.city,
        state=data.state,
        country=data.country,
        postal_code=data.postal_code,
        roles=["buyer"],
        auth_provider=AuthProvider(provider),
        firebase_uid=firebase_uid,
        terms_accepted=True,
        terms_accepted_at=datetime.now(timezone.utc),
        terms_version=terms_ver,
        privacy_version=privacy_ver,
        profile_completed=True
    )
    
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    # Create tokens
    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})
    
    # Store refresh token
    session = UserSession(
        user_id=user.id,
        refresh_token_hash=hash_token(refresh_token),
        expires_at=datetime.now(timezone.utc) + timedelta(days=7)
    )
    db.add(session)
    await db.commit()
    
    return AuthResponse(
        user=UserResponse.model_validate(user),
        access_token=access_token,
        refresh_token=refresh_token
    )


async def accept_terms(db: AsyncSession, user: User) -> User:
    """Accept terms and conditions"""
    terms_ver, privacy_ver = await get_current_terms_version(db)
    
    user.terms_accepted = True
    user.terms_accepted_at = datetime.now(timezone.utc)
    user.terms_version = terms_ver
    user.privacy_version = privacy_ver
    
    await db.commit()
    await db.refresh(user)
    return user


async def get_user_by_id(db: AsyncSession, user_id: UUID) -> Optional[User]:
    """Get user by ID"""
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    return result.scalar_one_or_none()


async def change_password(db: AsyncSession, user: User, current_password: str, new_password: str) -> bool:
    """Change user password"""
    if not user.password_hash or not verify_password(current_password, user.password_hash):
        raise AppException(ErrorCodes.AUTHENTICATION_ERROR, "Current password is incorrect", 400)
    
    valid, msg = validate_password(new_password)
    if not valid:
        raise AppException(ErrorCodes.VALIDATION_ERROR, msg)
    
    user.password_hash = get_password_hash(new_password)
    await db.commit()
    return True


async def request_password_reset(db: AsyncSession, email: str, frontend_url: str = "https://account-exchange-3.preview.emergentagent.com") -> bool:
    """Request password reset (always returns success to prevent enumeration)"""
    from app.services.email_service import send_password_reset_email
    
    result = await db.execute(
        select(User).where(User.email == email.lower())
    )
    user = result.scalar_one_or_none()
    
    if user and user.password_hash:  # Only for email auth users
        token = generate_token()
        reset = PasswordReset(
            user_id=user.id,
            token_hash=hash_token(token),
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1)
        )
        db.add(reset)
        await db.commit()
        
        # Send password reset email
        try:
            send_password_reset_email(user.email, token, frontend_url)
        except Exception as e:
            print(f"Failed to send password reset email: {e}")
    
    return True


async def reset_password(db: AsyncSession, token: str, new_password: str) -> bool:
    """Reset password with token"""
    valid, msg = validate_password(new_password)
    if not valid:
        raise AppException(ErrorCodes.VALIDATION_ERROR, msg)
    
    # Find valid reset token
    result = await db.execute(
        select(PasswordReset).where(
            and_(
                PasswordReset.used_at.is_(None),
                PasswordReset.expires_at > datetime.now(timezone.utc)
            )
        ).order_by(PasswordReset.created_at.desc())
    )
    resets = result.scalars().all()
    
    for reset in resets:
        if verify_token_hash(token, reset.token_hash):
            # Get user
            user_result = await db.execute(
                select(User).where(User.id == reset.user_id)
            )
            user = user_result.scalar_one_or_none()
            
            if user:
                user.password_hash = get_password_hash(new_password)
                reset.used_at = datetime.now(timezone.utc)
                await db.commit()
                return True
    
    raise AppException(ErrorCodes.VALIDATION_ERROR, "Invalid or expired reset token")
