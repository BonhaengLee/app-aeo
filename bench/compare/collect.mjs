#!/usr/bin/env node
// Comparison study runner (PREREGISTRATION.md §3). Resumable: re-running asks only what is missing.
//   node bench/compare/collect.mjs dev-score <variant.txt>     score an expert-prompt variant on the development set (§3.3)
//   node bench/compare/collect.mjs collect <category-id|all>   T, R, E, N and audits for held-out categories, one at a time
// Exit codes: 0 complete · 10 partial (e.g. a usage limit stopped it; re-run later) · 1 fatal · 2 bad input.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCheck, latestRows } from '../../src/run.mjs';
import { audit as runAudit } from '../../src/judge.mjs';
import { searchAskerWithSystem, SEARCH_TIMEOUT_MS } from '../../src/providers.mjs';
import { parseDirect, rateOverPrompts } from './analyze.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const ENGINES = ['claude-search', 'codex-search'];
export const ESTIMATOR_SYSTEM = 'You are a careful analyst. You may search the web. Follow the requested output format exactly.';
export const DEFINITION = 'An app counts as "named" in an answer if the answer mentions it by name at all — recommended, compared, or criticised. The rate is: for each question, the share of the assistant\'s answers that name the app; then the average over all questions.';
export const NAIVE = (category, apps) => `When people ask an AI assistant like you to recommend a ${category} app, in what percentage of answers is each of these apps named? ${apps.map((a) => a.name).join(', ')}. Reply with JSON {app: percent}.`;
const DIRECT_CALLS = 3;
const RETRIES = 2;
const AUDIT_N = 40;
const log = (m) => process.stderr.write(`${m}\n`);

export function fillTemplate(tpl, { category, apps, prompts }) {
  return tpl
    .replaceAll('{{category}}', category)
    .replaceAll('{{apps}}', apps.map((a) => a.name).join(', '))
    .replaceAll('{{definition}}', DEFINITION)
    .replaceAll('{{prompts}}', prompts.map((q, i) => `${i + 1}. ${q}`).join('\n'))
    .replaceAll('{{json}}', JSON.stringify(Object.fromEntries(apps.map((a) => [a.name, 0]))));
}

class LimitHit extends Error {}
async function askDirect(engine, prompt) {
  const ask = searchAskerWithSystem(engine, ESTIMATOR_SYSTEM);
  try { return await ask(prompt, { timeoutMs: 600_000 }); } catch (e) {
    if (e.kind === 'rate_limited' || /limit|quota/i.test(e.message)) throw new LimitHit(`${engine}: ${e.message}`);
    return { text: `ERROR: ${e.message}`, model: null, error: true };
  }
}

/** Up to DIRECT_CALLS calls per arm, each with up to RETRIES retries until parseable. Appends to direct.jsonl. */
async function runDirect(file, engine, arm, prompt, apps) {
  const have = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((x) => x.arm === arm) : [];
  for (let call = 1; call <= DIRECT_CALLS; call++) {
    const mine = have.filter((x) => x.call === call);
    if (mine.some((x) => x.parsed) || mine.length > RETRIES) continue;
    for (let attempt = mine.length; attempt <= RETRIES; attempt++) {
      const r = await askDirect(engine, prompt);
      const parsed = parseDirect(r.text, apps);
      fs.appendFileSync(file, JSON.stringify({ arm, engine, call, attempt, at: new Date().toISOString(), model: r.model ?? null, searches: r.searches ?? null, prompt, text: r.text, parsed }) + '\n');
      if (parsed) break;
    }
  }
}

async function runPart(dir, cfg) {
  fs.mkdirSync(dir, { recursive: true });
  const prev = fs.readdirSync(dir).find((d) => fs.existsSync(path.join(dir, d, 'responses.jsonl')));
  const res = await runCheck(cfg, { outDir: dir, resumeDir: prev ? path.join(dir, prev) : undefined, maxCalls: cfg.prompts.length * cfg.repeats, log });
  const halted = Object.entries(res.halted ?? {});
  if (halted.length) throw new LimitHit(`halted: ${halted.map(([p, k]) => `${p} (${k})`).join(', ')}`);
  const rows = latestRows(path.join(res.dir, 'responses.jsonl')).filter((r) => r.ok);
  const auditFile = path.join(res.dir, 'audit.json');
  const want = cfg.prompts.length * cfg.repeats;
  if (rows.length >= want && !fs.existsSync(auditFile)) {
    const a = await runAudit(rows, cfg, { judge: 'claude-cli', n: AUDIT_N, log });
    if (a.failedBatches) throw new LimitHit(`audit: ${a.failedBatches} judge batch(es) failed — re-run to redo the audit`);
    fs.writeFileSync(auditFile, JSON.stringify({ byProvider: { [cfg.providers[0]]: a } }, null, 2));
  }
  return { answered: rows.length, want };
}

async function collect(cat, tpl) {
  const apps = cat.apps;
  const base = { country: cat.country, target: apps[0], competitors: apps.slice(1) };
  await Promise.all(ENGINES.map(async (engine) => {
    const root = path.join(here, 'results', cat.id, engine);
    const t = await runPart(path.join(root, 'tool'), { ...base, prompts: cat.toolPrompts, providers: [engine], repeats: 2 });
    const r = await runPart(path.join(root, 'reference'), { ...base, prompts: cat.referencePrompts, providers: [engine], repeats: 1 });
    const directFile = path.join(root, 'direct.jsonl');
    await runDirect(directFile, engine, 'E', fillTemplate(tpl, { category: cat.category, apps, prompts: cat.toolPrompts }), apps);
    await runDirect(directFile, engine, 'N', NAIVE(cat.category, apps), apps);
    log(`[${cat.id}/${engine}] tool ${t.answered}/${t.want} · reference ${r.answered}/${r.want}`);
    if (t.answered < t.want || r.answered < r.want) throw new LimitHit(`${cat.id}/${engine} incomplete`);
  }));
}

async function devScore(variantFile) {
  const tpl = fs.readFileSync(variantFile, 'utf8');
  const devCats = JSON.parse(fs.readFileSync(path.join(here, '..', 'categories.json'), 'utf8'));
  let se = 0, n = 0, missing = 0;
  const rowsOut = [];
  const rawFile = path.join(here, 'dev', `${path.basename(variantFile, '.txt')}.raw.jsonl`);
  const cache = new Map();
  if (fs.existsSync(rawFile)) for (const l of fs.readFileSync(rawFile, 'utf8').split('\n')) { if (!l) continue; const x = JSON.parse(l); if (!String(x.text).startsWith('ERROR:')) cache.set(x.key, x); }
  for (const c of devCats) {
    const ext = path.join(here, '..', 'results', c.id, 'extended', 'run');
    const runDir = path.join(ext, fs.readdirSync(ext)[0]);
    const cfg = JSON.parse(fs.readFileSync(path.join(runDir, 'config.json'), 'utf8'));
    const rows = latestRows(path.join(runDir, 'responses.jsonl'));
    const apps = [c.target, ...c.competitors];
    for (const engine of ENGINES) {
      // Cache raw answers so a usage-limit stop does not throw away calls already made (re-run resumes).
      const key = `${c.id}\t${engine}`;
      let r = cache.get(key);
      if (!r) {
        r = await askDirect(engine, fillTemplate(tpl, { category: c.category, apps, prompts: cfg.prompts }));
        fs.appendFileSync(rawFile, JSON.stringify({ key, at: new Date().toISOString(), model: r.model ?? null, text: r.text }) + '\n');
      }
      const parsed = parseDirect(r.text, apps);
      for (const a of apps) {
        const truth = rateOverPrompts(rows.filter((x) => x.provider === engine), a).rate;
        const est = parsed?.[a.name];
        rowsOut.push({ category: c.id, engine, app: a.name, truth, est: est ?? null });
        if (est == null) { missing++; continue; }
        se += (est - truth) ** 2; n++;
      }
    }
  }
  const out = { variant: path.basename(variantFile), mse: n ? se / n : null, rmse: n ? Math.sqrt(se / n) : null, scored: n, missing, rows: rowsOut };
  const outFile = path.join(here, 'dev', `${path.basename(variantFile, '.txt')}.score.json`);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2));
  console.log(`${out.variant}: RMSE ${out.rmse?.toFixed(3)} over ${n} (missing ${missing})`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, arg] = process.argv.slice(2);
  try {
    if (cmd === 'dev-score' && arg) await devScore(arg);
    else if (cmd === 'collect' && arg) {
      const cats = JSON.parse(fs.readFileSync(path.join(here, 'categories.json'), 'utf8')).categories;
      const tplFile = path.join(here, 'expert-prompt.txt');
      if (!fs.existsSync(tplFile)) { console.error('expert-prompt.txt is not frozen yet (§3.3)'); process.exit(2); }
      const tpl = fs.readFileSync(tplFile, 'utf8');
      let done = 0;
      for (const cat of cats.filter((c) => arg === 'all' || c.id === arg)) { await collect(cat, tpl); done++; log(`[${cat.id}] complete`); }
      console.log(`=== compare collect: PASS ${done} / FAIL 0 ===`);
    } else { console.error('usage: collect.mjs dev-score <variant.txt> | collect <category-id|all>'); process.exit(2); }
  } catch (e) {
    if (e instanceof LimitHit) { console.error(`stopped: ${e.message} — re-run the same command later to resume`); console.log('=== compare collect: PASS 0 / FAIL 1 ==='); process.exit(10); }
    console.error(e.stack); process.exit(1);
  }
}
