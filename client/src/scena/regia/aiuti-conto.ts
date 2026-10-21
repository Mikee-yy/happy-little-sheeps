// Il conto giusto con la regia (punto 3 della revisione): partite simulate intere recitate dal regista.
// Dopo ogni mossa `recita`; ogni 3 mosse un salto; ogni 5 mosse la mossa dopo arriva mentre la scena recita ancora
// (bot veloci, eventi in fila). Quando si aspetta la fine, gli agnellini in scena coincidono con la fotografia, recinto per recinto.
// Un file di prova per numero di giocatori (conto-2/3/4.test.ts): le partite sono lunghe e così girano su fili diversi.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Vista } from '../../../../engine/src';
import { casoConSeme, giocaPartiteSimulate } from '../aiuti-prova';
import { fotografia, type Fotografia } from '../fotografia';
import { creaTeatro, type Teatro } from '../teatro';

/** Tempo massimo di scena per tornare liberi dopo una mossa (anche con un meteo sullo sfondo). */
const MASSIMO_SCENA_MS = 60_000;

async function scarica(): Promise<void> {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

/** Avanza a passi di 100 ms finché il regista è libero e non c'è nessun evento in corso. */
async function finoAllaQuiete(t: Teatro): Promise<void> {
  const inizio = t.ctx.orologio.ms;
  await scarica();
  while ((t.occupato() || t.eventoInCorso()) && t.ctx.orologio.ms - inizio < MASSIMO_SCENA_MS) {
    t.avanza(100);
    await scarica();
  }
  expect(t.occupato()).toBe(false);
  expect(t.eventoInCorso()).toBe(false);
}

function inPari(t: Teatro, f: Fotografia): void {
  const atteso: Record<string, { assegnati: number; mostrati: number }> = { gregge: { assegnati: f.gregge, mostrati: f.gregge } };
  for (const p of f.posti) atteso[p.id] = { assegnati: p.agnellini, mostrati: p.agnellini };
  expect(t.stato().agnellini).toEqual(atteso);
  expect(t.stato().fuori).toBe(0);
}

/** Registra le prove del conto giusto per `n` giocatori, una partita per strategia. */
export function provaContoPerGiocatori(n: 2 | 3 | 4): void {
  let teatro: Teatro | null = null;
  let radice: HTMLElement | null = null;

  afterEach(() => {
    teatro?.distruggi();
    teatro = null;
    radice?.remove();
    vi.restoreAllMocks();
  });

  describe('conto giusto con la regia', () => {
    it.each([
      [n, 'semplice'],
      [n, 'casuale'],
    ] as const)(
      '%i giocatori, strategia %s: a fine recita gli agnellini coincidono con la partita',
      async (_n, politica) => {
        const errori = vi.spyOn(console, 'error');
        radice = document.createElement('div');
        document.body.appendChild(radice);
        const t = (teatro = creaTeatro(radice, { ciclo: 'manuale', ambiente: false, giochi: false, caso: casoConSeme(7) }));
        const foto = (v: Vista) => fotografia(v, 'g1', null);
        let mosse = 0;
        let controlli = 0;
        /** Mosse arrivate mentre il regista recitava ancora (si accodano). */
        let inCoda = 0;
        await giocaPartiteSimulate({
          n,
          politica,
          seme: 1,
          inizio(v) {
            t.recita(foto(v), v);
          },
          async dopoMossa(v, finita) {
            mosse++;
            if (t.occupato()) inCoda++;
            t.recita(foto(v), v);
            if (mosse % 3 === 0) t.salta();
            if (mosse % 5 === 0 && !finita) {
              // La mossa dopo arriva mentre la scena recita ancora
              t.avanza(200);
              await scarica();
              return;
            }
            await finoAllaQuiete(t);
            inPari(t, foto(v));
            controlli++;
          },
        });
        expect(controlli).toBeGreaterThan(0);
        expect(inCoda).toBeGreaterThan(0);
        expect(errori).not.toHaveBeenCalled();
      },
      120_000,
    );
  });
}
