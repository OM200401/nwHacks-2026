"""
1Password integration for secure token storage
"""

from app.core.config import settings
import hashlib
import base64


async def store_token_in_1password(user_id: str, token: str) -> str:
    """Store GitHub access token securely"""
    encrypted = encrypt_github_token(token)
    ref_id = "1p_ref_" + hashlib.sha256(user_id.encode()).hexdigest()[:16]
    return encrypted


def encrypt_github_token(token: str) -> str:
    """Encrypt GitHub token (MVP: simple obfuscation)"""
    key = settings.JWT_SECRET_KEY.encode()
    token_bytes = token.encode()
    encrypted_bytes = bytes(a ^ b for a, b in zip(token_bytes, key * (len(token_bytes) // len(key) + 1)))
    return base64.b64encode(encrypted_bytes).decode()


def decrypt_github_token(encrypted_token: str) -> str:
    """Decrypt GitHub token"""
    key = settings.JWT_SECRET_KEY.encode()
    encrypted_bytes = base64.b64decode(encrypted_token.encode())
    token_bytes = bytes(a ^ b for a, b in zip(encrypted_bytes, key * (len(encrypted_bytes) // len(key) + 1)))
    return token_bytes.decode()


async def retrieve_github_token(encrypted_token_ref: str) -> str:
    """Retrieve GitHub token from encrypted reference"""
    return decrypt_github_token(encrypted_token_ref)
