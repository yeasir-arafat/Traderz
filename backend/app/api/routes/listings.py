from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from uuid import UUID

from app.core.database import get_db
from app.core.responses import success_response
from app.api.deps import get_current_user, require_seller, require_admin, require_admin_scope
from app.models.user import User
from app.services import listing_service
from app.schemas.listing import ListingCreate, ListingUpdate, ListingApproval, ListingResponse


router = APIRouter(prefix="/listings", tags=["Listings"])


@router.post("")
async def create_listing(
    data: ListingCreate,
    user: User = Depends(require_seller),
    db: AsyncSession = Depends(get_db)
):
    """Create new listing (seller only, KYC required)"""
    listing = await listing_service.create_listing(db, user, data)
    return success_response(ListingResponse.model_validate(listing).model_dump())


@router.get("")
async def get_listings(
    game_id: Optional[UUID] = None,
    platform: Optional[str] = None,
    region: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """Browse listings"""
    result = await listing_service.get_listings(
        db, game_id=game_id, platform=platform, region=region,
        min_price=min_price, max_price=max_price, search=search,
        page=page, page_size=page_size
    )
    return success_response(result.model_dump())


@router.get("/my")
async def get_my_listings(
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(require_seller),
    db: AsyncSession = Depends(get_db)
):
    """Get seller's listings"""
    result = await listing_service.get_listings(
        db, seller_id=user.id, status=status, page=page, page_size=page_size
    )
    return success_response(result.model_dump())


@router.get("/{listing_id}")
async def get_listing(
    listing_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get listing details"""
    listing = await listing_service.get_listing(db, listing_id, increment_views=True)
    return success_response(ListingResponse.model_validate(listing).model_dump())


@router.put("/{listing_id}")
async def update_listing(
    listing_id: UUID,
    data: ListingUpdate,
    user: User = Depends(require_seller),
    db: AsyncSession = Depends(get_db)
):
    """Update listing"""
    listing = await listing_service.update_listing(db, listing_id, user.id, data)
    return success_response(ListingResponse.model_validate(listing).model_dump())


@router.delete("/{listing_id}")
async def delete_listing(
    listing_id: UUID,
    user: User = Depends(require_seller),
    db: AsyncSession = Depends(get_db)
):
    """Delete listing"""
    await listing_service.delete_listing(db, listing_id, user.id)
    return success_response({"message": "Listing deleted"})


@router.get("/admin/pending")
async def get_pending_listings(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(require_admin_scope("LISTINGS_REVIEW")),
    db: AsyncSession = Depends(get_db)
):
    """Get pending listings for approval (admin). Requires LISTINGS_REVIEW scope."""
    result = await listing_service.get_pending_listings(db, page, page_size)
    return success_response(result.model_dump())


@router.post("/admin/{listing_id}/review")
async def review_listing(
    listing_id: UUID,
    data: ListingApproval,
    user: User = Depends(require_admin_scope("LISTINGS_REVIEW")),
    db: AsyncSession = Depends(get_db)
):
    """Approve or reject listing (admin). Requires LISTINGS_REVIEW scope."""
    listing = await listing_service.approve_listing(
        db, listing_id, user.id, data.approved, data.rejection_reason
    )
    return success_response(ListingResponse.model_validate(listing).model_dump())
