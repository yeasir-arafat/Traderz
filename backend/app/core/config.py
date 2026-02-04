from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional, List


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str
    
    # JWT
    JWT_SECRET_KEY: str
    JWT_REFRESH_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Firebase (from environment - no hardcoding)
    FIREBASE_PROJECT_ID: Optional[str] = None
    FIREBASE_CLIENT_EMAIL: Optional[str] = None
    FIREBASE_PRIVATE_KEY: Optional[str] = None
    
    # Email (Brevo/SendGrid)
    SENDGRID_API_KEY: Optional[str] = None
    SENDER_EMAIL: str = "noreply@playtraderz.com"
    
    # App
    APP_NAME: str = "PlayTraderz"
    DEBUG: bool = False
    
    # CORS - strict list, no "*" in production
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:5173"
    
    # File uploads
    UPLOAD_DIR: str = "/app/uploads"
    MAX_FILE_SIZE: int = 5 * 1024 * 1024  # 5MB
    
    class Config:
        env_file = ".env"
        extra = "ignore"
    
    def get_cors_origins(self) -> List[str]:
        """Parse ALLOWED_ORIGINS into list"""
        if not self.ALLOWED_ORIGINS:
            return ["http://localhost:3000"]
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
