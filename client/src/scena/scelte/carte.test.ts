// Prove delle domande con la mano (carta del round, effetti, richieste, risposte, punteggio, Belato finale,
// salvataggio, consolazione). Partite vere del motore (engine/test/aiuti.ts); ogni mossa prodotta è uno degli
// oggetti permessi (stesso oggetto, `toBe`), anche per scegliTrovata, completaEffetto e concludiConsolazione.
import { describe, expect, it } from 'vitest';
import { applica, configPer, vistaPer } from '../../../../engine/src';
import type { Azione, IdCarta, IdGiocatore, Stato } from '../../../../engine/src';
import { carta, chiudiPunteggio, conFaccia, nessunaReazione, prosegui, scegli, scenario } from '../../../../engine/test/aiuti';
import type { OpzioniScenario } from '../../../../engine/test/aiuti';
import { avvisiDi, nomeCarta } from '../../partita/descrizioni';
import { T } from '../../testi';
import { momentoDi } from './aiuti-momento';
import { avanza, chiaveDi, domandaDi, sceltaVuota } from './domanda';
import type { Domanda, Esito, Gesto, Momento, Scelta } from './tipi';

const NEUTRO = 'tosatura-a-sorpresa';
const TOSATURA = 'tosatura-a-sorpresa';

type Scelte = Record<IdGiocatore, string[]>;
type Di<K extends Azione['tipo']> = Extract<Azione, { tipo: K }>;

// ─── Aiuti ───────────────────────────────────────────────────────────────────

function domandaVera(m: Momento, s: Scelta = sceltaVuota(chiaveDi(m))): Domanda {
  const d = domandaDi(m, s);
  expect(d).not.toBeNull();
  return d as Domanda;
}

const tocca = (m: Momento, s: Scelta, g: Gesto) => avanza(m, s, g);
const carta_ = (c: IdCarta): Gesto => ({ tipo: 'carta', carta: c });
const trascina = (c: IdCarta): Gesto => ({ tipo: 'trascinata', carta: c });
const pecora = (chi: IdGiocatore): Gesto => ({ tipo: 'pecora', chi });
const bottone = (id: Extract<Gesto, { tipo: 'pulsante' }>['id']): Gesto => ({ tipo: 'pulsante', id });
const pulsante = (d: Domanda, id: string) => d.pulsanti.find((p) => p.id === id);
const ids = (d: Domanda) => d.pulsanti.map((p) => p.id);
const ordinate = <T extends string>(x: readonly T[]): T[] => [...x].sort();

/** Applica più gesti di fila, tenendo la scelta a metà; dà l'ultimo risultato. */
function percorso(m: Momento, gesti: Gesto[], inizio: Scelta = sceltaVuota(chiaveDi(m))): { scelta: Scelta; esito: Esito | null } {
  let r = { scelta: inizio, esito: null as Esito | null };
  for (const g of gesti) r = avanza(m, r.scelta, g);
  return r;
}

const mossaDi = (r: { esito: Esito | null }): Azione | undefined => (r.esito?.tipo === 'mossa' ? r.esito.azione : undefined);

const trova = <K extends Azione['tipo']>(azioni: Azione[], tipo: K, qual?: (a: Di<K>) => boolean): Di<K> =>
  azioni.find((a): a is Di<K> => a.tipo === tipo && (!qual || qual(a as Di<K>)))!;

/** Nessun gesto su un elemento non offerto cambia qualcosa: stessa scelta, nessun esito. */
function nessunEffetto(m: Momento, s: Scelta, gesti: Gesto[]) {
  for (const g of gesti) {
    const r = tocca(m, s, g);
    expect(r.esito, JSON.stringify(g)).toBeNull();
    expect(r.scelta, JSON.stringify(g)).toBe(s);
  }
}

/** Con la mano coperta: niente carte toccabili, sollevate o trascinabili. */
function manoCoperta(d: Domanda) {
  expect(d.carte).toEqual([]);
  expect(d.sollevate).toEqual([]);
  expect(d.trascinabili).toEqual([]);
}

// Scenari ---------------------------------------------------------------------

/** Scelta segreta: g1 ha due Ciliegie e un Calzino (Gemelle), Carriola e Balla di fieno. */
function allaScelta(o: OpzioniScenario = {}): Stato {
  const s = prosegui(
    scenario({
      guaio: NEUTRO,
      mani: {
        g1: ['ciliegie-appaiate', 'ciliegie-appaiate', 'calzino-gemello', 'carriola', 'balla-di-fieno'],
        g2: ['sasso-comodo'],
        g3: ['coperta-di-lana'],
      },
      ...o,
    }),
  );
  expect(s.fase.nome).toBe('scelta');
  return s;
}

/** scenario → scelta → rivelazione → ingresso in 'effetti'. */
function finoAgliEffetti(o: OpzioniScenario, scelte: Scelte): Stato {
  let s = prosegui(scenario(o));
  s = scegli(s, scelte);
  expect(s.fase.nome).toBe('rivelazione');
  return prosegui(s);
}

function attivaERisolvi(s: Stato, bersaglio?: IdGiocatore): Stato {
  const f = s.fase;
  if (f.nome !== 'effetti') throw new Error('fase attesa effetti');
  const v = f.coda[f.indice]!;
  const a: Azione =
    bersaglio === undefined
      ? { tipo: 'attivaEffetto', giocatore: v.giocatore, carta: v.carta }
      : { tipo: 'attivaEffetto', giocatore: v.giocatore, carta: v.carta, bersaglio };
  return nessunaReazione(applica(s, a));
}

/** Fino al dado del round: g1 (Carriola) lancia. `extra` aggiunge carte alla mano dei giocatori. */
function alDado(extra: Scelte = {}, o: OpzioniScenario = {}): Stato {
  const mani: Scelte = {
    g1: ['carriola', ...(extra['g1'] ?? [])],
    g2: ['balla-di-fieno', ...(extra['g2'] ?? [])],
    g3: ['coperta-di-lana', ...(extra['g3'] ?? [])],
  };
  let s = prosegui(scenario({ guaio: TOSATURA, ...o, mani }));
  s = scegli(s, { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['coperta-di-lana'] });
  s = prosegui(s);
  if (s.fase.nome === 'effetti') throw new Error('effetti inattesi');
  if (s.fase.nome === 'belati_punteggio') s = chiudiPunteggio(s);
  expect(s.fase.nome).toBe('dado');
  return s;
}

const lancia = (s: Stato, faccia: string): Stato => applica(conFaccia(s, faccia), { tipo: 'lanciaDado', giocatore: 'g1' });

/** Finestra di reazione sul pascolo di g1: g2 ha un Beee-NO!, g3 no. */
function allaReazione(): Stato {
  const s = lancia(alDado({ g2: ['beee-no'] }), 'pascolo_piccolo');
  expect(s.finestra?.inAttesa.sort()).toEqual(['g2', 'g3']);
  return s;
}

/** Belati di punteggio: g1 ha Belato di gruppo (+2, su una pecora) e Mondo alla rovescia (scambio, senza bersaglio). */
function alPunteggio(): Stato {
  let s = prosegui(
    scenario({
      guaio: NEUTRO,
      mani: {
        g1: ['carriola', 'belato-di-gruppo', 'mondo-alla-rovescia'],
        g2: ['balla-di-fieno'],
        g3: ['coperta-di-lana'],
      },
    }),
  );
  s = scegli(s, { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['coperta-di-lana'] });
  s = prosegui(s);
  expect(s.fase.nome).toBe('belati_punteggio');
  return s;
}

/** Dal dado a "dopo il dado": ogni lanciatore tira un pascolo piccolo, nessuno reagisce. */
function dopoIlDado(s: Stato): Stato {
  for (let giri = 0; giri < 10; giri++) {
    const f = s.fase;
    if (f.nome !== 'dado') return s;
    const chi = s.datiRound.lanciatori[f.indice]!;
    s = nessunaReazione(applica(conFaccia(s, 'pascolo_piccolo'), { tipo: 'lanciaDado', giocatore: chi }));
  }
  throw new Error('troppi lanci');
}

/** g2 (Balla, 5) è il più basso: dopo il dado e il Guaio al peggiore tocca ai suoi Belati di salvataggio. */
function alSalvataggio(extra: Scelte = {}, o: OpzioniScenario = {}): Stato {
  const s = prosegui(dopoIlDado(alDado(extra, o)));
  expect(s.fase).toEqual({ nome: 'belati_salvataggio', destinatario: 'g2' });
  return s;
}

function allaConsolazione(extra: Scelte = {}, o: OpzioniScenario = {}): Stato {
  const s = applica(alSalvataggio(extra, o), { tipo: 'passa', giocatore: 'g2', voce: null });
  expect(s.fase).toEqual({ nome: 'consolazione', destinatario: 'g2' });
  return s;
}

/** Spareggio in fondo (g2 e g3 pari a 5) e poi il Belato finale. */
function alBelatoFinale(): Stato {
  let s = prosegui(
    scenario({
      guaio: TOSATURA,
      mani: {
        g1: ['carriola'],
        g2: ['balla-di-fieno', 'coperta-di-lana', 'sasso-comodo'],
        g3: ['balla-di-fieno', 'carriola', 'corona-di-margherite'],
      },
    }),
  );
  s = scegli(s, { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['balla-di-fieno'] });
  s = prosegui(s);
  if (s.fase.nome === 'belati_punteggio') s = chiudiPunteggio(s);
  s = prosegui(dopoIlDado(s));
  expect(s.fase.nome).toBe('belato_finale');
  return s;
}

// ─── Scelta della carta del round ────────────────────────────────────────────

describe('scelta', () => {
  const s0 = allaScelta();
  const m = momentoDi(s0);
  const cil1 = carta(s0, 'g1', 'ciliegie-appaiate');
  const cil2 = s0.giocatori[0]!.mano.filter((c) => c.startsWith('ciliegie-appaiate'))[1]!;
  const calz = carta(s0, 'g1', 'calzino-gemello');
  const carriola = carta(s0, 'g1', 'carriola');
  const balla = carta(s0, 'g1', 'balla-di-fieno');
  const coppiaCil = trova(m.azioni, 'scegliTrovata', (a) => a.carte.includes(cil1) && a.carte.includes(cil2));
  const coppiaCilCalz = trova(m.azioni, 'scegliTrovata', (a) => a.carte.includes(cil1) && a.carte.includes(calz));
  const sola = (c: IdCarta) => trova(m.azioni, 'scegliTrovata', (a) => a.carte.length === 1 && a.carte[0] === c);

  it('domanda: scritta e consiglio sulle Gemelle, carte delle opzioni, "Gioca" spento sotto la carta', () => {
    expect(m.schermo).toEqual({ tipo: 'privata', giocatore: 'g1', pannello: 'scelta' });
    const d = domandaVera(m);
    expect(d.chiave).toBe(chiaveDi(m));
    expect(d.scritta).toContain(T.scelta.titolo('Giocatore 1'));
    expect(d.scritta).toContain(T.scelta.gemelleInsieme);
    expect(d.avvisi).toEqual(avvisiDi(m.vista, 'g1'));
    expect(ordinate(d.carte)).toEqual(ordinate([cil1, cil2, calz, carriola, balla]));
    expect(d.sollevate).toEqual([]);
    expect(ordinate(d.trascinabili)).toEqual(ordinate([cil1, calz, carriola, balla]));
    expect(d.pecore).toEqual([]);
    expect(d.dado).toBe(false);
    expect(d.guai).toEqual([]);
    expect(d.grandi).toEqual([]);
    expect(d.centro).toBeNull();
    expect(d.furto).toBeNull();
    expect(d.fionda).toBeNull();
    expect(d.pulsanti).toEqual([{ id: 'gioca', testo: T.scena.scelte.gioca(0), attivo: false, sottoLaCarta: true }]);
  });

  it('senza Gemelle in mano la scritta non parla di Gemelle', () => {
    const s = allaScelta({ mani: { g1: ['carriola', 'balla-di-fieno'], g2: ['sasso-comodo'], g3: ['coperta-di-lana'] } });
    const d = domandaVera(momentoDi(s));
    expect(d.scritta).toBe(T.scelta.titolo('Giocatore 1'));
  });

  it('tocco su una carta: si solleva e "Gioca" mostra il suo valore; la mossa è quella permessa', () => {
    const r1 = tocca(m, sceltaVuota(chiaveDi(m)), carta_(carriola));
    expect(r1.esito).toBeNull();
    expect(r1.scelta.carte).toEqual([carriola]);
    const d = domandaVera(m, r1.scelta);
    expect(d.sollevate).toEqual([carriola]);
    expect(pulsante(d, 'gioca')).toEqual({ id: 'gioca', testo: T.scena.scelte.gioca(8), attivo: true, sottoLaCarta: true });
    const r2 = tocca(m, r1.scelta, bottone('gioca'));
    expect(mossaDi(r2)).toBe(sola(carriola));
  });

  it('tocco su un\'altra carta: sostituisce; di nuovo sulla stessa: la abbassa', () => {
    let r = percorso(m, [carta_(carriola), carta_(balla)]);
    expect(r.scelta.carte).toEqual([balla]);
    r = percorso(m, [carta_(balla)], r.scelta);
    expect(r.scelta.carte).toEqual([]);
  });

  it('tocco sul prato (ruling E): abbassa le carte sollevate, senza esito; con niente da abbassare è la stessa scelta', () => {
    const r = percorso(m, [carta_(cil1), carta_(cil2)]);
    expect(r.scelta.carte).toHaveLength(2);
    const p = tocca(m, r.scelta, { tipo: 'prato' });
    expect(p.esito).toBeNull();
    expect(p.scelta).toEqual({ ...r.scelta, carte: [], carta: null });
    expect(domandaVera(m, p.scelta).sollevate).toEqual([]);
    const vuota = sceltaVuota(chiaveDi(m));
    expect(tocca(m, vuota, { tipo: 'prato' }).scelta).toBe(vuota);
  });

  it('Gemelle: tocco su una, sulla gemella (si sollevano insieme, totale), di nuovo su una', () => {
    let r = percorso(m, [carta_(cil1)]);
    expect(r.scelta.carte).toEqual([cil1]);
    r = percorso(m, [carta_(cil2)], r.scelta);
    expect(ordinate(r.scelta.carte)).toEqual(ordinate([cil1, cil2]));
    const d = domandaVera(m, r.scelta);
    expect(ordinate(d.sollevate)).toEqual(ordinate([cil1, cil2]));
    expect(pulsante(d, 'gioca')).toMatchObject({ testo: T.scena.scelte.gioca(2), attivo: true });
    expect(mossaDi(tocca(m, r.scelta, bottone('gioca')))).toBe(coppiaCil);
    // di nuovo su una: la abbassa, resta la gemella (da sola non è una mossa)
    const r3 = tocca(m, r.scelta, carta_(cil1));
    expect(r3.scelta.carte).toEqual([cil2]);
    expect(pulsante(domandaVera(m, r3.scelta), 'gioca')?.attivo).toBe(false);
  });

  it('Gemelle di tipo diverso: Ciliegie e Calzino insieme (1 + 3)', () => {
    const r = percorso(m, [carta_(cil1), carta_(calz)]);
    expect(ordinate(r.scelta.carte)).toEqual(ordinate([cil1, calz]));
    expect(pulsante(domandaVera(m, r.scelta), 'gioca')?.testo).toBe(T.scena.scelte.gioca(4));
    expect(mossaDi(tocca(m, r.scelta, bottone('gioca')))).toBe(coppiaCilCalz);
  });

  it('una coppia che non è permessa non si forma: la seconda carta sostituisce la prima', () => {
    // Calzino e Ciliegie#2 non sono un'opzione (il motore offre una coppia per tipo)
    const r = percorso(m, [carta_(calz), carta_(cil2)]);
    expect(r.scelta.carte).toEqual([cil2]);
    const r2 = percorso(m, [carta_(cil1), carta_(carriola)]);
    expect(r2.scelta.carte).toEqual([carriola]);
  });

  it('con due carte sollevate un terzo tocco riparte da quella sola', () => {
    const r = percorso(m, [carta_(cil1), carta_(cil2), carta_(calz)]);
    expect(r.scelta.carte).toEqual([calz]);
  });

  it('trascinata di una sola carta: la mossa di quella carta', () => {
    expect(mossaDi(tocca(m, sceltaVuota(chiaveDi(m)), trascina(balla)))).toBe(sola(balla));
  });

  it('trascinata di una carta della coppia sollevata: la coppia; di una carta fuori dalla coppia: quella sola', () => {
    const coppia = percorso(m, [carta_(cil1), carta_(cil2)]);
    expect(mossaDi(tocca(m, coppia.scelta, trascina(cil2)))).toBe(coppiaCil);
    expect(mossaDi(tocca(m, coppia.scelta, trascina(cil1)))).toBe(coppiaCil);
    expect(mossaDi(tocca(m, coppia.scelta, trascina(carriola)))).toBe(sola(carriola));
  });

  it('trascinata di una carta che da sola non è una mossa (la gemella senza coppia): niente', () => {
    nessunEffetto(m, sceltaVuota(chiaveDi(m)), [trascina(cil2)]);
  });

  it('gesti su elementi non offerti: nessun esito, scelta invariata', () => {
    const v = sceltaVuota(chiaveDi(m));
    nessunEffetto(m, v, [
      carta_('carta-inesistente#1'),
      carta_(s0.giocatori[1]!.mano[0]!),
      trascina('carta-inesistente#1'),
      pecora('g2'),
      { tipo: 'dado' },
      { tipo: 'guaio', carta: 'insonnia#1' },
      { tipo: 'grande', carta: carriola },
      bottone('gioca'), // spento
      bottone('continua'),
      bottone('passo'),
      bottone('annulla'),
    ]);
  });

  it('avvisi: pochi agnellini alla vittoria e Guaio all\'eliminazione, come i pannelli', () => {
    const posti = configPer(3).postiOvile;
    const s = allaScelta({ agnellini: { g1: posti - 1 }, angoli: { g1: ['grandine-a-sorpresa', 'fulmine-curioso', 'pioggia-di-traverso'] } });
    const mm = momentoDi(s);
    const d = domandaVera(mm);
    expect(d.avvisi).toEqual(avvisiDi(mm.vista, 'g1'));
    expect(d.avvisi.length).toBeGreaterThan(0);
  });

  it('mano coperta: carte, sollevate e trascinabili vuote, nessun gesto carta o trascinata', () => {
    const mc = momentoDi(s0, { manoScoperta: false });
    const v = sceltaVuota(chiaveDi(mc));
    manoCoperta(domandaVera(mc, v));
    nessunEffetto(mc, v, [carta_(carriola), trascina(carriola), carta_(cil1), trascina(cil1)]);
    // anche con una scelta a metà rimasta nella scelta
    const vecchia: Scelta = { ...v, carte: [carriola] };
    manoCoperta(domandaVera(mc, vecchia));
    nessunEffetto(mc, vecchia, [bottone('gioca'), trascina(carriola)]);
  });
});

// ─── Belato finale ───────────────────────────────────────────────────────────

describe('belato_finale', () => {
  const s0 = alBelatoFinale();
  const m = momentoDi(s0);
  const mano = s0.giocatori.find((g) => g.id === 'g2')!.mano;
  const coperta = mano.find((c) => c.startsWith('coperta-di-lana'))!;
  const sasso = mano.find((c) => c.startsWith('sasso-comodo'))!;

  it('domanda: come la scelta, una carta sola; scritta del pannello', () => {
    expect(m.schermo).toEqual({ tipo: 'privata', giocatore: 'g2', pannello: 'belato_finale' });
    const d = domandaVera(m);
    expect(d.scritta).toBe(T.belatoFinale.titolo('Giocatore 2'));
    expect(ordinate(d.carte)).toEqual(ordinate([coperta, sasso]));
    expect(ordinate(d.trascinabili)).toEqual(ordinate([coperta, sasso]));
    expect(d.pulsanti).toEqual([{ id: 'gioca', testo: T.scena.scelte.gioca(0), attivo: false, sottoLaCarta: true }]);
  });

  it('tocco e "Gioca": sceltaFinale permessa; cambio carta; tocco di nuovo abbassa', () => {
    const r1 = percorso(m, [carta_(sasso), carta_(coperta)]);
    expect(r1.scelta.carte).toEqual([coperta]);
    const d = domandaVera(m, r1.scelta);
    expect(pulsante(d, 'gioca')).toMatchObject({ testo: T.scena.scelte.gioca(6), attivo: true });
    expect(mossaDi(tocca(m, r1.scelta, bottone('gioca')))).toBe(trova(m.azioni, 'sceltaFinale', (a) => a.carta === coperta));
    expect(percorso(m, [carta_(coperta)], r1.scelta).scelta.carte).toEqual([]);
  });

  it('trascinata: la sceltaFinale di quella carta', () => {
    expect(mossaDi(tocca(m, sceltaVuota(chiaveDi(m)), trascina(sasso)))).toBe(trova(m.azioni, 'sceltaFinale', (a) => a.carta === sasso));
  });

  it('mano coperta: nessuna carta toccabile', () => {
    const mc = momentoDi(s0, { manoScoperta: false });
    manoCoperta(domandaVera(mc));
    nessunEffetto(mc, sceltaVuota(chiaveDi(mc)), [carta_(coperta), trascina(coperta)]);
  });
});

// ─── Effetto della Trovata ───────────────────────────────────────────────────

describe('effetto', () => {
  /** Campanaccio stonato (sposta un agnellino): bersagli g2 (3 agnellini) e g4 (1); g3 ne ha 0. */
  const maniQuattro: Scelte = {
    g1: ['campanaccio-stonato'],
    g2: ['carriola'],
    g3: ['sasso-comodo'],
    g4: ['balla-di-fieno'],
  };
  const sB = finoAgliEffetti({ giocatori: 4, guaio: NEUTRO, agnellini: { g1: 3, g2: 3, g3: 0, g4: 1 }, mani: maniQuattro }, maniQuattro);
  const mB = momentoDi(sB);
  const voceB = (sB.fase.nome === 'effetti' ? sB.fase.coda[sB.fase.indice] : undefined)!;

  it('con bersagli: la carta al centro, "Usa l\'effetto" e "Non usarlo"; la mano non si tocca', () => {
    expect(mB.schermo).toEqual({ tipo: 'privata', giocatore: 'g1', pannello: 'effetto' });
    const d = domandaVera(mB);
    expect(d.centro).toBe(voceB.carta);
    expect(d.scritta).toBe(T.effetti.titolo('Giocatore 1', 'Campanaccio stonato'));
    expect(d.avvisi).toEqual([T.effetti.facoltativo]);
    expect(d.carte).toEqual([]);
    expect(d.pecore).toEqual([]);
    expect(d.pulsanti).toEqual([
      { id: 'attiva', testo: T.azioni.attiva, attivo: true },
      { id: 'rinuncia', testo: T.azioni.rinuncia, attivo: true, secondario: true },
    ]);
  });

  it('"Attiva" accende i bersagli e compare "Annulla"; la pecora toccata dà l\'attivazione permessa', () => {
    const v = sceltaVuota(chiaveDi(mB));
    const r1 = tocca(mB, v, bottone('attiva'));
    expect(r1.esito).toBeNull();
    expect(r1.scelta.carta).toBe(voceB.carta);
    const d = domandaVera(mB, r1.scelta);
    expect(ordinate(d.pecore)).toEqual(['g2', 'g4']);
    expect(d.centro).toBe(voceB.carta);
    expect(d.scritta).toBe(T.effetti.bersaglio);
    expect(ids(d)).toContain('annulla');
    expect(pulsante(d, 'annulla')).toMatchObject({ testo: T.azioni.annulla, attivo: true, secondario: true });
    expect(pulsante(d, 'attiva')?.attivo).toBe(false);
    expect(mossaDi(tocca(mB, r1.scelta, pecora('g4')))).toBe(trova(mB.azioni, 'attivaEffetto', (a) => a.bersaglio === 'g4'));
    expect(mossaDi(tocca(mB, r1.scelta, pecora('g2')))).toBe(trova(mB.azioni, 'attivaEffetto', (a) => a.bersaglio === 'g2'));
  });

  it('pecora non bersaglio, la propria, o prima di "Attiva": niente', () => {
    const v = sceltaVuota(chiaveDi(mB));
    nessunEffetto(mB, v, [pecora('g2'), pecora('g4')]);
    const acceso = tocca(mB, v, bottone('attiva')).scelta;
    nessunEffetto(mB, acceso, [pecora('g3'), pecora('g1'), carta_(voceB.carta), { tipo: 'dado' }]);
  });

  it('"Annulla" spegne i bersagli; "Non usarlo" rinuncia', () => {
    const acceso = tocca(mB, sceltaVuota(chiaveDi(mB)), bottone('attiva')).scelta;
    const r = tocca(mB, acceso, bottone('annulla'));
    expect(r.esito).toBeNull();
    expect(r.scelta.carta).toBeNull();
    expect(ids(domandaVera(mB, r.scelta))).not.toContain('annulla');
    expect(mossaDi(tocca(mB, acceso, bottone('rinuncia')))).toBe(trova(mB.azioni, 'rinunciaEffetto'));
  });

  it('tocco sul prato (ruling E): spegne i bersagli (carta in attesa) senza esito; il resto della scelta non cambia', () => {
    const acceso = tocca(mB, sceltaVuota(chiaveDi(mB)), bottone('attiva')).scelta;
    expect(acceso.carta).toBe(voceB.carta);
    const r = tocca(mB, acceso, { tipo: 'prato' });
    expect(r.esito).toBeNull();
    expect(r.scelta).toEqual({ ...acceso, carte: [], carta: null });
    expect(ordinate(domandaVera(mB, r.scelta).pecore)).toEqual([]);
    const vuota = sceltaVuota(chiaveDi(mB));
    expect(tocca(mB, vuota, { tipo: 'prato' }).scelta).toBe(vuota);
  });

  it('effetto senza bersaglio: "Attiva" manda subito la mossa', () => {
    const mani: Scelte = { g1: ['agnellino-smarrito'], g2: ['carriola'], g3: ['sasso-comodo'] };
    const s = finoAgliEffetti({ guaio: NEUTRO, mani }, mani);
    const m = momentoDi(s);
    const d = domandaVera(m);
    expect(d.pecore).toEqual([]);
    expect(mossaDi(tocca(m, sceltaVuota(chiaveDi(m)), bottone('attiva')))).toBe(trova(m.azioni, 'attivaEffetto'));
  });

  it('senza "attivaEffetto" tra le mosse: "Usa l\'effetto" spento e nessun esito', () => {
    const m: Momento = { ...mB, azioni: mB.azioni.filter((a) => a.tipo !== 'attivaEffetto') };
    const d = domandaVera(m);
    expect(pulsante(d, 'attiva')?.attivo).toBe(false);
    nessunEffetto(m, sceltaVuota(chiaveDi(m)), [bottone('attiva'), pecora('g2')]);
  });
});

// ─── Richieste ───────────────────────────────────────────────────────────────

describe('richiesta: guarda_due (Cannocchiale)', () => {
  const MAZZO = ['corona-di-margherite', 'trifoglio-qualunque', 'ombrello-bucato'];
  const mani: Scelte = { g1: ['cannocchiale', 'carriola'], g2: ['sasso-comodo'], g3: ['balla-di-fieno'] };
  const s0 = attivaERisolvi(finoAgliEffetti({ guaio: NEUTRO, mazzo: MAZZO, mani }, { g1: ['cannocchiale'], g2: ['sasso-comodo'], g3: ['balla-di-fieno'] }));
  const m = momentoDi(s0);
  const r = s0.richiesta!;
  const due = r.tipo === 'guarda_due' ? r.carte : [];

  it('le due carte compaiono grandi; la mano e i pulsanti restano spenti', () => {
    expect(m.schermo).toEqual({ tipo: 'privata', giocatore: 'g1', pannello: 'richiesta' });
    expect(due).toHaveLength(2);
    const d = domandaVera(m);
    expect(d.grandi).toEqual(due);
    expect(d.scritta).toContain('Cannocchiale');
    expect(d.scritta).toContain(T.effetti.guardaDue);
    expect(d.carte).toEqual([]);
    expect(d.pulsanti).toEqual([]);
  });

  it('toccare una carta grande: la mossa permessa che la tiene', () => {
    const v = sceltaVuota(chiaveDi(m));
    for (const c of due) {
      expect(mossaDi(tocca(m, v, { tipo: 'grande', carta: c }))).toBe(trova(m.azioni, 'completaEffetto', (a) => a.carte[0] === c));
    }
  });

  it('una carta che non è tra le due, o un tocco sulla mano: niente', () => {
    const v = sceltaVuota(chiaveDi(m));
    nessunEffetto(m, v, [{ tipo: 'grande', carta: carta(s0, 'g1', 'carriola') }, carta_(carta(s0, 'g1', 'carriola')), trascina(due[0]!), pecora('g2')]);
  });

  it('mano coperta: le carte guardate non compaiono e non rispondono', () => {
    const mc = momentoDi(s0, { manoScoperta: false });
    const d = domandaVera(mc);
    expect(d.grandi).toEqual([]);
    nessunEffetto(mc, sceltaVuota(chiaveDi(mc)), [{ tipo: 'grande', carta: due[0]! }]);
  });
});

describe('richiesta: scarta_e_somma (Scorta nel vello)', () => {
  const mani: Scelte = {
    g1: ['scorta-nel-vello', 'corona-di-margherite', 'balla-di-fieno', 'pernacchia'],
    g2: ['carriola', 'coperta-di-lana'],
    g3: ['sasso-comodo'],
  };
  const s0 = attivaERisolvi(finoAgliEffetti({ guaio: NEUTRO, mani }, { g1: ['scorta-nel-vello'], g2: ['carriola'], g3: ['sasso-comodo'] }));
  const m = momentoDi(s0);
  const corona = carta(s0, 'g1', 'corona-di-margherite');
  const balla = carta(s0, 'g1', 'balla-di-fieno');
  const pernacchia = carta(s0, 'g1', 'pernacchia');
  const mossa = (c: IdCarta) => trova(m.azioni, 'completaEffetto', (a) => a.carte.length === 1 && a.carte[0] === c);

  it('domanda: le Trovate scartabili toccabili, "Scarta" spento finché non si sceglie', () => {
    expect(s0.richiesta?.tipo).toBe('scarta_e_somma');
    const d = domandaVera(m);
    expect(ordinate(d.carte)).toEqual(ordinate([corona, balla]));
    expect(d.scritta).toContain('Scorta nel vello');
    expect(d.scritta).toContain(T.effetti.scartaESomma);
    expect(d.grandi).toEqual([]);
    expect(d.trascinabili).toEqual([]);
    expect(d.pulsanti).toEqual([{ id: 'conferma', testo: T.azioni.scarta, attivo: false }]);
  });

  it('una carta sola: il secondo tocco sostituisce, lo stesso la abbassa; "Scarta" porta la mossa permessa', () => {
    let r = percorso(m, [carta_(corona), carta_(balla)]);
    expect(r.scelta.carte).toEqual([balla]);
    const d = domandaVera(m, r.scelta);
    expect(d.sollevate).toEqual([balla]);
    expect(pulsante(d, 'conferma')).toEqual({ id: 'conferma', testo: `${T.azioni.scarta} Balla di fieno`, attivo: true });
    expect(mossaDi(tocca(m, r.scelta, bottone('conferma')))).toBe(mossa(balla));
    r = percorso(m, [carta_(balla)], r.scelta);
    expect(r.scelta.carte).toEqual([]);
  });

  it('una carta non scartabile (Belato) o un "Scarta" a vuoto: niente', () => {
    nessunEffetto(m, sceltaVuota(chiaveDi(m)), [carta_(pernacchia), bottone('conferma'), bottone('nonScartare'), trascina(corona)]);
  });

  it('mano coperta: niente da toccare', () => {
    const mc = momentoDi(s0, { manoScoperta: false });
    manoCoperta(domandaVera(mc));
    nessunEffetto(mc, sceltaVuota(chiaveDi(mc)), [carta_(corona)]);
  });
});

describe('richiesta: scarta_fino_a_tre (Pulizie di primavera)', () => {
  const mani: Scelte = {
    g1: ['pulizie-di-primavera', 'carriola', 'pernacchia', 'balla-di-fieno', 'corona-di-margherite'],
    g2: ['sasso-comodo'],
    g3: ['megafono-di-latta'],
  };
  const s0 = attivaERisolvi(finoAgliEffetti({ guaio: NEUTRO, mani }, { g1: ['pulizie-di-primavera'], g2: ['sasso-comodo'], g3: ['megafono-di-latta'] }));
  const m = momentoDi(s0);
  const [c1, c2, c3, c4] = s0.giocatori[0]!.mano as [IdCarta, IdCarta, IdCarta, IdCarta];

  it('domanda: tutta la mano toccabile; con 0 carte il pulsante è "Non scarto nulla"', () => {
    expect(s0.richiesta?.tipo).toBe('scarta_fino_a_tre');
    expect(s0.giocatori[0]!.mano).toHaveLength(4);
    const d = domandaVera(m);
    expect(ordinate(d.carte)).toEqual(ordinate([c1, c2, c3, c4]));
    expect(d.scritta).toContain(T.effetti.scartaFinoATre);
    expect(d.trascinabili).toEqual([]);
    expect(d.pulsanti).toEqual([{ id: 'nonScartare', testo: T.azioni.nonScartare, attivo: true }]);
    const r = tocca(m, sceltaVuota(chiaveDi(m)), bottone('nonScartare'));
    expect(mossaDi(r)).toBe(trova(m.azioni, 'completaEffetto', (a) => a.carte.length === 0));
  });

  it('fino a tre carte; il quarto tocco è ignorato; "Scarta (n)" porta la mossa permessa', () => {
    const tre = percorso(m, [carta_(c1), carta_(c2), carta_(c3)]);
    expect(tre.scelta.carte).toEqual([c1, c2, c3]);
    const d = domandaVera(m, tre.scelta);
    expect(d.sollevate).toEqual([c1, c2, c3]);
    expect(d.pulsanti).toEqual([{ id: 'conferma', testo: T.scena.scelte.scarta(3), attivo: true }]);
    const quarto = tocca(m, tre.scelta, carta_(c4));
    expect(quarto.esito).toBeNull();
    expect(quarto.scelta).toBe(tre.scelta);
    const fine = tocca(m, tre.scelta, bottone('conferma'));
    const permessa = trova(m.azioni, 'completaEffetto', (a) => a.carte.length === 3 && [c1, c2, c3].every((c) => a.carte.includes(c)));
    expect(mossaDi(fine)).toBe(permessa);
  });

  it('un tocco su una carta già sollevata la abbassa e libera un posto', () => {
    let r = percorso(m, [carta_(c1), carta_(c2), carta_(c3), carta_(c2)]);
    expect(r.scelta.carte).toEqual([c1, c3]);
    expect(pulsante(domandaVera(m, r.scelta), 'conferma')?.testo).toBe(T.scena.scelte.scarta(2));
    r = percorso(m, [carta_(c4)], r.scelta);
    expect(r.scelta.carte).toEqual([c1, c3, c4]);
  });

  it('abbassando tutte si torna a "Non scarto nulla"', () => {
    const r = percorso(m, [carta_(c1), carta_(c1)]);
    expect(r.scelta.carte).toEqual([]);
    expect(ids(domandaVera(m, r.scelta))).toEqual(['nonScartare']);
  });

  it('"Scarta" con 0 carte (id conferma) e "Non scarto nulla" con carte: niente', () => {
    nessunEffetto(m, sceltaVuota(chiaveDi(m)), [bottone('conferma')]);
    const una = percorso(m, [carta_(c1)]).scelta;
    nessunEffetto(m, una, [bottone('nonScartare')]);
  });

  it('mano coperta: niente da toccare, nemmeno con una scelta rimasta', () => {
    const mc = momentoDi(s0, { manoScoperta: false });
    manoCoperta(domandaVera(mc));
    nessunEffetto(mc, sceltaVuota(chiaveDi(mc)), [carta_(c1), trascina(c1)]);
  });
});

// ─── Risposta: Beee-NO! ──────────────────────────────────────────────────────

describe('reazione', () => {
  const s0 = allaReazione();
  const m = momentoDi(s0, { scelto: 'g2' });
  const beeeNo = carta(s0, 'g2', 'beee-no');
  const gioca = trova(m.azioni, 'giocaBelato');
  const passa = trova(m.azioni, 'passa');

  it('domanda: il Beee-NO! giocabile, "Gioca", "Passo" e "Annulla" (dispositivo condiviso)', () => {
    expect(m.schermo).toEqual({ tipo: 'privata', giocatore: 'g2', pannello: 'reazione' });
    const d = domandaVera(m);
    expect(d.scritta).toContain(T.reazione.privato('Giocatore 2'));
    expect(d.avvisi).toEqual([]);
    expect(d.carte).toEqual([beeeNo]);
    expect(d.trascinabili).toEqual([beeeNo]);
    expect(d.sollevate).toEqual([]);
    expect(d.pecore).toEqual([]);
    expect(d.pulsanti).toEqual([
      { id: 'gioca', testo: T.azioni.beeeNo, attivo: false, sottoLaCarta: true },
      { id: 'passo', testo: T.scena.scelte.passo, attivo: true, secondario: true },
      { id: 'annulla', testo: T.azioni.annulla, attivo: true, secondario: true },
    ]);
  });

  it('tocco solleva, "Gioca" manda il Beee-NO! permesso; un secondo tocco lo abbassa', () => {
    const r1 = tocca(m, sceltaVuota(chiaveDi(m)), carta_(beeeNo));
    expect(r1.scelta.carte).toEqual([beeeNo]);
    const d = domandaVera(m, r1.scelta);
    expect(d.sollevate).toEqual([beeeNo]);
    expect(pulsante(d, 'gioca')?.attivo).toBe(true);
    expect(mossaDi(tocca(m, r1.scelta, bottone('gioca')))).toBe(gioca);
    expect(percorso(m, [carta_(beeeNo)], r1.scelta).scelta.carte).toEqual([]);
  });

  it('trascinata: il Beee-NO! permesso anche senza tocco', () => {
    expect(mossaDi(tocca(m, sceltaVuota(chiaveDi(m)), trascina(beeeNo)))).toBe(gioca);
  });

  it('"Passo": la mossa passa permessa', () => {
    expect(mossaDi(tocca(m, sceltaVuota(chiaveDi(m)), bottone('passo')))).toBe(passa);
  });

  it('"Annulla" (solo condiviso): esito indietro; nella prova non c\'è', () => {
    expect(tocca(m, sceltaVuota(chiaveDi(m)), bottone('annulla')).esito).toEqual({ tipo: 'indietro' });
    const singolo = momentoDi(s0, { scelto: 'g2', condiviso: false });
    const d = domandaVera(singolo);
    expect(ids(d)).toEqual(['gioca', 'passo']);
    nessunEffetto(singolo, sceltaVuota(chiaveDi(singolo)), [bottone('annulla')]);
  });

  it('senza Beee-NO!: nessuna carta, avviso "non hai", resta "Passo"', () => {
    const mm = momentoDi(s0, { scelto: 'g3' });
    const d = domandaVera(mm);
    expect(d.carte).toEqual([]);
    expect(d.trascinabili).toEqual([]);
    expect(d.avvisi).toEqual([T.reazione.nonHai]);
    expect(pulsante(d, 'gioca')?.attivo).toBe(false);
    expect(mossaDi(tocca(mm, sceltaVuota(chiaveDi(mm)), bottone('passo')))).toBe(trova(mm.azioni, 'passa'));
    nessunEffetto(mm, sceltaVuota(chiaveDi(mm)), [carta_(beeeNo), trascina(beeeNo), bottone('gioca')]);
  });

  it('mano coperta: nessuna carta toccabile, "Passo" resta', () => {
    const mc = momentoDi(s0, { scelto: 'g2', manoScoperta: false });
    const d = domandaVera(mc);
    manoCoperta(d);
    expect(pulsante(d, 'passo')?.attivo).toBe(true);
    nessunEffetto(mc, sceltaVuota(chiaveDi(mc)), [carta_(beeeNo), trascina(beeeNo)]);
  });
});

// ─── Belati di punteggio ─────────────────────────────────────────────────────

describe('punteggio', () => {
  const s0 = alPunteggio();
  const m = momentoDi(s0, { scelto: 'g1' });
  const gruppo = carta(s0, 'g1', 'belato-di-gruppo');
  const mondo = carta(s0, 'g1', 'mondo-alla-rovescia');
  const perBersaglio = (b: IdGiocatore) => trova(m.azioni, 'giocaBelato', (a) => a.carta === gruppo && a.bersaglio === b);
  const mondoMossa = trova(m.azioni, 'giocaBelato', (a) => a.carta === mondo);
  const passa = trova(m.azioni, 'passa');

  it('domanda: i Belati giocabili; trascinabile solo quello senza bersaglio; "Passo" e "Annulla"', () => {
    expect(m.schermo).toEqual({ tipo: 'privata', giocatore: 'g1', pannello: 'punteggio' });
    const d = domandaVera(m);
    expect(d.scritta).toBe(T.punteggio.privato('Giocatore 1'));
    expect(d.avvisi).toEqual([]);
    expect(ordinate(d.carte)).toEqual(ordinate([gruppo, mondo]));
    expect(d.trascinabili).toEqual([mondo]);
    expect(d.pecore).toEqual([]);
    expect(ids(d)).toEqual(['gioca', 'passo', 'annulla']);
    expect(pulsante(d, 'gioca')).toMatchObject({ attivo: false, sottoLaCarta: true });
    expect(pulsante(d, 'passo')).toEqual({ id: 'passo', testo: T.scena.scelte.passo, attivo: true, secondario: true });
    expect(pulsante(d, 'annulla')).toMatchObject({ testo: T.azioni.annulla, attivo: true, secondario: true });
  });

  it('carta senza bersaglio: tocco + "Gioca" e trascinata mandano la mossa permessa', () => {
    const r1 = tocca(m, sceltaVuota(chiaveDi(m)), carta_(mondo));
    const d = domandaVera(m, r1.scelta);
    expect(d.sollevate).toEqual([mondo]);
    expect(pulsante(d, 'gioca')).toMatchObject({ testo: 'Mondo alla rovescia', attivo: true });
    expect(mossaDi(tocca(m, r1.scelta, bottone('gioca')))).toBe(mondoMossa);
    expect(mossaDi(tocca(m, sceltaVuota(chiaveDi(m)), trascina(mondo)))).toBe(mondoMossa);
  });

  it('carta con bersagli: "Gioca" accende le pecore dei partecipanti (anche la propria); la pecora manda la mossa', () => {
    const r1 = tocca(m, sceltaVuota(chiaveDi(m)), carta_(gruppo));
    expect(domandaVera(m, r1.scelta).pecore).toEqual([]);
    const r2 = tocca(m, r1.scelta, bottone('gioca'));
    expect(r2.esito).toBeNull();
    expect(r2.scelta.carta).toBe(gruppo);
    const d = domandaVera(m, r2.scelta);
    expect(ordinate(d.pecore)).toEqual(ordinate(s0.datiRound.partecipanti));
    expect(d.pecore).toContain('g1');
    expect(d.scritta).toBe(T.punteggio.suChi);
    expect(pulsante(d, 'gioca')?.attivo).toBe(false);
    expect(mossaDi(tocca(m, r2.scelta, pecora('g1')))).toBe(perBersaglio('g1'));
    expect(mossaDi(tocca(m, r2.scelta, pecora('g3')))).toBe(perBersaglio('g3'));
  });

  it('in mira "Annulla" spegne i bersagli (non torna a "Chi risponde?"); poi "Annulla" è di nuovo indietro', () => {
    const mira = percorso(m, [carta_(gruppo), bottone('gioca')]).scelta;
    const r = tocca(m, mira, bottone('annulla'));
    expect(r.esito).toBeNull();
    expect(r.scelta.carta).toBeNull();
    expect(tocca(m, r.scelta, bottone('annulla')).esito).toEqual({ tipo: 'indietro' });
  });

  it('trascinata di una carta con bersagli: niente; la pecora senza mira: niente', () => {
    const v = sceltaVuota(chiaveDi(m));
    nessunEffetto(m, v, [trascina(gruppo), pecora('g2'), bottone('gioca')]);
  });

  it('un tocco su un\'altra carta toglie la mira; sulla stessa abbassa tutto', () => {
    const mira = percorso(m, [carta_(gruppo), bottone('gioca')]).scelta;
    const r = tocca(m, mira, carta_(mondo));
    expect(r.scelta.carte).toEqual([mondo]);
    expect(r.scelta.carta).toBeNull();
    const giu = tocca(m, mira, carta_(gruppo));
    expect(giu.scelta.carte).toEqual([]);
    expect(giu.scelta.carta).toBeNull();
  });

  it('"Passo": la mossa passa permessa', () => {
    expect(mossaDi(tocca(m, sceltaVuota(chiaveDi(m)), bottone('passo')))).toBe(passa);
  });

  it('"Annulla" solo su un dispositivo condiviso: esito indietro', () => {
    expect(tocca(m, sceltaVuota(chiaveDi(m)), bottone('annulla')).esito).toEqual({ tipo: 'indietro' });
    const singolo = momentoDi(s0, { scelto: 'g1', condiviso: false });
    expect(ids(domandaVera(singolo))).toEqual(['gioca', 'passo']);
    nessunEffetto(singolo, sceltaVuota(chiaveDi(singolo)), [bottone('annulla')]);
  });

  it('senza Belati: avviso "non hai", nessuna carta', () => {
    const mm = momentoDi(s0, { scelto: 'g2' });
    const d = domandaVera(mm);
    expect(d.carte).toEqual([]);
    expect(d.avvisi).toEqual([T.punteggio.nonHai]);
  });

  it('mano coperta: nessuna carta toccabile, "Passo" resta', () => {
    const mc = momentoDi(s0, { scelto: 'g1', manoScoperta: false });
    const d = domandaVera(mc);
    manoCoperta(d);
    expect(pulsante(d, 'passo')?.attivo).toBe(true);
    nessunEffetto(mc, sceltaVuota(chiaveDi(mc)), [carta_(mondo), trascina(mondo), carta_(gruppo)]);
  });
});

// ─── Salvataggio dal Guaio ───────────────────────────────────────────────────

describe('salvataggio', () => {
  const s0 = alSalvataggio({ g2: ['faccio-finta-di-niente', 'finta-svenuta'] });
  const m = momentoDi(s0);
  const infondo = carta(s0, 'g2', 'faccio-finta-di-niente');
  const devia = carta(s0, 'g2', 'finta-svenuta');
  const infondoMossa = trova(m.azioni, 'giocaBelato', (a) => a.carta === infondo);
  const deviaSu = (b: IdGiocatore) => trova(m.azioni, 'giocaBelato', (a) => a.carta === devia && a.bersaglio === b);

  it('domanda: il Guaio al centro, i Belati giocabili, "Prendo il Guaio"', () => {
    expect(m.schermo).toEqual({ tipo: 'privata', giocatore: 'g2', pannello: 'salvataggio' });
    const d = domandaVera(m);
    expect(d.scritta).toBe(T.salvataggio.titolo('Giocatore 2'));
    expect(d.avvisi).toEqual(avvisiDi(m.vista, 'g2'));
    expect(d.centro).toBe(s0.datiRound.guaio);
    expect(d.centro).not.toBeNull();
    expect(ordinate(d.carte)).toEqual(ordinate([infondo, devia]));
    expect(d.trascinabili).toEqual([infondo]);
    expect(ids(d)).toEqual(['gioca', 'prendiGuaio']);
    expect(pulsante(d, 'prendiGuaio')).toEqual({ id: 'prendiGuaio', testo: T.azioni.prendiGuaio, attivo: true, secondario: true });
  });

  it('"Prendo il Guaio": la mossa passa permessa', () => {
    expect(mossaDi(tocca(m, sceltaVuota(chiaveDi(m)), bottone('prendiGuaio')))).toBe(trova(m.azioni, 'passa'));
  });

  it('Belato senza bersaglio: tocco + "Gioca" e trascinata', () => {
    const r1 = tocca(m, sceltaVuota(chiaveDi(m)), carta_(infondo));
    expect(mossaDi(tocca(m, r1.scelta, bottone('gioca')))).toBe(infondoMossa);
    expect(mossaDi(tocca(m, sceltaVuota(chiaveDi(m)), trascina(infondo)))).toBe(infondoMossa);
  });

  it('Belato che devia il Guaio: "Gioca" accende le altre pecore, la pecora manda la mossa', () => {
    const r2 = percorso(m, [carta_(devia), bottone('gioca')]);
    expect(r2.esito).toBeNull();
    expect(r2.scelta.carta).toBe(devia);
    const d = domandaVera(m, r2.scelta);
    expect(ordinate(d.pecore)).toEqual(['g1', 'g3']);
    expect(d.scritta).toBe(T.salvataggio.aChi);
    expect(ids(d)).toContain('annulla');
    expect(mossaDi(tocca(m, r2.scelta, pecora('g3')))).toBe(deviaSu('g3'));
    expect(mossaDi(tocca(m, r2.scelta, pecora('g1')))).toBe(deviaSu('g1'));
    nessunEffetto(m, r2.scelta, [pecora('g2')]);
    expect(tocca(m, r2.scelta, bottone('annulla')).scelta.carta).toBeNull();
  });

  it('trascinata del Belato che devia: niente (serve il bersaglio)', () => {
    nessunEffetto(m, sceltaVuota(chiaveDi(m)), [trascina(devia)]);
  });

  it('mano coperta: nessuna carta toccabile; il Guaio resta al centro', () => {
    const mc = momentoDi(s0, { manoScoperta: false });
    const d = domandaVera(mc);
    manoCoperta(d);
    expect(d.centro).toBe(s0.datiRound.guaio);
    nessunEffetto(mc, sceltaVuota(chiaveDi(mc)), [carta_(infondo), trascina(infondo)]);
  });
});

// ─── Consolazione ────────────────────────────────────────────────────────────

describe('consolazione', () => {
  const ANGOLI: OpzioniScenario = { angoli: { g2: ['grandine-a-sorpresa', 'fulmine-curioso'], g3: ['insonnia'] } };
  const s0 = allaConsolazione({ g2: ['visita-di-garzina', 'ombrello-bucato'] }, ANGOLI);
  const m = momentoDi(s0);
  const garzina = carta(s0, 'g2', 'visita-di-garzina');
  const ombrello = carta(s0, 'g2', 'ombrello-bucato');
  const angolo = s0.giocatori.find((g) => g.id === 'g2')!.angolo;
  const curaDi = (g: IdCarta) => trova(m.azioni, 'giocaBelato', (a) => a.guaio === g);
  const concludi = (scarta: IdCarta | null) => trova(m.azioni, 'concludiConsolazione', (a) => a.scarta === scarta);

  it('domanda: i Guai curabili sono i tuoi; carte = carte scartabili; "Non scarto nulla"', () => {
    expect(m.schermo).toEqual({ tipo: 'privata', giocatore: 'g2', pannello: 'consolazione' });
    expect(angolo).toHaveLength(3);
    const d = domandaVera(m);
    expect(d.scritta).toContain(T.consolazione.titolo('Giocatore 2'));
    expect(d.avvisi).toEqual(avvisiDi(m.vista, 'g2'));
    expect(ordinate(d.guai)).toEqual(ordinate(angolo));
    expect(ordinate(d.carte)).toEqual(ordinate([garzina, ombrello]));
    expect(d.trascinabili).toEqual([]);
    expect(d.pecore).toEqual([]);
    expect(d.pulsanti).toEqual([{ id: 'fatto', testo: T.azioni.nonScartare, attivo: true }]);
    expect(mossaDi(tocca(m, sceltaVuota(chiaveDi(m)), bottone('fatto')))).toBe(concludi(null));
  });

  it('scarto: una carta alla volta, "Fatto" diventa "Scarta <carta>", un secondo tocco la abbassa', () => {
    let r = percorso(m, [carta_(ombrello)]);
    expect(r.scelta.carte).toEqual([ombrello]);
    expect(pulsante(domandaVera(m, r.scelta), 'fatto')).toEqual({ id: 'fatto', testo: `${T.azioni.scarta} Ombrello bucato`, attivo: true });
    expect(mossaDi(tocca(m, r.scelta, bottone('fatto')))).toBe(concludi(ombrello));
    r = percorso(m, [carta_(garzina)], r.scelta);
    expect(r.scelta.carte).toEqual([garzina]);
    r = percorso(m, [carta_(garzina)], r.scelta);
    expect(r.scelta.carte).toEqual([]);
  });

  describe('una sola cura per quel Guaio', () => {
    it('il tocco sul Guaio lo sceglie (non manda niente) e compare "Cura <Guaio>"', () => {
      for (const g of angolo) {
        const r = tocca(m, sceltaVuota(chiaveDi(m)), { tipo: 'guaio', carta: g });
        expect(r.esito).toBeNull();
        expect(r.scelta.guaio).toBe(g);
        const d = domandaVera(m, r.scelta);
        expect(d.guaioScelto).toBe(g);
        expect(ordinate(d.guai)).toEqual(ordinate(angolo));
        expect(ids(d)).toEqual(['conferma', 'annulla']);
        expect(pulsante(d, 'conferma')).toEqual({ id: 'conferma', testo: T.scena.scelte.cura(nomeCarta(g)), attivo: true });
        expect(d.carte).toEqual([]);
      }
    });

    it('"Cura <Guaio>" manda la mossa permessa per quel Guaio', () => {
      for (const g of angolo) {
        const scelto = tocca(m, sceltaVuota(chiaveDi(m)), { tipo: 'guaio', carta: g }).scelta;
        expect(mossaDi(tocca(m, scelto, bottone('conferma')))).toBe(curaDi(g));
      }
    });

    it('senza Guaio scelto "Cura" non c\'è e il guaio scelto della domanda è null', () => {
      expect(domandaVera(m).guaioScelto).toBeNull();
      nessunEffetto(m, sceltaVuota(chiaveDi(m)), [bottone('conferma')]);
    });

    it('un secondo tocco sul Guaio o "Annulla" tolgono la scelta; un altro Guaio la cambia', () => {
      const [a, b] = angolo as [IdCarta, IdCarta];
      const scelto = tocca(m, sceltaVuota(chiaveDi(m)), { tipo: 'guaio', carta: a }).scelta;
      expect(tocca(m, scelto, { tipo: 'guaio', carta: a }).scelta.guaio).toBeNull();
      const annullato = tocca(m, scelto, bottone('annulla'));
      expect(annullato.esito).toBeNull();
      expect(annullato.scelta.guaio).toBeNull();
      const cambiato = tocca(m, scelto, { tipo: 'guaio', carta: b });
      expect(cambiato.esito).toBeNull();
      expect(cambiato.scelta.guaio).toBe(b);
      expect(domandaVera(m, cambiato.scelta).guaioScelto).toBe(b);
    });
  });

  it('Guaio non tuo o non curabile, carta in mano che non si scarta: niente', () => {
    nessunEffetto(m, sceltaVuota(chiaveDi(m)), [
      { tipo: 'guaio', carta: 'insonnia#1' },
      carta_('carta-inesistente#1'),
      trascina(ombrello),
      bottone('gioca'),
      bottone('annulla'),
    ]);
  });

  describe('due cure per lo stesso Guaio', () => {
    const garzina2 = 'visita-di-garzina#9';
    const g = angolo[0]!;
    const seconda: Azione = { tipo: 'giocaBelato', giocatore: 'g2', carta: garzina2, guaio: g };
    const m2: Momento = { ...m, azioni: [...m.azioni, seconda] };
    const prima = trova(m.azioni, 'giocaBelato', (a) => a.guaio === g);

    it('il tocco sul Guaio lo sceglie: le carte diventano le cure per quel Guaio', () => {
      const r = tocca(m2, sceltaVuota(chiaveDi(m2)), { tipo: 'guaio', carta: g });
      expect(r.esito).toBeNull();
      expect(r.scelta.guaio).toBe(g);
      const d = domandaVera(m2, r.scelta);
      expect(ordinate(d.carte)).toEqual(ordinate([garzina, garzina2]));
      expect(ordinate(d.trascinabili)).toEqual(ordinate([garzina, garzina2]));
      expect(ordinate(d.guai)).toEqual(ordinate(angolo));
      expect(d.scritta).toContain(T.consolazione.titolo('Giocatore 2'));
      expect(d.scritta).toContain('Grandine a sorpresa');
      expect(d.guaioScelto).toBe(g);
      expect(ids(d)).toEqual(['gioca', 'annulla']);
      expect(pulsante(d, 'gioca')).toMatchObject({ attivo: false, sottoLaCarta: true });
    });

    it('tocco su una cura + "Gioca" o trascinata: la mossa permessa per quel Guaio', () => {
      const scelto = tocca(m2, sceltaVuota(chiaveDi(m2)), { tipo: 'guaio', carta: g }).scelta;
      const r1 = tocca(m2, scelto, carta_(garzina2));
      expect(r1.scelta.carte).toEqual([garzina2]);
      expect(pulsante(domandaVera(m2, r1.scelta), 'gioca')?.attivo).toBe(true);
      expect(mossaDi(tocca(m2, r1.scelta, bottone('gioca')))).toBe(seconda);
      expect(mossaDi(tocca(m2, scelto, trascina(garzina)))).toBe(prima);
      expect(mossaDi(tocca(m2, scelto, trascina(garzina2)))).toBe(seconda);
    });

    it('con il Guaio scelto "Fatto" non c\'è e le carte da scartare non si toccano', () => {
      const scelto = tocca(m2, sceltaVuota(chiaveDi(m2)), { tipo: 'guaio', carta: g }).scelta;
      nessunEffetto(m2, scelto, [carta_(ombrello), bottone('fatto')]);
    });

    it('"Annulla" o un secondo tocco sul Guaio tolgono la scelta; un altro Guaio la cambia', () => {
      const scelto = tocca(m2, sceltaVuota(chiaveDi(m2)), { tipo: 'guaio', carta: g }).scelta;
      const r1 = tocca(m2, scelto, bottone('annulla'));
      expect(r1.esito).toBeNull();
      expect(r1.scelta.guaio).toBeNull();
      expect(r1.scelta.carte).toEqual([]);
      expect(tocca(m2, scelto, { tipo: 'guaio', carta: g }).scelta.guaio).toBeNull();
      const altro = angolo[1]!;
      // l'altro Guaio ha una sola cura: anche lui si sceglie soltanto, la mossa parte con "Cura"
      const r2 = tocca(m2, scelto, { tipo: 'guaio', carta: altro });
      expect(r2.esito).toBeNull();
      expect(r2.scelta.guaio).toBe(altro);
      expect(mossaDi(tocca(m2, r2.scelta, bottone('conferma')))).toBe(trova(m2.azioni, 'giocaBelato', (a) => a.guaio === altro));
    });

    it('le carte sollevate per scartare non restano quando si sceglie un Guaio', () => {
      const r = percorso(m2, [carta_(ombrello), { tipo: 'guaio', carta: g }]);
      expect(r.scelta.guaio).toBe(g);
      expect(r.scelta.carte).toEqual([]);
    });
  });

  it('mano coperta: niente carte, niente Guai toccabili', () => {
    const mc = momentoDi(s0, { manoScoperta: false });
    const d = domandaVera(mc);
    manoCoperta(d);
    expect(d.guai).toEqual([]);
    nessunEffetto(mc, sceltaVuota(chiaveDi(mc)), [carta_(ombrello), { tipo: 'guaio', carta: angolo[0]! }]);
  });
});

// ─── avvisiDi ────────────────────────────────────────────────────────────────

describe('avvisiDi', () => {
  it('nessun avviso con un Ovile lontano dalla vittoria e senza Guai a rischio', () => {
    const v = vistaPer(allaScelta(), 'g1');
    expect(avvisiDi(v, 'g1')).toEqual([]);
  });

  it('un agnellino alla vittoria: titolo e testo del pannello', () => {
    const s = allaScelta({ agnellini: { g1: configPer(3).postiOvile - 1 } });
    const avvisi = avvisiDi(vistaPer(s, 'g1'), 'g1');
    expect(avvisi).toHaveLength(1);
    expect(avvisi[0]).toContain(T.avvisi.vittoriaTitolo(1));
    expect(avvisi[0]).toContain(T.avvisi.vittoria);
  });

  it('un Guaio all\'eliminazione: i tipi pericolosi nominati', () => {
    const s = allaScelta({ angoli: { g1: ['grandine-a-sorpresa', 'fulmine-curioso', 'pioggia-di-traverso'] } });
    const avvisi = avvisiDi(vistaPer(s, 'g1'), 'g1');
    expect(avvisi.join(' ')).toContain(T.avvisi.pericoloTitolo);
    expect(avvisi.join(' ')).toContain(T.tipiGuaio.meteo);
  });

  it('niente avvisi per una pecora eliminata', () => {
    const s = allaScelta({ eliminati: ['g3'] });
    expect(avvisiDi(vistaPer(s, 'g1'), 'g3')).toEqual([]);
  });
});
