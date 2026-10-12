#!/usr/bin/env node
// Causal study v2, step 4 — ask the answer engine every frozen context.
//   node collect.mjs primary      codex-cli, web search disabled, pinned model + effort, REPEATS per context
//   node collect.mjs replication  claude-cli (no tools), REPLICATION.units units × REPLICATION.conditions × repeats
// Each context's sha256 is re-checked before asking. Jobs are asked in a seeded random order, so conditions are
// interleaved in time (no condition runs in a later session than another). Resumable. Exit codes 0 / 10 / 1 / 2.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONSUMER_ROLE, HALTING_KINDS, ProviderError, searchAskerWithSystem } from '../../../src/providers.mjs';
import { findMention } from '../../../src/extract.mjs';
import { PRIMARY, REPEATS, REPLICATION, askWithBackoff, seedOf, sha, shuffle } from './lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const CONCURRENCY = Number(process.env.V2_WORKERS ?? 3); // D9: raised by env when the provider allows
export const TIMEOUT_MS = 300_000;
const readJsonl = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);

export const STUDIES = {
  primary: { engine: PRIMARY.engine, model: PRIMARY.model, config: [`model_reasoning_effort="${PRIMARY.effort}"`], repeats: REPEATS, file: 'results-primary.jsonl' },
  replication: { engine: REPLICATION.engine, model: REPLICATION.model, config: [], repeats: REPLICATION.repeats, file: 'results-replication.jsonl' },
};

export function jobsFor(study, cond) {
  if (study === 'primary') return cond.jobs;
  const keys = new Set(cond.replication.map(([c, p]) => `${c}\u0000${p}`));
  return cond.jobs.filter((j) => keys.has(`${j.category}\u0000${j.prompt}`) && REPLICATION.conditions.includes(j.condition));
}

export function pending(jobs, repeats, done) {
  const ok = new Set(done.filter((r) => r.ok).map((r) => `${r.id}#${r.repeat}`));
  const all = jobs.flatMap((j) => Array.from({ length: repeats }, (_, i) => ({ ...j, repeat: i + 1 })));
  return shuffle(all, seedOf('ask-order')).filter((j) => !ok.has(`${j.id}#${j.repeat}`));
}

/** What the answer names, per tracked entity; the subject also matches its aliases. */
export function score(text, job, apps) {
  const subject = apps.find((a) => a.name === job.subject) ?? { name: job.subject, aliases: [] };
  return {
    subjectNamed: !!findMention(text, subject),
    placeboNamed: !!findMention(text, { name: job.placebo, aliases: [] }),
    fictionalNamed: !!findMention(text, { name: job.fictional, aliases: [] }),
  };
}

async function main() {
  const study = process.argv[2];
  const S = STUDIES[study];
  if (!S) { console.error('usage: node collect.mjs primary|replication'); return 2; }
  const cond = JSON.parse(fs.readFileSync(path.join(HERE, 'conditions.json'), 'utf8'));
  const { categories } = JSON.parse(fs.readFileSync(path.join(HERE, 'categories.json'), 'utf8'));
  const out = path.join(HERE, S.file);
  const jobs = jobsFor(study, cond);
  const queue = pending(jobs, S.repeats, readJsonl(out));
  console.log(`v2 collect ${study}: ${jobs.length} contexts × ${S.repeats}; ${queue.length} to ask (${S.engine} ${S.model})`);
  const ask = searchAskerWithSystem(S.engine, CONSUMER_ROLE);
  let pass = 0, fail = 0, halted = null;
  async function worker() {
    for (let j = queue.shift(); j && !halted; j = queue.shift()) {
      if (!/^[a-f0-9]{16}$/.test(j.id)) { halted = new Error(`bad job id ${j.id}`); break; }
      const text = fs.readFileSync(path.join(HERE, 'contexts', `${j.id}.txt`), 'utf8');
      if (sha(text) !== j.sha256) { halted = new Error(`context ${j.id} differs from the frozen sha256`); break; }
      const apps = categories.find((c) => c.id === j.category).apps;
      const row = { id: j.id, sha256: j.sha256, category: j.category, prompt: j.prompt, condition: j.condition, subject: j.subject, placebo: j.placebo, fictional: j.fictional, repeat: j.repeat, at: new Date().toISOString(), engine: S.engine };
      try {
        const started = Date.now();
        const r = await askWithBackoff(ask, [text, { model: S.model, config: S.config, timeoutMs: TIMEOUT_MS }], { log: console.log });
        Object.assign(row, { ok: true, ms: Date.now() - started, model: r.model, searches: r.searches ?? 0, text: r.text, ...score(r.text, j, apps) });
        pass += 1;
      } catch (e) {
        Object.assign(row, { ok: false, error: String(e.message).slice(0, 300), kind: e.kind ?? null });
        fail += 1;
        if (e instanceof ProviderError && HALTING_KINDS.has(e.kind)) halted = e;
      }
      fs.appendFileSync(out, `${JSON.stringify(row)}\n`);
      if ((pass + fail) % 50 === 0) console.log(`  ${pass + fail}/${queue.length + pass + fail} (fail ${fail})`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  const left = pending(jobs, S.repeats, readJsonl(out)).length;
  if (halted) console.log(`halted: ${halted.message}`);
  console.log(`=== 종료: PASS ${pass} / FAIL ${fail} === (${left} still missing)`);
  return left === 0 ? 0 : pass ? 10 : 1;
}

const isMain = process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main().then((c) => { process.exitCode = c; }, (e) => { console.error(e.stack ?? e.message); process.exitCode = 1; });
