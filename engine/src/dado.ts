// Dado del Pastore: lancio, dichiarazione, reazione, applicazione (sezione 4.7).
import {
  emetti,
  eIntero,
  errore,
  giocatore,
  giocatoreAttivo,
  postiLiberi,
  richiediFase,
  richiediLibero,
  spostaAgnellini,
  trovaGiocatore,
} from './comune';
import { controllaOvilePieno } from './fine';
import { dopoIlDado } from './guai';
import { mettiInPila } from './pila';
import { intero, type ConRng } from './rng';
import type { Azione, DichiarazioneDado, FacciaDado, Fase, IdGiocatore, Stato, VocePila } from './tipi';

type FaseRisoluzione = Extract<Fase, { nome: 'risoluzione_dado' }>;

/** Estrae una faccia pesando le copie. */
export function estraiFaccia(s: ConRng, facce: FacciaDado[]): FacciaDado {
  const totale = facce.reduce((somma, f) => somma + f.copie, 0);
  let x = intero(s, totale);
  for (const f of facce) {
    if (x < f.copie) return f;
    x -= f.copie;
  }
  return facce[facce.length - 1] as FacciaDado;
}

export function faccia(s: Stato, id: string): FacciaDado {
  const f = s.config.dado.find((x) => x.id === id);
  if (!f) errore('fase_errata', `Faccia sconosciuta: ${id}`);
  return f;
}

export function lanciatoreCorrente(s: Stato): IdGiocatore | null {
  if (s.fase.nome === 'dado') return s.datiRound.lanciatori[s.fase.indice] ?? null;
  if (s.fase.nome === 'risoluzione_dado') return s.fase.lanciatore;
  return null;
}

function avversari(s: Stato, id: IdGiocatore): IdGiocatore[] {
  return s.giocatori.filter((g) => g.id !== id && !g.eliminato).map((g) => g.id);
}

export interface ParametriFurto {
  daAvversari: number;
  dalGregge: number;
  /** Avversari non eliminati con almeno un agnellino. */
  derubabili: IdGiocatore[];
  /** Ripartizione automatica, se è obbligata. */
  obbligata: Record<IdGiocatore, number> | null;
}

export function parametriFurto(s: Stato, id: IdGiocatore, quantita: number): ParametriFurto {
  const efficace = Math.min(quantita, postiLiberi(s, id));
  const derubabili = avversari(s, id).filter((a) => giocatore(s, a).agnellini > 0);
  const disponibili = derubabili.reduce((somma, a) => somma + giocatore(s, a).agnellini, 0);
  const daAvversari = Math.min(efficace, disponibili);
  const dalGregge = Math.min(efficace - daAvversari, s.gregge);
  let obbligata: Record<IdGiocatore, number> | null = null;
  if (derubabili.length <= 1) {
    obbligata = {};
    const unico = derubabili[0];
    if (unico !== undefined && daAvversari > 0) obbligata[unico] = daAvversari;
  } else if (daAvversari === disponibili) {
    obbligata = Object.fromEntries(derubabili.map((a) => [a, giocatore(s, a).agnellini]));
  }
  return { daAvversari, dalGregge, derubabili, obbligata };
}

export function bersagliTestata(s: Stato, id: IdGiocatore): IdGiocatore[] {
  return avversari(s, id).filter((a) => giocatore(s, a).agnellini >= 1);
}

/** Tutte le ripartizioni valide del furto tra gli avversari derubabili. */
export function ripartizioniFurto(s: Stato, id: IdGiocatore, quantita: number): Array<Record<IdGiocatore, number>> {
  const p = parametriFurto(s, id, quantita);
  const risultati: Array<Record<IdGiocatore, number>> = [];
  const parziale: Record<IdGiocatore, number> = {};
  const visita = (k: number, resto: number): void => {
    if (k === p.derubabili.length) {
      if (resto === 0) risultati.push({ ...parziale });
      return;
    }
    const a = p.derubabili[k] as IdGiocatore;
    const massimo = Math.min(resto, giocatore(s, a).agnellini);
    for (let x = 0; x <= massimo; x++) {
      parziale[a] = x;
      visita(k + 1, resto - x);
    }
  };
  visita(0, p.daAvversari);
  return risultati;
}

function prossimoLanciatore(s: Stato, indice: number): void {
  const prossimo = indice + 1;
  if (prossimo < s.datiRound.lanciatori.length) s.fase = { nome: 'dado', indice: prossimo };
  else dopoIlDado(s);
}

export function lanciaDado(s: Stato, a: Extract<Azione, { tipo: 'lanciaDado' }>): void {
  richiediLibero(s);
  const f = richiediFase(s, 'dado');
  giocatoreAttivo(s, a.giocatore);
  const lanciatore = s.datiRound.lanciatori[f.indice];
  if (a.giocatore !== lanciatore) errore('non_tocca_a_te', `Lancia ${String(lanciatore)}`);
  const uscita = estraiFaccia(s, s.config.dado);
  emetti(s, { tipo: 'dado_lanciato', giocatore: lanciatore, faccia: uscita.id });
  const fase: FaseRisoluzione = {
    nome: 'risoluzione_dado',
    indice: f.indice,
    lanciatore,
    faccia: uscita.id,
    passo: 'dichiarazione',
    dichiarazione: null,
  };
  s.fase = fase;
  switch (uscita.effetto) {
    case 'pascolo': {
      const quantita = Math.min(uscita.quantita, s.gregge, postiLiberi(s, lanciatore));
      if (quantita === 0) prossimoLanciatore(s, f.indice);
      else dichiara(s, fase, { effetto: 'pascolo', quantita });
      break;
    }
    case 'furto': {
      const p = parametriFurto(s, lanciatore, uscita.quantita);
      if (p.daAvversari + p.dalGregge === 0) prossimoLanciatore(s, f.indice);
      else if (p.obbligata) dichiara(s, fase, { effetto: 'furto', daAvversari: p.obbligata, dalGregge: p.dalGregge });
      break;
    }
    case 'testata': {
      const bersagli = bersagliTestata(s, lanciatore);
      if (bersagli.length === 0) prossimoLanciatore(s, f.indice);
      else if (bersagli.length === 1) dichiara(s, fase, { effetto: 'testata', bersaglio: bersagli[0] as IdGiocatore });
      break;
    }
  }
}

function dichiara(s: Stato, fase: FaseRisoluzione, dichiarazione: DichiarazioneDado): void {
  fase.dichiarazione = dichiarazione;
  fase.passo = 'reazione';
  mettiInPila(s, fase.lanciatore, { tipo: 'dado', faccia: fase.faccia, dichiarazione: structuredClone(dichiarazione) });
}

function richiediLanciatore(s: Stato, id: IdGiocatore, passo: FaseRisoluzione['passo']): FaseRisoluzione {
  richiediLibero(s);
  const f = richiediFase(s, 'risoluzione_dado');
  giocatoreAttivo(s, id);
  if (id !== f.lanciatore) errore('non_tocca_a_te', `Decide ${f.lanciatore}`);
  if (f.passo !== passo) errore('fase_errata', `Il dado è al passo ${f.passo}`);
  return f;
}

export function dichiaraDado(s: Stato, a: Extract<Azione, { tipo: 'dichiaraDado' }>): void {
  const f = richiediLanciatore(s, a.giocatore, 'dichiarazione');
  const uscita = faccia(s, f.faccia);
  if ((uscita.effetto === 'furto' && a.bersaglio !== undefined) || (uscita.effetto === 'testata' && a.furto !== undefined)) {
    errore('scelta_non_valida', 'Parametro non previsto per questa faccia');
  }
  if (uscita.effetto === 'furto') {
    const p = parametriFurto(s, f.lanciatore, uscita.quantita);
    const furto = a.furto;
    if (!furto || typeof furto !== 'object') errore('ripartizione_non_valida', 'Manca la ripartizione del furto');
    let somma = 0;
    const daAvversari: Record<IdGiocatore, number> = {};
    for (const [id, quanti] of Object.entries(furto)) {
      const vittima = trovaGiocatore(s, id);
      if (!vittima || vittima.eliminato || id === f.lanciatore) {
        errore('ripartizione_non_valida', `${id} non è un avversario derubabile`);
      }
      if (!eIntero(quanti) || quanti < 0 || quanti > vittima.agnellini) {
        errore('ripartizione_non_valida', `Quantità non valida per ${id}`);
      }
      somma += quanti;
      if (quanti > 0) daAvversari[id] = quanti;
    }
    if (somma !== p.daAvversari) errore('ripartizione_non_valida', `Bisogna rubare ${p.daAvversari} agnellini agli avversari`);
    dichiara(s, f, { effetto: 'furto', daAvversari, dalGregge: p.dalGregge });
  } else if (uscita.effetto === 'testata') {
    if (a.bersaglio === undefined || !bersagliTestata(s, f.lanciatore).includes(a.bersaglio)) {
      errore('bersaglio_non_valido', 'Bersaglio della Testata non valido');
    }
    dichiara(s, f, { effetto: 'testata', bersaglio: a.bersaglio });
  } else {
    errore('fase_errata', 'Il Pascolo non richiede dichiarazione');
  }
}

export function dadoRisolto(s: Stato, voce: VocePila): void {
  const f = richiediFase(s, 'risoluzione_dado');
  const d = voce.dettagli;
  if (d.tipo !== 'dado') return;
  const lanciatore = f.lanciatore;
  const dich = d.dichiarazione;
  if (dich.effetto === 'pascolo') {
    const quanti = Math.min(dich.quantita, s.gregge, postiLiberi(s, lanciatore));
    spostaAgnellini(s, 'gregge', lanciatore, quanti, 'pascolo');
    controllaOvilePieno(s, lanciatore);
  } else if (dich.effetto === 'furto') {
    for (const [id, voluti] of Object.entries(dich.daAvversari)) {
      const vittima = trovaGiocatore(s, id);
      if (!vittima || vittima.eliminato) continue;
      const quanti = Math.min(voluti, vittima.agnellini, postiLiberi(s, lanciatore));
      spostaAgnellini(s, id, lanciatore, quanti, 'furto');
    }
    const dalGregge = Math.min(dich.dalGregge, s.gregge, postiLiberi(s, lanciatore));
    spostaAgnellini(s, 'gregge', lanciatore, dalGregge, 'furto');
    controllaOvilePieno(s, lanciatore);
  } else {
    f.passo = 'esito_testata';
    return;
  }
  prossimoLanciatore(s, f.indice);
}

export function dadoAnnullato(s: Stato): void {
  const f = richiediFase(s, 'risoluzione_dado');
  prossimoLanciatore(s, f.indice);
}

export function massimoEsitoTestata(s: Stato): number {
  if (s.fase.nome !== 'risoluzione_dado' || s.fase.dichiarazione?.effetto !== 'testata') return 0;
  const bersaglio = trovaGiocatore(s, s.fase.dichiarazione.bersaglio);
  return Math.min(s.config.esitoMassimoTestata, bersaglio?.agnellini ?? 0);
}

export function esitoTestata(s: Stato, a: Extract<Azione, { tipo: 'esitoTestata' }>): void {
  const f = richiediLanciatore(s, a.giocatore, 'esito_testata');
  const dich = f.dichiarazione;
  if (dich?.effetto !== 'testata') errore('fase_errata', 'Nessuna Testata da risolvere');
  const massimo = massimoEsitoTestata(s);
  if (!eIntero(a.esito) || a.esito < 0 || a.esito > massimo) {
    errore('esito_non_valido', `L'esito deve essere tra 0 e ${massimo}`);
  }
  spostaAgnellini(s, dich.bersaglio, 'gregge', a.esito, 'testata');
  emetti(s, { tipo: 'testata', giocatore: f.lanciatore, bersaglio: dich.bersaglio, esito: a.esito });
  prossimoLanciatore(s, f.indice);
}
