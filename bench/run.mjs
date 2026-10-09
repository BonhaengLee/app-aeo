#!/usr/bin/env node
// Runs the pre-registered benchmark (bench/PREREGISTRATION.md). Usage: node bench/run.mjs [categoryId ...]
// Outputs bench/results/<id>/{config.json, run/…, validity.json}. Exit 0 = all cells ran (any verdict), 1 = a cell crashed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { autocompletePrompts, suggestPrompts, search, lookup } from '../src/store.mjs';
import { runAdaptive, latestRows } from '../src/run.mjs';
import { popularity } from '../src/validate.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const cats = JSON.parse(fs.readFileSync(path.join(here, 'categories.json'), 'utf8'));
const only = process.argv.slice(2);
const PROMPTS = 60;
let crashed = 0;
for (const c of cats.filter((x) => !only.length || only.includes(x.id))) {
  const out = path.join(here, 'results', c.id);
  fs.mkdirSync(out, { recursive: true });
  const cfgFile = path.join(out, 'config.json');
  let cfg;
  if (fs.existsSync(cfgFile)) cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
  else {
    const args = { category: c.category, competitors: c.competitors.map((x) => x.name), locale: c.locale };
    const auto = await autocompletePrompts({ ...args, max: PROMPTS });
    const templates = suggestPrompts(args);
    const prompts = [...new Set([...auto, ...templates])].slice(0, PROMPTS);
    cfg = { country: c.country, target: c.target, competitors: c.competitors, prompts, promptSources: { autocomplete: auto.filter((q) => !templates.includes(q)).length, total: prompts.length }, providers: ['claude-search', 'codex-search'], repeats: 2, concurrency: 3, maxCalls: 2000 };
    fs.writeFileSync(cfgFile, JSON.stringify(cfg, null, 2));
  }
  try {
    const runDirs = fs.existsSync(path.join(out, 'run')) ? fs.readdirSync(path.join(out, 'run')).map((d) => path.join(out, 'run', d)) : [];
    const g = await runAdaptive(cfg, { outDir: path.join(out, 'run'), resumeDir: runDirs[0], maxRepeats: 4, log: (m) => process.stderr.write(`[${c.id}] ${m}\n`) });
    const rows = latestRows(path.join(g.dir, 'responses.jsonl')).filter((r) => r.ok);
    const validity = {};
    for (const engine of cfg.providers) {
      validity[engine] = await popularity(rows, cfg, (term) => search(term, { country: cfg.country, limit: 10 }), { provider: engine, lookupImpl: (ids) => lookup(ids, { country: cfg.country }) });
    }
    fs.writeFileSync(path.join(out, 'validity.json'), JSON.stringify(validity, null, 2));
    console.log(`${c.id}: ${g.gates.map((x) => `${x.provider}=${x.status}`).join(' ')} · validity ${Object.entries(validity).map(([e, v]) => `${e} ρ=${v.rho?.toFixed(2)} p=${v.p?.toFixed(3)} n=${v.n}`).join(' ')}`);
  } catch (e) {
    crashed += 1;
    console.error(`${c.id}: CRASHED ${e.stack}`);
  }
}
console.log(`=== bench: PASS ${cats.length - crashed} / FAIL ${crashed} ===`);
process.exitCode = crashed ? 1 : 0;
