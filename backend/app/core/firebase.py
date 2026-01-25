import firebase_admin
from firebase_admin import credentials, auth
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

_firebase_initialized = False


def init_firebase():
    """
    Initialize Firebase Admin SDK from environment variables.
    Required env vars:
      - FIREBASE_PROJECT_ID
      - FIREBASE_CLIENT_EMAIL  
      - FIREBASE_PRIVATE_KEY (supports \\n for newlines)
    """
    global _firebase_initialized
    
    if _firebase_initialized or firebase_admin._apps:
        logger.info("Firebase already initialized")
        return True
    
    # Check required credentials
    if not settings.FIREBASE_PROJECT_ID:
        logger.warning("FIREBASE_PROJECT_ID not set - Firebase auth disabled")
        return False
    
    if not settings.FIREBASE_CLIENT_EMAIL:
        logger.warning("FIREBASE_CLIENT_EMAIL not set - Firebase auth disabled")
        return False
    
    if not settings.FIREBASE_PRIVATE_KEY:
        logger.warning("FIREBASE_PRIVATE_KEY not set - Firebase auth disabled")
        return False
    
    try:
        # Handle escaped newlines in private key
        private_key = settings.FIREBASE_PRIVATE_KEY
        if "\\n" in private_key:
            private_key = private_key.replace("\\n", "\n")
        
        # Build credentials dict from environment
        firebase_credentials = {
            "type": "service_account",
            "project_id": settings.FIREBASE_PROJECT_ID,
            "private_key": private_key,
            "client_email": settings.FIREBASE_CLIENT_EMAIL,
            "token_uri": "https://oauth2.googleapis.com/token",
        }
        
        cred = credentials.Certificate(firebase_credentials)
        firebase_admin.initialize_app(cred)
        _firebase_initialized = True
        logger.info("Firebase initialized successfully")
        return True
        
    except Exception as e:
        logger.error(f"Failed to initialize Firebase: {e}")
        return False


def is_firebase_enabled() -> bool:
    """Check if Firebase is properly configured and initialized"""
    return _firebase_initialized


def verify_firebase_token(id_token: str) -> dict:
    """
    Verify Firebase ID token and return decoded token data.
    Returns None if Firebase not configured or token invalid.
    """
    if not _firebase_initialized:
        logger.warning("Firebase not initialized - cannot verify token")
        return None
    
    try:
        decoded_token = auth.verify_id_token(id_token)
        return decoded_token
    except Exception as e:
        logger.error(f"Firebase token verification failed: {e}")
        return None
