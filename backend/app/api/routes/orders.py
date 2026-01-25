from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from uuid import UUID

from app.core.database import get_db
from app.core.responses import success_response
from app.api.deps import get_current_user, require_admin, require_terms_accepted
from app.models.user import User
from app.services import order_service
from app.schemas.order import OrderCreate, OrderDeliver, OrderDispute, OrderResolveDispute, OrderResponse


router = APIRouter(prefix="/orders", tags=["Orders"])


@router.post("")
async def create_order(
    data: OrderCreate,
    user: User = Depends(require_terms_accepted),
    db: AsyncSession = Depends(get_db)
):
    """Create order (buy listing)"""
    order = await order_service.create_order(db, user, data)
    return success_response(OrderResponse.model_validate(order).model_dump())


@router.get("/my/purchases")
async def get_my_purchases(
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get my purchase orders"""
    result = await order_service.get_orders(db, user.id, "buyer", status, page, page_size)
    return success_response(result.model_dump())


@router.get("/my/sales")
async def get_my_sales(
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get my sale orders"""
    result = await order_service.get_orders(db, user.id, "seller", status, page, page_size)
    return success_response(result.model_dump())


@router.get("/{order_id}")
async def get_order(
    order_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get order details"""
    order = await order_service.get_order(db, order_id, user.id)
    return success_response(OrderResponse.model_validate(order).model_dump())


@router.post("/{order_id}/deliver")
async def deliver_order(
    order_id: UUID,
    data: OrderDeliver,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Deliver order (seller provides account info)"""
    order = await order_service.deliver_order(db, order_id, user.id, data.delivery_info)
    return success_response(OrderResponse.model_validate(order).model_dump())


@router.post("/{order_id}/complete")
async def complete_order(
    order_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Complete order (buyer confirms receipt)"""
    order = await order_service.complete_order(db, order_id, user.id, "buyer")
    return success_response(OrderResponse.model_validate(order).model_dump())


@router.post("/{order_id}/dispute")
async def dispute_order(
    order_id: UUID,
    data: OrderDispute,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Dispute order"""
    order = await order_service.dispute_order(db, order_id, user.id, data.reason)
    return success_response(OrderResponse.model_validate(order).model_dump())


@router.post("/{order_id}/cancel")
async def cancel_order(
    order_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Cancel order (before payment)"""
    order = await order_service.cancel_order(db, order_id, user.id)
    return success_response(OrderResponse.model_validate(order).model_dump())


@router.post("/admin/{order_id}/resolve")
async def resolve_dispute(
    order_id: UUID,
    data: OrderResolveDispute,
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Resolve dispute (admin)"""
    order = await order_service.resolve_dispute(db, order_id, user.id, data.resolution, data.resolution_note)
    return success_response(OrderResponse.model_validate(order).model_dump())
