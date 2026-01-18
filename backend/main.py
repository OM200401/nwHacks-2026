"""
CodeAncestry API - Main application
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from app.core.config import settings
from app.routers import auth, repositories
from app.services.snowflake_service import snowflake_service, init_database

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 CodeAncestry API starting...")
    
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


@app.get("/")
async def root():
    return {"message": "CodeAncestry API", "version": "1.0.0", "docs": "/docs"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
