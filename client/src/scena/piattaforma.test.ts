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
