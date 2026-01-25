from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from uuid import UUID


class StartConversationRequest(BaseModel):
    listing_id: Optional[UUID] = None
    recipient_id: Optional[UUID] = None
    initial_message: Optional[str] = None


class SendMessageRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000)
    attachments: List[str] = []


class MarkReadRequest(BaseModel):
    message_ids: List[UUID]


class MessageSenderResponse(BaseModel):
    id: UUID
    username: str

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

    class Config:
        from_attributes = True


class ConversationListResponse(BaseModel):
    conversations: List[ConversationResponse]
    total: int
