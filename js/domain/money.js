// Domain Layer: Money value helpers. All amounts are whole centavos (integers).
// Zero external dependencies (no DOM, no storage, no network).

export const toCentavos = (pesos) => Math.round(pesos * 100);

/** 1250 -> "12.50" */
export function formatAmount(c) {
  const sign = c < 0 ? '-' : '';
  const a = Math.abs(c);
  return `${sign}${Math.floor(a / 100)}.${String(a % 100).padStart(2, '0')}`;
}

export const formatPeso = (c) => '₱' + formatAmount(c);

export const sum = (arr) => arr.reduce((a, b) => a + b, 0);

/** Greedy breakdown into the given denominations (largest first). Returns null if impossible. */
export function breakdown(amount, denoms) {
  const sorted = [...denoms].sort((a, b) => b - a);
  const out = [];
  let left = amount;
  for (const d of sorted) {
    while (left >= d) { out.push(d); left -= d; }
  }
  return left === 0 ? out : null;
}
