// Fine partita: Ovile pieno, Ultima pecora, Mazzo finito (sezione 9).
import { emetti, InterruzioneFinePartita, nonEliminati, trovaGiocatore } from './comune';
import type { IdGiocatore, ModoVittoria, Stato } from './tipi';

/** Chiude la partita e interrompe il flusso in corso. */
export function terminaPartita(s: Stato, modo: ModoVittoria, vincitori: IdGiocatore[]): never {
  // Le carte guardate e non ancora assegnate non devono sparire.
  if (s.richiesta?.tipo === 'guarda_due') s.scarti.push(...s.richiesta.carte);
  s.esito = { modo, vincitori: [...vincitori] };
  s.fase = { nome: 'fine_partita' };
  s.pila = [];
  s.finestra = null;
  s.richiesta = null;
  emetti(s, { tipo: 'fine_partita', esito: { modo, vincitori: [...vincitori] } });
  throw new InterruzioneFinePartita();
}

/** Da chiamare dopo ogni spostamento di agnellini. `autore` = chi ha causato lo spostamento. */
export function controllaOvilePieno(s: Stato, autore: IdGiocatore | null): void {
  const pieni = s.giocatori
    .filter((g) => !g.eliminato && g.agnellini >= s.config.postiOvile)
    .map((g) => g.id);
  if (pieni.length === 0) return;
  const vincitori = autore !== null && pieni.includes(autore) ? [autore] : pieni;
  terminaPartita(s, 'ovile_pieno', vincitori);
}

export function controllaUltimaPecora(s: Stato): void {
  const rimasti = nonEliminati(s);
  if (rimasti.length === 1) terminaPartita(s, 'ultima_pecora', rimasti);
}

/** Più agnellini, poi meno Guai nell'Angolo, poi vittoria condivisa. */
export function vittoriaMazzoFinito(s: Stato): never {
  const candidati = nonEliminati(s).map((id) => trovaGiocatore(s, id)!);
  const massimo = Math.max(...candidati.map((g) => g.agnellini));
  const ricchi = candidati.filter((g) => g.agnellini === massimo);
  const minimoGuai = Math.min(...ricchi.map((g) => g.angolo.length));
  const vincitori = ricchi.filter((g) => g.angolo.length === minimoGuai).map((g) => g.id);
  terminaPartita(s, 'mazzo_finito', vincitori);
}
