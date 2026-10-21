// Partite intere giocate dal motore scegliendo a caso tra gli elementi della domanda (carte, pecore, dado, Guai,
// carte grandi, pulsanti attivi): ogni mossa prodotta è accettata dal motore, ogni domanda ha qualcosa di attivo,
// ogni partita finisce. Il momento si costruisce come farà Partita (vista, mosse permesse, mano scoperta).
import { describe, expect, it } from 'vitest';
import { nuovaPartita, tentaApplica } from '../../../../engine/src';
import type { Azione, IdGiocatore, Stato } from '../../../../engine/src';
import { momentoDi } from './aiuti-momento';
import { avanza, chiaveDi, domandaDi, sceltaVuota } from './domanda';
import type { Domanda, Gesto, Momento, Scelta } from './tipi';

const PECORE = ['ricciolo', 'brontolana', 'sospirella', 'nerina'] as const;
const LIMITE_GESTI = 3000;

/** Generatore pseudo-casuale con seme (mulberry32): le partite sono ripetibili. */
function casuale(seme: number): () => number {
  let a = seme >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Il momento come lo costruirà Partita; la mano è scoperta solo nelle schermate private. */
function momentoPartita(s: Stato, scelto: IdGiocatore | null): Momento {
  const m = momentoDi(s, { scelto });
  return { ...m, manoScoperta: m.schermo.tipo === 'privata' && 'giocatore' in m.schermo };
}

/** Ogni gesto possibile sugli elementi attivi della domanda. */
function gestiDi(d: Domanda): Gesto[] {
  const gesti: Gesto[] = [];
  for (const carta of d.carte) gesti.push({ tipo: 'carta', carta });
  for (const carta of d.trascinabili) gesti.push({ tipo: 'trascinata', carta });
  for (const chi of d.pecore) gesti.push({ tipo: 'pecora', chi });
  if (d.dado) gesti.push({ tipo: 'dado' });
  for (const carta of d.guai) gesti.push({ tipo: 'guaio', carta });
  for (const carta of d.grandi) gesti.push({ tipo: 'grande', carta });
  for (const [chi, n] of Object.entries(d.furto?.presi ?? {})) if ((n ?? 0) > 0) gesti.push({ tipo: 'agnellino', chi });
  for (const p of d.pulsanti) if (p.attivo) gesti.push({ tipo: 'pulsante', id: p.id });
  return gesti;
}

/** Una partita giocata: i gesti, le mosse, lo stato finale e gli schermi incontrati. */
interface Giocata {
  gesti: number;
  mosse: number;
  stato: Stato;
  visti: Set<string>;
}

/** Ogni quanti gesti il momento si ricostruisce anche senza mosse (vedi `momentoCorrente`). */
const RICOSTRUISCI_OGNI = 5;

function giocaPartita(giocatori: number, seme: number): Giocata {
  const visti = new Set<string>();
  const caso = casuale(seme * 7919 + giocatori);
  const scegli = <T>(lista: T[]): T => lista[Math.floor(caso() * lista.length)]!;
  let stato = nuovaPartita({
    giocatori: Array.from({ length: giocatori }, (_, i) => ({ id: `g${i + 1}`, nome: `Giocatore ${i + 1}`, pecora: PECORE[i]! })),
    seme,
  });
  let scelto: IdGiocatore | null = null;
  let scelta: Scelta | null = null;
  let gesti = 0;
  let mosse = 0;
  // Il momento dipende solo da stato e scelto: tra un gesto e l'altro, senza mosse, di solito non si ricostruisce. Ogni
  // RICOSTRUISCI_OGNI gesti sì, come un disegno nuovo della partita: liste di azioni nuove con la stessa chiave, quindi la
  // scelta a metà che continua su un momento fresco e i dati del furto ricalcolati (la WeakMap non li trova)
  let memoria: { stato: Stato; scelto: IdGiocatore | null; momento: Momento } | null = null;
  const momentoCorrente = (): Momento => {
    const fresco = gesti % RICOSTRUISCI_OGNI === RICOSTRUISCI_OGNI - 1;
    if (fresco || !memoria || memoria.stato !== stato || memoria.scelto !== scelto) {
      memoria = { stato, scelto, momento: momentoPartita(stato, scelto) };
    }
    return memoria.momento;
  };

  const applicaPermessa = (m: Momento, azione: Azione) => {
    expect([...m.azioni, ...m.sistema], 'la mossa non è uno degli oggetti permessi').toContain(azione);
    const r = tentaApplica(stato, azione);
    expect(r.ok, `il motore rifiuta ${JSON.stringify(azione)}: ${!r.ok ? r.errore.message : ''}`).toBe(true);
    if (r.ok) stato = r.stato;
    mosse++;
    scelto = null;
    scelta = null;
  };

  while (gesti < LIMITE_GESTI) {
    const m = momentoCorrente();
    if (m.schermo.tipo === 'fine') break;
    const chiave = chiaveDi(m);
    visti.add(m.schermo.tipo === 'privata' || m.schermo.tipo === 'pubblica' ? `${m.schermo.tipo}:${m.schermo.pannello}` : m.schermo.tipo);
    if (!scelta || scelta.chiave !== chiave) scelta = sceltaVuota(chiave);
    const d = domandaDi(m, scelta);
    expect(d, `domanda assente per lo schermo ${JSON.stringify(m.schermo)}`).not.toBeNull();
    if (!d) break;
    gesti++;
    if (d.testata) {
      // Il riquadro di mira manda un esito permesso da solo.
      const esiti = m.azioni.filter((a) => a.tipo === 'esitoTestata');
      expect(esiti.length).toBeGreaterThan(0);
      applicaPermessa(m, scegli(esiti));
      continue;
    }
    const possibili = gestiDi(d);
    expect(possibili.length, `nessun elemento attivo per lo schermo ${JSON.stringify(m.schermo)}`).toBeGreaterThan(0);
    const g = scegli(possibili);
    const r = avanza(m, scelta, g);
    scelta = r.scelta;
    if (!r.esito) continue;
    if (r.esito.tipo === 'mossa') applicaPermessa(m, r.esito.azione);
    else if (r.esito.tipo === 'risponde') {
      scelto = r.esito.chi;
      scelta = null;
    } else {
      // indietro: di nuovo "Chi risponde?"
      scelto = null;
      scelta = null;
    }
  }
  return { gesti, mosse, stato, visti };
}

/** Ogni partita si gioca una volta sola, anche se la chiedono più prove (la prova sugli schermi non dipende dalle altre). */
const giocate = new Map<string, Giocata>();
function giocata(giocatori: number, seme: number): Giocata {
  const chiave = giocatori + ':' + seme;
  if (!giocate.has(chiave)) giocate.set(chiave, giocaPartita(giocatori, seme));
  return giocate.get(chiave)!;
}

const SEMI = [2, 3, 4].flatMap((giocatori) => Array.from({ length: 10 }, (_, k) => ({ giocatori, seme: giocatori * 1000 + k + 1 })));

describe('partite intere a caso tra gli elementi della domanda', () => {
  for (const { giocatori, seme } of SEMI) {
    it(`${giocatori} giocatori, seme ${seme}: ogni mossa è permessa e la partita finisce`, () => {
      const { gesti, mosse, stato } = giocata(giocatori, seme);
      expect(gesti).toBeLessThan(LIMITE_GESTI);
      expect(mosse).toBeGreaterThan(0);
      expect(stato.esito !== null || stato.fase.nome === 'fine_partita').toBe(true);
    });
  }

  it('le partite hanno attraversato i momenti con la mano e quelli del tavolo', () => {
    // Le partite non dipendono dalle prove prima: se non sono già state giocate, si giocano qui (una volta sola)
    const visti = new Set(SEMI.flatMap(({ giocatori, seme }) => [...giocata(giocatori, seme).visti]));
    for (const atteso of [
      'privata:scelta',
      'privata:effetto',
      'privata:richiesta',
      'privata:belato_finale',
      'privata:punteggio',
      'privata:reazione',
      'privata:salvataggio',
      'privata:consolazione',
      'domanda',
      'automatica',
      'pubblica:lancio',
      'pubblica:dichiarazione',
      'pubblica:testata',
    ]) {
      expect([...visti], atteso).toContain(atteso);
    }
  });
}, 60_000);
