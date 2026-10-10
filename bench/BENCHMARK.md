# Benchmark — app-aeo reliability and validity across 4 categories

Protocol, thresholds and hypotheses were pre-registered in [`PREREGISTRATION.md`](PREREGISTRATION.md) and committed before any answer was collected. All cells are reported. Raw answers, audits and gates are in `results/`.

## Summary

| Hypothesis | Pre-registered criterion | Result |
|---|---|---|
| H1 reliability is achievable | ≥ 6 of 8 cells RELIABLE within 4 repeats | **2 / 8** ❌ not supported |
| H2 extractor codes mentions correctly | every cell κ ≥ 0.80 | **8 / 8** ✅ supported |
| H3 picks track real usage | ≥ half of cells ρ ≥ 0.5, p < 0.05 | **1 / 8** ❌ not supported |

## Cells

| Category | Engine | Answers (repeats) | Grounded | Target rate (95% CI) | R1 rate reliability | R2 ± | R3 κ (agreement) | Verdict | Convergent ρ (p, n) |
|---|---|---|---|---|---|---|---|---|---|
| meditation (us) | codex-search | 120 (2) | 120/120 | 43% (32%–57%) | ✅ 0.99 [4 apps] | ❌ 0.13 | ✅ 1.00 (100%) | **NOT RELIABLE** | 0.40 (0.749, 4) |
| meditation (us) | claude-search | 120 (2) | 118/120 | 70% (59%–80%) | ✅ 1.00 [5 apps] | ❌ 0.10 | ✅ 0.98 (99%) | **NOT RELIABLE** | 0.90 (0.082, 5) |
| budgeting (us) | codex-search | 120 (2) | 120/120 | 28% (18%–39%) | ✅ 1.00 [6 apps] | ❌ 0.10 | ✅ 1.00 (100%) | **NOT RELIABLE** | 0.20 (0.915, 4) |
| budgeting (us) | claude-search | 120 (2) | 120/120 | 63% (52%–73%) | ✅ 0.99 [5 apps] | ✅ 0.10 | ✅ 0.98 (99%) | **RELIABLE** | -1.00 (0.336, 3) |
| language (us) | codex-search | 120 (2) | 120/120 | 48% (37%–61%) | ✅ 0.99 [6 apps] | ❌ 0.13 | ✅ 1.00 (100%) | **NOT RELIABLE** | 0.60 (0.242, 6) |
| language (us) | claude-search | 120 (2) | 120/120 | 54% (43%–67%) | ✅ 0.99 [15 apps] | ❌ 0.12 | ✅ 1.00 (100%) | **NOT RELIABLE** | 0.75 (0.008, 12) |
| ko-gagyebu (kr) | codex-search | 172 (4) | 172/172 | 69% (58%–80%) | ✅ 1.00 [4 apps] | ❌ 0.11 | ✅ 0.95 (98%) | **NOT RELIABLE** | -0.60 (0.424, 4) |
| ko-gagyebu (kr) | claude-search | 86 (2) | 86/86 | 85% (74%–94%) | ✅ 1.00 [7 apps] | ✅ 0.10 | ✅ 0.98 (99%) | **RELIABLE** | -1.00 (0.336, 3) |

## Per category

### meditation — target Insight Timer

Prompts: 60 (60 from Google autocomplete). Run: `results/meditation/run/2026-10-09T175855.769Z`.

| App | claude-search | codex-search |
|---|---|---|
| **Insight Timer** | 70% | 43% |
| Calm | 86% | 43% |
| Headspace | 90% | 48% |

Apps the engines recommended that were not in the config (top 8): Medito (12), Waking Up (11), Smiling Mind (8), Start small (7), Balance (5), Be consistent (4), UCLA Mindful (4), Healthy Minds Program (4)

### budgeting — target Monarch Money

Prompts: 60 (60 from Google autocomplete). Run: `results/budgeting/run/2026-10-09T182809.136Z`.

| App | claude-search | codex-search |
|---|---|---|
| **Monarch Money** | 63% | 28% |
| YNAB | 89% | 60% |
| Rocket Money | 33% | 9% |

Apps the engines recommended that were not in the config (top 8): Goodbudget (17), Honeydue (8), Spendee (6), Empower (5), PocketGuard (5), Money Manager (4), apple:486312413 (4), play:com.droid4you.application.wallet (4)

### language — target Babbel

Prompts: 60 (60 from Google autocomplete). Run: `results/language/run/2026-10-09T175900.688Z`.

| App | claude-search | codex-search |
|---|---|---|
| **Babbel** | 54% | 48% |
| Duolingo | 93% | 69% |
| Busuu | 53% | 43% |

Apps the engines recommended that were not in the config (top 8): Pimsleur (34), Anki (29), Memrise (28), LingQ (18), Clozemaster (16), Mango Languages (12), Drops (11), Mondly (10)

### ko-gagyebu — target 편한가계부

Prompts: 43 (29 from Google autocomplete). Run: `results/ko-gagyebu/run/2026-10-09T182818.818Z`.

| App | claude-search | codex-search |
|---|---|---|
| **편한가계부** | 85% | 69% |
| 뱅크샐러드 | 92% | 61% |
| 위플 가계부 | 62% | 16% |

Apps the engines recommended that were not in the config (top 8): apple:1320730220 (30), play:com.rainist.banksalad2 (28), apple:6752123281 (19), apple:954944283 (16), play:com.realbyteapps.moneymanagerfree (15), apple:6444122615 (14), apple:441683476 (14), apple:6459790014 (12)

## Follow-up D2 — prompts extended to the gate's prescription

Not part of the pre-registered test (see D2). Each category was extended to the gate's own "prompts needed" (rounded up to 10, cap 120), drawing only new Google-autocomplete queries. **RELIABLE 7 / 8** after extension.

| Category | Engine | Prompts (pre-reg → extended, prescribed) | Answers (repeats) | R1 | R2 ± | R3 κ | Verdict | Convergent ρ (p, n) |
|---|---|---|---|---|---|---|---|---|
| meditation (us) | codex-search | 60 → 100 (93) | 200 (2) | ✅ 1.00 | ✅ 0.095 | ✅ 1.00 | **RELIABLE** | 0.40 (0.749, 4) |
| meditation (us) | claude-search | 60 → 100 (93) | 200 (2) | ✅ 1.00 | ✅ 0.080 | ✅ 1.00 | **RELIABLE** | 0.50 (1.000, 3) |
| budgeting (us) | codex-search | 60 → 70 (68) | 140 (2) | ✅ 1.00 | ✅ 0.100 | ✅ 1.00 | **RELIABLE** | 0.20 (0.915, 4) |
| budgeting (us) | claude-search | 60 → 70 (68) | 140 (2) | ✅ 0.99 | ✅ 0.096 | ✅ 1.00 | **RELIABLE** | 0.20 (0.915, 4) |
| language (us) | codex-search | 60 → 100 (93) | 200 (2) | ✅ 1.00 | ✅ 0.093 | ✅ 1.00 | **RELIABLE** | 0.60 (0.242, 6) |
| language (us) | claude-search | 60 → 100 (93) | 200 (2) | ✅ 1.00 | ✅ 0.092 | ✅ 1.00 | **RELIABLE** | 0.59 (0.066, 11) |
| ko-gagyebu (kr) | codex-search | 43 → 43 (55) ⚠️ pool exhausted | 172 (4) | ✅ 1.00 | ❌ 0.113 | ✅ 0.95 | **NOT RELIABLE** | -0.60 (0.424, 4) |
| ko-gagyebu (kr) | claude-search | 43 → 43 (55) ⚠️ pool exhausted | 86 (2) | ✅ 1.00 | ✅ 0.099 | ✅ 0.98 | **RELIABLE** | -1.00 (0.336, 3) |

## Coding audit disagreements

Every (answer, app) pair where the extractor and the independent judge disagreed, so readers can see who was right.

- **meditation · claude-search · Calm** extractor=true judge=false — “…# Alternative Words for "Calm" 🌿 Here are a variety of synonyms and alternatives, grouped by nuance: -…”
- **budgeting · claude-search · YNAB** extractor=true judge=false — “…rawback:** Budgeting features are more basic than dedicated budgeting apps like YNAB. You may get solicited to use Empower's paid advisory services. - **Platfor…”
- **ko-gagyebu · codex-search · 뱅크샐러드** extractor=false judge=true — “…있어요. **뱅크샐러드에서 뭘 주로 쓰는지**에 따라 더 잘 맞는 앱이 달라요. - **계좌·카드 확인과 송금까지 한 앱에서 하고 싶다면: 토스** — 일…”
- **ko-gagyebu · codex-search · 편한가계부** extractor=false judge=true — “…m.com/news/view/20260922000280) 간단히 추천하면: - **여러 명이 한 가계부를 함께 쓰기:** 소비의온도 - **편한가계부를 이미 쓰고 있다면:** 같은 계정으로 로그인해 동기화하는 방식도 가능하다고 안내돼 있어요. 다만 계정 공유 방식은 개인정보와 설정을…”
- **ko-gagyebu · codex-search · 뱅크샐러드** extractor=false judge=true — “… 찾는 거라면, 검색 결과는 앱 비교보다는 가계부 작성 후기나 소비 관리 글이 많았어요. 한 게시글은 여러 계좌·카드를 한눈에 보는 앱으로 **뱅크샐러드나 토스**를 언급합니다. [디시 게시글](https://gall.dcinside.com/board/view/?id=baseball_n…”
- **ko-gagyebu · claude-search · 편한가계부** extractor=false judge=true — “…# 더쿠(theqoo)에서 추천하는 가계부 앱 정리 더쿠 커뮤니티에서 가계부 앱 관련 글이 꽤 많이 올라와 있는데요, 가장 많이 언급되는 앱들을 정리해 드릴게요. --- ## 1. 📒 편한 가계부 (가장 많이 추천!) 더쿠에서 가계부 추천 글이 올라올 때마다 거의 빠지지 않고 언…”

## Deviations from the pre-registration

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

