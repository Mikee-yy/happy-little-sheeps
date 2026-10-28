// @vitest-environment jsdom
// Samsung Internet con la modalità notte scurisce il gioco anche se dichiara "only light" (vedi modalitaChiara.test.ts):
// nessuna pagina può impedirlo. Su quel browser, quando la modalità notte è probabilmente attiva, la Home mostra una
// volta sola un avviso con la strada per riavere i colori del gioco. Mai sugli altri browser, mai con i colori chiari;
// nel dubbio non si mostra.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { avvisoNotteDaMostrare, CHIAVE_AVVISO_NOTTE, chiudiAvvisoNotte, samsungInModalitaNotte } from './modalitaNotte';
import { Home } from './schermate';
import { T } from './testi';

const SAMSUNG =
  'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36';
const CHROME_ANDROID =
  'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36';
/** Samsung Internet in "versione desktop": si presenta come Chrome per computer, senza "SamsungBrowser". */
const SAMSUNG_DESKTOP = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const SAFARI_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

/** Un matchMedia finto: risponde "sì" a prefers-color-scheme: dark solo se `scuro`. */
const media = (scuro: boolean) => (q: string) => ({ matches: scuro && q.includes('prefers-color-scheme: dark'), media: q });

describe('samsungInModalitaNotte: Samsung Internet e colori scuri chiesti dal telefono', () => {
  it('Samsung Internet con prefers-color-scheme: dark → sì', () => {
    expect(samsungInModalitaNotte(SAMSUNG, media(true))).toBe(true);
  });

  it('Samsung Internet con i colori chiari → no', () => {
    expect(samsungInModalitaNotte(SAMSUNG, media(false))).toBe(false);
  });

  it('gli altri browser, anche scuri → no', () => {
    for (const ua of [CHROME_ANDROID, SAMSUNG_DESKTOP, SAFARI_IPHONE, '']) expect(samsungInModalitaNotte(ua, media(true)), ua).toBe(false);
  });

  it('nel dubbio no: niente userAgent, niente matchMedia, matchMedia che lancia o risponde male', () => {
    expect(samsungInModalitaNotte(undefined, media(true))).toBe(false);
    expect(samsungInModalitaNotte(SAMSUNG, undefined)).toBe(false);
    expect(
      samsungInModalitaNotte(SAMSUNG, () => {
        throw new Error('no');
      }),
    ).toBe(false);
    expect(samsungInModalitaNotte(SAMSUNG, () => ({}) as { matches: boolean })).toBe(false);
  });

  it('"SamsungBrowser" deve essere il nome del browser con la versione, non una parola qualsiasi', () => {
    expect(samsungInModalitaNotte('Mozilla/5.0 NonSamsungBrowserX', media(true))).toBe(false);
    expect(samsungInModalitaNotte('Mozilla/5.0 SamsungBrowser/', media(true))).toBe(false);
  });
});

/** Il browser delle prove si presenta con questo userAgent e questa preferenza di colori. */
function browser(ua: string, scuro: boolean) {
  Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
  vi.stubGlobal('matchMedia', media(scuro));
}

const vuoto = () => {};
const home = () =>
  render(
    <Home
      salvata={false}
      multigiocatore={false}
      iscrizione={null}
      avviso={null}
      onNuova={vuoto}
      onProva={vuoto}
      onRiprendi={vuoto}
      onCrea={vuoto}
      onEntra={vuoto}
      onRientra={vuoto}
      onDimentica={vuoto}
      onRegole={vuoto}
    />,
  );

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete (navigator as { userAgent?: string }).userAgent;
  localStorage.clear();
});

describe('avvisoNotteDaMostrare: una volta sola', () => {
  it('si mostra su Samsung Internet scuro finché non lo si chiude; chiuso, non torna', () => {
    browser(SAMSUNG, true);
    expect(avvisoNotteDaMostrare()).toBe(true);
    chiudiAvvisoNotte();
    expect(localStorage.getItem(CHIAVE_AVVISO_NOTTE)).not.toBeNull();
    expect(avvisoNotteDaMostrare()).toBe(false);
  });

  it('mai sugli altri browser né con i colori chiari', () => {
    browser(CHROME_ANDROID, true);
    expect(avvisoNotteDaMostrare()).toBe(false);
    browser(SAMSUNG, false);
    expect(avvisoNotteDaMostrare()).toBe(false);
  });

  it('se la memoria del browser non si legge non si mostra (non si saprebbe se era già stato chiuso)', () => {
    browser(SAMSUNG, true);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloccata');
    });
    expect(avvisoNotteDaMostrare()).toBe(false);
  });

  it('se la memoria non si scrive, chiudere non dà errori', () => {
    browser(SAMSUNG, true);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('piena');
    });
    expect(() => chiudiAvvisoNotte()).not.toThrow();
  });
});

describe('Home: l\'avviso di Samsung Internet in modalità notte', () => {
  it('su Samsung Internet scuro: riquadro con titolo, spiegazione e la strada nel menu, senza prendere il fuoco', () => {
    browser(SAMSUNG, true);
    home();
    const riquadro = screen.getByRole('region', { name: T.avvisoNotte.titolo });
    expect(riquadro.textContent).toContain(T.avvisoNotte.testo);
    expect(riquadro.textContent).toContain(T.avvisoNotte.come);
    // Decisione dell'utente (28 ottobre): niente riga su Labs né posizione del menu, che dipende da dove sta la barra
    expect(T.avvisoNotte.come).toBe('Per rivederlo con i suoi colori tocca il menu e scegli «Siti chiari».');
    expect(riquadro.textContent).not.toContain('Labs');
    expect(riquadro.contains(document.activeElement)).toBe(false);
  });

  it('"Ho capito" lo chiude, il fuoco passa al primo pulsante della Home, e non torna più', () => {
    browser(SAMSUNG, true);
    home();
    fireEvent.click(screen.getByRole('button', { name: T.avvisoNotte.chiudi }));
    expect(screen.queryByRole('region', { name: T.avvisoNotte.titolo })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: T.home.giocaQui }));
    cleanup();
    home();
    expect(screen.queryByRole('region', { name: T.avvisoNotte.titolo })).toBeNull();
  });

  it('non c\'è su Chrome scuro, su Samsung Internet chiaro, né nel browser delle prove', () => {
    browser(CHROME_ANDROID, true);
    home();
    expect(screen.queryByRole('region', { name: T.avvisoNotte.titolo })).toBeNull();
    cleanup();
    browser(SAMSUNG, false);
    home();
    expect(screen.queryByRole('region', { name: T.avvisoNotte.titolo })).toBeNull();
    cleanup();
    vi.unstubAllGlobals();
    delete (navigator as { userAgent?: string }).userAgent;
    home();
    expect(screen.queryByRole('region', { name: T.avvisoNotte.titolo })).toBeNull();
  });
});
