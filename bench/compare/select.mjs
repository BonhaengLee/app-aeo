#!/usr/bin/env node
// Comparison study (bench/compare/PREREGISTRATION.md §2): picks the held-out categories and their apps by a fixed rule,
// then freezes them in categories.json. Run once, before any answer is collected; the commit is the timestamp.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { autocompletePrompts, search } from '../../src/store.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const SEED = 20261010;
// Candidate list written before any measurement; habit tracker (pilot) and the 4 benchmark categories are excluded.
const CANDIDATES = ['sleep tracker', 'meal planner', 'password manager', 'period tracker', 'fasting', 'workout tracker', 'note taking', 'todo list'];
const POOL_MIN = 200; // 100 prompts for the tool arm + 100 disjoint prompts for the reference
const N_APPS = 5;

function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function shuffle(xs, rnd) { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const words = (s) => String(s).normalize('NFC').toLowerCase().split(/[\s\p{P}\p{S}]+/u).filter(Boolean);

const pools = {};
for (const c of CANDIDATES) pools[c] = await autocompletePrompts({ category: c, competitors: [], locale: 'en', max: 260 });
const eligible = CANDIDATES.filter((c) => pools[c].length >= POOL_MIN);
// All eligible categories are used: a power simulation (PREREGISTRATION.md §5) showed 8 clusters were too few.
const chosen = eligible;

// App naming is a measurement-validity decision, so it is curated by written criteria (PREREGISTRATION.md §2.2),
// before any answer exists. Every app the rule considers must have an entry, so nothing is skipped silently.
//   C3 exclude: the brand is a descriptive phrase for the category, indistinguishable from prose in an answer.
//   C4 exclude: the brand, matched with the extractor's own rule, occurs in >= 1% of the 1,338 benchmark answers
//      (other categories) — i.e. it is an ordinary sentence word. Measured: Structured 13.1%, Simple 7.9%,
//      Zero 6.0%, Strong 5.6%; every included brand is below 1% (BetterSleep 0.52%, others < 0.2%).
//   C5 exclude: brand shorter than 3 letters or not matchable as a word.
//   C6 exclude: same company's brand already included in the category.
const CURATION = {
  // note taking
  '410395246': { name: 'OneNote', aliases: ['Microsoft OneNote'] },
  '1110145109': { exclude: 'C3 "Notes" (Apple Notes) is an ordinary word' },
  '1444383602': { name: 'Goodnotes', aliases: ['Goodnotes: AI Notes, Docs, PDF', 'GoodNotes'] },
  '360593530': { name: 'Notability', aliases: ['Notability: AI Note Journal'] },
  '1232780281': { name: 'Notion', aliases: ['Notion: Notes, Tasks, AI'] },
  '1276437113': { name: 'Otter', aliases: ['Otter.ai', 'Otter Transcribe Voice Notes'] },
  // todo list
  '1108187841': { exclude: 'C3 "Reminders" (Apple Reminders) is an ordinary word' },
  '1212616790': { name: 'Microsoft To Do', aliases: [] },
  '1596403446': { exclude: 'C5 "Me+" is not matchable as a word' },
  '1499198946': { exclude: 'C4 "Structured" occurs in 13.1% of unrelated answers' },
  '1438388363': { exclude: 'C3 "Habit Tracker" is an ordinary phrase' },
  '572688855': { name: 'Todoist', aliases: ['Todoist: To Do List & Calendar'] },
  '608834326': { exclude: 'C3 "Calendars" is an ordinary word' },
  '1353634006': { name: 'Google Tasks', aliases: ['Google Tasks: Get Things Done'] },
  '571626623': { exclude: 'C3 "Lists To do" is an ordinary phrase' },
  '497328576': { name: 'Any.do', aliases: ['Any.do: To do list & Planner', 'Anydo'] },
  '993066159': { exclude: 'C3 "To Do List MinimaList & Widget" is a descriptive phrase' },
  '626144601': { name: 'TickTick', aliases: ['TickTick:To-Do List & Calendar'] },
  // meal planner
  '341232718': { name: 'MyFitnessPal', aliases: ['MyFitnessPal: Calorie Counter', 'My Fitness Pal'] },
  '1217456898': { name: 'Tasty', aliases: ['Tasty: Recipes, Cooking Videos'] },
  '1593779280': { name: 'ReciMe', aliases: ['ReciMe: Recipes & Meal Planner'] },
  '970107419': { name: 'HelloFresh', aliases: ['HelloFresh: Meal Kit & Recipes', 'Hello Fresh'] },
  '1079999103': { name: 'Mealime', aliases: ['Mealime Meal Plans & Recipes'] },
  // fasting
  '1168348542': { exclude: 'C4 "Zero" occurs in 6.0% of unrelated answers' },
  '1467720176': { exclude: 'C4 "Simple" occurs in 7.9% of unrelated answers' },
  '1459260306': { name: 'Fastic', aliases: ['Fastic Weight Loss & Fasting'] },
  '1189568780': { name: 'BodyFast', aliases: ['BodyFast: Intermittent Fasting'] },
  '1553036888': { name: 'FastEasy', aliases: ['FastEasy: Intermittent Fasting'] },
  '6448909309': { exclude: 'C3 "Intermittent Fasting Tracker" is a descriptive phrase' },
  '1498018285': { exclude: 'C3 "Intermittent Fasting Tracker" is a descriptive phrase' },
  '974978016': { name: 'FastHabit', aliases: ['FastHabit Intermittent Fasting'] },
  '1513810477': { exclude: 'C3 "Fasting Tracker & Diet App" is a descriptive phrase' },
  '1112765909': { name: 'Window', aliases: ['Window - Intermittent Fasting'] },
  // workout tracker (MyFitnessPal entry above is shared)
  '1041517543': { name: 'Fitbod', aliases: ['Fitbod: Gym & Fitness Planner'] },
  '1048454034': { name: 'Gymverse', aliases: ['Gymverse: Gym Workout Planner'] },
  '1313192037': { exclude: 'C3 "Home Workout - No Equipments" is a descriptive phrase' },
  '464254577': { exclude: 'C4 "Strong" occurs in 5.6% of unrelated answers' },
  '6448081563': { name: 'Liftoff', aliases: ['Liftoff - Ranked Gym Workouts'] },
  '1458862350': { name: 'Hevy', aliases: ['Hevy - Workout Tracker Gym Log'] },
  // period tracker
  '1038369065': { name: 'Flo', aliases: ['Flo Cycle & Period Tracker', 'Flo Health'] },
  '657189652': { name: 'Clue', aliases: ['Clue Period & Cycle Tracker'] },
  '896501514': { exclude: 'C3 "Period Tracker Period Calendar" is an ordinary phrase' },
  '1495829322': { name: 'Stardust', aliases: ['Stardust Period Tracker'] },
  '1002275138': { name: 'Eve by Glow', aliases: ['Glow Eve Period Tracker', 'Glow Eve'] },
  '1459096552': { exclude: 'C3 "My Cycle" is an ordinary phrase' },
  '570244389': { name: 'Ovia', aliases: ['Ovia Cycle & Pregnancy Tracker', 'Ovia Fertility'] },
  // sleep tracker
  '314498713': { name: 'BetterSleep', aliases: ['BetterSleep: Relax and Sleep', 'Better Sleep'] },
  '1490078804': { name: 'ShutEye', aliases: ['ShutEye®: Sleep Tracker, Sound', 'ShutEye®'] },
  '1138066420': { name: 'SleepWatch', aliases: ['SleepWatch - Top Sleep Tracker'] },
  '878691772': { name: 'Pillow', aliases: ['Pillow: Sleep Tracker'] },
  '1453884781': { name: 'Rise', aliases: ['RISE: Sleep Tracker', 'Rise Science'] }, // 'Rise' is word-like → case-sensitive (Rise|RISE); 'RISE' would match the verb 'rise'
};

const out = [];
for (const category of chosen) {
  const results = await search(category, { country: 'us', limit: 25 });
  const apps = [];
  const searchSnapshot = [];
  for (const r of [...results].sort((a, b) => (b.ratingCount ?? 0) - (a.ratingCount ?? 0))) {
    const row = { appStoreId: r.appStoreId, title: r.name, ratingCount: r.ratingCount };
    if (apps.length === N_APPS) { searchSnapshot.push({ ...row, decision: 'not reached' }); continue; }
    const cur = CURATION[r.appStoreId];
    if (!cur) throw new Error(`no curation entry for ${r.appStoreId} ${JSON.stringify(r.name)} (${category}) — add one before collecting data`);
    if (cur.exclude) { searchSnapshot.push({ ...row, decision: `excluded: ${cur.exclude}` }); continue; }
    searchSnapshot.push({ ...row, decision: 'included' });
    apps.push({ name: cur.name, aliases: cur.aliases, appStoreId: r.appStoreId, ratingCount: r.ratingCount });
  }
  if (apps.length < N_APPS) throw new Error(`${category}: only ${apps.length} apps passed the criteria`);
  // Prompts: the pool is split at random into two disjoint halves, so the tool and the reference never share a prompt.
  const pool = shuffle(pools[category], mulberry32(SEED + out.length + 1));
  const toolPrompts = pool.slice(0, 100);
  // M5 (five-question check): 5 tool prompts fixed now, so they cannot be picked after seeing answers.
  const m5Prompts = shuffle(toolPrompts, mulberry32(SEED + 100 + out.length)).slice(0, 5);
  out.push({ id: category.replace(/\s+/g, '-'), country: 'us', locale: 'en', category, apps, searchSnapshot, toolPrompts, referencePrompts: pool.slice(100, 200), m5Prompts });
}

fs.writeFileSync(path.join(here, 'categories.json'), JSON.stringify({ seed: SEED, candidates: CANDIDATES, poolSizes: Object.fromEntries(CANDIDATES.map((c) => [c, pools[c].length])), eligible, chosen, categories: out }, null, 2) + '\n');
console.log(`chosen: ${chosen.join(', ')}`);
for (const c of out) console.log(`${c.id}: ${c.apps.map((a) => `${a.name} (${a.ratingCount})`).join(', ')}`);
