from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from uuid import UUID


class KycSubmitRequest(BaseModel):
    doc_type: str = Field(..., pattern="^(passport|driving_licence|driving_license|nid|national_id|equivalent)$")
    doc_front_url: str
    doc_back_url: Optional[str] = None
    selfie_url: Optional[str] = None


class KycReviewRequest(BaseModel):
    approved: bool
    review_note: Optional[str] = None


class KycSubmissionResponse(BaseModel):
    id: UUID
    user_id: UUID
    doc_type: str
    doc_front_url: str
    doc_back_url: Optional[str]
    selfie_url: Optional[str]
    status: str
    review_note: Optional[str]
    created_at: datetime
    reviewed_at: Optional[datetime]

    class Config:
        from_attributes = True


class KycListResponse(BaseModel):
    submissions: List[KycSubmissionResponse]
    total: int
    page: int
    page_size: int


class NotificationResponse(BaseModel):
    id: UUID
    notification_type: str
    title: str
    message: str
    order_id: Optional[UUID]
    listing_id: Optional[UUID]
    conversation_id: Optional[UUID]
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationListResponse(BaseModel):
    notifications: List[NotificationResponse]
    total: int
    unread_count: int


class ReviewCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = Field(None, max_length=1000)


class ReviewResponse(BaseModel):
    id: UUID
    order_id: UUID
    reviewer_id: Optional[UUID]
    reviewee_id: Optional[UUID]
    rating: int
    comment: Optional[str]
    created_at: datetime
    reviewer_username: Optional[str] = None

    class Config:
        from_attributes = True


class GiftCardCreate(BaseModel):
    code: str = Field(..., min_length=4, max_length=50)
    amount_usd: float = Field(..., gt=0)
    expires_at: Optional[datetime] = None


class GiftCardResponse(BaseModel):
    id: UUID
    code: str
    amount_usd: float
    is_active: bool
    is_redeemed: bool
    redeemed_at: Optional[datetime]
    created_at: datetime
    expires_at: Optional[datetime]

    class Config:
        from_attributes = True


class FAQCreate(BaseModel):
    question: str = Field(..., min_length=5)
    answer_html: str = Field(..., min_length=10)
    images: List[str] = []
    youtube_links: List[str] = []
    category: Optional[str] = None
    display_order: int = 0


class FAQUpdate(BaseModel):
    question: Optional[str] = Field(None, min_length=5)
    answer_html: Optional[str] = Field(None, min_length=10)
    images: Optional[List[str]] = None
    youtube_links: Optional[List[str]] = None
    category: Optional[str] = None
    display_order: Optional[int] = None
    is_active: Optional[bool] = None


class FAQResponse(BaseModel):
    id: UUID
    question: str
    answer_html: str
    images: List[str]
    youtube_links: List[str]
    category: Optional[str]
    display_order: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ConfigUpdateRequest(BaseModel):
    key: str
    value: str


class ConfigResponse(BaseModel):
    key: str
    value: str
    description: Optional[str]
    updated_at: datetime

    class Config:
        from_attributes = True
