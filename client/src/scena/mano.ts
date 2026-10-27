// La mano di chi sta in basso (bozza scena.src.html, righe 1842–1907): ventaglio di carte da toccare, tenere e trascinare.
// Con `carte` null mostra solo dorsi, che non rispondono a nessun gesto (regola anti-sbirciata).
// I gesti usano tempo vero (setTimeout della tenuta): eccezione ammessa per l'interfaccia.
// Due modi: libero (il tocco solleva da solo, il trascinamento torna sempre nel ventaglio) e comandato da una domanda
// (`comanda`): il tocco va a chi comanda, le carte sollevate le dice lui, il trascinamento rilasciato sopra la tovaglia gioca.
// Differenze dalla bozza: niente pulsanti #rimetti/#gioca (stanno nel teatro).
import { defCarta } from '../../../engine/src';
import type { IdCarta } from '../../../engine/src';
import { cartaSVG, retroSVG } from './carte/carte';
import type { Contesto } from './contesto';
import type { Lettura } from './lettura';
import { manoInScena, scenaInMano } from './misure';

/** Chi comanda la mano: una domanda del gioco. */
export interface ComandoMano {
  /** Le carte che rispondono al tocco: le altre sono spente (si leggono ancora tenendole premute). */
  toccabili: IdCarta[];
  /** Le carte sollevate adesso, nell'ordine in cui stanno da sinistra a destra. */
  sollevate: IdCarta[];
  /** Le carte che si possono trascinare sulla tovaglia per giocarle. */
  trascinabili: IdCarta[];
  suTocco(id: IdCarta): void;
  suTrascinata(id: IdCarta): void;
}

export interface OpzioniMano {
  /** Una carta è stata giocata trascinandola (chiamata subito prima di `suTrascinata`): serve al terzo consiglio. */
  allaGiocataTrascinando?: () => void;
}

export interface Mano {
  /**
   * `carte`: il ventaglio scoperto; null: `dorsi` carte coperte. Le carte che entrano in un ventaglio già scoperto (pescate)
   * fanno il loro movimento una volta sola; con `ferme` (ricostruzione del tavolo) entrano ferme, come la prima mano
   * mostrata e quella appena scoperta.
   */
  mostra(carte: IdCarta[] | null, dorsi: number, opz?: { ferme?: boolean }): void;
  /** La carta sollevata (al centro, ingrandita), se c'è. */
  attiva(): IdCarta | null;
  /** Rimette nel ventaglio la carta sollevata (un tocco sulla scena, bozza riga 2669). In modo comandato non fa niente: le carte sollevate le dice chi comanda. */
  abbassa(): void;
  /** Con una domanda la mano non decide da sola: i tocchi vanno a `suTocco`, le carte sollevate le dice chi comanda. null: modo libero di oggi. Annulla un trascinamento in corso.
   * Va passato un oggetto nuovo a ogni cambio (non modificare in place quello già dato): `toccabili` e `trascinabili` si
   * copiano in insiemi solo qui, mentre `sollevate` si rilegge dall'oggetto a ogni ridisegno. */
  comanda(c: ComandoMano | null): void;
  /** Dove stanno le carte sollevate (coordinate della scena, il centro del gruppo): per il pulsante "Gioca". null se nessuna. */
  sollevateIn(): { x: number; y: number } | null;
  /** Le carte scoperte, nell'ordine del ventaglio, con il loro elemento: per riportare il fuoco della tastiera. */
  scoperte(): Array<{ id: IdCarta; el: HTMLElement }>;
  distruggi(): void;
}

interface Posa {
  x: number;
  y: number;
  r?: number;
  k: number;
  sy?: number;
  f?: number;
}

const TENUTA_MS = 430;
const SOGLIA_TRASCINA = 9;
/**
 * Il movimento della carta appena pescata finisce da solo (un giro per parte, classe `una-volta` in carte/animazioni.css);
 * se il browser non lo dice (o la carta resta sollevata) si chiude comunque dopo questo tempo: il giro più lungo
 * (la ruota lenta, 14 s) con un poco di margine.
 */
export const UNA_VOLTA_MAX_MS = 15000;
/** Rilasciata con il dito sopra questa linea della scena (y minore) la carta è giocata (bozza, riga 1888). */
const LINEA_GIOCO = 640;

/** Dove sta la carta `i`-esima di `n` carte sollevate (coordinate della mano). */
export function posaSollevata(i: number, n: number): Posa {
  if (n <= 1) return { x: 195, y: 470, r: 0, k: 0.66 };
  if (n === 2) return { x: 195 + (i - 0.5) * 124, y: 480, r: 0, k: 0.5 };
  const passo = Math.min(110, 220 / (n - 1));
  return { x: 195 + (i - (n - 1) / 2) * passo, y: 490, r: 0, k: 0.42 };
}

export const trasf = (p: Posa): string =>
  `perspective(1100px) translate(${(p.x - 125).toFixed(1)}px,${(p.y - 175).toFixed(1)}px) rotate(${(p.r || 0).toFixed(2)}deg) scale(${p.k.toFixed(3)},${(p.k * (p.sy || 1)).toFixed(3)}) rotateY(${(p.f || 0).toFixed(1)}deg)`;

export function posizioneMano(i: number, n: number): Posa {
  const mezzo = (n - 1) / 2;
  const dx = Math.min(56, 286 / Math.max(1, n - 1));
  const d = i - mezzo;
  return { x: 195 + d * dx, y: 786 + d * d * 3.4, r: d * 6.5, k: 0.37 };
}

export function creaMano(ctx: Contesto, lettura: Lettura, opzioni: OpzioniMano = {}): Mano {
  const contenitore = ctx.el.mano;
  /** Le carte scoperte, per id. */
  const elementi = new Map<IdCarta, HTMLElement>();
  let ordine: IdCarta[] = [];
  let dorsi: HTMLElement[] = [];
  let attiva: IdCarta | null = null;
  /** Chi comanda la mano, se qualcuno: gli insiemi servono a rispondere in fretta ai gesti. */
  let com: { c: ComandoMano; toccabili: Set<IdCarta>; trascinabili: Set<IdCarta> } | null = null;
  const timer = new Set<ReturnType<typeof setTimeout>>();
  /** Per ogni carta scoperta: azzera il gesto in corso (tenuta, trascinamento). */
  const azzera = new Map<IdCarta, () => void>();
  /** Per ogni carta scoperta: annulla il trascinamento in corso (la carta torna nel ventaglio, senza giocare). */
  const annullaTrascinamento = new Map<IdCarta, () => void>();
  /** La carta che la lettura aperta dalla mano sta mostrando. */
  let lettaDa: IdCarta | null = null;
  /** Il ventaglio è già scoperto: le carte che arrivano adesso sono pescate (non la prima mano, non la mano appena scoperta). */
  let scoperta = false;
  /** Le carte appena pescate che stanno facendo il loro movimento una volta: per ognuna, come chiuderlo in anticipo. */
  const unaVolta = new Map<IdCarta, () => void>();

  const puntatore = (e: MouseEvent) => {
    const m = ctx.el.ui.getBoundingClientRect();
    return { x: (e.clientX - m.left) / ctx.S, y: (e.clientY - m.top) / ctx.S };
  };

  /** Le carte sollevate che in questa mano ci sono davvero (in modo comandato, nell'ordine di chi comanda). */
  const sollevateOra = (): IdCarta[] => (com ? com.c.sollevate.filter((id) => elementi.has(id)) : []);

  function disponi() {
    const n = ordine.length;
    const sollevate = sollevateOra();
    ordine.forEach((id, i) => {
      const el = elementi.get(id);
      if (!el) return;
      const posto = sollevate.indexOf(id);
      const alzata = com ? posto >= 0 : attiva === id;
      const spenta = com ? posto < 0 && !com.toccabili.has(id) : !!attiva && attiva !== id;
      perTastiera(el, alzata, id);
      if (el.classList.contains('trascinata')) return;
      let p = posizioneMano(i, n);
      if (com) {
        if (posto >= 0) p = posaSollevata(posto, sollevate.length);
        else if (el.dataset.su === '1' && sollevate.length === 0 && com.toccabili.has(id)) p = { ...p, y: p.y - 26, k: 0.4 };
      } else if (attiva === id) p = { x: 195, y: 470, r: 0, k: 0.66 };
      else if (el.dataset.su === '1' && !attiva) p = { ...p, y: p.y - 26, k: 0.4 };
      el.style.transform = trasf(p);
      el.style.zIndex = String(alzata ? 2500 + Math.max(0, posto) : 2000 + i);
      el.classList.toggle('attiva', alzata);
      el.classList.toggle('spenta', spenta);
      // Sollevata si muove senza fine; appena pescata fa un giro solo (`una-volta`), poi torna ferma
      const animata = alzata || unaVolta.has(id);
      el.classList.toggle('una-volta', unaVolta.has(id) && !alzata);
      if ((el.dataset.anim === '1') !== animata) {
        el.innerHTML = cartaSVG(id, animata);
        el.dataset.anim = animata ? '1' : '';
      }
    });
  }

  /**
   * Con una domanda le carte che rispondono (toccabili) si raggiungono con Tab e dicono se sono sollevate; le altre no,
   * nemmeno se sono sollevate: non rispondono a nessun tocco. Nel modo libero niente tastiera, come prima della domanda.
   */
  function perTastiera(el: HTMLElement, alzata: boolean, id: IdCarta) {
    if (!com) {
      el.removeAttribute('tabindex');
      el.removeAttribute('aria-disabled');
      el.removeAttribute('aria-pressed');
      return;
    }
    const risponde = com.toccabili.has(id);
    el.tabIndex = risponde ? 0 : -1;
    if (!risponde) el.setAttribute('aria-disabled', 'true');
    else el.removeAttribute('aria-disabled');
    el.setAttribute('aria-pressed', alzata ? 'true' : 'false');
  }

  function creaCarta(id: IdCarta): HTMLElement {
    const el = document.createElement('div');
    el.className = 'cm';
    el.innerHTML = cartaSVG(id);
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', defCarta(id).nome);
    collega(el, id);
    return el;
  }

  function collega(el: HTMLElement, id: IdCarta) {
    let giu: { x: number; y: number } | null = null;
    let tenuta: ReturnType<typeof setTimeout> | null = null;
    let trascina = false;
    /** Il dito si è mosso su una carta che non si può trascinare: non è più un tocco e non è un trascinamento. */
    let mosso = false;
    let inLettura = false;
    const fermaTenuta = () => {
      if (tenuta !== null) {
        clearTimeout(tenuta);
        timer.delete(tenuta);
        tenuta = null;
      }
    };
    el.addEventListener('pointerenter', (e) => {
      if ((e as PointerEvent).pointerType === 'mouse') {
        el.dataset.su = '1';
        disponi();
      }
    });
    el.addEventListener('pointerleave', (e) => {
      if ((e as PointerEvent).pointerType === 'mouse') {
        el.dataset.su = '';
        disponi();
      }
    });
    el.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      try {
        el.setPointerCapture?.((e as PointerEvent).pointerId);
      } catch {
        /* puntatore già rilasciato */
      }
      giu = { x: e.clientX, y: e.clientY };
      trascina = false;
      mosso = false;
      inLettura = false;
      fermaTenuta();
      tenuta = setTimeout(() => {
        timer.delete(tenuta!);
        tenuta = null;
        inLettura = true;
        lettaDa = id;
        lettura.apri(id, true);
      }, TENUTA_MS);
      timer.add(tenuta);
    });
    el.addEventListener('pointermove', (e) => {
      if (!giu) return;
      const dx = e.clientX - giu.x;
      const dy = e.clientY - giu.y;
      if (!trascina && !mosso && !inLettura && Math.hypot(dx, dy) > SOGLIA_TRASCINA) {
        fermaTenuta();
        if (com && !com.trascinabili.has(id)) {
          mosso = true;
          return;
        }
        trascina = true;
        el.classList.add('trascinata');
        el.style.zIndex = '2700';
        // In modo comandato le carte sollevate le decide chi comanda
        if (!com) attiva = null;
        disponi();
        ctx.suona('fruscio');
      }
      // La carta sta nella mano ingrandita: il punto del dito va riportato nelle sue misure
      if (trascina) {
        const p = scenaInMano(puntatore(e), ctx.KD);
        el.style.transform = trasf({ x: p.x, y: p.y - 40, r: Math.max(-14, Math.min(14, dx / ctx.S / 12)), k: 0.44 });
      }
    });
    const fine = (e: MouseEvent, annulla: boolean) => {
      fermaTenuta();
      if (!giu) return;
      giu = null;
      if (inLettura) {
        inLettura = false;
        chiudiLettura();
        return;
      }
      if (mosso) {
        mosso = false;
        return;
      }
      if (trascina) {
        trascina = false;
        el.classList.remove('trascinata');
        // Il punto del dito resta nelle coordinate della scena (non si riporta nella mano, come fa la carta che lo segue):
        // la linea 640 sta sulla scena, come nella bozza
        const comando = com;
        const gioca = !annulla && comando !== null && comando.trascinabili.has(id) && puntatore(e).y < LINEA_GIOCO;
        disponi();
        if (gioca) {
          opzioni.allaGiocataTrascinando?.();
          comando.c.suTrascinata(id);
        }
        return;
      }
      if (annulla) return;
      if (com) {
        // Il tocco non solleva da solo: lo decide chi comanda
        if (com.toccabili.has(id)) {
          ctx.suona('fruscio');
          com.c.suTocco(id);
        }
        return;
      }
      attiva = attiva === id ? null : id;
      disponi();
      ctx.suona('fruscio');
    };
    /** Tasti e clic senza puntatore (lettore di schermo): un tocco intero, solo con una domanda e su una carta che risponde. */
    const toccoSenzaDito = () => {
      if (!com || !com.toccabili.has(id)) return;
      ctx.suona('fruscio');
      com.c.suTocco(id);
    };
    el.addEventListener('keydown', (e) => {
      if (!com || (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar')) return;
      e.preventDefault();
      // Tenuto premuto il tasto si ripete: un solo tocco
      if (e.repeat) return;
      toccoSenzaDito();
    });
    // Il clic vero (dito, mouse) passa dal puntatore: quello senza puntatore ha detail 0
    el.addEventListener('click', (e) => {
      if (e.detail === 0) toccoSenzaDito();
    });
    el.addEventListener('pointerup', (e) => fine(e, false));
    el.addEventListener('pointercancel', (e) => fine(e, true));
    // La pressione lunga su Android aprirebbe il menu del browser
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    azzera.set(id, () => {
      fermaTenuta();
      giu = null;
      trascina = false;
      mosso = false;
      inLettura = false;
    });
    annullaTrascinamento.set(id, () => {
      if (!trascina) return;
      fermaTenuta();
      giu = null;
      trascina = false;
      el.classList.remove('trascinata');
    });
  }

  /**
   * La carta appena pescata fa il suo movimento una volta. Finisce quando nessuna parte animata gira più (a ogni
   * `animationend` si chiede al browser), o al più tardi dopo UNA_VOLTA_MAX_MS; poi il disegno torna quello fermo.
   */
  function avviaUnaVolta(id: IdCarta, el: HTMLElement) {
    let t: ReturnType<typeof setTimeout> | null = null;
    const chiudi = () => {
      if (t !== null) {
        clearTimeout(t);
        timer.delete(t);
        t = null;
      }
      el.removeEventListener('animationend', suFine);
      unaVolta.delete(id);
    };
    const finisci = () => {
      chiudi();
      disponi();
    };
    const suFine = () => {
      // Le parti della carta (classe "an") che girano ancora; senza getAnimations decide il tempo massimo
      if (typeof el.getAnimations !== 'function') return;
      const ancora = el.getAnimations({ subtree: true }).some((a) => {
        const bersaglio = (a.effect as KeyframeEffect | null)?.target;
        return a.playState !== 'finished' && !!bersaglio?.classList.contains('an');
      });
      if (!ancora) finisci();
    };
    el.addEventListener('animationend', suFine);
    t = setTimeout(finisci, UNA_VOLTA_MAX_MS);
    timer.add(t);
    unaVolta.set(id, chiudi);
  }

  function chiudiLettura() {
    lettaDa = null;
    lettura.chiudi();
  }

  /** Toglie la carta dalla mano annullando il suo gesto: una tenuta in corso non deve aprire la lettura di una carta che non c'è più. */
  function rimuoviCarta(id: IdCarta, el: HTMLElement) {
    azzera.get(id)?.();
    azzera.delete(id);
    annullaTrascinamento.delete(id);
    unaVolta.get(id)?.();
    el.remove();
    elementi.delete(id);
    if (attiva === id) attiva = null;
    if (lettaDa === id) chiudiLettura();
  }

  function svuotaScoperte() {
    for (const [id, el] of [...elementi]) rimuoviCarta(id, el);
    ordine = [];
  }

  function svuotaDorsi() {
    for (const el of dorsi) el.remove();
    dorsi = [];
  }

  return {
    mostra(carte, numeroDorsi, opz = {}) {
      if (carte === null) {
        scoperta = false;
        svuotaScoperte();
        attiva = null;
        lettura.chiudi();
        svuotaDorsi();
        const n = numeroDorsi;
        for (let i = 0; i < n; i++) {
          const el = document.createElement('div');
          el.className = 'cm dorso';
          el.setAttribute('aria-hidden', 'true');
          el.innerHTML = retroSVG(false);
          el.style.transform = trasf(posizioneMano(i, n));
          el.style.zIndex = String(2000 + i);
          contenitore.appendChild(el);
          dorsi.push(el);
        }
        return;
      }
      svuotaDorsi();
      // Pescate: entrano in un ventaglio già scoperto, con la scheda in vista (le carte arrivate mentre si guardava
      // un'altra scheda restano ferme) e senza movimento ridotto
      const pescate = scoperta && !opz.ferme && !ctx.ridotto && document.visibilityState !== 'hidden';
      scoperta = true;
      const nuovi = new Set(carte);
      for (const [id, el] of [...elementi]) {
        if (nuovi.has(id)) continue;
        rimuoviCarta(id, el);
      }
      if (lettaDa !== null && !nuovi.has(lettaDa)) chiudiLettura();
      if (attiva !== null && !nuovi.has(attiva)) attiva = null;
      ordine = [...nuovi];
      // Le carte si mettono in fila nel DOM (l'ordine di Tab) spostando solo quelle fuori posto: spostare la carta che ha il
      // fuoco glielo toglierebbe. Ciò che non è una carta della mano (le copie che si dissolvono) si salta.
      const mie = new Set<Node>(elementi.values());
      const salta = (n: ChildNode | null): ChildNode | null => {
        while (n && !mie.has(n)) n = n.nextSibling;
        return n;
      };
      let prima = salta(contenitore.firstChild);
      for (const id of ordine) {
        let el = elementi.get(id);
        if (!el) {
          el = creaCarta(id);
          elementi.set(id, el);
          mie.add(el);
          if (pescate) avviaUnaVolta(id, el);
        }
        if (el !== prima) contenitore.insertBefore(el, prima);
        prima = salta(el.nextSibling);
      }
      disponi();
    },
    attiva: () => (com ? (sollevateOra()[0] ?? null) : attiva),
    abbassa() {
      if (com || attiva === null) return;
      attiva = null;
      disponi();
    },
    comanda(c) {
      // Un trascinamento in corso non sopravvive a una domanda nuova (né al ritorno al modo libero)
      for (const annulla of annullaTrascinamento.values()) annulla();
      if (c === null) com = null;
      else {
        attiva = null;
        com = { c, toccabili: new Set(c.toccabili), trascinabili: new Set(c.trascinabili) };
      }
      disponi();
    },
    sollevateIn() {
      const sollevate = sollevateOra();
      if (sollevate.length === 0) return null;
      const { y, k } = posaSollevata(0, sollevate.length);
      const p = manoInScena({ x: 195, y, k }, ctx.KD);
      return { x: p.x, y: p.y };
    },
    scoperte: () => ordine.flatMap((id) => {
      const el = elementi.get(id);
      return el ? [{ id, el }] : [];
    }),
    distruggi() {
      for (const t of timer) clearTimeout(t);
      timer.clear();
      lettura.chiudi();
      svuotaScoperte();
      svuotaDorsi();
      attiva = null;
      com = null;
      scoperta = false;
    },
  };
}
