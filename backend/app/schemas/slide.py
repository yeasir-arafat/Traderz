from pydantic import BaseModel, HttpUrl
from typing import Optional
from uuid import UUID
from datetime import datetime


class SlideBase(BaseModel):
    title: Optional[str] = None
    image_url: str
    link_url: Optional[str] = None
    description: Optional[str] = None
    is_active: bool = True
    display_order: int = 0


class SlideCreate(SlideBase):
    pass


class SlideUpdate(BaseModel):
    title: Optional[str] = None
    image_url: Optional[str] = None
    link_url: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    display_order: Optional[int] = None


class SlideResponse(SlideBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
