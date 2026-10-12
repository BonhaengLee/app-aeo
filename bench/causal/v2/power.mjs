#!/usr/bin/env node
// Causal study v2 — simulated power of the primary test (app-level one-sided sign-flip) before any data.
// Generative model, shaped by v1 (near-deterministic picks; some apps never respond):
//   - U units spread evenly over A apps; a share Z of apps never responds;
//   - in a responding app, each unit responds with probability π / (1 − Z); a responding unit's true rate goes from
//     0 to q ~ Uniform(1/3, 1) under the edit; every other unit has rate p0 under both conditions;
//   - each (unit, condition) is observed with R binomial repeats.
// Realism added after the design review (2026-10-12):
//   - a share KNOWN of units already recommend the subject from prior knowledge, rate ~ U(0.3, 1) in both conditions;
//   - a share PUSH of units is pushed down: rate falls by 1/3 under the edit (displacement), floored at 0;
//   - judge attenuation: a named answer counts as recommended with probability J.
// Power = share of simulations with p < α (α = 0.025, the first Holm step for two hypotheses).
import { mulberry32 } from '../../../src/report.mjs';

export function simulate({ A, U = 400, Z = 0.4, pi, R = 2, p0 = 0.01, KNOWN = 0.15, PUSH = 0.03, J = 0.8, alpha = 0.025, sims = 400, B = 2000, seed = 1 }) {
  const rnd = mulberry32(seed);
  const binom = (n, p) => { let k = 0; for (let i = 0; i < n; i++) if (rnd() < p) k += 1; return k / n; };
  let hits = 0;
  for (let s = 0; s < sims; s++) {
    const means = [];
    for (let a = 0; a < A; a++) {
      const responsive = rnd() >= Z;
      const n = Math.floor(U / A) + (a < U % A ? 1 : 0);
      const ds = [];
      for (let u = 0; u < n; u++) {
        const base = rnd() < KNOWN ? 0.3 + rnd() * 0.7 : p0;
        const resp = responsive && rnd() < Math.min(1, pi / (1 - Z));
        const push = !resp && rnd() < PUSH;
        const q = resp ? Math.max(base, 1 / 3 + rnd() * (2 / 3)) : push ? Math.max(0, base - 1 / 3) : base;
        ds.push(binom(R, q * J) - binom(R, base * J));
      }
      if (n) means.push(ds.reduce((x, y) => x + y, 0) / n);
    }
    const xs = means.filter((x) => x !== 0);
    const obs = xs.reduce((x, y) => x + y, 0);
    let ge = 0;
    for (let b = 0; b < B; b++) { let t = 0; for (const x of xs) t += rnd() < 0.5 ? -Math.abs(x) : Math.abs(x); if (t >= obs - 1e-12) ge += 1; }
    if ((1 + ge) / (1 + B) < alpha) hits += 1;
  }
  return hits / sims;
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop());
if (isMain) {
  const rows = ['| Apps with units | π = 5% | 10% | 15% | 20% | 30% |', '|---:|---:|---:|---:|---:|---:|'];
  for (const A of [15, 25, 40, 50]) rows.push(`| ${A} | ${[0.05, 0.1, 0.15, 0.2, 0.3].map((pi) => `${Math.round(simulate({ A, pi }) * 100)}%`).join(' | ')} |`);
  console.log(rows.join('\n'));
}
