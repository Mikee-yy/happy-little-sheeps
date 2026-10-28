// La mira della Testata sul prato: il Montone animato (fionda/montone.ts) con l'elastico, sul prato accanto alla pecora di chi
// tira (`basePartenza`; dal centro della tovaglia se da lì non c'è spazio per tirare), ogni mira un po' più in là (`partenzaDi` con il caso della scena: la traiettoria non si impara
// a memoria); il recinto del bersaglio ingrandito sul posto e la scia di puntini che mostra l'inizio del volo. Le zone (e il
// numero di agnellini di ognuna, in bollini) si vedono solo mentre si carica: elastico tirato oltre `tiroMinimo`, col dito o
// con le frecce; a riposo e appena lanciato non ci sono (Invio subito lancia senza mostrarle). Il Montone sta in `posa-riposo`,
// in `posa-carica` mentre l'elastico è tirato, con `--carica` = elastico / elastico pieno (si dimena di più); fermo (`ferma`)
// con il movimento ridotto. Mentre si mira i recinti degli altri avversari si attenuano e gli agnellini non giocano (i loro
// fumetti finirebbero sui cerchi); la mano delle carte e il consiglio "Tocca una carta…" scendono via fino al lancio (classe
// `fionda-in-mira` sullo strato `.ui`, come `fionda-in-carica` per la nuvoletta).
// Si tira indietro il Montone col dito (o col mouse, solo il tasto sinistro) e lo si lascia andare; con la tastiera le frecce
// girano la direzione e cambiano la forza, Invio o Spazio lancia (subito: appena fuori dalla staccionata davanti, 1 agnellino).
// Un tiro solo: al lancio la zona di tocco se ne va, l'elastico si allenta e il Montone torna alla partenza a riposo (da lì
// parte il volo), e il tiro vero (con la sua partenza) si ricorda in
// `ctx.regia.tiroLocale` (il volo lo recita la regia, sul recinto ancora ingrandito: togliendo la mira dopo il lancio il
// recinto resta grande, lo rimette normale la Testata). Con lo stesso `tentativo` il tiro resta fatto anche se la domanda si
// toglie e torna (la scena recita); con un tentativo nuovo (mossa rifiutata, attesa scaduta) si mira di nuovo, da una partenza
// nuova. Finché il recinto non ha finito di ingrandirsi i cerchi non si vedono e non si tira.
// Il disegno sta nel mondo (sotto la camera); la zona di tocco nello strato `.ui`, posizionata con `camera.inScenaDaMondo`.
// I conti (punto d'arrivo, zone, esito, scia) sono di `tiro.ts`; i numeri della fionda stanno in `fionda.json`.
import type { IdGiocatore } from '../../../../engine/src';
import { T } from '../../testi';
import type { Camera } from '../camera';
import type { Contesto } from '../contesto';
import { H, W } from '../misure';
import { CENTRO_TAVOLO } from '../ordini';
import type { Palco } from '../palco';
import type { Area } from '../personaggi/aree';
import type { Domanda, Gesto } from '../scelte/tipi';
import { disegnaCerchi as cerchiSu } from './cerchi';
import { mettiPosa, montoneSVG } from './montone';
import {
  basePartenza,
  esitoTiro,
  fasciaDi,
  FIONDA,
  forzaPerDistanza,
  lunghezzaElastico,
  partenzaDi,
  puntoArrivo,
  scia,
  spazioPerTirare,
  tiroPieno,
  type Punto,
  type Rett,
} from './tiro';

export interface Mira {
  /**
   * Mostra la fionda verso `f.bersaglio` e manda il tiro a `suGesto`. La stessa già mostrata si rimette solo a posto, se non
   * è già stata tirata con un altro `tentativo` (allora si mira di nuovo); tirata con lo stesso tentativo, torna tirata.
   */
  mostra(f: Fionda, suGesto: (g: Gesto) => void): void;
  /**
   * Toglie Montone, elastico, scia, cerchi e zona di tocco; il recinto del bersaglio torna normale, se il tiro non è già
   * partito (allora resta grande per il volo e lo rimette normale la Testata degli ordini). Con `dimentica` (la
   * domanda non ha più la fionda) si scorda anche il tiro fatto.
   */
  togli(dimentica?: boolean): void;
  /** Ridisegna i cerchi sul recinto di adesso e rimette Montone e zona di tocco (dopo una ricostruzione o un resize). */
  riposiziona(): void;
  /** La zona di tocco, se c'è (per chi rimette il fuoco della tastiera). */
  controllo(): HTMLElement | null;
}

const NS = 'http://www.w3.org/2000/svg';
/** Il Montone come negli ordini: larghezza del disegno, punto dei piedi (origine della scala) e ingrandimento sulla profondità. */
const LARGO_MONTONE = 150;
const PIEDI_X = 75;
const PIEDI_Y = 102;
const ALTO_MONTONE = 109;
const SCALA_MONTONE = 1.1;
/** Altezza del corpo sopra i piedi, dove si aggancia l'elastico (pixel del disegno). */
const AGGANCIO_ELASTICO = 46;
/** A forza piena il Montone si schiaccia così (in altezza) e si allarga la metà. */
const SCHIACCIATO = 0.12;
/** La zona di tocco esce dal disegno di tanto (dita grandi su schermo piccolo). */
const MARGINE_ZONA = 10;
/**
 * Tastiera (`fionda.json`, voce `tastiera`): di quanto gira la direzione a ogni freccia (gradi), e quanto cambia la forza:
 * la profondità del recinto è 1 / (1 + 2 × margine) della corsa, una freccia ne fa `1 / passiPerProfondita`.
 */
const PASSO_ANGOLO = FIONDA.tastiera.passoAngolo;
const PASSO_FORZA = 1 / (FIONDA.tastiera.passiPerProfondita * (1 + 2 * FIONDA.margine));
/** Raggio dei puntini della scia. */
const RAGGIO_PUNTINO = 4.5;
/** La classe sullo strato `.ui` mentre si carica il tiro (la nuvoletta del pensiero si nasconde). */
const IN_CARICA = 'fionda-in-carica';
/**
 * La classe sullo strato `.ui` mentre si mira, dal Montone che compare fino al lancio: la mano delle carte e il consiglio
 * "Tocca una carta…" scendono sotto il bordo dello schermo (scena.css), così il prato è libero per tirare indietro. Un tocco
 * per sbaglio o un elastico troppo corto non li riportano: tornano su al lancio (mentre il Montone vola) o quando la fionda
 * se ne va. Dipende solo dalla mira di adesso, così una ricostruzione non lascia la mano bloccata giù.
 */
const IN_MIRA = 'fionda-in-mira';

type Fionda = NonNullable<Domanda['fionda']>;
type TiroLocale = NonNullable<Contesto['regia']['tiroLocale']>;

interface Mostrata {
  f: Fionda;
  suGesto: (g: Gesto) => void;
  montone: HTMLElement;
  elastico: SVGSVGElement;
  linea: SVGLineElement;
  scia: SVGSVGElement;
  cerchi: SVGSVGElement;
  zona: HTMLElement | null;
  /** Da dove parte il Montone in questa mira: vicino alla pecora di chi tira, con la sua variazione. */
  partenza: Punto;
  /** L'elastico tirato adesso, in unità del mondo (dalla partenza al dito). */
  tiro: Punto;
  lanciato: boolean;
  /** Il recinto ha finito di ingrandirsi: solo allora si vedono i cerchi e si tira. */
  pronta: boolean;
  /** Ingrandimenti chiesti e non ancora finiti. */
  inAttesa: number;
  /** Il recinto (l'area del palco) che si è chiesto di ingrandire: dopo una ricostruzione è un altro, da ingrandire di nuovo. */
  recinto: Area | undefined;
  /**
   * La mira della tastiera: direzione del volo (radianti) e forza (0 = tiroMinimo, 1 = tiroMassimo). Nasce alla prima freccia
   * o al primo Invio, verso il centro del recinto con la forza che arriva sul suo bordo davanti.
   */
  tastiera: { angolo: number; forza: number } | null;
}

function svg(classe: string): SVGSVGElement {
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('class', classe);
  s.setAttribute('width', String(W));
  s.setAttribute('height', String(H));
  s.setAttribute('aria-hidden', 'true');
  return s;
}

const centroDi = (r: Rett): Punto => ({ x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2 });
/** Il recinto com'è a riposo (non ingrandito dalla mira). */
function aRiposo(a: Area): Rett {
  const [x0, y0, x1, y1] = a.area0 ?? [a.x0, a.y0, a.x1, a.y1];
  return { x0, y0, x1, y1 };
}

export function creaMira(ctx: Contesto, palco: Palco, camera: Camera): Mira {
  let m: Mostrata | null = null;
  /** Il trascinamento in corso: quale puntatore, dove è sceso (pixel dello schermo) e quanti pixel fa un'unità del mondo. */
  let presa: { id: number; x: number; y: number; scala: number } | null = null;
  /**
   * L'ultimo tiro fatto, con il suo tentativo: la stessa fionda rimostrata con lo stesso tentativo torna già tirata (niente
   * secondo tiro che riscrive `tiroLocale`). Si scorda quando la domanda non ha più la fionda o il tentativo cambia.
   */
  let ricordo: { f: Fionda; tiro: Punto; locale: TiroLocale } | null = null;
  /**
   * La partenza di una mira tolta prima del lancio (la scena recita), con la sua fionda e il suo tentativo: rimessa con lo
   * stesso tentativo riparte da lì, non da un punto nuovo a caso. Si scorda con un tentativo nuovo o una fionda diversa.
   */
  let partenzaTolta: { f: Fionda; partenza: Punto } | null = null;
  /** I giochi degli agnellini com'erano prima della mira (si fermano mentre si mira); `null` senza mira. */
  let giochiPrima: boolean | null = null;
  const stessaFionda = (a: Fionda, b: Fionda): boolean => a.chi === b.chi && a.bersaglio === b.bersaglio && a.massimo === b.massimo;
  /** Chi tira: quello della domanda, senza chi sta in basso. */
  const chiTira = (f: Fionda): IdGiocatore | null => f.chi ?? palco.inBasso();

  /** Scala del Montone alla partenza: come gli altri sul prato, più grande più è vicino. */
  const kk = (s: Mostrata): number => palco.profondita(s.partenza.y) * SCALA_MONTONE;

  /**
   * Una partenza nuova: la base accanto alla pecora di chi tira, spostata a caso entro `variazionePartenza` (il caso della
   * scena: `Math.random`, nelle prove a seme fisso). Se da lì non c'è spazio per tirare l'elastico fino in fondo verso il
   * recinto a riposo (con "Passa il telefono" chi tira può stare in alto: si tirerebbe verso i pulsanti o fuori dallo
   * schermo), o la sua pecora non c'è, dal centro della tovaglia come nella prima versione, con la stessa variazione.
   */
  function nuovaPartenza(f: Fionda): Punto {
    const variazione = ctx.caso();
    const chi = chiTira(f);
    const posto = chi ? palco.posto(chi) : undefined;
    const a = palco.area(f.bersaglio);
    if (posto) {
      const p = partenzaDi(basePartenza(posto), variazione);
      if (!a || spazioPerTirare(p, aRiposo(a))) return p;
    }
    return partenzaDi({ x: CENTRO_TAVOLO.x, y: CENTRO_TAVOLO.y }, variazione);
  }

  /** L'elastico non si allunga oltre la forza piena: il Montone si ferma lì anche se il dito va più in là. */
  function tiroLimitato(t: Punto): Punto {
    const l = Math.hypot(t.x, t.y);
    if (l <= FIONDA.tiroMassimo) return t;
    return { x: (t.x / l) * FIONDA.tiroMassimo, y: (t.y / l) * FIONDA.tiroMassimo };
  }

  /** Si sta caricando il tiro: elastico tirato oltre il minimo (col dito o con le frecce), non ancora lanciato. */
  const carica = (s: Mostrata): boolean => !s.lanciato && Math.hypot(s.tiro.x, s.tiro.y) >= FIONDA.tiroMinimo;

  /** Montone (posizione, posa e forza), elastico e scia per il tiro di adesso; i cerchi se si sta caricando. */
  function disegnaTiro(s: Mostrata): void {
    const P = s.partenza;
    // Lanciato, l'elastico si allenta: il Montone torna alla partenza, a riposo (niente carica né dimenarsi). Il volo della
    // regia parte proprio da lì (`tiroLocale.partenza`), con la stessa scala: niente salti
    const t = s.lanciato ? { x: 0, y: 0 } : tiroLimitato(s.tiro);
    const forza = Math.hypot(t.x, t.y) / FIONDA.tiroMassimo;
    const x = P.x + t.x, y = P.y + t.y;
    const k = kk(s);
    s.montone.dataset.x = String(x);
    s.montone.dataset.y = String(y);
    s.montone.style.transform =
      `translate(${x - PIEDI_X}px,${y - PIEDI_Y}px) scale(${k * (1 + (SCHIACCIATO / 2) * forza)},${k * (1 - SCHIACCIATO * forza)})`;
    // Si dimena più l'elastico è tirato (anche con le frecce); a riposo respira
    mettiPosa(s.montone, forza > 0 ? 'carica' : 'riposo');
    s.montone.style.setProperty('--carica', String(Math.round(forza * 1000) / 1000));
    // Mentre si carica la nuvoletta del pensiero (il consiglio della partita di prova, sotto la pecora) si nasconde e restano
    // i pallini: il Montone tirato indietro scende proprio lì (scena.css)
    ctx.el.ui.classList.toggle(IN_CARICA, carica(s));
    ctx.el.ui.classList.toggle(IN_MIRA, !s.lanciato);
    const alto = AGGANCIO_ELASTICO * k;
    s.linea.setAttribute('x1', String(P.x));
    s.linea.setAttribute('y1', String(P.y - alto));
    s.linea.setAttribute('x2', String(x));
    s.linea.setAttribute('y2', String(y - alto * (1 - SCHIACCIATO * forza)));
    // La scia mostra dove si mira (l'inizio del volo), solo se il tiro partirebbe
    const area = palco.area(s.f.bersaglio);
    const arrivo = s.lanciato || !area ? null : puntoArrivo(P, s.tiro, area);
    const punti = arrivo ? scia(P, arrivo) : [];
    s.scia.replaceChildren(
      ...punti.map((p) => {
        const c = document.createElementNS(NS, 'circle');
        c.setAttribute('cx', String(p.x));
        c.setAttribute('cy', String(p.y));
        c.setAttribute('r', String(RAGGIO_PUNTINO));
        return c;
      }),
    );
    disegnaCerchi(s);
  }

  /**
   * Le zone sul recinto del bersaglio com'è adesso, solo mentre si carica il tiro (e non mentre la camera lo ingrandisce);
   * a riposo e dopo il lancio niente. Già disegnate restano come sono, a meno di `ridisegna` (il recinto è cambiato).
   */
  function disegnaCerchi(s: Mostrata, ridisegna = false): void {
    const a = palco.area(s.f.bersaglio);
    if (!a || !s.pronta || !carica(s)) {
      if (s.cerchi.childElementCount) s.cerchi.replaceChildren();
    } else if (ridisegna || !s.cerchi.childElementCount) cerchiSu(s.cerchi, a, s.f.massimo);
  }

  /** La zona di tocco sopra il Montone a riposo, portata sullo schermo (il prato può essere inquadrato da vicino). */
  function posizionaZona(s: Mostrata): void {
    if (!s.zona) return;
    const P = s.partenza;
    const k = kk(s);
    const a = camera.inScenaDaMondo(P.x - PIEDI_X * k - MARGINE_ZONA, P.y - PIEDI_Y * k - MARGINE_ZONA);
    const b = camera.inScenaDaMondo(P.x + (LARGO_MONTONE - PIEDI_X) * k + MARGINE_ZONA, P.y + (ALTO_MONTONE - PIEDI_Y) * k + MARGINE_ZONA);
    s.zona.style.left = `${Math.min(a.x, b.x)}px`;
    s.zona.style.top = `${Math.min(a.y, b.y)}px`;
    s.zona.style.width = `${Math.abs(b.x - a.x)}px`;
    s.zona.style.height = `${Math.abs(b.y - a.y)}px`;
  }

  /** Lancia con questo elastico: se il tiro parte, un gesto solo e niente più zona. Restituisce se è partito. */
  function lancia(s: Mostrata, tiro: Punto): boolean {
    // Mentre il recinto si ingrandisce i cerchi non ci sono ancora e l'area cambia: non si tira
    if (s.lanciato || !s.pronta) return false;
    const area = palco.area(s.f.bersaglio);
    const arrivo = area ? puntoArrivo(s.partenza, tiro, area) : null;
    if (!area || !arrivo) return false;
    const esito = esitoTiro(arrivo, area, s.f.massimo);
    s.lanciato = true;
    s.tiro = tiro;
    // Il recinto com'era al tiro: una copia (la camera continua a cambiare l'area mentre lo ingrandisce o lo restringe)
    const locale: TiroLocale = {
      chi: chiTira(s.f),
      bersaglio: s.f.bersaglio,
      esito,
      arrivo,
      recinto: { x0: area.x0, y0: area.y0, x1: area.x1, y1: area.y1 },
      partenza: { ...s.partenza },
      pieno: tiroPieno(tiro),
    };
    ctx.regia.tiroLocale = locale;
    ricordo = s.f.tentativo !== undefined ? { f: { ...s.f }, tiro, locale } : null;
    s.zona?.remove();
    s.zona = null;
    disegnaTiro(s);
    s.suGesto({ tipo: 'fionda', esito });
    return true;
  }

  // ---------- Dito e mouse ----------

  const scalaScena = (): number => {
    const r = ctx.el.scena.getBoundingClientRect();
    // jsdom (o una scena non ancora misurata) non ha misure: un pixel vale un'unità del mondo
    return r.width > 0 ? r.width / W : 1;
  };
  const idDi = (e: Event): number => (e as PointerEvent).pointerId ?? 0;
  const suMovimento = (e: Event): void => {
    if (!m || !presa || idDi(e) !== presa.id) return;
    const p = e as MouseEvent;
    m.tiro = { x: (p.clientX - presa.x) / presa.scala, y: (p.clientY - presa.y) / presa.scala };
    disegnaTiro(m);
    // Nessun tasto tenuto: il mouse si è alzato fuori dalla finestra (lì il rilascio non arriva). Vale come rilascio
    if (p.buttons === 0) lascia(true);
  };
  const suRilascio = (e: Event): void => {
    if (!presa || idDi(e) !== presa.id) return;
    const p = e as MouseEvent;
    if (m) {
      m.tiro = { x: (p.clientX - presa.x) / presa.scala, y: (p.clientY - presa.y) / presa.scala };
      disegnaTiro(m);
    }
    lascia(e.type !== 'pointercancel');
  };
  function finisciPresa(): void {
    const z = m?.zona;
    if (presa && z) {
      try {
        if (z.hasPointerCapture?.(presa.id)) z.releasePointerCapture(presa.id);
      } catch {
        // il puntatore non c'è più: niente da rilasciare
      }
    }
    presa = null;
    window.removeEventListener('pointermove', suMovimento);
    window.removeEventListener('pointerup', suRilascio);
    window.removeEventListener('pointercancel', suRilascio);
  }
  /** Il dito si alza: si lancia (se `tira`), altrimenti o se il tiro non parte il Montone torna a riposo. */
  function lascia(tira: boolean): void {
    finisciPresa();
    const s = m;
    if (!s) return;
    if (tira && lancia(s, s.tiro)) return;
    s.tiro = { x: 0, y: 0 };
    disegnaTiro(s);
  }

  function creaZona(): HTMLElement {
    const z = document.createElement('div');
    z.className = 'zona-fionda';
    z.setAttribute('role', 'button');
    z.tabIndex = 0;
    z.setAttribute('aria-label', T.testata.fionda.etichetta);
    z.addEventListener('pointerdown', (e) => {
      // Solo il dito o il tasto sinistro del mouse; un secondo dito non ricomincia il tiro (conta solo il primo)
      if ((e as MouseEvent).button || presa || !m || m.lanciato) return;
      presa = { id: idDi(e), x: e.clientX, y: e.clientY, scala: scalaScena() };
      // Il puntatore resta della zona anche fuori da lei (e fuori dalla finestra, dove il browser lo permette)
      try {
        z.setPointerCapture(presa.id);
      } catch {
        // jsdom, o un puntatore che non si può catturare: bastano gli ascoltatori sulla finestra
      }
      window.addEventListener('pointermove', suMovimento);
      window.addEventListener('pointerup', suRilascio);
      window.addEventListener('pointercancel', suRilascio);
    });
    // La pressione lunga su Android aprirebbe il menu del browser
    z.addEventListener('contextmenu', (e) => e.preventDefault());
    z.addEventListener('keydown', suTasto);
    ctx.el.ui.appendChild(z);
    return z;
  }

  // ---------- Tastiera ----------

  function tiroDaTastiera(t: { angolo: number; forza: number }): Punto {
    // L'elastico va dalla parte opposta al volo
    const l = lunghezzaElastico(t.forza);
    return { x: -Math.cos(t.angolo) * l, y: -Math.sin(t.angolo) * l };
  }
  function suTasto(e: KeyboardEvent): void {
    const s = m;
    if (!s || s.lanciato) return;
    const invio = e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar';
    const frecce: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
    const freccia = frecce[e.key];
    if (!invio && !freccia) return;
    e.preventDefault();
    // Invio tenuto premuto si ripete: un lancio solo (le frecce invece si possono tenere)
    if (invio && e.repeat) return;
    if (!s.tastiera) {
      // Si parte verso il centro del recinto, con la forza che arriva appena fuori dalla staccionata davanti (Invio subito:
      // 1 agnellino; una freccia su 2, due 3)
      const P = s.partenza;
      const a = palco.area(s.f.bersaglio);
      const c = a ? centroDi(a) : { x: P.x, y: 0 };
      const fascia = a ? fasciaDi(P, a) : null;
      const forza = fascia ? forzaPerDistanza(fascia.distanza - (FIONDA.tastiera.bordo * fascia.profondita) / 2, fascia) : 0.5;
      s.tastiera = { angolo: Math.atan2(c.y - P.y, c.x - P.x), forza: Math.max(PASSO_FORZA, Math.min(1, forza)) };
    }
    if (freccia) {
      s.tastiera.angolo += (freccia[0] * PASSO_ANGOLO * Math.PI) / 180;
      const forza = Math.round((s.tastiera.forza + freccia[1] * PASSO_FORZA) * 1e6) / 1e6;
      s.tastiera.forza = Math.max(PASSO_FORZA, Math.min(1, forza));
      s.tiro = tiroDaTastiera(s.tastiera);
      disegnaTiro(s);
      return;
    }
    if (presa) finisciPresa();
    if (!lancia(s, tiroDaTastiera(s.tastiera))) {
      s.tiro = { x: 0, y: 0 };
      disegnaTiro(s);
    }
  }

  // ---------- Mostra, togli, riposiziona ----------

  /**
   * Il recinto si ingrandisce sul posto: finché tutti gli ingrandimenti chiesti non sono finiti la fionda non è pronta
   * (niente cerchi, niente tiro); poi i cerchi si disegnano sul recinto grande.
   */
  function ingrandisci(s: Mostrata): void {
    s.inAttesa++;
    s.recinto = palco.area(s.f.bersaglio);
    s.pronta = false;
    const fatto = (): void => {
      s.inAttesa--;
      if (m !== s || s.inAttesa > 0) return;
      s.pronta = true;
      disegnaCerchi(s, true);
    };
    // Chi tira non si attenua: con "Passa il telefono" spesso non sta in basso, e il Montone parte accanto alla sua pecora
    camera.ingrandisciRecinto(s.f.bersaglio, FIONDA.ingrandimento, FIONDA.attenuati, chiTira(s.f)).then(fatto, fatto);
  }

  /** Il tiro di prima non vale più (mossa rifiutata, attesa scaduta): il Montone torna a riposo e si mira di nuovo. */
  function scordaTiro(): void {
    if (ricordo && ctx.regia.tiroLocale === ricordo.locale) ctx.regia.tiroLocale = null;
    ricordo = null;
  }
  function miraDiNuovo(s: Mostrata): void {
    scordaTiro();
    s.partenza = nuovaPartenza(s.f);
    s.lanciato = false;
    s.tiro = { x: 0, y: 0 };
    s.tastiera = null;
    s.zona = creaZona();
  }

  const mira: Mira = {
    mostra(f, suGesto) {
      if (m && stessaFionda(m.f, f)) {
        m.suGesto = suGesto;
        // Già tirata e il tentativo è cambiato: si mira di nuovo, sul recinto già grande
        if (m.lanciato && f.tentativo !== m.f.tentativo) miraDiNuovo(m);
        m.f = { ...f };
        mira.riposiziona();
        return;
      }
      mira.togli();
      // Il Montone animato, nella stessa cornice del simbolo (220×160, piedi in 110,150): le pose sono classi sul contenitore
      const montone = document.createElement('div');
      montone.className = 'abs fionda-montone' + (ctx.ridotto ? ' ferma' : '');
      montone.style.cssText = `left:0;top:0;width:${LARGO_MONTONE}px;transform-origin:${PIEDI_X}px ${PIEDI_Y}px`;
      montone.innerHTML = montoneSVG();
      mettiPosa(montone, 'riposo');
      const elastico = svg('fionda-elastico');
      const linea = document.createElementNS(NS, 'line');
      elastico.appendChild(linea);
      const s: Mostrata = {
        f: { ...f },
        suGesto,
        montone,
        elastico,
        linea,
        scia: svg('fionda-scia'),
        cerchi: svg('fionda-cerchi'),
        zona: null,
        partenza: { x: 0, y: 0 },
        tiro: { x: 0, y: 0 },
        lanciato: false,
        pronta: false,
        inAttesa: 0,
        recinto: undefined,
        tastiera: null,
      };
      // La stessa fionda già tirata con lo stesso tentativo (la domanda torna dopo una recita): resta tirata, niente zona
      const r = ricordo;
      // (dalla stessa partenza); altrimenti si mira da una partenza nuova
      if (r && stessaFionda(r.f, f) && f.tentativo !== undefined && r.f.tentativo === f.tentativo) {
        s.lanciato = true;
        s.tiro = r.tiro;
        s.partenza = { ...r.locale.partenza };
      } else {
        if (r && stessaFionda(r.f, f)) scordaTiro();
        else ricordo = null;
        const pt = partenzaTolta;
        const stessa = pt !== null && stessaFionda(pt.f, f) && f.tentativo !== undefined && pt.f.tentativo === f.tentativo;
        s.partenza = stessa ? { ...pt.partenza } : nuovaPartenza(f);
      }
      partenzaTolta = null;
      // Prima i cerchi (sul recinto), poi la scia, l'elastico e il Montone sopra
      ctx.el.mondo.append(s.cerchi, s.scia, s.elastico, s.montone);
      // Gli agnellini non giocano mentre si mira: i fumetti dei giochi finirebbero sopra i cerchi
      const giochi = palco.branco()?.giochi;
      if (giochi && giochiPrima === null) {
        giochiPrima = giochi.attivo;
        giochi.attivo = false;
      }
      if (!s.lanciato) s.zona = creaZona();
      m = s;
      ingrandisci(s);
      disegnaTiro(s);
      posizionaZona(s);
    },
    togli(dimentica = false) {
      if (dimentica) {
        ricordo = null;
        partenzaTolta = null;
      }
      const s = m;
      if (!s) return;
      finisciPresa();
      m = null;
      // Tolta prima del lancio (la scena recita): con lo stesso tentativo si riparte da qui
      partenzaTolta = !dimentica && !s.lanciato && s.f.tentativo !== undefined ? { f: { ...s.f }, partenza: { ...s.partenza } } : null;
      ctx.el.ui.classList.remove(IN_CARICA, IN_MIRA);
      s.montone.remove();
      s.elastico.remove();
      s.scia.remove();
      s.cerchi.remove();
      s.zona?.remove();
      const giochi = palco.branco()?.giochi;
      if (giochi && giochiPrima !== null) giochi.attivo = giochiPrima;
      giochiPrima = null;
      // Già lanciato, il recinto resta grande: il volo atterra proprio dove si è mirato, sulla linea della scia, e lo rimette
      // normale la Testata degli ordini quando il Montone se n'è andato (una mira nuova lo rimette a posto anche lei)
      if (!s.lanciato) void camera.ingrandisciRecinto(null);
    },
    riposiziona() {
      const s = m;
      if (!s) return;
      // Dopo una ricostruzione del tavolo il recinto è nuovo (di misura normale): si ingrandisce di nuovo
      for (const e of [s.cerchi, s.scia, s.elastico, s.montone]) if (!e.isConnected) ctx.el.mondo.appendChild(e);
      if (s.zona && !s.zona.isConnected) ctx.el.ui.appendChild(s.zona);
      // Un resize lascia il recinto com'è (e la fionda pronta); un recinto nuovo si ingrandisce, e intanto non si tira
      if (palco.area(s.f.bersaglio) !== s.recinto) ingrandisci(s);
      disegnaTiro(s);
      disegnaCerchi(s, true);
      posizionaZona(s);
    },
    controllo: () => m?.zona ?? null,
  };
  return mira;
}
