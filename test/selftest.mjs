// No network, no LLM calls. `node test/selftest.mjs` — exit 0 when every case passes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { analyse, findMention, listItemStarts, listRankAt, listedNames, storeLinks, aliasesOf, brandOf } from '../src/extract.mjs';
import { aggregate, wilson, renderMarkdown, promptBootstrap } from '../src/report.mjs';
import { planJobs, runCheck, validateConfig, promptSetHash, trend } from '../src/run.mjs';
import { ProviderError, ask, classifyHttp, classifyCliError, parseProviderSpec } from '../src/providers.mjs';
import { lint, length, validateListing } from '../src/lint.mjs';
import { RateLimitedError, lookup, suggestPrompts } from '../src/store.mjs';
import { handle } from '../mcp/server.mjs';
import { spearman, testRetest, popularity, appRates } from '../src/validate.mjs';
import { parseArgv, slug } from '../bin/app-aeo.mjs';

let pass = 0, fail = 0;
async function t(name, fn) {
  try { await fn(); pass += 1; } catch (e) { fail += 1; console.log(`FAIL ${name}\n  ${e.message.split('\n').join('\n  ')}`); }
}

const ANSWER = `Here are good options:

1. **Streaks** — polished, [App Store](https://apps.apple.com/us/app/streaks/id963034692)
2. **Habitify** — great reminders
3. **HabitKit** — visual grids https://apps.apple.com/us/app/habit-tracker-habitkit/id6443918070
4. **Loop Habit Tracker** — Android, https://play.google.com/store/apps/details?id=org.isoron.uhabits

Streaks is my top pick.`;
const STREAKS = { name: 'Streaks', appStoreId: '963034692' };
const HABITIFY = { name: 'Habitify', aliases: ['Habitify - Habit Tracker'] };
const LOOP = { name: 'Loop', playId: 'org.isoron.uhabits' };

// extract
await t('storeLinks finds apple and play ids in order', () => {
  assert.deepEqual(storeLinks(ANSWER).map((l) => `${l.store}:${l.id}`), ['apple:963034692', 'apple:6443918070', 'play:org.isoron.uhabits']);
});
await t('brandOf picks the brand, not the generic phrase', () => {
  assert.equal(brandOf('Habit Tracker - HabitKit', 'habit tracker'), 'HabitKit');
  assert.equal(brandOf('Habitify: Habit Tracker', 'habit tracker'), 'Habitify');
  assert.equal(brandOf('Streaks', 'habit tracker'), 'Streaks');
  assert.equal(brandOf('Daily Planner - Simple App', 'habit tracker'), 'Daily Planner');
});
await t('no automatic generic alias: "Habit Tracker - HabitKit" does not match plain "habit tracker"', () => {
  assert.deepEqual(aliasesOf({ name: 'Habit Tracker - HabitKit' }), ['Habit Tracker - HabitKit']);
  assert.equal(findMention('the best habit tracker is up to you', { name: 'Habit Tracker - HabitKit' }), null);
  assert.equal(findMention(ANSWER, HABITIFY).matchedBy, 'name:Habitify');
});
await t('word boundary: "Streak" does not match "Streaks"', () => {
  assert.equal(findMention('I keep a streak going with Streaksy', { name: 'Streaks' }), null);
});
await t('link-only mention counts and is flagged linked', () => {
  const m = findMention('try https://apps.apple.com/kr/app/x/id963034692 now', STREAKS);
  assert.equal(m.linked, true);
  assert.equal(m.matchedBy, 'link:apple:963034692');
});
await t('Korean name matched without ASCII boundary issues', () => {
  assert.notEqual(findMention('추천: 1. 루틴메이트 2. 마이루틴', { name: '마이루틴' }), null);
  assert.equal(findMention('추천: 마이루틴플러스', { name: '마이루틴' }), null);
});
await t('list rank = list item number', () => {
  const starts = listItemStarts(ANSWER);
  assert.equal(starts.length, 4);
  assert.equal(listRankAt(starts, ANSWER.indexOf('HabitKit')), 3);
  assert.equal(listRankAt(starts, 0), null);
});
await t('analyse orders known apps and reports unknown ones', () => {
  const a = analyse(ANSWER, STREAKS, [HABITIFY, LOOP]);
  assert.deepEqual(a.mentions.map((m) => [m.name, m.listRank, m.linked]), [['Streaks', 1, true], ['Habitify', 2, false], ['Loop', 4, true]]);
  assert.deepEqual(a.otherLinks, [{ store: 'apple', id: '6443918070' }]);
  assert.deepEqual(a.otherNames, ['HabitKit']);
  assert.equal(a.target.listRank, 1);
});
await t('listedNames reads bold names incl. [link] form', () => {
  assert.deepEqual(listedNames('1. **[Way of Life](https://x)** — a\n2. **Done** — b'), ['Way of Life', 'Done']);
  assert.deepEqual(listedNames('- **Simple and polished:** Streaks\n- **Free with a generous tier:** Habitify'), []);
  assert.deepEqual(listedNames('- **Notion or a spreadsheet** — x\n- **Android: Loop Habit Tracker.** y\n- **iOS: Streaks** z'), ['Streaks']);
  // Real labels from search-mode answers (2026-10-10 run) must not become "apps".
  assert.deepEqual(listedNames('- **Android user?** x\n- **iPhone →** y\n- **Kotlin + Jetpack Compose** z\n- **One-time purchase** w\n- **Room database** v\n- **Want gamification?** u\n- **Habitica** ok\n- **Apple Reminders** ok'), ['Habitica', 'Apple Reminders']);
});

// report
await t('wilson interval brackets the rate', () => {
  const [lo, hi] = wilson(5, 10);
  assert.ok(lo > 0.23 && lo < 0.25 && hi > 0.75 && hi < 0.77, `${lo} ${hi}`);
  assert.deepEqual(wilson(0, 0), [null, null]);
});
const cfg = { target: STREAKS, competitors: [HABITIFY], prompts: ['p1', 'p2'], providers: ['claude-cli', 'codex-cli'] };
const okRow = (provider, prompt, text) => ({ provider, prompt, repeat: 1, ok: true, model: 'm', analysis: analyse(text, cfg.target, cfg.competitors) });
await t('failed calls are excluded from the denominator, not counted as "not mentioned"', () => {
  const rows = [okRow('claude-cli', 'p1', 'Streaks'), { provider: 'claude-cli', prompt: 'p2', repeat: 1, ok: false, errorKind: 'rate_limited' }];
  const agg = aggregate(rows, cfg);
  assert.equal(agg.perProvider[0].target.rate, 1);
  assert.equal(agg.perProvider[0].failed, 1);
  assert.ok(agg.warnings.some((w) => w.includes('excluded from rates')));
});
await t('share of voice and small-sample warning', () => {
  const agg = aggregate([okRow('codex-cli', 'p1', 'Habitify and Streaks'), okRow('codex-cli', 'p2', 'Habitify')], cfg);
  assert.equal(agg.perProvider[0].shareOfVoice, 1 / 3);
  assert.ok(agg.warnings[0].startsWith('Only 2 prompts'));
  const md = renderMarkdown(agg);
  assert.match(md, /Overall mention rate: 50%/);
  assert.match(md, /\| p2 \| 0\/1 \|/);
  assert.doesNotMatch(md, /\| p1 \| 1\/1 \|/);
});

await t('bootstrap is over prompts: 3 repeats of 2 prompts ≠ 6 independent answers', () => {
  const b = promptBootstrap([1, 0]);
  assert.equal(b.mean, 0.5);
  assert.equal(b.prompts, 2);
  assert.deepEqual(b.ci, [0, 1], 'two prompts that disagree can only bound the rate to [0,1]');
  assert.deepEqual(promptBootstrap([0.5]).ci, [null, null]);
});
await t('stability counts prompts whose repeats agree; no-repeat runs are flagged', () => {
  const rows = [
    { ...okRow('claude-cli', 'p1', 'Streaks'), repeat: 1 }, { ...okRow('claude-cli', 'p1', 'Streaks'), repeat: 2 },
    { ...okRow('claude-cli', 'p2', 'Streaks'), repeat: 1 }, { ...okRow('claude-cli', 'p2', 'nothing'), repeat: 2 },
  ];
  const p = aggregate(rows, cfg).perProvider[0];
  assert.deepEqual(p.stability, { prompts: 2, agreeing: 1, rate: 0.5 });
  assert.equal(p.target.byPrompt.mean, 0.75);
  assert.ok(aggregate([okRow('claude-cli', 'p1', 'x')], cfg).warnings.some((w) => w.includes('no repeats')));
});

// run
await t('validateConfig rejects bad input', () => {
  assert.deepEqual(validateConfig(cfg), []);
  assert.ok(validateConfig({ ...cfg, providers: ['nope'] })[0].startsWith('unknown provider'));
  assert.ok(validateConfig({ ...cfg, prompts: [] }).length === 1);
  assert.ok(validateConfig({ ...cfg, providers: ['openai'] })[0].includes('needs a model'));
});
await t('planJobs round-robins prompts across engines', () => {
  assert.deepEqual(planJobs({ ...cfg, repeats: 2 }).slice(0, 3).map((j) => `${j.provider}|${j.prompt}|${j.repeat}`), ['claude-cli|p1|1', 'codex-cli|p1|1', 'claude-cli|p2|1']);
});
await t('promptSetHash ignores order', () => assert.equal(promptSetHash(['a', 'b']), promptSetHash(['b', 'a'])));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'app-aeo-test-'));
await t('run: rate limit halts that engine only, exit 10, resume fills the gap', async () => {
  let codexCalls = 0;
  const askImpl = async (provider, prompt) => {
    if (provider === 'codex-cli') { codexCalls += 1; throw new ProviderError('rate_limited', '429'); }
    return { text: prompt === 'p1' ? '1. Streaks\n2. Habitify' : 'Habitify', model: 'sonnet', ms: 1 };
  };
  const r = await runCheck(cfg, { outDir: tmp, log: () => {}, askImpl, concurrency: 1 });
  assert.equal(r.exitCode, 10);
  assert.equal(codexCalls, 1, 'second codex call must not happen after rate limit');
  assert.deepEqual(r.halted, [['codex-cli', 'rate_limited']]);
  assert.equal(r.agg.perProvider.find((p) => p.provider === 'claude-cli').target.rate, 0.5);
  const r2 = await runCheck(cfg, { outDir: tmp, resumeDir: r.dir, log: () => {}, askImpl: async () => ({ text: 'Streaks', model: 'x', ms: 1 }) });
  assert.equal(r2.calls, 2, 'only the two failed codex jobs are re-asked');
  assert.equal(r2.exitCode, 0);
  assert.equal(r2.agg.answers, 4);
});
await t('run: with a worker pool, no NEW call starts after a rate limit', async () => {
  const many = { ...cfg, providers: ['claude-cli'], prompts: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] };
  let n = 0;
  const askImpl = async () => { n += 1; await new Promise((r) => setTimeout(r, 5)); throw new ProviderError('rate_limited', '429'); };
  const r = await runCheck(many, { outDir: path.join(tmp, 'pool'), log: () => {}, askImpl, concurrency: 3 });
  assert.equal(n, 3, 'only the 3 calls already in flight may run');
  assert.equal(r.exitCode, 1);
});
await t('run: rag mode grounds memory engines once per prompt (cached across repeats), search engines untouched', async () => {
  const c = { ...cfg, providers: ['groq:m', 'claude-search'], prompts: ['p1', 'p2'], repeats: 2, ground: 'tavily' };
  let searches = 0;
  const seen = [];
  const searchImpl = async (q) => { searches += 1; return [{ title: 'T', url: `https://x/${q}`, content: 'Streaks is great' }]; };
  const askImpl = async (provider, prompt) => { seen.push([provider, prompt]); return { text: 'Streaks', model: 'm', ms: 1, grounded: provider === 'claude-search' }; };
  const r = await runCheck(c, { outDir: path.join(tmp, 'rag'), log: () => {}, askImpl, searchImpl });
  assert.equal(searches, 2, 'one search per prompt, reused by repeats');
  assert.ok(seen.filter(([p]) => p === 'groq:m').every(([, q]) => q.startsWith('Web search results')), 'memory engine got the rag prompt');
  assert.ok(seen.filter(([p]) => p === 'claude-search').every(([, q]) => q === 'p1' || q === 'p2'), 'search engine got the raw question');
  assert.deepEqual(r.agg.perProvider.map((p) => [p.provider, p.mode, p.grounded]), [['groq:m', 'rag', 4], ['claude-search', 'search', 4]]);
});
await t('run: grounding quota halts rag engines with a reason, not empty answers', async () => {
  const c = { ...cfg, providers: ['groq:m'], prompts: ['p1', 'p2', 'p3'], ground: 'tavily' };
  let asked = 0;
  const r = await runCheck(c, { outDir: path.join(tmp, 'ragq'), log: () => {}, concurrency: 1, askImpl: async () => { asked += 1; return { text: 'x', model: 'm', ms: 1 }; }, searchImpl: async () => { throw new ProviderError('quota', 'HTTP 432'); } });
  assert.equal(asked, 0);
  assert.equal(r.exitCode, 1);
  assert.deepEqual(r.halted, [['groq:m', 'quota']]);
});
await t('run: budget cut → exit 10; nothing answered → exit 1', async () => {
  const r = await runCheck(cfg, { outDir: tmp, maxCalls: 1, log: () => {}, askImpl: async () => ({ text: 'x', model: 'm', ms: 1 }) });
  assert.equal(r.exitCode, 10);
  const r2 = await runCheck(cfg, { outDir: path.join(tmp, 'b'), log: () => {}, askImpl: async () => { throw new ProviderError('failed', 'boom'); } });
  assert.equal(r2.exitCode, 1);
});
await t('trend reads previous runs', () => {
  const tr = trend(tmp);
  assert.ok(tr.points.length >= 2);
  assert.match(tr.markdown, /Mention-rate trend — Streaks/);
});

// providers
await t('parseProviderSpec', () => {
  assert.deepEqual(parseProviderSpec('claude-cli:sonnet'), { type: 'claude-cli', model: 'sonnet', id: 'claude-cli:sonnet', mode: 'memory' });
  assert.equal(parseProviderSpec('gemini-search:gemini-2.5-flash').mode, 'search');
  assert.equal(parseProviderSpec('openrouter:openai/gpt-4o-mini').model, 'openai/gpt-4o-mini');
});
await t('fallback chain: exhausted link is skipped for the rest of the run; mixed modes rejected', async () => {
  process.env.GROQ_API_KEY = 'k'; process.env.CEREBRAS_API_KEY = 'k';
  const hits = [];
  const fetchImpl = async (url) => { hits.push(url.includes('groq') ? 'groq' : 'cerebras'); return url.includes('groq') ? { ok: false, status: 429, text: async () => 'limit' } : { ok: true, status: 200, text: async () => JSON.stringify({ model: 'gpt-oss', choices: [{ message: { content: 'Streaks' } }] }) }; };
  const spec = 'groq:openai/gpt-oss-120b|cerebras:gpt-oss-120b';
  const { newChainState } = await import('../src/providers.mjs');
  const state = newChainState();
  const a = await ask(spec, 'q', { fetchImpl, chainState: state });
  const b = await ask(spec, 'q', { fetchImpl, chainState: state });
  assert.deepEqual([a.via, b.via], ['cerebras:gpt-oss-120b', 'cerebras:gpt-oss-120b']);
  assert.deepEqual(hits, ['groq', 'cerebras', 'cerebras'], 'groq must not be retried after its 429');
  assert.throws(() => parseProviderSpec('claude-search|groq:x'), /mixes modes/);
  delete process.env.GROQ_API_KEY; delete process.env.CEREBRAS_API_KEY;
});
await t('codexEvents counts web_search events and URLs; claudeSearchCount sums modelUsage', async () => {
  const { codexEvents, claudeSearchCount } = await import('../src/providers.mjs');
  const ev = codexEvents('{"type":"item.started","item":{"type":"web_search","query":"x"}}\n{"type":"item.completed","item":{"type":"web_search","query":"x"}}\n{"type":"item.completed","item":{"type":"agent_message","text":"see https://apps.apple.com/us/app/x/id1"}}\nnot json');
  assert.deepEqual(ev, { searches: 1, urls: ['https://apps.apple.com/us/app/x/id1'] });
  assert.equal(claudeSearchCount({ modelUsage: { a: { webSearchRequests: 0 }, b: { webSearchRequests: 2 } } }), 2);
});
await t('codex engines pass consumer-role developer_instructions (coding-agent misread fix)', async () => {
  let argsSeen;
  const run = async (cmd, args) => { argsSeen = args; const o = args[args.indexOf('-o') + 1]; fs.writeFileSync(o, 'Streaks'); return { code: 0, stdout: '{"type":"item.completed","item":{"type":"web_search"}}', stderr: '' }; };
  const r = await ask('codex-search', 'habit tracker app for iphone', { run });
  assert.equal(argsSeen[0], '--search');
  const di = argsSeen[argsSeen.indexOf('-c') + 1];
  assert.match(di, /^developer_instructions=".*not a coding.*Search the web/);
  assert.equal(r.grounded, true);
});
await t('HTTP 429/401/402 classified as halting kinds', () => {
  assert.equal(classifyHttp(429), 'rate_limited');
  assert.equal(classifyHttp(401), 'auth');
  assert.equal(classifyHttp(402), 'quota');
  assert.equal(classifyHttp(500, 'oops'), 'failed');
  assert.equal(classifyCliError('Claude usage limit reached'), 'rate_limited');
});
await t('openai-compatible provider: answer, citations, and 429 → ProviderError', async () => {
  process.env.PERPLEXITY_API_KEY = 'test';
  const okFetch = async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ model: 'sonar', choices: [{ message: { content: 'Use Streaks' } }], citations: ['https://a', 'https://a'] }) });
  const r = await ask('perplexity:sonar', 'q', { fetchImpl: okFetch });
  assert.equal(r.text, 'Use Streaks');
  assert.deepEqual(r.citations, ['https://a']);
  const limited = async () => ({ ok: false, status: 429, text: async () => 'slow down' });
  await assert.rejects(ask('perplexity:sonar', 'q', { fetchImpl: limited }), (e) => e instanceof ProviderError && e.kind === 'rate_limited');
  delete process.env.PERPLEXITY_API_KEY;
  await assert.rejects(ask('perplexity:sonar', 'q', { fetchImpl: okFetch }), (e) => e.kind === 'auth');
});
await t('gemini-search sends google_search tool and keeps grounding sources', async () => {
  process.env.GEMINI_API_KEY = 'test';
  let sent;
  const fetchImpl = async (url, init) => { sent = JSON.parse(init.body); return { ok: true, status: 200, text: async () => JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Streaks' }] }, groundingMetadata: { webSearchQueries: ['best habit app'], groundingChunks: [{ web: { uri: 'https://vertexaisearch/x', title: 'zapier.com' } }] } }] }) }; };
  const r = await ask('gemini-search:gemini-2.5-flash', 'q', { fetchImpl });
  assert.deepEqual(sent.tools, [{ google_search: {} }]);
  assert.deepEqual([r.grounded, r.citations, r.searchQueries], [true, ['zapier.com'], ['best habit app']]);
  await ask('gemini:gemini-2.5-flash', 'q', { fetchImpl });
  assert.equal(sent.tools, undefined, 'memory-mode gemini must not search');
  delete process.env.GEMINI_API_KEY;
});
await t('claude-cli provider parses JSON result and surfaces is_error', async () => {
  let argsSeen;
  const spy = async (cmd, args) => { argsSeen = args; return { code: 0, stdout: JSON.stringify({ result: 'ok', modelUsage: { m: { webSearchRequests: 1 } } }), stderr: '' }; };
  const mem = await ask('claude-cli', 'q', { run: spy });
  assert.match(argsSeen[argsSeen.indexOf('--system-prompt') + 1], /not a coding/, 'coding-agent system prompt must be replaced');
  assert.equal(argsSeen[argsSeen.indexOf('--tools') + 1], '', 'memory mode has no tools');
  assert.equal(mem.grounded, false);
  const se = await ask('claude-search', 'q', { run: spy });
  assert.equal(argsSeen[argsSeen.indexOf('--tools') + 1], 'WebSearch');
  assert.match(argsSeen[argsSeen.indexOf('--system-prompt') + 1], /Search the web/);
  assert.equal(se.grounded, true);
  const run = async () => ({ code: 0, stdout: JSON.stringify({ result: 'Streaks!', is_error: false, modelUsage: { 'claude-sonnet-x': {} }, total_cost_usd: 0.01 }), stderr: '' });
  const r = await ask('claude-cli:sonnet', 'q', { run });
  assert.equal(r.text, 'Streaks!');
  assert.equal(r.model, 'claude-sonnet-x');
  const bad = async () => ({ code: 1, stdout: JSON.stringify({ is_error: true, result: 'usage limit reached' }), stderr: '' });
  await assert.rejects(ask('claude-cli', 'q', { run: bad }), (e) => e.kind === 'rate_limited');
});

// lint
await t('lint counts graphemes (Korean is not over-counted)', () => {
  assert.equal(length('한글'.normalize('NFD')), 2);
  const [r] = lint({ locale: 'ko', name: '최고의 습관 앱', keywords: '습관, 습관,루틴' });
  const msgs = r.issues.map((i) => `${i.level}:${i.field}`);
  assert.ok(msgs.includes('warn:name'), 'claim word 최고 warned');
  assert.equal(r.issues.filter((i) => i.field === 'keywords').length, 3, JSON.stringify(r.issues));
});
await t('lint errors on over-limit and avoided names', () => {
  const [r] = lint({ locale: 'en', name: 'x'.repeat(31), subtitle: 'Like Streaks but better' }, ['Streaks']);
  assert.deepEqual(r.issues.filter((i) => i.level === 'error').map((i) => i.field), ['name', 'subtitle']);
  assert.equal(validateListing([{ name: 'x' }]), '[0] missing locale');
});

// store
await t('suggestPrompts: 10 + 2 per competitor, ko locale', () => {
  const ps = suggestPrompts({ category: '습관 관리', competitors: ['Streaks'], locale: 'ko', year: 2026 });
  assert.equal(ps.length, 12);
  assert.ok(ps.includes('2026년 습관 관리 앱 순위 알려줘.'));
});
await t('lookup keeps missing ids as null and 429 throws', async () => {
  const fetchImpl = async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ results: [{ trackId: 1, trackName: 'A' }] }) });
  const r = await lookup(['1', '2'], { fetchImpl, gapMs: 0 });
  assert.equal(r[0].name, 'A');
  assert.equal(r[1], null);
  await assert.rejects(lookup(['1'], { fetchImpl: async () => ({ ok: false, status: 429 }), gapMs: 0 }), RateLimitedError);
});

// validate
await t('spearman: perfect, inverse, ties, too few', () => {
  assert.equal(spearman([1, 2, 3, 4, 5], [2, 4, 6, 8, 10]).rho, 1);
  assert.equal(spearman([1, 2, 3, 4, 5], [5, 4, 3, 2, 1]).rho, -1);
  const s1 = spearman([1, 2, 3, 4, 5, 6, 7, 8], [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.ok(s1.p < 0.01, `p=${s1.p}`);
  assert.equal(spearman([1, 2], [1, 2]).rho, null);
  assert.equal(spearman([1, 1, 1], [1, 2, 3]).rho, null, 'constant input has no rank correlation');
});
await t('appRates counts each app once per answer, incl. engine-added names', () => {
  const rows = [okRow('x', 'p1', '1. **Streaks** a\n2. **Habitica** b\nStreaks again'), okRow('x', 'p2', 'Habitify')];
  const r = appRates(rows, cfg);
  assert.deepEqual(r.apps.map((a) => [a.name, a.rate]), [['Streaks', 0.5], ['Habitica', 0.5], ['Habitify', 0.5]]);
});
await t('testRetest: identical runs → rho 1; popularity never guesses unmatched apps', async () => {
  const rows = [okRow('x', 'p1', '1. **Streaks** a\n2. **Habitica** b'), okRow('x', 'p2', 'Streaks and Habitify'), okRow('x', 'p3', 'Streaks')];
  assert.equal(testRetest(rows, rows, cfg).rho, 1);
  const store = { streaks: [{ name: 'Streaks Clone', ratingCount: 1 }, { name: 'Streaks', ratingCount: 9000, appStoreId: '1' }, { name: 'Streaks', ratingCount: 2, appStoreId: '9' }], habitify: [{ name: 'Habitify: Habit Tracker', ratingCount: 900, appStoreId: '2' }], habitica: [{ name: 'Something Else', ratingCount: 5 }] };
  const pop = await popularity(rows, cfg, async (term) => store[term.toLowerCase()] ?? []);
  assert.deepEqual(pop.matched.map((m) => [m.name, m.ratingCount]), [['Streaks', 9000], ['Habitify', 900]], 'same-brand clone with fewer ratings must not win');
  const viaId = await popularity(rows, cfg, async () => [], { lookupImpl: async (ids) => ids.map((id) => ({ name: 'Streaks', appStoreId: id, ratingCount: 27000 })) });
  assert.deepEqual(viaId.matched.map((m) => [m.name, m.appStoreId]), [['Streaks', '963034692']], 'configured ids are looked up, not searched');
  assert.deepEqual(viaId.unmatched, ['Habitica', 'Habitify'], 'apps without an id and without a search hit stay unmatched');
  assert.deepEqual(pop.unmatched, ['Habitica']);
});

// doctor
await t('doctor: recommends only ready engines; chains keep only links with keys; rag only with tavily + a free chain', async () => {
  const { inspect } = await import('../src/doctor.mjs');
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'aeo-home-'));
  const none = inspect({ env: {}, home, binImpl: () => false });
  assert.deepEqual(none.recommended, { providers: [], ground: undefined });
  fs.mkdirSync(path.join(home, '.codex')); fs.writeFileSync(path.join(home, '.codex', 'auth.json'), '{}');
  const d = inspect({ env: { CEREBRAS_API_KEY: 'k', TAVILY_API_KEY: 't' }, home, binImpl: (b) => b === 'codex' });
  assert.deepEqual(d.recommended, { providers: ['codex-search', 'cerebras:gpt-oss-120b'], ground: 'tavily' });
  const noTav = inspect({ env: { TAVILY_API_KEY: 't' }, home, binImpl: (b) => b === 'claude' });
  assert.deepEqual(noTav.recommended, { providers: ['claude-search'], ground: undefined }, 'tavily alone does not enable rag');
});

// MCP
await t('MCP initialize / tools/list / tools/call / unknown method', async () => {
  const init = await handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } });
  assert.equal(init.result.protocolVersion, '2025-06-18');
  const list = await handle({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  assert.ok(list.result.tools.some((x) => x.name === 'run_app_aeo_check'));
  const lintRes = await handle({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'lint_app_listing', arguments: { listing: { locale: 'en', name: 'Best App' } } } });
  assert.match(lintRes.result.content[0].text, /ranking\/price claim/);
  assert.equal((await handle({ jsonrpc: '2.0', id: 4, method: 'nope' })).error.code, -32601);
  assert.equal(await handle({ jsonrpc: '2.0', method: 'notifications/initialized' }), null);
});
await t('MCP run_app_aeo_check with injected engine', async () => {
  const res = await handle({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'run_app_aeo_check', arguments: { target: STREAKS, prompts: ['p'], providers: ['claude-cli'], outDir: path.join(tmp, 'mcp') } } }, { askImpl: async () => ({ text: 'Streaks', model: 'm', ms: 1 }) });
  assert.match(res.result.content[0].text, /Overall mention rate: 100%/);
  assert.equal(res.result.isError, false);
});

// CLI helpers
await t('parseArgv and slug', () => {
  assert.deepEqual(parseArgv(['check', 'c.json', '--max-calls', '5', '--dry-run', '--competitor', 'A', '--competitor=B']), { pos: ['check', 'c.json'], opt: { '--max-calls': '5', '--dry-run': true, '--competitor': ['A', 'B'] } });
  assert.equal(slug('Habitify - Habit Tracker'), 'habitify-habit-tracker');
  assert.throws(() => parseArgv(['--out']), /needs a value/);
});

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`=== app-aeo selftest: PASS ${pass} / FAIL ${fail} ===`);
process.exitCode = fail ? 1 : 0;
