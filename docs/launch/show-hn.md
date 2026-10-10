# Show HN: How many prompts before an "AI recommends your app" number is trustworthy? (app-aeo)

App developers now ask whether AI assistants recommend their app. Answers vary from run to run, so a single "AI visibility score" can mislead. We built an open-source tool that measures it and tells you when the number isn't trustworthy yet. Then we pre-registered a benchmark to test that claim, and we're publishing every cell, failures included.

How it works:
- It asks the questions people actually search for (Google autocomplete for the category).
- It sends them to Claude Code and Codex **with live web search**, inside a plan you already have. No extra charges, but it does use your plan limits.
- It counts how often your app is named, by name or App Store link.
- A gate fixed before data collection labels a result RELIABLE only if:
  1. split-half reliability ≥ 0.8;
  2. the interval over prompts is ±10 pp or tighter;
  3. an independent LLM judge agrees with the extractor (κ ≥ 0.8).
  Otherwise it says NOT RELIABLE and how much more data it needs.

Benchmark, 4 categories × 2 engines (pre-registered):
- H1 (≥ 6/8 cells RELIABLE): **failed, 2/8.** Reliability and coding passed in all 8 cells. Precision failed in 6: 60 prompts gave ±10–13 pp.
- H2 (extractor κ ≥ 0.8 in every cell): **passed, 8/8** (0.95–1.00). The judge did catch one bug first: "calm" counted as the app Calm.
- H3 (picks track App Store usage in ≥ half the cells): **failed, 1/8.** But 7 cells had only 3–6 frequently named apps, so the test had almost no power. We read it as undecided, not as evidence either way.
- Follow-up: we extended each category to the number of prompts the gate prescribed. **7/8 became RELIABLE.** The miss was Korean: autocomplete ran out at 43 queries against 55 needed.

So the practical answer to the title, for these categories: 60 prompts wasn't enough; roughly 70–100 was. The tool now defaults to 100.

Other things we found:
- Claude and Codex disagree a lot. Target mention rates: meditation 70% vs 43%, budgeting 63% vs 28%. Never pool engines.
- Out of the box, Codex answered "habit tracker app for iphone" by offering to *build* one.
- 372 Claude answers in 46 minutes hit the 5-hour session limit. "Free" means no extra charges, not unlimited.

What it can't tell you:
- whether the consumer ChatGPT or Gemini apps show the same thing (it measures Claude Code and Codex with search; for the consumer surfaces, commercial tools like AppTweak exist);
- whether improving your listing moves the rate;
- whether the rate moves installs.

Code, raw answers, pre-registration, deviations log: {repo url}. MIT, zero dependencies, with an MCP server and Agent Skills so your coding agent can run it.
