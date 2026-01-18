"""
User CRUD operations
"""

from typing import List, Optional, Dict
import uuid
from datetime import datetime

users_db = {}


async def create_or_update_user(github_id: str, github_username: str, encrypted_token_ref: str, email: Optional[str] = None) -> Dict:
    """Create new user or update existing"""
    for user in users_db.values():
        if user["github_id"] == github_id:
            user["github_username"] = github_username
            user["encrypted_token_ref"] = encrypted_token_ref
            user["email"] = email
            user["last_login"] = datetime.utcnow()
            return user
    
    user_id = str(uuid.uuid4())
    new_user = {
        "id": user_id,
        "github_id": github_id,
        "github_username": github_username,
        "encrypted_token_ref": encrypted_token_ref,
        "email": email,
        "created_at": datetime.utcnow(),
        "last_login": datetime.utcnow()
    }
    users_db[user_id] = new_user
    return new_user


async def get_user_by_id(user_id: str) -> Optional[Dict]:
    """Get user by ID"""
    return users_db.get(user_id)


# Repository storage (in-memory for MVP)
repositories_db = {}


async def create_repository(
    user_id: str,
    github_repo_id: int,
    owner: str,
    repo_name: str,
    full_name: str,
    html_url: str,
    default_branch: str = "main"
) -> Dict:
    """
    Create repository record for analysis
    
    Args:
        user_id: Owner user ID
        github_repo_id: GitHub's repository ID
        owner: Repository owner (username/org)
        repo_name: Repository name
        full_name: Full name (owner/repo)
        html_url: GitHub URL
        default_branch: Default branch name
    
    Returns:
        Repository record
    """
    import uuid
    from datetime import datetime
    
    # Check if repo already exists for this user
    for repo in repositories_db.values():
        if repo["github_repo_id"] == github_repo_id and repo["user_id"] == user_id:
            # Update existing
            repo["analysis_status"] = "pending"
            repo["analyzed_commits"] = 0
            repo["last_analyzed"] = None
            return repo
    
    # Create new repository record
    repo_id = str(uuid.uuid4())
    new_repo = {
        "id": repo_id,
        "user_id": user_id,
        "github_repo_id": github_repo_id,
        "owner": owner,
        "repo_name": repo_name,
        "full_name": full_name,
        "html_url": html_url,
        "default_branch": default_branch,
        "analysis_status": "pending",  # pending, processing, complete, failed
        "total_commits": 0,
        "analyzed_commits": 0,
        "last_analyzed": None,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    repositories_db[repo_id] = new_repo
    return new_repo


async def get_repository_by_id(repo_id: str) -> Optional[Dict]:
    """Get repository by ID"""
    return repositories_db.get(repo_id)


async def update_repository_status(
    repo_id: str,
    status: str,
    total_commits: int = None, # type: ignore
    analyzed_commits: int = None # type: ignore
) -> Optional[Dict]:
    """
    Update repository analysis status
    
    Args:
        repo_id: Repository ID
        status: New status (pending, processing, complete, failed)
        total_commits: Total number of commits
        analyzed_commits: Number of commits analyzed
    """
    from datetime import datetime
    
    repo = repositories_db.get(repo_id)
    if not repo:
        return None
    
    repo["analysis_status"] = status
    repo["updated_at"] = datetime.utcnow()
    
    if total_commits is not None:
        repo["total_commits"] = total_commits
    
    if analyzed_commits is not None:
        repo["analyzed_commits"] = analyzed_commits
    
    if status == "complete":
        repo["last_analyzed"] = datetime.utcnow()
    
    return repo


async def get_user_repositories(user_id: str) -> List[Dict]:
    """Get all repositories for a user"""
    return [repo for repo in repositories_db.values() if repo["user_id"] == user_id]

