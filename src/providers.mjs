// Answer-engine providers. Each provider turns one prompt into one answer text.
//
// Two families:
//   - Local CLIs you are already logged into (no API key, no per-call bill beyond your plan):
//       claude-cli[:model]   — Claude Code `claude -p`, tools disabled, user settings not loaded
//       codex-cli[:model]    — OpenAI Codex `codex exec`, isolated CODEX_HOME so your AGENTS.md does not leak in
//   - HTTP APIs (bring your own key):
//       openrouter:<model>   OPENROUTER_API_KEY
//       openai:<model>       OPENAI_API_KEY
//       perplexity:<model>   PERPLEXITY_API_KEY   (citations are kept)
//       anthropic:<model>    ANTHROPIC_API_KEY
//       gemini:<model>       GEMINI_API_KEY
//
// Failure policy: a refusal is never turned into an empty answer. Rate limits and auth failures throw
// ProviderError with kind 'rate_limited' / 'auth' so the runner stops that provider for the rest of the run.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const DEFAULT_TIMEOUT_MS = 240_000;
// launchd/cron start with an almost empty PATH; CLIs installed by Homebrew/npm must stay reachable.
export const CHILD_PATH = [...new Set(['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin', ...String(process.env.PATH ?? '').split(':')].filter(Boolean))].join(':');

export const NEUTRAL_SYSTEM = 'You are a helpful assistant.';

export class ProviderError extends Error {
  constructor(kind, message) { super(message); this.name = 'ProviderError'; this.kind = kind; }
}

/** "claude-cli:sonnet" → {type:'claude-cli', model:'sonnet', id:'claude-cli:sonnet', mode:'memory'} */
function parseOne(s) {
  const i = s.indexOf(':');
  const type = i < 0 ? s : s.slice(0, i);
  const model = i < 0 ? '' : s.slice(i + 1);
  if (!PROVIDERS[type]) throw new ProviderError('config', `unknown provider "${type}" (known: ${Object.keys(PROVIDERS).join(', ')})`);
  if (PROVIDERS[type].needsModel && !model) throw new ProviderError('config', `provider "${type}" needs a model, e.g. ${type}:${PROVIDERS[type].example}`);
  return { type, model, id: model ? `${type}:${model}` : type, mode: PROVIDERS[type].mode ?? 'memory' };
}

/**
 * A spec with "|" is a free-tier fallback chain: "groq:openai/gpt-oss-120b|cerebras:gpt-oss-120b|openrouter:openai/gpt-oss-120b:free".
 * Links should serve the same model family; a rate-limited/exhausted link is skipped for the rest of the run.
 */
export function parseProviderSpec(spec) {
  const s = String(spec ?? '').trim();
  if (!s.includes('|')) return parseOne(s);
  const links = s.split('|').map((x) => parseOne(x.trim()));
  const modes = new Set(links.map((l) => l.mode));
  if (modes.size > 1) throw new ProviderError('config', `chain "${s}" mixes modes (${[...modes].join(', ')}) — keep one mode per chain`);
  return { type: 'chain', model: '', id: links.map((l) => l.id).join('|'), mode: links[0].mode, links };
}

export function classifyHttp(status, body = '') {
  if (status === 429) return 'rate_limited';
  if (status === 401 || status === 403) return 'auth';
  if (status === 402) return 'quota';
  if (/rate.?limit|quota|insufficient_quota/i.test(body)) return 'rate_limited';
  return 'failed';
}

export function classifyCliError(text) {
  if (/rate.?limit|usage limit|too many requests|\b429\b|quota/i.test(text)) return 'rate_limited';
  if (/not logged in|unauthori[sz]ed|\b401\b|please log ?in|authentication/i.test(text)) return 'auth';
  return 'failed';
}

function runChild(cmd, args, { input = '', cwd, env, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, env: { ...process.env, PATH: CHILD_PATH, ...env }, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', timedOut = false;
    const t = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); }, timeoutMs);
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', (e) => { clearTimeout(t); resolve({ code: -1, stdout, stderr: stderr + String(e.message), timedOut }); });
    child.on('close', (code) => { clearTimeout(t); resolve({ code, stdout, stderr, timedOut }); });
    child.stdin.end(input);
  });
}

export const SEARCH_SYSTEM = 'You are a helpful assistant. Search the web when current information would help.';

/** Sum of web searches Claude Code reports in modelUsage (per-model counters). */
export const claudeSearchCount = (j) => Object.values(j.modelUsage ?? {}).reduce((n, u) => n + (u.webSearchRequests ?? 0), 0) + (j.usage?.server_tool_use?.web_search_requests ?? 0);

function claudeAsker({ search }) {
  return async (prompt, { model, timeoutMs, run = runChild }) => {
    // Replace Claude Code's coding-agent system prompt: we want the answer a general assistant gives, not a coding agent.
    const args = ['-p', '--output-format', 'json', '--setting-sources', '', '--strict-mcp-config', '--no-session-persistence'];
    if (search) args.push('--tools', 'WebSearch', '--allowedTools', 'WebSearch', '--system-prompt', SEARCH_SYSTEM);
    else args.push('--tools', '', '--system-prompt', NEUTRAL_SYSTEM);
    if (model) args.push('--model', model);
    const label = search ? 'claude-search' : 'claude-cli';
    const r = await run('claude', args, { input: prompt, cwd: os.tmpdir(), timeoutMs });
    if (r.timedOut) throw new ProviderError('timeout', `${label} timed out after ${timeoutMs}ms`);
    let j;
    try { j = JSON.parse(r.stdout); } catch { throw new ProviderError(classifyCliError(r.stdout + r.stderr), `${label} rc=${r.code}: ${(r.stderr || r.stdout).slice(0, 300)}`); }
    if (j.is_error || r.code !== 0 || typeof j.result !== 'string') throw new ProviderError(classifyCliError(JSON.stringify(j)), `${label} error: ${String(j.result ?? j.subtype ?? r.stderr).slice(0, 300)}`);
    const resolved = Object.keys(j.modelUsage ?? {})[0] ?? model ?? null;
    const searches = claudeSearchCount(j);
    return { text: j.result, model: resolved, citations: [], grounded: search && searches > 0, searches, costUsd: j.total_cost_usd ?? null };
  };
}

let codexHome = null;
/** Isolated CODEX_HOME holding only auth.json — keeps the user's AGENTS.md / config out of the answers. */
export function isolatedCodexHome(src = process.env.CODEX_HOME || path.join(os.homedir(), '.codex')) {
  if (codexHome && fs.existsSync(path.join(codexHome, 'auth.json'))) return codexHome;
  const auth = path.join(src, 'auth.json');
  if (!fs.existsSync(auth)) throw new ProviderError('auth', `codex-cli: ${auth} not found — run "codex login" first`);
  codexHome = fs.mkdtempSync(path.join(os.tmpdir(), 'app-aeo-codexhome-'));
  fs.symlinkSync(auth, path.join(codexHome, 'auth.json'));
  return codexHome;
}

/** Count web_search events and collect cited URLs from `codex exec --json` output (one JSON event per line). */
export function codexEvents(jsonl) {
  let searches = 0;
  const urls = new Set();
  for (const line of String(jsonl).split('\n')) {
    if (!line.trim()) continue;
    let ev;
    try { ev = JSON.parse(line); } catch { continue; }
    const s = JSON.stringify(ev);
    if (/"type":"web_search"/.test(s)) searches += 1;
    for (const m of s.matchAll(/https?:\/\/[^"\s)\\]+/g)) urls.add(m[0]);
  }
  return { searches, urls: [...urls] };
}

function codexAsker({ search }) {
  return async (prompt, { model, timeoutMs, run = runChild }) => {
    const home = isolatedCodexHome();
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'app-aeo-codex-'));
    const out = path.join(work, 'answer.txt');
    const args = [...(search ? ['--search'] : []), 'exec', '--skip-git-repo-check', '--ephemeral', '-s', 'read-only', '--json', '-o', out];
    if (model) args.push('-m', model);
    args.push('-');
    const label = search ? 'codex-search' : 'codex-cli';
    try {
      const r = await run('codex', args, { input: prompt, cwd: work, env: { CODEX_HOME: home }, timeoutMs });
      if (r.timedOut) throw new ProviderError('timeout', `${label} timed out after ${timeoutMs}ms`);
      const text = fs.existsSync(out) ? fs.readFileSync(out, 'utf8').trim() : '';
      if (r.code !== 0 || !text) throw new ProviderError(classifyCliError(r.stderr + r.stdout), `${label} rc=${r.code}: ${(r.stderr || r.stdout).slice(-300)}`);
      const ev = codexEvents(r.stdout);
      const m = /"model":"([^"]+)"/.exec(r.stdout) ?? /^model:\s*(\S+)/m.exec(r.stderr);
      return { text, model: m?.[1] ?? model ?? null, citations: ev.urls.filter((u) => !/openai\.com|chatgpt\.com/.test(u)), grounded: search && ev.searches > 0, searches: ev.searches, costUsd: null };
    } finally {
      fs.rmSync(work, { recursive: true, force: true });
    }
  };
}

function needKey(name) {
  const v = process.env[name];
  if (!v) throw new ProviderError('auth', `${name} is not set`);
  return v;
}

async function postJson(url, headers, body, { timeoutMs, fetchImpl = fetch }) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  let res, text;
  try {
    res = await fetchImpl(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal: ac.signal });
    text = await res.text();
  } catch (e) {
    throw new ProviderError(e.name === 'AbortError' ? 'timeout' : 'failed', `${url}: ${e.message}`);
  } finally { clearTimeout(t); }
  if (!res.ok) throw new ProviderError(classifyHttp(res.status, text), `${url} HTTP ${res.status}: ${text.slice(0, 300)}`);
  try { return JSON.parse(text); } catch { throw new ProviderError('failed', `${url}: non-JSON response`); }
}

function openAiCompatible(url, keyEnv) {
  return async (prompt, { model, timeoutMs, fetchImpl }) => {
    const j = await postJson(url, { authorization: `Bearer ${needKey(keyEnv)}` }, { model, messages: [{ role: 'user', content: prompt }] }, { timeoutMs, fetchImpl });
    const text = j.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || !text.trim()) throw new ProviderError('failed', `${url}: empty answer`);
    const citations = [...(j.citations ?? []), ...(j.search_results ?? []).map((s) => s.url)].filter((u) => typeof u === 'string');
    return { text, model: j.model ?? model, citations: [...new Set(citations)], costUsd: j.usage?.cost ?? null };
  };
}

async function askAnthropic(prompt, { model, timeoutMs, fetchImpl }) {
  const j = await postJson('https://api.anthropic.com/v1/messages', { 'x-api-key': needKey('ANTHROPIC_API_KEY'), 'anthropic-version': '2023-06-01' }, { model, max_tokens: 2048, messages: [{ role: 'user', content: prompt }] }, { timeoutMs, fetchImpl });
  const text = (j.content ?? []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
  if (!text.trim()) throw new ProviderError('failed', 'anthropic: empty answer');
  return { text, model: j.model ?? model, citations: [], costUsd: null };
}

function geminiAsker({ grounded }) {
  return async (prompt, { model, timeoutMs, fetchImpl }) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const body = { contents: [{ role: 'user', parts: [{ text: prompt }] }] };
    if (grounded) body.tools = [{ google_search: {} }];
    const j = await postJson(url, { 'x-goog-api-key': needKey('GEMINI_API_KEY') }, body, { timeoutMs, fetchImpl });
    const cand = j.candidates?.[0];
    const text = (cand?.content?.parts ?? []).map((p) => p.text ?? '').join('\n');
    if (!text.trim()) throw new ProviderError('failed', `gemini: empty answer (finishReason=${cand?.finishReason ?? '?'})`);
    const gm = cand?.groundingMetadata ?? {};
    // Grounding URIs are redirect links; the title is the source domain, which is what we want to count.
    const citations = (gm.groundingChunks ?? []).map((c) => c.web?.title || c.web?.uri).filter(Boolean);
    return { text, model, citations: [...new Set(citations)], searchQueries: gm.webSearchQueries ?? [], grounded: grounded && (gm.groundingChunks ?? []).length > 0, costUsd: null };
  };
}

export const PROVIDERS = Object.freeze({
  // Host-agent engines: free inside the user's existing Claude Code / Codex plan. *-search ground answers in live web search.
  'claude-search': { ask: claudeAsker({ search: true }), needsModel: false, example: 'sonnet', local: true, bin: 'claude', mode: 'search' },
  'codex-search': { ask: codexAsker({ search: true }), needsModel: false, example: 'gpt-5', local: true, bin: 'codex', mode: 'search' },
  'claude-cli': { ask: claudeAsker({ search: false }), needsModel: false, example: 'sonnet', local: true, bin: 'claude', mode: 'memory' },
  'codex-cli': { ask: codexAsker({ search: false }), needsModel: false, example: 'gpt-5', local: true, bin: 'codex', mode: 'agent' },
  // Official free tiers (OpenAI-compatible). Model-memory answers unless the run config sets "ground": "tavily" (→ rag).
  groq: { ask: openAiCompatible('https://api.groq.com/openai/v1/chat/completions', 'GROQ_API_KEY'), needsModel: true, example: 'openai/gpt-oss-120b', key: 'GROQ_API_KEY', free: true },
  cerebras: { ask: openAiCompatible('https://api.cerebras.ai/v1/chat/completions', 'CEREBRAS_API_KEY'), needsModel: true, example: 'gpt-oss-120b', key: 'CEREBRAS_API_KEY', free: true },
  mistral: { ask: openAiCompatible('https://api.mistral.ai/v1/chat/completions', 'MISTRAL_API_KEY'), needsModel: true, example: 'mistral-small-latest', key: 'MISTRAL_API_KEY', free: true },
  'gemini-openai': { ask: openAiCompatible('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', 'GEMINI_API_KEY'), needsModel: true, example: 'gemini-3.5-flash', key: 'GEMINI_API_KEY', free: true },
  nvidia: { ask: openAiCompatible('https://integrate.api.nvidia.com/v1/chat/completions', 'NVIDIA_API_KEY'), needsModel: true, example: 'openai/gpt-oss-120b', key: 'NVIDIA_API_KEY', free: true },
  openrouter: { key: 'OPENROUTER_API_KEY', free: true, ask: openAiCompatible('https://openrouter.ai/api/v1/chat/completions', 'OPENROUTER_API_KEY'), needsModel: true, example: 'openai/gpt-4o-mini' },
  openai: { key: 'OPENAI_API_KEY', ask: openAiCompatible('https://api.openai.com/v1/chat/completions', 'OPENAI_API_KEY'), needsModel: true, example: 'gpt-4o-mini' },
  perplexity: { key: 'PERPLEXITY_API_KEY', ask: openAiCompatible('https://api.perplexity.ai/chat/completions', 'PERPLEXITY_API_KEY'), needsModel: true, example: 'sonar', mode: 'search' },
  anthropic: { key: 'ANTHROPIC_API_KEY', ask: askAnthropic, needsModel: true, example: 'claude-sonnet-4-5' },
  // Free tier: Gemini 2.5 Flash answers grounded in Google Search, 500 requests/day at no charge (ai.google.dev pricing, checked 2026-10-10).
  'gemini-search': { key: 'GEMINI_API_KEY', free: true, ask: geminiAsker({ grounded: true }), needsModel: true, example: 'gemini-2.5-flash', mode: 'search' },
  gemini: { key: 'GEMINI_API_KEY', free: true, ask: geminiAsker({ grounded: false }), needsModel: true, example: 'gemini-2.5-flash', mode: 'memory' },
});

/** Per-run state for fallback chains (index of the first link not yet exhausted). */
export const newChainState = () => new Map();

/** Ask one provider (or chain). `deps` lets tests inject run/fetch. */
export async function ask(spec, prompt, { timeoutMs = DEFAULT_TIMEOUT_MS, chainState = newChainState(), ...deps } = {}) {
  const p = typeof spec === 'string' ? parseProviderSpec(spec) : spec;
  const started = Date.now();
  if (p.type !== 'chain') {
    const r = await PROVIDERS[p.type].ask(prompt, { model: p.model, timeoutMs, ...deps });
    return { ...r, via: p.id, ms: Date.now() - started };
  }
  let lastErr = null;
  for (let i = chainState.get(p.id) ?? 0; i < p.links.length; i += 1) {
    const link = p.links[i];
    try {
      const r = await PROVIDERS[link.type].ask(prompt, { model: link.model, timeoutMs, ...deps });
      return { ...r, via: link.id, ms: Date.now() - started };
    } catch (e) {
      if (!(e instanceof ProviderError) || !HALTING_KINDS.has(e.kind)) throw e;
      lastErr = e;
      chainState.set(p.id, Math.max(chainState.get(p.id) ?? 0, i + 1));
    }
  }
  throw new ProviderError(lastErr?.kind ?? 'quota', `all ${p.links.length} links exhausted: ${lastErr?.message ?? 'no link left'}`);
}

/** Errors after which asking the same provider again in this run is pointless. */
export const HALTING_KINDS = Object.freeze(new Set(['rate_limited', 'auth', 'quota', 'config']));
