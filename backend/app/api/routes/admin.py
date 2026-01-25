from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.core.responses import success_response
from app.api.deps import require_admin
from app.models.user import User
from app.models.listing import Listing, ListingStatus
from app.models.order import Order, OrderStatus
from app.models.kyc import KycSubmission, KycStatus


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
