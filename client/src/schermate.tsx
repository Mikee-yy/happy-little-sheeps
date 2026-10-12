// Schermate fuori dalla partita: Home, preparazione della partita locale, Regole.
import { useState } from 'react';
import { CATALOGO, SETUP } from '../../engine/src';
import type { IdPecora } from '../../engine/src';
import type { GiocatoreLocale } from '../../sync/locale';
import logo from '../../design/svg/logo-chiaro.svg';
import { Avatar, IconaGuaio, Pecora } from './grafica';
import { Pulsante } from './partita/componenti';
import { REGOLE, T } from './testi';

export function Home(p: { salvata: boolean; onNuova: () => void; onRiprendi: () => void; onRegole: () => void }) {
  return (
    <main className="home">
      <h1 className="logo">
        <img src={logo} alt={T.titolo} />
      </h1>
      <p className="sottotitolo">{T.sottotitolo}</p>
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
        <Pulsante largo secondario={p.salvata} onClick={p.onNuova}>
          {T.home.giocaQui}
        </Pulsante>
        <Pulsante largo secondario disabled>
          {T.home.creaStanza}
        </Pulsante>
        <Pulsante largo secondario disabled>
          {T.home.entraStanza}
        </Pulsante>
        <p className="aiuto">{T.home.prossimamente}</p>
        <Pulsante largo secondario onClick={p.onRegole}>
          {T.home.regole}
        </Pulsante>
      </div>
    </main>
  );
}

const PECORE = SETUP.pecore.map((pc) => pc.id);

export function Preparazione(p: { salvata: boolean; onInizia: (g: GiocatoreLocale[]) => void; onIndietro: () => void }) {
  const [quanti, setQuanti] = useState(3);
  const [nomi, setNomi] = useState<string[]>(['', '', '', '']);
  const [pecore, setPecore] = useState<IdPecora[]>([...PECORE]);
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
    </main>
  );
}

export function Regole({ onIndietro }: { onIndietro: () => void }) {
  return (
    <main className="regole">
      <h1>{T.home.regole}</h1>
      {REGOLE.map((s) => (
        <section key={s.titolo}>
          <h2>{s.titolo}</h2>
          <ul>
            {s.righe.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </section>
      ))}
      <section>
        <h2>{T.tipiGuaio.meteo}, {T.tipiGuaio.predatori}, {T.tipiGuaio.drammi}</h2>
        <p className="legenda">
          {(['meteo', 'predatori', 'drammi', 'tosatura'] as const).map((t) => (
            <span key={t}>
              <IconaGuaio tipo={t} size={24} /> {T.tipiGuaio[t]}
            </span>
          ))}
        </p>
      </section>
      <Pulsante largo onClick={onIndietro}>
        {T.preparazione.indietro}
      </Pulsante>
    </main>
  );
}
