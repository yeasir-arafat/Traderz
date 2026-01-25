from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from uuid import UUID

from app.models.platform_config import PlatformFeeRule


async def get_platform_fee(
    db: AsyncSession,
    game_id: Optional[UUID],
    platform_id: Optional[UUID],
    seller_level: str
) -> float:
    """Get platform fee percentage for game/platform/seller combo"""
    # Try to find specific rule
    if game_id and platform_id:
        result = await db.execute(
            select(PlatformFeeRule).where(
                PlatformFeeRule.game_id == game_id,
                PlatformFeeRule.platform_id == platform_id,
                PlatformFeeRule.seller_level == seller_level
            )
        )
        rule = result.scalar_one_or_none()
        if rule:
            return rule.fee_percent
    
    # Try game-specific rule
    if game_id:
        result = await db.execute(
            select(PlatformFeeRule).where(
                PlatformFeeRule.game_id == game_id,
                PlatformFeeRule.platform_id.is_(None),
                PlatformFeeRule.seller_level == seller_level
            )
        )
        rule = result.scalar_one_or_none()
        if rule:
            return rule.fee_percent
        
        # Try game default
        result = await db.execute(
            select(PlatformFeeRule).where(
                PlatformFeeRule.game_id == game_id,
                PlatformFeeRule.platform_id.is_(None),
                PlatformFeeRule.seller_level.is_(None)
            )
        )
        rule = result.scalar_one_or_none()
        if rule:
            return rule.fee_percent
    
    # Default fee
    return 5.0
