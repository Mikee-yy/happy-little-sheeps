// Prato vivo: piante che si piegano al vento (bozza scena.src.html, righe 725–847).
// Oggi si pianta solo il ciuffo d'erba (il prato deve restare uno sfondo calmo); gli altri tipi restano pronti per dopo.
import type { Contesto } from '../contesto';
import type { Disposizione, Rett } from '../disposizioni';
import { TAVOLOZZA as P } from './paesaggio';

interface FiloErba {
  bx: number;
  h: number;
  inclina: number;
  morbido: number;
}

export interface Pianta {
  i: number;
  x: number;
  y: number;
  k: number;
  tipo: string;
  flex: number;
  h: number;
  petali?: string;
  semi: number;
  fili?: FiloErba[];
  el: SVGGElement | null;
  testa: SVGElement | null;
  tratto: SVGPathElement | null;
  ph: number;
}

/** Quello che la flora chiede al cielo: vento, raffica e gelo dell'erba. */
export interface FonteVento {
  ventoIn(x: number): number;
  raffica(): { fronte: number; forza: number } | null;
  geloErba(): number;
}

/** Quello che la flora chiede alle particelle. */
export interface FontePolvere {
  particella(tipo: string, x: number, y: number, o?: Record<string, unknown>): unknown;
  conta(): number;
  limite(): number;
}

// Zone libere da piante: avversari, recinti, gregge, coperta, la tua pecora, il tuo Ovile e la mano
const VIETATI_IO: Rett[] = [[0, 512, 138, 634], [124, 488, 396, 658], [0, 610, 148, 692], [22, 700, 368, 900]];

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const scalaPianta = (y: number) => 0.8 + ((y - 190) / 654) * 0.4;

/** Generatore a seme (mulberry32): la flora è sempre la stessa, indipendente da `ctx.caso`. */
function rng(seme: number): () => number {
  return () => {
    seme |= 0;
    seme = (seme + 0x6d2b79f5) | 0;
    let t = Math.imul(seme ^ (seme >>> 15), 1 | seme);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface DisegnoPianta {
  s: string;
  flex: number;
  h: number;
  petali?: string;
  semi?: number;
  fili?: FiloErba[];
}

function pianta(tipo: string, caso: () => number): DisegnoPianta {
  const N = P.notte;
  const r = (a: number, b: number) => a + caso() * (b - a);
  const stelo = (h: number, c: number) => `<path d="M0 0 Q${c} ${-h / 2} 0 ${-h}" fill="none" stroke="${N}" stroke-width="1.6" stroke-linecap="round"/>`;
  const fili = (n: number, hMin: number, hMax: number) => {
    let s = `<g style="fill:var(--erba)" stroke="${N}" stroke-width="1.3" stroke-linejoin="round">`;
    for (let i = 0; i < n; i++) {
      const h = r(hMin, hMax), a = (i - (n - 1) / 2) * 15 + r(-5, 5);
      s += `<path d="M-2 0 Q-2.4 ${(-h * 0.55).toFixed(1)} ${r(-3, 3).toFixed(1)} ${(-h).toFixed(1)} Q1.4 ${(-h * 0.5).toFixed(1)} 2 0 Z" transform="rotate(${a.toFixed(1)})"/>`;
    }
    return s + '</g>';
  };
  switch (tipo) {
    case 'ciuffo': {
      // Tratto sottile e semitrasparente, fatto di fili: la base resta piantata e al vento si piegano solo le punte.
      const n = 4 + Math.floor(r(0, 2));
      const f: FiloErba[] = [];
      for (let i = 0; i < n; i++) {
        const c = i - (n - 1) / 2;
        f.push({ bx: c * 2.2, h: r(11, 17) * (1 - Math.abs(c) * 0.12), inclina: c * 3.2 + r(-1.5, 1.5), morbido: r(0.8, 1.2) });
      }
      return { s: `<path fill="none" stroke="${N}" stroke-width="1.9" stroke-linecap="round" opacity=".55"/>`, flex: 1, h: 14, fili: f };
    }
    case 'erbaAlta':
      return { s: fili(4 + Math.floor(r(0, 3)), 16, 26), flex: 1.15, h: 22 };
    case 'margherita': {
      const h = r(10, 17);
      let p = '';
      for (let i = 0; i < 7; i++) p += `<ellipse cx="0" cy="-3.6" rx="1.8" ry="3.4" transform="rotate(${(i * 360) / 7})"/>`;
      return { s: stelo(h, r(-3, 3)) + `<g transform="translate(0 ${-h})"><g fill="${P.gesso}" stroke="${N}" stroke-width="1">${p}</g><circle r="2.2" fill="${P.limone}" stroke="${N}" stroke-width="1"/></g>`, flex: 0.9, h, petali: P.gesso };
    }
    case 'ranuncolo': {
      const h = r(8, 13);
      let p = '';
      for (let i = 0; i < 5; i++) p += `<circle cx="0" cy="-2.6" r="2.3" transform="rotate(${i * 72})"/>`;
      return { s: stelo(h, r(-2, 2)) + `<g transform="translate(0 ${-h})"><g fill="${P.limone}" stroke="${N}" stroke-width="1">${p}</g><circle r="1.3" fill="${P.albicocca}"/></g>`, flex: 0.9, h, petali: P.limone };
    }
    case 'campanula': {
      const h = r(12, 18);
      const campana = (x: number, y: number, a: number) =>
        `<path d="M-3.4 0 Q-3.4 -6 0 -6 Q3.4 -6 3.4 0 L4.4 1.6 L-4.4 1.6 Z" transform="translate(${x} ${y}) rotate(${a})" fill="${P.lilla}" stroke="${N}" stroke-width="1.1" stroke-linejoin="round"/>`;
      return { s: `<path d="M0 0 Q1 ${-h * 0.7} 5 ${-h}" fill="none" stroke="${N}" stroke-width="1.5" stroke-linecap="round"/>` + campana(6, -h + 6, 160) + campana(1.5, -h * 0.55 + 5, 200), flex: 0.9, h, petali: P.lilla };
    }
    case 'soffione': {
      const h = r(13, 19);
      let semi = '';
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        semi += `<path d="M0 0 L${(Math.cos(a) * 4.6).toFixed(1)} ${(Math.sin(a) * 4.6).toFixed(1)}"/>`;
      }
      return { s: stelo(h, r(-2, 2)) + `<g transform="translate(0 ${-h})" class="testa-soffione"><circle r="5.6" fill="${P.gesso}" stroke="${N}" stroke-width="1.1"/><g stroke="${N}" stroke-width="0.7" opacity=".55">${semi}</g><circle r="1.2" fill="${N}"/></g>`, flex: 0.8, h, semi: 6 };
    }
    case 'trifoglio': {
      const f = (a: number) => `<circle cx="0" cy="-3" r="2.7" transform="rotate(${a})"/>`;
      return { s: `<g transform="translate(0 -3)" style="fill:var(--erba)" stroke="${N}" stroke-width="1.1">${f(0)}${f(120)}${f(240)}</g>`, flex: 0.25, h: 6 };
    }
    case 'sasso': {
      const w = r(5, 9);
      return { s: `<ellipse cx="0" cy="-${(w * 0.45).toFixed(1)}" rx="${w.toFixed(1)}" ry="${(w * 0.55).toFixed(1)}" fill="${P.fango}" stroke="${N}" stroke-width="1.5"/><path d="M${(-w * 0.4).toFixed(1)} ${(-w * 0.6).toFixed(1)} q${(w * 0.3).toFixed(1)} -2 ${(w * 0.6).toFixed(1)} -1" fill="none" stroke="${P.gesso}" stroke-width="1.2" stroke-linecap="round"/>`, flex: 0, h: 5 };
    }
    default:
      return { s: `<rect x="-1.8" y="-6" width="3.6" height="6" rx="1.5" fill="${P.gesso}" stroke="${N}" stroke-width="1.1"/><path d="M-6 -5 Q-6 -11 0 -11 Q6 -11 6 -5 Z" fill="${P.albicocca}" stroke="${N}" stroke-width="1.2" stroke-linejoin="round"/><circle cx="-2.2" cy="-8" r="1" fill="${P.gesso}"/><circle cx="2" cy="-7" r="0.9" fill="${P.gesso}"/>`, flex: 0, h: 8 };
  }
}

export interface Flora {
  piante: Pianta[];
  /** Pianta di nuovo il prato rispettando le zone libere di quella disposizione. */
  ridisponi(disp: Disposizione): void;
  /** Aggiorna le piante (30 volte al secondo; 15 in modo leggero). */
  passo(dt: number): void;
  distruggi(): void;
}

export function creaFlora(ctx: Contesto, disp: Disposizione, vento: FonteVento, polvere: FontePolvere): Flora {
  const svg = ctx.el.flora;
  const piante: Pianta[] = [];
  let vietati: Rett[] = [];

  function libero(x: number, y: number): boolean {
    if (vietati.some(([a, b, c, d]) => x > a && x < c && y > b && y < d)) return false;
    if (y > 240 && y < 494) {
      const t = (y - 250) / 233, l = 73 + (22 - 73) * t, r = 321 + (374 - 321) * t;
      if (x > l - 12 && x < r + 12) return false;
    }
    return true;
  }

  function ridisponi(d: Disposizione): void {
    vietati = [...d.liberoDaPiante, ...VIETATI_IO];
    piante.length = 0;
    const caso = rng(29);
    const punti: Array<{ x: number; y: number }> = [];
    const prova = (x0: number, x1: number, quanti: number, tentativi: number) => {
      for (let i = 0; i < tentativi && quanti > 0; i++) {
        const x = x0 + caso() * (x1 - x0), y = 196 + Math.pow(caso(), 0.8) * 640;
        if (!libero(x, y)) continue;
        const k = scalaPianta(y);
        if (punti.some((p) => Math.hypot(p.x - x, (p.y - y) * 1.3) < 46 * k)) continue;
        punti.push({ x, y });
        quanti--;
      }
    };
    // Solo ciuffi d'erba, radi: il prato deve restare uno sfondo calmo
    prova(0, 390, 18, 6000);
    prova(-420, 0, 12, 1500);
    prova(390, 810, 12, 1500);
    punti.sort((a, b) => a.y - b.y);
    let s = '';
    punti.forEach((p, i) => {
      const tipo = 'ciuffo';
      const dis = pianta(tipo, caso), k = scalaPianta(p.y);
      s += `<g transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) scale(${k.toFixed(2)})"><g data-pianta="${i}">${dis.s}</g></g>`;
      piante.push({ i, x: p.x, y: p.y, k, tipo, flex: dis.flex, h: dis.h, petali: dis.petali, semi: dis.semi || 0, fili: dis.fili, el: null, testa: null, tratto: null, ph: caso() * 6.28 });
    });
    svg.innerHTML = s;
    for (const f of piante) {
      f.el = svg.querySelector<SVGGElement>(`[data-pianta="${f.i}"]`);
      if (!f.el) continue;
      if (f.tipo === 'soffione') f.testa = f.el.querySelector('.testa-soffione');
      if (f.fili) f.tratto = f.el.querySelector('path');
    }
  }

  function passo(dt: number): void {
    const gelo = vento.geloErba();
    for (const f of piante) {
      if (!f.flex) continue;
      const w = vento.ventoIn(f.x);
      if (f.fili && f.tratto) {
        // Ogni filo si curva: base ferma, punta spinta dal vento e un po' più bassa quando si piega
        let d = '';
        for (const fi of f.fili) {
          const spinta = clamp(w * 0.95 * fi.morbido + 0.07 * Math.sin(ctx.T * 1.8 + f.ph + fi.bx), -0.95, 0.95) * fi.h * (1 - gelo);
          const tx = fi.bx + fi.inclina + spinta, ty = -fi.h + Math.abs(spinta) * 0.38;
          const cx = fi.bx + fi.inclina * 0.35 + spinta * 0.25, cy = -fi.h * 0.55;
          d += `M${fi.bx.toFixed(1)} 0 Q${cx.toFixed(1)} ${cy.toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)}`;
        }
        f.tratto.setAttribute('d', d);
        continue;
      }
      if (!f.el) continue;
      const a = clamp(f.flex * (w * 42 + 2.4 * Math.sin(ctx.T * 1.7 + f.ph + f.x * 0.05)), -40, 40);
      f.el.setAttribute('transform', `rotate(${a.toFixed(1)})`);
      // Le raffiche strappano petali e semi
      if (w > 0.45 && f.x > -40 && f.x < 430 && polvere.conta() < polvere.limite()) {
        const cima = { x: f.x + Math.sin((a * Math.PI) / 180) * f.h * f.k, y: f.y - Math.cos((a * Math.PI) / 180) * f.h * f.k };
        if (f.petali && ctx.caso() < dt * 3.2 * w) polvere.particella('petalo', cima.x, cima.y, { colore: f.petali, k: f.k });
        if (f.tipo === 'soffione' && f.semi > 0 && ctx.caso() < dt * 4 * w) {
          polvere.particella('seme', cima.x, cima.y, { k: f.k });
          f.semi--;
          if (f.testa) f.testa.style.opacity = (0.35 + (f.semi / 6) * 0.65).toFixed(2);
        }
      }
      if (f.tipo === 'soffione' && f.semi < 6 && ctx.caso() < dt * 0.05) {
        f.semi++;
        if (f.testa) f.testa.style.opacity = (0.35 + (f.semi / 6) * 0.65).toFixed(2);
      }
    }
    // Ogni tanto una foglia si stacca dagli alberi lontani
    const raffica = vento.raffica();
    if (raffica && ctx.caso() < dt * 1.2) {
      const alberi: Array<[number, number]> = [[36, 92], [292, 86]];
      const albero = alberi[Math.floor(ctx.caso() * alberi.length)]!;
      if (Math.abs(albero[0] - raffica.fronte) < 120) polvere.particella('foglia', albero[0], albero[1], { k: 0.7 });
    }
  }

  ridisponi(disp);
  return {
    piante,
    ridisponi,
    passo,
    distruggi() {
      piante.length = 0;
      svg.innerHTML = '';
    },
  };
}
