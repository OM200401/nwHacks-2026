"""
1Password Secrets Manager Integration

This module provides secure secret management using 1Password Service Accounts.
Secrets are stored in 1Password vaults instead of .env files.

Sponsor: 1Password - https://1password.com
"""

import os
import subprocess
import json
from typing import Optional, Dict
import logging
from dotenv import load_dotenv

# Load environment variables (including OP_SERVICE_ACCOUNT_TOKEN)
load_dotenv()

logger = logging.getLogger(__name__)

# 1Password CLI available check
def check_op_cli_available():
    """Check if op CLI is installed and accessible"""
    # Common installation paths on Windows
    possible_paths = [
        'op',  # In PATH
        r'C:\Program Files\1Password CLI\op.exe',
        os.path.expandvars(r'%LOCALAPPDATA%\Programs\1Password CLI\op.exe'),
    ]
    
    for op_path in possible_paths:
        try:
            result = subprocess.run([op_path, '--version'], capture_output=True, timeout=2)
            if result.returncode == 0:
                return op_path
        except (FileNotFoundError, subprocess.TimeoutExpired):
            continue
    return None

OP_CLI_PATH = check_op_cli_available()
ONEPASSWORD_AVAILABLE = OP_CLI_PATH is not None


class OnePasswordService:
    """
    1Password Service Account integration for secure secret management.
    
    This replaces environment variables with 1Password vault references,
    providing enhanced security for API keys, database credentials, and tokens.
    """
    
    def __init__(self):
        """Initialize 1Password service with service account token"""
        self.service_account_token = os.getenv("OP_SERVICE_ACCOUNT_TOKEN")
        self.use_1password = False
        
        if self.service_account_token and ONEPASSWORD_AVAILABLE:
            # Verify token works with op CLI
            try:
                env = os.environ.copy()
                env["OP_SERVICE_ACCOUNT_TOKEN"] = self.service_account_token
                result = subprocess.run([OP_CLI_PATH, 'vault', 'list'], 
                                      capture_output=True, 
                                      text=True,
                                      env=env,
                                      timeout=5)
                if result.returncode == 0:
                    self.use_1password = True
                    logger.info("🔐 1Password CLI initialized - Using secure vault storage")
                else:
                    logger.warning(f"⚠️ 1Password CLI authentication failed: {result.stderr[:100]}")
            except Exception as e:
                logger.error(f"❌ Failed to initialize 1Password CLI: {e}")
                logger.warning("⚠️ Falling back to .env files")
        else:
            if not self.service_account_token:
                logger.warning("⚠️ OP_SERVICE_ACCOUNT_TOKEN not set - Falling back to .env files")
            if not ONEPASSWORD_AVAILABLE:
                logger.warning("⚠️ 1Password CLI not available - Falling back to .env files")
    
    def get_secret(self, vault_name: str, item_name: str, field_name: str) -> Optional[str]:
        """
        Retrieve a secret from 1Password vault or fall back to environment variable.
        
        Args:
            vault_name: Vault name (e.g., "CodeAncestry")
            item_name: Item/field name in vault (e.g., "Snowflake")
            field_name: Field name within the item (e.g., "account")
            
        Returns:
            Secret value or None if not found
            
        Example:
            >>> secret = op_service.get_secret("CodeAncestry", "Snowflake", "account")
        """
        # Try 1Password CLI first
        if self.use_1password:
            try:
                env = os.environ.copy()
                env["OP_SERVICE_ACCOUNT_TOKEN"] = self.service_account_token
                
                # Use op CLI to get item
                cmd = [OP_CLI_PATH, 'item', 'get', item_name, '--vault', vault_name, '--format', 'json']
                result = subprocess.run(cmd, 
                                      capture_output=True, 
                                      text=True,
                                      env=env,
                                      timeout=5)
                
                if result.returncode == 0:
                    try:
                        item_data = json.loads(result.stdout)
                        # Find field in item
                        if "fields" in item_data:
                            for field in item_data["fields"]:
                                if field.get("label", "").lower() == field_name.lower():
                                    logger.debug(f"✅ Retrieved '{item_name}.{field_name}' from 1Password")
                                    return field.get("value")
                        logger.warning(f"⚠️ Field '{field_name}' not found in {item_name}")
                    except json.JSONDecodeError:
                        logger.warning(f"⚠️ Failed to parse 1Password response")
                else:
                    logger.warning(f"⚠️ 1Password CLI error: {result.stderr[:100]}")
            except Exception as e:
                logger.warning(f"⚠️ 1Password retrieval failed: {e}")
        
        # Fallback: return None to indicate use .env
        return None
    
    def is_configured(self) -> bool:
        """Check if 1Password is properly configured and available."""
        return self.use_1password


# Global instance
_op_service = OnePasswordService()


def get_secret(key: str, fallback_env: Optional[str] = None) -> Optional[str]:
    """
    Retrieve a secret from 1Password vault ONLY.
    
    Args:
        key: Secret key (e.g., "snowflake_account")
        fallback_env: Deprecated parameter, kept for backwards compatibility
        
    Returns:
        Secret value from 1Password vault or None if not found
        
    Example:
        >>> from app.services.onepassword_service import get_secret
        >>> account = get_secret("snowflake_account")
    """
    # Check if key exists in vault mapping
    if key not in VAULT_ITEMS:
        logger.error(f"❌ Unknown secret key: {key}")
        return None
    
    vault_name, item_name, field_name = VAULT_ITEMS[key]
    
    # Retrieve from 1Password vault only
    value = _op_service.get_secret(vault_name, item_name, field_name)
    if value:
        return value
    
    # No fallback - secrets must come from 1Password
    logger.error(f"❌ Failed to retrieve '{key}' from 1Password vault. Ensure the secret is properly configured in vault '{vault_name}'")
    return None


def is_configured() -> bool:
    """Check if 1Password is configured."""
    return _op_service.is_configured()


# 1Password Vault Item Mappings
# Maps config keys to (vault_name, item_name, field_name) tuples
VAULT_ITEMS = {
    "snowflake_account": ("CodeAncestry", "Snowflake", "account"),
    "snowflake_user": ("CodeAncestry", "Snowflake", "username"),
    "snowflake_password": ("CodeAncestry", "Snowflake", "password"),
    "snowflake_warehouse": ("CodeAncestry", "Snowflake", "warehouse"),
    "snowflake_database": ("CodeAncestry", "Snowflake", "database"),
    "snowflake_schema": ("CodeAncestry", "Snowflake", "schema"),
    "openrouter_api_key": ("CodeAncestry", "API Keys", "openrouter_api_key"),
    "gemini_api_key": ("CodeAncestry", "API Keys", "gemini_api_key"),
    "github_client_id": ("CodeAncestry", "GitHub OAuth", "client_id"),
    "github_client_secret": ("CodeAncestry", "GitHub OAuth", "client_secret"),
    "jwt_secret": ("CodeAncestry", "Security", "jwt_secret_key"),
}

# Legacy reference format (kept for compatibility)
SECRET_REFS = {k: f"op://CodeAncestry/{v[1]}/{v[2]}" for k, v in VAULT_ITEMS.items()}


# Global instance
_op_service = OnePasswordService()


def is_configured() -> bool:
    """Check if 1Password is available."""
    return _op_service.use_1password
