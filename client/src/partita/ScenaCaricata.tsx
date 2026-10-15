// La scena dentro la partita, caricata a parte (caricaScena.ts): finché non arriva il prato vuoto col riassunto testuale;
// se lo scaricamento fallisce un messaggio con "Riprova" (il confine d'errore ricrea il componente pigro e ritenta).
import { Component, Suspense, useState, type ReactNode } from 'react';
import { riassuntoTestuale, type Fotografia } from '../scena/fotografia';
import type { Teatro } from '../scena/teatro';
import { T } from '../testi';
import { riprovaScena, scenaPigra } from './caricaScena';
import { Pulsante } from './componenti';

interface Props {
  foto: Fotografia;
  nascosta?: boolean;
  rifTeatro?: { current: Teatro | null };
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

export function ScenaCaricata({ foto, nascosta, rifTeatro }: Props) {
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
      riserva={(riprova) => (
        <PratoVuoto foto={foto}>
          <div className="scena-non-caricata" role="alert">
            <p>{T.scena.caricamento.fallito}</p>
            <Pulsante onClick={riprova}>{T.scena.caricamento.riprova}</Pulsante>
          </div>
        </PratoVuoto>
      )}
    >
      <Suspense fallback={<PratoVuoto foto={foto} />}>
        <ScenaPigra foto={foto} nascosta={nascosta} rifTeatro={rifTeatro} />
      </Suspense>
    </ConfineScena>
  );
}
