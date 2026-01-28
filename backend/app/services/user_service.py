from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import Optional, List, Tuple
from uuid import UUID

from app.models.user import User
from app.models.listing import Listing, ListingStatus
from app.models.review import Review
from app.core.errors import AppException
from app.core.responses import ErrorCodes
from app.schemas.auth import ProfileUpdateRequest, UserResponse


async def get_user_profile(db: AsyncSession, user_id: UUID) -> User:
    """Get user profile by ID"""
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise AppException(ErrorCodes.NOT_FOUND, "User not found", 404)
    return user


async def update_profile(db: AsyncSession, user: User, data: ProfileUpdateRequest) -> User:
    """Update user profile (respecting KYC locks)"""
    # Check if KYC approved - certain fields are locked
    if user.kyc_status == "approved":
        # These fields cannot be changed after KYC approval
        if data.full_name and data.full_name != user.full_name:
            raise AppException(ErrorCodes.VALIDATION_ERROR, "Full name cannot be changed after KYC approval")
        if data.address_line1 and data.address_line1 != user.address_line1:
            raise AppException(ErrorCodes.VALIDATION_ERROR, "Address cannot be changed after KYC approval")
        if data.city and data.city != user.city:
            raise AppException(ErrorCodes.VALIDATION_ERROR, "City cannot be changed after KYC approval")
        if data.country and data.country != user.country:
            raise AppException(ErrorCodes.VALIDATION_ERROR, "Country cannot be changed after KYC approval")
    
    # Update allowed fields
    if data.full_name and user.kyc_status != "approved":
        user.full_name = data.full_name
    if data.phone_number is not None:
        user.phone_number = data.phone_number
    if data.address_line1 is not None and user.kyc_status != "approved":
        user.address_line1 = data.address_line1
    if data.address_line2 is not None:
        user.address_line2 = data.address_line2
    if data.city is not None and user.kyc_status != "approved":
        user.city = data.city
    if data.state is not None:
        user.state = data.state
    if data.country is not None and user.kyc_status != "approved":
        user.country = data.country
    if data.postal_code is not None:
        user.postal_code = data.postal_code
    
    await db.commit()
    await db.refresh(user)
    return user


async def become_seller(db: AsyncSession, user: User) -> User:
    """Add seller role to user.

    Business rule: user must have a completed profile before becoming a seller.
    """
    if "seller" in user.roles:
        raise AppException(ErrorCodes.CONFLICT, "Already a seller")
    
    # Ensure required profile fields are filled in before allowing seller role
    required_fields = {
        "full_name": user.full_name,
        "phone_number": user.phone_number,
        "address_line1": user.address_line1,
        "city": user.city,
        "country": user.country,
        "postal_code": user.postal_code,
    }
    missing = [name for name, value in required_fields.items() if not value]
    if missing:
        raise AppException(
            ErrorCodes.VALIDATION_ERROR,
            "Please complete your profile before becoming a seller",
        )
        
    user.roles = user.roles + ["seller"]
    await db.commit()
    await db.refresh(user)
    return user


async def get_seller_profile(db: AsyncSession, seller_id: UUID) -> dict:
    """Get public seller profile with stats"""
    result = await db.execute(
        select(User).where(User.id == seller_id)
    )
    seller = result.scalar_one_or_none()
    
    if not seller or "seller" not in seller.roles:
        raise AppException(ErrorCodes.NOT_FOUND, "Seller not found", 404)
    
    # Get active listings count
    listings_result = await db.execute(
        select(func.count(Listing.id)).where(
            Listing.seller_id == seller_id,
            Listing.status == ListingStatus.APPROVED
        )
    )
    active_listings = listings_result.scalar() or 0
    
    # Get recent reviews
    reviews_result = await db.execute(
        select(Review).where(Review.reviewee_id == seller_id)
        .order_by(Review.created_at.desc())
        .limit(3)
    )
    recent_reviews = reviews_result.scalars().all()
    
    return {
        "id": str(seller.id),
        "username": seller.username,
        "seller_level": seller.seller_level,
        "seller_rating": seller.seller_rating,
        "total_reviews": seller.total_reviews,
        "total_sales_volume_usd": seller.total_sales_volume_usd,
        "kyc_status": seller.kyc_status,
        "active_listings": active_listings,
        "member_since": seller.created_at.isoformat(),
        "recent_reviews": [
            {
                "rating": r.rating,
                "comment": r.comment,
                "created_at": r.created_at.isoformat()
            }
            for r in recent_reviews
        ]
    }


async def update_seller_stats(db: AsyncSession, seller_id: UUID, order_amount_usd: float):
    """Update seller stats after completed order"""
    result = await db.execute(
        select(User).where(User.id == seller_id)
    )
    seller = result.scalar_one_or_none()
    
    if seller:
        seller.total_sales_volume_usd += order_amount_usd
        
        # Update seller level based on volume
        volume = seller.total_sales_volume_usd
        if volume >= 1500:
            seller.seller_level = "diamond"
        elif volume >= 750:
            seller.seller_level = "platinum"
        elif volume >= 350:
            seller.seller_level = "gold"
        elif volume >= 100:
            seller.seller_level = "silver"
        else:
            seller.seller_level = "bronze"
        
        await db.commit()


async def update_seller_rating(db: AsyncSession, seller_id: UUID):
    """Recalculate seller rating from reviews"""
    result = await db.execute(
        select(
            func.avg(Review.rating),
            func.count(Review.id)
        ).where(Review.reviewee_id == seller_id)
    )
    avg_rating, total_reviews = result.first()
    
    seller_result = await db.execute(
        select(User).where(User.id == seller_id)
    )
    seller = seller_result.scalar_one_or_none()
    
    if seller:
        seller.seller_rating = float(avg_rating) if avg_rating else 0.0
        seller.total_reviews = total_reviews or 0
        await db.commit()


def get_seller_fee_discount(seller_level: str) -> float:
    """Get fee discount based on seller level"""
    discounts = {
        "bronze": 0.0,
        "silver": 0.10,
        "gold": 0.20,
        "platinum": 0.35,
        "diamond": 0.50
    }
    return discounts.get(seller_level, 0.0)
