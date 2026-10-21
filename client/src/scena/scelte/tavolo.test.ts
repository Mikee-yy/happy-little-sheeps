// Prove delle domande dei momenti senza mano (le fasi automatiche, "Chi risponde?", dado, furto, Testata).
// Partite vere del motore (engine/test/aiuti.ts); ogni mossa prodotta deve essere uno degli oggetti permessi.
import { describe, expect, it } from 'vitest';
import { applica, azioniPossibili } from '../../../../engine/src';
import type { Azione, Stato } from '../../../../engine/src';
import { chiudiPunteggio, conFaccia, nessunaReazione, prosegui, scegli, scenario } from '../../../../engine/test/aiuti';
import type { OpzioniScenario } from '../../../../engine/test/aiuti';
import { scenaProva } from '../../prova/regiaProva';
import { T } from '../../testi';
import { momentoDi as momentoComune } from './aiuti-momento';
import { avanza, chiaveDi, domandaDi, sceltaVuota } from './domanda';
import type { Domanda, Gesto, Momento, Scelta } from './tipi';

const NEUTRO = 'tosatura-a-sorpresa';

/** Il momento come lo vede il gioco "Passa il telefono": vista del tavolo, schermo della regia, mosse permesse; qui la mano non è mai scoperta. */
const momentoDi = (s: Stato, condiviso = true): Momento => momentoComune(s, { condiviso, manoScoperta: false });

function domandaVera(m: Momento, s: Scelta = sceltaVuota(chiaveDi(m))): Domanda {
  const d = domandaDi(m, s);
  expect(d).not.toBeNull();
  return d as Domanda;
}

/** Applica il gesto e dà (scelta nuova, esito). */
const tocca = (m: Momento, s: Scelta, g: Gesto) => avanza(m, s, g);

/** Dal Guaio scoperto fino al dado: g1 (Carriola 8) lancia. Il gregge ha 20 agnellini. */
function alDado(o: OpzioniScenario = {}): Stato {
  const mani = { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['sasso-comodo'] };
  let s = prosegui(scenario({ guaio: NEUTRO, gregge: 20, mani, ...o }));
  expect(s.fase.nome).toBe('scelta');
  s = scegli(s, { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['sasso-comodo'] });
  expect(s.fase.nome).toBe('rivelazione');
  s = prosegui(s);
  if (s.fase.nome === 'belati_punteggio') s = chiudiPunteggio(s);
  expect(s.fase.nome).toBe('dado');
  return s;
}

const lancia = (s: Stato, faccia: string): Stato => applica(conFaccia(s, faccia), { tipo: 'lanciaDado', giocatore: 'g1' });

/** Furto piccolo (ruba 2): g2 ha 2 agnellini, g3 ne ha 1 (massimi 2 e 1, totale 2). */
function alFurto(): Stato {
  return lancia(alDado({ agnellini: { g1: 3, g2: 2, g3: 1 } }), 'furto_piccolo');
}

function allaTestata(): Stato {
  return lancia(alDado(), 'testata');
}

const trova = <K extends Azione['tipo']>(azioni: Azione[], tipo: K): Extract<Azione, { tipo: K }> =>
  azioni.find((a): a is Extract<Azione, { tipo: K }> => a.tipo === tipo)!;

const pulsante = (d: Domanda, id: string) => d.pulsanti.find((p) => p.id === id);

/** La mano non è mai toccabile in nessuna domanda di questo gruppo. */
function manoSpenta(d: Domanda) {
  expect(d.carte).toEqual([]);
  expect(d.sollevate).toEqual([]);
  expect(d.trascinabili).toEqual([]);
  expect(d.guai).toEqual([]);
  expect(d.grandi).toEqual([]);
}

describe('momenti senza mano: niente da chiedere', () => {
  it('attesaBot e fine: domanda null, nessun esito', () => {
    const s = alDado();
    const m = momentoDi(s);
    const bot: Momento = { ...m, schermo: scenaProva(m.vista, 'g2') };
    expect(bot.schermo.tipo).toBe('attesaBot');
    expect(domandaDi(bot, sceltaVuota('x'))).toBeNull();
    expect(avanza(bot, sceltaVuota('x'), { tipo: 'dado' })).toEqual({ scelta: sceltaVuota('x'), esito: null });
    const fine: Momento = { ...m, schermo: { tipo: 'fine' } };
    expect(domandaDi(fine, sceltaVuota('x'))).toBeNull();
  });

  it('le schermate private hanno la domanda di carte.ts: con la mano coperta niente carte e nessun esito dai gesti sulla mano', () => {
    const s = prosegui(scenario({ guaio: NEUTRO }));
    const m = momentoDi(s);
    expect(m.schermo).toMatchObject({ tipo: 'privata', pannello: 'scelta' });
    expect(m.manoScoperta).toBe(false);
    const v = sceltaVuota(chiaveDi(m));
    expect(domandaDi(m, v)?.carte).toEqual([]);
    const r = avanza(m, v, { tipo: 'carta', carta: 'carriola#1' });
    expect(r.esito).toBeNull();
    expect(r.scelta).toBe(v);
  });
});

describe('automatica', () => {
  it('Guaio del round: scritta del pannello, niente centro, "Continua" porta il prosegui del sistema', () => {
    const s = scenario({ guaio: 'insonnia' });
    const m = momentoDi(s);
    expect(m.schermo).toEqual({ tipo: 'automatica', fase: 'guaio' });
    const d = domandaVera(m);
    expect(d.scritta).toBe(T.fasi.guaio);
    expect(d.centro).toBeNull();
    expect(d.pecore).toEqual([]);
    expect(d.dado).toBe(false);
    expect(d.furto).toBeNull();
    expect(d.testata).toBe(false);
    manoSpenta(d);
    expect(d.pulsanti).toEqual([{ id: 'continua', testo: T.azioni.continua, attivo: true }]);
    const r = tocca(m, sceltaVuota(d.chiave), { tipo: 'pulsante', id: 'continua' });
    expect(r.esito).toEqual({ tipo: 'mossa', azione: { tipo: 'prosegui' } });
    expect(r.esito?.tipo === 'mossa' && r.esito.azione).toBe(m.sistema[0]);
  });

  it('rivelazione: scritta del titolo della fase', () => {
    const mani = { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['sasso-comodo'] };
    const s = scegli(prosegui(scenario({ guaio: NEUTRO, mani })), mani);
    const d = domandaVera(momentoDi(s));
    expect(d.scritta).toBe(T.fasi.rivelazione);
    expect(d.centro).toBeNull();
  });

  it('Guaio al peggiore: la scritta è il messaggio del pannello (chi prende il Guaio)', () => {
    const s = nessunaReazione(lancia(alDado(), 'pascolo_piccolo'));
    expect(s.fase.nome).toBe('guaio_al_peggiore');
    const d = domandaVera(momentoDi(s));
    expect(d.scritta).toBe(T.guai.prende('Giocatore 3'));
    expect(d.centro).toBeNull();
    expect(d.pulsanti).toEqual([{ id: 'continua', testo: T.azioni.continua, attivo: true }]);
  });

  /** Il Guaio al peggiore con la fase costruita a mano: chi prende il Guaio, i pari merito, i partecipanti e i più alti. */
  type Chi = 'g1' | 'g2' | 'g3';
  function guaioAlPeggiore(fase: { destinatario: Chi | null; spareggio: Chi[] | null }, partecipanti: Chi[], piuAlti: Chi[]): Stato {
    const base = scenario({ guaio: NEUTRO });
    return { ...base, fase: { nome: 'guaio_al_peggiore', ...fase }, datiRound: { ...base.datiRound, partecipanti, piuAlti } };
  }

  it('Guaio al peggiore: pari merito in fondo, la scritta dice chi va allo spareggio', () => {
    const s = guaioAlPeggiore({ destinatario: null, spareggio: ['g1', 'g3'] }, ['g1', 'g2', 'g3'], ['g2']);
    expect(domandaVera(momentoDi(s)).scritta).toBe(T.guai.spareggio('Giocatore 1 e Giocatore 3'));
  });

  it('Guaio al peggiore: tutti pari (nessuno ha il punteggio più alto), niente destinatario né spareggio', () => {
    const s = guaioAlPeggiore({ destinatario: null, spareggio: null }, ['g1', 'g2', 'g3'], []);
    expect(domandaVera(momentoDi(s)).scritta).toBe(T.guai.tuttiPari);
  });

  it('Guaio al peggiore: il Guaio torna in fondo (un solo partecipante, o qualcuno con il punteggio più alto)', () => {
    const solo = guaioAlPeggiore({ destinatario: null, spareggio: null }, ['g1'], []);
    expect(domandaVera(momentoDi(solo)).scritta).toBe(T.guai.inFondo);
    const conPiuAlto = guaioAlPeggiore({ destinatario: null, spareggio: null }, ['g1', 'g2'], ['g1']);
    expect(domandaVera(momentoDi(conPiuAlto)).scritta).toBe(T.guai.inFondo);
  });

  it('"Continua" ripiega sulla scadenza dove il sistema aspetta solo quella, e preferisce il prosegui se c\'è', () => {
    const scadenza = { tipo: 'scadenza' } as Azione;
    const proseguiAzione = { tipo: 'prosegui' } as Azione;
    const base = momentoDi(scenario({ guaio: 'insonnia' }));
    const soloScadenza = { ...base, sistema: [scadenza] };
    const d = domandaVera(soloScadenza);
    expect(pulsante(d, 'continua')?.attivo).toBe(true);
    const r = tocca(soloScadenza, sceltaVuota(d.chiave), { tipo: 'pulsante', id: 'continua' });
    expect(r.esito?.tipo === 'mossa' && r.esito.azione).toBe(scadenza);
    const entrambe = { ...base, sistema: [scadenza, proseguiAzione] };
    const r2 = tocca(entrambe, sceltaVuota(chiaveDi(entrambe)), { tipo: 'pulsante', id: 'continua' });
    expect(r2.esito?.tipo === 'mossa' && r2.esito.azione).toBe(proseguiAzione);
  });

  it('"Continua" spento se il sistema non ha un prosegui da offrire', () => {
    const m = { ...momentoDi(scenario({ guaio: 'insonnia' })), sistema: [] };
    const d = domandaVera(m);
    expect(pulsante(d, 'continua')?.attivo).toBe(false);
    const r = tocca(m, sceltaVuota(d.chiave), { tipo: 'pulsante', id: 'continua' });
    expect(r.esito).toBeNull();
  });

  it('gesti su elementi non offerti: nessun esito, scelta invariata', () => {
    const m = momentoDi(scenario({ guaio: 'insonnia' }));
    const v = sceltaVuota(chiaveDi(m));
    for (const g of [
      { tipo: 'pecora', chi: 'g1' },
      { tipo: 'dado' },
      { tipo: 'carta', carta: 'carriola#1' },
      { tipo: 'pulsante', id: 'conferma' },
      { tipo: 'pulsante', id: 'nessuno' },
    ] as Gesto[]) {
      const r = tocca(m, v, g);
      expect(r.esito).toBeNull();
      expect(r.scelta).toBe(v);
    }
  });
});

describe('domanda: "Chi risponde?"', () => {
  /** Dopo la dichiarazione del furto si apre la finestra di reazione. */
  function allaReazione(): Stato {
    const s = alFurto();
    return applica(s, azioniPossibili(s, 'g1').find((a) => a.tipo === 'dichiaraDado')!);
  }

  it('reazione: la mossa a cui si risponde più la scritta, candidati illuminati, "Nessuno" è la scadenza', () => {
    const s = allaReazione();
    const m = momentoDi(s);
    expect(m.schermo).toMatchObject({ tipo: 'domanda', contesto: 'reazione' });
    const d = domandaVera(m);
    const cima = m.vista.pila[m.vista.pila.length - 1]!;
    expect(cima).toBeDefined();
    expect(d.scritta).toContain(T.scena.scelte.chiRisponde);
    expect(d.scritta.length).toBeGreaterThan(T.scena.scelte.chiRisponde.length);
    expect(d.pecore).toEqual(m.schermo.tipo === 'domanda' ? m.schermo.candidati : []);
    expect(d.pecore.length).toBeGreaterThan(0);
    expect(d.dado).toBe(false);
    expect(d.centro).toBeNull();
    expect(d.furto).toBeNull();
    manoSpenta(d);
    expect(d.pulsanti).toEqual([{ id: 'nessuno', testo: T.azioni.nessuno, attivo: true }]);
    const r = tocca(m, sceltaVuota(d.chiave), { tipo: 'pulsante', id: 'nessuno' });
    expect(r.esito).toEqual({ tipo: 'mossa', azione: { tipo: 'scadenza' } });
    expect(r.esito?.tipo === 'mossa' && r.esito.azione).toBe(m.sistema[0]);
  });

  it('toccando una pecora candidata: risponde', () => {
    const s = allaReazione();
    const m = momentoDi(s);
    const d = domandaVera(m);
    const chi = d.pecore[0]!;
    const v = sceltaVuota(d.chiave);
    expect(tocca(m, v, { tipo: 'pecora', chi }).esito).toEqual({ tipo: 'risponde', chi });
  });

  it('una pecora non candidata (l\'autore della mossa), il dado o una carta non fanno niente', () => {
    const s = allaReazione();
    const m = momentoDi(s);
    const d = domandaVera(m);
    expect(d.pecore).not.toContain('g1');
    const v = sceltaVuota(d.chiave);
    for (const g of [{ tipo: 'pecora', chi: 'g1' }, { tipo: 'dado' }, { tipo: 'carta', carta: 'carriola#1' }] as Gesto[]) {
      const r = tocca(m, v, g);
      expect(r.esito).toBeNull();
      expect(r.scelta).toBe(v);
    }
  });

  it('Belati di punteggio: scritta del punteggio, candidati della fase, "Nessuno" è la scadenza', () => {
    let s = prosegui(scenario({ guaio: NEUTRO, mani: { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['sasso-comodo'] } }));
    s = scegli(s, { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['sasso-comodo'] });
    s = prosegui(s);
    expect(s.fase.nome).toBe('belati_punteggio');
    const m = momentoDi(s);
    expect(m.schermo).toMatchObject({ tipo: 'domanda', contesto: 'punteggio' });
    const d = domandaVera(m);
    expect(d.scritta).toBe(T.scena.scelte.chiPunteggio);
    expect(d.pecore).toEqual(m.schermo.tipo === 'domanda' ? m.schermo.candidati : []);
    expect(d.pecore.length).toBeGreaterThan(0);
    expect(d.centro).toBeNull();
    const r = tocca(m, sceltaVuota(d.chiave), { tipo: 'pulsante', id: 'nessuno' });
    expect(r.esito?.tipo === 'mossa' && r.esito.azione).toBe(m.sistema.find((a) => a.tipo === 'scadenza'));
    expect(r.esito).toEqual({ tipo: 'mossa', azione: { tipo: 'scadenza' } });
  });
});

describe('tocco sul prato (ruling E)', () => {
  it('senza carte sollevate né carta in attesa: stessa scelta, nessun esito (anche nelle domande pubbliche)', () => {
    const m = momentoDi(alDado());
    const v = sceltaVuota(chiaveDi(m));
    const r = avanza(m, v, { tipo: 'prato' });
    expect(r.esito).toBeNull();
    expect(r.scelta).toBe(v);
  });
});

describe('pubblica: dado', () => {
  it('scritta "tocca il dado", dado acceso, mano spenta; il gesto dado dà la mossa lanciaDado permessa', () => {
    const s = alDado();
    const m = momentoDi(s);
    expect(m.schermo).toEqual({ tipo: 'pubblica', giocatore: 'g1', pannello: 'lancio' });
    const d = domandaVera(m);
    expect(d.scritta).toBe(T.dado.tocca('Giocatore 1'));
    expect(d.avvisi).toEqual([]);
    expect(d.dado).toBe(true);
    expect(d.pecore).toEqual([]);
    expect(d.centro).toBeNull();
    expect(d.testata).toBe(false);
    expect(d.pulsanti).toEqual([]);
    manoSpenta(d);
    const r = tocca(m, sceltaVuota(d.chiave), { tipo: 'dado' });
    expect(r.esito?.tipo === 'mossa' && r.esito.azione).toBe(trova(m.azioni, 'lanciaDado'));
  });

  it('più lanciatori (pari merito): l\'avviso "pari" accanto alla scritta', () => {
    const mani = { g1: ['carriola'], g2: ['carriola'], g3: ['sasso-comodo'] };
    let s = prosegui(scenario({ guaio: NEUTRO, mani }));
    s = scegli(s, { g1: ['carriola'], g2: ['carriola'], g3: ['sasso-comodo'] });
    s = prosegui(s);
    if (s.fase.nome === 'belati_punteggio') s = chiudiPunteggio(s);
    expect(s.datiRound.lanciatori.length).toBe(2);
    const d = domandaVera(momentoDi(s));
    expect(d.avvisi).toEqual([T.dado.pari]);
  });

  it('gesti su elementi non offerti (pecora, carta, pulsanti): nessun esito', () => {
    const m = momentoDi(alDado());
    const v = sceltaVuota(chiaveDi(m));
    for (const g of [
      { tipo: 'pecora', chi: 'g2' },
      { tipo: 'agnellino', chi: 'g2' },
      { tipo: 'carta', carta: 'carriola#1' },
      { tipo: 'pulsante', id: 'conferma' },
    ] as Gesto[]) {
      const r = tocca(m, v, g);
      expect(r.esito).toBeNull();
      expect(r.scelta).toBe(v);
    }
  });

  it('il dado non risponde se il motore non offre lanciaDado', () => {
    const m: Momento = { ...momentoDi(alDado()), azioni: [] };
    const d = domandaVera(m);
    expect(d.dado).toBe(false);
    expect(tocca(m, sceltaVuota(d.chiave), { tipo: 'dado' }).esito).toBeNull();
  });
});

describe('pubblica: dichiarazione del furto', () => {
  const furti = (m: Momento) => m.azioni.filter((a): a is Extract<Azione, { tipo: 'dichiaraDado' }> => a.tipo === 'dichiaraDado');

  it('pecore = avversari con massimo > 0, scritta "Ruba ancora N", Conferma spenta, Annulla spenta', () => {
    const m = momentoDi(alFurto());
    expect(m.schermo).toEqual({ tipo: 'pubblica', giocatore: 'g1', pannello: 'dichiarazione' });
    expect(furti(m).length).toBeGreaterThan(1);
    const d = domandaVera(m);
    expect(d.pecore.sort()).toEqual(['g2', 'g3']);
    expect(d.scritta).toBe(T.scena.scelte.rubaAncora(2));
    expect(d.furto).toEqual({ presi: {} });
    expect(d.dado).toBe(false);
    expect(d.testata).toBe(false);
    expect(d.centro).toBeNull();
    manoSpenta(d);
    expect(pulsante(d, 'conferma')).toEqual({ id: 'conferma', testo: T.azioni.conferma, attivo: false });
    expect(pulsante(d, 'annulla')).toMatchObject({ id: 'annulla', testo: T.azioni.annulla, attivo: false, secondario: true });
  });

  it('con massimi 2 e 1 e totale 2: tre tocchi su g2 lasciano 2 (il terzo non fa niente); agnellino(g2) torna a 1', () => {
    const m = momentoDi(alFurto());
    let s = sceltaVuota(chiaveDi(m));
    s = tocca(m, s, { tipo: 'pecora', chi: 'g2' }).scelta;
    expect(s.furto).toEqual({ g2: 1 });
    s = tocca(m, s, { tipo: 'pecora', chi: 'g2' }).scelta;
    expect(s.furto).toEqual({ g2: 2 });
    const terzo = tocca(m, s, { tipo: 'pecora', chi: 'g2' });
    expect(terzo.esito).toBeNull();
    expect(terzo.scelta).toBe(s);
    expect(terzo.scelta.furto).toEqual({ g2: 2 });
    const giu = tocca(m, s, { tipo: 'agnellino', chi: 'g2' });
    expect(giu.scelta.furto).toEqual({ g2: 1 });
    expect(giu.esito).toBeNull();
  });

  it('raggiunto il totale il furto si ferma: nemmeno un avversario con altri agnellini a disposizione ne cede ancora', () => {
    const m = momentoDi(alFurto());
    let s = sceltaVuota(chiaveDi(m));
    s = tocca(m, s, { tipo: 'pecora', chi: 'g2' }).scelta;
    s = tocca(m, s, { tipo: 'pecora', chi: 'g3' }).scelta;
    expect(s.furto).toEqual({ g2: 1, g3: 1 });
    const oltre = tocca(m, s, { tipo: 'pecora', chi: 'g2' });
    expect(oltre.scelta).toBe(s);
    // g3 ha massimo 1: già al massimo
    expect(tocca(m, s, { tipo: 'pecora', chi: 'g3' }).scelta).toBe(s);
    expect(domandaVera(m, s).scritta).toBe(T.scena.scelte.rubaAncora(0));
    expect(domandaVera(m, s).scritta).toBe('Tocca Conferma');
  });

  it('agnellino su chi non ne ha di presi: niente', () => {
    const m = momentoDi(alFurto());
    const v = sceltaVuota(chiaveDi(m));
    const r = tocca(m, v, { tipo: 'agnellino', chi: 'g2' });
    expect(r.scelta).toBe(v);
    expect(r.esito).toBeNull();
  });

  it('Conferma è attivo solo su una divisione permessa e dà quella mossa (stesso oggetto)', () => {
    const m = momentoDi(alFurto());
    let s = sceltaVuota(chiaveDi(m));
    // uno solo: non è una divisione permessa
    s = tocca(m, s, { tipo: 'pecora', chi: 'g2' }).scelta;
    expect(pulsante(domandaVera(m, s), 'conferma')?.attivo).toBe(false);
    expect(tocca(m, s, { tipo: 'pulsante', id: 'conferma' }).esito).toBeNull();
    // 1 + 1
    s = tocca(m, s, { tipo: 'pecora', chi: 'g3' }).scelta;
    expect(pulsante(domandaVera(m, s), 'conferma')?.attivo).toBe(true);
    const r = tocca(m, s, { tipo: 'pulsante', id: 'conferma' });
    const attesa = furti(m).find((a) => a.furto!.g2 === 1 && a.furto!.g3 === 1);
    expect(attesa).toBeDefined();
    expect(r.esito?.tipo === 'mossa' && r.esito.azione).toBe(attesa);
    // 2 + 0
    let t = sceltaVuota(chiaveDi(m));
    t = tocca(m, t, { tipo: 'pecora', chi: 'g2' }).scelta;
    t = tocca(m, t, { tipo: 'pecora', chi: 'g2' }).scelta;
    const r2 = tocca(m, t, { tipo: 'pulsante', id: 'conferma' });
    expect(r2.esito?.tipo === 'mossa' && r2.esito.azione).toBe(furti(m).find((a) => a.furto!.g2 === 2 && (a.furto!.g3 ?? 0) === 0));
  });

  it('Annulla azzera i presi e non manda nessuna mossa', () => {
    const m = momentoDi(alFurto());
    let s = sceltaVuota(chiaveDi(m));
    s = tocca(m, s, { tipo: 'pecora', chi: 'g2' }).scelta;
    s = tocca(m, s, { tipo: 'pecora', chi: 'g3' }).scelta;
    const d = domandaVera(m, s);
    expect(d.furto).toEqual({ presi: { g2: 1, g3: 1 } });
    expect(pulsante(d, 'annulla')?.attivo).toBe(true);
    const r = tocca(m, s, { tipo: 'pulsante', id: 'annulla' });
    expect(r.esito).toBeNull();
    expect(r.scelta.furto).toEqual({});
    expect(r.scelta.chiave).toBe(s.chiave);
    expect(domandaVera(m, r.scelta).furto).toEqual({ presi: {} });
  });

  it('gesti su elementi non offerti (il lanciatore stesso, dado, carte): nessun esito', () => {
    const m = momentoDi(alFurto());
    const v = sceltaVuota(chiaveDi(m));
    for (const g of [
      { tipo: 'pecora', chi: 'g1' },
      { tipo: 'dado' },
      { tipo: 'carta', carta: 'carriola#1' },
      { tipo: 'pulsante', id: 'nessuno' },
    ] as Gesto[]) {
      const r = tocca(m, v, g);
      expect(r.esito).toBeNull();
      expect(r.scelta).toBe(v);
    }
  });
});

describe('pubblica: Testata', () => {
  it('dichiarazione: pecore = bersagli permessi, scritta del titolo; il tocco dà la mossa di quel bersaglio', () => {
    const m = momentoDi(allaTestata());
    expect(m.schermo).toEqual({ tipo: 'pubblica', giocatore: 'g1', pannello: 'dichiarazione' });
    const d = domandaVera(m);
    expect(d.scritta).toBe(T.dado.testataTitolo);
    expect(d.pecore.sort()).toEqual(['g2', 'g3']);
    expect(d.furto).toBeNull();
    expect(d.pulsanti).toEqual([]);
    expect(d.testata).toBe(false);
    manoSpenta(d);
    const r = tocca(m, sceltaVuota(d.chiave), { tipo: 'pecora', chi: 'g3' });
    expect(r.esito?.tipo === 'mossa' && r.esito.azione).toBe(m.azioni.find((a) => a.tipo === 'dichiaraDado' && a.bersaglio === 'g3'));
  });

  it('dichiarazione senza furto né bersagli (nessuna mossa permessa): nessuna domanda, non il titolo della Testata senza pecore', () => {
    const m = { ...momentoDi(allaTestata()), azioni: [] };
    expect(m.schermo).toEqual({ tipo: 'pubblica', giocatore: 'g1', pannello: 'dichiarazione' });
    expect(domandaDi(m, sceltaVuota(chiaveDi(m)))).toBeNull();
    const r = tocca(m, sceltaVuota(chiaveDi(m)), { tipo: 'pecora', chi: 'g2' });
    expect(r.esito).toBeNull();
  });

  it('un bersaglio non permesso (il lanciatore) o altri gesti: nessun esito', () => {
    const m = momentoDi(allaTestata());
    const v = sceltaVuota(chiaveDi(m));
    for (const g of [{ tipo: 'pecora', chi: 'g1' }, { tipo: 'dado' }, { tipo: 'agnellino', chi: 'g2' }] as Gesto[]) {
      const r = tocca(m, v, g);
      expect(r.esito).toBeNull();
      expect(r.scelta).toBe(v);
    }
  });

  it('il riquadro di mira: testata acceso, niente gesti nella scena', () => {
    let s = allaTestata();
    s = nessunaReazione(applica(s, azioniPossibili(s, 'g1').find((a) => a.tipo === 'dichiaraDado')!));
    const m = momentoDi(s);
    expect(m.schermo).toEqual({ tipo: 'pubblica', giocatore: 'g1', pannello: 'testata' });
    const d = domandaVera(m);
    expect(d.scritta).toBe(T.testata.titolo);
    expect(d.testata).toBe(true);
    expect(d.pecore).toEqual([]);
    expect(d.dado).toBe(false);
    expect(d.pulsanti).toEqual([]);
    manoSpenta(d);
    const v = sceltaVuota(d.chiave);
    for (const g of [
      { tipo: 'pecora', chi: 'g2' },
      { tipo: 'dado' },
      { tipo: 'pulsante', id: 'conferma' },
      { tipo: 'carta', carta: 'carriola#1' },
    ] as Gesto[]) {
      const r = tocca(m, v, g);
      expect(r.esito).toBeNull();
      expect(r.scelta).toBe(v);
    }
  });
});

describe('chiaveDi', () => {
  it('non cambia ricalcolando lo stesso momento', () => {
    const s = alFurto();
    expect(chiaveDi(momentoDi(s))).toBe(chiaveDi(momentoDi(s)));
    expect(chiaveDi(momentoDi(s))).toBe(chiaveDi(momentoDi(structuredClone(s))));
  });

  it('cambia se cambiano le mosse permesse', () => {
    const m = momentoDi(alFurto());
    const meno: Momento = { ...m, azioni: m.azioni.slice(1) };
    expect(chiaveDi(meno)).not.toBe(chiaveDi(m));
    const senzaSistema: Momento = { ...momentoDi(scenario({ guaio: 'insonnia' })), sistema: [] };
    expect(chiaveDi(senzaSistema)).not.toBe(chiaveDi(momentoDi(scenario({ guaio: 'insonnia' }))));
  });

  it('cambia con lo schermo (stesso stato, altra schermata)', () => {
    const s = alDado();
    const m = momentoDi(s);
    const altro: Momento = { ...m, schermo: { tipo: 'pubblica', giocatore: 'g2', pannello: 'lancio' } };
    expect(chiaveDi(altro)).not.toBe(chiaveDi(m));
  });

  it('la domanda porta la stessa chiave del momento, e sceltaVuota è vuota', () => {
    const m = momentoDi(alFurto());
    const k = chiaveDi(m);
    expect(domandaVera(m).chiave).toBe(k);
    expect(sceltaVuota(k)).toEqual({ chiave: k, carte: [], carta: null, furto: {}, guaio: null });
  });
});

