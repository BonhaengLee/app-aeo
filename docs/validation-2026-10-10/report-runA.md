# App AEO report — Streaks

Run 2026-10-09T17:20:53.784Z → 2026-10-09T17:32:59.735Z · 20 prompts · 80 answers · 0 failed calls

**Overall mention rate: 66%** (53/80, 95% CI 55%–76%)

## By answer engine

| Engine | Mode | Model | Prompts × answers | Mention rate (95% CI over prompts) | Same answer on repeat | Avg position | Store link | Share of voice | Failed |
|---|---|---|---|---|---|---|---|---|---|
| claude-search | search | claude-opus-4-6[1m] | 20 × 40 | 88% (75%–98%) | 85% (17/20) | 3.4 | 0 | 51% | 0 |
| codex-search | search | — | 20 × 40 | 45% (25%–65%) | 90% (18/20) | 1.7 | 11 | 44% | 0 |

_Mode: **search** = answer grounded in a live web search (closest to consumer chat apps) · **memory** = model knowledge only · **agent** = coding-agent CLI. Interval = bootstrap over prompts, so repeats do not fake precision._

## Competitors (mention rate per engine)

| App | claude-search | codex-search |
|---|---|---|
| **Streaks** | 88% @3.4 | 45% @1.7 |
| Habitify | 80% @5.6 | 33% @1.6 |
| HabitKit | 5% @1.0 | 25% @1.2 |

## Prompts where at least one answer left the app out

| Prompt | Mentioned / answers |
|---|---|
| habit tracker app free android | 0/4 |
| habit tracker app free | 1/4 |
| habitify free alternative | 1/4 |
| best habit tracker app for android | 1/4 |
| habit tracker app for android | 2/4 |
| best habit tracker app free | 2/4 |
| free habit tracker app no subscription | 2/4 |
| free habit tracker app no ads | 2/4 |
| habit tracker app for adhd | 2/4 |
| habit tracker app cost | 2/4 |
| habit tracker app without subscription | 3/4 |
| habit tracker app free iphone | 3/4 |

## Apps the engines recommend that you did not list

| App (name or store id) | Answers |
|---|---|
| play:org.isoron.uhabits | 7 |
| name:Loop Habit Tracker | 6 |
| apple:1523273937 | 5 |
| apple:6749277809 | 4 |
| name:HabitNow | 3 |
| name:Habitica | 3 |
| apple:994882113 | 3 |
| name:Way of Life | 3 |
| name:TickTick | 2 |
| play:com.habitnow | 2 |
| name:Habit Doom | 2 |
| name:SetHabits | 2 |
| apple:6756943255 | 2 |
| apple:6752608980 | 2 |
| apple:1632915212 | 2 |

_Mention = name/alias as a whole word or a store link. Position = list item number when the answer is a list. Nothing here is a market share: it is how often these engines named the app for these prompts on this day._
