// Free web grounding for memory-mode engines: one Tavily search per prompt (free plan: 1,000 credits/month,
// basic search = 1 credit), cached in the run directory so repeats and resumes never pay twice.
// The snippets are handed to the engine with the user's question → mode "rag". This mirrors how search-backed
// assistants work (retrieve, then answer). It is NOT the same retrieval ChatGPT or Gemini use; validate before trusting.
import fs from 'node:fs';
import path from 'node:path';
import { ProviderError, classifyHttp } from './providers.mjs';

export const TAVILY_URL = 'https://api.tavily.com/search';
export const MAX_RESULTS = 6;
export const SNIPPET_CHARS = 700;

export async function tavilySearch(query, { fetchImpl = fetch, key = process.env.TAVILY_API_KEY, timeoutMs = 30_000 } = {}) {
  if (!key) throw new ProviderError('auth', 'TAVILY_API_KEY is not set (free key: https://app.tavily.com)');
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  let res, text;
  try {
    res = await fetchImpl(TAVILY_URL, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` }, body: JSON.stringify({ query, search_depth: 'basic', max_results: MAX_RESULTS }), signal: ac.signal });
    text = await res.text();
  } catch (e) {
    throw new ProviderError(e.name === 'AbortError' ? 'timeout' : 'failed', `tavily: ${e.message}`);
  } finally { clearTimeout(t); }
  // Tavily answers 432 when the plan's credits are used up.
  if (!res.ok) throw new ProviderError(res.status === 432 ? 'quota' : classifyHttp(res.status, text), `tavily HTTP ${res.status}: ${text.slice(0, 200)}`);
  const j = JSON.parse(text);
  return (j.results ?? []).map((r) => ({ title: String(r.title ?? ''), url: String(r.url ?? ''), content: String(r.content ?? '').slice(0, SNIPPET_CHARS) }));
}

/** Per-run grounding cache: prompt → results. Concurrent callers for the same prompt share one request. */
export function groundCache(dir, searchImpl = tavilySearch) {
  const file = path.join(dir, 'ground.json');
  const disk = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  const inflight = new Map();
  return {
    async get(prompt) {
      if (disk[prompt]) return disk[prompt];
      if (!inflight.has(prompt)) {
        inflight.set(prompt, searchImpl(prompt).then((results) => {
          disk[prompt] = results;
          fs.writeFileSync(file, JSON.stringify(disk, null, 2));
          return results;
        }).finally(() => inflight.delete(prompt)));
      }
      return inflight.get(prompt);
    },
    size: () => Object.keys(disk).length,
  };
}

/** The question exactly as the user asked it, preceded by search results — the way a search assistant sees it. */
export function ragPrompt(prompt, results) {
  const blocks = results.map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.content}`).join('\n\n');
  return `Web search results for the question below (retrieved just now):\n\n${blocks}\n\n---\nAnswer the question as a helpful assistant. Use the search results where relevant; you may also use your own knowledge.\n\nQuestion: ${prompt}`;
}
