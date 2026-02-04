from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.responses import success_response
from app.api.deps import get_current_user, require_admin, require_admin_scope
from app.models.user import User
from app.services import kyc_service
from app.schemas.misc import KycSubmitRequest, KycReviewRequest, KycSubmissionResponse


router = APIRouter(prefix="/kyc", tags=["KYC"])

def _normalize_doc_type(value: str) -> str:
    """Map frontend doc_type values to backend KycDocType enum values."""
    m = {"national_id": "nid", "driving_license": "driving_licence"}
    return m.get(value, value)


@router.post("")
async def submit_kyc(
    data: KycSubmitRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Submit KYC documents"""
    doc_type = _normalize_doc_type(data.doc_type)
    submission = await kyc_service.submit_kyc(
        db, user, doc_type, data.doc_front_url, data.doc_back_url, data.selfie_url
    )
    return success_response(KycSubmissionResponse.model_validate(submission).model_dump())


@router.get("/my")
async def get_my_kyc(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get my KYC status"""
    submission = await kyc_service.get_user_kyc(db, user.id)
    if submission:
        return success_response(KycSubmissionResponse.model_validate(submission).model_dump())
    return success_response({"status": "not_submitted"})


@router.get("/admin/pending")
async def get_pending_kyc(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get pending KYC submissions (admin)"""
    result = await kyc_service.get_pending_kyc(db, page, page_size)
    return success_response(result.model_dump())


@router.post("/admin/{submission_id}/review")
async def review_kyc(
    submission_id: str,
    data: KycReviewRequest,
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Review KYC submission (admin)"""
    from uuid import UUID
    submission = await kyc_service.review_kyc(
        db, UUID(submission_id), user.id, data.approved, data.review_note
    )
    return success_response(KycSubmissionResponse.model_validate(submission).model_dump())
