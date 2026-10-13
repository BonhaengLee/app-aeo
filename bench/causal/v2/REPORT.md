# Does being listed in the search results an engine receives make it recommend the app? — causal study v2 (confirmatory)

**Status: confirmatory.**
- Pre-registered before any data: [PREREGISTRATION.md](PREREGISTRATION.md), commit `8ba506c`, with RFC 3161 time stamps from FreeTSA and DigiCert at 2026-10-12 08:37 UTC ([timestamps/](timestamps/)).
- Collected and analysed on 2026-10-12; the data were committed before interpretation (`1b1b7cc`).
- Deviations D8 (a parser for the fitness judge) and D9 (number of workers) are in [`../../DEVIATIONS.md`](../../DEVIATIONS.md). Both happened before any answer to an edited context existed, or cannot affect answers.
- An independent audit recomputed every headline number from the raw files without the project's code. Its result was "CONSISTENT" (§4).

## 1. Setting
- **Contexts.** The exact search results that live `codex-search` (`gpt-5.6-terra`) received for 480 real autocomplete queries in 12 categories: 10 app categories and 2 product categories (robot vacuums, running shoes). Each result is a title, a URL and a snippet; the median list has 39 results (12–75).
- **Units.** 310 (query, subject) pairs. Each subject is an app or brand that fits the query by a pre-data judge and that no received result names. There are 52 subjects.
- **Edits.** A presence-only sentence ("Another {kind} option is {name}.") is appended to 1, 3 or 10 results at seeded random positions. Controls use the same sentence at the same positions with:
  - a real unrelated brand (placebo, P);
  - a fictional product of the subject's kind (F);
  - or no edit (BASE).
- **Answers.** `codex-cli` with web search disabled, model and reasoning effort pinned, 2 answers per context: 4,960 answers. Replication with `claude-cli` (`claude-sonnet-5-5`) on 100 units: 500 answers. No answer searched.
- **Outcome.** The subject is *recommended*: named, and labelled RECOMMENDED by a blind judge (`claude-cli`; it sees only the question, the answer and the name). A second judge (`codex-cli`) agrees with κ = 0.965.
- **Inference.** The estimand is the app-weighted mean Δ. The test is a one-sided sign-flip over app means, with a 95% CI from inverting it, and Holm correction over H1 and H2.

## 2. Pre-registered results

| | Contrast | App-weighted Δ (95% CI) | Apps up / down (of 52) | Holm p | Verdict |
|---|---|---|---|---:|---|
| H1 | listed in 3 results vs placebo in the same 3 | **+13.9 pp** (+6.3 … +21.5) | 26 / 2 | 0.0001 | **supported, robust** |
| H2 | listed in 10 results vs placebo | **+23.2 pp** (+16.5 … +29.8) | 40 / 0 | < 0.0001 | **supported, robust** |

"Robust" is the pre-registered rule: every sensitivity estimate is > 0. The sensitivity estimates were:

| Sensitivity | H1 | H2 |
|---|---|---|
| T1: vs a fictional product in the same slots | +11.9 pp (+6.2 … +17.6) | +21.5 pp (+15.0 … +28.1) |
| T2: vs no edit | +14.6 pp (+9.1 … +20.2) | +23.4 pp (+16.8 … +30.0) |
| T3: both judges | +13.7 pp | +23.2 pp |
| T4: codex judge | +13.7 pp | +23.2 pp |

T3 equals T4 because, in the primary study, every answer the codex judge called RECOMMENDED the claude judge did too (533 agreed RECOMMENDED, 28 agreed MENTIONED, 1 claude-only RECOMMENDED).

Pre-registered wording:
> In search-result contexts taken from live Codex answers, adding a presence-only sentence naming the app to 3 of the n results (vs the same sentence naming an unrelated brand) raised the rate at which `codex-cli` recommended it by +13.9 pp (app-weighted; 95% CI +6.3 … +21.5), across 52 apps (26 up / 2 down). Robust. For 10 results: +23.2 pp (95% CI +16.5 … +29.8), 40 up / 0 down. Robust.

## 3. Secondary (exploratory, not corrected)

| | Contrast | Δ (95% CI) | Reading |
|---|---|---|---|
| S1 | listed in **1** result vs no edit | +9.2 pp (+4.9 … +13.6), 19 up / 0 down | Even one listing moved it |
| S2 | placebo vs no edit | +0.7 pp (−3.2 … +4.9) | The edit itself does nothing |
| S3 | 10 vs 3 results | +8.8 pp (+3.3 … +14.3) | Dose-response |
| S4 | gain of the real app − gain of a fictional one, at 3 | +13.5 pp (+6.0 … +21.0); TOST not equivalent | A fictional product listed the same way was recommended in 0.6% of answers. The engine does not echo any listed name; it lifts real products it can place. |
| S5 | H1 / H2 on "named" | +15.0 / +22.7 pp | Same as "recommended" |
| S6 | replication, `claude-cli` | H1 +35.5 pp (23 / 0), H2 +22.3 pp (19 / 1) | Holds in a second model family |
| S7 | H2 in app vs product categories | +21.5 pp (43 apps) vs +31.2 pp (9 brands, CI +8.3 … +56.2) | Not specific to apps |
| S8 | H2 for lists ≤ 39 vs > 39 results | +24.4 vs +24.4 pp | Not diluted by longer lists in this range |

Rates by condition (subject recommended):

| BASE | I1 | I3 | I10 | P3 | P10 | F3 | F10 |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 5.0% | 11.9% | 18.9% | 26.8% | 5.0% | 5.2% | 6.1% | 6.0% |

## 4. Independent audit (2026-10-13, own code, raw files)
- **Integrity.**
  - All 2,480 contexts match their sha256.
  - Every job has exactly its 2 primary answers (and 1 replication answer where applicable), with 0 duplicates and 0 searched answers.
  - One model per engine.
- **Manipulation.** In 400 sampled contexts, 0 violations. A case-insensitive scan of all 310 unedited contexts found the subject in lower or odd case in 3 units ("FitBod", "#roomba", "notability"); the other 4 hits were "eating window", not the app "Window". The pre-registered check is case-sensitive, so this is not a breach. The effect on the result is negligible.
- **Recomputation.** H1, H2, T1–T4, S2–S6 match to 0.1 pp, including with an independent case-insensitive detector.
- **Labels.** 36 judged answers were read.
  - All 6 MENTIONED labels were right.
  - 29 of 30 RECOMMENDED labels were right. The wrong one named Notion only as an export target.
  - No answer named the subject by quoting the results ("the results also mention …"). Subjects were offered as options in their own right.
- **Concentration.**
  - H1: 24 of 52 apps did not move, and the top 10 apps carry 74% of the total. Without the top 3 apps: +10.1 pp, 23 / 2, p 0.0009. Category means are positive except robot-vacuum, which is one unit (Roborock) at −100.
  - H2: every category is positive (+12.9 … +34.3 pp). Without the top 3 apps: +19.0 pp, 37 / 0.

## 5. What this does and does not show

**Shown.** Hold fixed the search results a live engine received. Then a short sentence naming a real, fitting app in a few of those results makes the model recommend it more often:
- 1 result: about +9 pp;
- 3 results: about +14 pp;
- 10 results: about +23 pp.

This held:
- against a placebo and against a fictional product;
- with a second model family;
- for apps and for physical-product brands.

**Limits:**
- **How it is recommended.** At I10 the subject is still absent from about 73% of answers. When it is present, it is usually a later "also consider" item: it was the first bullet in 5% of I-condition answers, against 8% in controls, at a mean relative rank of 0.57 against 0.47. "Recommended" does not mean "top pick".
- **Which apps.** The subjects are known products (named in 5% of unedited answers). A fictional product gained almost nothing (0.6%). So this shows that listings move known products. It does not show that they create awareness for unknown ones.
- **What was edited.** The sentences were attached to real results and attributed to sources that did not write them. They were often grammatically spliced into the snippet; all conditions share the same splices.
- **The chain to real users.** Not shown:
  - that a real page would carry such a sentence;
  - that the live engine would retrieve that page and show the sentence in its snippet (the canary in `../../canary/` measures this separately);
  - any effect on installs;
  - other engines, or other times.
- **Scope.** One primary model (`gpt-5.6-terra`), one replication model, English US-style queries, 52 subjects, 2026-10-12.

**Relation to v1 and the literature.**
- **v1 ([../REPORT.md](../REPORT.md), exploratory).** It used 3000-character page excerpts and could not detect a one-page effect. Measured in the format live engines actually receive (short snippets), one listing does move recommendations.
- **C-SEO Bench** (Puerto et al., NeurIPS 2025). It found most document-*rewriting* methods ineffective, while raising a document's rank in the context was effective. This study tests a different lever: whether the product is *present* in the retrieved results at all. Its result is consistent with presence and retrieval, not wording, being what matters.

## 6. Files

| File | Contents |
|---|---|
| `corpus.jsonl` | Live `codex-search` answers and the results each received |
| `eligibility.jsonl` | Fitness judgments |
| `conditions.json` | Units, edits, sha256 of every context |
| `results-primary.jsonl`, `results-replication.jsonl` | Every answer |
| `judgments-*.jsonl` | Every label |
| `results.json`, `RESULTS.md` | Pre-registered analysis output |

To rebuild the contexts, run `node build.mjs`; it is deterministic from `corpus.jsonl` and `eligibility.jsonl` and is checked against the sha256 values.
