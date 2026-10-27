// Il teatro chiede: mostra la "domanda di adesso" (scelte/tipi.ts) dentro la scena e restituisce i gesti.
// Non conosce le regole: dalla domanda ricava zone di tocco sulle pecore, pulsanti, dado illuminato, il comando della mano,
// le carte grandi (al centro della tovaglia o affiancate), i Guai dell'angolo, gli agnellini alzati del furto, la fionda della Testata
// (fionda/mira.ts) e la nuvoletta del pensiero.
// Le zone, i pulsanti e le carte grandi stanno nello strato `.ui` (fermo anche quando la camera si avvicina a un giocatore);
// le zone si posizionano con `camera.inScenaDaMondo`, perché il prato può essere inquadrato da vicino.
// Gli agnellini alzati e le mini dei Guai sono decorazione del tavolo (non cambiano area né conti): il teatro li illumina o li alza
// e li rimette a posto quando la domanda se ne va. Le tenute (lettura di una carta) usano tempo vero, come la mano.
// Chi lo usa (teatro.ts) decide quando mostrarlo: mai durante la recita, e rimette tutto a posto dopo ricostruzione o resize.
import { defCarta } from '../../../engine/src';
import type { IdCarta, IdGiocatore } from '../../../engine/src';
import { T } from '../testi';
import type { Camera } from './camera';
import { cartaSVG } from './carte/carte';
import type { Contesto } from './contesto';
import { creaMira } from './fionda/mira';
import type { Lettura } from './lettura';
import type { Mano } from './mano';
import { posaSollevata, trasf } from './mano';
import { H, W } from './misure';
import { CENTRO_TAVOLO } from './ordini';
import type { Palco } from './palco';
import { QUOTA_ALZATO, type Agnello } from './personaggi/agnello';
import type { Domanda, Gesto, Pensiero } from './scelte/tipi';
import type { IdPulsante } from './scelte/tipi';

export interface OpzioniChiedi {
  /** Il nome del giocatore, per chi legge lo schermo (zone di tocco). Senza, vale il suo id. */
  nomeDi?: (chi: IdGiocatore) => string;
  /** La fotografia ha la mano scoperta: senza, nessuna carta è mai toccabile (regola anti-sbirciata). Senza opzione: sì. */
  manoScoperta?: () => boolean;
  /** Una carta risulta sollevata dalla domanda (il consiglio "tocca una carta" non serve più). */
  allaSollevata?: () => void;
  /** La domanda ha carte da trascinare, con la mano scoperta (il consiglio "trascina" può comparire). */
  allaTrascinabile?: () => void;
  /** La lettura delle carte: la tenuta su una carta grande, sulla carta al centro o su un Guaio dell'angolo la apre. Senza, niente lettura. */
  lettura?: Lettura;
}

export interface Chiedi {
  /** Mostra la domanda (sostituisce la vecchia) e manda i gesti a `suGesto`. */
  mostra(d: Domanda, suGesto: (g: Gesto) => void): void;
  /** Toglie la domanda: zone, pulsanti, illuminazioni; la mano torna libera. */
  togli(): void;
  /** Rimette zone, pulsanti, carte, agnellini alzati e nuvoletta sul tavolo di adesso (dopo una ricostruzione, un resize, una mano nuova). Senza domanda e senza pensiero non fa niente. */
  riposiziona(): void;
  /** La nuvoletta del pensiero: tre pallini che salgono dalla pecora in basso, poi la nuvola con titolo, testo e pulsanti. null la toglie. */
  pensa(p: Pensiero | null): void;
  /** C'è una domanda mostrata adesso. */
  visibile(): boolean;
  distruggi(): void;
}

/**
 * Dove un tocco non è un tocco sul prato: la mano, il menu, la lettura, le zone, i pulsanti, il dado, la nuvoletta,
 * le carte grandi (e quella al centro), i Guai dell'angolo illuminati, gli agnellini alzati del furto e il Montone della fionda.
 */
export const NON_PRATO =
  '.mano, .hud, .opzioni, .eventi, .lettura, .finale, .zona, .pulsanti-carta, .pulsanti-fila, .pensiero, .dado-pos, .carta-grande, .zona-guaio, .mini.illuminata, .agnellino-alzato, .zona-fionda';
/** Zone di tocco: quanto escono dal disegno (dita grandi su schermo piccolo) e che stacco resta tra due zone vicine. */
const MARGINE_ZONA = 4;
const STACCO_ZONE = 2;
/** Metà larghezza e altezza della targa, per la zona (la targa vera dipende dal nome). */
const META_TARGA = 40;
const ALTEZZA_TARGA = 22;
/** Distanza dei pulsanti dal bordo della carta sollevata (scena) e dalla cima del ventaglio. */
const GIOCA_SOTTO = 6;
const FILA_SOPRA_VENTAGLIO = 10;
/** Cima del ventaglio a riposo e altezza dei pulsanti, per tenerli dentro la scena (coordinate della mano). */
const CIMA_VENTAGLIO = 722;
const ALTEZZA_PULSANTE = 44;
/** Tenuta per leggere una carta (come la mano) e quanto può muoversi il dito perché resti un tocco. */
const TENUTA_MS = 430;
const SOGLIA_MOSSO = 12;
/** Carte grandi affiancate: centro verticale, scala massima, margine e distanza minima. */
const GRANDI_Y = 340;
const GRANDI_K = 0.68;
const GRANDI_MARGINE = 10;
const GRANDI_STACCO = 10;
/** Agnellino alzato: lato minimo del controllo per il dito e metà altezza del corpo (per centrarlo). */
const LATO_AGNELLINO = 30;
const META_CORPO_AGNELLINO = 12;
/** Nuvoletta: testa della pecora in basso (frazioni del suo riquadro), altezza dei tre pallini e margine della nuvola. */
const TESTA_X = 0.78;
const TESTA_Y = 0.2;
const PALLINI: Array<{ dx: number; dy: number; d: number }> = [
  { dx: 2, dy: -8, d: 7 },
  { dx: 10, dy: -24, d: 11 },
  { dx: 20, dy: -44, d: 15 },
];
const NUVOLA_SOPRA_PALLINI = 8;
const NUVOLA_LARGA = 240;
/**
 * Mentre c'è la fionda della Testata il Montone sta accanto alla pecora in basso e la scia sale da lui: la nuvola va sotto,
 * sopra la mano (che durante la Testata non si usa), e cresce verso il basso. I pallini scendono dai piedi della pecora
 * (`PIEDI_X`, `PIEDI_Y`: frazioni del suo riquadro) e la nuvola comincia appena sotto l'ultimo, a sinistra della scena.
 */
const PIEDI_X = 0.32;
const PIEDI_Y = 0.83;
const PALLINI_SOTTO: Array<{ dx: number; dy: number; d: number }> = [
  { dx: 0, dy: 3, d: 6 },
  { dx: -5, dy: 13, d: 9 },
  { dx: -10, dy: 25, d: 12 },
];
const NUVOLA_SOTTO_PALLINI = 4;
const NUVOLA_SOTTO_X = 10;

type Rett = [number, number, number, number];

/** Ciò che la mano deve sapere: con la mano coperta nessuna carta è toccabile, sollevata o trascinabile. */
export function carteComandate(d: Domanda, manoScoperta: boolean): { toccabili: string[]; sollevate: string[]; trascinabili: string[] } {
  if (!manoScoperta) return { toccabili: [], sollevate: [], trascinabili: [] };
  return { toccabili: d.carte, sollevate: d.sollevate, trascinabili: d.trascinabili };
}

/** Due zone di giocatori diversi non si toccano: dove si sovrappongono si taglia a metà del tratto in comune. */
export function separaZone(zone: Map<IdGiocatore, Rett>): void {
  const voci = [...zone.values()];
  for (let giro = 0; giro < 8; giro++) {
    let cambiato = false;
    for (let i = 0; i < voci.length; i++) {
      for (let j = i + 1; j < voci.length; j++) {
        const a = voci[i]!;
        const b = voci[j]!;
        const ox = Math.min(a[2], b[2]) - Math.max(a[0], b[0]);
        const oy = Math.min(a[3], b[3]) - Math.max(a[1], b[1]);
        if (ox <= 0 || oy <= 0) continue;
        cambiato = true;
        // Si taglia lungo l'asse in cui il tratto in comune è più sottile
        const lo = ox <= oy ? 0 : 1;
        const hi = lo + 2;
        const meta = (Math.max(a[lo]!, b[lo]!) + Math.min(a[hi]!, b[hi]!)) / 2;
        const primo = a[lo]! + a[hi]! <= b[lo]! + b[hi]! ? a : b;
        const secondo = primo === a ? b : a;
        primo[hi] = Math.min(primo[hi]!, meta - STACCO_ZONE / 2);
        secondo[lo!] = Math.max(secondo[lo!]!, meta + STACCO_ZONE / 2);
      }
    }
    if (!cambiato) return;
  }
}

export function creaChiedi(ctx: Contesto, palco: Palco, mano: Mano, camera: Camera, opz: OpzioniChiedi = {}): Chiedi {
  const ui = ctx.el.ui;
  const scena = ctx.el.scena;
  let corrente: { d: Domanda; suGesto: (g: Gesto) => void } | null = null;
  /** Ciò che la mano sta eseguendo adesso: si richiama `comanda` solo se cambia (ogni chiamata annulla un trascinamento). */
  let chiaveMano: string | null = null;
  const zone = new Map<IdGiocatore, HTMLElement>();
  const bottoni = new Map<IdPulsante, HTMLButtonElement>();
  let pensiero: { p: Pensiero; el: HTMLElement; nuvola: HTMLElement; pallini: HTMLElement[] } | null = null;
  const grandi = new Map<IdCarta, HTMLElement>();
  let alCentro: { id: IdCarta; el: HTMLElement } | null = null;
  /** I controlli dei Guai dell'angolo per chi usa la tastiera o il lettore di schermo (il tocco passa dalla mini stessa). */
  const controlliGuai = new Map<IdCarta, HTMLElement>();
  /** Gli agnellini alzati per il furto, per giocatore, e i loro controlli di tocco nello strato `.ui`. */
  const alzati = new Map<IdGiocatore, Agnello[]>();
  const controlliAgnelli = new Map<Agnello, HTMLElement>();
  /** La fionda della Testata: Montone, cerchi sul recinto del bersaglio e zona di tocco (fionda/mira.ts). */
  const mira = creaMira(ctx, palco, camera);

  const sotto = document.createElement('div');
  sotto.className = 'pulsanti-carta';
  sotto.hidden = true;
  const fila = document.createElement('div');
  fila.className = 'pulsanti-fila';
  fila.hidden = true;
  ui.append(sotto, fila);

  const manda = (g: Gesto): void => corrente?.suGesto(g);
  /** Invio o Spazio, la prima volta: tenuto premuto il tasto si ripete, ma è un tocco solo (come per le carte della mano). */
  const tastoDiTocco = (e: KeyboardEvent): boolean => {
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return false;
    e.preventDefault();
    return !e.repeat;
  };
  /**
   * Tocco vero (il dito scende e sale sull'elemento), clic senza puntatore (lettore di schermo, prove) e tasti; un tocco dà
   * un gesto solo. Il tasto destro o centrale del mouse non è un tocco.
   */
  const conTocco = (el: HTMLElement, gesto: () => Gesto | null): void => {
    let giu = false;
    const vai = (): void => {
      const g = gesto();
      if (g) manda(g);
    };
    el.addEventListener('pointerdown', (e) => {
      giu = !(e as MouseEvent).button;
    });
    el.addEventListener('pointercancel', () => {
      giu = false;
    });
    el.addEventListener('pointerup', () => {
      if (!giu) return;
      giu = false;
      vai();
    });
    el.addEventListener('click', (e) => {
      if (e.detail === 0) vai();
    });
    el.addEventListener('keydown', (e) => {
      if (tastoDiTocco(e)) vai();
    });
  };
  /** Clic (solo il tasto sinistro) e tasti, senza ripetizioni. */
  const conTastiera = (el: HTMLElement, gesto: () => Gesto | null): void => {
    const vai = (): void => {
      const g = gesto();
      if (g) manda(g);
    };
    el.addEventListener('click', (e) => {
      if (!e.button) vai();
    });
    el.addEventListener('keydown', (e) => {
      if (tastoDiTocco(e)) vai();
    });
  };

  // Il dado sta nel mondo (sotto la camera) e non si ricrea mai: i suoi gesti si collegano una volta sola
  const dado = ctx.el.dadoPos;
  const dadoAcceso = (): boolean => !!corrente?.d.dado;
  conTastiera(dado, () => (dadoAcceso() ? { tipo: 'dado' } : null));
  // Il mondo è nascosto ai lettori di schermo: per Tab e lettori il dado ha un controllo nello strato .ui, sopra di lui,
  // che lascia passare il tocco al dado vero (come i Guai dell'angolo)
  const zonaDado = document.createElement('div');
  zonaDado.className = 'zona-dado';
  zonaDado.setAttribute('role', 'button');
  zonaDado.setAttribute('aria-label', T.azioni.lancia);
  zonaDado.hidden = true;
  conTastiera(zonaDado, () => (dadoAcceso() ? { tipo: 'dado' } : null));
  ui.appendChild(zonaDado);

  const suPrato = (e: Event): void => {
    if (!corrente) return;
    const t = e.target as Element | null;
    if (t?.closest?.(NON_PRATO)) return;
    corrente.suGesto({ tipo: 'prato' });
  };
  scena.addEventListener('pointerdown', suPrato);

  // Tocco o tenuta su una carta fuori dalla mano (carta grande, carta al centro, Guaio dell'angolo): un tocco breve manda il suo gesto
  // (se ne ha uno), una tenuta apre la lettura finché dura, un dito che si muove molto non è né l'uno né l'altro.
  interface Pressione {
    suTocco: (() => void) | null;
    timer: ReturnType<typeof setTimeout> | null;
    inLettura: boolean;
    mosso: boolean;
    x: number;
    y: number;
  }
  let pressione: Pressione | null = null;
  const suRilascio = (e: Event): void => finePressione(e.type === 'pointercancel');
  const suMovimento = (e: Event): void => {
    const p = pressione;
    if (!p || p.mosso || p.inLettura) return;
    const m = e as MouseEvent;
    if (Math.hypot(m.clientX - p.x, m.clientY - p.y) <= SOGLIA_MOSSO) return;
    p.mosso = true;
    if (p.timer !== null) clearTimeout(p.timer);
    p.timer = null;
  };
  function finePressione(annulla: boolean): void {
    const p = pressione;
    if (!p) return;
    pressione = null;
    if (p.timer !== null) clearTimeout(p.timer);
    window.removeEventListener('pointerup', suRilascio);
    window.removeEventListener('pointercancel', suRilascio);
    window.removeEventListener('pointermove', suMovimento);
    if (p.inLettura) opz.lettura?.chiudi();
    else if (!annulla && !p.mosso) p.suTocco?.();
  }
  function iniziaPressione(carta: IdCarta, suTocco: (() => void) | null, e: Event): void {
    finePressione(true);
    // Il clic destro o centrale del mouse non è un tocco (il tasto del dito è sempre 0)
    if ((e as MouseEvent).button) return;
    const m = e as MouseEvent;
    const p: Pressione = { suTocco, timer: null, inLettura: false, mosso: false, x: m.clientX ?? 0, y: m.clientY ?? 0 };
    p.timer = setTimeout(() => {
      p.timer = null;
      if (pressione !== p) return;
      p.inLettura = true;
      opz.lettura?.apri(carta, true);
    }, TENUTA_MS);
    pressione = p;
    window.addEventListener('pointerup', suRilascio);
    window.addEventListener('pointercancel', suRilascio);
    window.addEventListener('pointermove', suMovimento);
  }

  // I Guai illuminati nell'angolo di chi sta in basso: il tocco è il gesto, la tenuta legge. La mini apre da sé la lettura al tocco
  // (postazioni.ts): con una domanda che la vuole la si intercetta prima, in cattura sul mondo.
  const suMini = (e: Event): void => {
    if (!corrente) return;
    const mini = (e.target as Element | null)?.closest?.('.mini.illuminata') as HTMLElement | null | undefined;
    const carta = mini?.dataset.carta as IdCarta | undefined;
    if (!mini || !carta) return;
    e.stopPropagation();
    iniziaPressione(carta, () => manda({ tipo: 'guaio', carta }), e);
  };
  ctx.el.mondo.addEventListener('pointerdown', suMini, true);

  /** Il rettangolo del posto nel mondo: recinto, pecora e targa, con un po' di margine, dentro la scena. */
  function rettangoloDi(chi: IdGiocatore): Rett | null {
    const p = palco.posto(chi);
    if (!p) return null;
    const [x, yDietro, yDavanti, larg, k] = p.recinto;
    const [tx, ty] = p.targa;
    const caselle: Rett[] = [
      [x - 4 * k, yDietro - 22 * k, x + larg + 4 * k, yDavanti + 3 * k + 2],
      [p.x, p.y, p.x + p.w, p.y + p.w * 0.85],
      [tx - META_TARGA, ty - 3, tx + META_TARGA, ty + ALTEZZA_TARGA],
    ];
    const r: Rett = [
      Math.min(...caselle.map((c) => c[0])) - MARGINE_ZONA,
      Math.min(...caselle.map((c) => c[1])) - MARGINE_ZONA,
      Math.max(...caselle.map((c) => c[2])) + MARGINE_ZONA,
      Math.max(...caselle.map((c) => c[3])) + MARGINE_ZONA,
    ];
    return [Math.max(0, r[0]), Math.max(0, r[1]), Math.min(W, r[2]), Math.min(H, r[3])];
  }

  function posizionaZone(): void {
    const rett = new Map<IdGiocatore, Rett>();
    for (const chi of zone.keys()) {
      const r = rettangoloDi(chi);
      if (r) rett.set(chi, r);
    }
    separaZone(rett);
    for (const [chi, el] of zone) {
      const r = rett.get(chi);
      if (!r) continue;
      // La camera può avere il prato inquadrato da vicino: i due angoli si portano sullo schermo
      const a = camera.inScenaDaMondo(r[0], r[1]);
      const b = camera.inScenaDaMondo(r[2], r[3]);
      el.style.left = `${Math.min(a.x, b.x)}px`;
      el.style.top = `${Math.min(a.y, b.y)}px`;
      el.style.width = `${Math.abs(b.x - a.x)}px`;
      el.style.height = `${Math.abs(b.y - a.y)}px`;
    }
  }

  function creaZona(chi: IdGiocatore): HTMLElement {
    const el = document.createElement('div');
    el.className = 'zona';
    el.dataset.chi = chi;
    el.setAttribute('role', 'button');
    el.tabIndex = 0;
    conTastiera(el, () => ({ tipo: 'pecora', chi }));
    ui.appendChild(el);
    return el;
  }

  function creaBottone(id: IdPulsante): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.addEventListener('click', (e) => {
      if (!e.button) manda({ tipo: 'pulsante', id });
    });
    // Invio tenuto premuto ripete il clic del pulsante: lo si ferma sul tasto ripetuto
    b.addEventListener('keydown', (e) => {
      if (e.repeat && (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar')) e.preventDefault();
    });
    return b;
  }

  /** Mette `lista` dentro `contenitore` in quest'ordine, spostando solo se serve (un pulsante che resta tiene il fuoco). */
  function ordina(contenitore: HTMLElement, lista: HTMLElement[]): void {
    const uguali = contenitore.children.length === lista.length && lista.every((e, i) => contenitore.children[i] === e);
    if (!uguali) contenitore.replaceChildren(...lista);
  }

  function aggiornaZone(d: Domanda): void {
    // Solo chi sta davvero al tavolo (dopo una ricostruzione la domanda può nominare chi non c'è più)
    const presenti = d.pecore.filter((chi) => palco.posto(chi));
    for (const [chi, el] of [...zone]) {
      if (presenti.includes(chi)) continue;
      el.remove();
      zone.delete(chi);
    }
    for (const chi of presenti) {
      let el = zone.get(chi);
      if (!el) zone.set(chi, (el = creaZona(chi)));
      el.setAttribute('aria-label', opz.nomeDi?.(chi) ?? chi);
    }
    // Illuminate: la pecora e il recinto di chi si può toccare (il saltello è del CSS; con "Riduci movimento" resta la luce)
    for (const e of ctx.el.mondo.querySelectorAll<HTMLElement | SVGElement>('.pecora, .recinto')) {
      const acceso = d.pecore.includes(e.dataset.chi as IdGiocatore);
      e.classList.toggle('illuminata', acceso);
      e.classList.toggle('ferma', acceso && ctx.ridotto);
    }
  }

  function aggiornaDado(d: Domanda): void {
    dado.classList.toggle('illuminata', d.dado);
    dado.classList.toggle('ferma', d.dado && ctx.ridotto);
    zonaDado.hidden = !d.dado;
    if (d.dado) zonaDado.tabIndex = 0;
    else zonaDado.removeAttribute('tabindex');
  }

  /** Il controllo del dado sopra il dado disegnato (la tovaglia è inclinata: si misura sullo schermo; jsdom non misura). */
  function posizionaDado(): void {
    if (zonaDado.hidden) return;
    const r = dado.getBoundingClientRect();
    const u = ui.getBoundingClientRect();
    if (r.width <= 0 || u.width <= 0) return;
    const s = u.width / W;
    zonaDado.style.left = `${(r.left - u.left) / s}px`;
    zonaDado.style.top = `${(r.top - u.top) / s}px`;
    zonaDado.style.width = `${r.width / s}px`;
    zonaDado.style.height = `${r.height / s}px`;
  }

  function aggiornaPulsanti(d: Domanda): void {
    const attuali = new Set(d.pulsanti.map((p) => p.id));
    for (const [id, b] of [...bottoni]) {
      if (attuali.has(id)) continue;
      b.remove();
      bottoni.delete(id);
    }
    const dentroSotto: HTMLElement[] = [];
    const dentroFila: HTMLElement[] = [];
    for (const p of d.pulsanti) {
      let b = bottoni.get(p.id);
      if (!b) bottoni.set(p.id, (b = creaBottone(p.id)));
      if (b.textContent !== p.testo) b.textContent = p.testo;
      b.disabled = !p.attivo;
      b.className = 'btn' + (p.secondario ? ' secondario' : ' primario');
      (p.sottoLaCarta ? dentroSotto : dentroFila).push(b);
    }
    ordina(sotto, dentroSotto);
    ordina(fila, dentroFila);
  }

  /** Dove stanno i pulsanti: "Gioca" sotto le carte sollevate, gli altri in fila sopra il ventaglio. */
  function posizionaPulsanti(): void {
    const kd = ctx.KD;
    const centro = mano.sollevateIn();
    sotto.hidden = sotto.children.length === 0 || centro === null;
    if (!sotto.hidden && centro) {
      // `sollevateIn` è il centro del gruppo: il bordo basso sta a metà altezza di carta sotto (175 · k · KD)
      const n = ctx.el.mano.querySelectorAll('.cm.attiva').length;
      const k = posaSollevata(0, Math.max(1, n)).k;
      const piu = Math.min(H - ALTEZZA_PULSANTE * kd - 8, centro.y + 175 * k * kd + GIOCA_SOTTO);
      sotto.style.left = `${Math.max(0, Math.min(W, centro.x))}px`;
      sotto.style.top = `${Math.max(8, piu)}px`;
    }
    fila.hidden = fila.children.length === 0;
    if (!fila.hidden) {
      // La fila poggia sopra il ventaglio (la mano cresce di KD attorno al centro in basso)
      const cima = H + (CIMA_VENTAGLIO - H) * kd - FILA_SOPRA_VENTAGLIO;
      fila.style.left = '195px';
      fila.style.top = `${cima}px`;
    }
  }

  function comandaMano(d: Domanda): void {
    const c = carteComandate(d, opz.manoScoperta ? opz.manoScoperta() : true);
    const chiave = JSON.stringify(c);
    if (chiave === chiaveMano) return;
    chiaveMano = chiave;
    mano.comanda({
      toccabili: c.toccabili,
      sollevate: c.sollevate,
      trascinabili: c.trascinabili,
      suTocco: (carta) => manda({ tipo: 'carta', carta }),
      suTrascinata: (carta) => manda({ tipo: 'trascinata', carta }),
    });
    if (c.sollevate.length > 0 && mano.attiva() !== null) opz.allaSollevata?.();
    if (c.trascinabili.length > 0) opz.allaTrascinabile?.();
  }

  // ---------- Carte grandi (Guarda le prime 2) e carta al centro ----------

  /** Una carta in grande nello strato `.ui`: tocco, tenuta per leggerla, tastiera. Quella al centro è solo da guardare. */
  function creaCartaGrande(id: IdCarta, solaDaGuardare: boolean): HTMLElement {
    const el = document.createElement('div');
    el.className = 'carta-grande' + (solaDaGuardare ? ' al-centro' : '');
    el.dataset.carta = id;
    el.innerHTML = cartaSVG(id, true);
    el.setAttribute('aria-label', defCarta(id).nome);
    const gesto = (): void => manda({ tipo: 'grande', carta: id });
    if (solaDaGuardare) el.setAttribute('role', 'img');
    else {
      el.setAttribute('role', 'button');
      el.tabIndex = 0;
      // Il clic "vero" (dito, mouse) passa dalla pressione; quello senza puntatore (lettore di schermo, prove) è un tocco intero
      el.addEventListener('click', (e) => {
        if (e.detail === 0) gesto();
      });
      el.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
        e.preventDefault();
        gesto();
      });
    }
    el.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      iniziaPressione(id, solaDaGuardare ? null : gesto, e);
    });
    // La pressione lunga su Android aprirebbe il menu del browser
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    ui.appendChild(el);
    return el;
  }

  function aggiornaCarte(d: Domanda): void {
    // Al centro della tovaglia
    if (alCentro && alCentro.id !== d.centro) {
      alCentro.el.remove();
      alCentro = null;
    }
    if (d.centro && !alCentro) alCentro = { id: d.centro, el: creaCartaGrande(d.centro, true) };
    if (alCentro) alCentro.el.style.transform = trasf({ ...CENTRO_TAVOLO, r: 0, f: 0 });
    // Affiancate sopra la tovaglia
    for (const [id, el] of [...grandi]) {
      if (d.grandi.includes(id)) continue;
      el.remove();
      grandi.delete(id);
    }
    const n = d.grandi.length;
    const k = Math.min(GRANDI_K, (W - 2 * GRANDI_MARGINE - GRANDI_STACCO * (n - 1)) / (250 * Math.max(1, n)));
    const passo = 250 * k + GRANDI_STACCO;
    d.grandi.forEach((id, i) => {
      let el = grandi.get(id);
      if (!el) grandi.set(id, (el = creaCartaGrande(id, false)));
      el.style.transform = trasf({ x: 195 + (i - (n - 1) / 2) * passo, y: GRANDI_Y, k, r: 0, f: 0 });
    });
  }

  // ---------- Guai dell'angolo ----------

  function aggiornaGuai(d: Domanda): void {
    const io = palco.inBasso();
    const accese = new Map<IdCarta, HTMLElement>();
    for (const m of ctx.el.mondo.querySelectorAll<HTMLElement>('.mini')) {
      const carta = m.dataset.carta as IdCarta | undefined;
      const acceso = !!carta && d.guai.includes(carta) && m.dataset.chi === io;
      m.classList.toggle('illuminata', acceso);
      // il Guaio scelto con un tocco resta evidenziato mentre si aspetta la conferma
      m.classList.toggle('scelta', acceso && carta === d.guaioScelto);
      if (acceso) accese.set(carta, m);
    }
    for (const [carta, el] of [...controlliGuai]) {
      if (accese.has(carta)) continue;
      el.remove();
      controlliGuai.delete(carta);
    }
    let z = 1100;
    for (const [carta, mini] of accese) {
      let el = controlliGuai.get(carta);
      if (!el) {
        el = document.createElement('div');
        el.className = 'zona-guaio';
        el.setAttribute('role', 'button');
        el.tabIndex = 0;
        el.setAttribute('aria-label', defCarta(carta).nome);
        conTastiera(el, () => ({ tipo: 'guaio', carta }));
        ui.appendChild(el);
        controlliGuai.set(carta, el);
      }
      // Sopra la mini (le sue misure le ha messe postazioni.ts nel mondo); il tocco vero passa dalla mini
      const x = parseFloat(mini.style.left);
      const y = parseFloat(mini.style.top);
      const w = parseFloat(mini.style.width);
      const h = parseFloat(mini.style.height);
      el.style.zIndex = String(z++);
      if (![x, y, w, h].every(Number.isFinite)) continue;
      const a = camera.inScenaDaMondo(x, y);
      const b = camera.inScenaDaMondo(x + w, y + h);
      el.style.left = `${Math.min(a.x, b.x)}px`;
      el.style.top = `${Math.min(a.y, b.y)}px`;
      el.style.width = `${Math.abs(b.x - a.x)}px`;
      el.style.height = `${Math.abs(b.y - a.y)}px`;
    }
  }

  // ---------- Furto: gli agnellini presi, alzati sopra la staccionata ----------

  function abbassa(chi: IdGiocatore): void {
    for (const g of alzati.get(chi) ?? []) {
      g.abbassa();
      controlliAgnelli.get(g)?.remove();
      controlliAgnelli.delete(g);
    }
    alzati.delete(chi);
  }

  function aggiornaFurto(d: Domanda): void {
    const presi = d.furto?.presi ?? {};
    for (const chi of [...alzati.keys()]) {
      if (!((presi[chi] ?? 0) > 0) || !palco.posto(chi)) abbassa(chi);
    }
    const tutti = [...palco.agnelli()];
    const inUso = new Set([...alzati.values()].flat());
    for (const [chi, voluti] of Object.entries(presi)) {
      if (!voluti || voluti <= 0 || !palco.posto(chi)) continue;
      // Chi era già alzato resta alzato, se può ancora esserlo (dopo una ricostruzione sono tutti agnellini nuovi)
      const lista = (alzati.get(chi) ?? []).filter((g) => {
        const buono = g.vivo && g.sollevato && g.a.nome === chi && g.sollevabile;
        if (!buono) {
          g.abbassa();
          inUso.delete(g);
          controlliAgnelli.get(g)?.remove();
          controlliAgnelli.delete(g);
        }
        return buono;
      });
      for (const g of lista.splice(voluti)) {
        g.abbassa();
        inUso.delete(g);
        controlliAgnelli.get(g)?.remove();
        controlliAgnelli.delete(g);
      }
      if (lista.length < voluti) {
        // Si alzano i più vicini alla staccionata davanti; chi è in viaggio, preso dal meteo o intrappolato non è candidato
        const candidati = tutti
          .filter((g) => g.a.nome === chi && g.sollevabile && !g.sollevato && !inUso.has(g))
          .sort((p, q) => q.y - p.y || p.x - q.x);
        for (const g of candidati) {
          if (lista.length >= voluti) break;
          if (!g.alza()) continue;
          lista.push(g);
          inUso.add(g);
        }
      }
      alzati.set(chi, lista);
    }
    // Un controllo di tocco per agnellino alzato, nello strato `.ui` e sopra la zona del recinto
    let z = 1300;
    for (const [chi, lista] of alzati) {
      for (const g of lista) {
        let el = controlliAgnelli.get(g);
        if (!el) {
          el = document.createElement('div');
          el.className = 'agnellino-alzato';
          el.dataset.chi = chi;
          el.setAttribute('role', 'button');
          el.tabIndex = 0;
          el.setAttribute('aria-label', T.scena.scelte.agnellinoAlzato(opz.nomeDi?.(chi) ?? chi));
          conTocco(el, () => ({ tipo: 'agnellino', chi }));
          ui.appendChild(el);
          controlliAgnelli.set(g, el);
        }
        // Dove sta il corpo quando è in alto (la quota piena, non quella del fotogramma)
        const k = palco.profondita(g.y);
        const c = camera.inScenaDaMondo(g.x + g.ox, g.y - (QUOTA_ALZATO + META_CORPO_AGNELLINO) * k);
        const lato = Math.max(LATO_AGNELLINO, 44 * k * camera.zoom());
        const x = Math.max(0, Math.min(W - lato, c.x - lato / 2));
        const y = Math.max(0, Math.min(H - lato, c.y - lato / 2));
        el.style.zIndex = String(z++);
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        el.style.width = `${lato}px`;
        el.style.height = `${lato}px`;
      }
    }
  }

  // ---------- Fuoco della tastiera ----------

  /**
   * I controlli della domanda, nell'ordine in cui si cerca dove rimettere il fuoco: zone, dado, carte della mano,
   * carte grandi, Guai, agnellini, pulsanti. Ognuno con una chiave che lo ritrova dopo che è stato ricreato.
   */
  function controlli(): Array<[string, HTMLElement]> {
    const lista: Array<[string, HTMLElement]> = [];
    for (const [chi, el] of zone) lista.push([`zona:${chi}`, el]);
    lista.push(['dado', zonaDado]);
    const fionda = mira.controllo();
    if (fionda) lista.push(['fionda', fionda]);
    for (const { id, el } of mano.scoperte()) lista.push([`carta:${id}`, el]);
    for (const [id, el] of grandi) lista.push([`grande:${id}`, el]);
    for (const [id, el] of controlliGuai) lista.push([`guaio:${id}`, el]);
    for (const el of controlliAgnelli.values()) lista.push([`agnellino:${el.dataset.chi ?? ''}`, el]);
    for (const [id, b] of bottoni) lista.push([`pulsante:${id}`, b]);
    // I pulsanti nell'ordine in cui stanno (prima quelli sotto la carta, poi la fila)
    const posto = (el: HTMLElement): number => {
      const i = [...sotto.children].indexOf(el);
      return i >= 0 ? i : sotto.children.length + [...fila.children].indexOf(el);
    };
    const pulsanti = lista.filter(([k]) => k.startsWith('pulsante:')).sort((a, b) => posto(a[1]) - posto(b[1]));
    return [...lista.filter(([k]) => !k.startsWith('pulsante:')), ...pulsanti];
  }

  /** Si raggiunge e risponde: nel documento, visibile, non spento, raggiungibile con Tab. */
  const abilitato = (el: HTMLElement): boolean =>
    el.isConnected &&
    !el.closest('[hidden]') &&
    !(el instanceof HTMLButtonElement && el.disabled) &&
    el.tabIndex >= 0 &&
    el.getAttribute('aria-disabled') !== 'true';

  /** La chiave del controllo della domanda che ha il fuoco adesso, se ce l'ha uno di loro. */
  function fuocoOra(): string | null {
    const a = document.activeElement;
    if (!a) return null;
    return controlli().find(([, el]) => el === a)?.[0] ?? null;
  }

  /** Dove stava il fuoco quando la domanda è stata tolta (solo se stava su un suo controllo): la prossima domanda lo riprende. */
  let fuocoDaRiprendere: string | null = null;

  /**
   * Il fuoco stava su un controllo della domanda (`chiave`): se adesso non sta da nessuna parte (o su un controllo che non
   * risponde più) torna sullo stesso controllo, se c'è ancora, altrimenti sul primo acceso. Se sta altrove non si tocca.
   */
  function riprendiFuoco(chiave: string): void {
    const a = document.activeElement as HTMLElement | null;
    const lista = controlli();
    const suUnControllo = lista.find(([, el]) => el === a);
    const perso = !a || a === document.body || !a.isConnected || (suUnControllo !== undefined && !abilitato(suUnControllo[1]));
    if (!perso) return;
    const voluto = lista.find(([k, el]) => k === chiave && abilitato(el)) ?? lista.find(([, el]) => abilitato(el));
    voluto?.[1].focus({ preventScroll: true });
  }

  function applica(): void {
    if (!corrente) return;
    const { d } = corrente;
    aggiornaZone(d);
    aggiornaDado(d);
    aggiornaPulsanti(d);
    aggiornaCarte(d);
    aggiornaGuai(d);
    aggiornaFurto(d);
    // La fionda: la stessa già mostrata si rimette solo a posto (un tiro a metà non si perde); senza fionda si scorda il tiro fatto
    if (d.fionda) mira.mostra(d.fionda, manda);
    else mira.togli(true);
    // Prima la mano (dice dove stanno le carte sollevate), poi ciò che si posiziona rispetto a lei
    comandaMano(d);
    posizionaZone();
    posizionaPulsanti();
    posizionaDado();
    // La nuvoletta del pensiero si sposta sotto la pecora mentre c'è la fionda, e torna su quando non c'è più
    posizionaPensiero();
  }

  // ---------- Nuvoletta del pensiero ----------

  /**
   * Pallini e nuvola sulla pecora in basso: la testa è in alto a destra del suo riquadro, la nuvola sta sopra l'ultimo
   * pallino. Mentre c'è la fionda (partita di prova: il consiglio della Testata resta aperto mentre si mira) la nuvola va
   * sotto la pecora, sopra la mano: lontano dal Montone, dalla sua zona di tocco e dalla scia, che sale verso i recinti.
   */
  function posizionaPensiero(): void {
    if (!pensiero) return;
    const chi = palco.inBasso();
    const posto = chi ? palco.posto(chi) : undefined;
    const conFionda = !!corrente?.d.fionda;
    const ax = posto ? posto.x + posto.w * (conFionda ? PIEDI_X : TESTA_X) : 100;
    const ay = posto ? posto.y + posto.w * (conFionda ? PIEDI_Y : 0.85 * TESTA_Y) : conFionda ? 627 : 545;
    const pallini = conFionda ? PALLINI_SOTTO : PALLINI;
    pensiero.pallini.forEach((el, i) => {
      const { dx, dy, d } = pallini[i]!;
      el.style.left = `${ax + dx - d / 2}px`;
      el.style.top = `${ay + dy - d / 2}px`;
      el.style.width = `${d}px`;
      el.style.height = `${d}px`;
    });
    const ultimo = pallini[pallini.length - 1]!;
    const { nuvola } = pensiero;
    nuvola.classList.toggle('sotto', conFionda);
    if (conFionda) {
      nuvola.style.left = `${NUVOLA_SOTTO_X}px`;
      nuvola.style.top = `${ay + ultimo.dy + ultimo.d / 2 + NUVOLA_SOTTO_PALLINI}px`;
      return;
    }
    nuvola.style.left = `${Math.max(10, Math.min(W - NUVOLA_LARGA - 10, ax - 40))}px`;
    nuvola.style.top = `${ay + ultimo.dy - ultimo.d / 2 - NUVOLA_SOPRA_PALLINI}px`;
  }

  function pulisciPensiero(): void {
    pensiero?.el.remove();
    pensiero = null;
  }

  function togliCarte(): void {
    for (const el of grandi.values()) el.remove();
    grandi.clear();
    alCentro?.el.remove();
    alCentro = null;
    for (const el of controlliGuai.values()) el.remove();
    controlliGuai.clear();
    for (const m of ctx.el.mondo.querySelectorAll('.mini.illuminata')) m.classList.remove('illuminata', 'scelta');
    for (const chi of [...alzati.keys()]) abbassa(chi);
    for (const el of controlliAgnelli.values()) el.remove();
    controlliAgnelli.clear();
  }

  const chiedi: Chiedi = {
    mostra(d, suGesto) {
      // Chi usa la tastiera non perde il fuoco: né quando la domanda torna dopo la recita, né quando il controllo che
      // aveva il fuoco sparisce o si spegne con la domanda nuova
      const fuoco = fuocoOra() ?? fuocoDaRiprendere;
      fuocoDaRiprendere = null;
      corrente = { d, suGesto };
      applica();
      if (fuoco) riprendiFuoco(fuoco);
    },
    togli() {
      const fuoco = fuocoOra();
      if (fuoco) fuocoDaRiprendere = fuoco;
      const c = corrente;
      corrente = null;
      // Una tenuta in corso non apre la lettura di una carta che non è più sul tavolo
      finePressione(true);
      for (const el of zone.values()) el.remove();
      zone.clear();
      for (const b of bottoni.values()) b.remove();
      bottoni.clear();
      sotto.hidden = true;
      fila.hidden = true;
      togliCarte();
      mira.togli();
      for (const e of ctx.el.mondo.querySelectorAll('.pecora.illuminata, .recinto.illuminata')) e.classList.remove('illuminata', 'ferma');
      dado.classList.remove('illuminata', 'ferma');
      zonaDado.hidden = true;
      zonaDado.removeAttribute('tabindex');
      // Senza la fionda la nuvoletta torna sopra la pecora
      posizionaPensiero();
      // La mano torna libera solo se la domanda l'aveva presa
      if (c || chiaveMano !== null) {
        chiaveMano = null;
        mano.comanda(null);
      }
    },
    riposiziona() {
      // Con la domanda, `applica` rimette a posto anche la fionda (mira.mostra della stessa fionda la riposiziona)
      applica();
      posizionaPensiero();
    },
    pensa(p) {
      // Lo stesso pensiero già mostrato non si ricrea (hover e fuoco restano)
      if (p && pensiero?.p === p && pensiero.el.isConnected) {
        posizionaPensiero();
        return;
      }
      pulisciPensiero();
      if (!p) return;
      const el = document.createElement('div');
      el.className = 'pensiero' + (ctx.ridotto ? ' ferma' : '');
      el.setAttribute('role', 'status');
      // Tre pallini che salgono dalla pecora, poi la nuvola (decorazione: i lettori di schermo leggono solo la nuvola)
      const pallini = PALLINI.map((_, i) => {
        const pallino = document.createElement('i');
        pallino.className = 'pallino';
        pallino.setAttribute('aria-hidden', 'true');
        pallino.style.setProperty('--i', String(i));
        el.appendChild(pallino);
        return pallino;
      });
      const nuvola = document.createElement('div');
      nuvola.className = 'nuvola';
      if (p.titolo) {
        const t = document.createElement('strong');
        t.className = 'titolo';
        t.textContent = p.titolo;
        nuvola.appendChild(t);
      }
      const testo = document.createElement('p');
      testo.className = 'testo';
      testo.textContent = p.testo;
      nuvola.appendChild(testo);
      if (p.pulsanti.length > 0) {
        const azioni = document.createElement('div');
        azioni.className = 'azioni-nuvola';
        for (const q of p.pulsanti) {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'btn' + (q.secondario ? ' secondario' : ' primario');
          b.textContent = q.testo;
          b.addEventListener('click', () => q.azione());
          azioni.appendChild(b);
        }
        nuvola.appendChild(azioni);
      }
      el.appendChild(nuvola);
      ui.appendChild(el);
      pensiero = { p, el, nuvola, pallini };
      posizionaPensiero();
    },
    visibile: () => corrente !== null,
    distruggi() {
      chiedi.togli();
      fuocoDaRiprendere = null;
      pulisciPensiero();
      scena.removeEventListener('pointerdown', suPrato);
      ctx.el.mondo.removeEventListener('pointerdown', suMini, true);
      sotto.remove();
      fila.remove();
      zonaDado.remove();
    },
  };
  return chiedi;
}
