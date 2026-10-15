// Misure della scena (bozza scena.src.html, righe 325 e 335–359).

/** Riquadro logico della scena in verticale. */
export const W = 390;
export const H = 844;

/**
 * S: il prato si rimpicciolisce per starci tutto. D: mano, pulsanti, fumetti e lettura seguono la larghezza dello schermo,
 * mai più piccoli del prato e al massimo un quarto più grandi (per lo schermo girato). KD = D / S è l'ingrandimento in più.
 */
export function misuraDito(w: number, h: number): { S: number; D: number } {
  const s = Math.min(w / W, h / H);
  return { S: s, D: Math.max(s, Math.min(w / W, 1.25 * s)) };
}

/** Punto della mano (che sta ingrandita di KD attorno al centro in basso) portato nella scena. */
export function manoInScena<T extends { x: number; y: number; k: number }>(p: T, KD: number): T {
  return { ...p, x: 195 + (p.x - 195) * KD, y: H + (p.y - H) * KD, k: p.k * KD };
}

/** Punto della scena portato nella mano. */
export function scenaInMano<T extends { x: number; y: number }>(p: T, KD: number): T {
  return { ...p, x: 195 + (p.x - 195) / KD, y: H + (p.y - H) / KD };
}
