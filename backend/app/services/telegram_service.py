import httpx
import logging
from typing import Optional
from app.core.config import settings

logger = logging.getLogger(__name__)

TELEGRAM_API_URL = "https://api.telegram.org/bot{token}"


async def send_telegram_message(chat_id: str, message: str) -> bool:
    """Send a message to a Telegram user"""
    token = getattr(settings, 'TELEGRAM_BOT_TOKEN', None)
    if not token:
        logger.warning("Telegram bot token not configured")
        return False
    
    if not chat_id:
        logger.warning("No chat_id provided")
        return False
    
    try:
        url = f"{TELEGRAM_API_URL.format(token=token)}/sendMessage"
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json={
                "chat_id": chat_id,
                "text": message,
                "parse_mode": "HTML"
            })
            
            if response.status_code == 200:
                logger.info(f"Telegram message sent to {chat_id}")
                return True
            else:
                logger.error(f"Telegram API error: {response.text}")
                return False
    except Exception as e:
        logger.error(f"Failed to send Telegram message: {e}")
        return False


async def send_chat_notification(
    telegram_chat_id: str,
    sender_name: str,
    message_preview: str,
    conversation_name: Optional[str] = None
) -> bool:
    """Send a chat notification to Telegram"""
    if not telegram_chat_id:
        return False
    
    text = f"<b>💬 New Message from {sender_name}</b>\n"
    if conversation_name:
        text += f"<i>In: {conversation_name}</i>\n"
    text += f"\n{message_preview[:200]}..."
    text += "\n\n<i>Open PlayTraderz to reply</i>"
    
    return await send_telegram_message(telegram_chat_id, text)


async def get_telegram_chat_id_by_username(username: str) -> Optional[str]:
    """
    Note: Telegram API doesn't allow looking up chat_id by username directly.
    Users need to start a conversation with the bot first.
    This function is a placeholder - the actual chat_id needs to be obtained
    when the user sends /start to the bot.
    """
    return None


async def verify_telegram_bot() -> bool:
    """Verify the bot token is valid"""
    token = getattr(settings, 'TELEGRAM_BOT_TOKEN', None)
    if not token:
        return False
    
    try:
        url = f"{TELEGRAM_API_URL.format(token=token)}/getMe"
        async with httpx.AsyncClient() as client:
            response = await client.get(url)
            if response.status_code == 200:
                data = response.json()
                if data.get("ok"):
                    logger.info(f"Telegram bot verified: @{data['result']['username']}")
                    return True
    except Exception as e:
        logger.error(f"Failed to verify Telegram bot: {e}")
    
    return False
