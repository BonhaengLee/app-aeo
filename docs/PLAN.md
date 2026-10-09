# app-aeo v0.2 plan — free, agent-first, validated

⚠️ BLOCKER: none. Live tests of free-tier HTTP keys (groq/cerebras/mistral/gemini/openrouter/tavily) need keys we do not have. These paths are unit-tested with mocks and labelled "not live-tested" until a key run passes.

## Constraints (from the user, 2026-10-10)
- **Cost:** $0. No paid API.
- **Usage:** users run it through an AI agent (Claude Code / Codex). The skill is the main interface, and the CLI is the harness.
- **Quality:** the numbers must be reliable and meaningful. "Meaningful" is decided by the `validate` gate, not by assumption.

## Research summary (sources in README)
| Path | Free | Web-grounded | Verdict |
|---|---|---|---|
| `claude -p --tools WebSearch` (host agent) | ✅ inside the user's plan | ✅ webSearchRequests>0 measured | **Primary engine** |
| `codex --search exec` (host agent) | ✅ inside the user's plan | ✅ `web_search` events measured | **Primary engine** |
| Official free tiers (Groq, Cerebras, Mistral, Gemini 3.x via OpenAI-compat, OpenRouter `:free`, NVIDIA NIM) | ✅ quota-limited | ❌ memory | Panel members. Grounded via Tavily free search → `rag` mode |
| Tavily search API | ✅ 1,000 credits/month | — | Grounding source for the free panel (1 credit per prompt per run, cached) |
| Groq compound | — | — | Shut down 2026-09-21 (official) |
| Gemini 2.5 Flash grounding | ✅ 500/day | ✅ | Only for projects that already used 2.5 (official). Optional |
| gpt4free (★66.8k, GPL-3.0) | ✅ | some | **Excluded**: unofficial web endpoints, ToS violations, breaks often. Cannot ship in a public tool |

## Batches
1. ⬜ **Engines.**
   - `claude-search` and `codex-search` (search mode), with grounding detected from usage/events.
   - Free-tier presets: `groq`, `cerebras`, `mistral`, `gemini-openai`, `openrouter`, `nvidia`.
2. ⬜ **Free router.** A provider spec `a|b|c` is a fallback chain. A halting error (429/quota/auth) moves the run to the next link for good. The report records which link answered.
3. ⬜ **RAG grounding.** `"ground": "tavily"` searches once per prompt (cached in the run dir) and gives the snippets to memory-mode engines → mode `rag`.
4. ⬜ **Concurrency per engine** (`concurrency`, default 2) so search-mode CLIs finish in minutes.
5. ⬜ **`doctor`.** Lists usable engines (CLI installed and logged in, keys present) and prints a ready config.
6. ⬜ **Skill rewritten for agent use.** Flow: doctor → init (autocomplete prompts) → check ×2 → validate → report only what passed.
7. ⬜ **Review.**
   - Selftests, including differential checks.
   - Live A/B runs with claude-search + codex-search.
   - `validate` (retest + popularity).
   - Codex read-only code review, with findings fixed.

## Acceptance (what "done" means)
- Selftest all pass.
- Live: two runs complete with 0 failed calls, or failures reported as such.
- Validate: printed for each search engine. The verdict is written down as it came out, pass **or fail**.
- Codex review: every finding either fixed or answered with a reason.
