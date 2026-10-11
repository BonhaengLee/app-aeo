# App AEO report — Microsoft To Do

Run 2026-10-11T18:11:59.063Z → 2026-10-11T18:30:52.205Z · 100 prompts · 100 answers · 0 failed calls

## By answer engine

| Engine | Mode | Model | Prompts × answers | Mention rate (95% CI over prompts) | Same answer on repeat | Avg position | Store link | Share of voice | Failed |
|---|---|---|---|---|---|---|---|---|---|
| claude-search | search | claude-opus-4-6[1m] | 100 × 100 | 72% (63%–81%) | no repeats | 3.0 | 0 | 22% | 0 |

_Mode: **search** = answer grounded in a live web search (closest to consumer chat apps) · **memory** = model knowledge only · **agent** = coding-agent CLI. Interval = bootstrap over prompts, so repeats do not fake precision._

## Competitors (mention rate per engine)

| App | claude-search |
|---|---|
| **Microsoft To Do** | 72% @3.0 |
| Todoist | 92% @1.7 |
| Google Tasks | 64% @3.4 |
| Any.do | 24% @5.5 |
| TickTick | 79% @3.0 |

## Prompts where at least one answer left the app out

| Prompt | Mentioned / answers |
|---|---|
| cute todo list app | 0/1 |
| best todo list app adhd | 0/1 |
| to do list app for children | 0/1 |
| to do list app for autism | 0/1 |
| to do list app for phone | 0/1 |
| best to do list app google | 0/1 |
| best to do list app for lawyers | 0/1 |
| best to do list app that syncs with google calendar | 0/1 |
| best to do list app with subtasks | 0/1 |
| daily to do list app for kids | 0/1 |
| best to do list app iphone widget | 0/1 |
| to do list app for neurodivergent | 0/1 |
| to do list app for friends | 0/1 |
| best to do list app with voice | 0/1 |
| best todo list app with calendar | 0/1 |
| to do list app with eisenhower matrix | 0/1 |
| to do list app for business | 0/1 |
| how to organize your to do list | 0/1 |
| todo list app html css js | 0/1 |
| to do list app for people with adhd | 0/1 |
| todo list app for family | 0/1 |
| best todo list app linux | 0/1 |
| todo list app requirements | 0/1 |
| to do list app for apple watch | 0/1 |
| todo list app using html css and javascript | 0/1 |
| todo list app open source | 0/1 |
| todo list app with notes | 0/1 |
| best to do list app open source | 0/1 |

## Apps the engines recommend that you did not list

| App (name or store id) | Answers |
|---|---|
| name:Notion | 6 |
| name:Apple Reminders | 6 |
| name:Things 3 | 6 |
| name:No frills | 4 |
| name:Motion | 3 |
| name:Sunsama | 3 |
| name:Dribbble | 3 |
| name:Highly flexible | 2 |
| name:Offline access | 2 |
| name:Check your internet connection | 2 |
| name:Update the app | 2 |
| name:Reinstall the app | 2 |
| name:ClickUp | 2 |
| name:Google Keep | 2 |
| apple:1563126946 | 2 |

## Caveats

- claude-search: no repeats — run-to-run variation unknown. Use repeats ≥ 3 before comparing runs.
- claude-search: 2/100 answers had no search results behind them (search mode).

_Mention = name/alias as a whole word or a store link. Position = list item number when the answer is a list. Nothing here is a market share: it is how often these engines named the app for these prompts on this day._
