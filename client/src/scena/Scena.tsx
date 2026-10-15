// Il componente React della scena: monta il teatro in un div a tutto schermo e gli passa le fotografie della partita.
// React non entra nei fotogrammi: a ogni fotografia nuova chiama solo `allinea` (la prima di ogni teatro "subito", poi "calmo").
// Al ritorno da un'altra scheda e quando la scena torna visibile si rimette in pari "subito" (punto di revisione 4).
// La scena è aria-hidden: accanto c'è il riassunto testuale per chi usa un lettore di schermo.
import { useEffect, useMemo, useRef } from 'react';
import './scena.css';
import { riassuntoTestuale, type Fotografia } from './fotografia';
import { piattaforma } from './piattaforma';
import { creaTeatro, type Teatro } from './teatro';

interface Props {
  foto: Fotografia;
  /** Scena montata ma non mostrata (la prova mentre si leggono le Regole): il ciclo si ferma, niente si distrugge. */
  nascosta?: boolean;
  /** Riceve il teatro montato, null smontando: per chi deve chiamarlo da fuori (il menu, "Rivedi i suggerimenti"). */
  rifTeatro?: { current: Teatro | null };
}

/** Il teatro montato e ciò che gli è già stato mostrato. */
interface Montato {
  teatro: Teatro;
  /** Chiave dell'ultima fotografia allineata (null: ancora nessuna, la prossima va "subito"). */
  allineata: string | null;
  nascosta: boolean;
}

export function Scena({ foto, nascosta = false, rifTeatro }: Props) {
  const radice = useRef<HTMLDivElement>(null);
  const montato = useRef<Montato | null>(null);
  // Le ultime props, per chi le legge fuori dal rendering (ritorno sulla pagina)
  const ultima = useRef({ foto, nascosta });
  // La stessa partita ricalcolata dà una fotografia nuova ma uguale: si confrontano i contenuti
  const chiave = useMemo(() => JSON.stringify(foto), [foto]);

  // Un teatro per montaggio: il finto smontaggio di StrictMode lo distrugge e il secondo riparte pulito
  useEffect(() => {
    const el = radice.current!;
    const m: Montato = { teatro: creaTeatro(el), allineata: null, nascosta: false };
    montato.current = m;
    if (rifTeatro) rifTeatro.current = m.teatro;
    const smettiDiOsservare = piattaforma.osservaMisura(el, () => m.teatro.adatta());
    const suVisibilita = (): void => {
      if (document.visibilityState !== 'visible' || ultima.current.nascosta) return;
      m.teatro.allinea(ultima.current.foto, 'subito');
      m.allineata = JSON.stringify(ultima.current.foto);
    };
    document.addEventListener('visibilitychange', suVisibilita);
    return () => {
      document.removeEventListener('visibilitychange', suVisibilita);
      smettiDiOsservare();
      m.teatro.distruggi();
      if (montato.current === m) montato.current = null;
      if (rifTeatro?.current === m.teatro) rifTeatro.current = null;
    };
    // rifTeatro si legge solo al montaggio
  }, []);

  useEffect(() => {
    ultima.current = { foto, nascosta };
    const m = montato.current;
    if (!m) return;
    if (nascosta !== m.nascosta) {
      m.nascosta = nascosta;
      m.teatro.sospendi(nascosta);
      if (!nascosta) {
        // Torna visibile: misure nuove e scena in pari, senza recuperare i movimenti persi
        m.teatro.adatta();
        m.allineata = null;
      }
    }
    if (nascosta || m.allineata === chiave) return;
    m.teatro.allinea(foto, m.allineata === null ? 'subito' : 'calmo');
    m.allineata = chiave;
    // foto cambia insieme a chiave
  }, [chiave, nascosta]);

  return (
    <div className="scena-gioco">
      <div
        ref={radice}
        className="teatro"
        aria-hidden="true"
      />
      <ul className="solo-lettori">
        {riassuntoTestuale(foto).map((riga, i) => (
          <li key={i}>{riga}</li>
        ))}
      </ul>
    </div>
  );
}
