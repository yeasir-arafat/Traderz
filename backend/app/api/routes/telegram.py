"""
Telegram bot webhook: receive updates when users message the bot.
Store telegram_user_id + username + chat_id, and send instructions.
"""
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Request, Response

from app.core.database import AsyncSessionLocal
from app.models.telegram_link import TelegramLink
from app.services import telegram_service
from sqlalchemy import select

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/telegram", tags=["Telegram"])


def _get_message_payload(body: dict):
    """Extract message or edited_message from Telegram update."""
    if body.get("message"):
        return body["message"]
    if body.get("edited_message"):
        return body["edited_message"]
    return None


@router.post("/webhook")
async def telegram_webhook(request: Request):
    """
    Receives updates from Telegram when users send messages to the bot.
    - Stores/updates telegram_user_id, telegram_username, chat_id in telegram_links.
    - If user has no Telegram username: asks them to set one.
    - If user has username: tells them to verify @username on the website.
    """
    try:
        body = await request.json()
    except Exception as e:
        logger.warning(f"Telegram webhook invalid JSON: {e}")
        return Response(status_code=200)

    msg = _get_message_payload(body)
    if not msg:
        return Response(status_code=200)

    from_user = msg.get("from")
    chat = msg.get("chat")
    if not from_user or not chat:
        return Response(status_code=200)

    telegram_user_id = str(from_user.get("id"))
    telegram_username = (from_user.get("username") or "").strip() or None
    chat_id = str(chat.get("id"))

    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(
                select(TelegramLink).where(TelegramLink.telegram_user_id == telegram_user_id)
            )
            link = result.scalar_one_or_none()
            if link:
                link.telegram_username = telegram_username
                link.chat_id = chat_id
                link.updated_at = datetime.now(timezone.utc)
            else:
                db.add(TelegramLink(
                    telegram_user_id=telegram_user_id,
                    telegram_username=telegram_username,
                    chat_id=chat_id,
                ))
            await db.commit()
        except Exception as e:
            logger.exception(f"Telegram webhook db error: {e}")
            await db.rollback()

    # Send reply in Telegram
    if not telegram_username:
        reply = (
            "You don't have a Telegram username set. "
            "Please set a username in Telegram (Settings → Username), then send /start here again."
        )
    else:
        reply = (
            f"You have registered. Verify your username @{telegram_username} on our website to enable chat notifications."
        )

    await telegram_service.send_telegram_message(chat_id, reply)

    return Response(status_code=200)
