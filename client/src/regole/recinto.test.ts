// @vitest-environment jsdom
// Il recinto delle Regole visto dall'alto: le zone disegnate sono quelle della fionda (`zonaDi` di scena/fionda/tiro.ts),
// e i numeri scritti sopra sono quelli dei cerchi della mira.
import { cleanup, render } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { SETUP } from '../../../engine/src';
import { FIONDA, valoriCerchi, zonaDi, type Punto } from '../scena/fionda/tiro';
import { geometriaRecinto, RecintoZone } from './recinto';

afterEach(cleanup);

const g = geometriaRecinto();
const { recinto: r, centro, fascia } = g;
const cx = (r.x0 + r.x1) / 2;
const cy = (r.y0 + r.y1) / 2;

describe('geometriaRecinto', () => {
  it('centro e fascia sono quelli di fionda.json, in proporzione al recinto', () => {
    expect(centro.rx).toBeCloseTo(FIONDA.cerchi.centro * ((r.x1 - r.x0) / 2));
    expect(centro.ry).toBeCloseTo(FIONDA.cerchi.centro * ((r.y1 - r.y0) / 2));
    expect(fascia.x).toBeCloseTo(FIONDA.fasciaBordo.x * (r.x1 - r.x0));
    expect(fascia.y).toBeCloseTo(FIONDA.fasciaBordo.y * (r.y1 - r.y0));
  });

  it('un punto in ogni zona disegnata: centro 3, interno vicino alla staccionata 2, staccionata 1, appena fuori 1, oltre 0', () => {
    const punti: [string, Punto, number][] = [
      ['centro', { x: cx, y: cy }, 3],
      ['interno vicino alla staccionata', { x: r.x0 + 2, y: cy }, 2],
      ['staccionata', { x: r.x0, y: cy }, 1],
      ['dentro la fascia appena fuori', { x: r.x0 - fascia.x / 2, y: cy }, 1],
      ['oltre la fascia', { x: r.x0 - fascia.x * 1.5, y: cy }, 0],
    ];
    expect(punti.map(([, p]) => zonaDi(p, r))).toEqual([3, 2, 1, 1, 0]);
    for (const [nome, p, z] of punti) expect(zonaDi(p, r), nome).toBe(z);
  });

  it("i bordi disegnati sono i confini delle zone: l'ellisse del centro, la fascia e i suoi angoli tondi", () => {
    // Ellisse del centro (in orizzontale, in verticale e in diagonale)
    expect(zonaDi({ x: cx + centro.rx * 0.98, y: cy }, r)).toBe(3);
    expect(zonaDi({ x: cx + centro.rx * 1.02, y: cy }, r)).toBe(2);
    expect(zonaDi({ x: cx, y: cy - centro.ry * 0.98 }, r)).toBe(3);
    expect(zonaDi({ x: cx, y: cy - centro.ry * 1.02 }, r)).toBe(2);
    const d = Math.SQRT1_2;
    expect(zonaDi({ x: cx + centro.rx * d * 0.98, y: cy + centro.ry * d * 0.98 }, r)).toBe(3);
    expect(zonaDi({ x: cx + centro.rx * d * 1.02, y: cy + centro.ry * d * 1.02 }, r)).toBe(2);
    // Fascia: ai lati, sopra e sotto
    expect(zonaDi({ x: r.x1 + fascia.x * 0.98, y: cy }, r)).toBe(1);
    expect(zonaDi({ x: r.x1 + fascia.x * 1.02, y: cy }, r)).toBe(0);
    expect(zonaDi({ x: cx, y: r.y0 - fascia.y * 0.98 }, r)).toBe(1);
    expect(zonaDi({ x: cx, y: r.y0 - fascia.y * 1.02 }, r)).toBe(0);
    // Angolo tondo (ellisse di raggi fascia.x × fascia.y)
    expect(zonaDi({ x: r.x1 + fascia.x * d * 0.98, y: r.y1 + fascia.y * d * 0.98 }, r)).toBe(1);
    expect(zonaDi({ x: r.x1 + fascia.x * d * 1.02, y: r.y1 + fascia.y * d * 1.02 }, r)).toBe(0);
  });
});

describe('RecintoZone', () => {
  const disegno = () => render(createElement(RecintoZone)).container.querySelector('svg')!;
  const num = (el: Element, a: string) => Number(el.getAttribute(a));

  it('è nascosto ai lettori di schermo, con un viewBox fisso che contiene la fascia', () => {
    const svg = disegno();
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    const [vx, vy, vw, vh] = svg.getAttribute('viewBox')!.split(' ').map(Number) as [number, number, number, number];
    expect(r.x0 - fascia.x).toBeGreaterThanOrEqual(vx);
    expect(r.y0 - fascia.y).toBeGreaterThanOrEqual(vy);
    expect(r.x1 + fascia.x).toBeLessThanOrEqual(vx + vw);
    expect(r.y1 + fascia.y).toBeLessThanOrEqual(vy + vh);
  });

  it("disegna l'ellisse del centro, il recinto e la fascia tratteggiata con gli angoli tondi della geometria", () => {
    const svg = disegno();
    const ellisse = svg.querySelector('ellipse.recinto-centro')!;
    expect([num(ellisse, 'cx'), num(ellisse, 'cy'), num(ellisse, 'rx'), num(ellisse, 'ry')]).toEqual([cx, cy, centro.rx, centro.ry]);
    expect(ellisse.getAttribute('fill')).toBe('var(--colore-limone)');
    const interno = svg.querySelector('rect.recinto-interno')!;
    expect([num(interno, 'x'), num(interno, 'y'), num(interno, 'width'), num(interno, 'height')]).toEqual([r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0]);
    expect(interno.getAttribute('fill')).toBe('var(--colore-menta)');
    const staccionata = svg.querySelector('.recinto-staccionata')!;
    expect(staccionata.getAttribute('stroke')).toBe('var(--colore-fango)');
    const f = svg.querySelector('rect.recinto-fascia')!;
    expect([num(f, 'x'), num(f, 'y'), num(f, 'width'), num(f, 'height')]).toEqual([
      r.x0 - fascia.x,
      r.y0 - fascia.y,
      r.x1 - r.x0 + 2 * fascia.x,
      r.y1 - r.y0 + 2 * fascia.y,
    ]);
    expect([num(f, 'rx'), num(f, 'ry')]).toEqual([fascia.x, fascia.y]);
    expect(f.getAttribute('stroke-dasharray')).toBeTruthy();
    expect(f.getAttribute('stroke')).toBe('var(--colore-inchiostro)');
  });

  it('i numeri scritti sono valoriCerchi(esitoMassimo) e "0", ognuno nella sua zona', () => {
    const scritte = [...disegno().querySelectorAll('text')];
    const [c3, c2, c1] = valoriCerchi(SETUP.testata.esitoMassimo);
    expect(valoriCerchi(3)).toEqual([3, 2, 1]);
    expect(scritte.map((t) => t.textContent)).toEqual([String(c3), String(c2), String(c1), '0']);
    const zone = scritte.map((t) => zonaDi({ x: num(t, 'x'), y: num(t, 'y') }, r));
    expect(zone).toEqual([3, 2, 1, 0]);
  });

  it('colori solo dai token: Notte, Gesso e al massimo 3 pastelli (Menta, Limone, Fango)', () => {
    const svg = disegno();
    const colori = new Set(
      [...svg.querySelectorAll('[fill],[stroke]')].flatMap((e) => [e.getAttribute('fill'), e.getAttribute('stroke')]).filter((c): c is string => !!c && c !== 'none'),
    );
    for (const c of colori) expect(c).toMatch(/^var\(--colore-[a-z]+\)$/);
    const pastelli = [...colori].filter((c) => c !== 'var(--colore-inchiostro)' && c !== 'var(--colore-carta)');
    expect(pastelli.sort()).toEqual(['var(--colore-fango)', 'var(--colore-limone)', 'var(--colore-menta)']);
  });
});
