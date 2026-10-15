// Aree degli agnellini: i recinti dei giocatori e il gregge (bozza scena.src.html, righe 1122–1124 e 1188–1210).
// Ogni area ha il nome del Luogo del motore (id del giocatore o 'gregge'). Qui sta anche l'unica definizione
// della prospettiva (`profondita`), usata dall'ambiente e, senza ambiente, dagli agnellini.
import type { IdGiocatore, Luogo } from '../../../../engine/src';
import type { Disposizione, Rett } from '../disposizioni';
import type { Agnello } from './agnello';

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export interface Area {
  nome: Luogo;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Infinity per il gregge. */
  posti: number;
  /** Assegnati, compresi quelli in viaggio verso quest'area. */
  agnelli: Agnello[];
  /** Arrivati: è il numero sul cartello. */
  mostrati: number;
  /** Zone da non calpestare (il cartello del gregge). */
  evita?: Rett[];
  /** L'area è nascosta dall'inquadratura: i suoi agnellini spariscono. */
  sfumata?: boolean;
  /** Forma del recinto (la imposta chi lo disegna); se c'è, la staccionata tiene dentro gli agnellini. */
  recinto?: unknown;
  recinto0?: unknown;
  area0?: Rett;
  cartello: HTMLElement | null;
}

/** Zona in cui cercare un punto libero: un'area o un suo pezzo (con `area` = l'area intera, per gli ostacoli). */
export interface Zona {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  agnelli: readonly { x: number; y: number; tx?: number; ty?: number }[];
  evita?: Rett[];
  area?: Zona;
}

export function creaArea(nome: Luogo, [x0, y0, x1, y1]: Rett, posti: number): Area {
  return { nome, x0, y0, x1, y1, posti, agnelli: [], mostrati: 0, cartello: null };
}

/** Le aree di una disposizione: i posti nello stesso ordine degli id (il primo è chi sta in basso), poi il gregge. */
export function creaAree(disp: Disposizione, ids: IdGiocatore[], postiOvile: number): Area[] {
  const aree = disp.posti.slice(0, ids.length).map((p, i) => creaArea(ids[i]!, p.area, postiOvile));
  const gregge = creaArea('gregge', disp.gregge.area, Infinity);
  gregge.evita = disp.gregge.evita;
  return [...aree, gregge];
}

/** La zona da evitare in cui cade il punto, se c'è (bozza, riga 1124). */
export const dentro = (a: { evita?: Rett[] }, x: number, y: number): Rett | undefined =>
  (a.evita || []).find(([x0, y0, x1, y1]) => x > x0 && x < x1 && y > y0 && y < y1);

/**
 * Prospettiva: gli agnellini lontani hanno la stessa proporzione della pecora del loro giocatore (bozza, riga 1190).
 * `prospettiva` = [y della fila degli avversari, scala della loro pecora]; senza disposizione la bozza usa [170, 0,5].
 */
export function profondita(y: number, prospettiva: readonly [number, number]): number {
  const [y0, k0] = prospettiva;
  return Math.max(k0, Math.min(1.02, k0 + ((y - y0) * (1 - k0)) / (610 - y0)));
}

/** Quanto è affollato il recinto: 0 fino al 70%, poi sale fino a 1 quando è pieno (bozza, riga 1191). */
export const agitazione = (a: Area): number => (a.posti === Infinity ? 0 : Math.max(0, (a.mostrati / a.posti - 0.7) / 0.3));

/** Il punto più lontano dagli altri agnellini su 30 tentativi, fuori dagli ostacoli (bozza, righe 1194–1204). */
export function puntoLibero(a: Zona, io: object | null, caso: () => number): { x: number; y: number } {
  const rand = (p: number, q: number) => p + caso() * (q - p);
  let migliore: { x: number; y: number } | null = null;
  let dist = -1;
  for (let i = 0; i < 30; i++) {
    const p = { x: rand(a.x0, a.x1), y: rand(a.y0, a.y1) };
    if (dentro(a, p.x, p.y) || (a.area && dentro(a.area, p.x, p.y))) continue;
    let d = 1e9;
    for (const o of a.agnelli) if (o !== io) d = Math.min(d, Math.hypot((o.tx ?? o.x) - p.x, ((o.ty ?? o.y) - p.y) * 1.6));
    if (d > dist) {
      dist = d;
      migliore = p;
    }
  }
  // Se ogni tentativo cadeva su un ostacolo, va bene il bordo di sotto dell'area
  const g = io as { x?: number } | null;
  return migliore || { x: clamp(g?.x ?? (a.x0 + a.x1) / 2, a.x0, a.x1), y: (a.area || a).y1 };
}

/** Un punto libero a non più di 50 px (25 in verticale) dall'agnellino, dentro la sua area (bozza, righe 1205–1209). */
export function vicinoLibero(ag: { x: number; y: number; a: Area }, caso: () => number): { x: number; y: number } {
  const a = ag.a;
  const r = 50;
  const sub: Zona = {
    x0: Math.max(a.x0, ag.x - r),
    x1: Math.min(a.x1, ag.x + r),
    y0: Math.max(a.y0, ag.y - r * 0.5),
    y1: Math.min(a.y1, ag.y + r * 0.5),
    agnelli: a.agnelli,
    area: a,
  };
  return puntoLibero(sub, ag, caso);
}
