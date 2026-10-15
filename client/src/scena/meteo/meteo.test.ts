// @vitest-environment jsdom
// Prove di camera, meteo e ordini: `provaCompleta` di bozze/scena/prove.js resa prova automatica (ciclo manuale, senza ambiente),
// più salto, vibrazione, dado, spostamenti e ricostruzione del tavolo a metà di un Guaio.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nuovaPartita, SETUP, vistaPer } from '../../../../engine/src';
import type { IdGiocatore } from '../../../../engine/src';
import { casoConSeme } from '../aiuti-prova';
import { fotografia, type Fotografia } from '../fotografia';
import { creaTeatro, type StatoMostrato, type Teatro } from '../teatro';

/** I Guai con un effetto sulla scena: i 7 meteo più il Lupo. */
const GUAI_CON_EFFETTO = [
  'grandine-a-sorpresa',
  'pioggia-di-traverso',
  'vento-dispettoso',
  'nebbia-fitta',
  'fulmine-curioso',
  'gelata-di-agosto',
  'pozzanghera-senza-fondo',
  'lupo-vegetariano',
];

function fotoIniziale(n: 2 | 3 | 4, inBasso: IdGiocatore = 'g1'): Fotografia {
  const giocatori = SETUP.pecore.slice(0, n).map((p, i) => ({ id: `g${i + 1}`, nome: `G${i + 1}`, pecora: p.id }));
  return fotografia(vistaPer(nuovaPartita({ giocatori, seme: 11 }), null), inBasso, null);
}

/** La stessa fotografia vista da un altro giocatore in basso. */
function ruota(f: Fotografia, inBasso: IdGiocatore): Fotografia {
  const i = f.posti.findIndex((p) => p.id === inBasso);
  return { ...f, posti: [...f.posti.slice(i), ...f.posti.slice(0, i)] };
}

/** Lascia correre le promesse in sospeso (le attese dell'orologio si risolvono durante `avanza`). */
async function scarica(): Promise<void> {
  for (let i = 0; i < 40; i++) await Promise.resolve();
}

/** Fa avanzare la scena di `ms` a pezzi di 100 ms, lasciando proseguire le promesse tra un pezzo e l'altro. */
async function scorri(t: Teatro, ms: number, osserva?: () => void): Promise<void> {
  for (let fatto = 0; fatto < ms; fatto += 100) {
    t.avanza(Math.min(100, ms - fatto));
    await scarica();
    osserva?.();
  }
}

/** A passi di 1 s finché l'evento è in corso (al più `max` ms); restituisce i ms passati. `osserva` guarda ogni 100 ms. */
async function finoAllaQuiete(t: Teatro, max = 40000, osserva?: () => void): Promise<number> {
  let ms = 0;
  while (t.eventoInCorso() && ms < max) {
    await scorri(t, 1000, osserva);
    ms += 1000;
  }
  return ms;
}

/** Un agnellino colpito dal fulmine fa ancora un saltello (mezzo secondo) dopo la fine del meteo: lo si aspetta, al più 2 s. */
async function finoASenzaRegia(t: Teatro, max = 2000): Promise<StatoMostrato> {
  for (let ms = 0; t.stato().inRegia > 0 && ms < max; ms += 100) await scorri(t, 100);
  return t.stato();
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
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

const manuale = (ambiente = false) => (teatro = creaTeatro(radice, { ciclo: 'manuale', ambiente, giochi: false, caso: casoConSeme(5) }));

/** Lo stato di una scena "pulita": niente in viaggio, intrappolato o in regia, zoom 1, postazioni e recinti come all'inizio. */
function controllaPulita(s: StatoMostrato, prima: StatoMostrato): void {
  expect(s.agnellini).toEqual(prima.agnellini);
  expect(s.inViaggio).toBe(0);
  expect(s.intrappolati).toBe(0);
  expect(s.inRegia).toBe(0);
  expect(s.zoom).toBe(1);
  expect(s.postazioniNascoste).toBe(0);
  expect(s.recintiAlterati).toBe(0);
  expect(s.fuori).toBe(0);
}

const CASI = ([2, 3, 4] as const).flatMap((n) =>
  Array.from({ length: n }, (_, i) => `g${i + 1}`).flatMap((chi) => GUAI_CON_EFFETTO.map((carta) => ({ n, chi, carta }))),
);

// Tempo massimo esplicito per caso: con l'ambiente vero (nebbia) un caso dura 2–4 s da solo, e con tutta la suite
// in parallelo supera i 5 s predefiniti
describe('ordini.guaio: ogni Guaio con effetto, per ogni posto e numero di giocatori', { timeout: 30_000 }, () => {
  it.each(CASI)('$n giocatori, $carta su $chi', async ({ n, chi, carta }) => {
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

describe('ordini: salto, vibrazione, dado, spostamenti', () => {
  it('salto: un Guaio nebbia saltato dopo 1 s finisce entro 4 s', async () => {
    const t = manuale(true);
    t.allinea(fotoIniziale(3), 'calmo');
    void t.ordini.guaio('nebbia-fitta', 'g1');
    await scorri(t, 1000);
    expect(t.eventoInCorso()).toBe(true);
    t.salta();
    let ms = 0;
    while (t.eventoInCorso() && ms < 10000) {
      await scorri(t, 100);
      ms += 100;
    }
    expect(t.eventoInCorso()).toBe(false);
    expect(ms).toBeLessThanOrEqual(4000);
    expect(errori).not.toHaveBeenCalled();
  });

  it('vibrazione: guaio su chi sta in basso vibra [60, 50, 60], su un avversario no; beeeNo vibra [140]', async () => {
    const vibrate = vi.fn();
    vi.stubGlobal('navigator', { userAgent: 'jsdom', vibrate });
    const t = manuale();
    t.allinea(fotoIniziale(3), 'calmo');
    void t.ordini.guaio('lupo-vegetariano', 'g2');
    await scarica();
    expect(vibrate).not.toHaveBeenCalled();
    await finoAllaQuiete(t);
    void t.ordini.guaio('lupo-vegetariano', 'g1');
    await scarica();
    expect(vibrate).toHaveBeenCalledWith([60, 50, 60]);
    await finoAllaQuiete(t);
    vibrate.mockClear();
    const beee = t.ordini.beeeNo('g2');
    await finoAllaQuiete(t);
    await beee;
    expect(vibrate).toHaveBeenCalledWith([140]);
  });


  it('spostaAgnellini: 5 dal gregge a un recinto con 3 posti liberi ne sposta 3', async () => {
    const t = manuale();
    const base = fotoIniziale(3);
    const mancano = base.postiOvile - base.posti[1]!.agnellini - 3;
    const f: Fotografia = {
      ...base,
      gregge: base.gregge - mancano,
      posti: base.posti.map((p, i) => (i === 1 ? { ...p, agnellini: p.agnellini + mancano } : p)),
    };
    t.allinea(f, 'calmo');
    expect(t.ordini.spostaAgnellini(5, 'gregge', 'g2')).toBe(3);
    await finoAllaQuiete(t);
    expect(t.stato().agnellini.g2).toEqual({ assegnati: base.postiOvile, mostrati: base.postiOvile });
  });

  it('testata: il montone fa volare gli agnellini del bersaglio verso il gregge', async () => {
    const t = manuale();
    const f = fotoIniziale(3);
    t.allinea(f, 'calmo');
    const prima = t.stato().agnellini;
    const fine = t.ordini.testata('g1', 'g3', 2);
    await finoAllaQuiete(t);
    await fine;
    const s = t.stato();
    expect(s.agnellini.g3!.assegnati).toBe(prima.g3!.assegnati - 2);
    expect(s.agnellini.gregge!.assegnati).toBe(prima.gregge!.assegnati + 2);
    expect(s.inViaggio).toBe(0);
    expect(radice.querySelectorAll('.montone')).toHaveLength(0);
  });

  it('meteo: un Guaio senza effetto non ferma il meteo in corso', async () => {
    const t = manuale();
    t.allinea(fotoIniziale(3), 'calmo');
    void t.ordini.meteo('lupo-vegetariano', 'g1');
    await scorri(t, 500);
    expect(t.ctx.meteoAttivo()).toBe(true);
    await t.ordini.meteo('volpe-gentile', 'g1');
    expect(t.ctx.meteoAttivo()).toBe(true);
    expect(radice.querySelectorAll('.pozza')).toHaveLength(1);
    await finoAllaQuiete(t);
    expect(t.ctx.meteoAttivo()).toBe(false);
  });

  it("dado: ordini.dado('testata') rotola davvero e resta sulla faccia d-testata", async () => {
    const t = manuale();
    t.allinea(fotoIniziale(2), 'calmo');
    const anima = vi.spyOn(t.ctx, 'anima');
    let finito = false;
    void t.ordini.dado('testata').then(() => (finito = true));
    await scarica();
    expect(t.eventoInCorso()).toBe(true);
    // Il cubo gira di due giri pieni più la faccia (rotateX −90° → 630°), il dado salta e l'ombra lo segue
    const dado = radice.querySelector<HTMLElement>('.dado')!;
    const giro = anima.mock.calls.find(([e]) => e === dado);
    expect(giro).toBeDefined();
    const fotogrammi = giro![1] as Keyframe[];
    expect(String(fotogrammi[fotogrammi.length - 1]!.transform)).toContain('rotateX(630deg) rotateY(720deg)');
    expect(anima.mock.calls.some(([e]) => e === radice.querySelector('.dado-salto'))).toBe(true);
    expect(anima.mock.calls.some(([e]) => e === radice.querySelector('.dado-ombra'))).toBe(true);
    await finoAllaQuiete(t);
    await scarica();
    expect(finito).toBe(true);
    expect(dado.dataset.faccia).toBe('d-testata');
  });
  it('inquadra e sgancia: zoom, tutti gli elementi degli altri avversari nascosti (anche quelli nuovi), poi tutto come prima', async () => {
    const t = manuale();
    const f = fotoIniziale(4);
    t.allinea(f, 'calmo');
    const prima = t.stato();
    const altri = (): HTMLElement[] => [...radice.querySelectorAll<HTMLElement>('.mondo [data-chi="g2"], .mondo [data-chi="g4"]')];
    const nascosti = () => altri().filter((e) => e.style.opacity === '0').length;
    const dentro = t.ordini.inquadra('g3');
    await scorri(t, 1500);
    await dentro;
    let s = t.stato();
    expect(s.zoom).toBeGreaterThan(1);
    expect(s.postazioniNascoste).toBe(2);
    expect(s.recintiAlterati).toBe(1);
    // Tutti: pecora, targa, segnalini, recinto, cartello, sterrato, ventaglio, carte del round, mini-carte
    expect(altri().length).toBeGreaterThan(0);
    expect(nascosti()).toBe(altri().length);
    expect(radice.querySelectorAll('.mondo [data-chi="g3"][style*="opacity: 0"]')).toHaveLength(0);
    // Un allineamento calmo durante lo zoom: la mini-carta nuova di g2 nasce già nascosta
    const conGuaio: Fotografia = { ...f, posti: f.posti.map((p) => (p.id === 'g2' ? { ...p, angolo: [...p.angolo, 'lupo-vegetariano'] } : p)) };
    t.allinea(conGuaio, 'calmo');
    expect(radice.querySelectorAll('.mondo .mini[data-chi="g2"]').length).toBeGreaterThan(0);
    expect(nascosti()).toBe(altri().length);
    const fuori = t.ordini.sgancia();
    await scorri(t, 1500);
    await fuori;
    s = await finoASenzaRegia(t);
    controllaPulita(s, prima);
    expect(nascosti()).toBe(0);
  });
});

describe('ricostruzione del tavolo a metà di un Guaio', () => {
  it('allinea con un altro giocatore in basso ferma meteo, camera, voli ed eventi', async () => {
    const t = manuale();
    const f = fotoIniziale(3);
    t.allinea(f, 'calmo');
    void t.ordini.guaio('pozzanghera-senza-fondo', 'g2');
    await scorri(t, 3000);
    expect(t.eventoInCorso()).toBe(true);
    expect(t.stato().zoom).toBeGreaterThan(1);
    const g = ruota(f, 'g2');
    t.allinea(g, 'calmo');
    const ms = await finoAllaQuiete(t, 10000);
    expect(ms).toBeLessThanOrEqual(3000);
    expect(t.eventoInCorso()).toBe(false);
    const s = await finoASenzaRegia(t);
    expect(s.inBasso).toBe('g2');
    expect(s.inViaggio).toBe(0);
    expect(s.intrappolati).toBe(0);
    expect(s.inRegia).toBe(0);
    expect(s.zoom).toBe(1);
    expect(s.postazioniNascoste).toBe(0);
    expect(s.recintiAlterati).toBe(0);
    expect(radice.querySelectorAll('.volante, .pozza, .saetta, .lampo, .gelo, .linee-zoom')).toHaveLength(0);
    expect(radice.querySelector('.mano')?.classList.contains('ventoso')).toBe(false);
    expect(errori).not.toHaveBeenCalled();
  });
});
