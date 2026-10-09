#!/usr/bin/env node
// Builds bench/BENCHMARK.md from bench/results/* — every pre-registered cell, whatever its verdict.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gateRun, latestRows } from '../src/run.mjs';
import { aggregate } from '../src/report.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const cats = JSON.parse(fs.readFileSync(path.join(here, 'categories.json'), 'utf8'));
const f = (x, d = 2) => (x == null || Number.isNaN(x) ? '—' : Number(x).toFixed(d));
const pct = (x) => (x == null ? '—' : `${(x * 100).toFixed(0)}%`);
const icon = (s) => ({ PASS: '✅', FAIL: '❌', INDETERMINATE: '⚪' }[s] ?? '⚪');

const cells = [];
const detail = [];
for (const c of cats) {
  const out = path.join(here, 'results', c.id);
  const runRoot = path.join(out, 'run');
  if (!fs.existsSync(runRoot)) { cells.push({ c, missing: true }); continue; }
  const dir = path.join(runRoot, fs.readdirSync(runRoot)[0]);
  const cfg = JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8'));
  const rows = latestRows(path.join(dir, 'responses.jsonl'));
  const gates = gateRun(dir, cfg);
  const agg = aggregate(rows, cfg);
  const validity = fs.existsSync(path.join(out, 'validity.json')) ? JSON.parse(fs.readFileSync(path.join(out, 'validity.json'), 'utf8')) : {};
  const audit = fs.existsSync(path.join(dir, 'audit.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'audit.json'), 'utf8')) : { byProvider: {} };
  for (const g of gates) {
    const p = agg.perProvider.find((x) => x.provider === g.provider);
    cells.push({ c, g, p, v: validity[g.provider], a: audit.byProvider?.[g.provider], failed: rows.filter((r) => !r.ok && r.provider === g.provider).length, cfg });
  }
  detail.push({ c, dir: path.relative(here, dir), cfg, agg });
}

const done = cells.filter((x) => !x.missing);
const reliable = done.filter((x) => x.g.status === 'RELIABLE').length;
const kappaOk = done.filter((x) => x.g.parts[2].status === 'PASS').length;
const validOk = done.filter((x) => x.v && x.v.rho != null && x.v.rho >= 0.5 && x.v.p < 0.05).length;

const L = [];
L.push('# Benchmark — app-aeo reliability and validity across 4 categories', '');
L.push('Protocol, thresholds and hypotheses were pre-registered in [`PREREGISTRATION.md`](PREREGISTRATION.md) and committed before any answer was collected. All cells are reported. Raw answers, audits and gates are in `results/`.', '');
L.push('## Summary', '');
L.push('| Hypothesis | Pre-registered criterion | Result |', '|---|---|---|');
L.push(`| H1 reliability is achievable | ≥ 6 of 8 cells RELIABLE within 4 repeats | **${reliable} / ${done.length}** ${reliable >= 6 ? '✅ supported' : '❌ not supported'} |`);
L.push(`| H2 extractor codes mentions correctly | every cell κ ≥ 0.80 | **${kappaOk} / ${done.length}** ${kappaOk === done.length ? '✅ supported' : '❌ not supported'} |`);
L.push(`| H3 picks track real usage | ≥ half of cells ρ ≥ 0.5, p < 0.05 | **${validOk} / ${done.length}** ${validOk * 2 >= done.length ? '✅ supported' : '❌ not supported'} |`);
L.push('');
L.push('## Cells', '');
L.push('| Category | Engine | Answers (repeats) | Grounded | Target rate (95% CI) | R1 rate reliability | R2 ± | R3 κ (agreement) | Verdict | Convergent ρ (p, n) |', '|---|---|---|---|---|---|---|---|---|---|');
for (const x of cells) {
  if (x.missing) { L.push(`| ${x.c.id} | — | not run | | | | | | ⚪ | |`); continue; }
  const [r1, r2, r3] = x.g.parts;
  const bp = x.p.target.byPrompt;
  L.push(`| ${x.c.id} (${x.c.country}) | ${x.g.provider} | ${x.g.answers} (${x.g.repeats})${x.failed ? ` +${x.failed} failed` : ''} | ${x.p.grounded}/${x.p.answers} | ${pct(bp.mean)} (${pct(bp.ci[0])}–${pct(bp.ci[1])}) | ${icon(r1.status)} ${f(r1.value)}${r1.coreApps != null ? ` [${r1.coreApps} apps]` : ''}${r1.status === 'INDETERMINATE' ? ` ${r1.reason}` : ''} | ${icon(r2.status)} ${f(r2.value)} | ${icon(r3.status)} ${f(r3.value)} (${x.a?.agreement == null ? '—' : pct(x.a.agreement)}) | **${x.g.status}** | ${x.v ? `${f(x.v.rho)} (${f(x.v.p, 3)}, ${x.v.n})` : '—'} |`);
}
L.push('');
L.push('## Per category', '');
for (const d of detail) {
  L.push(`### ${d.c.id} — target ${d.cfg.target.name}`, '');
  L.push(`Prompts: ${d.cfg.prompts.length} (${d.cfg.promptSources ? `${d.cfg.promptSources.autocomplete} from Google autocomplete` : 'see config'}). Run: \`${d.dir}\`.`, '');
  L.push('| App | ' + d.agg.perProvider.map((p) => p.provider).join(' | ') + ' |', '|---|' + d.agg.perProvider.map(() => '---').join('|') + '|');
  for (const app of d.agg.perProvider[0].apps) L.push(`| ${app.name === d.cfg.target.name ? `**${app.name}**` : app.name} | ${d.agg.perProvider.map((p) => { const a = p.apps.find((y) => y.name === app.name); return pct(a.rate); }).join(' | ')} |`);
  L.push('', 'Apps the engines recommended that were not in the config (top 8): ' + (d.agg.otherApps.slice(0, 8).map((o) => `${o.key.replace(/^name:/, '')} (${o.count})`).join(', ') || 'none'), '');
}
L.push('## Coding audit disagreements', '');
L.push('Every (answer, app) pair where the extractor and the independent judge disagreed, so readers can see who was right.', '');
let shown = 0;
for (const x of done) for (const d of x.a?.disagreements ?? []) { if (shown++ < 60) L.push(`- **${x.c.id} · ${x.g.provider} · ${d.app}** extractor=${d.extractor} judge=${d.judge} — “…${d.excerpt}…”`); }
if (!shown) L.push('None.');
const dev = path.join(here, 'DEVIATIONS.md');
L.push('', '## Deviations from the pre-registration', '', fs.existsSync(dev) ? fs.readFileSync(dev, 'utf8').trim() : 'None.', '');
fs.writeFileSync(path.join(here, 'BENCHMARK.md'), L.join('\n') + '\n');
console.log(`BENCHMARK.md: ${done.length} cells · RELIABLE ${reliable} · κ ok ${kappaOk} · validity ok ${validOk}`);
