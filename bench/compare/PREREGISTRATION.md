# Comparison study — does app-aeo estimate "how often does this assistant name my app" better than asking the assistant directly?

**Status: PRE-REGISTERED.** This file is the pre-registration as committed and pushed together with `categories.json`, `expert-prompt.txt` (sha256 in §3.2), `analyze.mjs` and its self-test. That must happen before any held-out answer is collected. The GitHub push time is the third-party timestamp, as for the benchmark (§10).

## 1. Question and estimand
- **Question.** A developer wants to know how often an AI assistant names their app when people ask for apps in their category. Is app-aeo's estimate closer to the measured rate than:
  - (a) a best-effort engineered single prompt,
  - (b) a naive single prompt,
  - (c) checking five questions?
- **Estimand** θ_u for unit u = (category c, engine e, app a): the share of engine e's answers that **name** app a, averaged over the prompts of c's query population.
  - "Name" means the app-aeo extractor finds the brand or an alias. Any mention counts, positive or negative.
  - The **query population** is the category's Google-autocomplete pool as frozen in `categories.json` (`toolPrompts` ∪ `referencePrompts`). That is the population the tool samples by default.
  - Autocomplete includes a few off-topic queries. A word filter counted 0–6 of 200 per category, e.g. "best time tracking app" in period tracker. They are kept, because the tool would ask them too.
- **Not tested:**
  - whether any estimate matches the consumer ChatGPT or Gemini apps (the engines are `claude-search` and `codex-search`);
  - whether naming relates to installs;
  - whether the extractor's notion of "name" equals "recommend". The extractor's error is bounded separately (§6).

## 2. Materials (frozen in `categories.json`, produced by `select.mjs`)
### 2.1 Categories and prompts
- **Candidates** were written down before any measurement: sleep tracker, meal planner, password manager, period tracker, fasting, workout tracker, note taking, todo list.
  - The pilot (habit tracker) and the 4 benchmark categories are excluded; they are the development set (§3.2).
- **Eligibility:** ≥ 200 distinct autocomplete queries (`autocompletePrompts`, max 260), so the two halves never overlap.
  - Eligible: 7 categories. Password manager is out at 150.
  - All 7 are used. Power simulation (§5) showed 4 categories (8 clusters) gave power 0.38 at the smallest effect of interest.
- **Split:** each pool is shuffled with a fixed seed. 100 queries go to the tool (`toolPrompts`) and the next 100 to the reference (`referencePrompts`). Overlap is 0, verified.
- **Note on dependence.** The halves are complementary samples of one finite pool, so their means are slightly negatively correlated.
  - For a pool of N ≈ 250 this adds about +2σ²/(N−1) to T's expected squared error against R. That is comparable to T's own sampling variance.
  - So this design is **conservative against T**. It can hide an advantage of T; it cannot create one.
  - E and N do not sample answers, so the term does not apply to them.

### 2.2 Apps (5 per category, 35 units per engine)
- **Rule:** App Store search for the category term (US, 25 results), sorted by rating count. The first 5 that pass the criteria are taken. `searchSnapshot` stores all 25 results with their decision: included, excluded with reason, or not reached.
- **Criteria** (decided on app names only; no answers existed):
  - **C3:** the brand is a descriptive phrase for the category ("Notes", "Reminders", "Habit Tracker", "Intermittent Fasting Tracker").
  - **C4:** the brand, matched with the extractor's own rule, occurs in ≥ 1% of the 1,338 benchmark answers (other categories), i.e. it is an ordinary sentence word.
    - Excluded by C4: Structured 13.1%, Simple 7.9%, Zero 6.0%, Strong 5.6%.
    - Every included brand is below 1%: BetterSleep 0.52%, all others below 0.2%. "RISE" is entered as "Rise": the extractor matches an all-caps alias case-insensitively, which would count the verb "rise"; a Title-case brand matches only "Rise" or "RISE".
  - **C5:** fewer than 3 letters, or not matchable as a word ("Me+").
  - **C6:** the same company's brand is already in the category.
- **Brand** = the product name the developer uses. The App Store title is an alias.
- **History, disclosed:**
  1. An automatic brand rule was tried first. On names alone, it admitted ordinary words ("Habit", "My Cycle") and missed brands ("Otter Transcribe Voice"). It was replaced by the curation above.
  2. C4 replaced a judgment call with a measured rule.
- **Limit:** Apple's Notes and Reminders cannot be measured by name and are excluded.

## 3. Arms
| Arm | What it represents | Calls per (category, engine) | Estimate |
|---|---|---|---|
| **T** app-aeo | `check` on the 100 `toolPrompts`, 2 repeats (the default; repeats fixed at 2, §8) | 200 | mention rate over prompts |
| **E** engineered prompt | the frozen expert prompt (§3.2), one call | 3 calls; the 1st is primary (what a user sees), the mean of 3 is secondary | number per app ÷ 100 |
| **N** naive prompt | *"When people ask an AI assistant like you to recommend a {category} app, in what percentage of answers is each of these apps named? {apps}. Reply with JSON {app: percent}."* One call | 3; 1st primary | number per app ÷ 100 |
| **M5** five-question check | the 5 `m5Prompts` fixed in `categories.json`, repeat 1, taken from T's answers and coded by the extractor (not a human) | 0 extra | share of the 5 answers |
| **R** reference | `check` on the 100 `referencePrompts`, 1 repeat | 100 | mention rate over prompts, bootstrap SE |

### 3.1 Parity and settings (fixed; logged per call)
- **T and R** use the providers `claude-search` / `codex-search` exactly as in `src/providers.mjs` at the pre-registration commit.
- **E and N** use the same CLIs with web search enabled and a neutral system prompt:
  - `claude -p --output-format json` with the WebSearch tool allowed;
  - `codex exec --search`;
  - no consumer-role instruction, because this is an estimation task.
- **Logging:** each call records the model id the CLI reports, the latency and the raw text.
  - Claude reports its model id; in the development calls it was `claude-opus-4-6[1m]`.
  - Codex does not report one in its `--json` output (recorded as `null`). Both arms use the CLI's default model in the same isolated `CODEX_HOME`, so they match. The versions are pinned instead: `codex-cli 0.156.1` and Claude Code `2.1.296` at pre-registration. A version change during collection is listed as a deviation.
- **Input for E:** the category, the 5 apps, the estimand definition word for word (§1), and the 100 `toolPrompts` as a numbered list. Timeout 600 s.
- **Timing:** all arms for one category run within one 48-hour window; categories run one at a time.

### 3.2 Parsing and missing data for E and N
- The prompt asks for JSON `{"<app>": <percent 0–100>}`. The parser takes the last JSON object in the answer. Each of the 5 apps must have a number in [0, 100].
- Otherwise, up to 2 retries. Still failing → the arm's estimate for that cluster is **missing** (no imputation).
- **Primary analysis:** D_k uses the apps with an estimate.
- **Bounds:**
  - best case for the rival: impute R_u;
  - worst case: impute 0.5.
  - Both are reported.

### 3.3 How the engineered prompt is made (so E is a real best effort)
- **Author:** an independent agent (Codex, read-only), given this document and the development set, i.e. the 4 benchmark categories with their measured rates (`bench/results/*/extended`).
- **Why that target:** those rates are the estimand by definition (§1), so E is tuned to the same quantity it will be scored on.
- **Selection:**
  - up to 6 variants;
  - each is scored on the development set (4 categories × 2 engines × 1 call) by mean squared error;
  - the best one is frozen in `expert-prompt.txt`, and its sha256 is written here before any held-out call;
  - every variant's development score is published.
- **Result** (`dev/*.score.json`, raw answers in `dev/*.raw.jsonl`). RMSE over 24 (category, engine, app) units, none missing:

  | Variant | RMSE |
  |---|---|
  | 4 | **0.133** (selected) |
  | 2 | 0.143 |
  | 3 | 0.146 |
  | 6 | 0.146 |
  | 1 | 0.154 |
  | 5 | 0.164 |

  - The gaps between variants are near the noise of one call each. "Best" means best on this development set, as the rule says.
  - **Frozen:** `expert-prompt.txt` = variant 4, sha256 `cde545e4f8adb87ddf8679eafe93b15ac3dad32588b4967ccb0c001ff54f9369`.
  - A first scoring attempt stopped at the Claude session limit with no scores written. It was re-run with answer caching, and every variant was scored exactly once.
- **Separation:** held-out answers do not exist while the prompt is made, and no category is shared.

## 4. Outcome
- **Unit error:** e_u(X) = X_u − R_u.
- **Cluster** k = (category, engine): 14 clusters of 5 apps. Apps in a cluster share answers, so inference is at cluster level, with equal cluster weights.
- **Per-cluster contrast:** D_k(X) = mean over the cluster's apps of [e_u(X)² − e_u(T)²]. D_k > 0 means T was closer.
- **Effect size (one number, equal cluster weights):** Δ(X) = √(mean_k MSE_k(X)) − √(mean_k MSE_k(T)). The 95% CI is a bootstrap over clusters (B = 5000, seed 7).

## 5. Hypotheses and decision rules
Primary family (Holm, α = 0.05 one-sided):

| ID | Claim | Test | Supported if |
|---|---|---|---|
| **C1** | T is closer than E | exact one-sided **sign test** on the 14 D_k(E) (H0: median D_k ≤ 0; assumes only independent clusters) | Holm-adjusted p < 0.05 **and** Δ(E) ≥ 0.05 |
| **C2** | T is closer than N | same, with D_k(N) | same |
| **C3** | T is closer than M5 | same, with D_k(M5) | same |

- **Why a sign test.** A sign-flip permutation test needs D_k to be symmetric under H0. That is not justified for squared-error differences. The sign test needs only independence and a median null.
- **Power** (simulated, `power.mjs`; unit SDs T 0.045, R 0.055, from the benchmark):
  - 0.79 at Holm's strictest α when the rival's RMSE is ≈ 0.11, i.e. ≈ T + 0.06;
  - 0.26 when it is ≈ 0.08.
  - A rival only slightly worse than T will usually **not** be detected, and the report will say so.
- **Reverse tests.** The same tests are run with the sign flipped (rival closer than T) and reported. "T is worse" is claimed only if a reverse test is significant.
- **Pre-committed wording:**
  - supported → "closer to the measured rate than {rival}, by Δ (CI)";
  - not supported → "no evidence that app-aeo beats {rival}", and that sentence goes into the README.

**Descriptive (not hypotheses):**
- Calibration of T: the share of units with |T_u − R_u| ≤ 1.96·√(SE_T² + SE_R²), per cluster and overall, with a cluster-bootstrap CI. (For reference: with 35 independent units at true coverage 0.95, P(share < 0.85) = 0.34%. Units are not independent, so no rule is attached.)
- MAE per arm.
- Per-cluster Spearman of app order vs R.
- Ordering accuracy on app pairs whose R differs by ≥ 0.15.
- E and N as the mean of 3 calls, and their call-to-call spread.
- Everything split by engine.

## 6. Coding validity
- An LLM-judge audit (`audit`, judge `claude-cli`, 40 answers) runs on **both** R and T for each cluster. Per-app agreement is reported.
- Sensitivity analysis: the primary tests are repeated without units whose per-app agreement is below 0.90 in R or T.
- E and N are numeric and parsed deterministically; the parser has unit tests.

## 7. Data-quality rules
- Failed calls are resumed up to 3 times and are never counted as "not named".
- A cluster with fewer than 90 answered reference prompts, or fewer than 180 tool answers, is excluded from all tests and listed.
- If 3 or more clusters are excluded, the primary tests are reported as **underpowered** and not interpreted.
- Everything is committed: raw answers, parsed estimates, the frozen prompt and all variants, the analysis output.

## 8. Choices made for cost
- **T fixed at 2 repeats.** In the benchmark, R1 passed at 2 repeats in 7 of 8 extended cells.
- **R at 1 repeat over 100 prompts.** For the target, the yes/no answer flipped between repeats on 7–35% of prompts, so prompt-to-prompt variance dominates. R's noise lowers power but does not bias D_k: it adds Var(R) to every arm, apart from the conservative term in §2.1.
- **Claude budget:** 7 × (200 + 100 + 6) = 2,142 answers, plus up to 48 development calls and 7 × 80 audit answers.
  - In the benchmark the 5-hour session limit came after ~370 answers, with interactive use on the same account.
  - The runner resumes across limit windows. One category at a time keeps each within 48 hours.

## 9. Analysis code
- `bench/compare/analyze.mjs` implements §3.2 and §4–§7.
- Its self-test runs on synthetic data, before any held-out data exists:
  - a dataset where E is better than T must not support C1, and its reverse test must;
  - a dataset where T is better must support C1;
  - a dataset with a missing E cluster must be handled as in §3.2.

## 10. Related corrections to the benchmark (recorded here because the review that shaped this study found them)
- **Timestamp check.** The benchmark pre-registration commit `be22da8` is dated 2026-10-09T17:58:21Z. GitHub received the push at 17:58:23Z (repository events API). The first benchmark answer is from 17:59:09Z, so the pre-registration came first.
- **Not previously listed as a deviation:** the Korean cell had 43 prompts, not the 60 pre-registered. Added to `bench/DEVIATIONS.md` as D0.
- **Known bias in the gate's R1:** apps are selected (≥ 5 mentions) on the same data the split-half correlation is computed from, which can inflate R1. Recorded in `docs/METHODOLOGY.md` as an open issue. It does not affect this study, which does not use R1.
