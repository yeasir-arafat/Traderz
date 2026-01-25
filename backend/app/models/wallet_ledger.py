from sqlalchemy import Column, String, DateTime, Text, Float, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base
from datetime import datetime, timezone
import uuid
import enum


class LedgerEntryType(str, enum.Enum):
    DEPOSIT = "deposit"
    ESCROW_HOLD = "escrow_hold"
    ESCROW_RELEASE_PENDING = "escrow_release_pending"
    ESCROW_RELEASE_AVAILABLE = "escrow_release_available"
    PLATFORM_FEE = "platform_fee"
    REFUND = "refund"
    WITHDRAWAL_REQUEST = "withdrawal_request"
    WITHDRAWAL_PAID = "withdrawal_paid"
    ADMIN_CREDIT = "admin_credit"
    ADMIN_DEBIT = "admin_debit"
    ADMIN_FREEZE_HOLD = "admin_freeze_hold"
    ADMIN_FREEZE_RELEASE = "admin_freeze_release"
    GIFTCARD_REDEEM = "giftcard_redeem"


class WalletLedger(Base):
    """Immutable ledger for all wallet transactions"""
    __tablename__ = "wallet_ledger"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    entry_type = Column(Enum(LedgerEntryType), nullable=False, index=True)
    amount_usd = Column(Float, nullable=False)  # Positive for credit, negative for debit
    
    # Balance tracking
    balance_available_after = Column(Float, nullable=False)
    balance_pending_after = Column(Float, nullable=False)
    balance_frozen_after = Column(Float, nullable=False)
    
    # Reference
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id"), nullable=True, index=True)
    giftcard_id = Column(UUID(as_uuid=True), ForeignKey("giftcards.id"), nullable=True)
    
    # Admin actions
    admin_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    reason = Column(Text, nullable=True)
    
    # Metadata
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
