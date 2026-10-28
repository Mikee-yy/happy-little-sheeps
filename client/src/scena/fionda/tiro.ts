// Il calcolo puro della fionda della Testata: dal tiro al punto d'arrivo, alle zone dei cerchi, all'esito.
// Niente DOM, niente casualità: le coordinate sono quelle del mondo della scena (390×844).
//
// I numeri stanno in `fionda.json`:
// - `cerchi.centro`: diametro dell'ellisse del centro (zona 3) in frazione di larghezza e altezza del recinto;
// - `fasciaBordo`: quanto fuori dalla staccionata vale ancora 1 agnellino, in frazione di larghezza (`x`) e altezza (`y`)
//   del recinto, così scala con lui (mira sul recinto ingrandito, animazione su quello normale, altri telefoni):
//   sui recinti normali (2/3/4 giocatori: 129×36, 78×44, 57×36) sono 32/20/14 in orizzontale e 16/20/16 in verticale,
//   circa un quarto di Montone (150 × profondità × 1.1 = 112/96/67 di larghezza): la metà della prima versione, perché
//   la zona 1 copriva quasi tutta la corsa del dito (decisione dell'utente, 26/10);
// - `variazionePartenza`: raggio (unità del mondo) entro cui la partenza si sposta a ogni tiro rispetto al punto base;
// - `basePartenza`: il punto base accanto alla pecora di chi tira, in frazione della larghezza `w` della sua cornice, da
//   sinistra (`x`) e dal bordo in alto (`y`): per la pecora in basso (`basso`) alla sua destra, con i piedi all'altezza della
//   sua testa (non sopra di lei, non contro il bordo sinistro, lontano da mano, dado e pulsanti); per quelle in alto (`alto`)
//   davanti ai piedi, in mezzo alla pecora, verso la tovaglia;
// - `spazioTiro`: quanto deve restare tra il punto del tiro pieno e i bordi dello schermo (`lati`, `basso`) e la cima
//   (`alto`: sotto i pulsanti) perché si possa mirare vicino alla propria pecora; senza, si mira dal centro della tovaglia;
// - `atterraggio`: dove si disegna il punto d'arrivo: a `lati` dai bordi e sotto `alto` (la striscia in cima); un colpo a
//   vuoto sul prato, sotto `prato` (la collina comincia tra y 154 e 162), mai sulla collina o sulla casetta;
// - `tiroMinimo`: sotto questa lunghezza dell'elastico (unità del mondo) il tiro non parte;
// - `tiroMassimo`: elastico alla forza piena;
// - `margine`: la forza è misurata sul recinto bersaglio: da tiroMinimo a tiroMassimo il punto d'arrivo va da
//   (½ + margine) profondità prima del centro a (½ + margine) dopo; a metà tiro si arriva al centro, e il recinto occupa
//   1 / (1 + 2 × margine) della corsa del dito (con 1, un terzo);
// - `ingrandimento`: di quanto si ingrandisce il recinto del bersaglio durante la mira, oltre le proporzioni del tuo;
// - `attenuati`: l'opacità dei recinti degli altri avversari durante la mira;
// - `tastiera`: di quanti gradi gira la mira una freccia a destra o a sinistra (`passoAngolo`), quante frecce su o giù
//   attraversano la profondità del recinto (`passiPerProfondita`), e dove parte la mira, in frazione della mezza profondità
//   prima del centro (`bordo`: 1 = sulla staccionata davanti, 1.2 = appena fuori, un decimo di profondità: Invio subito
//   vale 1 agnellino, una freccia su 2, due 3);
// - `bollini`: corpo dei numeri sui cerchi (unità del mondo), il minimo e il massimo;
// - `scia`: frazione del percorso mostrata dai puntini;
// - `puntiScia`: quanti puntini ha la scia;
// - `altezzaArco`: altezza dell'arco in frazione della distanza;
// - `fuori`: quanto oltre la fascia del bordo atterra un colpo a vuoto di scena;
// - `lungo`: il colpo a vuoto lungo (`colpoLungo`: oltre il recinto, dove non può atterrare) vola oltre e sparisce dietro
//   la collina: `caduta` quanto scende (unità del mondo) dietro la collina, `dissolvenza` in che parte del volo (0–1), da
//   quando esce dalla fascia, passa dietro la collina e i recinti; `cima`: in volo i piedi non salgono sopra questa y (l'arco
//   di un volo così lungo uscirebbe dallo schermo);
// - `cielo`: tirato al massimo (entro `pieno` unità di elastico da `tiroMassimo`) il colpo lungo vola invece nel cielo e
//   sparisce in lontananza con un luccichio, a `y` (sotto la striscia in cima, sopra le colline), piccolo fino a `puntino`
//   della sua misura; sugli altri telefoni succede a circa `quota` dei colpi lunghi, scelti da `seq`;
// - `scansa`: chi sta sotto il Montone atterrato si sposta di lato. `raggio`: fino a quale distanza dal suo corpo (in
//   larghezze del Montone nel punto d'arrivo, 150 × profondità × 1.1: mezzo Montone); `margine`: quanto più in là si ferma
//   (sempre in larghezze del Montone), per non restare proprio sul bordo; `ventaglio`: fin dove possono andare ancora più
//   in là gli agnellini che si scansano insieme (in larghezze del Montone), così non si fermano tutti nello stesso punto.
import { H, W } from '../misure';
import fionda from './fionda.json';

export interface Punto { x: number; y: number }
/** Il recinto, come `Area` di `personaggi/aree.ts`. */
export interface Rett { x0: number; y0: number; x1: number; y1: number }

export interface DatiFionda {
  cerchi: { centro: number };
  fasciaBordo: { x: number; y: number };
  variazionePartenza: number;
  basePartenza: { basso: { x: number; y: number }; alto: { x: number; y: number } };
  spazioTiro: { lati: number; alto: number; basso: number };
  atterraggio: { lati: number; alto: number; prato: number };
  tiroMinimo: number;
  tiroMassimo: number;
  margine: number;
  ingrandimento: number;
  attenuati: number;
  tastiera: { passoAngolo: number; passiPerProfondita: number; bordo: number };
  bollini: { corpo: number; corpoMassimo: number };
  scia: number;
  puntiScia: number;
  altezzaArco: number;
  fuori: number;
  lungo: { caduta: number; dissolvenza: number; cima: number };
  cielo: { pieno: number; quota: number; y: number; puntino: number };
  scansa: { raggio: number; margine: number; ventaglio: number };
}

export const FIONDA: DatiFionda = fionda;

/**
 * La fascia della forza, lungo la linea dalla partenza al centro del recinto: `distanza` del centro, `profondita` del
 * tratto di recinto attraversato da quella linea, e dove arriva il tiro più debole (`vicino`) e quello più forte (`lontano`).
 */
export interface Fascia {
  distanza: number;
  profondita: number;
  vicino: number;
  lontano: number;
}

export function fasciaDi(partenza: Punto, r: Rett): Fascia {
  const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2;
  const distanza = Math.hypot(cx - partenza.x, cy - partenza.y);
  // Partenza nel centro (non succede): si mira dritto in su
  const ux = distanza ? (cx - partenza.x) / distanza : 0, uy = distanza ? (cy - partenza.y) / distanza : -1;
  const l = r.x1 - r.x0, h = r.y1 - r.y0;
  const profondita = Math.min(ux ? l / Math.abs(ux) : Infinity, uy ? h / Math.abs(uy) : Infinity);
  const mezza = (0.5 + FIONDA.margine) * profondita;
  return { distanza, profondita, vicino: Math.max(0, distanza - mezza), lontano: distanza + mezza };
}

/** La forza (0–1) che porta il tiro a distanza `d` lungo la fascia (non limitata). */
export function forzaPerDistanza(d: number, f: Fascia): number {
  return f.lontano > f.vicino ? (d - f.vicino) / (f.lontano - f.vicino) : 0;
}

/** La lunghezza dell'elastico per la forza `forza` (0 = tiroMinimo, 1 = tiroMassimo). */
export function lunghezzaElastico(forza: number): number {
  return FIONDA.tiroMinimo + forza * (FIONDA.tiroMassimo - FIONDA.tiroMinimo);
}

/**
 * Il punto in cui arriva il tiro: direzione opposta all'elastico, distanza misurata sulla fascia del recinto bersaglio
 * (`vicino` al tiro più debole, il centro a metà tiro, `lontano` a forza piena); `null` se l'elastico è quasi a riposo.
 */
export function puntoArrivo(partenza: Punto, tiro: Punto, r: Rett): Punto | null {
  const lunghezza = Math.hypot(tiro.x, tiro.y);
  if (lunghezza < FIONDA.tiroMinimo) return null;
  const f = fasciaDi(partenza, r);
  const forza = (Math.min(lunghezza, FIONDA.tiroMassimo) - FIONDA.tiroMinimo) / (FIONDA.tiroMassimo - FIONDA.tiroMinimo);
  const distanza = f.vicino + forza * (f.lontano - f.vicino);
  return {
    x: partenza.x + (-tiro.x / lunghezza) * distanza,
    y: partenza.y + (-tiro.y / lunghezza) * distanza,
  };
}

/** Distanza ellittica dal centro del recinto, in frazione di larghezza e altezza (0 al centro). */
function distanzaEllittica(p: Punto, r: Rett): number {
  const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2;
  const dx = (p.x - cx) / ((r.x1 - r.x0) / 2);
  const dy = (p.y - cy) / ((r.y1 - r.y0) / 2);
  return Math.hypot(dx, dy);
}

/**
 * La distanza dal rettangolo `r` (0 dentro o sul bordo) misurata in fasce: 1 al limite di `fasciaBordo` (frazione della
 * larghezza in orizzontale, dell'altezza in verticale). In proporzione al recinto, quindi uguale su ogni sua copia in scala.
 */
function distanzaDalRecinto(p: Punto, r: Rett): number {
  const fx = FIONDA.fasciaBordo.x * (r.x1 - r.x0), fy = FIONDA.fasciaBordo.y * (r.y1 - r.y0);
  const dx = Math.max(r.x0 - p.x, 0, p.x - r.x1), dy = Math.max(r.y0 - p.y, 0, p.y - r.y1);
  return Math.hypot(fx ? dx / fx : dx ? Infinity : 0, fy ? dy / fy : dy ? Infinity : 0);
}

/**
 * La zona colpita: 3 nel cerchio del centro, 2 nel resto dell'interno del recinto, 1 sulla staccionata e fuori fino a
 * la fascia `fasciaBordo` dal bordo (tonda agli angoli), 0 oltre.
 */
export function zonaDi(p: Punto, r: Rett): 3 | 2 | 1 | 0 {
  const dentroStretto = p.x > r.x0 && p.x < r.x1 && p.y > r.y0 && p.y < r.y1;
  if (dentroStretto) return distanzaEllittica(p, r) <= FIONDA.cerchi.centro ? 3 : 2;
  return distanzaDalRecinto(p, r) <= 1 ? 1 : 0;
}

/** L'esito per il motore: gli agnellini della zona, mai più di quelli del bersaglio (`massimo`). */
export function esitoTiro(arrivo: Punto, r: Rett, massimo: number): number {
  return Math.min(zonaDi(arrivo, r), massimo);
}

/** I numeri scritti sulle tre zone (centro, resto dell'interno, bordo), già limitati dal bersaglio. */
export function valoriCerchi(massimo: number): [number, number, number] {
  return [Math.min(3, massimo), Math.min(2, massimo), Math.min(1, massimo)];
}

/** Un numero in [0,1) sempre uguale per lo stesso `seq` e diverso da un `seq` all'altro (la variazione di chi non tira). */
export function variazioneDaSeq(seq: number): number {
  const x = Math.sin(seq * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** La cornice della pecora di un giocatore, come `posto` della disposizione (`palco.posto(chi)`): angolo in alto a sinistra e larghezza. */
export interface PostoPecora { x: number; y: number; w: number }

/**
 * Il punto base della partenza, accanto alla pecora di chi tira: per la pecora in basso (cornice sotto la metà della scena)
 * alla sua destra, con i piedi all'altezza della sua testa; per quelle in alto davanti ai piedi, in mezzo alla pecora. Con
 * chi sta in basso (uguale con 2, 3 e 4 giocatori: cornice 2..126 × 524..629) è (197.9, 599.6): accanto alla pecora, sul
 * davanti del proprio recinto, lontano dalla mano, dal dado, dai pulsanti e dal consiglio. La stessa regola vale per la
 * mira e per il tiro mostrato sugli altri telefoni.
 */
export function basePartenza(p: PostoPecora): Punto {
  const b = p.y > H / 2 ? FIONDA.basePartenza.basso : FIONDA.basePartenza.alto;
  return { x: p.x + b.x * p.w, y: p.y + b.y * p.w };
}

/**
 * C'è spazio per tirare l'elastico fino in fondo da `partenza` verso il recinto `r`: il punto del tiro pieno (`tiroMassimo`
 * dalla parte opposta al centro del recinto) resta nello schermo, a `spazioTiro.lati` dai lati e `basso` dal fondo, e sotto
 * i pulsanti in cima (`alto`). Vicino a una pecora in alto quasi mai: si tirerebbe verso i pulsanti o fuori dallo schermo.
 */
export function spazioPerTirare(partenza: Punto, r: Rett): boolean {
  const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2;
  const d = Math.hypot(cx - partenza.x, cy - partenza.y);
  if (!d) return true;
  const x = partenza.x - ((cx - partenza.x) / d) * FIONDA.tiroMassimo;
  const y = partenza.y - ((cy - partenza.y) / d) * FIONDA.tiroMassimo;
  const { lati, alto, basso } = FIONDA.spazioTiro;
  return x >= lati && x <= W - lati && y >= alto && y <= H - basso;
}

const dentroRett = (p: Punto, r: Rett): boolean => p.x >= r.x0 && p.x <= r.x1 && p.y >= r.y0 && p.y <= r.y1;

/**
 * Il punto d'arrivo da disegnare per il punto vero `vero` (partito da `partenza`) sul recinto bersaglio `r`. Fuori dai limiti
 * di `atterraggio` (un colpo sotto la striscia in cima; un colpo a vuoto anche sul prato, sotto la collina e la casetta)
 * torna indietro lungo la linea del volo, fino al limite. Un colpo a vuoto resta a vuoto: se lì cadrebbe nella fascia del
 * recinto (dietro i recinti in alto c'è poco prato), va di lato, appena oltre la fascia, alla stessa profondità (prima dalla
 * parte del volo, mai dentro gli `altri` recinti), e se di lato non c'è posto davanti al recinto. Dipende solo dai numeri che
 * riceve: uguale su tutti i telefoni.
 */
export function arrivoInScena(partenza: Punto, vero: Punto, r: Rett, altri: readonly Rett[] = []): Punto {
  const { lati } = FIONDA.atterraggio;
  const { aVuoto, va, p } = indietroSullaLinea(partenza, vero, r);
  if (va(vero)) return vero;
  if (!aVuoto || zonaDi(p, r) === 0) return p;
  // Di lato, appena oltre la fascia (e il margine dei colpi a vuoto di scena), dalla parte verso cui andava il volo
  const fuori = FIONDA.fasciaBordo.x * (r.x1 - r.x0) + FIONDA.fuori;
  const verso = vero.x >= (r.x0 + r.x1) / 2 ? 1 : -1;
  const accanto = [verso, -verso].map((s) => ({ x: s > 0 ? r.x1 + fuori : r.x0 - fuori, y: p.y }));
  const libero = (q: Punto): boolean => va(q) && zonaDi(q, r) === 0 && !altri.some((a) => dentroRett(q, allargato(a)));
  const diLato = accanto.find(libero);
  if (diLato) return diLato;
  // Davanti al recinto, appena oltre la fascia
  return { x: Math.min(W - lati, Math.max(lati, p.x)), y: r.y1 + FIONDA.fasciaBordo.y * (r.y1 - r.y0) + FIONDA.fuori };
}

/**
 * Il punto vero riportato indietro lungo la linea dalla partenza fin dove resta nei limiti di `atterraggio` (`p`; il punto
 * stesso se ci sta), se è a vuoto e la regola dei limiti (`va`).
 */
function indietroSullaLinea(partenza: Punto, vero: Punto, r: Rett): { aVuoto: boolean; va: (p: Punto) => boolean; p: Punto } {
  const { lati, alto, prato } = FIONDA.atterraggio;
  const aVuoto = zonaDi(vero, r) === 0;
  const cima = aVuoto ? prato : alto;
  const va = (p: Punto): boolean => p.y >= cima && p.x >= lati && p.x <= W - lati;
  if (va(vero)) return { aVuoto, va, p: vero };
  const dx = vero.x - partenza.x, dy = vero.y - partenza.y;
  let t = 1;
  if (vero.y < cima && dy < 0) t = Math.min(t, (cima - partenza.y) / dy);
  if (vero.x < lati && dx < 0) t = Math.min(t, (lati - partenza.x) / dx);
  if (vero.x > W - lati && dx > 0) t = Math.min(t, (W - lati - partenza.x) / dx);
  t = Math.max(0, t);
  return { aVuoto, va, p: { x: partenza.x + dx * t, y: Math.max(cima, partenza.y + dy * t) } };
}

/**
 * Il colpo a vuoto lungo: va oltre il recinto `r`, verso l'alto, dove non può atterrare (sulla collina, sotto la striscia
 * in cima o fuori dai lati) e tornando indietro lungo la linea cadrebbe nella fascia del recinto (un colpo, a vederlo).
 * Non atterra: vola oltre lungo la linea e sparisce (dietro la collina o nel cielo). Uguale su tutti i telefoni.
 */
export function colpoLungo(partenza: Punto, vero: Punto, r: Rett): boolean {
  if (vero.y >= partenza.y) return false;
  const { aVuoto, va, p } = indietroSullaLinea(partenza, vero, r);
  return aVuoto && !va(vero) && zonaDi(p, r) !== 0;
}

/** L'elastico tirato al massimo (entro `cielo.pieno` da `tiroMassimo`): un colpo lungo così vola nel cielo. */
export function tiroPieno(tiro: Punto): boolean {
  return Math.hypot(tiro.x, tiro.y) >= FIONDA.tiroMassimo - FIONDA.cielo.pieno;
}

/** Sugli altri telefoni un colpo lungo vola nel cielo per circa `cielo.quota` dei `seq`: sempre lo stesso per lo stesso `seq`. */
export function cieloDaSeq(seq: number): boolean {
  return variazioneDaSeq(seq * 3 + 1) < FIONDA.cielo.quota;
}

/**
 * Dove il colpo lungo nel cielo sparisce: sulla linea dalla partenza verso `vero`, all'altezza `cielo.y` (o prima, al
 * limite dei lati dello schermo).
 */
export function puntoInCielo(partenza: Punto, vero: Punto): Punto {
  const { lati } = FIONDA.atterraggio;
  const dx = vero.x - partenza.x, dy = vero.y - partenza.y;
  let t = dy < 0 ? (FIONDA.cielo.y - partenza.y) / dy : 1;
  if (dx < 0) t = Math.min(t, (lati - partenza.x) / dx);
  if (dx > 0) t = Math.min(t, (W - lati - partenza.x) / dx);
  t = Math.max(0, t);
  return { x: partenza.x + dx * t, y: partenza.y + dy * t };
}

/**
 * La parte della linea da `partenza` a `vero` (0–1) in cui il volo esce dalla fascia del recinto `r` (il recinto con la sua
 * zona 1 attorno), dalla parte lontana: da lì in poi il Montone è oltre il recinto. 0 se la linea non la attraversa.
 */
export function uscitaDallaFascia(partenza: Punto, vero: Punto, r: Rett): number {
  const a = allargato(r);
  const d = { x: vero.x - partenza.x, y: vero.y - partenza.y };
  let entra = 0, esce = 1;
  for (const [p, v, lo, hi] of [[partenza.x, d.x, a.x0, a.x1], [partenza.y, d.y, a.y0, a.y1]] as const) {
    if (!v) {
      if (p < lo || p > hi) return 0;
      continue;
    }
    const t0 = (lo - p) / v, t1 = (hi - p) / v;
    entra = Math.max(entra, Math.min(t0, t1));
    esce = Math.min(esce, Math.max(t0, t1));
  }
  return entra <= esce ? Math.max(0, Math.min(1, esce)) : 0;
}

/**
 * Dove finisce il volo del colpo lungo dietro la collina: sulla linea verso `vero`, appena uscito dalla fascia del recinto
 * `r` (di `fuori`), o `vero` se è più vicino. Più in là sarebbe in cielo, in cima allo schermo: da lì cade dietro la collina.
 */
export function fineDietroLaCollina(partenza: Punto, vero: Punto, r: Rett): Punto {
  const d = Math.hypot(vero.x - partenza.x, vero.y - partenza.y);
  const t = d ? Math.min(1, uscitaDallaFascia(partenza, vero, r) + FIONDA.fuori / d) : 1;
  return { x: partenza.x + (vero.x - partenza.x) * t, y: partenza.y + (vero.y - partenza.y) * t };
}

/** Dove torna di corsa il Montone dopo un colpo lungo: sul prato davanti al recinto `r`, appena oltre la fascia. */
export function yRitorno(r: Rett): number {
  return r.y1 + FIONDA.fasciaBordo.y * (r.y1 - r.y0) + FIONDA.fuori;
}

/** Un recinto con la sua fascia della zona 1 attorno (lì un Montone a terra sembrerebbe un colpo). */
function allargato(a: Rett): Rett {
  const fx = FIONDA.fasciaBordo.x * (a.x1 - a.x0), fy = FIONDA.fasciaBordo.y * (a.y1 - a.y0);
  return { x0: a.x0 - fx, y0: a.y0 - fy, x1: a.x1 + fx, y1: a.y1 + fy };
}

/** Due rettangoli si sovrappongono (bordi che si toccano no). */
export function siToccano(a: Rett, b: Rett): boolean {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
}

/**
 * La striscia di prato su cui corre via il Montone da `da` verso il lato `lato` (-1 sinistra, 1 destra) fino fuori dallo
 * schermo: alta quanto il suo corpo sopra i piedi (`corpo.alto`), e da mezzo corpo dietro i piedi (`corpo.mezzo`).
 */
export function strisciaCorsa(da: Punto, corpo: { mezzo: number; alto: number }, lato: -1 | 1): Rett {
  return lato < 0
    ? { x0: -Infinity, y0: da.y - corpo.alto, x1: da.x + corpo.mezzo, y1: da.y }
    : { x0: da.x - corpo.mezzo, y0: da.y - corpo.alto, x1: Infinity, y1: da.y };
}

/**
 * Da che parte corre via il Montone senza passare sopra nessuno degli `ingombri` (i corpi che starebbero dietro di lui):
 * prima `primo` (il lato più vicino), poi l'altro; null se c'è qualcuno da tutte e due le parti (allora gli passa dietro).
 */
export function latoCorsa(da: Punto, corpo: { mezzo: number; alto: number }, ingombri: readonly Rett[], primo: -1 | 1): -1 | 1 | null {
  for (const lato of [primo, -primo as -1 | 1]) {
    const s = strisciaCorsa(da, corpo, lato);
    if (!ingombri.some((r) => siToccano(s, r))) return lato;
  }
  return null;
}

/**
 * La partenza del tiro: il punto base vicino alla pecora di chi tira, spostato entro `variazionePartenza` secondo
 * `variazione` (0–1, a caso su chi tira, da `variazioneDaSeq` sugli altri telefoni).
 */
export function partenzaDi(base: Punto, variazione: number): Punto {
  const angolo = variazione * 2 * Math.PI * 7;
  const resto = variazione * 97.13;
  const raggio = FIONDA.variazionePartenza * Math.sqrt(resto - Math.floor(resto));
  return { x: base.x + Math.cos(angolo) * raggio, y: base.y + Math.sin(angolo) * raggio };
}

/** Un punto d'arrivo ricavato in modo fisso da `seq`, che cade nella zona dell'`esito` (per mostrare i tiri agli altri telefoni). */
export function puntoDiScena(r: Rett, esito: number, seq: number): Punto {
  const angolo = ((seq * 137.5) % 360) * (Math.PI / 180);
  const c = Math.cos(angolo), s = Math.sin(angolo);
  const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2;
  const mezzaL = (r.x1 - r.x0) / 2, mezzaA = (r.y1 - r.y0) / 2;
  const { centro } = FIONDA.cerchi;
  if (esito >= 3) return { x: cx + c * centro * 0.5 * mezzaL, y: cy + s * centro * 0.5 * mezzaA };
  if (esito === 2) {
    // dentro il recinto, fuori dal cerchio del centro e ben staccato dalla staccionata
    const f = (centro + 1) / 2;
    return { x: cx + c * f * mezzaL, y: cy + s * f * mezzaA };
  }
  if (esito === 1) {
    // Un colpo sulla staccionata (seq pari) o appena fuori, nella fascia (seq dispari), dal lato indicato dall'angolo
    const lato = c >= 0 ? 1 : -1;
    const fuori = seq % 2 === 0 ? 0 : FIONDA.fasciaBordo.x * (r.x1 - r.x0) * 0.5;
    return { x: lato > 0 ? r.x1 + fuori : r.x0 - fuori, y: cy + s * 0.8 * mezzaA };
  }
  const oltre = FIONDA.fasciaBordo.y * (r.y1 - r.y0) + FIONDA.fuori;
  return { x: cx + c * 0.8 * mezzaL, y: seq % 2 === 0 ? r.y0 - oltre : r.y1 + oltre };
}

/** I puntini della scia: `puntiScia` punti equidistanti da `partenza` fino a `scia` del percorso, il primo escluso. */
export function scia(partenza: Punto, arrivo: Punto): Punto[] {
  const n = FIONDA.puntiScia;
  const punti: Punto[] = [];
  for (let i = 1; i <= n; i++) {
    const t = (FIONDA.scia * i) / n;
    punti.push({ x: partenza.x + (arrivo.x - partenza.x) * t, y: partenza.y + (arrivo.y - partenza.y) * t });
  }
  return punti;
}

/**
 * Un punto del recinto `da` riportato in proporzione sul recinto `a` (il tiro fatto sul recinto ingrandito, rimesso sul
 * recinto normale): le zone restano le stesse, un punto fuori resta fuori dalla stessa parte e alla stessa distanza relativa.
 * Un recinto `da` senza larghezza (o altezza) sposta il punto con l'angolo, senza scalare.
 */
export function riportaSuRecinto(p: Punto, da: Rett, a: Rett): Punto {
  const lDa = da.x1 - da.x0, hDa = da.y1 - da.y0;
  const sx = lDa ? (a.x1 - a.x0) / lDa : 1, sy = hDa ? (a.y1 - a.y0) / hDa : 1;
  return { x: a.x0 + (p.x - da.x0) * sx, y: a.y0 + (p.y - da.y0) * sy };
}

/** La pecora in volo al tempo `t` (limitato a 0–1): interpolazione lineare in pianta, più l'altezza dell'arco. */
export function posizioneInVolo(partenza: Punto, arrivo: Punto, tempo: number): Punto & { alto: number } {
  const t = Math.min(1, Math.max(0, tempo));
  const distanza = Math.hypot(arrivo.x - partenza.x, arrivo.y - partenza.y);
  return {
    x: partenza.x + (arrivo.x - partenza.x) * t,
    y: partenza.y + (arrivo.y - partenza.y) * t,
    alto: FIONDA.altezzaArco * distanza * 4 * t * (1 - t),
  };
}

/** Chi può restare sotto il Montone: il punto a terra (i piedi, in mezzo al corpo) e la mezza larghezza del corpo. */
export interface Ingombro { x: number; y: number; mezzo: number }

/** La distanza tra il punto d'arrivo e il corpo di `chi` (alla sua profondità): 0 se ci sta proprio sotto. */
function distanzaDalCorpo(arrivo: Punto, chi: Ingombro): number {
  return Math.hypot(Math.max(0, Math.abs(chi.x - arrivo.x) - chi.mezzo), chi.y - arrivo.y);
}

/**
 * Vero se `chi` resterebbe sotto il Montone atterrato in `arrivo` (`largo` la sua larghezza lì): il punto d'arrivo cade
 * sul suo corpo o entro `scansa.raggio` larghezze del Montone (mezzo Montone).
 */
export function coperto(arrivo: Punto, largo: number, chi: Ingombro): boolean {
  return distanzaDalCorpo(arrivo, chi) < FIONDA.scansa.raggio * largo;
}

/**
 * Dove si sposta `chi` se è coperto: di lato, alla stessa profondità, quanto basta per uscire dal raggio più il margine.
 * Prima dalla parte più vicina; proprio sotto il punto d'arrivo, verso il centro della scena. `va` dice se una x va bene
 * (dentro lo schermo, fuori dal cartello del Gregge…): se da una parte non va, dall'altra. Null se non è coperto o se non
 * va bene nessuna delle due. `oltre`: quanto andare ancora più in là (il ventaglio degli agnellini); se così non va bene da
 * nessuna parte, quanto basta. Dipende solo dai numeri che riceve: uguale su tutti i telefoni.
 */
export function scansa(arrivo: Punto, largo: number, chi: Ingombro, va: (x: number) => boolean = () => true, oltre = 0): number | null {
  if (!coperto(arrivo, largo, chi)) return null;
  const r = (FIONDA.scansa.raggio + FIONDA.scansa.margine) * largo;
  const dy = chi.y - arrivo.y;
  const di = chi.mezzo + Math.sqrt(r * r - dy * dy);
  const lato = chi.x !== arrivo.x ? Math.sign(chi.x - arrivo.x) : arrivo.x < W / 2 ? 1 : -1;
  const prove = [di + oltre, -(di + oltre), di, -di];
  for (const d of oltre > 0 ? prove : prove.slice(2)) if (va(arrivo.x + lato * d)) return arrivo.x + lato * d;
  return null;
}

/**
 * Di quanto va ancora più in là (in larghezze del Montone) l'`i`-esimo agnellino che si scansa insieme agli altri: il primo
 * niente, poi passi sparpagliati (la parte decimale di i × 0,618…, il rapporto aureo) fino a `scansa.ventaglio`. Vicini
 * nell'ordine, lontani nel posto: non si mettono in fila.
 */
export function ventaglio(i: number): number {
  return ((i * 0.6180339887) % 1) * FIONDA.scansa.ventaglio;
}
