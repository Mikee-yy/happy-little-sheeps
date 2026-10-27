// Fase `effetti`: coda degli effetti delle Trovate e richieste private (sezioni 4.4 e 6).
import {
  aggiungiRiga,
  emetti,
  errore,
  giocatore,
  giocatoreAttivo,
  haTrovata,
  postiLiberi,
  prendiDalMazzo,
  punteggioTotale,
  richiediFase,
  richiediLibero,
  scarta,
  spostaAgnellini,
  trovaGiocatore,
} from './comune';
import { defTrovata, eTrovata } from './dati';
import { controllaOvilePieno } from './fine';
import { mettiInPila } from './pila';
import { chiudiPunteggio, entraBelatiPunteggio, scambiaPunteggi } from './punteggio';
import { mescola } from './rng';
import type { Azione, GruppoEffetto, IdGiocatore, Stato, VoceEffetto, VocePila } from './tipi';

const ORDINE_GRUPPI: Record<GruppoEffetto, number> = { round: 0, normale: 1, punteggio: 2 };

export function entraEffetti(s: Stato): void {
  const voci: VoceEffetto[] = [];
  for (const id of s.datiRound.partecipanti) {
    for (const carta of s.datiRound.giocate[id] ?? []) {
      const def = defTrovata(carta);
      if (!def.effetto || !def.gruppo) continue;
      voci.push({ giocatore: id, carta, effetto: def.effetto, gruppo: def.gruppo, valore: def.valore, esito: 'attesa' });
    }
  }
  // D10 (21/10/2026): a parità di gruppo e valore gli agnellini non contano, decide subito il caso.
  const chiave = (v: VoceEffetto): number[] => [ORDINE_GRUPPI[v.gruppo], v.valore];
  const confronta = (a: VoceEffetto, b: VoceEffetto): number => {
    const ka = chiave(a);
    const kb = chiave(b);
    for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return (ka[i] as number) - (kb[i] as number);
    return 0;
  };
  // L'ordine casuale dei giocatori si estrae (una volta) solo se serve a separare giocatori diversi.
  const parita = voci.some((a, i) => voci.some((b, j) => j > i && a.giocatore !== b.giocatore && confronta(a, b) === 0));
  const rango = new Map<IdGiocatore, number>();
  if (parita) {
    const ordine = [...s.datiRound.partecipanti];
    mescola(s, ordine);
    ordine.forEach((id, i) => rango.set(id, i));
  }
  // Array.prototype.sort è stabile: a parità di giocatore resta l'ordine delle carte in `giocate`.
  voci.sort((a, b) => confronta(a, b) || (rango.get(a.giocatore) ?? 0) - (rango.get(b.giocatore) ?? 0));
  s.fase = { nome: 'effetti', coda: voci, indice: 0 };
  processaCoda(s);
}

/** D11: un effetto che non può cambiare nulla viene saltato. `dopo` = voci successive della coda. */
function attivabile(s: Stato, v: VoceEffetto, dopo: VoceEffetto[]): boolean {
  const g = giocatore(s, v.giocatore);
  switch (v.effetto) {
    case 'ignora_effetti':
      return dopo.some((x) => x.esito === 'attesa');
    case 'scarta_e_somma':
      return haTrovata(g);
    case 'prendi_agnellino':
      return s.gregge >= 1;
    case 'scarta_fino_a_tre':
      return g.mano.length >= 1;
    case 'sposta_agnellino':
      return bersagliSposta(s, g.id).length > 0;
    case 'guarda_due':
      return s.mazzo.length >= 1;
    case 'scambia_punteggi':
      return new Set(s.datiRound.partecipanti.map((id) => punteggioTotale(s, id))).size >= 2;
    case 'raddoppia_belati':
      return !s.datiRound.raddoppioBelati;
  }
}

export function bersagliSposta(s: Stato, id: IdGiocatore): IdGiocatore[] {
  return s.giocatori.filter((g) => g.id !== id && !g.eliminato && g.agnellini >= 1).map((g) => g.id);
}

function chiudiVoce(s: Stato, v: VoceEffetto, esito: VoceEffetto['esito']): void {
  v.esito = esito;
  emetti(s, { tipo: 'effetto', giocatore: v.giocatore, carta: v.carta, esito });
}

/** Avanza la coda fino alla prossima voce che aspetta il proprietario, o esce dalla fase. */
function processaCoda(s: Stato): void {
  const f = richiediFase(s, 'effetti');
  while (f.indice < f.coda.length) {
    const v = f.coda[f.indice] as VoceEffetto;
    if (v.esito === 'attesa') {
      const ignora = s.datiRound.ignoraEffetti;
      if (ignora && ignora.carta !== v.carta) chiudiVoce(s, v, 'ignorato');
      else if (!attivabile(s, v, f.coda.slice(f.indice + 1))) chiudiVoce(s, v, 'saltato');
      else return;
    }
    f.indice += 1;
  }
  if (s.datiRound.partecipanti.length >= 2) entraBelatiPunteggio(s);
  else chiudiPunteggio(s);
}

function prossimaVoce(s: Stato): void {
  const f = richiediFase(s, 'effetti');
  f.indice += 1;
  processaCoda(s);
}

/** La voce corrente, se aspetta il suo proprietario. */
export function voceCorrente(s: Stato): VoceEffetto | null {
  if (s.fase.nome !== 'effetti') return null;
  const v = s.fase.coda[s.fase.indice];
  return v && v.esito === 'attesa' ? v : null;
}

function richiediVoce(s: Stato, a: { giocatore: IdGiocatore; carta: string }): VoceEffetto {
  richiediLibero(s);
  richiediFase(s, 'effetti');
  giocatoreAttivo(s, a.giocatore);
  const v = voceCorrente(s);
  if (!v) errore('fase_errata', 'Nessun effetto in attesa');
  if (v.giocatore !== a.giocatore) errore('non_tocca_a_te', `Tocca a ${v.giocatore}`);
  if (v.carta !== a.carta) errore('carta_non_valida', `L'effetto corrente è di ${v.carta}`);
  return v;
}

export function attivaEffetto(s: Stato, a: Extract<Azione, { tipo: 'attivaEffetto' }>): void {
  const v = richiediVoce(s, a);
  if (v.effetto === 'sposta_agnellino') {
    if (a.bersaglio === undefined || !bersagliSposta(s, v.giocatore).includes(a.bersaglio)) {
      errore('bersaglio_non_valido', 'Serve un avversario non eliminato con almeno un agnellino');
    }
  } else if (a.bersaglio !== undefined) {
    errore('bersaglio_non_valido', 'Questo effetto non ha bersaglio');
  }
  chiudiVoce(s, v, 'attivato');
  mettiInPila(s, v.giocatore, {
    tipo: 'effetto_trovata',
    carta: v.carta,
    effetto: v.effetto,
    ...(a.bersaglio !== undefined ? { bersaglio: a.bersaglio } : {}),
  });
}

export function rinunciaEffetto(s: Stato, a: Extract<Azione, { tipo: 'rinunciaEffetto' }>): void {
  const v = richiediVoce(s, a);
  chiudiVoce(s, v, 'rinunciato');
  prossimaVoce(s);
}

function voceDellaCoda(s: Stato, voce: VocePila): VoceEffetto | undefined {
  if (s.fase.nome !== 'effetti' || voce.dettagli.tipo !== 'effetto_trovata') return undefined;
  const carta = voce.dettagli.carta;
  return s.fase.coda.find((v) => v.carta === carta);
}

export function effettoAnnullato(s: Stato, voce: VocePila): void {
  const v = voceDellaCoda(s, voce);
  if (v) chiudiVoce(s, v, 'annullato');
  prossimaVoce(s);
}

export function effettoRisolto(s: Stato, voce: VocePila): void {
  const d = voce.dettagli;
  if (d.tipo !== 'effetto_trovata') return;
  const id = voce.autore;
  const g = giocatore(s, id);
  switch (d.effetto) {
    case 'ignora_effetti':
      s.datiRound.ignoraEffetti = { giocatore: id, carta: d.carta };
      break;
    case 'scarta_e_somma':
      if (haTrovata(g)) {
        s.richiesta = { tipo: 'scarta_e_somma', giocatore: id, carta: d.carta };
        return;
      }
      break;
    case 'prendi_agnellino': {
      const quanti = Math.min(1, s.gregge, postiLiberi(s, id));
      spostaAgnellini(s, 'gregge', id, quanti, 'prendi_agnellino');
      controllaOvilePieno(s, id);
      break;
    }
    case 'scarta_fino_a_tre':
      if (g.mano.length > 0) {
        s.richiesta = { tipo: 'scarta_fino_a_tre', giocatore: id, carta: d.carta };
        return;
      }
      break;
    case 'sposta_agnellino': {
      const bersaglio = d.bersaglio !== undefined ? trovaGiocatore(s, d.bersaglio) : undefined;
      if (bersaglio && !bersaglio.eliminato && bersaglio.agnellini > 0) {
        spostaAgnellini(s, bersaglio.id, 'gregge', 1, 'sposta_agnellino');
        controllaOvilePieno(s, id);
      }
      break;
    }
    case 'guarda_due': {
      const carte = prendiDalMazzo(s, 2);
      if (carte.length === 2) {
        s.richiesta = { tipo: 'guarda_due', giocatore: id, carta: d.carta, carte };
        return;
      }
      if (carte.length === 1) {
        g.mano.push(...carte);
        emetti(s, { tipo: 'pescate', giocatore: id, quante: 1, carte: [...carte] });
      }
      break;
    }
    case 'scambia_punteggi':
      scambiaPunteggi(s, id, d.carta);
      break;
    case 'raddoppia_belati':
      s.datiRound.raddoppioBelati = true;
      break;
  }
  prossimaVoce(s);
}

function richiediDistinte(carte: unknown): string[] {
  if (!Array.isArray(carte) || carte.some((c) => typeof c !== 'string')) {
    errore('scelta_non_valida', 'Elenco di carte non valido');
  }
  const elenco = carte as string[];
  if (new Set(elenco).size !== elenco.length) errore('scelta_non_valida', 'Carte ripetute');
  return elenco;
}

export function completaEffetto(s: Stato, a: Extract<Azione, { tipo: 'completaEffetto' }>): void {
  const r = s.richiesta;
  if (!r && s.pila.length > 0) errore('pila_non_vuota', 'C\'è una dichiarazione in attesa di reazioni');
  if (!r) errore('fase_errata', 'Nessun effetto da completare');
  if (a.giocatore !== r.giocatore) errore('non_tocca_a_te', `Deve completare ${r.giocatore}`);
  const g = giocatore(s, r.giocatore);
  const carte = richiediDistinte(a.carte);
  for (const c of carte) {
    if (r.tipo !== 'guarda_due' && !g.mano.includes(c)) errore('carta_non_in_mano', `${c} non è in mano`);
  }
  switch (r.tipo) {
    case 'scarta_e_somma': {
      const scelta = carte[0];
      if (carte.length !== 1 || scelta === undefined) errore('scelta_non_valida', 'Scegli una sola Trovata');
      if (!eTrovata(scelta)) errore('carta_non_valida', `${scelta} non è una Trovata`);
      scarta(s, g.id, [scelta], 'scarta_e_somma');
      s.richiesta = null;
      aggiungiRiga(s, g.id, { tipo: 'effetto', delta: defTrovata(scelta).valore, carta: scelta, autore: g.id });
      break;
    }
    case 'scarta_fino_a_tre':
      if (carte.length > 3) errore('scelta_non_valida', 'Al massimo 3 carte');
      scarta(s, g.id, carte, 'scarta_fino_a_tre');
      s.richiesta = null;
      break;
    case 'guarda_due': {
      const tenuta = carte[0];
      if (carte.length !== 1 || tenuta === undefined || !r.carte.includes(tenuta)) {
        errore('scelta_non_valida', 'Tieni una delle carte guardate');
      }
      const altre = r.carte.filter((c) => c !== tenuta);
      g.mano.push(tenuta);
      s.scarti.push(...altre);
      s.richiesta = null;
      emetti(s, { tipo: 'pescate', giocatore: g.id, quante: 1, carte: [tenuta] });
      if (altre.length > 0) emetti(s, { tipo: 'scartate', giocatore: g.id, carte: altre, causa: 'guarda_due' });
      break;
    }
  }
  prossimaVoce(s);
}
