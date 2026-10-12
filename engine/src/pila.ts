// Pila di reazione e Beee-NO! (sezione 5).
import { emetti, errore, nonEliminati } from './comune';
import { dadoAnnullato, dadoRisolto } from './dado';
import { effettoAnnullato, effettoRisolto } from './effetti';
import { belatoGuaioAnnullato, belatoGuaioRisolto } from './guai';
import { belatoPunteggioAnnullato, belatoPunteggioRisolto } from './punteggio';
import type { DettagliVoce, IdCarta, IdGiocatore, IdVoce, Stato, VocePila } from './tipi';

export function cima(s: Stato): VocePila | undefined {
  return s.pila[s.pila.length - 1];
}

export function eBeeeNo(v: VocePila): boolean {
  return v.dettagli.tipo === 'belato' && v.dettagli.effetto === 'beee_no';
}

/** Dichiara una voce annullabile: va in cima alla pila e apre la finestra. */
export function mettiInPila(s: Stato, autore: IdGiocatore, dettagli: DettagliVoce): void {
  const voce: VocePila = { id: s.prossimaVoce, autore, dettagli };
  s.prossimaVoce += 1;
  s.pila.push(voce);
  emetti(s, { tipo: 'dichiarazione', voce: voce.id, autore, dettagli: structuredClone(dettagli) });
  apriFinestra(s);
}

function apriFinestra(s: Stato): void {
  const voce = cima(s);
  if (!voce) return;
  s.finestra = { voce: voce.id, inAttesa: nonEliminati(s).filter((id) => id !== voce.autore) };
  if (s.finestra.inAttesa.length === 0) risolviCima(s);
}

export function passaInFinestra(s: Stato, id: IdGiocatore): void {
  const f = s.finestra;
  if (!f || !f.inAttesa.includes(id)) errore('non_tocca_a_te', `${id} non deve rispondere alla finestra`);
  f.inAttesa = f.inAttesa.filter((x) => x !== id);
  if (f.inAttesa.length === 0) risolviCima(s);
}

export function scadenzaFinestra(s: Stato): void {
  if (!s.finestra) errore('fase_errata', 'Nessuna finestra aperta');
  s.finestra.inAttesa = [];
  risolviCima(s);
}

/** Beee-NO!: già controllati mano e tipo della carta. */
export function giocaBeeeNo(s: Stato, id: IdGiocatore, carta: IdCarta, voce: IdVoce | undefined): void {
  const sopra = cima(s);
  if (!sopra || !s.finestra) errore('fase_errata', 'Beee-NO! si gioca solo su una dichiarazione in sospeso');
  if (voce !== sopra.id) errore('voce_non_in_cima', `La voce ${String(voce)} non è in cima alla pila`);
  if (!s.finestra.inAttesa.includes(id)) errore('non_tocca_a_te', `${id} non può rispondere a questa voce`);
  spostaSulTavolo(s, id, carta);
  mettiInPila(s, id, { tipo: 'belato', carta, effetto: 'beee_no', voceBersaglio: sopra.id });
}

/** Le carte Belato giocate vanno subito sul tavolo, annullate o no. */
export function spostaSulTavolo(s: Stato, id: IdGiocatore, carta: IdCarta): void {
  const g = s.giocatori.find((x) => x.id === id);
  const i = g ? g.mano.indexOf(carta) : -1;
  if (!g || i < 0) errore('carta_non_in_mano', `${carta} non è nella mano di ${id}`);
  g.mano.splice(i, 1);
  s.datiRound.tavolo.push(carta);
}

function risolviCima(s: Stato): void {
  const voce = s.pila.pop();
  s.finestra = null;
  if (!voce) return;
  if (eBeeeNo(voce)) {
    const sotto = s.pila.pop();
    if (!sotto) return;
    emetti(s, { tipo: 'annullata', voce: sotto.id, da: voce.id });
    emetti(s, { tipo: 'risolta', voce: voce.id });
    if (s.pila.length > 0) apriFinestra(s);
    else baseAnnullata(s, sotto);
    return;
  }
  emetti(s, { tipo: 'risolta', voce: voce.id });
  baseRisolta(s, voce);
}

function baseRisolta(s: Stato, voce: VocePila): void {
  const d = voce.dettagli;
  if (d.tipo === 'effetto_trovata') effettoRisolto(s, voce);
  else if (d.tipo === 'dado') dadoRisolto(s, voce);
  else if (d.effetto === 'modifica_punteggio' || d.effetto === 'scambia_punteggi') belatoPunteggioRisolto(s, voce);
  else belatoGuaioRisolto(s, voce);
}

function baseAnnullata(s: Stato, voce: VocePila): void {
  const d = voce.dettagli;
  if (d.tipo === 'effetto_trovata') effettoAnnullato(s, voce);
  else if (d.tipo === 'dado') dadoAnnullato(s);
  else if (d.effetto === 'modifica_punteggio' || d.effetto === 'scambia_punteggi') belatoPunteggioAnnullato(s);
  else belatoGuaioAnnullato(s, voce);
}
