from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional
from uuid import UUID
from datetime import datetime, timezone

from app.models.wallet_ledger import WalletLedger, LedgerEntryType
from app.models.giftcard import GiftCard
from app.core.errors import AppException
from app.core.responses import ErrorCodes
from app.schemas.wallet import WalletBalanceResponse, WalletTransactionResponse, WalletHistoryResponse


async def get_user_balance(db: AsyncSession, user_id: UUID) -> dict:
    """Calculate user balance from ledger"""
    result = await db.execute(
        select(WalletLedger)
        .where(WalletLedger.user_id == user_id)
        .order_by(WalletLedger.created_at.desc())
        .limit(1)
    )
    last_entry = result.scalar_one_or_none()
    
    if not last_entry:
        return {
            "available_usd": 0.0,
            "pending_usd": 0.0,
            "frozen_usd": 0.0,
            "total_usd": 0.0
        }
    
    return {
        "available_usd": last_entry.balance_available_after,
        "pending_usd": last_entry.balance_pending_after,
        "frozen_usd": last_entry.balance_frozen_after,
        "total_usd": last_entry.balance_available_after + last_entry.balance_pending_after
    }


async def _create_ledger_entry(
    db: AsyncSession,
    user_id: UUID,
    entry_type: LedgerEntryType,
    amount: float,
    available_delta: float = 0,
    pending_delta: float = 0,
    frozen_delta: float = 0,
    order_id: Optional[UUID] = None,
    giftcard_id: Optional[UUID] = None,
    admin_id: Optional[UUID] = None,
    reason: Optional[str] = None,
    description: Optional[str] = None
) -> WalletLedger:
    """Create immutable ledger entry"""
    # Get current balance
    balance = await get_user_balance(db, user_id)
    
    # Calculate new balances
    new_available = balance["available_usd"] + available_delta
    new_pending = balance["pending_usd"] + pending_delta
    new_frozen = balance["frozen_usd"] + frozen_delta
    
    # Validate no negative balances
    if new_available < 0:
        raise AppException(ErrorCodes.INSUFFICIENT_BALANCE, "Insufficient available balance")
    if new_pending < 0:
        raise AppException(ErrorCodes.WALLET_ERROR, "Invalid pending balance")
    if new_frozen < 0:
        raise AppException(ErrorCodes.WALLET_ERROR, "Invalid frozen balance")
    
    entry = WalletLedger(
        user_id=user_id,
        entry_type=entry_type,
        amount_usd=amount,
        balance_available_after=new_available,
        balance_pending_after=new_pending,
        balance_frozen_after=new_frozen,
        order_id=order_id,
        giftcard_id=giftcard_id,
        admin_id=admin_id,
        reason=reason,
        description=description
    )
    
    db.add(entry)
    return entry


async def deposit(db: AsyncSession, user_id: UUID, amount: float, description: str = "Deposit") -> WalletLedger:
    """Mock deposit - add to available balance"""
    entry = await _create_ledger_entry(
        db, user_id, LedgerEntryType.DEPOSIT,
        amount=amount, available_delta=amount,
        description=description
    )
    await db.commit()
    return entry


async def hold_escrow(db: AsyncSession, user_id: UUID, amount: float, order_id: UUID, description: str) -> WalletLedger:
    """Hold escrow from buyer - deduct from available"""
    entry = await _create_ledger_entry(
        db, user_id, LedgerEntryType.ESCROW_HOLD,
        amount=-amount, available_delta=-amount,
        order_id=order_id, description=description
    )
    return entry


async def release_escrow_to_pending(db: AsyncSession, user_id: UUID, amount: float, order_id: UUID, description: str) -> WalletLedger:
    """Release escrow to seller's pending balance"""
    entry = await _create_ledger_entry(
        db, user_id, LedgerEntryType.ESCROW_RELEASE_PENDING,
        amount=amount, pending_delta=amount,
        order_id=order_id, description=description
    )
    return entry


async def release_pending_to_available(db: AsyncSession, user_id: UUID, amount: float, order_id: UUID, description: str) -> WalletLedger:
    """Release from pending to available (after 10 days)"""
    entry = await _create_ledger_entry(
        db, user_id, LedgerEntryType.ESCROW_RELEASE_AVAILABLE,
        amount=amount, pending_delta=-amount, available_delta=amount,
        order_id=order_id, description=description
    )
    await db.commit()
    return entry


async def refund_escrow(db: AsyncSession, user_id: UUID, amount: float, order_id: UUID, description: str) -> WalletLedger:
    """Refund escrow to buyer"""
    entry = await _create_ledger_entry(
        db, user_id, LedgerEntryType.REFUND,
        amount=amount, available_delta=amount,
        order_id=order_id, description=description
    )
    return entry


async def request_withdrawal(db: AsyncSession, user_id: UUID, amount: float, description: str) -> WalletLedger:
    """Request withdrawal - move from available to pending"""
    entry = await _create_ledger_entry(
        db, user_id, LedgerEntryType.WITHDRAWAL_REQUEST,
        amount=-amount, available_delta=-amount,
        description=description
    )
    await db.commit()
    return entry


async def admin_credit(db: AsyncSession, user_id: UUID, amount: float, admin_id: UUID, reason: str) -> WalletLedger:
    """Admin credit user balance"""
    entry = await _create_ledger_entry(
        db, user_id, LedgerEntryType.ADMIN_CREDIT,
        amount=amount, available_delta=amount,
        admin_id=admin_id, reason=reason,
        description=f"Admin credit: {reason}"
    )
    await db.commit()
    return entry


async def admin_debit(db: AsyncSession, user_id: UUID, amount: float, admin_id: UUID, reason: str) -> WalletLedger:
    """Admin debit user balance"""
    entry = await _create_ledger_entry(
        db, user_id, LedgerEntryType.ADMIN_DEBIT,
        amount=-amount, available_delta=-amount,
        admin_id=admin_id, reason=reason,
        description=f"Admin debit: {reason}"
    )
    await db.commit()
    return entry


async def admin_freeze(db: AsyncSession, user_id: UUID, amount: float, admin_id: UUID, reason: str) -> WalletLedger:
    """Admin freeze user balance"""
    entry = await _create_ledger_entry(
        db, user_id, LedgerEntryType.ADMIN_FREEZE_HOLD,
        amount=-amount, available_delta=-amount, frozen_delta=amount,
        admin_id=admin_id, reason=reason,
        description=f"Admin freeze: {reason}"
    )
    await db.commit()
    return entry


async def admin_unfreeze(db: AsyncSession, user_id: UUID, amount: float, admin_id: UUID, reason: str) -> WalletLedger:
    """Admin unfreeze user balance"""
    entry = await _create_ledger_entry(
        db, user_id, LedgerEntryType.ADMIN_FREEZE_RELEASE,
        amount=amount, available_delta=amount, frozen_delta=-amount,
        admin_id=admin_id, reason=reason,
        description=f"Admin unfreeze: {reason}"
    )
    await db.commit()
    return entry


async def redeem_giftcard(db: AsyncSession, user_id: UUID, code: str) -> WalletLedger:
    """Redeem gift card"""
    result = await db.execute(
        select(GiftCard).where(
            GiftCard.code == code,
            GiftCard.is_active == True,
            GiftCard.is_redeemed == False
        ).with_for_update()
    )
    giftcard = result.scalar_one_or_none()
    
    if not giftcard:
        raise AppException(ErrorCodes.NOT_FOUND, "Invalid or already redeemed gift card")
    
    # Check expiry
    if giftcard.expires_at and giftcard.expires_at < datetime.now(timezone.utc):
        raise AppException(ErrorCodes.VALIDATION_ERROR, "Gift card has expired")
    
    # Mark as redeemed
    giftcard.is_redeemed = True
    giftcard.redeemed_by = user_id
    giftcard.redeemed_at = datetime.now(timezone.utc)
    
    # Add to balance
    entry = await _create_ledger_entry(
        db, user_id, LedgerEntryType.GIFTCARD_REDEEM,
        amount=giftcard.amount_usd, available_delta=giftcard.amount_usd,
        giftcard_id=giftcard.id,
        description=f"Gift card redeemed: {code}"
    )
    
    await db.commit()
    return entry


async def get_wallet_history(
    db: AsyncSession,
    user_id: UUID,
    page: int = 1,
    page_size: int = 20
) -> WalletHistoryResponse:
    """Get wallet transaction history"""
    query = select(WalletLedger).where(WalletLedger.user_id == user_id)
    
    # Count
    count_result = await db.execute(
        select(func.count(WalletLedger.id)).where(WalletLedger.user_id == user_id)
    )
    total = count_result.scalar() or 0
    
    # Paginate
    query = query.order_by(WalletLedger.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    
    result = await db.execute(query)
    transactions = result.scalars().all()
    
    return WalletHistoryResponse(
        transactions=[WalletTransactionResponse.model_validate(t) for t in transactions],
        total=total,
        page=page,
        page_size=page_size
    )
