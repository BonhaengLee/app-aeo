D1 and D2 were written down **before** their data was collected. The pre-registered results are reported as run, next to the follow-ups.

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

**D3 — Claude session limit hit mid-benchmark (2026-10-10 ~03:30–04:30 KST).**
- `claude-search` returned "You've hit your session limit" and was halted as designed. 10 calls were affected across budgeting, ko-gagyebu and language+. They were recorded as failures, not as "not mentioned".
- The LLM-judge audit, which also uses Claude, failed for budgeting and ko-gagyebu (κ = none, so R3 = INDETERMINATE).
- After the limit reset, the same runs were resumed (`--resume` semantics: only failed or missing jobs are re-asked) and the audits were re-run.
- The as-run audits are preserved as `audit-asrun.json`.
- **Practical finding for users:** a 60-prompt × 2-engine gated run consumes a noticeable share of a Claude subscription's 5-hour session budget. The "free" path is free of extra charges, not free of quota.

**D4 — Claude weekly limit hit during the D2 follow-up, and one prescription that could not be followed (2026-10-10).**
- At ~05:50 KST `claude-search` hit the *weekly* limit in language+ (1 call, recorded as a failure, engine halted). The Claude-judged audits for language+ and ko-gagyebu+ failed (R3 = INDETERMINATE).
- After the limit cleared (~08:50 KST) the two cells were resumed: only the 3 missing language+ answers were asked, and both audits re-ran. One ko-gagyebu+ audit batch failed with a transient "Not logged in"; that audit was re-run in full (40 answers judged per engine, 0 failed batches). The truncated as-run audit is kept as `ko-gagyebu/extended/run/extended/audit-asrun.json`.
- **ko-gagyebu could not be extended.** The gate prescribed 55 prompts, but Google autocomplete plus the built-in templates yield only 43 distinct Korean queries — all already used. Under the D2 rule (no hand-written prompts) the cell was re-gated at 43 prompts, and codex-search stays NOT RELIABLE (R2 ±0.113). This is reported as a limit of the prompt source, not hidden.
