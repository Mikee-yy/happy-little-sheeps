// @vitest-environment jsdom
// La schermata Regole: otto sezioni a fisarmonica (pulsanti veri dentro gli h2), figure montate solo nelle sezioni
// aperte, carte che arrivano a parte (con un segnaposto che ha lo stesso testo alternativo), file scorrevoli con un
// nome, nomi dei giocatori solo come testo, animazioni in pausa fuori dallo schermo, avviso e richiamo della stanza.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { T, regole } from '../testi';
import { testoAlternativo } from './alternativi';
import { caricaCarte, usaCaricatoreDiProva } from './caricaCarte';
import { Regole } from './Regole';

beforeEach(() => usaCaricatoreDiProva(() => import('./carte')));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  usaCaricatoreDiProva(null);
});

const titoli = () => [...document.querySelectorAll<HTMLButtonElement>('main.regole h2 > button')];
const titolo = (nome: string) => titoli().find((b) => b.textContent?.includes(nome))!;
const pannelloDi = (b: HTMLButtonElement) => document.getElementById(b.getAttribute('aria-controls')!)!;
/** Lascia arrivare il modulo delle carte (import dinamico) e gli aggiornamenti di React. */
const attendi = async () => {
  await act(async () => {
    await caricaCarte().catch(() => {});
  });
  for (let i = 0; i < 3; i++) await act(async () => new Promise((r) => setTimeout(r, 0)));
};
const mostra = (p: Partial<Parameters<typeof Regole>[0]> = {}) => {
  const onIndietro = vi.fn();
  render(<Regole nomi={null} onIndietro={onIndietro} {...p} />);
  return onIndietro;
};

/** Le carte di una sezione, nell'ordine dei dati. */
const carteDi = (id: string) =>
  regole(null)
    .find((s) => s.id === id)!
    .blocchi.flatMap((b) => b.figure.map((f) => f.disegno))
    .filter((d) => d.tipo === 'carta');

describe('Regole: la fisarmonica', () => {
  it('otto titoli che sono pulsanti negli h2; aperto solo il primo; aria-controls punta sempre a un pannello presente', () => {
    mostra();
    const b = titoli();
    expect(b).toHaveLength(8);
    expect(b.map((x) => x.textContent)).toEqual(regole(null).map((s, i) => `${i + 1}${s.titolo}`));
    expect(b.map((x) => x.getAttribute('aria-expanded'))).toEqual(['true', ...Array(7).fill('false')]);
    for (const [i, x] of b.entries()) {
      expect(x.type).toBe('button');
      const p = pannelloDi(x);
      expect(p).not.toBeNull();
      // Contenitori semplici, non otto "region" (con tutto aperto riempirebbero i punti di riferimento)
      expect(p.getAttribute('role')).toBeNull();
      expect(p.getAttribute('aria-labelledby')).toBeNull();
      expect(p.hidden).toBe(i !== 0);
      // Chiuso: nessuna figura montata, né carte né segnaposti né altri disegni
      if (i !== 0) {
        expect(p.querySelector('.figura-carta, .figura-segnaposto, figure, svg')).toBeNull();
        expect(p.textContent).toBe('');
      }
    }
  });

  it('i lettori di schermo leggono "1. Lo scopo", non "1Lo scopo"', () => {
    mostra();
    expect(screen.getByRole('button', { name: '1. Lo scopo' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '8. Tre esempi' })).toBeTruthy();
  });

  it('si aprono più sezioni insieme, e un nuovo clic richiude', () => {
    mostra();
    fireEvent.click(titolo('Le carte'));
    fireEvent.click(titolo('Il dado'));
    expect(titolo('Le carte').getAttribute('aria-expanded')).toBe('true');
    expect(titolo('Il dado').getAttribute('aria-expanded')).toBe('true');
    expect(pannelloDi(titolo('Il dado')).hidden).toBe(false);
    expect(titolo('Lo scopo').getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(titolo('Le carte'));
    expect(titolo('Le carte').getAttribute('aria-expanded')).toBe('false');
    expect(pannelloDi(titolo('Le carte')).hidden).toBe(true);
    expect(pannelloDi(titolo('Le carte')).querySelector('figure')).toBeNull();
    expect(titolo('Il dado').getAttribute('aria-expanded')).toBe('true');
  });

  it("all'apertura il punto della tastiera va sull'h1; i titoli seguono nell'ordine del documento", () => {
    mostra();
    const h1 = document.querySelector('main.regole h1') as HTMLHeadingElement;
    expect(h1.textContent).toBe(T.regole.titolo);
    expect(h1.tabIndex).toBe(-1);
    expect(document.activeElement).toBe(h1);
    const b = titoli();
    expect(h1.compareDocumentPosition(b[0]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    for (let i = 1; i < b.length; i++) expect(b[i - 1]!.compareDocumentPosition(b[i]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('lo stato delle sezioni non si ricorda tra un\'apertura e l\'altra', () => {
    mostra();
    fireEvent.click(titolo('Le carte'));
    cleanup();
    mostra();
    expect(titolo('Le carte').getAttribute('aria-expanded')).toBe('false');
  });
});

describe('Regole: le figure', () => {
  it('aprendo "Le carte" arrivano le 13 carte disegnate, ognuna con il suo testo alternativo', async () => {
    mostra();
    fireEvent.click(titolo('Le carte'));
    await attendi();
    const p = pannelloDi(titolo('Le carte'));
    const carte = [...p.querySelectorAll('.figura-carta')];
    expect(carte).toHaveLength(13);
    expect(carte.map((c) => c.getAttribute('aria-label'))).toEqual(carteDi('carte').map(testoAlternativo));
    expect(carte.every((c) => c.getAttribute('role') === 'img' && c.querySelector('svg'))).toBe(true);
    expect(p.querySelector('.figura-segnaposto')).toBeNull();
  });

  it('finché le carte non arrivano, e se il caricamento fallisce, restano 13 segnaposti con lo stesso testo', async () => {
    usaCaricatoreDiProva(() => Promise.reject(new Error('rete assente')));
    mostra();
    fireEvent.click(titolo('Le carte'));
    const p = pannelloDi(titolo('Le carte'));
    expect(p.querySelectorAll('.figura-segnaposto')).toHaveLength(13);
    await attendi();
    const segnaposti = [...p.querySelectorAll('.figura-segnaposto')];
    expect(segnaposti).toHaveLength(13);
    expect(segnaposti.map((c) => c.getAttribute('role'))).toEqual(Array(13).fill('img'));
    expect(segnaposti.map((c) => c.getAttribute('aria-label'))).toEqual(carteDi('carte').map(testoAlternativo));
    expect(p.querySelector('.figura-carta')).toBeNull();
    // La schermata funziona lo stesso
    fireEvent.click(titolo('Il dado'));
    expect(pannelloDi(titolo('Il dado')).hidden).toBe(false);
    fireEvent.click(titolo('Le carte'));
    expect(p.hidden).toBe(true);
  });

  it('gli altri disegni ci sono subito, ognuno con il suo testo alternativo; il recinto lo porta sul contenitore', () => {
    mostra();
    // Lo scopo: agnellino, Montone e le quattro pecore
    const scopo = pannelloDi(titolo('Lo scopo'));
    // (le pecore hanno il nome nella didascalia: lo dice lei, il disegno tace)
    const figureScopo = regole(null)[0]!.blocchi.flatMap((b) => b.figure);
    const attesi = figureScopo.filter((f) => !f.didascalia?.startsWith(testoAlternativo(f.disegno))).map((f) => testoAlternativo(f.disegno));
    expect(attesi).toEqual([T.regole.alternativi.agnellino, T.regole.alternativi.montone]);
    expect([...scopo.querySelectorAll('[role="img"]')].map((e) => e.getAttribute('aria-label'))).toEqual(attesi);
    const pecore = figureScopo.filter((f) => f.disegno.tipo === 'pecora');
    expect(pecore).toHaveLength(4);
    expect(scopo.querySelectorAll('figure.di-pecora .figura-disegno[aria-hidden="true"]')).toHaveLength(4);
    expect([...scopo.querySelectorAll('figure.di-pecora figcaption')].map((e) => e.textContent)).toEqual(pecore.map((f) => f.didascalia));
    // Le didascalie stanno sotto la figura
    expect(scopo.querySelector('figure figcaption')?.textContent).toBe(regole(null)[0]!.blocchi[2]!.figure[0]!.didascalia);
    fireEvent.click(titolo('Il dado'));
    const recinto = pannelloDi(titolo('Il dado')).querySelector('svg.recinto-zone')!;
    expect(recinto.getAttribute('aria-hidden')).toBe('true');
    const contenitore = recinto.closest('[role="img"]')!;
    expect(contenitore.getAttribute('aria-label')).toBe(testoAlternativo({ tipo: 'recinto' }));
  });

  it('i lettori di schermo non sentono un nome due volte: testo alternativo e didascalia uguali, uno dei due è nascosto', async () => {
    mostra({ nomi: ['Ada', 'Bea', 'Cleo'] });
    for (const t of titoli()) if (t.getAttribute('aria-expanded') === 'false') fireEvent.click(t);
    await attendi();
    const nascosto = (e: Element) => !!e.closest('[aria-hidden="true"]');
    const norma = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
    const figure = [...document.querySelectorAll('main.regole figure')];
    expect(figure.length).toBeGreaterThan(20);
    const doppi: string[] = [];
    let conDidascalia = 0;
    for (const f of figure) {
      const didascalia = f.querySelector('figcaption');
      if (!didascalia) continue;
      conDidascalia++;
      const detti = [
        ...[...f.querySelectorAll('[role="img"]')].filter((e) => !nascosto(e)).map((e) => e.getAttribute('aria-label') ?? ''),
        ...(nascosto(didascalia) ? [] : [didascalia.textContent ?? '']),
      ].map(norma);
      // Si sente sempre qualcosa
      expect(detti.length, f.outerHTML.slice(0, 120)).toBeGreaterThan(0);
      for (const [i, a] of detti.entries()) for (const [j, b] of detti.entries()) if (i !== j && b.includes(a)) doppi.push(`${a} | ${b}`);
    }
    expect(conDidascalia).toBeGreaterThan(0);
    expect(doppi).toEqual([]);
  });

  it('le file con più di 2 figure si raggiungono con Tab e hanno un nome; con 1 o 2 figure niente fila', () => {
    mostra();
    for (const t of titoli()) if (t.getAttribute('aria-expanded') === 'false') fireEvent.click(t);
    const blocchi = regole(null).flatMap((s) => s.blocchi);
    const file = [...document.querySelectorAll<HTMLElement>('.figure-fila')];
    expect(file).toHaveLength(blocchi.filter((b) => b.figure.length > 2).length);
    for (const f of file) {
      expect(f.tabIndex).toBe(0);
      expect(f.getAttribute('role')).toBe('group');
      expect(f.getAttribute('aria-label')).toBe(T.regole.figure(f.querySelectorAll('figure').length));
    }
    const piccole = [...document.querySelectorAll<HTMLElement>('.figure-accanto')];
    expect(piccole).toHaveLength(blocchi.filter((b) => b.figure.length > 0 && b.figure.length <= 2).length);
    for (const f of piccole) expect(f.querySelectorAll('figure').length).toBeLessThanOrEqual(2);
  });

  it('in "Come finisce la partita" le parole d\'apertura sono in grassetto, nello stesso paragrafo del testo', () => {
    mostra();
    fireEvent.click(titolo('Come finisce la partita'));
    const p = [...pannelloDi(titolo('Come finisce la partita')).querySelectorAll('p')];
    const blocchi = regole(null).find((s) => s.id === 'fine')!.blocchi;
    expect(p).toHaveLength(blocchi.length);
    p.forEach((el, i) => {
      expect(el.querySelector('strong')?.textContent).toBe(blocchi[i]!.forte);
      expect(el.textContent).toBe(`${blocchi[i]!.forte} ${blocchi[i]!.testo}`);
    });
    // Nelle altre sezioni niente grassetto
    fireEvent.click(titolo('Tre esempi'));
    expect(pannelloDi(titolo('Tre esempi')).querySelector('strong')).toBeNull();
  });

  it('due carte stanno affiancate sopra il testo; le altre coppie e le figure sole restano accanto', () => {
    mostra();
    for (const t of titoli()) if (t.getAttribute('aria-expanded') === 'false') fireEvent.click(t);
    const blocchi = regole(null).flatMap((s) => s.blocchi);
    const dueCarte = blocchi.filter((b) => b.figure.length === 2 && b.figure.every((f) => f.disegno.tipo === 'carta'));
    expect(dueCarte.length).toBeGreaterThan(0);
    const sopra = [...document.querySelectorAll<HTMLElement>('.regole-blocco.figure-sopra')];
    expect(sopra).toHaveLength(dueCarte.length);
    for (const b of sopra) expect(b.querySelectorAll(':scope > .figure-accanto > figure.di-carta')).toHaveLength(2);
    // Agnellino e Montone dello scopo restano accanto al testo
    expect(pannelloDi(titolo('Lo scopo')).querySelector('.figure-sopra')).toBeNull();
    const css = readFileSync(resolve(process.cwd(), 'client/src/stile.css'), 'utf8');
    expect(css).toMatch(/\.regole-blocco\.figure-sopra \{[^}]*grid-template-columns: minmax\(0, 1fr\);/);
    expect(css).toMatch(/\.figure-sopra > \.figure-accanto \{[^}]*grid-auto-flow: column;/);
    // Il numero dei passi del round all'altezza della prima riga del testo, non in fondo al disegno
    expect(css).toMatch(/\.regole-passi \.regole-blocco\.con-figure > p \{\s*align-self: first baseline;/);
  });

  it('i nomi dei giocatori negli esempi sono solo testo', () => {
    mostra({ nomi: ['Wwwwwwwwwwwwwwww', '<b>Ugo</b>'] });
    fireEvent.click(titolo('Tre esempi'));
    const p = pannelloDi(titolo('Tre esempi'));
    expect(p.textContent).toContain('Wwwwwwwwwwwwwwww');
    expect(p.textContent).toContain('<b>Ugo</b>');
    expect(document.querySelector('main.regole b')).toBeNull();
  });
});

describe('Regole: animazioni fuori dallo schermo', () => {
  /** Un IntersectionObserver finto: tiene chi osserva, e la prova decide se è in vista. */
  const osservatori: { cb: IntersectionObserverCallback; osservati: Set<Element>; staccato: boolean }[] = [];
  beforeEach(() => {
    osservatori.length = 0;
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        o: (typeof osservatori)[number];
        constructor(cb: IntersectionObserverCallback) {
          this.o = { cb, osservati: new Set(), staccato: false };
          osservatori.push(this.o);
        }
        observe(e: Element) {
          this.o.osservati.add(e);
        }
        unobserve(e: Element) {
          this.o.osservati.delete(e);
        }
        disconnect() {
          this.o.staccato = true;
          this.o.osservati.clear();
        }
      },
    );
  });
  const vedi = (el: Element, inVista: boolean) => {
    const o = osservatori.find((x) => x.osservati.has(el))!;
    act(() => o.cb([{ target: el, isIntersecting: inVista } as unknown as IntersectionObserverEntry], {} as IntersectionObserver));
  };

  it('ogni carta fuori dallo schermo prende "fuori-vista" (le altre del pannello no), e lo perde quando torna in vista', async () => {
    mostra();
    const osservata = (e: Element) => osservatori.some((o) => o.osservati.has(e));
    // Si osservano le carte, non i pannelli né gli altri disegni
    expect(osservata(pannelloDi(titolo('Lo scopo')))).toBe(false);
    expect([...pannelloDi(titolo('Lo scopo')).querySelectorAll('figure')].some(osservata)).toBe(false);
    fireEvent.click(titolo('Le carte'));
    await attendi();
    const p = pannelloDi(titolo('Le carte'));
    expect(osservata(p)).toBe(false);
    const carte = [...p.querySelectorAll('figure.di-carta')];
    expect(carte).toHaveLength(13);
    expect(carte.every(osservata)).toBe(true);
    const [prima, seconda] = carte as [Element, Element];
    vedi(prima, false);
    expect(prima.classList.contains('fuori-vista')).toBe(true);
    expect(seconda.classList.contains('fuori-vista')).toBe(false);
    vedi(prima, true);
    expect(prima.classList.contains('fuori-vista')).toBe(false);
    // Chiuso il pannello, non si osserva più niente
    fireEvent.click(titolo('Le carte'));
    expect(carte.some(osservata)).toBe(false);
  });

  it('in stile.css le animazioni delle carte fuori vista sono in pausa, e la vecchia legenda non c\'è più', () => {
    const css = readFileSync(resolve(process.cwd(), 'client/src/stile.css'), 'utf8');
    expect(css).toMatch(/\.regole \.fuori-vista \.anima \.an \{\s*animation-play-state: paused;\s*\}/);
    expect(css).not.toContain('.legenda');
    // Tab non lascia il punto della tastiera sotto l'Indietro, nemmeno sopra la barra Home dell'iPhone
    expect(css).toMatch(/html:has\(\.regole\) \{[^}]*scroll-padding-bottom: calc\([^;]*max\(var\(--spazio-3\), env\(safe-area-inset-bottom\)\)[^;]*\);/);
    // L'Indietro fisso in fondo e le parole lunghe che vanno a capo
    expect(css).toMatch(/\.regole-fondo \{[^}]*position: sticky;[^}]*bottom: 0;/);
    expect(css).toMatch(/\.regole \{[^}]*overflow-wrap: anywhere;/);
    expect(css).toMatch(/\.figure-fila \{[^}]*overflow-x: auto;/);
  });
});

describe('Regole: Indietro e la stanza', () => {
  it('"Indietro" chiama onIndietro', () => {
    const onIndietro = mostra();
    fireEvent.click(screen.getByRole('button', { name: T.regole.indietro }));
    expect(onIndietro).toHaveBeenCalledTimes(1);
  });

  it("con inStanza c'è la riga che la partita va avanti, senza no", () => {
    mostra({ inStanza: true });
    // In cima, prima del titolo: è il posto che il richiamo prende quando arriva (compito 4)
    expect(document.querySelector('main.regole > .regole-stanza:first-child + h1')).not.toBeNull();
    expect(document.querySelector('main.regole > .regole-stanza')?.textContent).toBe(T.regole.stanzaVaAvanti);
    cleanup();
    mostra();
    expect(document.querySelector('.regole-stanza')).toBeNull();
    expect(document.body.textContent).not.toContain(T.regole.stanzaVaAvanti);
  });

  it('con il richiamo compare in cima un avviso che riporta alla partita; senza, niente', () => {
    const onIndietro = mostra({ inStanza: true, richiamo: true });
    const avviso = screen.getByRole('alert');
    expect(avviso.textContent).toContain(T.regole.richiamo);
    // In cima: prima del titolo e delle sezioni
    expect(avviso.compareDocumentPosition(document.querySelector('main.regole h1')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: T.regole.tornaAllaPartita }));
    expect(onIndietro).toHaveBeenCalledTimes(1);
    cleanup();
    mostra({ inStanza: true });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('button', { name: T.regole.tornaAllaPartita })).toBeNull();
  });

  it("in sala d'attesa (riservaStanza) il posto della riga è già tenuto, vuoto e muto: quando la partita comincia il testo non si sposta", () => {
    mostra({ riservaStanza: true });
    const posto = document.querySelector('main.regole > .regole-stanza:first-child');
    expect(posto).not.toBeNull();
    expect(posto!.nextElementSibling?.tagName).toBe('H1');
    expect(posto!.textContent).toBe('');
    expect(posto!.getAttribute('aria-hidden')).toBe('true');
    expect(posto!.classList.contains('regole-riserva')).toBe(true);
    cleanup();
    // Comincia la partita: la riga prende quel posto
    mostra({ riservaStanza: true, inStanza: true });
    expect(document.querySelector('main.regole > .regole-stanza:first-child')?.textContent).toBe(T.regole.stanzaVaAvanti);
    expect(document.querySelectorAll('.regole-stanza')).toHaveLength(1);
    cleanup();
    // Fuori da una stanza, niente
    mostra();
    expect(document.querySelector('.regole-stanza')).toBeNull();
  });

  it('la riga e il richiamo possono dire altro (lo stato della stanza), allo stesso posto', () => {
    mostra({ inStanza: true, rigaStanza: 'Riga di prova.' });
    expect(document.querySelector('main.regole > .regole-stanza:first-child')?.textContent).toBe('Riga di prova.');
    cleanup();
    mostra({ inStanza: true, richiamo: true, testoRichiamo: 'Richiamo di prova.' });
    expect(screen.getByRole('alert').textContent).toContain('Richiamo di prova.');
    expect(screen.getByRole('alert').textContent).not.toContain(T.regole.richiamo);
  });

  it('il richiamo prende il posto della riga della stanza: stessa altezza riservata, il testo sotto non si sposta', () => {
    mostra({ inStanza: true, richiamo: true });
    // Al posto della riga, non in più
    expect(document.querySelector('.regole-stanza')).toBeNull();
    expect(document.querySelector('main.regole > .regole-richiamo:first-child + h1')).not.toBeNull();
    const css = readFileSync(resolve(process.cwd(), 'client/src/stile.css'), 'utf8');
    // Riga e richiamo occupano la stessa altezza (una sola misura per tutti e due)
    expect(css).toMatch(/html:has\(\.regole\) \{[^}]*--richiamo-altezza: calc\(/);
    expect(css).toMatch(/\.regole-stanza,\s*\.regole-richiamo \{[^}]*box-sizing: border-box;[^}]*min-height: var\(--richiamo-altezza\);/);
    expect(css).toMatch(/\.regole-richiamo \{[^}]*position: sticky;/);
    // Un titolo raggiunto con Maiusc+Tab non resta sotto il richiamo
    expect(css).toMatch(/html:has\(\.regole-richiamo\) \{[^}]*scroll-padding-top: calc\(var\(--richiamo-altezza\)/);
  });
});
