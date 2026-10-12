// Why an engine does (not) name your app, and what to change — from answers already collected.
//
// A search-grounded answer is built from the pages its searches returned. So a miss has one of three causes:
//   ungrounded — the engine answered from memory (no search): only general brand awareness moves it;
//   coverage   — none of the pages it read lists your app: get onto those pages (or the ones that rank for the query);
//   selection  — a page it read lists your app, yet it picked others: change how those pages present you.
// Which one applies is decided by fetching the pages and looking for each app name (`checkPages`). Without pages a
// miss is "unknown", never guessed.
//
// Two traps this module avoids:
// - Owned pages (your site, your store page) are mostly read *after* the engine decided to name an app, to look up
//   price or features. Their retrieval rate tracks mentions as a consequence, so they are never ranked as levers.
// - A page's mention rate depends on which questions retrieve it. Lift is therefore compared within the same
//   prompts (answers that read the page vs answers to the same prompt that did not).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { GENERIC, findMention } from './extract.mjs';
import { mulberry32 } from './report.mjs';
import { latestRows } from './run.mjs';

const ASSET_RE = /\.(?:jpe?g|png|gif|webp|svg|ico|css|js|mjs|woff2?|ttf|mp4|webm|json)$/i;
const COMMUNITY_HOSTS = ['reddit.com', 'youtube.com', 'youtu.be', 'quora.com', 'x.com', 'twitter.com', 'facebook.com', 'tiktok.com', 'instagram.com', 'threads.net', 'medium.com', 'news.ycombinator.com', 'stackexchange.com', 'producthunt.com', 'blog.naver.com', 'cafe.naver.com', 'kin.naver.com', 'tistory.com', 'brunch.co.kr', 'clien.net', 'dcinside.com', 'theqoo.net', 'ppomppu.co.kr'];
const REFERENCE_HOSTS = ['wikipedia.org', 'namu.wiki'];
const STORE_HOSTS = ['apps.apple.com', 'itunes.apple.com', 'play.google.com'];
const onHost = (host, list) => list.some((d) => host === d || host.endsWith(`.${d}`));
export const LEVER_KINDS = Object.freeze(['earned', 'community', 'reference']);
/** A miss is "coverage" only when at least this share of its third-party pages was checked and none lists you. */
export const COVERAGE_MIN_CHECKED = 0.5;

/** Canonical page identity: host without www/m, path without trailing slash, plus the one query parameter that names
 *  the page on YouTube (v) and Google Play (id). Assets (images, scripts) are not pages → null. */
export function sourceKey(url) {
  let u;
  try { u = new URL(String(url).trim()); } catch { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  const host = u.hostname.toLowerCase().replace(/\.+$/, '').replace(/^(?:www|m|mobile)\./, '');
  if (!host.includes('.')) return null;
  let p = u.pathname.replace(/\/+$/, '').replace(/[.,;:]+$/, '');
  if (ASSET_RE.test(p)) return null;
  const keep = host === 'youtube.com' ? 'v' : host === 'play.google.com' ? 'id' : null;
  if (keep && u.searchParams.get(keep)) p += `?${keep}=${u.searchParams.get(keep)}`;
  return { key: host + p, host, url: `https://${u.hostname.replace(/\.+$/, '')}${p}` };
}

const brandToken = (name) => String(name ?? '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Which configured app owns this page (its site, a configured domain, or its store listing), or null. */
export function ownerOf(src, apps) {
  const labels = src.host.split('.');
  for (const a of apps) {
    const domains = [...(a.domains ?? []), ...(a.sellerUrl ? [sourceKey(a.sellerUrl)?.host].filter(Boolean) : [])];
    if (domains.some((d) => src.host === d || src.host.endsWith(`.${d}`))) return a.name;
    if (a.appStoreId && onHost(src.host, STORE_HOSTS) && new RegExp(`(?:/id|/)${a.appStoreId}(?:$|[/?])`).test(src.key)) return a.name;
    if (a.playId && src.key.endsWith(`?id=${a.playId}`)) return a.name;
    const tok = brandToken(a.name);
    if (tok.length >= 4 && labels.slice(0, -1).some((l) => l === tok || l === `${tok}app` || l === `get${tok}` || l === `try${tok}` || (tok.length >= 7 && l.includes(tok)))) return a.name;
    // "Monarch Money" lives at monarch.com: the first word alone, when it is long and not a generic word.
    const first = brandToken(String(a.name).split(/\s+/)[0]);
    if (first !== tok && first.length >= 5 && !GENERIC.has(first) && labels.at(-2) === first) return a.name;
    // An encyclopedia article about the app (en.wikipedia.org/wiki/YNAB, /wiki/You_Need_a_Budget, /wiki/Calm_(company)).
    if (onHost(src.host, REFERENCE_HOSTS)) {
      const title = brandToken(decodeURIComponent(src.key.split('/').pop() ?? '').replace(/_\(.*\)$|%28.*$/, ''));
      if (title && [a.name, ...(a.aliases ?? [])].some((n) => brandToken(n) === title)) return a.name;
    }
  }
  return null;
}

export function sourceKind(src, apps) {
  if (ownerOf(src, apps)) return 'owned';
  if (onHost(src.host, STORE_HOSTS)) return 'store';
  if (onHost(src.host, COMMUNITY_HOSTS)) return 'community';
  if (onHost(src.host, REFERENCE_HOSTS)) return 'reference';
  return 'earned';
}

const appsOf = (cfg) => [{ ...cfg.target, role: 'target' }, ...(cfg.competitors ?? []).map((c) => ({ ...c, role: 'competitor' }))];
const names = (r, a) => (a.role === 'target' ? !!r.analysis?.target : (r.analysis?.mentions ?? []).some((m) => m.name === a.name));
const rate = (rows, a) => (rows.length ? rows.filter((r) => names(r, a)).length / rows.length : null);

/** Mean within-prompt difference of a's mention rate between answers that read the page and answers to the same
 *  prompt that did not, weighted by min(n_in, n_out). null when no prompt has both. */
export function matchedLift(rows, inSet, a) {
  const by = new Map();
  for (const r of rows) {
    const g = by.get(r.prompt) ?? { in: [], out: [] };
    (inSet.has(r) ? g.in : g.out).push(r);
    by.set(r.prompt, g);
  }
  let num = 0, den = 0, prompts = 0;
  for (const g of by.values()) {
    if (!g.in.length || !g.out.length) continue;
    const w = Math.min(g.in.length, g.out.length);
    num += w * (rate(g.in, a) - rate(g.out, a));
    den += w;
    prompts += 1;
  }
  return den ? { lift: num / den, prompts } : { lift: null, prompts: 0 };
}

const STOP = new Set('a an the and or of for to in on with without no not my your me i is are best top good free app apps application applications which what whats how do does that this than vs versus 2024 2025 2026 2027 recommend recommendation recommendations any some can should most better reddit list 추천 좋은 앱 어플 어플리케이션 무료 최고 순위 뭐 어떤 있나요 비교'.split(' '));
const words = (s) => [...new Set(String(s).normalize('NFC').toLowerCase().split(/[\s\p{P}\p{S}]+/u).filter((w) => w && !STOP.has(w) && !/^\d+$/.test(w)))];

/**
 * @param rows   responses.jsonl rows (latest per job)
 * @param cfg    run config (target, competitors[, category])
 * @param opts.pages     Map sourceKey → {ok, lists:{[appName]:boolean}} from checkPages (optional)
 * @param opts.listing   text of your store listing / site (optional) — marks question words it never mentions
 */
export function diagnose(rows, cfg, { pages = new Map(), listing = null, engine = null, minAnswers: minAnswersOpt = null, minPrompts = 3 } = {}) {
  const apps = appsOf(cfg);
  const target = apps[0];
  const competitors = apps.slice(1);
  const ok = rows.filter((r) => r.ok && (!engine || r.provider === engine));
  const category = new Set(words(cfg.category ?? ''));
  const listingText = listing == null ? null : String(listing).normalize('NFC').toLowerCase();
  const engines = [];
  for (const provider of [...new Set(ok.map((r) => r.provider))]) {
    const R = ok.filter((r) => r.provider === provider);
    // A page counts as a lever when ≥ 5 answers read it (≥ 5% of answers in small runs, at least 1).
    const minAnswers = minAnswersOpt ?? Math.min(5, Math.max(1, Math.round(R.length / 20)));
    // sources
    const src = new Map();
    const perRow = new Map();
    for (const r of R) {
      const keys = new Set();
      for (const u of r.citations ?? []) {
        const s = sourceKey(u);
        if (!s || keys.has(s.key)) continue;
        keys.add(s.key);
        const e = src.get(s.key) ?? { ...s, kind: sourceKind(s, apps), owner: ownerOf(s, apps), rows: new Set() };
        e.rows.add(r);
        src.set(s.key, e);
      }
      perRow.set(r, [...keys]);
    }
    const sources = [...src.values()].map((e) => {
      const rr = [...e.rows];
      const page = pages.get(e.key) ?? null;
      const comp = competitors.map((c) => ({ name: c.name, rate: rate(rr, c) }));
      const best = comp.reduce((m, c) => (c.rate > (m?.rate ?? -1) ? c : m), null);
      return {
        key: e.key, url: e.url, host: e.host, kind: e.kind, owner: e.owner, answers: rr.length,
        targetRate: rate(rr, target), ...matchedLift(R, e.rows, target),
        competitors: comp, bestCompetitor: best,
        page: page ? { ok: !!page.ok, status: page.status ?? null, lists: page.ok ? page.lists : null } : null,
      };
    }).sort((a, b) => b.answers - a.answers || a.key.localeCompare(b.key));

    // misses → cause
    const listsTarget = (k) => pages.get(k)?.ok ? !!pages.get(k).lists?.[target.name] : null;
    const causes = { ungrounded: 0, 'no-sources': 0, coverage: 0, 'coverage-partial': 0, selection: 0, unknown: 0 };
    const misses = R.filter((r) => !names(r, target));
    // One page that lists you proves selection. Coverage needs the absence on most pages: an unchecked page may list
    // you. In the meditation benchmark, Codex answers read ~30 third-party pages each and 40 fetched pages covered
    // ~5% of them, so "none of the checked pages" alone would overstate coverage.
    for (const r of misses) {
      if (!r.grounded) { causes.ungrounded += 1; continue; }
      const keys = perRow.get(r) ?? [];
      if (!keys.length) { causes['no-sources'] += 1; continue; }
      const checked = keys.map(listsTarget).filter((x) => x !== null);
      if (!checked.length) causes.unknown += 1;
      else if (checked.some(Boolean)) causes.selection += 1;
      else {
        const third = keys.filter((k) => LEVER_KINDS.includes(src.get(k).kind));
        const share = third.length ? third.filter((k) => listsTarget(k) !== null).length / third.length : 1;
        causes[share >= COVERAGE_MIN_CHECKED ? 'coverage' : 'coverage-partial'] += 1;
      }
    }
    const answersWithSources = R.filter((r) => (perRow.get(r) ?? []).length).length;

    // levers
    const levers = sources.filter((s) => LEVER_KINDS.includes(s.kind) && s.answers >= minAnswers);
    const getListed = levers.filter((s) => s.page?.ok && !s.page.lists[target.name] && competitors.some((c) => s.page.lists[c.name]));
    // Listed, and reading the page raises your rate within the same prompts by ≥ 5 pp: it works — find more like it.
    const working = levers.filter((s) => s.page?.ok && s.page.lists[target.name] && s.lift != null && s.lift >= 0.05);
    const fixPresentation = levers.filter((s) => s.page?.ok && s.page.lists[target.name] && s.targetRate < 0.5 && !working.includes(s));
    const toCheck = levers.filter((s) => !s.page?.ok && s.bestCompetitor && s.targetRate <= s.bestCompetitor.rate - 0.2);

    // questions you lose
    const promptWords = new Map();
    for (const p of new Set(R.map((r) => r.prompt))) for (const w of words(p)) if (!category.has(w)) promptWords.set(w, [...(promptWords.get(w) ?? []), p]);
    const nPrompts = new Set(R.map((r) => r.prompt)).size;
    // A word in ≥ 40% of prompts is the category itself ("budgeting"), not a question type.
    for (const [w, ps] of promptWords) if (ps.length >= 0.4 * nPrompts) promptWords.delete(w);
    const questions = [...promptWords].filter(([, ps]) => ps.length >= minPrompts && nPrompts - ps.length >= minPrompts).map(([word, ps]) => {
      const set = new Set(ps);
      const inR = R.filter((r) => set.has(r.prompt));
      const outR = R.filter((r) => !set.has(r.prompt));
      const comp = competitors.map((c) => ({ name: c.name, rate: rate(inR, c) })).sort((a, b) => b.rate - a.rate);
      return { word, prompts: ps.length, answers: inR.length, targetRate: rate(inR, target), otherRate: rate(outR, target), leader: comp[0] ?? null, inListing: listingText == null ? null : listingText.includes(word), examples: ps.slice(0, 3) };
    }).filter((q) => q.targetRate <= q.otherRate - 0.1).sort((a, b) => (a.targetRate - a.otherRate) - (b.targetRate - b.otherRate) || b.answers - a.answers);

    const owned = apps.map((a) => {
      const inSet = new Set(R.filter((r) => (perRow.get(r) ?? []).some((k) => src.get(k).owner === a.name)));
      return { name: a.name, role: a.role, readOwnPage: inSet.size, rateWhenRead: rate([...inSet], a), rateOtherwise: rate(R.filter((r) => !inSet.has(r)), a) };
    });

    engines.push({
      provider, minAnswers, answers: R.length, grounded: R.filter((r) => r.grounded).length, answersWithSources,
      targetRate: rate(R, target), competitorRates: competitors.map((c) => ({ name: c.name, rate: rate(R, c) })),
      misses: misses.length, causes, pagesChecked: sources.filter((s) => s.page?.ok).length, pagesFailed: sources.filter((s) => s.page && !s.page.ok).length,
      sources, getListed, working, fixPresentation, toCheck, questions, owned,
      // per grounded miss: the pages it read (for choosing which pages to fetch)
      missSources: misses.filter((r) => r.grounded).map((r) => perRow.get(r) ?? []),
    });
  }
  return { target: target.name, competitors: competitors.map((c) => c.name), engines };
}

/** PDFs cannot be read without a parser dependency; they stay in "not yet checked", marked for a manual look. */
export const isPdf = (s) => /\.pdf$/i.test(s.key);

/**
 * Pages worth fetching, across engines. The first half of the budget goes to the most-read lever pages (the action
 * tables need them). The rest goes greedily to the pages that cover the most misses not yet covered, so that fewer
 * misses stay "unknown": in the meditation benchmark, the 40 most-read pages left 53% of misses unclassified.
 */
export function pagesToCheck(d, limit = 40) {
  const url = new Map();
  const read = new Map();
  for (const e of d.engines) for (const s of e.sources) {
    if (!LEVER_KINDS.includes(s.kind) || isPdf(s)) continue;
    url.set(s.key, s.url);
    if (s.answers >= e.minAnswers) read.set(s.key, Math.max(read.get(s.key) ?? 0, s.answers));
  }
  const chosen = [...read].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, Math.ceil(limit / 2)).map(([k]) => k);
  const taken = new Set(chosen);
  let open = d.engines.flatMap((e) => e.missSources ?? []).map((keys) => keys.filter((k) => url.has(k))).filter((keys) => keys.length && !keys.some((k) => taken.has(k)));
  while (chosen.length < limit && open.length) {
    const count = new Map();
    for (const keys of open) for (const k of keys) count.set(k, (count.get(k) ?? 0) + 1);
    const [k] = [...count].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    chosen.push(k);
    taken.add(k);
    open = open.filter((keys) => !keys.includes(k));
  }
  for (const [k] of [...read].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) { if (chosen.length >= limit) break; if (!taken.has(k)) { chosen.push(k); taken.add(k); } }
  return chosen.map((key) => ({ key, url: url.get(key) }));
}

export function htmlToText(html) {
  return String(html)
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&apos;|&rsquo;|&#8217;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ');
}

/** Reddit answers bots 403 on the page and its .json; the thread's Atom feed (post + comments) is served. Measured
 *  2026-10-12: www 403 · api 403 · old.reddit 200 but a shell without the thread · .rss 200 with the thread. */
export const fetchUrl = (url) => (/^https:\/\/(?:[a-z]+\.)?reddit\.com\/r\/[^/]+\/comments\//.test(url) ? `${url.replace(/\/+$/, '')}.rss` : url);

export const PAGE_TIMEOUT_MS = 20_000;
export const HOST_GAP_MS = 4000;
export const PAGE_UA = 'Mozilla/5.0 (compatible; app-aeo; +https://github.com/BonhaengLee/app-aeo)';

/**
 * Fetch each page once (cached in cacheDir) and record which configured apps it names.
 * A failed fetch is {ok:false, status} — "could not check", never "does not list you". On 429 the host's
 * x-ratelimit-reset is waited out (≤ maxWaitMs, 2 retries); without it the host is not asked again in this call.
 * @returns {Promise<{pages: Map, fetched: number, cached: number, failed: number, rateLimitedHosts: string[]}>}
 */
export async function checkPages(list, cfg, { cacheDir = null, fetchImpl = fetch, concurrency = 4, timeoutMs = PAGE_TIMEOUT_MS, hostGapMs = HOST_GAP_MS, maxWaitMs = 120_000, log = () => {} } = {}) {
  const apps = appsOf(cfg);
  const pages = new Map();
  const limited = new Set();
  let fetched = 0, cached = 0, failed = 0;
  if (cacheDir) fs.mkdirSync(cacheDir, { recursive: true });
  const cacheFile = (key) => cacheDir && path.join(cacheDir, `${crypto.createHash('sha1').update(key).digest('hex')}.txt`);
  const score = (key, text) => ({ ok: true, status: 200, lists: Object.fromEntries(apps.map((a) => [a.name, !!findMention(text, a)])) });
  // Per host: one request at a time, spaced by hostGapMs or the host's announced reset. Across hosts: at most
  // `concurrency` requests in flight. (A shared worker pool let workers parked on Reddit's minute-long reset block
  // every other site, and workers that started waiting before a reset was announced woke too early and got 429.)
  const nextAt = new Map();
  const sleep = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms)));
  let active = 0;
  const waiting = [];
  const acquire = () => (active < Math.max(1, concurrency) ? (active += 1, Promise.resolve()) : new Promise((r) => waiting.push(r)));
  const release = () => { const next = waiting.shift(); if (next) next(); else active -= 1; };
  async function request(host, url) {
    for (let attempt = 0; ; attempt += 1) {
      if (limited.has(host)) return null;
      await sleep((nextAt.get(host) ?? 0) - Date.now());
      await acquire();
      let res, body = '';
      try {
        res = await fetchImpl(fetchUrl(url), { headers: { 'user-agent': PAGE_UA, accept: 'text/html,application/xml;q=0.9,*/*;q=0.5' }, redirect: 'follow', signal: AbortSignal.timeout(timeoutMs) });
        if (res.ok) body = (await res.text()).slice(0, 3_000_000);
        else await res.body?.cancel?.().catch(() => {}); // free the connection; the body of an error is not used
      } finally { release(); }
      nextAt.set(host, Date.now() + hostGapMs);
      // Reddit's feed allows ~1 request a minute and says when the window resets (measured 2026-10-12:
      // x-ratelimit-remaining 0, x-ratelimit-reset 36 → 429 until then). Wait for it instead of giving up.
      const reset = Number(res.headers?.get?.('x-ratelimit-reset'));
      const remaining = res.headers?.get?.('x-ratelimit-remaining');
      const resetMs = Number.isFinite(reset) && reset > 0 ? (reset + 1) * 1000 : null;
      if (resetMs != null && remaining != null && Number(remaining) < 1) nextAt.set(host, Math.max(nextAt.get(host), Date.now() + resetMs));
      if (res.status !== 429) return { res, body };
      if (resetMs == null || resetMs > maxWaitMs || attempt >= 2) { limited.add(host); return null; }
      log(`page 429 ${host}: waiting ${Math.round(resetMs / 1000)}s`);
    }
  }
  async function checkOne({ key, url }, host) {
    const f = cacheFile(key);
    if (f && fs.existsSync(f)) { pages.set(key, score(key, fs.readFileSync(f, 'utf8'))); cached += 1; return; }
    try {
      const got = await request(host, url);
      if (!got) { pages.set(key, { ok: false, status: 429 }); failed += 1; return; }
      const { res, body } = got;
      if (!res.ok) { pages.set(key, { ok: false, status: res.status }); failed += 1; log(`page ${res.status} ${url}`); return; }
      const type = res.headers?.get?.('content-type') ?? '';
      // Feeds carry escaped HTML, so a second pass strips the decoded tags.
      const text = /xml/.test(type) ? htmlToText(htmlToText(body)) : /html/.test(type) || !type ? htmlToText(body) : /text\//.test(type) ? body : null;
      if (text == null || text.trim().length < 200) { pages.set(key, { ok: false, status: text == null ? `type ${type}` : 'empty' }); failed += 1; return; }
      if (f) fs.writeFileSync(f, text);
      pages.set(key, score(key, text));
      fetched += 1;
    } catch (e) {
      pages.set(key, { ok: false, status: e.name === 'TimeoutError' ? 'timeout' : 'error' });
      failed += 1;
      log(`page error ${url}: ${e.message}`);
    }
  }
  const byHost = new Map();
  for (const item of list) { const host = sourceKey(item.url)?.host ?? item.url; byHost.set(host, [...(byHost.get(host) ?? []), item]); }
  await Promise.all([...byHost].map(async ([host, items]) => { for (const item of items) await checkOne(item, host); }));
  return { pages, fetched, cached, failed, rateLimitedHosts: [...limited] };
}

/** What getting onto a page means, by kind. Stays inside each site's rules — paid or fake reviews and undisclosed
 *  self-promotion get removed and can get an app delisted. */
export const HOW = Object.freeze({
  earned: 'pitch the editor: what you do better, for whom, price; offer a review build',
  community: 'answer real threads as the developer, disclosed; ask users to share honestly',
  reference: 'do not edit about yourself (conflict of interest); earn independent coverage first',
});

const pct = (x) => (x == null ? '—' : `${(x * 100).toFixed(0)}%`);
const signed = (x) => (x == null ? '—' : `${x >= 0 ? '+' : ''}${(x * 100).toFixed(0)} pp`);
const listed = (s, apps) => apps.filter((n) => s.page?.lists?.[n]).join(', ') || '—';

export function renderDiagnosis(d, { top = 10 } = {}) {
  const L = [`# Why engines do (not) name ${d.target}`, ''];
  for (const e of d.engines) {
    const m = e.misses || 1;
    L.push(`## ${e.provider}`, '');
    L.push(`${d.target} is named in ${pct(e.targetRate)} of ${e.answers} answers (${e.competitorRates.map((c) => `${c.name} ${pct(c.rate)}`).join(' · ') || 'no competitors configured'}).`);
    L.push(`${e.grounded}/${e.answers} answers searched; ${e.answersWithSources} kept their sources. Pages checked: ${e.pagesChecked}${e.pagesFailed ? ` (${e.pagesFailed} could not be fetched)` : ''}.${e.pagesChecked ? ' Pages are checked as they are now; the answers saw them at run time.' : ''}`, '');
    L.push(`### Why the ${e.misses} misses happened`, '', '| Cause | Answers | Share | What moves it |', '|---|---:|---:|---|');
    const rowsC = [
      [`coverage — none of its third-party pages lists you (≥ ${pct(COVERAGE_MIN_CHECKED)} checked)`, e.causes.coverage, 'get onto the pages engines read for these questions (table below)'],
      [`coverage? — none of the checked pages lists you, but < ${pct(COVERAGE_MIN_CHECKED)} were checked`, e.causes['coverage-partial'], 'likely coverage; a larger `--fetch` decides'],
      ['selection — a page lists you, it picked others', e.causes.selection, 'change how those pages describe you; answer the question words you lose'],
      ['ungrounded — answered from memory', e.causes.ungrounded, 'only broad awareness (reference pages, press) — slow'],
      ['no sources recorded', e.causes['no-sources'], 're-run with this version (older runs did not keep Claude sources)'],
      ['unknown — pages not checked', e.causes.unknown, 'run `diagnose --fetch N` to classify'],
    ];
    for (const [c, n, w] of rowsC) if (n) L.push(`| ${c} | ${n} | ${pct(n / m)} | ${w} |`);
    if (!e.misses) L.splice(L.length - 4, 4, `### No misses — ${d.target} was named in every answer`);
    L.push('');
    let n = 0;
    const section = (title, list, head, row) => {
      if (!list.length) return;
      n += 1;
      L.push(`### ${n}. ${title}`, '', head[0], head[1]);
      for (const s of list.slice(0, top)) L.push(row(s));
      L.push('');
    };
    section('Get listed — pages engines read that name your competitors but not you', e.getListed, ['| Page | Kind | Read in | You named there | Lists | How |', '|---|---|---:|---:|---|---|'],
      (s) => `| ${s.url} | ${s.kind} | ${s.answers} | ${pct(s.targetRate)} | ${listed(s, d.competitors)} | ${HOW[s.kind]} |`);
    section('Fix presentation — pages that list you, yet answers that read them mostly skip you', e.fixPresentation, ['| Page | Read in | You named there | Same-prompt lift |', '|---|---:|---:|---:|'],
      (s) => `| ${s.url} | ${s.answers} | ${pct(s.targetRate)} | ${signed(s.lift)} |`);
    section('Working — pages that list you and raise your rate within the same prompts (find more like these)', e.working, ['| Page | Read in | You named there | Same-prompt lift |', '|---|---:|---:|---:|'],
      (s) => `| ${s.url} | ${s.answers} | ${pct(s.targetRate)} | ${signed(s.lift)} |`);
    section('Not yet checked — often-read pages where competitors beat you', e.toCheck, ['| Page | Status | Read in | You | Best competitor |', '|---|---|---:|---:|---|'],
      (s) => `| ${s.url} | ${isPdf(s) ? 'PDF — check by hand' : s.page ? `could not fetch (${s.page.status})` : s.kind} | ${s.answers} | ${pct(s.targetRate)} | ${s.bestCompetitor.name} ${pct(s.bestCompetitor.rate)} |`);
    if (e.questions.length) {
      L.push('### Questions you lose', '', 'Words in the prompt that go with a lower rate for you. If your listing or site never says it, engines have nothing to match.', '', '| Word | Prompts | You (with word) | You (without) | Leader there | In your listing |', '|---|---:|---:|---:|---|---|');
      for (const q of e.questions.slice(0, top)) L.push(`| ${q.word} | ${q.prompts} | ${pct(q.targetRate)} | ${pct(q.otherRate)} | ${q.leader ? `${q.leader.name} ${pct(q.leader.rate)}` : '—'} | ${q.inListing == null ? '—' : q.inListing ? 'yes' : '**no**'} |`);
      L.push('');
    }
    L.push('### Own pages — read after deciding, so not a lever', '', '| App | Answers that read its own page | Named then | Named otherwise |', '|---|---:|---:|---:|');
    for (const o of e.owned) L.push(`| ${o.name} | ${o.readOwnPage} | ${pct(o.rateWhenRead)} | ${pct(o.rateOtherwise)} |`);
    L.push('');
  }
  L.push('## Then verify', '', 'Change one thing, wait until the pages you changed are re-indexed, re-run the **same config**, and compare:', '', '```sh', 'app-aeo diff <run-before> <run-after>', '```', '', 'Only a change whose interval excludes 0 counts as an effect. Engines drift on their own, so a run of an untouched app (or untouched prompts) over the same period is the control.');
  return L.join('\n');
}

/** Every string in a listing file (the `lint` format: one locale object or an array), joined. */
export const listingText = (data) => {
  const out = [];
  (function walk(x) { if (typeof x === 'string') out.push(x); else if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === 'object') Object.values(x).forEach(walk); })(data);
  return out.join('\n');
};

/**
 * Diagnose a run directory: optionally fetch the top `fetch` lever pages (cached in <run>/pages/), then classify.
 * Writes <run>/diagnosis.md and diagnosis.json.
 */
export async function diagnoseRun(dir, { fetch: nFetch = 0, engine = null, listing = null, log = () => {}, fetchImpl, rows: rowsIn, cfg: cfgIn } = {}) {
  const cfg = cfgIn ?? JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8'));
  const rows = rowsIn ?? latestRows(path.join(dir, 'responses.jsonl'));
  let pages = new Map();
  let fetchStats = null;
  if (nFetch > 0) {
    const list = pagesToCheck(diagnose(rows, cfg, { engine }), nFetch);
    log(`checking ${list.length} pages (cached in ${path.join(dir, 'pages')})`);
    const c = await checkPages(list, cfg, { cacheDir: path.join(dir, 'pages'), log, ...(fetchImpl ? { fetchImpl } : {}) });
    pages = c.pages;
    fetchStats = { requested: list.length, fetched: c.fetched, cached: c.cached, failed: c.failed, rateLimitedHosts: c.rateLimitedHosts };
  }
  const d = { ...diagnose(rows, cfg, { pages, listing, engine }), fetch: fetchStats };
  const markdown = renderDiagnosis(d);
  fs.writeFileSync(path.join(dir, 'diagnosis.md'), `${markdown}\n`);
  fs.writeFileSync(path.join(dir, 'diagnosis.json'), JSON.stringify(d, null, 2));
  return { d, markdown };
}

/** Paired comparison of two runs of the same prompts: Δ mention rate per engine with a prompt-bootstrap 95% interval. */
export function diffRuns(rowsA, rowsB, cfg, { B = 2000, seed = 5, engine = null } = {}) {
  const apps = appsOf(cfg);
  const out = [];
  const ok = (rows) => rows.filter((r) => r.ok && (!engine || r.provider === engine));
  const [A, Bs] = [ok(rowsA), ok(rowsB)];
  for (const provider of [...new Set(A.map((r) => r.provider))].filter((p) => Bs.some((r) => r.provider === p))) {
    const a = A.filter((r) => r.provider === provider);
    const b = Bs.filter((r) => r.provider === provider);
    const prompts = [...new Set(a.map((r) => r.prompt))].filter((p) => b.some((r) => r.prompt === p));
    if (!prompts.length) continue;
    const per = (rows, p, app) => rate(rows.filter((r) => r.prompt === p), app);
    const apps_ = apps.map((app) => {
      const deltas = prompts.map((p) => per(b, p, app) - per(a, p, app));
      const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
      const rnd = mulberry32(seed);
      const boot = Array.from({ length: B }, () => mean(Array.from({ length: deltas.length }, () => deltas[Math.floor(rnd() * deltas.length)]))).sort((x, y) => x - y);
      const lo = boot[Math.floor(0.025 * B)], hi = boot[Math.ceil(0.975 * B) - 1];
      return { name: app.name, role: app.role, before: mean(prompts.map((p) => per(a, p, app))), after: mean(prompts.map((p) => per(b, p, app))), delta: mean(deltas), lo, hi, verdict: lo > 0 ? 'up' : hi < 0 ? 'down' : 'no detectable change' };
    });
    out.push({ provider, prompts: prompts.length, apps: apps_ });
  }
  return out;
}

export function renderDiff(diffs, runs = []) {
  const L = ['# Before / after', '', runs.length ? `${runs[0]} → ${runs[1]}` : '', ''];
  if (!diffs.length) return [...L, 'No engine and prompt in common.'].join('\n');
  for (const d of diffs) {
    L.push(`## ${d.provider} (${d.prompts} prompts in both)`, '', '| App | Before | After | Δ | 95% CI | Verdict |', '|---|---:|---:|---:|---|---|');
    for (const a of d.apps) L.push(`| ${a.role === 'target' ? `**${a.name}**` : a.name} | ${pct(a.before)} | ${pct(a.after)} | ${signed(a.delta)} | ${signed(a.lo)} … ${signed(a.hi)} | ${a.verdict} |`);
    L.push('');
  }
  L.push('If competitors moved the same way, the engine changed, not your standing.');
  return L.join('\n');
}
