from sqlalchemy import Column, String, DateTime, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime, timezone
import uuid

from app.core.database import Base


class TelegramLink(Base):
    """
    Stores mappings from Telegram accounts to chat IDs.
    Updated by the Telegram webhook when users message the bot.
    One row per Telegram user (telegram_user_id); username can be updated if they change it.
    """

    __tablename__ = "telegram_links"
    __table_args__ = (UniqueConstraint("telegram_user_id", name="uq_telegram_links_telegram_user_id"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Raw Telegram identifiers from the bot update payload
    telegram_user_id = Column(String(64), nullable=False, index=True)
    telegram_username = Column(String(100), nullable=True, index=True)
    chat_id = Column(String(64), nullable=False)

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

