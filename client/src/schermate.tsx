// Schermate fuori dalla partita: Home e preparazione della partita locale (le Regole stanno in regole/Regole.tsx).
import { useState } from 'react';
import { CATALOGO, SETUP } from '../../engine/src';
import type { IdPecora } from '../../engine/src';
import type { GiocatoreLocale } from '../../sync/locale';
import type { Iscrizione } from '../../sync/stanza';
import logo from '../../design/svg/logo-chiaro.svg';
import { Avatar, IconaGuaio, Pecora } from './grafica';
import { Pulsante } from './partita/componenti';
import { T } from './testi';

export function Home(p: {
  salvata: boolean;
  multigiocatore: boolean;
  iscrizione: Iscrizione | null;
  avviso: string | null;
  onNuova: () => void;
  onProva: () => void;
  onRiprendi: () => void;
  onCrea: () => void;
  onEntra: () => void;
  onRientra: () => void;
  onDimentica: () => void;
  onRegole: () => void;
}) {
  const [spiega, setSpiega] = useState(false);
  return (
    <main className="home">
      <h1 className="logo">
        <img src={logo} alt={T.titolo} />
      </h1>
      <div className="home-pecore" aria-hidden="true">
        {SETUP.pecore.map((pc) => (
          <Pecora key={pc.id} pecora={pc.id} size={72} />
        ))}
      </div>
      <div className="home-pulsanti">
        {p.salvata && (
          <Pulsante largo onClick={p.onRiprendi}>
            {T.home.riprendi}
          </Pulsante>
        )}
        {/* Il "?" accanto spiega che su un dispositivo solo si gioca passandolo a ogni turno. */}
        <div className="con-aiuto">
          <Pulsante largo secondario={p.salvata} onClick={p.onNuova}>
            {T.home.giocaQui}
          </Pulsante>
          <button
            type="button"
            className="pulsante pulsante-secondario aiuto-tondo"
            aria-label={T.home.aiutoQui}
            aria-expanded={spiega}
            aria-controls="spiega-qui"
            onClick={() => setSpiega(!spiega)}
          >
            ?
          </button>
        </div>
        {/* Sempre presente (nascosta finché chiusa): aria-controls del "?" punta sempre a qualcosa */}
        <p className="spiega-qui" id="spiega-qui" hidden={!spiega}>
          {T.home.spiegaQui}
        </p>
        <Pulsante largo secondario onClick={p.onProva}>
          {T.prova.pulsante}
        </Pulsante>
        {p.multigiocatore && p.iscrizione && (
          <div className="rientro">
            <Pulsante largo onClick={p.onRientra}>
              {T.stanza.rientra(p.iscrizione.codice)}
            </Pulsante>
            <button type="button" className="link" onClick={p.onDimentica}>
              {T.home.dimentica}
            </button>
          </div>
        )}
        <Pulsante largo secondario disabled={!p.multigiocatore} onClick={p.onCrea}>
          {T.home.creaStanza}
        </Pulsante>
        <Pulsante largo secondario disabled={!p.multigiocatore} onClick={p.onEntra}>
          {T.home.entraStanza}
        </Pulsante>
        {!p.multigiocatore && <p className="aiuto">{T.stanza.nonConfigurato}</p>}
        {p.avviso && <p className="errore">{p.avviso}</p>}
        <Pulsante largo secondario onClick={p.onRegole}>
          {T.home.regole}
        </Pulsante>
      </div>
    </main>
  );
}

const PECORE = SETUP.pecore.map((pc) => pc.id);

/** Riassunto del gioco in fondo alle schermate di scelta dei giocatori, con il collegamento alle Regole. */
export function Riassunto({ onRegole }: { onRegole: () => void }) {
  return (
    <section className="riassunto" id="riassunto">
      <h2 tabIndex={-1}>{T.riassunto.titolo}</h2>
      <ul>
        {T.riassunto.righe.map((r) => (
          <li key={r.forte}>
            <strong>{r.forte}</strong>
            {r.resto}
          </li>
        ))}
      </ul>
      <button type="button" className="link" onClick={onRegole}>
        {T.riassunto.tutte}
      </button>
    </section>
  );
}

/** L'avviso in cima alla preparazione porta giù fino al riassunto (senza animazione se il telefono la riduce). */
function scendiAlRiassunto() {
  const ridotto = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  document.getElementById('riassunto')?.scrollIntoView?.({ behavior: ridotto ? 'auto' : 'smooth', block: 'start' });
  // Anche il punto della tastiera (e del lettore di schermo) passa al riassunto
  document.querySelector<HTMLElement>('#riassunto h2')?.focus({ preventScroll: true });
}

/** Scelte della preparazione: le tiene App, così sopravvivono a un giro nelle Regole. */
export type SceltePreparazione = { quanti: number; nomi: string[]; pecore: IdPecora[] };
export const scelteIniziali = (): SceltePreparazione => ({ quanti: 3, nomi: ['', '', '', ''], pecore: [...PECORE] });

export function Preparazione(p: {
  salvata: boolean;
  scelte: SceltePreparazione;
  onScelte: (s: SceltePreparazione) => void;
  onInizia: (g: GiocatoreLocale[]) => void;
  onIndietro: () => void;
  onRegole: () => void;
}) {
  const { quanti, nomi, pecore } = p.scelte;
  const setQuanti = (n: number) => p.onScelte({ ...p.scelte, quanti: n });
  const setNomi = (n: string[]) => p.onScelte({ ...p.scelte, nomi: n });
  const setPecore = (pc: IdPecora[]) => p.onScelte({ ...p.scelte, pecore: pc });
  const giocatori = Array.from({ length: quanti }, (_, i) => ({
    id: `g${i + 1}`,
    nome: (nomi[i] ?? '').trim() || T.preparazione.nomeSegnaposto(i + 1),
    pecora: pecore[i] as IdPecora,
  }));
  const nomiDoppi = new Set(giocatori.map((g) => g.nome.toLowerCase())).size !== quanti;
  const pecoreDoppie = new Set(giocatori.map((g) => g.pecora)).size !== quanti;
  const errore = nomiDoppi ? T.preparazione.nomiDoppi : pecoreDoppie ? T.preparazione.pecoreDoppie : null;

  /** Scegliere una pecora già presa la scambia con chi l'aveva. */
  const scegliPecora = (i: number, pc: IdPecora) => {
    const nuove = [...pecore];
    const j = nuove.indexOf(pc);
    if (j >= 0 && j !== i) nuove[j] = nuove[i] as IdPecora;
    nuove[i] = pc;
    setPecore(nuove);
  };

  return (
    <main className="preparazione">
      <h1>{T.preparazione.titolo}</h1>
      <button type="button" className="link vai-regole" onClick={scendiAlRiassunto}>
        {T.riassunto.vaiGiu}
      </button>
      {p.salvata && <p className="aiuto">{T.home.nuovaConfermata}</p>}
      <div className="etichetta">{T.preparazione.quantiGiocatori}</div>
      <div className="scelte-nomi">
        {[2, 3, 4].map((n) => (
          <Pulsante key={n} secondario={quanti !== n} onClick={() => setQuanti(n)}>
            {n}
          </Pulsante>
        ))}
      </div>
      {giocatori.map((g, i) => {
        const def = CATALOGO.pecore[g.pecora];
        return (
          <fieldset key={g.id} className="giocatore-prep">
            <legend>{T.preparazione.nomeSegnaposto(i + 1)}</legend>
            <input
              aria-label={`${T.preparazione.nome} ${i + 1}`}
              placeholder={T.preparazione.nomeSegnaposto(i + 1)}
              maxLength={16}
              value={nomi[i] ?? ''}
              onChange={(e) => setNomi(nomi.map((x, k) => (k === i ? e.target.value : x)))}
            />
            <div className="scelta-pecora" role="radiogroup" aria-label={T.preparazione.pecora}>
              {PECORE.map((pc) => (
                <button
                  key={pc}
                  type="button"
                  role="radio"
                  aria-checked={g.pecora === pc}
                  className={g.pecora === pc ? 'scelta attiva' : 'scelta'}
                  onClick={() => scegliPecora(i, pc)}
                >
                  <Avatar pecora={pc} size={40} titolo={CATALOGO.pecore[pc].nome} />
                </button>
              ))}
            </div>
            <div className="tratti">
              <strong>{def.nome}</strong>, {def.titolo} · {T.preparazione.bonus} +1 <IconaGuaio tipo={def.bonus} size={16} />{' '}
              {T.tipiGuaio[def.bonus]} · {T.preparazione.malus} −1 <IconaGuaio tipo={def.malus} size={16} /> {T.tipiGuaio[def.malus]}
            </div>
          </fieldset>
        );
      })}
      {errore && <p className="errore">{errore}</p>}
      <Pulsante largo disabled={!!errore} onClick={() => p.onInizia(giocatori)}>
        {T.preparazione.inizia}
      </Pulsante>
      <Pulsante largo secondario onClick={p.onIndietro}>
        {T.preparazione.indietro}
      </Pulsante>
      <Riassunto onRegole={p.onRegole} />
    </main>
  );
}
