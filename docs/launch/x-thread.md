1/ "Does AI recommend my app?" AI answers change from run to run, so how many questions do you need before the number means anything? We pre-registered a benchmark to find out, and published every cell, failures included. 🧵

2/ The tool (open source, MIT):
- real search queries from Google autocomplete;
- Claude Code + Codex answering with live web search;
- counts how often your app is named.
No extra charges if you already have Claude Code or Codex. It does use your plan limits.

3/ A gate fixed before any data:
- R1 split-half reliability ≥ 0.8;
- R2 interval ±10 pp;
- R3 independent AI judge agrees with the extractor, κ ≥ 0.8.
If any check fails: NOT RELIABLE, plus how much more data it needs.

4/ Result at 60 prompts: only 2 of 8 cells were reliable. R1 and R3 passed everywhere. Precision was the problem.

5/ Then we gave each category the number of prompts the gate prescribed. 7 of 8 became reliable. The miss: Korean ran out of real queries at 43 (55 needed).

6/ Also:
- Claude vs Codex disagree hugely (budgeting: 63% vs 28%).
- "Do picks match real App Store usage?" was undecided: too few apps per category to test.
- 372 Claude answers hit the 5-hour session limit.

7/ {table image} · code, raw answers, pre-registration: {repo url}
