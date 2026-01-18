# CodeAncestry - Legacy Code Explainer

AI-powered tool that transforms undocumented legacy code into multi-layered explanations with voice walkthroughs. Preserving developer knowledge across generations.

## Problem Statement

Developers inherit undocumented legacy codebases and spend 60%+ of their time trying to understand "why" decisions were made. Comments are outdated or missing, original developers have left, and critical tribal knowledge is lost forever. This knowledge gap costs companies millions in productivity and creates barriers for junior developers trying to contribute to mature projects.

## Tech Stack
- **Frontend:** React + TypeScript + Vite
- **Backend:** Python FastAPI  
- **AI:** Snowflake Cortex AI + OpenRouter (Gemini)
- **Database:** Snowflake (Vector Search + Data Warehouse)
- **Security:** 🔐 **1Password** (Secrets Management)
- **Authentication:** GitHub OAuth
- **Deployment:** Vultr (planned)

## 🔐 Security with 1Password

We use **1Password Service Accounts** to securely manage all application secrets:
- ✅ API keys and database credentials stored in encrypted vaults
- ✅ Zero hardcoded secrets in code or environment files
- ✅ Automatic fallback to `.env` for local development
- ✅ Audit logging and access control

See [1Password Integration Guide](backend/docs/1PASSWORD_INTEGRATION.md) for setup instructions.

## Features
- 4-tier explanations (Beginner → Intermediate → Architectural → Risk Analysis)
- Voice walkthrough with multiple personas
- Confusion Score + Time Saved metrics
- GitHub repo integration
- Searchable pattern knowledge base
- Terminal CLI tool: `legacy-explain <file>`
- Export to markdown

---

## 🙏 Sponsors & Partners

### 🔐 [1Password](https://1password.com)
**Secure Secrets Management** - We use 1Password Service Accounts to protect all API keys, database credentials, and OAuth secrets. Zero secrets in code!

[Learn more about our 1Password integration →](backend/docs/1PASSWORD_INTEGRATION.md)

### ☁️ [Vultr](https://www.vultr.com)
**Cloud Infrastructure** (Planned) - Production deployment on Vultr Cloud Compute with Object Storage for caching embeddings.

---

**Built at nwHacks 2026** 🚀
