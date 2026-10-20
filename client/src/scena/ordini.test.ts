// @vitest-environment jsdom
// Prove degli ordini nuovi del pezzo 2 (la regia): Guaio del round, annuncio, carte che si girano, fumetti, carta in volo,
// eliminazione, festa e Guaio che libera la regia prima della fine del meteo. Ciclo manuale, senza ambiente né giochi
// (salvo la nebbia, che senza ambiente finirebbe subito).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defCarta, nuovaPartita, SETUP, vistaPer } from '../../../engine/src';
import type { IdCarta, IdGiocatore } from '../../../engine/src';
import { T } from '../testi';
import { casoConSeme } from './aiuti-prova';
import { fotografia, type Fotografia } from './fotografia';
import type { OrdiniDelTeatro } from './ordini';
import { POSA_SVENUTA } from './personaggi/pecora';
import { creaTeatro, type Teatro } from './teatro';

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
  it('nebbia su un avversario: a 5 s la promessa si risolve con la camera già tornata, poi la nebbia finisce', { timeout: 30_000 }, async () => {
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
