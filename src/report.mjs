// Turn a run's answers into numbers. Only counts what was observed: failed calls are reported as failures and are
// never counted as "not mentioned". Rates carry a 95% Wilson interval because answer engines are noisy and runs are small.

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

const pct = (x) => (x == null ? '—' : `${(x * 100).toFixed(0)}%`);
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/**
 * @param {Array} rows responses.jsonl rows: {provider, prompt, repeat, ok, error?, analysis?}
 * @param {{target:{name}, competitors:Array<{name}>}} cfg
 */
export function aggregate(rows, cfg) {
  const providers = [...new Set(rows.map((r) => r.provider))];
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
    return {
      provider: p,
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
  L.push(`\n**Overall mention rate: ${pct(agg.overall.rate)}** (${agg.overall.mentioned}/${agg.answers}, 95% CI ${pct(agg.overall.ci[0])}–${pct(agg.overall.ci[1])})`);
  L.push('\n## By answer engine\n');
  L.push('| Engine | Model | Answers | Mentioned | Rate (95% CI) | Avg position | Store link | Share of voice | Failed |');
  L.push('|---|---|---|---|---|---|---|---|---|');
  for (const p of agg.perProvider) {
    const t = p.target;
    L.push(`| ${p.provider} | ${p.models.join(', ') || '—'} | ${p.answers} | ${t.mentioned} | ${pct(t.rate)} (${pct(t.ci[0])}–${pct(t.ci[1])}) | ${t.avgRank == null ? '—' : t.avgRank.toFixed(1)} | ${t.linked} | ${pct(p.shareOfVoice)} | ${p.failed} |`);
  }
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
