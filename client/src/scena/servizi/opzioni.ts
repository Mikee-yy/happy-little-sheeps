// Opzioni del telefono (bozza scena.src.html, righe 409–421 e 2582–2606).
// Una sola per pagina: è una preferenza del telefono, salvata su questo dispositivo.
// Se il salvataggio non funziona (navigazione privata) valgono quelle predefinite.
export interface Opzioni {
  suoni: boolean;
  vibrazione: boolean;
  veloci: boolean;
}

const CHIAVE_OPZIONI = 'hls-opzioni';
const PREDEFINITE: Opzioni = { suoni: false, vibrazione: true, veloci: false };

/** Legge dal salvataggio; se è bloccato o rotto, le predefinite. */
export function leggiOpzioni(): Opzioni {
  try {
    const s = JSON.parse(localStorage.getItem(CHIAVE_OPZIONI) || 'null') as Partial<Opzioni> | null;
    if (s && typeof s === 'object') return { suoni: s.suoni === true, vibrazione: s.vibrazione !== false, veloci: s.veloci === true };
  } catch {
    /* salvataggio bloccato o rotto */
  }
  return { ...PREDEFINITE };
}

let correnti: Opzioni | null = null;
const ascoltatori = new Set<() => void>();

/** Le opzioni in uso (lette al primo bisogno). */
export function opzioni(): Opzioni {
  if (!correnti) correnti = leggiOpzioni();
  return correnti;
}

function salva(): void {
  try {
    localStorage.setItem(CHIAVE_OPZIONI, JSON.stringify(opzioni()));
  } catch {
    /* non si salva */
  }
}

/** Inverte un'opzione, la salva e avvisa gli ascoltatori (l'audio segue l'interruttore dei suoni tramite il contesto). */
export function cambiaOpzione(k: keyof Opzioni): void {
  const o = opzioni();
  o[k] = !o[k];
  salva();
  for (const cb of [...ascoltatori]) cb();
}

/** Restituisce la funzione che toglie l'ascoltatore. */
export function ascoltaOpzioni(cb: () => void): () => void {
  ascoltatori.add(cb);
  return () => {
    ascoltatori.delete(cb);
  };
}

/**
 * I suoni salvati come accesi partono al primo gesto: i browser non li fanno partire da soli, e col dito
 * conta come gesto il rilascio (pointerup, touchend, click), non la pressione. Si riprova finché l'audio non va.
 * Restituisce la pulizia (il teatro la mette in ctx.pulizie).
 */
/** Ciò che serve all'audio per sbloccarsi: `Suono` di suoni.ts. */
export interface AudioSbloccabile {
  accendi(): void;
  readonly ctx: { state: string } | null;
}

export function preparaSbloccoAudio(audio: AudioSbloccabile): () => void {
  const tipi = ['pointerup', 'touchend', 'click'] as const;
  const toglia = () => tipi.forEach((t) => window.removeEventListener(t, prova, true));
  function prova(): void {
    if (!opzioni().suoni) return;
    audio.accendi();
    if (audio.ctx && audio.ctx.state === 'running') toglia();
  }
  tipi.forEach((t) => window.addEventListener(t, prova, true));
  return toglia;
}
