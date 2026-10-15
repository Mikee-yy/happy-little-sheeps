// Preparazione e ciclo del round: guaio, scelta, rivelazione, fine round (sezioni 3, 4.1–4.3, 4.12).
import {
  datiRoundVuoti,
  emetti,
  errore,
  giocatore,
  giocatoreAttivo,
  haTrovata,
  ordineDa,
  pesca,
  richiediFase,
  richiediLibero,
  successivoNonEliminato,
} from './comune';
import { configPer, creaMazzoGuai, creaMazzoPrincipale, defTrovata, eTrovata, pecoraEsiste, tipoDi } from './dati';
import { entraEffetti } from './effetti';
import { vittoriaMazzoFinito } from './fine';
import { proseguiGuaioAlPeggiore } from './guai';
import { righeDiBase } from './punteggio';
import { intero, mescola } from './rng';
import type { Azione, IdCarta, IdGiocatore, IdPecora, IdTipoCarta, Preparazione, Stato } from './tipi';

/**
 * Id non vuoto e diverso dai nomi di Object.prototype ("__proto__", "constructor", "toString"…):
 * lo stato indicizza per id oggetti semplici (giocate, punteggi, scelte), dove quei nomi non sono chiavi sicure.
 */
function idValido(id: unknown): id is IdGiocatore {
  return typeof id === 'string' && id !== '' && !(id in Object.prototype);
}

export function nuovaPartita(o: {
  giocatori: Array<{ id: IdGiocatore; nome: string; pecora: IdPecora }>;
  seme: number;
  /** Partita di prova: mani, cima del mazzo e dei Guai, primi tiri del dado (engine/data/prova.json). */
  preparazione?: Preparazione;
}): Stato {
  if (!Array.isArray(o?.giocatori) || o.giocatori.length < 2 || o.giocatori.length > 4) {
    errore('giocatori_non_validi', 'Servono da 2 a 4 giocatori');
  }
  // Array.from trasforma i buchi di un array sparso in undefined: map e some non li saltano più.
  const elenco = Array.from(o.giocatori);
  const ids = elenco.map((g) => g?.id);
  if (ids.some((id) => !idValido(id)) || new Set(ids).size !== ids.length) {
    errore('giocatori_non_validi', 'Gli id dei giocatori devono essere unici');
  }
  if (elenco.some((g) => typeof g.nome !== 'string' || g.nome.trim() === '')) {
    errore('giocatori_non_validi', 'Ogni giocatore deve avere un nome');
  }
  const pecore = elenco.map((g) => g.pecora);
  if (pecore.some((p) => !pecoraEsiste(p)) || new Set(pecore).size !== pecore.length) {
    errore('giocatori_non_validi', 'Ogni giocatore deve avere una pecora diversa');
  }
  if (typeof o.seme !== 'number' || !Number.isFinite(o.seme)) errore('giocatori_non_validi', 'Seme non valido');

  const n = elenco.length;
  const config = configPer(n);
  const s: Stato = {
    config,
    rng: o.seme >>> 0,
    giocatori: elenco.map((g) => ({
      id: g.id,
      nome: g.nome,
      pecora: g.pecora,
      mano: [],
      agnellini: config.agnelliniIniziali,
      angolo: [],
      eliminato: false,
    })),
    gregge: config.agnelliniTotali - config.agnelliniIniziali * n,
    mazzo: creaMazzoPrincipale(n),
    scarti: [],
    mazzoGuai: creaMazzoGuai(),
    guaiFuoriGioco: [],
    round: 1,
    primoGiocatore: elenco[0]!.id,
    ultimoRound: null,
    fase: { nome: 'guaio' },
    datiRound: datiRoundVuoti(1, null),
    pila: [],
    finestra: null,
    richiesta: null,
    prossimaVoce: 1,
    esito: null,
    eventi: [],
    prossimoEvento: 1,
  };
  mescola(s, s.mazzo);
  mescola(s, s.mazzoGuai);
  if (o.preparazione) applicaPreparazione(s, o.preparazione);
  else s.primoGiocatore = s.giocatori[intero(s, n)]!.id;
  const ordine = ordineDa(s, s.primoGiocatore);
  for (let k = 0; k < config.manoIniziale; k++) {
    for (const id of ordine) {
      // Con la preparazione le mani sono già (in parte) date: si completano fino alla mano iniziale
      if (giocatore(s, id).mano.length > k) continue;
      const carta = s.mazzo.shift();
      if (carta !== undefined) giocatore(s, id).mano.push(carta);
    }
  }
  iniziaRound(s, 1);
  return s;
}

/** Partita di prova: dopo la mescolata mette al loro posto le carte preparate e fissa i primi tiri del dado. */
function applicaPreparazione(s: Stato, p: Preparazione): void {
  const prendi = (mazzo: IdCarta[], tipo: IdTipoCarta): IdCarta => {
    const i = mazzo.findIndex((c) => tipoDi(c) === tipo);
    if (i < 0) errore('preparazione_non_valida', `Carta non disponibile per la preparazione: ${tipo}`);
    return mazzo.splice(i, 1)[0]!;
  };
  for (const g of s.giocatori) g.mano = (p.mani[g.id] ?? []).map((t) => prendi(s.mazzo, t));
  s.mazzo.unshift(...p.cimaMazzo.map((t) => prendi(s.mazzo, t)));
  s.mazzoGuai.unshift(...p.cimaGuai.map((t) => prendi(s.mazzoGuai, t)));
  if (!s.giocatori.some((g) => g.id === p.primoGiocatore)) errore('preparazione_non_valida', `Primo giocatore sconosciuto: ${p.primoGiocatore}`);
  s.primoGiocatore = p.primoGiocatore;
  for (const f of p.dado) if (!s.config.dado.some((d) => d.id === f)) errore('preparazione_non_valida', `Faccia sconosciuta: ${f}`);
  s.dadoPreparato = [...p.dado];
}

export function iniziaRound(s: Stato, numero: number): void {
  s.round = numero;
  if (numero > 1) s.primoGiocatore = successivoNonEliminato(s, s.primoGiocatore);
  s.datiRound = datiRoundVuoti(numero, null);
  const ultimo = s.ultimoRound === numero;
  emetti(s, { tipo: 'round_iniziato', round: numero, ultimo });
  if (ultimo) {
    s.fase = { nome: 'ultimo_round' };
    return;
  }
  scopriGuaio(s);
  s.fase = { nome: 'guaio' };
}

function scopriGuaio(s: Stato): void {
  if (s.mazzoGuai.length === 0 && s.guaiFuoriGioco.length > 0) {
    const quanti = s.guaiFuoriGioco.length;
    s.mazzoGuai.push(...s.guaiFuoriGioco.splice(0));
    mescola(s, s.mazzoGuai);
    emetti(s, { tipo: 'guai_rimescolati', quanti });
  }
  const guaio = s.mazzoGuai.shift() ?? null;
  s.datiRound.guaio = guaio;
  emetti(s, { tipo: 'guaio_rivelato', carta: guaio });
}

/** Ripescate e partecipanti; poi la scelta segreta (o subito la rivelazione se non partecipa nessuno). */
function entraScelta(s: Stato): void {
  const partecipanti = new Set<IdGiocatore>();
  for (const id of ordineDa(s, s.primoGiocatore)) {
    const g = giocatore(s, id);
    while (!haTrovata(g)) {
      if (s.mazzo.length === 0) {
        emetti(s, { tipo: 'fuori_dal_round', giocatore: id });
        break;
      }
      const scartate = g.mano.splice(0);
      s.scarti.push(...scartate);
      if (scartate.length > 0) emetti(s, { tipo: 'scartate', giocatore: id, carte: [...scartate], causa: 'ripescata' });
      const pescate = pesca(s, id, s.config.manoIniziale);
      emetti(s, { tipo: 'ripescata', giocatore: id, scartate: scartate.length, pescate: pescate.length });
    }
    if (haTrovata(g)) partecipanti.add(id);
  }
  s.datiRound.partecipanti = s.giocatori.filter((g) => partecipanti.has(g.id)).map((g) => g.id);
  if (partecipanti.size === 0) {
    entraRivelazione(s, {});
    return;
  }
  s.fase = {
    nome: 'scelta',
    scelte: Object.fromEntries(s.datiRound.partecipanti.map((id) => [id, null])),
  };
}

/** Una Trovata, oppure due Gemelle distinte. */
export function sceltaValida(mano: IdCarta[], carte: unknown): carte is IdCarta[] {
  if (!Array.isArray(carte) || carte.length < 1 || carte.length > 2) return false;
  if (carte.some((c) => typeof c !== 'string' || !mano.includes(c) || !eTrovata(c))) return false;
  if (carte.length === 2) {
    const [a, b] = carte as [IdCarta, IdCarta];
    return a !== b && defTrovata(a).gemella && defTrovata(b).gemella;
  }
  return true;
}

export function scegliTrovata(s: Stato, a: Extract<Azione, { tipo: 'scegliTrovata' }>): void {
  richiediLibero(s);
  const f = richiediFase(s, 'scelta');
  const g = giocatoreAttivo(s, a.giocatore);
  if (!Object.hasOwn(f.scelte, g.id)) errore('non_tocca_a_te', `${g.id} non partecipa al round`);
  if (!Array.isArray(a.carte) || a.carte.length < 1 || a.carte.length > 2) {
    errore('scelta_non_valida', 'Scegli una Trovata o due Gemelle');
  }
  for (const c of a.carte) {
    if (typeof c !== 'string' || !g.mano.includes(c)) errore('carta_non_in_mano', `${String(c)} non è in mano`);
    if (!eTrovata(c)) errore('carta_non_valida', `${c} non è una Trovata`);
  }
  if (!sceltaValida(g.mano, a.carte)) errore('scelta_non_valida', 'Due carte solo se sono due Gemelle distinte');
  // L'evento arriva solo alla prima scelta: un cambio di carta (D40) resta segreto.
  if (f.scelte[g.id] === null) emetti(s, { tipo: 'ha_scelto', giocatore: g.id });
  f.scelte[g.id] = [...a.carte];
  if (Object.values(f.scelte).every((c) => c !== null)) entraRivelazione(s, f.scelte);
}

function entraRivelazione(s: Stato, scelte: Record<IdGiocatore, IdCarta[] | null>): void {
  s.fase = { nome: 'rivelazione' };
  for (const id of s.datiRound.partecipanti) {
    const carte = scelte[id] ?? [];
    const g = giocatore(s, id);
    for (const c of carte) g.mano.splice(g.mano.indexOf(c), 1);
    s.datiRound.giocate[id] = [...carte];
    s.datiRound.tavolo.push(...carte);
  }
  emetti(s, { tipo: 'rivelazione', giocate: structuredClone(s.datiRound.giocate) });
  righeDiBase(s);
}

export function entraFineRound(s: Stato): void {
  s.fase = { nome: 'fine_round' };
  s.scarti.push(...s.datiRound.tavolo.splice(0));
  if (s.ultimoRound !== null && s.round >= s.ultimoRound) vittoriaMazzoFinito(s);
  for (const id of ordineDa(s, s.primoGiocatore)) {
    const mancano = s.config.manoIniziale - giocatore(s, id).mano.length;
    if (mancano > 0) pesca(s, id, mancano);
  }
}

export function prosegui(s: Stato): void {
  richiediLibero(s);
  switch (s.fase.nome) {
    case 'guaio':
      entraScelta(s);
      return;
    case 'rivelazione':
      entraEffetti(s);
      return;
    case 'guaio_al_peggiore':
      proseguiGuaioAlPeggiore(s);
      return;
    case 'fine_round':
      iniziaRound(s, s.round + 1);
      return;
    case 'ultimo_round':
      scopriGuaio(s);
      s.fase = { nome: 'guaio' };
      return;
    default:
      errore('fase_errata', `La fase ${s.fase.nome} aspetta i giocatori`);
  }
}
