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

