# Changelog

## 0.3.0 — 2026-10-10
- Added a reliability gate, `check --gate`:
  - R1: split-half rate reliability, Spearman–Brown corrected.
  - R2: bootstrap precision over prompts.
  - R3: Cohen's κ against an independent LLM judge.
  - Adaptive repeats.
  - New commands: `audit` and `gate`.
- Autocomplete prompt expansion (letter-suffix seeds) for 60+ real queries.
- Pre-registered 4-category benchmark (`bench/`).
- Docs: `METHODOLOGY.md`, CI, contributing guide.

## 0.2.0 — 2026-10-10
- Free, agent-first engines: `claude-search` and `codex-search`. Consumer-role instructions; grounding verified per answer.
- Free-tier fallback chains (Groq / Cerebras / NVIDIA / OpenRouter / Gemini / Mistral).
- Tavily RAG grounding, a worker pool, and `doctor`.
- Fixed 12 findings from an independent code review; each has a regression test.

## 0.1.0 — 2026-10-09
- First version: CLI, MCP server, App Store listing lint, mention extraction, Wilson intervals.
