// Finestra dei Belati di punteggio, scambio dei punteggi e raddoppio dei Belati.
// Regole: brief sezione 3 ("Svolgimento di un round" punti 5–7, "Parità", "Scambio dei punteggi", "Casi limite")
// e sezione 4 (Belati); docs/motore.md sezioni 4.4–4.6, 5, 6, 7 e decisioni D3, D12, D13, D14, D15, D18, D19, D23, D34, D36.
import { describe, expect, it } from 'vitest';
import {
  applica,
  azioniPossibili,
  defCarta,
  ErroreRegola,
  inAttesaDi,
  vistaPer,
  type Azione,
  type Evento,
  type IdGiocatore,
  type IdTipoCarta,
  type RigaPunteggio,
  type Stato,
  type StatoGiocatore,
  type TipoRiga,
  type VoceEffetto,
  type VocePila,
} from '../src';
import {
  carta,
  chiudiPunteggio,
  nessunaReazione,
  prosegui,
  rinunciaTutti,
  scegli,
  scenario,
  totale,
  type OpzioniScenario,
} from './aiuti';

// ─── Aiuti locali ────────────────────────────────────────────────────────────

/** Tosatura a Sorpresa come Guaio attivo: nessun tratto, i totali sono i soli valori delle carte. */
const SENZA_TRATTI = 'tosatura-a-sorpresa';

type Scelte = Record<IdGiocatore, IdTipoCarta[]>;
type EventoDi<T extends Evento['tipo']> = Extract<Evento, { tipo: T }>;

/** Da scenario a subito dopo la rivelazione: fase 'effetti', o già oltre se nessuna carta giocata ha effetti. */
function finoAgliEffetti(o: OpzioniScenario, scelte: Scelte): Stato {
  let s = prosegui(scenario({ guaio: SENZA_TRATTI, ...o }));
  expect(s.fase.nome).toBe('scelta');
  s = scegli(s, scelte);
  expect(s.fase.nome).toBe('rivelazione');
  return prosegui(s);
}

/** Da scenario alla finestra dei Belati di punteggio, rinunciando a ogni effetto. */
function finoAlPunteggio(o: OpzioniScenario, scelte: Scelte): Stato {
  let s = finoAgliEffetti(o, scelte);
  if (s.fase.nome === 'effetti') s = rinunciaTutti(s);
  expect(s.fase.nome).toBe('belati_punteggio');
  return s;
}

/** Tre partecipanti con 8, 5 e 2 (Carriola, Balla di fieno, Sasso comodo), più le carte indicate in mano. */
function ottoCinqueDue(
  altre: Partial<Record<'g1' | 'g2' | 'g3', IdTipoCarta[]>> = {},
  o: OpzioniScenario = {},
): Stato {
  return finoAlPunteggio(
    {
      ...o,
      mani: {
        g1: ['carriola', ...(altre.g1 ?? [])],
        g2: ['balla-di-fieno', ...(altre.g2 ?? [])],
        g3: ['sasso-comodo', ...(altre.g3 ?? [])],
      },
    },
    { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['sasso-comodo'] },
  );
}

function voceCorrente(s: Stato): VoceEffetto {
  if (s.fase.nome !== 'effetti') throw new Error(`fase '${s.fase.nome}', attesa 'effetti'`);
  const voce = s.fase.coda[s.fase.indice];
  if (!voce) throw new Error('nessuna voce corrente');
  return voce;
}

/** In 'effetti': il proprietario attiva la voce corrente e nessuno reagisce. */
function attivaCorrente(s: Stato): Stato {
  const voce = voceCorrente(s);
  return nessunaReazione(applica(s, { tipo: 'attivaEffetto', giocatore: voce.giocatore, carta: voce.carta }));
}

/** Gioca un Belato dalla mano senza risolverlo (resta in pila con la finestra aperta). */
function gioca(s: Stato, giocatore: IdGiocatore, tipo: IdTipoCarta, bersaglio?: IdGiocatore): Stato {
  return applica(s, {
    tipo: 'giocaBelato',
    giocatore,
    carta: carta(s, giocatore, tipo),
    ...(bersaglio === undefined ? {} : { bersaglio }),
  });
}

/** Gioca un Belato e lo lascia risolvere senza reazioni. */
function belato(s: Stato, giocatore: IdGiocatore, tipo: IdTipoCarta, bersaglio?: IdGiocatore): Stato {
  return nessunaReazione(gioca(s, giocatore, tipo, bersaglio));
}

function beeeNo(s: Stato, giocatore: IdGiocatore): Stato {
  return applica(s, { tipo: 'giocaBelato', giocatore, carta: carta(s, giocatore, 'beee-no'), voce: cima(s).id });
}

const passa = (s: Stato, giocatore: IdGiocatore): Stato => applica(s, { tipo: 'passa', giocatore });

function rifiuta(s: Stato, azione: Azione): void {
  expect(() => applica(s, azione)).toThrow(ErroreRegola);
}

function cima(s: Stato): VocePila {
  const voce = s.pila[s.pila.length - 1];
  if (!voce) throw new Error('pila vuota');
  return voce;
}

function giocatore(s: Stato, id: IdGiocatore): StatoGiocatore {
  const g = s.giocatori.find((x) => x.id === id);
  if (!g) throw new Error(`giocatore ${id} assente`);
  return g;
}

function righe(s: Stato, g: IdGiocatore, tipo: TipoRiga): RigaPunteggio[] {
  return (s.datiRound.punteggi[g] ?? []).filter((r) => r.tipo === tipo);
}

const delte = (s: Stato, g: IdGiocatore, tipo: TipoRiga): number[] => righe(s, g, tipo).map((r) => r.delta);

/** Chi è in attesa nella finestra dei Belati di punteggio, in ordine alfabetico. */
function inAttesaPunteggio(s: Stato): IdGiocatore[] {
  if (s.fase.nome !== 'belati_punteggio') throw new Error(`fase '${s.fase.nome}', attesa 'belati_punteggio'`);
  return ordinati(s.fase.inAttesa);
}

const ordinati = (a: readonly IdGiocatore[]): IdGiocatore[] => [...a].sort();

function eventiDi<T extends Evento['tipo']>(s: Stato, tipo: T, daSeq: number): EventoDi<T>[] {
  return s.eventi.filter((e): e is EventoDi<T> => e.tipo === tipo && e.seq >= daSeq);
}

function totali(s: Stato, ids: IdGiocatore[]): number[] {
  return ids.map((g) => totale(s, g));
}

// ─── Dati ────────────────────────────────────────────────────────────────────

describe('dati delle carte usate in questo file (brief sezione 4, cards.json)', () => {
  it('Belati di punteggio, di salvataggio e di consolazione hanno il momento atteso', () => {
    expect(defCarta('belato-di-gruppo')).toMatchObject({ famiglia: 'belato', effetto: 'modifica_punteggio', valore: 2, quando: 'punteggio' });
    expect(defCarta('pernacchia')).toMatchObject({ famiglia: 'belato', effetto: 'modifica_punteggio', valore: -2, quando: 'punteggio' });
    expect(defCarta('mondo-alla-rovescia')).toMatchObject({ famiglia: 'belato', effetto: 'scambia_punteggi', quando: 'punteggio' });
    expect(defCarta('faccio-finta-di-niente')).toMatchObject({ famiglia: 'belato', effetto: 'guaio_in_fondo', quando: 'salvataggio' });
    expect(defCarta('finta-svenuta')).toMatchObject({ famiglia: 'belato', effetto: 'devia_guaio', quando: 'salvataggio' });
    expect(defCarta('visita-di-garzina')).toMatchObject({ famiglia: 'belato', effetto: 'cura', quando: 'dopo_guaio' });
  });

  it('Capriola e Megafono di latta sono Trovate del gruppo "punteggio"', () => {
    expect(defCarta('capriola')).toMatchObject({ famiglia: 'trovata', valore: 5, effetto: 'scambia_punteggi', gruppo: 'punteggio' });
    expect(defCarta('megafono-di-latta')).toMatchObject({ famiglia: 'trovata', valore: 6, effetto: 'raddoppia_belati', gruppo: 'punteggio' });
  });
});

// ─── Apertura e chiusura della finestra ──────────────────────────────────────

describe('finestra dei Belati di punteggio: apertura e chiusura (4.5, D18)', () => {
  it('si apre con tutti i non eliminati in attesa, anche chi non partecipa al round (4.5, D34)', () => {
    const s = finoAlPunteggio(
      {
        giocatori: 4,
        mazzo: [],
        eliminati: ['g4'],
        agnellini: { g4: 0 },
        mani: { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['belato-di-gruppo'], g4: [] },
      },
      { g1: ['carriola'], g2: ['balla-di-fieno'] },
    );
    expect(s.datiRound.partecipanti).toEqual(['g1', 'g2']);
    expect(inAttesaPunteggio(s)).toEqual(['g1', 'g2', 'g3']);
    expect(s.pila).toEqual([]);
    expect(s.finestra).toBeNull();
    // Estremi e lanciatori si calcolano solo alla chiusura.
    expect(s.datiRound.piuAlti).toEqual([]);
    expect(s.datiRound.piuBassi).toEqual([]);
    expect(s.datiRound.lanciatori).toEqual([]);

    const attesa = inAttesaDi(s);
    expect(attesa.sistema).toBe(false);
    expect(ordinati(attesa.giocatori)).toEqual(['g1', 'g2', 'g3']);
    const vista = vistaPer(s, 'g3');
    expect(ordinati(vista.attesa.giocatori)).toEqual(['g1', 'g2', 'g3']);
    expect(vista.fase).toEqual(s.fase);
  });

  it('resta aperta finché non hanno passato tutti, anche chi non partecipa; poi si chiude e si va al dado (4.5, D18)', () => {
    let s = finoAlPunteggio(
      { mazzo: [], mani: { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['belato-di-gruppo'] } },
      { g1: ['carriola'], g2: ['balla-di-fieno'] },
    );
    s = passa(s, 'g1');
    expect(inAttesaPunteggio(s)).toEqual(['g2', 'g3']);
    s = passa(s, 'g2');
    expect(s.fase.nome).toBe('belati_punteggio');
    expect(inAttesaPunteggio(s)).toEqual(['g3']);
    expect(inAttesaDi(s)).toEqual({ sistema: false, giocatori: ['g3'] });

    s = passa(s, 'g3');
    expect(s.fase).toEqual({ nome: 'dado', indice: 0 });
    expect(s.datiRound.piuAlti).toEqual(['g1']);
    expect(s.datiRound.piuBassi).toEqual(['g2']);
    expect(s.datiRound.lanciatori).toEqual(['g1']);
  });

  it('la scadenza con la pila vuota chiude subito il punteggio, anche se nessuno ha passato (4.5)', () => {
    const s0 = ottoCinqueDue();
    const s = applica(s0, { tipo: 'scadenza' });
    expect(s.fase).toEqual({ nome: 'dado', indice: 0 });
    expect(s.datiRound.lanciatori).toEqual(['g1']);
    expect(chiudiPunteggio(s0).fase).toEqual({ nome: 'dado', indice: 0 });
  });

  it('per il sistema l\'unica azione è la scadenza: prosegui non è valido (2, 4)', () => {
    const s = ottoCinqueDue();
    expect(azioniPossibili(s, 'sistema')).toEqual([{ tipo: 'scadenza' }]);
    rifiuta(s, { tipo: 'prosegui' });
  });

  it('chi ha già passato può ancora giocare un Belato; dopo la risoluzione l\'attesa torna a tutti (4.5)', () => {
    let s = ottoCinqueDue({ g1: ['belato-di-gruppo'] });
    s = passa(passa(s, 'g1'), 'g2');
    expect(inAttesaPunteggio(s)).toEqual(['g3']);

    s = belato(s, 'g1', 'belato-di-gruppo', 'g1');
    expect(totale(s, 'g1')).toBe(10);
    expect(s.fase.nome).toBe('belati_punteggio');
    expect(inAttesaPunteggio(s)).toEqual(['g1', 'g2', 'g3']);

    // Servono di nuovo i passi di tutti.
    s = passa(passa(s, 'g1'), 'g2');
    expect(s.fase.nome).toBe('belati_punteggio');
    s = passa(s, 'g3');
    expect(s.fase.nome).toBe('dado');
  });

  it('anche un Belato annullato da Beee-NO! riporta l\'attesa a tutti, senza righe (4.5, 5, D8)', () => {
    let s = ottoCinqueDue({ g1: ['pernacchia'], g2: ['beee-no'] });
    const idPernacchia = carta(s, 'g1', 'pernacchia');
    const idBeeeNo = carta(s, 'g2', 'beee-no');
    s = passa(s, 'g3');
    s = gioca(s, 'g1', 'pernacchia', 'g2');
    const vocePernacchia = cima(s);
    s = beeeNo(s, 'g2');
    expect(s.pila).toHaveLength(2);
    expect(ordinati(s.finestra?.inAttesa ?? [])).toEqual(['g1', 'g3']);

    const seq = s.prossimoEvento;
    s = nessunaReazione(s);
    expect(s.pila).toEqual([]);
    expect(s.finestra).toBeNull();
    expect(s.fase.nome).toBe('belati_punteggio');
    expect(inAttesaPunteggio(s)).toEqual(['g1', 'g2', 'g3']);
    expect(righe(s, 'g2', 'belato')).toEqual([]);
    expect(totale(s, 'g2')).toBe(5);
    expect(eventiDi(s, 'annullata', seq)).toEqual([expect.objectContaining({ voce: vocePernacchia.id })]);
    expect(s.datiRound.tavolo).toEqual(expect.arrayContaining([idPernacchia, idBeeeNo]));
  });

  it('con un Belato in pila: finestra a tutti tranne l\'autore, carta subito sul tavolo, altri Belati di punteggio rifiutati (5)', () => {
    let s = ottoCinqueDue({ g1: ['belato-di-gruppo'], g2: ['pernacchia'] });
    const idGruppo = carta(s, 'g1', 'belato-di-gruppo');
    const idPernacchia = carta(s, 'g2', 'pernacchia');
    const seq = s.prossimoEvento;
    s = gioca(s, 'g1', 'belato-di-gruppo', 'g2');

    expect(s.pila).toHaveLength(1);
    const voce = cima(s);
    expect(voce.autore).toBe('g1');
    expect(voce.dettagli).toMatchObject({ tipo: 'belato', carta: idGruppo, effetto: 'modifica_punteggio', bersaglio: 'g2' });
    expect(s.finestra?.voce).toBe(voce.id);
    expect(ordinati(s.finestra?.inAttesa ?? [])).toEqual(['g2', 'g3']);
    expect(ordinati(inAttesaDi(s).giocatori)).toEqual(['g2', 'g3']);
    expect(eventiDi(s, 'dichiarazione', seq)).toEqual([expect.objectContaining({ voce: voce.id, autore: 'g1' })]);
    expect(giocatore(s, 'g1').mano).not.toContain(idGruppo);
    expect(s.datiRound.tavolo).toContain(idGruppo);
    expect(righe(s, 'g2', 'belato')).toEqual([]);

    rifiuta(s, { tipo: 'giocaBelato', giocatore: 'g2', carta: idPernacchia, bersaglio: 'g1' });
    rifiuta(s, { tipo: 'passa', giocatore: 'g1' });
  });

  it('la scadenza con un Belato in pila chiude solo la finestra di reazione; la seguente chiude il punteggio (5, 4.5)', () => {
    let s = ottoCinqueDue({ g1: ['belato-di-gruppo'] });
    s = gioca(s, 'g1', 'belato-di-gruppo', 'g2');
    s = applica(s, { tipo: 'scadenza' });
    expect(s.pila).toEqual([]);
    expect(s.finestra).toBeNull();
    expect(s.fase.nome).toBe('belati_punteggio');
    expect(inAttesaPunteggio(s)).toEqual(['g1', 'g2', 'g3']);
    expect(totale(s, 'g2')).toBe(7);

    s = applica(s, { tipo: 'scadenza' });
    expect(s.fase).toEqual({ nome: 'dado', indice: 0 });
    expect(s.datiRound.piuAlti).toEqual(['g1']);
    expect(s.datiRound.piuBassi).toEqual(['g3']);
  });

  it('saltata con un solo partecipante: lancia lui, nessuno prende il Guaio, nessun Belato di punteggio giocabile (4.4, D18, D23)', () => {
    let s = prosegui(
      scenario({
        guaio: SENZA_TRATTI,
        mazzo: [],
        mani: { g1: ['carriola'], g2: ['belato-di-gruppo'], g3: ['mondo-alla-rovescia'] },
      }),
    );
    expect(s.datiRound.partecipanti).toEqual(['g1']);
    s = prosegui(scegli(s, { g1: ['carriola'] }));

    expect(s.fase).toEqual({ nome: 'dado', indice: 0 });
    expect(s.datiRound.piuAlti).toEqual(['g1']);
    expect(s.datiRound.piuBassi).toEqual([]);
    expect(s.datiRound.lanciatori).toEqual(['g1']);
    rifiuta(s, { tipo: 'giocaBelato', giocatore: 'g2', carta: carta(s, 'g2', 'belato-di-gruppo'), bersaglio: 'g1' });
    rifiuta(s, { tipo: 'giocaBelato', giocatore: 'g3', carta: carta(s, 'g3', 'mondo-alla-rovescia') });
  });

  it('saltata senza partecipanti: niente dado, nessun destinatario del Guaio (D18, D23)', () => {
    let s = prosegui(
      scenario({
        guaio: SENZA_TRATTI,
        mazzo: [],
        mani: { g1: ['belato-di-gruppo'], g2: ['pernacchia'], g3: ['mondo-alla-rovescia'] },
      }),
    );
    expect(s.datiRound.partecipanti).toEqual([]);
    expect(s.fase.nome).toBe('rivelazione');
    s = prosegui(s);

    expect(s.datiRound.piuAlti).toEqual([]);
    expect(s.datiRound.piuBassi).toEqual([]);
    expect(s.datiRound.lanciatori).toEqual([]);
    expect(s.fase).toEqual({ nome: 'guaio_al_peggiore', destinatario: null, spareggio: null });
  });

  it('azioniPossibili: Belati ±2 su ogni partecipante, scambio, passo; niente Belati di altro momento; tutte accettate (2, 4.5)', () => {
    const s = finoAlPunteggio(
      {
        mazzo: [],
        mani: {
          g1: ['carriola', 'pernacchia'],
          g2: ['balla-di-fieno'],
          g3: ['belato-di-gruppo', 'mondo-alla-rovescia', 'faccio-finta-di-niente', 'beee-no'],
        },
      },
      { g1: ['carriola'], g2: ['balla-di-fieno'] },
    );
    const idGruppo = carta(s, 'g3', 'belato-di-gruppo');
    const idMondo = carta(s, 'g3', 'mondo-alla-rovescia');
    const idPernacchia = carta(s, 'g1', 'pernacchia');

    const diG3 = azioniPossibili(s, 'g3');
    expect(diG3).toEqual(
      expect.arrayContaining([
        { tipo: 'giocaBelato', giocatore: 'g3', carta: idGruppo, bersaglio: 'g1' },
        { tipo: 'giocaBelato', giocatore: 'g3', carta: idGruppo, bersaglio: 'g2' },
        { tipo: 'giocaBelato', giocatore: 'g3', carta: idMondo },
        { tipo: 'passa', giocatore: 'g3' },
      ]),
    );
    expect(diG3).toHaveLength(4);

    const diG1 = azioniPossibili(s, 'g1');
    expect(diG1).toEqual(
      expect.arrayContaining([
        { tipo: 'giocaBelato', giocatore: 'g1', carta: idPernacchia, bersaglio: 'g1' },
        { tipo: 'giocaBelato', giocatore: 'g1', carta: idPernacchia, bersaglio: 'g2' },
        { tipo: 'passa', giocatore: 'g1' },
      ]),
    );
    expect(diG1).toHaveLength(3);
    expect(azioniPossibili(s, 'g2')).toEqual([{ tipo: 'passa', giocatore: 'g2' }]);

    for (const g of ['g1', 'g2', 'g3']) {
      for (const a of azioniPossibili(s, g)) expect(() => applica(s, a)).not.toThrow();
    }
  });
});

// ─── Belati +2 e −2 ──────────────────────────────────────────────────────────

describe('Belato di gruppo e Pernacchia (brief 4, tabella 7, D15)', () => {
  it('Belato di gruppo: riga "belato" +2 sul bersaglio con carta e autore, evento di punteggio', () => {
    let s = ottoCinqueDue({ g3: ['belato-di-gruppo'] });
    const idGruppo = carta(s, 'g3', 'belato-di-gruppo');
    const seq = s.prossimoEvento;
    s = gioca(s, 'g3', 'belato-di-gruppo', 'g2');
    const voce = cima(s);
    s = nessunaReazione(s);

    expect(righe(s, 'g2', 'belato')).toEqual([{ tipo: 'belato', delta: 2, carta: idGruppo, autore: 'g3' }]);
    expect(delte(s, 'g2', 'valore')).toEqual([5]);
    expect(totali(s, ['g1', 'g2', 'g3'])).toEqual([8, 7, 2]);
    expect(eventiDi(s, 'risolta', seq)).toEqual([expect.objectContaining({ voce: voce.id })]);
    expect(eventiDi(s, 'punteggio', seq)).toEqual([
      expect.objectContaining({ giocatore: 'g2', riga: expect.objectContaining({ tipo: 'belato', delta: 2 }), totale: 7 }),
    ]);
    expect(s.datiRound.tavolo).toContain(idGruppo);
    expect(s.scarti).not.toContain(idGruppo);
  });

  it('Pernacchia: riga "belato" −2 sul bersaglio', () => {
    let s = ottoCinqueDue({ g2: ['pernacchia'] });
    const idPernacchia = carta(s, 'g2', 'pernacchia');
    s = belato(s, 'g2', 'pernacchia', 'g1');
    expect(righe(s, 'g1', 'belato')).toEqual([{ tipo: 'belato', delta: -2, carta: idPernacchia, autore: 'g2' }]);
    expect(totali(s, ['g1', 'g2', 'g3'])).toEqual([6, 5, 2]);
  });

  it('un partecipante può dare +2 a se stesso', () => {
    let s = ottoCinqueDue({ g3: ['belato-di-gruppo'] });
    s = belato(s, 'g3', 'belato-di-gruppo', 'g3');
    expect(delte(s, 'g3', 'belato')).toEqual([2]);
    expect(totale(s, 'g3')).toBe(4);
  });

  it('anche chi non partecipa al round può giocarli sui partecipanti (4.5, D34)', () => {
    let s = finoAlPunteggio(
      { mazzo: [], mani: { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['pernacchia', 'belato-di-gruppo'] } },
      { g1: ['carriola'], g2: ['balla-di-fieno'] },
    );
    expect(s.datiRound.partecipanti).toEqual(['g1', 'g2']);
    s = belato(s, 'g3', 'pernacchia', 'g1');
    s = belato(s, 'g3', 'belato-di-gruppo', 'g2');
    expect(righe(s, 'g1', 'belato')).toEqual([expect.objectContaining({ delta: -2, autore: 'g3' })]);
    expect(righe(s, 'g2', 'belato')).toEqual([expect.objectContaining({ delta: 2, autore: 'g3' })]);
    expect(totali(s, ['g1', 'g2', 'g3'])).toEqual([6, 7, 0]);
    expect(giocatore(s, 'g3').mano).toEqual([]);
  });

  it('bersaglio non partecipante, eliminato, inesistente o mancante: rifiutato (D15)', () => {
    const s = finoAlPunteggio(
      {
        giocatori: 4,
        mazzo: [],
        eliminati: ['g4'],
        agnellini: { g4: 0 },
        mani: { g1: ['carriola', 'belato-di-gruppo'], g2: ['balla-di-fieno'], g3: ['pernacchia'], g4: [] },
      },
      { g1: ['carriola'], g2: ['balla-di-fieno'] },
    );
    const idGruppo = carta(s, 'g1', 'belato-di-gruppo');
    const idPernacchia = carta(s, 'g3', 'pernacchia');
    for (const bersaglio of ['g3', 'g4', 'g9']) {
      rifiuta(s, { tipo: 'giocaBelato', giocatore: 'g1', carta: idGruppo, bersaglio });
    }
    rifiuta(s, { tipo: 'giocaBelato', giocatore: 'g1', carta: idGruppo });
    rifiuta(s, { tipo: 'giocaBelato', giocatore: 'g3', carta: idPernacchia, bersaglio: 'g3' });
    // Lo stesso Belato su un partecipante è accettato.
    expect(totale(belato(s, 'g1', 'belato-di-gruppo', 'g2'), 'g2')).toBe(7);
  });

  it('carta non in mano o Trovata giocata come Belato: rifiutata', () => {
    const s = ottoCinqueDue({ g1: ['coperta-di-lana'], g2: ['belato-di-gruppo'] });
    const gruppoDiG2 = carta(s, 'g2', 'belato-di-gruppo');
    const coperta = carta(s, 'g1', 'coperta-di-lana');
    rifiuta(s, { tipo: 'giocaBelato', giocatore: 'g1', carta: gruppoDiG2, bersaglio: 'g1' });
    rifiuta(s, { tipo: 'giocaBelato', giocatore: 'g1', carta: coperta, bersaglio: 'g1' });
  });

  it('numero illimitato di Belati, anche più d\'uno dallo stesso giocatore; decidono gli estremi (brief 3 punto 6)', () => {
    let s = ottoCinqueDue({
      g1: ['belato-di-gruppo', 'belato-di-gruppo', 'pernacchia'],
      g2: ['belato-di-gruppo', 'pernacchia'],
      g3: ['pernacchia'],
    });
    s = belato(s, 'g1', 'belato-di-gruppo', 'g3');
    s = belato(s, 'g1', 'belato-di-gruppo', 'g3');
    s = belato(s, 'g2', 'belato-di-gruppo', 'g3');
    s = belato(s, 'g3', 'pernacchia', 'g1');
    s = belato(s, 'g2', 'pernacchia', 'g1');
    s = belato(s, 'g1', 'pernacchia', 'g2');

    expect(s.fase.nome).toBe('belati_punteggio');
    expect(delte(s, 'g3', 'belato')).toEqual([2, 2, 2]);
    expect(delte(s, 'g1', 'belato')).toEqual([-2, -2]);
    expect(delte(s, 'g2', 'belato')).toEqual([-2]);
    expect(totali(s, ['g1', 'g2', 'g3'])).toEqual([4, 3, 8]);
    expect(giocatore(s, 'g1').mano).toEqual([]);
    expect(s.datiRound.tavolo).toHaveLength(3 + 6);

    s = chiudiPunteggio(s);
    expect(s.datiRound.piuAlti).toEqual(['g3']);
    expect(s.datiRound.piuBassi).toEqual(['g2']);
    expect(s.datiRound.lanciatori).toEqual(['g3']);
  });
});

// ─── Raddoppio ───────────────────────────────────────────────────────────────

describe('raddoppio dei Belati con il Megafono di latta (6, 7, D14)', () => {
  it('con il Megafono risolto Belato di gruppo vale +4 e Pernacchia −4; prima della risoluzione no', () => {
    let s = finoAgliEffetti(
      { mani: { g1: ['megafono-di-latta', 'belato-di-gruppo'], g2: ['carriola', 'pernacchia'], g3: ['balla-di-fieno'] } },
      { g1: ['megafono-di-latta'], g2: ['carriola'], g3: ['balla-di-fieno'] },
    );
    const voce = voceCorrente(s);
    expect(voce).toMatchObject({ giocatore: 'g1', effetto: 'raddoppia_belati', gruppo: 'punteggio' });
    s = applica(s, { tipo: 'attivaEffetto', giocatore: 'g1', carta: voce.carta });
    expect(s.datiRound.raddoppioBelati).toBe(false);
    s = nessunaReazione(s);
    expect(s.datiRound.raddoppioBelati).toBe(true);
    expect(s.fase.nome).toBe('belati_punteggio');

    const idGruppo = carta(s, 'g1', 'belato-di-gruppo');
    const seq = s.prossimoEvento;
    s = belato(s, 'g1', 'belato-di-gruppo', 'g3');
    expect(righe(s, 'g3', 'belato')).toEqual([{ tipo: 'belato', delta: 4, carta: idGruppo, autore: 'g1' }]);
    expect(eventiDi(s, 'punteggio', seq)).toEqual([expect.objectContaining({ giocatore: 'g3', totale: 9 })]);
    s = belato(s, 'g2', 'pernacchia', 'g1');
    expect(delte(s, 'g1', 'belato')).toEqual([-4]);
    expect(totali(s, ['g1', 'g2', 'g3'])).toEqual([2, 8, 9]);
  });

  it('due Megafoni non cumulano: il secondo è saltato, +4 e non +8 (D11, D14)', () => {
    let s = finoAgliEffetti(
      { mani: { g1: ['megafono-di-latta'], g2: ['megafono-di-latta'], g3: ['balla-di-fieno', 'belato-di-gruppo'] } },
      { g1: ['megafono-di-latta'], g2: ['megafono-di-latta'], g3: ['balla-di-fieno'] },
    );
    if (s.fase.nome !== 'effetti') throw new Error(`fase '${s.fase.nome}', attesa 'effetti'`);
    expect(s.fase.coda.map((v) => v.effetto)).toEqual(['raddoppia_belati', 'raddoppia_belati']);
    s = attivaCorrente(s);
    // Con il raddoppio già attivo il secondo Megafono non può cambiare nulla: saltato, nessuna finestra.
    expect(s.fase.nome).toBe('belati_punteggio');
    expect(s.pila).toEqual([]);
    expect(s.datiRound.raddoppioBelati).toBe(true);

    s = belato(s, 'g3', 'belato-di-gruppo', 'g1');
    expect(delte(s, 'g1', 'belato')).toEqual([4]);
    expect(totale(s, 'g1')).toBe(10);
  });

  it('Megafono rinunciato: i Belati restano ±2 (D11)', () => {
    let s = finoAgliEffetti(
      { mani: { g1: ['megafono-di-latta', 'belato-di-gruppo'], g2: ['carriola'], g3: ['balla-di-fieno'] } },
      { g1: ['megafono-di-latta'], g2: ['carriola'], g3: ['balla-di-fieno'] },
    );
    s = rinunciaTutti(s);
    expect(s.fase.nome).toBe('belati_punteggio');
    expect(s.datiRound.raddoppioBelati).toBe(false);
    s = belato(s, 'g1', 'belato-di-gruppo', 'g3');
    expect(delte(s, 'g3', 'belato')).toEqual([2]);
  });

  it('Megafono annullato da Beee-NO!: niente raddoppio, ma il suo valore conta (5, D8)', () => {
    let s = finoAgliEffetti(
      { mani: { g1: ['megafono-di-latta', 'belato-di-gruppo'], g2: ['carriola', 'beee-no'], g3: ['balla-di-fieno'] } },
      { g1: ['megafono-di-latta'], g2: ['carriola'], g3: ['balla-di-fieno'] },
    );
    const voce = voceCorrente(s);
    s = applica(s, { tipo: 'attivaEffetto', giocatore: 'g1', carta: voce.carta });
    s = nessunaReazione(beeeNo(s, 'g2'));
    expect(s.fase.nome).toBe('belati_punteggio');
    expect(s.datiRound.raddoppioBelati).toBe(false);
    expect(totale(s, 'g1')).toBe(6);

    s = belato(s, 'g1', 'belato-di-gruppo', 'g3');
    expect(delte(s, 'g3', 'belato')).toEqual([2]);
  });

  it('Megafono ignorato dai Tappi per le orecchie: niente raddoppio, i Belati valgono ±2 (D12)', () => {
    let s = finoAgliEffetti(
      { mani: { g1: ['megafono-di-latta'], g2: ['carriola', 'belato-di-gruppo'], g3: ['tappi-per-le-orecchie'] } },
      { g1: ['megafono-di-latta'], g2: ['carriola'], g3: ['tappi-per-le-orecchie'] },
    );
    expect(voceCorrente(s)).toMatchObject({ giocatore: 'g3', effetto: 'ignora_effetti' });
    s = attivaCorrente(s);
    expect(s.fase.nome).toBe('belati_punteggio');
    expect(s.datiRound.raddoppioBelati).toBe(false);

    s = belato(s, 'g2', 'belato-di-gruppo', 'g2');
    expect(delte(s, 'g2', 'belato')).toEqual([2]);
    expect(totale(s, 'g2')).toBe(10);
  });
});

// ─── Belati di altro momento ─────────────────────────────────────────────────

describe('Belati di altro momento nella finestra di punteggio (tabella 7, D3)', () => {
  it('Faccio finta di niente, Finta svenuta e Visita di Garzina sono rifiutati', () => {
    const s = ottoCinqueDue(
      { g1: ['faccio-finta-di-niente', 'finta-svenuta', 'visita-di-garzina'] },
      { angoli: { g1: ['lupo-vegetariano'] } },
    );
    const guaio = giocatore(s, 'g1').angolo[0];
    if (!guaio) throw new Error('Angolo di g1 vuoto');
    rifiuta(s, { tipo: 'giocaBelato', giocatore: 'g1', carta: carta(s, 'g1', 'faccio-finta-di-niente') });
    rifiuta(s, { tipo: 'giocaBelato', giocatore: 'g1', carta: carta(s, 'g1', 'finta-svenuta'), bersaglio: 'g2' });
    rifiuta(s, { tipo: 'giocaBelato', giocatore: 'g1', carta: carta(s, 'g1', 'visita-di-garzina'), guaio });
  });

  it('Beee-NO! con la pila vuota è rifiutato (D3)', () => {
    const s = ottoCinqueDue({ g2: ['beee-no'] });
    const idBeeeNo = carta(s, 'g2', 'beee-no');
    rifiuta(s, { tipo: 'giocaBelato', giocatore: 'g2', carta: idBeeeNo });
    rifiuta(s, { tipo: 'giocaBelato', giocatore: 'g2', carta: idBeeeNo, voce: s.prossimaVoce });
    rifiuta(s, { tipo: 'giocaBelato', giocatore: 'g2', carta: idBeeeNo, voce: s.prossimaVoce - 1 });
  });
});

// ─── Scambio dei punteggi ────────────────────────────────────────────────────

describe('scambio dei punteggi con Mondo alla rovescia (brief 3 "Scambio dei punteggi", 7, D13)', () => {
  it('caso base: il più alto e il più basso si scambiano, l\'intermedio non cambia; righe "scambio" ed eventi', () => {
    let s = ottoCinqueDue({ g2: ['mondo-alla-rovescia'] });
    const idMondo = carta(s, 'g2', 'mondo-alla-rovescia');
    const seq = s.prossimoEvento;
    s = gioca(s, 'g2', 'mondo-alla-rovescia');
    expect(cima(s).dettagli).toMatchObject({ tipo: 'belato', carta: idMondo, effetto: 'scambia_punteggi' });
    expect(righe(s, 'g1', 'scambio')).toEqual([]);
    s = nessunaReazione(s);

    expect(righe(s, 'g1', 'scambio')).toEqual([{ tipo: 'scambio', delta: -6, carta: idMondo, autore: 'g2' }]);
    expect(righe(s, 'g3', 'scambio')).toEqual([{ tipo: 'scambio', delta: 6, carta: idMondo, autore: 'g2' }]);
    expect(righe(s, 'g2', 'scambio')).toEqual([]);
    expect(delte(s, 'g1', 'valore')).toEqual([8]);
    expect(totali(s, ['g1', 'g2', 'g3'])).toEqual([2, 5, 8]);

    const scambi = eventiDi(s, 'punteggio', seq)
      .filter((e) => e.riga.tipo === 'scambio')
      .map((e) => ({ giocatore: e.giocatore, delta: e.riga.delta, totale: e.totale }))
      .sort((a, b) => a.giocatore.localeCompare(b.giocatore));
    expect(scambi).toEqual([
      { giocatore: 'g1', delta: -6, totale: 2 },
      { giocatore: 'g3', delta: 6, totale: 8 },
    ]);
  });

  it('due pari al massimo ricevono entrambi il minimo', () => {
    let s = finoAlPunteggio(
      { mani: { g1: ['carriola'], g2: ['carriola'], g3: ['sasso-comodo', 'mondo-alla-rovescia'] } },
      { g1: ['carriola'], g2: ['carriola'], g3: ['sasso-comodo'] },
    );
    s = belato(s, 'g3', 'mondo-alla-rovescia');
    expect(delte(s, 'g1', 'scambio')).toEqual([-6]);
    expect(delte(s, 'g2', 'scambio')).toEqual([-6]);
    expect(delte(s, 'g3', 'scambio')).toEqual([6]);
    expect(totali(s, ['g1', 'g2', 'g3'])).toEqual([2, 2, 8]);

    s = chiudiPunteggio(s);
    expect(s.datiRound.piuAlti).toEqual(['g3']);
    expect(ordinati(s.datiRound.piuBassi)).toEqual(['g1', 'g2']);
  });

  it('due pari al minimo ricevono entrambi il massimo', () => {
    let s = finoAlPunteggio(
      { mani: { g1: ['corona-di-margherite', 'mondo-alla-rovescia'], g2: ['balla-di-fieno'], g3: ['balla-di-fieno'] } },
      { g1: ['corona-di-margherite'], g2: ['balla-di-fieno'], g3: ['balla-di-fieno'] },
    );
    s = belato(s, 'g1', 'mondo-alla-rovescia');
    expect(delte(s, 'g1', 'scambio')).toEqual([-4]);
    expect(delte(s, 'g2', 'scambio')).toEqual([4]);
    expect(delte(s, 'g3', 'scambio')).toEqual([4]);
    expect(totali(s, ['g1', 'g2', 'g3'])).toEqual([5, 9, 9]);

    s = chiudiPunteggio(s);
    expect(ordinati(s.datiRound.piuAlti)).toEqual(['g2', 'g3']);
    expect(s.datiRound.piuBassi).toEqual(['g1']);
  });

  it('tutti pari: il Belato si risolve ma non cambia nulla e non scrive righe', () => {
    let s = finoAlPunteggio(
      { mani: { g1: ['carriola', 'mondo-alla-rovescia'], g2: ['carriola'], g3: ['carriola'] } },
      { g1: ['carriola'], g2: ['carriola'], g3: ['carriola'] },
    );
    const idMondo = carta(s, 'g1', 'mondo-alla-rovescia');
    s = belato(s, 'g1', 'mondo-alla-rovescia');
    expect(s.fase.nome).toBe('belati_punteggio');
    expect(s.datiRound.tavolo).toContain(idMondo);
    for (const g of ['g1', 'g2', 'g3']) expect(righe(s, g, 'scambio')).toEqual([]);
    expect(totali(s, ['g1', 'g2', 'g3'])).toEqual([8, 8, 8]);
  });

  it('a 2 giocatori i due punteggi si scambiano', () => {
    let s = finoAlPunteggio(
      { giocatori: 2, mani: { g1: ['carriola', 'mondo-alla-rovescia'], g2: ['balla-di-fieno'] } },
      { g1: ['carriola'], g2: ['balla-di-fieno'] },
    );
    s = belato(s, 'g1', 'mondo-alla-rovescia');
    expect(delte(s, 'g1', 'scambio')).toEqual([-3]);
    expect(delte(s, 'g2', 'scambio')).toEqual([3]);
    expect(totali(s, ['g1', 'g2'])).toEqual([5, 8]);

    s = chiudiPunteggio(s);
    expect(s.datiRound.piuAlti).toEqual(['g2']);
    expect(s.datiRound.piuBassi).toEqual(['g1']);
  });

  it('a 4 giocatori i due intermedi non cambiano e non ricevono righe', () => {
    let s = finoAlPunteggio(
      {
        giocatori: 4,
        mani: {
          g1: ['corona-di-margherite'],
          g2: ['carriola'],
          g3: ['balla-di-fieno'],
          g4: ['sasso-comodo', 'mondo-alla-rovescia'],
        },
      },
      { g1: ['corona-di-margherite'], g2: ['carriola'], g3: ['balla-di-fieno'], g4: ['sasso-comodo'] },
    );
    s = belato(s, 'g4', 'mondo-alla-rovescia');
    expect(delte(s, 'g1', 'scambio')).toEqual([-7]);
    expect(delte(s, 'g4', 'scambio')).toEqual([7]);
    expect(righe(s, 'g2', 'scambio')).toEqual([]);
    expect(righe(s, 'g3', 'scambio')).toEqual([]);
    expect(totali(s, ['g1', 'g2', 'g3', 'g4'])).toEqual([2, 8, 5, 9]);
  });

  it('due scambi di fila si compensano', () => {
    let s = ottoCinqueDue({ g1: ['mondo-alla-rovescia'], g2: ['mondo-alla-rovescia'] });
    s = belato(s, 'g1', 'mondo-alla-rovescia');
    expect(totali(s, ['g1', 'g2', 'g3'])).toEqual([2, 5, 8]);
    s = belato(s, 'g2', 'mondo-alla-rovescia');
    expect(totali(s, ['g1', 'g2', 'g3'])).toEqual([8, 5, 2]);
    expect(delte(s, 'g1', 'scambio')).toEqual([-6, 6]);
    expect(delte(s, 'g3', 'scambio')).toEqual([6, -6]);
    expect(righe(s, 'g2', 'scambio')).toEqual([]);
  });

  it('un ±2 giocato dopo lo scambio agisce sui nuovi totali', () => {
    let s = ottoCinqueDue({ g1: ['mondo-alla-rovescia'], g2: ['pernacchia'], g3: ['belato-di-gruppo'] });
    s = belato(s, 'g1', 'mondo-alla-rovescia');
    s = belato(s, 'g2', 'pernacchia', 'g3');
    s = belato(s, 'g3', 'belato-di-gruppo', 'g1');
    expect(totali(s, ['g1', 'g2', 'g3'])).toEqual([4, 5, 6]);

    s = chiudiPunteggio(s);
    expect(s.datiRound.piuAlti).toEqual(['g3']);
    expect(s.datiRound.piuBassi).toEqual(['g1']);
    expect(s.datiRound.lanciatori).toEqual(['g3']);
  });

  it('lo scambio usa i totali correnti, Belati già giocati compresi (D13)', () => {
    let s = ottoCinqueDue({ g1: ['mondo-alla-rovescia'], g2: ['belato-di-gruppo'], g3: ['pernacchia'] });
    s = belato(s, 'g2', 'belato-di-gruppo', 'g3');
    s = belato(s, 'g3', 'pernacchia', 'g1');
    expect(totali(s, ['g1', 'g2', 'g3'])).toEqual([6, 5, 4]);
    s = belato(s, 'g1', 'mondo-alla-rovescia');
    expect(delte(s, 'g1', 'scambio')).toEqual([-2]);
    expect(delte(s, 'g3', 'scambio')).toEqual([2]);
    expect(totali(s, ['g1', 'g2', 'g3'])).toEqual([4, 5, 6]);
  });

  it('considera solo i partecipanti: chi è fuori dal round (a 0) non conta come minimo; può giocare lo scambio (D34)', () => {
    let s = finoAlPunteggio(
      { mazzo: [], mani: { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['mondo-alla-rovescia'] } },
      { g1: ['carriola'], g2: ['balla-di-fieno'] },
    );
    s = belato(s, 'g3', 'mondo-alla-rovescia');
    expect(delte(s, 'g1', 'scambio')).toEqual([-3]);
    expect(delte(s, 'g2', 'scambio')).toEqual([3]);
    expect(s.datiRound.punteggi['g3'] ?? []).toEqual([]);
    expect(totali(s, ['g1', 'g2', 'g3'])).toEqual([5, 8, 0]);
  });
});

describe('scambio dei punteggi con la Capriola (6, D13)', () => {
  it('si risolve negli effetti, prima della finestra dei Belati, che poi agiscono sui nuovi totali', () => {
    let s = finoAgliEffetti(
      { mani: { g1: ['carriola', 'pernacchia'], g2: ['capriola'], g3: ['sasso-comodo'] } },
      { g1: ['carriola'], g2: ['capriola'], g3: ['sasso-comodo'] },
    );
    const voce = voceCorrente(s);
    expect(voce).toMatchObject({ giocatore: 'g2', effetto: 'scambia_punteggi', gruppo: 'punteggio' });
    s = attivaCorrente(s);

    expect(s.fase.nome).toBe('belati_punteggio');
    expect(righe(s, 'g1', 'scambio')).toEqual([{ tipo: 'scambio', delta: -6, carta: voce.carta, autore: 'g2' }]);
    expect(righe(s, 'g3', 'scambio')).toEqual([{ tipo: 'scambio', delta: 6, carta: voce.carta, autore: 'g2' }]);
    expect(righe(s, 'g2', 'scambio')).toEqual([]);
    expect(totali(s, ['g1', 'g2', 'g3'])).toEqual([2, 5, 8]);

    s = belato(s, 'g1', 'pernacchia', 'g3');
    expect(totali(s, ['g1', 'g2', 'g3'])).toEqual([2, 5, 6]);
  });

  it('usa i totali correnti con i tratti delle pecore', () => {
    // Meteo: Ricciolo (g1) +1, Brontolana (g2) nessun tratto, Sospirella (g3) −1.
    let s = finoAgliEffetti(
      { guaio: 'grandine-a-sorpresa', mani: { g1: ['carriola'], g2: ['capriola'], g3: ['balla-di-fieno'] } },
      { g1: ['carriola'], g2: ['capriola'], g3: ['balla-di-fieno'] },
    );
    expect(delte(s, 'g1', 'tratto')).toEqual([1]);
    expect(delte(s, 'g2', 'tratto')).toEqual([]);
    expect(delte(s, 'g3', 'tratto')).toEqual([-1]);
    s = attivaCorrente(s);
    expect(delte(s, 'g1', 'scambio')).toEqual([-5]);
    expect(delte(s, 'g3', 'scambio')).toEqual([5]);
    expect(totali(s, ['g1', 'g2', 'g3'])).toEqual([4, 5, 9]);
  });

  it('usa i totali correnti con le righe "effetto" del gruppo normale (Scorta nel vello)', () => {
    let s = finoAgliEffetti(
      { mani: { g1: ['scorta-nel-vello', 'carriola'], g2: ['capriola'], g3: ['sasso-comodo'] } },
      { g1: ['scorta-nel-vello'], g2: ['capriola'], g3: ['sasso-comodo'] },
    );
    expect(voceCorrente(s)).toMatchObject({ giocatore: 'g1', effetto: 'scarta_e_somma' });
    s = attivaCorrente(s);
    expect(s.richiesta).toMatchObject({ tipo: 'scarta_e_somma', giocatore: 'g1' });
    s = applica(s, { tipo: 'completaEffetto', giocatore: 'g1', carte: [carta(s, 'g1', 'carriola')] });
    expect(delte(s, 'g1', 'effetto')).toEqual([8]);

    expect(voceCorrente(s)).toMatchObject({ giocatore: 'g2', effetto: 'scambia_punteggi' });
    s = attivaCorrente(s);
    expect(delte(s, 'g1', 'scambio')).toEqual([-6]);
    expect(delte(s, 'g3', 'scambio')).toEqual([6]);
    expect(totali(s, ['g1', 'g2', 'g3'])).toEqual([2, 5, 8]);
  });

  it('Capriola e poi Mondo alla rovescia si compensano', () => {
    let s = finoAgliEffetti(
      { mani: { g1: ['carriola', 'mondo-alla-rovescia'], g2: ['capriola'], g3: ['sasso-comodo'] } },
      { g1: ['carriola'], g2: ['capriola'], g3: ['sasso-comodo'] },
    );
    s = attivaCorrente(s);
    expect(totali(s, ['g1', 'g2', 'g3'])).toEqual([2, 5, 8]);
    s = belato(s, 'g1', 'mondo-alla-rovescia');
    expect(totali(s, ['g1', 'g2', 'g3'])).toEqual([8, 5, 2]);
    expect(delte(s, 'g1', 'scambio')).toEqual([-6, 6]);
    expect(delte(s, 'g3', 'scambio')).toEqual([6, -6]);
  });
});

// ─── Punteggi negativi ───────────────────────────────────────────────────────

describe('punteggi negativi (brief 3 "Casi limite", 7)', () => {
  it('Pernacchia su un valore 0 porta a −2, che decide l\'ultimo', () => {
    // Scorta nel vello senza altre Trovate in mano: effetto saltato, resta il valore 0.
    let s = finoAlPunteggio(
      { mani: { g1: ['scorta-nel-vello'], g2: ['sasso-comodo', 'pernacchia'], g3: ['balla-di-fieno'] } },
      { g1: ['scorta-nel-vello'], g2: ['sasso-comodo'], g3: ['balla-di-fieno'] },
    );
    s = belato(s, 'g2', 'pernacchia', 'g1');
    expect(delte(s, 'g1', 'valore')).toEqual([0]);
    expect(delte(s, 'g1', 'belato')).toEqual([-2]);
    expect(totali(s, ['g1', 'g2', 'g3'])).toEqual([-2, 2, 5]);

    s = chiudiPunteggio(s);
    expect(s.datiRound.piuBassi).toEqual(['g1']);
    expect(s.datiRound.piuAlti).toEqual(['g3']);
  });

  it('con il Megafono 0 scende a −4; lo scambio porta il negativo al più alto e viceversa', () => {
    let s = finoAgliEffetti(
      {
        mani: {
          g1: ['scorta-nel-vello'],
          g2: ['megafono-di-latta', 'pernacchia'],
          g3: ['balla-di-fieno', 'mondo-alla-rovescia'],
        },
      },
      { g1: ['scorta-nel-vello'], g2: ['megafono-di-latta'], g3: ['balla-di-fieno'] },
    );
    expect(voceCorrente(s)).toMatchObject({ giocatore: 'g2', effetto: 'raddoppia_belati' });
    s = attivaCorrente(s);
    expect(s.fase.nome).toBe('belati_punteggio');

    s = belato(s, 'g2', 'pernacchia', 'g1');
    expect(totale(s, 'g1')).toBe(-4);
    s = belato(s, 'g3', 'mondo-alla-rovescia');
    expect(delte(s, 'g1', 'scambio')).toEqual([10]);
    expect(delte(s, 'g2', 'scambio')).toEqual([-10]);
    expect(totali(s, ['g1', 'g2', 'g3'])).toEqual([6, -4, 5]);

    s = chiudiPunteggio(s);
    expect(s.datiRound.piuAlti).toEqual(['g1']);
    expect(s.datiRound.piuBassi).toEqual(['g2']);
  });

  it('un negativo è l\'ultimo anche se chi non partecipa ha 0 (D34)', () => {
    let s = finoAlPunteggio(
      { mazzo: [], mani: { g1: ['scorta-nel-vello'], g2: ['sasso-comodo', 'pernacchia'], g3: ['belato-di-gruppo'] } },
      { g1: ['scorta-nel-vello'], g2: ['sasso-comodo'] },
    );
    s = belato(s, 'g2', 'pernacchia', 'g1');
    expect(totali(s, ['g1', 'g2', 'g3'])).toEqual([-2, 2, 0]);

    s = chiudiPunteggio(s);
    expect(s.datiRound.piuBassi).toEqual(['g1']);
    expect(s.datiRound.piuAlti).toEqual(['g2']);
    expect(s.datiRound.lanciatori).toEqual(['g2']);
  });
});

// ─── Chiusura del punteggio ──────────────────────────────────────────────────

describe('chiusura del punteggio (4.6, brief 3 "Parità", D19, D36)', () => {
  it('massimo e minimo singoli: piuAlti, piuBassi, lanciatori; si passa al dado del primo lanciatore', () => {
    let s = ottoCinqueDue({ g2: ['belato-di-gruppo'] });
    s = chiudiPunteggio(s);
    expect(s.datiRound.piuAlti).toEqual(['g1']);
    expect(s.datiRound.piuBassi).toEqual(['g3']);
    expect(s.datiRound.lanciatori).toEqual(['g1']);
    expect(s.fase).toEqual({ nome: 'dado', indice: 0 });
    expect(inAttesaDi(s)).toEqual({ sistema: false, giocatori: ['g1'] });
    // Chiusa la finestra, i Belati di punteggio non si giocano più.
    rifiuta(s, { tipo: 'giocaBelato', giocatore: 'g2', carta: carta(s, 'g2', 'belato-di-gruppo'), bersaglio: 'g2' });
  });

  it('pari al massimo: lanciano entrambi, prima chi ha meno agnellini', () => {
    let s = finoAlPunteggio(
      { agnellini: { g1: 5, g2: 2, g3: 3 }, mani: { g1: ['carriola'], g2: ['carriola'], g3: ['sasso-comodo'] } },
      { g1: ['carriola'], g2: ['carriola'], g3: ['sasso-comodo'] },
    );
    s = chiudiPunteggio(s);
    expect(ordinati(s.datiRound.piuAlti)).toEqual(['g1', 'g2']);
    expect(s.datiRound.piuBassi).toEqual(['g3']);
    expect(s.datiRound.lanciatori).toEqual(['g2', 'g1']);
    expect(s.fase).toEqual({ nome: 'dado', indice: 0 });
    expect(inAttesaDi(s).giocatori).toEqual(['g2']);
  });

  it('tre pari al massimo a 4 giocatori: lanciatori ordinati per agnellini crescenti', () => {
    let s = finoAlPunteggio(
      {
        giocatori: 4,
        agnellini: { g1: 4, g2: 1, g3: 3, g4: 2 },
        mani: { g1: ['carriola'], g2: ['carriola'], g3: ['carriola'], g4: ['sasso-comodo'] },
      },
      { g1: ['carriola'], g2: ['carriola'], g3: ['carriola'], g4: ['sasso-comodo'] },
    );
    s = chiudiPunteggio(s);
    expect(ordinati(s.datiRound.piuAlti)).toEqual(['g1', 'g2', 'g3']);
    expect(s.datiRound.piuBassi).toEqual(['g4']);
    expect(s.datiRound.lanciatori).toEqual(['g2', 'g3', 'g1']);
  });

  it('pari al minimo: piuBassi li contiene entrambi', () => {
    let s = finoAlPunteggio(
      { mani: { g1: ['corona-di-margherite'], g2: ['balla-di-fieno'], g3: ['balla-di-fieno'] } },
      { g1: ['corona-di-margherite'], g2: ['balla-di-fieno'], g3: ['balla-di-fieno'] },
    );
    s = chiudiPunteggio(s);
    expect(s.datiRound.piuAlti).toEqual(['g1']);
    expect(ordinati(s.datiRound.piuBassi)).toEqual(['g2', 'g3']);
    expect(s.datiRound.lanciatori).toEqual(['g1']);
  });

  it('tutti pari: nessuno lancia, estremi vuoti, Guaio al peggiore senza destinatario né spareggio', () => {
    let s = finoAlPunteggio(
      { mani: { g1: ['carriola'], g2: ['carriola'], g3: ['carriola'] } },
      { g1: ['carriola'], g2: ['carriola'], g3: ['carriola'] },
    );
    s = chiudiPunteggio(s);
    expect(s.datiRound.piuAlti).toEqual([]);
    expect(s.datiRound.piuBassi).toEqual([]);
    expect(s.datiRound.lanciatori).toEqual([]);
    expect(s.fase).toEqual({ nome: 'guaio_al_peggiore', destinatario: null, spareggio: null });
  });

  it('tutti pari raggiunto con un Belato a 2 giocatori: nessuno lancia (D36)', () => {
    let s = finoAlPunteggio(
      { giocatori: 2, mani: { g1: ['carriola', 'belato-di-gruppo'], g2: ['coperta-di-lana'] } },
      { g1: ['carriola'], g2: ['coperta-di-lana'] },
    );
    s = belato(s, 'g1', 'belato-di-gruppo', 'g2');
    expect(totali(s, ['g1', 'g2'])).toEqual([8, 8]);

    s = chiudiPunteggio(s);
    expect(s.datiRound.piuAlti).toEqual([]);
    expect(s.datiRound.piuBassi).toEqual([]);
    expect(s.datiRound.lanciatori).toEqual([]);
    expect(s.fase).toEqual({ nome: 'guaio_al_peggiore', destinatario: null, spareggio: null });
  });
});
