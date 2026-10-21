// Schermate della modalità a più dispositivi: creare o entrare in una stanza, sala d'attesa, partita sul proprio
// telefono, pausa, vista tavolo da proiettare.
// La partita sul proprio telefono si gioca dentro la scena 2,5D (GiocoInScena, come su un dispositivo): in basso la propria
// pecora con la mano sempre scoperta, mai quella degli altri; le scelte si fanno toccando la scena; nella striscia in cima
// la domanda, chi si aspetta o la fase che prosegue da sola, e il conto alla rovescia. Finché la scena non è pronta (si
// scarica, o non arriva) si gioca coi pannelli di prima, in un cassetto.
import qrcode from 'qrcode-generator';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { SETUP } from '../../../engine/src';
import type { Azione, IdGiocatore, IdPecora, Vista } from '../../../engine/src';
import { SessioneHost } from '../../../sync/host';
import { SeiHostDellaStanza, SessioneOspite, StanzaInesistente } from '../../../sync/ospite';
import type { SessioneTavolo } from '../../../sync/ospite';
import { normalizzaCodice, nuovoGettone } from '../../../sync/stanza';
import type { Iscrizione, Pubblico } from '../../../sync/stanza';
import { Avatar } from '../grafica';
import { Cronaca, Mano, Pulsante, Riepilogo } from '../partita/componenti';
import { GiocoInScena } from '../partita/GiocoInScena';
import { ScenaCaricata } from '../partita/ScenaCaricata';
import { fotografia } from '../scena/fotografia';
import { OpzioniScena } from '../scena/OpzioniScena';
import type { Teatro } from '../scena/teatro';
import {
  PannelloAutomatico,
  PannelloBelatoFinale,
  PannelloConsolazione,
  PannelloDichiarazione,
  PannelloEffetto,
  PannelloLancio,
  PannelloPunteggio,
  PannelloReazione,
  PannelloRichiesta,
  PannelloSalvataggio,
  PannelloScelta,
} from '../partita/pannelli';
import { FinePartita, Menu, useAggiornamenti } from '../partita/Partita';
import { Intestazione, Tavolo } from '../partita/Tavolo';
import { Testata } from '../partita/Testata';
import { Riassunto } from '../schermate';
import { T } from '../testi';
import { archivioHost, connetti, leggiIscrizione, linkStanza, linkTavolo, salvaIscrizione, segnaInStanza } from './connessione';
import { ospita, precaricaStanza } from './durataStanza';
import { momentoRemoto, scenaRemota, scrittaAttesa } from './regiaRemota';
import type { ScenaRemota } from './regiaRemota';

type SessioneStanza = SessioneHost | SessioneOspite;

const PECORE = SETUP.pecore.map((p) => p.id);

function nuovoSeme(): number {
  const a = new Uint32Array(1);
  globalThis.crypto.getRandomValues(a);
  return a[0] ?? 1;
}

function preferenza(chiave: string, iniziale: boolean): [boolean, (v: boolean) => void] {
  const leggi = () => {
    try {
      const v = globalThis.localStorage?.getItem(chiave);
      return v === null || v === undefined ? iniziale : v === '1';
    } catch {
      return iniziale;
    }
  };
  const [valore, setValore] = useState(leggi);
  const imposta = (v: boolean) => {
    setValore(v);
    try {
      globalThis.localStorage?.setItem(chiave, v ? '1' : '0');
    } catch {
      // Preferenza solo per questa visita.
    }
  };
  return [valore, imposta];
}

// ─── Piccoli componenti ──────────────────────────────────────────────────────

export function CodiceQR({ testo, size = 176 }: { testo: string; size?: number }) {
  const qr = useMemo(() => {
    const q = qrcode(0, 'M');
    q.addData(testo);
    q.make();
    return q;
  }, [testo]);
  const n = qr.getModuleCount();
  const margine = 2;
  const celle: React.ReactNode[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) if (qr.isDark(r, c)) celle.push(<rect key={`${r}-${c}`} x={c + margine} y={r + margine} width={1.02} height={1.02} />);
  }
  return (
    <svg className="qr" viewBox={`0 0 ${n + margine * 2} ${n + margine * 2}`} width={size} height={size} role="img" aria-label={testo}>
      <rect width="100%" height="100%" className="qr-fondo" />
      <g className="qr-moduli">{celle}</g>
    </svg>
  );
}

function SceltaPecora(p: { valore: IdPecora; occupate?: IdPecora[]; onScegli: (x: IdPecora) => void }) {
  return (
    <div className="scelta-pecora" role="radiogroup" aria-label={T.stanza.laTuaPecora}>
      {PECORE.map((pc) => {
        const occupata = p.occupate?.includes(pc) && pc !== p.valore;
        return (
          <button
            key={pc}
            type="button"
            role="radio"
            aria-checked={p.valore === pc}
            disabled={occupata}
            className={p.valore === pc ? 'scelta attiva' : 'scelta'}
            onClick={() => p.onScegli(pc)}
          >
            <Avatar pecora={pc} size={40} titolo={SETUP.pecore.find((x) => x.id === pc)?.nome} />
          </button>
        );
      })}
    </div>
  );
}

/**
 * La barra del tempo per reagire. La scadenza (ora del servizio) comprende la recita normale della mossa: finché manca più
 * della finestra (`totale` secondi) la barra è piena e ferma, poi scende fino alla scadenza.
 */
export function ContoAllaRovescia({ scadenza, ora, totale }: { scadenza: number; ora: () => number; totale: number }) {
  const [adesso, setAdesso] = useState(ora);
  useEffect(() => {
    const id = setInterval(() => setAdesso(ora()), 200);
    return () => clearInterval(id);
  }, [ora]);
  const finestra = totale * 1000;
  const resto = Math.max(0, scadenza - adesso);
  const fermo = resto > finestra;
  const visibile = Math.min(resto, finestra);
  return (
    <div className={`conto${fermo ? ' fermo' : ''}`} role="timer" aria-live="off">
      <div className="conto-barra" style={{ width: `${finestra > 0 ? (visibile / finestra) * 100 : 0}%` }} />
      <span>{T.stanza.tempo(Math.ceil(visibile / 1000))}</span>
    </div>
  );
}

// ─── Creare o entrare ───────────────────────────────────────────────────────

function nomeRicordato(): string {
  try {
    return globalThis.localStorage?.getItem('hls-nome') ?? '';
  } catch {
    return '';
  }
}

export function ModuloStanza(p: {
  modo: 'crea' | 'entra';
  codiceIniziale?: string;
  onDentro: (s: SessioneStanza, i: Iscrizione) => void;
  onIndietro: () => void;
}) {
  const [nomeG, setNome] = useState(nomeRicordato);
  const [pecora, setPecora] = useState<IdPecora>(p.modo === 'crea' ? 'ricciolo' : 'brontolana');
  const [codice, setCodice] = useState(p.codiceIniziale ?? '');
  const [occupato, setOccupato] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const codiceOk = p.modo === 'crea' || normalizzaCodice(codice) !== null;
  const pronto = nomeG.trim().length > 0 && codiceOk && !occupato;

  const invia = async () => {
    setOccupato(true);
    setErrore(null);
    // La scena (e la durata delle sue recite, per chi ospita) comincia a scaricarsi: di solito arriva in sala d'attesa
    precaricaStanza();
    try {
      globalThis.localStorage?.setItem('hls-nome', nomeG.trim());
    } catch {
      // Non indispensabile.
    }
    try {
      const t = await connetti();
      const gettone = nuovoGettone();
      if (p.modo === 'crea') {
        const s = await ospita((o) => SessioneHost.crea(t, archivioHost(), { nome: nomeG, pecora, gettone }, undefined, o));
        p.onDentro(s, { codice: s.codice, ruolo: 'host', idGiocatore: 'g1', nome: nomeG.trim(), pecora, gettone });
      } else {
        const c = normalizzaCodice(codice)!;
        const salvata = leggiIscrizione();
        if (salvata?.codice === c && salvata.ruolo === 'ospite') {
          // Si torna nella stessa stanza: stesso gettone, così il posto resta suo anche con un'identità nuova.
          const i = { ...salvata, nome: nomeG.trim(), pecora };
          p.onDentro(await SessioneOspite.rientra(t, i), i);
          return;
        }
        try {
          const s = await SessioneOspite.entra(t, c, { nome: nomeG.trim(), pecora, gettone });
          p.onDentro(s, { codice: c, ruolo: 'ospite', idGiocatore: null, nome: nomeG.trim(), pecora, gettone });
        } catch (e) {
          if (!(e instanceof SeiHostDellaStanza)) throw e;
          // Chi ha creato la stanza riapre il link: riprende il ruolo di host, non entra come ospite.
          const host = await ospita((o) => SessioneHost.riprendi(t, archivioHost(), o));
          if (!host || host.codice !== c) throw new Error(T.stanza.hostAltrove);
          p.onDentro(host, host.iscrizione());
        }
      }
    } catch (e) {
      setErrore(e instanceof StanzaInesistente ? T.stanza.inesistente : T.stanza.erroreRete(e instanceof Error ? e.message : String(e)));
      setOccupato(false);
    }
  };

  return (
    <main className="preparazione">
      <h1>{p.modo === 'crea' ? T.stanza.creaTitolo : T.stanza.entraTitolo}</h1>
      {p.modo === 'entra' && (
        <label className="campo">
          <span className="etichetta">{T.stanza.codice}</span>
          <input
            className="input-codice"
            value={codice}
            maxLength={6}
            autoCapitalize="characters"
            autoComplete="off"
            placeholder={T.stanza.codiceSegnaposto}
            onChange={(e) => setCodice(e.target.value.toUpperCase())}
          />
          {codice.length > 0 && !codiceOk && <span className="aiuto">{T.stanza.codiceNonValido}</span>}
        </label>
      )}
      <label className="campo">
        <span className="etichetta">{T.stanza.tuoNome}</span>
        <input value={nomeG} maxLength={16} onChange={(e) => setNome(e.target.value)} />
      </label>
      <div className="campo">
        <span className="etichetta">{T.stanza.laTuaPecora}</span>
        <SceltaPecora valore={pecora} onScegli={setPecora} />
      </div>
      {errore && <p className="errore">{errore}</p>}
      {occupato && <p className="aiuto">{T.stanza.collegamento}</p>}
      <Pulsante largo disabled={!pronto} onClick={invia}>
        {p.modo === 'crea' ? T.stanza.crea : T.stanza.entra}
      </Pulsante>
      <Pulsante largo secondario onClick={p.onIndietro}>
        {T.preparazione.indietro}
      </Pulsante>
    </main>
  );
}

// ─── Sala d'attesa ──────────────────────────────────────────────────────────

function SalaAttesa({
  sessione,
  iscrizione,
  onEsci,
  onRegole,
}: {
  sessione: SessioneStanza;
  iscrizione: Iscrizione;
  onEsci: () => void;
  onRegole: () => void;
}) {
  const pub = sessione.pubblico()!;
  const host = sessione instanceof SessioneHost ? sessione : null;
  const io = host ? host.idGiocatore : (sessione as SessioneOspite).io;
  const [copiato, setCopiato] = useState(false);
  const link = linkStanza(iscrizione.codice);
  const mio = pub.giocatori.find((g) => g.id === io);
  const occupate = pub.giocatori.filter((g) => g.id !== io).map((g) => g.pecora);
  const rifiuto = sessione instanceof SessioneOspite ? sessione.rifiuto() : null;

  const copia = async () => {
    try {
      await globalThis.navigator.clipboard.writeText(link);
      setCopiato(true);
    } catch {
      setCopiato(false);
    }
  };
  const condividi = () => void globalThis.navigator.share?.({ title: T.titolo, text: T.stanza.inquadra, url: link }).catch(() => undefined);
  const scegliPecora = (pc: IdPecora) => {
    if (host) host.aggiornaHost(mio?.nome ?? iscrizione.nome, pc);
    else void (sessione as SessioneOspite).cambia({ pecora: pc });
    salvaIscrizione({ ...iscrizione, pecora: pc });
  };

  return (
    <main className="sala">
      <h1>{T.stanza.salaTitolo}</h1>
      <div className="codice-box">
        <span className="etichetta">{T.stanza.codiceStanza}</span>
        <strong className="codice-grande">{iscrizione.codice}</strong>
        <CodiceQR testo={link} />
        <p className="aiuto">{T.stanza.inquadra}</p>
        <div className="scelte-nomi">
          <Pulsante secondario onClick={copia}>
            {copiato ? T.stanza.copiato : T.stanza.copiaLink}
          </Pulsante>
          {'share' in globalThis.navigator && (
            <Pulsante secondario onClick={condividi}>
              {T.stanza.condividi}
            </Pulsante>
          )}
        </div>
      </div>
      <div className="etichetta">{T.stanza.giocatori(pub.giocatori.length)}</div>
      <ul className="lista-giocatori">
        {pub.giocatori.map((g) => {
          const online = g.id === pub.host && sessione instanceof SessioneOspite ? sessione.hostOnline() : g.online;
          return (
            <li key={g.id} className={online ? '' : 'scollegato'}>
              <Avatar pecora={g.pecora} size={32} />
              <strong>{g.nome}</strong>
              {g.id === pub.host && <span className="pillola">{T.stanza.host}</span>}
              {g.id === io && <span className="pillola">{T.stanza.tu}</span>}
              {!online && <span className="pillola">{T.stanza.offline}</span>}
              {host && g.id !== pub.host && (
                <button type="button" className="link togli" onClick={() => host.togliDallaSala(g.id)}>
                  {T.stanza.togli}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {mio ? (
        <div className="campo">
          <span className="etichetta">{T.stanza.laTuaPecora}</span>
          <SceltaPecora valore={mio.pecora} occupate={occupate} onScegli={scegliPecora} />
        </div>
      ) : (
        <p className="aiuto">{rifiuto?.messaggio ?? T.stanza.aspettaIngresso}</p>
      )}
      {host ? (
        <>
          <label className="campo">
            <span className="etichetta">{T.stanza.timer}</span>
            <select value={pub.impostazioni.finestraSecondi} onChange={(e) => host.impostaFinestra(Number(e.target.value))}>
              {[4, 6, 8, 10, 15].map((s) => (
                <option key={s} value={s}>
                  {T.stanza.secondi(s)}
                </option>
              ))}
            </select>
          </label>
          {!host.puoIniziare() && <p className="aiuto">{T.stanza.servonoDue}</p>}
          <Pulsante largo disabled={!host.puoIniziare()} onClick={() => host.inizia(nuovoSeme())}>
            {T.stanza.inizia}
          </Pulsante>
          <a className="link-tavolo" href={linkTavolo(iscrizione.codice)} target="_blank" rel="noreferrer">
            {T.stanza.vistaTavolo}
          </a>
        </>
      ) : (
        mio && <p className="aiuto">{T.stanza.aspettaHost}</p>
      )}
      <Pulsante largo secondario onClick={onEsci}>
        {T.stanza.esci}
      </Pulsante>
      <Riassunto onRegole={onRegole} />
    </main>
  );
}

// ─── Partita sul proprio telefono ───────────────────────────────────────────

function Pausa(p: {
  pub: Pubblico;
  host: SessioneHost | null;
  hostAssente: boolean;
  scollegato: boolean;
  onRegole: () => void;
  onEsci: () => void;
}) {
  const { pub, host, hostAssente } = p;
  const nomeDi = (id: IdGiocatore) => pub.giocatori.find((g) => g.id === id)?.nome ?? id;
  return (
    <div className="velo" role="alertdialog" aria-modal="true" aria-label={T.stanza.pausaTitolo}>
      <div className="menu">
        <h2>{T.stanza.pausaTitolo}</h2>
        {p.scollegato ? (
          <p>{T.stanza.connessionePersa}</p>
        ) : hostAssente ? (
          <p>{T.stanza.hostAssente(nomeDi(pub.host))}</p>
        ) : (
          <p>{T.stanza.pausaManca(pub.pausa.map(nomeDi).join(', '))}</p>
        )}
        {host &&
          !p.scollegato &&
          pub.pausa.map((id) => (
            <Pulsante key={id} largo secondario onClick={() => host.sostituisciConBot(id)}>
              {T.stanza.sostituisci(nomeDi(id))}
            </Pulsante>
          ))}
        <Pulsante largo secondario onClick={p.onRegole}>
          {T.menu.regole}
        </Pulsante>
        <Pulsante largo secondario onClick={p.onEsci}>
          {T.stanza.esci}
        </Pulsante>
      </div>
    </div>
  );
}

/** Nei pannelli di riserva, quando tocca agli altri: chi si aspetta (come nella striscia), il riepilogo e la propria mano. */
function PannelloAttesa({ v, sc, io }: { v: Vista; sc: Extract<ScenaRemota, { tipo: 'attesa' }>; io: IdGiocatore }) {
  const mano = v.giocatori.find((g) => g.id === io)?.mano ?? [];
  return (
    <div className="pannello">
      <div className="pannello-titolo">
        <h2>{scrittaAttesa(sc, v)}</h2>
      </div>
      <Riepilogo v={v} />
      {mano.length > 0 && <Mano carte={mano} />}
    </div>
  );
}

/**
 * La situazione di `io` sul suo telefono: cambia quando cambia qualcosa per lui (schermo, mosse permesse, la sua scelta,
 * la finestra, la sua richiesta, il suo posto e la sua mano), non quando un altro fa una mossa che non lo tocca. Una mossa
 * mandata a chi ospita resta "in attesa" finché la situazione non cambia (o arriva un rifiuto).
 */
function situazioneDi(v: Vista, io: IdGiocatore, sc: ScenaRemota, azioni: Azione[]): string {
  const f = v.fase;
  return JSON.stringify([
    sc,
    azioni,
    v.round,
    f.nome,
    'miaScelta' in f ? f.miaScelta : null,
    v.finestra?.voce ?? null,
    v.attesa.giocatori.includes(io),
    v.richiesta?.giocatore === io ? v.richiesta : null,
    v.giocatori.find((g) => g.id === io) ?? null,
  ]);
}

/** Tempo massimo di una mossa in attesa di chi ospita: poi la scelta si sblocca comunque (ultima risorsa). */
const ATTESA_MASSIMA_MS = 4000;

function PartitaRemota(p: { sessione: SessioneStanza; io: IdGiocatore; onEsci: () => void; onRegole: () => void }) {
  const { sessione, io } = p;
  const host = sessione instanceof SessioneHost ? sessione : null;
  const ospite = sessione instanceof SessioneOspite ? sessione : null;
  const pub = sessione.pubblico()!;
  /** La vista privata (con la propria mano) e quella del tavolo, che la scena recita. */
  const v = sessione.vista(io);
  const tavolo = sessione.vista(null);
  const azioni = sessione.azioni(io);
  const sc = scenaRemota(v, io, azioni);
  const [menu, setMenu] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [passaDaSolo, setPassaDaSolo] = preferenza('hls-passa-da-solo', false);
  const [aperta] = useState(() => sessione.ora());
  const [rifiutoNascosto, setRifiutoNascosto] = useState(0);
  /** Il cassetto della riserva abbassato vale solo per la schermata in cui lo si è abbassato. */
  const [abbassatoIn, setAbbassatoIn] = useState<string | null>(null);
  const idCassetto = useId();
  const teatro = useRef<Teatro | null>(null);
  /** La scena sta recitando: la domanda e la classifica aspettano. */
  const [scenaOccupata, setScenaOccupata] = useState(false);
  /** A partita finita la classifica compare solo a festa finita nella scena. */
  const [classifica, setClassifica] = useState(false);
  /** Mosse rimaste in attesa più di ATTESA_MASSIMA_MS: ognuna sblocca la scelta (vedi `sblocca`). */
  const [scadute, setScadute] = useState(0);
  /** La mossa partita per chi ospita: la situazione e lo sblocco di quando è partita. */
  const [inviata, setInviata] = useState<{ situazione: string; sblocca: number } | null>(null);
  const ora = useCallback(() => sessione.ora(), [sessione]);

  // Rifiuti di chi ospita (solo sugli ospiti: le mosse di chi ospita si applicano subito); quelli di prima di aprire la
  // partita non contano
  const ultimoRifiuto = ospite?.rifiuto() ?? null;
  const rifiutoDopo = ultimoRifiuto && ultimoRifiuto.quando > aperta ? ultimoRifiuto : null;
  const rifiuto = rifiutoDopo && rifiutoDopo.quando > rifiutoNascosto ? rifiutoDopo : null;
  useEffect(() => {
    if (!rifiuto) return;
    const t = setTimeout(() => setRifiutoNascosto(rifiuto.quando), 5000);
    return () => clearTimeout(t);
  }, [rifiuto]);

  // Punto di revisione 4: cambia a ogni rifiuto (e a ogni attesa scaduta); la scelta riparte vuota e i gesti tornano validi
  const sblocca = (rifiutoDopo?.quando ?? 0) + scadute;
  // La generazione della situazione: cresce a ogni suo cambio, così una situazione che torna uguale a una di prima (passo
  // nei Belati di punteggio, un altro gioca un Belato, la finestra scade e si riapre) è comunque nuova e non resta bloccata
  const testoSituazione = situazioneDi(v, io, sc, azioni);
  const [generazione, setGenerazione] = useState({ testo: testoSituazione, n: 0 });
  if (generazione.testo !== testoSituazione) setGenerazione({ testo: testoSituazione, n: generazione.n + 1 });
  const situazione = String(generazione.testo === testoSituazione ? generazione.n : generazione.n + 1);
  // Sul telefono di un ospite la risposta di chi ospita arriva dopo un attimo: niente doppie mosse nel frattempo, anche
  // se intanto arrivano le mosse degli altri
  const inAttesa = inviata !== null && inviata.situazione === situazione && inviata.sblocca === sblocca;
  useEffect(() => {
    if (!inAttesa) return;
    const t = setTimeout(() => setScadute((n) => n + 1), ATTESA_MASSIMA_MS);
    return () => clearTimeout(t);
  }, [inAttesa]);

  // Situazione e sblocco di questo disegno, letti da `invia` al momento dell'invio
  const attuale = useRef({ situazione, sblocca });
  attuale.current = { situazione, sblocca };
  /** Come `inviata`, ma letta subito (anche da un timer già partito): è il segno "mossa inviata" che blocca ogni altro invio. */
  const inviataOra = useRef<{ situazione: string; sblocca: number } | null>(null);
  const mossaInAttesa = () => {
    const i = inviataOra.current;
    return i !== null && i.situazione === attuale.current.situazione && i.sblocca === attuale.current.sblocca;
  };
  /**
   * Manda la mossa; restituisce se è partita (per gli ospiti l'esito vero arriva dopo: un rifiuto, o la vista nuova).
   * Stabile tra un disegno e l'altro: la Testata e il dado della riserva la attendono in un effetto, e una funzione nuova
   * a ogni disegno farebbe ripartire (e raddoppiare) il loro invio mentre si aspetta chi ospita.
   */
  const invia = useCallback(
    (a: Azione): boolean => {
      const r = sessione.invia(a);
      setErrore(r.ok ? null : T.errori.azione(r.messaggio));
      if (r.ok && sessione instanceof SessioneOspite) {
        inviataOra.current = { ...attuale.current };
        setInviata({ ...attuale.current });
      }
      return r.ok;
    },
    [sessione],
  );

  // "Passa sempre se non ho niente da giocare" (brief §5): evita attese inutili nelle finestre di reazione.
  const soloPassa = azioni.length === 1 && azioni[0]!.tipo === 'passa' && sc.tipo === 'pannello' && (sc.pannello === 'reazione' || sc.pannello === 'punteggio');
  const chiaveFinestra = `${v.round}-${v.fase.nome}-${v.finestra?.voce ?? ''}-${v.pila.length}-${v.eventi[v.eventi.length - 1]?.seq ?? 0}`;
  useEffect(() => {
    if (!passaDaSolo || !soloPassa) return;
    // Passa dallo stesso segno "mossa inviata" del tocco: se una mossa è già in attesa di chi ospita non parte
    const t = setTimeout(() => {
      if (!mossaInAttesa()) invia(azioni[0]!);
    }, 400);
    return () => clearTimeout(t);
    // Una volta per finestra: la chiave cambia a ogni nuova dichiarazione.
  }, [passaDaSolo, soloPassa, chiaveFinestra]);

  const hostAssente = ospite !== null && !ospite.hostOnline();
  const scollegato = !sessione.online();
  const inPausa = pub.pausa.length > 0 || hostAssente || scollegato;
  const fine = sc.tipo === 'fine';

  // La festa nella scena: la classifica aspetta che finisca (come nella partita su un dispositivo; vedi Partita.tsx: gli
  // effetti di layout di Scena girano prima di questo, quindi il teatro sa già se recita la fine). Senza scena, subito.
  useEffect(() => {
    if (!fine) {
      setClassifica(false);
      return;
    }
    if (!scenaOccupata && !(teatro.current?.occupato() ?? false)) setClassifica(true);
  }, [fine, scenaOccupata]);

  if (fine && classifica) {
    return (
      <FinePartita
        v={tavolo}
        onHome={p.onEsci}
        onRigioca={host ? () => host.tornaInSala() : undefined}
        testoRigioca={T.stanza.rivincita}
        nota={host ? undefined : T.stanza.aspettaRivincita}
      />
    );
  }

  // Il telefono è suo: in basso la sua pecora, con la mano sempre scoperta (mai quella degli altri: viene dalla sua vista)
  const foto = fotografia(tavolo, io, v.giocatori.find((g) => g.id === io)?.mano ?? null);
  const momento = momentoRemoto(sc, io, v, tavolo, azioni);
  const conAzioni = !inPausa && !scenaOccupata && !fine;
  const messaggio = errore ?? rifiuto?.messaggio ?? null;
  const togliErrore = () => {
    setErrore(null);
    if (rifiuto) setRifiutoNascosto(rifiuto.quando);
  };

  // La striscia senza domanda: chi si aspetta, o la fase che prosegue da sola; altrimenti la cronaca. Con l'errore (o il
  // rifiuto di chi ospita) sotto
  const testoStriscia = sc.tipo === 'attesa' ? scrittaAttesa(sc, tavolo) : sc.tipo === 'automatica' ? T.fasi[tavolo.fase.nome] : null;
  const striscia = testoStriscia ? (
    <div className="scritta-scena" role="status">
      <p className="scritta">{testoStriscia}</p>
      {sc.tipo === 'automatica' && <p>{T.stanza.prosegue}</p>}
      {messaggio && <p className="errore">{messaggio}</p>}
    </div>
  ) : (
    <>
      <Cronaca v={tavolo} />
      {messaggio && (
        <div className="scritta-scena" role="alert">
          <p className="errore">{messaggio}</p>
        </div>
      )}
    </>
  );
  // Il tempo per reagire, per chi può rispondere e per chi aspetta
  const conto =
    pub.scadenza !== null && !fine ? <ContoAllaRovescia scadenza={pub.scadenza} ora={ora} totale={pub.impostazioni.finestraSecondi} /> : null;

  // La riserva, finché la scena non è pronta: i pannelli di prima, in un cassetto
  const reazione = sc.tipo === 'pannello' && (sc.pannello === 'reazione' || sc.pannello === 'punteggio');
  let pannello: React.ReactNode;
  if (sc.tipo === 'fine') {
    pannello = null;
  } else if (sc.tipo === 'automatica') {
    const prosegui = host ? host.azioni('sistema').find((a) => a.tipo === 'prosegui') : undefined;
    pannello = <PannelloAutomatico v={v} onContinua={prosegui ? () => invia(prosegui) : undefined} />;
  } else if (sc.tipo === 'attesa') {
    pannello = <PannelloAttesa v={v} sc={sc} io={io} />;
  } else {
    const props = { v, giocatore: io, azioni, invia };
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
        pannello = <PannelloReazione {...props} manoIntera />;
        break;
      case 'punteggio':
        pannello = <PannelloPunteggio {...props} manoIntera />;
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
  const abbassato = abbassatoIn === chiaveFinestra;
  // Nel tiro del montone il cassetto prende tutta l'altezza sotto la striscia
  const aTuttaAltezza = !abbassato && sc.tipo === 'pannello' && sc.pannello === 'testata';
  const riserva = fine ? null : (
    <section className={`cassetto${abbassato ? ' abbassato' : ''}`}>
      <button
        type="button"
        className="maniglia"
        aria-expanded={!abbassato}
        aria-controls={idCassetto}
        onClick={() => setAbbassatoIn(abbassato ? null : chiaveFinestra)}
      >
        {abbassato ? T.scena.cassetto.alza : T.scena.cassetto.abbassa}
      </button>
      <div className="cassetto-contenuto" id={idCassetto} hidden={abbassato}>
        <section className={`area-azione${inAttesa ? ' bloccata' : ''}`} key={chiaveFinestra}>
          {pannello}
          {reazione && (
            <label className="opzione">
              <input type="checkbox" checked={passaDaSolo} onChange={(e) => setPassaDaSolo(e.target.checked)} />
              {T.stanza.passaDaSolo}
            </label>
          )}
        </section>
      </div>
    </section>
  );

  return (
    <div className="partita con-scena">
      <GiocoInScena
        tavolo={tavolo}
        foto={foto}
        momento={momento}
        conAzioni={conAzioni}
        invia={invia}
        errore={messaggio}
        togliErrore={togliErrore}
        suCambioDomanda={() => setErrore(null)}
        onMenu={() => setMenu(true)}
        inStriscia={conto}
        strisciaSenzaDomanda={striscia}
        riserva={riserva}
        riservaATuttaAltezza={aTuttaAltezza}
        rifTeatro={teatro}
        onOccupato={setScenaOccupata}
        sblocca={sblocca}
        situazione={situazione}
      />
      {inPausa && (
        <Pausa pub={pub} host={host} hostAssente={hostAssente} scollegato={scollegato} onRegole={p.onRegole} onEsci={p.onEsci} />
      )}
      {menu && (
        <Menu
          onRegole={() => {
            setMenu(false);
            p.onRegole();
          }}
          onEsci={p.onEsci}
          onChiudi={() => setMenu(false)}
        >
          <label className="opzione">
            <input type="checkbox" checked={passaDaSolo} onChange={(e) => setPassaDaSolo(e.target.checked)} />
            {T.stanza.passaDaSolo}
          </label>
          <h3 className="menu-sezione">{T.scena.opzioni.titolo}</h3>
          <OpzioniScena className="opzioni-menu" rivediSuggerimenti={() => teatro.current?.rivediSuggerimenti()} onChiudi={() => setMenu(false)} />
        </Menu>
      )}
    </div>
  );
}

// ─── Contenitore ────────────────────────────────────────────────────────────

/** Tiene acceso lo schermo finché si è nella stanza, dove il browser lo permette: se il telefono dell'host
 * si spegne, il browser sospende il gioco per tutti. */
function useSchermoAcceso(): void {
  useEffect(() => {
    type Blocco = { release(): Promise<void> };
    const wl = (globalThis.navigator as unknown as { wakeLock?: { request(t: 'screen'): Promise<Blocco> } }).wakeLock;
    if (!wl) return;
    let blocco: Blocco | null = null;
    let attivo = true;
    const chiedi = () => {
      if (document.visibilityState !== 'visible') return;
      void wl
        .request('screen')
        .then((b) => {
          if (attivo) blocco = b;
          else void b.release();
        })
        .catch(() => undefined);
    };
    chiedi();
    document.addEventListener('visibilitychange', chiedi);
    return () => {
      attivo = false;
      document.removeEventListener('visibilitychange', chiedi);
      void blocco?.release().catch(() => undefined);
    };
  }, []);
}

export function Stanza(p: { sessione: SessioneStanza; iscrizione: Iscrizione; onEsci: () => void; onRegole: () => void }) {
  const { sessione } = p;
  useAggiornamenti(sessione);
  useSchermoAcceso();
  const [iscrizione, setIscrizione] = useState(p.iscrizione);
  const io = sessione instanceof SessioneHost ? sessione.idGiocatore : sessione.io;

  useEffect(() => {
    segnaInStanza(iscrizione.codice);
  }, [iscrizione.codice]);

  // L'ospite scopre il suo posto quando l'host lo fa entrare: lo ricorda per rientrare.
  useEffect(() => {
    if (io && io !== iscrizione.idGiocatore) {
      const nuova = { ...iscrizione, idGiocatore: io };
      setIscrizione(nuova);
      salvaIscrizione(nuova);
    }
  }, [io, iscrizione]);

  const pub = sessione.pubblico();
  const messaggio = (testo: string) => (
    <main className="passaggio">
      <p>{testo}</p>
      <Pulsante largo secondario onClick={p.onEsci}>
        {T.stanza.esci}
      </Pulsante>
    </main>
  );
  if (sessione instanceof SessioneHost && sessione.sostituita()) return messaggio(T.stanza.altraScheda);
  if (!pub) return messaggio(T.stanza.collegamento);
  // Arrivato a partita iniziata senza un posto: rifiuto dell'host (o attesa) e un'uscita.
  if (pub.fase === 'partita' && !io) {
    return messaggio(sessione instanceof SessioneOspite ? (sessione.rifiuto()?.messaggio ?? T.stanza.giaIniziata) : T.stanza.giaIniziata);
  }
  if (pub.fase === 'attesa' || !io) return <SalaAttesa sessione={sessione} iscrizione={iscrizione} onEsci={p.onEsci} onRegole={p.onRegole} />;
  if (sessione instanceof SessioneOspite && !sessione.pronta()) return messaggio(T.stanza.collegamento);
  return <PartitaRemota sessione={sessione} io={io} onEsci={p.onEsci} onRegole={p.onRegole} />;
}

/** Il proiettore non ha chi tocca "Riprova" (è sotto il tavolo di prima): se la scena non arriva ritenta da solo. */
const RIPROVA_PROIETTORE_MS = 5000;

/**
 * Vista tavolo senza mani, da proiettare (brief §5): la scena che recita tutte le mosse, senza mano, senza domande e senza
 * conto alla rovescia; in basso la pecora del primo giocatore; in alto la cronaca. Se la scena non c'è (si scarica, o non
 * arriva) il tavolo di prima.
 */
export function VistaTavolo({ sessione, onEsci }: { sessione: SessioneTavolo; onEsci: () => void }) {
  useAggiornamenti(sessione);
  const [scenaPronta, setScenaPronta] = useState(false);
  const v = sessione.vista();
  if (!v) return <main className="passaggio">{T.stanza.aspettaHost}</main>;
  // Il proiettore non mostra mai una mano: la fotografia non ne ha
  const foto = fotografia(v, v.giocatori[0]!.id, null);
  return (
    <div className="partita con-scena tavolo-proiettore">
      <ScenaCaricata foto={foto} vista={v} onPronto={setScenaPronta} riprovaDopoMs={RIPROVA_PROIETTORE_MS} />
      <div className="testata-scena">
        <Intestazione v={v} onMenu={onEsci} />
        <Cronaca v={v} quanti={5} />
      </div>
      {!scenaPronta && (
        <div className="riserva-proiettore">
          <Tavolo v={v} attivo={null} />
          <Riepilogo v={v} />
        </div>
      )}
    </div>
  );
}
