Both deviations were written down **before** their data was collected. The pre-registered results are reported as run, next to the follow-ups.

**D1 — extractor fix (after meditation and language had finished, before the follow-up runs).**
- The LLM-judge audit (R3) found the extractor counting the ordinary word "calm" as the app *Calm*: 9 of 240 audited pairs in meditation.
- Fix: one-word Title-case Latin brands now match only when capitalised (`isWordLikeBrand`). There is a regression test for it.
- κ as run (old extractor) is kept from `audit.json`. The follow-up re-audits with the fixed extractor and the same judge.

**D2 — prompt extension, testing the gate's own prescription.**
- With 60 prompts, R1 and R3 passed but R2 failed in the first finished cells. The gate prescribed "~66–89 prompts".
- Follow-up rule, fixed now:
  - each category is extended to the largest `promptsNeeded` across its two engines, rounded up to the next 10 and capped at 120;
  - new prompts are the next Google-autocomplete queries not already in the set;
  - existing answers are reused, so only new prompts are asked;
  - the gate runs again.
- This tests whether the gate's "needs N prompts" prediction holds. Results are reported per cell, pass or fail.
