from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.responses import success_response
from app.api.deps import get_current_user
from app.models.user import User
from app.models.review import Review
from app.models.order import Order, OrderStatus
from app.services.user_service import update_seller_rating
from app.core.errors import AppException
from app.core.responses import ErrorCodes
from app.schemas.misc import ReviewCreate, ReviewResponse


router = APIRouter(prefix="/reviews", tags=["Reviews"])


@router.post("/order/{order_id}")
async def create_review(
    order_id: str,
    data: ReviewCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create review for completed order"""
    from uuid import UUID
    
    # Get order
    result = await db.execute(
        select(Order).where(Order.id == UUID(order_id))
    )
    order = result.scalar_one_or_none()
    
    if not order:
        raise AppException(ErrorCodes.NOT_FOUND, "Order not found", 404)
    
    if order.status != OrderStatus.COMPLETED:
        raise AppException(ErrorCodes.VALIDATION_ERROR, "Can only review completed orders")
    
    if order.buyer_id != user.id:
        raise AppException(ErrorCodes.AUTHORIZATION_ERROR, "Only buyer can review", 403)
    
    # Check existing review
    existing = await db.execute(
        select(Review).where(Review.order_id == UUID(order_id))
    )
    if existing.scalar_one_or_none():
        raise AppException(ErrorCodes.CONFLICT, "Review already exists for this order")
    
    review = Review(
        order_id=UUID(order_id),
        reviewer_id=user.id,
        reviewee_id=order.seller_id,
        rating=data.rating,
        comment=data.comment
    )
    db.add(review)
    await db.commit()
    
    # Update seller rating
    await update_seller_rating(db, order.seller_id)
    
    await db.refresh(review)
    return success_response(ReviewResponse.model_validate(review).model_dump())


@router.get("/seller/{seller_id}")
async def get_seller_reviews(
    seller_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """Get seller reviews"""
    from uuid import UUID
    from sqlalchemy import func
    from sqlalchemy.orm import selectinload
    
    query = select(Review).where(Review.reviewee_id == UUID(seller_id))
    
    count_result = await db.execute(
        select(func.count(Review.id)).where(Review.reviewee_id == UUID(seller_id))
    )
    total = count_result.scalar() or 0
    
    query = query.order_by(Review.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    
    result = await db.execute(query)
    reviews = result.scalars().all()
    
    # Get reviewer usernames
    review_responses = []
    for r in reviews:
        response = ReviewResponse.model_validate(r).model_dump()
        if r.reviewer_id:
            reviewer_result = await db.execute(
                select(User.username).where(User.id == r.reviewer_id)
            )
            username = reviewer_result.scalar_one_or_none()
            response["reviewer_username"] = username
        review_responses.append(response)
    
    return success_response({
        "reviews": review_responses,
        "total": total,
        "page": page,
        "page_size": page_size
    })
