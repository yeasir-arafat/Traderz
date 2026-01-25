from fastapi import APIRouter, UploadFile, File, Depends
from sqlalchemy.ext.asyncio import AsyncSession
import aiofiles
import os
from uuid import uuid4
from datetime import datetime

from app.core.config import settings
from app.core.database import get_db
from app.core.responses import success_response
from app.api.deps import get_current_user
from app.models.user import User
from app.core.errors import AppException
from app.core.responses import ErrorCodes


router = APIRouter(prefix="/upload", tags=["Upload"])


ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB


@router.post("/listing")
async def upload_listing_image(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user)
):
    """Upload listing image"""
    return await _upload_file(file, "listings", str(user.id))


@router.post("/kyc")
async def upload_kyc_document(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user)
):
    """Upload KYC document"""
    return await _upload_file(file, "kyc", str(user.id))


async def _upload_file(file: UploadFile, folder: str, user_id: str):
    """Generic file upload handler"""
    # Check extension
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise AppException(
            ErrorCodes.VALIDATION_ERROR,
            f"Invalid file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    
    # Check size
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise AppException(
            ErrorCodes.VALIDATION_ERROR,
            f"File too large. Maximum size: {MAX_FILE_SIZE // (1024*1024)}MB"
        )
    
    # Generate unique filename
    filename = f"{user_id}_{uuid4().hex}{ext}"
    filepath = os.path.join(settings.UPLOAD_DIR, folder, filename)
    
    # Ensure directory exists
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    
    # Save file
    async with aiofiles.open(filepath, 'wb') as f:
        await f.write(content)
    
    # Return URL
    url = f"/uploads/{folder}/{filename}"
    
    return success_response({"url": url, "filename": filename})
