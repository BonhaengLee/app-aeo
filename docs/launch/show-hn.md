# Show HN: Does AI recommend your app? A free, self-validating measurement (app-aeo)

App developers keep asking whether ChatGPT or Claude recommends their app. The tools that exist track websites, and most report a single "AI visibility score" with no error bars.

app-aeo works like this:
- It asks the questions people actually search for (60 Google-autocomplete queries per category).
- It sends them to Claude and Codex **with live web search**, so it's free inside a plan you already have.
- It counts how often your app is named, by name or store link.
- It **won't call the number reliable unless it passes three checks** we fixed before collecting any data:
  1. split-half reliability ≥ 0.8;
  2. a ±10 pp confidence interval over prompts;
  3. an independent LLM judge agreeing with the extractor (κ ≥ 0.8).

We pre-registered a benchmark of 4 categories × 2 engines and published every cell. The numbers below are measured, not assumed: {H1 result} cells came out RELIABLE, {H2}, {H3}.

Things that surprised us:
- {e.g. Claude named Insight Timer in X% of answers, Codex in Y%. Engines disagree a lot, so never pool them.}
- Out of the box, Codex answered "habit tracker app for iphone" by offering to *build* one. Without a role instruction it searched in only 34/80 answers.
- Without web search, the picks were reproducible but did **not** track real App Store usage (ρ = −0.20). With search, Claude's picks did (ρ = 0.91).

What it can't tell you, and says so:
- whether the consumer ChatGPT app shows the same thing;
- whether improving your listing moves the rate;
- whether the rate moves installs.

Code, raw answers, methodology: {repo url}. MIT, zero dependencies. There's an MCP server and Agent Skills, so your coding agent can run it for you.
