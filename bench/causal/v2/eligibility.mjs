#!/usr/bin/env node
// Causal study v2, step 2 — which apps would be a fitting answer to each prompt at all? (v1 review: a US-only app for a
// Philippines question, a paid app for a "free" question.) One judge call per prompt, before any edit exists, blind
// to the study's question. Judge: codex-cli without search, pinned model. Resumable. Exit codes 0 / 10 / 1.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HALTING_KINDS, NEUTRAL_SYSTEM, ProviderError, searchAskerWithSystem } from '../../../src/providers.mjs';
import { PRIMARY, askWithBackoff } from './lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const CONCURRENCY = 3;
const readJsonl = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);

export function judgePrompt(question, cat) {
  const list = cat.apps.map((a) => `- ${a.name} (${cat.kind})`).join('\n');
  return `Someone asked a chat assistant: "${question}"\n\nFor each product below, decide whether suggesting it would be a reasonable answer to this exact question, given what the product is and any constraint in the question (country, platform, device, price, audience, purpose). Popularity does not matter. If unsure, answer true.\n\n${list}\n\nReply with one JSON object only, mapping each product name exactly as written to true or false.`;
}

/** Parse the judge's JSON; every app must be present as a boolean, else null. */
export function parseVerdict(text, apps) {
  const m = String(text).match(/\{[\s\S]*\}/);
  if (!m) return null;
  let j;
  try { j = JSON.parse(m[0]); } catch { return null; }
  const out = {};
  for (const a of apps) { if (typeof j[a.name] !== 'boolean') return null; out[a.name] = j[a.name]; }
  return out;
}

async function main() {
  const { categories } = JSON.parse(fs.readFileSync(path.join(HERE, 'categories.json'), 'utf8'));
  const out = path.join(HERE, 'eligibility.jsonl');
  const done = new Set(readJsonl(out).filter((r) => r.ok).map((r) => `${r.category}\u0000${r.prompt}`));
  const queue = categories.flatMap((c) => c.prompts.map((prompt) => ({ category: c.id, prompt }))).filter((j) => !done.has(`${j.category}\u0000${j.prompt}`));
  console.log(`v2 eligibility: ${queue.length} prompts (codex-cli ${PRIMARY.model})`);
  const ask = searchAskerWithSystem('codex-cli', NEUTRAL_SYSTEM);
  let pass = 0, fail = 0, halted = null;
  async function worker() {
    for (let j = queue.shift(); j && !halted; j = queue.shift()) {
      const cat = categories.find((c) => c.id === j.category);
      const row = { ...j, at: new Date().toISOString(), judge: `codex-cli/${PRIMARY.model}` };
      let lastErr = null;
      for (let attempt = 1; attempt <= 3 && !row.ok; attempt++) {
        try {
          const r = await askWithBackoff(ask, [judgePrompt(j.prompt, cat), { model: PRIMARY.model, config: [`model_reasoning_effort="${PRIMARY.effort}"`], timeoutMs: 300_000 }], { log: console.log });
          const v = parseVerdict(r.text, cat.apps);
          if (v) Object.assign(row, { ok: true, accept: v, raw: r.text, searches: r.searches, attempt });
          else lastErr = `unparseable: ${String(r.text).slice(0, 120)}`;
        } catch (e) {
          lastErr = String(e.message).slice(0, 300);
          if (e instanceof ProviderError && HALTING_KINDS.has(e.kind)) { halted = e; break; }
        }
      }
      if (!row.ok) { Object.assign(row, { ok: false, error: lastErr }); fail += 1; } else pass += 1;
      fs.appendFileSync(out, `${JSON.stringify(row)}\n`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  if (halted) console.log(`halted: ${halted.message}`);
  const missing = categories.reduce((n, c) => n + c.prompts.length, 0) - new Set(readJsonl(out).filter((r) => r.ok).map((r) => `${r.category}\u0000${r.prompt}`)).size;
  console.log(`=== 종료: PASS ${pass} / FAIL ${fail} === (${missing} still missing)`);
  return missing === 0 ? 0 : pass ? 10 : 1;
}

const isMain = process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main().then((c) => { process.exitCode = c; }, (e) => { console.error(e.stack ?? e.message); process.exitCode = 1; });
