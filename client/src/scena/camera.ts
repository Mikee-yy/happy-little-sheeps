// L'inquadratura (bozza scena.src.html, righe 2129–2224): il prato si avvicina a un avversario lontano, l'interfaccia resta ferma.
// Avvicinandosi il suo recinto si allarga fino alle proporzioni del tuo e le postazioni degli altri avversari spariscono;
// allontanandosi tutto torna com'era e gli agnellini vengono spinti dentro.
// Differenze dalla bozza: la matrice della camera viene da `piattaforma.matriceDi` (senza, l'identità e lo zoom logico);
// i tween dei recinti tengono "in corso" l'evento finché non finiscono; `ferma` sgancia subito (ricostruzione del tavolo).
import type { IdGiocatore } from '../../../engine/src';
import { TAVOLOZZA as P } from './ambiente/paesaggio';
import type { Palco } from './palco';
import type { Area } from './personaggi/aree';
import { puntoLibero } from './personaggi/aree';
import { piattaforma } from './piattaforma';
import { disegnaRecinto, type FormaRecinto } from './tavolo/recinti';

const NS = 'http://www.w3.org/2000/svg';

/** "Il punto (cx, cy) del prato appare in (px, py) sullo schermo, ingrandito k volte". */
interface StatoCamera {
  cx: number;
  cy: number;
  k: number;
  px: number;
  py: number;
}

interface Tween {
  t: number;
  durata: number;
  fn: (q: number) => void;
  fine: () => void;
  chiave?: string;
}

type Riquadro = { x0: number; y0: number; x1: number; y1: number };

/** Un passo del recinto che torna alla sua forma: dove va un punto dell'area di prima, e di quanto rimpicciolisce ciò che c'è sopra. */
export interface MappaRecinto {
  punto(x: number, y: number): { x: number; y: number };
  /** Rapporto tra la scala del recinto di adesso e quella del passo prima. */
  k: number;
}

/** Chi segue il recinto: riceve ogni passo; se restituisce `false` smette di seguirlo. */
export type SeguaceRecinto = (m: MappaRecinto) => boolean | void;

export interface Camera {
  /** Si avvicina all'avversario `chi`; la promessa si risolve quando il recinto è allargato. */
  inquadra(chi: IdGiocatore): Promise<void>;
  /** Torna all'inquadratura intera; la promessa si risolve quando il recinto è tornato com'era. */
  sgancia(): Promise<void>;
  inquadrato(): IdGiocatore | null;
  /** Ingrandimento dell'inquadratura (1 senza zoom). */
  zoom(): number;
  /** Un punto del prato portato sullo schermo (bozza, riga 2132). */
  inScenaDaMondo(x: number, y: number): { x: number; y: number };
  /** Un passo della scena: i tween dei recinti (bozza, riga 2174). */
  passo(dt: number): void;
  /** Aree nascoste dalla messa a fuoco. */
  nascoste(): number;
  /** Recinti con una forma diversa da quella di partenza. */
  alterati(): number;
  /** Sgancia subito, senza animazioni (ricostruzione del tavolo). */
  ferma(): void;
  /** Durante la messa a fuoco nasconde anche gli elementi degli altri avversari creati dopo (allineamento calmo). */
  riapplica(): void;
  /**
   * Mentre il recinto di `chi` torna dalla forma ingrandita a quella normale, `fn` riceve ogni passo per spostare
   * in proporzione ciò che il meteo ha disegnato sul recinto (cespuglio, pozze, ghiaccioli). Gli agnellini dell'area
   * (anche quelli trattenuti dal meteo, con le loro mete) li sposta la camera.
   */
  seguiRecinto(chi: IdGiocatore, fn: SeguaceRecinto): void;
}

/** Quanto dura il ritorno all'inquadratura intera (camera e recinto): gli ordini lo usano per liberare la regia in tempo. */
export const DURATA_SGANCIA_MS = 950;

const morbido = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const conRitorno = (t: number) => {
  const c = 1.3;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};
const mescola = <O extends object>(a: O, b: O, q: number): O => {
  const x = a as Record<string, number>, y = b as Record<string, number>;
  return Object.fromEntries(Object.keys(x).map((k) => [k, x[k]! + (y[k]! - x[k]!) * q])) as O;
};
const areaDiRecinto = (r: FormaRecinto): Riquadro => {
  const p = r.yDavanti - r.yDietro;
  return { x0: r.x + r.larg * 0.05, x1: r.x + r.larg * 0.95, y0: r.yDietro + p * 0.12, y1: r.yDavanti - p * 0.07 };
};
const forma = (r: FormaRecinto): FormaRecinto => ({ x: r.x, yDietro: r.yDietro, yDavanti: r.yDavanti, larg: r.larg, k: r.k });

export function creaCamera(palco: Palco): Camera {
  const { ctx } = palco;
  const camera = ctx.el.camera;
  const rand = (a: number, b: number) => a + ctx.caso() * (b - a);
  const TWEEN: Tween[] = [];
  let statoCamera: StatoCamera | null = null;
  let inquadrato: IdGiocatore | null = null;

  function animaCamera(da: StatoCamera, a: StatoCamera, durata: number, assesta: boolean): void {
    const passi = 30;
    const fotogrammi: Keyframe[] = [];
    for (let i = 0; i <= passi; i++) {
      const t = i / passi, e = morbido(t), ek = assesta ? conRitorno(t) : e;
      const k = da.k * Math.pow(a.k / da.k, ek);
      const cx = da.cx + (a.cx - da.cx) * e, cy = da.cy + (a.cy - da.cy) * e, px = da.px + (a.px - da.px) * e, py = da.py + (a.py - da.py) * e;
      fotogrammi.push({ transform: `translate(${(px - cx * k).toFixed(2)}px,${(py - cy * k).toFixed(2)}px) scale(${k.toFixed(4)})` });
    }
    piattaforma.fermaAnimazioni(camera);
    ctx.anima(camera, fotogrammi, { duration: ctx.ridotto ? 1 : durata, easing: 'linear', fill: 'forwards' });
  }

  // Linee di zoom, come nei fumetti: convergono al centro per un istante quando si stringe sull'avversario
  function lineeZoom(px: number, py: number): void {
    if (ctx.ridotto) return;
    let s = '';
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2 + rand(-0.08, 0.08), r0 = rand(150, 190), r1 = r0 + rand(60, 130);
      s += `<path d="M${(Math.cos(a) * r0).toFixed(1)} ${(Math.sin(a) * r0).toFixed(1)} L${(Math.cos(a) * r1).toFixed(1)} ${(Math.sin(a) * r1).toFixed(1)}" stroke="${P.notte}" stroke-width="${rand(2, 4).toFixed(1)}" stroke-linecap="round"/>`;
    }
    const el = document.createElementNS(NS, 'svg');
    el.setAttribute('class', 'linee-zoom');
    el.setAttribute('width', '1');
    el.setAttribute('height', '1');
    el.style.cssText = `left:${px}px;top:${py}px`;
    el.innerHTML = `<g>${s}</g>`;
    ctx.el.ui.appendChild(el);
    const via = () => el.remove();
    ctx
      .anima(el.firstChild as Element, [{ transform: 'scale(1.35)', opacity: 0 }, { transform: 'scale(1.05)', opacity: 0.55, offset: 0.35 }, { transform: 'scale(.82)', opacity: 0 }], {
        duration: 650,
        easing: 'ease-out',
      })
      .finished.then(via, via);
  }

  // Un tween con una chiave sostituisce quello in corso con la stessa chiave (per esempio lo zoom annullato subito).
  // Finché dura, l'evento è in corso: il recinto non resta mai a metà quando la regia dice "finito"
  function tween(durata: number, fn: (q: number) => void, chiave?: string): Promise<void> {
    return new Promise((fine) => {
      if (chiave) for (let i = TWEEN.length - 1; i >= 0; i--) if (TWEEN[i]!.chiave === chiave) TWEEN.splice(i, 1)[0]!.fine();
      const chiudi = ctx.regia.apriEvento('camera');
      TWEEN.push({
        t: 0,
        durata: ctx.ridotto ? 0.01 : durata,
        fn,
        fine: () => {
          chiudi();
          fine();
        },
        chiave,
      });
    });
  }

  function passo(dt: number): void {
    for (let i = TWEEN.length - 1; i >= 0; i--) {
      const tw = TWEEN[i]!;
      tw.t += dt;
      const q = Math.min(1, tw.t / tw.durata);
      tw.fn(q);
      if (q >= 1) {
        TWEEN.splice(TWEEN.indexOf(tw), 1);
        tw.fine();
      }
    }
  }

  function recintoVicino(chi: IdGiocatore): FormaRecinto | null {
    const g = palco.posto(chi), A = palco.area(chi), io = palco.inBasso();
    const gIo = io ? palco.posto(io) : undefined, aIo = io ? palco.area(io) : undefined;
    const R = A?.recinto0 as FormaRecinto | undefined, r = aIo?.recinto0 as FormaRecinto | undefined;
    if (!g || !gIo || !R || !r) return null;
    const s = g.w / gIo.w;
    const larg = r.larg * s, prof = (r.yDavanti - r.yDietro) * s, pecoraASinistra = g.x < R.x;
    return { x: pecoraASinistra ? R.x : R.x + R.larg - larg, yDietro: R.yDavanti - prof, yDavanti: R.yDavanti, larg, k: s };
  }

  function cambiaRecinto(chi: IdGiocatore, verso: 'vicino' | 'lontano', durata: number): Promise<void> {
    const A = palco.area(chi);
    const R0 = A?.recinto0 as FormaRecinto | undefined;
    const vicino = verso === 'vicino' ? recintoVicino(chi) : null;
    if (!A || !R0 || !A.area0 || (verso === 'vicino' && !vicino)) return Promise.resolve();
    const daR = forma((A.recinto as FormaRecinto | undefined) ?? R0);
    const daA: Riquadro = { x0: A.x0, y0: A.y0, x1: A.x1, y1: A.y1 };
    const [x0, y0, x1, y1] = A.area0;
    const aR = vicino ?? forma(R0);
    const aA = vicino ? areaDiRecinto(vicino) : { x0, y0, x1, y1 };
    let kPrima = daR.k;
    // Con la chiave, uno zoom annullato subito non lascia il recinto a metà
    return tween(
      durata,
      (q) => {
        const e = morbido(q);
        const r = mescola(daR, aR, e);
        disegnaRecinto(ctx, A, r);
        const prima: Riquadro = { x0: A.x0, y0: A.y0, x1: A.x1, y1: A.y1 };
        Object.assign(A, mescola(daA, aA, e));
        // Tornando alla forma normale, ciò che sta nel recinto si stringe con lui (allargandosi, invece, gli agnellini
        // restano dove sono e poi usano lo spazio nuovo)
        if (verso === 'lontano') seguiPasso(chi, A, prima, r.k / (kPrima || 1));
        kPrima = r.k;
      },
      'recinto:' + chi,
    ).then(() => spingiDentro(A));
  }

  const seguaci = new Map<IdGiocatore, Set<SeguaceRecinto>>();

  /** Un passo del recinto che si stringe: agnellini (posizione, meta, mossa della regia) e seguaci in proporzione. */
  function seguiPasso(chi: IdGiocatore, A: Area, prima: Riquadro, k: number): void {
    const sx = prima.x1 - prima.x0 ? (A.x1 - A.x0) / (prima.x1 - prima.x0) : 1;
    const sy = prima.y1 - prima.y0 ? (A.y1 - A.y0) / (prima.y1 - prima.y0) : 1;
    const punto = (x: number, y: number) => ({ x: A.x0 + (x - prima.x0) * sx, y: A.y0 + (y - prima.y0) * sy });
    for (const g of A.agnelli) {
      // Chi corre o vola verso un'altra area segue la sua strada
      if (g.inViaggio) continue;
      ({ x: g.x, y: g.y } = punto(g.x, g.y));
      ({ x: g.tx, y: g.ty } = punto(g.tx, g.ty));
      if (g.mossa) ({ x: g.mossa.x, y: g.mossa.y } = punto(g.mossa.x, g.mossa.y));
    }
    const elenco = seguaci.get(chi);
    if (!elenco) return;
    for (const fn of [...elenco]) {
      let resta: boolean | void = false;
      try {
        resta = fn({ punto, k });
      } catch (e) {
        console.error(e);
      }
      if (resta === false) elenco.delete(fn);
    }
  }

  /** Gli agnellini usano lo spazio nuovo, o rientrano in quello vecchio. */
  function spingiDentro(A: Area): void {
    for (const g of A.agnelli) {
      if (g.regia || g.inViaggio) continue;
      const p = puntoLibero(A, g, ctx.caso);
      g.tx = p.x;
      g.ty = p.y;
      g.stato = 'cammina';
      g.poi = null;
    }
  }

  // Messa a fuoco: le postazioni degli altri avversari spariscono mentre sei vicino a uno di loro
  function sfuma(chi: IdGiocatore | null, attivo: boolean): void {
    const io = palco.inBasso();
    for (const c of palco.giocatori()) {
      if (c === io) continue;
      const via = attivo && c !== chi;
      // Tutto ciò che appartiene a quel giocatore porta data-chi: pecora, targa, segnalini, recinto, cartello, sterrato,
      // ventaglio, carte del round e mini-carte dei Guai (bozza, riga 2204, più quelli aggiunti nel pezzo 1)
      const selettore = `[data-chi="${c}"]`;
      ctx.el.mondo.querySelectorAll<HTMLElement | SVGElement>(selettore).forEach((e) => {
        e.style.opacity = via ? '0' : '';
        e.style.pointerEvents = via ? 'none' : '';
      });
      const a = palco.area(c);
      if (a) a.sfumata = via;
    }
  }

  function inquadra(chi: IdGiocatore): Promise<void> {
    const g = palco.posto(chi), io = palco.inBasso(), gIo = io ? palco.posto(io) : undefined;
    const v = recintoVicino(chi);
    if (!g || !gIo || !v || chi === io) return Promise.resolve();
    const K = gIo.w / g.w; // la sua pecora diventa grande come la tua
    const cx = (Math.min(g.x, v.x) + Math.max(g.x + g.w, v.x + v.larg)) / 2, cy = (Math.min(g.y, v.yDietro) + v.yDavanti) / 2 + 14;
    const da: StatoCamera = { cx, cy, k: 1, px: cx, py: cy };
    const a: StatoCamera = { cx, cy, k: K, px: 195, py: 330 };
    // Già vicino a un altro: il suo recinto torna com'era (nella bozza il meteo nuovo sgancia sempre prima)
    if (inquadrato && inquadrato !== chi) void cambiaRecinto(inquadrato, 'lontano', 0.95);
    animaCamera(da, a, 1150, true);
    const fatto = cambiaRecinto(chi, 'vicino', 1.15);
    sfuma(chi, true);
    lineeZoom(195, 330);
    ctx.suona('folata', 0.6, 0.9);
    statoCamera = a;
    inquadrato = chi;
    return fatto;
  }

  function sgancia(): Promise<void> {
    if (!inquadrato || !statoCamera) return Promise.resolve();
    const da = statoCamera, chi = inquadrato;
    inquadrato = null;
    statoCamera = null;
    animaCamera(da, { cx: da.cx, cy: da.cy, k: 1, px: da.cx, py: da.cy }, DURATA_SGANCIA_MS, false);
    const fatto = palco.area(chi) ? cambiaRecinto(chi, 'lontano', DURATA_SGANCIA_MS / 1000) : Promise.resolve();
    sfuma(chi, false);
    return fatto;
  }

  function zoom(): number {
    // Senza Web Animations (jsdom) la matrice non segue l'animazione: vale lo zoom logico
    if (typeof (camera as Element & { animate?: unknown }).animate !== 'function') return statoCamera?.k ?? 1;
    return piattaforma.matriceDi(camera)?.a ?? statoCamera?.k ?? 1;
  }

  return {
    inquadra,
    sgancia,
    inquadrato: () => inquadrato,
    zoom,
    inScenaDaMondo(x, y) {
      const m = piattaforma.matriceDi(camera);
      if (m) {
        const p = m.transformPoint({ x, y });
        return { x: p.x, y: p.y };
      }
      // Senza matrice vale l'identità
      return { x, y };
    },
    passo,
    nascoste() {
      let n = 0;
      for (const c of palco.giocatori()) if (palco.area(c)?.sfumata) n++;
      return n;
    },
    alterati() {
      let n = 0;
      for (const c of palco.giocatori()) {
        const a = palco.area(c);
        const r = a?.recinto as FormaRecinto | undefined, r0 = a?.recinto0 as FormaRecinto | undefined;
        if (!a || !r || !r0 || !a.area0) continue;
        const [x0, y0, x1, y1] = a.area0;
        const diverso = (p: number, q: number) => Math.abs(p - q) > 0.01;
        if (
          diverso(r.x, r0.x) || diverso(r.yDietro, r0.yDietro) || diverso(r.yDavanti, r0.yDavanti) || diverso(r.larg, r0.larg) ||
          diverso(a.x0, x0) || diverso(a.y0, y0) || diverso(a.x1, x1) || diverso(a.y1, y1)
        ) n++;
      }
      return n;
    },
    riapplica() {
      if (inquadrato) sfuma(inquadrato, true);
    },
    seguiRecinto(chi, fn) {
      let elenco = seguaci.get(chi);
      if (!elenco) seguaci.set(chi, (elenco = new Set()));
      elenco.add(fn);
    },
    ferma() {
      seguaci.clear();
      // I tween si chiudono senza finire: il tavolo sta per essere ricostruito con recinti nuovi
      for (const tw of TWEEN.splice(0)) tw.fine();
      piattaforma.fermaAnimazioni(camera);
      camera.style.transform = '';
      const chi = inquadrato;
      inquadrato = null;
      statoCamera = null;
      if (chi) sfuma(chi, false);
    },
  };
}
