from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from uuid import UUID


class StartConversationRequest(BaseModel):
    listing_id: Optional[UUID] = None
    recipient_id: Optional[UUID] = None
    initial_message: Optional[str] = None


class StartSupportRequest(BaseModel):
    """Request to start a support chat"""
    subject: str = Field(..., min_length=5, max_length=255)
    initial_message: str = Field(..., min_length=10, max_length=5000)
    attachments: List[str] = []


class AcceptSupportRequest(BaseModel):
    """Admin accepts a support request"""
    pass


class CloseSupportRequest(BaseModel):
    """Close a support conversation"""
    reason: Optional[str] = None


class SendMessageRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000)
    attachments: List[str] = []


class MarkReadRequest(BaseModel):
    message_ids: List[UUID]


class MessageSenderResponse(BaseModel):
    id: UUID
    username: str
    full_name: Optional[str] = None

    class Config:
        from_attributes = True


class MessageResponse(BaseModel):
    id: UUID
    conversation_id: UUID
    sender_id: Optional[UUID]
    content: str
    is_system_message: bool
    attachments: List[str]
    read_by: List[UUID]
    created_at: datetime
    sender: Optional[MessageSenderResponse] = None
    # For support chats - admin sees real name, user sees "Admin"
    sender_display_name: Optional[str] = None

    class Config:
        from_attributes = True


class RequesterInfoResponse(BaseModel):
    """Info about user who requested support"""
    id: UUID
    username: str
    full_name: str
    email: Optional[str] = None

    class Config:
        from_attributes = True


class ConversationResponse(BaseModel):
    id: UUID
    conversation_type: str
    order_id: Optional[UUID]
    listing_id: Optional[UUID]
    participant_ids: List[UUID]
    name: Optional[str]
    admin_joined: bool
    last_message_at: Optional[datetime]
    created_at: datetime
    last_message: Optional[MessageResponse] = None
    unread_count: int = 0
    # Support chat specific fields
    support_status: Optional[str] = None
    support_subject: Optional[str] = None
    requester_id: Optional[UUID] = None
    requester_info: Optional[RequesterInfoResponse] = None  # For admin view
    accepted_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    # Display name for the conversation (customized based on viewer role)
    display_name: Optional[str] = None
    last_active_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ConversationListResponse(BaseModel):
    conversations: List[ConversationResponse]
    total: int


class SupportRequestsResponse(BaseModel):
    """Response for admin support request queue"""
    pending_requests: List[ConversationResponse]
    active_chats: List[ConversationResponse]
    total_pending: int
    total_active: int
