// @vitest-environment jsdom
// Prove del teatro che chiede: zone di tocco sulle pecore, dado, pulsanti, mano comandata, attesa della scena libera,
// tocco sul prato, ricostruzione e accessibilità. Ciclo manuale, senza ambiente né giochi; fotografie con 2, 3 e 4 giocatori
// (la recita vera, per "occupato", viene da una partita del motore).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// Questo file monta teatri veri: con tutte le prove insieme una prova può superare i 5 s predefiniti (la macchina è
// carica). Il limite più alto vale per tutto il file, così la prossima prova lenta non fallisce per finta.
vi.setConfig({ testTimeout: 60_000 });
import { applica, defCarta, nuovaPartita, SETUP, vistaPer } from '../../../engine/src';
import type { IdCarta, IdGiocatore, Stato, Vista } from '../../../engine/src';
import { chiudiPunteggio, conFaccia, nessunaReazione, prosegui, scegli, scenario } from '../../../engine/test/aiuti';
import { T } from '../testi';
import { casoConSeme } from './aiuti-prova';
import { carteComandate, separaZone } from './chiedi';
import { disposizione } from './disposizioni';
import { fotografia, type Fotografia } from './fotografia';
import { posaSollevata } from './mano';
import type { Domanda, Gesto } from './scelte/tipi';
import { creaTeatro, type Teatro } from './teatro';

const NEUTRO = 'tosatura-a-sorpresa';
const A: IdCarta = 'carriola#1';
const B: IdCarta = 'balla-di-fieno#1';
const C: IdCarta = 'sasso-comodo#1';

/** Fotografia di una partita nuova con `n` giocatori (G1, G2…), in basso `inBasso`. */
function foto(n: 2 | 3 | 4, mano: IdCarta[] | null = null, inBasso: IdGiocatore = 'g1'): Fotografia {
  const giocatori = SETUP.pecore.slice(0, n).map((p, i) => ({ id: `g${i + 1}`, nome: `G${i + 1}`, pecora: p.id }));
  return fotografia(vistaPer(nuovaPartita({ giocatori, seme: 11 }), null), inBasso, mano);
}

function domanda(o: Partial<Domanda> = {}): Domanda {
  return {
    chiave: 'k',
    scritta: '',
    avvisi: [],
    carte: [],
    sollevate: [],
    trascinabili: [],
    pecore: [],
    dado: false,
    guai: [],
    guaioScelto: null,
    grandi: [],
    centro: null,
    furto: null,
    pulsanti: [],
    fionda: null,
    ...o,
  };
}

// Partita vera per la scena occupata (come regista.test.ts): g1 lancia, Pascolo piccolo.
const vista = (s: Stato): Vista => vistaPer(s, null);
function alDado(): Stato {
  let s = prosegui(scenario({ guaio: NEUTRO, gregge: 20, mani: { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['sasso-comodo'] } }));
  s = scegli(s, { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['sasso-comodo'] });
  s = prosegui(s);
  if (s.fase.nome === 'belati_punteggio') s = chiudiPunteggio(s);
  expect(s.fase.nome).toBe('dado');
  return s;
}
function pascolo(): { prima: Stato; dopo: Stato } {
  const prima = alDado();
  const dopo = nessunaReazione(applica(conFaccia(prima, 'pascolo_piccolo'), { tipo: 'lanciaDado', giocatore: 'g1' }));
  return { prima, dopo };
}
const fotoDi = (s: Stato): Fotografia => fotografia(vista(s), 'g1', null);

async function scarica(): Promise<void> {
  for (let i = 0; i < 40; i++) await Promise.resolve();
}
async function finche(t: Teatro, condizione: () => boolean, max = 20_000): Promise<void> {
  let ms = 0;
  await scarica();
  while (!condizione() && ms < max) {
    t.avanza(33);
    ms += 33;
    await scarica();
  }
  expect(condizione()).toBe(true);
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
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  localStorage.clear();
});

/** Un teatro già messo in pari con la fotografia (nessuna recita). */
function nuovo(f: Fotografia): Teatro {
  const t = (teatro = creaTeatro(radice, { ciclo: 'manuale', ambiente: false, giochi: false, caso: casoConSeme(5) }));
  t.allinea(f, 'subito');
  return t;
}

const q = <E extends Element = HTMLElement>(sel: string): E | null => radice.querySelector<E>(sel);
const qa = <E extends Element = HTMLElement>(sel: string): E[] => [...radice.querySelectorAll<E>(sel)];
const zone = () => qa('.ui .zona');
const zonaDi = (chi: string) => q(`.ui .zona[data-chi="${chi}"]`)!;
const pecoraDi = (chi: string) => qa('.pecora').find((e) => e.dataset.chi === chi)!;
const recintiDi = (chi: string) => qa<SVGElement>('.recinto').filter((e) => e.dataset.chi === chi);
const bottoni = () => qa<HTMLButtonElement>('.ui button');
const carte = () => qa('.mano .cm:not(.dorso)');

function evento(tipo: string, el: Element, x = 100, y = 700): void {
  const e = new MouseEvent(tipo, { bubbles: true, cancelable: true, clientX: x, clientY: y });
  Object.assign(e, { pointerId: 1, pointerType: 'touch' });
  el.dispatchEvent(e);
}
/** Un evento del mouse con quel tasto (0 sinistro, 1 centrale, 2 destro). */
function eventoMouse(tipo: string, el: Element, button: number): void {
  const e = new MouseEvent(tipo, { bubbles: true, cancelable: true, clientX: 100, clientY: 700, button });
  Object.assign(e, { pointerId: 1, pointerType: 'mouse' });
  el.dispatchEvent(e);
}
const tocca = (el: Element): void => {
  evento('pointerdown', el);
  evento('pointerup', el);
};
const tasto = (el: Element, key: string): void => {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
};

function registra(): { gesti: Gesto[]; suGesto: (g: Gesto) => void } {
  const gesti: Gesto[] = [];
  return { gesti, suGesto: (g) => gesti.push(g) };
}

type R = [number, number, number, number];
const rettDi = (el: HTMLElement): R => {
  const x = parseFloat(el.style.left);
  const y = parseFloat(el.style.top);
  return [x, y, x + parseFloat(el.style.width), y + parseFloat(el.style.height)];
};
const siToccano = (a: R, b: R): boolean => Math.min(a[2], b[2]) > Math.max(a[0], b[0]) && Math.min(a[3], b[3]) > Math.max(a[1], b[1]);

describe('zone di tocco sulle pecore', () => {
  it('una zona e una luce solo per le pecore della domanda, con nome, ruolo e tabindex', () => {
    const t = nuovo(foto(3));
    const { gesti, suGesto } = registra();
    t.chiedi(domanda({ pecore: ['g2'] }), suGesto);
    expect(zone()).toHaveLength(1);
    const z = zonaDi('g2');
    expect(z.getAttribute('role')).toBe('button');
    expect(z.getAttribute('tabindex')).toBe('0');
    expect(z.getAttribute('aria-label')).toBe('G2');
    expect(pecoraDi('g2').classList.contains('illuminata')).toBe(true);
    expect(recintiDi('g2').length).toBeGreaterThan(0);
    for (const r of recintiDi('g2')) expect(r.classList.contains('illuminata')).toBe(true);
    for (const chi of ['g1', 'g3']) {
      expect(pecoraDi(chi).classList.contains('illuminata')).toBe(false);
      for (const r of recintiDi(chi)) expect(r.classList.contains('illuminata')).toBe(false);
    }
    expect(gesti).toEqual([]);
  });

  it('tocco e Invio e Spazio su una zona: gesto pecora', () => {
    const t = nuovo(foto(3));
    const { gesti, suGesto } = registra();
    t.chiedi(domanda({ pecore: ['g2', 'g3'] }), suGesto);
    zonaDi('g2').click();
    tasto(zonaDi('g3'), 'Enter');
    tasto(zonaDi('g2'), ' ');
    tasto(zonaDi('g2'), 'a');
    expect(gesti).toEqual([
      { tipo: 'pecora', chi: 'g2' },
      { tipo: 'pecora', chi: 'g3' },
      { tipo: 'pecora', chi: 'g2' },
    ]);
  });

  it('un tocco fuori dalle zone non sceglie nessuna pecora (è il prato)', () => {
    const t = nuovo(foto(3));
    const { gesti, suGesto } = registra();
    t.chiedi(domanda({ pecore: ['g2'] }), suGesto);
    q('.coperta')!.click();
    pecoraDi('g3').click();
    evento('pointerdown', q('.mondo')!);
    expect(gesti.filter((g) => g.tipo === 'pecora')).toEqual([]);
    expect(gesti).toEqual([{ tipo: 'prato' }]);
  });

  for (const n of [2, 3, 4] as const) {
    it(`con ${n} giocatori le zone di due giocatori diversi non si intersecano, restano nella scena e hanno una misura`, () => {
      const t = nuovo(foto(n));
      const ids = Array.from({ length: n }, (_, i) => `g${i + 1}`);
      t.chiedi(domanda({ pecore: ids }), () => undefined);
      const rett = ids.map((id) => rettDi(zonaDi(id)));
      for (const r of rett) {
        expect(r[2] - r[0]).toBeGreaterThan(20);
        expect(r[3] - r[1]).toBeGreaterThan(20);
        expect(r[0]).toBeGreaterThanOrEqual(0);
        expect(r[2]).toBeLessThanOrEqual(390);
      }
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) expect(siToccano(rett[i]!, rett[j]!), `${i} e ${j}`).toBe(false);
    });
  }

  it('con 4 giocatori un punto tra due recinti vicini non cade in nessuna zona', () => {
    const t = nuovo(foto(4));
    t.chiedi(domanda({ pecore: ['g1', 'g2', 'g3', 'g4'] }), () => undefined);
    const alte = ['g2', 'g3', 'g4'].map((id) => rettDi(zonaDi(id))).sort((a, b) => a[0] - b[0]);
    for (let i = 0; i + 1 < alte.length; i++) {
      const x = (alte[i]![2] + alte[i + 1]![0]) / 2;
      const y = 150;
      const dentro = alte.filter((r) => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3]);
      // Il punto di mezzo è nello stacco: nessuna zona (o, al più, il bordo di una sola)
      expect(dentro.length).toBeLessThanOrEqual(1);
      expect(alte[i + 1]![0] - alte[i]![2]).toBeGreaterThan(0);
    }
  });

  it('separaZone: due rettangoli che si sovrappongono si tagliano a metà del tratto in comune', () => {
    const m = new Map<string, R>([
      ['a', [0, 0, 100, 50]],
      ['b', [90, 0, 200, 50]],
    ]);
    separaZone(m);
    expect(m.get('a')![2]).toBeLessThan(m.get('b')![0]);
    expect(m.get('a')![2]).toBeCloseTo(94, 0);
    expect(m.get('b')![0]).toBeCloseTo(96, 0);
    const d = new Map<string, R>([
      ['a', [0, 0, 50, 100]],
      ['b', [0, 90, 50, 200]],
    ]);
    separaZone(d);
    expect(d.get('a')![3]).toBeLessThan(d.get('b')![1]);
  });

  it('con "Riduci movimento" la luce c\'è ma non il saltello (classe ferma)', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
    const t = nuovo(foto(3));
    expect(t.ctx.ridotto).toBe(true);
    t.chiedi(domanda({ pecore: ['g2'] }), () => undefined);
    expect(pecoraDi('g2').classList.contains('illuminata')).toBe(true);
    expect(pecoraDi('g2').classList.contains('ferma')).toBe(true);
  });
});

describe('dado', () => {
  it('con dado: true il dado si illumina e il tocco dà il gesto dado; Tab e Invio passano dal suo controllo nello strato .ui', () => {
    const t = nuovo(foto(3));
    const { gesti, suGesto } = registra();
    t.chiedi(domanda({ dado: true }), suGesto);
    const d = q('.dado-pos')!;
    expect(d.classList.contains('illuminata')).toBe(true);
    // Il dado disegnato sta nel mondo (.camera, nascosto ai lettori di schermo): niente fuoco lì dentro
    expect(d.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(d.hasAttribute('tabindex')).toBe(false);
    // Il controllo per tastiera e lettori di schermo: fuori dal mondo nascosto, sopra il dado, il tocco passa al dado
    const z = q('.ui .zona-dado')!;
    expect(z.hidden).toBe(false);
    expect(z.closest('[aria-hidden="true"]')).toBeNull();
    expect(z.getAttribute('role')).toBe('button');
    expect(z.getAttribute('tabindex')).toBe('0');
    expect(z.getAttribute('aria-label')).toBe(T.azioni.lancia);
    d.click();
    tasto(z, 'Enter');
    z.click();
    expect(gesti).toEqual([{ tipo: 'dado' }, { tipo: 'dado' }, { tipo: 'dado' }]);
    // Il tocco sul dado non è un tocco sul prato
    evento('pointerdown', d);
    expect(gesti).toHaveLength(3);
  });

  it('con dado: false niente luce, niente controllo raggiungibile, niente gesto', () => {
    const t = nuovo(foto(3));
    const { gesti, suGesto } = registra();
    t.chiedi(domanda({ dado: false }), suGesto);
    const d = q('.dado-pos')!;
    expect(d.classList.contains('illuminata')).toBe(false);
    expect(d.hasAttribute('tabindex')).toBe(false);
    const z = q('.zona-dado')!;
    expect(z.hidden).toBe(true);
    expect(z.hasAttribute('tabindex')).toBe(false);
    d.click();
    tasto(z, 'Enter');
    z.click();
    evento('pointerdown', d);
    expect(gesti).toEqual([]);
  });

  it('senza domanda il dado non risponde, e togliendola si spegne', () => {
    const t = nuovo(foto(3));
    const { gesti, suGesto } = registra();
    q('.dado-pos')!.click();
    t.chiedi(domanda({ dado: true }), suGesto);
    t.smettiDiChiedere();
    q('.dado-pos')!.click();
    q('.zona-dado')!.click();
    expect(gesti).toEqual([]);
    expect(q('.dado-pos')!.classList.contains('illuminata')).toBe(false);
    expect(q('.dado-pos')!.hasAttribute('tabindex')).toBe(false);
    expect(q('.zona-dado')!.hidden).toBe(true);
    expect(q('.zona-dado')!.hasAttribute('tabindex')).toBe(false);
  });
});

describe('pulsanti', () => {
  const pulsanti = [
    { id: 'continua' as const, testo: 'Continua', attivo: true },
    { id: 'nessuno' as const, testo: 'Nessuno', attivo: false, secondario: true },
  ];

  it('veri button nello strato .ui, con testo e disabled; il clic dà il gesto pulsante', () => {
    const t = nuovo(foto(3));
    const { gesti, suGesto } = registra();
    t.chiedi(domanda({ pulsanti }), suGesto);
    const b = bottoni();
    expect(b.map((e) => e.textContent)).toEqual(['Continua', 'Nessuno']);
    expect(b.map((e) => e.disabled)).toEqual([false, true]);
    expect(b.every((e) => e.closest('.ui') !== null)).toBe(true);
    b[0]!.click();
    b[1]!.click();
    expect(gesti).toEqual([{ tipo: 'pulsante', id: 'continua' }]);
  });

  it('senza carte sollevate la fila sta sopra il ventaglio e quelli "sotto la carta" sono nascosti', () => {
    const t = nuovo(foto(3, [A, B, C]));
    t.chiedi(domanda({ pulsanti: [{ id: 'gioca', testo: 'Gioca', attivo: false, sottoLaCarta: true }, ...pulsanti] }), () => undefined);
    expect(q('.pulsanti-carta')!.hidden).toBe(true);
    expect(q('.pulsanti-fila')!.hidden).toBe(false);
    expect([...q('.pulsanti-fila')!.children].map((e) => e.textContent)).toEqual(['Continua', 'Nessuno']);
    expect(parseFloat(q('.pulsanti-fila')!.style.top)).toBeLessThan(722);
    expect(q('.pulsanti-fila')!.style.left).toBe('195px');
  });

  it('"Gioca" compare sotto la carta sollevata (centro + metà carta), dentro la scena', () => {
    const t = nuovo(foto(3, [A, B, C]));
    t.chiedi(
      domanda({ carte: [A, B, C], sollevate: [A], pulsanti: [{ id: 'gioca', testo: 'Gioca · 8', attivo: true, sottoLaCarta: true }] }),
      () => undefined,
    );
    const sotto = q('.pulsanti-carta')!;
    expect(sotto.hidden).toBe(false);
    expect(sotto.textContent).toBe('Gioca · 8');
    const y = parseFloat(sotto.style.top);
    // Centro 470, mezza carta 175 · 0,66 = 115,5: il pulsante sta appena sotto il bordo basso
    expect(y).toBeGreaterThan(470 + 175 * 0.66);
    expect(y).toBeLessThan(470 + 175 * 0.66 + 20);
    expect(y).toBeLessThan(844 - 44);
    expect(sotto.style.left).toBe('195px');
    expect(q('.pulsanti-fila')!.hidden).toBe(true);
  });

  it('con più di tre carte sollevate il pulsante "Gioca" sta sotto la loro fila', () => {
    const D: IdCarta = 'beee-no#1';
    const E: IdCarta = 'calzino-gemello#1';
    const t = nuovo(foto(3, [A, B, C, D, E]));
    t.chiedi(
      domanda({ carte: [A, B, C, D, E], sollevate: [A, B, C, D], pulsanti: [{ id: 'gioca', testo: 'Gioca', attivo: true, sottoLaCarta: true }] }),
      () => undefined,
    );
    const k4 = posaSollevata(0, 4).k;
    const y4 = parseFloat(q('.pulsanti-carta')!.style.top);
    expect(y4).toBeGreaterThan(490 + 175 * k4);
    expect(y4).toBeLessThan(490 + 175 * k4 + 20);
    t.chiedi(
      domanda({ carte: [A, B, C, D, E], sollevate: [A, B, C, D, E], pulsanti: [{ id: 'gioca', testo: 'Gioca', attivo: true, sottoLaCarta: true }] }),
      () => undefined,
    );
    const y5 = parseFloat(q('.pulsanti-carta')!.style.top);
    expect(y5).toBeGreaterThan(490 + 175 * posaSollevata(0, 5).k);
    expect(y5).toBeLessThan(490 + 175 * posaSollevata(0, 5).k + 20);
  });

  it('con tre carte sollevate usa la loro posa; con la mano ingrandita (adatta) i pulsanti si riposizionano', () => {
    const t = nuovo(foto(3, [A, B, C]));
    t.chiedi(
      domanda({ carte: [A, B, C], sollevate: [A, B, C], pulsanti: [{ id: 'gioca', testo: 'Gioca', attivo: true, sottoLaCarta: true }] }),
      () => undefined,
    );
    const k3 = posaSollevata(0, 3).k;
    const y1 = parseFloat(q('.pulsanti-carta')!.style.top);
    expect(y1).toBeGreaterThan(490 + 175 * k3);
    expect(y1).toBeLessThan(490 + 175 * k3 + 20);
    // Schermo 500×844: scena a scala 1, mano ingrandita di 1,25 attorno al centro in basso
    Object.defineProperty(t.ctx.el.schermo, 'clientWidth', { value: 500, configurable: true });
    Object.defineProperty(t.ctx.el.schermo, 'clientHeight', { value: 844, configurable: true });
    t.adatta();
    expect(t.ctx.KD).toBeCloseTo(1.25, 2);
    const y2 = parseFloat(q('.pulsanti-carta')!.style.top);
    const centro = 844 + (490 - 844) * 1.25;
    expect(y2).toBeGreaterThan(centro + 175 * k3 * 1.25);
    expect(y2).toBeLessThan(centro + 175 * k3 * 1.25 + 20);
  });

  it('i pulsanti che restano tra una domanda e l\'altra sono gli stessi elementi (il fuoco non si perde)', () => {
    const t = nuovo(foto(3));
    t.chiedi(domanda({ pulsanti }), () => undefined);
    const prima = bottoni()[0]!;
    prima.focus();
    t.chiedi(domanda({ pulsanti: [{ ...pulsanti[0]!, testo: 'Vai' }] }), () => undefined);
    expect(bottoni()).toHaveLength(1);
    expect(bottoni()[0]).toBe(prima);
    expect(prima.textContent).toBe('Vai');
    expect(document.activeElement).toBe(prima);
  });
});

describe('mano comandata', () => {
  it('la domanda decide quali carte rispondono, quali sono sollevate e quali si trascinano; i gesti arrivano a suGesto', () => {
    const t = nuovo(foto(3, [A, B, C]));
    const { gesti, suGesto } = registra();
    t.chiedi(domanda({ carte: [A, B], sollevate: [B], trascinabili: [A] }), suGesto);
    const [ca, cb, cc] = carte();
    expect(cb!.classList.contains('attiva')).toBe(true);
    expect(ca!.classList.contains('spenta')).toBe(false);
    expect(cc!.classList.contains('spenta')).toBe(true);
    tocca(ca!);
    tocca(cc!);
    expect(gesti).toEqual([{ tipo: 'carta', carta: A }]);
    // Trascinata sulla tovaglia (sopra y 640 della scena)
    evento('pointerdown', ca!, 100, 700);
    evento('pointermove', ca!, 100, 650);
    evento('pointermove', ca!, 100, 500);
    evento('pointerup', ca!, 100, 500);
    expect(gesti[1]).toEqual({ tipo: 'trascinata', carta: A });
  });

  it('carteComandate: con la mano coperta niente è toccabile, sollevato o trascinabile', () => {
    const d = domanda({ carte: [A, B], sollevate: [A], trascinabili: [B] });
    expect(carteComandate(d, true)).toEqual({ toccabili: [A, B], sollevate: [A], trascinabili: [B] });
    expect(carteComandate(d, false)).toEqual({ toccabili: [], sollevate: [], trascinabili: [] });
  });

  it('fotografia con mano null e domanda con carte: nessuna carta toccabile; con la mano scoperta (poi) sì', () => {
    const t = nuovo(foto(3, null));
    const { gesti, suGesto } = registra();
    t.chiedi(domanda({ carte: [A, B], sollevate: [A], trascinabili: [A] }), suGesto);
    expect(carte()).toHaveLength(0);
    for (const dorso of qa('.mano .cm.dorso')) {
      tocca(dorso);
      expect(dorso.classList.contains('attiva')).toBe(false);
    }
    expect(gesti).toEqual([]);
    expect(q('.pulsanti-carta')!.hidden).toBe(true);
    // La stessa domanda resta: appena la fotografia ha la mano, le carte rispondono
    t.allinea(foto(3, [A, B, C]), 'calmo');
    expect(carte()).toHaveLength(3);
    expect(carte()[0]!.classList.contains('attiva')).toBe(true);
    tocca(carte()[1]!);
    expect(gesti).toEqual([{ tipo: 'carta', carta: B }]);
    // E se la mano si ricopre, tornano spente
    t.allinea(foto(3, null), 'calmo');
    expect(carte()).toHaveLength(0);
  });

  it('la mano si comanda solo se la domanda o la selezione cambiano davvero: una domanda uguale non annulla il trascinamento', () => {
    const t = nuovo(foto(3, [A, B, C]));
    const d = () => domanda({ carte: [A, B, C], trascinabili: [A, B, C] });
    t.chiedi(d(), () => undefined);
    const ca = carte()[0]!;
    evento('pointerdown', ca, 100, 700);
    evento('pointermove', ca, 100, 650);
    expect(ca.classList.contains('trascinata')).toBe(true);
    t.chiedi(d(), () => undefined);
    expect(ca.classList.contains('trascinata')).toBe(true);
    // Una selezione nuova (carta sollevata) sì: annulla il trascinamento
    t.chiedi({ ...d(), sollevate: [B] }, () => undefined);
    expect(ca.classList.contains('trascinata')).toBe(false);
  });

  it('smettiDiChiedere libera la mano: il tocco solleva da solo, come prima della domanda', () => {
    const t = nuovo(foto(3, [A, B, C]));
    const { gesti, suGesto } = registra();
    t.chiedi(domanda({ carte: [A, B, C], sollevate: [B] }), suGesto);
    t.smettiDiChiedere();
    expect(carte().some((e) => e.classList.contains('attiva'))).toBe(false);
    tocca(carte()[0]!);
    expect(carte()[0]!.classList.contains('attiva')).toBe(true);
    expect(gesti).toEqual([]);
    expect(zone()).toHaveLength(0);
    expect(bottoni()).toHaveLength(0);
  });

  it('una carta sollevata dalla domanda toglie il consiglio "Tocca una carta per sollevarla"', () => {
    const t = nuovo(foto(3, [A, B, C]));
    const consiglio = t.ctx.el.consiglio;
    expect(consiglio.textContent).toBe(T.scena.consigli.solleva);
    t.chiedi(domanda({ carte: [A, B, C] }), () => undefined);
    expect(consiglio.style.opacity).not.toBe('0');
    t.chiedi(domanda({ carte: [A, B, C], sollevate: [B] }), () => undefined);
    expect(consiglio.style.opacity).toBe('0');
  });

  it('chi aveva la chiave vecchia vede "Trascina una carta…" solo alla prima domanda con carte da trascinare', () => {
    localStorage.setItem('hls-consigli-visti', '1');
    const t = nuovo(foto(3, [A, B, C]));
    const consiglio = t.ctx.el.consiglio;
    // All'avvio (il Guaio d'apertura) e con carte solo da toccare: nascosto
    expect(consiglio.style.opacity).toBe('0');
    t.chiedi(domanda({ carte: [A, B, C] }), () => undefined);
    expect(consiglio.style.opacity).toBe('0');
    t.chiedi(domanda({ carte: [A, B, C], trascinabili: [A] }), () => undefined);
    expect(consiglio.textContent).toBe(T.scena.consigli.trascina);
    expect(consiglio.style.opacity).toBe('1');
  });
});

describe('tocco sul prato', () => {
  it('con una domanda manda il gesto prato; non su mano, zone, pulsanti, dado acceso e menu', () => {
    const t = nuovo(foto(3, [A, B, C]));
    const { gesti, suGesto } = registra();
    t.chiedi(
      domanda({ carte: [A], pecore: ['g2'], dado: true, pulsanti: [{ id: 'continua', testo: 'Continua', attivo: true }] }),
      suGesto,
    );
    evento('pointerdown', q('.mondo')!);
    evento('pointerdown', q('.pila.scarti')!);
    expect(gesti).toEqual([{ tipo: 'prato' }, { tipo: 'prato' }]);
    gesti.length = 0;
    for (const el of [carte()[0]!, zonaDi('g2'), bottoni()[0]!, q('.dado-pos')!, q('.hud')!]) evento('pointerdown', el);
    expect(gesti).toEqual([]);
  });

  it('senza domanda, o dopo smettiDiChiedere, il prato non manda niente', () => {
    const t = nuovo(foto(3));
    const { gesti, suGesto } = registra();
    evento('pointerdown', q('.mondo')!);
    t.chiedi(domanda(), suGesto);
    t.smettiDiChiedere();
    evento('pointerdown', q('.mondo')!);
    expect(gesti).toEqual([]);
  });

  it('senza domanda il tocco sul prato salta come nel pezzo 2; con una domanda salta anche (regola F) e manda prato', () => {
    const t = nuovo(foto(3));
    vi.spyOn(t.ctx.regia, 'eventoInCorso').mockReturnValue(true);
    const salta = vi.spyOn(t.ctx.regia, 'salta');
    evento('pointerdown', q('.mondo')!);
    expect(salta).toHaveBeenCalledTimes(1);
    const { gesti, suGesto } = registra();
    t.chiedi(domanda(), suGesto);
    evento('pointerdown', q('.mondo')!);
    expect(salta).toHaveBeenCalledTimes(2);
    expect(gesti).toEqual([{ tipo: 'prato' }]);
  });
});

/** Nebbia fitta presa da g2: dopo 5 s la scena è libera ma il meteo continua sullo sfondo (come regista.test.ts). */
function nebbia(): { prima: Stato; dopo: Stato } {
  let s = scenario({ giocatori: 3, guaio: 'nebbia-fitta' });
  s = { ...s, fase: { nome: 'guaio_al_peggiore', destinatario: 'g2', spareggio: null } };
  s.datiRound.partecipanti = ['g1', 'g2', 'g3'];
  const prima = prosegui(s);
  expect(prima.fase.nome).toBe('belati_salvataggio');
  return { prima, dopo: applica(prima, { tipo: 'passa', giocatore: 'g2' }) };
}

describe('tocco sul prato e meteo ancora in corso sullo sfondo (regola F)', () => {
  const MANO: IdCarta[] = [A, B, C];
  /** Teatro con ambiente, scena libera (dopo i 5 s) e il meteo ancora attivo. */
  async function conMeteo(): Promise<Teatro> {
    const { prima, dopo } = nebbia();
    const t = (teatro = creaTeatro(radice, { ciclo: 'manuale', ambiente: true, giochi: false, caso: casoConSeme(5) }));
    t.recita({ ...fotoDi(prima), mano: MANO }, vista(prima));
    const v = vista(dopo);
    t.recita({ ...fotoDi(dopo), mano: MANO }, { ...v, eventi: v.eventi.filter((e) => e.seq < prima.prossimoEvento || e.tipo !== 'agnellini') });
    await finche(t, () => !t.occupato(), 10_000);
    expect(t.eventoInCorso()).toBe(true);
    return t;
  }

  it('con una domanda (anche con una carta sollevata) il tocco sul prato manda prato E salta il meteo (entro 4 s)', async () => {
    const t = await conMeteo();
    const { gesti, suGesto } = registra();
    t.chiedi(domanda({ carte: MANO, sollevate: [B], pecore: ['g3'] }), suGesto);
    expect(carte()[1]!.classList.contains('attiva')).toBe(true);
    evento('pointerdown', q('.mondo')!);
    expect(gesti).toEqual([{ tipo: 'prato' }]);
    expect(t.ctx.regia.salto).toBe(true);
    let ms = 0;
    while (t.eventoInCorso() && ms < 10_000) {
      t.avanza(33);
      ms += 33;
      await scarica();
    }
    expect(t.eventoInCorso()).toBe(false);
    // Come il salto del Guaio nebbia di meteo.test.ts: il resto della nebbia (~12 s di scena) corre a velocità 6
    expect(ms).toBeLessThanOrEqual(4000);
    expect(errori).not.toHaveBeenCalled();
  });

  it('un tocco su zona, pulsante, mano, dado o menu non salta il meteo e non manda prato (la tovaglia manda prato ma non salta)', async () => {
    const t = await conMeteo();
    const { gesti, suGesto } = registra();
    t.chiedi(domanda({ carte: MANO, pecore: ['g3'], dado: true, pulsanti: [{ id: 'continua', testo: 'Continua', attivo: true }] }), suGesto);
    const salta = vi.spyOn(t.ctx.regia, 'salta');
    for (const el of [zonaDi('g3'), bottoni()[0]!, carte()[0]!, q('.dado-pos')!, q('.hud')!]) evento('pointerdown', el);
    expect(salta).not.toHaveBeenCalled();
    expect(gesti).toEqual([]);
    // La tovaglia non salta (come nel pezzo 2), ma per la domanda è prato
    evento('pointerdown', q('.coperta')!);
    expect(salta).not.toHaveBeenCalled();
    expect(gesti).toEqual([{ tipo: 'prato' }]);
    expect(t.eventoInCorso()).toBe(true);
  });

  it('senza domanda il comportamento del pezzo 2 non cambia: salta, e una carta sollevata da sola lo impedisce', async () => {
    const t = await conMeteo();
    const salta = vi.spyOn(t.ctx.regia, 'salta');
    tocca(carte()[0]!);
    expect(carte()[0]!.classList.contains('attiva')).toBe(true);
    evento('pointerdown', q('.mondo')!);
    // Il tocco sul prato abbassa la carta (toccoScena); il salto era impedito dalla carta alzata
    expect(salta).not.toHaveBeenCalled();
    evento('pointerdown', q('.mondo')!);
    expect(salta).toHaveBeenCalledTimes(1);
  });
});

describe('scena occupata', () => {
  it('con la scena occupata chiedi non mostra niente; a recita finita compare; una nuova recita la toglie e poi la rimostra', async () => {
    const { prima, dopo } = pascolo();
    const t = (teatro = creaTeatro(radice, { ciclo: 'manuale', ambiente: false, giochi: false, caso: casoConSeme(5) }));
    t.recita(fotoDi(prima), vista(prima));
    t.recita(fotoDi(dopo), vista(dopo));
    expect(t.occupato()).toBe(true);
    const { gesti, suGesto } = registra();
    t.chiedi(domanda({ pecore: ['g2'], dado: true, pulsanti: [{ id: 'continua', testo: 'Continua', attivo: true }] }), suGesto);
    expect(zone()).toHaveLength(0);
    expect(bottoni()).toHaveLength(0);
    expect(q('.dado-pos')!.classList.contains('illuminata')).toBe(false);
    await finche(t, () => !t.occupato(), 10_000);
    expect(zone()).toHaveLength(1);
    expect(bottoni()).toHaveLength(1);
    expect(q('.dado-pos')!.classList.contains('illuminata')).toBe(true);
    zonaDi('g2').click();
    expect(gesti).toEqual([{ tipo: 'pecora', chi: 'g2' }]);
    // Una recita nuova (un Guaio curato) la toglie e, a fine recita, la rimostra
    const v = vista(dopo);
    const conCura = { ...v, eventi: [...v.eventi, { tipo: 'guaio_curato' as const, giocatore: 'g2', carta: 'insonnia#1', seq: 1000 }] };
    t.recita(fotoDi(dopo), conCura);
    expect(t.occupato()).toBe(true);
    expect(zone()).toHaveLength(0);
    expect(bottoni()).toHaveLength(0);
    await finche(t, () => !t.occupato(), 10_000);
    expect(zone()).toHaveLength(1);
    expect(bottoni()).toHaveLength(1);
    expect(errori).not.toHaveBeenCalled();
  });

  it('una domanda sostituita mentre la scena recita: a recita finita compare l\'ultima; smettiDiChiedere la cancella', async () => {
    const { prima, dopo } = pascolo();
    const t = (teatro = creaTeatro(radice, { ciclo: 'manuale', ambiente: false, giochi: false, caso: casoConSeme(5) }));
    t.recita(fotoDi(prima), vista(prima));
    t.recita(fotoDi(dopo), vista(dopo));
    t.chiedi(domanda({ pecore: ['g2'] }), () => undefined);
    t.chiedi(domanda({ pecore: ['g3'] }), () => undefined);
    await finche(t, () => !t.occupato(), 10_000);
    expect(zone().map((z) => z.dataset.chi)).toEqual(['g3']);
    t.smettiDiChiedere();
    expect(zone()).toHaveLength(0);
    t.chiedi(domanda({ pecore: ['g2'] }), () => undefined);
    t.recita(fotoDi(dopo), { ...vista(dopo), eventi: [...vista(dopo).eventi, { tipo: 'guaio_curato' as const, giocatore: 'g2', carta: 'insonnia#1', seq: 1000 }] });
    t.smettiDiChiedere();
    await finche(t, () => !t.occupato(), 10_000);
    expect(zone()).toHaveLength(0);
  });

  it('con la scena occupata la mano torna libera; a scena libera la domanda la riprende con le carte sollevate', async () => {
    const { prima, dopo } = pascolo();
    const t = (teatro = creaTeatro(radice, { ciclo: 'manuale', ambiente: false, giochi: false, caso: casoConSeme(5) }));
    t.recita({ ...fotoDi(prima), mano: [A, B, C] }, vista(prima));
    t.chiedi(domanda({ carte: [A, B, C], sollevate: [B] }), () => undefined);
    expect(carte()[1]!.classList.contains('attiva')).toBe(true);
    t.recita({ ...fotoDi(dopo), mano: [A, B, C] }, vista(dopo));
    expect(t.occupato()).toBe(true);
    expect(carte().some((e) => e.classList.contains('attiva'))).toBe(false);
    await finche(t, () => !t.occupato(), 10_000);
    expect(carte()[1]!.classList.contains('attiva')).toBe(true);
  });
});

describe('ricostruzione e adattamento', () => {
  it('con un altro giocatore in basso il tavolo si ricostruisce e le zone stanno sui posti nuovi', () => {
    const t = nuovo(foto(3, null, 'g1'));
    t.chiedi(domanda({ pecore: ['g2'] }), () => undefined);
    const prima = rettDi(zonaDi('g2'));
    const vecchia = pecoraDi('g2');
    // g2 è un avversario in alto: la zona sta nella metà alta della scena
    expect(prima[1]).toBeLessThan(300);
    t.allinea(foto(3, null, 'g2'), 'calmo');
    expect(pecoraDi('g2')).not.toBe(vecchia);
    expect(zone()).toHaveLength(1);
    const dopo = rettDi(zonaDi('g2'));
    // Ora g2 sta in basso, dove stava g1
    expect(dopo[1]).toBeGreaterThan(400);
    expect(pecoraDi('g2').classList.contains('illuminata')).toBe(true);
    for (const r of recintiDi('g2')) expect(r.classList.contains('illuminata')).toBe(true);
    expect(pecoraDi('g1').classList.contains('illuminata')).toBe(false);
  });

  it('un numero di giocatori diverso: le zone di chi non c\'è più spariscono, senza errori', () => {
    const t = nuovo(foto(4));
    t.chiedi(domanda({ pecore: ['g2', 'g4'] }), () => undefined);
    expect(zone()).toHaveLength(2);
    t.allinea(foto(2), 'calmo');
    expect(zone().map((z) => z.dataset.chi)).toEqual(['g2']);
    expect(errori).not.toHaveBeenCalled();
  });

  it('adatta riposiziona le zone; distruggere il teatro toglie tutto', () => {
    const t = nuovo(foto(3));
    t.chiedi(domanda({ pecore: ['g2'], pulsanti: [{ id: 'continua', testo: 'Continua', attivo: true }] }), () => undefined);
    t.adatta();
    expect(zone()).toHaveLength(1);
    t.distruggi();
    expect(radice.querySelector('.zona')).toBeNull();
    expect(radice.querySelector('.pulsanti-fila')).toBeNull();
    teatro = null;
  });
});

describe('fuoco da tastiera', () => {
  const continua = { id: 'continua' as const, testo: 'Continua', attivo: true };
  /** Teatro con una recita già fatta (la fotografia di `prima`, mano A B C): la prossima recita lo rende occupato. */
  function conRecita(): { t: Teatro; dopo: Stato } {
    const { prima, dopo } = pascolo();
    const t = (teatro = creaTeatro(radice, { ciclo: 'manuale', ambiente: false, giochi: false, caso: casoConSeme(5) }));
    t.recita({ ...fotoDi(prima), mano: [A, B, C] }, vista(prima));
    return { t, dopo };
  }
  /** Una recita nuova: la prima volta il Pascolo, poi un Guaio curato in più ogni volta (eventi nuovi da recitare). */
  let curati = 0;
  const recita = (t: Teatro, dopo: Stato): void => {
    const v = vista(dopo);
    const extra = Array.from({ length: curati }, (_, i) => ({ tipo: 'guaio_curato' as const, giocatore: 'g2', carta: 'insonnia#1', seq: 1000 + i }));
    curati++;
    t.recita({ ...fotoDi(dopo), mano: [A, B, C] }, { ...v, eventi: [...v.eventi, ...extra] });
    expect(t.occupato()).toBe(true);
  };
  beforeEach(() => {
    curati = 0;
  });

  it('Invio su una carta della mano e poi Invio su "Gioca": i gesti arrivano in ordine e il fuoco resta sulla carta', () => {
    const t = nuovo(foto(3, [A, B, C]));
    const gesti: Gesto[] = [];
    const d = (sollevate: IdCarta[]) =>
      domanda({ carte: [A, B, C], sollevate, pulsanti: [{ id: 'gioca', testo: 'Gioca', attivo: sollevate.length > 0, sottoLaCarta: true }] });
    // Come Partita: il tocco su una carta la solleva e la domanda torna con "Gioca" acceso
    const suGesto = (g: Gesto): void => {
      gesti.push(g);
      if (g.tipo === 'carta') t.chiedi(d([g.carta]), suGesto);
    };
    t.chiedi(d([]), suGesto);
    const ca = carte()[0]!;
    expect(ca.tabIndex).toBe(0);
    ca.focus();
    tasto(ca, 'Enter');
    expect(document.activeElement).toBe(ca);
    expect(ca.getAttribute('aria-pressed')).toBe('true');
    expect(q('.pulsanti-carta')!.hidden).toBe(false);
    const gioca = q<HTMLButtonElement>('.pulsanti-carta button')!;
    expect(gioca.disabled).toBe(false);
    // Invio su un vero button è il suo clic
    gioca.focus();
    gioca.click();
    expect(gesti).toEqual([
      { tipo: 'carta', carta: A },
      { tipo: 'pulsante', id: 'gioca' },
    ]);
  });

  it('dopo una recita che toglie e rimette la domanda il fuoco torna sul pulsante con lo stesso id', async () => {
    const { t, dopo } = conRecita();
    t.chiedi(domanda({ pecore: ['g2'], pulsanti: [continua] }), () => undefined);
    bottoni()[0]!.focus();
    recita(t, dopo);
    expect(bottoni()).toHaveLength(0);
    await finche(t, () => !t.occupato(), 10_000);
    expect(bottoni()).toHaveLength(1);
    expect(document.activeElement).toBe(bottoni()[0]);
  });

  it('dopo una recita il fuoco torna sulla stessa carta se risponde ancora, altrimenti sul primo controllo acceso', async () => {
    const { t, dopo } = conRecita();
    t.chiedi(domanda({ carte: [A, B, C] }), () => undefined);
    carte()[1]!.focus();
    recita(t, dopo);
    await finche(t, () => !t.occupato(), 10_000);
    expect(document.activeElement).toBe(carte()[1]);
    // Una domanda nuova durante la recita, senza carte: il fuoco va alla prima zona accesa
    recita(t, dopo);
    t.chiedi(domanda({ pecore: ['g3', 'g2'], pulsanti: [continua] }), () => undefined);
    await finche(t, () => !t.occupato(), 10_000);
    expect(document.activeElement).toBe(zone()[0]);
  });

  it('un pulsante che sparisce tra una domanda e l\'altra passa il fuoco al primo controllo acceso, non al documento', () => {
    const t = nuovo(foto(3));
    t.chiedi(domanda({ pulsanti: [continua] }), () => undefined);
    bottoni()[0]!.focus();
    t.chiedi(domanda({ dado: true, pulsanti: [{ id: 'nessuno', testo: 'Nessuno', attivo: true }] }), () => undefined);
    expect(document.activeElement).toBe(q('.zona-dado'));
  });

  it('il fuoco non si ruba: se era fuori dalla scena (o da nessuna parte) resta dov\'è', async () => {
    const { t, dopo } = conRecita();
    const fuori = document.createElement('button');
    document.body.appendChild(fuori);
    try {
      t.chiedi(domanda({ pecore: ['g2'], pulsanti: [continua] }), () => undefined);
      fuori.focus();
      recita(t, dopo);
      await finche(t, () => !t.occupato(), 10_000);
      expect(document.activeElement).toBe(fuori);
      // Fuoco dentro prima della recita, ma spostato fuori durante: resta fuori
      bottoni()[0]!.focus();
      recita(t, dopo);
      fuori.focus();
      await finche(t, () => !t.occupato(), 10_000);
      expect(document.activeElement).toBe(fuori);
      // Nessun fuoco: una domanda nuova non lo prende
      fuori.blur();
      t.chiedi(domanda({ pecore: ['g3'] }), () => undefined);
      expect(document.activeElement).toBe(document.body);
    } finally {
      fuori.remove();
    }
  });
});

describe('accessibilità e pensiero', () => {
  it('aria-hidden sta sul mondo disegnato (.camera), non sullo strato .ui', () => {
    const t = nuovo(foto(3));
    t.chiedi(domanda({ pecore: ['g2'] }), () => undefined);
    expect(q('.camera')!.getAttribute('aria-hidden')).toBe('true');
    expect(q('.ui')!.closest('[aria-hidden="true"]')).toBeNull();
    expect(zonaDi('g2').closest('[aria-hidden="true"]')).toBeNull();
  });

  it('pensa: la nuvoletta aspetta la scena libera, il pulsante chiama la sua azione, null la toglie', async () => {
    const { prima, dopo } = pascolo();
    const t = (teatro = creaTeatro(radice, { ciclo: 'manuale', ambiente: false, giochi: false, caso: casoConSeme(5) }));
    t.recita(fotoDi(prima), vista(prima));
    const azione = vi.fn();
    t.pensa({ testo: 'Tocca una carta', pulsanti: [{ testo: 'Ho capito', azione }] });
    expect(q('.pensiero')!.textContent).toContain('Tocca una carta');
    q('.pensiero button')!.click();
    expect(azione).toHaveBeenCalledTimes(1);
    t.recita(fotoDi(dopo), vista(dopo));
    expect(t.occupato()).toBe(true);
    expect(q('.pensiero')).toBeNull();
    await finche(t, () => !t.occupato(), 10_000);
    expect(q('.pensiero')).not.toBeNull();
    t.pensa(null);
    expect(q('.pensiero')).toBeNull();
  });

  it('pensa con lo stesso pensiero e domande che si ripetono non ricrea la nuvoletta', () => {
    const t = nuovo(foto(3));
    const p = { testo: 'Ciao', pulsanti: [{ testo: 'Ho capito', azione: () => undefined }] };
    t.pensa(p);
    const el = q('.pensiero')!;
    t.pensa(p);
    t.chiedi(domanda(), () => undefined);
    t.chiedi(domanda({ dado: true }), () => undefined);
    expect(q('.pensiero')).toBe(el);
    t.pensa({ ...p });
    expect(q('.pensiero')).not.toBe(el);
    expect(qa('.pensiero')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Compito 5: carte grandi, carta al centro, Guai dell'angolo, furto e nuvoletta del pensiero
// ---------------------------------------------------------------------------------------------------------------------

const GUAIO_1: IdCarta = 'insonnia#1';
const GUAIO_2: IdCarta = 'nebbia-fitta#1';

/** Fotografia di `n` giocatori con i Guai nell'angolo di g1 (chi sta in basso). */
function fotoConGuai(n: 2 | 3 | 4, guai: IdCarta[]): Fotografia {
  const f = foto(n);
  return { ...f, posti: f.posti.map((p) => (p.id === 'g1' ? { ...p, angolo: guai } : p)) };
}

/** Fotografia con un numero deciso di agnellini nei recinti (il gregge resta com'è). */
function fotoConAgnellini(n: 2 | 3 | 4, conti: Record<string, number>): Fotografia {
  const f = foto(n);
  return { ...f, posti: f.posti.map((p) => ({ ...p, agnellini: conti[p.id] ?? p.agnellini })) };
}

const nomeCarta = (id: IdCarta): string => defCarta(id).nome;
const grandi = () => qa('.ui .carta-grande');
const alCentro = () => q('.ui .carta-grande.al-centro');
const minis = () => qa('.mini');
const miniDi = (carta: IdCarta) => minis().find((m) => m.dataset.carta === carta)!;
const alzati = () => qa('.agn.alzato');
const alzatiDi = (chi: string) => qa(`.ui .agnellino-alzato[data-chi="${chi}"]`);
/** L'altezza del corpo dell'agnellino (il y del translate): più è negativa, più è alzato. */
const quotaCorpo = (agn: Element): number =>
  parseFloat(/translate\(-14px,(-?[\d.]+)px\)/.exec((agn.querySelector('.corpo') as HTMLElement).style.transform)![1]!);
const sceneRidotte = () => vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
/** Centro e scala di una carta grande dal suo transform (trasf di mano.ts). */
function misuraGrande(e: HTMLElement): { cx: number; cy: number; k: number } {
  const m = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)\s*rotate\([^)]*\)\s*scale\(([\d.]+),/.exec(e.style.transform)!;
  return { cx: parseFloat(m[1]!) + 125, cy: parseFloat(m[2]!) + 175, k: parseFloat(m[3]!) };
}

describe('carta al centro', () => {
  it('la carta sta al centro della tovaglia, solo da guardare: nessun gesto con tocco, clic e tasti', () => {
    const t = nuovo(foto(3));
    const { gesti, suGesto } = registra();
    t.chiedi(domanda({ centro: A }), suGesto);
    const c = alCentro()!;
    expect(c).not.toBeNull();
    expect(c.querySelector('svg')).not.toBeNull();
    expect(c.getAttribute('aria-label')).toBe(nomeCarta(A));
    expect(c.getAttribute('role')).not.toBe('button');
    expect(c.hasAttribute('tabindex')).toBe(false);
    const m = misuraGrande(c);
    expect(m.cx).toBeCloseTo(195, 0);
    expect(m.cy).toBeCloseTo(360, 0);
    tocca(c);
    c.click();
    tasto(c, 'Enter');
    expect(gesti).toEqual([]);
  });

  it('tenendola premuta si apre la lettura, al rilascio si chiude; nessun gesto', () => {
    vi.useFakeTimers();
    const t = nuovo(foto(3));
    const { gesti, suGesto } = registra();
    t.chiedi(domanda({ centro: A }), suGesto);
    evento('pointerdown', alCentro()!);
    expect(q('.lettura')).toBeNull();
    vi.advanceTimersByTime(600);
    expect(q('.lettura')).not.toBeNull();
    evento('pointerup', alCentro()!);
    expect(q('.lettura')).toBeNull();
    expect(gesti).toEqual([]);
  });

  it("si ricorda tra una domanda e l'altra (stessa carta, stesso elemento), cambia con un'altra carta e sparisce senza centro", () => {
    const t = nuovo(foto(3));
    t.chiedi(domanda({ centro: A }), () => undefined);
    const el = alCentro()!;
    t.chiedi(domanda({ centro: A, dado: true }), () => undefined);
    expect(alCentro()).toBe(el);
    t.chiedi(domanda({ centro: B }), () => undefined);
    expect(qa('.ui .carta-grande.al-centro')).toHaveLength(1);
    expect(alCentro()!.getAttribute('aria-label')).toBe(nomeCarta(B));
    t.chiedi(domanda(), () => undefined);
    expect(alCentro()).toBeNull();
  });

  it('un tocco sulla carta al centro non è un tocco sul prato', () => {
    const t = nuovo(foto(3));
    const { gesti, suGesto } = registra();
    t.chiedi(domanda({ centro: A }), suGesto);
    evento('pointerdown', alCentro()!);
    evento('pointerup', alCentro()!);
    expect(gesti).toEqual([]);
  });
});

describe('carte grandi (Guarda le prime 2)', () => {
  it('due carte affiancate sopra la tovaglia, toccabili, col nome della carta: il tocco dà il gesto grande con la carta giusta', () => {
    const t = nuovo(foto(3));
    const { gesti, suGesto } = registra();
    t.chiedi(domanda({ grandi: [A, B] }), suGesto);
    const g = grandi();
    expect(g).toHaveLength(2);
    expect(g.map((e) => e.getAttribute('role'))).toEqual(['button', 'button']);
    expect(g.map((e) => e.getAttribute('aria-label'))).toEqual([nomeCarta(A), nomeCarta(B)]);
    expect(g.map((e) => e.getAttribute('tabindex'))).toEqual(['0', '0']);
    expect(g.every((e) => e.querySelector('svg') !== null)).toBe(true);
    tocca(g[1]!);
    tocca(g[0]!);
    expect(gesti).toEqual([
      { tipo: 'grande', carta: B },
      { tipo: 'grande', carta: A },
    ]);
  });

  it('Invio, Spazio e clic (tastiera, lettore di schermo) danno lo stesso gesto, una volta sola', () => {
    const t = nuovo(foto(3));
    const { gesti, suGesto } = registra();
    t.chiedi(domanda({ grandi: [A, B] }), suGesto);
    tasto(grandi()[0]!, 'Enter');
    tasto(grandi()[1]!, ' ');
    tasto(grandi()[1]!, 'a');
    grandi()[0]!.click();
    expect(gesti).toEqual([
      { tipo: 'grande', carta: A },
      { tipo: 'grande', carta: B },
      { tipo: 'grande', carta: A },
    ]);
  });

  it('le carte stanno affiancate senza sovrapporsi, a sinistra e a destra del centro, dentro la scena', () => {
    const t = nuovo(foto(3));
    t.chiedi(domanda({ grandi: [A, B] }), () => undefined);
    const m = grandi().map(misuraGrande);
    expect(m[0]!.cx).toBeLessThan(195);
    expect(m[1]!.cx).toBeGreaterThan(195);
    expect(m[1]!.cx - m[0]!.cx).toBeGreaterThanOrEqual(250 * m[0]!.k);
    for (const c of m) {
      expect(c.cx - 125 * c.k).toBeGreaterThanOrEqual(0);
      expect(c.cx + 125 * c.k).toBeLessThanOrEqual(390);
      expect(c.cy).toBeGreaterThan(150);
      expect(c.cy).toBeLessThan(560);
    }
  });

  it('con tre o quattro carte restano dentro la scena e senza sovrapporsi', () => {
    const t = nuovo(foto(3));
    const tutte: IdCarta[] = [A, B, C, 'coperta-di-lana#1'];
    for (const n of [3, 4]) {
      t.chiedi(domanda({ grandi: tutte.slice(0, n) }), () => undefined);
      const m = grandi().map(misuraGrande);
      expect(m).toHaveLength(n);
      m.sort((a, b) => a.cx - b.cx);
      for (let i = 0; i < n; i++) {
        expect(m[i]!.cx - 125 * m[i]!.k).toBeGreaterThanOrEqual(-0.5);
        expect(m[i]!.cx + 125 * m[i]!.k).toBeLessThanOrEqual(390.5);
        if (i > 0) expect(m[i]!.cx - m[i - 1]!.cx).toBeGreaterThanOrEqual(125 * (m[i]!.k + m[i - 1]!.k) - 0.5);
      }
    }
  });

  it('tenuta premuta: lettura aperta (e nessun gesto); al rilascio si chiude; un tocco breve non apre la lettura', () => {
    vi.useFakeTimers();
    const t = nuovo(foto(3));
    const { gesti, suGesto } = registra();
    t.chiedi(domanda({ grandi: [A, B] }), suGesto);
    evento('pointerdown', grandi()[0]!);
    vi.advanceTimersByTime(600);
    expect(q('.lettura')).not.toBeNull();
    expect(q('.lettura .grande svg')).not.toBeNull();
    evento('pointerup', grandi()[0]!);
    expect(q('.lettura')).toBeNull();
    expect(gesti).toEqual([]);
    tocca(grandi()[1]!);
    vi.advanceTimersByTime(600);
    expect(q('.lettura')).toBeNull();
    expect(gesti).toEqual([{ tipo: 'grande', carta: B }]);
  });

  it.each([1, 2])('clic con il tasto %i del mouse (centrale, destro) su una carta grande: né gesto né lettura', (tasto) => {
    vi.useFakeTimers();
    const t = nuovo(foto(3));
    const { gesti, suGesto } = registra();
    t.chiedi(domanda({ grandi: [A, B] }), suGesto);
    eventoMouse('pointerdown', grandi()[0]!, tasto);
    vi.advanceTimersByTime(600);
    expect(q('.lettura')).toBeNull();
    eventoMouse('pointerup', grandi()[0]!, tasto);
    expect(gesti).toEqual([]);
    // Il tasto sinistro del mouse è un tocco
    eventoMouse('pointerdown', grandi()[0]!, 0);
    eventoMouse('pointerup', grandi()[0]!, 0);
    expect(gesti).toEqual([{ tipo: 'grande', carta: A }]);
  });

  it('un dito che si muove molto non è un tocco e non apre la lettura', () => {
    vi.useFakeTimers();
    const t = nuovo(foto(3));
    const { gesti, suGesto } = registra();
    t.chiedi(domanda({ grandi: [A, B] }), suGesto);
    evento('pointerdown', grandi()[0]!, 100, 300);
    evento('pointermove', grandi()[0]!, 100, 380);
    vi.advanceTimersByTime(600);
    evento('pointerup', grandi()[0]!, 100, 380);
    expect(q('.lettura')).toBeNull();
    expect(gesti).toEqual([]);
  });

  it('un tocco sulle carte grandi non è un tocco sul prato; il prato accanto sì', () => {
    const t = nuovo(foto(3));
    const { gesti, suGesto } = registra();
    t.chiedi(domanda({ grandi: [A, B] }), suGesto);
    evento('pointerdown', grandi()[0]!);
    evento('pointerup', grandi()[0]!);
    expect(gesti).toEqual([{ tipo: 'grande', carta: A }]);
    evento('pointerdown', q('.mondo')!);
    expect(gesti[1]).toEqual({ tipo: 'prato' });
  });

  it('le stesse carte restano gli stessi elementi tra due domande; togliere la domanda le toglie e chiude la lettura', () => {
    vi.useFakeTimers();
    const t = nuovo(foto(3));
    t.chiedi(domanda({ grandi: [A, B] }), () => undefined);
    const prima = grandi();
    t.chiedi(domanda({ grandi: [A, B], dado: true }), () => undefined);
    expect(grandi()).toEqual(prima);
    evento('pointerdown', grandi()[0]!);
    vi.advanceTimersByTime(600);
    expect(q('.lettura')).not.toBeNull();
    t.smettiDiChiedere();
    expect(grandi()).toHaveLength(0);
    expect(q('.lettura')).toBeNull();
    // Il rilascio che arriva dopo non fa niente
    evento('pointerup', document.body);
  });

  it("una tenuta in corso quando la domanda cambia non apre la lettura di una carta che non c'è più", () => {
    vi.useFakeTimers();
    const t = nuovo(foto(3));
    const { gesti, suGesto } = registra();
    t.chiedi(domanda({ grandi: [A, B] }), suGesto);
    evento('pointerdown', grandi()[0]!);
    t.smettiDiChiedere();
    vi.advanceTimersByTime(600);
    expect(q('.lettura')).toBeNull();
    evento('pointerup', document.body);
    expect(gesti).toEqual([]);
  });

  it('distruggere il teatro toglie tutto', () => {
    const t = nuovo(foto(3));
    t.chiedi(domanda({ grandi: [A, B], centro: C }), () => undefined);
    t.distruggi();
    expect(radice.querySelector('.carta-grande')).toBeNull();
    teatro = null;
  });
});

describe("Guai dell'angolo", () => {
  it('con una domanda che li elenca le mini si illuminano; le altre no', () => {
    const t = nuovo(fotoConGuai(3, [GUAIO_1, GUAIO_2]));
    expect(minis()).toHaveLength(2);
    t.chiedi(domanda({ guai: [GUAIO_2] }), () => undefined);
    expect(miniDi(GUAIO_2).classList.contains('illuminata')).toBe(true);
    expect(miniDi(GUAIO_1).classList.contains('illuminata')).toBe(false);
  });

  it('il Guaio scelto dalla domanda ha la classe "scelta" (resta illuminato), gli altri no; senza domanda nessuno', () => {
    const t = nuovo(fotoConGuai(3, [GUAIO_1, GUAIO_2]));
    t.chiedi(domanda({ guai: [GUAIO_1, GUAIO_2], guaioScelto: GUAIO_2 }), () => undefined);
    expect(miniDi(GUAIO_2).classList.contains('scelta')).toBe(true);
    expect(miniDi(GUAIO_2).classList.contains('illuminata')).toBe(true);
    expect(miniDi(GUAIO_1).classList.contains('scelta')).toBe(false);
    t.chiedi(domanda({ guai: [GUAIO_1, GUAIO_2], guaioScelto: null }), () => undefined);
    expect(miniDi(GUAIO_2).classList.contains('scelta')).toBe(false);
    t.chiedi(domanda({ guai: [GUAIO_1, GUAIO_2], guaioScelto: GUAIO_1 }), () => undefined);
    expect(miniDi(GUAIO_1).classList.contains('scelta')).toBe(true);
    t.smettiDiChiedere();
    expect(miniDi(GUAIO_1).classList.contains('scelta')).toBe(false);
  });

  it('il tocco su una mini illuminata è il gesto guaio (e non apre la lettura, non è prato)', () => {
    const t = nuovo(fotoConGuai(3, [GUAIO_1, GUAIO_2]));
    const { gesti, suGesto } = registra();
    t.chiedi(domanda({ guai: [GUAIO_1, GUAIO_2] }), suGesto);
    tocca(miniDi(GUAIO_2));
    tocca(miniDi(GUAIO_1));
    expect(gesti).toEqual([
      { tipo: 'guaio', carta: GUAIO_2 },
      { tipo: 'guaio', carta: GUAIO_1 },
    ]);
    expect(q('.lettura')).toBeNull();
  });

  it('clic destro su una mini illuminata: nessun gesto guaio e nessuna lettura', () => {
    vi.useFakeTimers();
    const t = nuovo(fotoConGuai(3, [GUAIO_1]));
    const { gesti, suGesto } = registra();
    t.chiedi(domanda({ guai: [GUAIO_1] }), suGesto);
    // Un clic veloce non è un tocco
    eventoMouse('pointerdown', miniDi(GUAIO_1), 2);
    eventoMouse('pointerup', miniDi(GUAIO_1), 2);
    expect(gesti).toEqual([]);
    // Tenuto premuto non apre la lettura
    eventoMouse('pointerdown', miniDi(GUAIO_1), 2);
    vi.advanceTimersByTime(600);
    expect(q('.lettura')).toBeNull();
    eventoMouse('pointerup', miniDi(GUAIO_1), 2);
    expect(gesti).toEqual([]);
  });

  it('tenuta premuta su una mini illuminata: lettura (come la mano), nessun gesto; al rilascio si chiude', () => {
    vi.useFakeTimers();
    const t = nuovo(fotoConGuai(3, [GUAIO_1]));
    const { gesti, suGesto } = registra();
    t.chiedi(domanda({ guai: [GUAIO_1] }), suGesto);
    evento('pointerdown', miniDi(GUAIO_1));
    expect(q('.lettura')).toBeNull();
    vi.advanceTimersByTime(600);
    expect(q('.lettura')).not.toBeNull();
    evento('pointerup', miniDi(GUAIO_1));
    expect(q('.lettura')).toBeNull();
    expect(gesti).toEqual([]);
  });

  it('una mini non elencata dalla domanda apre la lettura al tocco, come oggi, e non manda gesti', () => {
    const t = nuovo(fotoConGuai(3, [GUAIO_1, GUAIO_2]));
    const { gesti, suGesto } = registra();
    t.chiedi(domanda({ guai: [GUAIO_1] }), suGesto);
    evento('pointerdown', miniDi(GUAIO_2));
    expect(q('.lettura')).not.toBeNull();
    expect(gesti).toEqual([]);
  });

  it("senza domanda (mai chiesta, o tolta) il tocco sulla mini apre la lettura come oggi, e la luce non c'è più", () => {
    const t = nuovo(fotoConGuai(3, [GUAIO_1]));
    const { gesti, suGesto } = registra();
    evento('pointerdown', miniDi(GUAIO_1));
    expect(q('.lettura')).not.toBeNull();
    q('.lettura')!.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    expect(q('.lettura')).toBeNull();
    t.chiedi(domanda({ guai: [GUAIO_1] }), suGesto);
    expect(miniDi(GUAIO_1).classList.contains('illuminata')).toBe(true);
    t.smettiDiChiedere();
    expect(miniDi(GUAIO_1).classList.contains('illuminata')).toBe(false);
    evento('pointerdown', miniDi(GUAIO_1));
    expect(q('.lettura')).not.toBeNull();
    expect(gesti).toEqual([]);
  });

  it('da tastiera: un controllo raggiungibile con Tab, col nome del Guaio, dà il gesto guaio; sta nello strato .ui', () => {
    const t = nuovo(fotoConGuai(3, [GUAIO_1, GUAIO_2]));
    const { gesti, suGesto } = registra();
    t.chiedi(domanda({ guai: [GUAIO_2] }), suGesto);
    const z = qa('.ui .zona-guaio');
    expect(z).toHaveLength(1);
    expect(z[0]!.getAttribute('role')).toBe('button');
    expect(z[0]!.getAttribute('tabindex')).toBe('0');
    expect(z[0]!.getAttribute('aria-label')).toBe(nomeCarta(GUAIO_2));
    expect(z[0]!.closest('[aria-hidden="true"]')).toBeNull();
    tasto(z[0]!, 'Enter');
    z[0]!.click();
    expect(gesti).toEqual([
      { tipo: 'guaio', carta: GUAIO_2 },
      { tipo: 'guaio', carta: GUAIO_2 },
    ]);
    t.smettiDiChiedere();
    expect(qa('.ui .zona-guaio')).toHaveLength(0);
  });

  it("un Guaio nominato che non è nell'angolo (o con l'angolo vuoto) non rompe niente", () => {
    const t = nuovo(foto(3));
    t.chiedi(domanda({ guai: [GUAIO_1] }), () => undefined);
    expect(qa('.ui .zona-guaio')).toHaveLength(0);
    expect(errori).not.toHaveBeenCalled();
  });

  it('le mini degli avversari non si illuminano mai', () => {
    const f = foto(3);
    const conGuaiAltrui = { ...f, posti: f.posti.map((p) => (p.id === 'g2' ? { ...p, angolo: [GUAIO_1] } : p)) };
    const t = nuovo(conGuaiAltrui);
    t.chiedi(domanda({ guai: [GUAIO_1] }), () => undefined);
    expect(minis().every((m) => !m.classList.contains('illuminata'))).toBe(true);
  });

  it("se i Guai cambiano nell'angolo (curato) la luce e il controllo da tastiera seguono la fotografia", () => {
    const t = nuovo(fotoConGuai(3, [GUAIO_1, GUAIO_2]));
    t.chiedi(domanda({ guai: [GUAIO_1, GUAIO_2] }), () => undefined);
    expect(qa('.ui .zona-guaio')).toHaveLength(2);
    t.allinea(fotoConGuai(3, [GUAIO_2]), 'calmo');
    expect(minis()).toHaveLength(1);
    expect(qa('.ui .zona-guaio')).toHaveLength(1);
    expect(miniDi(GUAIO_2).classList.contains('illuminata')).toBe(true);
  });
});

describe('furto', () => {
  it('presi: { g2: 2 } alza due agnellini nel recinto di g2; gli altri recinti restano fermi', () => {
    const t = nuovo(fotoConAgnellini(3, { g1: 4, g2: 5, g3: 4 }));
    t.chiedi(domanda({ furto: { presi: { g2: 2 } } }), () => undefined);
    t.avanza(33);
    expect(alzati()).toHaveLength(2);
    expect(alzatiDi('g2')).toHaveLength(2);
    expect(alzatiDi('g3')).toHaveLength(0);
    // Stanno nel recinto di g2
    const [x0, y0, x1, y1] = disposizione(3).posti[1]!.area;
    for (const a of alzati()) {
      const m = /translate\((-?[\d.]+)px,(-?[\d.]+)px\)/.exec(a.style.transform)!;
      expect(parseFloat(m[1]!)).toBeGreaterThanOrEqual(x0 - 2);
      expect(parseFloat(m[1]!)).toBeLessThanOrEqual(x1 + 2);
      expect(parseFloat(m[2]!)).toBeGreaterThanOrEqual(y0 - 2);
      expect(parseFloat(m[2]!)).toBeLessThanOrEqual(y1 + 2);
    }
  });

  it('prende da più avversari insieme', () => {
    const t = nuovo(fotoConAgnellini(4, { g1: 3, g2: 4, g3: 4, g4: 4 }));
    t.chiedi(domanda({ furto: { presi: { g2: 1, g4: 2 } } }), () => undefined);
    t.avanza(33);
    expect(alzatiDi('g2')).toHaveLength(1);
    expect(alzatiDi('g3')).toHaveLength(0);
    expect(alzatiDi('g4')).toHaveLength(2);
    expect(alzati()).toHaveLength(3);
  });

  it('gli agnellini alzati sono solo decorazione: area, conti e numero di agnellini non cambiano, né mentre sono alzati né dopo', () => {
    const t = nuovo(fotoConAgnellini(3, { g1: 4, g2: 5, g3: 4 }));
    const prima = JSON.stringify(t.stato().agnellini);
    const totale = t.stato().posizioni.length;
    t.chiedi(domanda({ furto: { presi: { g2: 2, g3: 1 } } }), () => undefined);
    t.avanza(1000);
    expect(alzati()).toHaveLength(3);
    expect(JSON.stringify(t.stato().agnellini)).toBe(prima);
    expect(t.stato().posizioni).toHaveLength(totale);
    expect(t.stato().agnellini.g2).toEqual({ assegnati: 5, mostrati: 5 });
    t.smettiDiChiedere();
    t.avanza(2000);
    expect(alzati()).toHaveLength(0);
    expect(JSON.stringify(t.stato().agnellini)).toBe(prima);
    expect(t.stato().fuori).toBe(0);
    expect(t.stato().agnellini.g2).toEqual({ assegnati: 5, mostrati: 5 });
  });

  it('toccando un agnellino alzato: gesto agnellino con il suo giocatore (e non è prato); la zona resta la pecora', () => {
    const t = nuovo(fotoConAgnellini(3, { g1: 4, g2: 5, g3: 4 }));
    const { gesti, suGesto } = registra();
    t.chiedi(domanda({ pecore: ['g2', 'g3'], furto: { presi: { g2: 2 } } }), suGesto);
    t.avanza(33);
    const [uno, due] = alzatiDi('g2');
    expect(uno!.getAttribute('role')).toBe('button');
    expect(uno!.getAttribute('tabindex')).toBe('0');
    expect(uno!.getAttribute('aria-label')).toBe(T.scena.scelte.agnellinoAlzato('G2'));
    tocca(uno!);
    due!.click();
    tasto(uno!, 'Enter');
    expect(gesti).toEqual([
      { tipo: 'agnellino', chi: 'g2' },
      { tipo: 'agnellino', chi: 'g2' },
      { tipo: 'agnellino', chi: 'g2' },
    ]);
    gesti.length = 0;
    zonaDi('g3').click();
    expect(gesti).toEqual([{ tipo: 'pecora', chi: 'g3' }]);
  });

  it('agnellini, zone e pulsanti: il tasto destro o centrale non è un tocco, il tasto tenuto premuto non si ripete', () => {
    const t = nuovo(fotoConAgnellini(3, { g1: 4, g2: 5, g3: 4 }));
    const { gesti, suGesto } = registra();
    t.chiedi(domanda({ pecore: ['g2', 'g3'], furto: { presi: { g2: 1 } }, pulsanti: [{ id: 'conferma', testo: 'Conferma', attivo: true }] }), suGesto);
    t.avanza(33);
    const [uno] = alzatiDi('g2');
    const ripetuto = (el: Element): KeyboardEvent => {
      const e = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, repeat: true });
      el.dispatchEvent(e);
      return e;
    };
    for (const tastoMouse of [1, 2]) {
      eventoMouse('pointerdown', uno!, tastoMouse);
      eventoMouse('pointerup', uno!, tastoMouse);
      for (const el of [zonaDi('g2'), bottoni()[0]!]) eventoMouse('click', el, tastoMouse);
    }
    ripetuto(uno!);
    ripetuto(zonaDi('g3'));
    // Il pulsante vero: Invio tenuto ripete il clic del browser, lo si ferma sul tasto ripetuto
    expect(ripetuto(bottoni()[0]!).defaultPrevented).toBe(true);
    expect(gesti).toEqual([]);
    // Il tasto sinistro e il primo Invio restano un tocco
    eventoMouse('pointerdown', uno!, 0);
    eventoMouse('pointerup', uno!, 0);
    tasto(zonaDi('g3'), 'Enter');
    bottoni()[0]!.click();
    expect(gesti).toEqual([
      { tipo: 'agnellino', chi: 'g2' },
      { tipo: 'pecora', chi: 'g3' },
      { tipo: 'pulsante', id: 'conferma' },
    ]);
  });

  it('il controllo di un agnellino alzato sta sopra la zona del recinto e un tocco su di lui non è prato', () => {
    const t = nuovo(fotoConAgnellini(3, { g1: 4, g2: 5, g3: 4 }));
    const { gesti, suGesto } = registra();
    t.chiedi(domanda({ pecore: ['g2'], furto: { presi: { g2: 1 } } }), suGesto);
    t.avanza(33);
    const a = alzatiDi('g2')[0]!;
    evento('pointerdown', a);
    expect(gesti).toEqual([]);
    expect(parseFloat(a.style.zIndex)).toBeGreaterThan(1000);
  });

  it('la zona di tocco di un agnellino alzato sta dentro la scena ed è abbastanza grande per un dito', () => {
    const t = nuovo(fotoConAgnellini(4, { g1: 4, g2: 5, g3: 5, g4: 5 }));
    t.chiedi(domanda({ furto: { presi: { g2: 2, g3: 2, g4: 2 } } }), () => undefined);
    t.avanza(33);
    const tutti = qa('.ui .agnellino-alzato');
    expect(tutti).toHaveLength(6);
    for (const a of tutti) {
      const r = rettDi(a);
      expect(r[2] - r[0]).toBeGreaterThanOrEqual(24);
      expect(r[3] - r[1]).toBeGreaterThanOrEqual(24);
      expect(r[0]).toBeGreaterThanOrEqual(0);
      expect(r[2]).toBeLessThanOrEqual(390);
      expect(r[1]).toBeGreaterThanOrEqual(0);
    }
  });

  it('se presi cala, gli agnellini in più tornano giù; se cresce ne salgono altri; a zero nessuno', () => {
    const t = nuovo(fotoConAgnellini(3, { g1: 4, g2: 5, g3: 4 }));
    const prima = JSON.stringify(t.stato().agnellini);
    t.chiedi(domanda({ furto: { presi: { g2: 2 } } }), () => undefined);
    t.avanza(33);
    const due = alzati();
    expect(due).toHaveLength(2);
    t.chiedi(domanda({ furto: { presi: { g2: 1 } } }), () => undefined);
    t.avanza(2000);
    expect(alzati()).toHaveLength(1);
    expect(due).toContain(alzati()[0]);
    t.chiedi(domanda({ furto: { presi: { g2: 3 } } }), () => undefined);
    t.avanza(33);
    expect(alzati()).toHaveLength(3);
    expect(alzatiDi('g2')).toHaveLength(3);
    t.chiedi(domanda({ furto: { presi: { g2: 0 } } }), () => undefined);
    t.avanza(2000);
    expect(alzati()).toHaveLength(0);
    expect(alzatiDi('g2')).toHaveLength(0);
    expect(JSON.stringify(t.stato().agnellini)).toBe(prima);
  });

  it('più agnellini presi di quelli che ci sono: si alzano quelli che ci sono, senza errori', () => {
    const t = nuovo(fotoConAgnellini(3, { g1: 4, g2: 2, g3: 4 }));
    t.chiedi(domanda({ furto: { presi: { g2: 5 } } }), () => undefined);
    t.avanza(33);
    expect(alzati()).toHaveLength(2);
    expect(errori).not.toHaveBeenCalled();
  });

  it('chi sta ancora arrivando nel recinto non si alza', () => {
    const f0 = fotoConAgnellini(3, { g1: 4, g2: 5, g3: 4 });
    const t = nuovo(f0);
    // Un agnellino parte dal gregge verso g2: assegnato a g2 ma ancora in viaggio
    t.allinea({ ...f0, gregge: f0.gregge - 1, posti: f0.posti.map((p) => (p.id === 'g2' ? { ...p, agnellini: 6 } : p)) }, 'calmo');
    t.avanza(33);
    expect(t.stato().inViaggio).toBeGreaterThan(0);
    t.chiedi(domanda({ furto: { presi: { g2: 6 } } }), () => undefined);
    t.avanza(33);
    expect(alzati()).toHaveLength(5);
    expect(alzatiDi('g2')).toHaveLength(5);
  });

  it('domanda tolta: nessun agnellino resta alzato, nessun controllo resta, i conti coincidono con la fotografia', () => {
    const f = fotoConAgnellini(3, { g1: 4, g2: 5, g3: 4 });
    const t = nuovo(f);
    const prima = JSON.stringify(t.stato().agnellini);
    t.chiedi(domanda({ furto: { presi: { g2: 2 } } }), () => undefined);
    t.avanza(33);
    expect(alzati()).toHaveLength(2);
    t.smettiDiChiedere();
    expect(qa('.ui .agnellino-alzato')).toHaveLength(0);
    t.avanza(2000);
    expect(alzati()).toHaveLength(0);
    const dopo = t.stato();
    expect(JSON.stringify(dopo.agnellini)).toBe(prima);
    for (const p of f.posti) expect(dopo.agnellini[p.id]).toEqual({ assegnati: p.agnellini, mostrati: p.agnellini });
    expect(dopo.agnellini.gregge).toEqual({ assegnati: f.gregge, mostrati: f.gregge });
    expect(dopo.fuori).toBe(0);
  });

  it('una domanda senza furto, o la scena che recita, rimette giù gli agnellini', async () => {
    const { prima, dopo } = pascolo();
    const t = (teatro = creaTeatro(radice, { ciclo: 'manuale', ambiente: false, giochi: false, caso: casoConSeme(5) }));
    t.recita(fotoDi(prima), vista(prima));
    t.chiedi(domanda({ furto: { presi: { g2: 1 } } }), () => undefined);
    t.avanza(33);
    expect(alzati()).toHaveLength(1);
    t.chiedi(domanda(), () => undefined);
    t.avanza(2000);
    expect(alzati()).toHaveLength(0);
    t.chiedi(domanda({ furto: { presi: { g2: 1 } } }), () => undefined);
    t.avanza(33);
    expect(alzati()).toHaveLength(1);
    t.recita(fotoDi(dopo), vista(dopo));
    expect(t.occupato()).toBe(true);
    expect(qa('.ui .agnellino-alzato')).toHaveLength(0);
    await finche(t, () => !t.occupato(), 10_000);
    t.avanza(33);
    expect(alzati()).toHaveLength(1);
    expect(errori).not.toHaveBeenCalled();
  });

  it('dopo una ricostruzione del tavolo gli agnellini nuovi si alzano al posto dei vecchi, nello stesso numero', () => {
    const f = fotoConAgnellini(3, { g1: 4, g2: 5, g3: 4 });
    const t = nuovo(f);
    t.chiedi(domanda({ furto: { presi: { g2: 2 } } }), () => undefined);
    t.avanza(33);
    const vecchi = alzati();
    t.allinea(f, 'subito');
    t.avanza(33);
    expect(alzati()).toHaveLength(2);
    expect(alzatiDi('g2')).toHaveLength(2);
    for (const v of vecchi) expect(v.isConnected).toBe(false);
  });

  it("con \"Riduci movimento\" l'agnellino è subito in alto, senza il salto; senza, sale in qualche fotogramma", () => {
    const f = fotoConAgnellini(3, { g1: 4, g2: 5, g3: 4 });
    const t = nuovo(f);
    t.chiedi(domanda({ furto: { presi: { g2: 1 } } }), () => undefined);
    t.avanza(33);
    const primo = quotaCorpo(alzati()[0]!);
    t.avanza(1000);
    const ultimo = quotaCorpo(alzati()[0]!);
    expect(ultimo).toBeLessThan(primo - 3);
    t.distruggi();
    teatro = null;
    sceneRidotte();
    const r = nuovo(f);
    expect(r.ctx.ridotto).toBe(true);
    r.chiedi(domanda({ furto: { presi: { g2: 1 } } }), () => undefined);
    r.avanza(33);
    const fermo = quotaCorpo(alzati()[0]!);
    r.avanza(1000);
    expect(quotaCorpo(alzati()[0]!)).toBeCloseTo(fermo, 5);
    expect(fermo).toBeLessThan(-25.8);
  });

  it('con i giochi tra agnellini accesi gli agnellini alzati non vengono presi a giocare: restano alzati, ognuno col suo controllo', () => {
    const f = fotoConAgnellini(3, { g1: 5, g2: 6, g3: 5 });
    const t = (teatro = creaTeatro(radice, { ciclo: 'manuale', ambiente: false, giochi: true, caso: casoConSeme(5) }));
    t.allinea(f, 'subito');
    const prima = JSON.stringify(t.stato().agnellini);
    // Tutti gli agnellini di g2 alzati: nessuno deve restare libero per un gioco
    t.chiedi(domanda({ furto: { presi: { g2: 6 } } }), () => undefined);
    t.avanza(33);
    expect(alzati()).toHaveLength(6);
    // 45 s di scena: i giochi si pianificano molte volte (ogni 3-6,5 s)
    for (let i = 0; i < 15; i++) {
      t.avanza(3000);
      expect(alzati()).toHaveLength(6);
      expect(alzatiDi('g2')).toHaveLength(6);
    }
    expect(JSON.stringify(t.stato().agnellini)).toBe(prima);
    // Ogni controllo ha il suo agnellino sotto: tanti controlli quanti agnellini alzati
    expect(qa('.ui .agnellino-alzato')).toHaveLength(alzati().length);
    expect(errori).not.toHaveBeenCalled();
  });

  it('un meteo che fa rannicchiare gli agnellini non porta via quelli alzati per il furto', async () => {
    const f = fotoConAgnellini(3, { g1: 5, g2: 6, g3: 5 });
    const t = nuovo(f);
    const prima = JSON.stringify(t.stato().agnellini);
    t.chiedi(domanda({ furto: { presi: { g2: 6 } } }), () => undefined);
    t.avanza(33);
    expect(alzati()).toHaveLength(6);
    // La pioggia fa rannicchiare tutti i recinti: gli alzati non sono candidati
    const fine = t.ordini.meteo('pioggia-di-traverso#1', 'g1');
    for (let i = 0; i < 400; i++) {
      t.avanza(33);
      await scarica();
      expect(alzati()).toHaveLength(6);
    }
    expect(qa('.ui .agnellino-alzato')).toHaveLength(6);
    t.ordini.fermaMeteo();
    await fine;
    expect(JSON.stringify(t.stato().agnellini)).toBe(prima);
    expect(errori).not.toHaveBeenCalled();
  });

  it('la pozzanghera non intrappola gli agnellini alzati per il furto', async () => {
    const f = fotoConAgnellini(3, { g1: 5, g2: 6, g3: 5 });
    const t = nuovo(f);
    t.chiedi(domanda({ furto: { presi: { g2: 6 } } }), () => undefined);
    t.avanza(33);
    expect(alzati()).toHaveLength(6);
    const fine = t.ordini.meteo('pozzanghera-senza-fondo#1', 'g2');
    for (let i = 0; i < 600; i++) {
      t.avanza(33);
      await scarica();
      // Nessun alzato è preso dal mulinello (preso dal meteo tornerebbe a terra)
      expect(t.stato().intrappolati).toBe(0);
      expect(alzati()).toHaveLength(6);
    }
    t.ordini.fermaMeteo();
    await fine;
    expect(qa('.ui .agnellino-alzato')).toHaveLength(6);
    expect(errori).not.toHaveBeenCalled();
  });

  it('il vento forte non spinge gli agnellini alzati per il furto', async () => {
    const f = fotoConAgnellini(3, { g1: 5, g2: 6, g3: 5 });
    const t = (teatro = creaTeatro(radice, { ciclo: 'manuale', ambiente: true, giochi: false, caso: casoConSeme(5) }));
    t.allinea(f, 'subito');
    t.chiedi(domanda({ furto: { presi: { g2: 6 } } }), () => undefined);
    t.avanza(33);
    expect(alzati()).toHaveLength(6);
    const posti = () => alzati().map((e) => e.style.transform);
    const prima = posti();
    const fine = t.ordini.meteo('vento-dispettoso#1', 'g1');
    for (let i = 0; i < 200; i++) {
      t.avanza(33);
      await scarica();
    }
    expect(posti()).toEqual(prima);
    t.ordini.fermaMeteo();
    await fine;
    expect(errori).not.toHaveBeenCalled();
  });

  it('distruggere il teatro con il furto in corso toglie tutto', () => {
    const t = nuovo(fotoConAgnellini(3, { g1: 4, g2: 5, g3: 4 }));
    t.chiedi(domanda({ furto: { presi: { g2: 2 } } }), () => undefined);
    t.avanza(33);
    t.distruggi();
    expect(radice.querySelector('.agnellino-alzato')).toBeNull();
    teatro = null;
  });
});

describe('la nuvoletta del pensiero', () => {
  const pens = (azione: () => void = () => undefined) => ({
    titolo: 'Un consiglio',
    testo: 'Tieni premuta una carta per leggerla',
    pulsanti: [
      { testo: 'Ho capito', azione },
      { testo: 'Più tardi', secondario: true, azione: () => undefined },
    ],
  });

  it('tre pallini che salgono dalla pecora in basso, poi la nuvola con titolo, testo e pulsanti veri', () => {
    const t = nuovo(foto(3));
    const azione = vi.fn();
    t.pensa(pens(azione));
    const p = q('.pensiero')!;
    expect(p.getAttribute('role')).toBe('status');
    expect(p.closest('.ui')).not.toBeNull();
    const pallini = qa('.pensiero .pallino');
    expect(pallini).toHaveLength(3);
    const nuvola = q('.pensiero .nuvola')!;
    expect(nuvola.querySelector('.titolo')!.textContent).toBe('Un consiglio');
    expect(nuvola.querySelector('.testo')!.textContent).toBe('Tieni premuta una carta per leggerla');
    const pulsanti = qa<HTMLButtonElement>('.pensiero button');
    expect(pulsanti.map((b) => b.textContent)).toEqual(['Ho capito', 'Più tardi']);
    expect(pulsanti.every((b) => b.tagName === 'BUTTON' && b.type === 'button')).toBe(true);
    expect(pulsanti.every((b) => nuvola.contains(b))).toBe(true);
    expect(pulsanti[0]!.classList.contains('primario')).toBe(true);
    expect(pulsanti[1]!.classList.contains('secondario')).toBe(true);
    pulsanti[0]!.click();
    expect(azione).toHaveBeenCalledTimes(1);
    // I pallini sono decorazione per chi legge lo schermo
    expect(pallini.every((e) => e.getAttribute('aria-hidden') === 'true')).toBe(true);
  });

  it('i pallini escono dalla pecora in basso e salgono verso la nuvola, che sta sopra la pecora e sopra il ventaglio', () => {
    const t = nuovo(foto(3));
    t.pensa(pens());
    const posto = disposizione(3).posti[0]!;
    const pallini = qa('.pensiero .pallino').map((e) => ({ x: parseFloat(e.style.left), y: parseFloat(e.style.top), w: parseFloat(e.style.width) }));
    for (const p of pallini) {
      expect(p.x).toBeGreaterThanOrEqual(posto.x);
      expect(p.x).toBeLessThanOrEqual(posto.x + posto.w);
    }
    // Salgono: ogni pallino sta più in alto del precedente e cresce
    expect(pallini[1]!.y).toBeLessThan(pallini[0]!.y);
    expect(pallini[2]!.y).toBeLessThan(pallini[1]!.y);
    expect(pallini[2]!.w).toBeGreaterThan(pallini[0]!.w);
    // Il primo parte vicino alla testa della pecora, non lontano
    expect(pallini[0]!.y).toBeGreaterThan(posto.y - 40);
    expect(pallini[0]!.y).toBeLessThan(posto.y + posto.w * 0.85);
    // Il bordo basso della nuvola sta sopra l'ultimo pallino e sopra il ventaglio
    const bordoBasso = parseFloat(q('.pensiero .nuvola')!.style.top);
    expect(bordoBasso).toBeLessThan(pallini[2]!.y);
    expect(bordoBasso).toBeLessThan(722);
  });

  it("senza titolo non c'è il titolo; senza pulsanti, solo la nuvola", () => {
    const t = nuovo(foto(3));
    t.pensa({ testo: 'Bea sta pensando…', pulsanti: [] });
    expect(q('.pensiero .titolo')).toBeNull();
    expect(qa('.pensiero button')).toHaveLength(0);
    expect(q('.pensiero .testo')!.textContent).toBe('Bea sta pensando…');
  });

  it('un tocco sulla nuvola non è un tocco sul prato; i pulsanti funzionano con una domanda mostrata', () => {
    const t = nuovo(foto(3));
    const { gesti, suGesto } = registra();
    const azione = vi.fn();
    t.chiedi(domanda({ dado: true }), suGesto);
    t.pensa(pens(azione));
    evento('pointerdown', q('.pensiero .nuvola')!);
    evento('pointerdown', q('.pensiero .testo')!);
    evento('pointerdown', q('.pensiero button')!);
    expect(gesti).toEqual([]);
    q('.pensiero button')!.click();
    expect(azione).toHaveBeenCalledTimes(1);
  });

  it('lo stesso pensiero non si ricrea, nemmeno dopo un resize o una ricostruzione', () => {
    const t = nuovo(foto(3));
    const p = pens();
    t.pensa(p);
    const el = q('.pensiero')!;
    const bottone = q('.pensiero button')!;
    t.adatta();
    t.allinea(foto(3), 'subito');
    t.pensa(p);
    expect(q('.pensiero')).toBe(el);
    expect(q('.pensiero button')).toBe(bottone);
    expect(qa('.pallino')).toHaveLength(3);
  });

  it('pensa(null) toglie tutto; con la scena occupata aspetta', async () => {
    const { prima, dopo } = pascolo();
    const t = (teatro = creaTeatro(radice, { ciclo: 'manuale', ambiente: false, giochi: false, caso: casoConSeme(5) }));
    t.recita(fotoDi(prima), vista(prima));
    t.recita(fotoDi(dopo), vista(dopo));
    expect(t.occupato()).toBe(true);
    t.pensa(pens());
    expect(q('.pensiero')).toBeNull();
    await finche(t, () => !t.occupato(), 10_000);
    expect(q('.pensiero .nuvola')).not.toBeNull();
    t.pensa(null);
    expect(q('.pensiero')).toBeNull();
    expect(qa('.pallino')).toHaveLength(0);
  });

  it('con "Riduci movimento" la nuvoletta compare senza animazione (classe ferma)', () => {
    sceneRidotte();
    const t = nuovo(foto(3));
    t.pensa(pens());
    expect(q('.pensiero')!.classList.contains('ferma')).toBe(true);
  });

  it('distruggere il teatro toglie la nuvoletta', () => {
    const t = nuovo(foto(3));
    t.pensa(pens());
    t.distruggi();
    expect(radice.querySelector('.pensiero')).toBeNull();
    teatro = null;
  });
});

describe('tutto insieme', () => {
  it('centro, grandi, Guai e furto insieme non rompono niente; togli li toglie tutti', () => {
    const t = nuovo({ ...fotoConGuai(3, [GUAIO_1]), mano: [A, B, C] });
    t.chiedi(domanda({ centro: A, grandi: [B, C], guai: [GUAIO_1], furto: { presi: { g2: 1 } }, pecore: ['g2'], fionda: { bersaglio: 'g2', massimo: 3 } }), () => undefined);
    t.avanza(33);
    expect(errori).not.toHaveBeenCalled();
    t.smettiDiChiedere();
    t.avanza(2000);
    expect(grandi()).toHaveLength(0);
    expect(qa('.ui .zona-guaio')).toHaveLength(0);
    expect(qa('.ui .agnellino-alzato')).toHaveLength(0);
    expect(alzati()).toHaveLength(0);
    expect(minis().some((m) => m.classList.contains('illuminata'))).toBe(false);
    expect(errori).not.toHaveBeenCalled();
  });

  it('una domanda nuova senza carte grandi, centro o Guai toglie quelle di prima', () => {
    const t = nuovo(fotoConGuai(3, [GUAIO_1]));
    t.chiedi(domanda({ centro: A, grandi: [B, C], guai: [GUAIO_1] }), () => undefined);
    expect(grandi()).toHaveLength(3);
    t.chiedi(domanda({ dado: true }), () => undefined);
    expect(grandi()).toHaveLength(0);
    expect(qa('.ui .zona-guaio')).toHaveLength(0);
    expect(miniDi(GUAIO_1).classList.contains('illuminata')).toBe(false);
  });
});
