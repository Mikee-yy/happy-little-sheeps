// @vitest-environment jsdom
// Prove della mira della Testata sul prato: Montone animato con l'elastico vicino alla propria pecora (partenza un po' diversa
// a ogni mira), recinto bersaglio ingrandito, cerchi e bollini solo mentre si carica, trascinamento (dito e mouse), tastiera,
// un solo tiro, tocco che non è "prato". Teatro di prova con ciclo manuale, come chiedi.test.ts;
// jsdom non misura: la scala della scena vale 1 (un pixel del dito è un'unità del mondo).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// Questo file monta teatri veri: con tutte le prove insieme una prova può superare i 5 s predefiniti (la macchina è
// carica). Il limite più alto vale per tutto il file, così la prossima prova lenta non fallisce per finta.
vi.setConfig({ testTimeout: 60_000 });
import type { IdGiocatore } from '../../../../engine/src';
import { T } from '../../testi';
import { casoConSeme } from '../aiuti-prova';
import type { Camera } from '../camera';
import { fotoIniziale, scarica, scorri } from '../meteo/aiuti-meteo';
import type { Palco } from '../palco';
import type { Domanda, Gesto } from '../scelte/tipi';
import { creaTeatro, type Teatro } from '../teatro';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { W } from '../misure';
import { CENTRO_TAVOLO } from '../ordini';
import {
  basePartenza,
  colpoLungo,
  esitoTiro,
  fineDietroLaCollina,
  fasciaDi,
  FIONDA,
  forzaPerDistanza,
  lunghezzaElastico,
  partenzaDi,
  puntoArrivo,
  spazioPerTirare,
  zonaDi,
  type Punto,
  type Rett,
} from './tiro';

// La camera e il palco non escono dal teatro: li si prende al momento della creazione (come camera.test.ts)
const presa = vi.hoisted(() => ({ camera: null as unknown, palco: null as unknown }));
vi.mock('../camera', async (originale) => {
  const m = await originale<typeof import('../camera')>();
  return {
    ...m,
    creaCamera: (palco: Palco) => {
      const c = m.creaCamera(palco);
      presa.camera = c;
      presa.palco = palco;
      return c;
    },
  };
});

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

let radice: HTMLElement;
let teatro: Teatro | null = null;

beforeEach(() => {
  radice = document.createElement('div');
  document.body.appendChild(radice);
});

afterEach(() => {
  teatro?.distruggi();
  teatro = null;
  radice.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

/** Un teatro con 3 giocatori (o `n`) già in pari (in basso g1), con camera e palco a portata delle prove. */
function nuovo(n: 2 | 3 | 4 = 3): { t: Teatro; camera: Camera; palco: Palco } {
  const t = (teatro = creaTeatro(radice, { ciclo: 'manuale', ambiente: false, giochi: false, caso: casoConSeme(5) }));
  t.allinea(fotoIniziale(n), 'subito');
  return { t, camera: presa.camera as Camera, palco: presa.palco as Palco };
}

function registra(): { gesti: Gesto[]; suGesto: (g: Gesto) => void } {
  const gesti: Gesto[] = [];
  return { gesti, suGesto: (g) => gesti.push(g) };
}

const q = <E extends Element = HTMLElement>(sel: string): E | null => radice.querySelector<E>(sel);
const qa = <E extends Element = HTMLElement>(sel: string): E[] => [...radice.querySelectorAll<E>(sel)];
const zona = () => q('.ui .zona-fionda');
const montone = () => q('.mondo .fionda-montone');
const puntini = () => qa<SVGCircleElement>('.mondo .fionda-scia circle');
const doveMontone = (): Punto => ({ x: Number(montone()!.dataset.x), y: Number(montone()!.dataset.y) });
const piu = (p: Punto, dx: number, dy: number): Punto => ({ x: p.x + dx, y: p.y + dy });
/** La base della partenza: vicino alla pecora di chi sta in basso. */
const baseDi = (palco: Palco): Punto => basePartenza(palco.posto(palco.inBasso()!)!);

/**
 * Un evento del puntatore: `button` il tasto (0 sinistro o dito, 2 destro), `buttons` i tasti tenuti (di base: quello
 * premuto finché il dito è giù, nessuno al rilascio), `id` il puntatore (di base 1).
 */
function evento(tipo: string, el: EventTarget, x: number, y: number, o: { button?: number; buttons?: number; id?: number } = {}): void {
  const button = o.button ?? 0;
  const giu = tipo === 'pointerdown' || tipo === 'pointermove';
  const buttons = o.buttons ?? (giu ? (button === 2 ? 2 : button === 1 ? 4 : 1) : 0);
  const e = new MouseEvent(tipo, { bubbles: true, cancelable: true, clientX: x, clientY: y, button, buttons });
  Object.assign(e, { pointerId: o.id ?? 1, pointerType: button ? 'mouse' : 'touch' });
  el.dispatchEvent(e);
}
/** Lascia finire l'ingrandimento del recinto: prima la fionda non tira. */
const pronta = (t: Teatro): Promise<void> => scorri(t, 1500);
/** Dito giù sulla zona, poi spostato di (dx, dy) e lasciato sulla finestra. */
function trascina(dx: number, dy: number, lascia = true): void {
  evento('pointerdown', zona()!, 100, 600);
  evento('pointermove', window, 100 + dx, 600 + dy);
  if (lascia) evento('pointerup', window, 100 + dx, 600 + dy);
}
const tasto = (el: Element, key: string, repeat = false): void => {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, repeat, bubbles: true, cancelable: true }));
};

/** Metà della corsa dell'elastico: lì il tiro arriva al centro del recinto. */
const META_TIRO = (FIONDA.tiroMinimo + FIONDA.tiroMassimo) / 2;
/** Una freccia su o giù: di quanto cambia la forza (come in mira.ts, da `fionda.json`). */
const PASSO_FORZA = 1 / (FIONDA.tastiera.passiPerProfondita * (1 + 2 * FIONDA.margine));
const centroDi = (palco: Palco, chi: IdGiocatore): Punto => {
  const a = palco.area(chi)!;
  return { x: (a.x0 + a.x1) / 2, y: (a.y0 + a.y1) / 2 };
};
interface Ellisse { cx: number; cy: number; rx: number; ry: number }
interface Rettangolo { x: number; y: number; width: number; height: number; rx: number; ry: number }
const numero = (e: Element, a: string): number => Number(e.getAttribute(a));
/** I cerchi disegnati: l'ellisse del centro (3), il recinto (2), la fascia della staccionata (1) e i tre numeri. */
function cerchi(): { centro: Ellisse | null; dentro: Rettangolo | null; fascia: Rettangolo | null; numeri: string[] } {
  const svg = q('.mondo .fionda-cerchi')!;
  const ellisse = (e: Element | null): Ellisse | null => (e ? { cx: numero(e, 'cx'), cy: numero(e, 'cy'), rx: numero(e, 'rx'), ry: numero(e, 'ry') } : null);
  const rett = (e: Element | null): Rettangolo | null =>
    e ? { x: numero(e, 'x'), y: numero(e, 'y'), width: numero(e, 'width'), height: numero(e, 'height'), rx: numero(e, 'rx'), ry: numero(e, 'ry') } : null;
  return {
    centro: ellisse(svg.querySelector('ellipse.centro')),
    dentro: rett(svg.querySelector('rect.dentro')),
    fascia: rett(svg.querySelector('rect.fascia')),
    numeri: [...svg.querySelectorAll('.bollino text')].map((t) => t.textContent ?? ''),
  };
}
/** Si vede qualcosa dei cerchi (forme o bollini). */
const cerchiVisibili = (): boolean => (q('.mondo .fionda-cerchi')?.childElementCount ?? 0) > 0;
/** I cerchi stanno sul recinto di adesso di `chi`: il centro, il recinto stesso e la fascia fuori dalla staccionata. */
function cerchiSul(palco: Palco, chi: IdGiocatore): void {
  const a = palco.area(chi)!;
  const c = centroDi(palco, chi);
  const { centro, dentro, fascia } = cerchi();
  expect(centro).not.toBeNull();
  expect(centro!.cx).toBeCloseTo(c.x, 3);
  expect(centro!.cy).toBeCloseTo(c.y, 3);
  expect(centro!.rx).toBeCloseTo((FIONDA.cerchi.centro * (a.x1 - a.x0)) / 2, 3);
  expect(centro!.ry).toBeCloseTo((FIONDA.cerchi.centro * (a.y1 - a.y0)) / 2, 3);
  expect(dentro).not.toBeNull();
  expect(dentro!.x).toBeCloseTo(a.x0, 3);
  expect(dentro!.y).toBeCloseTo(a.y0, 3);
  expect(dentro!.width).toBeCloseTo(a.x1 - a.x0, 3);
  expect(dentro!.height).toBeCloseTo(a.y1 - a.y0, 3);
  const fx = FIONDA.fasciaBordo.x * (a.x1 - a.x0), fy = FIONDA.fasciaBordo.y * (a.y1 - a.y0);
  expect(fascia).not.toBeNull();
  expect(fascia!.x).toBeCloseTo(a.x0 - fx, 3);
  expect(fascia!.y).toBeCloseTo(a.y0 - fy, 3);
  expect(fascia!.width).toBeCloseTo(a.x1 - a.x0 + 2 * fx, 3);
  expect(fascia!.height).toBeCloseTo(a.y1 - a.y0 + 2 * fy, 3);
  expect(fascia!.rx).toBeCloseTo(fx, 3);
  expect(fascia!.ry).toBeCloseTo(fy, 3);
}
const larghezza = (palco: Palco, chi: IdGiocatore): number => palco.area(chi)!.x1 - palco.area(chi)!.x0;

const fionda = (o: { chi?: IdGiocatore; bersaglio?: IdGiocatore; massimo?: number; tentativo?: string } = {}): Domanda =>
  domanda({
    fionda: {
      ...(o.chi !== undefined ? { chi: o.chi } : {}),
      bersaglio: o.bersaglio ?? 'g2',
      massimo: o.massimo ?? 3,
      ...(o.tentativo !== undefined ? { tentativo: o.tentativo } : {}),
    },
  });

/** Il consiglio della Testata nella partita di prova: la nuvoletta del pensiero della pecora in basso. */
const CONSIGLIO = { titolo: T.prova.consiglioTitolo, testo: T.prova.consigli.testata, pulsanti: [{ testo: T.prova.hoCapito, azione: () => undefined }] };
/**
 * La nuvola (larga 240) e i suoi pallini (jsdom non misura): la nuvola con il consiglio della Testata è alta 158 nella pagina
 * di sviluppo, qui 180 per stare larghi. Sopra la pecora cresce verso l'alto dal suo `top`; con la classe `sotto` verso il basso.
 */
const ALTEZZA_NUVOLA = 180;
function rettPensiero(): Record<string, Rett> {
  const n = q('.pensiero .nuvola');
  if (!n) return {};
  const x0 = parseFloat(n.style.left), top = parseFloat(n.style.top);
  const sotto = n.classList.contains('sotto');
  const fuori: Record<string, Rett> = {
    nuvola: { x0, x1: x0 + 240, y0: sotto ? top : top - ALTEZZA_NUVOLA, y1: sotto ? top + ALTEZZA_NUVOLA : top },
  };
  qa('.pensiero .pallino').forEach((p, i) => {
    const x = parseFloat(p.style.left), y = parseFloat(p.style.top);
    fuori[`pallino ${i}`] = { x0: x, y0: y, x1: x + parseFloat(p.style.width), y1: y + parseFloat(p.style.height) };
  });
  return fuori;
}

/**
 * Cosa non deve stare sotto la zona di tocco del Montone (unità del mondo, misurati nella pagina di sviluppo a 375×812, uguali
 * con 2, 3 e 4 giocatori): il dado (174..218 × 375..410, con 4 di respiro: durante la fionda non è illuminato) e i pulsanti
 * in cima. La mano e il consiglio "Tocca una carta…" non ci sono: mentre si mira scendono sotto il bordo dello schermo.
 */
const DA_NON_COPRIRE: Record<string, Rett> = {
  dado: { x0: 170, y0: 371, x1: 222, y1: 414 },
  pulsanti: { x0: 0, y0: 0, x1: W, y1: 42 },
};
/** La classe sullo strato `.ui` mentre si mira (prima del lancio): mano e consiglio scendono via (scena.css). */
const IN_MIRA = 'fionda-in-mira';
const manoVia = (): boolean => q('.ui')!.classList.contains(IN_MIRA);
const siToccano = (a: Rett, b: Rett): boolean => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
function rettZona(): Rett {
  const z = zona()!;
  const x0 = parseFloat(z.style.left), y0 = parseFloat(z.style.top);
  return { x0, y0, x1: x0 + parseFloat(z.style.width), y1: y0 + parseFloat(z.style.height) };
}

describe('la mira della Testata', () => {
  it('mostra: Montone nuovo a riposo vicino alla propria pecora, recinto ingrandito, niente cerchi finché non si tira', async () => {
    const { t, camera, palco } = nuovo();
    const ingrandisci = vi.spyOn(camera, 'ingrandisciRecinto');
    // Una domanda senza fionda non tocca il recinto né disegna niente
    t.chiedi(domanda({ pecore: ['g2'] }), () => undefined);
    expect(ingrandisci).not.toHaveBeenCalled();
    expect(montone()).toBeNull();
    const l0 = larghezza(palco, 'g2');
    t.chiedi(fionda({ massimo: 1 }), () => undefined);
    expect(ingrandisci).toHaveBeenCalledWith('g2', FIONDA.ingrandimento, FIONDA.attenuati, 'g1');
    // La partenza: entro il raggio della variazione attorno alla base vicino alla pecora
    const base = baseDi(palco);
    const p = doveMontone();
    expect(Math.hypot(p.x - base.x, p.y - base.y)).toBeLessThanOrEqual(FIONDA.variazionePartenza + 1e-9);
    // Il Montone animato (non più il simbolo dello sprite), a riposo, nella stessa cornice di prima
    const m = montone()!;
    expect(m.querySelector('svg.mt')).not.toBeNull();
    expect(m.querySelector('use')).toBeNull();
    expect(m.classList.contains('posa-riposo')).toBe(true);
    expect(m.classList.contains('posa-carica')).toBe(false);
    expect(m.style.transformOrigin).toBe('75px 102px');
    expect(m.style.width).toBe('150px');
    expect(q('.mondo .fionda-elastico')).not.toBeNull();
    const z = zona()!;
    expect(z.getAttribute('role')).toBe('button');
    expect(z.getAttribute('tabindex')).toBe('0');
    expect(z.getAttribute('aria-label')).toBe(T.testata.fionda.etichetta);
    expect(puntini()).toHaveLength(0);
    // Il recinto si allarga sul posto; a riposo, anche finito l'ingrandimento, niente cerchi né numeri
    await pronta(t);
    expect(larghezza(palco, 'g2')).toBeGreaterThan(l0);
    expect(camera.zoom()).toBe(1);
    expect(cerchiVisibili()).toBe(false);
    // Tirando l'elastico compaiono, sul recinto grande
    trascina(0, 100, false);
    expect(cerchi().numeri).toEqual(['1', '1', '1']);
    cerchiSul(palco, 'g2');
  });

  it('con massimo 3 i numeri sono 3, 2, 1', async () => {
    const { t } = nuovo();
    t.chiedi(fionda({ bersaglio: 'g3' }), () => undefined);
    await pronta(t);
    trascina(0, 100, false);
    expect(cerchi().numeri).toEqual(['3', '2', '1']);
  });

  it('finché il recinto si ingrandisce non si tira e i cerchi aspettano', async () => {
    const { t, palco } = nuovo();
    const { gesti, suGesto } = registra();
    const l0 = larghezza(palco, 'g2');
    t.chiedi(fionda(), suGesto);
    const P = doveMontone();
    // A metà dell'ingrandimento: niente cerchi sul recinto piccolo (neanche tirando), e un tiro (dito o tastiera) non parte
    await scorri(t, 500);
    expect(larghezza(palco, 'g2')).toBeGreaterThan(l0);
    trascina(0, 150, false);
    expect(cerchiVisibili()).toBe(false);
    evento('pointerup', window, 100, 750);
    tasto(zona()!, 'Enter');
    expect(gesti).toEqual([]);
    expect(t.ctx.regia.tiroLocale).toBeNull();
    expect(doveMontone()).toEqual(P);
    // Finito l'ingrandimento: a riposo ancora niente; tirando, i cerchi sul recinto grande, e il tiro parte
    await pronta(t);
    expect(cerchiVisibili()).toBe(false);
    trascina(0, 150, false);
    cerchiSul(palco, 'g2');
    evento('pointerup', window, 100, 750);
    expect(gesti).toHaveLength(1);
  });

  it('trascinare e lasciare: un solo gesto fionda con l\'esito della zona; tiroLocale ricordato con la partenza', async () => {
    const { t, palco } = nuovo();
    const { gesti, suGesto } = registra();
    t.chiedi(fionda(), suGesto);
    await pronta(t);
    const P = doveMontone();
    trascina(0, 150, false);
    // Il Montone segue il dito; elastico e scia partono dalla partenza, la scia sale dalla parte opposta
    expect(doveMontone()).toEqual(piu(P, 0, 150));
    const linea = q<SVGLineElement>('.mondo .fionda-elastico line')!;
    expect(Number(linea.getAttribute('x1'))).toBeCloseTo(P.x, 6);
    expect(Number(linea.getAttribute('x2'))).toBeCloseTo(P.x, 6);
    expect(puntini()).toHaveLength(FIONDA.puntiScia);
    for (const p of puntini()) expect(Number(p.getAttribute('cy'))).toBeLessThan(P.y);
    const area = palco.area('g2')!;
    const arrivo = puntoArrivo(P, { x: 0, y: 150 }, area)!;
    const esito = esitoTiro(arrivo, area, 3);
    // Il primo puntino della scia sta sulla linea dalla partenza all'arrivo
    const primo = puntini()[0]!;
    const t1 = FIONDA.scia / FIONDA.puntiScia;
    expect(Number(primo.getAttribute('cx'))).toBeCloseTo(P.x + (arrivo.x - P.x) * t1, 3);
    expect(Number(primo.getAttribute('cy'))).toBeCloseTo(P.y + (arrivo.y - P.y) * t1, 3);
    expect(cerchiVisibili()).toBe(true);
    evento('pointerup', window, 100, 750);
    expect(gesti).toEqual([{ tipo: 'fionda', esito }]);
    // Con il recinto com'era al tiro: una copia, non l'area che la camera continua a cambiare; e la partenza usata
    const recinto = { x0: area.x0, y0: area.y0, x1: area.x1, y1: area.y1 };
    // L'elastico tirato di 150, la forza piena: `pieno` (un colpo lungo così volerebbe nel cielo)
    expect(t.ctx.regia.tiroLocale).toEqual({ chi: 'g1', bersaglio: 'g2', esito, arrivo, recinto, partenza: P, pieno: true });
    expect(t.ctx.regia.tiroLocale!.recinto).not.toBe(area);
    expect(Object.keys(t.ctx.regia.tiroLocale!.recinto).sort()).toEqual(['x0', 'x1', 'y0', 'y1']);
    // Appena lanciato cerchi e numeri spariscono
    expect(cerchiVisibili()).toBe(false);
    // Niente secondo tiro: la zona se ne va. Il Montone non resta tirato: l'elastico si allenta e lui torna alla partenza,
    // a riposo, da dove poi parte il volo della regia (senza salti)
    expect(zona()).toBeNull();
    expect(doveMontone()).toEqual(P);
    expect(montone()!.classList.contains('posa-riposo')).toBe(true);
    expect(montone()!.classList.contains('posa-carica')).toBe(false);
    expect(Number(montone()!.style.getPropertyValue('--carica'))).toBe(0);
    expect(Number(linea.getAttribute('x2'))).toBeCloseTo(Number(linea.getAttribute('x1')), 6);
    expect(Number(linea.getAttribute('y2'))).toBeCloseTo(Number(linea.getAttribute('y1')), 6);
    expect(puntini()).toHaveLength(0);
    evento('pointerup', window, 100, 750);
    evento('pointerdown', window, 100, 600);
    evento('pointerup', window, 100, 750);
    expect(gesti).toHaveLength(1);
    expect(cerchiVisibili()).toBe(false);
  });

  it.each(['g2', 'g3'])('a metà tiro, dalla parte opposta al centro del recinto: vale 3 (%s)', async (bersaglio) => {
    const { t, palco } = nuovo();
    const { gesti, suGesto } = registra();
    t.chiedi(fionda({ bersaglio }), suGesto);
    await pronta(t);
    const P = doveMontone();
    // L'elastico tirato a metà corsa dalla parte opposta al centro: si arriva proprio lì
    const c = centroDi(palco, bersaglio);
    const d = Math.hypot(c.x - P.x, c.y - P.y);
    trascina((-(c.x - P.x) / d) * META_TIRO, (-(c.y - P.y) / d) * META_TIRO);
    expect(gesti).toEqual([{ tipo: 'fionda', esito: 3 }]);
    expect(t.ctx.regia.tiroLocale!.arrivo.x).toBeCloseTo(c.x, 3);
    expect(t.ctx.regia.tiroLocale!.arrivo.y).toBeCloseTo(c.y, 3);
  });

  it('elastico quasi a riposo: nessun gesto, niente cerchi, si può riprovare', async () => {
    const { t } = nuovo();
    const { gesti, suGesto } = registra();
    t.chiedi(fionda(), suGesto);
    await pronta(t);
    const P = doveMontone();
    trascina(0, FIONDA.tiroMinimo / 2, false);
    // Sotto il tiro minimo non si carica: niente cerchi
    expect(cerchiVisibili()).toBe(false);
    evento('pointerup', window, 100, 600 + FIONDA.tiroMinimo / 2);
    expect(gesti).toEqual([]);
    expect(t.ctx.regia.tiroLocale).toBeNull();
    expect(doveMontone()).toEqual(P);
    expect(puntini()).toHaveLength(0);
    expect(zona()).not.toBeNull();
    // Tirato e lasciato senza lanciare (il dito annullato): i cerchi se ne vanno
    trascina(0, 100, false);
    expect(cerchiVisibili()).toBe(true);
    evento('pointercancel', window, 100, 700);
    expect(cerchiVisibili()).toBe(false);
    expect(doveMontone()).toEqual(P);
    trascina(0, 150);
    expect(gesti).toHaveLength(1);
    expect(gesti[0]!.tipo).toBe('fionda');
  });

  it('tasto destro: niente', async () => {
    const { t } = nuovo();
    const { gesti, suGesto } = registra();
    t.chiedi(fionda(), suGesto);
    await pronta(t);
    const P = doveMontone();
    evento('pointerdown', zona()!, 100, 600, { button: 2 });
    evento('pointermove', window, 100, 750, { button: 2 });
    expect(doveMontone()).toEqual(P);
    expect(cerchiVisibili()).toBe(false);
    evento('pointerup', window, 100, 750, { button: 2 });
    expect(gesti).toEqual([]);
    expect(t.ctx.regia.tiroLocale).toBeNull();
    expect(zona()).not.toBeNull();
  });

  it('un altro dito non sposta né lancia: conta solo quello sceso sul Montone', async () => {
    const { t, palco } = nuovo();
    const { gesti, suGesto } = registra();
    t.chiedi(fionda(), suGesto);
    await pronta(t);
    const P = doveMontone();
    evento('pointerdown', zona()!, 100, 600, { id: 1 });
    evento('pointermove', window, 100, 700, { id: 1 });
    // Un secondo dito si muove e si alza altrove: il Montone resta dove lo tiene il primo, nessun lancio
    evento('pointerdown', zona()!, 300, 600, { id: 2 });
    evento('pointermove', window, 300, 750, { id: 2 });
    expect(doveMontone()).toEqual(piu(P, 0, 100));
    evento('pointerup', window, 300, 750, { id: 2 });
    evento('pointercancel', window, 300, 750, { id: 2 });
    expect(gesti).toEqual([]);
    expect(doveMontone()).toEqual(piu(P, 0, 100));
    // Il primo dito si alza: lancia con il suo tiro (e il Montone, lanciato, torna alla partenza)
    evento('pointerup', window, 100, 750, { id: 1 });
    expect(gesti).toHaveLength(1);
    expect(t.ctx.regia.tiroLocale!.arrivo).toEqual(puntoArrivo(P, { x: 0, y: 150 }, palco.area('g2')!));
    expect(doveMontone()).toEqual(P);
  });

  it('il mouse lasciato fuori dalla finestra (movimento senza tasti) vale come rilascio', async () => {
    const { t } = nuovo();
    const { gesti, suGesto } = registra();
    t.chiedi(fionda(), suGesto);
    await pronta(t);
    evento('pointerdown', zona()!, 100, 600, { buttons: 1 });
    evento('pointermove', window, 100, 750, { buttons: 1 });
    expect(gesti).toEqual([]);
    // Il tasto si è alzato fuori dalla finestra: il primo movimento al rientro arriva senza tasti
    evento('pointermove', window, 100, 750, { buttons: 0 });
    expect(gesti).toHaveLength(1);
    expect(gesti[0]!.tipo).toBe('fionda');
    evento('pointermove', window, 100, 760, { buttons: 0 });
    evento('pointerup', window, 100, 760);
    expect(gesti).toHaveLength(1);
  });

  it('togli a metà del trascinamento: dopo, movimenti e rilasci non fanno niente', async () => {
    const { t, palco } = nuovo();
    const { gesti, suGesto } = registra();
    t.chiedi(fionda(), suGesto);
    await pronta(t);
    const togli = vi.spyOn(window, 'removeEventListener');
    trascina(0, 150, false);
    t.smettiDiChiedere();
    for (const tipo of ['pointermove', 'pointerup', 'pointercancel']) {
      expect(togli.mock.calls.some(([nome]) => nome === tipo), tipo).toBe(true);
    }
    evento('pointermove', window, 100, 760);
    evento('pointerup', window, 100, 760);
    expect(gesti).toEqual([]);
    expect(t.ctx.regia.tiroLocale).toBeNull();
    // Rimostrata, la fionda riparte a riposo (vicino alla pecora, senza cerchi) e un rilascio vecchio non lancia
    t.chiedi(fionda(), suGesto);
    await pronta(t);
    const base = baseDi(palco);
    const p = doveMontone();
    expect(Math.hypot(p.x - base.x, p.y - base.y)).toBeLessThanOrEqual(FIONDA.variazionePartenza + 1e-9);
    expect(montone()!.classList.contains('posa-riposo')).toBe(true);
    expect(cerchiVisibili()).toBe(false);
    evento('pointerup', window, 100, 760);
    expect(gesti).toEqual([]);
  });

  it('tastiera: frecce e Invio lanciano, Invio tenuto premuto non ripete; i cerchi dalla prima freccia al lancio', async () => {
    const { t, palco } = nuovo();
    const { gesti, suGesto } = registra();
    t.chiedi(fionda(), suGesto);
    await pronta(t);
    const P = doveMontone();
    const z = zona()!;
    expect(cerchiVisibili()).toBe(false);
    tasto(z, 'ArrowUp');
    // La mira con le frecce carica il tiro: cerchi, scia e Montone in carica
    expect(cerchiVisibili()).toBe(true);
    expect(montone()!.classList.contains('posa-carica')).toBe(true);
    expect(puntini()).toHaveLength(FIONDA.puntiScia);
    const prima = puntini().map((p) => p.getAttribute('cx'));
    tasto(z, 'ArrowLeft');
    expect(puntini().map((p) => p.getAttribute('cx'))).not.toEqual(prima);
    // Invio ripetuto dal tasto tenuto premuto non lancia
    tasto(z, 'Enter', true);
    expect(gesti).toEqual([]);
    tasto(z, 'Enter');
    const area = palco.area('g2')!;
    const arrivo = t.ctx.regia.tiroLocale!.arrivo;
    expect(gesti).toEqual([{ tipo: 'fionda', esito: esitoTiro(arrivo, area, 3) }]);
    expect(cerchiVisibili()).toBe(false);
    // Lanciato con la tastiera: niente più carica, il Montone torna alla partenza a riposo
    expect(doveMontone()).toEqual(P);
    expect(montone()!.classList.contains('posa-carica')).toBe(false);
    expect(montone()!.classList.contains('posa-riposo')).toBe(true);
    expect(Number(montone()!.style.getPropertyValue('--carica'))).toBe(0);
    // La freccia a sinistra ha girato la mira di 5 gradi (in senso antiorario sullo schermo) rispetto al centro
    const c = centroDi(palco, 'g2');
    const giro = Math.atan2(arrivo.y - P.y, arrivo.x - P.x) - Math.atan2(c.y - P.y, c.x - P.x);
    expect((giro * 180) / Math.PI).toBeCloseTo(-FIONDA.tastiera.passoAngolo, 6);
    tasto(z, 'Enter');
    tasto(z, ' ');
    expect(gesti).toHaveLength(1);
  });

  it.each([
    { n: 2 as const, bersaglio: 'g2' },
    { n: 3 as const, bersaglio: 'g2' },
    { n: 3 as const, bersaglio: 'g3' },
    { n: 4 as const, bersaglio: 'g2' },
    { n: 4 as const, bersaglio: 'g3' },
    { n: 4 as const, bersaglio: 'g4' },
  ])('tastiera: Invio subito cade appena fuori dalla staccionata davanti (zona 1), senza mai mostrare i cerchi ($n giocatori, $bersaglio)', async ({ n, bersaglio }) => {
    const { t, palco } = nuovo(n);
    const { gesti, suGesto } = registra();
    t.chiedi(fionda({ bersaglio }), suGesto);
    await pronta(t);
    const P = doveMontone();
    const svg = q('.mondo .fionda-cerchi')!;
    let visti = false;
    const osserva = new MutationObserver(() => {
      visti ||= svg.childElementCount > 0;
    });
    osserva.observe(svg, { childList: true });
    tasto(zona()!, ' ');
    await Promise.resolve();
    osserva.disconnect();
    expect(visti).toBe(false);
    expect(cerchiVisibili()).toBe(false);
    expect(gesti).toEqual([{ tipo: 'fionda', esito: 1 }]);
    // Tra la partenza e il centro, davanti al recinto: fuori dalla staccionata ma non sul confine con la zona 2, ben dentro la fascia
    const area = palco.area(bersaglio)!;
    const arrivo = t.ctx.regia.tiroLocale!.arrivo;
    expect(zonaDi(arrivo, area)).toBe(1);
    expect(Math.hypot(arrivo.x - P.x, arrivo.y - P.y)).toBeLessThan(fasciaDi(P, area).distanza);
    const alto = area.y1 - area.y0;
    expect(arrivo.y - area.y1).toBeGreaterThan(0.05 * alto);
    expect(arrivo.y - area.y1).toBeLessThan(0.5 * FIONDA.fasciaBordo.y * alto);
  });

  it.each([
    { n: 2 as const, bersaglio: 'g2' },
    { n: 3 as const, bersaglio: 'g2' },
    { n: 3 as const, bersaglio: 'g3' },
    { n: 4 as const, bersaglio: 'g2' },
    { n: 4 as const, bersaglio: 'g3' },
    { n: 4 as const, bersaglio: 'g4' },
  ])('tastiera: dalla staccionata una freccia su porta a 2, due a 3; di lato resta nel recinto; giù una nella fascia, due a vuoto ($n giocatori, $bersaglio)', async ({ n, bersaglio }) => {
    const zonaCon = async (tasti: string[]): Promise<number> => {
      const { t, palco } = nuovo(n);
      const { gesti, suGesto } = registra();
      t.chiedi(fionda({ bersaglio }), suGesto);
      await pronta(t);
      for (const k of tasti) tasto(zona()!, k);
      tasto(zona()!, 'Enter');
      expect(gesti).toHaveLength(1);
      const z = zonaDi(t.ctx.regia.tiroLocale!.arrivo, palco.area(bersaglio)!);
      teatro!.distruggi();
      teatro = null;
      return z;
    };
    expect(await zonaCon([])).toBe(1);
    expect(await zonaCon(['ArrowUp'])).toBe(2);
    expect(await zonaCon(['ArrowUp', 'ArrowUp'])).toBe(3);
    expect(await zonaCon(['ArrowUp', 'ArrowUp', 'ArrowRight'])).toBeGreaterThan(0);
    expect(await zonaCon(['ArrowUp', 'ArrowUp', 'ArrowLeft'])).toBeGreaterThan(0);
    // Freccia giù dalla staccionata: una si cade più corti, ancora nella fascia fuori; con la fascia stretta (metà della prima
    // versione) due cadono oltre, a vuoto: con la tastiera si può anche mancare corti
    expect(await zonaCon(['ArrowDown'])).toBe(1);
    expect(await zonaCon(['ArrowDown', 'ArrowDown'])).toBe(0);
  });

  it('stesso tentativo dopo togli e mostra: resta lanciato dalla stessa partenza, niente zona, niente secondo tiro', async () => {
    const { t } = nuovo();
    const { gesti, suGesto } = registra();
    t.chiedi(fionda({ tentativo: 'a' }), suGesto);
    await pronta(t);
    const P = doveMontone();
    trascina(0, 150);
    expect(gesti).toHaveLength(1);
    const tiro = t.ctx.regia.tiroLocale;
    // La scena recita (la domanda si toglie) e la stessa domanda torna, con lo stesso tentativo
    t.smettiDiChiedere();
    t.chiedi(fionda({ tentativo: 'a' }), suGesto);
    await pronta(t);
    expect(zona()).toBeNull();
    // Già lanciato: alla partenza, a riposo (non di nuovo tirato)
    expect(doveMontone()).toEqual(P);
    expect(montone()!.classList.contains('posa-riposo')).toBe(true);
    expect(Number(montone()!.style.getPropertyValue('--carica'))).toBe(0);
    expect(cerchiVisibili()).toBe(false);
    tasto(q('.ui')!, 'Enter');
    evento('pointerup', window, 100, 760);
    expect(gesti).toHaveLength(1);
    expect(t.ctx.regia.tiroLocale).toBe(tiro);
  });

  it('tentativo nuovo dopo il lancio (mossa rifiutata, attesa scaduta): zona di nuovo, partenza nuova, si può tirare', async () => {
    const { t, palco } = nuovo();
    const { gesti, suGesto } = registra();
    t.chiedi(fionda({ tentativo: 'a' }), suGesto);
    await pronta(t);
    const P = doveMontone();
    trascina(0, 150);
    expect(gesti).toHaveLength(1);
    // Senza togliere la domanda: arriva la stessa fionda con un tentativo nuovo
    t.chiedi(fionda({ tentativo: 'b' }), suGesto);
    await pronta(t);
    expect(zona()).not.toBeNull();
    // Il Montone torna a riposo, da una partenza nuova (diversa, sempre entro il raggio dalla base)
    const P2 = doveMontone();
    expect(P2).not.toEqual(P);
    const base = baseDi(palco);
    expect(Math.hypot(P2.x - base.x, P2.y - base.y)).toBeLessThanOrEqual(FIONDA.variazionePartenza + 1e-9);
    expect(montone()!.classList.contains('posa-riposo')).toBe(true);
    // Il tiro rifiutato non resta da recitare
    expect(t.ctx.regia.tiroLocale).toBeNull();
    trascina(0, 100);
    expect(gesti).toHaveLength(2);
    expect(t.ctx.regia.tiroLocale!.partenza).toEqual(P2);
    // Anche dopo una recita (togli e mostra) con un tentativo ancora diverso
    t.smettiDiChiedere();
    t.chiedi(fionda({ tentativo: 'c' }), suGesto);
    await pronta(t);
    expect(zona()).not.toBeNull();
    trascina(0, 150);
    expect(gesti).toHaveLength(3);
  });

  it('un tentativo nuovo prima del lancio non disfa la mira', async () => {
    const { t } = nuovo();
    const { gesti, suGesto } = registra();
    t.chiedi(fionda({ tentativo: 'a' }), suGesto);
    await pronta(t);
    const P = doveMontone();
    trascina(0, 150, false);
    t.chiedi(fionda({ tentativo: 'b' }), suGesto);
    expect(doveMontone()).toEqual(piu(P, 0, 150));
    evento('pointerup', window, 100, 750);
    expect(gesti).toHaveLength(1);
    expect(t.ctx.regia.tiroLocale!.partenza).toEqual(P);
  });

  it('una domanda senza fionda dimentica il lancio: la prossima Testata si tira da capo', async () => {
    const { t } = nuovo();
    const { gesti, suGesto } = registra();
    t.chiedi(fionda({ tentativo: 'a' }), suGesto);
    await pronta(t);
    trascina(0, 150);
    t.chiedi(domanda({ dado: true }), suGesto);
    t.chiedi(fionda({ tentativo: 'a' }), suGesto);
    await pronta(t);
    expect(zona()).not.toBeNull();
    trascina(0, 150);
    expect(gesti).toHaveLength(2);
  });

  it('togli: niente elementi della fionda, recinto tornato normale', async () => {
    const { t, camera, palco } = nuovo();
    const l0 = larghezza(palco, 'g2');
    t.chiedi(fionda(), () => undefined);
    await pronta(t);
    expect(larghezza(palco, 'g2')).toBeGreaterThan(l0);
    t.smettiDiChiedere();
    expect(qa('[class*="fionda-"]')).toHaveLength(0);
    expect(zona()).toBeNull();
    await scorri(t, 1500);
    expect(Math.abs(larghezza(palco, 'g2') - l0)).toBeLessThanOrEqual(0.5);
    expect(camera.alterati()).toBe(0);
  });

  it('una domanda nuova senza fionda la toglie', () => {
    const { t } = nuovo();
    t.chiedi(fionda(), () => undefined);
    expect(montone()).not.toBeNull();
    t.chiedi(domanda({ pecore: ['g3'] }), () => undefined);
    expect(qa('[class*="fionda-"]')).toHaveLength(0);
    expect(zona()).toBeNull();
  });

  it('riposiziona: i cerchi seguono il recinto, la partenza resta', async () => {
    const { t, palco } = nuovo();
    t.chiedi(fionda(), () => undefined);
    await pronta(t);
    const P = doveMontone();
    const ingrandito = larghezza(palco, 'g2');
    trascina(0, 100, false);
    // Un resize: tutto resta al suo posto
    t.adatta();
    await scarica();
    cerchiSul(palco, 'g2');
    expect(doveMontone()).toEqual(piu(P, 0, 100));
    // Il tavolo si ricostruisce: recinti nuovi, di misura normale, che tornano a ingrandirsi; i cerchi aspettano e poi lo seguono
    t.allinea(fotoIniziale(3), 'subito');
    expect(larghezza(palco, 'g2')).toBeLessThan(ingrandito);
    expect(cerchiVisibili()).toBe(false);
    expect(qa('.ui .zona-fionda')).toHaveLength(1);
    expect(qa('.mondo .fionda-montone')).toHaveLength(1);
    await pronta(t);
    expect(larghezza(palco, 'g2')).toBeGreaterThan(ingrandito - 0.5);
    cerchiSul(palco, 'g2');
    expect(doveMontone()).toEqual(piu(P, 0, 100));
  });

  it('un tocco sulla zona non è un tocco sul prato', () => {
    const { t } = nuovo();
    const { gesti, suGesto } = registra();
    t.chiedi(fionda(), suGesto);
    evento('pointerdown', zona()!, 100, 600);
    evento('pointerup', zona()!, 100, 600);
    expect(gesti).toEqual([]);
    // Fuori dalla zona, invece, è il prato
    evento('pointerdown', q('.mondo')!, 100, 600);
    expect(gesti).toEqual([{ tipo: 'prato' }]);
  });
});

describe('la partenza vicino alla propria pecora', () => {
  it.each([2 as const, 3 as const, 4 as const])("ogni mira parte un po' più in là, sempre entro il raggio della base (%i giocatori)", (n) => {
    const { t, palco } = nuovo(n);
    const base = baseDi(palco);
    const viste: Punto[] = [];
    for (let i = 0; i < 4; i++) {
      t.chiedi(fionda(), () => undefined);
      viste.push(doveMontone());
      t.smettiDiChiedere();
    }
    for (const p of viste) expect(Math.hypot(p.x - base.x, p.y - base.y)).toBeLessThanOrEqual(FIONDA.variazionePartenza + 1e-9);
    expect(new Set(viste.map((p) => `${p.x},${p.y}`)).size).toBe(viste.length);
  });

  it.each([2 as const, 3 as const, 4 as const])(
    'la zona di tocco non sta sotto il dado, i pulsanti in cima o la nuvoletta del pensiero (la mano è scesa via), e resta nello schermo, con ogni variazione (%i giocatori)',
    (n) => {
      const { t, palco } = nuovo(n);
      // La partita di prova: il consiglio della Testata resta aperto mentre si mira
      t.pensa(CONSIGLIO);
      expect(q('.pensiero .nuvola')).not.toBeNull();
      const caso = t.ctx.caso;
      const posto = palco.posto(palco.inBasso()!)!;
      for (let i = 0; i <= 50; i++) {
        // La variazione la decide il caso della scena a ogni mira: qui la si fissa, una per volta, su tutto il giro
        t.ctx.caso = () => i / 50.0001;
        t.chiedi(fionda(), () => undefined);
        t.ctx.caso = caso;
        // La mano e il consiglio non fanno da ostacolo perché mentre si mira non ci sono
        expect(manoVia(), `mano con ${i / 50}`).toBe(true);
        const r = rettZona();
        const ostacoli = { ...DA_NON_COPRIRE, ...rettPensiero() };
        for (const [nome, ostacolo] of Object.entries(ostacoli)) expect(siToccano(r, ostacolo), `${nome} con ${i / 50}`).toBe(false);
        // In larghezza la zona resta tutta nella scena, da tutte e due le parti
        expect(r.x0, `bordo sinistro con ${i / 50}`).toBeGreaterThanOrEqual(0);
        expect(r.x1, `bordo destro con ${i / 50}`).toBeLessThanOrEqual(W);
        // Il Montone a riposo sta accanto alla propria pecora, alla sua destra: il disegno (dalla coda, 60 a sinistra dei piedi
        // prima della scala) non arriva sulla sua testa (in alto a destra della cornice, fino a circa 0,9 della larghezza)
        const P = doveMontone();
        const k = palco.profondita(P.y) * 1.1;
        expect(P.x - 60 * k, `coda con ${i / 50}`).toBeGreaterThan(posto.x + 0.9 * posto.w);
        // Più in basso della sua testa, non sopra
        expect(P.y, `piedi con ${i / 50}`).toBeGreaterThan(posto.y + 0.3 * posto.w);
        t.smettiDiChiedere();
      }
    },
  );

  it.each([2 as const, 3 as const, 4 as const])(
    'con il consiglio aperto la nuvola sta lontana dalla scia, verso ogni bersaglio; senza fionda torna sopra la pecora (%i giocatori)',
    async (n) => {
      const { t, palco } = nuovo(n);
      t.pensa(CONSIGLIO);
      const sopra = rettPensiero().nuvola!;
      for (const b of palco.giocatori().slice(1)) {
        t.chiedi(fionda({ bersaglio: b }), () => undefined);
        await pronta(t);
        const ostacoli = rettPensiero();
        // La nuvola tutta nello schermo
        expect(ostacoli.nuvola!.y1).toBeLessThanOrEqual(844);
        const P = doveMontone();
        const c = centroDi(palco, b);
        const d = Math.hypot(c.x - P.x, c.y - P.y);
        for (const l of [META_TIRO, FIONDA.tiroMassimo]) {
          // L'elastico dalla parte opposta al centro del recinto: tutta la scia (anche la più lunga) fuori dalla nuvola
          trascina((-(c.x - P.x) / d) * l, (-(c.y - P.y) / d) * l, false);
          // Mentre si carica la nuvola si nasconde (restano i pallini): il Montone tirato indietro scende verso di lei
          expect(q('.ui')!.classList.contains('fionda-in-carica')).toBe(true);
          expect(puntini()).toHaveLength(FIONDA.puntiScia);
          for (const p of puntini()) {
            const x = numero(p, 'cx'), y = numero(p, 'cy');
            const r = { x0: x - 5, y0: y - 5, x1: x + 5, y1: y + 5 };
            for (const [nome, o] of Object.entries(ostacoli)) expect(siToccano(r, o), `${nome}, ${b}, ${l}`).toBe(false);
          }
          evento('pointercancel', window, 100, 600);
          expect(q('.ui')!.classList.contains('fionda-in-carica')).toBe(false);
        }
        // Lanciato e tolto: la nuvola torna visibile
        trascina(0, 100, false);
        t.smettiDiChiedere();
        expect(q('.ui')!.classList.contains('fionda-in-carica')).toBe(false);
      }
      // Senza la fionda torna al suo posto, sopra la testa della pecora
      t.chiedi(domanda(), () => undefined);
      expect(rettPensiero().nuvola).toEqual(sopra);
    },
  );
});

describe('chi tira non sta in basso ("Passa il telefono")', () => {
  /** Il recinto a riposo (non ingrandito), come lo usa la mira per scegliere la partenza. */
  const aRiposo = (palco: Palco, chi: IdGiocatore): Rett => {
    const a = palco.area(chi)!;
    const [x0, y0, x1, y1] = a.area0 ?? [a.x0, a.y0, a.x1, a.y1];
    return { x0, y0, x1, y1 };
  };
  const vicino = (p: Punto, q: Punto): void => {
    expect(p.x).toBeCloseTo(q.x, 6);
    expect(p.y).toBeCloseTo(q.y, 6);
  };

  it('chi tira sta in basso: parte vicino alla sua pecora, come senza dirlo', () => {
    const { t, palco } = nuovo();
    t.ctx.caso = () => 0.37;
    t.chiedi(fionda({ chi: 'g1' }), () => undefined);
    vicino(doveMontone(), partenzaDi(baseDi(palco), 0.37));
  });

  it.each([2 as const, 3 as const, 4 as const])(
    'chi tira sta in alto: vicino alla sua pecora se c\'è spazio per tirare, altrimenti dal centro della tovaglia; mai dalla pecora di chi sta in basso (%i giocatori)',
    (n) => {
      const { t, palco } = nuovo(n);
      const [, ...inAlto] = palco.giocatori();
      const caso = t.ctx.caso;
      for (const chi of inAlto) {
        for (const b of palco.giocatori().filter((c) => c !== chi)) {
          t.ctx.caso = () => 0.37;
          t.chiedi(fionda({ chi, bersaglio: b }), () => undefined);
          t.ctx.caso = caso;
          const P = doveMontone();
          const suo = partenzaDi(basePartenza(palco.posto(chi)!), 0.37);
          vicino(P, spazioPerTirare(suo, aRiposo(palco, b)) ? suo : partenzaDi(CENTRO_TAVOLO, 0.37));
          const giu = baseDi(palco);
          expect(Math.hypot(P.x - giu.x, P.y - giu.y), `${chi} → ${b}`).toBeGreaterThan(2 * FIONDA.variazionePartenza);
          t.smettiDiChiedere();
        }
      }
    },
  );

  it('a 3 giocatori chi sta in alto non ha spazio per tirare: parte dal centro della tovaglia, come nella prima versione', () => {
    const { t } = nuovo(3);
    for (const [chi, b] of [['g2', 'g3'], ['g2', 'g1'], ['g3', 'g2'], ['g3', 'g1']] as const) {
      t.ctx.caso = () => 0.37;
      t.chiedi(fionda({ chi, bersaglio: b }), () => undefined);
      vicino(doveMontone(), partenzaDi(CENTRO_TAVOLO, 0.37));
      t.smettiDiChiedere();
    }
  });

  it('con "Passa il telefono" a 4 la pecora di chi tira (non in basso) resta piena; si attenua solo il quarto', () => {
    const { t, camera } = nuovo(4);
    const ingrandisci = vi.spyOn(camera, 'ingrandisciRecinto');
    t.chiedi(fionda({ chi: 'g3', bersaglio: 'g2' }), () => undefined);
    expect(ingrandisci).toHaveBeenCalledWith('g2', FIONDA.ingrandimento, FIONDA.attenuati, 'g3');
    const opacita = (chi: string): Set<string> =>
      new Set([...t.ctx.el.mondo.querySelectorAll<HTMLElement>(`[data-chi="${chi}"]`)].map((e) => e.style.opacity));
    expect(opacita('g3')).toEqual(new Set(['']));
    expect(opacita('g4')).toEqual(new Set([String(FIONDA.attenuati)]));
  });

  it('il tiro ricordato dice chi ha tirato; la stessa fionda per un altro tiratore è un\'altra mira', async () => {
    const { t } = nuovo(3);
    const { gesti, suGesto } = registra();
    t.chiedi(fionda({ chi: 'g2', bersaglio: 'g3', tentativo: 'a' }), suGesto);
    await pronta(t);
    tasto(zona()!, 'Enter');
    expect(gesti).toHaveLength(1);
    expect(t.ctx.regia.tiroLocale!.chi).toBe('g2');
    expect(zona()).toBeNull();
    // Stesso bersaglio, massimo e tentativo, ma tira un altro: si mira da capo
    t.chiedi(fionda({ chi: 'g1', bersaglio: 'g3', tentativo: 'a' }), suGesto);
    expect(zona()).not.toBeNull();
  });
});

describe('il Montone mentre si carica', () => {
  it('--carica segue la forza (elastico / elastico pieno), anche con le frecce; a riposo torna 0 e la posa di riposo', async () => {
    const { t } = nuovo();
    t.chiedi(fionda(), () => undefined);
    await pronta(t);
    const m = montone()!;
    const carica = (): number => Number(m.style.getPropertyValue('--carica'));
    expect(carica()).toBe(0);
    trascina(0, FIONDA.tiroMassimo / 2, false);
    expect(m.classList.contains('posa-carica')).toBe(true);
    expect(m.classList.contains('posa-riposo')).toBe(false);
    expect(carica()).toBeCloseTo(0.5, 3);
    evento('pointermove', window, 100, 600 + FIONDA.tiroMassimo * 0.8);
    expect(carica()).toBeCloseTo(0.8, 3);
    // Oltre la forza piena resta 1
    evento('pointermove', window, 100, 600 + FIONDA.tiroMassimo * 2);
    expect(carica()).toBeCloseTo(1, 3);
    evento('pointercancel', window, 100, 600);
    expect(m.classList.contains('posa-riposo')).toBe(true);
    expect(carica()).toBe(0);
    // Con le frecce: la forza della mira da tastiera, una freccia su la fa crescere di un passo
    tasto(zona()!, 'ArrowUp');
    expect(m.classList.contains('posa-carica')).toBe(true);
    const prima = carica();
    expect(prima).toBeGreaterThan(0);
    tasto(zona()!, 'ArrowUp');
    expect(carica() - prima).toBeCloseTo((lunghezzaElastico(PASSO_FORZA) - FIONDA.tiroMinimo) / FIONDA.tiroMassimo, 2);
  });

  it('movimento ridotto: il Montone è fermo (classe ferma)', () => {
    const { t } = nuovo();
    t.ctx.ridotto = true;
    t.chiedi(fionda(), () => undefined);
    expect(montone()!.classList.contains('ferma')).toBe(true);
    t.smettiDiChiedere();
    t.ctx.ridotto = false;
    t.chiedi(fionda(), () => undefined);
    expect(montone()!.classList.contains('ferma')).toBe(false);
  });
});

describe('la mira si legge', () => {
  it.each([2 as const, 3 as const, 4 as const])('i cerchi disegnati sono le zone: centro 3, recinto 2, staccionata e fascia 1, fuori 0 (%i giocatori)', async (n) => {
    const { t, palco } = nuovo(n);
    t.chiedi(fionda({ bersaglio: 'g2' }), () => undefined);
    await pronta(t);
    trascina(0, 100, false);
    const a = palco.area('g2')!;
    const { centro, dentro, fascia } = cerchi();
    const e = 0.5;
    // Il bordo dell'ellisse del centro: poco dentro 3, poco fuori 2
    for (let i = 0; i < 16; i++) {
      const ang = (i / 16) * 2 * Math.PI;
      const su = (f: number): Punto => ({ x: centro!.cx + Math.cos(ang) * centro!.rx * f, y: centro!.cy + Math.sin(ang) * centro!.ry * f });
      expect(zonaDi(su(0.97), a)).toBe(3);
      expect(zonaDi(su(1.03), a)).toBe(2);
    }
    // Il rettangolo del recinto: poco dentro 2, sulla staccionata o poco fuori 1
    const d = dentro!;
    const mx = d.x + d.width / 2, my = d.y + d.height / 2;
    const bordi: Array<[Punto, Punto]> = [
      [{ x: d.x + e, y: my }, { x: d.x - e, y: my }],
      [{ x: d.x + d.width - e, y: my }, { x: d.x + d.width + e, y: my }],
      [{ x: mx, y: d.y + e }, { x: mx, y: d.y - e }],
      [{ x: mx, y: d.y + d.height - e }, { x: mx, y: d.y + d.height + e }],
    ];
    for (const [dentroRecinto, fuori] of bordi) {
      expect(zonaDi(dentroRecinto, a)).toBe(2);
      expect(zonaDi(fuori, a)).toBe(1);
    }
    // La fascia (rettangolo con gli angoli tondi): poco dentro 1, poco fuori 0, anche sugli angoli
    const f = fascia!;
    const fx = f.x + f.width / 2, fy = f.y + f.height / 2;
    const lati: Array<[Punto, Punto]> = [
      [{ x: f.x + e, y: fy }, { x: f.x - e, y: fy }],
      [{ x: f.x + f.width - e, y: fy }, { x: f.x + f.width + e, y: fy }],
      [{ x: fx, y: f.y + e }, { x: fx, y: f.y - e }],
      [{ x: fx, y: f.y + f.height - e }, { x: fx, y: f.y + f.height + e }],
    ];
    // Gli angoli: quarti d'ellisse di raggi rx, ry attorno agli spigoli del recinto
    for (const [sx, sy, ox, oy] of [[-1, -1, a.x0, a.y0], [1, -1, a.x1, a.y0], [1, 1, a.x1, a.y1], [-1, 1, a.x0, a.y1]] as const) {
      const su = (k: number): Punto => ({ x: ox + sx * f.rx * Math.SQRT1_2 * k, y: oy + sy * f.ry * Math.SQRT1_2 * k });
      lati.push([su(0.98), su(1.02)]);
    }
    for (const [nellaFascia, fuori] of lati) {
      expect(zonaDi(nellaFascia, a)).toBe(1);
      expect(zonaDi(fuori, a)).toBe(0);
    }
  });

  it.each([2 as const, 3 as const, 4 as const])('i numeri sono bollini leggibili: 3 al centro, 2 dentro il recinto, 1 nella fascia fuori dalla staccionata (%i giocatori)', async (n) => {
    const { t, palco } = nuovo(n);
    const bersagli = palco.giocatori().filter((g) => g !== palco.inBasso());
    for (const bersaglio of bersagli) {
      t.chiedi(fionda({ bersaglio }), () => undefined);
      await pronta(t);
      trascina(0, 100, false);
      const a = palco.area(bersaglio)!;
      const c = centroDi(palco, bersaglio);
      const mezzaL = (a.x1 - a.x0) / 2;
      const bollini = qa<SVGGElement>('.mondo .fionda-cerchi .bollino');
      expect(bollini.map((b) => b.querySelector('text')!.textContent)).toEqual(['3', '2', '1']);
      const xDi = (b: SVGGElement): number => Number(b.querySelector('text')!.getAttribute('x'));
      const yDi = (b: SVGGElement): number => Number(b.querySelector('text')!.getAttribute('y'));
      for (const b of bollini) {
        // Una pillola di gesso sotto il numero, e un corpo di almeno 12 unità del mondo
        const r = b.querySelector('rect')!;
        expect(r).not.toBeNull();
        expect(Number(r.getAttribute('height'))).toBeGreaterThanOrEqual(12);
        expect(Number(b.querySelector('text')!.getAttribute('font-size'))).toBeGreaterThanOrEqual(12);
        expect(yDi(b)).toBeCloseTo(c.y, 3);
        // Tutta la pillola dentro la scena
        expect(Number(r.getAttribute('x'))).toBeGreaterThanOrEqual(0);
        expect(Number(r.getAttribute('x')) + Number(r.getAttribute('width'))).toBeLessThanOrEqual(W);
      }
      const [tre, due, uno] = bollini as [SVGGElement, SVGGElement, SVGGElement];
      expect(xDi(tre)).toBeCloseTo(c.x, 3);
      expect(xDi(due)).toBeGreaterThan(c.x + FIONDA.cerchi.centro * mezzaL);
      // Ogni numero sta nella sua zona; l'1 fuori dalla staccionata, nella fascia
      expect(zonaDi({ x: xDi(tre), y: yDi(tre) }, a)).toBe(3);
      expect(zonaDi({ x: xDi(due), y: yDi(due) }, a)).toBe(2);
      expect(zonaDi({ x: xDi(uno), y: yDi(uno) }, a)).toBe(1);
      expect(xDi(uno) > a.x1 || xDi(uno) < a.x0).toBe(true);
      evento('pointercancel', window, 100, 700);
      t.smettiDiChiedere();
      await scorri(t, 1500);
    }
  });

  it('la scia: puntini più grandi, sopra il Montone', async () => {
    const { t } = nuovo();
    t.chiedi(fionda(), () => undefined);
    await pronta(t);
    trascina(0, 100, false);
    for (const p of puntini()) expect(Number(p.getAttribute('r'))).toBeCloseTo(4.5, 3);
    const css = readFileSync(resolve(process.cwd(), 'client/src/scena/scena.css'), 'utf8');
    const zeta = (classe: string): number => Number(new RegExp(`\\.teatro \\.${classe} \\{[^}]*z-index:\\s*(\\d+)`).exec(css)?.[1] ?? NaN);
    expect(zeta('fionda-scia')).toBeGreaterThan(zeta('fionda-montone'));
  });

  it('mentre si mira gli agnellini non giocano (niente fumetti sui cerchi); dopo riprendono', async () => {
    const { t, palco } = nuovo();
    const giochi = palco.branco()!.giochi;
    giochi.attivo = true;
    t.chiedi(fionda(), () => undefined);
    expect(giochi.attivo).toBe(false);
    // La stessa fionda rimessa a posto non cambia niente
    t.chiedi(fionda(), () => undefined);
    expect(giochi.attivo).toBe(false);
    t.smettiDiChiedere();
    expect(giochi.attivo).toBe(true);
    // Chi li aveva fermati prima (fine partita) li ritrova fermi
    giochi.attivo = false;
    t.chiedi(fionda(), () => undefined);
    t.smettiDiChiedere();
    expect(giochi.attivo).toBe(false);
  });
});

describe('la mano mentre si mira', () => {
  it('compare il Montone: mano e consiglio scendono via; un tocco per sbaglio non li riporta; il lancio sì', async () => {
    const { t } = nuovo();
    const { gesti, suGesto } = registra();
    expect(manoVia()).toBe(false);
    t.chiedi(fionda(), suGesto);
    expect(manoVia()).toBe(true);
    await pronta(t);
    // Un tocco per sbaglio e un elastico troppo corto: il tiro non parte, la mano resta giù
    trascina(0, 0);
    trascina(0, FIONDA.tiroMinimo / 2);
    expect(gesti).toEqual([]);
    expect(manoVia()).toBe(true);
    // Mentre si carica resta giù
    trascina(0, 150, false);
    expect(manoVia()).toBe(true);
    // Al lancio torna su, mentre il Montone vola (la domanda c'è ancora)
    evento('pointerup', window, 100, 750);
    expect(gesti).toHaveLength(1);
    expect(manoVia()).toBe(false);
    expect(montone()).not.toBeNull();
  });

  it('con la tastiera: le frecce non la riportano, Invio che lancia sì', async () => {
    const { t } = nuovo();
    const { gesti, suGesto } = registra();
    t.chiedi(fionda(), suGesto);
    await pronta(t);
    tasto(zona()!, 'ArrowUp');
    expect(manoVia()).toBe(true);
    tasto(zona()!, 'Enter');
    expect(gesti).toHaveLength(1);
    expect(manoVia()).toBe(false);
  });

  it('la domanda se ne va (Beee-NO!, interruzione, fine) o cambia senza fionda: la mano torna', () => {
    const { t } = nuovo();
    t.chiedi(fionda(), () => undefined);
    expect(manoVia()).toBe(true);
    t.smettiDiChiedere();
    expect(manoVia()).toBe(false);
    t.chiedi(fionda(), () => undefined);
    expect(manoVia()).toBe(true);
    t.chiedi(domanda(), () => undefined);
    expect(manoVia()).toBe(false);
  });

  it('la stessa fionda già tirata torna tirata: mano su; un tentativo nuovo fa mirare di nuovo: mano giù', async () => {
    const { t } = nuovo();
    const { suGesto } = registra();
    t.chiedi(fionda({ tentativo: 'a' }), suGesto);
    await pronta(t);
    trascina(0, 150);
    expect(manoVia()).toBe(false);
    t.smettiDiChiedere();
    t.chiedi(fionda({ tentativo: 'a' }), suGesto);
    expect(manoVia()).toBe(false);
    t.chiedi(fionda({ tentativo: 'b' }), suGesto);
    expect(manoVia()).toBe(true);
  });

  it('ricostruzione della scena o ritorno da un\'altra scheda durante la mira: niente mano bloccata giù', async () => {
    const { t } = nuovo();
    const { gesti, suGesto } = registra();
    t.chiedi(fionda(), suGesto);
    await pronta(t);
    // Ricostruita la scena il Montone aspetta ancora il tiro: la mano resta giù (non torna a coprirlo)
    t.allinea(fotoIniziale(3), 'subito');
    expect(manoVia()).toBe(true);
    // Ritorno da un'altra scheda (la scena si rimette in pari subito, il tempo va avanti): ancora giù
    t.allinea(fotoIniziale(3), 'subito');
    await scorri(t, 2000);
    expect(manoVia()).toBe(true);
    // La domanda se ne va: la mano torna, anche dopo le ricostruzioni
    t.smettiDiChiedere();
    expect(manoVia()).toBe(false);
    // Dopo il lancio una ricostruzione non la rimanda giù
    t.chiedi(fionda(), suGesto);
    await pronta(t);
    trascina(0, 150);
    expect(gesti).toHaveLength(1);
    t.allinea(fotoIniziale(3), 'subito');
    expect(manoVia()).toBe(false);
  });

  it('movimento ridotto: senza scivolare; scena.css porta giù mano e consiglio e li nasconde mentre si mira', () => {
    const css = readFileSync(resolve(process.cwd(), 'client/src/scena/scena.css'), 'utf8').replace(/\r\n/g, '\n');
    const regola = (selettore: string): string => {
      const i = css.indexOf(selettore);
      expect(i, selettore).toBeGreaterThanOrEqual(0);
      return css.slice(i, css.indexOf('}', i));
    };
    const via = regola('.teatro .ui.fionda-in-mira .mano,\n.teatro .ui.fionda-in-mira .consiglio {');
    expect(via).toMatch(/translate:\s*0\s+\d+px/);
    expect(via).toMatch(/visibility:\s*hidden/);
    // Quanto scende: oltre il bordo in basso anche con le carte più grandi (cima del ventaglio ~690 con ingrandimento 1,25)
    expect(Number(/translate:\s*0\s+(\d+)px/.exec(via)![1])).toBeGreaterThanOrEqual(844 - 640);
    // Con il movimento ridotto spariscono e tornano senza scivolare
    const ridotto = css.slice(css.indexOf('/* Movimento ridotto: la mano'));
    expect(ridotto).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.teatro \.ui \.mano,\s*\.teatro \.ui \.consiglio,[^{]*\.teatro \.ui\.fionda-in-mira \.consiglio \{[^}]*translate 0s/);
  });
});

describe('il volo segue la scia: su chi tira il Montone atterra sulla linea mostrata, dalla stessa partenza', () => {
  /** I piedi del Montone in un fotogramma del volo (ordini.ts: translate dei piedi meno 75, 102). */
  function piedi(f: Keyframe): Punto {
    const m = /translate\(([-\d.e]+)px,\s*([-\d.e]+)px\)/.exec(String(f.transform));
    expect(m, String(f.transform)).not.toBeNull();
    return { x: Number(m![1]) + 75, y: Number(m![2]) + 102 };
  }
  /** La distanza di `p` dalla retta per `a` e `b`. */
  const dallaRetta = (p: Punto, a: Punto, b: Punto): number =>
    Math.abs((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) / Math.hypot(b.x - a.x, b.y - a.y);
  /** Lascia andare la scena finché la promessa non si risolve (al più 10 s di scena). */
  async function finoAllaFine(t: Teatro, p: Promise<void>): Promise<void> {
    let finito = false;
    void p.then(() => (finito = true));
    await scarica();
    for (let ms = 0; !finito && ms < 10000; ms += 100) await scorri(t, 100);
    expect(finito).toBe(true);
  }
  const copia = (a: Rett): Rett => ({ x0: a.x0, y0: a.y0, x1: a.x1, y1: a.y1 });
  const aRiposo = (palco: Palco, chi: IdGiocatore): Rett => {
    const a = palco.area(chi)!;
    const [x0, y0, x1, y1] = a.area0 ?? [a.x0, a.y0, a.x1, a.y1];
    return { x0, y0, x1, y1 };
  };
  type Dove = 'sinistra' | 'dritto' | 'destra' | 'corto';
  /**
   * Il tiro (elastico, unità del mondo: in jsdom un pixel del dito) che dalla partenza `P` arriva sul recinto `r` (quello
   * della mira, ingrandito): a sinistra o a destra del centro (zona 2), dritto al centro (zona 3), corto davanti (a vuoto).
   */
  function tiroVerso(P: Punto, r: Rett, dove: Dove): Punto {
    const c = { x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2 };
    const scosta = { sinistra: -0.6, dritto: 0, destra: 0.6, corto: 0 }[dove];
    const meta = { x: c.x + scosta * ((r.x1 - r.x0) / 2), y: c.y };
    const d = Math.hypot(meta.x - P.x, meta.y - P.y);
    const forza = dove === 'corto' ? 0.02 : forzaPerDistanza(d, fasciaDi(P, r));
    const l = lunghezzaElastico(forza);
    return { x: (-(meta.x - P.x) / d) * l, y: (-(meta.y - P.y) / d) * l };
  }

  /**
   * Mira e tira verso `bersaglio` (chi tira: `chi`, di base chi sta in basso), poi la domanda se ne va e la regia recita la
   * Testata con l'esito del gesto: `ordine` dice se la domanda se ne va prima del volo (pagina di sviluppo, partita) o dopo
   * che il volo è partito. Controlla che il volo parta dal Montone della mira e atterri sulla linea della scia, nella zona
   * dell'esito sul recinto su cui si è mirato; poi che il recinto torni normale.
   */
  async function tiraEGuarda(
    t: Teatro,
    palco: Palco,
    camera: Camera,
    o: { bersaglio: IdGiocatore; chi?: IdGiocatore; dove: Dove; ordine?: 'domanda-prima' | 'volo-prima'; tentativo: string },
  ): Promise<void> {
    const chi = o.chi ?? palco.inBasso()!;
    const caso = `${o.chi ?? ''}→${o.bersaglio} ${o.dove} (${o.ordine ?? 'domanda-prima'})`;
    const riposo = aRiposo(palco, o.bersaglio);
    const { gesti, suGesto } = registra();
    t.chiedi(fionda({ chi: o.chi, bersaglio: o.bersaglio, tentativo: o.tentativo }), suGesto);
    await pronta(t);
    const mirato = copia(palco.area(o.bersaglio)!);
    const P = doveMontone();
    const tiro = tiroVerso(P, mirato, o.dove);
    trascina(tiro.x, tiro.y, false);
    const scia = puntini().map((c) => ({ x: Number(c.getAttribute('cx')), y: Number(c.getAttribute('cy')) }));
    expect(scia, caso).toHaveLength(FIONDA.puntiScia);
    evento('pointerup', window, 100 + tiro.x, 600 + tiro.y);
    expect(gesti, caso).toHaveLength(1);
    const esito = (gesti[0] as { esito: number }).esito;
    if (o.dove !== 'corto') expect(esito, caso).toBeGreaterThan(0);
    else expect(esito, caso).toBe(0);
    const anima = vi.spyOn(t.ctx, 'anima');
    let fine: Promise<void>;
    if (o.ordine === 'volo-prima') {
      fine = t.ordini.testata(chi, o.bersaglio, esito, 7);
      t.chiedi(domanda({ dado: true }), () => undefined);
    } else {
      t.smettiDiChiedere();
      fine = t.ordini.testata(chi, o.bersaglio, esito, 7);
    }
    await finoAllaFine(t, fine);
    const voli = anima.mock.calls.filter(([e]) => (e as HTMLElement).classList.contains('montone')).map(([, f]) => f);
    anima.mockRestore();
    const volo = voli[0]!;
    const da = piedi(volo[0]!);
    const arrivo = piedi(volo[volo.length - 1]!);
    // Dalla stessa partenza
    expect(da.x, caso).toBeCloseTo(P.x, 3);
    expect(da.y, caso).toBeCloseTo(P.y, 3);
    // Sulla linea della scia, dalla stessa parte (la scia è l'inizio del volo): ogni puntino sta sulla retta del volo
    const ultimo = scia[scia.length - 1]!;
    expect(dallaRetta(arrivo, P, ultimo), `${caso}: arrivo ${arrivo.x},${arrivo.y} lontano dalla scia`).toBeLessThan(0.5);
    for (const p of scia) expect(dallaRetta(p, P, arrivo), caso).toBeLessThan(0.5);
    expect((arrivo.x - P.x) * (ultimo.x - P.x) + (arrivo.y - P.y) * (ultimo.y - P.y), caso).toBeGreaterThan(0);
    expect(Math.hypot(arrivo.x - P.x, arrivo.y - P.y), caso).toBeGreaterThan(Math.hypot(ultimo.x - P.x, ultimo.y - P.y));
    // Nella zona dell'esito, sul recinto su cui si è mirato
    expect(Math.min(zonaDi(arrivo, mirato), 3), caso).toBe(esito);
    // Poi il recinto torna com'era
    await scorri(t, 1500);
    const ora = palco.area(o.bersaglio)!;
    for (const k of ['x0', 'y0', 'x1', 'y1'] as const) expect(Math.abs(ora[k] - riposo[k]), `${caso}: ${k}`).toBeLessThanOrEqual(0.5);
    expect(camera.alterati(), caso).toBe(0);
  }

  it.each([2 as const, 3 as const, 4 as const])(
    'a sinistra, dritto, a destra e corto, verso ogni avversario, col recinto ingrandito (%i giocatori)',
    async (n) => {
      const { t, palco, camera } = nuovo(n);
      let i = 0;
      for (const bersaglio of palco.giocatori().filter((c) => c !== palco.inBasso())) {
        for (const dove of ['sinistra', 'dritto', 'destra', 'corto'] as const) {
          await tiraEGuarda(t, palco, camera, { bersaglio, dove, tentativo: String(i++) });
        }
      }
    },
  );

  it('il volo parte prima che la domanda se ne vada (partita, stanze): uguale, e il recinto non torna normale sotto il volo', async () => {
    const { t, palco, camera } = nuovo(3);
    let i = 0;
    for (const bersaglio of ['g2', 'g3']) {
      for (const dove of ['sinistra', 'destra'] as const) {
        await tiraEGuarda(t, palco, camera, { bersaglio, dove, ordine: 'volo-prima', tentativo: String(i++) });
      }
    }
  });

  it('"Passa il telefono" a 4: chi tira sta in alto, verso un avversario (recinto ingrandito) e verso chi sta in basso', async () => {
    const { t, palco, camera } = nuovo(4);
    let i = 0;
    for (const [chi, bersaglio, dove] of [
      ['g3', 'g2', 'sinistra'],
      ['g3', 'g2', 'destra'],
      ['g2', 'g4', 'dritto'],
      ['g3', 'g1', 'sinistra'],
      ['g3', 'g1', 'destra'],
    ] as const) {
      await tiraEGuarda(t, palco, camera, { chi, bersaglio, dove, tentativo: String(i++) });
    }
  });

  it.each([2 as const, 3 as const, 4 as const])(
    'il colpo lungo (tirato quasi al massimo, e al massimo) segue la linea della scia finché sparisce, poi il recinto torna normale (%i giocatori)',
    async (n) => {
      const { t, palco, camera } = nuovo(n);
      const bersaglio = palco.giocatori().find((c) => c !== palco.inBasso())!;
      let i = 0;
      for (const l of [FIONDA.tiroMassimo - FIONDA.cielo.pieno - 4, FIONDA.tiroMassimo]) {
        const { gesti, suGesto } = registra();
        t.chiedi(fionda({ bersaglio, tentativo: String(i++) }), suGesto);
        await pronta(t);
        const mirato = { ...palco.area(bersaglio)! };
        const P = doveMontone();
        const c = { x: (mirato.x0 + mirato.x1) / 2, y: (mirato.y0 + mirato.y1) / 2 };
        const d = Math.hypot(c.x - P.x, c.y - P.y);
        const tiro = { x: (-(c.x - P.x) / d) * l, y: (-(c.y - P.y) / d) * l };
        trascina(tiro.x, tiro.y, false);
        const ultimo = puntini().at(-1)!;
        const scia = { x: Number(ultimo.getAttribute('cx')), y: Number(ultimo.getAttribute('cy')) };
        evento('pointerup', window, 100 + tiro.x, 600 + tiro.y);
        const nota = `${n} giocatori, elastico ${l}`;
        expect(gesti, nota).toEqual([{ tipo: 'fionda', esito: 0 }]);
        const vero = t.ctx.regia.tiroLocale!.arrivo;
        expect(colpoLungo(P, vero, mirato), nota).toBe(true);
        expect(t.ctx.regia.tiroLocale!.pieno, nota).toBe(l === FIONDA.tiroMassimo);
        const anima = vi.spyOn(t.ctx, 'anima');
        t.smettiDiChiedere();
        let finito = false;
        void t.ordini.testata('g1', bersaglio, 0, 7).then(() => (finito = true));
        await scarica();
        for (let ms = 0; !finito && ms < 10000; ms += 100) await scorri(t, 100);
        expect(finito, nota).toBe(true);
        const volo = anima.mock.calls.find(([e]) => (e as HTMLElement).classList.contains('montone'))![1];
        anima.mockRestore();
        const piede = (k: Keyframe): Punto => {
          const m = /translate\(([-\d.e]+)px,\s*([-\d.e]+)px\)/.exec(String(k.transform))!;
          return { x: Number(m[1]) + 75, y: Number(m[2]) + 102 };
        };
        const dallaRetta = (q: Punto): number =>
          Math.abs((scia.x - P.x) * (q.y - P.y) - (scia.y - P.y) * (q.x - P.x)) / Math.hypot(scia.x - P.x, scia.y - P.y);
        if (l === FIONDA.tiroMassimo) {
          // Nel cielo: dritto, sempre sulla linea della scia
          for (const k of volo) expect(dallaRetta(piede(k)), nota).toBeLessThan(0.5);
        } else {
          // Dietro la collina: ad arco (in verticale), in pianta sulla linea fino a dove esce dalla fascia del recinto
          const E = fineDietroLaCollina(P, vero, mirato);
          volo.forEach((k, j) => expect(piede(k).x, nota).toBeCloseTo(P.x + ((E.x - P.x) * j) / (volo.length - 1), 3));
          expect(dallaRetta(piede(volo.at(-1)!)), nota).toBeLessThan(0.5);
        }
        expect(qa('.montone, .luccichio-testata'), nota).toHaveLength(0);
        await scorri(t, 1500);
        expect(camera.alterati(), nota).toBe(0);
      }
    },
  );

  it('la mira tolta prima del lancio rimette subito a posto il recinto; dopo il lancio lo lascia grande fino al volo', async () => {
    const { t, palco } = nuovo(3);
    const riposo = aRiposo(palco, 'g2');
    const largo = (): number => palco.area('g2')!.x1 - palco.area('g2')!.x0;
    t.chiedi(fionda({ tentativo: 'a' }), () => undefined);
    await pronta(t);
    t.smettiDiChiedere();
    await scorri(t, 1500);
    expect(Math.abs(largo() - (riposo.x1 - riposo.x0))).toBeLessThanOrEqual(0.5);
    t.chiedi(fionda({ tentativo: 'b' }), () => undefined);
    await pronta(t);
    const grande = largo();
    expect(grande).toBeGreaterThan(riposo.x1 - riposo.x0 + 1);
    trascina(0, META_TIRO);
    t.smettiDiChiedere();
    await scorri(t, 1500);
    expect(largo()).toBeCloseTo(grande, 3);
  });
});
