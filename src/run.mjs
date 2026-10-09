// Run a check: prompts × engines × repeats → responses.jsonl (append-only, resumable) → report.json + report.md.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { HALTING_KINDS, ProviderError, ask as askProvider, parseProviderSpec } from './providers.mjs';
import { analyse } from './extract.mjs';
import { aggregate, renderMarkdown, renderTrend } from './report.mjs';

export const DEFAULT_MAX_CALLS = 120;

/** Validate a config object. Returns a list of problems (empty = ok). */
export function validateConfig(cfg) {
  const errs = [];
  const isApp = (a) => a && typeof a === 'object' && (typeof a.name === 'string' && a.name.trim() || a.appStoreId);
  if (!cfg || typeof cfg !== 'object') return ['config must be an object'];
  if (!isApp(cfg.target)) errs.push('target needs "name" (or "appStoreId")');
  if (cfg.competitors != null && !(Array.isArray(cfg.competitors) && cfg.competitors.every(isApp))) errs.push('competitors must be an array of {name|appStoreId}');
  if (!Array.isArray(cfg.prompts) || !cfg.prompts.length || !cfg.prompts.every((p) => typeof p === 'string' && p.trim())) errs.push('prompts must be a non-empty array of strings');
  if (!Array.isArray(cfg.providers) || !cfg.providers.length) errs.push('providers must be a non-empty array, e.g. ["claude-cli:sonnet","codex-cli"]');
  else for (const p of cfg.providers) { try { parseProviderSpec(p); } catch (e) { errs.push(e.message); } }
  if (cfg.repeats != null && !(Number.isInteger(cfg.repeats) && cfg.repeats >= 1 && cfg.repeats <= 10)) errs.push('repeats must be an integer 1..10');
  if (cfg.maxCalls != null && !(Number.isInteger(cfg.maxCalls) && cfg.maxCalls >= 1)) errs.push('maxCalls must be a positive integer');
  return errs;
}

export const jobKey = (j) => `${j.provider}\u0000${j.repeat}\u0000${j.prompt}`;
export const promptSetHash = (prompts) => crypto.createHash('sha256').update([...prompts].sort().join('\n')).digest('hex').slice(0, 12);

/** All jobs, round-robin by prompt so a budget cut still covers every engine evenly. */
export function planJobs(cfg) {
  const repeats = cfg.repeats ?? 1;
  const jobs = [];
  for (let r = 1; r <= repeats; r += 1) for (const prompt of cfg.prompts) for (const provider of cfg.providers) jobs.push({ provider: parseProviderSpec(provider).id, prompt, repeat: r });
  return jobs;
}

export function readRows(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

const stamp = (d = new Date()) => d.toISOString().replace(/[:]/g, '').replace(/\.(\d+)Z$/, '.$1Z');
/** Fresh run directory — never reuse an existing one (that would silently resume another run). */
function freshDir(outDir) {
  const base = path.join(outDir, stamp());
  let dir = base;
  for (let i = 2; fs.existsSync(dir); i += 1) dir = `${base}-${i}`;
  return dir;
}

/**
 * @param {object} cfg validated config (target/competitors already hydrated)
 * @param {{outDir:string, resumeDir?:string, maxCalls?:number, dryRun?:boolean, log?:Function, askImpl?:Function, timeoutMs?:number}} o
 * @returns {{dir, exitCode, agg, calls, halted}}
 */
export async function runCheck(cfg, o) {
  const log = o.log ?? ((s) => process.stderr.write(s + '\n'));
  const askImpl = o.askImpl ?? askProvider;
  const dir = o.resumeDir ?? freshDir(o.outDir);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'responses.jsonl');
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(cfg, null, 2));
  const done = new Set(readRows(file).filter((r) => r.ok).map(jobKey));
  const all = planJobs(cfg);
  const todo = all.filter((j) => !done.has(jobKey(j)));
  const budget = o.maxCalls ?? cfg.maxCalls ?? DEFAULT_MAX_CALLS;
  const planned = todo.slice(0, budget);
  log(`app-aeo: ${all.length} jobs, ${done.size} already answered, ${todo.length} to do, budget ${budget} → ${planned.length} calls`);
  if (todo.length > budget) log(`app-aeo: budget cuts ${todo.length - budget} calls — raise --max-calls or accept a partial run`);
  if (o.dryRun) { for (const j of planned) log(`  would ask ${j.provider} #${j.repeat}: ${j.prompt}`); return { dir, exitCode: 0, agg: null, calls: 0, halted: [] }; }

  const startedAt = new Date().toISOString();
  const halted = new Map();
  let calls = 0;
  const byProvider = new Map();
  for (const j of planned) { if (!byProvider.has(j.provider)) byProvider.set(j.provider, []); byProvider.get(j.provider).push(j); }
  // Engines run in parallel, each engine sequentially (one in-flight call per engine).
  await Promise.all([...byProvider.entries()].map(async ([provider, jobs]) => {
    for (const j of jobs) {
      if (halted.has(provider)) break;
      calls += 1;
      let row;
      try {
        const r = await askImpl(provider, j.prompt, { timeoutMs: o.timeoutMs });
        row = { ...j, ok: true, at: new Date().toISOString(), model: r.model, ms: r.ms, costUsd: r.costUsd ?? null, citations: r.citations ?? [], text: r.text, analysis: analyse(r.text, cfg.target, cfg.competitors ?? []) };
        log(`  ${provider} #${j.repeat} ${row.analysis.target ? 'MENTIONED' : '-'} ${j.prompt.slice(0, 70)}`);
      } catch (e) {
        const kind = e instanceof ProviderError ? e.kind : 'failed';
        row = { ...j, ok: false, at: new Date().toISOString(), errorKind: kind, error: String(e.message).slice(0, 500) };
        log(`  ${provider} #${j.repeat} FAILED(${kind}) ${String(e.message).slice(0, 160)}`);
        if (HALTING_KINDS.has(kind)) { halted.set(provider, kind); log(`  ${provider}: halting this engine for the rest of the run (${kind})`); }
      }
      fs.appendFileSync(file, JSON.stringify(row) + '\n');
    }
  }));

  // Latest row per job wins (a resumed run may contain an earlier failure for the same job).
  const latest = new Map();
  for (const r of readRows(file)) { const k = jobKey(r); if (!latest.get(k)?.ok || r.ok) latest.set(k, r); }
  const rows = [...latest.values()];
  const agg = aggregate(rows, cfg);
  const meta = { startedAt, finishedAt: new Date().toISOString(), promptSet: promptSetHash(cfg.prompts), providers: cfg.providers, calls, halted: Object.fromEntries(halted), skippedByBudget: Math.max(0, todo.length - budget) };
  fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify({ meta, agg }, null, 2));
  fs.writeFileSync(path.join(dir, 'report.md'), renderMarkdown(agg, meta));
  const okCount = rows.filter((r) => r.ok).length;
  const failCount = rows.length - okCount;
  const incomplete = failCount > 0 || meta.skippedByBudget > 0 || halted.size > 0;
  const exitCode = okCount === 0 ? 1 : incomplete ? 10 : 0;
  log(`=== app-aeo: PASS ${okCount} / FAIL ${failCount} ===`);
  return { dir, exitCode, agg, calls, halted: [...halted.entries()] };
}

/** Collect report.json files under runsDir (each run is a subdirectory), oldest first. */
export function loadRuns(runsDir) {
  if (!fs.existsSync(runsDir)) return [];
  return fs.readdirSync(runsDir).sort().map((d) => path.join(runsDir, d, 'report.json')).filter((f) => fs.existsSync(f)).map((f) => ({ run: path.basename(path.dirname(f)), ...JSON.parse(fs.readFileSync(f, 'utf8')) }));
}

export function trend(runsDir) {
  const runs = loadRuns(runsDir);
  if (!runs.length) return { markdown: `No runs with report.json under ${runsDir}\n`, points: [] };
  const sets = new Set(runs.map((r) => r.meta?.promptSet));
  let md = renderTrend(runs.map((r) => ({ run: `${r.run}${sets.size > 1 ? ` [${r.meta?.promptSet}]` : ''}`, agg: r.agg })));
  if (sets.size > 1) md += `\n⚠ ${sets.size} different prompt sets in this history (hash in brackets). Only compare rows with the same hash.\n`;
  return { markdown: md, points: runs };
}
