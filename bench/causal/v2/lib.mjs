// Causal study v2 — pure functions shared by every step (no network, no model). See PREREGISTRATION.md.
import crypto from 'node:crypto';
import { findMention } from '../../../src/extract.mjs';
import { ragPrompt } from '../../../src/ground.mjs';
import { mulberry32 } from '../../../src/report.mjs';

export const SEED = 20261012;
export const PROMPTS_PER_CATEGORY = 40;
export const MIN_RESULTS = 12;          // a prompt needs ≥ 12 distinct search results (K_MAX edited + room for the rest)
export const K_MAX = 10;
export const MAX_UNITS = 400;
export const REPEATS = 2;               // primary engine
export const CONDITIONS = ['BASE', 'I1', 'I3', 'I10', 'P3', 'P10', 'F3', 'F10'];
export const REPLICATION = { engine: 'claude-cli', model: 'sonnet', units: 100, conditions: ['BASE', 'I3', 'P3', 'I10', 'P10'], repeats: 1 };
export const PRIMARY = { engine: 'codex-cli', model: 'gpt-5.6-terra', effort: 'medium' };

export const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
export const seedOf = (...parts) => parseInt(sha([SEED, ...parts].join('\u0000')).slice(0, 8), 16);

/** Fisher–Yates with a seeded generator; returns a new array. */
export function shuffle(xs, seed) {
  const a = [...xs];
  const rnd = mulberry32(seed);
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Presence-only sentences: they say that the product is an option of its kind, nothing about quality, popularity or
// who recommends it (design review 2026-10-12: earlier drafts claimed social proof). {n} = name, {c} = what it is
// ("meditation app", "cookware brand"). Insert, placebo and fictional conditions use the SAME template at the same slot.
export const TEMPLATES = [
  '{n} is another {c} option.',
  '{n} is also a {c} option.',
  'Another {c} option is {n}.',
  '{n} is a {c} option too.',
  'One more {c} option: {n}.',
  'Also a {c} option: {n}.',
  '{n} is one {c} option.',
  'A further {c} option is {n}.',
  '{n} counts as a {c} option as well.',
  '{n}, a {c} option, is another choice.',
];
export const fill = (t, n, c) => t.replaceAll('{n}', n).replaceAll('{c}', c);

// Placebo: real brands of products unrelated to every studied category.
export const PLACEBO_BRANDS = [
  ['Le Creuset', 'cookware brand'], ['Staedtler', 'pencil brand'], ['Weber', 'grill brand'], ['Pyrex', 'glassware brand'],
  ['Crayola', 'crayon brand'], ['Maglite', 'flashlight brand'], ['Zippo', 'lighter brand'], ['Victorinox', 'pocket knife brand'],
  ['Sharpie', 'marker brand'], ['Lodge', 'cast iron skillet brand'],
];
// Fictional names (checked before the study: no App Store app name contains them as a word, see PREREGISTRATION §5).
export const FICTIONAL = ['Quorvel', 'Zelvaro', 'Tavrisa', 'Novenly', 'Brindora', 'Calvexa', 'Quenlyx', 'Ostrava Labs', 'Pellucid', 'Venmira'];

/** Distinct search results of one answer, in the order received; a result is { url, title, snippet }. */
export function resultsOf(seen) {
  const out = [];
  const urls = new Set();
  for (const x of seen ?? []) {
    if (!x?.url || urls.has(x.url)) continue;
    urls.add(x.url);
    const [title, ...rest] = String(x.text ?? '').split('\n');
    out.push({ url: x.url, title: title.trim(), snippet: rest.join(' ').trim() });
  }
  return out;
}

const textOf = (r) => `${r.title}\n${r.url}\n${r.snippet}`;
const squash = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
/** The app's name or an alias (letters/digits only, ≥ 4) inside a URL, e.g. hoka.com, notion.so/blog (review 2026-10-12: URLs reach the model too). */
export const urlNames = (url, app) => [app.name, ...(app.aliases ?? [])].map(squash).filter((n) => n.length >= 4).some((n) => squash(url).includes(n));
/** Does this text (a rendered context or a result) mention the app anywhere the model can see it? */
export const mentions = (text, app, urls = []) => !!findMention(text, app) || urls.some((u) => urlNames(u, app));

/**
 * Pick at most one subject per prompt. Candidates: apps of the category that the prompt does not name, that no
 * received result names, and that the eligibility judge accepted. Among them the app with the fewest units so far,
 * ties broken by a seeded hash. Prompts are visited in a seeded order; stops at MAX_UNITS.
 */
export function selectUnits(corpus, eligibility, categories, { maxUnits = MAX_UNITS } = {}) {
  const ok = new Map(eligibility.map((e) => [`${e.category}\u0000${e.prompt}`, e.accept ?? {}]));
  const used = new Map();
  const units = [];
  const skipped = { fewResults: 0, noCandidate: 0, noEligibility: 0 };
  const order = shuffle(corpus.filter((c) => c.ok), seedOf("order"));
  for (const row of order) {
    if (units.length >= maxUnits) break;
    const cat = categories.find((c) => c.id === row.category);
    const results = resultsOf(row.seen);
    if (results.length < MIN_RESULTS) { skipped.fewResults += 1; continue; }
    const acc = ok.get(`${row.category}\u0000${row.prompt}`);
    if (!acc) { skipped.noEligibility += 1; continue; }
    const cands = cat.apps.filter((a) => acc[a.name] === true && !findMention(row.prompt, a) && !results.some((r) => mentions(textOf(r), a, [r.url])));
    if (!cands.length) { skipped.noCandidate += 1; continue; }
    cands.sort((a, b) => (used.get(a.name) ?? 0) - (used.get(b.name) ?? 0) || seedOf(row.prompt, a.name) - seedOf(row.prompt, b.name));
    const subject = cands[0];
    used.set(subject.name, (used.get(subject.name) ?? 0) + 1);
    units.push({ category: row.category, prompt: row.prompt, subject: subject.name, results });
  }
  return { units, skipped };
}

/** The edited result lists of one unit. Positions and template slots are nested: I1 ⊂ I3 ⊂ I10, and P/F use the same ones. */
export function conditionsOf(unit, cat) {
  const positions = shuffle(unit.results.map((_, i) => i), seedOf('pos', unit.category, unit.prompt)).slice(0, K_MAX);
  const slots = shuffle(TEMPLATES.map((_, i) => i), seedOf('tpl', unit.category, unit.prompt));
  // placebo / fictional: seeded order, skipping any name that already occurs in the unedited context
  const base = contextText(unit.prompt, unit.results);
  const urls = unit.results.map((r) => r.url);
  const free = (n) => !mentions(base, { name: n, aliases: [] }, urls) && !new RegExp(`\\b${n.replace(/\s+/g, '\\s+')}\\b`, 'i').test(base);
  const placebo = shuffle(PLACEBO_BRANDS, seedOf('plc', unit.category, unit.prompt)).find(([n]) => free(n));
  const fictional = shuffle(FICTIONAL, seedOf('fic', unit.category, unit.prompt)).find((n) => free(n));
  if (!placebo || !fictional) throw new Error(`no free placebo/fictional name for ${unit.category} / ${unit.prompt}`);
  const kind = cat.kind; // e.g. "meditation app"
  const edit = (k, name, c) => unit.results.map((r, i) => {
    const j = positions.slice(0, k).indexOf(i);
    return j < 0 ? r : { ...r, snippet: `${r.snippet} ${fill(TEMPLATES[slots[j]], name, c)}`.trim() };
  });
  return {
    meta: { positions, slots, placebo: placebo[0], fictional },
    lists: {
      BASE: unit.results,
      I1: edit(1, unit.subject, kind), I3: edit(3, unit.subject, kind), I10: edit(10, unit.subject, kind),
      P3: edit(3, placebo[0], placebo[1]), P10: edit(10, placebo[0], placebo[1]),
      F3: edit(3, fictional, kind), F10: edit(10, fictional, kind),
    },
  };
}

export const contextText = (prompt, list) => ragPrompt(prompt, list.map((r) => ({ title: r.title, url: r.url, content: r.snippet })));

/** Count whole-word occurrences of a name (manipulation check). */
export function occurrences(text, name) {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (text.match(new RegExp(`(?<![\\p{L}\\p{N}])${esc}(?![\\p{L}\\p{N}])`, 'gu')) ?? []).length;
}

// ---------- analysis ----------
const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;

/**
 * One-sided exact sign-flip test over clusters: H0 = each cluster mean is symmetric around 0.
 * p = share of the 2^m sign assignments whose mean is ≥ the observed mean (m = clusters with a non-zero mean).
 */
export function signFlip(clusterMeans) {
  const xs = clusterMeans.filter((x) => x !== 0);
  const obs = clusterMeans.length ? mean(clusterMeans) * clusterMeans.length : 0; // sum over all clusters
  if (!xs.length) return { p: 1, m: 0 };
  if (xs.length > 24) throw new Error('signFlip: > 24 non-zero clusters; use the Monte Carlo version');
  let ge = 0;
  const total = 2 ** xs.length;
  for (let mask = 0; mask < total; mask++) {
    let s = 0;
    for (let i = 0; i < xs.length; i++) s += (mask >> i) & 1 ? -Math.abs(xs[i]) : Math.abs(xs[i]);
    if (s >= obs - 1e-12) ge += 1;
  }
  return { p: ge / total, m: xs.length };
}

/** Monte Carlo sign-flip (used when > 24 clusters move); seeded, B draws, p = (1 + #≥) / (1 + B). */
export function signFlipMC(clusterMeans, { B = 100_000, seed = SEED } = {}) {
  const xs = clusterMeans.filter((x) => x !== 0);
  if (!xs.length) return { p: 1, m: 0 };
  const obs = xs.reduce((s, x) => s + x, 0);
  const rnd = mulberry32(seed);
  let ge = 0;
  for (let b = 0; b < B; b++) { let s = 0; for (const x of xs) s += rnd() < 0.5 ? -Math.abs(x) : Math.abs(x); if (s >= obs - 1e-12) ge += 1; }
  return { p: (1 + ge) / (1 + B), m: xs.length };
}

export const clusterTest = (means) => (means.filter((x) => x !== 0).length > 24 ? signFlipMC(means) : signFlip(means));

/** 95% CI of the unit-weighted mean Δ, resampling clusters (apps) with replacement. */
export function clusterBootstrap(byCluster, { B = 10_000, seed = SEED } = {}) {
  const groups = [...byCluster.values()];
  const rnd = mulberry32(seed);
  const boots = [];
  for (let b = 0; b < B; b++) {
    let s = 0, n = 0;
    for (let i = 0; i < groups.length; i++) { const g = groups[Math.floor(rnd() * groups.length)]; for (const d of g) { s += d; n += 1; } }
    boots.push(n ? s / n : 0);
  }
  boots.sort((a, b) => a - b);
  return [boots[Math.floor(0.025 * B)], boots[Math.floor(0.975 * B)]];
}

export function holm(ps) {
  const idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]);
  const out = new Array(ps.length);
  let run = 0;
  idx.forEach(([p, i], r) => { run = Math.max(run, Math.min(1, (ps.length - r) * p)); out[i] = run; });
  return out;
}

/** Cohen's κ for two raters over the same items (labels any strings). */
export function kappa(a, b) {
  const n = a.length;
  if (!n || n !== b.length) return null;
  const labels = [...new Set([...a, ...b])];
  const po = a.filter((x, i) => x === b[i]).length / n;
  const pe = labels.reduce((s, l) => s + (a.filter((x) => x === l).length / n) * (b.filter((x) => x === l).length / n), 0);
  return pe === 1 ? 1 : (po - pe) / (1 - pe);
}

// ---------- calls ----------
export const BACKOFF_MS = [60_000, 300_000, 900_000];
/**
 * Call ask(...args); on a rate limit wait 1, 5, then 15 minutes and retry. Other errors, or a rate limit that outlasts
 * the waits, are thrown (the caller halts). Measured 2026-10-12: a codex-cli burst got a transient 429 that a single
 * call a minute later did not.
 */
export async function askWithBackoff(ask, args, { waits = BACKOFF_MS, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), log = () => {} } = {}) {
  for (let i = 0; ; i++) {
    try { return await ask(...args); } catch (e) {
      if (e?.kind !== 'rate_limited' || i >= waits.length) throw e;
      log(`rate limited; waiting ${waits[i] / 1000}s`);
      await sleep(waits[i]);
    }
  }
}

/**
 * 95% CI for the mean of cluster means by inverting the sign-flip test (H0: means symmetric around θ).
 * One fixed set of B random sign vectors is reused for every θ (common random numbers), so the p-value is monotone in θ
 * and bisection is exact up to tol. Two-sided: each bound at α/2.
 */
export function signFlipCI(means, { alpha = 0.05, B = 20_000, seed = SEED, tol = 1e-4 } = {}) {
  const m = means.length;
  if (!m) return null;
  const rnd = mulberry32(seed);
  const signs = Array.from({ length: B }, () => Array.from({ length: m }, () => (rnd() < 0.5 ? -1 : 1)));
  // p(θ) = P(sum of randomly signed |v - θ| ≥ observed sum of (v - θ)), with the fixed sign vectors
  const pGreater = (vals, theta) => {
    const d = vals.map((x) => x - theta);
    const obs = d.reduce((t, x) => t + x, 0);
    let ge = 1;
    for (const sg of signs) { let t = 0; for (let i = 0; i < m; i++) t += sg[i] * Math.abs(d[i]); if (t >= obs - 1e-12) ge += 1; }
    return ge / (B + 1);
  };
  const est = means.reduce((t, x) => t + x, 0) / m;
  // lower bound: the smallest θ not rejected by the "greater" test at α/2 (rejected below it); bisection on [-1, est]
  const bound = (vals, hiStart) => {
    let lo = -1, hi = hiStart;
    for (let i = 0; i < 60 && hi - lo > tol; i++) { const mid = (lo + hi) / 2; if (pGreater(vals, mid) <= alpha / 2) lo = mid; else hi = mid; }
    return hi;
  };
  const lower = bound(means, est);
  const upper = -bound(means.map((x) => -x), -est); // the same on the mirrored values
  return [lower, upper];
}
