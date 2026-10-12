# Does acting on `diagnose` change whether an engine names the app? — two pre-registered controlled tests (exploratory)

**Status: exploratory.** The pre-registered results stand as reported below. An adversarial review (2026-10-12) and our own re-measurement found that the setting differs from the live engine and that the one supported result is confounded. Read "Limits" before citing anything here. A confirmatory study that addresses these is in [`v2/`](v2/).

**Setting.**
- **Contexts**: up to 5 page excerpts per prompt (3000 characters each, starting 400 characters before the first app mention). The pages were chosen from the results of live `codex-search` answers (budgeting, meditation, language; 2026-10-09 runs) and fetched on 2026-10-12.
- **Engine**: `codex-cli` without web search, 3 answers per (prompt, condition), model not recorded.
- **Edits**: one per condition.
- **Pre-registration**: everything was pushed before collection:
  - main study: [PREREGISTRATION.md](PREREGISTRATION.md), commit `27f8bfc`;
  - follow-up: [PREREGISTRATION-DOSE.md](PREREGISTRATION-DOSE.md), commit `f7e3513`, written after the main results.

All 987 calls succeeded. 32 answers searched even though web search was off. As pre-registered, they were reported and not excluded.

## Results as pre-registered

| | Edit | Units | Sign test | p (Holm for H1–H3) | Mean Δ (95% CI) | Verdict |
|---|---|---:|---|---:|---|---|
| H1 | Add the app's line to **one** page that lists competitors, vs a placebo sentence in the same place | 33 | 5/6 | 0.22 | +7.1 pp (+0.0 … +15.2) | not supported |
| H2 | Move the sentence naming the app to the top of its page | 36 | 5/5 | 0.09 | +5.6 pp (+0.9 … +11.1) | not supported |
| H3 | Remove the page `diagnose` ranks higher by lift, vs the lower one | 36 | 7/13 | 0.50 | −3.7 pp (−18.5 … +10.2) | not supported |
| H4 | Add the line to **every** excerpt, vs placebo in the same places | 33 | 9/9 | 0.002 | **+19.2 pp (+8.1 … +31.3)** | **supported** |

Pre-registered wording:
- H1–H3: no evidence that the edit changes the rate in this setting.
- H4: "In this controlled setting, adding an app to every page the engine read raised the rate at which the engine named the app by +19.2 pp (95% CI +8.1 … +31.3)."
  - "Every page the engine read" means every excerpt in the context: at most 5 of the roughly 35 search results each live answer received.

"Not supported" is not evidence of no effect. H1 had 6 units that moved at all, so it could detect only very large effects.

## Dose (descriptive, same 33 units)

| Condition | Subject named |
|---|---:|
| Unedited | 3.0% |
| Placebo on one page | 4.0% |
| Listed on one of ~5 pages | 11.1% |
| Placebo on every page | 3.0% |
| Listed on every page | 22.2% |

The unedited 3.0% is one unit, "rocket money alternative", where the question names the app. In the other 32 units the subject was never named unedited (0 of 96 answers).

## Limits (found after the results; recomputed from `results*.jsonl`)

1. **Not the live engine's input.**
   - Raw `codex exec --json` events (3 prompts, 2026-10-12) show that live Codex runs one `search` action per answer and never `open_page`.
   - It receives about 35 results, each a title plus a snippet (median 145 characters).
   - The contexts here were 3000-character page excerpts. The test shows what the model does with such text, not what the live product does.
2. **H4 is concentrated in three apps.**

   | App | Units | Units that rose | Mean Δ |
   |---|---:|---:|---:|
   | Insight Timer | 5 | 4 | +60.0 pp |
   | Busuu | 9 | 3 | +22.2 pp |
   | Rocket Money | 12 | 2 | +11.1 pp |
   | Calm | 4 | 0 | 0 |
   | Babbel | 3 | 0 | 0 |

   - At the app level the sign test is 3/3 (p 0.125).
   - 21 of the 33 units named the subject in none of the five conditions.
3. **H4 does not isolate "being on many pages".**
   - The edit is the same sentence repeated in each excerpt.
   - On excerpts that named no other app, it went at the very start.
   - The placebo names no product.
   - So repetition, position and the presence of any product name are confounded with coverage.
4. **"Named" is not "recommended".**
   - In "best budgeting app south africa", Rocket Money was named as an app that may not support South African banks.
   - In "best meditation app garmin", the inserted line sat next to a store listing title, and the answers gave Insight Timer that listing's rating and download count.
5. **Eligibility.** A unit's subject was any app absent from all of its excerpts. Many did not fit the question, for example a US-only app for a non-US question, or a paid app for a "free" question.
6. **Recording.**
   - The model was not recorded: `model` is null in all rows.
   - The follow-up was collected in a later session than the main study.
7. **Analysis bug (fixed 2026-10-12).**
   - The secondary contrasts S1–S3 were computed over every sampled unit, so 7 H2/H3 units were scored against INSERT/PLACEBO contexts built for a different subject.
   - They now use their own units (H1 for S1/S2, H3 for S3).
   - S2 changes from +6.7 to +8.1 pp; see `RESULTS.md`.
   - Primary hypotheses were not affected.

## What this means for app-aeo's advice
- **Supported, narrowly:** when the same sentence naming an app is put into each text a model is given, without search, that model names the app more often. This held in 3 of 5 apps.
- **Not shown:**
  - that one listing changes the pick;
  - that position or the lift ranking matters;
  - that "coverage" rather than repetition is the cause;
  - that any of this transfers to live search answers, which see snippets;
  - any effect on installs.
- `diagnose` reports a **listing share**: the share of the results each answer received that name each app. It is a descriptive measure of exposure, not a proven lever.
- Related literature:
  - C-SEO Bench (Puerto et al., NeurIPS 2025 Datasets & Benchmarks, [arXiv 2506.11097](https://arxiv.org/abs/2506.11097)) found most document-rewriting methods "largely ineffective" and often harmful, while raising a document's rank in the context was "significantly more effective"; gains shrank as adopters increased.
  - Liu et al. ("Lost in the Middle", [TACL](https://arxiv.org/abs/2307.03172)) show that position in long contexts matters.
- The real-world chain needs a field experiment on an app you control. `diff` exists for that.

Files:

| File | Contents |
|---|---|
| `results.jsonl`, `results-dose.jsonl` | Every answer |
| `RESULTS.md`, `RESULTS-DOSE.md` | Generated tables |
| `conditions*.json` | Units, edits, sha256 of each context |

Contexts are third-party page excerpts and are not committed. Rebuild them with `build.mjs` / `dose-build.mjs` from a `diagnose --fetch` run; pages change over time.
