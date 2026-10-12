# Causal study v2 — pre-registration

**Question.** When an answer engine is given the search results a live engine actually received, does adding a sentence that names an app (or a brand) to some of those results make the engine *recommend* it more often?

Written before any v2 data was collected. The only model calls before this was pushed were the plumbing pilot (§12) and the probes in §1. The scripts in this directory are part of the registration; the analysis is `analyze.mjs` as committed here. Two adversarial reviews of the draft were made before freezing (§14).

## 1. Why v2: what v1 could not show

The v1 study ([`../REPORT.md`](../REPORT.md)) is exploratory. This study is designed against each of its limits:

| v1 limit | v2 design |
|---|---|
| Contexts were 3000-character page excerpts. Live Codex receives search results: a title and a snippet each, ~35 per answer (raw events, 3 prompts; median snippet 145 characters; no page opened). | Contexts are the exact result lists live answers received (§3) |
| H4's effect came from 3 of 5 apps; inference was over units | ≥ 15 apps planned; the estimand and the test are at the **app** level (§7) |
| One identical sentence, repeated; placed first on pages without other apps; placebo without a product name | A different sentence per result at seeded random positions; placebo = a real unrelated brand in the same template at the same slots; fictional-name controls at the same slots |
| "Named" counted caveats and a misattribution | Outcome = **recommended**, by a blind judge from another model family (§6) |
| Subjects often did not fit the question | A judge decides fitness before any edit exists (§4) |
| Search was not disabled (D7); model not recorded; conditions in different sessions | `web_search="disabled"`; model and reasoning effort pinned and recorded; all conditions interleaved in one seeded order |
| 3 categories, apps only; ~6 informative units for H1 | 10 app + 2 product categories; up to 400 units; simulated power in §9 |

## 2. Engines (all through `src/providers.mjs`, with an isolated HOME and CODEX_HOME)

| Role | Engine | Model | Search | Repeats |
|---|---|---|---|---|
| Corpus: what live search returns | `codex-search` | `gpt-5.6-terra`, reasoning effort `medium` | on | 1 |
| Fitness judge | `codex-cli` | same | **disabled** (`-c web_search="disabled"`) | 1 (≤ 3 attempts if unparseable) |
| **Primary answer engine** | `codex-cli` | same | **disabled** | 2 |
| Replication answer engine | `claude-cli` | `sonnet` (resolved name recorded) | no tools | 1 |
| **Primary outcome judge** | `claude-cli` | `sonnet` | none | 1 |
| Second outcome judge (sensitivity) | `codex-cli` | as above | disabled | 1 |

Every answer row records the reported model and the number of searches. Answers with searches > 0 are excluded and counted.

## 3. Materials (`prompts.mjs` → `categories.json`, committed with this file)

- **App categories (10).** The prompts are the real Google-autocomplete prompts already frozen by the earlier studies:
  - benchmark, 3 apps each: meditation, budgeting, language;
  - comparison study, 5 apps each: sleep-tracker, meal-planner, period-tracker, fasting, workout-tracker, note-taking, todo-list.
- **Product categories (2).** The prompts come from Google autocomplete, fetched once by `prompts.mjs` on 2026-10-12:
  - robot-vacuum: Roborock, Roomba, Ecovacs, Eufy, Dreame;
  - running-shoes: Hoka, Brooks, Asics, Saucony, New Balance.
- **Sampling.** 40 prompts per category, drawn by seeded shuffle (seed 20261012), for 480 prompts. The pilot's 2 prompts are excluded from the pool.
- **Corpus.** `corpus.mjs` → `corpus.jsonl`: each prompt is asked once to `codex-search`, and `seen` keeps every result it received (URL, title, snippet).
  - These lists are the contexts. They are committed (short search snippets).
  - Context files are rebuilt from them deterministically and not committed; `conditions.json` holds each context's sha256.

## 4. Units (`eligibility.mjs`, `build.mjs`, `lib.mjs: selectUnits`)

1. **Fitness.** For each prompt, a judge (`codex-cli`, no search) states for every app or brand of its category whether suggesting it would be a reasonable answer to that exact question, given country, platform, device, price, audience and purpose ("if unsure, true"). It sees no results and nothing of the study.
   - The estimand is therefore conditional on apps this model deems fitting. Whether injection makes unfit apps recommended is not studied.
2. A prompt qualifies if its list has ≥ 12 distinct results.
3. **Candidates.** Apps that:
   - the judge accepted;
   - the prompt does not name;
   - no received result names, in its title, snippet or **URL** (whole-word match with aliases, using the tool's extractor; plus the name or alias, letters and digits only, ≥ 4 characters, inside the URL).
4. **One subject per prompt.** The candidate with the fewest units so far, ties broken by a seeded hash. Prompts are visited in seeded order, up to 400 units. An app that appears in two categories (MyFitnessPal) is one cluster.

## 5. Conditions (`lib.mjs: conditionsOf`): 8 per unit

| Condition | Edit to the received result list |
|---|---|
| BASE | none |
| I1 / I3 / I10 | a sentence naming the subject is appended to the snippet of 1 / 3 / 10 results |
| P3 / P10 | the same results and templates, naming a **real unrelated brand** with its own kind (e.g. "Pyrex … glassware brand") |
| F3 / F10 | the same results and templates, naming a **fictional** product of the subject's kind |

How the edits are made:
- **Positions.** A seeded random permutation of the results; I1 ⊂ I3 ⊂ I10, and P and F use the same positions and template slots.
- **Templates.** 10 presence-only sentences: they say the product is an option of its kind ("Another {kind} option is {name}."). There is no claim of quality, popularity or who recommends it. Each edited result gets a different template.
  - The sentences are attached to real results, so they are attributed to sources that did not write them. This is inherent to the design.
- **Placebo brands.** Le Creuset, Staedtler, Weber, Pyrex, Crayola, Maglite, Zippo, Victorinox, Sharpie, Lodge.
- **Fictional names.** Quorvel, Zelvaro, Tavrisa, Novenly, Brindora, Calvexa, Quenlyx, Ostrava Labs, Pellucid, Venmira.
  - On 2026-10-12 none matched a word of an App Store app name (US search). Lumetta and Mirelle did, and were replaced.
- **Per-unit choice of placebo and fictional name.** The first name, in seeded order, that does not occur in the unedited context in any case or in a URL.
- **Context format.** Rendered with the tool's RAG format (`src/ground.mjs: ragPrompt`).
- **Manipulation checks (the build aborts on any failure).**
  - In I_k / P_k / F_k, the subject / placebo / fictional name occurs exactly k times, and 0 times in every other condition.
  - Where the subject must be absent, the extractor with aliases and the URL check also find nothing.
- **Job ids** include the subject and the context's sha256, so a rebuilt design never reuses old answers.

**Replication.** 100 units, seeded; conditions BASE, I3, P3, I10 and P10; each asked once to `claude-cli`.

**Ask order.** All (context, repeat) jobs of a study are asked in one seeded random order, with 3 workers. A rate limit is waited out (1, 5, then 15 minutes) before the run halts. A halted run resumes; the analysis uses one answer per (job, repeat), the last successful one, and refuses duplicates or rows from another design.

## 6. Outcome (`judge.mjs`)

- **Named.** The tool's extractor finds the subject (or the fictional name) in the answer.
- **Recommended (primary outcome).** The subject is named and the **claude** judge labels it `RECOMMENDED`. Labels:
  - `RECOMMENDED`: offered as an option the person could choose;
  - `MENTIONED`: named but not offered (unsuitable, unavailable, warned against, or only described);
  - `NOT_PRODUCT`: the word is not that product.
- **Sensitivity outcomes (§8).** Both judges RECOMMENDED; the codex judge alone.
- **Blinding.** The judges see only the question, the answer and the name. They do not see the condition, the context or the study.
  - A residual leak: an answer may quote the results ("the results also mention X"). The "only described → MENTIONED" rule then pushes edited-condition answers toward MENTIONED, which would *under*-estimate effects.
- **Missing data.**
  - A judgment that is missing (never attempted) makes the analysis refuse to run.
  - A judgment that failed after 3 attempts excludes that answer from that outcome. The count is reported, and above 2% of named answers it is a deviation.

## 7. Hypotheses and primary analysis (`analyze.mjs`)

- **H1** (light dose; k = 3 of the unit's n results, n reported): I3 − P3 > 0 on *recommended*, primary engine.
- **H2** (heavy dose, k = 10): I10 − P10 > 0, same.

**Estimand.** The **app-weighted** mean of Δ, where:
- each unit's Δ is rate(A) − rate(B) over its 2 repeats;
- each app's Δ is the mean of its units;
- the estimand is the mean over apps.

The test, the verdict and the CI all use this statistic. The unit-weighted mean and its app-cluster bootstrap CI are descriptive.

**Analysis.**
- **Test.** One-sided sign-flip over app means: exact for ≤ 24 non-zero apps, otherwise Monte Carlo (100,000 draws, seeded). Holm across H1 and H2, α = 0.05.
  - The null hypothesis is "no app's mean shifts". Rejecting it does not by itself bound the size of the average effect; the CI does.
- **CI.** 95% CI by inverting the sign-flip test: 20,000 fixed sign vectors, bisection.

**Verdicts.**
- **Supported**: Holm p < 0.05 **and** app-weighted Δ > 0.
- **Robust**: supported **and** every sensitivity estimate of that hypothesis (T1–T4, §8) is > 0.
- **Below planned size**: fewer than 15 apps contribute. The verdict is still computed.
- **α unreachable**: with ≤ 5 apps moving, an exact test cannot reach 0.025. The verdict is then "not supported (≤ 5 apps moved: α unreachable)". It is reported as uninformative, not as evidence of no effect.

**Wording, fixed now.**
- Supported: "In search-result contexts taken from live Codex answers, adding a presence-only sentence naming the app to [3 / 10] of the n results (vs the same sentence naming an unrelated brand) raised the rate at which `codex-cli` recommended it by Δ (app-weighted; 95% CI …), across N apps (U up / D down)." Add "robust" only if it is.
- Not supported: "No detectable effect at this sample size. This is not evidence of no effect." Then the CI.

## 8. Secondary and sensitivity analyses (two-sided, not corrected, labelled exploratory)

**Sensitivity**, per hypothesis (these decide "robust"):

| Label | Contrast |
|---|---|
| T1 | I_k − F_k (subject recommended); the fictional control shares the subject's kind and wording exactly |
| T2 | I_k − BASE |
| T3 | outcome = both judges RECOMMENDED |
| T4 | outcome = codex judge |

**Secondary:**

| Label | Contrast | Reading |
|---|---|---|
| S1 | I1 − BASE | one listing |
| S2 | P3 − BASE | placebo check |
| S3 | I10 − I3 | dose |
| S4 | gain of a real name minus gain of a fictional one at k = 3: (I3 − P3) on the subject − (F3 − P3) on the fictional name | Equivalence is tested by TOST with margin ±5 pp (90% CI inside ±5 pp). Only "equivalent" supports the reading "the engine takes up a listed name regardless of whether the product exists". A difference > 0 means a real product gains more. Neither reading is drawn from a non-significant difference. |
| S5 | H1 and H2 on *named* | |
| S6 | H1 and H2 with `claude-cli` as the answer engine (replication subset) | |
| S7 | H2 within app categories and within product categories | |
| S8 | H2 for units with result lists ≤ the median length vs > the median | dose as a share of the list |

Also reported:
- judge agreement: Cohen's κ for the 3 labels and for RECOMMENDED vs not;
- the counts of NOT_PRODUCT labels and of failed judgments;
- rates by condition;
- the min / median / max length of the result lists.

## 9. Power (`power.mjs`, simulated before any data; 400 units, 2 repeats, α = 0.025)

**Model.**
- 40% of apps never respond. In the others, a unit responds with probability π/0.6; a responding unit rises to q ~ U(1/3, 1).
- 15% of units already recommend the subject from prior knowledge, at a rate of U(0.3, 1) in both conditions.
- 3% are pushed down by 1/3.
- A judge counts a named answer as recommended with probability 0.8.
- The rate is otherwise 1%.

| Apps with units | π = 5% | 10% | 15% | 20% | 30% |
|---:|---:|---:|---:|---:|---:|
| 15 | 32% | 74% | 91% | 95% | 97% |
| 25 | 31% | 81% | 98% | 99% | 100% |
| 40 | 35% | 87% | 99% | 100% | 100% |
| 50 | 36% | 86% | 99% | 100% | 100% |

π = 10% is roughly v1's H1 point estimate. Effects near π = 5% are unlikely to be detected. The draft used 200 units × 3 repeats; the review's realism terms lowered its power at π = 10% to 62–68%, so the size was raised.

## 10. Order, stopping and deviations

**Order.** Commit and time-stamp this registration, then `corpus` → `eligibility` → `build` → `collect primary` → `collect replication` → `judge` (claude and codex, both studies) → `analyze`.

**No peeking.** No outcome table is computed before collection and judging are complete. `analyze.mjs --partial` is used only if the data cannot be completed by **2026-10-26** (for example, because of quota). It is then run once, and reported as a deviation.

Every departure from this document is recorded in `../../DEVIATIONS.md` with its reason.

## 11. What the result can and cannot say (fixed in advance)

**Can.** With the received result lists held fixed: whether a presence-only sentence naming a fitting app in k results changes how often this model recommends it. The comparison is with the same sentence naming an unrelated brand (primary), a fictional product (T1), or no edit (T2).

**Cannot:**
- whether real pages would carry such a sentence;
- whether the live product would retrieve and rank such a page, or show the sentence in its snippet;
- effects on unfit apps, on installs, or for other models.

The live-reflection link is measured separately (`../../canary/`).

**Wording rules:**
- A supported H2 with an unsupported H1 reads "a heavy dose works; a light dose was not shown", never "listings work".
- "Robust" is used only as defined in §7.
- Measurement limits:
  - Word-like brands (e.g. Rise, Calm, Brooks) are matched only when capitalised, as everywhere in the tool. A lower-case mention in an answer is not counted.
  - The inserted sentences are capitalised.

## 12. Pilot (disclosed, not part of the sample)

On 2026-10-12, before this registration and before the review changes, the whole pipeline was run once on 2 prompts that are excluded from the sample: "calm alternative words" and "best app for sleep tracking without a watch".
- **Output.** 1 unit (subject Rise): 21 primary answers, 5 replication answers and 6 judgments.
- **What it found.** A transient 429 at 3 workers, which led to the backoff in §5.
- **Design use.** None of the design changes in §14 used its outcomes.
- **Files.** Kept locally (`../v2pilot/`, not committed).

## 13. Timestamps

`MANIFEST.sha256` lists the sha256 of every registered file: this document, `categories.json`, every script here, and the `src/` modules they call. The manifest is time-stamped by RFC 3161 time-stamp authorities. The tokens and the command to verify them are in `timestamps/`. The git commit and its push are the second record.

## 14. Pre-data review (disclosed)

Two independent adversarial reviews (a methodologist and a code reviewer) read the draft and its code before any v2 data existed.

**Adopted:**
- the URL exclusion and the alias/URL manipulation check;
- refusing the analysis when the replication is missing;
- job ids bound to the subject and the context hash;
- de-duplicating answers;
- one app-weighted estimand for the test, the verdict and the CI (sign-flip inversion);
- S4 as a gain difference with a TOST margin;
- fictional controls at both doses (F10) with the sensitivity set T1–T4 and the "robust" rule;
- the α-unreachable rule;
- presence-only templates (the draft's sentences implied social proof);
- realism terms in the power model, and the larger sample;
- a claude primary judge (a different family from the engine), with the codex judge and the intersection as sensitivity;
- a rule for failed judgments;
- reporting result-list length (S8).

**Not adopted:** making F rather than P the primary control.
- **Why.** F adds a same-kind competitor, which can push the subject out (inflating I − F), while P keeps the list's composition. P stays primary; F is in T1, and "robust" requires both.
