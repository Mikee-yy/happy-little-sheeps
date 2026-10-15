// Pagina di sviluppo della scena (client/scena.html, non pubblicata): il teatro da solo, a schermo intero, con una
// partita vera del motore. In alto "Opzioni" (OpzioniScena) e "Prova eventi" (bozza scena.src.html, righe 2641–2708),
// il selettore delle varianti dei recinti e il banco di prova (window.PROVE, vedi prove.ts).
// Dalla console: SCENA è il banco della pagina (partita, teatro, cambiaGiocatori, impostaNomi…).
import { StrictMode, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';
import '../../../../design/design-tokens.css';
import '../scena.css';
import { applica, nuovaPartita, SETUP, vistaPer } from '../../../../engine/src';
import type { IdGiocatore, Stato } from '../../../../engine/src';
import { Sprite } from '../../grafica';
import { casoConSeme, mossaDelBot } from '../aiuti-prova';
import { usaVariante, type Variante } from '../disposizioni';
import { fotografia, inBassoIniziale, type Fotografia } from '../fotografia';
import { OpzioniScena } from '../OpzioniScena';
import { creaTeatro, type Teatro } from '../teatro';
import { eseguiEvento, LUPO, METEO_PROVA, TESTI_SVILUPPO as TS, type EventoProva } from './eventi';
import { installaProve, type BancoProve } from './prove';
import varianti from './varianti.json';

const VARIANTI = varianti as unknown as Record<string, Variante>;
const SEME = 2024;
const NOMI = ['Ada', 'Bea', 'Cleo', 'Dario'];

/** Il banco della pagina: la partita vera, chi sta in basso e il teatro che la mostra. */
class Banco implements BancoProve {
  teatro: Teatro | null = null;
  ciclo: 'automatico' | 'manuale' = 'automatico';
  n: 2 | 3 | 4 = 3;
  stato: Stato;
  inBasso: IdGiocatore;
  variante = 'base';
  nomi = [...NOMI];
  private radice: HTMLElement | null = null;
  private versione = 0;
  private ascoltatori = new Set<() => void>();
  /** Il caso dei bot di "Prossima mossa": a seme fisso, come le partite simulate. */
  private casoBot = casoConSeme(SEME);

  constructor() {
    this.stato = this.partitaNuova(this.n);
    this.inBasso = inBassoIniziale(vistaPer(this.stato, null));
  }

  // Per React (useSyncExternalStore)
  ascolta = (cb: () => void) => {
    this.ascoltatori.add(cb);
    return () => this.ascoltatori.delete(cb);
  };
  leggi = () => this.versione;
  private avvisa(): void {
    this.versione++;
    for (const cb of [...this.ascoltatori]) cb();
  }

  private partitaNuova(n: 2 | 3 | 4): Stato {
    const pecore = SETUP.pecore.map((p) => p.id).slice(0, n);
    return nuovaPartita({ giocatori: pecore.map((pecora, i) => ({ id: `g${i + 1}`, nome: this.nomi[i] ?? `G${i + 1}`, pecora })), seme: SEME });
  }

  /** Il tavolo visto da chi sta in basso, con la sua mano scoperta (pagina di sviluppo: nessuno da cui nasconderla). */
  foto(): Fotografia {
    const mano = vistaPer(this.stato, this.inBasso).giocatori.find((g) => g.id === this.inBasso)?.mano ?? null;
    return fotografia(vistaPer(this.stato, null), this.inBasso, mano);
  }

  allinea(modo: 'calmo' | 'subito'): void {
    this.teatro?.allinea(this.foto(), modo);
    this.avvisa();
  }

  monta(radice: HTMLElement): void {
    this.radice = radice;
    this.teatro?.distruggi();
    this.teatro = creaTeatro(radice, { ciclo: this.ciclo });
    this.allinea('subito');
  }

  smonta(): void {
    this.teatro?.distruggi();
    this.teatro = null;
    this.avvisa();
  }

  rimonta(o: { ciclo?: 'automatico' | 'manuale' } = {}): void {
    if (o.ciclo) this.ciclo = o.ciclo;
    if (this.radice) this.monta(this.radice);
  }

  cambiaGiocatori(n: 2 | 3 | 4): void {
    this.n = n;
    this.stato = this.partitaNuova(n);
    this.inBasso = inBassoIniziale(vistaPer(this.stato, null));
    this.allinea('subito');
  }

  ricomincia(): void {
    this.cambiaGiocatori(this.n);
  }

  /** Per provare le targhe con nomi lunghi: la partita ricomincia con questi nomi. */
  impostaNomi(nomi: string[]): void {
    this.nomi = [...nomi, ...NOMI.slice(nomi.length)];
    this.ricomincia();
  }

  /** Il telefono passa al posto dopo: la scena si ricostruisce con lui in basso. */
  passaTelefono(): void {
    const ids = this.stato.giocatori.map((g) => g.id);
    this.inBasso = ids[(ids.indexOf(this.inBasso) + 1) % ids.length]!;
    this.allinea('calmo');
  }

  /** Un bot con la strategia "semplice" fa la mossa di chi è in attesa (o la fase di sistema prosegue). */
  prossimaMossa(): void {
    if (this.stato.esito) return;
    this.stato = applica(this.stato, mossaDelBot(this.stato, 'semplice', this.casoBot));
    this.allinea('calmo');
  }

  /** Mette in prova una variante dei recinti e ricostruisce la scena. */
  scegliVariante(v: string): void {
    this.variante = v;
    usaVariante(VARIANTI[v] ?? null);
    this.rimonta();
  }
}

const banco = new Banco();

/** Ferma il tocco nei pannelli: non abbassa la carta e non chiude i pannelli (bozza, righe 2683 e 2697). */
function useToccoFermo<E extends HTMLElement>() {
  const ref = useRef<E>(null);
  useEffect(() => {
    const e = ref.current;
    if (!e) return;
    const ferma = (ev: Event) => ev.stopPropagation();
    e.addEventListener('pointerdown', ferma);
    return () => e.removeEventListener('pointerdown', ferma);
  });
  return ref;
}

function PannelloEventi({ onChiudi }: { onChiudi: () => void }) {
  const ref = useToccoFermo<HTMLDivElement>();
  const f = banco.foto();
  const [bersaglio, setBersaglio] = useState<IdGiocatore>(f.posti[0]!.id);
  const chi = f.posti.some((p) => p.id === bersaglio) ? bersaglio : f.posti[0]!.id;
  const ids = f.posti.map((p) => p.id);

  const evento = (ev: EventoProva) => () => {
    onChiudi();
    if (banco.teatro) eseguiEvento(banco.teatro, ev, chi, ids);
  };
  const azione = (fn: () => void) => () => {
    onChiudi();
    fn();
  };
  const chip = (attivo: boolean, testo: string, onClick: () => void, key: string | number) => (
    <button key={key} className={'btn chip' + (attivo ? ' attivo' : '')} type="button" aria-pressed={attivo} onClick={onClick}>
      {testo}
    </button>
  );

  return (
    <div className="eventi" ref={ref}>
      <p>{TS.aChi}</p>
      <div className="chips">{f.posti.map((p) => chip(p.id === chi, p.nome, () => setBersaglio(p.id), p.id))}</div>
      <p>{TS.cosa}</p>
      <button className="btn" type="button" onClick={evento({ tipo: 'furto' })}>
        {TS.furto}
      </button>
      <button className="btn" type="button" onClick={evento({ tipo: 'guaio', carta: LUPO })}>
        {TS.lupo}
      </button>
      <p>{TS.meteo}</p>
      <div className="griglia-eventi">
        {METEO_PROVA.map(([id, nome]) => (
          <button key={id} className="btn" type="button" onClick={evento({ tipo: 'guaio', carta: id })}>
            {nome}
          </button>
        ))}
      </div>
      <button className="btn" type="button" onClick={evento({ tipo: 'beeeNo' })}>
        {TS.beeeNo}
      </button>
      <button className="btn" type="button" onClick={evento({ tipo: 'pascolo' })}>
        {TS.pascolo}
      </button>
      <p>{TS.partita}</p>
      <div className="chips">
        {([2, 3, 4] as const).map((n) => chip(n === banco.n, TS.giocatori(n), azione(() => banco.cambiaGiocatori(n)), n))}
      </div>
      <button className="btn" type="button" onClick={azione(() => banco.ricomincia())}>
        {TS.ricomincia}
      </button>
      <button className="btn" type="button" onClick={azione(() => banco.passaTelefono())}>
        {TS.passa}
      </button>
      <button className="btn" type="button" disabled={!!banco.stato.esito} onClick={azione(() => banco.prossimaMossa())}>
        {banco.stato.esito ? TS.finita : TS.prossima}
      </button>
      <p>{TS.recinti}</p>
      <div className="chips">
        {['base', ...Object.keys(VARIANTI)].map((v) =>
          chip(v === banco.variante, VARIANTI[v] ? `${TS.varianti[v] ?? v}: ${VARIANTI[v]!.nome}` : (TS.varianti[v] ?? v), azione(() => banco.scegliVariante(v)), v),
        )}
      </div>
    </div>
  );
}

function PannelloOpzioni({ onChiudi }: { onChiudi: () => void }) {
  const ref = useToccoFermo<HTMLDivElement>();
  return (
    <div ref={ref}>
      <OpzioniScena className="opzioni" rivediSuggerimenti={() => banco.teatro?.rivediSuggerimenti()} onChiudi={onChiudi} />
    </div>
  );
}

function PaginaScena() {
  useSyncExternalStore(banco.ascolta, banco.leggi);
  const radice = useRef<HTMLDivElement>(null);
  const apriOpzioniRef = useRef<HTMLButtonElement>(null);
  const [aperto, setAperto] = useState<'opzioni' | 'eventi' | null>(null);

  useEffect(() => {
    banco.monta(radice.current!);
    return () => banco.smonta();
  }, []);

  // Un tocco sulla scena chiude i pannelli (bozza, righe 2669 e 2686)
  const scena = banco.teatro?.ctx.el.scena;
  useEffect(() => {
    if (!scena) return;
    const chiudi = () => setAperto(null);
    scena.addEventListener('pointerdown', chiudi);
    return () => scena.removeEventListener('pointerdown', chiudi);
  }, [scena]);

  const hud = banco.teatro?.ctx.el.ui.querySelector<HTMLElement>('.hud') ?? null;
  const ui = banco.teatro?.ctx.el.ui ?? null;
  const chiudiOpzioni = () => {
    setAperto(null);
    apriOpzioniRef.current?.focus();
  };
  const scambia = (p: 'opzioni' | 'eventi') => setAperto((a) => (a === p ? null : p));

  return (
    <>
      <div ref={radice} className="pagina-scena" />
      {hud &&
        createPortal(
          <>
            <button ref={apriOpzioniRef} className="btn" type="button" aria-expanded={aperto === 'opzioni'} onClick={() => scambia('opzioni')}>
              {TS.apriOpzioni}
            </button>
            <button className="btn" type="button" aria-expanded={aperto === 'eventi'} onClick={() => scambia('eventi')}>
              {TS.apriEventi}
            </button>
          </>,
          hud,
        )}
      {ui && aperto === 'opzioni' && createPortal(<PannelloOpzioni onChiudi={chiudiOpzioni} />, ui)}
      {ui && aperto === 'eventi' && createPortal(<PannelloEventi onChiudi={() => setAperto(null)} />, ui)}
    </>
  );
}

document.title = TS.titolo;
Object.assign(globalThis, { SCENA: banco });
installaProve(banco);
createRoot(document.getElementById('scena')!).render(
  <StrictMode>
    <Sprite />
    <PaginaScena />
  </StrictMode>,
);
