#!/usr/bin/env node
// Comparison study analysis — implements PREREGISTRATION.md §3.2 and §4–§7. Pure functions + a CLI that reads
// bench/compare/results/<category>/<engine>/{tool,reference}/<run>/responses.jsonl, …/direct.jsonl, and writes COMPARE.md.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findMention } from '../../src/extract.mjs';

export const ARMS = ['E', 'N', 'M5'];
export const MIN_EFFECT = 0.05;
export const ALPHA = 0.05;
export const MIN_REF_PROMPTS = 90;
export const MIN_TOOL_ANSWERS = 180;
export const AUDIT_MIN_AGREEMENT = 0.9;

function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;

/** Per-prompt share of answers that name `app`, then mean over prompts; SE by bootstrap over prompts (B=2000, seed 7). */
export function rateOverPrompts(rows, app, { B = 2000, seed = 7, onlyPrompts = null } = {}) {
  const byPrompt = new Map();
  for (const r of rows) {
    if (!r.ok) continue;
    if (onlyPrompts && !onlyPrompts.has(r.prompt)) continue;
    if (onlyPrompts && r.repeat !== 1) continue; // M5 = one answer per question
    const hit = findMention(r.text, app) ? 1 : 0;
    const a = byPrompt.get(r.prompt) ?? [];
    a.push(hit);
    byPrompt.set(r.prompt, a);
  }
  const shares = [...byPrompt.values()].map(mean);
  if (!shares.length) return { rate: null, se: null, prompts: 0 };
  const rnd = mulberry32(seed);
  const boots = [];
  for (let b = 0; b < B; b++) { let s = 0; for (let i = 0; i < shares.length; i++) s += shares[Math.floor(rnd() * shares.length)]; boots.push(s / shares.length); }
  const m = mean(boots);
  return { rate: mean(shares), se: Math.sqrt(mean(boots.map((x) => (x - m) ** 2))), prompts: shares.length };
}

/** E/N answer → {appName: fraction} or null. Takes the last JSON object; every app needs a number in [0,100]. */
export function parseDirect(text, apps) {
  const objs = String(text ?? '').match(/\{[^{}]*\}/g);
  if (!objs) return null;
  let obj;
  try { obj = JSON.parse(objs.at(-1)); } catch { return null; }
  const keys = Object.keys(obj);
  const out = {};
  for (const app of apps) {
    const names = [app.name, ...(app.aliases ?? [])].map((x) => x.toLowerCase());
    const k = keys.find((x) => names.includes(x.trim().toLowerCase()));
    const v = k === undefined ? NaN : Number(String(obj[k]).replace('%', ''));
    if (!Number.isFinite(v) || v < 0 || v > 100) return null;
    out[app.name] = v / 100;
  }
  return out;
}

/** Exact one-sided binomial sign test: P(X ≥ pos | n, ½). Ties (D = 0) are dropped. */
export function signTest(ds) {
  const nz = ds.filter((d) => d !== 0);
  const n = nz.length;
  const pos = nz.filter((d) => d > 0).length;
  let p = 0;
  for (let i = pos; i <= n; i++) { let c = 1; for (let j = 0; j < i; j++) c = (c * (n - j)) / (j + 1); p += c; }
  return { n, pos, p: n ? p / 2 ** n : 1 };
}

/** Holm step-down adjusted p-values (same order as input). */
export function holm(ps) {
  const idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]);
  const adj = new Array(ps.length);
  let run = 0;
  idx.forEach(([p, i], r) => { run = Math.max(run, Math.min(1, (ps.length - r) * p)); adj[i] = run; });
  return adj;
}

const rmseOver = (clusters, key) => Math.sqrt(mean(clusters.map((c) => c[key])));

/** Δ(X) = √mean_k MSE_k(X) − √mean_k MSE_k(T), with a bootstrap-over-clusters 95% CI (B=5000, seed 7). */
export function effect(clusters, { B = 5000, seed = 7 } = {}) {
  const point = rmseOver(clusters, 'mseX') - rmseOver(clusters, 'mseT');
  const rnd = mulberry32(seed);
  const boots = [];
  for (let b = 0; b < B; b++) { const s = clusters.map(() => clusters[Math.floor(rnd() * clusters.length)]); boots.push(rmseOver(s, 'mseX') - rmseOver(s, 'mseT')); }
  boots.sort((a, b) => a - b);
  return { delta: point, ci: [boots[Math.floor(0.025 * B)], boots[Math.floor(0.975 * B)]] };
}

/**
 * Core analysis on loaded data.
 * @param {Array<{id, engine, apps, refRows, toolRows, m5Prompts, direct: {E: {call, attempt, text}[], N: {call, attempt, text}[]}, audit?: {R?: object, T?: object}}>} cells
 */
export function analyse(cells, { imputation = 'none' } = {}) {
  const excluded = [];
  const clusters = [];
  for (const c of cells) {
    const refPrompts = new Set(c.refRows.filter((r) => r.ok).map((r) => r.prompt)).size;
    const toolAnswers = c.toolRows.filter((r) => r.ok).length;
    if (refPrompts < MIN_REF_PROMPTS || toolAnswers < MIN_TOOL_ANSWERS) { excluded.push({ id: c.id, engine: c.engine, refPrompts, toolAnswers }); continue; }
    const units = c.apps.map((app) => {
      const R = rateOverPrompts(c.refRows, app);
      const T = rateOverPrompts(c.toolRows, app);
      const M5 = rateOverPrompts(c.toolRows, app, { onlyPrompts: new Set(c.m5Prompts) });
      return { app: app.name, R: R.rate, seR: R.se, T: T.rate, seT: T.se, M5: M5.rate };
    });
    for (const arm of ['E', 'N']) {
      // direct[arm] = [{call, attempt, text}]. A call's value is its first parseable attempt (≤ 2 retries, §3.2).
      // Primary = call 1 only; if call 1 never parsed, the estimate is missing — later calls do not stand in for it.
      const byCall = new Map();
      for (const x of [...(c.direct?.[arm] ?? [])].sort((a, b) => a.call - b.call || a.attempt - b.attempt)) {
        if (byCall.get(x.call)) continue;
        byCall.set(x.call, parseDirect(x.text, c.apps));
      }
      const first = byCall.get(1) ?? null;
      const valid = [...byCall.values()].filter(Boolean);
      for (const u of units) {
        u[arm] = first ? first[u.app] : null;
        u[`${arm}mean`] = valid.length ? mean(valid.map((v) => v[u.app])) : null;
      }
    }
    const agreement = (src, app) => {
      const codes = (src?.codes ?? []).filter((x) => x.app === app);
      return codes.length ? codes.filter((x) => x.judge === x.extractor).length / codes.length : null;
    };
    for (const u of units) {
      u.agreeR = agreement(c.audit?.R, u.app);
      u.agreeT = agreement(c.audit?.T, u.app);
    }
    clusters.push({ id: c.id, engine: c.engine, units });
  }

  const contrasts = (arm, { dropLowAgreement = false, flip = false } = {}) => {
    const per = [];
    for (const k of clusters) {
      let us = k.units;
      if (dropLowAgreement) us = us.filter((u) => (u.agreeR ?? 1) >= AUDIT_MIN_AGREEMENT && (u.agreeT ?? 1) >= AUDIT_MIN_AGREEMENT);
      const est = (u) => {
        if (u[arm] != null) return u[arm];
        if (imputation === 'best') return u.R;
        if (imputation === 'worst') return 0.5;
        return null;
      };
      us = us.filter((u) => est(u) != null && u.R != null && u.T != null);
      if (!us.length) continue;
      const mseX = mean(us.map((u) => (est(u) - u.R) ** 2));
      const mseT = mean(us.map((u) => (u.T - u.R) ** 2));
      per.push({ id: k.id, engine: k.engine, n: us.length, mseX, mseT, D: flip ? mseT - mseX : mseX - mseT });
    }
    return per;
  };

  const run = (opts = {}) => {
    const tests = ARMS.map((arm) => { const per = contrasts(arm, opts); return { arm, per, sign: signTest(per.map((x) => x.D)), effect: per.length ? effect(per) : null }; });
    const adj = holm(tests.map((t) => t.sign.p));
    tests.forEach((t, i) => {
      t.pHolm = adj[i];
      const d = t.effect?.delta ?? null;
      t.supported = t.pHolm < ALPHA && d != null && (opts.flip ? -d : d) >= MIN_EFFECT;
    });
    return tests;
  };

  const units = clusters.flatMap((k) => k.units.map((u) => ({ ...u, id: k.id, engine: k.engine })));
  const calib = units.filter((u) => u.T != null && u.R != null && u.seT != null && u.seR != null);
  const covered = calib.filter((u) => Math.abs(u.T - u.R) <= 1.96 * Math.sqrt(u.seT ** 2 + u.seR ** 2)).length;
  const mae = Object.fromEntries(['T', ...ARMS].map((a) => { const xs = units.filter((u) => u[a] != null && u.R != null); return [a, xs.length ? mean(xs.map((u) => Math.abs(u[a] - u.R))) : null]; }));

  return {
    excluded,
    underpowered: excluded.length >= 3,
    primary: run(),
    reverse: run({ flip: true }),
    sensitivityAudit: run({ dropLowAgreement: true }),
    calibration: { covered, n: calib.length },
    mae,
    units,
  };
}

// ---------- CLI ----------
function readRows(dir) {
  if (!fs.existsSync(dir)) return [];
  const runs = fs.readdirSync(dir).filter((d) => fs.existsSync(path.join(dir, d, 'responses.jsonl')));
  const latest = new Map();
  for (const d of runs) for (const l of fs.readFileSync(path.join(dir, d, 'responses.jsonl'), 'utf8').split('\n')) {
    if (!l) continue;
    const r = JSON.parse(l);
    const k = `${r.provider}\t${r.prompt}\t${r.repeat}`;
    if (!latest.get(k)?.ok || r.ok) latest.set(k, r);
  }
  return [...latest.values()];
}
function readAudit(dir) {
  if (!fs.existsSync(dir)) return null;
  for (const d of fs.readdirSync(dir)) { const f = path.join(dir, d, 'audit.json'); if (fs.existsSync(f)) return Object.values(JSON.parse(fs.readFileSync(f, 'utf8')).byProvider ?? {})[0] ?? null; }
  return null;
}

export function loadCells(root, cats) {
  const cells = [];
  for (const c of cats.categories) for (const engine of ['claude-search', 'codex-search']) {
    const base = path.join(root, c.id, engine);
    const directFile = path.join(base, 'direct.jsonl');
    const direct = { E: [], N: [] };
    if (fs.existsSync(directFile)) for (const l of fs.readFileSync(directFile, 'utf8').split('\n')) { if (!l) continue; const x = JSON.parse(l); direct[x.arm]?.push({ call: x.call, attempt: x.attempt, text: x.text }); }
    cells.push({ id: c.id, engine, apps: c.apps, m5Prompts: c.m5Prompts, refRows: readRows(path.join(base, 'reference')), toolRows: readRows(path.join(base, 'tool')), direct, audit: { R: readAudit(path.join(base, 'reference')), T: readAudit(path.join(base, 'tool')) } });
  }
  return cells;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const cats = JSON.parse(fs.readFileSync(path.join(here, 'categories.json'), 'utf8'));
  const cells = loadCells(path.join(here, 'results'), cats);
  const res = { primary: analyse(cells), bestCase: analyse(cells, { imputation: 'best' }), worstCase: analyse(cells, { imputation: 'worst' }) };
  fs.writeFileSync(path.join(here, 'compare.json'), JSON.stringify(res, null, 2));
  const p = res.primary;
  const f = (x, d = 3) => (x == null ? '—' : Number(x).toFixed(d));
  const L = ['# Comparison study — results', '', 'Protocol: [`PREREGISTRATION.md`](PREREGISTRATION.md). Every cluster reported.', ''];
  if (p.excluded.length) L.push(`Excluded clusters (§7): ${p.excluded.map((x) => `${x.id}/${x.engine} (ref ${x.refPrompts}, tool ${x.toolAnswers})`).join(', ')}${p.underpowered ? ' — **underpowered: primary tests not interpreted**' : ''}`, '');
  L.push('| Claim | Sign test (pos / n) | p | Holm p | Δ RMSE (95% CI) | Supported | Reverse (rival closer) Holm p |', '|---|---|---|---|---|---|---|');
  p.primary.forEach((t, i) => { const r = p.reverse[i]; L.push(`| T closer than ${t.arm} | ${t.sign.pos} / ${t.sign.n} | ${f(t.sign.p, 4)} | ${f(t.pHolm, 4)} | ${f(t.effect?.delta)} (${f(t.effect?.ci[0])} – ${f(t.effect?.ci[1])}) | ${t.supported ? '✅' : '❌'} | ${f(r.pHolm, 4)}${r.supported ? ' ⚠️ rival significantly closer' : ''} |`); });
  L.push('', `MAE: ${Object.entries(p.mae).map(([a, v]) => `${a} ${f(v)}`).join(' · ')}`, `Calibration of T (descriptive): ${p.calibration.covered} / ${p.calibration.n} units within 1.96·√(SE_T²+SE_R²).`, '');
  L.push('Imputation bounds for missing E/N (§3.2): best case ' + res.bestCase.primary.map((t) => `${t.arm} ${t.supported ? '✅' : '❌'}`).join(' ') + ' · worst case ' + res.worstCase.primary.map((t) => `${t.arm} ${t.supported ? '✅' : '❌'}`).join(' '));
  L.push('Audit sensitivity (§6): ' + p.sensitivityAudit.map((t) => `${t.arm} ${t.supported ? '✅' : '❌'} (Holm p ${f(t.pHolm, 4)})`).join(' · '), '');
  L.push('| Cluster | App | R | T | E | N | M5 |', '|---|---|---|---|---|---|---|');
  for (const u of p.units) L.push(`| ${u.id}/${u.engine} | ${u.app} | ${f(u.R, 2)} | ${f(u.T, 2)} | ${f(u.E, 2)} | ${f(u.N, 2)} | ${f(u.M5, 2)} |`);
  fs.writeFileSync(path.join(here, 'COMPARE.md'), L.join('\n') + '\n');
  console.log(p.primary.map((t) => `${t.arm}: ${t.supported ? 'SUPPORTED' : 'not supported'} (Holm p ${f(t.pHolm, 4)}, Δ ${f(t.effect?.delta)})`).join(' · '));
}
