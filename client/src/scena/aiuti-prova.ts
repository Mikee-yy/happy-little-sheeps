// Aiuti per le prove: un contesto completo su un elemento staccato dalla pagina, con il caso a seme fisso, e partite simulate.
import { applica, azioniPossibili, inAttesaDi, nuovaPartita, SETUP, tentaApplica, vistaPer } from '../../../engine/src';
import type { Azione, Stato, Vista } from '../../../engine/src';
import { semplice } from '../../../engine/sim/politiche';
import { esitoTestataCasuale, generatore } from '../../../engine/sim/simulatore';
import { creaContesto, type Contesto } from './contesto';
import { creaScheletro } from './scheletro';

/** Generatore a seme fisso (mulberry32): stessa sequenza a ogni prova. */
export function casoConSeme(seme = 12345): () => number {
  let s = seme >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Contesto per jsdom: scheletro in un `div` staccato, caso a seme fisso (o quello dato). */
export function contestoFinto(o: { caso?: () => number } = {}): Contesto {
  const radice = document.createElement('div');
  const el = creaScheletro(radice);
  return creaContesto(el, { caso: o.caso ?? casoConSeme() });
}

/**
 * Partite intere giocate dai bot come quelli di sync/prova.ts: Testata con esito a caso, altrimenti la strategia
 * "semplice" (o una mossa a caso); le fasi di sistema con la prima azione di sistema (prosegui o scadenza).
 * Dopo ogni mossa riceve la vista pubblica; `finita` vale true sull'ultima.
 */
export async function giocaPartiteSimulate(o: {
  n: 2 | 3 | 4;
  politica: 'semplice' | 'casuale';
  seme: number;
  inizio?(v: Vista): void;
  dopoMossa(v: Vista, finita: boolean): void | Promise<void>;
}): Promise<{ mosse: number }> {
  const r = generatore(o.seme);
  const pecore = SETUP.pecore.map((p) => p.id).slice(0, o.n);
  let s: Stato = nuovaPartita({ giocatori: pecore.map((pecora, i) => ({ id: `g${i + 1}`, nome: `G${i + 1}`, pecora })), seme: o.seme });
  o.inizio?.(vistaPer(s, null));
  let mosse = 0;
  while (!s.esito) {
    if (++mosse > MASSIMO_MOSSE) throw new Error(`partita simulata senza fine (fase ${s.fase.nome})`);
    s = applica(s, mossaDelBot(s, o.politica, r));
    await o.dopoMossa(vistaPer(s, null), !!s.esito);
  }
  return { mosse };
}

const MASSIMO_MOSSE = 20_000;

/**
 * La mossa successiva, come i bot di sync/prova.ts: chi è in attesa sceglie (Testata con esito a caso, altrimenti la
 * strategia "semplice" o una mossa a caso); le fasi di sistema prendono la prima azione di sistema (prosegui o scadenza).
 * La usa anche la pagina di sviluppo della scena ("Prossima mossa").
 */
export function mossaDelBot(s: Stato, politica: 'semplice' | 'casuale', r: () => number): Azione {
  const id = inAttesaDi(s).giocatori[0];
  if (id) {
    const azioni = azioniPossibili(s, id);
    const testate = azioni.filter((a) => a.tipo === 'esitoTestata');
    if (testate.length > 0) {
      const massimo = Math.max(...testate.map((a) => (a.tipo === 'esitoTestata' ? a.esito : 0)));
      return { tipo: 'esitoTestata', giocatore: id, esito: esitoTestataCasuale(massimo, r) };
    }
    const azione = politica === 'semplice' ? semplice.scegli(s, id, azioni, r) : azioni[Math.floor(r() * azioni.length)]!;
    return tentaApplica(s, azione).ok ? azione : azioni[Math.floor(r() * azioni.length)]!;
  }
  const sistema = azioniPossibili(s, 'sistema');
  if (!sistema[0]) throw new Error(`nessuno in attesa (fase ${s.fase.nome})`);
  return sistema[0];
}
