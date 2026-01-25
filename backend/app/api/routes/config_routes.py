from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.responses import success_response
from app.api.deps import require_super_admin
from app.models.user import User
from app.models.platform_config import PlatformConfig
from app.schemas.misc import ConfigUpdateRequest, ConfigResponse


router = APIRouter(prefix="/config", tags=["Platform Config"])


@router.get("")
async def get_config(db: AsyncSession = Depends(get_db)):
    """Get public platform config"""
    result = await db.execute(select(PlatformConfig))
    configs = result.scalars().all()
    
    # Filter sensitive configs
    public_keys = ["usdToBdtRate", "disputeWindowHours", "sellerProtectionDays", "terms_version", "privacy_version"]
    public_configs = [c for c in configs if c.key in public_keys]
    
    return success_response({
        "config": {c.key: c.value for c in public_configs}
    })


@router.get("/all")
async def get_all_config(
    user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get all platform config (super admin)"""
    result = await db.execute(select(PlatformConfig))
    configs = result.scalars().all()
    
    return success_response({
        "config": [ConfigResponse.model_validate(c).model_dump() for c in configs]
    })


@router.put("")
async def update_config(
    data: ConfigUpdateRequest,
    user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Update platform config (super admin)"""
    result = await db.execute(
        select(PlatformConfig).where(PlatformConfig.key == data.key)
    )
    config = result.scalar_one_or_none()
    
    if config:
        config.value = data.value
        config.updated_by = user.id
    else:
        config = PlatformConfig(key=data.key, value=data.value, updated_by=user.id)
        db.add(config)
    
    await db.commit()
    await db.refresh(config)
    return success_response(ConfigResponse.model_validate(config).model_dump())
