// Reliability gate. A number is reported as RELIABLE only when all of these hold (defaults, fixed before any run):
//   R1  rate reliability  ≥ 0.80 — split-half (odd vs even repeats) Pearson correlation of per-app mention rates over
//                                  "core" apps (≥ 5 mentions in the whole run), Spearman–Brown corrected to the full run.
//       Why Pearson on rates, not Spearman ranks: decided on pilot data (2026-10-10, habit trackers) before the benchmark.
//       Ranks weigh a 0.03↔0.05 swap among rarely named apps the same as a 0.9↔0.05 swap; rates keep magnitudes.
//   R2  precision         ≤ ±10 pp — half-width of the 95% bootstrap interval (over prompts) of the target's rate.
//   R3  coding agreement  ≥ 0.80 — Cohen's κ between the regex extractor and an independent LLM judge (see judge.mjs).
// Anything that cannot be computed is INDETERMINATE, never PASS. The gate also says how much more data would be needed.
import { analyse } from './extract.mjs';
import { promptBootstrap } from './report.mjs';
import { spearman } from './validate.mjs';

function pearson(a, b) {
  const n = a.length;
  const ma = a.reduce((x, y) => x + y, 0) / n, mb = b.reduce((x, y) => x + y, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i += 1) { num += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return da && db ? num / Math.sqrt(da * db) : null;
}

export const GATE = Object.freeze({ rank: 0.8, halfWidth: 0.10, kappa: 0.8, minMentions: 5, minCoreApps: 4 });

const key = (name) => String(name).normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

function rates(rows, cfg) {
  const counts = new Map();
  for (const r of rows) {
    const a = analyse(r.text, cfg.target, cfg.competitors ?? []);
    for (const n of new Set([...a.mentions.map((m) => m.name), ...a.otherNames].map(key))) counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  return { n: rows.length, get: (k) => (rows.length ? (counts.get(k) ?? 0) / rows.length : 0), keys: [...counts.keys()] };
}

/** Spearman–Brown: reliability of a measure k times as long as one with reliability r. */
export const spearmanBrown = (r, k) => (k * r) / (1 + (k - 1) * r);
/** How many times more data a measure with reliability r needs to reach target. */
export const lengthFactor = (r, target) => (r <= 0 ? Infinity : (target * (1 - r)) / (r * (1 - target)));

/** R1: split-half rank reliability for one engine's successful rows. */
export function splitHalfRank(rows, cfg, gate = GATE) {
  const odd = rows.filter((r) => r.repeat % 2 === 1);
  const even = rows.filter((r) => r.repeat % 2 === 0);
  if (!odd.length || !even.length) return { status: 'INDETERMINATE', reason: 'needs ≥ 2 repeats (split is odd vs even repeats)' };
  const A = rates(odd, cfg), B = rates(even, cfg);
  const total = (k) => A.get(k) * A.n + B.get(k) * B.n;
  const core = [...new Set([...A.keys, ...B.keys])].filter((k) => total(k) >= gate.minMentions);
  if (core.length < gate.minCoreApps) return { status: 'INDETERMINATE', reason: `only ${core.length} apps with ≥ ${gate.minMentions} mentions (need ≥ ${gate.minCoreApps})`, coreApps: core.length };
  const a = core.map(A.get), b = core.map(B.get);
  const r = pearson(a, b);
  if (r == null) return { status: 'INDETERMINATE', reason: 'no variation in mention rates', coreApps: core.length };
  const full = r > 0 ? spearmanBrown(r, 2) : r;
  const rankCheck = spearman(a, b);
  return { status: full >= gate.rank ? 'PASS' : 'FAIL', halfR: r, reliability: full, spearmanHalf: rankCheck.rho, coreApps: core.length, moreDataFactor: full >= gate.rank ? 1 : lengthFactor(full, gate.rank) };
}

/** R2: precision of the target's rate (bootstrap over prompts). */
export function precision(rows, cfg, gate = GATE) {
  const prompts = [...new Set(rows.map((r) => r.prompt))];
  const pr = prompts.map((q) => { const xs = rows.filter((r) => r.prompt === q); return xs.filter((r) => analyse(r.text, cfg.target, cfg.competitors ?? []).target).length / xs.length; });
  const b = promptBootstrap(pr);
  if (b.ci[0] == null) return { status: 'INDETERMINATE', reason: 'needs ≥ 2 prompts' };
  const half = (b.ci[1] - b.ci[0]) / 2;
  const m = b.mean;
  const sd = Math.sqrt(pr.reduce((a, x) => a + (x - m) ** 2, 0) / Math.max(1, pr.length - 1));
  const promptsNeeded = sd === 0 ? pr.length : Math.ceil((1.96 * sd / gate.halfWidth) ** 2);
  return { status: half <= gate.halfWidth ? 'PASS' : 'FAIL', rate: m, ci: b.ci, halfWidth: half, prompts: pr.length, promptsNeeded: Math.max(pr.length, promptsNeeded) };
}

/** Cohen's κ for paired binary codes. */
export function cohenKappa(pairs) {
  const n = pairs.length;
  if (!n) return null;
  let a = 0, x1 = 0, y1 = 0;
  for (const [x, y] of pairs) { if (x === y) a += 1; if (x) x1 += 1; if (y) y1 += 1; }
  const po = a / n;
  const pe = (x1 / n) * (y1 / n) + (1 - x1 / n) * (1 - y1 / n);
  if (pe === 1) return po === 1 ? 1 : 0;
  return (po - pe) / (1 - pe);
}

/** Combine R1–R3 into a verdict. `audit` comes from judge.mjs (may be null = not run). */
export function gateVerdict({ rank, prec, audit }, gate = GATE) {
  const parts = [
    { id: 'R1 rate reliability', ...rank, value: rank.reliability, threshold: `≥ ${gate.rank}` },
    { id: 'R2 precision (±)', ...prec, value: prec.halfWidth, threshold: `≤ ${gate.halfWidth}` },
    audit ? { id: 'R3 coding agreement κ', status: audit.kappa == null ? 'INDETERMINATE' : audit.kappa >= gate.kappa ? 'PASS' : 'FAIL', value: audit.kappa, threshold: `≥ ${gate.kappa}`, reason: audit.reason } : { id: 'R3 coding agreement κ', status: 'INDETERMINATE', reason: 'audit not run (app-aeo audit <run>)', threshold: `≥ ${gate.kappa}` },
  ];
  const status = parts.every((p) => p.status === 'PASS') ? 'RELIABLE' : parts.some((p) => p.status === 'FAIL') ? 'NOT RELIABLE' : 'INDETERMINATE';
  return { status, parts };
}
