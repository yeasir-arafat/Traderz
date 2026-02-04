from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, update
from sqlalchemy.orm import selectinload
from typing import Optional, List
from uuid import UUID
from datetime import datetime, timedelta, timezone
import logging

from app.models.order import Order, OrderStatus, OrderCounter
from app.models.listing import Listing, ListingStatus
from app.models.user import User
from app.models.conversation import Conversation, ConversationType
from app.services.wallet_service import (
    hold_escrow, release_escrow_to_pending, refund_escrow, get_user_balance
)
from app.services.user_service import get_seller_fee_discount, update_seller_stats
from app.services.fee_service import get_platform_fee
from app.core.errors import AppException
from app.core.responses import ErrorCodes
from app.core.config import settings
from app.schemas.order import OrderCreate, OrderResponse, OrderListResponse

logger = logging.getLogger(__name__)

# Frontend URL for email links
FRONTEND_URL = "https://account-exchange-3.preview.emergentagent.com"


def send_order_email_async(to_email: str, order_number: str, notification_type: str, details: dict):
    """Send order email (non-blocking, logs errors)"""
    try:
        from app.services.email_service import send_order_notification_email
        send_order_notification_email(to_email, order_number, notification_type, details)
    except Exception as e:
        logger.error(f"Failed to send order email to {to_email}: {e}")


async def generate_order_number(db: AsyncSession) -> str:
    """Generate sequential order number (PTZ1000, PTZ1001, etc.)"""
    # Get or create counter
    result = await db.execute(select(OrderCounter).with_for_update())
    counter = result.scalar_one_or_none()
    
    if not counter:
        counter = OrderCounter(id=1, current_value=1000)
        db.add(counter)
        await db.flush()
    
    order_num = f"PTZ{counter.current_value}"
    counter.current_value += 1
    
    return order_num


async def create_order(db: AsyncSession, buyer: User, data: OrderCreate) -> Order:
    """Create new order"""
    # Get listing
    listing_result = await db.execute(
        select(Listing)
        .options(selectinload(Listing.seller))
        .where(Listing.id == data.listing_id)
    )
    listing = listing_result.scalar_one_or_none()
    
    if not listing:
        raise AppException(ErrorCodes.NOT_FOUND, "Listing not found", 404)
    
    if listing.status != ListingStatus.APPROVED:
        raise AppException(ErrorCodes.VALIDATION_ERROR, "Listing is not available")
    
    if listing.seller_id == buyer.id:
        raise AppException(ErrorCodes.VALIDATION_ERROR, "Cannot buy your own listing")
    
    # Check buyer has sufficient balance
    balance = await get_user_balance(db, buyer.id)
    if balance["available_usd"] < listing.price_usd:
        raise AppException(ErrorCodes.INSUFFICIENT_BALANCE, "Insufficient balance")
    
    # Calculate fees
    base_fee_percent = await get_platform_fee(db, listing.game_id, None, listing.seller.seller_level)
    seller_discount = get_seller_fee_discount(listing.seller.seller_level)
    effective_fee_percent = base_fee_percent * (1 - seller_discount)
    
    platform_fee = listing.price_usd * (effective_fee_percent / 100)
    seller_earnings = listing.price_usd - platform_fee
    
    # Generate order number
    order_number = await generate_order_number(db)
    
    # Create order
    order = Order(
        order_number=order_number,
        listing_id=listing.id,
        buyer_id=buyer.id,
        seller_id=listing.seller_id,
        amount_usd=listing.price_usd,
        platform_fee_usd=platform_fee,
        seller_earnings_usd=seller_earnings,
        base_fee_percent=base_fee_percent,
        seller_discount_percent=seller_discount * 100,
        effective_fee_percent=effective_fee_percent,
        status=OrderStatus.CREATED
    )
    
    db.add(order)
    await db.flush()
    
    # Hold escrow from buyer
    await hold_escrow(db, buyer.id, listing.price_usd, order.id, f"Escrow for order {order_number}")
    
    # Update order status to paid
    order.status = OrderStatus.PAID
    order.paid_at = datetime.now(timezone.utc)
    
    # Mark listing as sold
    listing.status = ListingStatus.SOLD
    
    # Create order chat
    conversation = Conversation(
        conversation_type=ConversationType.ORDER,
        order_id=order.id,
        participant_ids=[buyer.id, listing.seller_id],
        name=order_number
    )
    db.add(conversation)
    
    await db.commit()
    
    # Re-fetch with relationships loaded
    result = await db.execute(
        select(Order)
        .options(
            selectinload(Order.buyer),
            selectinload(Order.seller),
            selectinload(Order.listing)
        )
        .where(Order.id == order.id)
    )
    order = result.scalar_one()
    
    # Send email notifications
    send_order_email_async(
        buyer.email, order_number, "order_created",
        {"amount": listing.price_usd, "order_id": str(order.id), "frontend_url": FRONTEND_URL}
    )
    # Also notify seller
    seller_result = await db.execute(select(User).where(User.id == listing.seller_id))
    seller = seller_result.scalar_one_or_none()
    if seller:
        send_order_email_async(
            seller.email, order_number, "order_created",
            {"amount": listing.price_usd, "order_id": str(order.id), "frontend_url": FRONTEND_URL}
        )
    
    return order


async def get_order(db: AsyncSession, order_id: UUID, user_id: UUID) -> Order:
    """Get order by ID"""
    result = await db.execute(
        select(Order)
        .options(
            selectinload(Order.buyer),
            selectinload(Order.seller),
            selectinload(Order.listing)
        )
        .where(Order.id == order_id)
    )
    order = result.scalar_one_or_none()
    
    if not order:
        raise AppException(ErrorCodes.NOT_FOUND, "Order not found", 404)
    
    # Check access
    if order.buyer_id != user_id and order.seller_id != user_id:
        # Check if admin
        user_result = await db.execute(select(User).where(User.id == user_id))
        user = user_result.scalar_one_or_none()
        if not user or ("admin" not in user.roles and "super_admin" not in user.roles):
            raise AppException(ErrorCodes.AUTHORIZATION_ERROR, "Access denied", 403)
    
    return order


async def get_orders(
    db: AsyncSession,
    user_id: UUID,
    role: str = "buyer",  # 'buyer' or 'seller'
    status: Optional[str] = None,
    page: int = 1,
    page_size: int = 20
) -> OrderListResponse:
    """Get orders for user"""
    query = select(Order).options(
        selectinload(Order.buyer),
        selectinload(Order.seller),
        selectinload(Order.listing)
    )
    
    conditions = []
    if role == "buyer":
        conditions.append(Order.buyer_id == user_id)
    else:
        conditions.append(Order.seller_id == user_id)
    
    if status:
        conditions.append(Order.status == OrderStatus(status))
    
    query = query.where(and_(*conditions))
    
    # Count
    count_query = select(func.count(Order.id)).where(and_(*conditions))
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0
    
    # Paginate
    query = query.order_by(Order.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    
    result = await db.execute(query)
    orders = result.scalars().all()
    
    total_pages = (total + page_size - 1) // page_size
    
    return OrderListResponse(
        orders=[OrderResponse.model_validate(o) for o in orders],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


async def deliver_order(db: AsyncSession, order_id: UUID, seller_id: UUID, delivery_info: str) -> Order:
    """Seller delivers order"""
    result = await db.execute(
        select(Order).where(Order.id == order_id, Order.seller_id == seller_id)
    )
    order = result.scalar_one_or_none()
    
    if not order:
        raise AppException(ErrorCodes.NOT_FOUND, "Order not found", 404)
    
    if order.status != OrderStatus.PAID:
        raise AppException(ErrorCodes.INVALID_STATE_TRANSITION, f"Cannot deliver order in {order.status} status")
    
    order.status = OrderStatus.DELIVERED
    order.delivery_info = delivery_info
    order.delivered_at = datetime.now(timezone.utc)
    
    await db.commit()
    
    # Re-fetch with relationships loaded
    result = await db.execute(
        select(Order)
        .options(
            selectinload(Order.buyer),
            selectinload(Order.seller),
            selectinload(Order.listing)
        )
        .where(Order.id == order_id)
    )
    return result.scalar_one()


async def complete_order(db: AsyncSession, order_id: UUID, user_id: UUID, completed_by: str = "buyer") -> Order:
    """Complete order - release escrow to seller pending"""
    result = await db.execute(
        select(Order).where(Order.id == order_id)
    )
    order = result.scalar_one_or_none()
    
    if not order:
        raise AppException(ErrorCodes.NOT_FOUND, "Order not found", 404)
    
    # Check authorization
    if completed_by == "buyer" and order.buyer_id != user_id:
        raise AppException(ErrorCodes.AUTHORIZATION_ERROR, "Only buyer can complete", 403)
    
    if order.status != OrderStatus.DELIVERED:
        raise AppException(ErrorCodes.INVALID_STATE_TRANSITION, f"Cannot complete order in {order.status} status")
    
    # Release escrow to seller pending (10 day hold)
    await release_escrow_to_pending(
        db, order.seller_id, order.seller_earnings_usd, order.id,
        f"Earnings from order {order.order_number}"
    )
    
    # Set pending release date
    order.status = OrderStatus.COMPLETED
    order.completed_at = datetime.now(timezone.utc)
    order.completed_by = completed_by
    order.seller_pending_release_at = datetime.now(timezone.utc) + timedelta(days=10)
    
    # Update seller stats
    await update_seller_stats(db, order.seller_id, order.amount_usd)
    
    await db.commit()
    
    # Re-fetch with relationships loaded
    result = await db.execute(
        select(Order)
        .options(
            selectinload(Order.buyer),
            selectinload(Order.seller),
            selectinload(Order.listing)
        )
        .where(Order.id == order_id)
    )
    return result.scalar_one()


async def dispute_order(db: AsyncSession, order_id: UUID, buyer_id: UUID, reason: str) -> Order:
    """Buyer disputes order"""
    result = await db.execute(
        select(Order).where(Order.id == order_id, Order.buyer_id == buyer_id)
    )
    order = result.scalar_one_or_none()
    
    if not order:
        raise AppException(ErrorCodes.NOT_FOUND, "Order not found", 404)
    
    if order.status != OrderStatus.DELIVERED:
        raise AppException(ErrorCodes.INVALID_STATE_TRANSITION, "Can only dispute delivered orders")
    
    # Check dispute window (24 hours)
    if order.delivered_at:
        window_end = order.delivered_at + timedelta(hours=24)
        if datetime.now(timezone.utc) > window_end:
            raise AppException(ErrorCodes.VALIDATION_ERROR, "Dispute window has expired (24 hours)")
    
    order.status = OrderStatus.DISPUTED
    order.dispute_reason = reason
    order.disputed_at = datetime.now(timezone.utc)
    
    await db.commit()
    
    # Re-fetch with relationships loaded
    result = await db.execute(
        select(Order)
        .options(
            selectinload(Order.buyer),
            selectinload(Order.seller),
            selectinload(Order.listing)
        )
        .where(Order.id == order_id)
    )
    return result.scalar_one()


async def resolve_dispute(db: AsyncSession, order_id: UUID, admin_id: UUID, resolution: str, note: str) -> Order:
    """Admin resolves dispute"""
    result = await db.execute(
        select(Order).where(Order.id == order_id)
    )
    order = result.scalar_one_or_none()
    
    if not order:
        raise AppException(ErrorCodes.NOT_FOUND, "Order not found", 404)
    
    if order.status != OrderStatus.DISPUTED:
        raise AppException(ErrorCodes.INVALID_STATE_TRANSITION, "Order is not in dispute")
    
    if resolution == "refund":
        # Refund buyer
        await refund_escrow(db, order.buyer_id, order.amount_usd, order.id, f"Refund for order {order.order_number}")
        order.status = OrderStatus.REFUNDED
        order.refunded_at = datetime.now(timezone.utc)
    elif resolution == "complete":
        # Complete in favor of seller
        await release_escrow_to_pending(
            db, order.seller_id, order.seller_earnings_usd, order.id,
            f"Earnings from order {order.order_number}"
        )
        order.status = OrderStatus.COMPLETED
        order.completed_at = datetime.now(timezone.utc)
        order.completed_by = "admin"
        order.seller_pending_release_at = datetime.now(timezone.utc) + timedelta(days=10)
        await update_seller_stats(db, order.seller_id, order.amount_usd)
    else:
        raise AppException(ErrorCodes.VALIDATION_ERROR, "Invalid resolution")
    
    order.dispute_resolved_at = datetime.now(timezone.utc)
    order.dispute_resolution = note
    
    await db.commit()
    
    # Re-fetch with relationships loaded
    result = await db.execute(
        select(Order)
        .options(
            selectinload(Order.buyer),
            selectinload(Order.seller),
            selectinload(Order.listing)
        )
        .where(Order.id == order_id)
    )
    return result.scalar_one()


async def cancel_order(db: AsyncSession, order_id: UUID, user_id: UUID) -> Order:
    """Cancel order (only if not paid yet)"""
    result = await db.execute(
        select(Order).where(Order.id == order_id)
    )
    order = result.scalar_one_or_none()
    
    if not order:
        raise AppException(ErrorCodes.NOT_FOUND, "Order not found", 404)
    
    if order.buyer_id != user_id and order.seller_id != user_id:
        raise AppException(ErrorCodes.AUTHORIZATION_ERROR, "Access denied", 403)
    
    if order.status != OrderStatus.CREATED:
        raise AppException(ErrorCodes.INVALID_STATE_TRANSITION, "Cannot cancel order after payment")
    
    order.status = OrderStatus.CANCELLED
    order.cancelled_at = datetime.now(timezone.utc)
    
    await db.commit()
    
    # Re-fetch with relationships loaded
    result = await db.execute(
        select(Order)
        .options(
            selectinload(Order.buyer),
            selectinload(Order.seller),
            selectinload(Order.listing)
        )
        .where(Order.id == order_id)
    )
    return result.scalar_one()
