// Il regista: recita le battute del copione con gli ordini del teatro, una dopo l'altra, e a coda vuota mette in pari
// la scena con la fotografia più recente (la verità resta il motore). Dice quando è "occupato": finché una battuta
// fa ancora aspettare la partita o la coda non è vuota. Lo decidono le promesse delle battute, mai `eventoInCorso()`:
// un meteo sullo sfondo è un evento in corso, ma la partita non lo aspetta.
// Progetto: bozze/scena-gioco-2-progetto.md, § 2.2.
import type { Vista } from '../../../../engine/src';
import type { Contesto } from '../contesto';
import type { Fotografia } from '../fotografia';
import type { Ordini } from '../ordini';
import { copione, type Battuta } from './copione';

/** Oltre queste battute in coda la scena si mette in pari "subito", senza recitare. */
export const MASSIMO_BATTUTE_IN_CODA = 8;
/**
 * Tempo massimo di una battuta, in tempo vero (`setTimeout`): quando il browser non disegna, l'orologio della scena
 * si ferma, e la partita non deve restare ad aspettare. È l'unica eccezione alla regola del tempo della scena.
 */
export const TEMPO_MASSIMO_BATTUTA_MS = 25_000;
/** Ogni quanto si guarda se gli agnellini di una battuta sono arrivati (tempo della scena, timer decorativo). */
const PASSO_ARRIVO_MS = 33;

export interface DipendenzeRegista {
  ctx: Contesto;
  ordini: Ordini;
  /** La messa in pari del teatro. Una ricostruzione (sempre con `subito`) chiama `svuota` alla fine, come ultima cosa. */
  allinea(f: Fotografia, modo: 'calmo' | 'subito'): void;
  /** Il tavolo va ricostruito per questa fotografia (chi sta dove è cambiato)? */
  daRicostruire(f: Fotografia): boolean;
}

export interface OpzioniRecita {
  subito?: boolean;
}

export interface Regista {
  /**
   * Accoda le battute degli eventi nuovi (seq > ultimo recitato) e ricorda la fotografia; la prima volta mette in pari subito.
   * Con `subito` (ritorno da un'altra scheda): niente recita, coda svuotata, messa in pari subito, e gli eventi della
   * vista contano come già recitati.
   */
  recita(foto: Fotografia, vista: Vista, o?: OpzioniRecita): void;
  /** La fotografia che la scena mostrerà a fine recita (null se non c'è una recita in corso). */
  fotoRecente(): Fotografia | null;
  occupato(): boolean;
  /** Avvisa solo ai cambi; restituisce la funzione che toglie l'ascoltatore. */
  ascoltaOccupato(cb: (occupato: boolean) => void): () => void;
  /** La scena è stata rimessa in pari subito (ricostruzione): via la coda e la battuta in corso, regista libero. */
  svuota(): void;
  /** Si ferma, avvisa "libero" se era occupato e toglie gli ascoltatori. */
  distruggi(): void;
}

export function creaRegista(d: DipendenzeRegista): Regista {
  const { ctx, ordini } = d;
  const coda: Battuta[] = [];
  const ascoltatori = new Set<(occupato: boolean) => void>();
  let ultimoSeq: number | null = null;
  let ultimaFoto: Fotografia | null = null;
  let occupato = false;
  let distrutto = false;
  /** C'è una recita in corso (il giro delle battute). */
  let inScena = false;
  /** Cresce a ogni svuotamento: il giro di prima, quando riprende, vede che deve fermarsi. */
  let giro = 0;
  /** La battuta in corso: il timer vero del tempo massimo e la fine anticipata (svuota, distruggi). */
  let timerVero: ReturnType<typeof setTimeout> | null = null;
  let chiudiBattuta: (() => void) | null = null;

  function imposta(v: boolean): void {
    if (v === occupato) return;
    occupato = v;
    for (const cb of [...ascoltatori]) {
      try {
        cb(v);
      } catch (e) {
        console.error(e);
      }
      // Un ascoltatore ha già fatto cambiare lo stato (una recita nuova appena liberi): l'avviso vecchio non va oltre
      if (occupato !== v) return;
    }
  }

  function fermaBattuta(): void {
    if (timerVero !== null) clearTimeout(timerVero);
    timerVero = null;
    chiudiBattuta?.();
    chiudiBattuta = null;
  }

  /** La promessa della battuta, il tempo massimo o la fine anticipata: quello che arriva prima. */
  function conTempoMassimo(p: Promise<void>): Promise<void> {
    return new Promise<void>((fine) => {
      let chiusa = false;
      const chiudi = (): void => {
        if (chiusa) return;
        chiusa = true;
        clearTimeout(timer);
        // Solo se è ancora lei la battuta in corso (dopo uno svuotamento ne può essere cominciata un'altra)
        if (chiudiBattuta === chiudi) {
          timerVero = null;
          chiudiBattuta = null;
        }
        fine();
      };
      const timer = setTimeout(chiudi, TEMPO_MASSIMO_BATTUTA_MS);
      timerVero = timer;
      chiudiBattuta = chiudi;
      p.then(chiudi, (e: unknown) => {
        console.error(e);
        chiudi();
      });
    });
  }

  /** Un passo di attesa sull'orologio della scena che non tiene in corso un evento. */
  const passo = (): Promise<void> => new Promise((fine) => void ctx.orologio.dopo(fine, PASSO_ARRIVO_MS, { decorativo: true }));

  /** Gli agnellini partono (il ladro salta, le vittime si scuotono); la battuta finisce quando sono tutti arrivati. */
  async function agnellini(b: Extract<Battuta, { tipo: 'agnellini' }>, mio: number): Promise<void> {
    const prima = new Set(ctx.regia.inViaggio);
    if (b.ladro !== null) ordini.reagisci(b.ladro, 'salto');
    for (const s of b.spostamenti) {
      if (b.ladro !== null && s.da !== 'gregge') ordini.reagisci(s.da, 'scossa');
      ordini.spostaAgnellini(s.quanti, s.da, s.a, b.modo);
    }
    const partiti = [...ctx.regia.inViaggio].filter((g) => !prima.has(g));
    while (mio === giro && !distrutto && partiti.some((g) => ctx.inViaggioValido(g))) await passo();
  }

  /** L'ordine del teatro per la battuta: la promessa dice quando la partita smette di aspettare. */
  function ordine(b: Battuta, mio: number): Promise<void> {
    const massimo = b.attesa.tipo === 'massimo' ? b.attesa.ms : undefined;
    switch (b.tipo) {
      case 'guaioRivelato':
        return ordini.guaioRivelato(b.carta);
      case 'annuncio':
        return ordini.annuncio(b.testo, massimo);
      case 'giraCarte':
        return ordini.giraCarte(b.carte);
      case 'fumetti':
        return ordini.fumetti(b.testi, massimo);
      case 'volaCarta':
        return ordini.volaCarta(b.daChi, b.carta, b.testo);
      case 'beeeNo':
        return ordini.annullamento(b.chi, b.annullato, b.carta);
      case 'dado':
        return ordini.dado(b.faccia);
      case 'agnellini':
        return agnellini(b, mio);
      case 'testata':
        return ordini.testata(b.chi, b.bersaglio, b.quanti);
      case 'guaio':
        // Chi ha deviato il Guaio fa la finta svenuta mentre la carta vola verso l'altra pecora
        if (b.deviatoDa !== null) ordini.reagisci(b.deviatoDa, 'svenuta');
        return ordini.guaio(b.carta, b.chi, massimo === undefined ? undefined : { liberaDopoMs: massimo });
      case 'eliminata':
        return ordini.eliminata(b.chi);
      case 'festa':
        return ordini.festa(b.vincitori);
    }
  }

  async function recitaCoda(): Promise<void> {
    const mio = giro;
    inScena = true;
    imposta(true);
    while (coda.length > 0) {
      const b = coda.shift()!;
      // Un salto vale per la battuta in cui è stato chiesto: quelle dopo vanno a velocità normale
      ctx.regia.salto = false;
      let p: Promise<void>;
      try {
        p = ordine(b, mio);
      } catch (e) {
        console.error(e);
        p = Promise.resolve();
      }
      // Una battuta che non fa aspettare va avanti per conto suo
      if (b.attesa.tipo === 'niente') {
        p.catch((e: unknown) => console.error(e));
        p = Promise.resolve();
      }
      await conTempoMassimo(p);
      if (mio !== giro || distrutto) return;
    }
    inScena = false;
    try {
      if (ultimaFoto) d.allinea(ultimaFoto, 'calmo');
    } catch (e) {
      console.error(e);
    }
    imposta(false);
  }

  /** Coda vuota, battuta in corso chiusa, regista libero (la scena l'ha già messa in pari chi chiama). */
  function svuota(): void {
    giro++;
    coda.length = 0;
    inScena = false;
    fermaBattuta();
    imposta(false);
  }

  /**
   * Niente recita: ricostruzione con la fotografia. Il teatro, ricostruendo, chiama `svuota` come ultima cosa: qui non
   * si svuota di nuovo, o una recita fatta ripartire da un ascoltatore appena libero verrebbe fermata.
   */
  function subito(f: Fotografia): void {
    d.allinea(f, 'subito');
  }

  return {
    recita(foto, vista, o = {}) {
      if (distrutto) return;
      const seqVista = vista.eventi.reduce((m, e) => Math.max(m, e.seq), 0);
      ultimaFoto = foto;
      // La prima fotografia (partita nuova o ripresa) si mostra subito, senza recitare gli eventi passati.
      // Così anche una partita nuova sullo stesso teatro (Rigioca), i cui eventi ripartono da capo,
      // e il ritorno da un'altra scheda (`subito`)
      if (o.subito || ultimoSeq === null || seqVista < ultimoSeq) {
        ultimoSeq = seqVista;
        subito(foto);
        return;
      }
      const gia = ultimoSeq;
      ultimoSeq = seqVista;
      if (d.daRicostruire(foto)) return subito(foto);
      coda.push(...copione(vista.eventi.filter((e) => e.seq > gia), vista));
      if (coda.length > MASSIMO_BATTUTE_IN_CODA) return subito(foto);
      if (inScena) return;
      if (coda.length === 0) d.allinea(foto, 'calmo');
      else void recitaCoda();
    },
    fotoRecente: () => (inScena ? ultimaFoto : null),
    occupato: () => occupato,
    ascoltaOccupato(cb) {
      ascoltatori.add(cb);
      return () => {
        ascoltatori.delete(cb);
      };
    },
    svuota() {
      if (!distrutto) svuota();
    },
    distruggi() {
      if (distrutto) return;
      // Prima il segno: un ascoltatore che all'avviso "libero" chiama `recita` non fa ripartire niente
      distrutto = true;
      svuota();
      ascoltatori.clear();
    },
  };
}
