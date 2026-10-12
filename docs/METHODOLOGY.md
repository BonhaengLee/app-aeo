# Methodology

`app-aeo` estimates **how often an AI assistant names a given app** when people ask it recommendation questions. The method borrows from survey and measurement research: define the construct, sample the item population, measure repeatedly, and test reliability and validity before trusting a number. This page states every choice and why it was made.

## 1. Construct

**Mention rate** of app *A* for engine *E* over prompt set *Q*: the share of *E*'s answers to *Q* that name *A*.

"Name" means one of two things:
- a whole-word match of the app's brand or an alias. Unicode-aware boundaries are used, so Korean, Japanese and Latin scripts all work;
- a store link to it (`apps.apple.com/…/id<id>`, `play.google.com/…?id=<pkg>`).

It is **not** a recommendation score, market share, traffic, or install estimate.

## 2. Sampling the questions
- Prompts come from **Google autocomplete** for category seeds, such as "best X app", "X app for", "X app without", and "<competitor> alternative".
  - When more than 20 are needed, seeds are expanded with letter suffixes. The results are real queries people type, not phrasings we invented.
- Developer-intent and off-platform queries are filtered out ("reddit", "github", "template", "kotlin", …).
- The set is **frozen** in the run's `config.json`.
  - Results are only comparable within one prompt set; a fingerprint over target, competitors, prompts, grounding and country enforces this.
  - `--resume` and `validate` refuse to mix different fingerprints.
- **How many.** `init` asks for 100 prompts by default. In the benchmark, R2 (±10 pp) failed in 6 of 8 cells at 60 prompts. The gate prescribed 68–93 for the US categories, and every US cell passed at 70–100.
- **Limitation:** autocomplete reflects search behaviour, which is not the same as chat behaviour. Korean autocomplete is sparse, so Korean sets are topped up with templates, and the run records how many prompts came from each source. In the benchmark the Korean pool ran out at 43 (29 autocomplete + 14 templates) against a prescription of 55. `init` warns when it finds fewer prompts than requested.

## 3. Engines and harness
- **Search mode** (primary).
  - `claude-search` is `claude -p` with only the WebSearch tool. `codex-search` is `codex --search exec`.
  - The coding-agent persona is replaced by a consumer-assistant role, with an instruction to search before answering. Without it, Codex answered "habit tracker app for iphone" with an offer to *build* one (pilot, 2/80 answers), and searched in only 34/80.
  - **Grounding is verified per answer:** Claude via `webSearchRequests`, Codex via `web_search` events. Ungrounded answers are counted and flagged.
- **Isolation.**
  - Codex runs with a throwaway `CODEX_HOME` that holds only `auth.json` and an empty `HOME` (Codex reads the user skills catalog `~/.agents/skills` via `HOME`; before 2026-10-12 that catalog leaked into answers, see `bench/DEVIATIONS.md` D5). Claude runs with `--setting-sources ""` and no MCP.
  - The user's own instructions never reach the engine; this is verified in the pilot.
- **RAG mode** (free-tier API models): one Tavily search per prompt, cached and shared by repeats. The snippets go in front of the question.
  - This mirrors retrieve-then-answer assistants, but it is **not** the retrieval ChatGPT or Gemini use.
- **Failures** are never treated as "not mentioned".
  - A failure is any of: timeout, rate limit, auth error, quota exhausted, or empty answer.
  - Rate-limit, auth and quota failures halt that engine for the rest of the run, and no new calls start.
  - Fallback chains (`a|b|c`) skip an exhausted link for the rest of the run.

## 4. Estimation
- **Sampling unit = prompt.** Repeats of one prompt are correlated, so they are averaged within the prompt first.
  - Rate = mean over prompts of the per-prompt mention share.
  - The 95% interval is a percentile bootstrap over prompts (B = 2000, fixed seed).
  - No pooled "overall" figure is shown: it would mix engines, and an answer-level interval would treat repeats as independent.
- **Stability** = share of prompts whose repeats all agree (all mention, or none do).
- **Position** = number of the list item that contains the first mention.
  - An item ends at the next item, or at a blank line followed by non-list text. A closing remark like "Streaks is my pick" after the list therefore gets no position.

## 5. Reliability gate (all three must pass; thresholds fixed in code before the benchmark)

| | What | Statistic | Pass |
|---|---|---|---|
| R1 | Do repeated measurements give the same picture? | Split-half reliability: odd vs even repeats. Pearson correlation of per-app mention rates over apps with ≥ 5 mentions (at least 4 such apps), Spearman–Brown corrected, ρ_full = 2r / (1 + r) | ≥ 0.80 |
| R2 | Is the target's rate precise? | Half-width of the bootstrap interval over prompts | ≤ 0.10 |
| R3 | Is "mentioned" coded correctly? | Cohen's κ between the regex extractor and an independent LLM judge, on 40 sampled answers × all listed apps. The judge never sees the extractor output | ≥ 0.80 |

Outcomes:
- **INDETERMINATE** (e.g. too few frequently named apps, or the audit was not run) is never a pass.
- On **FAIL** the gate reports how much more data would fix it:
  - for R1, Spearman–Brown gives the length factor `k = ρ*(1−ρ) / (ρ(1−ρ*))`;
  - for R2, the prompts needed are `(1.96·sd_prompt / 0.10)²`.

**Open issue — R1 selection bias.** R1 keeps apps with ≥ 5 mentions in the same data it then splits. Apps that happened to be mentioned in both halves are more likely to clear the floor, which can push the split-half correlation up. A fix is to choose the app set from an independent sample, or from the config's app list. Until then, read R1 as an upper bound. (Found in an independent review on 2026-10-10.)

**Adaptive design.** `check --gate` starts at 2 repeats. An engine whose R1 fails, or is indeterminate for lack of apps, gets more repeats: the Spearman–Brown multiplier, capped at ×4, rounded to an even count, up to `maxRepeats`. When the gate stops, the audit runs, and the report opens with the gate.

**Why Pearson on rates for R1.** This was decided on pilot data, before the pre-registered benchmark. Spearman on ranks weighs a 0.03↔0.05 swap among rarely named apps the same as a 0.9↔0.05 swap. The pilot showed tail-rank noise dominating ρ, while the head of the distribution was stable.

## 6. Validity (reported, not gated)
- **Convergent:** Spearman of mention rate vs log₁₀(1 + App Store rating count), over apps named in ≥ 5% of answers.
  - Apps listed in the config are looked up by id. Other names are matched to the store by exact brand, picking the most-rated app with that brand.
  - A prefix match once paired "Save" with "Save My Doggy". Unmatched names are listed, not guessed.
  - p-value from 5000 permutations.
- **Known limits:**
  - Rating counts are US/KR App Store only. Android-only apps have no comparable count.
  - With 5–7 matched apps the test has little power. In the benchmark, 7 of 8 cells had only 3–6 apps above the 5% floor, so H3 (≥ half of cells ρ ≥ 0.5, p < 0.05) came out 1/8. That result says the test was underpowered. It is not evidence for or against validity.
- **Not established by anyone yet:**
  - that the engines measured here match what the consumer ChatGPT or Gemini apps show;
  - that listing changes move the mention rate;
  - that mention rate moves installs.

## 7. Diagnosis (`diagnose`, `diff`) — what it can and cannot claim
- **Sources.**
  - **What the engines receive is search results, not pages.** Measured 2026-10-12 from raw `codex exec --json` events (3 prompts): every web_search action was `search` (no `open_page`), each answer got about 35 results, and each result is a title and a snippet (median 145 characters, max 194). `claude-search` receives its WebSearch tool results (links and a search-side summary).
  - **Correction (0.4.1).** Earlier docs said Codex "opens pages" and "reads ~30 third-party pages per answer". Both were wrong: those were search results. Codex `citations` before 0.4.1 also included links the model wrote in its own answer (decided after choosing); `diagnose` now drops them for old runs.
  - From 0.4.1, rows record `seen`: the text each engine received from its searches. With `seen`, causes are exact: the app is in that text (*selection*) or it is not (*coverage*). Older runs fall back to fetching pages, which only approximates what the engine saw.
  - Own pages: an app's own site appears among results mostly when the engine searched the app's name, i.e. after it was already a candidate.
- **Page check.**
  - A page "lists" an app when the app's name or alias matches as a whole word in its visible text (scripts and styles removed), using the same extractor as the answers.
  - Presence is not prominence. A page that mentions you once at the bottom counts as listing you, and that shows up as *selection*.
  - Pages are fetched when you run `diagnose`, not when the engine read them. For an old run, a page may have changed since.
- **Causes.**
  - *Selection*: a checked page of that answer lists the target. One page is proof.
  - *Coverage*: no checked page lists the target **and** at least 50% of the answer's third-party pages were checked.
  - *Coverage?*: no checked page lists the target, but fewer were checked. Unchecked pages (403, PDF, rate-limited, over budget) may list you.
  - *Unknown*: none of its pages could be checked.
  - (Old runs only.) In the meditation benchmark, Codex answers received about 30 third-party results each, and 40 fetched pages covered about 5% of them per answer. Expect "coverage?" rather than "coverage" unless the fetch budget is large. Note that a fetched page body is not what the engine saw; its snippet was.
  - Page choice: half the budget goes to the most-read pages, half greedily to the pages that cover the most unclassified misses (53% → 12% unknown at 40 pages, same data).
- **Lift is observational.**
  - Comparing answers to the same prompt removes the largest confound: which questions pull a page in.
  - It does not make the page a cause. A result may appear *because* the engine already favoured the app (e.g. a second search with its name), as with owned pages, which is why owned pages are excluded.
  - Treat "Working" and the lift column as hypotheses.
- **Causal claims need an intervention.** Change one thing, re-run the same config, and use `diff`:
  - It pairs prompts and bootstraps a 95% CI over prompts.
  - Competitors in the same table act as a drift control. If everyone moved, the engine changed.
  - **Controlled evidence, exploratory** ([bench/causal/REPORT.md](../bench/causal/REPORT.md), pre-registered). Contexts were ≤ 5 page excerpts (3000 characters each) from results of live Codex answers — longer than the snippets the live engine receives — answered by `codex-cli` without search:
    - repeating one sentence naming the app in each of those excerpts raised its naming rate by 19 pp (95% CI 8–31), but the effect came from 3 of the apps (app-level sign test 3/3, p 0.125) and is confounded with repetition and position;
    - adding it to one excerpt, promoting its sentence, and removing the top-lift page showed no detectable effect at this sample size (H1 had about 6 informative units, so this is not evidence of no effect);
    - a confirmatory study is in `bench/causal/v2/`.
  - No field result yet shows that real page changes, once indexed, move these rates for an app. `diff` on your own app is how you find out.

## 8. Reproducibility
- Every answer is stored verbatim with model, latency, grounding evidence and citations (`responses.jsonl`, append-only).
- Re-running `gate` or `validate` re-extracts from the stored text, so extractor fixes apply retroactively and auditably.
- The benchmark protocol is pre-registered in `bench/PREREGISTRATION.md`. The commit time precedes the data.
