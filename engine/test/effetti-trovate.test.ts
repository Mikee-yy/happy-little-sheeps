// Effetti delle Trovate e ordine di risoluzione.
// Regole: brief sezione 3 ("Svolgimento di un round", punto 4; "Scambio dei punteggi") e sezione 4 ("Carte Trovata");
// specifica docs/motore.md sezioni 4.4, 4.5, 5, 6, 7, 9, 10, 11 e decisioni D4, D8, D10–D18, D31, D34, D39.
import { describe, expect, it } from 'vitest';
import { applica, azioniPossibili, configPer, ErroreRegola, inAttesaDi, vistaPer } from '../src';
import type {
  Azione,
  Evento,
  Fase,
  IdCarta,
  IdGiocatore,
  IdTipoCarta,
  RigaPunteggio,
  Stato,
  StatoGiocatore,
  TipoRiga,
  VoceEffetto,
  VocePila,
} from '../src';
import { carta, chiudiPunteggio, nessunaReazione, prosegui, rinunciaTutti, scegli, scenario, totale } from './aiuti';
import type { OpzioniScenario } from './aiuti';

// ─── Aiuti locali ────────────────────────────────────────────────────────────

/** Tosatura a Sorpresa: nessun tratto, i totali sono i soli valori stampati. */
const NEUTRO = 'tosatura-a-sorpresa';
/** Guaio Meteo: Ricciolo (g1) +1, Brontolana (g2) 0, Sospirella (g3) −1, Nerina (g4) −1. */
const METEO = 'grandine-a-sorpresa';

type Scelte = Record<IdGiocatore, Array<IdTipoCarta | IdCarta>>;
type FaseEffetti = Extract<Fase, { nome: 'effetti' }>;
type EventoDi<T extends Evento['tipo']> = Extract<Evento, { tipo: T }>;

/** scenario → scelta → rivelazione → ingresso in 'effetti' (o oltre, se la coda si esaurisce da sola). */
function finoAgliEffetti(o: OpzioniScenario, scelte: Scelte): Stato {
  let s = prosegui(scenario(o));
  expect(s.fase.nome).toBe('scelta');
  s = scegli(s, scelte);
  expect(s.fase.nome).toBe('rivelazione');
  return prosegui(s);
}

function effetti(s: Stato): FaseEffetti {
  if (s.fase.nome !== 'effetti') throw new Error(`fase attesa 'effetti', trovata '${s.fase.nome}'`);
  return s.fase;
}

function corrente(s: Stato): VoceEffetto {
  const f = effetti(s);
  const v = f.coda[f.indice];
  if (!v) throw new Error('nessuna voce corrente nella coda');
  return v;
}

/** Ordine della coda come "giocatore:effetto". */
function ordine(s: Stato): string[] {
  return effetti(s).coda.map((v) => `${v.giocatore}:${v.effetto}`);
}

function esiti(s: Stato): string[] {
  return effetti(s).coda.map((v) => v.esito);
}

function gioc(s: Stato, id: IdGiocatore): StatoGiocatore {
  const g = s.giocatori.find((x) => x.id === id);
  if (!g) throw new Error(`giocatore ${id} inesistente`);
  return g;
}

const mano = (s: Stato, id: IdGiocatore): IdCarta[] => gioc(s, id).mano;
const agnellini = (s: Stato, id: IdGiocatore): number => gioc(s, id).agnellini;
const ordinate = (x: readonly string[]): string[] => [...x].sort();

/** Istanza di `tipo` giocata da `g` nel round. */
function giocata(s: Stato, g: IdGiocatore, tipo: IdTipoCarta): IdCarta {
  const c = (s.datiRound.giocate[g] ?? []).find((id) => id.split('#')[0] === tipo);
  if (c === undefined) throw new Error(`${g} non ha giocato ${tipo}`);
  return c;
}

function righe(s: Stato, g: IdGiocatore, tipo?: TipoRiga): RigaPunteggio[] {
  const tutte = s.datiRound.punteggi[g] ?? [];
  return tipo ? tutte.filter((r) => r.tipo === tipo) : tutte;
}

function cima(s: Stato): VocePila {
  const v = s.pila[s.pila.length - 1];
  if (!v) throw new Error('pila vuota');
  return v;
}

function nuoviEventi(prima: Stato, dopo: Stato): Evento[] {
  return dopo.eventi.filter((e) => e.seq >= prima.prossimoEvento);
}

function eventiDi<T extends Evento['tipo']>(prima: Stato, dopo: Stato, tipo: T): EventoDi<T>[] {
  return nuoviEventi(prima, dopo).filter((e): e is EventoDi<T> => e.tipo === tipo);
}

/** Carte delle voci che hanno ricevuto l'esito indicato (eventi 'effetto') tra `prima` e `dopo`. */
function carteConEsito(prima: Stato, dopo: Stato, esito: VoceEffetto['esito']): IdCarta[] {
  return ordinate(eventiDi(prima, dopo, 'effetto').filter((e) => e.esito === esito).map((e) => e.carta));
}

/** Il proprietario della voce corrente la attiva (con bersaglio solo se indicato). */
function attiva(s: Stato, bersaglio?: IdGiocatore): Stato {
  const v = corrente(s);
  const azione: Azione =
    bersaglio === undefined
      ? { tipo: 'attivaEffetto', giocatore: v.giocatore, carta: v.carta }
      : { tipo: 'attivaEffetto', giocatore: v.giocatore, carta: v.carta, bersaglio };
  return applica(s, azione);
}

function rinuncia(s: Stato): Stato {
  const v = corrente(s);
  return applica(s, { tipo: 'rinunciaEffetto', giocatore: v.giocatore, carta: v.carta });
}

/** Attiva la voce corrente e lascia chiudere la finestra senza reazioni. */
function attivaERisolvi(s: Stato, bersaglio?: IdGiocatore): Stato {
  return nessunaReazione(attiva(s, bersaglio));
}

function beeeNo(s: Stato, g: IdGiocatore): Stato {
  return applica(s, { tipo: 'giocaBelato', giocatore: g, carta: carta(s, g, 'beee-no'), voce: cima(s).id });
}

function completa(s: Stato, carte: IdCarta[]): Stato {
  if (!s.richiesta) throw new Error('nessuna richiesta in corso');
  return applica(s, { tipo: 'completaEffetto', giocatore: s.richiesta.giocatore, carte });
}

function belatoPunteggio(s: Stato, g: IdGiocatore, tipo: IdTipoCarta, bersaglio: IdGiocatore): Stato {
  return nessunaReazione(applica(s, { tipo: 'giocaBelato', giocatore: g, carta: carta(s, g, tipo), bersaglio }));
}

function rifiutata(s: Stato, azione: Azione): void {
  const copia = structuredClone(s);
  expect(() => applica(s, azione)).toThrow(ErroreRegola);
  expect(s).toEqual(copia);
}

// ─── Coda e attivazione ──────────────────────────────────────────────────────

describe('Coda degli effetti (specifica 4.4)', () => {
  it('ha una voce per ogni Trovata giocata con effetto, con gruppo e valore stampato; Gemelle e Trovate senza effetto non entrano (D9)', () => {
    const s = finoAgliEffetti(
      {
        guaio: NEUTRO,
        mani: {
          g1: ['agnellino-smarrito', 'carriola'],
          g2: ['calzino-gemello#1', 'calzino-gemello#2'],
          g3: ['capriola'],
        },
      },
      { g1: ['agnellino-smarrito'], g2: ['calzino-gemello#1', 'calzino-gemello#2'], g3: ['capriola'] },
    );
    const f = effetti(s);
    expect(f.indice).toBe(0);
    expect(f.coda).toEqual([
      {
        giocatore: 'g1',
        carta: giocata(s, 'g1', 'agnellino-smarrito'),
        effetto: 'prendi_agnellino',
        gruppo: 'normale',
        valore: 1,
        esito: 'attesa',
      },
      {
        giocatore: 'g3',
        carta: giocata(s, 'g3', 'capriola'),
        effetto: 'scambia_punteggi',
        gruppo: 'punteggio',
        valore: 5,
        esito: 'attesa',
      },
    ]);
    // §11: in 'effetti' si aspetta il proprietario della voce corrente.
    expect(inAttesaDi(s)).toEqual({ sistema: false, giocatori: ['g1'] });
  });

  it('azioniPossibili del proprietario: attivare o rinunciare alla voce corrente; gli altri non hanno azioni (§2, D11)', () => {
    const s = finoAgliEffetti(
      { guaio: NEUTRO, mani: { g1: ['agnellino-smarrito', 'carriola'], g2: ['sasso-comodo'], g3: ['megafono-di-latta'] } },
      { g1: ['agnellino-smarrito'], g2: ['sasso-comodo'], g3: ['megafono-di-latta'] },
    );
    const c = giocata(s, 'g1', 'agnellino-smarrito');
    const azioni = azioniPossibili(s, 'g1');
    expect(azioni).toHaveLength(2);
    expect(azioni).toContainEqual({ tipo: 'attivaEffetto', giocatore: 'g1', carta: c });
    expect(azioni).toContainEqual({ tipo: 'rinunciaEffetto', giocatore: 'g1', carta: c });
    expect(azioniPossibili(s, 'g2')).toEqual([]);
    expect(azioniPossibili(s, 'g3')).toEqual([]);
  });

  it('attivaEffetto mette in pila una voce effetto_trovata (evento dichiarazione) e apre la finestra a tutti tranne il proprietario; alla chiusura si applica (§4.4, §5)', () => {
    const s0 = finoAgliEffetti(
      { guaio: NEUTRO, gregge: 10, mani: { g1: ['agnellino-smarrito'], g2: ['carriola'], g3: ['megafono-di-latta'] } },
      { g1: ['agnellino-smarrito'], g2: ['carriola'], g3: ['megafono-di-latta'] },
    );
    const c = giocata(s0, 'g1', 'agnellino-smarrito');
    const s1 = attiva(s0);

    expect(s1.pila).toHaveLength(1);
    const voce = cima(s1);
    expect(voce.autore).toBe('g1');
    expect(voce.dettagli).toEqual({ tipo: 'effetto_trovata', carta: c, effetto: 'prendi_agnellino' });
    expect(s1.finestra?.voce).toBe(voce.id);
    expect(ordinate(s1.finestra?.inAttesa ?? [])).toEqual(['g2', 'g3']);
    expect(ordinate(inAttesaDi(s1).giocatori)).toEqual(['g2', 'g3']);
    expect(esiti(s1)).toEqual(['attivato', 'attesa']);
    expect(eventiDi(s0, s1, 'dichiarazione')).toContainEqual(
      expect.objectContaining({ voce: voce.id, autore: 'g1' }),
    );
    // Dichiarato ma non ancora applicato.
    expect(s1.gregge).toBe(10);
    expect(agnellini(s1, 'g1')).toBe(3);

    const s2 = nessunaReazione(s1);
    expect(s2.pila).toEqual([]);
    expect(s2.finestra).toBeNull();
    expect(s2.gregge).toBe(9);
    expect(agnellini(s2, 'g1')).toBe(4);
    expect(eventiDi(s1, s2, 'risolta')).toContainEqual(expect.objectContaining({ voce: voce.id }));
    expect(eventiDi(s1, s2, 'agnellini')).toContainEqual(
      expect.objectContaining({ da: 'gregge', a: 'g1', quanti: 1 }),
    );
    expect(esiti(s2)).toEqual(['attivato', 'attesa']);
    expect(corrente(s2).giocatore).toBe('g3');
    // Funzione pura: lo stato di partenza non cambia.
    expect(s0.pila).toEqual([]);
    expect(s0.gregge).toBe(10);
  });
});

// ─── Singoli effetti (tabella della specifica, sezione 6) ────────────────────

describe('scarta_e_somma — Scorta nel vello (§6, D16)', () => {
  const opzioni: OpzioniScenario = {
    guaio: NEUTRO,
    mani: {
      g1: ['scorta-nel-vello', 'corona-di-margherite', 'balla-di-fieno', 'pernacchia'],
      g2: ['carriola', 'coperta-di-lana'],
      g3: ['sasso-comodo'],
    },
  };
  const scelte: Scelte = { g1: ['scorta-nel-vello'], g2: ['carriola'], g3: ['sasso-comodo'] };
  const allaRichiesta = (): Stato => attivaERisolvi(finoAgliEffetti(opzioni, scelte));

  it('risolto l\'effetto, apre una richiesta al proprietario; le opzioni sono le Trovate della mano', () => {
    const s = allaRichiesta();
    expect(s.fase.nome).toBe('effetti');
    expect(s.richiesta).toEqual({ tipo: 'scarta_e_somma', giocatore: 'g1', carta: giocata(s, 'g1', 'scorta-nel-vello') });
    expect(inAttesaDi(s)).toEqual({ sistema: false, giocatori: ['g1'] });
    const opzioniG1 = azioniPossibili(s, 'g1');
    expect(opzioniG1).toHaveLength(2);
    expect(opzioniG1).toContainEqual({ tipo: 'completaEffetto', giocatore: 'g1', carte: [carta(s, 'g1', 'corona-di-margherite')] });
    expect(opzioniG1).toContainEqual({ tipo: 'completaEffetto', giocatore: 'g1', carte: [carta(s, 'g1', 'balla-di-fieno')] });
    expect(azioniPossibili(s, 'g2')).toEqual([]);
  });

  it('completaEffetto con una Trovata: va negli scarti e la riga effetto vale il suo valore stampato', () => {
    const s0 = allaRichiesta();
    const corona = carta(s0, 'g1', 'corona-di-margherite');
    const s1 = completa(s0, [corona]);
    expect(s1.richiesta).toBeNull();
    expect(mano(s1, 'g1')).not.toContain(corona);
    expect(s1.scarti).toContain(corona);
    expect(righe(s1, 'g1', 'effetto')).toEqual([expect.objectContaining({ tipo: 'effetto', delta: 9, carta: corona })]);
    expect(totale(s1, 'g1')).toBe(9); // 0 della Scorta + 9 della carta scartata
    expect(totale(s1, 'g2')).toBe(8);
    expect(s1.fase.nome).toBe('belati_punteggio');
  });

  it('rifiuta un Belato, carte non in mano, due Trovate, nessuna carta e un giocatore diverso', () => {
    const s = allaRichiesta();
    const corona = carta(s, 'g1', 'corona-di-margherite');
    const balla = carta(s, 'g1', 'balla-di-fieno');
    const completaEffetto = (giocatore: IdGiocatore, carte: IdCarta[]): Azione => ({ tipo: 'completaEffetto', giocatore, carte });
    rifiutata(s, completaEffetto('g1', [carta(s, 'g1', 'pernacchia')]));
    rifiutata(s, completaEffetto('g1', [carta(s, 'g2', 'coperta-di-lana')]));
    rifiutata(s, completaEffetto('g1', [giocata(s, 'g1', 'scorta-nel-vello')]));
    rifiutata(s, completaEffetto('g1', [corona, balla]));
    rifiutata(s, completaEffetto('g1', []));
    rifiutata(s, completaEffetto('g2', [carta(s, 'g2', 'coperta-di-lana')]));

    const s1 = completa(s, [balla]);
    expect(righe(s1, 'g1', 'effetto')).toEqual([expect.objectContaining({ delta: 5, carta: balla })]);
    expect(mano(s1, 'g1')).toContain(corona);
  });

  it('la carta scartata non attiva il proprio effetto: scartare una Capriola non scambia i punteggi', () => {
    let s = finoAgliEffetti(
      { guaio: NEUTRO, mani: { g1: ['scorta-nel-vello', 'capriola'], g2: ['carriola'], g3: ['sasso-comodo'] } },
      { g1: ['scorta-nel-vello'], g2: ['carriola'], g3: ['sasso-comodo'] },
    );
    expect(effetti(s).coda).toHaveLength(1);
    s = attivaERisolvi(s);
    s = completa(s, [carta(s, 'g1', 'capriola')]);
    expect(s.fase.nome).toBe('belati_punteggio');
    expect([totale(s, 'g1'), totale(s, 'g2'), totale(s, 'g3')]).toEqual([5, 8, 2]);
    for (const g of ['g1', 'g2', 'g3']) expect(righe(s, g, 'scambio')).toEqual([]);
  });

  it('senza Trovate in mano (solo Belati) l\'effetto è saltato', () => {
    const s = finoAgliEffetti(
      { guaio: NEUTRO, mani: { g1: ['scorta-nel-vello', 'pernacchia'], g2: ['carriola'], g3: ['megafono-di-latta'] } },
      { g1: ['scorta-nel-vello'], g2: ['carriola'], g3: ['megafono-di-latta'] },
    );
    expect(esiti(s)).toEqual(['saltato', 'attesa']);
    expect(corrente(s).giocatore).toBe('g3');
    expect(s.richiesta).toBeNull();
    expect(mano(s, 'g1')).toEqual([carta(s, 'g1', 'pernacchia')]);
    expect(totale(s, 'g1')).toBe(0);
  });
});

describe('prendi_agnellino — Agnellino smarrito, Fischietto da richiamo (§6, D39)', () => {
  it('Gregge −1, Ovile +1, con evento agnellini', () => {
    const s0 = finoAgliEffetti(
      { guaio: NEUTRO, gregge: 5, mani: { g1: ['fischietto-da-richiamo'], g2: ['carriola'], g3: ['sasso-comodo'] } },
      { g1: ['fischietto-da-richiamo'], g2: ['carriola'], g3: ['sasso-comodo'] },
    );
    expect(corrente(s0).effetto).toBe('prendi_agnellino');
    const s1 = attivaERisolvi(s0);
    expect(s1.gregge).toBe(4);
    expect(agnellini(s1, 'g1')).toBe(4);
    expect(agnellini(s1, 'g2')).toBe(3);
    expect(eventiDi(s0, s1, 'agnellini')).toContainEqual(expect.objectContaining({ da: 'gregge', a: 'g1', quanti: 1 }));
    expect(totale(s1, 'g1')).toBe(2); // l'effetto non tocca il punteggio
    expect(s1.fase.nome).toBe('belati_punteggio');
  });

  it('con il Gregge vuoto l\'effetto è saltato', () => {
    const s = finoAgliEffetti(
      { guaio: NEUTRO, gregge: 0, mani: { g1: ['agnellino-smarrito'], g2: ['carriola'], g3: ['megafono-di-latta'] } },
      { g1: ['agnellino-smarrito'], g2: ['carriola'], g3: ['megafono-di-latta'] },
    );
    expect(esiti(s)).toEqual(['saltato', 'attesa']);
    expect(corrente(s).giocatore).toBe('g3');
    expect(agnellini(s, 'g1')).toBe(3);
    expect(s.gregge).toBe(0);
  });

  it('l\'attivabilità si valuta quando la voce diventa corrente: con 1 solo agnellino nel Gregge il secondo è saltato', () => {
    let s = finoAgliEffetti(
      {
        guaio: NEUTRO,
        gregge: 1,
        mani: { g1: ['agnellino-smarrito'], g2: ['fischietto-da-richiamo'], g3: ['megafono-di-latta'] },
      },
      { g1: ['agnellino-smarrito'], g2: ['fischietto-da-richiamo'], g3: ['megafono-di-latta'] },
    );
    expect(ordine(s)).toEqual(['g1:prendi_agnellino', 'g2:prendi_agnellino', 'g3:raddoppia_belati']);
    s = attivaERisolvi(s);
    expect(s.gregge).toBe(0);
    expect(agnellini(s, 'g1')).toBe(4);
    expect(esiti(s)).toEqual(['attivato', 'saltato', 'attesa']);
    expect(corrente(s).giocatore).toBe('g3');
    expect(agnellini(s, 'g2')).toBe(3);
  });

  it('se riempie l\'Ovile la partita finisce subito, a metà round (§9.1)', () => {
    const posti = configPer(3).postiOvile;
    const s0 = finoAgliEffetti(
      {
        guaio: NEUTRO,
        agnellini: { g1: posti - 1 },
        mani: { g1: ['agnellino-smarrito'], g2: ['carriola'], g3: ['megafono-di-latta'] },
      },
      { g1: ['agnellino-smarrito'], g2: ['carriola'], g3: ['megafono-di-latta'] },
    );
    expect(s0.config.postiOvile).toBe(posti);
    const s1 = attivaERisolvi(s0);
    expect(agnellini(s1, 'g1')).toBe(posti);
    expect(s1.esito).toEqual({ modo: 'ovile_pieno', vincitori: ['g1'] });
    expect(s1.fase).toEqual({ nome: 'fine_partita' });
    expect(s1.pila).toEqual([]);
    expect(s1.finestra).toBeNull();
    expect(s1.richiesta).toBeNull();
    expect(eventiDi(s0, s1, 'fine_partita')).toHaveLength(1);
    expect(() => applica(s1, { tipo: 'rinunciaEffetto', giocatore: 'g3', carta: giocata(s1, 'g3', 'megafono-di-latta') })).toThrow(
      ErroreRegola,
    );
  });
});

describe('scarta_fino_a_tre — Pulizie di primavera (§6)', () => {
  const opzioni: OpzioniScenario = {
    guaio: NEUTRO,
    mani: {
      g1: ['pulizie-di-primavera', 'carriola', 'pernacchia', 'balla-di-fieno', 'corona-di-margherite'],
      g2: ['sasso-comodo', 'coperta-di-lana'],
      g3: ['megafono-di-latta'],
    },
  };
  const scelte: Scelte = { g1: ['pulizie-di-primavera'], g2: ['sasso-comodo'], g3: ['megafono-di-latta'] };
  const allaRichiesta = (): Stato => attivaERisolvi(finoAgliEffetti(opzioni, scelte));

  it('apre una richiesta al proprietario', () => {
    const s = allaRichiesta();
    expect(s.richiesta).toEqual({ tipo: 'scarta_fino_a_tre', giocatore: 'g1', carta: giocata(s, 'g1', 'pulizie-di-primavera') });
    expect(inAttesaDi(s)).toEqual({ sistema: false, giocatori: ['g1'] });
    expect(mano(s, 'g1')).toHaveLength(4);
  });

  it('con 0 carte la mano resta com\'è', () => {
    const s0 = allaRichiesta();
    const s1 = completa(s0, []);
    expect(s1.richiesta).toBeNull();
    expect(ordinate(mano(s1, 'g1'))).toEqual(ordinate(mano(s0, 'g1')));
    expect(s1.scarti).toEqual(s0.scarti);
    expect(esiti(s1)).toEqual(['attivato', 'attesa']);
    expect(corrente(s1).giocatore).toBe('g3');
  });

  it('con 1 carta (anche un Belato) la carta va negli scarti', () => {
    const s0 = allaRichiesta();
    const pernacchia = carta(s0, 'g1', 'pernacchia');
    const s1 = completa(s0, [pernacchia]);
    expect(mano(s1, 'g1')).toHaveLength(3);
    expect(mano(s1, 'g1')).not.toContain(pernacchia);
    expect(s1.scarti).toContain(pernacchia);
    expect(s1.scarti).toHaveLength(s0.scarti.length + 1);
  });

  it('con 3 carte le scarta tutte e tre; il punteggio non cambia', () => {
    const s0 = allaRichiesta();
    const via = [carta(s0, 'g1', 'carriola'), carta(s0, 'g1', 'pernacchia'), carta(s0, 'g1', 'balla-di-fieno')];
    const s1 = completa(s0, via);
    expect(mano(s1, 'g1')).toEqual([carta(s0, 'g1', 'corona-di-margherite')]);
    expect(s1.scarti).toEqual(expect.arrayContaining(via));
    expect(s1.scarti).toHaveLength(s0.scarti.length + 3);
    expect(righe(s1, 'g1')).toEqual(righe(s0, 'g1'));
    expect(totale(s1, 'g1')).toBe(3);
  });

  it('rifiuta 4 carte, carte ripetute, carte non in mano e un giocatore diverso', () => {
    const s = allaRichiesta();
    const [a, b, c, d] = mano(s, 'g1') as [IdCarta, IdCarta, IdCarta, IdCarta];
    rifiutata(s, { tipo: 'completaEffetto', giocatore: 'g1', carte: [a, b, c, d] });
    rifiutata(s, { tipo: 'completaEffetto', giocatore: 'g1', carte: [a, a] });
    rifiutata(s, { tipo: 'completaEffetto', giocatore: 'g1', carte: [carta(s, 'g2', 'coperta-di-lana')] });
    rifiutata(s, { tipo: 'completaEffetto', giocatore: 'g1', carte: [giocata(s, 'g1', 'pulizie-di-primavera')] });
    rifiutata(s, { tipo: 'completaEffetto', giocatore: 'g2', carte: [] });
  });

  it('azioniPossibili elenca tutti i sottoinsiemi da 0 a 3 carte (15 con 4 carte diverse) e applica li accetta tutti (§2)', () => {
    const s = allaRichiesta();
    const azioni = azioniPossibili(s, 'g1');
    expect(azioni).toHaveLength(15);
    const chiavi = new Set<string>();
    for (const a of azioni) {
      if (a.tipo !== 'completaEffetto') throw new Error(`azione inattesa ${a.tipo}`);
      expect(a.giocatore).toBe('g1');
      expect(a.carte.length).toBeLessThanOrEqual(3);
      chiavi.add(ordinate(a.carte).join(','));
      expect(() => applica(s, a)).not.toThrow();
    }
    expect(chiavi.size).toBe(15);
    expect(azioniPossibili(s, 'g2')).toEqual([]);
  });

  it('con la mano vuota l\'effetto è saltato', () => {
    const s = finoAgliEffetti(
      { guaio: NEUTRO, mani: { g1: ['pulizie-di-primavera'], g2: ['sasso-comodo'], g3: ['megafono-di-latta'] } },
      { g1: ['pulizie-di-primavera'], g2: ['sasso-comodo'], g3: ['megafono-di-latta'] },
    );
    expect(esiti(s)).toEqual(['saltato', 'attesa']);
    expect(s.richiesta).toBeNull();
  });
});

describe('sposta_agnellino — Campanaccio stonato (§6, D4)', () => {
  const mani = { g1: ['campanaccio-stonato'], g2: ['carriola'], g3: ['megafono-di-latta'] };
  const scelte: Scelte = { g1: ['campanaccio-stonato'], g2: ['carriola'], g3: ['megafono-di-latta'] };

  it('il bersaglio si dichiara con attivaEffetto, prima della finestra; alla risoluzione un suo agnellino torna nel Gregge', () => {
    const s0 = finoAgliEffetti({ guaio: NEUTRO, gregge: 10, agnellini: { g2: 3, g3: 0 }, mani }, scelte);
    const s1 = attiva(s0, 'g2');
    expect(cima(s1).dettagli).toEqual({
      tipo: 'effetto_trovata',
      carta: giocata(s0, 'g1', 'campanaccio-stonato'),
      effetto: 'sposta_agnellino',
      bersaglio: 'g2',
    });
    expect(agnellini(s1, 'g2')).toBe(3);
    const s2 = nessunaReazione(s1);
    expect(agnellini(s2, 'g2')).toBe(2);
    expect(agnellini(s2, 'g1')).toBe(3);
    expect(s2.gregge).toBe(11);
    expect(eventiDi(s1, s2, 'agnellini')).toContainEqual(expect.objectContaining({ da: 'g2', a: 'gregge', quanti: 1 }));
    expect(esiti(s2)).toEqual(['attivato', 'attesa']);
  });

  it('bersaglio obbligatorio: rifiutati senza bersaglio, se stessi, un avversario senza agnellini, un giocatore inesistente', () => {
    const s = finoAgliEffetti({ guaio: NEUTRO, agnellini: { g2: 3, g3: 0 }, mani }, scelte);
    const c = giocata(s, 'g1', 'campanaccio-stonato');
    rifiutata(s, { tipo: 'attivaEffetto', giocatore: 'g1', carta: c });
    rifiutata(s, { tipo: 'attivaEffetto', giocatore: 'g1', carta: c, bersaglio: 'g1' });
    rifiutata(s, { tipo: 'attivaEffetto', giocatore: 'g1', carta: c, bersaglio: 'g3' });
    rifiutata(s, { tipo: 'attivaEffetto', giocatore: 'g1', carta: c, bersaglio: 'g9' });
    expect(attiva(s, 'g2').pila).toHaveLength(1);
  });

  it('azioniPossibili: un\'attivazione per ogni avversario con agnellini, più la rinuncia', () => {
    const s = finoAgliEffetti(
      {
        giocatori: 4,
        guaio: NEUTRO,
        agnellini: { g1: 3, g2: 3, g3: 0, g4: 1 },
        mani: { g1: ['campanaccio-stonato'], g2: ['carriola'], g3: ['sasso-comodo'], g4: ['balla-di-fieno'] },
      },
      { g1: ['campanaccio-stonato'], g2: ['carriola'], g3: ['sasso-comodo'], g4: ['balla-di-fieno'] },
    );
    const azioni = azioniPossibili(s, 'g1');
    const bersagli = azioni.flatMap((a) => (a.tipo === 'attivaEffetto' ? [a.bersaglio ?? '(nessuno)'] : []));
    expect(ordinate(bersagli)).toEqual(['g2', 'g4']);
    expect(azioni.filter((a) => a.tipo === 'rinunciaEffetto')).toHaveLength(1);
    expect(azioni).toHaveLength(3);
  });

  it('può colpire un avversario che non partecipa al round (D34)', () => {
    let s = finoAgliEffetti(
      { guaio: NEUTRO, mazzo: [], agnellini: { g2: 0, g3: 3 }, mani: { g1: ['campanaccio-stonato'], g2: ['carriola'] } },
      { g1: ['campanaccio-stonato'], g2: ['carriola'] },
    );
    expect(s.datiRound.partecipanti).toEqual(['g1', 'g2']);
    s = attivaERisolvi(s, 'g3');
    expect(agnellini(s, 'g3')).toBe(2);
  });

  it('se nessun avversario ha agnellini l\'effetto è saltato', () => {
    const s = finoAgliEffetti({ guaio: NEUTRO, agnellini: { g1: 5, g2: 0, g3: 0 }, mani }, scelte);
    expect(esiti(s)).toEqual(['saltato', 'attesa']);
    expect(corrente(s).giocatore).toBe('g3');
    expect(agnellini(s, 'g1')).toBe(5);
  });
});

describe('guarda_due — Cannocchiale (§6, §10, D17, D31)', () => {
  const MAZZO = ['corona-di-margherite', 'trifoglio-qualunque', 'ombrello-bucato'];
  const mani = { g1: ['cannocchiale', 'carriola'], g2: ['sasso-comodo'], g3: ['balla-di-fieno'] };
  const scelte: Scelte = { g1: ['cannocchiale'], g2: ['sasso-comodo'], g3: ['balla-di-fieno'] };

  function allaRichiesta(): { s: Stato; c1: IdCarta; c2: IdCarta; c3: IdCarta } {
    const s0 = finoAgliEffetti({ guaio: NEUTRO, mazzo: MAZZO, mani }, scelte);
    const [c1, c2, c3] = s0.mazzo as [IdCarta, IdCarta, IdCarta];
    expect(s0.mazzo).toHaveLength(3);
    return { s: attivaERisolvi(s0), c1, c2, c3 };
  }

  it('con 2 o più carte nel mazzo prende le prime 2 e apre una richiesta con le carte guardate', () => {
    const { s, c1, c2, c3 } = allaRichiesta();
    expect(s.richiesta?.tipo).toBe('guarda_due');
    expect(s.richiesta?.giocatore).toBe('g1');
    expect(s.richiesta?.carta).toBe(giocata(s, 'g1', 'cannocchiale'));
    expect(ordinate(s.richiesta?.tipo === 'guarda_due' ? s.richiesta.carte : [])).toEqual(ordinate([c1, c2]));
    expect(s.mazzo).toEqual([c3]);
    expect(s.ultimoRound).toBeNull();
    expect(inAttesaDi(s)).toEqual({ sistema: false, giocatori: ['g1'] });
    const azioni = azioniPossibili(s, 'g1');
    expect(azioni).toHaveLength(2);
    expect(azioni).toContainEqual({ tipo: 'completaEffetto', giocatore: 'g1', carte: [c1] });
    expect(azioni).toContainEqual({ tipo: 'completaEffetto', giocatore: 'g1', carte: [c2] });
  });

  it('completaEffetto con una delle due: quella va in mano, l\'altra negli scarti', () => {
    const { s, c1, c2, c3 } = allaRichiesta();
    const s1 = completa(s, [c2]);
    expect(s1.richiesta).toBeNull();
    expect(ordinate(mano(s1, 'g1'))).toEqual(ordinate([carta(s, 'g1', 'carriola'), c2]));
    expect(s1.scarti).toContain(c1);
    expect(s1.scarti).not.toContain(c2);
    expect(s1.mazzo).toEqual([c3]);
    expect(s1.ultimoRound).toBeNull();
    expect(totale(s1, 'g1')).toBe(7);
    expect(s1.fase.nome).toBe('belati_punteggio');
  });

  it('rifiuta una carta non guardata, entrambe, nessuna e un giocatore diverso', () => {
    const { s, c1, c2, c3 } = allaRichiesta();
    rifiutata(s, { tipo: 'completaEffetto', giocatore: 'g1', carte: [c3] });
    rifiutata(s, { tipo: 'completaEffetto', giocatore: 'g1', carte: [carta(s, 'g1', 'carriola')] });
    rifiutata(s, { tipo: 'completaEffetto', giocatore: 'g1', carte: [c1, c2] });
    rifiutata(s, { tipo: 'completaEffetto', giocatore: 'g1', carte: [] });
    rifiutata(s, { tipo: 'completaEffetto', giocatore: 'g2', carte: [c1] });
  });

  it('le carte guardate non compaiono nella vista degli altri né nella vista tavolo (§10)', () => {
    const { s, c1, c2 } = allaRichiesta();
    const cannocchiale = giocata(s, 'g1', 'cannocchiale');

    const mia = vistaPer(s, 'g1');
    expect(mia.richiesta?.tipo).toBe('guarda_due');
    expect(ordinate(mia.richiesta?.tipo === 'guarda_due' ? mia.richiesta.carte : [])).toEqual(ordinate([c1, c2]));

    for (const chi of ['g2', 'g3', null] as const) {
      const v = vistaPer(s, chi);
      expect(v.richiesta).toEqual({ tipo: 'guarda_due', giocatore: 'g1', carta: cannocchiale, carte: [] });
      const testo = JSON.stringify(v);
      expect(testo).not.toContain(JSON.stringify(c1));
      expect(testo).not.toContain(JSON.stringify(c2));
    }

    // Dopo la scelta la carta tenuta resta segreta; quella scartata è negli scarti, pubblici.
    const s1 = completa(s, [c2]);
    const v2 = vistaPer(s1, 'g2');
    expect(JSON.stringify(v2)).not.toContain(JSON.stringify(c2));
    expect(v2.scarti).toContain(c1);
    expect(vistaPer(s1, 'g1').giocatori.find((g) => g.id === 'g1')?.mano).toContain(c2);
  });

  it('con 1 sola carta nel mazzo la tiene senza richiesta; avendo preso l\'ultima carta scatta l\'ultimo round (§9.3)', () => {
    const s0 = finoAgliEffetti({ guaio: NEUTRO, mazzo: ['corona-di-margherite'], mani }, scelte);
    const [unica] = s0.mazzo as [IdCarta];
    const s1 = attivaERisolvi(s0);
    expect(s1.richiesta).toBeNull();
    expect(mano(s1, 'g1')).toContain(unica);
    expect(s1.mazzo).toEqual([]);
    expect(s1.ultimoRound).toBe(2);
    expect(eventiDi(s0, s1, 'ultimo_round_annunciato')).toEqual([expect.objectContaining({ round: 2 })]);
    expect(JSON.stringify(vistaPer(s1, 'g2'))).not.toContain(JSON.stringify(unica));
    expect(s1.fase.nome).toBe('belati_punteggio');
  });

  it('se le 2 carte guardate sono le ultime del mazzo scatta l\'ultimo round', () => {
    const s0 = finoAgliEffetti({ guaio: NEUTRO, mazzo: ['corona-di-margherite', 'trifoglio-qualunque'], mani }, scelte);
    const [c1, c2] = s0.mazzo as [IdCarta, IdCarta];
    const s1 = attivaERisolvi(s0);
    expect(s1.mazzo).toEqual([]);
    const s2 = completa(s1, [c1]);
    expect(mano(s2, 'g1')).toContain(c1);
    expect(s2.scarti).toContain(c2);
    expect(s2.ultimoRound).toBe(2);
    expect(eventiDi(s0, s2, 'ultimo_round_annunciato')).toEqual([expect.objectContaining({ round: 2 })]);
  });

  it('con il mazzo vuoto l\'effetto è saltato', () => {
    const s = finoAgliEffetti(
      { guaio: NEUTRO, mazzo: [], mani: { g1: ['cannocchiale'], g2: ['sasso-comodo'], g3: ['megafono-di-latta'] } },
      { g1: ['cannocchiale'], g2: ['sasso-comodo'], g3: ['megafono-di-latta'] },
    );
    expect(esiti(s)).toEqual(['saltato', 'attesa']);
    expect(s.richiesta).toBeNull();
    expect(s.ultimoRound).toBeNull();
  });
});

describe('scambia_punteggi — Capriola (§7, D13; brief 3 "Scambio dei punteggi")', () => {
  it('il più alto e il più basso si scambiano sui totali correnti (tratti compresi); gli intermedi non cambiano', () => {
    // Meteo: g1 Ricciolo 5+1 = 6, g2 Brontolana 5, g3 Sospirella 8−1 = 7.
    const s0 = finoAgliEffetti(
      { guaio: METEO, mani: { g1: ['capriola'], g2: ['balla-di-fieno'], g3: ['carriola'] } },
      { g1: ['capriola'], g2: ['balla-di-fieno'], g3: ['carriola'] },
    );
    expect([totale(s0, 'g1'), totale(s0, 'g2'), totale(s0, 'g3')]).toEqual([6, 5, 7]);
    const s1 = attivaERisolvi(s0);
    expect(righe(s1, 'g3', 'scambio')).toEqual([expect.objectContaining({ tipo: 'scambio', delta: -2 })]);
    expect(righe(s1, 'g2', 'scambio')).toEqual([expect.objectContaining({ tipo: 'scambio', delta: 2 })]);
    expect(righe(s1, 'g1', 'scambio')).toEqual([]);
    expect([totale(s1, 'g1'), totale(s1, 'g2'), totale(s1, 'g3')]).toEqual([6, 7, 5]);
    // D13: si applica prima della finestra dei Belati di punteggio.
    expect(s1.fase.nome).toBe('belati_punteggio');
  });

  it('con pari merito a un estremo lo scambio vale per tutti i pari', () => {
    const s0 = finoAgliEffetti(
      {
        giocatori: 4,
        guaio: NEUTRO,
        mani: { g1: ['capriola'], g2: ['pantofola-gemella'], g3: ['pantofola-gemella'], g4: ['carriola'] },
      },
      { g1: ['capriola'], g2: ['pantofola-gemella'], g3: ['pantofola-gemella'], g4: ['carriola'] },
    );
    const s1 = attivaERisolvi(s0);
    expect(righe(s1, 'g4', 'scambio')).toEqual([expect.objectContaining({ delta: -6 })]);
    expect(righe(s1, 'g2', 'scambio')).toEqual([expect.objectContaining({ delta: 6 })]);
    expect(righe(s1, 'g3', 'scambio')).toEqual([expect.objectContaining({ delta: 6 })]);
    expect(righe(s1, 'g1', 'scambio')).toEqual([]);
    expect([totale(s1, 'g1'), totale(s1, 'g2'), totale(s1, 'g3'), totale(s1, 'g4')]).toEqual([5, 8, 8, 2]);
  });

  it('con pari merito al più alto: tutti i più alti scendono al minimo', () => {
    const s1 = attivaERisolvi(
      finoAgliEffetti(
        { guaio: NEUTRO, mani: { g1: ['capriola'], g2: ['carriola'], g3: ['carriola'] } },
        { g1: ['capriola'], g2: ['carriola'], g3: ['carriola'] },
      ),
    );
    expect(righe(s1, 'g2', 'scambio')).toEqual([expect.objectContaining({ delta: -3 })]);
    expect(righe(s1, 'g3', 'scambio')).toEqual([expect.objectContaining({ delta: -3 })]);
    expect(righe(s1, 'g1', 'scambio')).toEqual([expect.objectContaining({ delta: 3 })]);
    expect([totale(s1, 'g1'), totale(s1, 'g2'), totale(s1, 'g3')]).toEqual([8, 5, 5]);
  });

  it('se tutti sono pari lo scambio non può cambiare nulla e viene saltato (D11)', () => {
    const s1 = finoAgliEffetti(
      { guaio: NEUTRO, mani: { g1: ['capriola'], g2: ['balla-di-fieno'], g3: ['balla-di-fieno'] } },
      { g1: ['capriola'], g2: ['balla-di-fieno'], g3: ['balla-di-fieno'] },
    );
    expect(s1.fase.nome).toBe('belati_punteggio');
    expect(s1.pila).toEqual([]);
    const esitiEffetti = s1.eventi.filter((e) => e.tipo === 'effetto') as Array<EventoDi<'effetto'>>;
    expect(esitiEffetti.map((e) => e.esito)).toEqual(['saltato']);
    for (const g of ['g1', 'g2', 'g3']) {
      expect(righe(s1, g, 'scambio')).toEqual([]);
      expect(totale(s1, g)).toBe(5);
    }
  });

  it('due scambi di fila si compensano', () => {
    // Capriola di g1 (2 agnellini) prima di quella di g2 (3 agnellini).
    let s = finoAgliEffetti(
      { guaio: NEUTRO, agnellini: { g1: 2, g2: 3 }, mani: { g1: ['capriola'], g2: ['capriola'], g3: ['carriola'] } },
      { g1: ['capriola'], g2: ['capriola'], g3: ['carriola'] },
    );
    expect(ordine(s)).toEqual(['g1:scambia_punteggi', 'g2:scambia_punteggi']);
    s = attivaERisolvi(s);
    expect([totale(s, 'g1'), totale(s, 'g2'), totale(s, 'g3')]).toEqual([8, 8, 5]);
    s = attivaERisolvi(s);
    expect([totale(s, 'g1'), totale(s, 'g2'), totale(s, 'g3')]).toEqual([5, 5, 8]);
    for (const g of ['g1', 'g2', 'g3']) expect(righe(s, g, 'scambio')).toHaveLength(2);
  });
});

describe('raddoppia_belati — Megafono di latta (§6, §7, D14)', () => {
  it('imposta raddoppioBelati: nel round i Belati +2 e −2 valgono doppio', () => {
    const s0 = finoAgliEffetti(
      {
        guaio: NEUTRO,
        mani: { g1: ['megafono-di-latta'], g2: ['carriola'], g3: ['sasso-comodo', 'belato-di-gruppo', 'pernacchia'] },
      },
      { g1: ['megafono-di-latta'], g2: ['carriola'], g3: ['sasso-comodo'] },
    );
    expect(s0.datiRound.raddoppioBelati).toBe(false);
    let s = attivaERisolvi(s0);
    expect(s.datiRound.raddoppioBelati).toBe(true);
    expect(s.fase.nome).toBe('belati_punteggio');
    // L'effetto in sé non tocca i punteggi.
    expect([totale(s, 'g1'), totale(s, 'g2'), totale(s, 'g3')]).toEqual([6, 8, 2]);

    s = belatoPunteggio(s, 'g3', 'belato-di-gruppo', 'g3');
    expect(righe(s, 'g3', 'belato')).toEqual([expect.objectContaining({ tipo: 'belato', delta: 4 })]);
    s = belatoPunteggio(s, 'g3', 'pernacchia', 'g2');
    expect(righe(s, 'g2', 'belato')).toEqual([expect.objectContaining({ tipo: 'belato', delta: -4 })]);
    expect([totale(s, 'g2'), totale(s, 'g3')]).toEqual([4, 6]);
  });

  it('non è cumulabile: il secondo Megafono viene saltato e un Belato +2 vale 4, non 8 (D11, D14)', () => {
    let s = finoAgliEffetti(
      {
        guaio: NEUTRO,
        mani: { g1: ['megafono-di-latta'], g2: ['megafono-di-latta'], g3: ['sasso-comodo', 'belato-di-gruppo'] },
      },
      { g1: ['megafono-di-latta'], g2: ['megafono-di-latta'], g3: ['sasso-comodo'] },
    );
    s = attivaERisolvi(s);
    expect(s.fase.nome).toBe('belati_punteggio');
    const esitiEffetti = s.eventi.filter((e) => e.tipo === 'effetto') as Array<EventoDi<'effetto'>>;
    expect(esitiEffetti.map((e) => e.esito)).toEqual(['attivato', 'saltato']);
    expect(s.datiRound.raddoppioBelati).toBe(true);
    s = belatoPunteggio(s, 'g3', 'belato-di-gruppo', 'g3');
    expect(righe(s, 'g3', 'belato')).toEqual([expect.objectContaining({ delta: 4 })]);
  });
});

// ─── Effetti facoltativi e azioni rifiutate ──────────────────────────────────

describe('Effetti facoltativi (brief 3; D11)', () => {
  const opzioni: OpzioniScenario = {
    guaio: NEUTRO,
    gregge: 10,
    mani: { g1: ['agnellino-smarrito', 'carriola'], g2: ['sasso-comodo'], g3: ['megafono-di-latta'] },
  };
  const scelte: Scelte = { g1: ['agnellino-smarrito'], g2: ['sasso-comodo'], g3: ['megafono-di-latta'] };

  it('rinunciaEffetto: esito rinunciato, nessun cambiamento, nessuna finestra; si passa alla voce successiva', () => {
    const s0 = finoAgliEffetti(opzioni, scelte);
    const s1 = rinuncia(s0);
    expect(esiti(s1)).toEqual(['rinunciato', 'attesa']);
    expect(effetti(s1).indice).toBe(1);
    expect(corrente(s1).giocatore).toBe('g3');
    expect(s1.pila).toEqual([]);
    expect(s1.finestra).toBeNull();
    expect(s1.gregge).toBe(10);
    expect(agnellini(s1, 'g1')).toBe(3);
    expect(mano(s1, 'g1')).toEqual(mano(s0, 'g1'));
    expect(s1.datiRound.punteggi).toEqual(s0.datiRound.punteggi);
    expect(eventiDi(s0, s1, 'dichiarazione')).toEqual([]);
  });

  it('solo il proprietario della voce corrente può attivarla o rinunciarvi', () => {
    const s = finoAgliEffetti(opzioni, scelte);
    const c1 = giocata(s, 'g1', 'agnellino-smarrito');
    const c3 = giocata(s, 'g3', 'megafono-di-latta');
    rifiutata(s, { tipo: 'attivaEffetto', giocatore: 'g2', carta: c1 });
    rifiutata(s, { tipo: 'rinunciaEffetto', giocatore: 'g2', carta: c1 });
    // g3 ha una voce, ma non è ancora la corrente.
    rifiutata(s, { tipo: 'attivaEffetto', giocatore: 'g3', carta: c3 });
    rifiutata(s, { tipo: 'rinunciaEffetto', giocatore: 'g3', carta: c3 });
  });

  it('la carta deve essere quella della voce corrente', () => {
    const s = finoAgliEffetti(opzioni, scelte);
    const inMano = carta(s, 'g1', 'carriola');
    rifiutata(s, { tipo: 'attivaEffetto', giocatore: 'g1', carta: inMano });
    rifiutata(s, { tipo: 'rinunciaEffetto', giocatore: 'g1', carta: inMano });
    rifiutata(s, { tipo: 'attivaEffetto', giocatore: 'g1', carta: giocata(s, 'g3', 'megafono-di-latta') });
    rifiutata(s, { tipo: 'attivaEffetto', giocatore: 'g1', carta: 'agnellino-smarrito#99' });
  });

  it('il bersaglio è vietato per gli effetti che non lo prevedono (§4.4)', () => {
    const s = finoAgliEffetti(opzioni, scelte);
    rifiutata(s, { tipo: 'attivaEffetto', giocatore: 'g1', carta: giocata(s, 'g1', 'agnellino-smarrito'), bersaglio: 'g2' });
  });

  it('completaEffetto senza richiesta in corso è rifiutato', () => {
    const s = finoAgliEffetti(opzioni, scelte);
    rifiutata(s, { tipo: 'completaEffetto', giocatore: 'g1', carte: [] });
    rifiutata(s, { tipo: 'completaEffetto', giocatore: 'g1', carte: [carta(s, 'g1', 'carriola')] });
  });

  it('attivaEffetto e rinunciaEffetto sono rifiutati fuori dalla fase effetti', () => {
    const inScelta = prosegui(scenario(opzioni));
    expect(inScelta.fase.nome).toBe('scelta');
    rifiutata(inScelta, { tipo: 'attivaEffetto', giocatore: 'g1', carta: carta(inScelta, 'g1', 'agnellino-smarrito') });

    const dopo = rinunciaTutti(finoAgliEffetti(opzioni, scelte));
    expect(dopo.fase.nome).toBe('belati_punteggio');
    const c1 = giocata(dopo, 'g1', 'agnellino-smarrito');
    rifiutata(dopo, { tipo: 'attivaEffetto', giocatore: 'g1', carta: c1 });
    rifiutata(dopo, { tipo: 'rinunciaEffetto', giocatore: 'g1', carta: c1 });
  });

  it('con la voce in pila o una richiesta aperta le altre azioni sono rifiutate; Beee-NO! arriva tardi su un effetto già risolto (§4, §5)', () => {
    const s0 = finoAgliEffetti(
      { guaio: NEUTRO, mani: { g1: ['cannocchiale'], g2: ['sasso-comodo', 'beee-no'], g3: ['megafono-di-latta'] } },
      { g1: ['cannocchiale'], g2: ['sasso-comodo'], g3: ['megafono-di-latta'] },
    );
    const c1 = giocata(s0, 'g1', 'cannocchiale');
    const c3 = giocata(s0, 'g3', 'megafono-di-latta');

    const conPila = attiva(s0);
    const idVoce = cima(conPila).id;
    rifiutata(conPila, { tipo: 'rinunciaEffetto', giocatore: 'g1', carta: c1 });
    rifiutata(conPila, { tipo: 'attivaEffetto', giocatore: 'g1', carta: c1 });
    rifiutata(conPila, { tipo: 'attivaEffetto', giocatore: 'g3', carta: c3 });
    rifiutata(conPila, { tipo: 'prosegui' });

    const conRichiesta = nessunaReazione(conPila);
    expect(conRichiesta.richiesta?.tipo).toBe('guarda_due');
    rifiutata(conRichiesta, { tipo: 'attivaEffetto', giocatore: 'g3', carta: c3 });
    rifiutata(conRichiesta, { tipo: 'rinunciaEffetto', giocatore: 'g3', carta: c3 });
    rifiutata(conRichiesta, { tipo: 'prosegui' });
    rifiutata(conRichiesta, {
      tipo: 'giocaBelato',
      giocatore: 'g2',
      carta: carta(conRichiesta, 'g2', 'beee-no'),
      voce: idVoce,
    });
  });
});

describe('Effetto annullato con Beee-NO! (§4.4, §5, D8)', () => {
  it('esito annullato, nessun cambiamento, la Trovata conta comunque con il suo valore', () => {
    const s0 = finoAgliEffetti(
      { guaio: NEUTRO, mani: { g1: ['cannocchiale', 'carriola'], g2: ['sasso-comodo', 'beee-no'], g3: ['megafono-di-latta'] } },
      { g1: ['cannocchiale'], g2: ['sasso-comodo'], g3: ['megafono-di-latta'] },
    );
    const s1 = attiva(s0);
    const idEffetto = cima(s1).id;
    const beee = carta(s1, 'g2', 'beee-no');
    const s2 = beeeNo(s1, 'g2');
    const idBeee = cima(s2).id;
    expect(s2.pila).toHaveLength(2);
    expect(ordinate(s2.finestra?.inAttesa ?? [])).toEqual(['g1', 'g3']);
    const s3 = nessunaReazione(s2);

    expect(s3.pila).toEqual([]);
    expect(esiti(s3)).toEqual(['annullato', 'attesa']);
    expect(corrente(s3).giocatore).toBe('g3');
    expect(eventiDi(s2, s3, 'annullata')).toContainEqual(expect.objectContaining({ voce: idEffetto, da: idBeee }));
    expect(s3.richiesta).toBeNull();
    expect(s3.mazzo).toEqual(s0.mazzo);
    expect(mano(s3, 'g1')).toEqual(mano(s0, 'g1'));
    expect(mano(s3, 'g2')).not.toContain(beee);
    expect(s3.datiRound.tavolo).toContain(beee);
    expect(s3.datiRound.tavolo).toContain(giocata(s3, 'g1', 'cannocchiale'));
    expect(righe(s3, 'g1', 'valore')).toEqual([expect.objectContaining({ delta: 7 })]);
    expect(totale(s3, 'g1')).toBe(7);

    // Il valore annullato decide comunque chi è il più alto.
    const chiuso = chiudiPunteggio(rinunciaTutti(s3));
    expect(chiuso.datiRound.piuAlti).toEqual(['g1']);
    expect(chiuso.datiRound.piuBassi).toEqual(['g2']);
  });

  it('una Capriola annullata non scambia nulla e vale 5', () => {
    const s0 = finoAgliEffetti(
      { guaio: NEUTRO, mani: { g1: ['capriola'], g2: ['carriola', 'beee-no'], g3: ['megafono-di-latta'] } },
      { g1: ['capriola'], g2: ['carriola'], g3: ['megafono-di-latta'] },
    );
    const s1 = nessunaReazione(beeeNo(attiva(s0), 'g2'));
    expect(esiti(s1)).toEqual(['annullato', 'attesa']);
    for (const g of ['g1', 'g2', 'g3']) expect(righe(s1, g, 'scambio')).toEqual([]);
    expect([totale(s1, 'g1'), totale(s1, 'g2'), totale(s1, 'g3')]).toEqual([5, 8, 6]);
  });

  it('un Campanaccio annullato lascia l\'agnellino al bersaglio', () => {
    const s0 = finoAgliEffetti(
      { guaio: NEUTRO, gregge: 10, mani: { g1: ['campanaccio-stonato'], g2: ['carriola', 'beee-no'], g3: ['megafono-di-latta'] } },
      { g1: ['campanaccio-stonato'], g2: ['carriola'], g3: ['megafono-di-latta'] },
    );
    const s1 = nessunaReazione(beeeNo(attiva(s0, 'g2'), 'g2'));
    expect(esiti(s1)).toEqual(['annullato', 'attesa']);
    expect(agnellini(s1, 'g2')).toBe(3);
    expect(s1.gregge).toBe(10);
  });
});

// ─── Tappi per le orecchie: ignora gli effetti ───────────────────────────────

describe('ignora_effetti — Tappi per le orecchie (brief 4; §6, D12)', () => {
  it('giocata con effetti di ogni gruppo: si risolve per prima, gli altri sono ignorati; valori, tratti e Belati restano', () => {
    // Meteo: g1 Ricciolo 9+1 = 10, g2 Brontolana 1, g3 Sospirella 5−1 = 4, g4 Nerina 6−1 = 5.
    const s0 = finoAgliEffetti(
      {
        giocatori: 4,
        guaio: METEO,
        gregge: 10,
        mani: {
          g1: ['tappi-per-le-orecchie'],
          g2: ['agnellino-smarrito', 'belato-di-gruppo'],
          g3: ['capriola'],
          g4: ['megafono-di-latta'],
        },
      },
      { g1: ['tappi-per-le-orecchie'], g2: ['agnellino-smarrito'], g3: ['capriola'], g4: ['megafono-di-latta'] },
    );
    expect(ordine(s0)).toEqual(['g1:ignora_effetti', 'g2:prendi_agnellino', 'g3:scambia_punteggi', 'g4:raddoppia_belati']);
    expect(effetti(s0).coda.map((v) => v.gruppo)).toEqual(['round', 'normale', 'punteggio', 'punteggio']);
    expect(s0.datiRound.ignoraEffetti).toBeNull();
    const tappi = giocata(s0, 'g1', 'tappi-per-le-orecchie');

    const s1 = attivaERisolvi(s0);
    expect(s1.datiRound.ignoraEffetti).toEqual({ giocatore: 'g1', carta: tappi });
    expect(carteConEsito(s0, s1, 'ignorato')).toEqual(
      ordinate([
        giocata(s1, 'g2', 'agnellino-smarrito'),
        giocata(s1, 'g3', 'capriola'),
        giocata(s1, 'g4', 'megafono-di-latta'),
      ]),
    );
    expect(s1.fase.nome).toBe('belati_punteggio');
    expect(s1.gregge).toBe(10);
    expect(agnellini(s1, 'g2')).toBe(3);
    expect(s1.datiRound.raddoppioBelati).toBe(false);
    for (const g of ['g1', 'g2', 'g3', 'g4']) {
      expect(righe(s1, g, 'scambio')).toEqual([]);
      expect(righe(s1, g, 'effetto')).toEqual([]);
    }
    expect(righe(s1, 'g1', 'tratto')).toEqual([expect.objectContaining({ delta: 1 })]);
    expect(righe(s1, 'g3', 'tratto')).toEqual([expect.objectContaining({ delta: -1 })]);
    expect(righe(s1, 'g4', 'tratto')).toEqual([expect.objectContaining({ delta: -1 })]);
    expect([totale(s1, 'g1'), totale(s1, 'g2'), totale(s1, 'g3'), totale(s1, 'g4')]).toEqual([10, 1, 4, 5]);

    // I Belati non sono toccati (e il Megafono ignorato non li raddoppia).
    const s2 = belatoPunteggio(s1, 'g2', 'belato-di-gruppo', 'g2');
    expect(righe(s2, 'g2', 'belato')).toEqual([expect.objectContaining({ delta: 2 })]);
    expect(totale(s2, 'g2')).toBe(3);
  });

  it('giocata con effetti che chiedono una scelta o un bersaglio: nessuna richiesta, mazzo, mani e agnellini invariati', () => {
    const s0 = finoAgliEffetti(
      {
        giocatori: 4,
        guaio: NEUTRO,
        mani: {
          g1: ['tappi-per-le-orecchie'],
          g2: ['scorta-nel-vello', 'corona-di-margherite'],
          g3: ['cannocchiale'],
          g4: ['campanaccio-stonato'],
        },
      },
      { g1: ['tappi-per-le-orecchie'], g2: ['scorta-nel-vello'], g3: ['cannocchiale'], g4: ['campanaccio-stonato'] },
    );
    expect(ordine(s0)).toEqual(['g1:ignora_effetti', 'g2:scarta_e_somma', 'g4:sposta_agnellino', 'g3:guarda_due']);
    const s1 = attivaERisolvi(s0);
    expect(s1.richiesta).toBeNull();
    expect(s1.fase.nome).toBe('belati_punteggio');
    expect(s1.mazzo).toEqual(s0.mazzo);
    expect(mano(s1, 'g2')).toEqual(mano(s0, 'g2'));
    expect(s1.giocatori.map((g) => g.agnellini)).toEqual(s0.giocatori.map((g) => g.agnellini));
    expect(carteConEsito(s0, s1, 'ignorato')).toHaveLength(3);
    expect([totale(s1, 'g1'), totale(s1, 'g2'), totale(s1, 'g3'), totale(s1, 'g4')]).toEqual([9, 0, 7, 4]);
  });

  it('una voce ignorata ha esito ignorato anche se non sarebbe attivabile (l\'ignorato si controlla prima)', () => {
    const s0 = finoAgliEffetti(
      { guaio: NEUTRO, gregge: 0, mani: { g1: ['tappi-per-le-orecchie'], g2: ['agnellino-smarrito'], g3: ['carriola'] } },
      { g1: ['tappi-per-le-orecchie'], g2: ['agnellino-smarrito'], g3: ['carriola'] },
    );
    const s1 = attivaERisolvi(s0);
    const agn = giocata(s1, 'g2', 'agnellino-smarrito');
    expect(carteConEsito(s0, s1, 'ignorato')).toEqual([agn]);
    expect(carteConEsito(s0, s1, 'saltato')).toEqual([]);
  });

  it('con due Tappi il primo nell\'ordine ignora il secondo', () => {
    // Stesso valore (9): l'ordine fra i due Tappi è estratto a caso (D10).
    const s0 = finoAgliEffetti(
      {
        guaio: NEUTRO,
        agnellini: { g1: 4, g2: 2, g3: 3 },
        mani: { g1: ['tappi-per-le-orecchie'], g2: ['tappi-per-le-orecchie'], g3: ['agnellino-smarrito'] },
      },
      { g1: ['tappi-per-le-orecchie'], g2: ['tappi-per-le-orecchie'], g3: ['agnellino-smarrito'] },
    );
    const [primo, secondo] = effetti(s0).coda.map((v) => v.giocatore) as [IdGiocatore, IdGiocatore];
    expect(ordinate([primo, secondo])).toEqual(['g1', 'g2']);
    expect(ordine(s0)).toEqual([`${primo}:ignora_effetti`, `${secondo}:ignora_effetti`, 'g3:prendi_agnellino']);
    const s1 = attivaERisolvi(s0);
    expect(s1.datiRound.ignoraEffetti).toEqual({ giocatore: primo, carta: giocata(s1, primo, 'tappi-per-le-orecchie') });
    expect(carteConEsito(s0, s1, 'ignorato')).toEqual(
      ordinate([giocata(s1, secondo, 'tappi-per-le-orecchie'), giocata(s1, 'g3', 'agnellino-smarrito')]),
    );
    expect(agnellini(s1, 'g3')).toBe(3);
    expect([totale(s1, 'g1'), totale(s1, 'g2'), totale(s1, 'g3')]).toEqual([9, 9, 1]);
    expect(s1.fase.nome).toBe('belati_punteggio');
  });

  it('se i Tappi vengono annullati con Beee-NO! gli altri effetti funzionano e i Tappi valgono 9', () => {
    const s0 = finoAgliEffetti(
      {
        guaio: NEUTRO,
        gregge: 10,
        mani: { g1: ['tappi-per-le-orecchie'], g2: ['agnellino-smarrito', 'beee-no'], g3: ['capriola'] },
      },
      { g1: ['tappi-per-le-orecchie'], g2: ['agnellino-smarrito'], g3: ['capriola'] },
    );
    let s = nessunaReazione(beeeNo(attiva(s0), 'g2'));
    expect(esiti(s)).toEqual(['annullato', 'attesa', 'attesa']);
    expect(s.datiRound.ignoraEffetti).toBeNull();
    expect(corrente(s).giocatore).toBe('g2');

    s = attivaERisolvi(s);
    expect(agnellini(s, 'g2')).toBe(4);
    expect(s.gregge).toBe(9);
    expect(esiti(s)).toEqual(['annullato', 'attivato', 'attesa']);

    // Capriola: g1 9 (il valore dei Tappi annullati conta) e g2 1 si scambiano.
    s = attivaERisolvi(s);
    expect(righe(s, 'g1', 'valore')).toEqual([expect.objectContaining({ delta: 9 })]);
    expect([totale(s, 'g1'), totale(s, 'g2'), totale(s, 'g3')]).toEqual([1, 9, 5]);
    expect(s.fase.nome).toBe('belati_punteggio');
  });

  it('se i primi Tappi vengono annullati, i secondi Tappi possono ancora ignorare gli altri', () => {
    const s0 = finoAgliEffetti(
      {
        guaio: NEUTRO,
        agnellini: { g1: 2, g2: 4, g3: 3 },
        mani: { g1: ['tappi-per-le-orecchie'], g2: ['tappi-per-le-orecchie'], g3: ['agnellino-smarrito', 'beee-no'] },
      },
      { g1: ['tappi-per-le-orecchie'], g2: ['tappi-per-le-orecchie'], g3: ['agnellino-smarrito'] },
    );
    expect(ordine(s0)).toEqual(['g1:ignora_effetti', 'g2:ignora_effetti', 'g3:prendi_agnellino']);
    const s1 = nessunaReazione(beeeNo(attiva(s0), 'g3'));
    expect(esiti(s1)).toEqual(['annullato', 'attesa', 'attesa']);
    expect(corrente(s1).giocatore).toBe('g2');
    const s2 = attivaERisolvi(s1);
    expect(s2.datiRound.ignoraEffetti).toEqual({ giocatore: 'g2', carta: giocata(s2, 'g2', 'tappi-per-le-orecchie') });
    expect(carteConEsito(s1, s2, 'ignorato')).toEqual([giocata(s2, 'g3', 'agnellino-smarrito')]);
    expect(agnellini(s2, 'g3')).toBe(3);
  });

  it('se il proprietario rinuncia ai Tappi gli altri effetti funzionano', () => {
    let s = finoAgliEffetti(
      { guaio: NEUTRO, mani: { g1: ['tappi-per-le-orecchie'], g2: ['agnellino-smarrito'], g3: ['megafono-di-latta'] } },
      { g1: ['tappi-per-le-orecchie'], g2: ['agnellino-smarrito'], g3: ['megafono-di-latta'] },
    );
    s = rinuncia(s);
    expect(s.datiRound.ignoraEffetti).toBeNull();
    expect(esiti(s)).toEqual(['rinunciato', 'attesa', 'attesa']);
    s = attivaERisolvi(s);
    expect(agnellini(s, 'g2')).toBe(4);
    expect(esiti(s)).toEqual(['rinunciato', 'attivato', 'attesa']);
  });
});

// ─── Ordine di risoluzione ───────────────────────────────────────────────────

describe('Ordine di risoluzione (brief 3 "Svolgimento", punto 4; §4.4, D10)', () => {
  it('prima il gruppo "per tutto il round", poi i normali, poi "durante il punteggio", qualunque sia il valore', () => {
    const s0 = finoAgliEffetti(
      {
        giocatori: 4,
        guaio: NEUTRO,
        mani: { g1: ['tappi-per-le-orecchie'], g2: ['capriola'], g3: ['agnellino-smarrito'], g4: ['cannocchiale'] },
      },
      { g1: ['tappi-per-le-orecchie'], g2: ['capriola'], g3: ['agnellino-smarrito'], g4: ['cannocchiale'] },
    );
    expect(ordine(s0)).toEqual(['g1:ignora_effetti', 'g3:prendi_agnellino', 'g4:guarda_due', 'g2:scambia_punteggi']);
    expect(effetti(s0).coda.map((v) => v.valore)).toEqual([9, 1, 7, 5]);

    // La coda si percorre in quest'ordine.
    const visti: IdGiocatore[] = [];
    let s = s0;
    while (s.fase.nome === 'effetti') {
      visti.push(corrente(s).giocatore);
      s = rinuncia(s);
    }
    expect(visti).toEqual(['g1', 'g3', 'g4', 'g2']);
    expect(s.fase.nome).toBe('belati_punteggio');
  });

  it('dentro il gruppo normale dal valore più basso al più alto (0, 3, 4, 7)', () => {
    const s = finoAgliEffetti(
      {
        giocatori: 4,
        guaio: NEUTRO,
        mani: {
          g1: ['cannocchiale'],
          g2: ['campanaccio-stonato'],
          g3: ['pulizie-di-primavera', 'sasso-comodo'],
          g4: ['scorta-nel-vello', 'balla-di-fieno'],
        },
      },
      { g1: ['cannocchiale'], g2: ['campanaccio-stonato'], g3: ['pulizie-di-primavera'], g4: ['scorta-nel-vello'] },
    );
    expect(ordine(s)).toEqual(['g4:scarta_e_somma', 'g3:scarta_fino_a_tre', 'g2:sposta_agnellino', 'g1:guarda_due']);
    expect(effetti(s).coda.map((v) => v.valore)).toEqual([0, 3, 4, 7]);
  });

  it('dentro il gruppo del punteggio dal valore più basso: Capriola (5) prima del Megafono (6); i normali prima anche se di valore più basso', () => {
    const s = finoAgliEffetti(
      { guaio: NEUTRO, mani: { g1: ['megafono-di-latta'], g2: ['capriola'], g3: ['fischietto-da-richiamo'] } },
      { g1: ['megafono-di-latta'], g2: ['capriola'], g3: ['fischietto-da-richiamo'] },
    );
    expect(ordine(s)).toEqual(['g3:prendi_agnellino', 'g2:scambia_punteggi', 'g1:raddoppia_belati']);
  });

  it('i normali si risolvono prima dello scambio: la Capriola usa il totale già aumentato dalla Scorta nel vello', () => {
    let s = finoAgliEffetti(
      {
        guaio: NEUTRO,
        mani: { g1: ['scorta-nel-vello', 'corona-di-margherite'], g2: ['capriola'], g3: ['carriola'] },
      },
      { g1: ['scorta-nel-vello'], g2: ['capriola'], g3: ['carriola'] },
    );
    expect(ordine(s)).toEqual(['g1:scarta_e_somma', 'g2:scambia_punteggi']);
    s = attivaERisolvi(s);
    s = completa(s, [carta(s, 'g1', 'corona-di-margherite')]);
    expect([totale(s, 'g1'), totale(s, 'g2'), totale(s, 'g3')]).toEqual([9, 5, 8]);
    s = attivaERisolvi(s);
    expect([totale(s, 'g1'), totale(s, 'g2'), totale(s, 'g3')]).toEqual([5, 9, 8]);
  });

  it('a parità di valore gli agnellini non contano: al variare del seme anche chi ne ha di più risolve per primo (D10, 21/10/2026)', () => {
    const scelte: Scelte = { g1: ['pulizie-di-primavera'], g2: ['pulizie-di-primavera'], g3: ['carriola'] };
    const primi = new Set<IdGiocatore>();
    for (let seme = 1; seme <= 30; seme++) {
      const o: OpzioniScenario = {
        seme,
        guaio: NEUTRO,
        agnellini: { g1: 5, g2: 2, g3: 3 },
        mani: {
          g1: ['pulizie-di-primavera', 'sasso-comodo'],
          g2: ['pulizie-di-primavera', 'balla-di-fieno'],
          g3: ['carriola'],
        },
      };
      const a = finoAgliEffetti(o, scelte);
      expect(finoAgliEffetti(o, scelte)).toEqual(a);
      expect(ordinate(ordine(a))).toEqual(['g1:scarta_fino_a_tre', 'g2:scarta_fino_a_tre']);
      primi.add(corrente(a).giocatore);
    }
    // g1 ha più agnellini di g2, eppure in qualche seme risolve per primo.
    expect(ordinate([...primi])).toEqual(['g1', 'g2']);
  });

  it('l\'ordine si estrae all\'ingresso nella fase: non cambia se un effetto precedente modifica gli agnellini', () => {
    const s0 = finoAgliEffetti(
      {
        giocatori: 4,
        guaio: NEUTRO,
        agnellini: { g1: 4, g2: 3, g3: 5, g4: 6 },
        mani: { g1: ['cannocchiale'], g2: ['cannocchiale'], g3: ['campanaccio-stonato'], g4: ['campanaccio-stonato'] },
      },
      { g1: ['cannocchiale'], g2: ['cannocchiale'], g3: ['campanaccio-stonato'], g4: ['campanaccio-stonato'] },
    );
    // Valore crescente: i Campanacci (4) prima dei Cannocchiali (7); dentro ogni coppia, a caso.
    expect(ordinate(ordine(s0).slice(0, 2))).toEqual(['g3:sposta_agnellino', 'g4:sposta_agnellino']);
    expect(ordinate(ordine(s0).slice(2))).toEqual(['g1:guarda_due', 'g2:guarda_due']);
    // I due Campanacci tolgono 2 agnellini a g1: l'ordine resta quello estratto all'ingresso.
    let s = attivaERisolvi(s0, 'g1');
    s = attivaERisolvi(s, 'g1');
    expect(agnellini(s, 'g1')).toBe(2);
    expect(ordine(s)).toEqual(ordine(s0));
    expect(corrente(s).giocatore).toBe(effetti(s0).coda[2]?.giocatore);
  });

  it('a ulteriore parità l\'ordine è casuale ma riproducibile con lo stesso seme', () => {
    const scelte: Scelte = { g1: ['pulizie-di-primavera'], g2: ['pulizie-di-primavera'], g3: ['carriola'] };
    const primi = new Set<IdGiocatore>();
    for (let seme = 1; seme <= 30; seme++) {
      const o: OpzioniScenario = {
        seme,
        guaio: NEUTRO,
        agnellini: { g1: 3, g2: 3, g3: 3 },
        mani: {
          g1: ['pulizie-di-primavera', 'sasso-comodo'],
          g2: ['pulizie-di-primavera', 'balla-di-fieno'],
          g3: ['carriola'],
        },
      };
      const a = finoAgliEffetti(o, scelte);
      const b = finoAgliEffetti(o, scelte);
      expect(b).toEqual(a);
      expect(ordinate(ordine(a))).toEqual(['g1:scarta_fino_a_tre', 'g2:scarta_fino_a_tre']);
      primi.add(corrente(a).giocatore);
    }
    // Su 30 semi capitano entrambi gli ordini: non è l'ordine dei posti.
    expect(ordinate([...primi])).toEqual(['g1', 'g2']);
  });
});

// ─── Fine della coda ─────────────────────────────────────────────────────────

describe('Fine della coda (§4.4, §4.5, D18)', () => {
  it('esaurita la coda con almeno 2 partecipanti si entra in belati_punteggio con tutti i non eliminati in attesa', () => {
    // g3 resta fuori dal round (mano vuota, mazzo vuoto), g4 è eliminato.
    const s0 = finoAgliEffetti(
      {
        giocatori: 4,
        guaio: NEUTRO,
        mazzo: [],
        eliminati: ['g4'],
        agnellini: { g4: 0 },
        mani: { g1: ['agnellino-smarrito'], g2: ['carriola'] },
      },
      { g1: ['agnellino-smarrito'], g2: ['carriola'] },
    );
    expect(s0.datiRound.partecipanti).toEqual(['g1', 'g2']);
    const s1 = attivaERisolvi(s0);
    expect(s1.fase.nome).toBe('belati_punteggio');
    expect(ordinate(s1.fase.nome === 'belati_punteggio' ? s1.fase.inAttesa : [])).toEqual(['g1', 'g2', 'g3']);
    expect(s1.pila).toEqual([]);
    expect(s1.richiesta).toBeNull();
  });

  it('senza Trovate con effetto si passa subito a belati_punteggio', () => {
    const s = finoAgliEffetti(
      {
        guaio: NEUTRO,
        mani: { g1: ['calzino-gemello#1', 'calzino-gemello#2'], g2: ['carriola'], g3: ['sasso-comodo'] },
      },
      { g1: ['calzino-gemello#1', 'calzino-gemello#2'], g2: ['carriola'], g3: ['sasso-comodo'] },
    );
    expect(s.fase.nome).toBe('belati_punteggio');
    expect([totale(s, 'g1'), totale(s, 'g2'), totale(s, 'g3')]).toEqual([6, 8, 2]);
  });

  it('se tutte le voci sono saltate si esce subito dalla fase', () => {
    const s0 = finoAgliEffetti(
      { guaio: NEUTRO, gregge: 0, mani: { g1: ['agnellino-smarrito'], g2: ['carriola'], g3: ['sasso-comodo'] } },
      { g1: ['agnellino-smarrito'], g2: ['carriola'], g3: ['sasso-comodo'] },
    );
    expect(s0.fase.nome).toBe('belati_punteggio');
    expect(agnellini(s0, 'g1')).toBe(3);
    expect(s0.gregge).toBe(0);
  });

  it('con un solo partecipante non si apre la finestra dei Belati di punteggio: si chiude il punteggio e lui lancia (D18, D23)', () => {
    const s0 = finoAgliEffetti(
      { guaio: NEUTRO, mazzo: [], mani: { g1: ['agnellino-smarrito'] } },
      { g1: ['agnellino-smarrito'] },
    );
    expect(s0.datiRound.partecipanti).toEqual(['g1']);
    const s1 = attivaERisolvi(s0);
    expect(agnellini(s1, 'g1')).toBe(4);
    expect(s1.fase.nome).toBe('dado');
    expect(s1.datiRound.piuAlti).toEqual(['g1']);
    expect(s1.datiRound.lanciatori).toEqual(['g1']);
  });
});
