# Launch kit — DRAFTS, not posted

Posting is outward-facing and irreversible, so it needs the owner's explicit go-ahead. Benchmark numbers are filled in from `bench/BENCHMARK.md` (2026-10-10). Only `{repo url}` and `{table image}` remain.

## Launch order (what tends to work for dev tools)
| When | Channel | Notes |
|---|---|---|
| Day 0, morning US | Show HN | Post the benchmark first and the tool second. Reply to every comment for 6 hours |
| Day 0 | r/iOSProgramming, r/androiddev, r/SideProject, r/SEO | One post per sub, adapted to each. No cross-post spam |
| Day 0 | X/Bluesky thread with the benchmark table image | Tag nobody unprompted |
| Day 1–3 | Product Hunt | Only if HN gets traction |
| Week 1 | PR the listing-lint skill to OpenSEO #256 | Only after the owner approves a comment |
| Ongoing | Community benchmark issues | "Share a category result" template |

## Why someone would star this (be honest in every post)
- **Evidence, not a pitch.** A pre-registered benchmark with every cell published, including the failed hypotheses (H1 2/8, H3 1/8 undecided). After extending prompts to the gate's prescription, 7/8 cells were RELIABLE. Source: `bench/BENCHMARK.md`.
- **Free inside a plan the user already has** (Claude Code or Codex). No extra charges, but it uses plan limits: 372 Claude answers hit the 5-hour session limit. Say this up front.
- **Open source and app-specific.** App Store id matching; raw answers are kept, so anyone can re-check. The commercial app-specific tool we found is AppTweak AI Visibility (ChatGPT + Gemini, demo-gated, no public price). Don't claim "the only one".
- **Says when not to trust the number.** The gate reports NOT RELIABLE and how much more data it needs.
- Zero dependencies, CLI + MCP + Agent Skills.

## Claims we must not make
- That it measures what the consumer ChatGPT or Gemini apps show. It measures Claude Code and Codex with web search.
- That AI picks track real usage. H3 was too small to decide; the earlier ρ = 0.91 was a single 7-app pilot.
- That a higher mention rate raises installs, or that listing edits raise the rate.
