// Le carte disegnate delle Regole (regole/carte.tsx, con scena/carte/ e le loro animazioni) sono un pacchetto a parte,
// come la scena: la pagina iniziale non le scarica. Arrivano quando la schermata Regole le chiede; nel frattempo le
// figure delle carte restano vuote (con il loro testo alternativo). Se lo scaricamento fallisce, la richiesta dopo
// riprova (come `caricaScena`).
import { useEffect, useState } from 'react';

type ModuloCarte = typeof import('./carte');

let importa: () => Promise<ModuloCarte> = () => import('./carte');
let richiesta: Promise<ModuloCarte> | null = null;
/** Il modulo già arrivato: chi lo chiede dopo lo ha subito, senza un disegno vuoto in mezzo. */
let arrivato: ModuloCarte | null = null;

/** Scarica le carte (una volta sola; se fallisce, la richiesta dopo riprova). */
export function caricaCarte(): Promise<ModuloCarte> {
  richiesta ??= importa().then(
    (m) => (arrivato = m),
    (e: unknown) => {
      richiesta = null;
      throw e;
    },
  );
  return richiesta;
}

/** Le carte, o null finché non sono arrivate (e se lo scaricamento è fallito: si riprova alla prossima schermata). */
export function useCarte(): ModuloCarte | null {
  const [modulo, setModulo] = useState<ModuloCarte | null>(arrivato);
  useEffect(() => {
    if (modulo) return;
    let attivo = true;
    caricaCarte().then(
      (m) => {
        if (attivo) setModulo(m);
      },
      () => {},
    );
    return () => {
      attivo = false;
    };
  }, [modulo]);
  return modulo;
}

/** Solo per le prove: sostituisce l'import dinamico e ricomincia da capo. */
export function usaCaricatoreDiProva(f: (() => Promise<ModuloCarte>) | null): void {
  importa = f ?? (() => import('./carte'));
  richiesta = null;
  arrivato = null;
}
