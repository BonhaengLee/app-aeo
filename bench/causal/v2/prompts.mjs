#!/usr/bin/env node
// Causal study v2, step 0 — freeze categories and prompts (no model call). Writes categories.json.
// App categories: the real Google-autocomplete prompts of the benchmark (bench/results/<id>/extended) and the comparison
// study (bench/compare/results/<id>/codex-search/tool). Product categories: Google autocomplete fetched here, once.
// PROMPTS_PER_CATEGORY are drawn per category with a seeded shuffle.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROMPTS_PER_CATEGORY, seedOf, shuffle } from './lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BENCH = path.join(HERE, '..', '..');

export const PRODUCT_CATEGORIES = [
  { id: 'robot-vacuum', kind: 'robot vacuum brand', label: 'robot vacuum', apps: [
    { name: 'Roborock', aliases: [] }, { name: 'Roomba', aliases: ['iRobot'] }, { name: 'Ecovacs', aliases: ['Deebot'] },
    { name: 'Eufy', aliases: ['eufy'] }, { name: 'Dreame', aliases: [] }] },
  { id: 'running-shoes', kind: 'running shoe brand', label: 'running shoes', apps: [
    { name: 'Hoka', aliases: ['HOKA', 'Hoka One One'] }, { name: 'Brooks', aliases: ['Brooks Running'] }, { name: 'Asics', aliases: ['ASICS'] },
    { name: 'Saucony', aliases: [] }, { name: 'New Balance', aliases: [] }] },
];
export const PRODUCT_SEEDS = (label) => [`best ${label}`, `best ${label} for`, `${label} for`, `${label} under`, `${label} with`, `best ${label} 2026`, ...'abcdefghiklmnoprstuw'.split('').map((l) => `best ${label} ${l}`)];

// The plumbing pilot's prompts (PREREGISTRATION §12) are never sampled.
export const PILOT_PROMPTS = ['calm alternative words', 'best app for sleep tracking without a watch'];

const latest = (dir) => path.join(dir, fs.readdirSync(dir).sort().at(-1));

async function autocomplete(seeds, { fetchImpl = fetch } = {}) {
  const out = [];
  for (const q of seeds) {
    const res = await fetchImpl(`https://suggestqueries.google.com/complete/search?client=firefox&hl=en&q=${encodeURIComponent(q)}`);
    if (!res.ok) throw new Error(`autocomplete HTTP ${res.status} for "${q}"`);
    for (const s of JSON.parse(await res.text())[1] ?? []) if (s.split(/\s+/).length >= 3 && !out.includes(s.trim())) out.push(s.trim());
    await new Promise((r) => setTimeout(r, 300));
  }
  return out;
}

async function main() {
  const cats = [];
  for (const c of JSON.parse(fs.readFileSync(path.join(BENCH, 'categories.json'), 'utf8')).filter((x) => x.locale === 'en')) {
    const cfg = JSON.parse(fs.readFileSync(path.join(BENCH, 'results', c.id, 'extended', 'config.json'), 'utf8'));
    cats.push({ id: c.id, kind: `${c.category} app`, apps: [cfg.target, ...cfg.competitors].map(({ name, aliases }) => ({ name, aliases: aliases ?? [] })), pool: cfg.prompts, source: `bench/results/${c.id}/extended/config.json` });
  }
  for (const c of JSON.parse(fs.readFileSync(path.join(BENCH, 'compare', 'categories.json'), 'utf8')).categories) {
    const dir = latest(path.join(BENCH, 'compare', 'results', c.id, 'codex-search', 'tool'));
    const cfg = JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8'));
    cats.push({ id: c.id, kind: `${c.category} app`, apps: c.apps.map(({ name, aliases }) => ({ name, aliases: aliases ?? [] })), pool: cfg.prompts, source: path.relative(BENCH, path.join(dir, 'config.json')) });
  }
  for (const p of PRODUCT_CATEGORIES) {
    const pool = await autocomplete(PRODUCT_SEEDS(p.label));
    cats.push({ id: p.id, kind: p.kind, apps: p.apps, pool, source: `Google autocomplete, ${new Date().toISOString().slice(0, 10)}` });
  }
  for (const c of cats) {
    if (c.pool.length < PROMPTS_PER_CATEGORY) throw new Error(`${c.id}: only ${c.pool.length} prompts`);
    const pool = [...new Set(c.pool)].filter((p) => !PILOT_PROMPTS.includes(p)).sort();
    c.prompts = shuffle(pool, seedOf('prompts', c.id)).slice(0, PROMPTS_PER_CATEGORY);
    c.poolSize = pool.length;
    delete c.pool;
  }
  fs.writeFileSync(path.join(HERE, 'categories.json'), `${JSON.stringify({ builtAt: new Date().toISOString(), perCategory: PROMPTS_PER_CATEGORY, categories: cats }, null, 2)}\n`);
  console.log(cats.map((c) => `${c.id}: ${c.apps.length} apps, ${c.prompts.length}/${c.poolSize} prompts`).join('\n'));
  return 0;
}

const isMain = process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main().then((c) => { process.exitCode = c; }, (e) => { console.error(e.stack ?? e.message); process.exitCode = 1; });
