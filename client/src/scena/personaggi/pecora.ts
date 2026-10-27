// Pecore dei giocatori (bozza scena.src.html, righe 1549–1773): smontate in zampe, vello e testa per animarle sul posto.
// Reagiscono al tocco e agli eventi (`reagisci`), parlano con i fumetti, e il meteo le cambia (fulmine, brina, pioggia…).
// Differenze dalla bozza: il caso viene da `ctx.caso`, il tempo da `ctx.T`, e chi è eliminato resta in posa svenuta.
import type { IdGiocatore, IdPecora } from '../../../../engine/src';
import { TAVOLOZZA as P, GRIGIO_FUMO } from '../ambiente/paesaggio';
import type { Contesto } from '../contesto';
import type { PostoDisp } from '../disposizioni';
import { W } from '../misure';
import { ambienteMuto, type AmbienteAgnelli } from './agnello';
import { clamp } from './aree';

const NS = 'http://www.w3.org/2000/svg';

const tra = (q: number, a: number, b: number) => clamp((q - a) / (b - a), 0, 1);
const busta = (q: number, att = 0.2) => {
  const s = Math.min(tra(q, 0, att), tra(1 - q, 0, att));
  return s * s * (3 - 2 * s);
};

export type TipoReazione = 'salto' | 'paura' | 'scossa' | 'svenuta' | 'festa';
type TipoAzione = 'guarda' | 'bruca' | 'orecchie' | 'scuoti' | 'passo' | 'bela' | 'gira';

const DURATE_AZIONE: Record<TipoAzione, number> = { guarda: 2.4, bruca: 2.8, orecchie: 0.5, scuoti: 0.9, passo: 1.1, bela: 1.2, gira: 1.6 };
const AZIONI: TipoAzione[] = ['guarda', 'guarda', 'bruca', 'orecchie', 'orecchie', 'scuoti', 'passo', 'passo', 'bela', 'gira'];

/** La posa di chi è eliminato: sdraiata su un fianco (la fine dello "svenuta" della bozza, tenuta ferma). */
export const POSA_SVENUTA = 'rotate(-80deg) translateY(10px)';

const REAZIONI: Record<TipoReazione, { fotogrammi: Keyframe[]; durata: number }> = {
  salto: {
    fotogrammi: [{ transform: 'none' }, { transform: 'translateY(-14px) scale(.96,1.06)', offset: 0.35 }, { transform: 'translateY(0) scale(1.08,.9)', offset: 0.7 }, { transform: 'none' }],
    durata: 520,
  },
  paura: {
    fotogrammi: [
      { transform: 'none' },
      { transform: 'translate(-6px,-10px) rotate(-6deg)', offset: 0.2 },
      { transform: 'translate(6px,-4px) rotate(5deg)', offset: 0.4 },
      { transform: 'translate(-4px,0) rotate(-3deg)', offset: 0.6 },
      { transform: 'none' },
    ],
    durata: 700,
  },
  scossa: {
    fotogrammi: [{ transform: 'none' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(-3px)' }, { transform: 'none' }],
    durata: 420,
  },
  svenuta: {
    fotogrammi: [{ transform: 'none' }, { transform: POSA_SVENUTA, offset: 0.3 }, { transform: POSA_SVENUTA, offset: 0.75 }, { transform: 'none' }],
    durata: 1900,
  },
  festa: {
    fotogrammi: [
      { transform: 'none' },
      { transform: 'translateY(-22px) rotate(-8deg)', offset: 0.25 },
      { transform: 'none', offset: 0.5 },
      { transform: 'translateY(-22px) rotate(8deg)', offset: 0.75 },
      { transform: 'none' },
    ],
    durata: 1100,
  },
};

interface Zampa {
  el: SVGElement;
  x: number;
  y: number;
}
interface Lana {
  el: SVGElement;
  cx: number;
  cy: number;
  r: number;
  rx: number;
  ry: number;
  ph: number;
}
interface Testa {
  posa: SVGGElement;
  anima: SVGGElement;
  x: number;
  y: number;
  r: number;
  orecchie: Array<{ el: SVGElement; a: number; cx: number; cy: number }>;
  occhi: Array<{ el: SVGElement; cy: number }>;
}
interface Azione {
  tipo: TipoAzione;
  q: number;
  durata: number;
}

/** Disegno di ripiego quando lo sprite non è nella pagina (prove): zampe, vello e una testa vuota. */
function simboloDiRipiego(): Element {
  const d = document.createElement('div');
  d.innerHTML =
    '<svg><symbol viewBox="0 0 200 170">' +
    '<ellipse cx="100" cy="158" rx="62" ry="6"/>' +
    '<g><rect x="62" y="116" width="11" height="40"/><rect x="82" y="118" width="11" height="38"/><rect x="108" y="118" width="11" height="38"/><rect x="128" y="116" width="11" height="40"/></g>' +
    '<g style="stroke-width:8"><circle cx="64" cy="82" r="17"/><circle cx="94" cy="72" r="19"/><circle cx="126" cy="76" r="17"/><ellipse cx="98" cy="100" rx="54" ry="30"/></g>' +
    '<use href="#h-ripiego" transform="translate(156 58) rotate(-8)"/>' +
    '</symbol></svg>';
  return d.querySelector('symbol')!;
}

export class Pecora {
  readonly el: HTMLDivElement;
  readonly reazione: HTMLDivElement;
  readonly svg: SVGSVGElement;
  /** 1, oppure −1 se la pecora è specchiata (il vento per lei va al contrario). */
  readonly verso: 1 | -1;
  /**
   * −1 se adesso guarda dall'altra parte (si gira solo il disegno, con `gira`: l'ombra al sole e il vento restano dalla
   * parte giusta, mentre girare la cornice li specchierebbe).
   */
  girata: 1 | -1 = 1;
  azione: Azione | null = null;
  arricciata = 0;
  bagnata = 0;
  brivido = 0;
  spettinata = 0;
  bruciata = 0;
  shock = 0;
  fulmineFino = 0;
  gelo = 0;
  geloMeta = 0;
  /** Eliminata: sdraiata e ferma. */
  svenutaFerma = false;
  private readonly ph: number;
  private prossima: number;
  private batt: number;
  private prossimoFumo = 0;
  private readonly ombra: SVGGElement;
  private readonly zampe: Zampa[] = [];
  private readonly lana: Lana[] = [];
  private readonly corpo: SVGGElement;
  private testa!: Testa;
  private fuliggine!: SVGGElement;
  private peli!: SVGGElement;
  private brina!: SVGGElement;
  private facciaShock!: SVGGElement;

  constructor(
    private readonly ctx: Contesto,
    readonly chi: IdGiocatore,
    pecora: IdPecora,
    /** Dove sta nella disposizione (posizione e larghezza della pecora). */
    readonly g: PostoDisp,
    private readonly amb: AmbienteAgnelli = ambienteMuto(ctx),
    /** Posizione tra i giocatori: dà la voce al beee (più acuta per chi viene dopo). */
    private readonly indice = 0,
  ) {
    const rand = this.rand;
    this.verso = g.specchia ? -1 : 1;
    this.ph = rand(0, 6);
    this.prossima = rand(1, 3);
    this.batt = rand(1, 3);
    const el = document.createElement('div');
    el.className = 'pecora';
    el.dataset.chi = chi;
    el.style.cssText = `left:${g.x}px;top:${g.y}px;width:${g.w}px;z-index:${100 + Math.round(g.y + g.w * 0.79)}`;
    el.innerHTML = '<div class="reazione"></div>';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 200 170');
    svg.setAttribute('aria-hidden', 'true');
    if (this.verso < 0) svg.style.transform = 'scaleX(-1)';
    this.reazione = el.firstElementChild as HTMLDivElement;
    this.reazione.appendChild(svg);
    this.el = el;
    this.svg = svg;
    // Ombra: la sagoma della pecora (zampe, vello, testa) proiettata sul prato, riempita a tinta unita
    this.ombra = document.createElementNS(NS, 'g');
    this.ombra.setAttribute('style', 'opacity:var(--oop,.15)');
    svg.appendChild(this.ombra);
    this.corpo = document.createElementNS(NS, 'g');
    const simbolo = document.getElementById('s-' + pecora) ?? simboloDiRipiego();
    const fasi: Record<string, number> = {};
    for (const n of Array.from(simbolo.children)) {
      if (n.tagName === 'ellipse') continue; // l'ombra a terra originale: la sostituisce quella che segue il sole
      if (n.tagName === 'use') {
        this.testa = this.costruisciTesta(n);
        continue;
      }
      const copia = n.cloneNode(true) as SVGElement;
      if (n.tagName === 'g' && Array.from(n.children).every((c) => c.tagName === 'rect')) {
        svg.appendChild(copia);
        for (const r of Array.from(copia.children)) {
          this.zampe.push({ el: r as SVGElement, x: +r.getAttribute('x')! + +r.getAttribute('width')! / 2, y: +r.getAttribute('y')! });
        }
        continue;
      }
      this.corpo.appendChild(copia);
      for (const f of Array.from(copia.querySelectorAll<SVGElement>('circle, ellipse'))) {
        const cx = +f.getAttribute('cx')!;
        const cy = +f.getAttribute('cy')!;
        const chiave = `${cx},${cy}`;
        fasi[chiave] ??= rand(0, 6.28);
        this.lana.push({ el: f, cx, cy, r: +(f.getAttribute('r') || 0), rx: +(f.getAttribute('rx') || 0), ry: +(f.getAttribute('ry') || 0), ph: fasi[chiave]! });
      }
    }
    if (!this.testa) this.testa = this.costruisciTesta(null);
    svg.appendChild(this.corpo);
    svg.appendChild(this.testa.posa);
    let sagoma = '';
    for (const n of Array.from(simbolo.children)) {
      if (n.tagName !== 'g') continue;
      const sw = n.querySelector('rect') && !n.querySelector('circle') ? 0 : parseFloat(/stroke-width:([\d.]+)/.exec(n.getAttribute('style') || '')?.[1] || '0');
      sagoma += `<g fill="${P.notte}" stroke="${P.notte}" stroke-width="${sw}">${Array.from(n.children)
        .map((c) => {
          const k = c.cloneNode(true) as Element;
          k.removeAttribute('style');
          return k.outerHTML;
        })
        .join('')}</g>`;
      if (sw) break; // basta il primo strato del vello, quello con il contorno
    }
    sagoma += `<circle cx="${this.testa.x}" cy="${this.testa.y + 4}" r="21" fill="${P.notte}"/>`;
    this.ombra.innerHTML = sagoma;
    this.creaSovrapposizioni();
    el.addEventListener('pointerdown', () => {
      if (this.svenutaFerma) return;
      this.reagisci('salto');
      this.fai('bela', true);
    });
    ctx.el.mondo.appendChild(el);
  }

  private readonly rand = (a: number, b: number): number => a + this.ctx.caso() * (b - a);

  // Strati extra disegnati sopra la pecora: fuliggine, peli elettrici, faccia fulminata, brina e ghiaccioli
  private creaSovrapposizioni(): void {
    const N = P.notte;
    const palle: Lana[] = [];
    const visti = new Set<string>();
    for (const l of this.lana) {
      const k = `${l.cx},${l.cy}`;
      if (l.r && !visti.has(k)) {
        visti.add(k);
        palle.push(l);
      }
    }
    const g = (html: string, dove: Element = this.corpo): SVGGElement => {
      const e = document.createElementNS(NS, 'g');
      e.setAttribute('opacity', '0');
      e.innerHTML = html;
      dove.appendChild(e);
      return e;
    };
    // Fuliggine: macchie scure sul vello
    this.fuliggine = g(
      palle
        .filter((_, i) => i % 2 === 0)
        .map((l) => `<ellipse cx="${(l.cx + l.r * 0.2).toFixed(1)}" cy="${(l.cy + l.r * 0.1).toFixed(1)}" rx="${(l.r * 0.45).toFixed(1)}" ry="${(l.r * 0.28).toFixed(1)}" fill="${N}" opacity=".5"/>`)
        .join(''),
    );
    // Peli ritti per l'elettricità: zigzag che escono dal bordo del vello
    let peli = '';
    for (const l of palle.filter((p) => p.cy < 118)) {
      let dx = l.cx - 100;
      let dy = l.cy - 112;
      const d = Math.hypot(dx, dy) || 1;
      dx /= d;
      dy /= d;
      for (const a of [-0.35, 0.35]) {
        const ux = dx * Math.cos(a) - dy * Math.sin(a);
        const uy = dx * Math.sin(a) + dy * Math.cos(a);
        const px = -uy;
        const py = ux;
        const x0 = l.cx + ux * (l.r + 1);
        const y0 = l.cy + uy * (l.r + 1);
        const pt = (t: number, o: number) => `${(x0 + ux * t + px * o).toFixed(1)} ${(y0 + uy * t + py * o).toFixed(1)}`;
        peli += `<path d="M${pt(0, 0)} L${pt(4, 2.6)} L${pt(8, -2.6)} L${pt(12, 0.6)}"/>`;
      }
    }
    this.peli = g(`<g fill="none" stroke="${N}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${peli}</g>`, this.svg);
    this.svg.insertBefore(this.peli, this.corpo);
    // Brina sul dorso e ghiaccioli sotto la pancia
    const fondo = (x: number) =>
      Math.max(...palle.filter((l) => Math.abs(x - l.cx) < l.r).map((l) => l.cy + Math.sqrt(l.r * l.r - (x - l.cx) ** 2)), 120);
    this.brina = g(
      palle
        .filter((l) => l.cy < 104)
        .map((l) => `<ellipse cx="${l.cx}" cy="${(l.cy - l.r * 0.62).toFixed(1)}" rx="${(l.r * 0.62).toFixed(1)}" ry="${(l.r * 0.26).toFixed(1)}" fill="${P.gesso}" stroke="${N}" stroke-width="1.8"/>`)
        .join('') +
        [78, 96, 114]
          .map((x, i) => {
            const y = fondo(x) - 2;
            const h = [9, 12, 8][i]!;
            return `<path d="M${x - 3.5} ${y.toFixed(1)} L${x} ${(y + h).toFixed(1)} L${x + 3.5} ${y.toFixed(1)} Z" fill="${P.celeste}" stroke="${N}" stroke-width="1.6" stroke-linejoin="round"/>`;
          })
          .join(''),
    );
    // Faccia fulminata: occhi sgranati e bocca aperta, sopra quelli di sempre
    const occhi = this.testa.occhi.filter((o) => o.el.tagName === 'circle').map((o) => [+o.el.getAttribute('cx')!, +o.el.getAttribute('cy')!] as const);
    const pos = occhi.length >= 2 ? occhi.slice(0, 2) : ([[-6.5, 3], [6.5, 3]] as const);
    this.facciaShock = g(
      pos.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4.6" fill="${P.gesso}" stroke="${N}" stroke-width="1.8"/><circle cx="${x + 0.6}" cy="${y + 0.4}" r="1.3" fill="${N}"/>`).join('') +
        `<ellipse cx="0" cy="15" rx="3" ry="4" fill="${N}" stroke="${P.gesso}" stroke-width="1.4"/>`,
      this.testa.anima,
    );
  }

  /** Il verso in cui guarda adesso il disegno: quello della disposizione, girato se è girata. */
  private get versoOra(): 1 | -1 {
    return this.verso === this.girata ? 1 : -1;
  }

  /** Guarda dall'altra parte (−1) o di nuovo nel suo verso (1): si gira solo il disegno, l'ombra e il vento seguono. */
  gira(girata: 1 | -1): void {
    this.girata = girata;
    this.svg.style.transform = this.versoOra < 0 ? 'scaleX(-1)' : '';
  }

  /** Dove sta la testa sul prato (bozza, riga 2303): da qui escono il fiato e il vapore. */
  puntoTesta(): { x: number; y: number } {
    const g = this.g, h = this.testa;
    const x = this.versoOra > 0 ? h.x : 200 - h.x;
    return { x: g.x + (x / 200) * g.w, y: g.y + (h.y / 170) * g.w * 0.85 };
  }

  /** `durata` > 0: la pecora resta sbigottita e bruciacchiata per quel tempo; 0 chiude subito il fulmine. */
  fulmina(durata: number): void {
    if (durata > 0) {
      this.fulmineFino = this.ctx.T + durata;
      this.shock = 1;
      this.bruciata = 1;
      this.arricciata = 1;
    } else if (this.fulmineFino) {
      this.fulmineFino = this.ctx.T;
    }
  }

  private costruisciTesta(uso: Element | null): Testa {
    const h = uso ? document.getElementById(uso.getAttribute('href')!.slice(1)) : null;
    const posa = document.createElementNS(NS, 'g');
    const anima = document.createElementNS(NS, 'g');
    anima.setAttribute('style', h?.getAttribute('style') || '');
    posa.appendChild(anima);
    if (h) for (const c of Array.from(h.children)) anima.appendChild(c.cloneNode(true));
    const m = /translate\(([-\d.]+)[ ,]+([-\d.]+)\)\s*rotate\(([-\d.]+)\)/.exec(uso?.getAttribute('transform') ?? '');
    const t: Testa = { posa, anima, x: m ? +m[1]! : 156, y: m ? +m[2]! : 58, r: m ? +m[3]! : 0, orecchie: [], occhi: [] };
    Array.from(anima.children)
      .slice(0, 2)
      .forEach((o) => {
        const r = /rotate\(([-\d.]+) ([-\d.]+) ([-\d.]+)\)/.exec(o.getAttribute('transform') || '');
        if (r) t.orecchie.push({ el: o as SVGElement, a: +r[1]!, cx: +r[2]!, cy: +r[3]! });
      });
    for (const c of Array.from(anima.querySelectorAll<SVGElement>('circle, path'))) {
      const st = c.getAttribute('style') || '';
      const occhio =
        (c.tagName === 'circle' && +c.getAttribute('r')! <= 3.2 && st.includes('vello') && +c.getAttribute('cy')! < 12) ||
        (c.tagName === 'path' && st.includes('stroke:var(--colore-limone'));
      if (occhio) t.occhi.push({ el: c, cy: c.tagName === 'circle' ? +c.getAttribute('cy')! : 0.5 });
    }
    return t;
  }

  fai(tipo: string, subito = false): void {
    if (this.azione && !subito) return;
    const t = tipo as TipoAzione;
    this.azione = { tipo: t, q: 0, durata: DURATE_AZIONE[t] ?? 1 };
    if (t === 'bela' && (subito || this.ctx.caso() < 0.3)) this.ctx.suona('beee', 0.9 + this.indice * 0.1);
  }

  /** Reazione a un evento o a un tocco (bozza, riga 1743): un gesto di tutto il corpo. */
  reagisci(tipo: TipoReazione): void {
    const { fotogrammi, durata } = REAZIONI[tipo];
    this.ctx.anima(this.reazione, fotogrammi, { duration: this.ctx.ridotto ? 1 : durata, easing: 'ease-out', iterations: tipo === 'festa' ? 3 : 1 });
  }

  /** Eliminata (o di nuovo in gioco): sdraiata sul fianco e ferma, o di nuovo in piedi. */
  svenuta(si: boolean): void {
    if (si === this.svenutaFerma) return;
    this.svenutaFerma = si;
    this.azione = null;
    this.reazione.style.transform = si ? POSA_SVENUTA : '';
    if (si) {
      this.ctx.anima(this.reazione, [{ transform: 'none' }, { transform: POSA_SVENUTA }], { duration: this.ctx.ridotto ? 1 : 600, easing: 'ease-out' });
    }
  }

  passo(dt: number): void {
    const { ctx, amb, g } = this;
    const rand = this.rand;
    const T = ctx.T;
    const t = T + this.ph;
    const b = Math.sin((t * 2 * Math.PI) / 3.4);
    this.prossima -= dt;
    if (this.prossima <= 0 && !this.azione && !ctx.ridotto && !this.svenutaFerma) {
      this.prossima = rand(1.6, 4.2);
      this.fai(AZIONI[Math.floor(ctx.caso() * AZIONI.length)]!);
    }
    let testaR = 0, testaY = 0, piega = 0, orecchie = 0, sbuffo = 0;
    const alzate = [0, 0, 0, 0];
    if (this.azione) {
      const a = this.azione;
      a.q += dt / a.durata;
      const q = Math.min(1, a.q);
      const e = busta(q);
      if (a.tipo === 'guarda') testaR = 15 * Math.sin(q * Math.PI * 2) * e;
      else if (a.tipo === 'bruca') {
        testaR = 30 * e + Math.sin(T * 15) * 2.5 * e;
        testaY = 9 * e;
      } else if (a.tipo === 'orecchie') orecchie = 26 * Math.sin(q * Math.PI * 4) * (1 - q);
      else if (a.tipo === 'scuoti') {
        piega = 7 * Math.sin(q * Math.PI * 9) * (1 - q);
        sbuffo = 0.08 * (1 - q);
        testaR = 6 * Math.sin(q * Math.PI * 9) * (1 - q);
      } else if (a.tipo === 'passo') {
        const s = Math.sin(q * Math.PI * 2);
        if (s > 0) alzate[0] = alzate[2] = s;
        else alzate[1] = alzate[3] = -s;
      } else if (a.tipo === 'bela') {
        testaR = -24 * e;
        testaY = -3 * e;
      } else if (a.tipo === 'gira') testaR = -10 * e + 4 * Math.sin(q * Math.PI * 6) * e;
      if (a.q >= 1) this.azione = null;
    }
    // Battito di ciglia
    this.batt -= dt;
    let palpebra = 1;
    if (this.batt < 0) {
      const q = -this.batt / 0.16;
      palpebra = Math.max(0.1, Math.abs(1 - 2 * Math.min(1, q)));
      if (q >= 1) this.batt = rand(1.8, 5);
    }
    // Vento sul vello (la pecora specchiata: il vento per lei va al contrario)
    const w = amb.ventoIn(g.x + g.w / 2) * this.versoOra;
    piega += -w * 4;
    const brr = this.brivido > 0 ? Math.sin(T * 60) * 1.4 * this.brivido : 0;
    const sx = 1 + 0.01 * b;
    const sy = (1 + 0.024 * b) * (1 - 0.04 * this.bagnata);
    const tg = Math.tan((piega * Math.PI) / 180);
    this.corpo.setAttribute('transform', `translate(${(100 + brr).toFixed(2)} 150) skewX(${piega.toFixed(2)}) scale(${sx.toFixed(4)} ${sy.toFixed(4)}) translate(-100 -150)`);
    const gonfio = 1 + this.arricciata * 0.22 + this.spettinata * 0.1 - this.bagnata * 0.07 + sbuffo;
    for (const l of this.lana) {
      const f = clamp((150 - l.cy) / 100, 0.2, 1);
      const frulla = Math.abs(w) * 0.05 * Math.sin(T * 9 + l.ph) + (this.arricciata + this.spettinata) * 0.05 * Math.sin(T * 13 + l.ph * 3);
      const k = gonfio * (1 + 0.03 * Math.sin(T * 1.8 + l.ph) + frulla);
      l.el.setAttribute('cx', (l.cx + w * 7 * f + Math.sin(T * 0.9 + l.ph) * 0.6).toFixed(2));
      if (l.r) l.el.setAttribute('r', (l.r * k).toFixed(2));
      else {
        l.el.setAttribute('rx', (l.rx * k).toFixed(2));
        l.el.setAttribute('ry', (l.ry * k).toFixed(2));
      }
    }
    const h = this.testa;
    const dyCorpo = (h.y - 150) * (sy - 1);
    h.posa.setAttribute('transform', `translate(${(h.x + (h.y - 150) * tg + brr + w * 5).toFixed(2)} ${(h.y + dyCorpo + testaY).toFixed(2)}) rotate(${(h.r + testaR).toFixed(2)})`);
    for (const o of h.orecchie) o.el.setAttribute('transform', `rotate(${(o.a + orecchie * (o.cx < 0 ? -1 : 1) + w * 10).toFixed(1)} ${o.cx} ${o.cy})`);
    for (const o of h.occhi) o.el.setAttribute('transform', `translate(0 ${o.cy}) scale(1 ${palpebra.toFixed(2)}) translate(0 ${-o.cy})`);
    this.zampe.forEach((z, i) => z.el.setAttribute('transform', `translate(0 ${(-alzate[i]! * 5).toFixed(2)}) rotate(${(alzate[i]! * 8 * (i < 2 ? -1 : 1)).toFixed(1)} ${z.x} ${z.y})`));
    // Ombra che segue il sole (in coordinate della pecora, già specchiate per chi è specchiata)
    // Proiezione a terra: un punto alto h sopra le zampe (y = 158) finisce h·(a, b) più in là, verso chi guarda
    const LUCE = amb.LUCE;
    const a = LUCE.dx * LUCE.lung * this.versoOra;
    const bb = 0.42 * LUCE.lung;
    this.ombra.setAttribute('transform', `matrix(1 0 ${(-a).toFixed(4)} ${(-bb).toFixed(4)} ${(158 * a).toFixed(2)} ${(158 * (1 + bb)).toFixed(2)})`);
    // Fulminata: resta sbigottita e bruciacchiata per qualche secondo, poi si scrolla la fuliggine
    if (this.fulmineFino) {
      if (T < this.fulmineFino) {
        this.arricciata = 1;
        this.prossimoFumo -= dt;
        if (this.prossimoFumo <= 0) {
          this.prossimoFumo = rand(0.25, 0.45);
          amb.fumata(g.x + g.w * rand(0.3, 0.7), g.y + g.w * rand(0.2, 0.3), 1, g.w / 124);
        }
        if (ctx.caso() < dt * 2.5) {
          amb.particella('scintilla', g.x + g.w * rand(0.25, 0.75), g.y + g.w * rand(0.2, 0.45), { vx: rand(-60, 60), vy: rand(-90, -30), vita: 0.5, k: 0.6 });
        }
      } else {
        this.fulmineFino = 0;
        this.shock = 0;
        this.fai('scuoti', true);
        for (let i = 0; i < 10; i++) {
          amb.particella('lanetta', g.x + g.w * rand(0.3, 0.7), g.y + g.w * rand(0.3, 0.5), { vx: rand(-70, 70), vy: rand(-80, -20), vita: 1, k: (0.5 * g.w) / 124, colore: GRIGIO_FUMO });
        }
      }
    }
    if (!this.fulmineFino && this.bruciata > 0) this.bruciata = Math.max(0, this.bruciata - dt * 0.6);
    this.fuliggine.setAttribute('opacity', this.bruciata.toFixed(2));
    this.svg.style.filter = this.bruciata > 0.01 ? `brightness(${(1 - 0.32 * this.bruciata).toFixed(3)}) sepia(${(0.35 * this.bruciata).toFixed(3)})` : '';
    if (this.shock || this.peli.getAttribute('opacity') !== '0') {
      this.peli.setAttribute('opacity', this.shock ? (0.75 + ctx.caso() * 0.25).toFixed(2) : '0');
      this.peli.setAttribute('transform', this.shock ? `translate(${rand(-0.7, 0.7).toFixed(2)} ${rand(-0.7, 0.7).toFixed(2)})` : '');
    }
    this.facciaShock.setAttribute('opacity', this.shock ? '1' : '0');
    for (const o of h.occhi) o.el.style.opacity = this.shock ? '0' : '';
    // Brina della gelata
    this.gelo += (this.geloMeta - this.gelo) * Math.min(1, dt * 1.2);
    this.brina.setAttribute('opacity', this.gelo.toFixed(2));
    for (const k of ['arricciata', 'bagnata', 'spettinata'] as const) if (this[k] > 0) this[k] = Math.max(0, this[k] - dt * (k === 'bagnata' ? 0.12 : 0.15));
    if (this.brivido > 0) this.brivido = Math.max(0, this.brivido - dt * (this.geloMeta ? 0.02 : 0.2));
  }

  togli(): void {
    this.el.remove();
  }
}

// I fumetti stanno sul prato accanto alla pecora, ma durante lo zoom restano della loro grandezza normale
const FUMETTI = new WeakMap<Contesto, Set<HTMLElement>>();
const fumettiDi = (ctx: Contesto): Set<HTMLElement> => {
  let s = FUMETTI.get(ctx);
  if (!s) FUMETTI.set(ctx, (s = new Set()));
  return s;
};

/**
 * Un fumetto accanto alla pecora di `chi` (bozza, riga 1749). Uno solo per pecora: il nuovo prende il posto del precedente.
 * `zoom` è l'ingrandimento dell'inquadratura (1 senza zoom).
 */
export function fumetto(ctx: Contesto, g: PostoDisp, chi: IdGiocatore, testo: string, durata = 1700, zoom: () => number = () => 1): void {
  const insieme = fumettiDi(ctx);
  for (const vecchio of [...insieme]) {
    if (vecchio.dataset.di === chi) {
      insieme.delete(vecchio);
      vecchio.remove();
    }
  }
  const f = document.createElement('div');
  f.className = 'fumetto';
  f.dataset.di = chi;
  f.textContent = testo;
  ctx.el.mondo.appendChild(f);
  // Il fumetto cresce di k attorno alla coda: la coda si sposta lungo il fumetto perché resti dentro lo schermo
  const w = f.offsetWidth;
  const h = f.offsetHeight;
  const k = ctx.KD / (zoom() || 1);
  const cx = g.fumetto[0];
  const coda = Math.max(16, Math.min(w - 16, w / 2, (cx - 6) / k), w - (W - 6 - cx) / k);
  const x = cx - Math.max(16, Math.min(w - 16, coda));
  f.style.left = x + 'px';
  f.style.top = g.fumetto[1] - h - 8 + 'px';
  f.style.setProperty('--coda', `${cx - x}px`);
  f.style.transformOrigin = `${cx - x}px calc(100% + 9px)`;
  f.style.scale = k.toFixed(3);
  insieme.add(f);
  const via = () => {
    insieme.delete(f);
    f.remove();
  };
  const anim = ctx.anima(
    f,
    [
      { transform: 'scale(0)', opacity: 0 },
      { transform: 'scale(1.1)', opacity: 1, offset: 0.12 },
      { transform: 'scale(1)', offset: 0.2 },
      { transform: 'scale(1)', opacity: 1, offset: 0.85 },
      { transform: 'scale(.9)', opacity: 0 },
    ],
    { duration: durata, easing: 'ease-out' },
  );
  anim.finished.then(via, via);
}

/** I fumetti restano della loro grandezza normale anche durante lo zoom (bozza, riga 1765). */
export function aggiornaFumetti(ctx: Contesto, zoom: () => number): void {
  const insieme = FUMETTI.get(ctx);
  if (!insieme?.size) return;
  const s = (ctx.KD / (zoom() || 1)).toFixed(3);
  for (const f of insieme) f.style.scale = s;
}

export function togliFumetti(ctx: Contesto): void {
  const insieme = FUMETTI.get(ctx);
  if (!insieme) return;
  for (const f of insieme) f.remove();
  insieme.clear();
}
