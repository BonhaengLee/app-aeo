---
name: app-aeo
description: Measure how often AI assistants recommend a specific mobile app for real recommendation questions, compare with competitors, and check whether the measurement is trustworthy — for free, using the user's own Claude Code / Codex web search plus optional free-tier API keys. Use when the user asks "does ChatGPT/AI recommend my app", "AI visibility / AEO / GEO for my app", or why AI suggests competitors instead.
---

# App AEO — agent workflow

You (the agent) drive the `app-aeo` CLI (or the MCP tools of the same names). Never estimate mention rates yourself. Report only what the tool measured.

## 1. What is available here (free)
Run `app-aeo doctor` (add `--live` to ask each engine one tiny question).
- **`claude-search` / `codex-search`**: the user's own Claude Code or Codex answers with live web search. Free inside their existing plan. This is the primary signal.
- **Free-tier chains**: Groq, Cerebras, NVIDIA, OpenRouter `:free`, Gemini, Mistral, used if their keys are set. These answer from memory, or in `rag` mode when `TAVILY_API_KEY` is set (free 1,000 searches/month).
- If nothing is ready, tell the user which **one** free option is fastest for them (usually: log in to Codex or Claude Code), and stop.

## 2. Set up the measurement
1. Identify the app:
   - Find its App Store id with `app-aeo search "<name>"` and confirm it with the user if there are several.
   - Pick 2–5 real competitors with the user, or take the top results for the category.
2. Run `app-aeo init cfg.json --category "<category in the users' words>" --app-id <id> --competitor-id <id> ...`
   - The prompts come from real Google autocomplete queries.
   - The engines come from `doctor`. `repeats` is 2.
3. Open `cfg.json`. Check that `target.name` is the **brand** ("HabitKit", not "Habit Tracker"). Add the user's own real use-case questions if they have any. Keep 10 or more prompts.

## 3. Measure twice, then validate
Run `app-aeo check cfg.json --out runsA` and `app-aeo check cfg.json --out runsB`. They can run in parallel.

Then run `app-aeo validate runsA/<run> runsB/<run> --popularity --engine <spec>` for each search engine. It checks two things:
- **Test–retest**: do the two runs rank the frequently named apps the same way? (ρ ≥ 0.5, p < 0.05)
- **Convergent validity**: do the apps this engine recommends track real App Store usage (rating counts)?

## 4. Report — rules
- Lead with the target's mention rate per engine, with its interval. Say which mode each engine is in: search, rag or memory.
- State the validation verdicts **as they came out**:
  - If the retest failed, the numbers are noise. Say so and do not give advice from them.
  - If popularity failed, say the engine's picks don't track the real market for this category. Rates can still be compared over time, but don't call them market signals.
- Show the prompts where the app was missing, and the apps recommended instead (with the sources engines cited, if any).
- **Never:**
  - turn a mention rate into installs, revenue or market share;
  - claim an improvement without the same prompt set and repeats;
  - mix modes into one number;
  - present `rag` or memory engines as "what ChatGPT says".

## 5. Improve (optional)
- Run `app-aeo lint listing.json` on the current App Store text. It is deterministic.
- For each missing prompt, name the attribute the winning apps are cited for (free, no ads, Android, offline, …). Check whether the app's listing or website says it.
- Re-measure later with the **same** `cfg.json` and compare with `app-aeo trend`.
