"""
Background job scheduler using APScheduler.
Jobs:
1. Auto-complete delivered orders after 24 hours if buyer inactive
2. Release seller pending earnings after 10 days
"""
import logging
from datetime import datetime, timedelta, timezone
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload

from app.core.database import AsyncSessionLocal
from app.models.order import Order, OrderStatus
from app.models.wallet_ledger import WalletLedger, LedgerEntryType
from app.models.platform_config import PlatformConfig

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def get_config_value(db, key: str, default: str) -> str:
    """Get platform config value"""
    result = await db.execute(
        select(PlatformConfig).where(PlatformConfig.key == key)
    )
    config = result.scalar_one_or_none()
    return config.value if config else default


async def auto_complete_orders_job():
    """
    Auto-complete delivered orders after dispute window expires.
    - Orders in 'delivered' status older than disputeWindowHours (default 24)
    - Complete as 'auto' system
    - Move seller earnings to PENDING
    """
    logger.info("Running auto_complete_orders_job...")
    
    async with AsyncSessionLocal() as db:
        try:
            # Get dispute window config
            dispute_hours = int(await get_config_value(db, "disputeWindowHours", "24"))
            cutoff_time = datetime.now(timezone.utc) - timedelta(hours=dispute_hours)
            
            # Find delivered orders past dispute window
            result = await db.execute(
                select(Order).where(
                    and_(
                        Order.status == OrderStatus.DELIVERED,
                        Order.delivered_at < cutoff_time
                    )
                )
            )
            orders = result.scalars().all()
            
            completed_count = 0
            for order in orders:
                try:
                    # Import here to avoid circular imports
                    from app.services.wallet_service import release_escrow_to_pending
                    from app.services.user_service import update_seller_stats
                    
                    # Release escrow to seller pending
                    await release_escrow_to_pending(
                        db, order.seller_id, order.seller_earnings_usd, order.id,
                        f"Auto-completed earnings for order {order.order_number}"
                    )
                    
                    # Update order status
                    order.status = OrderStatus.COMPLETED
                    order.completed_at = datetime.now(timezone.utc)
                    order.completed_by = "auto"
                    
                    # Set pending release date (10 days from now)
                    protection_days = int(await get_config_value(db, "sellerProtectionDays", "10"))
                    order.seller_pending_release_at = datetime.now(timezone.utc) + timedelta(days=protection_days)
                    
                    # Update seller stats
                    await update_seller_stats(db, order.seller_id, order.amount_usd)
                    
                    completed_count += 1
                    logger.info(f"Auto-completed order {order.order_number}")
                    
                except Exception as e:
                    logger.error(f"Failed to auto-complete order {order.order_number}: {e}")
            
            await db.commit()
            logger.info(f"auto_complete_orders_job: scanned {len(orders)}, completed {completed_count}")
            
        except Exception as e:
            logger.error(f"auto_complete_orders_job failed: {e}")
            await db.rollback()


async def release_pending_earnings_job():
    """
    Release seller pending earnings after protection period.
    - Orders completed more than sellerProtectionDays ago (default 10)
    - Move from pending to available balance
    """
    logger.info("Running release_pending_earnings_job...")
    
    async with AsyncSessionLocal() as db:
        try:
            # Find orders ready for release
            now = datetime.now(timezone.utc)
            result = await db.execute(
                select(Order).where(
                    and_(
                        Order.status == OrderStatus.COMPLETED,
                        Order.seller_pending_release_at <= now,
                        Order.seller_earnings_released.is_(None)
                    )
                )
            )
            orders = result.scalars().all()
            
            released_count = 0
            for order in orders:
                try:
                    from app.services.wallet_service import release_pending_to_available
                    
                    # Release pending to available
                    await release_pending_to_available(
                        db, order.seller_id, order.seller_earnings_usd, order.id,
                        f"Earnings released for order {order.order_number}"
                    )
                    
                    # Mark as released
                    order.seller_earnings_released = now
                    
                    released_count += 1
                    logger.info(f"Released pending earnings for order {order.order_number}")
                    
                except Exception as e:
                    logger.error(f"Failed to release earnings for order {order.order_number}: {e}")
            
            await db.commit()
            logger.info(f"release_pending_earnings_job: scanned {len(orders)}, released {released_count}")
            
        except Exception as e:
            logger.error(f"release_pending_earnings_job failed: {e}")
            await db.rollback()


def start_scheduler():
    """Start the background job scheduler"""
    logger.info("Starting background job scheduler...")
    
    # Auto-complete orders - run every 15 minutes
    scheduler.add_job(
        auto_complete_orders_job,
        trigger=IntervalTrigger(minutes=15),
        id="auto_complete_orders",
        name="Auto-complete delivered orders",
        replace_existing=True
    )
    
    # Release pending earnings - run every hour
    scheduler.add_job(
        release_pending_earnings_job,
        trigger=IntervalTrigger(hours=1),
        id="release_pending_earnings",
        name="Release seller pending earnings",
        replace_existing=True
    )
    
    scheduler.start()
    logger.info("Background job scheduler started with 2 jobs")


def shutdown_scheduler():
    """Shutdown the scheduler gracefully"""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Background job scheduler stopped")


def get_job_info():
    """Get information about scheduled jobs for debug endpoint"""
    jobs = []
    for job in scheduler.get_jobs():
        next_run = job.next_run_time.isoformat() if job.next_run_time else None
        jobs.append({
            "id": job.id,
            "name": job.name,
            "next_run_time": next_run,
            "trigger": str(job.trigger)
        })
    return {
        "scheduler_running": scheduler.running,
        "jobs": jobs
    }
