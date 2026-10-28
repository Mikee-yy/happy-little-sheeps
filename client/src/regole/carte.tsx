// Le carte vere nella schermata Regole: lo stesso disegno della partita (`cartaSVG` di scena/carte/), con le stesse
// animazioni della carta in primo piano, ferme con "Riduci movimento". Questo modulo porta con sé i disegni delle carte
// e il loro stile: la pagina iniziale non lo importa mai direttamente, arriva con `caricaCarte` (caricaCarte.ts).
import { useSyncExternalStore } from 'react';
import type { IdTipoCarta } from '../../../engine/src';
import { cartaSVG } from '../scena/carte/carte';
import { piattaforma } from '../scena/piattaforma';
import '../scena/carte/animazioni.css';
import { testoAlternativo } from './alternativi';

/** "Riduci movimento" del sistema, seguito dal vivo: cambiato con le Regole aperte, le carte si ridisegnano ferme o animate. */
const ascoltaRidotto = (avvisa: () => void): (() => void) => piattaforma.seguiMovimentoRidotto(avvisa);
const movimentoRidotto = (): boolean => piattaforma.movimentoRidotto();

/** Una carta disegnata, con il suo testo alternativo (nome, valore o tipo, testo della carta). */
export function CartaRegole({ id }: { id: IdTipoCarta }) {
  const ridotto = useSyncExternalStore(ascoltaRidotto, movimentoRidotto, movimentoRidotto);
  return (
    <span
      className="figura-carta"
      role="img"
      aria-label={testoAlternativo({ tipo: 'carta', id })}
      // Il disegno viene dal catalogo (nomi e testi delle carte, già protetti in cartaSVG), mai dai nomi dei giocatori
      dangerouslySetInnerHTML={{ __html: cartaSVG(id, !ridotto) }}
    />
  );
}
