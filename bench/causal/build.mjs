#!/usr/bin/env node
// Causal study, step 1 — freeze the experimental conditions. No model is called here.
//
// For each prompt of a benchmark run, the context is the pages that the live engine actually read for that prompt
// (checked by `diagnose`). Each condition is that context with one edit of the kind `diagnose` prescribes.
// See PREREGISTRATION.md. Usage: node bench/causal/build.mjs <dir-with-diagnosed-runs>
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findMention } from '../../src/extract.mjs';
import { ragPrompt } from '../../src/ground.mjs';
import { latestRows } from '../../src/run.mjs';
import { LEVER_KINDS, sourceKey } from '../../src/diagnose.mjs';
import { mulberry32 } from '../../src/report.mjs';
import { lookup } from '../../src/store.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const CATEGORIES = ['budgeting', 'meditation', 'language'];
export const ENGINE_OF_RUN = 'codex-search';
export const K = 5;              // pages per context
export const MIN_PAGES = 3;      // a prompt needs at least this many checked pages
export const EXCERPT = 3000;     // characters per page excerpt
export const BEFORE = 400;       // excerpt starts this far before the first app mention
export const CAP = 12;           // prompts per category per hypothesis
export const SEED = 13;
export const PLACEBO = 'Many apps on this list offer a free trial, so compare the plans before you subscribe.';
export const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const pageFile = (dir, key) => path.join(dir, 'pages', `${crypto.createHash('sha1').update(key).digest('hex')}.txt`);

/** The part of a page around its list of apps: from BEFORE characters ahead of the first configured app mention. */
export function excerpt(text, apps) {
  const offs = apps.map((a) => findMention(text, a)?.offset).filter((x) => x != null);
  const start = offs.length ? Math.max(0, Math.min(...offs) - BEFORE) : 0;
  return text.slice(start, start + EXCERPT).trim();
}

/** [start, end) of the sentence holding a name at [offset, offset+len). Page text has no line breaks, so menus and
 *  lists have no sentence marks: look ≤ 200 characters each way, and fall back to the name's own edges. */
export const SENTENCE_REACH = 200;
export function sentenceAt(text, offset, len = 0) {
  let s = offset;
  while (s > 0 && offset - s < SENTENCE_REACH && !/[.!?]\s/.test(text.slice(s - 2, s))) s -= 1;
  if (s > 0 && !/[.!?]\s/.test(text.slice(s - 2, s))) s = offset;
  const m = /[.!?](\s|$)/.exec(text.slice(offset + len, offset + len + SENTENCE_REACH));
  const e = m ? offset + len + m.index + 1 : offset + len;
  return [s, e];
}

/** Where an app is first named in text: offset and length of the matched name. */
export function firstName(text, app) {
  const m = findMention(text, app);
  if (!m) return null;
  const alias = m.matchedBy.startsWith('name:') ? m.matchedBy.slice(5) : '';
  return { offset: m.offset, len: alias.length };
}

export function insertAfterFirst(ex, apps, line) {
  const first = apps.map((a) => firstName(ex, a)).filter(Boolean).sort((a, b) => a.offset - b.offset)[0];
  const [, e] = sentenceAt(ex, first.offset, first.len);
  return `${ex.slice(0, e)} ${line} ${ex.slice(e).trimStart()}`;
}

export function promote(ex, app) {
  const { offset: off, len } = firstName(ex, app);
  const [s, e] = sentenceAt(ex, off, len);
  if (s === 0) return null; // already first: nothing to promote
  return `${ex.slice(s, e).trim()} ${(ex.slice(0, s).trimEnd() + ex.slice(e)).trim()}`;
}

/** First declarative sentence (not a question, ≥ 30 characters) of the App Store description, ≤ 200 characters:
 *  what an editor would paste into a list. YNAB's description opens with "Have you ever worried about money?". */
export function blurb(name, description) {
  // Bullet marks ("* Apps of the Year Winner * …", Insight Timer) are dropped; the cut is at a word boundary.
  const sentences = String(description ?? '').replace(/[*•]+/g, ' ').replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s/);
  const first = (sentences.find((x) => !x.trim().endsWith('?') && x.trim().length >= 30) ?? sentences[0] ?? '').trim();
  const cut = first.length <= 200 ? first : first.slice(0, 200).replace(/\s+\S*$/, '');
  return `${name}: ${cut}`.trim();
}

function shuffle(xs, seed) {
  const rnd = mulberry32(seed);
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** Build one category: contexts, eligibility, and the edited contexts. */
export function buildCategory(cat, { cfg, rows, diagnosis, pageText, blurbs }) {
  const apps = [cfg.target, ...(cfg.competitors ?? [])];
  const src = new Map(diagnosis.engines.find((e) => e.provider === ENGINE_OF_RUN).sources.map((s) => [s.key, s]));
  const byPrompt = new Map();
  for (const r of rows.filter((x) => x.ok && x.provider === ENGINE_OF_RUN)) byPrompt.set(r.prompt, [...(byPrompt.get(r.prompt) ?? []), r]);
  const units = [];
  for (const [prompt, R] of [...byPrompt].sort((a, b) => a[0].localeCompare(b[0]))) {
    // reads per checked third-party page, by the diagnosis' own page keys
    const reads = new Map();
    const keySets = R.map((r) => new Set((r.citations ?? []).map(keyOf)));
    for (const s of src.values()) {
      if (!LEVER_KINDS.includes(s.kind) || !s.page?.ok) continue;
      const text = pageText(s.key);
      if (!text) continue;
      const n = keySets.filter((ks) => ks.has(s.key)).length;
      if (n) reads.set(s.key, n);
    }
    const keys = [...reads].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, K).map(([k]) => k);
    if (keys.length < MIN_PAGES) continue;
    const pages = keys.map((k) => {
      const ex = excerpt(pageText(k), apps);
      const lists = Object.fromEntries(apps.map((a) => [a.name, !!findMention(ex, a)]));
      return { key: k, url: src.get(k).url, host: src.get(k).host, lift: src.get(k).lift, reads: reads.get(k), excerpt: ex, lists, listsTarget: lists[cfg.target.name] };
    });
    const as = (edited) => pages.map((p, j) => ({ page: p, content: edited(p, j) })).filter((x) => x.content != null);
    const unit = { category: cat, prompt, pages, conditions: { BASE: as((p) => p.excerpt) }, subject: { H2: cfg.target.name, H3: cfg.target.name } };
    // H1 subject: an app no page of this context names, while some page names another configured app. The target if it
    // qualifies, else a seeded pick among qualifying competitors (the mechanism tested is the same for any app).
    const absent = apps.filter((a) => !pages.some((p) => p.lists[a.name]));
    const pickSeed = parseInt(sha(`${cat}\u0000${prompt}`).slice(0, 8), 16);
    const subject = absent.find((a) => a === cfg.target) ?? absent[pickSeed % Math.max(1, absent.length)];
    if (subject) {
      const others = apps.filter((a) => a !== subject);
      const i = pages.findIndex((p) => others.some((a) => p.lists[a.name]));
      if (i >= 0) {
        const edit = (line) => as((p, j) => (j === i ? insertAfterFirst(p.excerpt, others.filter((a) => p.lists[a.name]), line) : p.excerpt));
        unit.conditions.INSERT = edit(blurbs[subject.name]);
        unit.conditions.PLACEBO = edit(PLACEBO);
        unit.insertAt = pages[i].key;
        unit.subject.H1 = subject.name;
      }
    }
    const withTarget = pages.filter((p) => p.listsTarget);
    if (withTarget.length) {
      const i = pages.indexOf(withTarget[0]);
      const promoted = promote(pages[i].excerpt, cfg.target);
      if (promoted) { unit.conditions.PROMOTE = as((p, j) => (j === i ? promoted : p.excerpt)); unit.promoteAt = pages[i].key; }
      const ranked = withTarget.filter((p) => p.lift != null);
      if (ranked.length >= 2) {
        const hi = ranked.reduce((m, p) => (p.lift > m.lift ? p : m));
        const lo = ranked.reduce((m, p) => (p.lift < m.lift ? p : m));
        if (hi.lift > lo.lift) {
          unit.conditions.ABLATE_HI = as((p) => (p === hi ? null : p.excerpt));
          unit.conditions.ABLATE_LO = as((p) => (p === lo ? null : p.excerpt));
          unit.ablate = { hi: hi.key, hiLift: hi.lift, lo: lo.key, loLift: lo.lift };
        }
      }
    }
    units.push(unit);
  }
  return units;
}

const keyOf = (u) => sourceKey(u)?.key ?? null;

export const HYPOTHESES = Object.freeze({
  H1: ['INSERT', 'PLACEBO'],
  H2: ['PROMOTE', 'BASE'],
  H3: ['ABLATE_LO', 'ABLATE_HI'], // removing the lower-lift page leaves a higher rate than removing the higher-lift page
});

/** Per hypothesis and category, a seeded sample of at most CAP eligible prompts, as "category\0prompt\0subject". */
export function sample(units) {
  const pick = {};
  for (const [h, conds] of Object.entries(HYPOTHESES)) {
    pick[h] = [];
    for (const cat of CATEGORIES) {
      const eligible = units.filter((u) => u.category === cat && conds.every((c) => u.conditions[c]));
      pick[h].push(...shuffle(eligible, SEED + h.charCodeAt(1)).slice(0, CAP).map((u) => `${u.category}\u0000${u.prompt}\u0000${u.subject[h]}`));
    }
  }
  return pick;
}

async function main() {
  const srcDir = process.argv[2];
  if (!srcDir) { console.error('usage: node bench/causal/build.mjs <dir-with-diagnosed-runs>'); return 2; }
  const allUnits = [];
  const targets = {};
  for (const cat of CATEGORIES) {
    const dir = path.join(srcDir, cat);
    const cfg = JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8'));
    const diagnosis = JSON.parse(fs.readFileSync(path.join(dir, 'diagnosis.json'), 'utf8'));
    const rows = latestRows(path.join(dir, 'responses.jsonl'));
    const apps = [cfg.target, ...cfg.competitors];
    const store = await lookup(apps.map((a) => a.appStoreId));
    const blurbs = {};
    apps.forEach((a, i) => { if (!store[i]?.description) throw new Error(`${cat}: no App Store description for ${a.name}`); blurbs[a.name] = blurb(a.name, store[i].description); });
    targets[cat] = { target: cfg.target, competitors: cfg.competitors, blurbs };
    const pageText = (k) => { const f = pageFile(dir, k); return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null; };
    allUnits.push(...buildCategory(cat, { cfg, rows, diagnosis, pageText, blurbs }));
  }
  const picks = sample(allUnits);
  const unitKey = (k) => k.split('\u0000').slice(0, 2).join('\u0000');
  const chosen = new Set(Object.values(picks).flat().map(unitKey));
  const ctxDir = path.join(HERE, 'contexts');
  fs.mkdirSync(ctxDir, { recursive: true });
  const jobs = [];
  for (const u of allUnits.filter((x) => chosen.has(`${x.category}\u0000${x.prompt}`))) {
    const needed = new Set(['BASE', ...Object.entries(HYPOTHESES).filter(([h]) => picks[h].some((k) => unitKey(k) === `${u.category}\u0000${u.prompt}`)).flatMap(([, c]) => c)]); // BASE always: manipulation checks
    for (const cond of [...needed].sort()) {
      const results = u.conditions[cond].map(({ page, content }) => ({ title: page.host, url: page.url, content }));
      const text = ragPrompt(u.prompt, results);
      const id = sha(`${u.category}\u0000${u.prompt}\u0000${cond}`).slice(0, 16);
      fs.writeFileSync(path.join(ctxDir, `${id}.txt`), text);
      jobs.push({ id, category: u.category, prompt: u.prompt, condition: cond, sha256: sha(text), chars: text.length });
    }
  }
  const meta = allUnits.filter((x) => chosen.has(`${x.category}\u0000${x.prompt}`)).map((u) => ({ category: u.category, prompt: u.prompt, pages: u.pages.map(({ excerpt: ex, ...p }) => ({ ...p, excerptSha256: sha(ex) })), subject: u.subject, insertAt: u.insertAt ?? null, promoteAt: u.promoteAt ?? null, ablate: u.ablate ?? null }));
  const eligibleCounts = Object.fromEntries(Object.entries(HYPOTHESES).map(([h, conds]) => [h, Object.fromEntries(CATEGORIES.map((c) => [c, allUnits.filter((u) => u.category === c && conds.every((k) => u.conditions[k])).length]))]));
  const out = { builtAt: new Date().toISOString(), params: { K, MIN_PAGES, EXCERPT, BEFORE, CAP, SEED, PLACEBO }, targets, eligibleCounts, picks: Object.fromEntries(Object.entries(picks).map(([h, ks]) => [h, ks.map((k) => k.split('\u0000'))])), units: meta, jobs };
  fs.writeFileSync(path.join(HERE, 'conditions.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ units: allUnits.length, eligibleCounts, picked: Object.fromEntries(Object.entries(picks).map(([h, v]) => [h, v.length])), jobs: jobs.length }, null, 2));
  return 0;
}

const isMain = process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main().then((c) => { process.exitCode = c; }, (e) => { console.error(e.stack ?? e.message); process.exitCode = 1; });
