import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { H, W } from './misure';
import { conSostituzioni, disposizione, usaVariante, type Disposizione, type Rett, type Sostituzioni, type Variante } from './disposizioni';
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

// Varianti dei recinti della pagina di sviluppo (compito 10): ognuna passa le stesse prove della base.
// La A (recinti più profondi) è stata scelta il 21 ottobre ed è diventata la base per 3 e 4 giocatori.
const VARIANTI = varianti as unknown as Record<string, Variante>;
describe('varianti dei recinti', () => {
  afterEach(() => usaVariante(null));

  it("c'è la variante B, per 3 e 4 giocatori", () => {
    expect(Object.keys(VARIANTI)).toEqual(['B']);
    for (const v of Object.values(VARIANTI)) {
      expect(v.nome.length).toBeGreaterThan(0);
      expect(v['3']).toBeDefined();
      expect(v['4']).toBeDefined();
    }
  });

  it('usaVariante cambia ciò che disposizione restituisce, sempre lo stesso oggetto finché non cambia', () => {
    const base = disposizione(3);
    usaVariante(VARIANTI.B!);
    const a = disposizione(3);
    expect(a).not.toBe(base);
    expect(disposizione(3)).toBe(a);
    // Senza sostituzioni per 2 giocatori resta la base
    usaVariante(null);
    const base2 = disposizione(2);
    usaVariante(VARIANTI.B!);
    expect(disposizione(2)).toEqual(base2);
    usaVariante(null);
    expect(disposizione(3)).toBe(base);
  });

  it('le sostituzioni parziali non toccano la base', () => {
    const prima = JSON.stringify(disposizione(4));
    const a = conSostituzioni(disposizione(4), VARIANTI.B!['4']!);
    expect(JSON.stringify(disposizione(4))).toBe(prima);
    // Ciò che la variante non dice resta com'era
    expect(a.posti[0]).toEqual(disposizione(4).posti[0]);
    expect(a.posti[1]!.targa).toEqual(disposizione(4).posti[1]!.targa);
    expect(a.prospettiva).not.toEqual(disposizione(4).prospettiva);
  });

  for (const n of [3, 4] as const) {
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

/** I valori della variante A (recinti più profondi), ora la base per 3 e 4 giocatori: sostituiscono quelli della bozza. */
const EX_A = {"3":{"posti":{"1":{"recinto":[90,146,200,94,0.62],"area":[98,152,176,196]},"2":{"recinto":[206,146,200,94,0.62],"area":[214,152,292,196]}},"gregge":{"area":[104,216,288,258],"evita":[[154,208,238,233]],"cartello":[196,197]},"liberoDaPiante":[[0,95,98,232],[292,95,390,232],[84,126,194,210],[196,126,310,210],[96,206,296,264]]},"4":{"posti":{"1":{"recinto":[56,108,154,70,0.5],"area":[63,114,120,150],"tappetino":[6,162,118,38],"ventaglio":[32,198],"guai":[62,166]},"2":{"recinto":[186,108,154,70,0.5],"area":[193,114,250,150],"tappetino":[136,162,118,38],"ventaglio":[162,198],"guai":[192,166]},"3":{"recinto":[264,108,154,70,0.5],"area":[271,114,328,150],"tappetino":[266,162,118,38],"ventaglio":[358,198],"guai":[278,166]}},"gregge":{"area":[44,214,346,258],"evita":[[156,210,234,236]],"cartello":[195,200]},"liberoDaPiante":[[0,78,390,268]]},"nome":"recinti più profondi"} as unknown as Record<'3' | '4', Sostituzioni>;

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
      // Per 3 e 4 giocatori la base ha i recinti più profondi della bozza (variante A scelta il 21 ottobre)
      const bz = n === 2 ? bozza[2] : conSostituzioni({ ...bozza[n], posti: [{ ...bozza.io, guai: [10, 626] }, ...bozza[n].avversari] }, EX_A[n]);
      const attesi = n === 2 ? [{ ...bozza.io, guai: [10, 626] }, ...bozza[2].avversari] : bz.posti;
      expect(d.posti.length).toBe(attesi.length);
      attesi.forEach((a: Record<string, unknown>, i: number) => {
        const p = d.posti[i] as unknown as Record<string, unknown>;
        for (const k of GEOMETRIA) expect(p[k], `posto ${i}, ${k}`).toEqual(a[k]);
      });
      expect(d.gregge).toEqual(bz.gregge);
      expect(d.liberoDaPiante).toEqual(bz.liberoDaPiante);
      expect(d.prospettiva).toEqual(bozza[n].prospettiva);
    });
  }
});

describe('recinti più profondi (ex variante A, ora la base)', () => {
  it('3 giocatori: recinto e area del posto 1, gregge', () => {
    const d = disposizione(3);
    expect(d.posti[1]!.recinto).toEqual([90, 146, 200, 94, 0.62]);
    expect(d.posti[1]!.area).toEqual([98, 152, 176, 196]);
    expect(d.gregge.cartello).toEqual([196, 197]);
  });
  it('4 giocatori: recinto, tappetino e guai del posto 1, gregge', () => {
    const d = disposizione(4);
    expect(d.posti[1]!.recinto).toEqual([56, 108, 154, 70, 0.5]);
    expect(d.posti[1]!.tappetino).toEqual([6, 162, 118, 38]);
    expect(d.posti[1]!.guai).toEqual([62, 166]);
    expect(d.gregge.cartello).toEqual([195, 200]);
  });
  it('la base è la bozza con le sostituzioni della ex variante A', () => {
    for (const n of [3, 4] as const) {
      const d = disposizione(n);
      const s = EX_A[n];
      for (const [i, p] of Object.entries(s.posti!)) {
        for (const [k, v] of Object.entries(p)) expect(d.posti[+i]![k as keyof typeof d.posti[number]], `n=${n} posto ${i} ${k}`).toEqual(v);
      }
      expect(d.gregge).toEqual(s.gregge);
      expect(d.liberoDaPiante).toEqual(s.liberoDaPiante);
    }
  });
});

describe('valori della bozza', () => {
  it('3 giocatori: posto 2 specchiato con il recinto di Leo', () => {
    const p = disposizione(3).posti[2]!;
    expect(p.recinto).toEqual([206, 146, 200, 94, 0.62]);
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
    expect(d.gregge.area).toEqual([44, 214, 346, 258]);
    expect(d.prospettiva).toEqual([138, 50 / 124]);
    expect(d.liberoDaPiante).toEqual([[0, 78, 390, 268]]);
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
