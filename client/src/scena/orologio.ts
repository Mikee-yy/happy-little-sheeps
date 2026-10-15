// Orologio della scena (bozza scena.src.html, righe 361–384).
// I timer degli eventi seguono il tempo della scena, che può correre più veloce (animazioni veloci, salto).
// Avanza nel ciclo principale; niente setTimeout: con il ciclo manuale tutta la scena avanza a comando.

export interface OpzioniTimer {
  /** Solo decorazione: scatta come gli altri, ma non conta in `eventiInSospeso` (la regia lo ignora). */
  decorativo?: boolean;
}

interface Timer {
  quando: number;
  fn: () => void;
  /** Passo di ripetizione (solo per `ogni`). */
  ogni?: number;
  /** Timer di sola decorazione (stellina, cuore, belati dei giochi): non tiene "in corso" un evento. */
  decorativo?: boolean;
}

/** Al più 0,25 s reali per chiamata, come il movimento: al ritorno da un'altra scheda niente raffiche di timer. */
const MAX_AVANZAMENTO_MS = 250;

export class Orologio {
  /** Tempo della scena, in millisecondi. */
  ms = 0;
  velocita = 1;
  private timer = new Map<number, Timer>();
  private prossimo = 1;

  /** Stesso ordine degli argomenti di setTimeout. */
  dopo(fn: () => void, ms = 0, o: OpzioniTimer = {}): number {
    const id = this.prossimo++;
    this.timer.set(id, { quando: this.ms + Math.max(0, ms), fn, decorativo: o.decorativo });
    return id;
  }

  /** Come setInterval, con passo minimo di 4 ms. */
  ogni(fn: () => void, ms: number, o: OpzioniTimer = {}): number {
    const id = this.prossimo++;
    const passo = Math.max(4, ms);
    this.timer.set(id, { quando: this.ms + passo, fn, ogni: passo, decorativo: o.decorativo });
    return id;
  }

  annulla(id: number): void {
    this.timer.delete(id);
  }

  attesa(ms: number): Promise<void> {
    return new Promise((risolvi) => {
      this.dopo(risolvi, ms);
    });
  }

  /** Fa avanzare la scena di `msReali` × velocità (al massimo 250 ms reali), eseguendo i timer in ordine. */
  avanza(msReali: number): void {
    const fine = this.ms + Math.min(Math.max(msReali, 0), MAX_AVANZAMENTO_MS) * this.velocita;
    for (;;) {
      let scelto: Timer | null = null;
      let idScelto = 0;
      for (const [id, t] of this.timer) {
        if (t.quando <= fine && (!scelto || t.quando < scelto.quando)) {
          scelto = t;
          idScelto = id;
        }
      }
      if (!scelto) break;
      this.ms = Math.max(this.ms, scelto.quando);
      if (scelto.ogni) scelto.quando += scelto.ogni;
      else this.timer.delete(idScelto);
      try {
        scelto.fn();
      } catch (e) {
        console.error(e);
      }
    }
    this.ms = fine;
  }

  /** Timer ancora da eseguire. */
  inSospeso(): number {
    return this.timer.size;
  }

  /** Timer ancora da eseguire che non sono di sola decorazione: quelli che la regia conta come evento in corso. */
  eventiInSospeso(): number {
    let n = 0;
    for (const t of this.timer.values()) if (!t.decorativo) n++;
    return n;
  }

  /** Toglie tutti i timer (nuova partita, distruggi). */
  svuota(): void {
    this.timer.clear();
  }
}
