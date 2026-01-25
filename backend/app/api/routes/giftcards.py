from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.responses import success_response
from app.api.deps import require_super_admin
from app.models.user import User
from app.models.giftcard import GiftCard
from app.core.errors import AppException
from app.core.responses import ErrorCodes
from app.schemas.misc import GiftCardCreate, GiftCardResponse


router = APIRouter(prefix="/giftcards", tags=["Gift Cards"])


@router.get("")
async def get_giftcards(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get all gift cards (super admin)"""
    from sqlalchemy import func
    
    count_result = await db.execute(select(func.count(GiftCard.id)))
    total = count_result.scalar() or 0
    
    result = await db.execute(
        select(GiftCard)
        .order_by(GiftCard.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    giftcards = result.scalars().all()
    
    return success_response({
        "giftcards": [GiftCardResponse.model_validate(g).model_dump() for g in giftcards],
        "total": total,
        "page": page,
        "page_size": page_size
    })


@router.post("")
async def create_giftcard(
    data: GiftCardCreate,
    user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Create gift card (super admin)"""
    # Check code unique
    existing = await db.execute(
        select(GiftCard).where(GiftCard.code == data.code)
    )
    if existing.scalar_one_or_none():
        raise AppException(ErrorCodes.CONFLICT, "Gift card code already exists")
    
    giftcard = GiftCard(
        code=data.code,
        amount_usd=data.amount_usd,
        expires_at=data.expires_at,
        created_by=user.id
    )
    db.add(giftcard)
    await db.commit()
    await db.refresh(giftcard)
    return success_response(GiftCardResponse.model_validate(giftcard).model_dump())


@router.delete("/{giftcard_id}")
async def deactivate_giftcard(
    giftcard_id: str,
    user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Deactivate gift card (super admin)"""
    from uuid import UUID
    result = await db.execute(select(GiftCard).where(GiftCard.id == UUID(giftcard_id)))
    giftcard = result.scalar_one_or_none()
    if not giftcard:
        raise AppException(ErrorCodes.NOT_FOUND, "Gift card not found", 404)
    
    giftcard.is_active = False
    await db.commit()
    return success_response({"message": "Gift card deactivated"})
