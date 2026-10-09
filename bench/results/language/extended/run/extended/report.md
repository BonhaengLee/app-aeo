## Reliability gate

_A number is RELIABLE only if R1–R3 all pass. Thresholds were fixed before any run; INDETERMINATE is never a pass._

| Engine | Mode | Answers (repeats) | Verdict | R1 rate reliability ≥ 0.8 | R2 precision ± ≤ 0.10 | R3 coding κ ≥ 0.8 |
|---|---|---|---|---|---|---|
| codex-search | search | 200 (2) | **INDETERMINATE** | ✅ 1.00 | ✅ 0.09 | ⚪ — (judge produced no usable codes) |
| claude-search | search | 120 (2) | **NOT RELIABLE** | ✅ 0.99 | ❌ 0.12 (needs ~91 prompts) | ⚪ — (judge produced no usable codes) |

# App AEO report — Babbel

Run 2026-10-09T18:48:19.036Z → 2026-10-09T18:53:11.173Z · 100 prompts · 320 answers · 3 failed calls

## By answer engine

| Engine | Mode | Model | Prompts × answers | Mention rate (95% CI over prompts) | Same answer on repeat | Avg position | Store link | Share of voice | Failed |
|---|---|---|---|---|---|---|---|---|---|
| claude-search | search | claude-opus-4-6[1m] | 60 × 120 | 54% (43%–67%) | 92% (55/60) | 2.7 | 0 | 27% | 3 |
| codex-search | search | — | 100 × 200 | 45% (35%–54%) | 93% (93/100) | 1.6 | 0 | 30% | 0 |

_Mode: **search** = answer grounded in a live web search (closest to consumer chat apps) · **memory** = model knowledge only · **agent** = coding-agent CLI. Interval = bootstrap over prompts, so repeats do not fake precision._

## Competitors (mention rate per engine)

| App | claude-search | codex-search |
|---|---|---|
| **Babbel** | 54% @2.7 | 45% @1.6 |
| Duolingo | 93% @2.1 | 69% @1.4 |
| Busuu | 53% @3.6 | 35% @1.9 |

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
| language learning apps for european portuguese | 0/2 |
| best language learning app free | 0/2 |
| language learning app for greek | 0/2 |
| best language learning app greek | 0/2 |
| best language learning app hebrew | 0/2 |
| language learning app for hebrew | 0/2 |
| language learning app for irish | 0/2 |
| best language learning app kids | 0/2 |
| language learning app for kids free | 0/2 |
| language learning app for mandarin | 0/2 |
| language learning app for reading | 0/2 |
| language learning app for thai | 0/2 |
| best language learning app that is free | 0/2 |
| language learning apps for ukrainian | 0/2 |
| best language learning app for welsh | 0/2 |
| language learning app for japanese | 0/2 |
| language learning app free with library card | 0/2 |
| language learning apps no ai free | 0/2 |
| language learning app with blue cat | 0/2 |
| is busuu free good | 0/2 |
| duolingo alternatives for japanese | 0/2 |
| best language learning app arabic | 0/2 |
| language learning app for afrikaans | 0/2 |
| language learning app without ai | 1/4 |
| language learning app for malayalam | 1/4 |
| language learning app for speaking | 1/4 |
| language learning app that insults you | 1/4 |
| language learning app for driving | 1/4 |
| best language learning app ai | 2/4 |
| language learning app for english | 2/4 |
| best language learning app russian | 2/4 |
| language learning app for urdu | 2/4 |
| best language learning app duolingo | 2/4 |
| language learning app like duolingo | 1/2 |
| language learning app for portuguese | 1/2 |
| language learning app that roasts you | 1/2 |
| best language learning app portuguese | 3/4 |
| language learning app for travel | 3/4 |
| best language learning app without ai | 3/4 |
| language learning apps without subscription | 3/4 |

## Apps the engines recommend that you did not list

| App (name or store id) | Answers |
|---|---|
| name:Pimsleur | 42 |
| name:Anki | 32 |
| name:Memrise | 30 |
| name:LingQ | 22 |
| name:Mango Languages | 17 |
| name:Clozemaster | 16 |
| name:Drops | 11 |
| name:ELSA Speak | 10 |
| name:Mondly | 10 |
| name:Language Transfer | 9 |
| name:HelloTalk | 7 |
| name:Talkpal | 6 |
| name:Rosetta Stone | 5 |
| name:HelloChinese | 5 |
| name:Pleco | 5 |

## Caveats

- claude-search: 3 failed call(s) [rate_limited] — excluded from rates, not counted as "not mentioned".

_Mention = name/alias as a whole word or a store link. Position = list item number when the answer is a list. Nothing here is a market share: it is how often these engines named the app for these prompts on this day._
