// Le API del browser che la scena usa passano tutte da qui, con un ripiego quando mancano (jsdom, prove).
// Si legge da globalThis a ogni chiamata, così le prove possono sostituire navigator.vibrate o matchMedia.

type Globale = Record<string, any>;
const g = (): Globale => globalThis as unknown as Globale;

/** Animazione finta per ambienti senza Web Animations: già finita, con le stesse proprietà utili. */
function animazioneFinta(): Animation {
  const finita = Promise.resolve();
  const a = {
    playbackRate: 1,
    currentTime: 0,
    playState: 'finished',
    finished: finita,
    ready: finita,
    onfinish: null,
    oncancel: null,
    cancel() {},
    finish() {},
    play() {},
    pause() {},
    reverse() {},
    commitStyles() {},
    updatePlaybackRate(v: number) {
      a.playbackRate = v;
    },
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return true;
    },
  };
  return a as unknown as Animation;
}

/** jsdom non disegna: chiamare getContext stamperebbe "Not implemented" su stderr, quindi si salta. */
const inJsdom = (): boolean => /jsdom/i.test(String(g().navigator?.userAgent ?? ''));

let contestoMisura:CanvasRenderingContext2D | null | undefined;

export const piattaforma = {
  /** `el.animate` se esiste; senza Web Animations un oggetto con `finished` già risolto. */
  anima(el: Element, fotogrammi: Keyframe[], opzioni: KeyframeAnimationOptions): Animation {
    const e = el as Element & { animate?: Element['animate'] };
    if (typeof e.animate === 'function') return e.animate(fotogrammi, opzioni);
    return animazioneFinta();
  },

  /** Annulla le animazioni dell'elemento e di tutto ciò che contiene (senza Web Animations non fa niente). */
  fermaAnimazioni(radice: Element): void {
    const e = radice as Element & { getAnimations?: (o?: { subtree?: boolean }) => Animation[] };
    if (typeof e.getAnimations !== 'function') return;
    try {
      for (const a of e.getAnimations({ subtree: true })) a.cancel();
    } catch {
      /* ignorato */
    }
  },

  contesto2d(c: HTMLCanvasElement): CanvasRenderingContext2D | null {
    if (inJsdom()) return null;
    try {
      return c.getContext('2d');
    } catch {
      return null;
    }
  },

  /** Matrice di trasformazione dell'elemento, o null se non si può calcolare. */
  matriceDi(el: Element): DOMMatrixReadOnly | null {
    const Matrice = g().DOMMatrix as (new (t?: string) => DOMMatrixReadOnly) | undefined;
    const stile = g().getComputedStyle as ((e: Element) => CSSStyleDeclaration) | undefined;
    if (!Matrice || !stile) return null;
    try {
      const t = stile(el).transform;
      return new Matrice(t && t !== 'none' ? t : undefined);
    } catch {
      return null;
    }
  },

  movimentoRidotto(): boolean {
    const m = g().matchMedia as ((q: string) => MediaQueryList) | undefined;
    if (typeof m !== 'function') return false;
    try {
      return !!m('(prefers-reduced-motion: reduce)')?.matches;
    } catch {
      return false;
    }
  },

  puoVibrare(): boolean {
    return typeof g().navigator?.vibrate === 'function';
  },

  vibra(ritmo: number[]): void {
    const n = g().navigator;
    if (typeof n?.vibrate !== 'function') return;
    try {
      n.vibrate(ritmo);
    } catch {
      /* ignorato */
    }
  },

  /** Il browser dice di essere senza rete (`navigator.onLine === false`); se non lo sa, si suppone la rete presente. */
  online(): boolean {
    return g().navigator?.onLine !== false;
  },

  /** Ricarica la pagina (dopo un nuovo rilascio del sito); la partita su un dispositivo è già salvata nel browser. */
  ricarica(): void {
    try {
      g().location?.reload?.();
    } catch {
      /* ignorato */
    }
  },

  /** Nuovo contesto audio, o null se il browser non lo offre. */
  audio(): AudioContext | null {
    const C = (g().AudioContext ?? g().webkitAudioContext) as (new () => AudioContext) | undefined;
    if (!C) return null;
    try {
      return new C();
    } catch {
      return null;
    }
  },

  /** Aspetta i caratteri del sito, ma al più `ms` (poi prosegue comunque). */
  caratteriPronti(ms: number): Promise<void> {
    const f = g().document?.fonts as FontFaceSet | undefined;
    if (!f?.ready) return Promise.resolve();
    return Promise.race([f.ready.then(() => undefined, () => undefined), new Promise<void>((r) => setTimeout(r, ms))]);
  },

  /** Larghezza del testo con quel font (es. "700 16px sans-serif"); senza canvas: 0,55 × dimensione × caratteri. */
  larghezzaTesto(testo: string, font: string): number {
    if (contestoMisura === undefined && !inJsdom()) {
      try {
        contestoMisura = g().document?.createElement('canvas')?.getContext('2d') ?? null;
      } catch {
        contestoMisura = null;
      }
    }
    if (contestoMisura) {
      try {
        contestoMisura.font = font;
        const w = contestoMisura.measureText(testo).width;
        if (Number.isFinite(w) && w > 0) return w;
      } catch {
        /* si usa la stima */
      }
    }
    const dimensione = Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? 16);
    return 0.55 * dimensione * testo.length;
  },

  /** Chiama `cb` quando `el` cambia misura (anche quando torna visibile); restituisce chi smette di osservare. Senza ResizeObserver non fa niente. */
  osservaMisura(el: Element, cb: () => void): () => void {
    const RO = g().ResizeObserver as typeof ResizeObserver | undefined;
    if (typeof RO !== 'function') return () => {};
    const o = new RO(() => cb());
    o.observe(el);
    return () => o.disconnect();
  },
};
