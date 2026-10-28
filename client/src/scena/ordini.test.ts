// @vitest-environment jsdom
// Prove degli ordini nuovi del pezzo 2 (la regia): Guaio del round, annuncio, carte che si girano, fumetti, carta in volo,
// eliminazione, festa e Guaio che libera la regia prima della fine del meteo. Ciclo manuale, senza ambiente né giochi
// (salvo la nebbia, che senza ambiente finirebbe subito).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// Questo file monta teatri veri: con tutte le prove insieme una prova può superare i 5 s predefiniti (la macchina è
// carica). Il limite più alto vale per tutto il file, così la prossima prova lenta non fallisce per finta.
vi.setConfig({ testTimeout: 60_000 });
import { defCarta, nuovaPartita, SETUP, vistaPer } from '../../../engine/src';
import type { IdCarta, IdGiocatore } from '../../../engine/src';
import { T } from '../testi';
import { casoConSeme } from './aiuti-prova';
import type { PosaMontone } from './fionda/montone';
import {
  basePartenza,
  cieloDaSeq,
  colpoLungo,
  coperto,
  fineDietroLaCollina,
  FIONDA,
  partenzaDi,
  puntoDiScena,
  puntoInCielo,
  variazioneDaSeq,
  yRitorno,
  zonaDi,
  type Punto,
  type Rett,
} from './fionda/tiro';
import { fotografia, type Fotografia } from './fotografia';
import { W } from './misure';
import { CENTRO_TAVOLO, ingombroAgnello, ingombroPecora, largoMontone, type OrdiniDelTeatro } from './ordini';
import type { Palco } from './palco';
import type { Agnello } from './personaggi/agnello';
import { dentro, puntoLibero, vicinoLibero } from './personaggi/aree';
import { POSA_SVENUTA } from './personaggi/pecora';
import { DURATE_NORMALI } from './regia/durate';
import { creaTeatro, type Teatro } from './teatro';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Le pose del Montone animato, nell'ordine in cui la regia le mette, con il tempo della scena e la classe `ferma`
const pose = vi.hoisted(() => ({
  elenco: [] as Array<{ el: Element; posa: string; ms: number; ferma: boolean }>,
  ora: (): number => 0,
}));
vi.mock('./fionda/montone', async (originale) => {
  const m = await originale<typeof import('./fionda/montone')>();
  return {
    ...m,
    mettiPosa: (el: Element, posa: PosaMontone) => {
      pose.elenco.push({ el, posa, ms: pose.ora(), ferma: el.classList.contains('ferma') });
      m.mettiPosa(el, posa);
    },
  };
});

// Il palco non esce dal teatro: lo si prende alla creazione della camera (come fionda/mira.test.ts)
const presa = vi.hoisted(() => ({ palco: null as unknown }));
vi.mock('./camera', async (originale) => {
  const m = await originale<typeof import('./camera')>();
  return {
    ...m,
    creaCamera: (palco: Palco) => {
      presa.palco = palco;
      return m.creaCamera(palco);
    },
  };
});

function fotoIniziale(n: 2 | 3 | 4): Fotografia {
  const giocatori = SETUP.pecore.slice(0, n).map((p, i) => ({ id: `g${i + 1}`, nome: `G${i + 1}`, pecora: p.id }));
  return fotografia(vistaPer(nuovaPartita({ giocatori, seme: 11 }), null), 'g1', null);
}

/** Tutti hanno scelto: davanti a ognuno una carta coperta. */
function conCarteCoperte(f: Fotografia): Fotografia {
  return { ...f, posti: f.posti.map((p) => ({ ...p, giocata: { coperta: true } })) };
}

/** Lascia correre le promesse in sospeso. */
async function scarica(): Promise<void> {
  for (let i = 0; i < 40; i++) await Promise.resolve();
}

/** Fa avanzare la scena di `ms` a pezzi di 100 ms, lasciando proseguire le promesse tra un pezzo e l'altro. */
async function scorri(t: Teatro, ms: number): Promise<void> {
  for (let fatto = 0; fatto < ms; fatto += 100) {
    t.avanza(Math.min(100, ms - fatto));
    await scarica();
  }
}

/** A passi di 100 ms finché la promessa non si risolve (al più `max` ms): restituisce i ms di scena passati. */
async function finoAllaFine(t: Teatro, p: Promise<void>, max = 10000): Promise<number> {
  let finito = false;
  void p.then(() => (finito = true));
  const inizio = t.ctx.orologio.ms;
  await scarica();
  while (!finito && t.ctx.orologio.ms - inizio < max) await scorri(t, 100);
  expect(finito).toBe(true);
  return t.ctx.orologio.ms - inizio;
}

const nomeMaiuscolo = (id: IdCarta): string => defCarta(id).nome.toUpperCase();

/** I fumetti comparsi da adesso (di chi, testo, durata): in jsdom finiscono e si tolgono subito, quindi si guardano le animazioni. */
function fumettiAnimati(t: Teatro): () => Array<[string | undefined, string | null, unknown]> {
  const anima = vi.spyOn(t.ctx, 'anima');
  return () =>
    anima.mock.calls
      .filter(([e]) => (e as HTMLElement).classList.contains('fumetto'))
      .map(([e, , o]) => [(e as HTMLElement).dataset.di, e.textContent, o.duration]);
}

let radice: HTMLElement;
let teatro: Teatro | null = null;
let errori: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  radice = document.createElement('div');
  document.body.appendChild(radice);
  errori = vi.spyOn(console, 'error');
  pose.elenco = [];
  pose.ora = () => teatro?.ctx.orologio.ms ?? 0;
});

afterEach(() => {
  teatro?.distruggi();
  teatro = null;
  radice.remove();
  delete (Element.prototype as { animate?: unknown }).animate;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

const manuale = (ambiente = false) => (teatro = creaTeatro(radice, { ciclo: 'manuale', ambiente, giochi: false, caso: casoConSeme(5) }));

describe('ordini nuovi: ognuno finisce entro il suo tempo e chiude l\'evento', () => {
  const CASI: Array<{ nome: string; massimo: number; ordine: (t: Teatro) => Promise<void> }> = [
    { nome: 'guaioRivelato', massimo: 900, ordine: (t) => t.ordini.guaioRivelato('volpe-gentile') },
    { nome: 'annuncio', massimo: 1300, ordine: (t) => t.ordini.annuncio(T.scena.annunci.ultimoRound) },
    { nome: 'giraCarte', massimo: 800, ordine: (t) => t.ordini.giraCarte({ g1: ['carriola'], g2: ['capriola'], g3: ['sasso-comodo'] }) },
    { nome: 'fumetti (1200 ms)', massimo: 1300, ordine: (t) => t.ordini.fumetti({ g1: '+2', g2: '-2' }) },
    { nome: 'fumetti (500 ms)', massimo: 600, ordine: (t) => t.ordini.fumetti({ g3: '7' }, 500) },
    { nome: 'volaCarta', massimo: 1600, ordine: (t) => t.ordini.volaCarta('g2', 'capriola', 'Capriola') },
    { nome: 'annullamento', massimo: 2000, ordine: (t) => t.ordini.annullamento('g1', 'g2', 'capriola') },
    { nome: 'annullamento del dado', massimo: 1300, ordine: (t) => t.ordini.annullamento('g1', 'g2', null) },
    { nome: 'eliminata', massimo: 1200, ordine: (t) => t.ordini.eliminata('g2') },
    { nome: 'festa', massimo: 3100, ordine: (t) => t.ordini.festa(['g1']) },
  ];
  it.each(CASI)('$nome', async ({ massimo, ordine }) => {
    const t = manuale();
    t.allinea(conCarteCoperte(fotoIniziale(3)), 'calmo');
    // L'evento si apre subito (in jsdom le animazioni finiscono subito: un volo da solo non lo terrebbe aperto)
    const p = ordine(t);
    expect(t.eventoInCorso()).toBe(true);
    const ms = await finoAllaFine(t, p);
    expect(ms).toBeLessThanOrEqual(massimo);
    expect(t.eventoInCorso()).toBe(false);
    expect(radice.querySelectorAll('.volante, .annuncio, .coriandolo')).toHaveLength(0);
    expect(errori).not.toHaveBeenCalled();
  });
});

describe('ordini nuovi: che cosa si vede', () => {
  it('giraCarte: sullo sterrato e davanti a chi sta in basso compaiono i nomi delle carte, i dorsi spariscono', async () => {
    const t = manuale();
    t.allinea(conCarteCoperte(fotoIniziale(3)), 'calmo');
    const round = (chi: IdGiocatore) => radice.querySelector<HTMLElement>(`.carte-round[data-chi="${chi}"]`)!;
    expect(round('g2').textContent).not.toContain(nomeMaiuscolo('capriola'));
    await finoAllaFine(t, t.ordini.giraCarte({ g1: ['carriola'], g2: ['capriola', 'sasso-comodo'], g3: ['balla-di-fieno'] }));
    expect(round('g1').textContent).toContain(nomeMaiuscolo('carriola'));
    expect(round('g2').textContent).toContain(nomeMaiuscolo('capriola'));
    expect(round('g2').textContent).toContain(nomeMaiuscolo('sasso-comodo'));
    expect(round('g3').textContent).toContain(nomeMaiuscolo('balla-di-fieno'));
    expect(round('g2').querySelectorAll('.carta-round')).toHaveLength(2);
    // Niente dorsi rimasti davanti a chi ha girato
    for (const chi of ['g1', 'g2', 'g3']) expect(round(chi).querySelector('use[href="#back-main"]')).toBeNull();
  });

  it('giraCarte: un posto dopo l\'altro, 150 ms tra uno e il successivo', async () => {
    const t = manuale();
    t.allinea(conCarteCoperte(fotoIniziale(3)), 'calmo');
    const round = (chi: IdGiocatore) => radice.querySelector<HTMLElement>(`.carte-round[data-chi="${chi}"]`)!;
    void t.ordini.giraCarte({ g1: ['carriola'], g2: ['capriola'], g3: ['balla-di-fieno'] });
    await scarica();
    expect(round('g1').textContent).toContain(nomeMaiuscolo('carriola'));
    expect(round('g3').textContent).not.toContain(nomeMaiuscolo('balla-di-fieno'));
    await scorri(t, 400);
    expect(round('g3').textContent).toContain(nomeMaiuscolo('balla-di-fieno'));
  });

  it('guaioRivelato: la carta arriva sulla tovaglia, al posto del Guaio del round', async () => {
    const t = manuale();
    const f: Fotografia = { ...fotoIniziale(3), guaioRound: null };
    t.allinea(f, 'calmo');
    expect(radice.querySelector('.coperta .guaio-round')).toBeNull();
    await finoAllaFine(t, t.ordini.guaioRivelato('volpe-gentile'));
    expect(radice.querySelector('.coperta .guaio-round')?.textContent).toContain(nomeMaiuscolo('volpe-gentile'));
    // La fotografia con lo stesso Guaio del round non lo rifà
    const g = radice.querySelector('.coperta .guaio-round');
    t.allinea({ ...f, guaioRound: 'volpe-gentile' }, 'calmo');
    expect(radice.querySelector('.coperta .guaio-round')).toBe(g);
  });

  it('annuncio: la scritta "Ultimo round!" compare al centro e poi se ne va', async () => {
    const t = manuale();
    t.allinea(fotoIniziale(2), 'calmo');
    const p = t.ordini.annuncio(T.scena.annunci.ultimoRound);
    await scorri(t, 300);
    const a = radice.querySelector('.ui .annuncio');
    expect(a?.textContent).toBe(T.scena.annunci.ultimoRound);
    await finoAllaFine(t, p);
    expect(radice.querySelector('.annuncio')).toBeNull();
  });

  it('fumetti: un fumetto sopra ogni pecora indicata, lungo quanto chiesto', async () => {
    const t = manuale();
    t.allinea(fotoIniziale(3), 'calmo');
    const fumetti = fumettiAnimati(t);
    const p = t.ordini.fumetti({ g1: '+2', g3: '-2' }, 900);
    await scarica();
    expect(fumetti().sort()).toEqual([
      ['g1', '+2', 900],
      ['g3', '-2', 900],
    ]);
    await finoAllaFine(t, p);
  });

  it('volaCarta: la carta parte, al centro compare il fumetto di chi la gioca, poi la carta sparisce', async () => {
    const t = manuale();
    t.allinea(fotoIniziale(3), 'calmo');
    const fumetti = fumettiAnimati(t);
    const p = t.ordini.volaCarta('g2', 'capriola', 'Capriola');
    await scarica();
    expect(radice.querySelector('.ui .volante')?.textContent).toContain(nomeMaiuscolo('capriola'));
    expect(fumetti().map(([chi, testo]) => [chi, testo])).toEqual([['g2', 'Capriola']]);
    await finoAllaFine(t, p);
    expect(radice.querySelector('.volante')).toBeNull();
  });

  it('volaCarta senza testo: nessun fumetto', async () => {
    const t = manuale();
    t.allinea(fotoIniziale(3), 'calmo');
    const fumetti = fumettiAnimati(t);
    await finoAllaFine(t, t.ordini.volaCarta('g1', 'capriola', null));
    expect(fumetti()).toEqual([]);
  });

  it('annullamento: la carta annullata torna al centro e poi agli scarti; il Beee-NO! non vola una seconda volta', async () => {
    const t = manuale();
    t.allinea(fotoIniziale(3), 'calmo');
    const p = t.ordini.annullamento('g1', 'g2', 'capriola');
    await scarica();
    const volanti = [...radice.querySelectorAll('.ui .volante')];
    expect(volanti).toHaveLength(1);
    expect(volanti[0]!.textContent).toContain(nomeMaiuscolo('capriola'));
    await finoAllaFine(t, p);
    expect(radice.querySelector('.volante')).toBeNull();
    expect(errori).not.toHaveBeenCalled();
  });

  it('annullamento di un tiro di dado: nessuna carta in volo', async () => {
    const t = manuale();
    t.allinea(fotoIniziale(3), 'calmo');
    const p = t.ordini.annullamento('g1', 'g2', null);
    await scarica();
    expect(radice.querySelector('.volante')).toBeNull();
    await finoAllaFine(t, p);
  });

  it('eliminata: la pecora resta svenuta anche dopo un allineamento con la fotografia di prima', async () => {
    const t = manuale();
    const f = fotoIniziale(3);
    t.allinea(f, 'calmo');
    await finoAllaFine(t, t.ordini.eliminata('g2'));
    const reazione = () => radice.querySelector<HTMLElement>('.pecora[data-chi="g2"] .reazione')!;
    expect(reazione().style.transform).toBe(POSA_SVENUTA);
    // Un ordine successivo che rimette in pari le postazioni (la carta nell'angolo) non la rialza
    await finoAllaFine(t, t.ordini.guaio('volpe-gentile', 'g3'));
    expect(reazione().style.transform).toBe(POSA_SVENUTA);
  });

  it('festa: vibra [80, 60, 80, 60, 220] solo se vince chi sta in basso', async () => {
    const vibrate = vi.fn();
    vi.stubGlobal('navigator', { userAgent: 'jsdom', vibrate });
    const t = manuale();
    t.allinea(fotoIniziale(3), 'calmo');
    await finoAllaFine(t, t.ordini.festa(['g2']));
    expect(vibrate).not.toHaveBeenCalled();
    await finoAllaFine(t, t.ordini.festa(['g1', 'g3']));
    expect(vibrate).toHaveBeenCalledWith([80, 60, 80, 60, 220]);
  });
});

describe('guaio con liberaDopoMs: la regia si libera, il meteo continua', () => {
  it('nebbia su un avversario: a 5 s la promessa si risolve con la camera già tornata, poi la nebbia finisce', async () => {
    const t = manuale(true);
    t.allinea(fotoIniziale(3), 'calmo');
    const inizio = t.ctx.orologio.ms;
    let quando = -1;
    let allora: { zoom: number; nascoste: number; alterati: number; nascostiNelMondo: number; evento: boolean; meteo: boolean } | null = null;
    const p = t.ordini.guaio('nebbia-fitta', 'g2', { liberaDopoMs: 5000 }).then(() => {
      quando = t.ctx.orologio.ms - inizio;
      const s = t.stato();
      allora = {
        zoom: s.zoom,
        nascoste: s.postazioniNascoste,
        alterati: s.recintiAlterati,
        nascostiNelMondo: radice.querySelectorAll('.mondo [data-chi][style*="opacity: 0"]').length,
        evento: t.eventoInCorso(),
        meteo: t.ctx.meteoAttivo(),
      };
    });
    // Durante il meteo la camera si avvicina davvero
    await scorri(t, 2500);
    expect(t.stato().zoom).toBeGreaterThan(1);
    await finoAllaFine(t, p);
    expect(Math.abs(quando - 5000)).toBeLessThanOrEqual(100);
    expect(allora).toEqual({ zoom: 1, nascoste: 0, alterati: 0, nascostiNelMondo: 0, evento: true, meteo: true });
    // La nebbia prosegue sullo sfondo e poi finisce da sola
    let ms = 0;
    while (t.eventoInCorso() && ms < 30000) {
      await scorri(t, 1000);
      ms += 1000;
    }
    expect(t.eventoInCorso()).toBe(false);
    expect(t.ctx.meteoAttivo()).toBe(false);
    expect(t.stato().zoom).toBe(1);
    expect(t.stato().angoli.g2).toContain('nebbia-fitta');
    expect(errori).not.toHaveBeenCalled();
  });

  it('un Guaio senza meteo con liberaDopoMs finisce come prima, senza aspettare', async () => {
    const t = manuale();
    t.allinea(fotoIniziale(3), 'calmo');
    const ms = await finoAllaFine(t, t.ordini.guaio('volpe-gentile', 'g2', { liberaDopoMs: 5000 }));
    expect(ms).toBeLessThan(2500);
    expect(t.eventoInCorso()).toBe(false);
  });
});

describe('guaio con liberaDopoMs: il recinto torna normale con dentro gli agnellini trattenuti dal meteo', { timeout: 60_000 }, () => {
  /** Il passo del ciclo manuale (un fotogramma). */
  const PASSO = 33;
  it.each(['lupo-vegetariano', 'pioggia-di-traverso', 'grandine-a-sorpresa', 'gelata-di-agosto', 'pozzanghera-senza-fondo'])(
    '%s su un avversario: dalla liberazione alla fine del meteo nessuno fuori dal recinto, nessun salto',
    async (carta) => {
      const t = manuale(true);
      t.allinea(fotoIniziale(3), 'calmo');
      let liberato = false;
      void t.ordini.guaio(carta, 'g2', { liberaDopoMs: 5000 }).then(() => (liberato = true));
      // Il meteo lavora sul recinto ingrandito; il ritorno della camera comincia a 5000 − 950 ms
      for (let ms = 0; ms < 3900; ms += PASSO) {
        t.avanza(PASSO);
        await scarica();
      }
      expect(t.stato().zoom).toBeGreaterThan(1);
      expect(liberato).toBe(false);
      // Da qui, fotogramma per fotogramma: il ritorno, la liberazione, il meteo sullo sfondo e un po' oltre la sua fine
      let prima = new Map(t.stato().posizioni.map((p) => [p.n, p]));
      let salto = 0;
      let fuori = 0;
      let trattenutiFuori = 0;
      let ms = 0;
      for (let dopoMeteo = 0; dopoMeteo < 1500 && ms < 30000; ms += PASSO) {
        t.avanza(PASSO);
        await scarica();
        const s = t.stato();
        fuori = Math.max(fuori, s.fuori);
        trattenutiFuori = Math.max(trattenutiFuori, s.posizioni.filter((p) => p.fuoriDalRecinto).length);
        for (const p of s.posizioni) {
          const q = prima.get(p.n);
          if (q && !p.inViaggio && !q.inViaggio) salto = Math.max(salto, Math.hypot(p.x - q.x, p.y - q.y));
        }
        prima = new Map(s.posizioni.map((p) => [p.n, p]));
        if (!t.ctx.meteoAttivo()) dopoMeteo += PASSO;
      }
      expect(liberato).toBe(true);
      expect(t.ctx.meteoAttivo()).toBe(false);
      expect(fuori).toBe(0);
      expect(trattenutiFuori).toBe(0);
      expect(salto).toBeLessThanOrEqual(8);
      expect(errori).not.toHaveBeenCalled();
    },
  );

  it('durante il ritorno della camera (lupo): agnellini trattenuti, cespuglio e meta si stringono col recinto, senza salti', async () => {
    const t = manuale(true);
    t.allinea(fotoIniziale(3), 'calmo');
    let liberato = false;
    void t.ordini.guaio('lupo-vegetariano', 'g2', { liberaDopoMs: 5000 }).then(() => (liberato = true));
    // Fino a poco prima del ritorno (5000 − 950 ms)
    for (let ms = 0; ms < 3900; ms += PASSO) {
      t.avanza(PASSO);
      await scarica();
    }
    expect(t.stato().zoom).toBeGreaterThan(1);
    expect(t.stato().inRegia).toBeGreaterThan(0);
    const cespuglio = [...radice.querySelectorAll<SVGElement>('.mondo .pozza')].find((e) => e.querySelector('.occhi-lupo'))!;
    const xPrima = parseFloat(cespuglio.style.left);
    let prima = new Map(t.stato().posizioni.map((p) => [p.n, p]));
    let salto = 0;
    let trattenutiFuori = 0;
    while (!liberato) {
      t.avanza(PASSO);
      await scarica();
      const s = t.stato();
      trattenutiFuori = Math.max(trattenutiFuori, s.posizioni.filter((p) => p.fuoriDalRecinto).length);
      for (const p of s.posizioni) {
        const q = prima.get(p.n);
        if (q && !p.inViaggio && !q.inViaggio) salto = Math.max(salto, Math.hypot(p.x - q.x, p.y - q.y));
      }
      prima = new Map(s.posizioni.map((p) => [p.n, p]));
    }
    expect(t.stato().recintiAlterati).toBe(0);
    expect(trattenutiFuori).toBe(0);
    expect(salto).toBeLessThanOrEqual(8);
    // Il cespuglio si è spostato con il recinto, non è rimasto dov'era
    expect(parseFloat(cespuglio.style.left)).not.toBeCloseTo(xPrima, 0);
  });
});

/** Animazioni che finiscono solo quando si annullano: jsdom le finirebbe subito, così si vede un ordine a metà. */
function animazioniSospese(): void {
  Object.defineProperty(Element.prototype, 'animate', {
    configurable: true,
    writable: true,
    value: function (): Animation {
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
      a.finished = new Promise((r) => (chiudi = () => r(a as unknown as Animation)));
      return a as unknown as Animation;
    },
  });
}

describe('interrompi a metà (ricostruzione del tavolo)', () => {
  const CASI: Array<{ nome: string; selettore: string; ordine: (t: Teatro) => Promise<void> }> = [
    { nome: 'festa', selettore: '.coriandolo', ordine: (t) => t.ordini.festa(['g1']) },
    { nome: 'volaCarta', selettore: '.volante', ordine: (t) => t.ordini.volaCarta('g2', 'capriola', 'Capriola') },
    { nome: 'annuncio', selettore: '.annuncio', ordine: (t) => t.ordini.annuncio(T.scena.annunci.ultimoRound) },
    { nome: 'fumetti', selettore: '.fumetto', ordine: (t) => t.ordini.fumetti({ g1: '+2', g2: '-2' }) },
    { nome: 'guaioRivelato', selettore: '.volante', ordine: (t) => t.ordini.guaioRivelato('volpe-gentile') },
    { nome: 'testata', selettore: '.montone', ordine: (t) => t.ordini.testata('g1', 'g2', 2, 3) },
  ];
  it.each(CASI)('$nome: nessun elemento rimasto, evento chiuso', async ({ selettore, ordine }) => {
    animazioniSospese();
    const t = manuale();
    t.allinea(fotoIniziale(3), 'calmo');
    let finito = false;
    void ordine(t).then(() => (finito = true));
    await scorri(t, 500);
    expect(radice.querySelectorAll(selettore).length).toBeGreaterThan(0);
    (t.ordini as OrdiniDelTeatro).interrompi();
    await scorri(t, 100);
    expect(finito).toBe(true);
    expect(radice.querySelectorAll('.volante, .annuncio, .coriandolo, .fumetto')).toHaveLength(0);
    expect(t.eventoInCorso()).toBe(false);
    expect(errori).not.toHaveBeenCalled();
  });

  it('festa: anche la ricostruzione vera (un altro giocatore in basso) toglie i coriandoli', async () => {
    animazioniSospese();
    const t = manuale();
    const f = fotoIniziale(3);
    t.allinea(f, 'calmo');
    void t.ordini.festa(['g1']);
    await scorri(t, 500);
    expect(radice.querySelectorAll('.coriandolo').length).toBeGreaterThan(0);
    t.allinea({ ...f, posti: [...f.posti.slice(1), f.posti[0]!] }, 'calmo');
    await scorri(t, 100);
    expect(radice.querySelectorAll('.coriandolo')).toHaveLength(0);
    expect(t.eventoInCorso()).toBe(false);
  });
});


/**
 * Come in regia/durate.test.ts: ogni animazione finisce dopo la sua `duration` sull'orologio (manuale) della scena, come nel
 * browser a velocità 1 (senza, in jsdom finiscono subito e le fasi della Testata durerebbero solo le attese). Annullata, toglie
 * anche il suo timer dall'orologio (altrimenti la regia vedrebbe ancora un evento in sospeso).
 */
function animazioniSulOrologio(t: Teatro): void {
  Object.defineProperty(Element.prototype, 'animate', {
    configurable: true,
    writable: true,
    value: function (_fotogrammi: unknown, opzioni?: number | { duration?: number; delay?: number }): Animation {
      const durata = typeof opzioni === 'number' ? opzioni : (opzioni?.duration ?? 0) + (opzioni?.delay ?? 0);
      let chiudi = (): void => undefined;
      let timer = 0;
      const a = {
        playbackRate: 1,
        finished: undefined as unknown as Promise<Animation>,
        cancel: () => {
          t.ctx.orologio.annulla(timer);
          chiudi();
        },
        finish: () => chiudi(),
        play() {},
        pause() {},
        addEventListener() {},
        removeEventListener() {},
      };
      a.finished = new Promise((fine) => {
        chiudi = () => fine(a as unknown as Animation);
        timer = t.ctx.orologio.dopo(chiudi, durata);
      });
      return a as unknown as Animation;
    },
  });
}

/** Le pose messe al Montone degli ordini (classe `montone`), nell'ordine, con il tempo della scena; consecutive uguali una volta. */
function poseMontone(): Array<{ posa: string; ms: number; ferma: boolean }> {
  const fuori: Array<{ posa: string; ms: number; ferma: boolean }> = [];
  for (const p of pose.elenco) {
    if (!p.el.classList.contains('montone')) continue;
    if (fuori.at(-1)?.posa === p.posa) continue;
    fuori.push({ posa: p.posa, ms: p.ms, ferma: p.ferma });
  }
  return fuori;
}
const ultimaPosa = (): string | undefined => poseMontone().at(-1)?.posa;

/** Dove stanno i piedi del Montone in un fotogramma (origine della scala: 75, 102 nel disegno). */
function piedi(f: Keyframe): Punto {
  const m = /translate\(([-\d.e]+)px,\s*([-\d.e]+)px\)/.exec(String(f.transform));
  expect(m, String(f.transform)).not.toBeNull();
  return { x: Number(m![1]) + 75, y: Number(m![2]) + 102 };
}
/** Il verso del disegno in un fotogramma: il segno della scala orizzontale (1 guarda a destra). */
function verso(f: Keyframe): number {
  const m = /scale\(([-\d.e]+),/.exec(String(f.transform));
  expect(m, String(f.transform)).not.toBeNull();
  return Math.sign(Number(m![1]));
}
/** Il recinto del bersaglio a riposo (quello su cui atterra il volo). */
function recinto(chi: IdGiocatore): Rett {
  const a = (presa.palco as Palco).area(chi)!;
  const [x0, y0, x1, y1] = a.area0 ?? [a.x0, a.y0, a.x1, a.y1];
  return { x0, y0, x1, y1 };
}
const vicino = (p: Punto, q: Punto) => {
  expect(p.x).toBeCloseTo(q.x, 3);
  expect(p.y).toBeCloseTo(q.y, 3);
};
/** La partenza sugli altri telefoni: vicino alla pecora di chi tira, con la variazione ricavata da `seq`. */
const partenzaScena = (chi: IdGiocatore, seq: number): Punto =>
  partenzaDi(basePartenza((presa.palco as Palco).posto(chi)!), variazioneDaSeq(seq));

/** Le animazioni del Montone degli ordini, nell'ordine (volo, testata, corsa via); `azzera` dimentica quelle viste. */
function animazioniMontone(t: Teatro): (() => Array<{ f: Keyframe[]; o: KeyframeAnimationOptions }>) & { azzera(): void } {
  const anima = vi.spyOn(t.ctx, 'anima');
  const viste = () =>
    anima.mock.calls.filter(([e]) => (e as HTMLElement).classList.contains('montone')).map(([, f, o]) => ({ f, o }));
  return Object.assign(viste, { azzera: () => anima.mockClear() });
}

describe('testata: il Montone parte vicino alla pecora di chi tira e vola ad arco', () => {
  it.each([3, 0])('sugli altri telefoni: dalla pecora di chi tira al punto di scena della zona del risultato (%i)', async (quanti) => {
    const t = manuale();
    t.allinea(fotoIniziale(3), 'calmo');
    const montone = animazioniMontone(t);
    await finoAllaFine(t, t.ordini.testata('g1', 'g2', quanti, 7));
    const volo = montone()[0]!.f;
    expect(volo.length).toBeGreaterThan(2);
    const da = partenzaScena('g1', 7);
    vicino(piedi(volo[0]!), da);
    const arrivo = piedi(volo[volo.length - 1]!);
    expect(zonaDi(arrivo, recinto('g2'))).toBe(quanti);
    vicino(arrivo, puntoDiScena(recinto('g2'), quanti, 7));
    // A metà volo il Montone è in aria: i piedi stanno più in alto della retta tra partenza e arrivo
    const meta = piedi(volo[Math.floor(volo.length / 2)]!);
    expect(meta.y).toBeLessThan((da.y + arrivo.y) / 2 - 5);
    // Il Montone se n'è andato (gli agnellini colpiti possono essere ancora in volo verso il gregge)
    expect(radice.querySelectorAll('.montone')).toHaveLength(0);
    expect(errori).not.toHaveBeenCalled();
  });

  it('chi tira sta in alto: parte davanti ai suoi piedi, entro la variazione; un altro seq, un\'altra partenza', async () => {
    const t = manuale();
    t.allinea(fotoIniziale(3), 'calmo');
    const montone = animazioniMontone(t);
    await finoAllaFine(t, t.ordini.testata('g2', 'g3', 2, 7));
    const p7 = piedi(montone()[0]!.f[0]!);
    vicino(p7, partenzaScena('g2', 7));
    const base = basePartenza((presa.palco as Palco).posto('g2')!);
    expect(Math.hypot(p7.x - base.x, p7.y - base.y)).toBeLessThanOrEqual(FIONDA.variazionePartenza + 1e-6);
    montone.azzera();
    await finoAllaFine(t, t.ordini.testata('g2', 'g3', 2, 8));
    const p8 = piedi(montone()[0]!.f[0]!);
    vicino(p8, partenzaScena('g2', 8));
    expect(Math.hypot(p8.x - p7.x, p8.y - p7.y)).toBeGreaterThan(0.5);
  });

  it('su chi tira usa il tiro ricordato (partenza e arrivo) e poi lo azzera', async () => {
    const t = manuale();
    t.allinea(fotoIniziale(3), 'calmo');
    const r = recinto('g2');
    const l = r.x1 - r.x0, h = r.y1 - r.y0;
    // Il recinto al tiro era ingrandito (il doppio, attaccato al bordo davanti): l'arrivo vale in proporzione
    const grande: Rett = { x0: r.x0 - l / 2, y0: r.y1 - 2 * h, x1: r.x1 + l / 2, y1: r.y1 };
    const arrivoGrande = { x: grande.x0 + 0.7 * 2 * l, y: grande.y0 + 0.5 * 2 * h };
    t.ctx.regia.tiroLocale = { chi: 'g1', bersaglio: 'g2', esito: 2, arrivo: arrivoGrande, recinto: grande, partenza: { x: 70, y: 512 } };
    // Il Montone fermo della mira, se è ancora lì, se ne va
    const fermo = document.createElement('div');
    fermo.className = 'abs fionda-montone';
    t.ctx.el.mondo.appendChild(fermo);
    const montone = animazioniMontone(t);
    const fine = t.ordini.testata('g1', 'g2', 2, 7);
    expect(t.ctx.regia.tiroLocale).toBeNull();
    expect(fermo.isConnected).toBe(false);
    await finoAllaFine(t, fine);
    const volo = montone()[0]!.f;
    // Parte proprio da dove stava il Montone della mira
    vicino(piedi(volo[0]!), { x: 70, y: 512 });
    const arrivo = piedi(volo[volo.length - 1]!);
    vicino(arrivo, { x: r.x0 + 0.7 * l, y: r.y0 + 0.5 * h });
    expect(zonaDi(arrivo, r)).toBe(2);
  });

  it('su chi tira un colpo a vuoto: dalla sua partenza, atterra fuori dalla parte del tiro', async () => {
    const t = manuale();
    t.allinea(fotoIniziale(3), 'calmo');
    const r = recinto('g2');
    const l = r.x1 - r.x0, h = r.y1 - r.y0;
    // Il 20% della larghezza a destra del recinto, a metà altezza (oltre la fascia della zona 1)
    t.ctx.regia.tiroLocale = { chi: 'g1', bersaglio: 'g2', esito: 0, arrivo: { x: r.x1 + 0.4 * l, y: r.y0 + 0.5 * h }, recinto: { ...r }, partenza: { x: 58, y: 525 } };
    const montone = animazioniMontone(t);
    await finoAllaFine(t, t.ordini.testata('g1', 'g2', 0, 7));
    const volo = montone()[0]!.f;
    vicino(piedi(volo[0]!), { x: 58, y: 525 });
    vicino(piedi(volo[volo.length - 1]!), { x: r.x1 + 0.4 * l, y: r.y0 + 0.5 * h });
    expect(t.ctx.regia.tiroLocale).toBeNull();
  });

  it.each([
    { nome: 'un altro bersaglio', bersaglio: 'g3', esito: 2 },
    { nome: 'un altro esito', bersaglio: 'g2', esito: 1 },
  ])('tiro ricordato per un altro bersaglio o un altro esito: partenza e punto di scena ($nome)', async ({ bersaglio, esito }) => {
    const t = manuale();
    t.allinea(fotoIniziale(3), 'calmo');
    const r = recinto('g2');
    t.ctx.regia.tiroLocale = { chi: 'g1', bersaglio, esito, arrivo: { x: r.x0 + 1, y: r.y0 + 1 }, recinto: { ...r }, partenza: { x: 70, y: 512 } };
    const montone = animazioniMontone(t);
    await finoAllaFine(t, t.ordini.testata('g1', 'g2', 2, 9));
    const volo = montone()[0]!.f;
    vicino(piedi(volo[0]!), partenzaScena('g1', 9));
    vicino(piedi(volo[volo.length - 1]!), puntoDiScena(r, 2, 9));
    expect(t.ctx.regia.tiroLocale).toBeNull();
  });

  it('un tiro ricordato di un altro giocatore (stesso bersaglio, stesso esito) non vale: partenza e punto di scena di chi tira', async () => {
    const t = manuale();
    t.allinea(fotoIniziale(3), 'calmo');
    const r = recinto('g3');
    // Il tiro di g1 rimasto lì (la sua recita è saltata); adesso fa la Testata g2, sullo stesso recinto, con lo stesso esito
    t.ctx.regia.tiroLocale = { chi: 'g1', bersaglio: 'g3', esito: 0, arrivo: { x: r.x1 + 60, y: r.y1 + 40 }, recinto: { ...r }, partenza: { x: 200, y: 600 } };
    const montone = animazioniMontone(t);
    await finoAllaFine(t, t.ordini.testata('g2', 'g3', 0, 9));
    const volo = montone()[0]!.f;
    vicino(piedi(volo[0]!), partenzaScena('g2', 9));
    vicino(piedi(volo[volo.length - 1]!), puntoDiScena(r, 0, 9));
    expect(t.ctx.regia.tiroLocale).toBeNull();
  });

  it.each([2, 0])('dopo il tiro nessun cerchio: in volo e a terra solo il recinto; lo sbuffo di un secondo resta (esito %i)', async (quanti) => {
    const t = manuale();
    t.allinea(fotoIniziale(3), 'calmo');
    const cerchi = () => radice.querySelector('.cerchi-testata, .mondo .bollino, .mondo ellipse.centro, .mondo rect.fascia');
    const originale = t.ctx.anima.bind(t.ctx);
    const visti: boolean[] = [];
    const sbuffi: Array<{ e: HTMLElement; durata: unknown }> = [];
    vi.spyOn(t.ctx, 'anima').mockImplementation((e, f, o) => {
      visti.push(!!cerchi());
      if ((e as HTMLElement).classList.contains('sbuffo-testata')) sbuffi.push({ e: e as HTMLElement, durata: o.duration });
      return originale(e, f, o);
    });
    const fine = t.ordini.testata('g1', 'g2', quanti, 7);
    expect(cerchi()).toBeNull();
    await finoAllaFine(t, fine);
    expect(visti.length).toBeGreaterThan(3);
    expect(visti.some((v) => v)).toBe(false);
    expect(cerchi()).toBeNull();
    // Uno sbuffo al punto d'arrivo, per un secondo
    expect(sbuffi).toHaveLength(1);
    expect(sbuffi[0]!.durata).toBe(1000);
    const p = puntoDiScena(recinto('g2'), quanti, 7);
    expect(sbuffi[0]!.e.dataset.x).toBe(String(p.x));
    expect(sbuffi[0]!.e.dataset.y).toBe(String(p.y));
  });
});

describe('testata: volo, testata, stordito, scuote la testa, corre via', () => {
  it.each([2, 0])('le pose in fila: volo, botta, stordito per circa 2 s, scuote, corre (esito %i)', async (quanti) => {
    const t = manuale();
    animazioniSulOrologio(t);
    t.allinea(fotoIniziale(3), 'calmo');
    const montone = animazioniMontone(t);
    const inizio = t.ctx.orologio.ms;
    await finoAllaFine(t, t.ordini.testata('g1', 'g2', quanti, 7));
    const p = poseMontone().map((x) => ({ ...x, ms: x.ms - inizio }));
    expect(p.map((x) => x.posa)).toEqual(['volo', 'botta', 'stordito', 'scuote', 'corre']);
    expect(p.every((x) => !x.ferma)).toBe(true);
    const durata = (i: number): number => p[i + 1]!.ms - p[i]!.ms;
    // Il volo comincia subito; la testata all'arrivo, alla fine del volo
    expect(p[0]!.ms).toBe(0);
    expect(durata(0)).toBe(montone()[0]!.o.duration);
    expect(durata(1)).toBeGreaterThanOrEqual(500);
    expect(durata(2)).toBeGreaterThanOrEqual(1800);
    expect(durata(2)).toBeLessThanOrEqual(2200);
    expect(durata(3)).toBeGreaterThanOrEqual(600);
    // Corre via verso il lato più vicino, guardando dove va, fino fuori dallo schermo
    const corsa = montone().at(-1)!.f;
    const da = piedi(corsa[0]!), fuori = piedi(corsa.at(-1)!);
    const lato = da.x < W / 2 ? -1 : 1;
    expect(Math.sign(fuori.x - da.x)).toBe(lato);
    expect(fuori.x < -50 || fuori.x > W + 50).toBe(true);
    for (const f of corsa) expect(verso(f)).toBe(lato);
    expect(radice.querySelectorAll('.montone')).toHaveLength(0);
    expect(errori).not.toHaveBeenCalled();
  });

  it.each([
    { quanti: 3, nome: 'al centro' },
    { quanti: 2, nome: 'vicino alla staccionata di lato' },
    { quanti: 1, nome: 'sulla staccionata' },
  ])('colpito $nome ($quanti): testata, stordito e corsa partono dal punto d\'arrivo, nella zona del risultato (niente rimbalzo)', async ({ quanti }) => {
    const t = manuale();
    t.allinea(fotoIniziale(3), 'calmo');
    const r = recinto('g2');
    const l = r.x1 - r.x0, h = r.y1 - r.y0;
    const arrivo: Punto =
      quanti === 3 ? { x: r.x0 + 0.5 * l, y: r.y0 + 0.5 * h } : quanti === 2 ? { x: r.x1 - 0.08 * l, y: r.y0 + 0.5 * h } : { x: r.x1, y: r.y0 + 0.5 * h };
    expect(zonaDi(arrivo, r)).toBe(quanti);
    // Un tiro quasi verticale (il caso più comune): la partenza appena a sinistra dell'arrivo
    t.ctx.regia.tiroLocale = { chi: 'g1', bersaglio: 'g2', esito: quanti, arrivo, recinto: { ...r }, partenza: { x: arrivo.x - 1, y: 518 } };
    const montone = animazioniMontone(t);
    await finoAllaFine(t, t.ordini.testata('g1', 'g2', quanti, 7));
    const [, botta, corsa] = montone();
    // La testata resta nel punto d'arrivo, senza saltelli (stessa altezza dei piedi in ogni fotogramma)
    for (const f of botta!.f) vicino(piedi(f), arrivo);
    // Stordito e scuote stanno fermi dove finisce la testata: la corsa parte da lì, nella zona del risultato
    const da = piedi(corsa!.f[0]!);
    vicino(da, arrivo);
    expect(zonaDi(da, r)).toBe(quanti);
  });

  it('colpito: alla testata tonfo, paura, il prato trema 260 ms e gli agnellini volano nel Gregge', async () => {
    const t = manuale();
    animazioniSulOrologio(t);
    t.allinea(fotoIniziale(3), 'calmo');
    const palco = presa.palco as Palco;
    const fatti: string[] = [];
    const branco = palco.branco()!;
    const sposta = branco.sposta.bind(branco);
    const spostati = vi.spyOn(branco, 'sposta').mockImplementation((...a) => {
      fatti.push(`agnellini ${ultimaPosa()}`);
      return sposta(...a);
    });
    const reagisci = palco.reagisci.bind(palco);
    vi.spyOn(palco, 'reagisci').mockImplementation((chi, tipo) => {
      fatti.push(`${chi} ${tipo} ${ultimaPosa()}`);
      reagisci(chi, tipo);
    });
    const suona = vi.spyOn(t.ctx, 'suona');
    const originale = t.ctx.anima.bind(t.ctx);
    vi.spyOn(t.ctx, 'anima').mockImplementation((e, f, o) => {
      if (e === t.ctx.el.mondo) fatti.push(`prato ${o.duration} ${ultimaPosa()}`);
      return originale(e, f, o);
    });
    await finoAllaFine(t, t.ordini.testata('g1', 'g2', 2, 7));
    expect(spostati).toHaveBeenCalledTimes(1);
    expect(spostati).toHaveBeenCalledWith(2, 'g2', 'gregge', 'vola');
    expect(fatti).toEqual(expect.arrayContaining(['agnellini botta', 'g2 paura botta', 'prato 260 botta']));
    expect(suona).toHaveBeenCalledWith('tonfo');
  });

  it('a vuoto (corto, davanti al recinto): un tonfo più leggero a terra, niente paura né scossa del prato, nessun agnellino si muove', async () => {
    const t = manuale();
    t.allinea(fotoIniziale(3), 'calmo');
    const anima = vi.spyOn(t.ctx, 'anima');
    const suona = vi.spyOn(t.ctx, 'suona');
    const reagisci = vi.spyOn(presa.palco as Palco, 'reagisci');
    const prima = t.stato().agnellini;
    // seq dispari: il mancato di scena davanti al recinto (corto: atterra). Quello lungo vola oltre e sparisce (più sotto)
    expect(colpoLungo(partenzaScena('g1', 5), puntoDiScena(recinto('g2'), 0, 5), recinto('g2'))).toBe(false);
    await finoAllaFine(t, t.ordini.testata('g1', 'g2', 0, 5));
    expect(anima.mock.calls.some(([e]) => e === t.ctx.el.mondo)).toBe(false);
    expect(reagisci).not.toHaveBeenCalledWith('g2', 'paura');
    expect(suona).toHaveBeenCalledWith('tonfo', 0.5);
    expect(suona).not.toHaveBeenCalledWith('tonfo');
    expect(t.stato().agnellini).toEqual(prima);
    expect(poseMontone().map((x) => x.posa)).toEqual(['volo', 'botta', 'stordito', 'scuote', 'corre']);
    expect(radice.querySelectorAll('.montone')).toHaveLength(0);
  });

  it('colpo e mancato durano uguale, quanto dice durate.json (chi ospita la usa per tutti)', async () => {
    const t = manuale();
    animazioniSulOrologio(t);
    t.allinea(fotoIniziale(3), 'calmo');
    const colpo = await finoAllaFine(t, t.ordini.testata('g1', 'g2', 2, 4));
    const mancato = await finoAllaFine(t, t.ordini.testata('g1', 'g2', 0, 4));
    expect(mancato).toBe(colpo);
    expect(colpo).toBeLessThanOrEqual(DURATE_NORMALI.testata);
    expect(colpo).toBeGreaterThan(DURATE_NORMALI.testata - 100);
  });

  it.each([
    { fase: 'stordito', poi: 900 },
    { fase: 'scuote', poi: 300 },
    { fase: 'corre', poi: 300 },
  ])('interrompi a metà ($fase): via Montone, ombra e sbuffo, evento chiuso, niente più pose', async ({ fase, poi }) => {
    const t = manuale();
    animazioniSulOrologio(t);
    t.allinea(fotoIniziale(3), 'calmo');
    let finito = false;
    void t.ordini.testata('g1', 'g2', 2, 3).then(() => (finito = true));
    await scarica();
    for (let i = 0; i < 80 && ultimaPosa() !== fase; i++) await scorri(t, 100);
    await scorri(t, poi);
    expect(ultimaPosa()).toBe(fase);
    expect(radice.querySelectorAll('.montone')).toHaveLength(1);
    (t.ordini as OrdiniDelTeatro).interrompi();
    await scorri(t, 100);
    expect(finito).toBe(true);
    expect(radice.querySelectorAll('.montone, .ombra-montone, .sbuffo-testata, .cerchi-testata')).toHaveLength(0);
    expect(t.eventoInCorso()).toBe(false);
    const n = poseMontone().length;
    await scorri(t, 3000);
    expect(poseMontone()).toHaveLength(n);
    expect(errori).not.toHaveBeenCalled();
  });

  it('ricostruzione del tavolo a metà stordimento (un altro giocatore in basso): via il Montone', async () => {
    const t = manuale();
    animazioniSulOrologio(t);
    const f = fotoIniziale(3);
    t.allinea(f, 'calmo');
    let finito = false;
    void t.ordini.testata('g1', 'g2', 2, 3).then(() => (finito = true));
    await scarica();
    for (let i = 0; i < 80 && ultimaPosa() !== 'stordito'; i++) await scorri(t, 100);
    await scorri(t, 500);
    expect(ultimaPosa()).toBe('stordito');
    t.allinea({ ...f, posti: [...f.posti.slice(1), f.posti[0]!] }, 'calmo');
    await scorri(t, 100);
    expect(finito).toBe(true);
    expect(radice.querySelectorAll('.montone, .ombra-montone, .cerchi-testata')).toHaveLength(0);
    expect(t.eventoInCorso()).toBe(false);
  });
});

describe('testata: il passaggio dalla mira al volo', () => {
  /** Il verso (scala orizzontale, con il segno) e l'inclinazione di un fotogramma. */
  function scalaEGiro(f: Keyframe): { sx: number; k: number; giro: number } {
    const s = /scale\(([-\d.e]+),\s*([-\d.e]+)\)/.exec(String(f.transform));
    const g = /rotate\(([-\d.e]+)deg\)/.exec(String(f.transform));
    expect(s && g, String(f.transform)).toBeTruthy();
    return { sx: Number(s![1]), k: Number(s![2]), giro: Number(g![1]) };
  }

  it.each([
    { nome: 'a sinistra della partenza', partenzaX: 330, verso: -1 },
    { nome: 'a destra della partenza', partenzaX: 10, verso: 1 },
  ])('arrivo $nome: il volo parte come il Montone della mira (a destra, dritto) e si gira piano nei primi passi', async ({ partenzaX, verso: atteso }) => {
    const t = manuale();
    t.allinea(fotoIniziale(3), 'calmo');
    const r = recinto('g2');
    const arrivo = { x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2 };
    t.ctx.regia.tiroLocale = { chi: 'g1', bersaglio: 'g2', esito: 3, arrivo, recinto: { ...r }, partenza: { x: partenzaX, y: 518 } };
    const montone = animazioniMontone(t);
    await finoAllaFine(t, t.ordini.testata('g1', 'g2', 3, 7));
    const volo = montone()[0]!.f.map(scalaEGiro);
    // Il primo fotogramma è il Montone della mira: guarda a destra, dritto
    expect(volo[0]!.sx).toBeGreaterThan(0);
    expect(volo[0]!.giro).toBe(0);
    // Poi si gira (se serve) e si inclina un poco alla volta: niente scatti tra un fotogramma e l'altro (un giro intero, da
    // +k a -k, in almeno due passi)
    for (let i = 1; i < volo.length; i++) {
      const k = volo[i]!.k;
      expect(Math.abs(volo[i]!.sx - volo[i - 1]!.sx), `verso al passo ${i}`).toBeLessThanOrEqual(1.4 * k);
      expect(Math.abs(volo[i]!.giro - volo[i - 1]!.giro), `inclinazione al passo ${i}`).toBeLessThanOrEqual(8);
    }
    // Dal primo sesto del volo guarda dove va
    for (const p of volo.slice(Math.ceil(volo.length / 6))) expect(Math.sign(p.sx)).toBe(atteso);
  });
});

describe('testata: ombra, profondità, movimento ridotto', () => {
  /** Il Montone a terra sul prato: sotto la collina, dentro lo schermo, a vuoto sul bersaglio e fuori dagli altri recinti. */
  function sulPratoAVuoto(giu: Punto, bersaglio: IdGiocatore, nota: string): void {
    const { prato, lati } = FIONDA.atterraggio;
    expect(giu.y, `${nota}: sotto la collina`).toBeGreaterThanOrEqual(prato - 1e-6);
    expect(giu.x, nota).toBeGreaterThanOrEqual(lati - 1e-6);
    expect(giu.x, nota).toBeLessThanOrEqual(W - lati + 1e-6);
    expect(zonaDi(giu, recinto(bersaglio)), `${nota}: a vuoto`).toBe(0);
    for (const c of (presa.palco as Palco).giocatori()) {
      if (c === bersaglio) continue;
      const a = recinto(c);
      expect(giu.x >= a.x0 && giu.x <= a.x1 && giu.y >= a.y0 && giu.y <= a.y1, `${nota}: nel recinto di ${c}`).toBe(false);
    }
  }

  it.each([
    { nome: 'in alto a sinistra', arrivo: { x: -200, y: -150 } },
    { nome: 'a destra', arrivo: { x: 600, y: 120 } },
  ])('un tiro lunghissimo atterra sul prato dentro lo schermo ($nome), sempre a vuoto; stordito e corsa da lì', async ({ arrivo }) => {
    const t = manuale();
    t.allinea(fotoIniziale(3), 'calmo');
    const r = recinto('g2');
    t.ctx.regia.tiroLocale = { chi: 'g1', bersaglio: 'g2', esito: 0, arrivo, recinto: { ...r }, partenza: { x: 198, y: 600 } };
    const montone = animazioniMontone(t);
    await finoAllaFine(t, t.ordini.testata('g1', 'g2', 0, 7));
    const [volo, botta, corsa] = montone();
    const giu = piedi(volo!.f.at(-1)!);
    sulPratoAVuoto(giu, 'g2', 'tiro lunghissimo');
    for (const f of botta!.f) vicino(piedi(f), giu);
    vicino(piedi(corsa!.f[0]!), giu);
  });

  it.each([2 as const, 3 as const, 4 as const])(
    'un mancato che atterra resta sul prato prima della collina, a vuoto e fuori dagli altri recinti; uno lungo vola lungo la linea del tiro, mai di lato (%i giocatori)',
    async (n) => {
      const t = manuale();
      t.allinea(fotoIniziale(n), 'calmo');
      const montone = animazioniMontone(t);
      /** Il primo volo (deciso alla partenza): poi la Testata si interrompe, non serve vederla tutta. */
      const voloDi = async (fine: Promise<void>): Promise<Keyframe[]> => {
        const volo = montone()[0]!.f;
        (t.ordini as OrdiniDelTeatro).interrompi();
        await finoAllaFine(t, fine);
        montone.azzera();
        return volo;
      };
      /** Atterra sul prato, oppure (colpo lungo) vola dalla partenza lungo la linea verso il punto vero, fino a lui o al cielo. */
      const controlla = (volo: Keyframe[], da: Punto, vero: Punto, b: IdGiocatore, nota: string): void => {
        const r = recinto(b);
        if (!colpoLungo(da, vero, r)) return sulPratoAVuoto(piedi(volo.at(-1)!), b, nota);
        vicino(piedi(volo[0]!), da);
        // In pianta sempre sulla linea: l'arco alza il Montone (solo in verticale), il volo nel cielo va dritto
        const dx = vero.x - da.x, dy = vero.y - da.y;
        // In orizzontale va sempre avanti dalla partenza verso il punto vero, senza tornare indietro né andare di lato
        const xs = volo.map((k) => (piedi(k).x - da.x) * Math.sign(dx || 1));
        for (let i = 1; i < xs.length; i++) expect(xs[i]!, `${nota}: passo ${i}`).toBeGreaterThanOrEqual(xs[i - 1]! - 1e-6);
        const fine = piedi(volo.at(-1)!);
        const sullaLinea = Math.abs(dx * (fine.y - da.y) - dy * (fine.x - da.x)) / Math.hypot(dx, dy);
        expect(sullaLinea, `${nota}: arriva sulla linea del tiro`).toBeLessThan(1e-6);
      };
      const ids = (presa.palco as Palco).giocatori();
      for (const b of ids) {
        const r = recinto(b);
        const c = { x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2 };
        if (b !== 'g1') {
          // Su chi tira (in basso): ben oltre il recinto, lungo la linea dalla partenza (la collina, la casetta, il cielo),
          // dritto e un po' di lato
          for (const dx of [-40, 0, 40]) {
            const P = partenzaScena('g1', 3);
            const vero = { x: P.x + (c.x + dx - P.x) * 2.5, y: P.y + (c.y - P.y) * 2.5 };
            t.ctx.regia.tiroLocale = { chi: 'g1', bersaglio: b, esito: 0, arrivo: vero, recinto: { ...r }, partenza: P };
            controlla(await voloDi(t.ordini.testata('g1', b, 0, 3)), P, vero, b, `g1 → ${b}, ${dx}`);
          }
        }
        // Sugli altri telefoni: il mancato di scena, lungo (seq pari, oltre la staccionata dietro) e corto (seq dispari)
        const chi = b === 'g1' ? 'g2' : 'g1';
        for (const seq of [2, 3, 4, 5, 6, 8]) {
          const volo = await voloDi(t.ordini.testata(chi, b, 0, seq));
          controlla(volo, partenzaScena(chi, seq), puntoDiScena(r, 0, seq), b, `${chi} → ${b}, seq ${seq}`);
        }
      }
    },
  );

  /** Il centro dell'ombra in un fotogramma (il disegno è 80×16, centro in 40, 8). */
  function centroOmbra(f: Keyframe): Punto {
    const m = /translate\(([-\d.e]+)px,\s*([-\d.e]+)px\)/.exec(String(f.transform));
    expect(m, String(f.transform)).not.toBeNull();
    return { x: Number(m![1]) + 40, y: Number(m![2]) + 8 };
  }

  it('durante il volo un\'ombra a terra segue il percorso, senza l\'arco; all\'arrivo se ne va', async () => {
    const t = manuale();
    t.allinea(fotoIniziale(3), 'calmo');
    const anima = vi.spyOn(t.ctx, 'anima');
    await finoAllaFine(t, t.ordini.testata('g1', 'g2', 2, 7));
    const chiamate = anima.mock.calls.filter(([e]) => (e as HTMLElement).classList.contains('ombra-montone'));
    expect(chiamate).toHaveLength(1);
    const [e, f] = chiamate[0]!;
    expect((e as HTMLElement).style.zIndex).not.toBe('');
    const da = partenzaScena('g1', 7);
    const arrivo = puntoDiScena(recinto('g2'), 2, 7);
    const primo = centroOmbra(f[0]!), ultimo = centroOmbra(f[f.length - 1]!), meta = centroOmbra(f[Math.floor(f.length / 2)]!);
    vicino(primo, da);
    vicino(ultimo, arrivo);
    // A metà volo l'ombra sta a terra, a metà strada (il Montone invece è in alto)
    expect(meta.y).toBeCloseTo((da.y + arrivo.y) / 2, 3);
    expect(radice.querySelectorAll('.ombra-montone')).toHaveLength(0);
  });

  it('interrompi a metà volo: via il Montone e la sua ombra', async () => {
    animazioniSospese();
    const t = manuale();
    t.allinea(fotoIniziale(3), 'calmo');
    let finito = false;
    void t.ordini.testata('g1', 'g2', 2, 3).then(() => (finito = true));
    await scorri(t, 300);
    expect(radice.querySelectorAll('.ombra-montone')).toHaveLength(1);
    (t.ordini as OrdiniDelTeatro).interrompi();
    await scorri(t, 100);
    expect(finito).toBe(true);
    expect(radice.querySelectorAll('.ombra-montone, .montone')).toHaveLength(0);
  });

  it('atterrato su un recinto dietro, il Montone torna alla profondità del punto d\'arrivo', async () => {
    const t = manuale();
    t.allinea(fotoIniziale(3), 'calmo');
    const da = partenzaScena('g1', 7);
    const arrivo = puntoDiScena(recinto('g2'), 2, 7);
    // g2 sta dietro la tovaglia
    expect(arrivo.y).toBeLessThan(CENTRO_TAVOLO.y);
    const originale = t.ctx.anima.bind(t.ctx);
    const livelli: string[] = [];
    vi.spyOn(t.ctx, 'anima').mockImplementation((e, f, o) => {
      if ((e as HTMLElement).classList.contains('montone')) livelli.push((e as HTMLElement).style.zIndex);
      return originale(e, f, o);
    });
    await finoAllaFine(t, t.ordini.testata('g1', 'g2', 2, 7));
    // In volo sopra tutto, allo stesso livello del Montone della mira (scena.css, `.fionda-montone`): al lancio niente salto
    // di profondità, né davanti né dietro la propria pecora e il proprio recinto. Poi testata e corsa alla profondità
    // dell'arrivo (dietro la staccionata davanti)
    expect(da.y).toBeGreaterThan(arrivo.y);
    const css = readFileSync(resolve(process.cwd(), 'client/src/scena/scena.css'), 'utf8');
    const mira = /\.teatro \.fionda-montone \{[^}]*z-index:\s*(\d+)/.exec(css);
    expect(mira).not.toBeNull();
    expect(livelli).toHaveLength(3);
    expect(livelli[0]).toBe(mira![1]);
    expect(livelli[1]).toBe(String(Math.round(100 + arrivo.y + 8)));
    expect(livelli[2]).toBe(String(Math.round(100 + arrivo.y + 8)));
  });

  it.each([2, 0])('movimento ridotto: ogni animazione della Testata dura 1 ms (esito %i)', async (quanti) => {
    const t = manuale();
    t.allinea(fotoIniziale(3), 'calmo');
    t.ctx.ridotto = true;
    const anima = vi.spyOn(t.ctx, 'anima');
    await finoAllaFine(t, t.ordini.testata('g1', 'g2', quanti, 7));
    const mie = anima.mock.calls.filter(([e]) => {
      const c = (e as HTMLElement).classList;
      return c.contains('montone') || c.contains('ombra-montone') || e === t.ctx.el.mondo;
    });
    expect(mie.length).toBeGreaterThanOrEqual(quanti > 0 ? 5 : 4);
    for (const [, , o] of mie) expect(o.duration).toBe(1);
  });

  it.each([2, 0])('movimento ridotto: il Montone fermo nel punto d\'arrivo per 800 ms, poi via; niente volo, stordimento animato né corsa (esito %i)', async (quanti) => {
    const t = manuale();
    t.allinea(fotoIniziale(3), 'calmo');
    t.ctx.ridotto = true;
    const originale = t.ctx.anima.bind(t.ctx);
    const inizio = t.ctx.orologio.ms;
    const chiamate: Array<{ ms: number; f: Keyframe[]; ferma: boolean }> = [];
    vi.spyOn(t.ctx, 'anima').mockImplementation((e, f, o) => {
      const c = (e as HTMLElement).classList;
      if (c.contains('montone')) chiamate.push({ ms: t.ctx.orologio.ms - inizio, f, ferma: c.contains('ferma') });
      return originale(e, f, o);
    });
    const ms = await finoAllaFine(t, t.ordini.testata('g1', 'g2', quanti, 7));
    expect(chiamate).toHaveLength(3);
    const arrivo = puntoDiScena(recinto('g2'), quanti, 7);
    // A terra resta nel punto d'arrivo (niente rimbalzo), fermo (classe ferma), e se ne va dopo 800 ms
    for (const f of chiamate[1]!.f) vicino(piedi(f), arrivo);
    vicino(piedi(chiamate[2]!.f[0]!), arrivo);
    expect(chiamate.every((c) => c.ferma)).toBe(true);
    expect(chiamate[2]!.ms - chiamate[1]!.ms).toBeGreaterThanOrEqual(800);
    expect(poseMontone().map((x) => x.posa)).toEqual(['stordito']);
    expect(ms).toBeLessThanOrEqual(1000);
    expect(radice.querySelectorAll('.montone')).toHaveLength(0);
  });
});

describe('testata: chi sta sotto il Montone si scansa e poi torna al suo posto', () => {
  interface Tenuta {
    el: Element;
    f: Keyframe[];
    o: KeyframeAnimationOptions;
    da: number;
    durata: number;
    annullata: boolean;
  }
  /**
   * Come `animazioniSulOrologio`, e in più ricorda ogni animazione per dire che cosa resta applicato adesso a un elemento,
   * come le Web Animations: vince l'ultima partita; finita, resta solo con `fill: forwards`; annullata, sparisce. A metà
   * strada dà il fotogramma già raggiunto.
   */
  function animazioniTenute(t: Teatro): { tutte: Tenuta[]; di(e: Element): Tenuta[]; applicata(e: Element): string | null } {
    const tutte: Tenuta[] = [];
    Object.defineProperty(Element.prototype, 'animate', {
      configurable: true,
      writable: true,
      value: function (this: Element, f: Keyframe[], opzioni?: number | KeyframeAnimationOptions): Animation {
        const o: KeyframeAnimationOptions = typeof opzioni === 'number' ? { duration: opzioni } : (opzioni ?? {});
        const durata = Number(o.duration ?? 0) + (o.delay ?? 0);
        const tenuta: Tenuta = { el: this, f, o, da: t.ctx.orologio.ms, durata, annullata: false };
        tutte.push(tenuta);
        let chiudi = (): void => undefined;
        let timer = 0;
        const a = {
          playbackRate: 1,
          finished: undefined as unknown as Promise<Animation>,
          cancel: () => {
            tenuta.annullata = true;
            t.ctx.orologio.annulla(timer);
            chiudi();
          },
          finish: () => chiudi(),
          play() {},
          pause() {},
          addEventListener() {},
          removeEventListener() {},
        };
        a.finished = new Promise((fine) => {
          chiudi = () => fine(a as unknown as Animation);
          timer = t.ctx.orologio.dopo(chiudi, durata);
        });
        return a as unknown as Animation;
      },
    });
    const di = (e: Element) => tutte.filter((a) => a.el === e);
    function applicata(e: Element): string | null {
      const ora = t.ctx.orologio.ms;
      for (const a of [...di(e)].reverse()) {
        if (a.annullata) continue;
        const q = a.durata > 0 ? (ora - a.da) / a.durata : 1;
        if (q < 1) {
          const n = a.f.length;
          let scelto = a.f[0]!;
          a.f.forEach((k, i) => {
            if ((k.offset ?? (n > 1 ? i / (n - 1) : 1)) <= q) scelto = k;
          });
          return String(scelto.transform);
        }
        if (a.o.fill === 'forwards' || a.o.fill === 'both') return String(a.f.at(-1)!.transform);
      }
      return null;
    }
    return { tutte, di, applicata };
  }

  /** Spostamento e verso di una pecora da una trasformazione (null: al suo posto, nel suo verso). */
  function spostamento(tr: string | null): { dx: number; dy: number; sx: number } {
    if (tr === null || tr === 'none') return { dx: 0, dy: 0, sx: 1 };
    const m = /translate\(([-\d.e]+)px,\s*([-\d.e]+)px\)(?:\s*scaleX\(([-\d.e]+)\))?/.exec(tr);
    expect(m, tr).not.toBeNull();
    return { dx: Number(m![1]), dy: Number(m![2]), sx: m![3] === undefined ? 1 : Number(m![3]) };
  }

  const palco = (): Palco => presa.palco as Palco;
  const gregge = (): Agnello[] => [...palco().area('gregge')!.agnelli];
  /** Un agnellino fermo in (x, y) che non va da nessuna parte da solo (bruca a lungo). */
  function fermo(a: Agnello, x: number, y: number): void {
    a.x = a.tx = x;
    a.y = a.ty = y;
    a.stato = 'bruca';
    a.t = 1e6;
  }
  const ingombroDi = (a: { x: number; y: number }) => ingombroAgnello(a, palco().profondita(a.y));
  const largoIn = (p: Punto) => largoMontone(palco().profondita(p.y));
  /** Il tiro fatto su questo telefono, con esito `esito`, che atterra proprio in `arrivo` (sul recinto di g2). */
  function tiroIn(t: Teatro, arrivo: Punto, esito = 0): void {
    const r = recinto('g2');
    expect(zonaDi(arrivo, r)).toBe(esito);
    t.ctx.regia.tiroLocale = { chi: 'g1', bersaglio: 'g2', esito, arrivo, recinto: { ...r }, partenza: { x: 64, y: 518 } };
  }
  /** Fino alla posa `posa` del Montone (al più 8 s), poi ancora `poi` ms. */
  async function finoA(t: Teatro, posa: string, poi = 0): Promise<void> {
    for (let i = 0; i < 80 && ultimaPosa() !== posa; i++) await scorri(t, 100);
    expect(ultimaPosa()).toBe(posa);
    await scorri(t, poi);
  }
  /** Fino alla fine della Testata (al più 8 s). */
  async function finoAlFinito(t: Teatro, finito: () => boolean): Promise<void> {
    for (let i = 0; i < 80 && !finito(); i++) await scorri(t, 100);
    expect(finito()).toBe(true);
  }
  /** Un mancato che copre la pecora di g2 (in alto a sinistra, con 3 giocatori) e l'agnellino del Gregge più a sinistra. */
  function pecoraEAgnellini(t: Teatro): { arrivo: Punto; vicini: Agnello[]; lontani: Agnello[] } {
    const ag = gregge();
    expect(ag.length).toBeGreaterThanOrEqual(4);
    fermo(ag[0]!, 108, 222);
    ag.slice(1).forEach((a, i) => fermo(a, 262 + (i % 3) * 9, 240 + (i % 4) * 5));
    const arrivo = { x: 60, y: 200 };
    tiroIn(t, arrivo);
    expect(coperto(arrivo, largoIn(arrivo), ingombroPecora(palco().posto('g2')!))).toBe(true);
    expect(coperto(arrivo, largoIn(arrivo), ingombroDi(ag[0]!))).toBe(true);
    return { arrivo, vicini: [ag[0]!], lontani: ag.slice(1) };
  }
  /** Il tiro di questo telefono su `bersaglio` (a vuoto se non detto), che atterra proprio in `arrivo`. */
  function tiroSu(t: Teatro, bersaglio: IdGiocatore, arrivo: Punto, esito = 0): void {
    const r = recinto(bersaglio);
    expect(zonaDi(arrivo, r)).toBe(esito);
    t.ctx.regia.tiroLocale = { chi: 'g1', bersaglio, esito, arrivo, recinto: { ...r }, partenza: { x: 64, y: 518 } };
  }
  /** Le scatole dei recinti a riposo (disposizione: x, staccionata dietro, staccionata davanti, larghezza). */
  const recinti = (): Rett[] =>
    palco().giocatori().map((c) => {
      const [x, y0, y1, l] = palco().posto(c)!.recinto;
      return { x0: x, y0, x1: x + l, y1 };
    });
  /** Il corpo della pecora di una postazione spostata di lato di `dx` (come in `corsaVia`). */
  const corpoDi = (g: { x: number; y: number; w: number }, dx: number): Rett => {
    const cx = g.x + g.w / 2 + dx;
    return { x0: cx - 0.35 * g.w, x1: cx + 0.35 * g.w, y0: g.y + 0.2 * g.w, y1: g.y + 0.78 * g.w };
  };
  const tocca = (a: Rett, b: Rett): boolean => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
  /** Come se accanto alla pecora di `c` non ci fosse il suo recinto (la scatola portata fuori dalla scena): di lato c'è posto. */
  function senzaRecintoAccanto(c: IdGiocatore): void {
    const p = palco();
    const vero = p.posto.bind(p);
    vi.spyOn(p, 'posto').mockImplementation((x) => {
      const g = vero(x);
      return g && x === c ? { ...g, recinto: [1000, g.recinto[1], g.recinto[2], 10, g.recinto[4]] } : g;
    });
  }
  /** Da che parte cade sul prato l'ombra al sole della pecora: il segno della pendenza, con le specchiature di disegno e cornice. */
  function latoOmbra(p: { svg: SVGSVGElement }, sxCornice: number): number {
    const ombra = p.svg.querySelector(':scope > g')!;
    const m = /matrix\(([-\d.e]+) ([-\d.e]+) ([-\d.e]+)/.exec(ombra.getAttribute('transform') ?? '');
    expect(m, ombra.getAttribute('transform') ?? '').not.toBeNull();
    const sxDisegno = /scaleX\(-1\)/.test(p.svg.style.transform) ? -1 : 1;
    return Math.sign(Number(m![3])) * sxDisegno * Math.sign(sxCornice);
  }
  /** Il livello del Montone in scena adesso. */
  const livelloMontone = (): number => Number(radice.querySelector<HTMLElement>('.montone')!.style.zIndex);

  it('un mancato sulla pecora di g2, con il posto libero di lato: si accorge verso la fine del volo, si scansa quanto basta, guarda il Montone e torna con la corsa', async () => {
    const t = manuale();
    const anim = animazioniTenute(t);
    t.allinea(fotoIniziale(3), 'calmo');
    senzaRecintoAccanto('g2');
    const pecora = palco().pecora('g2')!;
    const io = ingombroPecora(palco().posto('g2')!);
    const arrivo = { x: io.x + 4, y: io.y - 6 };
    tiroIn(t, arrivo);
    const largo = largoIn(arrivo);
    expect(coperto(arrivo, largo, io)).toBe(true);
    const fai = vi.spyOn(pecora, 'fai');
    let finito = false;
    const inizio = t.ctx.orologio.ms;
    void t.ordini.testata('g1', 'g2', 0, 7).then(() => (finito = true));
    await scarica();
    await scorri(t, 200);
    // Il Montone è ancora lontano: niente
    expect(anim.di(pecora.el)).toHaveLength(0);
    expect(fai).not.toHaveBeenCalledWith('orecchie', true);
    await finoA(t, 'botta');
    const botta = poseMontone().find((p) => p.posa === 'botta')!.ms;
    // Si è accorta nella seconda parte del volo (orecchie dritte, un sobbalzo) e all'atterraggio è già di lato
    const [via] = anim.di(pecora.el);
    expect(via!.da - inizio).toBeGreaterThanOrEqual(0.3 * (botta - inizio));
    expect(via!.da + via!.durata).toBeLessThanOrEqual(botta);
    expect(fai).toHaveBeenCalledWith('orecchie', true);
    const primoSalto = via!.f.findIndex((k) => spostamento(String(k.transform)).dy < 0);
    const primoPasso = via!.f.findIndex((k) => spostamento(String(k.transform)).dx !== 0);
    expect(primoSalto).toBeGreaterThanOrEqual(0);
    expect(primoSalto).toBeLessThan(primoPasso);
    // Stordito: resta di lato, alla stessa profondità, fuori dal Montone, dentro lo schermo; guarda il Montone
    await finoA(t, 'stordito', 1000);
    const s = spostamento(anim.applicata(pecora.el));
    expect(s.dy).toBe(0);
    const x = io.x + s.dx;
    expect(coperto(arrivo, largo, { ...io, x })).toBe(false);
    // Quanto basta: appena oltre il raggio (più il margine) dal Montone
    expect(Math.abs(x - arrivo.x)).toBeLessThanOrEqual(io.mezzo + (FIONDA.scansa.raggio + FIONDA.scansa.margine) * largo + 1e-6);
    const g = palco().posto('g2')!;
    expect(g.x + s.dx).toBeGreaterThanOrEqual(0);
    expect(g.x + g.w + s.dx).toBeLessThanOrEqual(W);
    // La cornice non si specchia (si gira solo il disegno, l'ombra resta dalla parte del sole)
    expect(s.sx).toBe(1);
    expect(pecora.verso * pecora.girata).toBe(Math.sign(arrivo.x - x));
    await finoA(t, 'scuote', 300);
    expect(spostamento(anim.applicata(pecora.el)).dx).toBe(s.dx);
    // Il Montone corre via: lei torna al suo posto con calma, nello stesso tempo della corsa
    await finoA(t, 'corre');
    const corre = poseMontone().find((p) => p.posa === 'corre')!.ms;
    const ritorno = anim.di(pecora.el).at(-1)!;
    expect(ritorno.da).toBe(corre);
    expect(ritorno.durata).toBeGreaterThanOrEqual(500);
    await finoAlFinito(t, () => finito);
    expect(anim.applicata(pecora.el)).toBeNull();
    expect(pecora.el.style.transform).toBe('');
    expect(pecora.el.className).toBe('pecora');
    expect(t.eventoInCorso()).toBe(false);
    expect(errori).not.toHaveBeenCalled();
  });

  it.each([
    { nome: 'sulla pecora di g2 (resta, il Montone dietro)', n: 3 as const, arrivo: { x: 44, y: 165.2 }, esito: 0 },
    { nome: 'al centro del recinto di g2', n: 3 as const, arrivo: { x: 137, y: 174 }, esito: 3 },
    { nome: 'a destra del recinto di g2, verso g3', n: 3 as const, arrivo: { x: 200, y: 175 }, esito: 0 },
    { nome: 'davanti, a sinistra del recinto', n: 3 as const, arrivo: { x: 60, y: 230 }, esito: 0 },
    { nome: 'a sinistra del recinto (2 giocatori)', n: 2 as const, arrivo: { x: 100, y: 170 }, esito: 0 },
  ])('correndo via non passa sopra nessuna pecora che gli sta dietro, neanche quella che si è scansata e torna a casa ($nome)', async ({ n, arrivo, esito }) => {
    const t = manuale();
    const anim = animazioniTenute(t);
    t.allinea(fotoIniziale(n), 'calmo');
    tiroIn(t, arrivo, esito);
    let finito = false;
    void t.ordini.testata('g1', 'g2', esito, 7).then(() => (finito = true));
    await finoAlFinito(t, () => finito);
    const delMontone = anim.tutte.filter((a) => a.el.classList.contains('montone'));
    const corsa = delMontone.at(-1)!;
    const da = piedi(corsa.f[0]!), a = piedi(corsa.f.at(-1)!);
    expect(da.y).toBeCloseTo(a.y, 6);
    // Il Montone corre su una striscia larga quanto il suo disegno (dalla coda, 60 dietro i piedi, al muso, 65 davanti; alto
    // 72 sopra i piedi, prima della scala); il suo livello durante la corsa
    const k = palco().profondita(da.y) * 1.1;
    const strada: Rett = { x0: Math.min(da.x, a.x) - 65 * k, x1: Math.max(da.x, a.x) + 65 * k, y0: da.y - 72 * k, y1: da.y };
    const livello = Number((corsa.el as HTMLElement).style.zIndex);
    for (const c of palco().giocatori()) {
      const p = palco().pecora(c)!;
      const g = palco().posto(c)!;
      // Dove è stata: a casa e, se si è scansata, di lato (ci torna mentre lui corre)
      const scansata = anim.di(p.el)[0];
      const dx = scansata ? spostamento(String(scansata.f.at(-1)!.transform)).dx : 0;
      const cx = g.x + g.w / 2;
      const corpo: Rett = { x0: Math.min(cx, cx + dx) - 0.35 * g.w, x1: Math.max(cx, cx + dx) + 0.35 * g.w, y0: g.y + 0.2 * g.w, y1: g.y + 0.78 * g.w };
      const sullaStrada = strada.x0 < corpo.x1 && corpo.x0 < strada.x1 && strada.y0 < corpo.y1 && corpo.y0 < strada.y1;
      if (sullaStrada) expect(livello, `passa sopra ${c}`).toBeLessThan(Number(p.el.style.zIndex));
    }
    expect(errori).not.toHaveBeenCalled();
  });

  it('con la strada libera corre via dal lato più vicino, alla profondità dell\'arrivo', async () => {
    const t = manuale();
    const anim = animazioniTenute(t);
    t.allinea(fotoIniziale(3), 'calmo');
    const arrivo = { x: 60, y: 230 };
    tiroIn(t, arrivo);
    let finito = false;
    void t.ordini.testata('g1', 'g2', 0, 7).then(() => (finito = true));
    await finoAlFinito(t, () => finito);
    const corsa = anim.tutte.filter((a) => a.el.classList.contains('montone')).at(-1)!;
    expect(piedi(corsa.f.at(-1)!).x).toBeLessThan(0);
    expect((corsa.el as HTMLElement).style.zIndex).toBe(String(Math.round(100 + arrivo.y + 8)));
  });

  it('un mancato corto davanti al recinto, sul Gregge: si scansano gli agnellini vicini, non quelli lontani; poi tornano', async () => {
    const t = manuale();
    animazioniTenute(t);
    t.allinea(fotoIniziale(3), 'calmo');
    const ag = gregge();
    expect(ag.length).toBeGreaterThanOrEqual(4);
    fermo(ag[0]!, 122, 238);
    fermo(ag[1]!, 131, 246);
    ag.slice(2).forEach((a, i) => fermo(a, 262 + (i % 3) * 9, 240 + (i % 4) * 5));
    const r = recinto('g2');
    const arrivo = { x: 125, y: r.y1 + 38 };
    tiroIn(t, arrivo);
    const largo = largoIn(arrivo);
    const vicini = ag.slice(0, 2), lontani = ag.slice(2);
    const casa = new Map(ag.map((a) => [a, { x: a.x, y: a.y }]));
    for (const a of vicini) expect(coperto(arrivo, largo, ingombroDi(a))).toBe(true);
    for (const a of lontani) expect(coperto(arrivo, largo, ingombroDi(a))).toBe(false);
    const anima = vi.spyOn(t.ctx, 'anima');
    let finito = false;
    void t.ordini.testata('g1', 'g2', 0, 7).then(() => (finito = true));
    await scarica();
    await scorri(t, 200);
    for (const a of ag) expect(a.regia).toBe(false);
    await finoA(t, 'stordito', 1000);
    const area = palco().area('gregge')!;
    for (const a of vicini) {
      expect(a.regia).toBe(true);
      expect(a.y).toBe(casa.get(a)!.y);
      expect(a.x).not.toBe(casa.get(a)!.x);
      expect(coperto(arrivo, largo, ingombroDi(a))).toBe(false);
      // Dentro il Gregge, fuori dal cartello, e guarda il Montone
      expect(a.x).toBeGreaterThanOrEqual(area.x0);
      expect(a.x).toBeLessThanOrEqual(area.x1);
      expect(dentro(area, a.x, a.y)).toBeUndefined();
      expect(a.verso).toBe(Math.sign(arrivo.x - a.x));
    }
    for (const a of lontani) {
      expect(a.regia).toBe(false);
      expect({ x: a.x, y: a.y }).toEqual(casa.get(a));
    }
    // Nessuna pecora si sposta (il punto è lontano da tutte)
    expect(anima.mock.calls.some(([e]) => (e as HTMLElement).classList.contains('pecora'))).toBe(false);
    await finoAlFinito(t, () => finito);
    for (const a of ag) {
      expect({ x: a.x, y: a.y }).toEqual(casa.get(a));
      expect(a.regia).toBe(false);
      expect(a.stato).not.toBe('regia');
      expect(a.hop).toBe(0);
    }
    expect(t.eventoInCorso()).toBe(false);
    expect(errori).not.toHaveBeenCalled();
  });

  it('un agnellino stretto tra il bordo del Gregge e il cartello salta oltre il cartello', async () => {
    const t = manuale();
    animazioniTenute(t);
    t.allinea(fotoIniziale(3), 'calmo');
    const ag = gregge();
    fermo(ag[0]!, 118, 217);
    ag.slice(1).forEach((a, i) => fermo(a, 262 + (i % 3) * 9, 240 + (i % 4) * 5));
    const arrivo = { x: 130, y: 232 };
    tiroIn(t, arrivo);
    const largo = largoIn(arrivo);
    const area = palco().area('gregge')!;
    const cartello = area.evita![0]!;
    // Dalla sua parte non c'è posto (il bordo del Gregge), dall'altra cadrebbe sul cartello
    expect(coperto(arrivo, largo, ingombroDi(ag[0]!))).toBe(true);
    void t.ordini.testata('g1', 'g2', 0, 7);
    await scarica();
    await finoA(t, 'stordito', 1000);
    const a = ag[0]!;
    expect(a.regia).toBe(true);
    expect(coperto(arrivo, largo, ingombroDi(a))).toBe(false);
    expect(dentro(area, a.x, a.y)).toBeUndefined();
    expect(a.x).toBeGreaterThan(cartello[2]);
    expect(a.x).toBeLessThanOrEqual(area.x1);
  });

  it('passando dietro il cartello l\'agnellino va dritto: niente spinte del cartello, all\'andata e al ritorno', async () => {
    const t = manuale();
    animazioniTenute(t);
    t.allinea(fotoIniziale(3), 'calmo');
    const ag = gregge();
    fermo(ag[0]!, 118, 217);
    ag.slice(1).forEach((a, i) => fermo(a, 262 + (i % 3) * 9, 240 + (i % 4) * 5));
    tiroIn(t, { x: 130, y: 232 });
    const a = ag[0]!;
    const campioni: Array<{ x: number; y: number }> = [];
    const passi = async (n: number): Promise<void> => {
      for (let i = 0; i < n; i++) {
        t.avanza(33);
        await scarica();
        campioni.push({ x: a.x, y: a.y });
      }
    };
    void t.ordini.testata('g1', 'g2', 0, 7);
    await scarica();
    // Andata: dal sobbalzo alla fine della scivolata (passa dietro il cartello)
    await passi(30);
    expect(campioni.some((c) => dentro(palco().area('gregge')!, c.x, c.y))).toBe(true);
    for (const c of campioni) expect(c.y).toBe(217);
    for (let i = 1; i < campioni.length; i++) expect(campioni[i]!.x).toBeGreaterThanOrEqual(campioni[i - 1]!.x);
    // Ritorno, mentre il Montone corre via
    await finoA(t, 'corre');
    campioni.length = 0;
    await passi(25);
    expect(campioni.some((c) => dentro(palco().area('gregge')!, c.x, c.y))).toBe(true);
    for (const c of campioni) expect(c.y).toBe(217);
    for (let i = 1; i < campioni.length; i++) expect(campioni[i]!.x).toBeLessThanOrEqual(campioni[i - 1]!.x);
    expect(a.x).toBe(118);
  });

  it('colpito sulla staccionata davanti, con la fascia dentro il Gregge (1): chi vola nel Gregge non atterra sotto il Montone', async () => {
    const t = manuale();
    animazioniTenute(t);
    t.allinea(fotoIniziale(3), 'calmo');
    gregge().forEach((a, i) => fermo(a, 262 + (i % 3) * 9, 240 + (i % 4) * 5));
    const r = recinto('g2');
    const arrivo = { x: 137, y: r.y1 + 18 };
    tiroIn(t, arrivo, 1);
    const largo = largoIn(arrivo);
    const area = palco().area('gregge')!;
    // Il Montone copre la parte alta del Gregge
    expect(coperto(arrivo, largo, ingombroDi({ x: arrivo.x + 3, y: area.y0 + 4 }))).toBe(true);
    const branco = palco().branco()!;
    const sposta = branco.sposta.bind(branco);
    const volati: Agnello[] = [];
    vi.spyOn(branco, 'sposta').mockImplementation((n, da, verso, modo) => {
      const prima = new Set(area.agnelli);
      const quanti = sposta(n, da, verso, modo);
      // Come se il posto libero scelto per l'arrivo fosse proprio sotto il Montone
      for (const g of area.agnelli) {
        if (prima.has(g)) continue;
        g.tx = arrivo.x + 3;
        g.ty = area.y0 + 4;
        volati.push(g);
      }
      return quanti;
    });
    void t.ordini.testata('g1', 'g2', 1, 7);
    await scarica();
    await finoA(t, 'stordito', 900);
    expect(volati).toHaveLength(1);
    for (const g of volati) {
      expect(g.giunto).toBe(true);
      expect(coperto(arrivo, largo, ingombroDi(g))).toBe(false);
      expect(g.x).toBeGreaterThanOrEqual(area.x0);
      expect(g.x).toBeLessThanOrEqual(area.x1);
      expect(dentro(area, g.x, g.y)).toBeUndefined();
    }
  });

  it('gli agnellini che si scansano dalla stessa parte non si mettono in fila: si allargano a ventaglio, fuori dal Montone e nel Gregge', async () => {
    const t = manuale();
    animazioniTenute(t);
    t.allinea(fotoIniziale(3), 'calmo');
    const ag = gregge();
    expect(ag.length).toBeGreaterThanOrEqual(6);
    const fila = ag.slice(0, 4);
    fila.forEach((a, i) => fermo(a, 126 + i, 240));
    ag.slice(4).forEach((a, i) => fermo(a, 270 + (i % 2) * 9, 250));
    const r = recinto('g2');
    const arrivo = { x: 125, y: r.y1 + 38 };
    tiroIn(t, arrivo);
    const largo = largoIn(arrivo);
    for (const a of fila) expect(coperto(arrivo, largo, ingombroDi(a))).toBe(true);
    void t.ordini.testata('g1', 'g2', 0, 7);
    await scarica();
    await finoA(t, 'stordito', 1000);
    const area = palco().area('gregge')!;
    const xs = fila.map((a) => a.x).sort((p, q) => p - q);
    for (const a of fila) {
      expect(a.regia).toBe(true);
      expect(a.x).toBeGreaterThan(arrivo.x);
      expect(coperto(arrivo, largo, ingombroDi(a))).toBe(false);
      expect(a.x).toBeLessThanOrEqual(area.x1);
      expect(dentro(area, a.x, a.y)).toBeUndefined();
    }
    // Tra uno e l'altro almeno un terzo di agnellino (prima stavano tutti nello stesso punto)
    for (let i = 1; i < xs.length; i++) expect(xs[i]! - xs[i - 1]!, xs.join(', ')).toBeGreaterThanOrEqual(0.06 * largo);
  });

  it.each([
    { nome: 'Bea al bordo sinistro, il Montone a destra dei suoi piedi (3 giocatori)', n: 3 as const, c: 'g2' as IdGiocatore, arrivo: { x: 44, y: 165.2 } },
    { nome: 'Bea al bordo sinistro, il Montone a sinistra dei suoi piedi (3 giocatori)', n: 3 as const, c: 'g2' as IdGiocatore, arrivo: { x: 30, y: 165.2 } },
    { nome: 'Cleo al bordo destro (3 giocatori)', n: 3 as const, c: 'g3' as IdGiocatore, arrivo: { x: 356, y: 165.2 } },
    { nome: 'l\'avversario a sinistra (2 giocatori)', n: 2 as const, c: 'g2' as IdGiocatore, arrivo: { x: 74, y: 166 } },
  ])('chi si scansa non entra mai in un recinto: $nome', async ({ n, c, arrivo }) => {
    const t = manuale();
    const anim = animazioniTenute(t);
    t.allinea(fotoIniziale(n), 'calmo');
    const g = palco().posto(c)!;
    const pecora = palco().pecora(c)!;
    const io = ingombroPecora(g);
    tiroSu(t, c, arrivo);
    const largo = largoIn(arrivo);
    expect(coperto(arrivo, largo, io)).toBe(true);
    // Prima del tiro: l'ombra dalla parte del sole
    await scorri(t, 100);
    const ombraPrima = latoOmbra(pecora, 1);
    const fai = vi.spyOn(pecora, 'fai');
    let finito = false;
    void t.ordini.testata('g1', c, 0, 7).then(() => (finito = true));
    await scarica();
    await finoA(t, 'stordito', 1000);
    for (const d of palco().giocatori()) {
      const s = spostamento(anim.applicata(palco().pecora(d)!.el));
      const corpo = corpoDi(palco().posto(d)!, s.dx);
      for (const r of recinti()) expect(tocca(corpo, r), `${d} in un recinto`).toBe(false);
    }
    // Se ne accorge comunque e guarda il Montone; se resta sotto di lui, lui è disegnato dietro di lei
    expect(fai).toHaveBeenCalledWith('orecchie', true);
    const s = spostamento(anim.applicata(pecora.el));
    const x = io.x + s.dx;
    expect(Math.sign(s.sx) * pecora.verso * pecora.girata).toBe(Math.sign(arrivo.x - x));
    if (coperto(arrivo, largo, { ...io, x })) expect(livelloMontone()).toBeLessThan(Number(pecora.el.style.zIndex));
    // L'ombra resta dalla parte del sole anche girata
    expect(latoOmbra(pecora, s.sx)).toBe(ombraPrima);
    await finoAlFinito(t, () => finito);
    expect(anim.applicata(pecora.el)).toBeNull();
    expect(pecora.girata).toBe(1);
    await scorri(t, 100);
    expect(latoOmbra(pecora, 1)).toBe(ombraPrima);
    expect(errori).not.toHaveBeenCalled();
  });

  it('la pecora girata verso il Montone: l\'ombra al sole non si specchia, nemmeno con il posto libero di lato', async () => {
    const t = manuale();
    const anim = animazioniTenute(t);
    t.allinea(fotoIniziale(3), 'calmo');
    senzaRecintoAccanto('g2');
    const pecora = palco().pecora('g2')!;
    const io = ingombroPecora(palco().posto('g2')!);
    // Si scansa a destra del Montone e si gira a guardarlo (verso sinistra)
    const arrivo = { x: io.x + 4, y: io.y - 6 };
    tiroIn(t, arrivo);
    await scorri(t, 100);
    const prima = latoOmbra(pecora, 1);
    void t.ordini.testata('g1', 'g2', 0, 7);
    await scarica();
    await finoA(t, 'stordito', 1000);
    const s = spostamento(anim.applicata(pecora.el));
    expect(s.dx).toBeGreaterThan(0);
    expect(pecora.verso * pecora.girata * Math.sign(s.sx)).toBe(-1);
    expect(latoOmbra(pecora, s.sx)).toBe(prima);
  });

  it('mentre il Montone sta nel Gregge gli agnellini liberi non scelgono posti sotto di lui; poi sì, e la zona va via', async () => {
    const t = manuale();
    animazioniTenute(t);
    t.allinea(fotoIniziale(3), 'calmo');
    const ag = gregge();
    ag.forEach((a, i) => fermo(a, 262 + (i % 3) * 9, 240 + (i % 4) * 5));
    const r = recinto('g2');
    const arrivo = { x: 150, y: r.y1 + 44 };
    tiroIn(t, arrivo);
    const largo = largoIn(arrivo);
    // Uno sta andando proprio sotto il punto d'arrivo
    const viandante = ag[0]!;
    viandante.stato = 'cammina';
    viandante.tx = arrivo.x + 2;
    viandante.ty = arrivo.y;
    expect(coperto(arrivo, largo, ingombroDi({ x: viandante.tx, y: viandante.ty }))).toBe(true);
    let finito = false;
    void t.ordini.testata('g1', 'g2', 0, 7).then(() => (finito = true));
    await scarica();
    await finoA(t, 'stordito', 600);
    const area = palco().area('gregge')!;
    expect(area.coperta).toBeDefined();
    expect(coperto(arrivo, largo, ingombroDi({ x: viandante.tx, y: viandante.ty }))).toBe(false);
    const caso = casoConSeme(9);
    for (let i = 0; i < 200; i++) {
      const p = puntoLibero(area, null, caso);
      expect(coperto(arrivo, largo, ingombroDi(p)), `${p.x},${p.y}`).toBe(false);
      const q = vicinoLibero({ x: arrivo.x + 30, y: arrivo.y, a: area }, caso);
      expect(coperto(arrivo, largo, ingombroDi(q)), `${q.x},${q.y}`).toBe(false);
    }
    await finoAlFinito(t, () => finito);
    expect(area.coperta).toBeUndefined();
    expect(errori).not.toHaveBeenCalled();
  });

  it('nessuno si sposta se il punto d\'arrivo è lontano da pecore e Gregge', async () => {
    const t = manuale();
    animazioniTenute(t);
    t.allinea(fotoIniziale(3), 'calmo');
    for (const a of gregge()) fermo(a, a.x, a.y);
    tiroIn(t, { x: 240, y: 110 });
    const anima = vi.spyOn(t.ctx, 'anima');
    const fai = palco().giocatori().map((c) => vi.spyOn(palco().pecora(c)!, 'fai'));
    let finito = false;
    void t.ordini.testata('g1', 'g2', 0, 7).then(() => (finito = true));
    await scarica();
    await finoA(t, 'stordito', 1000);
    expect(gregge().some((a) => a.regia)).toBe(false);
    await finoAlFinito(t, () => finito);
    expect(anima.mock.calls.some(([e]) => (e as HTMLElement).classList.contains('pecora'))).toBe(false);
    for (const f of fai) expect(f).not.toHaveBeenCalledWith('orecchie', true);
  });

  it('colpito sulla staccionata, accanto alla pecora del bersaglio (1), con il posto libero di lato: la paura resta, e lei si scansa', async () => {
    const t = manuale();
    const anim = animazioniTenute(t);
    t.allinea(fotoIniziale(3), 'calmo');
    senzaRecintoAccanto('g2');
    const pecora = palco().pecora('g2')!;
    const io = ingombroPecora(palco().posto('g2')!);
    const arrivo = { x: 85, y: 170 };
    tiroIn(t, arrivo, 1);
    const largo = largoIn(arrivo);
    expect(coperto(arrivo, largo, io)).toBe(true);
    const reagisci = vi.spyOn(palco(), 'reagisci');
    let finito = false;
    void t.ordini.testata('g1', 'g2', 1, 7).then(() => (finito = true));
    await scarica();
    await finoA(t, 'stordito', 1000);
    expect(reagisci).toHaveBeenCalledWith('g2', 'paura');
    const s = spostamento(anim.applicata(pecora.el));
    expect(coperto(arrivo, largo, { ...io, x: io.x + s.dx })).toBe(false);
    await finoAlFinito(t, () => finito);
    expect(anim.applicata(pecora.el)).toBeNull();
  });

  it('colpo e mancato durano uguale anche quando qualcuno si scansa (durate.json)', async () => {
    const t = manuale();
    animazioniTenute(t);
    t.allinea(fotoIniziale(3), 'calmo');
    pecoraEAgnellini(t);
    const scansato = await finoAllaFine(t, t.ordini.testata('g1', 'g2', 0, 7));
    const colpo = await finoAllaFine(t, t.ordini.testata('g1', 'g2', 2, 4));
    expect(scansato).toBe(colpo);
    expect(scansato).toBeLessThanOrEqual(DURATE_NORMALI.testata);
    expect(scansato).toBeGreaterThan(DURATE_NORMALI.testata - 100);
  });

  it.each([
    { nome: 'interrompi', come: 'interrompi' },
    { nome: 'ritorno da un\'altra scheda (allinea subito)', come: 'subito' },
    { nome: 'ricostruzione (un altro giocatore in basso)', come: 'ricostruzione' },
  ] as const)('$nome a metà stordimento: tutti subito al loro posto, niente trasformazioni, classi o timer rimasti', async ({ come }) => {
    const t = manuale();
    const anim = animazioniTenute(t);
    const f = fotoIniziale(3);
    t.allinea(f, 'calmo');
    const { arrivo, vicini, lontani } = pecoraEAgnellini(t);
    const pecora = palco().pecora('g2')!;
    const casa = new Map([...vicini, ...lontani].map((a) => [a, { x: a.x, y: a.y }]));
    let finito = false;
    void t.ordini.testata('g1', 'g2', 0, 7).then(() => (finito = true));
    await scarica();
    await finoA(t, 'stordito', 800);
    // Accanto al suo recinto resta dov'è, ma si è accorta del Montone (un sobbalzo) e lo guarda
    expect(anim.di(pecora.el).length).toBeGreaterThan(0);
    expect(pecora.verso * pecora.girata).toBe(Math.sign(arrivo.x - ingombroPecora(palco().posto('g2')!).x));
    expect(vicini.every((a) => a.regia)).toBe(true);
    if (come === 'interrompi') (t.ordini as OrdiniDelTeatro).interrompi();
    else if (come === 'subito') t.allinea(f, 'subito');
    else t.allinea({ ...f, posti: [...f.posti.slice(1), f.posti[0]!] }, 'calmo');
    // Subito, prima di un altro fotogramma
    expect(anim.applicata(pecora.el)).toBeNull();
    for (const a of [...vicini, ...lontani]) {
      if (!a.vivo) continue;
      expect({ x: a.x, y: a.y }).toEqual(casa.get(a));
      expect(a.regia).toBe(false);
    }
    await scorri(t, 100);
    expect(finito).toBe(true);
    expect(t.eventoInCorso()).toBe(false);
    const pecore = [...radice.querySelectorAll<HTMLElement>('.pecora')];
    expect(pecore).toHaveLength(3);
    for (const p of pecore) {
      expect(anim.applicata(p)).toBeNull();
      expect(p.style.transform).toBe('');
      expect(p.className).toBe('pecora');
    }
    // Di nuovo nel suo verso, e il Gregge senza più la zona coperta
    expect(pecora.girata).toBe(1);
    expect(palco().area('gregge')!.coperta).toBeUndefined();
    expect([...palco().agnelli()].some((a) => a.regia)).toBe(false);
    // Più tardi non arriva niente: né il ritorno né altri saltelli
    const n = anim.tutte.length;
    await scorri(t, 4000);
    expect(anim.tutte.slice(n).some((a) => (a.el as HTMLElement).classList.contains('pecora'))).toBe(false);
    expect([...palco().agnelli()].some((a) => a.regia)).toBe(false);
    expect(errori).not.toHaveBeenCalled();
  });

  it('movimento ridotto: cambiano posto senza animazione mentre il Montone sta fermo, poi tornano', async () => {
    const t = manuale();
    const anim = animazioniTenute(t);
    t.allinea(fotoIniziale(3), 'calmo');
    t.ctx.ridotto = true;
    senzaRecintoAccanto('g2');
    const { arrivo, vicini } = pecoraEAgnellini(t);
    const casa = new Map(vicini.map((a) => [a, { x: a.x, y: a.y }]));
    const pecora = palco().pecora('g2')!;
    const io = ingombroPecora(palco().posto('g2')!);
    const largo = largoIn(arrivo);
    let finito = false;
    const inizio = t.ctx.orologio.ms;
    let fineMs = 0;
    void t.ordini.testata('g1', 'g2', 0, 7).then(() => {
      finito = true;
      fineMs = t.ctx.orologio.ms;
    });
    await scarica();
    await scorri(t, 400);
    expect(finito).toBe(false);
    // Già di lato, senza passaggi in mezzo
    const s = spostamento(anim.applicata(pecora.el));
    expect(coperto(arrivo, largo, { ...io, x: io.x + s.dx })).toBe(false);
    expect(anim.di(pecora.el).length).toBeGreaterThan(0);
    for (const a of anim.di(pecora.el)) expect(a.durata).toBeLessThanOrEqual(1);
    for (const a of vicini) {
      expect(a.regia).toBe(true);
      expect(coperto(arrivo, largo, ingombroDi(a))).toBe(false);
      expect(a.hop).toBe(0);
    }
    await finoAlFinito(t, () => finito);
    for (const a of anim.di(pecora.el)) expect(a.durata).toBeLessThanOrEqual(1);
    expect(anim.applicata(pecora.el)).toBeNull();
    for (const a of vicini) {
      expect({ x: a.x, y: a.y }).toEqual(casa.get(a));
      expect(a.regia).toBe(false);
    }
    // Dura come senza nessuno da scansare (il Montone fermo 800 ms; qui ogni animazione da 1 ms costa un passo di 100 ms)
    tiroIn(t, { x: 240, y: 110 });
    const solo = await finoAllaFine(t, t.ordini.testata('g1', 'g2', 0, 7));
    expect(fineMs - inizio).toBe(solo);
  });

  it('modo leggero: chi si scansa scivola di lato e torna con i tempi di sempre, ma senza saltelli', async () => {
    const t = manuale();
    const anim = animazioniTenute(t);
    t.allinea(fotoIniziale(3), 'calmo');
    t.ctx.risparmio.leggero = true;
    senzaRecintoAccanto('g2');
    const { arrivo, vicini } = pecoraEAgnellini(t);
    const pecora = palco().pecora('g2')!;
    let finito = false;
    void t.ordini.testata('g1', 'g2', 0, 7).then(() => (finito = true));
    await scarica();
    const salti: number[] = [];
    for (let i = 0; i < 80 && !finito; i++) {
      await scorri(t, 100);
      for (const a of vicini) if (a.regia) salti.push(a.hop);
    }
    expect(finito).toBe(true);
    const animazioni = anim.di(pecora.el);
    expect(animazioni.length).toBeGreaterThanOrEqual(2);
    // Scivola e torna con una durata vera (non 1 ms come con il movimento ridotto), sempre a terra
    for (const a of animazioni) {
      expect(a.durata).toBeGreaterThan(1);
      for (const k of a.f) expect(spostamento(String(k.transform)).dy).toBe(0);
    }
    expect(coperto(arrivo, largoIn(arrivo), ingombroDi(vicini[0]!))).toBe(true);
    expect(salti.length).toBeGreaterThan(0);
    expect(salti.every((h) => h === 0)).toBe(true);
  });
});

describe('testata: il colpo lungo vola oltre e sparisce (dietro la collina, o nel cielo tirando al massimo), poi torna di corsa', () => {
  /** La distanza di `p` dalla retta per `a` e `b`. */
  const dallaRetta = (p: Punto, a: Punto, b: Punto): number =>
    Math.abs((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) / Math.hypot(b.x - a.x, b.y - a.y);
  /** La scala (verticale, senza il verso) di un fotogramma. */
  const scala = (f: Keyframe): number => Number(/scale\(([-\d.e]+),\s*([-\d.e]+)\)/.exec(String(f.transform))![2]);
  const P: Punto = { x: 198, y: 600 };
  /** Un tiro di chi sta in basso ben oltre il recinto di g2 (3 giocatori), lungo la linea verso il suo centro spostato di `dx`. */
  function tiroLungo(t: Teatro, o: { pieno: boolean; dx?: number; oltre?: number }): Punto {
    const r = recinto('g2');
    const c = { x: (r.x0 + r.x1) / 2 + (o.dx ?? 0), y: (r.y0 + r.y1) / 2 };
    const k = o.oltre ?? 1.6;
    const vero = { x: P.x + (c.x - P.x) * k, y: P.y + (c.y - P.y) * k };
    expect(colpoLungo(P, vero, r), 'il tiro della prova è lungo').toBe(true);
    t.ctx.regia.tiroLocale = { chi: 'g1', bersaglio: 'g2', esito: 0, arrivo: vero, recinto: { ...r }, partenza: P, pieno: o.pieno };
    return vero;
  }
  interface Vista { e: HTMLElement; f: Keyframe[]; o: KeyframeAnimationOptions; ms: number; dietroLaCollina: boolean }
  /** Tutte le animazioni della Testata, con l'elemento, i fotogrammi, le opzioni, il tempo della scena e se sta dietro la collina. */
  function registraAnimazioni(t: Teatro): Vista[] {
    const originale = t.ctx.anima.bind(t.ctx);
    const viste: Vista[] = [];
    vi.spyOn(t.ctx, 'anima').mockImplementation((e, f, o) => {
      const collina = t.ctx.el.mondo.querySelector('.paesaggio')!;
      const dietroLaCollina = !!(e.compareDocumentPosition(collina) & Node.DOCUMENT_POSITION_FOLLOWING);
      viste.push({ e: e as HTMLElement, f, o, ms: t.ctx.orologio.ms, dietroLaCollina });
      return originale(e, f, o);
    });
    return viste;
  }
  const del = (viste: Vista[], classe: string): Vista[] => viste.filter((v) => v.e.classList.contains(classe));

  /** Il ritorno di corsa: entra da un lato fuori dallo schermo, si ferma davanti al recinto, esce dall'altro lato. */
  function controllaRitorno(viste: Vista[], r: Rett, nota: string): void {
    const corse = del(viste, 'montone').filter((v) => !v.e.classList.contains('montone-dietro')).slice(-2);
    expect(corse, nota).toHaveLength(2);
    const [entra, esce] = corse as [Vista, Vista];
    const da = piedi(entra.f[0]!), fermo = piedi(entra.f.at(-1)!), fuori = piedi(esce.f.at(-1)!);
    expect(da.x < -50 || da.x > W + 50, `${nota}: entra da fuori`).toBe(true);
    expect(fermo.y, `${nota}: davanti al recinto`).toBeCloseTo(yRitorno(r), 3);
    expect(zonaDi(fermo, r), nota).toBe(0);
    vicino(piedi(esce.f[0]!), fermo);
    expect(fuori.x < -50 || fuori.x > W + 50, `${nota}: esce`).toBe(true);
    expect(Math.sign(fuori.x - fermo.x), `${nota}: dall'altra parte`).toBe(Math.sign(fermo.x - da.x));
    // Guarda dove corre
    for (const v of [entra, esce]) for (const k of v.f) expect(verso(k), nota).toBe(Math.sign(fermo.x - da.x));
  }

  it('dietro la collina: segue la linea del tiro (mai di lato), passa dietro collina e recinti, cade e sparisce; niente testata', async () => {
    const t = manuale();
    animazioniSulOrologio(t);
    t.allinea(fotoIniziale(3), 'calmo');
    const r = recinto('g2');
    const vero = tiroLungo(t, { pieno: false });
    const viste = registraAnimazioni(t);
    const reagisci = vi.spyOn(presa.palco as Palco, 'reagisci');
    const suona = vi.spyOn(t.ctx, 'suona');
    const prima = t.stato().agnellini;
    await finoAllaFine(t, t.ordini.testata('g1', 'g2', 0, 7));
    const volo = del(viste, 'montone')[0]!;
    // Il volo: dalla partenza lungo la linea verso il punto mirato, fino a dove esce dalla fascia del recinto (più in là
    // sarebbe in cima allo schermo); l'arco alza il Montone, ma in pianta resta sulla linea
    const E = fineDietroLaCollina(P, vero, r);
    expect(Math.abs((vero.x - P.x) * (E.y - P.y) - (vero.y - P.y) * (E.x - P.x))).toBeLessThan(1e-6);
    expect(zonaDi(E, r)).toBe(0);
    expect(E.y).toBeLessThan(r.y0);
    const n = volo.f.length - 1;
    volo.f.forEach((k, i) => expect(piedi(k).x, `passo ${i}`).toBeCloseTo(P.x + ((E.x - P.x) * i) / n, 3));
    vicino(piedi(volo.f[0]!), P);
    vicino(piedi(volo.f[n]!), E);
    // Una copia dietro la collina (prima del paesaggio) prende il suo posto in dissolvenza, oltre il recinto, e cade giù
    const dietro = del(viste, 'montone-dietro');
    expect(dietro.length).toBeGreaterThanOrEqual(2);
    expect(dietro.every((v) => v.dietroLaCollina)).toBe(true);
    expect(volo.dietroLaCollina).toBe(false);
    expect(Number(volo.f.at(-1)!.opacity)).toBe(0);
    expect(Number(dietro[0]!.f[0]!.opacity)).toBe(0);
    const caduta = dietro.at(-1)!.f;
    expect(piedi(caduta.at(-1)!).y).toBeGreaterThan(E.y + 100);
    expect(Number(caduta.at(-1)!.opacity)).toBe(0);
    // Niente testata: né polvere, né paura, né agnellini che si spostano, né botta o stordito
    expect(del(viste, 'sbuffo-testata')).toHaveLength(0);
    expect(reagisci).not.toHaveBeenCalled();
    expect(suona).not.toHaveBeenCalledWith('tonfo', 0.5);
    expect(t.stato().agnellini).toEqual(prima);
    expect(poseMontone().map((x) => x.posa)).toEqual(['volo', 'corre', 'scuote', 'corre']);
    controllaRitorno(viste, r, 'dietro la collina');
    expect(radice.querySelectorAll('.montone, .ombra-montone, .luccichio-testata')).toHaveLength(0);
    expect(errori).not.toHaveBeenCalled();
  });

  it('tirato al massimo: vola nel cielo lungo la linea, rimpicciolisce fino a un puntino e sparisce con un luccichio', async () => {
    const t = manuale();
    animazioniSulOrologio(t);
    t.allinea(fotoIniziale(3), 'calmo');
    const r = recinto('g2');
    const vero = tiroLungo(t, { pieno: true, dx: 20 });
    const viste = registraAnimazioni(t);
    const suona = vi.spyOn(t.ctx, 'suona');
    await finoAllaFine(t, t.ordini.testata('g1', 'g2', 0, 7));
    const volo = del(viste, 'montone')[0]!;
    const F = puntoInCielo(P, vero);
    expect(F.y).toBeCloseTo(FIONDA.cielo.y, 3);
    // Sempre sulla linea del tiro (niente arco), dalla partenza al punto nel cielo, sempre più su e più piccolo
    for (const k of volo.f) expect(dallaRetta(piedi(k), P, vero)).toBeLessThan(0.01);
    vicino(piedi(volo.f[0]!), P);
    vicino(piedi(volo.f.at(-1)!), F);
    for (let i = 1; i < volo.f.length; i++) {
      expect(piedi(volo.f[i]!).y).toBeLessThanOrEqual(piedi(volo.f[i - 1]!).y + 1e-9);
      expect(scala(volo.f[i]!)).toBeLessThanOrEqual(scala(volo.f[i - 1]!) * 1.0001);
    }
    expect(scala(volo.f.at(-1)!)).toBeLessThanOrEqual(scala(volo.f[0]!) * FIONDA.cielo.puntino * 1.01);
    expect(del(viste, 'montone-dietro')).toHaveLength(0);
    // Il luccichio dove sparisce, quando il volo finisce: compare e se ne va
    const luccichio = del(viste, 'luccichio-testata');
    expect(luccichio).toHaveLength(1);
    expect(luccichio[0]!.ms - volo.ms).toBe(volo.o.duration);
    expect(luccichio[0]!.e.dataset.x).toBe(String(F.x));
    expect(luccichio[0]!.e.dataset.y).toBe(String(F.y));
    expect(suona).toHaveBeenCalledWith('ting');
    expect(poseMontone().map((x) => x.posa)).toEqual(['volo', 'corre', 'scuote', 'corre']);
    controllaRitorno(viste, r, 'nel cielo');
    expect(radice.querySelectorAll('.montone, .ombra-montone, .luccichio-testata')).toHaveLength(0);
    expect(errori).not.toHaveBeenCalled();
  });

  it('la corsa di rientro non passa sopra gli agnellini del Gregge: passa dietro chi tocca la sua strada; il Gregge resta libero', async () => {
    const t = manuale();
    animazioniSulOrologio(t);
    t.allinea(fotoIniziale(3), 'calmo');
    const palco = presa.palco as Palco;
    const r = recinto('g2');
    tiroLungo(t, { pieno: false });
    const a = palco.area('gregge')!;
    const Sy = yRitorno(r);
    // Un agnellino del Gregge con i piedi appena dietro la strada della corsa (il Montone gli starebbe davanti, sopra di lui),
    // un altro lontano dalla strada
    const [sullaStrada, lontano] = a.agnelli as [Agnello, Agnello];
    const fermo = (g: Agnello, x: number, y: number): void => {
      g.x = g.tx = x;
      g.y = g.ty = y;
      g.stato = 'bruca';
      g.t = 1e6;
    };
    const yStrada = Math.max(a.y0 + 2, Math.min(a.y1 - 2, Sy - 4));
    expect(yStrada, 'il Gregge tocca la strada della corsa').toBeGreaterThan(Sy - 20);
    fermo(sullaStrada, (a.x0 + a.x1) / 2, yStrada);
    fermo(lontano, a.x0 + 4, a.y0 + 2);
    let finito = false;
    void t.ordini.testata('g1', 'g2', 0, 7).then(() => (finito = true));
    let visto = false;
    for (let i = 0; i < 80 && !finito; i++) {
      await scorri(t, 50);
      const corre = [...radice.querySelectorAll<HTMLElement>('.montone')].find((m) => !m.classList.contains('montone-dietro') && m.style.zIndex !== '' && Number(m.style.zIndex) < 600);
      if (!corre) continue;
      visto = true;
      // Disegnato sotto l'agnellino sulla strada
      expect(Number(corre.style.zIndex)).toBeLessThan(100 + Math.round(sullaStrada.y));
      // Mentre corre, gli agnellini liberi non scelgono posti sulla sua strada
      expect(a.coperta?.(a.x0 + 10, yStrada)).toBe(true);
      expect(a.coperta?.(a.x0 + 4, a.y0 - 40)).toBeFalsy();
    }
    expect(visto, 'la corsa di rientro si è vista').toBe(true);
    for (let i = 0; i < 80 && !finito; i++) await scorri(t, 100);
    expect(finito).toBe(true);
    expect(a.coperta).toBeUndefined();
    // Interrotta mentre corre (ricostruzione del tavolo): il Gregge torna subito libero
    tiroLungo(t, { pieno: true });
    void t.ordini.testata('g1', 'g2', 0, 7);
    for (let i = 0; i < 80 && !a.coperta; i++) await scorri(t, 50);
    expect(a.coperta).toBeDefined();
    (t.ordini as OrdiniDelTeatro).interrompi();
    expect(a.coperta).toBeUndefined();
    expect(errori).not.toHaveBeenCalled();
  });

  it('colpito, corto a vuoto, lungo dietro la collina e lungo nel cielo durano uguale, quanto dice durate.json', async () => {
    const t = manuale();
    animazioniSulOrologio(t);
    t.allinea(fotoIniziale(3), 'calmo');
    const colpo = await finoAllaFine(t, t.ordini.testata('g1', 'g2', 2, 4));
    const corto = await finoAllaFine(t, t.ordini.testata('g1', 'g2', 0, 5));
    tiroLungo(t, { pieno: false });
    const collina = await finoAllaFine(t, t.ordini.testata('g1', 'g2', 0, 7));
    tiroLungo(t, { pieno: true });
    const cielo = await finoAllaFine(t, t.ordini.testata('g1', 'g2', 0, 7));
    expect([corto, collina, cielo]).toEqual([colpo, colpo, colpo]);
    expect(colpo).toBeLessThanOrEqual(DURATE_NORMALI.testata);
    expect(colpo).toBeGreaterThan(DURATE_NORMALI.testata - 100);
  });

  it('sugli altri telefoni: il mancato di scena lungo sparisce, nel cielo o dietro la collina secondo seq (uguale ogni volta); il corto atterra', async () => {
    const t = manuale();
    t.allinea(fotoIniziale(3), 'calmo');
    const r = recinto('g2');
    const pari = Array.from({ length: 30 }, (_, i) => 2 * i + 2);
    const lunghi = pari.filter((seq) => colpoLungo(partenzaScena('g1', seq), puntoDiScena(r, 0, seq), r));
    const cielo = lunghi.find((s) => cieloDaSeq(s));
    const collina = lunghi.find((s) => !cieloDaSeq(s));
    expect(cielo).toBeDefined();
    expect(collina).toBeDefined();
    const prova = async (seq: number) => {
      const viste = registraAnimazioni(t);
      pose.elenco = [];
      await finoAllaFine(t, t.ordini.testata('g1', 'g2', 0, seq));
      vi.mocked(t.ctx.anima).mockRestore();
      return {
        volo: del(viste, 'montone')[0]!.f.map((k) => String(k.transform)),
        cielo: del(viste, 'luccichio-testata').length,
        dietro: del(viste, 'montone-dietro').length,
        pose: poseMontone().map((x) => x.posa),
      };
    };
    const c1 = await prova(cielo!);
    expect(c1.cielo).toBe(1);
    expect(c1.dietro).toBe(0);
    expect(await prova(cielo!)).toEqual(c1);
    const h1 = await prova(collina!);
    expect(h1.cielo).toBe(0);
    expect(h1.dietro).toBeGreaterThan(0);
    expect(await prova(collina!)).toEqual(h1);
    // Il volo di scena va dalla partenza di scena verso il punto di scena, lungo la linea
    const da = partenzaScena('g1', collina!), E = fineDietroLaCollina(da, puntoDiScena(r, 0, collina!), r);
    const n = h1.volo.length - 1;
    h1.volo.forEach((tr, i) => expect(piedi({ transform: tr }).x).toBeCloseTo(da.x + ((E.x - da.x) * i) / n, 3));
    // Il mancato corto atterra come prima
    const corto = [1, 3, 5, 7, 9].find((seq) => !colpoLungo(partenzaScena('g1', seq), puntoDiScena(r, 0, seq), r))!;
    expect((await prova(corto)).pose).toEqual(['volo', 'botta', 'stordito', 'scuote', 'corre']);
  });

  it.each([false, true])('movimento ridotto (nel cielo: %s): niente volo; il Montone fermo davanti al recinto per 800 ms (nel cielo anche il luccichio fermo), poi via', async (pieno) => {
    const t = manuale();
    t.allinea(fotoIniziale(3), 'calmo');
    t.ctx.ridotto = true;
    const r = recinto('g2');
    const vero = tiroLungo(t, { pieno });
    const viste = registraAnimazioni(t);
    const inizio = t.ctx.orologio.ms;
    let finito = false;
    void t.ordini.testata('g1', 'g2', 0, 7).then(() => (finito = true));
    await scarica();
    const luccichio = radice.querySelector<HTMLElement>('.luccichio-testata');
    const fermo = radice.querySelector('.montone');
    while (!finito && t.ctx.orologio.ms - inizio < 5000) await scorri(t, 100);
    const ms = t.ctx.orologio.ms - inizio;
    expect(ms).toBeGreaterThanOrEqual(800);
    expect(ms).toBeLessThanOrEqual(1000);
    for (const v of viste) expect(v.o.duration).toBe(1);
    expect(fermo).not.toBeNull();
    expect(fermo!.classList.contains('ferma')).toBe(true);
    expect(piedi(del(viste, 'montone')[0]!.f[0]!).y).toBeCloseTo(yRitorno(r), 3);
    expect(del(viste, 'montone-dietro')).toHaveLength(0);
    if (pieno) {
      expect(luccichio).not.toBeNull();
      expect(luccichio!.dataset.x).toBe(String(puntoInCielo(P, vero).x));
    } else expect(luccichio).toBeNull();
    expect(radice.querySelectorAll('.montone, .luccichio-testata')).toHaveLength(0);
  });

  it.each([
    { nome: 'mentre passa dietro la collina', pieno: false, dopo: 1000, vede: '.montone-dietro' },
    { nome: 'durante il luccichio', pieno: true, dopo: 1300, vede: '.luccichio-testata' },
    { nome: 'mentre aspetta di tornare', pieno: false, dopo: 1600, vede: null },
    { nome: 'mentre torna di corsa', pieno: true, dopo: 2800, vede: '.montone' },
  ])('interrompi $nome: via tutto, evento chiuso, recinto normale', async ({ pieno, dopo, vede }) => {
    const t = manuale();
    animazioniSulOrologio(t);
    t.allinea(fotoIniziale(3), 'calmo');
    tiroLungo(t, { pieno });
    let finito = false;
    void t.ordini.testata('g1', 'g2', 0, 7).then(() => (finito = true));
    await scarica();
    await scorri(t, dopo);
    if (vede) expect(radice.querySelectorAll(vede)).toHaveLength(1);
    else expect(radice.querySelectorAll('.montone, .luccichio-testata')).toHaveLength(0);
    (t.ordini as OrdiniDelTeatro).interrompi();
    await scorri(t, 100);
    expect(finito).toBe(true);
    expect(radice.querySelectorAll('.montone, .ombra-montone, .luccichio-testata')).toHaveLength(0);
    expect(t.eventoInCorso()).toBe(false);
    expect(t.stato().recintiAlterati).toBe(0);
    const n = poseMontone().length;
    await scorri(t, 3000);
    expect(poseMontone()).toHaveLength(n);
    expect(errori).not.toHaveBeenCalled();
  });
});
