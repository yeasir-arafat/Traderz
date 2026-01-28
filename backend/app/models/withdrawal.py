"""
Withdrawal request model for managing withdrawal requests.
"""
from sqlalchemy import Column, String, DateTime, Text, Float, Boolean, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base
from datetime import datetime, timezone
import uuid
import enum


class WithdrawalStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class WithdrawalRequest(Base):
    """Withdrawal requests from users"""
    __tablename__ = "withdrawal_requests"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Amount
    amount_usd = Column(Float, nullable=False)
    
    # Payment details (user provided)
    payment_method = Column(String(50), nullable=False)  # bank, paypal, crypto, etc.
    payment_details = Column(Text, nullable=True)  # JSON or text with payment info
    
    # Status
    status = Column(Enum(WithdrawalStatus), default=WithdrawalStatus.PENDING, nullable=False, index=True)
    
    # Admin processing
    processed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    processed_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    admin_notes = Column(Text, nullable=True)
    
    # Reference to ledger entry
    ledger_entry_id = Column(UUID(as_uuid=True), ForeignKey("wallet_ledger.id"), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)


class ContentReport(Base):
    """Reports for flagged content (listings, messages, users)"""
    __tablename__ = "content_reports"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Reporter
    reporter_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # Target
    report_type = Column(String(50), nullable=False)  # listing, message, user
    target_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    
    # Report details
    reason = Column(String(100), nullable=False)  # spam, inappropriate, scam, etc.
    description = Column(Text, nullable=True)
    
    # Status
    status = Column(String(20), default="pending", nullable=False)  # pending, reviewed, dismissed, actioned
    
    # Admin review
    reviewed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    review_notes = Column(Text, nullable=True)
    action_taken = Column(String(100), nullable=True)  # hidden, banned, warning, etc.
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
