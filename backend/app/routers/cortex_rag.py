"""
RAG Using Snowflake Cortex AI

This module uses Snowflake's built-in AI functions for:
1. Generating embeddings (SNOWFLAKE.CORTEX.EMBED_TEXT_768)
2. Vector similarity search (VECTOR_COSINE_SIMILARITY)
3. Q&A with LLMs (SNOWFLAKE.CORTEX.COMPLETE)

Why Snowflake Cortex?
- No external libraries needed
- Embeddings generated IN the database (faster)
- Serverless AI - scales automatically
- Multiple embedding models available
"""

from fastapi import APIRouter, HTTPException, Depends, status
from typing import List, Optional
from pydantic import BaseModel
import logging

from app.security.auth import get_current_user
from app.database.snowflake_crud import get_repository_by_id, get_repository_commits
from app.services.snowflake_service import snowflake_service

logger = logging.getLogger(__name__)
router = APIRouter()


class EmbedCommitsRequest(BaseModel):
    """Request to generate embeddings using Snowflake Cortex"""
    model: str = "e5-base-v2"  # Snowflake embedding model
    batch_size: int = 100


class QueryRequest(BaseModel):
    """RAG query request"""
    question: str
    top_k: int = 5
    model: str = "mistral-7b"  # LLM for answer generation


# ============================================================================
# STEP 1: Generate Embeddings Using Snowflake Cortex
# ============================================================================

@router.post("/repositories/{repo_id}/cortex-embed")
async def generate_embeddings_with_cortex(
    repo_id: str,
    request: EmbedCommitsRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Generate embeddings using Snowflake Cortex AI
    
    **How Snowflake Cortex Works:**
    
    Instead of downloading a model and running it locally, Snowflake provides
    serverless AI functions that run directly in the database:
    
    ```sql
    -- Generate embedding for text
    SELECT SNOWFLAKE.CORTEX.EMBED_TEXT_768(
        'e5-base-v2',  -- Model name
        'Fix authentication bug'  -- Your text
    ) as embedding;
    
    -- Returns: [0.123, -0.456, ..., 0.234] (768 numbers)
    ```
    
    **Available Models:**
    - e5-base-v2: 768 dimensions (recommended)
    - snowflake-arctic-embed-m: 768 dimensions
    - snowflake-arctic-embed-l: 1024 dimensions
    
    **The Process:**
    1. Get all commits from commits_analysis table
    2. For each commit, run SQL:
       ```sql
       UPDATE commits_analysis
       SET embedding = SNOWFLAKE.CORTEX.EMBED_TEXT_768(
           'e5-base-v2',
           message || ' ' || COALESCE(ai_summary, '')
       )
       WHERE id = ?
       ```
    3. Snowflake generates embeddings serverlessly
    4. Stored in VECTOR column - ready for search!
    
    **Why This is Better:**
    - No pip install sentence-transformers
    - No downloading 80MB models
    - Snowflake handles GPU/CPU automatically
    - Scales to millions of commits
    - One SQL query does it all!
    """
    
    try:
        # Verify access
        repository = await get_repository_by_id(repo_id)
        if not repository:
            raise HTTPException(status_code=404, detail="Repository not found")
        
        if repository["user_id"] != current_user["user_id"]:
            raise HTTPException(status_code=403, detail="Access denied")
        
        logger.info(f"Generating embeddings with Snowflake Cortex model: {request.model}")
        
        # SQL to generate embeddings using Cortex
        # PRIORITY: ai_summary (code analysis) > message (if no AI summary)
        # Also includes: file paths + additions/deletions for rich context
        query = f"""
        UPDATE commits_analysis
        SET embedding = SNOWFLAKE.CORTEX.EMBED_TEXT_768(
            '{request.model}',
            COALESCE(ai_summary, message) || ' ' || 
            COALESCE(ARRAY_TO_STRING(files_changed, ' '), '') || ' ' ||
            'additions: ' || COALESCE(additions::VARCHAR, '0') || ' ' ||
            'deletions: ' || COALESCE(deletions::VARCHAR, '0')
        )
        WHERE repo_id = %s
          AND embedding IS NULL
        """
        
        # Execute the embedding generation
        snowflake_service.execute_query(query, params=(repo_id,), fetch=False)
        
        # Count how many embeddings were created
        count_query = """
        SELECT COUNT(*) as count
        FROM commits_analysis
        WHERE repo_id = %s AND embedding IS NOT NULL
        """
        result = snowflake_service.execute_query(count_query, params=(repo_id,), fetch=True)
        embedded_count = result[0]["COUNT"] if result else 0
        
        logger.info(f"✅ Generated {embedded_count} embeddings using Snowflake Cortex")
        
        return {
            "message": f"Successfully generated embeddings for {embedded_count} commits",
            "repository": repository["full_name"],
            "model": request.model,
            "embeddings_created": embedded_count
        }
        
    except Exception as e:
        logger.error(f"Cortex embedding error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# STEP 2: RAG Query Using Snowflake Cortex
# ============================================================================

@router.post("/repositories/{repo_id}/cortex-query")
async def query_with_cortex(
    repo_id: str,
    request: QueryRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Query code history using Snowflake Cortex RAG
    
    **Complete RAG Pipeline in Snowflake:**
    
    1. **Generate Question Embedding:**
       ```sql
       SELECT SNOWFLAKE.CORTEX.EMBED_TEXT_768(
           'e5-base-v2',
           'What authentication changes were made?'
       ) as question_embedding
       ```
    
    2. **Vector Similarity Search:**
       ```sql
       SELECT *, VECTOR_COSINE_SIMILARITY(
           embedding,
           question_embedding
       ) as similarity
       FROM commits_analysis
       WHERE repo_id = ?
       ORDER BY similarity DESC
       LIMIT 5
       ```
    
    3. **Generate Answer with LLM:**
       ```sql
       SELECT SNOWFLAKE.CORTEX.COMPLETE(
           'mistral-7b',
           CONCAT(
               'Context: ', commit_messages,
               'Question: ', user_question
           )
       ) as answer
       ```
    
    **All in Snowflake - No External APIs!**
    
    **Available LLMs:**
    - mistral-7b (fast, good quality)
    - llama2-70b-chat (slower, better quality)
    - mistral-large
    - reka-flash
    
    Example:
    ```
    User: "How did we handle login errors?"
    
    Snowflake:
    1. Embeds question → [0.1, 0.2, ...]
    2. Finds similar commits
    3. Generates answer using Mistral-7B
    
    Response: "Login errors were handled through:
    - Timeout handling in commit abc123
    - Error messages in commit def456"
    ```
    """
    
    try:
        # Verify access
        repository = await get_repository_by_id(repo_id)
        if not repository:
            raise HTTPException(status_code=404, detail="Repository not found")
        
        if repository["user_id"] != current_user["user_id"]:
            raise HTTPException(status_code=403, detail="Access denied")
        
        logger.info(f"RAG query: {request.question[:100]}")
        
        # STEP 1: Generate embedding for question using Cortex
        question_embed_query = """
        SELECT SNOWFLAKE.CORTEX.EMBED_TEXT_768('e5-base-v2', %s) as embedding
        """
        embed_result = snowflake_service.execute_query(
            question_embed_query,
            params=(request.question,),
            fetch=True
        )
        
        if not embed_result:
            raise HTTPException(status_code=500, detail="Failed to generate question embedding")
        
        question_embedding = embed_result[0]["EMBEDDING"]
        
        # STEP 2: Vector similarity search
        # Note: We pass the embedding as a string representation for Snowflake
        search_query = f"""
        SELECT 
            id,
            sha,
            message,
            ai_summary,
            author_name,
            commit_date,
            html_url,
            files_changed,
            VECTOR_COSINE_SIMILARITY(embedding, PARSE_JSON(%s)::VECTOR(FLOAT, 768)) as similarity
        FROM commits_analysis
        WHERE repo_id = %s
          AND embedding IS NOT NULL
        ORDER BY similarity DESC
        LIMIT %s
        """
        
        # Convert embedding to JSON string for Snowflake
        import json
        embedding_str = json.dumps(question_embedding)
        
        similar_commits = snowflake_service.execute_query(
            search_query,
            params=(embedding_str, repo_id, request.top_k),
            fetch=True
        )
        
        if not similar_commits:
            return {
                "answer": "No relevant commits found. Make sure embeddings are generated first.",
                "sources": [],
                "question": request.question
            }
        
        # STEP 3: Build context from similar commits
        context_parts = []
        sources = []
        
        for i, commit in enumerate(similar_commits):
            context = f"Commit {i+1} (SHA: {commit['SHA'][:7]}):\n"
            context += f"Message: {commit['MESSAGE']}\n"
            
            if commit.get('AI_SUMMARY'):
                context += f"AI Summary: {commit['AI_SUMMARY']}\n"
            
            if commit.get('FILES_CHANGED'):
                try:
                    files = json.loads(commit['FILES_CHANGED']) if isinstance(commit['FILES_CHANGED'], str) else commit['FILES_CHANGED']
                    files_str = ', '.join(files[:5])
                    context += f"Files: {files_str}\n"
                except:
                    pass
            
            context += f"Similarity: {commit['SIMILARITY']:.2f}\n"
            context_parts.append(context)
            
            sources.append({
                "sha": commit["SHA"],
                "message": commit["MESSAGE"],
                "ai_summary": commit.get("AI_SUMMARY"),
                "html_url": commit.get("HTML_URL"),
                "similarity": commit["SIMILARITY"]
            })
        
        combined_context = "\n\n".join(context_parts)
        
        # STEP 4: Generate answer using Snowflake Cortex LLM
        rag_prompt = f"""You are analyzing commit history for: {repository['full_name']}

Relevant Commits:
{combined_context}

User Question: {request.question}

Instructions:
- Answer based ONLY on the commits above
- Cite specific commits by SHA
- Be concise and technical
- If commits don't fully answer, say so

Answer:"""
        
        llm_query = """
        SELECT SNOWFLAKE.CORTEX.COMPLETE(%s, %s) as answer
        """
        
        answer_result = snowflake_service.execute_query(
            llm_query,
            params=(request.model, rag_prompt),
            fetch=True
        )
        
        if not answer_result:
            raise HTTPException(status_code=500, detail="Failed to generate answer")
        
        ai_answer = answer_result[0]["ANSWER"]
        
        return {
            "answer": ai_answer,
            "sources": sources,
            "question": request.question,
            "repository": repository["full_name"],
            "model": request.model,
            "commits_analyzed": len(similar_commits)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Cortex RAG error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# STEP 3: Simple Embedding Status Check
# ============================================================================

@router.get("/repositories/{repo_id}/embedding-status")
async def get_embedding_status(
    repo_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Check how many commits have embeddings generated
    
    Returns:
    - Total commits in repository
    - Commits with embeddings
    - Commits without embeddings
    """
    
    try:
        repository = await get_repository_by_id(repo_id)
        if not repository:
            raise HTTPException(status_code=404, detail="Repository not found")
        
        if repository["user_id"] != current_user["user_id"]:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Count total commits
        total_query = "SELECT COUNT(*) as count FROM commits_analysis WHERE repo_id = %s"
        total_result = snowflake_service.execute_query(total_query, params=(repo_id,), fetch=True)
        total = total_result[0]["COUNT"] if total_result else 0
        
        # Count commits with embeddings
        embedded_query = "SELECT COUNT(*) as count FROM commits_analysis WHERE repo_id = %s AND embedding IS NOT NULL"
        embedded_result = snowflake_service.execute_query(embedded_query, params=(repo_id,), fetch=True)
        embedded = embedded_result[0]["COUNT"] if embedded_result else 0
        
        return {
            "repository": repository["full_name"],
            "total_commits": total,
            "commits_with_embeddings": embedded,
            "commits_without_embeddings": total - embedded,
            "percentage_complete": round((embedded / total * 100) if total > 0 else 0, 2)
        }
        
    except Exception as e:
        logger.error(f"Error checking embedding status: {e}")
        raise HTTPException(status_code=500, detail=str(e))
