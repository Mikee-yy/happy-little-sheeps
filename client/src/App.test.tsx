// @vitest-environment jsdom
// Criterio della fase 3: una partita a 3 si gioca dall'inizio alla fine su un dispositivo, senza vedere le mani altrui.
// Pezzo 3 della scena: si gioca solo toccando la scena (le domande del teatro); i pannelli del cassetto restano la riserva
// quando la scena non si carica.
import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { caricaScena, usaCaricatoreDiProva } from './partita/caricaScena';
import { defCarta } from '../../engine/src';
import type { Azione, IdCarta, Vista } from '../../engine/src';
import { SessioneLocale } from '../../sync/locale';
import { SessioneProva } from '../../sync/prova';
import type { Fotografia } from './scena/fotografia';
import type { Domanda, Gesto, IdPulsante, Pensiero } from './scena/scelte/tipi';
import { T } from './testi';

/** Un teatro finto: "occupato" lo decide la prova; ricorda la domanda e il pensiero che la partita gli ha passato. */
interface TeatroFinto {
  occupato: boolean;
  ascoltatori: Set<(o: boolean) => void>;
  domanda: Domanda | null;
  suGesto: ((g: Gesto) => void) | null;
  pensiero: Pensiero | null;
}

/**
 * Il teatro vero è provato in scena/ (teatro.test.ts, Scena.test.tsx, chiedi.test.ts, regia/): qui un teatro finto registra
 * ogni `recita` (e `allinea`), con ciò che era a schermo in quel momento (di chi è la schermata privata, se c'è il "Passa a"),
 * e ogni `chiedi` (con lo stesso contesto, più se era occupato e la mano dell'ultima fotografia).
 * Con `occupaDopoRecita` una recita con eventi nuovi lo rende "occupato", finché la prova non chiama `libera()`;
 * una recita "subito" lo libera, come il regista vero.
 */
const scena = vi.hoisted(() => {
  const vivi = new Set<TeatroFinto>();
  const imposta = (t: TeatroFinto, v: boolean) => {
    if (t.occupato === v) return;
    t.occupato = v;
    for (const cb of [...t.ascoltatori]) cb(v);
  };
  return {
    chiamate: [] as {
      foto: Fotografia;
      modo: 'calmo' | 'subito' | 'recita';
      vista: Vista | null;
      privata: string | null;
      passaggio: boolean;
    }[],
    /** Ogni sospendi del teatro finto, con se il "Passa a" era a schermo in quel momento. */
    sospensioni: [] as { sospeso: boolean; passaggio: boolean }[],
    chieste: [] as { d: Domanda; occupato: boolean; passaggio: boolean; mano: readonly string[] | null | undefined; cassetto: boolean }[],
    occupaDopoRecita: false,
    vivi,
    imposta,
    /** Il teatro finto ha finito di recitare. */
    libera() {
      for (const t of vivi) imposta(t, false);
    },
    occupata: () => [...vivi].some((t) => t.occupato),
    /** Il teatro montato adesso (in StrictMode il secondo). */
    attivo: (): TeatroFinto | null => [...vivi].at(-1) ?? null,
  };
});
vi.mock('./scena/teatro', () => ({
  creaTeatro: (radice: HTMLElement) => {
    radice.classList.add('teatro');
    const nulla = () => {};
    const t: TeatroFinto = { occupato: false, ascoltatori: new Set(), domanda: null, suGesto: null, pensiero: null };
    scena.vivi.add(t);
    let ultimoSeq: number | null = null;
    /** Di chi è la schermata privata a schermo: il cassetto (riserva) o la scritta della domanda nella striscia. */
    const privata = () => document.querySelector('.area-azione, .scritta-scena')?.getAttribute('data-giocatore') ?? null;
    const registra = (foto: Fotografia, modo: 'calmo' | 'subito' | 'recita', vista: Vista | null) =>
      scena.chiamate.push({ foto, modo, vista, privata: privata(), passaggio: document.querySelector('.passaggio') !== null });
    return {
      allinea(foto: Fotografia, modo: 'calmo' | 'subito') {
        registra(foto, modo, null);
      },
      recita(foto: Fotografia, vista: Vista, opz?: { subito?: boolean }) {
        registra(foto, opz?.subito ? 'subito' : 'recita', vista);
        const seq = vista.eventi.reduce((m, e) => Math.max(m, e.seq), 0);
        const nuovi = ultimoSeq !== null && seq > ultimoSeq;
        ultimoSeq = seq;
        if (opz?.subito) scena.imposta(t, false);
        else if (nuovi && scena.occupaDopoRecita) scena.imposta(t, true);
      },
      occupato: () => t.occupato,
      ascoltaOccupato(cb: (o: boolean) => void) {
        t.ascoltatori.add(cb);
        return () => t.ascoltatori.delete(cb);
      },
      chiedi(d: Domanda, suGesto: (g: Gesto) => void) {
        t.domanda = d;
        t.suGesto = suGesto;
        scena.chieste.push({
          d,
          occupato: t.occupato,
          passaggio: document.querySelector('.passaggio') !== null,
          mano: scena.chiamate.at(-1)?.foto.mano,
          cassetto: document.querySelector('.cassetto') !== null,
        });
      },
      smettiDiChiedere() {
        t.domanda = null;
        t.suGesto = null;
      },
      pensa(p: Pensiero | null) {
        t.pensiero = p;
      },
      adatta: nulla,
      sospendi(sospeso: boolean) {
        scena.sospensioni.push({ sospeso, passaggio: document.querySelector('.passaggio') !== null });
      },
      avanza: nulla,
      eventoInCorso: () => false,
      salta: nulla,
      stato: () => ({}),
      rivediSuggerimenti: nulla,
      distruggi() {
        radice.innerHTML = '';
        scena.vivi.delete(t);
        scena.imposta(t, false);
        t.ascoltatori.clear();
        t.domanda = null;
        t.suGesto = null;
        t.pensiero = null;
      },
      ordini: {},
      ctx: {},
    };
  },
}));
const ultimaFoto = () => scena.chiamate.at(-1)?.foto;

// La scena è un pacchetto a parte (import dinamico): nel gioco la si scarica in anticipo dalla Home, qui prima di tutte le prove
beforeAll(async () => {
  await caricaScena();
});

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  localStorage.clear();
  scena.chiamate.length = 0;
  scena.chieste.length = 0;
  scena.sospensioni.length = 0;
  scena.occupaDopoRecita = false;
  scena.vivi.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const pulsante = (testo: string) =>
  [...document.querySelectorAll('button')].find((b) => !b.disabled && b.textContent?.trim().startsWith(testo));

async function clic(el: Element | undefined | null) {
  if (!el) throw new Error('elemento mancante');
  await act(async () => {
    fireEvent.click(el);
  });
}

async function aspetta(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

// ---------- Gesti nella scena (il teatro finto) ----------

const domandaOra = (): Domanda | null => scena.attivo()?.domanda ?? null;
const pensieroOra = (): Pensiero | null => scena.attivo()?.pensiero ?? null;
const attivo = (d: Domanda, id: IdPulsante) => d.pulsanti.some((p) => p.id === id && p.attivo);
const scrittaOra = () => document.querySelector('.testata-scena .scritta-scena')?.textContent ?? '';

/** Un gesto sulla domanda di adesso, come se arrivasse dal teatro. */
async function gesto(g: Gesto) {
  const f = scena.attivo()?.suGesto;
  if (!f) throw new Error(`nessuna domanda a cui rispondere (${JSON.stringify(g)})`);
  await act(async () => {
    f(g);
  });
}
const premi = (id: IdPulsante) => gesto({ tipo: 'pulsante', id });
/** Un pulsante della nuvoletta del pensiero. */
async function premiPensiero(i = 0) {
  const p = pensieroOra();
  if (!p?.pulsanti[i]) throw new Error(`nessun pulsante ${i} nel pensiero: ${p?.testo}`);
  await act(async () => {
    p.pulsanti[i]!.azione();
  });
}

/** Il riquadro di mira della Testata sopra la scena: un colpo al centro (esito permesso, lo decide il riquadro). */
async function tiraTestata(dove = '.riquadro-testata svg.arena'): Promise<boolean> {
  const arena = document.querySelector(dove);
  if (!arena) return false;
  await act(async () => {
    fireEvent.pointerDown(arena, { pointerId: 1, clientX: 10, clientY: 10 });
  });
  await act(async () => {
    fireEvent.pointerMove(arena, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerUp(arena, { pointerId: 1, clientX: 10, clientY: 10 });
  });
  await aspetta(1700);
  return true;
}

/** Furto: si tocca ogni recinto finché prende qualcosa (come i "+" di oggi, fino al massimo), poi Conferma. */
async function ruba() {
  for (let k = 0; k < 20; k++) {
    let preso = false;
    for (const chi of domandaOra()!.pecore) {
      const prima = JSON.stringify(domandaOra()!.furto);
      await gesto({ tipo: 'pecora', chi });
      if (JSON.stringify(domandaOra()?.furto) !== prima) {
        preso = true;
        break;
      }
    }
    if (!preso) break;
  }
  await premi('conferma');
}

/** Tocca la carta e la gioca col pulsante che compare (Gioca, Scarta, Fatto). */
async function giocaCarta(carta: IdCarta) {
  await gesto({ tipo: 'carta', carta });
  const d = domandaOra()!;
  for (const id of ['gioca', 'conferma', 'fatto'] as const) if (attivo(d, id)) return premi(id);
  throw new Error(`nessun pulsante per giocare ${carta}: ${d.scritta}`);
}

/** Le stesse preferenze dei pannelli di oggi: Continua, Nessuno, il dado, il furto, poi la prima mossa possibile. */
async function rispondi(d: Domanda) {
  if (attivo(d, 'continua')) return premi('continua');
  if (attivo(d, 'nessuno')) return premi('nessuno');
  if (d.dado) {
    await gesto({ tipo: 'dado' });
    return aspetta(1000);
  }
  if (d.furto) return ruba();
  for (const id of ['attiva', 'prendiGuaio', 'nonScartare'] as const) if (attivo(d, id)) return premi(id);
  if (attivo(d, 'fatto') && d.sollevate.length === 0) return premi('fatto');
  if (d.pecore.length > 0) return gesto({ tipo: 'pecora', chi: d.pecore[0]! });
  if (d.grandi.length > 0) return gesto({ tipo: 'grande', carta: d.grandi[0]! });
  if (d.carte.length > 0 && d.sollevate.length === 0) return giocaCarta(d.carte[0]!);
  for (const id of ['gioca', 'passo', 'conferma', 'rinuncia', 'fatto'] as const) if (attivo(d, id)) return premi(id);
  throw new Error(`Nessuna mossa possibile: ${d.scritta} ${JSON.stringify(d.pulsanti)}`);
}

/** Un passo di gioco "da giocatore qualsiasi", solo con i gesti nella scena. Restituisce false quando la partita è finita. */
async function passo(): Promise<boolean> {
  if (document.querySelector('.fine-partita')) return false;
  const sono = pulsante('Sono ');
  if (sono) {
    await clic(sono);
    return true;
  }
  if (await tiraTestata()) return true;
  const d = domandaOra();
  if (!d) throw new Error(`nessuna domanda nella scena: ${document.querySelector('.testata-scena')?.textContent}`);
  await rispondi(d);
  return true;
}

/** Ogni `.cassetto` che compare mentre la scena è montata (con la scena pronta il cassetto non serve mai). */
function sorvegliaCassetto(): { visto: () => boolean; smetti: () => void } {
  let visto = false;
  const o = new MutationObserver(() => {
    if (document.querySelector('.teatro') && document.querySelector('.cassetto')) visto = true;
  });
  o.observe(document.body, { childList: true, subtree: true });
  return { visto: () => visto, smetti: () => o.disconnect() };
}

/** Le regole delle domande che il teatro ha ricevuto in tutta la partita (globali e anti-sbirciata). */
function controllaChieste() {
  expect(scena.chieste.length).toBeGreaterThan(0);
  for (const c of scena.chieste) {
    // Mai sopra "Passa il dispositivo", mai mentre la scena recita, mai col cassetto
    expect(c.passaggio, c.d.scritta).toBe(false);
    expect(c.occupato, c.d.scritta).toBe(false);
    expect(c.cassetto, c.d.scritta).toBe(false);
    // Niente carte toccabili con la mano coperta nella fotografia
    if (c.mano == null) {
      expect(c.d.carte, c.d.scritta).toEqual([]);
      expect(c.d.sollevate).toEqual([]);
      expect(c.d.trascinabili).toEqual([]);
    }
  }
}

async function iniziaConNomi(quanti = 3) {
  render(<App />);
  await clic(pulsante('Gioca su questo dispositivo'));
  await clic([...document.querySelectorAll('button')].find((b) => b.textContent === String(quanti)));
  ['Ada', 'Bea', 'Cleo', 'Dora'].slice(0, quanti).forEach((n, i) =>
    fireEvent.change(document.querySelector(`input[aria-label="Nome ${i + 1}"]`)!, { target: { value: n } }),
  );
  await clic(pulsante('Inizia la partita'));
}

describe('Partita su un solo dispositivo, giocata toccando la scena', () => {
  it.each([2, 3, 4])('%i giocatori: dalla preparazione alla fine solo con i gesti, senza cassetto e senza sbirciate', async (quanti) => {
    const cassetto = sorvegliaCassetto();
    render(<App />);
    await clic(pulsante('Gioca su questo dispositivo'));
    await clic([...document.querySelectorAll('button')].find((b) => b.textContent === String(quanti)));
    expect(document.querySelectorAll('.giocatore-prep')).toHaveLength(quanti);
    await clic(pulsante('Inizia la partita'));
    expect(localStorage.getItem('hls-partita-locale')).not.toBeNull();

    let passi = 0;
    let passaggi = 0;
    while (await passo()) {
      if (++passi > 3000) throw new Error('la partita non finisce');
      expect(document.querySelector('.errore')).toBeNull();
      expect(document.querySelector('.cassetto')).toBeNull();
      expect(document.querySelector('.area-azione')).toBeNull();
      if (document.querySelector('.passaggio')) {
        passaggi++;
        expect(document.querySelectorAll('.carta')).toHaveLength(0);
        // Niente sbirciate: durante il passaggio la mano nella scena è coperta e la scena non chiede niente
        expect(ultimaFoto()?.mano).toBeNull();
        expect(domandaOra()).toBeNull();
      }
      const d = domandaOra();
      // La scritta in cima dice cosa fare, con gli avvisi
      if (d) for (const testo of [d.scritta, ...d.avvisi]) expect(scrittaOra()).toContain(testo);
      if (d && d.carte.length > 0) {
        // Le carte toccabili sono di chi ha il dispositivo: è lui in basso nella scena, con la mano scoperta
        const chi = document.querySelector('.scritta-scena')?.getAttribute('data-giocatore');
        expect(ultimaFoto()?.posti[0]?.id).toBe(chi);
        expect(ultimaFoto()?.mano).not.toBeNull();
      }
    }
    cassetto.smetti();
    expect(cassetto.visto()).toBe(false);
    controllaChieste();
    // Niente sbirciate (punto di revisione 1): la mano è scoperta solo con la schermata privata di chi sta in basso
    expect(scena.chiamate.some((c) => c.foto.mano !== null)).toBe(true);
    for (const c of scena.chiamate) {
      if (c.foto.mano === null) continue;
      expect(c.passaggio).toBe(false);
      expect(c.privata).toBe(c.foto.posti[0]!.id);
    }
    expect(document.querySelector('.fine-partita h2')?.textContent).toMatch(/^Vinc/);
    expect(passaggi).toBeGreaterThan(3);
    // A partita finita il salvataggio non serve più.
    expect(localStorage.getItem('hls-partita-locale')).toBeNull();
  }, 120_000);

  it('una partita interrotta si riprende dalla Home', async () => {
    const primo = render(<App />);
    await clic(pulsante('Gioca su questo dispositivo'));
    await clic(pulsante('Inizia la partita'));
    await premi('continua');
    primo.unmount();
    render(<App />);
    await clic(pulsante('Riprendi la partita'));
    expect(document.querySelector('.passaggio h1')?.textContent).toMatch(/^Passa il dispositivo a /);
  });
});

describe('Le scelte nella scena', () => {
  /** Dall'inizio alla prima scelta segreta: Continua, "Sono io". */
  async function finoAllaScelta() {
    await iniziaConNomi();
    await premi('continua');
    await clic(pulsante('Sono '));
    const d = domandaOra()!;
    expect(d.scritta).toMatch(/scegli in segreto/);
    return d;
  }

  it('doppio gesto, una mossa sola: due "Gioca" di fila, o trascinamento e "Gioca", mandano una mossa (punto di revisione 1)', async () => {
    const d = await finoAllaScelta();
    await gesto({ tipo: 'carta', carta: d.carte[0]! });
    expect(domandaOra()!.sollevate).toEqual([d.carte[0]]);
    const invia = vi.spyOn(SessioneLocale.prototype, 'invia');
    // I due tocchi arrivano prima che la partita si ridisegni
    const f = scena.attivo()!.suGesto!;
    await act(async () => {
      f({ tipo: 'pulsante', id: 'gioca' });
      f({ tipo: 'pulsante', id: 'gioca' });
    });
    expect(invia).toHaveBeenCalledTimes(1);
    // Un gesto in ritardo sulla domanda vecchia, a partita già ridisegnata ("Passa a"): niente
    await act(async () => {
      f({ tipo: 'pulsante', id: 'gioca' });
    });
    expect(invia).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.passaggio')).not.toBeNull();
    // Il giocatore dopo trascina una carta sulla tovaglia e intanto tocca "Gioca"
    await clic(pulsante('Sono '));
    const d2 = domandaOra()!;
    const carta = d2.trascinabili[0]!;
    await gesto({ tipo: 'carta', carta });
    const g = scena.attivo()!.suGesto!;
    await act(async () => {
      g({ tipo: 'trascinata', carta });
      g({ tipo: 'pulsante', id: 'gioca' });
    });
    expect(invia).toHaveBeenCalledTimes(2);
    expect(document.querySelector('.errore')).toBeNull();
  });

  it('errore del motore: la scritta in alto mostra l\'errore, la scelta riparte vuota e la domanda si ripresenta', async () => {
    const d = await finoAllaScelta();
    await gesto({ tipo: 'carta', carta: d.carte[0]! });
    const rifiuta = vi.spyOn(SessioneLocale.prototype, 'invia').mockReturnValue({ ok: false, codice: 'prova', messaggio: 'non adesso' });
    await premi('gioca');
    expect(rifiuta).toHaveBeenCalledTimes(1);
    const scritta = document.querySelector('.testata-scena .scritta-scena')!;
    expect(scritta.getAttribute('role')).toBe('status');
    expect(scritta.textContent).toContain(T.errori.azione('non adesso'));
    expect(document.querySelector('.testata-scena .cronaca')).toBeNull();
    expect(domandaOra()!.sollevate).toEqual([]);
    // La domanda è ancora quella e risponde di nuovo: con il motore che accetta la mossa parte
    rifiuta.mockRestore();
    await gesto({ tipo: 'carta', carta: d.carte[0]! });
    await premi('gioca');
    expect(document.querySelector('.passaggio')).not.toBeNull();
  });

  it("l'errore del motore si annuncia come avviso (role alert) e sparisce quando cambia la domanda (scelto chi risponde, Annulla)", async () => {
    await iniziaConNomi();
    let trovata = false;
    let partite = 1;
    for (let i = 0; i < 4000 && !trovata; i++) {
      const d = domandaOra();
      if (d && attivo(d, 'nessuno') && d.pecore.length > 0 && !document.querySelector('.passaggio')) {
        trovata = true;
        const rifiuta = vi.spyOn(SessioneLocale.prototype, 'invia').mockReturnValue({ ok: false, codice: 'prova', messaggio: 'non adesso' });
        await premi('nessuno');
        rifiuta.mockRestore();
        const errore = document.querySelector('.testata-scena .scritta-scena .errore')!;
        expect(errore.textContent).toBe(T.errori.azione('non adesso'));
        expect(errore.getAttribute('role')).toBe('alert');
        // Si sceglie chi risponde: la domanda è un'altra, l'errore di prima non c'entra più
        await gesto({ tipo: 'pecora', chi: d.pecore[0]! });
        await clic(pulsante('Sono '));
        expect(attivo(domandaOra()!, 'annulla')).toBe(true);
        expect(document.querySelector('.errore')).toBeNull();
        await premi('annulla');
        expect(document.querySelector('.errore')).toBeNull();
        break;
      }
      if (!(await passo())) {
        if (partite++ >= 5) break;
        await clic(pulsante('Rigioca'));
      }
    }
    expect(trovata).toBe(true);
  }, 120_000);

  describe('la X della scritta in alto', () => {
    const chiudi = () => document.querySelector<HTMLButtonElement>(`.testata-scena button[aria-label="${T.scena.scelte.chiudiScritta}"]`);

    it('la X nasconde la scritta per questa domanda (la domanda resta); con la domanda successiva ricompare', async () => {
      const d = await (async () => {
        await iniziaConNomi();
        await premi('continua');
        await clic(pulsante('Sono '));
        return domandaOra()!;
      })();
      expect(scrittaOra()).toContain(d.scritta);
      await clic(chiudi());
      expect(document.querySelector('.scritta-scena')).toBeNull();
      expect(document.querySelector('.testata-scena .intestazione')).not.toBeNull();
      // La domanda c'è ancora e risponde: nascosta è solo la scritta
      expect(domandaOra()).not.toBeNull();
      await gesto({ tipo: 'carta', carta: d.carte[0]! });
      expect(document.querySelector('.scritta-scena')).toBeNull();
      // Domanda successiva (dopo la mossa, il "Passa a", "Sono io"): la scritta ricompare
      await premi('gioca');
      await clic(pulsante('Sono '));
      const prossima = domandaOra()!;
      expect(prossima.chiave).not.toBe(d.chiave);
      expect(scrittaOra()).toContain(prossima.scritta);
      expect(chiudi()).not.toBeNull();
    });

    it('una domanda uguale a quella chiusa, dopo un\'altra domanda diversa, mostra di nuovo la scritta (le chiavi si ripetono tra i round)', async () => {
      await iniziaConNomi();
      const chiaveA = domandaOra()!.chiave;
      await clic(chiudi());
      expect(document.querySelector('.scritta-scena')).toBeNull();
      let diversa = false;
      for (let i = 0; i < 3000; i++) {
        if (!(await passo())) break;
        const d = domandaOra();
        if (!d) continue;
        if (d.chiave !== chiaveA) diversa = true;
        else if (diversa) break;
      }
      const d = domandaOra()!;
      expect(diversa).toBe(true);
      expect(d.chiave).toBe(chiaveA);
      expect(scrittaOra()).toContain(d.scritta);
      expect(chiudi()).not.toBeNull();
    }, 120_000);

    it('chiusa la scritta con la X il fuoco passa al pulsante del menu (non si perde)', async () => {
      await iniziaConNomi();
      await premi('continua');
      await clic(pulsante('Sono '));
      const x = chiudi()!;
      x.focus();
      expect(document.activeElement).toBe(x);
      await clic(x);
      expect(document.querySelector('.scritta-scena')).toBeNull();
      expect(document.activeElement).toBe(document.querySelector('.testata-scena .pulsante-menu'));
    });

    it("un errore del motore riapre la striscia; la X lo toglie di nuovo e l'errore non resta appeso", async () => {
      await iniziaConNomi();
      await premi('continua');
      await clic(pulsante('Sono '));
      const d = domandaOra()!;
      await clic(chiudi());
      expect(document.querySelector('.scritta-scena')).toBeNull();
      await gesto({ tipo: 'carta', carta: d.carte[0]! });
      const rifiuta = vi.spyOn(SessioneLocale.prototype, 'invia').mockReturnValue({ ok: false, codice: 'prova', messaggio: 'non adesso' });
      await premi('gioca');
      expect(rifiuta).toHaveBeenCalledTimes(1);
      expect(scrittaOra()).toContain(T.errori.azione('non adesso'));
      await clic(chiudi());
      expect(document.querySelector('.scritta-scena')).toBeNull();
    });
  });

  it('"Chi risponde?": il tocco su una pecora porta a "Passa il dispositivo a …"; "Annulla" dopo "Sono io" torna a "Chi risponde?"', async () => {
    await iniziaConNomi();
    let trovata = false;
    let partite = 1;
    for (let i = 0; i < 4000 && !trovata; i++) {
      const d = domandaOra();
      if (d && attivo(d, 'nessuno') && d.pecore.length > 0 && !document.querySelector('.passaggio')) {
        trovata = true;
        const chi = d.pecore[0]!;
        const nome = ultimaFoto()!.posti.find((p) => p.id === chi)!.nome;
        await gesto({ tipo: 'pecora', chi });
        expect(document.querySelector('.passaggio h1')?.textContent).toBe(T.passaggio.passaA(nome));
        expect(domandaOra()).toBeNull();
        await clic(pulsante('Sono '));
        const risposta = domandaOra()!;
        expect(attivo(risposta, 'annulla')).toBe(true);
        expect(document.querySelector('.scritta-scena')?.getAttribute('data-giocatore')).toBe(chi);
        await premi('annulla');
        const ancora = domandaOra()!;
        expect(ancora.scritta).toBe(d.scritta);
        expect(attivo(ancora, 'nessuno')).toBe(true);
        expect(ancora.pecore).toEqual(d.pecore);
        break;
      }
      if (!(await passo())) {
        // Il seme è casuale: in qualche partita nessuno può rispondere, e allora se ne gioca un'altra
        if (partite++ >= 5) break;
        await clic(pulsante('Rigioca'));
      }
    }
    expect(trovata).toBe(true);
  }, 120_000);

  it('la scritta della domanda sta nella striscia in cima al posto della cronaca; senza domanda torna la cronaca', async () => {
    await iniziaConNomi();
    const testata = document.querySelector('.testata-scena')!;
    const d = domandaOra()!;
    expect(testata.querySelector('.scritta-scena')?.textContent).toContain(d.scritta);
    expect(testata.querySelector('.scritta-scena')?.getAttribute('role')).toBe('status');
    expect(testata.querySelector('.cronaca')).toBeNull();
    expect(document.querySelector('.testa-scena')).toBeNull();
    scena.occupaDopoRecita = true;
    await premi('continua');
    await clic(pulsante('Sono '));
    await giocaCarta(domandaOra()!.carte[0]!);
    // La scena recita la scelta: niente domanda, niente scritta, la cronaca c'è
    expect(scena.occupata()).toBe(true);
    expect(domandaOra()).toBeNull();
    expect(document.querySelector('.scritta-scena')).toBeNull();
  });
});

describe('La scena nella partita', () => {
  it('sotto "Passa il dispositivo" la scena è sospesa (ciclo e audio fermi); con "Sono io" riparte', async () => {
    await iniziaConNomi();
    // Il primo "Passa a" (prima della scelta segreta) ferma la scena; non è stata mai sospesa prima
    expect(document.querySelector('.passaggio')).toBeNull();
    expect(scena.sospensioni).toEqual([]);
    await premi('continua');
    expect(document.querySelector('.passaggio')).not.toBeNull();
    expect(scena.sospensioni.at(-1)).toEqual({ sospeso: true, passaggio: true });
    await clic(pulsante('Sono '));
    expect(document.querySelector('.passaggio')).toBeNull();
    expect(scena.sospensioni.at(-1)).toMatchObject({ sospeso: false });
    expect(scena.sospensioni.filter((s) => s.sospeso)).toHaveLength(1);
    // Il giocatore dopo: di nuovo sospesa sotto il passaggio, di nuovo in marcia dopo
    const d = domandaOra()!;
    await giocaCarta(d.carte[0]!);
    expect(document.querySelector('.passaggio')).not.toBeNull();
    expect(scena.sospensioni.at(-1)).toEqual({ sospeso: true, passaggio: true });
    await clic(pulsante('Sono '));
    expect(scena.sospensioni.at(-1)).toMatchObject({ sospeso: false });
  });

  it('se la scena recita ancora, il "Passa a" aspetta e la scena non si ferma; la sospensione arriva a recita finita', async () => {
    await iniziaConNomi();
    scena.occupaDopoRecita = true;
    await premi('continua');
    await clic(pulsante('Sono '));
    const prima = scena.sospensioni.length;
    await giocaCarta(domandaOra()!.carte[0]!);
    expect(scena.occupata()).toBe(true);
    expect(document.querySelector('.passaggio')).toBeNull();
    expect(scena.sospensioni.slice(prima).filter((s) => s.sospeso)).toEqual([]);
    await act(async () => scena.libera());
    expect(document.querySelector('.passaggio')).not.toBeNull();
    expect(scena.sospensioni.at(-1)).toEqual({ sospeso: true, passaggio: true });
  });

  it('la scena resta montata sotto il "Passa a" e il riassunto è leggibile', async () => {
    await iniziaConNomi();
    const teatro = document.querySelector('.teatro');
    // Il teatro non è più nascosto ai lettori di schermo: le zone e i pulsanti della domanda si raggiungono
    expect(teatro?.hasAttribute('aria-hidden')).toBe(false);
    // Il suggerimento dei gesti sta in basso sopra la mano: la scena non ha più bisogno della misura della striscia
    expect(teatro?.classList.contains('spazio-alto')).toBe(false);
    expect(document.querySelector('.solo-lettori')?.textContent).toMatch(/Gregge: /);
    expect(scena.chiamate[0]?.modo).toBe('subito');
    for (let i = 0; i < 20 && !document.querySelector('.passaggio'); i++) await passo();
    expect(document.querySelector('.passaggio.sopra-scena')).not.toBeNull();
    expect(document.querySelector('.teatro')).toBe(teatro);
    expect(ultimaFoto()?.mano).toBeNull();
    // Poi solo recite (il regista recita gli eventi nuovi), sempre con la vista del tavolo
    expect(scena.chiamate.slice(1).every((c) => c.modo === 'recita')).toBe(true);
    expect(scena.chiamate.every((c) => c.vista !== null && c.vista.giocatori.every((g) => g.mano === null))).toBe(true);
  });

  it('in basso chi ha il telefono: cambia con "Sono io", non con le schermate pubbliche', async () => {
    await iniziaConNomi();
    const nomeInBasso = () => ultimaFoto()?.posti[0]?.nome;
    let ultimo: string | null = null;
    let pubblicheConBea = 0;
    for (let i = 0; i < 400 && pubblicheConBea < 2; i++) {
      const passaA = /^Passa il dispositivo a (.+)$/.exec(document.querySelector('.passaggio h1')?.textContent ?? '')?.[1] ?? null;
      if (!(await passo())) break;
      if (passaA) {
        ultimo = passaA;
        expect(nomeInBasso()).toBe(passaA);
      }
      const scritta = document.querySelector('.scritta-scena');
      const pubblica = scritta !== null && !scritta.hasAttribute('data-giocatore') && !document.querySelector('.passaggio');
      if (ultimo && pubblica) expect(nomeInBasso()).toBe(ultimo);
      if (ultimo === 'Bea' && pubblica) pubblicheConBea++;
    }
    expect(pubblicheConBea).toBeGreaterThan(0);
  }, 60_000);

  it('il menu della partita ha le Opzioni della scena', async () => {
    await iniziaConNomi();
    await clic(document.querySelector('.pulsante-menu'));
    const menu = document.querySelector('.menu')!;
    expect(menu.textContent).toContain(T.scena.opzioni.titolo);
    const veloci = [...menu.querySelectorAll('[role=switch]')].find((b) => b.textContent?.startsWith('Animazioni veloci'));
    expect(veloci).toBeDefined();
  });
});

describe('Partita di prova', () => {
  const chiudiConsigli = async () => {
    for (let i = 0; i < 20 && (pensieroOra()?.pulsanti.length ?? 0) > 0; i++) await premiPensiero(0);
  };
  /** Dalla Home alla prima scelta segreta dell'umano. */
  async function provaFinoAllaScelta() {
    await clic(pulsante('Partita di prova'));
    await chiudiConsigli();
    await premi('continua');
    await chiudiConsigli();
    expect(domandaOra()!.scritta).toMatch(/scegli in segreto/);
  }

  it('dalla Home parte la prova: consiglio di inizio nella nuvoletta, nessun Passa il dispositivo', async () => {
    render(<App />);
    await clic(pulsante('Partita di prova'));
    const p = pensieroOra()!;
    expect(p.titolo).toBe(T.prova.consiglioTitolo);
    expect(p.testo).toMatch(/Questa è una partita di prova contro Bea e Leo/);
    expect(p.pulsanti.map((b) => b.testo)).toEqual([T.prova.hoCapito]);
    expect(document.querySelector('.passaggio')).toBeNull();
    // Con la scena pronta il consiglio non sta più nel riquadro in basso
    expect(document.querySelector('.testa-scena')).toBeNull();
  });

  it("nella prova in basso c'è sempre chi gioca (g1), con la mano sempre scoperta", async () => {
    render(<App />);
    await clic(pulsante('Partita di prova'));
    let attese = 0;
    for (let i = 0; i < 60; i++) {
      if (/sta pensando/.test(pensieroOra()?.testo ?? '')) attese++;
      await passoProva([]);
    }
    expect(scena.chiamate.length).toBeGreaterThan(5);
    expect(scena.chiamate.every((c) => c.foto.posti[0]!.id === 'g1')).toBe(true);
    // Un solo umano sul dispositivo: la sua mano resta scoperta anche quando pensano i bot
    expect(attese).toBeGreaterThan(0);
    expect(scena.chiamate.every((c) => c.foto.mano !== null)).toBe(true);
  }, 60_000);

  it('il consiglio si chiude con Ho capito e arriva il successivo', async () => {
    render(<App />);
    await clic(pulsante('Partita di prova'));
    await premiPensiero(0);
    expect(pensieroOra()?.testo).toMatch(/Ogni round si scopre un Guaio/);
  });

  it('in modalità di sviluppo (StrictMode) i bot muovono lo stesso', async () => {
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    await provaFinoAllaScelta();
    await giocaCarta(domandaOra()!.carte[0]!);
    await aspetta(5000);
    expect(pensieroOra()?.testo ?? '').not.toMatch(/sta pensando/);
  });

  it('una mossa di un bot non abbassa la carta che stai scegliendo', async () => {
    render(<App />);
    await provaFinoAllaScelta();
    const carta = domandaOra()!.carte[0]!;
    await gesto({ tipo: 'carta', carta });
    const seq = scena.chiamate.length;
    await aspetta(2500); // intanto Bea e Leo scelgono
    expect(scena.chiamate.length).toBeGreaterThan(seq);
    expect(domandaOra()!.sollevate).toEqual([carta]);
  });

  it('mentre gioca un bot la nuvoletta dice "sta pensando" e la scena non chiede niente', async () => {
    render(<App />);
    await provaFinoAllaScelta();
    expect(document.querySelector('.passaggio')).toBeNull();
    await giocaCarta(domandaOra()!.carte[0]!);
    expect(pensieroOra()?.testo).toMatch(/(Bea|Leo) sta pensando…/);
    expect(pensieroOra()?.pulsanti).toEqual([]);
    expect(domandaOra()).toBeNull();
  });

  it('Gemelle sollevate, poi un bot muove e le mosse permesse cambiano: la scelta riparte vuota, nessuna mossa (punto di revisione 3)', async () => {
    // Bot solo a comando (niente tempo vero che scorre): si fa muovere un bot quando le Gemelle sono sollevate
    vi.useFakeTimers();
    render(<App />);
    await clic(pulsante('Partita di prova'));
    const gemelleDi = (d: Domanda) => d.carte.filter((c) => (defCarta(c) as { gemella?: boolean }).gemella);
    // I bot non hanno ancora scelto: il primo di loro muove dopo la solita pausa
    const botInAttesa = () => (scena.chiamate.at(-1)?.vista?.attesa.giocatori ?? []).some((g) => g !== 'g1');
    for (let i = 0; i < 4000; i++) {
      const d = domandaOra();
      if (d && /scegli in segreto/.test(d.scritta) && gemelleDi(d).length >= 2 && botInAttesa() && (pensieroOra()?.pulsanti.length ?? 0) === 0) break;
      expect(await passoProva([])).toBe('avanti');
    }
    const gemelle = gemelleDi(domandaOra()!).slice(0, 2);
    expect(gemelle).toHaveLength(2);
    for (const carta of gemelle) await gesto({ tipo: 'carta', carta });
    expect([...domandaOra()!.sollevate].sort()).toEqual([...gemelle].sort());
    expect(attivo(domandaOra()!, 'gioca')).toBe(true);
    // Da adesso la coppia non è più permessa all'umano (le mosse permesse cambiano sotto le dita)
    const originale = SessioneProva.prototype.azioni;
    vi.spyOn(SessioneProva.prototype, 'azioni').mockImplementation(function (this: SessioneProva, per) {
      return originale.call(this, per).filter((a: Azione) => !(a.tipo === 'scegliTrovata' && a.carte.length === 2));
    });
    const invia = vi.spyOn(SessioneProva.prototype, 'invia');
    const f = scena.attivo()!.suGesto!;
    await aspetta(1100);
    // Un bot ha mosso
    expect(invia.mock.calls.some(([a]) => 'giocatore' in a && a.giocatore !== 'g1')).toBe(true);
    const d = domandaOra()!;
    expect(d.sollevate).toEqual([]);
    expect(attivo(d, 'gioca')).toBe(false);
    // "Gioca" sulla domanda vecchia non manda niente
    await act(async () => {
      f({ tipo: 'pulsante', id: 'gioca' });
    });
    expect(invia.mock.calls.some(([a]) => 'giocatore' in a && a.giocatore === 'g1')).toBe(false);
  }, 120_000);
});

/** Un passo della prova con le mosse "ovvie" del piano (la carta più alta, le Gemelle nel round 2, poi si lascia passare), solo con i gesti. */
async function passoProva(consigli: string[]): Promise<'fine-prova' | 'fine-partita' | 'avanti'> {
  if (document.querySelector('.fine-partita')) return 'fine-partita';
  const p = pensieroOra();
  if (p?.titolo === T.prova.fine.titolo) return 'fine-prova';
  if (p && p.pulsanti.length > 0) {
    consigli.push(p.testo);
    await premiPensiero(0);
    return 'avanti';
  }
  if (await tiraTestata()) return 'avanti';
  const d = domandaOra();
  if (!d) {
    // Un bot pensa: la nuvoletta lo dice
    await aspetta(1100);
    return 'avanti';
  }
  const round = Number(/Round (\d+)/.exec(document.querySelector('.titolo-round')?.textContent ?? '')?.[1] ?? 0);
  if (/scegli in segreto/i.test(d.scritta)) {
    const def = (c: IdCarta) => defCarta(c) as { famiglia: string; valore?: number; gemella?: boolean };
    const trovate = d.carte.filter((c) => def(c).famiglia === 'trovata');
    const gemelle = trovate.filter((c) => def(c).gemella);
    const scelte =
      round === 2 && gemelle.length >= 2
        ? gemelle.slice(0, 2)
        : [[...trovate.filter((c) => !def(c).gemella), ...trovate].sort((a, b) => (def(b).valore ?? 0) - (def(a).valore ?? 0))[0]!];
    for (const c of scelte) await gesto({ tipo: 'carta', carta: c });
    await premi('gioca');
    return 'avanti';
  }
  if (d.dado) {
    await gesto({ tipo: 'dado' });
    await aspetta(1000);
    return 'avanti';
  }
  if (d.furto) {
    await ruba();
    return 'avanti';
  }
  for (const id of ['continua', 'passo', 'rinuncia', 'nonScartare'] as const) if (attivo(d, id)) return premi(id).then(() => 'avanti');
  if (attivo(d, 'fatto') && d.sollevate.length === 0) return premi('fatto').then(() => 'avanti');
  if (attivo(d, 'prendiGuaio')) return premi('prendiGuaio').then(() => 'avanti');
  if (d.grandi.length > 0) return gesto({ tipo: 'grande', carta: d.grandi[0]! }).then(() => 'avanti');
  if (attivo(d, 'conferma')) return premi('conferma').then(() => 'avanti');
  if (d.pecore.length > 0) return gesto({ tipo: 'pecora', chi: d.pecore[0]! }).then(() => 'avanti');
  if (d.carte.length > 0 && d.sollevate.length === 0) return giocaCarta(d.carte[0]!).then(() => 'avanti');
  const qualsiasi = d.pulsanti.find((b) => b.attivo);
  if (!qualsiasi) {
    await aspetta(1100);
    return 'avanti';
  }
  await premi(qualsiasi.id);
  return 'avanti';
}

async function provaFinoA(meta: 'fine-prova' | 'fine-partita', consigli: string[] = [], passa = passoProva) {
  for (let i = 0; i < 4000; i++) {
    const r = await passa(consigli);
    if (r === meta) return consigli;
    if (r !== 'avanti') throw new Error(`la prova è arrivata a ${r} invece di ${meta}`);
  }
  throw new Error(`la prova non arriva a ${meta}: ${document.querySelector('.titolo-round')?.textContent} — ${scrittaOra()} ${document.querySelector('.area-azione')?.textContent?.slice(0, 300)}`);
}

describe('Partita di prova completa', () => {
  it('la prova arriva a "Ora sai come si gioca!" solo con i gesti, mostrando i consigli principali nella nuvoletta', async () => {
    const cassetto = sorvegliaCassetto();
    render(<App />);
    await clic(pulsante('Partita di prova'));
    const consigli = await provaFinoA('fine-prova');
    const C = T.prova.consigli;
    for (const k of ['inizio', 'guaio', 'scelta', 'rivelazione', 'tuoDado', 'pascolo', 'furto', 'beeeNo', 'testata', 'fineRound'] as const) {
      expect(consigli, k).toContain(C[k]);
    }
    const p = pensieroOra()!;
    expect(p.titolo).toBe('Ora sai come si gioca!');
    expect(p.testo).toBe(T.prova.fine.testo);
    expect(p.pulsanti.map((b) => [b.testo, b.secondario ?? false])).toEqual([
      [T.prova.fine.continua, false],
      [T.prova.fine.home, true],
    ]);
    // Con il riquadro finale aperto non si gioca
    expect(domandaOra()).toBeNull();
    cassetto.smetti();
    expect(cassetto.visto()).toBe(false);
    controllaChieste();
  }, 120_000);

  it('nel tiro del montone il riquadro di mira sta sopra la scena, sotto la striscia, fuori dal cassetto', async () => {
    render(<App />);
    await clic(pulsante('Partita di prova'));
    for (let i = 0; i < 4000 && !document.querySelector('.riquadro-testata'); i++) {
      const d = domandaOra();
      if (d?.testata) break;
      await passoProva([]);
    }
    const riquadro = document.querySelector<HTMLElement>('.riquadro-testata')!;
    expect(riquadro).not.toBeNull();
    expect(domandaOra()?.testata).toBe(true);
    expect(riquadro.querySelector('svg.arena')).not.toBeNull();
    expect(document.querySelector('.cassetto')).toBeNull();
    expect(riquadro.closest('.testata-scena')).toBeNull();
    // Parte subito sotto la striscia in cima (in jsdom l'altezza di riserva)
    expect(riquadro.style.getPropertyValue('--spazio-alto')).toBe('67px');
    expect(scrittaOra()).toContain(T.testata.titolo);
    // Il colpo manda l'esito: il riquadro se ne va
    await tiraTestata();
    expect(document.querySelector('.riquadro-testata')).toBeNull();
  }, 120_000);

  it('Continua la partita porta fino alla fine', async () => {
    render(<App />);
    await clic(pulsante('Partita di prova'));
    await provaFinoA('fine-prova');
    await premiPensiero(0);
    await provaFinoA('fine-partita');
    expect(document.querySelector('.fine-partita h2')?.textContent).toMatch(/^Vinc/);
  }, 120_000);

  it('Torna alla schermata principale esce dalla prova', async () => {
    render(<App />);
    await clic(pulsante('Partita di prova'));
    await provaFinoA('fine-prova');
    await premiPensiero(1);
    expect(document.querySelector('main.home')).not.toBeNull();
    expect(scena.vivi.size).toBe(0);
  }, 120_000);

  it('una partita vera salvata resta riprendibile', async () => {
    render(<App />);
    await clic(pulsante('Gioca su questo dispositivo'));
    await clic(pulsante('Inizia la partita'));
    await clic(document.querySelector('.pulsante-menu'));
    await clic(pulsante('Esci'));
    const salvata = localStorage.getItem('hls-partita-locale');
    await clic(pulsante('Partita di prova'));
    await premiPensiero(0);
    await clic(document.querySelector('.pulsante-menu'));
    await clic(pulsante('Esci'));
    expect(localStorage.getItem('hls-partita-locale')).toBe(salvata);
    await clic(pulsante('Riprendi la partita'));
    expect(document.querySelector('.passaggio h1')?.textContent ?? domandaOra()?.scritta).toBeTruthy();
    expect(pensieroOra()).toBeNull();
  });

  it('ricaricando durante la prova si riapre la Home', async () => {
    const primo = render(<App />);
    await clic(pulsante('Partita di prova'));
    primo.unmount();
    render(<App />);
    expect(document.querySelector('main.home')).not.toBeNull();
    expect(pulsante('Riprendi la partita')).toBeUndefined();
  });
});

describe('La scena recita: la partita aspetta', () => {
  const libera = () =>
    act(async () => {
      scena.libera();
    });
  const ultimoSeq = () => scena.chiamate.at(-1)?.vista?.eventi.reduce((m, e) => Math.max(m, e.seq), 0) ?? 0;

  it('mentre la scena recita la mossa non ci sono né la domanda né il "Passa a"; a recita finita compaiono', async () => {
    await iniziaConNomi();
    scena.occupaDopoRecita = true;
    // Una mossa senza eventi nuovi (il Guaio è già scoperto) non fa recitare niente: la schermata dopo arriva subito
    await premi('continua');
    expect(scena.occupata()).toBe(false);
    expect(document.querySelector('.passaggio')).not.toBeNull();
    let dopoPassaggio = 0;
    let dopoDomanda = 0;
    // Tutti e tre scelgono la Trovata: ogni scelta è un evento da recitare
    for (let i = 0; i < 3; i++) {
      await clic(pulsante('Sono '));
      await giocaCarta(domandaOra()!.carte[0]!);
      expect(scena.occupata()).toBe(true);
      expect(scena.chiamate.at(-1)?.modo).toBe('recita');
      expect(domandaOra()).toBeNull();
      expect(document.querySelector('.cassetto')).toBeNull();
      expect(document.querySelector('.passaggio')).toBeNull();
      // La scena resta, con la striscia in cima (il menu c'è sempre)
      expect(document.querySelector('.teatro')).not.toBeNull();
      expect(document.querySelector('.testata-scena .pulsante-menu')).not.toBeNull();
      await libera();
      if (document.querySelector('.passaggio')) dopoPassaggio++;
      else if (domandaOra()) dopoDomanda++;
    }
    expect(dopoPassaggio).toBe(2);
    expect(dopoDomanda).toBe(1);
    controllaChieste();
  });

  it("niente sbirciate durante l'attesa: con la scena occupata e un Passa a in attesa, la fotografia ha la mano coperta", async () => {
    await iniziaConNomi();
    await premi('continua');
    await clic(pulsante('Sono '));
    const chi = document.querySelector('.scritta-scena')?.getAttribute('data-giocatore');
    expect(ultimaFoto()?.mano).not.toBeNull();
    scena.occupaDopoRecita = true;
    await giocaCarta(domandaOra()!.carte[0]!);
    expect(scena.occupata()).toBe(true);
    // Il "Passa a" aspetta la scena, ma la mano è già coperta
    expect(document.querySelector('.passaggio')).toBeNull();
    expect(scena.chiamate.at(-1)?.modo).toBe('recita');
    expect(ultimaFoto()?.mano).toBeNull();
    expect(domandaOra()).toBeNull();
    await libera();
    // Era davvero in attesa un passaggio a un altro giocatore
    const passaA = document.querySelector('.passaggio h1')?.textContent ?? '';
    expect(passaA).toMatch(/^Passa il dispositivo a /);
    expect(passaA).not.toContain(chi === 'g1' ? 'Ada' : chi === 'g2' ? 'Bea' : 'Cleo');
    expect(ultimaFoto()?.mano).toBeNull();
    expect(domandaOra()).toBeNull();
  });

  it("niente sbirciate durante l'attesa anche quando il Passa a è per chi sta già in basso", async () => {
    await iniziaConNomi();
    scena.occupaDopoRecita = true;
    let attese = 0;
    let perChiStaInBasso = 0;
    let partite = 1;
    for (let i = 0; i < 3000 && perChiStaInBasso === 0; i++) {
      if (!(await passo())) {
        // Il seme è casuale: in qualche partita il caso non capita prima della fine, e allora se ne gioca un'altra
        if (partite++ >= 5) break;
        await clic(pulsante('Rigioca'));
        continue;
      }
      if (!scena.occupata()) continue;
      const durante = scena.chiamate.at(-1)!;
      expect(domandaOra()).toBeNull();
      await libera();
      const passaA = /^Passa il dispositivo a (.+)$/.exec(document.querySelector('.passaggio h1')?.textContent ?? '')?.[1];
      if (!passaA) continue;
      attese++;
      // Mentre la scena recitava, il "Passa a" era in attesa: la mano nella scena era già coperta
      expect(durante.foto.mano).toBeNull();
      if (durante.foto.posti[0]!.nome === passaA) perChiStaInBasso++;
    }
    expect(attese).toBeGreaterThan(0);
    expect(perChiStaInBasso).toBeGreaterThan(0);
    controllaChieste();
  }, 120_000);

  it('a partita finita la classifica aspetta la fine della festa nella scena', async () => {
    render(<App />);
    await clic(pulsante('Gioca su questo dispositivo'));
    await clic(pulsante('2'));
    await clic(pulsante('Inizia la partita'));
    scena.occupaDopoRecita = true;
    let finita = false;
    for (let passi = 0; passi < 3000 && !finita; passi++) {
      expect(await passo()).toBe(true);
      if (!scena.occupata()) continue;
      if (scena.chiamate.at(-1)?.vista?.esito) {
        // Partita finita, ma la scena recita ancora: niente classifica, la scena resta, nessuna domanda
        expect(document.querySelector('.fine-partita')).toBeNull();
        expect(document.querySelector('.teatro')).not.toBeNull();
        expect(domandaOra()).toBeNull();
        finita = true;
      }
      await libera();
    }
    expect(finita).toBe(true);
    // A festa finita niente domanda: la classifica
    expect(document.querySelector('.fine-partita h2')?.textContent).toMatch(/^Vinc/);
    expect(document.querySelector('.teatro')).toBeNull();
    controllaChieste();
  }, 120_000);

  it('nella prova, mentre la scena recita, i bot non muovono; a recita finita riprendono', async () => {
    render(<App />);
    await clic(pulsante('Partita di prova'));
    for (let i = 0; i < 20 && (pensieroOra()?.pulsanti.length ?? 0) > 0; i++) await premiPensiero(0);
    await premi('continua');
    for (let i = 0; i < 20 && (pensieroOra()?.pulsanti.length ?? 0) > 0; i++) await premiPensiero(0);
    scena.occupaDopoRecita = true;
    await giocaCarta(domandaOra()!.carte[0]!);
    expect(scena.occupata()).toBe(true);
    const fermo = ultimoSeq();
    const quante = scena.chiamate.length;
    await aspetta(5000);
    expect(scena.chiamate.length).toBe(quante);
    expect(ultimoSeq()).toBe(fermo);
    await libera();
    await aspetta(1100);
    expect(ultimoSeq()).toBeGreaterThan(fermo);
  });

  /** Prova fino alla prima scelta segreta dell'umano, poi la gioca con la scena che si fa occupata. */
  async function provaConScenaOccupata() {
    render(<App />);
    await clic(pulsante('Partita di prova'));
    for (let i = 0; i < 20 && (pensieroOra()?.pulsanti.length ?? 0) > 0; i++) await premiPensiero(0);
    await premi('continua');
    for (let i = 0; i < 20 && (pensieroOra()?.pulsanti.length ?? 0) > 0; i++) await premiPensiero(0);
    scena.occupaDopoRecita = true;
    await giocaCarta(domandaOra()!.carte[0]!);
    expect(scena.occupata()).toBe(true);
    expect(domandaOra()).toBeNull();
    expect(pensieroOra()).toBeNull();
  }

  it('nella prova, nascosta dalle Regole mentre la scena recita: al ritorno in pari subito, la nuvoletta c\'è, i bot muovono', async () => {
    await provaConScenaOccupata();
    await clic(document.querySelector('.pulsante-menu'));
    await clic(pulsante('Regole'));
    expect(document.querySelector('.regole h1')?.textContent).toBe('Regole');
    scena.occupaDopoRecita = false;
    await clic(pulsante('Indietro'));
    // Nessuna attesa appesa e nessuna recita rifatta: l'ultima chiamata è la messa in pari "subito"
    expect(scena.occupata()).toBe(false);
    expect(scena.chiamate.at(-1)?.modo).toBe('subito');
    expect(pensieroOra()?.testo).toMatch(/sta pensando/);
    const alRitorno = ultimoSeq();
    await aspetta(2500);
    expect(ultimoSeq()).toBeGreaterThan(alRitorno);
  });

  it('nella prova, mentre si leggono le Regole i bot restano fermi; tornando riprendono', async () => {
    await provaConScenaOccupata();
    await clic(document.querySelector('.pulsante-menu'));
    await clic(pulsante('Regole'));
    scena.occupaDopoRecita = false;
    const invia = vi.spyOn(SessioneProva.prototype, 'invia');
    // La scena nascosta si libera da sola, ma i bot non devono muovere lo stesso
    await aspetta(6000);
    expect(invia).not.toHaveBeenCalled();
    await clic(pulsante('Indietro'));
    await aspetta(2500);
    expect(invia).toHaveBeenCalled();
  });

  it('nella prova, uscendo alla Home mentre la scena recita e rientrando in una prova nuova, i bot muovono', async () => {
    await provaConScenaOccupata();
    await clic(document.querySelector('.pulsante-menu'));
    await clic(pulsante('Esci'));
    expect(document.querySelector('main.home')).not.toBeNull();
    // La scena smontata non resta "occupata"
    expect(scena.vivi.size).toBe(0);
    scena.occupaDopoRecita = false;
    await clic(pulsante('Partita di prova'));
    for (let i = 0; i < 20 && (pensieroOra()?.pulsanti.length ?? 0) > 0; i++) await premiPensiero(0);
    await premi('continua');
    for (let i = 0; i < 20 && (pensieroOra()?.pulsanti.length ?? 0) > 0; i++) await premiPensiero(0);
    expect(domandaOra()?.scritta).toMatch(/scegli in segreto/);
    await giocaCarta(domandaOra()!.carte[0]!);
    expect(pensieroOra()?.testo).toMatch(/sta pensando/);
    const prima = ultimoSeq();
    await aspetta(2500);
    expect(ultimoSeq()).toBeGreaterThan(prima);
  });

  it('nella prova, il consiglio della guida e il riquadro finale aspettano la scena', async () => {
    render(<App />);
    await clic(pulsante('Partita di prova'));
    scena.occupaDopoRecita = true;
    let consigliDopo = 0;
    let fineDopo = 0;
    for (let i = 0; i < 4000 && fineDopo === 0; i++) {
      if (scena.occupata()) {
        // Mentre la scena recita la nuvoletta è vuota: né consiglio né riquadro finale (né "sta pensando")
        expect(pensieroOra()).toBeNull();
        expect(domandaOra()).toBeNull();
        await libera();
        const p = pensieroOra();
        if (p?.titolo === T.prova.consiglioTitolo) consigliDopo++;
        if (p?.titolo === T.prova.fine.titolo) fineDopo++;
        continue;
      }
      if ((await passoProva([])) === 'fine-prova') break;
    }
    expect(consigliDopo).toBeGreaterThan(0);
    expect(fineDopo).toBe(1);
  }, 120_000);

  it('con la scena pronta non si scorre mai verso un pannello (il cassetto non c\'è)', async () => {
    const scorrimenti: Element[] = [];
    const proto = Element.prototype as unknown as { scrollIntoView?: () => void };
    const prima = proto.scrollIntoView;
    proto.scrollIntoView = function (this: Element) {
      scorrimenti.push(this);
    };
    try {
      render(<App />);
      await clic(pulsante('Partita di prova'));
      for (let i = 0; i < 20 && (pensieroOra()?.pulsanti.length ?? 0) > 0; i++) await premiPensiero(0);
      await premi('continua');
      for (let i = 0; i < 20 && (pensieroOra()?.pulsanti.length ?? 0) > 0; i++) await premiPensiero(0);
      await giocaCarta(domandaOra()!.carte[0]!);
      await aspetta(2500);
      expect(scorrimenti.filter((e) => e.classList.contains('area-azione'))).toHaveLength(0);
    } finally {
      if (prima) proto.scrollIntoView = prima;
      else delete proto.scrollIntoView;
    }
  });
});

// ---------- Riserva: la scena non si carica, si gioca con i pannelli del cassetto (come prima del pezzo 3) ----------

/** Un passo di gioco con i pannelli del cassetto. Restituisce false quando la partita è finita. */
async function passoPannelli(): Promise<boolean> {
  if (document.querySelector('.fine-partita')) return false;
  let b: HTMLButtonElement | undefined;
  if ((b = pulsante('Sono '))) return clic(b).then(() => true);
  if ((b = pulsante('Continua'))) return clic(b).then(() => true);
  if ((b = pulsante('Nessuno'))) return clic(b).then(() => true);
  if ((b = pulsante('Lancia il dado'))) {
    await clic(b);
    await aspetta(1000);
    return true;
  }
  if (await tiraTestata('svg.arena')) return true;
  if (document.querySelector('.furto')) {
    for (let k = 0; k < 10; k++) {
      const piu = [...document.querySelectorAll('.furto button')].find((x) => x.textContent === '+' && !(x as HTMLButtonElement).disabled);
      if (!piu) break;
      await clic(piu);
    }
    return clic(pulsante('Conferma')).then(() => true);
  }
  for (const t of ['Usa l', 'Prendo il Guaio', 'Non scarto']) if ((b = pulsante(t))) return clic(b).then(() => true);
  const c = document.querySelector('.area-azione .mano button.carta:not(.spenta)');
  if (c) await clic(c);
  b = pulsante('Gioca') ?? pulsante('Tieni') ?? pulsante('Scarta') ?? pulsante('Lascia passare');
  if (!b) b = [...document.querySelectorAll<HTMLButtonElement>('.area-azione .scelte-nomi button')].find((x) => !x.disabled);
  if (!b) throw new Error(`Nessuna mossa possibile: ${document.querySelector('.area-azione')?.textContent}`);
  await clic(b);
  return true;
}

/** Il riquadro del pensiero in basso (consiglio o riquadro finale), quando la scena non c'è. */
const riquadroPensiero = () => document.querySelector('.fondo-scena .testa-scena .consiglio');
/** Il riquadro finale della prova in basso, quando la scena non c'è (come prima del pezzo 3). */
const riquadroFine = () => document.querySelector('.fondo-scena .testa-scena .fine-prova');

/** Un passo della prova con i pannelli: le stesse mosse "ovvie" di `passoProva`. */
async function passoProvaPannelli(consigli: string[]): Promise<'fine-prova' | 'fine-partita' | 'avanti'> {
  if (riquadroFine()) return 'fine-prova';
  if (document.querySelector('.fine-partita')) return 'fine-partita';
  const hoCapito = pulsante('Ho capito');
  if (hoCapito) {
    consigli.push(riquadroPensiero()?.querySelector('p')?.textContent ?? '');
    await clic(hoCapito);
    return 'avanti';
  }
  const area = document.querySelector('.area-azione');
  if (/sta pensando/.test(area?.textContent ?? '')) {
    await aspetta(1100);
    return 'avanti';
  }
  const round = Number(/Round (\d+)/.exec(document.querySelector('.titolo-round')?.textContent ?? '')?.[1] ?? 0);
  if (/scegli in segreto/i.test(area?.querySelector('h2')?.textContent ?? '')) {
    const carte = [...document.querySelectorAll<HTMLButtonElement>('.area-azione .mano button.carta:not(.spenta)')];
    const def = (b: HTMLButtonElement) => defCarta(b.dataset.carta!) as { famiglia: string; valore?: number; gemella?: boolean };
    const trovate = carte.filter((b) => def(b).famiglia === 'trovata');
    const gemelle = trovate.filter((b) => def(b).gemella);
    const scelte = round === 2 && gemelle.length >= 2 ? gemelle.slice(0, 2) : [[...trovate.filter((b) => !def(b).gemella), ...trovate].sort((a, b) => (def(b).valore ?? 0) - (def(a).valore ?? 0))[0]!];
    for (const b of scelte) await clic(b);
    await clic([...document.querySelectorAll('.area-azione button')].find((b) => /^Gioca/.test(b.textContent ?? '')));
    return 'avanti';
  }
  const sceltaFinale = [...document.querySelectorAll<HTMLButtonElement>('.area-azione button')].find((b) => b.textContent === 'Scegli una Trovata');
  if (sceltaFinale) {
    await clic(document.querySelector('.area-azione .mano button.carta:not(.spenta)'));
    await clic([...document.querySelectorAll('.area-azione button')].find((b) => /^Gioca/.test(b.textContent ?? '')));
    return 'avanti';
  }
  if (pulsante('Lancia il dado')) {
    await clic(pulsante('Lancia il dado'));
    await aspetta(1000);
    return 'avanti';
  }
  if (await tiraTestata('svg.arena')) return 'avanti';
  if (document.querySelector('.area-azione .furto')) {
    for (let k = 0; k < 10; k++) {
      const piu = [...document.querySelectorAll('.area-azione .furto button')].find((x) => x.textContent === '+' && !(x as HTMLButtonElement).disabled);
      if (!piu) break;
      await clic(piu);
    }
    await clic(pulsante('Conferma'));
    return 'avanti';
  }
  for (const t of ['Continua', 'Lascia passare', 'Non usarlo', 'Non scarto', 'Prendo il Guaio', 'Tieni', 'Conferma']) {
    const b = pulsante(t);
    if (b) {
      await clic(b);
      return 'avanti';
    }
  }
  const qualsiasi = [...document.querySelectorAll<HTMLButtonElement>('.area-azione button')].find((b) => !b.disabled);
  if (!qualsiasi) {
    await aspetta(1100);
    return 'avanti';
  }
  await clic(qualsiasi);
  return 'avanti';
}

describe('Riserva: la scena non si carica e si gioca con i pannelli del cassetto', () => {
  beforeEach(() => {
    // Lo scaricamento della scena fallisce (rete assente): React scrive in console l'errore preso dal confine, qui voluto
    vi.spyOn(console, 'error').mockImplementation(() => {});
    usaCaricatoreDiProva(() => Promise.reject(new Error('Failed to fetch dynamically imported module')));
  });
  afterEach(async () => {
    usaCaricatoreDiProva(null);
    await caricaScena();
  });

  it('3 giocatori: dalla preparazione alla fine con i pannelli, senza mai mostrare due mani né carte durante il passaggio', async () => {
    await iniziaConNomi();
    expect(document.querySelector('.scena-non-caricata')).not.toBeNull();
    expect(document.querySelector('.cassetto .area-azione')).not.toBeNull();
    let passi = 0;
    let passaggi = 0;
    while (await passoPannelli()) {
      if (++passi > 3000) throw new Error('la partita non finisce');
      expect(document.querySelector('.errore')).toBeNull();
      // Nessuna scena, nessuna domanda: la cronaca resta nella striscia
      expect(scena.vivi.size).toBe(0);
      expect(document.querySelector('.scritta-scena')).toBeNull();
      expect(document.querySelectorAll('.area-azione .mano').length).toBeLessThanOrEqual(2);
      if (document.querySelector('.passaggio')) {
        passaggi++;
        expect(document.querySelectorAll('.carta')).toHaveLength(0);
      }
    }
    expect(document.querySelector('.fine-partita h2')?.textContent).toMatch(/^Vinc/);
    expect(passaggi).toBeGreaterThan(3);
  }, 120_000);

  it('il cassetto si abbassa con la maniglia e torna su da solo quando cambia la schermata', async () => {
    await iniziaConNomi();
    const maniglia = () => document.querySelector('.cassetto .maniglia')!;
    expect(maniglia().getAttribute('aria-expanded')).toBe('true');
    expect(maniglia().textContent).toBe(T.scena.cassetto.abbassa);
    // La maniglia controlla il contenuto del cassetto (id unico)
    const contenuto = document.getElementById(maniglia().getAttribute('aria-controls')!);
    expect(contenuto?.classList.contains('cassetto-contenuto')).toBe(true);
    await clic(maniglia());
    expect(maniglia().getAttribute('aria-expanded')).toBe('false');
    expect(maniglia().textContent).toBe(T.scena.cassetto.alza);
    expect(document.querySelector<HTMLElement>('.cassetto-contenuto')?.hidden).toBe(true);
    await clic(pulsante('Continua'));
    // La schermata dopo è privata: si passa il telefono, e il cassetto del nuovo giocatore è su
    if (document.querySelector('.passaggio')) await clic(pulsante('Sono '));
    expect(maniglia().getAttribute('aria-expanded')).toBe('true');
    expect(document.querySelector<HTMLElement>('.cassetto-contenuto')?.hidden).toBe(false);
  });

  it('la prova arriva a "Ora sai come si gioca!" con i pannelli; consigli e riquadro finale in basso, sopra il cassetto', async () => {
    render(<App />);
    await clic(pulsante('Partita di prova'));
    // Il consiglio sta in basso, prima del cassetto, non nella striscia in cima
    const primo = riquadroPensiero()!;
    expect(primo.textContent).toMatch(/Questa è una partita di prova contro Bea e Leo/);
    expect(primo.getAttribute('role')).toBe('status');
    // Come prima del pezzo 3: titolo in grassetto, testo, "Ho capito" secondario e non largo
    expect(primo.querySelector('strong')?.textContent).toBe(T.prova.consiglioTitolo);
    expect(primo.querySelector('h2')).toBeNull();
    const hoCapito = [...primo.querySelectorAll('button')];
    expect(hoCapito.map((b) => b.textContent)).toEqual([T.prova.hoCapito]);
    expect(hoCapito[0]!.classList.contains('pulsante-secondario')).toBe(true);
    expect(hoCapito[0]!.classList.contains('largo')).toBe(false);
    expect(primo.closest('.testata-scena')).toBeNull();
    const cassetto = primo.closest('.fondo-scena')!.querySelector('.cassetto')!;
    expect(primo.compareDocumentPosition(cassetto) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const testata = document.querySelector('.testata-scena')!;
    expect([...testata.children].every((c) => ['intestazione', 'cronaca'].includes(c.className))).toBe(true);
    const consigli = await provaFinoA('fine-prova', [], passoProvaPannelli);
    const C = T.prova.consigli;
    for (const k of ['inizio', 'guaio', 'scelta', 'rivelazione', 'tuoDado', 'pascolo', 'furto', 'beeeNo', 'testata', 'fineRound'] as const) {
      expect(consigli, k).toContain(C[k]);
    }
    // Il riquadro finale: stessi testi e stessi pulsanti di prima, in basso; sotto non si gioca
    const fine = riquadroFine()!;
    expect(fine).not.toBeNull();
    expect(riquadroPensiero()).toBeNull();
    expect(fine.getAttribute('role')).toBe('status');
    expect(fine.querySelector('h2')?.textContent).toBe(T.prova.fine.titolo);
    expect(fine.querySelector('p')?.textContent).toBe(T.prova.fine.testo);
    const pulsanti = [...fine.querySelectorAll('button')];
    expect(pulsanti.map((b) => b.textContent)).toEqual([T.prova.fine.continua, T.prova.fine.home]);
    // Pulsanti larghi: Continua principale, Torna alla schermata principale secondario
    expect(pulsanti.every((b) => b.classList.contains('largo'))).toBe(true);
    expect(pulsanti.map((b) => b.classList.contains('pulsante-secondario'))).toEqual([false, true]);
    expect(document.querySelector('.area-azione')).toBeNull();
    await clic(pulsante(T.prova.fine.continua));
    await provaFinoA('fine-partita', [], passoProvaPannelli);
    expect(document.querySelector('.fine-partita h2')?.textContent).toMatch(/^Vinc/);
  }, 120_000);

  it('nel tiro del montone il cassetto è a tutta altezza sotto la striscia; abbassato o in altri pannelli no', async () => {
    render(<App />);
    await clic(pulsante('Partita di prova'));
    const fondo = () => document.querySelector<HTMLElement>('.fondo-scena')!;
    let altriPannelli = 0;
    for (let i = 0; i < 4000 && !document.querySelector('svg.arena'); i++) {
      if (document.querySelector('.area-azione')) {
        altriPannelli++;
        expect(fondo().classList.contains('a-tutta-altezza')).toBe(false);
      }
      await passoProvaPannelli([]);
    }
    expect(document.querySelector('svg.arena')).not.toBeNull();
    expect(document.querySelector('.riquadro-testata')).toBeNull();
    expect(altriPannelli).toBeGreaterThan(0);
    expect(fondo().classList.contains('a-tutta-altezza')).toBe(true);
    // Parte subito sotto la striscia in cima (in jsdom l'altezza di riserva)
    expect(fondo().style.getPropertyValue('--spazio-alto')).toBe('67px');
    await clic(document.querySelector('.cassetto .maniglia'));
    expect(fondo().classList.contains('a-tutta-altezza')).toBe(false);
    await clic(document.querySelector('.cassetto .maniglia'));
    expect(fondo().classList.contains('a-tutta-altezza')).toBe(true);
  }, 120_000);

  async function provaPannelliFinoAllaScelta() {
    render(<App />);
    await clic(pulsante('Partita di prova'));
    for (let i = 0; i < 20 && pulsante('Ho capito'); i++) await clic(pulsante('Ho capito'));
    await clic(pulsante('Continua'));
    for (let i = 0; i < 20 && pulsante('Ho capito'); i++) await clic(pulsante('Ho capito'));
  }

  it('nella prova una mossa di un bot non deseleziona la carta che stai scegliendo', async () => {
    await provaPannelliFinoAllaScelta();
    const carta = document.querySelector<HTMLButtonElement>('.area-azione .mano button.carta:not(.spenta)')!;
    const id = carta.dataset.carta;
    await clic(carta);
    await aspetta(2500); // intanto Bea e Leo scelgono
    expect(document.querySelector(`.area-azione [data-carta="${id}"]`)?.getAttribute('aria-pressed')).toBe('true');
  });

  it('nella prova, mentre gioca un bot, il cassetto dice "sta pensando" senza pulsanti d\'azione', async () => {
    await provaPannelliFinoAllaScelta();
    await clic(document.querySelector('.area-azione .mano button.carta:not(.spenta)'));
    await clic(pulsante('Gioca'));
    expect(document.querySelector('.area-azione')?.textContent).toMatch(/(Bea|Leo) sta pensando…/);
    expect(document.querySelectorAll('.area-azione button')).toHaveLength(0);
    // Il pensiero del bot non va nel riquadro in basso: lì solo i consigli della guida
    expect(document.querySelector('.testa-scena')?.textContent ?? '').not.toMatch(/sta pensando/);
  });

  it('a ogni cambio di schermata ci si scorre fino al pannello', async () => {
    const scorrimenti: Element[] = [];
    const proto = Element.prototype as unknown as { scrollIntoView?: () => void };
    const prima = proto.scrollIntoView;
    proto.scrollIntoView = function (this: Element) {
      scorrimenti.push(this);
    };
    try {
      await iniziaConNomi();
      scorrimenti.length = 0;
      await clic(pulsante('Continua'));
      await clic(pulsante('Sono '));
      expect(scorrimenti.at(-1)?.classList.contains('area-azione')).toBe(true);
    } finally {
      if (prima) proto.scrollIntoView = prima;
      else delete proto.scrollIntoView;
    }
  });
});

describe('Home', () => {
  it('non mostra più il sottotitolo sotto il logo', () => {
    render(<App />);
    expect(document.querySelector('.home')?.textContent).not.toMatch(/Tenere pecore/);
  });
});

describe('Nuova partita', () => {
  it('dopo una partita, "Nuova partita" riparte con dati nuovi', async () => {
    render(<App />);
    await clic(pulsante('Gioca su questo dispositivo'));
    await clic(pulsante('4'));
    fireEvent.change(document.querySelector('input[aria-label="Nome 1"]')!, { target: { value: 'Ada' } });
    await clic(pulsante('Inizia la partita'));
    await clic(document.querySelector('.pulsante-menu'));
    await clic(pulsante('Esci'));
    await clic(pulsante('Gioca su questo dispositivo'));
    expect(document.querySelectorAll('.giocatore-prep')).toHaveLength(3);
    expect((document.querySelector('input[aria-label="Nome 1"]') as HTMLInputElement).value).toBe('');
  });
});

describe('Riassunto e regole', () => {
  it('nella Home il "?" accanto a "Gioca su questo dispositivo" spiega il passaggio del dispositivo', async () => {
    render(<App />);
    const aiuto = document.querySelector('button[aria-label="Come funziona il gioco su un solo dispositivo"]');
    expect(aiuto?.textContent).toBe('?');
    expect(aiuto?.getAttribute('aria-expanded')).toBe('false');
    // aria-controls punta sempre a un elemento che esiste, nascosto finché la spiegazione è chiusa
    const spiega = document.getElementById(aiuto!.getAttribute('aria-controls')!);
    expect(spiega).not.toBeNull();
    expect((spiega as HTMLElement).hidden).toBe(true);
    await clic(aiuto);
    expect(aiuto?.getAttribute('aria-expanded')).toBe('true');
    expect((spiega as HTMLElement).hidden).toBe(false);
    expect(spiega?.textContent).toMatch(/tutti insieme/);
    expect(spiega?.textContent).toMatch(/passa/);
    await clic(aiuto);
    expect((spiega as HTMLElement).hidden).toBe(true);
  });

  it('la preparazione mostra il riassunto; dalle Regole si torna con le scelte intatte', async () => {
    render(<App />);
    await clic(pulsante('Gioca su questo dispositivo'));
    expect(document.querySelector('.riassunto h2')?.textContent).toBe('Come si gioca, in breve');
    expect(document.querySelectorAll('.riassunto li')).toHaveLength(7);
    // In alto, subito sotto il titolo, l'avviso che le regole sono in fondo.
    const avviso = document.querySelector('.preparazione h1 + .vai-regole');
    expect(avviso?.textContent).toBe('Puoi leggere le regole in fondo ↓');
    await clic(avviso);
    // Oltre a scorrere, porta il punto della tastiera sul titolo del riassunto
    expect(document.activeElement).toBe(document.querySelector('.riassunto h2'));
    await clic(pulsante('4'));
    fireEvent.change(document.querySelector('input[aria-label="Nome 1"]')!, { target: { value: 'Ada' } });
    const radio = document.querySelectorAll('.giocatore-prep')[0]!.querySelectorAll('[role=radio]')[2]!;
    await clic(radio);
    await clic(pulsante('Leggi tutte le regole'));
    expect(document.querySelector('.regole h1')?.textContent).toBe('Regole');
    await clic(pulsante('Indietro'));
    expect(document.querySelectorAll('.giocatore-prep')).toHaveLength(4);
    expect((document.querySelector('input[aria-label="Nome 1"]') as HTMLInputElement).value).toBe('Ada');
    expect(document.querySelectorAll('.giocatore-prep')[0]!.querySelectorAll('[role=radio]')[2]!.getAttribute('aria-checked')).toBe('true');
  });
});
