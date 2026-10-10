## Reliability gate

_A number is RELIABLE only if R1–R3 all pass. Thresholds were fixed before any run; INDETERMINATE is never a pass._

| Engine | Mode | Answers (repeats) | Verdict | R1 rate reliability ≥ 0.8 | R2 precision ± ≤ 0.10 | R3 coding κ ≥ 0.8 |
|---|---|---|---|---|---|---|
| codex-search | search | 172 (4) | **NOT RELIABLE** | ✅ 1.00 | ❌ 0.11 (needs ~55 prompts) | ✅ 0.95 |
| claude-search | search | 86 (2) | **RELIABLE** | ✅ 1.00 | ✅ 0.10 | ✅ 0.98 |

# App AEO report — 편한가계부

Run 2026-10-10T00:03:58.208Z → 2026-10-10T00:10:04.490Z · 43 prompts · 258 answers · 0 failed calls

## By answer engine

| Engine | Mode | Model | Prompts × answers | Mention rate (95% CI over prompts) | Same answer on repeat | Avg position | Store link | Share of voice | Failed |
|---|---|---|---|---|---|---|---|---|---|
| claude-search | search | claude-opus-4-6[1m] | 43 × 86 | 85% (74%–94%) | 93% (40/43) | 2.3 | 2 | 36% | 0 |
| codex-search | search | — | 43 × 172 | 69% (58%–80%) | 65% (28/43) | 1.4 | 25 | 47% | 0 |

_Mode: **search** = answer grounded in a live web search (closest to consumer chat apps) · **memory** = model knowledge only · **agent** = coding-agent CLI. Interval = bootstrap over prompts, so repeats do not fake precision._

## Competitors (mention rate per engine)

| App | claude-search | codex-search |
|---|---|---|
| **편한가계부** | 85% @2.3 | 69% @1.4 |
| 뱅크샐러드 | 92% @1.4 | 61% @1.6 |
| 위플 가계부 | 62% @2.7 | 16% @2.0 |

## Prompts where at least one answer left the app out

| Prompt | Mentioned / answers |
|---|---|
| 가계부 앱 미국 | 0/6 |
| 미국 가계부 앱 추천 | 0/6 |
| 가계부 앱 만들기 | 1/6 |
| 가계부 앱 디자인 | 1/6 |
| 광고 없는 간단한 가계부 앱 있어? | 1/6 |
| 가계부 앱 더쿠 | 2/6 |
| 가계부 앱 카드 연동 | 2/6 |
| 오프라인에서도 되는 가계부 앱 있어? | 2/6 |
| 뱅크샐러드 대신 쓸 만한 앱 있어? | 2/6 |
| 가계부 어플 만들기 | 3/6 |
| 부부 가계부 어플 추천 | 3/6 |
| 뱅크샐러드보다 나은 앱 있어? | 3/6 |
| 가계부 앱 디시 | 4/6 |
| 가계부 어플 더쿠 | 4/6 |
| 가계부 어플 공유 | 4/6 |
| 애플 가계부 앱 추천 | 4/6 |
| 가계부 어플 디시 | 5/6 |
| 아이폰 가계부 어플 추천 디시 | 5/6 |
| 갤럭시 가계부 어플 추천 | 5/6 |
| 위젯 좋은 가계부 앱 추천해줘. | 5/6 |
| 2026년 가계부 앱 순위 알려줘. | 5/6 |
| 위플 가계부보다 나은 앱 있어? | 5/6 |

## Apps the engines recommend that you did not list

| App (name or store id) | Answers |
|---|---|
| apple:1320730220 | 30 |
| play:com.rainist.banksalad2 | 28 |
| apple:6752123281 | 19 |
| apple:954944283 | 16 |
| play:com.realbyteapps.moneymanagerfree | 15 |
| apple:6444122615 | 14 |
| apple:441683476 | 14 |
| apple:6459790014 | 12 |
| name:토스 | 10 |
| apple:6743646049 | 9 |
| apple:6743708760 | 8 |
| name:무료 vs 유료 | 7 |
| name:SMS 자동 인식 | 6 |
| name:자동 연동 vs 수동 입력 | 5 |
| name:장점 | 5 |

## Caveats

- codex-search: only 65% of prompts gave the same yes/no across repeats — single answers from this engine are noisy.

_Mention = name/alias as a whole word or a store link. Position = list item number when the answer is a list. Nothing here is a market share: it is how often these engines named the app for these prompts on this day._
