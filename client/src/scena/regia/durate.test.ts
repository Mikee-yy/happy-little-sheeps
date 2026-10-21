// @vitest-environment jsdom
// Prove delle durate normali: il file dei dati copre ogni tipo di battuta, i valori sono quelli del teatro vero
// (ciclo manuale, senza ambiente né giochi, velocità 1, senza salto) arrotondati ai 100 ms, e `durataRecita`
// somma le voci del copione tenendo conto delle attese (massimo, niente).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applica, azioniPossibili, inAttesaDi, nuovaPartita, SETUP, vistaPer } from '../../../../engine/src';
import type { Evento, NuovoEvento, Vista } from '../../../../engine/src';
import { casoConSeme } from '../aiuti-prova';
import { fotografia, type Fotografia } from '../fotografia';
import { creaTeatro, type Teatro } from '../teatro';
import { copione, ATTESA_METEO_MS, type Battuta } from './copione';
import { DURATE_NORMALI, durataRecita } from './durate';
import durateFile from './durate.json';

/**
 * Ogni tipo di battuta, una volta sola. Un tipo nuovo nel copione fa fallire il controllo dei tipi (`npm run typecheck`) di
 * questo elenco; la prova "le voci del file sono esattamente i tipi di battuta" lo ripete a runtime su `durate.json`.
 */
const TIPI: Record<Battuta['tipo'], true> = {
  guaioRivelato: true,
  annuncio: true,
  giraCarte: true,
  fumetti: true,
  volaCarta: true,
  beeeNo: true,
  dado: true,
  agnellini: true,
  testata: true,
  guaio: true,
  eliminata: true,
  festa: true,
};
const TIPI_ELENCO = Object.keys(TIPI) as Array<Battuta['tipo']>;

/** Quattro giocatori, ognuno con 3 agnellini e la carta coperta davanti, gregge con 10 (la corsa tipica ha sempre di che muoversi). */
function fotoQuattro(): Fotografia {
  const giocatori = SETUP.pecore.slice(0, 4).map((p, i) => ({ id: `g${i + 1}`, nome: `G${i + 1}`, pecora: p.id }));
  const f = fotografia(vistaPer(nuovaPartita({ giocatori, seme: 11 }), null), 'g1', null);
  return { ...f, gregge: 10, posti: f.posti.map((p) => ({ ...p, agnellini: 3, giocata: { coperta: true } })) };
}

/** Il passo della misura: abbastanza fine perché le promesse a catena non gonfino la durata (a passi di 100 ms una catena di voli ne perdeva fino a 140). */
const PASSO_MS = 20;
/** Ogni quanto il regista guarda se gli agnellini sono arrivati. */
const PASSO_AGNELLINI_MS = 33;

/** Lascia correre le promesse in sospeso. */
async function scarica(): Promise<void> {
  for (let i = 0; i < 40; i++) await Promise.resolve();
}

/** Fa avanzare la scena di `ms` a pezzi di 20 ms, lasciando proseguire le promesse tra un pezzo e l'altro. */
async function scorri(t: Teatro, ms: number): Promise<void> {
  for (let fatto = 0; fatto < ms; fatto += PASSO_MS) {
    t.avanza(Math.min(PASSO_MS, ms - fatto));
    await scarica();
  }
}

/** A passi di 20 ms finché la promessa non si risolve: i ms di scena passati (come `finoAllaFine` di ordini.test). */
async function finoAllaFine(t: Teatro, p: Promise<void>, max = 10_000): Promise<number> {
  let finito = false;
  void p.then(() => (finito = true));
  const inizio = t.ctx.orologio.ms;
  await scarica();
  while (!finito && t.ctx.orologio.ms - inizio < max) await scorri(t, PASSO_MS);
  expect(finito).toBe(true);
  return t.ctx.orologio.ms - inizio;
}

/** La corsa degli agnellini come la aspetta il regista: a passi di 33 ms (il passo del regista) finché nessuno è più in viaggio. */
async function finoAdArrivo(t: Teatro, max = 10_000): Promise<number> {
  const inizio = t.ctx.orologio.ms;
  await scarica();
  while (t.stato().inViaggio > 0 && t.ctx.orologio.ms - inizio < max) {
    t.avanza(PASSO_AGNELLINI_MS);
    await scarica();
  }
  expect(t.stato().inViaggio).toBe(0);
  return t.ctx.orologio.ms - inizio;
}

/** L'ordine del teatro che recita quel tipo di battuta (le stesse chiamate del regista), con i dati tipici; i ms di scena che dura. */
const MISURE: Record<Battuta['tipo'], (t: Teatro) => Promise<number>> = {
  guaioRivelato: (t) => finoAllaFine(t, t.ordini.guaioRivelato('volpe-gentile')),
  annuncio: (t) => finoAllaFine(t, t.ordini.annuncio('Ultimo round!', 1200)),
  giraCarte: (t) =>
    finoAllaFine(t, t.ordini.giraCarte({ g1: ['carriola'], g2: ['capriola'], g3: ['sasso-comodo'], g4: ['balla-di-fieno'] })),
  fumetti: (t) => finoAllaFine(t, t.ordini.fumetti({ g1: '+2', g2: '-2' }, 1200)),
  volaCarta: (t) => finoAllaFine(t, t.ordini.volaCarta('g2', 'capriola', 'Capriola')),
  beeeNo: (t) => finoAllaFine(t, t.ordini.annullamento('g1', 'g2', 'capriola')),
  dado: (t) => finoAllaFine(t, t.ordini.dado('pascolo_piccolo')),
  agnellini: async (t) => {
    expect(t.ordini.spostaAgnellini(3, 'gregge', 'g1', 'corre')).toBe(3);
    return finoAdArrivo(t);
  },
  testata: (t) => finoAllaFine(t, t.ordini.testata('g1', 'g2', 2)),
  // Un Guaio senza meteo (Dramma): il volo, la pausa al centro, l'arrivo nell'angolo
  guaio: (t) => finoAllaFine(t, t.ordini.guaio('insonnia', 'g2')),
  eliminata: (t) => finoAllaFine(t, t.ordini.eliminata('g2')),
  festa: (t) => finoAllaFine(t, t.ordini.festa(['g1'])),
};

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
  delete (Element.prototype as { animate?: unknown }).animate;
  vi.restoreAllMocks();
  localStorage.clear();
});

/**
 * jsdom non ha le Web Animations e la scena, senza, le finisce subito: i voli delle carte e della Testata
 * durerebbero 0 ms e la misura sarebbe troppo corta. Qui ogni animazione finisce dopo la sua `duration` sull'orologio
 * (manuale) della scena, come nel browser a velocità 1.
 */
function animazioniSulOrologio(t: Teatro): void {
  Object.defineProperty(Element.prototype, 'animate', {
    configurable: true,
    writable: true,
    value: function (_fotogrammi: unknown, opzioni?: number | { duration?: number; delay?: number }): Animation {
      const durata = typeof opzioni === 'number' ? opzioni : (opzioni?.duration ?? 0) + (opzioni?.delay ?? 0);
      let chiudi = (): void => undefined;
      const a = {
        playbackRate: 1,
        finished: undefined as unknown as Promise<Animation>,
        cancel: () => chiudi(),
        finish: () => chiudi(),
        play() {},
        pause() {},
        addEventListener() {},
        removeEventListener() {},
      };
      a.finished = new Promise((fine) => {
        chiudi = () => fine(a as unknown as Animation);
        t.ctx.orologio.dopo(chiudi, durata);
      });
      return a as unknown as Animation;
    },
  });
}

const manuale = (): Teatro => {
  const t = (teatro = creaTeatro(radice, { ciclo: 'manuale', ambiente: false, giochi: false, caso: casoConSeme(5) }));
  animazioniSulOrologio(t);
  return t;
};

describe('durate.json: una voce per ogni tipo di battuta', () => {
  it('le voci del file sono esattamente i tipi di battuta del copione', () => {
    expect(Object.keys(durateFile).sort()).toEqual([...TIPI_ELENCO].sort());
    expect(Object.keys(DURATE_NORMALI).sort()).toEqual([...TIPI_ELENCO].sort());
  });

  it.each(TIPI_ELENCO)('%s: durata positiva, multipla di 100 ms', (tipo) => {
    const ms = DURATE_NORMALI[tipo];
    expect(ms).toBeGreaterThan(0);
    expect(ms % 100).toBe(0);
  });
});

describe('durate.json: i valori sono quelli del teatro vero', () => {
  it.each(TIPI_ELENCO)('%s: non meno di quanto dura l\'ordine, non più del doppio', async (tipo) => {
    const t = manuale();
    t.allinea(fotoQuattro(), 'calmo');
    const misurata = await MISURE[tipo](t);
    expect(misurata).toBeGreaterThan(0);
    expect(DURATE_NORMALI[tipo], `${tipo}: misurata ${misurata} ms`).toBeGreaterThanOrEqual(misurata);
    expect(DURATE_NORMALI[tipo], `${tipo}: misurata ${misurata} ms`).toBeLessThanOrEqual(misurata * 2);
    expect(errori).not.toHaveBeenCalled();
  });
});

describe('durataRecita: eventi costruiti a mano', () => {
  const vista: Vista = vistaPer(
    nuovaPartita({
      giocatori: [
        { id: 'g1', nome: 'Anna', pecora: 'ricciolo' },
        { id: 'g2', nome: 'Bruno', pecora: 'brontolana' },
        { id: 'g3', nome: 'Carla', pecora: 'sospirella' },
      ],
      seme: 3,
    }),
    null,
  );
  /** Eventi senza seq: i seq crescenti li assegna la prova. */
  const eventi = (...nuovi: NuovoEvento[]): Evento[] => nuovi.map((e, i) => ({ ...e, seq: 100 + i }) as Evento);
  const durata = (...nuovi: NuovoEvento[]): number => durataRecita(eventi(...nuovi), vista);

  it('nessun evento: 0', () => {
    expect(durataRecita([], vista)).toBe(0);
  });

  it('eventi che non danno battute: 0', () => {
    expect(durata({ tipo: 'risolta', voce: 1 }, { tipo: 'pescate', giocatore: 'g1', quante: 2 })).toBe(0);
  });

  it('Pascolo (dado, fumetto, agnellini): la somma delle tre voci', () => {
    const d = durata(
      { tipo: 'dado_lanciato', giocatore: 'g1', faccia: 'pascolo_piccolo' },
      {
        tipo: 'dichiarazione',
        voce: 1,
        autore: 'g1',
        dettagli: { tipo: 'dado', faccia: 'pascolo_piccolo', dichiarazione: { effetto: 'pascolo', quantita: 3 } },
      },
      { tipo: 'risolta', voce: 1 },
      { tipo: 'agnellini', da: 'gregge', a: 'g1', quanti: 3, causa: 'pascolo' },
    );
    expect(d).toBe(DURATE_NORMALI.dado + DURATE_NORMALI.fumetti + DURATE_NORMALI.agnellini);
  });

  it('Guaio senza meteo: la voce guaio', () => {
    expect(durata({ tipo: 'guaio_preso', giocatore: 'g1', carta: 'insonnia#1' })).toBe(DURATE_NORMALI.guaio);
  });

  it('Guaio col meteo o il Lupo: 5000 (la promessa dell\'ordine si risolve a 5 s dall\'inizio, `liberaDopoMs`)', () => {
    for (const carta of ['grandine-a-sorpresa#1', 'nebbia-fitta#1', 'lupo-vegetariano#1']) {
      expect(durata({ tipo: 'guaio_preso', giocatore: 'g2', carta }), carta).toBe(ATTESA_METEO_MS);
    }
    expect(ATTESA_METEO_MS).toBe(5000);
  });

  it('consolazione dopo un Guaio col meteo (attesa niente): vale 0', () => {
    const solo = durata({ tipo: 'guaio_preso', giocatore: 'g2', carta: 'grandine-a-sorpresa#1' });
    const conConsolazione = durata(
      { tipo: 'guaio_preso', giocatore: 'g2', carta: 'grandine-a-sorpresa#1' },
      { tipo: 'agnellini', da: 'gregge', a: 'g2', quanti: 1, causa: 'consolazione' },
    );
    expect(conConsolazione).toBe(solo);
  });

  it('consolazione dopo un Guaio senza meteo: il Guaio più la corsa', () => {
    const d = durata(
      { tipo: 'guaio_preso', giocatore: 'g1', carta: 'insonnia#1' },
      { tipo: 'agnellini', da: 'gregge', a: 'g1', quanti: 1, causa: 'consolazione' },
    );
    expect(d).toBe(DURATE_NORMALI.guaio + DURATE_NORMALI.agnellini);
  });

  it('le battute con attesa massimo valgono al più quel massimo (fumetti, annuncio)', () => {
    expect(durata({ tipo: 'guaio_curato', giocatore: 'g2', carta: 'insonnia#1' })).toBe(Math.min(DURATE_NORMALI.fumetti, 1200));
    expect(durata({ tipo: 'round_iniziato', round: 4, ultimo: true })).toBe(Math.min(DURATE_NORMALI.annuncio, 1200));
  });

  it('Testata: una sola voce testata (gli agnellini li racconta la Testata)', () => {
    expect(
      durata({ tipo: 'agnellini', da: 'g2', a: 'gregge', quanti: 2, causa: 'testata' }, { tipo: 'testata', giocatore: 'g1', bersaglio: 'g2', esito: 2 }),
    ).toBe(DURATE_NORMALI.testata);
  });

  it('è la somma battuta per battuta, nell\'ordine del copione', () => {
    const lista = eventi(
      { tipo: 'rivelazione', giocate: { g1: ['balla-di-fieno#1'], g2: ['sasso-comodo#1'], g3: ['carriola#1'] } },
      { tipo: 'punteggio', giocatore: 'g1', riga: { tipo: 'valore', delta: 5, autore: 'g1' }, totale: 5 },
      { tipo: 'eliminato', giocatore: 'g3' },
      { tipo: 'fine_partita', esito: { modo: 'ovile_pieno', vincitori: ['g1'] } },
    );
    expect(copione(lista, vista).map((b) => b.tipo)).toEqual(['giraCarte', 'fumetti', 'eliminata', 'festa']);
    expect(durataRecita(lista, vista)).toBe(
      DURATE_NORMALI.giraCarte + Math.min(DURATE_NORMALI.fumetti, 1200) + DURATE_NORMALI.eliminata + DURATE_NORMALI.festa,
    );
  });
});

describe('durataRecita: partite vere giocate a caso', () => {
  // Dieci partite intere: col PC carico il tempo vero supera i 5 s predefiniti
  it('su 10 partite: mai negativa, positiva ogni volta che il copione dà una battuta che fa aspettare', { timeout: 30_000 }, () => {
    let mosseConBattute = 0;
    for (let seme = 1; seme <= 10; seme++) {
      let stato = nuovaPartita({
        giocatori: [
          { id: 'g1', nome: 'Anna', pecora: 'ricciolo' },
          { id: 'g2', nome: 'Bruno', pecora: 'brontolana' },
          { id: 'g3', nome: 'Carla', pecora: 'sospirella' },
        ],
        seme,
      });
      let x = seme * 7919;
      const caso = (n: number) => ((x = (x * 1103515245 + 12345) >>> 0) >>> 8) % n;
      let ultimo = 0;
      for (let passo = 0; passo < 3000 && stato.esito == null; passo++) {
        const attesa = inAttesaDi(stato);
        const chi = attesa.sistema ? 'sistema' : attesa.giocatori[caso(attesa.giocatori.length)]!;
        const azioni = azioniPossibili(stato, chi);
        if (azioni.length === 0) break;
        stato = applica(stato, azioni[caso(azioni.length)]!);
        const v = vistaPer(stato, null);
        const nuovi = v.eventi.filter((e) => e.seq > ultimo);
        ultimo = Math.max(ultimo, ...nuovi.map((e) => e.seq));
        const d = durataRecita(nuovi, v);
        expect(d).toBeGreaterThanOrEqual(0);
        const battute = copione(nuovi, v);
        if (battute.some((b) => b.attesa.tipo !== 'niente')) {
          mosseConBattute++;
          expect(d).toBeGreaterThan(0);
        } else {
          expect(d).toBe(0);
        }
      }
    }
    expect(mosseConBattute).toBeGreaterThan(0);
  });
});
