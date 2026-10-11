# Comparison study — results

Protocol: [`PREREGISTRATION.md`](PREREGISTRATION.md). Every cluster reported.

| Claim | Sign test (pos / n) | p | Holm p | Δ RMSE (95% CI) | Supported | Reverse (rival closer) Holm p |
|---|---|---|---|---|---|---|
| T closer than E | 14 / 14 | 0.0001 | 0.0002 | 0.107 (0.081 – 0.136) | ✅ | 1.0000 |
| T closer than N | 10 / 10 | 0.0010 | 0.0010 | 0.130 (0.086 – 0.177) | ✅ | 1.0000 |
| T closer than M5 | 14 / 14 | 0.0001 | 0.0002 | 0.093 (0.067 – 0.118) | ✅ | 1.0000 |

MAE: T 0.032 · E 0.130 · N 0.127 · M5 0.097
Calibration of T (descriptive): 66 / 70 units within 1.96·√(SE_T²+SE_R²).

Imputation bounds for missing E/N (§3.2): best case E ✅ N ❌ M5 ✅ · worst case E ✅ N ✅ M5 ✅
Audit sensitivity (§6): E ✅ (Holm p 0.0002) · N ✅ (Holm p 0.0010) · M5 ✅ (Holm p 0.0002)

| Cluster | App | R | T | E | N | M5 |
|---|---|---|---|---|---|---|
| sleep-tracker/claude-search | BetterSleep | 0.07 | 0.18 | 0.10 | 0.15 | 0.20 |
| sleep-tracker/claude-search | ShutEye | 0.04 | 0.08 | 0.14 | 0.25 | 0.00 |
| sleep-tracker/claude-search | SleepWatch | 0.10 | 0.08 | 0.09 | 0.20 | 0.00 |
| sleep-tracker/claude-search | Pillow | 0.35 | 0.41 | 0.19 | 0.35 | 0.40 |
| sleep-tracker/claude-search | Rise | 0.05 | 0.03 | 0.06 | 0.30 | 0.00 |
| sleep-tracker/codex-search | BetterSleep | 0.00 | 0.00 | 0.24 | 0.00 | 0.00 |
| sleep-tracker/codex-search | ShutEye | 0.00 | 0.00 | 0.27 | 0.00 | 0.00 |
| sleep-tracker/codex-search | SleepWatch | 0.00 | 0.01 | 0.35 | 0.00 | 0.00 |
| sleep-tracker/codex-search | Pillow | 0.21 | 0.23 | 0.39 | 0.00 | 0.00 |
| sleep-tracker/codex-search | Rise | 0.01 | 0.01 | 0.18 | 0.00 | 0.00 |
| meal-planner/claude-search | MyFitnessPal | 0.19 | 0.19 | 0.27 | 0.60 | 0.00 |
| meal-planner/claude-search | Tasty | 0.00 | 0.00 | 0.07 | 0.15 | 0.00 |
| meal-planner/claude-search | ReciMe | 0.01 | 0.02 | 0.03 | 0.02 | 0.00 |
| meal-planner/claude-search | HelloFresh | 0.00 | 0.01 | 0.10 | 0.35 | 0.20 |
| meal-planner/claude-search | Mealime | 0.64 | 0.65 | 0.38 | 0.30 | 0.40 |
| meal-planner/codex-search | MyFitnessPal | 0.03 | 0.06 | 0.28 | 0.00 | 0.00 |
| meal-planner/codex-search | Tasty | 0.00 | 0.00 | 0.10 | 0.00 | 0.00 |
| meal-planner/codex-search | ReciMe | 0.00 | 0.00 | 0.25 | 0.00 | 0.00 |
| meal-planner/codex-search | HelloFresh | 0.00 | 0.01 | 0.15 | 0.00 | 0.00 |
| meal-planner/codex-search | Mealime | 0.32 | 0.36 | 0.33 | 0.00 | 0.40 |
| period-tracker/claude-search | Flo | 0.63 | 0.69 | 0.69 | 0.85 | 0.40 |
| period-tracker/claude-search | Clue | 0.76 | 0.82 | 0.63 | 0.75 | 0.60 |
| period-tracker/claude-search | Stardust | 0.13 | 0.14 | 0.17 | 0.25 | 0.20 |
| period-tracker/claude-search | Eve by Glow | 0.00 | 0.00 | 0.09 | 0.12 | 0.00 |
| period-tracker/claude-search | Ovia | 0.05 | 0.11 | 0.12 | 0.30 | 0.00 |
| period-tracker/codex-search | Flo | 0.36 | 0.36 | 0.53 | 0.70 | 0.40 |
| period-tracker/codex-search | Clue | 0.60 | 0.60 | 0.45 | 0.75 | 0.60 |
| period-tracker/codex-search | Stardust | 0.13 | 0.07 | 0.32 | 0.45 | 0.00 |
| period-tracker/codex-search | Eve by Glow | 0.00 | 0.00 | 0.09 | 0.10 | 0.00 |
| period-tracker/codex-search | Ovia | 0.02 | 0.03 | 0.22 | 0.20 | 0.00 |
| fasting/claude-search | Fastic | 0.57 | 0.48 | 0.57 | — | 0.40 |
| fasting/claude-search | BodyFast | 0.16 | 0.24 | 0.37 | — | 0.40 |
| fasting/claude-search | FastEasy | 0.02 | 0.01 | 0.13 | — | 0.00 |
| fasting/claude-search | FastHabit | 0.55 | 0.56 | 0.28 | — | 0.60 |
| fasting/claude-search | Window | 0.06 | 0.03 | 0.15 | — | 0.00 |
| fasting/codex-search | Fastic | 0.34 | 0.30 | 0.42 | — | 0.60 |
| fasting/codex-search | BodyFast | 0.12 | 0.11 | 0.32 | — | 0.00 |
| fasting/codex-search | FastEasy | 0.00 | 0.00 | 0.21 | — | 0.00 |
| fasting/codex-search | FastHabit | 0.04 | 0.03 | 0.16 | — | 0.00 |
| fasting/codex-search | Window | 0.00 | 0.03 | 0.14 | — | 0.20 |
| workout-tracker/claude-search | MyFitnessPal | 0.43 | 0.42 | 0.24 | 0.30 | 0.60 |
| workout-tracker/claude-search | Fitbod | 0.30 | 0.43 | 0.24 | 0.15 | 0.80 |
| workout-tracker/claude-search | Gymverse | 0.00 | 0.00 | 0.04 | 0.01 | 0.00 |
| workout-tracker/claude-search | Liftoff | 0.00 | 0.00 | 0.03 | 0.01 | 0.00 |
| workout-tracker/claude-search | Hevy | 0.56 | 0.57 | 0.34 | 0.25 | 0.60 |
| workout-tracker/codex-search | MyFitnessPal | 0.03 | 0.03 | 0.22 | 0.00 | 0.00 |
| workout-tracker/codex-search | Fitbod | 0.18 | 0.17 | 0.29 | 0.27 | 0.20 |
| workout-tracker/codex-search | Gymverse | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 |
| workout-tracker/codex-search | Liftoff | 0.00 | 0.00 | 0.03 | 0.00 | 0.00 |
| workout-tracker/codex-search | Hevy | 0.42 | 0.48 | 0.39 | 0.28 | 0.60 |
| note-taking/claude-search | OneNote | 0.78 | 0.78 | 0.70 | 0.50 | 0.80 |
| note-taking/claude-search | Goodnotes | 0.57 | 0.55 | 0.50 | 0.30 | 0.20 |
| note-taking/claude-search | Notability | 0.44 | 0.49 | 0.43 | 0.25 | 0.20 |
| note-taking/claude-search | Notion | 0.76 | 0.63 | 0.48 | 0.75 | 0.80 |
| note-taking/claude-search | Otter | 0.10 | 0.07 | 0.09 | 0.10 | 0.00 |
| note-taking/codex-search | OneNote | 0.52 | 0.48 | 0.39 | — | 0.60 |
| note-taking/codex-search | Goodnotes | 0.31 | 0.32 | 0.31 | — | 0.00 |
| note-taking/codex-search | Notability | 0.12 | 0.14 | 0.25 | — | 0.20 |
| note-taking/codex-search | Notion | 0.35 | 0.27 | 0.46 | — | 0.40 |
| note-taking/codex-search | Otter | 0.09 | 0.02 | 0.13 | — | 0.00 |
| todo-list/claude-search | Microsoft To Do | 0.72 | 0.66 | 0.65 | 0.70 | 0.80 |
| todo-list/claude-search | Todoist | 0.92 | 0.90 | 0.77 | 0.90 | 0.80 |
| todo-list/claude-search | Google Tasks | 0.64 | 0.57 | 0.44 | 0.60 | 0.40 |
| todo-list/claude-search | Any.do | 0.24 | 0.34 | 0.49 | 0.45 | 0.40 |
| todo-list/claude-search | TickTick | 0.79 | 0.72 | 0.57 | 0.65 | 0.60 |
| todo-list/codex-search | Microsoft To Do | 0.42 | 0.41 | 0.45 | — | 0.40 |
| todo-list/codex-search | Todoist | 0.47 | 0.63 | 0.65 | — | 0.60 |
| todo-list/codex-search | Google Tasks | 0.16 | 0.18 | 0.40 | — | 0.40 |
| todo-list/codex-search | Any.do | 0.02 | 0.03 | 0.25 | — | 0.00 |
| todo-list/codex-search | TickTick | 0.28 | 0.34 | 0.55 | — | 0.20 |
