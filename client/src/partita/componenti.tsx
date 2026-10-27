// Componenti di base del tavolo: pulsanti, carte, mano, righe dell'Ovile, avvisi, riepilogo, cronaca.
import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { IdCarta, IdGiocatore, RigaPunteggio, Vista } from '../../../engine/src';
import { Agnellino, Avatar, IconaGuaio, Quadrifoglio } from '../grafica';
import { T } from '../testi';
import { carta, datiAvvisi, descriviEvento, giocatoreDi, mancanti, tipiPericolosi, tipoGuaio, totaleRighe } from './descrizioni';

export function Pulsante(p: {
  children: ReactNode;
  onClick?: () => void;
  secondario?: boolean;
  disabled?: boolean;
  largo?: boolean;
  className?: string;
}) {
  const classi = ['pulsante', p.secondario ? 'pulsante-secondario' : 'pulsante-primario', p.largo ? 'largo' : '', p.className ?? '']
    .filter(Boolean)
    .join(' ');
  return (
    <button type="button" className={classi} onClick={p.onClick} disabled={p.disabled}>
      {p.children}
    </button>
  );
}

export function PulsanteBeeeNo({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="pulsante-beeeno" onClick={onClick}>
      {T.azioni.beeeNo}
    </button>
  );
}

type Gesti = Omit<ReturnType<ReturnType<typeof useIngrandimento>['props']>, 'eraTenuta'>;

export function Carta(p: {
  id: IdCarta;
  selezionata?: boolean;
  spenta?: boolean;
  onClick?: () => void;
  grande?: boolean;
  gesti?: Gesti;
}) {
  const d = carta(p.id);
  const classi = ['carta', `carta-${d.famiglia}`, p.selezionata ? 'selezionata' : '', p.spenta ? 'spenta' : '', p.grande ? 'grande' : '']
    .filter(Boolean)
    .join(' ');
  const contenuto =
    d.famiglia === 'trovata' ? (
      <>
        <span className="carta-valore">{d.valore}</span>
        {d.gemella && (
          <span className="carta-gemella" title={T.carte.gemella}>
            <Quadrifoglio size={16} />
          </span>
        )}
        <span className="carta-nome">{d.nome}</span>
        <span className={d.effetto ? 'carta-testo' : 'carta-testo colore'}>{d.testo}</span>
        {d.effetto === null && !d.gemella && <span className="carta-senza-effetto">{T.carte.nessunEffetto}</span>}
      </>
    ) : d.famiglia === 'belato' ? (
      <>
        <span className={`carta-nome nuvoletta ${d.effetto === 'beee_no' ? 'beeeno' : ''}`}>{d.nome}</span>
        <span className="carta-quando">{T.carte.quando[d.quando]}</span>
        <span className="carta-testo">{d.testo}</span>
      </>
    ) : (
      <>
        <span className="carta-fascia">
          <IconaGuaio tipo={d.tipo} size={16} />
          {T.tipiGuaio[d.tipo]}
        </span>
        <span className="carta-nome">{d.nome}</span>
        <span className="carta-testo colore">{d.testo}</span>
      </>
    );
  const stile = d.famiglia === 'guaio' ? { background: `var(--colore-${d.tipo})` } : undefined;
  if (p.onClick) {
    return (
      <button type="button" className={classi} style={stile} onClick={p.onClick} aria-pressed={p.selezionata} data-carta={p.id} {...p.gesti}>
        {contenuto}
      </button>
    );
  }
  return (
    <div className={classi} style={stile} data-carta={p.id} {...p.gesti}>
      {contenuto}
    </div>
  );
}

/** Tocco prolungato (o clic destro) su una carta: la mostra ingrandita (brief §7, Mano). */
export function useIngrandimento() {
  const [carta, setCarta] = useState<IdCarta | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tenuta = useRef(false);
  const ferma = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const props = (c: IdCarta) => ({
    onPointerDown: () => {
      tenuta.current = false;
      ferma();
      timer.current = setTimeout(() => {
        tenuta.current = true;
        setCarta(c);
      }, 450);
    },
    onPointerUp: ferma,
    onPointerLeave: ferma,
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      setCarta(c);
    },
    /** Dopo un tocco prolungato il clic non deve anche selezionare la carta. */
    eraTenuta: () => tenuta.current,
  });
  const vista = carta ? (
    <div className="velo" role="dialog" aria-modal="true" onClick={() => setCarta(null)}>
      <Carta id={carta} grande />
    </div>
  ) : null;
  return { props, vista };
}

export function Mano(p: {
  carte: IdCarta[];
  selezionate?: IdCarta[];
  /** Se presente, solo queste carte si possono toccare; le altre sono spente. */
  toccabili?: IdCarta[];
  onTocca?: (c: IdCarta) => void;
}) {
  const zoom = useIngrandimento();
  return (
    <div className="mano mano-pannello">
      {p.carte.map((c) => {
        const toccabile = p.onTocca && (!p.toccabili || p.toccabili.includes(c));
        const { eraTenuta, ...gesti } = zoom.props(c);
        return (
          <Carta
            key={c}
            id={c}
            gesti={gesti}
            selezionata={p.selezionate?.includes(c)}
            spenta={!!p.toccabili && !p.toccabili.includes(c)}
            onClick={() => {
              if (!eraTenuta() && toccabile) p.onTocca!(c);
            }}
          />
        );
      })}
      {zoom.vista}
    </div>
  );
}

function BarraAgnellini({ n, posti }: { n: number; posti: number }) {
  return (
    <div className="barra" style={{ gridTemplateColumns: `repeat(${posti}, 1fr)` }} aria-hidden="true">
      {Array.from({ length: posti }, (_, i) => (
        <span key={i} className={i < n ? 'tacca piena' : 'tacca'} />
      ))}
    </div>
  );
}

export function StatoScelta({ v, id }: { v: Vista; id: IdGiocatore }) {
  const f = v.fase;
  if (f.nome !== 'scelta' && f.nome !== 'belato_finale') return null;
  if (!(id in f.haScelto)) return null;
  return f.haScelto[id] ? (
    <span className="pillola-scelta fatto">✓ {T.tavolo.haScelto}</span>
  ) : (
    <span className="pillola-scelta attesa">
      <span className="puntini">
        <i />
        <i />
        <i />
      </span>
      {T.tavolo.staScegliendo}
    </span>
  );
}

export function RigaOvile({ v, id, attiva }: { v: Vista; id: IdGiocatore; attiva?: boolean }) {
  const g = giocatoreDi(v, id);
  const pericolo = tipiPericolosi(v, id).length > 0;
  const mancano = mancanti(v, id);
  const fuori = !g.eliminato && v.fase.nome !== 'guaio' && v.datiRound.partecipanti.length > 0 && !v.datiRound.partecipanti.includes(id);
  return (
    <div className={`riga-ovile ${attiva ? 'attiva' : ''} ${g.eliminato ? 'eliminata' : ''}`}>
      <Avatar pecora={g.pecora} />
      <div className="riga-centro">
        <div className="riga-testa">
          <strong>{g.nome}</strong>
          <span className="conteggio">
            <Agnellino size={18} /> {g.agnellini}/{v.config.postiOvile}
          </span>
        </div>
        <BarraAgnellini n={g.agnellini} posti={v.config.postiOvile} />
      </div>
      <div className="riga-destra">
        {g.eliminato ? (
          <span className="pillola">{T.tavolo.eliminata}</span>
        ) : (
          <>
            {fuori && <span className="pillola">{T.tavolo.fuori}</span>}
            <StatoScelta v={v} id={id} />
            {mancano <= 3 && <span className="pillola-vittoria">{T.tavolo.unoAllaVittoria(mancano)}</span>}
          </>
        )}
        <span className={`guai ${pericolo ? 'a-rischio' : ''}`}>
          {g.angolo.map((c) => (
            <IconaGuaio key={c} tipo={tipoGuaio(c)} size={18} titolo={T.tipiGuaio[tipoGuaio(c)]} />
          ))}
        </span>
      </div>
    </div>
  );
}

/** Avvisi per il giocatore che ha il dispositivo: un Guaio all'eliminazione, pochi agnellini alla vittoria. */
export function Avvisi({ v, id }: { v: Vista; id: IdGiocatore }) {
  const avvisi = datiAvvisi(v, id);
  if (avvisi.length === 0) return null;
  return (
    <>
      {avvisi.map((a) =>
        a.tipo === 'pericolo' ? (
          <div key={a.tipo} className="avviso avviso-pericolo" role="alert">
            <span className="punto-esclamativo">!</span>
            <div>
              <strong>{a.titolo}</strong>
              <div>{a.testo}</div>
            </div>
          </div>
        ) : (
          <div key={a.tipo} className="avviso avviso-vittoria">
            <Agnellino size={30} />
            <div>
              <strong>{a.titolo}</strong>
              <div>{a.testo}</div>
            </div>
          </div>
        ),
      )}
    </>
  );
}

const ETICHETTE: Record<RigaPunteggio['tipo'], string> = {
  valore: T.rivelazione.valore,
  tratto: T.rivelazione.tratto,
  effetto: T.rivelazione.effetto,
  belato: T.rivelazione.belato,
  scambio: T.rivelazione.scambio,
};

/** Calcolo del punteggio sempre spiegato: valore, tratto, effetti, Belati, scambi, totale. */
export function Riepilogo({ v }: { v: Vista }) {
  const partecipanti = v.datiRound.partecipanti;
  if (partecipanti.length === 0 || Object.keys(v.datiRound.punteggi).length === 0) return null;
  return (
    <div className="riepilogo">
      <div className="etichetta">{T.rivelazione.titolo}</div>
      {v.giocatori.map((g) => {
        const righe = v.datiRound.punteggi[g.id];
        if (!righe) return null;
        const perTipo = new Map<string, number>();
        for (const r of righe) perTipo.set(r.tipo, (perTipo.get(r.tipo) ?? 0) + r.delta);
        const bassi = v.datiRound.piuBassi.includes(g.id);
        const alti = v.datiRound.piuAlti.includes(g.id);
        return (
          <div key={g.id} className={`riepilogo-riga ${alti ? 'alto' : ''} ${bassi ? 'basso' : ''}`}>
            <Avatar pecora={g.pecora} size={24} />
            <span className="riepilogo-nome">{g.nome}</span>
            <span className="riepilogo-calcolo">
              {[...perTipo.entries()].map(([tipo, delta]) => (
                <span key={tipo} className="addendo">
                  {ETICHETTE[tipo as RigaPunteggio['tipo']]} {delta >= 0 && tipo !== 'valore' ? '+' : ''}
                  {delta}
                </span>
              ))}
            </span>
            <strong className="riepilogo-totale">{totaleRighe(righe)}</strong>
          </div>
        );
      })}
    </div>
  );
}

export function Cronaca({ v, quanti = 2 }: { v: Vista; quanti?: number }) {
  const righe = v.eventi
    .map((e) => ({ seq: e.seq, testo: descriviEvento(v, e) }))
    .filter((x): x is { seq: number; testo: string } => x.testo !== null)
    .slice(-quanti);
  if (righe.length === 0) return null;
  return (
    <ul className="cronaca" aria-live="polite">
      {righe.map((r) => (
        <li key={r.seq}>{r.testo}</li>
      ))}
    </ul>
  );
}
