// Il riquadro della Home per Samsung Internet in modalità notte (quando mostrarlo lo decide modalitaNotte.ts).
// Non prende il fuoco e non copre niente: si legge e si chiude con "Ho capito".
import { useId } from 'react';
import { chiudiAvvisoNotte } from './modalitaNotte';
import { Pulsante } from './partita/componenti';
import { T } from './testi';

export function AvvisoNotte({ onChiuso }: { onChiuso: () => void }) {
  const titolo = useId();
  return (
    <section className="avviso-notte" aria-labelledby={titolo}>
      <h2 id={titolo}>{T.avvisoNotte.titolo}</h2>
      <p>{T.avvisoNotte.testo}</p>
      <p>{T.avvisoNotte.come}</p>
      <Pulsante
        secondario
        onClick={() => {
          chiudiAvvisoNotte();
          onChiuso();
        }}
      >
        {T.avvisoNotte.chiudi}
      </Pulsante>
    </section>
  );
}
