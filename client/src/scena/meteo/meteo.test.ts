// @vitest-environment jsdom
// Prove di camera, meteo e ordini: salto, vibrazione, dado, spostamenti e ricostruzione del tavolo a metà di un Guaio.
// La prova di ogni Guaio con effetto per ogni posto (`provaCompleta` di bozze/scena/prove.js resa prova automatica) sta in
// meteo-guai-2/3/4.test.ts, un file per numero di giocatori, con gli aiuti di aiuti-meteo.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { casoConSeme } from '../aiuti-prova';
import type { Fotografia } from '../fotografia';
import { creaTeatro, type Teatro } from '../teatro';
import { controllaPulita, finoAllaQuiete, finoASenzaRegia, fotoIniziale, ruota, scarica, scorri } from './aiuti-meteo';

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

describe('ordini: salto, vibrazione, dado, spostamenti', () => {
  // La scena con l'ambiente è pesante in jsdom: col PC carico il tempo vero supera i 5 s predefiniti
  it('salto: un Guaio nebbia saltato dopo 1 s finisce entro 4 s', { timeout: 30_000 }, async () => {
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

  it('vibrazione: guaio su chi sta in basso vibra [60, 50, 60], su un avversario no; beeeNo vibra [140]', { timeout: 30_000 }, async () => {
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

  it('meteo: un Guaio senza effetto non ferma il meteo in corso', { timeout: 30_000 }, async () => {
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
  it('inquadra e sgancia: zoom, tutti gli elementi degli altri avversari nascosti (anche quelli nuovi), poi tutto come prima', { timeout: 30_000 }, async () => {
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
  it('allinea con un altro giocatore in basso ferma meteo, camera, voli ed eventi', { timeout: 30_000 }, async () => {
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
