// Accesso al servizio realtime ridotto al minimo indispensabile. Due implementazioni:
// Firebase Realtime Database (trasporto-firebase.ts) e una copia in memoria per i test (trasporto-memoria.ts).

export type Smetti = () => void;

export interface Trasporto {
  /** Identità anonima di questo dispositivo. */
  readonly uid: string;
  /** Lettura singola; null se il percorso non esiste. */
  leggi(percorso: string): Promise<unknown>;
  /** Scrive (o con null cancella) un percorso. */
  scrivi(percorso: string, valore: unknown): Promise<void>;
  /** Più scritture insieme, con percorsi relativi alla radice; null cancella. */
  aggiorna(valori: Record<string, unknown>): Promise<void>;
  /** Aggiunge un figlio con chiave cronologica e restituisce la chiave. */
  aggiungi(percorso: string, valore: unknown): Promise<string>;
  /** Avvisa a ogni cambiamento del percorso (null se non esiste). `errore` se la lettura non è permessa. */
  ascolta(percorso: string, cb: (valore: unknown) => void, errore?: (e: Error) => void): Smetti;
  /** Avvisa per ogni figlio già presente e per ogni figlio aggiunto dopo. */
  ascoltaFigli(percorso: string, cb: (chiave: string, valore: unknown) => void, errore?: (e: Error) => void): Smetti;
  /**
   * Segna questa connessione come presente: scrive `true` in un figlio di `percorso` con una chiave per connessione,
   * che il servizio toglie da solo alla disconnessione. Con più schede o dopo un cambio di rete ogni connessione ha
   * la sua chiave: chiudere la vecchia non cancella la presenza della nuova.
   */
  presente(percorso: string): Smetti;
  /** Avvisa quando questo dispositivo si collega o si scollega dal servizio. */
  connessione(cb: (online: boolean) => void): Smetti;
  /** Chiavi dei figli con valore numerico minore di `limite` (stanze inattive). */
  chiaviSotto(percorso: string, limite: number): Promise<string[]>;
  /** Millisecondi da aggiungere all'orologio locale per avere l'ora del servizio. */
  scartoOrologio(): number;
  chiudi(): void;
}

/** Ora del servizio realtime, uguale per tutti i dispositivi. */
export const oraServizio = (t: Trasporto): number => Date.now() + t.scartoOrologio();
