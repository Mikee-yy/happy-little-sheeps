// Navigazione tra le schermate: partita su un dispositivo (sessione locale) o a più dispositivi (stanze).
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { SessioneHost } from '../../sync/host';
import { archivioBrowser, SessioneLocale } from '../../sync/locale';
import type { GiocatoreLocale } from '../../sync/locale';
import { SessioneOspite, SessioneTavolo } from '../../sync/ospite';
import { normalizzaCodice } from '../../sync/stanza';
import type { Iscrizione } from '../../sync/stanza';
import { Sprite } from './grafica';
import { precaricaScena } from './partita/caricaScena';
import { Partita } from './partita/Partita';
import { PartitaProva } from './prova/PartitaProva';
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
import { ospita, precaricaStanza } from './remoto/durataStanza';
import { ModuloStanza, RegoleInStanza, Stanza, useSchermoAcceso, VistaTavolo } from './remoto/Stanza';
import { Regole } from './regole/Regole';
import { ricordaPunto, tornaAlPunto } from './regole/ritorno';
import type { PuntoDiRitorno } from './regole/ritorno';
import { Home, Preparazione, scelteIniziali } from './schermate';
import type { SceltePreparazione } from './schermate';
import { T } from './testi';

type Schermata = 'home' | 'preparazione' | 'partita' | 'prova' | 'regole' | 'crea' | 'entra' | 'stanza' | 'tavolo' | 'collegamento';

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
  /** I nomi degli esempi delle Regole: quelli della partita da cui si sono aperte, o null (nomi di esempio). */
  const [nomiRegole, setNomiRegole] = useState<readonly string[] | null>(null);
  /** Da dove si sono aperte le Regole (scorrimento e punto della tastiera), e se al ritorno va rimesso. */
  const [punto, setPunto] = useState<{ punto: PuntoDiRitorno; daRimettere: boolean } | null>(null);
  /** Partita di prova in corso: resta montata (nascosta) mentre si leggono le Regole; il numero la fa ripartire da capo. */
  const [prova, setProva] = useState<number | null>(null);
  const [scelte, setScelte] = useState<SceltePreparazione>(scelteIniziali);
  const [stanza, setStanza] = useState<{ sessione: SessioneHost | SessioneOspite; iscrizione: Iscrizione } | null>(null);
  const [tavolo, setTavolo] = useState<SessioneTavolo | null>(null);
  const [avviso, setAvviso] = useState<string | null>(null);
  const [iscrizione, setIscrizione] = useState<Iscrizione | null>(leggiIscrizione);
  const salvata = archivio.leggi() !== null;

  const rientra = async (i: Iscrizione) => {
    setSchermata('collegamento');
    // La scena (e per chi ospita la durata delle sue recite) comincia a scaricarsi mentre ci si ricollega
    precaricaStanza();
    try {
      const t = await connetti();
      let s: SessioneHost | SessioneOspite | null;
      s = i.ruolo === 'host' ? await ospita((o) => SessioneHost.riprendi(t, archivioHost(), o)) : await SessioneOspite.rientra(t, i);
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
      // La scena comincia a scaricarsi mentre ci si collega
      precaricaScena();
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
    // Una partita nuova parte sempre da scelte nuove (la rivincita usa `giocatori`, non queste)
    setScelte(scelteIniziali());
    setSessione(SessioneLocale.nuova(g, nuovoSeme(), archivio));
    setSchermata('partita');
  };
  // Nella stanza lo schermo resta acceso, anche leggendo le Regole (la partita va avanti): un solo blocco per tutte e due
  useSchermoAcceso(stanza !== null && (schermata === 'stanza' || (schermata === 'regole' && dopoRegole === 'stanza')));

  const regole = (da: Schermata, nomi: readonly string[] | null = null) => {
    setDopoRegole(da);
    setNomiRegole(nomi);
    setPunto({ punto: ricordaPunto(), daRimettere: false });
    setSchermata('regole');
  };
  // Tornati dalle Regole, la schermata di prima è di nuovo disegnata: scorrimento e punto della tastiera di prima
  useLayoutEffect(() => {
    if (!punto?.daRimettere || schermata === 'regole') return;
    tornaAlPunto(punto.punto);
    setPunto(null);
  }, [punto, schermata]);
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
        onRegole={(nomi) => regole('partita', nomi)}
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
          : dopoRegole === 'prova' && prova !== null
            ? 'prova'
            : dopoRegole === 'preparazione'
              ? 'preparazione'
              : 'home';
    const indietro = () => {
      setSchermata(ritorno);
      setPunto((x) => x && { ...x, daRimettere: true });
    };
    // Dalla stanza la partita va avanti: riga e richiamo li legge la sessione della stanza
    contenuto =
      ritorno === 'stanza' && stanza ? (
        <RegoleInStanza sessione={stanza.sessione} nomi={nomiRegole} onIndietro={indietro} />
      ) : (
        <Regole nomi={nomiRegole} onIndietro={indietro} />
      );
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
    contenuto = <Stanza sessione={stanza.sessione} iscrizione={stanza.iscrizione} onEsci={esciDallaStanza} onRegole={(nomi) => regole('stanza', nomi)} />;
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
        onNuova={() => {
          // La scena (pacchetto a parte) comincia a scaricarsi mentre si scelgono i nomi
          precaricaScena();
          setScelte(scelteIniziali());
          setSchermata('preparazione');
        }}
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
          precaricaScena();
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
        onProva={() => {
          precaricaScena();
          setProva((n) => (n ?? 0) + 1);
          setSchermata('prova');
        }}
      />
    );
  }

  return (
    <>
      <Sprite />
      {schermata !== 'prova' && contenuto}
      {prova !== null && (
        <div hidden={schermata !== 'prova'}>
          <PartitaProva
            key={prova}
            nascosta={schermata !== 'prova'}
            onHome={() => {
              setProva(null);
              setSchermata('home');
            }}
            onRegole={(nomi) => regole('prova', nomi)}
          />
        </div>
      )}
    </>
  );
}
