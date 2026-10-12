// Run a check: prompts × engines × repeats → responses.jsonl (append-only, resumable) → report.json + report.md.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { HALTING_KINDS, PROVIDERS, ProviderError, ask as askProvider, newChainState, parseProviderSpec } from './providers.mjs';
import { groundCache, ragPrompt } from './ground.mjs';
import { analyse } from './extract.mjs';
import { aggregate, renderMarkdown, renderTrend } from './report.mjs';
import { GATE, gateVerdict, precision, splitHalfRank } from './reliability.mjs';
import { audit as runAudit } from './judge.mjs';

export const DEFAULT_MAX_CALLS = 120;
// Benchmark (bench/BENCHMARK.md): at 60 prompts R2 failed in 6 of 8 cells; the gate prescribed 68–93 for the US
// categories, and at 70–100 prompts every US cell passed. 100 is the smallest round default that covered all of them.
export const DEFAULT_PROMPTS = 100;

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
  if (cfg.concurrency != null && !(Number.isInteger(cfg.concurrency) && cfg.concurrency >= 1 && cfg.concurrency <= 8)) errs.push('concurrency must be an integer 1..8');
  if (cfg.ground != null && cfg.ground !== 'tavily') errs.push('ground must be "tavily" (or omitted)');
  if (Array.isArray(cfg.prompts)) {
    const seen = new Set();
    for (const q of cfg.prompts) { const k = String(q).trim().toLowerCase(); if (seen.has(k)) errs.push(`duplicate prompt: "${q}" — use "repeats" instead`); seen.add(k); }
  }
  if (isApp(cfg.target)) {
    // One alias must point to one app; a shared alias would count one sentence as two apps' mentions.
    const owner = new Map();
    for (const a of [cfg.target, ...(Array.isArray(cfg.competitors) ? cfg.competitors : [])]) {
      for (const n of [a.name, ...(a.aliases ?? [])].filter(Boolean)) {
        const k = String(n).normalize('NFC').trim().toLowerCase();
        if (owner.has(k) && owner.get(k) !== a) errs.push(`name/alias "${n}" is used by more than one app`);
        owner.set(k, a);
      }
    }
  }
  return errs;
}

/** Everything that defines the experiment. Two runs are comparable (and resumable) only if this matches. */
export function configFingerprint(cfg) {
  // Content of the experiment only: what is asked and what counts as a mention. Engines and repeats may grow when a run is
  // extended (adaptive gate, --resume), and each engine is reported separately anyway.
  const app = (a) => ({ name: a.name, aliases: [...(a.aliases ?? [])].sort(), appStoreId: a.appStoreId ?? null, playId: a.playId ?? null });
  const core = { target: app(cfg.target), competitors: (cfg.competitors ?? []).map(app), prompts: [...cfg.prompts].sort(), ground: cfg.ground ?? null, country: cfg.country ?? 'us' };
  return crypto.createHash('sha256').update(JSON.stringify(core)).digest('hex').slice(0, 16);
}

export const jobKey = (j) => `${j.provider}\u0000${j.repeat}\u0000${j.prompt}`;
export const promptSetHash = (prompts) => crypto.createHash('sha256').update([...prompts].sort().join('\n')).digest('hex').slice(0, 12);

/** Memory-mode engines become "rag" when the run grounds them in search results. Search/agent engines stay as they are. */
export const effectiveMode = (mode, cfg) => (mode === 'memory' && cfg.ground ? 'rag' : mode);

/** Default parallel calls per engine: local CLIs tolerate a few; free HTTP tiers have tight per-minute limits. */
export const defaultConcurrency = (spec) => { const p = parseProviderSpec(spec); const t = p.type === 'chain' ? p.links[0].type : p.type; return PROVIDERS[t].local ? 3 : 1; };

/** All jobs, round-robin by prompt so a budget cut still covers every engine evenly. */
export function planJobs(cfg) {
  const repeats = cfg.repeats ?? 1;
  const jobs = [];
  for (let r = 1; r <= repeats; r += 1) for (const prompt of cfg.prompts) for (const provider of cfg.providers) { const p = parseProviderSpec(provider); jobs.push({ provider: p.id, mode: effectiveMode(p.mode, cfg), prompt, repeat: r }); }
  return jobs;
}

export function readRows(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

export class ConfigMismatchError extends Error { constructor(m) { super(m); this.name = 'ConfigMismatchError'; this.code = 2; } }

/** Single writer per run directory: a second process resuming the same dir would duplicate calls and race on reports. */
export function acquireLock(dir) {
  const lock = path.join(dir, '.lock');
  try { fs.writeFileSync(lock, String(process.pid), { flag: 'wx' }); }
  catch (e) {
    if (e.code !== 'EEXIST') throw e;
    const pid = Number(fs.readFileSync(lock, 'utf8'));
    let alive = false;
    try { process.kill(pid, 0); alive = true; } catch {}
    if (alive && pid !== process.pid) { const err = new Error(`${dir} is in use by process ${pid}`); err.code = 2; throw err; }
    fs.writeFileSync(lock, String(process.pid));
  }
  return () => { try { if (fs.readFileSync(lock, 'utf8') === String(process.pid)) fs.unlinkSync(lock); } catch {} };
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
  const cfgFile = path.join(dir, 'config.json');
  const fp = configFingerprint(cfg);
  if (o.resumeDir && fs.existsSync(cfgFile)) {
    const prev = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
    const prevFp = prev.fingerprint ?? configFingerprint(prev);
    if (prevFp !== fp) throw new ConfigMismatchError(`--resume ${dir}: config differs from the one that started this run (${prevFp} ≠ ${fp}). Start a new run instead.`);
  }
  const unlock = acquireLock(dir);
  try {
  fs.writeFileSync(cfgFile, JSON.stringify({ ...cfg, fingerprint: fp }, null, 2));
  const done = new Set(readRows(file).filter((r) => r.ok).map(jobKey));
  const all = planJobs(cfg);
  const todo = all.filter((j) => !done.has(jobKey(j)));
  const budget = o.maxCalls ?? cfg.maxCalls ?? DEFAULT_MAX_CALLS;
  const planned = todo.slice(0, budget);
  log(`app-aeo: ${all.length} jobs, ${done.size} already answered, ${todo.length} to do, budget ${budget} → ${planned.length} calls`);
  if (todo.length > budget) log(`app-aeo: budget cuts ${todo.length - budget} calls — raise --max-calls or accept a partial run`);
  if (o.dryRun) { for (const j of planned) log(`  would ask ${j.provider} #${j.repeat}: ${j.prompt}`); return { dir, exitCode: 0, agg: null, calls: 0, halted: [] }; }
  // (dry runs return inside the lock's try → finally releases it)

  const startedAt = new Date().toISOString();
  const halted = new Map();
  const chainState = newChainState();
  const ground = cfg.ground ? groundCache(dir, o.searchImpl) : null;
  let groundHalt = null;
  let calls = 0;
  const byProvider = new Map();
  for (const j of planned) { if (!byProvider.has(j.provider)) byProvider.set(j.provider, []); byProvider.get(j.provider).push(j); }
  const specById = new Map(cfg.providers.map((s) => [parseProviderSpec(s).id, s]));

  async function one(provider, j) {
    calls += 1;
    let row;
    try {
      let prompt = j.prompt;
      let sources = [];
      if (j.mode === 'rag') {
        if (groundHalt) throw groundHalt;
        try { sources = await ground.get(j.prompt); } catch (e) { if (e instanceof ProviderError && HALTING_KINDS.has(e.kind)) groundHalt = new ProviderError(e.kind, `grounding: ${e.message}`); throw groundHalt ?? e; }
        prompt = ragPrompt(j.prompt, sources);
      }
      const r = await askImpl(provider, prompt, { timeoutMs: o.timeoutMs, chainState });
      const grounded = j.mode === 'rag' ? sources.length > 0 : !!r.grounded;
      row = { ...j, ok: true, at: new Date().toISOString(), model: r.model, via: r.via ?? provider, ms: r.ms, costUsd: r.costUsd ?? null, citations: j.mode === 'rag' ? sources.map((x) => x.url) : r.citations ?? [], searchQueries: r.searchQueries ?? [], seen: r.seen ?? null, answerUrls: r.answerUrls ?? [], searches: r.searches ?? null, grounded, text: r.text, analysis: analyse(r.text, cfg.target, cfg.competitors ?? []) };
      log(`  ${provider} #${j.repeat} ${row.analysis.target ? 'MENTIONED' : '-'}${j.mode === 'search' && !grounded ? ' (no search)' : ''} ${j.prompt.slice(0, 70)}`);
    } catch (e) {
      const kind = e instanceof ProviderError ? e.kind : 'failed';
      row = { ...j, ok: false, at: new Date().toISOString(), errorKind: kind, error: String(e.message).slice(0, 500) };
      log(`  ${provider} #${j.repeat} FAILED(${kind}) ${String(e.message).slice(0, 160)}`);
      if (HALTING_KINDS.has(kind)) { halted.set(provider, kind); log(`  ${provider}: halting this engine for the rest of the run (${kind})`); }
    }
    fs.appendFileSync(file, JSON.stringify(row) + '\n');
  }

  // Engines run in parallel; within an engine a small worker pool (cfg.concurrency or a per-type default).
  await Promise.all([...byProvider.entries()].map(async ([provider, jobs]) => {
    const width = Math.min(o.concurrency ?? cfg.concurrency ?? defaultConcurrency(specById.get(provider) ?? provider), jobs.length);
    let next = 0;
    await Promise.all(Array.from({ length: width }, async () => {
      while (next < jobs.length && !halted.has(provider)) { const j = jobs[next]; next += 1; await one(provider, j); }
    }));
  }));

  // Latest row per job wins (a resumed run may contain an earlier failure for the same job).
  const latest = new Map();
  for (const r of readRows(file)) { const k = jobKey(r); if (!latest.get(k)?.ok || r.ok) latest.set(k, r); }
  const rows = [...latest.values()];
  const agg = aggregate(rows, cfg);
  const meta = { startedAt, finishedAt: new Date().toISOString(), promptSet: promptSetHash(cfg.prompts), providers: cfg.providers, ground: cfg.ground ?? null, groundSearches: ground?.size() ?? 0, calls, halted: Object.fromEntries(halted), skippedByBudget: Math.max(0, todo.length - budget) };
  fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify({ meta, agg }, null, 2));
  fs.writeFileSync(path.join(dir, 'report.md'), renderMarkdown(agg, meta));
  const okCount = rows.filter((r) => r.ok).length;
  const failCount = rows.length - okCount;
  const incomplete = failCount > 0 || meta.skippedByBudget > 0 || halted.size > 0;
  const exitCode = okCount === 0 ? 1 : incomplete ? 10 : 0;
  log(`=== app-aeo: PASS ${okCount} / FAIL ${failCount} ===`);
  return { dir, exitCode, agg, calls, halted: [...halted.entries()] };
  } finally { unlock(); }
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

/** Per-engine gate for a finished run directory (R1, R2 from data; R3 from audit.json if present). */
export function gateRun(dir, cfg, gate = GATE) {
  const rows = latestRows(path.join(dir, 'responses.jsonl'));
  const auditFile = path.join(dir, 'audit.json');
  const auditRes = fs.existsSync(auditFile) ? JSON.parse(fs.readFileSync(auditFile, 'utf8')) : null;
  const engines = [...new Set(rows.map((r) => r.provider))];
  return engines.map((provider) => {
    const mine = rows.filter((r) => r.ok && r.provider === provider);
    const rank = splitHalfRank(mine, cfg, gate);
    const prec = precision(mine, cfg, gate);
    const auditFor = auditRes?.byProvider?.[provider] ?? auditRes?.overall ?? null;
    return { provider, mode: mine[0]?.mode ?? null, answers: mine.length, repeats: Math.max(0, ...mine.map((r) => r.repeat)), ...gateVerdict({ rank, prec, audit: auditFor }, gate) };
  });
}

export function latestRows(file) {
  const latest = new Map();
  for (const r of readRows(file)) { const k = jobKey(r); if (!latest.get(k)?.ok || r.ok) latest.set(k, r); }
  return [...latest.values()];
}

export function renderGate(gates) {
  const f = (x) => (x == null ? '—' : typeof x === 'number' ? x.toFixed(2) : String(x));
  const L = ['## Reliability gate', '', '_A number is RELIABLE only if R1–R3 all pass. Thresholds were fixed before any run; INDETERMINATE is never a pass._', ''];
  L.push('| Engine | Mode | Answers (repeats) | Verdict | R1 rate reliability ≥ 0.8 | R2 precision ± ≤ 0.10 | R3 coding κ ≥ 0.8 |', '|---|---|---|---|---|---|---|');
  for (const g of gates) {
    const cell = (p) => `${p.status === 'PASS' ? '✅' : p.status === 'FAIL' ? '❌' : '⚪'} ${f(p.value)}${p.status === 'FAIL' && p.moreDataFactor ? ` (needs ×${f(p.moreDataFactor)} data)` : ''}${p.status === 'FAIL' && p.promptsNeeded ? ` (needs ~${p.promptsNeeded} prompts)` : ''}${p.status === 'INDETERMINATE' && p.reason ? ` (${p.reason})` : ''}`;
    L.push(`| ${g.provider} | ${g.mode} | ${g.answers} (${g.repeats}) | **${g.status}** | ${cell(g.parts[0])} | ${cell(g.parts[1])} | ${cell(g.parts[2])} |`);
  }
  return L.join('\n') + '\n';
}

/**
 * Sequential design: start at ≥ 2 repeats; after each round, engines whose split-half rank reliability is below the
 * target get more repeats (Spearman–Brown estimate of the data multiplier, rounded up to an even repeat count), until
 * they pass or hit maxRepeats / the call budget. Then the coding audit runs and the gate is written to the report.
 */
export async function runAdaptive(cfg, o) {
  const log = o.log ?? ((m) => process.stderr.write(m + '\n'));
  const gate = o.gate ?? GATE;
  const maxRepeats = o.maxRepeats ?? 6;
  let repeats = Math.max(2, cfg.repeats ?? 2);
  if (repeats % 2) repeats += 1;
  let active = [...cfg.providers];
  let dir = o.resumeDir ?? null;
  let calls = 0;
  const budget = o.maxCalls ?? cfg.maxCalls ?? Infinity;
  const repeatsUsed = {};
  let last = null;
  while (active.length) {
    const remaining = budget - calls;
    if (remaining <= 0) { log(`gate: call budget exhausted with ${active.join(', ')} still below target`); break; }
    log(`gate: round with repeats=${repeats} for ${active.join(', ')}`);
    last = await runCheck({ ...cfg, providers: active, repeats }, { ...o, resumeDir: dir ?? undefined, maxCalls: remaining, log });
    dir = last.dir;
    calls += last.calls;
    for (const p of active) repeatsUsed[parseProviderSpec(p).id] = repeats;
    const rows = latestRows(path.join(dir, 'responses.jsonl'));
    const next = [];
    let want = repeats;
    for (const spec of active) {
      const id = parseProviderSpec(spec).id;
      if (last.halted.some(([h]) => h === id)) { log(`gate: ${id} halted — not extended`); continue; }
      const rank = splitHalfRank(rows.filter((r) => r.ok && r.provider === id), cfg, gate);
      log(`gate: ${id} R1 ${rank.status}${rank.reliability != null ? ` ${rank.reliability.toFixed(2)}` : ''}${rank.reason ? ` (${rank.reason})` : ''}`);
      // FAIL → Spearman–Brown says how much more; too few frequently named apps → more answers can surface more apps.
      const extend = rank.status === 'FAIL' || (rank.status === 'INDETERMINATE' && rank.coreApps != null);
      if (extend && repeats < maxRepeats) { next.push(spec); want = Math.max(want, Math.ceil(repeats * Math.min(rank.status === 'FAIL' ? rank.moreDataFactor : 2, 4))); }
    }
    if (!next.length) break;
    repeats = Math.min(maxRepeats, Math.max(repeats + 2, want + (want % 2)));
    active = next;
  }
  if (!dir) throw new Error('gate: nothing ran');
  const finalCfg = { ...cfg, repeats: Math.max(...Object.values(repeatsUsed), cfg.repeats ?? 2), repeatsByEngine: repeatsUsed, fingerprint: configFingerprint(cfg) };
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(finalCfg, null, 2));
  if (o.audit !== false) {
    const rows = latestRows(path.join(dir, 'responses.jsonl')).filter((r) => r.ok);
    const byProvider = {};
    for (const id of [...new Set(rows.map((r) => r.provider))]) {
      log(`gate: coding audit for ${id} (judge ${o.judge ?? 'claude-cli'})`);
      byProvider[id] = await runAudit(rows.filter((r) => r.provider === id), cfg, { judge: o.judge, askImpl: o.judgeImpl, n: o.auditN, log });
    }
    fs.writeFileSync(path.join(dir, 'audit.json'), JSON.stringify({ byProvider }, null, 2));
  }
  const rows = latestRows(path.join(dir, 'responses.jsonl'));
  const agg = aggregate(rows, finalCfg);
  const gates = gateRun(dir, finalCfg, gate);
  const meta = { ...(JSON.parse(fs.readFileSync(path.join(dir, 'report.json'), 'utf8')).meta ?? {}), finishedAt: new Date().toISOString(), repeatsByEngine: repeatsUsed, calls };
  fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify({ meta, agg, gates }, null, 2));
  fs.writeFileSync(path.join(dir, 'report.md'), renderGate(gates) + '\n' + renderMarkdown(agg, meta));
  const okCount = rows.filter((r) => r.ok).length;
  const exitCode = okCount === 0 ? 1 : gates.every((g) => g.status === 'RELIABLE') ? 0 : 10;
  log(`=== app-aeo gate: RELIABLE ${gates.filter((g) => g.status === 'RELIABLE').length} / NOT ${gates.filter((g) => g.status !== 'RELIABLE').length} ===`);
  return { dir, exitCode, gates, agg, calls };
}
