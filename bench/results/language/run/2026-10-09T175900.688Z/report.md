## Reliability gate

_A number is RELIABLE only if R1–R3 all pass. Thresholds were fixed before any run; INDETERMINATE is never a pass._

| Engine | Mode | Answers (repeats) | Verdict | R1 rate reliability ≥ 0.8 | R2 precision ± ≤ 0.10 | R3 coding κ ≥ 0.8 |
|---|---|---|---|---|---|---|
| codex-search | search | 120 (2) | **NOT RELIABLE** | ✅ 0.99 | ❌ 0.12 (needs ~92 prompts) | ✅ 1.00 |
| claude-search | search | 120 (2) | **NOT RELIABLE** | ✅ 0.99 | ❌ 0.12 (needs ~89 prompts) | ✅ 1.00 |

# App AEO report — Babbel

Run 2026-10-09T17:59:00.689Z → 2026-10-09T18:27:05.372Z · 60 prompts · 240 answers · 0 failed calls

## By answer engine

| Engine | Mode | Model | Prompts × answers | Mention rate (95% CI over prompts) | Same answer on repeat | Avg position | Store link | Share of voice | Failed |
|---|---|---|---|---|---|---|---|---|---|
| claude-search | search | claude-opus-4-6[1m] | 60 × 120 | 54% (43%–67%) | 92% (55/60) | 2.7 | 0 | 27% | 0 |
| codex-search | search | — | 60 × 120 | 48% (37%–61%) | 93% (56/60) | 1.5 | 0 | 30% | 0 |

_Mode: **search** = answer grounded in a live web search (closest to consumer chat apps) · **memory** = model knowledge only · **agent** = coding-agent CLI. Interval = bootstrap over prompts, so repeats do not fake precision._

## Competitors (mention rate per engine)

| App | claude-search | codex-search |
|---|---|---|
| **Babbel** | 54% @2.7 | 48% @1.5 |
| Duolingo | 93% @2.1 | 69% @1.5 |
| Busuu | 53% @3.6 | 43% @1.8 |

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
| best language learning app portuguese | 3/4 |
| language learning app for travel | 3/4 |
| best language learning app without ai | 3/4 |
| language learning apps without subscription | 3/4 |

## Apps the engines recommend that you did not list

| App (name or store id) | Answers |
|---|---|
| name:Pimsleur | 34 |
| name:Anki | 29 |
| name:Memrise | 28 |
| name:LingQ | 18 |
| name:Clozemaster | 16 |
| name:Mango Languages | 12 |
| name:Drops | 11 |
| name:Mondly | 10 |
| name:ELSA Speak | 9 |
| name:Language Transfer | 7 |
| name:HelloTalk | 7 |
| name:Lingopie | 5 |
| name:Praktika | 5 |
| name:Talkpal | 4 |
| name:Rosetta Stone | 4 |

_Mention = name/alias as a whole word or a store link. Position = list item number when the answer is a list. Nothing here is a market share: it is how often these engines named the app for these prompts on this day._
