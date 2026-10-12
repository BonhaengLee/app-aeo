# Changelog

## 0.4.1 — 2026-10-12
- **Correction: engines read search results, not pages.**
  - Raw `codex exec --json` events (3 prompts) show one `search` action per answer and no `open_page`. Each answer receives about 35 results: a title and a snippet, median 145 characters.
  - Docs before this version said Codex "opens pages" and "reads ~30 third-party pages". Both statements are corrected in README, METHODOLOGY §7, the skill and the code comments.
- **Every answer records what it received (`seen`).**
  - Codex: the result titles and snippets.
  - Claude: its WebSearch tool results.
  - `diagnose` reads causes directly from `seen` (selection if the target is in it, coverage if not) and computes the listing share over the results. No fetching is needed.
  - Older runs fall back to fetched pages, as before.
- **Fix: Codex answer links were counted as sources.** Links the model wrote in its own answer were counted as sources, although they are chosen after deciding. They are now kept apart (`answerUrls`), and `diagnose` drops them from older runs. Regression and mutation tests added.
- **Controlled tests (`bench/causal/`, 987 calls) relabelled exploratory.** Results are unchanged as pre-registered (H1–H3 not supported; H4 +19.2 pp, 95% CI +8.1 … +31.3). An adversarial review found:
  - the contexts were 3000-character page excerpts, not the snippets live answers see;
  - H4 comes from 3 of 5 apps (app-level 3/3, p 0.125) and is confounded with repetition and position;
  - "named" includes caveats and one misattribution;
  - H1 had only 6 informative units.

  See `bench/causal/REPORT.md` § Limits.
- **Fix: secondary contrasts S1–S3 used the wrong units.** They ran over every sampled unit, so 7 units were scored against contexts built for another subject. They now use their hypothesis's units; S2 moved from +6.7 to +8.1 pp. Primary results were unaffected. Regression test added; it fails on the old code.
- The listing share is described as exposure, not as a proven lever. C-SEO Bench (NeurIPS 2025) is cited next to the GEO result.
- `searchAskerWithSystem` also covers `claude-cli` / `codex-cli`.

## 0.4.0 — 2026-10-12
- **`diagnose`: why the app is missed and what to act on.** Every answer that misses the target is classified per engine:
  - **coverage**: no page the engine read lists the app (≥ 50% of its third-party pages checked; otherwise **coverage?**);
  - **selection**: a page lists it, and the engine picked others;
  - **ungrounded**: no search;
  - **unknown**: pages not checked. This is never guessed.

  `--fetch N` downloads the most-read pages (cached; Reddit is read through its feed and its rate-limit reset is respected) and records which configured apps each page names. The output has four tables:
  - *Get listed*: pages that name competitors but not you, with site-appropriate how-to;
  - *Fix presentation*;
  - *Working*: within-prompt lift ≥ 5 pp;
  - *Questions you lose*: prompt words with a lower rate, plus whether your listing says them, from `--store` or `--listing`.

  Your own site, store page and encyclopedia article are never ranked as levers, because engines read them after deciding. Writes `diagnosis.md` and `diagnosis.json`.
- **`diff`**: before/after Δ per app, paired by prompt, with a 95% bootstrap CI. Competitors are shown so that engine drift is visible.
- **`claude-search` keeps its sources.** It now uses `--output-format stream-json` and records the WebSearch queries and result URLs (`citations`, `searchQueries`). Before, `citations` was always empty for Claude. `codex-search` also records its search queries.
- MCP tools `diagnose_app_aeo_run` and `diff_app_aeo_runs`. The skill gains steps 5 (diagnose) and 6 (act, then prove it with `diff`).
- `lookup` returns `sellerUrl`; `diagnose` uses it to recognise an app's own site.
- **Fix: Codex isolation.** The `codex-cli` / `codex-search` child now gets an empty `HOME` as well as an isolated `CODEX_HOME`. Before, Codex read your skills catalog from `~/.agents/skills`, so your own skill names and descriptions were in context for every answer. Regression test added. Impact on the published studies: `bench/DEVIATIONS.md` D5.
- Comparison study results (`bench/compare/COMPARE.md`) and a README section.

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
