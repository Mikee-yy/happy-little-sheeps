// Gli ordini della scena: le animazioni che la regia della partita chiede (meteo, Guai, dado, Testata, Beee-NO!, zoom).
// Bozza scena.src.html: righe 1897–1907 (carte che volano), 1998–2033 (dado), 2042–2058 (testata), 2060–2082 (Beee-NO!)
// e 2083–2105 (Guaio). Senza le regole finte: la faccia del dado, il bersaglio e la quantità della Testata li dà la regia,
// il Guaio non dà la consolazione, e i conti (mazzo, mani, scarti) li mette in pari la fotografia successiva.
// Gli ordini che durano sono eventi della regia (bozza, riga 463). Quando il tavolo si ricostruisce (`interrompi`)
// le attese finiscono subito, i voli si annullano e ogni ordine in corso si ferma senza toccare il tavolo nuovo.
import { defCarta } from '../../../engine/src';
import type { IdCarta, IdGiocatore, Luogo } from '../../../engine/src';
import { T } from '../testi';
import type { Camera } from './camera';
import { cartaSVG, retroSVG } from './carte/carte';
import { trasf } from './mano';
import type { Meteo } from './meteo/indice';
import { manoInScena } from './misure';
import type { Palco } from './palco';
import type { TipoReazione } from './personaggi/pecora';
import { posaDado } from './tavolo/coperta';

export interface Ordini {
  /** Sposta fino a `n` agnellini (limitato dai posti liberi e da chi c'è); restituisce quanti partono. */
  spostaAgnellini(n: number, da: Luogo, a: Luogo, modo?: 'corre' | 'vola'): number;
  /** Solo l'effetto (con lo zoom se chi non sta in basso); niente se il Guaio non ha effetto. */
  meteo(carta: IdCarta, chi: IdGiocatore): Promise<void>;
  /** Carta in volo dal mazzo dei Guai, meteo, carta nell'angolo di chi. */
  guaio(carta: IdCarta, chi: IdGiocatore): Promise<void>;
  fermaMeteo(): void;
  /** Lancio animato che si ferma su quella faccia (id della faccia del motore). */
  dado(faccia: string): Promise<void>;
  /** Il montone e `quanti` agnellini del bersaglio in volo verso il gregge. */
  testata(chi: IdGiocatore, bersaglio: IdGiocatore, quanti: number): Promise<void>;
  beeeNo(chi: IdGiocatore): Promise<void>;
  inquadra(chi: IdGiocatore): Promise<void>;
  sgancia(): Promise<void>;
  fumetto(chi: IdGiocatore, testo: string, ms?: number): void;
  reagisci(chi: IdGiocatore, tipo: TipoReazione): void;
}

export interface OrdiniDelTeatro extends Ordini {
  /** Il tavolo si ricostruisce: attese finite, voli annullati, ordini in corso fermati. */
  interrompi(): void;
}

/** Una posa di carta in volo: centro, scala, rotazione, giro sull'asse verticale; `o` è la posizione nel volo (0–1). */
interface Tappa {
  x: number;
  y: number;
  k: number;
  r?: number;
  f?: number;
  sy?: number;
  o?: number;
}

/** Elementi degli ordini sul prato e nell'interfaccia: si tolgono quando il tavolo si ricostruisce. */
export const ELEMENTI_ORDINI = '.volante, .montone, .linee-zoom';

const CENTRO_TAVOLO = { x: 195, y: 360, k: 0.5 };

export function creaOrdini(palco: Palco, camera: Camera, meteo: Meteo): OrdiniDelTeatro {
  const { ctx } = palco;
  const { el, regia } = ctx;
  const rand = (a: number, b: number) => a + ctx.caso() * (b - a);
  const attese = new Map<number, () => void>();
  const animazioni = new Set<Animation>();
  /** L'ultima posa del dado: rotazione (già normalizzata come sulla coperta) e punto in cui è atterrato. */
  let rot = { x: 0, y: 0 };
  let salto = { x: 0, y: 0 };

  /** Attesa sull'orologio della scena che finisce subito se il tavolo si ricostruisce. */
  function attendi(ms: number): Promise<void> {
    return new Promise((fine) => {
      const t = ctx.orologio.dopo(() => {
        attese.delete(t);
        fine();
      }, ms);
      attese.set(t, fine);
    });
  }

  /** Un'animazione degli ordini: la sua fine (anche annullata) come promessa che non fallisce. */
  function anima(e: Element, f: Keyframe[], o: KeyframeAnimationOptions): Promise<void> {
    const a = ctx.anima(e, f, o);
    animazioni.add(a);
    const via = () => {
      animazioni.delete(a);
    };
    return a.finished.then(via, via);
  }

  /** Dove sta un elemento, in coordinate della scena (bozza, riga 354). */
  function inScena(e: Element) {
    const r = e.getBoundingClientRect(), m = el.ui.getBoundingClientRect(), S = ctx.S || 1;
    return {
      x: (r.left - m.left) / S,
      y: (r.top - m.top) / S,
      w: r.width / S,
      h: r.height / S,
      cx: (r.left + r.width / 2 - m.left) / S,
      cy: (r.top + r.height / 2 - m.top) / S,
    };
  }

  /** La cima di una pila (bozza, righe 1907 e 1950). */
  function cimaDi(e: Element): Tappa {
    const c = e.lastElementChild || e;
    const r = inScena(c);
    return { x: r.cx, y: r.cy, k: r.w / 250, sy: r.w ? r.h / r.w / 1.4 : 1 };
  }

  /* ---------- Carte che volano (bozza, righe 1897–1906) ---------- */
  function volante(id: IdCarta | null, guai: boolean): HTMLElement {
    const v = document.createElement('div');
    v.className = 'volante';
    v.innerHTML = `<div class="faccia">${id ? cartaSVG(id, true) : ''}</div><div class="faccia retro">${retroSVG(guai)}</div>`;
    el.ui.appendChild(v);
    return v;
  }
  function vola(v: HTMLElement, tappe: Tappa[], durata: number, easing = 'cubic-bezier(.35,.75,.3,1)'): Promise<void> {
    const fotogrammi = tappe.map((p): Keyframe => (p.o === undefined ? { transform: trasf(p) } : { transform: trasf(p), offset: p.o }));
    return anima(v, fotogrammi, { duration: ctx.ridotto ? 120 : durata, easing, fill: 'forwards' });
  }

  /** Lo scoppio del Beee-NO!: tonfo, belato, vibrazione, il prato che trema (bozza, righe 2061–2067). */
  function scoppio(): void {
    ctx.suona('tonfo');
    ctx.suona('beee', 0.8);
    ctx.vibra('beeeNo');
    if (!ctx.ridotto) {
      void anima(
        el.mondo,
        [{ transform: 'none' }, { transform: 'translate(-9px,3px)' }, { transform: 'translate(8px,-4px)' }, { transform: 'translate(-5px,2px)' }, { transform: 'translate(3px,0)' }, { transform: 'none' }],
        { duration: 420 },
      );
    }
    void anima(
      el.scoppio,
      [
        { transform: 'scale(0) rotate(-18deg)', opacity: 1 },
        { transform: 'scale(1.15) rotate(4deg)', opacity: 1, offset: 0.3 },
        { transform: 'scale(1) rotate(-3deg)', opacity: 1, offset: 0.45 },
        { transform: 'scale(1) rotate(-3deg)', opacity: 1, offset: 0.85 },
        { transform: 'scale(0) rotate(12deg)', opacity: 1 },
      ],
      { duration: ctx.ridotto ? 600 : 1400, easing: 'ease-out' },
    );
  }

  async function beeeNo(chi: IdGiocatore): Promise<void> {
    const gen = palco.generazione();
    const vivo = () => gen === palco.generazione();
    const g = palco.posto(chi);
    if (!g) return;
    palco.fumetto(chi, T.scena.fumetti.beeeNo);
    palco.reagisci(chi, 'salto');
    const v = volante('beee-no', false);
    const da: Tappa =
      chi === palco.inBasso() || !g.ventaglio
        ? manoInScena({ x: 195, y: 800, k: 0.37, f: 0 }, ctx.KD)
        : { ...camera.inScenaDaMondo(g.ventaglio[0], g.ventaglio[1] - 14), k: 0.08, f: 180 };
    const centro: Tappa = { ...CENTRO_TAVOLO, r: 5, f: 0 };
    await vola(v, [da, centro], 520);
    if (!vivo()) return void v.remove();
    scoppio();
    await attendi(900);
    if (!vivo()) return void v.remove();
    await vola(v, [centro, { ...cimaDi(el.scarti), r: rand(-12, 12) }], 420, 'cubic-bezier(.5,0,.5,1)');
    v.remove();
  }

  async function guaio(carta: IdCarta, chi: IdGiocatore): Promise<void> {
    const gen = palco.generazione();
    const vivo = () => gen === palco.generazione();
    const g = palco.posto(chi);
    if (!g) return;
    const io = chi === palco.inBasso();
    const da = cimaDi(el.mazzoGuai);
    ctx.suona('fruscio');
    if (io) ctx.vibra('guaio');
    const v = volante(carta, true);
    const centro: Tappa = { ...CENTRO_TAVOLO, r: -3, f: 0 };
    await vola(v, [{ ...da, f: 180 }, centro], 560);
    if (!vivo()) return void v.remove();
    ctx.suona('tonfo');
    palco.fumetto(chi, T.scena.fumetti.guaio(defCarta(carta).nome));
    palco.reagisci(chi, 'paura');
    // Il meteo parte mentre la carta resta un momento al centro
    const effetto = meteo.haEffetto(carta) ? meteo.avvia(carta, chi) : Promise.resolve();
    await attendi(1100);
    if (!vivo()) return void v.remove();
    const quanti = palco.angolo(chi).length;
    let arrivo: Tappa;
    if (io) arrivo = { x: 29 + quanti * 25, y: 652, k: 38 / 250, r: (quanti - quanti / 2) * 7 };
    else {
      const [gx, gy] = g.guai;
      arrivo = { ...camera.inScenaDaMondo(gx + quanti * 13 + 12, gy + 17), k: (24 / 250) * camera.zoom(), r: 0 };
    }
    await vola(v, [centro, arrivo], 480, 'cubic-bezier(.5,0,.5,1)');
    v.remove();
    if (!vivo()) return;
    palco.aggiungiAngolo(chi, carta);
    await effetto;
  }

  async function dado(faccia: string): Promise<void> {
    const f = posaDado(faccia);
    const giri = (v: number) => Math.ceil(v / 360) * 360 + 720;
    // La rotazione finale è quella della coperta (la fotografia successiva la rimette uguale): niente scatti a fine lancio
    const meta = { x: giri(rot.x) + f.rx, y: giri(rot.y) + f.ry };
    const da = salto, a = { x: rand(-34, 34), y: rand(-2, 18) };
    salto = a;
    ctx.suona('dado');
    const durata = ctx.ridotto ? 1 : 1150;
    const saltoEl = el.dadoPos.querySelector('.dado-salto');
    if (saltoEl) {
      void anima(
        saltoEl,
        [
          { transform: `translate3d(${da.x}px,${da.y}px,0)` },
          { transform: `translate3d(${(da.x + a.x) / 2 - 20}px,${(da.y + a.y) / 2 - 30}px,130px)`, offset: 0.35 },
          { transform: `translate3d(${a.x}px,${a.y}px,0)`, offset: 0.68 },
          { transform: `translate3d(${a.x}px,${a.y}px,26px)`, offset: 0.82 },
          { transform: `translate3d(${a.x}px,${a.y}px,0)` },
        ],
        { duration: durata, easing: 'ease-out', fill: 'forwards' },
      );
    }
    // L'ombra resta sulla tovaglia e segue il dado: più piccola e chiara quando il dado è in alto
    const ombra = el.coperta.querySelector('.dado-ombra');
    if (ombra) {
      void anima(
        ombra,
        [
          { transform: `translate(${da.x}px,${da.y}px)`, opacity: 1 },
          { transform: `translate(${(da.x + a.x) / 2 - 20}px,${(da.y + a.y) / 2 - 30}px) scale(.55)`, opacity: 0.45, offset: 0.35 },
          { transform: `translate(${a.x}px,${a.y}px)`, opacity: 1, offset: 0.68 },
          { transform: `translate(${a.x}px,${a.y}px) scale(.88)`, opacity: 0.8, offset: 0.82 },
          { transform: `translate(${a.x}px,${a.y}px)`, opacity: 1 },
        ],
        { duration: durata, easing: 'ease-out', fill: 'forwards', composite: 'replace' },
      );
    }
    // La rotazione passa dall'orologio della scena, così accelera con le animazioni veloci e col salto
    const prima = el.dado.style.transform;
    const dopo = `translateZ(24px) rotateZ(${f.rz}deg) rotateX(${meta.x}deg) rotateY(${meta.y}deg)`;
    void anima(el.dado, [{ transform: prima }, { transform: dopo }], { duration: durata, easing: 'cubic-bezier(.2,.75,.3,1)' });
    palco.coperta.dado(faccia);
    rot = { x: f.rx, y: f.ry };
    await attendi(ctx.ridotto ? 50 : 1250);
  }

  async function testata(_chi: IdGiocatore, bersaglio: IdGiocatore, quanti: number): Promise<void> {
    const gen = palco.generazione();
    const a = palco.area(bersaglio);
    if (!a) return;
    const yPista = a.y1 + 2, xImpatto = a.x0 + 10;
    const m = document.createElement('div');
    m.className = 'abs montone';
    m.style.cssText = `left:0;top:0;width:150px;z-index:${100 + yPista + 8};pointer-events:none;transform-origin:75px 102px`;
    m.innerHTML = '<svg viewBox="0 0 220 160" style="display:block;width:100%;overflow:visible" aria-hidden="true"><use href="#montone"/></svg>';
    el.mondo.appendChild(m);
    const kk = palco.profondita(yPista) * 1.1, pos = (x: number) => `translate(${x - 75}px,${yPista - 102}px) scale(${kk})`;
    ctx.suona('beee', 0.6);
    await anima(m, [{ transform: pos(-160) }, { transform: pos(xImpatto - 40) }], {
      duration: ctx.ridotto ? 1 : 750,
      easing: 'cubic-bezier(.5,0,.9,.6)',
      fill: 'forwards',
    });
    if (gen !== palco.generazione()) return void m.remove();
    ctx.suona('tonfo');
    palco.reagisci(bersaglio, 'paura');
    void anima(el.mondo, [{ transform: 'none' }, { transform: 'translate(-5px,2px)' }, { transform: 'translate(4px,-2px)' }, { transform: 'none' }], {
      duration: ctx.ridotto ? 1 : 260,
    });
    palco.branco()?.sposta(quanti, bersaglio, 'gregge', 'vola');
    await anima(m, [{ transform: pos(xImpatto - 40) }, { transform: pos(xImpatto - 70) + ' rotate(-6deg)', offset: 0.25 }, { transform: pos(560) }], {
      duration: ctx.ridotto ? 1 : 1100,
      easing: 'ease-in',
      fill: 'forwards',
    });
    m.remove();
  }

  const meteoEvento = regia.conEvento('meteo', (carta: IdCarta, chi: IdGiocatore) => meteo.avvia(carta, chi));
  const inquadraEvento = regia.conEvento('camera', (chi: IdGiocatore) => camera.inquadra(chi));
  const sganciaEvento = regia.conEvento('camera', () => camera.sgancia());

  return {
    spostaAgnellini: (n, da, a, modo = 'corre') => palco.branco()?.sposta(n, da, a, modo) ?? 0,
    meteo: (carta, chi) => meteoEvento(carta, chi),
    guaio: regia.conEvento('guaio', guaio),
    fermaMeteo: () => meteo.ferma(),
    dado: regia.conEvento('dado', dado),
    testata: regia.conEvento('testata', testata),
    beeeNo: regia.conEvento('beeeNo', beeeNo),
    inquadra: (chi) => inquadraEvento(chi),
    sgancia: () => sganciaEvento(),
    fumetto: (chi, testo, ms) => palco.fumetto(chi, testo, ms),
    reagisci: (chi, tipo) => palco.reagisci(chi, tipo),
    interrompi() {
      for (const a of [...animazioni]) {
        try {
          a.cancel();
        } catch {
          /* già finita */
        }
      }
      animazioni.clear();
      for (const [t, fine] of [...attese]) {
        ctx.orologio.annulla(t);
        attese.delete(t);
        fine();
      }
      rot = { x: 0, y: 0 };
      salto = { x: 0, y: 0 };
    },
  };
}
