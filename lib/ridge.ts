// Ridge regression, same pipeline as Jo Ee's Python version (tokenguard-project/tokenguard/forecast.py):
// median imputation -> standard scaling -> Ridge(alpha) with an unpenalised intercept.
// Plain code, no dependency: solves (XᵀX + αI) w = Xᵀ(y - ȳ) on scaled features.

export type RidgeModel = { predict: (row: (number | null)[]) => number };

function solve(a: number[][], b: number[]): number[] {
  // Gaussian elimination with partial pivoting (matrix is small and positive definite).
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
    [m[col], m[pivot]] = [m[pivot], m[col]];
    for (let r = col + 1; r < n; r++) {
      const f = m[r][col] / m[col][col];
      for (let c = col; c <= n; c++) m[r][c] -= f * m[col][c];
    }
  }
  const w = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = m[r][n];
    for (let c = r + 1; c < n; c++) s -= m[r][c] * w[c];
    w[r] = s / m[r][r];
  }
  return w;
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function fitRidge(rows: (number | null)[][], y: number[], alpha = 1): RidgeModel {
  const k = rows[0].length;
  // Imputer: column medians from training rows (null = missing).
  const med = Array.from({ length: k }, (_, j) =>
    median(rows.map((r) => r[j]).filter((v): v is number => v !== null)),
  );
  const fill = (r: (number | null)[]) => r.map((v, j) => v ?? med[j]);
  const X = rows.map(fill);
  // Scaler: mean / population std; constant columns get std 1.
  const mu = Array.from({ length: k }, (_, j) => X.reduce((s, r) => s + r[j], 0) / X.length);
  const sd = Array.from({ length: k }, (_, j) => {
    const v = Math.sqrt(X.reduce((s, r) => s + (r[j] - mu[j]) ** 2, 0) / X.length);
    return v > 0 ? v : 1;
  });
  const Z = X.map((r) => r.map((v, j) => (v - mu[j]) / sd[j]));
  const yMean = y.reduce((s, v) => s + v, 0) / y.length;

  const A = Array.from({ length: k }, (_, i) =>
    Array.from({ length: k }, (_, j) => Z.reduce((s, r) => s + r[i] * r[j], 0) + (i === j ? alpha : 0)),
  );
  const b = Array.from({ length: k }, (_, i) => Z.reduce((s, r, n) => s + r[i] * (y[n] - yMean), 0));
  const w = solve(A, b);

  return {
    predict: (row) => fill(row).reduce((s, v, j) => s + ((v - mu[j]) / sd[j]) * w[j], yMean),
  };
}
