// @vitest-environment jsdom
// Le stanze (un telefono per giocatore) nella scena 2,5D: tre telefoni completano una partita toccando solo la scena e
// nessuno vede mai la mano di un altro; conto alla rovescia fermo durante la recita e poi in discesa; rifiuto di chi
// ospita che sblocca; mossa in attesa che l'evento di un altro non sblocca; riserva coi pannelli se la scena non arriva.
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IdGiocatore, Stato } from '../../../engine/src';
import { applica } from '../../../engine/src';
import { avanza, chiudiPunteggio, conFaccia, nessunaReazione, prosegui, scegli, scenario } from '../../../engine/test/aiuti';
import { SessioneHost } from '../../../sync/host';
import type { OpzioniHost } from '../../../sync/host';
import { archivioInMemoria } from '../../../sync/locale';
import type { Archivio } from '../../../sync/locale';
import { SessioneOspite, SessioneTavolo } from '../../../sync/ospite';
import { percorsi } from '../../../sync/stanza';
import type { Iscrizione } from '../../../sync/stanza';
import type { Trasporto } from '../../../sync/trasporto';
import { ArchivioMemoria } from '../../../sync/trasporto-memoria';
import type { TrasportoMemoria } from '../../../sync/trasporto-memoria';
import { App } from '../App';
import { Sprite } from '../grafica';
import { caricaScena, scenaRichiesta, usaCaricatoreDiProva } from '../partita/caricaScena';
import { piattaforma } from '../scena/piattaforma';
import { durataRecita } from '../scena/regia/durate';
import type { Fotografia } from '../scena/fotografia';
import type { Domanda, Gesto, IdPulsante } from '../scena/scelte/tipi';
import { archivioHost } from './connessione';
import { ModuloStanza, RegoleInStanza, Stanza, VistaTavolo } from './Stanza';
import { T } from '../testi';

/** Un teatro finto per telefono (lo si riconosce dal contenitore `[data-telefono]` in cui è montato). */
interface TeatroFinto {
  radice: HTMLElement;
  occupato: boolean;
  ascoltatori: Set<(o: boolean) => void>;
  domanda: Domanda | null;
  suGesto: ((g: Gesto) => void) | null;
  /** L'ultima fotografia ricevuta (recita o allinea). */
  foto: Fotografia | null;
  /** L'ultimo `seq` di ogni recita (non dell'allineamento) a cui è stato chiamato. */
  recitate: number[];
}

interface Chiesta {
  telefono: string | null;
  d: Domanda;
  foto: Fotografia | null;
  occupato: boolean;
  cassetto: boolean;
}

const scena = vi.hoisted(() => {
  const vivi = new Set<TeatroFinto>();
  const imposta = (t: TeatroFinto, v: boolean) => {
    if (t.occupato === v) return;
    t.occupato = v;
    for (const cb of [...t.ascoltatori]) cb(v);
  };
  return {
    vivi,
    imposta,
    /** Con `occupaDopoRecita` una recita con eventi nuovi rende il teatro "occupato" finché la prova non chiama `libera()`. */
    occupaDopoRecita: false,
    libera() {
      for (const t of vivi) imposta(t, false);
    },
    /** Ogni fotografia data a un teatro, con il telefono. */
    foto: [] as { telefono: string | null; foto: Fotografia }[],
    chieste: [] as Chiesta[],
    /** Controllo fatto a ogni `chiedi`, nel momento stesso. */
    alChiedere: null as ((c: Chiesta) => void) | null,
    /** Controllo fatto a ogni fotografia data a un teatro (recita o allinea), nel momento stesso. */
    allaFoto: null as ((telefono: string | null, foto: Fotografia) => void) | null,
  };
});
const telefonoDi = (el: HTMLElement) => el.closest('[data-telefono]')?.getAttribute('data-telefono') ?? null;

vi.mock('../scena/teatro', () => ({
  creaTeatro: (radice: HTMLElement) => {
    radice.classList.add('teatro');
    const nulla = () => {};
    const t: TeatroFinto = { radice, occupato: false, ascoltatori: new Set(), domanda: null, suGesto: null, foto: null, recitate: [] };
    scena.vivi.add(t);
    let ultimoSeq: number | null = null;
    const registra = (foto: Fotografia) => {
      t.foto = foto;
      scena.foto.push({ telefono: telefonoDi(radice), foto });
      scena.allaFoto?.(telefonoDi(radice), foto);
    };
    return {
      allinea(foto: Fotografia) {
        registra(foto);
      },
      recita(foto: Fotografia, vista: { eventi: { seq: number }[] }, opz?: { subito?: boolean }) {
        registra(foto);
        const seq = vista.eventi.reduce((m, e) => Math.max(m, e.seq), 0);
        t.recitate.push(seq);
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
        const telefono = telefonoDi(radice);
        const contenitore = radice.closest('[data-telefono]');
        const c: Chiesta = { telefono, d, foto: t.foto, occupato: t.occupato, cassetto: contenitore?.querySelector('.cassetto') != null };
        scena.chieste.push(c);
        scena.alChiedere?.(c);
      },
      smettiDiChiedere() {
        t.domanda = null;
        t.suGesto = null;
      },
      pensa: nulla,
      adatta: nulla,
      sospendi: nulla,
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
      },
      ordini: {},
      ctx: {},
    };
  },
}));

/** Il servizio realtime della prova: quello in memoria (se impostato) al posto di Firebase. */
const rete = vi.hoisted(() => ({ trasporto: null as Trasporto | null }));
vi.mock('./connessione', async (originale) => ({
  ...(await originale<typeof import('./connessione')>()),
  connetti: () => (rete.trasporto ? Promise.resolve(rete.trasporto) : Promise.reject(new Error('rete assente'))),
}));

beforeAll(async () => {
  await caricaScena();
});
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  localStorage.clear();
  sessionStorage.clear();
  scena.vivi.clear();
  scena.foto.length = 0;
  scena.chieste.length = 0;
  scena.alChiedere = null;
  scena.allaFoto = null;
  scena.occupaDopoRecita = false;
  violazioni.length = 0;
  rete.trasporto = null;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function aspetta(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function clic(el: Element | null | undefined) {
  if (!el) throw new Error('elemento mancante');
  await act(async () => {
    fireEvent.click(el);
  });
}

const pulsanteIn = (radice: HTMLElement, testo: string) =>
  [...radice.querySelectorAll('button')].find((b) => !b.disabled && b.textContent?.trim().startsWith(testo));

// ─── Telefoni ───────────────────────────────────────────────────────────────

interface Telefono {
  id: IdGiocatore;
  sessione: SessioneHost | SessioneOspite;
  radice: HTMLElement;
  /** Smonta la pagina di questo telefono (per simulare una ricarica). */
  smonta?: () => void;
}

interface Tavolata {
  rete: ArchivioMemoria;
  host: SessioneHost;
  salvataggio: Archivio;
  bea: SessioneOspite;
  cleo: SessioneOspite;
  tBea: TrasportoMemoria;
  tCleo: TrasportoMemoria;
}

/** Host (Ada) e due ospiti (Bea, Cleo) in sala d'attesa, nei posti g1, g2, g3. */
async function tavolata(opzioni?: OpzioniHost): Promise<Tavolata> {
  const r = new ArchivioMemoria();
  const salvataggio = archivioInMemoria();
  const host = await SessioneHost.crea(r.dispositivo('u1'), salvataggio, { nome: 'Ada', pecora: 'ricciolo', gettone: 'a' }, undefined, opzioni);
  const tBea = r.dispositivo('u2');
  const tCleo = r.dispositivo('u3');
  const bea = await SessioneOspite.entra(tBea, host.codice, { nome: 'Bea', pecora: 'brontolana', gettone: 'b' });
  await aspetta();
  const cleo = await SessioneOspite.entra(tCleo, host.codice, { nome: 'Cleo', pecora: 'sospirella', gettone: 'c' });
  await aspetta();
  return { rete: r, host, salvataggio, bea, cleo, tBea, tCleo };
}

/** Riparte da uno stato costruito (salvataggio + ripresa di chi ospita), come in sync/remoto.test.ts. */
async function conStato(tv: Tavolata, stato: Stato, opzioni?: OpzioniHost): Promise<void> {
  tv.host.chiudi();
  const dati = JSON.parse(tv.salvataggio.leggi()!);
  tv.salvataggio.scrivi(JSON.stringify({ ...dati, stato }));
  const host = await SessioneHost.riprendi(tv.rete.dispositivo('u1'), tv.salvataggio, opzioni);
  if (!host) throw new Error('ripresa fallita');
  tv.host = host;
  await aspetta();
}

/** Monta i tre telefoni, ognuno nel suo contenitore. */
function montaTelefoni(tv: Tavolata): Telefono[] {
  const isc = (ruolo: 'host' | 'ospite', nome: string, gettone: string): Iscrizione => ({
    codice: tv.host.codice,
    ruolo,
    idGiocatore: ruolo === 'host' ? 'g1' : null,
    nome,
    pecora: 'nerina',
    gettone,
  });
  const telefoni: Telefono[] = [
    { id: 'g1', sessione: tv.host, radice: document.createElement('div') },
    { id: 'g2', sessione: tv.bea, radice: document.createElement('div') },
    { id: 'g3', sessione: tv.cleo, radice: document.createElement('div') },
  ];
  render(<Sprite />);
  for (const [i, t] of telefoni.entries()) {
    t.radice.setAttribute('data-telefono', t.id);
    document.body.appendChild(t.radice);
    const [ruolo, nome, gettone] = ([['host', 'Ada', 'a'], ['ospite', 'Bea', 'b'], ['ospite', 'Cleo', 'c']] as const)[i]!;
    const { unmount } = render(<Stanza sessione={t.sessione} iscrizione={isc(ruolo, nome, gettone)} onEsci={() => {}} onRegole={() => {}} />, { container: t.radice });
    t.smonta = unmount;
  }
  return telefoni;
}

const teatroDi = (t: Telefono): TeatroFinto | null => [...scena.vivi].filter((x) => t.radice.contains(x.radice)).at(-1) ?? null;
const domandaDi = (t: Telefono): Domanda | null => teatroDi(t)?.domanda ?? null;

async function gesto(t: Telefono, g: Gesto) {
  const f = teatroDi(t)?.suGesto;
  if (!f) throw new Error(`nessuna domanda sul telefono ${t.id} (${JSON.stringify(g)})`);
  await act(async () => {
    f(g);
  });
}
const premi = (t: Telefono, id: IdPulsante) => gesto(t, { tipo: 'pulsante', id });
const attivo = (d: Domanda, id: IdPulsante) => d.pulsanti.some((p) => p.id === id && p.attivo);
const manoDi = (tv: Tavolata, g: IdGiocatore) => tv.host.vista(g).giocatori.find((x) => x.id === g)!.mano ?? [];

/**
 * La fionda della Testata nella scena del telefono: il teatro finto non ha la zona della fionda (la mira vera è provata in
 * scena/chiedi.test.ts e scena/fionda/), qui arriva il gesto che la mira manda a fine volo, con l'esito più alto permesso.
 */
async function tiraTestata(t: Telefono): Promise<boolean> {
  const f = domandaDi(t)?.fionda;
  if (!f) return false;
  await gesto(t, { tipo: 'fionda', esito: f.massimo });
  await aspetta(1800);
  return true;
}

/** Furto: si tocca ogni recinto finché prende qualcosa, poi Conferma. */
async function ruba(t: Telefono) {
  for (let k = 0; k < 20; k++) {
    let preso = false;
    for (const chi of domandaDi(t)!.pecore) {
      const prima = JSON.stringify(domandaDi(t)!.furto);
      await gesto(t, { tipo: 'pecora', chi });
      if (JSON.stringify(domandaDi(t)?.furto) !== prima) {
        preso = true;
        break;
      }
    }
    if (!preso) break;
  }
  await premi(t, 'conferma');
}

/** Una risposta "da giocatore qualsiasi" alla domanda del telefono, solo con i gesti. */
async function rispondi(t: Telefono, d: Domanda) {
  if (d.dado) {
    await gesto(t, { tipo: 'dado' });
    return aspetta(1000);
  }
  if (d.furto) return ruba(t);
  for (const id of ['attiva', 'prendiGuaio', 'nonScartare'] as const) if (attivo(d, id)) return premi(t, id);
  if (attivo(d, 'fatto') && d.sollevate.length === 0) return premi(t, 'fatto');
  if (d.pecore.length > 0) return gesto(t, { tipo: 'pecora', chi: d.pecore[0]! });
  if (d.grandi.length > 0) return gesto(t, { tipo: 'grande', carta: d.grandi[0]! });
  if (d.carte.length > 0 && d.sollevate.length === 0) {
    await gesto(t, { tipo: 'carta', carta: d.carte[0]! });
    const dopo = domandaDi(t)!;
    for (const id of ['gioca', 'conferma', 'fatto'] as const) if (attivo(dopo, id)) return premi(t, id);
    throw new Error(`nessun pulsante per giocare ${d.carte[0]}: ${dopo.scritta}`);
  }
  for (const id of ['gioca', 'passo', 'conferma', 'rinuncia', 'fatto'] as const) if (attivo(d, id)) return premi(t, id);
  throw new Error(`Nessuna mossa possibile sul telefono ${t.id}: ${d.scritta} ${JSON.stringify(d.pulsanti)}`);
}

/** Una mossa toccando la scena del telefono, se c'è una domanda (la scelta segreta già fatta non si ripete all'infinito). */
async function passoTelefono(tv: Tavolata, t: Telefono): Promise<boolean> {
  if (await tiraTestata(t)) return true;
  const d = domandaDi(t);
  if (!d) return false;
  const f = tv.host.vista(t.id).fase;
  if ((f.nome === 'scelta' || f.nome === 'belato_finale') && f.miaScelta !== null) return false;
  await rispondi(t, d);
  return true;
}

/**
 * Violazioni trovate dai controlli qui sotto. I controlli girano dentro il teatro finto, cioè negli effetti della scena:
 * un `expect` che lancia lì finirebbe nel confine della scena (il telefono passa alla riserva) senza far fallire la
 * prova. Per questo si annotano e si guarda alla fine che non ce ne siano.
 */
const violazioni: string[] = [];
function annota(controllo: () => void): void {
  try {
    controllo();
  } catch (e) {
    violazioni.push(e instanceof Error ? e.message : String(e));
  }
}

/** Punto di revisione 1: a ogni domanda, sul telefono solo la propria mano, mai il cassetto, mai a scena occupata. */
function controllaOgniDomanda(tv: Tavolata, telefoni: Telefono[]) {
  scena.alChiedere = (c) => annota(() => {
    const t = telefoni.find((x) => x.id === c.telefono);
    expect(t, 'ogni teatro sta in un telefono').toBeDefined();
    expect(c.cassetto, c.d.scritta).toBe(false);
    expect(c.occupato, c.d.scritta).toBe(false);
    expect(c.foto?.posti[0]?.id).toBe(t!.id);
    // La mano nella fotografia è quella del telefono, presa dalla sua vista
    const mia = t!.sessione.vista(t!.id).giocatori.find((g) => g.id === t!.id)?.mano ?? [];
    expect([...(c.foto?.mano ?? [])].sort()).toEqual([...mia].sort());
    // Nessuna carta della mano di un altro giocatore, né nella fotografia né tra le carte toccabili
    const altrui = new Set(telefoni.filter((x) => x.id !== t!.id).flatMap((x) => manoDi(tv, x.id)));
    for (const carta of [...(c.foto?.mano ?? []), ...c.d.carte, ...c.d.sollevate]) expect(altrui.has(carta), carta).toBe(false);
  });
}

/**
 * Anti-sbirciata su OGNI fotografia data a un teatro: in basso c'è il giocatore del telefono, e la mano è esattamente la sua
 * (letta dalla sua vista nel momento stesso), mai una carta di un altro.
 */
function controllaOgniFoto(tv: Tavolata, telefoni: Telefono[]) {
  scena.allaFoto = (telefono, foto) => annota(() => {
    const t = telefoni.find((x) => x.id === telefono);
    expect(t, 'ogni teatro sta in un telefono').toBeDefined();
    expect(foto.posti[0]?.id).toBe(t!.id);
    const mia = t!.sessione.vista(t!.id).giocatori.find((g) => g.id === t!.id)?.mano ?? [];
    expect([...(foto.mano ?? [])].sort()).toEqual([...mia].sort());
    const altrui = new Set(telefoni.filter((x) => x.id !== t!.id).flatMap((x) => manoDi(tv, x.id)));
    for (const carta of foto.mano ?? []) expect(altrui.has(carta), carta).toBe(false);
  });
}

/** Stato costruito: Ada (g1, host) lancia il dado; Bea ha un Beee-NO!; con `cleoNo` anche Cleo. */
function statoAlDado(cleoNo = false): Stato {
  let s = prosegui(
    scenario({
      giocatori: [
        { id: 'g1', nome: 'Ada', pecora: 'ricciolo' },
        { id: 'g2', nome: 'Bea', pecora: 'brontolana' },
        { id: 'g3', nome: 'Cleo', pecora: 'sospirella' },
      ],
      guaio: 'tosatura-a-sorpresa',
      mani: { g1: ['carriola'], g2: ['balla-di-fieno', 'beee-no'], g3: cleoNo ? ['coperta-di-lana', 'beee-no'] : ['coperta-di-lana'] },
    }),
  );
  s = chiudiPunteggio(avanza(scegli(s, { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['coperta-di-lana'] })));
  return conFaccia(s, 'pascolo_grande');
}

const beeeNo = (tv: Tavolata, g: IdGiocatore) => manoDi(tv, g).find((c) => c.startsWith('beee-no'))!;

/** Stato costruito: Belati di punteggio aperti per tutti; Bea ha un Belato di gruppo, Cleo una Pernacchia. */
function statoAlPunteggio(): Stato {
  const s = prosegui(
    scenario({
      giocatori: [
        { id: 'g1', nome: 'Ada', pecora: 'ricciolo' },
        { id: 'g2', nome: 'Bea', pecora: 'brontolana' },
        { id: 'g3', nome: 'Cleo', pecora: 'sospirella' },
      ],
      guaio: 'tosatura-a-sorpresa',
      mani: { g1: ['carriola'], g2: ['balla-di-fieno', 'belato-di-gruppo'], g3: ['coperta-di-lana', 'pernacchia'] },
    }),
  );
  return avanza(scegli(s, { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['coperta-di-lana'] }));
}

/** Gioca il Belato di punteggio di `g` direttamente dalla sua sessione (senza toccare il suo telefono). */
function giocaBelatoDi(s: SessioneOspite, g: IdGiocatore) {
  const a = s.azioni(g).find((x) => x.tipo === 'giocaBelato');
  if (!a) throw new Error(`${g} non ha un Belato da giocare`);
  s.invia(a);
}

// ─── Prove ──────────────────────────────────────────────────────────────────

describe("Schermate sempre con un'uscita", () => {
  it('chi arriva a partita iniziata vede il motivo e può uscire', async () => {
    const r = new ArchivioMemoria();
    const host = await SessioneHost.crea(r.dispositivo('u1'), archivioInMemoria(), { nome: 'Ada', pecora: 'ricciolo', gettone: 'a' });
    await SessioneOspite.entra(r.dispositivo('u2'), host.codice, { nome: 'Bea', pecora: 'nerina', gettone: 'b' });
    await aspetta();
    host.inizia(1);
    await aspetta();
    const tardi = await SessioneOspite.entra(r.dispositivo('u3'), host.codice, { nome: 'Cleo', pecora: 'sospirella', gettone: 'c' });
    await aspetta();
    let uscito = false;
    const isc: Iscrizione = { codice: host.codice, ruolo: 'ospite', idGiocatore: null, nome: 'Cleo', pecora: 'sospirella', gettone: 'c' };
    render(<Stanza sessione={tardi} iscrizione={isc} onEsci={() => (uscito = true)} onRegole={() => {}} />);
    await aspetta();
    expect(document.body.textContent).toMatch(/già iniziata/);
    await clic(pulsanteIn(document.body, 'Esci'));
    expect(uscito).toBe(true);
  });

  it('nel velo di pausa ci sono Regole ed Esci anche per gli ospiti', async () => {
    const r = new ArchivioMemoria();
    const host = await SessioneHost.crea(r.dispositivo('u1'), archivioInMemoria(), { nome: 'Ada', pecora: 'ricciolo', gettone: 'a' });
    const bea = await SessioneOspite.entra(r.dispositivo('u2'), host.codice, { nome: 'Bea', pecora: 'nerina', gettone: 'b' });
    await aspetta();
    host.inizia(1);
    await aspetta();
    host.chiudi(); // l'host chiude il browser
    await aspetta();
    const isc: Iscrizione = { codice: host.codice, ruolo: 'ospite', idGiocatore: 'g2', nome: 'Bea', pecora: 'nerina', gettone: 'b' };
    const aperte: (readonly string[] | null)[] = [];
    render(<Stanza sessione={bea} iscrizione={isc} onEsci={() => {}} onRegole={(n) => aperte.push(n)} />);
    await aspetta();
    const velo = document.querySelector('[role=alertdialog]') as HTMLElement;
    expect(velo.textContent).toMatch(/host/);
    expect(pulsanteIn(velo, 'Esci')).toBeDefined();
    // Dal velo di pausa le Regole hanno i nomi della partita
    await clic(pulsanteIn(velo, 'Regole'));
    expect(aperte).toEqual([['Ada', 'Bea']]);
  });

  it("la sala d'attesa mostra il riassunto e il collegamento alle Regole", async () => {
    const r = new ArchivioMemoria();
    const host = await SessioneHost.crea(r.dispositivo('u1'), archivioInMemoria(), { nome: 'Ada', pecora: 'ricciolo', gettone: 'a' });
    await aspetta();
    const aperte: (readonly string[] | null)[] = [];
    const isc: Iscrizione = { codice: host.codice, ruolo: 'host', idGiocatore: host.idGiocatore, nome: 'Ada', pecora: 'ricciolo', gettone: 'a' };
    render(<Stanza sessione={host} iscrizione={isc} onEsci={() => {}} onRegole={(n) => aperte.push(n)} />);
    await aspetta();
    expect(document.querySelector('.sala .riassunto h2')?.textContent).toBe('Come si gioca, in breve');
    await clic(pulsanteIn(document.body, 'Leggi tutte le regole'));
    // Dalla sala d'attesa: nomi di esempio
    expect(aperte).toEqual([null]);
  });
});

describe('Regole aperte dalla stanza', () => {
  /** Stato costruito: la scelta segreta, tutti e tre devono ancora scegliere. */
  const statoAllaScelta = (): Stato =>
    prosegui(
      scenario({
        giocatori: [
          { id: 'g1', nome: 'Ada', pecora: 'ricciolo' },
          { id: 'g2', nome: 'Bea', pecora: 'brontolana' },
          { id: 'g3', nome: 'Cleo', pecora: 'sospirella' },
        ],
        guaio: 'tosatura-a-sorpresa',
        mani: { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['coperta-di-lana'] },
      }),
    );
  const richiamo = () => document.querySelector<HTMLElement>('.regole-richiamo[role=alert]');

  it("in partita, dal menu: onRegole con i nomi della stanza nell'ordine dei posti", async () => {
    const tv = await tavolata();
    tv.host.inizia(1);
    await aspetta();
    const aperte: (readonly string[] | null)[] = [];
    const isc: Iscrizione = { codice: tv.host.codice, ruolo: 'host', idGiocatore: 'g1', nome: 'Ada', pecora: 'ricciolo', gettone: 'a' };
    render(<Stanza sessione={tv.host} iscrizione={isc} onEsci={() => {}} onRegole={(n) => aperte.push(n)} />);
    await aspetta();
    await clic(document.querySelector('.pulsante-menu'));
    await clic(pulsanteIn(document.querySelector<HTMLElement>('.menu')!, 'Regole'));
    expect(aperte).toEqual([['Ada', 'Bea', 'Cleo']]);
  });

  it('la riga "va avanti" in partita; il richiamo solo quando la partita aspetta la tua scelta, e "Torna alla partita"', async () => {
    const tv = await tavolata();
    tv.host.inizia(1);
    await aspetta();
    await conStato(tv, statoAllaScelta());
    let tornato = 0;
    render(<RegoleInStanza sessione={tv.host} nomi={['Ada', 'Bea', 'Cleo']} onIndietro={() => tornato++} />);
    await aspetta();
    expect(document.querySelector('.regole h1')?.textContent).toBe('Regole');
    // La scelta segreta aspetta Ada: il richiamo c'è, al posto della riga
    expect(richiamo()?.textContent).toContain(T.regole.richiamo);
    // Un altro sceglie: la partita aspetta ancora Ada, il richiamo resta acceso (non lampeggia)
    await act(async () => {
      tv.bea.invia(tv.bea.azioni('g2').find((a) => a.tipo === 'scegliTrovata')!);
    });
    await aspetta(50);
    expect(richiamo()).not.toBeNull();
    await clic(pulsanteIn(richiamo()!, T.regole.tornaAllaPartita));
    expect(tornato).toBe(1);
    // Ada sceglie: non tocca più a lei, il richiamo va via e torna la riga
    await act(async () => {
      tv.host.invia(tv.host.azioni('g1').find((a) => a.tipo === 'scegliTrovata')!);
    });
    await aspetta(50);
    expect(richiamo()).toBeNull();
    expect(document.querySelector('.regole-stanza')?.textContent).toBe(T.regole.stanzaVaAvanti);
  });

  it('la finestra del Beee-NO! di un altro non accende il richiamo, anche con un Beee-NO! in mano', async () => {
    const tv = await tavolata();
    tv.host.inizia(1);
    await aspetta();
    await conStato(tv, statoAlDado());
    render(<RegoleInStanza sessione={tv.bea} nomi={['Ada', 'Bea', 'Cleo']} onIndietro={() => {}} />);
    await aspetta(50);
    // Tocca ad Ada (dado): per Bea niente richiamo
    expect(richiamo()).toBeNull();
    let finestra = false;
    for (let i = 0; i < 10 && !finestra; i++) {
      const a = tv.host.azioni('g1')[0];
      if (!a) break;
      await act(async () => {
        tv.host.invia(a);
      });
      await aspetta(50);
      finestra = tv.bea.vista('g2').finestra !== null && tv.bea.azioni('g2').some((x) => x.tipo === 'giocaBelato' && x.carta.startsWith('beee-no'));
      expect(richiamo(), JSON.stringify(tv.bea.vista('g2').fase)).toBeNull();
    }
    // Bea potrebbe rispondere col suo Beee-NO!, ma la partita non aspetta lei
    expect(finestra).toBe(true);
    expect(richiamo()).toBeNull();
    expect(document.querySelector('.regole-stanza')).not.toBeNull();
  });

  it('neanche i Belati di punteggio (una finestra col tempo) accendono il richiamo', async () => {
    const tv = await tavolata();
    tv.host.inizia(1);
    await aspetta();
    await conStato(tv, statoAlPunteggio());
    render(<RegoleInStanza sessione={tv.host} nomi={['Ada', 'Bea', 'Cleo']} onIndietro={() => {}} />);
    await aspetta(50);
    expect(tv.host.vista('g1').fase.nome).toBe('belati_punteggio');
    expect(tv.host.azioni('g1').length).toBeGreaterThan(0);
    expect(richiamo()).toBeNull();
  });

  it('stanza in pausa: per chi aspetta la riga dice che la partita è in pausa, senza richiamo', async () => {
    const tv = await tavolata();
    tv.host.inizia(1);
    await aspetta();
    await conStato(tv, statoAllaScelta());
    tv.host.chiudi(); // chi ospita chiude il browser
    await aspetta(100);
    render(<RegoleInStanza sessione={tv.bea} nomi={['Ada', 'Bea', 'Cleo']} onIndietro={() => {}} />);
    await aspetta(50);
    expect(document.querySelector('.regole-stanza')?.textContent).toBe(T.regole.stanzaInPausa);
    expect(richiamo()).toBeNull();
  });

  it('un ospite si scollega: chi ospita ha il richiamo per decidere (stesso posto in cima), chi aspetta la riga della pausa', async () => {
    const tv = await tavolata();
    tv.host.inizia(1);
    await aspetta();
    await conStato(tv, statoAllaScelta());
    tv.cleo.chiudi();
    await aspetta(100);
    expect(tv.host.pubblico().pausa).toEqual(['g3']);
    const host = render(<RegoleInStanza sessione={tv.host} nomi={['Ada', 'Bea', 'Cleo']} onIndietro={() => {}} />);
    await aspetta(50);
    expect(richiamo()?.textContent).toContain(T.regole.richiamoScollegato);
    expect(document.querySelector('main.regole > .regole-richiamo:first-child + h1')).not.toBeNull();
    expect(document.querySelector('.regole-stanza')).toBeNull();
    host.unmount();
    render(<RegoleInStanza sessione={tv.bea} nomi={['Ada', 'Bea', 'Cleo']} onIndietro={() => {}} />);
    await aspetta(50);
    expect(richiamo()).toBeNull();
    expect(document.querySelector('.regole-stanza')?.textContent).toBe(T.regole.stanzaInPausa);
  });

  it('a partita finita la riga dice che è finita, senza richiamo', async () => {
    const tv = await tavolata();
    tv.host.inizia(1);
    await aspetta();
    await conStato(tv, { ...statoAllaScelta(), fase: { nome: 'fine_partita' }, esito: { modo: 'mazzo_finito', vincitori: ['g1'] } });
    render(<RegoleInStanza sessione={tv.host} nomi={['Ada', 'Bea', 'Cleo']} onIndietro={() => {}} />);
    await aspetta(50);
    expect(document.querySelector('.regole-stanza')?.textContent).toBe(T.regole.stanzaFinita);
    expect(richiamo()).toBeNull();
  });

  it('in partita e senza pausa la riga dice che la partita va avanti', async () => {
    const tv = await tavolata();
    tv.host.inizia(1);
    await aspetta();
    await conStato(tv, statoAllaScelta());
    render(<RegoleInStanza sessione={tv.bea} nomi={['Ada', 'Bea', 'Cleo']} onIndietro={() => {}} />);
    await aspetta(50);
    // Bea ha ancora da scegliere: il richiamo; scelto, la riga
    expect(richiamo()).not.toBeNull();
    await act(async () => {
      tv.bea.invia(tv.bea.azioni('g2').find((a) => a.tipo === 'scegliTrovata')!);
    });
    await aspetta(100);
    expect(richiamo()).toBeNull();
    expect(document.querySelector('.regole-stanza')?.textContent).toBe(T.regole.stanzaVaAvanti);
  });

  it("in sala d'attesa: niente riga e niente richiamo, ma il posto della riga è già tenuto (vuoto e muto)", async () => {
    const tv = await tavolata();
    render(<RegoleInStanza sessione={tv.host} nomi={null} onIndietro={() => {}} />);
    await aspetta();
    expect(document.querySelector('.regole h1')?.textContent).toBe('Regole');
    const posto = document.querySelector('main.regole > .regole-stanza:first-child');
    expect(posto?.classList.contains('regole-riserva')).toBe(true);
    expect(posto?.textContent).toBe('');
    expect(posto?.getAttribute('aria-hidden')).toBe('true');
    expect(richiamo()).toBeNull();
    // La partita comincia: la riga compare nello stesso posto, il titolo non si sposta
    await act(async () => {
      tv.host.inizia(1);
    });
    await aspetta(50);
    const riga = document.querySelector('main.regole > .regole-stanza:first-child');
    expect(riga?.classList.contains('regole-riserva')).toBe(false);
    expect(riga?.textContent).toBe(T.regole.stanzaVaAvanti);
    expect(document.querySelectorAll('.regole-stanza')).toHaveLength(1);
  });

  /** Il gioco vero: chi ospita (Ada) rientra con App dopo un ricaricamento, Bea è ospite; si arriva alla scelta segreta. */
  async function stanzaInApp(): Promise<{ bea: SessioneOspite }> {
    const r = new ArchivioMemoria();
    const prima = await SessioneHost.crea(r.dispositivo('u1'), archivioHost(), { nome: 'Ada', pecora: 'ricciolo', gettone: 'a' });
    const bea = await SessioneOspite.entra(r.dispositivo('u2'), prima.codice, { nome: 'Bea', pecora: 'brontolana', gettone: 'b' });
    await aspetta();
    prima.inizia(1);
    await aspetta();
    prima.chiudi();
    localStorage.setItem('hls-iscrizione', JSON.stringify(prima.iscrizione()));
    sessionStorage.setItem('hls-in-stanza', prima.codice);
    rete.trasporto = r.dispositivo('u1');
    render(<App />);
    await aspetta(100);
    // La partita arriva alla scelta segreta (le fasi automatiche le fa avanzare chi ospita)
    for (let i = 0; i < 40 && document.querySelector('.pulsante-menu') === null; i++) await aspetta(500);
    for (let i = 0; i < 40 && bea.vista('g2').fase.nome !== 'scelta'; i++) await aspetta(500);
    expect(bea.vista('g2').fase.nome).toBe('scelta');
    return { bea };
  }

  it('nel gioco vero (App): dal menu della partita le Regole hanno i nomi, la riga e il richiamo; "Torna alla partita" riporta alla partita', async () => {
    const { bea } = await stanzaInApp();
    await clic(document.querySelector('.pulsante-menu'));
    await clic(pulsanteIn(document.querySelector<HTMLElement>('.menu')!, 'Regole'));
    expect(document.querySelector('.regole h1')?.textContent).toBe('Regole');
    expect(richiamo()?.textContent).toContain(T.regole.richiamo);
    const esempi = [...document.querySelectorAll('.regole h2 button')].find((b) => b.textContent?.includes('Tre esempi'))!;
    await clic(esempi);
    const testo = document.getElementById(esempi.getAttribute('aria-controls')!)!.textContent!;
    expect(testo).toContain('Ada');
    expect(testo).toContain('Bea');
    await clic(pulsanteIn(richiamo()!, T.regole.tornaAllaPartita));
    expect(document.querySelector('.regole')).toBeNull();
    expect(document.querySelector('.partita')).not.toBeNull();
    bea.chiudi();
  });

  it('nel gioco vero (App): lo schermo resta acceso leggendo le Regole; un blocco solo, rilasciato uscendo dalla stanza', async () => {
    const rilasci = vi.fn(async () => {});
    const chiesti = vi.fn(async (_tipo: 'screen') => ({ release: rilasci }));
    Object.defineProperty(globalThis.navigator, 'wakeLock', { value: { request: chiesti }, configurable: true });
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    try {
      const { bea } = await stanzaInApp();
      expect(chiesti).toHaveBeenCalledTimes(1);
      expect(chiesti).toHaveBeenCalledWith('screen');
      await clic(document.querySelector('.pulsante-menu'));
      await clic(pulsanteIn(document.querySelector<HTMLElement>('.menu')!, 'Regole'));
      expect(document.querySelector('.regole h1')).not.toBeNull();
      await aspetta(1000);
      // Mentre si leggono le Regole il blocco resta (niente rilascio, niente nuova richiesta)
      expect(rilasci).not.toHaveBeenCalled();
      expect(chiesti).toHaveBeenCalledTimes(1);
      await clic(pulsanteIn(document.body, T.regole.indietro));
      expect(document.querySelector('.partita')).not.toBeNull();
      expect(chiesti).toHaveBeenCalledTimes(1);
      expect(rilasci).not.toHaveBeenCalled();
      // Uscendo dalla stanza il blocco si rilascia
      await clic(document.querySelector('.pulsante-menu'));
      await clic(pulsanteIn(document.querySelector<HTMLElement>('.menu')!, 'Esci'));
      await aspetta();
      expect(document.querySelector('.partita')).toBeNull();
      expect(rilasci).toHaveBeenCalledTimes(1);
      bea.chiudi();
    } finally {
      delete (globalThis.navigator as unknown as { wakeLock?: unknown }).wakeLock;
    }
  });

  it('nel gioco vero (App): dal velo di pausa chi ospita ha il richiamo per decidere; al ritorno il punto della tastiera torna sul "Regole" del velo', async () => {
    const { bea } = await stanzaInApp();
    bea.chiudi();
    for (let i = 0; i < 20 && document.querySelector('[role=alertdialog]') === null; i++) await aspetta(500);
    const velo = document.querySelector<HTMLElement>('[role=alertdialog]')!;
    expect(velo).not.toBeNull();
    const regole = pulsanteIn(velo, 'Regole')!;
    regole.focus();
    await clic(regole);
    expect(richiamo()?.textContent).toContain(T.regole.richiamoScollegato);
    await clic(pulsanteIn(document.body, T.regole.indietro));
    expect(document.activeElement?.textContent).toBe('Regole');
    expect(document.activeElement?.closest('[role=alertdialog]')).not.toBeNull();
  });
});

describe('Tre telefoni nella scena', () => {
  it("dalla sala d'attesa alla fine solo toccando la scena: mai la mano di un altro, mai cassetto né Spettacolo, la classifica dopo la festa", async () => {
    const tv = await tavolata();
    const telefoni = montaTelefoni(tv);
    await aspetta();
    for (const t of telefoni) expect(t.radice.querySelector('.codice-grande')?.textContent).toBe(tv.host.codice);
    expect(pulsanteIn(telefoni[1]!.radice, 'Inizia')).toBeUndefined();

    controllaOgniDomanda(tv, telefoni);
    controllaOgniFoto(tv, telefoni);
    let spettacolo = false;
    const osserva = new MutationObserver(() => {
      if (document.querySelector('.spettacolo')) spettacolo = true;
    });
    osserva.observe(document.body, { childList: true, subtree: true });
    // La scena recita ogni mossa: finché non la si libera le domande e la classifica aspettano
    scena.occupaDopoRecita = true;

    await clic(pulsanteIn(telefoni[0]!.radice, 'Inizia la partita'));
    await aspetta();
    let giri = 0;
    while (!tv.host.vista(null).esito) {
      if (++giri > 4000) throw new Error('la partita non finisce');
      await act(async () => scena.libera());
      let mosso = false;
      for (const t of [...telefoni.slice(giri % 3), ...telefoni.slice(0, giri % 3)]) {
        // Mai pannelli con la scena montata, mai errori
        expect(t.radice.querySelector('.area-azione')).toBeNull();
        expect(t.radice.querySelector('.errore')).toBeNull();
        if (await passoTelefono(tv, t)) {
          mosso = true;
          await aspetta();
          break;
        }
      }
      if (!mosso) await aspetta(7000);
    }
    await aspetta();
    osserva.disconnect();

    // La festa: finché la scena recita la fine, niente classifica; poi la classifica e la rivincita
    for (const t of telefoni) expect(t.radice.querySelector('.fine-partita')).toBeNull();
    await act(async () => scena.libera());
    await aspetta();
    for (const t of telefoni) expect(t.radice.querySelector('.fine-partita h2')?.textContent).toMatch(/^Vinc/);
    expect(pulsanteIn(telefoni[0]!.radice, 'Nuova partita con gli stessi giocatori')).toBeDefined();

    expect(spettacolo).toBe(false);
    for (const id of ['g1', 'g2', 'g3']) expect(scena.chieste.filter((c) => c.telefono === id).length).toBeGreaterThan(5);
    // Ogni fotografia data a un telefono ha la mano scoperta: è sempre la sua
    for (const f of scena.foto) {
      expect(f.foto.posti[0]?.id).toBe(f.telefono);
      expect(f.foto.mano).not.toBeNull();
    }
    expect(violazioni).toEqual([]);
  }, 180_000);
});

describe('Un ospite che ricarica la pagina', () => {
  it('dopo il rientro ogni fotografia del suo telefono ha solo la sua mano, e gli altri telefoni non vedono mai la sua', async () => {
    const tv = await tavolata();
    const telefoni = montaTelefoni(tv);
    await aspetta();
    controllaOgniDomanda(tv, telefoni);
    controllaOgniFoto(tv, telefoni);
    scena.occupaDopoRecita = true;
    await clic(pulsanteIn(telefoni[0]!.radice, 'Inizia la partita'));
    await aspetta();
    const gioca = async (giri: number) => {
      for (let giro = 1; giro <= giri && !tv.host.vista(null).esito; giro++) {
        await act(async () => scena.libera());
        let mosso = false;
        for (const t of [...telefoni.slice(giro % 3), ...telefoni.slice(0, giro % 3)]) {
          // La scena resta su in ogni telefono: niente riserva, niente pannelli
          expect(t.radice.querySelector('.scena-non-caricata'), t.id).toBeNull();
          expect(t.radice.querySelector('.area-azione'), t.id).toBeNull();
          if (await passoTelefono(tv, t)) {
            mosso = true;
            await aspetta();
            break;
          }
        }
        if (!mosso) await aspetta(7000);
      }
    };
    await gioca(40);

    // Bea ricarica: la vecchia pagina sparisce, quella nuova rientra con la stessa identità e ritrova la sua mano
    const vecchia = telefoni[1]!;
    const fotoPrima = scena.foto.length;
    vecchia.smonta!();
    tv.bea.chiudi();
    await aspetta();
    const iscrizione: Iscrizione = { codice: tv.host.codice, ruolo: 'ospite', idGiocatore: 'g2', nome: 'Bea', pecora: 'brontolana', gettone: 'b' };
    const nuova = await SessioneOspite.rientra(tv.rete.dispositivo('u2'), iscrizione);
    await aspetta();
    // La pagina nuova ha un contenitore nuovo
    vecchia.radice.remove();
    const radice = document.createElement('div');
    radice.setAttribute('data-telefono', 'g2');
    document.body.appendChild(radice);
    const { unmount } = render(<Stanza sessione={nuova} iscrizione={iscrizione} onEsci={() => {}} onRegole={() => {}} />, { container: radice });
    telefoni[1] = { id: 'g2', sessione: nuova, radice, smonta: unmount };
    await aspetta();
    expect(scena.foto.slice(fotoPrima).some((f) => f.telefono === 'g2')).toBe(true);
    expect(manoDi(tv, 'g2').length).toBeGreaterThan(0);

    // Si continua a giocare con il telefono rientrato: ogni fotografia e ogni domanda restano controllate
    const prima = scena.foto.length;
    await gioca(40);
    expect(scena.foto.length).toBeGreaterThan(prima);
    for (const f of scena.foto.slice(fotoPrima)) expect(f.foto.posti[0]?.id).toBe(f.telefono);
    expect(scena.foto.slice(fotoPrima).filter((f) => f.telefono === 'g2').every((f) => f.foto.mano !== null)).toBe(true);
    expect(violazioni).toEqual([]);
  }, 180_000);
});

describe('Conto alla rovescia nella striscia', () => {
  it('pieno e fermo per la durata normale della recita, poi scende fino alla scadenza; alla scadenza la finestra si chiude', async () => {
    const opzioni: OpzioniHost = { durataRecita: (eventi) => (eventi.length > 0 ? 3000 : 0) };
    const tv = await tavolata(opzioni);
    tv.host.inizia(1);
    await aspetta();
    await conStato(tv, statoAlDado(), opzioni);
    const telefoni = montaTelefoni(tv);
    await aspetta();
    const finestraMs = tv.host.pubblico().impostazioni.finestraSecondi * 1000;
    const conto = (t: Telefono) => t.radice.querySelector<HTMLElement>('.testata-scena .conto');
    const larghezza = (t: Telefono) => parseFloat(conto(t)!.querySelector<HTMLElement>('.conto-barra')!.style.width);
    for (const t of telefoni) expect(conto(t)).toBeNull();

    await act(async () => {
      tv.host.invia({ tipo: 'lanciaDado', giocatore: 'g1' });
    });
    await aspetta(300);
    // Tutti i telefoni (chi può rispondere e chi aspetta): pieno e fermo
    for (const t of telefoni) {
      expect(conto(t), t.id).not.toBeNull();
      expect(conto(t)!.classList.contains('fermo')).toBe(true);
      expect(larghezza(t)).toBe(100);
    }
    expect(domandaDi(telefoni[1]!), 'Bea può rispondere col Beee-NO!').not.toBeNull();
    await aspetta(2400); // ~2,7 s: la scena recita ancora
    for (const t of telefoni) {
      expect(conto(t)!.classList.contains('fermo')).toBe(true);
      expect(larghezza(t)).toBe(100);
    }
    await aspetta(1800); // ~4,5 s: scorre
    for (const t of telefoni) {
      expect(conto(t)!.classList.contains('fermo')).toBe(false);
      expect(larghezza(t)).toBeLessThan(100);
      expect(larghezza(t)).toBeGreaterThan(50);
    }
    expect(tv.host.vista(null).finestra).not.toBeNull();
    await aspetta(3000 + finestraMs - 4500 + 300); // oltre la scadenza
    expect(tv.host.vista(null).finestra).toBeNull();
    for (const t of telefoni) expect(conto(t)).toBeNull();
  });
});

describe('Rifiuto di chi ospita e mossa in attesa', () => {
  it('Beee-NO! arrivato dopo quello di un altro: rifiutato, messaggio nella striscia, la scelta riparte vuota e si può rigiocare', async () => {
    const tv = await tavolata();
    tv.host.inizia(1);
    await aspetta();
    await conStato(tv, statoAlDado(true));
    const telefoni = montaTelefoni(tv);
    const cleo = telefoni[2]!;
    await aspetta();
    await act(async () => {
      tv.host.invia({ tipo: 'lanciaDado', giocatore: 'g1' });
    });
    await aspetta();
    const suo = beeeNo(tv, 'g3');
    await gesto(cleo, { tipo: 'carta', carta: suo });
    expect(domandaDi(cleo)!.sollevate).toEqual([suo]);
    // Il Beee-NO! di Bea arriva a chi ospita prima di quello di Cleo, pensato per il dado
    const f = teatroDi(cleo)!.suGesto!;
    await act(async () => {
      tv.bea.invia(tv.bea.azioni('g2').find((a) => a.tipo === 'giocaBelato')!);
      f({ tipo: 'pulsante', id: 'gioca' });
    });
    await aspetta();
    expect(tv.cleo.rifiuto()?.messaggio).toBeTruthy();
    expect(cleo.radice.querySelector('.testata-scena .errore')?.textContent).toBe(tv.cleo.rifiuto()!.messaggio);
    // Sbloccata e vuota: Cleo risponde al Beee-NO! di Bea
    expect(domandaDi(cleo)!.sollevate).toEqual([]);
    await gesto(cleo, { tipo: 'carta', carta: suo });
    await premi(cleo, 'gioca');
    await aspetta();
    expect(manoDi(tv, 'g3')).not.toContain(suo);
    expect(tv.host.vista(null).pila.at(-1)?.autore).toBe('g3');
  });

  it('una mossa che aspetta chi ospita: il rifiuto la sblocca e svuota la scelta (anche senza altri cambi)', async () => {
    const tv = await tavolata();
    tv.host.inizia(1);
    await aspetta();
    await conStato(tv, statoAlDado(true));
    const telefoni = montaTelefoni(tv);
    const cleo = telefoni[2]!;
    await aspetta();
    await act(async () => {
      tv.host.invia({ tipo: 'lanciaDado', giocatore: 'g1' });
    });
    await aspetta();
    // La mossa di Cleo parte ma non arriva mai a chi ospita
    const mandate = vi.spyOn(tv.tCleo, 'aggiungi').mockImplementation(() => new Promise(() => {}));
    const suo = beeeNo(tv, 'g3');
    await gesto(cleo, { tipo: 'carta', carta: suo });
    await premi(cleo, 'gioca');
    expect(mandate).toHaveBeenCalledTimes(1);
    await premi(cleo, 'gioca');
    expect(mandate).toHaveBeenCalledTimes(1);
    expect(domandaDi(cleo)!.sollevate).toEqual([suo]);
    // Chi ospita la rifiuta
    await act(async () => {
      await tv.rete.dispositivo('u1').scrivi(percorsi(tv.host.codice).rifiuto('u3'), { messaggio: 'Mossa non valida', quando: tv.host.ora() + 1 });
    });
    await aspetta();
    expect(cleo.radice.querySelector('.testata-scena .errore')?.textContent).toBe('Mossa non valida');
    expect(domandaDi(cleo)!.sollevate).toEqual([]);
    await gesto(cleo, { tipo: 'carta', carta: suo });
    await premi(cleo, 'gioca');
    expect(mandate).toHaveBeenCalledTimes(2);
  });

  it('chi ospita passa nei Belati di punteggio, un ospite gioca un Belato, la finestra scade: chi ospita può passare di nuovo', async () => {
    const tv = await tavolata();
    tv.host.inizia(1);
    await aspetta();
    await conStato(tv, statoAlPunteggio());
    const telefoni = montaTelefoni(tv);
    const ada = telefoni[0]!;
    await aspetta();
    expect(tv.host.vista(null).fase.nome).toBe('belati_punteggio');
    await premi(ada, 'passo');
    await aspetta();
    const fase = () => tv.host.vista(null).fase as { nome: string; inAttesa?: string[] };
    expect(fase().inAttesa).not.toContain('g1');
    // Bea gioca il suo Belato: si apre la finestra del Beee-NO!, Ada non tocca niente e la finestra scade
    await act(async () => giocaBelatoDi(tv.bea, 'g2'));
    await aspetta();
    expect(tv.host.vista(null).finestra).not.toBeNull();
    await aspetta(tv.host.pubblico().impostazioni.finestraSecondi * 1000 + 300);
    expect(tv.host.vista(null).finestra).toBeNull();
    // I Belati di punteggio si riaprono per tutti: la stessa domanda di prima, e il "Passo" di Ada deve partire
    expect(fase().inAttesa).toContain('g1');
    await premi(ada, 'passo');
    await aspetta();
    expect(fase().inAttesa).not.toContain('g1');
  });

  it('lo stesso per un ospite: tornato alla stessa domanda risponde subito, senza aspettare i 4 s', async () => {
    const tv = await tavolata();
    tv.host.inizia(1);
    await aspetta();
    await conStato(tv, statoAlPunteggio());
    const telefoni = montaTelefoni(tv);
    const bea = telefoni[1]!;
    await aspetta();
    await premi(bea, 'passo');
    await aspetta();
    const fase = () => tv.host.vista(null).fase as { nome: string; inAttesa?: string[] };
    expect(fase().inAttesa).not.toContain('g2');
    await act(async () => giocaBelatoDi(tv.cleo, 'g3'));
    await aspetta();
    expect(tv.host.vista(null).finestra).not.toBeNull();
    await aspetta(tv.host.pubblico().impostazioni.finestraSecondi * 1000 + 300);
    expect(tv.host.vista(null).finestra).toBeNull();
    expect(fase().inAttesa).toContain('g2');
    const mandate = vi.spyOn(tv.tBea, 'aggiungi');
    await premi(bea, 'passo');
    expect(mandate).toHaveBeenCalledTimes(1);
    await aspetta();
    expect(fase().inAttesa).not.toContain('g2');
  });

  it("l'evento di un altro giocatore non sblocca la mia mossa in attesa; dopo 4 s sì (ultima risorsa)", async () => {
    const tv = await tavolata();
    const telefoni = montaTelefoni(tv);
    const bea = telefoni[1]!;
    await aspetta();
    await act(async () => tv.host.inizia(3));
    await aspetta(10_000); // guaio → scelta
    expect(tv.host.vista(null).fase.nome).toBe('scelta');
    const mandate = vi.spyOn(tv.tBea, 'aggiungi').mockImplementation(() => new Promise(() => {}));
    const [prima, seconda] = domandaDi(bea)!.carte;
    expect(seconda).toBeDefined();
    await gesto(bea, { tipo: 'carta', carta: prima! });
    await premi(bea, 'gioca');
    expect(mandate).toHaveBeenCalledTimes(1);

    // Cleo sceglie: un evento nuovo sul tavolo di Bea, la mossa di Bea aspetta ancora
    const seqPrima = tv.bea.vista(null).eventi.at(-1)!.seq;
    await act(async () => {
      tv.cleo.invia(tv.cleo.azioni('g3').find((a) => a.tipo === 'scegliTrovata')!);
    });
    await aspetta();
    expect(tv.bea.vista(null).eventi.at(-1)!.seq).toBeGreaterThan(seqPrima);
    await gesto(bea, { tipo: 'carta', carta: seconda! });
    await premi(bea, 'gioca');
    expect(mandate).toHaveBeenCalledTimes(1);

    // Ultima risorsa: dopo 4 s la scelta si sblocca (vuota)
    await aspetta(4100);
    expect(domandaDi(bea)!.sollevate).toEqual([]);
    await gesto(bea, { tipo: 'carta', carta: seconda! });
    await premi(bea, 'gioca');
    expect(mandate).toHaveBeenCalledTimes(2);
  });
});

/** Stato costruito: Belati di punteggio aperti; solo Ada ha un Belato, Bea e Cleo possono solo passare. */
function statoAlPunteggioSoloPassa(): Stato {
  const s = prosegui(
    scenario({
      giocatori: [
        { id: 'g1', nome: 'Ada', pecora: 'ricciolo' },
        { id: 'g2', nome: 'Bea', pecora: 'brontolana' },
        { id: 'g3', nome: 'Cleo', pecora: 'sospirella' },
      ],
      guaio: 'tosatura-a-sorpresa',
      mani: { g1: ['carriola', 'belato-di-gruppo'], g2: ['balla-di-fieno'], g3: ['coperta-di-lana'] },
    }),
  );
  return avanza(scegli(s, { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['coperta-di-lana'] }));
}

describe('"Passa sempre se non ho niente da giocare"', () => {
  async function beaSoloPassa() {
    localStorage.setItem('hls-passa-da-solo', '1');
    const tv = await tavolata();
    tv.host.inizia(1);
    await aspetta();
    await conStato(tv, statoAlPunteggioSoloPassa());
    const telefoni = montaTelefoni(tv);
    await aspetta(50);
    return { tv, bea: telefoni[1]! };
  }

  it('il passa automatico parte da solo dopo 400 ms (una sola mossa)', async () => {
    const { tv } = await beaSoloPassa();
    const mandate = vi.spyOn(tv.tBea, 'aggiungi').mockImplementation(() => new Promise(() => {}));
    await aspetta(1000);
    expect(mandate).toHaveBeenCalledTimes(1);
  });

  it('un tocco manuale prima dei 400 ms: il passa automatico non parte una seconda volta', async () => {
    const { tv, bea } = await beaSoloPassa();
    const mandate = vi.spyOn(tv.tBea, 'aggiungi').mockImplementation(() => new Promise(() => {}));
    await premi(bea, 'passo');
    expect(mandate).toHaveBeenCalledTimes(1);
    await aspetta(1000);
    expect(mandate).toHaveBeenCalledTimes(1);
  });
});

/** Stato costruito: Bea (g2, ospite) è l'unica a lanciare il dado. */
function statoAlDadoDiBea(): Stato {
  let s = prosegui(
    scenario({
      giocatori: [
        { id: 'g1', nome: 'Ada', pecora: 'ricciolo' },
        { id: 'g2', nome: 'Bea', pecora: 'brontolana' },
        { id: 'g3', nome: 'Cleo', pecora: 'sospirella' },
      ],
      guaio: 'tosatura-a-sorpresa',
      mani: { g1: ['balla-di-fieno'], g2: ['carriola'], g3: ['coperta-di-lana'] },
    }),
  );
  s = chiudiPunteggio(avanza(scegli(s, { g1: ['balla-di-fieno'], g2: ['carriola'], g3: ['coperta-di-lana'] })));
  return s;
}

/** Stato costruito: Bea ha lanciato la Testata contro Ada, nessuno ha reagito: tocca a lei tirare. */
function statoAllaTestataDiBea(): Stato {
  let s = applica(conFaccia(statoAlDadoDiBea(), 'testata'), { tipo: 'lanciaDado', giocatore: 'g2' });
  s = nessunaReazione(applica(s, { tipo: 'dichiaraDado', giocatore: 'g2', bersaglio: 'g1' }));
  return s;
}

/** Le mosse di Bea arrivano a chi ospita con `ritardo` ms di ritardo; si contano quelle del tipo dato. */
function mosseLente(tv: Tavolata, ritardo: number) {
  const vera = tv.tBea.aggiungi.bind(tv.tBea);
  const spia = vi
    .spyOn(tv.tBea, 'aggiungi')
    .mockImplementation(
      (percorso, valore) => new Promise<string>((ok, ko) => setTimeout(() => void vera(percorso, valore).then(ok, ko), ritardo)),
    );
  return (tipo: string) => spia.mock.calls.filter(([, valore]) => JSON.stringify(valore).includes(tipo)).length;
}

describe('Una mossa sola per tiro, anche se chi ospita risponde tardi', () => {
  async function testataDiBea() {
    const tv = await tavolata();
    tv.host.inizia(1);
    await aspetta();
    await conStato(tv, statoAllaTestataDiBea());
    const telefoni = montaTelefoni(tv);
    const bea = telefoni[1]!;
    await aspetta();
    expect(tv.host.vista(null).fase).toMatchObject({ nome: 'risoluzione_dado', passo: 'esito_testata' });
    // La mira è nella scena: niente riquadro sopra, la fionda è la domanda del telefono di Bea
    expect(bea.radice.querySelector('.riquadro-testata')).toBeNull();
    const fionda = domandaDi(bea)?.fionda;
    expect(fionda).toMatchObject({ bersaglio: 'g1' });
    return { tv, bea, telefoni, fionda: fionda! };
  }
  /** Il gesto che la fionda della scena manda a fine volo (vedi tiraTestata). */
  async function tira(bea: Telefono, esito: number) {
    await gesto(bea, { tipo: 'fionda', esito });
  }

  it('Testata nella scena: la risposta di chi ospita arriva dopo 3 s, parte un solo esito e nessun errore', async () => {
    const { tv, bea, fionda } = await testataDiBea();
    const mandate = mosseLente(tv, 3000);
    await tira(bea, fionda.massimo);
    await aspetta(1650);
    expect(mandate('esitoTestata')).toBe(1);
    await aspetta(2000);
    expect(mandate('esitoTestata')).toBe(1);
    await aspetta(1500);
    expect(tv.host.vista(null).fase).not.toMatchObject({ passo: 'esito_testata' });
    await aspetta(2000);
    expect(mandate('esitoTestata')).toBe(1);
    expect(tv.bea.rifiuto()).toBeNull();
    expect(bea.radice.querySelector('.errore')).toBeNull();
  });

  it('Testata nella scena: un nuovo disegno della pagina durante il colpo non fa ripartire né raddoppiare il tiro', async () => {
    const { tv, bea, fionda } = await testataDiBea();
    const mandate = mosseLente(tv, 3000);
    // Il gesto della scena di prima del nuovo disegno: se arriva di nuovo (in ritardo) non manda un altro esito
    const vecchio = teatroDi(bea)!.suGesto!;
    await tira(bea, fionda.massimo);
    await aspetta(800);
    // La pagina si ridisegna (si apre il menu) mentre la risposta non è ancora arrivata
    await clic(bea.radice.querySelector('.pulsante-menu'));
    await act(async () => {
      vecchio({ tipo: 'fionda', esito: fionda.massimo });
    });
    await aspetta(850);
    expect(mandate('esitoTestata')).toBe(1);
    await aspetta(2000);
    expect(mandate('esitoTestata')).toBe(1);
  });

  it('Testata a fionda: chi tira manda un solo esito; gli altri telefoni vedono il volo e gli agnellini cadere', async () => {
    const { tv, bea, telefoni, fionda } = await testataDiBea();
    const [ada, , cleo] = telefoni;
    const prima = tv.host.vista(null).giocatori.find((g) => g.id === 'g1')!.agnellini;
    expect(fionda.massimo).toBeGreaterThan(0);
    expect(fionda.massimo).toBeLessThanOrEqual(Math.min(3, prima));
    // Solo Bea mira: gli altri telefoni non hanno la fionda
    expect(domandaDi(ada!)?.fionda ?? null).toBeNull();
    expect(domandaDi(cleo!)?.fionda ?? null).toBeNull();
    const mandate = mosseLente(tv, 0);
    await tiraTestata(bea);
    await aspetta(1000);
    expect(mandate('esitoTestata')).toBe(1);
    const v = tv.host.vista(null);
    const evento = v.eventi.filter((e) => e.tipo === 'testata').at(-1);
    expect(evento).toMatchObject({ giocatore: 'g2', bersaglio: 'g1', esito: fionda.massimo });
    expect(v.giocatori.find((g) => g.id === 'g1')!.agnellini).toBe(prima - fionda.massimo);
    // Ada e Cleo recitano l'evento della testata (il volo) e la fotografia dopo ha gli agnellini caduti
    for (const t of [ada!, cleo!]) {
      const teatro = teatroDi(t)!;
      expect(Math.max(...teatro.recitate), t.id).toBeGreaterThanOrEqual(evento!.seq);
      expect(teatro.foto!.posti.find((p) => p.id === 'g1')!.agnellini, t.id).toBe(prima - fionda.massimo);
    }
    expect(mandate('esitoTestata')).toBe(1);
  });

  describe('nella riserva', () => {
    beforeEach(() => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      usaCaricatoreDiProva(() => Promise.reject(new Error('Failed to fetch dynamically imported module')));
    });
    afterEach(async () => {
      usaCaricatoreDiProva(null);
      await caricaScena();
    });

    it('dado coi pannelli: la risposta di chi ospita arriva dopo 3 s, parte un solo lancio', async () => {
      const tv = await tavolata();
      tv.host.inizia(1);
      await aspetta();
      await conStato(tv, statoAlDadoDiBea());
      const telefoni = montaTelefoni(tv);
      const bea = telefoni[1]!;
      await aspetta();
      expect(tv.host.vista(null).fase).toMatchObject({ nome: 'dado' });
      const mandate = mosseLente(tv, 3000);
      await clic(pulsanteIn(bea.radice.querySelector('.cassetto .area-azione') as HTMLElement, 'Lancia il dado'));
      await aspetta(950);
      expect(mandate('lanciaDado')).toBe(1);
      await aspetta(2500);
      expect(mandate('lanciaDado')).toBe(1);
      await aspetta(1000);
      expect(tv.host.vista(null).fase.nome).toBe('risoluzione_dado');
      await aspetta(1500);
      expect(mandate('lanciaDado')).toBe(1);
      expect(tv.bea.rifiuto()).toBeNull();
    });
  });
});

/** Una mossa coi pannelli della riserva, se ce n'è una da fare. */
async function mossaPannelli(radice: HTMLElement): Promise<boolean> {
  const area = radice.querySelector('.cassetto .area-azione');
  if (!area) return false;
  let b: HTMLButtonElement | undefined;
  if ((b = pulsanteIn(area as HTMLElement, 'Lancia il dado'))) {
    await clic(b);
    await aspetta(1000);
    return true;
  }
  const arena = area.querySelector('svg.arena');
  if (arena) {
    await act(async () => {
      fireEvent.pointerDown(arena, { pointerId: 1, clientX: 5, clientY: 5 });
    });
    await act(async () => {
      fireEvent.pointerUp(arena, { pointerId: 1, clientX: 5, clientY: 5 });
    });
    await aspetta(1700);
    return true;
  }
  if (area.querySelector('.furto')) {
    for (let k = 0; k < 10; k++) {
      const piu = [...area.querySelectorAll('.furto button')].find((x) => x.textContent === '+' && !(x as HTMLButtonElement).disabled);
      if (!piu) break;
      await clic(piu);
    }
    await clic(pulsanteIn(area as HTMLElement, 'Conferma'));
    return true;
  }
  for (const t of ['Lascia passare', 'Usa l', 'Prendo il Guaio', 'Non scarto']) {
    if ((b = pulsanteIn(area as HTMLElement, t))) {
      await clic(b);
      return true;
    }
  }
  const carta = area.querySelector('.mano button.carta:not(.spenta)');
  if (carta) await clic(carta);
  b = pulsanteIn(area as HTMLElement, 'Gioca') ?? pulsanteIn(area as HTMLElement, 'Tieni') ?? pulsanteIn(area as HTMLElement, 'Scarta');
  if (!b) b = [...area.querySelectorAll<HTMLButtonElement>('.scelte-nomi button')].find((x) => !x.disabled);
  if (!b) return false;
  await clic(b);
  return true;
}

describe('Riserva: la scena non si carica e si gioca con i pannelli', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    usaCaricatoreDiProva(() => Promise.reject(new Error('Failed to fetch dynamically imported module')));
  });
  afterEach(async () => {
    usaCaricatoreDiProva(null);
    await caricaScena();
  });

  it("dalla sala d'attesa alla fine coi pannelli, ognuno con la sua mano", async () => {
    const tv = await tavolata();
    const telefoni = montaTelefoni(tv);
    await aspetta();
    await clic(pulsanteIn(telefoni[0]!.radice, 'Inizia la partita'));
    await aspetta();
    for (const t of telefoni) expect(t.radice.querySelector('.scena-non-caricata')).not.toBeNull();

    let giri = 0;
    while (!tv.host.vista(null).esito) {
      if (++giri > 4000) throw new Error('la partita non finisce');
      let mosso = false;
      for (const t of [...telefoni.slice(giri % 3), ...telefoni.slice(0, giri % 3)]) {
        expect(scena.vivi.size).toBe(0);
        // Mai carte di altri giocatori su questo schermo, tranne quelle scoperte di "guarda due"
        const mia = manoDi(tv, t.id);
        for (const el of t.radice.querySelectorAll('.area-azione .mano [data-carta]')) {
          const c = el.getAttribute('data-carta')!;
          const richiesta = tv.host.vista(t.id).richiesta;
          expect(mia.includes(c) || (richiesta?.giocatore === t.id && richiesta.tipo === 'guarda_due' && richiesta.carte.includes(c))).toBe(true);
        }
        expect(t.radice.querySelector('.errore')).toBeNull();
        expect(t.radice.querySelector('.spettacolo')).toBeNull();
        if (await mossaPannelli(t.radice)) {
          mosso = true;
          await aspetta();
          break;
        }
      }
      if (!mosso) await aspetta(7000);
    }
    await aspetta();
    for (const t of telefoni) expect(t.radice.querySelector('.fine-partita h2')?.textContent).toMatch(/^Vinc/);
    expect(pulsanteIn(telefoni[0]!.radice, 'Nuova partita con gli stessi giocatori')).toBeDefined();
  }, 180_000);
});

describe('Pre-caricamento e durata delle recite', () => {
  afterEach(async () => {
    usaCaricatoreDiProva(null);
    await caricaScena();
  });

  it('creando una stanza la scena comincia a scaricarsi e chi ospita riceve la durata delle recite', async () => {
    usaCaricatoreDiProva(() => new Promise(() => {}));
    expect(scenaRichiesta()).toBe(false);
    const r = new ArchivioMemoria();
    rete.trasporto = r.dispositivo('u1');
    const crea = vi.spyOn(SessioneHost, 'crea');
    const imposta = vi.spyOn(SessioneHost.prototype, 'impostaDurataRecita');
    let dentro: SessioneHost | SessioneOspite | null = null;
    render(<ModuloStanza modo="crea" onDentro={(s) => (dentro = s)} onIndietro={() => {}} />);
    fireEvent.change(document.querySelector('input')!, { target: { value: 'Ada' } });
    await clic(pulsanteIn(document.body, 'Crea la stanza'));
    await aspetta(100);
    expect(scenaRichiesta()).toBe(true);
    expect(dentro).toBeInstanceOf(SessioneHost);
    const data = crea.mock.calls[0]?.[4]?.durataRecita ?? imposta.mock.calls[0]?.[0];
    expect(data).toBe(durataRecita);
  });

  it('entrando in una stanza (anche se il collegamento non riesce) la scena comincia a scaricarsi', async () => {
    usaCaricatoreDiProva(() => new Promise(() => {}));
    render(<ModuloStanza modo="entra" codiceIniziale="ABCD" onDentro={() => {}} onIndietro={() => {}} />);
    fireEvent.change(document.querySelectorAll('input')[1]!, { target: { value: 'Bea' } });
    await clic(pulsanteIn(document.body, 'Entra'));
    await aspetta();
    expect(scenaRichiesta()).toBe(true);
  });

  it('rientrando come host dopo un ricaricamento: scena in arrivo e durata delle recite', async () => {
    const r = new ArchivioMemoria();
    const prima = await SessioneHost.crea(r.dispositivo('u1'), archivioHost(), { nome: 'Ada', pecora: 'ricciolo', gettone: 'a' });
    await aspetta();
    prima.chiudi();
    localStorage.setItem('hls-iscrizione', JSON.stringify(prima.iscrizione()));
    sessionStorage.setItem('hls-in-stanza', prima.codice);
    usaCaricatoreDiProva(() => new Promise(() => {}));
    rete.trasporto = r.dispositivo('u1');
    const riprendi = vi.spyOn(SessioneHost, 'riprendi');
    const imposta = vi.spyOn(SessioneHost.prototype, 'impostaDurataRecita');
    render(<App />);
    await aspetta(100);
    expect(scenaRichiesta()).toBe(true);
    expect(document.querySelector('.sala')).not.toBeNull();
    const data = riprendi.mock.calls[0]?.[2]?.durataRecita ?? imposta.mock.calls[0]?.[0];
    expect(data).toBe(durataRecita);
  });
});

describe('Vista proiettore', () => {
  /** Tre giocatori con la partita iniziata e la vista tavolo montata in un contenitore a parte. */
  async function proiettore() {
    const tv = await tavolata();
    tv.host.inizia(1);
    await aspetta();
    const sessione = await SessioneTavolo.apri(tv.rete.dispositivo('u9'), tv.host.codice);
    await aspetta();
    const radice = document.createElement('div');
    radice.setAttribute('data-telefono', 'tavolo');
    document.body.appendChild(radice);
    render(<Sprite />);
    render(<VistaTavolo sessione={sessione} onEsci={() => {}} />, { container: radice });
    await aspetta();
    return { tv, sessione, radice };
  }
  const seqMax = (s: SessioneTavolo) => s.vista()!.eventi.reduce((m, e) => Math.max(m, e.seq), 0);

  it('mostra la scena senza mano, senza domande e senza conto, e recita le mosse nuove', async () => {
    const { tv, sessione, radice } = await proiettore();
    expect(scena.vivi.size).toBe(1);
    const teatro = [...scena.vivi][0]!;
    expect(radice.contains(teatro.radice)).toBe(true);
    expect(radice.querySelector('.tavolo')).toBeNull();
    expect(radice.querySelector('.area-azione')).toBeNull();
    expect(radice.querySelector('.conto')).toBeNull();
    // In basso la pecora del primo giocatore, mai una mano
    expect(teatro.foto?.posti[0]?.id).toBe('g1');
    expect(teatro.recitate.length).toBeGreaterThan(0);

    // Le tre sessioni fanno mosse finché sul tavolo compaiono eventi nuovi
    const prima = seqMax(sessione);
    const ultimaPrima = Math.max(...teatro.recitate);
    const sessioni: [IdGiocatore, SessioneHost | SessioneOspite][] = [['g1', tv.host], ['g2', tv.bea], ['g3', tv.cleo]];
    for (let giro = 0; giro < 30 && seqMax(sessione) === prima; giro++) {
      for (const [id, s] of sessioni) {
        const a = s.azioni(id)[0];
        if (a) s.invia(a);
      }
      await aspetta(7000);
    }
    expect(seqMax(sessione)).toBeGreaterThan(prima);
    expect(Math.max(...teatro.recitate)).toBeGreaterThan(ultimaPrima);

    // Nessuna fotografia con una mano, nessuna domanda
    expect(scena.foto.length).toBeGreaterThan(0);
    for (const f of scena.foto) expect(f.foto.mano).toBeNull();
    expect(scena.chieste).toHaveLength(0);
    expect(teatro.domanda).toBeNull();
  });

  it('se la scena non si carica mostra il tavolo di prima', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    usaCaricatoreDiProva(() => Promise.reject(new Error('Failed to fetch dynamically imported module')));
    try {
      const { radice } = await proiettore();
      expect(scena.vivi.size).toBe(0);
      expect(radice.querySelector('.tavolo')).not.toBeNull();
      expect(radice.querySelector('.intestazione')).not.toBeNull();
    } finally {
      usaCaricatoreDiProva(null);
      await caricaScena();
    }
  });

  it('se la scena non si carica per la rete il proiettore riprova da solo (il "Riprova" resta sotto il tavolo di prima)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // Senza rete: dopo un aggiornamento del sito (con la rete) non si riprova da soli, vedi ScenaCaricata.test.tsx
    vi.spyOn(piattaforma, 'online').mockReturnValue(false);
    let tentativi = 0;
    usaCaricatoreDiProva(() => (tentativi++ === 0 ? Promise.reject(new Error('Failed to fetch dynamically imported module')) : import('../scena/Scena')));
    try {
      const { radice } = await proiettore();
      expect(scena.vivi.size).toBe(0);
      expect(radice.querySelector('.tavolo')).not.toBeNull();
      await aspetta(6000);
      expect(tentativi).toBeGreaterThan(1);
      expect(scena.vivi.size).toBe(1);
      // La scena è arrivata: il tavolo di prima se ne va
      expect(radice.querySelector('.tavolo')).toBeNull();
    } finally {
      usaCaricatoreDiProva(null);
      await caricaScena();
    }
  });

  it('comincia a scaricare la scena aprendo il collegamento del tavolo', async () => {
    usaCaricatoreDiProva(() => new Promise(() => {}));
    try {
      const r = new ArchivioMemoria();
      const host = await SessioneHost.crea(r.dispositivo('u1'), archivioInMemoria(), { nome: 'Ada', pecora: 'ricciolo', gettone: 'a' });
      await aspetta();
      history.replaceState(null, '', `#tavolo=${host.codice}`);
      rete.trasporto = r.dispositivo('u2');
      expect(scenaRichiesta()).toBe(false);
      render(<App />);
      await aspetta(100);
      expect(scenaRichiesta()).toBe(true);
    } finally {
      history.replaceState(null, '', '#');
      usaCaricatoreDiProva(null);
      await caricaScena();
    }
  });
});
