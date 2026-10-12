// Revisione avversariale: Guai, Belato Finale, salvataggio, consolazione, eliminazione, fine partita.
// Casi limite non coperti dalla suite esistente. Regole: brief-codice2.md sezione 3 ("Svolgimento di un
// round" passi 8–12, "Parità", "Eliminazione", "Come si vince", "Casi limite") e docs/motore.md sezioni
// 4.1, 4.8–4.12, 5, 8, 9 con le decisioni D5, D6, D24–D28, D30, D33–D37.
import { describe, expect, it } from 'vitest';
import {
  angoloElimina,
  applica,
  azioniPossibili,
  configPer,
  defCarta,
  ErroreRegola,
  inAttesaDi,
  nuovaPartita,
  tipoDi,
  type Azione,
  type Evento,
  type Fase,
  type IdCarta,
  type IdGiocatore,
  type IdPecora,
  type IdTipoCarta,
  type NomeFase,
  type Stato,
  type StatoGiocatore,
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
  type OpzioniScenario,
} from './aiuti';

// ─── Aiuti locali ────────────────────────────────────────────────────────────

/** Guaio senza tratti: i totali sono i soli valori stampati. */
const TOSATURA = 'tosatura-a-sorpresa';

type Scelte = Record<IdGiocatore, Array<IdTipoCarta | IdCarta>>;
type EventoDi<T extends Evento['tipo']> = Extract<Evento, { tipo: T }>;

function fase<N extends NomeFase>(s: Stato, nome: N): Extract<Fase, { nome: N }> {
  expect(s.fase.nome).toBe(nome);
  return s.fase as Extract<Fase, { nome: N }>;
}

function gioc(s: Stato, id: IdGiocatore): StatoGiocatore {
  const g = s.giocatori.find((x) => x.id === id);
  if (!g) throw new Error(`giocatore ${id} assente`);
  return g;
}

const ordinati = <T extends string>(a: readonly T[]): T[] => [...a].sort();

/** Eventi di un tipo emessi passando da `prima` a `dopo`. */
function eventi<T extends Evento['tipo']>(prima: Stato, dopo: Stato, tipo: T): EventoDi<T>[] {
  return dopo.eventi.filter((e): e is EventoDi<T> => e.seq >= prima.prossimoEvento && e.tipo === tipo);
}

function guaioAttivo(s: Stato): IdCarta {
  const g = s.datiRound.guaio;
  if (g === null) throw new Error('nessun Guaio attivo');
  return g;
}

function verificaRifiuto(s: Stato, azione: Azione): void {
  const copia = structuredClone(s);
  expect(() => applica(s, azione), JSON.stringify(azione)).toThrow(ErroreRegola);
  expect(s).toEqual(copia);
}

const passa = (s: Stato, chi: IdGiocatore): Stato => applica(s, { tipo: 'passa', giocatore: chi });

function giocaBelato(
  s: Stato,
  chi: IdGiocatore,
  tipo: IdTipoCarta,
  extra: { bersaglio?: IdGiocatore; guaio?: IdCarta } = {},
): Stato {
  return applica(s, { tipo: 'giocaBelato', giocatore: chi, carta: carta(s, chi, tipo), ...extra });
}

/** Beee-NO! di `chi` contro la cima della pila. */
function beeeNo(s: Stato, chi: IdGiocatore): Stato {
  const cima = s.pila[s.pila.length - 1];
  if (!cima) throw new Error('pila vuota');
  return applica(s, { tipo: 'giocaBelato', giocatore: chi, carta: carta(s, chi, 'beee-no'), voce: cima.id });
}

const sceltaFinale = (s: Stato, chi: IdGiocatore, tipo: IdTipoCarta): Stato =>
  applica(s, { tipo: 'sceltaFinale', giocatore: chi, carta: carta(s, chi, tipo) });

const concludi = (s: Stato, chi: IdGiocatore, scarta: IdCarta | null = null): Stato =>
  applica(s, { tipo: 'concludiConsolazione', giocatore: chi, scarta });

/** Da scenario a punteggio chiuso, rinunciando a ogni effetto. */
function finoAlDado(o: OpzioniScenario, scelte: Scelte): Stato {
  let s = prosegui(scenario(o));
  fase(s, 'scelta');
  s = prosegui(scegli(s, scelte));
  if (s.fase.nome === 'effetti') s = rinunciaTutti(s);
  if (s.fase.nome === 'belati_punteggio') s = chiudiPunteggio(s);
  return s;
}

/** Ogni lanciatore ottiene la faccia indicata e nessuno reagisce. */
function lanciaTutti(s: Stato, faccia = 'pascolo_piccolo'): Stato {
  for (let giri = 0; s.fase.nome === 'dado'; giri++) {
    if (giri > 10) throw new Error('troppi lanci');
    const chi = s.datiRound.lanciatori[fase(s, 'dado').indice];
    if (chi === undefined) throw new Error('lanciatore mancante');
    s = nessunaReazione(applica(conFaccia(s, faccia), { tipo: 'lanciaDado', giocatore: chi }));
  }
  return s;
}

/** Da scenario a 'guaio_al_peggiore' (o oltre, se la partita finisce prima). */
function dopoIlDado(o: OpzioniScenario, scelte: Scelte): Stato {
  return lanciaTutti(finoAlDado(o, scelte));
}

/** Mani con in testa la carta giocata nel round. */
function mani(giocate: Record<IdGiocatore, IdTipoCarta>, resto: Scelte = {}): Scelte {
  return Object.fromEntries(Object.entries(giocate).map(([id, c]) => [id, [c, ...(resto[id] ?? [])]]));
}

function scelte(giocate: Record<IdGiocatore, IdTipoCarta>): Scelte {
  return Object.fromEntries(Object.entries(giocate).map(([id, c]) => [id, [c]]));
}

/** Round a 3: g1 Carriola (8) lancia, g3 Coperta di lana (6), g2 Sasso comodo (2) prende il Guaio. */
const BASE3 = { g1: 'carriola', g2: 'sasso-comodo', g3: 'coperta-di-lana' } as const;

/** Fino al salvataggio di g2 nel round BASE3, con un Guaio Tosatura. */
function alSalvataggio(resto: Scelte = {}, o: OpzioniScenario = {}): Stato {
  const s = prosegui(dopoIlDado({ guaio: TOSATURA, ...o, mani: mani(BASE3, resto) }, scelte(BASE3)));
  expect(s.fase).toEqual({ nome: 'belati_salvataggio', destinatario: 'g2' });
  return s;
}

function allaConsolazione(resto: Scelte = {}, o: OpzioniScenario = {}): Stato {
  const s = passa(alSalvataggio(resto, o), 'g2');
  expect(s.fase).toEqual({ nome: 'consolazione', destinatario: 'g2' });
  return s;
}

// ─── Belato Finale ───────────────────────────────────────────────────────────

describe('Belato Finale: ripetizioni, mancanza di Trovate, carte sul tavolo (brief 3 "Parità"; specifica 4.9, D24, D25)', () => {
  /** 4 giocatori: g1 Carriola (8) lancia, g2 g3 g4 pari a 5 con la Balla di fieno. */
  const PARI4 = { g1: 'carriola', g2: 'balla-di-fieno', g3: 'balla-di-fieno', g4: 'balla-di-fieno' } as const;

  function alBelatoFinale4(resto: Scelte): Stato {
    let s = dopoIlDado({ giocatori: 4, guaio: TOSATURA, mani: mani(PARI4, resto) }, scelte(PARI4));
    expect(ordinati(fase(s, 'guaio_al_peggiore').spareggio ?? [])).toEqual(['g2', 'g3', 'g4']);
    s = prosegui(s);
    return s;
  }

  it('si ripete due volte (prima fra tutti e tre di nuovo pari, poi fra due) e ogni carta rivelata finisce sul tavolo e poi negli scarti', () => {
    let s = alBelatoFinale4({
      g2: ['sasso-comodo', 'trifoglio-qualunque', 'corona-di-margherite'],
      g3: ['pantofola-gemella', 'trifoglio-qualunque', 'carriola'],
      g4: ['sasso-comodo', 'coperta-di-lana', 'ombrello-bucato'],
    });
    fase(s, 'belato_finale');
    const inizio = s;

    // 1ª rivelazione: 2, 2, 2 → tutti e tre di nuovo pari, si ripete fra tutti.
    s = sceltaFinale(sceltaFinale(sceltaFinale(s, 'g2', 'sasso-comodo'), 'g3', 'pantofola-gemella'), 'g4', 'sasso-comodo');
    let f = fase(s, 'belato_finale');
    expect(ordinati(f.partecipanti)).toEqual(['g2', 'g3', 'g4']);
    expect(f.scelte).toEqual({ g2: null, g3: null, g4: null });
    expect(f.storico).toHaveLength(1);

    // 2ª rivelazione: 4, 4, 6 → si ripete fra g2 e g3.
    s = sceltaFinale(sceltaFinale(sceltaFinale(s, 'g2', 'trifoglio-qualunque'), 'g3', 'trifoglio-qualunque'), 'g4', 'coperta-di-lana');
    f = fase(s, 'belato_finale');
    expect(ordinati(f.partecipanti)).toEqual(['g2', 'g3']);
    expect(f.storico).toHaveLength(2);
    verificaRifiuto(s, { tipo: 'sceltaFinale', giocatore: 'g4', carta: carta(s, 'g4', 'ombrello-bucato') });

    // 3ª rivelazione: 9 contro 8 → g3 prende il Guaio.
    s = sceltaFinale(sceltaFinale(s, 'g2', 'corona-di-margherite'), 'g3', 'carriola');
    expect(s.fase).toEqual({ nome: 'belati_salvataggio', destinatario: 'g3' });
    const rivelate = eventi(inizio, s, 'belato_finale').flatMap((e) => Object.values(e.rivelate));
    expect(rivelate).toHaveLength(8);
    for (const c of rivelate) {
      expect(s.datiRound.tavolo).toContain(c);
      for (const g of s.giocatori) expect(g.mano).not.toContain(c);
    }

    s = concludi(passa(s, 'g3'), 'g3');
    fase(s, 'fine_round');
    for (const c of rivelate) expect(s.scarti).toContain(c);
    expect(s.datiRound.tavolo).toEqual([]);
  });

  it('tre pari: se all\'ingresso uno solo è senza Trovate prende subito il Guaio e gli altri non giocano', () => {
    const s0 = dopoIlDado(
      {
        giocatori: 4,
        guaio: TOSATURA,
        mani: mani(PARI4, { g2: ['trifoglio-qualunque'], g3: ['sasso-comodo'], g4: ['beee-no'] }),
      },
      scelte(PARI4),
    );
    const s = prosegui(s0);
    expect(s.fase).toEqual({ nome: 'belati_salvataggio', destinatario: 'g4' });
    expect(eventi(s0, s, 'belato_finale')).toEqual([]);
    expect(gioc(s, 'g2').mano).toEqual(gioc(s0, 'g2').mano);
    expect(gioc(s, 'g3').mano).toEqual(gioc(s0, 'g3').mano);
  });

  it('tre pari: se all\'ingresso due sono senza Trovate il Guaio va in fondo anche se il terzo ne ha', () => {
    const s0 = dopoIlDado(
      {
        giocatori: 4,
        guaio: TOSATURA,
        mani: mani(PARI4, { g2: ['trifoglio-qualunque'], g3: ['pernacchia'], g4: [] }),
      },
      scelte(PARI4),
    );
    const guaio = guaioAttivo(s0);
    const s = prosegui(s0);
    fase(s, 'fine_round');
    expect(s.mazzoGuai[s.mazzoGuai.length - 1]).toBe(guaio);
    expect(eventi(s0, s, 'guaio_preso')).toEqual([]);
    expect(eventi(s0, s, 'belato_finale')).toEqual([]);
    for (const g of s.giocatori) expect(g.angolo).toEqual([]);
  });

  it('durante il Belato Finale non si giocano Belati di salvataggio né Visita di Garzina (D25, D37)', () => {
    const s = alBelatoFinale4({
      g2: ['trifoglio-qualunque', 'faccio-finta-di-niente', 'finta-svenuta'],
      g3: ['sasso-comodo', 'visita-di-garzina'],
      g4: ['coperta-di-lana'],
    });
    fase(s, 'belato_finale');
    verificaRifiuto(s, { tipo: 'giocaBelato', giocatore: 'g2', carta: carta(s, 'g2', 'faccio-finta-di-niente') });
    verificaRifiuto(s, { tipo: 'giocaBelato', giocatore: 'g2', carta: carta(s, 'g2', 'finta-svenuta'), bersaglio: 'g1' });
    verificaRifiuto(s, { tipo: 'passa', giocatore: 'g2' });
    expect(azioniPossibili(s, 'g2').every((a) => a.tipo === 'sceltaFinale')).toBe(true);
    expect(azioniPossibili(s, 'g1')).toEqual([]);
  });

  it('chi perde il Belato Finale può deviare il Guaio su chi l\'ha vinto, che lo prende con la consolazione (D26)', () => {
    const PARI3 = { g1: 'carriola', g2: 'balla-di-fieno', g3: 'balla-di-fieno' } as const;
    let s = dopoIlDado(
      { guaio: TOSATURA, mani: mani(PARI3, { g2: ['trifoglio-qualunque'], g3: ['sasso-comodo', 'finta-svenuta'] }) },
      scelte(PARI3),
    );
    s = prosegui(s);
    s = sceltaFinale(sceltaFinale(s, 'g2', 'trifoglio-qualunque'), 'g3', 'sasso-comodo');
    expect(s.fase).toEqual({ nome: 'belati_salvataggio', destinatario: 'g3' });
    const bersagli = azioniPossibili(s, 'g3').flatMap((a) => (a.tipo === 'giocaBelato' ? [a.bersaglio] : []));
    expect(ordinati(bersagli as string[])).toEqual(['g1', 'g2']);

    const guaio = guaioAttivo(s);
    s = nessunaReazione(giocaBelato(s, 'g3', 'finta-svenuta', { bersaglio: 'g2' }));
    expect(s.fase).toEqual({ nome: 'belati_salvataggio', destinatario: 'g2' });
    const prima = s;
    s = passa(s, 'g2');
    expect(s.fase).toEqual({ nome: 'consolazione', destinatario: 'g2' });
    expect(gioc(s, 'g2').angolo).toEqual([guaio]);
    expect(gioc(s, 'g2').agnellini).toBe(gioc(prima, 'g2').agnellini + 1);
    expect(gioc(s, 'g3').angolo).toEqual([]);
  });

  it('chi perde il Belato Finale può mandare il Guaio in fondo: niente consolazione, nessun Angolo toccato', () => {
    const PARI3 = { g1: 'carriola', g2: 'balla-di-fieno', g3: 'balla-di-fieno' } as const;
    let s = dopoIlDado(
      { guaio: TOSATURA, mani: mani(PARI3, { g2: ['trifoglio-qualunque'], g3: ['sasso-comodo', 'faccio-finta-di-niente'] }) },
      scelte(PARI3),
    );
    s = prosegui(s);
    s = sceltaFinale(sceltaFinale(s, 'g2', 'trifoglio-qualunque'), 'g3', 'sasso-comodo');
    const guaio = guaioAttivo(s);
    const prima = s;
    s = nessunaReazione(giocaBelato(s, 'g3', 'faccio-finta-di-niente'));
    fase(s, 'fine_round');
    expect(s.mazzoGuai[s.mazzoGuai.length - 1]).toBe(guaio);
    expect(eventi(prima, s, 'guaio_preso')).toEqual([]);
    expect(gioc(s, 'g3').agnellini).toBe(gioc(prima, 'g3').agnellini);
  });

  it('a 4 giocatori due pari al massimo e due al minimo: prima lanciano entrambi, poi il Belato Finale fra gli altri due', () => {
    const giocate = { g1: 'carriola', g2: 'sasso-comodo', g3: 'carriola', g4: 'sasso-comodo' } as const;
    const s0 = finoAlDado(
      {
        giocatori: 4,
        guaio: TOSATURA,
        agnellini: { g1: 4, g3: 2 },
        mani: mani(giocate, { g2: ['trifoglio-qualunque'], g4: ['coperta-di-lana'] }),
      },
      scelte(giocate),
    );
    expect(s0.datiRound.lanciatori).toEqual(['g3', 'g1']);
    let s = lanciaTutti(s0);
    expect(eventi(s0, s, 'dado_lanciato').map((e) => e.giocatore)).toEqual(['g3', 'g1']);
    expect(ordinati(fase(s, 'guaio_al_peggiore').spareggio ?? [])).toEqual(['g2', 'g4']);
    s = prosegui(s);
    expect(ordinati(fase(s, 'belato_finale').partecipanti)).toEqual(['g2', 'g4']);
    s = sceltaFinale(sceltaFinale(s, 'g2', 'trifoglio-qualunque'), 'g4', 'coperta-di-lana');
    expect(s.fase).toEqual({ nome: 'belati_salvataggio', destinatario: 'g2' });
  });
});

// ─── Deviazioni a catena ─────────────────────────────────────────────────────

describe('Deviazioni a catena e ritorno al mittente (brief 3 "Casi limite"; specifica 4.10, 5, D5, D6, D26)', () => {
  it('a 4 giocatori il Guaio passa g2 → g3 → g4 → g1 e solo l\'ultimo lo prende, con la consolazione', () => {
    const giocate = { g1: 'carriola', g2: 'sasso-comodo', g3: 'balla-di-fieno', g4: 'coperta-di-lana' } as const;
    let s = dopoIlDado(
      {
        giocatori: 4,
        guaio: TOSATURA,
        mani: mani(giocate, { g2: ['finta-svenuta'], g3: ['finta-svenuta'], g4: ['finta-svenuta'] }),
      },
      scelte(giocate),
    );
    s = prosegui(s);
    expect(s.fase).toEqual({ nome: 'belati_salvataggio', destinatario: 'g2' });
    const inizio = s;
    const guaio = guaioAttivo(s);

    s = nessunaReazione(giocaBelato(s, 'g2', 'finta-svenuta', { bersaglio: 'g3' }));
    s = nessunaReazione(giocaBelato(s, 'g3', 'finta-svenuta', { bersaglio: 'g4' }));
    s = nessunaReazione(giocaBelato(s, 'g4', 'finta-svenuta', { bersaglio: 'g1' }));
    expect(s.fase).toEqual({ nome: 'belati_salvataggio', destinatario: 'g1' });
    expect(inAttesaDi(s)).toEqual({ sistema: false, giocatori: ['g1'] });
    expect(eventi(inizio, s, 'guaio_deviato').map((e) => [e.da, e.a])).toEqual([
      ['g2', 'g3'],
      ['g3', 'g4'],
      ['g4', 'g1'],
    ]);
    // Il primo destinatario non può più decidere nulla.
    verificaRifiuto(s, { tipo: 'passa', giocatore: 'g2' });

    const prima = s;
    s = passa(s, 'g1');
    expect(s.fase).toEqual({ nome: 'consolazione', destinatario: 'g1' });
    expect(s.datiRound.presoDa).toBe('g1');
    expect(gioc(s, 'g1').angolo).toEqual([guaio]);
    expect(gioc(s, 'g1').agnellini).toBe(gioc(prima, 'g1').agnellini + 1);
    for (const id of ['g2', 'g3', 'g4']) {
      expect(gioc(s, id).angolo).toEqual([]);
      expect(gioc(s, id).agnellini).toBe(gioc(prima, id).agnellini);
    }
    s = concludi(s, 'g1');
    fase(s, 'fine_round');
    // Le tre Finte svenute vanno negli scarti.
    expect(s.scarti.filter((c) => tipoDi(c) === 'finta-svenuta')).toHaveLength(3);
  });

  it('Beee-NO! contro la Finta svenuta annullato da chi l\'ha giocata: la deviazione si applica (D5, D6)', () => {
    let s = alSalvataggio({ g2: ['finta-svenuta', 'beee-no'], g3: ['beee-no'] });
    s = giocaBelato(s, 'g2', 'finta-svenuta', { bersaglio: 'g3' });
    s = beeeNo(s, 'g3');
    // L'autore della Finta svenuta può rispondere al Beee-NO! giocato contro di lui.
    expect(s.finestra?.inAttesa).toContain('g2');
    s = beeeNo(s, 'g2');
    s = nessunaReazione(s);
    expect(s.pila).toEqual([]);
    expect(s.fase).toEqual({ nome: 'belati_salvataggio', destinatario: 'g3' });
  });

  it('ritorno al mittente annullato: chi l\'ha rimandato resta destinatario; poi Faccio finta di niente lo manda in fondo', () => {
    let s = alSalvataggio({ g2: ['finta-svenuta', 'beee-no'], g3: ['finta-svenuta', 'faccio-finta-di-niente'] });
    const guaio = guaioAttivo(s);
    s = nessunaReazione(giocaBelato(s, 'g2', 'finta-svenuta', { bersaglio: 'g3' }));
    s = giocaBelato(s, 'g3', 'finta-svenuta', { bersaglio: 'g2' });
    s = nessunaReazione(beeeNo(s, 'g2'));
    expect(s.fase).toEqual({ nome: 'belati_salvataggio', destinatario: 'g3' });

    const prima = s;
    s = nessunaReazione(giocaBelato(s, 'g3', 'faccio-finta-di-niente'));
    fase(s, 'fine_round');
    expect(s.mazzoGuai[s.mazzoGuai.length - 1]).toBe(guaio);
    expect(eventi(prima, s, 'guaio_preso')).toEqual([]);
    for (const g of s.giocatori) expect(g.angolo).toEqual([]);
  });
});

// ─── Visita di Garzina ───────────────────────────────────────────────────────

describe('Visita di Garzina al limite (D37; specifica 4.1, 4.11, 5, D27)', () => {
  it('curato il Guaio appena preso con il mazzo Guai vuoto, il round dopo si scopre proprio quello, senza rimescolare i Guai fuori gioco', () => {
    let s = allaConsolazione({ g2: ['visita-di-garzina'] }, { mazzoGuai: [], guaiFuoriGioco: ['insonnia'] });
    const guaio = guaioAttivo(s);
    s = nessunaReazione(giocaBelato(s, 'g2', 'visita-di-garzina', { guaio }));
    expect(gioc(s, 'g2').angolo).toEqual([]);
    expect(s.mazzoGuai).toEqual([guaio]);
    s = concludi(s, 'g2');
    const fuori = s.guaiFuoriGioco;
    expect(fuori).toHaveLength(1);

    const prima = s;
    s = prosegui(s);
    expect(s.round).toBe(2);
    expect(s.datiRound.guaio).toBe(guaio);
    expect(s.guaiFuoriGioco).toEqual(fuori);
    expect(eventi(prima, s, 'guai_rimescolati')).toEqual([]);
  });

  it('Beee-NO! contro la cura annullato dall\'autore della cura: la cura avviene (D5, D6)', () => {
    let s = allaConsolazione(
      { g1: ['beee-no'], g2: ['visita-di-garzina', 'beee-no'] },
      { angoli: { g2: ['grandine-a-sorpresa', 'fulmine-curioso'] } },
    );
    const guaio = guaioAttivo(s);
    s = giocaBelato(s, 'g2', 'visita-di-garzina', { guaio });
    s = beeeNo(s, 'g1');
    s = beeeNo(s, 'g2');
    // Il Beee-NO! di g2 annulla quello di g1; si riapre la finestra sulla cura: risponde chiunque tranne chi l'ha giocata.
    s = applica(s, { tipo: 'scadenza' });
    expect(s.pila).toHaveLength(1);
    expect(ordinati(s.finestra?.inAttesa ?? [])).toEqual(['g1', 'g3']);
    const prima = s;
    s = nessunaReazione(s);
    expect(eventi(prima, s, 'guaio_curato')).toEqual([expect.objectContaining({ giocatore: 'g2', carta: guaio })]);
    expect(gioc(s, 'g2').angolo).toHaveLength(2);
    s = concludi(s, 'g2');
    expect(gioc(s, 'g2').eliminato).toBe(false);
  });

  it('prima cura annullata, seconda sullo stesso Guaio a segno: niente eliminazione', () => {
    let s = allaConsolazione(
      { g3: ['beee-no'], g2: ['visita-di-garzina', 'visita-di-garzina'] },
      { angoli: { g2: ['grandine-a-sorpresa', 'fulmine-curioso'] } },
    );
    const guaio = guaioAttivo(s);
    s = nessunaReazione(beeeNo(giocaBelato(s, 'g2', 'visita-di-garzina', { guaio }), 'g3'));
    expect(gioc(s, 'g2').angolo).toContain(guaio);
    expect(s.fase).toEqual({ nome: 'consolazione', destinatario: 'g2' });

    s = nessunaReazione(giocaBelato(s, 'g2', 'visita-di-garzina', { guaio }));
    expect(gioc(s, 'g2').angolo).not.toContain(guaio);
    expect(s.mazzoGuai[s.mazzoGuai.length - 1]).toBe(guaio);
    s = concludi(s, 'g2');
    expect(gioc(s, 'g2').eliminato).toBe(false);
    expect(s.scarti.filter((c) => tipoDi(c) === 'visita-di-garzina')).toHaveLength(2);
  });

  it('dopo una deviazione cura solo chi ha preso il Guaio, non chi l\'ha deviato', () => {
    let s = alSalvataggio(
      { g2: ['finta-svenuta', 'visita-di-garzina'], g3: ['visita-di-garzina'] },
      { angoli: { g2: ['insonnia'], g3: ['lupo-vegetariano', 'volpe-gentile'] } },
    );
    s = nessunaReazione(giocaBelato(s, 'g2', 'finta-svenuta', { bersaglio: 'g3' }));
    s = passa(s, 'g3');
    expect(s.fase).toEqual({ nome: 'consolazione', destinatario: 'g3' });
    const guaio = guaioAttivo(s);
    verificaRifiuto(s, {
      tipo: 'giocaBelato',
      giocatore: 'g2',
      carta: carta(s, 'g2', 'visita-di-garzina'),
      guaio: gioc(s, 'g2').angolo[0]!,
    });
    expect(azioniPossibili(s, 'g2')).toEqual([]);

    s = nessunaReazione(giocaBelato(s, 'g3', 'visita-di-garzina', { guaio }));
    s = concludi(s, 'g3');
    // 2 Predatori senza la Tosatura: nessuna eliminazione.
    expect(gioc(s, 'g3').eliminato).toBe(false);
    expect(gioc(s, 'g3').angolo).toHaveLength(2);
  });

  it('curato tutto l\'Angolo: resta vuoto e i Guai vanno in fondo nell\'ordine delle cure', () => {
    let s = allaConsolazione(
      { g2: ['visita-di-garzina', 'visita-di-garzina'] },
      { angoli: { g2: ['grandine-a-sorpresa'] } },
    );
    const angolo = gioc(s, 'g2').angolo;
    expect(angolo).toHaveLength(2);
    const [vecchio, nuovo] = angolo as [IdCarta, IdCarta];
    const mazzoGuai = s.mazzoGuai;
    s = nessunaReazione(giocaBelato(s, 'g2', 'visita-di-garzina', { guaio: nuovo }));
    s = nessunaReazione(giocaBelato(s, 'g2', 'visita-di-garzina', { guaio: vecchio }));
    expect(gioc(s, 'g2').angolo).toEqual([]);
    expect(s.mazzoGuai).toEqual([...mazzoGuai, nuovo, vecchio]);
    // Non resta nulla da curare: la cura non è più tra le azioni possibili.
    expect(azioniPossibili(s, 'g2').some((a) => a.tipo === 'giocaBelato')).toBe(false);
    s = concludi(s, 'g2');
    expect(gioc(s, 'g2').eliminato).toBe(false);
  });
});

// ─── Consolazione ────────────────────────────────────────────────────────────

describe('Consolazione al limite (brief 3 passo 10; specifica 4.11, 9.1, D30, D39)', () => {
  /** Posti dell'Ovile a 3 giocatori (setup.json). */
  const POSTI3 = configPer(3).postiOvile;

  it('Gregge vuoto e Ovile a un posto dal pieno: niente agnellino, niente vittoria, il round prosegue', () => {
    let s = allaConsolazione({}, { gregge: 0, agnellini: { g1: 3, g2: POSTI3 - 1, g3: 3 } });
    expect(gioc(s, 'g2').agnellini).toBe(POSTI3 - 1);
    expect(s.gregge).toBe(0);
    expect(s.esito).toBeNull();
    s = concludi(s, 'g2');
    fase(s, 'fine_round');
    expect(s.esito).toBeNull();
    expect(gioc(s, 'g2').agnellini).toBe(POSTI3 - 1);
  });

  it('Gregge con un solo agnellino (il Pascolo è stato annullato): la consolazione lo prende e riempie l\'Ovile', () => {
    let s = finoAlDado(
      { guaio: TOSATURA, gregge: 1, agnellini: { g1: 3, g2: POSTI3 - 1, g3: 3 }, mani: mani(BASE3, { g3: ['beee-no'] }) },
      scelte(BASE3),
    );
    s = applica(conFaccia(s, 'pascolo_grande'), { tipo: 'lanciaDado', giocatore: 'g1' });
    s = nessunaReazione(beeeNo(s, 'g3'));
    expect(s.gregge).toBe(1);
    s = passa(prosegui(s), 'g2');
    expect(s.esito).toEqual({ modo: 'ovile_pieno', vincitori: ['g2'] });
    expect(s.gregge).toBe(0);
    expect(gioc(s, 'g2').agnellini).toBe(POSTI3);
  });

  it('a 2 giocatori l\'agnellino di consolazione che porta a 18 fa vincere; a 16 no', () => {
    const posti2 = configPer(2).postiOvile;
    expect(posti2).toBe(18);
    const giocate = { g1: 'carriola', g2: 'balla-di-fieno' } as const;
    const verso = (agnellini: number): Stato => {
      const s = prosegui(
        dopoIlDado({ giocatori: 2, guaio: TOSATURA, agnellini: { g1: 3, g2: agnellini }, mani: mani(giocate) }, scelte(giocate)),
      );
      return passa(s, 'g2');
    };
    const vince = verso(posti2 - 1);
    expect(vince.esito).toEqual({ modo: 'ovile_pieno', vincitori: ['g2'] });
    expect(gioc(vince, 'g2').agnellini).toBe(posti2);
    const continua = verso(posti2 - 2);
    expect(continua.esito).toBeNull();
    expect(continua.fase).toEqual({ nome: 'consolazione', destinatario: 'g2' });
  });
});

// ─── Eliminazione ────────────────────────────────────────────────────────────

describe('Eliminazione: destino dell\'eliminato e Ultima pecora (brief 3 "Eliminazione", "Come si vince" 2; specifica 4.12, 8, 9.2)', () => {
  it('a 4 giocatori con due già eliminati, la terza eliminazione dà la vittoria all\'ultima pecora', () => {
    const giocate = { g1: 'carriola', g2: 'sasso-comodo' } as const;
    let s = dopoIlDado(
      {
        giocatori: 4,
        guaio: TOSATURA,
        eliminati: ['g3', 'g4'],
        agnellini: { g3: 0, g4: 0 },
        angoli: { g2: ['insonnia', 'lupo-vegetariano'] },
        mani: mani(giocate),
      },
      scelte(giocate),
    );
    s = passa(prosegui(s), 'g2');
    const prima = s;
    s = concludi(s, 'g2');
    expect(gioc(s, 'g2').eliminato).toBe(true);
    expect(s.esito).toEqual({ modo: 'ultima_pecora', vincitori: ['g1'] });
    expect(eventi(prima, s, 'fine_partita')).toHaveLength(1);
  });

  it('a 4 giocatori un\'eliminazione lascia tre pecore: il round dopo l\'eliminato non pesca, non partecipa, non è atteso', () => {
    const giocate = { g1: 'carriola', g2: 'sasso-comodo', g3: 'balla-di-fieno', g4: 'coperta-di-lana' } as const;
    let s = dopoIlDado(
      {
        giocatori: 4,
        guaio: TOSATURA,
        angoli: { g2: ['grandine-a-sorpresa', 'fulmine-curioso'] },
        mani: mani(giocate, { g2: ['beee-no', 'pernacchia'], g3: ['balla-di-fieno'], g4: ['balla-di-fieno'] }),
      },
      scelte(giocate),
    );
    s = concludi(passa(prosegui(s), 'g2'), 'g2');
    expect(gioc(s, 'g2').eliminato).toBe(true);
    expect(s.esito).toBeNull();
    fase(s, 'fine_round');
    expect(gioc(s, 'g2').mano).toEqual([]);
    for (const id of ['g1', 'g3', 'g4']) expect(gioc(s, id).mano).toHaveLength(5);

    // Round 2: il primo giocatore passa da g1 a g3 (g2 è saltato).
    s = prosegui(s);
    expect(s.round).toBe(2);
    expect(s.primoGiocatore).toBe('g3');
    s = prosegui(s);
    fase(s, 'scelta');
    expect(s.datiRound.partecipanti).toEqual(['g1', 'g3', 'g4']);
    expect(inAttesaDi(s).giocatori).not.toContain('g2');
    expect(azioniPossibili(s, 'g2')).toEqual([]);
  });

  it('l\'eliminato non pesca a fine round: se gli altri hanno già 5 carte l\'ultima carta resta nel mazzo e l\'ultimo round non scatta', () => {
    const extra: IdTipoCarta[] = ['balla-di-fieno', 'balla-di-fieno', 'balla-di-fieno', 'balla-di-fieno', 'balla-di-fieno'];
    let s = dopoIlDado(
      {
        guaio: TOSATURA,
        mazzo: ['corona-di-margherite'],
        angoli: { g2: ['grandine-a-sorpresa', 'fulmine-curioso'] },
        mani: mani(BASE3, { g1: extra, g3: extra }),
      },
      scelte(BASE3),
    );
    s = concludi(passa(prosegui(s), 'g2'), 'g2');
    expect(gioc(s, 'g2').eliminato).toBe(true);
    fase(s, 'fine_round');
    expect(s.mazzo).toHaveLength(1);
    expect(s.ultimoRound).toBeNull();
    expect(gioc(s, 'g2').mano).toEqual([]);
  });

  it('l\'eliminato con carte e un Guaio scartato in consolazione: tutto negli scarti, l\'Angolo fuori gioco, gli agnellini (consolazione compresa) al Gregge', () => {
    let s = allaConsolazione(
      { g2: ['beee-no', 'visita-di-garzina', 'carriola'] },
      { angoli: { g2: ['lupo-vegetariano', 'volpe-gentile'] }, agnellini: { g1: 3, g2: 7, g3: 3 } },
    );
    expect(gioc(s, 'g2').agnellini).toBe(8);
    const mano = gioc(s, 'g2').mano;
    const angolo = gioc(s, 'g2').angolo;
    const gregge = s.gregge;
    const scartata = carta(s, 'g2', 'carriola');
    s = concludi(s, 'g2', scartata);
    const g2 = gioc(s, 'g2');
    expect(g2.eliminato).toBe(true);
    for (const c of mano) expect(s.scarti).toContain(c);
    expect(g2.mano).toEqual([]);
    expect(g2.agnellini).toBe(0);
    expect(s.gregge).toBe(gregge + 8);
    expect(ordinati(s.guaiFuoriGioco)).toEqual(ordinati(angolo));
    expect(s.giocatori.reduce((t, g) => t + g.agnellini, s.gregge)).toBe(s.config.agnelliniTotali);
  });
});

// ─── Ultimo round e fine partita ─────────────────────────────────────────────

describe('Ultimo round e classifica a mazzo finito (brief 3 "Come si vince" 3, "Casi limite"; specifica 4.1, 4.12, 9, D35)', () => {
  /** Ultimo round (round 4 di 4) a 3 giocatori, mazzo vuoto. */
  function ultimo(o: OpzioniScenario): OpzioniScenario {
    return { round: 4, ultimoRound: 4, mazzo: [], guaio: TOSATURA, ...o };
  }

  it('eliminazione nell\'ultimo round che lascia due pecore: a fine round vince per Mazzo finito il migliore dei non eliminati', () => {
    let s = dopoIlDado(
      ultimo({
        agnellini: { g1: 3, g2: 10, g3: 5 },
        angoli: { g2: ['grandine-a-sorpresa', 'fulmine-curioso'] },
        mani: mani(BASE3),
      }),
      scelte(BASE3),
    );
    s = concludi(passa(prosegui(s), 'g2'), 'g2');
    expect(gioc(s, 'g2').eliminato).toBe(true);
    // g1 6 (Pascolo piccolo), g3 5; g2 ne aveva 11 ma è eliminato.
    expect(s.esito).toEqual({ modo: 'mazzo_finito', vincitori: ['g1'] });
  });

  it('Ovile pieno con la consolazione nell\'ultimo round: vince per Ovile pieno, non per Mazzo finito (D35)', () => {
    // g2 a un posto dall'Ovile pieno (a 3 giocatori).
    const posti = configPer(3).postiOvile;
    let s = dopoIlDado(ultimo({ agnellini: { g1: 3, g2: posti - 1, g3: 3 }, mani: mani(BASE3) }), scelte(BASE3));
    s = passa(prosegui(s), 'g2');
    expect(s.esito).toEqual({ modo: 'ovile_pieno', vincitori: ['g2'] });
  });

  it('il Guaio preso nell\'ultimo round decide lo spareggio per meno Guai', () => {
    // g1 3 + 3 (Pascolo piccolo) = 6; g2 5 + 1 (consolazione) = 6 con un Guaio in più.
    let s = dopoIlDado(ultimo({ agnellini: { g1: 3, g2: 5, g3: 3 }, mani: mani(BASE3) }), scelte(BASE3));
    s = concludi(passa(prosegui(s), 'g2'), 'g2');
    expect([gioc(s, 'g1').agnellini, gioc(s, 'g2').agnellini]).toEqual([6, 6]);
    expect(s.esito).toEqual({ modo: 'mazzo_finito', vincitori: ['g1'] });
  });

  it('tre pecore pari per agnellini e per Guai: vittoria condivisa fra tutte e tre', () => {
    const tutti = { g1: 'balla-di-fieno', g2: 'balla-di-fieno', g3: 'balla-di-fieno' } as const;
    let s = finoAlDado(
      ultimo({
        agnellini: { g1: 4, g2: 4, g3: 4 },
        angoli: { g1: ['insonnia'], g2: ['lupo-vegetariano'], g3: ['nebbia-fitta'] },
        mani: mani(tutti),
      }),
      scelte(tutti),
    );
    expect(fase(s, 'guaio_al_peggiore')).toMatchObject({ destinatario: null, spareggio: null });
    s = avanza(s);
    expect(s.esito?.modo).toBe('mazzo_finito');
    expect(ordinati(s.esito?.vincitori ?? [])).toEqual(['g1', 'g2', 'g3']);
  });

  it('Belato Finale nell\'ultimo round: le carte rivelate vanno negli scarti prima della vittoria', () => {
    const PARI3 = { g1: 'carriola', g2: 'balla-di-fieno', g3: 'balla-di-fieno' } as const;
    let s = dopoIlDado(
      ultimo({ mani: mani(PARI3, { g2: ['trifoglio-qualunque'], g3: ['sasso-comodo'] }) }),
      scelte(PARI3),
    );
    s = prosegui(s);
    const trifoglio = carta(s, 'g2', 'trifoglio-qualunque');
    const sasso = carta(s, 'g3', 'sasso-comodo');
    s = sceltaFinale(sceltaFinale(s, 'g2', 'trifoglio-qualunque'), 'g3', 'sasso-comodo');
    s = concludi(passa(s, 'g3'), 'g3');
    expect(s.esito?.modo).toBe('mazzo_finito');
    expect(s.scarti).toEqual(expect.arrayContaining([trifoglio, sasso]));
    expect(s.datiRound.tavolo).toEqual([]);
  });

  it('ultimo round: due pari al minimo senza Trovate, il Guaio va in fondo e la partita finisce per Mazzo finito', () => {
    const PARI3 = { g1: 'carriola', g2: 'balla-di-fieno', g3: 'balla-di-fieno' } as const;
    const s0 = dopoIlDado(ultimo({ agnellini: { g1: 3, g2: 7, g3: 3 }, mani: mani(PARI3) }), scelte(PARI3));
    const guaio = guaioAttivo(s0);
    const s = prosegui(s0);
    expect(s.mazzoGuai[s.mazzoGuai.length - 1]).toBe(guaio);
    // g2 7 contro g1 6.
    expect(s.esito).toEqual({ modo: 'mazzo_finito', vincitori: ['g2'] });
  });

  it('ultimo round: Faccio finta di niente che si risolve chiude la partita con pila e finestra vuote', () => {
    let s = prosegui(dopoIlDado(ultimo({ mani: mani(BASE3, { g2: ['faccio-finta-di-niente'] }) }), scelte(BASE3)));
    const guaio = guaioAttivo(s);
    s = giocaBelato(s, 'g2', 'faccio-finta-di-niente');
    expect(s.finestra).not.toBeNull();
    s = nessunaReazione(s);
    expect(s.esito).toEqual({ modo: 'mazzo_finito', vincitori: ['g1'] });
    expect(s.fase).toEqual({ nome: 'fine_partita' });
    expect(s.pila).toEqual([]);
    expect(s.finestra).toBeNull();
    expect(s.mazzoGuai[s.mazzoGuai.length - 1]).toBe(guaio);
    expect(gioc(s, 'g2').angolo).toEqual([]);
    verificaRifiuto(s, { tipo: 'prosegui' });
  });

  it('ultimo round con il mazzo Guai vuoto: i Guai fuori gioco si rimescolano al prosegui di ultimo_round, non prima', () => {
    let s = finoAlDado(
      {
        round: 1,
        ultimoRound: 2,
        guaio: TOSATURA,
        mazzoGuai: [],
        guaiFuoriGioco: ['insonnia', 'lupo-vegetariano'],
        mazzo: [],
        mani: mani(BASE3, { g1: ['balla-di-fieno'], g2: ['balla-di-fieno'], g3: ['balla-di-fieno'] }),
      },
      scelte(BASE3),
    );
    s = lanciaTutti(s);
    s = concludi(passa(prosegui(s), 'g2'), 'g2');
    fase(s, 'fine_round');
    expect(s.mazzoGuai).toEqual([]);

    let prima = s;
    s = prosegui(s);
    fase(s, 'ultimo_round');
    expect(s.datiRound.guaio).toBeNull();
    expect(s.guaiFuoriGioco).toHaveLength(2);
    expect(eventi(prima, s, 'guai_rimescolati')).toEqual([]);

    prima = s;
    s = prosegui(s);
    fase(s, 'guaio');
    expect(eventi(prima, s, 'guai_rimescolati')).toEqual([expect.objectContaining({ quanti: 2 })]);
    expect(['insonnia', 'lupo-vegetariano']).toContain(tipoDi(guaioAttivo(s)));
    expect(s.guaiFuoriGioco).toEqual([]);
  });
});

// ─── Invarianti su partite casuali ───────────────────────────────────────────

describe('Invarianti di Guai, eliminazione e fine partita su partite casuali (specifica 4.8–4.12, 8, 9)', () => {
  const PECORE: IdPecora[] = ['ricciolo', 'brontolana', 'sospirella', 'nerina'];
  const PARTITE = 30;

  /** Generatore locale con seme (mulberry32), indipendente da quello del motore. */
  function generatore(seme: number): () => number {
    let a = seme >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function tipiAngolo(s: Stato, id: IdGiocatore): TipoGuaioCarta[] {
    return gioc(s, id).angolo.map((c) => {
      const def = defCarta(c);
      if (def.famiglia !== 'guaio') throw new Error(`${c} non è un Guaio`);
      return def.tipo;
    });
  }

  const haTrovata = (g: StatoGiocatore): boolean => g.mano.some((c) => defCarta(c).famiglia === 'trovata');

  /** Controlli su un passo: `p` prima, `s` dopo l'azione `a`. Restituisce le violazioni. */
  function controllaPasso(p: Stato, a: Azione, s: Stato): string[] {
    const errori: string[] = [];
    const regole = s.config.regoleEliminazione;
    const nuovi = s.eventi.filter((e) => e.seq >= p.prossimoEvento);
    for (const e of nuovi) {
      if (e.tipo === 'guaio_preso' && !p.datiRound.partecipanti.includes(e.giocatore)) {
        errori.push(`Guaio preso da ${e.giocatore}, che non partecipa al round`);
      }
      if (e.tipo === 'guaio_deviato' && !p.datiRound.partecipanti.includes(e.a)) {
        errori.push(`Guaio deviato su ${e.a}, che non partecipa al round`);
      }
      if (e.tipo === 'eliminato') {
        // Sezione 8: solo chi ha appena preso un Guaio, alla fine della consolazione, e solo se l'Angolo elimina.
        const inConsolazione = p.fase.nome === 'consolazione' && p.fase.destinatario === e.giocatore;
        if (!inConsolazione || a.tipo !== 'concludiConsolazione') errori.push(`eliminazione di ${e.giocatore} fuori dalla consolazione`);
        if (!angoloElimina(tipiAngolo(p, e.giocatore), regole)) errori.push(`${e.giocatore} eliminato senza Angolo da eliminazione`);
      }
      if (e.tipo === 'ultimo_round_annunciato') {
        // Sezione 9.3: appena viene pescata l'ultima carta, ultimoRound = round + 1.
        if (s.mazzo.length !== 0) errori.push('ultimo round annunciato con il mazzo non vuoto');
        if (e.round !== p.round + 1) errori.push(`ultimo round ${e.round} annunciato nel round ${p.round}`);
      }
    }
    if (p.datiRound.presoDa !== null && s.round === p.round && s.datiRound.presoDa !== p.datiRound.presoDa) {
      errori.push('due Guai presi nello stesso round');
    }
    if (p.ultimoRound !== null && s.ultimoRound !== p.ultimoRound) errori.push('ultimoRound cambiato dopo l\'annuncio');
    if (p.mazzo.length > 0 && s.mazzo.length === 0 && s.ultimoRound === null) errori.push('mazzo esaurito senza ultimo round');

    if (s.esito === null) {
      for (const g of s.giocatori) {
        if (g.eliminato) continue;
        const inConsolazione = s.fase.nome === 'consolazione' && s.fase.destinatario === g.id;
        if (!inConsolazione && angoloElimina(tipiAngolo(s, g.id), regole)) {
          errori.push(`${g.id} non eliminato con un Angolo da eliminazione (fase ${s.fase.nome})`);
        }
      }
      if (s.fase.nome === 'fine_round' && p.fase.nome !== 'fine_round' && s.mazzo.length > 0) {
        for (const g of s.giocatori) {
          if (!g.eliminato && g.mano.length < s.config.manoIniziale) errori.push(`${g.id} a fine round con ${g.mano.length} carte`);
        }
      }
      if (s.fase.nome === 'belato_finale') {
        const f = s.fase;
        for (const id of f.partecipanti) {
          if (!f.scelte[id] && !haTrovata(gioc(s, id))) errori.push(`${id} al Belato Finale senza Trovate`);
        }
      }
    } else if (s.esito.modo === 'mazzo_finito') {
      // Sezione 9.3: più agnellini, poi meno Guai, poi vittoria condivisa; solo non eliminati.
      const vivi = s.giocatori.filter((g) => !g.eliminato);
      const massimo = Math.max(...vivi.map((g) => g.agnellini));
      const ricchi = vivi.filter((g) => g.agnellini === massimo);
      const minimo = Math.min(...ricchi.map((g) => g.angolo.length));
      const attesi = ricchi.filter((g) => g.angolo.length === minimo).map((g) => g.id);
      if (JSON.stringify(ordinati(attesi)) !== JSON.stringify(ordinati(s.esito.vincitori))) {
        errori.push(`vincitori a mazzo finito ${s.esito.vincitori.join(',')} invece di ${attesi.join(',')}`);
      }
      if (s.round !== s.ultimoRound) errori.push(`partita finita per mazzo nel round ${s.round}, ultimo ${s.ultimoRound}`);
    } else if (s.esito.modo === 'ultima_pecora') {
      const vivi = s.giocatori.filter((g) => !g.eliminato).map((g) => g.id);
      if (JSON.stringify(vivi) !== JSON.stringify(s.esito.vincitori)) errori.push('ultima pecora con più pecore in gioco');
    }
    return errori;
  }

  it.each([2, 3, 4])(`a %i giocatori: ${PARTITE} partite senza violazioni`, (numero) => {
    const violazioni: string[] = [];
    for (let k = 0; k < PARTITE; k++) {
      const seme = 9000 + numero * 1009 + k;
      const giocatori = Array.from({ length: numero }, (_, i) => ({ id: `p${i + 1}`, nome: `P${i + 1}`, pecora: PECORE[i]! }));
      let s = nuovaPartita({ giocatori, seme });
      const rnd = generatore(seme);
      for (let passi = 0; s.esito === null; passi++) {
        if (passi > 6000) {
          violazioni.push(`seme ${seme}: partita troppo lunga`);
          break;
        }
        const azioni: Azione[] = [...azioniPossibili(s, 'sistema')];
        for (const id of inAttesaDi(s).giocatori) azioni.push(...azioniPossibili(s, id));
        if (azioni.length === 0) {
          violazioni.push(`seme ${seme}: nessuna azione in ${s.fase.nome}`);
          break;
        }
        const a = azioni[Math.floor(rnd() * azioni.length)]!;
        const dopo = applica(s, a);
        for (const v of controllaPasso(s, a, dopo)) violazioni.push(`seme ${seme}, passo ${passi}: ${v}`);
        s = dopo;
      }
    }
    expect(violazioni.slice(0, 10)).toEqual([]);
  }, 120_000);
});
