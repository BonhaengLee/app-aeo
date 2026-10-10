// Power of the cluster sign test (one-sided, Holm-adjusted smallest p must be < 0.05/3) for T vs a rival X.
// Unit errors: T ~ N(0, sT), R ~ N(0, sR) independent, X ~ N(b_k, sX) with cluster-level bias b_k ~ N(0, tau).
let seed = 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const norm = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const binomTail = (k, n) => { let s = 0; for (let i = k; i <= n; i++) { let c = 1; for (let j = 0; j < i; j++) c = c * (n - j) / (j + 1); s += c; } return s / 2 ** n; };
function power(K, sX, tau, alpha, sT = 0.045, sR = 0.055, apps = 5, sims = 4000) {
  let hit = 0;
  for (let s = 0; s < sims; s++) {
    let pos = 0;
    for (let k = 0; k < K; k++) {
      const b = tau * norm(); let d = 0;
      for (let a = 0; a < apps; a++) { const r = sR * norm(); const t = sT * norm() - r; const x = b + sX * norm() - r; d += x * x - t * t; }
      if (d > 0) pos++;
    }
    if (binomTail(pos, K) < alpha) hit++;
  }
  return hit / sims;
}
for (const K of [8, 12, 14]) for (const [sX, tau] of [[0.07, 0.03], [0.10, 0.05], [0.15, 0.08], [0.20, 0.10]])
  console.log(`K=${K} rivalRMSE≈${Math.sqrt(sX*sX+tau*tau).toFixed(2)} power(α=.0167)=${power(K, sX, tau, 0.0167).toFixed(2)} power(α=.05)=${power(K, sX, tau, 0.05).toFixed(2)}`);
