# app-aeo

**Does ChatGPT recommend your app?** `app-aeo` asks answer engines the questions your users ask — *"what's the best habit tracker for iPhone?"* — and measures how often they name **your app** (by name or store link), where it ranks, and which apps they recommend instead.

Web AEO/GEO tools track brands and websites. This one tracks **apps**: App Store ids, Play packages, store links in answers, and the generic-title trap ("Habit Tracker - HabitKit").

- **CLI + MCP server + Agent Skills**, zero dependencies, Node ≥ 20
- **No API key needed to start**: uses the `claude` and `codex` CLIs you're already logged into. Perplexity, OpenAI, Anthropic, Gemini and OpenRouter are supported with your own keys
- **Honest numbers**: every rate comes with n and a 95% Wilson interval. Failed calls are excluded, never counted as "not mentioned". Runs with fewer than 10 prompts are flagged
- **Resumable, budgeted runs**: `maxCalls` is a hard cap. A rate limit stops that engine immediately instead of returning empty answers
- **App Store listing lint**: character limits counted as users see them (Korean/Japanese/emoji safe), plus claim, emoji and keyword-waste checks

## Quick start

```sh
git clone <this repo> && cd app-aeo   # not on npm yet
```

```sh
# 1. Build a config from App Store ids (target first, then competitors)
node bin/app-aeo.mjs init habit.json --category "habit tracker" --app-id 963034692 --competitor-id 1111447047 --competitor-id 6443918070

# 2. See what would be asked
node bin/app-aeo.mjs check habit.json --dry-run

# 3. Run it (14 prompts × 2 engines = 28 calls)
node bin/app-aeo.mjs check habit.json

# 4. Later, same prompt set again → trend
node bin/app-aeo.mjs trend aeo-runs/streaks
```

Each run writes `aeo-runs/<app>/<timestamp>/`:

| File | Contents |
|---|---|
| `responses.jsonl` | Every answer verbatim, plus model, latency, citations and the extracted mentions. Append-only, so `--resume <dir>` re-asks only failed or missing jobs |
| `report.md` | The report: mention rate per engine, competitors, prompts that left the app out, unlisted apps recommended instead, caveats |
| `report.json` | Same data for scripts and dashboards |

Exit codes:

| Code | Meaning |
|---|---|
| `0` | Complete |
| `10` | Partial: a failed call, a halted engine, or a budget cut |
| `1` | Nothing answered |
| `2` | Bad input |

The last line is always `=== app-aeo: PASS n / FAIL m ===`.

## Engines

| Spec | Needs | Notes |
|---|---|---|
| `claude-cli[:model]` | `claude` CLI logged in | Tools off, your settings/CLAUDE.md not loaded |
| `codex-cli[:model]` | `codex` CLI logged in | Isolated `CODEX_HOME` so your AGENTS.md doesn't leak into answers |
| `perplexity:<model>` | `PERPLEXITY_API_KEY` | Citations are kept |
| `openai:<model>` | `OPENAI_API_KEY` | |
| `anthropic:<model>` | `ANTHROPIC_API_KEY` | |
| `gemini:<model>` | `GEMINI_API_KEY` | Grounding URLs kept when present |
| `openrouter:<model>` | `OPENROUTER_API_KEY` | Any OpenRouter model |

Answers from API models without web search reflect training data. Answers from search-backed engines reflect today's web. Measure both, and label which is which when you report.

## Config

```json
{
  "country": "us",
  "target": { "name": "Streaks", "aliases": [], "appStoreId": "963034692" },
  "competitors": [{ "name": "HabitKit", "aliases": ["Habit Tracker - HabitKit"], "appStoreId": "6443918070" }],
  "prompts": ["What is the best habit tracker app for iPhone?", "..."],
  "providers": ["claude-cli:sonnet", "codex-cli"],
  "repeats": 1,
  "maxCalls": 120
}
```

- **`name`** is the brand that must appear as a whole word. Put full store titles in `aliases`. `init` picks the brand for you: the title segment that isn't just category words.
- **`prompts`**: use 10 or more, in your users' language. `app-aeo prompts --category "가계부" --locale ko` gives a Korean starter set.
- **Mentions**: a mention is a whole-word name or alias match, or an App Store / Play link to the app. Position is the list item number when the answer is a list. Otherwise it is the order of first mention among known apps.

## MCP server

```json
{ "mcpServers": { "app-aeo": { "command": "node", "args": ["/path/to/app-aeo/mcp/server.mjs"] } } }
```

Tools:

| Tool | What it does |
|---|---|
| `run_app_aeo_check` | Run a measurement |
| `get_app_aeo_trend` | Show the trend across past runs |
| `lint_app_listing` | Lint App Store listing text |
| `lookup_app_store` | Look up apps by id |
| `search_app_store` | Search the App Store |
| `suggest_aeo_prompts` | Generate a starter prompt set |

## Agent Skills

- `skills/app-aeo/SKILL.md` runs the measurement workflow with guardrails: no invented shares, no comparing different prompt sets, and failures reported.
- `skills/aso-lint/SKILL.md` runs the listing check before submission.

## Listing lint

```sh
node bin/app-aeo.mjs lint listing.json --avoid "Competitor,Brand"
```

**Errors:**
- a field is over its limit: name 30, subtitle 30, promo 170, keywords 100, description 4000;
- the name or description is empty;
- the metadata contains another app's or company's name.

**Warnings:**
- a ranking or price claim (`#1`, `best`, `free`, `최고`, `1위`, `無料`, …);
- emoji or ALL-CAPS words in the name or subtitle;
- wasted keyword characters: a space after a comma, duplicates, or words already in the name or subtitle.

## What this is not

- **Not market share or traffic.** A mention rate is how often these engines named the app, for these prompts, on that day.
- **Not keyword search volume.** Apple publishes popularity only through Apple Ads, and Google Play has no public volume source. Tools that show volume for Play are estimating.
- **Not deterministic.** Answers change between runs. Use `repeats` ≥ 3 and the same prompt set before claiming an improvement.

## Development

```sh
node test/selftest.mjs   # no network, no LLM calls
```

MIT. `src/lint.mjs` adapts the listing-check method from [replica-skill](https://github.com/Jakeschincariol/replica-skill) (MIT).
