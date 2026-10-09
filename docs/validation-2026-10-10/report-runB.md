# App AEO report — Streaks

Run 2026-10-09T17:20:53.784Z → 2026-10-09T17:32:47.308Z · 20 prompts · 80 answers · 0 failed calls

**Overall mention rate: 65%** (52/80, 95% CI 54%–75%)

## By answer engine

| Engine | Mode | Model | Prompts × answers | Mention rate (95% CI over prompts) | Same answer on repeat | Avg position | Store link | Share of voice | Failed |
|---|---|---|---|---|---|---|---|---|---|
| claude-search | search | claude-opus-4-6[1m] | 20 × 40 | 90% (78%–100%) | 90% (18/20) | 5.5 | 0 | 55% | 0 |
| codex-search | search | — | 20 × 40 | 40% (23%–60%) | 70% (14/20) | 1.2 | 9 | 41% | 0 |

_Mode: **search** = answer grounded in a live web search (closest to consumer chat apps) · **memory** = model knowledge only · **agent** = coding-agent CLI. Interval = bootstrap over prompts, so repeats do not fake precision._

## Competitors (mention rate per engine)

| App | claude-search | codex-search |
|---|---|---|
| **Streaks** | 90% @5.5 | 40% @1.2 |
| Habitify | 70% @8.8 | 35% @1.7 |
| HabitKit | 5% @1.0 | 23% @1.6 |

## Prompts where at least one answer left the app out

| Prompt | Mentioned / answers |
|---|---|
| best habit tracker app for android | 0/4 |
| habit tracker app for android | 1/4 |
| habit tracker app free android | 1/4 |
| habit tracker app free | 2/4 |
| best habit tracker app free | 2/4 |
| habit tracker app.without ads | 2/4 |
| habit tracker app for adhd | 2/4 |
| free habit tracker app no ads | 2/4 |
| best habit tracker app free iphone | 2/4 |
| habit tracker app without subscription | 3/4 |
| habitify free alternative | 3/4 |
| habit tracker app free iphone | 3/4 |
| free habit tracker app no subscription | 3/4 |
| habit tracker app for couples | 3/4 |
| habit tracker app cost | 3/4 |

## Apps the engines recommend that you did not list

| App (name or store id) | Answers |
|---|---|
| play:org.isoron.uhabits | 7 |
| apple:1523273937 | 4 |
| name:Loop Habit Tracker | 3 |
| name:Habitica | 3 |
| apple:6749277809 | 3 |
| apple:994882113 | 3 |
| apple:1632915212 | 3 |
| apple:6692634213 | 3 |
| play:com.habitnow | 2 |
| play:com.ticktick.task | 2 |
| apple:6788409678 | 2 |
| apple:6756943255 | 2 |
| name:Way of Life | 2 |
| name:No streak punishment | 2 |
| apple:6780628137 | 1 |

## Caveats

- codex-search: only 70% of prompts gave the same yes/no across repeats — single answers from this engine are noisy.

_Mention = name/alias as a whole word or a store link. Position = list item number when the answer is a list. Nothing here is a market share: it is how often these engines named the app for these prompts on this day._
