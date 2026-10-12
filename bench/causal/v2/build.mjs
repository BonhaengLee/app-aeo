#!/usr/bin/env node
// Causal study v2, step 3 — freeze units, conditions and contexts (no model call). Every context is checked: the
// subject occurs exactly k times in I_k and never elsewhere; the placebo / fictional name exactly k times in its own
// condition and never elsewhere. Any failure aborts the build.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONDITIONS, REPLICATION, conditionsOf, contextText, mentions, occurrences, seedOf, selectUnits, sha, shuffle } from './lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const readJsonl = (f) => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const K = { BASE: 0, I1: 1, I3: 3, I10: 10, P3: 3, P10: 10, F3: 3, F10: 10 };

/** Expected occurrences of [subject, placebo, fictional] per condition. */
export const expected = (cond) => [cond.startsWith('I') ? K[cond] : 0, cond.startsWith('P') ? K[cond] : 0, cond.startsWith('F') ? K[cond] : 0];

export function buildAll(categories, corpus, eligibility) {
  // latest ok row per (category, prompt)
  const latest = new Map();
  for (const r of corpus.filter((x) => x.ok)) latest.set(`${r.category}\u0000${r.prompt}`, r);
  const { units, skipped } = selectUnits([...latest.values()], eligibility, categories);
  const jobs = [];
  const contexts = new Map();
  const meta = [];
  for (const u of units) {
    const cat = categories.find((c) => c.id === u.category);
    const { meta: m, lists } = conditionsOf(u, cat);
    for (const cond of CONDITIONS) {
      const text = contextText(u.prompt, lists[cond]);
      const got = [occurrences(text, u.subject), occurrences(text, m.placebo), occurrences(text, m.fictional)];
      const want = expected(cond);
      // the question itself never names the subject (selection rule); placebo/fictional names are not real candidates
      if (got.some((g, i) => g !== want[i])) throw new Error(`manipulation check failed: ${u.category} / ${u.prompt} / ${cond}: got ${got} want ${want}`);
      // and no mention the counts cannot see (aliases, case, URLs) where the subject must be absent
      const subjectApp = cat.apps.find((a) => a.name === u.subject);
      if (!cond.startsWith('I') && mentions(text, subjectApp, lists[cond].map((r) => r.url))) throw new Error(`subject visible in ${cond}: ${u.category} / ${u.prompt}`);
      // the id covers the subject and the exact context: a rebuilt design never inherits old answers
      const id = sha(`v2\u0000${u.category}\u0000${u.prompt}\u0000${cond}\u0000${u.subject}\u0000${sha(text)}`).slice(0, 16);
      contexts.set(id, text);
      jobs.push({ id, category: u.category, prompt: u.prompt, condition: cond, subject: u.subject, placebo: m.placebo, fictional: m.fictional, sha256: sha(text), chars: text.length });
    }
    meta.push({ category: u.category, prompt: u.prompt, subject: u.subject, results: u.results.length, resultsSha256: sha(JSON.stringify(u.results)), ...m });
  }
  const replication = shuffle(meta.map((u) => `${u.category}\u0000${u.prompt}`), seedOf('replication')).slice(0, REPLICATION.units).map((k) => k.split('\u0000'));
  return { units: meta, skipped, jobs, contexts, replication };
}

async function main() {
  const { categories } = JSON.parse(fs.readFileSync(path.join(HERE, 'categories.json'), 'utf8'));
  const corpus = readJsonl(path.join(HERE, 'corpus.jsonl'));
  const eligibility = readJsonl(path.join(HERE, 'eligibility.jsonl')).filter((r) => r.ok);
  const b = buildAll(categories, corpus, eligibility);
  const ctxDir = path.join(HERE, 'contexts');
  fs.mkdirSync(ctxDir, { recursive: true });
  for (const [id, text] of b.contexts) fs.writeFileSync(path.join(ctxDir, `${id}.txt`), text);
  const perApp = {};
  for (const u of b.units) perApp[u.subject] = (perApp[u.subject] ?? 0) + 1;
  const out = { builtAt: new Date().toISOString(), skipped: b.skipped, perApp, replication: b.replication, units: b.units, jobs: b.jobs };
  fs.writeFileSync(path.join(HERE, 'conditions.json'), `${JSON.stringify(out, null, 1)}\n`);
  console.log(JSON.stringify({ units: b.units.length, apps: Object.keys(perApp).length, skipped: b.skipped, jobs: b.jobs.length, perApp }, null, 1));
  return 0;
}

const isMain = process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main().then((c) => { process.exitCode = c; }, (e) => { console.error(e.stack ?? e.message); process.exitCode = 1; });
