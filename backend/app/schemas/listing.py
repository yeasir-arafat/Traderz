from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID


class AccountDetail(BaseModel):
    """A single account detail (label-value pair)"""
    label: str = Field(..., min_length=1, max_length=50)
    value: str = Field(..., min_length=1, max_length=100)


class ListingCreate(BaseModel):
    game_id: UUID
    title: str = Field(..., min_length=5, max_length=200)
    description: str = Field(..., min_length=20)
    price_usd: float = Field(..., gt=0)
    platforms: List[str] = Field(..., min_length=1)
    regions: List[str] = Field(..., min_length=1)
    video_url: str = Field(..., min_length=10, description="Video URL showing the account (mandatory)")
    account_details: List[AccountDetail] = Field(default=[], max_length=10)
    images: List[str] = []
    
    # Legacy fields (optional, for backward compatibility)
    account_level: Optional[str] = None
    account_rank: Optional[str] = None
    account_features: Optional[str] = None
    
    @field_validator('video_url')
    @classmethod
    def validate_video_url(cls, v):
        if not v:
            raise ValueError('Video URL is required')
        # Allow YouTube, Vimeo, and other common video platforms
        valid_domains = ['youtube.com', 'youtu.be', 'vimeo.com', 'twitch.tv', 'streamable.com', 'drive.google.com', 'dropbox.com']
        if not any(domain in v.lower() for domain in valid_domains):
            # Also allow direct video file URLs
            if not v.lower().endswith(('.mp4', '.webm', '.mov', '.avi')):
                raise ValueError('Please provide a valid video URL from YouTube, Vimeo, Twitch, Streamable, Google Drive, or Dropbox')
        return v
    
    @field_validator('account_details')
    @classmethod
    def validate_account_details(cls, v):
        if len(v) > 10:
            raise ValueError('Maximum 10 account details allowed')
        return v


class ListingUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=5, max_length=200)
    description: Optional[str] = Field(None, min_length=20)
    price_usd: Optional[float] = Field(None, gt=0)
    platforms: Optional[List[str]] = None
    regions: Optional[List[str]] = None
    video_url: Optional[str] = None
    account_details: Optional[List[AccountDetail]] = None
    images: Optional[List[str]] = None
    
    # Legacy fields
    account_level: Optional[str] = None
    account_rank: Optional[str] = None
    account_features: Optional[str] = None


class ListingApproval(BaseModel):
    approved: bool
    rejection_reason: Optional[str] = None


class ListingSellerResponse(BaseModel):
    id: UUID
    username: str
    seller_level: str
    seller_rating: float
    total_reviews: int
    kyc_status: str

    class Config:
        from_attributes = True


class ListingGameResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    image_url: Optional[str]

    class Config:
        from_attributes = True


class ListingResponse(BaseModel):
    id: UUID
    seller_id: UUID
    game_id: Optional[UUID]
    title: str
    description: str
    price_usd: float
    platforms: List[str]
    regions: List[str]
    video_url: Optional[str]
    account_details: List[Dict[str, Any]] = []
    account_level: Optional[str]
    account_rank: Optional[str]
    account_features: Optional[str]
    images: List[str]
    status: str
    rejection_reason: Optional[str]
    view_count: int
    created_at: datetime
    updated_at: datetime
    seller: Optional[ListingSellerResponse] = None
    game: Optional[ListingGameResponse] = None

    class Config:
        from_attributes = True


class ListingListResponse(BaseModel):
    listings: List[ListingResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
