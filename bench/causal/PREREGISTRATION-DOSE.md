# Follow-up — positive control: does adding an app to *every* page the engine read change whether it is named?

**Status: PRE-REGISTERED.** This file, `dose-build.mjs`, `conditions-dose.json` and the changes to `collect.mjs` and `analyze.mjs` are committed and pushed before any answer of this follow-up is collected. They were written **after** the main study's results ([RESULTS.md](RESULTS.md)) were known. This is a new study prompted by that result, not a re-analysis of it.

## Why
- **The main study.** H1, a one-line insert on one of five pages, was not supported. In 27 of 33 units the subject was named in none of 3 answers, with or without the insert.
- **Two readings.** That leaves two explanations open:
  - (a) the dose was too small;
  - (b) for picks, this engine largely ignores what the retrieved pages say and answers from its own knowledge.
- **What each reading predicts.**
  - If (b) holds, `diagnose`'s page-level advice cannot move this engine at all.
  - If (a) holds, the advice works only at a larger scale: being on most of the pages engines read, not one.
- **The test.** A positive control with the largest edit of the same kind separates the two.

## Design
- **Units.** The same 33 H1 units: (category, prompt, subject) from `conditions.json` `picks.H1`, with the same contexts, subjects and blurbs.
- **Conditions.**
  - `INSERT_ALL`: the subject's line is inserted into **every** page of the context. On a page that names another configured app, it goes after the sentence of the first such mention (the same rule as `INSERT`). On a page that names none, it goes at the start.
  - `PLACEBO_ALL`: the placebo sentence goes in the same places.
- **Engine, repeats, outcome and extractor:** as in the main study (codex-cli, no web search, 3 repeats, `named`).

## Hypothesis and analysis
- **H4:** rate(INSERT_ALL) − rate(PLACEBO_ALL) > 0 for the subject. The test is an exact one-sided sign test over units (ties dropped), α = 0.05, single test.
- **Effect:** the mean d with a unit-bootstrap 95% CI (B = 10,000, seed 13). Fewer than 10 units with both conditions is "not testable".
- **Wording, fixed in advance.**
  - Supported: "In this controlled setting, adding an app to every page the engine read raised the rate at which it was named by Δ (95% CI …)."
  - Otherwise: "No evidence that adding an app to every page the engine read changes the rate in this setting."
- **How it will be read, also fixed now.**
  - If H4 is supported while H1 was not, the mechanism exists but a single listing is too small a dose.
  - If H4 is not supported, this engine's picks did not respond to page content in this setting, and `diagnose`'s page advice has no demonstrated effect on it.
- **Descriptive only:** the one-page `INSERT` rate (main study) next to `INSERT_ALL`.

## Limitations
- The same as the main study.
- In addition, inserting the same line into five pages is not something a real web would show. It is a dose ceiling, not a recommendation.
