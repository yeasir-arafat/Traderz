"""
Enhanced Admin Action model with comprehensive audit logging
for Super Admin system with guardrails.
"""
from sqlalchemy import Column, String, DateTime, Text, Float, ForeignKey, Enum, Boolean, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base
from datetime import datetime, timezone
import uuid
import enum


class AdminActionType(str, enum.Enum):
    # Listing actions
    APPROVE_LISTING = "approve_listing"
    REJECT_LISTING = "reject_listing"
    HIDE_LISTING = "hide_listing"
    RESTORE_LISTING = "restore_listing"
    
    # KYC actions
    APPROVE_KYC = "approve_kyc"
    REJECT_KYC = "reject_kyc"
    UNLOCK_PROFILE = "unlock_profile"
    
    # Order actions
    RESOLVE_DISPUTE = "resolve_dispute"
    FORCE_COMPLETE = "force_complete"
    FORCE_REFUND = "force_refund"
    EXTEND_DISPUTE_WINDOW = "extend_dispute_window"
    
    # User actions
    BAN_USER = "ban_user"
    UNBAN_USER = "unban_user"
    FORCE_LOGOUT = "force_logout"
    PROMOTE_ROLE = "promote_role"
    DEMOTE_ROLE = "demote_role"
    
    # Admin management
    CREATE_ADMIN = "create_admin"
    DISABLE_ADMIN = "disable_admin"
    ENABLE_ADMIN = "enable_admin"
    
    # Wallet actions
    WALLET_CREDIT = "wallet_credit"
    WALLET_DEBIT = "wallet_debit"
    WALLET_FREEZE = "wallet_freeze"
    WALLET_UNFREEZE = "wallet_unfreeze"
    
    # Config actions
    UPDATE_CONFIG = "update_config"
    UPDATE_LEGAL = "update_legal"
    
    # Game/Fee actions
    CREATE_GAME = "create_game"
    UPDATE_GAME = "update_game"
    TOGGLE_GAME = "toggle_game"
    UPDATE_FEE_RULE = "update_fee_rule"
    
    # Content moderation
    HIDE_MESSAGE = "hide_message"
    
    # Gift cards
    CREATE_GIFTCARD = "create_giftcard"
    DEACTIVATE_GIFTCARD = "deactivate_giftcard"


class TargetType(str, enum.Enum):
    USER = "user"
    LISTING = "listing"
    ORDER = "order"
    KYC = "kyc"
    CONFIG = "config"
    GAME = "game"
    FEE_RULE = "fee_rule"
    MESSAGE = "message"
    GIFTCARD = "giftcard"
    LEGAL = "legal"


class ConfirmationMethod(str, enum.Enum):
    PASSWORD = "password"
    OTP = "otp"
    PHRASE = "phrase"


class AdminAction(Base):
    """
    Immutable audit log for all admin/superadmin actions.
    Never allow UPDATE or DELETE on this table.
    """
    __tablename__ = "admin_actions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Actor (admin/superadmin who performed action)
    actor_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    actor_role = Column(String(50), nullable=False)  # Role at time of action
    
    # Action details
    action_type = Column(Enum(AdminActionType), nullable=False, index=True)
    
    # Target details
    target_type = Column(Enum(TargetType), nullable=True)
    target_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    
    # Legacy target columns for backwards compatibility
    admin_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    target_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    target_listing_id = Column(UUID(as_uuid=True), ForeignKey("listings.id"), nullable=True)
    target_order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id"), nullable=True)
    target_kyc_id = Column(UUID(as_uuid=True), ForeignKey("kyc_submissions.id"), nullable=True)
    
    # Reason (REQUIRED for all finance and user actions)
    reason = Column(Text, nullable=True)
    
    # Snapshots for audit trail
    before_snapshot = Column(JSONB, nullable=True)  # State before action
    after_snapshot = Column(JSONB, nullable=True)   # State after action
    
    # Additional metadata
    details = Column(JSONB, nullable=True)  # Action-specific details
    
    # Step-up confirmation tracking
    confirmation_method = Column(Enum(ConfirmationMethod), nullable=True)
    confirmed_at = Column(DateTime(timezone=True), nullable=True)
    confirm_phrase_used = Column(String(100), nullable=True)
    
    # Request metadata (for security audit)
    ip_address = Column(String(45), nullable=True)  # IPv6 max length
    user_agent = Column(String(500), nullable=True)
    
    # Idempotency
    idempotency_key = Column(String(100), nullable=True, unique=True, index=True)
    
    # Timestamp
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    
    # Composite indexes for common queries
    __table_args__ = (
        Index('ix_admin_actions_actor_created', 'actor_id', 'created_at'),
        Index('ix_admin_actions_type_created', 'action_type', 'created_at'),
        Index('ix_admin_actions_target', 'target_type', 'target_id'),
    )


class UserSession(Base):
    """Track active user sessions for force logout functionality"""
    __tablename__ = "user_sessions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Token info (store hashed refresh token)
    token_hash = Column(String(255), nullable=False)
    
    # Session metadata
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    device_info = Column(String(255), nullable=True)
    
    # Status
    is_active = Column(Boolean, default=True, nullable=False)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    revoked_reason = Column(String(100), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    last_used_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)


class LegalDocument(Base):
    """Store terms of service and privacy policy versions"""
    __tablename__ = "legal_documents"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    doc_type = Column(String(50), nullable=False)  # 'terms' or 'privacy'
    version = Column(String(20), nullable=False)
    content_html = Column(Text, nullable=False)
    
    # Status
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Audit
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    
    __table_args__ = (
        Index('ix_legal_documents_type_version', 'doc_type', 'version', unique=True),
    )


# Legacy table for backwards compatibility
class AdminBalanceAction(Base):
    """Audit log for admin wallet actions (legacy, kept for migration)"""
    __tablename__ = "admin_balance_actions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    admin_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    target_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    
    action_type = Column(String(50), nullable=False)
    amount_usd = Column(Float, nullable=False)
    reason = Column(Text, nullable=False)
    
    balance_before = Column(Float, nullable=False)
    balance_after = Column(Float, nullable=False)
    
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
