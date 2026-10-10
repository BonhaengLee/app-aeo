## Reliability gate

_A number is RELIABLE only if R1–R3 all pass. Thresholds were fixed before any run; INDETERMINATE is never a pass._

| Engine | Mode | Answers (repeats) | Verdict | R1 rate reliability ≥ 0.8 | R2 precision ± ≤ 0.10 | R3 coding κ ≥ 0.8 |
|---|---|---|---|---|---|---|
| codex-search | search | 120 (2) | **NOT RELIABLE** | ✅ 1.00 | ❌ 0.10 (needs ~67 prompts) | ✅ 1.00 |
| claude-search | search | 120 (2) | **RELIABLE** | ✅ 0.99 | ✅ 0.10 | ✅ 0.98 |

# App AEO report — Monarch Money

Run 2026-10-09T19:37:37.268Z → 2026-10-09T19:53:38.811Z · 60 prompts · 240 answers · 0 failed calls

## By answer engine

| Engine | Mode | Model | Prompts × answers | Mention rate (95% CI over prompts) | Same answer on repeat | Avg position | Store link | Share of voice | Failed |
|---|---|---|---|---|---|---|---|---|---|
| claude-search | search | claude-opus-4-6[1m] | 60 × 120 | 63% (52%–73%) | 75% (45/60) | 2.5 | 0 | 34% | 0 |
| codex-search | search | — | 60 × 120 | 28% (18%–39%) | 87% (52/60) | 1.9 | 2 | 29% | 0 |

_Mode: **search** = answer grounded in a live web search (closest to consumer chat apps) · **memory** = model knowledge only · **agent** = coding-agent CLI. Interval = bootstrap over prompts, so repeats do not fake precision._

## Competitors (mention rate per engine)

| App | claude-search | codex-search |
|---|---|---|
| **Monarch Money** | 63% @2.5 | 28% @1.9 |
| YNAB | 89% @2.1 | 60% @1.3 |
| Rocket Money | 33% @3.4 | 9% @1.5 |

## Prompts where at least one answer left the app out

| Prompt | Mentioned / answers |
|---|---|
| best budgeting app australia | 0/4 |
| best budgeting app europe | 0/4 |
| budgeting app for europe | 0/4 |
| budgeting app for groceries | 0/4 |
| best budgeting app india | 0/4 |
| best budgeting app kenya | 0/4 |
| budgeting app for kids | 0/4 |
| budgeting app for linux | 0/4 |
| best budgeting app philippines | 0/4 |
| best budgeting app south africa | 0/4 |
| best budgeting app uk | 0/4 |
| budgeting app for uk | 0/4 |
| budgeting app free uk | 0/4 |
| ynab alternative free | 0/4 |
| budgeting app free | 1/4 |
| budgeting app without bank sync | 1/4 |
| best budgeting app dave ramsey | 1/4 |
| best budgeting app germany | 1/4 |
| best budgeting app malaysia | 1/4 |
| best budgeting app nz | 1/4 |
| budgeting app for teens | 1/4 |
| best budgeting app to pay off debt | 1/4 |
| budgeting app without subscription | 1/4 |
| best budgeting apps free | 1/4 |
| rocket money alternative free | 1/4 |
| budgeting app for android | 1/4 |
| budgeting app for college students | 1/4 |
| best budgeting app canada free | 1/4 |
| budgeting app with no subscription | 2/4 |
| budgeting app for biweekly pay | 2/4 |
| budgeting app for dummies | 2/4 |
| best budgeting app hong kong | 2/4 |
| budgeting app for nurses | 2/4 |
| budgeting app for retirees | 2/4 |
| budgeting app for students | 2/4 |
| budgeting app that connects to bank free | 2/4 |
| best budget building app | 2/4 |
| best budgeting app android | 2/4 |
| budgeting app for beginners | 2/4 |
| budgeting app for debt | 2/4 |
| budgeting app that links to bank account | 3/4 |
| budgeting app for adhd | 3/4 |
| budgeting app for household | 3/4 |
| budgeting app for iphone | 3/4 |
| budgeting app for macbook | 3/4 |
| best budgeting app or spreadsheet | 3/4 |
| best budgeting app for overspenders | 3/4 |
| budgeting app for women | 3/4 |
| best budgeting app dollarwise | 3/4 |

## Apps the engines recommend that you did not list

| App (name or store id) | Answers |
|---|---|
| name:Goodbudget | 17 |
| name:Honeydue | 8 |
| name:Spendee | 6 |
| name:Empower | 5 |
| name:PocketGuard | 5 |
| name:Money Manager | 4 |
| apple:486312413 | 4 |
| play:com.droid4you.application.wallet | 4 |
| name:EveryDollar | 4 |
| name:PocketSmith | 3 |
| name:Zero-based budgeting | 3 |
| name:Privacy | 3 |
| name:Money Dashboard | 3 |
| name:Tiller Money | 2 |
| name:Quicken Simplifi | 2 |

## Caveats

- claude-search: only 75% of prompts gave the same yes/no across repeats — single answers from this engine are noisy.

_Mention = name/alias as a whole word or a store link. Position = list item number when the answer is a list. Nothing here is a market share: it is how often these engines named the app for these prompts on this day._
