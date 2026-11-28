// Domain Layer: Spoken Filipino commuter number words (Salita ng Tsuper).
// Zero external dependencies (no DOM, no storage, no network).

export const ONES = ['', 'uno', 'dos', 'tres', 'kwatro', 'singko', 'sais', 'siyete', 'otso', 'nuwebe'];
export const TEENS = ['diyes', 'onse', 'dose', 'trese', 'katorse', 'kinse', 'disisais', 'disisiyete', 'disiotso', 'disinuwebe'];
export const TENS = ['', '', 'bente', 'trenta', 'kwarenta', 'singkwenta', 'sisenta', 'setenta', 'otsenta', 'nobenta'];
export const HUNDREDS = [
  '', 'sandaan', 'dalawang daan', 'tatlong daan', 'apat na raan', 'limang daan',
  'anim na raan', 'pitong daan', 'walong daan', 'siyam na raan',
];
export const SPECIAL = { 25: 'bayntsinko' };

/** Whole pesos (0–999) -> words, e.g. 14 -> "katorse", 35 -> "trentay singko". */
export function pesoWord(n) {
  if (!Number.isInteger(n) || n < 0 || n > 999) throw new RangeError(`pesoWord: ${n}`);
  if (n === 0) return 'sero';
  if (SPECIAL[n]) return SPECIAL[n];
  if (n >= 100) {
    const h = Math.floor(n / 100);
    const r = n % 100;
    return r ? `${HUNDREDS[h]} at ${pesoWord(r)}` : HUNDREDS[h];
  }
  if (n < 10) return ONES[n];
  if (n < 20) return TEENS[n - 10];
  const t = Math.floor(n / 10);
  const o = n % 10;
  if (!o) return TENS[t];
  return t === 2 ? `bente ${ONES[o]}` : `${TENS[t]}y ${ONES[o]}`;
}

/** Centavos -> words, e.g. 3750 -> "trentay siyete singkwenta". */
export function amountWord(centavos) {
  const p = Math.floor(centavos / 100);
  const c = centavos % 100;
  if (!c) return pesoWord(p);
  return p ? `${pesoWord(p)} ${pesoWord(c)}` : `${pesoWord(c)} sentimos`;
}

export const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
