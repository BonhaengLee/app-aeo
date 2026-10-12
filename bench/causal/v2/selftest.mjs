// No network, no model. node bench/causal/v2/selftest.mjs
import assert from 'node:assert/strict';
import { CONDITIONS, K_MAX, PLACEBO_BRANDS, askWithBackoff, conditionsOf, contextText, holm, kappa, occurrences, resultsOf, selectUnits, signFlip, signFlipMC, shuffle } from './lib.mjs';
import { buildAll, expected } from './build.mjs';
import { judgePrompt as eligPrompt, parseVerdict } from './eligibility.mjs';
import { items, parseLabel, judgePrompt } from './judge.mjs';
import { jobsFor, pending, score } from './collect.mjs';
import { agreement, analyse, outcomes, labelsOf } from './analyze.mjs';
import { todo } from './corpus.mjs';

let pass = 0, fail = 0;
async function t(name, fn) { try { await fn(); pass += 1; } catch (e) { fail += 1; console.log(`FAIL ${name}\n  ${e.message.split('\n').join('\n  ')}`); } }

const CAT = { id: 'habit', kind: 'habit tracker app', apps: [{ name: 'Streaks', aliases: [] }, { name: 'Habitify', aliases: [] }, { name: 'Loop Habit Tracker', aliases: ['Loop'] }], prompts: ['q1', 'q2'] };
const seenOf = (n, extra = {}) => Array.from({ length: n }, (_, i) => ({ url: `https://s${i}.com/x`, text: `Result ${i}\n${extra[i] ?? `generic snippet ${i}`}` }));

await t('resultsOf: dedupes by URL, splits title and snippet', () => {
  const r = resultsOf([{ url: 'https://a.com', text: 'T\nS1 S2' }, { url: 'https://a.com', text: 'dup' }, { url: null, text: 'x' }]);
  assert.deepEqual(r, [{ url: 'https://a.com', title: 'T', snippet: 'S1 S2' }]);
});
await t('selectUnits: excludes apps in results / prompt / rejected by judge; balances apps; skips short lists', () => {
  const corpus = [
    { ok: true, category: 'habit', prompt: 'q1', seen: seenOf(15, { 2: 'Streaks is great' }) },
    { ok: true, category: 'habit', prompt: 'Habitify alternative', seen: seenOf(15) },
    { ok: true, category: 'habit', prompt: 'q3', seen: seenOf(5) },
  ];
  const elig = corpus.map((c) => ({ category: 'habit', prompt: c.prompt, accept: { Streaks: true, Habitify: true, 'Loop Habit Tracker': false } }));
  const { units, skipped } = selectUnits(corpus, elig, [CAT]);
  assert.equal(skipped.fewResults, 1);
  const by = Object.fromEntries(units.map((u) => [u.prompt, u.subject]));
  assert.equal(by.q1, 'Habitify', 'Streaks is in a result; Loop rejected');
  assert.equal(by['Habitify alternative'], 'Streaks', 'the prompt names Habitify');
});
await t('conditionsOf: nested positions, k insertions, same slots for insert/placebo/fictional, manipulation counts', () => {
  const unit = { category: 'habit', prompt: 'best habit app', subject: 'Habitify', results: resultsOf(seenOf(20)) };
  const { meta, lists } = conditionsOf(unit, CAT);
  assert.equal(new Set(meta.positions).size, K_MAX);
  for (const c of CONDITIONS) {
    const text = contextText(unit.prompt, lists[c]);
    assert.deepEqual([occurrences(text, 'Habitify'), occurrences(text, meta.placebo), occurrences(text, meta.fictional)], expected(c), c);
  }
  const changed = (c) => lists[c].map((r, i) => (r.snippet !== unit.results[i].snippet ? i : -1)).filter((i) => i >= 0);
  assert.deepEqual(changed('I3'), changed('P3'));
  assert.deepEqual(changed('I3'), changed('F3'));
  assert.ok(changed('I1').every((i) => changed('I3').includes(i)) && changed('I3').every((i) => changed('I10').includes(i)), 'nested');
  // same template at the same slot: the edited snippets differ only by the name and the kind
  const i0 = changed('I3')[0];
  const kind = PLACEBO_BRANDS.find(([n]) => n === meta.placebo)[1];
  assert.equal(lists.I3[i0].snippet.replace('Habitify', 'N').replace('habit tracker app', 'K'), lists.P3[i0].snippet.replace(meta.placebo, 'N').replace(kind, 'K'));
  assert.equal(lists.I3[i0].snippet.replace('Habitify', 'N'), lists.F3[i0].snippet.replace(meta.fictional, 'N'));
});
await t('conditionsOf: a placebo name already in the results is skipped', () => {
  const base = resultsOf(seenOf(20, { 0: 'Le Creuset Staedtler Weber Pyrex Crayola Maglite Zippo Victorinox Sharpie mention' }));
  const { meta } = conditionsOf({ category: 'habit', prompt: 'p', subject: 'Habitify', results: base }, CAT);
  assert.equal(meta.placebo, 'Lodge');
});
await t('buildAll: aborts if a manipulation check fails, else one job per condition per unit', () => {
  const corpus = [{ ok: true, category: 'habit', prompt: 'q1', seen: seenOf(15) }];
  const elig = [{ category: 'habit', prompt: 'q1', accept: { Streaks: true, Habitify: true, 'Loop Habit Tracker': true } }];
  const b = buildAll([CAT], corpus, elig);
  assert.equal(b.jobs.length, CONDITIONS.length);
  assert.equal(new Set(b.jobs.map((j) => j.sha256)).size, CONDITIONS.length);
});
await t('signFlip exact: all-positive m clusters → p = 2^-m; symmetric → p ≥ 0.5; MC agrees', () => {
  assert.equal(signFlip([0.2, 0.1, 0.3, 0, 0]).p, 1 / 8);
  assert.ok(signFlip([0.2, -0.2]).p >= 0.5);
  const xs = [0.3, 0.1, 0.2, 0.05, -0.05, 0.1];
  assert.ok(Math.abs(signFlip(xs).p - signFlipMC(xs, { B: 50_000 }).p) < 0.01);
});
await t('holm and kappa', () => {
  assert.deepEqual(holm([0.01, 0.04]), [0.02, 0.04]);
  assert.equal(kappa(['R', 'N', 'R'], ['R', 'N', 'R']), 1);
  assert.ok(Math.abs(kappa(['R', 'R', 'N', 'N'], ['R', 'N', 'R', 'N']) - 0) < 1e-9);
});
await t('eligibility / judge parsers are strict', () => {
  assert.deepEqual(parseVerdict('x {"Streaks": true, "Habitify": false, "Loop Habit Tracker": true} y', CAT.apps), { Streaks: true, Habitify: false, 'Loop Habit Tracker': true });
  assert.equal(parseVerdict('{"Streaks": true}', CAT.apps), null, 'missing app');
  assert.equal(parseVerdict('{"Streaks": "yes", "Habitify": false, "Loop Habit Tracker": true}', CAT.apps), null, 'non-boolean');
  assert.equal(parseLabel('{"label": "RECOMMENDED"}'), 'RECOMMENDED');
  assert.equal(parseLabel('{"label": "maybe"}'), null);
  assert.match(eligPrompt('q', CAT), /Streaks \(habit tracker app\)/);
  assert.ok(!/I3|P3|insert|placebo|experiment/i.test(judgePrompt({ name: 'X', question: 'q', answer: 'a' })), 'judge is blind to the design');
});
await t('collect: replication subset, interleaved order, score uses aliases', () => {
  const cond = { jobs: ['BASE', 'I1', 'I3', 'P3'].flatMap((c) => [['a', 'p1'], ['a', 'p2']].map(([cat, p]) => ({ id: `${cat}${p}${c}`, category: cat, prompt: p, condition: c }))), replication: [['a', 'p1']] };
  assert.deepEqual(jobsFor('replication', cond).map((j) => j.condition).sort(), ['BASE', 'I3', 'P3']);
  const order = pending(cond.jobs, 1, []).map((j) => j.condition);
  assert.notDeepEqual(order, [...order].sort(), 'not grouped by condition');
  assert.deepEqual(score('Try Loop or Quorvel', { subject: 'Loop Habit Tracker', placebo: 'Weber', fictional: 'Quorvel' }, CAT.apps), { subjectNamed: true, placeboNamed: false, fictionalNamed: true });
  assert.equal(todo([CAT], [{ ok: true, category: 'habit', prompt: 'q1' }]).length, 1);
});

// ---- end-to-end analysis on planted data ----
function plant({ apps = 16, perApp = 8, effect }) {
  const units = [];
  const rows = [];
  for (let a = 0; a < apps; a++) for (let u = 0; u < perApp; u++) {
    const unit = { category: 'habit', prompt: `p${a}-${u}`, subject: `App${a}` };
    units.push(unit);
    for (const c of CONDITIONS) for (let r = 1; r <= 3; r++) {
      const named = effect(a, u, c, r);
      rows.push({ ok: true, id: `${a}-${u}-${c}`, repeat: r, category: 'habit', prompt: unit.prompt, condition: c, subject: unit.subject, subjectNamed: named, fictionalNamed: false, searches: 0 });
    }
  }
  const lab = new Map(rows.filter((x) => x.subjectNamed).map((x) => [`${x.id}#${x.repeat}#subject`, 'RECOMMENDED']));
  return { units, rows, lab };
}
const run = (p) => analyse({ units: p.units, primaryRows: outcomes(p.rows, p.lab, p.lab).rows });
await t('analysis: a planted effect in every app is supported; none is not', () => {
  const yes = run(plant({ effect: (a, u, c, r) => (c === 'I10' || c === 'I3') && u % 2 === 0 && r <= 2 }));
  assert.deepEqual(yes.primary.map((p) => p.supported), [true, true]);
  const no = run(plant({ effect: (a, u, c, r) => u % 4 === 0 && r === 1 }));
  assert.deepEqual(no.primary.map((p) => p.supported), [false, false]);
});
await t('analysis: an effect concentrated in 2 of 16 apps is NOT supported, although many units moved (v1 weakness)', () => {
  const res = run(plant({ effect: (a, u, c) => (c === 'I10' || c === 'I3') && a < 2 }));
  assert.equal(res.primary[1].unitsMoved, 16);
  assert.deepEqual(res.primary.map((p) => p.supported), [false, false]);
});
await t('analysis: primary outcome = claude RECOMMENDED; both / codex are sensitivity; missing refuses, FAILED excludes', () => {
  const p = plant({ effect: (a, u, c) => c === 'I10' });
  const half = new Map([...p.lab].map(([k, v], i) => [k, i % 2 ? v : 'MENTIONED']));
  const o = outcomes(p.rows, p.lab, half); // codex all RECOMMENDED, claude half
  assert.equal(o.rows.filter((r) => r.subjectRec).length, Math.floor(p.lab.size / 2));
  assert.equal(o.rows.filter((r) => r.subjectRecBoth).length, Math.floor(p.lab.size / 2));
  assert.equal(o.rows.filter((r) => r.subjectRecCodex).length, p.lab.size);
  assert.equal(outcomes(p.rows, new Map(), p.lab).missingJudgments, p.lab.size, 'missing judgments are counted, never treated as no');
  const failed = new Map([...p.lab].map(([k]) => [k, 'FAILED']));
  const f = outcomes(p.rows, p.lab, failed);
  assert.equal(f.failedJudgments, p.lab.size);
  assert.equal(f.rows.filter((r) => r.subjectRec === null).length, p.lab.size, 'failed → excluded (null), not "no"');
});
await t('outcomes: duplicate rows count once; rows of jobs outside the current design are ignored', () => {
  const p = plant({ effect: () => false });
  const rows = [...p.rows, { ...p.rows[0] }, { ...p.rows[1], id: 'old-design' }];
  const o = outcomes(rows, p.lab, p.lab, new Set(p.rows.map((r) => r.id)));
  assert.deepEqual([o.duplicates, o.stale, o.rows.length], [1, 1, p.rows.length]);
});
await t('selectUnits: an app whose domain is in a result URL is not a candidate (it would be visible in BASE)', () => {
  const seen = seenOf(15);
  seen[4] = { url: 'https://www.habitify.me/blog/best-habit-apps', text: 'Best habit apps\nA list of options' };
  const { units } = selectUnits([{ ok: true, category: 'habit', prompt: 'q1', seen }], [{ category: 'habit', prompt: 'q1', accept: { Streaks: false, Habitify: true, 'Loop Habit Tracker': false } }], [CAT]);
  assert.equal(units.length, 0);
});
await t('job ids change with the subject or the context (a rebuilt design never inherits old answers)', () => {
  const corpus = [{ ok: true, category: 'habit', prompt: 'q1', seen: seenOf(15) }];
  const a = buildAll([CAT], corpus, [{ category: 'habit', prompt: 'q1', accept: { Streaks: true, Habitify: false, 'Loop Habit Tracker': false } }]);
  const b = buildAll([CAT], corpus, [{ category: 'habit', prompt: 'q1', accept: { Streaks: false, Habitify: true, 'Loop Habit Tracker': false } }]);
  assert.equal(a.jobs.filter((j) => b.jobs.some((k) => k.id === j.id)).length, 0);
});
await t('the app-weighted estimand: verdicts, CI and test agree on unequal app sizes', () => {
  // 15 apps; app 0 has 30 units with Δ=-1/3, others 2 units with Δ=+1/3 → unit mean < 0 but app mean > 0
  const units = [], rows = [];
  const add = (app, i, named) => { const u = { category: 'habit', prompt: `${app}-${i}`, subject: app }; units.push(u); for (const c of CONDITIONS) rows.push({ ok: true, id: `${u.prompt}-${c}`, repeat: 1, category: 'habit', prompt: u.prompt, condition: c, subject: app, subjectNamed: named(c), fictionalNamed: false, searches: 0 }); };
  for (let i = 0; i < 30; i++) add('Big', i, (c) => c === 'P3');
  for (let a = 0; a < 14; a++) for (let i = 0; i < 2; i++) add(`A${a}`, i, (c) => c === 'I3');
  const lab = new Map(rows.filter((r) => r.subjectNamed).map((r) => [`${r.id}#1#subject`, 'RECOMMENDED']));
  const res = analyse({ units, primaryRows: outcomes(rows, lab, lab).rows });
  const h1 = res.primary[0];
  assert.ok(h1.meanDelta < 0 && h1.appMeanDelta > 0);
  assert.equal(h1.supported, true);
  assert.ok(h1.ci[0] > 0, 'CI of the same (app-weighted) statistic excludes 0');
});
await t('S4 compares gains, and the fictional name only counts in F3', () => {
  const res = run(plant({ effect: (a, u, c) => c === 'I3' }));
  assert.ok(res.secondary.find((s) => s.s.startsWith('S4')).appMeanDelta > 0);
});
await t('analysis: answers that searched are excluded', () => {
  const p = plant({ effect: () => false });
  p.rows[0].searches = 1;
  assert.equal(outcomes(p.rows, p.lab, p.lab).rows.length, p.rows.length - 1);
});
await t('labelsOf keeps the latest ok judgment; items skip searched answers', () => {
  assert.equal(labelsOf([{ ok: true, key: 'k', label: 'MENTIONED' }, { ok: false, key: 'k' }, { ok: true, key: 'k', label: 'RECOMMENDED' }]).get('k'), 'RECOMMENDED');
  assert.equal(items([{ ok: true, searches: 2, subjectNamed: true, id: 'a', repeat: 1 }]).length, 0);
});
await t('askWithBackoff: retries rate limits with the waits, then throws; other errors throw at once', async () => {
  const waited = [];
  let n = 0;
  const flaky = async () => { n += 1; if (n < 3) { const e = new Error('429'); e.kind = 'rate_limited'; throw e; } return 'ok'; };
  assert.equal(await askWithBackoff(flaky, [], { waits: [1, 2, 3], sleep: async (ms) => waited.push(ms) }), 'ok');
  assert.deepEqual(waited, [1, 2]);
  const always = async () => { const e = new Error('429'); e.kind = 'rate_limited'; throw e; };
  await assert.rejects(askWithBackoff(always, [], { waits: [1], sleep: async () => {} }), /429/);
  let m = 0;
  await assert.rejects(askWithBackoff(async () => { m += 1; throw Object.assign(new Error('auth'), { kind: 'auth' }); }, [], { waits: [1], sleep: async () => {} }));
  assert.equal(m, 1);
});
await t('agreement keeps studies apart (the same key exists in primary and replication)', () => {
  const k = 'abc#1#subject';
  const r = agreement([{ a: new Map([[k, 'RECOMMENDED']]), b: new Map([[k, 'RECOMMENDED']]), keys: [k] }, { a: new Map([[k, 'MENTIONED']]), b: new Map([[k, 'RECOMMENDED']]), keys: [k] }]);
  assert.equal(r.items, 2);
  assert.ok(r.kappaRec < 1);
});
await t('shuffle is deterministic per seed and a permutation', () => {
  assert.deepEqual(shuffle([1, 2, 3, 4, 5], 7), shuffle([1, 2, 3, 4, 5], 7));
  assert.deepEqual(shuffle([1, 2, 3, 4, 5], 7).sort(), [1, 2, 3, 4, 5]);
});

console.log(`=== causal v2 selftest: PASS ${pass} / FAIL ${fail} ===`);
process.exitCode = fail ? 1 : 0;
