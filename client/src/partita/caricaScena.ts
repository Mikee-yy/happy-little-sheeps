// La scena 2,5D (scena/Scena.tsx con il teatro, i disegni e il suo stile) è un pacchetto a parte: la schermata iniziale
// non la scarica. Si comincia a scaricarla quando si apre una partita ("Gioca su questo dispositivo", "Partita di prova",
// "Riprendi"), così di solito è già arrivata quando la partita parte.
// Se lo scaricamento fallisce (rete assente, o pacchetto con un nome vecchio dopo un nuovo rilascio) React.lazy terrebbe
// l'errore per sempre: per riprovare si ricrea il componente pigro (`riprovaScena`).
import { lazy } from 'react';

type ModuloScena = typeof import('../scena/Scena');

let importa: () => Promise<ModuloScena> = () => import('../scena/Scena');
let richiesta: Promise<ModuloScena> | null = null;

/** Scarica la scena (una volta sola; se fallisce, la richiesta dopo riprova). */
export function caricaScena(): Promise<ModuloScena> {
  richiesta ??= importa().catch((e: unknown) => {
    richiesta = null;
    throw e;
  });
  return richiesta;
}

/** Comincia a scaricare la scena senza aspettarla. */
export function precaricaScena(): void {
  caricaScena().catch(() => {});
}

/** La scena è già stata chiesta (per le prove). */
export function scenaRichiesta(): boolean {
  return richiesta !== null;
}

const creaPigra = () => lazy(() => caricaScena().then((m) => ({ default: m.Scena })));
let pigra = creaPigra();

/** Il componente della scena, caricato a parte: va dentro un <Suspense> (e un confine d'errore). */
export function scenaPigra(): ReturnType<typeof creaPigra> {
  return pigra;
}

/** Dopo un caricamento fallito: un componente pigro nuovo, che al prossimo disegno riprova a scaricare. */
export function riprovaScena(): void {
  richiesta = null;
  pigra = creaPigra();
}

/** Solo per le prove: sostituisce l'import dinamico e ricomincia da capo. */
export function usaCaricatoreDiProva(f: (() => Promise<ModuloScena>) | null): void {
  importa = f ?? (() => import('../scena/Scena'));
  riprovaScena();
}
