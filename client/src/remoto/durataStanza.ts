// La durata normale delle recite (scena/regia/durate.ts) per chi ospita una stanza: finestre, fasi automatiche e bot
// aspettano che la scena dei telefoni abbia finito di recitare la mossa (bozze/scena-gioco-4-progetto.md, § 2.3).
// Porta con sé il copione e il meteo: non sta nel pacchetto principale, si scarica a parte come la scena, entrando in una
// stanza. Se non è ancora arrivata quando nasce chi ospita, gliela si dà appena arriva; se non arriva si gioca come prima
// (senza aspettare le recite).
import type { OpzioniHost, SessioneHost } from '../../../sync/host';
import { precaricaScena } from '../partita/caricaScena';

type DurataRecita = NonNullable<OpzioniHost['durataRecita']>;

let durata: DurataRecita | null = null;
let richiesta: Promise<DurataRecita> | null = null;

/** Scarica la durata (una volta sola; se fallisce, la richiesta dopo riprova). */
export function caricaDurata(): Promise<DurataRecita> {
  richiesta ??= import('../scena/regia/durate').then(
    (m) => (durata = m.durataRecita),
    (e: unknown) => {
      richiesta = null;
      throw e;
    },
  );
  return richiesta;
}

/** Entrando, creando o rientrando in una stanza: comincia a scaricare la scena e la durata delle recite. */
export function precaricaStanza(): void {
  precaricaScena();
  caricaDurata().catch(() => {});
}

/**
 * Crea o riprende chi ospita con la durata delle recite: nelle opzioni se è già arrivata, altrimenti appena arriva
 * (`impostaDurataRecita`, che vale dalle mosse nuove).
 */
export async function ospita<S extends SessioneHost | null>(crea: (opzioni: OpzioniHost) => Promise<S>): Promise<S> {
  const opzioni: OpzioniHost = durata ? { durataRecita: durata } : {};
  const s = await crea(opzioni);
  if (s && !opzioni.durataRecita) {
    caricaDurata().then(
      (f) => s.impostaDurataRecita(f),
      () => {},
    );
  }
  return s;
}
