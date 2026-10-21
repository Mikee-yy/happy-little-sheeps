// @vitest-environment jsdom
// Prove del regista: recita le battute del copione con gli ordini del teatro, dice quando è "occupato",
// tempo massimo per battuta, messa in pari "subito" (troppe battute, allinea da fuori, ricostruzione) e distruzione.
// Ciclo manuale, senza giochi; senza ambiente salvo i meteo lunghi (senza ambiente la nebbia finisce subito).
// Gli eventi vengono da partite vere giocate con il motore.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applica, nuovaPartita, SETUP, vistaPer } from '../../../../engine/src';
import type { IdCarta, IdGiocatore, Stato, Vista } from '../../../../engine/src';
import { generatore } from '../../../../engine/sim/simulatore';
import { chiudiPunteggio, conFaccia, nessunaReazione, prosegui, scegli, scenario } from '../../../../engine/test/aiuti';
import { casoConSeme, mossaDelBot } from '../aiuti-prova';
import { fotografia, type Fotografia } from '../fotografia';
import { cambiaOpzione, opzioni } from '../servizi/opzioni';
import { creaTeatro, type Teatro } from '../teatro';
import { copione } from './copione';
import { creaRegista } from './regista';
import { T } from '../../testi';

const NEUTRO = 'tosatura-a-sorpresa';

const vista = (s: Stato): Vista => vistaPer(s, null);
const foto = (s: Stato, inBasso: IdGiocatore = 'g1', mano: IdCarta[] | null = null): Fotografia => fotografia(vista(s), inBasso, mano);

/** Tre giocatori al dado: g1 lancia (Carriola 8, Balla di fieno 5, Sasso comodo 2), gregge con 20 agnellini. */
function alDado(): Stato {
  let s = prosegui(scenario({ guaio: NEUTRO, gregge: 20, mani: { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['sasso-comodo'] } }));
  s = scegli(s, { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['sasso-comodo'] });
  s = prosegui(s);
  if (s.fase.nome === 'belati_punteggio') s = chiudiPunteggio(s);
  expect(s.fase.nome).toBe('dado');
  return s;
}

/** Pascolo: dado_lanciato, dichiarazione e agnellini dal gregge a g1. */
function pascolo(): { prima: Stato; dopo: Stato } {
  const prima = alDado();
  const dopo = nessunaReazione(applica(conFaccia(prima, 'pascolo_piccolo'), { tipo: 'lanciaDado', giocatore: 'g1' }));
  return { prima, dopo };
}

/** Nebbia fitta presa da g2 (un avversario di chi sta in basso), poi l'agnellino di consolazione. */
function nebbia(): { prima: Stato; dopo: Stato } {
  let s = scenario({ giocatori: 3, guaio: 'nebbia-fitta' });
  s = { ...s, fase: { nome: 'guaio_al_peggiore', destinatario: 'g2', spareggio: null } };
  s.datiRound.partecipanti = ['g1', 'g2', 'g3'];
  const prima = prosegui(s);
  expect(prima.fase.nome).toBe('belati_salvataggio');
  const dopo = applica(prima, { tipo: 'passa', giocatore: 'g2' });
  return { prima, dopo };
}

/** La vista senza gli eventi `agnellini` nuovi (la consolazione): resta solo la battuta del Guaio. */
function soloIlGuaio(prima: Stato, dopo: Stato): Vista {
  const v = vista(dopo);
  return { ...v, eventi: v.eventi.filter((e) => e.seq < prima.prossimoEvento || e.tipo !== 'agnellini') };
}

/** Lascia correre le promesse in sospeso. */
async function scarica(): Promise<void> {
  for (let i = 0; i < 40; i++) await Promise.resolve();
}

/** Fa avanzare la scena di `ms` a passi di 33 ms, lasciando proseguire le promesse tra un passo e l'altro. */
async function scorri(t: Teatro, ms: number): Promise<void> {
  for (let fatto = 0; fatto < ms; fatto += 33) {
    t.avanza(Math.min(33, ms - fatto));
    await scarica();
  }
}

/** A passi di 33 ms finché la condizione non vale (al più `max` ms di ciclo): ms di ciclo e di scena passati. */
async function finche(t: Teatro, condizione: () => boolean, max = 20_000): Promise<{ ciclo: number; scena: number }> {
  const inizio = t.ctx.orologio.ms;
  let ciclo = 0;
  await scarica();
  while (!condizione() && ciclo < max) {
    t.avanza(33);
    ciclo += 33;
    await scarica();
  }
  expect(condizione()).toBe(true);
  return { ciclo, scena: t.ctx.orologio.ms - inizio };
}

/** Gli agnellini in scena, luogo per luogo, coincidono con la fotografia (assegnati e mostrati). */
function inPari(t: Teatro, f: Fotografia): void {
  const atteso: Record<string, { assegnati: number; mostrati: number }> = { gregge: { assegnati: f.gregge, mostrati: f.gregge } };
  for (const p of f.posti) atteso[p.id] = { assegnati: p.agnellini, mostrati: p.agnellini };
  expect(t.stato().agnellini).toEqual(atteso);
  expect(t.stato().inViaggio).toBe(0);
}

let radice: HTMLElement;
let teatro: Teatro | null = null;
let errori: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  radice = document.createElement('div');
  document.body.appendChild(radice);
  errori = vi.spyOn(console, 'error');
});

afterEach(() => {
  teatro?.distruggi();
  teatro = null;
  radice.remove();
  if (opzioni().veloci) cambiaOpzione('veloci');
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.clear();
});

const nuovo = (ambiente = false): Teatro =>
  (teatro = creaTeatro(radice, { ciclo: 'manuale', ambiente, giochi: false, caso: casoConSeme(5) }));

/** Un teatro con la prima recita già fatta e un ascoltatore che registra i cambi di "occupato". */
function pronto(prima: Stato, ambiente = false): { t: Teatro; cambi: boolean[] } {
  const t = nuovo(ambiente);
  t.recita(foto(prima), vista(prima));
  const cambi: boolean[] = [];
  t.ascoltaOccupato((o) => cambi.push(o));
  return { t, cambi };
}

describe('regista: prima recita e battute che aspettano la fine', () => {
  it('la prima recita mette in pari subito, senza battute: libero e scena in pari', () => {
    const { dopo } = pascolo();
    const t = nuovo();
    const cambi: boolean[] = [];
    t.ascoltaOccupato((o) => cambi.push(o));
    const ordine = vi.spyOn(t.ordini, 'dado');
    // Anche se la vista porta già un lancio, la prima recita non lo recita
    t.recita(foto(dopo), vista(dopo));
    expect(t.occupato()).toBe(false);
    expect(ordine).not.toHaveBeenCalled();
    inPari(t, foto(dopo));
    expect(cambi).toEqual([]);
    expect(t.eventoInCorso()).toBe(false);
  });

  it('Pascolo: occupato subito, libero dopo dado, fumetto e corsa; agnellini come la fotografia; ascoltatore [true, false]', async () => {
    const { prima, dopo } = pascolo();
    const { t, cambi } = pronto(prima);
    const sposta = vi.spyOn(t.ordini, 'spostaAgnellini');
    t.recita(foto(dopo), vista(dopo));
    expect(t.occupato()).toBe(true);
    expect(cambi).toEqual([true]);
    await finche(t, () => !t.occupato(), 10_000);
    expect(sposta).toHaveBeenCalledWith(3, 'gregge', 'g1', 'corre');
    inPari(t, foto(dopo));
    expect(cambi).toEqual([true, false]);
    expect(errori).not.toHaveBeenCalled();
  }, 30_000);

  it('le battute si recitano in fila: la corsa degli agnellini parte solo dopo il dado e il fumetto', async () => {
    const { prima, dopo } = pascolo();
    const { t } = pronto(prima);
    const ordine: string[] = [];
    const dado = t.ordini.dado.bind(t.ordini);
    const fumetti = t.ordini.fumetti.bind(t.ordini);
    const sposta = t.ordini.spostaAgnellini.bind(t.ordini);
    vi.spyOn(t.ordini, 'dado').mockImplementation((f) => (ordine.push('dado'), dado(f)));
    vi.spyOn(t.ordini, 'fumetti').mockImplementation((x, ms) => (ordine.push('fumetti'), fumetti(x, ms)));
    vi.spyOn(t.ordini, 'spostaAgnellini').mockImplementation((n, da, a, m) => (ordine.push('agnellini'), sposta(n, da, a, m)));
    t.recita(foto(dopo), vista(dopo));
    expect(ordine).toEqual(['dado']);
    await scorri(t, 600);
    expect(ordine).toEqual(['dado']);
    await finche(t, () => !t.occupato(), 10_000);
    expect(ordine).toEqual(['dado', 'fumetti', 'agnellini']);
  }, 30_000);

  it('una recita senza battute nuove mette in pari con calma, subito, senza occupare', () => {
    const { prima } = pascolo();
    const { t, cambi } = pronto(prima);
    const f = { ...foto(prima), mazzo: foto(prima).mazzo - 1 };
    t.recita(f, vista(prima));
    expect(t.occupato()).toBe(false);
    expect(cambi).toEqual([]);
  });

  it('un ascoltatore che appena liberi fa partire una recita nuova: gli altri non ricevono un "libero" vecchio', async () => {
    const { prima, dopo } = pascolo();
    const t = nuovo();
    t.recita(foto(prima), vista(prima));
    const v = vista(dopo);
    const conCura = { ...v, eventi: [...v.eventi, { tipo: 'guaio_curato' as const, giocatore: 'g2', carta: 'insonnia#1', seq: 1000 }] };
    let rilanciata = false;
    t.ascoltaOccupato((o) => {
      if (!o && !rilanciata) {
        rilanciata = true;
        t.recita(foto(dopo), conCura);
      }
    });
    const cambi: boolean[] = [];
    t.ascoltaOccupato((o) => cambi.push(o));
    t.recita(foto(dopo), v);
    await finche(t, () => rilanciata, 10_000);
    expect(t.occupato()).toBe(true);
    expect(cambi).toEqual([true, true]);
    await finche(t, () => !t.occupato(), 5000);
    expect(cambi).toEqual([true, true, false]);
  }, 30_000);

  it('una partita nuova sullo stesso teatro (eventi che ripartono da capo): messa in pari subito, niente recita', () => {
    const { dopo } = pascolo();
    const t = nuovo();
    t.recita(foto(dopo), vista(dopo));
    const nuova = alDado();
    const v = vista(nuova);
    expect(Math.max(...v.eventi.map((e) => e.seq))).toBeLessThan(Math.max(...vista(dopo).eventi.map((e) => e.seq)));
    t.recita(foto(nuova), v);
    expect(t.occupato()).toBe(false);
    inPari(t, foto(nuova));
  });

  it('mentre recita, una fotografia con la mano coperta copre subito la mano (regola anti-sbirciata)', () => {
    const { prima, dopo } = pascolo();
    const t = nuovo();
    const mano = ['carriola#9', 'sasso-comodo#9'];
    t.recita(foto(prima, 'g1', mano), vista(prima));
    expect(t.stato().mano).toEqual(mano);
    t.recita(foto(dopo, 'g1', null), vista(dopo));
    expect(t.occupato()).toBe(true);
    expect(t.stato().mano).toBeNull();
    expect(radice.querySelectorAll('.mano .cm:not(.dorso)')).toHaveLength(0);
  });

  it('mentre recita, la mano scoperta si aggiorna subito: la carta giocata esce, quelle pescate entrano', () => {
    const { prima, dopo } = pascolo();
    const t = nuovo();
    t.recita(foto(prima, 'g1', ['carriola#9', 'sasso-comodo#9']), vista(prima));
    const nuova = ['sasso-comodo#9', 'balla-di-fieno#9'];
    t.recita(foto(dopo, 'g1', nuova), vista(dopo));
    expect(t.occupato()).toBe(true);
    expect(t.stato().mano).toEqual(nuova);
  });
});

describe('regista: meteo, salto e velocità', () => {
  it(
    'meteo su un avversario: libero dopo 5 s di scena, camera tornata, la nebbia prosegue sullo sfondo e poi finisce',
    { timeout: 30_000 },
    async () => {
      const { prima, dopo } = nebbia();
      const { t, cambi } = pronto(prima, true);
      t.recita(foto(dopo), soloIlGuaio(prima, dopo));
      expect(t.occupato()).toBe(true);
      const { scena } = await finche(t, () => !t.occupato(), 10_000);
      expect(Math.abs(scena - 5000)).toBeLessThanOrEqual(100);
      expect(t.stato().zoom).toBe(1);
      expect(t.eventoInCorso()).toBe(true);
      expect(t.ctx.meteoAttivo()).toBe(true);
      expect(cambi).toEqual([true, false]);
      await finche(t, () => !t.eventoInCorso(), 20_000);
      expect(t.ctx.meteoAttivo()).toBe(false);
      expect(t.occupato()).toBe(false);
      inPari(t, foto(dopo));
      expect(errori).not.toHaveBeenCalled();
    },
  );

  it('meteo seguito dalla consolazione: la corsa del gregge parte a 5 s, mentre la nebbia continua', { timeout: 30_000 }, async () => {
    const { prima, dopo } = nebbia();
    const { t } = pronto(prima, true);
    const sposta = vi.spyOn(t.ordini, 'spostaAgnellini');
    const inizio = t.ctx.orologio.ms;
    t.recita(foto(dopo), vista(dopo));
    await finche(t, () => sposta.mock.calls.length > 0, 10_000);
    expect(Math.abs(t.ctx.orologio.ms - inizio - 5000)).toBeLessThanOrEqual(100);
    expect(sposta).toHaveBeenCalledWith(1, 'gregge', 'g2', 'corre');
    expect(t.ctx.meteoAttivo()).toBe(true);
    // La partita riparte a 5 s: non aspetta che l'agnellino di consolazione arrivi
    const { ciclo } = await finche(t, () => !t.occupato(), 10_000);
    expect(ciclo).toBeLessThanOrEqual(100);
    expect(t.stato().inViaggio).toBeGreaterThan(0);
    await finche(t, () => !t.eventoInCorso(), 20_000);
    inPari(t, foto(dopo));
    expect(errori).not.toHaveBeenCalled();
  });

  it('salto: con una battuta lunga in corso, salta() libera entro 1,5 s di ciclo', { timeout: 30_000 }, async () => {
    const { prima, dopo } = nebbia();
    const { t } = pronto(prima, true);
    t.recita(foto(dopo), soloIlGuaio(prima, dopo));
    await scorri(t, 99);
    t.salta();
    const { ciclo } = await finche(t, () => !t.occupato(), 1500);
    expect(ciclo).toBeLessThanOrEqual(1500);
  });

  it('il salto di una battuta non accelera le battute successive: si spegne quando ne comincia una nuova', async () => {
    const { prima, dopo } = pascolo();
    const { t } = pronto(prima);
    const fumetti = t.ordini.fumetti.bind(t.ordini);
    let saltoAlFumetto: boolean | null = null;
    vi.spyOn(t.ordini, 'fumetti').mockImplementation((x, ms) => {
      saltoAlFumetto = t.ctx.regia.salto;
      return fumetti(x, ms);
    });
    t.recita(foto(dopo), vista(dopo));
    t.salta();
    expect(t.ctx.regia.salto).toBe(true);
    await finche(t, () => saltoAlFumetto !== null, 3000);
    expect(saltoAlFumetto).toBe(false);
    expect(t.ctx.regia.velocita()).toBe(1);
  });

  it('Animazioni veloci: il meteo libera dopo 2,5 s veri di ciclo', { timeout: 30_000 }, async () => {
    cambiaOpzione('veloci');
    expect(opzioni().veloci).toBe(true);
    const { prima, dopo } = nebbia();
    const { t } = pronto(prima, true);
    t.recita(foto(dopo), soloIlGuaio(prima, dopo));
    const { ciclo } = await finche(t, () => !t.occupato(), 10_000);
    expect(Math.abs(ciclo - 2500)).toBeLessThanOrEqual(100);
    // Finita la battuta la velocità 2 resta per il meteo sullo sfondo (è ancora un evento in corso)
    expect(t.ctx.regia.velocita()).toBe(2);
  });
});

describe('regista: tempo massimo, messa in pari subito, ricostruzione, distruzione', () => {
  it('tempo massimo: un ordine che non finisce mai libera dopo 25000 ms veri, e la scena va in pari', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { prima, dopo } = pascolo();
    const { t, cambi } = pronto(prima);
    vi.spyOn(t.ordini, 'dado').mockReturnValue(new Promise<void>(() => undefined));
    t.recita(foto(dopo), vista(dopo));
    await scorri(t, 3000);
    expect(t.occupato()).toBe(true);
    vi.advanceTimersByTime(24_000);
    await scorri(t, 100);
    expect(t.occupato()).toBe(true);
    vi.advanceTimersByTime(1000);
    await scarica();
    await finche(t, () => !t.occupato(), 10_000);
    // Le battute dopo quella scaduta non si recitano: gli agnellini vanno al loro posto con la messa in pari
    await finche(t, () => t.ctx.regia.inViaggio.size === 0, 10_000);
    inPari(t, foto(dopo));
    expect(cambi).toEqual([true, false]);
  }, 30_000);

  it('tempo massimo per la recita intera: dopo una battuta scaduta le altre non si recitano, la scena va in pari', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { prima, dopo } = pascolo();
    const { t, cambi } = pronto(prima);
    // Il dado non finisce mai e l'orologio della scena è fermo (il browser non disegna): gli agnellini non arriverebbero
    vi.spyOn(t.ordini, 'dado').mockReturnValue(new Promise<void>(() => undefined));
    t.recita(foto(dopo), vista(dopo));
    await scarica();
    expect(t.occupato()).toBe(true);
    vi.advanceTimersByTime(25_000);
    await scarica();
    // Niente altri 25 s per la battuta degli agnellini
    vi.advanceTimersByTime(1000);
    await scarica();
    expect(t.occupato()).toBe(false);
    expect(cambi).toEqual([true, false]);
    await finche(t, () => t.ctx.regia.inViaggio.size === 0, 10_000);
    inPari(t, foto(dopo));
  }, 30_000);

  it('troppe battute (più di 8 in coda): messa in pari subito, libero, nessuna animazione in corso', () => {
    // Una partita vera: si gioca senza recitare finché il copione degli eventi accumulati dà almeno 9 battute
    const r = generatore(1);
    const giocatori = SETUP.pecore.slice(0, 3).map((p, i) => ({ id: `g${i + 1}`, nome: `G${i + 1}`, pecora: p.id }));
    let s = nuovaPartita({ giocatori, seme: 1 });
    const inizio = vista(s);
    const ultimo = Math.max(0, ...inizio.eventi.map((e) => e.seq));
    let v = inizio;
    for (let i = 0; i < 500; i++) {
      s = applica(s, mossaDelBot(s, 'semplice', r));
      v = vista(s);
      if (copione(v.eventi.filter((e) => e.seq > ultimo), v).length >= 9) break;
    }
    expect(copione(v.eventi.filter((e) => e.seq > ultimo), v).length).toBeGreaterThanOrEqual(9);
    const t = nuovo();
    t.recita(fotografia(inizio, 'g1', null), inizio);
    const cambi: boolean[] = [];
    t.ascoltaOccupato((o) => cambi.push(o));
    t.recita(fotografia(v, 'g1', null), v);
    expect(t.occupato()).toBe(false);
    expect(t.eventoInCorso()).toBe(false);
    inPari(t, fotografia(v, 'g1', null));
    expect(cambi.at(-1) ?? false).toBe(false);
  });

  it('troppe battute arrivate mentre recita: la coda si svuota e la scena va in pari subito', async () => {
    const { prima, dopo } = pascolo();
    const { t, cambi } = pronto(prima);
    t.recita(foto(dopo), vista(dopo));
    await scorri(t, 200);
    // Nove fumetti in più (evento ripetuto con seq nuovi): la coda supera 8
    const v = vista(dopo);
    const curato = { tipo: 'guaio_curato' as const, giocatore: 'g2', carta: 'insonnia#1' };
    const eventi = [...v.eventi, ...Array.from({ length: 9 }, (_, i) => ({ ...curato, seq: 1000 + i }))];
    t.recita(foto(dopo), { ...v, eventi } as Vista);
    expect(t.occupato()).toBe(false);
    expect(cambi).toEqual([true, false]);
    inPari(t, foto(dopo));
    await scorri(t, 3000);
    expect(cambi).toEqual([true, false]);
  });

  it("allinea(foto, 'subito') durante una recita: coda svuotata, libero, e la recita non riprende", async () => {
    const { prima, dopo } = pascolo();
    const { t, cambi } = pronto(prima);
    const sposta = vi.spyOn(t.ordini, 'spostaAgnellini');
    t.recita(foto(dopo), vista(dopo));
    await scorri(t, 300);
    t.allinea(foto(dopo), 'subito');
    expect(t.occupato()).toBe(false);
    expect(cambi).toEqual([true, false]);
    inPari(t, foto(dopo));
    await scorri(t, 5000);
    expect(sposta).not.toHaveBeenCalled();
    expect(cambi).toEqual([true, false]);
    expect(t.eventoInCorso()).toBe(false);
  });

  it('ricostruzione con il meteo sullo sfondo (altro giocatore in basso): meteo fermato, libero, scena in pari', { timeout: 30_000 }, async () => {
    const { prima, dopo } = nebbia();
    const { t, cambi } = pronto(prima, true);
    t.recita(foto(dopo), vista(dopo));
    await finche(t, () => !t.occupato(), 15_000);
    // Ancora la nebbia sullo sfondo
    expect(t.ctx.meteoAttivo()).toBe(true);
    // Un'altra fotografia con un altro giocatore in basso (il telefono è passato): il tavolo si ricostruisce
    t.recita(foto(dopo, 'g2'), vista(dopo));
    await scarica();
    expect(t.ctx.meteoAttivo()).toBe(false);
    expect(t.eventoInCorso()).toBe(false);
    expect(t.occupato()).toBe(false);
    expect(t.stato().inBasso).toBe('g2');
    inPari(t, foto(dopo, 'g2'));
    expect(cambi).toEqual([true, false]);
  });

  it('ricostruzione durante una recita: coda svuotata e libero', async () => {
    const { prima, dopo } = pascolo();
    const { t, cambi } = pronto(prima);
    t.recita(foto(dopo), vista(dopo));
    await scorri(t, 300);
    t.recita(foto(dopo, 'g3'), vista(dopo));
    expect(t.occupato()).toBe(false);
    expect(cambi).toEqual([true, false]);
    inPari(t, foto(dopo, 'g3'));
    await scorri(t, 4000);
    expect(cambi).toEqual([true, false]);
    expect(t.eventoInCorso()).toBe(false);
  });

  it('distruggi durante una recita: avvisa libero, nessun timer vero rimasto', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { prima, dopo } = pascolo();
    const { t, cambi } = pronto(prima);
    t.recita(foto(dopo), vista(dopo));
    await scorri(t, 300);
    expect(t.occupato()).toBe(true);
    t.distruggi();
    teatro = null;
    expect(cambi).toEqual([true, false]);
    expect(t.occupato()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(30_000);
    await scarica();
    expect(vi.getTimerCount()).toBe(0);
    expect(cambi).toEqual([true, false]);
    // Dopo distruggi una recita non fa niente
    t.recita(foto(dopo), vista(dopo));
    expect(t.occupato()).toBe(false);
    expect(errori).not.toHaveBeenCalled();
  });
});

describe('regista: giro di correzione 1', () => {
  /** La vista con eventi in più (seq nuovi): per far nascere battute senza giocare altre mosse. */
  const conEventi = (v: Vista, ...extra: Array<Record<string, unknown>>): Vista =>
    ({ ...v, eventi: [...v.eventi, ...extra] }) as Vista;
  const cura = (seq: number) => ({ tipo: 'guaio_curato', giocatore: 'g2', carta: 'insonnia#1', seq });

  it('un fotogramma rotto durante una recita: si rimette in pari con la fotografia più recente, regista libero', async () => {
    const { prima, dopo } = pascolo();
    const { t, cambi } = pronto(prima);
    errori.mockImplementation(() => undefined);
    t.recita(foto(dopo), vista(dopo));
    await scorri(t, 300);
    vi.spyOn(t.ctx.orologio, 'avanza').mockImplementationOnce(() => {
      throw new Error('fotogramma rotto');
    });
    t.avanza(33);
    await scarica();
    expect(errori).toHaveBeenCalledTimes(1);
    expect(t.occupato()).toBe(false);
    expect(cambi).toEqual([true, false]);
    inPari(t, foto(dopo));
    await scorri(t, 4000);
    inPari(t, foto(dopo));
    expect(cambi).toEqual([true, false]);
  });

  it('messa in pari subito per troppe battute: un ascoltatore che rilancia una recita appena libero non viene fermato', async () => {
    const { prima, dopo } = pascolo();
    const { t } = pronto(prima);
    const v = vista(dopo);
    let rilanciata = false;
    t.ascoltaOccupato((o) => {
      if (!o && !rilanciata) {
        rilanciata = true;
        t.recita(foto(dopo), conEventi(v, ...Array.from({ length: 9 }, (_, i) => cura(1000 + i)), cura(2000)));
      }
    });
    const fumetti = vi.spyOn(t.ordini, 'fumetti');
    t.recita(foto(dopo), v);
    await scorri(t, 200);
    t.recita(foto(dopo), conEventi(v, ...Array.from({ length: 9 }, (_, i) => cura(1000 + i))));
    expect(rilanciata).toBe(true);
    // La recita rilanciata (il fumetto della cura con seq 2000) è in corso
    expect(t.occupato()).toBe(true);
    expect(fumetti).toHaveBeenCalledWith({ g2: T.scena.fumetti.curato }, 1200);
    await finche(t, () => !t.occupato(), 5000);
  });

  it('distruggi con un ascoltatore che chiama recita all\'avviso "libero": non riparte niente', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { prima, dopo } = pascolo();
    const { t, cambi } = pronto(prima);
    const v = vista(dopo);
    t.ascoltaOccupato((o) => {
      if (!o) t.recita(foto(dopo), conEventi(v, cura(3000)));
    });
    t.recita(foto(dopo), v);
    await scorri(t, 300);
    t.distruggi();
    teatro = null;
    expect(cambi).toEqual([true, false]);
    expect(t.occupato()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("un'eccezione nella messa in pari finale va in console.error una volta, e il regista si libera", async () => {
    const { prima, dopo } = pascolo();
    const t = nuovo();
    errori.mockImplementation(() => undefined);
    const regista = creaRegista({
      ctx: t.ctx,
      ordini: t.ordini,
      allinea(f, modo) {
        if (modo === 'calmo') throw new Error('messa in pari rotta');
        t.allinea(f, modo);
      },
      daRicostruire: () => false,
    });
    regista.recita(foto(prima), vista(prima));
    regista.recita(foto(dopo), vista(dopo));
    expect(regista.occupato()).toBe(true);
    await finche(t, () => !regista.occupato(), 10_000);
    await scarica();
    expect(errori).toHaveBeenCalledTimes(1);
    regista.distruggi();
  });

  it("l'annuncio riceve la durata della battuta", async () => {
    const { prima } = pascolo();
    const { t } = pronto(prima);
    const annuncio = vi.spyOn(t.ordini, 'annuncio');
    t.recita(foto(prima), conEventi(vista(prima), { tipo: 'round_iniziato', round: 3, ultimo: true, seq: 1000 }));
    expect(annuncio).toHaveBeenCalledWith(T.scena.annunci.ultimoRound, 1200);
    await finche(t, () => !t.occupato(), 3000);
  });

  it('recita con { subito: true }: niente recita, in pari subito, e gli stessi eventi poi non si recitano', async () => {
    const { prima, dopo } = pascolo();
    const { t, cambi } = pronto(prima);
    const dado = vi.spyOn(t.ordini, 'dado');
    t.recita(foto(dopo), vista(dopo), { subito: true });
    expect(t.occupato()).toBe(false);
    inPari(t, foto(dopo));
    t.recita(foto(dopo), vista(dopo));
    expect(t.occupato()).toBe(false);
    expect(dado).not.toHaveBeenCalled();
    expect(cambi).toEqual([]);
  });

  it('recita con { subito: true } durante una recita: coda svuotata e libero', async () => {
    const { prima, dopo } = pascolo();
    const { t, cambi } = pronto(prima);
    const sposta = vi.spyOn(t.ordini, 'spostaAgnellini');
    t.recita(foto(dopo), vista(dopo));
    await scorri(t, 300);
    t.recita(foto(dopo), vista(dopo), { subito: true });
    expect(t.occupato()).toBe(false);
    expect(cambi).toEqual([true, false]);
    inPari(t, foto(dopo));
    await scorri(t, 4000);
    expect(sposta).not.toHaveBeenCalled();
  });
});

describe('regista: buchi nella numerazione degli eventi', () => {
  it('eventi nuovi con buchi nei seq (e dopo l\'ultimo già visto) si recitano tutti, una volta sola', async () => {
    const { prima, dopo } = pascolo();
    const { t, cambi } = pronto(prima);
    const base = prima.prossimoEvento;
    const v = vista(dopo);
    // I seq nuovi saltano: dall'ultimo già visto al primo nuovo e tra uno e l'altro (eventi che questa vista non ha)
    const conBuchi: Vista = { ...v, eventi: v.eventi.map((e) => (e.seq < base ? e : { ...e, seq: base + 5 + (e.seq - base) * 10 })) };
    expect(conBuchi.eventi.filter((e) => e.seq >= base).length).toBeGreaterThan(1);
    const dado = vi.spyOn(t.ordini, 'dado');
    const sposta = vi.spyOn(t.ordini, 'spostaAgnellini');
    t.recita(foto(dopo), conBuchi);
    expect(t.occupato()).toBe(true);
    await finche(t, () => !t.occupato(), 10_000);
    expect(dado).toHaveBeenCalledTimes(1);
    expect(sposta).toHaveBeenCalledWith(3, 'gregge', 'g1', 'corre');
    inPari(t, foto(dopo));
    // La stessa vista di nuovo: niente da recitare (conta il seq più alto già visto, non quanti eventi ci sono)
    t.recita(foto(dopo), conBuchi);
    expect(t.occupato()).toBe(false);
    expect(dado).toHaveBeenCalledTimes(1);
    expect(sposta).toHaveBeenCalledTimes(1);
    expect(cambi).toEqual([true, false]);
  }, 30_000);
});
