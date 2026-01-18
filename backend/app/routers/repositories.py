"""
Repository management endpoints
"""

from fastapi import APIRouter, HTTPException, Depends, status
from typing import List
import httpx
from app.security.auth import get_current_user
from app.services.github_service import get_user_repositories
from app.database.crud import get_user_by_id
from app.security.encryption import retrieve_github_token

router = APIRouter()


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
