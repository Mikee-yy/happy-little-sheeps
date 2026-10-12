// Tavolo comune: visibile a tutti, senza mani. Intestazione, Ovili e Angoli dei Guai, Guaio attivo, Gregge, carte giocate.
import type { IdGiocatore, Vista } from '../../../engine/src';
import { Agnellino, Avatar, IconaGuaio, Retro } from '../grafica';
import { T } from '../testi';
import { RigaOvile, useIngrandimento } from './componenti';
import { giocatoreDi, nomeCarta, tipoGuaio, valoreCarta } from './descrizioni';

export function Intestazione({ v, onMenu }: { v: Vista; onMenu: () => void }) {
  const ultimo = v.ultimoRound !== null && v.round === v.ultimoRound;
  return (
    <header className="intestazione">
      <h1 className="titolo-round">{T.tavolo.round(v.round)}</h1>
      {ultimo && <span className="pillola-ultimo">{T.tavolo.ultimoRound}</span>}
      <span className="pillola-mazzo">{T.tavolo.mazzo(v.carteNelMazzo)}</span>
      <button type="button" className="pulsante-menu" onClick={onMenu} aria-label={T.tavolo.menu}>
        ☰
      </button>
    </header>
  );
}

function Gregge({ n }: { n: number }) {
  const mostrati = Math.min(n, 12);
  return (
    <div className="gregge">
      <div className="etichetta">{T.tavolo.gregge}</div>
      <div className="gregge-conteggio">× {n}</div>
      <div className="mucchio" aria-hidden="true">
        {Array.from({ length: mostrati }, (_, i) => (
          <Agnellino key={i} size={26} />
        ))}
      </div>
    </div>
  );
}

function GiocataRivelata({ id }: { id: string }) {
  const zoom = useIngrandimento();
  const { eraTenuta: _no, ...gesti } = zoom.props(id);
  return (
    <div className="giocata-mini" {...gesti}>
      <span className="giocata-valore">{valoreCarta(id)}</span>
      <span className="giocata-nome">{nomeCarta(id)}</span>
      {zoom.vista}
    </div>
  );
}

function CarteGiocate({ v, attivo }: { v: Vista; attivo: IdGiocatore | null }) {
  const partecipanti = v.datiRound.partecipanti;
  if (partecipanti.length === 0) return null;
  const rivelate = Object.keys(v.datiRound.giocate).length > 0;
  return (
    <div className="carte-giocate">
      <div className="etichetta">{T.tavolo.carteGiocate}</div>
      <div className="carte-giocate-fila">
        {partecipanti.map((id) => {
          const g = giocatoreDi(v, id);
          const giocate = v.datiRound.giocate[id] ?? [];
          return (
            <div key={id} className={`posto-giocata ${id === attivo ? 'tuo' : ''}`}>
              {rivelate ? (
                <div className="giocate-rivelate">
                  {giocate.map((c) => (
                    <GiocataRivelata key={c} id={c} />
                  ))}
                </div>
              ) : (
                <div className="giocata-coperta">
                  <Retro size={44} />
                </div>
              )}
              <span className="posto-nome">
                <Avatar pecora={g.pecora} size={20} /> {id === attivo ? T.tavolo.tu : g.nome}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GuaioAttivo({ v }: { v: Vista }) {
  const guaio = v.datiRound.guaio;
  const zoom = useIngrandimento();
  if (!guaio) return <div className="guaio-attivo nessun-guaio">{T.tavolo.nessunGuaio}</div>;
  const tipo = tipoGuaio(guaio);
  const { eraTenuta: _no, ...gesti } = zoom.props(guaio);
  return (
    <div className="guaio-attivo" style={{ background: `var(--colore-${tipo})` }} {...gesti}>
      <div className="etichetta">{T.tavolo.guaio}</div>
      <div className="guaio-tipo">
        <IconaGuaio tipo={tipo} size={22} /> {T.tipiGuaio[tipo]}
      </div>
      <div className="guaio-nome">{nomeCarta(guaio)}</div>
      {zoom.vista}
    </div>
  );
}

export function Tavolo({ v, attivo }: { v: Vista; attivo: IdGiocatore | null }) {
  return (
    <section className="tavolo">
      <div className="ovili">
        {v.giocatori.map((g) => (
          <RigaOvile key={g.id} v={v} id={g.id} attiva={g.id === attivo} />
        ))}
      </div>
      <div className="centro">
        <GuaioAttivo v={v} />
        <Gregge n={v.gregge} />
      </div>
      <CarteGiocate v={v} attivo={attivo} />
    </section>
  );
}
