// Partita di prova: tu contro Bea e Leo, con la guida che spiega ogni momento la prima volta che capita.
import { useEffect, useState } from 'react';
import { SessioneProva } from '../../../sync/prova';
import { Partita, useAggiornamenti } from '../partita/Partita';
import { Pulsante } from '../partita/componenti';
import { T } from '../testi';
import { prossimoConsiglio, provaGuidataFinita } from './guida';
import type { IdConsiglio } from './guida';

/** `nascosta`: la prova resta montata mentre si leggono le Regole, e intanto la scena non consuma. */
export function PartitaProva({ onHome, onRegole, nascosta }: { onHome: () => void; onRegole: () => void; nascosta?: boolean }) {
  const [sessione, setSessione] = useState(() => SessioneProva.nuova());
  const [visti, setVisti] = useState<ReadonlySet<IdConsiglio>>(() => new Set());
  const [fineMostrata, setFineMostrata] = useState(false);
  useAggiornamenti(sessione);
  // I bot muovono finché la prova è aperta; uscendo (o ricominciandola) si fermano
  useEffect(() => {
    sessione.avvia();
    return () => sessione.chiudi();
  }, [sessione]);

  const umano = sessione.umano;
  const v = sessione.vista(umano);
  const consiglio = prossimoConsiglio(v, umano, sessione.azioni(umano), visti);
  const fine = !fineMostrata && provaGuidataFinita(v);

  const testa = fine ? (
    <div className="fine-prova" role="status">
      <h2>{T.prova.fine.titolo}</h2>
      <p>{T.prova.fine.testo}</p>
      <Pulsante largo onClick={() => setFineMostrata(true)}>
        {T.prova.fine.continua}
      </Pulsante>
      <Pulsante largo secondario onClick={onHome}>
        {T.prova.fine.home}
      </Pulsante>
    </div>
  ) : consiglio ? (
    <div className="consiglio" role="status">
      <strong>{T.prova.consiglioTitolo}</strong>
      <p>{T.prova.consigli[consiglio]}</p>
      <Pulsante secondario onClick={() => setVisti(new Set([...visti, consiglio]))}>
        {T.prova.hoCapito}
      </Pulsante>
    </div>
  ) : null;

  return (
    <Partita
      sessione={sessione}
      umano={umano}
      testa={testa}
      senzaAzioni={fine}
      nascosta={nascosta}
      onHome={onHome}
      onRegole={onRegole}
      onRigioca={() => {
        setSessione(SessioneProva.nuova());
        setVisti(new Set());
        setFineMostrata(false);
      }}
    />
  );
}
