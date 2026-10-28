// Meteo: i Guai del tipo Meteo (e il Lupo) cambiano il prato per qualche secondo (bozza scena.src.html, righe 2106–2128 e 2225–2335).
// Un solo meteo alla volta: quello nuovo ferma il precedente e ne pulisce le tracce.
// Differenze dalla bozza:
// - il meteo scrive solo le mete dell'atmosfera (`atmosfera.*Meta`, `impostaTempesta`): le insegue l'ambiente;
// - qui resta il resto di `aggiornaMeteo` (righe 2240–2254): pioggia, grandine, pecore bagnate, vento che spinge;
// - le attese del meteo sono timer dell'orologio che `ferma` annulla subito: un meteo fermato non tiene aperto l'evento;
// - senza ambiente (prove) non ci sono nuvole né particelle, ma gli agnellini si muovono lo stesso.
import { tipoDi } from '../../../../engine/src';
import type { IdGiocatore, Luogo } from '../../../../engine/src';
import { TAVOLOZZA as P } from '../ambiente/paesaggio';
import type { OpzioniParticella, TipoParticella } from '../ambiente/particelle';
import type { Camera, SeguaceRecinto } from '../camera';
import type { Orologio } from '../orologio';
import { H, W } from '../misure';
import { piattaforma } from '../piattaforma';
import type { Palco } from '../palco';
import type { Agnello, ManigliaMeteo } from '../personaggi/agnello';
import { clamp, type Area } from '../personaggi/aree';
import { effetto, muovi, prendi, rilascia } from '../personaggi/giochi';
import type { Pecora } from '../personaggi/pecora';
import type { FormaRecinto } from '../tavolo/recinti';

const NS = 'http://www.w3.org/2000/svg';

/** Lanciato da `ok()` quando il meteo è stato fermato: chi lo riceve smette senza errore. */
export const FERMATO = Symbol('meteo fermato');

/**
 * Gli agnellini lontani corrono, così il riparo è fatto entro ARRIVO_RIPARO secondi anche in un gregge molto largo
 * e la durata del meteo non dipende dal caso (bozza, riga 2259).
 */
export const ARRIVO_RIPARO = 1.8;

/** Il meteo in corso: le sue pulizie, i suoi timer, e `ok()` che si ferma se il meteo è finito. */
export interface Maniglia extends ManigliaMeteo {
  id: string;
  vivo: boolean;
  pulisci<F extends () => unknown>(f: F): F;
  /** Lancia FERMATO se il meteo è stato fermato. */
  ok(): void;
  /** Aspetta `ms` di scena, o fino a quando il meteo si ferma (non lancia). */
  pausa(ms: number): Promise<void>;
  /** Aspetta `ms` di scena, poi `ok()` (bozza, riga 2117). */
  attesa(ms: number): Promise<void>;
  /** Timer dell'orologio che il meteo annulla quando si ferma. */
  dopo(fn: () => void, ms: number): void;
  ogni(fn: () => void, ms: number): number;
  annulla(id: number): void;
}

/** Pioggia e grandine che cadono, pecore che si bagnano (bozza, riga 2109). */
export interface StatoMeteo {
  pioggia: number;
  grandine: number;
  bagna: boolean;
}

export interface OpzioniRannicchia {
  vel?: number;
  brivido?: boolean;
  guarda?: number;
  saltelli?: boolean;
}

/** Ciò che gli effetti del meteo usano: il palco e gli aiuti comuni. */
export interface Strumenti {
  palco: Palco;
  stato: StatoMeteo;
  rand(a: number, b: number): number;
  scegliUno<E>(l: readonly E[]): E;
  inBasso(): IdGiocatore | null;
  area(l: Luogo): Area;
  /** Le pecore di tutti i giocatori. */
  pecore(): Pecora[];
  particella(tipo: TipoParticella, x: number, y: number, o?: OpzioniParticella): void;
  impostaTempesta(acceso: boolean): void;
  /** Cielo di tempesta e nuvoloni per il meteo; la funzione restituita li manda via (bozza, righe 2226–2232). */
  tempestaPer(m: Maniglia, n: number): () => void;
  terraACaso(): { x: number; y: number };
  /** La parte del prato che si vede (senza ambiente: il riquadro della scena). */
  vista(): { x: number; y: number; w: number; h: number };
  rannicchia(m: Maniglia, a: Area, centri: Array<[number, number]>, sec: number, opz?: OpzioniRannicchia): Promise<void>;
  rannicchiaTutti(m: Maniglia, sec: number, opz?: OpzioniRannicchia): Promise<void>;
  svgLibero(x: number, y: number, z: number, html: string, cls?: string): SVGSVGElement;
  pozza(x: number, y: number, rx: number, z: number, extra?: string, durataComparsa?: number): { el: SVGSVGElement; sparisci(ms?: number): Promise<void> };
  testaPecora(chi: IdGiocatore): { x: number; y: number };
  dorsoPecora(chi: IdGiocatore): { x: number; y: number };
  scrollaAcqua(chi: IdGiocatore): void;
  fumata(x: number, y: number, n?: number, k?: number): void;
  saetta(da: [number, number], a: [number, number]): void;
  stalattiti(nome: Luogo, quanti: number): SVGSVGElement;
  /** Vedi `Camera.seguiRecinto`: per ciò che il meteo ha disegnato sul recinto ingrandito di `chi`. */
  seguiRecinto(chi: IdGiocatore, fn: SeguaceRecinto): void;
  /**
   * Un elemento libero (`svgLibero`) sul recinto ingrandito di `chi`: mentre il recinto torna normale si sposta e
   * rimpicciolisce con lui (z: lo strato per la nuova y), finché resta nella pagina.
   */
  seguiElemento(chi: IdGiocatore, el: HTMLElement | SVGElement, z?: (y: number) => number): void;
  /** Gli agnellini liberi (bozza, riga 1395). */
  libero(g: Agnello): boolean;
}

export type EffettoGuaio = (m: Maniglia, chi: IdGiocatore, s: Strumenti) => Promise<void>;

export interface Meteo {
  /** Ferma il meteo di prima e avvia quello del Guaio `carta` (niente se non ha effetto); con lo zoom se `chi` non sta in basso. */
  avvia(carta: string, chi: IdGiocatore): Promise<void>;
  ferma(): void;
  attivo(): boolean;
  /** Un passo della scena: pioggia, grandine, pecore bagnate, vento. */
  passo(dt: number): void;
  haEffetto(carta: string): boolean;
}

/** Elementi che il meteo mette sul prato: si tolgono subito quando il tavolo si ricostruisce. */
export const ELEMENTI_METEO = '.pozza, .saetta, .lampo, .gelo';

/** Il meteo in corso (bozza, righe 2113–2118), con i timer che si annullano quando si ferma. */
class ManigliaVera implements Maniglia {
  vivo = true;
  private readonly pulizie: Array<() => unknown> = [];
  /** Timer in sospeso → che cosa fare se il meteo si ferma prima (le pause finiscono subito). */
  private readonly timer = new Map<number, () => void>();

  constructor(
    private readonly orologio: Orologio,
    readonly id: string,
  ) {}

  pulisci<F extends () => unknown>(f: F): F {
    this.pulizie.push(f);
    return f;
  }

  ok(): void {
    if (!this.vivo) throw FERMATO;
  }

  pausa(ms: number): Promise<void> {
    if (!this.vivo) return Promise.resolve();
    return new Promise((fine) => {
      const t = this.orologio.dopo(() => {
        this.timer.delete(t);
        fine();
      }, ms);
      this.timer.set(t, fine);
    });
  }

  async attesa(ms: number): Promise<void> {
    await this.pausa(ms);
    this.ok();
  }

  dopo(fn: () => void, ms: number): void {
    if (!this.vivo) return;
    const t = this.orologio.dopo(() => {
      this.timer.delete(t);
      fn();
    }, ms);
    this.timer.set(t, () => undefined);
  }

  ogni(fn: () => void, ms: number): number {
    const t = this.orologio.ogni(fn, ms);
    if (this.vivo) this.timer.set(t, () => undefined);
    else this.orologio.annulla(t);
    return t;
  }

  annulla(t: number): void {
    this.orologio.annulla(t);
    this.timer.delete(t);
  }

  /** Ferma il meteo: le pulizie all'indietro (bozza, riga 2127), poi i timer annullati e le pause finite. */
  chiudi(): void {
    this.vivo = false;
    for (const f of this.pulizie.splice(0).reverse()) {
      try {
        f();
      } catch (e) {
        console.error(e);
      }
    }
    for (const [t, fine] of [...this.timer]) {
      this.orologio.annulla(t);
      this.timer.delete(t);
      fine();
    }
  }
}

export function creaMeteo(palco: Palco, camera: Camera, effetti: Readonly<Record<string, EffettoGuaio>>): Meteo {
  const { ctx } = palco;
  const rand = (a: number, b: number) => a + ctx.caso() * (b - a);
  const scegliUno = <E>(l: readonly E[]): E => l[Math.floor(ctx.caso() * l.length)]!;
  const stato: StatoMeteo = { pioggia: 0, grandine: 0, bagna: false };
  let attivo: ManigliaVera | null = null;
  const inBasso = () => palco.inBasso();

  // La regia chiede qui se un meteo è in corso
  ctx.meteoAttivo = () => attivo !== null;

  const area = (l: Luogo): Area => {
    const a = palco.area(l);
    if (!a) throw new Error(`Meteo: area sconosciuta "${l}"`);
    return a;
  };
  const pecore = (): Pecora[] => palco.giocatori().map((c) => palco.pecora(c)).filter((p): p is Pecora => !!p);
  const particella = palco.particella;
  const vista = () => palco.amb()?.vista() ?? { x: 0, y: 0, w: W, h: H };
  // Chi è alzato dal teatro (furto) non è libero: né i giochi né il meteo lo portano via mentre la domanda è sul tavolo
  const libero = (g: Agnello) => !g.regia && !g.sollevato && ['fermo', 'bruca', 'cammina', 'guarda'].includes(g.stato);

  function ferma(): void {
    const m = attivo;
    if (!m) return;
    attivo = null;
    m.chiudi();
  }

  /* ---------- Aiuti comuni (bozza, righe 2225–2335) ---------- */

  const impostaTempesta = (acceso: boolean) => palco.amb()?.impostaTempesta(acceso);

  function nuvoleTempesta(m: Maniglia, n = 3): () => void {
    const amb = palco.amb();
    const nuove = amb
      ? Array.from({ length: n }, (_, i) =>
          amb.nuovaNuvola(-260 - i * 140, { tipo: 'cumulo', temporanea: true, meta: 150 + i * 70 + rand(-20, 20), y: rand(36, 76) }),
        )
      : [];
    const via = () =>
      nuove.forEach((nv) => {
        nv.meta = null;
        nv.vel = rand(50, 80);
      });
    m.pulisci(via);
    return via;
  }

  function tempestaPer(m: Maniglia, n: number): () => void {
    impostaTempesta(true);
    m.pulisci(() => impostaTempesta(false));
    return nuvoleTempesta(m, n);
  }

  const terraACaso = () => {
    const v = vista();
    return { x: rand(v.x, v.x + v.w), y: rand(200, 840) };
  };

  // Gli agnellini di un'area si stringono vicini (sotto la pioggia, per il freddo, per paura).
  // centri: uno o più punti di raccolta [x, y]; ognuno va al più vicino
  async function rannicchia(m: Maniglia, a: Area, centri: Array<[number, number]>, sec: number, opz: OpzioniRannicchia = {}): Promise<void> {
    // Chi è alzato dal teatro (furto) resta dov'è
    const gs = a.agnelli.filter((g) => !g.regia && !g.inViaggio && !g.sollevato);
    if (!gs.length) return;
    prendi(gs);
    m.pulisci(() => rilascia(gs));
    const gruppi: Agnello[][] = centri.map(() => []);
    for (const g of gs) {
      let j = 0;
      centri.forEach(([x, y], i) => {
        if (Math.hypot(g.x - x, g.y - y) < Math.hypot(g.x - centri[j]![0], g.y - centri[j]![1])) j = i;
      });
      gruppi[j]!.push(g);
    }
    const mosse = gruppi.flatMap((gr, j) => {
      const [cx, cy] = centri[j]!, passo = 12 * palco.profondita(cy);
      return gr.map((g, i) => {
        const ang = i * 2.4, r = passo * Math.sqrt(i) * 0.95;
        const x = clamp(cx + Math.cos(ang) * r, a.x0, a.x1), y = clamp(cy + Math.sin(ang) * r * 0.55, a.y0, a.y1);
        const vel = Math.max(opz.vel || 70, Math.hypot(x - g.x, y - g.y) / (ARRIVO_RIPARO * palco.profondita((g.y + y) / 2)));
        return muovi(g, x, y, vel, vel > 110 ? 8 : 5);
      });
    });
    // Chi resta indietro (spinto da un ostacolo) si rannicchia dove si trova
    await Promise.race([Promise.all(mosse), m.pausa((ARRIVO_RIPARO + 0.7) * 1000)]);
    for (const g of gs) {
      if (g.mossa) {
        const f = g.mossa.fine;
        g.mossa = null;
        f();
      }
    }
    const fine = ctx.orologio.ms + sec * 1000;
    await Promise.all(
      gs.map((g) =>
        effetto(g, (dt) => {
          if (opz.brivido) g.brivido = 1;
          if (opz.guarda != null) g.verso = opz.guarda > g.x ? 1 : -1;
          if (opz.saltelli && ctx.caso() < dt * 0.6) g.hop = 5;
          g.sy = 0.94;
          g.sx = 1.04;
          return ctx.orologio.ms > fine || !m.vivo;
        }),
      ),
    );
    gs.forEach((g) => {
      g.brivido = 0;
    });
    rilascia(gs);
  }

  function rannicchiaTutti(m: Maniglia, sec: number, opz: OpzioniRannicchia = {}): Promise<void> {
    const punto = (a: Area, fx: number, fy: number): [number, number] => [a.x0 + (a.x1 - a.x0) * fx, a.y0 + (a.y1 - a.y0) * fy];
    const io = inBasso();
    // Il gregge si divide in due mucchietti, uno per lato del cartello
    const gregge = area('gregge');
    return Promise.all([
      ...palco.giocatori().map((c) => rannicchia(m, area(c), [punto(area(c), c === io ? 0.2 : 0.5, 0.3)], sec, opz)),
      rannicchia(m, gregge, [punto(gregge, 0.18, 0.75), punto(gregge, 0.82, 0.75)], sec, opz),
    ]).then(() => undefined);
  }

  function svgLibero(x: number, y: number, z: number, html: string, cls = 'pozza'): SVGSVGElement {
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('class', cls);
    s.setAttribute('width', '1');
    s.setAttribute('height', '1');
    s.style.cssText = `left:${x}px;top:${y}px;z-index:${z}`;
    s.innerHTML = html;
    ctx.el.mondo.appendChild(s);
    return s;
  }

  function pozza(x: number, y: number, rx: number, z: number, extra = '', durataComparsa = 2500) {
    const s = svgLibero(
      x,
      y,
      z,
      `<ellipse rx="${rx}" ry="${rx * 0.32}" fill="${P.celeste}" stroke="${P.notte}" stroke-width="2"/><path d="M${-rx * 0.45} ${-rx * 0.08} q${rx * 0.25} -${rx * 0.08} ${rx * 0.45} 0" fill="none" stroke="${P.gesso}" stroke-width="2" stroke-linecap="round"/>${extra}`,
    );
    ctx.anima(s, [{ transform: 'scale(0)' }, { transform: 'scale(1)' }], { duration: durataComparsa, easing: 'ease-out', fill: 'forwards' });
    return {
      el: s,
      sparisci: (ms = 5000) => {
        const via = () => s.remove();
        return ctx
          .anima(s, [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(.2)', opacity: 0 }], { duration: ms, easing: 'ease-in', fill: 'forwards' })
          .finished.then(via, via);
      },
    };
  }

  const pecoraDi = (chi: IdGiocatore): Pecora => {
    const p = palco.pecora(chi);
    if (!p) throw new Error(`Meteo: pecora sconosciuta "${chi}"`);
    return p;
  };
  const testaPecora = (chi: IdGiocatore) => pecoraDi(chi).puntoTesta();
  const dorsoPecora = (chi: IdGiocatore) => {
    const g = pecoraDi(chi).g;
    return { x: g.x + g.w * 0.5, y: g.y + g.w * 0.3 };
  };

  function scrollaAcqua(chi: IdGiocatore): void {
    const p = palco.pecora(chi);
    if (!p) return;
    const g = p.g;
    p.fai('scuoti', true);
    for (let i = 0; i < 14; i++) {
      particella('gocciolina', g.x + g.w * rand(0.25, 0.75), g.y + g.w * rand(0.3, 0.55), { vx: rand(-90, 90), vy: rand(-160, -60), vita: 0.9, k: g.w / 124 });
    }
  }

  const fumata = (x: number, y: number, n = 10, k = 1) => palco.amb()?.fumata(x, y, n, k);

  function saetta(da: [number, number], a: [number, number]): void {
    const punti: Array<[number, number]> = [da];
    for (let i = 1; i < 7; i++) {
      const q = i / 7;
      punti.push([da[0] + (a[0] - da[0]) * q + rand(-22, 22), da[1] + (a[1] - da[1]) * q]);
    }
    punti.push(a);
    const d = 'M' + punti.map((p) => p.map((v) => v.toFixed(1)).join(' ')).join(' L');
    const s = svgLibero(
      0,
      0,
      3200,
      `<path d="${d}" fill="none" stroke="${P.notte}" stroke-width="10" stroke-linejoin="round" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${P.limone}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>`,
      'saetta',
    );
    const viaS = () => s.remove();
    ctx.anima(s, [{ opacity: 1 }, { opacity: 0.2, offset: 0.3 }, { opacity: 1, offset: 0.45 }, { opacity: 0 }], { duration: 700 }).finished.then(viaS, viaS);
    const lampo = document.createElement('div');
    lampo.className = 'lampo';
    ctx.el.mondo.appendChild(lampo);
    const viaL = () => lampo.remove();
    ctx
      .anima(lampo, [{ opacity: 0 }, { opacity: 0.85, offset: 0.1 }, { opacity: 0, offset: 0.3 }, { opacity: 0.6, offset: 0.45 }, { opacity: 0 }], { duration: 650 })
      .finished.then(viaL, viaL);
    for (let i = 0; i < 16; i++) particella('scintilla', a[0], a[1], { vx: rand(-140, 140), vy: rand(-220, -40), vita: 0.9, k: 1 });
    ctx.orologio.dopo(() => ctx.suona('tuono'), 250);
  }

  // Ghiaccioli appesi alla traversa più alta del recinto davanti
  function stalattiti(nome: Luogo, quanti: number): SVGSVGElement {
    const r = area(nome).recinto as FormaRecinto & { alto: number };
    const y = r.yDavanti - r.alto * 0.62 + 3.5 * r.k;
    let s = '';
    for (let i = 0; i < quanti; i++) {
      const x = r.larg * (0.08 + (0.84 * (i + rand(-0.2, 0.2))) / Math.max(1, quanti - 1)), h = rand(7, 12) * r.k, w = rand(2.4, 3.4) * r.k;
      s += `<path d="M${(x - w).toFixed(1)} 0 L${x.toFixed(1)} ${h.toFixed(1)} L${(x + w).toFixed(1)} 0 Z" fill="${P.celeste}" stroke="${P.notte}" stroke-width="1.5" stroke-linejoin="round"/>`;
    }
    const el = svgLibero(r.x, y, 100 + Math.round(r.yDavanti) + 3, `<g class="ghiaccioli">${s}</g>`);
    ctx.anima(el.firstChild as Element, [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { duration: 1600, easing: 'ease-out', fill: 'forwards' });
    // Appesi alla traversa: se il recinto torna alla sua forma, restano appesi lì
    camera.seguiRecinto(nome, () => {
      if (!el.isConnected) return false;
      const q = area(nome).recinto as FormaRecinto & { alto: number };
      el.style.left = `${q.x}px`;
      el.style.top = `${q.yDavanti - q.alto * 0.62 + 3.5 * q.k}px`;
      el.style.zIndex = String(100 + Math.round(q.yDavanti) + 3);
      piattaforma.impostaScala(el, `${(q.larg / r.larg).toFixed(4)} ${(q.k / r.k).toFixed(4)}`);
    });
    return el;
  }

  function seguiElemento(chi: IdGiocatore, el: HTMLElement | SVGElement, z?: (y: number) => number): void {
    let scala = 1;
    camera.seguiRecinto(chi, (mp) => {
      if (!el.isConnected) return false;
      const p = mp.punto(parseFloat(el.style.left) || 0, parseFloat(el.style.top) || 0);
      el.style.left = `${p.x}px`;
      el.style.top = `${p.y}px`;
      scala *= mp.k;
      piattaforma.impostaScala(el, scala.toFixed(4));
      if (z) el.style.zIndex = String(z(p.y));
    });
  }

  const strumenti: Strumenti = {
    palco,
    stato,
    rand,
    scegliUno,
    inBasso,
    area,
    pecore,
    particella,
    impostaTempesta,
    tempestaPer,
    terraACaso,
    vista,
    rannicchia,
    rannicchiaTutti,
    svgLibero,
    pozza,
    testaPecora,
    dorsoPecora,
    scrollaAcqua,
    fumata,
    saetta,
    stalattiti,
    seguiRecinto: (chi, fn) => camera.seguiRecinto(chi, fn),
    seguiElemento,
    libero,
  };

  const effettoDi = (carta: string): EffettoGuaio | undefined => {
    const tipo = tipoDi(carta);
    return Object.hasOwn(effetti, tipo) ? effetti[tipo] : undefined;
  };

  return {
    haEffetto: (carta) => !!effettoDi(carta),
    attivo: () => attivo !== null,
    ferma,
    avvia(carta, chi) {
      // Un Guaio senza effetto (o un giocatore sconosciuto) non tocca il meteo in corso
      const fx = effettoDi(carta);
      if (!fx || !palco.area(chi)) return Promise.resolve();
      ferma();
      const m = new ManigliaVera(ctx.orologio, tipoDi(carta));
      attivo = m;
      // Per un avversario prima ci si avvicina (e il suo recinto si allarga), poi parte l'evento sulla scena già grande
      let corsa: Promise<void>;
      if (chi !== inBasso()) {
        void camera.inquadra(chi);
        m.pulisci(() => void camera.sgancia());
        corsa = m.attesa(1250).then(() => fx(m, chi, strumenti));
      } else corsa = Promise.resolve().then(() => fx(m, chi, strumenti));
      return corsa
        .catch((e) => {
          if (e !== FERMATO) console.error(e);
        })
        .finally(() => {
          if (attivo === m) ferma();
        });
    },
    // Il resto di aggiornaMeteo (bozza, righe 2240–2254): le mete dell'atmosfera le insegue l'ambiente
    passo(dt) {
      const amb = palco.amb();
      if (stato.pioggia > 0 && amb) {
        for (let n = Math.floor(dt * 150 * stato.pioggia + ctx.caso()); n > 0; n--) {
          const t = terraACaso(), alto = rand(420, 760);
          particella('goccia', t.x - alto * 0.26, t.y - alto, { vx: 165, vy: 640, terra: t.y, vita: 3 });
        }
      }
      if (stato.grandine > 0 && amb) {
        for (let n = Math.floor(dt * 55 * stato.grandine + ctx.caso()); n > 0; n--) {
          const t = terraACaso();
          particella('chicco', t.x - 30, t.y - rand(420, 700), { vx: 40, vy: 380, terra: t.y, vita: rand(3.6, 5) });
        }
      }
      if (stato.bagna) for (const p of pecore()) p.bagnata = Math.min(1, p.bagnata + dt * 0.6);
      const extra = amb?.VENTO.extra ?? 0;
      if (amb && extra > 0.4) {
        // Il vento forte spinge gli agnellini liberi e fa volare via ciuffi di lana
        for (const g of palco.agnelli()) {
          // Gli alzati per il furto restano fermi sopra la staccionata
          if (!g.regia && !g.sollevato && (g.stato === 'fermo' || g.stato === 'bruca' || g.stato === 'cammina')) g.x = Math.min(g.a.x1, g.x + extra * dt * 7 * palco.profondita(g.y));
        }
        const tutte = palco.giocatori();
        if (tutte.length && ctx.caso() < dt * 3 * extra) {
          const chi = scegliUno(tutte), p = palco.pecora(chi);
          if (p) {
            const g = p.g, razza = palco.razza(chi);
            particella('lanetta', g.x + g.w * 0.5, g.y + g.w * 0.35, {
              vx: 120,
              vy: -40,
              vita: 3,
              k: g.w / 124,
              colore: razza === 'sospirella' ? P.lilla : razza === 'nerina' ? P.notte : P.gesso,
            });
          }
        }
        const v = vista();
        if (ctx.caso() < dt * 4 * extra) particella('foglia', v.x - 10, rand(200, 800), { k: rand(0.7, 1.1), vx: 200 });
      }
    },
  };
}
