// Partita su un solo dispositivo: la regia decide la schermata, la schermata di passaggio
// nasconde tutto finché il giocatore giusto non tocca "Sono io".
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { Azione, IdGiocatore, Vista } from '../../../engine/src';
import type { Sessione } from '../../../sync/sessione';
import { Avatar, Pecora } from '../grafica';
import { elenco, T } from '../testi';
import { Cronaca, Pulsante } from './componenti';
import { giocatoreDi, nome } from './descrizioni';
import {
  PannelloAutomatico,
  PannelloBelatoFinale,
  PannelloConsolazione,
  PannelloDichiarazione,
  PannelloDomanda,
  PannelloEffetto,
  PannelloLancio,
  PannelloPunteggio,
  PannelloReazione,
  PannelloRichiesta,
  PannelloScelta,
  PannelloSalvataggio,
} from './pannelli';
import { scena } from './regia';
import type { Scena } from './regia';
import { Intestazione, Tavolo } from './Tavolo';
import { Testata } from './Testata';

export function useAggiornamenti(s: { ascolta(cb: () => void): () => void }) {
  const [, aggiorna] = useReducer((x: number) => x + 1, 0);
  useEffect(() => s.ascolta(aggiorna), [s]);
}

function PassaDispositivo({ v, giocatore, onSonoIo }: { v: Vista; giocatore: IdGiocatore; onSonoIo: () => void }) {
  const g = giocatoreDi(v, giocatore);
  return (
    <div className="passaggio">
      <Pecora pecora={g.pecora} size={160} />
      <h1>{T.passaggio.passaA(g.nome)}</h1>
      <p>{T.passaggio.nascosto}</p>
      <Pulsante largo onClick={onSonoIo}>
        {T.passaggio.sonoIo(g.nome)}
      </Pulsante>
    </div>
  );
}

export function FinePartita({
  v,
  onRigioca,
  onHome,
  testoRigioca = T.finePartita.rigioca,
  nota,
}: {
  v: Vista;
  onRigioca?: () => void;
  onHome: () => void;
  testoRigioca?: string;
  nota?: string;
}) {
  const esito = v.esito;
  const vincitori = esito?.vincitori ?? [];
  const classifica = [...v.giocatori].sort(
    (a, b) => Number(a.eliminato) - Number(b.eliminato) || b.agnellini - a.agnellini || a.angolo.length - b.angolo.length,
  );
  const nomiVincitori = elenco(vincitori.map((id) => nome(v, id)));
  return (
    <div className="fine-partita">
      <h1>{T.finePartita.titolo}</h1>
      <div className="vincitori">
        {vincitori.map((id) => (
          <Pecora key={id} pecora={giocatoreDi(v, id).pecora} size={140} />
        ))}
      </div>
      <h2>{vincitori.length > 1 ? T.finePartita.vincono(nomiVincitori) : T.finePartita.vince(nomiVincitori)}</h2>
      {esito && <p className="pillola-vittoria grande">{T.finePartita.modi[esito.modo]}</p>}
      <div className="etichetta">{T.finePartita.classifica}</div>
      <ol className="classifica">
        {classifica.map((g) => (
          <li key={g.id} className={vincitori.includes(g.id) ? 'vincitore' : ''}>
            <Avatar pecora={g.pecora} size={28} />
            <strong>{g.nome}</strong>
            <span>{g.eliminato ? T.tavolo.eliminata : T.finePartita.agnellini(g.agnellini)}</span>
            <span>{g.eliminato ? '' : T.finePartita.guai(g.angolo.length)}</span>
          </li>
        ))}
      </ol>
      {onRigioca && (
        <Pulsante largo onClick={onRigioca}>
          {testoRigioca}
        </Pulsante>
      )}
      {nota && <p className="aiuto">{nota}</p>}
      <Pulsante largo secondario onClick={onHome}>
        {T.finePartita.home}
      </Pulsante>
    </div>
  );
}

export function Menu({
  onRegole,
  onEsci,
  onChiudi,
  children,
}: {
  onRegole: () => void;
  onEsci: () => void;
  onChiudi: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="velo" role="dialog" aria-modal="true" aria-label={T.menu.titolo}>
      <div className="menu">
        <h2>{T.menu.titolo}</h2>
        {children}
        <Pulsante largo secondario onClick={onRegole}>
          {T.menu.regole}
        </Pulsante>
        <Pulsante largo secondario onClick={onEsci}>
          {T.menu.esci}
        </Pulsante>
        <Pulsante largo onClick={onChiudi}>
          {T.menu.chiudi}
        </Pulsante>
      </div>
    </div>
  );
}

/** Chiave che cambia a ogni azione: i pannelli ripartono puliti (selezioni azzerate). */
const chiave = (v: Vista, sc: Scena) => `${v.eventi[v.eventi.length - 1]?.seq ?? 0}-${sc.tipo}-${'giocatore' in sc ? sc.giocatore : ''}`;

export function Partita(p: { sessione: Sessione; onHome: () => void; onRigioca: () => void; onRegole: () => void }) {
  const { sessione } = p;
  useAggiornamenti(sessione);
  const [detentore, setDetentore] = useState<IdGiocatore | null>(null);
  const [scelto, setScelto] = useState<IdGiocatore | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);

  const tavolo = sessione.vista(null);
  const sc = scena(tavolo, scelto);
  const privata = sc.tipo === 'privata';
  const area = useRef<HTMLElement>(null);
  const chiaveScena = chiave(tavolo, sc);
  const passaggio = sc.tipo === 'privata' && detentore !== sc.giocatore;

  // Su telefono il pannello d'azione deve essere visibile senza cercarlo: ci si scorre a ogni cambio di schermata.
  useEffect(() => {
    if (!passaggio) area.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  }, [chiaveScena, passaggio]);

  // Le schermate pubbliche tolgono il dispositivo a chiunque: la prossima schermata privata chiede di nuovo "Sono io".
  useEffect(() => {
    if (!privata) setDetentore(null);
  }, [privata]);

  const invia = useCallback(
    (a: Azione) => {
      const r = sessione.invia(a);
      if (r.ok) {
        setErrore(null);
        setScelto(null);
      } else {
        setErrore(T.errori.azione(r.messaggio));
      }
    },
    [sessione],
  );

  if (sc.tipo === 'fine') {
    return <FinePartita v={tavolo} onRigioca={p.onRigioca} onHome={p.onHome} />;
  }
  if (sc.tipo === 'privata' && detentore !== sc.giocatore) {
    return <PassaDispositivo v={tavolo} giocatore={sc.giocatore} onSonoIo={() => setDetentore(sc.giocatore)} />;
  }

  const attivo = sc.tipo === 'privata' ? sc.giocatore : null;
  const v = attivo ? sessione.vista(attivo) : tavolo;
  let pannello: React.ReactNode = null;
  if (sc.tipo === 'automatica') {
    const prosegui = sessione.azioni('sistema').find((a) => a.tipo === 'prosegui');
    pannello = <PannelloAutomatico v={tavolo} onContinua={() => prosegui && invia(prosegui)} />;
  } else if (sc.tipo === 'domanda') {
    pannello = (
      <PannelloDomanda
        v={tavolo}
        contesto={sc.contesto}
        candidati={sc.candidati}
        onScegli={setScelto}
        onNessuno={() => invia({ tipo: 'scadenza' })}
      />
    );
  } else {
    const props = { v, giocatore: sc.giocatore, azioni: sessione.azioni(sc.giocatore), invia };
    const indietro = () => setScelto(null);
    switch (sc.pannello) {
      case 'scelta':
        pannello = <PannelloScelta {...props} />;
        break;
      case 'effetto':
        pannello = <PannelloEffetto {...props} />;
        break;
      case 'richiesta':
        pannello = <PannelloRichiesta {...props} />;
        break;
      case 'reazione':
        pannello = <PannelloReazione {...props} onIndietro={indietro} />;
        break;
      case 'punteggio':
        pannello = <PannelloPunteggio {...props} onIndietro={indietro} />;
        break;
      case 'belato_finale':
        pannello = <PannelloBelatoFinale {...props} />;
        break;
      case 'salvataggio':
        pannello = <PannelloSalvataggio {...props} />;
        break;
      case 'consolazione':
        pannello = <PannelloConsolazione {...props} />;
        break;
      case 'lancio':
        pannello = <PannelloLancio {...props} />;
        break;
      case 'dichiarazione':
        pannello = <PannelloDichiarazione {...props} />;
        break;
      case 'testata':
        pannello = <Testata {...props} />;
        break;
    }
  }

  return (
    <div className="partita">
      <Intestazione v={tavolo} onMenu={() => setMenu(true)} />
      <Tavolo v={v} attivo={attivo} />
      <Cronaca v={tavolo} />
      {errore && (
        <p className="errore" role="alert">
          {errore}
        </p>
      )}
      <section className="area-azione" key={chiaveScena} ref={area}>
        {pannello}
      </section>
      {menu && (
        <Menu
          onRegole={() => {
            setMenu(false);
            p.onRegole();
          }}
          onEsci={p.onHome}
          onChiudi={() => setMenu(false)}
        />
      )}
    </div>
  );
}
