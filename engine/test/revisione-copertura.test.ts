// Revisione della copertura: lista "Test da non saltare nella fase 1" (brief-codice2.md §8) e regole di §3 e §4.
// Ogni describe richiama il punto del brief che rinforza. I test coprono casi e combinazioni che la suite
// esistente non costruisce (o costruisce solo in parte); le decisioni D1…D40 di docs/motore.md fanno da arbitro.
import { describe, expect, it } from 'vitest';
import carteJson from '../data/cards.json';
import setupJson from '../data/setup.json';
import {
  angoloElimina,
  applica,
  azioniPossibili,
  CATALOGO,
  configPer,
  ErroreRegola,
  inAttesaDi,
  tipiCheEliminano,
  type Azione,
  type Evento,
  type Fase,
  type IdCarta,
  type IdGiocatore,
  type IdTipoCarta,
  type Stato,
  type StatoGiocatore,
  type TipoGuaio,
  type TipoGuaioCarta,
} from '../src';
import {
  avanza,
  carta,
  chiudiPunteggio,
  conFaccia,
  nessunaReazione,
  prosegui,
  rinunciaTutti,
  scegli,
  scenario,
  totale,
  type OpzioniScenario,
} from './aiuti';

// ─── Aiuti locali ────────────────────────────────────────────────────────────

/** Tosatura a Sorpresa: nessun tratto, i totali sono i soli valori stampati. */
const TOSATURA = 'tosatura-a-sorpresa';

type Scelte = Record<IdGiocatore, Array<IdTipoCarta | IdCarta>>;
type FaseDi<N extends Fase['nome']> = Extract<Fase, { nome: N }>;
type EventoDi<T extends Evento['tipo']> = Extract<Evento, { tipo: T }>;

function fase<N extends Fase['nome']>(s: Stato, nome: N): FaseDi<N> {
  if (s.fase.nome !== nome) throw new Error(`fase '${s.fase.nome}', attesa '${nome}'`);
  return s.fase as FaseDi<N>;
}

function gioc(s: Stato, id: IdGiocatore): StatoGiocatore {
  const g = s.giocatori.find((x) => x.id === id);
  if (!g) throw new Error(`giocatore ${id} inesistente`);
  return g;
}

const ordinati = (x: readonly string[]): string[] => [...x].sort();

function nuoviEventi<T extends Evento['tipo']>(prima: Stato, dopo: Stato, tipo: T): EventoDi<T>[] {
  return dopo.eventi.filter((e): e is EventoDi<T> => e.seq >= prima.prossimoEvento && e.tipo === tipo);
}

function rifiutata(s: Stato, azione: Azione): void {
  const copia = structuredClone(s);
  expect(() => applica(s, azione), JSON.stringify(azione)).toThrow(ErroreRegola);
  expect(s).toEqual(copia);
}

/** Scenario → scelta → rivelazione → rinuncia a ogni effetto: di solito 'belati_punteggio'. */
function finoAlPunteggio(o: OpzioniScenario, scelte: Scelte): Stato {
  let s = prosegui(scenario({ guaio: TOSATURA, ...o }));
  fase(s, 'scelta');
  s = scegli(s, scelte);
  fase(s, 'rivelazione');
  s = prosegui(s);
  if (s.fase.nome === 'effetti') s = rinunciaTutti(s);
  return s;
}

/** Come finoAlPunteggio, poi scadenza della finestra dei Belati di punteggio. */
function finoAlDado(o: OpzioniScenario, scelte: Scelte): Stato {
  const s = finoAlPunteggio(o, scelte);
  return s.fase.nome === 'belati_punteggio' ? chiudiPunteggio(s) : s;
}

/** Ogni lanciatore ottiene la faccia indicata e nessuno reagisce. */
function lanciaTutti(s: Stato, faccia = 'pascolo_piccolo'): Stato {
  for (let giri = 0; s.fase.nome === 'dado'; giri++) {
    if (giri > 10) throw new Error('troppi lanci');
    const chi = s.datiRound.lanciatori[s.fase.indice];
    if (chi === undefined) throw new Error('lanciatore mancante');
    s = nessunaReazione(applica(conFaccia(s, faccia), { tipo: 'lanciaDado', giocatore: chi }));
  }
  return s;
}

function cimaId(s: Stato): number {
  const v = s.pila[s.pila.length - 1];
  if (!v) throw new Error('pila vuota');
  return v.id;
}

const passa = (s: Stato, chi: IdGiocatore): Stato => applica(s, { tipo: 'passa', giocatore: chi });

const beeeNo = (s: Stato, chi: IdGiocatore): Stato =>
  applica(s, { tipo: 'giocaBelato', giocatore: chi, carta: carta(s, chi, 'beee-no'), voce: cimaId(s) });

const giocaBelato = (
  s: Stato,
  chi: IdGiocatore,
  tipo: IdTipoCarta,
  extra: { bersaglio?: IdGiocatore; guaio?: IdCarta } = {},
): Stato => applica(s, { tipo: 'giocaBelato', giocatore: chi, carta: carta(s, chi, tipo), ...extra });

const sceltaFinale = (s: Stato, chi: IdGiocatore, tipo: IdTipoCarta): Stato =>
  applica(s, { tipo: 'sceltaFinale', giocatore: chi, carta: carta(s, chi, tipo) });

const concludi = (s: Stato, chi: IdGiocatore, scarta: IdCarta | null = null): Stato =>
  applica(s, { tipo: 'concludiConsolazione', giocatore: chi, scarta });

const agnelliniDi = (s: Stato): number[] => s.giocatori.map((g) => g.agnellini);

/** Posti dell'Ovile a 3 giocatori, il default degli scenari (setup.json, specifica 3). */
const OVILE_3 = configPer(3).postiOvile;

// ─── §8.1 Ognuno dei tre modi di vincere ─────────────────────────────────────

describe('§8.1 modi di vincere: combinazioni non coperte (brief §3 "Come si vince", "Casi limite"; spec 9)', () => {
  it('Ovile pieno a metà round con la consolazione di chi riceve un Guaio deviato: vince lui, non il deviatore', () => {
    // g1 Carriola 8 lancia (+3), g3 Sasso 2 devia su g2 (un posto libero nell'Ovile), che passa: +1 di consolazione ⇒ Ovile pieno.
    let s = finoAlDado(
      {
        agnellini: { g2: OVILE_3 - 1 },
        mani: { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['sasso-comodo', 'finta-svenuta'] },
      },
      { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['sasso-comodo'] },
    );
    s = prosegui(lanciaTutti(s));
    expect(fase(s, 'belati_salvataggio').destinatario).toBe('g3');
    s = nessunaReazione(giocaBelato(s, 'g3', 'finta-svenuta', { bersaglio: 'g2' }));
    expect(fase(s, 'belati_salvataggio').destinatario).toBe('g2');
    const prima = s;
    s = passa(s, 'g2');
    expect(gioc(s, 'g2').agnellini).toBe(OVILE_3);
    expect(gioc(s, 'g2').angolo).toHaveLength(1);
    expect(s.esito).toEqual({ modo: 'ovile_pieno', vincitori: ['g2'] });
    expect(s.fase).toEqual({ nome: 'fine_partita' });
    expect(nuoviEventi(prima, s, 'fine_partita')).toHaveLength(1);
    // Il deviatore non prende né Guaio né consolazione.
    expect(gioc(s, 'g3').angolo).toEqual([]);
    expect(gioc(s, 'g3').agnellini).toBe(3);
  });

  it('Ultima pecora a 4 giocatori: con un solo eliminato l\'eliminazione di un secondo lascia la partita aperta', () => {
    // g4 già eliminato; g3 (MM + Meteo) prende il terzo Meteo e viene eliminato: restano g1 e g2.
    let s = finoAlDado(
      {
        giocatori: 4,
        eliminati: ['g4'],
        agnellini: { g4: 0 },
        guaio: 'grandine-a-sorpresa',
        angoli: { g3: ['fulmine-curioso', 'nebbia-fitta'] },
        mani: { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['sasso-comodo', 'coperta-di-lana'], g4: [] },
      },
      { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['sasso-comodo'] },
    );
    s = prosegui(lanciaTutti(s));
    s = passa(s, 'g3');
    const gregge = s.gregge;
    s = concludi(s, 'g3');
    expect(gioc(s, 'g3').eliminato).toBe(true);
    expect(s.gregge).toBe(gregge + 4);
    expect(s.esito).toBeNull();
    expect(s.fase.nome).toBe('fine_round');
    s = prosegui(prosegui(s));
    expect(s.datiRound.partecipanti).toEqual(['g1', 'g2']);
  });

  it('Ultima pecora a 4 giocatori: con due già eliminati, il terzo eliminato fa vincere l\'ultimo rimasto', () => {
    let s = finoAlDado(
      {
        giocatori: 4,
        eliminati: ['g3', 'g4'],
        agnellini: { g3: 0, g4: 0 },
        guaio: 'lupo-vegetariano',
        angoli: { g2: ['grandine-a-sorpresa', 'insonnia', 'spuntatina'] },
        mani: { g1: ['carriola'], g2: ['sasso-comodo'], g3: [], g4: [] },
      },
      { g1: ['carriola'], g2: ['sasso-comodo'] },
    );
    s = prosegui(lanciaTutti(s));
    s = passa(s, 'g2');
    s = concludi(s, 'g2');
    expect(gioc(s, 'g2').eliminato).toBe(true);
    expect(s.esito).toEqual({ modo: 'ultima_pecora', vincitori: ['g1'] });
    expect(s.fase).toEqual({ nome: 'fine_partita' });
  });
});

// ─── §8.2 Facce del dado, furto, Gregge vuoto o quasi ────────────────────────

describe('§8.2 dado con il Gregge quasi vuoto e a 2 giocatori (brief §3 "Il Dado del Pastore"; spec 4.7, D20, D22, D39)', () => {
  it('due lanciatori pari con il Gregge a 3: il primo prende tutto, il secondo Pascolo non ha effetto né finestra, la consolazione non arriva', () => {
    // g1 e g2 pari a 8; g2 ha meno agnellini e lancia per primo.
    let s = finoAlDado(
      { gregge: 3, agnellini: { g1: 5, g2: 2 }, mani: { g1: ['carriola'], g2: ['carriola'], g3: ['sasso-comodo'] } },
      { g1: ['carriola'], g2: ['carriola'], g3: ['sasso-comodo'] },
    );
    expect(s.datiRound.lanciatori).toEqual(['g2', 'g1']);
    s = nessunaReazione(applica(conFaccia(s, 'pascolo_grande'), { tipo: 'lanciaDado', giocatore: 'g2' }));
    expect(gioc(s, 'g2').agnellini).toBe(5);
    expect(s.gregge).toBe(0);
    const prima = s;
    s = applica(conFaccia(s, 'pascolo_piccolo'), { tipo: 'lanciaDado', giocatore: 'g1' });
    expect(s.pila).toEqual([]);
    expect(s.finestra).toBeNull();
    expect(nuoviEventi(prima, s, 'dichiarazione')).toEqual([]);
    expect(gioc(s, 'g1').agnellini).toBe(5);
    expect(fase(s, 'guaio_al_peggiore').destinatario).toBe('g3');
    s = passa(prosegui(s), 'g3');
    expect(fase(s, 'consolazione').destinatario).toBe('g3');
    expect(gioc(s, 'g3').agnellini).toBe(3);
    expect(gioc(s, 'g3').angolo).toHaveLength(1);
    expect(s.gregge).toBe(0);
  });

  it('due lanciatori pari con il Gregge a 4: il Furto del secondo prende dagli avversari e dal Gregge solo il rimasto', () => {
    let s = finoAlDado(
      {
        gregge: 4,
        agnellini: { g1: 5, g2: 2, g3: 1 },
        mani: { g1: ['carriola'], g2: ['carriola'], g3: ['sasso-comodo'] },
      },
      { g1: ['carriola'], g2: ['carriola'], g3: ['sasso-comodo'] },
    );
    expect(s.datiRound.lanciatori).toEqual(['g2', 'g1']);
    // g2: Pascolo piccolo, 3 dal Gregge (ne resta 1).
    s = nessunaReazione(applica(conFaccia(s, 'pascolo_piccolo'), { tipo: 'lanciaDado', giocatore: 'g2' }));
    expect(s.gregge).toBe(1);
    // g1: Furto grande (4): avversari g2 (5) e g3 (1) ⇒ ripartizione libera di 4 tra loro, niente dal Gregge.
    s = applica(conFaccia(s, 'furto_grande'), { tipo: 'lanciaDado', giocatore: 'g1' });
    expect(fase(s, 'risoluzione_dado').passo).toBe('dichiarazione');
    rifiutata(s, { tipo: 'dichiaraDado', giocatore: 'g1', furto: { g2: 2, g3: 1 } });
    s = nessunaReazione(applica(s, { tipo: 'dichiaraDado', giocatore: 'g1', furto: { g2: 3, g3: 1 } }));
    expect(agnelliniDi(s)).toEqual([9, 2, 0]);
    expect(s.gregge).toBe(1);
  });

  it('a 2 giocatori il Furto grande è automatico sull\'unico avversario e i mancanti vengono dal Gregge', () => {
    let s = finoAlDado(
      { giocatori: 2, gregge: 10, agnellini: { g2: 1 }, mani: { g1: ['carriola'], g2: ['balla-di-fieno'] } },
      { g1: ['carriola'], g2: ['balla-di-fieno'] },
    );
    s = applica(conFaccia(s, 'furto_grande'), { tipo: 'lanciaDado', giocatore: 'g1' });
    expect(fase(s, 'risoluzione_dado').passo).toBe('reazione');
    expect(fase(s, 'risoluzione_dado').dichiarazione).toEqual({ effetto: 'furto', daAvversari: { g2: 1 }, dalGregge: 3 });
    s = nessunaReazione(s);
    expect(agnelliniDi(s)).toEqual([7, 0]);
    expect(s.gregge).toBe(7);
  });
});

// ─── §8.3 Testata ────────────────────────────────────────────────────────────

describe('§8.3 Testata a 2 giocatori (brief §3 "Minigioco della Testata"; spec 4.7, D21)', () => {
  it('bersaglio automatico; esito oltre gli agnellini del bersaglio rifiutato anche se ≤ 3', () => {
    let s = finoAlDado(
      { giocatori: 2, agnellini: { g2: 2 }, mani: { g1: ['carriola'], g2: ['balla-di-fieno'] } },
      { g1: ['carriola'], g2: ['balla-di-fieno'] },
    );
    s = applica(conFaccia(s, 'testata'), { tipo: 'lanciaDado', giocatore: 'g1' });
    expect(fase(s, 'risoluzione_dado').dichiarazione).toEqual({ effetto: 'testata', bersaglio: 'g2' });
    s = nessunaReazione(s);
    expect(fase(s, 'risoluzione_dado').passo).toBe('esito_testata');
    rifiutata(s, { tipo: 'esitoTestata', giocatore: 'g1', esito: 3 });
    const gregge = s.gregge;
    s = applica(s, { tipo: 'esitoTestata', giocatore: 'g1', esito: 2 });
    expect(gioc(s, 'g2').agnellini).toBe(0);
    expect(s.gregge).toBe(gregge + 2);
    // Senza agnellini g2 resta in gioco (si elimina solo con i Guai) e prende il Guaio.
    expect(gioc(s, 'g2').eliminato).toBe(false);
    expect(fase(s, 'guaio_al_peggiore').destinatario).toBe('g2');
  });
});

// ─── §8.4 Beee-NO! ───────────────────────────────────────────────────────────

describe('§8.4 Beee-NO! su Belati non coperti (brief §3 "Beee-NO!"; spec 5, 7, D5, D6, D8)', () => {
  /** g1 8, g2 5, g3 2; g3 ha in mano Mondo alla rovescia; g1 e g2 hanno un Beee-NO!. */
  function conMondo(): Stato {
    return finoAlPunteggio(
      {
        mani: {
          g1: ['carriola', 'beee-no'],
          g2: ['balla-di-fieno', 'beee-no'],
          g3: ['sasso-comodo', 'mondo-alla-rovescia', 'belato-di-gruppo'],
        },
      },
      { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['sasso-comodo'] },
    );
  }

  it('Mondo alla rovescia annullato: nessuna riga scambio, carta sul tavolo, la finestra dei Belati riparte da tutti', () => {
    let s = conMondo();
    s = passa(s, 'g2');
    const mondo = carta(s, 'g3', 'mondo-alla-rovescia');
    s = nessunaReazione(beeeNo(giocaBelato(s, 'g3', 'mondo-alla-rovescia'), 'g1'));
    fase(s, 'belati_punteggio');
    for (const g of ['g1', 'g2', 'g3']) expect((s.datiRound.punteggi[g] ?? []).filter((r) => r.tipo === 'scambio')).toEqual([]);
    expect([totale(s, 'g1'), totale(s, 'g2'), totale(s, 'g3')]).toEqual([8, 5, 2]);
    expect(s.datiRound.tavolo).toContain(mondo);
    expect(ordinati(fase(s, 'belati_punteggio').inAttesa)).toEqual(['g1', 'g2', 'g3']);
  });

  it('Beee-NO! annullato da Beee-NO! su Mondo alla rovescia: lo scambio avviene', () => {
    let s = conMondo();
    s = giocaBelato(s, 'g3', 'mondo-alla-rovescia');
    s = beeeNo(s, 'g1');
    s = nessunaReazione(beeeNo(s, 'g2'));
    expect([totale(s, 'g1'), totale(s, 'g2'), totale(s, 'g3')]).toEqual([2, 5, 8]);
    s = chiudiPunteggio(s);
    expect(s.datiRound.piuAlti).toEqual(['g3']);
    expect(s.datiRound.piuBassi).toEqual(['g1']);
  });

  it('Beee-NO! annullato da Beee-NO! su un Belato +2: il +2 si applica', () => {
    let s = conMondo();
    s = giocaBelato(s, 'g3', 'belato-di-gruppo', { bersaglio: 'g3' });
    s = beeeNo(s, 'g1');
    s = nessunaReazione(beeeNo(s, 'g2'));
    expect(totale(s, 'g3')).toBe(4);
    expect((s.datiRound.punteggi['g3'] ?? []).filter((r) => r.tipo === 'belato')).toEqual([
      expect.objectContaining({ delta: 2, autore: 'g3' }),
    ]);
  });

  it('Beee-NO! annullato da Beee-NO! su Finta svenuta: il Guaio è deviato', () => {
    let s = finoAlDado(
      {
        mani: {
          g1: ['carriola'],
          g2: ['balla-di-fieno', 'beee-no'],
          g3: ['sasso-comodo', 'finta-svenuta', 'beee-no'],
        },
      },
      { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['sasso-comodo'] },
    );
    s = prosegui(lanciaTutti(s));
    s = giocaBelato(s, 'g3', 'finta-svenuta', { bersaglio: 'g2' });
    s = beeeNo(s, 'g2');
    // L'autore della deviazione annulla il Beee-NO! di chi la subisce (D5).
    s = nessunaReazione(beeeNo(s, 'g3'));
    expect(fase(s, 'belati_salvataggio').destinatario).toBe('g2');
    s = passa(s, 'g2');
    expect(gioc(s, 'g2').angolo).toHaveLength(1);
    expect(gioc(s, 'g3').angolo).toEqual([]);
  });

  it('Beee-NO! annullato da Beee-NO! su Visita di Garzina: la cura avviene e salva dall\'eliminazione', () => {
    let s = finoAlDado(
      {
        guaio: 'insonnia',
        angoli: { g3: ['crisi-esistenziale', 'specchio-impietoso'] },
        mani: {
          g1: ['carriola', 'beee-no'],
          g2: ['balla-di-fieno', 'beee-no'],
          g3: ['sasso-comodo', 'visita-di-garzina'],
        },
      },
      { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['sasso-comodo'] },
    );
    s = passa(prosegui(lanciaTutti(s)), 'g3');
    const curato = gioc(s, 'g3').angolo[0];
    if (curato === undefined) throw new Error('Angolo vuoto');
    s = giocaBelato(s, 'g3', 'visita-di-garzina', { guaio: curato });
    s = beeeNo(s, 'g1');
    s = nessunaReazione(beeeNo(s, 'g2'));
    expect(gioc(s, 'g3').angolo).toHaveLength(2);
    expect(s.mazzoGuai[s.mazzoGuai.length - 1]).toBe(curato);
    s = concludi(s, 'g3');
    expect(gioc(s, 'g3').eliminato).toBe(false);
  });
});

// ─── §8.5 Trovate Gemelle ────────────────────────────────────────────────────

describe('§8.5 Gemelle in coppia nel round e da sole nel Belato Finale (brief §3 punto 2, "Parità"; D9, D24)', () => {
  it('una coppia di Gemelle pari al massimo con una Carriola: lanciano entrambi, prima chi ha meno agnellini', () => {
    const s = finoAlDado(
      {
        agnellini: { g1: 4, g2: 2 },
        mani: { g1: ['carriola'], g2: ['orecchino-gemello', 'orecchino-gemello'], g3: ['sasso-comodo'] },
      },
      { g1: ['carriola'], g2: ['orecchino-gemello', 'orecchino-gemello'], g3: ['sasso-comodo'] },
    );
    expect(totale(s, 'g2')).toBe(8);
    expect(s.datiRound.lanciatori).toEqual(['g2', 'g1']);
    expect(s.datiRound.piuBassi).toEqual(['g3']);
  });

  it('una coppia di Gemelle pari al minimo va al Belato Finale, dove può giocare una sola carta e non la coppia', () => {
    let s = finoAlDado(
      {
        mani: {
          g1: ['carriola'],
          g2: ['calzino-gemello', 'calzino-gemello', 'orecchino-gemello', 'pantofola-gemella'],
          g3: ['coperta-di-lana', 'trifoglio-qualunque'],
        },
      },
      { g1: ['carriola'], g2: ['calzino-gemello', 'calzino-gemello'], g3: ['coperta-di-lana'] },
    );
    expect([totale(s, 'g2'), totale(s, 'g3')]).toEqual([6, 6]);
    s = prosegui(lanciaTutti(s));
    fase(s, 'belato_finale');
    const orecchino = carta(s, 'g2', 'orecchino-gemello');
    const pantofola = carta(s, 'g2', 'pantofola-gemella');
    rifiutata(s, { tipo: 'scegliTrovata', giocatore: 'g2', carte: [orecchino, pantofola] });
    for (const a of azioniPossibili(s, 'g2')) {
      expect(a.tipo).toBe('sceltaFinale');
    }
    // 2 + 4 = 6 sarebbe pari con Coperta di lana; da sola la Pantofola vale 2 e perde contro il Trifoglio (4).
    s = sceltaFinale(sceltaFinale(s, 'g2', 'pantofola-gemella'), 'g3', 'trifoglio-qualunque');
    expect(s.fase).toEqual({ nome: 'belati_salvataggio', destinatario: 'g2' });
    expect(gioc(s, 'g2').mano).toContain(orecchino);
  });
});

// ─── §8.6 Eliminazione ───────────────────────────────────────────────────────

describe('§8.6 eliminazione nel flusso a 4 giocatori e con il Gregge vuoto (brief §3 "Eliminazione"; spec 8)', () => {
  /** 4 giocatori: g1 Carriola lancia, g4 Sasso comodo prende il Guaio del round. */
  function aQuattro(guaio: IdTipoCarta, angoloG4: IdTipoCarta[], o: OpzioniScenario = {}): Stato {
    let s = finoAlDado(
      {
        giocatori: 4,
        guaio,
        angoli: { g4: angoloG4 },
        mani: {
          g1: ['carriola'],
          g2: ['balla-di-fieno'],
          g3: ['coperta-di-lana'],
          g4: ['sasso-comodo', 'pernacchia', 'trifoglio-qualunque'],
        },
        ...o,
      },
      { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['coperta-di-lana'], g4: ['sasso-comodo'] },
    );
    s = passa(prosegui(lanciaTutti(s)), 'g4');
    return s;
  }

  const casi: Array<{ nome: string; guaio: IdTipoCarta; angolo: IdTipoCarta[]; elimina: boolean }> = [
    { nome: 'Meteo + Predatori + Drammi + Tosatura del round (quattro diversi)', guaio: TOSATURA, angolo: ['grandine-a-sorpresa', 'lupo-vegetariano', 'insonnia'], elimina: true },
    { nome: 'Meteo + Predatori + Tosatura del round (tre diversi non bastano, D46)', guaio: TOSATURA, angolo: ['grandine-a-sorpresa', 'lupo-vegetariano'], elimina: false },
    { nome: 'Drammi + Drammi + Tosatura del round (tre uguali)', guaio: TOSATURA, angolo: ['insonnia', 'crisi-esistenziale'], elimina: true },
    { nome: 'Tosatura + Tosatura + Predatori del round', guaio: 'volpe-gentile', angolo: ['spuntatina', 'rasatura-integrale'], elimina: true },
    { nome: 'Meteo + Meteo + Predatori del round (non elimina)', guaio: 'volpe-gentile', angolo: ['grandine-a-sorpresa', 'nebbia-fitta'], elimina: false },
  ];
  for (const c of casi) {
    it(`${c.nome}: ${c.elimina ? 'eliminato, la partita continua in tre' : 'resta in gioco'}`, () => {
      let s = aQuattro(c.guaio, c.angolo);
      expect(gioc(s, 'g4').angolo).toHaveLength(c.angolo.length + 1);
      const gregge = s.gregge;
      const agnellini = gioc(s, 'g4').agnellini;
      s = concludi(s, 'g4');
      expect(gioc(s, 'g4').eliminato).toBe(c.elimina);
      expect(s.esito).toBeNull();
      expect(s.fase.nome).toBe('fine_round');
      if (c.elimina) {
        expect(gioc(s, 'g4').agnellini).toBe(0);
        expect(gioc(s, 'g4').mano).toEqual([]);
        expect(s.gregge).toBe(gregge + agnellini);
        expect(s.guaiFuoriGioco).toHaveLength(c.angolo.length + 1);
      }
    });
  }

  it('con il Gregge vuoto niente consolazione; gli agnellini dell\'eliminato rifondano il Gregge', () => {
    let s = aQuattro(TOSATURA, ['grandine-a-sorpresa', 'nebbia-fitta'], { gregge: 0 });
    expect(gioc(s, 'g4').agnellini).toBe(3);
    expect(s.gregge).toBe(0);
    s = concludi(s, 'g4');
    expect(gioc(s, 'g4').eliminato).toBe(true);
    expect(s.gregge).toBe(3);
    expect(agnelliniDi(s)).toEqual([3, 3, 3, 0]);
  });
});

// ─── §8.7 Parità ─────────────────────────────────────────────────────────────

describe('§8.7 parità al massimo e al minimo nello stesso round (brief §3 "Parità"; spec 4.6, 4.8, D19, D25)', () => {
  it('4 giocatori 8, 8, 2, 2: lanciano i due più alti in ordine di agnellini, poi Belato Finale tra i due più bassi', () => {
    let s = finoAlDado(
      {
        giocatori: 4,
        agnellini: { g1: 4, g2: 2 },
        mani: {
          g1: ['carriola'],
          g2: ['carriola'],
          g3: ['sasso-comodo', 'trifoglio-qualunque'],
          g4: ['sasso-comodo', 'calzino-gemello'],
        },
      },
      { g1: ['carriola'], g2: ['carriola'], g3: ['sasso-comodo'], g4: ['sasso-comodo'] },
    );
    expect(ordinati(s.datiRound.piuAlti)).toEqual(['g1', 'g2']);
    expect(ordinati(s.datiRound.piuBassi)).toEqual(['g3', 'g4']);
    expect(s.datiRound.lanciatori).toEqual(['g2', 'g1']);
    const prima = s;
    s = lanciaTutti(s);
    expect(nuoviEventi(prima, s, 'dado_lanciato').map((e) => e.giocatore)).toEqual(['g2', 'g1']);
    expect(agnelliniDi(s)).toEqual([7, 5, 3, 3]);
    expect(ordinati(fase(s, 'guaio_al_peggiore').spareggio ?? [])).toEqual(['g3', 'g4']);
    s = prosegui(s);
    expect(ordinati(fase(s, 'belato_finale').partecipanti)).toEqual(['g3', 'g4']);
    s = sceltaFinale(sceltaFinale(s, 'g3', 'trifoglio-qualunque'), 'g4', 'calzino-gemello');
    expect(s.fase).toEqual({ nome: 'belati_salvataggio', destinatario: 'g4' });
  });
});

// ─── §8.8 Belato Finale ──────────────────────────────────────────────────────

describe('§8.8 Belato Finale a tre e ripetuto più volte (brief §3 "Parità"; spec 4.9, D24)', () => {
  /** 4 giocatori: g1 Carriola, g2/g3/g4 pari a 5 con la Balla di fieno; `extra` è il resto della mano. */
  function spareggioATre(extra: Record<'g2' | 'g3' | 'g4', IdTipoCarta[]>): Stato {
    const s = lanciaTutti(
      finoAlDado(
        {
          giocatori: 4,
          mani: {
            g1: ['carriola'],
            g2: ['balla-di-fieno', ...extra.g2],
            g3: ['balla-di-fieno', ...extra.g3],
            g4: ['balla-di-fieno', ...extra.g4],
          },
        },
        { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['balla-di-fieno'], g4: ['balla-di-fieno'] },
      ),
    );
    expect(ordinati(fase(s, 'guaio_al_peggiore').spareggio ?? [])).toEqual(['g2', 'g3', 'g4']);
    return s;
  }

  it('tre pari, uno solo senza Trovate: prende subito il Guaio e gli altri due non giocano', () => {
    const s0 = spareggioATre({ g2: ['trifoglio-qualunque'], g3: ['pernacchia'], g4: ['sasso-comodo'] });
    const s = prosegui(s0);
    expect(s.fase).toEqual({ nome: 'belati_salvataggio', destinatario: 'g3' });
    expect(gioc(s, 'g2').mano).toEqual(gioc(s0, 'g2').mano);
    expect(gioc(s, 'g4').mano).toEqual(gioc(s0, 'g4').mano);
    expect(nuoviEventi(s0, s, 'belato_finale')).toEqual([]);
  });

  it('tre pari, due senza Trovate: il Guaio va in fondo anche se il terzo ha Trovate', () => {
    const s0 = spareggioATre({ g2: ['trifoglio-qualunque'], g3: ['pernacchia'], g4: ['beee-no'] });
    const guaio = s0.datiRound.guaio;
    const s = prosegui(s0);
    expect(s.fase.nome).toBe('fine_round');
    expect(s.mazzoGuai[s.mazzoGuai.length - 1]).toBe(guaio);
    expect(s.datiRound.presoDa).toBeNull();
    for (const g of ['g2', 'g3', 'g4']) expect(gioc(s, g).angolo).toEqual([]);
  });

  it('ripetuto due volte (tre rivelazioni): solo i pari restano, lo storico le conserva tutte', () => {
    const s0 = spareggioATre({
      g2: ['trifoglio-qualunque', 'sasso-comodo', 'corona-di-margherite'],
      g3: ['orecchino-gemello', 'pantofola-gemella', 'scorta-nel-vello'],
      g4: ['carriola', 'coperta-di-lana'],
    });
    let s = prosegui(s0);
    // 4, 4, 8: restano g2 e g3.
    s = sceltaFinale(sceltaFinale(sceltaFinale(s, 'g2', 'trifoglio-qualunque'), 'g3', 'orecchino-gemello'), 'g4', 'carriola');
    expect(ordinati(fase(s, 'belato_finale').partecipanti)).toEqual(['g2', 'g3']);
    // 2 e 2: di nuovo pari.
    s = sceltaFinale(sceltaFinale(s, 'g2', 'sasso-comodo'), 'g3', 'pantofola-gemella');
    const f = fase(s, 'belato_finale');
    expect(ordinati(f.partecipanti)).toEqual(['g2', 'g3']);
    expect(f.storico).toHaveLength(2);
    // 9 contro 0: g3 prende il Guaio; nessun effetto della Scorta nel vello.
    s = sceltaFinale(sceltaFinale(s, 'g2', 'corona-di-margherite'), 'g3', 'scorta-nel-vello');
    expect(s.fase).toEqual({ nome: 'belati_salvataggio', destinatario: 'g3' });
    expect(s.richiesta).toBeNull();
    // Le 7 carte delle tre rivelazioni sono sul tavolo, oltre alle 4 Trovate del round.
    expect(s.datiRound.tavolo).toHaveLength(4 + 3 + 2 + 2);
    expect(nuoviEventi(s0, s, 'belato_finale')).toHaveLength(3);
  });
});

// ─── §8.9 Scambio dei punteggi ───────────────────────────────────────────────

describe('§8.9 scambio con pari merito a entrambi gli estremi (brief §3 "Scambio dei punteggi"; spec 7, D13)', () => {
  it('Mondo alla rovescia con 8, 8, 2, 2: tutti i più alti scendono a 2, tutti i più bassi salgono a 8; poi si invertono dado e Guaio', () => {
    let s = finoAlPunteggio(
      {
        giocatori: 4,
        mani: {
          g1: ['carriola', 'mondo-alla-rovescia'],
          g2: ['carriola'],
          g3: ['sasso-comodo'],
          g4: ['sasso-comodo'],
        },
      },
      { g1: ['carriola'], g2: ['carriola'], g3: ['sasso-comodo'], g4: ['sasso-comodo'] },
    );
    s = nessunaReazione(giocaBelato(s, 'g1', 'mondo-alla-rovescia'));
    expect([totale(s, 'g1'), totale(s, 'g2'), totale(s, 'g3'), totale(s, 'g4')]).toEqual([2, 2, 8, 8]);
    for (const [g, delta] of [['g1', -6], ['g2', -6], ['g3', 6], ['g4', 6]] as const) {
      expect((s.datiRound.punteggi[g] ?? []).filter((r) => r.tipo === 'scambio')).toEqual([
        expect.objectContaining({ delta, autore: 'g1' }),
      ]);
    }
    s = chiudiPunteggio(s);
    expect(ordinati(s.datiRound.piuAlti)).toEqual(['g3', 'g4']);
    expect(ordinati(s.datiRound.piuBassi)).toEqual(['g1', 'g2']);
    expect(ordinati(s.datiRound.lanciatori)).toEqual(['g3', 'g4']);
  });

  it('Capriola con pari al massimo e al minimo a 4 giocatori (gruppo "punteggio", prima dei Belati)', () => {
    const s0 = prosegui(
      scegli(
        prosegui(
          scenario({
            giocatori: 4,
            guaio: TOSATURA,
            mani: { g1: ['capriola'], g2: ['carriola'], g3: ['carriola'], g4: ['capriola'] },
          }),
        ),
        { g1: ['capriola'], g2: ['carriola'], g3: ['carriola'], g4: ['capriola'] },
      ),
    );
    // Due Capriole (5, 5) contro due Carriole (8, 8): la prima Capriola porta 5, 8, 8, 5 a 8, 5, 5, 8; la seconda lo riporta indietro.
    const attivaCorrente = (s: Stato): Stato => {
      const v = fase(s, 'effetti').coda[fase(s, 'effetti').indice];
      if (!v) throw new Error('voce mancante');
      return nessunaReazione(applica(s, { tipo: 'attivaEffetto', giocatore: v.giocatore, carta: v.carta }));
    };
    const tot = (s: Stato): number[] => ['g1', 'g2', 'g3', 'g4'].map((g) => totale(s, g));
    expect(tot(s0)).toEqual([5, 8, 8, 5]);
    const s1 = attivaCorrente(s0);
    expect(tot(s1)).toEqual([8, 5, 5, 8]);
    const s2 = attivaCorrente(s1);
    expect(tot(s2)).toEqual([5, 8, 8, 5]);
    expect(s2.fase.nome).toBe('belati_punteggio');
  });
});

// ─── §8.11 Guaio deviato che elimina chi lo riceve ───────────────────────────

describe('§8.11 Guaio deviato che elimina (brief §3 "Casi limite"; spec 4.10, 8, 9.2, D26)', () => {
  it('a 3 giocatori con un eliminato: il Guaio deviato elimina l\'ultimo avversario e il deviatore vince per Ultima pecora', () => {
    let s = finoAlDado(
      {
        eliminati: ['g2'],
        agnellini: { g2: 0 },
        guaio: 'grandine-a-sorpresa',
        angoli: { g1: ['fulmine-curioso', 'nebbia-fitta'] },
        mani: { g1: ['carriola'], g2: [], g3: ['sasso-comodo', 'finta-svenuta'] },
      },
      { g1: ['carriola'], g3: ['sasso-comodo'] },
    );
    s = prosegui(lanciaTutti(s));
    expect(fase(s, 'belati_salvataggio').destinatario).toBe('g3');
    s = nessunaReazione(giocaBelato(s, 'g3', 'finta-svenuta', { bersaglio: 'g1' }));
    s = passa(s, 'g1');
    expect(gioc(s, 'g1').angolo).toHaveLength(3);
    s = concludi(s, 'g1');
    expect(gioc(s, 'g1').eliminato).toBe(true);
    expect(s.esito).toEqual({ modo: 'ultima_pecora', vincitori: ['g3'] });
  });

  it('andata e ritorno: il Guaio torna al mittente e lo elimina', () => {
    let s = finoAlDado(
      {
        guaio: 'volpe-gentile',
        angoli: { g3: ['lupo-vegetariano', 'faina-con-la-lista'] },
        mani: { g1: ['carriola'], g2: ['balla-di-fieno', 'finta-svenuta'], g3: ['sasso-comodo', 'finta-svenuta'] },
      },
      { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['sasso-comodo'] },
    );
    s = prosegui(lanciaTutti(s));
    s = nessunaReazione(giocaBelato(s, 'g3', 'finta-svenuta', { bersaglio: 'g2' }));
    s = nessunaReazione(giocaBelato(s, 'g2', 'finta-svenuta', { bersaglio: 'g3' }));
    expect(fase(s, 'belati_salvataggio').destinatario).toBe('g3');
    s = concludi(passa(s, 'g3'), 'g3');
    expect(gioc(s, 'g3').eliminato).toBe(true);
    expect(gioc(s, 'g2').angolo).toEqual([]);
    expect(s.esito).toBeNull();
  });
});

// ─── §8.12 Mazzo esaurito a metà pescata e ultimo round ──────────────────────

describe('§8.12 mazzo esaurito a metà pescata, ultimo round e scarti mai rimescolati (brief §3 punto 12, "Come si vince" 3, "Casi limite")', () => {
  it('dalla pescata a metà alla vittoria: nel round finale chi è rimasto senza Trovate non gioca né prende il Guaio', () => {
    // Round 1: g1 8 lancia (+3), g3 2 prende il Guaio (+1). A fine round g1 pesca le ultime 2 carte.
    let s = finoAlDado(
      {
        mazzoGuai: ['spuntatina'],
        mazzo: ['coperta-di-lana', 'coperta-di-lana'],
        mani: {
          g1: ['carriola'],
          g2: ['balla-di-fieno', 'balla-di-fieno'],
          g3: ['sasso-comodo', 'pernacchia'],
        },
      },
      { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['sasso-comodo'] },
    );
    s = prosegui(lanciaTutti(s));
    s = concludi(passa(s, 'g3'), 'g3');
    fase(s, 'fine_round');
    expect(s.mazzo).toEqual([]);
    expect(s.ultimoRound).toBe(2);
    expect(gioc(s, 'g1').mano).toHaveLength(2);
    expect(gioc(s, 'g2').mano).toHaveLength(1);
    expect(gioc(s, 'g3').mano).toHaveLength(1);
    const scarti = [...s.scarti];

    s = prosegui(s);
    fase(s, 'ultimo_round');
    s = prosegui(prosegui(s));
    fase(s, 'scelta');
    expect(s.datiRound.partecipanti).toEqual(['g1', 'g2']);
    // Gli scarti non tornano nel mazzo per la ripescata di g3.
    expect(s.scarti).toEqual(scarti);
    expect(gioc(s, 'g3').mano).toHaveLength(1);

    s = chiudiPunteggio(prosegui(scegli(s, { g1: ['coperta-di-lana'], g2: ['balla-di-fieno'] })));
    s = prosegui(lanciaTutti(s));
    expect(fase(s, 'belati_salvataggio').destinatario).toBe('g2');
    expect(azioniPossibili(s, 'g3')).toEqual([]);
    s = concludi(passa(s, 'g2'), 'g2');
    // g1 3+3+3 = 9, g2 3+1 = 4, g3 3+1 = 4.
    expect(agnelliniDi(s)).toEqual([9, 4, 4]);
    expect(s.esito).toEqual({ modo: 'mazzo_finito', vincitori: ['g1'] });
  });

  it('con il mazzo vuoto la pescata di fine round non prende nulla dagli scarti', () => {
    let s = finoAlDado(
      {
        round: 3,
        ultimoRound: 4,
        mazzo: [],
        scarti: ['carriola', 'carriola', 'balla-di-fieno', 'coperta-di-lana', 'corona-di-margherite'],
        mani: { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['sasso-comodo'] },
      },
      { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['sasso-comodo'] },
    );
    s = concludi(passa(prosegui(lanciaTutti(s)), 'g3'), 'g3');
    fase(s, 'fine_round');
    expect(s.mazzo).toEqual([]);
    expect(s.scarti).toHaveLength(8);
    for (const g of s.giocatori) expect(g.mano).toEqual([]);
    s = avanza(prosegui(s));
    // Round 4 (ultimo): nessuno ha carte, nessuno partecipa; a fine round vince chi ha più agnellini.
    expect(s.round).toBe(4);
    expect(s.datiRound.partecipanti).toEqual([]);
    s = avanza(s);
    expect(s.esito).toEqual({ modo: 'mazzo_finito', vincitori: ['g1'] });
    expect(s.mazzo).toEqual([]);
  });
});

// ─── §8.13 Variante a 2 giocatori ────────────────────────────────────────────

describe('§8.13 variante a 2 nel flusso (brief §3 "Variante a 2 giocatori"; spec 8, D36)', () => {
  it('il Guaio deviato all\'avversario che ha già tre Meteo è il quarto uguale: lo elimina e il deviatore vince', () => {
    // g1 è il più basso e devia su g2, che ha tre Meteo: con il quarto scatta "4 uguali" (a 3 giocatori bastavano 3).
    let s = finoAlDado(
      {
        giocatori: 2,
        guaio: 'pozzanghera-senza-fondo',
        angoli: { g2: ['grandine-a-sorpresa', 'fulmine-curioso', 'nebbia-fitta'] },
        mani: { g1: ['balla-di-fieno', 'finta-svenuta'], g2: ['carriola'] },
      },
      { g1: ['balla-di-fieno'], g2: ['carriola'] },
    );
    s = prosegui(lanciaTutti(s));
    expect(fase(s, 'belati_salvataggio').destinatario).toBe('g1');
    s = nessunaReazione(giocaBelato(s, 'g1', 'finta-svenuta', { bersaglio: 'g2' }));
    s = concludi(passa(s, 'g2'), 'g2');
    expect(gioc(s, 'g2').eliminato).toBe(true);
    expect(s.esito).toEqual({ modo: 'ultima_pecora', vincitori: ['g1'] });
  });
});

// ─── §4 Carte: dati ──────────────────────────────────────────────────────────

describe('§4 dati delle carte e del dado non verificati altrove (brief §3 "Minigioco della Testata", §4)', () => {
  it('ogni carta ha nome e testo di colore non vuoti; ogni Guaio ha un tipo', () => {
    for (const c of [...carteJson.trovate, ...carteJson.belati, ...carteJson.guai]) {
      expect(typeof c.nome, c.id).toBe('string');
      expect(c.nome.trim().length, c.id).toBeGreaterThan(0);
      expect(typeof c.testo, c.id).toBe('string');
      expect(c.testo.trim().length, c.id).toBeGreaterThan(0);
    }
    for (const g of carteJson.guai) expect(['meteo', 'predatori', 'drammi', 'tosatura']).toContain(g.tipo);
  });

  it('le Trovate con effetto hanno i valori suggeriti dal brief', () => {
    const suggeriti: Record<string, number[]> = {
      scarta_e_somma: [0],
      prendi_agnellino: [1, 2],
      scarta_fino_a_tre: [3],
      sposta_agnellino: [4],
      guarda_due: [7],
      scambia_punteggi: [5],
      raddoppia_belati: [6],
      ignora_effetti: [9],
    };
    for (const def of Object.values(CATALOGO.carte)) {
      if (def.famiglia !== 'trovata' || def.effetto === null) continue;
      expect(suggeriti[def.effetto], def.id).toContain(def.valore);
    }
  });

  it('probabilità dell\'esito della Testata per simulatore e bot: 20%, 40%, 30%, 10%', () => {
    expect(setupJson.testata.probabilitaEsitoSimulatore).toEqual([0.2, 0.4, 0.3, 0.1]);
    expect(setupJson.testata.esitoMassimo).toBe(3);
  });

  it('inAttesaDi in Belato Finale non elenca chi è fuori dallo spareggio (coerenza con §8 "Belato Finale")', () => {
    const s = prosegui(
      lanciaTutti(
        finoAlDado(
          { mani: { g1: ['carriola'], g2: ['balla-di-fieno', 'sasso-comodo'], g3: ['balla-di-fieno', 'sasso-comodo'] } },
          { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['balla-di-fieno'] },
        ),
      ),
    );
    fase(s, 'belato_finale');
    expect(ordinati(inAttesaDi(s).giocatori)).toEqual(['g2', 'g3']);
    expect(azioniPossibili(s, 'g1')).toEqual([]);
  });
});

// ─── §3 Effetti: una volta per carta per round ───────────────────────────────

describe('§3 "Gli effetti valgono una volta per carta per round" (brief §3; spec 4.4, D11)', () => {
  it('un effetto risolto non si riattiva: Agnellino smarrito dà un solo agnellino e la sua voce non torna corrente', () => {
    let s = prosegui(
      scegli(
        prosegui(
          scenario({
            guaio: TOSATURA,
            gregge: 10,
            mani: { g1: ['agnellino-smarrito'], g2: ['balla-di-fieno'], g3: ['megafono-di-latta'] },
          }),
        ),
        { g1: ['agnellino-smarrito'], g2: ['balla-di-fieno'], g3: ['megafono-di-latta'] },
      ),
    );
    const voce = fase(s, 'effetti').coda[0];
    if (!voce) throw new Error('voce mancante');
    s = nessunaReazione(applica(s, { tipo: 'attivaEffetto', giocatore: 'g1', carta: voce.carta }));
    expect(gioc(s, 'g1').agnellini).toBe(4);
    rifiutata(s, { tipo: 'attivaEffetto', giocatore: 'g1', carta: voce.carta });
    rifiutata(s, { tipo: 'rinunciaEffetto', giocatore: 'g1', carta: voce.carta });
    s = rinunciaTutti(s);
    expect(s.fase.nome).toBe('belati_punteggio');
    rifiutata(s, { tipo: 'attivaEffetto', giocatore: 'g1', carta: voce.carta });
    expect(gioc(s, 'g1').agnellini).toBe(4);
    expect(s.gregge).toBe(9);
  });
});

// ─── §8.6 Ogni combinazione con la Tosatura: controllo a forza bruta ─────────

describe('§8.6 ogni combinazione con la Tosatura, a forza bruta (brief §3 "Eliminazione", "Variante a 2"; spec 8, D29, D46)', () => {
  const TIPI3: TipoGuaio[] = ['meteo', 'predatori', 'drammi'];
  type Conta = Record<TipoGuaio, number>;

  const piuUno = (c: Conta, t: TipoGuaio): Conta => ({ ...c, [t]: c[t] + 1 }) as Conta;

  /** D29: per gli uguali ogni Tosatura diventa un Guaio di un tipo a scelta; elimina se almeno una scelta raggiunge la soglia. */
  function ugualiPerDefinizione(conta: Conta, tosature: number, soglia: number): boolean {
    if (tosature === 0) return TIPI3.some((t) => conta[t] >= soglia);
    return TIPI3.some((t) => ugualiPerDefinizione(piuUno(conta, t), tosature - 1, soglia));
  }

  /** D46: 3 uguali (4 a 2 giocatori) o 4 diversi, dove ogni Tosatura conta come un tipo in più. */
  function eliminaPerDefinizione(conta: Conta, tosature: number, dueGiocatori: boolean): boolean {
    const diversi = TIPI3.filter((t) => conta[t] >= 1).length + tosature;
    return ugualiPerDefinizione(conta, tosature, dueGiocatori ? 4 : 3) || diversi >= 4;
  }

  function angolo(c: Conta, t: number): TipoGuaioCarta[] {
    return [
      ...Array<TipoGuaioCarta>(c.meteo).fill('meteo'),
      ...Array<TipoGuaioCarta>(c.predatori).fill('predatori'),
      ...Array<TipoGuaioCarta>(c.drammi).fill('drammi'),
      ...Array<TipoGuaioCarta>(t).fill('tosatura'),
    ];
  }

  for (const giocatori of [2, 3, 4]) {
    it(`a ${giocatori} giocatori angoloElimina coincide con la definizione per ogni Angolo (fino a 5 per tipo e 3 Tosature)`, () => {
      const regole = scenario({ giocatori }).config.regoleEliminazione;
      let casi = 0;
      for (let m = 0; m <= 5; m++)
        for (let p = 0; p <= 5; p++)
          for (let d = 0; d <= 5; d++)
            for (let t = 0; t <= 3; t++) {
              const c: Conta = { meteo: m, predatori: p, drammi: d };
              const atteso = eliminaPerDefinizione(c, t, giocatori === 2);
              expect(angoloElimina(angolo(c, t), regole), `M${m} P${p} D${d} T${t}`).toBe(atteso);
              casi++;
            }
      expect(casi).toBe(6 * 6 * 6 * 4);
    });
  }

  it('tipiCheEliminano coincide con la definizione per ogni Angolo che non elimina già (2 e 3 giocatori)', () => {
    const nomi: Record<TipoGuaioCarta, IdTipoCarta[]> = {
      meteo: ['grandine-a-sorpresa', 'fulmine-curioso', 'pioggia-di-traverso'],
      predatori: ['lupo-vegetariano', 'volpe-gentile', 'aquila-con-il-taccuino'],
      drammi: ['figuraccia-al-pascolo', 'specchio-impietoso', 'crisi-esistenziale'],
      tosatura: ['tosatura-a-sorpresa', 'spuntatina', 'rasatura-integrale'],
    };
    let controllati = 0;
    for (const giocatori of [2, 3]) {
      const due = giocatori === 2;
      for (let m = 0; m <= 3; m++)
        for (let p = 0; p <= 3; p++)
          for (let d = 0; d <= 3; d++)
            for (let t = 0; t <= 2; t++) {
              const c: Conta = { meteo: m, predatori: p, drammi: d };
              if (eliminaPerDefinizione(c, t, due)) continue;
              const carte: IdTipoCarta[] = [
                ...nomi.meteo.slice(0, m),
                ...nomi.predatori.slice(0, p),
                ...nomi.drammi.slice(0, d),
                ...nomi.tosatura.slice(0, t),
              ];
              const s = scenario({ giocatori, angoli: { g1: carte } });
              const attesi: TipoGuaioCarta[] = [
                ...TIPI3.filter((x) => eliminaPerDefinizione(piuUno(c, x), t, due)),
                ...(eliminaPerDefinizione(c, t + 1, due) ? (['tosatura'] as const) : []),
              ];
              expect(ordinati(tipiCheEliminano(s, 'g1')), `${giocatori}g M${m} P${p} D${d} T${t}`).toEqual(ordinati(attesi));
              controllati++;
            }
    }
    expect(controllati).toBeGreaterThan(50);
  });
});
