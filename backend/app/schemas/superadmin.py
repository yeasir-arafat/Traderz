"""
Schemas for Super Admin system with comprehensive validation.
"""
from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional, List, Any, Dict
from datetime import datetime
from uuid import UUID
from enum import Enum


# ============== Enums ==============

class ConfirmationMethod(str, Enum):
    PASSWORD = "password"
    OTP = "otp"
    PHRASE = "phrase"


# ============== Base Schemas ==============

class StepUpConfirmation(BaseModel):
    """Step-up confirmation for dangerous actions"""
    password: Optional[str] = None
    confirm_phrase: Optional[str] = None
    
    @model_validator(mode='after')
    def validate_confirmation(self):
        if not self.password and not self.confirm_phrase:
            raise ValueError("Either password or confirm_phrase required for this action")
        return self


# ============== Admin Management ==============

class CreateAdminRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=255)
    full_name: str = Field(..., min_length=2, max_length=100)
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8)
    phone_number: Optional[str] = None
    address_line1: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    
    # Confirmation
    admin_password: str = Field(..., description="Super admin password for confirmation")


class AdminToggleRequest(BaseModel):
    is_active: bool
    reason: Optional[str] = None
    admin_password: str = Field(..., description="Super admin password for confirmation")


class AdminResponse(BaseModel):
    id: UUID
    username: str
    email: str
    full_name: str
    phone_number: Optional[str] = None
    roles: List[str]
    is_active: bool
    status: str
    created_at: datetime
    last_login_at: Optional[datetime] = None
    created_by_admin: Optional[UUID] = None
    
    class Config:
        from_attributes = True


# ============== User Management ==============

class UserFilterParams(BaseModel):
    role: Optional[str] = None
    status: Optional[str] = None  # active, suspended, banned
    kyc_status: Optional[str] = None
    q: Optional[str] = None  # Search query
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100)


class UserStatusUpdateRequest(BaseModel):
    status: str = Field(..., pattern="^(active|suspended|banned)$")
    reason: str = Field(..., min_length=5)
    admin_password: Optional[str] = None  # Required for ban


class UserRoleUpdateRequest(BaseModel):
    roles: List[str]
    reason: str = Field(..., min_length=5)
    admin_password: str = Field(..., description="Required for role changes")


class UserDetailResponse(BaseModel):
    id: UUID
    username: str
    email: str
    full_name: str
    phone_number: Optional[str] = None
    roles: List[str]
    is_active: bool
    status: str
    status_reason: Optional[str] = None
    kyc_status: str
    seller_level: str
    seller_rating: float
    total_reviews: int
    total_sales_volume_usd: float
    terms_accepted: bool
    profile_unlocked: bool
    created_at: datetime
    last_login_at: Optional[datetime] = None
    
    # Computed fields
    wallet_balance: Optional[float] = None
    total_orders: Optional[int] = None
    total_listings: Optional[int] = None
    
    class Config:
        from_attributes = True


class UnlockProfileRequest(BaseModel):
    reason: str = Field(..., min_length=10)
    admin_password: str = Field(..., description="Required for profile unlock")


# ============== Wallet/Finance ==============

class WalletCreditRequest(BaseModel):
    user_id: UUID
    amount_usd: float = Field(..., gt=0, le=100000)
    reason: str = Field(..., min_length=10)


class WalletDebitRequest(BaseModel):
    user_id: UUID
    amount_usd: float = Field(..., gt=0, le=100000)
    reason: str = Field(..., min_length=10)
    admin_password: str = Field(..., description="Required for debit")
    confirm_phrase: Optional[str] = None  # Required for amounts > $1000


class WalletFreezeRequest(BaseModel):
    user_id: UUID
    amount_usd: float = Field(..., gt=0, le=100000)
    reason: str = Field(..., min_length=10)
    admin_password: str = Field(..., description="Required for freeze")
    confirm_phrase: Optional[str] = None  # Required for amounts > $1000


class WalletUnfreezeRequest(BaseModel):
    user_id: UUID
    amount_usd: float = Field(..., gt=0, le=100000)
    reason: str = Field(..., min_length=10)


class WalletActionResponse(BaseModel):
    success: bool
    user_id: UUID
    action: str
    amount_usd: float
    balance_before: float
    balance_after: float
    frozen_before: float
    frozen_after: float
    audit_id: UUID


# ============== Order Overrides ==============

class ForceOrderActionRequest(BaseModel):
    reason: str = Field(..., min_length=10)
    admin_password: str = Field(..., description="Required for order override")
    confirm_phrase: Optional[str] = None  # Required for large amounts


class ExtendDisputeWindowRequest(BaseModel):
    hours: int = Field(..., ge=1, le=168)  # Max 7 days
    reason: str = Field(..., min_length=10)


# ============== Platform Config ==============

class PlatformConfigUpdate(BaseModel):
    usd_to_bdt_rate: Optional[float] = Field(None, gt=0)
    dispute_window_hours: Optional[int] = Field(None, ge=6, le=168)
    seller_protection_days: Optional[int] = Field(None, ge=1, le=30)
    kyc_required_for_seller: Optional[bool] = None
    listing_approval_required: Optional[bool] = None
    max_image_size_mb: Optional[int] = Field(None, ge=1, le=20)
    max_images_per_listing: Optional[int] = Field(None, ge=1, le=20)
    default_fee_percent: Optional[float] = Field(None, ge=0, le=50)


class PlatformConfigResponse(BaseModel):
    usd_to_bdt_rate: float
    dispute_window_hours: int
    seller_protection_days: int
    kyc_required_for_seller: bool
    listing_approval_required: bool
    max_image_size_mb: int
    max_images_per_listing: int
    default_fee_percent: float


# ============== Legal Documents ==============

class LegalDocumentUpdate(BaseModel):
    terms_html: Optional[str] = None
    privacy_html: Optional[str] = None
    terms_version: Optional[str] = None
    privacy_version: Optional[str] = None


# ============== Content Moderation ==============

class HideListingRequest(BaseModel):
    reason: str = Field(..., min_length=10)


class HideMessageRequest(BaseModel):
    reason: str = Field(..., min_length=5)


# ============== Dashboard Stats ==============

class KPICard(BaseModel):
    label: str
    value: Any
    change: Optional[float] = None  # Percentage change
    trend: Optional[str] = None  # up, down, stable


class FinanceStats(BaseModel):
    total_deposits_usd: float
    total_withdrawals_usd: float
    total_escrow_held_usd: float
    total_seller_pending_usd: float
    total_frozen_usd: float
    platform_fee_all_time_usd: float
    platform_fee_30d_usd: float


class ChartDataPoint(BaseModel):
    date: str
    value: float
    label: Optional[str] = None


class PieChartData(BaseModel):
    name: str
    value: int


class DashboardResponse(BaseModel):
    # KPI cards
    total_users: int
    total_sellers: int
    active_listings: int
    pending_listings: int
    pending_kyc: int
    disputed_orders: int
    orders_in_delivery: int
    platform_earnings_7d: float
    
    # Finance stats
    finance: FinanceStats
    
    # Chart data
    orders_over_time: List[ChartDataPoint]
    revenue_over_time: List[ChartDataPoint]
    listing_status_distribution: List[PieChartData]
    kyc_status_distribution: List[PieChartData]
    
    # Action queues
    pending_listings_queue: List[Dict[str, Any]]
    pending_kyc_queue: List[Dict[str, Any]]
    recent_disputes: List[Dict[str, Any]]
    recent_admin_actions: List[Dict[str, Any]]
    
    # System health
    system_health: Dict[str, Any]


# ============== Admin Actions ==============

class AdminActionResponse(BaseModel):
    id: UUID
    actor_id: UUID
    actor_role: str
    action_type: str
    target_type: Optional[str] = None
    target_id: Optional[UUID] = None
    reason: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime
    details: Optional[Dict[str, Any]] = None
    
    class Config:
        from_attributes = True


class AdminActionFilter(BaseModel):
    action_type: Optional[str] = None
    actor_id: Optional[UUID] = None
    target_type: Optional[str] = None
    from_date: Optional[datetime] = None
    to_date: Optional[datetime] = None
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100)


# ============== Game Management ==============

class GameCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    slug: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = None
    image_url: Optional[str] = None
    platforms: List[str] = []


class GameUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    description: Optional[str] = None
    image_url: Optional[str] = None
    is_active: Optional[bool] = None
    display_order: Optional[int] = None


class FeeRuleRequest(BaseModel):
    game_id: UUID
    platform_id: Optional[UUID] = None
    seller_level: Optional[str] = None
    fee_percent: float = Field(..., ge=0, le=50)
    description: Optional[str] = None


# ============== Gift Cards ==============

class GiftCardCreateRequest(BaseModel):
    code: str = Field(..., min_length=8, max_length=20)
    amount_usd: float = Field(..., gt=0, le=10000)
    description: Optional[str] = None


class GiftCardResponse(BaseModel):
    id: UUID
    code: str
    amount_usd: float
    is_active: bool
    is_redeemed: bool
    redeemed_by: Optional[UUID] = None
    redeemed_at: Optional[datetime] = None
    created_at: datetime
    
    class Config:
        from_attributes = True
