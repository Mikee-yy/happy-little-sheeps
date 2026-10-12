// Dopo il dado: Guaio al peggiore, Belato Finale, salvataggio, consolazione (sezioni 4.8–4.11).
import {
  emetti,
  errore,
  giocatore,
  giocatoreAttivo,
  haTrovata,
  postiLiberi,
  richiediFase,
  richiediInMano,
  richiediLibero,
  scarta,
  spostaAgnellini,
  trovaGiocatore,
} from './comune';
import { defTrovata, eTrovata } from './dati';
import { controllaEliminazione } from './eliminazione';
import { controllaOvilePieno } from './fine';
import { entraFineRound } from './partita';
import { mettiInPila, spostaSulTavolo } from './pila';
import type { Azione, DefBelato, IdCarta, IdGiocatore, Stato, VocePila } from './tipi';

export function dopoIlDado(s: Stato): void {
  if (s.datiRound.guaio === null) {
    entraFineRound(s);
    return;
  }
  const bassi = s.datiRound.piuBassi;
  s.fase = {
    nome: 'guaio_al_peggiore',
    destinatario: bassi.length === 1 ? (bassi[0] as IdGiocatore) : null,
    spareggio: bassi.length >= 2 ? [...bassi] : null,
  };
}

export function proseguiGuaioAlPeggiore(s: Stato): void {
  const f = richiediFase(s, 'guaio_al_peggiore');
  if (f.destinatario !== null) entraSalvataggio(s, f.destinatario);
  else if (f.spareggio !== null) entraBelatoFinale(s, f.spareggio, []);
  else {
    guaioInFondo(s);
    entraFineRound(s);
  }
}

function guaioInFondo(s: Stato): void {
  const guaio = s.datiRound.guaio;
  if (guaio === null) return;
  s.mazzoGuai.push(guaio);
  emetti(s, { tipo: 'guaio_in_fondo', carta: guaio });
}

// ─── Belato Finale ───────────────────────────────────────────────────────────

function entraBelatoFinale(s: Stato, partecipanti: IdGiocatore[], storico: Array<Record<IdGiocatore, IdCarta>>): void {
  const senza = partecipanti.filter((id) => !haTrovata(giocatore(s, id)));
  if (senza.length === 1) {
    entraSalvataggio(s, senza[0] as IdGiocatore);
    return;
  }
  if (senza.length >= 2) {
    guaioInFondo(s);
    entraFineRound(s);
    return;
  }
  s.fase = {
    nome: 'belato_finale',
    partecipanti: [...partecipanti],
    scelte: Object.fromEntries(partecipanti.map((id) => [id, null])),
    storico,
  };
}

export function sceltaFinale(s: Stato, a: Extract<Azione, { tipo: 'sceltaFinale' }>): void {
  richiediLibero(s);
  const f = richiediFase(s, 'belato_finale');
  const g = giocatoreAttivo(s, a.giocatore);
  if (!f.partecipanti.includes(g.id)) errore('non_tocca_a_te', `${g.id} non partecipa al Belato Finale`);
  const carta = richiediInMano(g, a.carta);
  if (!eTrovata(carta)) errore('carta_non_valida', `${carta} non è una Trovata`);
  // L'evento arriva solo alla prima scelta: un cambio di carta (D40) resta segreto.
  if (!f.scelte[g.id]) emetti(s, { tipo: 'ha_scelto', giocatore: g.id });
  f.scelte[g.id] = carta;
  if (f.partecipanti.some((id) => !f.scelte[id])) return;

  const rivelate: Record<IdGiocatore, IdCarta> = {};
  for (const id of f.partecipanti) {
    const c = f.scelte[id] as IdCarta;
    const pg = giocatore(s, id);
    pg.mano.splice(pg.mano.indexOf(c), 1);
    s.datiRound.tavolo.push(c);
    rivelate[id] = c;
  }
  const storico = [...f.storico, rivelate];
  emetti(s, { tipo: 'belato_finale', rivelate: { ...rivelate } });
  const valori = new Map(f.partecipanti.map((id) => [id, defTrovata(rivelate[id] as IdCarta).valore]));
  const minimo = Math.min(...valori.values());
  const perdenti = f.partecipanti.filter((id) => valori.get(id) === minimo);
  if (perdenti.length === 1) entraSalvataggio(s, perdenti[0] as IdGiocatore);
  else entraBelatoFinale(s, perdenti, storico);
}

// ─── Salvataggio ─────────────────────────────────────────────────────────────

function entraSalvataggio(s: Stato, destinatario: IdGiocatore): void {
  s.fase = { nome: 'belati_salvataggio', destinatario };
}

/** Altri partecipanti del round non eliminati: possibili bersagli di "devia il Guaio". */
export function bersagliDeviazione(s: Stato, destinatario: IdGiocatore): IdGiocatore[] {
  return s.datiRound.partecipanti.filter((id) => id !== destinatario && !trovaGiocatore(s, id)?.eliminato);
}

export function passaSalvataggio(s: Stato, id: IdGiocatore): void {
  const f = richiediFase(s, 'belati_salvataggio');
  if (id !== f.destinatario) errore('non_tocca_a_te', `Decide ${f.destinatario}`);
  entraConsolazione(s, f.destinatario);
}

export function giocaBelatoSalvataggio(
  s: Stato,
  id: IdGiocatore,
  carta: IdCarta,
  def: DefBelato,
  bersaglio: IdGiocatore | undefined,
): void {
  const f = richiediFase(s, 'belati_salvataggio');
  if (id !== f.destinatario) errore('non_tocca_a_te', `Solo ${f.destinatario} può salvarsi`);
  if (def.effetto === 'devia_guaio') {
    if (bersaglio === undefined || !bersagliDeviazione(s, id).includes(bersaglio)) {
      errore('bersaglio_non_valido', 'Il Guaio va deviato su un altro partecipante del round');
    }
  }
  spostaSulTavolo(s, id, carta);
  mettiInPila(s, id, {
    tipo: 'belato',
    carta,
    effetto: def.effetto,
    ...(def.effetto === 'devia_guaio' ? { bersaglio } : {}),
  });
}

// ─── Consolazione ────────────────────────────────────────────────────────────

function entraConsolazione(s: Stato, destinatario: IdGiocatore): void {
  s.fase = { nome: 'consolazione', destinatario };
  const guaio = s.datiRound.guaio;
  if (guaio === null) return;
  giocatore(s, destinatario).angolo.push(guaio);
  s.datiRound.presoDa = destinatario;
  emetti(s, { tipo: 'guaio_preso', giocatore: destinatario, carta: guaio });
  const quanti = Math.min(1, s.gregge, postiLiberi(s, destinatario));
  spostaAgnellini(s, 'gregge', destinatario, quanti, 'consolazione');
  controllaOvilePieno(s, destinatario);
}

export function giocaCura(s: Stato, id: IdGiocatore, carta: IdCarta, guaio: IdCarta | undefined): void {
  const f = richiediFase(s, 'consolazione');
  if (id !== f.destinatario) errore('non_tocca_a_te', `Solo ${f.destinatario} può giocarla adesso`);
  if (guaio === undefined || !giocatore(s, id).angolo.includes(guaio)) {
    errore('bersaglio_non_valido', 'Il Guaio da togliere deve essere nel tuo Angolo');
  }
  spostaSulTavolo(s, id, carta);
  mettiInPila(s, id, { tipo: 'belato', carta, effetto: 'cura', guaio });
}

export function concludiConsolazione(s: Stato, a: Extract<Azione, { tipo: 'concludiConsolazione' }>): void {
  richiediLibero(s);
  const f = richiediFase(s, 'consolazione');
  const g = giocatoreAttivo(s, a.giocatore);
  if (g.id !== f.destinatario) errore('non_tocca_a_te', `Decide ${f.destinatario}`);
  if (a.scarta !== null && a.scarta !== undefined) {
    const carta = richiediInMano(g, a.scarta);
    scarta(s, g.id, [carta], 'consolazione');
  }
  controllaEliminazione(s, g.id);
  entraFineRound(s);
}

// ─── Risoluzione dei Belati di salvataggio e cura ────────────────────────────

export function belatoGuaioRisolto(s: Stato, voce: VocePila): void {
  const d = voce.dettagli;
  if (d.tipo !== 'belato') return;
  if (d.effetto === 'guaio_in_fondo') {
    guaioInFondo(s);
    entraFineRound(s);
  } else if (d.effetto === 'devia_guaio' && d.bersaglio !== undefined) {
    emetti(s, { tipo: 'guaio_deviato', da: voce.autore, a: d.bersaglio });
    entraSalvataggio(s, d.bersaglio);
  } else if (d.effetto === 'cura' && d.guaio !== undefined) {
    const angolo = giocatore(s, voce.autore).angolo;
    const i = angolo.indexOf(d.guaio);
    if (i >= 0) {
      angolo.splice(i, 1);
      s.mazzoGuai.push(d.guaio);
      emetti(s, { tipo: 'guaio_curato', giocatore: voce.autore, carta: d.guaio });
    }
  }
}

/** Un Belato di salvataggio o una cura annullati: si resta nella fase, con lo stesso destinatario. */
export function belatoGuaioAnnullato(_s: Stato, _voce: VocePila): void {}
