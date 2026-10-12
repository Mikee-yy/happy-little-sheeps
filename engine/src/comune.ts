// Strumenti condivisi dai moduli del motore. Tutte le funzioni che modificano lavorano sulla copia
// dello stato creata da `applica` (o da `nuovaPartita`), mai sull'argomento dell'utente.
import { defCarta, eTrovata } from './dati';
import type {
  DatiRound,
  Evento,
  Fase,
  IdCarta,
  IdGiocatore,
  Luogo,
  NomeFase,
  NuovoEvento,
  RigaPunteggio,
  Stato,
  StatoGiocatore,
} from './tipi';
import { ErroreRegola } from './tipi';

export const MASSIMO_EVENTI = 200;

export function errore(codice: string, messaggio: string): never {
  throw new ErroreRegola(codice, messaggio);
}

/** Lanciata quando la partita finisce: interrompe il flusso; `applica` restituisce lo stato così com'è. */
export class InterruzioneFinePartita {
  readonly fine = true;
}

export function emetti(s: Stato, evento: NuovoEvento): void {
  s.eventi.push({ ...evento, seq: s.prossimoEvento } as Evento);
  s.prossimoEvento += 1;
  if (s.eventi.length > MASSIMO_EVENTI) s.eventi.splice(0, s.eventi.length - MASSIMO_EVENTI);
}

export function richiediFase<N extends NomeFase>(s: Stato, nome: N): Extract<Fase, { nome: N }> {
  if (s.fase.nome !== nome) errore('fase_errata', `Azione non ammessa nella fase ${s.fase.nome}`);
  return s.fase as Extract<Fase, { nome: N }>;
}

/** Fuori dalle reazioni: pila vuota e nessuna richiesta in corso. */
export function richiediLibero(s: Stato): void {
  if (s.pila.length > 0) errore('pila_non_vuota', 'C\'è una dichiarazione in attesa di reazioni');
  if (s.richiesta) errore('richiesta_in_corso', 'Un giocatore deve completare un effetto');
}

export function trovaGiocatore(s: Stato, id: IdGiocatore): StatoGiocatore | undefined {
  return s.giocatori.find((g) => g.id === id);
}

export function giocatore(s: Stato, id: IdGiocatore): StatoGiocatore {
  const g = trovaGiocatore(s, id);
  if (!g) errore('non_tocca_a_te', `Giocatore sconosciuto: ${String(id)}`);
  return g;
}

/** Giocatore esistente e non eliminato. */
export function giocatoreAttivo(s: Stato, id: IdGiocatore): StatoGiocatore {
  const g = giocatore(s, id);
  if (g.eliminato) errore('non_tocca_a_te', `${id} è eliminato`);
  return g;
}

/** Non eliminati in ordine di posto. */
export function nonEliminati(s: Stato): IdGiocatore[] {
  return s.giocatori.filter((g) => !g.eliminato).map((g) => g.id);
}

/** Non eliminati in ordine di posto, partendo da `primo` (o dal successivo, se è eliminato). */
export function ordineDa(s: Stato, primo: IdGiocatore): IdGiocatore[] {
  const n = s.giocatori.length;
  const inizio = Math.max(0, s.giocatori.findIndex((g) => g.id === primo));
  const ordine: IdGiocatore[] = [];
  for (let k = 0; k < n; k++) {
    const g = s.giocatori[(inizio + k) % n] as StatoGiocatore;
    if (!g.eliminato) ordine.push(g.id);
  }
  return ordine;
}

/** Il primo non eliminato dopo `id` in ordine di posto (o `id` stesso se non ce ne sono altri). */
export function successivoNonEliminato(s: Stato, id: IdGiocatore): IdGiocatore {
  const n = s.giocatori.length;
  const i = s.giocatori.findIndex((g) => g.id === id);
  for (let k = 1; k <= n; k++) {
    const g = s.giocatori[(i + k + n) % n] as StatoGiocatore;
    if (!g.eliminato) return g.id;
  }
  return id;
}

export function postiLiberi(s: Stato, id: IdGiocatore): number {
  const g = trovaGiocatore(s, id);
  if (!g) return 0;
  return Math.max(0, s.config.postiOvile - g.agnellini);
}

export function punteggioTotale(s: Stato, id: IdGiocatore): number {
  // Solo chiavi proprie: un id estraneo come "constructor" non deve leggere Object.prototype.
  if (!Object.hasOwn(s.datiRound.punteggi, id)) return 0;
  const righe = s.datiRound.punteggi[id] ?? [];
  return righe.reduce((somma, r) => somma + r.delta, 0);
}

export function aggiungiRiga(s: Stato, id: IdGiocatore, riga: RigaPunteggio): void {
  const righe = s.datiRound.punteggi[id] ?? (s.datiRound.punteggi[id] = []);
  righe.push(riga);
  emetti(s, { tipo: 'punteggio', giocatore: id, riga: { ...riga }, totale: punteggioTotale(s, id) });
}

/** Sposta agnellini tra Gregge e Ovili (il chiamante ha già applicato i limiti). */
export function spostaAgnellini(s: Stato, da: Luogo, a: Luogo, quanti: number, causa: string): void {
  if (quanti <= 0) return;
  if (da === 'gregge') s.gregge -= quanti;
  else giocatore(s, da).agnellini -= quanti;
  if (a === 'gregge') s.gregge += quanti;
  else giocatore(s, a).agnellini += quanti;
  emetti(s, { tipo: 'agnellini', da, a, quanti, causa });
}

export function haTrovata(g: StatoGiocatore): boolean {
  return g.mano.some(eTrovata);
}

export function togliDallaMano(g: StatoGiocatore, carta: IdCarta): void {
  const i = g.mano.indexOf(carta);
  if (i < 0) errore('carta_non_in_mano', `${carta} non è nella mano di ${g.id}`);
  g.mano.splice(i, 1);
}

export function richiediInMano(g: StatoGiocatore, carta: unknown): IdCarta {
  if (typeof carta !== 'string' || !g.mano.includes(carta)) {
    errore('carta_non_in_mano', `${String(carta)} non è nella mano di ${g.id}`);
  }
  defCarta(carta);
  return carta;
}

/** Annuncia l'ultimo round quando il mazzo principale si esaurisce. */
export function annunciaUltimoRound(s: Stato): void {
  if (s.ultimoRound !== null) return;
  s.ultimoRound = s.round + 1;
  emetti(s, { tipo: 'ultimo_round_annunciato', round: s.ultimoRound });
}

/** Toglie fino a `n` carte dalla cima del mazzo; se prende l'ultima scatta l'ultimo round. */
export function prendiDalMazzo(s: Stato, n: number): IdCarta[] {
  const k = Math.min(Math.max(0, n), s.mazzo.length);
  if (k === 0) return [];
  const carte = s.mazzo.splice(0, k);
  if (s.mazzo.length === 0) annunciaUltimoRound(s);
  return carte;
}

export function pesca(s: Stato, id: IdGiocatore, n: number): IdCarta[] {
  const k = Math.min(Math.max(0, n), s.mazzo.length);
  if (k === 0) return [];
  const carte = s.mazzo.splice(0, k);
  giocatore(s, id).mano.push(...carte);
  emetti(s, { tipo: 'pescate', giocatore: id, quante: carte.length, carte: [...carte] });
  if (s.mazzo.length === 0) annunciaUltimoRound(s);
  return carte;
}

export function scarta(s: Stato, id: IdGiocatore, carte: IdCarta[], causa: string): void {
  if (carte.length === 0) return;
  const g = giocatore(s, id);
  for (const c of carte) togliDallaMano(g, c);
  s.scarti.push(...carte);
  emetti(s, { tipo: 'scartate', giocatore: id, carte: [...carte], causa });
}

export function datiRoundVuoti(numero: number, guaio: IdCarta | null): DatiRound {
  return {
    numero,
    guaio,
    partecipanti: [],
    giocate: {},
    punteggi: {},
    tavolo: [],
    raddoppioBelati: false,
    ignoraEffetti: null,
    piuAlti: [],
    piuBassi: [],
    lanciatori: [],
    presoDa: null,
  };
}

export function eIntero(x: unknown): x is number {
  return typeof x === 'number' && Number.isInteger(x);
}
