// @vitest-environment jsdom
// Prove del teatro: ciclo, allineamento con la fotografia, tocchi e distruzione (punti di revisione 2, 3 e 4).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// Questo file monta teatri veri: con tutte le prove insieme una prova può superare i 5 s predefiniti (la macchina è
// carica). Il limite più alto vale per tutto il file, così la prossima prova lenta non fallisce per finta.
vi.setConfig({ testTimeout: 60_000 });
import { defCarta, nuovaPartita, vistaPer } from '../../../engine/src';
import type { IdGiocatore, Stato } from '../../../engine/src';
import { casoConSeme } from './aiuti-prova';
import { fotografia, type Fotografia } from './fotografia';
import { piattaforma } from './piattaforma';
import { opzioni } from './servizi/opzioni';
import { Suono } from './servizi/suoni';
import { creaTeatro, type Teatro } from './teatro';

const GIOCATORI = [
  { id: 'g1', nome: 'Anna', pecora: 'ricciolo' as const },
  { id: 'g2', nome: 'Bruno', pecora: 'brontolana' as const },
  { id: 'g3', nome: 'Carla', pecora: 'sospirella' as const },
];

const partita = (): Stato => nuovaPartita({ giocatori: GIOCATORI, seme: 7 });
const foto = (s: Stato, inBasso: IdGiocatore = 'g1'): Fotografia => fotografia(vistaPer(s, null), inBasso, null);

/** Sposta `n` agnellini dal gregge al giocatore `chi` nella fotografia (come farebbe il motore). */
function dalGregge(f: Fotografia, chi: IdGiocatore, n: number): Fotografia {
  return { ...f, gregge: f.gregge - n, posti: f.posti.map((p) => (p.id === chi ? { ...p, agnellini: p.agnellini + n } : p)) };
}

/** La stessa fotografia vista da un altro giocatore in basso. */
function ruota(f: Fotografia, inBasso: IdGiocatore): Fotografia {
  const i = f.posti.findIndex((p) => p.id === inBasso);
  return { ...f, posti: [...f.posti.slice(i), ...f.posti.slice(0, i)] };
}

/** Ciò che la scena deve mostrare a fine movimento: per ogni luogo, assegnati e mostrati uguali alla fotografia. */
function attesi(f: Fotografia) {
  const r: Record<string, { assegnati: number; mostrati: number }> = {};
  for (const p of f.posti) r[p.id] = { assegnati: p.agnellini, mostrati: p.agnellini };
  r.gregge = { assegnati: f.gregge, mostrati: f.gregge };
  return r;
}

function evento(tipo: string, el: Element) {
  const e = new MouseEvent(tipo, { bubbles: true, cancelable: true, clientX: 10, clientY: 10 });
  Object.assign(e, { pointerId: 1, pointerType: 'touch' });
  el.dispatchEvent(e);
}

let radice: HTMLElement;
let teatro: Teatro | null = null;

beforeEach(() => {
  radice = document.createElement('div');
  document.body.appendChild(radice);
});

afterEach(() => {
  teatro?.distruggi();
  teatro = null;
  radice.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

const manuale = () => (teatro = creaTeatro(radice, { ciclo: 'manuale', ambiente: false, caso: casoConSeme(3) }));

describe('teatro: "Riduci movimento" cambiato a partita in corso', () => {
  it('ctx.ridotto segue la preferenza dal vivo (le animazioni nuove la rispettano); distruggi smette di ascoltare', () => {
    let ridotto = false;
    const ascoltatori = new Set<(e: { matches: boolean }) => void>();
    vi.stubGlobal('matchMedia', () => ({
      get matches() {
        return ridotto;
      },
      addEventListener: (_: string, f: (e: { matches: boolean }) => void) => ascoltatori.add(f),
      removeEventListener: (_: string, f: (e: { matches: boolean }) => void) => ascoltatori.delete(f),
    }));
    const t = manuale();
    expect(t.ctx.ridotto).toBe(false);
    ridotto = true;
    for (const f of [...ascoltatori]) f({ matches: true });
    expect(t.ctx.ridotto).toBe(true);
    ridotto = false;
    for (const f of [...ascoltatori]) f({ matches: false });
    expect(t.ctx.ridotto).toBe(false);
    t.distruggi();
    teatro = null;
    expect(ascoltatori.size).toBe(0);
  });
});

describe('teatro: adatta', () => {
  it("l'ingrandimento della mano (--kd) resta una variabile CSS; scala e spostamento (--s, --sy) non servono più", () => {
    const t = manuale();
    const schermo = radice.querySelector<HTMLElement>('.schermo')!;
    Object.defineProperty(schermo, 'clientWidth', { configurable: true, value: 780 });
    Object.defineProperty(schermo, 'clientHeight', { configurable: true, value: 1800 });
    t.adatta();
    const scena = radice.querySelector<HTMLElement>('.scena')!;
    expect(scena.style.getPropertyValue('--kd')).not.toBe('');
    expect(scena.style.getPropertyValue('--s')).toBe('');
    expect(scena.style.getPropertyValue('--sy')).toBe('');
  });
});

describe('teatro: allinea', () => {
  it('prima fotografia: agnellini come la fotografia e chi sta in basso giusto', () => {
    const t = manuale();
    const f = foto(partita(), 'g2');
    t.allinea(f, 'calmo');
    const s = t.stato();
    expect(s.n).toBe(3);
    expect(s.inBasso).toBe('g2');
    expect(s.agnellini).toEqual(attesi(f));
    expect(s.inViaggio).toBe(0);
    expect(radice.querySelectorAll('.mondo')).toHaveLength(1);
    expect(radice.querySelectorAll('.recinto')).toHaveLength(6);
    expect(radice.querySelectorAll('.pecora').length).toBeGreaterThanOrEqual(3);
    // I cartelli dicono i conti della fotografia
    const cartello = radice.querySelector<HTMLElement>('.cartello[data-chi="g2"]');
    expect(cartello?.textContent).toBe(`${f.posti[0]!.agnellini}/${f.postiOvile}`);
  });

  it('calmo: gli assegnati cambiano subito, i mostrati quando gli agnellini arrivano', () => {
    const t = manuale();
    const a = foto(partita());
    t.allinea(a, 'calmo');
    const b = dalGregge(a, 'g1', 3);
    t.allinea(b, 'calmo');
    let s = t.stato();
    expect(s.agnellini.g1!.assegnati).toBe(a.posti[0]!.agnellini + 3);
    expect(s.agnellini.gregge!.assegnati).toBe(a.gregge - 3);
    expect(s.agnellini.g1!.mostrati).toBe(a.posti[0]!.agnellini);
    expect(s.inViaggio).toBe(3);
    t.avanza(4000);
    s = t.stato();
    expect(s.agnellini).toEqual(attesi(b));
    expect(s.inViaggio).toBe(0);
    const cartello = radice.querySelector<HTMLElement>('.cartello[data-chi="g1"]');
    expect(cartello?.textContent).toBe(`${b.posti[0]!.agnellini}/${b.postiOvile}`);
  });

  it('metà movimento e cambio di chi sta in basso: nessun agnellino perso o duplicato', () => {
    const t = manuale();
    const iniziale = foto(partita());
    t.allinea(iniziale, 'calmo');
    const a = dalGregge(iniziale, 'g1', 3);
    t.allinea(a, 'calmo');
    t.avanza(300);
    expect(t.stato().inViaggio).toBeGreaterThan(0);
    const b = ruota(dalGregge(a, 'g2', 2), 'g2');
    t.allinea(b, 'calmo');
    t.avanza(4000);
    const s = t.stato();
    expect(s.inBasso).toBe('g2');
    expect(s.agnellini).toEqual(attesi(b));
    expect(s.inViaggio).toBe(0);
    expect(s.intrappolati).toBe(0);
    const totale = Object.values(s.agnellini).reduce((m, c) => m + c.assegnati, 0);
    expect(totale).toBe(iniziale.totaleAgnellini);
    expect(radice.querySelectorAll('.agn').length).toBe(iniziale.totaleAgnellini);
    for (const p of b.posti) {
      expect(radice.querySelector<HTMLElement>(`.cartello[data-chi="${p.id}"]`)?.textContent).toBe(`${p.agnellini}/${b.postiOvile}`);
    }
  });

  it('mano coperta: 5 dorsi e nessun nome di carta nella mano', () => {
    const t = manuale();
    const s = partita();
    const f = foto(s);
    const coperta: Fotografia = { ...f, mano: null, posti: f.posti.map((p, i) => (i === 0 ? { ...p, carteInMano: 5 } : p)) };
    t.allinea(coperta, 'calmo');
    const mano = radice.querySelector<HTMLElement>('.mano')!;
    expect(mano.querySelectorAll('.cm.dorso')).toHaveLength(5);
    expect(mano.querySelectorAll('[aria-label]')).toHaveLength(0);
    const nomi = s.giocatori.flatMap((g) => g.mano).map((id) => defCarta(id).nome);
    expect(nomi.length).toBeGreaterThan(0);
    for (const nome of nomi) expect(mano.innerHTML).not.toContain(nome);
  });

  it('da mano scoperta a mano coperta (calmo): a fine movimento nessun fantasma e nessun nome di carta privata, in tutto il teatro', () => {
    const t = manuale();
    const s = partita();
    const mio = s.giocatori[0]!.mano;
    const f = foto(s);
    t.allinea({ ...f, mano: mio }, 'calmo');
    expect(radice.querySelectorAll('.mano .cm:not(.dorso)').length).toBe(mio.length);
    const coperta: Fotografia = { ...f, mano: null, posti: f.posti.map((p, i) => (i === 0 ? { ...p, carteInMano: mio.length } : p)) };
    t.allinea(coperta, 'calmo');
    t.avanza(1000);
    expect(radice.querySelectorAll('.fantasma')).toHaveLength(0);
    expect(radice.querySelectorAll('.mano .cm.dorso')).toHaveLength(mio.length);
    // Pubbliche: angoli, scarti, Guaio del round, carte scoperte del round. Il resto della mano non si deve leggere da nessuna parte
    const pubbliche = new Set<string>([
      ...coperta.posti.flatMap((p) => p.angolo),
      ...coperta.scarti,
      ...(coperta.guaioRound ? [coperta.guaioRound] : []),
      ...coperta.posti.flatMap((p) => (p.giocata && !p.giocata.coperta ? p.giocata.carte : [])),
    ]);
    const private_ = mio.filter((id) => !pubbliche.has(id));
    expect(private_.length).toBeGreaterThan(0);
    const html = radice.innerHTML;
    for (const id of private_) {
      expect(html, defCarta(id).nome).not.toContain(defCarta(id).nome);
      expect(html, id).not.toContain(id);
    }
  });

  it('calmo: le carte nuove della mano compaiono con una dissolvenza di 200 ms', () => {
    const t = manuale();
    const s = partita();
    const mio = s.giocatori[0]!.mano;
    const f = foto(s);
    t.allinea({ ...f, mano: mio.slice(0, 2) }, 'calmo');
    const anima = vi.spyOn(piattaforma, 'anima');
    t.allinea({ ...f, mano: mio.slice(0, 3) }, 'calmo');
    const dissolvenze = anima.mock.calls.filter(([el, , o]) => (el as Element).classList.contains('cm') && o.duration === 200);
    expect(dissolvenze).toHaveLength(1);
  });
});

describe('teatro: la carta pescata si muove una volta', () => {
  const unaVolta = () => radice.querySelectorAll('.mano .una-volta').length;
  const preparo = (modo: 'calmo' | 'subito' | 'recita') => {
    const t = manuale();
    const s = partita();
    const mio = s.giocatori[0]!.mano;
    const f = foto(s);
    t.allinea({ ...f, mano: mio.slice(0, 2) }, 'calmo');
    const nuova = { ...f, mano: mio.slice(0, 3) };
    if (modo === 'recita') t.recita(nuova, vistaPer(s, null), { subito: true });
    else t.allinea(nuova, modo);
  };

  it('pesca normale: la carta nuova prende la classe una-volta', () => {
    preparo('calmo');
    expect(unaVolta()).toBe(1);
  });

  it('allineamento subito: le carte nuove restano ferme', () => {
    preparo('subito');
    expect(radice.querySelectorAll('.mano .cm')).toHaveLength(3);
    expect(unaVolta()).toBe(0);
  });

  it("recita con subito (ritorno da un'altra scheda): le carte nuove restano ferme", () => {
    preparo('recita');
    expect(radice.querySelectorAll('.mano .cm')).toHaveLength(3);
    expect(unaVolta()).toBe(0);
  });
});

describe('teatro: tocchi', () => {
  it('un tocco sul prato durante un evento lo salta; sulla coperta no', () => {
    const t = manuale();
    t.allinea(foto(partita()), 'calmo');
    const chiudi = t.ctx.regia.apriEvento('prova');
    evento('pointerdown', radice.querySelector('.coperta')!);
    expect(t.ctx.regia.salto).toBe(false);
    evento('pointerdown', radice.querySelector('.mondo')!);
    expect(t.ctx.regia.salto).toBe(true);
    chiudi();
    // Finiti gli eventi il salto si spegne da solo
    t.avanza(33);
    expect(t.ctx.regia.salto).toBe(false);
  });

  it('senza evento un tocco sul prato non salta niente', () => {
    const t = manuale();
    t.allinea(foto(partita()), 'calmo');
    evento('pointerdown', radice.querySelector('.mondo')!);
    expect(t.ctx.regia.salto).toBe(false);
  });

  it('un tocco sulla scena abbassa la carta sollevata', () => {
    const t = manuale();
    const s = partita();
    t.allinea({ ...foto(s), mano: s.giocatori[0]!.mano }, 'calmo');
    const carta = radice.querySelector<HTMLElement>('.mano .cm')!;
    evento('pointerdown', carta);
    evento('pointerup', carta);
    expect(carta.classList.contains('attiva')).toBe(true);
    evento('pointerdown', radice.querySelector('.mondo')!);
    expect(carta.classList.contains('attiva')).toBe(false);
  });

  it('un tocco sui pannelli Opzioni e Prova eventi non salta l\'evento (bozza, riga 387)', () => {
    const t = manuale();
    t.allinea(foto(partita()), 'calmo');
    const ui = radice.querySelector('.ui')!;
    const chiudi = t.ctx.regia.apriEvento('prova');
    for (const classe of ['opzioni', 'eventi']) {
      const pannello = ui.appendChild(document.createElement('div'));
      pannello.className = classe;
      evento('pointerdown', pannello.appendChild(document.createElement('button')));
      expect(t.ctx.regia.salto, classe).toBe(false);
    }
    chiudi();
  });

  it('rivediSuggerimenti rimette il primo suggerimento e toglie il segno dei visti', () => {
    localStorage.setItem('hls-consigli-visti', '3');
    const t = manuale();
    const consiglio = radice.querySelector<HTMLElement>('.consiglio')!;
    expect(consiglio.style.opacity).toBe('0');
    t.rivediSuggerimenti();
    expect(consiglio.style.opacity).toBe('1');
    expect(localStorage.getItem('hls-consigli-visti')).toBeNull();
  });

  it('qualsiasi tocco sveglia la scena dal riposo', () => {
    const t = manuale();
    t.allinea(foto(partita()), 'calmo');
    t.ctx.risparmio.riposo = true;
    evento('pointerdown', document.body);
    expect(t.ctx.risparmio.riposo).toBe(false);
  });
});

describe('teatro: ciclo automatico', () => {
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
    const fotogramma = (ora: number) => {
      const richieste = [...coda];
      coda.clear();
      for (const [, cb] of richieste) cb(ora);
    };
    return { coda, fotogramma };
  }

  it("ritorno da un'altra scheda: un fotogramma 10 s dopo fa avanzare l'orologio di al più 250 ms", () => {
    const raf = rafFinto();
    const t = (teatro = creaTeatro(radice, { ambiente: false, caso: casoConSeme(3) }));
    t.allinea(foto(partita()), 'calmo');
    expect(raf.coda.size).toBe(1);
    raf.fotogramma(1016);
    const prima = t.ctx.orologio.ms;
    expect(prima).toBeGreaterThan(0);
    const T0 = t.ctx.T;
    raf.fotogramma(11016);
    const passo = t.ctx.orologio.ms - prima;
    expect(passo).toBeGreaterThan(0);
    expect(passo).toBeLessThanOrEqual(250 * t.ctx.orologio.velocita);
    expect(t.ctx.T - T0).toBeLessThanOrEqual(0.25 * t.ctx.orologio.velocita + 1e-9);
    expect(raf.coda.size).toBe(1);
  });

  it('visibilitychange riallinea l\'istante dell\'ultimo fotogramma', () => {
    const raf = rafFinto();
    const t = (teatro = creaTeatro(radice, { ambiente: false, caso: casoConSeme(3) }));
    t.allinea(foto(partita()), 'calmo');
    raf.fotogramma(1016);
    const prima = t.ctx.orologio.ms;
    // La pagina torna visibile a 50 s: il fotogramma subito dopo conta 16 ms, non 49 s
    vi.spyOn(performance, 'now').mockReturnValue(50_000);
    document.dispatchEvent(new Event('visibilitychange'));
    // Un tocco al ritorno: senza, dopo 49 s senza tocchi la scena sarebbe a riposo
    evento('pointerdown', document.body);
    raf.fotogramma(50_016);
    expect(t.ctx.orologio.ms - prima).toBeCloseTo(16, 5);
  });
});

describe('teatro: distruggi', () => {
  it('toglie ogni ascoltatore, il ciclo e svuota la radice; poi gli altri metodi non fanno niente', async () => {
    vi.resetModules();
    localStorage.setItem('hls-opzioni', JSON.stringify({ suoni: true, vibrazione: true, veloci: false }));
    const { creaTeatro: crea } = await import('./teatro');
    const coda = new Map<number, FrameRequestCallback>();
    let prossimo = 1;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      coda.set(prossimo, cb);
      return prossimo++;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      coda.delete(id);
    });
    type Voce = [EventTarget, string, unknown, boolean];
    const aggiunti: Voce[] = [];
    const tolti: Voce[] = [];
    const cattura = (o: unknown) => (typeof o === 'boolean' ? o : !!(o as AddEventListenerOptions | undefined)?.capture);
    for (const bersaglio of [window, document] as EventTarget[]) {
      const add = bersaglio.addEventListener.bind(bersaglio);
      const rem = bersaglio.removeEventListener.bind(bersaglio);
      vi.spyOn(bersaglio, 'addEventListener').mockImplementation((tipo, fn, o) => {
        aggiunti.push([bersaglio, tipo, fn, cattura(o)]);
        add(tipo, fn, o);
      });
      vi.spyOn(bersaglio, 'removeEventListener').mockImplementation((tipo, fn, o) => {
        tolti.push([bersaglio, tipo, fn, cattura(o)]);
        rem(tipo, fn, o);
      });
    }
    const t = crea(radice, { ambiente: false, caso: casoConSeme(3) });
    t.allinea(foto(partita()), 'calmo');
    const tipi = new Set(aggiunti.map((v) => v[1]));
    for (const tipo of ['resize', 'pointerdown', 'visibilitychange', 'pointerup']) expect(tipi).toContain(tipo);
    expect(coda.size).toBe(1);
    t.distruggi();
    for (const [b, tipo, fn, c] of aggiunti) {
      expect(tolti.some(([b2, tipo2, fn2, c2]) => b2 === b && tipo2 === tipo && fn2 === fn && c2 === c), `${tipo} non tolto`).toBe(true);
    }
    expect(coda.size).toBe(0);
    expect(radice.childElementCount).toBe(0);
    expect(t.ctx.orologio.inSospeso()).toBe(0);
    expect(() => t.allinea(foto(partita()), 'calmo')).not.toThrow();
    expect(() => t.avanza(100)).not.toThrow();
    expect(() => t.salta()).not.toThrow();
    expect(() => t.distruggi()).not.toThrow();
    expect(radice.childElementCount).toBe(0);
  });

  it("con l'ambiente: costruzione, cambio di giocatori, avanzamento e distruzione senza errori", () => {
    const errori = vi.spyOn(console, 'error');
    const t = (teatro = creaTeatro(radice, { ciclo: 'manuale', caso: casoConSeme(3) }));
    t.allinea(foto(partita()), 'calmo');
    t.avanza(1000);
    const due = nuovaPartita({ giocatori: GIOCATORI.slice(0, 2), seme: 9 });
    t.allinea(foto(due), 'calmo');
    t.avanza(1000);
    expect(t.stato().n).toBe(2);
    expect(radice.querySelectorAll('.recinto')).toHaveLength(4);
    t.distruggi();
    expect(radice.childElementCount).toBe(0);
    expect(errori).not.toHaveBeenCalled();
  });

  it('due teatri di fila sulla stessa radice: il secondo funziona e c\'è un solo .mondo', () => {
    const primo = creaTeatro(radice, { ciclo: 'manuale', ambiente: false, caso: casoConSeme(3) });
    primo.allinea(foto(partita()), 'calmo');
    primo.distruggi();
    const t = manuale();
    const a = foto(partita());
    t.allinea(a, 'calmo');
    const b = dalGregge(a, 'g1', 2);
    t.allinea(b, 'calmo');
    t.avanza(4000);
    expect(t.stato().agnellini).toEqual(attesi(b));
    expect(radice.querySelectorAll('.mondo')).toHaveLength(1);
    expect(radice.querySelectorAll('.agn').length).toBe(a.totaleAgnellini);
  });
});

describe('teatro: un fotogramma rotto', () => {
  function rafFinto() {
    let cb: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (c: FrameRequestCallback) => {
      cb = c;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {
      cb = null;
    });
    vi.spyOn(performance, 'now').mockReturnValue(1000);
    let ora = 1000;
    return {
      richiesto: () => cb !== null,
      corri(ms: number) {
        for (let t = 0; t < ms; t += 16) {
          ora += 16;
          const c = cb;
          cb = null;
          c?.(ora);
        }
      },
    };
  }

  it('lancia una volta: il ciclo va avanti, gli agnellini arrivano e i conti coincidono con la fotografia', () => {
    const raf = rafFinto();
    const errori = vi.spyOn(console, 'error').mockImplementation(() => {});
    const t = (teatro = creaTeatro(radice, { ambiente: false, caso: casoConSeme(3) }));
    const a = foto(partita());
    t.allinea(a, 'calmo');
    const b = dalGregge(a, 'g1', 3);
    t.allinea(b, 'calmo');
    vi.spyOn(t.ctx.orologio, 'avanza').mockImplementationOnce(() => {
      throw new Error('fotogramma rotto');
    });
    raf.corri(16);
    expect(errori).toHaveBeenCalledTimes(1);
    expect(raf.richiesto()).toBe(true);
    // Messo in pari subito con l'ultima fotografia
    expect(t.stato().agnellini).toEqual(attesi(b));
    // Il ciclo continua davvero: un nuovo movimento arriva a destinazione
    const c = dalGregge(b, 'g2', 2);
    t.allinea(c, 'calmo');
    expect(t.stato().inViaggio).toBe(2);
    raf.corri(4000);
    expect(t.stato().agnellini).toEqual(attesi(c));
    expect(t.stato().inViaggio).toBe(0);
    expect(errori).toHaveBeenCalledTimes(1);
  });

  it('se lancia a ogni fotogramma l\'errore si scrive una volta sola e il ciclo resta vivo', () => {
    const raf = rafFinto();
    const errori = vi.spyOn(console, 'error').mockImplementation(() => {});
    const t = (teatro = creaTeatro(radice, { ambiente: false, caso: casoConSeme(3) }));
    t.allinea(foto(partita()), 'calmo');
    vi.spyOn(t.ctx.orologio, 'avanza').mockImplementation(() => {
      throw new Error('sempre rotto');
    });
    raf.corri(160);
    expect(errori).toHaveBeenCalledTimes(1);
    expect(raf.richiesto()).toBe(true);
  });
});

describe('teatro: audio', () => {
  it('sospendi(true) sospende anche l\'audio; sospendi(false) lo riprende solo con i suoni accesi nelle Opzioni', async () => {
    const sospendi = vi.spyOn(Suono, 'sospendi').mockImplementation(() => undefined);
    const riprendi = vi.spyOn(Suono, 'riprendi').mockImplementation(() => undefined);
    vi.spyOn(Suono, 'ferma').mockImplementation(() => undefined);
    const prima = opzioni().suoni;
    const t = (teatro = creaTeatro(radice, { ambiente: false, caso: casoConSeme(3) }));
    t.sospendi(true);
    expect(sospendi).toHaveBeenCalledTimes(1);
    opzioni().suoni = false;
    t.sospendi(false);
    expect(riprendi).not.toHaveBeenCalled();
    t.sospendi(true);
    opzioni().suoni = true;
    t.sospendi(false);
    expect(riprendi).toHaveBeenCalledTimes(1);
    opzioni().suoni = prima;
  });

  it('distruggi ferma l\'audio; dopo, sospendi non lo tocca più', async () => {
    const ferma = vi.spyOn(Suono, 'ferma').mockImplementation(() => undefined);
    const sospendi = vi.spyOn(Suono, 'sospendi').mockImplementation(() => undefined);
    const t = creaTeatro(radice, { ambiente: false, caso: casoConSeme(3) });
    t.distruggi();
    expect(ferma).toHaveBeenCalledTimes(1);
    t.sospendi(true);
    expect(sospendi).not.toHaveBeenCalled();
  });
});
