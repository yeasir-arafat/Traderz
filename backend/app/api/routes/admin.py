from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.responses import success_response
from app.api.deps import require_admin, require_admin_scope
from app.models.user import User
from app.models.listing import Listing, ListingStatus
from app.models.order import Order, OrderStatus
from app.models.kyc import KycSubmission, KycStatus
from app.schemas.order import OrderResponse


router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/dashboard")
async def get_dashboard(
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get admin dashboard stats"""
    # Pending listings
    pending_listings = await db.execute(
        select(func.count(Listing.id)).where(Listing.status == ListingStatus.PENDING)
    )
    pending_listings_count = pending_listings.scalar() or 0
    
    # Pending KYC
    pending_kyc = await db.execute(
        select(func.count(KycSubmission.id)).where(KycSubmission.status == KycStatus.PENDING)
    )
    pending_kyc_count = pending_kyc.scalar() or 0
    
    # Disputed orders
    disputed_orders = await db.execute(
        select(func.count(Order.id)).where(Order.status == OrderStatus.DISPUTED)
    )
    disputed_orders_count = disputed_orders.scalar() or 0
    
    # Active orders
    active_orders = await db.execute(
        select(func.count(Order.id)).where(
            Order.status.in_([OrderStatus.PAID, OrderStatus.DELIVERED])
        )
    )
    active_orders_count = active_orders.scalar() or 0
    
    return success_response({
        "pending_listings": pending_listings_count,
        "pending_kyc": pending_kyc_count,
        "disputed_orders": disputed_orders_count,
        "active_orders": active_orders_count
    })


@router.get("/disputes")
async def get_disputed_orders(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(require_admin_scope("DISPUTE_RESOLVE")),
    db: AsyncSession = Depends(get_db)
):
    """Get disputed orders for admin resolution. Requires DISPUTE_RESOLVE scope."""
    query = select(Order).options(
        selectinload(Order.buyer),
        selectinload(Order.seller),
        selectinload(Order.listing)
    ).where(Order.status == OrderStatus.DISPUTED)
    
    # Count total
    count_result = await db.execute(
        select(func.count(Order.id)).where(Order.status == OrderStatus.DISPUTED)
    )
    total = count_result.scalar() or 0
    
    # Paginate
    query = query.order_by(Order.disputed_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    
    result = await db.execute(query)
    orders = result.scalars().all()
    
    total_pages = (total + page_size - 1) // page_size
    
    return success_response({
        "orders": [OrderResponse.model_validate(o).model_dump() for o in orders],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    })
