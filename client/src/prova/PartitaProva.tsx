// Partita di prova: tu contro Bea e Leo, con la guida che spiega ogni momento la prima volta che capita.
// I consigli e il riquadro finale sono il pensiero della propria pecora (la nuvoletta nella scena).
import { useEffect, useRef, useState } from 'react';
import { SessioneProva } from '../../../sync/prova';
import { Partita, useAggiornamenti } from '../partita/Partita';
import type { Pensiero } from '../scena/scelte/tipi';
import { T, nomiPerEsempi } from '../testi';
import { prossimoConsiglio, provaGuidataFinita } from './guida';
import type { IdConsiglio } from './guida';

/** `nascosta`: la prova resta montata mentre si leggono le Regole, e intanto la scena non consuma. */
export function PartitaProva({
  onHome,
  onRegole,
  nascosta,
}: {
  onHome: () => void;
  /** Le Regole dal menu, con i nomi dei bot (Bea, Leo): "Tu" non fa da nome negli esempi, il terzo è un nome di esempio. */
  onRegole: (nomi: readonly string[]) => void;
  nascosta?: boolean;
}) {
  const [sessione, setSessione] = useState(() => SessioneProva.nuova());
  const [visti, setVisti] = useState<ReadonlySet<IdConsiglio>>(() => new Set());
  const [fineMostrata, setFineMostrata] = useState(false);
  useAggiornamenti(sessione);
  // I bot muovono finché la prova è aperta; uscendo (o ricominciandola) si fermano
  useEffect(() => {
    sessione.avvia();
    return () => sessione.chiudi();
  }, [sessione]);
  // I bot aspettano se la scena recita e anche mentre la prova è nascosta (Regole): una scena nascosta si libera da sola,
  // ma intanto un consiglio legato a un momento passerebbe senza essere visto
  const scenaOccupata = useRef(false);
  useEffect(() => {
    sessione.pausa(scenaOccupata.current || !!nascosta);
  }, [sessione, nascosta]);

  const umano = sessione.umano;
  const v = sessione.vista(umano);
  const consiglio = prossimoConsiglio(v, umano, sessione.azioni(umano), visti);
  const fine = !fineMostrata && provaGuidataFinita(v);

  const pensiero: Pensiero | null = fine
    ? {
        titolo: T.prova.fine.titolo,
        testo: T.prova.fine.testo,
        pulsanti: [
          { testo: T.prova.fine.continua, azione: () => setFineMostrata(true) },
          { testo: T.prova.fine.home, secondario: true, azione: onHome },
        ],
      }
    : consiglio
      ? {
          titolo: T.prova.consiglioTitolo,
          testo: T.prova.consigli[consiglio],
          pulsanti: [{ testo: T.prova.hoCapito, azione: () => setVisti(new Set([...visti, consiglio])) }],
        }
      : null;

  return (
    <Partita
      sessione={sessione}
      umano={umano}
      pensiero={pensiero}
      senzaAzioni={fine}
      nascosta={nascosta}
      // Mentre la scena recita i bot aspettano: le mosse non si accavallano a quelle ancora in scena
      onScenaOccupata={(occupata) => {
        scenaOccupata.current = occupata;
        sessione.pausa(occupata || !!nascosta);
      }}
      onHome={onHome}
      // Tre nomi come i giocatori della prova (la regola di eliminazione degli esempi dipende da quanti sono)
      onRegole={() => onRegole(nomiPerEsempi(v.giocatori.filter((g) => g.id !== umano).map((g) => g.nome)))}
      onRigioca={() => {
        setSessione(SessioneProva.nuova());
        setVisti(new Set());
        setFineMostrata(false);
      }}
    />
  );
}
