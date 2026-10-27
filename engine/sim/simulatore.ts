// Simulatore: gioca partite complete con il motore e raccoglie le statistiche (brief §8, fase 2).
import { applica, azioniPossibili, inAttesaDi, nuovaPartita, SETUP, tentaApplica } from '../src';
import type { Azione, FacciaDado, IdGiocatore, IdPecora, ModoVittoria, Stato } from '../src';
import { scegliACaso } from './politiche';
import type { Casuale, Politica } from './politiche';

const MASSIMO_AZIONI = 20_000;

/** Generatore con seme del simulatore (mulberry32), separato da quello del motore. */
export function generatore(seme: number): Casuale {
  let a = seme >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface RisultatoPartita {
  seme: number;
  numeroGiocatori: number;
  politica: string;
  /** Politica di ogni posto (tutte uguali tranne che nei tavoli misti). */
  politichePosti: string[];
  stato: 'ok' | 'errore' | 'stallo';
  errore?: string;
  round: number;
  azioni: number;
  modo: ModoVittoria | null;
  pecore: IdPecora[];
  /** Pecore vincitrici. */
  vincitori: IdPecora[];
  /** Posto del primo giocatore del round 1 (0 = primo seduto). */
  postoPrimo: number;
  vincitoriPosti: number[];
  eliminati: number;
  /** Posti degli eliminati, nell'ordine. */
  eliminatiPosti: number[];
  belatiFinali: number;
  beeeNo: number;
  annullate: number;
  guaiPresi: number;
  guaiInFondo: number;
  roundSenzaGuaio: number;
  facce: Record<string, number>;
  agnelliniFinali: number[];
  /** Azioni proposte dalla politica e rifiutate dal motore (sostituite da una a caso). */
  ripieghi: number;
}

/** Modifiche di bilanciamento da provare senza toccare i file dati: si applicano allo stato iniziale. */
export interface Variante {
  nome: string;
  /** Posti dell'Ovile per numero di giocatori. */
  postiOvile?: Partial<Record<number, number>>;
  /** Agnellini totali per numero di giocatori. */
  agnelliniTotali?: Partial<Record<number, number>>;
  dado?: FacciaDado[];
}

export function applicaVariante(s: Stato, v: Variante): void {
  const n = s.giocatori.length;
  const posti = v.postiOvile?.[n];
  if (posti !== undefined) s.config.postiOvile = posti;
  const totali = v.agnelliniTotali?.[n];
  if (totali !== undefined) {
    s.gregge += totali - s.config.agnelliniTotali;
    s.config.agnelliniTotali = totali;
  }
  if (v.dado) s.config.dado = v.dado.map((f) => ({ ...f }));
}

/** Esito della Testata per simulatore e bot (D43): probabilità di setup.json, troncato agli agnellini del bersaglio. */
export function esitoTestataCasuale(massimo: number, r: Casuale): number {
  const probabilita = SETUP.testata.probabilitaEsitoSimulatore;
  let resto = r();
  let esito = probabilita.length - 1;
  for (let i = 0; i < probabilita.length; i++) {
    resto -= probabilita[i] as number;
    if (resto < 0) {
      esito = i;
      break;
    }
  }
  return Math.min(esito, massimo);
}

/** Gioca una partita. Con `politiche` (una per posto, `g1` per primo) il tavolo è misto; altrimenti tutti usano `politica`. */
export function giocaPartita(o: {
  numeroGiocatori: number;
  seme: number;
  politica: Politica;
  politiche?: Politica[];
  variante?: Variante;
}): RisultatoPartita {
  const r = generatore(o.seme ^ 0x5eed);
  const perPosto = Array.from({ length: o.numeroGiocatori }, (_, i) => o.politiche?.[i] ?? o.politica);
  const tutte = SETUP.pecore.map((p) => p.id);
  const pecore: IdPecora[] = [];
  while (pecore.length < o.numeroGiocatori) {
    const p = scegliACaso(tutte.filter((x) => !pecore.includes(x)), r);
    pecore.push(p);
  }
  const ris: RisultatoPartita = {
    seme: o.seme,
    numeroGiocatori: o.numeroGiocatori,
    politica: o.politiche ? perPosto.map((p) => p.nome).join('+') : o.politica.nome,
    politichePosti: perPosto.map((p) => p.nome),
    stato: 'ok',
    round: 0,
    azioni: 0,
    modo: null,
    pecore,
    vincitori: [],
    postoPrimo: 0,
    vincitoriPosti: [],
    eliminati: 0,
    eliminatiPosti: [],
    belatiFinali: 0,
    beeeNo: 0,
    annullate: 0,
    guaiPresi: 0,
    guaiInFondo: 0,
    roundSenzaGuaio: 0,
    facce: {},
    agnelliniFinali: [],
    ripieghi: 0,
  };

  let s: Stato;
  try {
    s = nuovaPartita({
      giocatori: pecore.map((pecora, i) => ({ id: `g${i + 1}`, nome: `G${i + 1}`, pecora })),
      seme: o.seme,
    });
  } catch (e) {
    return { ...ris, stato: 'errore', errore: String(e) };
  }
  if (o.variante) applicaVariante(s, o.variante);
  const posto = (id: IdGiocatore) => s.giocatori.findIndex((g) => g.id === id);
  ris.postoPrimo = posto(s.primoGiocatore);
  let ultimoSeq = 0;
  const leggiEventi = () => {
    for (const e of s.eventi) {
      if (e.seq <= ultimoSeq) continue;
      ultimoSeq = e.seq;
      switch (e.tipo) {
        case 'dado_lanciato':
          ris.facce[e.faccia] = (ris.facce[e.faccia] ?? 0) + 1;
          break;
        case 'eliminato':
          ris.eliminati++;
          ris.eliminatiPosti.push(posto(e.giocatore));
          break;
        case 'belato_finale':
          ris.belatiFinali++;
          break;
        case 'annullata':
          ris.annullate++;
          break;
        case 'guaio_preso':
          ris.guaiPresi++;
          break;
        case 'guaio_in_fondo':
          ris.guaiInFondo++;
          break;
        case 'guaio_rivelato':
          if (e.carta === null) ris.roundSenzaGuaio++;
          break;
        case 'dichiarazione':
          if (e.dettagli.tipo === 'belato' && e.dettagli.effetto === 'beee_no') ris.beeeNo++;
          break;
        default:
          break;
      }
    }
  };
  leggiEventi();

  try {
    while (!s.esito) {
      if (++ris.azioni > MASSIMO_AZIONI) return { ...ris, stato: 'stallo', round: s.round, errore: `oltre ${MASSIMO_AZIONI} azioni in fase ${s.fase.nome}` };
      const attesa = inAttesaDi(s);
      let azione: Azione;
      let prossimo: Stato | null = null;
      if (attesa.giocatori.length > 0) {
        const g = scegliACaso(attesa.giocatori, r);
        const possibili = azioniPossibili(s, g);
        if (possibili.length === 0) return { ...ris, stato: 'stallo', round: s.round, errore: `${g} in attesa senza azioni in fase ${s.fase.nome}` };
        const testate = possibili.filter((a) => a.tipo === 'esitoTestata');
        if (testate.length > 0) {
          const massimo = Math.max(...testate.map((a) => (a.tipo === 'esitoTestata' ? a.esito : 0)));
          azione = { tipo: 'esitoTestata', giocatore: g, esito: esitoTestataCasuale(massimo, r) };
        } else {
          azione = (perPosto[posto(g)] ?? o.politica).scegli(s, g, possibili, r);
          const prova = tentaApplica(s, azione);
          if (prova.ok) prossimo = prova.stato;
          else {
            ris.ripieghi++;
            azione = scegliACaso(possibili, r);
          }
        }
      } else if (attesa.sistema) {
        azione = { tipo: 'prosegui' };
      } else {
        return { ...ris, stato: 'stallo', round: s.round, errore: `nessuno in attesa in fase ${s.fase.nome}` };
      }
      s = prossimo ?? applica(s, azione);
      leggiEventi();
    }
  } catch (e) {
    return { ...ris, stato: 'errore', round: s.round, errore: e instanceof Error ? `${e.name}: ${e.message}` : String(e) };
  }

  ris.round = s.round;
  ris.modo = s.esito.modo;
  ris.vincitoriPosti = s.esito.vincitori.map(posto);
  ris.vincitori = ris.vincitoriPosti.map((i) => pecore[i] as IdPecora);
  ris.agnelliniFinali = s.giocatori.map((g) => g.agnellini);
  return ris;
}

export function simula(o: {
  numeroGiocatori: number;
  partite: number;
  semeIniziale: number;
  politica: Politica;
  variante?: Variante;
}): RisultatoPartita[] {
  const risultati: RisultatoPartita[] = [];
  for (let i = 0; i < o.partite; i++) {
    risultati.push(giocaPartita({ numeroGiocatori: o.numeroGiocatori, seme: o.semeIniziale + i, politica: o.politica, variante: o.variante }));
  }
  return risultati;
}

/**
 * Tavoli misti: `tavolo` ha una politica per posto. A ogni partita i posti ruotano di uno, così ogni politica siede
 * in ogni posto lo stesso numero di volte (il primo giocatore resta estratto dal motore).
 */
export function simulaMiste(o: { tavolo: Politica[]; partite: number; semeIniziale: number; variante?: Variante }): RisultatoPartita[] {
  const n = o.tavolo.length;
  const risultati: RisultatoPartita[] = [];
  for (let i = 0; i < o.partite; i++) {
    const politiche = o.tavolo.map((_, posto) => o.tavolo[(posto + i) % n] as Politica);
    risultati.push(
      giocaPartita({ numeroGiocatori: n, seme: o.semeIniziale + i, politica: politiche[0] as Politica, politiche, variante: o.variante }),
    );
  }
  return risultati;
}
