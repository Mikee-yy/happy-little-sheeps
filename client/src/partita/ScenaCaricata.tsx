// La scena dentro la partita, caricata a parte (caricaScena.ts): finché non arriva il prato vuoto col riassunto testuale;
// se lo scaricamento fallisce un messaggio con "Riprova" (il confine d'errore ricrea il componente pigro e ritenta).
import { Component, Suspense, useState, type ReactNode } from 'react';
import type { Vista } from '../../../engine/src';
import { riassuntoTestuale, type Fotografia } from '../scena/fotografia';
import type { Domanda, Gesto, Pensiero } from '../scena/scelte/tipi';
import { piattaforma } from '../scena/piattaforma';
import type { Teatro } from '../scena/teatro';
import { T } from '../testi';
import { riprovaScena, scenaPigra } from './caricaScena';
import { Pulsante } from './componenti';

interface Props {
  foto: Fotografia;
  /** La vista del tavolo: i suoi eventi nuovi sono ciò che la scena recita. */
  vista: Vista;
  nascosta?: boolean;
  /** Scena coperta da "Passa il dispositivo": ciclo e audio fermi (vedi Scena). */
  sospesa?: boolean;
  rifTeatro?: { current: Teatro | null };
  /** Ai cambi di "la scena recita"; mentre la scena non c'è (in arrivo o non arrivata) non arriva niente: è libera. */
  onOccupato?: (occupato: boolean) => void;
  /** La domanda di adesso, chi ne riceve i gesti e il pensiero della pecora in basso (vedi Scena). */
  domanda?: Domanda | null;
  suGesto?: (g: Gesto) => void;
  pensiero?: Pensiero | null;
  /** true quando la scena è montata, false smontando; mentre si scarica o se non arriva non arriva niente: non è pronta. */
  onPronto?: (pronto: boolean) => void;
  /** La partita si salva nel browser (falso nella prova): decide il testo "Ricarica la pagina". */
  salvata?: boolean;
}

/** Al posto della scena mentre si scarica (o se non è arrivata): lo sfondo del prato e il riassunto testuale. */
function PratoVuoto({ foto, children }: { foto: Fotografia; children?: ReactNode }) {
  return (
    <div className="scena-gioco scena-in-arrivo">
      <ul className="solo-lettori">
        {riassuntoTestuale(foto).map((riga, i) => (
          <li key={i}>{riga}</li>
        ))}
      </ul>
      {children}
    </div>
  );
}

/** Prende l'errore dello scaricamento e mostra il messaggio al posto della scena. */
class ConfineScena extends Component<{ riserva: (riprova: () => void) => ReactNode; onRiprova: () => void; children: ReactNode }, { errore: boolean }> {
  override state = { errore: false };
  static getDerivedStateFromError() {
    return { errore: true };
  }
  override render() {
    if (!this.state.errore) return this.props.children;
    // "Riprova" cambia la chiave del confine: ne nasce uno nuovo, pulito
    return this.props.riserva(this.props.onRiprova);
  }
}

export function ScenaCaricata({ foto, vista, nascosta, sospesa, rifTeatro, onOccupato, domanda, suGesto, pensiero, onPronto, salvata = true }: Props) {
  // Cambia a ogni "Riprova": il confine riparte pulito e il componente pigro è nuovo
  const [tentativo, setTentativo] = useState(0);
  const ScenaPigra = scenaPigra();
  return (
    <ConfineScena
      key={tentativo}
      onRiprova={() => {
        riprovaScena();
        setTentativo((n) => n + 1);
      }}
      riserva={(riprova) => {
        // Senza rete basta riprovare; con la rete il pacchetto non c'è più: il sito è stato aggiornato e si ricarica la pagina
        const aggiornato = piattaforma.online();
        return (
          <PratoVuoto foto={foto}>
            <div className="scena-non-caricata" role="alert">
              <p>{aggiornato ? (salvata ? T.scena.caricamento.aggiornato : T.scena.caricamento.aggiornatoProva) : T.scena.caricamento.fallito}</p>
              {aggiornato && <Pulsante onClick={() => piattaforma.ricarica()}>{T.scena.caricamento.ricarica}</Pulsante>}
              <Pulsante secondario={aggiornato} onClick={riprova}>
                {T.scena.caricamento.riprova}
              </Pulsante>
            </div>
          </PratoVuoto>
        );
      }}
    >
      <Suspense fallback={<PratoVuoto foto={foto} />}>
        <ScenaPigra
          foto={foto}
          vista={vista}
          nascosta={nascosta}
          sospesa={sospesa}
          rifTeatro={rifTeatro}
          onOccupato={onOccupato}
          domanda={domanda}
          suGesto={suGesto}
          pensiero={pensiero}
          onPronto={onPronto}
        />
      </Suspense>
    </ConfineScena>
  );
}
