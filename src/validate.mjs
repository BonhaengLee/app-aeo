// Is the measurement trustworthy? Two checks you can run for free on your own runs.
//
//  1. Test–retest: run the same config twice (different hours/days). Per-app mention rates should rank the same way.
//     Low agreement means single runs of this engine are noise and should not drive decisions.
//  2. Convergent validity: apps the engines recommend more should be apps people actually use more. We correlate
//     per-app mention rate with App Store rating counts (public, free). A near-zero correlation means the engine's
//     picks are not tracking the real market for this category.
// Both use Spearman rank correlation with a permutation p-value (no distribution assumptions, deterministic seed).
import path from 'node:path';
import { readRows } from './run.mjs';
import { analyse, brandOf } from './extract.mjs';
import { mulberry32 } from './report.mjs';

function ranks(xs) {
  const idx = xs.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]);
  const r = new Array(xs.length);
  for (let i = 0; i < idx.length;) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j += 1;
    for (let k = i; k <= j; k += 1) r[idx[k][1]] = (i + j) / 2 + 1;
    i = j + 1;
  }
  return r;
}

function pearson(a, b) {
  const n = a.length;
  const ma = a.reduce((x, y) => x + y, 0) / n;
  const mb = b.reduce((x, y) => x + y, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i += 1) { num += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return da && db ? num / Math.sqrt(da * db) : null;
}

/** Spearman rho with a two-sided permutation p-value. */
export function spearman(a, b, { permutations = 5000, seed = 11 } = {}) {
  if (a.length !== b.length || a.length < 3) return { rho: null, p: null, n: a.length };
  const ra = ranks(a), rb = ranks(b);
  const rho = pearson(ra, rb);
  if (rho == null) return { rho: null, p: null, n: a.length };
  const rnd = mulberry32(seed);
  let extreme = 0;
  const perm = [...rb];
  for (let k = 0; k < permutations; k += 1) {
    for (let i = perm.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
    const r = pearson(ra, perm);
    if (r != null && Math.abs(r) >= Math.abs(rho) - 1e-12) extreme += 1;
  }
  return { rho, p: (extreme + 1) / (permutations + 1), n: a.length };
}

export const MIN_SHARE = 0.05;
const key = (name) => name.normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** Per-app mention rate over all successful answers of a run (known apps + bold-listed names the engines added). */
export function appRates(rows, cfg, { provider } = {}) {
  const ok = rows.filter((r) => r.ok && (!provider || r.provider === provider));
  const counts = new Map();
  const display = new Map();
  for (const r of ok) {
    // Re-extract from the stored text so extractor fixes apply to old runs too.
    const a = analyse(r.text, cfg.target, cfg.competitors ?? []);
    const seen = new Set();
    for (const m of a.mentions) seen.add(m.name);
    for (const n of a.otherNames) seen.add(n);
    for (const n of seen) { const k = key(n); counts.set(k, (counts.get(k) ?? 0) + 1); if (!display.has(k)) display.set(k, n); }
  }
  return { answers: ok.length, apps: [...counts.entries()].map(([k, c]) => ({ key: k, name: display.get(k), rate: ok.length ? c / ok.length : 0 })).sort((x, y) => y.rate - x.rate) };
}

export function testRetest(rowsA, rowsB, cfg, opts = {}) {
  const A = appRates(rowsA, cfg, opts), B = appRates(rowsB, cfg, opts);
  const keys = [...new Set([...A.apps, ...B.apps].map((x) => x.key))];
  const get = (R, k) => R.apps.find((x) => x.key === k)?.rate ?? 0;
  const a = keys.map((k) => get(A, k)), b = keys.map((k) => get(B, k));
  const target = key(cfg.target.name);
  // Pre-registered filter: apps named in ≥ MIN_SHARE of answers in either run. One-off mentions are sampling noise
  // and dominate the rank count (most apps tie at 0 vs 1 mention), which says nothing about the apps that matter.
  const core = keys.map((k, i) => [a[i], b[i]]).filter(([x, y]) => Math.max(x, y) >= MIN_SHARE);
  const coreS = spearman(core.map((x) => x[0]), core.map((x) => x[1]));
  return { apps: keys.length, answers: [A.answers, B.answers], ...spearman(a, b), core: { apps: core.length, minShare: MIN_SHARE, ...coreS }, target: [get(A, target), get(B, target)], table: keys.map((k, i) => ({ name: (A.apps.find((x) => x.key === k) ?? B.apps.find((x) => x.key === k)).name, a: a[i], b: b[i] })).sort((x, y) => y.a + y.b - x.a - x.b) };
}

/**
 * Correlate mention rate with App Store rating count. `searchImpl(term)` → store results (see store.search).
 * Only apps whose store result can be matched by brand are used; unmatched ones are listed, never guessed.
 */
export async function popularity(rows, cfg, searchImpl, { top = 15, provider, lookupImpl } = {}) {
  const R = appRates(rows, cfg, { provider });
  // Same pre-registered rule as the retest core: only apps named in ≥ MIN_SHARE of answers. One-off names are noise
  // (and in real runs were often section labels like "Save" / "Open" that matched unrelated store apps).
  const picked = R.apps.filter((a) => a.rate >= MIN_SHARE).slice(0, top);
  const known = new Map([cfg.target, ...(cfg.competitors ?? [])].filter((x) => x.appStoreId).map((x) => [key(x.name), String(x.appStoreId)]));
  const matched = [], unmatched = [];
  for (const app of picked) {
    let hit = null;
    if (known.has(app.key) && lookupImpl) hit = (await lookupImpl([known.get(app.key)]))[0];
    if (!hit) {
      // Several store apps share a brand ("Loop", "HabitKit" clones). The one people mean is the most-rated; a
      // first-result match picked 2- and 0-rating clones in a real run.
      // Exact brand or exact title only — a prefix match paired "Save" with "Save My Doggy" (52k ratings) in a real run.
      const results = (await searchImpl(app.name)).filter((x) => key(brandOf(x.name)) === app.key || key(x.name) === app.key || key(x.name.split(/\s[-–—:|]\s|:\s/)[0]) === app.key);
      hit = results.sort((x, y) => (y.ratingCount ?? -1) - (x.ratingCount ?? -1))[0] ?? null;
    }
    if (hit && hit.ratingCount != null) matched.push({ ...app, store: hit.name, appStoreId: hit.appStoreId, ratingCount: hit.ratingCount });
    else unmatched.push(app.name);
  }
  const s = spearman(matched.map((x) => x.rate), matched.map((x) => Math.log10(1 + x.ratingCount)));
  return { ...s, matched, unmatched };
}

export function renderValidation({ retest, pop, runs }) {
  const f = (x, d = 2) => (x == null ? '—' : x.toFixed(d));
  const L = ['# Measurement validity', ''];
  if (retest) {
    L.push(`## Test–retest (${runs.map((r) => path.basename(r)).join(' vs ')})`, '');
    L.push(`Spearman ρ = **${f(retest.rho)}** over ${retest.apps} apps (p = ${f(retest.p, 4)}), answers ${retest.answers.join(' / ')}. Target rate ${f(retest.target[0])} → ${f(retest.target[1])}.`, '');
    L.push(`Core apps (named in ≥ ${(retest.core.minShare * 100).toFixed(0)}% of answers in either run): ρ = **${f(retest.core.rho)}** over ${retest.core.apps} apps (p = ${f(retest.core.p, 4)}).`, '');
    L.push(verdict(retest.core.rho, retest.core.p, 'Runs agree on the apps that matter: rankings are reproducible.', 'Runs disagree even on frequently named apps: treat single runs as noise; add repeats.'), '');
    L.push('| App | Run A | Run B |', '|---|---|---|');
    for (const r of retest.table.slice(0, 20)) L.push(`| ${r.name} | ${f(r.a)} | ${f(r.b)} |`);
    L.push('');
  }
  if (pop) {
    L.push('## Convergent validity (mention rate vs App Store rating count)', '');
    L.push(`Spearman ρ = **${f(pop.rho)}** over ${pop.n} matched apps (p = ${f(pop.p, 4)}).`, '');
    L.push(verdict(pop.rho, pop.p, 'Engine picks track real-world usage for this category.', 'No evidence engine picks track real-world usage here — do not read mention rate as a market signal.'), '');
    L.push('| App | Mention rate | Store match | Ratings |', '|---|---|---|---|');
    for (const m of pop.matched) L.push(`| ${m.name} | ${f(m.rate)} | ${m.store} | ${m.ratingCount} |`);
    if (pop.unmatched.length) L.push('', `Not matched in the store (excluded, not guessed): ${pop.unmatched.join(', ')}`);
  }
  return L.join('\n') + '\n';
}

function verdict(rho, p, good, bad) {
  if (rho == null) return '_Not enough apps to judge (need ≥ 3)._';
  return rho >= 0.5 && p < 0.05 ? `✅ ${good}` : `⚠️ ${bad} (criterion: ρ ≥ 0.5 and p < 0.05)`;
}

export const loadRun = (dir) => readRows(path.join(dir, 'responses.jsonl'));
