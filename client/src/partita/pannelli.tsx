// Pannelli d'azione per ogni momento del round. Ogni pannello costruisce i controlli a partire
// dalle azioni valide fornite dal motore: non può proporre mosse illegali.
import { useEffect, useMemo, useState } from 'react';
import type { Azione, IdCarta, IdGiocatore, Vista } from '../../../engine/src';
import { Dado3D, FacciaDado } from '../grafica';
import { T } from '../testi';
import { Avvisi, Carta, Mano, Pulsante, PulsanteBeeeNo, Riepilogo } from './componenti';
import { descriviVoce, giocatoreDi, nome, nomeCarta, nomi, valoreCarta } from './descrizioni';

export interface PropsPannello {
  /** Vista di chi agisce (con la sua mano) o del tavolo per i pannelli pubblici. */
  v: Vista;
  giocatore: IdGiocatore;
  azioni: Azione[];
  invia: (a: Azione) => void;
}

type Di<T extends Azione['tipo']> = Extract<Azione, { tipo: T }>;
const filtra = <K extends Azione['tipo']>(azioni: Azione[], tipo: K) => azioni.filter((a): a is Di<K> => a.tipo === tipo);
const mano = (v: Vista, id: IdGiocatore): IdCarta[] => giocatoreDi(v, id).mano ?? [];
const stessoInsieme = (a: IdCarta[], b: IdCarta[]) => a.length === b.length && a.every((x) => b.includes(x));

function Titolo({ children, aiuto }: { children: React.ReactNode; aiuto?: string }) {
  return (
    <div className="pannello-titolo">
      <h2>{children}</h2>
      {aiuto && <p className="aiuto">{aiuto}</p>}
    </div>
  );
}

// ─── Scelta segreta ──────────────────────────────────────────────────────────

export function PannelloScelta({ v, giocatore, azioni, invia }: PropsPannello) {
  const opzioni = filtra(azioni, 'scegliTrovata').map((a) => a.carte);
  const [sel, setSel] = useState<IdCarta[]>([]);
  const toccabili = [...new Set(opzioni.flat())];
  const tocca = (c: IdCarta) => {
    if (sel.includes(c)) return setSel(sel.filter((x) => x !== c));
    if (sel.length === 1 && opzioni.some((o) => stessoInsieme(o, [sel[0]!, c]))) return setSel([sel[0]!, c]);
    setSel([c]);
  };
  const valida = opzioni.some((o) => stessoInsieme(o, sel));
  const totale = sel.reduce((t, c) => t + valoreCarta(c), 0);
  const haGemelle = opzioni.some((o) => o.length === 2);
  return (
    <div className="pannello">
      <Titolo aiuto={haGemelle ? `${T.scelta.aiuto} ${T.scelta.gemelleInsieme}` : T.scelta.aiuto}>
        {T.scelta.titolo(nome(v, giocatore))}
      </Titolo>
      <Avvisi v={v} id={giocatore} />
      <Mano carte={mano(v, giocatore)} toccabili={toccabili} selezionate={sel} onTocca={tocca} />
      <Pulsante largo disabled={!valida} onClick={() => invia({ tipo: 'scegliTrovata', giocatore, carte: sel })}>
        {!valida
          ? T.azioni.scegliCarta
          : sel.length === 2
            ? T.azioni.giocaCoppia(totale)
            : T.azioni.gioca(nomeCarta(sel[0]!), totale)}
      </Pulsante>
    </div>
  );
}

// ─── Effetti delle Trovate ───────────────────────────────────────────────────

export function PannelloEffetto({ v, giocatore, azioni, invia }: PropsPannello) {
  const f = v.fase.nome === 'effetti' ? v.fase : null;
  const voce = f?.coda[f.indice];
  if (!voce) return null;
  const attiva = filtra(azioni, 'attivaEffetto');
  const rinuncia = filtra(azioni, 'rinunciaEffetto')[0];
  const conBersaglio = attiva.filter((a) => a.bersaglio !== undefined);
  return (
    <div className="pannello">
      <Titolo aiuto={T.effetti.facoltativo}>{T.effetti.titolo(nome(v, giocatore), nomeCarta(voce.carta))}</Titolo>
      <div className="carta-in-evidenza">
        <Carta id={voce.carta} grande />
      </div>
      {conBersaglio.length > 0 ? (
        <>
          <p className="aiuto">{T.effetti.bersaglio}</p>
          <div className="scelte-nomi">
            {conBersaglio.map((a) => (
              <Pulsante key={a.bersaglio} onClick={() => invia(a)}>
                {nome(v, a.bersaglio!)} ({giocatoreDi(v, a.bersaglio!).agnellini})
              </Pulsante>
            ))}
          </div>
        </>
      ) : (
        attiva[0] && (
          <Pulsante largo onClick={() => invia(attiva[0]!)}>
            {T.azioni.attiva}
          </Pulsante>
        )
      )}
      {rinuncia && (
        <Pulsante largo secondario onClick={() => invia(rinuncia)}>
          {T.azioni.rinuncia}
        </Pulsante>
      )}
      <Mano carte={mano(v, giocatore)} />
    </div>
  );
}

export function PannelloRichiesta({ v, giocatore, azioni, invia }: PropsPannello) {
  const r = v.richiesta;
  const opzioni = filtra(azioni, 'completaEffetto').map((a) => a.carte);
  const [sel, setSel] = useState<IdCarta[]>([]);
  if (!r) return null;
  const valida = opzioni.some((o) => stessoInsieme(o, sel));
  const conferma = () => invia({ tipo: 'completaEffetto', giocatore, carte: sel });
  if (r.tipo === 'guarda_due') {
    return (
      <div className="pannello">
        <Titolo aiuto={T.effetti.guardaDue}>{nomeCarta(r.carta)}</Titolo>
        <Mano carte={r.carte} selezionate={sel} onTocca={(c) => setSel([c])} />
        <Pulsante largo disabled={!valida} onClick={conferma}>
          {sel[0] ? `${T.azioni.tieni} ${nomeCarta(sel[0])}` : T.azioni.tieni}
        </Pulsante>
      </div>
    );
  }
  const multipla = r.tipo === 'scarta_fino_a_tre';
  const toccabili = [...new Set(opzioni.flat())];
  const tocca = (c: IdCarta) => {
    if (!multipla) return setSel([c]);
    if (sel.includes(c)) return setSel(sel.filter((x) => x !== c));
    if (sel.length < 3) setSel([...sel, c]);
  };
  return (
    <div className="pannello">
      <Titolo aiuto={multipla ? T.effetti.scartaFinoATre : T.effetti.scartaESomma}>{nomeCarta(r.carta)}</Titolo>
      <Mano carte={mano(v, giocatore)} toccabili={toccabili} selezionate={sel} onTocca={tocca} />
      <Pulsante largo disabled={!valida} onClick={conferma}>
        {multipla && sel.length === 0 ? T.azioni.nonScartare : `${T.azioni.scarta} ${sel.map(nomeCarta).join(', ')}`}
      </Pulsante>
    </div>
  );
}

// ─── Domande a tutti (finestre di reazione e Belati di punteggio) ───────────

export function PannelloDomanda(p: {
  v: Vista;
  contesto: 'reazione' | 'punteggio';
  candidati: IdGiocatore[];
  onScegli: (id: IdGiocatore) => void;
  onNessuno: () => void;
}) {
  const { v } = p;
  const cima = v.pila[v.pila.length - 1];
  const dado = cima?.dettagli.tipo === 'dado' ? cima.dettagli.faccia : null;
  const testi = p.contesto === 'reazione' ? T.reazione : T.punteggio;
  return (
    <div className="pannello">
      {cima && (
        <div className="dichiarazione">
          {dado && <FacciaDado faccia={dado} size={72} />}
          <p>{descriviVoce(v, cima)}</p>
        </div>
      )}
      {p.contesto === 'punteggio' && <Riepilogo v={v} />}
      <Titolo aiuto={testi.aiuto}>{testi.domanda}</Titolo>
      <div className="scelte-nomi">
        {p.candidati.map((id) => (
          <Pulsante key={id} secondario onClick={() => p.onScegli(id)}>
            {nome(v, id)}
          </Pulsante>
        ))}
      </div>
      <Pulsante largo onClick={p.onNessuno}>
        {T.azioni.nessuno}
      </Pulsante>
    </div>
  );
}

export function PannelloReazione({ v, giocatore, azioni, invia, onIndietro }: PropsPannello & { onIndietro?: () => void }) {
  const cima = v.pila[v.pila.length - 1];
  const beeeNo = filtra(azioni, 'giocaBelato')[0];
  const passa = filtra(azioni, 'passa')[0];
  return (
    <div className="pannello">
      {cima && <div className="dichiarazione">{descriviVoce(v, cima)}</div>}
      <Titolo aiuto={beeeNo ? undefined : T.reazione.nonHai}>{T.reazione.privato(nome(v, giocatore))}</Titolo>
      {beeeNo && <PulsanteBeeeNo onClick={() => invia(beeeNo)} />}
      {passa && (
        <Pulsante largo secondario onClick={() => invia(passa)}>
          {T.azioni.passa}
        </Pulsante>
      )}
      {onIndietro && (
        <Pulsante largo secondario onClick={onIndietro}>
          {T.azioni.annulla}
        </Pulsante>
      )}
      <Mano carte={mano(v, giocatore)} />
    </div>
  );
}

export function PannelloPunteggio({ v, giocatore, azioni, invia, onIndietro }: PropsPannello & { onIndietro?: () => void }) {
  const belati = filtra(azioni, 'giocaBelato');
  const passa = filtra(azioni, 'passa')[0];
  const [carta, setCarta] = useState<IdCarta | null>(null);
  const perCarta = belati.filter((a) => a.carta === carta);
  const carte = [...new Set(belati.map((a) => a.carta))];
  return (
    <div className="pannello">
      <Riepilogo v={v} />
      <Titolo aiuto={carte.length === 0 ? T.punteggio.nonHai : undefined}>{T.punteggio.privato(nome(v, giocatore))}</Titolo>
      <Mano carte={mano(v, giocatore)} toccabili={carte} selezionate={carta ? [carta] : []} onTocca={setCarta} />
      {carta && perCarta.length === 1 && perCarta[0]!.bersaglio === undefined && (
        <Pulsante largo onClick={() => invia(perCarta[0]!)}>
          {nomeCarta(carta)}
        </Pulsante>
      )}
      {carta && perCarta.some((a) => a.bersaglio !== undefined) && (
        <>
          <p className="aiuto">{T.punteggio.suChi}</p>
          <div className="scelte-nomi">
            {perCarta.map((a) => (
              <Pulsante key={a.bersaglio} onClick={() => invia(a)}>
                {nome(v, a.bersaglio!)}
              </Pulsante>
            ))}
          </div>
        </>
      )}
      {passa && (
        <Pulsante largo secondario onClick={() => invia(passa)}>
          {T.azioni.passa}
        </Pulsante>
      )}
      {onIndietro && (
        <Pulsante largo secondario onClick={onIndietro}>
          {T.azioni.annulla}
        </Pulsante>
      )}
    </div>
  );
}

// ─── Dado ────────────────────────────────────────────────────────────────────

export function PannelloLancio({ v, giocatore, azioni, invia }: PropsPannello) {
  const lancia = filtra(azioni, 'lanciaDado')[0];
  const [rotola, setRotola] = useState(false);
  useEffect(() => {
    if (!rotola || !lancia) return;
    const t = setTimeout(() => invia(lancia), 900);
    return () => clearTimeout(t);
  }, [rotola, lancia, invia]);
  return (
    <div className="pannello pannello-dado">
      <Titolo aiuto={v.datiRound.lanciatori.length > 1 ? T.dado.pari : undefined}>{T.dado.tocca(nome(v, giocatore))}</Titolo>
      <div className={`dado-scena ${rotola ? 'rotola' : ''}`}>
        <Dado3D size={140} />
      </div>
      <Pulsante largo disabled={!lancia || rotola} onClick={() => setRotola(true)}>
        {T.azioni.lancia}
      </Pulsante>
    </div>
  );
}

export function PannelloDichiarazione({ v, giocatore, azioni, invia }: PropsPannello) {
  const f = v.fase.nome === 'risoluzione_dado' ? v.fase : null;
  const opzioni = filtra(azioni, 'dichiaraDado');
  const furti = opzioni.filter((a) => a.furto);
  const avversari = useMemo(() => [...new Set(furti.flatMap((a) => Object.keys(a.furto ?? {})))], [furti]);
  const [quote, setQuote] = useState<Record<IdGiocatore, number>>({});
  if (!f) return null;
  if (furti.length > 0) {
    const daAvversari = Object.values(furti[0]!.furto!).reduce((t, x) => t + x, 0);
    const scelta = furti.find((a) => avversari.every((id) => (a.furto![id] ?? 0) === (quote[id] ?? 0)));
    const somma = Object.values(quote).reduce((t, x) => t + x, 0);
    const massimo = (id: IdGiocatore) => Math.max(...furti.map((a) => a.furto![id] ?? 0));
    return (
      <div className="pannello">
        <div className="dichiarazione">
          <FacciaDado faccia={f.faccia} size={72} />
        </div>
        <Titolo aiuto={T.dado.furtoAiuto(daAvversari, 0)}>{T.dado.furtoTitolo(daAvversari)}</Titolo>
        <div className="furto">
          {avversari.map((id) => (
            <div key={id} className="furto-riga">
              <span>
                {nome(v, id)} ({giocatoreDi(v, id).agnellini})
              </span>
              <Pulsante secondario disabled={(quote[id] ?? 0) === 0} onClick={() => setQuote({ ...quote, [id]: (quote[id] ?? 0) - 1 })}>
                −
              </Pulsante>
              <strong>{quote[id] ?? 0}</strong>
              <Pulsante
                secondario
                disabled={(quote[id] ?? 0) >= massimo(id) || somma >= daAvversari}
                onClick={() => setQuote({ ...quote, [id]: (quote[id] ?? 0) + 1 })}
              >
                +
              </Pulsante>
            </div>
          ))}
        </div>
        <Pulsante largo disabled={!scelta} onClick={() => scelta && invia(scelta)}>
          {T.azioni.conferma}
        </Pulsante>
      </div>
    );
  }
  return (
    <div className="pannello">
      <div className="dichiarazione">
        <FacciaDado faccia={f.faccia} size={72} />
      </div>
      <Titolo>{T.dado.testataTitolo}</Titolo>
      <div className="scelte-nomi">
        {opzioni.map((a) => (
          <Pulsante key={a.bersaglio} onClick={() => invia(a)}>
            {nome(v, a.bersaglio!)} ({giocatoreDi(v, a.bersaglio!).agnellini})
          </Pulsante>
        ))}
      </div>
      <p className="aiuto">{T.dado.tocca(nome(v, giocatore))}</p>
    </div>
  );
}

// ─── Belato Finale, salvataggio, consolazione ───────────────────────────────

export function PannelloBelatoFinale({ v, giocatore, azioni, invia }: PropsPannello) {
  const opzioni = filtra(azioni, 'sceltaFinale');
  const [sel, setSel] = useState<IdCarta | null>(null);
  return (
    <div className="pannello">
      <Titolo aiuto={T.belatoFinale.aiuto}>{T.belatoFinale.titolo(nome(v, giocatore))}</Titolo>
      <Mano carte={mano(v, giocatore)} toccabili={opzioni.map((a) => a.carta)} selezionate={sel ? [sel] : []} onTocca={setSel} />
      <Pulsante
        largo
        disabled={!sel}
        onClick={() => sel && invia({ tipo: 'sceltaFinale', giocatore, carta: sel })}
      >
        {sel ? T.azioni.gioca(nomeCarta(sel), valoreCarta(sel)) : T.azioni.scegliCarta}
      </Pulsante>
    </div>
  );
}

export function PannelloSalvataggio({ v, giocatore, azioni, invia }: PropsPannello) {
  const passa = filtra(azioni, 'passa')[0];
  const belati = filtra(azioni, 'giocaBelato');
  const [carta, setCarta] = useState<IdCarta | null>(null);
  const perCarta = belati.filter((a) => a.carta === carta);
  const guaio = v.datiRound.guaio;
  return (
    <div className="pannello">
      <Titolo aiuto={belati.length ? T.salvataggio.aiuto : undefined}>{T.salvataggio.titolo(nome(v, giocatore))}</Titolo>
      <Avvisi v={v} id={giocatore} />
      {guaio && (
        <div className="carta-in-evidenza">
          <Carta id={guaio} />
        </div>
      )}
      <Mano carte={mano(v, giocatore)} toccabili={[...new Set(belati.map((a) => a.carta))]} selezionate={carta ? [carta] : []} onTocca={setCarta} />
      {carta && perCarta.length === 1 && perCarta[0]!.bersaglio === undefined && (
        <Pulsante largo onClick={() => invia(perCarta[0]!)}>
          {nomeCarta(carta)}
        </Pulsante>
      )}
      {carta && perCarta.some((a) => a.bersaglio !== undefined) && (
        <>
          <p className="aiuto">{T.salvataggio.aChi}</p>
          <div className="scelte-nomi">
            {perCarta.map((a) => (
              <Pulsante key={a.bersaglio} onClick={() => invia(a)}>
                {nome(v, a.bersaglio!)}
              </Pulsante>
            ))}
          </div>
        </>
      )}
      {passa && (
        <Pulsante largo secondario onClick={() => invia(passa)}>
          {T.azioni.prendiGuaio}
        </Pulsante>
      )}
    </div>
  );
}

export function PannelloConsolazione({ v, giocatore, azioni, invia }: PropsPannello) {
  const cure = filtra(azioni, 'giocaBelato');
  const conclusioni = filtra(azioni, 'concludiConsolazione');
  const [scarta, setScarta] = useState<IdCarta | null>(null);
  const g = giocatoreDi(v, giocatore);
  return (
    <div className="pannello">
      <Titolo aiuto={T.consolazione.aiuto}>{T.consolazione.titolo(g.nome)}</Titolo>
      <Avvisi v={v} id={giocatore} />
      {cure.length > 0 && (
        <>
          <p className="aiuto">{T.consolazione.cura}</p>
          <div className="scelte-nomi">
            {cure.map((a) => (
              <Pulsante key={a.guaio} secondario onClick={() => invia(a)}>
                {nomeCarta(a.guaio!)}
              </Pulsante>
            ))}
          </div>
        </>
      )}
      <Mano
        carte={mano(v, giocatore)}
        toccabili={conclusioni.map((a) => a.scarta).filter((c): c is IdCarta => c !== null)}
        selezionate={scarta ? [scarta] : []}
        onTocca={(c) => setScarta(scarta === c ? null : c)}
      />
      <Pulsante largo onClick={() => invia({ tipo: 'concludiConsolazione', giocatore, scarta })}>
        {scarta ? `${T.azioni.scarta} ${nomeCarta(scarta)}` : T.azioni.nonScartare}
      </Pulsante>
    </div>
  );
}

// ─── Fasi automatiche ────────────────────────────────────────────────────────

/** Senza onContinua (ospiti a più dispositivi) si mostra che la partita prosegue da sola. */
export function PannelloAutomatico({ v, onContinua, extra }: { v: Vista; onContinua?: () => void; extra?: React.ReactNode }) {
  const f = v.fase;
  let contenuto: React.ReactNode = null;
  if (f.nome === 'guaio') {
    contenuto = (
      <>
        <Titolo>{T.fasi.guaio}</Titolo>
        <div className="carta-in-evidenza">
          {v.datiRound.guaio ? <Carta id={v.datiRound.guaio} grande /> : <p>{T.tavolo.nessunGuaio}</p>}
        </div>
      </>
    );
  } else if (f.nome === 'rivelazione') {
    contenuto = (
      <>
        <Titolo>{T.fasi.rivelazione}</Titolo>
        <Riepilogo v={v} />
      </>
    );
  } else if (f.nome === 'guaio_al_peggiore') {
    const testo = f.destinatario
      ? T.guai.prende(nome(v, f.destinatario))
      : f.spareggio
        ? T.guai.spareggio(nomi(v, f.spareggio))
        : v.datiRound.partecipanti.length >= 2 && v.datiRound.piuAlti.length === 0
          ? T.guai.tuttiPari
          : T.guai.inFondo;
    contenuto = (
      <>
        <Titolo>{T.fasi.guaio_al_peggiore}</Titolo>
        <Riepilogo v={v} />
        <p className="messaggio">{testo}</p>
      </>
    );
  } else if (f.nome === 'fine_round') {
    contenuto = <Titolo aiuto={T.fineRound.aiuto}>{T.fineRound.titolo}</Titolo>;
  } else if (f.nome === 'ultimo_round') {
    contenuto = <Titolo aiuto={T.ultimoRound.aiuto}>{T.ultimoRound.titolo}</Titolo>;
  } else {
    contenuto = <Titolo>{T.fasi[f.nome]}</Titolo>;
  }
  return (
    <div className="pannello">
      {contenuto}
      {extra}
      {onContinua ? (
        <Pulsante largo onClick={onContinua}>
          {T.azioni.continua}
        </Pulsante>
      ) : (
        <p className="aiuto">{T.stanza.prosegue}</p>
      )}
    </div>
  );
}
