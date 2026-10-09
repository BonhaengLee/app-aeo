#!/usr/bin/env node
// app-aeo — does ChatGPT/Claude/Perplexity/Gemini recommend YOUR app?
// Exit codes: 0 complete · 10 partial (failed calls, halted engine, or budget cut) · 1 nothing answered / lint error · 2 bad input
import fs from 'node:fs';
import path from 'node:path';
import { runCheck, trend, validateConfig, DEFAULT_MAX_CALLS } from '../src/run.mjs';
import { hydrate, lookup, search, suggestPrompts } from '../src/store.mjs';
import { lint, renderLint, validateListing } from '../src/lint.mjs';
import { PROVIDERS } from '../src/providers.mjs';
import { brandOf } from '../src/extract.mjs';
import { loadRun, popularity, renderValidation, testRetest } from '../src/validate.mjs';
import { autocompletePrompts } from '../src/store.mjs';

const HELP = `app-aeo — measure how often answer engines recommend your app

Usage
  app-aeo check <config.json> [--out DIR] [--resume RUN_DIR] [--max-calls N] [--timeout-ms N] [--dry-run] [--json]
  app-aeo trend <runs-dir> [--json]
  app-aeo validate <run-dir> [<run-dir-2>] [--popularity] [--engine SPEC]   (test–retest and/or mention vs real usage)
  app-aeo prompts --category "habit tracker" [--competitor NAME ...] [--locale en|ko] [--autocomplete]
  app-aeo lookup <appStoreId ...> [--country us]
  app-aeo search <term> [--country us]
  app-aeo lint <listing.json> [--avoid "Brand A,Brand B"] [--json]
  app-aeo init <config.json> --category "..." --app-id <appStoreId> [--competitor-id ID ...] [--locale en|ko] [--country us]

Engines (config "providers"): ${Object.keys(PROVIDERS).join(', ')}
  claude-cli / codex-cli use the CLIs you are logged into (no API key). Others read *_API_KEY env vars.

Config
  { "target": {"name": "...", "aliases": [], "appStoreId": "", "playId": ""},
    "competitors": [{"name": "..."}],
    "prompts": ["..."],            // 10+ recommended
    "providers": ["gemini-search:gemini-2.5-flash", "claude-cli:sonnet"],
    "repeats": 3, "maxCalls": ${DEFAULT_MAX_CALLS} }

Runs are written to <out>/<timestamp>/ (responses.jsonl, report.md, report.json). Default --out: ./aeo-runs/<target-slug>
Last line of check: === app-aeo: PASS n / FAIL m ===`;

export function parseArgv(argv) {
  const pos = [];
  const opt = {};
  const multi = new Set(['--competitor', '--competitor-id']);
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, inline] = a.split(/=(.*)/s, 2);
      const isFlag = ['--dry-run', '--json', '--help', '--popularity', '--autocomplete'].includes(k);
      const v = isFlag ? true : inline ?? argv[++i];
      if (!isFlag && v === undefined) throw new Error(`${k} needs a value`);
      if (multi.has(k)) (opt[k] ??= []).push(v); else opt[k] = v;
    } else pos.push(a);
  }
  return { pos, opt };
}

export const slug = (s) => String(s).normalize('NFKD').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'app';

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { const err = new Error(`${file}: ${e.message}`); err.code = 2; throw err; }
}

async function main(argv) {
  let parsed;
  try { parsed = parseArgv(argv); } catch (e) { console.error(e.message); return 2; }
  const { pos, opt } = parsed;
  const cmd = pos.shift();
  if (!cmd || opt['--help'] || cmd === 'help') { console.log(HELP); return cmd ? 0 : 2; }
  const country = opt['--country'] ?? 'us';

  if (cmd === 'check') {
    if (pos.length !== 1) { console.error('usage: app-aeo check <config.json>'); return 2; }
    let cfg = readJson(pos[0]);
    const errs = validateConfig(cfg);
    if (errs.length) { for (const e of errs) console.error(`config: ${e}`); return 2; }
    const [target, ...competitors] = await hydrate([cfg.target, ...(cfg.competitors ?? [])], { country: cfg.country ?? country });
    cfg = { ...cfg, target, competitors };
    const outDir = opt['--out'] ?? path.join('aeo-runs', slug(target.name));
    const maxCalls = opt['--max-calls'] ? Number(opt['--max-calls']) : undefined;
    if (maxCalls !== undefined && !(Number.isInteger(maxCalls) && maxCalls > 0)) { console.error('--max-calls must be a positive integer'); return 2; }
    const r = await runCheck(cfg, { outDir, resumeDir: opt['--resume'], maxCalls, dryRun: !!opt['--dry-run'], timeoutMs: opt['--timeout-ms'] ? Number(opt['--timeout-ms']) : undefined });
    if (r.agg) {
      if (opt['--json']) console.log(JSON.stringify({ dir: r.dir, agg: r.agg }, null, 2));
      else console.log(fs.readFileSync(path.join(r.dir, 'report.md'), 'utf8'));
      console.error(`report: ${path.join(r.dir, 'report.md')}`);
    }
    return r.exitCode;
  }
  if (cmd === 'trend') {
    if (pos.length !== 1) { console.error('usage: app-aeo trend <runs-dir>'); return 2; }
    const t = trend(pos[0]);
    console.log(opt['--json'] ? JSON.stringify(t.points.map((p) => ({ run: p.run, meta: p.meta, overall: p.agg.overall, perProvider: p.agg.perProvider.map((x) => ({ provider: x.provider, answers: x.answers, rate: x.target.rate })) })), null, 2) : t.markdown);
    return t.points.length ? 0 : 1;
  }
  if (cmd === 'prompts') {
    if (!opt['--category']) { console.error('--category is required'); return 2; }
    const args = { category: opt['--category'], competitors: opt['--competitor'] ?? [], locale: opt['--locale'] ?? 'en' };
    const out = opt['--autocomplete'] ? await autocompletePrompts(args) : suggestPrompts(args);
    console.log(JSON.stringify(out, null, 2));
    return 0;
  }
  if (cmd === 'validate') {
    if (pos.length < 1 || pos.length > 2) { console.error('usage: app-aeo validate <run-dir> [<run-dir-2>] [--popularity]'); return 2; }
    const cfg = readJson(path.join(pos[0], 'config.json'));
    const engine = opt['--engine'];
    const rowsA = loadRun(pos[0]);
    const retest = pos[1] ? testRetest(rowsA, loadRun(pos[1]), cfg, { provider: engine }) : null;
    const pop = opt['--popularity'] ? await popularity(rowsA, cfg, (term) => search(term, { country: cfg.country ?? country, limit: 10 }), { provider: engine, lookupImpl: (ids) => lookup(ids, { country: cfg.country ?? country }) }) : null;
    if (!retest && !pop) { console.error('nothing to do: give a second run dir and/or --popularity'); return 2; }
    console.log(opt['--json'] ? JSON.stringify({ retest, pop }, null, 2) : renderValidation({ retest, pop, runs: pos }));
    return 0;
  }
  if (cmd === 'lookup') {
    if (!pos.length) { console.error('usage: app-aeo lookup <appStoreId ...>'); return 2; }
    const r = await lookup(pos, { country });
    console.log(JSON.stringify(r.map((x) => x && { ...x, description: x.description?.slice(0, 200) }), null, 2));
    return r.every(Boolean) ? 0 : 10;
  }
  if (cmd === 'search') {
    if (!pos.length) { console.error('usage: app-aeo search <term>'); return 2; }
    const r = await search(pos.join(' '), { country });
    for (const x of r) console.log(`${x.appStoreId}\t${x.rating ?? '-'}★ (${x.ratingCount ?? 0})\t${x.name} — ${x.seller}`);
    return 0;
  }
  if (cmd === 'lint') {
    if (pos.length !== 1) { console.error('usage: app-aeo lint <listing.json>'); return 2; }
    const data = readJson(pos[0]);
    const why = validateListing(data);
    if (why) { console.error(`listing: ${why}`); return 2; }
    const results = lint(data, String(opt['--avoid'] ?? '').split(',').filter((a) => a.trim()));
    console.log(opt['--json'] ? JSON.stringify(results, null, 2) : renderLint(results));
    const failN = results.filter((r) => r.issues.some((i) => i.level === 'error')).length;
    console.log(`=== app-aeo lint: PASS ${results.length - failN} / FAIL ${failN} ===`);
    return failN ? 1 : 0;
  }
  if (cmd === 'init') {
    if (pos.length !== 1 || !opt['--category'] || !opt['--app-id']) { console.error('usage: app-aeo init <config.json> --category "..." --app-id <id> [--competitor-id ID ...]'); return 2; }
    if (fs.existsSync(pos[0])) { console.error(`${pos[0]} exists — not overwriting`); return 2; }
    const ids = [opt['--app-id'], ...(opt['--competitor-id'] ?? [])];
    const found = await lookup(ids, { country });
    const missing = ids.filter((id, i) => !found[i]);
    if (missing.length) { console.error(`not found in ${country}: ${missing.join(', ')}`); return 2; }
    const [t, ...cs] = found;
    const asApp = (x) => { const b = brandOf(x.name, opt['--category']); return { name: b, aliases: b === x.name ? [] : [x.name], appStoreId: x.appStoreId }; };
    const cfg = {
      country,
      target: asApp(t),
      competitors: cs.map(asApp),
      prompts: suggestPrompts({ category: opt['--category'], competitors: cs.map((c) => brandOf(c.name, opt['--category'])), locale: opt['--locale'] ?? 'en' }),
      // gemini-search: free tier, grounded in Google Search (closest to consumer AI answers). claude-cli: memory baseline.
      providers: process.env.GEMINI_API_KEY ? ['gemini-search:gemini-2.5-flash', 'claude-cli:sonnet'] : ['claude-cli:sonnet'],
      repeats: 3,
      maxCalls: DEFAULT_MAX_CALLS,
    };
    fs.writeFileSync(pos[0], JSON.stringify(cfg, null, 2) + '\n');
    console.log(`wrote ${pos[0]} — ${cfg.prompts.length} prompts × ${cfg.providers.length} engines. Edit aliases/prompts, then: app-aeo check ${pos[0]} --dry-run`);
    return 0;
  }
  console.error(`unknown command "${cmd}"\n\n${HELP}`);
  return 2;
}

const isMain = process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(new URL(import.meta.url).pathname);
if (isMain) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (e) => { console.error(e.stack ?? String(e)); process.exitCode = e.code === 2 ? 2 : 1; });
}
