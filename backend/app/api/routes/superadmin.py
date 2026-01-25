from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional

from app.core.database import get_db
from app.core.responses import success_response
from app.api.deps import require_super_admin
from app.models.user import User
from app.models.order import Order, OrderStatus
from app.models.wallet_ledger import WalletLedger, LedgerEntryType
from app.models.listing import Listing, ListingStatus
from app.schemas.order import OrderResponse


router = APIRouter(prefix="/superadmin", tags=["Super Admin"])


@router.get("/stats")
async def get_stats(
    user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get platform statistics"""
    # Total users
    users_result = await db.execute(select(func.count(User.id)))
    total_users = users_result.scalar() or 0
    
    # Total orders
    orders_result = await db.execute(select(func.count(Order.id)))
    total_orders = orders_result.scalar() or 0
    
    # Completed orders
    completed_result = await db.execute(
        select(func.count(Order.id)).where(Order.status == OrderStatus.COMPLETED)
    )
    completed_orders = completed_result.scalar() or 0
    
    # Total volume
    volume_result = await db.execute(
        select(func.sum(Order.amount_usd)).where(Order.status == OrderStatus.COMPLETED)
    )
    total_volume = volume_result.scalar() or 0
    
    # Platform earnings (sum of platform fees)
    earnings_result = await db.execute(
        select(func.sum(WalletLedger.amount_usd)).where(
            WalletLedger.entry_type == LedgerEntryType.PLATFORM_FEE
        )
    )
    platform_earnings = abs(earnings_result.scalar() or 0)
    
    # Pending listings
    pending_listings = await db.execute(
        select(func.count(Listing.id)).where(Listing.status == ListingStatus.PENDING)
    )
    pending_count = pending_listings.scalar() or 0
    
    return success_response({
        "total_users": total_users,
        "total_orders": total_orders,
        "completed_orders": completed_orders,
        "total_volume_usd": float(total_volume),
        "platform_earnings_usd": float(platform_earnings),
        "pending_listings": pending_count
    })


@router.get("/finance")
async def get_finance_stats(
    user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get finance dashboard stats"""
    # Platform earnings
    earnings_result = await db.execute(
        select(func.sum(Order.platform_fee_usd)).where(
            Order.status == OrderStatus.COMPLETED
        )
    )
    platform_earnings = earnings_result.scalar() or 0
    
    # Total escrow held (paid but not completed)
    escrow_result = await db.execute(
        select(func.sum(Order.amount_usd)).where(
            Order.status.in_([OrderStatus.PAID, OrderStatus.DELIVERED])
        )
    )
    total_escrow = escrow_result.scalar() or 0
    
    # Total deposits
    deposits_result = await db.execute(
        select(func.sum(WalletLedger.amount_usd)).where(
            WalletLedger.entry_type == LedgerEntryType.DEPOSIT
        )
    )
    total_deposits = deposits_result.scalar() or 0
    
    # Total withdrawals
    withdrawals_result = await db.execute(
        select(func.sum(WalletLedger.amount_usd)).where(
            WalletLedger.entry_type == LedgerEntryType.WITHDRAWAL_PAID
        )
    )
    total_withdrawals = abs(withdrawals_result.scalar() or 0)
    
    # Total frozen
    frozen_result = await db.execute(
        select(func.sum(WalletLedger.balance_frozen_after))
    )
    
    return success_response({
        "platform_earnings_usd": float(platform_earnings),
        "total_escrow_held_usd": float(total_escrow),
        "total_deposits_usd": float(total_deposits),
        "total_withdrawals_usd": float(total_withdrawals)
    })


@router.get("/orders")
async def get_all_orders(
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get all orders (super admin)"""
    from sqlalchemy.orm import selectinload
    
    query = select(Order).options(
        selectinload(Order.buyer),
        selectinload(Order.seller),
        selectinload(Order.listing)
    )
    
    if status:
        query = query.where(Order.status == OrderStatus(status))
    
    count_query = select(func.count(Order.id))
    if status:
        count_query = count_query.where(Order.status == OrderStatus(status))
    
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0
    
    query = query.order_by(Order.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    
    result = await db.execute(query)
    orders = result.scalars().all()
    
    return success_response({
        "orders": [OrderResponse.model_validate(o).model_dump() for o in orders],
        "total": total,
        "page": page,
        "page_size": page_size
    })


@router.get("/users")
async def get_all_users(
    role: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    admin: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get all users (super admin)"""
    from app.schemas.auth import UserResponse
    
    query = select(User)
    
    if role:
        query = query.where(User.roles.contains([role]))
    
    count_query = select(func.count(User.id))
    if role:
        count_query = count_query.where(User.roles.contains([role]))
    
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0
    
    query = query.order_by(User.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    
    result = await db.execute(query)
    users = result.scalars().all()
    
    return success_response({
        "users": [UserResponse.model_validate(u).model_dump() for u in users],
        "total": total,
        "page": page,
        "page_size": page_size
    })
