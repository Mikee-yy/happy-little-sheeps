// @vitest-environment jsdom
// La scena si comincia a scaricare quando si apre "Gioca su questo dispositivo" o "Partita di prova", non prima:
// la Home da sola non la chiede. Ogni prova riparte con i moduli da capo (e React con loro).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./scena/teatro', () => ({
  creaTeatro: (radice: HTMLElement) => {
    const nulla = () => {};
    return {
      allinea: nulla,
      adatta: nulla,
      sospendi: nulla,
      avanza: nulla,
      eventoInCorso: () => false,
      salta: nulla,
      stato: () => ({}),
      rivediSuggerimenti: nulla,
      distruggi() {
        radice.innerHTML = '';
      },
      ordini: {},
      ctx: {},
    };
  },
}));

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
});
afterEach(async () => {
  const { cleanup } = await import('@testing-library/react');
  cleanup();
});

async function monta() {
  const rtl = await import('@testing-library/react');
  const { App } = await import('./App');
  const { scenaRichiesta } = await import('./partita/caricaScena');
  const { createElement } = await import('react');
  rtl.render(createElement(App));
  const clic = async (testo: string) => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.trim().startsWith(testo));
    if (!b) throw new Error(`manca ${testo}`);
    await rtl.act(async () => {
      rtl.fireEvent.click(b);
    });
  };
  return { clic, scenaRichiesta };
}

describe('precaricamento della scena', () => {
  it('la Home non la chiede; "Gioca su questo dispositivo" sì', async () => {
    const { clic, scenaRichiesta } = await monta();
    expect(scenaRichiesta()).toBe(false);
    await clic('Gioca su questo dispositivo');
    expect(scenaRichiesta()).toBe(true);
  }, 30_000);

  it('"Partita di prova" la chiede', async () => {
    const { clic, scenaRichiesta } = await monta();
    expect(scenaRichiesta()).toBe(false);
    await clic('Partita di prova');
    expect(scenaRichiesta()).toBe(true);
  });
});
