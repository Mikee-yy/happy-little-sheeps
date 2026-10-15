// Targhe con nomi lunghi: in jsdom non ci sono misure reali, quindi si prova la geometria calcolata dalle disposizioni.
// Per ogni larghezza possibile della targa (da corta fino alla massima del posto) la targa sta dentro la scena con 4 px
// di margine, non tocca le targhe vicine e non va sopra le pecore degli altri avversari della stessa fila.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { disposizione } from '../disposizioni';
import { LARGHEZZA_SCENA, MARGINE, nomeLungo, scostamento, spaziTarghe, stileSegnalini, stileTarga } from './targhe';

type Scatola = [number, number];

const NUMERI = [2, 3, 4] as const;
const LARGHEZZE = (massima: number): number[] => {
  const v: number[] = [];
  for (let w = 20; w < massima; w += 7) v.push(w);
  v.push(massima);
  return v;
};
const scatola = (x: number, scost: number, w: number): Scatola => [x + scost, x + scost + w];
const tocca = (a: Scatola, b: Scatola): boolean => a[0] < b[1] && b[0] < a[1];

describe('spazio delle targhe', () => {
  for (const n of NUMERI) {
    it(`${n} giocatori: ogni targa, larga quanto si voglia fino al massimo, sta dentro la scena con ${MARGINE} px di margine`, () => {
      const disp = disposizione(n);
      const spazi = spaziTarghe(disp);
      expect(spazi).toHaveLength(disp.posti.length);
      spazi.forEach((s, i) => {
        expect(s.x).toBe(disp.posti[i]!.targa[0]);
        expect(s.sinistra).toBeGreaterThanOrEqual(MARGINE);
        expect(s.destra).toBeLessThanOrEqual(LARGHEZZA_SCENA - MARGINE);
        expect(s.larghezza).toBeLessThanOrEqual(s.destra - s.sinistra);
        expect(s.larghezza).toBeGreaterThanOrEqual(80);
        for (const w of LARGHEZZE(s.larghezza)) {
          const [a, b] = scatola(s.x, scostamento(s, w), w);
          expect(a).toBeGreaterThanOrEqual(MARGINE);
          expect(b).toBeLessThanOrEqual(LARGHEZZA_SCENA - MARGINE);
        }
      });
    });

    it(`${n} giocatori: le targhe della stessa fila non si toccano e non vanno sopra le pecore degli altri`, () => {
      const disp = disposizione(n);
      const spazi = spaziTarghe(disp);
      spazi.forEach((s, i) => {
        spazi.forEach((t, j) => {
          if (i === j) return;
          const stessaFila = Math.abs(disp.posti[i]!.targa[1] - disp.posti[j]!.targa[1]) < 40;
          if (!stessaFila) return;
          const pecora: Scatola = [disp.posti[j]!.x, disp.posti[j]!.x + disp.posti[j]!.w];
          for (const w of LARGHEZZE(s.larghezza)) {
            const mia = scatola(s.x, scostamento(s, w), w);
            expect(tocca(mia, pecora)).toBe(false);
            for (const v of LARGHEZZE(t.larghezza)) expect(tocca(mia, scatola(t.x, scostamento(t, v), v))).toBe(false);
          }
        });
      });
    });

    it(`${n} giocatori: una targa corta resta centrata sul suo posto quando c'è spazio`, () => {
      const disp = disposizione(n);
      for (const s of spaziTarghe(disp)) {
        const w = 40;
        if (s.x - w / 2 >= s.sinistra && s.x + w / 2 <= s.destra) expect(scostamento(s, w)).toBe(-w / 2);
      }
    });
  }

  it('lo stile riproduce lo scostamento con clamp() e mette la larghezza massima', () => {
    const s = { x: 27, sinistra: 4, destra: 89, larghezza: 85 };
    const stile = stileTarga(s);
    expect(stile).toContain('left:27px');
    expect(stile).toContain('max-width:85px');
    expect(stile).toMatch(/translateX\(clamp\(-23px, -50%, calc\(62px - 100%\)\)\)/);
  });

  it('il carattere piccolo dipende dalla fascia: solo se il nome non ci sta col carattere normale', () => {
    expect(nomeLungo('Anna', 85)).toBe(false);
    expect(nomeLungo('Massimo', 85)).toBe(false);
    expect(nomeLungo('Bartolomeo', 112)).toBe(false);
    expect(nomeLungo('Bartolomeo', 85)).toBe(true);
    expect(nomeLungo('Giocatore 2', 112)).toBe(true);
    expect(nomeLungo('Massimilianone', 112)).toBe(true);
  });

  it('i segnalini sono larghi quanto la loro scritta (fino alla fascia): non si restringono in colonne strette', () => {
    const css = readFileSync(resolve(process.cwd(), 'client/src/scena/scena.css'), 'utf8');
    expect(css).toMatch(/\.teatro \.segnalini \{[^}]*width:\s*max-content/);
    // Il clamp() usa la larghezza dei segnalini stessi: con max-content e max-width restano dentro la fascia
    expect(stileSegnalini({ x: 363, sinistra: 263, destra: 386, larghezza: 112 })).toContain('max-width:112px');
  });
});
