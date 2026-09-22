# CLAUDE.md — Claude Developer Guide for Celueste
> This document instructs Anthropic Claude (Claude Code, Claude 3.5 Sonnet, Claude Desktop) to collaborate seamlessly with Gemini and GPT.

## 📌 Master Instructions
- Please read and strictly adhere to **`AGENTS.md`** at the project root for the product constitution, engineering safety rules, file responsibility map, and AI collaboration protocol.
- For recent releases and architectural history, refer to **`CHANGELOG.md`** and **`docs/ARCHITECTURE_WORKFLOW_V2.md`**.

## 🚀 Key Commands
- **Typecheck**: `cd apps/mobile && cmd.exe /c npx tsc --noEmit`
- **Run Local Web**: `cd apps/mobile && npm run web`
- **Deploy to GitHub Pages**: `powershell -ExecutionPolicy Bypass -File .\deploy-gh-pages.ps1`
- **Git Push to Main**: `git add . ; git commit -m "..." ; git push origin main`

## ⚖️ Critical Constraints
1. **Never mock/hardcode questions**: Return `NEEDS_CONNECTION` when API keys are absent.
2. **Local-First & Zero-Knowledge**: User data and API keys stay exclusively on the local device.
3. **500-Line Limit**: Keep files modular and compact under 500 lines.
4. **Strict Domain Isolation**: Follow prompt constitution in `apps/mobile/src/domain/prompts.ts`.
5. **Answer Random Distribution**: Always maintain Fisher-Yates shuffle in `apps/mobile/src/domain/question_distribution.ts`.
6. **Anti-Zoom on Mobile**: All text inputs must maintain `fontSize: 16` to prevent browser viewport collapse.
7. **Anti-Duplication**: Prevent boilerplate carbon-copy questions within the same unit.
