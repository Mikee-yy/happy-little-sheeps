// Revisione avversariale: informazioni nascoste, purezza, determinismo, robustezza.
// Riferimenti: brief §6 ("Informazioni nascoste", "Motore"), specifica docs/motore.md §1, §2, §3, §10, §12, §13.
import { describe, expect, it } from 'vitest';
import {
  applica,
  azioniPossibili,
  CATALOGO,
  configPer,
  creaMazzoGuai,
  creaMazzoPrincipale,
  defCarta,
  ErroreRegola,
  inAttesaDi,
  nuovaPartita,
  punteggioTotale,
  SETUP,
  tentaApplica,
  vistaPer,
} from '../src';
import type { Azione, IdCarta, IdGiocatore, IdPecora, Stato } from '../src';
import { prosegui, scenario } from './aiuti';

// ─── Aiuti locali ────────────────────────────────────────────────────────────

const PECORE: IdPecora[] = ['ricciolo', 'brontolana', 'sospirella', 'nerina'];
const MASSIMO_AZIONI = 5000;

/** Generatore locale con seme (mulberry32), indipendente da quello del motore. */
function generatore(seme: number): () => number {
  let a = seme >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function giocatoriDi(n: number, ids?: IdGiocatore[]): Array<{ id: IdGiocatore; nome: string; pecora: IdPecora }> {
  return Array.from({ length: n }, (_, i) => ({
    id: ids?.[i] ?? `p${i + 1}`,
    nome: `P${i + 1}`,
    pecora: PECORE[i] as IdPecora,
  }));
}

function candidati(s: Stato, tutti: boolean): Azione[] {
  const azioni: Azione[] = [...azioniPossibili(s, 'sistema')];
  const chi = tutti ? s.giocatori.map((g) => g.id) : inAttesaDi(s).giocatori;
  for (const id of chi) azioni.push(...azioniPossibili(s, id));
  return azioni;
}

/**
 * Gioca una partita casuale guidata da azioniPossibili. `osserva` riceve ogni stato (anche il primo)
 * e l'azione che sta per essere applicata (null sull'ultimo stato).
 */
function giocaPartita(
  numero: number,
  seme: number,
  osserva: (s: Stato, azione: Azione | null, passo: number) => void,
  ids?: IdGiocatore[],
): Stato {
  let s = nuovaPartita({ giocatori: giocatoriDi(numero, ids), seme });
  const rnd = generatore(seme * 17 + numero);
  let passo = 0;
  while (s.esito === null) {
    if (passo > MASSIMO_AZIONI) throw new Error(`seme ${seme}: oltre ${MASSIMO_AZIONI} azioni`);
    const elenco = rnd() < 0.15 ? candidati(s, true) : candidati(s, false);
    if (elenco.length === 0) throw new Error(`seme ${seme}: nessuna azione in ${s.fase.nome}`);
    const azione = elenco[Math.floor(rnd() * elenco.length)] as Azione;
    osserva(s, azione, passo);
    s = applica(s, azione);
    passo++;
  }
  osserva(s, null, passo);
  return s;
}

/** Tutte le stringhe (valori e chiavi) contenute in un valore JSON-like. */
function stringhe(x: unknown, out: Set<string> = new Set()): Set<string> {
  if (typeof x === 'string') out.add(x);
  else if (Array.isArray(x)) for (const v of x) stringhe(v, out);
  else if (x !== null && typeof x === 'object') {
    for (const [k, v] of Object.entries(x)) {
      out.add(k);
      stringhe(v, out);
    }
  }
  return out;
}

/** Congela in profondità: una scrittura sull'oggetto lancerebbe TypeError (modulo ES = strict). */
function congela<T>(x: T): T {
  if (x !== null && typeof x === 'object' && !Object.isFrozen(x)) {
    Object.freeze(x);
    for (const v of Object.values(x)) congela(v);
  }
  return x;
}

/** Modifica in profondità ogni oggetto e array raggiungibile (per scoprire riferimenti condivisi). */
function devasta(x: unknown, visti: Set<unknown> = new Set()): void {
  if (x === null || typeof x !== 'object' || visti.has(x)) return;
  visti.add(x);
  if (Array.isArray(x)) {
    for (const v of x) devasta(v, visti);
    for (let i = 0; i < x.length; i++) if (typeof x[i] !== 'object' || x[i] === null) x[i] = '§manomesso§';
    x.push('§manomesso§');
    return;
  }
  const o = x as Record<string, unknown>;
  for (const k of Object.keys(o)) {
    const v = o[k];
    if (v !== null && typeof v === 'object') devasta(v, visti);
    else o[k] = '§manomesso§';
  }
  o['§aggiunto§'] = true;
}

const TUTTI_GUAI = creaMazzoGuai();
const MAZZI = new Map<number, IdCarta[]>();

function verifica(condizione: boolean, messaggio: () => string): void {
  if (!condizione) throw new Error(messaggio());
}

/** Ogni istanza esattamente una volta. */
function unaVolta(trovate: IdCarta[], attese: IdCarta[], cosa: string): void {
  const conta = new Map<IdCarta, number>();
  for (const c of trovate) conta.set(c, (conta.get(c) ?? 0) + 1);
  for (const c of attese) verifica(conta.get(c) === 1, () => `${cosa}: ${c} presente ${conta.get(c) ?? 0} volte`);
  verifica(conta.size === attese.length, () => `${cosa}: carte estranee ${[...conta.keys()].filter((c) => !attese.includes(c))}`);
}

/** Invarianti di uno stato integro: agnellini e carte conservati, pila e finestra coerenti, partecipanti validi. */
function controllaInvarianti(s: Stato): void {
  const n = s.giocatori.length;
  const agnellini = s.giocatori.reduce((somma, g) => somma + g.agnellini, 0);
  verifica(s.gregge + agnellini === s.config.agnelliniTotali, () => `agnellini non conservati: ${s.gregge} + ${agnellini}`);
  verifica(Number.isInteger(s.gregge) && s.gregge >= 0, () => `Gregge non valido: ${s.gregge}`);
  for (const g of s.giocatori) {
    verifica(Number.isInteger(g.agnellini) && g.agnellini >= 0 && g.agnellini <= s.config.postiOvile, () => `${g.id}: ${g.agnellini} agnellini`);
    verifica(g.mano.every((c) => typeof c === 'string'), () => `${g.id}: mano con elementi non stringa`);
  }
  if (!MAZZI.has(n)) MAZZI.set(n, creaMazzoPrincipale(n));
  const principali = [
    ...s.mazzo,
    ...s.scarti,
    ...s.giocatori.flatMap((g) => g.mano),
    ...s.datiRound.tavolo,
    ...(s.richiesta?.tipo === 'guarda_due' ? s.richiesta.carte : []),
  ];
  unaVolta(principali, MAZZI.get(n) as IdCarta[], 'mazzo principale');
  const guai = [...s.mazzoGuai, ...s.guaiFuoriGioco, ...s.giocatori.flatMap((g) => g.angolo)];
  if (s.datiRound.guaio !== null && !guai.includes(s.datiRound.guaio)) guai.push(s.datiRound.guaio);
  unaVolta(guai, TUTTI_GUAI, 'Guai');
  const cima = s.pila[s.pila.length - 1];
  verifica(cima ? s.finestra?.voce === cima.id : s.finestra === null, () => 'finestra incoerente con la pila');
  const ids = s.giocatori.map((g) => g.id);
  verifica(s.datiRound.partecipanti.every((id) => ids.includes(id)), () => 'partecipante inesistente');
  for (let i = 1; i < s.eventi.length; i++) {
    verifica((s.eventi[i]?.seq ?? 0) > (s.eventi[i - 1]?.seq ?? 0), () => `seq non crescente all'indice ${i}`);
  }
}

// ─── Informazioni nascoste ───────────────────────────────────────────────────

/** Carte che `per` non deve poter vedere in questo stato. */
function segretiPer(s: Stato, per: IdGiocatore | null, guaiNoti: ReadonlySet<IdCarta>): IdCarta[] {
  const segreti: IdCarta[] = [...s.mazzo];
  for (const g of s.giocatori) if (g.id !== per) segreti.push(...g.mano);
  if (s.richiesta?.tipo === 'guarda_due' && s.richiesta.giocatore !== per) segreti.push(...s.richiesta.carte);
  for (const c of s.mazzoGuai) if (!guaiNoti.has(c)) segreti.push(c);
  return segreti;
}

function controllaSegreti(s: Stato, guaiNoti: ReadonlySet<IdCarta>, contesto: string): void {
  for (const per of [...s.giocatori.map((g) => g.id), null]) {
    const v = vistaPer(s, per);
    const visibili = stringhe(v);
    for (const c of segretiPer(s, per, guaiNoti)) {
      verifica(!visibili.has(c), () => `${contesto}: la carta coperta ${c} è visibile a ${String(per)} (fase ${s.fase.nome})`);
    }
    for (const chiave of ['rng', 'mazzo', 'mazzoGuai', 'scelte']) {
      verifica(!visibili.has(chiave), () => `${contesto}: il campo '${chiave}' compare nella vista di ${String(per)}`);
    }
    for (const g of v.giocatori) {
      verifica(g.id === per ? g.mano !== null : g.mano === null, () => `${contesto}: mano di ${g.id} esposta a ${String(per)}`);
    }
    // Fase: le scelte coperte compaiono solo come haScelto / miaScelta.
    if (v.fase.nome === 'scelta' || v.fase.nome === 'belato_finale') {
      const mia = v.fase.miaScelta;
      const propria = per === null ? [] : (s.giocatori.find((g) => g.id === per)?.mano ?? []);
      for (const c of Array.isArray(mia) ? mia : mia === null ? [] : [mia]) {
        verifica(propria.includes(c), () => `${contesto}: miaScelta di ${String(per)} contiene ${c} che non è nella sua mano`);
      }
    }
  }
}

describe('Revisione · informazioni nascoste (brief §6, specifica §10 e §12)', () => {
  it(
    'partite casuali a 2, 3 e 4 giocatori: a ogni passo nessuna vista contiene carte coperte (mazzo, mani altrui, scelte, Belato Finale, guarda_due altrui, Guai mai rivelati)',
    () => {
      const visto = new Set<string>();
      for (const numero of [2, 3, 4]) {
        for (let k = 0; k < 4; k++) {
          const guaiNoti = new Set<IdCarta>();
          const seme = 500 + numero * 31 + k;
          giocaPartita(numero, seme, (s, _azione, passo) => {
            if (s.datiRound.guaio !== null) guaiNoti.add(s.datiRound.guaio);
            controllaSegreti(s, guaiNoti, `seme ${seme} passo ${passo}`);
            visto.add(s.fase.nome);
            if (s.richiesta) visto.add(`richiesta:${s.richiesta.tipo}`);
            if (s.fase.nome === 'scelta' && Object.values(s.fase.scelte).some((c) => c !== null)) visto.add('scelta in corso');
            if (s.fase.nome === 'belato_finale' && Object.values(s.fase.scelte).some((c) => c)) visto.add('belato_finale in corso');
            for (const e of s.eventi) visto.add(`evento:${e.tipo}`);
          });
        }
      }
      // Le partite devono aver attraversato i punti in cui ci sono carte coperte da proteggere.
      for (const atteso of [
        'scelta in corso',
        'belato_finale in corso',
        'richiesta:guarda_due',
        'richiesta:scarta_e_somma',
        'evento:pescate',
        'evento:ripescata',
        'evento:eliminato',
        'evento:guaio_in_fondo',
      ]) {
        expect(visto, atteso).toContain(atteso);
      }
    },
    180_000,
  );

  it('scelta segreta con Gemelle: carteInMano non cambia finché non hanno scelto tutti e la vista altrui non dice quante carte sono state scelte', () => {
    const s0 = prosegui(
      scenario({
        guaio: 'tosatura-a-sorpresa',
        mani: { g1: ['calzino-gemello', 'orecchino-gemello', 'carriola'], g2: ['balla-di-fieno'], g3: ['coperta-di-lana'] },
      }),
    );
    const coppia = s0.giocatori[0]!.mano.filter((c) => c.includes('gemello'));
    const s1 = applica(s0, { tipo: 'scegliTrovata', giocatore: 'g1', carte: coppia });
    for (const per of ['g2', 'g3', null]) {
      const v = vistaPer(s1, per);
      expect(v.giocatori[0]!.carteInMano).toBe(3);
      expect(v.fase).toEqual({ nome: 'scelta', haScelto: { g1: true, g2: false, g3: false }, miaScelta: null });
      expect(stringhe(v).has(coppia[0]!)).toBe(false);
    }
    expect(vistaPer(s1, 'g1').fase).toMatchObject({ miaScelta: coppia });
  });

  it('vista per un id estraneo alla partita: nessuna mano, nessuna carta pescata, nessuna scelta', () => {
    let s = prosegui(
      scenario({
        guaio: 'tosatura-a-sorpresa',
        mani: { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['beee-no'] },
        mazzo: ['coperta-di-lana', 'sasso-comodo', 'pernacchia', 'ombrello-bucato', 'corona-di-margherite', 'capriola'],
      }),
    );
    s = applica(s, { tipo: 'scegliTrovata', giocatore: 'g1', carte: [s.giocatori[0]!.mano[0]!] });
    const v = vistaPer(s, 'spettatore');
    expect(v.giocatori.every((g) => g.mano === null)).toBe(true);
    expect(v.fase).toMatchObject({ nome: 'scelta', miaScelta: null });
    const visibili = stringhe(v);
    for (const g of s.giocatori) for (const c of g.mano) expect(visibili.has(c), c).toBe(false);
  });
});

// ─── Purezza ─────────────────────────────────────────────────────────────────

describe('Revisione · purezza (specifica §1)', () => {
  it('vistaPer, inAttesaDi e azioniPossibili non restituiscono riferimenti allo stato: manometterne il risultato non cambia lo stato', () => {
    let controllati = 0;
    giocaPartita(3, 4242, (s, _a, passo) => {
      if (passo % 7 !== 0) return;
      const prima = JSON.stringify(s);
      for (const per of [...s.giocatori.map((g) => g.id), null]) devasta(vistaPer(s, per));
      devasta(inAttesaDi(s));
      for (const chi of [...s.giocatori.map((g) => g.id), 'sistema']) devasta(azioniPossibili(s, chi));
      verifica(JSON.stringify(s) === prima, () => `passo ${passo} (${s.fase.nome}): lo stato è cambiato manomettendo un risultato`);
      controllati++;
    });
    expect(controllati).toBeGreaterThan(5);
  }, 60_000);

  it('applica non conserva riferimenti né all\'argomento né all\'azione: manometterli dopo non cambia il nuovo stato', () => {
    let controllati = 0;
    giocaPartita(4, 777, (s, azione, passo) => {
      if (azione === null || passo % 3 !== 0) return;
      const copia = structuredClone(azione);
      const base = structuredClone(s);
      const nuovo = applica(base, copia);
      const istantanea = JSON.stringify(nuovo);
      devasta(copia);
      devasta(base);
      verifica(JSON.stringify(nuovo) === istantanea, () => `passo ${passo}: ${azione.tipo} ha lasciato riferimenti condivisi`);
      controllati++;
    });
    expect(controllati).toBeGreaterThan(10);
  }, 60_000);

  it('applica accetta azioni congelate in profondità (non scrive sull\'azione)', () => {
    giocaPartita(3, 99, (s, azione) => {
      if (azione === null) return;
      const r = tentaApplica(s, congela(structuredClone(azione)));
      verifica(r.ok, () => `${azione.tipo} congelata rifiutata`);
    });
  }, 60_000);

  it('una partita intera non modifica CATALOGO, SETUP né i risultati di configPer; lo stato non condivide oggetti con SETUP', () => {
    const catalogo = JSON.stringify(CATALOGO);
    const setup = JSON.stringify(SETUP);
    const config = JSON.stringify(configPer(3));
    const s = nuovaPartita({ giocatori: giocatoriDi(3), seme: 3 });
    devasta(s.config);
    devasta(configPer(4));
    giocaPartita(3, 31337, () => {});
    expect(JSON.stringify(CATALOGO)).toBe(catalogo);
    expect(JSON.stringify(SETUP)).toBe(setup);
    expect(JSON.stringify(configPer(3))).toBe(config);
  }, 60_000);

  it('nuovaPartita non conserva riferimenti all\'elenco dei giocatori ricevuto', () => {
    const input = { giocatori: giocatoriDi(3), seme: 8 };
    const s = nuovaPartita(input);
    const istantanea = JSON.stringify(s);
    devasta(input);
    expect(JSON.stringify(s)).toBe(istantanea);
  });
});

// ─── Determinismo ────────────────────────────────────────────────────────────

/** Percorso del primo valore che JSON non conserva (undefined, NaN, ±Infinity, -0, funzioni, oggetti non semplici), o null. */
function valoreNonJson(x: unknown, percorso: string): string | null {
  if (x === null || typeof x === 'string' || typeof x === 'boolean') return null;
  if (typeof x === 'number') return Number.isFinite(x) && !Object.is(x, -0) ? null : `${percorso} = ${String(x)}`;
  if (Array.isArray(x)) {
    for (let i = 0; i < x.length; i++) {
      if (!(i in x)) return `${percorso}[${i}] è un buco`;
      const r = valoreNonJson(x[i], `${percorso}[${i}]`);
      if (r) return r;
    }
    return null;
  }
  if (typeof x === 'object' && Object.getPrototypeOf(x) === Object.prototype) {
    for (const [k, v] of Object.entries(x)) {
      const r = valoreNonJson(v, `${percorso}.${k}`);
      if (r) return r;
    }
    return null;
  }
  return `${percorso} ha tipo ${typeof x}`;
}

describe('Revisione · determinismo (specifica §1)', () => {
  it.each([2, 3, 4])(
    'a %i giocatori lo stato salvato in JSON e riletto si comporta come l\'originale a ogni passo (salvataggio e ripresa, brief §5–§6)',
    (numero) => {
      giocaPartita(numero, 9000 + numero, (s, azione, passo) => {
        const impuro = valoreNonJson(s, 'stato');
        verifica(impuro === null, () => `passo ${passo}: ${impuro}`);
        const riletto = JSON.parse(JSON.stringify(s)) as Stato;
        if (azione === null) return;
        const a = applica(s, azione);
        const b = applica(riletto, azione);
        verifica(JSON.stringify(a) === JSON.stringify(b), () => `passo ${passo}: ${azione.tipo} diverge dopo il salvataggio`);
        if (passo % 11 === 0) {
          for (const per of [...s.giocatori.map((g) => g.id), null]) {
            verifica(
              JSON.stringify(vistaPer(s, per)) === JSON.stringify(vistaPer(riletto, per)),
              () => `passo ${passo}: vista di ${String(per)} diversa dopo il salvataggio`,
            );
          }
        }
      });
    },
    120_000,
  );

  it('stessa partita giocata due volte: stessa sequenza di stati e di viste a ogni passo', () => {
    const registra = (): string[] => {
      const traccia: string[] = [];
      giocaPartita(3, 2024, (s) => {
        traccia.push(JSON.stringify(s));
        traccia.push(JSON.stringify(vistaPer(s, 'p2')));
      });
      return traccia;
    };
    const a = registra();
    const b = registra();
    expect(b.length).toBe(a.length);
    for (let i = 0; i < a.length; i++) verifica(a[i] === b[i], () => `divergenza all'elemento ${i}`);
  }, 60_000);

  it('le azioni rifiutate non lasciano tracce (generatore, eventi, contatori): l\'azione successiva dà lo stesso stato che senza i tentativi', () => {
    const rnd = generatore(55);
    let rifiutate = 0;
    giocaPartita(3, 55, (s, azione, passo) => {
      if (azione === null || passo % 4 !== 0) return;
      const prima = structuredClone(s);
      for (const v of azioniACaso(s, rnd)) {
        const r = tentaApplica(s, v as Azione);
        if (!r.ok) rifiutate++;
      }
      verifica(JSON.stringify(applica(s, azione)) === JSON.stringify(applica(prima, azione)), () => `passo ${passo}`);
    });
    expect(rifiutate).toBeGreaterThan(100);
  }, 60_000);
});

// ─── Robustezza ──────────────────────────────────────────────────────────────

const VALORI_STRANI: unknown[] = [
  undefined,
  null,
  0,
  -1,
  1.5,
  Number.NaN,
  Number.POSITIVE_INFINITY,
  '',
  'g9',
  '__proto__',
  'constructor',
  'toString',
  true,
  {},
  [],
  [null],
  { length: 1, 0: 'x' },
];

const CAMPI = ['giocatore', 'carta', 'carte', 'bersaglio', 'voce', 'guaio', 'furto', 'esito', 'scarta'];

/** Varianti malformate di un'azione valida. */
function varianti(s: Stato, a: Azione, rnd: () => number): unknown[] {
  const out: unknown[] = [];
  const base = a as unknown as Record<string, unknown>;
  const campi = new Set([...Object.keys(base).filter((k) => k !== 'tipo'), ...CAMPI.filter(() => rnd() < 0.3)]);
  for (const k of campi) {
    for (const v of VALORI_STRANI) out.push({ ...base, [k]: v });
    const senza = { ...base };
    delete senza[k];
    out.push(senza);
  }
  const estranee = [
    s.mazzo[0],
    s.scarti[0],
    s.mazzoGuai[0],
    ...s.giocatori.map((g) => g.mano[0]),
    ...s.giocatori.map((g) => g.angolo[0]),
    'carriola#99',
    'inesistente#1',
    'constructor#1',
  ].filter((c): c is string => typeof c === 'string');
  if (typeof base['carta'] === 'string') for (const c of estranee) out.push({ ...base, carta: c });
  if (Array.isArray(base['carte'])) {
    const cs = base['carte'] as string[];
    out.push({ ...base, carte: [...cs, ...cs] });
    if (cs[0] !== undefined) out.push({ ...base, carte: [cs[0], cs[0]] });
    for (const c of estranee) out.push({ ...base, carte: [...cs, c] }, { ...base, carte: [c] });
    out.push({ ...base, carte: cs.join(',') }, { ...base, carte: [1, 2] }, { ...base, carte: [...cs, ...cs, ...cs, ...cs] });
  }
  if (typeof base['scarta'] === 'string' || base['tipo'] === 'concludiConsolazione') {
    for (const c of estranee) out.push({ ...base, scarta: c });
  }
  if (base['furto'] && typeof base['furto'] === 'object') {
    const f = base['furto'] as Record<string, number>;
    for (const [k, q] of Object.entries(f)) {
      out.push({ ...base, furto: { ...f, [k]: q + 0.5 } }, { ...base, furto: { ...f, [k]: -1 } });
      out.push({ ...base, furto: { ...f, [k]: String(q) } }, { ...base, furto: { ...f, [k]: q + 1 } });
    }
    out.push({ ...base, furto: { ...f, [String(base['giocatore'])]: 0 } });
    out.push({ ...base, furto: { ...JSON.parse('{"__proto__": 1}'), ...f } });
    out.push({ ...base, furto: Object.entries(f) });
  }
  if (typeof base['esito'] === 'number') {
    const e = base['esito'];
    out.push({ ...base, esito: e + 0.5 }, { ...base, esito: -1 }, { ...base, esito: String(e) }, { ...base, esito: 99 });
  }
  if (typeof base['voce'] === 'number') {
    const v = base['voce'];
    out.push({ ...base, voce: v + 1 }, { ...base, voce: v - 1 }, { ...base, voce: String(v) }, { ...base, voce: v + 0.5 });
  }
  if (typeof base['bersaglio'] === 'string') {
    for (const g of s.giocatori) out.push({ ...base, bersaglio: g.id });
  }
  for (const g of s.giocatori) out.push({ ...base, giocatore: g.id });
  return out;
}

const TIPI_AZIONE = [
  'prosegui',
  'scadenza',
  'scegliTrovata',
  'attivaEffetto',
  'rinunciaEffetto',
  'completaEffetto',
  'giocaBelato',
  'passa',
  'lanciaDado',
  'dichiaraDado',
  'esitoTestata',
  'sceltaFinale',
  'concludiConsolazione',
];

/** Azioni "a caso": ogni tipo con giocatore valido e campi presi a caso dai valori strani o dalla partita. */
function azioniACaso(s: Stato, rnd: () => number): unknown[] {
  const pesca = <T>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)] as T;
  const carte = [...s.giocatori.flatMap((g) => g.mano), ...s.mazzo.slice(0, 3), ...s.scarti.slice(-3)];
  const out: unknown[] = [null, undefined, 42, 'prosegui', [], { tipo: 7 }, { tipo: 'vola' }, { tipo: '__proto__' }];
  for (const tipo of TIPI_AZIONE) {
    for (const g of s.giocatori) {
      out.push({
        tipo,
        giocatore: g.id,
        carta: rnd() < 0.7 && carte.length ? pesca(carte) : pesca(VALORI_STRANI),
        carte: rnd() < 0.7 && carte.length ? [pesca(carte)] : pesca(VALORI_STRANI),
        bersaglio: rnd() < 0.7 ? pesca(s.giocatori).id : pesca(VALORI_STRANI),
        voce: rnd() < 0.7 ? s.prossimaVoce - 1 : pesca(VALORI_STRANI),
        esito: rnd() < 0.7 ? Math.floor(rnd() * 4) : pesca(VALORI_STRANI),
        scarta: rnd() < 0.5 ? null : pesca(carte.length ? carte : ['x']),
        guaio: rnd() < 0.7 ? (g.angolo[0] ?? pesca(VALORI_STRANI)) : pesca(VALORI_STRANI),
        furto: rnd() < 0.5 ? Object.fromEntries(s.giocatori.map((x) => [x.id, Math.floor(rnd() * 3)])) : pesca(VALORI_STRANI),
      });
    }
  }
  return out;
}

function provaMalformata(s: Stato, v: unknown, contesto: string): void {
  let r: ReturnType<typeof tentaApplica>;
  try {
    r = tentaApplica(s, v as Azione);
  } catch (e) {
    throw new Error(`${contesto}: eccezione non ErroreRegola per ${JSON.stringify(v)}: ${String(e)}`);
  }
  if (!r.ok) {
    verifica(r.errore instanceof ErroreRegola, () => `${contesto}: errore non ErroreRegola`);
    return;
  }
  try {
    controllaInvarianti(r.stato);
    for (const g of r.stato.giocatori) {
      vistaPer(r.stato, g.id);
      azioniPossibili(r.stato, g.id);
    }
    vistaPer(r.stato, null);
    inAttesaDi(r.stato);
    azioniPossibili(r.stato, 'sistema');
  } catch (e) {
    throw new Error(`${contesto}: azione accettata ${JSON.stringify(v)} ha prodotto uno stato corrotto: ${String(e)}`);
  }
}

describe('Revisione · robustezza contro azioni malformate (specifica §1 "Azioni non valide", §13)', () => {
  it.each([2, 3, 4])(
    'partite a %i giocatori: ogni variante malformata delle azioni valide e ogni azione a caso dà ErroreRegola oppure uno stato integro, mai un\'altra eccezione',
    (numero) => {
      const rnd = generatore(numero * 1001);
      for (let k = 0; k < 2; k++) {
        const seme = 321 + numero * 7 + k;
        giocaPartita(numero, seme, (s, _azione, passo) => {
          if (passo % 9 !== 0) return;
          const prima = JSON.stringify(s);
          const valide = candidati(s, true);
          const scelte = valide.filter(() => rnd() < Math.min(1, 6 / Math.max(1, valide.length)));
          // Al massimo ~300 tentativi per stato: varianti delle azioni valide più azioni a caso.
          const tentativi = [...scelte.flatMap((a) => varianti(s, a, rnd)), ...azioniACaso(s, rnd)];
          const quota = Math.min(1, 300 / Math.max(1, tentativi.length));
          for (const v of tentativi) {
            if (rnd() < quota) provaMalformata(s, v, `seme ${seme} passo ${passo} (${s.fase.nome})`);
          }
          verifica(JSON.stringify(s) === prima, () => `seme ${seme} passo ${passo}: lo stato originale è cambiato`);
        });
      }
    },
    180_000,
  );

  it('vistaPer, inAttesaDi e azioniPossibili non lanciano con id estranei o valori strani come destinatario', () => {
    giocaPartita(3, 1234, (s, _a, passo) => {
      if (passo % 13 !== 0) return;
      for (const chi of ['nessuno', '', 'g9']) {
        verifica(azioniPossibili(s, chi).length === 0, () => `azioni per ${chi}`);
        const v = vistaPer(s, chi);
        verifica(v.giocatori.every((g) => g.mano === null), () => `mani esposte a ${chi}`);
      }
    });
  }, 60_000);

  it('nuovaPartita rifiuta con ErroreRegola input malformati comuni (giocatori mancanti, nulli, senza id o pecora, seme non numerico)', () => {
    const due = giocatoriDi(2);
    const casi: unknown[] = [
      undefined,
      null,
      {},
      { giocatori: 'ab', seme: 1 },
      { giocatori: [null, null], seme: 1 },
      { giocatori: [{ id: 'a' }, { id: 'b' }], seme: 1 },
      { giocatori: [{ ...due[0], id: 3 }, due[1]], seme: 1 },
      { giocatori: due },
      { giocatori: due, seme: '1' },
      { giocatori: due, seme: Number.NaN },
      { giocatori: due, seme: Number.POSITIVE_INFINITY },
      { giocatori: [...due, ...giocatoriDi(3).slice(2), { id: 'p4', nome: 'X', pecora: 'ricciolo' }], seme: 1 },
    ];
    for (const c of casi) {
      expect(() => nuovaPartita(c as Parameters<typeof nuovaPartita>[0]), JSON.stringify(c)).toThrow(ErroreRegola);
    }
  });
});

// ─── Bug trovati ─────────────────────────────────────────────────────────────

describe('Revisione · input di nuovaPartita e nomi che coincidono con proprietà di Object.prototype', () => {
  it('[specifica §3.1 "pecore valide"] nuovaPartita rifiuta una pecora "toString", "constructor" o "__proto__" (giocatori_non_validi)', () => {
    for (const pecora of ['toString', 'constructor', '__proto__', 'hasOwnProperty']) {
      const giocatori = [
        { id: 'a', nome: 'A', pecora: pecora as IdPecora },
        { id: 'b', nome: 'B', pecora: 'ricciolo' as IdPecora },
      ];
      expect(() => nuovaPartita({ giocatori, seme: 1 }), pecora).toThrow(ErroreRegola);
    }
  });

  it('[specifica §3.1 "id unici … (giocatori_non_validi)"] nuovaPartita con un elenco bucato (voce senza giocatore) lancia ErroreRegola, non TypeError', () => {
    const elenco = giocatoriDi(3);
    // `[ , b, c]`: la prima voce manca. map/some saltano i buchi, quindi la validazione la lascia passare.
    const bucato = [...elenco] as Array<(typeof elenco)[number] | undefined>;
    delete bucato[0];
    expect(() => nuovaPartita({ giocatori: bucato as typeof elenco, seme: 1 })).toThrow(ErroreRegola);
  });

  it('[specifica §2 "defCarta lancia se il tipo non esiste"] defCarta("constructor") e defCarta("toString#1") lanciano', () => {
    expect(() => defCarta('constructor')).toThrow();
    expect(() => defCarta('toString#1')).toThrow();
    expect(() => defCarta('__proto__')).toThrow();
  });

  it('[specifica §3.1 "id unici" e §1 "azioni non valide ⇒ ErroreRegola"] un giocatore con id "__proto__": o nuovaPartita lo rifiuta con ErroreRegola, o un round intero si gioca senza eccezioni', () => {
    let s: Stato;
    try {
      s = nuovaPartita({ giocatori: giocatoriDi(3, ['__proto__', 'b', 'c']), seme: 1 });
    } catch (e) {
      expect(e).toBeInstanceOf(ErroreRegola);
      return;
    }
    // Si gioca il primo round scegliendo sempre la prima azione possibile di chi è atteso.
    for (let i = 0; i < 200 && s.round === 1 && s.esito === null; i++) {
      const a = candidati(s, false)[0];
      if (!a) throw new Error(`nessuna azione in ${s.fase.nome}`);
      s = applica(s, a);
    }
    expect(s.round > 1 || s.esito !== null).toBe(true);
  });

  /** true se nuovaPartita accetta l'id; se lo rifiuta deve farlo con ErroreRegola (correzione ammessa). */
  function idAccettato(id: IdGiocatore): boolean {
    try {
      nuovaPartita({ giocatori: giocatoriDi(3, [id, 'b', 'c']), seme: 1 });
      return true;
    } catch (e) {
      expect(e).toBeInstanceOf(ErroreRegola);
      return false;
    }
  }

  /** Giocatore "constructor" (id accettato da nuovaPartita, §3) fuori dal round: niente Trovate e mazzo vuoto (D32, D34). */
  function conConstructorFuori(): Stato {
    return prosegui(
      scenario({
        giocatori: [{ id: 'constructor' }, { id: 'b' }, { id: 'c' }],
        guaio: 'tosatura-a-sorpresa',
        mani: { constructor: ['beee-no'], b: ['carriola'], c: ['balla-di-fieno'] },
        mazzo: [],
      }),
    );
  }

  it('[specifica §2 "punteggioTotale … 0 se non partecipa"] con un giocatore "constructor" fuori dal round punteggioTotale vale 0 (o l\'id è rifiutato da nuovaPartita)', () => {
    if (!idAccettato('constructor')) return;
    const s = conConstructorFuori();
    expect(s.fase.nome).toBe('scelta');
    expect(s.datiRound.partecipanti).toEqual(['b', 'c']);
    expect(punteggioTotale(s, 'constructor')).toBe(0);
  });

  it('[specifica §10 "miaScelta per g"] vistaPer per un giocatore "constructor" fuori dal round non lancia e mostra miaScelta null (o l\'id è rifiutato da nuovaPartita)', () => {
    if (!idAccettato('constructor')) return;
    const s = conConstructorFuori();
    expect(() => vistaPer(s, 'constructor')).not.toThrow();
    expect(vistaPer(s, 'constructor').fase).toMatchObject({ nome: 'scelta', miaScelta: null });
  });
});
