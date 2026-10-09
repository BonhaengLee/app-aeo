// Turn a run's answers into numbers. Only counts what was observed: failed calls are reported as failures and are
// never counted as "not mentioned". Rates carry a 95% Wilson interval because answer engines are noisy and runs are small.

import { parseProviderSpec } from './providers.mjs';

export const MIN_PROMPTS = 10;
export const MIN_ANSWERS_PER_PROVIDER = 30;

/** 95% Wilson score interval for k successes out of n. */
export function wilson(k, n, z = 1.96) {
  if (!n) return [null, null];
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}

/** Deterministic PRNG so the same run always reports the same interval. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/**
 * Mean of per-prompt rates with a 95% percentile bootstrap over prompts.
 * Prompts — not answers — are the sampling unit: repeats of one prompt are correlated, so treating them as
 * independent answers would make the interval falsely narrow.
 */
export function promptBootstrap(rates, { B = 2000, seed = 7 } = {}) {
  const xs = rates.filter((x) => x != null);
  if (!xs.length) return { mean: null, ci: [null, null], prompts: 0 };
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  if (xs.length === 1) return { mean: m, ci: [null, null], prompts: 1 };
  const rnd = mulberry32(seed);
  const means = [];
  for (let b = 0; b < B; b += 1) { let sum = 0; for (let i = 0; i < xs.length; i += 1) sum += xs[Math.floor(rnd() * xs.length)]; means.push(sum / xs.length); }
  means.sort((a, b) => a - b);
  return { mean: m, ci: [means[Math.floor(0.025 * B)], means[Math.ceil(0.975 * B) - 1]], prompts: xs.length };
}

const pct = (x) => (x == null ? '—' : `${(x * 100).toFixed(0)}%`);
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/**
 * @param {Array} rows responses.jsonl rows: {provider, prompt, repeat, ok, error?, analysis?}
 * @param {{target:{name}, competitors:Array<{name}>}} cfg
 */
export function aggregate(rows, cfg) {
  // Report engines in config order (not in whatever order answers arrived).
  const order = (cfg.providers ?? []).map((sp) => { try { return parseProviderSpec(sp).id; } catch { return sp; } });
  const providers = [...new Set(rows.map((r) => r.provider))].sort((a, b) => (order.indexOf(a) + 1 || 1e9) - (order.indexOf(b) + 1 || 1e9));
  const prompts = [...new Set(rows.map((r) => r.prompt))];
  const appNames = [cfg.target.name, ...(cfg.competitors ?? []).map((c) => c.name)];
  const perProvider = providers.map((p) => {
    const mine = rows.filter((r) => r.provider === p);
    const ok = mine.filter((r) => r.ok);
    const failed = mine.filter((r) => !r.ok);
    const apps = appNames.map((name) => {
      const hits = ok.map((r) => r.analysis.mentions.find((m) => m.name === name)).filter(Boolean);
      const ranks = hits.map((h) => h.listRank ?? h.order);
      return { name, mentioned: hits.length, rate: ok.length ? hits.length / ok.length : null, ci: wilson(hits.length, ok.length), avgRank: mean(ranks), linked: hits.filter((h) => h.linked).length };
    });
    const totalMentions = apps.reduce((a, b) => a + b.mentioned, 0);
    const target = apps[0];
    // Prompt-level view: per-prompt mention rate across repeats → bootstrap over prompts; stability across repeats.
    const byPrompt = prompts.map((q) => ok.filter((r) => r.prompt === q)).filter((xs) => xs.length);
    const promptRates = byPrompt.map((xs) => xs.filter((r) => r.analysis.target).length / xs.length);
    const repeated = byPrompt.filter((xs) => xs.length >= 2);
    const agree = repeated.filter((xs) => { const k = xs.filter((r) => r.analysis.target).length; return k === 0 || k === xs.length; }).length;
    target.byPrompt = promptBootstrap(promptRates);
    const stability = repeated.length ? { prompts: repeated.length, agreeing: agree, rate: agree / repeated.length } : null;
    const grounded = ok.filter((r) => r.grounded).length;
    return {
      provider: p,
      mode: mine[0]?.mode ?? null,
      grounded,
      stability,
      models: [...new Set(ok.map((r) => r.model).filter(Boolean))],
      answers: ok.length,
      failed: failed.length,
      failures: [...new Set(failed.map((r) => r.errorKind ?? 'failed'))],
      target,
      shareOfVoice: totalMentions ? target.mentioned / totalMentions : null,
      apps,
    };
  });
  const allOk = rows.filter((r) => r.ok);
  const other = new Map();
  for (const r of allOk) {
    for (const n of r.analysis.otherNames) other.set(`name:${n}`, (other.get(`name:${n}`) ?? 0) + 1);
    for (const l of r.analysis.otherLinks) other.set(`${l.store}:${l.id}`, (other.get(`${l.store}:${l.id}`) ?? 0) + 1);
  }
  const perPrompt = prompts.map((q) => {
    const mine = allOk.filter((r) => r.prompt === q);
    return { prompt: q, answers: mine.length, targetMentioned: mine.filter((r) => r.analysis.target).length };
  });
  const k = allOk.filter((r) => r.analysis.target).length;
  const warnings = [];
  if (prompts.length < MIN_PROMPTS) warnings.push(`Only ${prompts.length} prompts (< ${MIN_PROMPTS}). Treat rates as anecdotes, not measurements.`);
  for (const p of perProvider) {
    if (p.answers < MIN_ANSWERS_PER_PROVIDER) warnings.push(`${p.provider}: ${p.answers} answers (< ${MIN_ANSWERS_PER_PROVIDER}); the 95% interval is wide.`);
    if (!p.stability) warnings.push(`${p.provider}: no repeats — run-to-run variation unknown. Use repeats ≥ 3 before comparing runs.`);
    else if (p.stability.rate < 0.8) warnings.push(`${p.provider}: only ${(p.stability.rate * 100).toFixed(0)}% of prompts gave the same yes/no across repeats — single answers from this engine are noisy.`);
    if ((p.mode === 'search' || p.mode === 'rag') && p.answers && p.grounded < p.answers) warnings.push(`${p.provider}: ${p.answers - p.grounded}/${p.answers} answers had no search results behind them (${p.mode} mode).`);
    if (p.mode !== 'search' && p.mode !== 'rag') warnings.push(`${p.provider}: ${p.mode}-mode engine — answers come from model memory/agent behaviour, not today's web. Not what consumer chat apps with search show.`);
    if (p.failed) warnings.push(`${p.provider}: ${p.failed} failed call(s) [${p.failures.join(', ')}] — excluded from rates, not counted as "not mentioned".`);
  }
  return {
    target: cfg.target.name,
    prompts: prompts.length,
    answers: allOk.length,
    failed: rows.length - allOk.length,
    overall: { mentioned: k, rate: allOk.length ? k / allOk.length : null, ci: wilson(k, allOk.length) },
    perProvider,
    perPrompt,
    otherApps: [...other.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([key, count]) => ({ key, count })),
    warnings,
  };
}

export function renderMarkdown(agg, meta = {}) {
  const L = [];
  L.push(`# App AEO report — ${agg.target}`);
  if (meta.startedAt) L.push(`\nRun ${meta.startedAt}${meta.finishedAt ? ` → ${meta.finishedAt}` : ''} · ${agg.prompts} prompts · ${agg.answers} answers · ${agg.failed} failed calls`);
  // No pooled headline: pooling engines mixes modes, and an answer-level interval would treat repeats as independent.
  L.push('\n## By answer engine\n');
  L.push('| Engine | Mode | Model | Prompts × answers | Mention rate (95% CI over prompts) | Same answer on repeat | Avg position | Store link | Share of voice | Failed |');
  L.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const p of agg.perProvider) {
    const t = p.target;
    const bp = t.byPrompt;
    const st = p.stability ? `${pct(p.stability.rate)} (${p.stability.agreeing}/${p.stability.prompts})` : 'no repeats';
    L.push(`| ${p.provider} | ${p.mode ?? '—'} | ${p.models.join(', ') || '—'} | ${bp.prompts} × ${p.answers} | ${pct(bp.mean)} (${pct(bp.ci[0])}–${pct(bp.ci[1])}) | ${st} | ${t.avgRank == null ? '—' : t.avgRank.toFixed(1)} | ${t.linked} | ${pct(p.shareOfVoice)} | ${p.failed} |`);
  }
  L.push('\n_Mode: **search** = answer grounded in a live web search (closest to consumer chat apps) · **memory** = model knowledge only · **agent** = coding-agent CLI. Interval = bootstrap over prompts, so repeats do not fake precision._');
  L.push('\n## Competitors (mention rate per engine)\n');
  const names = agg.perProvider[0]?.apps.map((a) => a.name) ?? [];
  L.push(`| App | ${agg.perProvider.map((p) => p.provider).join(' | ')} |`);
  L.push(`|---|${agg.perProvider.map(() => '---').join('|')}|`);
  for (const n of names) L.push(`| ${n === agg.target ? `**${n}**` : n} | ${agg.perProvider.map((p) => { const a = p.apps.find((x) => x.name === n); return `${pct(a.rate)}${a.avgRank == null ? '' : ` @${a.avgRank.toFixed(1)}`}`; }).join(' | ')} |`);
  L.push('\n## Prompts where at least one answer left the app out\n');
  const missing = agg.perPrompt.filter((p) => p.answers && p.targetMentioned < p.answers).sort((a, b) => a.targetMentioned / a.answers - b.targetMentioned / b.answers);
  if (missing.length) { L.push('| Prompt | Mentioned / answers |'); L.push('|---|---|'); for (const p of missing) L.push(`| ${p.prompt.replace(/\|/g, '\\|')} | ${p.targetMentioned}/${p.answers} |`); } else L.push('None.');
  L.push('\n## Apps the engines recommend that you did not list\n');
  if (agg.otherApps.length) { L.push('| App (name or store id) | Answers |'); L.push('|---|---|'); for (const o of agg.otherApps) L.push(`| ${o.key} | ${o.count} |`); } else L.push('None detected.');
  if (agg.warnings.length) { L.push('\n## Caveats\n'); for (const w of agg.warnings) L.push(`- ${w}`); }
  L.push('\n_Mention = name/alias as a whole word or a store link. Position = list item number when the answer is a list. Nothing here is a market share: it is how often these engines named the app for these prompts on this day._');
  return L.join('\n') + '\n';
}

/** Trend table from several aggregates (oldest first). */
export function renderTrend(points) {
  const providers = [...new Set(points.flatMap((p) => p.agg.perProvider.map((x) => x.provider)))];
  const L = [`# Mention-rate trend — ${points[0]?.agg.target ?? ''}`, '', `| Run | Prompts | Overall | ${providers.join(' | ')} |`, `|---|---|---|${providers.map(() => '---').join('|')}|`];
  for (const { run, agg } of points) {
    L.push(`| ${run} | ${agg.prompts} | ${pct(agg.overall.rate)} | ${providers.map((p) => { const x = agg.perProvider.find((y) => y.provider === p); return x ? `${pct(x.target.rate)} (n=${x.answers})` : '—'; }).join(' | ')} |`);
  }
  L.push('', '_Compare runs only when the prompt set is the same; a changed prompt set changes the denominator._');
  return L.join('\n') + '\n';
}
