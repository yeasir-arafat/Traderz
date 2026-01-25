from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload
from typing import Optional, List
from uuid import UUID
from datetime import datetime, timezone

from app.models.conversation import Conversation, Message, ConversationType
from app.models.listing import Listing
from app.models.user import User
from app.core.errors import AppException
from app.core.responses import ErrorCodes
from app.schemas.chat import (
    ConversationResponse, ConversationListResponse,
    MessageResponse, SendMessageRequest
)


async def get_or_create_casual_conversation(
    db: AsyncSession,
    user_id: UUID,
    recipient_id: UUID,
    listing_id: Optional[UUID] = None
) -> Conversation:
    """Get or create casual DM conversation"""
    # Check for existing conversation between users
    result = await db.execute(
        select(Conversation).where(
            Conversation.conversation_type == ConversationType.CASUAL,
            Conversation.participant_ids.contains([user_id]),
            Conversation.participant_ids.contains([recipient_id])
        )
    )
    conversation = result.scalar_one_or_none()
    
    if not conversation:
        conversation = Conversation(
            conversation_type=ConversationType.CASUAL,
            listing_id=listing_id,
            participant_ids=[user_id, recipient_id]
        )
        db.add(conversation)
        await db.flush()
        
        # If started from listing, add system message
        if listing_id:
            listing_result = await db.execute(
                select(Listing).where(Listing.id == listing_id)
            )
            listing = listing_result.scalar_one_or_none()
            if listing:
                system_msg = Message(
                    conversation_id=conversation.id,
                    content=f"Conversation started about listing: {listing.title} (${listing.price_usd:.2f})",
                    is_system_message=True,
                    read_by=[]
                )
                db.add(system_msg)
        
        await db.commit()
        await db.refresh(conversation)
    
    return conversation


async def get_order_conversation(db: AsyncSession, order_id: UUID) -> Optional[Conversation]:
    """Get conversation for order"""
    result = await db.execute(
        select(Conversation).where(
            Conversation.order_id == order_id,
            Conversation.conversation_type == ConversationType.ORDER
        )
    )
    return result.scalar_one_or_none()


async def send_message(
    db: AsyncSession,
    conversation_id: UUID,
    sender_id: UUID,
    content: str,
    attachments: List[str] = []
) -> Message:
    """Send message in conversation"""
    # Verify conversation exists and user is participant
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = result.scalar_one_or_none()
    
    if not conversation:
        raise AppException(ErrorCodes.NOT_FOUND, "Conversation not found", 404)
    
    if sender_id not in conversation.participant_ids:
        raise AppException(ErrorCodes.AUTHORIZATION_ERROR, "Not a participant", 403)
    
    message = Message(
        conversation_id=conversation_id,
        sender_id=sender_id,
        content=content,
        attachments=attachments,
        read_by=[sender_id]
    )
    
    db.add(message)
    
    # Update conversation last message time
    conversation.last_message_at = datetime.now(timezone.utc)
    
    await db.commit()
    await db.refresh(message)
    return message


async def get_messages(
    db: AsyncSession,
    conversation_id: UUID,
    user_id: UUID,
    before: Optional[datetime] = None,
    limit: int = 50
) -> List[Message]:
    """Get messages in conversation"""
    # Verify access
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = result.scalar_one_or_none()
    
    if not conversation:
        raise AppException(ErrorCodes.NOT_FOUND, "Conversation not found", 404)
    
    if user_id not in conversation.participant_ids:
        raise AppException(ErrorCodes.AUTHORIZATION_ERROR, "Not a participant", 403)
    
    query = select(Message).where(Message.conversation_id == conversation_id)
    
    if before:
        query = query.where(Message.created_at < before)
    
    query = query.order_by(Message.created_at.desc()).limit(limit)
    
    result = await db.execute(query)
    messages = result.scalars().all()
    
    return list(reversed(messages))


async def mark_messages_read(
    db: AsyncSession,
    conversation_id: UUID,
    user_id: UUID,
    message_ids: List[UUID]
) -> int:
    """Mark messages as read"""
    result = await db.execute(
        select(Message).where(
            Message.conversation_id == conversation_id,
            Message.id.in_(message_ids)
        )
    )
    messages = result.scalars().all()
    
    count = 0
    for msg in messages:
        if user_id not in msg.read_by:
            msg.read_by = msg.read_by + [user_id]
            count += 1
    
    await db.commit()
    return count


async def get_conversations(
    db: AsyncSession,
    user_id: UUID
) -> ConversationListResponse:
    """Get user's conversations"""
    result = await db.execute(
        select(Conversation)
        .where(Conversation.participant_ids.contains([user_id]))
        .order_by(Conversation.last_message_at.desc().nullslast())
    )
    conversations = result.scalars().all()
    
    # Get last message and unread count for each
    response_list = []
    for conv in conversations:
        # Get last message
        msg_result = await db.execute(
            select(Message)
            .where(Message.conversation_id == conv.id)
            .order_by(Message.created_at.desc())
            .limit(1)
        )
        last_msg = msg_result.scalar_one_or_none()
        
        # Count unread
        unread_result = await db.execute(
            select(func.count(Message.id)).where(
                Message.conversation_id == conv.id,
                ~Message.read_by.contains([user_id])
            )
        )
        unread_count = unread_result.scalar() or 0
        
        conv_response = ConversationResponse(
            id=conv.id,
            conversation_type=conv.conversation_type.value,
            order_id=conv.order_id,
            listing_id=conv.listing_id,
            participant_ids=conv.participant_ids,
            name=conv.name,
            admin_joined=conv.admin_joined,
            last_message_at=conv.last_message_at,
            created_at=conv.created_at,
            last_message=MessageResponse.model_validate(last_msg) if last_msg else None,
            unread_count=unread_count
        )
        response_list.append(conv_response)
    
    return ConversationListResponse(
        conversations=response_list,
        total=len(response_list)
    )


async def invite_admin_to_conversation(
    db: AsyncSession,
    conversation_id: UUID,
    user_id: UUID
) -> Conversation:
    """Invite admin to order conversation"""
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = result.scalar_one_or_none()
    
    if not conversation:
        raise AppException(ErrorCodes.NOT_FOUND, "Conversation not found", 404)
    
    if user_id not in conversation.participant_ids:
        raise AppException(ErrorCodes.AUTHORIZATION_ERROR, "Not a participant", 403)
    
    if conversation.conversation_type != ConversationType.ORDER:
        raise AppException(ErrorCodes.VALIDATION_ERROR, "Can only invite admin to order chats")
    
    if conversation.admin_joined:
        raise AppException(ErrorCodes.CONFLICT, "Admin already in conversation")
    
    # Get admins
    admin_result = await db.execute(
        select(User).where(
            or_(
                User.roles.contains(["admin"]),
                User.roles.contains(["super_admin"])
            )
        ).limit(1)
    )
    admin = admin_result.scalar_one_or_none()
    
    if admin and admin.id not in conversation.participant_ids:
        conversation.participant_ids = conversation.participant_ids + [admin.id]
    
    conversation.admin_joined = True
    conversation.admin_joined_at = datetime.now(timezone.utc)
    
    # Add system message
    system_msg = Message(
        conversation_id=conversation.id,
        content="Admin has joined the conversation",
        is_system_message=True,
        read_by=[]
    )
    db.add(system_msg)
    
    await db.commit()
    await db.refresh(conversation)
    return conversation
