## Reliability gate

_A number is RELIABLE only if R1–R3 all pass. Thresholds were fixed before any run; INDETERMINATE is never a pass._

| Engine | Mode | Answers (repeats) | Verdict | R1 rate reliability ≥ 0.8 | R2 precision ± ≤ 0.10 | R3 coding κ ≥ 0.8 |
|---|---|---|---|---|---|---|
| codex-search | search | 120 (2) | **NOT RELIABLE** | ✅ 0.99 | ❌ 0.13 (needs ~93 prompts) | ✅ 1.00 |
| claude-search | search | 120 (2) | **NOT RELIABLE** | ✅ 1.00 | ❌ 0.10 (needs ~66 prompts) | ✅ 0.98 |

# App AEO report — Insight Timer

Run 2026-10-09T19:33:34.452Z → 2026-10-09T19:37:08.876Z · 60 prompts · 240 answers · 0 failed calls

## By answer engine

| Engine | Mode | Model | Prompts × answers | Mention rate (95% CI over prompts) | Same answer on repeat | Avg position | Store link | Share of voice | Failed |
|---|---|---|---|---|---|---|---|---|---|
| claude-search | search | claude-opus-4-6[1m] | 60 × 120 | 70% (59%–80%) | 83% (50/60) | 2.3 | 0 | 28% | 0 |
| codex-search | search | — | 60 × 120 | 43% (32%–57%) | 97% (58/60) | 1.8 | 5 | 32% | 0 |

_Mode: **search** = answer grounded in a live web search (closest to consumer chat apps) · **memory** = model knowledge only · **agent** = coding-agent CLI. Interval = bootstrap over prompts, so repeats do not fake precision._

## Competitors (mention rate per engine)

| App | claude-search | codex-search |
|---|---|---|
| **Insight Timer** | 70% @2.3 | 43% @1.8 |
| Calm | 86% @3.4 | 43% @1.8 |
| Headspace | 90% @2.8 | 48% @1.3 |

## Prompts where at least one answer left the app out

| Prompt | Mentioned / answers |
|---|---|
| calm alternative words | 0/4 |
| meditation app for garmin watch | 0/4 |
| meditation app for ibs | 0/4 |
| meditation app for labor | 0/4 |
| best meditation app meta quest 3 | 0/4 |
| best meditation app on meta quest 3 | 0/4 |
| meditation app for ocd | 0/4 |
| meditation app ui | 0/4 |
| best meditation app wirecutter | 0/4 |
| meditation app with orange branding codycross | 0/4 |
| calm alternative songs | 0/4 |
| meditation app for kids | 1/4 |
| meditation app with orange branding | 1/4 |
| best meditation app calm or headspace | 1/4 |
| meditation app for children | 1/4 |
| best meditation app for depression | 1/4 |
| best meditation app garmin | 1/4 |
| best meditation app kids | 1/4 |
| meditation app for pregnancy | 1/4 |
| best meditation app australia | 2/4 |
| meditation app for divorce | 2/4 |
| meditation app example | 2/4 |
| best meditation app hindi | 2/4 |
| best meditation learning app | 2/4 |
| meditation app for men | 2/4 |
| mindfulness app for nurses | 2/4 |
| best meditation app paid | 2/4 |
| meditation app for teens | 2/4 |
| best meditation app to lower blood pressure | 2/4 |
| meditation app for women | 2/4 |
| meditation app free for a year | 2/4 |
| meditation app without ai | 2/4 |
| meditation app for apple watch | 2/4 |
| best meditation app for deaf people | 2/4 |
| meditation app for co parenting | 2/4 |
| meditation app for beginners | 3/4 |
| meditation app for healing | 3/4 |
| best meditation app beginners | 3/4 |
| best meditation app calm | 3/4 |

## Apps the engines recommend that you did not list

| App (name or store id) | Answers |
|---|---|
| name:Medito | 12 |
| name:Waking Up | 11 |
| name:Smiling Mind | 8 |
| name:Start small | 7 |
| name:Balance | 5 |
| name:Be consistent | 4 |
| name:UCLA Mindful | 4 |
| name:Healthy Minds Program | 4 |
| name:BetterSleep | 4 |
| name:Try before you buy | 4 |
| name:Breethe | 4 |
| name:Ten Percent Happier | 3 |
| apple:1631848467 | 3 |
| apple:6744633379 | 3 |
| name:Serene | 2 |

## Caveats

- claude-search: 2/120 answers had no search results behind them (search mode).

_Mention = name/alias as a whole word or a store link. Position = list item number when the answer is a list. Nothing here is a market share: it is how often these engines named the app for these prompts on this day._
