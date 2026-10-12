#!/usr/bin/env node
// Causal study, step 3 — the pre-registered analysis (PREREGISTRATION.md §6). Writes RESULTS.md and results.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { signTest, holm } from '../compare/analyze.mjs';
import { mulberry32 } from '../../src/report.mjs';
import { HYPOTHESES } from './build.mjs';
import { DOSE_HYPOTHESES } from './dose-build.mjs';
import { studyFiles } from './collect.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ALPHA = 0.05;
export const MIN_PROMPTS = 10;
export const B = 10_000;
export const SEED = 13;
export const SECONDARY = Object.freeze({ S1: ['PLACEBO', 'BASE'], S2: ['INSERT', 'BASE'], S3: ['ABLATE_HI', 'BASE'] });
export const LEVER = Object.freeze({
  H1: 'adding an app to a page the engine read (vs a same-place placebo sentence)',
  H2: 'moving the sentence that names the app to the top of its page',
  H3: "removing the page `diagnose` ranks higher by lift (vs removing the lower-ranked page)",
  H4: 'adding an app to every page the engine read (vs placebo sentences in the same places)',
});

const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;

/** Per (category, prompt, condition, subject app): share of ok answers that name the subject. */
export function rates(rows) {
  const m = new Map();
  // one answer per (job, repeat): a duplicate line (e.g. two collectors) must not count twice
  const seen = new Set();
  for (const r of rows.filter((x) => x.ok)) {
    const id = `${r.id}#${r.repeat}`;
    if (r.id != null && seen.has(id)) continue;
    seen.add(id);
    const k = `${r.category}\u0000${r.prompt}\u0000${r.condition}`;
    m.set(k, [...(m.get(k) ?? []), new Set(r.named ?? [])]);
  }
  return (cat, prompt, cond, subject) => {
    const v = m.get(`${cat}\u0000${prompt}\u0000${cond}`);
    return v && v.length ? v.filter((names) => names.has(subject)).length / v.length : null;
  };
}

export function bootMean(ds, { B: b = B, seed = SEED } = {}) {
  const rnd = mulberry32(seed);
  const boots = [];
  for (let i = 0; i < b; i++) boots.push(mean(ds.map(() => ds[Math.floor(rnd() * ds.length)])));
  boots.sort((x, y) => x - y);
  return [boots[Math.floor(0.025 * b)], boots[Math.floor(0.975 * b)]];
}

/** d = rate(first condition) − rate(second) for the unit's subject app, per (prompt, subject); prompts missing either condition are dropped and counted. */
export function contrast(units, rate, [a, b]) {
  const ds = [], dropped = [], byCat = {};
  for (const [cat, prompt, subject] of units) {
    const ra = rate(cat, prompt, a, subject), rb = rate(cat, prompt, b, subject);
    if (ra == null || rb == null) { dropped.push([cat, prompt, subject]); continue; }
    ds.push(ra - rb);
    (byCat[cat] ??= []).push(ra - rb);
  }
  return { ds, dropped, byCat };
}

export function analyse(rows, conditions, { hypotheses = HYPOTHESES, secondary: secondaryContrasts = SECONDARY } = {}) {
  const rate = rates(rows);
  const primary = Object.entries(hypotheses).map(([h, conds]) => {
    const { ds, dropped, byCat } = contrast(conditions.picks[h], rate, conds);
    const st = signTest(ds);
    const testable = ds.length >= MIN_PROMPTS;
    return { h, conds, n: ds.length, dropped: dropped.length, testable, sign: st, meanDelta: ds.length ? mean(ds) : null, ci: ds.length ? bootMean(ds) : null, byCategory: Object.fromEntries(Object.entries(byCat).map(([c, x]) => [c, { n: x.length, meanDelta: mean(x) }])) };
  });
  const adj = holm(primary.map((p) => (p.testable ? p.sign.p : 1)));
  primary.forEach((p, i) => { p.holmP = adj[i]; p.supported = p.testable && p.holmP < ALPHA && p.meanDelta > 0; });
  // secondary contrasts use the target of each sampled prompt (H1 units: their H1 subject)
  const allUnits = [...new Map(Object.values(conditions.picks).flat().map((u) => [u.join('\u0000'), u])).values()];
  const secondary = Object.entries(secondaryContrasts).map(([s, conds]) => {
    const { ds } = contrast(allUnits, rate, conds);
    // two-sided sign test: 2 × the smaller tail
    const up = signTest(ds), down = signTest(ds.map((d) => -d));
    return { s, conds, n: ds.length, meanDelta: ds.length ? mean(ds) : null, ci: ds.length ? bootMean(ds) : null, pTwoSided: Math.min(1, 2 * Math.min(up.p, down.p)) };
  });
  const ok = rows.filter((r) => r.ok);
  return { primary, secondary, answers: ok.length, failed: rows.filter((r) => !r.ok).length, searched: ok.filter((r) => (r.searches ?? 0) > 0).length, models: [...new Set(ok.map((r) => r.model).filter(Boolean))] };
}

const pp = (x) => (x == null ? '—' : `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)} pp`);

export function render(res) {
  const L = ['# Causal study — results', '', `Answers: ${res.answers} ok, ${res.failed} failed calls (retried; see results.jsonl). Answers that used web search: ${res.searched}. Models: ${res.models.join(', ') || '—'}.`, '', '| Hypothesis | Prompts | Sign test (+/n) | Holm p | Mean Δ (95% CI) | Verdict |', '|---|---:|---|---:|---|---|'];
  for (const p of res.primary) {
    const verdict = !p.testable ? `not testable (n < ${MIN_PROMPTS})` : p.supported ? 'supported' : 'not supported';
    L.push(`| ${p.h}: ${p.conds.join(' − ')} | ${p.n}${p.dropped ? ` (${p.dropped} dropped)` : ''} | ${p.sign.pos}/${p.sign.n} | ${p.holmP.toFixed(4)} | ${pp(p.meanDelta)} (${pp(p.ci?.[0])} … ${pp(p.ci?.[1])}) | ${verdict} |`);
  }
  L.push('', 'Pre-registered wording:', '');
  for (const p of res.primary) {
    L.push(p.supported
      ? `- **${p.h}**: In this controlled setting, ${LEVER[p.h]} raised the rate at which the engine named the app by ${pp(p.meanDelta)} (95% CI ${pp(p.ci[0])} … ${pp(p.ci[1])}).`
      : `- **${p.h}**: No evidence that ${LEVER[p.h]} changes the rate in this setting${p.testable ? '' : ` (only ${p.n} prompts; not testable)`}.`);
  }
  L.push('', 'By category (mean Δ):', '', '| Hypothesis | ' + [...new Set(res.primary.flatMap((p) => Object.keys(p.byCategory)))].join(' | ') + ' |');
  const cats = [...new Set(res.primary.flatMap((p) => Object.keys(p.byCategory)))];
  L.push(`|---|${cats.map(() => '---:').join('|')}|`);
  for (const p of res.primary) L.push(`| ${p.h} | ${cats.map((c) => (p.byCategory[c] ? `${pp(p.byCategory[c].meanDelta)} (n ${p.byCategory[c].n})` : '—')).join(' | ')} |`);
  L.push('', 'Secondary (manipulation checks, two-sided, not corrected):', '', '| Contrast | Prompts | Mean Δ (95% CI) | p |', '|---|---:|---|---:|');
  for (const s of res.secondary) L.push(`| ${s.s}: ${s.conds.join(' − ')} | ${s.n} | ${pp(s.meanDelta)} (${pp(s.ci?.[0])} … ${pp(s.ci?.[1])}) | ${s.pTwoSided.toFixed(4)} |`);
  return L.join('\n');
}

async function main() {
  const study = process.argv[2] ?? 'main';
  const files = studyFiles(study);
  const conditions = JSON.parse(fs.readFileSync(path.join(HERE, files.conditions), 'utf8'));
  const rows = fs.readFileSync(path.join(HERE, files.results), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const res = study === 'main' ? analyse(rows, conditions) : analyse(rows, conditions, { hypotheses: DOSE_HYPOTHESES, secondary: {} });
  fs.writeFileSync(path.join(HERE, files.summary), JSON.stringify(res, null, 2));
  const md = render(res);
  fs.writeFileSync(path.join(HERE, files.report), `${md}\n`);
  console.log(md);
  return 0;
}

const isMain = process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main().then((c) => { process.exitCode = c; }, (e) => { console.error(e.stack ?? e.message); process.exitCode = 1; });
