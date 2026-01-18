"""
Query optimization utilities for Snowflake operations

This module provides:
1. Query result caching
2. Batch processing helpers
3. Query plan optimization hints
"""

from typing import Dict, Any, Optional, List
import hashlib
import json
import time
import logging
from functools import lru_cache

logger = logging.getLogger(__name__)


# Simple in-memory cache for embedding queries (can be replaced with Redis)
_embedding_cache: Dict[str, tuple] = {}
CACHE_TTL = 300  # 5 minutes


def get_query_cache_key(query: str, params: tuple) -> str:
    """Generate cache key for query + params"""
    cache_str = f"{query}:{json.dumps(params, default=str)}"
    return hashlib.md5(cache_str.encode()).hexdigest()


def cache_embedding_result(query: str, params: tuple, result: Any, ttl: int = CACHE_TTL):
    """Cache embedding query result"""
    key = get_query_cache_key(query, params)
    expiry = time.time() + ttl
    _embedding_cache[key] = (result, expiry)
    logger.debug(f"Cached query result: {key[:8]}...")


def get_cached_embedding_result(query: str, params: tuple) -> Optional[Any]:
    """Get cached embedding result if not expired"""
    key = get_query_cache_key(query, params)
    
    if key in _embedding_cache:
        result, expiry = _embedding_cache[key]
        
        if time.time() < expiry:
            logger.debug(f"Cache hit: {key[:8]}...")
            return result
        else:
            # Expired, remove from cache
            del _embedding_cache[key]
            logger.debug(f"Cache expired: {key[:8]}...")
    
    return None


def clear_expired_cache():
    """Remove expired entries from cache"""
    current_time = time.time()
    expired_keys = [k for k, (_, expiry) in _embedding_cache.items() if current_time >= expiry]
    
    for key in expired_keys:
        del _embedding_cache[key]
    
    if expired_keys:
        logger.info(f"Cleared {len(expired_keys)} expired cache entries")


def get_optimized_search_query(
    include_filters: bool = False,
    prefer_ai_summaries: bool = True
) -> str:
    """
    Get optimized vector similarity search query
    
    Optimizations:
    - Index hints for repo_id
    - Filtering NULL embeddings early
    - Optional AI summary preference
    """
    base_query = """
    SELECT 
        id,
        sha,
        message,
        ai_summary,
        author_name,
        commit_date,
        html_url,
        files_changed,
        VECTOR_COSINE_SIMILARITY(embedding, PARSE_JSON(?)::VECTOR(FLOAT, 768)) as similarity
    FROM commits_analysis
    WHERE repo_id = ?
      AND embedding IS NOT NULL
    """
    
    if prefer_ai_summaries:
        base_query += "  AND ai_summary IS NOT NULL\n"
    
    base_query += """
    ORDER BY similarity DESC
    LIMIT ?
    """
    
    return base_query


def batch_process_commits(
    commits: List[Dict],
    batch_size: int = 50
) -> List[List[Dict]]:
    """
    Split commits into batches for efficient processing
    
    Args:
        commits: List of commit dictionaries
        batch_size: Number of commits per batch
        
    Returns:
        List of batches
    """
    batches = []
    for i in range(0, len(commits), batch_size):
        batch = commits[i:i + batch_size]
        batches.append(batch)
    
    logger.info(f"Split {len(commits)} commits into {len(batches)} batches")
    return batches


def get_bulk_embedding_query(batch_size: int) -> str:
    """
    Generate optimized bulk embedding update query
    
    Uses CASE statement for conditional updates
    """
    query = """
    UPDATE commits_analysis
    SET embedding = SNOWFLAKE.CORTEX.EMBED_TEXT_768(
        ?,
        COALESCE(ai_summary, message) || ' ' || 
        COALESCE(ARRAY_TO_STRING(files_changed, ' '), '') || ' ' ||
        'additions: ' || COALESCE(additions::VARCHAR, '0') || ' ' ||
        'deletions: ' || COALESCE(deletions::VARCHAR, '0')
    )
    WHERE repo_id = ?
      AND embedding IS NULL
      AND id IN ({placeholders})
    """.format(placeholders=','.join(['?'] * batch_size))
    
    return query


# Statistics tracking
query_stats = {
    "total_queries": 0,
    "cached_hits": 0,
    "cache_hit_rate": 0.0
}


def update_query_stats(cache_hit: bool):
    """Update query statistics"""
    query_stats["total_queries"] += 1
    if cache_hit:
        query_stats["cached_hits"] += 1
    
    query_stats["cache_hit_rate"] = (
        query_stats["cached_hits"] / query_stats["total_queries"] * 100
        if query_stats["total_queries"] > 0 else 0
    )


def get_query_stats() -> Dict[str, Any]:
    """Get current query statistics"""
    return {
        **query_stats,
        "cache_size": len(_embedding_cache),
        "cache_memory_kb": len(str(_embedding_cache)) / 1024
    }
