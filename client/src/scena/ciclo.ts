// Il ciclo di animazione della scena (bozza scena.src.html, righe 1510–1547 e 2709).
// Unico posto della scena che usa requestAnimationFrame e performance.now. In automatico segue i fotogrammi del browser;
// in manuale (prove, pagina di sviluppo) fa avanzare la scena a comando, in passi da 33 ms, con lo stesso corpo.
import type { Contesto } from './contesto';

export interface OpzioniCiclo {
  modo: 'automatico' | 'manuale';
  /** Un passo della scena di `dt` secondi (al più 50 ms di scena); `ora` è l'istante del fotogramma in millisecondi. */
  passoScena(dt: number, ora: number): void;
  /** Dopo i passi di ogni fotogramma (i fumetti). */
  dopoFotogramma?(): void;
  /**
   * Un fotogramma ha lanciato (la prima volta di una serie): il ciclo continua comunque. Chi lo riceve rimette la scena in pari,
   * perché il fotogramma può essersi fermato a metà.
   */
  onErrore?(errore: unknown): void;
}

export interface Ciclo {
  /** L'istante del ciclo in millisecondi: quello dei fotogrammi (automatico) o quello accumulato (manuale). */
  ora(): number;
  /** Solo in manuale: esegue fotogrammi da 33 ms finché non ha consumato `ms`. */
  avanza(ms: number): void;
  /**
   * Solo in automatico: con `true` non chiede più fotogrammi (scena nascosta, niente consumo); con `false` riparte da adesso,
   * senza contare il tempo passato da sospesa. Orologio e scena restano dov'erano.
   */
  sospendi(sospeso: boolean): void;
  ferma(): void;
}

/** Fotogramma del ciclo manuale, in millisecondi. */
const PASSO_MANUALE_MS = 33;

type Globale = Record<string, any>;
const g = (): Globale => globalThis as unknown as Globale;
const adesso = (): number => (typeof g().performance?.now === 'function' ? g().performance.now() : Date.now());

export function creaCiclo(ctx: Contesto, o: OpzioniCiclo): Ciclo {
  const { orologio, regia, risparmio } = ctx;
  const automatico = o.modo === 'automatico';
  let fermo = false;
  let sospeso = false;
  let richiesta: number | null = null;
  let ultimo = automatico ? adesso() : 0;
  let oraManuale = 0;
  /** Una serie di fotogrammi rotti si scrive in console una volta sola; un fotogramma buono la chiude. */
  let inErrore = false;

  // Senza requestAnimationFrame (ambienti senza pagina) si ripiega su un timer da 16 ms
  const chiedi = (cb: (ora: number) => void): number => {
    const raf = g().requestAnimationFrame as ((cb: FrameRequestCallback) => number) | undefined;
    if (typeof raf === 'function') return raf(cb);
    return setTimeout(() => cb(adesso()), 16) as unknown as number;
  };
  const annulla = (id: number): void => {
    const caf = g().cancelAnimationFrame as ((id: number) => void) | undefined;
    if (typeof caf === 'function') caf(id);
    else clearTimeout(id);
  };

  /** Il corpo di un fotogramma (bozza, righe 1513–1534). */
  function fotogramma(ora: number, dtArrivato: number): void {
    let dtReale = dtArrivato;
    // Riposo: dopo 20 s senza tocchi né eventi lo sfondo si aggiorna al massimo 20 volte al secondo
    risparmio.valutaRiposo(ora, regia.eventoInCorso());
    risparmio.misuraFluidita(ora, dtReale);
    if (risparmio.riposo) {
      risparmio.accumulo += dtReale;
      if (risparmio.accumulo < 0.05) return;
      dtReale = risparmio.accumulo;
    }
    risparmio.accumulo = 0;
    ctx.impostaVelocita(regia.velocita());
    orologio.avanza(dtReale * 1000);
    // Fino a 0,25 s per fotogramma (come l'orologio), in passi di al massimo 50 ms: più passi se la scena corre o il telefono è lento.
    // A riposo un passo solo: è proprio quello che fa risparmiare
    const dtScena = Math.min(0.25, dtReale) * orologio.velocita;
    const passi = risparmio.riposo ? 1 : Math.max(1, Math.ceil(dtScena / 0.05 - 1e-9));
    for (let i = 0; i < passi; i++) o.passoScena(dtScena / passi, ora);
    o.dopoFotogramma?.();
    // Finiti gli eventi il salto si spegne da solo
    if (regia.salto && !regia.eventoInCorso()) regia.salto = false;
  }

  /** Un fotogramma che lancia non deve fermare la scena: l'errore si scrive una volta e il ciclo prosegue. */
  function protetto(ora: number, dt: number): void {
    try {
      fotogramma(ora, dt);
      inErrore = false;
    } catch (e) {
      if (inErrore) return;
      inErrore = true;
      console.error(e);
      try {
        o.onErrore?.(e);
      } catch (e2) {
        console.error(e2);
      }
    }
  }

  function ciclo(ora: number): void {
    richiesta = null;
    if (fermo || sospeso) return;
    // Il tempo non torna mai indietro: al ritorno da un'altra scheda il browser può dare un istante precedente all'ultimo
    const dtReale = Math.max(0, (ora - ultimo) / 1000);
    ultimo = Math.max(ultimo, ora);
    protetto(ora, dtReale);
    if (!fermo) richiesta = chiedi(ciclo);
  }

  // Al ritorno sulla pagina il prossimo fotogramma riparte da adesso (bozza, riga 2709)
  const visibilita = (): void => {
    ultimo = adesso();
  };

  if (automatico) {
    risparmio.tocco(ultimo);
    document.addEventListener('visibilitychange', visibilita);
    richiesta = chiedi(ciclo);
  } else risparmio.tocco(0);

  return {
    ora: () => (automatico ? adesso() : oraManuale),
    avanza(ms) {
      if (automatico || fermo) return;
      let resto = ms;
      while (resto > 0 && !fermo) {
        const passo = Math.min(PASSO_MANUALE_MS, resto);
        resto -= passo;
        oraManuale += passo;
        protetto(oraManuale, passo / 1000);
      }
    },
    sospendi(si) {
      if (!automatico || fermo || si === sospeso) return;
      sospeso = si;
      if (si) {
        if (richiesta !== null) annulla(richiesta);
        richiesta = null;
      } else {
        ultimo = adesso();
        richiesta = chiedi(ciclo);
      }
    },
    ferma() {
      if (fermo) return;
      fermo = true;
      if (richiesta !== null) annulla(richiesta);
      richiesta = null;
      if (automatico) document.removeEventListener('visibilitychange', visibilita);
    },
  };
}
