# Does acting on `diagnose` change whether an engine names the app? — two pre-registered controlled tests

**Setting.** The contexts are the pages that live `codex-search` answers actually read: budgeting, meditation and language, 2026-10-09 runs, with the pages fetched on 2026-10-12. The answer engine is `codex-cli` without web search, 3 answers per (prompt, condition). One edit per condition. Everything was pre-registered and pushed before collection:
- main study: [PREREGISTRATION.md](PREREGISTRATION.md), commit `27f8bfc`;
- follow-up: [PREREGISTRATION-DOSE.md](PREREGISTRATION-DOSE.md), commit `f7e3513`, written after the main results.

All 987 calls succeeded. 32 answers searched even though web search was off. They were reported and not excluded, as pre-registered.

## Results as pre-registered

| | Edit | Units | Sign test | p (Holm for H1–H3) | Mean Δ (95% CI) | Verdict |
|---|---|---:|---|---:|---|---|
| H1 | Add the app's line to **one** page that lists competitors, vs a placebo sentence in the same place | 33 | 5/6 | 0.22 | +7.1 pp (+0.0 … +15.2) | not supported |
| H2 | Move the sentence naming the app to the top of its page | 36 | 5/5 | 0.09 | +5.6 pp (+0.9 … +11.1) | not supported |
| H3 | Remove the page `diagnose` ranks higher by lift, vs the lower one | 36 | 7/13 | 0.50 | −3.7 pp (−18.5 … +10.2) | not supported |
| H4 | Add the line to **every** page, vs placebo in the same places | 33 | 9/9 | 0.002 | **+19.2 pp (+8.1 … +31.3)** | **supported** |

Pre-registered wording:
- H1–H3: no evidence that the edit changes the rate in this setting.
- H4: "In this controlled setting, adding an app to every page the engine read raised the rate at which the engine named the app by +19.2 pp (95% CI +8.1 … +31.3)."

## Dose (descriptive, same 33 units)

| Condition | Subject named |
|---|---:|
| Unedited | 3.0% |
| Placebo on one page | 4.0% |
| Listed on one of ~5 pages | 11.1% |
| Placebo on every page | 3.0% |
| Listed on every page | 22.2% |

## What this means for app-aeo's advice
- **The mechanism is real.** Holding the question and the engine fixed, what the read pages say changes the pick (H4).
- **One listing was not enough to detect.** In this setting, one listing among ~5 read pages moved the rate by an estimated +7 pp, but the interval reached 0 (H1). The engine's picks are close to deterministic per question: most per-prompt rates were 0 or 1, so most units never moved.
  - So "get listed" means **being on most of the pages engines read for a question**, not on one of them.
  - `diagnose` now shows the share of read pages that list each app, not only single pages.
- **No demonstrated effect for H2 and H3.**
  - Moving the app's sentence up (H2) is directionally positive but not shown.
  - The lift ranking of "working" pages (H3) did not predict which page mattered more. Treat "Working" as descriptive, not as a ranking of causes.
- **Not shown here:**
  - that editors or search engines would make or index the edits;
  - that the live product would retrieve them;
  - any effect on installs;
  - other engines.

  The real-world chain needs a field experiment on an app you control. `diff` exists for that.

Files:

| File | Contents |
|---|---|
| `results.jsonl`, `results-dose.jsonl` | Every answer |
| `RESULTS.md`, `RESULTS-DOSE.md` | Generated tables |
| `conditions*.json` | Units, edits, sha256 of each context |

Contexts are third-party page excerpts and are not committed. Rebuild them with `build.mjs` / `dose-build.mjs` from a `diagnose --fetch` run; pages change over time.
