// L'archivio del banco di prova: la pagina è pubblicata sullo stesso sito del gioco (/banco/), quindi divide con lui
// il localStorage del telefono. Perché le prove non cambino le preferenze del gioco vero (opzioni, consigli già visti),
// la pagina sostituisce localStorage con una vista che mette un prefisso a tutte le chiavi.
// Solo per la pagina di sviluppo: il gioco non lo importa mai.

export const PREFISSO_BANCO = 'banco:';

/** Una Storage che legge e scrive solo le chiavi con il prefisso, sopra quella vera. */
function vistaConPrefisso(vera: Storage, prefisso: string): Storage {
  const mie = (): string[] => {
    const chiavi: string[] = [];
    for (let i = 0; i < vera.length; i++) {
      const k = vera.key(i);
      if (k?.startsWith(prefisso)) chiavi.push(k.slice(prefisso.length));
    }
    return chiavi;
  };
  return {
    get length() {
      return mie().length;
    },
    key: (i: number) => mie()[i] ?? null,
    getItem: (k: string) => vera.getItem(prefisso + k),
    setItem: (k: string, v: string) => vera.setItem(prefisso + k, v),
    removeItem: (k: string) => vera.removeItem(prefisso + k),
    clear: () => {
      for (const k of mie()) vera.removeItem(prefisso + k);
    },
  };
}

/** Da qui in poi `localStorage` della pagina è quello del banco. Se il salvataggio è bloccato non fa niente. */
export function isolaArchivio(prefisso = PREFISSO_BANCO): void {
  let vera: Storage;
  try {
    vera = globalThis.localStorage;
    if (!vera) return;
  } catch {
    return;
  }
  Object.defineProperty(globalThis, 'localStorage', { value: vistaConPrefisso(vera, prefisso), configurable: true, writable: true });
}
