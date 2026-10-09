#!/usr/bin/env node
// Minimal MCP server over stdio (JSON-RPC 2.0, one message per line). No dependencies.
// Tools: run_app_aeo_check · get_app_aeo_trend · lint_app_listing · lookup_app_store · search_app_store · suggest_aeo_prompts
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { runCheck, trend, validateConfig, configFingerprint } from '../src/run.mjs';
import { hydrate, lookup, search, suggestPrompts } from '../src/store.mjs';
import { lint, renderLint, validateListing } from '../src/lint.mjs';
import { inspect, renderDoctor } from '../src/doctor.mjs';
import { loadRun, popularity, renderValidation, testRetest } from '../src/validate.mjs';

const VERSION = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
const SUPPORTED = ['2025-06-18', '2025-03-26', '2024-11-05'];
const slug = (s) => String(s).normalize('NFKD').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'app';

const appSchema = { type: 'object', properties: { name: { type: 'string' }, aliases: { type: 'array', items: { type: 'string' } }, appStoreId: { type: 'string' }, playId: { type: 'string' } } };

export const TOOLS = [
  {
    name: 'run_app_aeo_check',
    description: 'Ask answer engines (Claude, Codex/ChatGPT, Perplexity, Gemini, OpenRouter models) recommendation prompts and measure how often they mention the target app vs competitors. Slow: one call per prompt × engine. Returns the markdown report and the run directory. Never invent numbers beyond this report; if fewer than 10 prompts, say the sample is small.',
    inputSchema: {
      type: 'object',
      required: ['target', 'prompts', 'providers'],
      properties: {
        target: appSchema,
        competitors: { type: 'array', items: appSchema },
        prompts: { type: 'array', items: { type: 'string' }, minItems: 1 },
        providers: { type: 'array', items: { type: 'string' }, description: 'From app_aeo_doctor, e.g. ["claude-search","codex-search","groq:openai/gpt-oss-120b|cerebras:gpt-oss-120b"]' },
        ground: { type: 'string', enum: ['tavily'], description: 'Ground memory-mode engines in free Tavily search results (rag mode).' },
        concurrency: { type: 'integer', minimum: 1, maximum: 8 },
        repeats: { type: 'integer', minimum: 1, maximum: 10 },
        maxCalls: { type: 'integer', minimum: 1, description: 'Hard cap on engine calls for this run (default 120).' },
        outDir: { type: 'string', description: 'Directory for runs (default ./aeo-runs/<target-slug>).' },
        country: { type: 'string' },
      },
    },
  },
  { name: 'app_aeo_doctor', description: 'List engines usable here for free (Claude Code / Codex web search, free-tier keys, Tavily grounding) and the recommended provider list. Call this first.', inputSchema: { type: 'object', properties: {} } },
  { name: 'validate_app_aeo_runs', description: 'Check measurement validity: test–retest between two runs of the same config, and/or whether mention rates track App Store rating counts. Report the verdict as given.', inputSchema: { type: 'object', required: ['runDir'], properties: { runDir: { type: 'string' }, runDir2: { type: 'string' }, popularity: { type: 'boolean' }, engine: { type: 'string' }, country: { type: 'string' } } } },
  { name: 'get_app_aeo_trend', description: 'Mention-rate history across previous runs in a runs directory.', inputSchema: { type: 'object', required: ['runsDir'], properties: { runsDir: { type: 'string' } } } },
  { name: 'lint_app_listing', description: 'Check App Store listing text (name, subtitle, promoText, keywords, description) against character limits and common rejection patterns. Input: one locale object or an array.', inputSchema: { type: 'object', required: ['listing'], properties: { listing: {}, avoid: { type: 'array', items: { type: 'string' } } } } },
  { name: 'lookup_app_store', description: 'Public App Store metadata (name, seller, genre, rating, rating count, price) for App Store ids.', inputSchema: { type: 'object', required: ['ids'], properties: { ids: { type: 'array', items: { type: 'string' } }, country: { type: 'string' } } } },
  { name: 'search_app_store', description: 'Search the App Store (public iTunes Search API) for a term.', inputSchema: { type: 'object', required: ['term'], properties: { term: { type: 'string' }, country: { type: 'string' }, limit: { type: 'integer', minimum: 1, maximum: 50 } } } },
  { name: 'suggest_aeo_prompts', description: 'Deterministic starter prompt set (10 per category + 2 per competitor) in English or Korean.', inputSchema: { type: 'object', required: ['category'], properties: { category: { type: 'string' }, competitors: { type: 'array', items: { type: 'string' } }, locale: { type: 'string', enum: ['en', 'ko'] } } } },
];

const text = (t, isError = false) => ({ content: [{ type: 'text', text: typeof t === 'string' ? t : JSON.stringify(t, null, 2) }], isError });

export async function callTool(name, args = {}, deps = {}) {
  switch (name) {
    case 'run_app_aeo_check': {
      let cfg = { target: args.target, competitors: args.competitors ?? [], prompts: args.prompts, providers: args.providers, repeats: args.repeats ?? 2, maxCalls: args.maxCalls, ground: args.ground, concurrency: args.concurrency, country: args.country };
      for (const k of Object.keys(cfg)) if (cfg[k] == null) delete cfg[k];
      const errs = validateConfig(cfg);
      if (errs.length) return text(`invalid input:\n- ${errs.join('\n- ')}`, true);
      const [target, ...competitors] = await hydrate([cfg.target, ...cfg.competitors], { country: args.country ?? 'us' });
      cfg = { ...cfg, target, competitors };
      const r = await runCheck(cfg, { outDir: args.outDir ?? path.join('aeo-runs', slug(target.name)), log: () => {}, askImpl: deps.askImpl });
      const md = r.agg ? fs.readFileSync(path.join(r.dir, 'report.md'), 'utf8') : 'no report';
      return text(`run dir: ${r.dir}\nexit: ${r.exitCode === 0 ? 'complete' : r.exitCode === 10 ? 'partial' : 'failed'}\n\n${md}`, r.exitCode === 1);
    }
    case 'get_app_aeo_trend': return text(trend(args.runsDir).markdown);
    case 'app_aeo_doctor': { const d = inspect(); return text(renderDoctor(d)); }
    case 'validate_app_aeo_runs': {
      const cfgRun = JSON.parse(fs.readFileSync(path.join(args.runDir, 'config.json'), 'utf8'));
      if (args.runDir2) {
        const cfgB = JSON.parse(fs.readFileSync(path.join(args.runDir2, 'config.json'), 'utf8'));
        if ((cfgRun.fingerprint ?? configFingerprint(cfgRun)) !== (cfgB.fingerprint ?? configFingerprint(cfgB))) return text('the two runs are different experiments (config fingerprints differ); test–retest needs the same config', true);
      }
      const rowsA = loadRun(args.runDir);
      const retest = args.runDir2 ? testRetest(rowsA, loadRun(args.runDir2), cfgRun, { provider: args.engine }) : null;
      const ctry = args.country ?? cfgRun.country ?? 'us';
      const pop = args.popularity ? await popularity(rowsA, cfgRun, (term) => search(term, { country: ctry, limit: 10 }), { provider: args.engine, lookupImpl: (ids) => lookup(ids, { country: ctry }) }) : null;
      if (!retest && !pop) return text('nothing to validate: give runDir2 and/or popularity:true', true);
      return text(renderValidation({ retest, pop, runs: [args.runDir, args.runDir2].filter(Boolean) }));
    }
    case 'lint_app_listing': {
      const why = validateListing(args.listing);
      if (why) return text(`invalid listing: ${why}`, true);
      return text(renderLint(lint(args.listing, args.avoid ?? [])));
    }
    case 'lookup_app_store': return text(await lookup(args.ids ?? [], { country: args.country ?? 'us' }));
    case 'search_app_store': return text(await search(args.term, { country: args.country ?? 'us', limit: args.limit ?? 10 }));
    case 'suggest_aeo_prompts': return text(suggestPrompts({ category: args.category, competitors: args.competitors ?? [], locale: args.locale ?? 'en' }));
    default: return null;
  }
}

export async function handle(msg, deps = {}) {
  const { id, method, params } = msg;
  const reply = (result) => ({ jsonrpc: '2.0', id, result });
  const fail = (code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });
  if (id === undefined || id === null) return null; // notification
  if (msg.jsonrpc !== '2.0' || typeof method !== 'string') return { jsonrpc: '2.0', id, error: { code: -32600, message: 'Invalid Request' } };
  try {
    if (method === 'initialize') {
      const want = params?.protocolVersion;
      return reply({ protocolVersion: SUPPORTED.includes(want) ? want : SUPPORTED[0], capabilities: { tools: {} }, serverInfo: { name: 'app-aeo', version: VERSION } });
    }
    if (method === 'ping') return reply({});
    if (method === 'tools/list') return reply({ tools: TOOLS });
    if (method === 'tools/call') {
      const r = await callTool(params?.name, params?.arguments ?? {}, deps);
      return r ? reply(r) : fail(-32602, `unknown tool ${params?.name}`);
    }
    return fail(-32601, `method not found: ${method}`);
  } catch (e) {
    if (method === 'tools/call') return reply(text(`error: ${e.message}`, true));
    return fail(-32603, e.message);
  }
}

const isMain = process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(new URL(import.meta.url).pathname);
if (isMain) {
  const rl = readline.createInterface({ input: process.stdin });
  rl.on('line', async (line) => {
    if (!line.trim()) return;
    let msg;
    try { msg = JSON.parse(line); } catch { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } }) + '\n'); return; }
    const out = await handle(msg);
    if (out) process.stdout.write(JSON.stringify(out) + '\n');
  });
}
