"""
Snowflake database service for CodeAncestry
Handles connection and table operations
"""

import snowflake.connector
from snowflake.connector import DictCursor
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from typing import Optional, Dict, List, Any
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)


class SnowflakeService:
    """Snowflake database service"""
    
    def __init__(self):
        self.connection = None
        self.engine = None
        self.Session = None
        
    def get_connection(self):
        """Get Snowflake connection"""
        if self.connection is None or self.connection.is_closed():
            try:
                self.connection = snowflake.connector.connect(
                    account=settings.SNOWFLAKE_ACCOUNT,
                    user=settings.SNOWFLAKE_USER,
                    password=settings.SNOWFLAKE_PASSWORD,
                    warehouse=settings.SNOWFLAKE_WAREHOUSE
                )
                logger.info("✅ Snowflake connection established")
                
                # Create database if it doesn't exist
                cursor = self.connection.cursor()
                cursor.execute(f"CREATE DATABASE IF NOT EXISTS {settings.SNOWFLAKE_DATABASE}")
                cursor.execute(f"USE DATABASE {settings.SNOWFLAKE_DATABASE}")
                cursor.execute(f"CREATE SCHEMA IF NOT EXISTS {settings.SNOWFLAKE_SCHEMA}")
                cursor.execute(f"USE SCHEMA {settings.SNOWFLAKE_SCHEMA}")
                cursor.close()
                logger.info(f"✅ Using {settings.SNOWFLAKE_DATABASE}.{settings.SNOWFLAKE_SCHEMA}")
                
            except Exception as e:
                logger.error(f"❌ Failed to connect to Snowflake: {e}")
                raise
        return self.connection
    
    def get_engine(self):
        """Get SQLAlchemy engine for Snowflake"""
        if self.engine is None:
            connection_string = (
                f"snowflake://{settings.SNOWFLAKE_USER}:{settings.SNOWFLAKE_PASSWORD}"
                f"@{settings.SNOWFLAKE_ACCOUNT}/{settings.SNOWFLAKE_DATABASE}"
                f"/{settings.SNOWFLAKE_SCHEMA}?warehouse={settings.SNOWFLAKE_WAREHOUSE}"
            )
            self.engine = create_engine(connection_string)
            self.Session = sessionmaker(bind=self.engine)
            logger.info("✅ SQLAlchemy engine created for Snowflake")
        return self.engine
    
    def execute_query(self, query: str, params: tuple = None, fetch: bool = True) -> Optional[List[Dict]]:
        """
        Execute a SQL query
        
        Args:
            query: SQL query string
            params: Query parameters as tuple (optional)
            fetch: Whether to fetch results
        
        Returns:
            List of result rows as dictionaries (if fetch=True)
        """
        conn = self.get_connection()
        cursor = conn.cursor(DictCursor)
        
        try:
            if params:
                cursor.execute(query, params)
            else:
                cursor.execute(query)
            
            if fetch:
                results = cursor.fetchall()
                return results
            else:
                conn.commit()
                return None
                
        except Exception as e:
            logger.error(f"Query execution error: {e}")
            conn.rollback()
            raise
        finally:
            cursor.close()
    
    def close(self):
        """Close Snowflake connection"""
        if self.connection and not self.connection.is_closed():
            self.connection.close()
            logger.info("Snowflake connection closed")


# Global Snowflake service instance
snowflake_service = SnowflakeService()


async def init_database():
    """Initialize database tables"""
    logger.info("Initializing Snowflake database schema...")
    
    try:
        # Create tables (database and schema already set in get_connection)
        create_users_table()
        create_repositories_table()
        create_commits_table()
        create_pr_analysis_table()
        logger.info("✅ Database schema initialized successfully")
    except Exception as e:
        logger.error(f"❌ Failed to initialize database: {e}")
        raise


def create_users_table():
    """Create users table"""
    query = """
    CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        github_id VARCHAR(255) NOT NULL UNIQUE,
        github_username VARCHAR(255) NOT NULL,
        encrypted_token_ref TEXT NOT NULL,
        email VARCHAR(255),
        created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
        last_login TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
    )
    """
    snowflake_service.execute_query(query, fetch=False)
    logger.info("✅ Users table created/verified")


def create_repositories_table():
    """Create repositories table"""
    query = """
    CREATE TABLE IF NOT EXISTS repositories (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        github_repo_id BIGINT NOT NULL,
        owner VARCHAR(255) NOT NULL,
        repo_name VARCHAR(255) NOT NULL,
        full_name VARCHAR(511) NOT NULL,
        html_url VARCHAR(1024),
        default_branch VARCHAR(255) DEFAULT 'main',
        analysis_status VARCHAR(50) DEFAULT 'pending',
        total_commits INT DEFAULT 0,
        analyzed_commits INT DEFAULT 0,
        last_analyzed TIMESTAMP_NTZ,
        created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
        updated_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
        FOREIGN KEY (user_id) REFERENCES users(id)
    )
    """
    snowflake_service.execute_query(query, fetch=False)
    logger.info("✅ Repositories table created/verified")


def create_commits_table():
    """Create commits table with vector support"""
    query = """
    CREATE TABLE IF NOT EXISTS commits_analysis (
        id VARCHAR(255) PRIMARY KEY,
        repo_id VARCHAR(255) NOT NULL,
        sha VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        author_name VARCHAR(255),
        author_email VARCHAR(255),
        commit_date TIMESTAMP_NTZ,
        html_url VARCHAR(1024),
        files_changed VARIANT,
        additions INT DEFAULT 0,
        deletions INT DEFAULT 0,
        analysis_status VARCHAR(50) DEFAULT 'pending',
        ai_summary TEXT,
        embedding VECTOR(FLOAT, 768),
        created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
        FOREIGN KEY (repo_id) REFERENCES repositories(id),
        UNIQUE (repo_id, sha)
    )
    """
    snowflake_service.execute_query(query, fetch=False)
    logger.info("✅ Commits table created/verified with VECTOR(768) support")


def create_pr_analysis_table():
    """Create PR analysis table with vector support"""
    query = """
    CREATE TABLE IF NOT EXISTS pr_analysis (
        id VARCHAR(255) PRIMARY KEY,
        repo_id VARCHAR(255) NOT NULL,
        pr_number INT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        author VARCHAR(255),
        merged BOOLEAN DEFAULT FALSE,
        merge_date TIMESTAMP_NTZ,
        commits_count INT DEFAULT 0,
        files_changed VARIANT,
        additions INT DEFAULT 0,
        deletions INT DEFAULT 0,
        ai_summary TEXT,
        embedding VECTOR(FLOAT, 384),
        created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
        FOREIGN KEY (repo_id) REFERENCES repositories(id),
        UNIQUE (repo_id, pr_number)
    )
    """
    snowflake_service.execute_query(query, fetch=False)
    logger.info("✅ PR analysis table created/verified with VECTOR support")


def get_snowflake_service() -> SnowflakeService:
    """Get global Snowflake service instance"""
    return snowflake_service
