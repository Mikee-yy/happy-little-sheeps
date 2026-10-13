// Schermate della modalità a più dispositivi: creare o entrare in una stanza, sala d'attesa, partita sul proprio
// telefono, pausa, vista tavolo da proiettare.
import qrcode from 'qrcode-generator';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { SETUP } from '../../../engine/src';
import type { Azione, IdGiocatore, IdPecora, Vista } from '../../../engine/src';
import { SessioneHost } from '../../../sync/host';
import { SeiHostDellaStanza, SessioneOspite, StanzaInesistente } from '../../../sync/ospite';
import type { SessioneTavolo } from '../../../sync/ospite';
import { normalizzaCodice, nuovoGettone } from '../../../sync/stanza';
import type { Iscrizione, Pubblico } from '../../../sync/stanza';
import { Avatar, Dado3D, FacciaDado, Montone } from '../grafica';
import { Cronaca, Mano, Pulsante, Riepilogo } from '../partita/componenti';
import { nome, nomi } from '../partita/descrizioni';
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
import { scenaRemota } from './regiaRemota';
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

export function ContoAllaRovescia({ scadenza, ora, totale }: { scadenza: number; ora: () => number; totale: number }) {
  const [adesso, setAdesso] = useState(ora);
  useEffect(() => {
    const id = setInterval(() => setAdesso(ora()), 200);
    return () => clearInterval(id);
  }, [ora]);
  const resto = Math.max(0, scadenza - adesso);
  return (
    <div className="conto" role="timer" aria-live="off">
      <div className="conto-barra" style={{ width: `${Math.min(100, (resto / (totale * 1000)) * 100)}%` }} />
      <span>{T.stanza.tempo(Math.ceil(resto / 1000))}</span>
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
    try {
      globalThis.localStorage?.setItem('hls-nome', nomeG.trim());
    } catch {
      // Non indispensabile.
    }
    try {
      const t = await connetti();
      const gettone = nuovoGettone();
      if (p.modo === 'crea') {
        const s = await SessioneHost.crea(t, archivioHost(), { nome: nomeG, pecora, gettone });
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
          const host = await SessioneHost.riprendi(t, archivioHost());
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

/** Il lancio e la Testata degli altri si vedono "in diretta" su ogni dispositivo. */
function Spettacolo({ v, io }: { v: Vista; io: IdGiocatore }) {
  const [visto, setVisto] = useState(() => v.eventi[v.eventi.length - 1]?.seq ?? 0);
  const [mostra, setMostra] = useState<{ testo: string; faccia?: string; testata?: boolean } | null>(null);
  useEffect(() => {
    const nuovi = v.eventi.filter((e) => e.seq > visto);
    if (nuovi.length === 0) return;
    setVisto(nuovi[nuovi.length - 1]!.seq);
    for (const e of [...nuovi].reverse()) {
      if (e.tipo === 'dado_lanciato' && e.giocatore !== io) {
        setMostra({ testo: `${nome(v, e.giocatore)}: ${T.dado.facce[e.faccia] ?? e.faccia}`, faccia: e.faccia });
        break;
      }
      if (e.tipo === 'testata' && e.giocatore !== io) {
        setMostra({ testo: `${nome(v, e.giocatore)} → ${nome(v, e.bersaglio)}: ${T.testata.risultato(e.esito)}`, testata: true });
        break;
      }
    }
  }, [v, visto, io]);
  useEffect(() => {
    if (!mostra) return;
    const t = setTimeout(() => setMostra(null), 2400);
    return () => clearTimeout(t);
  }, [mostra]);
  if (!mostra) return null;
  return (
    <div className="spettacolo" role="status" onClick={() => setMostra(null)}>
      <div className="spettacolo-scena">
        {mostra.faccia && (
          <>
            <span className="spettacolo-dado">
              <Dado3D size={110} />
            </span>
            <span className="spettacolo-faccia">
              <FacciaDado faccia={mostra.faccia} size={110} />
            </span>
          </>
        )}
        {mostra.testata && <Montone size={200} className="spettacolo-montone" />}
        <p>{mostra.testo}</p>
      </div>
    </div>
  );
}

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

function PannelloAttesa({ v, sc, io, pub, ora }: { v: Vista; sc: Extract<ScenaRemota, { tipo: 'attesa' }>; io: IdGiocatore; pub: Pubblico; ora: () => number }) {
  const f = v.fase;
  let testo: string;
  if (sc.finestra) testo = T.stanza.attesaReazioni;
  else if (f.nome === 'scelta' || f.nome === 'belato_finale') testo = T.stanza.attesaScelte;
  else if (f.nome === 'risoluzione_dado' && f.passo === 'esito_testata' && f.dichiarazione?.effetto === 'testata') {
    testo = T.stanza.testataDi(nome(v, f.lanciatore), nome(v, f.dichiarazione.bersaglio));
  } else if (f.nome === 'dado') testo = T.stanza.lancioDi(nomi(v, sc.di));
  else testo = T.stanza.attesaDi(nomi(v, sc.di));
  const mano = v.giocatori.find((g) => g.id === io)?.mano ?? [];
  return (
    <div className="pannello">
      <div className="pannello-titolo">
        <h2>{testo}</h2>
      </div>
      {sc.finestra && pub.scadenza && <ContoAllaRovescia scadenza={pub.scadenza} ora={ora} totale={pub.impostazioni.finestraSecondi} />}
      <Riepilogo v={v} />
      {mano.length > 0 && <Mano carte={mano} />}
    </div>
  );
}

function PartitaRemota(p: { sessione: SessioneStanza; io: IdGiocatore; onEsci: () => void; onRegole: () => void }) {
  const { sessione, io } = p;
  const host = sessione instanceof SessioneHost ? sessione : null;
  const pub = sessione.pubblico()!;
  const v = sessione.vista(io);
  const azioni = sessione.azioni(io);
  const sc = scenaRemota(v, io, azioni);
  const [menu, setMenu] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [passaDaSolo, setPassaDaSolo] = preferenza('hls-passa-da-solo', false);
  const [aperta] = useState(() => sessione.ora());
  const [rifiutoNascosto, setRifiutoNascosto] = useState(0);
  const [bloccato, setBloccato] = useState(false);
  const ora = useCallback(() => sessione.ora(), [sessione]);

  // Sul telefono di un ospite la risposta dell'host arriva dopo un attimo: niente doppi tocchi nel frattempo.
  useEffect(() => sessione.ascolta(() => setBloccato(false)), [sessione]);
  useEffect(() => {
    if (!bloccato) return;
    const t = setTimeout(() => setBloccato(false), 4000);
    return () => clearTimeout(t);
  }, [bloccato]);

  const invia = useCallback(
    (a: Azione) => {
      const r = sessione.invia(a);
      setErrore(r.ok ? null : T.errori.azione(r.messaggio));
      if (r.ok && sessione instanceof SessioneOspite) setBloccato(true);
    },
    [sessione],
  );

  // "Passa sempre se non ho niente da giocare" (brief §5): evita attese inutili nelle finestre di reazione.
  const soloPassa = azioni.length === 1 && azioni[0]!.tipo === 'passa' && sc.tipo === 'pannello' && (sc.pannello === 'reazione' || sc.pannello === 'punteggio');
  const chiaveFinestra = `${v.round}-${v.fase.nome}-${v.finestra?.voce ?? ''}-${v.pila.length}-${v.eventi[v.eventi.length - 1]?.seq ?? 0}`;
  useEffect(() => {
    if (!passaDaSolo || !soloPassa) return;
    const t = setTimeout(() => invia(azioni[0]!), 400);
    return () => clearTimeout(t);
    // Una volta per finestra: la chiave cambia a ogni nuova dichiarazione.
  }, [passaDaSolo, soloPassa, chiaveFinestra]);

  const ultimoRifiuto = sessione instanceof SessioneOspite ? sessione.rifiuto() : null;
  const rifiuto = ultimoRifiuto && ultimoRifiuto.quando > Math.max(aperta, rifiutoNascosto) ? ultimoRifiuto : null;
  useEffect(() => {
    if (!rifiuto) return;
    const t = setTimeout(() => setRifiutoNascosto(rifiuto.quando), 5000);
    return () => clearTimeout(t);
  }, [rifiuto]);
  const hostAssente = sessione instanceof SessioneOspite && !sessione.hostOnline();
  const scollegato = !sessione.online();
  const inPausa = pub.pausa.length > 0 || hostAssente || scollegato;

  if (sc.tipo === 'fine') {
    return (
      <FinePartita
        v={v}
        onHome={p.onEsci}
        onRigioca={host ? () => host.tornaInSala() : undefined}
        testoRigioca={T.stanza.rivincita}
        nota={host ? undefined : T.stanza.aspettaRivincita}
      />
    );
  }

  const conto = pub.scadenza && (sc.tipo === 'pannello' && (sc.pannello === 'reazione' || sc.pannello === 'punteggio')) ? (
    <ContoAllaRovescia scadenza={pub.scadenza} ora={ora} totale={pub.impostazioni.finestraSecondi} />
  ) : null;

  let pannello: React.ReactNode;
  if (sc.tipo === 'automatica') {
    const prosegui = host ? host.azioni('sistema').find((a) => a.tipo === 'prosegui') : undefined;
    pannello = <PannelloAutomatico v={v} onContinua={prosegui ? () => invia(prosegui) : undefined} />;
  } else if (sc.tipo === 'attesa') {
    pannello = <PannelloAttesa v={v} sc={sc} io={io} pub={pub} ora={ora} />;
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

  return (
    <div className="partita">
      <Intestazione v={v} onMenu={() => setMenu(true)} />
      <Tavolo v={v} attivo={io} />
      <Cronaca v={v} />
      {errore && (
        <p className="errore" role="alert">
          {errore}
        </p>
      )}
      {rifiuto && <p className="errore">{rifiuto.messaggio}</p>}
      <section className={`area-azione ${bloccato ? 'bloccata' : ''}`} key={chiaveFinestra}>
        {conto}
        {pannello}
        {conto && (
          <label className="opzione">
            <input type="checkbox" checked={passaDaSolo} onChange={(e) => setPassaDaSolo(e.target.checked)} />
            {T.stanza.passaDaSolo}
          </label>
        )}
      </section>
      <Spettacolo v={v} io={io} />
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

/** Vista tavolo senza mani, da proiettare (brief §5). */
export function VistaTavolo({ sessione, onEsci }: { sessione: SessioneTavolo; onEsci: () => void }) {
  useAggiornamenti(sessione);
  const v = sessione.vista();
  if (!v) return <main className="passaggio">{T.stanza.aspettaHost}</main>;
  return (
    <div className="partita tavolo-proiettore">
      <Intestazione v={v} onMenu={onEsci} />
      <Tavolo v={v} attivo={null} />
      <Cronaca v={v} quanti={5} />
      <Riepilogo v={v} />
    </div>
  );
}
