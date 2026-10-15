// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { contestoFinto } from './aiuti-prova';
import type { Contesto } from './contesto';
import { creaLettura } from './lettura';
import { creaMano, type Mano } from './mano';

let ctx: Contesto;
let mano: Mano;
let lettura: ReturnType<typeof creaLettura>;

function evento(tipo: string, el: Element, x: number, y: number, pointerType = 'touch') {
  const e = new MouseEvent(tipo, { bubbles: true, cancelable: true, clientX: x, clientY: y });
  Object.assign(e, { pointerId: 1, pointerType });
  el.dispatchEvent(e);
}

const carte = () => [...ctx.el.mano.querySelectorAll<HTMLElement>('.cm')];

beforeEach(() => {
  vi.useFakeTimers();
  ctx = contestoFinto();
  lettura = creaLettura(ctx);
  mano = creaMano(ctx, lettura);
});

afterEach(() => {
  mano.distruggi();
  lettura.chiudi();
  vi.useRealTimers();
});

describe('Mano', () => {
  it('con le carte crea un ventaglio scoperto: role="button" e aria-label uguale al nome', () => {
    mano.mostra(['sasso-comodo#1', 'beee-no#1'], 0);
    const c = carte();
    expect(c).toHaveLength(2);
    expect(c.map((e) => e.getAttribute('role'))).toEqual(['button', 'button']);
    expect(c.map((e) => e.getAttribute('aria-label'))).toEqual(['Sasso comodo', 'Beee-NO!']);
  });

  it('con null crea i dorsi, senza nomi di carte nel DOM', () => {
    mano.mostra(null, 4);
    const c = carte();
    expect(c).toHaveLength(4);
    expect(ctx.el.mano.querySelector('[role="button"]')).toBeNull();
    expect(ctx.el.mano.querySelector('[aria-label]')).toBeNull();
    expect(ctx.el.mano.innerHTML).not.toMatch(/Sasso|Beee-NO|Calzino/i);
    expect(ctx.el.mano.innerHTML).toContain('back-main');
  });

  it('ai dorsi non rispondono né tocco né lettura', () => {
    mano.mostra(null, 2);
    const d = carte()[0]!;
    evento('pointerdown', d, 100, 700);
    vi.advanceTimersByTime(500);
    expect(lettura.aperta()).toBe(false);
    evento('pointerup', d, 100, 700);
    expect(mano.attiva()).toBeNull();
  });

  it('un tocco attiva la carta, un secondo tocco la disattiva', () => {
    mano.mostra(['sasso-comodo#1', 'beee-no#1'], 0);
    const c = carte()[0]!;
    evento('pointerdown', c, 100, 700);
    evento('pointerup', c, 100, 700);
    expect(mano.attiva()).toBe('sasso-comodo#1');
    expect(c.classList.contains('attiva')).toBe(true);
    expect(carte()[1]!.classList.contains('spenta')).toBe(true);
    evento('pointerdown', c, 100, 500);
    evento('pointerup', c, 100, 500);
    expect(mano.attiva()).toBeNull();
    expect(c.classList.contains('attiva')).toBe(false);
  });

  it('una tenuta di 430 ms apre la lettura e il rilascio la chiude', () => {
    mano.mostra(['sasso-comodo#1', 'beee-no#1'], 0);
    const c = carte()[1]!;
    evento('pointerdown', c, 100, 700);
    vi.advanceTimersByTime(429);
    expect(lettura.aperta()).toBe(false);
    vi.advanceTimersByTime(2);
    expect(lettura.aperta()).toBe(true);
    expect(ctx.el.ui.textContent).toContain('Lascia per chiudere');
    evento('pointerup', c, 100, 700);
    expect(lettura.aperta()).toBe(false);
    expect(mano.attiva()).toBeNull();
  });

  it('un trascinamento di 60 px seguito dal rilascio lascia la mano con le stesse 2 carte', () => {
    mano.mostra(['sasso-comodo#1', 'beee-no#1'], 0);
    const prima = carte();
    const c = prima[0]!;
    evento('pointerdown', c, 100, 700);
    evento('pointermove', c, 100, 640);
    expect(c.classList.contains('trascinata')).toBe(true);
    evento('pointerup', c, 100, 640);
    const dopo = carte();
    expect(dopo).toHaveLength(2);
    expect(dopo.map((e) => e.getAttribute('aria-label'))).toEqual(['Sasso comodo', 'Beee-NO!']);
    expect(c.classList.contains('trascinata')).toBe(false);
    expect(mano.attiva()).toBeNull();
    vi.advanceTimersByTime(600);
    expect(lettura.aperta()).toBe(false);
  });

  it('con il mouse la carta si solleva al passaggio', () => {
    mano.mostra(['sasso-comodo#1'], 0);
    const c = carte()[0]!;
    const y0 = c.style.transform;
    evento('pointerenter', c, 100, 700, 'mouse');
    expect(c.dataset.su).toBe('1');
    expect(c.style.transform).not.toBe(y0);
    evento('pointerleave', c, 100, 700, 'mouse');
    expect(c.dataset.su).toBe('');
  });

  it('una nuova mano toglie la carta attiva che non c\'è più e distruggi svuota', () => {
    mano.mostra(['sasso-comodo#1', 'beee-no#1'], 0);
    const c = carte()[0]!;
    evento('pointerdown', c, 100, 700);
    evento('pointerup', c, 100, 700);
    mano.mostra(['beee-no#1'], 0);
    expect(carte()).toHaveLength(1);
    expect(mano.attiva()).toBeNull();
    mano.distruggi();
    expect(carte()).toHaveLength(0);
  });

  it('abbassa rimette nel ventaglio la carta sollevata', () => {
    mano.mostra(['sasso-comodo#1', 'beee-no#1'], 0);
    const c = carte()[0]!;
    evento('pointerdown', c, 100, 700);
    evento('pointerup', c, 100, 700);
    expect(mano.attiva()).toBe('sasso-comodo#1');
    mano.abbassa();
    expect(mano.attiva()).toBeNull();
    expect(c.classList.contains('attiva')).toBe(false);
    expect(carte()[1]!.classList.contains('spenta')).toBe(false);
  });

  it('una tenuta in corso non apre la lettura se la mano diventa coperta', () => {
    mano.mostra(['sasso-comodo#1', 'beee-no#1'], 0);
    evento('pointerdown', carte()[0]!, 100, 700);
    vi.advanceTimersByTime(200);
    mano.mostra(null, 4);
    vi.advanceTimersByTime(500);
    expect(lettura.aperta()).toBe(false);
    expect(ctx.el.ui.innerHTML).not.toMatch(/Sasso/i);
    expect(ctx.el.mano.innerHTML).not.toMatch(/Sasso/i);
  });

  it('una tenuta in corso non apre la lettura se mostra toglie proprio quella carta', () => {
    mano.mostra(['sasso-comodo#1', 'beee-no#1'], 0);
    evento('pointerdown', carte()[0]!, 100, 700);
    mano.mostra(['beee-no#1'], 0);
    vi.advanceTimersByTime(500);
    expect(lettura.aperta()).toBe(false);
  });

  it('la lettura aperta di una carta che sparisce dalla mano si chiude', () => {
    mano.mostra(['sasso-comodo#1', 'beee-no#1'], 0);
    evento('pointerdown', carte()[0]!, 100, 700);
    vi.advanceTimersByTime(500);
    expect(lettura.aperta()).toBe(true);
    mano.mostra(['beee-no#1'], 0);
    expect(lettura.aperta()).toBe(false);
  });

  it('il menu contestuale sulle carte è bloccato', () => {
    mano.mostra(['sasso-comodo#1'], 0);
    const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    carte()[0]!.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
  });
});

describe('Lettura', () => {
  it('apri/chiudi con il testo giusto per tenuta o tocco', () => {
    lettura.apri('beee-no#1', false);
    expect(lettura.aperta()).toBe(true);
    expect(ctx.el.ui.textContent).toContain('Tocca per chiudere');
    lettura.apri('beee-no#1', true);
    expect(ctx.el.ui.querySelectorAll('.lettura')).toHaveLength(1);
    expect(ctx.el.ui.textContent).toContain('Lascia per chiudere');
    lettura.chiudi();
    expect(lettura.aperta()).toBe(false);
    expect(ctx.el.ui.querySelector('.lettura')).toBeNull();
  });
});
