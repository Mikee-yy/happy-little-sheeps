// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import type { Luogo, Vista } from '../../../../engine/src';
import { contestoFinto, giocaPartiteSimulate } from '../aiuti-prova';
import { disposizione } from '../disposizioni';
import type { CorpoAgnello } from './agnello';
import { creaAree } from './aree';
import { Branco } from './branco';

const DT = 0.033;
const corpoFinto = (): CorpoAgnello => ({ disegna: () => undefined, togli: () => undefined });

function nuovo(n: 2 | 3 | 4, conti: Record<string, number>, o: { posti?: number; corpoDom?: boolean } = {}) {
  const ctx = contestoFinto();
  const disp = disposizione(n);
  const ids = disp.posti.map((_, i) => `g${i + 1}`);
  const branco = new Branco(ctx, o.corpoDom ? {} : { corpo: corpoFinto });
  branco.prospettiva = disp.prospettiva;
  branco.costruisci(creaAree(disp, ids, o.posti ?? 15), new Map(Object.entries(conti)));
  return { ctx, branco };
}

async function passi(ctx: ReturnType<typeof contestoFinto>, branco: Branco, n: number): Promise<void> {
  for (let i = 0; i < n; i++) {
    ctx.T += DT;
    ctx.orologio.avanza(DT * 1000);
    branco.passo(DT, ctx.T * 1000);
    await Promise.resolve();
  }
}

/** Avanza finché nessuno è più in viaggio (al più `massimo` passi); restituisce i passi fatti. */
async function finoAllArrivo(ctx: ReturnType<typeof contestoFinto>, branco: Branco, massimo = 3000): Promise<number> {
  let i = 0;
  while (branco.inViaggio() > 0 && i < massimo) {
    await passi(ctx, branco, 1);
    i++;
  }
  expect(branco.inViaggio()).toBe(0);
  return i;
}

const assegnati = (b: Branco) => Object.fromEntries([...b.conti()].map(([k, v]) => [k, v.assegnati]));
const mostrati = (b: Branco) => Object.fromEntries([...b.conti()].map(([k, v]) => [k, v.mostrati]));
const somma = (b: Branco) => [...b.conti().values()].reduce((s, c) => s + c.assegnati, 0);

function tuttiAlPosto(b: Branco): void {
  for (const a of b.aree.values()) {
    for (const g of a.agnelli) {
      expect(g.a).toBe(a);
      expect(g.x).toBeGreaterThanOrEqual(a.x0 - 1e-6);
      expect(g.x).toBeLessThanOrEqual(a.x1 + 1e-6);
      expect(g.y).toBeGreaterThanOrEqual(a.y0 - 1e-6);
      expect(g.y).toBeLessThanOrEqual(a.y1 + 1e-6);
    }
  }
}

describe('Branco', () => {
  it('costruisci: tutti già al loro posto, nessuno in viaggio', () => {
    const { branco } = nuovo(3, { g1: 3, g2: 4, g3: 5, gregge: 33 }, { corpoDom: true });
    expect(assegnati(branco)).toEqual({ g1: 3, g2: 4, g3: 5, gregge: 33 });
    expect(mostrati(branco)).toEqual({ g1: 3, g2: 4, g3: 5, gregge: 33 });
    expect(branco.agnelli.size).toBe(45);
    expect(branco.inViaggio()).toBe(0);
    tuttiAlPosto(branco);
  });

  it('allinea minimo: partono solo i 3 che servono, tutti dal gregge', () => {
    const { branco } = nuovo(2, { g1: 3, g2: 3, gregge: 39 });
    const daGregge = new Set(branco.aree.get('gregge')!.agnelli);
    const partiti = branco.allinea(new Map<Luogo, number>([['g1', 6], ['g2', 3], ['gregge', 36]]));
    expect(partiti).toBe(3);
    expect(assegnati(branco)).toEqual({ g1: 6, g2: 3, gregge: 36 });
    const nuovi = branco.aree.get('g1')!.agnelli.filter((g) => daGregge.has(g));
    expect(nuovi.length).toBe(3);
    expect(branco.inViaggio()).toBe(3);
  });

  it('conservazione: il totale resta 45 dopo ogni allinea', async () => {
    const { ctx, branco } = nuovo(2, { g1: 3, g2: 3, gregge: 39 }, { posti: 18 });
    const obiettivi = [
      { g1: 6, g2: 3, gregge: 36 },
      { g1: 0, g2: 18, gregge: 27 },
      { g1: 18, g2: 18, gregge: 9 },
      { g1: 1, g2: 0, gregge: 44 },
    ];
    for (const o of obiettivi) {
      branco.allinea(new Map(Object.entries(o)));
      expect(somma(branco)).toBe(45);
      await passi(ctx, branco, 7);
      expect(somma(branco)).toBe(45);
      expect(branco.agnelli.size).toBe(45);
    }
  });

  it('metà movimento: una seconda fotografia a metà strada finisce giusta', async () => {
    const { ctx, branco } = nuovo(3, { g1: 3, g2: 3, g3: 3, gregge: 36 });
    branco.allinea(new Map(Object.entries({ g1: 9, g2: 3, g3: 3, gregge: 30 })));
    await passi(ctx, branco, 3);
    const B = { g1: 4, g2: 8, g3: 0, gregge: 33 };
    branco.allinea(new Map(Object.entries(B)));
    await finoAllArrivo(ctx, branco);
    expect(assegnati(branco)).toEqual(B);
    expect(mostrati(branco)).toEqual(B);
    tuttiAlPosto(branco);
  });

  it('un obiettivo con un totale diverso si scrive in console e si ricostruisce', () => {
    const { branco } = nuovo(3, { g1: 3, g2: 3, g3: 3, gregge: 36 });
    const errori = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(branco.allinea(new Map(Object.entries({ g1: 4, g2: 3, g3: 3, gregge: 36 })))).toBe(0);
    expect(errori).toHaveBeenCalledTimes(1);
    errori.mockRestore();
    expect(branco.agnelli.size).toBe(46);
    expect(mostrati(branco)).toEqual({ g1: 4, g2: 3, g3: 3, gregge: 36 });
    expect(branco.inViaggio()).toBe(0);
  });

  it('sposta: limitato dai posti liberi e da chi c\'è, a scaglioni', async () => {
    const { ctx, branco } = nuovo(3, { g1: 13, g2: 2, g3: 3, gregge: 27 });
    expect(branco.sposta(5, 'gregge', 'g1')).toBe(2);
    expect(branco.sposta(5, 'g2', 'gregge', 'vola')).toBe(2);
    expect(assegnati(branco)).toEqual({ g1: 15, g2: 0, g3: 3, gregge: 27 });
    await finoAllArrivo(ctx, branco);
    expect(mostrati(branco)).toEqual({ g1: 15, g2: 0, g3: 3, gregge: 27 });
  });

  describe('conti estremi', () => {
    const casi: Array<[string, 2 | 3 | 4, number, Record<string, number>, Array<Record<string, number>>]> = [
      ['gregge a 0 e Ovili pieni', 3, 15, { g1: 3, g2: 3, g3: 3, gregge: 36 }, [{ g1: 15, g2: 15, g3: 15, gregge: 0 }]],
      ['eliminato con 0 agnellini', 3, 15, { g1: 3, g2: 3, g3: 3, gregge: 36 }, [{ g1: 0, g2: 10, g3: 5, gregge: 30 }]],
      ['4 giocatori, un Ovile pieno', 4, 12, { g1: 3, g2: 3, g3: 3, g4: 3, gregge: 32 }, [{ g1: 12, g2: 0, g3: 2, g4: 11, gregge: 19 }]],
      [
        '2 giocatori con 36',
        2,
        18,
        { g1: 3, g2: 3, gregge: 30 },
        [{ g1: 18, g2: 0, gregge: 18 }, { g1: 0, g2: 18, gregge: 18 }, { g1: 18, g2: 18, gregge: 0 }],
      ],
    ];
    it.each(casi)('%s', async (_nome, n, posti, inizio, obiettivi) => {
      const { ctx, branco } = nuovo(n, inizio, { posti });
      for (const o of obiettivi) {
        branco.allinea(new Map(Object.entries(o)));
        await passi(ctx, branco, 4);
      }
      await finoAllArrivo(ctx, branco);
      const fine = obiettivi[obiettivi.length - 1]!;
      expect(assegnati(branco)).toEqual(fine);
      expect(mostrati(branco)).toEqual(fine);
      tuttiAlPosto(branco);
    });
  });

  it('conto giusto: 24 partite simulate, i conti coincidono sempre con il motore', async () => {
    let partite = 0;
    for (const n of [2, 3, 4] as const) {
      for (const politica of ['semplice', 'casuale'] as const) {
        for (const seme of [1, 2, 3, 4]) {
          const ctx = contestoFinto();
          const disp = disposizione(n);
          const branco = new Branco(ctx, { corpo: corpoFinto });
          branco.prospettiva = disp.prospettiva;
          const obiettivo = (v: Vista) =>
            new Map<Luogo, number>([...v.giocatori.map((g) => [g.id, g.agnellini] as [Luogo, number]), ['gregge', v.gregge]]);
          const atteso = (v: Vista) => Object.fromEntries(obiettivo(v));
          let mosse = 0;
          await giocaPartiteSimulate({
            n,
            politica,
            seme,
            inizio(v) {
              branco.costruisci(creaAree(disp, v.giocatori.map((g) => g.id), v.config.postiOvile), obiettivo(v));
            },
            async dopoMossa(v, finita) {
              branco.allinea(obiettivo(v));
              expect(assegnati(branco)).toEqual(atteso(v));
              if (++mosse % 10 === 0 || finita) {
                await finoAllArrivo(ctx, branco);
                expect(mostrati(branco)).toEqual(atteso(v));
                tuttiAlPosto(branco);
              } else await passi(ctx, branco, 2);
            },
          });
          tuttiAlPosto(branco);
          partite++;
        }
      }
    }
    expect(partite).toBe(24);
  }, 120_000);
});
