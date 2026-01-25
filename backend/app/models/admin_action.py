from sqlalchemy import Column, String, DateTime, Text, Float, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base
from datetime import datetime, timezone
import uuid
import enum


class AdminActionType(str, enum.Enum):
    APPROVE_LISTING = "approve_listing"
    REJECT_LISTING = "reject_listing"
    APPROVE_KYC = "approve_kyc"
    REJECT_KYC = "reject_kyc"
    RESOLVE_DISPUTE = "resolve_dispute"
    COMPLETE_ORDER = "complete_order"
    REFUND_ORDER = "refund_order"
    BAN_USER = "ban_user"
    UNBAN_USER = "unban_user"
    UPDATE_CONFIG = "update_config"


class AdminAction(Base):
    __tablename__ = "admin_actions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    admin_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    action_type = Column(Enum(AdminActionType), nullable=False)
    
    # Target
    target_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    target_listing_id = Column(UUID(as_uuid=True), ForeignKey("listings.id"), nullable=True)
    target_order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id"), nullable=True)
    target_kyc_id = Column(UUID(as_uuid=True), ForeignKey("kyc_submissions.id"), nullable=True)
    
    # Details
    reason = Column(Text, nullable=True)
    details = Column(Text, nullable=True)  # JSON string
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)


class AdminBalanceAction(Base):
    """Audit log for admin wallet actions"""
    __tablename__ = "admin_balance_actions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    admin_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    target_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    
    action_type = Column(String(50), nullable=False)  # credit, debit, freeze, unfreeze
    amount_usd = Column(Float, nullable=False)
    reason = Column(Text, nullable=False)
    
    # Balance snapshot
    balance_before = Column(Float, nullable=False)
    balance_after = Column(Float, nullable=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
