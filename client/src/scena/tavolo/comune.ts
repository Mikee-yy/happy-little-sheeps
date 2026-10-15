// Piccoli aiuti dei moduli del tavolo: caso stabile da un seme, dissolvenza e allineamento di elenchi di elementi.
import type { Contesto } from '../contesto';

/** Generatore a seme fisso (bozza scena.src.html, riga 726). */
export function rng(seme: number): () => number {
  return () => {
    seme |= 0;
    seme = (seme + 0x6d2b79f5) | 0;
    let t = Math.imul(seme ^ (seme >>> 15), 1 | seme);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Un numero dal testo (hash FNV-1a): "a caso ma stabile" per ogni id. */
export function semeDa(testo: string): number {
  let h = 2166136261;
  for (let i = 0; i < testo.length; i++) {
    h ^= testo.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Breve dissolvenza in entrata: le carte compaiono, non scattano. */
export function entra(ctx: Contesto, el: Element): void {
  ctx.anima(el, [{ opacity: 0 }, { opacity: 1 }], { duration: ctx.ridotto ? 1 : 240, easing: 'ease-out' });
}

export interface Voce {
  chiave: string;
  crea(): HTMLElement;
  /** Mette l'elemento al suo posto (`i` di `n`). */
  posa(el: HTMLElement, i: number, n: number): void;
}

/**
 * Mette in pari gli elementi con l'elenco: toglie quelli che non ci sono più, crea quelli nuovi
 * (con dissolvenza, salvo `subito`) e ricalcola la posizione di tutti.
 */
export function sincronizza(
  ctx: Contesto,
  contenitore: HTMLElement,
  presenti: Map<string, HTMLElement>,
  voci: Voce[],
  subito: boolean,
): void {
  const chiavi = new Set(voci.map((v) => v.chiave));
  for (const [chiave, el] of presenti) {
    if (chiavi.has(chiave)) continue;
    el.remove();
    presenti.delete(chiave);
  }
  voci.forEach((v, i) => {
    let el = presenti.get(v.chiave);
    if (!el) {
      el = v.crea();
      contenitore.appendChild(el);
      presenti.set(v.chiave, el);
      if (!subito) entra(ctx, el);
    }
    v.posa(el, i, voci.length);
  });
}

export function svuota(presenti: Map<string, HTMLElement>): void {
  for (const el of presenti.values()) el.remove();
  presenti.clear();
}
