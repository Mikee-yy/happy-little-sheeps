// Navigazione tra le schermate: partita su un dispositivo (sessione locale) o a più dispositivi (stanze).
import { useEffect, useMemo, useState } from 'react';
import { SessioneHost } from '../../sync/host';
import { archivioBrowser, SessioneLocale } from '../../sync/locale';
import type { GiocatoreLocale } from '../../sync/locale';
import { SessioneOspite, SessioneTavolo } from '../../sync/ospite';
import { normalizzaCodice } from '../../sync/stanza';
import type { Iscrizione } from '../../sync/stanza';
import { Sprite } from './grafica';
import { Partita } from './partita/Partita';
import {
  archivioHost,
  connetti,
  dimenticaIscrizione,
  eraInStanza,
  leggiIscrizione,
  multigiocatoreDisponibile,
  salvaIscrizione,
  segnaInStanza,
} from './remoto/connessione';
import { ModuloStanza, Stanza, VistaTavolo } from './remoto/Stanza';
import { Home, Preparazione, Regole, scelteIniziali } from './schermate';
import type { SceltePreparazione } from './schermate';
import { T } from './testi';

type Schermata = 'home' | 'preparazione' | 'partita' | 'regole' | 'crea' | 'entra' | 'stanza' | 'tavolo' | 'collegamento';

/** Seme della partita: la casualità del motore è riproducibile, ma ogni partita nuova parte da un seme diverso. */
function nuovoSeme(): number {
  const a = new Uint32Array(1);
  globalThis.crypto.getRandomValues(a);
  return a[0] ?? 1;
}

/** #stanza=ABCD (dal QR code) e #tavolo=ABCD (vista da proiettare). */
function daIndirizzo(): { tipo: 'stanza' | 'tavolo'; codice: string } | null {
  const m = /^#(stanza|tavolo)=([A-Za-z]+)$/.exec(globalThis.location?.hash ?? '');
  const codice = m ? normalizzaCodice(m[2]!) : null;
  return m && codice ? { tipo: m[1] as 'stanza' | 'tavolo', codice } : null;
}

function pulisciIndirizzo(): void {
  try {
    globalThis.history?.replaceState(null, '', globalThis.location.pathname + globalThis.location.search);
  } catch {
    // Non indispensabile.
  }
}

export function App() {
  const archivio = useMemo(() => archivioBrowser(), []);
  const indirizzo = useMemo(daIndirizzo, []);
  const [sessione, setSessione] = useState<SessioneLocale | null>(null);
  const [giocatori, setGiocatori] = useState<GiocatoreLocale[]>([]);
  /** Il link #stanza= della stanza in cui si è già iscritti riporta dentro, invece di aprire il modulo d'ingresso. */
  const linkDellaMiaStanza = indirizzo?.tipo === 'stanza' && leggiIscrizione()?.codice === indirizzo.codice;
  const [schermata, setSchermata] = useState<Schermata>(() =>
    indirizzo?.tipo === 'tavolo' || linkDellaMiaStanza
      ? 'collegamento'
      : indirizzo?.tipo === 'stanza'
        ? 'entra'
        : eraInStanza()
          ? 'collegamento'
          : 'home',
  );
  const [dopoRegole, setDopoRegole] = useState<Schermata>('home');
  const [scelte, setScelte] = useState<SceltePreparazione>(scelteIniziali);
  const [stanza, setStanza] = useState<{ sessione: SessioneHost | SessioneOspite; iscrizione: Iscrizione } | null>(null);
  const [tavolo, setTavolo] = useState<SessioneTavolo | null>(null);
  const [avviso, setAvviso] = useState<string | null>(null);
  const [iscrizione, setIscrizione] = useState<Iscrizione | null>(leggiIscrizione);
  const salvata = archivio.leggi() !== null;

  const rientra = async (i: Iscrizione) => {
    setSchermata('collegamento');
    try {
      const t = await connetti();
      let s: SessioneHost | SessioneOspite | null;
      s = i.ruolo === 'host' ? await SessioneHost.riprendi(t, archivioHost()) : await SessioneOspite.rientra(t, i);
      if (!s) throw new Error(T.stanza.nonDisponibile);
      setStanza({ sessione: s, iscrizione: i });
      setSchermata('stanza');
    } catch (e) {
      segnaInStanza(null);
      setAvviso(e instanceof Error ? e.message : String(e));
      setSchermata('home');
    }
  };

  // All'apertura: vista tavolo dal link, oppure rientro automatico dopo un ricaricamento della pagina.
  useEffect(() => {
    if (indirizzo?.tipo === 'tavolo') {
      void (async () => {
        try {
          const t = await connetti();
          setTavolo(await SessioneTavolo.apri(t, indirizzo.codice));
          setSchermata('tavolo');
        } catch (e) {
          setAvviso(e instanceof Error ? e.message : String(e));
          setSchermata('home');
        }
      })();
      return;
    }
    const i = leggiIscrizione();
    if (linkDellaMiaStanza && i) {
      pulisciIndirizzo();
      void rientra(i);
    } else if (!indirizzo && eraInStanza() && i) void rientra(i);
    else if (eraInStanza() && !i) {
      segnaInStanza(null);
      setSchermata('home');
    }
    // Solo all'apertura della pagina.
  }, []);

  const inizia = (g: GiocatoreLocale[]) => {
    setGiocatori(g);
    setSessione(SessioneLocale.nuova(g, nuovoSeme(), archivio));
    setSchermata('partita');
  };
  const regole = (da: Schermata) => {
    setDopoRegole(da);
    setSchermata('regole');
  };
  const esciDallaStanza = () => {
    stanza?.sessione.chiudi();
    setStanza(null);
    segnaInStanza(null);
    setSchermata('home');
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
    contenuto = (
      <Preparazione
        salvata={salvata}
        scelte={scelte}
        onScelte={setScelte}
        onInizia={inizia}
        onIndietro={() => {
          setScelte(scelteIniziali());
          setSchermata('home');
        }}
        onRegole={() => regole('preparazione')}
      />
    );
  } else if (schermata === 'regole') {
    const ritorno =
      dopoRegole === 'partita' && sessione
        ? 'partita'
        : dopoRegole === 'stanza' && stanza
          ? 'stanza'
          : dopoRegole === 'preparazione'
            ? 'preparazione'
            : 'home';
    contenuto = <Regole onIndietro={() => setSchermata(ritorno)} />;
  } else if (schermata === 'crea' || schermata === 'entra') {
    contenuto = (
      <ModuloStanza
        modo={schermata}
        codiceIniziale={indirizzo?.tipo === 'stanza' ? indirizzo.codice : undefined}
        onDentro={(s, i) => {
          pulisciIndirizzo();
          salvaIscrizione(i);
          setIscrizione(i);
          setStanza({ sessione: s, iscrizione: i });
          setSchermata('stanza');
        }}
        onIndietro={() => {
          pulisciIndirizzo();
          setSchermata('home');
        }}
      />
    );
  } else if (schermata === 'stanza' && stanza) {
    contenuto = <Stanza sessione={stanza.sessione} iscrizione={stanza.iscrizione} onEsci={esciDallaStanza} onRegole={() => regole('stanza')} />;
  } else if (schermata === 'tavolo' && tavolo) {
    contenuto = (
      <VistaTavolo
        sessione={tavolo}
        onEsci={() => {
          tavolo.chiudi();
          setTavolo(null);
          pulisciIndirizzo();
          setSchermata('home');
        }}
      />
    );
  } else if (schermata === 'collegamento') {
    contenuto = <main className="passaggio">{T.stanza.collegamento}</main>;
  } else {
    contenuto = (
      <Home
        salvata={salvata}
        multigiocatore={multigiocatoreDisponibile()}
        iscrizione={iscrizione}
        avviso={avviso}
        onNuova={() => setSchermata('preparazione')}
        onCrea={() => {
          setAvviso(null);
          setSchermata('crea');
        }}
        onEntra={() => {
          setAvviso(null);
          setSchermata('entra');
        }}
        onRientra={() => iscrizione && void rientra(iscrizione)}
        onDimentica={() => {
          dimenticaIscrizione();
          setIscrizione(null);
        }}
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
