// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { piattaforma } from './piattaforma';

describe('piattaforma in jsdom', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('anima senza WAAPI dà un oggetto con finished già risolto', async () => {
    const el = document.createElement('div');
    const a = piattaforma.anima(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 100 });
    await expect(a.finished).resolves.toBeUndefined();
    a.playbackRate = 2;
    expect(a.playbackRate).toBe(2);
  });

  it('larghezzaTesto senza canvas stima 0,55 × dimensione × caratteri', () => {
    expect(piattaforma.larghezzaTesto('abcd', '700 20px sans-serif')).toBeCloseTo(0.55 * 20 * 4);
  });

  it('movimentoRidotto, vibrazione e audio hanno un ripiego', () => {
    expect(piattaforma.movimentoRidotto()).toBe(false);
    expect(piattaforma.audio()).toBeNull();
    const vibra = vi.fn();
    vi.stubGlobal('navigator', { vibrate: vibra });
    expect(piattaforma.puoVibrare()).toBe(true);
    piattaforma.vibra([80, 60]);
    expect(vibra).toHaveBeenCalledWith([80, 60]);
  });

  it('caratteriPronti e matriceDi non lanciano errori', async () => {
    await expect(piattaforma.caratteriPronti(50)).resolves.toBeUndefined();
    expect(() => piattaforma.matriceDi(document.createElement('div'))).not.toThrow();
  });
});

describe('piattaforma con le API del browser presenti', () => {
  /** jsdom non ha document.fonts: lo si mette (e lo si toglie a fine prova). */
  const conCaratteri = (fonts: FontFaceSet) => Object.defineProperty(document, 'fonts', { value: fonts, configurable: true });
  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(document, 'fonts');
  });

  it('anima usa el.animate e restituisce la sua animazione', () => {
    const el = document.createElement('div');
    const vera = { playbackRate: 1 } as unknown as Animation;
    const animate = vi.fn(() => vera);
    Object.defineProperty(el, 'animate', { value: animate, configurable: true });
    const fotogrammi = [{ opacity: 0 }, { opacity: 1 }];
    expect(piattaforma.anima(el, fotogrammi, { duration: 100 })).toBe(vera);
    expect(animate).toHaveBeenCalledWith(fotogrammi, { duration: 100 });
  });

  it('fermaAnimazioni annulla tutte le animazioni di tutto l albero; se getAnimations lancia non fa danni', () => {
    const el = document.createElement('div');
    const cancel = vi.fn();
    const getAnimations = vi.fn(() => [{ cancel }, { cancel }]);
    Object.defineProperty(el, 'getAnimations', { value: getAnimations, configurable: true });
    piattaforma.fermaAnimazioni(el);
    expect(getAnimations).toHaveBeenCalledWith({ subtree: true });
    expect(cancel).toHaveBeenCalledTimes(2);
    Object.defineProperty(el, 'getAnimations', { value: () => { throw new Error('no'); }, configurable: true });
    expect(() => piattaforma.fermaAnimazioni(el)).not.toThrow();
  });

  it('movimentoRidotto legge matchMedia (e un matchMedia che lancia vale "no")', () => {
    const matchMedia = vi.fn(() => ({ matches: true }));
    vi.stubGlobal('matchMedia', matchMedia);
    expect(piattaforma.movimentoRidotto()).toBe(true);
    expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    expect(piattaforma.movimentoRidotto()).toBe(false);
    vi.stubGlobal('matchMedia', () => {
      throw new Error('no');
    });
    expect(piattaforma.movimentoRidotto()).toBe(false);
  });

  it('seguiMovimentoRidotto: chiama la funzione a ogni cambio della preferenza (anche con il vecchio addListener) e smette', () => {
    let ridotto = false;
    const ascoltatori = new Set<(e: { matches: boolean }) => void>();
    const lista = {
      get matches() {
        return ridotto;
      },
      addEventListener: (_: string, f: (e: { matches: boolean }) => void) => ascoltatori.add(f),
      removeEventListener: (_: string, f: (e: { matches: boolean }) => void) => ascoltatori.delete(f),
    };
    vi.stubGlobal('matchMedia', () => lista);
    const visti: boolean[] = [];
    const smetti = piattaforma.seguiMovimentoRidotto((r) => visti.push(r));
    ridotto = true;
    for (const f of ascoltatori) f({ matches: true });
    expect(visti).toEqual([true]);
    smetti();
    expect(ascoltatori.size).toBe(0);
    // Safari vecchio: solo addListener/removeListener
    const vecchi = new Set<(e: { matches: boolean }) => void>();
    vi.stubGlobal('matchMedia', () => ({ matches: false, addListener: (f: (e: { matches: boolean }) => void) => vecchi.add(f), removeListener: (f: (e: { matches: boolean }) => void) => vecchi.delete(f) }));
    const smettiVecchio = piattaforma.seguiMovimentoRidotto((r) => visti.push(r));
    for (const f of vecchi) f({ matches: false });
    expect(visti).toEqual([true, false]);
    smettiVecchio();
    expect(vecchi.size).toBe(0);
    // Senza matchMedia, o se lancia: niente, e smettere non fa danni
    vi.stubGlobal('matchMedia', () => {
      throw new Error('no');
    });
    expect(() => piattaforma.seguiMovimentoRidotto(() => undefined)()).not.toThrow();
  });

  it('vibra non fa danni se navigator.vibrate lancia', () => {
    vi.stubGlobal('navigator', {
      vibrate: () => {
        throw new Error('no');
      },
    });
    expect(piattaforma.puoVibrare()).toBe(true);
    expect(() => piattaforma.vibra([10])).not.toThrow();
  });

  it('online segue navigator.onLine: solo "false" vuol dire senza rete', () => {
    vi.stubGlobal('navigator', { onLine: false });
    expect(piattaforma.online()).toBe(false);
    vi.stubGlobal('navigator', { onLine: true });
    expect(piattaforma.online()).toBe(true);
    vi.stubGlobal('navigator', {});
    expect(piattaforma.online()).toBe(true);
  });

  it('audio crea un contesto con AudioContext (o webkitAudioContext); se il costruttore lancia dà null', () => {
    class Finto {}
    vi.stubGlobal('AudioContext', Finto);
    expect(piattaforma.audio()).toBeInstanceOf(Finto);
    vi.stubGlobal('AudioContext', undefined);
    vi.stubGlobal('webkitAudioContext', Finto);
    expect(piattaforma.audio()).toBeInstanceOf(Finto);
    vi.stubGlobal('webkitAudioContext', function () {
      throw new Error('no');
    });
    expect(piattaforma.audio()).toBeNull();
  });

  it('matriceDi costruisce la matrice dalla trasformazione calcolata ("none" vuol dire matrice neutra)', () => {
    const el = document.createElement('div');
    const costruita: Array<string | undefined> = [];
    class Matrice {
      constructor(t?: string) {
        costruita.push(t);
      }
    }
    vi.stubGlobal('DOMMatrix', Matrice);
    vi.stubGlobal('getComputedStyle', () => ({ transform: 'matrix(1, 0, 0, 1, 5, 6)' }));
    expect(piattaforma.matriceDi(el)).toBeInstanceOf(Matrice);
    vi.stubGlobal('getComputedStyle', () => ({ transform: 'none' }));
    piattaforma.matriceDi(el);
    expect(costruita).toEqual(['matrix(1, 0, 0, 1, 5, 6)', undefined]);
    vi.stubGlobal('getComputedStyle', () => {
      throw new Error('no');
    });
    expect(piattaforma.matriceDi(el)).toBeNull();
  });

  it('paginaNascosta legge document.hidden', () => {
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    expect(piattaforma.paginaNascosta()).toBe(true);
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    expect(piattaforma.paginaNascosta()).toBe(false);
  });

  it('osservaMisura usa ResizeObserver, chiama la funzione a ogni cambio e smette con il disconnect', () => {
    const richiami: Array<() => void> = [];
    const disconnect = vi.fn();
    const osservati: Element[] = [];
    class Osservatore {
      constructor(cb: () => void) {
        richiami.push(cb);
      }
      observe(el: Element) {
        osservati.push(el);
      }
      disconnect = disconnect;
    }
    vi.stubGlobal('ResizeObserver', Osservatore);
    const el = document.createElement('div');
    const cb = vi.fn();
    const smetti = piattaforma.osservaMisura(el, cb);
    expect(osservati).toEqual([el]);
    richiami[0]!();
    expect(cb).toHaveBeenCalledTimes(1);
    smetti();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('caratteriPronti prosegue appena i caratteri sono pronti, senza aspettare il tempo massimo; se non arrivano, al tempo massimo', async () => {
    vi.useFakeTimers();
    try {
      let pronti!: () => void;
      conCaratteri({ ready: new Promise<void>((ok) => (pronti = ok)) } as unknown as FontFaceSet);
      let finito = false;
      void piattaforma.caratteriPronti(5000).then(() => (finito = true));
      await vi.advanceTimersByTimeAsync(100);
      expect(finito).toBe(false);
      pronti();
      await vi.advanceTimersByTimeAsync(0);
      expect(finito).toBe(true);
      // Il timer è stato tolto: non resta niente in sospeso
      expect(vi.getTimerCount()).toBe(0);
      // Caratteri che non arrivano mai: si prosegue comunque dopo il tempo massimo
      conCaratteri({ ready: new Promise<void>(() => {}) } as unknown as FontFaceSet);
      let secondo = false;
      void piattaforma.caratteriPronti(300).then(() => (secondo = true));
      await vi.advanceTimersByTimeAsync(299);
      expect(secondo).toBe(false);
      await vi.advanceTimersByTimeAsync(2);
      expect(secondo).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('impostaScala: la proprietà scale separata e il ripiego per i browser vecchi', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('con scale separata (o senza CSS.supports, come in jsdom) usa style.scale', () => {
    const el = document.createElement('div');
    piattaforma.impostaScala(el, '1.5');
    expect(el.style.scale).toBe('1.5');
    vi.stubGlobal('CSS', { supports: () => true });
    piattaforma.impostaScala(el, '0.5 2');
    expect(el.style.scale).toBe('0.5 2');
  });

  it('senza scale separata (Chrome < 104, Safari < 14.1) mette la scala nel transform', () => {
    vi.stubGlobal('CSS', { supports: (p: string) => p !== 'scale' });
    const el = document.createElement('div');
    piattaforma.impostaScala(el, '1.5');
    expect(el.style.transform).toBe('scale(1.5)');
    piattaforma.impostaScala(el, '0.5 2');
    expect(el.style.transform).toBe('scale(0.5, 2)');
  });
});
