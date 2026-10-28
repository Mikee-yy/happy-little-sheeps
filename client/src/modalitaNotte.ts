// Samsung Internet con la modalità notte ricolora le pagine anche se dichiarano "only light" (modalitaChiara.test.ts):
// nessuna dichiarazione della pagina lo impedisce e nessuna interfaccia del browser dice se lo sta facendo (i colori letti
// con getComputedStyle restano quelli originali: il filtro agisce al momento di disegnare). Ci si accontenta di un indizio:
// il browser è Samsung Internet e il telefono chiede i colori scuri. Nel dubbio la risposta è "no".

/** La chiave del localStorage: c'è quando il giocatore ha chiuso l'avviso. */
export const CHIAVE_AVVISO_NOTTE = 'hls-avviso-notte-chiuso';

type Media = (q: string) => { matches?: unknown };

/** Samsung Internet si presenta con "SamsungBrowser/<versione>" (in "versione desktop" no: allora non lo si riconosce). */
const SAMSUNG = /(?:^|[\s;(])SamsungBrowser\/\d/;

/** Il browser è Samsung Internet e il telefono chiede i colori scuri (prefers-color-scheme: dark). */
export function samsungInModalitaNotte(userAgent: string | undefined, matchMedia: Media | undefined): boolean {
  if (!userAgent || !SAMSUNG.test(userAgent) || typeof matchMedia !== 'function') return false;
  try {
    return matchMedia('(prefers-color-scheme: dark)').matches === true;
  } catch {
    return false;
  }
}

/** L'avviso va mostrato: Samsung Internet probabilmente in modalità notte, e l'avviso mai chiuso prima. */
export function avvisoNotteDaMostrare(): boolean {
  const g = globalThis as { navigator?: { userAgent?: string }; matchMedia?: Media };
  if (!samsungInModalitaNotte(g.navigator?.userAgent, g.matchMedia?.bind(globalThis))) return false;
  try {
    return globalThis.localStorage.getItem(CHIAVE_AVVISO_NOTTE) === null;
  } catch {
    // Memoria illeggibile: non si saprebbe se era già stato chiuso, e mostrarlo a ogni apertura darebbe fastidio
    return false;
  }
}

/** Il giocatore ha chiuso l'avviso: non torna più. */
export function chiudiAvvisoNotte(): void {
  try {
    globalThis.localStorage.setItem(CHIAVE_AVVISO_NOTTE, '1');
  } catch {
    // Memoria piena o bloccata: per questa volta sparisce lo stesso
  }
}
