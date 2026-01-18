"""
CodeAncestry API - Main application

Security powered by 1Password Service Accounts
https://1password.com
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
import os

from app.core.config import settings
from app.routers import auth, repositories, cortex_rag
from app.services.snowflake_service import snowflake_service, init_database

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 CodeAncestry API starting...")
    
    # Log 1Password integration status
    if os.getenv("OP_SERVICE_ACCOUNT_TOKEN"):
        logger.info("🔐 1Password Service Account enabled - Secrets loaded from vault")
    else:
        logger.info("📁 Using environment variables from .env file")
    
    # Initialize Snowflake database
    try:
        logger.info("📊 Initializing Snowflake database...")
        await init_database()
        logger.info("✅ Snowflake database initialized successfully")
    except Exception as e:
        logger.error(f"❌ Failed to initialize Snowflake database: {e}")
        logger.warning("⚠️ Application will continue without Snowflake (check credentials)")
    
    yield
    
    logger.info("👋 Shutting down...")
    snowflake_service.close()


app = FastAPI(title="CodeAncestry API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(repositories.router, prefix="/api", tags=["Repositories"])
app.include_router(cortex_rag.router, prefix="/api", tags=["Snowflake Cortex RAG"])


@app.get("/")
async def root():
    return {"message": "CodeAncestry API", "version": "1.0.0", "docs": "/docs"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
