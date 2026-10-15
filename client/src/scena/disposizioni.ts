// Disposizioni: dove stanno i giocatori, per numero di giocatori (bozza scena.src.html, righe 1076–1119 e 1812).
// Tutte le misure sono nel riquadro logico della scena (390×844 in verticale). I dati stanno in disposizioni.json:
// il posto 0 è quello in basso, poi gli avversari da sinistra a destra. Agnellini, nomi e mani vengono dalla partita.
import dati from './disposizioni.json';

/** Rettangolo: x0, y0, x1, y1. */
export type Rett = [number, number, number, number];

export interface PostoDisp {
  x: number;
  y: number;
  w: number;
  targa: [number, number];
  fumetto: [number, number];
  /** x, yDietro, yDavanti, larghezza, k */
  recinto: [number, number, number, number, number];
  area: Rett;
  guai: [number, number];
  /** Solo avversari. */
  tappetino?: [number, number, number, number];
  ventaglio?: [number, number];
  specchia?: boolean;
}

export interface Disposizione {
  /** 0 = in basso, poi gli avversari da sinistra a destra. */
  posti: PostoDisp[];
  gregge: { area: Rett; evita: Rett[]; cartello: [number, number] };
  liberoDaPiante: Rett[];
  prospettiva: [number, number];
}

const DISPOSIZIONI = dati as unknown as Record<'2' | '3' | '4', Disposizione>;

/** Sostituzioni parziali di una disposizione: i posti per indice (solo i campi detti), il resto per intero. */
export type Sostituzioni = Partial<Omit<Disposizione, 'posti'>> & { posti?: Record<string, Partial<PostoDisp>> };

/** Variante dei recinti da provare nella pagina di sviluppo (sviluppo/varianti.json): sostituzioni per numero di giocatori. */
export interface Variante {
  nome: string;
  '2'?: Sostituzioni;
  '3'?: Sostituzioni;
  '4'?: Sostituzioni;
}

/** Una disposizione nuova con le sostituzioni applicate (la base non cambia). */
export function conSostituzioni(base: Disposizione, s: Sostituzioni): Disposizione {
  const { posti, ...resto } = s;
  return {
    ...base,
    ...resto,
    posti: base.posti.map((p, i) => ({ ...p, ...(posti?.[String(i)] ?? {}) })),
  };
}

// Solo per la pagina di sviluppo: finché l'utente non sceglie, la variante in prova sostituisce la base
let variante: Variante | null = null;
const conVariante = new Map<'2' | '3' | '4', Disposizione>();

/** Mette in prova una variante (null = base). I teatri la vedono alla ricostruzione successiva. */
export function usaVariante(v: Variante | null): void {
  variante = v;
  conVariante.clear();
}

/** Sempre lo stesso oggetto per lo stesso numero di giocatori (il teatro lo confronta per sapere se è cambiata). */
export function disposizione(n: 2 | 3 | 4): Disposizione {
  const k = String(n) as '2' | '3' | '4';
  const s = variante?.[k];
  if (!s) return DISPOSIZIONI[k];
  let d = conVariante.get(k);
  if (!d) {
    d = conSostituzioni(DISPOSIZIONI[k], s);
    conVariante.set(k, d);
  }
  return d;
}
