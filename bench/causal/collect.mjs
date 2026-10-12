#!/usr/bin/env node
// Causal study, step 2 — ask the answer engine every frozen context REPEATS times. Resumable: only missing or
// failed (job, repeat) pairs are asked. Exit codes: 0 complete · 10 partial · 1 fatal · 2 bad input.
// The engine has NO web search here: it must answer from the given pages (and its own knowledge), so that the only
// thing that differs between conditions is the edit.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONSUMER_ROLE, HALTING_KINDS, ProviderError, searchAskerWithSystem } from '../../src/providers.mjs';
import { analyse } from '../../src/extract.mjs';
import { sha } from './build.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ENGINE = 'codex-cli';
export const REPEATS = 3;
export const CONCURRENCY = 3;
export const TIMEOUT_MS = 300_000;

export function pending(jobs, done) {
  const ok = new Set(done.filter((r) => r.ok).map((r) => `${r.id}#${r.repeat}`));
  return jobs.flatMap((j) => Array.from({ length: REPEATS }, (_, i) => ({ ...j, repeat: i + 1 }))).filter((j) => !ok.has(`${j.id}#${j.repeat}`));
}

/** Study files: the main study (default) or the follow-up "dose". */
export const studyFiles = (study = 'main') => (study === 'main'
  ? { conditions: 'conditions.json', results: 'results.jsonl', summary: 'results.json', report: 'RESULTS.md' }
  : { conditions: `conditions-${study}.json`, results: `results-${study}.jsonl`, summary: `results-${study}.json`, report: `RESULTS-${study.toUpperCase()}.md` });

async function main() {
  const files = studyFiles(process.argv[2]);
  const cond = JSON.parse(fs.readFileSync(path.join(HERE, files.conditions), 'utf8'));
  const out = path.join(HERE, files.results);
  const done = fs.existsSync(out) ? fs.readFileSync(out, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
  const todo = pending(cond.jobs, done);
  console.log(`causal collect: ${cond.jobs.length} jobs × ${REPEATS} = ${cond.jobs.length * REPEATS}; ${todo.length} to ask (${ENGINE})`);
  const askEngine = searchAskerWithSystem(ENGINE, CONSUMER_ROLE);
  let pass = 0, fail = 0, halted = null;
  const queue = [...todo];
  async function worker() {
    for (let j = queue.shift(); j && !halted; j = queue.shift()) {
      if (!/^[a-f0-9]{16}$/.test(j.id)) { halted = new Error(`bad job id ${j.id}`); break; }
      const text = fs.readFileSync(path.join(HERE, 'contexts', `${j.id}.txt`), 'utf8');
      if (sha(text) !== j.sha256) { halted = new Error(`context ${j.id} differs from the frozen sha256`); break; }
      const t = cond.targets[j.category];
      const row = { id: j.id, category: j.category, condition: j.condition, prompt: j.prompt, repeat: j.repeat, at: new Date().toISOString(), engine: ENGINE };
      try {
        const started = Date.now();
        const r = await askEngine(text, { timeoutMs: TIMEOUT_MS });
        const a = analyse(r.text, t.target, t.competitors);
        Object.assign(row, { ok: true, ms: Date.now() - started, model: r.model, searches: r.searches ?? 0, text: r.text, targetNamed: !!a.target, named: a.mentions.map((m) => m.name) });
        pass += 1;
      } catch (e) {
        Object.assign(row, { ok: false, error: String(e.message).slice(0, 300), kind: e.kind ?? null });
        fail += 1;
        if (e instanceof ProviderError && HALTING_KINDS.has(e.kind)) halted = e;
      }
      fs.appendFileSync(out, `${JSON.stringify(row)}\n`);
      if ((pass + fail) % 25 === 0) console.log(`  ${pass + fail}/${todo.length} (fail ${fail})`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  const left = pending(cond.jobs, fs.readFileSync(out, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))).length;
  if (halted) console.log(`halted: ${halted.message}`);
  console.log(`=== causal collect: PASS ${pass} / FAIL ${fail} === (${left} still missing)`);
  return left === 0 ? 0 : pass ? 10 : 1;
}

const isMain = process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main().then((c) => { process.exitCode = c; }, (e) => { console.error(e.stack ?? e.message); process.exitCode = 1; });
