// La schermata Regole: otto sezioni a fisarmonica (testi e figure da `regole(nomi)` di testi.ts). Ogni titolo è un
// pulsante dentro un h2; il pannello c'è sempre (per `aria-controls`) ma da chiuso è nascosto e non monta le figure.
// Le carte disegnate arrivano a parte (`useCarte`): finché non ci sono, al loro posto un segnaposto con lo stesso
// testo alternativo. Ogni carta fuori dallo schermo ha le animazioni in pausa.
// I nomi dei giocatori arrivano solo come testo React.
import { useEffect, useId, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Agnellino, Dado3D, FacciaDado, IconaGuaio, Montone, Pecora } from '../grafica';
import { Pulsante } from '../partita/componenti';
import { T, regole, type BloccoRegole, type DisegnoRegole, type FiguraRegole, type IdSezioneRegole, type SezioneRegole } from '../testi';
import { testoAlternativo } from './alternativi';
import { useCarte } from './caricaCarte';
import { RecintoZone } from './recinto';

type ModuloCarte = NonNullable<ReturnType<typeof useCarte>>;

/** Con più figure di così, il blocco le mette in una fila scorrevole sopra il testo. */
const FIGURE_ACCANTO = 2;

export function Regole(p: {
  /** I nomi dei giocatori della partita in corso (nell'ordine dei posti), o null fuori da una partita. */
  nomi: readonly string[] | null;
  /** Aperte da una stanza in corso: la partita va avanti, una riga lo dice. */
  inStanza?: boolean;
  /**
   * Aperte da una stanza, anche in sala d'attesa: il posto della riga è tenuto (vuoto e muto) fin da subito, così quando la
   * partita comincia e la riga compare il testo che si sta leggendo non si sposta.
   */
  riservaStanza?: boolean;
  /** Nella stanza tocca a te fare una scelta: in cima compare il richiamo che riporta alla partita. */
  richiamo?: boolean;
  /** Il testo della riga della stanza, se non è "la partita va avanti" (pausa, partita finita). */
  rigaStanza?: string;
  /** Il testo del richiamo, se non è "tocca a te" (chi ospita deve decidere su chi si è scollegato). */
  testoRichiamo?: string;
  onIndietro: () => void;
}) {
  const sezioni = useMemo(() => regole(p.nomi), [p.nomi]);
  // All'apertura solo "Lo scopo"; lo stato non si ricorda tra un'apertura e l'altra
  const [aperte, setAperte] = useState<ReadonlySet<IdSezioneRegole>>(() => new Set(['scopo']));
  const carte = useCarte();
  const base = useId();
  const titolo = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    // La pagina torna in cima e il punto della tastiera va sul titolo
    const pagina = document.scrollingElement ?? document.documentElement;
    pagina.scrollTop = 0;
    titolo.current?.focus({ preventScroll: true });
  }, []);

  const cambia = (id: IdSezioneRegole) =>
    setAperte((prima) => {
      const dopo = new Set(prima);
      if (!dopo.delete(id)) dopo.add(id);
      return dopo;
    });

  return (
    <main className="regole">
      {/* In cima, nella stanza, la riga che la partita va avanti; il richiamo prende il suo posto, con la stessa altezza
          (stile.css), così quando arriva il testo che si sta leggendo non si sposta */}
      {p.richiamo ? (
        <div className="regole-richiamo" role="alert">
          <p>{p.testoRichiamo ?? T.regole.richiamo}</p>
          <Pulsante onClick={p.onIndietro}>{T.regole.tornaAllaPartita}</Pulsante>
        </div>
      ) : p.inStanza ? (
        <p className="regole-stanza">{p.rigaStanza ?? T.regole.stanzaVaAvanti}</p>
      ) : (
        p.riservaStanza && <div className="regole-stanza regole-riserva" aria-hidden="true" />
      )}
      <h1 ref={titolo} tabIndex={-1}>
        {T.regole.titolo}
      </h1>
      {sezioni.map((s, i) => (
        <Sezione key={s.id} sezione={s} numero={i + 1} base={base} aperta={aperte.has(s.id)} onCambia={() => cambia(s.id)} carte={carte} />
      ))}
      <div className="regole-fondo">
        <Pulsante largo onClick={p.onIndietro}>
          {T.regole.indietro}
        </Pulsante>
      </div>
    </main>
  );
}

function Sezione(p: { sezione: SezioneRegole; numero: number; base: string; aperta: boolean; onCambia: () => void; carte: ModuloCarte | null }) {
  const { sezione: s } = p;
  const idTitolo = `${p.base}-${s.id}-titolo`;
  const idPannello = `${p.base}-${s.id}-pannello`;
  const blocchi = s.blocchi.map((b, i) => <Blocco key={i} blocco={b} carte={p.carte} />);
  return (
    <section className="regole-sezione">
      <h2>
        {/* Il nome per i lettori di schermo: "1. Lo scopo", non "1Lo scopo" (numero e titolo sono due span attaccati) */}
        <button
          type="button"
          className="regole-titolo"
          id={idTitolo}
          aria-label={T.regole.nomeTitolo(p.numero, s.titolo)}
          aria-expanded={p.aperta}
          aria-controls={idPannello}
          onClick={p.onCambia}
        >
          <span className="regole-numero">{p.numero}</span>
          <span>{s.titolo}</span>
        </button>
      </h2>
      {/* Un contenitore semplice, non una "region": con tutte le otto sezioni aperte l'elenco dei punti di riferimento
          dei lettori di schermo si riempirebbe (guida APG della fisarmonica); il titolo è subito sopra */}
      <div id={idPannello} hidden={!p.aperta} className="regole-pannello">
        {p.aperta &&
          // I passi del round hanno il loro numero
          (s.id === 'round' ? (
            <ol className="regole-passi">
              {blocchi.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ol>
          ) : (
            blocchi
          ))}
      </div>
    </section>
  );
}

/** Vero quando l'elemento (una carta animata) è fuori dallo schermo (senza IntersectionObserver resta sempre in vista). */
function useFuoriVista(ref: RefObject<HTMLElement | null>, attivo: boolean): boolean {
  const [fuori, setFuori] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!attivo || !el || typeof IntersectionObserver === 'undefined') return;
    const osservatore = new IntersectionObserver((voci) => {
      for (const v of voci) if (v.target === el) setFuori(!v.isIntersecting);
    });
    osservatore.observe(el);
    return () => {
      osservatore.disconnect();
      setFuori(false);
    };
  }, [ref, attivo]);
  return attivo && fuori;
}

function Blocco({ blocco: b, carte }: { blocco: BloccoRegole; carte: ModuloCarte | null }) {
  const n = b.figure.length;
  const testo = b.forte ? (
    <p>
      <strong>{b.forte}</strong> {b.testo}
    </p>
  ) : (
    <p>{b.testo}</p>
  );
  if (n === 0) return <div className="regole-blocco">{testo}</div>;
  const figure = b.figure.map((f, i) => <Figura key={i} figura={f} carte={carte} />);
  if (n > FIGURE_ACCANTO)
    return (
      <div className="regole-blocco">
        <div className="figure-fila" role="group" tabIndex={0} aria-label={T.regole.figure(n)}>
          {figure}
        </div>
        {testo}
      </div>
    );
  // Il recinto è troppo fitto per stare a 90 px accanto al testo: va sopra, largo
  const largo = b.figure.some((f) => f.disegno.tipo === 'recinto');
  // Due carte una sotto l'altra lascerebbero un buco accanto a un testo corto: vanno affiancate, sopra il testo
  const dueCarte = n === 2 && b.figure.every((f) => f.disegno.tipo === 'carta');
  const classe = largo ? ' figura-larga' : dueCarte ? ' figure-sopra' : '';
  return (
    <div className={`regole-blocco con-figure${classe}`}>
      <div className="figure-accanto">{figure}</div>
      {testo}
    </div>
  );
}

/** Un testo come lo sente un lettore di schermo, per confrontarne due (maiuscole e spazi non contano). */
const comeDetto = (s: string): string => s.toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Quale dei due nomi tacere ai lettori di schermo perché non si senta due volte: il disegno, se la didascalia comincia con
 * il suo nome (la pecora: "Ricciolo" e "Ricciolo · +1 Meteo…"; la faccia del dado, uguale); la didascalia, se il nome del
 * disegno la contiene già (l'icona "Guaio Meteo" con "Meteo"; una carta, che dice tutto). Le carte non si tacciono mai.
 */
function daTacere(d: DisegnoRegole, didascalia: string | undefined): 'disegno' | 'didascalia' | null {
  if (!didascalia) return null;
  const alt = comeDetto(testoAlternativo(d)), testo = comeDetto(didascalia);
  if (d.tipo !== 'carta' && testo.startsWith(alt)) return 'disegno';
  if (alt.includes(testo) || testo.startsWith(alt)) return 'didascalia';
  return null;
}

function Figura({ figura: f, carte }: { figura: FiguraRegole; carte: ModuloCarte | null }) {
  const tacere = daTacere(f.disegno, f.didascalia);
  const ref = useRef<HTMLElement>(null);
  // Solo le carte si animano: ognuna si ferma quando è fuori dallo schermo (anche oltre il bordo di una fila scorrevole)
  const fuori = useFuoriVista(ref, f.disegno.tipo === 'carta');
  return (
    <figure ref={ref} className={`figura-regole di-${f.disegno.tipo}${fuori ? ' fuori-vista' : ''}`}>
      {disegno(f.disegno, carte, tacere === 'disegno')}
      {f.didascalia && <figcaption aria-hidden={tacere === 'didascalia' ? true : undefined}>{f.didascalia}</figcaption>}
    </figure>
  );
}

function disegno(d: DisegnoRegole, carte: ModuloCarte | null, taciuto = false): ReactNode {
  const alt = testoAlternativo(d);
  if (d.tipo === 'carta') {
    if (carte) return <carte.CartaRegole id={d.id} />;
    // Segnaposto delle stesse misure, con lo stesso testo alternativo, finché le carte non arrivano (o se non arrivano)
    return <span className="figura-segnaposto" role="img" aria-label={alt} />;
  }
  // I disegni del pacchetto sono nascosti ai lettori di schermo: il testo alternativo sta sul contenitore (o, se la
  // didascalia lo ripete, il nome lo dice lei e il contenitore tace)
  if (taciuto)
    return (
      <span className="figura-disegno" aria-hidden="true">
        {simbolo(d)}
      </span>
    );
  return (
    <span className="figura-disegno" role="img" aria-label={alt}>
      {simbolo(d)}
    </span>
  );
}

function simbolo(d: Exclude<DisegnoRegole, { tipo: 'carta' }>): ReactNode {
  switch (d.tipo) {
    case 'pecora':
      return <Pecora pecora={d.pecora} size={90} />;
    case 'agnellino':
      return <Agnellino size={48} />;
    case 'montone':
      return <Montone size={90} />;
    case 'dado':
      return <Dado3D size={72} />;
    case 'faccia':
      return <FacciaDado faccia={d.faccia} size={56} />;
    case 'guaio':
      return <IconaGuaio tipo={d.guaio} size={40} />;
    case 'recinto':
      return <RecintoZone />;
  }
}
