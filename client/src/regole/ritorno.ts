// Il punto da cui si aprono le Regole: lo scorrimento della pagina e chi aveva il punto della tastiera. Al ritorno la
// schermata di prima è disegnata da capo, quindi chi le ha aperte è un elemento nuovo: lo si ritrova dal testo.
// Se nessun comando aveva il punto della tastiera (in Safari, per esempio, il tocco non lo dà ai pulsanti) non c'è
// nessuno da ritrovare e il punto della tastiera non si sposta.

export interface PuntoDiRitorno {
  scorrimento: number;
  /** Il testo del comando che aveva il punto della tastiera, e quale era tra quelli con lo stesso testo. */
  comando: { testo: string; indice: number } | null;
}

const COMANDI = 'button, a[href], [tabindex]:not([tabindex="-1"])';
/** Se il comando non c'è più (il menu si è chiuso aprendo le Regole), in ordine: il pulsante del menu, il "Sono io" del "Passa a". */
const RIPIEGHI = ['.pulsante-menu', '.passaggio button'];

const pagina = () => document.scrollingElement ?? document.documentElement;

/** Visibile e usabile: fuori dalle Regole, non dentro qualcosa di nascosto o inerte. */
function usabile(el: Element): el is HTMLElement {
  return el instanceof HTMLElement && !el.closest('.regole, [hidden], [inert], [aria-hidden="true"]') && !(el as HTMLButtonElement).disabled;
}

const conTesto = (testo: string): HTMLElement[] =>
  [...document.querySelectorAll(COMANDI)].filter((el): el is HTMLElement => usabile(el) && el.textContent?.trim() === testo);

export function ricordaPunto(): PuntoDiRitorno {
  const el = document.activeElement;
  let comando: PuntoDiRitorno['comando'] = null;
  if (el && el !== document.body && el.matches(COMANDI) && usabile(el)) {
    const testo = el.textContent?.trim() ?? '';
    if (testo) comando = { testo, indice: Math.max(0, conTesto(testo).indexOf(el)) };
  }
  return { scorrimento: pagina().scrollTop, comando };
}

/** Rimette lo scorrimento e, se c'era, il punto della tastiera (senza scorrere di nuovo). */
export function tornaAlPunto(p: PuntoDiRitorno): void {
  pagina().scrollTop = p.scorrimento;
  if (!p.comando) return;
  const uguali = conTesto(p.comando.testo);
  const el: HTMLElement | undefined =
    uguali[p.comando.indice] ??
    uguali[0] ??
    RIPIEGHI.map((s) => [...document.querySelectorAll(s)].find(usabile)).find((x) => x !== undefined);
  el?.focus({ preventScroll: true });
}
