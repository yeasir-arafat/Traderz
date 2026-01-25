from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional, List
from uuid import UUID
from datetime import datetime, timezone

from app.models.kyc import KycSubmission, KycStatus, KycDocType
from app.models.user import User
from app.core.errors import AppException
from app.core.responses import ErrorCodes
from app.schemas.misc import KycSubmissionResponse, KycListResponse


async def submit_kyc(
    db: AsyncSession,
    user: User,
    doc_type: str,
    doc_front_url: str,
    doc_back_url: Optional[str] = None,
    selfie_url: Optional[str] = None
) -> KycSubmission:
    """Submit KYC documents"""
    # Check if user already has pending or approved KYC
    existing = await db.execute(
        select(KycSubmission).where(
            KycSubmission.user_id == user.id,
            KycSubmission.status.in_([KycStatus.PENDING, KycStatus.APPROVED])
        )
    )
    if existing.scalar_one_or_none():
        raise AppException(ErrorCodes.CONFLICT, "KYC already submitted or approved")
    
    submission = KycSubmission(
        user_id=user.id,
        doc_type=KycDocType(doc_type),
        doc_front_url=doc_front_url,
        doc_back_url=doc_back_url,
        selfie_url=selfie_url,
        status=KycStatus.PENDING
    )
    
    # Update user KYC status
    user.kyc_status = "pending"
    
    db.add(submission)
    await db.commit()
    await db.refresh(submission)
    return submission


async def get_user_kyc(db: AsyncSession, user_id: UUID) -> Optional[KycSubmission]:
    """Get user's latest KYC submission"""
    result = await db.execute(
        select(KycSubmission)
        .where(KycSubmission.user_id == user_id)
        .order_by(KycSubmission.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def review_kyc(
    db: AsyncSession,
    submission_id: UUID,
    admin_id: UUID,
    approved: bool,
    review_note: Optional[str] = None
) -> KycSubmission:
    """Admin reviews KYC submission"""
    result = await db.execute(
        select(KycSubmission).where(KycSubmission.id == submission_id)
    )
    submission = result.scalar_one_or_none()
    
    if not submission:
        raise AppException(ErrorCodes.NOT_FOUND, "KYC submission not found", 404)
    
    if submission.status != KycStatus.PENDING:
        raise AppException(ErrorCodes.VALIDATION_ERROR, "KYC already reviewed")
    
    # Get user
    user_result = await db.execute(
        select(User).where(User.id == submission.user_id)
    )
    user = user_result.scalar_one_or_none()
    
    if approved:
        submission.status = KycStatus.APPROVED
        if user:
            user.kyc_status = "approved"
            user.kyc_approved_at = datetime.now(timezone.utc)
    else:
        submission.status = KycStatus.REJECTED
        if user:
            user.kyc_status = "rejected"
    
    submission.review_note = review_note
    submission.reviewed_by = admin_id
    submission.reviewed_at = datetime.now(timezone.utc)
    
    await db.commit()
    await db.refresh(submission)
    return submission


async def get_pending_kyc(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 20
) -> KycListResponse:
    """Get pending KYC submissions for admin review"""
    query = select(KycSubmission).where(KycSubmission.status == KycStatus.PENDING)
    
    # Count
    count_result = await db.execute(
        select(func.count(KycSubmission.id)).where(KycSubmission.status == KycStatus.PENDING)
    )
    total = count_result.scalar() or 0
    
    # Paginate
    query = query.order_by(KycSubmission.created_at.asc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    
    result = await db.execute(query)
    submissions = result.scalars().all()
    
    return KycListResponse(
        submissions=[KycSubmissionResponse.model_validate(s) for s in submissions],
        total=total,
        page=page,
        page_size=page_size
    )
