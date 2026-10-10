#!/usr/bin/env node
// Self-test for analyze.mjs (PREREGISTRATION.md §9), run before any held-out data exists.
// Differential: the same code must SUPPORT C1 when T is better, and must NOT support it (and support the reverse)
// when the rival is better — so the analysis can come out either way.
import { analyse, parseDirect, signTest, holm, rateOverPrompts } from './analyze.mjs';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error(`FAIL ${msg}`); } };
const eq = (a, b, msg, tol = 1e-9) => ok(Math.abs(a - b) <= tol, `${msg}: got ${a}, want ${b}`);

function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---- unit checks ----
const apps2 = [{ name: 'Alphanote', aliases: [] }, { name: 'Betaplan', aliases: ['Betaplan Pro'] }];
ok(JSON.stringify(parseDirect('blah {"x":1} then {"Alphanote": 40, "betaplan": "12%"}', apps2)) === JSON.stringify({ Alphanote: 0.4, Betaplan: 0.12 }), 'parseDirect takes last JSON, case-insensitive keys, % sign');
ok(parseDirect('{"Alphanote": 40}', apps2) === null, 'parseDirect: missing app → null');
ok(parseDirect('{"Alphanote": 140, "Betaplan": 1}', apps2) === null, 'parseDirect: out of range → null');
ok(parseDirect('no json here', apps2) === null, 'parseDirect: no JSON → null');
eq(signTest([1, 1, 1, 1, 1, 1, 1, 1]).p, 1 / 256, 'signTest 8/8');
eq(signTest([1, 1, 1, 1, 1, 1, 1, -1]).p, 9 / 256, 'signTest 7/8');
eq(signTest([1, 0, -1]).n, 2, 'signTest drops ties');
ok(JSON.stringify(holm([0.01, 0.04, 0.03])) === JSON.stringify([0.03, 0.06, 0.06]), 'holm step-down with monotonicity');
{
  const rows = [
    { ok: true, prompt: 'q1', repeat: 1, text: 'Try Alphanote.' }, { ok: true, prompt: 'q1', repeat: 2, text: 'Nothing.' },
    { ok: true, prompt: 'q2', repeat: 1, text: 'Alphanote is good.' }, { ok: false, prompt: 'q2', repeat: 2, text: '' },
  ];
  eq(rateOverPrompts(rows, apps2[0]).rate, (0.5 + 1) / 2, 'rate = mean over prompts of per-prompt share; failed calls ignored');
  eq(rateOverPrompts(rows, apps2[0], { onlyPrompts: new Set(['q1']) }).rate, 1, 'M5 uses repeat 1 of the chosen prompts');
}

// ---- synthetic study ----
// 7 categories × 2 engines × 5 apps. Each prompt has its own probability around the app's true rate.
function synth({ seed, tBias = 0, eNoise = 0.2, eBias = 0, missingE = null }) {
  const rnd = mulberry32(seed);
  const cells = [];
  for (let c = 0; c < 7; c++) for (const engine of ['claude-search', 'codex-search']) {
    const apps = Array.from({ length: 5 }, (_, i) => ({ name: `App${String.fromCharCode(65 + c)}${String.fromCharCode(97 + i)}x`, aliases: [] }));
    const truth = apps.map(() => 0.1 + 0.8 * rnd());
    const promptP = (n) => Array.from({ length: n }, () => truth.map((p) => Math.min(1, Math.max(0, p + 0.25 * (rnd() - 0.5) * 2))));
    const answer = (ps, bias) => apps.filter((_, i) => rnd() < Math.min(1, Math.max(0, ps[i] + bias))).map((a) => a.name).join(', ') || 'none';
    const refRows = [], toolRows = [];
    promptP(100).forEach((ps, q) => refRows.push({ ok: true, prompt: `r${q}`, repeat: 1, text: answer(ps, 0) }));
    const toolP = promptP(100);
    toolP.forEach((ps, q) => { for (const rep of [1, 2]) toolRows.push({ ok: true, prompt: `t${q}`, repeat: rep, text: answer(ps, tBias) }); });
    const est = (noise, bias) => JSON.stringify(Object.fromEntries(apps.map((a, i) => [a.name, Math.round(100 * Math.min(1, Math.max(0, truth[i] + bias + noise * (rnd() - 0.5) * 2)))])));
    const isMissing = missingE && missingE.c === c && missingE.engine === engine;
    const E = [1, 2, 3].flatMap((call) => (isMissing && call === 1 ? [0, 1, 2].map((attempt) => ({ call, attempt, text: 'I cannot estimate that.' })) : [{ call, attempt: 0, text: est(eNoise, eBias) }]));
    const N = [1, 2, 3].map((call) => ({ call, attempt: 0, text: est(0.5, 0.1) }));
    cells.push({ id: `cat${c}`, engine, apps, refRows, toolRows, m5Prompts: ['t0', 't1', 't2', 't3', 't4'], direct: { E, N } });
  }
  return cells;
}

{ // A: T unbiased, E noisy (±20 pp) → C1 supported, reverse not.
  const res = analyse(synth({ seed: 1, eNoise: 0.4 }));
  const c1 = res.primary.find((t) => t.arm === 'E');
  ok(c1.supported, `A: T better → C1 supported (Holm p ${c1.pHolm}, Δ ${c1.effect.delta})`);
  ok(!res.reverse.find((t) => t.arm === 'E').supported, 'A: reverse C1 not supported');
  ok(res.primary.find((t) => t.arm === 'N').supported, 'A: naive (±50 pp, +10 bias) → C2 supported');
  ok(res.excluded.length === 0 && !res.underpowered, 'A: no exclusions');
}
{ // B: T systematically biased (+20 pp, e.g. an extractor that over-counts), E accurate (±2 pp) → C1 NOT supported, reverse supported.
  const res = analyse(synth({ seed: 2, tBias: 0.2, eNoise: 0.04 }));
  const c1 = res.primary.find((t) => t.arm === 'E');
  ok(!c1.supported, `B: rival better → C1 not supported (Holm p ${c1.pHolm}, Δ ${c1.effect.delta})`);
  ok(res.reverse.find((t) => t.arm === 'E').supported, 'B: reverse C1 supported (rival significantly closer)');
}
{ // C: one cluster's E call 1 never parses → that cluster's E is missing (not replaced by call 2), bounds differ.
  const cells = synth({ seed: 3, eNoise: 0.4, missingE: { c: 0, engine: 'claude-search' } });
  const res = analyse(cells);
  const per = res.primary.find((t) => t.arm === 'E').per;
  ok(per.length === 13 && !per.some((x) => x.id === 'cat0' && x.engine === 'claude-search'), `C: missing E cluster dropped from E contrasts (have ${per.length})`);
  ok(res.units.filter((u) => u.id === 'cat0' && u.engine === 'claude-search').every((u) => u.E === null && u.Emean !== null), 'C: call 1 missing → E null; calls 2–3 still feed the secondary mean');
  const worst = analyse(cells, { imputation: 'worst' }).primary.find((t) => t.arm === 'E').per;
  ok(worst.length === 14, 'C: worst-case imputation keeps all 14 clusters');
}
{ // D: data-quality exclusion (§7).
  const cells = synth({ seed: 4 });
  for (const c of cells.slice(0, 3)) c.refRows = c.refRows.slice(0, 80);
  const res = analyse(cells);
  ok(res.excluded.length === 3 && res.underpowered, 'D: 3 clusters under 90 reference prompts → excluded, underpowered');
}

console.log(`=== compare analyze selftest: PASS ${pass} / FAIL ${fail} ===`);
process.exitCode = fail ? 1 : 0;
