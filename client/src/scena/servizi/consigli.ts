// Suggerimenti in alto sulla scena (bozza scena.src.html, righe 2562–2580).
// Visti tutti, nelle partite dopo, su questo telefono, non compaiono più (finché non si chiede di rivederli).
// Il segno salvato è il numero di consigli visti: chi aveva il vecchio segno "1" (i due consigli di prima) vede una volta
// sola anche il terzo, alla prima domanda con carte da trascinare (prima, nel Guaio d'apertura, non avrebbe senso).
import { T } from '../../testi';

export const CONSIGLI: string[] = [T.scena.consigli.solleva, T.scena.consigli.leggi, T.scena.consigli.trascina];
const CHIAVE_CONSIGLI = 'hls-consigli-visti';
/** Il vecchio segno, quando i consigli erano due: valeva "visti tutti" e non diceva quanti. */
const VISTI_VECCHIO_SEGNO = 2;
/** Quanto resta in vista l'ultimo consiglio prima di sparire da solo. */
const ULTIMO_MS = 7000;

export interface Consigli {
  /** Quanti consigli sono già stati superati. */
  readonly passo: number;
  /** Il giocatore ha fatto il passo `fatto` (1 = primo, …): mostra il consiglio seguente. Non va mai indietro. */
  nascondi(fatto: number): void;
  giaVisti(): boolean;
  rivediSuggerimenti(): void;
  /** Da chiamare all'avvio: se i consigli sono già stati visti non si mostrano. */
  applicaGiaVisti(): void;
  /**
   * Una domanda ha carte da trascinare. Per chi aveva il vecchio segno il terzo consiglio aspetta questo momento: compare
   * (e parte il suo tempo) la prima volta, poi non fa più niente.
   */
  allaPrimaTrascinabile(): void;
  /** Toglie i timer in sospeso (distruggi). */
  ferma(): void;
}

interface Dati {
  elemento: HTMLElement;
  /** Vero mentre la partita sta distribuendo le carte: i suggerimenti aspettano. */
  bloccato?: () => boolean;
}

export function creaConsigli({ elemento, bloccato }: Dati): Consigli {
  let passo = 0;
  /** Il terzo consiglio di chi aveva il vecchio segno aspetta la prima carta da trascinare. */
  let aspettaTrascinabile = false;
  // Tempo vero (come la bozza): sono suggerimenti dell'interfaccia, non eventi della scena
  let timer: Array<ReturnType<typeof setTimeout>> = [];
  const ferma = () => {
    for (const id of timer) clearTimeout(id);
    timer = [];
  };
  /** Quanti consigli ha già visto chi gioca su questo telefono (0 se niente è salvato). */
  const quantiVisti = (): number => {
    try {
      const salvato = localStorage.getItem(CHIAVE_CONSIGLI);
      if (salvato === null) return 0;
      if (salvato === '1') return VISTI_VECCHIO_SEGNO;
      const n = Number(salvato);
      return Number.isInteger(n) && n > 0 ? Math.min(n, CONSIGLI.length) : 0;
    } catch {
      return 0;
    }
  };
  const giaVisti = (): boolean => quantiVisti() >= CONSIGLI.length;
  const c: Consigli = {
    get passo() {
      return passo;
    },
    nascondi(fatto) {
      if (bloccato?.() || fatto <= passo) return;
      passo = fatto;
      aspettaTrascinabile = false;
      ferma();
      elemento.style.opacity = '0';
      if (passo >= CONSIGLI.length) {
        try {
          localStorage.setItem(CHIAVE_CONSIGLI, String(CONSIGLI.length));
        } catch {
          /* non si salva */
        }
        return;
      }
      timer.push(
        setTimeout(() => {
          elemento.textContent = CONSIGLI[passo] ?? '';
          elemento.style.opacity = '1';
        }, 400),
      );
      if (passo === CONSIGLI.length - 1) timer.push(setTimeout(() => c.nascondi(CONSIGLI.length), ULTIMO_MS));
    },
    giaVisti,
    rivediSuggerimenti() {
      try {
        localStorage.removeItem(CHIAVE_CONSIGLI);
      } catch {
        /* non si salva */
      }
      ferma();
      passo = 0;
      aspettaTrascinabile = false;
      elemento.textContent = CONSIGLI[0] ?? '';
      elemento.style.opacity = '1';
    },
    applicaGiaVisti() {
      const visti = quantiVisti();
      if (visti === 0) return;
      if (visti < CONSIGLI.length) {
        // Chi ha visto i consigli di prima: da qui in poi solo quelli nuovi, nascosti finché non servono
        passo = visti;
        elemento.textContent = CONSIGLI[passo] ?? '';
        elemento.style.opacity = '0';
        aspettaTrascinabile = true;
        return;
      }
      passo = CONSIGLI.length;
      elemento.style.opacity = '0';
    },
    allaPrimaTrascinabile() {
      if (!aspettaTrascinabile) return;
      aspettaTrascinabile = false;
      elemento.style.opacity = '1';
      if (passo === CONSIGLI.length - 1) timer.push(setTimeout(() => c.nascondi(CONSIGLI.length), ULTIMO_MS));
    },
    ferma,
  };
  return c;
}
