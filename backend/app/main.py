from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.staticfiles import StaticFiles
from fastapi.exceptions import RequestValidationError
from starlette.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from contextlib import asynccontextmanager
import os
import logging
import json
from typing import Dict, Set
from uuid import UUID

from app.core.config import settings
from app.core.database import engine, init_db, AsyncSessionLocal
from app.core.firebase import init_firebase
from app.core.logging import setup_logging
from app.core.security import decode_access_token
from app.core.errors import (
    AppException, app_exception_handler,
    validation_exception_handler, generic_exception_handler
)
from app.jobs.scheduler import start_scheduler, shutdown_scheduler

# Import all routes
from app.api.routes import (
    auth, users, sellers, listings, orders, wallet,
    chats, notifications, kyc, games, giftcards, faq,
    config_routes, admin, superadmin, health, reviews, upload, debug, telegram, slides
)

setup_logging()
logger = logging.getLogger(__name__)

# ... (rest of file)

app.include_router(upload.router, prefix=api_prefix)
app.include_router(admin.router, prefix=api_prefix)
app.include_router(superadmin.router, prefix=api_prefix)
app.include_router(debug.router, prefix=api_prefix)
app.include_router(telegram.router, prefix=api_prefix)
app.include_router(slides.router, prefix=api_prefix)


# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        # conversation_id -> set of WebSocket connections
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        # websocket -> user_id mapping
        self.connection_users: Dict[WebSocket, str] = {}
    
    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.connection_users[websocket] = user_id
        logger.info(f"WebSocket connected: user {user_id}")
    
    def disconnect(self, websocket: WebSocket):
        user_id = self.connection_users.pop(websocket, None)
        # Remove from all conversations
        for conv_id, connections in list(self.active_connections.items()):
            connections.discard(websocket)
            if not connections:
                del self.active_connections[conv_id]
        logger.info(f"WebSocket disconnected: user {user_id}")
    
    def join_conversation(self, websocket: WebSocket, conversation_id: str):
        if conversation_id not in self.active_connections:
            self.active_connections[conversation_id] = set()
        self.active_connections[conversation_id].add(websocket)
        logger.info(f"User joined conversation {conversation_id}")
    
    def leave_conversation(self, websocket: WebSocket, conversation_id: str):
        if conversation_id in self.active_connections:
            self.active_connections[conversation_id].discard(websocket)
    
    async def broadcast_to_conversation(self, conversation_id: str, message: dict, exclude: WebSocket = None):
        if conversation_id not in self.active_connections:
            return
        
        for connection in self.active_connections[conversation_id]:
            if connection != exclude:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.error(f"Failed to send to websocket: {e}")


manager = ConnectionManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting PlayTraderz API...")
    
    # Initialize Firebase (graceful if not configured)
    firebase_ok = init_firebase()
    if not firebase_ok:
        logger.warning("Firebase not configured - social login disabled")
    
    # Initialize database
    try:
        await init_db()
        logger.info("Database initialized")
    except Exception as e:
        logger.error(f"Database init failed: {e}")
    
    # Run seed if needed
    try:
        from scripts.seed import run_seed
        await run_seed()
    except Exception as e:
        logger.error(f"Seed failed: {e}")
    
    # Start background job scheduler
    start_scheduler()
    
    yield
    
    # Shutdown
    logger.info("Shutting down...")
    shutdown_scheduler()
    await engine.dispose()


app = FastAPI(
    title="PlayTraderz API",
    description="Game Account Marketplace API",
    version="1.0.0",
    lifespan=lifespan
)

# CORS - use configured origins list, never "*" in production
cors_origins = settings.get_cors_origins()
logger.info(f"CORS allowed origins: {cors_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=1000)

# Exception handlers
app.add_exception_handler(AppException, app_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)

# Mount uploads directory
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# Include all routers under /api prefix
api_prefix = "/api"

app.include_router(health.router, prefix=api_prefix)
app.include_router(auth.router, prefix=api_prefix)
app.include_router(users.router, prefix=api_prefix)
app.include_router(sellers.router, prefix=api_prefix)
app.include_router(listings.router, prefix=api_prefix)
app.include_router(orders.router, prefix=api_prefix)
app.include_router(wallet.router, prefix=api_prefix)
app.include_router(chats.router, prefix=api_prefix)
app.include_router(notifications.router, prefix=api_prefix)
app.include_router(kyc.router, prefix=api_prefix)
app.include_router(games.router, prefix=api_prefix)
app.include_router(giftcards.router, prefix=api_prefix)
app.include_router(faq.router, prefix=api_prefix)
app.include_router(config_routes.router, prefix=api_prefix)
app.include_router(reviews.router, prefix=api_prefix)
app.include_router(upload.router, prefix=api_prefix)
app.include_router(admin.router, prefix=api_prefix)
app.include_router(superadmin.router, prefix=api_prefix)
app.include_router(debug.router, prefix=api_prefix)
app.include_router(telegram.router, prefix=api_prefix)


@app.get("/api/")
async def root():
    return {"success": True, "data": {"message": "PlayTraderz API v1.0"}}


# WebSocket endpoint for real-time chat
@app.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(None)
):
    """
    WebSocket endpoint for real-time chat.
    Connect with ?token=<jwt_access_token>
    
    Events:
    - join_conversation: {type: "join", conversation_id: "..."}
    - send_message: {type: "message", conversation_id: "...", content: "..."}
    - mark_seen: {type: "seen", conversation_id: "...", message_id: "..."}
    - typing: {type: "typing", conversation_id: "...", is_typing: true/false}
    """
    # Authenticate
    if not token:
        await websocket.close(code=4001, reason="Missing token")
        return
    
    payload = decode_access_token(token)
    if not payload:
        await websocket.close(code=4001, reason="Invalid token")
        return
    
    user_id = payload.get("sub")
    if not user_id:
        await websocket.close(code=4001, reason="Invalid token payload")
        return
    
    await manager.connect(websocket, user_id)
    
    try:
        while True:
            data = await websocket.receive_json()
            event_type = data.get("type")
            conversation_id = data.get("conversation_id")
            
            if event_type == "join" and conversation_id:
                # Verify user has access to conversation
                async with AsyncSessionLocal() as db:
                    from sqlalchemy import select
                    from app.models.conversation import Conversation
                    result = await db.execute(
                        select(Conversation).where(Conversation.id == UUID(conversation_id))
                    )
                    conv = result.scalar_one_or_none()
                    if conv and UUID(user_id) in conv.participant_ids:
                        manager.join_conversation(websocket, conversation_id)
                        await websocket.send_json({
                            "type": "joined",
                            "conversation_id": conversation_id
                        })
                    else:
                        await websocket.send_json({
                            "type": "error",
                            "message": "Access denied to conversation"
                        })
            
            elif event_type == "message" and conversation_id:
                content = data.get("content", "").strip()
                if content:
                    # Save message to database
                    async with AsyncSessionLocal() as db:
                        from app.services.chat_service import send_message
                        try:
                            message = await send_message(
                                db, UUID(conversation_id), UUID(user_id), content
                            )
                            # Broadcast to all participants
                            await manager.broadcast_to_conversation(
                                conversation_id,
                                {
                                    "type": "new_message",
                                    "conversation_id": conversation_id,
                                    "message": {
                                        "id": str(message.id),
                                        "sender_id": user_id,
                                        "content": content,
                                        "created_at": message.created_at.isoformat(),
                                        "is_system_message": False
                                    }
                                }
                            )
                        except Exception as e:
                            await websocket.send_json({
                                "type": "error",
                                "message": str(e)
                            })
            
            elif event_type == "typing" and conversation_id:
                is_typing = data.get("is_typing", False)
                await manager.broadcast_to_conversation(
                    conversation_id,
                    {
                        "type": "typing",
                        "conversation_id": conversation_id,
                        "user_id": user_id,
                        "is_typing": is_typing
                    },
                    exclude=websocket
                )
            
            elif event_type == "seen" and conversation_id:
                message_id = data.get("message_id")
                if message_id:
                    async with AsyncSessionLocal() as db:
                        from app.services.chat_service import mark_messages_read
                        await mark_messages_read(
                            db, UUID(conversation_id), UUID(user_id), [UUID(message_id)]
                        )
                    await manager.broadcast_to_conversation(
                        conversation_id,
                        {
                            "type": "message_seen",
                            "conversation_id": conversation_id,
                            "user_id": user_id,
                            "message_id": message_id
                        },
                        exclude=websocket
                    )
    
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)
