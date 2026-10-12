// Generatore casuale con seme (mulberry32). Lo stato è un uint32 conservato in `stato.rng`.

export interface ConRng {
  rng: number;
}

/** Numero in [0, 1); fa avanzare `s.rng`. */
export function casuale(s: ConRng): number {
  const a = (s.rng + 0x6d2b79f5) >>> 0;
  s.rng = a;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Intero in [0, n). */
export function intero(s: ConRng, n: number): number {
  return Math.floor(casuale(s) * n);
}

/** Fisher–Yates sul posto. */
export function mescola<T>(s: ConRng, elementi: T[]): void {
  for (let i = elementi.length - 1; i > 0; i--) {
    const j = intero(s, i + 1);
    const tmp = elementi[i] as T;
    elementi[i] = elementi[j] as T;
    elementi[j] = tmp;
  }
}
