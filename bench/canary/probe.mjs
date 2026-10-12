#!/usr/bin/env node
// Freshness canary: how long until a search engine's answer reflects an edit to a page it can open?
// The page holds a random token and nothing else (no product, no claim). Steps:
//   node bench/canary/probe.mjs set            → write a new token to TOKEN.md (commit + push it yourself)
//   node bench/canary/probe.mjs ask [engine]   → ask the engine to open the page and report the token; appends to log.jsonl
// Reading the log: lag = first time an answer reports the current token − the time that token was pushed.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONSUMER_ROLE, searchAskerWithSystem } from '../../src/providers.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PAGE = 'https://github.com/BonhaengLee/app-aeo/blob/main/bench/canary/TOKEN.md';
export const RAW = 'https://raw.githubusercontent.com/BonhaengLee/app-aeo/main/bench/canary/TOKEN.md';
export const TOKEN_RE = /\bcanary-[0-9a-f]{12}\b/g;

export function question(url) {
  return `Open this exact page and tell me the token written on it (it looks like "canary-" followed by 12 hex characters). Reply with the token only, or NONE if you cannot open the page.\n\n${url}`;
}

async function main() {
  const [cmd, engine = 'codex-search', which = 'page'] = process.argv.slice(2);
  if (cmd === 'set') {
    const token = `canary-${crypto.randomBytes(6).toString('hex')}`;
    fs.writeFileSync(path.join(HERE, 'TOKEN.md'), `# Freshness canary\n\nThis page exists to measure how fast answer engines see an edit (see probe.mjs). It carries no claim.\n\nToken: ${token}\n`);
    fs.appendFileSync(path.join(HERE, 'log.jsonl'), `${JSON.stringify({ kind: 'set', token, at: new Date().toISOString() })}\n`);
    console.log(token);
    return 0;
  }
  if (cmd === 'ask') {
    const url = which === 'raw' ? RAW : PAGE;
    const started = new Date().toISOString();
    try {
      const r = await searchAskerWithSystem(engine, CONSUMER_ROLE)(question(url), { timeoutMs: 300_000 });
      const tokens = [...new Set(String(r.text).match(TOKEN_RE) ?? [])];
      const row = { kind: 'ask', engine, url, at: started, ok: true, tokens, searches: r.searches ?? null, citations: (r.citations ?? []).filter((u) => u.includes('canary')).slice(0, 5), text: String(r.text).slice(0, 300) };
      fs.appendFileSync(path.join(HERE, 'log.jsonl'), `${JSON.stringify(row)}\n`);
      console.log(JSON.stringify(row));
      return 0;
    } catch (e) {
      fs.appendFileSync(path.join(HERE, 'log.jsonl'), `${JSON.stringify({ kind: 'ask', engine, url, at: started, ok: false, error: String(e.message).slice(0, 200) })}\n`);
      console.error(e.message);
      return 1;
    }
  }
  console.error('usage: node bench/canary/probe.mjs set | ask [engine] [page|raw]');
  return 2;
}

const isMain = process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main().then((c) => { process.exitCode = c; }, (e) => { console.error(e.stack ?? e.message); process.exitCode = 1; });
