from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload
from uuid import UUID

from app.core.database import get_db
from app.core.responses import success_response
from app.api.deps import require_super_admin
from app.models.user import User
from app.models.game import Game, GamePlatform
from app.models.platform_config import PlatformFeeRule
from app.core.errors import AppException
from app.core.responses import ErrorCodes
from app.schemas.game import (
    GameCreate, GameUpdate, GamePlatformCreate, GamePlatformUpdate,
    PlatformFeeRuleCreate, PlatformFeeRuleUpdate,
    GameResponse, GamePlatformResponse, PlatformFeeRuleResponse
)


router = APIRouter(prefix="/games", tags=["Games"])


@router.get("")
async def get_games(
    include_inactive: bool = False,
    db: AsyncSession = Depends(get_db)
):
    """Get all games"""
    from sqlalchemy.orm import selectinload
    query = select(Game).options(selectinload(Game.platforms))
    if not include_inactive:
        query = query.where(Game.is_active.is_(True))
    query = query.order_by(Game.display_order, Game.name)
    
    result = await db.execute(query)
    games = result.scalars().all()
    
    return success_response({
        "games": [GameResponse.model_validate(g).model_dump() for g in games]
    })

# Fee-rules routes MUST be defined before /{game_id} so "/fee-rules" is not matched as game_id
@router.get("/fee-rules")
async def get_fee_rules(
    user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get all fee rules (super admin)"""
    result = await db.execute(select(PlatformFeeRule))
    rules = result.scalars().all()
    return success_response({
        "rules": [PlatformFeeRuleResponse.model_validate(r).model_dump() for r in rules]
    })


@router.post("/fee-rules")
async def create_fee_rule(
    data: PlatformFeeRuleCreate,
    user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Create fee rule (super admin)"""
    rule = PlatformFeeRule(**data.model_dump())
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return success_response(PlatformFeeRuleResponse.model_validate(rule).model_dump())


@router.put("/fee-rules/{rule_id}")
async def update_fee_rule(
    rule_id: UUID,
    data: PlatformFeeRuleUpdate,
    user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Update fee rule (super admin)"""
    result = await db.execute(select(PlatformFeeRule).where(PlatformFeeRule.id == rule_id))
    rule = result.scalar_one_or_none()
    if not rule:
        raise AppException(ErrorCodes.NOT_FOUND, "Fee rule not found", 404)
    
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(rule, key, value)
    
    await db.commit()
    await db.refresh(rule)
    return success_response(PlatformFeeRuleResponse.model_validate(rule).model_dump())


@router.delete("/fee-rules/{rule_id}")
async def delete_fee_rule(
    rule_id: UUID,
    user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Delete fee rule (super admin)"""
    result = await db.execute(select(PlatformFeeRule).where(PlatformFeeRule.id == rule_id))
    rule = result.scalar_one_or_none()
    if not rule:
        raise AppException(ErrorCodes.NOT_FOUND, "Fee rule not found", 404)
    
    await db.delete(rule)
    await db.commit()
    return success_response({"message": "Fee rule deleted"})


@router.get("/{game_id}")
async def get_game(game_id: UUID, db: AsyncSession = Depends(get_db)):
    """Get game details"""
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(Game).options(selectinload(Game.platforms)).where(Game.id == game_id)
    )
    game = result.scalar_one_or_none()
    if not game:
        raise AppException(ErrorCodes.NOT_FOUND, "Game not found", 404)
    return success_response(GameResponse.model_validate(game).model_dump())


@router.post("")
async def create_game(
    data: GameCreate,
    user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Create game (super admin)"""
    from sqlalchemy.orm import selectinload
    
    # Extract platforms before creating game
    platforms_data = data.platforms if hasattr(data, 'platforms') and data.platforms else []
    game_data = data.model_dump(exclude={'platforms'} if hasattr(data, 'platforms') else set())
    
    game = Game(**game_data)
    db.add(game)
    await db.flush()
    
    # Create platform entries
    for platform_name in platforms_data:
        platform = GamePlatform(game_id=game.id, platform_name=platform_name)
        db.add(platform)
    
    await db.commit()
    
    # Re-fetch with relationships
    result = await db.execute(
        select(Game).options(selectinload(Game.platforms)).where(Game.id == game.id)
    )
    game = result.scalar_one()
    
    return success_response(GameResponse.model_validate(game).model_dump())


@router.put("/{game_id}")
async def update_game(
    game_id: UUID,
    data: GameUpdate,
    user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Update game (super admin)"""
    from sqlalchemy.orm import selectinload
    from sqlalchemy import delete
    
    result = await db.execute(
        select(Game).options(selectinload(Game.platforms)).where(Game.id == game_id)
    )
    game = result.scalar_one_or_none()
    if not game:
        raise AppException(ErrorCodes.NOT_FOUND, "Game not found", 404)
    
    update_data = data.model_dump(exclude_unset=True)
    
    # Handle platforms separately
    if 'platforms' in update_data:
        platforms_data = update_data.pop('platforms')
        
        # Delete all existing platforms for this game
        await db.execute(delete(GamePlatform).where(GamePlatform.game_id == game_id))
        
        # Create new platforms
        for platform_name in platforms_data:
            platform = GamePlatform(game_id=game_id, platform_name=platform_name)
            db.add(platform)
    
    # Update other fields
    for key, value in update_data.items():
        setattr(game, key, value)
    
    await db.commit()
    
    # Re-fetch with relationships
    result = await db.execute(
        select(Game).options(selectinload(Game.platforms)).where(Game.id == game_id)
    )
    game = result.scalar_one()
    
    return success_response(GameResponse.model_validate(game).model_dump())


@router.post("/{game_id}/platforms")
async def add_platform(
    game_id: UUID,
    data: GamePlatformCreate,
    user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Add platform to game (super admin)"""
    platform = GamePlatform(game_id=game_id, **data.model_dump())
    db.add(platform)
    await db.commit()
    await db.refresh(platform)
    return success_response(GamePlatformResponse.model_validate(platform).model_dump())


@router.put("/platforms/{platform_id}")
async def update_platform(
    platform_id: UUID,
    data: GamePlatformUpdate,
    user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Update platform (super admin)"""
    result = await db.execute(select(GamePlatform).where(GamePlatform.id == platform_id))
    platform = result.scalar_one_or_none()
    if not platform:
        raise AppException(ErrorCodes.NOT_FOUND, "Platform not found", 404)
    
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(platform, key, value)
    
    await db.commit()
    await db.refresh(platform)
    return success_response(GamePlatformResponse.model_validate(platform).model_dump())
    