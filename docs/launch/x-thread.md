1/ "Does ChatGPT recommend my app?" Every indie dev asks this now. We built a free tool that measures it, and that refuses to give you a number it can't stand behind. 🧵

2/ How it works:
- 60 real search queries per category, from Google autocomplete.
- Claude and Codex, each answering with live web search.
- It counts how often your app gets named.
- $0 if you already have Claude Code or Codex.

3/ The part we care about: a pre-registered reliability gate.
- R1: split-half reliability ≥ 0.8.
- R2: CI ±10 pp.
- R3: an independent AI judge agrees with the extractor, κ ≥ 0.8.
Fail any of them and the report says NOT RELIABLE, and how much more data it needs.

4/ Benchmark: 4 categories × 2 engines, all cells published. {table image}

5/ Lessons:
- Engines disagree hugely ({X}% vs {Y}%).
- Without web search, the picks don't track real usage.
- Codex will try to *build* you the app unless told otherwise.

6/ MIT, zero deps, CLI + MCP + skills: {repo url}
