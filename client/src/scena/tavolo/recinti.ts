// Recinti e cartelli (bozza scena.src.html, righe 1145–1187): staccionata in due strati (dietro e davanti agli agnellini)
// con l'ombra che segue il sole, e il cartello col conto. Il recinto si può ridisegnare con un'altra forma
// (serve ad allargarlo quando l'inquadratura si avvicina).
import { T } from '../../testi';
import { TAVOLOZZA as P } from '../ambiente/paesaggio';
import type { Contesto } from '../contesto';
import type { PostoDisp } from '../disposizioni';
import type { Area } from '../personaggi/aree';

const NS = 'http://www.w3.org/2000/svg';

/** Forma del recinto: x, quota del lato dietro e del lato davanti, larghezza, scala. */
export interface FormaRecinto {
  x: number;
  yDietro: number;
  yDavanti: number;
  larg: number;
  k: number;
}

export type VettoreOmbra = (h: number) => { x: number; y: number };

/** Come la luce di partenza dell'ambiente: dx −0,55, lunghezza 0,45. */
const OMBRA_DI_BASE: VettoreOmbra = (h) => ({ x: -0.55 * 0.45 * h, y: 0.42 * 0.45 * h });

interface Strati {
  dietro: SVGSVGElement;
  davanti: SVGSVGElement;
  vettoreOmbra: VettoreOmbra;
}

const STRATI = new WeakMap<Area, Strati>();

export function creaRecinto(ctx: Contesto, a: Area, r: PostoDisp['recinto'], vettoreOmbra: VettoreOmbra = OMBRA_DI_BASE): void {
  const [x, yDietro, yDavanti, larg, k] = r;
  const mondo = ctx.el.mondo;
  togliRecinto(a);
  const nuovo = (): SVGSVGElement => {
    const e = document.createElementNS(NS, 'svg');
    e.setAttribute('class', 'recinto');
    e.setAttribute('width', '1');
    e.setAttribute('height', '1');
    e.style.overflow = 'visible';
    e.dataset.chi = a.nome;
    mondo.appendChild(e);
    return e;
  };
  const dietro = nuovo();
  const davanti = nuovo();
  const c = document.createElement('div');
  c.className = 'cartello' + (k < 0.8 ? ' piccolo' : '');
  c.dataset.chi = a.nome;
  mondo.appendChild(c);
  a.cartello = c;
  STRATI.set(a, { dietro, davanti, vettoreOmbra });
  a.recinto0 = { x, yDietro, yDavanti, larg, k };
  a.area0 = [a.x0, a.y0, a.x1, a.y1];
  disegnaRecinto(ctx, a, a.recinto0 as FormaRecinto);
}

/** Toglie il recinto e il suo cartello dalla scena. */
export function togliRecinto(a: Area): void {
  const s = STRATI.get(a);
  if (!s) return;
  s.dietro.remove();
  s.davanti.remove();
  a.cartello?.remove();
  a.cartello = null;
  STRATI.delete(a);
}

export function disegnaRecinto(_ctx: Contesto, a: Area, { x, yDietro, yDavanti, larg, k }: FormaRecinto): void {
  const s = STRATI.get(a);
  if (!s) return;
  const { dietro, davanti } = s;
  const alto = 22 * k;
  const prof = yDavanti - yDietro;
  const palo = (px: number, py: number, h: number) =>
    `<rect x="${(px - 3.5 * k).toFixed(1)}" y="${(py - h).toFixed(1)}" width="${(7 * k).toFixed(1)}" height="${(h + 3 * k).toFixed(1)}" rx="${(3 * k).toFixed(1)}" fill="${P.fango}" stroke="${P.notte}" stroke-width="2.2"/>`;
  const asse = (y0: number, y1: number, x0: number, x1: number) =>
    `<path d="M${x0.toFixed(1)} ${y0.toFixed(1)} L${x1.toFixed(1)} ${y1.toFixed(1)}" stroke="${P.notte}" stroke-width="${(7 * k).toFixed(2)}" stroke-linecap="round"/>` +
    `<path d="M${x0.toFixed(1)} ${y0.toFixed(1)} L${x1.toFixed(1)} ${y1.toFixed(1)}" stroke="${P.fango}" stroke-width="${(7 * k - 4.4).toFixed(2)}" stroke-linecap="round"/>`;
  dietro.style.cssText += `;left:${x}px;top:${yDietro}px;z-index:${100 + Math.round(yDietro)}`;
  let d = `<rect x="${-4 * k}" y="${-2 * k}" width="${(larg + 8 * k).toFixed(1)}" height="${(prof + 6 * k).toFixed(1)}" rx="${14 * k}" style="fill:var(--pavimento)" stroke="${P.notte}" stroke-width="2.2"/>`;
  d += `<path class="ombra-recinto" data-h="${alto * 0.82}" data-l="${larg}"/>`;
  const nPali = Math.max(3, Math.round(larg / (34 * k)));
  for (let i = 0; i <= nPali; i++) d += palo((larg * i) / nPali, 0, alto * 0.82);
  d += asse(-alto * 0.55, -alto * 0.55, 0, larg) + asse(-alto * 0.2, -alto * 0.2, 0, larg);
  d += asse(-alto * 0.55, prof - alto * 0.62, 0, 0) + asse(-alto * 0.2, prof - alto * 0.25, 0, 0);
  d += asse(-alto * 0.55, prof - alto * 0.62, larg, larg) + asse(-alto * 0.2, prof - alto * 0.25, larg, larg);
  dietro.innerHTML = d;
  davanti.style.cssText += `;left:${x}px;top:${yDavanti}px;z-index:${100 + Math.round(yDavanti) + 2}`;
  let f = `<path class="ombra-recinto" data-h="${alto}" data-l="${larg}"/>`;
  for (let i = 0; i <= nPali; i++) f += palo((larg * i) / nPali, 0, alto);
  f += asse(-alto * 0.62, -alto * 0.62, 0, larg) + asse(-alto * 0.25, -alto * 0.25, 0, larg);
  davanti.innerHTML = f;
  a.recinto = { x, yDietro, yDavanti, larg, k, alto };
  const cartello = a.cartello;
  if (cartello) {
    const piccolo = cartello.classList.contains('piccolo');
    cartello.style.cssText += `;left:${x + larg / 2}px;top:${yDavanti - alto * (piccolo ? 1.1 : 0.95)}px;z-index:${100 + Math.round(yDavanti) + 3}`;
  }
  aggiornaOmbreRecinti(a);
}

/** Ridisegna le ombre del recinto con la luce di adesso; con `vettoreOmbra` cambia anche il modo di calcolarle. */
export function aggiornaOmbreRecinti(a: Area, vettoreOmbra?: VettoreOmbra): void {
  const s = STRATI.get(a);
  if (!s) return;
  if (vettoreOmbra) s.vettoreOmbra = vettoreOmbra;
  for (const radice of [s.dietro, s.davanti]) {
    radice.querySelectorAll<SVGPathElement>('.ombra-recinto').forEach((p) => {
      const h = Number(p.dataset.h);
      const l = Number(p.dataset.l);
      const v = s.vettoreOmbra(h);
      p.setAttribute('d', `M0 0 L${l} 0 L${(l + v.x).toFixed(1)} ${v.y.toFixed(1)} L${v.x.toFixed(1)} ${v.y.toFixed(1)} Z`);
    });
  }
}

/** Cartello del gregge: piccolo, fisso (bozza, righe 1139–1141). */
export function creaCartelloGregge(ctx: Contesto, a: Area, [x, y]: [number, number]): void {
  a.cartello?.remove();
  const c = document.createElement('div');
  c.className = 'cartello piccolo';
  c.style.cssText = `left:${x}px;top:${y}px;z-index:360`;
  ctx.el.mondo.appendChild(c);
  a.cartello = c;
}

/** "n/posti" per un recinto, "Gregge n" per il gregge; "quasi" quando mancano 3 posti o meno (stessa soglia dei segnalini). */
export function aggiornaCartello(a: Area, postiOvile: number): void {
  const c = a.cartello;
  if (!c) return;
  const gregge = a.nome === 'gregge';
  c.textContent = gregge ? T.scena.gregge(a.mostrati) : `${a.mostrati}/${postiOvile}`;
  c.classList.toggle('quasi', !gregge && postiOvile - a.mostrati <= 3);
}
