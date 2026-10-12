#!/usr/bin/env node
// Causal study v2, step 6 — the pre-registered analysis (PREREGISTRATION.md §7–§8). Writes results.json and RESULTS.md.
// Refuses to run on incomplete data unless --partial is given (then every table is labelled PARTIAL).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { clusterBootstrap, clusterTest, holm, kappa, signFlipCI } from './lib.mjs';
import { STUDIES, jobsFor, pending } from './collect.mjs';
import { items } from './judge.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ALPHA = 0.05;
export const PLANNED_APPS = 15;
export const EQUIVALENCE_MARGIN = 0.05; // S4 TOST margin, ±5 pp
export const HYPOTHESES = { H1: ['I3', 'P3'], H2: ['I10', 'P10'] };
const readJsonl = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;

/** Latest judgment per item key: its label, or 'FAILED' if the latest attempt failed (after the judge's retries). */
export const labelsOf = (rows) => new Map(rows.map((r) => [r.key, r.ok ? r.label : 'FAILED']));

/**
 * Per-answer outcomes, one answer per (job, repeat) — the last ok row; rows of jobs not in the current design are
 * ignored and counted. Answers that searched are excluded. For each entity (subject, fictional):
 *   <e>Rec (claude judge says RECOMMENDED — the primary outcome) · <e>RecBoth (both judges) · <e>RecCodex.
 * A named answer without a judgment is "missing" (the analysis refuses); a failed judgment makes that outcome null
 * for this answer (excluded, counted).
 */
export function outcomes(results, codex, claude, validIds = null) {
  const last = new Map();
  let duplicates = 0, stale = 0, missing = 0, failed = 0;
  for (const r of results.filter((x) => x.ok)) {
    if (validIds && !validIds.has(r.id)) { stale += 1; continue; }
    const k = `${r.id}#${r.repeat}`;
    if (last.has(k)) duplicates += 1;
    last.set(k, r);
  }
  const rows = [];
  for (const r of [...last.values()].filter((x) => !(x.searches > 0))) {
    const o = { ...r };
    for (const [e, named] of [['subject', r.subjectNamed], ['fictional', r.fictionalNamed]]) {
      if (!named) { Object.assign(o, { [`${e}Rec`]: false, [`${e}RecBoth`]: false, [`${e}RecCodex`]: false }); continue; }
      const k = `${r.id}#${r.repeat}#${e}`;
      const a = codex.get(k), b = claude.get(k);
      if (!a || !b) { missing += 1; Object.assign(o, { [`${e}Rec`]: null, [`${e}RecBoth`]: null, [`${e}RecCodex`]: null }); continue; }
      if (a === 'FAILED' || b === 'FAILED') failed += 1;
      const R = (x) => (x === 'FAILED' ? null : x === 'RECOMMENDED');
      Object.assign(o, { [`${e}Rec`]: R(b), [`${e}RecCodex`]: R(a), [`${e}RecBoth`]: R(a) == null || R(b) == null ? null : R(a) && R(b) });
    }
    rows.push(o);
  }
  return { rows, missingJudgments: missing, failedJudgments: failed, duplicates, stale };
}

/** rate(category, prompt, condition, field) over repeats, or null when no valid answer. */
export function rater(rows) {
  const m = new Map();
  for (const r of rows) {
    const k = `${r.category}\u0000${r.prompt}\u0000${r.condition}`;
    m.set(k, [...(m.get(k) ?? []), r]);
  }
  return (cat, prompt, cond, field) => {
    const v = (m.get(`${cat}\u0000${prompt}\u0000${cond}`) ?? []).filter((r) => r[field] != null);
    return v.length ? v.filter((r) => r[field]).length / v.length : null;
  };
}

/**
 * Cluster contrast. unitDelta(u) gives a unit's Δ or null (dropped). Units are grouped by subject app.
 * Estimand for verdicts: the app-weighted mean Δ, with a sign-flip-inversion CI (same statistic as the test).
 * The unit-weighted mean and its app-cluster bootstrap CI are descriptive.
 */
export function clusterContrast(units, unitDelta, { sided = 'greater', alpha = ALPHA } = {}) {
  const byApp = new Map();
  let dropped = 0;
  for (const u of units) {
    const d = unitDelta(u);
    if (d == null) { dropped += 1; continue; }
    byApp.set(u.subject, [...(byApp.get(u.subject) ?? []), d]);
  }
  const ds = [...byApp.values()].flat();
  if (!ds.length) return { n: 0, apps: 0, dropped, appMeanDelta: null, ci: null, meanDelta: null, unitCi: null, p: null, appsUp: 0, appsDown: 0, appsMoved: 0, unitsMoved: 0 };
  const appMeans = [...byApp.values()].map(mean);
  const up = clusterTest(appMeans).p, down = clusterTest(appMeans.map((x) => -x)).p;
  return {
    n: ds.length, apps: byApp.size, dropped,
    appMeanDelta: mean(appMeans), ci: signFlipCI(appMeans, { alpha }),
    meanDelta: mean(ds), unitCi: clusterBootstrap(byApp),
    appsUp: appMeans.filter((x) => x > 0).length, appsDown: appMeans.filter((x) => x < 0).length,
    appsMoved: appMeans.filter((x) => x !== 0).length, unitsMoved: ds.filter((d) => d !== 0).length,
    p: sided === 'greater' ? up : Math.min(1, 2 * Math.min(up, down)),
  };
}

const diff = (rate, [a, fa], [b, fb]) => (u) => {
  const ra = rate(u.category, u.prompt, a, fa), rb = rate(u.category, u.prompt, b, fb);
  return ra == null || rb == null ? null : ra - rb;
};

export function analyse({ units, replicationUnits = units, primaryRows, replicationRows = [], domainOf = () => 'app' }) {
  const rate = rater(primaryRows);
  const two = { sided: 'two' };
  const primary = Object.entries(HYPOTHESES).map(([h, [a, b]]) => ({ h, conds: [a, b], ...clusterContrast(units, diff(rate, [a, 'subjectRec'], [b, 'subjectRec'])) }));
  const adj = holm(primary.map((p) => p.p ?? 1));
  primary.forEach((p, i) => {
    p.holmP = adj[i];
    p.supported = p.appMeanDelta != null && p.holmP < ALPHA && p.appMeanDelta > 0;
    p.belowPlannedSize = p.apps < PLANNED_APPS;
    // an exact sign-flip over m moved apps cannot give p below 2^-m: with ≤ 5, the first Holm step (0.025) is unreachable
    p.cannotReachAlpha = p.appsMoved <= 5;
  });
  const sensitivity = Object.entries(HYPOTHESES).flatMap(([h, [a, b]]) => {
    const k = a.slice(1);
    return [
      { t: `T1 ${h} vs fictional: I${k} − F${k}`, h, ...clusterContrast(units, diff(rate, [a, 'subjectRec'], [`F${k}`, 'subjectRec']), two) },
      { t: `T2 ${h} vs unedited: I${k} − BASE`, h, ...clusterContrast(units, diff(rate, [a, 'subjectRec'], ['BASE', 'subjectRec']), two) },
      { t: `T3 ${h}, outcome = both judges`, h, ...clusterContrast(units, diff(rate, [a, 'subjectRecBoth'], [b, 'subjectRecBoth']), two) },
      { t: `T4 ${h}, outcome = codex judge`, h, ...clusterContrast(units, diff(rate, [a, 'subjectRecCodex'], [b, 'subjectRecCodex']), two) },
    ];
  });
  // robust = supported, and every sensitivity estimate of that hypothesis points the same way
  primary.forEach((p) => { p.robust = p.supported && sensitivity.filter((s) => s.h === p.h).every((s) => s.appMeanDelta > 0); });
  const s4 = (u) => {
    const i3 = rate(u.category, u.prompt, 'I3', 'subjectRec'), p3 = rate(u.category, u.prompt, 'P3', 'subjectRec');
    const f3 = rate(u.category, u.prompt, 'F3', 'fictionalRec'), p3f = rate(u.category, u.prompt, 'P3', 'fictionalRec');
    return [i3, p3, f3, p3f].some((x) => x == null) ? null : (i3 - p3) - (f3 - p3f);
  };
  const S4 = { s: 'S4 real minus fictional gain at k=3: (I3−P3)subject − (F3−P3)fictional', ...clusterContrast(units, s4, two) };
  const tost = clusterContrast(units, s4, { sided: 'two', alpha: 0.10 }); // 90% CI → TOST at 5%
  Object.assign(S4, { ci90: tost.ci, equivalent: tost.ci != null && tost.ci[0] > -EQUIVALENCE_MARGIN && tost.ci[1] < EQUIVALENCE_MARGIN });
  const i10p10 = diff(rate, ['I10', 'subjectRec'], ['P10', 'subjectRec']);
  const secondary = [
    { s: 'S1 one listing: I1 − BASE', ...clusterContrast(units, diff(rate, ['I1', 'subjectRec'], ['BASE', 'subjectRec']), two) },
    { s: 'S2 placebo check: P3 − BASE', ...clusterContrast(units, diff(rate, ['P3', 'subjectRec'], ['BASE', 'subjectRec']), two) },
    { s: 'S3 dose: I10 − I3', ...clusterContrast(units, diff(rate, ['I10', 'subjectRec'], ['I3', 'subjectRec']), two) },
    S4,
    { s: 'S5a H1 on "named": I3 − P3', ...clusterContrast(units, diff(rate, ['I3', 'subjectNamed'], ['P3', 'subjectNamed']), two) },
    { s: 'S5b H2 on "named": I10 − P10', ...clusterContrast(units, diff(rate, ['I10', 'subjectNamed'], ['P10', 'subjectNamed']), two) },
  ];
  if (replicationRows.length) {
    const rr = rater(replicationRows);
    for (const [h, [a, b]] of Object.entries(HYPOTHESES)) secondary.push({ s: `S6 replication (claude-cli) ${h}: ${a} − ${b}`, ...clusterContrast(replicationUnits, diff(rr, [a, 'subjectRec'], [b, 'subjectRec']), two) });
  }
  for (const d of ['app', 'product']) secondary.push({ s: `S7 ${d} categories: I10 − P10`, ...clusterContrast(units.filter((u) => domainOf(u.category) === d), i10p10, two) });
  const ns = units.map((u) => u.results).sort((x, y) => x - y);
  const med = ns.length ? ns[Math.floor(ns.length / 2)] : null;
  if (med != null) {
    secondary.push({ s: `S8 I10 − P10, result lists ≤ ${med}`, ...clusterContrast(units.filter((u) => u.results <= med), i10p10, two) });
    secondary.push({ s: `S8 I10 − P10, result lists > ${med}`, ...clusterContrast(units.filter((u) => u.results > med), i10p10, two) });
  }
  const rates = Object.fromEntries(['BASE', 'I1', 'I3', 'I10', 'P3', 'P10', 'F3', 'F10'].map((c) => {
    const rs = primaryRows.filter((r) => r.condition === c);
    const share = (f) => (rs.length ? rs.filter((r) => r[f]).length / rs.length : 0);
    return [c, { answers: rs.length, subjectNamed: share('subjectNamed'), subjectRec: share('subjectRec'), fictionalRec: share('fictionalRec') }];
  }));
  return { primary, sensitivity, secondary, rates, resultsLength: ns.length ? { min: ns[0], median: med, max: ns.at(-1) } : null };
}

/** sets: [{ a: Map, b: Map, keys }] — one per study; keys repeat across studies, so studies are never merged into one Map. */
export function agreement(sets) {
  const a = [], b = [];
  for (const { a: A, b: B, keys } of sets) for (const k of keys) {
    const x = A.get(k), y = B.get(k);
    if (x && y && x !== 'FAILED' && y !== 'FAILED') { a.push(x); b.push(y); }
  }
  const bin = (xs) => xs.map((x) => (x === 'RECOMMENDED' ? 'R' : 'N'));
  return { items: a.length, kappa3: kappa(a, b), kappaRec: kappa(bin(a), bin(b)), notProduct: { codex: a.filter((x) => x === 'NOT_PRODUCT').length, claude: b.filter((x) => x === 'NOT_PRODUCT').length } };
}

const pct = (x) => (x == null ? '—' : `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)} pp`);
const ci = (c) => (c ? `${pct(c[0])} … ${pct(c[1])}` : '—');
const line = (label, s) => `| ${label} | ${s.n} | ${s.apps} | ${s.appsUp}/${s.appsDown} | ${pct(s.appMeanDelta)} (${ci(s.ci)}) | ${pct(s.meanDelta)} | ${s.p?.toFixed(4) ?? '—'} |`;
export function render(res) {
  const L = [`# Causal study v2 — results${res.partial ? ' (PARTIAL — not the pre-registered analysis)' : ''}`, '',
    `Generated by analyze.mjs. Primary answers analysed: ${res.answers} (${res.excludedSearched} excluded for searching). Replication answers: ${res.replicationAnswers}. Failed judgments (outcome excluded): ${res.failedJudgments}. Models: ${res.models.join(', ')}. Result-list length per unit: ${JSON.stringify(res.resultsLength)}.`, ''];
  L.push('## Primary (codex-cli answers; outcome = claude judge RECOMMENDED; app-level sign-flip; Holm)', '', '| | Contrast | Units | Apps | Apps up/down | App-mean Δ (95% CI) | Unit-mean Δ | p | Holm p | Verdict |', '|---|---|---:|---:|---|---|---|---:|---:|---|');
  for (const p of res.primary) L.push(`| ${p.h} | ${p.conds.join(' − ')} | ${p.n} | ${p.apps} | ${p.appsUp}/${p.appsDown} | ${pct(p.appMeanDelta)} (${ci(p.ci)}) | ${pct(p.meanDelta)} | ${p.p?.toFixed(4) ?? '—'} | ${p.holmP?.toFixed(4) ?? '—'} | ${p.supported ? (p.robust ? '**supported, robust**' : '**supported**, not robust') : 'not supported'}${p.belowPlannedSize ? ' (below planned size)' : ''}${p.cannotReachAlpha ? ' (≤ 5 apps moved: α unreachable)' : ''} |`);
  const head = ['| Contrast | Units | Apps | Apps up/down | App-mean Δ (95% CI) | Unit-mean Δ | p |', '|---|---:|---:|---|---|---|---:|'];
  L.push('', '## Sensitivity (pre-registered; "robust" needs every estimate of the hypothesis > 0)', '', ...head);
  for (const s of res.sensitivity) L.push(line(s.t, s));
  L.push('', '## Secondary (two-sided, not corrected)', '', ...head);
  for (const s of res.secondary) L.push(line(s.s, s));
  const s4 = res.secondary.find((s) => s.ci90 !== undefined);
  if (s4) L.push('', `S4 equivalence (TOST, ±5 pp): 90% CI ${ci(s4.ci90)} → ${s4.equivalent ? 'equivalent' : 'not shown equivalent'}.`);
  L.push('', '## Rates by condition (primary, descriptive)', '', '| Condition | Answers | Subject named | Subject recommended | Fictional recommended |', '|---|---:|---:|---:|---:|');
  for (const [c, r] of Object.entries(res.rates)) L.push(`| ${c} | ${r.answers} | ${(r.subjectNamed * 100).toFixed(1)}% | ${(r.subjectRec * 100).toFixed(1)}% | ${(r.fictionalRec * 100).toFixed(1)}% |`);
  L.push('', '## Judge agreement', '', `Items labelled by both judges: ${res.agreement.items}. Cohen's κ (3 labels) ${res.agreement.kappa3?.toFixed(3) ?? '—'}; κ (RECOMMENDED vs not) ${res.agreement.kappaRec?.toFixed(3) ?? '—'}. NOT_PRODUCT: codex ${res.agreement.notProduct.codex}, claude ${res.agreement.notProduct.claude}.`, '');
  return L.join('\n');
}

async function main() {
  const partial = process.argv.includes('--partial');
  const cond = JSON.parse(fs.readFileSync(path.join(HERE, 'conditions.json'), 'utf8'));
  const { categories } = JSON.parse(fs.readFileSync(path.join(HERE, 'categories.json'), 'utf8'));
  const domainOf = (id) => (categories.find((c) => c.id === id).kind.endsWith(' app') ? 'app' : 'product');
  const prim = readJsonl(path.join(HERE, STUDIES.primary.file));
  const repl = readJsonl(path.join(HERE, STUDIES.replication.file));
  const J = (study, judge) => labelsOf(readJsonl(path.join(HERE, `judgments-${study}-${judge}.jsonl`)));
  const missingAnswers = pending(jobsFor('primary', cond), STUDIES.primary.repeats, prim).length + pending(jobsFor('replication', cond), STUDIES.replication.repeats, repl).length;
  const ids = new Set(cond.jobs.map((j) => j.id));
  const P = outcomes(prim, J('primary', 'codex'), J('primary', 'claude'), ids);
  const R = outcomes(repl, J('replication', 'codex'), J('replication', 'claude'), ids);
  const problems = { missingAnswers, missingJudgments: P.missingJudgments + R.missingJudgments, duplicates: P.duplicates + R.duplicates, stale: P.stale + R.stale };
  const incomplete = Object.values(problems).some(Boolean);
  if (incomplete && !partial) { console.error(`incomplete or inconsistent data: ${JSON.stringify(problems)} (--partial only as pre-registered, §10)`); return 1; }
  const replicationUnits = cond.units.filter((u) => cond.replication.some(([c, p]) => c === u.category && p === u.prompt));
  const res = analyse({ units: cond.units, replicationUnits, primaryRows: P.rows, replicationRows: R.rows, domainOf });
  const sets = [['primary', prim], ['replication', repl]].map(([st, rows]) => ({ a: J(st, 'codex'), b: J(st, 'claude'), keys: items(rows).map((x) => x.key) }));
  Object.assign(res, { partial: incomplete, problems, failedJudgments: P.failedJudgments + R.failedJudgments, answers: P.rows.length, excludedSearched: prim.filter((r) => r.ok && r.searches > 0).length, replicationAnswers: R.rows.length, models: [...new Set([...prim, ...repl].filter((r) => r.ok).map((r) => r.model))], agreement: agreement(sets) });
  fs.writeFileSync(path.join(HERE, partial ? 'results-partial.json' : 'results.json'), `${JSON.stringify(res, null, 1)}\n`);
  fs.writeFileSync(path.join(HERE, partial ? 'RESULTS-PARTIAL.md' : 'RESULTS.md'), `${render(res)}\n`);
  console.log(render(res));
  return 0;
}

const isMain = process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main().then((c) => { process.exitCode = c; }, (e) => { console.error(e.stack ?? e.message); process.exitCode = 1; });
