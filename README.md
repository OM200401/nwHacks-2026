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

## Timeline
- Hour 0-2: Issues #1-2 (setup)
- Hour 2-6: Issues #3-4, #8-9 (core features)
- Hour 6-10: Issues #5, #10-11 (AI integrations)
- Hour 10-14: Issues #6-7, #12-13 (polish)
- Hour 14-18: Issue #14 (testing)
- Hour 18-24: Issues #15-16 (demo & submit)