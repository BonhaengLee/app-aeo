## Reliability gate

_A number is RELIABLE only if R1–R3 all pass. Thresholds were fixed before any run; INDETERMINATE is never a pass._

| Engine | Mode | Answers (repeats) | Verdict | R1 rate reliability ≥ 0.8 | R2 precision ± ≤ 0.10 | R3 coding κ ≥ 0.8 |
|---|---|---|---|---|---|---|
| codex-search | search | 200 (2) | **RELIABLE** | ✅ 1.00 | ✅ 0.09 | ✅ 1.00 |
| claude-search | search | 200 (2) | **RELIABLE** | ✅ 1.00 | ✅ 0.09 | ✅ 1.00 |

# App AEO report — Babbel

Run 2026-10-09T23:51:02.645Z → 2026-10-09T23:57:12.050Z · 100 prompts · 400 answers · 0 failed calls

## By answer engine

| Engine | Mode | Model | Prompts × answers | Mention rate (95% CI over prompts) | Same answer on repeat | Avg position | Store link | Share of voice | Failed |
|---|---|---|---|---|---|---|---|---|---|
| claude-search | search | claude-opus-4-6[1m] | 100 × 200 | 50% (41%–60%) | 92% (92/100) | 2.6 | 0 | 27% | 0 |
| codex-search | search | — | 100 × 200 | 45% (35%–54%) | 93% (93/100) | 1.6 | 0 | 30% | 0 |

_Mode: **search** = answer grounded in a live web search (closest to consumer chat apps) · **memory** = model knowledge only · **agent** = coding-agent CLI. Interval = bootstrap over prompts, so repeats do not fake precision._

## Competitors (mention rate per engine)

| App | claude-search | codex-search |
|---|---|---|
| **Babbel** | 50% @2.6 | 45% @1.6 |
| Duolingo | 92% @1.9 | 69% @1.4 |
| Busuu | 46% @3.3 | 35% @1.9 |

## Prompts where at least one answer left the app out

| Prompt | Mentioned / answers |
|---|---|
| language learning app free | 0/4 |
| language learning app for kids | 0/4 |
| language learning app that doesn't use ai | 0/4 |
| language learning app with an owl mascot | 0/4 |
| duolingo alternatives free | 0/4 |
| busuu free alternative | 0/4 |
| language learning app for bengali | 0/4 |
| best language learning app chinese | 0/4 |
| language learning app for couples | 0/4 |
| best language learning app for korean | 0/4 |
| language learning app for hindi | 0/4 |
| best language learning app hindi | 0/4 |
| language learning app for latin | 0/4 |
| best language learning app mandarin | 0/4 |
| language learning app owl | 0/4 |
| language learning app for netflix | 0/4 |
| language learning apps for welsh | 0/4 |
| best language learning apps free | 0/4 |
| language learning app free no ai | 0/4 |
| is busuu free | 0/4 |
| language learning app for arabic | 0/4 |
| language learning app for children | 0/4 |
| best language learning app free | 0/4 |
| language learning app for greek | 0/4 |
| best language learning app greek | 0/4 |
| language learning app for hebrew | 0/4 |
| language learning app for irish | 0/4 |
| best language learning app kids | 0/4 |
| language learning app for kids free | 0/4 |
| language learning app for mandarin | 0/4 |
| language learning app for thai | 0/4 |
| best language learning app that is free | 0/4 |
| language learning apps for ukrainian | 0/4 |
| best language learning app for welsh | 0/4 |
| language learning app for japanese | 0/4 |
| language learning apps no ai free | 0/4 |
| language learning app with blue cat | 0/4 |
| is busuu free good | 0/4 |
| duolingo alternatives for japanese | 0/4 |
| best language learning app arabic | 0/4 |
| language learning app for afrikaans | 0/4 |
| language learning app without ai | 1/4 |
| language learning app for malayalam | 1/4 |
| language learning app for speaking | 1/4 |
| language learning app that insults you | 1/4 |
| language learning app for driving | 1/4 |
| language learning app for reading | 1/4 |
| language learning app free with library card | 1/4 |
| best language learning app ai | 2/4 |
| language learning app for english | 2/4 |
| best language learning app russian | 2/4 |
| language learning app for urdu | 2/4 |
| best language learning app duolingo | 2/4 |
| language learning apps for european portuguese | 2/4 |
| best language learning app hebrew | 2/4 |
| best language learning app using ai | 2/4 |
| best language learning app with ai | 2/4 |
| best language learning app portuguese | 3/4 |
| language learning app for travel | 3/4 |
| best language learning app without ai | 3/4 |
| language learning apps without subscription | 3/4 |
| language learning app like duolingo | 3/4 |
| best language learning app no ai | 3/4 |
| language learning app for portuguese | 3/4 |
| language learning app that roasts you | 3/4 |

## Apps the engines recommend that you did not list

| App (name or store id) | Answers |
|---|---|
| name:Pimsleur | 54 |
| name:Anki | 40 |
| name:Memrise | 34 |
| name:LingQ | 25 |
| name:Clozemaster | 24 |
| name:Mango Languages | 19 |
| name:Mondly | 16 |
| name:Drops | 15 |
| name:ELSA Speak | 13 |
| name:Language Transfer | 11 |
| name:Talkpal | 10 |
| name:HelloTalk | 10 |
| name:Lingopie | 8 |
| name:HelloChinese | 7 |
| name:Pleco | 7 |

_Mention = name/alias as a whole word or a store link. Position = list item number when the answer is a list. Nothing here is a market share: it is how often these engines named the app for these prompts on this day._
