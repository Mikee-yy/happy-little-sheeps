// Il minigioco della Testata sta tutto nello schermo: il cassetto diventa a tutta altezza sotto la striscia in cima e
// l'arena si rimpicciolisce all'altezza che resta. Le misure vere le guarda il controllore nel browser; qui si provano
// le regole dello stile e il passaggio dal punto toccato alle coordinate dell'arena quando l'arena è rimpicciolita.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { puntoArena } from './Testata';

const css = readFileSync(resolve(process.cwd(), 'client/src/stile.css'), 'utf8');
/** Il corpo della regola con quel selettore (esatto, anche se in un elenco di selettori separati da virgola). */
const regola = (selettore: string): string => {
  const senzaCommenti = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const [, elenco, corpo] of senzaCommenti.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    if (elenco!.split(',').some((s) => s.trim() === selettore)) return corpo!;
  }
  return '';
};

describe('Testata a tutto schermo', () => {
  it('il fondo della scena a tutta altezza parte sotto la striscia in cima', () => {
    const r = regola('.fondo-scena.a-tutta-altezza');
    expect(r).toMatch(/top:\s*var\(--spazio-alto/);
    expect(r).toMatch(/display:\s*flex/);
  });

  it('a tutta altezza il cassetto non scorre: niente altezza massima né barra di scorrimento', () => {
    const r = regola('.a-tutta-altezza .cassetto-contenuto');
    expect(r).toMatch(/max-height:\s*none/);
    expect(r).toMatch(/overflow:\s*hidden/);
  });

  it("a tutta altezza l'arena prende l'altezza che resta e mantiene le proporzioni", () => {
    const r = regola('.a-tutta-altezza .testata .arena');
    expect(r).toMatch(/flex:\s*1 1 0/);
    expect(r).toMatch(/min-height:\s*0/);
    expect(r).toMatch(/aspect-ratio:\s*360 \/ 440/);
  });

  it("nel riquadro sopra la scena: sotto la striscia fino in fondo, l'arena prende l'altezza che resta e mantiene le proporzioni", () => {
    const riquadro = regola('.riquadro-testata');
    expect(riquadro).toMatch(/position:\s*fixed/);
    expect(riquadro).toMatch(/top:\s*var\(--spazio-alto/);
    expect(riquadro).toMatch(/bottom:\s*0/);
    expect(riquadro).toMatch(/display:\s*flex/);
    const arena = regola('.riquadro-testata .testata .arena');
    expect(arena).toMatch(/flex:\s*1 1 0/);
    expect(arena).toMatch(/min-height:\s*0/);
    expect(arena).toMatch(/aspect-ratio:\s*360 \/ 440/);
    expect(regola('.riquadro-testata .pannello.testata')).toMatch(/flex:\s*1 1 0/);
  });
});

describe('dal punto toccato alle coordinate dell\'arena', () => {
  it('arena larga quanto il disegno: scala uniforme', () => {
    const r = { left: 10, top: 20, width: 180, height: 220 };
    expect(puntoArena(r, 10, 20)).toEqual({ x: 0, y: 0 });
    expect(puntoArena(r, 100, 130)).toEqual({ x: 180, y: 220 });
    expect(puntoArena(r, 190, 240)).toEqual({ x: 360, y: 440 });
  });

  it('arena più larga del disegno (il disegno sta al centro): si tolgono le bande ai lati', () => {
    // Alta 220 → disegno largo 180, centrato in 300: bande di 60 px
    const r = { left: 0, top: 0, width: 300, height: 220 };
    expect(puntoArena(r, 60, 0)).toEqual({ x: 0, y: 0 });
    expect(puntoArena(r, 150, 110)).toEqual({ x: 180, y: 220 });
    expect(puntoArena(r, 240, 220)).toEqual({ x: 360, y: 440 });
  });

  it('arena più alta del disegno: si tolgono le bande sopra e sotto', () => {
    const r = { left: 0, top: 0, width: 180, height: 300 };
    expect(puntoArena(r, 0, 40)).toEqual({ x: 0, y: 0 });
    expect(puntoArena(r, 180, 260)).toEqual({ x: 360, y: 440 });
  });

  it("fuori dal disegno si resta sul bordo; senza misure (jsdom) si mira al centro", () => {
    const r = { left: 0, top: 0, width: 300, height: 220 };
    expect(puntoArena(r, 0, -50)).toEqual({ x: 0, y: 0 });
    expect(puntoArena({ left: 0, top: 0, width: 0, height: 0 }, 10, 10)).toEqual({ x: 180, y: 220 });
  });
});
