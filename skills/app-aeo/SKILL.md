---
name: app-aeo
description: Measure how often AI assistants recommend a specific mobile app for real recommendation questions, compare with competitors, check whether the measurement is trustworthy, then diagnose why the app is missed (which pages engines read, coverage vs selection) and verify fixes before/after — for free, using the user's own Claude Code / Codex web search plus optional free-tier API keys. Use when the user asks "does ChatGPT/AI recommend my app", "AI visibility / AEO / GEO for my app", why AI suggests competitors instead, or what to do about it.
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
   - The prompts come from real Google autocomplete queries, 100 by default. In the benchmark, 60 prompts were too few for a ±10 pp interval in 6 of 8 cells.
   - The engines come from `doctor`. `repeats` is 2.
   - If `init` warns that it found fewer than 100 prompts (common for Korean), ask the user for their users' real questions and add them.
3. Open `cfg.json`. Check that `target.name` is the **brand** ("HabitKit", not "Habit Tracker").
4. Tell the user the cost before running: `app-aeo check cfg.json --dry-run` prints the number of calls. These use their Claude Code / Codex plan limits. In the benchmark, about 370 Claude answers reached the 5-hour session limit.

## 3. Measure with the gate
Run `app-aeo check cfg.json --gate`. It measures, adds repeats while R1 is short, runs the independent judge audit, and prints one verdict per engine:
- **RELIABLE**: R1 split-half reliability ≥ 0.80, R2 interval ±10 pp or tighter, R3 judge κ ≥ 0.80.
- **NOT RELIABLE**: the gate prints how many more prompts (R2) or repeats (R1) it needs.
- **INDETERMINATE**: something could not be measured (e.g. the judge failed). Never treat it as a pass.

Optional usage check: `app-aeo validate <run> --popularity --engine <spec>` compares the engine's picks with App Store rating counts. With fewer than ~10 frequently named apps it has little power; the benchmark could not decide it in 7 of 8 cells. Report it, but don't lean on it.

## 4. Report — rules
- Lead with the gate verdict per engine. Only give a mention rate as a finding if that engine is RELIABLE. Otherwise show it labelled NOT RELIABLE, with what more data it needs.
- Give the target's mention rate per engine with its interval. Say which mode each engine is in: search, rag or memory.
- If the usage check failed or was too small, say so. Rates can still be compared over time, but don't call them market signals.
- Show the prompts where the app was missing, and the apps recommended instead (with the sources engines cited, if any).
- **Never:**
  - turn a mention rate into installs, revenue or market share;
  - claim an improvement without the same prompt set and repeats;
  - mix modes into one number;
  - present `rag` or memory engines as "what ChatGPT says".

## 5. Find the cause: `diagnose`
Run `app-aeo diagnose <run-dir> --fetch 40 --store` (or `--listing listing.json`). It needs search engines (`claude-search`, `codex-search`); runs made before 0.4.0 have no Claude sources. Reddit pages take about a minute each (its rate limit), so 40 pages can take 10–20 minutes.

It sorts every answer that missed the app into one cause, per engine:
- **coverage**: none of the pages the engine read lists the app (at least half checked). Fix: get onto those pages.
- **coverage?**: same, but fewer than half of those pages were checked. Say "likely", not "is".
- **selection**: a page it read lists the app, and it still picked others. Fix: how those pages describe the app, and the question words below.
- **ungrounded**: no search, so the answer came from memory. Only broad awareness moves this, slowly.
- **unknown**: the pages were not checked. Never turn this into coverage or selection.

Report from the tables, as given:
1. **Get listed**: often-read pages that name competitors but not the app, with the "How" column. Earned media dominates AI answers (Chen et al. 2025, arXiv 2509.08919).
2. **Fix presentation** and **Working**. "Working" pages raise the rate within the same prompts. Suggest finding more pages like them.
3. **Questions you lose**: prompt words with a lower rate, and whether the listing says them. This is where `app-aeo lint` and listing edits apply.

Rules:
- Own pages (the app's site and store page) are read *after* the engine has decided. Never present them as a lever.
- Never suggest paid or fake reviews, undisclosed self-promotion, or editing Wikipedia about the app. Sites remove them, and they can get the app delisted.

## 6. Act, then prove it: `diff`
- Change **one** thing, and wait for it to be indexed: an edited article is usually re-crawled in days to weeks.
- Re-run the **same** `cfg.json`, then run `app-aeo diff <before> <after>`. It gives a paired-by-prompt Δ with a 95% CI.
- Call it an effect only if the CI excludes 0 **and** competitors did not move the same way. If they did, the engine drifted.
- `app-aeo trend` shows the history.
