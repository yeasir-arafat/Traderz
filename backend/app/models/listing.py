from sqlalchemy import Column, String, Boolean, DateTime, Text, Float, Integer, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship
from app.core.database import Base
from datetime import datetime, timezone
import uuid
import enum


class ListingStatus(str, enum.Enum):
    DRAFT = "draft"
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    SOLD = "sold"
    INACTIVE = "inactive"


class Listing(Base):
    __tablename__ = "listings"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    seller_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    game_id = Column(UUID(as_uuid=True), ForeignKey("games.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # Basic info
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    price_usd = Column(Float, nullable=False)  # Always stored in USD
    
    # Platform and region (multiple allowed)
    platforms = Column(ARRAY(String), nullable=False, default=[])  # ['PC', 'PS5']
    regions = Column(ARRAY(String), nullable=False, default=[])  # ['Global', 'NA']
    
    # Account details
    account_level = Column(String(50), nullable=True)
    account_rank = Column(String(50), nullable=True)
    account_features = Column(Text, nullable=True)  # JSON string of features
    
    # Images (max 5)
    images = Column(ARRAY(String), nullable=False, default=[])
    
    # Status
    status = Column(Enum(ListingStatus), default=ListingStatus.DRAFT, nullable=False, index=True)
    rejection_reason = Column(Text, nullable=True)
    
    # Auto-approve for trusted sellers
    auto_approved = Column(Boolean, default=False, nullable=False)
    
    # Stats
    view_count = Column(Integer, default=0, nullable=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    # Relationships
    seller = relationship("User", back_populates="listings", foreign_keys=[seller_id])
    game = relationship("Game", back_populates="listings")
    orders = relationship("Order", back_populates="listing")
