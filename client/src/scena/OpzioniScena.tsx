// Interruttori delle Opzioni della scena: menu del gioco e pagina di sviluppo (bozza scena.src.html, righe 2583–2606 e 2684).
// Suoni, Vibrazione (solo dove il telefono vibra) e Animazioni veloci, più "Rivedi i suggerimenti".
// Un tocco aggiorna solo l'interruttore toccato (lo stesso elemento), così chi usa la tastiera non perde il punto. Esc chiude.
import { useEffect, useReducer } from 'react';
import { T } from '../testi';
import { piattaforma } from './piattaforma';
import { ascoltaOpzioni, cambiaOpzione, opzioni, type Opzioni } from './servizi/opzioni';

interface Props {
  /** Rimette i suggerimenti dall'inizio (di solito `teatro.rivediSuggerimenti`). */
  rivediSuggerimenti: () => void;
  /** Esc o "Rivedi i suggerimenti": chi apre il menu lo chiude. */
  onChiudi?: () => void;
  className?: string;
}

export function OpzioniScena({ rivediSuggerimenti, onChiudi, className }: Props) {
  // Le opzioni sono una per pagina: si ridisegna quando cambiano, anche da altrove
  const [, ridisegna] = useReducer((n: number) => n + 1, 0);
  useEffect(() => ascoltaOpzioni(ridisegna), []);
  const o = opzioni();
  const t = T.scena.opzioni;

  const riga = (chiave: keyof Opzioni, testo: string) => (
    <button
      key={chiave}
      className="btn"
      type="button"
      role="switch"
      aria-checked={o[chiave]}
      data-opzione={chiave}
      onClick={() => cambiaOpzione(chiave)}
    >
      {`${testo}: ${o[chiave] ? t.si : t.no}`}
    </button>
  );

  return (
    <div
      className={className}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onChiudi?.();
        }
      }}
    >
      {riga('suoni', t.suoni)}
      {piattaforma.puoVibrare() && riga('vibrazione', t.vibrazione)}
      {riga('veloci', t.veloci)}
      <button
        className="btn"
        type="button"
        data-azione="suggerimenti"
        onClick={() => {
          onChiudi?.();
          rivediSuggerimenti();
        }}
      >
        {t.rivedi}
      </button>
    </div>
  );
}
