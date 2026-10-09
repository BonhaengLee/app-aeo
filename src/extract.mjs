// Find which apps an answer mentions, and where.
//
// An app is "mentioned" when the answer contains one of its names/aliases as a whole word, or a store link to it
// (apps.apple.com/.../id123 · play.google.com/store/apps/details?id=pkg). Store links are the strongest signal and
// are reported separately (`linked`). Position = the 1-based number of the list item holding the first mention when
// the answer is a list, else the order of first mention among all known apps.
//
// Names that are ordinary words ("Streaks", "Done") will over-match in prose. That is reported, not hidden:
// every hit records which alias matched so you can tighten `aliases`.

const nfc = (s) => String(s ?? '').normalize('NFC');
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const APPLE_ID_RE = /(?:apps|itunes)\.apple\.com\/[^\s)\]>"']*?\bid(\d{6,12})/gi;
export const PLAY_ID_RE = /play\.google\.com\/store\/apps\/details\?(?:[^\s)\]>"']*&)?id=([A-Za-z0-9_.]+)/gi;

/** Every App Store / Play id linked in the text, in order of appearance (deduped). */
export function storeLinks(text) {
  const t = nfc(text);
  const out = [];
  const seen = new Set();
  for (const [re, store] of [[APPLE_ID_RE, 'apple'], [PLAY_ID_RE, 'play']]) {
    for (const m of t.matchAll(re)) {
      const key = `${store}:${m[1]}`;
      if (!seen.has(key)) { seen.add(key); out.push({ store, id: m[1], offset: m.index }); }
    }
  }
  return out.sort((a, b) => a.offset - b.offset);
}

/** Aliases worth matching: the name and explicit aliases. No automatic shortening here — the part before " - " is
 *  often a generic phrase ("Habit Tracker - HabitKit"); use brandOf() when building a config instead. */
export function aliasesOf(app) {
  const names = [app.name, ...(app.aliases ?? [])].map(nfc).map((s) => s.trim()).filter(Boolean);
  return [...new Set(names)].filter((n) => [...n].length >= 3 || /[^\x00-\x7F]/.test(n));
}

const GENERIC = new Set(['app', 'apps', 'the', 'and', 'for', 'free', 'best', 'my', 'daily', 'simple', 'pro', 'plus', 'lite', '&', 'with', 'your', 'tracker', 'planner', 'manager', 'maker', 'editor', 'widget', 'widgets', 'game', 'games', '앱', '어플']);
const words = (s) => nfc(s).toLowerCase().split(/[\s\p{P}\p{S}]+/u).filter(Boolean);

/** Brand part of a store title: the first " - " / ":" segment that has a word outside the category and generic words. */
export function brandOf(title, category = '') {
  const segs = nfc(title).split(/\s[-–—|]\s|:\s/).map((x) => x.trim()).filter(Boolean);
  const cat = new Set(words(category));
  const brand = segs.find((seg) => words(seg).some((w) => !cat.has(w) && !GENERIC.has(w)));
  return brand ?? segs[0] ?? nfc(title).trim();
}

/** A one-word Title-case Latin brand ("Calm", "Streaks", "Loop") is also an ordinary word. Match it only with a capital
 *  (or ALL CAPS): in the benchmark the LLM judge caught "a calm, playful meditation app" counted as the app Calm. */
export const isWordLikeBrand = (alias) => /^[A-Z][a-z]+$/.test(alias);

function aliasRegex(alias) {
  const body = isWordLikeBrand(alias) ? `(?:${escapeRe(alias)}|${escapeRe(alias.toUpperCase())})` : escapeRe(alias);
  return new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, isWordLikeBrand(alias) ? 'gu' : 'giu');
}

/** First offset where `app` is mentioned, or null. */
export function findMention(text, app) {
  const t = nfc(text);
  let best = null;
  for (const alias of aliasesOf(app)) {
    const m = aliasRegex(alias).exec(t);
    if (m && (best === null || m.index < best.offset)) best = { offset: m.index, matchedBy: `name:${alias}` };
  }
  for (const link of storeLinks(t)) {
    const hit = (link.store === 'apple' && app.appStoreId && String(app.appStoreId) === link.id)
      || (link.store === 'play' && app.playId && app.playId === link.id);
    if (hit && (best === null || link.offset < best.offset)) best = { offset: link.offset, matchedBy: `link:${link.store}:${link.id}` };
  }
  const linked = storeLinks(t).some((l) => (l.store === 'apple' && app.appStoreId && String(app.appStoreId) === l.id) || (l.store === 'play' && app.playId && app.playId === l.id));
  return best ? { ...best, linked } : null;
}

/** Start offsets of list items ("1. ", "2) ", "- ", "* ", "• "). */
export function listItemStarts(text) {
  const t = nfc(text);
  const starts = [];
  const re = /^[ \t]*(?:\d{1,2}[.)]|[-*•])[ \t]+/gm;
  for (const m of t.matchAll(re)) starts.push(m.index);
  return starts;
}

/** 1-based list item index containing offset, or null (not in a list, or the text has fewer than 2 items).
 *  An item ends at the next item or at a blank line followed by non-list text, so a closing paragraph
 *  ("Streaks is my pick.") is not credited to the last item. */
export function listRankAt(starts, offset, text = null) {
  if (starts.length < 2 || offset < starts[0]) return null;
  let idx = 0;
  for (let i = 0; i < starts.length; i += 1) if (starts[i] <= offset) idx = i;
  if (text != null) {
    const t = nfc(text);
    const end = idx + 1 < starts.length ? starts[idx + 1] : t.length;
    const para = t.slice(starts[idx], end).search(/\n[ \t]*\n(?![ \t]*(?:\d{1,2}[.)]|[-*•])[ \t]|[ \t]{2,})/);
    if (para >= 0 && offset >= starts[idx] + para) return null;
  }
  return idx + 1;
}

/** Bold-wrapped names at the start of list items — candidates for apps you did not list as competitors. */
export function listedNames(text) {
  const t = nfc(text);
  const out = [];
  for (const m of t.matchAll(/^[ \t]*(?:\d{1,2}[.)]|[-*•])[ \t]+\*\*\[?([^*\]\n]{2,60}?)\]?(?:\([^)]*\))?\*\*/gm)) {
    const name = m[1].trim().replace(/^(?:iOS|iPhone|Android|Web|Mac)\s*:\s*/i, '');
    // "**Simple and polished:**" is a section label, not an app name.
    if (/[:：]$/.test(name) || name.split(/\s+/).length > 5) continue;
    // "Notion or a spreadsheet", "Android: Loop Habit Tracker." — alternatives and platform labels, not one app.
    if (/\s(or|and|\/|또는|나)\s/i.test(name) || /\.$/.test(name)) continue;
    // Section labels seen in real search-mode answers: "Android user?", "iPhone →", "Kotlin + Jetpack Compose",
    // "One-time purchase", "Room database". App names don't end in "?", don't contain arrows/plus, and start uppercase.
    if (/[?？→←⇒+=]/.test(name) || !/^[\p{Lu}\p{Lo}\d]/u.test(name)) continue;
    if (/\b(user|users|budget|database|devices?|purchase|subscription|option|options|pick|picks|need|want|use|if|best|free|paid|cheap|simple|bottom line|verdict|summary|winner|overall|alternative|alternatives|recommendation|recommendations|platform|price|pricing|features?|pros|cons|tip|tips|note)\b/i.test(name)) continue;
    out.push(name);
  }
  // Plain list items: "1. Habitica — useful" / "- Loop Habit Tracker: free". Same filters as bold names.
  for (const m of t.matchAll(/^[ \t]*(?:\d{1,2}[.)]|[-*•])[ \t]+(?!\*\*)([\p{Lu}\p{Lo}\d][^\n—–:*]{1,40}?)[ \t]+(?:—|–|-|:)[ \t]/gmu)) {
    const name = m[1].trim();
    if (/\s(or|and|\/|또는|나)\s/i.test(name) || /[.?？→←⇒+=]/.test(name) || name.split(/\s+/).length > 4) continue;
    if (/\b(user|users|budget|database|devices?|purchase|subscription|option|options|pick|picks|need|want|use|if|best|free|paid|cheap|simple|bottom line|verdict|summary|winner|overall|alternative|alternatives|recommendation|recommendations|platform|price|pricing|features?|pros|cons|tip|tips|note|step|why|how|what)\b/i.test(name)) continue;
    out.push(name);
  }
  return [...new Set(out)];
}

/**
 * Analyse one answer.
 * @param {string} text
 * @param {{name:string, aliases?:string[], appStoreId?:string, playId?:string}} target
 * @param {Array<{name:string, aliases?:string[], appStoreId?:string, playId?:string}>} competitors
 */
export function analyse(text, target, competitors = []) {
  const starts = listItemStarts(text);
  const apps = [{ ...target, role: 'target' }, ...competitors.map((c) => ({ ...c, role: 'competitor' }))];
  const hits = apps.map((a) => ({ name: a.name, role: a.role, hit: findMention(text, a) })).filter((x) => x.hit);
  const byOffset = [...hits].sort((a, b) => a.hit.offset - b.hit.offset);
  const mentions = byOffset.map((x, i) => ({
    name: x.name,
    role: x.role,
    order: i + 1,
    listRank: listRankAt(starts, x.hit.offset, text),
    linked: x.hit.linked,
    matchedBy: x.hit.matchedBy,
  }));
  const knownApple = new Set(apps.map((a) => a.appStoreId).filter(Boolean).map(String));
  const knownPlay = new Set(apps.map((a) => a.playId).filter(Boolean));
  const otherLinks = storeLinks(text).filter((l) => !(l.store === 'apple' ? knownApple.has(l.id) : knownPlay.has(l.id))).map(({ store, id }) => ({ store, id }));
  const knownNames = new Set(apps.flatMap(aliasesOf).map((n) => n.toLowerCase()));
  const otherNames = listedNames(text).filter((n) => ![...knownNames].some((k) => n.toLowerCase().includes(k) || k.includes(n.toLowerCase())));
  const target_ = mentions.find((m) => m.role === 'target') ?? null;
  return { target: target_, mentions, otherLinks, otherNames, isList: starts.length >= 2 };
}
