# CodeAncestry - Legacy Code Explainer

AI-powered tool that transforms undocumented legacy code into multi-layered explanations with voice walkthroughs. Preserving developer knowledge across generations.

## Problem Statement

Developers inherit undocumented legacy codebases and spend 60%+ of their time trying to understand "why" decisions were made. Comments are outdated or missing, original developers have left, and critical tribal knowledge is lost forever. This knowledge gap costs companies millions in productivity and creates barriers for junior developers trying to contribute to mature projects.

## Tech Stack
- **Frontend:** Lovable (React)
- **Backend:** Python FastAPI on Vultr
- **AI:** Gemini API (analysis) + ElevenLabs (voice)
- **Data:** Snowflake
- **Security:** 1Password
- **Dev Tools:** Warp Terminal CLI
- **Domain:** .tech

## Features
- 4-tier explanations (Beginner → Intermediate → Architectural → Risk Analysis)
- Voice walkthrough with multiple personas
- Confusion Score + Time Saved metrics
- GitHub repo integration
- Searchable pattern knowledge base
- Terminal CLI tool: `legacy-explain <file>`
- Export to markdown

## Issues & Tasks

### SETUP (Critical - Do First)
**#1:** Get all API keys (Gemini, ElevenLabs, Snowflake, Vultr, 1Password), register .tech domain  
**#2:** Set up Vultr instance, deploy FastAPI backend with SSL

### FRONTEND
**#3:** Initialize Lovable project with dark mode and routing  
**#4:** Build code input interface with syntax highlighting  
**#5:** Create 4-tier explanation display UI with diagrams  
**#6:** Add voice player with controls  
**#7:** Build search & history page with filters

### BACKEND
**#8:** Set up FastAPI core with routes and validation  
**#9:** Integrate Gemini API for code analysis (4 tiers + diagrams)  
**#10:** Integrate ElevenLabs for voice generation  
**#11:** Connect Snowflake for data storage and pattern matching  
**#12:** Implement 1Password security (API encryption, OAuth)

### DEV TOOLS
**#13:** Build Warp Terminal CLI tool (`legacy-explainer`)

### FINAL
**#14:** End-to-end testing on all devices  
**#15:** Prepare demo + record 2-min video  
**#16:** Write Devpost submission + practice pitch

## Prize Targets
🎯 Telus Innovation ($1,000) | Block AI ($400) | 1Password Security ($400) | Warp Dev Tool | Best Design | 6+ MLH prizes

## Parallel Team Tasks (Backend)

### Person 1: FastAPI Core & Routing
**Files:** `main.py`, `app/core/config.py`, `app/models/schemas.py`, `app/routers/*.py`
**Tasks:** Set up FastAPI server, CORS, route structure, Pydantic models, error handling, logging. Create all route stubs for other teammates to integrate with.

### Person 2: Gemini AI & Prompt Engineering  
**Files:** `app/services/gemini_service.py`, `app/prompts/analysis_prompts.py`, `app/utils/*.py`
**Tasks:** Integrate Gemini API, write 4-tier explanation prompts, implement confusion score algorithm, code pattern detection, Mermaid diagram generation.

### Person 3: Snowflake Database
**Files:** `app/database/*.py`, `app/database/schema.sql`
**Tasks:** Set up Snowflake connection, create database schema, implement CRUD operations (save/retrieve analyses), build search & pattern matching, implement caching.

### Person 4: ElevenLabs Voice & Security
**Files:** `app/services/voice_service.py`, `app/security/*.py`
**Tasks:** Integrate ElevenLabs API for voice generation, implement audio caching, add JWT authentication, 1Password integration, API rate limiting.
