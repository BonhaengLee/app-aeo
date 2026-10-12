# Causal study — do the edits `diagnose` prescribes change whether an answer engine names the app?

**Status: PRE-REGISTERED.** This file, `build.mjs`, `collect.mjs`, `analyze.mjs` and `analyze-selftest.mjs`, and `conditions.json` (the frozen conditions with a sha256 for every context) are committed and pushed before any answer of the study is collected. The GitHub push time is the timestamp.

## 1. Question
`diagnose` (app-aeo 0.4.0) says why an answer misses an app, and which edits to make. The causes are:
- *coverage*: the app is not on the pages the engine read;
- *selection*: it is on them, but presented weakly;
- the "working" pages are the ones with high same-prompt lift.

Those are observational claims. This study asks whether making those edits **causes** a change in the answer, holding everything else fixed.

**What this tests:** given the pages a live engine actually read for a real question, does editing those pages the way `diagnose` prescribes change whether a model names the app?

**What this does not test:**
- whether editors would make the edit;
- whether search engines would re-index or re-rank the page;
- whether the live product (Codex with web search, ChatGPT) would retrieve the edited page;
- installs.

The real-world chain needs a field experiment on an app the experimenter controls, which is a separate study. This is the same kind of controlled test as GEO (Aggarwal et al., KDD 2024): it isolates the answer step.

## 2. Materials (frozen in `conditions.json`, produced by `build.mjs`)
- **Runs.** The `codex-search` runs of the pre-registered benchmark (2026-10-09/10) for budgeting, meditation and language (US). Target and competitors are those of each run's config.
  - Korean (ko-gagyebu) is not used: its pages were not checked.
- **Pages.** Fetched on 2026-10-12 by `app-aeo diagnose --fetch 40` (meditation, budgeting, language), cached as text. Only checked third-party pages (earned, community, reference) are used; own sites and store pages are not.
- **Context per prompt.**
  - The ≤ 5 checked pages that most of that prompt's live answers read (ties broken by page key).
  - A prompt needs ≥ 3 such pages.
  - Each page enters as a 3,000-character excerpt that starts 400 characters before its first mention of a configured app (or at the page start if it names none).
  - The context is presented with `ragPrompt` (the tool's rag format), title = host.
- **Conditions** (one edit each, all others identical):
  - `BASE`: unedited.
  - `INSERT`: needs a **subject app**: a configured app (target or competitor) that no page in the context names, while some page names another configured app.
    - The subject is the target if it qualifies; otherwise one qualifying competitor, picked by a hash of (category, prompt).
    - Why any app: the target is on nearly every context (a pre-collection count gave 5 eligible prompts in meditation and 0 in budgeting). The mechanism under test, "absent from the pages → added to one", is the same for any app.
    - The edit: in the most-read page that names another configured app, one line is inserted right after the sentence holding that page's first such mention: `<Subject>: <first declarative sentence (not a question, ≥ 30 chars) of the subject's App Store description, ≤ 200 chars>`. Page text has no line breaks, so a "sentence" reaches at most 200 characters each way from the name; in menus and lists without sentence marks it is the name itself. This is what "get listed" means.
  - `PLACEBO`: the same eligibility and the same position, with a sentence that names no app: *"Many apps on this list offer a free trial, so compare the plans before you subscribe."*
  - `PROMOTE`: for prompts where ≥ 1 page names the target. In the most-read page that names it, the sentence holding its first mention is moved to the start of the excerpt. The same 200-character rule applies. Not eligible if it is already first. This is what "fix presentation" means.
  - `ABLATE_HI` / `ABLATE_LO`: for prompts where ≥ 2 pages name the target and those pages have different `diagnose` same-prompt lift values. The page with the highest lift (HI) or the lowest lift (LO) is removed.
- **Sample.** Per hypothesis and category, at most 12 eligible prompts, taken in a seeded shuffle (seed 13 + hypothesis number). `BASE` is collected for every sampled prompt.

## 3. Engine
- `codex-cli`, which is `codex exec` **without** web search, so the model sees only the given context and its own knowledge.
- Isolated `CODEX_HOME` and empty `HOME` (the D5 fix).
- System instructions: the consumer-assistant role (`CONSUMER_ROLE`).
- codex-cli version as installed (0.156.1); the model is recorded per answer.
- Claude is not used: the experimenter's Claude quota is shared with interactive work.
- Repeats: 3 per (prompt, condition). Concurrency 3. Failed calls are retried by re-running `collect.mjs`, which only asks missing pairs.
- **Pilot.** Before collection, at most 3 calls may be made on contexts of prompts that are **not** sampled. They check that the engine answers and does not search. Pilot answers are not analysed.
  - Done on 2026-10-12, 2 calls (budgeting "best budgeting app", language "best language learning app"; both unsampled). Both answered, both with 0 searches, and the extractor found configured apps. codex-cli did not report the model name (`model: null`).

## 4. Outcome
For each answer: the configured apps the app-aeo extractor finds in it, by name or alias (`named`). Per (prompt, condition, subject): the share of ok answers that name the subject. The subject is the target for H2 and H3, and the H1 subject for H1.

## 5. Hypotheses (one-sided, direction fixed)
| | Contrast, per prompt d = | Prediction |
|---|---|---|
| **H1** (coverage lever) | rate(INSERT) − rate(PLACEBO), for the H1 subject | d > 0 |
| **H2** (selection lever) | rate(PROMOTE) − rate(BASE) | d > 0 |
| **H3** (lift ranking) | rate(ABLATE_LO) − rate(ABLATE_HI) | d > 0: removing the page `diagnose` ranks as more helpful hurts more |

## 6. Analysis (`analyze.mjs`, frozen)
- **Test.** For each hypothesis, an exact one-sided sign test over prompts, with ties (d = 0) dropped.
- **Correction.** Holm across H1–H3, α = 0.05.
- **Effect.** The mean d, with a prompt-bootstrap 95% CI (B = 10,000, seed 13), plus a by-category table.
- **Supported** if the hypothesis has ≥ 10 prompts with both conditions, Holm p < 0.05, and mean d > 0.
  - Under 10 prompts it is reported as *not testable*.
  - A prompt is dropped from a contrast if either condition has no ok answer. The number dropped is reported.
- **Wording, fixed in advance.**
  - Supported: "In this controlled setting, {lever} raised the rate at which the engine named the app by Δ (95% CI …)."
  - Otherwise: "No evidence that {lever} changes the rate in this setting."
- **Secondary checks** (two-sided, uncorrected, not used to claim support):
  - S1 PLACEBO − BASE, expected ≈ 0;
  - S2 INSERT − BASE;
  - S3 ABLATE_HI − BASE.
- **Reported, not analysed differently:** answers in which the engine searched despite no `--search`, and failed calls.

## 7. Known limitations (stated before data)
- Excerpts, not whole pages. The live engine may have read other parts of a page.
- Pages were fetched after the live answers and may have changed since.
- One answer model (Codex), three US categories, one target app each.
- An effect here is necessary, not sufficient, for a real-world effect: the edit must also reach the engine through search.
- `INSERT` uses the App Store description's first declarative sentence. A different blurb may work better or worse.
- H1 mixes subject apps (target and competitors). It tests the mechanism, not one app's fortunes. The by-category table and `conditions.json` show which app each unit used.
- Design changes made before any outcome was collected are part of this file, not deviations. The H1 subject rule was set after counting eligible prompts, which needs no answers.
