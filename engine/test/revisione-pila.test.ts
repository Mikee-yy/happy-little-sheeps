// Revisione avversariale: pila di reazione, finestre, Beee-NO!, inAttesaDi e azioniPossibili.
// Regole: brief sezione 3 ("Beee-NO!", "Il Dado del Pastore"), sezione 4 (Belati), sezione 6 (pila di reazione);
// specifica docs/motore.md sezioni 2, 4, 5, 6, 7, 11 e decisioni D3–D8, D18, D19, D21, D22, D34, D37, D40.
import { describe, expect, it } from 'vitest';
import { applica, azioniPossibili, defCarta, eFaseAutomatica, inAttesaDi, nuovaPartita, tentaApplica, tipoDi } from '../src';
import type { Azione, Fase, IdCarta, IdGiocatore, IdPecora, Stato, StatoGiocatore, VocePila } from '../src';
import { carta, chiudiPunteggio, conFaccia, nessunaReazione, prosegui, scegli, scenario, totale } from './aiuti';
import type { OpzioniScenario } from './aiuti';

// ─── Aiuti locali ────────────────────────────────────────────────────────────

type Mani = Record<IdGiocatore, string[]>;
type FaseDi<N extends Fase['nome']> = Extract<Fase, { nome: N }>;

/** Guaio senza tratti: i totali del round sono solo i valori stampati. */
const NEUTRO = 'tosatura-a-sorpresa';
const PECORE: IdPecora[] = ['ricciolo', 'brontolana', 'sospirella', 'nerina'];

function fase<N extends Fase['nome']>(s: Stato, nome: N): FaseDi<N> {
  expect(s.fase.nome).toBe(nome);
  return s.fase as FaseDi<N>;
}

function gioc(s: Stato, id: IdGiocatore): StatoGiocatore {
  const g = s.giocatori.find((x) => x.id === id);
  if (!g) throw new Error(`giocatore ${id} inesistente`);
  return g;
}

function cima(s: Stato): VocePila {
  const v = s.pila[s.pila.length - 1];
  if (!v) throw new Error('pila vuota');
  return v;
}

const ordinati = (ids: readonly string[]): string[] => [...ids].sort();
const nonEliminati = (s: Stato): IdGiocatore[] => s.giocatori.filter((g) => !g.eliminato).map((g) => g.id);

/** Beee-NO! di `chi` (prima istanza in mano) contro la cima. */
function beeeNo(s: Stato, chi: IdGiocatore): Stato {
  return applica(s, { tipo: 'giocaBelato', giocatore: chi, carta: carta(s, chi, 'beee-no'), voce: cima(s).id });
}

const scadenza = (s: Stato): Stato => applica(s, { tipo: 'scadenza' });

function belato(s: Stato, chi: IdGiocatore, tipo: string, extra: { bersaglio?: IdGiocatore; guaio?: IdCarta } = {}): Stato {
  return applica(s, { tipo: 'giocaBelato', giocatore: chi, carta: carta(s, chi, tipo), ...extra });
}

/** Scenario → scelta → rivelazione → 'effetti' (o oltre, se nessuna carta ha effetti). */
function round(o: OpzioniScenario, scelte: Mani): Stato {
  return prosegui(scegli(prosegui(scenario({ guaio: NEUTRO, ...o })), scelte));
}

function voceCorrente(s: Stato) {
  const f = fase(s, 'effetti');
  const v = f.coda[f.indice];
  if (!v) throw new Error('nessuna voce corrente');
  return v;
}

function attiva(s: Stato, bersaglio?: IdGiocatore): Stato {
  const v = voceCorrente(s);
  return applica(
    s,
    bersaglio
      ? { tipo: 'attivaEffetto', giocatore: v.giocatore, carta: v.carta, bersaglio }
      : { tipo: 'attivaEffetto', giocatore: v.giocatore, carta: v.carta },
  );
}

/** Controlla la finestra appena aperta sulla cima: tutti i non eliminati tranne l'autore (sez. 5, D5, D6). */
function finestraGiusta(s: Stato): void {
  const v = cima(s);
  expect(s.finestra?.voce).toBe(v.id);
  expect(ordinati(s.finestra?.inAttesa ?? [])).toEqual(ordinati(nonEliminati(s).filter((id) => id !== v.autore)));
  expect(ordinati(inAttesaDi(s).giocatori)).toEqual(ordinati(s.finestra?.inAttesa ?? []));
  expect(inAttesaDi(s).sistema).toBe(false);
  expect(azioniPossibili(s, 'sistema')).toEqual([{ tipo: 'scadenza' }]);
}

// ─── Beee-NO! su ogni effetto di Trovata ─────────────────────────────────────

interface CasoEffetto {
  trovata: string;
  bersaglio?: IdGiocatore;
  /** Vero se, dopo la risoluzione, l'effetto risulta applicato. */
  applicato: (prima: Stato, dopo: Stato) => boolean;
}

// g1 gioca la Trovata con effetto (unica voce in coda), g2 Sasso comodo (2), g3 Carriola (8).
// Tappi per le orecchie da soli in coda non possono cambiare nulla e vengono saltati (D11): il loro
// annullamento con Beee-NO! è verificato con altre voci in coda in pila-beee-no ed effetti-trovate.
const CASI_EFFETTO: CasoEffetto[] = [
  { trovata: 'scorta-nel-vello', applicato: (_p, d) => d.richiesta?.tipo === 'scarta_e_somma' },
  { trovata: 'agnellino-smarrito', applicato: (_p, d) => gioc(d, 'g1').agnellini === 4 },
  { trovata: 'pulizie-di-primavera', applicato: (_p, d) => d.richiesta?.tipo === 'scarta_fino_a_tre' },
  { trovata: 'campanaccio-stonato', bersaglio: 'g3', applicato: (_p, d) => gioc(d, 'g3').agnellini === 2 },
  { trovata: 'cannocchiale', applicato: (p, d) => d.richiesta?.tipo === 'guarda_due' && d.mazzo.length === p.mazzo.length - 2 },
  { trovata: 'capriola', applicato: (_p, d) => totale(d, 'g3') === 2 && totale(d, 'g2') === 8 },
  { trovata: 'megafono-di-latta', applicato: (_p, d) => d.datiRound.raddoppioBelati },
];

function primaDellEffetto(trovata: string): Stato {
  const s = round(
    {
      mani: {
        g1: [trovata, 'balla-di-fieno', 'beee-no'],
        g2: ['sasso-comodo', 'beee-no'],
        g3: ['carriola', 'beee-no'],
      },
    },
    { g1: [trovata], g2: ['sasso-comodo'], g3: ['carriola'] },
  );
  expect(voceCorrente(s).giocatore).toBe('g1');
  return s;
}

/** Fotografia di tutto ciò che un effetto potrebbe toccare. */
function fotografia(s: Stato, senzaCarte: IdCarta[] = []): unknown {
  return {
    giocatori: s.giocatori.map((g) => ({ ...g, mano: g.mano.filter((c) => !senzaCarte.includes(c)) })),
    gregge: s.gregge,
    mazzo: s.mazzo,
    scarti: s.scarti,
    mazzoGuai: s.mazzoGuai,
    punteggi: s.datiRound.punteggi,
    raddoppio: s.datiRound.raddoppioBelati,
    ignora: s.datiRound.ignoraEffetti,
    richiesta: s.richiesta,
  };
}

describe("Beee-NO! su ogni effetto di Trovata (brief sez. 3 \"Beee-NO!\"; spec. 4.4, 5, 6; D4, D8)", () => {
  it.each(CASI_EFFETTO)('$trovata: annullato non cambia nulla; con un secondo Beee-NO! si applica', (caso) => {
    const prima = primaDellEffetto(caso.trovata);
    const cartaEffetto = voceCorrente(prima).carta;
    const s1 = attiva(prima, caso.bersaglio);
    finestraGiusta(s1);
    const noG2 = carta(s1, 'g2', 'beee-no');

    // Annullato: niente cambia tranne la carta Beee-NO! che passa sul tavolo; la coda va avanti.
    const annullato = nessunaReazione(beeeNo(s1, 'g2'));
    expect(fotografia(annullato)).toEqual(fotografia(prima, [noG2]));
    expect(annullato.datiRound.tavolo).toContain(noG2);
    expect(annullato.pila).toEqual([]);
    expect(caso.applicato(prima, annullato)).toBe(false);
    const f = fase(annullato, 'belati_punteggio');
    expect(f.inAttesa).toEqual(['g1', 'g2', 'g3']);
    const voce = annullato.datiRound.giocate.g1;
    expect(voce).toEqual([cartaEffetto]);
    // D8: il valore della carta resta.
    expect(annullato.datiRound.punteggi.g1?.some((r) => r.tipo === 'valore' && r.carta === cartaEffetto)).toBe(true);

    // Controprova: l'autore annulla il Beee-NO! (D5) e l'effetto si applica.
    const applicato = nessunaReazione(beeeNo(beeeNo(s1, 'g2'), 'g1'));
    expect(caso.applicato(prima, applicato)).toBe(true);
  });

  it("l'esito della voce annullata in coda è 'annullato', e un secondo Beee-NO! la riporta ad 'attivato'", () => {
    const s1 = attiva(primaDellEffetto('agnellino-smarrito'));
    const annullato = nessunaReazione(beeeNo(s1, 'g3'));
    const coda = (annullato.eventi.filter((e) => e.tipo === 'effetto') as Array<{ esito: string }>).map((e) => e.esito);
    expect(coda).toEqual(['attivato', 'annullato']);
    const applicato = nessunaReazione(beeeNo(beeeNo(s1, 'g3'), 'g2'));
    const esiti = (applicato.eventi.filter((e) => e.tipo === 'effetto') as Array<{ esito: string }>).map((e) => e.esito);
    expect(esiti).toEqual(['attivato']);
  });
});

// ─── Beee-NO! su ogni Belato ─────────────────────────────────────────────────

// g1 Carriola (8) lancia il dado, g3 Coperta di lana (6), g2 Balla di fieno (5) è il più basso e prende il Guaio.
const SCELTE_BASE: Mani = { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['coperta-di-lana'] };

function alPunteggio(mani: Mani, o: OpzioniScenario = {}): Stato {
  const base: Mani = { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['coperta-di-lana'] };
  const tutte: Mani = {};
  for (const id of ['g1', 'g2', 'g3']) tutte[id] = [...(base[id] ?? []), ...(mani[id] ?? [])];
  const s = round({ ...o, mani: tutte }, SCELTE_BASE);
  fase(s, 'belati_punteggio');
  return s;
}

/** Fino a 'belati_salvataggio' con destinatario g2 (Pascolo piccolo di g1, nessuna reazione). */
function alSalvataggio(mani: Mani, o: OpzioniScenario = {}): Stato {
  let s = chiudiPunteggio(alPunteggio(mani, o));
  s = nessunaReazione(applica(conFaccia(s, 'pascolo_piccolo'), { tipo: 'lanciaDado', giocatore: 'g1' }));
  s = prosegui(s);
  expect(s.fase).toEqual({ nome: 'belati_salvataggio', destinatario: 'g2' });
  return s;
}

function allaConsolazione(mani: Mani, o: OpzioniScenario = {}): Stato {
  const s = applica(alSalvataggio(mani, o), { tipo: 'passa', giocatore: 'g2' });
  expect(s.fase).toEqual({ nome: 'consolazione', destinatario: 'g2' });
  return s;
}

describe('Beee-NO! su ogni Belato (brief sez. 3 e 4; spec. 4.5, 4.10, 4.11, 5, 7; D37)', () => {
  it.each([
    { tipo: 'belato-di-gruppo', bersaglio: 'g2', atteso: { g1: 8, g2: 7, g3: 6 } },
    { tipo: 'pernacchia', bersaglio: 'g1', atteso: { g1: 6, g2: 5, g3: 6 } },
    { tipo: 'mondo-alla-rovescia', bersaglio: undefined, atteso: { g1: 5, g2: 8, g3: 6 } },
  ])('$tipo (punteggio): annullato non cambia i totali; controannullato si applica; poi tutti di nuovo in attesa', ({ tipo, bersaglio, atteso }) => {
    const s0 = alPunteggio({ g1: [tipo], g2: ['beee-no'], g3: ['beee-no'] });
    // g2 e g3 passano: dopo la risoluzione l'attesa deve tornare piena (4.5, D18).
    const passati = applica(applica(s0, { tipo: 'passa', giocatore: 'g2' }), { tipo: 'passa', giocatore: 'g3' });
    const s1 = belato(passati, 'g1', tipo, bersaglio ? { bersaglio } : {});
    finestraGiusta(s1);

    const annullato = nessunaReazione(beeeNo(s1, 'g2'));
    expect({ g1: totale(annullato, 'g1'), g2: totale(annullato, 'g2'), g3: totale(annullato, 'g3') }).toEqual({ g1: 8, g2: 5, g3: 6 });
    expect(fase(annullato, 'belati_punteggio').inAttesa).toEqual(['g1', 'g2', 'g3']);
    expect(annullato.datiRound.tavolo).toEqual(expect.arrayContaining([carta(s1, 'g2', 'beee-no')]));

    const applicato = nessunaReazione(beeeNo(beeeNo(s1, 'g2'), 'g3'));
    expect({ g1: totale(applicato, 'g1'), g2: totale(applicato, 'g2'), g3: totale(applicato, 'g3') }).toEqual(atteso);
    expect(fase(applicato, 'belati_punteggio').inAttesa).toEqual(['g1', 'g2', 'g3']);
  });

  it('faccio-finta-di-niente (salvataggio): annullato si resta con lo stesso destinatario; controannullato il Guaio va in fondo', () => {
    const s0 = alSalvataggio({ g2: ['faccio-finta-di-niente'], g1: ['beee-no'], g3: ['beee-no'] });
    const guaio = s0.datiRound.guaio as IdCarta;
    const s1 = belato(s0, 'g2', 'faccio-finta-di-niente');
    finestraGiusta(s1);

    const annullato = nessunaReazione(beeeNo(s1, 'g3'));
    expect(annullato.fase).toEqual({ nome: 'belati_salvataggio', destinatario: 'g2' });
    expect(annullato.mazzoGuai).toEqual(s0.mazzoGuai);
    expect(inAttesaDi(annullato)).toEqual({ sistema: false, giocatori: ['g2'] });

    const applicato = nessunaReazione(beeeNo(beeeNo(s1, 'g3'), 'g1'));
    expect(applicato.fase.nome).toBe('fine_round');
    expect(applicato.mazzoGuai).toEqual([...s0.mazzoGuai, guaio]);
    expect(gioc(applicato, 'g2').angolo).toEqual([]);
  });

  it('finta-svenuta (salvataggio): annullata il destinatario non cambia; controannullata il Guaio passa al bersaglio', () => {
    const s0 = alSalvataggio({ g2: ['finta-svenuta'], g1: ['beee-no'], g3: ['beee-no'] });
    const s1 = belato(s0, 'g2', 'finta-svenuta', { bersaglio: 'g3' });
    finestraGiusta(s1);
    expect(nessunaReazione(beeeNo(s1, 'g3')).fase).toEqual({ nome: 'belati_salvataggio', destinatario: 'g2' });
    // Il bersaglio annulla, l'autore controannulla, il bersaglio non ha più Beee-NO!: la deviazione vale.
    const applicato = nessunaReazione(beeeNo(beeeNo(s1, 'g3'), 'g1'));
    expect(applicato.fase).toEqual({ nome: 'belati_salvataggio', destinatario: 'g3' });
    expect(inAttesaDi(applicato)).toEqual({ sistema: false, giocatori: ['g3'] });
  });

  it('visita-di-garzina (consolazione): annullata il Guaio resta; controannullata torna in fondo al mazzo Guai', () => {
    const s0 = allaConsolazione({ g2: ['visita-di-garzina'], g1: ['beee-no'], g3: ['beee-no'] });
    const guaio = s0.datiRound.guaio as IdCarta;
    expect(gioc(s0, 'g2').angolo).toEqual([guaio]);
    const s1 = belato(s0, 'g2', 'visita-di-garzina', { guaio });
    finestraGiusta(s1);

    const annullato = nessunaReazione(beeeNo(s1, 'g1'));
    expect(annullato.fase).toEqual({ nome: 'consolazione', destinatario: 'g2' });
    expect(gioc(annullato, 'g2').angolo).toEqual([guaio]);

    const applicato = nessunaReazione(beeeNo(beeeNo(s1, 'g1'), 'g3'));
    expect(applicato.fase).toEqual({ nome: 'consolazione', destinatario: 'g2' });
    expect(gioc(applicato, 'g2').angolo).toEqual([]);
    expect(applicato.mazzoGuai[applicato.mazzoGuai.length - 1]).toBe(guaio);
  });
});

// ─── Beee-NO! su ogni faccia del dado ────────────────────────────────────────

describe('Beee-NO! su ogni faccia del Dado del Pastore (brief "Il Dado del Pastore", "Beee-NO!"; spec. 4.7; D4, D21)', () => {
  const CASI: Array<{ faccia: string; furto?: Record<IdGiocatore, number>; testata?: IdGiocatore; dopo: Record<IdGiocatore, number> }> = [
    { faccia: 'pascolo_piccolo', dopo: { g1: 6, g2: 3, g3: 3 } },
    { faccia: 'pascolo_grande', dopo: { g1: 8, g2: 3, g3: 3 } },
    { faccia: 'furto_piccolo', furto: { g2: 1, g3: 1 }, dopo: { g1: 5, g2: 2, g3: 2 } },
    { faccia: 'furto_grande', furto: { g2: 3, g3: 1 }, dopo: { g1: 7, g2: 0, g3: 2 } },
    { faccia: 'testata', testata: 'g3', dopo: { g1: 3, g2: 3, g3: 3 } },
  ];

  it.each(CASI)('$faccia: annullata nessun agnellino si muove; controannullata si applica', (caso) => {
    let s = chiudiPunteggio(alPunteggio({ g1: ['beee-no'], g2: ['beee-no'], g3: ['beee-no'] }));
    s = applica(conFaccia(s, caso.faccia), { tipo: 'lanciaDado', giocatore: 'g1' });
    if (caso.furto) s = applica(s, { tipo: 'dichiaraDado', giocatore: 'g1', furto: caso.furto });
    if (caso.testata) s = applica(s, { tipo: 'dichiaraDado', giocatore: 'g1', bersaglio: caso.testata });
    expect(fase(s, 'risoluzione_dado').passo).toBe('reazione');
    finestraGiusta(s);
    const gregge = s.gregge;

    const annullato = nessunaReazione(beeeNo(s, 'g3'));
    for (const id of ['g1', 'g2', 'g3']) expect(gioc(annullato, id).agnellini).toBe(3);
    expect(annullato.gregge).toBe(gregge);
    expect(annullato.fase).toEqual({ nome: 'guaio_al_peggiore', destinatario: 'g2', spareggio: null });

    // Il lanciatore annulla il Beee-NO! di g3; g2 lascia passare.
    const applicato = nessunaReazione(beeeNo(beeeNo(s, 'g3'), 'g1'));
    if (caso.testata) {
      expect(fase(applicato, 'risoluzione_dado').passo).toBe('esito_testata');
      expect(inAttesaDi(applicato)).toEqual({ sistema: false, giocatori: ['g1'] });
    } else {
      for (const [id, n] of Object.entries(caso.dopo)) expect(gioc(applicato, id).agnellini).toBe(n);
      expect(applicato.fase.nome).toBe('guaio_al_peggiore');
    }
  });

  it('con due lanciatori ogni lancio ha la sua finestra: il primo lanciatore può annullare il dado del secondo (D19, D5)', () => {
    // g1 e g3 a pari merito (8): g1 ha meno agnellini e lancia per primo.
    let s = round(
      { agnellini: { g1: 2, g2: 3, g3: 4 }, mani: { g1: ['carriola', 'beee-no'], g2: ['balla-di-fieno'], g3: ['carriola', 'beee-no'] } },
      { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['carriola'] },
    );
    s = chiudiPunteggio(s);
    expect(s.datiRound.lanciatori).toEqual(['g1', 'g3']);
    s = nessunaReazione(applica(conFaccia(s, 'pascolo_piccolo'), { tipo: 'lanciaDado', giocatore: 'g1' }));
    expect(fase(s, 'dado').indice).toBe(1);
    s = applica(conFaccia(s, 'pascolo_grande'), { tipo: 'lanciaDado', giocatore: 'g3' });
    finestraGiusta(s);
    expect(s.finestra?.inAttesa).toContain('g1');
    s = nessunaReazione(beeeNo(s, 'g1'));
    expect(gioc(s, 'g3').agnellini).toBe(4);
    expect(gioc(s, 'g1').agnellini).toBe(5);
    expect(s.fase.nome).toBe('guaio_al_peggiore');
  });
});

// ─── Catene lunghe ───────────────────────────────────────────────────────────

/** Quattro giocatori, ciascuno con quattro Beee-NO! (lo scenario crea istanze oltre le copie del catalogo). */
function maniCatena(extra: Mani): Mani {
  const mani: Mani = {};
  for (const id of ['g1', 'g2', 'g3', 'g4']) mani[id] = [...(extra[id] ?? []), 'beee-no', 'beee-no', 'beee-no', 'beee-no'];
  return mani;
}

type Base = 'effetto' | 'belato' | 'dado' | 'cura';

/** Stato con la voce base (di g1) appena dichiarata, finestra aperta. */
function voceBase(base: Base): Stato {
  const scelte: Mani = { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['coperta-di-lana'], g4: ['sasso-comodo'] };
  const opz = (extra: Mani): OpzioniScenario => ({ giocatori: 4, guaio: NEUTRO, mani: maniCatena(extra) });
  if (base === 'effetto') {
    const s = round(opz({ g1: ['agnellino-smarrito'], g2: ['balla-di-fieno'], g3: ['coperta-di-lana'], g4: ['sasso-comodo'] }), {
      ...scelte,
      g1: ['agnellino-smarrito'],
    });
    return attiva(s);
  }
  const alPunt = round(opz({ g1: ['carriola', 'belato-di-gruppo'], g2: ['balla-di-fieno'], g3: ['coperta-di-lana'], g4: ['sasso-comodo'] }), scelte);
  fase(alPunt, 'belati_punteggio');
  if (base === 'belato') return belato(alPunt, 'g1', 'belato-di-gruppo', { bersaglio: 'g1' });
  // g1 (8) lancia; g4 (2) è il più basso.
  const dado = applica(conFaccia(chiudiPunteggio(alPunt), 'pascolo_piccolo'), { tipo: 'lanciaDado', giocatore: 'g1' });
  if (base === 'dado') return dado;
  throw new Error(base);
}

function applicata(base: Base, s: Stato): boolean {
  if (base === 'effetto' || base === 'dado') return gioc(s, 'g1').agnellini > 3;
  return totale(s, 'g1') === 10;
}

describe('Catene lunghe di Beee-NO! (brief "Beee-NO!": "anche un altro Beee-NO!"; spec. 5; D5, D6)', () => {
  const ORDINE = ['g2', 'g3', 'g4', 'g1'];
  for (const base of ['effetto', 'belato', 'dado'] as const) {
    it(`${base}: con k Beee-NO! di fila (k = 0…8) la voce vale se e solo se k è pari; ogni scadenza chiude una sola finestra`, () => {
      for (let k = 0; k <= 8; k++) {
        let s = voceBase(base);
        finestraGiusta(s);
        for (let j = 0; j < k; j++) {
          const chi = ORDINE[j % 4] as IdGiocatore;
          const autorePrima = cima(s).autore;
          expect(chi).not.toBe(autorePrima);
          s = beeeNo(s, chi);
          expect(s.pila).toHaveLength(j + 2);
          finestraGiusta(s);
        }
        // Ogni scadenza risolve solo la cima: un Beee-NO! toglie due voci e riapre la finestra sulla nuova cima (D6).
        let scadenze = 0;
        while (s.finestra) {
          s = scadenza(s);
          scadenze++;
          if (s.finestra) finestraGiusta(s);
        }
        expect(scadenze, `k=${k}`).toBe(k % 2 === 0 ? k / 2 + 1 : (k + 1) / 2);
        expect(s.pila).toEqual([]);
        expect(applicata(base, s), `k=${k}`).toBe(k % 2 === 0);
        // Tutte le carte Beee-NO! giocate sono sul tavolo.
        expect(s.datiRound.tavolo.filter((c) => tipoDi(c) === 'beee-no')).toHaveLength(k);
      }
    });
  }

  it('riapertura: chi aveva passato sulla voce base può giocare Beee-NO! sulla finestra riaperta (D6)', () => {
    let s = voceBase('effetto');
    s = applica(s, { tipo: 'passa', giocatore: 'g3' });
    expect(tentaApplica(s, { tipo: 'giocaBelato', giocatore: 'g3', carta: carta(s, 'g3', 'beee-no'), voce: cima(s).id }).ok).toBe(false);
    s = beeeNo(s, 'g2');
    s = beeeNo(s, 'g1');
    s = scadenza(s);
    expect(s.pila).toHaveLength(1);
    finestraGiusta(s);
    expect(s.finestra?.inAttesa).toContain('g3');
    s = nessunaReazione(beeeNo(s, 'g3'));
    expect(gioc(s, 'g1').agnellini).toBe(3);
  });

  it('il Beee-NO! va sempre contro la cima: una voce sotto la cima è rifiutata anche se la si indica esplicitamente (D7)', () => {
    let s = voceBase('dado');
    const base = cima(s).id;
    s = beeeNo(s, 'g2');
    const voceRifiutata: Azione = { tipo: 'giocaBelato', giocatore: 'g3', carta: carta(s, 'g3', 'beee-no'), voce: base };
    expect(tentaApplica(s, voceRifiutata).ok).toBe(false);
    expect(azioniPossibili(s, 'g3')).toContainEqual({ tipo: 'giocaBelato', giocatore: 'g3', carta: carta(s, 'g3', 'beee-no'), voce: cima(s).id });
  });
});

// ─── Chi risponde alla finestra ──────────────────────────────────────────────

describe('Chi risponde alla finestra (spec. 5; D5, D34)', () => {
  it('a 4 con un eliminato: la finestra esclude eliminato e autore; si chiude quando passano gli altri due', () => {
    let s = round(
      {
        giocatori: 4,
        eliminati: ['g4'],
        agnellini: { g4: 0 },
        mani: { g1: ['agnellino-smarrito'], g2: ['balla-di-fieno', 'beee-no'], g3: ['carriola', 'beee-no'] },
      },
      { g1: ['agnellino-smarrito'], g2: ['balla-di-fieno'], g3: ['carriola'] },
    );
    s = attiva(s);
    finestraGiusta(s);
    expect(ordinati(s.finestra?.inAttesa ?? [])).toEqual(['g2', 'g3']);
    expect(azioniPossibili(s, 'g4')).toEqual([]);
    expect(tentaApplica(s, { tipo: 'passa', giocatore: 'g4' }).ok).toBe(false);
    s = applica(s, { tipo: 'passa', giocatore: 'g3' });
    s = applica(s, { tipo: 'passa', giocatore: 'g2' });
    expect(s.finestra).toBeNull();
    expect(gioc(s, 'g1').agnellini).toBe(4);
  });

  it('a 2 giocatori la catena si alterna: ognuno risponde solo al Beee-NO! dell\'altro', () => {
    // A 2 giocatori: g1 Orecchino gemello (4) si dà +2 nei Belati di punteggio; la catena è a 4 Beee-NO!.
    let s = belato(
      round(
        { giocatori: 2, mani: { g1: ['orecchino-gemello', 'belato-di-gruppo', 'beee-no', 'beee-no'], g2: ['carriola', 'beee-no', 'beee-no'] } },
        { g1: ['orecchino-gemello'], g2: ['carriola'] },
      ),
      'g1',
      'belato-di-gruppo',
      { bersaglio: 'g1' },
    );
    expect(s.finestra?.inAttesa).toEqual(['g2']);
    s = beeeNo(s, 'g2');
    expect(s.finestra?.inAttesa).toEqual(['g1']);
    expect(azioniPossibili(s, 'g2')).toEqual([]);
    s = beeeNo(s, 'g1');
    expect(s.finestra?.inAttesa).toEqual(['g2']);
    s = beeeNo(s, 'g2');
    s = beeeNo(s, 'g1');
    expect(s.pila).toHaveLength(5);
    s = nessunaReazione(s);
    expect(totale(s, 'g1')).toBe(6);
  });

  it('chi è fuori dal round risponde alle finestre e annulla un Belato di salvataggio (D34)', () => {
    // g4 non ha Trovate e il mazzo è vuoto: resta fuori dal round, ma ha un Beee-NO!.
    let s = round(
      {
        giocatori: 4,
        mazzo: [],
        mani: { g1: ['carriola'], g2: ['balla-di-fieno', 'finta-svenuta'], g3: ['coperta-di-lana'], g4: ['beee-no'] },
      },
      { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['coperta-di-lana'] },
    );
    expect(s.datiRound.partecipanti).toEqual(['g1', 'g2', 'g3']);
    s = nessunaReazione(applica(conFaccia(chiudiPunteggio(s), 'pascolo_piccolo'), { tipo: 'lanciaDado', giocatore: 'g1' }));
    s = prosegui(s);
    expect(s.fase).toEqual({ nome: 'belati_salvataggio', destinatario: 'g2' });
    // g4 non è un bersaglio valido della deviazione (non partecipa al round).
    expect(tentaApplica(s, { tipo: 'giocaBelato', giocatore: 'g2', carta: carta(s, 'g2', 'finta-svenuta'), bersaglio: 'g4' }).ok).toBe(false);
    s = belato(s, 'g2', 'finta-svenuta', { bersaglio: 'g3' });
    expect(s.finestra?.inAttesa).toContain('g4');
    s = nessunaReazione(beeeNo(s, 'g4'));
    expect(s.fase).toEqual({ nome: 'belati_salvataggio', destinatario: 'g2' });
  });
});

// ─── Esplorazione sistematica ────────────────────────────────────────────────

/** Chiave di confronto: le carte diventano tipi (azioniPossibili elenca una istanza per tipo), gli insiemi si ordinano. */
function chiave(a: Azione): string {
  const t = (c: unknown): unknown => (typeof c === 'string' && c.includes('#') ? tipoDi(c) : c);
  switch (a.tipo) {
    case 'giocaBelato':
      return JSON.stringify([a.tipo, a.giocatore, t(a.carta), a.bersaglio ?? null, a.voce ?? null, a.guaio ?? null]);
    case 'scegliTrovata':
    case 'completaEffetto':
      return JSON.stringify([a.tipo, a.giocatore, [...a.carte].map((c) => String(t(c))).sort()]);
    case 'sceltaFinale':
      return JSON.stringify([a.tipo, a.giocatore, t(a.carta)]);
    case 'concludiConsolazione':
      return JSON.stringify([a.tipo, a.giocatore, a.scarta == null ? null : t(a.scarta)]);
    case 'attivaEffetto':
      return JSON.stringify([a.tipo, a.giocatore, a.carta, a.bersaglio ?? null]);
    case 'rinunciaEffetto':
      return JSON.stringify([a.tipo, a.giocatore, a.carta]);
    case 'dichiaraDado': {
      const furto = a.furto
        ? Object.entries(a.furto)
            .filter(([, q]) => q !== 0)
            .sort(([x], [y]) => x.localeCompare(y))
        : null;
      return JSON.stringify([a.tipo, a.giocatore, furto, a.bersaglio ?? null]);
    }
    case 'esitoTestata':
      return JSON.stringify([a.tipo, a.giocatore, a.esito]);
    case 'passa':
    case 'lanciaDado':
      return JSON.stringify([a.tipo, a.giocatore]);
    default:
      return JSON.stringify([a.tipo]);
  }
}

const chiDi = (a: Azione): IdGiocatore | 'sistema' => ('giocatore' in a ? a.giocatore : 'sistema');

function sottoinsiemi<T>(xs: T[], massimo: number): T[][] {
  const out: T[][] = [];
  const visita = (i: number, acc: T[]): void => {
    out.push(acc);
    if (acc.length === massimo) return;
    for (let k = i; k < xs.length; k++) visita(k + 1, [...acc, xs[k] as T]);
  };
  visita(0, []);
  return out;
}

/** Ripartizioni del furto tra gli altri giocatori (anche eliminati, per provare i rifiuti), totale ≤ 5. */
function ripartizioni(altri: IdGiocatore[]): Array<Record<IdGiocatore, number>> {
  const out: Array<Record<IdGiocatore, number>> = [];
  const visita = (k: number, acc: Record<IdGiocatore, number>, somma: number): void => {
    if (k === altri.length) {
      out.push({ ...acc });
      return;
    }
    for (let x = 0; x <= 4 && somma + x <= 5; x++) visita(k + 1, { ...acc, [altri[k] as string]: x }, somma + x);
  };
  visita(0, {}, 0);
  return out;
}

/** Azioni "plausibili" in uno stato, valide e non valide, nella forma canonica di ciascun tipo. */
function plausibili(s: Stato): Azione[] {
  const az: Azione[] = [{ tipo: 'prosegui' }, { tipo: 'scadenza' }];
  const ids = s.giocatori.map((g) => g.id);
  const libero = s.pila.length === 0 && !s.richiesta;
  // Fuori dalla fase giusta basta un campione per tipo di azione (deve essere rifiutato); nella fase si prova tutto.
  const tutto = (nome: Fase['nome']): boolean => libero && s.fase.nome === nome;
  const cimaId = s.pila[s.pila.length - 1]?.id;
  const voci = [...new Set([cimaId, cimaId === undefined ? undefined : cimaId - 1, s.prossimaVoce, 1])].filter(
    (v): v is number => v !== undefined,
  );
  const guai = s.giocatori.flatMap((g) => g.angolo);
  if (s.datiRound.guaio) guai.push(s.datiRound.guaio);
  const giocate = Object.values(s.datiRound.giocate).flat();
  const faseDelBelato: Record<string, Fase['nome']> = {
    modifica_punteggio: 'belati_punteggio',
    scambia_punteggi: 'belati_punteggio',
    guaio_in_fondo: 'belati_salvataggio',
    devia_guaio: 'belati_salvataggio',
    cura: 'consolazione',
  };
  const campione = <T>(xs: T[], pieno: boolean): T[] => (pieno ? xs : xs.slice(0, 1));
  for (const g of s.giocatori) {
    const id = g.id;
    az.push({ tipo: 'passa', giocatore: id }, { tipo: 'lanciaDado', giocatore: id });
    for (const c of g.mano) {
      const def = defCarta(c);
      az.push({ tipo: 'giocaBelato', giocatore: id, carta: c });
      if (def.famiglia !== 'belato') continue;
      if (def.effetto === 'beee_no') {
        for (const v of voci) az.push({ tipo: 'giocaBelato', giocatore: id, carta: c, voce: v });
        continue;
      }
      const pieno = tutto(faseDelBelato[def.effetto] as Fase['nome']);
      if (def.effetto === 'modifica_punteggio' || def.effetto === 'devia_guaio') {
        for (const b of campione(ids, pieno)) az.push({ tipo: 'giocaBelato', giocatore: id, carta: c, bersaglio: b });
      }
      if (def.effetto === 'cura') for (const x of campione(guai, pieno)) az.push({ tipo: 'giocaBelato', giocatore: id, carta: c, guaio: x });
    }
    const mano = g.mano;
    for (let i = 0; i < mano.length; i++) {
      const a = mano[i] as IdCarta;
      if (i === 0 || tutto('scelta')) {
        az.push({ tipo: 'scegliTrovata', giocatore: id, carte: [a] });
        for (let j = i + 1; j < mano.length; j++) {
          az.push({ tipo: 'scegliTrovata', giocatore: id, carte: [a, mano[j] as IdCarta] });
          if (!tutto('scelta')) break;
        }
      }
      if (i === 0 || tutto('belato_finale')) az.push({ tipo: 'sceltaFinale', giocatore: id, carta: a });
      if (i === 0 || tutto('consolazione')) az.push({ tipo: 'concludiConsolazione', giocatore: id, scarta: a });
    }
    az.push({ tipo: 'concludiConsolazione', giocatore: id, scarta: null });
    for (const c of campione(giocate, tutto('effetti'))) {
      az.push({ tipo: 'rinunciaEffetto', giocatore: id, carta: c }, { tipo: 'attivaEffetto', giocatore: id, carta: c });
      for (const b of campione(ids, tutto('effetti'))) az.push({ tipo: 'attivaEffetto', giocatore: id, carta: c, bersaglio: b });
    }
    if (s.richiesta && s.pila.length === 0) {
      for (const sub of sottoinsiemi(mano, 4)) az.push({ tipo: 'completaEffetto', giocatore: id, carte: sub });
      if (s.richiesta.tipo === 'guarda_due') {
        for (const c of s.richiesta.carte) az.push({ tipo: 'completaEffetto', giocatore: id, carte: [c] });
        az.push({ tipo: 'completaEffetto', giocatore: id, carte: [...s.richiesta.carte] });
      }
    } else {
      az.push({ tipo: 'completaEffetto', giocatore: id, carte: [] });
      if (mano[0]) az.push({ tipo: 'completaEffetto', giocatore: id, carte: [mano[0]] });
    }
    const dado = tutto('risoluzione_dado');
    for (const b of campione(ids, dado)) az.push({ tipo: 'dichiaraDado', giocatore: id, bersaglio: b });
    for (const furto of campione(ripartizioni(ids.filter((x) => x !== id)), dado)) az.push({ tipo: 'dichiaraDado', giocatore: id, furto });
    for (const e of dado ? [-1, 0, 1, 2, 3, 4] : [0]) az.push({ tipo: 'esitoTestata', giocatore: id, esito: e });
  }
  return az;
}

/**
 * Oracoli scritti direttamente dalla specifica (sez. 4.5, 4.10, 5, 11), indipendenti da azioniPossibili.
 * Restituisce true/false se la regola decide, undefined se l'azione non è di competenza dell'oracolo.
 */
function oracolo(s: Stato, a: Azione): boolean | undefined {
  const vivo = (id: IdGiocatore): boolean => s.giocatori.some((g) => g.id === id && !g.eliminato);
  if (a.tipo === 'scadenza') {
    if (s.richiesta) return false;
    return s.finestra !== null || (s.fase.nome === 'belati_punteggio' && s.pila.length === 0);
  }
  if (a.tipo === 'passa') {
    if (!vivo(a.giocatore) || s.richiesta) return false;
    if (s.finestra) return s.finestra.inAttesa.includes(a.giocatore);
    if (s.fase.nome === 'belati_punteggio') return s.fase.inAttesa.includes(a.giocatore);
    if (s.fase.nome === 'belati_salvataggio') return s.fase.destinatario === a.giocatore;
    return false;
  }
  if (a.tipo === 'giocaBelato') {
    const def = CATALOGO_BELATO(a.carta);
    const inMano = s.giocatori.some((g) => g.id === a.giocatore && g.mano.includes(a.carta));
    if (!def || !inMano || !vivo(a.giocatore) || s.richiesta) return false;
    if (def === 'beee_no') {
      return s.pila.length > 0 && s.finestra !== null && a.voce === cima(s).id && s.finestra.inAttesa.includes(a.giocatore);
    }
    if (s.pila.length > 0) return false;
    return undefined;
  }
  if (a.tipo === 'prosegui') return s.pila.length === 0 && !s.richiesta && eFaseAutomatica(s.fase.nome);
  // Qualunque altra azione è rifiutata con la pila non vuota o con una richiesta (sez. 4) — salvo completaEffetto del suo giocatore.
  if (s.pila.length > 0) return false;
  if (s.richiesta) return a.tipo === 'completaEffetto' && a.giocatore === s.richiesta.giocatore ? undefined : false;
  return undefined;
}

function CATALOGO_BELATO(c: IdCarta): string | null {
  const def = defCarta(c);
  return def.famiglia === 'belato' ? def.effetto : null;
}

/** inAttesaDi riscritto dalla sezione 11 della specifica. */
function attesaSecondoSpec(s: Stato): { sistema: boolean; giocatori: string[] } {
  const f = s.fase;
  const g = (ids: IdGiocatore[]): { sistema: boolean; giocatori: string[] } => ({ sistema: false, giocatori: ordinati(ids) });
  if (s.esito || f.nome === 'fine_partita') return g([]);
  if (s.richiesta) return g([s.richiesta.giocatore]);
  if (s.finestra) return g(s.finestra.inAttesa);
  if (eFaseAutomatica(f.nome)) return { sistema: true, giocatori: [] };
  switch (f.nome) {
    case 'scelta':
      return g(Object.keys(f.scelte).filter((id) => f.scelte[id] === null));
    case 'belato_finale':
      return g(f.partecipanti.filter((id) => !f.scelte[id]));
    case 'effetti': {
      const v = f.coda[f.indice];
      return g(v && v.esito === 'attesa' ? [v.giocatore] : []);
    }
    case 'belati_punteggio':
      return g(f.inAttesa);
    case 'dado': {
      const l = s.datiRound.lanciatori[f.indice];
      return g(l ? [l] : []);
    }
    case 'risoluzione_dado':
      return g(f.passo === 'reazione' ? [] : [f.lanciatore]);
    case 'belati_salvataggio':
    case 'consolazione':
      return g([f.destinatario]);
    default:
      return g([]);
  }
}

/** Problemi di coerenza tra applica, azioniPossibili, inAttesaDi e la specifica in uno stato. */
function problemiDi(completo: Stato): string[] {
  // Gli eventi non influiscono sulle regole: toglierli rende molto più veloce la copia fatta da applica.
  const s: Stato = { ...completo, eventi: [] };
  const problemi: string[] = [];
  const dove = `${s.fase.nome}${s.pila.length ? `/pila${s.pila.length}` : ''}${s.richiesta ? '/richiesta' : ''}`;
  const chi: Array<IdGiocatore | 'sistema'> = ['sistema', ...s.giocatori.map((g) => g.id)];
  const elencate = new Map<IdGiocatore | 'sistema', Set<string>>();
  for (const c of chi) {
    const lista = azioniPossibili(s, c);
    elencate.set(c, new Set(lista.map(chiave)));
    for (const a of lista) {
      const r = tentaApplica(s, a);
      if (!r.ok) problemi.push(`[${dove}] elencata ma rifiutata: ${JSON.stringify(a)} (${r.errore.codice})`);
    }
  }
  if (azioniPossibili(s, 'fantasma').length > 0) problemi.push(`[${dove}] azioni per un giocatore inesistente`);

  for (const a of plausibili(s)) {
    const ok = tentaApplica(s, a).ok;
    if (ok && !elencate.get(chiDi(a))?.has(chiave(a))) problemi.push(`[${dove}] accettata ma non elencata: ${JSON.stringify(a)}`);
    const atteso = oracolo(s, a);
    if (atteso !== undefined && atteso !== ok) problemi.push(`[${dove}] la specifica dice ${atteso ? 'accettata' : 'rifiutata'}: ${JSON.stringify(a)}`);
  }

  // Pila e finestra (sez. 5): la finestra è sempre sulla cima, solo non eliminati diversi dall'autore.
  const top = s.pila[s.pila.length - 1];
  if (top) {
    if (s.finestra?.voce !== top.id) problemi.push(`[${dove}] finestra non sulla cima`);
    for (const id of s.finestra?.inAttesa ?? []) {
      if (id === top.autore || gioc(s, id).eliminato) problemi.push(`[${dove}] ${id} non dovrebbe essere in attesa nella finestra`);
    }
    s.pila.slice(1).forEach((v, i) => {
      const d = v.dettagli;
      if (d.tipo !== 'belato' || d.effetto !== 'beee_no' || d.voceBersaglio !== s.pila[i]?.id) problemi.push(`[${dove}] pila non base+Beee-NO!`);
    });
  } else if (s.finestra) problemi.push(`[${dove}] finestra senza pila`);

  // inAttesaDi coerente con la specifica e con azioniPossibili (sez. 11).
  const attesa = inAttesaDi(s);
  const daSpec = attesaSecondoSpec(s);
  if (attesa.sistema !== daSpec.sistema || JSON.stringify(ordinati(attesa.giocatori)) !== JSON.stringify(daSpec.giocatori)) {
    problemi.push(`[${dove}] inAttesaDi ${JSON.stringify(attesa)} ≠ specifica ${JSON.stringify(daSpec)}`);
  }
  const prosegue = azioniPossibili(s, 'sistema').some((a) => a.tipo === 'prosegui');
  if (attesa.sistema !== prosegue) problemi.push(`[${dove}] inAttesaDi.sistema=${attesa.sistema} ma prosegui elencato=${prosegue}`);
  for (const id of attesa.giocatori) {
    if (azioniPossibili(s, id).length === 0) problemi.push(`[${dove}] ${id} è in attesa ma non ha azioni`);
  }
  for (const g of s.giocatori) {
    const lista = azioniPossibili(s, g.id);
    if (lista.length === 0 || attesa.giocatori.includes(g.id)) continue;
    // Eccezioni esplicite della specifica: cambio di scelta (D40) e Belati di punteggio di chi ha già passato (4.5).
    const ammesse = lista.every(
      (a) =>
        (s.pila.length === 0 && s.fase.nome === 'scelta' && a.tipo === 'scegliTrovata') ||
        (s.pila.length === 0 && s.fase.nome === 'belato_finale' && a.tipo === 'sceltaFinale') ||
        (s.pila.length === 0 && s.fase.nome === 'belati_punteggio' && a.tipo === 'giocaBelato'),
    );
    if (!ammesse) problemi.push(`[${dove}] ${g.id} ha azioni ma non è in attesa: ${JSON.stringify(lista[0])}`);
  }
  if (s.esito === null && !attesa.sistema && attesa.giocatori.length === 0) problemi.push(`[${dove}] nessuno in attesa`);
  return problemi;
}

/** Generatore locale con seme (mulberry32). */
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

/** Passeggiata casuale guidata da azioniPossibili, con preferenza per i Belati (catene di Beee-NO!). */
function passeggiata(s0: Stato, seme: number, passi: number, visita: (s: Stato) => void): void {
  const rnd = generatore(seme);
  let s = s0;
  for (let k = 0; k < passi && s.esito === null; k++) {
    visita(s);
    const tutte: Azione[] = [...azioniPossibili(s, 'sistema')];
    for (const g of s.giocatori) tutte.push(...azioniPossibili(s, g.id));
    if (tutte.length === 0) break;
    const belati = tutte.filter((a) => a.tipo === 'giocaBelato');
    const pool = belati.length > 0 && rnd() < 0.55 ? belati : tutte;
    const r = tentaApplica(s, pool[Math.floor(rnd() * pool.length)] as Azione);
    if (!r.ok) break;
    s = r.stato;
  }
  if (s.esito === null) visita(s);
}

/** Firma "di forma" dello stato, per non controllare cento volte la stessa situazione. */
function forma(s: Stato): string {
  return JSON.stringify([
    s.fase.nome,
    (s.fase as { passo?: string }).passo ?? null,
    s.pila.map((v) => (v.dettagli.tipo === 'belato' ? v.dettagli.effetto : v.dettagli.tipo)),
    s.finestra?.inAttesa.length ?? null,
    s.richiesta?.tipo ?? null,
    s.giocatori.map((g) => [g.mano.map(tipoDi).sort().join(','), g.eliminato, g.angolo.length]),
    (s.fase as { inAttesa?: string[] }).inAttesa ?? null,
  ]);
}

/** Raccoglie al massimo `massimo` stati nuovi (di forma mai vista) da una passeggiata. */
function raccogli(stati: Stato[], massimo: number, visti: Set<string>): (s: Stato) => void {
  let presi = 0;
  return (s) => {
    if (presi >= massimo) return;
    const k = forma(s);
    if (visti.has(k)) return;
    visti.add(k);
    stati.push(s);
    presi++;
  };
}

// Mani ricche di Belati: ogni tipo di Belato e di effetto può finire in pila.
const MANI_RICCHE: Mani = {
  g1: ['agnellino-smarrito', 'carriola', 'beee-no', 'beee-no', 'belato-di-gruppo', 'finta-svenuta', 'visita-di-garzina'],
  g2: ['campanaccio-stonato', 'capriola', 'beee-no', 'pernacchia', 'faccio-finta-di-niente', 'visita-di-garzina'],
  g3: ['cannocchiale', 'scorta-nel-vello', 'balla-di-fieno', 'beee-no', 'mondo-alla-rovescia', 'finta-svenuta'],
  g4: ['tappi-per-le-orecchie', 'pulizie-di-primavera', 'beee-no', 'beee-no', 'megafono-di-latta', 'pernacchia'],
};

function scenarioRicco(n: 2 | 3 | 4, seme: number, eliminaUltimo: boolean): Stato {
  const mani: Mani = {};
  for (let i = 1; i <= n; i++) mani[`g${i}`] = eliminaUltimo && i === n ? [] : [...(MANI_RICCHE[`g${i}`] as string[])];
  return scenario({
    giocatori: n,
    seme,
    mani,
    angoli: { g1: ['grandine-a-sorpresa'], g2: ['lupo-vegetariano', 'insonnia'] },
    ...(eliminaUltimo ? { eliminati: [`g${n}`], agnellini: { [`g${n}`]: 0 } } : {}),
  });
}

function controllaTutti(stati: Stato[]): string[] {
  const problemi = new Set<string>();
  for (const s of stati) for (const p of problemiDi(s)) problemi.add(p);
  return [...problemi].slice(0, 20);
}

describe('azioniPossibili ⇔ applica, inAttesaDi e regole della pila, in modo sistematico (spec. sez. 2, 5, 11)', () => {
  it('partite casuali: ogni azione plausibile è accettata se e solo se è elencata e se la specifica lo ammette', () => {
    const stati: Stato[] = [];
    const visti = new Set<string>();
    for (const n of [2, 3, 4]) {
      for (let k = 0; k < 4; k++) {
        const giocatori = Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, nome: `P${i + 1}`, pecora: PECORE[i] as IdPecora }));
        passeggiata(nuovaPartita({ giocatori, seme: 9000 + n * 100 + k }), 500 + n * 10 + k, 300, raccogli(stati, 18 * n, visti));
      }
    }
    expect(stati.length).toBeGreaterThan(100);
    expect(controllaTutti(stati)).toEqual([]);
  }, 300_000);

  it('scenari con mani piene di Belati (catene, salvataggi, Garzina, eliminati): stessa proprietà', () => {
    const stati: Stato[] = [];
    const visti = new Set<string>();
    for (const n of [2, 3, 4] as const) {
      for (let k = 0; k < 8; k++) {
        passeggiata(scenarioRicco(n, 70 + k, n === 4 && k % 2 === 1), 300 + n * 31 + k, 120, raccogli(stati, 12 * n, visti));
      }
    }
    const fasi = new Set(stati.map((s) => `${s.fase.nome}${s.pila.length ? '+pila' : ''}`));
    for (const atteso of ['effetti+pila', 'belati_punteggio+pila', 'risoluzione_dado+pila', 'belati_salvataggio+pila', 'consolazione+pila']) {
      expect([...fasi]).toContain(atteso);
    }
    expect(stati.some((s) => s.pila.length >= 3)).toBe(true);
    expect(stati.some((s) => s.pila.length > 0 && s.giocatori.some((g) => g.eliminato))).toBe(true);
    expect(controllaTutti(stati)).toEqual([]);
  }, 300_000);
});
