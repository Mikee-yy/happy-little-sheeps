// Lo spazio di ogni targa (e dei suoi segnalini), calcolato dalla disposizione: con nomi lunghi la targa non esce dalla
// scena e non va sopra le targhe o le pecore vicine. Ogni targa ha una fascia orizzontale tutta sua: tra il bordo della
// scena (con un margine) o la metà della distanza dalla targa vicina, e mai sopra le pecore degli altri della stessa fila.
// La targa resta centrata sul suo posto finché può; se è larga e il posto è vicino a un bordo, scivola dentro la fascia.
// Lo scivolamento lo fa il CSS con clamp() (le percentuali di translate sono la larghezza della targa stessa), così la
// targa non va misurata; `scostamento` è la stessa formula, per le prove.
import type { Disposizione } from '../disposizioni';

/** Larghezza del riquadro logico della scena. */
export const LARGHEZZA_SCENA = 390;
/** Distanza minima dai bordi della scena. */
export const MARGINE = 4;
/** Distanza minima tra due targhe vicine, o tra una targa e la pecora di un altro. */
export const STACCO = 6;
/** La targa più larga, anche quando c'è più spazio. */
export const LARGHEZZA_MASSIMA = 112;
/** Due targhe sono nella stessa fila se le loro altezze differiscono meno di così. */
const STESSA_FILA = 40;
/** Stima della larghezza di una lettera della targa col carattere normale (11 px, maiuscolo, spaziato) e del contorno. */
const PX_PER_LETTERA = 8.5;
const PX_CONTORNO = 22;

export interface SpazioTarga {
  /** Dove sta il centro della targa (il suo posto). */
  x: number;
  /** La fascia in cui la targa deve restare. */
  sinistra: number;
  destra: number;
  /** La larghezza massima della targa (oltre, ellissi). */
  larghezza: number;
}

/** Le fasce delle targhe, per posto (stesso ordine di `disp.posti`). */
export function spaziTarghe(disp: Disposizione): SpazioTarga[] {
  const posti = disp.posti;
  return posti.map((p, i) => {
    const [x, y] = p.targa;
    let sinistra = MARGINE;
    let destra = LARGHEZZA_SCENA - MARGINE;
    posti.forEach((q, j) => {
      if (j === i || Math.abs(q.targa[1] - y) >= STESSA_FILA) return;
      const [qx] = q.targa;
      if (qx < x) {
        sinistra = Math.max(sinistra, (qx + x) / 2 + STACCO / 2, q.x + q.w + STACCO);
      } else {
        destra = Math.min(destra, (qx + x) / 2 - STACCO / 2, q.x - STACCO);
      }
    });
    sinistra = Math.ceil(sinistra);
    destra = Math.floor(destra);
    return { x, sinistra, destra, larghezza: Math.min(LARGHEZZA_MASSIMA, destra - sinistra) };
  });
}

/** Di quanto si sposta il bordo sinistro della targa rispetto al suo posto, per una targa larga `w` (come il clamp() del CSS). */
export function scostamento(s: SpazioTarga, w: number): number {
  return Math.max(s.sinistra - s.x, Math.min(-w / 2, s.destra - s.x - w));
}

function scivola(s: SpazioTarga): string {
  return `clamp(${s.sinistra - s.x}px, -50%, calc(${s.destra - s.x}px - 100%))`;
}

/** Stile orizzontale della targa: posto, larghezza massima e scivolamento dentro la fascia. */
export function stileTarga(s: SpazioTarga): string {
  return `left:${s.x}px;max-width:${s.larghezza}px;transform:translateX(${scivola(s)})`;
}

/** Stile orizzontale dei segnalini: la stessa fascia della targa, sopra di lei. */
export function stileSegnalini(s: SpazioTarga): string {
  return `left:${s.x}px;max-width:${s.larghezza}px;transform:translate(${scivola(s)}, -100%)`;
}

/**
 * Il nome non ci sta nella fascia col carattere normale: carattere più piccolo sulla targa. Si guarda solo il nome
 * (il suffisso "· eliminata" non rimpicciolisce un nome corto: al più va in ellissi). La misura è una stima (niente DOM).
 */
export function nomeLungo(nome: string, larghezza: number): boolean {
  return nome.length * PX_PER_LETTERA + PX_CONTORNO > larghezza;
}
