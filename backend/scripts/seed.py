import asyncio
import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.core.security import get_password_hash
from app.models.user import User, AuthProvider
from app.models.game import Game, GamePlatform
from app.models.platform_config import PlatformConfig, PlatformFeeRule
from app.models.order import OrderCounter

logger = logging.getLogger(__name__)


async def seed_super_admin(db: AsyncSession):
    """Seed super admin account"""
    result = await db.execute(
        select(User).where(User.email == "super@admin.com")
    )
    if not result.scalar_one_or_none():
        user = User(
            username="superadmin",
            email="super@admin.com",
            password_hash=get_password_hash("admin12"),
            full_name="Super Admin",
            roles=["buyer", "seller", "admin", "super_admin"],
            auth_provider=AuthProvider.EMAIL,
            terms_accepted=True,
            profile_completed=True,
            kyc_status="approved",
            is_verified=True
        )
        db.add(user)
        logger.info("Created super admin: super@admin.com")


async def seed_admin(db: AsyncSession):
    """Seed admin account"""
    result = await db.execute(
        select(User).where(User.email == "admin@admin.com")
    )
    if not result.scalar_one_or_none():
        user = User(
            username="admin",
            email="admin@admin.com",
            password_hash=get_password_hash("admin12"),
            full_name="Admin User",
            roles=["buyer", "seller", "admin"],
            auth_provider=AuthProvider.EMAIL,
            terms_accepted=True,
            profile_completed=True,
            kyc_status="approved",
            is_verified=True
        )
        db.add(user)
        logger.info("Created admin: admin@admin.com")


async def seed_platform_config(db: AsyncSession):
    """Seed default platform config"""
    configs = [
        ("usdToBdtRate", "110", "USD to BDT exchange rate"),
        ("disputeWindowHours", "24", "Hours buyer can dispute after delivery"),
        ("sellerProtectionDays", "10", "Days seller earnings are held before release"),
        ("trustedSellerAutoApprove", "true", "Auto-approve listings from trusted sellers"),
        ("terms_version", "v1.0", "Current terms version"),
        ("privacy_version", "v1.0", "Current privacy version"),
    ]
    
    for key, value, description in configs:
        result = await db.execute(
            select(PlatformConfig).where(PlatformConfig.key == key)
        )
        if not result.scalar_one_or_none():
            config = PlatformConfig(key=key, value=value, description=description)
            db.add(config)
            logger.info(f"Created config: {key}")


async def seed_games(db: AsyncSession):
    """Seed sample games and platforms"""
    games_data = [
        {
            "name": "Fortnite",
            "slug": "fortnite",
            "description": "Battle royale game by Epic Games",
            "platforms": [
                {"platform_name": "PC", "region": "Global"},
                {"platform_name": "PlayStation", "region": "Global"},
                {"platform_name": "Xbox", "region": "Global"},
                {"platform_name": "Mobile", "region": "Global"},
            ]
        },
        {
            "name": "Valorant",
            "slug": "valorant",
            "description": "Tactical shooter by Riot Games",
            "platforms": [
                {"platform_name": "PC", "region": "NA"},
                {"platform_name": "PC", "region": "EU"},
                {"platform_name": "PC", "region": "Asia"},
            ]
        },
        {
            "name": "League of Legends",
            "slug": "league-of-legends",
            "description": "MOBA game by Riot Games",
            "platforms": [
                {"platform_name": "PC", "region": "NA"},
                {"platform_name": "PC", "region": "EU West"},
                {"platform_name": "PC", "region": "Korea"},
            ]
        },
        {
            "name": "Call of Duty: Warzone",
            "slug": "cod-warzone",
            "description": "Battle royale by Activision",
            "platforms": [
                {"platform_name": "PC", "region": "Global"},
                {"platform_name": "PlayStation", "region": "Global"},
                {"platform_name": "Xbox", "region": "Global"},
            ]
        },
        {
            "name": "Genshin Impact",
            "slug": "genshin-impact",
            "description": "Action RPG by miHoYo",
            "platforms": [
                {"platform_name": "PC", "region": "Global"},
                {"platform_name": "PlayStation", "region": "Global"},
                {"platform_name": "Mobile", "region": "Global"},
            ]
        },
        {
            "name": "Apex Legends",
            "slug": "apex-legends",
            "description": "Battle royale by Respawn",
            "platforms": [
                {"platform_name": "PC", "region": "Global"},
                {"platform_name": "PlayStation", "region": "Global"},
                {"platform_name": "Xbox", "region": "Global"},
            ]
        },
        {
            "name": "Counter-Strike 2",
            "slug": "cs2",
            "description": "Tactical shooter by Valve",
            "platforms": [
                {"platform_name": "PC", "region": "Global"},
            ]
        },
        {
            "name": "PUBG",
            "slug": "pubg",
            "description": "Battle royale game",
            "platforms": [
                {"platform_name": "PC", "region": "Global"},
                {"platform_name": "Mobile", "region": "Global"},
            ]
        },
    ]
    
    for game_data in games_data:
        result = await db.execute(
            select(Game).where(Game.slug == game_data["slug"])
        )
        if not result.scalar_one_or_none():
            game = Game(
                name=game_data["name"],
                slug=game_data["slug"],
                description=game_data["description"]
            )
            db.add(game)
            await db.flush()
            
            for platform_data in game_data["platforms"]:
                platform = GamePlatform(
                    game_id=game.id,
                    platform_name=platform_data["platform_name"],
                    region=platform_data["region"]
                )
                db.add(platform)
            
            logger.info(f"Created game: {game_data['name']}")


async def seed_fee_rules(db: AsyncSession):
    """Seed default fee rules"""
    # Get first game for default rule
    result = await db.execute(select(Game).limit(1))
    game = result.scalar_one_or_none()
    
    if game:
        existing = await db.execute(
            select(PlatformFeeRule).where(PlatformFeeRule.game_id == game.id)
        )
        if not existing.scalar_one_or_none():
            rule = PlatformFeeRule(
                game_id=game.id,
                fee_percent=5.0,
                description="Default 5% platform fee"
            )
            db.add(rule)
            logger.info("Created default fee rule")


async def seed_order_counter(db: AsyncSession):
    """Seed order counter starting at 1000"""
    result = await db.execute(select(OrderCounter))
    if not result.scalar_one_or_none():
        counter = OrderCounter(id=1, current_value=1000)
        db.add(counter)
        logger.info("Created order counter starting at PTZ1000")


async def run_seed():
    """Run all seed functions"""
    async with AsyncSessionLocal() as db:
        try:
            await seed_super_admin(db)
            await seed_admin(db)
            await seed_platform_config(db)
            await seed_games(db)
            await seed_fee_rules(db)
            await seed_order_counter(db)
            await db.commit()
            logger.info("Seed completed successfully")
        except Exception as e:
            await db.rollback()
            logger.error(f"Seed failed: {e}")
            raise


if __name__ == "__main__":
    asyncio.run(run_seed())
