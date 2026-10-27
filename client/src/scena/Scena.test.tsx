// @vitest-environment jsdom
// Prove del componente Scena: teatro vero con ciclo automatico e rAF finto.
// Doppio montaggio (punto di revisione 2), riassunto per chi non vede, ritorno da un'altra scheda (punto 4),
// scena nascosta che non consuma, adattamento quando la radice cambia misura, "occupato" della regia verso la partita.
import { readFileSync } from 'node:fs';
import { StrictMode } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// Questo file monta teatri veri: con tutte le prove insieme una prova può superare i 5 s predefiniti (la macchina è
// carica). Il limite più alto vale per tutto il file, così la prossima prova lenta non fallisce per finta.
vi.setConfig({ testTimeout: 60_000 });
import { disposizione } from './disposizioni';
import { H } from './misure';
import { posizioneMano } from './mano';
import { applica, nuovaPartita, vistaPer } from '../../../engine/src';
import type { IdGiocatore, Stato, Vista } from '../../../engine/src';
import { chiudiPunteggio, conFaccia, nessunaReazione, prosegui, scegli, scenario } from '../../../engine/test/aiuti';
import { casoConSeme } from './aiuti-prova';
import { fotografia, type Fotografia } from './fotografia';
import { Scena } from './Scena';
import type { Teatro } from './teatro';
import type { Domanda, Pensiero } from './scelte/tipi';

/** Ogni teatro creato e ogni chiamata a recita/adatta: il teatro è quello vero, avvolto da una spia. */
const spia = vi.hoisted(() => ({
  teatri: [] as Teatro[],
  recita: [] as { teatro: number; foto: unknown; vista: unknown; subito: boolean }[],
  adatta: 0,
  /** Chiamate a chiedi, smettiDiChiedere e pensa (le domande nella scena). */
  chiedi: 0,
  smetti: 0,
  pensa: 0,
  /** Chiamate a sospendi (true: ciclo e audio fermi, false: ripartiti). */
  sospendi: [] as boolean[],
  /** Ciclo manuale (le prove della regia fanno avanzare la scena a comando). */
  manuale: false,
}));

vi.mock('./teatro', async (originale) => {
  const m = await originale<typeof import('./teatro')>();
  return {
    ...m,
    creaTeatro: (radice: HTMLElement, o?: Parameters<typeof m.creaTeatro>[1]) => {
      // Senza ambiente le prove sono veloci; il resto è il teatro vero
      const manuale = spia.manuale ? { ciclo: 'manuale' as const, giochi: false, caso: casoConSeme(5) } : {};
      const t = m.creaTeatro(radice, { ...o, ambiente: false, ...manuale });
      const n = spia.teatri.push(t) - 1;
      const recita = t.recita.bind(t);
      const adatta = t.adatta.bind(t);
      t.recita = (foto, vista, opz) => {
        spia.recita.push({ teatro: n, foto, vista, subito: opz?.subito === true });
        recita(foto, vista, opz);
      };
      t.adatta = () => {
        spia.adatta++;
        adatta();
      };
      const chiedi = t.chiedi.bind(t);
      const smetti = t.smettiDiChiedere.bind(t);
      const pensa = t.pensa.bind(t);
      const sospendi = t.sospendi.bind(t);
      t.sospendi = (s) => {
        spia.sospendi.push(s);
        sospendi(s);
      };
      t.chiedi = (d, g) => {
        spia.chiedi++;
        chiedi(d, g);
      };
      t.smettiDiChiedere = () => {
        spia.smetti++;
        smetti();
      };
      t.pensa = (p) => {
        spia.pensa++;
        pensa(p);
      };
      return t;
    },
  };
});

const GIOCATORI = [
  { id: 'g1', nome: 'Anna', pecora: 'ricciolo' as const },
  { id: 'g2', nome: 'Bruno', pecora: 'brontolana' as const },
  { id: 'g3', nome: 'Carla', pecora: 'sospirella' as const },
];
const partita = nuovaPartita({ giocatori: GIOCATORI, seme: 7 });
const VISTA = vistaPer(partita, null);
const foto = (inBasso: IdGiocatore = 'g1'): Fotografia => fotografia(VISTA, inBasso, null);
/** Due agnellini dal gregge ad Anna: una fotografia diversa dalla prima. */
const dopo = (f: Fotografia): Fotografia => ({
  ...f,
  gregge: f.gregge - 2,
  posti: f.posti.map((p) => (p.id === 'g1' ? { ...p, agnellini: p.agnellini + 2 } : p)),
});

function rafFinto() {
  const coda = new Map<number, FrameRequestCallback>();
  let prossimo = 1;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    coda.set(prossimo, cb);
    return prossimo++;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    coda.delete(id);
  });
  vi.spyOn(performance, 'now').mockReturnValue(1000);
  return coda;
}

function visibilita(stato: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => stato });
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
  spia.teatri.length = 0;
  spia.recita.length = 0;
  spia.adatta = 0;
  spia.chiedi = 0;
  spia.smetti = 0;
  spia.pensa = 0;
  spia.sospendi.length = 0;
  spia.manuale = false;
});
afterEach(() => {
  cleanup();
  delete (document as unknown as Record<string, unknown>).visibilityState;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('Scena', () => {
  it('in StrictMode: monta, cambia fotografia e smonta senza errori, senza rAF in sospeso, con la radice svuotata', () => {
    const errori = vi.spyOn(console, 'error');
    const coda = rafFinto();
    const f = foto();
    const r = render(
      <StrictMode>
        <Scena foto={f} vista={VISTA} />
      </StrictMode>,
    );
    const radice = r.container.querySelector<HTMLElement>('div.teatro')!;
    // Nascosto ai lettori di schermo è solo il mondo disegnato: le zone, i pulsanti e la nuvoletta della domanda si raggiungono
    expect(radice.hasAttribute('aria-hidden')).toBe(false);
    expect(radice.querySelector('.camera')?.getAttribute('aria-hidden')).toBe('true');
    // Il doppio montaggio di StrictMode lascia una sola scena e un solo ciclo
    expect(radice.querySelectorAll('.mondo')).toHaveLength(1);
    expect(coda.size).toBe(1);
    // Ogni teatro creato parte con una recita "subito" (gli eventi già avvenuti non si recitano)
    for (let i = 0; i < spia.teatri.length; i++) expect(spia.recita.find((c) => c.teatro === i)?.subito).toBe(true);
    const vivo = spia.teatri.length - 1;
    const f2 = dopo(f);
    r.rerender(
      <StrictMode>
        <Scena foto={f2} vista={VISTA} />
      </StrictMode>,
    );
    expect(spia.recita.at(-1)).toEqual({ teatro: vivo, foto: f2, vista: VISTA, subito: false });
    expect(spia.teatri[vivo]!.stato().agnellini.g1?.assegnati).toBe(f2.posti[0]!.agnellini);
    r.unmount();
    expect(coda.size).toBe(0);
    expect(radice.childElementCount).toBe(0);
    expect(errori).not.toHaveBeenCalled();
  });

  it('la stessa fotografia (anche ricalcolata) non riallinea', () => {
    rafFinto();
    const r = render(<Scena foto={foto()} vista={VISTA} />);
    const prima = spia.recita.length;
    r.rerender(<Scena foto={foto()} vista={{ ...VISTA }} />);
    expect(spia.recita).toHaveLength(prima);
  });

  it('il riassunto per chi non vede la scena: una riga per giocatore e il gregge', () => {
    rafFinto();
    const f = foto('g2');
    const r = render(<Scena foto={f} vista={VISTA} />);
    const righe = [...r.container.querySelectorAll('.solo-lettori li')].map((li) => li.textContent ?? '');
    expect(righe).toHaveLength(4);
    expect(righe[0]).toMatch(/^Bruno: /);
    expect(righe.join('\n')).toContain('Gregge: ');
    // Non dentro la scena (nascosta ai lettori di schermo)
    expect(r.container.querySelector('.teatro .solo-lettori')).toBeNull();
  });

  it("ritorno da un'altra scheda: visibilitychange verso visibile rimette in pari 'subito' l'ultima fotografia, senza recitare", () => {
    rafFinto();
    const f = foto();
    const r = render(<Scena foto={f} vista={VISTA} />);
    const f2 = dopo(f);
    r.rerender(<Scena foto={f2} vista={VISTA} />);
    const prima = spia.recita.length;
    act(() => visibilita('hidden'));
    expect(spia.recita).toHaveLength(prima);
    act(() => visibilita('visible'));
    expect(spia.recita).toHaveLength(prima + 1);
    expect(spia.recita.at(-1)).toMatchObject({ foto: f2, vista: VISTA, subito: true });
    // Smontata, la pagina che torna visibile non tocca più niente
    r.unmount();
    act(() => visibilita('visible'));
    expect(spia.recita).toHaveLength(prima + 1);
  });

  it('nascosta: il ciclo si ferma senza distruggere la scena; mostrata di nuovo si rimette in pari subito', () => {
    const coda = rafFinto();
    const f = foto();
    const r = render(<Scena foto={f} vista={VISTA} />);
    const radice = r.container.querySelector<HTMLElement>('div.teatro')!;
    expect(coda.size).toBe(1);
    r.rerender(<Scena foto={f} vista={VISTA} nascosta />);
    expect(coda.size).toBe(0);
    expect(radice.querySelectorAll('.mondo')).toHaveLength(1);
    // Le fotografie che arrivano intanto non si allineano
    const prima = spia.recita.length;
    const f2 = dopo(f);
    r.rerender(<Scena foto={f2} vista={VISTA} nascosta />);
    expect(spia.recita).toHaveLength(prima);
    act(() => visibilita('visible'));
    expect(spia.recita).toHaveLength(prima);
    r.rerender(<Scena foto={f2} vista={VISTA} />);
    expect(coda.size).toBe(1);
    expect(spia.recita.at(-1)).toMatchObject({ foto: f2, subito: true });
    expect(spia.teatri).toHaveLength(1);
  });

  it('sospesa (sotto "Passa il dispositivo"): il ciclo si ferma ma la scena resta in pari con la fotografia; poi riparte', () => {
    const coda = rafFinto();
    const f = foto();
    const r = render(<Scena foto={f} vista={VISTA} />);
    expect(coda.size).toBe(1);
    r.rerender(<Scena foto={f} vista={VISTA} sospesa />);
    expect(coda.size).toBe(0);
    expect(spia.sospendi).toEqual([true]);
    // La fotografia che arriva intanto (la mano si copre) si allinea comunque, a differenza della scena nascosta
    const prima = spia.recita.length;
    const f2 = dopo(f);
    r.rerender(<Scena foto={f2} vista={VISTA} sospesa />);
    expect(spia.recita).toHaveLength(prima + 1);
    expect(spia.recita.at(-1)).toMatchObject({ foto: f2 });
    expect(coda.size).toBe(0);
    r.rerender(<Scena foto={f2} vista={VISTA} />);
    expect(spia.sospendi).toEqual([true, false]);
    expect(coda.size).toBe(1);
    expect(spia.teatri).toHaveLength(1);
  });

  it('sospesa mentre la scena recita non ferma niente (la recita deve finire)', () => {
    spia.manuale = true;
    const { prima, dopo: d } = pascolo();
    const r = render(<Scena foto={prima.foto} vista={prima.vista} />);
    r.rerender(<Scena foto={d.foto} vista={d.vista} sospesa />);
    expect(spia.teatri.at(-1)!.occupato()).toBe(true);
    expect(spia.sospendi).toEqual([]);
  });

  it('nascosta comanda su sospesa: togliere la sospensione da nascosta non fa ripartire niente', () => {
    const coda = rafFinto();
    const f = foto();
    const r = render(<Scena foto={f} vista={VISTA} />);
    r.rerender(<Scena foto={f} vista={VISTA} nascosta sospesa />);
    expect(spia.sospendi).toEqual([true]);
    r.rerender(<Scena foto={f} vista={VISTA} nascosta />);
    expect(spia.sospendi).toEqual([true]);
    expect(coda.size).toBe(0);
    r.rerender(<Scena foto={f} vista={VISTA} />);
    expect(spia.sospendi).toEqual([true, false]);
    expect(coda.size).toBe(1);
  });

  it('nascosta comanda su sospesa anche quando sospesa c\'era già: nascondere la scena sospesa non la fa ripartire', () => {
    const coda = rafFinto();
    const f = foto();
    const r = render(<Scena foto={f} vista={VISTA} sospesa />);
    expect(coda.size).toBe(0);
    r.rerender(<Scena foto={f} vista={VISTA} nascosta sospesa />);
    expect(spia.sospendi.at(-1)).toBe(true);
    expect(coda.size).toBe(0);
    // Mostrata di nuovo ma ancora sospesa: il ciclo resta fermo; tolta la sospensione riparte
    r.rerender(<Scena foto={f} vista={VISTA} sospesa />);
    expect(spia.sospendi.at(-1)).toBe(true);
    expect(coda.size).toBe(0);
    r.rerender(<Scena foto={f} vista={VISTA} />);
    expect(spia.sospendi.at(-1)).toBe(false);
    expect(coda.size).toBe(1);
  });

  it('la scala si rifà quando la radice cambia misura (ResizeObserver) e quando la scena torna visibile', () => {
    rafFinto();
    const osservatori: { cb: () => void; el: Element[]; via: boolean }[] = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        o: { cb: () => void; el: Element[]; via: boolean };
        constructor(cb: () => void) {
          this.o = { cb, el: [], via: false };
          osservatori.push(this.o);
        }
        observe(el: Element) {
          this.o.el.push(el);
        }
        unobserve() {}
        disconnect() {
          this.o.via = true;
        }
      },
    );
    const r = render(<Scena foto={foto()} vista={VISTA} />);
    const radice = r.container.querySelector('div.teatro')!;
    const attivo = osservatori.find((o) => !o.via)!;
    expect(attivo.el).toContain(radice);
    const prima = spia.adatta;
    act(() => attivo.cb());
    expect(spia.adatta).toBe(prima + 1);
    r.rerender(<Scena foto={foto()} vista={VISTA} nascosta />);
    r.rerender(<Scena foto={foto()} vista={VISTA} />);
    expect(spia.adatta).toBeGreaterThan(prima + 1);
    r.unmount();
    expect(osservatori.every((o) => o.via)).toBe(true);
  });

  it('il suggerimento dei gesti sta in basso, in coordinate della scena, non più legato alla striscia in cima', () => {
    rafFinto();
    const r = render(<Scena foto={foto()} vista={VISTA} />);
    const radice = r.container.querySelector<HTMLElement>('div.teatro')!;
    expect(radice.classList.contains('spazio-alto')).toBe(false);
    expect(radice.querySelector('.consiglio')).not.toBeNull();
    // Il CSS come testo (le prove non elaborano i fogli di stile)
    const css = readFileSync('client/src/scena/scena.css', 'utf8');
    expect(css).not.toMatch(/spazio-alto/);
    expect(css).not.toMatch(/--sy/);
    // In coordinate della scena (scalata con S, non ingrandita da --kd): top fisso e altezza fissa, niente ancoraggio al fondo
    const regole = [...css.matchAll(/\.teatro \.consiglio\s*{([^}]*)}/g)].map((m) => m[1]).join(' ');
    expect(regole).toMatch(/top:\s*\d+(\.\d+)?px/);
    expect(regole).not.toMatch(/bottom:/);
    expect(regole).not.toMatch(/--kd/);
    expect(regole).toMatch(/height:\s*\d+px/);
    expect(regole).toMatch(/font:\s*700 10px/);
  });

  it('il suggerimento sta tra la staccionata davanti del posto 0 e la cima delle carte, con KD tra 1 e 1,25 (numeri dalla disposizione e dalla mano)', () => {
    const css = readFileSync('client/src/scena/scena.css', 'utf8');
    const regole = [...css.matchAll(/\.teatro \.consiglio\s*{([^}]*)}/g)].map((m) => m[1]).join(' ');
    const top = Number(/top:\s*([\d.]+)px/.exec(regole)?.[1]);
    const alto = Number(/height:\s*(\d+)px/.exec(regole)?.[1]);
    const fondo = top + alto;
    const cartelloBasso = (d: ReturnType<typeof disposizione>) => {
      const [, , yDavanti, , k] = d.posti[0]!.recinto!;
      return { yDavanti, k };
    };
    for (const n of [2, 3, 4] as const) {
      const { yDavanti, k } = cartelloBasso(disposizione(n));
      // Fondo dei paletti davanti (palo: h + 3k sotto la quota) più metà del tratto
      const fondoStaccionata = yDavanti + 3 * k + 1.1;
      expect(top).toBeGreaterThanOrEqual(fondoStaccionata);
      // Il cartello del recinto sta sopra la staccionata davanti (top = yDavanti - 22k·0.95)
      expect(top).toBeGreaterThan(yDavanti);
      for (const KD of [1, 1.25]) {
        for (let m = 1; m <= 8; m++) {
          // Cima del ventaglio a riposo (le carte coi gesti da dito): il punto più alto è la carta centrale o le due centrali
          const cima = Math.min(...Array.from({ length: m }, (_, i) => posizioneMano(i, m).y - 175 * posizioneMano(i, m).k));
          expect(fondo).toBeLessThanOrEqual(H - (H - cima) * KD);
        }
      }
      // Con la carta rialzata dal mouse (k 0,4, su di 26) a KD 1 sta ancora sopra
      const rialzata = posizioneMano(0, 1).y - 26 - 175 * 0.4;
      expect(fondo).toBeLessThanOrEqual(rialzata);
    }
  });

  it('senza ResizeObserver (jsdom) si monta lo stesso', () => {
    rafFinto();
    vi.stubGlobal('ResizeObserver', undefined);
    expect(() => render(<Scena foto={foto()} vista={VISTA} />)).not.toThrow();
  });
});

/** Tre giocatori al dado (come in regia/regista.test.ts): g1 lancia, gregge con 20 agnellini. */
function alDado(): Stato {
  const mani = { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['sasso-comodo'] };
  let s = prosegui(scenario({ guaio: 'tosatura-a-sorpresa', gregge: 20, mani }));
  s = scegli(s, mani);
  s = prosegui(s);
  if (s.fase.nome === 'belati_punteggio') s = chiudiPunteggio(s);
  expect(s.fase.nome).toBe('dado');
  return s;
}

/** Il Pascolo di g1: prima e dopo il lancio. */
function pascolo(): { prima: { foto: Fotografia; vista: Vista }; dopo: { foto: Fotografia; vista: Vista } } {
  const a = alDado();
  const b = nessunaReazione(applica(conFaccia(a, 'pascolo_piccolo'), { tipo: 'lanciaDado', giocatore: 'g1' }));
  const coppia = (s: Stato) => ({ foto: fotografia(vistaPer(s, null), 'g1', null), vista: vistaPer(s, null) });
  return { prima: coppia(a), dopo: coppia(b) };
}

/**
 * Avanza la scena (ciclo manuale) a passi di 33 ms, lasciando proseguire le promesse della regia.
 * Senza act: gli avvisi vanno a una funzione qualsiasi, non a uno stato di React.
 */
async function scorri(t: Teatro, ms: number, finche: () => boolean = () => false): Promise<void> {
  for (let fatto = 0; fatto < ms && !finche(); fatto += 33) {
    t.avanza(33);
    for (let i = 0; i < 20; i++) await Promise.resolve();
  }
}

describe('Scena e regia: la partita sa quando la scena recita', () => {
  it('una fotografia nuova con gli eventi di un Pascolo: onOccupato(true), poi onOccupato(false) a recita finita', async () => {
    spia.manuale = true;
    const errori = vi.spyOn(console, 'error');
    const { prima, dopo } = pascolo();
    const avvisi: boolean[] = [];
    const onOccupato = (o: boolean) => avvisi.push(o);
    const r = render(<Scena foto={prima.foto} vista={prima.vista} onOccupato={onOccupato} />);
    // La prima fotografia si mostra subito: niente da recitare, nessun avviso
    expect(spia.recita.at(-1)?.subito).toBe(true);
    expect(avvisi).toEqual([]);
    r.rerender(<Scena foto={dopo.foto} vista={dopo.vista} onOccupato={onOccupato} />);
    expect(spia.recita.at(-1)).toMatchObject({ foto: dopo.foto, vista: dopo.vista, subito: false });
    const t = spia.teatri.at(-1)!;
    expect(t.occupato()).toBe(true);
    expect(avvisi).toEqual([true]);
    await scorri(t, 20_000, () => !t.occupato());
    expect(t.occupato()).toBe(false);
    expect(avvisi).toEqual([true, false]);
    // A recita finita la scena coincide con la fotografia
    expect(t.stato().agnellini.g1?.assegnati).toBe(dopo.foto.posti[0]!.agnellini);
    expect(t.stato().agnellini.g1?.mostrati).toBe(dopo.foto.posti[0]!.agnellini);
    r.unmount();
    expect(errori).not.toHaveBeenCalled();
  });

  it('smontata durante la recita: onOccupato(false), una volta sola', () => {
    spia.manuale = true;
    const { prima, dopo } = pascolo();
    const avvisi: boolean[] = [];
    const onOccupato = (o: boolean) => avvisi.push(o);
    const r = render(<Scena foto={prima.foto} vista={prima.vista} onOccupato={onOccupato} />);
    r.rerender(<Scena foto={dopo.foto} vista={dopo.vista} onOccupato={onOccupato} />);
    expect(avvisi).toEqual([true]);
    r.unmount();
    expect(avvisi).toEqual([true, false]);
  });

  it('in StrictMode il finto smontaggio non lascia "occupato" acceso', () => {
    spia.manuale = true;
    const { prima, dopo } = pascolo();
    const avvisi: boolean[] = [];
    const onOccupato = (o: boolean) => avvisi.push(o);
    const r = render(
      <StrictMode>
        <Scena foto={prima.foto} vista={prima.vista} onOccupato={onOccupato} />
      </StrictMode>,
    );
    r.rerender(
      <StrictMode>
        <Scena foto={dopo.foto} vista={dopo.vista} onOccupato={onOccupato} />
      </StrictMode>,
    );
    expect(avvisi.at(-1)).toBe(true);
    expect(spia.teatri.at(-1)!.occupato()).toBe(true);
    r.unmount();
    expect(avvisi.at(-1)).toBe(false);
  });

  it('nascosta durante la recita: la scena si mette in pari subito e si libera (la partita non resta ad aspettare)', () => {
    spia.manuale = true;
    const { prima, dopo } = pascolo();
    const avvisi: boolean[] = [];
    const onOccupato = (o: boolean) => avvisi.push(o);
    const r = render(<Scena foto={prima.foto} vista={prima.vista} onOccupato={onOccupato} />);
    r.rerender(<Scena foto={dopo.foto} vista={dopo.vista} onOccupato={onOccupato} />);
    expect(avvisi).toEqual([true]);
    r.rerender(<Scena foto={dopo.foto} vista={dopo.vista} onOccupato={onOccupato} nascosta />);
    const t = spia.teatri.at(-1)!;
    expect(t.occupato()).toBe(false);
    expect(avvisi).toEqual([true, false]);
    expect(t.stato().agnellini.g1?.assegnati).toBe(dopo.foto.posti[0]!.agnellini);
    // Mostrata di nuovo: in pari subito, la recita non riparte
    r.rerender(<Scena foto={dopo.foto} vista={dopo.vista} onOccupato={onOccupato} />);
    expect(spia.recita.at(-1)?.subito).toBe(true);
    expect(t.occupato()).toBe(false);
    expect(avvisi).toEqual([true, false]);
  });

  it("ritorno da un'altra scheda durante la recita: libera subito e non recita di nuovo", () => {
    spia.manuale = true;
    const { prima, dopo } = pascolo();
    const avvisi: boolean[] = [];
    const onOccupato = (o: boolean) => avvisi.push(o);
    const r = render(<Scena foto={prima.foto} vista={prima.vista} onOccupato={onOccupato} />);
    r.rerender(<Scena foto={dopo.foto} vista={dopo.vista} onOccupato={onOccupato} />);
    const t = spia.teatri.at(-1)!;
    const dado = vi.spyOn(t.ordini, 'dado');
    act(() => visibilita('visible'));
    expect(t.occupato()).toBe(false);
    expect(avvisi).toEqual([true, false]);
    // La stessa fotografia di nuovo (un rendering qualsiasi) non fa ripartire il dado
    r.rerender(<Scena foto={{ ...dopo.foto }} vista={dopo.vista} onOccupato={onOccupato} />);
    expect(dado).not.toHaveBeenCalled();
    expect(t.occupato()).toBe(false);
  });

  it('stessa fotografia ma eventi nuovi nella vista: si recita lo stesso', () => {
    rafFinto();
    const f = foto();
    const r = render(<Scena foto={f} vista={VISTA} />);
    const prima = spia.recita.length;
    const ultimo = VISTA.eventi.at(-1)!;
    const conUnoInPiu: Vista = { ...VISTA, eventi: [...VISTA.eventi, { ...ultimo, seq: ultimo.seq + 1 }] };
    r.rerender(<Scena foto={f} vista={conUnoInPiu} />);
    expect(spia.recita).toHaveLength(prima + 1);
    expect(spia.recita.at(-1)).toMatchObject({ vista: conUnoInPiu, subito: false });
  });
});

/** Una domanda "Chi risponde?" con la pecora di g2 e il pulsante "Nessuno". */
const domanda = (o: Partial<Domanda> = {}): Domanda => ({
  chiave: 'k',
  scritta: 'Qualcuno risponde?',
  avvisi: [],
  carte: [],
  sollevate: [],
  trascinabili: [],
  pecore: ['g2'],
  dado: false,
  guai: [],
  guaioScelto: null,
  grandi: [],
  centro: null,
  furto: null,
  pulsanti: [{ id: 'nessuno', testo: 'Nessuno', attivo: true }],
  fionda: null,
  ...o,
});
const bottone = (radice: Element, testo: string) =>
  [...radice.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === testo);

describe('Scena e domande: le scelte dentro la scena', () => {
  it('la domanda passata diventa zone e pulsanti nella scena; i gesti arrivano al suGesto più recente', () => {
    rafFinto();
    const primo = vi.fn();
    const secondo = vi.fn();
    const r = render(<Scena foto={foto()} vista={VISTA} domanda={domanda()} suGesto={primo} />);
    const radice = r.container.querySelector<HTMLElement>('div.teatro')!;
    expect(spia.chiedi).toBe(1);
    expect(radice.querySelector('.ui .zona[data-chi="g2"]')).not.toBeNull();
    expect(bottone(radice, 'Nessuno')).toBeDefined();
    // Un rendering con una domanda uguale (oggetto nuovo) e un suGesto nuovo: niente chiedi di nuovo
    r.rerender(<Scena foto={foto()} vista={VISTA} domanda={domanda()} suGesto={secondo} />);
    expect(spia.chiedi).toBe(1);
    act(() => bottone(radice, 'Nessuno')!.click());
    expect(secondo).toHaveBeenCalledWith({ tipo: 'pulsante', id: 'nessuno' });
    expect(primo).not.toHaveBeenCalled();
    act(() => radice.querySelector<HTMLElement>('.zona[data-chi="g2"]')!.click());
    expect(secondo).toHaveBeenLastCalledWith({ tipo: 'pecora', chi: 'g2' });
  });

  it('una domanda diversa si richiede; senza domanda la scena smette di chiedere', () => {
    rafFinto();
    const r = render(<Scena foto={foto()} vista={VISTA} domanda={domanda()} suGesto={() => {}} />);
    const radice = r.container.querySelector<HTMLElement>('div.teatro')!;
    r.rerender(<Scena foto={foto()} vista={VISTA} domanda={domanda({ pecore: ['g3'] })} suGesto={() => {}} />);
    expect(spia.chiedi).toBe(2);
    expect(radice.querySelector('.zona[data-chi="g3"]')).not.toBeNull();
    expect(radice.querySelector('.zona[data-chi="g2"]')).toBeNull();
    r.rerender(<Scena foto={foto()} vista={VISTA} domanda={null} suGesto={() => {}} />);
    expect(spia.smetti).toBe(1);
    expect(radice.querySelector('.zona')).toBeNull();
    expect(bottone(radice, 'Nessuno')).toBeUndefined();
    // Di nuovo la stessa domanda di prima: si richiede (il teatro l'aveva dimenticata)
    r.rerender(<Scena foto={foto()} vista={VISTA} domanda={domanda({ pecore: ['g3'] })} suGesto={() => {}} />);
    expect(spia.chiedi).toBe(3);
    expect(radice.querySelector('.zona[data-chi="g3"]')).not.toBeNull();
  });

  it('onPronto(true) a teatro montato, onPronto(false) smontando (anche in StrictMode)', () => {
    rafFinto();
    const avvisi: boolean[] = [];
    const onPronto = (p: boolean) => avvisi.push(p);
    const r = render(
      <StrictMode>
        <Scena foto={foto()} vista={VISTA} onPronto={onPronto} />
      </StrictMode>,
    );
    expect(avvisi.at(-1)).toBe(true);
    const montaggi = avvisi.length;
    r.rerender(
      <StrictMode>
        <Scena foto={dopo(foto())} vista={VISTA} onPronto={onPronto} />
      </StrictMode>,
    );
    // Una fotografia nuova non è un montaggio nuovo
    expect(avvisi).toHaveLength(montaggi);
    r.unmount();
    expect(avvisi.at(-1)).toBe(false);
  });

  it('il pensiero: un contenuto uguale non si ripassa, il pulsante chiama l\'azione più recente; null lo toglie', () => {
    rafFinto();
    const prima = vi.fn();
    const dopoAzione = vi.fn();
    const pensiero = (azione: () => void): Pensiero => ({ titolo: 'Consiglio', testo: 'Ciao', pulsanti: [{ testo: 'Ho capito', azione }] });
    const r = render(<Scena foto={foto()} vista={VISTA} pensiero={pensiero(prima)} />);
    const radice = r.container.querySelector<HTMLElement>('div.teatro')!;
    expect(spia.pensa).toBe(1);
    expect(radice.querySelector('.pensiero .testo')?.textContent).toBe('Ciao');
    r.rerender(<Scena foto={foto()} vista={VISTA} pensiero={pensiero(dopoAzione)} />);
    expect(spia.pensa).toBe(1);
    act(() => bottone(radice, 'Ho capito')!.click());
    expect(dopoAzione).toHaveBeenCalledTimes(1);
    expect(prima).not.toHaveBeenCalled();
    r.rerender(<Scena foto={foto()} vista={VISTA} pensiero={{ testo: 'Altro', pulsanti: [] }} />);
    expect(spia.pensa).toBe(2);
    expect(radice.querySelector('.pensiero .testo')?.textContent).toBe('Altro');
    r.rerender(<Scena foto={foto()} vista={VISTA} pensiero={null} />);
    expect(spia.pensa).toBe(3);
    expect(radice.querySelector('.pensiero')).toBeNull();
  });

  it('mentre la scena recita non si chiede niente; a recita finita, al rendering dopo, la domanda torna', async () => {
    spia.manuale = true;
    const { prima, dopo: poi } = pascolo();
    const d = domanda({ pecore: ['g2'] });
    const r = render(<Scena foto={prima.foto} vista={prima.vista} domanda={d} suGesto={() => {}} />);
    const radice = r.container.querySelector<HTMLElement>('div.teatro')!;
    expect(radice.querySelector('.zona[data-chi="g2"]')).not.toBeNull();
    // Gli eventi del Pascolo: la scena recita e la domanda (anche se è la stessa) non resta
    r.rerender(<Scena foto={poi.foto} vista={poi.vista} domanda={d} suGesto={() => {}} />);
    const t = spia.teatri.at(-1)!;
    expect(t.occupato()).toBe(true);
    expect(radice.querySelector('.zona')).toBeNull();
    await scorri(t, 20_000, () => !t.occupato());
    r.rerender(<Scena foto={poi.foto} vista={poi.vista} domanda={{ ...d }} suGesto={() => {}} />);
    expect(radice.querySelector('.zona[data-chi="g2"]')).not.toBeNull();
  });
});
