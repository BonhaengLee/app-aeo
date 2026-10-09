// R3 coding audit: an independent LLM judge re-codes a sample of answers ("is app X mentioned by name?") and we measure
// agreement with the regex extractor (Cohen's κ). Disagreements are kept verbatim so a human can see who was right.
// The judge never sees the extractor's output. Default judge: the memory-mode Claude CLI (free inside the user's plan).
import { analyse } from './extract.mjs';
import { ask as askProvider, ProviderError } from './providers.mjs';
import { mulberry32 } from './report.mjs';
import { cohenKappa } from './reliability.mjs';

export const AUDIT_SAMPLE = 40;
export const AUDIT_BATCH = 5;

export function sampleRows(rows, n = AUDIT_SAMPLE, seed = 3) {
  const rnd = mulberry32(seed);
  const xs = [...rows];
  for (let i = xs.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1)); [xs[i], xs[j]] = [xs[j], xs[i]]; }
  return xs.slice(0, n);
}

export function judgePrompt(batch, apps) {
  const list = apps.map((a) => `- ${a.name}${a.aliases?.length ? ` (also written: ${a.aliases.join('; ')})` : ''}${a.appStoreId ? ` [App Store id ${a.appStoreId}]` : ''}`).join('\n');
  const answers = batch.map((r, i) => `<answer id="${i + 1}">\n${r.text}\n</answer>`).join('\n\n');
  return `You are coding survey data. For each answer below, decide for each app whether the answer MENTIONS that app by name (any spelling of the listed names, or a store link to it). Mentioning only as something to avoid still counts as mentioned. A different app with a similar generic name does NOT count.

Apps:
${list}

${answers}

Reply with JSON only, no prose: {"answers":[{"id":1,"mentioned":{"<app name>":true|false, ...}}, ...]} using the exact app names from the list.`;
}

export function parseJudge(text, batchSize, apps) {
  const m = /\{[\s\S]*\}/.exec(String(text));
  if (!m) throw new Error('judge returned no JSON');
  const j = JSON.parse(m[0]);
  const out = [];
  for (let i = 1; i <= batchSize; i += 1) {
    const a = (j.answers ?? []).find((x) => Number(x.id) === i);
    if (!a) throw new Error(`judge omitted answer ${i}`);
    out.push(Object.fromEntries(apps.map((app) => {
      const v = a.mentioned?.[app.name];
      if (typeof v !== 'boolean') throw new Error(`judge gave no boolean for "${app.name}" in answer ${i}`);
      return [app.name, v];
    })));
  }
  return out;
}

/** Run the audit. Returns {kappa, pairs, agreement, disagreements, judged, failedBatches}. */
export async function audit(rows, cfg, { judge = 'claude-cli', askImpl = askProvider, n = AUDIT_SAMPLE, log = () => {} } = {}) {
  const apps = [cfg.target, ...(cfg.competitors ?? [])];
  const sample = sampleRows(rows.filter((r) => r.ok), n);
  const pairs = [];
  const codes = [];
  const disagreements = [];
  let failedBatches = 0;
  for (let i = 0; i < sample.length; i += AUDIT_BATCH) {
    const batch = sample.slice(i, i + AUDIT_BATCH);
    let coded;
    try {
      const r = await askImpl(judge, judgePrompt(batch, apps), { timeoutMs: 240_000 });
      coded = parseJudge(r.text, batch.length, apps);
    } catch (e) {
      failedBatches += 1;
      log(`  audit batch ${i / AUDIT_BATCH + 1} failed: ${e.message.slice(0, 120)}`);
      if (e instanceof ProviderError && ['rate_limited', 'auth', 'quota'].includes(e.kind)) break;
      continue;
    }
    batch.forEach((row, k) => {
      const a = analyse(row.text, cfg.target, cfg.competitors ?? []);
      for (const app of apps) {
        const ext = a.mentions.some((m) => m.name === app.name);
        const jud = coded[k][app.name];
        pairs.push([ext, jud]);
        codes.push({ provider: row.provider, prompt: row.prompt, repeat: row.repeat, app: app.name, judge: jud, extractor: ext });
        if (ext !== jud) disagreements.push({ provider: row.provider, prompt: row.prompt, app: app.name, extractor: ext, judge: jud, excerpt: excerptAround(row.text, app) });
      }
    });
  }
  const kappa = cohenKappa(pairs);
  const agreement = pairs.length ? pairs.filter(([x, y]) => x === y).length / pairs.length : null;
  const judged = pairs.length / Math.max(1, apps.length);
  const reason = !pairs.length ? 'judge produced no usable codes' : failedBatches ? `${failedBatches} judge batch(es) failed — κ over ${judged} answers` : null;
  // `codes` keeps every judge decision so κ can be recomputed if the extractor changes, without asking the judge again.
  return { judge, kappa: pairs.length ? kappa : null, agreement, pairs: pairs.length, judged, failedBatches, disagreements, codes, reason };
}

function excerptAround(text, app) {
  const t = String(text);
  for (const n of [app.name, ...(app.aliases ?? [])]) {
    const i = t.toLowerCase().indexOf(String(n).toLowerCase());
    if (i >= 0) return t.slice(Math.max(0, i - 80), i + 80).replace(/\s+/g, ' ');
  }
  return t.slice(0, 160).replace(/\s+/g, ' ');
}
