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
import { handle, callTool, TOOLS } from '../mcp/server.mjs';
import { sourceKey, ownerOf, sourceKind, matchedLift, diagnose, checkPages, diffRuns, renderDiff, pagesToCheck } from '../src/diagnose.mjs';
import { claudeStream } from '../src/providers.mjs';
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
await t('one-word Title-case brands match only capitalised (benchmark: "a calm, playful app" ≠ Calm)', () => {
  const calm = { name: 'Calm' };
  assert.equal(findMention('a calm, playful meditation app for kids', calm), null);
  assert.equal(findMention('**calm** — synonyms: composed', calm), null);
  assert.notEqual(findMention('Try Calm or Headspace.', calm), null);
  assert.notEqual(findMention('CALM is popular', calm), null);
  assert.notEqual(findMention('i use ynab daily', { name: 'YNAB' }), null, 'acronyms stay case-insensitive');
  assert.notEqual(findMention('habitkit is nice', { name: 'HabitKit' }), null, 'CamelCase brands stay case-insensitive');
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
const okRow = (provider, prompt, text) => ({ provider, prompt, repeat: 1, ok: true, model: 'm', text, analysis: analyse(text, cfg.target, cfg.competitors) });
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
  assert.doesNotMatch(md, /Overall mention rate/, 'no pooled headline (mixes engines; repeats are not independent)');
  assert.match(md, /\| codex-cli \|.*\| 50% \(/);
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
  assert.deepEqual(ev, { searches: 1, urls: ['https://apps.apple.com/us/app/x/id1'], queries: ['x'] }, 'query recorded once, at completion');
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
await t('codex child gets an empty HOME and an isolated CODEX_HOME (user ~/.agents skills leaked into answers before)', async () => {
  let envSeen;
  const run = async (cmd, args, opts) => { envSeen = opts.env; fs.writeFileSync(args[args.indexOf('-o') + 1], 'Streaks'); return { code: 0, stdout: '', stderr: '' }; };
  await ask('codex-search', 'q', { run });
  assert.notEqual(envSeen.HOME, os.homedir());
  assert.deepEqual(fs.readdirSync(envSeen.HOME), []);
  assert.deepEqual(fs.readdirSync(envSeen.CODEX_HOME), ['auth.json']);
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

await t('popularity: prefix titles do not match ("Save" ≠ "Save My Doggy"); one-off names are excluded', async () => {
  const rows = Array.from({ length: 30 }, (_, i) => okRow('x', `p${i}`, i === 0 ? '1. **Save** a\n2. **Habitica** b' : i < 10 ? '1. **Habitica** b\n2. **Streaks** c' : 'Streaks'));
  const store = { save: [{ name: 'Save My Doggy - Dog Rescue', ratingCount: 52614 }], habitica: [{ name: 'Habitica: Gamified Taskmanager', ratingCount: 3484 }], streaks: [{ name: 'Streaks', ratingCount: 27349 }] };
  const pop = await popularity(rows, cfg, async (term) => store[term.toLowerCase()] ?? []);
  assert.deepEqual(pop.matched.map((m) => m.name), ['Streaks', 'Habitica']);
  assert.deepEqual(pop.unmatched, [], '"Save" (1/30 answers) is below the 5% floor, so it is not even a candidate');
  const pop2 = await popularity([okRow('x', 'p', '1. **Save** a\n2. **Habitica** b')], cfg, async (term) => store[term.toLowerCase()] ?? []);
  assert.ok(!pop2.matched.some((m) => m.name === 'Save'), 'prefix title must not match');
});

// Codex review regressions (2026-10-10)
await t('R1: --resume with a different config is refused', async () => {
  const r = await runCheck(cfg, { outDir: path.join(tmp, 'r1'), log: () => {}, askImpl: async () => ({ text: 'Streaks', model: 'm', ms: 1 }) });
  const { ConfigMismatchError } = await import('../src/run.mjs');
  await assert.rejects(runCheck({ ...cfg, target: { name: 'Other' } }, { resumeDir: r.dir, log: () => {}, askImpl: async () => ({ text: 'x', model: 'm', ms: 1 }) }), ConfigMismatchError);
  const ok = await runCheck(cfg, { resumeDir: r.dir, log: () => {}, askImpl: async () => ({ text: 'x', model: 'm', ms: 1 }) });
  assert.equal(ok.calls, 0, 'same config resumes, nothing left to ask');
});
await t('R3: config fingerprint separates experiments, ignores prompt order', async () => {
  const { configFingerprint } = await import('../src/run.mjs');
  assert.equal(configFingerprint(cfg), configFingerprint({ ...cfg, prompts: [...cfg.prompts].reverse() }));
  assert.equal(configFingerprint(cfg), configFingerprint({ ...cfg, repeats: 3, providers: ['claude-cli'] }), 'extending repeats/engines keeps the same experiment');
  assert.notEqual(configFingerprint(cfg), configFingerprint({ ...cfg, prompts: ['p1', 'p3'] }));
  assert.notEqual(configFingerprint(cfg), configFingerprint({ ...cfg, competitors: [{ name: 'Habitify', aliases: ['X'] }] }));
});
await t('R4: rag answers with zero search results are flagged', () => {
  const rows = [{ ...okRow('groq:m', 'p1', 'Streaks'), mode: 'rag', grounded: false }];
  assert.ok(aggregate(rows, { ...cfg, providers: ['groq:m'] }).warnings.some((w) => w.includes('no search results behind them (rag mode)')));
});
await t('R5/R7: duplicate prompts and shared aliases are rejected', () => {
  assert.ok(validateConfig({ ...cfg, prompts: ['a', 'A '] }).some((e) => e.startsWith('duplicate prompt')));
  assert.ok(validateConfig({ ...cfg, target: { name: 'T', aliases: ['Shared'] }, competitors: [{ name: 'R', aliases: ['shared'] }] }).some((e) => e.includes('used by more than one app')));
});
await t('R8: a closing paragraph after a list is not credited to the last item', () => {
  const a = analyse('1. Other\n2. Something else\n\nStreaks is my pick.', STREAKS, []);
  assert.equal(a.target.listRank, null);
  const b = analyse('1. Other\n2. Streaks\n   still item two\n3. Third', STREAKS, []);
  assert.equal(b.target.listRank, 2);
});
await t('R9: perplexity citations mark the answer grounded', async () => {
  process.env.PERPLEXITY_API_KEY = 'k';
  const r = await ask('perplexity:sonar', 'q', { fetchImpl: async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ message: { content: 'x' } }], citations: ['https://a'] }) }) });
  assert.equal(r.grounded, true);
  delete process.env.PERPLEXITY_API_KEY;
});
await t('R10: a live lock on the run dir blocks a second writer', async () => {
  const { acquireLock } = await import('../src/run.mjs');
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'aeo-lock-'));
  fs.writeFileSync(path.join(d, '.lock'), String(process.ppid));
  assert.throws(() => acquireLock(d), /in use by process/);
  fs.writeFileSync(path.join(d, '.lock'), '999999');
  const unlock = acquireLock(d);
  assert.equal(fs.readFileSync(path.join(d, '.lock'), 'utf8'), String(process.pid), 'stale lock is taken over');
  unlock();
  assert.equal(fs.existsSync(path.join(d, '.lock')), false);
});
await t('R11: plain (non-bold) list names count as recommended apps; labels do not', () => {
  assert.deepEqual(listedNames('1. Habitica — useful\n2. Loop Habit Tracker — free\n3. Why it matters: x\n4. Best pick - y'), ['Habitica', 'Loop Habit Tracker']);
});
await t('R12: MCP rejects non-2.0 / method-less requests', async () => {
  assert.equal((await handle({ jsonrpc: '1.0', id: 1, method: 'ping' })).error.code, -32600);
  assert.equal((await handle({ id: 1, method: 'ping' })).error.code, -32600);
  assert.equal((await handle({ jsonrpc: '2.0', id: 1, method: 7 })).error.code, -32600);
});

// reliability gate
const { cohenKappa, spearmanBrown, lengthFactor, splitHalfRank, precision, gateVerdict, GATE } = await import('../src/reliability.mjs');
const { parseJudge, judgePrompt, audit: auditRun, sampleRows } = await import('../src/judge.mjs');
await t('kappa / Spearman–Brown / length factor known values', () => {
  assert.equal(cohenKappa([[true, true], [false, false], [true, true], [false, false]]), 1);
  assert.equal(cohenKappa([[true, false], [false, true]]), -1);
  assert.ok(Math.abs(cohenKappa([[true, true], [true, true], [true, false], [false, false], [false, false], [false, true]]) - 1 / 3) < 1e-9);
  assert.ok(Math.abs(spearmanBrown(0.6, 2) - 0.75) < 1e-9);
  assert.ok(Math.abs(lengthFactor(0.5, 0.8) - 4) < 1e-9);
  assert.equal(lengthFactor(0, 0.8), Infinity);
});
const mk = (repeat, prompt, text) => ({ ...okRow('e', prompt, text), repeat });
await t('R1: identical halves → PASS; too few frequently named apps → INDETERMINATE, never PASS', () => {
  const texts = ['Streaks, Habitify, Habitica, Loop', 'Streaks, Habitify, Habitica', 'Streaks, Habitify', 'Streaks'];
  const rows = [1, 2].flatMap((rep) => texts.flatMap((x, i) => [mk(rep, `p${i}`, x), mk(rep, `q${i}`, x), mk(rep, `r${i}`, x)]));
  const ok = splitHalfRank(rows, { ...cfg, competitors: [HABITIFY, { name: 'Habitica' }, { name: 'Loop' }] });
  assert.equal(ok.status, 'PASS');
  assert.equal(ok.reliability, 1);
  const few = splitHalfRank([mk(1, 'p', 'Streaks'), mk(2, 'p', 'Streaks')], cfg);
  assert.equal(few.status, 'INDETERMINATE');
  assert.equal(splitHalfRank([mk(1, 'p', 'Streaks')], cfg).status, 'INDETERMINATE', 'one repeat cannot be split');
});
await t('R1: unrelated halves FAIL and ask for more data', () => {
  const comps = [HABITIFY, { name: 'Habitica' }, { name: 'Loop' }];
  const h1 = ['Streaks Habitify', 'Streaks Habitify', 'Streaks Habitify', 'Streaks Habitify', 'Streaks Habitify', 'Habitica', 'Loop'];
  const h2 = ['Habitica Loop', 'Habitica Loop', 'Habitica Loop', 'Habitica Loop', 'Habitica Loop', 'Streaks', 'Habitify'];
  const rows = [...h1.map((x, i) => mk(1, `p${i}`, x)), ...h2.map((x, i) => mk(2, `p${i}`, x))];
  const r = splitHalfRank(rows, { ...cfg, competitors: comps });
  assert.equal(r.status, 'FAIL');
  assert.ok(r.moreDataFactor > 1);
});
await t('R2: precision PASS on uniform prompts, FAIL with prompts-needed on split prompts', () => {
  const same = Array.from({ length: 10 }, (_, i) => mk(1, `p${i}`, 'Streaks'));
  assert.equal(precision(same, cfg).status, 'PASS');
  const split = Array.from({ length: 10 }, (_, i) => mk(1, `p${i}`, i % 2 ? 'Streaks' : 'none'));
  const f = precision(split, cfg);
  assert.equal(f.status, 'FAIL');
  assert.ok(f.promptsNeeded > 10);
});
await t('gate verdict: all PASS → RELIABLE; any FAIL → NOT RELIABLE; missing audit → INDETERMINATE', () => {
  const P = { status: 'PASS', reliability: 0.9, halfWidth: 0.05 };
  assert.equal(gateVerdict({ rank: P, prec: P, audit: { kappa: 0.9 } }).status, 'RELIABLE');
  assert.equal(gateVerdict({ rank: P, prec: { status: 'FAIL' }, audit: { kappa: 0.9 } }).status, 'NOT RELIABLE');
  assert.equal(gateVerdict({ rank: P, prec: P, audit: null }).status, 'INDETERMINATE');
  assert.equal(gateVerdict({ rank: P, prec: P, audit: { kappa: 0.5 } }).status, 'NOT RELIABLE');
});
await t('judge: prompt lists apps; parser requires a boolean per app per answer', () => {
  const apps = [STREAKS, HABITIFY];
  assert.match(judgePrompt([{ text: 'x' }], apps), /- Habitify \(also written: Habitify - Habit Tracker\)/);
  assert.deepEqual(parseJudge('```json\n{"answers":[{"id":1,"mentioned":{"Streaks":true,"Habitify":false}}]}\n```', 1, apps), [{ Streaks: true, Habitify: false }]);
  assert.throws(() => parseJudge('{"answers":[{"id":1,"mentioned":{"Streaks":true}}]}', 1, apps), /no boolean for "Habitify"/);
  assert.throws(() => parseJudge('no json', 1, apps), /no JSON/);
});
await t('audit: κ from judge vs extractor; disagreements kept; failed batches reported', async () => {
  const rows = Array.from({ length: 10 }, (_, i) => okRow('e', `p${i}`, i < 5 ? 'Streaks and Habitify' : 'Streaks'));
  const truthful = async (spec, prompt) => {
    const ids = [...prompt.matchAll(/<answer id="(\d+)">\n([\s\S]*?)\n<\/answer>/g)];
    return { text: JSON.stringify({ answers: ids.map(([, id, body]) => ({ id: Number(id), mentioned: { Streaks: /Streaks/.test(body), Habitify: /Habitify/.test(body) } })) }) };
  };
  const a = await auditRun(rows, cfg, { askImpl: truthful, n: 10 });
  assert.equal(a.kappa, 1);
  assert.equal(a.disagreements.length, 0);
  const contrarian = async (spec, prompt) => { const r = await truthful(spec, prompt); return { text: r.text.replaceAll('"Habitify":true', '"Habitify":"x"').replaceAll('"Habitify":false', '"Habitify":true').replaceAll('"Habitify":"x"', '"Habitify":false') }; };
  const b = await auditRun(rows, cfg, { askImpl: contrarian, n: 10 });
  assert.ok(b.kappa < 0.8);
  assert.equal(b.disagreements.length, 10);
  const broken = await auditRun(rows, cfg, { askImpl: async () => ({ text: 'nope' }), n: 10 });
  assert.equal(broken.kappa, null);
  assert.equal(broken.failedBatches, 2);
});
await t('adaptive gate: stable engine passes R1 at 2 repeats, audit runs, gate leads the report', async () => {
  const { runAdaptive } = await import('../src/run.mjs');
  const comps = [HABITIFY, { name: 'Habitica' }, { name: 'Loop' }];
  const c = { ...cfg, competitors: comps, providers: ['claude-cli'], prompts: Array.from({ length: 12 }, (_, i) => `q${i}`), repeats: 2 };
  const stable = (q) => ['Streaks Habitify Habitica', 'Streaks Habitify', 'Streaks Loop', 'Streaks'][Number(q.slice(1)) % 4];
  const askImpl = async (provider, prompt, o) => {
    if (prompt.startsWith('You are coding')) {
      const ids = [...prompt.matchAll(/<answer id="(\d+)">\n([\s\S]*?)\n<\/answer>/g)];
      return { text: JSON.stringify({ answers: ids.map(([, id, body]) => ({ id: Number(id), mentioned: Object.fromEntries([cfg.target, ...comps].map((ap) => [ap.name, new RegExp(ap.name).test(body)])) })) }) };
    }
    return { text: stable(prompt), model: 'm', ms: 1 };
  };
  const g = await runAdaptive(c, { outDir: path.join(tmp, 'adapt'), log: () => {}, askImpl, judgeImpl: askImpl, concurrency: 2 });
  assert.equal(g.gates[0].repeats, 2);
  assert.equal(g.gates[0].parts[0].status, 'PASS');
  assert.equal(g.gates[0].parts[2].status, 'PASS', 'audit ran and agreed');
  assert.ok(fs.readFileSync(path.join(g.dir, 'report.md'), 'utf8').startsWith('## Reliability gate'));
  assert.ok(fs.existsSync(path.join(g.dir, 'audit.json')));
});

await t('adaptive gate: an unstable engine gets more repeats (up to maxRepeats) and is reported NOT RELIABLE', async () => {
  const { runAdaptive } = await import('../src/run.mjs');
  const comps = [HABITIFY, { name: 'Habitica' }, { name: 'Loop' }];
  const c = { ...cfg, competitors: comps, providers: ['claude-cli'], prompts: Array.from({ length: 12 }, (_, i) => `q${i}`), repeats: 2 };
  const pool = ['Streaks Habitify Habitica Loop', 'Habitica Loop', 'Streaks', 'Habitify Loop', 'Habitica'];
  const { mulberry32 } = await import('../src/report.mjs');
  const rnd = mulberry32(42);
  const askImpl = async (provider, prompt) => (prompt.startsWith('You are coding') ? { text: '{}' } : { text: pool[Math.floor(rnd() * pool.length)], model: 'm', ms: 1 });
  const g = await runAdaptive(c, { outDir: path.join(tmp, 'adapt2'), log: () => {}, askImpl, judgeImpl: askImpl, concurrency: 1, maxRepeats: 6 });
  assert.ok(g.gates[0].repeats > 2, `repeats grew to ${g.gates[0].repeats}`);
  assert.notEqual(g.gates[0].status, 'RELIABLE');
  assert.equal(g.exitCode, 10);
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
  assert.match(res.result.content[0].text, /\| claude-cli \| memory \|.*\| 100% /);
  assert.equal(res.result.isError, false);
});

// CLI helpers
await t('parseArgv and slug', () => {
  assert.deepEqual(parseArgv(['check', 'c.json', '--max-calls', '5', '--dry-run', '--competitor', 'A', '--competitor=B']), { pos: ['check', 'c.json'], opt: { '--max-calls': '5', '--dry-run': true, '--competitor': ['A', 'B'] } });
  assert.equal(slug('Habitify - Habit Tracker'), 'habitify-habit-tracker');
  assert.throws(() => parseArgv(['--out']), /needs a value/);
});

// diagnose
const CLAUDE_STREAM = [
  { type: 'system', subtype: 'init' },
  { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'WebSearch', input: { query: 'best habit app' } }] } },
  { type: 'user', message: { content: [{ type: 'tool_result', content: 'Web search results for query: "best habit app"\n\nLinks: [{"title":"Best","url":"https://zapier.com/blog/best-habit-tracker-app/"},{"title":"R","url":"https://www.reddit.com/r/productivity/comments/abc/x/"}]' }] } },
  { type: 'result', result: 'Streaks.', is_error: false, modelUsage: { 'claude-x': { webSearchRequests: 1 } } },
].map((e) => JSON.stringify(e)).join('\n');
await t('claude-search keeps the pages its searches returned (stream-json), not an empty list', async () => {
  let argsSeen;
  const run = async (cmd, args) => { argsSeen = args; return { code: 0, stdout: CLAUDE_STREAM, stderr: '' }; };
  const r = await ask('claude-search', 'q', { run });
  assert.equal(argsSeen[argsSeen.indexOf('--output-format') + 1], 'stream-json');
  assert.deepEqual(r.citations, ['https://zapier.com/blog/best-habit-tracker-app/', 'https://www.reddit.com/r/productivity/comments/abc/x/']);
  assert.deepEqual(r.searchQueries, ['best habit app']);
  assert.equal(r.text, 'Streaks.');
  assert.equal(r.grounded, true);
  assert.deepEqual(claudeStream('{"result":"ok"}'), { result: { result: 'ok' }, queries: [], urls: [] }, 'single JSON object still parses');
  await assert.rejects(ask('claude-search', 'q', { run: async () => ({ code: 0, stdout: '{"type":"system"}\n', stderr: '' }) }), (e) => e instanceof ProviderError);
});
await t('sourceKey: one identity per page, assets dropped', () => {
  assert.equal(sourceKey('https://www.techradar.com/best/x/').key, 'techradar.com/best/x');
  assert.equal(sourceKey('https://m.youtube.com/watch?v=abc&t=3').key, 'youtube.com/watch?v=abc');
  assert.equal(sourceKey('https://play.google.com/store/apps/details?id=org.x&hl=en').key, 'play.google.com/store/apps/details?id=org.x');
  assert.equal(sourceKey('https://cdn.mos.cms.futurecdn.net/a-1280-80.jpg'), null);
  assert.equal(sourceKey('https://www.calm.com.').key, 'calm.com');
  assert.equal(sourceKey('not a url'), null);
});
await t('ownerOf: own site, store page and encyclopedia article are owned; generic first words are not', () => {
  const apps = [{ name: 'Monarch Money', appStoreId: '1459319842' }, { name: 'YNAB', aliases: ['You Need a Budget'] }, { name: 'Simple Habit' }];
  const own = (u) => ownerOf(sourceKey(u), apps);
  assert.equal(own('https://www.monarch.com/pricing'), 'Monarch Money');
  assert.equal(own('https://apps.apple.com/us/app/monarch-money/id1459319842'), 'Monarch Money');
  assert.equal(own('https://en.wikipedia.org/wiki/YNAB'), 'YNAB');
  assert.equal(own('https://de.wikipedia.org/wiki/You_Need_a_Budget'), 'YNAB');
  assert.equal(own('https://en.wikipedia.org/wiki/List_of_personal_finance_software'), null);
  assert.equal(own('https://simple.com/blog'), null, '"simple" is a generic word');
  assert.equal(sourceKind(sourceKey('https://en.wikipedia.org/wiki/List_of_personal_finance_software'), apps), 'reference');
  assert.equal(sourceKind(sourceKey('https://www.reddit.com/r/x/comments/1/y'), apps), 'community');
  assert.equal(ownerOf(sourceKey('https://help.example.org/a'), [{ name: 'Ex', sellerUrl: 'https://example.org' }]), 'Ex');
});
await t('matchedLift compares within the same prompt, so a page read only for easy prompts gets no credit', () => {
  const T = { name: 'T', role: 'target' };
  const mk = (prompt, named) => ({ prompt, analysis: { target: named ? { name: 'T' } : null, mentions: [] } });
  // prompt "easy": T always named, page always read; prompt "hard": T never named, page never read.
  const rows = [mk('easy', 1), mk('easy', 1), mk('hard', 0), mk('hard', 0)];
  assert.deepEqual(matchedLift(rows, new Set(rows.slice(0, 2)), T), { lift: null, prompts: 0 }, 'no prompt has both → no claim');
  const rows2 = [mk('p', 1), mk('p', 0), mk('p', 0), mk('q', 1), mk('q', 1)];
  const r = matchedLift(rows2, new Set([rows2[0], rows2[3]]), T);
  assert.equal(r.prompts, 2);
  assert.equal(r.lift, 0.5, 'p: 1 − 0 (w=1) · q: 1 − 1 (w=1)');
});
const DX = { target: { name: 'Streaks' }, competitors: [{ name: 'Habitify' }] };
const drow = (prompt, text, citations, grounded = true, provider = 'codex-search') => ({ ok: true, provider, prompt, repeat: 1, grounded, citations, analysis: analyse(text, DX.target, DX.competitors) });
const DROWS = [
  drow('habit app without subscription', 'Habitify is good.', ['https://listicle.com/a', 'https://habitify.me/pricing']),
  drow('habit app without subscription', 'Habitify.', ['https://listicle.com/a']),
  drow('habit app for iphone', 'Habitify again.', ['https://other.com/b']),
  drow('habit app for iphone', 'Streaks!', ['https://other.com/b']),
  drow('habit app for adhd', 'Habitify.', ['https://unchecked.com/c']),
  drow('habit app for adhd', 'Habitify.', [], false),
];
const DPAGES = new Map([
  ['listicle.com/a', { ok: true, lists: { Streaks: false, Habitify: true } }],
  ['other.com/b', { ok: true, lists: { Streaks: true, Habitify: true } }],
  ['habitify.me/pricing', { ok: true, lists: { Streaks: false, Habitify: true } }],
]);
await t('diagnose classifies every miss: coverage / selection / ungrounded / unknown — never guesses', () => {
  const [e] = diagnose(DROWS, DX, { pages: DPAGES, minAnswers: 1 }).engines;
  assert.equal(e.misses, 5);
  assert.deepEqual(e.causes, { ungrounded: 1, 'no-sources': 0, coverage: 2, 'coverage-partial': 0, selection: 1, unknown: 1 });
  // One checked page of three third-party pages is not enough to call it coverage.
  const partial = [...DROWS, drow('habit app for kids', 'Habitify.', ['https://listicle.com/a', 'https://u1.com/x', 'https://u2.com/y'])];
  assert.deepEqual(diagnose(partial, DX, { pages: DPAGES, minAnswers: 1 }).engines[0].causes, { ungrounded: 1, 'no-sources': 0, coverage: 2, 'coverage-partial': 1, selection: 1, unknown: 1 });
  assert.deepEqual(e.getListed.map((s) => s.key), ['listicle.com/a']);
  assert.equal(e.sources.find((s) => s.key === 'habitify.me/pricing').kind, 'owned');
  assert.ok(!e.getListed.concat(e.fixPresentation, e.working, e.toCheck).some((s) => s.kind === 'owned'), 'own pages are never levers');
  assert.deepEqual(e.toCheck.map((s) => s.key), ['unchecked.com/c']);
  // listing share: per answer over its checked third-party pages (own pages and unchecked pages excluded)
  assert.deepEqual([e.answersWithCheckedPages, e.listingShare], [4, [{ name: 'Streaks', share: 0.5 }, { name: 'Habitify', share: 1 }]]);
});
await t('pagesToCheck: half most-read, then the pages that cover the most still-unclassified misses', () => {
  const d = { engines: [{ minAnswers: 2, sources: [
    { key: 'top.com/1', url: 'https://top.com/1', kind: 'earned', answers: 9 },
    { key: 'top.com/2', url: 'https://top.com/2', kind: 'earned', answers: 8 },
    { key: 'tail.com/a', url: 'https://tail.com/a', kind: 'earned', answers: 1 },
    { key: 'tail.com/b', url: 'https://tail.com/b', kind: 'earned', answers: 1 },
    { key: 'own.com', url: 'https://own.com', kind: 'owned', answers: 9 },
    { key: 'x.com/f.pdf', url: 'https://x.com/f.pdf', kind: 'earned', answers: 9 },
  ], missSources: [['top.com/1'], ['tail.com/a', 'own.com'], ['tail.com/a'], ['tail.com/b']] }] };
  assert.deepEqual(pagesToCheck(d, 2).map((x) => x.key), ['top.com/1', 'tail.com/a'], 'most-read, then the page covering 2 open misses (not top.com/2, which covers none)');
  assert.deepEqual(pagesToCheck(d, 4).map((x) => x.key), ['top.com/1', 'top.com/2', 'tail.com/a', 'tail.com/b']);
});
await t('diagnose without pages says "unknown", and old Claude rows say "no sources recorded"', () => {
  const [e] = diagnose(DROWS, DX, { minAnswers: 1 }).engines;
  assert.deepEqual(e.causes, { ungrounded: 1, 'no-sources': 0, coverage: 0, 'coverage-partial': 0, selection: 0, unknown: 4 });
  const [c] = diagnose([drow('q', 'Habitify', [], true, 'claude-search')], DX).engines;
  assert.equal(c.causes['no-sources'], 1);
});
await t('diagnose questions you lose: word, rates, and whether the listing says it', () => {
  const rows = ['offline', 'offline', 'offline', 'widget', 'widget', 'widget', 'icloud', 'icloud', 'icloud'].map((w, i) => drow(`habit ${w} ${i}`, w === 'offline' ? 'Habitify' : 'Streaks', ['https://x.com/1']));
  const [e] = diagnose(rows, DX, { listing: 'Streaks — widgets, iCloud sync' }).engines;
  const q = e.questions.find((x) => x.word === 'offline');
  assert.deepEqual([q.prompts, q.targetRate, q.otherRate, q.leader.name, q.inListing], [3, 0, 1, 'Habitify', false]);
  assert.equal(e.questions.length, 1, 'words where you do as well or better are not listed');
});
await t('checkPages: reddit via feed, failures are "could not check", 429 stops that host, cache is reused', async () => {
  const seen = [];
  const page = (body, type = 'text/html') => ({ ok: true, status: 200, headers: { get: () => type }, text: async () => body });
  const fetchImpl = async (url) => {
    seen.push(url);
    if (url.includes('reddit.com')) return page(`<feed><entry><content>&lt;p&gt;I use Streaks daily&lt;/p&gt;${'x '.repeat(200)}</content></entry></feed>`, 'application/atom+xml');
    if (url.includes('blocked.com')) return { ok: false, status: 403, headers: { get: () => '' }, text: async () => '' };
    if (url.includes('limited.com')) return { ok: false, status: 429, headers: { get: () => '' }, text: async () => '' };
    return page(`<html><script>Streaks</script><p>Habitify is great. ${'y '.repeat(200)}</p></html>`);
  };
  const list = ['https://www.reddit.com/r/a/comments/1/t/', 'https://blocked.com/x', 'https://limited.com/1', 'https://limited.com/2', 'https://ok.com/p'].map((u) => ({ key: sourceKey(u).key, url: u }));
  const cacheDir = path.join(tmp, 'pages');
  const c = await checkPages(list, DX, { fetchImpl, cacheDir, concurrency: 1, hostGapMs: 0 });
  assert.equal(seen[0], 'https://www.reddit.com/r/a/comments/1/t.rss');
  assert.deepEqual(c.pages.get('reddit.com/r/a/comments/1/t').lists, { Streaks: true, Habitify: false });
  assert.deepEqual(c.pages.get('ok.com/p').lists, { Streaks: false, Habitify: true }, 'script text is not page text');
  assert.deepEqual(c.pages.get('blocked.com/x'), { ok: false, status: 403 });
  assert.equal(seen.filter((u) => u.includes('limited.com')).length, 1, 'second page on a 429 host is not requested');
  assert.deepEqual(c.rateLimitedHosts, ['limited.com']);
  assert.deepEqual([c.fetched, c.failed], [2, 3]);
  // A 429 that says when the window resets is waited out and retried, not written off.
  let calls = 0;
  const hdr = (h) => ({ get: (k) => h[k] ?? null });
  const resetFetch = async () => (calls++ === 0
    ? { ok: false, status: 429, headers: hdr({ 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '0.05' }), text: async () => '' }
    : { ok: true, status: 200, headers: hdr({ 'content-type': 'text/html' }), text: async () => `<p>Streaks ${'z '.repeat(200)}</p>` });
  const w = await checkPages([{ key: 'r.com/1', url: 'https://r.com/1' }], DX, { fetchImpl: resetFetch, hostGapMs: 0 });
  assert.deepEqual([calls, w.pages.get('r.com/1').ok, w.rateLimitedHosts], [2, true, []]);
  // While one host waits out its reset, other hosts proceed (even with a single request slot).
  const order = [];
  let rCalls = 0;
  const mixed = async (url) => {
    order.push(new URL(url).hostname);
    if (url.includes('r.com') && rCalls++ === 0) return { ok: false, status: 429, headers: hdr({ 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '0.05' }), text: async () => '' };
    return { ok: true, status: 200, headers: hdr({ 'content-type': 'text/html' }), text: async () => `<p>Streaks ${'z '.repeat(200)}</p>` };
  };
  await checkPages([{ key: 'r.com/1', url: 'https://r.com/1' }, { key: 's.com/1', url: 'https://s.com/1' }], DX, { fetchImpl: mixed, hostGapMs: 0, concurrency: 1 });
  assert.deepEqual(order, ['r.com', 's.com', 'r.com']);
  seen.length = 0;
  const again = await checkPages(list.filter((x) => !/blocked|limited/.test(x.url)), DX, { fetchImpl, cacheDir, hostGapMs: 0 });
  assert.deepEqual([seen.length, again.cached], [0, 2]);
});
await t('diffRuns: paired by prompt; a real rise is "up", no change has a CI around 0', () => {
  const mkRows = (named) => ['a', 'b', 'c', 'd', 'e', 'f'].flatMap((p) => [1, 2].map((repeat) => drow(p, named(p) ? 'Streaks' : 'Habitify', [])).map((r, i) => ({ ...r, repeat: i + 1 })));
  const before = mkRows(() => false);
  const after = mkRows((p) => p !== 'f');
  const [d] = diffRuns(before, after, DX);
  const s = d.apps.find((a) => a.name === 'Streaks');
  assert.deepEqual([d.prompts, s.before, Number(s.after.toFixed(3)), s.verdict], [6, 0, 0.833, 'up']);
  assert.ok(s.lo > 0);
  const [same] = diffRuns(before, before, DX);
  assert.deepEqual(same.apps.map((a) => a.verdict), ['no detectable change', 'no detectable change']);
  assert.match(renderDiff([d], ['r1', 'r2']), /\*\*Streaks\*\* \| 0% \| 83% \| \+83 pp/);
});
await t('diagnoseRun writes diagnosis.md/json; MCP exposes diagnose and diff', async () => {
  const dir = path.join(tmp, 'diag-run');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(DX));
  fs.writeFileSync(path.join(dir, 'responses.jsonl'), DROWS.map((r, i) => JSON.stringify({ ...r, repeat: i + 1 })).join('\n'));
  const res = await callTool('diagnose_app_aeo_run', { runDir: dir });
  assert.match(res.content[0].text, /Why the 5 misses happened/);
  assert.ok(fs.existsSync(path.join(dir, 'diagnosis.md')) && fs.existsSync(path.join(dir, 'diagnosis.json')));
  const names = TOOLS.map((x) => x.name);
  assert.ok(names.includes('diagnose_app_aeo_run') && names.includes('diff_app_aeo_runs'), names.join(','));
  const diff = await callTool('diff_app_aeo_runs', { runDir: dir, runDir2: dir });
  assert.match(diff.content[0].text, /no detectable change/);
});

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`=== app-aeo selftest: PASS ${pass} / FAIL ${fail} ===`);
process.exitCode = fail ? 1 : 0;
