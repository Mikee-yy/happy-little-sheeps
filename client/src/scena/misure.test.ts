import { describe, expect, it } from 'vitest';
import { H, W, manoInScena, misuraDito, scenaInMano } from './misure';

describe('misure', () => {
  it('il riquadro logico è 390×844', () => {
    expect([W, H]).toEqual([390, 844]);
  });

  const casi: [number, number, number, number][] = [
    [360, 640, 0.7583, 0.9231],
    [390, 660, 0.782, 0.9775],
    [390, 844, 1, 1],
    [800, 360, 0.4265, 0.5332],
  ];
  for (const [w, h, s, d] of casi) {
    it(`misuraDito(${w}, ${h}) = ${s}, ${d}`, () => {
      const m = misuraDito(w, h);
      expect(Math.abs(m.S - s)).toBeLessThanOrEqual(0.002);
      expect(Math.abs(m.D - d)).toBeLessThanOrEqual(0.002);
    });
  }

  it('scenaInMano(manoInScena(p, KD), KD) = p', () => {
    const p = { x: 120, y: 700, k: 0.9, resto: 'a' };
    const q = scenaInMano(manoInScena(p, 1.2), 1.2);
    expect(q.x).toBeCloseTo(p.x, 9);
    expect(q.y).toBeCloseTo(p.y, 9);
    expect(q.resto).toBe('a');
  });

  it('manoInScena ingrandisce attorno al centro in basso', () => {
    expect(manoInScena({ x: 195, y: H, k: 1 }, 1.5)).toEqual({ x: 195, y: H, k: 1.5 });
    expect(manoInScena({ x: 295, y: H - 100, k: 1 }, 2)).toEqual({ x: 395, y: H - 200, k: 2 });
  });
});
