// Punteggio del round: righe, scambio, finestra dei Belati di punteggio, chiusura (sezioni 4.3, 4.5, 4.6, 7).
import { aggiungiRiga, errore, giocatore, nonEliminati, punteggioTotale, richiediFase } from './comune';
import { CATALOGO, defBelato, defGuaio, defTrovata, TIPI_GUAIO } from './dati';
import { dopoIlDado } from './guai';
import { mettiInPila, spostaSulTavolo } from './pila';
import { mescola } from './rng';
import type { DefBelato, IdCarta, IdGiocatore, Stato, TipoGuaio, VocePila } from './tipi';

/** Righe di base della rivelazione: valore di ogni carta giocata e tratto della pecora. */
export function righeDiBase(s: Stato): void {
  const guaio = s.datiRound.guaio;
  const tipo = guaio ? defGuaio(guaio).tipo : null;
  for (const id of s.datiRound.partecipanti) {
    s.datiRound.punteggi[id] = [];
    for (const carta of s.datiRound.giocate[id] ?? []) {
      aggiungiRiga(s, id, { tipo: 'valore', delta: defTrovata(carta).valore, carta, autore: id });
    }
    if (tipo && (TIPI_GUAIO as readonly string[]).includes(tipo)) {
      const pecora = CATALOGO.pecore[giocatore(s, id).pecora];
      const t = tipo as TipoGuaio;
      const delta = pecora?.bonus === t ? 1 : pecora?.malus === t ? -1 : 0;
      if (delta !== 0) aggiungiRiga(s, id, { tipo: 'tratto', delta, autore: id });
    }
  }
}

/** Il più alto e il più basso si scambiano, sui totali correnti; pari merito a un estremo tutti coinvolti. */
export function scambiaPunteggi(s: Stato, autore: IdGiocatore, carta: IdCarta): void {
  const partecipanti = s.datiRound.partecipanti;
  if (partecipanti.length < 2) return;
  const totali = new Map(partecipanti.map((id) => [id, punteggioTotale(s, id)]));
  const valori = [...totali.values()];
  const massimo = Math.max(...valori);
  const minimo = Math.min(...valori);
  if (massimo === minimo) return;
  for (const id of partecipanti) {
    const t = totali.get(id);
    if (t === massimo) aggiungiRiga(s, id, { tipo: 'scambio', delta: minimo - massimo, carta, autore });
    else if (t === minimo) aggiungiRiga(s, id, { tipo: 'scambio', delta: massimo - minimo, carta, autore });
  }
}

export function entraBelatiPunteggio(s: Stato): void {
  s.fase = { nome: 'belati_punteggio', inAttesa: nonEliminati(s) };
}

export function passaPunteggio(s: Stato, id: IdGiocatore): void {
  const f = richiediFase(s, 'belati_punteggio');
  if (!f.inAttesa.includes(id)) errore('non_tocca_a_te', `${id} ha già passato`);
  f.inAttesa = f.inAttesa.filter((x) => x !== id);
  if (f.inAttesa.length === 0) chiudiPunteggio(s);
}

export function giocaBelatoPunteggio(
  s: Stato,
  id: IdGiocatore,
  carta: IdCarta,
  def: DefBelato,
  bersaglio: IdGiocatore | undefined,
): void {
  richiediFase(s, 'belati_punteggio');
  if (def.effetto === 'modifica_punteggio') {
    if (bersaglio === undefined || !s.datiRound.partecipanti.includes(bersaglio)) {
      errore('bersaglio_non_valido', 'Il bersaglio deve avere un punteggio nel round');
    }
  }
  spostaSulTavolo(s, id, carta);
  mettiInPila(s, id, {
    tipo: 'belato',
    carta,
    effetto: def.effetto,
    ...(def.effetto === 'modifica_punteggio' ? { bersaglio } : {}),
  });
}

function riapriFinestraPunteggio(s: Stato): void {
  if (s.fase.nome === 'belati_punteggio') s.fase.inAttesa = nonEliminati(s);
}

export function belatoPunteggioRisolto(s: Stato, voce: VocePila): void {
  const d = voce.dettagli;
  if (d.tipo !== 'belato') return;
  if (d.effetto === 'modifica_punteggio' && d.bersaglio !== undefined) {
    const delta = (defBelato(d.carta)?.valore ?? 0) * (s.datiRound.raddoppioBelati ? 2 : 1);
    aggiungiRiga(s, d.bersaglio, { tipo: 'belato', delta, carta: d.carta, autore: voce.autore });
  } else if (d.effetto === 'scambia_punteggi') {
    scambiaPunteggi(s, voce.autore, d.carta);
  }
  riapriFinestraPunteggio(s);
}

export function belatoPunteggioAnnullato(s: Stato): void {
  riapriFinestraPunteggio(s);
}

/** Più alti, più bassi e ordine dei lanciatori (sezione 4.6). */
export function chiudiPunteggio(s: Stato): void {
  const p = s.datiRound.partecipanti;
  let piuAlti: IdGiocatore[] = [];
  let piuBassi: IdGiocatore[] = [];
  if (p.length === 1) {
    piuAlti = [...p];
  } else if (p.length >= 2) {
    const totali = new Map(p.map((id) => [id, punteggioTotale(s, id)]));
    const massimo = Math.max(...totali.values());
    const minimo = Math.min(...totali.values());
    if (massimo !== minimo) {
      piuAlti = p.filter((id) => totali.get(id) === massimo);
      piuBassi = p.filter((id) => totali.get(id) === minimo);
    }
  }
  s.datiRound.piuAlti = piuAlti;
  s.datiRound.piuBassi = piuBassi;
  s.datiRound.lanciatori = ordinaLanciatori(s, piuAlti);
  if (s.datiRound.lanciatori.length > 0) s.fase = { nome: 'dado', indice: 0 };
  else dopoIlDado(s);
}

/** Meno agnellini prima; a parità di agnellini ordine casuale (il generatore si usa solo se serve). */
function ordinaLanciatori(s: Stato, piuAlti: IdGiocatore[]): IdGiocatore[] {
  const agnellini = (id: IdGiocatore): number => giocatore(s, id).agnellini;
  const ordinati = [...piuAlti].sort((a, b) => agnellini(a) - agnellini(b));
  const risultato: IdGiocatore[] = [];
  let i = 0;
  while (i < ordinati.length) {
    let j = i + 1;
    while (j < ordinati.length && agnellini(ordinati[j] as string) === agnellini(ordinati[i] as string)) j++;
    const gruppo = ordinati.slice(i, j);
    if (gruppo.length > 1) mescola(s, gruppo);
    risultato.push(...gruppo);
    i = j;
  }
  return risultato;
}
