"""
User CRUD operations
"""

from typing import Optional, Dict
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
