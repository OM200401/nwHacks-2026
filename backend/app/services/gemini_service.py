import os
import requests
from typing import List, Dict
from dotenv import load_dotenv

load_dotenv()

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
API_KEY = os.getenv("GEMINI_API_KEY")

print("Loaded API Key:", bool(API_KEY))


def call_gemini(prompt: str) -> str:
    """Call Gemini through OpenRouter"""

    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    }

    payload = {
        # ✅ Correct model from OpenRouter docs
        "model": "google/gemini-2.0-flash-001",
        "messages": [
            {
                "role": "user",
                "content": prompt
            }
        ],
        "temperature": 0.3
    }

    r = requests.post(OPENROUTER_URL, json=payload, headers=headers)

    # Helpful debugging
    if r.status_code != 200:
        print("RAW RESPONSE:", r.text)

    r.raise_for_status()

    return r.json()["choices"][0]["message"]["content"]


def build_prompt(commit: Dict) -> str:
    """Create prompt for a single commit"""

    return f"""
You are a senior software engineer cleaning git history.

Create a PROFESSIONAL commit message following conventional commits style.

Context:
- Original message: {commit.get('message')}
- Lines added: {commit.get('lines_added')}
- Lines deleted: {commit.get('lines_deleted')}

Rules:
- Start with feat/fix/refactor/chore/docs
- MIN 50 CHARS, Max 72 chars first line
- Focus on INTENT not raw diff
- No emojis
- No explanations, only the message

Return ONLY the commit message.
"""


def polish_commits(commits: List[Dict]) -> List[Dict]:
    """
    Takes list of commit objects and returns enriched list
    with ai_polished_message field
    """

    results = []

    for item in commits:
        try:
            polished = call_gemini(build_prompt(item))

            results.append({
                **item,
                "ai_message": polished.strip()
            })

        except Exception as e:
            print("❌ GEMINI ERROR:", e)

            results.append({
                **item,
                "ai_message": item.get("message"),
                "error": str(e)
            })

    return results


def generate_commit_summary(commit_details: Dict) -> str:
    """
    Generate a 50-word AI summary analyzing the commit's code changes.
    
    This function:
    1. Takes commit details including message, files, and code diffs
    2. Sends to Gemini with context about the actual code changes
    3. Returns a concise technical summary for better semantic search
    
    Args:
        commit_details: Dict containing:
            - message: Original commit message
            - files_changed: List of file objects with diffs
            - total_additions: Number of lines added
            - total_deletions: Number of lines deleted
    
    Returns:
        50-word technical summary of what changed and why
    """
    
    # Extract key information
    message = commit_details.get("message", "No message")
    files = commit_details.get("files_changed", [])
    additions = commit_details.get("total_additions", 0)
    deletions = commit_details.get("total_deletions", 0)
    
    # Build context from code changes
    code_context = []
    for file in files[:5]:  # Limit to first 5 files to avoid token limits
        filename = file.get("filename", "unknown")
        status = file.get("status", "modified")
        file_additions = file.get("additions", 0)
        file_deletions = file.get("deletions", 0)
        patch = file.get("patch", "")[:500]  # Limit patch to 500 chars per file
        
        code_context.append(f"""
File: {filename} ({status})
+{file_additions} -{file_deletions}
{patch}
""")
    
    code_changes = "\n".join(code_context) if code_context else "No code changes available"
    
    # Create prompt for Gemini
    prompt = f"""You are a senior software engineer analyzing a git commit.

Generate a concise 50-word technical summary that explains WHAT changed and WHY based on the code.

Commit Message: {message}

Files Changed: {len(files)}
Lines: +{additions} -{deletions}

Code Changes:
{code_changes}

Requirements:
- EXACTLY 50 words (strict limit)
- Focus on the technical changes in the code
- Explain what was implemented/fixed/refactored
- Include key function/file names if relevant
- Use technical language (not casual)
- NO markdown formatting
- Be specific about the changes

Return ONLY the 50-word summary, nothing else."""

    try:
        summary = call_gemini(prompt)
        return summary.strip()
    except Exception as e:
        print(f"❌ Gemini summary generation failed: {e}")
        # Fallback: Use commit message if AI fails
        return f"Commit: {message}. Modified {len(files)} files with {additions} additions and {deletions} deletions."


# ─────────────────────────────────────────────
# MOCK DATA + LOCAL TESTING
# ─────────────────────────────────────────────

MOCK_COMMITS = [
    {
        "commit_id": "a1b2c3",
        "message": "added login",
        "lines_added": """
def login_user(email, password):
    user = db.find_user(email)
    if not user:
        raise ValueError("no user")

    if not verify(password, user.hash):
        raise ValueError("bad pass")

    return create_token(user.id)
""",
        "lines_deleted": ""
    },

    {
        "commit_id": "d4e5f6",
        "message": "fix bug",
        "lines_added": """
- if user.isAdmin = True:
+ if user.isAdmin == True:
""",
        "lines_deleted": ""
    },

    {
        "commit_id": "g7h8i9",
        "message": "cleanup",
        "lines_added": """
import unused

def add(a,b):
    return a+b
""",
        "lines_deleted": """
import unused
"""
    }
]


if __name__ == "__main__":
    print("🧪 Running local Gemini polish test...\n")

    result = polish_commits(MOCK_COMMITS)

    for r in result:
        print("───────────────")
        print("Commit:", r["commit_id"])
        print("Original:", r["message"])
        print("AI:", r["ai_message"])
