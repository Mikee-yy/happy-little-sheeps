import { describe, expect, it, vi } from 'vitest';
import { Orologio } from './orologio';

/** Fa scorrere il tempo reale a passi da 16 ms. */
function scorri(o: Orologio, msReali: number, passo = 16): void {
  let t = 0;
  while (t < msReali) {
    const p = Math.min(passo, msReali - t);
    o.avanza(p);
    t += p;
  }
}

describe('Orologio della scena', () => {
  it('dopo(500) a velocità 2 scatta dopo 250 ms reali', () => {
    const o = new Orologio();
    o.velocita = 2;
    let scattato: number | null = null;
    let reali = 0;
    o.dopo(() => {
      scattato = reali;
    }, 500);
    while (scattato === null && reali < 1000) {
      o.avanza(16);
      reali += 16;
    }
    expect(scattato).not.toBeNull();
    expect(Math.abs((scattato as unknown as number) - 250)).toBeLessThanOrEqual(30);
  });

  it('ogni(100) in 1000 ms reali dà 10 colpi (±1)', () => {
    const o = new Orologio();
    let colpi = 0;
    o.ogni(() => colpi++, 100);
    scorri(o, 1000);
    expect(Math.abs(colpi - 10)).toBeLessThanOrEqual(1);
  });

  it('annulla ferma ogni()', () => {
    const o = new Orologio();
    let colpi = 0;
    const id = o.ogni(() => colpi++, 100);
    scorri(o, 500);
    o.annulla(id);
    const fermi = colpi;
    scorri(o, 500);
    expect(colpi).toBe(fermi);
    expect(o.inSospeso()).toBe(0);
  });

  it('ogni ha un passo minimo di 4 ms', () => {
    const o = new Orologio();
    let colpi = 0;
    o.ogni(() => colpi++, 0);
    o.avanza(20);
    expect(colpi).toBe(5);
  });

  it("un buco di 10 s fa avanzare l'orologio di al più 250 ms a velocità 1", () => {
    const o = new Orologio();
    const m0 = o.ms;
    o.avanza(10000);
    expect(o.ms - m0).toBe(250);
  });

  it('il limite di 250 ms reali si moltiplica per la velocità', () => {
    const o = new Orologio();
    o.velocita = 2;
    o.avanza(10000);
    expect(o.ms).toBe(500);
  });

  it('un timer che lancia un errore non ferma gli altri', () => {
    const o = new Orologio();
    const errore = vi.spyOn(console, 'error').mockImplementation(() => {});
    let altro = false;
    o.dopo(() => {
      throw new Error('prova');
    }, 10);
    o.dopo(() => {
      altro = true;
    }, 20);
    o.avanza(100);
    expect(altro).toBe(true);
    expect(errore).toHaveBeenCalled();
    errore.mockRestore();
  });

  it('svuota() porta inSospeso() a 0', () => {
    const o = new Orologio();
    o.dopo(() => {}, 100);
    o.ogni(() => {}, 100);
    expect(o.inSospeso()).toBe(2);
    o.svuota();
    expect(o.inSospeso()).toBe(0);
  });

  it('attesa(300) si risolve solo dopo 300 ms di scena', async () => {
    const o = new Orologio();
    let fatto = false;
    void o.attesa(300).then(() => {
      fatto = true;
    });
    o.avanza(200);
    await Promise.resolve();
    expect(fatto).toBe(false);
    o.avanza(100);
    await Promise.resolve();
    expect(fatto).toBe(true);
  });

  it('i timer decorativi scattano ma non contano negli eventi in sospeso', () => {
    const o = new Orologio();
    let colpi = 0;
    o.dopo(() => colpi++, 100, { decorativo: true });
    o.ogni(() => colpi++, 100, { decorativo: true });
    expect(o.inSospeso()).toBe(2);
    expect(o.eventiInSospeso()).toBe(0);
    o.dopo(() => colpi++, 100);
    expect(o.eventiInSospeso()).toBe(1);
    o.avanza(100);
    expect(colpi).toBe(3);
    expect(o.eventiInSospeso()).toBe(0);
    expect(o.inSospeso()).toBe(1);
  });

  it('i timer scattano in ordine di tempo', () => {
    const o = new Orologio();
    const ordine: number[] = [];
    o.dopo(() => ordine.push(2), 100);
    o.dopo(() => ordine.push(1), 50);
    o.avanza(200);
    expect(ordine).toEqual([1, 2]);
  });
});
