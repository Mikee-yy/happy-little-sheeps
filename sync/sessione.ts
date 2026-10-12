// Interfaccia unica tra interfaccia grafica e partita (brief §6): implementazione locale (un dispositivo)
// e, dalla fase 4, realtime. L'interfaccia vede solo viste filtrate e azioni valide, mai lo stato completo.
import type { Azione, IdGiocatore, Vista } from '../engine/src';

export type EsitoInvio = { ok: true } | { ok: false; codice: string; messaggio: string };

export interface Sessione {
  readonly modo: 'locale' | 'realtime';
  /** Vista della partita per un giocatore, o per il tavolo (null). */
  vista(per: IdGiocatore | null): Vista;
  /** Azioni valide adesso per un giocatore o per il sistema. */
  azioni(per: IdGiocatore | 'sistema'): Azione[];
  invia(azione: Azione): EsitoInvio;
  /** Avvisa a ogni cambiamento; restituisce la funzione per smettere di ascoltare. */
  ascolta(cb: () => void): () => void;
}
