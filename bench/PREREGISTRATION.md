# Benchmark pre-registration — committed before any benchmark answer was collected

Date: 2026-10-10 (KST). Repository commit = the timestamp of this file.

The habit-tracker runs from 2026-10-09/10 were a **pilot**, used to calibrate the method. They are excluded from these results.

## Design
- **Categories** (`bench/categories.json`): meditation (US), budgeting (US), language learning (US), 가계부 (KR, Korean).
  - Each has a target app and two competitors, chosen by their App Store ids.
- **Prompts:** 60 per category, from Google autocomplete via `autocompletePrompts`, generated once and frozen into `bench/results/<id>/config.json`.
  - Korean autocomplete is sparse, so the set is topped up with the Korean templates; the run reports how many came from each source.
- **Engines:** `claude-search`, `codex-search`. Both are free inside the user's existing plans and use live web search.
- **Procedure:** `runAdaptive`, starting at 2 repeats with `maxRepeats` = 4, then a coding audit of 40 answers per engine with the judge `claude-cli`.

## Analysis rules (frozen; `src/reliability.mjs` GATE)
| Check | Rule |
|---|---|
| **R1** rate reliability | Split-half (odd vs even repeats) Pearson correlation of per-app mention rates over apps with ≥ 5 mentions (at least 4 such apps), Spearman–Brown corrected. Pass if ≥ 0.80 |
| **R2** precision | 95% percentile bootstrap over prompts (B = 2000, seed 7) of the target's rate. Pass if half-width ≤ 0.10 |
| **R3** coding agreement | Cohen's κ between the regex extractor and the LLM judge on (answer, app) pairs. Pass if ≥ 0.80 |
| Verdict | RELIABLE only if R1–R3 all pass. INDETERMINATE is not a pass |
| Convergent validity (reported, not gated) | Spearman of mention rate vs log App Store rating count over apps with ≥ 5% share. Pass if ρ ≥ 0.5 and p < 0.05 (permutation, 5000) |

## Hypotheses
- **H1.** At least 6 of 8 (category × engine) cells reach RELIABLE within 4 repeats.
- **H2.** Every cell has κ ≥ 0.80. A cell below that means the extractor is not trustworthy there, and that is reported.
- **H3.** At least half of the cells pass convergent validity.

## Reporting
- All 8 cells are reported, whatever the outcome.
- Raw answers (`responses.jsonl`), audits and gates are committed.
- Any deviation from this document is listed under "Deviations" in `bench/BENCHMARK.md`, with the reason.
