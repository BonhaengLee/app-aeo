# App AEO report — Microsoft To Do

Run 2026-10-11T17:31:50.271Z → 2026-10-11T18:10:29.814Z · 100 prompts · 200 answers · 0 failed calls

## By answer engine

| Engine | Mode | Model | Prompts × answers | Mention rate (95% CI over prompts) | Same answer on repeat | Avg position | Store link | Share of voice | Failed |
|---|---|---|---|---|---|---|---|---|---|
| claude-search | search | claude-opus-4-6[1m] | 100 × 200 | 66% (58%–74%) | 78% (78/100) | 3.3 | 1 | 21% | 0 |

_Mode: **search** = answer grounded in a live web search (closest to consumer chat apps) · **memory** = model knowledge only · **agent** = coding-agent CLI. Interval = bootstrap over prompts, so repeats do not fake precision._

## Competitors (mention rate per engine)

| App | claude-search |
|---|---|
| **Microsoft To Do** | 66% @3.3 |
| Todoist | 90% @1.9 |
| Google Tasks | 57% @3.2 |
| Any.do | 34% @5.6 |
| TickTick | 72% @2.8 |

## Prompts where at least one answer left the app out

| Prompt | Mentioned / answers |
|---|---|
| todo list app for adhd | 0/2 |
| best todo list app for couples | 0/2 |
| best to do list app ipad pencil | 0/2 |
| best to do list app for apple ecosystem | 0/2 |
| to do list app for adhd adults | 0/2 |
| todo list app game | 0/2 |
| to do list app for discord | 0/2 |
| best todo list app for ubuntu | 0/2 |
| to do list app for google calendar | 0/2 |
| best to do list app cute | 0/2 |
| best to do list app for people with adhd | 0/2 |
| to do list app for multiple users | 0/2 |
| todo list app for kids | 0/2 |
| todo list app for couples | 0/2 |
| to do list app like a game | 0/2 |
| best to do list app that integrates with google calendar | 0/2 |
| best to do list app sync with google calendar | 0/2 |
| todo list app background image | 0/2 |
| best to do list app for kids | 0/2 |
| best to do list app for procrastinators | 0/2 |
| to do list app for lock screen | 0/2 |
| todo list app using javascript | 0/2 |
| task list app for adhd | 0/2 |
| best to do list app calendar | 1/2 |
| todo list app with widget | 1/2 |
| to do list app for sharing | 1/2 |
| to do list app for home | 1/2 |
| todo list app with calendar | 1/2 |
| best to do list app for home screen | 1/2 |
| task list app for teams | 1/2 |
| to do list app extension | 1/2 |
| best to do list app with google calendar | 1/2 |
| best to do list app on ipad | 1/2 |
| to do list app name ideas | 1/2 |
| best to do list app for multiple users | 1/2 |
| best to do list app for home | 1/2 |
| to do list app for study | 1/2 |
| best to do list diary app | 1/2 |
| best to do list app teams | 1/2 |
| to do list app for teams | 1/2 |
| todo list app for linux | 1/2 |
| best task list sharing app | 1/2 |
| to do list app for iphone widget | 1/2 |
| to do list app for google | 1/2 |
| best to do list app that works with siri | 1/2 |

## Apps the engines recommend that you did not list

| App (name or store id) | Answers |
|---|---|
| name:Notion | 13 |
| name:Trello | 10 |
| name:Things 3 | 8 |
| name:Superlist | 8 |
| name:Motion | 7 |
| name:Sunsama | 7 |
| name:Morningmate | 7 |
| apple:6468378915 | 5 |
| name:Apple Reminders | 5 |
| name:Two-way sync | 5 |
| apple:1545738155 | 4 |
| name:ClickUp | 4 |
| name:Wrike | 4 |
| name:Team size | 4 |
| name:Microsoft Planner | 4 |

## Caveats

- claude-search: only 78% of prompts gave the same yes/no across repeats — single answers from this engine are noisy.
- claude-search: 1/200 answers had no search results behind them (search mode).

_Mention = name/alias as a whole word or a store link. Position = list item number when the answer is a list. Nothing here is a market share: it is how often these engines named the app for these prompts on this day._
