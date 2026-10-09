---
name: app-aeo
description: Measure and improve how often answer engines (ChatGPT, Claude, Perplexity, Gemini) recommend a specific mobile app for recommendation-style questions. Use when the user asks "does ChatGPT recommend my app", "AI visibility for my app", "app AEO/GEO", or wants to compare their app's AI mention rate with competitors.
---

# App AEO check

Use the `app-aeo` MCP tools (or the `app-aeo` CLI) — never estimate mention rates from memory.

## Workflow
1. **Identify the app.** Get the App Store id (or Play package). If only a name is given, call `search_app_store` and confirm the right result with the user. Use `lookup_app_store` for the exact title.
2. **Pick the brand name.** Store titles often start with a generic phrase ("Habit Tracker - HabitKit"). Match on the brand ("HabitKit") and put the full title in `aliases`. A generic alias inflates the rate.
3. **Pick 2–5 competitors** the user actually competes with (ask, or take top `search_app_store` results for the category).
4. **Build prompts.** Start from `suggest_aeo_prompts` (10 category prompts + 2 per competitor), then add the user's real use cases. Use at least 10 prompts. Write them in the language the user's customers ask in (`locale: "ko"` for Korean).
5. **Run** `run_app_aeo_check` with at least 2 engines. Keep `maxCalls` explicit (prompts × engines × repeats).
6. **Report** only what the run measured:
   - Give the mention rate with its 95% interval and n. With fewer than 30 answers per engine, say the interval is wide.
   - Failed calls are excluded from rates. Say how many failed and why.
   - List the prompts where the app was left out, and the unlisted apps the engines recommended instead.
7. **Improve.** Use `lint_app_listing` on the current listing. Suggestions must tie a missing prompt to a concrete listing or web change: name the feature the engines associate with the winners and check whether the app's description says it. Re-run with the **same prompt set** later and compare with `get_app_aeo_trend`.

## Guardrails
- A mention rate is not market share and not traffic. Do not translate it into installs or revenue.
- Answers vary between runs. Do not claim an improvement unless the new interval clears the old one, or the same prompt set was re-run with `repeats` ≥ 3.
- Do not change the prompt set and compare against the old trend. The trend output flags differing prompt sets.
