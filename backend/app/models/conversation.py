from sqlalchemy import Column, String, DateTime, Text, Boolean, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship
from app.core.database import Base
from datetime import datetime, timezone
import uuid
import enum


class ConversationType(str, enum.Enum):
    CASUAL = "casual"  # Buyer-seller DM
    ORDER = "order"    # Order-specific group chat
    SUPPORT = "support"  # User to admin support chat


class SupportRequestStatus(str, enum.Enum):
    PENDING = "pending"  # Waiting for admin to accept
    ACTIVE = "active"    # Admin has accepted, chat is active
    CLOSED = "closed"    # Support request closed


class Conversation(Base):
    __tablename__ = "conversations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_type = Column(Enum(ConversationType), nullable=False)
    
    # For order chats
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"), nullable=True, unique=True, index=True)
    
    # For casual DMs (listing-based start)
    listing_id = Column(UUID(as_uuid=True), ForeignKey("listings.id", ondelete="SET NULL"), nullable=True)
    
    # Participants
    participant_ids = Column(ARRAY(UUID(as_uuid=True)), nullable=False, default=[])
    
    # Name (for order chats, uses order number)
    name = Column(String(100), nullable=True)
    
    # Admin involvement
    admin_joined = Column(Boolean, default=False, nullable=False)
    admin_joined_at = Column(DateTime(timezone=True), nullable=True)
    
    # Support chat specific fields
    support_status = Column(Enum(SupportRequestStatus), nullable=True)  # Only for support chats
    support_subject = Column(String(255), nullable=True)  # Subject of support request
    requester_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)  # User who initiated support
    accepted_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)  # First admin who accepted
    accepted_at = Column(DateTime(timezone=True), nullable=True)
    closed_at = Column(DateTime(timezone=True), nullable=True)
    closed_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
    last_message_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    messages = relationship("Message", back_populates="conversation", order_by="Message.created_at")
    order = relationship("Order", back_populates="conversation")
    requester = relationship("User", foreign_keys=[requester_id])
    accepted_by = relationship("User", foreign_keys=[accepted_by_id])
    closed_by = relationship("User", foreign_keys=[closed_by_id])


class Message(Base):
    __tablename__ = "messages"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # Content
    content = Column(Text, nullable=False)
    is_system_message = Column(Boolean, default=False, nullable=False)
    
    # Attachments (image URLs)
    attachments = Column(ARRAY(String), nullable=True, default=[])
    
    # Read receipts
    read_by = Column(ARRAY(UUID(as_uuid=True)), nullable=False, default=[])
    
    # Moderation
    is_hidden = Column(Boolean, default=False, nullable=False)
    hidden_at = Column(DateTime(timezone=True), nullable=True)
    hidden_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    hidden_reason = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    
    # Relationships
    conversation = relationship("Conversation", back_populates="messages")
