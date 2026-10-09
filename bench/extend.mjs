#!/usr/bin/env node
// Follow-up D2 (bench/DEVIATIONS.md): extend each category's prompts to the gate's prescription and re-run the gate.
// Writes bench/results/<id>/extended/{config.json, run/…, validity.json}. The pre-registered run is left untouched.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { autocompletePrompts, suggestPrompts, search, lookup } from '../src/store.mjs';
import { runAdaptive, gateRun, latestRows } from '../src/run.mjs';
import { popularity } from '../src/validate.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const cats = JSON.parse(fs.readFileSync(path.join(here, 'categories.json'), 'utf8'));
const only = process.argv.slice(2);
let crashed = 0;
for (const c of cats.filter((x) => !only.length || only.includes(x.id))) {
  try {
    const base = path.join(here, 'results', c.id);
    const origDir = path.join(base, 'run', fs.readdirSync(path.join(base, 'run'))[0]);
    const origCfg = JSON.parse(fs.readFileSync(path.join(origDir, 'config.json'), 'utf8'));
    const gates = gateRun(origDir, origCfg);
    const need = Math.max(...gates.map((g) => g.parts[1].promptsNeeded ?? 0), origCfg.prompts.length);
    const targetN = Math.min(120, Math.ceil(need / 10) * 10);
    const ext = path.join(base, 'extended');
    const cfgFile = path.join(ext, 'config.json');
    let cfg;
    if (fs.existsSync(cfgFile)) cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
    else {
      fs.mkdirSync(ext, { recursive: true });
      const args = { category: c.category, competitors: c.competitors.map((x) => x.name), locale: c.locale };
      const pool = [...new Set([...(await autocompletePrompts({ ...args, max: 160 })), ...suggestPrompts(args)])];
      const added = pool.filter((q) => !origCfg.prompts.includes(q)).slice(0, Math.max(0, targetN - origCfg.prompts.length));
      cfg = { ...origCfg, prompts: [...origCfg.prompts, ...added], extendedFrom: origCfg.prompts.length, prescribed: need, fingerprint: undefined };
      delete cfg.fingerprint;
      fs.writeFileSync(cfgFile, JSON.stringify(cfg, null, 2));
    }
    // Seed the new run with the original answers (same prompts, same engines) so only new prompts are asked.
    const runRoot = path.join(ext, 'run');
    let dir = fs.existsSync(runRoot) ? path.join(runRoot, fs.readdirSync(runRoot)[0]) : null;
    if (!dir) {
      dir = path.join(runRoot, 'extended');
      fs.mkdirSync(dir, { recursive: true });
      fs.copyFileSync(path.join(origDir, 'responses.jsonl'), path.join(dir, 'responses.jsonl'));
      fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(cfg, null, 2));
      fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify({ meta: {} }));
    }
    process.stderr.write(`[${c.id}] prompts ${origCfg.prompts.length} → ${cfg.prompts.length} (prescribed ${cfg.prescribed})\n`);
    const g = await runAdaptive(cfg, { outDir: runRoot, resumeDir: dir, maxRepeats: 4, log: (m) => process.stderr.write(`[${c.id}+] ${m}\n`) });
    const rows = latestRows(path.join(g.dir, 'responses.jsonl')).filter((r) => r.ok);
    const validity = {};
    for (const engine of cfg.providers) validity[engine] = await popularity(rows, cfg, (term) => search(term, { country: cfg.country, limit: 10 }), { provider: engine, lookupImpl: (ids) => lookup(ids, { country: cfg.country }) });
    fs.writeFileSync(path.join(ext, 'validity.json'), JSON.stringify(validity, null, 2));
    console.log(`${c.id}+: ${g.gates.map((x) => `${x.provider}=${x.status} R2±${x.parts[1].value?.toFixed(3)}`).join(' ')}`);
  } catch (e) { crashed += 1; console.error(`${c.id}: CRASHED ${e.stack}`); }
}
console.log(`=== extend: PASS ${cats.length - crashed} / FAIL ${crashed} ===`);
process.exitCode = crashed ? 1 : 0;
