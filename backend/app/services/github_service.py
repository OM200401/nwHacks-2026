"""
GitHub API integration service
"""

import httpx
from typing import List, Dict, Optional
from app.security.encryption import retrieve_github_token


async def get_user_repositories(github_token: str) -> List[Dict]:
    """
    Fetch user's GitHub repositories
    
    Args:
        github_token: Decrypted GitHub access token
    
    Returns:
        List of repository objects with name, url, description, etc.
    """
    
    url = "https://api.github.com/user/repos"
    headers = {
        "Authorization": f"Bearer {github_token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
    }
    
    # Fetch all repos (including private ones)
    params = {
        "per_page": 100,  # Max per page
        "sort": "updated",  # Most recently updated first
        "affiliation": "owner,collaborator"  # Repos user owns or collaborates on
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers, params=params)
        response.raise_for_status()  # Raise error if request failed
        
        repos = response.json()
    
    # Transform to our format
    return [
        {
            "id": repo["id"],
            "name": repo["name"],
            "full_name": repo["full_name"],
            "description": repo.get("description", ""),
            "html_url": repo["html_url"],
            "private": repo["private"],
            "language": repo.get("language"),
            "stargazers_count": repo["stargazers_count"],
            "updated_at": repo["updated_at"],
            "default_branch": repo["default_branch"]
        }
        for repo in repos
    ]


async def get_repository_details(github_token: str, owner: str, repo: str) -> Dict:
    """
    Get detailed information about a specific repository
    
    Args:
        github_token: Decrypted GitHub access token
        owner: Repository owner (username or org)
        repo: Repository name
    
    Returns:
        Detailed repository information
    """
    
    url = f"https://api.github.com/repos/{owner}/{repo}"
    headers = {
        "Authorization": f"Bearer {github_token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers)
        response.raise_for_status()
        
        return response.json()
