// Il punto libero degli agnellini: fuori dagli ostacoli e, mentre c'è, fuori dalla zona coperta (il Montone sul prato).
import { describe, expect, it } from 'vitest';
import { casoConSeme } from '../aiuti-prova';
import { creaArea, puntoLibero, vicinoLibero } from './aree';

describe('aree: il punto libero evita la zona coperta', () => {
  const sotto = (x: number, y: number): boolean => Math.hypot(x - 150, y - 230) < 30;
  it('puntoLibero: mai sotto la zona coperta dell\'area', () => {
    const a = creaArea('gregge', [100, 210, 220, 260], Infinity);
    a.coperta = sotto;
    const caso = casoConSeme(3);
    for (let i = 0; i < 200; i++) {
      const p = puntoLibero(a, null, caso);
      expect(sotto(p.x, p.y), `${p.x},${p.y}`).toBe(false);
    }
  });
  it('vicinoLibero: nemmeno nel pezzo d\'area attorno all\'agnellino', () => {
    const a = creaArea('gregge', [100, 210, 220, 260], Infinity);
    a.coperta = sotto;
    const caso = casoConSeme(4);
    for (let i = 0; i < 200; i++) {
      const p = vicinoLibero({ x: 150, y: 232, a }, caso);
      expect(sotto(p.x, p.y), `${p.x},${p.y}`).toBe(false);
    }
  });
});
