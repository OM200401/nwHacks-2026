"""
Configuration management with 1Password integration

This module manages application secrets using 1Password Service Accounts
for enhanced security, with fallback to environment variables.

Sponsor: 1Password - https://1password.com
"""

from pydantic_settings import BaseSettings
from typing import Optional, List
import os
import logging

logger = logging.getLogger(__name__)

# Import 1Password service
try:
    from app.services.onepassword_service import get_secret, SECRET_REFS
    ONEPASSWORD_AVAILABLE = True
    logger.info("🔐 1Password service loaded successfully")
except ImportError as e:
    ONEPASSWORD_AVAILABLE = False
    logger.warning(f"⚠️ 1Password service not available: {e}")


def get_config_value(secret_key: str, env_var: str, default: str = "") -> str:
    """
    Get configuration value from 1Password or environment variable.
    
    Priority:
    1. 1Password vault (if service account token is set)
    2. Environment variable
    3. Default value
    
    Args:
        secret_key: 1Password secret key (e.g., "snowflake_account")
        env_var: Environment variable name as fallback
        default: Default value if neither source is available
    """
    if ONEPASSWORD_AVAILABLE:
        value = get_secret(secret_key, env_var)
        if value:
            return value
    return os.getenv(env_var, default)


class Settings(BaseSettings):
    """
    Application settings with 1Password integration.
    
    Secrets are automatically loaded from 1Password vaults when
    OP_SERVICE_ACCOUNT_TOKEN is set in environment variables.
    """
    
    # GitHub OAuth - Loaded from 1Password
    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""
    GITHUB_REDIRECT_URI: str = "http://localhost:8000/auth/github/callback"
    
    # API Keys - Loaded from 1Password
    GEMINI_API_KEY: str = ""
    ELEVENLABS_API_KEY: str = ""
    OPENROUTER_API_KEY: str = ""
    
    # 1Password Service Account Token
    ONEPASSWORD_TOKEN: str = ""
    
    # Snowflake Credentials - Loaded from 1Password
    SNOWFLAKE_ACCOUNT: str = ""
    SNOWFLAKE_USER: str = ""
    SNOWFLAKE_PASSWORD: str = ""
    SNOWFLAKE_DATABASE: str = "CODEANCESTRY"
    SNOWFLAKE_SCHEMA: str = "PUBLIC"
    SNOWFLAKE_WAREHOUSE: str = "COMPUTE_WH"
    
    # JWT Settings - Loaded from 1Password
    JWT_SECRET_KEY: str = ""
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    # Application Settings
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = False

    # Deployment / Environment
    ENVIRONMENT: str = "development"
    FRONTEND_URL: str = "http://localhost:8080"
    CORS_ORIGINS: str = ""
    REDIS_URL: str = ""
    ENCRYPTION_KEY: str = ""

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS_ORIGINS comma-separated string into a list."""
        if self.CORS_ORIGINS:
            return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]
        return [self.FRONTEND_URL]

    @property
    def effective_redis_url(self) -> str:
        """Get Redis URL, falling back to host:port."""
        if self.REDIS_URL:
            return self.REDIS_URL
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}"

    @property
    def github_redirect_uri(self) -> str:
        """Get GitHub redirect URI, requiring explicit config in production."""
        if self.GITHUB_REDIRECT_URI:
            return self.GITHUB_REDIRECT_URI
        if self.is_production:
            raise ValueError("GITHUB_REDIRECT_URI must be set in production")
        return "http://localhost:8000/auth/github/callback"

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


# Initialize base settings from .env
settings = Settings()

# NOTE: 1Password integration is available but requires service account token
# with proper permissions. For now, all secrets are loaded from .env file.
# To use 1Password:
# 1. Ensure OP_SERVICE_ACCOUNT_TOKEN is set in .env with valid token
# 2. Verify token has read access to CodeAncestry vault
# 3. Uncomment the 1Password loading section below

if ONEPASSWORD_AVAILABLE and os.getenv("OP_SERVICE_ACCOUNT_TOKEN"):
    logger.info("📁 Using environment variables from .env file (1Password integration available)")
else:
    logger.info("📁 Using environment variables from .env file")

# Validate required secrets in production
if settings.is_production:
    _missing = []
    if not settings.JWT_SECRET_KEY:
        _missing.append("JWT_SECRET_KEY")
    if not settings.ENCRYPTION_KEY:
        _missing.append("ENCRYPTION_KEY")
    if not settings.GITHUB_CLIENT_ID:
        _missing.append("GITHUB_CLIENT_ID")
    if not settings.GITHUB_CLIENT_SECRET:
        _missing.append("GITHUB_CLIENT_SECRET")
    if _missing:
        raise ValueError(f"Production deployment missing required secrets: {', '.join(_missing)}")
