#!/usr/bin/env node
// Causal study v2, step 1 — what does the live engine receive? Ask codex-search every frozen prompt once and keep the
// search results it received (`seen`: title + snippet per result). These lists become the experimental contexts.
// Resumable. Exit codes: 0 complete · 10 partial · 1 fatal.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HALTING_KINDS, ProviderError, SEARCH_SYSTEM, searchAskerWithSystem } from '../../../src/providers.mjs';
import { findMention } from '../../../src/extract.mjs';
import { PRIMARY, askWithBackoff } from './lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const CONCURRENCY = 3;
export const TIMEOUT_MS = 420_000;
const readJsonl = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);

export function todo(categories, done) {
  const ok = new Set(done.filter((r) => r.ok).map((r) => `${r.category}\u0000${r.prompt}`));
  return categories.flatMap((c) => c.prompts.map((prompt) => ({ category: c.id, prompt }))).filter((j) => !ok.has(`${j.category}\u0000${j.prompt}`));
}

async function main() {
  const { categories } = JSON.parse(fs.readFileSync(path.join(HERE, 'categories.json'), 'utf8'));
  const out = path.join(HERE, 'corpus.jsonl');
  const queue = todo(categories, readJsonl(out));
  console.log(`v2 corpus: ${queue.length} prompts to ask (codex-search, ${PRIMARY.model}, effort ${PRIMARY.effort})`);
  const ask = searchAskerWithSystem('codex-search', SEARCH_SYSTEM);
  let pass = 0, fail = 0, halted = null;
  async function worker() {
    for (let j = queue.shift(); j && !halted; j = queue.shift()) {
      const cat = categories.find((c) => c.id === j.category);
      const row = { ...j, at: new Date().toISOString(), engine: 'codex-search' };
      try {
        const r = await askWithBackoff(ask, [j.prompt, { model: PRIMARY.model, config: [`model_reasoning_effort="${PRIMARY.effort}"`], timeoutMs: TIMEOUT_MS }], { log: console.log });
        Object.assign(row, { ok: true, model: r.model, searches: r.searches, seen: r.seen, queries: r.searchQueries, text: r.text, named: cat.apps.filter((a) => findMention(r.text, a)).map((a) => a.name) });
        pass += 1;
      } catch (e) {
        Object.assign(row, { ok: false, error: String(e.message).slice(0, 300), kind: e.kind ?? null });
        fail += 1;
        if (e instanceof ProviderError && HALTING_KINDS.has(e.kind)) halted = e;
      }
      fs.appendFileSync(out, `${JSON.stringify(row)}\n`);
      if ((pass + fail) % 10 === 0) console.log(`  ${pass + fail} (fail ${fail})`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  const left = todo(categories, readJsonl(out)).length;
  if (halted) console.log(`halted: ${halted.message}`);
  console.log(`=== 종료: PASS ${pass} / FAIL ${fail} === (${left} still missing)`);
  return left === 0 ? 0 : pass ? 10 : 1;
}

const isMain = process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main().then((c) => { process.exitCode = c; }, (e) => { console.error(e.stack ?? e.message); process.exitCode = 1; });
