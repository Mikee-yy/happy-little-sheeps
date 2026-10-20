// Partite intere giocate dal motore scegliendo a caso tra gli elementi della domanda (carte, pecore, dado, Guai,
// carte grandi, pulsanti attivi): ogni mossa prodotta è accettata dal motore, ogni domanda ha qualcosa di attivo,
// ogni partita finisce. Il momento si costruisce come farà Partita (vista, mosse permesse, mano scoperta).
import { describe, expect, it } from 'vitest';
import { azioniPossibili, nuovaPartita, tentaApplica, vistaPer } from '../../../../engine/src';
import type { Azione, IdGiocatore, Stato } from '../../../../engine/src';
import { scena } from '../../partita/regia';
import { avanza, chiaveDi, domandaDi, sceltaVuota } from './domanda';
import type { Domanda, Gesto, Momento, Scelta } from './tipi';

const PECORE = ['ricciolo', 'brontolana', 'sospirella', 'nerina'] as const;
const LIMITE_GESTI = 3000;

/** Gli schermi incontrati nelle partite (per controllare che le prove li tocchino tutti). */
const visti = new Set<string>();

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

function momentoDi(s: Stato, scelto: IdGiocatore | null): Momento {
  const tavolo = vistaPer(s, null);
  const schermo = scena(tavolo, scelto);
  const chi = 'giocatore' in schermo ? schermo.giocatore : null;
  const privata = schermo.tipo === 'privata' && chi !== null;
  return {
    vista: privata ? vistaPer(s, chi) : tavolo,
    schermo,
    azioni: chi ? azioniPossibili(s, chi) : [],
    sistema: azioniPossibili(s, 'sistema'),
    condiviso: true,
    manoScoperta: privata,
  };
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

function giocaPartita(giocatori: number, seme: number): { gesti: number; mosse: number; stato: Stato } {
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
    const m = momentoDi(stato, scelto);
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
  return { gesti, mosse, stato };
}

describe('partite intere a caso tra gli elementi della domanda', () => {
  for (const giocatori of [2, 3, 4]) {
    for (let k = 1; k <= 10; k++) {
      const seme = giocatori * 1000 + k;
      it(`${giocatori} giocatori, seme ${seme}: ogni mossa è permessa e la partita finisce`, () => {
        const { gesti, mosse, stato } = giocaPartita(giocatori, seme);
        expect(gesti).toBeLessThan(LIMITE_GESTI);
        expect(mosse).toBeGreaterThan(0);
        expect(stato.esito !== null || stato.fase.nome === 'fine_partita').toBe(true);
      });
    }
  }

  it('le partite hanno attraversato i momenti con la mano e quelli del tavolo', () => {
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
