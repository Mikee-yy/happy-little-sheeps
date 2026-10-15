import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { H, W } from './misure';
import { conSostituzioni, disposizione, usaVariante, type Disposizione, type Rett, type Variante } from './disposizioni';
import varianti from './sviluppo/varianti.json';

const dentroSchermo = (x: number, y: number) => x >= 0 && x <= W && y >= 0 && y <= H;
const rettDentro = (r: Rett) => dentroSchermo(r[0], r[1]) && dentroSchermo(r[2], r[3]);
const sovrapposte = (a: Rett, b: Rett) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
/** Rettangolo del recinto: x, yDietro, larghezza, yDavanti → x0, y0, x1, y1. */
const rettRecinto = (r: [number, number, number, number, number]): Rett => [r[0], r[1], r[0] + r[3], r[2]];

/** Le prove di geometria che ogni disposizione (base o variante) deve passare. */
function proveGeometria(n: 2 | 3 | 4, d: Disposizione) {
    it('ha un posto per giocatore', () => {
      expect(d.posti.length).toBe(n);
    });

    it('aree, recinti, targhe e tappetini stanno nello schermo', () => {
      for (const p of d.posti) {
        expect(rettDentro(p.area)).toBe(true);
        expect(rettDentro(rettRecinto(p.recinto))).toBe(true);
        expect(dentroSchermo(p.targa[0], p.targa[1])).toBe(true);
        expect(dentroSchermo(p.guai[0], p.guai[1])).toBe(true);
        if (p.tappetino) {
          const [x, y, w, h] = p.tappetino;
          // Il tappetino può sporgere un poco a sinistra (come nella bozza), ma il centro resta dentro
          expect(dentroSchermo(x + w / 2, y + h / 2)).toBe(true);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(y + h).toBeLessThanOrEqual(H);
        }
      }
      expect(rettDentro(d.gregge.area)).toBe(true);
    });

    it('le aree dei recinti non si sovrappongono tra loro né con il gregge', () => {
      const aree = d.posti.map((p) => p.area);
      for (let i = 0; i < aree.length; i++) {
        expect(sovrapposte(aree[i] as Rett, d.gregge.area)).toBe(false);
        for (let j = i + 1; j < aree.length; j++) expect(sovrapposte(aree[i] as Rett, aree[j] as Rett)).toBe(false);
      }
    });

    it('ha le zone libere da piante e la prospettiva', () => {
      expect(d.liberoDaPiante.length).toBeGreaterThan(0);
      expect(d.prospettiva.length).toBe(2);
    });

    it('il posto 0 è quello in basso, con i guai a [10, 626]', () => {
      const io = d.posti[0]!;
      expect(io.x).toBe(2);
      expect(io.y).toBe(524);
      expect(io.recinto).toEqual([140, 516, 640, 246, 1]);
      expect(io.guai).toEqual([10, 626]);
      expect(io.tappetino).toBeUndefined();
    });

    it('ogni recinto contiene la sua area e il tappetino non lo copre', () => {
      for (const p of d.posti) {
        const r = rettRecinto(p.recinto);
        expect(p.area[0]).toBeGreaterThanOrEqual(r[0]);
        expect(p.area[1]).toBeGreaterThanOrEqual(r[1]);
        expect(p.area[2]).toBeLessThanOrEqual(r[2]);
        expect(p.area[3]).toBeLessThanOrEqual(r[3]);
        if (p.tappetino) {
          const [x, y, w, h] = p.tappetino;
          expect(sovrapposte([x, y, x + w, y + h], r)).toBe(false);
        }
      }
    });
}

for (const n of [2, 3, 4] as const) {
  describe(`disposizione(${n})`, () => {
    proveGeometria(n, disposizione(n));
  });
}

// Varianti dei recinti della pagina di sviluppo (compito 10): ognuna passa le stesse prove della base
const VARIANTI = varianti as unknown as Record<string, Variante>;
describe('varianti dei recinti', () => {
  afterEach(() => usaVariante(null));

  it('ci sono le varianti A e B, per 3 e 4 giocatori', () => {
    expect(Object.keys(VARIANTI)).toEqual(['A', 'B']);
    for (const v of Object.values(VARIANTI)) {
      expect(v.nome.length).toBeGreaterThan(0);
      expect(v['3']).toBeDefined();
      expect(v['4']).toBeDefined();
    }
  });

  it('usaVariante cambia ciò che disposizione restituisce, sempre lo stesso oggetto finché non cambia', () => {
    const base = disposizione(3);
    usaVariante(VARIANTI.A!);
    const a = disposizione(3);
    expect(a).not.toBe(base);
    expect(disposizione(3)).toBe(a);
    // Senza sostituzioni per 2 giocatori resta la base
    usaVariante(null);
    const base2 = disposizione(2);
    usaVariante(VARIANTI.A!);
    expect(disposizione(2)).toEqual(base2);
    usaVariante(null);
    expect(disposizione(3)).toBe(base);
  });

  it('le sostituzioni parziali non toccano la base', () => {
    const prima = JSON.stringify(disposizione(4));
    const a = conSostituzioni(disposizione(4), VARIANTI.A!['4']!);
    expect(JSON.stringify(disposizione(4))).toBe(prima);
    // Ciò che la variante non dice resta com'era
    expect(a.posti[0]).toEqual(disposizione(4).posti[0]);
    expect(a.posti[1]!.targa).toEqual(disposizione(4).posti[1]!.targa);
    expect(a.prospettiva).toEqual(disposizione(4).prospettiva);
  });

  for (const n of [3, 4] as const) {
    describe(`A, recinti più profondi (${n} giocatori)`, () => {
      const base = disposizione(n);
      const d = conSostituzioni(base, VARIANTI.A![String(n) as '3' | '4']!);
      proveGeometria(n, d);
      it('recinti e aree degli avversari più alti verso il basso; il gregge scende e si stringe', () => {
        for (let i = 1; i < n; i++) {
          expect(d.posti[i]!.recinto[2]).toBeGreaterThan(base.posti[i]!.recinto[2]);
          expect(d.posti[i]!.area[3]).toBeGreaterThan(base.posti[i]!.area[3]);
          expect(d.posti[i]!.area[1]).toBe(base.posti[i]!.area[1]);
        }
        expect(d.gregge.area[1]).toBeGreaterThan(base.gregge.area[1]);
        expect(d.gregge.area[2] - d.gregge.area[0]).toBeLessThan(base.gregge.area[2] - base.gregge.area[0]);
      });
    });

    describe(`B, agnellini più piccoli lontano (${n} giocatori)`, () => {
      const base = disposizione(n);
      const d = conSostituzioni(base, VARIANTI.B![String(n) as '3' | '4']!);
      proveGeometria(n, d);
      it('prospettiva con k0 più basso del 15%, il resto uguale', () => {
        expect(d.prospettiva[0]).toBe(base.prospettiva[0]);
        expect(d.prospettiva[1]).toBeCloseTo(base.prospettiva[1] * 0.85, 6);
        expect(d.posti).toEqual(base.posti);
        expect(d.gregge).toEqual(base.gregge);
      });
    });
  }
});

describe('confronto con la bozza', () => {
  // Estrae il letterale DISPOSIZIONI da bozze/scena/scena.src.html e lo valuta
  const testo = readFileSync(resolve(process.cwd(), 'bozze/scena/scena.src.html'), 'utf8');
  const inizio = testo.indexOf('const DISPOSIZIONI = {');
  const fine = testo.indexOf('\n};', inizio);
  const bozza = new Function(`return (${testo.slice(inizio + 'const DISPOSIZIONI = '.length, fine + 2)});`)().verticale;
  const GEOMETRIA = ['x', 'y', 'w', 'targa', 'fumetto', 'recinto', 'area', 'tappetino', 'ventaglio', 'guai', 'specchia'] as const;

  for (const n of [2, 3, 4] as const) {
    it(`n=${n}: posti, gregge, liberoDaPiante e prospettiva coincidono`, () => {
      const d = disposizione(n);
      const attesi = [{ ...bozza.io, guai: [10, 626] }, ...bozza[n].avversari];
      expect(d.posti.length).toBe(attesi.length);
      attesi.forEach((a: Record<string, unknown>, i: number) => {
        const p = d.posti[i] as unknown as Record<string, unknown>;
        for (const k of GEOMETRIA) expect(p[k], `posto ${i}, ${k}`).toEqual(a[k]);
      });
      expect(d.gregge).toEqual(bozza[n].gregge);
      expect(d.liberoDaPiante).toEqual(bozza[n].liberoDaPiante);
      expect(d.prospettiva).toEqual(bozza[n].prospettiva);
    });
  }
});

describe('valori della bozza', () => {
  it('3 giocatori: posto 2 specchiato con il recinto di Leo', () => {
    const p = disposizione(3).posti[2]!;
    expect(p.recinto).toEqual([206, 146, 184, 94, 0.62]);
    expect(p.specchia).toBe(true);
    expect(disposizione(3).posti[1]!.specchia).toBeUndefined();
  });
  it('2 giocatori: Bea con tappetino e ventaglio', () => {
    const p = disposizione(2).posti[1]!;
    expect(p.tappetino).toEqual([14, 188, 116, 48]);
    expect(p.ventaglio).toEqual([46, 232]);
    expect(p.fumetto).toEqual([70, 86]);
    expect(disposizione(2).gregge.cartello).toEqual([259, 187]);
  });
  it('4 giocatori: gregge e prospettiva', () => {
    const d = disposizione(4);
    expect(d.gregge.area).toEqual([26, 200, 364, 246]);
    expect(d.prospettiva).toEqual([138, 50 / 124]);
    expect(d.liberoDaPiante).toEqual([[0, 78, 390, 254]]);
    expect(d.posti[3]!.specchia).toBe(true);
  });
  it('i posti non portano dati della partita', () => {
    for (const n of [2, 3, 4] as const) {
      for (const p of disposizione(n).posti) {
        for (const k of ['id', 'nome', 'pecora', 'agnelli', 'mano', 'angolo']) expect(k in p).toBe(false);
      }
    }
  });
});
