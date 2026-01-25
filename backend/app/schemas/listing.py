from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from uuid import UUID


class ListingCreate(BaseModel):
    game_id: UUID
    title: str = Field(..., min_length=5, max_length=200)
    description: str = Field(..., min_length=20)
    price_usd: float = Field(..., gt=0)
    platforms: List[str] = Field(..., min_length=1)
    regions: List[str] = Field(..., min_length=1)
    account_level: Optional[str] = None
    account_rank: Optional[str] = None
    account_features: Optional[str] = None
    images: List[str] = []


class ListingUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=5, max_length=200)
    description: Optional[str] = Field(None, min_length=20)
    price_usd: Optional[float] = Field(None, gt=0)
    platforms: Optional[List[str]] = None
    regions: Optional[List[str]] = None
    account_level: Optional[str] = None
    account_rank: Optional[str] = None
    account_features: Optional[str] = None
    images: Optional[List[str]] = None


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
