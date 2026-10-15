// Banco di prova della scena nel browser (dal banco della bozza, bozze/scena/prove.js). Solo pagina di sviluppo.
// Al posto dell'orologio finto della bozza si usa il ciclo manuale del teatro: `attendi(ms)` fa avanzare la scena a passi
// da 33 ms con `teatro.avanza` e porta avanti a mano le animazioni Web Animations (che altrimenti seguono il tempo vero).
// Così le prove vanno più veloci del tempo vero e funzionano anche con la scheda in sottofondo.
//
// Dalla console della pagina scena.html:
//   await PROVE.provaCompleta('normale')        // 'veloci', 'salto'; { leggero: true } per il modo leggero
//   await PROVE.provaDito(); await PROVE.provaRisparmio(); await PROVE.carteFuori()
//   PROVE.lancia('provaCompleta', 'salto'); PROVE.stato()   // le prove lunghe, senza tenere aperta la chiamata
//   PROVE.automatico()                          // torna al ciclo automatico (le prove passano al manuale da sole)
import { CATALOGO } from '../../../../engine/src';
import type { IdCarta, IdGiocatore } from '../../../../engine/src';
import { cartaSVG } from '../carte/carte';
import type { Fotografia } from '../fotografia';
import { cambiaOpzione, opzioni } from '../servizi/opzioni';
import type { StatoMostrato, Teatro } from '../teatro';

/** Ciò che il banco chiede alla pagina di sviluppo. */
export interface BancoProve {
  readonly teatro: Teatro | null;
  readonly ciclo: 'automatico' | 'manuale';
  /** Distrugge e ricrea il teatro (con la partita di adesso), eventualmente con un altro ciclo. */
  rimonta(o?: { ciclo?: 'automatico' | 'manuale' }): void;
  /** Partita nuova con `n` giocatori, allineata subito. */
  cambiaGiocatori(n: 2 | 3 | 4): void;
  /** La fotografia che la scena mostra adesso. */
  foto(): Fotografia;
}

const PASSO_MS = 33;
const IDS: IdCarta[] = [
  'grandine-a-sorpresa',
  'pioggia-di-traverso',
  'vento-dispettoso',
  'nebbia-fitta',
  'fulmine-curioso',
  'gelata-di-agosto',
  'pozzanghera-senza-fondo',
  'lupo-vegetariano',
];
/** Durate di riferimento a velocità normale (ms), misurate sulla bozza: servono per saltare "a metà" (prove.js, riga 11). */
const DURATE_RIF: Record<string, number> = {
  'grandine-a-sorpresa': 8550,
  'pioggia-di-traverso': 13000,
  'vento-dispettoso': 6100,
  'nebbia-fitta': 17850,
  'fulmine-curioso': 9100,
  'gelata-di-agosto': 9400,
  'pozzanghera-senza-fondo': 13600,
  'lupo-vegetariano': 6650,
};

type Modo = 'normale' | 'veloci' | 'salto';
type Fallito = { id: IdCarta; chi: IdGiocatore; n: number; motivo: string };

export function installaProve(banco: BancoProve) {
  const ERRORI: string[] = [];
  /** Tempo della scena fatto avanzare dal banco (ms). */
  const O = { t: 0 };

  // Errori della pagina: come la bozza, finiscono nell'elenco e fanno fallire la prova in corso
  window.addEventListener('error', (e) => ERRORI.push(String(e.message)));
  window.addEventListener('unhandledrejection', (e) => ERRORI.push('promessa: ' + String((e.reason && e.reason.stack) || e.reason)));
  const errore0 = console.error.bind(console);
  console.error = (...a: unknown[]) => {
    ERRORI.push(a.map(String).join(' '));
    errore0(...a);
  };

  // Un giro del ciclo degli eventi (MessageChannel non rallenta con la scheda in sottofondo)
  let attesaGiro: (() => void) | null = null;
  const canale = new MessageChannel();
  canale.port1.onmessage = () => {
    const r = attesaGiro;
    attesaGiro = null;
    r?.();
  };
  const giro = () =>
    new Promise<void>((r) => {
      attesaGiro = r;
      canale.port2.postMessage(0);
    });

  /** Il teatro in ciclo manuale (se serve si rimonta). */
  function teatro(): Teatro {
    if (banco.ciclo !== 'manuale' || !banco.teatro) banco.rimonta({ ciclo: 'manuale' });
    return banco.teatro!;
  }

  // Le animazioni Web Animations seguono il tempo vero: si mettono in pausa e si portano avanti a mano, con la loro velocità
  const finto = new WeakMap<Animation, number>();
  function spingiAnimazioni(): void {
    for (const a of document.getAnimations()) {
      if (a.playState === 'running') {
        a.pause();
        finto.set(a, O.t);
        continue;
      }
      const da = finto.get(a);
      if (a.playState !== 'paused' || da === undefined) continue;
      const ora = (Number(a.currentTime) || 0) + (O.t - da) * a.playbackRate;
      finto.set(a, O.t);
      const durata = a.effect ? Number(a.effect.getComputedTiming().endTime) : 0;
      if (ora >= durata) {
        try {
          a.finish();
        } catch {
          a.cancel();
        }
      } else a.currentTime = ora;
    }
  }

  /** Fa avanzare la scena di `ms`, a fotogrammi di `passoMs` (al più 33: il ciclo manuale non fa fotogrammi più lunghi). */
  async function attendi(ms: number, passoMs = PASSO_MS): Promise<void> {
    const t = teatro();
    let resto = ms;
    while (resto > 0) {
      const passo = Math.min(passoMs, resto);
      resto -= passo;
      t.avanza(passo);
      O.t += passo;
      spingiAnimazioni();
      await giro();
    }
  }

  /** Aspetta che non ci sia nessun evento in corso (al massimo `maxMs`); restituisce i ms passati. */
  async function quiete(maxMs = 30000): Promise<number> {
    const t0 = O.t;
    while (teatro().eventoInCorso() && O.t - t0 < maxMs) await attendi(50);
    return O.t - t0;
  }

  const giocatori = (): IdGiocatore[] => banco.foto().posti.map((p) => p.id);
  const totale = (s: StatoMostrato) => Object.values(s.agnellini).reduce((n, c) => n + c.assegnati, 0);
  /** Ciò che non va a fine evento (prove.js, righe 182–183 e 546–550), più i cartelli. Chi è "in regia" a fine evento può esserlo per i giochi tra agnellini: non conta. */
  function problemi(s: StatoMostrato, attesi: number): string[] {
    const m: string[] = [];
    if (totale(s) !== attesi) m.push(`agnellini ${totale(s)}/${attesi}`);
    for (const [luogo, c] of Object.entries(s.agnellini)) if (c.assegnati !== c.mostrati) m.push(`cartello di ${luogo}: ${c.mostrati} su ${c.assegnati}`);
    if (s.intrappolati) m.push(`intrappolati ${s.intrappolati}`);
    if (s.fuori) m.push(`fuori ${s.fuori}`);
    if (Math.abs(s.zoom - 1) > 0.01) m.push(`zoom ${s.zoom.toFixed(2)}`);
    if (s.postazioniNascoste) m.push(`postazioni nascoste ${s.postazioniNascoste}`);
    if (s.recintiAlterati) m.push(`recinti alterati ${s.recintiAlterati}`);
    return m;
  }
  const errori = (err0: number) => (ERRORI.length > err0 ? ['errori: ' + ERRORI.slice(err0).join(' | ').slice(0, 300)] : []);

  function impostaVeloci(v: boolean): void {
    if (opzioni().veloci !== v) cambiaOpzione('veloci');
  }

  /** Un Guaio meteo (solo l'effetto, con lo zoom se non è chi sta in basso) dall'inizio alla fine (prove.js, righe 150–174). */
  async function casoMeteo(id: IdCarta, chi: IdGiocatore, modo: Modo = 'normale') {
    const t = teatro();
    const veloci0 = opzioni().veloci;
    if (modo === 'veloci') impostaVeloci(true);
    const t0 = O.t;
    const meta = (DURATE_RIF[id] ?? 10000) / 2;
    let saltato = false;
    void t.ordini.meteo(id, chi);
    await attendi(50);
    while (t.eventoInCorso() && O.t - t0 < 30000) {
      await attendi(100);
      if (modo === 'salto' && !saltato && O.t - t0 >= meta) {
        t.salta();
        saltato = true;
      }
    }
    const durataMs = O.t - t0;
    impostaVeloci(veloci0);
    await attendi(1300);
    return { durataMs, salto: saltato ? durataMs - meta : null, dopo: t.stato() };
  }

  /** Gli 8 meteo per ogni giocatore, con 2, 3 e 4 giocatori: 72 casi (prove.js, righe 535–561). */
  async function provaCompleta(modo: Modo = 'normale', o: { leggero?: boolean } = {}) {
    const falliti: Fallito[] = [];
    const durate: Record<string, [number, number]> = {};
    const rapporti: Record<string, [number, number]> = {};
    let casi = 0;
    for (const n of [2, 3, 4] as const) {
      teatro();
      banco.cambiaGiocatori(n);
      const t = teatro();
      if (o.leggero) {
        t.ctx.risparmio.leggero = true;
        t.ctx.el.scena.classList.add('leggero');
      }
      await attendi(2500);
      const attesi = banco.foto().totaleAgnellini;
      for (const chi of giocatori()) {
        for (const id of IDS) {
          const err0 = ERRORI.length;
          const r = await casoMeteo(id, chi, modo);
          casi++;
          const motivi = [...errori(err0), ...problemi(r.dopo, attesi)];
          if (r.durataMs > 25000) motivi.push(`durata ${r.durataMs}`);
          if (modo === 'salto' && r.salto !== null && r.salto > 4000) motivi.push(`dopo il salto ancora ${Math.round(r.salto)} ms`);
          if (modo === 'veloci') {
            const q = +(r.durataMs / DURATE_RIF[id]!).toFixed(2);
            const p = rapporti[id];
            rapporti[id] = p ? [Math.min(p[0], q), Math.max(p[1], q)] : [q, q];
          }
          if (motivi.length) falliti.push({ id, chi, n, motivo: motivi.join('; ') });
          const s = +(r.durataMs / 1000).toFixed(1);
          const d = durate[id];
          durate[id] = d ? [Math.min(d[0], s), Math.max(d[1], s)] : [s, s];
          STATO.avanzamento = `${casi}/72`;
        }
      }
    }
    if (o.leggero) {
      const t = teatro();
      t.ctx.risparmio.leggero = false;
      t.ctx.el.scena.classList.remove('leggero');
    }
    return { modo, leggero: !!o.leggero, casi, falliti, durate, rapporti };
  }

  const sovrapposti = (a: DOMRect, b: DOMRect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

  /** La mano a misura di dito: (b) carte nello schermo, (d) fumetto lungo nello schermo, (f) cartello non coperto (prove.js, righe 327–374). */
  async function provaDito() {
    const falliti: string[] = [];
    const err0 = ERRORI.length;
    const t = teatro();
    await quiete();
    const radice = t.ctx.el.schermo;
    const carte = [...t.ctx.el.mano.querySelectorAll<HTMLElement>('.cm')];
    if (!carte.length) falliti.push('(b) nessuna carta in mano');
    // (b) le carte della mano stanno dentro lo schermo
    for (const c of carte) {
      const r = c.getBoundingClientRect();
      if (r.left < -1 || r.right > innerWidth + 1) {
        falliti.push(`(b) una carta esce dallo schermo: ${Math.round(r.left)}–${Math.round(r.right)} su ${innerWidth}`);
        break;
      }
    }
    // (f) il cartello del mio recinto (l'unico grande) non è coperto dalla mano
    const cartello = radice.querySelector<HTMLElement>('.cartello:not(.piccolo)');
    if (!cartello) falliti.push('(f) manca il cartello del mio recinto');
    else {
      const rc = cartello.getBoundingClientRect();
      if (carte.some((c) => sovrapposti(rc, c.getBoundingClientRect()))) falliti.push('(f) la mano copre il cartello del mio recinto');
    }
    // (d) un fumetto lungo dell'ultimo avversario resta dentro lo schermo
    const ids = giocatori();
    const altro = ids[ids.length - 1]!;
    t.ordini.fumetto(altro, 'Prova di fumetto piuttosto lungo');
    await attendi(300);
    const f = [...radice.querySelectorAll<HTMLElement>('.fumetto')].find((e) => e.dataset.di === altro);
    if (!f) falliti.push('(d) il fumetto non compare');
    else {
      const r = f.getBoundingClientRect();
      if (r.left < -1 || r.right > innerWidth + 1) falliti.push(`(d) il fumetto esce dallo schermo: ${Math.round(r.left)}–${Math.round(r.right)}`);
    }
    return [...falliti, ...errori(err0)];
  }

  /**
   * Riposo e modo leggero (prove.js, righe 498–533). Il ciclo manuale non fa fotogrammi più lunghi di 33 ms: i 25 fotogrammi
   * al secondo (e) e il fotogramma lunghissimo (g) si danno direttamente alla misura della fluidità.
   */
  async function provaRisparmio() {
    const falliti: string[] = [];
    const err0 = ERRORI.length;
    const t = teatro();
    const { risparmio, el } = t.ctx;
    const tocca = () =>
      el.scena.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 5, clientY: 5, pointerId: 9 }));
    await quiete();
    // (b) dopo 21 s senza tocchi né eventi la scena va a riposo: al massimo 20 aggiornamenti al secondo
    await attendi(21000);
    if (!risparmio.riposo) falliti.push('(b) dopo 21 s senza tocchi la scena non è a riposo');
    let aggiornamenti = 0;
    let T0 = t.ctx.T;
    for (let i = 0; i < 30; i++) {
      await attendi(PASSO_MS);
      if (t.ctx.T !== T0) aggiornamenti++;
      T0 = t.ctx.T;
    }
    if (aggiornamenti > 21) falliti.push(`(b) a riposo ${aggiornamenti} aggiornamenti in 1 s`);
    // (c) un tocco la sveglia
    tocca();
    await attendi(50);
    if (risparmio.riposo) falliti.push('(c) un tocco non toglie il riposo');
    // (d) a 35 fotogrammi al secondo resta normale
    tocca();
    await attendi(7000, 28);
    if (risparmio.leggero) falliti.push('(d) a 35 fotogrammi al secondo scatta il modo leggero');
    // (e) a 25 fotogrammi al secondo per 6 s passa al modo leggero
    tocca();
    let ora = risparmio.finestra.inizio || 1;
    risparmio.finestra.inizio = 0;
    for (let i = 0; i < 160; i++) risparmio.misuraFluidita((ora += 40), 0.04);
    if (!risparmio.leggero) falliti.push('(e) a 25 fotogrammi al secondo per 6 s il modo leggero non scatta');
    if (!el.scena.classList.contains('leggero')) falliti.push('(e) .scena non ha la classe leggero');
    // (f) in modo leggero le particelle non superano 60
    tocca();
    let massimo = 0;
    void t.ordini.meteo('gelata-di-agosto', giocatori()[0]!);
    await attendi(50);
    while (t.eventoInCorso()) {
      await attendi(100);
      massimo = Math.max(massimo, t.stato().particelle);
    }
    if (massimo > 60) falliti.push(`(f) in modo leggero ${massimo} particelle`);
    // (g) un fotogramma lunghissimo (ritorno da un'altra scheda) non conta come lento
    risparmio.leggero = false;
    risparmio.secondiLenti = 0;
    el.scena.classList.remove('leggero');
    tocca();
    risparmio.misuraFluidita((ora += 3000), 3);
    await attendi(100);
    if (risparmio.secondiLenti !== 0 || risparmio.leggero) falliti.push(`(g) un buco di 3 s conta come lento (${risparmio.secondiLenti})`);
    risparmio.leggero = false;
    el.scena.classList.remove('leggero');
    return [...falliti, ...errori(err0)];
  }

  /**
   * Ogni testo di ogni carta disegnata in grande (come nella lettura, 270×378), misurato con getBoundingClientRect:
   * restituisce le carte con un testo che esce dalla cornice.
   */
  async function carteFuori() {
    if (document.fonts) await document.fonts.ready;
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:0;top:0;width:270px;height:378px;visibility:hidden;pointer-events:none';
    document.body.appendChild(box);
    const fuori: Array<{ carta: string; testo: string; sporge: number }> = [];
    try {
      for (const tipo of Object.keys(CATALOGO.carte)) {
        box.innerHTML = cartaSVG(tipo, true);
        const svg = box.querySelector('svg')!;
        svg.style.cssText = 'width:100%;height:100%;display:block';
        const cornice = svg.querySelector('rect')!.getBoundingClientRect();
        for (const testo of svg.querySelectorAll('text')) {
          const r = testo.getBoundingClientRect();
          if (!r.width) continue;
          const sporge = Math.max(cornice.left - r.left, r.right - cornice.right, cornice.top - r.top, r.bottom - cornice.bottom);
          if (sporge > 0.5) fuori.push({ carta: tipo, testo: testo.textContent ?? '', sporge: +sporge.toFixed(1) });
        }
      }
    } finally {
      box.remove();
    }
    return fuori;
  }

  /** Torna al ciclo automatico (la scena riparte da capo con la partita di adesso). */
  function automatico(): void {
    if (banco.ciclo !== 'automatico') banco.rimonta({ ciclo: 'automatico' });
  }
  function manuale(): void {
    teatro();
  }

  const STATO = { nome: null as string | null, avanzamento: '', risultato: null as unknown, errore: null as string | null, finito: false };
  const PROVE = {
    attendi,
    quiete,
    casoMeteo,
    provaCompleta,
    provaDito,
    provaRisparmio,
    carteFuori,
    automatico,
    manuale,
    /** Avvia una prova lunga e torna subito; il risultato si legge con `stato()` (prove.js, righe 569–576). */
    lancia(nome: 'provaCompleta' | 'provaDito' | 'provaRisparmio' | 'carteFuori', ...argomenti: unknown[]): string {
      Object.assign(STATO, { nome, avanzamento: '', risultato: null, errore: null, finito: false });
      const prova = PROVE[nome] as (...a: unknown[]) => Promise<unknown>;
      Promise.resolve()
        .then(() => prova(...argomenti))
        .then(
          (r) => {
            STATO.risultato = r;
          },
          (e: unknown) => {
            STATO.errore = String((e as Error)?.stack ?? e);
          },
        )
        .finally(() => {
          STATO.finito = true;
        });
      return 'avviata';
    },
    stato: () => JSON.parse(JSON.stringify({ ...STATO, tempoScena: Math.round(O.t / 1000) })),
    ERRORI,
  };
  Object.assign(window, { PROVE });
  return PROVE;
}
