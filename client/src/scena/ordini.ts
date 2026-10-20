// Gli ordini della scena: le animazioni che la regia della partita chiede (meteo, Guai, dado, Testata, Beee-NO!, zoom).
// Bozza scena.src.html: righe 1897–1907 (carte che volano), 1998–2033 (dado), 2042–2058 (testata), 2060–2082 (Beee-NO!)
// e 2083–2105 (Guaio). Senza le regole finte: la faccia del dado, il bersaglio e la quantità della Testata li dà la regia,
// il Guaio non dà la consolazione, e i conti (mazzo, mani, scarti) li mette in pari la fotografia successiva.
// Gli ordini che durano sono eventi della regia (bozza, riga 463). Quando il tavolo si ricostruisce (`interrompi`)
// le attese finiscono subito, i voli si annullano e ogni ordine in corso si ferma senza toccare il tavolo nuovo.
// Ordini del pezzo 2 (la regia): Guaio del round, annuncio, carte del round girate, fumetti, carta giocata in volo
// (bozza, righe 1928–1945, senza le regole finte), eliminata e festa (righe 2545–2554, senza il riquadro finale).
// I testi li dà chi chiama (da `T.scena`): qui dentro non c'è nessuna scritta.
import { defCarta } from '../../../engine/src';
import type { IdCarta, IdGiocatore, Luogo } from '../../../engine/src';
import { T } from '../testi';
import { TAVOLOZZA as P } from './ambiente/paesaggio';
import { DURATA_SGANCIA_MS, type Camera } from './camera';
import { cartaSVG, retroSVG } from './carte/carte';
import { trasf } from './mano';
import type { Meteo } from './meteo/indice';
import { manoInScena } from './misure';
import type { Palco } from './palco';
import { togliFumetti, type TipoReazione } from './personaggi/pecora';
import { posaDado } from './tavolo/coperta';

export interface OpzioniGuaio {
  /**
   * Tempo della scena (dall'inizio dell'ordine) dopo il quale la promessa si risolve anche se il meteo continua:
   * la camera torna all'inquadratura intera in tempo e il meteo prosegue sullo sfondo (l'evento resta in corso).
   */
  liberaDopoMs?: number;
}

export interface Ordini {
  /** Sposta fino a `n` agnellini (limitato dai posti liberi e da chi c'è); restituisce quanti partono. */
  spostaAgnellini(n: number, da: Luogo, a: Luogo, modo?: 'corre' | 'vola'): number;
  /** Solo l'effetto (con lo zoom se chi non sta in basso); niente se il Guaio non ha effetto. */
  meteo(carta: IdCarta, chi: IdGiocatore): Promise<void>;
  /** Carta in volo dal mazzo dei Guai, meteo, carta nell'angolo di chi; con `liberaDopoMs` si risolve prima della fine del meteo. */
  guaio(carta: IdCarta, chi: IdGiocatore, o?: OpzioniGuaio): Promise<void>;
  /** Il Guaio del round dal mazzo dei Guai al suo posto sulla tovaglia, girandosi (~700 ms). */
  guaioRivelato(carta: IdCarta): Promise<void>;
  /** Una scritta grande al centro dell'interfaccia per `ms` (predefinito 1200). */
  annuncio(testo: string, ms?: number): Promise<void>;
  /** Le carte coperte del round si girano e mostrano queste carte, un posto dopo l'altro (150 ms tra uno e il successivo). */
  giraCarte(carte: Partial<Record<IdGiocatore, IdCarta[]>>): Promise<void>;
  /** Un fumetto sopra ogni pecora indicata; si risolve dopo `ms` (predefinito 1200). */
  fumetti(testi: Partial<Record<IdGiocatore, string>>, ms?: number): Promise<void>;
  /** La carta giocata vola dalla postazione al centro della tovaglia (con il fumetto, se c'è), poi sugli scarti. */
  volaCarta(daChi: IdGiocatore, carta: IdCarta, testo: string | null): Promise<void>;
  /** La pecora sviene e resta sdraiata (targa e segnalini si aggiornano con lei). */
  eliminata(chi: IdGiocatore): Promise<void>;
  /** Festa delle vincitrici: saltano, saltano i loro agnellini, coriandoli e fanfara (~3000 ms). */
  festa(vincitori: IdGiocatore[]): Promise<void>;
  fermaMeteo(): void;
  /** Lancio animato che si ferma su quella faccia (id della faccia del motore). */
  dado(faccia: string): Promise<void>;
  /** Il montone e `quanti` agnellini del bersaglio in volo verso il gregge. */
  testata(chi: IdGiocatore, bersaglio: IdGiocatore, quanti: number): Promise<void>;
  beeeNo(chi: IdGiocatore): Promise<void>;
  /**
   * L'annullamento nel gioco vero, dopo che la carta Beee-NO! è già volata: esplode il BEEE-NO!, la carta annullata
   * (null per un tiro di dado) torna un momento al centro e si scuote, chi l'aveva giocata trasale.
   */
  annullamento(chi: IdGiocatore, annullato: IdGiocatore | null, carta: IdCarta | null): Promise<void>;
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
export const ELEMENTI_ORDINI = '.volante, .montone, .linee-zoom, .annuncio, .coriandolo';

const CENTRO_TAVOLO = { x: 195, y: 360, k: 0.5 };

/** Tempi degli ordini del pezzo 2 (tempo della scena). */
const DURATA_GUAIO_RIVELATO_MS = 700;
const DURATA_ANNUNCIO_MS = 1200;
const PASSO_GIRA_CARTE_MS = 150;
/** Mezzo giro di una carta del round (il dorso si stringe, la faccia si allarga). */
const MEZZO_GIRO_MS = 140;
const DURATA_FUMETTI_MS = 1200;
const DURATA_ELIMINATA_MS = 1000;
const DURATA_FESTA_MS = 3000;
const CORIANDOLI = 70;

export function creaOrdini(palco: Palco, camera: Camera, meteo: Meteo): OrdiniDelTeatro {
  const { ctx } = palco;
  const { el, regia } = ctx;
  const rand = (a: number, b: number) => a + ctx.caso() * (b - a);
  const attese = new Map<number, () => void>();
  const animazioni = new Set<Animation>();
  /** L'ultima posa del dado: rotazione (già normalizzata come sulla coperta) e punto in cui è atterrato. */
  let rot = { x: 0, y: 0 };
  let salto = { x: 0, y: 0 };
  /** Cresce a ogni `interrompi`: gli ordini in corso si fermano anche senza una ricostruzione del tavolo (distruggi). */
  let interruzioni = 0;

  /** Per un ordine che comincia adesso: vero finché il tavolo non si ricostruisce e gli ordini non vengono interrotti. */
  function vivoDa(): () => boolean {
    const gen = palco.generazione();
    const i = interruzioni;
    return () => gen === palco.generazione() && i === interruzioni;
  }

  /** Attesa sull'orologio della scena che finisce subito se il tavolo si ricostruisce; `annulla` la chiude prima. */
  function attesa(ms: number): { fatto: Promise<void>; annulla(): void } {
    let t = 0;
    const fatto = new Promise<void>((fine) => {
      t = ctx.orologio.dopo(() => {
        attese.delete(t);
        fine();
      }, ms);
      attese.set(t, fine);
    });
    return {
      fatto,
      annulla() {
        const fine = attese.get(t);
        if (!fine) return;
        ctx.orologio.annulla(t);
        attese.delete(t);
        fine();
      },
    };
  }
  const attendi = (ms: number): Promise<void> => attesa(ms).fatto;

  /** Un timer degli ordini che `interrompi` annulla. */
  function dopo(fn: () => void, ms: number): void {
    const t = ctx.orologio.dopo(() => {
      attese.delete(t);
      fn();
    }, ms);
    attese.set(t, () => undefined);
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

  async function annullamento(chi: IdGiocatore, annullato: IdGiocatore | null, carta: IdCarta | null): Promise<void> {
    const vivo = vivoDa();
    if (palco.posto(chi)) palco.reagisci(chi, 'salto');
    if (annullato !== null && palco.posto(annullato)) palco.reagisci(annullato, 'scossa');
    if (carta === null) {
      scoppio();
      await attendi(1100);
      return;
    }
    const v = volante(carta, false);
    const r = rand(-4, 4);
    const centro: Tappa = { ...CENTRO_TAVOLO, r, f: 0 };
    const scarti: Tappa = { ...cimaDi(el.scarti), r: rand(-12, 12) };
    await vola(v, [scarti, centro], 300);
    if (!vivo()) return void v.remove();
    scoppio();
    // La carta annullata si scuote
    await vola(v, [centro, { ...centro, r: r - 9 }, { ...centro, r: r + 8 }, { ...centro, r: r - 6 }, { ...centro, r: r + 4 }, centro], 520, 'linear');
    if (!vivo()) return void v.remove();
    await attendi(380);
    if (!vivo()) return void v.remove();
    await vola(v, [centro, scarti], 420, 'cubic-bezier(.5,0,.5,1)');
    v.remove();
  }

  /** Da dove parte una carta giocata: dalla mano di chi sta in basso, dal ventaglio (coperta) per gli avversari. */
  function partenza(chi: IdGiocatore): Tappa | null {
    const g = palco.posto(chi);
    if (!g) return null;
    return chi === palco.inBasso() || !g.ventaglio
      ? manoInScena({ x: 195, y: 800, k: 0.37, f: 0 }, ctx.KD)
      : { ...camera.inScenaDaMondo(g.ventaglio[0], g.ventaglio[1] - 14), k: 0.08, f: 180 };
  }

  async function beeeNo(chi: IdGiocatore): Promise<void> {
    const vivo = vivoDa();
    const da = partenza(chi);
    if (!da) return;
    palco.fumetto(chi, T.scena.fumetti.beeeNo);
    palco.reagisci(chi, 'salto');
    const v = volante('beee-no', false);
    const centro: Tappa = { ...CENTRO_TAVOLO, r: 5, f: 0 };
    await vola(v, [da, centro], 520);
    if (!vivo()) return void v.remove();
    scoppio();
    await attendi(900);
    if (!vivo()) return void v.remove();
    await vola(v, [centro, { ...cimaDi(el.scarti), r: rand(-12, 12) }], 420, 'cubic-bezier(.5,0,.5,1)');
    v.remove();
  }

  async function guaio(carta: IdCarta, chi: IdGiocatore, o: OpzioniGuaio = {}): Promise<void> {
    const vivo = vivoDa();
    const inizio = ctx.orologio.ms;
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
    if (o.liberaDopoMs === undefined) return effetto;
    await liberaEntro(effetto, inizio + o.liberaDopoMs, vivo);
  }

  /**
   * Aspetta il meteo al più fino a `entro` (tempo della scena). Se continua, la camera comincia a tornare indietro
   * in tempo per essere all'inquadratura intera a `entro`; il meteo prosegue sullo sfondo e tiene in corso l'evento.
   */
  async function liberaEntro(effetto: Promise<void>, entro: number, vivo: () => boolean): Promise<void> {
    const finito = effetto.then(() => true);
    /** Il meteo o il tempo, quello che arriva prima: vero se è finito il meteo. */
    const meteoOppure = async (ms: number): Promise<boolean> => {
      const a = attesa(Math.max(0, ms));
      const esito = await Promise.race([finito, a.fatto.then(() => false)]);
      a.annulla();
      return esito;
    };
    const ritorno = ctx.ridotto ? 0 : DURATA_SGANCIA_MS;
    if ((await meteoOppure(entro - ritorno - ctx.orologio.ms)) || !vivo()) return;
    if (camera.inquadrato() !== null) await camera.sgancia();
    else await meteoOppure(entro - ctx.orologio.ms);
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
    const vivo = vivoDa();
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
    if (!vivo()) return void m.remove();
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

  /* ---------- Ordini del pezzo 2 (la regia) ---------- */

  /** Dove sta il Guaio del round sulla tovaglia: un segnaposto invisibile misurato e subito tolto. */
  function postoGuaioRound(): Tappa {
    const s = document.createElement('div');
    s.className = 'guaio-round';
    s.style.visibility = 'hidden';
    el.coperta.appendChild(s);
    const r = inScena(s);
    s.remove();
    return { x: r.cx, y: r.cy, k: r.w / 250, sy: r.w ? r.h / r.w / 1.4 : 1, r: 6 };
  }

  async function guaioRivelato(carta: IdCarta): Promise<void> {
    const vivo = vivoDa();
    const da = cimaDi(el.mazzoGuai);
    const a = postoGuaioRound();
    ctx.suona('fruscio');
    const v = volante(carta, true);
    // Si alza dal mazzo dei Guai, si gira a metà strada e si posa al suo posto
    const su: Tappa = { x: (da.x + a.x) / 2, y: Math.min(da.y, a.y) - 40, k: Math.max(da.k, a.k) * 1.5, r: -4, f: 90, o: 0.5 };
    await vola(v, [{ ...da, r: 0, f: 180 }, su, { ...a, f: 0 }], DURATA_GUAIO_RIVELATO_MS);
    v.remove();
    if (!vivo()) return;
    ctx.suona('pop');
    palco.coperta.guaioRound(carta);
  }

  async function annuncio(testo: string, ms = DURATA_ANNUNCIO_MS): Promise<void> {
    const a = document.createElement('div');
    a.className = 'annuncio';
    a.setAttribute('role', 'status');
    a.textContent = testo;
    el.ui.appendChild(a);
    const posa = (k: number, r: number) => `translate(-50%,-50%) scale(${k}) rotate(${r}deg)`;
    void anima(
      a,
      ctx.ridotto
        ? [{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.85 }, { opacity: 0 }]
        : [
            { transform: posa(0.3, -8), opacity: 0 },
            { transform: posa(1.12, 2), opacity: 1, offset: 0.18 },
            { transform: posa(1, -2), opacity: 1, offset: 0.3 },
            { transform: posa(1, -2), opacity: 1, offset: 0.85 },
            { transform: posa(0.9, -2), opacity: 0 },
          ],
      { duration: ms, easing: 'ease-out', fill: 'forwards' },
    );
    await attendi(ms);
    a.remove();
  }

  const carteRoundDi = (chi: IdGiocatore): HTMLElement | undefined =>
    [...el.mondo.querySelectorAll<HTMLElement>('.carte-round')].find((c) => c.dataset.chi === chi);
  const eDorso = (c: Element): boolean => !!c.querySelector('use[href="#back-main"]');

  /** Mezzo giro di una carta del round attorno al suo asse verticale, sopra la sua rotazione. */
  function mezzoGiro(c: HTMLElement, chiude: boolean): Promise<void> {
    const base = c.style.transform;
    const intera = `${base} scaleX(1)`.trim(), piatta = `${base} scaleX(0)`.trim();
    return anima(c, chiude ? [{ transform: intera }, { transform: piatta }] : [{ transform: piatta }, { transform: intera }], {
      duration: ctx.ridotto ? 1 : MEZZO_GIRO_MS,
      easing: chiude ? 'ease-in' : 'ease-out',
    });
  }

  /** Le carte del round di `chi`: il dorso si stringe, poi al suo posto si allargano le carte scoperte. */
  async function giraPosto(chi: IdGiocatore, carte: IdCarta[], vivo: () => boolean): Promise<void> {
    const prima = [...(carteRoundDi(chi)?.querySelectorAll<HTMLElement>('.carta-round') ?? [])];
    await Promise.all(prima.filter(eDorso).map((c) => mezzoGiro(c, true)));
    if (!vivo()) return;
    palco.ritocca(chi, (p) => ({ ...p, giocata: { coperta: false, carte: [...carte] } }));
    ctx.suona('fruscio');
    const nuove = [...(carteRoundDi(chi)?.querySelectorAll<HTMLElement>('.carta-round') ?? [])].filter((c) => !prima.includes(c));
    await Promise.all(nuove.map((c) => mezzoGiro(c, false)));
  }

  async function giraCarte(carte: Partial<Record<IdGiocatore, IdCarta[]>>): Promise<void> {
    const vivo = vivoDa();
    // Nell'ordine dei posti, a partire da chi sta in basso
    const chi = palco.giocatori().filter((c) => (carte[c]?.length ?? 0) > 0);
    await Promise.all(
      chi.map(async (c, i) => {
        if (i > 0) await attendi(i * PASSO_GIRA_CARTE_MS);
        if (vivo()) await giraPosto(c, carte[c]!, vivo);
      }),
    );
  }

  async function fumetti(testi: Partial<Record<IdGiocatore, string>>, ms = DURATA_FUMETTI_MS): Promise<void> {
    for (const chi of palco.giocatori()) {
      const testo = testi[chi];
      if (testo !== undefined) palco.fumetto(chi, testo, ms);
    }
    await attendi(ms);
  }

  /** La carta giocata (bozza `gioca`, righe 1928–1945): al centro della tovaglia, un momento, poi sugli scarti. */
  async function volaCarta(daChi: IdGiocatore, carta: IdCarta, testo: string | null): Promise<void> {
    const vivo = vivoDa();
    const da = partenza(daChi);
    if (!da) return;
    const v = volante(carta, false);
    const centro: Tappa = { ...CENTRO_TAVOLO, r: rand(-4, 4), f: 0 };
    ctx.suona('fruscio');
    await vola(v, [da, centro], 380);
    if (!vivo()) return void v.remove();
    if (testo !== null) palco.fumetto(daChi, testo);
    await attendi(650);
    if (!vivo()) return void v.remove();
    await vola(v, [centro, { ...cimaDi(el.scarti), r: rand(-12, 12) }], 420, 'cubic-bezier(.5,0,.5,1)');
    v.remove();
    // Gli scarti li mette in pari la fotografia: la carta può restare in gioco ancora per un po'
    if (vivo()) ctx.suona('pop');
  }

  async function eliminata(chi: IdGiocatore): Promise<void> {
    if (!palco.posto(chi)) return;
    ctx.suona('tonfo');
    // Il posto mostrato diventa "eliminato": la pecora sviene e resta sdraiata, e un altro ordine che rimette
    // in pari le postazioni prima della fotografia successiva non la rialza
    palco.ritocca(chi, (p) => ({ ...p, eliminato: true }));
    await attendi(DURATA_ELIMINATA_MS);
  }

  /** Coriandoli che cadono su tutto lo schermo (bozza, righe 2549–2552). */
  function coriandoli(): void {
    const colori = [P.menta, P.lilla, P.albicocca, P.limone, P.gesso];
    for (let i = 0; i < CORIANDOLI; i++) {
      const c = document.createElement('i');
      c.className = 'coriandolo';
      c.style.cssText = `background:${colori[Math.floor(ctx.caso() * colori.length)]};left:${rand(-20, 400).toFixed(1)}px;top:-30px`;
      el.ui.appendChild(c);
      const via = () => c.remove();
      void anima(
        c,
        [{ transform: 'translate(0,0) rotate(0)' }, { transform: `translate(${rand(-60, 60).toFixed(1)}px,${rand(700, 900).toFixed(1)}px) rotate(${rand(-720, 720).toFixed(0)}deg)` }],
        { duration: rand(2200, 3600), delay: rand(0, 900), easing: 'cubic-bezier(.3,.1,.6,1)', fill: 'forwards' },
      ).then(via);
    }
  }

  /** La festa (bozza `vittoria`, righe 2545–2554), senza il riquadro finale: la classifica la mostra il gioco. */
  async function festa(vincitori: IdGiocatore[]): Promise<void> {
    const vivo = vivoDa();
    const chi = palco.giocatori().filter((c) => vincitori.includes(c));
    ctx.suona('fanfara');
    const io = palco.inBasso();
    if (io !== null && chi.includes(io)) ctx.vibra('vittoria');
    for (const c of chi) {
      palco.reagisci(c, 'festa');
      for (const g of palco.area(c)?.agnelli ?? []) {
        dopo(() => {
          if (vivo() && !g.regia) g.salta(3);
        }, rand(0, 500));
      }
    }
    if (!ctx.ridotto) coriandoli();
    await attendi(DURATA_FESTA_MS);
  }

  const meteoEvento = regia.conEvento('meteo', (carta: IdCarta, chi: IdGiocatore) => meteo.avvia(carta, chi));
  const inquadraEvento = regia.conEvento('camera', (chi: IdGiocatore) => camera.inquadra(chi));
  const sganciaEvento = regia.conEvento('camera', () => camera.sgancia());

  return {
    spostaAgnellini: (n, da, a, modo = 'corre') => palco.branco()?.sposta(n, da, a, modo) ?? 0,
    meteo: (carta, chi) => meteoEvento(carta, chi),
    guaio: regia.conEvento('guaio', guaio),
    guaioRivelato: regia.conEvento('guaioRivelato', guaioRivelato),
    annuncio: regia.conEvento('annuncio', annuncio),
    giraCarte: regia.conEvento('giraCarte', giraCarte),
    fumetti: regia.conEvento('fumetti', fumetti),
    volaCarta: regia.conEvento('volaCarta', volaCarta),
    eliminata: regia.conEvento('eliminata', eliminata),
    festa: regia.conEvento('festa', festa),
    fermaMeteo: () => meteo.ferma(),
    dado: regia.conEvento('dado', dado),
    testata: regia.conEvento('testata', testata),
    beeeNo: regia.conEvento('beeeNo', beeeNo),
    annullamento: regia.conEvento('annullamento', annullamento),
    inquadra: (chi) => inquadraEvento(chi),
    sgancia: () => sganciaEvento(),
    fumetto: (chi, testo, ms) => palco.fumetto(chi, testo, ms),
    reagisci: (chi, tipo) => palco.reagisci(chi, tipo),
    interrompi() {
      // Prima il segnale, poi le attese finite e i voli annullati: chi riprende vede che deve fermarsi
      interruzioni++;
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
      // Via annunci, coriandoli, carte in volo, montone e fumetti, anche quelli che finirebbero da soli più tardi
      for (const radice of [el.ui, el.mondo]) radice.querySelectorAll(ELEMENTI_ORDINI).forEach((e) => e.remove());
      togliFumetti(ctx);
    },
  };
}
