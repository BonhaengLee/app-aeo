// No network, no model. node bench/causal/analyze-selftest.mjs
import assert from 'node:assert/strict';
import { analyse, contrast, rates, render } from './analyze.mjs';
import { blurb, excerpt, insertAfterFirst, promote, sentenceAt, buildCategory, PLACEBO } from './build.mjs';
import { pending } from './collect.mjs';

let pass = 0, fail = 0;
async function t(name, fn) { try { await fn(); pass += 1; } catch (e) { fail += 1; console.log(`FAIL ${name}\n  ${e.message.split('\n').join('\n  ')}`); } }

const T = { name: 'Monarch Money' }, Y = { name: 'YNAB' };

await t('excerpt starts 400 chars before the first app mention and is 3000 long', () => {
  const text = `${'x'.repeat(1000)} YNAB is great. ${'y'.repeat(5000)}`;
  const ex = excerpt(text, [T, Y]);
  assert.equal(ex.length, 3000 - 0);
  assert.ok(ex.includes('YNAB is great'));
  assert.equal(excerpt('no apps here '.repeat(10), [T]).startsWith('no apps'), true);
});
await t('sentence edits: insert after the first competitor sentence; promote moves the target sentence first', () => {
  const ex = 'Intro text. YNAB is a budgeting app. Others exist. Monarch Money tracks everything. End.';
  assert.deepEqual(sentenceAt(ex, ex.indexOf('YNAB'), 4), [12, 36]);
  // menus and lists have no sentence marks: fall back to the name's own edges
  const menu = `${'Best for couples: Honeydue Best overall: '.repeat(8)}YNAB Best for beginners: Quicken ${'z '.repeat(150)}`;
  const at = menu.indexOf('YNAB');
  assert.deepEqual(sentenceAt(menu, at, 4), [at, at + 4]);
  assert.equal(insertAfterFirst(menu, [Y], 'Monarch Money: X.').slice(at, at + 24), 'YNAB Monarch Money: X. B');
  assert.equal(insertAfterFirst(ex, [Y], 'Monarch Money: X.'), 'Intro text. YNAB is a budgeting app. Monarch Money: X. Others exist. Monarch Money tracks everything. End.');
  assert.equal(promote(ex, T), 'Monarch Money tracks everything. Intro text. YNAB is a budgeting app. Others exist. End.');
  assert.equal(promote('Monarch Money first. Then YNAB.', T), null, 'already first → no PROMOTE condition');
  assert.equal(blurb('Monarch Money', 'The all-in-one money app for everyone. Track spending.'), 'Monarch Money: The all-in-one money app for everyone.');
  assert.equal(blurb('IT', '* Apps of the Year Winner - TIME * * More time is spent here than anywhere ' + 'x '.repeat(100)).endsWith('x'), true, 'bullets dropped, cut at a word boundary');
  assert.ok(!blurb('IT', '* Winner * more words here and here and here').includes('*'));
  assert.equal(blurb('YNAB', 'Have you ever worried about money? You are not alone. Download YNAB, get good at money, and never worry again.'), 'YNAB: Download YNAB, get good at money, and never worry again.');
});
await t('buildCategory: eligibility per hypothesis, edits only one page, placebo at the same place', () => {
  const cfg = { target: T, competitors: [Y] };
  const pagesTxt = {
    'a.com/1': 'Best apps. YNAB is good for envelopes. More text here.',
    'b.com/1': 'Reviews. YNAB again. Nothing else.',
    'c.com/1': 'Tips. Save money every month.',
    'd.com/1': 'List. YNAB leads. Monarch Money is second.',
    'e.com/1': 'Another. Monarch Money is nice. YNAB too.',
    'f.com/1': 'Third. Monarch Money rocks.',
  };
  const src = Object.keys(pagesTxt).map((k, i) => ({ key: k, url: `https://${k}`, host: k.split('/')[0], kind: 'earned', page: { ok: true }, lift: [null, null, null, 0.3, 0.1, -0.1][i] }));
  const diagnosis = { engines: [{ provider: 'codex-search', sources: src }] };
  const row = (prompt, keys) => ({ ok: true, provider: 'codex-search', prompt, citations: keys.map((k) => `https://${k}`) });
  const rows = [row('p-cov', ['a.com/1', 'b.com/1', 'c.com/1']), row('p-cov', ['a.com/1']), row('p-sel', ['d.com/1', 'e.com/1', 'f.com/1']), row('p-few', ['a.com/1', 'b.com/1'])];
  const units = buildCategory('budgeting', { cfg, rows, diagnosis, pageText: (k) => pagesTxt[k], blurbs: { 'Monarch Money': 'Monarch Money: X.', YNAB: 'YNAB: Y.' } });
  assert.deepEqual(units.map((u) => u.prompt), ['p-cov', 'p-sel'], 'p-few has < 3 pages');
  const cov = units[0], sel = units[1];
  assert.deepEqual(Object.keys(cov.conditions).sort(), ['BASE', 'INSERT', 'PLACEBO']);
  assert.equal(cov.insertAt, 'a.com/1', 'most-read page that lists a competitor');
  const changed = cov.conditions.INSERT.filter((x, i) => x.content !== cov.conditions.BASE[i].content);
  assert.equal(changed.length, 1);
  assert.ok(cov.conditions.PLACEBO[0].content.includes(PLACEBO) && cov.conditions.INSERT[0].content.includes('Monarch Money: X.'));
  assert.equal(cov.conditions.PLACEBO[0].content.indexOf(PLACEBO), cov.conditions.INSERT[0].content.indexOf('Monarch Money: X.'), 'same position');
  assert.equal(cov.subject.H1, 'Monarch Money', 'target preferred when it qualifies');
  assert.deepEqual(Object.keys(sel.conditions).sort(), ['ABLATE_HI', 'ABLATE_LO', 'BASE', 'PROMOTE'], 'every configured app is on a page → no H1');
  assert.deepEqual(sel.ablate, { hi: 'd.com/1', hiLift: 0.3, lo: 'f.com/1', loLift: -0.1 });
  assert.deepEqual(sel.conditions.ABLATE_HI.map((x) => x.page.key), ['e.com/1', 'f.com/1']);
  assert.equal(sel.promoteAt, 'd.com/1');
  assert.ok(sel.conditions.PROMOTE[0].content.startsWith('Monarch Money is second.'));
});
await t('rates/contrast: per-prompt shares; prompts missing a condition are dropped, not zero', () => {
  const r = (prompt, condition, named, ok = true) => ({ ok, category: 'c', prompt, condition, named: named ? ['T'] : ['O'] });
  const rows = [r('a', 'X', true), r('a', 'X', false), r('a', 'Y', false), r('b', 'X', true), r('b', 'Y', true, false)];
  const rate = rates(rows);
  assert.equal(rate('c', 'a', 'X', 'T'), 0.5);
  assert.equal(rates([...rows, { ...rows[0], id: 'j', repeat: 1 }, { ...rows[0], id: 'j', repeat: 1 }])('c', 'a', 'X', 'T'), 2 / 3, 'duplicate (id, repeat) counted once');
  assert.equal(rate('c', 'a', 'X', 'O'), 0.5, 'per subject app');
  assert.equal(rate('c', 'b', 'Y', 'T'), null, 'only failed answers → no rate');
  const c = contrast([['c', 'a', 'T'], ['c', 'b', 'T']], rate, ['X', 'Y']);
  assert.deepEqual([c.ds, c.dropped.length], [[0.5], 1]);
});
await t('analyse: a real effect is supported, a null is not, n < 10 is "not testable"', () => {
  const rows = [];
  const add = (cat, prompt, cond, k, n = 3) => { for (let i = 0; i < n; i++) rows.push({ ok: true, category: cat, prompt, condition: cond, named: i < k ? ['T'] : [], searches: 0, model: 'm' }); };
  const picks = { H1: [], H2: [], H3: [] };
  for (let i = 0; i < 14; i++) { const p = `q${i}`; picks.H1.push(['c', p, 'T']); add('c', p, 'INSERT', 3); add('c', p, 'PLACEBO', i < 2 ? 3 : 0); add('c', p, 'BASE', 0); }
  for (let i = 0; i < 14; i++) { const p = `s${i}`; picks.H2.push(['c', p, 'T']); add('c', p, 'PROMOTE', i % 2 ? 2 : 1); add('c', p, 'BASE', i % 2 ? 1 : 2); }
  for (let i = 0; i < 4; i++) { const p = `s${i}`; picks.H3.push(['c', p, 'T']); add('c', p, 'ABLATE_LO', 3); add('c', p, 'ABLATE_HI', 0); }
  const res = analyse(rows, { picks });
  const [h1, h2, h3] = res.primary;
  assert.deepEqual([h1.supported, h1.sign.pos, h1.sign.n], [true, 12, 12]);
  assert.equal(h2.supported, false);
  assert.deepEqual([h3.testable, h3.supported], [false, false]);
  assert.ok(h1.ci[0] > 0);
  const md = render(res);
  assert.match(md, /\*\*H1\*\*: In this controlled setting, adding an app/);
  assert.match(md, /\*\*H2\*\*: No evidence/);
  assert.match(md, /not testable/);
  assert.equal(res.secondary.find((s) => s.s === 'S2').meanDelta, 1);
});
await t('collect.pending: only missing or failed (job, repeat) pairs are asked again', () => {
  const jobs = [{ id: 'a' }, { id: 'b' }];
  const done = [{ id: 'a', repeat: 1, ok: true }, { id: 'a', repeat: 2, ok: false }];
  assert.deepEqual(pending(jobs, done).map((j) => `${j.id}#${j.repeat}`), ['a#2', 'a#3', 'b#1', 'b#2', 'b#3']);
});

console.log(`=== causal analyze selftest: PASS ${pass} / FAIL ${fail} ===`);
process.exitCode = fail ? 1 : 0;
