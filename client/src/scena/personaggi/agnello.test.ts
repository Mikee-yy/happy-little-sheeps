// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { contestoFinto } from '../aiuti-prova';
import type { Contesto } from '../contesto';
import { disposizione } from '../disposizioni';
import { Agnello, ambienteMuto, type CorpoAgnello } from './agnello';
import { creaAree, type Area } from './aree';
import { Branco } from './branco';
import { GIOCHI, muovi, prendi, rilascia } from './giochi';

const DT = 0.033;

/** Corpo che non disegna: conta solo le chiamate. */
function corpoFinto(): CorpoAgnello & { disegni: number; tolto: boolean } {
  const c = { disegni: 0, tolto: false, disegna: () => void c.disegni++, togli: () => void (c.tolto = true) };
  return c;
}

function mondo(n: 2 | 3 | 4 = 3) {
  const ctx = contestoFinto();
  const disp = disposizione(n);
  const ids = disp.posti.map((_, i) => `g${i + 1}`);
  const aree = creaAree(disp, ids, 15);
  const amb = ambienteMuto(ctx, () => disp.prospettiva);
  const per = (nome: string) => aree.find((a) => a.nome === nome)!;
  const nuovo = (a: Area) => new Agnello(ctx, a, corpoFinto(), { amb });
  return { ctx, disp, aree, amb, per, nuovo };
}

/** Un passo della scena come il ciclo: tempo della scena, orologio, agnellini. */
function passo(ctx: Contesto, gs: Iterable<Agnello>, dt = DT): void {
  ctx.T += dt;
  ctx.orologio.avanza(dt * 1000);
  for (const g of gs) g.passo(dt, ctx.T * 1000);
}

const dentroRett = (g: Agnello, a: { x0: number; y0: number; x1: number; y1: number }) =>
  g.x >= a.x0 - 1e-6 && g.x <= a.x1 + 1e-6 && g.y >= a.y0 - 1e-6 && g.y <= a.y1 + 1e-6;

describe('Agnello', () => {
  it('arriva a destinazione', () => {
    const { ctx, per, nuovo } = mondo();
    const a = per('gregge'), b = per('g1');
    const g = nuovo(a);
    expect(a.mostrati).toBe(1);
    g.vaiIn(b);
    expect(a.agnelli).not.toContain(g);
    expect(b.agnelli).toContain(g);
    expect(a.mostrati).toBe(0);
    expect(b.mostrati).toBe(0);
    for (let i = 0; i < 120 && !g.giunto; i++) passo(ctx, [g]);
    expect(g.giunto).toBe(true);
    expect(['fermo', 'atterra']).toContain(g.stato);
    expect(dentroRett(g, b)).toBe(true);
    expect(b.mostrati).toBe(1);
  });

  it('parte dopo il ritardo e intanto conta come in viaggio', () => {
    const { ctx, per, nuovo } = mondo();
    new Branco(ctx); // il branco dice alla regia chi è davvero in viaggio
    const a = per('gregge'), b = per('g1');
    const g = nuovo(a);
    const x0 = g.x, y0 = g.y;
    g.vaiIn(b, 'corre', 0.46);
    expect(g.stato).toBe('parte');
    expect(ctx.regia.eventoInCorso()).toBe(true);
    for (let i = 0; i < 10; i++) passo(ctx, [g]);
    expect([g.x, g.y]).toEqual([x0, y0]);
    expect(g.stato).toBe('parte');
    for (let i = 0; i < 5; i++) passo(ctx, [g]);
    expect(g.stato).toBe('corre');
    for (let i = 0; i < 200 && !g.giunto; i++) passo(ctx, [g]);
    expect(g.giunto).toBe(true);
    expect(ctx.regia.eventoInCorso()).toBe(false);
  });

  it('aggira il cartello', () => {
    const { ctx, per, nuovo } = mondo(3);
    const a = per('gregge');
    const [x0, y0, x1, y1] = a.evita![0]!;
    const gs = Array.from({ length: 10 }, () => nuovo(a));
    gs.forEach((g, i) => {
      g.x = g.tx = x0 + ((x1 - x0) * (i + 0.5)) / gs.length;
      g.y = g.ty = y1 + 3;
    });
    for (let i = 0; i < 600; i++) {
      passo(ctx, gs);
      for (const g of gs) expect(g.x > x0 && g.x < x1 && g.y > y0 && g.y < y1).toBe(false);
    }
  });

  it('resta nel recinto', () => {
    const { ctx, per, nuovo } = mondo(3);
    for (const nome of ['g1', 'g2', 'gregge']) {
      const a = per(nome);
      const gs = Array.from({ length: 8 }, () => nuovo(a));
      for (let i = 0; i < 2000; i++) passo(ctx, gs);
      for (const g of gs) expect(dentroRett(g, a)).toBe(true);
    }
  });

  it('rete di sicurezza: uno spostamento guidato finisce entro 8 s', async () => {
    const { ctx, per, nuovo } = mondo();
    const g = nuovo(per('g1'));
    prendi([g]);
    const inizio = ctx.T;
    let fine = -1;
    void muovi(g, 5000, -5000, 5).then(() => (fine = ctx.T));
    for (let i = 0; i < 400 && fine < 0; i++) {
      passo(ctx, [g]);
      await Promise.resolve();
    }
    expect(fine).toBeGreaterThan(0);
    expect(fine - inizio).toBeLessThanOrEqual(8.1);
  });

  it('intrappolato: muovi senza trappola si risolve subito e non sposta', async () => {
    const { ctx, per, nuovo } = mondo();
    const g = nuovo(per('g1'));
    g.intrappolato = true;
    prendi([g]);
    const x = g.x, y = g.y;
    await muovi(g, x + 40, y + 5);
    for (let i = 0; i < 30; i++) passo(ctx, [g]);
    expect([g.x, g.y]).toEqual([x, y]);
  });

  it('rimandato a metà strada: nessun conto toccato due volte', () => {
    const { ctx, per, nuovo } = mondo();
    const a = per('gregge'), b = per('g2'), c = per('g1');
    const gs = [nuovo(a), nuovo(a), nuovo(a), nuovo(b), nuovo(c)];
    const g = gs[0]!;
    expect([a.mostrati, b.mostrati, c.mostrati]).toEqual([3, 1, 1]);
    g.vaiIn(b);
    for (let i = 0; i < 5; i++) passo(ctx, gs);
    g.vaiIn(c);
    for (let i = 0; i < 300 && !g.giunto; i++) passo(ctx, gs);
    expect(g.giunto).toBe(true);
    expect([a.mostrati, b.mostrati, c.mostrati]).toEqual([2, 1, 2]);
    expect([a.agnelli.length, b.agnelli.length, c.agnelli.length]).toEqual([2, 1, 2]);
  });

  it('il corpo DOM si disegna e si toglie; toccato salta e bela', () => {
    const { ctx, per, amb } = mondo();
    const suona = vi.fn();
    ctx.suona = suona;
    const g = new Agnello(ctx, per('g1'), undefined, { amb });
    passo(ctx, [g]);
    const el = ctx.el.mondo.querySelector<HTMLElement>('.agn')!;
    expect(el).not.toBeNull();
    expect(el.style.transform).toMatch(/^translate\(/);
    el.querySelector('.corpo')!.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(g.stato).toBe('salta');
    expect(suona).toHaveBeenCalledWith('beee', 1.7);
    g.togli();
    expect(ctx.el.mondo.querySelector('.agn')).toBeNull();
  });
});

describe('giochi', () => {
  it('60 s di giochi senza errori, nessuno in regia oltre 8 s', async () => {
    const ctx = contestoFinto();
    const disp = disposizione(3);
    const branco = new Branco(ctx, { corpo: () => corpoFinto() });
    branco.prospettiva = disp.prospettiva;
    branco.costruisci(creaAree(disp, ['g1', 'g2', 'g3'], 15), new Map([['g1', 9], ['g2', 7], ['g3', 6], ['gregge', 23]]));
    const errori = vi.spyOn(console, 'error');
    const inRegiaDa = new Map<Agnello, number>();
    let giochi = 0;
    const passi = async (n: number) => {
      for (let i = 0; i < n; i++) {
        ctx.T += DT;
        ctx.orologio.avanza(DT * 1000);
        branco.passo(DT, ctx.T * 1000);
        await Promise.resolve();
        for (const g of branco.agnelli) {
          if (!g.regia) inRegiaDa.delete(g);
          else if (!inRegiaDa.has(g)) {
            inRegiaDa.set(g, ctx.T);
            giochi++;
          }
        }
      }
    };
    await passi(Math.ceil(60 / DT));
    expect(errori).not.toHaveBeenCalled();
    errori.mockRestore();
    expect(giochi).toBeGreaterThan(4);
    for (const [, da] of inRegiaDa) expect(ctx.T - da).toBeLessThanOrEqual(8);
    // Niente resta appeso: senza giochi nuovi, al più una rincorsa intera (2 × 8 s di rete) e tutti sono liberi
    branco.giochi.attivo = false;
    await passi(Math.ceil(17 / DT));
    expect(inRegiaDa.size).toBe(0);
  });
});

describe('regia a metà strada', () => {
  async function passiAttesi(ctx: Contesto, gs: Iterable<Agnello>, n: number): Promise<void> {
    for (let i = 0; i < n; i++) {
      passo(ctx, gs);
      await Promise.resolve();
      await Promise.resolve();
    }
  }

  it.each(['rilascia', 'fulmina'] as const)('preso a metà strada e poi lasciato (%s): arriva dentro e conta una volta', async (come) => {
    const { ctx, per, nuovo } = mondo();
    const da = per('gregge'), a = per('g1');
    const gs = [nuovo(da), nuovo(da), nuovo(a), nuovo(a), nuovo(a)];
    const g = gs[0]!;
    g.vaiIn(a);
    await passiAttesi(ctx, gs, 3);
    expect(g.giunto).toBe(false);
    if (come === 'rilascia') {
      prendi([g]);
      await passiAttesi(ctx, gs, 2);
      rilascia([g]);
    } else g.fulmina(0.4);
    let mostratiMax = a.mostrati;
    for (let i = 0; i < 300 && !g.giunto; i++) {
      await passiAttesi(ctx, gs, 1);
      mostratiMax = Math.max(mostratiMax, a.mostrati);
    }
    expect(g.giunto).toBe(true);
    expect(g.regia).toBe(false);
    expect(dentroRett(g, a)).toBe(true);
    expect(g.y).toBeGreaterThan(a.y0 - 1e-6);
    await passiAttesi(ctx, gs, 30);
    expect([da.mostrati, a.mostrati]).toEqual([1, 4]);
    expect(mostratiMax).toBe(4);
  });

  it('vaiIn libera un agnellino intrappolato', () => {
    const { per, nuovo } = mondo();
    const g = nuovo(per('gregge'));
    g.intrappolato = true;
    prendi([g]);
    g.vaiIn(per('g1'));
    expect(g.intrappolato).toBe(false);
    expect(g.stato).toBe('corre');
  });
});

describe('giochi e regia', () => {
  function brancoFermo() {
    const ctx = contestoFinto();
    const disp = disposizione(3);
    const branco = new Branco(ctx, { corpo: () => corpoFinto() });
    branco.prospettiva = disp.prospettiva;
    branco.costruisci(creaAree(disp, ['g1', 'g2', 'g3'], 15), new Map([['g1', 6], ['g2', 3], ['g3', 3], ['gregge', 33]]));
    branco.giochi.attivo = false;
    return { ctx, branco, g1: [...branco.aree.get('g1')!.agnelli] };
  }
  async function scorri(ctx: Contesto, branco: Branco, n: number, controlla: () => void): Promise<void> {
    for (let i = 0; i < n; i++) {
      ctx.T += DT;
      ctx.orologio.avanza(DT * 1000);
      branco.passo(DT, ctx.T * 1000);
      await Promise.resolve();
      controlla();
    }
  }

  it.each(['coro', 'cavallina', 'testate', 'coccola'] as const)('durante %s, con il branco fermo, nessun evento in corso', async (tipo) => {
    const { ctx, branco, g1 } = brancoFermo();
    const gruppo = tipo === 'coro' ? g1.slice(0, 4) : g1.slice(0, 2);
    prendi(gruppo);
    let finito = false;
    void (tipo === 'coro' ? GIOCHI.coro(gruppo) : GIOCHI[tipo](gruppo[0]!, gruppo[1]!)).finally(() => {
      rilascia(gruppo);
      finito = true;
    });
    let timerVisti = 0;
    await scorri(ctx, branco, Math.ceil(8 / DT), () => {
      if (ctx.orologio.inSospeso() > 0) timerVisti++;
      expect(ctx.regia.eventoInCorso()).toBe(false);
    });
    expect(finito).toBe(true);
    expect(timerVisti).toBeGreaterThan(0);
  });

  it('rincorsa: se la preda va altrove chi la insegue smette subito', async () => {
    const { ctx, branco, g1 } = brancoFermo();
    const [a, b] = g1 as [Agnello, Agnello];
    prendi([a, b]);
    let finito = false;
    void GIOCHI.rincorsa(a, b).finally(() => {
      rilascia([a, b]);
      finito = true;
    });
    await scorri(ctx, branco, 3, () => undefined);
    b.vaiIn(branco.aree.get('gregge')!);
    await scorri(ctx, branco, 3, () => undefined);
    expect(finito).toBe(true);
    expect(a.regia).toBe(false);
  });
});
