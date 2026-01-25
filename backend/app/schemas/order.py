from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from uuid import UUID


class OrderCreate(BaseModel):
    listing_id: UUID


class OrderDeliver(BaseModel):
    delivery_info: str = Field(..., min_length=10)


class OrderDispute(BaseModel):
    reason: str = Field(..., min_length=10)


class OrderResolveDispute(BaseModel):
    resolution: str  # 'refund' or 'complete'
    resolution_note: str = Field(..., min_length=10)


class OrderBuyerResponse(BaseModel):
    id: UUID
    username: str

    class Config:
        from_attributes = True


class OrderSellerResponse(BaseModel):
    id: UUID
    username: str
    seller_level: str

    class Config:
        from_attributes = True


class OrderListingResponse(BaseModel):
    id: UUID
    title: str
    images: List[str]

    class Config:
        from_attributes = True


class OrderResponse(BaseModel):
    id: UUID
    order_number: str
    listing_id: Optional[UUID]
    buyer_id: Optional[UUID]
    seller_id: Optional[UUID]
    amount_usd: float
    platform_fee_usd: float
    seller_earnings_usd: float
    status: str
    delivery_info: Optional[str]
    delivered_at: Optional[datetime]
    dispute_reason: Optional[str]
    disputed_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    paid_at: Optional[datetime]
    buyer: Optional[OrderBuyerResponse] = None
    seller: Optional[OrderSellerResponse] = None
    listing: Optional[OrderListingResponse] = None

    class Config:
        from_attributes = True


class OrderListResponse(BaseModel):
    orders: List[OrderResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
