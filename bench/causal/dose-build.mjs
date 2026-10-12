#!/usr/bin/env node
// Follow-up (positive control, PREREGISTRATION-DOSE.md): the same H1 units, with the subject's line inserted into
// EVERY page of the context instead of one. No model calls. Writes conditions-dose.json and contexts/.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ragPrompt } from '../../src/ground.mjs';
import { latestRows } from '../../src/run.mjs';
import { buildCategory, CATEGORIES, PLACEBO, firstName, insertAfterFirst, sha } from './build.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DOSE_HYPOTHESES = Object.freeze({ H4: ['INSERT_ALL', 'PLACEBO_ALL'] });

/** Insert the line into every page: after the first sentence naming another configured app, or at the start of a
 *  page that names none. */
export function insertEverywhere(pages, others, line) {
  return pages.map((p) => {
    const named = others.filter((a) => firstName(p.excerpt, a));
    return { page: p, content: named.length ? insertAfterFirst(p.excerpt, named, line) : `${line} ${p.excerpt}` };
  });
}

async function main() {
  const srcDir = process.argv[2];
  if (!srcDir) { console.error('usage: node bench/causal/dose-build.mjs <dir-with-diagnosed-runs>'); return 2; }
  const main_ = JSON.parse(fs.readFileSync(path.join(HERE, 'conditions.json'), 'utf8'));
  const jobs = [];
  for (const cat of CATEGORIES) {
    const dir = path.join(srcDir, cat);
    const cfg = JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8'));
    const pageText = (k) => { const f = path.join(dir, 'pages', `${crypto.createHash('sha1').update(k).digest('hex')}.txt`); return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null; };
    const units = buildCategory(cat, { cfg, rows: latestRows(path.join(dir, 'responses.jsonl')), diagnosis: JSON.parse(fs.readFileSync(path.join(dir, 'diagnosis.json'), 'utf8')), pageText, blurbs: main_.targets[cat].blurbs });
    const apps = [cfg.target, ...cfg.competitors];
    for (const [c, prompt, subject] of main_.picks.H1.filter(([c]) => c === cat)) {
      const u = units.find((x) => x.prompt === prompt);
      if (!u || u.subject.H1 !== subject) throw new Error(`unit drifted: ${cat} / ${prompt}`);
      const others = apps.filter((a) => a.name !== subject);
      const conds = { INSERT_ALL: insertEverywhere(u.pages, others, main_.targets[cat].blurbs[subject]), PLACEBO_ALL: insertEverywhere(u.pages, others, PLACEBO) };
      for (const [cond, list] of Object.entries(conds)) {
        const text = ragPrompt(prompt, list.map(({ page, content }) => ({ title: page.host, url: page.url, content })));
        const id = sha(`${c}\u0000${prompt}\u0000${cond}`).slice(0, 16);
        fs.writeFileSync(path.join(HERE, 'contexts', `${id}.txt`), text);
        jobs.push({ id, category: c, prompt, condition: cond, sha256: sha(text), chars: text.length });
      }
    }
  }
  const out = { builtAt: new Date().toISOString(), basedOn: 'conditions.json picks.H1', targets: main_.targets, picks: { H4: main_.picks.H1 }, jobs };
  fs.writeFileSync(path.join(HERE, 'conditions-dose.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ units: main_.picks.H1.length, jobs: jobs.length }));
  return 0;
}

const isMain = process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main().then((c) => { process.exitCode = c; }, (e) => { console.error(e.stack ?? e.message); process.exitCode = 1; });
