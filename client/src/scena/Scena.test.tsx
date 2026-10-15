// @vitest-environment jsdom
// Prove del componente Scena: teatro vero con ciclo automatico e rAF finto.
// Doppio montaggio (punto di revisione 2), riassunto per chi non vede, ritorno da un'altra scheda (punto 4),
// scena nascosta che non consuma, adattamento quando la radice cambia misura.
import { readFileSync } from 'node:fs';
import { StrictMode } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { disposizione } from './disposizioni';
import { H } from './misure';
import { posizioneMano } from './mano';
import { nuovaPartita, vistaPer } from '../../../engine/src';
import type { IdGiocatore } from '../../../engine/src';
import { fotografia, type Fotografia } from './fotografia';
import { Scena } from './Scena';
import type { Teatro } from './teatro';

/** Ogni teatro creato e ogni chiamata ad allinea/adatta: il teatro è quello vero, avvolto da una spia. */
const spia = vi.hoisted(() => ({
  teatri: [] as Teatro[],
  allinea: [] as { teatro: number; foto: unknown; modo: 'calmo' | 'subito' }[],
  adatta: 0,
}));

vi.mock('./teatro', async (originale) => {
  const m = await originale<typeof import('./teatro')>();
  return {
    ...m,
    creaTeatro: (radice: HTMLElement, o?: Parameters<typeof m.creaTeatro>[1]) => {
      // Senza ambiente le prove sono veloci; il resto è il teatro vero
      const t = m.creaTeatro(radice, { ...o, ambiente: false });
      const n = spia.teatri.push(t) - 1;
      const allinea = t.allinea.bind(t);
      const adatta = t.adatta.bind(t);
      t.allinea = (foto, modo) => {
        spia.allinea.push({ teatro: n, foto, modo });
        allinea(foto, modo);
      };
      t.adatta = () => {
        spia.adatta++;
        adatta();
      };
      return t;
    },
  };
});

const GIOCATORI = [
  { id: 'g1', nome: 'Anna', pecora: 'ricciolo' as const },
  { id: 'g2', nome: 'Bruno', pecora: 'brontolana' as const },
  { id: 'g3', nome: 'Carla', pecora: 'sospirella' as const },
];
const foto = (inBasso: IdGiocatore = 'g1'): Fotografia =>
  fotografia(vistaPer(nuovaPartita({ giocatori: GIOCATORI, seme: 7 }), null), inBasso, null);
/** Due agnellini dal gregge ad Anna: una fotografia diversa dalla prima. */
const dopo = (f: Fotografia): Fotografia => ({
  ...f,
  gregge: f.gregge - 2,
  posti: f.posti.map((p) => (p.id === 'g1' ? { ...p, agnellini: p.agnellini + 2 } : p)),
});

function rafFinto() {
  const coda = new Map<number, FrameRequestCallback>();
  let prossimo = 1;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    coda.set(prossimo, cb);
    return prossimo++;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    coda.delete(id);
  });
  vi.spyOn(performance, 'now').mockReturnValue(1000);
  return coda;
}

function visibilita(stato: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => stato });
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
  spia.teatri.length = 0;
  spia.allinea.length = 0;
  spia.adatta = 0;
});
afterEach(() => {
  cleanup();
  delete (document as unknown as Record<string, unknown>).visibilityState;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('Scena', () => {
  it('in StrictMode: monta, cambia fotografia e smonta senza errori, senza rAF in sospeso, con la radice svuotata', () => {
    const errori = vi.spyOn(console, 'error');
    const coda = rafFinto();
    const f = foto();
    const r = render(
      <StrictMode>
        <Scena foto={f} />
      </StrictMode>,
    );
    const radice = r.container.querySelector<HTMLElement>('div.teatro')!;
    expect(radice.getAttribute('aria-hidden')).toBe('true');
    // Il doppio montaggio di StrictMode lascia una sola scena e un solo ciclo
    expect(radice.querySelectorAll('.mondo')).toHaveLength(1);
    expect(coda.size).toBe(1);
    // Ogni teatro creato parte con un allineamento "subito"
    for (let i = 0; i < spia.teatri.length; i++) expect(spia.allinea.find((c) => c.teatro === i)?.modo).toBe('subito');
    const vivo = spia.teatri.length - 1;
    const f2 = dopo(f);
    r.rerender(
      <StrictMode>
        <Scena foto={f2} />
      </StrictMode>,
    );
    expect(spia.allinea.at(-1)).toEqual({ teatro: vivo, foto: f2, modo: 'calmo' });
    expect(spia.teatri[vivo]!.stato().agnellini.g1?.assegnati).toBe(f2.posti[0]!.agnellini);
    r.unmount();
    expect(coda.size).toBe(0);
    expect(radice.childElementCount).toBe(0);
    expect(errori).not.toHaveBeenCalled();
  });

  it('la stessa fotografia (anche ricalcolata) non riallinea', () => {
    rafFinto();
    const r = render(<Scena foto={foto()} />);
    const prima = spia.allinea.length;
    r.rerender(<Scena foto={foto()} />);
    expect(spia.allinea).toHaveLength(prima);
  });

  it('il riassunto per chi non vede la scena: una riga per giocatore e il gregge', () => {
    rafFinto();
    const f = foto('g2');
    const r = render(<Scena foto={f} />);
    const righe = [...r.container.querySelectorAll('.solo-lettori li')].map((li) => li.textContent ?? '');
    expect(righe).toHaveLength(4);
    expect(righe[0]).toMatch(/^Bruno: /);
    expect(righe.join('\n')).toContain('Gregge: ');
    // Non dentro la scena (nascosta ai lettori di schermo)
    expect(r.container.querySelector('.teatro .solo-lettori')).toBeNull();
  });

  it("ritorno da un'altra scheda: visibilitychange verso visibile riallinea 'subito' l'ultima fotografia", () => {
    rafFinto();
    const f = foto();
    const r = render(<Scena foto={f} />);
    const f2 = dopo(f);
    r.rerender(<Scena foto={f2} />);
    const prima = spia.allinea.length;
    act(() => visibilita('hidden'));
    expect(spia.allinea).toHaveLength(prima);
    act(() => visibilita('visible'));
    expect(spia.allinea).toHaveLength(prima + 1);
    expect(spia.allinea.at(-1)).toMatchObject({ foto: f2, modo: 'subito' });
    // Smontata, la pagina che torna visibile non tocca più niente
    r.unmount();
    act(() => visibilita('visible'));
    expect(spia.allinea).toHaveLength(prima + 1);
  });

  it('nascosta: il ciclo si ferma senza distruggere la scena; mostrata di nuovo si rimette in pari subito', () => {
    const coda = rafFinto();
    const f = foto();
    const r = render(<Scena foto={f} />);
    const radice = r.container.querySelector<HTMLElement>('div.teatro')!;
    expect(coda.size).toBe(1);
    r.rerender(<Scena foto={f} nascosta />);
    expect(coda.size).toBe(0);
    expect(radice.querySelectorAll('.mondo')).toHaveLength(1);
    // Le fotografie che arrivano intanto non si allineano
    const prima = spia.allinea.length;
    const f2 = dopo(f);
    r.rerender(<Scena foto={f2} nascosta />);
    expect(spia.allinea).toHaveLength(prima);
    act(() => visibilita('visible'));
    expect(spia.allinea).toHaveLength(prima);
    r.rerender(<Scena foto={f2} />);
    expect(coda.size).toBe(1);
    expect(spia.allinea.at(-1)).toMatchObject({ foto: f2, modo: 'subito' });
    expect(spia.teatri).toHaveLength(1);
  });

  it('la scala si rifà quando la radice cambia misura (ResizeObserver) e quando la scena torna visibile', () => {
    rafFinto();
    const osservatori: { cb: () => void; el: Element[]; via: boolean }[] = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        o: { cb: () => void; el: Element[]; via: boolean };
        constructor(cb: () => void) {
          this.o = { cb, el: [], via: false };
          osservatori.push(this.o);
        }
        observe(el: Element) {
          this.o.el.push(el);
        }
        unobserve() {}
        disconnect() {
          this.o.via = true;
        }
      },
    );
    const r = render(<Scena foto={foto()} />);
    const radice = r.container.querySelector('div.teatro')!;
    const attivo = osservatori.find((o) => !o.via)!;
    expect(attivo.el).toContain(radice);
    const prima = spia.adatta;
    act(() => attivo.cb());
    expect(spia.adatta).toBe(prima + 1);
    r.rerender(<Scena foto={foto()} nascosta />);
    r.rerender(<Scena foto={foto()} />);
    expect(spia.adatta).toBeGreaterThan(prima + 1);
    r.unmount();
    expect(osservatori.every((o) => o.via)).toBe(true);
  });

  it('il suggerimento dei gesti sta in basso, in coordinate della scena, non più legato alla striscia in cima', () => {
    rafFinto();
    const r = render(<Scena foto={foto()} />);
    const radice = r.container.querySelector<HTMLElement>('div.teatro')!;
    expect(radice.classList.contains('spazio-alto')).toBe(false);
    expect(radice.querySelector('.consiglio')).not.toBeNull();
    // Il CSS come testo (le prove non elaborano i fogli di stile)
    const css = readFileSync('client/src/scena/scena.css', 'utf8');
    expect(css).not.toMatch(/spazio-alto/);
    expect(css).not.toMatch(/--sy/);
    // In coordinate della scena (scalata con S, non ingrandita da --kd): top fisso e altezza fissa, niente ancoraggio al fondo
    const regole = [...css.matchAll(/\.teatro \.consiglio\s*{([^}]*)}/g)].map((m) => m[1]).join(' ');
    expect(regole).toMatch(/top:\s*\d+(\.\d+)?px/);
    expect(regole).not.toMatch(/bottom:/);
    expect(regole).not.toMatch(/--kd/);
    expect(regole).toMatch(/height:\s*\d+px/);
    expect(regole).toMatch(/font:\s*700 10px/);
  });

  it('il suggerimento sta tra la staccionata davanti del posto 0 e la cima delle carte, con KD tra 1 e 1,25 (numeri dalla disposizione e dalla mano)', () => {
    const css = readFileSync('client/src/scena/scena.css', 'utf8');
    const regole = [...css.matchAll(/\.teatro \.consiglio\s*{([^}]*)}/g)].map((m) => m[1]).join(' ');
    const top = Number(/top:\s*([\d.]+)px/.exec(regole)?.[1]);
    const alto = Number(/height:\s*(\d+)px/.exec(regole)?.[1]);
    const fondo = top + alto;
    const cartelloBasso = (d: ReturnType<typeof disposizione>) => {
      const [, , yDavanti, , k] = d.posti[0]!.recinto!;
      return { yDavanti, k };
    };
    for (const n of [2, 3, 4] as const) {
      const { yDavanti, k } = cartelloBasso(disposizione(n));
      // Fondo dei paletti davanti (palo: h + 3k sotto la quota) più metà del tratto
      const fondoStaccionata = yDavanti + 3 * k + 1.1;
      expect(top).toBeGreaterThanOrEqual(fondoStaccionata);
      // Il cartello del recinto sta sopra la staccionata davanti (top = yDavanti - 22k·0.95)
      expect(top).toBeGreaterThan(yDavanti);
      for (const KD of [1, 1.25]) {
        for (let m = 1; m <= 8; m++) {
          // Cima del ventaglio a riposo (le carte coi gesti da dito): il punto più alto è la carta centrale o le due centrali
          const cima = Math.min(...Array.from({ length: m }, (_, i) => posizioneMano(i, m).y - 175 * posizioneMano(i, m).k));
          expect(fondo).toBeLessThanOrEqual(H - (H - cima) * KD);
        }
      }
      // Con la carta rialzata dal mouse (k 0,4, su di 26) a KD 1 sta ancora sopra
      const rialzata = posizioneMano(0, 1).y - 26 - 175 * 0.4;
      expect(fondo).toBeLessThanOrEqual(rialzata);
    }
  });

  it('senza ResizeObserver (jsdom) si monta lo stesso', () => {
    rafFinto();
    vi.stubGlobal('ResizeObserver', undefined);
    expect(() => render(<Scena foto={foto()} />)).not.toThrow();
  });
});
