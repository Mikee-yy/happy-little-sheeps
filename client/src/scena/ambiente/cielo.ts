// Cielo: sole con i raggi, vento, nuvole che cambiano forma, luce e ombre, tempesta (bozza scena.src.html, righe 939–1074 e 2236–2239).
import type { Contesto } from '../contesto';
import type { OraDelGiorno } from '../fotografia';
import { TAVOLOZZA as P } from './paesaggio';

const NS = 'http://www.w3.org/2000/svg';
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

const ALTEZZA_SOLE: Record<OraDelGiorno, number> = { giorno: 86, pomeriggio: 104, tramonto: 132, sera: 206 };
const SERA_PER_ORA: Record<OraDelGiorno, number> = { giorno: 0, pomeriggio: 0.15, tramonto: 0.5, sera: 1 };
const ORE: OraDelGiorno[] = ['giorno', 'pomeriggio', 'tramonto', 'sera'];

export interface Sole {
  x: number;
  y: number;
  meta: number;
  copertura: number;
}

/** La luce arriva da dietro a destra: le ombre cadono verso chi guarda e un po' a sinistra, più lunghe quando il sole è basso. */
export interface Luce {
  lung: number;
  op: number;
  dx: number;
  chiave: string;
}

export interface Vento {
  prossima: number;
  raffica: { fronte: number; forza: number } | null;
  /** Vento del meteo (la sua meta la dà `atmosfera.ventoMeta`). */
  extra: number;
}

/** Quello che il meteo regola e il cielo segue piano piano (bozza, righe 2108 e 2236–2239). */
export interface Atmosfera {
  tempesta: number;
  tempestaMeta: number;
  geloErba: number;
  geloErbaMeta: number;
  ventoMeta: number;
}

type TipoNuvola = 'cumulo' | 'piccola' | 'striata' | 'torre' | 'nebbia';

interface Sbuffo {
  dx: number;
  dy: number;
  rx0: number;
  ry0: number;
  ph: number;
  f: number;
  vita: number;
  dv: number;
  fisso: boolean;
  eT: SVGEllipseElement;
  eP: SVGEllipseElement;
}

export interface Nuvola {
  x: number;
  y: number;
  vel: number;
  tipo: TipoNuvola;
  sbuffi: Sbuffo[];
  timer: number;
  temporanea: boolean;
  meta: number | null;
  W: number;
  bassa: boolean;
  g: SVGGElement;
  tratto: SVGGElement;
  pieno: SVGGElement;
}

export interface OpzioniNuvola {
  tipo?: TipoNuvola;
  y?: number;
  vel?: number;
  temporanea?: boolean;
  meta?: number | null;
  bassa?: boolean;
  contenitore?: Element;
}

export interface Cielo {
  SOLE: Sole;
  LUCE: Luce;
  VENTO: Vento;
  atmosfera: Atmosfera;
  nuvole: Nuvola[];
  vettoreOmbra(h: number): { x: number; y: number };
  ventoIn(x: number): number;
  /** Chiamata quando la luce cambia in modo visibile: chi disegna ombre (i recinti) le ridisegna. */
  suCambioLuce: (() => void) | null;
  nuovaNuvola(x: number, o?: OpzioniNuvola): Nuvola;
  impostaOra(ora: OraDelGiorno): void;
  /** Accende o spegne il cielo di tempesta (bozza, riga 2225). */
  impostaTempesta(acceso: boolean): void;
  /** Sole, vento e atmosfera: a ogni passo della scena. */
  passo(dt: number): void;
  /** Nuvole: 30 volte al secondo. */
  passoNuvole(dt: number): void;
  distruggi(): void;
}

export function creaCielo(ctx: Contesto): Cielo {
  const rand = (a: number, b: number) => a + ctx.caso() * (b - a);
  const scegliUno = <E>(l: E[]): E => l[Math.floor(ctx.caso() * l.length)]!;
  const { sole: gSole, nuvoleSvg, mondo, schermo, flora } = ctx.el;

  const SOLE: Sole = { x: 306, y: 86, meta: 86, copertura: 0 };
  const LUCE: Luce = { lung: 0.45, op: 0.16, dx: -0.55, chiave: '' };
  const VENTO: Vento = { prossima: 5, raffica: null, extra: 0 };
  const atmosfera: Atmosfera = { tempesta: 0, tempestaMeta: 0, geloErba: 0, geloErbaMeta: 0, ventoMeta: 0 };
  const nuvole: Nuvola[] = [];
  const penombra = mondo.querySelector<HTMLElement>('.penombra');

  const vettoreOmbra = (h: number) => ({ x: LUCE.dx * LUCE.lung * h, y: 0.42 * LUCE.lung * h });

  /* ---------- Sole ---------- */
  let raggiSole = '';
  for (let i = 0; i < 12; i++) {
    const h = i % 2 ? 11 : 17;
    raggiSole += `<rect x="-3.5" y="${-h / 2}" width="7" height="${h}" rx="3.5" style="fill:var(--sole)" stroke="${P.notte}" stroke-width="2"/>`;
  }
  gSole.innerHTML = `<g class="raggi">${raggiSole}</g><circle r="24" style="fill:var(--sole)" stroke="${P.notte}" stroke-width="2.5"/>`;
  const raggi = gSole.querySelector(".raggi")!.children;

  const cielo: Cielo = {
    SOLE, LUCE, VENTO, atmosfera, nuvole, vettoreOmbra,
    suCambioLuce: null,
    ventoIn,
    nuovaNuvola,
    impostaOra,
    impostaTempesta,
    passo,
    passoNuvole,
    distruggi() {
      nuvole.length = 0;
      nuvoleSvg.innerHTML = '';
      gSole.innerHTML = '';
    },
  };

  function aggiornaSole(dt: number): void {
    const T = ctx.T;
    SOLE.y += (SOLE.meta - SOLE.y) * Math.min(1, dt * 0.6);
    const giro = T * 5, spento = 1 - SOLE.copertura * 0.6;
    for (let i = 0; i < raggi.length; i++) {
      const d = (i % 2 ? 32 : 35) + Math.sin(T * 2.1 + i * 1.7) * 2.6 * spento;
      raggi[i]!.setAttribute('transform', `rotate(${(giro + i * 30).toFixed(2)}) translate(0 ${(-d).toFixed(2)})`);
    }
    gSole.setAttribute('transform', `translate(${SOLE.x} ${SOLE.y.toFixed(2)})`);
    LUCE.lung = clamp(0.45 + ((SOLE.y - 86) / 46) * 0.75, 0.45, 1.7);
    LUCE.op = 0.17 * (1 - 0.72 * SOLE.copertura) * clamp((172 - SOLE.y) / 40, 0, 1) * (1 - atmosfera.tempesta * 0.8);
    if (penombra) penombra.style.opacity = (SOLE.copertura * 0.055 + atmosfera.tempesta * 0.1).toFixed(3);
    const chiave = `${LUCE.lung.toFixed(2)}|${LUCE.op.toFixed(3)}`;
    if (chiave !== LUCE.chiave) {
      LUCE.chiave = chiave;
      mondo.style.setProperty('--ox', `${(LUCE.dx * LUCE.lung * 10).toFixed(1)}px`);
      mondo.style.setProperty('--oy', `${(LUCE.lung * 9).toFixed(1)}px`);
      mondo.style.setProperty('--oop', LUCE.op.toFixed(3));
      cielo.suCambioLuce?.();
    }
  }

  /* ---------- Vento: un respiro leggero sempre, e ogni tanto una raffica che attraversa il prato da sinistra a destra ---------- */
  function ventoIn(x: number): number {
    const T = ctx.T;
    let w = 0.1 * Math.sin(T * 1.1 + x * 0.018) + 0.05 * Math.sin(T * 2.6 + x * 0.05);
    const r = VENTO.raffica;
    if (r) {
      const d = (x - r.fronte) / 120;
      w += r.forza * Math.exp(-d * d);
    }
    return w + VENTO.extra * (0.85 + 0.15 * Math.sin(T * 3 + x * 0.03));
  }

  function aggiornaVento(dt: number): void {
    VENTO.prossima -= dt;
    if (!VENTO.raffica && VENTO.prossima <= 0) {
      VENTO.raffica = { fronte: -300, forza: rand(0.55, 1) };
      VENTO.prossima = rand(7, 13);
      ctx.suona('folata', VENTO.raffica.forza);
    }
    if (VENTO.raffica) {
      VENTO.raffica.fronte += 330 * dt;
      if (VENTO.raffica.fronte > 760) VENTO.raffica = null;
    }
  }

  /** Tempesta, vento del meteo e gelo dell'erba seguono la loro meta (bozza, righe 2236–2239). */
  function aggiornaAtmosfera(dt: number): void {
    atmosfera.tempesta += (atmosfera.tempestaMeta - atmosfera.tempesta) * Math.min(1, dt * 1.2);
    VENTO.extra += (atmosfera.ventoMeta - VENTO.extra) * Math.min(1, dt * 1.6);
    atmosfera.geloErba += (atmosfera.geloErbaMeta - atmosfera.geloErba) * Math.min(1, dt * 1.5);
    flora.classList.toggle('ghiacciato', atmosfera.geloErba > 0.5);
  }

  function impostaTempesta(acceso: boolean): void {
    schermo.classList.toggle('tempesta', acceso);
    atmosfera.tempestaMeta = acceso ? 1 : 0;
  }

  /* ---------- Nuvole che cambiano forma ---------- */
  function nuovaNuvola(x: number, o: OpzioniNuvola = {}): Nuvola {
    const tipo: TipoNuvola = o.tipo || scegliUno<TipoNuvola>(['cumulo', 'cumulo', 'piccola', 'striata', 'torre', 'cumulo', 'piccola']);
    const g = document.createElementNS(NS, 'g');
    const tratto = document.createElementNS(NS, 'g');
    tratto.setAttribute('fill', P.notte);
    tratto.setAttribute('stroke', P.notte);
    tratto.setAttribute('stroke-width', '5');
    const pieno = document.createElementNS(NS, 'g');
    pieno.setAttribute('style', 'fill:var(--nuvola)');
    g.append(tratto, pieno);
    const n: Nuvola = {
      x, y: o.y ?? (tipo === 'striata' ? rand(16, 38) : rand(30, 72)), vel: o.vel ?? rand(3, 8), tipo, sbuffi: [], timer: rand(1.5, 4),
      temporanea: !!o.temporanea, meta: o.meta ?? null, W: 60, bassa: !!o.bassa, g, tratto, pieno,
    };
    (o.contenitore ?? nuvoleSvg).appendChild(g);
    formaNuvola(n);
    nuvole.push(n);
    return n;
  }

  function sbuffo(n: Nuvola, dx: number, dy: number, rx: number, ry: number, o: { vita?: number; dv?: number; fisso?: boolean } = {}): Sbuffo {
    const s: Sbuffo = {
      dx, dy, rx0: rx, ry0: ry, ph: rand(0, 6.28), f: rand(0.25, 0.6), vita: o.vita ?? 1, dv: o.dv ?? 0, fisso: !!o.fisso,
      eT: document.createElementNS(NS, 'ellipse'), eP: document.createElementNS(NS, 'ellipse'),
    };
    n.tratto.appendChild(s.eT);
    n.pieno.appendChild(s.eP);
    n.sbuffi.push(s);
    return s;
  }

  function formaNuvola(n: Nuvola): void {
    n.sbuffi.forEach((s) => { s.eT.remove(); s.eP.remove(); });
    n.sbuffi = [];
    if (n.tipo === 'cumulo') {
      const W = rand(80, 140), m = 5 + Math.floor(rand(0, 3));
      n.W = W;
      for (let i = 0; i < m; i++) {
        const t = i / (m - 1), r = rand(12, 18) + (1 - Math.abs(t - 0.5) * 2) * rand(6, 13);
        sbuffo(n, -W / 2 + t * W + rand(-6, 6), -r * 0.55 + rand(-3, 3), r, r);
      }
      sbuffo(n, 0, 5, W / 2 + 10, 9, { fisso: true });
    } else if (n.tipo === 'piccola') {
      const W = rand(30, 52), m = 3 + Math.floor(rand(0, 2));
      n.W = W;
      for (let i = 0; i < m; i++) {
        const r = rand(8, 13);
        sbuffo(n, -W / 2 + (i / (m - 1)) * W, -r * 0.4 + rand(-2, 2), r, r);
      }
      sbuffo(n, 0, 3, W / 2 + 6, 6, { fisso: true });
    } else if (n.tipo === 'nebbia') {
      // Banco di nebbia: una nuvola bassa e larga, gonfia sopra e piatta sotto
      const W = 470, m = 11;
      n.W = W;
      for (let i = 0; i < m; i++) {
        const t = i / (m - 1), r = rand(34, 48) + (1 - Math.abs(t - 0.5) * 2) * rand(10, 22);
        sbuffo(n, -W / 2 + t * W + rand(-10, 10), -r * 0.45 + rand(-6, 6), r, r);
      }
      for (let i = 0; i < 6; i++) sbuffo(n, -W / 2 + 40 + (i / 5) * (W - 80) + rand(-12, 12), rand(18, 30), rand(30, 42), rand(24, 32));
      sbuffo(n, 0, 34, W / 2 + 26, 26, { fisso: true });
    } else if (n.tipo === 'striata') {
      const W = rand(110, 170), m = 3 + Math.floor(rand(0, 3));
      n.W = W;
      for (let i = 0; i < m; i++) sbuffo(n, -W / 2 + (i / (m - 1)) * W + rand(-8, 8), rand(-6, 6), rand(18, 34), rand(4.5, 7));
    } else {
      n.W = 50;
      for (let i = 0; i < 6; i++) {
        const r = 21 - i * 2 + rand(-2, 2);
        sbuffo(n, rand(-10, 10) + (i % 2 ? 8 : -8), -i * 10, r, r);
      }
      sbuffo(n, 0, 6, 34, 9, { fisso: true });
    }
  }

  function passoNuvole(dt: number): void {
    const T = ctx.T;
    let copre = 0;
    for (let i = nuvole.length - 1; i >= 0; i--) {
      const n = nuvole[i]!;
      if (n.meta != null) n.x += (n.meta - n.x) * Math.min(1, dt * 0.5);
      else n.x += n.vel * (1 + (n.bassa ? 0.4 : 3) * Math.max(0, ventoIn(n.x))) * dt;
      if (n.x - n.W > 830) {
        if (n.temporanea) {
          n.g.remove();
          nuvole.splice(i, 1);
          continue;
        }
        n.x = -460 - rand(0, 120);
        n.tipo = scegliUno<TipoNuvola>(['cumulo', 'piccola', 'striata', 'torre', 'cumulo']);
        n.y = n.tipo === 'striata' ? rand(16, 38) : rand(30, 72);
        formaNuvola(n);
      }
      // Le nuvole cambiano forma: uno sbuffo si scioglie e un altro nasce accanto
      n.timer -= dt;
      if (n.timer <= 0) {
        n.timer = rand(2, 4.5);
        const vivi = n.sbuffi.filter((s) => !s.fisso && s.dv >= 0);
        if (vivi.length > 2) scegliUno(vivi).dv = -0.28;
        const base = scegliUno(vivi.length ? vivi : n.sbuffi);
        if (base) {
          const r = n.tipo === 'striata' ? rand(16, 30) : n.tipo === 'nebbia' ? rand(32, 54) : rand(9, 20), ry = n.tipo === 'striata' ? rand(4.5, 7) : r;
          sbuffo(n, clamp(base.dx + rand(-1, 1) * base.rx0, -n.W / 2 - 8, n.W / 2 + 8), base.dy + rand(-0.6, 0.3) * base.ry0, r, ry, { vita: 0, dv: 0.28 });
        }
      }
      for (let j = n.sbuffi.length - 1; j >= 0; j--) {
        const s = n.sbuffi[j]!;
        s.vita += s.dv * dt;
        if (s.vita >= 1) { s.vita = 1; s.dv = 0; }
        if (s.vita <= 0 && s.dv < 0) {
          s.eT.remove();
          s.eP.remove();
          n.sbuffi.splice(j, 1);
          continue;
        }
        if (!s.fisso) s.dx += Math.sin(T * 0.2 + s.ph) * dt * 0.9;
        const k = Math.max(0, s.vita) * (1 + (s.fisso ? 0.02 : 0.07) * Math.sin(T * s.f + s.ph));
        const cx = n.x + s.dx, cy = n.y + s.dy, rx = s.rx0 * k, ry = s.ry0 * k;
        for (const e of [s.eT, s.eP]) {
          e.setAttribute('cx', cx.toFixed(1));
          e.setAttribute('cy', cy.toFixed(1));
          e.setAttribute('rx', rx.toFixed(1));
          e.setAttribute('ry', ry.toFixed(1));
        }
        const d = Math.hypot(cx - SOLE.x, (cy - SOLE.y) * (rx / Math.max(ry, 1)));
        if (!n.bassa && d < rx + 12) copre = Math.max(copre, clamp((rx + 12 - d) / 18, 0, 1));
      }
    }
    SOLE.copertura += (copre - SOLE.copertura) * Math.min(1, dt * 2.5);
  }

  function passo(dt: number): void {
    aggiornaVento(dt);
    aggiornaAtmosfera(dt);
    aggiornaSole(dt);
  }

  /** Classi `ora-*` sullo schermo, quanto è sera e a che altezza va il sole (bozza, righe 1977–1982). */
  function impostaOra(ora: OraDelGiorno): void {
    for (const o of ORE) schermo.classList.toggle('ora-' + o, o === ora);
    ctx.sera = SERA_PER_ORA[ora];
    SOLE.meta = ALTEZZA_SOLE[ora];
  }

  // Nuvole iniziali
  for (const x of [-300, -60, 140, 330, 560]) nuovaNuvola(x + rand(-30, 30));
  return cielo;
}
