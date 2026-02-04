from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_
from sqlalchemy.orm import selectinload
from typing import Optional, List, Tuple
from uuid import UUID
from datetime import datetime, timezone

from app.models.listing import Listing, ListingStatus
from app.models.game import Game, GamePlatform
from app.models.user import User
from app.models.platform_config import PlatformConfig
from app.core.errors import AppException
from app.core.responses import ErrorCodes
from app.schemas.listing import (
    ListingCreate, ListingUpdate, ListingResponse, ListingListResponse
)


async def create_listing(db: AsyncSession, seller: User, data: ListingCreate) -> Listing:
    """Create new listing"""
    # Check if seller has KYC approved
    if seller.kyc_status != "approved":
        raise AppException(ErrorCodes.KYC_REQUIRED, "KYC verification required to create listings")
    
    # Verify game exists
    game_result = await db.execute(
        select(Game).where(Game.id == data.game_id, Game.is_active == True)
    )
    game = game_result.scalar_one_or_none()
    if not game:
        raise AppException(ErrorCodes.NOT_FOUND, "Game not found", 404)
    
    # Check auto-approve for trusted sellers
    auto_approve = False
    if seller.seller_level in ["silver", "gold", "platinum", "diamond"]:
        config_result = await db.execute(
            select(PlatformConfig).where(PlatformConfig.key == "trustedSellerAutoApprove")
        )
        config = config_result.scalar_one_or_none()
        auto_approve = config and config.value.lower() == "true"
    
    status = ListingStatus.APPROVED if auto_approve else ListingStatus.PENDING
    
    listing = Listing(
        seller_id=seller.id,
        game_id=data.game_id,
        title=data.title,
        description=data.description,
        price_usd=data.price_usd,
        platforms=data.platforms,
        regions=data.regions,
        account_level=data.account_level,
        account_rank=data.account_rank,
        account_features=data.account_features,
        images=data.images,
        status=status,
        auto_approved=auto_approve,
        approved_at=datetime.now(timezone.utc) if auto_approve else None
    )
    
    db.add(listing)
    await db.commit()
    
    # Re-fetch with relationships loaded to avoid async loading issues
    result = await db.execute(
        select(Listing)
        .options(selectinload(Listing.seller), selectinload(Listing.game))
        .where(Listing.id == listing.id)
    )
    return result.scalar_one()


async def update_listing(db: AsyncSession, listing_id: UUID, seller_id: UUID, data: ListingUpdate) -> Listing:
    """Update listing"""
    result = await db.execute(
        select(Listing).where(Listing.id == listing_id, Listing.seller_id == seller_id)
    )
    listing = result.scalar_one_or_none()
    
    if not listing:
        raise AppException(ErrorCodes.NOT_FOUND, "Listing not found", 404)
    
    if listing.status == ListingStatus.SOLD:
        raise AppException(ErrorCodes.VALIDATION_ERROR, "Cannot update sold listing")
    
    # Update fields
    if data.title is not None:
        listing.title = data.title
    if data.description is not None:
        listing.description = data.description
    if data.price_usd is not None:
        listing.price_usd = data.price_usd
    if data.platforms is not None:
        listing.platforms = data.platforms
    if data.regions is not None:
        listing.regions = data.regions
    if data.account_level is not None:
        listing.account_level = data.account_level
    if data.account_rank is not None:
        listing.account_rank = data.account_rank
    if data.account_features is not None:
        listing.account_features = data.account_features
    if data.images is not None:
        listing.images = data.images
    
    # If listing was rejected, set back to pending after update
    if listing.status == ListingStatus.REJECTED:
        listing.status = ListingStatus.PENDING
        listing.rejection_reason = None
    
    await db.commit()
    await db.refresh(listing)
    return listing


async def get_listing(db: AsyncSession, listing_id: UUID, increment_views: bool = False) -> Listing:
    """Get listing by ID"""
    result = await db.execute(
        select(Listing)
        .options(selectinload(Listing.seller), selectinload(Listing.game))
        .where(Listing.id == listing_id)
    )
    listing = result.scalar_one_or_none()
    
    if not listing:
        raise AppException(ErrorCodes.NOT_FOUND, "Listing not found", 404)
    
    if increment_views:
        listing.view_count += 1
        await db.commit()
    
    return listing


async def get_listings(
    db: AsyncSession,
    game_id: Optional[UUID] = None,
    platform: Optional[str] = None,
    region: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    search: Optional[str] = None,
    status: Optional[str] = None,
    seller_id: Optional[UUID] = None,
    page: int = 1,
    page_size: int = 20
) -> ListingListResponse:
    """Get listings with filters"""
    query = select(Listing).options(
        selectinload(Listing.seller),
        selectinload(Listing.game)
    )
    
    conditions = []
    
    # Default to approved for public browse
    if status:
        conditions.append(Listing.status == ListingStatus(status))
    elif not seller_id:
        conditions.append(Listing.status == ListingStatus.APPROVED)
    
    if game_id:
        conditions.append(Listing.game_id == game_id)
    if platform:
        conditions.append(Listing.platforms.contains([platform]))
    if region:
        conditions.append(Listing.regions.contains([region]))
    if min_price:
        conditions.append(Listing.price_usd >= min_price)
    if max_price:
        conditions.append(Listing.price_usd <= max_price)
    if search:
        conditions.append(
            or_(
                Listing.title.ilike(f"%{search}%"),
                Listing.description.ilike(f"%{search}%")
            )
        )
    if seller_id:
        conditions.append(Listing.seller_id == seller_id)
    
    if conditions:
        query = query.where(and_(*conditions))
    
    # Count total
    count_query = select(func.count(Listing.id))
    if conditions:
        count_query = count_query.where(and_(*conditions))
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0
    
    # Paginate
    query = query.order_by(Listing.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    
    result = await db.execute(query)
    listings = result.scalars().all()
    
    total_pages = (total + page_size - 1) // page_size
    
    return ListingListResponse(
        listings=[ListingResponse.model_validate(l) for l in listings],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


async def approve_listing(db: AsyncSession, listing_id: UUID, admin_id: UUID, approved: bool, rejection_reason: Optional[str] = None) -> Listing:
    """Approve or reject listing"""
    result = await db.execute(
        select(Listing).where(Listing.id == listing_id)
    )
    listing = result.scalar_one_or_none()
    
    if not listing:
        raise AppException(ErrorCodes.NOT_FOUND, "Listing not found", 404)
    
    if listing.status not in [ListingStatus.PENDING, ListingStatus.REJECTED]:
        raise AppException(ErrorCodes.VALIDATION_ERROR, "Listing is not pending approval")
    
    if approved:
        listing.status = ListingStatus.APPROVED
        listing.approved_at = datetime.now(timezone.utc)
        listing.approved_by = admin_id
        listing.rejection_reason = None
    else:
        if not rejection_reason:
            raise AppException(ErrorCodes.VALIDATION_ERROR, "Rejection reason required")
        listing.status = ListingStatus.REJECTED
        listing.rejection_reason = rejection_reason
    
    await db.commit()
    await db.refresh(listing)
    return listing


async def delete_listing(db: AsyncSession, listing_id: UUID, user_id: UUID) -> bool:
    """Delete listing (set to inactive)"""
    result = await db.execute(
        select(Listing).where(Listing.id == listing_id, Listing.seller_id == user_id)
    )
    listing = result.scalar_one_or_none()
    
    if not listing:
        raise AppException(ErrorCodes.NOT_FOUND, "Listing not found", 404)
    
    if listing.status == ListingStatus.SOLD:
        raise AppException(ErrorCodes.VALIDATION_ERROR, "Cannot delete sold listing")
    
    listing.status = ListingStatus.INACTIVE
    await db.commit()
    return True


async def get_pending_listings(db: AsyncSession, page: int = 1, page_size: int = 20) -> ListingListResponse:
    """Get pending listings for admin approval"""
    return await get_listings(db, status="pending", page=page, page_size=page_size)
