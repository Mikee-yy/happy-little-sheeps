// @vitest-environment jsdom
// Prove dei servizi della scena. Dalle prove della bozza: provaOpzioni, provaSalto, provaRisparmio, provaVibrazione.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Orologio } from '../orologio';
import { T } from '../../testi';

/** Moduli nuovi di zecca: le opzioni sono una sola per pagina, quindi tra una prova e l'altra si ricaricano. */
async function carica() {
  vi.resetModules();
  const opzioni = await import('./opzioni');
  const regia = await import('./regia');
  const suoni = await import('./suoni');
  const risparmio = await import('./risparmio');
  const consigli = await import('./consigli');
  const scheletro = await import('../scheletro');
  return { opzioni, regia, suoni, risparmio, consigli, scheletro };
}

function regiaDi(m: Awaited<ReturnType<typeof carica>>, extra: { meteo?: boolean } = {}) {
  const orologio = new Orologio();
  const regia = m.regia.creaRegia({ orologio, meteoAttivo: () => !!extra.meteo, inViaggioValido: () => true });
  return { orologio, regia };
}

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('opzioni', () => {
  it('le predefinite sono suoni spenti, vibrazione accesa, animazioni normali', async () => {
    const m = await carica();
    expect(m.opzioni.leggiOpzioni()).toEqual({ suoni: false, vibrazione: true, veloci: false });
    expect(m.opzioni.opzioni()).toEqual({ suoni: false, vibrazione: true, veloci: false });
  });

  it("cambiaOpzione('veloci') cambia, salva in hls-opzioni e avvisa gli ascoltatori", async () => {
    const m = await carica();
    const cb = vi.fn();
    const smetti = m.opzioni.ascoltaOpzioni(cb);
    m.opzioni.cambiaOpzione('veloci');
    expect(m.opzioni.opzioni().veloci).toBe(true);
    expect(JSON.parse(localStorage.getItem('hls-opzioni') ?? 'null')).toEqual({ suoni: false, vibrazione: true, veloci: true });
    expect(cb).toHaveBeenCalledTimes(1);
    smetti();
    m.opzioni.cambiaOpzione('veloci');
    expect(cb).toHaveBeenCalledTimes(1);
    expect(m.opzioni.leggiOpzioni().veloci).toBe(false);
  });

  it('con il salvataggio bloccato valgono le predefinite e cambiaOpzione non lancia', async () => {
    const m = await carica();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloccato');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloccato');
    });
    expect(m.opzioni.leggiOpzioni()).toEqual({ suoni: false, vibrazione: true, veloci: false });
    expect(() => m.opzioni.cambiaOpzione('veloci')).not.toThrow();
    expect(m.opzioni.opzioni().veloci).toBe(true);
  });

  it('con JSON rotto valgono le predefinite', async () => {
    localStorage.setItem('hls-opzioni', '{non json');
    const m = await carica();
    expect(m.opzioni.leggiOpzioni()).toEqual({ suoni: false, vibrazione: true, veloci: false });
    expect(m.opzioni.opzioni()).toEqual({ suoni: false, vibrazione: true, veloci: false });
  });

  it("preparaSbloccoAudio restituisce la pulizia che toglie gli ascoltatori", async () => {
    const m = await carica();
    const aggiunti: string[] = [];
    const tolti: string[] = [];
    vi.spyOn(window, 'addEventListener').mockImplementation(((t: string) => void aggiunti.push(t)) as never);
    vi.spyOn(window, 'removeEventListener').mockImplementation(((t: string) => void tolti.push(t)) as never);
    const pulisci = m.opzioni.preparaSbloccoAudio({ accendi() {}, ctx: null });
    expect(aggiunti.sort()).toEqual(['click', 'pointerup', 'touchend']);
    pulisci();
    expect(tolti.sort()).toEqual(['click', 'pointerup', 'touchend']);
  });
});

describe('regia', () => {
  it('senza eventi la velocità è 1, anche con le animazioni veloci', async () => {
    const m = await carica();
    m.opzioni.cambiaOpzione('veloci');
    const { regia } = regiaDi(m);
    expect(regia.eventoInCorso()).toBe(false);
    expect(regia.velocita()).toBe(1);
  });

  it('con un evento aperto e veloci acceso la velocità è 2; senza veloci è 1', async () => {
    const m = await carica();
    const { regia } = regiaDi(m);
    const chiudi = regia.apriEvento('guaio');
    expect(regia.velocita()).toBe(1);
    m.opzioni.cambiaOpzione('veloci');
    expect(regia.velocita()).toBe(2);
    chiudi();
    expect(regia.velocita()).toBe(1);
  });

  it('dopo salta() la velocità è 6; salta() senza eventi non fa niente', async () => {
    const m = await carica();
    const { regia } = regiaDi(m);
    regia.salta();
    expect(regia.salto).toBe(false);
    regia.apriEvento('dado');
    regia.salta();
    expect(regia.salto).toBe(true);
    expect(regia.velocita()).toBe(6);
  });

  it('chiudere l\'evento due volte non porta aperti sotto 0', async () => {
    const m = await carica();
    const { regia } = regiaDi(m);
    const a = regia.apriEvento('a');
    const b = regia.apriEvento('b');
    a();
    a();
    expect(regia.aperti).toBe(1);
    b();
    b();
    expect(regia.aperti).toBe(0);
  });

  it('conEvento chiude anche su promessa rifiutata e su eccezione', async () => {
    const m = await carica();
    const { regia } = regiaDi(m);
    const rifiuta = regia.conEvento('x', async () => {
      throw new Error('no');
    });
    const p = rifiuta();
    expect(regia.aperti).toBe(1);
    await expect(p).rejects.toThrow('no');
    expect(regia.aperti).toBe(0);
    const lancia = regia.conEvento('y', () => {
      throw new Error('subito');
    });
    expect(() => lancia()).toThrow('subito');
    expect(regia.aperti).toBe(0);
    const ok = regia.conEvento('z', (a: number) => a * 2);
    expect(ok(4)).toBe(8);
    expect(regia.aperti).toBe(0);
  });

  it('un evento è in corso anche per meteo, timer dell\'orologio e agnellini in viaggio validi', async () => {
    const m = await carica();
    const orologio = new Orologio();
    let meteo = false;
    const validi = new Set<unknown>();
    const regia = m.regia.creaRegia({ orologio, meteoAttivo: () => meteo, inViaggioValido: (g) => validi.has(g) });
    expect(regia.eventoInCorso()).toBe(false);
    meteo = true;
    expect(regia.eventoInCorso()).toBe(true);
    meteo = false;
    const id = orologio.dopo(() => undefined, 500);
    expect(regia.eventoInCorso()).toBe(true);
    orologio.annulla(id);
    const g = {};
    regia.inViaggio.add(g);
    expect(regia.eventoInCorso()).toBe(false); // non valido: ripulito
    expect(regia.inViaggio.size).toBe(0);
    validi.add(g);
    regia.inViaggio.add(g);
    expect(regia.eventoInCorso()).toBe(true);
    validi.delete(g);
    expect(regia.eventoInCorso()).toBe(false);
    expect(regia.inViaggio.size).toBe(0);
  });
});

describe('suoni', () => {
  function suonoFinto() {
    return { attivo: true, ctx: {} as AudioContext, pop: vi.fn(), pioggiaFine: vi.fn(), tonfo: vi.fn() };
  }

  it("durante il salto suona('pop') tace e suona('pioggiaFine') no", async () => {
    const m = await carica();
    const { regia } = regiaDi(m);
    const s = suonoFinto();
    const { suona } = m.suoni.creaSuoni(regia, s as never);
    suona('pop');
    expect(s.pop).toHaveBeenCalledTimes(1);
    regia.apriEvento('x');
    regia.salta();
    suona('pop');
    suona('pioggiaFine');
    expect(s.pop).toHaveBeenCalledTimes(1);
    expect(s.pioggiaFine).toHaveBeenCalledTimes(1);
  });

  it('suona non fa niente se l\'audio non è acceso, e passa gli argomenti', async () => {
    const m = await carica();
    const { regia } = regiaDi(m);
    const s = suonoFinto();
    s.attivo = false;
    const { suona } = m.suoni.creaSuoni(regia, s as never);
    suona('tonfo', 1, 2);
    expect(s.tonfo).not.toHaveBeenCalled();
    s.attivo = true;
    suona('tonfo', 1, 2);
    expect(s.tonfo).toHaveBeenCalledWith(1, 2);
  });

  it('suona non lancia se il suono lancia', async () => {
    const m = await carica();
    const { regia } = regiaDi(m);
    const s = suonoFinto();
    s.pop.mockImplementation(() => {
      throw new Error('audio');
    });
    const { suona } = m.suoni.creaSuoni(regia, s as never);
    expect(() => suona('pop')).not.toThrow();
  });
});

describe('vibrazione', () => {
  async function conVibrazione() {
    const m = await carica();
    const vibrate = vi.fn();
    vi.stubGlobal('navigator', { userAgent: 'jsdom', vibrate });
    const { regia } = regiaDi(m);
    const { vibra } = m.suoni.creaSuoni(regia);
    return { m, vibra, vibrate };
  }

  it("vibra('guaio') chiama navigator.vibrate([60, 50, 60])", async () => {
    const { vibra, vibrate } = await conVibrazione();
    vibra('guaio');
    expect(vibrate).toHaveBeenCalledWith([60, 50, 60]);
    vibra('beeeNo');
    expect(vibrate).toHaveBeenLastCalledWith([140]);
    vibra('vittoria');
    expect(vibrate).toHaveBeenLastCalledWith([80, 60, 80, 60, 220]);
  });

  it('con la vibrazione spenta non chiama niente', async () => {
    const { m, vibra, vibrate } = await conVibrazione();
    m.opzioni.cambiaOpzione('vibrazione');
    expect(m.opzioni.opzioni().vibrazione).toBe(false);
    vibra('guaio');
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('senza navigator.vibrate non lancia', async () => {
    const m = await carica();
    const { regia } = regiaDi(m);
    const { vibra } = m.suoni.creaSuoni(regia);
    expect(() => vibra('guaio')).not.toThrow();
  });
});

describe('risparmio', () => {
  /** Fotogrammi a intervalli fissi di `passoMs` per `durataMs`, partendo da 1000 ms (0 vale "non iniziato"). */
  function gira(r: { misuraFluidita(o: number, dt: number): void }, passoMs: number, durataMs: number): void {
    for (let t = 0; t <= durataMs; t += passoMs) r.misuraFluidita(1000 + t, passoMs / 1000);
  }

  it('5 secondi di fila sotto i 30 fotogrammi accendono leggero e la classe sulla scena', async () => {
    const m = await carica();
    const scena = document.createElement('div');
    const r = m.risparmio.creaRisparmio(scena);
    expect(r.limiteParticelle()).toBe(140);
    gira(r, 40, 6000); // 25 fotogrammi al secondo
    expect(r.leggero).toBe(true);
    expect(scena.classList.contains('leggero')).toBe(true);
    expect(r.limiteParticelle()).toBe(60);
  });

  it('a 35 fotogrammi al secondo resta normale', async () => {
    const m = await carica();
    const scena = document.createElement('div');
    const r = m.risparmio.creaRisparmio(scena);
    gira(r, 28, 8000);
    expect(r.leggero).toBe(false);
    expect(scena.classList.contains('leggero')).toBe(false);
  });

  it('il primo fotogramma non conta come secondo lento', async () => {
    const m = await carica();
    const r = m.risparmio.creaRisparmio(document.createElement('div'));
    r.misuraFluidita(1000, 0.016);
    expect(r.secondiLenti).toBe(0);
    expect(r.finestra.fotogrammi).toBe(0);
    // dopo un secondo con un solo fotogramma si conta un secondo lento (ma uno solo)
    r.misuraFluidita(2000, 0.016);
    expect(r.secondiLenti).toBe(1);
  });

  it('un fotogramma lunghissimo (ritorno da un\'altra scheda) non conta come lento', async () => {
    const m = await carica();
    const r = m.risparmio.creaRisparmio(document.createElement('div'));
    r.misuraFluidita(1000, 0.016);
    r.misuraFluidita(4000, 3);
    expect(r.secondiLenti).toBe(0);
    expect(r.leggero).toBe(false);
  });

  it('dopo 20 s senza tocchi né eventi la scena va a riposo, un tocco la sveglia', async () => {
    const m = await carica();
    const r = m.risparmio.creaRisparmio(document.createElement('div'));
    r.tocco(1000);
    r.valutaRiposo(10000, false);
    expect(r.riposo).toBe(false);
    r.valutaRiposo(21001, false);
    expect(r.riposo).toBe(true);
    r.valutaRiposo(30000, true); // un evento conta come attività
    expect(r.riposo).toBe(false);
    r.valutaRiposo(60000, false);
    expect(r.riposo).toBe(true);
    r.tocco(60001);
    expect(r.riposo).toBe(false);
  });
});

describe('consigli', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function preparati(m: Awaited<ReturnType<typeof carica>>) {
    const elemento = document.createElement('div');
    const c = m.consigli.creaConsigli({ elemento });
    return { elemento, c };
  }

  it('i consigli sono quelli dei testi', async () => {
    const m = await carica();
    expect(m.consigli.CONSIGLI).toEqual([T.scena.consigli.solleva, T.scena.consigli.leggi, T.scena.consigli.trascina]);
  });

  it('rivediSuggerimenti toglie la chiave e mostra il primo consiglio', async () => {
    const m = await carica();
    const { elemento, c } = preparati(m);
    localStorage.setItem('hls-consigli-visti', '1');
    expect(c.giaVisti()).toBe(true);
    c.rivediSuggerimenti();
    expect(localStorage.getItem('hls-consigli-visti')).toBeNull();
    expect(c.giaVisti()).toBe(false);
    expect(elemento.textContent).toBe(T.scena.consigli.solleva);
    expect(elemento.style.opacity).toBe('1');
  });

  it('passo dopo passo: il secondo consiglio compare, poi il terzo, che sparisce e la chiave vale 1', async () => {
    const m = await carica();
    const { elemento, c } = preparati(m);
    c.rivediSuggerimenti();
    c.nascondi(1);
    expect(elemento.style.opacity).toBe('0');
    vi.advanceTimersByTime(500);
    expect(elemento.textContent).toBe(T.scena.consigli.leggi);
    expect(elemento.style.opacity).toBe('1');
    // il secondo non sparisce da solo
    vi.advanceTimersByTime(20000);
    expect(elemento.textContent).toBe(T.scena.consigli.leggi);
    expect(elemento.style.opacity).toBe('1');
    expect(localStorage.getItem('hls-consigli-visti')).toBeNull();
    c.nascondi(2);
    vi.advanceTimersByTime(500);
    expect(elemento.textContent).toBe(T.scena.consigli.trascina);
    expect(elemento.style.opacity).toBe('1');
    expect(localStorage.getItem('hls-consigli-visti')).toBeNull();
    vi.advanceTimersByTime(7500);
    expect(elemento.style.opacity).toBe('0');
    expect(localStorage.getItem('hls-consigli-visti')).toBe('1');
  });

  it('il terzo consiglio si supera con la prima carta giocata trascinando (nascondi(3))', async () => {
    const m = await carica();
    const { elemento, c } = preparati(m);
    c.rivediSuggerimenti();
    c.nascondi(2);
    vi.advanceTimersByTime(500);
    expect(elemento.textContent).toBe(T.scena.consigli.trascina);
    c.nascondi(3);
    expect(elemento.style.opacity).toBe('0');
    expect(localStorage.getItem('hls-consigli-visti')).toBe('1');
  });

  it('nascondi(3) subito: tutti visti, chiave 1; non va indietro', async () => {
    const m = await carica();
    const { c } = preparati(m);
    c.nascondi(3);
    expect(localStorage.getItem('hls-consigli-visti')).toBe('1');
    c.nascondi(1);
    expect(c.passo).toBe(3);
  });

  it('se bloccato non nasconde; applicaGiaVisti spegne tutto', async () => {
    const m = await carica();
    const elemento = document.createElement('div');
    let bloccato = true;
    const c = m.consigli.creaConsigli({ elemento, bloccato: () => bloccato });
    c.nascondi(1);
    expect(c.passo).toBe(0);
    bloccato = false;
    localStorage.setItem('hls-consigli-visti', '1');
    c.applicaGiaVisti();
    expect(c.passo).toBe(m.consigli.CONSIGLI.length);
    expect(elemento.style.opacity).toBe('0');
  });

  it('i consigli non contano come evento in corso (tempo vero, non orologio della scena)', async () => {
    const m = await carica();
    const { regia, orologio } = regiaDi(m);
    const { c } = preparati(m);
    c.rivediSuggerimenti();
    c.nascondi(1);
    expect(regia.eventoInCorso()).toBe(false);
    expect(orologio.inSospeso()).toBe(0);
    vi.advanceTimersByTime(500);
    expect(regia.eventoInCorso()).toBe(false);
    c.nascondi(2);
    expect(regia.eventoInCorso()).toBe(false);
  });

  it('ferma annulla i timer in sospeso', async () => {
    const m = await carica();
    const { elemento, c } = preparati(m);
    c.rivediSuggerimenti();
    c.nascondi(1);
    c.ferma();
    vi.advanceTimersByTime(10000);
    expect(localStorage.getItem('hls-consigli-visti')).toBeNull();
    expect(elemento.style.opacity).toBe('0');
  });

  it('con il salvataggio bloccato non lancia', async () => {
    const m = await carica();
    const { c } = preparati(m);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('x');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('x');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('x');
    });
    expect(c.giaVisti()).toBe(false);
    expect(() => c.rivediSuggerimenti()).not.toThrow();
    expect(() => c.nascondi(2)).not.toThrow();
  });
});

describe('scheletro', () => {
  it('crea .mondo, .ui, .mano e .mazzo dentro la radice e nessun elemento con id', async () => {
    const m = await carica();
    const radice = document.createElement('div');
    const el = m.scheletro.creaScheletro(radice);
    expect(radice.classList.contains('teatro')).toBe(true);
    for (const classe of ['mondo', 'ui', 'mano', 'mazzo', 'scarti', 'mazzo-guai', 'dado', 'dado-pos', 'coperta', 'camera', 'scena', 'schermo']) {
      expect(radice.querySelector('.' + classe), classe).not.toBeNull();
    }
    expect(radice.querySelectorAll('[id]').length).toBe(0);
    expect(el.mondo).toBe(radice.querySelector('.mondo'));
    expect(el.ui).toBe(radice.querySelector('.ui'));
    expect(el.mano).toBe(radice.querySelector('.mano'));
    expect(el.mazzo).toBe(radice.querySelector('.mazzo'));
    expect(el.mondo.parentElement).toBe(el.camera);
    expect(el.mano.parentElement).toBe(el.ui);
    expect(el.cieloSvg.tagName.toLowerCase()).toBe('svg');
    expect(el.sole.tagName.toLowerCase()).toBe('g');
    expect(el.scoppio.textContent).toContain(T.scena.scoppio);
    expect(el.dicMazzo.textContent).toBe(T.scena.diciture.mazzo);
    expect(el.dicGuai.textContent).toBe(T.scena.diciture.guai);
  });

  it('due teatri nella stessa pagina non si pestano i piedi', async () => {
    const m = await carica();
    const a = document.createElement('div');
    const b = document.createElement('div');
    const ea = m.scheletro.creaScheletro(a);
    const eb = m.scheletro.creaScheletro(b);
    expect(ea.mondo).not.toBe(eb.mondo);
    expect(a.querySelectorAll('.mondo').length).toBe(1);
  });
});

describe('interruttore dei suoni', () => {
  it('il beee di conferma parte passando da suona, quindi tace durante il salto', async () => {
    vi.resetModules();
    const { Suono: S } = await import('./suoni');
    const { cambiaOpzione } = await import('./opzioni');
    const { contestoFinto } = await import('../aiuti-prova');
    const accendi = vi.spyOn(S, 'accendi').mockImplementation(() => {
      S.attivo = true;
      S.ctx = {} as AudioContext;
    });
    const spegni = vi.spyOn(S, 'spegni').mockImplementation(() => {
      S.attivo = false;
    });
    const beee = vi.spyOn(S, 'beee').mockImplementation(() => undefined);
    const ctx = contestoFinto();
    cambiaOpzione('suoni');
    expect(accendi).toHaveBeenCalledTimes(1);
    expect(beee).toHaveBeenCalledTimes(1);
    cambiaOpzione('suoni');
    expect(spegni).toHaveBeenCalledTimes(1);
    ctx.regia.apriEvento('x');
    ctx.regia.salta();
    cambiaOpzione('suoni');
    expect(accendi).toHaveBeenCalledTimes(2);
    expect(beee).toHaveBeenCalledTimes(1);
  });
});

describe('contesto finto', () => {
  it('ha un contesto completo con caso a seme fisso e pulizie', async () => {
    vi.resetModules();
    const { contestoFinto } = await import('../aiuti-prova');
    const a = contestoFinto();
    const b = contestoFinto();
    const sa = [a.caso(), a.caso(), a.caso()];
    const sb = [b.caso(), b.caso(), b.caso()];
    expect(sa).toEqual(sb);
    expect(sa.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(a.T).toBe(0);
    expect(a.sera).toBe(0);
    expect(a.ridotto).toBe(false);
    expect(Array.isArray(a.pulizie)).toBe(true);
    expect(a.el.mondo).toBeTruthy();
    const ani = a.anima(a.el.mondo, [{ opacity: 0 }, { opacity: 1 }], { duration: 100 });
    expect(ani.playbackRate).toBe(1);
    const c = contestoFinto({ caso: () => 0.5 });
    expect(c.caso()).toBe(0.5);
  });

  it('anima dà alle animazioni la velocità della scena, animaInterfaccia no', async () => {
    vi.resetModules();
    const { contestoFinto } = await import('../aiuti-prova');
    const ctx = contestoFinto();
    ctx.orologio.velocita = 2;
    ctx.regia.apriEvento('x');
    const fatte: Array<{ playbackRate: number }> = [];
    const finto = { animate: () => ({ playbackRate: 1, addEventListener() {}, removeEventListener() {} }) };
    const el = Object.assign(document.createElement('div'), finto);
    fatte.push(ctx.anima(el, [], { duration: 1 }));
    fatte.push(ctx.animaInterfaccia(el, [], { duration: 1 }));
    expect(fatte[0]!.playbackRate).toBe(2);
    expect(fatte[1]!.playbackRate).toBe(1);
  });
});

describe('generatore dei suoni: fermo davvero', () => {
  /** Un contesto audio finto con le sole chiamate che il fermo e la ripresa usano. */
  function contestoAudioFinto(suspend: () => unknown = () => Promise.resolve()) {
    const ctx = { currentTime: 0, suspend: vi.fn(suspend), resume: vi.fn(() => Promise.resolve()) };
    const gain = { setTargetAtTime: vi.fn() };
    return { ctx, gain };
  }
  async function generatoreCon(finto: ReturnType<typeof contestoAudioFinto>) {
    const m = await carica();
    const g = new m.suoni.GeneratoreSuoni();
    g.ctx = finto.ctx as unknown as AudioContext;
    g.uscita = { gain: finto.gain } as unknown as GainNode;
    g.attivo = true;
    return g;
  }

  it('ferma() sospende il contesto audio, abbassa il volume e smette il campanaccio periodico', async () => {
    vi.useFakeTimers();
    const finto = contestoAudioFinto();
    const g = await generatoreCon(finto);
    const campanaccio = vi.spyOn(g, 'campanaccio').mockImplementation(() => undefined);
    g.caso = () => 0;
    g.accendi(); // contesto già presente: riparte il campanaccio periodico
    vi.advanceTimersByTime(8000);
    expect(campanaccio).toHaveBeenCalledTimes(1);
    g.ferma();
    expect(finto.ctx.suspend).toHaveBeenCalledTimes(1);
    expect(finto.gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 0, 0.1);
    expect(g.attivo).toBe(false);
    vi.advanceTimersByTime(40_000);
    expect(campanaccio).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('ferma() senza contesto, o con un contesto che rifiuta di sospendersi, non lancia', async () => {
    const m = await carica();
    expect(() => new m.suoni.GeneratoreSuoni().ferma()).not.toThrow();
    const lancia = await generatoreCon(
      contestoAudioFinto(() => {
        throw new Error('chiuso');
      }),
    );
    expect(() => lancia.ferma()).not.toThrow();
    const rifiuta = await generatoreCon(contestoAudioFinto(() => Promise.reject(new Error('chiuso'))));
    expect(() => rifiuta.ferma()).not.toThrow();
    await Promise.resolve();
  });

  it('un teatro nuovo dopo il fermo riaccende: accendi() riprende il contesto sospeso', async () => {
    const finto = contestoAudioFinto();
    const g = await generatoreCon(finto);
    g.ferma();
    g.accendi();
    expect(finto.ctx.resume).toHaveBeenCalledTimes(1);
    expect(g.attivo).toBe(true);
    expect(finto.gain.setTargetAtTime).toHaveBeenLastCalledWith(0.9, 0, 0.1);
    g.ferma();
  });

  it('sospendi() ferma contesto e campanaccio senza spegnere; riprendi() li riporta solo se i suoni sono accesi', async () => {
    vi.useFakeTimers();
    const finto = contestoAudioFinto();
    const g = await generatoreCon(finto);
    const campanaccio = vi.spyOn(g, 'campanaccio').mockImplementation(() => undefined);
    g.caso = () => 0;
    g.accendi();
    finto.ctx.resume.mockClear();
    g.sospendi();
    expect(finto.ctx.suspend).toHaveBeenCalledTimes(1);
    expect(g.attivo).toBe(true);
    vi.advanceTimersByTime(40_000);
    expect(campanaccio).not.toHaveBeenCalled();
    g.riprendi();
    expect(finto.ctx.resume).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(8000);
    expect(campanaccio).toHaveBeenCalledTimes(1);
    // con i suoni spenti (attivo falso) la ripresa non fa niente
    g.sospendi();
    g.spegni();
    finto.ctx.resume.mockClear();
    g.riprendi();
    expect(finto.ctx.resume).not.toHaveBeenCalled();
    g.ferma();
    vi.useRealTimers();
  });
});
