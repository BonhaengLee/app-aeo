// Which engines can this machine use right now, for free? Builds the default provider list for `init`.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { CHILD_PATH, PROVIDERS, ask } from './providers.mjs';

// Free-tier chains, best first. Each chain serves one model family so answers stay comparable across links.
export const FREE_CHAINS = Object.freeze([
  { label: 'gpt-oss-120b (OpenAI open-weight)', links: ['groq:openai/gpt-oss-120b', 'cerebras:gpt-oss-120b', 'nvidia:openai/gpt-oss-120b', 'openrouter:openai/gpt-oss-120b:free'] },
  { label: 'Gemini Flash (free tier, no search)', links: ['gemini-openai:gemini-3.5-flash'] },
  { label: 'Mistral Small', links: ['mistral:mistral-small-latest'] },
]);

export function hasBin(bin, env = process.env) {
  const r = spawnSync('/bin/sh', ['-c', `command -v ${bin}`], { env: { ...env, PATH: CHILD_PATH }, encoding: 'utf8' });
  return r.status === 0 && !!r.stdout.trim();
}

/** Static check (no network). `env`/`home`/`binImpl` injectable for tests. */
export function inspect({ env = process.env, home = os.homedir(), binImpl = (b) => hasBin(b, env) } = {}) {
  const codexAuth = path.join(env.CODEX_HOME || path.join(home, '.codex'), 'auth.json');
  const engines = [
    { spec: 'claude-search', mode: 'search', ready: binImpl('claude'), why: binImpl('claude') ? 'claude CLI found (login is checked on first call)' : 'claude CLI not installed' },
    { spec: 'codex-search', mode: 'search', ready: binImpl('codex') && fs.existsSync(codexAuth), why: !binImpl('codex') ? 'codex CLI not installed' : fs.existsSync(codexAuth) ? 'codex CLI logged in' : 'codex CLI not logged in (codex login)' },
  ];
  const chains = FREE_CHAINS.map((c) => {
    const usable = c.links.filter((l) => env[PROVIDERS[l.split(':')[0]].key]);
    return { spec: usable.join('|'), label: c.label, mode: 'memory', ready: usable.length > 0, why: usable.length ? `keys: ${usable.map((l) => PROVIDERS[l.split(':')[0]].key).join(', ')}` : `needs one of ${[...new Set(c.links.map((l) => PROVIDERS[l.split(':')[0]].key))].join(' / ')}` };
  });
  const tavily = !!env.TAVILY_API_KEY;
  const providers = [...engines.filter((e) => e.ready).map((e) => e.spec), ...chains.filter((c) => c.ready).map((c) => c.spec)];
  return { engines, chains, tavily, recommended: { providers, ground: tavily && chains.some((c) => c.ready) ? 'tavily' : undefined } };
}

/** Optional live probe: one tiny question per ready engine. */
export async function probe(specs, { askImpl = ask } = {}) {
  const out = [];
  for (const spec of specs) {
    try { const r = await askImpl(spec, 'Name one habit tracker app. Reply with the name only.', { timeoutMs: 120_000 }); out.push({ spec, ok: true, model: r.model, grounded: r.grounded ?? false, ms: r.ms }); }
    catch (e) { out.push({ spec, ok: false, error: `${e.kind ?? 'failed'}: ${String(e.message).slice(0, 120)}` }); }
  }
  return out;
}

export function renderDoctor(d, live = null) {
  const L = ['| Engine | Mode | Ready | Note |', '|---|---|---|---|'];
  for (const e of d.engines) L.push(`| ${e.spec} | ${e.mode} | ${e.ready ? 'yes' : 'no'} | ${e.why} |`);
  for (const c of d.chains) L.push(`| ${c.ready ? c.spec : c.label} | ${d.tavily ? 'rag' : 'memory'} | ${c.ready ? 'yes' : 'no'} | ${c.why} |`);
  L.push(`| tavily (grounding) | — | ${d.tavily ? 'yes' : 'no'} | ${d.tavily ? 'free-tier engines will answer from live search results (rag)' : 'optional: free key at https://app.tavily.com turns free engines into rag mode'} |`);
  if (live) { L.push('', '| Probe | Result |', '|---|---|'); for (const p of live) L.push(`| ${p.spec} | ${p.ok ? `ok · ${p.model ?? '?'} · ${p.grounded ? 'searched' : 'no search'} · ${p.ms}ms` : `FAILED ${p.error}`} |`); }
  L.push('', d.recommended.providers.length ? `Recommended providers: ${JSON.stringify(d.recommended.providers)}${d.recommended.ground ? ' + "ground": "tavily"' : ''}` : 'No engine available. Install/login Claude Code or Codex, or add a free key (GROQ_API_KEY, CEREBRAS_API_KEY, GEMINI_API_KEY, MISTRAL_API_KEY, OPENROUTER_API_KEY, NVIDIA_API_KEY).');
  return L.join('\n') + '\n';
}
