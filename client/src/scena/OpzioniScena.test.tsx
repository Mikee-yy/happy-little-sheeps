// @vitest-environment jsdom
// Prove del menu Opzioni della scena (bozza scena.src.html, righe 2583–2606 e 2684; prove.js, provaOpzioni e provaMinori (f)).
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { T } from '../testi';

/** Moduli nuovi di zecca: le opzioni sono una sola per pagina, quindi tra una prova e l'altra si ricaricano. */
async function carica() {
  vi.resetModules();
  const { OpzioniScena } = await import('./OpzioniScena');
  const opzioni = await import('./servizi/opzioni');
  return { OpzioniScena, opzioni };
}

const interruttore = (testo: string) =>
  [...document.querySelectorAll<HTMLElement>('[role=switch]')].find((b) => b.textContent?.trim().startsWith(testo));
const pulsante = (testo: string) => [...document.querySelectorAll<HTMLElement>('button')].find((b) => b.textContent?.trim() === testo);

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('OpzioniScena', () => {
  it("gli interruttori mostrano aria-checked e il testo 'Animazioni veloci: no'", async () => {
    vi.stubGlobal('navigator', { ...navigator, vibrate: () => true });
    const { OpzioniScena } = await carica();
    render(<OpzioniScena rivediSuggerimenti={() => undefined} />);
    const o = T.scena.opzioni;
    const veloci = interruttore(o.veloci);
    expect(veloci?.textContent).toBe(`${o.veloci}: ${o.no}`);
    expect(veloci?.getAttribute('aria-checked')).toBe('false');
    expect(interruttore(o.suoni)?.getAttribute('aria-checked')).toBe('false');
    expect(interruttore(o.vibrazione)?.getAttribute('aria-checked')).toBe('true');
    expect(interruttore(o.vibrazione)?.textContent).toBe(`${o.vibrazione}: ${o.si}`);
  });

  it("un clic cambia l'opzione salvata e il punto resta sull'interruttore", async () => {
    const { OpzioniScena, opzioni } = await carica();
    render(<OpzioniScena rivediSuggerimenti={() => undefined} />);
    const o = T.scena.opzioni;
    const veloci = interruttore(o.veloci)!;
    veloci.focus();
    await act(async () => {
      fireEvent.click(veloci);
    });
    expect(opzioni.opzioni().veloci).toBe(true);
    expect(JSON.parse(localStorage.getItem('hls-opzioni') ?? '{}').veloci).toBe(true);
    // Lo stesso elemento, aggiornato al suo posto
    expect(interruttore(o.veloci)).toBe(veloci);
    expect(document.activeElement).toBe(veloci);
    expect(veloci.getAttribute('aria-checked')).toBe('true');
    expect(veloci.textContent).toBe(`${o.veloci}: ${o.si}`);
  });

  it('segue le opzioni cambiate altrove', async () => {
    const { OpzioniScena, opzioni } = await carica();
    render(<OpzioniScena rivediSuggerimenti={() => undefined} />);
    await act(async () => {
      opzioni.cambiaOpzione('suoni');
    });
    expect(interruttore(T.scena.opzioni.suoni)?.getAttribute('aria-checked')).toBe('true');
    // Rimette i suoni spenti (l'audio di jsdom non c'è, ma meglio non lasciare ascoltatori accesi)
    await act(async () => {
      opzioni.cambiaOpzione('suoni');
    });
  });

  it('senza navigator.vibrate la riga Vibrazione manca', async () => {
    vi.stubGlobal('navigator', { ...navigator, vibrate: undefined });
    const { OpzioniScena } = await carica();
    render(<OpzioniScena rivediSuggerimenti={() => undefined} />);
    expect(interruttore(T.scena.opzioni.vibrazione)).toBeUndefined();
    expect(interruttore(T.scena.opzioni.suoni)).toBeDefined();
    expect(interruttore(T.scena.opzioni.veloci)).toBeDefined();
  });

  it('"Rivedi i suggerimenti" chiama rivediSuggerimenti e chiude il menu', async () => {
    const { OpzioniScena } = await carica();
    const rivedi = vi.fn();
    const chiudi = vi.fn();
    render(<OpzioniScena rivediSuggerimenti={rivedi} onChiudi={chiudi} />);
    await act(async () => {
      fireEvent.click(pulsante(T.scena.opzioni.rivedi)!);
    });
    expect(rivedi).toHaveBeenCalledTimes(1);
    expect(chiudi).toHaveBeenCalledTimes(1);
  });

  it('Esc chiude il menu', async () => {
    const { OpzioniScena } = await carica();
    const chiudi = vi.fn();
    render(<OpzioniScena rivediSuggerimenti={() => undefined} onChiudi={chiudi} />);
    const veloci = interruttore(T.scena.opzioni.veloci)!;
    fireEvent.keyDown(veloci, { key: 'Escape' });
    expect(chiudi).toHaveBeenCalledTimes(1);
  });
});
