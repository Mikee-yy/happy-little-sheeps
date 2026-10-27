// @vitest-environment jsdom
// Prove della camera: il recinto di un avversario che si ingrandisce sul posto, senza muovere la camera.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// Questo file monta teatri veri: con tutte le prove insieme una prova può superare i 5 s predefiniti (la macchina è
// carica). Il limite più alto vale per tutto il file, così la prossima prova lenta non fallisce per finta.
vi.setConfig({ testTimeout: 60_000 });
import { casoConSeme } from './aiuti-prova';
import type { Camera } from './camera';
import type { Palco } from './palco';
import { creaTeatro, type Teatro } from './teatro';
import { fotoIniziale, scorri } from './meteo/aiuti-meteo';

// La camera non esce dal teatro: la si prende, con il suo palco, al momento della creazione
const presa = vi.hoisted(() => ({ camera: null as unknown, palco: null as unknown }));
vi.mock('./camera', async (originale) => {
  const m = await originale<typeof import('./camera')>();
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
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

function scena() {
  const t = (teatro = creaTeatro(radice, { ciclo: 'manuale', ambiente: false, giochi: false, caso: casoConSeme(5) }));
  t.allinea(fotoIniziale(3), 'calmo');
  const camera = presa.camera as Camera, palco = presa.palco as Palco;
  const larghezza = (chi: string) => {
    const a = palco.area(chi)!;
    return a.x1 - a.x0;
  };
  return { t, camera, palco, larghezza };
}

describe('camera: ingrandisciRecinto', () => {
  it('ingrandisce il recinto sul posto senza zoom; con null lo riporta com\'era', async () => {
    const { t, camera, palco, larghezza } = scena();
    const prima = palco.area('g2')!.area0!, l0 = larghezza('g2');
    const dentro = camera.ingrandisciRecinto('g2');
    await scorri(t, 1500);
    await dentro;
    expect(larghezza('g2')).toBeGreaterThan(l0);
    expect(camera.zoom()).toBe(1);
    expect(camera.inquadrato()).toBeNull();
    expect(camera.nascoste()).toBe(0);
    const fuori = camera.ingrandisciRecinto(null);
    await scorri(t, 1500);
    await fuori;
    const a = palco.area('g2')!;
    expect(Math.abs(a.x0 - prima[0])).toBeLessThanOrEqual(0.5);
    expect(Math.abs(a.y0 - prima[1])).toBeLessThanOrEqual(0.5);
    expect(Math.abs(a.x1 - prima[2])).toBeLessThanOrEqual(0.5);
    expect(Math.abs(a.y1 - prima[3])).toBeLessThanOrEqual(0.5);
    expect(camera.alterati()).toBe(0);
  });

  it('passando a un altro avversario, il primo torna normale', async () => {
    const { t, camera, larghezza } = scena();
    const l2 = larghezza('g2');
    void camera.ingrandisciRecinto('g2');
    await scorri(t, 1500);
    const ingrandito = larghezza('g2');
    expect(ingrandito).toBeGreaterThan(l2);
    void camera.ingrandisciRecinto('g3');
    await scorri(t, 1500);
    expect(Math.abs(larghezza('g2') - l2)).toBeLessThanOrEqual(0.5);
    expect(camera.alterati()).toBe(1);
  });

  it('durante inquadra di un altro, ingrandisciRecinto(null) non disturba l\'inquadratura', async () => {
    const { t, camera, larghezza } = scena();
    const dentro = camera.inquadra('g3');
    await scorri(t, 1500);
    await dentro;
    const l3 = larghezza('g3'), k = camera.zoom();
    expect(k).toBeGreaterThan(1);
    await camera.ingrandisciRecinto(null);
    await scorri(t, 500);
    expect(camera.inquadrato()).toBe('g3');
    expect(camera.zoom()).toBe(k);
    expect(larghezza('g3')).toBe(l3);
    expect(camera.nascoste()).toBe(1); // con 3 giocatori: solo g2
  });

  it('ingrandito e poi inquadrato: ingrandisciRecinto(null) non lo stringe', async () => {
    const { t, camera, larghezza } = scena();
    const l0 = larghezza('g2');
    void camera.ingrandisciRecinto('g2');
    await scorri(t, 1500);
    const dentro = camera.inquadra('g2');
    await scorri(t, 1500);
    await dentro;
    const l = larghezza('g2');
    expect(l).toBeGreaterThan(l0);
    void camera.ingrandisciRecinto(null);
    await scorri(t, 1500);
    expect(camera.inquadrato()).toBe('g2');
    expect(larghezza('g2')).toBe(l);
  });

  it('con un fattore il recinto si ingrandisce di più, in proporzione', async () => {
    const { t, camera, larghezza } = scena();
    void camera.ingrandisciRecinto('g2');
    await scorri(t, 1500);
    const normale = larghezza('g2');
    void camera.ingrandisciRecinto(null);
    await scorri(t, 1500);
    void camera.ingrandisciRecinto('g2', 1.35);
    await scorri(t, 1500);
    expect(larghezza('g2') / normale).toBeCloseTo(1.35, 3);
  });

  it('attenua gli altri avversari (non il bersaglio né chi sta in basso); con null, un altro bersaglio o ferma si annulla', async () => {
    const { t, camera, palco } = scena();
    const opacita = (chi: string): string[] =>
      [...t.ctx.el.mondo.querySelectorAll<HTMLElement>(`[data-chi="${chi}"]`)].map((e) => e.style.opacity);
    void camera.ingrandisciRecinto('g2', 1.35, 0.3);
    expect(opacita('g3').length).toBeGreaterThan(0);
    expect(new Set(opacita('g3'))).toEqual(new Set(['0.3']));
    expect(new Set(opacita('g2'))).toEqual(new Set(['']));
    expect(new Set(opacita('g1'))).toEqual(new Set(['']));
    // Anche gli agnellini di quel recinto, ma il recinto non conta come nascosto
    expect(palco.area('g3')!.attenuata).toBe(0.3);
    expect(camera.nascoste()).toBe(0);
    await scorri(t, 1500);
    // Gli elementi creati dopo (allineamento calmo) si attenuano con riapplica
    const nuovo = document.createElement('div');
    nuovo.dataset.chi = 'g3';
    t.ctx.el.mondo.appendChild(nuovo);
    camera.riapplica();
    expect(nuovo.style.opacity).toBe('0.3');
    // Un altro bersaglio: si attenua l'altro
    void camera.ingrandisciRecinto('g3', 1.35, 0.3);
    expect(new Set(opacita('g2'))).toEqual(new Set(['0.3']));
    expect(new Set(opacita('g3'))).toEqual(new Set(['']));
    expect(palco.area('g3')!.attenuata).toBeUndefined();
    await scorri(t, 1500);
    void camera.ingrandisciRecinto(null);
    expect(new Set(opacita('g2'))).toEqual(new Set(['']));
    expect(palco.area('g2')!.attenuata).toBeUndefined();
    await scorri(t, 1500);
    void camera.ingrandisciRecinto('g2', 1.35, 0.3);
    camera.ferma();
    expect(new Set(opacita('g3'))).toEqual(new Set(['']));
    expect(palco.area('g3')!.attenuata).toBeUndefined();
  });

  it('chi tira (non in basso, "Passa il telefono" a 4) non si attenua, nemmeno con riapplica; gli altri sì', () => {
    const t = (teatro = creaTeatro(radice, { ciclo: 'manuale', ambiente: false, giochi: false, caso: casoConSeme(5) }));
    t.allinea(fotoIniziale(4), 'calmo');
    const camera = presa.camera as Camera, palco = presa.palco as Palco;
    const opacita = (chi: string): Set<string> =>
      new Set([...t.ctx.el.mondo.querySelectorAll<HTMLElement>(`[data-chi="${chi}"]`)].map((e) => e.style.opacity));
    void camera.ingrandisciRecinto('g2', 1.35, 0.3, 'g3');
    expect(opacita('g3')).toEqual(new Set(['']));
    expect(palco.area('g3')!.attenuata).toBeUndefined();
    expect(opacita('g4')).toEqual(new Set(['0.3']));
    expect(palco.area('g4')!.attenuata).toBe(0.3);
    camera.riapplica();
    expect(opacita('g3')).toEqual(new Set(['']));
    expect(opacita('g4')).toEqual(new Set(['0.3']));
  });

  it('dopo inquadra e sgancia, ingrandisciRecinto torna a ingrandire lo stesso recinto', async () => {
    const { t, camera, larghezza } = scena();
    const l0 = larghezza('g2');
    void camera.ingrandisciRecinto('g2');
    await scorri(t, 1500);
    void camera.inquadra('g2');
    await scorri(t, 1500);
    void camera.sgancia();
    await scorri(t, 1500);
    expect(Math.abs(larghezza('g2') - l0)).toBeLessThanOrEqual(0.5);
    void camera.ingrandisciRecinto('g2');
    await scorri(t, 1500);
    expect(larghezza('g2')).toBeGreaterThan(l0);
  });
});
