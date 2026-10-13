// Collegamento al servizio realtime e archivi del browser per la modalità a più dispositivi.
import type { Archivio } from '../../../sync/locale';
import { archivioBrowser } from '../../../sync/locale';
import type { Iscrizione } from '../../../sync/stanza';
import type { Trasporto } from '../../../sync/trasporto';
import { CONFIGURAZIONE_FIREBASE } from '../configurazione-firebase';

export const multigiocatoreDisponibile = (): boolean => CONFIGURAZIONE_FIREBASE !== null;

/**
 * Con ?scheda nell'indirizzo ogni scheda del browser è un dispositivo a sé (identità e iscrizione per scheda):
 * serve a provare più giocatori sullo stesso computer.
 */
export const perScheda = (): boolean => new URLSearchParams(globalThis.location?.search ?? '').has('scheda');

/** Archivio in sessionStorage: sopravvive al ricaricamento della pagina, non alla chiusura della scheda. */
function archivioSessione(chiave: string): Archivio {
  return {
    leggi: () => {
      try {
        return globalThis.sessionStorage?.getItem(chiave) ?? null;
      } catch {
        return null;
      }
    },
    scrivi: (v) => {
      try {
        globalThis.sessionStorage?.setItem(chiave, v);
      } catch {
        // Niente da fare.
      }
    },
    cancella: () => {
      try {
        globalThis.sessionStorage?.removeItem(chiave);
      } catch {
        // Niente da fare.
      }
    },
  };
}

const archivio = (chiave: string): Archivio => (perScheda() ? archivioSessione(chiave) : archivioBrowser(chiave));

/** Stato completo della partita dell'host, salvato a ogni azione (brief §6). */
export const archivioHost = (): Archivio => archivio('hls-stanza-host');

const archivioIscrizione = (): Archivio => archivio('hls-iscrizione');

export function leggiIscrizione(): Iscrizione | null {
  const testo = archivioIscrizione().leggi();
  if (!testo) return null;
  try {
    return JSON.parse(testo) as Iscrizione;
  } catch {
    return null;
  }
}

export const salvaIscrizione = (i: Iscrizione): void => archivioIscrizione().scrivi(JSON.stringify(i));
export const dimenticaIscrizione = (): void => archivioIscrizione().cancella();

/** Ricorda (per questa scheda) di essere dentro una stanza: dopo un ricaricamento si rientra da soli. */
const IN_STANZA = 'hls-in-stanza';
export const segnaInStanza = (codice: string | null): void => {
  try {
    if (codice) globalThis.sessionStorage?.setItem(IN_STANZA, codice);
    else globalThis.sessionStorage?.removeItem(IN_STANZA);
  } catch {
    // Niente da fare.
  }
};
export const eraInStanza = (): string | null => {
  try {
    return globalThis.sessionStorage?.getItem(IN_STANZA) ?? null;
  } catch {
    return null;
  }
};

let collegamento: Promise<Trasporto> | null = null;

/** Firebase si carica solo quando serve: la modalità a un dispositivo resta leggera e funziona offline. */
export function connetti(): Promise<Trasporto> {
  if (!CONFIGURAZIONE_FIREBASE) return Promise.reject(new Error('Firebase non configurato'));
  if (!collegamento) {
    const config = CONFIGURAZIONE_FIREBASE;
    collegamento = import('../../../sync/trasporto-firebase').then((m) => m.collegaFirebase(config, perScheda()));
    collegamento.catch(() => {
      collegamento = null;
    });
  }
  return collegamento;
}

/** Link da condividere per entrare in una stanza. */
export const linkStanza = (codice: string): string => {
  const l = globalThis.location;
  return `${l.origin}${l.pathname}#stanza=${codice}`;
};
export const linkTavolo = (codice: string): string => {
  const l = globalThis.location;
  return `${l.origin}${l.pathname}#tavolo=${codice}`;
};
