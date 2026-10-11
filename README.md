# app-aeo

**Do AI assistants recommend your app?** `app-aeo` asks the questions your users actually search for, such as *"habit tracker app without subscription"*. It asks AI engines that search the web, and measures how often they name **your app**, where it ranks, and which apps they recommend instead. It then **checks whether that measurement is trustworthy** before you act on it.

It is built for an AI agent to drive. Install the skill, ask "does AI recommend my app?", and the agent runs the CLI.

- **$0 to run.** The main engines are your own **Claude Code** and **Codex** with live web search, inside the plan you already have. Optional free-tier keys add more engines; Tavily's free search can ground them.
- **Real questions.** Prompts come from Google autocomplete for your category.
- **A reliability gate, not just a number.** `check --gate` labels each engine's result RELIABLE only if three checks pass: R1 split-half reliability ≥ 0.80, R2 interval ±10 pp or tighter, R3 agreement with an independent LLM judge κ ≥ 0.80. If one fails it says NOT RELIABLE and how much more data would fix it. In a [pre-registered benchmark](bench/BENCHMARK.md) that prescription held in 3 of 4 categories (details below).
- **Honest numbers.**
  - Intervals are bootstrapped over prompts, so repeats don't fake precision.
  - Failed calls never count as "not mentioned".
  - Answers that didn't actually search are flagged.
- CLI + MCP server + Agent Skills, zero dependencies, Node ≥ 20. MIT.

## Quick start (agent or terminal)

```sh
node bin/app-aeo.mjs doctor                 # which free engines work on this machine
node bin/app-aeo.mjs init cfg.json --category "habit tracker" --app-id 963034692 --competitor-id 1111447047 --competitor-id 6443918070
node bin/app-aeo.mjs check cfg.json --dry-run   # how many calls it will make
node bin/app-aeo.mjs check cfg.json --gate      # measure, add repeats until reliable, audit, print the gate
```

`init` fills in the prompts (Google autocomplete, **100 by default**), the engines (from `doctor`) and `repeats: 2`. Check that `target.name` is the brand ("HabitKit", not "Habit Tracker - HabitKit"). If autocomplete returns fewer than 100 queries, `init` warns you; add your users' real questions.

**Cost in quota.** "$0" means no extra charges. It still uses your Claude Code and Codex plan limits. 100 prompts × 2 engines × 2 repeats is 400 answers, plus judge calls for the audit. In the benchmark, `claude-search` hit the Claude 5-hour session limit after 372 answers (46 minutes), and later the weekly limit. The same account was also used interactively, so treat that as an observation, not a limit you can plan to.

## Engines

| Spec | Mode | Cost | Notes |
|---|---|---|---|
| `claude-search[:model]` | search | Free inside your Claude Code plan | Web search enabled. The system prompt is replaced with a consumer-assistant role (not a coding agent). Grounding is detected from `webSearchRequests` |
| `codex-search[:model]` | search | Free inside your Codex plan | `codex --search`, isolated `CODEX_HOME` and `HOME` (so your AGENTS.md and `~/.agents` skills stay out), consumer-role `developer_instructions`. Grounding is detected from `web_search` events |
| `groq:` `cerebras:` `nvidia:` `openrouter:…:free` `gemini-openai:` `mistral:` | memory, or **rag** with `"ground": "tavily"` | Free tiers (keys) | Chain them with `a\|b\|c`: when one link hits 429 or quota, the rest of the run uses the next link |
| `perplexity:` `openai:` `anthropic:` `gemini:` `gemini-search:` | search or memory | Paid or limited | Supported if you have keys |

Tool choices:
- **Not included: gpt4free-style gateways.** They drive consumer web apps through unofficial endpoints. That violates the services' terms and breaks often.
- **Groq compound is gone.** Its built-in search was shut down on 2026-09-21.
- **Gemini 3.x free tier** has no search grounding.

## Benchmark — pre-registered, every cell published

Full report: [`bench/BENCHMARK.md`](bench/BENCHMARK.md). Protocol and hypotheses were committed before any answer was collected ([`bench/PREREGISTRATION.md`](bench/PREREGISTRATION.md)). Deviations are logged in [`bench/DEVIATIONS.md`](bench/DEVIATIONS.md). Setup: 4 categories (meditation, budgeting and language learning in the US, 가계부 in Korea) × 2 engines (`claude-search`, `codex-search`), real Google-autocomplete prompts, all answers search-grounded.

| Hypothesis (pre-registered) | Criterion | Result |
|---|---|---|
| H1 the gate can reach RELIABLE | ≥ 6 of 8 cells within 4 repeats | ❌ **2 / 8** |
| H2 the extractor codes mentions correctly | every cell κ ≥ 0.80 | ✅ **8 / 8** (κ 0.95–1.00) |
| H3 picks track real App Store usage | ≥ half of cells ρ ≥ 0.5, p < 0.05 | ❌ **1 / 8** |

What failed, and why:
- **H1 failed on precision only.** R1 (reliability) and R3 (coding) passed in all 8 cells. R2 failed in 6: at 60 prompts the interval was ±0.10–0.13. More repeats cannot fix this; only more prompts can.
- **Follow-up (not pre-registered, rule fixed in advance as D2).** Each category was extended to the number of prompts the gate itself prescribed. **7 of 8 cells became RELIABLE.** The exception is Korean 가계부: autocomplete ran out at 43 queries (gate asked for 55), and codex-search stayed NOT RELIABLE at ±0.113. That is why `init` now defaults to 100 prompts and warns when it finds fewer.
- **H3 was mostly too small to decide.** Only apps named in ≥ 5% of answers are compared, which left 3–6 apps in 7 of 8 cells. With so few points the test has almost no power, so the 1/8 does not show that AI picks ignore real usage. It does not show the opposite either. The one cell with enough apps (language, claude-search, 12 apps) passed: ρ = 0.75, p = 0.008.
- **Engines disagree with each other.** Target mention rates, claude-search vs codex-search: meditation 70% vs 43%, budgeting 63% vs 28%, language 54% vs 48%. Always report per engine; never pool them. (The codex-search answers were collected with the author's skills catalog in context, since fixed: [D5](bench/DEVIATIONS.md).)

Earlier pilot (habit tracker, 20 prompts, before the benchmark): claude-search mention rate vs App Store rating count gave ρ = 0.91, p = 0.010 over 7 apps. The benchmark did not reproduce that as a general result (H3 above), so it is a single observation, not a property of the tool.

Harness defects found in live runs, each fixed with a regression test:
- Codex answered *"I can help you build an iPhone habit tracker"*. A consumer-role instruction fixed it.
- Codex searched in only 34/80 answers. A search instruction fixed it.
- Section labels ("Android user?", "Kotlin + Jetpack Compose") were counted as apps.
- The word "calm" was counted as the app *Calm*. The LLM-judge audit found it (D1).

**Not shown by anyone, including this tool:**
- that the engines measured here match what the consumer ChatGPT or Gemini apps show;
- that editing a listing or page raises the mention rate;
- that a higher mention rate raises installs.

Treat improvements as hypotheses. Re-run the **same** config and compare with `trend`.

## Comparison — is this better than just asking the assistant?

Full results: [`bench/compare/COMPARE.md`](bench/compare/COMPARE.md). Protocol, the frozen expert prompt and the analysis code were pushed before any held-out answer existed ([`bench/compare/PREREGISTRATION.md`](bench/compare/PREREGISTRATION.md)). Setup: 7 new categories × 2 engines × 5 apps. The reference rate comes from 100 autocomplete prompts that app-aeo never saw.

| Claim (pre-registered) | Sign test | Holm p | Δ RMSE (95% CI) | Result |
|---|---|---|---|---|
| C1 app-aeo is closer than a best-effort engineered prompt | 14 / 14 clusters | 0.0002 | 0.107 (0.081 – 0.136) | ✅ |
| C2 app-aeo is closer than a naive prompt | 10 / 10 clusters | 0.0010 | 0.130 (0.086 – 0.177) | ✅ |
| C3 app-aeo is closer than checking five questions | 14 / 14 clusters | 0.0002 | 0.093 (0.067 – 0.118) | ✅ |

In the pre-committed wording: app-aeo was **closer to the measured rate than the engineered prompt, by 0.107 (0.081 – 0.136)**; **than the naive prompt, by 0.130 (0.086 – 0.177)**; **than a five-question check, by 0.093 (0.067 – 0.118)**. Mean absolute error: app-aeo 0.032 · engineered 0.130 · naive 0.127 · five questions 0.097. No reverse test (rival closer) came near significance.

Read with these limits:
- **C2 rests on 10 of 14 clusters.** In 4 clusters (fasting on both engines, note taking and todo list on codex-search) the naive prompt's primary call gave no usable number after 2 retries: the assistant replied `null` per app or declined to estimate. By the rule these are missing, not imputed. If they are filled with the reference value itself (the rival's best case), C2 is **not** supported. In the worst case it still is. C1 and C3 hold under both bounds.
- **Codex ran with the author's skills catalog in context** (found after collection, fixed since: [D5](bench/DEVIATIONS.md)). All arms of a cluster share that context, so the comparison is not biased by it, and dropping the one exposed unit (Notion, codex) leaves every result as above. The absolute `codex-search` rates are for that setup, not a clean Codex.
- **"Closer" means closer to the same engine's own answers.** The study does not show that any estimate matches the consumer ChatGPT or Gemini apps, or that naming relates to installs.
- Calibration (descriptive): 66 of 70 app-aeo estimates fell inside their combined 95% interval. The result is unchanged when apps with LLM-judge agreement below 0.90 are dropped.
- The cost difference is real: app-aeo made 200 calls per category and engine; the prompts made 1.

## Alternatives

- **AppTweak AI Visibility** ([product page](https://www.apptweak.com/en/ai-search-visibility-tool-for-mobile-apps)): a commercial, app-specific tracker for ChatGPT and Gemini. No public price; access is through a demo. Use it if you need the consumer ChatGPT/Gemini surfaces, which this tool does not measure.
- **Open-source brand/website trackers** (see the [ai-visibility topic](https://github.com/topics/ai-visibility)): track brands and domains across engines with your own API keys. They are not built around App Store ids.
- **Use app-aeo** if you want a free run inside a Claude Code or Codex plan you already have, App Store id matching, raw answers you can re-check, and a gate that says when the number is not yet trustworthy.

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

- `skills/app-aeo/SKILL.md` is the agent workflow: doctor → init (100 prompts) → `check --gate` → report the gate verdict first, and findings only from RELIABLE engines.
- `skills/aso-lint/SKILL.md` is the listing check.

## Development

```sh
node test/selftest.mjs   # 62 cases, no network
```

- Every fix from the live runs and from an independent Codex code review has a regression test.
- Each regression test was confirmed to fail on the pre-fix code.

MIT. `src/lint.mjs` adapts the listing-check method from [replica-skill](https://github.com/Jakeschincariol/replica-skill) (MIT).
