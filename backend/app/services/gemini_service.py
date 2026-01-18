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
