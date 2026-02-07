from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload
from typing import Optional, List
from uuid import UUID
from datetime import datetime, timezone

from app.models.conversation import Conversation, Message, ConversationType, SupportRequestStatus
from app.models.listing import Listing
from app.models.user import User
from app.core.errors import AppException
from app.core.responses import ErrorCodes
from app.schemas.chat import (
    ConversationResponse, ConversationListResponse,
    MessageResponse, SendMessageRequest, RequesterInfoResponse,
    SupportRequestsResponse
)


def is_admin(user: User) -> bool:
    """Check if user is admin or super_admin"""
    return "admin" in user.roles or "super_admin" in user.roles


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


async def create_support_conversation(
    db: AsyncSession,
    user_id: UUID,
    subject: str,
    initial_message: str,
    attachments: List[str] = []
) -> Conversation:
    """Create a new support conversation (user requesting help from admin)"""
    # Get user info for the name
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise AppException(ErrorCodes.NOT_FOUND, "User not found", 404)
    
    # Create support conversation
    conversation = Conversation(
        conversation_type=ConversationType.SUPPORT,
        participant_ids=[user_id],
        name=f"Support: {subject[:50]}",
        support_status=SupportRequestStatus.PENDING,
        support_subject=subject,
        requester_id=user_id,
        admin_joined=False
    )
    db.add(conversation)
    await db.flush()
    
    # Add system message about support request
    system_msg = Message(
        conversation_id=conversation.id,
        content=f"Support request created: {subject}",
        is_system_message=True,
        read_by=[]
    )
    db.add(system_msg)
    
    # Add user's initial message
    user_msg = Message(
        conversation_id=conversation.id,
        sender_id=user_id,
        content=initial_message,
        attachments=attachments,
        read_by=[user_id]
    )
    db.add(user_msg)
    
    conversation.last_message_at = datetime.now(timezone.utc)
    
    await db.commit()
    await db.refresh(conversation)
    return conversation


async def accept_support_request(
    db: AsyncSession,
    conversation_id: UUID,
    admin_id: UUID
) -> Conversation:
    """Admin accepts a pending support request"""
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = result.scalar_one_or_none()
    
    if not conversation:
        raise AppException(ErrorCodes.NOT_FOUND, "Conversation not found", 404)
    
    if conversation.conversation_type != ConversationType.SUPPORT:
        raise AppException(ErrorCodes.VALIDATION_ERROR, "Not a support conversation")
    
    # Check if already active (another admin can still join)
    if conversation.support_status == SupportRequestStatus.CLOSED:
        raise AppException(ErrorCodes.VALIDATION_ERROR, "This support request is closed")
    
    # Add admin to participants if not already there
    if admin_id not in conversation.participant_ids:
        conversation.participant_ids = conversation.participant_ids + [admin_id]
    
    # If first admin to accept, set the status and accepted_by
    if conversation.support_status == SupportRequestStatus.PENDING:
        conversation.support_status = SupportRequestStatus.ACTIVE
        conversation.accepted_by_id = admin_id
        conversation.accepted_at = datetime.now(timezone.utc)
        conversation.admin_joined = True
        conversation.admin_joined_at = datetime.now(timezone.utc)
        
        # Add system message
        admin_result = await db.execute(select(User).where(User.id == admin_id))
        admin = admin_result.scalar_one_or_none()
        admin_name = admin.username if admin else "An admin"
        
        system_msg = Message(
            conversation_id=conversation.id,
            content=f"Admin has joined the support chat",
            is_system_message=True,
            read_by=[]
        )
        db.add(system_msg)
    else:
        # Another admin joining an already active chat
        admin_result = await db.execute(select(User).where(User.id == admin_id))
        admin = admin_result.scalar_one_or_none()
        admin_name = admin.username if admin else "An admin"
        
        system_msg = Message(
            conversation_id=conversation.id,
            content=f"Another admin has joined the chat",
            is_system_message=True,
            read_by=[]
        )
        db.add(system_msg)
    
    await db.commit()
    await db.refresh(conversation)
    return conversation


async def close_support_request(
    db: AsyncSession,
    conversation_id: UUID,
    user_id: UUID,
    reason: Optional[str] = None
) -> Conversation:
    """Close a support conversation"""
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = result.scalar_one_or_none()
    
    if not conversation:
        raise AppException(ErrorCodes.NOT_FOUND, "Conversation not found", 404)
    
    if conversation.conversation_type != ConversationType.SUPPORT:
        raise AppException(ErrorCodes.VALIDATION_ERROR, "Not a support conversation")
    
    if user_id not in conversation.participant_ids:
        raise AppException(ErrorCodes.AUTHORIZATION_ERROR, "Not a participant", 403)
    
    if conversation.support_status == SupportRequestStatus.CLOSED:
        raise AppException(ErrorCodes.VALIDATION_ERROR, "Already closed")
    
    conversation.support_status = SupportRequestStatus.CLOSED
    conversation.closed_at = datetime.now(timezone.utc)
    conversation.closed_by_id = user_id
    
    # Add system message
    close_msg = f"Support request closed"
    if reason:
        close_msg += f": {reason}"
    
    system_msg = Message(
        conversation_id=conversation.id,
        content=close_msg,
        is_system_message=True,
        read_by=[]
    )
    db.add(system_msg)
    
    await db.commit()
    await db.refresh(conversation)
    return conversation


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
    
    # For support chats, check if closed
    if conversation.conversation_type == ConversationType.SUPPORT:
        if conversation.support_status == SupportRequestStatus.CLOSED:
            raise AppException(ErrorCodes.VALIDATION_ERROR, "This support chat is closed")
    
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
    
    # Load messages with sender info using selectinload
    query = select(Message).options(
        selectinload(Message.sender)
    ).where(Message.conversation_id == conversation_id)
    
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
    user_id: UUID,
    conversation_type: Optional[str] = None
) -> ConversationListResponse:
    """Get user's conversations, optionally filtered by type"""
    query = select(Conversation).where(
        Conversation.participant_ids.contains([user_id])
    )
    
    if conversation_type:
        query = query.where(Conversation.conversation_type == ConversationType(conversation_type))
    
    query = query.order_by(Conversation.last_message_at.desc().nullslast())
    
    result = await db.execute(query)
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
            unread_count=unread_count,
            support_status=conv.support_status.value if conv.support_status else None,
            support_subject=conv.support_subject,
            requester_id=conv.requester_id,
            accepted_at=conv.accepted_at,
            closed_at=conv.closed_at
        )
        response_list.append(conv_response)
    
    return ConversationListResponse(
        conversations=response_list,
        total=len(response_list)
    )


async def get_support_requests_for_admin(
    db: AsyncSession,
    admin_id: UUID
) -> SupportRequestsResponse:
    """Get all support requests for admin view"""
    # Get pending support requests (not yet accepted by any admin)
    pending_result = await db.execute(
        select(Conversation).where(
            Conversation.conversation_type == ConversationType.SUPPORT,
            Conversation.support_status == SupportRequestStatus.PENDING
        ).order_by(Conversation.created_at.desc())
    )
    pending_conversations = pending_result.scalars().all()
    
    # Get active support chats where this admin is a participant
    active_result = await db.execute(
        select(Conversation).where(
            Conversation.conversation_type == ConversationType.SUPPORT,
            Conversation.support_status == SupportRequestStatus.ACTIVE,
            Conversation.participant_ids.contains([admin_id])
        ).order_by(Conversation.last_message_at.desc().nullslast())
    )
    active_conversations = active_result.scalars().all()
    
    # Format responses with requester info
    async def format_support_conv(conv: Conversation) -> ConversationResponse:
        # Get requester info
        requester_info = None
        if conv.requester_id:
            user_result = await db.execute(
                select(User).where(User.id == conv.requester_id)
            )
            requester = user_result.scalar_one_or_none()
            if requester:
                requester_info = RequesterInfoResponse(
                    id=requester.id,
                    username=requester.username,
                    full_name=requester.full_name,
                    email=requester.email
                )
        
        # Get last message
        msg_result = await db.execute(
            select(Message)
            .where(Message.conversation_id == conv.id)
            .order_by(Message.created_at.desc())
            .limit(1)
        )
        last_msg = msg_result.scalar_one_or_none()
        
        # Unread count
        unread_result = await db.execute(
            select(func.count(Message.id)).where(
                Message.conversation_id == conv.id,
                ~Message.read_by.contains([admin_id])
            )
        )
        unread_count = unread_result.scalar() or 0
        
        return ConversationResponse(
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
            unread_count=unread_count,
            support_status=conv.support_status.value if conv.support_status else None,
            support_subject=conv.support_subject,
            requester_id=conv.requester_id,
            requester_info=requester_info,
            accepted_at=conv.accepted_at,
            closed_at=conv.closed_at,
            display_name=f"{requester_info.full_name} (@{requester_info.username})" if requester_info else conv.name
        )
    
    pending_list = []
    for conv in pending_conversations:
        pending_list.append(await format_support_conv(conv))
    
    active_list = []
    for conv in active_conversations:
        active_list.append(await format_support_conv(conv))
    
    return SupportRequestsResponse(
        pending_requests=pending_list,
        active_chats=active_list,
        total_pending=len(pending_list),
        total_active=len(active_list)
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


async def get_unread_count_for_user(db: AsyncSession, user_id: UUID) -> int:
    """Get total unread message count across all conversations for a user"""
    # Get all conversations user is part of
    conv_result = await db.execute(
        select(Conversation.id).where(
            Conversation.participant_ids.contains([user_id])
        )
    )
    conversation_ids = [row[0] for row in conv_result.fetchall()]
    
    if not conversation_ids:
        return 0
    
    # Count unread messages
    unread_result = await db.execute(
        select(func.count(Message.id)).where(
            Message.conversation_id.in_(conversation_ids),
            ~Message.read_by.contains([user_id])
        )
    )
    return unread_result.scalar() or 0
