from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.responses import success_response
from app.api.deps import require_admin
from app.models.user import User
from app.models.faq import FAQ
from app.core.errors import AppException
from app.core.responses import ErrorCodes
from app.schemas.misc import FAQCreate, FAQUpdate, FAQResponse


router = APIRouter(prefix="/faq", tags=["FAQ"])


@router.get("")
async def get_faqs(
    category: str = None,
    db: AsyncSession = Depends(get_db)
):
    """Get public FAQs"""
    query = select(FAQ).where(FAQ.is_active == True)
    if category:
        query = query.where(FAQ.category == category)
    query = query.order_by(FAQ.display_order, FAQ.created_at)
    
    result = await db.execute(query)
    faqs = result.scalars().all()
    
    return success_response({
        "faqs": [FAQResponse.model_validate(f).model_dump() for f in faqs]
    })


@router.post("")
async def create_faq(
    data: FAQCreate,
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Create FAQ (admin)"""
    faq = FAQ(**data.model_dump())
    db.add(faq)
    await db.commit()
    await db.refresh(faq)
    return success_response(FAQResponse.model_validate(faq).model_dump())


@router.put("/{faq_id}")
async def update_faq(
    faq_id: str,
    data: FAQUpdate,
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Update FAQ (admin)"""
    from uuid import UUID
    result = await db.execute(select(FAQ).where(FAQ.id == UUID(faq_id)))
    faq = result.scalar_one_or_none()
    if not faq:
        raise AppException(ErrorCodes.NOT_FOUND, "FAQ not found", 404)
    
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(faq, key, value)
    
    await db.commit()
    await db.refresh(faq)
    return success_response(FAQResponse.model_validate(faq).model_dump())


@router.delete("/{faq_id}")
async def delete_faq(
    faq_id: str,
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Delete FAQ (admin)"""
    from uuid import UUID
    result = await db.execute(select(FAQ).where(FAQ.id == UUID(faq_id)))
    faq = result.scalar_one_or_none()
    if not faq:
        raise AppException(ErrorCodes.NOT_FOUND, "FAQ not found", 404)
    
    await db.delete(faq)
    await db.commit()
    return success_response({"message": "FAQ deleted"})
