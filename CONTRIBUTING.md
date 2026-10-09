# Contributing

- **Run the tests:** `node test/selftest.mjs`. There are no dependencies and no network calls.
- **Every bug fix needs a regression test that fails on the old code.** Run it against the previous commit before you open the PR. The test suite already holds itself to this rule (see the `R1`–`R12` cases).
- **Statistics changes** (anything in `src/reliability.mjs`, `src/report.mjs`, `src/validate.mjs`) need a note in `docs/METHODOLOGY.md` that states what changed and why.
  - Thresholds in `GATE` are not tuned on benchmark data. Propose changes with pilot data from a different category.
- **New engines** go in `src/providers.mjs`. Each one must:
  - declare its `mode` (`search`, `rag` or `memory`);
  - report `grounded` per answer if it claims search;
  - throw `ProviderError` with `rate_limited`/`auth`/`quota` instead of returning empty text.
- **No engine that drives consumer chat websites through unofficial endpoints.** It violates those services' terms and breaks without warning.
- **Benchmarks:** to add a category, write `bench/categories.json` and `bench/PREREGISTRATION.md` first, commit them, then run `node bench/run.mjs <id>` and commit the results. Report every cell, including failures.
