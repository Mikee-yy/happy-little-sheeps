// Prove dei testi con i numeri: singolare e plurale.
import { describe, expect, it } from 'vitest';
import { T } from './testi';

describe('testi: singolare e plurale', () => {
  it('segnalino della targa: "Manca 1" / "Mancano 2"', () => {
    expect(T.scena.segnalini.quasiPieno(1)).toBe('Manca 1');
    expect(T.scena.segnalini.quasiPieno(2)).toBe('Mancano 2');
    expect(T.scena.segnalini.quasiPieno(0)).toBe('Mancano 0');
  });

  it('riassunto per i lettori di schermo: "1 agnellino", "1 Guaio"', () => {
    expect(T.scena.riassunto.posto('Anna', 1, 15, 1)).toBe('Anna: 1 agnellino su 15, 1 Guaio');
    expect(T.scena.riassunto.posto('Anna', 4, 15, 0)).toBe('Anna: 4 agnellini su 15, 0 Guai');
    expect(T.scena.riassunto.gregge(1)).toBe('Gregge: 1 agnellino');
    expect(T.scena.riassunto.gregge(12)).toBe('Gregge: 12 agnellini');
  });
});
