# app-aeo

**Do AI assistants recommend your app?** `app-aeo` asks the questions your users actually search for, such as *"habit tracker app without subscription"*. It asks AI engines that search the web, and measures how often they name **your app**, where it ranks, and which apps they recommend instead. It then **checks whether that measurement is trustworthy** before you act on it.

It is built for an AI agent to drive. Install the skill, ask "does AI recommend my app?", and the agent runs the CLI.

- **$0 to run.** The main engines are your own **Claude Code** and **Codex** with live web search, inside the plan you already have. Optional free-tier keys add more engines; Tavily's free search can ground them.
- **Real questions.** Prompts come from Google autocomplete for your category.
- **Self-validating.** Every result can be checked two ways: the same config is re-run (test–retest), and mention rates are compared with real App Store usage (convergent validity). Verdicts are printed as they come out.
- **Honest numbers.**
  - Intervals are bootstrapped over prompts, so repeats don't fake precision.
  - Failed calls never count as "not mentioned".
  - Answers that didn't actually search are flagged.
- CLI + MCP server + Agent Skills, zero dependencies, Node ≥ 20. MIT.

## Quick start (agent or terminal)

```sh
node bin/app-aeo.mjs doctor                 # which free engines work on this machine
node bin/app-aeo.mjs init cfg.json --category "habit tracker" --app-id 963034692 --competitor-id 1111447047 --competitor-id 6443918070
node bin/app-aeo.mjs check cfg.json --out runsA &
node bin/app-aeo.mjs check cfg.json --out runsB &
wait
node bin/app-aeo.mjs validate runsA/<run> runsB/<run> --popularity --engine claude-search
```

`init` fills in the prompts (Google autocomplete), the engines (from `doctor`) and `repeats: 2`. Check that `target.name` is the brand ("HabitKit", not "Habit Tracker - HabitKit").

## Engines

| Spec | Mode | Cost | Notes |
|---|---|---|---|
| `claude-search[:model]` | search | Free inside your Claude Code plan | Web search enabled. The system prompt is replaced with a consumer-assistant role (not a coding agent). Grounding is detected from `webSearchRequests` |
| `codex-search[:model]` | search | Free inside your Codex plan | `codex --search`, isolated `CODEX_HOME`, consumer-role `developer_instructions`. Grounding is detected from `web_search` events |
| `groq:` `cerebras:` `nvidia:` `openrouter:…:free` `gemini-openai:` `mistral:` | memory, or **rag** with `"ground": "tavily"` | Free tiers (keys) | Chain them with `a\|b\|c`: when one link hits 429 or quota, the rest of the run uses the next link |
| `perplexity:` `openai:` `anthropic:` `gemini:` `gemini-search:` | search or memory | Paid or limited | Supported if you have keys |

Tool choices:
- **Not included: gpt4free-style gateways.** They drive consumer web apps through unofficial endpoints. That violates the services' terms and breaks often.
- **Groq compound is gone.** Its built-in search was shut down on 2026-09-21.
- **Gemini 3.x free tier** has no search grounding.

## Measured on 2026-10-10, not assumed

Setup: habit-tracker category, target Streaks, 20 Google-autocomplete prompts × 2 repeats, two independent runs per engine, 160 answers, **0 failed calls, every answer search-grounded**.

| | claude-search | codex-search |
|---|---|---|
| Target mention rate, run A → B (95% CI over prompts) | 88% (75–98) → 90% (78–100) | 45% (25–65) → 40% (23–60) |
| Same yes/no on repeat | 85% / 90% of prompts | 90% / 70% of prompts |
| **Test–retest** (rank of apps named in ≥5% of answers) | ❌ ρ = 0.40, p = 0.23 (11 apps) | ✅ ρ = 1.00, p = 0.015 (5 apps) |
| **Convergent validity** (mention rate vs App Store rating count) | ✅ ρ = 0.91, p = 0.010 (7 apps) | ❌ ρ = 0.70, p = 0.23 (5 apps, too few to decide) |

What this shows:
- **The target's own rate is stable run to run** for both engines: 88→90% and 45→40%, inside each other's intervals.
- **Engines disagree a lot with each other** (88% vs ~43%). "What AI recommends" depends on the assistant, so report per engine and never pooled.
- Claude's picks **track real usage** (✅), but the long tail of rarely named apps reshuffles between runs (❌).
- Codex's picks are **reproducible** (✅), but it names too few apps for the usage check to reach significance.
- Criteria were fixed before the runs (5% floor, ρ ≥ 0.5, p < 0.05) and were not tuned afterwards. More prompts or repeats raise the power.

History:
- **Earlier failure:** a run without web search (Claude, memory only) was reproducible but did **not** track usage (ρ = −0.20). That is why search mode is the default.
- **Three harness defects** surfaced in live runs and were fixed, each with a regression test:
  - Codex answered *"I can help you build an iPhone habit tracker"*. A consumer-role instruction fixed it.
  - Codex searched in only 34/80 answers. A search instruction fixed it; all answers are now grounded.
  - Section labels ("Android user?", "Kotlin + Jetpack Compose") were counted as apps.

**Not shown by anyone, including this tool:**
- that editing a listing or page raises the mention rate;
- that a higher mention rate raises installs;
- that these engines match what the ChatGPT or Gemini consumer apps show.

Treat improvements as hypotheses. Re-run the **same** config and compare with `trend`.

## Commands

| Command | What it does |
|---|---|
| `doctor [--live]` | Free engines available here; `--live` asks each one a tiny question |
| `init <cfg> --category … --app-id … [--competitor-id …] [--locale ko] [--no-autocomplete]` | Builds a config |
| `check <cfg> [--out DIR] [--resume RUN] [--max-calls N] [--dry-run]` | Runs it. Resume refuses a changed config; one writer per run directory |
| `validate <runA> [<runB>] [--popularity] [--engine SPEC]` | Test–retest and/or usage check. Refuses to compare runs of different configs |
| `trend <runs-dir>` | Mention-rate history; flags changed prompt sets |
| `prompts --category … [--autocomplete]` · `search <term>` · `lookup <id…>` | Helpers |
| `lint <listing.json>` | App Store listing check (limits by user-perceived characters, claims, keyword waste) |

Exit codes:

| Code | Meaning |
|---|---|
| `0` | Complete |
| `10` | Partial |
| `1` | Nothing answered |
| `2` | Bad input |

The last line of `check` is `=== app-aeo: PASS n / FAIL m ===`.

## MCP server

```json
{ "mcpServers": { "app-aeo": { "command": "node", "args": ["/path/to/app-aeo/mcp/server.mjs"] } } }
```

Tools:

| Tool | What it does |
|---|---|
| `app_aeo_doctor` | Free engines available here |
| `run_app_aeo_check` | Run a measurement |
| `validate_app_aeo_runs` | Test–retest and usage check |
| `get_app_aeo_trend` | Mention-rate history |
| `lint_app_listing` | App Store listing check |
| `lookup_app_store` | Look up apps by id |
| `search_app_store` | Search the App Store |
| `suggest_aeo_prompts` | Starter prompt set |

## Skills

- `skills/app-aeo/SKILL.md` is the agent workflow: doctor → init → measure twice → validate → report only what passed.
- `skills/aso-lint/SKILL.md` is the listing check.

## Development

```sh
node test/selftest.mjs   # 52 cases, no network
```

- Every fix from the live runs and from an independent Codex code review has a regression test.
- Each regression test was confirmed to fail on the pre-fix code.

MIT. `src/lint.mjs` adapts the listing-check method from [replica-skill](https://github.com/Jakeschincariol/replica-skill) (MIT).
