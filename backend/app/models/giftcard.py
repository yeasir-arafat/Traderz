"""
Gift Card model for voucher/gift card system.
Updated to use status enum per user requirements:
- 16-digit numeric code
- Single-use, no partial usage
- Status: active | redeemed | deactivated
"""
from sqlalchemy import Column, String, DateTime, Text, Float, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base
from datetime import datetime, timezone
import uuid


class GiftCard(Base):
    __tablename__ = "giftcards"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(50), unique=True, nullable=False, index=True)  # 16-digit numeric
    amount_usd = Column(Float, nullable=False)  # Positive value
    
    # Status field (new approach)
    status = Column(String(20), default="active", nullable=False, index=True)
    
    # Legacy fields (kept for backward compatibility)
    is_active = Column(Boolean, default=True, nullable=False)
    is_redeemed = Column(Boolean, default=False, nullable=False)
    
    # Redemption tracking
    redeemed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    redeemed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Created by admin/superadmin
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=True)  # Optional, default null = no expiry
