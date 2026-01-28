from sqlalchemy import Column, String, Boolean, DateTime, Enum, Text, Integer, ForeignKey, Float
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship
from app.core.database import Base
from datetime import datetime, timezone
import uuid
import enum


class UserRole(str, enum.Enum):
    BUYER = "buyer"
    SELLER = "seller"
    ADMIN = "admin"
    SUPER_ADMIN = "super_admin"


class AuthProvider(str, enum.Enum):
    EMAIL = "email"
    GOOGLE = "google"
    FACEBOOK = "facebook"


class User(Base):
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=True)  # Null for social login
    full_name = Column(String(100), nullable=False)
    phone_number = Column(String(20), nullable=True)
    
    # Address fields
    address_line1 = Column(String(255), nullable=True)
    address_line2 = Column(String(255), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    country = Column(String(100), nullable=True)
    postal_code = Column(String(20), nullable=True)
    
    # Roles (can have multiple)
    roles = Column(ARRAY(String), default=["buyer"], nullable=False)
    
    # Auth provider
    auth_provider = Column(Enum(AuthProvider), default=AuthProvider.EMAIL, nullable=False)
    firebase_uid = Column(String(128), unique=True, nullable=True, index=True)
    
    # Terms acceptance
    terms_accepted = Column(Boolean, default=False, nullable=False)
    terms_accepted_at = Column(DateTime(timezone=True), nullable=True)
    terms_version = Column(String(20), nullable=True)
    privacy_version = Column(String(20), nullable=True)
    
    # Profile completion flags
    profile_completed = Column(Boolean, default=False, nullable=False)
    
    # KYC status
    kyc_status = Column(String(20), default="not_submitted", nullable=False)  # not_submitted, pending, approved, rejected
    kyc_approved_at = Column(DateTime(timezone=True), nullable=True)
    
    # Seller info
    seller_level = Column(String(20), default="bronze", nullable=False)  # bronze, silver, gold, platinum, diamond
    total_sales_volume_usd = Column(Float, default=0.0, nullable=False)
    seller_rating = Column(Float, default=0.0, nullable=False)
    total_reviews = Column(Integer, default=0, nullable=False)
    
    # Status
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    status = Column(String(20), default="active", nullable=False)  # active, suspended, banned
    status_reason = Column(Text, nullable=True)
    status_changed_at = Column(DateTime(timezone=True), nullable=True)
    status_changed_by = Column(UUID(as_uuid=True), ForeignKey("users.id", use_alter=True), nullable=True)
    
    # Profile lock override (for KYC unlock)
    profile_unlocked = Column(Boolean, default=False, nullable=False)
    profile_unlock_reason = Column(Text, nullable=True)
    profile_unlocked_at = Column(DateTime(timezone=True), nullable=True)
    profile_unlocked_by = Column(UUID(as_uuid=True), ForeignKey("users.id", use_alter=True), nullable=True)
    
    # Admin-specific fields
    created_by_admin = Column(UUID(as_uuid=True), ForeignKey("users.id", use_alter=True), nullable=True)
    admin_notes = Column(Text, nullable=True)
    admin_permissions = Column(ARRAY(String), default=[], nullable=False)  # LISTINGS_REVIEW, KYC_REVIEW, DISPUTE_RESOLVE, FAQ_EDIT
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    listings = relationship("Listing", back_populates="seller", foreign_keys="Listing.seller_id")
    buyer_orders = relationship("Order", back_populates="buyer", foreign_keys="Order.buyer_id")
    seller_orders = relationship("Order", back_populates="seller", foreign_keys="Order.seller_id")
    notifications = relationship("Notification", back_populates="user")
    kyc_submissions = relationship("KycSubmission", back_populates="user", foreign_keys="KycSubmission.user_id")
    reviews_given = relationship("Review", back_populates="reviewer", foreign_keys="Review.reviewer_id")
    reviews_received = relationship("Review", back_populates="reviewee", foreign_keys="Review.reviewee_id")
