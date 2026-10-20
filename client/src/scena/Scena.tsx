// Il componente React della scena: monta il teatro in un div a tutto schermo e gli passa le fotografie della partita.
// React non entra nei fotogrammi: a ogni fotografia nuova chiama solo `recita` (la prima di ogni teatro "subito", senza
// recitare il passato). Il regista del teatro recita gli eventi nuovi della vista e dice quando è "occupato": la partita
// lo sa da `onOccupato` e intanto aspetta (domanda, "Passa il dispositivo", classifica, bot della prova).
// Al ritorno da un'altra scheda e quando la scena torna visibile si rimette in pari "subito", senza recitare di nuovo
// (punto di revisione 4); nascosta a metà recita si mette in pari e si libera, così la partita non resta ad aspettare.
// Le scelte (pezzo 3): la domanda di adesso e il pensiero della pecora in basso passano al teatro solo quando cambiano
// per contenuto (ogni `chiedi` che cambia la mano annullerebbe un trascinamento); i gesti e i pulsanti del pensiero
// arrivano sempre alle props più recenti.
// Nascosto ai lettori di schermo è solo il mondo disegnato (`.camera`, nel teatro): le zone e i pulsanti della domanda
// si raggiungono; accanto c'è il riassunto testuale della partita.
import { useLayoutEffect, useMemo, useRef } from 'react';
import './scena.css';
import type { Vista } from '../../../engine/src';
import { riassuntoTestuale, type Fotografia } from './fotografia';
import { piattaforma } from './piattaforma';
import type { Domanda, Gesto, Pensiero } from './scelte/tipi';
import { creaTeatro, type Teatro } from './teatro';

interface Props {
  foto: Fotografia;
  /** La vista del tavolo (`sessione.vista(null)`, mai una privata): i suoi eventi nuovi sono ciò che la scena recita. */
  vista: Vista;
  /** Scena montata ma non mostrata (la prova mentre si leggono le Regole): il ciclo si ferma, niente si distrugge. */
  nascosta?: boolean;
  /**
   * Scena coperta da "Passa il dispositivo": ciclo e audio fermi (batteria), ma la scena resta in pari con la fotografia
   * (la mano coperta si allinea come sempre). Non ferma niente mentre la scena recita; `nascosta` comanda su `sospesa`.
   */
  sospesa?: boolean;
  /** Riceve il teatro montato, null smontando: per chi deve chiamarlo da fuori (il menu, "Rivedi i suggerimenti"). */
  rifTeatro?: { current: Teatro | null };
  /** Ai cambi: true mentre la scena recita (la partita aspetta), false a recita finita e smontando. */
  onOccupato?: (occupato: boolean) => void;
  /** La domanda di adesso (null o assente: niente da chiedere). Mentre la scena recita non si passa. */
  domanda?: Domanda | null;
  /** Riceve i gesti sulla domanda. */
  suGesto?: (g: Gesto) => void;
  /** La nuvoletta del pensiero della pecora in basso (consigli e bot della prova). */
  pensiero?: Pensiero | null;
  /** true a teatro montato, false smontando: finché non è true la partita usa i pannelli del cassetto. */
  onPronto?: (pronto: boolean) => void;
}

/** Il teatro montato e ciò che gli è già stato dato. */
interface Montato {
  teatro: Teatro;
  /** Chiave dell'ultima fotografia recitata (null: ancora nessuna, la prossima va "subito"). */
  recitata: string | null;
  nascosta: boolean;
  /** Il ciclo è fermo per `sospesa` (non per `nascosta`). */
  sospesa: boolean;
  /** Contenuto della domanda passata al teatro (null: nessuna). */
  chiesta: string | null;
  /** Contenuto del pensiero passato al teatro (null: nessuno). */
  pensato: string | null;
}

/** Una fotografia uguale e nessun evento nuovo: niente da recitare. Gli eventi contano anche se la fotografia non cambia. */
const chiaveDi = (foto: Fotografia, vista: Vista): string =>
  `${vista.eventi.reduce((m, e) => Math.max(m, e.seq), 0)}|${JSON.stringify(foto)}`;

/** Il contenuto del pensiero: titolo, testo e pulsanti (le azioni no, si leggono dalle props più recenti). */
const contenutoPensiero = (p: Pensiero): string =>
  JSON.stringify([p.titolo ?? null, p.testo, p.pulsanti.map((b) => [b.testo, b.secondario ?? false])]);

export function Scena({ foto, vista, nascosta = false, sospesa = false, rifTeatro, onOccupato, domanda = null, suGesto, pensiero = null, onPronto }: Props) {
  const radice = useRef<HTMLDivElement>(null);
  const montato = useRef<Montato | null>(null);
  // Le ultime props, per chi le legge fuori dal rendering (ritorno sulla pagina, avvisi della regia, gesti, pulsanti del pensiero)
  const ultima = useRef({ foto, vista, nascosta, onOccupato, suGesto, pensiero, onPronto });
  // La stessa partita ricalcolata dà una fotografia nuova ma uguale: si confrontano i contenuti
  const chiave = useMemo(() => chiaveDi(foto, vista), [foto, vista]);

  // Effetti "di layout": la recita comincia prima che il browser disegni, e "occupato" arriva alla partita nello stesso
  // momento. Così la domanda o il "Passa a" della mossa appena fatta non compaiono per un fotogramma prima di sparire.
  // Un teatro per montaggio: il finto smontaggio di StrictMode lo distrugge e il secondo riparte pulito
  useLayoutEffect(() => {
    const el = radice.current!;
    const m: Montato = { teatro: creaTeatro(el), recitata: null, nascosta: false, sospesa: false, chiesta: null, pensato: null };
    montato.current = m;
    if (rifTeatro) rifTeatro.current = m.teatro;
    const smettiDiAscoltare = m.teatro.ascoltaOccupato((o) => ultima.current.onOccupato?.(o));
    const smettiDiOsservare = piattaforma.osservaMisura(el, () => m.teatro.adatta());
    const suVisibilita = (): void => {
      const u = ultima.current;
      if (document.visibilityState !== 'visible' || u.nascosta) return;
      m.teatro.recita(u.foto, u.vista, { subito: true });
      m.recitata = chiaveDi(u.foto, u.vista);
    };
    document.addEventListener('visibilitychange', suVisibilita);
    ultima.current.onPronto?.(true);
    return () => {
      document.removeEventListener('visibilitychange', suVisibilita);
      smettiDiOsservare();
      smettiDiAscoltare();
      m.teatro.distruggi();
      if (montato.current === m) montato.current = null;
      if (rifTeatro?.current === m.teatro) rifTeatro.current = null;
      // La scena non c'è più: nessuno deve restare ad aspettarla, e le scelte tornano ai pannelli
      ultima.current.onOccupato?.(false);
      ultima.current.onPronto?.(false);
    };
    // rifTeatro si legge solo al montaggio
  }, []);

  useLayoutEffect(() => {
    ultima.current = { foto, vista, nascosta, onOccupato, suGesto, pensiero, onPronto };
  });

  useLayoutEffect(() => {
    const m = montato.current;
    if (!m) return;
    if (nascosta !== m.nascosta) {
      m.nascosta = nascosta;
      if (nascosta) {
        // Nascosta a metà recita: in pari subito, così la regia si libera invece di aspettare un ciclo fermo
        if (m.teatro.occupato()) {
          m.teatro.recita(foto, vista, { subito: true });
          m.recitata = chiave;
        }
        m.teatro.sospendi(true);
      } else {
        // Torna visibile: misure nuove e scena in pari, senza recuperare i movimenti persi
        m.teatro.sospendi(false);
        m.teatro.adatta();
        m.recitata = null;
      }
    }
    if (nascosta || m.recitata === chiave) return;
    m.teatro.recita(foto, vista, m.recitata === null ? { subito: true } : undefined);
    m.recitata = chiave;
    // foto e vista cambiano insieme a chiave
  }, [chiave, nascosta]);

  // Sotto "Passa il dispositivo" il ciclo e l'audio si fermano. Dopo la recita (effetto sopra): se la fotografia appena
  // data fa recitare la scena, la recita deve poter finire e non si ferma niente. Se la scena è nascosta ci pensa la nascosta.
  useLayoutEffect(() => {
    const m = montato.current;
    if (!m) return;
    const ferma = sospesa && !nascosta && !m.teatro.occupato();
    if (ferma === m.sospesa) return;
    m.sospesa = ferma;
    m.teatro.sospendi(ferma);
  }, [sospesa, nascosta, chiave]);

  // Dopo la recita. Se la fotografia appena data fa recitare la scena, la domanda e il pensiero (calcolati a "scena libera"
  // un attimo prima che l'avviso arrivi alla partita) non si passano: tornano al rendering dopo la recita, come li vuole
  // la partita allora (il teatro non ne mostra uno vecchio a recita finita)
  useLayoutEffect(() => {
    const m = montato.current;
    if (!m) return;
    const libera = !m.teatro.occupato();
    const d = libera ? domanda : null;
    const chiesta = d ? JSON.stringify(d) : null;
    if (chiesta !== m.chiesta) {
      m.chiesta = chiesta;
      if (d) m.teatro.chiedi(d, (g) => ultima.current.suGesto?.(g));
      else m.teatro.smettiDiChiedere();
    }
    const p = libera ? pensiero : null;
    const pensato = p ? contenutoPensiero(p) : null;
    if (pensato !== m.pensato) {
      m.pensato = pensato;
      // Stesso contenuto, funzioni nuove a ogni rendering: i pulsanti chiamano l'azione del pensiero più recente
      m.teatro.pensa(
        p && { ...p, pulsanti: p.pulsanti.map((b, i) => ({ ...b, azione: () => ultima.current.pensiero?.pulsanti[i]?.azione() })) },
      );
    }
  });

  return (
    <div className="scena-gioco">
      <div ref={radice} className="teatro" />
      <ul className="solo-lettori">
        {riassuntoTestuale(foto).map((riga, i) => (
          <li key={i}>{riga}</li>
        ))}
      </ul>
    </div>
  );
}
