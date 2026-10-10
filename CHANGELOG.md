# Changelog

## 0.3.1 — 2026-10-10
- `init` now asks for **100 prompts** by default (was 20), and warns when autocomplete returns fewer. Why: in the benchmark, 60 prompts failed R2 in 6 of 8 cells, and at the gate's prescription (70–100) 7 of 8 passed.
- `init` points to `check --gate` after the cost preview.
- The benchmark finished. `bench/BENCHMARK.md` now has a follow-up table, and `DEVIATIONS.md` has D4 (weekly limit, Korean prompt pool exhausted).
- README, skill, methodology and launch drafts now state the benchmark results. The 7-app pilot result (ρ = 0.91) is labelled a single observation, not a general finding. Added a section on alternatives and a note on quota cost.

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
