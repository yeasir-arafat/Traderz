from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from typing import List
from uuid import UUID

from app.core.database import get_db
from app.api.deps import get_current_user, require_admin
from app.models.slide import Slide
from app.schemas.slide import SlideCreate, SlideUpdate, SlideResponse
from app.models.user import User

router = APIRouter(prefix="/slides", tags=["Slides"])


@router.get("/", response_model=List[SlideResponse])
async def get_slides(
    active_only: bool = True,
    db: AsyncSession = Depends(get_db)
):
    """
    Get all slides.
    If active_only is True (default), returns only active slides sorted by display_order.
    """
    query = select(Slide)
    
    if active_only:
        query = query.where(Slide.is_active == True)
        
    # Sort by display_order ascending, then created_at descending
    query = query.order_by(Slide.display_order.asc(), Slide.created_at.desc())
    
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/", response_model=SlideResponse, status_code=status.HTTP_201_CREATED)
async def create_slide(
    slide_in: SlideCreate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new slide (Admin only).
    """
    slide = Slide(**slide_in.model_dump())
    db.add(slide)
    await db.commit()
    await db.refresh(slide)
    return slide


@router.put("/{slide_id}", response_model=SlideResponse)
async def update_slide(
    slide_id: UUID,
    slide_in: SlideUpdate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Update a slide (Admin only).
    """
    result = await db.execute(select(Slide).where(Slide.id == slide_id))
    slide = result.scalar_one_or_none()
    
    if not slide:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Slide not found"
        )
        
    update_data = slide_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(slide, field, value)
        
    await db.commit()
    await db.refresh(slide)
    return slide


@router.delete("/{slide_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_slide(
    slide_id: UUID,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a slide (Admin only).
    """
    result = await db.execute(select(Slide).where(Slide.id == slide_id))
    slide = result.scalar_one_or_none()
    
    if not slide:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Slide not found"
        )
        
    await db.delete(slide)
    await db.commit()
