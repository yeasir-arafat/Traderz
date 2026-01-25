from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base
from datetime import datetime, timezone
import uuid
import enum


class KycStatus(str, enum.Enum):
    NOT_SUBMITTED = "not_submitted"
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class KycDocType(str, enum.Enum):
    PASSPORT = "passport"
    DRIVING_LICENCE = "driving_licence"
    NID = "nid"  # National ID
    EQUIVALENT = "equivalent"


class KycSubmission(Base):
    __tablename__ = "kyc_submissions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Document info
    doc_type = Column(Enum(KycDocType), nullable=False)
    doc_front_url = Column(String(500), nullable=False)
    doc_back_url = Column(String(500), nullable=True)
    selfie_url = Column(String(500), nullable=True)
    
    # Status
    status = Column(Enum(KycStatus), default=KycStatus.PENDING, nullable=False, index=True)
    
    # Review
    review_note = Column(Text, nullable=True)
    reviewed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
    
    # Relationships
    user = relationship("User", back_populates="kyc_submissions", foreign_keys=[user_id])
