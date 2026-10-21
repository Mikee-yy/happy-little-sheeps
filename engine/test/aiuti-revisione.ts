// Aiuti comuni della revisione avversariale (segreti, purezza, determinismo, robustezza): partite casuali, controlli
// d'integrità, varianti malformate delle azioni; più la prova di robustezza di una partita, che sta in file separati
// (uno per partita) così i pezzi lunghi girano su fili diversi.
import {
  applica,
  azioniPossibili,
  creaMazzoGuai,
  creaMazzoPrincipale,
  ErroreRegola,
  inAttesaDi,
  nuovaPartita,
  tentaApplica,
  vistaPer,
} from '../src';
import type { Azione, IdCarta, IdGiocatore, IdPecora, Stato } from '../src';

export const PECORE: IdPecora[] = ['ricciolo', 'brontolana', 'sospirella', 'nerina'];
export const MASSIMO_AZIONI = 5000;

/** Generatore locale con seme (mulberry32), indipendente da quello del motore. */
export function generatore(seme: number): () => number {
  let a = seme >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function giocatoriDi(n: number, ids?: IdGiocatore[]): Array<{ id: IdGiocatore; nome: string; pecora: IdPecora }> {
  return Array.from({ length: n }, (_, i) => ({
    id: ids?.[i] ?? `p${i + 1}`,
    nome: `P${i + 1}`,
    pecora: PECORE[i] as IdPecora,
  }));
}

export function candidati(s: Stato, tutti: boolean): Azione[] {
  const azioni: Azione[] = [...azioniPossibili(s, 'sistema')];
  const chi = tutti ? s.giocatori.map((g) => g.id) : inAttesaDi(s).giocatori;
  for (const id of chi) azioni.push(...azioniPossibili(s, id));
  return azioni;
}

/**
 * Gioca una partita casuale guidata da azioniPossibili. `osserva` riceve ogni stato (anche il primo)
 * e l'azione che sta per essere applicata (null sull'ultimo stato).
 */
export function giocaPartita(
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
export function stringhe(x: unknown, out: Set<string> = new Set()): Set<string> {
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
export function congela<T>(x: T): T {
  if (x !== null && typeof x === 'object' && !Object.isFrozen(x)) {
    Object.freeze(x);
    for (const v of Object.values(x)) congela(v);
  }
  return x;
}

/** Modifica in profondità ogni oggetto e array raggiungibile (per scoprire riferimenti condivisi). */
export function devasta(x: unknown, visti: Set<unknown> = new Set()): void {
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

export const TUTTI_GUAI = creaMazzoGuai();
export const MAZZI = new Map<number, IdCarta[]>();

export function verifica(condizione: boolean, messaggio: () => string): void {
  if (!condizione) throw new Error(messaggio());
}

/** Ogni istanza esattamente una volta. */
export function unaVolta(trovate: IdCarta[], attese: IdCarta[], cosa: string): void {
  const conta = new Map<IdCarta, number>();
  for (const c of trovate) conta.set(c, (conta.get(c) ?? 0) + 1);
  for (const c of attese) verifica(conta.get(c) === 1, () => `${cosa}: ${c} presente ${conta.get(c) ?? 0} volte`);
  verifica(conta.size === attese.length, () => `${cosa}: carte estranee ${[...conta.keys()].filter((c) => !attese.includes(c))}`);
}

/** Invarianti di uno stato integro: agnellini e carte conservati, pila e finestra coerenti, partecipanti validi. */
export function controllaInvarianti(s: Stato): void {
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
/** Carte che `per` non deve poter vedere in questo stato. */
export function segretiPer(s: Stato, per: IdGiocatore | null, guaiNoti: ReadonlySet<IdCarta>): IdCarta[] {
  const segreti: IdCarta[] = [...s.mazzo];
  for (const g of s.giocatori) if (g.id !== per) segreti.push(...g.mano);
  if (s.richiesta?.tipo === 'guarda_due' && s.richiesta.giocatore !== per) segreti.push(...s.richiesta.carte);
  for (const c of s.mazzoGuai) if (!guaiNoti.has(c)) segreti.push(c);
  return segreti;
}

export function controllaSegreti(s: Stato, guaiNoti: ReadonlySet<IdCarta>, contesto: string): void {
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

/** Percorso del primo valore che JSON non conserva (undefined, NaN, ±Infinity, -0, funzioni, oggetti non semplici), o null. */
export function valoreNonJson(x: unknown, percorso: string): string | null {
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
export const VALORI_STRANI: unknown[] = [
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

export const CAMPI = ['giocatore', 'carta', 'carte', 'bersaglio', 'voce', 'guaio', 'furto', 'esito', 'scarta'];

/** Varianti malformate di un'azione valida. */
export function varianti(s: Stato, a: Azione, rnd: () => number): unknown[] {
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

export const TIPI_AZIONE = [
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
export function azioniACaso(s: Stato, rnd: () => number): unknown[] {
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

export function provaMalformata(s: Stato, v: unknown, contesto: string): void {
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

/**
 * Una partita della prova di robustezza a `numero` giocatori. Il generatore `rnd` è uno solo per tutte le partite di un numero
 * di giocatori: per riprodurre esattamente la sequenza di tentativi, la partita `k` rigioca prima (senza provare niente) quelle
 * che la precedono, e poi prova davvero solo la sua.
 */
export function provaRobustezza(numero: number, k: number): void {
  const rnd = generatore(numero * 1001);
  for (let j = 0; j <= k; j++) {
    const seme = 321 + numero * 7 + j;
    giocaPartita(numero, seme, (s, _azione, passo) => {
      if (passo % 9 !== 0) return;
      const prima = JSON.stringify(s);
      const valide = candidati(s, true);
      const scelte = valide.filter(() => rnd() < Math.min(1, 6 / Math.max(1, valide.length)));
      // Al massimo ~300 tentativi per stato: varianti delle azioni valide più azioni a caso.
      const tentativi = [...scelte.flatMap((a) => varianti(s, a, rnd)), ...azioniACaso(s, rnd)];
      const quota = Math.min(1, 300 / Math.max(1, tentativi.length));
      for (const v of tentativi) {
        if (rnd() < quota && j === k) provaMalformata(s, v, `seme ${seme} passo ${passo} (${s.fase.nome})`);
      }
      verifica(JSON.stringify(s) === prima, () => `seme ${seme} passo ${passo}: lo stato originale è cambiato`);
    });
  }
}
