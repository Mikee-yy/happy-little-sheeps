// Particelle (petali, semi, foglie; pioggia, grandine, fumo…) disegnate su un'unica tela (bozza scena.src.html, righe 848–938).
// Se la tela non si può disegnare (jsdom) le particelle si contano e scadono, ma non si disegnano.
import type { Contesto } from '../contesto';
import { H, W } from '../misure';
import { piattaforma } from '../piattaforma';
import { GRIGIO_FUMO, TAVOLOZZA as P } from './paesaggio';

export type TipoParticella =
  | 'petalo' | 'foglia' | 'seme' | 'goccia' | 'schizzo' | 'chicco' | 'cristallo'
  | 'scintilla' | 'gocciolina' | 'lanetta' | 'fumo' | 'vapore';

/** Una particella: i campi extra (colore, k, terra…) li dà chi la crea. */
export interface Particella {
  tipo: TipoParticella;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  vita: number;
  vita0: number;
  ph: number;
  k?: number;
  colore?: string;
  terra: number;
  fermo?: boolean;
  rimbalzi?: number;
}

export type OpzioniParticella = Partial<Omit<Particella, 'tipo' | 'x' | 'y' | 'vita0'>>;

export interface Particelle {
  lista: Particella[];
  particella(tipo: TipoParticella, x: number, y: number, o?: OpzioniParticella): Particella;
  aggiorna(dt: number): void;
  /** Rimette la tela alla misura dello schermo (dopo un cambio di scala o di dimensioni). */
  adattaTela(): void;
  conta(): number;
  limite(): number;
  /** Elemento che appare un momento sul prato e poi scompare (stellina, cuore, belino…); bozza, riga 1399. */
  decoro(html: string, x: number, y: number, fotogrammi: Keyframe[], durata: number): HTMLElement;
  /** Sbuffo di fumo (bozza, riga 2309). */
  fumata(x: number, y: number, n?: number, k?: number): void;
  /** La zeta di chi dorme (bozza, riga 1505). */
  zeta(x: number, y: number): void;
  /** La parte del prato che si vede sullo schermo (bozza, riga 850). */
  vista(): { x: number; y: number; w: number; h: number };
  distruggi(): void;
}

const SFONDO_LEGGERO = new Set<TipoParticella>(['petalo', 'seme', 'foglia']);

/** Pennello che non disegna: serve a far avanzare le particelle quando manca la tela. */
const PENNELLO_MUTO = new Proxy({} as CanvasRenderingContext2D, {
  get: () => () => undefined,
  set: () => true,
});

export function creaParticelle(ctx: Contesto, ventoIn: (x: number) => number, profondita: (y: number) => number): Particelle {
  const lista: Particella[] = [];
  const rand = (a: number, b: number) => a + ctx.caso() * (b - a);
  const tela = document.createElement('canvas');
  tela.className = 'particelle';
  tela.setAttribute('aria-hidden', 'true');
  tela.style.cssText = 'position:absolute;z-index:3150;pointer-events:none';
  ctx.el.mondo.appendChild(tela);
  const pennello = piattaforma.contesto2d(tela);
  let DPR = 1;
  let vista = { x: 0, y: 0, w: W, h: H };
  let telaSporca = false;

  function adattaTela(): void {
    const w = ctx.el.schermo.clientWidth || W * ctx.S, h = ctx.el.schermo.clientHeight || H * ctx.S;
    const ox = (w - W * ctx.S) / 2, oy = h - H * ctx.S;
    vista = { x: -ox / ctx.S, y: -oy / ctx.S, w: w / ctx.S, h: h / ctx.S };
    DPR = Math.min(2, (globalThis as { devicePixelRatio?: number }).devicePixelRatio || 1);
    Object.assign(tela.style, { left: vista.x + 'px', top: vista.y + 'px', width: vista.w + 'px', height: vista.h + 'px' });
    tela.width = Math.round(w * DPR);
    tela.height = Math.round(h * DPR);
  }
  adattaTela();

  const limite = () => ctx.risparmio.limiteParticelle();

  function particella(tipo: TipoParticella, x: number, y: number, o: OpzioniParticella = {}): Particella {
    const p: Particella = {
      tipo, x, y,
      vx: rand(20, 60), vy: rand(-30, 0), rot: rand(0, 6.28), vr: rand(-6, 6), vita: rand(2.5, 4.5), ph: rand(0, 6.28), terra: y,
      ...o,
      vita0: 0,
    };
    p.vita0 = p.vita;
    // In modo leggero: al massimo 60, circa la metà di quelle di sfondo e meno anche negli effetti del meteo.
    // Mai oltre il limite, nemmeno fuori dal modo leggero.
    if (lista.length >= limite()) return p;
    if (ctx.risparmio.leggero && ctx.caso() > (SFONDO_LEGGERO.has(tipo) ? 0.5 : 0.7)) return p;
    lista.push(p);
    return p;
  }

  function aggiorna(dt: number): void {
    const c = pennello ?? PENNELLO_MUTO;
    const S = ctx.S, T = ctx.T;
    if (!lista.length) {
      if (telaSporca && pennello) {
        pennello.setTransform(1, 0, 0, 1, 0, 0);
        pennello.clearRect(0, 0, tela.width, tela.height);
      }
      telaSporca = false;
      return;
    }
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, tela.width, tela.height);
    c.setTransform(S * DPR, 0, 0, S * DPR, -vista.x * S * DPR, -vista.y * S * DPR);
    telaSporca = true;
    c.lineJoin = 'round';
    c.lineCap = 'round';
    for (let i = lista.length - 1; i >= 0; i--) {
      const p = lista[i]!;
      p.vita -= dt;
      if (p.vita <= 0 || p.x > vista.x + vista.w + 40 || p.y > vista.y + vista.h + 40) {
        lista.splice(i, 1);
        continue;
      }
      const w = ventoIn(p.x), alfa = Math.min(1, p.vita / 0.6, (p.vita0 - p.vita) / 0.2 + 0.2);
      c.globalAlpha = alfa;
      if (p.tipo === 'petalo' || p.tipo === 'foglia') {
        p.vx += (w * 240 + 25 - p.vx) * dt * 1.4;
        p.vy += (Math.sin(T * 3 + p.ph) * 26 + 14 - p.vy) * dt * 1.2;
        p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
        c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.scale(p.k || 1, p.k || 1);
        c.beginPath();
        if (p.tipo === 'petalo') c.ellipse(0, 0, 3.2, 1.8, 0, 0, Math.PI * 2);
        else { c.moveTo(-4, 0); c.quadraticCurveTo(0, -3.4, 4, 0); c.quadraticCurveTo(0, 3.4, -4, 0); }
        c.fillStyle = p.tipo === 'petalo' ? (p.colore ?? P.gesso) : P.menta; c.fill(); c.strokeStyle = P.notte; c.lineWidth = 0.9; c.stroke(); c.restore();
      } else if (p.tipo === 'seme') {
        p.vx += (w * 200 + 18 - p.vx) * dt;
        p.vy += (-12 + Math.sin(T * 2 + p.ph) * 10 - p.vy) * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        c.save(); c.translate(p.x, p.y); c.scale(p.k || 1, p.k || 1); c.strokeStyle = P.notte; c.lineWidth = 0.8;
        c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 5); c.moveTo(-3, -2); c.lineTo(0, 0); c.lineTo(3, -2); c.moveTo(0, -3); c.lineTo(0, 0); c.stroke();
        c.beginPath(); c.arc(0, 5.5, 1, 0, Math.PI * 2); c.fillStyle = P.notte; c.fill(); c.restore();
      } else if (p.tipo === 'goccia') {
        p.x += p.vx * dt; p.y += p.vy * dt;
        const k = profondita(p.terra);
        if (p.y >= p.terra) { p.tipo = 'schizzo'; p.y = p.terra; p.vita = p.vita0 = 0.28; continue; }
        c.strokeStyle = P.notte; c.globalAlpha = 0.5; c.lineWidth = 1.6 * k;
        c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 0.028 * k, p.y - p.vy * 0.028 * k); c.stroke();
      } else if (p.tipo === 'schizzo') {
        const k = profondita(p.y), q = 1 - p.vita / p.vita0;
        c.strokeStyle = P.notte; c.globalAlpha = 0.45 * (1 - q); c.lineWidth = 1.2 * k;
        c.beginPath(); c.ellipse(p.x, p.y, (2 + q * 6) * k, (0.8 + q * 2) * k, 0, Math.PI, Math.PI * 2); c.stroke();
      } else if (p.tipo === 'chicco') {
        const k = profondita(p.terra);
        if (!p.fermo) {
          p.vy += 1300 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
          if (p.y >= p.terra) {
            p.y = p.terra; p.rimbalzi = (p.rimbalzi || 0) + 1; p.vy = -p.vy * 0.36; p.vx *= 0.5;
            if (p.rimbalzi > 2) p.fermo = true;
            else if (ctx.caso() < 0.15) ctx.suona('ticchettio');
          }
        }
        const sciolto = Math.min(1, p.vita / 1.2);
        c.beginPath(); c.arc(p.x, p.y - 2 * k, 2.8 * k * sciolto, 0, Math.PI * 2); c.fillStyle = P.gesso; c.fill(); c.strokeStyle = P.notte; c.lineWidth = 1.1 * k; c.stroke();
      } else if (p.tipo === 'cristallo') {
        const k = profondita(p.y), q = Math.min(1, (p.vita0 - p.vita) / 0.8);
        c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.scale(k * q, k * q); c.strokeStyle = P.notte; c.lineWidth = 1.2;
        c.beginPath();
        for (let a = 0; a < 3; a++) { const r = (a * Math.PI) / 3; c.moveTo(-Math.cos(r) * 4, -Math.sin(r) * 4); c.lineTo(Math.cos(r) * 4, Math.sin(r) * 4); }
        c.stroke();
        c.beginPath(); c.arc(0, 0, 1.2, 0, Math.PI * 2); c.fillStyle = P.gesso; c.fill(); c.restore();
      } else if (p.tipo === 'scintilla' || p.tipo === 'gocciolina' || p.tipo === 'lanetta') {
        p.vy += (p.tipo === 'lanetta' ? 20 : 600) * dt;
        if (p.tipo === 'lanetta') { p.vx += (ventoIn(p.x) * 300 - p.vx) * dt; p.rot += dt * 3; }
        p.x += p.vx * dt; p.y += p.vy * dt;
        c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.scale(p.k || 1, p.k || 1); c.beginPath();
        if (p.tipo === 'scintilla') {
          for (let a = 0; a < 10; a++) { const r = a % 2 ? 1.6 : 4, t = (a * Math.PI) / 5; c.lineTo(Math.cos(t) * r, Math.sin(t) * r); }
          c.closePath(); c.fillStyle = P.limone;
        } else if (p.tipo === 'gocciolina') { c.ellipse(0, 0, 1.6, 2.4, 0, 0, Math.PI * 2); c.fillStyle = P.celeste; }
        else { c.arc(-2, 0, 3, 0, Math.PI * 2); c.arc(2, -1, 3.4, 0, Math.PI * 2); c.fillStyle = p.colore || P.gesso; }
        c.fill(); c.strokeStyle = P.notte; c.lineWidth = 1; c.stroke(); c.restore();
      } else if (p.tipo === 'fumo') {
        const q = 1 - p.vita / p.vita0;
        p.x += (p.vx + ventoIn(p.x) * 40) * dt; p.y += p.vy * dt;
        c.globalAlpha = 0.85 * (1 - q) * Math.min(1, q * 6); c.beginPath(); c.arc(p.x, p.y, (3 + q * 9) * (p.k || 1), 0, Math.PI * 2);
        c.fillStyle = GRIGIO_FUMO; c.fill(); c.strokeStyle = P.notte; c.lineWidth = 1.1; c.stroke();
      } else if (p.tipo === 'vapore') {
        const q = 1 - p.vita / p.vita0;
        p.y -= 14 * dt; p.x += 6 * dt;
        c.globalAlpha = 0.75 * (1 - q); c.beginPath(); c.arc(p.x, p.y, (2 + q * 6) * (p.k || 1), 0, Math.PI * 2);
        c.fillStyle = P.gesso; c.fill(); c.strokeStyle = P.notte; c.lineWidth = 1; c.stroke();
      }
    }
    c.globalAlpha = 1;
  }

  function decoro(html: string, x: number, y: number, fotogrammi: Keyframe[], durata: number): HTMLElement {
    const d = document.createElement('div');
    d.className = 'decoro';
    d.innerHTML = html;
    d.style.left = x + 'px';
    d.style.top = y + 'px';
    ctx.el.mondo.appendChild(d);
    ctx.anima(d, fotogrammi, { duration: durata, easing: 'ease-out' }).onfinish = () => d.remove();
    return d;
  }

  function fumata(x: number, y: number, n = 10, k = 1): void {
    for (let i = 0; i < n; i++) {
      particella('fumo', x + rand(-8, 8) * k, y + rand(-4, 4) * k, { vita: rand(1.6, 2.6), k: k * rand(0.8, 1.3), vx: rand(-6, 10), vy: rand(-26, -14) });
    }
  }

  function zeta(x: number, y: number): void {
    if (ctx.ridotto) return;
    const z = document.createElement('span');
    z.className = 'zeta';
    z.textContent = 'z';
    z.style.left = x + 'px';
    z.style.top = y + 'px';
    ctx.el.mondo.appendChild(z);
    ctx.anima(z, [{ transform: 'translate(0,0) scale(.6)', opacity: 0 }, { opacity: 1, offset: 0.2 }, { transform: 'translate(10px,-22px) scale(1.1)', opacity: 0 }], { duration: 1800, easing: 'ease-out' }).onfinish = () => z.remove();
  }

  return {
    lista,
    particella,
    decoro,
    fumata,
    zeta,
    aggiorna,
    adattaTela,
    conta: () => lista.length,
    limite,
    vista: () => vista,
    distruggi() {
      lista.length = 0;
      tela.remove();
    },
  };
}
