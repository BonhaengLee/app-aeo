## Reliability gate

_A number is RELIABLE only if R1–R3 all pass. Thresholds were fixed before any run; INDETERMINATE is never a pass._

| Engine | Mode | Answers (repeats) | Verdict | R1 rate reliability ≥ 0.8 | R2 precision ± ≤ 0.10 | R3 coding κ ≥ 0.8 |
|---|---|---|---|---|---|---|
| codex-search | search | 140 (2) | **RELIABLE** | ✅ 1.00 | ✅ 0.10 | ✅ 1.00 |
| claude-search | search | 140 (2) | **RELIABLE** | ✅ 0.99 | ✅ 0.10 | ✅ 1.00 |

# App AEO report — Monarch Money

Run 2026-10-09T20:29:02.286Z → 2026-10-09T20:35:38.940Z · 70 prompts · 280 answers · 0 failed calls

## By answer engine

| Engine | Mode | Model | Prompts × answers | Mention rate (95% CI over prompts) | Same answer on repeat | Avg position | Store link | Share of voice | Failed |
|---|---|---|---|---|---|---|---|---|---|
| claude-search | search | claude-opus-4-6[1m] | 70 × 140 | 64% (53%–73%) | 79% (55/70) | 2.8 | 0 | 34% | 0 |
| codex-search | search | — | 70 × 140 | 28% (18%–38%) | 87% (61/70) | 2.0 | 4 | 29% | 0 |

_Mode: **search** = answer grounded in a live web search (closest to consumer chat apps) · **memory** = model knowledge only · **agent** = coding-agent CLI. Interval = bootstrap over prompts, so repeats do not fake precision._

## Competitors (mention rate per engine)

| App | claude-search | codex-search |
|---|---|---|
| **Monarch Money** | 64% @2.8 | 28% @2.0 |
| YNAB | 90% @2.3 | 61% @1.2 |
| Rocket Money | 34% @3.3 | 8% @1.5 |

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
| best budgeting app eu | 0/4 |
| budgeting app for europeans | 0/4 |
| best budget grocery app | 0/4 |
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
| best budgeting app free | 2/4 |
| budgeting app for freelancers | 2/4 |
| budgeting app for girls | 2/4 |
| best budgeting app ireland | 2/4 |
| budgeting app that links to bank account | 3/4 |
| budgeting app for adhd | 3/4 |
| budgeting app for household | 3/4 |
| budgeting app for iphone | 3/4 |
| budgeting app for macbook | 3/4 |
| best budgeting app or spreadsheet | 3/4 |
| best budgeting app for overspenders | 3/4 |
| budgeting app for women | 3/4 |
| best budgeting app dollarwise | 3/4 |
| best budget app household | 3/4 |

## Apps the engines recommend that you did not list

| App (name or store id) | Answers |
|---|---|
| name:Goodbudget | 20 |
| name:Honeydue | 12 |
| name:Spendee | 8 |
| name:Empower | 7 |
| name:PocketGuard | 7 |
| name:Money Manager | 4 |
| name:Zero-based budgeting | 4 |
| apple:486312413 | 4 |
| play:com.droid4you.application.wallet | 4 |
| name:EveryDollar | 4 |
| name:PocketSmith | 3 |
| name:Finny | 3 |
| name:Revolut | 3 |
| name:Snoop | 3 |
| name:Privacy | 3 |

## Caveats

- claude-search: only 79% of prompts gave the same yes/no across repeats — single answers from this engine are noisy.

_Mention = name/alias as a whole word or a store link. Position = list item number when the answer is a list. Nothing here is a market share: it is how often these engines named the app for these prompts on this day._
