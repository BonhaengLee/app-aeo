## Reliability gate

_A number is RELIABLE only if R1–R3 all pass. Thresholds were fixed before any run; INDETERMINATE is never a pass._

| Engine | Mode | Answers (repeats) | Verdict | R1 rate reliability ≥ 0.8 | R2 precision ± ≤ 0.10 | R3 coding κ ≥ 0.8 |
|---|---|---|---|---|---|---|
| codex-search | search | 120 (2) | **NOT RELIABLE** | ✅ 1.00 | ❌ 0.10 (needs ~67 prompts) | ⚪ — (judge produced no usable codes) |
| claude-search | search | 69 (2) | **NOT RELIABLE** | ⚪ — (only 3 apps with ≥ 5 mentions (need ≥ 4)) | ❌ 0.12 (needs ~90 prompts) | ⚪ — (judge produced no usable codes) |

# App AEO report — Monarch Money

Run 2026-10-09T18:28:09.138Z → 2026-10-09T18:45:19.377Z · 60 prompts · 189 answers · 2 failed calls

## By answer engine

| Engine | Mode | Model | Prompts × answers | Mention rate (95% CI over prompts) | Same answer on repeat | Avg position | Store link | Share of voice | Failed |
|---|---|---|---|---|---|---|---|---|---|
| claude-search | search | claude-opus-4-6[1m] | 60 × 69 | 63% (50%–75%) | 89% (8/9) | 2.4 | 0 | 34% | 2 |
| codex-search | search | — | 60 × 120 | 28% (18%–39%) | 87% (52/60) | 1.9 | 2 | 29% | 0 |

_Mode: **search** = answer grounded in a live web search (closest to consumer chat apps) · **memory** = model knowledge only · **agent** = coding-agent CLI. Interval = bootstrap over prompts, so repeats do not fake precision._

## Competitors (mention rate per engine)

| App | claude-search | codex-search |
|---|---|---|
| **Monarch Money** | 64% @2.4 | 28% @1.9 |
| YNAB | 84% @1.7 | 60% @1.3 |
| Rocket Money | 42% @2.3 | 9% @1.5 |

## Prompts where at least one answer left the app out

| Prompt | Mentioned / answers |
|---|---|
| best budgeting app australia | 0/4 |
| best budgeting app europe | 0/3 |
| budgeting app for europe | 0/3 |
| budgeting app for groceries | 0/3 |
| best budgeting app germany | 0/3 |
| best budgeting app india | 0/3 |
| best budgeting app kenya | 0/3 |
| budgeting app for kids | 0/3 |
| budgeting app for linux | 0/3 |
| best budgeting app malaysia | 0/3 |
| best budgeting app nz | 0/3 |
| best budgeting app philippines | 0/3 |
| best budgeting app south africa | 0/3 |
| budgeting app for teens | 0/3 |
| best budgeting app uk | 0/3 |
| budgeting app for uk | 0/3 |
| budgeting app without subscription | 0/3 |
| budgeting app free uk | 0/3 |
| ynab alternative free | 0/3 |
| budgeting app for college students | 0/3 |
| best budgeting app canada free | 0/3 |
| budgeting app free | 1/4 |
| budgeting app without bank sync | 1/4 |
| budgeting app for biweekly pay | 1/3 |
| best budgeting app dave ramsey | 1/3 |
| budgeting app for dummies | 1/3 |
| best budgeting app hong kong | 1/3 |
| budgeting app for nurses | 1/3 |
| budgeting app for retirees | 1/3 |
| budgeting app for students | 1/3 |
| best budgeting app to pay off debt | 1/3 |
| best budgeting apps free | 1/3 |
| budgeting app that connects to bank free | 1/3 |
| rocket money alternative free | 1/3 |
| budgeting app for android | 1/3 |
| best budget building app | 1/3 |
| best budgeting app android | 1/3 |
| budgeting app for beginners | 1/3 |
| budgeting app for debt | 1/3 |
| budgeting app with no subscription | 2/4 |
| budgeting app for household | 2/3 |
| budgeting app for iphone | 2/3 |
| best budgeting app or spreadsheet | 2/3 |
| best budgeting app for overspenders | 2/3 |
| budgeting app for women | 2/3 |
| budgeting app that links to bank account | 3/4 |
| budgeting app for adhd | 3/4 |

## Apps the engines recommend that you did not list

| App (name or store id) | Answers |
|---|---|
| name:Goodbudget | 13 |
| name:Honeydue | 7 |
| name:Spendee | 6 |
| name:Empower | 5 |
| name:Money Manager | 4 |
| play:com.droid4you.application.wallet | 4 |
| name:PocketSmith | 3 |
| name:Zero-based budgeting | 3 |
| name:EveryDollar | 3 |
| name:Quicken Simplifi | 2 |
| name:Finny | 2 |
| apple:1447330651 | 2 |
| play:ke.co.theok.budgetpesa | 2 |
| name:HomeBank | 2 |
| name:GnuCash | 2 |

## Caveats

- claude-search: 2 failed call(s) [rate_limited] — excluded from rates, not counted as "not mentioned".

_Mention = name/alias as a whole word or a store link. Position = list item number when the answer is a list. Nothing here is a market share: it is how often these engines named the app for these prompts on this day._
