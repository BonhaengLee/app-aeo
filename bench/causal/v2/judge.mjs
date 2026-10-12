#!/usr/bin/env node
// Causal study v2, step 5 — is a named product actually recommended? (v1 review: "named" included caveats and a
// misattribution.) Every answer that names the subject or the fictional product is labelled by two judges, blind to
// the condition and the context: they see the question, the answer and the product name only.
//   node judge.mjs <primary|replication> <codex|claude>
// Labels: RECOMMENDED (offered as an option the person could choose) · MENTIONED (named, not offered: unsuitable,
// unavailable, warned against, or only described) · NOT_PRODUCT (the word is not that product). Exit codes 0 / 10 / 1 / 2.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HALTING_KINDS, NEUTRAL_SYSTEM, ProviderError, searchAskerWithSystem } from '../../../src/providers.mjs';
import { PRIMARY, REPLICATION, askWithBackoff, seedOf, shuffle } from './lib.mjs';
import { STUDIES } from './collect.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const LABELS = ['RECOMMENDED', 'MENTIONED', 'NOT_PRODUCT'];
export const JUDGES = {
  codex: { engine: 'codex-cli', model: PRIMARY.model, config: [`model_reasoning_effort="${PRIMARY.effort}"`] },
  claude: { engine: 'claude-cli', model: REPLICATION.model, config: [] },
};
export const CONCURRENCY = Number(process.env.V2_WORKERS ?? 3); // D9: raised by env when the provider allows
const readJsonl = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);

export const itemKey = (r, entity) => `${r.id}#${r.repeat}#${entity}`;

/** Items to judge: one per (answer, named entity). */
export function items(rows) {
  const out = [];
  for (const r of rows.filter((x) => x.ok && !(x.searches > 0))) {
    if (r.subjectNamed) out.push({ key: itemKey(r, 'subject'), name: r.subject, question: r.prompt, answer: r.text });
    if (r.fictionalNamed) out.push({ key: itemKey(r, 'fictional'), name: r.fictional, question: r.prompt, answer: r.text });
  }
  return out;
}

export function judgePrompt({ name, question, answer }) {
  return `Below is a question someone asked a chat assistant, and the assistant's answer.\n\nQuestion: ${question}\n\nAnswer:\n"""\n${answer}\n"""\n\nHow does the answer treat "${name}"? Choose one label:\n- RECOMMENDED: the answer offers ${name} as an option the person could choose for their question (a pick, an alternative, or one item in a list of suggestions).\n- MENTIONED: the answer names ${name} but does not offer it as an option (for example: says it does not fit, is unavailable, warns against it, or only describes it).\n- NOT_PRODUCT: the text "${name}" in the answer does not refer to the product ${name}.\n\nReply with JSON only: {"label": "RECOMMENDED" | "MENTIONED" | "NOT_PRODUCT"}`;
}

export function parseLabel(text) {
  const m = String(text).match(/\{[\s\S]*?\}/);
  if (!m) return null;
  try { const l = JSON.parse(m[0]).label; return LABELS.includes(l) ? l : null; } catch { return null; }
}

async function main() {
  const [study, judge] = process.argv.slice(2);
  if (!STUDIES[study] || !JUDGES[judge]) { console.error('usage: node judge.mjs primary|replication codex|claude'); return 2; }
  const J = JUDGES[judge];
  const rows = readJsonl(path.join(HERE, STUDIES[study].file));
  const out = path.join(HERE, `judgments-${study}-${judge}.jsonl`);
  const done = new Set(readJsonl(out).filter((r) => r.ok).map((r) => r.key));
  const queue = shuffle(items(rows), seedOf('judge', study, judge)).filter((x) => !done.has(x.key));
  console.log(`v2 judge ${study}/${judge}: ${queue.length} items`);
  const ask = searchAskerWithSystem(J.engine, NEUTRAL_SYSTEM);
  let pass = 0, fail = 0, halted = null;
  async function worker() {
    for (let it = queue.shift(); it && !halted; it = queue.shift()) {
      const row = { key: it.key, judge: `${J.engine}/${J.model}`, at: new Date().toISOString() };
      let lastErr = null;
      for (let attempt = 1; attempt <= 3 && !row.ok; attempt++) {
        try {
          const r = await askWithBackoff(ask, [judgePrompt(it), { model: J.model, config: J.config, timeoutMs: 300_000 }], { log: console.log });
          const label = parseLabel(r.text);
          if (label) Object.assign(row, { ok: true, label, model: r.model, attempt });
          else lastErr = `unparseable: ${String(r.text).slice(0, 120)}`;
        } catch (e) {
          lastErr = String(e.message).slice(0, 300);
          if (e instanceof ProviderError && HALTING_KINDS.has(e.kind)) { halted = e; break; }
        }
      }
      if (row.ok) pass += 1; else { Object.assign(row, { ok: false, error: lastErr }); fail += 1; }
      fs.appendFileSync(out, `${JSON.stringify(row)}\n`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  const left = items(rows).filter((x) => !new Set(readJsonl(out).filter((r) => r.ok).map((r) => r.key)).has(x.key)).length;
  if (halted) console.log(`halted: ${halted.message}`);
  console.log(`=== 종료: PASS ${pass} / FAIL ${fail} === (${left} still missing)`);
  return left === 0 ? 0 : pass ? 10 : 1;
}

const isMain = process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main().then((c) => { process.exitCode = c; }, (e) => { console.error(e.stack ?? e.message); process.exitCode = 1; });
