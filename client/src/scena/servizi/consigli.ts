// Suggerimenti in alto sulla scena (bozza scena.src.html, righe 2562–2580).
// Visti tutti, nelle partite dopo, su questo telefono, non compaiono più (finché non si chiede di rivederli).
import { T } from '../../testi';

export const CONSIGLI: string[] = [T.scena.consigli.solleva, T.scena.consigli.leggi, T.scena.consigli.trascina];
const CHIAVE_CONSIGLI = 'hls-consigli-visti';

export interface Consigli {
  /** Quanti consigli sono già stati superati. */
  readonly passo: number;
  /** Il giocatore ha fatto il passo `fatto` (1 = primo, …): mostra il consiglio seguente. Non va mai indietro. */
  nascondi(fatto: number): void;
  giaVisti(): boolean;
  rivediSuggerimenti(): void;
  /** Da chiamare all'avvio: se i consigli sono già stati visti non si mostrano. */
  applicaGiaVisti(): void;
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
  // Tempo vero (come la bozza): sono suggerimenti dell'interfaccia, non eventi della scena
  let timer: Array<ReturnType<typeof setTimeout>> = [];
  const ferma = () => {
    for (const id of timer) clearTimeout(id);
    timer = [];
  };
  const giaVisti = (): boolean => {
    try {
      return localStorage.getItem(CHIAVE_CONSIGLI) === '1';
    } catch {
      return false;
    }
  };
  const c: Consigli = {
    get passo() {
      return passo;
    },
    nascondi(fatto) {
      if (bloccato?.() || fatto <= passo) return;
      passo = fatto;
      ferma();
      elemento.style.opacity = '0';
      if (passo >= CONSIGLI.length) {
        try {
          localStorage.setItem(CHIAVE_CONSIGLI, '1');
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
      if (passo === CONSIGLI.length - 1) timer.push(setTimeout(() => c.nascondi(CONSIGLI.length), 7000));
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
      elemento.textContent = CONSIGLI[0] ?? '';
      elemento.style.opacity = '1';
    },
    applicaGiaVisti() {
      if (!giaVisti()) return;
      passo = CONSIGLI.length;
      elemento.style.opacity = '0';
    },
    ferma,
  };
  return c;
}
