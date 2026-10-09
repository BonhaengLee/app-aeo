// App Store metadata (public iTunes Search/Lookup API, no key) and prompt-set suggestions.
// iTunes throttles hard (~20 calls/min). We space calls and stop on 403/429 instead of returning empty results.

export const ITUNES_GAP_MS = Number(process.env.APP_AEO_ITUNES_GAP_MS ?? 3500);
export class RateLimitedError extends Error { constructor(url) { super(`rate-limited: ${url}`); this.name = 'RateLimitedError'; } }

let lastCall = 0;
async function itunes(url, { fetchImpl = fetch, gapMs = ITUNES_GAP_MS } = {}) {
  const wait = lastCall + gapMs - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  const res = await fetchImpl(url, { headers: { 'user-agent': 'app-aeo' } });
  if (res.status === 403 || res.status === 429) throw new RateLimitedError(url);
  if (!res.ok) throw new Error(`${url} HTTP ${res.status}`);
  const text = await res.text();
  return JSON.parse(text.replace(/^﻿/, ''));
}

const pick = (r) => ({
  appStoreId: String(r.trackId),
  name: r.trackName,
  seller: r.sellerName,
  genre: r.primaryGenreName,
  price: r.formattedPrice ?? r.price,
  rating: r.averageUserRating ?? null,
  ratingCount: r.userRatingCount ?? null,
  url: r.trackViewUrl,
  bundleId: r.bundleId,
  released: r.releaseDate,
  description: r.description,
});

/** Look up apps by App Store id. Missing ids are returned as null entries (not dropped). */
export async function lookup(ids, { country = 'us', ...deps } = {}) {
  const list = [...new Set(ids.map(String))];
  if (!list.length) return [];
  const j = await itunes(`https://itunes.apple.com/lookup?country=${encodeURIComponent(country)}&id=${list.join(',')}`, deps);
  const byId = new Map((j.results ?? []).filter((r) => r.trackId).map((r) => [String(r.trackId), pick(r)]));
  return list.map((id) => byId.get(id) ?? null);
}

export async function search(term, { country = 'us', limit = 10, ...deps } = {}) {
  const j = await itunes(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=software&country=${encodeURIComponent(country)}&limit=${limit}`, deps);
  return (j.results ?? []).map(pick);
}

/** Fill name/aliases of apps that only have an appStoreId. Returns new objects; never invents a name. */
export async function hydrate(apps, deps = {}) {
  const need = apps.filter((a) => a.appStoreId && !a.name).map((a) => a.appStoreId);
  if (!need.length) return apps;
  const found = await lookup(need, deps);
  const byId = new Map(found.filter(Boolean).map((f) => [f.appStoreId, f]));
  return apps.map((a) => {
    if (a.name || !a.appStoreId) return a;
    const f = byId.get(String(a.appStoreId));
    if (!f) throw new Error(`App Store id ${a.appStoreId} not found in country ${deps.country ?? 'us'} — set "name" explicitly`);
    return { ...a, name: f.name };
  });
}

const EN = [
  'What is the best {cat} app for iPhone?',
  'What is the best {cat} app for Android?',
  'Recommend a free {cat} app.',
  'Which {cat} app do you recommend for a beginner?',
  'I need a simple {cat} app without ads. What should I install?',
  'What are the top 5 {cat} apps in {year}?',
  'Is there a {cat} app that works offline?',
  'Which {cat} app has the best widgets?',
  'Compare the most popular {cat} apps.',
  'What app should I use for {cat}?',
];
const ALT_EN = ['What are good alternatives to {comp}?', 'Is there something better than {comp}?'];
const KO = [
  '아이폰에서 제일 좋은 {cat} 앱이 뭐야?',
  '안드로이드 {cat} 앱 추천해줘.',
  '무료 {cat} 앱 추천해줘.',
  '처음 쓰기 좋은 {cat} 앱은?',
  '광고 없는 간단한 {cat} 앱 있어?',
  '{year}년 {cat} 앱 순위 알려줘.',
  '오프라인에서도 되는 {cat} 앱 있어?',
  '위젯 좋은 {cat} 앱 추천해줘.',
  '인기 있는 {cat} 앱들 비교해줘.',
  '{cat} 하려면 무슨 앱 써야 돼?',
];
const ALT_KO = ['{comp} 대신 쓸 만한 앱 있어?', '{comp}보다 나은 앱 있어?'];

/** Deterministic prompt set: 10 category prompts + 2 per competitor (no LLM call). */
export function suggestPrompts({ category, competitors = [], locale = 'en', year = new Date().getFullYear() }) {
  if (!category) throw new Error('category is required, e.g. "habit tracker"');
  const [base, alt] = locale.startsWith('ko') ? [KO, ALT_KO] : [EN, ALT_EN];
  const fill = (s, comp = '') => s.replaceAll('{cat}', category).replaceAll('{year}', String(year)).replaceAll('{comp}', comp);
  return [...base.map((s) => fill(s)), ...competitors.flatMap((c) => alt.map((s) => fill(s, c)))];
}

/**
 * Prompts grounded in what people actually search: Google autocomplete for category seeds (free, no key).
 * Returned as-is (people paste search-style questions into chat apps too), deduped, plus the template set as fallback.
 */
export async function autocompletePrompts({ category, competitors = [], locale = 'en', fetchImpl = fetch, max = 20 }) {
  const ko = locale.startsWith('ko');
  const seeds = ko ? [`${category} 앱 추천`, `${category} 앱`, `${category} 어플`, ...competitors.map((c) => `${c} 대신`)]
    : [`best ${category} app`, `${category} app for`, `${category} app free`, `${category} app without`, ...competitors.map((c) => `${c} alternative`)];
  const perSeed = [];
  for (const seed of seeds) {
    const url = `https://suggestqueries.google.com/complete/search?client=firefox&hl=${ko ? 'ko' : 'en'}&q=${encodeURIComponent(seed)}`;
    const res = await fetchImpl(url);
    if (res.status === 429 || res.status === 403) throw new RateLimitedError(url);
    if (!res.ok) throw new Error(`${url} HTTP ${res.status}`);
    const j = JSON.parse(await res.text());
    perSeed.push((j[1] ?? []).map((q) => q.trim()).filter((q) => q.split(/\s+/).length >= 3 && !/\b(reddit|windows|mac|pc|laptop|chrome|notion|excel|printable|journal|download|template)\b/i.test(q)));
    await new Promise((r) => setTimeout(r, 300));
  }
  // Round-robin across seeds so one seed's near-duplicates ("... free", "... free iphone") don't fill the set.
  const picked = [];
  const seen = new Set();
  const norm = (q) => q.toLowerCase().replace(/\b(ios|iphone|apple)\b/g, 'iphone').replace(/\bfor\b/g, '').replace(/\s+/g, ' ').trim();
  for (let i = 0; picked.length < max && perSeed.some((xs) => i < xs.length); i += 1) {
    for (const xs of perSeed) { const q = xs[i]; if (q && !seen.has(norm(q)) && picked.length < max) { seen.add(norm(q)); picked.push(q); } }
  }
  return picked.length >= 10 ? picked : [...picked, ...suggestPrompts({ category, competitors, locale }).slice(0, max - picked.length)];
}
