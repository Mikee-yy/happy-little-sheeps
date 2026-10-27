// Sessione su un solo dispositivo ("Passa il telefono"): nessun servizio esterno, salvataggio automatico nel browser.
import { azioniPossibili, configPer, nuovaPartita, tentaApplica, vistaPer } from '../engine/src';
import type { Azione, IdGiocatore, IdPecora, Stato, Vista } from '../engine/src';
import type { EsitoInvio, Sessione } from './sessione';

const VERSIONE_SALVATAGGIO = 1;

/**
 * Le partite salvate da una versione precedente portano con sé le regole di eliminazione di allora (D46 le ha
 * cambiate): alla ripresa si rimettono quelle di setup.json, così la partita segue le Regole che si leggono.
 * L'eliminazione si controlla solo quando si prende un Guaio, quindi nessuno esce di colpo alla ripresa.
 */
export function aggiornaSalvato(stato: Stato): Stato {
  return {
    ...stato,
    config: { ...stato.config, regoleEliminazione: configPer(stato.config.numeroGiocatori).regoleEliminazione },
  };
}

/** Dove si salva la partita. Nel browser è localStorage; nei test un oggetto in memoria. */
export interface Archivio {
  leggi(): string | null;
  scrivi(valore: string): void;
  cancella(): void;
}

/** localStorage può mancare o lanciare (navigazione privata, dati bloccati): in quel caso non si salva. */
export function archivioBrowser(chiave = 'hls-partita-locale'): Archivio {
  return {
    leggi: () => {
      try {
        return globalThis.localStorage?.getItem(chiave) ?? null;
      } catch {
        return null;
      }
    },
    scrivi: (valore) => {
      try {
        globalThis.localStorage?.setItem(chiave, valore);
      } catch {
        // Salvataggio non disponibile: la partita continua lo stesso.
      }
    },
    cancella: () => {
      try {
        globalThis.localStorage?.removeItem(chiave);
      } catch {
        // Niente da fare.
      }
    },
  };
}

export function archivioInMemoria(): Archivio {
  let valore: string | null = null;
  return {
    leggi: () => valore,
    scrivi: (v) => {
      valore = v;
    },
    cancella: () => {
      valore = null;
    },
  };
}

export interface GiocatoreLocale {
  id: IdGiocatore;
  nome: string;
  pecora: IdPecora;
}

export class SessioneLocale implements Sessione {
  readonly modo = 'locale' as const;
  private stato: Stato;
  private readonly ascoltatori = new Set<() => void>();
  private readonly archivio: Archivio;

  private constructor(stato: Stato, archivio: Archivio) {
    this.stato = stato;
    this.archivio = archivio;
  }

  static nuova(giocatori: GiocatoreLocale[], seme: number, archivio: Archivio): SessioneLocale {
    const s = new SessioneLocale(nuovaPartita({ giocatori, seme }), archivio);
    s.salva();
    return s;
  }

  /** Riprende la partita salvata, se c'è ed è leggibile; altrimenti null. */
  static riprendi(archivio: Archivio): SessioneLocale | null {
    const testo = archivio.leggi();
    if (!testo) return null;
    try {
      const dati = JSON.parse(testo) as { versione?: number; stato?: Stato };
      if (dati.versione !== VERSIONE_SALVATAGGIO || !dati.stato) return null;
      // La vista fallisce se lo stato salvato non è più compatibile con il motore.
      const stato = aggiornaSalvato(dati.stato);
      vistaPer(stato, null);
      return new SessioneLocale(stato, archivio);
    } catch {
      return null;
    }
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
    this.salva();
    for (const cb of this.ascoltatori) cb();
    return { ok: true };
  }

  ascolta(cb: () => void): () => void {
    this.ascoltatori.add(cb);
    return () => this.ascoltatori.delete(cb);
  }

  /** Finita la partita il salvataggio non serve più. */
  dimentica(): void {
    this.archivio.cancella();
  }

  private salva(): void {
    if (this.stato.esito) {
      this.archivio.cancella();
      return;
    }
    this.archivio.scrivi(JSON.stringify({ versione: VERSIONE_SALVATAGGIO, stato: this.stato }));
  }
}
