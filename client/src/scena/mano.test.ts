// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { contestoFinto } from './aiuti-prova';
import type { Contesto } from './contesto';
import { creaLettura } from './lettura';
import { defCarta, type IdCarta } from '../../../engine/src';
import { creaMano, posizioneMano, trasf, type Mano } from './mano';

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

describe('Mano comandata', () => {
  type Comando = NonNullable<Parameters<Mano['comanda']>[0]>;
  const A: IdCarta = 'sasso-comodo#1';
  const B: IdCarta = 'beee-no#1';
  const C: IdCarta = 'calzino-gemello#1';

  function comando(o: Partial<Comando> = {}): Comando & { toccate: string[]; trascinate: string[] } {
    const toccate: string[] = [];
    const trascinate: string[] = [];
    return {
      toccabili: [A, B, C],
      sollevate: [],
      trascinabili: [A, B, C],
      suTocco: (id) => toccate.push(id),
      suTrascinata: (id) => trascinate.push(id),
      ...o,
      toccate,
      trascinate,
    };
  }

  const carta = (id: IdCarta) => carte().find((e) => e.getAttribute('aria-label') === defCarta(id).nome)!;
  const tocca = (el: Element) => {
    evento('pointerdown', el, 100, 700);
    evento('pointerup', el, 100, 700);
  };
  const trascina = (el: Element, y: number) => {
    evento('pointerdown', el, 100, 700);
    evento('pointermove', el, 100, 650);
    evento('pointermove', el, 100, y);
    evento('pointerup', el, 100, y);
  };

  beforeEach(() => {
    mano.mostra([A, B, C], 0);
  });

  it('il tocco non solleva da solo: chiama suTocco con la carta toccata', () => {
    const c = comando();
    mano.comanda(c);
    tocca(carta(B));
    expect(c.toccate).toEqual([B]);
    expect(mano.attiva()).toBeNull();
    expect(carte().some((e) => e.classList.contains('attiva'))).toBe(false);
  });

  it('una carta sollevata sta al centro, ingrandita', () => {
    mano.comanda(comando({ sollevate: [B] }));
    expect(carta(B).style.transform).toBe(trasf({ x: 195, y: 470, r: 0, k: 0.66 }));
    expect(carta(B).classList.contains('attiva')).toBe(true);
    expect(mano.attiva()).toBe(B);
  });

  it('due carte sollevate stanno affiancate', () => {
    mano.comanda(comando({ sollevate: [A, C] }));
    expect(carta(A).style.transform).toBe(trasf({ x: 195 - 62, y: 480, r: 0, k: 0.5 }));
    expect(carta(C).style.transform).toBe(trasf({ x: 195 + 62, y: 480, r: 0, k: 0.5 }));
  });

  it('tre carte sollevate stanno in fila', () => {
    mano.comanda(comando({ sollevate: [A, B, C] }));
    expect(carta(A).style.transform).toBe(trasf({ x: 195 - 110, y: 490, r: 0, k: 0.42 }));
    expect(carta(B).style.transform).toBe(trasf({ x: 195, y: 490, r: 0, k: 0.42 }));
    expect(carta(C).style.transform).toBe(trasf({ x: 195 + 110, y: 490, r: 0, k: 0.42 }));
  });

  it('abbassare le carte sollevate le rimette nel ventaglio', () => {
    mano.comanda(comando({ sollevate: [A, B] }));
    mano.comanda(comando({ sollevate: [] }));
    expect(carte().some((e) => e.classList.contains('attiva'))).toBe(false);
    expect(mano.attiva()).toBeNull();
    expect(carta(A).style.transform).toBe(trasf(posizioneMano(0, 3)));
  });

  it('una carta non toccabile è spenta e il tocco non fa niente', () => {
    const c = comando({ toccabili: [A] });
    mano.comanda(c);
    expect(carta(B).classList.contains('spenta')).toBe(true);
    expect(carta(A).classList.contains('spenta')).toBe(false);
    tocca(carta(B));
    expect(c.toccate).toEqual([]);
    tocca(carta(A));
    expect(c.toccate).toEqual([A]);
  });

  it('una carta non toccabile si legge ancora tenendola premuta', () => {
    const c = comando({ toccabili: [A] });
    mano.comanda(c);
    evento('pointerdown', carta(B), 100, 700);
    vi.advanceTimersByTime(500);
    expect(lettura.aperta()).toBe(true);
    evento('pointerup', carta(B), 100, 700);
    expect(lettura.aperta()).toBe(false);
    expect(c.toccate).toEqual([]);
  });

  it('una carta sollevata resta in luce anche se la domanda non la dà come toccabile', () => {
    mano.comanda(comando({ toccabili: [A], sollevate: [B] }));
    expect(carta(B).classList.contains('spenta')).toBe(false);
  });

  it('trascinare una carta trascinabile sopra la linea 640 la gioca', () => {
    const c = comando();
    mano.comanda(c);
    const el = carta(A);
    evento('pointerdown', el, 100, 700);
    evento('pointermove', el, 100, 600);
    expect(el.classList.contains('trascinata')).toBe(true);
    evento('pointerup', el, 100, 600);
    expect(c.trascinate).toEqual([A]);
    expect(el.classList.contains('trascinata')).toBe(false);
    expect(c.toccate).toEqual([]);
  });

  it('rilasciata sulla linea 640 o sotto, la carta torna nel ventaglio senza giocare', () => {
    const c = comando();
    mano.comanda(c);
    trascina(carta(A), 640);
    trascina(carta(B), 700);
    expect(c.trascinate).toEqual([]);
    expect(c.toccate).toEqual([]);
    expect(carta(A).classList.contains('trascinata')).toBe(false);
    expect(carta(A).style.transform).toBe(trasf(posizioneMano(0, 3)));
  });

  it('il punto di rilascio è quello del dito nella scena, non quello riportato nella mano', () => {
    ctx.KD = 1.25;
    ctx.S = 2;
    const c = comando();
    mano.comanda(c);
    // schermo 1240 / S 2 = scena 620 (sopra la linea); riportato nella mano sarebbe 844 + (620 - 844) / 1.25 = 664,8
    trascina(carta(A), 1240);
    expect(c.trascinate).toEqual([A]);
    // schermo 1290 / 2 = scena 645 (sotto); riportato nella mano sarebbe 650,2
    trascina(carta(B), 1290);
    expect(c.trascinate).toEqual([A]);
  });

  it('una carta non trascinabile non si trascina e non gioca', () => {
    const c = comando({ trascinabili: [A] });
    mano.comanda(c);
    const el = carta(B);
    evento('pointerdown', el, 100, 700);
    evento('pointermove', el, 100, 600);
    expect(el.classList.contains('trascinata')).toBe(false);
    evento('pointerup', el, 100, 600);
    expect(c.trascinate).toEqual([]);
    expect(c.toccate).toEqual([]);
    vi.advanceTimersByTime(600);
    expect(lettura.aperta()).toBe(false);
  });

  it('comanda(null) a metà trascinamento lo annulla: niente giocata e carta nel ventaglio', () => {
    const c = comando();
    mano.comanda(c);
    const el = carta(A);
    evento('pointerdown', el, 100, 700);
    evento('pointermove', el, 100, 600);
    expect(el.classList.contains('trascinata')).toBe(true);
    mano.comanda(null);
    expect(el.classList.contains('trascinata')).toBe(false);
    expect(el.style.transform).toBe(trasf(posizioneMano(0, 3)));
    evento('pointerup', el, 100, 600);
    expect(c.trascinate).toEqual([]);
    expect(mano.attiva()).toBeNull();
  });

  it('una comanda nuova a metà trascinamento lo annulla', () => {
    const vecchia = comando();
    const nuova = comando();
    mano.comanda(vecchia);
    const el = carta(A);
    evento('pointerdown', el, 100, 700);
    evento('pointermove', el, 100, 600);
    mano.comanda(nuova);
    expect(el.classList.contains('trascinata')).toBe(false);
    evento('pointerup', el, 100, 600);
    expect(vecchia.trascinate).toEqual([]);
    expect(nuova.trascinate).toEqual([]);
  });

  it('una comanda nuova durante una tenuta non chiude la lettura', () => {
    mano.comanda(comando());
    evento('pointerdown', carta(A), 100, 700);
    vi.advanceTimersByTime(500);
    mano.comanda(comando());
    expect(lettura.aperta()).toBe(true);
  });

  it('pointercancel dopo un trascinamento non gioca', () => {
    const c = comando();
    mano.comanda(c);
    const el = carta(A);
    evento('pointerdown', el, 100, 700);
    evento('pointermove', el, 100, 600);
    evento('pointercancel', el, 100, 600);
    expect(c.trascinate).toEqual([]);
    expect(el.classList.contains('trascinata')).toBe(false);
  });

  it('sollevateIn dice dove stanno le carte sollevate, nelle coordinate della scena', () => {
    expect(mano.sollevateIn()).toBeNull();
    mano.comanda(comando({ sollevate: [B] }));
    expect(mano.sollevateIn()).toEqual({ x: 195, y: 470 });
    mano.comanda(comando({ sollevate: [A, C] }));
    expect(mano.sollevateIn()).toEqual({ x: 195, y: 480 });
    mano.comanda(comando({ sollevate: [A, B, C] }));
    expect(mano.sollevateIn()).toEqual({ x: 195, y: 490 });
    mano.comanda(comando());
    expect(mano.sollevateIn()).toBeNull();
  });

  it("sollevateIn segue l'ingrandimento della mano", () => {
    ctx.KD = 1.25;
    mano.comanda(comando({ sollevate: [B] }));
    const p = mano.sollevateIn()!;
    expect(p.x).toBeCloseTo(195, 5);
    expect(p.y).toBeCloseTo(844 + (470 - 844) * 1.25, 5);
  });

  it('con una mano nuova le carte sollevate che non ci sono più si ignorano', () => {
    mano.comanda(comando({ sollevate: [A, B] }));
    mano.mostra([B, C], 0);
    expect(carta(B).classList.contains('attiva')).toBe(true);
    expect(mano.sollevateIn()).toEqual({ x: 195, y: 470 });
  });

  it('con comanda(null) si torna al modo libero: il tocco solleva da solo', () => {
    mano.comanda(comando());
    mano.comanda(null);
    tocca(carta(A));
    expect(mano.attiva()).toBe(A);
    expect(mano.sollevateIn()).toBeNull();
  });

  it('nel modo libero il trascinamento torna sempre nel ventaglio', () => {
    trascina(carta(A), 300);
    expect(carta(A).classList.contains('trascinata')).toBe(false);
    expect(mano.attiva()).toBeNull();
  });

  describe('tastiera e lettori di schermo', () => {
    const tasto = (el: Element, key: string) => {
      const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      el.dispatchEvent(e);
      return e;
    };
    /** Il fuoco funziona solo su elementi nel documento: lo scheletro della prova sta in un `div` staccato. */
    function nelDocumento(): () => void {
      let r: HTMLElement = ctx.el.mano;
      while (r.parentElement) r = r.parentElement;
      document.body.appendChild(r);
      return () => r.remove();
    }

    it('con una domanda Tab raggiunge le carte toccabili e quelle sollevate; le spente no (aria-disabled), le sollevate premute', () => {
      mano.comanda(comando({ toccabili: [A], sollevate: [B] }));
      expect(carta(A).tabIndex).toBe(0);
      expect(carta(B).tabIndex).toBe(0);
      expect(carta(C).tabIndex).toBe(-1);
      expect(carta(C).getAttribute('aria-disabled')).toBe('true');
      expect(carta(A).hasAttribute('aria-disabled')).toBe(false);
      expect(carta(B).getAttribute('aria-pressed')).toBe('true');
      expect(carta(A).getAttribute('aria-pressed')).toBe('false');
      // Senza domanda (modo libero) niente tastiera, come prima
      mano.comanda(null);
      for (const el of carte()) {
        expect(el.hasAttribute('tabindex')).toBe(false);
        expect(el.hasAttribute('aria-disabled')).toBe(false);
        expect(el.hasAttribute('aria-pressed')).toBe(false);
      }
    });

    it('Invio, Spazio e clic senza puntatore su una carta toccabile chiamano suTocco; su una spenta niente', () => {
      const c = comando({ toccabili: [A, B] });
      mano.comanda(c);
      const invio = tasto(carta(A), 'Enter');
      expect(invio.defaultPrevented).toBe(true);
      tasto(carta(B), ' ');
      carta(A).dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
      // Il clic vero (dito, mouse) passa dal puntatore: non è un secondo tocco
      carta(A).dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
      tasto(carta(C), 'Enter');
      carta(C).dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
      tasto(carta(A), 'a');
      expect(c.toccate).toEqual([A, B, A]);
    });

    it('nel modo libero i tasti non fanno niente', () => {
      tasto(carta(A), 'Enter');
      expect(mano.attiva()).toBeNull();
    });

    it('la carta col fuoco lo tiene se mostra rimette le stesse carte; le carte cambiano ordine solo se serve', () => {
      const via = nelDocumento();
      try {
        mano.comanda(comando());
        const el = carta(B);
        el.focus();
        expect(document.activeElement).toBe(el);
        mano.mostra([A, B, C], 0);
        expect(document.activeElement).toBe(el);
        // Una carta nuova si aggiunge senza spostare le altre
        const D: IdCarta = 'balla-di-fieno#1';
        mano.mostra([A, B, C, D], 0);
        expect(document.activeElement).toBe(el);
        expect(carte().map((e) => e.getAttribute('aria-label'))).toEqual([A, B, C, D].map((id) => defCarta(id).nome));
        // Un ordine nuovo si rispetta (anche per Tab)
        mano.mostra([C, A, B, D], 0);
        expect(carte().map((e) => e.getAttribute('aria-label'))).toEqual([C, A, B, D].map((id) => defCarta(id).nome));
        expect(document.activeElement).toBe(el);
      } finally {
        via();
      }
    });
  });

  it('il trascinamento giocato avvisa il chiamante prima di suTrascinata (consiglio 3)', () => {
    mano.distruggi();
    const eventi: string[] = [];
    mano = creaMano(ctx, lettura, { allaGiocataTrascinando: () => eventi.push('avviso') });
    mano.mostra([A, B, C], 0);
    mano.comanda(comando({ suTrascinata: () => eventi.push('giocata') }));
    trascina(carta(A), 600);
    expect(eventi).toEqual(['avviso', 'giocata']);
    trascina(carta(B), 700);
    expect(eventi).toEqual(['avviso', 'giocata']);
  });
});
