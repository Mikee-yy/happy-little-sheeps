// Partita su un solo dispositivo: la regia decide la schermata, la schermata di passaggio
// nasconde tutto finché il giocatore giusto non tocca "Sono io".
// Si gioca dentro la scena 2,5D (scena/): in basso c'è chi ha il telefono. Le scelte si fanno toccando la scena: Partita
// calcola il momento (schermo, vista, mosse permesse) e la fotografia con la mano giusta; la domanda, la scelta a metà, i
// gesti e la scritta nella striscia in cima stanno in GiocoInScena, comune con le stanze. Finché la scena non è pronta
// (si scarica, o non è arrivata) le scelte stanno nei pannelli di un cassetto, come prima.
// Mentre la scena recita le mosse ("occupata") la domanda, il cassetto, il "Passa il dispositivo" e la classifica aspettano.
import { useCallback, useEffect, useId, useReducer, useRef, useState } from 'react';
import type { Azione, IdGiocatore, Vista } from '../../../engine/src';
import type { Sessione } from '../../../sync/sessione';
import { Avatar, Pecora } from '../grafica';
import { fotografia, inBassoIniziale } from '../scena/fotografia';
import type { Momento, Pensiero } from '../scena/scelte/tipi';
import { OpzioniScena } from '../scena/OpzioniScena';
import type { Teatro } from '../scena/teatro';
import { GiocoInScena } from './GiocoInScena';
import { elenco, T } from '../testi';
import { Pulsante } from './componenti';
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

/**
 * Il pensiero nel riquadro in basso, quando la scena non c'è: com'era prima delle scelte nella scena. Con `finale` (sotto
 * il riquadro finale della prova non si gioca) il riquadro finale, con titolo e pulsanti larghi; altrimenti il consiglio,
 * con il suo pulsante secondario.
 */
function RiquadroPensiero({ p, finale }: { p: Pensiero; finale: boolean }) {
  if (finale) {
    return (
      <div className="fine-prova" role="status">
        {p.titolo && <h2>{p.titolo}</h2>}
        <p>{p.testo}</p>
        {p.pulsanti.map((b, i) => (
          <Pulsante key={i} largo secondario={b.secondario} onClick={b.azione}>
            {b.testo}
          </Pulsante>
        ))}
      </div>
    );
  }
  return (
    <div className="consiglio consiglio-riquadro" role="status">
      {p.titolo && <strong>{p.titolo}</strong>}
      <p>{p.testo}</p>
      {p.pulsanti.map((b, i) => (
        <Pulsante key={i} secondario onClick={b.azione}>
          {b.testo}
        </Pulsante>
      ))}
    </div>
  );
}

/** Chiave che cambia a ogni azione: i pannelli ripartono puliti (selezioni azzerate). */
// Nella prova i bot muovono mentre l'umano sceglie: la chiave non dipende dall'ultimo evento,
// se no ogni loro mossa rimonterebbe il pannello (carta deselezionata, pagina che scorre)
const chiaveProva = (v: Vista, sc: Scena | ScenaProva) =>
  `${v.round}-${v.fase.nome}-${v.pila.length}-${sc.tipo}-${'giocatore' in sc ? sc.giocatore : ''}-${'pannello' in sc ? sc.pannello : ''}`;
const chiave = (v: Vista, sc: Scena | ScenaProva) => `${v.eventi[v.eventi.length - 1]?.seq ?? 0}-${sc.tipo}-${'giocatore' in sc ? sc.giocatore : ''}`;

/**
 * `umano`: partita di prova, un solo umano sul dispositivo (niente passaggi, i bot pensano da soli).
 * `pensiero`: il consiglio della guida o il riquadro finale della prova, nella nuvoletta della propria pecora (senza scena
 * pronta nel riquadro in basso).
 */
export function Partita(p: {
  sessione: Sessione;
  onHome: () => void;
  onRigioca: () => void;
  onRegole: () => void;
  umano?: IdGiocatore;
  pensiero?: Pensiero | null;
  /** Niente domanda né pannello d'azione (sotto il riquadro finale della prova non si gioca). */
  senzaAzioni?: boolean;
  /** Partita montata ma non mostrata (la prova mentre si leggono le Regole): la scena non consuma. */
  nascosta?: boolean;
  /** Ai cambi di "la scena recita" (la prova mette in pausa i bot). */
  onScenaOccupata?: (occupata: boolean) => void;
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
  /** La scena sta recitando: il pannello dopo e il "Passa a" aspettano. Falso finché la scena non è montata. */
  const [scenaOccupata, setScenaOccupata] = useState(false);
  /** A partita finita la classifica compare solo a festa finita nella scena. */
  const [classifica, setClassifica] = useState(false);
  const suScenaOccupata = (o: boolean) => {
    setScenaOccupata(o);
    p.onScenaOccupata?.(o);
  };

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
  const fine = sc.tipo === 'fine';
  /** Cosa c'è sopra la scena: il "Passa a", la classifica finale (al posto della scena) o la striscia col cassetto. */
  const strato = fine && classifica ? 'classifica' : passaggio && !scenaOccupata && !fine ? 'passaggio' : 'tavolo';
  const conAzioni = strato === 'tavolo' && !scenaOccupata && !fine && !p.senzaAzioni;

  // Senza scena (riserva) il pannello d'azione deve essere visibile senza cercarlo: ci si scorre a ogni cambio di schermata.
  // Con la scena montata non c'è nessun pannello verso cui scorrere: lo si legge dal teatro, che c'è già al primo rendering
  // (prima che l'avviso "pronta" arrivi qui), così non si scorre verso il cassetto che sta per sparire
  useEffect(() => {
    if (!conAzioni || teatro.current !== null) return;
    area.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  }, [chiaveScena, conAzioni]);

  // La festa nella scena: la classifica aspetta che finisca. Si conta su Scena che usa effetti di layout: girano prima
  // degli effetti normali di Partita, quindi la scena ha già avuto la fotografia finale e il teatro sa già se recita,
  // anche se l'avviso (`onOccupato`) non è ancora arrivato qui. Se Scena tornasse a useEffect l'ordine figlio→genitore
  // reggerebbe ancora, ma è un legame da tenere.
  // Senza scena montata (in arrivo o non arrivata) la classifica compare subito.
  useEffect(() => {
    if (!fine) {
      setClassifica(false);
      return;
    }
    if (!scenaOccupata && !(teatro.current?.occupato() ?? false)) setClassifica(true);
  }, [fine, scenaOccupata]);

  // Le schermate pubbliche tolgono il dispositivo a chiunque: la prossima schermata privata chiede di nuovo "Sono io".
  useEffect(() => {
    if (!privata) setDetentore(null);
  }, [privata]);

  /** Manda la mossa alla sessione; restituisce se il motore l'ha accettata. */
  const invia = useCallback(
    (a: Azione): boolean => {
      const r = sessione.invia(a);
      if (r.ok) {
        setErrore(null);
        setScelto(null);
      } else {
        setErrore(T.errori.azione(r.messaggio));
      }
      return r.ok;
    },
    [sessione],
  );

  if (strato === 'classifica') {
    return <FinePartita v={tavolo} onRigioca={p.onRigioca} onHome={p.onHome} />;
  }

  // Niente sbirciate: la mano di chi sta in basso è scoperta solo nella sua schermata privata, col telefono in mano.
  // Nella prova c'è un solo umano sul dispositivo: la sua mano resta sempre scoperta
  const scoperta = p.umano !== undefined || (sc.tipo === 'privata' && sc.giocatore === inBasso && !passaggio);
  const mano = scoperta ? (sessione.vista(inBasso).giocatori.find((g) => g.id === inBasso)?.mano ?? null) : null;
  const foto = fotografia(tavolo, inBasso, mano);
  const attivo = sc.tipo === 'privata' ? sc.giocatore : null;

  // Il momento della domanda: lo schermo di adesso, la vista di chi agisce (con la sua mano) nelle schermate private,
  // le mosse permesse; le carte sono toccabili solo se la mano è scoperta nella fotografia (stessa regola)
  const chi = 'giocatore' in sc ? sc.giocatore : null;
  const momento: Momento = {
    vista: attivo ? sessione.vista(attivo) : tavolo,
    schermo: sc,
    azioni: chi ? sessione.azioni(chi) : [],
    sistema: sessione.azioni('sistema'),
    condiviso: !p.umano,
    manoScoperta: scoperta,
  };
  // Il pensiero della pecora in basso aspetta anche lui la scena libera; nella prova, mentre muove un bot, "X sta pensando…"
  const pensiero: Pensiero | null =
    strato !== 'tavolo' || scenaOccupata
      ? null
      : (p.pensiero ?? (sc.tipo === 'attesaBot' ? { testo: T.prova.pensa(nome(tavolo, sc.giocatore)), pulsanti: [] } : null));

  const abbassato = abbassatoIn === chiaveScena;
  // Il cassetto dei pannelli c'è solo senza scena pronta: GiocoInScena mostra la riserva solo allora
  const aTuttaAltezza = !abbassato && conAzioni && 'pannello' in sc && sc.pannello === 'testata';
  let pannello: React.ReactNode = null;
  if (!conAzioni) {
    // La scena recita (o festeggia la fine): niente pannello
  } else if (sc.tipo === 'attesaBot') {
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
    const v = sessione.vista(sc.giocatore);
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

  // In basso, sopra il prato, finché la scena non è pronta: il consiglio della prova (o il riquadro finale) e il cassetto
  // dei pannelli. Nel tiro del montone il cassetto prende tutta l'altezza sotto la striscia: il minigioco sta nello schermo
  // senza scorrere
  const riserva = (
    <>
      {/* Il consiglio della guida e il riquadro finale della prova stanno qui (con la scena nella nuvoletta) */}
      {p.pensiero && !scenaOccupata && (
        <div className="testa-scena">
          <RiquadroPensiero p={p.pensiero} finale={p.senzaAzioni === true} />
        </div>
      )}
      {conAzioni && (
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
    </>
  );

  const passa = strato === 'passaggio' && sc.tipo === 'privata';
  return (
    <div className="partita con-scena">
      <GiocoInScena
        tavolo={tavolo}
        foto={foto}
        momento={momento}
        conAzioni={conAzioni}
        invia={invia}
        errore={errore}
        togliErrore={() => setErrore(null)}
        suCambioDomanda={() => setErrore(null)}
        onRisponde={setScelto}
        onIndietro={() => setScelto(null)}
        onMenu={() => setMenu(true)}
        pensiero={pensiero}
        copertura={
          passa ? <PassaDispositivo v={tavolo} giocatore={sc.giocatore} onSonoIo={() => prendiTelefono(sc.giocatore)} /> : null
        }
        riserva={riserva}
        riservaATuttaAltezza={aTuttaAltezza}
        rifTeatro={teatro}
        onOccupato={suScenaOccupata}
        nascosta={p.nascosta}
        salvata={p.umano === undefined}
      />
      {/* Sotto il "Passa a" il menu non c'è (lo si riapre dopo "Sono io") */}
      {menu && !passa && (
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
