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
  - Codex runs with a throwaway `CODEX_HOME` that holds only `auth.json`. Claude runs with `--setting-sources ""` and no MCP.
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

## 7. Reproducibility
- Every answer is stored verbatim with model, latency, grounding evidence and citations (`responses.jsonl`, append-only).
- Re-running `gate` or `validate` re-extracts from the stored text, so extractor fixes apply retroactively and auditably.
- The benchmark protocol is pre-registered in `bench/PREREGISTRATION.md`. The commit time precedes the data.
