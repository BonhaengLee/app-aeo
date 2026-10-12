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

Full results: [`bench/compare/COMPARE.md`](bench/compare/COMPARE.md). Protocol, the frozen expert prompt and the analysis code were pushed before any held-out answer existed ([`bench/compare/PREREGISTRATION.md`](bench/compare/PREREGISTRATION.md)). GitHub's push timestamps for both studies were lost when the repository was re-created ([D6](bench/DEVIATIONS.md)); the commit order remains. Setup: 7 new categories × 2 engines × 5 apps. The reference rate comes from 100 autocomplete prompts that app-aeo never saw.

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

## Why you are missed, and what to do: `diagnose` → act → `diff`

A number alone does not say what to change. A search-grounded answer is built from the pages its searches returned, so every answer that misses your app has one of these causes:

| Cause | Meaning | What moves it |
|---|---|---|
| **coverage** | No search result the engine received names your app | Get onto the pages that rank for those questions |
| **coverage?** | (Runs before 0.4.1) none of the checked pages lists you, but fewer than half were checked | Likely coverage; not proven |
| **selection** | A result names you, and the engine picked others anyway | How those pages present you; the question words you lose |
| **ungrounded** | The engine answered from memory | Broad awareness only, slowly |
| **unknown** | (Runs before 0.4.1) pages not checked | Run with `--fetch` — never guessed |

```sh
app-aeo diagnose <run-dir> --store              # runs before 0.4.1: add --fetch 40 to check pages instead
# … change one thing, wait for re-indexing, re-run the same config …
app-aeo diff <run-before> <run-after>           # paired by prompt, 95% CI; did you move, or did the engine?
```

How it decides:
- **What the engine received.** Both engines answer from search *results*, not from opened pages. Measured on raw Codex events: one search per answer, about 35 results, each a title and a snippet (median 145 characters), and no page opened. From 0.4.1 every answer records that text (`seen`), so the cause is read directly from it. (Docs before 0.4.1 said Codex "opens pages"; that was wrong.)
- **Pages (runs before 0.4.1).** Half the `--fetch` budget goes to the most-read pages, which feed the action tables. The other half goes to the pages that cover the most still-unclassified misses: in the meditation benchmark this cut "unknown" from 53% to 12% at 40 pages. Each page is fetched once and cached in `<run>/pages/`. Reddit threads are read through their feed, about one a minute because of Reddit's rate limit. A page that cannot be fetched is "could not check", never "does not list you". PDFs are listed for a manual look.
- **Lift is within the same prompts.** A page's mention rate depends on which questions pull it in, so the tool compares answers that read the page with answers to the *same* prompt that did not.
- **Your own site and store page are never levers.** They mostly come up *after* the engine favoured the app, in a second search with its name for price or features. In the benchmark (`codex-search`, budgeting), Monarch Money was named in 75% of the 36 answers whose results included its own site and in 8% of the others. That gap is a consequence of the decision, not a cause.
- **Questions you lose.** These are prompt words that go with a lower rate for you ("offline", "uk", …). With `--store` or `--listing`, the tool also checks whether your listing says them.
- **Guardrails.** The "How" column stays inside each site's rules: pitch editors, disclose yourself on forums, and never edit Wikipedia about yourself. Paid or fake reviews get removed.

**Example.** The data is the benchmark's budgeting run (`codex-search`, 120 answers, collected 2026-10-09); the pages were fetched on 2026-10-12.
- Monarch Money was named in 28% of answers and YNAB in 60%.
- Of the 86 misses (`--fetch 15`):

  | Cause | Answers |
  |---|---:|
  | selection | 72 |
  | coverage? | 7 |
  | unknown | 7 |

  This run predates 0.4.1, so pages were fetched instead of reading the recorded results. "Selection" there means a fetched page names Monarch; whether its snippet did is not known. Each Codex answer had about 30 third-party results, so with a page budget coverage usually stays "coverage?". Runs from 0.4.1 decide this from the results themselves.
- Kiplinger's list (in the results of 101 answers) names Monarch, and answers that got it named Monarch 18 pp more often within the same prompts. That is an association, not a proven cause.
- TechRadar's "best budgeting software" (in the results of 81 answers) names YNAB and not Monarch. That is a **get-listed** candidate.

**Does acting on it work? Not shown yet.** Two pre-registered controlled tests are exploratory ([bench/causal/REPORT.md](bench/causal/REPORT.md)). Setup:
- The answer engine was `codex-cli` without web search.
- Each context was up to 5 page excerpts (3000 characters each) from the results of live `codex-search` answers: budgeting, meditation, language. Live answers see ~35 short snippets instead.
- One edit per condition; 3 answers each; 987 calls.

| Edit | Effect on "names the app" | Verdict |
|---|---|---|
| Add the app to **one** of ~5 read pages (vs placebo) | +7.1 pp (95% CI +0.0 … +15.2) | not supported |
| Move its sentence to the top of its page | +5.6 pp (+0.9 … +11.1), Holm p 0.09 | not supported |
| Remove the page `diagnose` ranks higher by lift | −3.7 pp (−18.5 … +10.2) | not supported |
| Repeat the app's sentence in **every** excerpt (vs placebo) | **+19.2 pp (+8.1 … +31.3)**, 9/9, p 0.002 | supported as pre-registered |

What this does and does not show:
- **What it shows.** Text put in front of a model can change what it names. That much is expected.
- **The supported effect is narrow.**
  - It came from 3 of 5 apps (app-level 3/3, p 0.125); 21 of 33 questions never moved.
  - It is confounded with repetition and position.
  - One answer gave the inserted app another listing's rating.
- **"Not supported" is not "no effect".** H1 had only 6 informative questions.
- **The wider literature is sobering.** C-SEO Bench ([NeurIPS 2025](https://arxiv.org/abs/2506.11097)) found most methods that rewrite a document to be picked "largely ineffective" and often harmful, while raising the document's rank in the results was "significantly more effective"; gains shrank as more competitors adopted them.
- **What `diagnose` reports instead.** The **listing share**: of the results engines received, how many name you versus each competitor (budgeting, from fetched pages: Monarch Money 55%, YNAB 81%). It is a measure of exposure, not a promise.
- **What is still open.**
  - A confirmatory study is in `bench/causal/v2/`.
  - Whether an edit reaches live answers is measured by `bench/canary/` and, for your app, by `diff`.

Why third-party pages: Chen et al. found AI search cites earned media far more than brand-owned pages ([arXiv 2509.08919](https://arxiv.org/abs/2509.08919)). Aggarwal et al. found that page edits such as adding statistics, quotations and citations can raise visibility in generative answers by up to 40% ([GEO, KDD 2024](https://arxiv.org/abs/2311.09735)); that is a maximum on their benchmark, and C-SEO Bench later found most such rewriting methods largely ineffective across domains. `diff` exists so that you measure the effect for your own app instead of assuming it.

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
| `diagnose <run> [--fetch N] [--store \| --listing f.json] [--engine SPEC]` | Why misses happen (coverage / selection / ungrounded / unknown) and which pages to act on; writes `diagnosis.md/json` |
| `diff <before> <after> [--engine SPEC]` | Before/after Δ per app, paired by prompt, 95% CI |
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
| `diagnose_app_aeo_run` | Causes of misses and pages to act on |
| `diff_app_aeo_runs` | Before/after comparison |
| `get_app_aeo_trend` | Mention-rate history |
| `lint_app_listing` | App Store listing check |
| `lookup_app_store` | Look up apps by id |
| `search_app_store` | Search the App Store |
| `suggest_aeo_prompts` | Starter prompt set |

## Skills

- `skills/app-aeo/SKILL.md` is the agent workflow: doctor → init (100 prompts) → `check --gate` → report the gate verdict first, and findings only from RELIABLE engines → `diagnose` → act → `diff`.
- `skills/aso-lint/SKILL.md` is the listing check.

## Development

```sh
node test/selftest.mjs   # 74 cases, no network
```

- Every fix from the live runs and from an independent Codex code review has a regression test.
- Each regression test was confirmed to fail on the pre-fix code.

MIT. `src/lint.mjs` adapts the listing-check method from [replica-skill](https://github.com/Jakeschincariol/replica-skill) (MIT).
