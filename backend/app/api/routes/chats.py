from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from uuid import UUID
from datetime import datetime

from app.core.database import get_db
from app.core.responses import success_response
from app.core.errors import AppException
from app.core.responses import ErrorCodes
from app.api.deps import get_current_user
from app.models.user import User
from app.models.conversation import Message
from app.services import chat_service
from app.schemas.chat import (
    StartConversationRequest, StartSupportRequest, AcceptSupportRequest,
    CloseSupportRequest, SendMessageRequest, MarkReadRequest,
    ConversationResponse, MessageResponse
)


router = APIRouter(prefix="/chats", tags=["Chats"])


def require_admin(user: User):
    """Check if user is admin"""
    if "admin" not in user.roles and "super_admin" not in user.roles:
        raise AppException(ErrorCodes.AUTHORIZATION_ERROR, "Admin access required", 403)
    return user


@router.get("")
async def get_conversations(
    conversation_type: Optional[str] = Query(None, description="Filter by type: casual, order, support"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get user's conversations, optionally filtered by type"""
    result = await chat_service.get_conversations(db, user.id, conversation_type)
    return success_response(result.model_dump())


@router.get("/unread-count")
async def get_unread_count(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get total unread message count for user"""
    count = await chat_service.get_unread_count_for_user(db, user.id)
    return success_response({"unread_count": count})


@router.post("/start")
async def start_conversation(
    data: StartConversationRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Start casual conversation with user"""
    if not data.recipient_id:
        raise AppException(ErrorCodes.VALIDATION_ERROR, "recipient_id required")
    
    conversation = await chat_service.get_or_create_casual_conversation(
        db, user.id, data.recipient_id, data.listing_id
    )
    
    if data.initial_message:
        await chat_service.send_message(db, conversation.id, user.id, data.initial_message)
    
    return success_response(ConversationResponse.model_validate(conversation).model_dump())


@router.post("/support")
async def create_support_request(
    data: StartSupportRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new support request (user to admin)"""
    conversation = await chat_service.create_support_conversation(
        db, user.id, data.subject, data.initial_message, data.attachments
    )
    return success_response(ConversationResponse.model_validate(conversation).model_dump())


@router.get("/support/requests")
async def get_support_requests(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get pending support requests (admin only)"""
    require_admin(user)
    result = await chat_service.get_support_requests_for_admin(db, user.id)
    return success_response(result.model_dump())


@router.post("/support/{conversation_id}/accept")
async def accept_support_request(
    conversation_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Accept/join a support request (admin only)"""
    require_admin(user)
    conversation = await chat_service.accept_support_request(db, conversation_id, user.id)
    return success_response(ConversationResponse.model_validate(conversation).model_dump())


@router.post("/support/{conversation_id}/close")
async def close_support_request(
    conversation_id: UUID,
    data: CloseSupportRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Close a support conversation"""
    conversation = await chat_service.close_support_request(
        db, conversation_id, user.id, data.reason
    )
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
        raise AppException(ErrorCodes.NOT_FOUND, "Conversation not found", 404)
    
    return success_response(ConversationResponse.model_validate(conversation).model_dump())


def serialize_message(msg: Message) -> dict:
    """Safely serialize a Message to dict, handling lazy-loaded relationships"""
    sender_data = None
    if msg.sender:
        sender_data = {
            "id": str(msg.sender.id),
            "username": msg.sender.username,
            "full_name": msg.sender.full_name
        }
    
    return {
        "id": str(msg.id),
        "conversation_id": str(msg.conversation_id),
        "sender_id": str(msg.sender_id) if msg.sender_id else None,
        "content": msg.content,
        "is_system_message": msg.is_system_message,
        "attachments": msg.attachments or [],
        "read_by": [str(uid) for uid in (msg.read_by or [])],
        "created_at": msg.created_at.isoformat(),
        "sender": sender_data
    }


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
        "messages": [serialize_message(m) for m in messages]
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
    return success_response(serialize_message(message))


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
