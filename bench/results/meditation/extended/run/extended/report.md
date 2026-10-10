## Reliability gate

_A number is RELIABLE only if R1–R3 all pass. Thresholds were fixed before any run; INDETERMINATE is never a pass._

| Engine | Mode | Answers (repeats) | Verdict | R1 rate reliability ≥ 0.8 | R2 precision ± ≤ 0.10 | R3 coding κ ≥ 0.8 |
|---|---|---|---|---|---|---|
| codex-search | search | 200 (2) | **RELIABLE** | ✅ 1.00 | ✅ 0.09 | ✅ 1.00 |
| claude-search | search | 200 (2) | **RELIABLE** | ✅ 1.00 | ✅ 0.08 | ✅ 1.00 |

# App AEO report — Insight Timer

Run 2026-10-09T20:13:44.473Z → 2026-10-09T20:28:21.279Z · 100 prompts · 400 answers · 0 failed calls

## By answer engine

| Engine | Mode | Model | Prompts × answers | Mention rate (95% CI over prompts) | Same answer on repeat | Avg position | Store link | Share of voice | Failed |
|---|---|---|---|---|---|---|---|---|---|
| claude-search | search | claude-opus-4-6[1m] | 100 × 200 | 69% (61%–77%) | 86% (86/100) | 2.7 | 0 | 29% | 0 |
| codex-search | search | — | 100 × 200 | 49% (40%–59%) | 92% (92/100) | 1.8 | 11 | 33% | 0 |

_Mode: **search** = answer grounded in a live web search (closest to consumer chat apps) · **memory** = model knowledge only · **agent** = coding-agent CLI. Interval = bootstrap over prompts, so repeats do not fake precision._

## Competitors (mention rate per engine)

| App | claude-search | codex-search |
|---|---|---|
| **Insight Timer** | 69% @2.7 | 49% @1.8 |
| Calm | 83% @3.3 | 44% @2.0 |
| Headspace | 88% @2.7 | 54% @1.4 |

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
| meditation app for garmin | 0/4 |
| best meditation app meta quest | 0/4 |
| free meditation app for nhs staff | 0/4 |
| meditation app for oculus | 0/4 |
| meditation app with flashing lights | 0/4 |
| meditation without app | 0/4 |
| meditation app for black women | 0/4 |
| meditation app for kids | 1/4 |
| meditation app with orange branding | 1/4 |
| best meditation app calm or headspace | 1/4 |
| meditation app for children | 1/4 |
| best meditation app for depression | 1/4 |
| best meditation app garmin | 1/4 |
| best meditation app kids | 1/4 |
| meditation app for pregnancy | 1/4 |
| best mindfulness apps kids | 1/4 |
| meditation app for meta quest | 1/4 |
| meditation app for adhd | 1/4 |
| best meditation app balance | 1/4 |
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
| best meditation app headspace | 2/4 |
| meditation apps for high blood pressure | 2/4 |
| meditation app for weight loss | 2/4 |
| best meditation app for pregnancy | 2/4 |
| meditation app for parents | 2/4 |
| meditation app for teachers | 2/4 |
| meditation app ui design | 2/4 |
| meditation app for beginners | 3/4 |
| meditation app for healing | 3/4 |
| best meditation app beginners | 3/4 |
| best meditation app calm | 3/4 |
| meditation app for.depression | 3/4 |
| meditation app for kids free | 3/4 |
| best meditation app new york times | 3/4 |
| best meditation app subscription | 3/4 |
| is waking up the best meditation app | 3/4 |
| meditation app free for teachers | 3/4 |

## Apps the engines recommend that you did not list

| App (name or store id) | Answers |
|---|---|
| name:Medito | 17 |
| name:Waking Up | 13 |
| name:Smiling Mind | 12 |
| name:UCLA Mindful | 8 |
| name:Start small | 7 |
| name:Balance | 7 |
| name:Healthy Minds Program | 6 |
| apple:1675603291 | 6 |
| name:Try before you buy | 5 |
| apple:1307736395 | 5 |
| name:Ten Percent Happier | 4 |
| name:Be consistent | 4 |
| name:BetterSleep | 4 |
| name:Breethe | 4 |
| apple:1631848467 | 3 |

## Caveats

- claude-search: 2/200 answers had no search results behind them (search mode).

_Mention = name/alias as a whole word or a store link. Position = list item number when the answer is a list. Nothing here is a market share: it is how often these engines named the app for these prompts on this day._
