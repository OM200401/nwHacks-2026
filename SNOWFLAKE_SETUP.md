# Snowflake Integration Setup Guide

## 🎯 What Was Done

We've integrated Snowflake as the production database for CodeAncestry, replacing the in-memory dictionaries. Here's what changed:

### ✅ New Files Created

1. **`backend/app/services/snowflake_service.py`**
   - Connection management
   - Database initialization
   - Table creation functions
   - Query execution methods

2. **`backend/app/database/snowflake_crud.py`**
   - Complete CRUD operations for Snowflake
   - User management
   - Repository management
   - Commit storage and retrieval
   - Vector similarity search (for RAG queries)

### 🔄 Modified Files

1. **`backend/main.py`**
   - Added database initialization on startup
   - Graceful connection close on shutdown

2. **`backend/app/routers/repositories.py`**
   - Updated imports to use `snowflake_crud` instead of `crud`

3. **`backend/app/routers/auth.py`**
   - Updated imports to use `snowflake_crud` instead of `crud`

### 📊 Database Schema

The following tables are created automatically on first startup:

#### **users**
- `id` (VARCHAR) - UUID
- `github_id` (VARCHAR) - GitHub user ID
- `github_username` (VARCHAR)
- `encrypted_token_ref` (VARCHAR) - Reference to encrypted GitHub token
- `email` (VARCHAR, optional)
- `created_at` (TIMESTAMP)
- `last_login` (TIMESTAMP)

#### **repositories**
- `id` (VARCHAR) - UUID
- `user_id` (VARCHAR) - FK to users
- `github_repo_id` (NUMBER) - GitHub repository ID
- `owner` (VARCHAR)
- `repo_name` (VARCHAR)
- `full_name` (VARCHAR)
- `html_url` (VARCHAR)
- `default_branch` (VARCHAR)
- `analysis_status` (VARCHAR) - pending/analyzing/complete/failed
- `total_commits` (NUMBER)
- `analyzed_commits` (NUMBER)
- `last_analyzed` (TIMESTAMP)
- `created_at`, `updated_at` (TIMESTAMP)

#### **commits_analysis**
- `id` (VARCHAR) - UUID
- `repo_id` (VARCHAR) - FK to repositories
- `sha` (VARCHAR) - Commit hash
- `message` (VARCHAR) - Original commit message
- `author_name`, `author_email` (VARCHAR)
- `commit_date` (TIMESTAMP)
- `html_url` (VARCHAR)
- `files_changed` (VARIANT) - JSON array of file paths
- `additions`, `deletions` (NUMBER)
- `analysis_status` (VARCHAR)
- `ai_summary` (VARCHAR) - AI-enhanced commit message
- **`embedding` (VECTOR(FLOAT, 384))** - Vector for RAG queries
- `created_at` (TIMESTAMP)

#### **pr_analysis**
- `id`, `repo_id`, `pr_number` (similar structure)
- **`embedding` (VECTOR(FLOAT, 384))**
- PR-specific fields

---

## ⚙️ Setup Instructions

### Step 1: Update `.env` File

Replace the placeholder Snowflake values in your `.env` file with your actual credentials:

```env
# Snowflake Configuration
SNOWFLAKE_ACCOUNT=your_actual_account_identifier  # e.g., xy12345.us-east-1
SNOWFLAKE_USER=your_snowflake_username
SNOWFLAKE_PASSWORD=your_snowflake_password
SNOWFLAKE_DATABASE=CODEANCESTRY
SNOWFLAKE_SCHEMA=PUBLIC
SNOWFLAKE_WAREHOUSE=COMPUTE_WH
```

**Where to find these values:**
1. **Account Identifier**: In Snowflake UI → Admin → Accounts (format: `orgname-accountname`)
2. **Username/Password**: Your Snowflake login credentials
3. **Database**: We're using `CODEANCESTRY` (will be created automatically)
4. **Schema**: `PUBLIC` (default)
5. **Warehouse**: `COMPUTE_WH` (or your preferred warehouse name)

### Step 2: Verify Dependencies

Ensure these packages are in your `requirements.txt` (already added):

```txt
snowflake-connector-python==3.6.0
snowflake-sqlalchemy==1.5.1
SQLAlchemy==1.4.53  # Must be 1.x for compatibility
```

### Step 3: Test Connection

Start the server to test the Snowflake connection:

```bash
cd backend
python main.py
```

**Expected output:**
```
🚀 CodeAncestry API starting...
📊 Initializing Snowflake database...
✅ Snowflake connection established
✅ Created table: users
✅ Created table: repositories
✅ Created table: commits_analysis
✅ Created table: pr_analysis
✅ Snowflake database initialized successfully
```

**If connection fails:**
- Check credentials in `.env`
- Verify warehouse is running in Snowflake UI
- Check network access (firewall/VPN)
- Look for error details in console

### Step 4: Test Endpoints

Once the server starts successfully:

1. **Test Auth** → http://localhost:8000/docs
2. **Login with GitHub** → Create a user record in Snowflake
3. **Fetch repositories** → Store in `repositories` table
4. **Analyze commits** → Store in `commits_analysis` table
5. **Enhance with AI** → Update `ai_summary` field

---

## 🚀 New Features Unlocked

### 1. Vector Similarity Search

The `search_commits_by_vector()` function in `snowflake_crud.py` enables RAG queries:

```python
results = await search_commits_by_vector(
    repo_id="repo_uuid",
    query_embedding=[0.1, 0.2, ...],  # 384-dimensional vector
    limit=5
)
```

**Uses Snowflake's VECTOR_COSINE_SIMILARITY** to find most relevant commits.

### 2. Persistent Storage

- All data survives server restarts
- No more in-memory dictionaries
- Production-ready database

### 3. Scalability

- Snowflake handles millions of commits
- Automatic query optimization
- Parallel processing capabilities

---

## 📝 Migration Notes

### What Changed

**Before (in-memory):**
```python
from app.database.crud import create_commit
# Stored in: commits_db = {}
```

**After (Snowflake):**
```python
from app.database.snowflake_crud import create_commit
# Stored in: Snowflake commits_analysis table
```

### Backward Compatibility

All CRUD function signatures remain the same. Your existing code works without changes.

### Data Migration

If you had test data in memory, it's gone now. That's expected for this migration. The database starts fresh.

---

## 🐛 Troubleshooting

### Error: "Invalid account identifier"
- Check `SNOWFLAKE_ACCOUNT` format (should be `orgname-accountname` or `account.region`)
- No `https://` or trailing slashes

### Error: "Warehouse not found"
- Log into Snowflake UI
- Go to Admin → Warehouses
- Start your warehouse or use a different name

### Error: "Database does not exist"
- The app creates it automatically
- Ensure your user has `CREATE DATABASE` privilege

### Error: "Connection timeout"
- Check firewall/VPN settings
- Verify IP whitelisting in Snowflake

### Error: "250001 (08001): None: Failed to connect to DB"
- Double-check username and password
- Ensure account identifier is correct

---

## 🎉 Next Steps

1. ✅ **Complete Snowflake setup** (update `.env` and test connection)
2. 🔜 **Add vector embeddings**:
   - Install `sentence-transformers`
   - Generate embeddings for commits after AI enhancement
   - Store in `embedding` column
3. 🔜 **Create RAG query endpoint**:
   - POST `/api/query`
   - Convert user question to embedding
   - Search similar commits
   - Generate answer with Gemini
4. 🔜 **Background processing**:
   - Auto-analyze repos after "Analyze" button
   - Batch AI enhancement
   - Automatic embedding generation

---

## 📚 Resources

- [Snowflake VECTOR Data Type Docs](https://docs.snowflake.com/en/sql-reference/data-types-vector)
- [Snowflake Connector Python](https://docs.snowflake.com/en/developer-guide/python-connector/python-connector)
- [Vector Similarity Functions](https://docs.snowflake.com/en/sql-reference/functions/vector_cosine_similarity)

---

**Questions?** Check the logs when starting the server for detailed error messages.
