from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from uuid import UUID


class GameCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    slug: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    image_url: Optional[str] = None
    icon_url: Optional[str] = None
    buyer_note_html: Optional[str] = None  # Important note for buyers
    regions: List[str] = []  # Game-specific regions
    platforms: List[str] = []  # Platform names to create
    is_active: bool = True
    display_order: int = 0


class GameUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    slug: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    image_url: Optional[str] = None
    icon_url: Optional[str] = None
    buyer_note_html: Optional[str] = None  # Important note for buyers
    regions: Optional[List[str]] = None
    platforms: Optional[List[str]] = None  # Platform names to replace
    is_active: Optional[bool] = None
    display_order: Optional[int] = None


class GamePlatformCreate(BaseModel):
    platform_name: str = Field(..., min_length=1, max_length=100)
    region: Optional[str] = None
    is_active: bool = True


class GamePlatformUpdate(BaseModel):
    platform_name: Optional[str] = None
    region: Optional[str] = None
    is_active: Optional[bool] = None


class PlatformFeeRuleCreate(BaseModel):
    game_id: UUID
    platform_id: Optional[UUID] = None
    seller_level: Optional[str] = None
    fee_percent: float = Field(..., ge=0, le=100)
    description: Optional[str] = None


class PlatformFeeRuleUpdate(BaseModel):
    fee_percent: Optional[float] = Field(None, ge=0, le=100)
    description: Optional[str] = None


class GamePlatformResponse(BaseModel):
    id: UUID
    game_id: UUID
    platform_name: str
    region: Optional[str]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class GameResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    description: Optional[str]
    image_url: Optional[str]
    icon_url: Optional[str] = None
    buyer_note_html: Optional[str] = None
    regions: List[str] = []  # Game-specific regions
    is_active: bool
    display_order: int
    created_at: datetime
    platforms: List[GamePlatformResponse] = []

    class Config:
        from_attributes = True


class PlatformFeeRuleResponse(BaseModel):
    id: UUID
    game_id: UUID
    platform_id: Optional[UUID]
    seller_level: Optional[str]
    fee_percent: float
    description: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
