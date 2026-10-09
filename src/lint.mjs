// App Store listing lint: character limits counted the way people count (NFC grapheme clusters, so Korean/Japanese/
// emoji are not over-counted), plus the metadata patterns that commonly get listings rejected.
//   errors   — over the limit · empty name/description · another app's or company's name in metadata
//   warnings — ranking/price claims (en/ko/ja) · emoji or ALL-CAPS words in name/subtitle · wasted keyword characters
//              (space after comma, duplicates, empty items, words already in name/subtitle; CJK by substring)
// Method adapted from replica-skill (MIT, (c) 2026 Jake Schincariol) replica-launch/listing.py — reimplemented in JS.

export const LIMITS = Object.freeze({ name: 30, subtitle: 30, promoText: 170, keywords: 100, description: 4000 });
export const SHORT_FIELDS = Object.freeze(['name', 'subtitle']);
const STOP = new Set(['a', 'an', 'and', 'app', 'for', 'the', 'to', 'of', 'with', 'your', 'you', 'in', 'on', '&']);
const CLAIMS = /(#\s?1\b|\bnumber one\b|\bno\.? ?1\b|\bbest\b|\btop\b|\btop[- ]rated\b|\b(app|game) of the year\b|\bfree\b|\bdiscount\b|\bsale\b|\d+\s?% off\b|\bnew!?$|최고|1위|무료|할인|無料|最高|ナンバーワン|No\.?\s?1|セール|割引)/iu;
const CJK = /[\p{Script=Hangul}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const nfc = (s) => String(s ?? '').normalize('NFC');

export const length = (text) => [...seg.segment(nfc(text))].length;
export const hasEmoji = (text) => /\p{Extended_Pictographic}/u.test(nfc(text));
export const tokens = (text) => nfc(text).toLowerCase().split(/[\s\p{P}\p{S}]+/u).filter((w) => w && !STOP.has(w));

export function lintLocale(L, avoidExtra = []) {
  const issues = [];
  const add = (level, field, message) => issues.push({ level, field, message });
  const avoid = [...(L.avoid ?? []), ...avoidExtra].map((a) => nfc(a).trim()).filter(Boolean);
  for (const [field, limit] of Object.entries(LIMITS)) {
    const provided = Object.hasOwn(L, field);
    const value = nfc(L[field]);
    if (!value.trim()) {
      if (field === 'name' || (field === 'description' && provided)) add('error', field, 'empty');
      else if (field === 'subtitle' || field === 'keywords') add('warn', field, 'empty');
      continue;
    }
    const n = length(value);
    if (n > limit) add('error', field, `${n} chars, limit ${limit} (${n - limit} over)`);
    const low = value.toLowerCase();
    for (const a of avoid) if (low.includes(a.toLowerCase())) add('error', field, `mentions '${a}' — other apps' names or trademarks in metadata invite rejection and takedown requests. Describe what your app does instead.`);
    if (SHORT_FIELDS.includes(field)) {
      const m = CLAIMS.exec(value);
      if (m) add('warn', field, `'${m[0].trim()}' reads as a ranking/price claim — Apple rejects claims you cannot prove.`);
      if (hasEmoji(value)) add('warn', field, 'emoji in a short field — frequently flagged in review.');
      const caps = value.match(/\b[A-Z]{4,}\b/g);
      if (caps) add('warn', field, `ALL-CAPS words: ${caps.join(', ')}`);
    }
  }
  const kwRaw = nfc(L.keywords);
  if (kwRaw.trim()) {
    const parts = kwRaw.split(',').map((k) => k.trim().toLowerCase());
    if (/,\s/.test(kwRaw)) add('warn', 'keywords', 'space after comma wastes characters — word1,word2,word3');
    const dupes = [...new Set(parts.filter((k, i) => k && parts.indexOf(k) !== i))].sort();
    if (dupes.length) add('warn', 'keywords', `duplicates: ${dupes.join(', ')}`);
    const nameToks = new Set([...tokens(L.name), ...tokens(L.subtitle)]);
    const wasted = new Set();
    for (const k of parts) for (const w of tokens(k)) {
      if (nameToks.has(w)) wasted.add(w);
      else if (CJK.test(w) && [...nameToks].some((t) => t.includes(w))) wasted.add(w);
    }
    if (wasted.size) add('warn', 'keywords', `already in name/subtitle (wasted): ${[...wasted].sort().join(', ')}`);
    if (parts.some((k) => !k)) add('warn', 'keywords', 'empty item (double or trailing comma)');
  }
  return issues;
}

export function validateListing(data) {
  const list = Array.isArray(data) ? data : [data];
  if (!list.length) return 'no locales';
  for (const [i, L] of list.entries()) {
    if (!L || typeof L !== 'object' || Array.isArray(L)) return `[${i}] not an object`;
    if (typeof L.locale !== 'string' || !L.locale.trim()) return `[${i}] missing locale`;
    for (const f of Object.keys(LIMITS)) if (L[f] != null && typeof L[f] !== 'string') return `[${i}] ${f} must be a string`;
    if (L.avoid != null && !(Array.isArray(L.avoid) && L.avoid.every((a) => typeof a === 'string'))) return `[${i}] avoid must be an array of strings`;
  }
  return null;
}

export function lint(data, avoidExtra = []) {
  return (Array.isArray(data) ? data : [data]).map((L) => ({ locale: L.locale, issues: lintLocale(L, avoidExtra), counts: Object.fromEntries(Object.keys(LIMITS).filter((f) => L[f] != null).map((f) => [f, length(L[f])])) }));
}

export function renderLint(results) {
  const out = [];
  for (const r of results) {
    out.push(`[${r.locale}]`);
    for (const [f, n] of Object.entries(r.counts)) out.push(`  ${f.padEnd(12)} ${String(n).padStart(5)} / ${String(LIMITS[f]).padEnd(5)} ${n > LIMITS[f] ? 'OVER' : n ? 'ok' : '--'}`);
    for (const i of r.issues) out.push(`  ${i.level.toUpperCase().padEnd(5)} ${i.field}: ${i.message}`);
    if (!r.issues.length) out.push('  no issues');
    out.push('');
  }
  return out.join('\n');
}
