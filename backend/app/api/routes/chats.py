from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from uuid import UUID
from datetime import datetime

from app.core.database import get_db
from app.core.responses import success_response
from app.api.deps import get_current_user
from app.models.user import User
from app.services import chat_service
from app.schemas.chat import (
    StartConversationRequest, SendMessageRequest, MarkReadRequest,
    ConversationResponse, MessageResponse
)


router = APIRouter(prefix="/chats", tags=["Chats"])


@router.get("")
async def get_conversations(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get user's conversations"""
    result = await chat_service.get_conversations(db, user.id)
    return success_response(result.model_dump())


@router.post("/start")
async def start_conversation(
    data: StartConversationRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Start casual conversation with user"""
    if not data.recipient_id:
        from app.core.errors import AppException
        from app.core.responses import ErrorCodes
        raise AppException(ErrorCodes.VALIDATION_ERROR, "recipient_id required")
    
    conversation = await chat_service.get_or_create_casual_conversation(
        db, user.id, data.recipient_id, data.listing_id
    )
    
    if data.initial_message:
        await chat_service.send_message(db, conversation.id, user.id, data.initial_message)
    
    return success_response(ConversationResponse.model_validate(conversation).model_dump())


@router.get("/order/{order_id}")
async def get_order_conversation(
    order_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get conversation for order"""
    conversation = await chat_service.get_order_conversation(db, order_id)
    if not conversation:
        from app.core.errors import AppException
        from app.core.responses import ErrorCodes
        raise AppException(ErrorCodes.NOT_FOUND, "Conversation not found", 404)
    
    return success_response(ConversationResponse.model_validate(conversation).model_dump())


@router.get("/{conversation_id}/messages")
async def get_messages(
    conversation_id: UUID,
    before: Optional[datetime] = None,
    limit: int = Query(50, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get messages in conversation"""
    messages = await chat_service.get_messages(db, conversation_id, user.id, before, limit)
    return success_response({
        "messages": [MessageResponse.model_validate(m).model_dump() for m in messages]
    })


@router.post("/{conversation_id}/messages")
async def send_message(
    conversation_id: UUID,
    data: SendMessageRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Send message"""
    message = await chat_service.send_message(
        db, conversation_id, user.id, data.content, data.attachments
    )
    return success_response(MessageResponse.model_validate(message).model_dump())


@router.post("/{conversation_id}/read")
async def mark_read(
    conversation_id: UUID,
    data: MarkReadRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Mark messages as read"""
    count = await chat_service.mark_messages_read(db, conversation_id, user.id, data.message_ids)
    return success_response({"marked_count": count})


@router.post("/{conversation_id}/invite-admin")
async def invite_admin(
    conversation_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Invite admin to order conversation"""
    conversation = await chat_service.invite_admin_to_conversation(db, conversation_id, user.id)
    return success_response(ConversationResponse.model_validate(conversation).model_dump())
