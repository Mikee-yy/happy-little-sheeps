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
import { mettiPosa, montoneSVG } from './fionda/montone';
import {
  arrivoInScena,
  basePartenza,
  coperto,
  latoCorsa,
  partenzaDi,
  posizioneInVolo,
  puntoDiScena,
  riportaSuRecinto,
  scansa,
  siToccano,
  strisciaCorsa,
  variazioneDaSeq,
  ventaglio,
  type Ingombro,
  type Punto,
  type Rett,
} from './fionda/tiro';
import { trasf } from './mano';
import type { Meteo } from './meteo/indice';
import { manoInScena, W } from './misure';
import type { Palco } from './palco';
import type { Agnello } from './personaggi/agnello';
import { dentro, type Area } from './personaggi/aree';
import { effetto, prendi, rilascia } from './personaggi/giochi';
import { togliFumetti, type Pecora, type TipoReazione } from './personaggi/pecora';
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
  /**
   * Il Montone vola ad arco da vicino alla pecora di chi tira al recinto del bersaglio e ci dà una testata: con `quanti` > 0
   * lo colpisce e quegli agnellini volano verso il gregge, con 0 atterra fuori; poi resta stordito, scuote la testa e corre
   * via. Parte e atterra dove ha tirato chi ha la fionda su questo telefono (`regia.tiroLocale`); altrimenti parte vicino
   * alla pecora di chi tira e atterra in un punto "di scena" della zona del risultato, l'una e l'altro ricavati da `seq`
   * (gli stessi su tutti i telefoni).
   */
  testata(chi: IdGiocatore, bersaglio: IdGiocatore, quanti: number, seq?: number): Promise<void>;
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
export const ELEMENTI_ORDINI = '.volante, .montone, .ombra-montone, .sbuffo-testata, .linee-zoom, .annuncio, .coriandolo';

/** Il centro della tovaglia: la carta ferma degli ordini, la carta "solo da guardare" delle scelte, la partenza della fionda. */
export const CENTRO_TAVOLO = { x: 195, y: 360, k: 0.5 };

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
/**
 * La Testata (tempo della scena), con il Montone animato (fionda/montone.ts, pose in scena.css): il volo ad arco dalla pecora
 * di chi tira (posa-volo, con la scia del vento), la testata sul punto d'arrivo (posa-botta), stordito (posa-stordito), scuote
 * la testa (posa-scuote) e corre via arrabbiato (posa-corre). Colpito o a vuoto cambiano solo suoni ed effetti: le due strade
 * durano uguale (`durate.json`, voce `testata`, quella che chi ospita usa per tutti i telefoni):
 * 800 + 700 + 2000 + 800 + 700 = 5000 ms. Dopo il tiro nessun cerchio: si vede solo il recinto (con la polvere dove atterra).
 */
const DURATA_VOLO_TESTATA_MS = 800;
/** La testata: la posa-botta dura 0,75 s (schiacciato fino a circa 0,3 s, poi si assesta); dopo 0,7 s è già stordito. */
const DURATA_BOTTA_MS = 700;
/** Stordito circa 2 secondi (progetto, "Seconda versione"). */
const DURATA_STORDITO_MS = 2000;
/** Una scrollata intera della posa-scuote (0,8 s in scena.css). */
const DURATA_SCUOTE_MS = 800;
const DURATA_USCITA_MONTONE_MS = 700;
/** In volo il muso sale alla partenza e scende all'arrivo (gradi): arriva di testa. */
const GIRO_PARTENZA = -16;
const GIRO_ARRIVO = 20;
/**
 * La parte del volo (0–1) in cui il Montone passa dalla posa della mira (guarda a destra, dritto) a quella del volo: si gira
 * verso l'arrivo (se sta a sinistra, la scala orizzontale passa piano da +1 a -1) e si inclina un poco alla volta.
 */
const GIRATA_VOLO = 0.15;
/** Con il movimento ridotto il Montone resta fermo nel punto d'arrivo per tanto, prima di andare via. */
const SOSTA_RIDOTTA_MS = 800;
/**
 * Chi sta sotto il punto d'arrivo (fionda.json, voce `scansa`) se ne accorge a questa parte del volo; poi un sobbalzo e lo
 * scivolare di lato con un saltello: 0,4 × 800 + 180 + 300 = 800, già di lato quando il Montone tocca terra. Torna al suo posto
 * mentre il Montone corre via, nello stesso tempo della corsa: la Testata dura quanto prima.
 */
const ACCORTO_VOLO = 0.4;
const SOBBALZO_MS = 180;
const SCIVOLA_MS = 300;
/** Quanto saltano: per la pecora in frazioni della sua cornice, per l'agnellino in unità del mondo (prima della profondità). */
const SALTI_PECORA = { sobbalzo: 0.1, scivola: 0.14, ritorno: 0.04 };
const SALTI_AGNELLO = { sobbalzo: 6, scivola: 9, ritorno: 3 };
/** Lo sbuffo di polvere dove atterra il Montone. */
const DURATA_SBUFFO_MS = 1000;
/**
 * In volo il Montone sta sopra tutto, allo stesso livello del Montone della mira (scena.css, `.fionda-montone`): al lancio
 * niente salto di profondità, né davanti né dietro la propria pecora e il proprio recinto. Sotto la mano e l'interfaccia.
 */
const Z_MONTONE_IN_ARIA = 1600;
/**
 * Il corpo del Montone nel disegno (prima della scala): dalla coda al muso circa 60 e 65 attorno ai piedi, alto 72 sopra di
 * loro. La strada della corsa via è larga così.
 */
const CORPO_MONTONE = { mezzo: 65, alto: 72 };
/** La pecora nella sua cornice larga `w`: la cima del corpo (sotto le orecchie) a 0,2 `w` dall'alto. */
const PECORA_CIMA = 0.2;
/** Fotogrammi del volo (l'arco è campionato: tra uno e l'altro la scena va dritta). */
const PASSI_VOLO = 16;
/** A metà volo il Montone è più grande di tanto (è più vicino a chi guarda). */
const CRESCITA_IN_VOLO = 0.3;
/** Il Montone come nella mira: larghezza del disegno, piedi (origine della scala), ingrandimento sulla profondità. */
const LARGO_MONTONE = 150;
const PIEDI_MONTONE_X = 75;
const PIEDI_MONTONE_Y = 102;
const SCALA_MONTONE = 1.1;
/** Fuori dallo schermo di tanto, uscendo di lato. */
const FUORI_SCHERMO = 160;
/** L'ombra a terra del Montone in volo: misure del disegno (prima della scala) e quanto si stringe a metà volo. */
const LARGO_OMBRA = 80;
const ALTO_OMBRA = 16;
const OMBRA_IN_ALTO = 0.35;
/**
 * I corpi che il Montone atterrato può coprire (personaggi/pecora.ts e agnello.ts): la pecora, nella sua cornice larga `w`,
 * ha il corpo largo circa 0,7 `w` attorno al mezzo e i piedi a 0,78 `w` dall'alto; l'agnellino (28 px, scalato sulla
 * profondità) è largo circa 22.
 */
const PECORA_MEZZA = 0.35;
const PECORA_PIEDI = 0.78;
const AGNELLO_MEZZO = 11;

/** La larghezza del Montone a terra alla profondità `profondita` (come nella mira: 150 × profondità × 1.1). */
export function largoMontone(profondita: number): number {
  return LARGO_MONTONE * profondita * SCALA_MONTONE;
}

/** Dove sta il corpo della pecora di una postazione: i piedi in mezzo alla cornice e la mezza larghezza. */
export function ingombroPecora(g: { x: number; y: number; w: number }): Ingombro {
  return { x: g.x + g.w / 2, y: g.y + PECORA_PIEDI * g.w, mezzo: PECORA_MEZZA * g.w };
}

/** Dove sta il corpo di un agnellino con i piedi in `p`, alla profondità `profondita`. */
export function ingombroAgnello(p: Punto, profondita: number): Ingombro {
  return { x: p.x, y: p.y, mezzo: AGNELLO_MEZZO * profondita };
}

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
  /** Chi si è scansato dal Montone: ognuna rimette subito tutti al loro posto (la chiama `interrompi`, o la Testata alla fine). */
  const scansati = new Set<() => void>();

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

  /** Il recinto del bersaglio a riposo: lì atterra il volo, anche se adesso sta ancora tornando normale dopo la mira. */
  function recintoARiposo(a: Area): Rett {
    const [x0, y0, x1, y1] = a.area0 ?? [a.x0, a.y0, a.x1, a.y1];
    return { x0, y0, x1, y1 };
  }

  /** Uno sbuffo di polvere a terra nel punto `p` (circa un secondo): si allarga e svanisce; col movimento ridotto svanisce e basta. */
  function sbuffo(p: Punto): void {
    const k = palco.profondita(p.y) * SCALA_MONTONE;
    const s = document.createElement('div');
    s.className = 'abs sbuffo-testata';
    s.dataset.x = String(p.x);
    s.dataset.y = String(p.y);
    s.style.cssText += `;left:0;top:0;z-index:${Math.round(100 + p.y + 8) - 1}`;
    s.innerHTML =
      '<svg width="1" height="1" style="overflow:visible;display:block" aria-hidden="true">' +
      [[-22, -3, 7], [-10, -8, 9], [4, -9, 8], [18, -4, 7], [-2, 0, 6]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('') +
      '</svg>';
    el.mondo.appendChild(s);
    const posa = (q: number): string => `translate(${p.x}px,${p.y}px) scale(${k * q})`;
    const fotogrammi: Keyframe[] = ctx.ridotto
      ? [{ transform: posa(1), opacity: 0.9 }, { transform: posa(1), opacity: 0 }]
      : [{ transform: posa(0.4), opacity: 0.95 }, { transform: posa(1.1), opacity: 0.8, offset: 0.35 }, { transform: posa(1.5), opacity: 0 }];
    void anima(s, fotogrammi, { duration: DURATA_SBUFFO_MS, easing: 'ease-out', fill: 'forwards' }).then(() => s.remove());
  }

  /** Un'animazione degli ordini che resta in mano a chi la chiede (per annullarla); `interrompi` la annulla comunque. */
  function animaTenuta(e: Element, f: Keyframe[], o: KeyframeAnimationOptions): Animation {
    const a = ctx.anima(e, f, o);
    animazioni.add(a);
    const via = () => {
      animazioni.delete(a);
    };
    a.finished.then(via, via);
    return a;
  }

  /** Un numero per una trasformazione: due decimali, mai "-0". */
  const cifra = (v: number): number => Math.round(v * 100) / 100 || 0;
  const liscio = (q: number): number => q * q * (3 - 2 * q);

  /** Chi si scansa: `torna` lo riporta al suo posto con calma, `rimetti` subito (senza lasciare classi, trasformazioni o regia). */
  interface Scansato {
    torna(): void;
    rimetti(): void;
  }
  /** Chi si è scansato dal Montone (`scansaDalMontone`); `spostata`: di quanto si è spostata di lato la pecora di `c` (0 se no). */
  interface DaParte {
    spostata(c: IdGiocatore): number;
    /** Sotto quale livello deve atterrare il Montone per stare dietro le pecore rimaste sotto di lui (null: nessuna). */
    zSotto(): number | null;
    torna(): void;
    meteFuori(): void;
    fine(): void;
  }

  /**
   * La pecora scivola di lato di `dx` (stessa profondità; 0: resta dov'è e fa solo il sobbalzo) con un saltello dopo un
   * sobbalzo e le orecchie dritte, e alla fine si gira verso il Montone (`montone`: la sua x). Si gira solo il disegno
   * (`Pecora.gira`): girare la cornice specchierebbe anche l'ombra al sole e il vento. Una sola animazione che resta alla
   * fine (`fill: forwards`); il ritorno la sostituisce, e annullate tutte e due la pecora è subito al suo posto e nel suo
   * verso. Con il movimento ridotto cambia posto senza passaggi in mezzo.
   */
  function scansaPecora(p: Pecora, dx: number, montone: number, w: number): Scansato {
    const r = ctx.ridotto;
    const x = p.g.x + p.g.w / 2 + dx;
    // −1: per guardare il Montone si gira (il suo verso è `p.verso`)
    const gira: 1 | -1 = Math.sign(montone - x) * p.verso < 0 ? -1 : 1;
    const tr = (x: number, y: number): string => `translate(${cifra(x)}px,${cifra(y)}px)`;
    const tot = SOBBALZO_MS + SCIVOLA_MS;
    let chiuso = false;
    const via = animaTenuta(
      p.el,
      r
        ? [{ transform: tr(0, 0) }, { transform: tr(dx, 0) }]
        : [
            { transform: tr(0, 0), offset: 0 },
            { transform: tr(0, -SALTI_PECORA.sobbalzo * w), offset: SOBBALZO_MS / 2 / tot },
            { transform: tr(0, 0), offset: SOBBALZO_MS / tot },
            { transform: tr(dx / 2, -SALTI_PECORA.scivola * w), offset: (SOBBALZO_MS + SCIVOLA_MS / 2) / tot },
            { transform: tr(dx, 0), offset: 1 },
          ],
      { duration: r ? 1 : tot, easing: 'linear', fill: 'forwards' },
    );
    // Arrivata, si gira verso il Montone (annullata no: è già al suo posto)
    via.finished.then(
      () => {
        if (!chiuso) p.gira(gira);
      },
      () => undefined,
    );
    if (!r) p.fai('orecchie', true);
    let ritorno: Animation | null = null;
    const ferma = (a: Animation | null): void => {
      try {
        a?.cancel();
      } catch {
        /* già finita */
      }
    };
    return {
      torna() {
        if (ritorno || chiuso) return;
        // Guarda il Montone, cioè verso casa: due passetti, poi si rigira nel suo verso. Senza `fill`: finita, è al suo posto
        const h = -SALTI_PECORA.ritorno * w;
        p.gira(gira);
        const questo = animaTenuta(
          p.el,
          r
            ? [{ transform: tr(dx, 0) }, { transform: tr(0, 0) }]
            : [
                { transform: tr(dx, 0), offset: 0 },
                { transform: tr(dx * 0.75, h), offset: 0.22 },
                { transform: tr(dx * 0.5, 0), offset: 0.44 },
                { transform: tr(dx * 0.25, h), offset: 0.66 },
                { transform: tr(0, 0), offset: 1 },
              ],
          { duration: r ? 1 : DURATA_USCITA_MONTONE_MS, easing: 'ease-in-out' },
        );
        ritorno = questo;
        questo.finished.then(
          () => {
            if (!chiuso) p.gira(1);
          },
          () => undefined,
        );
        ferma(via);
      },
      rimetti() {
        chiuso = true;
        ferma(via);
        ferma(ritorno);
        p.gira(1);
      },
    };
  }

  /**
   * L'agnellino del Gregge preso dalla regia (come per il meteo): un sobbalzo, scivola fino a `meta` (stessa profondità) con un
   * saltello, resta lì a guardare il Montone (`montone`: la sua x); `torna` lo riporta a casa a passetti, poi è di nuovo libero.
   * Tutto sull'orologio della scena. Con il movimento ridotto cambia posto subito.
   */
  function scansaAgnello(g: Agnello, meta: number, montone: number): Scansato {
    const r = ctx.ridotto;
    const casa = { x: g.x, y: g.y };
    const inizio = ctx.orologio.ms;
    let tornaDa: number | null = null;
    let chiuso = false;
    const verso = (verso: number): 1 | -1 => (verso < 0 ? -1 : 1);
    prendi([g]);
    const fx = (): boolean => {
      const ora = ctx.orologio.ms;
      g.y = casa.y;
      if (tornaDa === null) {
        const t = ora - inizio;
        if (r || t >= SOBBALZO_MS + SCIVOLA_MS) {
          g.x = meta;
          g.verso = verso(montone - g.x);
        } else if (t < SOBBALZO_MS) {
          g.x = casa.x;
          g.hop = Math.sin((t / SOBBALZO_MS) * Math.PI) * SALTI_AGNELLO.sobbalzo;
          g.verso = verso(montone - g.x);
        } else {
          const q = (t - SOBBALZO_MS) / SCIVOLA_MS;
          g.x = casa.x + (meta - casa.x) * liscio(q);
          g.hop = Math.sin(q * Math.PI) * SALTI_AGNELLO.scivola;
          g.verso = verso(meta - casa.x);
        }
        return false;
      }
      const q = r ? 1 : Math.min(1, (ora - tornaDa) / DURATA_USCITA_MONTONE_MS);
      g.x = meta + (casa.x - meta) * liscio(q);
      g.hop = Math.abs(Math.sin(q * 2 * Math.PI)) * SALTI_AGNELLO.ritorno;
      g.verso = verso(casa.x - meta);
      if (q < 1) return false;
      g.x = casa.x;
      g.hop = 0;
      return true;
    };
    // Va dritto anche dietro il cartello del Gregge: il cartello non lo spinge (agnello.ts, `attraversa`)
    g.attraversa = fx;
    const lascia = (): void => {
      if (g.attraversa === fx) g.attraversa = null;
    };
    void effetto(g, fx).then(() => {
      // Arrivato a casa (o preso da qualcos'altro, che l'ha già lasciato): di nuovo libero
      if (chiuso) return;
      chiuso = true;
      lascia();
      rilascia([g]);
    });
    return {
      torna() {
        if (tornaDa === null) tornaDa = ctx.orologio.ms;
      },
      rimetti() {
        if (chiuso) return;
        chiuso = true;
        lascia();
        // Ancora nostro: subito a casa e libero (se un altro l'ha preso, resta a lui)
        if (g.vivo && g.regia && (g.fx === fx || g.fx === null)) {
          g.x = casa.x;
          g.y = casa.y;
          g.hop = 0;
          rilascia([g]);
          g.disegna();
        }
      },
    };
  }

  /**
   * Chi resterebbe sotto il Montone che atterra in `arrivo`: le pecore e gli agnellini del Gregge entro mezzo Montone
   * (fionda.json, voce `scansa`). Se ne accorgono dopo `accorto` ms e si scansano di lato quanto basta (fionda/tiro.ts,
   * `scansa`: dipende solo dal punto e da dove stanno, uguale su tutti i telefoni), restando dentro lo schermo e nel Gregge;
   * un agnellino che finirebbe sul cartello lo salta (gli passa dietro) e si ferma appena oltre. Chi è svenuta, in viaggio,
   * alzata o già presa da un gioco o dal meteo resta dov'è. `meteFuori` sposta con la stessa regola la meta di chi sta
   * volando nel Gregge (gli agnellini colpiti), così non atterra sotto il Montone. `torna` li riporta al loro posto con calma;
   * `fine` (anche da `interrompi`) subito, e chiude tutto.
   */
  function scansaDalMontone(arrivo: Punto, accorto: number): DaParte {
    const largo = largoMontone(palco.profondita(arrivo.y));
    const chi: Scansato[] = [];
    /** Di quanto si è spostata di lato ogni pecora che si è scansata. */
    const spostate = new Map<IdGiocatore, number>();
    /** Il livello più basso delle pecore rimaste sotto di lui con i piedi non più indietro dei suoi (lui va dietro di loro). */
    let zSotto: number | null = null;
    /** La zona sotto il Montone nel Gregge, finché sta nel prato: lì gli agnellini liberi non scelgono posti nuovi. */
    let zona: { a: Area; coperta: (x: number, y: number) => boolean } | null = null;
    const togliZona = (): void => {
      if (zona && zona.a.coperta === zona.coperta) delete zona.a.coperta;
      zona = null;
    };
    let finito = false;
    const fine = (): void => {
      if (finito) return;
      finito = true;
      scansati.delete(fine);
      togliZona();
      for (const s of chi) s.rimetti();
    };
    scansati.add(fine);
    /**
     * Dove va nel Gregge `a` un agnellino con i piedi in `p` che sarebbe coperto (null se non lo è o se non c'è posto);
     * `oltre`: quanto più in là (il ventaglio), se lì c'è posto.
     */
    function postoNelGregge(a: Area, p: Punto, oltre = 0): number | null {
      // Un posto sul cartello del Gregge non va: si salta oltre, dalla parte verso cui va (lontano dal Montone)
      const oltreCartello = (x: number): number => {
        const z = dentro(a, x, p.y);
        return !z ? x : x > arrivo.x ? z[2] + 1 : z[0] - 1;
      };
      const nelGregge = (x: number): boolean => {
        const q = oltreCartello(x);
        return q >= a.x0 && q <= a.x1;
      };
      const x = scansa(arrivo, largo, ingombroAgnello(p, palco.profondita(p.y)), nelGregge, oltre);
      return x === null ? null : oltreCartello(x);
    }
    /** Il corpo della pecora di una postazione con i piedi in mezzo in `x` (come in `corsaVia`). */
    const corpoIn = (g: { y: number; w: number }, x: number): Rett => ({
      x0: x - PECORA_MEZZA * g.w,
      y0: g.y + PECORA_CIMA * g.w,
      x1: x + PECORA_MEZZA * g.w,
      y1: g.y + PECORA_PIEDI * g.w,
    });
    dopo(() => {
      if (finito) return;
      // Le pecore: di lato solo dove c'è posto, cioè dentro lo schermo, fuori da ogni recinto (la scatola tra le due
      // staccionate: dentro finirebbe dietro quella davanti) e lontano dalle altre pecore, a casa o già scansate. Chi non ha
      // posto (accanto al bordo dello schermo e al suo recinto, come gli avversari in alto) resta dov'è: si accorge del
      // Montone, lo guarda, e lui atterra dietro di lei se i suoi piedi non le stanno davanti
      const recinti: Rett[] = palco.giocatori().flatMap((c) => {
        const g = palco.posto(c);
        if (!g) return [];
        const [x, y0, y1, largo] = g.recinto;
        return [{ x0: x, y0, x1: x + largo, y1 }];
      });
      const occupati = new Map<IdGiocatore, Rett>();
      for (const c of palco.giocatori()) {
        const g = palco.posto(c);
        if (g) occupati.set(c, corpoIn(g, g.x + g.w / 2));
      }
      for (const c of palco.giocatori()) {
        const p = palco.pecora(c), g = palco.posto(c);
        if (!p || !g || p.svenutaFerma) continue;
        const io = ingombroPecora(g);
        if (!coperto(arrivo, largo, io)) continue;
        const altre = [...recinti, ...[...occupati].filter(([d]) => d !== c).map(([, r]) => r)];
        const x = scansa(arrivo, largo, io, (x) => x - g.w / 2 >= 0 && x + g.w / 2 <= W && !altre.some((r) => siToccano(corpoIn(g, x), r)));
        const dx = x === null ? 0 : x - io.x;
        if (x !== null) {
          spostate.set(c, dx);
          occupati.set(c, corpoIn(g, x));
        } else if (arrivo.y <= io.y) {
          const z = Number(p.el.style.zIndex) - 1;
          zSotto = zSotto === null ? z : Math.min(zSotto, z);
        }
        chi.push(scansaPecora(p, dx, arrivo.x, g.w));
      }
      const a = palco.area('gregge');
      if (!a) return;
      // Finché il Montone sta lì, gli agnellini liberi non scelgono posti sotto di lui (aree.ts, `coperta`); chi ci stava
      // andando cambia meta, di lato come chi si scansa
      const sotto = (x: number, y: number): boolean => coperto(arrivo, largo, ingombroAgnello({ x, y }, palco.profondita(y)));
      togliZona();
      zona = { a, coperta: sotto };
      a.coperta = sotto;
      // Gli agnellini: dall'alto in basso (uguale per tutti), ognuno un poco più in là del precedente (fionda/tiro.ts,
      // `ventaglio`), così non si fermano tutti nello stesso punto appena fuori dal Montone
      const liberi = a.agnelli.filter((g) => g.vivo && g.giunto && !g.regia && !g.inViaggio && !g.sollevato && !g.intrappolato);
      const daScansare = liberi.filter((g) => coperto(arrivo, largo, ingombroAgnello(g, palco.profondita(g.y))));
      daScansare.sort((p, q) => p.y - q.y || p.x - q.x);
      daScansare.forEach((g, i) => {
        const x = postoNelGregge(a, g, ventaglio(i) * largo);
        if (x !== null) chi.push(scansaAgnello(g, x, arrivo.x));
      });
      for (const g of liberi) {
        if (daScansare.includes(g) || !sotto(g.tx, g.ty)) continue;
        const x = postoNelGregge(a, { x: g.tx, y: g.ty });
        g.tx = x ?? g.x;
        if (x === null) g.ty = g.y;
      }
    }, accorto);
    return {
      spostata: (c) => spostate.get(c) ?? 0,
      zSotto: () => zSotto,
      torna() {
        if (finito) return;
        // Il Montone corre via: il Gregge è di nuovo tutto libero
        togliZona();
        for (const s of chi) s.torna();
      },
      meteFuori() {
        const a = palco.area('gregge');
        if (finito || !a) return;
        // Chi sta arrivando nel Gregge (in partenza o in volo): la meta, se è sotto il Montone, va di lato alla stessa profondità
        for (const g of a.agnelli) {
          if (!g.vivo || g.giunto) continue;
          const x = postoNelGregge(a, { x: g.tx, y: g.ty });
          if (x !== null) g.tx = x;
        }
      },
      fine,
    };
  }

  /**
   * Da che parte corre via il Montone atterrato in `arrivo`, e a che profondità. Contano le pecore che gli starebbero dietro
   * (disegnate sotto di lui alla profondità dell'arrivo): quelle davanti le passa dietro comunque. Per chi si è scansata
   * conta tutta la strada del ritorno, da dove si è fermata fino a casa. Prima il lato più vicino, poi l'altro; se c'è
   * qualcuno da tutte e due le parti, dal lato più vicino ma dietro tutte quelle che incontra. Uguale su tutti i telefoni.
   */
  function corsaVia(arrivo: Punto, daParte: DaParte): { lato: -1 | 1; z: number } {
    const zArrivo = Math.round(100 + arrivo.y + 8);
    const k = palco.profondita(arrivo.y) * SCALA_MONTONE;
    const corpo = { mezzo: CORPO_MONTONE.mezzo * k, alto: CORPO_MONTONE.alto * k };
    const dietro = palco.giocatori().flatMap((c) => {
      const p = palco.pecora(c), g = palco.posto(c);
      if (!p || !g) return [];
      const zp = Number(p.el.style.zIndex);
      if (!(zp <= zArrivo)) return [];
      const cx = g.x + g.w / 2, dx = daParte.spostata(c), mezzo = PECORA_MEZZA * g.w;
      const r: Rett = { x0: Math.min(cx, cx + dx) - mezzo, y0: g.y + PECORA_CIMA * g.w, x1: Math.max(cx, cx + dx) + mezzo, y1: g.y + PECORA_PIEDI * g.w };
      return [{ r, z: zp }];
    });
    const vicino: -1 | 1 = arrivo.x < W / 2 ? -1 : 1;
    const lato = latoCorsa(arrivo, corpo, dietro.map((d) => d.r), vicino);
    if (lato !== null) return { lato, z: zArrivo };
    const strada = strisciaCorsa(arrivo, corpo, vicino);
    return { lato: vicino, z: Math.min(zArrivo, ...dietro.filter((d) => siToccano(strada, d.r)).map((d) => d.z - 1)) };
  }

  async function testata(chi: IdGiocatore, bersaglio: IdGiocatore, quanti: number, seq = 0): Promise<void> {
    const vivo = vivoDa();
    // Il tiro fatto su questo telefono vale per questo volo solo: si legge e si azzera. Il Montone fermo della mira, se c'è, va via
    const locale = regia.tiroLocale;
    regia.tiroLocale = null;
    el.mondo.querySelectorAll('.fionda-montone').forEach((e) => e.remove());
    const a = palco.area(bersaglio);
    if (!a) return;
    const recinto = recintoARiposo(a);
    // Il tiro ricordato vale solo per questo volo: stesso tiratore, bersaglio ed esito (un tiro rimasto lì, se la sua recita è
    // saltata, non fa partire il volo di un altro dalla pecora di chi ha tirato prima)
    const mio = locale && locale.chi === chi && locale.bersaglio === bersaglio && locale.esito === quanti ? locale : null;
    // Da dove parte: su chi ha tirato da questo telefono, dove stava il Montone della mira (che al lancio torna lì, a riposo:
    // niente salti; la partenza non dipende dal recinto ingrandito). Sugli altri telefoni vicino alla pecora di chi tira, con la
    // variazione ricavata da `seq` (la stessa su tutti); senza la sua pecora in scena, dal centro della tovaglia
    const posto = palco.posto(chi);
    const partenza: Punto = mio
      ? { x: mio.partenza.x, y: mio.partenza.y }
      : posto
        ? partenzaDi(basePartenza(posto), variazioneDaSeq(seq))
        : { x: CENTRO_TAVOLO.x, y: CENTRO_TAVOLO.y };
    // Il tiro vero era sul recinto ingrandito: riportato in proporzione su quello normale. Altri telefoni: il punto di scena
    const vero: Punto = mio ? riportaSuRecinto(mio.arrivo, mio.recinto, recinto) : puntoDiScena(recinto, quanti, seq);
    // Si disegna nello schermo; un colpo a vuoto sul prato, mai sulla collina o sulla casetta, sempre a vuoto e fuori dagli
    // altri recinti (fionda/tiro.ts, `arrivoInScena`: lungo la linea del volo, o di lato)
    const altri = palco.giocatori().flatMap((c) => {
      const r = c === bersaglio ? undefined : palco.area(c);
      return r ? [recintoARiposo(r)] : [];
    });
    const arrivo = arrivoInScena(partenza, vero, recinto, altri);
    /** Il disegno guarda a destra: verso -1 lo specchia. */
    const verso = arrivo.x < partenza.x ? -1 : 1;
    // In volo sopra tutto, come nella mira (niente salti di profondità al lancio); l'ombra a terra, alla profondità del
    // punto più vicino tra la partenza e l'arrivo
    const zVolo = Z_MONTONE_IN_ARIA;
    const zOmbra = Math.round(100 + Math.max(partenza.y, arrivo.y) + 7);
    const ombra = document.createElement('div');
    ombra.className = 'abs ombra-montone';
    ombra.style.cssText =
      `left:0;top:0;width:${LARGO_OMBRA}px;height:${ALTO_OMBRA}px;z-index:${zOmbra};pointer-events:none;` +
      `transform-origin:${LARGO_OMBRA / 2}px ${ALTO_OMBRA / 2}px`;
    ombra.innerHTML =
      `<svg viewBox="0 0 ${LARGO_OMBRA} ${ALTO_OMBRA}" style="display:block;width:100%;height:100%" aria-hidden="true">` +
      `<ellipse cx="${LARGO_OMBRA / 2}" cy="${ALTO_OMBRA / 2}" rx="${LARGO_OMBRA / 2 - 4}" ry="${ALTO_OMBRA / 2 - 1}" fill="${P.notte}" opacity=".15"/></svg>`;
    el.mondo.appendChild(ombra);
    // Il Montone animato (fionda/montone.ts), nella stessa cornice della mira; le pose sono classi sul contenitore. Con il
    // movimento ridotto è fermo (`ferma`) e stordito dall'inizio: compare nel punto d'arrivo, resta un attimo e va via
    const m = document.createElement('div');
    m.className = 'abs montone' + (ctx.ridotto ? ' ferma' : '');
    m.style.cssText =
      `left:0;top:0;width:${LARGO_MONTONE}px;z-index:${zVolo};pointer-events:none;` +
      `transform-origin:${PIEDI_MONTONE_X}px ${PIEDI_MONTONE_Y}px`;
    m.innerHTML = montoneSVG();
    mettiPosa(m, ctx.ridotto ? 'stordito' : 'volo');
    el.mondo.appendChild(m);
    /** Il Montone con i piedi in `p` (alzato di `alto`), scalato sulla profondità, girato di `giro` gradi (muso in su se negativo). */
    const posa = (p: Punto, o: { alto?: number; grande?: number; giro?: number; verso?: number } = {}): string => {
      const k = palco.profondita(p.y) * SCALA_MONTONE * (o.grande ?? 1);
      return (
        `translate(${p.x - PIEDI_MONTONE_X}px,${p.y - (o.alto ?? 0) - PIEDI_MONTONE_Y}px) ` +
        `scale(${(o.verso ?? verso) * k},${k}) rotate(${o.giro ?? 0}deg)`
      );
    };
    /** L'ombra centrata nel punto a terra `p`, scalata sulla profondità (più piccola quando il Montone è in alto). */
    const posaOmbra = (p: Punto, piccola: number): string => {
      const k = palco.profondita(p.y) * SCALA_MONTONE * (1 - piccola);
      return `translate(${p.x - LARGO_OMBRA / 2}px,${p.y - ALTO_OMBRA / 2}px) scale(${k})`;
    };
    // L'arco: più grande a metà volo, il muso che sale alla partenza e scende all'arrivo (la testa davanti); l'ombra resta a terra
    const volo: Keyframe[] = [];
    const voloOmbra: Keyframe[] = [];
    for (let i = 0; i <= PASSI_VOLO; i++) {
      const t = i / PASSI_VOLO;
      const p = posizioneInVolo(partenza, arrivo, t);
      const arco = 4 * t * (1 - t);
      // Nei primi passi si gira dalla posa della mira (verso 1, dritto) a quella del volo: niente scatti al lancio
      const girata = Math.min(1, t / GIRATA_VOLO);
      const giro = (GIRO_PARTENZA + (GIRO_ARRIVO - GIRO_PARTENZA) * t) * girata;
      const v = 1 + (verso - 1) * girata;
      volo.push({ transform: posa(p, { alto: p.alto, grande: 1 + CRESCITA_IN_VOLO * arco, giro, verso: v }) });
      voloOmbra.push({ transform: posaOmbra(p, OMBRA_IN_ALTO * arco) });
    }
    ctx.suona('beee', 0.6);
    const durataVolo = ctx.ridotto ? 1 : DURATA_VOLO_TESTATA_MS;
    void anima(ombra, voloOmbra, { duration: durataVolo, easing: 'linear', fill: 'forwards' });
    const volato = anima(m, volo, { duration: durataVolo, easing: 'linear', fill: 'forwards' });
    // Chi resterebbe sotto il Montone se ne accorge verso la fine del volo e si scansa; torna quando il Montone corre via.
    // Finita (o interrotta) la Testata, ognuno è al suo posto
    const daParte = scansaDalMontone(arrivo, ACCORTO_VOLO * durataVolo);
    const via = (): void => {
      m.remove();
      daParte.fine();
    };
    await volato;
    ombra.remove();
    if (!vivo()) return void via();
    // La testata sul punto d'arrivo: la polvere, e a terra alla profondità del punto d'arrivo (dietro lo steccato davanti e le
    // pecore davanti al recinto)
    sbuffo(arrivo);
    // Dietro la pecora rimasta sotto di lui (senza posto di lato) se i suoi piedi non le stanno davanti
    m.style.zIndex = String(Math.min(Math.round(100 + arrivo.y + 8), daParte.zSotto() ?? Infinity));
    if (!ctx.ridotto) mettiPosa(m, 'botta');
    if (quanti > 0) {
      // Colpito: tonfo, paura, il prato trema, gli agnellini volano al gregge
      ctx.suona('tonfo');
      palco.reagisci(bersaglio, 'paura');
      void anima(el.mondo, [{ transform: 'none' }, { transform: 'translate(-5px,2px)' }, { transform: 'translate(4px,-2px)' }, { transform: 'none' }], {
        duration: ctx.ridotto ? 1 : 260,
      });
      palco.branco()?.sposta(quanti, bersaglio, 'gregge', 'vola');
      // Le mete nel Gregge le sceglie il branco senza sapere del Montone: chi finirebbe sotto di lui atterra di lato
      daParte.meteFuori();
    } else {
      // A vuoto: un colpo più leggero sull'erba, niente paura né scossa
      ctx.suona('tonfo', 0.5);
    }
    // Il muso giù contro il punto d'arrivo, poi i piedi a terra mentre la posa-botta lo schiaccia sul muso (scena.css: fino
    // a circa 0,3 s). Resta lì: stordito e scuote nel punto d'arrivo, nella zona del risultato. La stessa durata nelle due strade
    await anima(
      m,
      [{ transform: posa(arrivo, { giro: GIRO_ARRIVO }) }, { transform: posa(arrivo), offset: 0.12 }, { transform: posa(arrivo) }],
      { duration: ctx.ridotto ? 1 : DURATA_BOTTA_MS, easing: 'ease-out', fill: 'forwards' },
    );
    if (!vivo()) return void via();
    if (ctx.ridotto) {
      // Fermo nel punto d'arrivo per un attimo
      await attendi(SOSTA_RIDOTTA_MS);
    } else {
      // Stordito: occhi a spirale e stelline (scena.css); poi scuote la testa
      mettiPosa(m, 'stordito');
      await attendi(DURATA_STORDITO_MS);
      if (!vivo()) return void via();
      mettiPosa(m, 'scuote');
      await attendi(DURATA_SCUOTE_MS);
    }
    if (!vivo()) return void via();
    // Corre via arrabbiato, guardando dove va: dal lato più vicino se lì non passa sopra una pecora che gli sta dietro (anche
    // quella che si è scansata e torna a casa proprio mentre lui corre), se no dall'altro; se ce n'è da tutte e due le parti,
    // passa dietro di loro
    const { lato, z } = corsaVia(arrivo, daParte);
    m.style.zIndex = String(z);
    const fuori = { x: lato < 0 ? -FUORI_SCHERMO : W + FUORI_SCHERMO, y: arrivo.y };
    if (!ctx.ridotto) mettiPosa(m, 'corre');
    daParte.torna();
    await anima(m, [{ transform: posa(arrivo, { verso: lato }) }, { transform: posa(fuori, { verso: lato }) }], {
      duration: ctx.ridotto ? 1 : DURATA_USCITA_MONTONE_MS,
      easing: 'ease-in',
      fill: 'forwards',
    });
    via();
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
      // Chi si era scansato dal Montone torna subito al suo posto (le pecore sono già a posto: le animazioni sono annullate)
      for (const fine of [...scansati]) fine();
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
