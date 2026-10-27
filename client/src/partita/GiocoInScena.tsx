// Il gioco dentro la scena 2,5D, comune alla partita su un dispositivo (Partita) e alle stanze: la scena caricata a parte,
// la domanda di adesso (scena/scelte/) con la scelta a metà, i gesti che diventano mosse, la scritta della domanda nella
// striscia in cima (anche la fionda della Testata è una domanda della scena). Finché la scena non è pronta (si scarica, o
// non è arrivata) al suo posto ci sono i pannelli di riserva di chi lo usa.
// Chi lo usa decide tutto il resto: la fotografia (con la mano già decisa, regola anti-sbirciata), il momento, se la
// domanda si può mostrare (`conAzioni`: scena libera, niente strati sopra), cosa fare di "risponde"/"indietro", il menu.
import { useLayoutEffect, useRef, useState } from 'react';
import type { Azione, IdGiocatore, Vista } from '../../../engine/src';
import type { Fotografia } from '../scena/fotografia';
import { avanza, chiaveDi, domandaDi, sceltaVuota } from '../scena/scelte/domanda';
import type { Domanda, Gesto, Momento, Pensiero, Scelta } from '../scena/scelte/tipi';
import { piattaforma } from '../scena/piattaforma';
import type { Teatro } from '../scena/teatro';
import { T } from '../testi';
import { Cronaca } from './componenti';
import { ScenaCaricata } from './ScenaCaricata';
import { Intestazione } from './Tavolo';

/**
 * La scritta della domanda nella striscia in cima, al posto della cronaca: cosa fare (al più due righe), gli avvisi e
 * l'errore del motore. Gli avvisi, piccoli e di seguito (ognuno con il suo "!"), stanno fuori dal taglio: sono ciò che il
 * giocatore deve leggere. Con `onChiudi` a destra c'è la X che nasconde la scritta per questa domanda.
 */
export function Scritta({
  d,
  errore,
  giocatore,
  onChiudi,
}: {
  d: Domanda;
  errore: string | null;
  giocatore: IdGiocatore | null;
  onChiudi?: () => void;
}) {
  return (
    <div className="scritta-scena" role="status" data-giocatore={giocatore ?? undefined}>
      <div className="scritta-riga">
        <p className="scritta">{d.scritta}</p>
        {onChiudi && (
          <button type="button" className="scritta-chiudi" aria-label={T.scena.scelte.chiudiScritta} onClick={onChiudi}>
            ×
          </button>
        )}
      </div>
      {d.avvisi.length > 0 && (
        <p className="scritta-avvisi">
          {d.avvisi.map((a, i) => (
            <span key={i} className="scritta-avviso">
              {a}
            </span>
          ))}
        </p>
      )}
      {errore && (
        <p className="errore" role="alert">
          {errore}
        </p>
      )}
    </div>
  );
}

/** Altezza della striscia in cima (intestazione e cronaca) più un respiro, finché non la si misura (jsdom: sempre questa). */
const SPAZIO_ALTO_RISERVA = 67;

export interface PropsGiocoInScena {
  /** La vista del tavolo: la scena ne recita gli eventi (mai una vista privata); intestazione e cronaca la leggono. */
  tavolo: Vista;
  /** La fotografia per la scena, con la mano già decisa da chi lo usa (anti-sbirciata). */
  foto: Fotografia;
  /** Il momento della domanda; null: nessuna domanda (attesa, recita, fine). */
  momento: Momento | null;
  /** La domanda si può mostrare: scena libera, niente strati sopra. */
  conAzioni: boolean;
  /** Manda la mossa; restituisce se è stata accettata (falso: la scelta riparte vuota e si può rispondere di nuovo). */
  invia: (a: Azione) => boolean;
  /** L'errore da mostrare nella scritta (lo tiene chi lo usa: lo mostra anche nella riserva). */
  errore: string | null;
  /** La X della scritta toglie anche l'errore. */
  togliErrore: () => void;
  /** Cambiata la domanda: chi lo usa toglie l'errore del motore della domanda di prima (non i rifiuti di chi ospita). */
  suCambioDomanda?: () => void;
  /** "Chi risponde?": il giocatore scelto toccandone la pecora (solo sul dispositivo condiviso). */
  onRisponde?: (chi: IdGiocatore) => void;
  /** "Annulla" torna a "Chi risponde?" (solo sul dispositivo condiviso). */
  onIndietro?: () => void;
  /** Il pulsante del menu nell'intestazione. */
  onMenu: () => void;
  /** Il pensiero della pecora in basso, nella nuvoletta (null mentre la scena recita o qualcosa la copre). */
  pensiero?: Pensiero | null;
  /** In fondo alla striscia, sotto la scritta o la cronaca: per esempio il conto alla rovescia delle stanze. */
  inStriscia?: React.ReactNode;
  /** Nella striscia al posto della cronaca quando non c'è una domanda (per esempio "Aspetta…" nelle stanze). */
  strisciaSenzaDomanda?: React.ReactNode;
  /**
   * Strato opaco sopra la scena (per esempio "Passa il dispositivo"): al posto della striscia e della riserva, con la
   * scena sospesa sotto (ciclo e audio fermi) ma montata.
   */
  copertura?: React.ReactNode;
  /** I pannelli da mostrare in basso finché la scena non è pronta (si scarica, o non è arrivata). */
  riserva: React.ReactNode;
  /** La riserva prende tutta l'altezza sotto la striscia (il tiro del montone nel cassetto). */
  riservaATuttaAltezza?: boolean;
  rifTeatro?: { current: Teatro | null };
  /** Ai cambi di "la scena recita". */
  onOccupato?: (occupata: boolean) => void;
  /** Montato ma non mostrato: la scena non consuma. */
  nascosta?: boolean;
  /**
   * Sblocco da fuori: cambia a ogni mossa rifiutata dopo essere partita (nelle stanze, il rifiuto di chi ospita). Al
   * cambio i gesti tornano validi anche sulla stessa domanda e la scelta a metà riparte vuota.
   */
  sblocca?: number;
  /**
   * Nelle stanze: ciò che cambia quando cambia la situazione di chi gioca sul telefono (le sue mosse permesse, la sua
   * mano, la sua scelta…). Dopo una mossa il blocco dura finché non cambia (o finché non cambia `sblocca`): la mossa
   * aspetta chi ospita e l'evento di un altro giocatore non deve sbloccarla. Senza (un dispositivo) il blocco dura fino al
   * prossimo evento del tavolo.
   */
  situazione?: string;
  /** Scena ferma (ciclo e audio) anche senza copertura. */
  sospesa?: boolean;
  /** La partita si salva nel browser (falso nella prova): decide il testo "Ricarica la pagina" (vedi ScenaCaricata). */
  salvata?: boolean;
}

export function GiocoInScena(p: PropsGiocoInScena) {
  const { tavolo, momento, invia } = p;
  const sblocca = p.sblocca ?? 0;
  /** La scena è montata: si gioca toccandola. Finché non lo è si gioca con la riserva. */
  const [scenaPronta, setScenaPronta] = useState(false);
  /**
   * La scelta a metà nella scena (carte sollevate, agnellini presi…): vale solo per la domanda con la sua chiave e per lo
   * sblocco con cui è nata.
   */
  const [scelta, setSceltaDi] = useState<{ s: Scelta; sblocca: number } | null>(null);
  const setScelta = (s: Scelta) => setSceltaDi({ s, sblocca });
  /** La domanda (la sua chiave) per cui si è chiusa la scritta in alto con la X: con la domanda successiva ricompare. */
  const [scrittaChiusaPer, setScrittaChiusaPer] = useState<string | null>(null);
  /**
   * Firma della domanda a cui si è appena risposto con una mossa: i gesti dopo si ignorano finché non cambia (punto 1).
   * Contiene lo sblocco: cambiando `sblocca` non vale più.
   */
  const risposta = useRef<string | null>(null);
  /** Mosse rifiutate subito da `invia`: la fionda nella scena torna a mirare (vedi `tentativo` di Domanda.fionda). */
  const [rifiutateSubito, setRifiutateSubito] = useState(0);
  const testata = useRef<HTMLDivElement>(null);
  const [spazioAlto, setSpazioAlto] = useState(SPAZIO_ALTO_RISERVA);
  // Coperto solo da un contenuto vero: `null`, `undefined` e `false` (come in `{cond && <Copertura/>}`) non coprono
  const coperta = p.copertura != null && p.copertura !== false;

  // Il suggerimento dei gesti della scena va subito sotto la striscia in cima: se ne misura il fondo (cambia con la cronaca)
  useLayoutEffect(() => {
    const el = testata.current;
    if (!el) return;
    const misura = () => {
      const fondo = el.getBoundingClientRect().bottom;
      if (fondo > 0) setSpazioAlto(Math.ceil(fondo) + 1);
    };
    misura();
    return piattaforma.osservaMisura(el, misura);
  }, [coperta]);

  const chiaveMomento = momento ? chiaveDi(momento) : null;
  // Le chiavi si ripetono tra i round: la X vale solo finché la domanda è la stessa, alla prossima la scritta torna da sola
  if (scrittaChiusaPer !== null && scrittaChiusaPer !== chiaveMomento) setScrittaChiusaPer(null);
  // L'errore del motore riguarda la domanda a cui si rispondeva: cambiata la domanda (scelto chi risponde, Annulla, la mossa
  // successiva) non resta appeso. La prima volta non c'è niente da togliere. Effetto di layout: chi lo usa si ridisegna
  // prima che il browser dipinga, così l'errore vecchio non si vede mai con la domanda nuova.
  const chiavePrecedente = useRef(chiaveMomento);
  useLayoutEffect(() => {
    if (chiavePrecedente.current === chiaveMomento) return;
    chiavePrecedente.current = chiaveMomento;
    p.suCambioDomanda?.();
    // suCambioDomanda è di chi usa il componente e cambia a ogni disegno: conta solo il cambio di domanda
  }, [chiaveMomento]);
  // Cambiate le mosse permesse (o lo schermo) la scelta a metà riparte vuota (punto di revisione 3); così anche cambiato
  // lo sblocco (mossa rifiutata dopo essere partita)
  const sceltaOra =
    chiaveMomento === null
      ? null
      : scelta?.s.chiave === chiaveMomento && scelta.sblocca === sblocca
        ? scelta.s
        : sceltaVuota(chiaveMomento);
  // Solo a scena libera, senza strati sopra (conAzioni)
  const domanda = momento && sceltaOra && scenaPronta && p.conAzioni ? domandaDi(momento, sceltaOra) : null;
  // La stessa domanda dopo una mossa riuscita ha comunque un evento in più (o, nelle stanze, una situazione nuova di chi
  // gioca sul telefono): la firma cambia
  const firma = `${chiaveMomento}#${p.situazione ?? tavolo.eventi.reduce((m, e) => Math.max(m, e.seq), 0)}#${sblocca}`;
  // La fionda nella scena ricorda il tiro già fatto finché il tentativo non cambia: cambia con la firma (sblocco, mossa
  // riuscita) e con una mossa rifiutata subito
  const domandaInScena: Domanda | null = domanda?.fionda
    ? { ...domanda, fionda: { ...domanda.fionda, tentativo: `${firma}#${rifiutateSubito}` } }
    : domanda;
  const suGesto = (g: Gesto): void => {
    // Un secondo tocco prima che la partita si ridisegni (o uno in ritardo sulla domanda vecchia) non manda un'altra mossa
    if (!domanda || !momento || !sceltaOra || chiaveMomento === null || risposta.current === firma) return;
    const r = avanza(momento, sceltaOra, g);
    // `avanza` dà la stessa scelta quando non cambia niente: nessun nuovo rendering
    if (r.scelta !== sceltaOra) setScelta(r.scelta);
    const e = r.esito;
    if (!e) return;
    if (e.tipo === 'risponde') p.onRisponde?.(e.chi);
    else if (e.tipo === 'indietro') p.onIndietro?.();
    else {
      risposta.current = firma;
      if (!invia(e.azione)) {
        // Rifiutata subito (non dovrebbe succedere): la scritta mostra l'errore e la domanda si ripresenta, vuota
        risposta.current = null;
        setScelta(sceltaVuota(chiaveMomento));
        setRifiutateSubito((n) => n + 1);
      }
    }
  };
  const attivo = momento?.schermo.tipo === 'privata' ? momento.schermo.giocatore : null;

  // La scena arriva in un pacchetto a parte: finché non c'è, il prato vuoto; se non arriva, "Riprova".
  // Recita gli eventi della vista del tavolo (mai una vista privata)
  const scenaPrato = (
    <ScenaCaricata
      foto={p.foto}
      vista={tavolo}
      nascosta={p.nascosta}
      sospesa={coperta || p.sospesa}
      rifTeatro={p.rifTeatro}
      onOccupato={p.onOccupato}
      domanda={domandaInScena}
      suGesto={suGesto}
      pensiero={p.pensiero}
      onPronto={setScenaPronta}
      salvata={p.salvata}
    />
  );

  if (coperta) {
    return (
      <>
        {scenaPrato}
        {p.copertura}
      </>
    );
  }

  return (
    <>
      {scenaPrato}
      {/* In cima una striscia sottile: le targhe degli avversari restano visibili */}
      <div className="testata-scena" ref={testata}>
        <Intestazione v={tavolo} onMenu={p.onMenu} />
        {domanda ? (
          // Chiusa con la X resta nascosta per questa domanda; un errore del motore la riapre
          scrittaChiusaPer === chiaveMomento && !p.errore ? null : (
            <Scritta
              d={domanda}
              errore={p.errore}
              giocatore={attivo}
              onChiudi={() => {
                // La X sparisce con la scritta: il fuoco della tastiera passa al menu, non si perde
                testata.current?.querySelector<HTMLElement>('.pulsante-menu')?.focus();
                setScrittaChiusaPer(chiaveMomento);
                p.togliErrore();
              }}
            />
          )
        ) : (
          (p.strisciaSenzaDomanda ?? <Cronaca v={tavolo} />)
        )}
        {p.inStriscia}
      </div>
      {/* In basso, sopra il prato: la riserva di chi lo usa, finché la scena non è pronta */}
      <div
        className={`fondo-scena${!scenaPronta && p.riservaATuttaAltezza ? ' a-tutta-altezza' : ''}`}
        style={{ '--spazio-alto': `${spazioAlto}px` } as React.CSSProperties}
      >
        {!scenaPronta && p.riserva}
      </div>
    </>
  );
}
