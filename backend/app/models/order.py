from sqlalchemy import Column, String, DateTime, Text, Float, ForeignKey, Enum, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base
from datetime import datetime, timezone
import uuid
import enum


class OrderStatus(str, enum.Enum):
    CREATED = "created"
    PAID = "paid"
    DELIVERED = "delivered"
    COMPLETED = "completed"
    DISPUTED = "disputed"
    REFUNDED = "refunded"
    CANCELLED = "cancelled"


class Order(Base):
    __tablename__ = "orders"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_number = Column(String(20), unique=True, nullable=False, index=True)  # PTZ1000, PTZ1001, etc.
    
    listing_id = Column(UUID(as_uuid=True), ForeignKey("listings.id", ondelete="SET NULL"), nullable=True, index=True)
    buyer_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    seller_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # Price details (all in USD)
    amount_usd = Column(Float, nullable=False)
    platform_fee_usd = Column(Float, nullable=False)
    seller_earnings_usd = Column(Float, nullable=False)
    
    # Fee calculation details
    base_fee_percent = Column(Float, nullable=False)
    seller_discount_percent = Column(Float, default=0.0, nullable=False)
    effective_fee_percent = Column(Float, nullable=False)
    
    # Status
    status = Column(Enum(OrderStatus), default=OrderStatus.CREATED, nullable=False, index=True)
    
    # Delivery info
    delivery_info = Column(Text, nullable=True)  # Account credentials (encrypted)
    delivered_at = Column(DateTime(timezone=True), nullable=True)
    
    # Dispute
    dispute_reason = Column(Text, nullable=True)
    disputed_at = Column(DateTime(timezone=True), nullable=True)
    dispute_resolved_at = Column(DateTime(timezone=True), nullable=True)
    dispute_resolution = Column(Text, nullable=True)
    
    # Completion
    completed_at = Column(DateTime(timezone=True), nullable=True)
    completed_by = Column(String(20), nullable=True)  # 'buyer', 'admin', 'auto'
    
    # Seller protection (pending earnings release after 10 days)
    seller_pending_release_at = Column(DateTime(timezone=True), nullable=True)
    seller_earnings_released = Column(DateTime(timezone=True), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    refunded_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    listing = relationship("Listing", back_populates="orders")
    buyer = relationship("User", back_populates="buyer_orders", foreign_keys=[buyer_id])
    seller = relationship("User", back_populates="seller_orders", foreign_keys=[seller_id])
    conversation = relationship("Conversation", back_populates="order", uselist=False)


class OrderCounter(Base):
    """Counter for generating sequential order numbers"""
    __tablename__ = "order_counter"
    
    id = Column(Integer, primary_key=True, default=1)
    current_value = Column(Integer, default=1000, nullable=False)
