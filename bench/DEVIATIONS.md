D1 and D2 were written down **before** their data was collected. The pre-registered results are reported as run, next to the follow-ups.

**D0 — Korean cell ran with 43 prompts, not 60 (found in review on 2026-10-10, listed late).**
- The pre-registration says 60 prompts per category. For 가계부 (KR), autocomplete plus the Korean templates yielded only 43 distinct queries, and the run used all 43.
- The Korean cell therefore had fewer prompts than the others. Its R2 is not directly comparable.
- This should have been listed when the run started; it was not, and is recorded here instead of silently.

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

**D5 — Codex isolation was incomplete: the user's skills catalog reached every `codex-search` answer (found 2026-10-12, after all data was collected).**
- **What happened.** `CODEX_HOME` was isolated, but Codex also reads the user-level skills catalog from `~/.agents/skills`, which follows `HOME`, not `CODEX_HOME`. So every `codex-search` call in the benchmark, the expert-prompt development (§3.3 of the comparison) and the comparison study ran with the author's 133 skill names and descriptions in its developer context. Claude was not affected: `--setting-sources ""` loads no user skills, CLAUDE.md or memory (probed the same way, answer "NONE").
- **How it was found.** In a pre-publication audit, a probe asking Codex (through the same provider code) to list its instruction sources named the user skills catalog and its directory.
- **Fix.** The codex child now also gets an empty `HOME` (`isolatedUserHome()` in `src/providers.mjs`). A regression test checks that the child's `HOME` is empty and `CODEX_HOME` holds only `auth.json`; it fails on the old code. After the fix the same probe lists only Codex's 5 built-in skills.
- **Exposure to measured brands.** Of the 103 brand names and aliases in both studies, only **Notion** occurs in the catalog (17 times). It is one unit: note-taking × codex-search × Notion.
- **Effect on the comparison.** All arms (T, R, E, N, M5) of a cluster use the same engine, so they share the same context; the contrast between them is not biased by it. As a check, the analysis was re-run without the Notion/codex unit: C1 Δ 0.108, C3 Δ 0.095, both supported under every imputation bound; C2 Δ 0.130, supported as run and in the worst case, not in the best case — the same pattern as the full data.
- **Effect on absolute rates.** The `codex-search` rates in both studies are rates *for Codex with that catalog in context*, not for a clean Codex. No brand other than Notion is named in it, but a general effect (e.g. reading consumer questions as build requests) cannot be ruled out from this data. The data are kept as run and not re-collected under the pre-registration; a clean re-run would be a separate, labelled follow-up.

**D6 — the GitHub repository was deleted and re-created on 2026-10-12, so GitHub's own push timestamps are gone.**
- **Why.** During publication a superseded commit stayed reachable on GitHub after a force-push. To remove it completely, the repository was deleted and re-created with the same git history (every commit hash is unchanged).
- **What is lost.** The third-party timestamp the pre-registrations relied on was GitHub's repository events API (PREREGISTRATION.md §10 cites the `be22da8` push at 2026-10-09T17:58:23Z). Those events belonged to the deleted repository. GH Archive was checked for the relevant hours and holds no record of this repository, so no independent copy exists.
- **What is kept.** The events list as fetched before deletion, for 2026-10-09 to 2026-10-10, is in [`github-events-2026-10-09_10.json`](github-events-2026-10-09_10.json). It is now a record kept by the author, not a third-party proof. The comparison study's pre-registration push (`f2fffa0`) was already missing from the events API before deletion (it lists at most 90 days and drops some events).
- **What this means.** Readers have the commit order and the author's word for the timing, not an external timestamp. The results are unchanged; a reader who needs an independent time proof should treat both studies as not externally time-stamped.

**D7 — `codex-cli` (memory mode) could still search the web (found 2026-10-12, after the causal study was collected).**
- **What happened.** Without `--search`, Codex still ran web searches by default. Probe (codex-cli 0.156.1, a news question, 2 answers per variant): with no flag, 2/2 answers searched; with `-c tools.web_search=false`, 2/2 searched; with `-c web_search="disabled"`, 0/2 searched.
- **Exposure.** Only the causal study (`bench/causal/`) used `codex-cli`. 32 of its 987 answers searched (24 main, 8 dose). They were already reported, and kept as pre-registered. The benchmark and comparison studies used `codex-search`, `claude-search` and API engines, so they are not affected.
- **Sensitivity.** H4 without the 32 searched answers: +19.7 pp (95% CI +8.6 … +31.8), 9/9, p 0.002, against +19.2 pp with them.
- **Fix.** Memory mode now passes `-c web_search="disabled"`. A regression test checks that the flag is present for `codex-cli` and absent for `codex-search`; it fails on the old code.

**D8 — v2 fitness-judge parser accepted the "Name (kind)" form (2026-10-12, during collection, before any answer to an edited context existed).**
- **What happened.** The fitness prompt lists products as "Name (kind)". In 7 of 480 replies, the judge used that form as the JSON key. The registered parser accepted only the exact name, so the 7 prompts had no eligibility after 3 attempts each, and the run stopped as designed.
- **Change.** `parseVerdict` also accepts the exact name followed by the listed " (kind)". Any other key is still rejected. The judge, the prompt and every decision already recorded are unchanged. A test covers both cases and fails on the registered code.
- **Effect.** The 7 prompts are judged again by the same judge. No outcome data existed when this was changed; the corpus and eligibility do not involve the edited contexts or the answer engine. The registered file's sha256 in `v2/MANIFEST.sha256` no longer matches `eligibility.mjs`; this entry is why.

**D9 — v2 workers raised from 3 to 8 for Codex (2026-10-12 13:25 UTC, during primary collection).**
- **What happened.** At 3 workers, a call took a median of 20 s and collection ran at 9.5 answers a minute, so about 8.7 hours for 4,960 answers. The 3-worker setting rested on one transient 429 in the pilot; collection itself had 0 rate limits.
- **Change.** `collect.mjs` and `judge.mjs` read the number of workers from `V2_WORKERS` (default 3). Codex runs at 8 workers; Claude stays at 3. Measured at 8 workers: 28.5 answers a minute, 0 failures, 0 rate limits and 0 searched answers in the first 4 minutes.
- **Effect.** None on the answers. Every call is an independent, isolated request with the same model, reasoning effort and context. The ask order is still the registered seeded order; only how many run at once changed. The pipeline was stopped and resumed; answers in flight at the stop were simply asked again (one answer per job and repeat is analysed).
