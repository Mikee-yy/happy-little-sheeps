// Partita di prova: tu contro due bot su questo dispositivo. I bot muovono da soli dopo una pausa,
// le fasi di sistema aspettano il "Continua" dell'umano, e niente viene salvato.
import { azioniPossibili, inAttesaDi, nuovaPartita, PROVA, tentaApplica, vistaPer } from '../engine/src';
import type { Azione, IdGiocatore, Stato, Vista } from '../engine/src';
import { semplice } from '../engine/sim/politiche';
import { esitoTestataCasuale } from '../engine/sim/simulatore';
import { casuale } from '../engine/src/rng';
import type { EsitoInvio, Sessione } from './sessione';

const PAUSA_BOT_MS = 1000;
// Seme fisso: la storia dei tre round guidati è sempre quella controllata da engine/test/prova.test.ts
const SEME_PROVA = 7;
const SEME_BOT = 1;


export interface OpzioniProva {
  seme?: number;
  casuale?: () => number;
  pausaMs?: number;
  temporizzatore?: (fn: () => void, ms: number) => unknown;
  annulla?: (id: unknown) => void;
}

export class SessioneProva implements Sessione {
  readonly modo = 'prova' as const;
  readonly umano: IdGiocatore = 'g1';
  private stato: Stato;
  private readonly ascoltatori = new Set<() => void>();
  private readonly casuale: () => number;
  private readonly pausaMs: number;
  private readonly temporizzatore: (fn: () => void, ms: number) => unknown;
  private readonly annullaTimer: (id: unknown) => void;
  private timerBot: unknown = null;
  private chiusa = false;
  /** La scena sta recitando: i bot aspettano che finisca. */
  private inPausa = false;

  private constructor(o: OpzioniProva) {
    const seme = o.seme ?? SEME_PROVA;
    this.stato = nuovaPartita({ giocatori: PROVA.giocatori, seme, preparazione: PROVA.preparazione });
    const generatoreBot = { rng: SEME_BOT };
    this.casuale = o.casuale ?? (() => casuale(generatoreBot));
    this.pausaMs = o.pausaMs ?? PAUSA_BOT_MS;
    this.temporizzatore = o.temporizzatore ?? ((fn, ms) => setTimeout(fn, ms));
    this.annullaTimer = o.annulla ?? ((id) => clearTimeout(id as ReturnType<typeof setTimeout>));
  }

  static nuova(o: OpzioniProva = {}): SessioneProva {
    const s = new SessioneProva(o);
    s.pianificaBot();
    return s;
  }

  vista(per: IdGiocatore | null): Vista {
    return vistaPer(this.stato, per);
  }

  azioni(per: IdGiocatore | 'sistema'): Azione[] {
    return azioniPossibili(this.stato, per);
  }

  invia(azione: Azione): EsitoInvio {
    const r = tentaApplica(this.stato, azione);
    if (!r.ok) return { ok: false, codice: r.errore.codice, messaggio: r.errore.message };
    this.stato = r.stato;
    for (const cb of this.ascoltatori) cb();
    this.pianificaBot();
    return { ok: true };
  }

  ascolta(cb: () => void): () => void {
    this.ascoltatori.add(cb);
    return () => this.ascoltatori.delete(cb);
  }

  /** Riprende a far muovere i bot (anche dopo un chiudi: in sviluppo React chiude e riapre la schermata all'avvio). */
  avvia(): void {
    this.chiusa = false;
    this.pianificaBot();
  }

  /** Uscendo dalla prova i bot smettono di muovere. */
  chiudi(): void {
    this.chiusa = true;
    if (this.timerBot !== null) this.annullaTimer(this.timerBot);
    this.timerBot = null;
  }

  /**
   * Con `true` (la scena recita) la mossa del bot in sospeso si annulla e non se ne pianificano altre;
   * con `false` il prossimo bot muove dopo la solita pausa. Ripetere lo stesso valore non cambia niente
   * (una mossa già pianificata non riparte da capo).
   */
  pausa(attiva: boolean): void {
    if (attiva === this.inPausa) return;
    this.inPausa = attiva;
    this.pianificaBot();
  }

  /** Il primo bot in attesa muove dopo la pausa; l'umano e le fasi di sistema si aspettano. */
  private pianificaBot(): void {
    if (this.timerBot !== null) this.annullaTimer(this.timerBot);
    this.timerBot = null;
    if (this.chiusa || this.inPausa || this.stato.esito) return;
    const bot = inAttesaDi(this.stato).giocatori.find((id) => id !== this.umano);
    if (bot) this.timerBot = this.temporizzatore(() => this.mossaBot(bot), this.pausaMs);
  }

  /** Come i bot delle stanze (sync/host.ts): Testata a caso, altrimenti la strategia "semplice". */
  private mossaBot(id: IdGiocatore): void {
    this.timerBot = null;
    if (this.chiusa || this.inPausa) return;
    const azioni = azioniPossibili(this.stato, id);
    if (azioni.length === 0) return;
    const testate = azioni.filter((a) => a.tipo === 'esitoTestata');
    let azione: Azione;
    if (testate.length > 0) {
      const massimo = Math.max(...testate.map((a) => (a.tipo === 'esitoTestata' ? a.esito : 0)));
      azione = { tipo: 'esitoTestata', giocatore: id, esito: esitoTestataCasuale(massimo, this.casuale) };
    } else {
      azione = semplice.scegli(this.stato, id, azioni, this.casuale);
      if (!tentaApplica(this.stato, azione).ok) azione = azioni[Math.floor(this.casuale() * azioni.length)]!;
    }
    this.invia(azione);
  }
}
