// Aiuti comuni delle prove di camera, meteo e ordini: la fotografia di partenza, lo scorrere del tempo a passi e il controllo
// "scena pulita"; più la prova di ogni Guaio con effetto per ogni posto, che sta in file separati (uno per numero di giocatori)
// così i tre pezzi lunghi girano su fili diversi.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nuovaPartita, SETUP, vistaPer } from '../../../../engine/src';
import type { IdGiocatore } from '../../../../engine/src';
import { casoConSeme } from '../aiuti-prova';
import { fotografia, type Fotografia } from '../fotografia';
import { creaTeatro, type StatoMostrato, type Teatro } from '../teatro';

/** I Guai con un effetto sulla scena: i 7 meteo più il Lupo. */
export const GUAI_CON_EFFETTO = [
  'grandine-a-sorpresa',
  'pioggia-di-traverso',
  'vento-dispettoso',
  'nebbia-fitta',
  'fulmine-curioso',
  'gelata-di-agosto',
  'pozzanghera-senza-fondo',
  'lupo-vegetariano',
];

export function fotoIniziale(n: 2 | 3 | 4, inBasso: IdGiocatore = 'g1'): Fotografia {
  const giocatori = SETUP.pecore.slice(0, n).map((p, i) => ({ id: `g${i + 1}`, nome: `G${i + 1}`, pecora: p.id }));
  return fotografia(vistaPer(nuovaPartita({ giocatori, seme: 11 }), null), inBasso, null);
}

/** La stessa fotografia vista da un altro giocatore in basso. */
export function ruota(f: Fotografia, inBasso: IdGiocatore): Fotografia {
  const i = f.posti.findIndex((p) => p.id === inBasso);
  return { ...f, posti: [...f.posti.slice(i), ...f.posti.slice(0, i)] };
}

/** Lascia correre le promesse in sospeso (le attese dell'orologio si risolvono durante `avanza`). */
export async function scarica(): Promise<void> {
  for (let i = 0; i < 40; i++) await Promise.resolve();
}

/** Fa avanzare la scena di `ms` a pezzi di 100 ms, lasciando proseguire le promesse tra un pezzo e l'altro. */
export async function scorri(t: Teatro, ms: number, osserva?: () => void): Promise<void> {
  for (let fatto = 0; fatto < ms; fatto += 100) {
    t.avanza(Math.min(100, ms - fatto));
    await scarica();
    osserva?.();
  }
}

/** A passi di 1 s finché l'evento è in corso (al più `max` ms); restituisce i ms passati. `osserva` guarda ogni 100 ms. */
export async function finoAllaQuiete(t: Teatro, max = 40000, osserva?: () => void): Promise<number> {
  let ms = 0;
  while (t.eventoInCorso() && ms < max) {
    await scorri(t, 1000, osserva);
    ms += 1000;
  }
  return ms;
}

/** Un agnellino colpito dal fulmine fa ancora un saltello (mezzo secondo) dopo la fine del meteo: lo si aspetta, al più 2 s. */
export async function finoASenzaRegia(t: Teatro, max = 2000): Promise<StatoMostrato> {
  for (let ms = 0; t.stato().inRegia > 0 && ms < max; ms += 100) await scorri(t, 100);
  return t.stato();
}

/** Lo stato di una scena "pulita": niente in viaggio, intrappolato o in regia, zoom 1, postazioni e recinti come all'inizio. */
export function controllaPulita(s: StatoMostrato, prima: StatoMostrato): void {
  expect(s.agnellini).toEqual(prima.agnellini);
  expect(s.inViaggio).toBe(0);
  expect(s.intrappolati).toBe(0);
  expect(s.inRegia).toBe(0);
  expect(s.zoom).toBe(1);
  expect(s.postazioniNascoste).toBe(0);
  expect(s.recintiAlterati).toBe(0);
  expect(s.fuori).toBe(0);
}

/** Tutti i casi (Guaio, posto) per un numero di giocatori. */
const casiPer = (n: 2 | 3 | 4) =>
  Array.from({ length: n }, (_, i) => `g${i + 1}`).flatMap((chi) => GUAI_CON_EFFETTO.map((carta) => ({ n, chi, carta })));

/**
 * Ogni Guaio con effetto, per ogni posto, con `n` giocatori: durante l'evento il massimo di zoom, postazioni nascoste,
 * intrappolati e banchi di nebbia; alla fine la scena è pulita e il Guaio sta nell'angolo di chi l'ha preso.
 */
export function provaGuaiPerGiocatori(n: 2 | 3 | 4): void {
  let radice: HTMLElement;
  let teatro: Teatro | null = null;
  let errori: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    radice = document.createElement('div');
    document.body.appendChild(radice);
    errori = vi.spyOn(console, 'error');
  });

  afterEach(() => {
    teatro?.distruggi();
    teatro = null;
    radice.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  const manuale = (ambiente = false) => (teatro = creaTeatro(radice, { ciclo: 'manuale', ambiente, giochi: false, caso: casoConSeme(5) }));

  // Tempo massimo esplicito per caso: con l'ambiente vero (nebbia) un caso dura 2–4 s da solo, e con tutta la suite
  // in parallelo supera i 5 s predefiniti
  describe('ordini.guaio: ogni Guaio con effetto, per ogni posto e numero di giocatori', { timeout: 30_000 }, () => {
    it.each(casiPer(n))('$n giocatori, $carta su $chi', async ({ chi, carta }) => {
      // La nebbia senza ambiente non avrebbe banchi: quei casi girano con l'ambiente vero
      const nebbia = carta === 'nebbia-fitta';
      const t = manuale(nebbia);
      t.allinea(fotoIniziale(n), 'calmo');
      const prima = t.stato();
      const fine = t.ordini.guaio(carta, chi);
      await scarica();
      expect(t.eventoInCorso()).toBe(true);
      // Durante l'evento: il massimo di zoom, postazioni nascoste, intrappolati e banchi di nebbia
      const massimo = { zoom: 1, nascoste: 0, intrappolati: 0, banchi: 0 };
      const banchi = radice.querySelector('.nebbia-svg')!;
      const ms = await finoAllaQuiete(t, 40000, () => {
        const s = t.stato();
        massimo.zoom = Math.max(massimo.zoom, s.zoom);
        massimo.nascoste = Math.max(massimo.nascoste, s.postazioniNascoste);
        massimo.intrappolati = Math.max(massimo.intrappolati, s.intrappolati);
        massimo.banchi = Math.max(massimo.banchi, banchi.childElementCount);
      });
      const avversario = chi !== 'g1';
      if (avversario) expect(massimo.zoom).toBeGreaterThan(1);
      else expect(massimo.zoom).toBe(1);
      // Con 2 giocatori non c'è un altro avversario da nascondere
      expect(massimo.nascoste).toBe(avversario && n > 2 ? n - 2 : 0);
      if (carta === 'pozzanghera-senza-fondo' && prima.agnellini[chi]!.assegnati > 0) expect(massimo.intrappolati).toBeGreaterThan(0);
      if (nebbia) expect(massimo.banchi).toBeGreaterThan(0);
      expect(ms).toBeLessThan(40000);
      expect(t.eventoInCorso()).toBe(false);
      let finito = false;
      void fine.then(() => (finito = true));
      await scarica();
      expect(finito).toBe(true);
      controllaPulita(await finoASenzaRegia(t), prima);
      expect(t.stato().angoli[chi]).toContain(carta);
      expect(radice.querySelectorAll('.volante, .pozza, .saetta, .lampo, .gelo, .linee-zoom')).toHaveLength(0);
      expect(errori).not.toHaveBeenCalled();
    });
  });
}
