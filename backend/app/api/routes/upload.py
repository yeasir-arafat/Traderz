from fastapi import APIRouter, UploadFile, File, Depends
from sqlalchemy.ext.asyncio import AsyncSession
import aiofiles
import os
from uuid import uuid4
from io import BytesIO
import logging

from app.core.config import settings
from app.core.database import get_db
from app.core.responses import success_response
from app.api.deps import get_current_user
from app.models.user import User
from app.core.errors import AppException
from app.core.responses import ErrorCodes

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/upload", tags=["Upload"])

# Allowed extensions and MIME types: jpg, png, jpeg, heif, webp
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".heif", ".heic"}
ALLOWED_MIME_TYPES = {
    "image/jpeg", "image/jpg", "image/png", "image/webp", "image/heif", "image/heic"
}
ALLOWED_TYPES_HINT = "jpg, png, jpeg, heif, webp"
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB


def validate_image_content(content: bytes, filename: str, ext: str) -> bool:
    """
    Validate image content. Uses Pillow for common formats.
    HEIF/HEIC: Pillow may not support; we allow if extension and MIME passed.
    """
    ext_lower = ext.lower()
    if ext_lower in (".heif", ".heic"):
        # HEIF: Pillow doesn't support by default; trust extension + MIME checks
        return True
    try:
        from PIL import Image
        img = Image.open(BytesIO(content))
        img.verify()
        return True
    except Exception as e:
        logger.warning(f"Image validation failed for {filename}: {e}")
        return False


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


@router.post("/chat")
async def upload_chat_attachment(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user)
):
    """Upload chat attachment (any file type allowed for support chats)"""
    return await _upload_any_file(file, "chat", str(user.id))


async def _upload_file(file: UploadFile, folder: str, user_id: str):
    """Generic file upload handler with security validations"""
    
    # 1. Check file extension
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise AppException(
            "INVALID_FILE",
            f"Invalid file type. Image type can be: {ALLOWED_TYPES_HINT}."
        )
    
    # 2. Check MIME type from upload headers
    content_type = file.content_type or ""
    if content_type not in ALLOWED_MIME_TYPES:
        raise AppException(
            "INVALID_FILE",
            f"Invalid image file. Image type can be: {ALLOWED_TYPES_HINT}."
        )
    
    # 3. Read content and check size
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise AppException(
            "INVALID_FILE",
            f"File too large. Maximum size: {MAX_FILE_SIZE // (1024*1024)}MB"
        )
    
    if len(content) == 0:
        raise AppException(
            "INVALID_FILE",
            "Empty file not allowed."
        )
    
    # 4. Validate actual image content using Pillow (or allow HEIF by ext+MIME)
    if not validate_image_content(content, file.filename or "unknown", ext):
        raise AppException(
            "INVALID_FILE",
            f"Invalid image file. Image type can be: {ALLOWED_TYPES_HINT}."
        )
    
    # 5. Generate unique filename and save
    filename = f"{user_id}_{uuid4().hex}{ext}"
    filepath = os.path.join(settings.UPLOAD_DIR, folder, filename)
    
    # Ensure directory exists
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    
    # Save file
    async with aiofiles.open(filepath, 'wb') as f:
        await f.write(content)
    
    # Return URL
    url = f"/uploads/{folder}/{filename}"
    
    logger.info(f"File uploaded: {url} by user {user_id}")
    return success_response({"url": url, "filename": filename})
