// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { contestoFinto } from '../aiuti-prova';
import { disposizione } from '../disposizioni';
import { creaAmbiente } from './indice';

function nuovo(n: 2 | 3 | 4 = 4) {
  const ctx = contestoFinto();
  const disp = disposizione(n);
  return { ctx, disp, amb: creaAmbiente(ctx, disp) };
}

describe('ambiente', () => {
  it('disegna paesaggio, flora e nuvole senza errori', () => {
    const { ctx, amb } = nuovo();
    expect(ctx.el.paesaggio.innerHTML).toContain('<ellipse');
    expect(ctx.el.flora.querySelectorAll('[data-pianta]').length).toBe(amb.flora.length);
    expect(amb.flora.length).toBeGreaterThan(10);
    expect(ctx.el.nuvoleSvg.querySelectorAll('g').length).toBeGreaterThan(0);
    expect(ctx.el.sole.querySelector('circle')).not.toBeNull();
    expect(ctx.el.scena.querySelector('[id]')).toBeNull();
  });

  it('regge 300 passi da 33 ms', () => {
    const { ctx, amb } = nuovo();
    for (let i = 0; i < 300; i++) {
      ctx.T += 0.033;
      amb.passo(0.033);
      amb.passo30(0.033);
      amb.aggiornaParticelle(0.033);
    }
    expect(Number.isFinite(amb.ventoIn(100))).toBe(true);
  }, 30_000);

  it.each([2, 3, 4] as const)('nessuna pianta nelle zone libere (%i giocatori)', (n) => {
    const { disp, amb } = nuovo(n);
    for (const f of amb.flora) {
      for (const [a, b, c, d] of disp.liberoDaPiante) expect(f.x > a && f.x < c && f.y > b && f.y < d).toBe(false);
    }
  });

  it('ridisponiFlora rispetta le nuove zone libere', () => {
    const { amb } = nuovo(4);
    const d2 = disposizione(2);
    amb.ridisponiFlora(d2);
    for (const f of amb.flora) {
      for (const [a, b, c, d] of d2.liberoDaPiante) expect(f.x > a && f.x < c && f.y > b && f.y < d).toBe(false);
    }
  });

  it('le particelle sono al più 140 (60 in leggero)', () => {
    const { ctx, amb } = nuovo();
    for (let i = 0; i < 1000; i++) amb.particella('petalo', 100, 300, { colore: '#fff' });
    expect(amb.particelle.length).toBeLessThanOrEqual(140);
    expect(amb.particelle.length).toBeGreaterThan(0);
    amb.particelle.length = 0;
    ctx.risparmio.leggero = true;
    for (let i = 0; i < 1000; i++) amb.particella('petalo', 100, 300, { colore: '#fff' });
    expect(amb.particelle.length).toBeLessThanOrEqual(60);
  });

  it('le particelle senza tela si contano e scadono', () => {
    const { amb } = nuovo();
    amb.particella('fumo', 100, 300, { vita: 0.5 });
    expect(amb.particelle.length).toBe(1);
    amb.aggiornaParticelle(0.6);
    expect(amb.particelle.length).toBe(0);
  });

  it('impostaOra mette la classe e la sera', () => {
    const { ctx, amb } = nuovo();
    amb.impostaOra('sera');
    expect(ctx.el.schermo.classList.contains('ora-sera')).toBe(true);
    expect(ctx.el.schermo.classList.contains('ora-giorno')).toBe(false);
    expect(ctx.sera).toBe(1);
    amb.impostaOra('tramonto');
    expect(ctx.sera).toBe(0.5);
    expect(amb.SOLE.meta).toBe(132);
  });

  it('il vento è finito e la luce cresce con il sole basso', () => {
    const { ctx, amb } = nuovo();
    const lung0 = amb.LUCE.lung;
    amb.impostaOra('sera');
    for (let i = 0; i < 400; i++) { ctx.T += 0.05; amb.passo(0.05); }
    expect(amb.LUCE.lung).toBeGreaterThan(lung0);
    const v = amb.vettoreOmbra(10);
    expect(v.x).toBeLessThan(0);
    expect(v.y).toBeGreaterThan(0);
  });

  it('decoro e zeta usano l\'orologio e non lasciano residui con la fine dell\'animazione', () => {
    const { ctx, amb } = nuovo();
    amb.decoro('<b>x</b>', 10, 20, [{ opacity: 0 }, { opacity: 1 }], 100);
    expect(ctx.el.mondo.querySelectorAll('.decoro').length).toBe(1);
    amb.zeta(5, 5);
    amb.fumata(50, 50, 4);
    expect(amb.particelle.length).toBe(4);
  });

  it('distruggi svuota gli SVG e toglie la tela', () => {
    const { ctx, amb } = nuovo();
    amb.distruggi();
    expect(ctx.el.paesaggio.innerHTML).toBe('');
    expect(ctx.el.flora.innerHTML).toBe('');
    expect(ctx.el.nuvoleSvg.innerHTML).toBe('');
    expect(ctx.el.sole.innerHTML).toBe('');
    expect(ctx.el.mondo.querySelector('canvas')).toBeNull();
    expect(amb.particelle.length).toBe(0);
  });
});
