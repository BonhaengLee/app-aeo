# Causal study — results

Answers: 789 ok, 0 failed calls (retried; see results.jsonl). Answers that used web search: 24. Models: —.

| Hypothesis | Prompts | Sign test (+/n) | Holm p | Mean Δ (95% CI) | Verdict |
|---|---:|---|---:|---|---|
| H1: INSERT − PLACEBO | 33 | 5/6 | 0.2188 | +7.1 pp (+0.0 pp … +15.2 pp) | not supported |
| H2: PROMOTE − BASE | 36 | 5/5 | 0.0938 | +5.6 pp (+0.9 pp … +11.1 pp) | not supported |
| H3: ABLATE_LO − ABLATE_HI | 36 | 7/13 | 0.5000 | -3.7 pp (-18.5 pp … +10.2 pp) | not supported |

Pre-registered wording:

- **H1**: No evidence that adding an app to a page the engine read (vs a same-place placebo sentence) changes the rate in this setting.
- **H2**: No evidence that moving the sentence that names the app to the top of its page changes the rate in this setting.
- **H3**: No evidence that removing the page `diagnose` ranks higher by lift (vs removing the lower-ranked page) changes the rate in this setting.

By category (mean Δ):

| Hypothesis | budgeting | meditation | language |
|---|---:|---:|---:|
| H1 | +8.3 pp (n 12) | +18.5 pp (n 9) | -2.8 pp (n 12) |
| H2 | +2.8 pp (n 12) | +8.3 pp (n 12) | +5.6 pp (n 12) |
| H3 | -5.6 pp (n 12) | +0.0 pp (n 12) | -5.6 pp (n 12) |

Secondary (manipulation checks, two-sided, not corrected):

| Contrast | Prompts | Mean Δ (95% CI) | p |
|---|---:|---|---:|
| S1: PLACEBO − BASE | 40 | +2.5 pp (+0.0 pp … +6.7 pp) | 0.5000 |
| S2: INSERT − BASE | 40 | +6.7 pp (+1.7 pp … +13.3 pp) | 0.0625 |
| S3: ABLATE_HI − BASE | 40 | +0.8 pp (-7.5 pp … +10.0 pp) | 0.7539 |
