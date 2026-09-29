# CLAUDE.md — Claude Developer Guide for Celueste
> This document guides Claude on Celueste. Verify the current branch and `DEVELOPER.md` before acting; historical handoff notes may be stale.

## 📌 Master Instructions
- Please read and strictly adhere to **`AGENTS.md`** at the project root for the product constitution, engineering safety rules, file responsibility map, and AI collaboration protocol.
- For recent releases and architectural history, refer to **`CHANGELOG.md`** and **`docs/ARCHITECTURE_WORKFLOW_V2.md`**.
- Before implementing or revising a shared task, read **`docs/ai-handoff/STATUS.json`**, **`TASK.md`**, and the latest **`CODEX_REVIEW.md`**. Record implementation results in **`CLAUDE_REPORT.md`** and hand the phase back to `codex_review` without pushing, merging, or deploying unless the user explicitly approves it.

## 🚀 Key Commands
- **Typecheck**: `cd apps/mobile && cmd.exe /c npx tsc --noEmit`
- **Run Local Web**: `cd apps/mobile && npm run web`
- **Deploy to GitHub Pages**: `powershell -ExecutionPolicy Bypass -File .\deploy-gh-pages.ps1`
- **Git**: stage only requested files and use a short Korean commit message. Push, merge into `main`, build, and deploy require separate user approval.

## ⚖️ Critical Constraints
1. **Never mock/hardcode questions**: Return `NEEDS_CONNECTION` when API keys are absent.
2. **Local-First, not zero external transfer**: learning data is stored locally, but explicitly requested AI calls send necessary content and the user's API key to the provider; optional ranking and Formspree reports cross separate network boundaries.
3. **Responsibility boundaries**: keep UI, domain, integrations and storage separate; do not refactor files just to satisfy a line-count target.
4. **Strict Domain Isolation**: Follow prompt constitution in `apps/mobile/src/domain/prompts.ts`.
5. **Answer Random Distribution**: Always maintain Fisher-Yates shuffle in `apps/mobile/src/domain/question_distribution.ts`.
6. **Mobile accessibility**: keep text inputs at least 16px on mobile web without disabling user zoom.
7. **Anti-Duplication**: Prevent boilerplate carbon-copy questions within the same unit.
