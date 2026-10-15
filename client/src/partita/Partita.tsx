// Partita su un solo dispositivo: la regia decide la schermata, la schermata di passaggio
// nasconde tutto finché il giocatore giusto non tocca "Sono io".
// Si gioca dentro la scena 2,5D (scena/): in basso c'è chi ha il telefono, le scelte stanno nei pannelli di un cassetto.
import { useCallback, useEffect, useId, useLayoutEffect, useReducer, useRef, useState } from 'react';
import type { Azione, IdGiocatore, Vista } from '../../../engine/src';
import type { Sessione } from '../../../sync/sessione';
import { Avatar, Pecora } from '../grafica';
import { fotografia, inBassoIniziale } from '../scena/fotografia';
import { OpzioniScena } from '../scena/OpzioniScena';
import { piattaforma } from '../scena/piattaforma';
import type { Teatro } from '../scena/teatro';
import { ScenaCaricata } from './ScenaCaricata';
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
import { scenaProva } from '../prova/regiaProva';
import type { ScenaProva } from '../prova/regiaProva';
import { Intestazione } from './Tavolo';
import { Testata } from './Testata';

export function useAggiornamenti(s: { ascolta(cb: () => void): () => void }) {
  const [, aggiorna] = useReducer((x: number) => x + 1, 0);
  useEffect(() => s.ascolta(aggiorna), [s]);
}

/** Strato opaco sopra la scena (che resta montata sotto, con la mano coperta). */
function PassaDispositivo({ v, giocatore, onSonoIo }: { v: Vista; giocatore: IdGiocatore; onSonoIo: () => void }) {
  const g = giocatoreDi(v, giocatore);
  return (
    <div className="passaggio sopra-scena">
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

/** Altezza della striscia in cima (intestazione e cronaca) più un respiro, finché non la si misura (jsdom: sempre questa). */
const SPAZIO_ALTO_RISERVA = 67;

/** Chiave che cambia a ogni azione: i pannelli ripartono puliti (selezioni azzerate). */
// Nella prova i bot muovono mentre l'umano sceglie: la chiave non dipende dall'ultimo evento,
// se no ogni loro mossa rimonterebbe il pannello (carta deselezionata, pagina che scorre)
const chiaveProva = (v: Vista, sc: Scena | ScenaProva) =>
  `${v.round}-${v.fase.nome}-${v.pila.length}-${sc.tipo}-${'giocatore' in sc ? sc.giocatore : ''}-${'pannello' in sc ? sc.pannello : ''}`;
const chiave = (v: Vista, sc: Scena | ScenaProva) => `${v.eventi[v.eventi.length - 1]?.seq ?? 0}-${sc.tipo}-${'giocatore' in sc ? sc.giocatore : ''}`;

/**
 * `umano`: partita di prova, un solo umano sul dispositivo (niente passaggi, i bot pensano da soli).
 * `testa`: qualcosa da mostrare in cima alla scena (il consiglio della guida o il riquadro finale della prova).
 */
export function Partita(p: {
  sessione: Sessione;
  onHome: () => void;
  onRigioca: () => void;
  onRegole: () => void;
  umano?: IdGiocatore;
  testa?: React.ReactNode;
  /** Nasconde il pannello d'azione (sotto il riquadro finale della prova non si gioca). */
  senzaAzioni?: boolean;
  /** Partita montata ma non mostrata (la prova mentre si leggono le Regole): la scena non consuma. */
  nascosta?: boolean;
}) {
  const { sessione } = p;
  useAggiornamenti(sessione);
  const [detentore, setDetentore] = useState<IdGiocatore | null>(null);
  const [scelto, setScelto] = useState<IdGiocatore | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  /** Il cassetto abbassato vale solo per la schermata in cui lo si è abbassato: cambiando schermata torna su. */
  const [abbassatoIn, setAbbassatoIn] = useState<string | null>(null);
  const teatro = useRef<Teatro | null>(null);
  const idCassetto = useId();
  const testata = useRef<HTMLDivElement>(null);
  const [spazioAlto, setSpazioAlto] = useState(SPAZIO_ALTO_RISERVA);

  const tavolo = sessione.vista(null);
  // Chi sta in basso nella scena: cambia solo con "Sono io" (le schermate pubbliche non lo spostano). Nella prova è sempre l'umano.
  const [giu, setGiu] = useState(() => ({ sessione, id: inBassoIniziale(tavolo) }));
  if (giu.sessione !== sessione) setGiu({ sessione, id: inBassoIniziale(tavolo) });
  const inBasso: IdGiocatore = p.umano ?? (giu.sessione === sessione ? giu.id : inBassoIniziale(tavolo));
  const prendiTelefono = (g: IdGiocatore) => {
    setDetentore(g);
    setGiu({ sessione, id: g });
  };
  const sc: Scena | ScenaProva = p.umano ? scenaProva(tavolo, p.umano) : scena(tavolo, scelto);
  const privata = sc.tipo === 'privata';
  const area = useRef<HTMLElement>(null);
  const chiaveScena = p.umano ? chiaveProva(tavolo, sc) : chiave(tavolo, sc);
  const passaggio = !p.umano && sc.tipo === 'privata' && detentore !== sc.giocatore;

  // Su telefono il pannello d'azione deve essere visibile senza cercarlo: ci si scorre a ogni cambio di schermata.
  useEffect(() => {
    if (!passaggio) area.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  }, [chiaveScena, passaggio]);

  // Il suggerimento dei gesti della scena va subito sotto la striscia in cima: se ne misura il fondo (cambia con la cronaca)
  useLayoutEffect(() => {
    const el = testata.current;
    if (!el) return;
    const misura = () => {
      const fondo = el.getBoundingClientRect().bottom;
      if (fondo > 0) setSpazioAlto(Math.ceil(fondo) + 1);
    };
    misura();
    return piattaforma.osservaMisura(el, misura);
  }, [passaggio]);

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

  // Niente sbirciate: la mano di chi sta in basso è scoperta solo nella sua schermata privata, col telefono in mano.
  // Nella prova c'è un solo umano sul dispositivo: la sua mano resta sempre scoperta
  const scoperta = p.umano !== undefined || (sc.tipo === 'privata' && sc.giocatore === inBasso && !passaggio);
  const mano = scoperta ? (sessione.vista(inBasso).giocatori.find((g) => g.id === inBasso)?.mano ?? null) : null;
  const foto = fotografia(tavolo, inBasso, mano);
  // La scena arriva in un pacchetto a parte: finché non c'è, il prato vuoto; se non arriva, "Riprova"
  const scenaPrato = <ScenaCaricata foto={foto} nascosta={p.nascosta} rifTeatro={teatro} />;

  if (passaggio && sc.tipo === 'privata') {
    return (
      <div className="partita con-scena">
        {scenaPrato}
        <PassaDispositivo v={tavolo} giocatore={sc.giocatore} onSonoIo={() => prendiTelefono(sc.giocatore)} />
      </div>
    );
  }

  const attivo = sc.tipo === 'privata' ? sc.giocatore : null;
  const v = attivo ? sessione.vista(attivo) : tavolo;
  const abbassato = abbassatoIn === chiaveScena;
  const aTuttaAltezza = !abbassato && !p.senzaAzioni && 'pannello' in sc && sc.pannello === 'testata';
  let pannello: React.ReactNode = null;
  if (sc.tipo === 'attesaBot') {
    pannello = (
      <div className="pannello">
        <p className="pensa">{T.prova.pensa(nome(tavolo, sc.giocatore))}</p>
      </div>
    );
  } else if (sc.tipo === 'automatica') {
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
    // Nella prova non c'è un elenco di nomi a cui tornare
    const indietro = p.umano ? undefined : () => setScelto(null);
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
    <div className="partita con-scena">
      {scenaPrato}
      {/* In cima una striscia sottile: le targhe degli avversari restano visibili */}
      <div className="testata-scena" ref={testata}>
        <Intestazione v={tavolo} onMenu={() => setMenu(true)} />
        <Cronaca v={tavolo} />
      </div>
      {/* In basso, sopra il prato: il consiglio della prova (o il riquadro finale) e il cassetto dei pannelli */}
      {/* Nel tiro del montone il cassetto prende tutta l'altezza sotto la striscia: il minigioco sta nello schermo senza scorrere */}
      <div
        className={`fondo-scena${aTuttaAltezza ? ' a-tutta-altezza' : ''}`}
        style={{ '--spazio-alto': `${spazioAlto}px` } as React.CSSProperties}
      >
        {p.testa && <div className="testa-scena">{p.testa}</div>}
        {!p.senzaAzioni && (
          <section className={`cassetto${abbassato ? ' abbassato' : ''}`}>
            <button
              type="button"
              className="maniglia"
              aria-expanded={!abbassato}
              aria-controls={idCassetto}
              onClick={() => setAbbassatoIn(abbassato ? null : chiaveScena)}
            >
              {abbassato ? T.scena.cassetto.alza : T.scena.cassetto.abbassa}
            </button>
            <div className="cassetto-contenuto" id={idCassetto} hidden={abbassato}>
              {errore && (
                <p className="errore" role="alert">
                  {errore}
                </p>
              )}
              <section className="area-azione" key={chiaveScena} ref={area} data-giocatore={attivo ?? undefined}>
                {pannello}
              </section>
            </div>
          </section>
        )}
      </div>
      {menu && (
        <Menu
          onRegole={() => {
            setMenu(false);
            p.onRegole();
          }}
          onEsci={p.onHome}
          onChiudi={() => setMenu(false)}
        >
          <h3 className="menu-sezione">{T.scena.opzioni.titolo}</h3>
          <OpzioniScena
            className="opzioni-menu"
            rivediSuggerimenti={() => teatro.current?.rivediSuggerimenti()}
            onChiudi={() => setMenu(false)}
          />
        </Menu>
      )}
    </div>
  );
}
