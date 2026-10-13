// Formato di una stanza nel database realtime. Le regole di accesso (database.rules.json) seguono questi percorsi:
//
//   stanze/{codice}/meta              { host: uid, creata }              host scrive, tutti i connessi leggono
//   stanze/{codice}/membri/{g}        uid del giocatore g                host scrive, tutti i connessi leggono
//   stanze/{codice}/pubblico          Pubblico (testo JSON)              host scrive, tutti i connessi leggono
//   stanze/{codice}/viste/{g}         VistaPrivata (testo JSON)          host scrive, solo il giocatore g legge
//   stanze/{codice}/ingressi/{uid}    Ingresso                           solo quel dispositivo scrive, host legge
//   stanze/{codice}/azioni/{chiave}   AzioneInviata                      chi invia crea con il proprio uid, host legge e cancella
//   stanze/{codice}/rifiuti/{uid}     Rifiuto                            host scrive, solo quel dispositivo legge
//   stanze/{codice}/presenza/{uid}/{connessione}   true finché quella connessione è attiva
//   attivita/{codice}                 ora dell'ultima scrittura dell'host: le stanze ferme da 24 ore si cancellano
import type { Azione, IdGiocatore, IdPecora, Vista } from '../engine/src';

export const MASSIMO_GIOCATORI = 4;
export const ORE_INATTIVITA = 24;
/** Eventi tenuti nelle viste pubblicate: bastano per animazioni e cronaca e riducono il traffico. */
export const EVENTI_PUBBLICATI = 40;

/** Lettere senza ambiguità (niente I, O, 0, 1) per codici da dettare a voce. */
const LETTERE = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export const LUNGHEZZA_CODICE = 4;

export function codiceCasuale(casuale: () => number): string {
  return Array.from({ length: LUNGHEZZA_CODICE }, () => LETTERE[Math.floor(casuale() * LETTERE.length)]).join('');
}

/** "ab cd" → "ABCD"; null se non può essere un codice valido. */
export function normalizzaCodice(testo: string): string | null {
  const c = testo.toUpperCase().replace(/[^A-Z]/g, '');
  return c.length === LUNGHEZZA_CODICE && [...c].every((x) => LETTERE.includes(x)) ? c : null;
}

export const percorsi = (codice: string) => {
  const base = `stanze/${codice}`;
  return {
    stanza: base,
    meta: `${base}/meta`,
    sessioneHost: `${base}/meta/sessione`,
    membri: `${base}/membri`,
    membro: (g: IdGiocatore) => `${base}/membri/${g}`,
    pubblico: `${base}/pubblico`,
    vista: (g: IdGiocatore) => `${base}/viste/${g}`,
    ingressi: `${base}/ingressi`,
    ingresso: (uid: string) => `${base}/ingressi/${uid}`,
    azioni: `${base}/azioni`,
    azione: (chiave: string) => `${base}/azioni/${chiave}`,
    rifiuto: (uid: string) => `${base}/rifiuti/${uid}`,
    presenze: `${base}/presenza`,
    presenza: (uid: string) => `${base}/presenza/${uid}`,
    attivita: `attivita/${codice}`,
  };
};

export interface Meta {
  host: string;
  creata: number;
  /** Scheda dell'host che comanda adesso: se un'altra scheda riprende la stanza, la precedente si ferma. */
  sessione?: string;
}

export interface Impostazioni {
  /** Durata delle finestre di reazione (brief §5: 6 secondi, configurabile). */
  finestraSecondi: number;
}

export interface GiocatorePubblico {
  id: IdGiocatore;
  nome: string;
  pecora: IdPecora;
  bot: boolean;
  online: boolean;
}

/** Tutto ciò che ogni dispositivo della stanza può vedere. */
export interface Pubblico {
  versione: number;
  fase: 'attesa' | 'partita';
  /** Giocatore dell'host. */
  host: IdGiocatore;
  giocatori: GiocatorePubblico[];
  impostazioni: Impostazioni;
  /** Vista del tavolo senza mani (null in sala d'attesa). */
  tavolo: Vista | null;
  /** Ora del servizio a cui scade la finestra di reazione aperta, se c'è. */
  scadenza: number | null;
  /** Ora del servizio a cui l'host farà proseguire la fase automatica, se c'è. */
  prosegueAlle: number | null;
  /** Giocatori umani scollegati: la partita è in pausa finché tornano o diventano bot. */
  pausa: IdGiocatore[];
}

/** Vista privata di un giocatore con le azioni che può fare adesso. */
export interface VistaPrivata {
  versione: number;
  vista: Vista;
  azioni: Azione[];
}

/** Richiesta di entrare (o rientrare) nella stanza, scritta dal dispositivo che entra. */
export interface Ingresso {
  nome: string;
  pecora: IdPecora;
  /** Gettone segreto del giocatore, salvato nel suo browser: serve per rientrare da un altro dispositivo o dopo aver perso l'identità. */
  gettone: string;
  /** Giocatore in cui si vuole rientrare a partita iniziata. */
  rientro?: IdGiocatore;
  /** Ora del servizio della richiesta: se due dispositivi reclamano lo stesso posto vince il più recente. */
  quando?: number;
}

export interface AzioneInviata {
  uid: string;
  /** Azione in testo JSON. */
  azione: string;
}

export interface Rifiuto {
  messaggio: string;
  quando: number;
}

/** Vista con meno eventi, per pubblicarla. */
export function vistaDaPubblicare(v: Vista): Vista {
  return v.eventi.length > EVENTI_PUBBLICATI ? { ...v, eventi: v.eventi.slice(-EVENTI_PUBBLICATI) } : v;
}

/** I dati realtime viaggiano come testo JSON: il database scarterebbe array vuoti e valori null. */
export const comeTesto = (x: unknown): string => JSON.stringify(x);
export function daTesto<T>(x: unknown): T | null {
  if (typeof x !== 'string') return null;
  try {
    return JSON.parse(x) as T;
  } catch {
    return null;
  }
}

/** Gettone casuale per il rientro. */
export function nuovoGettone(): string {
  const byte = new Uint8Array(16);
  globalThis.crypto.getRandomValues(byte);
  return [...byte].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Ciò che un dispositivo ricorda della stanza in cui gioca, per rientrare dopo una chiusura o un ricaricamento. */
export interface Iscrizione {
  codice: string;
  ruolo: 'host' | 'ospite';
  idGiocatore: IdGiocatore | null;
  nome: string;
  pecora: IdPecora;
  gettone: string;
}

/** Dispositivi presenti: uid con almeno una connessione attiva. */
export function presentiDa(v: unknown): Set<string> {
  const per = (v as Record<string, unknown> | null) ?? {};
  return new Set(Object.entries(per).filter(([, c]) => c !== null && typeof c === 'object' && Object.keys(c).length > 0).map(([uid]) => uid));
}
