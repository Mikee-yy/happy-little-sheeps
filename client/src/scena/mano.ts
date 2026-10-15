// La mano di chi sta in basso (bozza scena.src.html, righe 1842–1907): ventaglio di carte da toccare, tenere e trascinare.
// Con `carte` null mostra solo dorsi, che non rispondono a nessun gesto (regola anti-sbirciata).
// I gesti usano tempo vero (setTimeout della tenuta): eccezione ammessa per l'interfaccia.
// Differenze dalla bozza: niente `gioca` (il trascinamento rilasciato torna sempre nel ventaglio), niente pulsanti #rimetti/#gioca.
import { defCarta } from '../../../engine/src';
import type { IdCarta } from '../../../engine/src';
import { cartaSVG, retroSVG } from './carte/carte';
import type { Contesto } from './contesto';
import type { Lettura } from './lettura';
import { scenaInMano } from './misure';

export interface Mano {
  /** `carte`: il ventaglio scoperto; null: `dorsi` carte coperte. */
  mostra(carte: IdCarta[] | null, dorsi: number): void;
  /** La carta sollevata (al centro, ingrandita), se c'è. */
  attiva(): IdCarta | null;
  /** Rimette nel ventaglio la carta sollevata (un tocco sulla scena, bozza riga 2669). */
  abbassa(): void;
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

export const trasf = (p: Posa): string =>
  `perspective(1100px) translate(${(p.x - 125).toFixed(1)}px,${(p.y - 175).toFixed(1)}px) rotate(${(p.r || 0).toFixed(2)}deg) scale(${p.k.toFixed(3)},${(p.k * (p.sy || 1)).toFixed(3)}) rotateY(${(p.f || 0).toFixed(1)}deg)`;

export function posizioneMano(i: number, n: number): Posa {
  const mezzo = (n - 1) / 2;
  const dx = Math.min(56, 286 / Math.max(1, n - 1));
  const d = i - mezzo;
  return { x: 195 + d * dx, y: 786 + d * d * 3.4, r: d * 6.5, k: 0.37 };
}

export function creaMano(ctx: Contesto, lettura: Lettura): Mano {
  const contenitore = ctx.el.mano;
  /** Le carte scoperte, per id. */
  const elementi = new Map<IdCarta, HTMLElement>();
  let ordine: IdCarta[] = [];
  let dorsi: HTMLElement[] = [];
  let attiva: IdCarta | null = null;
  const timer = new Set<ReturnType<typeof setTimeout>>();
  /** Per ogni carta scoperta: azzera il gesto in corso (tenuta, trascinamento). */
  const azzera = new Map<IdCarta, () => void>();
  /** La carta che la lettura aperta dalla mano sta mostrando. */
  let lettaDa: IdCarta | null = null;

  const puntatore = (e: MouseEvent) => {
    const m = ctx.el.ui.getBoundingClientRect();
    return { x: (e.clientX - m.left) / ctx.S, y: (e.clientY - m.top) / ctx.S };
  };

  function disponi() {
    const n = ordine.length;
    ordine.forEach((id, i) => {
      const el = elementi.get(id);
      if (!el || el.classList.contains('trascinata')) return;
      let p = posizioneMano(i, n);
      if (attiva === id) p = { x: 195, y: 470, r: 0, k: 0.66 };
      else if (el.dataset.su === '1' && !attiva) p = { ...p, y: p.y - 26, k: 0.4 };
      el.style.transform = trasf(p);
      el.style.zIndex = String(attiva === id ? 2500 : 2000 + i);
      el.classList.toggle('attiva', attiva === id);
      el.classList.toggle('spenta', !!attiva && attiva !== id);
      const animata = attiva === id;
      if ((el.dataset.anim === '1') !== animata) {
        el.innerHTML = cartaSVG(id, animata);
        el.dataset.anim = animata ? '1' : '';
      }
    });
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
      if (!trascina && !inLettura && Math.hypot(dx, dy) > SOGLIA_TRASCINA) {
        trascina = true;
        fermaTenuta();
        el.classList.add('trascinata');
        el.style.zIndex = '2700';
        attiva = null;
        disponi();
        ctx.suona('fruscio');
      }
      // La carta sta nella mano ingrandita: il punto del dito va riportato nelle sue misure
      if (trascina) {
        const p = scenaInMano(puntatore(e), ctx.KD);
        el.style.transform = trasf({ x: p.x, y: p.y - 40, r: Math.max(-14, Math.min(14, dx / ctx.S / 12)), k: 0.44 });
      }
    });
    const fine = (annulla: boolean) => {
      fermaTenuta();
      if (!giu) return;
      giu = null;
      if (inLettura) {
        inLettura = false;
        chiudiLettura();
        return;
      }
      if (trascina) {
        // In questo pezzo non si gioca: la carta torna sempre nel ventaglio
        el.classList.remove('trascinata');
        disponi();
        return;
      }
      if (!annulla) {
        attiva = attiva === id ? null : id;
        disponi();
        ctx.suona('fruscio');
      }
    };
    el.addEventListener('pointerup', () => fine(false));
    el.addEventListener('pointercancel', () => fine(true));
    // La pressione lunga su Android aprirebbe il menu del browser
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    azzera.set(id, () => {
      fermaTenuta();
      giu = null;
      trascina = false;
      inLettura = false;
    });
  }

  function chiudiLettura() {
    lettaDa = null;
    lettura.chiudi();
  }

  /** Toglie la carta dalla mano annullando il suo gesto: una tenuta in corso non deve aprire la lettura di una carta che non c'è più. */
  function rimuoviCarta(id: IdCarta, el: HTMLElement) {
    azzera.get(id)?.();
    azzera.delete(id);
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
    mostra(carte, numeroDorsi) {
      if (carte === null) {
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
      const nuovi = new Set(carte);
      for (const [id, el] of [...elementi]) {
        if (nuovi.has(id)) continue;
        rimuoviCarta(id, el);
      }
      if (lettaDa !== null && !nuovi.has(lettaDa)) chiudiLettura();
      if (attiva !== null && !nuovi.has(attiva)) attiva = null;
      ordine = [...nuovi];
      for (const id of ordine) {
        let el = elementi.get(id);
        if (!el) {
          el = creaCarta(id);
          elementi.set(id, el);
        }
        contenitore.appendChild(el);
      }
      disponi();
    },
    attiva: () => attiva,
    abbassa() {
      if (attiva === null) return;
      attiva = null;
      disponi();
    },
    distruggi() {
      for (const t of timer) clearTimeout(t);
      timer.clear();
      lettura.chiudi();
      svuotaScoperte();
      svuotaDorsi();
      attiva = null;
    },
  };
}
