"""
Repository management endpoints
"""

from fastapi import APIRouter, HTTPException, Depends, status
from typing import List
from pydantic import BaseModel
import httpx
from app.security.auth import get_current_user
from app.services.github_service import (
    get_user_repositories,
    get_repository_commits_count
)
from app.database.crud import (
    get_user_by_id,
    create_repository,
    get_repository_by_id,
    update_repository_status
)
from app.security.encryption import retrieve_github_token

router = APIRouter()


class AnalyzeRepositoryRequest(BaseModel):
    """Request model for repository analysis"""
    owner: str
    repo_name: str
    full_name: str
    github_repo_id: int
    html_url: str
    default_branch: str = "main"


@router.get("/repositories")
async def list_repositories(current_user: dict = Depends(get_current_user)):
    """
    List all GitHub repositories accessible to the authenticated user
    
    Requires: JWT authentication
    
    Returns:
        List of repositories with basic info
    """
    
    try:
        # Get user from database to retrieve their encrypted GitHub token
        user = await get_user_by_id(current_user["user_id"])
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Decrypt GitHub token
        github_token = await retrieve_github_token(user["encrypted_token_ref"])
        
        # Fetch repositories from GitHub API
        repositories = await get_user_repositories(github_token)
        
        return {
            "count": len(repositories),
            "repositories": repositories
        }
        
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"GitHub API error: {e.response.status_code}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching repositories: {str(e)}"
        )


@router.post("/repositories/analyze")
async def analyze_repository(
    request: AnalyzeRepositoryRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Start analyzing a GitHub repository
    
    This will:
    1. Save repository info to database
    2. Fetch commit count
    3. Queue background analysis job (TODO: implement worker)
    4. Return analysis status
    
    Requires: JWT authentication
    
    Body:
        owner: Repository owner (username/org)
        repo_name: Repository name
        full_name: Full name (owner/repo)
        github_repo_id: GitHub's repository ID
        html_url: Repository URL
        default_branch: Default branch (default: main)
    
    Returns:
        Repository analysis record with status
    """
    
    try:
        # Get user from database
        user = await get_user_by_id(current_user["user_id"])
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Decrypt GitHub token
        github_token = await retrieve_github_token(user["encrypted_token_ref"])
        
        # Create repository record in database
        repository = await create_repository(
            user_id=current_user["user_id"],
            github_repo_id=request.github_repo_id,
            owner=request.owner,
            repo_name=request.repo_name,
            full_name=request.full_name,
            html_url=request.html_url,
            default_branch=request.default_branch
        )
        
        # Get commit count from GitHub
        try:
            commit_count = await get_repository_commits_count(
                github_token,
                request.owner,
                request.repo_name,
                request.default_branch
            )
            
            # Update repository with commit count
            repository = await update_repository_status(
                repository["id"],
                status="pending",
                total_commits=commit_count,
                analyzed_commits=0
            )
        except Exception as e:
            # If we can't get commit count, that's okay, continue anyway
            commit_count = 0
        
        # TODO: Trigger background job to analyze commits
        # For now, we just return the pending status
        # In next steps, we'll implement:
        # - Background worker to fetch commits
        # - Send commits to Gemini for analysis
        # - Store embeddings in Snowflake
        
        if not repository:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create repository record"
            )
        
        return {
            "message": "Repository queued for analysis",
            "repository": {
                "id": repository["id"],
                "full_name": repository["full_name"],
                "analysis_status": repository["analysis_status"],
                "total_commits": repository["total_commits"],
                "analyzed_commits": repository["analyzed_commits"],
                "created_at": repository["created_at"].isoformat()
            }
        }
        
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"GitHub API error: {e.response.status_code}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error starting repository analysis: {str(e)}"
        )


@router.get("/repositories/{repo_id}/status")
async def get_repository_status(
    repo_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get repository analysis status and progress
    
    Returns current analysis status, progress percentage,
    and detailed information about the repository.
    
    Requires: JWT authentication
    
    Path Parameters:
        repo_id: Repository ID (UUID)
    
    Returns:
        Repository status with analysis progress
    """
    
    try:
        # Get repository from database
        repository = await get_repository_by_id(repo_id)
        
        if not repository:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Repository not found"
            )
        
        # Verify repository belongs to authenticated user
        if repository["user_id"] != current_user["user_id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this repository"
            )
        
        # Calculate progress percentage
        progress = 0.0
        if repository["total_commits"] > 0:
            progress = (repository["analyzed_commits"] / repository["total_commits"]) * 100
        
        # Determine if analysis is complete
        is_complete = repository["analysis_status"] == "complete"
        
        # Format response
        return {
            "id": repository["id"],
            "full_name": repository["full_name"],
            "owner": repository["owner"],
            "repo_name": repository["repo_name"],
            "html_url": repository["html_url"],
            "analysis_status": repository["analysis_status"],
            "total_commits": repository["total_commits"],
            "analyzed_commits": repository["analyzed_commits"],
            "progress_percentage": round(progress, 2),
            "is_complete": is_complete,
            "created_at": repository["created_at"].isoformat(),
            "last_analyzed": repository["last_analyzed"].isoformat() if repository["last_analyzed"] else None,
            "updated_at": repository["updated_at"].isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching repository status: {str(e)}"
        )


