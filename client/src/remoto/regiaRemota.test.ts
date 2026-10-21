// Regia a più dispositivi: pannello giusto per chi deve agire, attesa per gli altri.
import { describe, expect, it } from 'vitest';
import { applica, azioniPossibili, vistaPer } from '../../../engine/src';
import type { Azione, IdGiocatore, Stato } from '../../../engine/src';
import { avanza, carta, chiudiPunteggio, conFaccia, nessunaReazione, prosegui, scegli, scenario } from '../../../engine/test/aiuti';
import { chiaveDi, domandaDi, sceltaVuota } from '../scena/scelte/domanda';
import type { Momento } from '../scena/scelte/tipi';
import { T } from '../testi';
import { momentoRemoto, scenaRemota, scrittaAttesa } from './regiaRemota';
import type { ScenaRemota } from './regiaRemota';

const per = (s: Stato, io: IdGiocatore) => scenaRemota(vistaPer(s, io), io, azioniPossibili(s, io));

function alPunteggio(): Stato {
  const s = prosegui(
    scenario({
      guaio: 'tosatura-a-sorpresa',
      mani: { g1: ['carriola', 'beee-no'], g2: ['balla-di-fieno'], g3: ['sasso-comodo', 'belato-di-gruppo'] },
    }),
  );
  return avanza(scegli(s, { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['sasso-comodo'] }));
}

describe('regia remota', () => {
  it('fasi automatiche: tutti vedono la stessa schermata', () => {
    expect(per(scenario(), 'g2')).toEqual({ tipo: 'automatica' });
  });

  it('scelta: chi non ha ancora scelto (o vuole cambiare) ha il pannello; gli altri aspettano', () => {
    const s = prosegui(scenario({ mani: { g1: ['carriola'], g2: ['carriola'], g3: ['carriola'] } }));
    expect(per(s, 'g2')).toEqual({ tipo: 'pannello', pannello: 'scelta' });
  });

  it('Belati di punteggio: pannello per chi è in attesa, attesa con finestra per chi ha passato', () => {
    const s = alPunteggio();
    expect(per(s, 'g3')).toEqual({ tipo: 'pannello', pannello: 'punteggio' });
    const dopo = applica(s, { tipo: 'passa', giocatore: 'g3' });
    expect(per(dopo, 'g3')).toEqual({ tipo: 'attesa', di: ['g1', 'g2'], finestra: true });
  });

  it("dichiarazione: chi può reagire vede il pannello di reazione, l'autore aspetta", () => {
    const s = alPunteggio();
    const s2 = applica(s, { tipo: 'giocaBelato', giocatore: 'g3', carta: carta(s, 'g3', 'belato-di-gruppo'), bersaglio: 'g3' });
    expect(per(s2, 'g1')).toEqual({ tipo: 'pannello', pannello: 'reazione' });
    expect(per(s2, 'g3')).toEqual({ tipo: 'attesa', di: ['g1', 'g2'], finestra: true });
  });

  it('dado: il lanciatore lancia, gli altri aspettano lui', () => {
    const s = chiudiPunteggio(alPunteggio());
    expect(per(s, 'g1')).toEqual({ tipo: 'pannello', pannello: 'lancio' });
    expect(per(s, 'g2')).toEqual({ tipo: 'attesa', di: ['g1'], finestra: false });
    const t = applica(conFaccia(s, 'testata'), { tipo: 'lanciaDado', giocatore: 'g1' });
    expect(per(t, 'g1')).toEqual({ tipo: 'pannello', pannello: 'dichiarazione' });
  });
});

// ─── Lo schermo della stanza come momento delle domande ──────────────────────

/** Come la stanza costruisce il momento di un telefono: vista privata di `io`, vista del tavolo, mosse di `io`. */
function dellaStanza(s: Stato, io: IdGiocatore) {
  const vistaIo = vistaPer(s, io);
  const tavolo = vistaPer(s, null);
  const azioni = azioniPossibili(s, io);
  const sc = scenaRemota(vistaIo, io, azioni);
  return { sc, vistaIo, tavolo, azioni, momento: momentoRemoto(sc, io, vistaIo, tavolo, azioni) };
}

/** La domanda a scelta vuota c'è sempre e non offre mai "Nessuno". */
function domandaDelTelefono(m: Momento) {
  const d = domandaDi(m, sceltaVuota(chiaveDi(m)));
  expect(d).not.toBeNull();
  const ids = d!.pulsanti.map((p) => p.id);
  expect(ids).not.toContain('nessuno');
  return { d: d!, ids };
}

const NEUTRO = 'tosatura-a-sorpresa';
type Scelte = Record<IdGiocatore, string[]>;

function finoAgliEffetti(opzioni: Parameters<typeof scenario>[0], scelte: Scelte): Stato {
  return prosegui(scegli(prosegui(scenario(opzioni)), scelte));
}

function alDado(): Stato {
  let s = prosegui(
    scenario({ guaio: NEUTRO, mani: { g1: ['carriola'], g2: ['balla-di-fieno', 'beee-no'], g3: ['coperta-di-lana'] } }),
  );
  s = prosegui(scegli(s, { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['coperta-di-lana'] }));
  if (s.fase.nome === 'belati_punteggio') s = chiudiPunteggio(s);
  expect(s.fase.nome).toBe('dado');
  return s;
}

function dopoIlDado(s: Stato): Stato {
  for (let giri = 0; giri < 10; giri++) {
    const f = s.fase;
    if (f.nome !== 'dado') return s;
    const chi = s.datiRound.lanciatori[f.indice]!;
    s = nessunaReazione(applica(conFaccia(s, 'pascolo_piccolo'), { tipo: 'lanciaDado', giocatore: chi }));
  }
  throw new Error('troppi lanci');
}

function alSalvataggio(): Stato {
  const s = prosegui(dopoIlDado(alDado()));
  expect(s.fase).toEqual({ nome: 'belati_salvataggio', destinatario: 'g2' });
  return s;
}

function alBelatoFinale(): Stato {
  let s = prosegui(
    scenario({
      guaio: NEUTRO,
      mani: {
        g1: ['carriola'],
        g2: ['balla-di-fieno', 'coperta-di-lana', 'sasso-comodo'],
        g3: ['balla-di-fieno', 'carriola', 'corona-di-margherite'],
      },
    }),
  );
  s = prosegui(scegli(s, { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['balla-di-fieno'] }));
  if (s.fase.nome === 'belati_punteggio') s = chiudiPunteggio(s);
  s = prosegui(dopoIlDado(s));
  expect(s.fase.nome).toBe('belato_finale');
  return s;
}

function quattroConCampanaccio(): Stato {
  const mani: Scelte = { g1: ['campanaccio-stonato'], g2: ['carriola'], g3: ['sasso-comodo'], g4: ['balla-di-fieno'] };
  return finoAgliEffetti({ giocatori: 4, guaio: NEUTRO, agnellini: { g1: 3, g2: 3, g3: 0, g4: 1 }, mani }, mani);
}

describe('momentoRemoto', () => {
  const comuni = { condiviso: false, manoScoperta: true, sistema: [] as Azione[] };

  it('scelta: schermo privato di io, vista con la sua mano, niente Annulla', () => {
    const s = prosegui(scenario({ guaio: NEUTRO, mani: { g1: ['carriola'], g2: ['carriola'], g3: ['carriola'] } }));
    const r = dellaStanza(s, 'g2');
    expect(r.momento).toEqual({
      ...comuni,
      vista: r.vistaIo,
      schermo: { tipo: 'privata', giocatore: 'g2', pannello: 'scelta' },
      azioni: r.azioni,
    });
    expect(r.vistaIo.giocatori.find((g) => g.id === 'g2')!.mano?.length ?? 0).toBeGreaterThan(0);
    expect(domandaDelTelefono(r.momento!).ids).not.toContain('annulla');
  });

  it('effetto: privato di io; chi non è di turno aspetta', () => {
    const s = quattroConCampanaccio();
    const r = dellaStanza(s, 'g1');
    expect(r.momento?.schermo).toEqual({ tipo: 'privata', giocatore: 'g1', pannello: 'effetto' });
    expect(r.momento?.vista).toBe(r.vistaIo);
    expect(domandaDelTelefono(r.momento!).ids).not.toContain('annulla');
    expect(dellaStanza(s, 'g2').momento).toBeNull();
  });

  it('richiesta: privato di io', () => {
    const mani: Scelte = { g1: ['cannocchiale', 'carriola'], g2: ['sasso-comodo'], g3: ['balla-di-fieno'] };
    let s = finoAgliEffetti({ guaio: NEUTRO, mazzo: ['corona-di-margherite', 'trifoglio-qualunque', 'ombrello-bucato'], mani }, { g1: ['cannocchiale'], g2: ['sasso-comodo'], g3: ['balla-di-fieno'] });
    const f = s.fase;
    if (f.nome !== 'effetti') throw new Error('fase attesa effetti');
    const voce = f.coda[f.indice]!;
    s = nessunaReazione(applica(s, { tipo: 'attivaEffetto', giocatore: voce.giocatore, carta: voce.carta }));
    const r = dellaStanza(s, 'g1');
    expect(r.momento?.schermo).toEqual({ tipo: 'privata', giocatore: 'g1', pannello: 'richiesta' });
    expect(domandaDelTelefono(r.momento!).d.grandi).toHaveLength(2);
    expect(dellaStanza(s, 'g2').momento).toBeNull();
  });

  it('reazione: privato di io (Beee-NO!), senza Annulla; chi ha dichiarato aspetta', () => {
    const s = applica(conFaccia(alDado(), 'pascolo_piccolo'), { tipo: 'lanciaDado', giocatore: 'g1' });
    const r = dellaStanza(s, 'g2');
    expect(r.momento?.schermo).toEqual({ tipo: 'privata', giocatore: 'g2', pannello: 'reazione' });
    expect(r.momento?.vista).toBe(r.vistaIo);
    const { d, ids } = domandaDelTelefono(r.momento!);
    expect(ids).toEqual(['gioca', 'passo']);
    expect(d.carte.length).toBeGreaterThan(0);
    expect(dellaStanza(s, 'g1').momento).toBeNull();
  });

  it('punteggio: privato di io, senza Annulla; dopo "Passo" si aspetta', () => {
    const s = alPunteggio();
    const r = dellaStanza(s, 'g3');
    expect(r.momento?.schermo).toEqual({ tipo: 'privata', giocatore: 'g3', pannello: 'punteggio' });
    expect(domandaDelTelefono(r.momento!).ids).toEqual(['gioca', 'passo']);
    expect(dellaStanza(applica(s, { tipo: 'passa', giocatore: 'g3' }), 'g3').momento).toBeNull();
  });

  it('Belato finale: privato di io', () => {
    const r = dellaStanza(alBelatoFinale(), 'g2');
    expect(r.momento?.schermo).toEqual({ tipo: 'privata', giocatore: 'g2', pannello: 'belato_finale' });
    domandaDelTelefono(r.momento!);
  });

  it('salvataggio e consolazione: privato del destinatario', () => {
    const sv = alSalvataggio();
    const r = dellaStanza(sv, 'g2');
    expect(r.momento?.schermo).toEqual({ tipo: 'privata', giocatore: 'g2', pannello: 'salvataggio' });
    expect(domandaDelTelefono(r.momento!).ids).not.toContain('annulla');
    const co = applica(sv, { tipo: 'passa', giocatore: 'g2', voce: null });
    const c = dellaStanza(co, 'g2');
    expect(c.momento?.schermo).toEqual({ tipo: 'privata', giocatore: 'g2', pannello: 'consolazione' });
    domandaDelTelefono(c.momento!);
  });

  it('lancio: pubblico, vista del tavolo, il dado è toccabile; gli altri aspettano', () => {
    const s = alDado();
    const r = dellaStanza(s, 'g1');
    expect(r.momento).toEqual({
      ...comuni,
      vista: r.tavolo,
      schermo: { tipo: 'pubblica', giocatore: 'g1', pannello: 'lancio' },
      azioni: r.azioni,
    });
    expect(domandaDelTelefono(r.momento!).d.dado).toBe(true);
    expect(dellaStanza(s, 'g2').momento).toBeNull();
  });

  it('dichiarazione e testata: pubblici, vista del tavolo', () => {
    const lanciata = applica(conFaccia(alDado(), 'testata'), { tipo: 'lanciaDado', giocatore: 'g1' });
    const d = dellaStanza(lanciata, 'g1');
    expect(d.momento?.schermo).toEqual({ tipo: 'pubblica', giocatore: 'g1', pannello: 'dichiarazione' });
    expect(d.momento?.vista).toBe(d.tavolo);
    expect(domandaDelTelefono(d.momento!).d.pecore.length).toBeGreaterThan(0);

    const dichiara = d.azioni.find((a) => a.tipo === 'dichiaraDado' && a.bersaglio !== undefined)!;
    const t = dellaStanza(nessunaReazione(applica(lanciata, dichiara)), 'g1');
    expect(t.momento?.schermo).toEqual({ tipo: 'pubblica', giocatore: 'g1', pannello: 'testata' });
    expect(t.momento?.vista).toBe(t.tavolo);
    expect(domandaDelTelefono(t.momento!).d.testata).toBe(true);
  });

  it("furto: Annulla c'è ma è spento a scelta vuota", () => {
    const r = dellaStanza(applica(conFaccia(alDado(), 'furto_piccolo'), { tipo: 'lanciaDado', giocatore: 'g1' }), 'g1');
    expect(r.momento?.schermo).toEqual({ tipo: 'pubblica', giocatore: 'g1', pannello: 'dichiarazione' });
    const { d } = domandaDelTelefono(r.momento!);
    expect(d.pulsanti.find((p) => p.id === 'annulla')?.attivo ?? false).toBe(false);
  });

  it('una domanda privata porta solo la mano del telefono, una pubblica nessuna mano', () => {
    // Privata: la scelta di g2 (ognuno ha una mano) e il punteggio di g3 (mani diverse da quella di chi guarda)
    const scelta = prosegui(scenario({ guaio: NEUTRO, mani: { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['sasso-comodo'] } }));
    for (const [stato, io] of [
      [scelta, 'g2'],
      [alPunteggio(), 'g3'],
    ] as const) {
      const r = dellaStanza(stato, io);
      expect(r.momento?.schermo.tipo).toBe('privata');
      const mani = Object.fromEntries(r.momento!.vista.giocatori.map((g) => [g.id, g.mano]));
      expect(mani[io], "la mano del telefono c'è").not.toBeNull();
      expect(mani[io]!.length).toBeGreaterThan(0);
      for (const [id, mano] of Object.entries(mani)) if (id !== io) expect(mano, 'la mano di ' + id).toBeNull();
    }
    // Pubblica: dado, dichiarazione e Testata non portano nessuna mano, nemmeno quella di chi gioca
    const lanciata = applica(conFaccia(alDado(), 'testata'), { tipo: 'lanciaDado', giocatore: 'g1' });
    const dichiara = azioniPossibili(lanciata, 'g1').find((a) => a.tipo === 'dichiaraDado' && a.bersaglio !== undefined)!;
    const testata = nessunaReazione(applica(lanciata, dichiara));
    for (const stato of [alDado(), lanciata, testata]) {
      const r = dellaStanza(stato, 'g1');
      expect(r.momento?.schermo.tipo).toBe('pubblica');
      expect(r.momento!.vista.giocatori.every((g) => g.mano === null)).toBe(true);
    }
  });

  it('attesa, automatica e fine: nessun momento (in stanza avanza chi ospita)', () => {
    const s = alDado();
    const a = dellaStanza(s, 'g2');
    expect(a.sc.tipo).toBe('attesa');
    expect(a.momento).toBeNull();
    const auto = dellaStanza(scenario(), 'g2');
    expect(auto.sc).toEqual({ tipo: 'automatica' });
    expect(auto.momento).toBeNull();
    expect(momentoRemoto({ tipo: 'fine' }, 'g2', vistaPer(s, 'g2'), vistaPer(s, null), [])).toBeNull();
  });
});

describe('scrittaAttesa', () => {
  it('finestra di reazione: "In attesa delle reazioni…"', () => {
    const s = applica(conFaccia(alDado(), 'pascolo_piccolo'), { tipo: 'lanciaDado', giocatore: 'g1' });
    const r = dellaStanza(s, 'g1');
    expect(r.sc).toEqual({ tipo: 'attesa', di: ['g2', 'g3'], finestra: true });
    expect(scrittaAttesa(r.sc, r.tavolo)).toBe(T.stanza.attesaReazioni);
  });

  it('Belati di punteggio: chi ha passato aspetta con il testo delle reazioni, il primo a passare e anche il secondo', () => {
    let s = alPunteggio();
    s = applica(s, { tipo: 'passa', giocatore: 'g3' });
    for (const io of ['g3'] as const) {
      const r = dellaStanza(s, io);
      expect(r.sc).toEqual({ tipo: 'attesa', di: ['g1', 'g2'], finestra: true });
      expect(scrittaAttesa(r.sc, r.tavolo)).toBe(T.stanza.attesaReazioni);
    }
    // Anche chi non è l'ultimo a passare: la finestra dei Belati è la stessa per tutti
    s = applica(s, { tipo: 'passa', giocatore: 'g1' });
    const g1 = dellaStanza(s, 'g1');
    expect(g1.sc).toMatchObject({ tipo: 'attesa', finestra: true });
    expect(scrittaAttesa(g1.sc, g1.tavolo)).toBe(T.stanza.attesaReazioni);
  });

  it('scelta e Belato finale: "Gli altri stanno scegliendo…"', () => {
    const sc: ScenaRemota = { tipo: 'attesa', di: ['g1'], finestra: false };
    const scelta = prosegui(scenario({ mani: { g1: ['carriola'], g2: ['carriola'], g3: ['carriola'] } }));
    expect(scrittaAttesa(sc, vistaPer(scelta, null))).toBe(T.stanza.attesaScelte);
    expect(scrittaAttesa(sc, vistaPer(alBelatoFinale(), null))).toBe(T.stanza.attesaScelte);
  });

  it('dado: "Giocatore 1 lancia il dado…"', () => {
    const r = dellaStanza(alDado(), 'g2');
    expect(scrittaAttesa(r.sc, r.tavolo)).toBe(T.stanza.lancioDi('Giocatore 1'));
  });

  it('Testata: chi prende la mira e su chi', () => {
    const s0 = applica(conFaccia(alDado(), 'testata'), { tipo: 'lanciaDado', giocatore: 'g1' });
    const dichiara = azioniPossibili(s0, 'g1').find((a) => a.tipo === 'dichiaraDado' && a.bersaglio === 'g2')!;
    const s = nessunaReazione(applica(s0, dichiara));
    const sc: ScenaRemota = { tipo: 'attesa', di: ['g1'], finestra: false };
    expect(scrittaAttesa(sc, vistaPer(s, null))).toBe(T.stanza.testataDi('Giocatore 1', 'Giocatore 2'));
  });

  it('altre fasi: "Tocca a Giocatore 1…"', () => {
    const r = dellaStanza(quattroConCampanaccio(), 'g2');
    expect(r.sc).toEqual({ tipo: 'attesa', di: ['g1'], finestra: false });
    expect(scrittaAttesa(r.sc, r.tavolo)).toBe(T.stanza.attesaDi('Giocatore 1'));
  });

  it('schermi senza attesa: scritta vuota', () => {
    const r = dellaStanza(alDado(), 'g1');
    expect(scrittaAttesa(r.sc, r.tavolo)).toBe('');
  });
});
