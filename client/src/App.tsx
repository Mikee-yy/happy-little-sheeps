// Navigazione tra le schermate e gestione della sessione locale.
import { useMemo, useState } from 'react';
import { archivioBrowser, SessioneLocale } from '../../sync/locale';
import type { GiocatoreLocale } from '../../sync/locale';
import { Sprite } from './grafica';
import { Partita } from './partita/Partita';
import { Home, Preparazione, Regole } from './schermate';

type Schermata = 'home' | 'preparazione' | 'partita' | 'regole';

/** Seme della partita: la casualità del motore è riproducibile, ma ogni partita nuova parte da un seme diverso. */
function nuovoSeme(): number {
  const a = new Uint32Array(1);
  globalThis.crypto.getRandomValues(a);
  return a[0] ?? 1;
}

export function App() {
  const archivio = useMemo(() => archivioBrowser(), []);
  const [sessione, setSessione] = useState<SessioneLocale | null>(null);
  const [giocatori, setGiocatori] = useState<GiocatoreLocale[]>([]);
  const [schermata, setSchermata] = useState<Schermata>('home');
  const [dopoRegole, setDopoRegole] = useState<Schermata>('home');
  const salvata = archivio.leggi() !== null;

  const inizia = (g: GiocatoreLocale[]) => {
    setGiocatori(g);
    setSessione(SessioneLocale.nuova(g, nuovoSeme(), archivio));
    setSchermata('partita');
  };
  const regole = (da: Schermata) => {
    setDopoRegole(da);
    setSchermata('regole');
  };

  let contenuto;
  if (schermata === 'partita' && sessione) {
    contenuto = (
      <Partita
        sessione={sessione}
        onHome={() => {
          setSessione(null);
          setSchermata('home');
        }}
        onRigioca={() => (giocatori.length ? inizia(giocatori) : setSchermata('preparazione'))}
        onRegole={() => regole('partita')}
      />
    );
  } else if (schermata === 'preparazione') {
    contenuto = <Preparazione salvata={salvata} onInizia={inizia} onIndietro={() => setSchermata('home')} />;
  } else if (schermata === 'regole') {
    contenuto = <Regole onIndietro={() => setSchermata(dopoRegole === 'partita' && sessione ? 'partita' : 'home')} />;
  } else {
    contenuto = (
      <Home
        salvata={salvata}
        onNuova={() => setSchermata('preparazione')}
        onRiprendi={() => {
          const s = SessioneLocale.riprendi(archivio);
          if (!s) {
            archivio.cancella();
            setSchermata('preparazione');
            return;
          }
          setGiocatori(s.vista(null).giocatori.map((g) => ({ id: g.id, nome: g.nome, pecora: g.pecora })));
          setSessione(s);
          setSchermata('partita');
        }}
        onRegole={() => regole('home')}
      />
    );
  }

  return (
    <>
      <Sprite />
      {contenuto}
    </>
  );
}
