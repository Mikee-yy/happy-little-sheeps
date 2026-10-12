// Catalogo delle carte e numeri della preparazione, letti da cards.json e setup.json.
import carteJson from '../data/cards.json';
import setupJson from '../data/setup.json';
import type {
  ConfigPartita,
  DefBelato,
  DefCarta,
  DefGuaio,
  DefPecora,
  DefTrovata,
  EffettoBelato,
  EffettoTrovata,
  FacciaDado,
  GruppoEffetto,
  IdCarta,
  IdPecora,
  IdTipoCarta,
  MomentoBelato,
  RegolaEliminazione,
  TipoGuaioCarta,
} from './tipi';
import { ErroreRegola } from './tipi';

/** Contenuto di setup.json. */
export interface DatiSetup {
  manoIniziale: number;
  agnelliniIniziali: number;
  perNumeroGiocatori: Record<string, { postiOvile: number; agnelliniTotali: number }>;
  varianteDueGiocatori: { valoriTrovateTolti: number[] };
  eliminazione: { normale: RegolaEliminazione[]; dueGiocatori: RegolaEliminazione[] };
  dado: FacciaDado[];
  testata: { esitoMassimo: number; probabilitaEsitoSimulatore: number[] };
  pecore: DefPecora[];
  finestraReazioneSecondi: number;
}

/** Congela in profondità: i dati condivisi non devono cambiare durante una partita (specifica §1). */
function congela<T>(x: T): T {
  if (x && typeof x === 'object' && !Object.isFrozen(x)) {
    Object.freeze(x);
    for (const v of Object.values(x)) congela(v);
  }
  return x;
}

export const SETUP: DatiSetup = congela(structuredClone(setupJson) as unknown as DatiSetup);

interface DatiCarte {
  effettiTrovata: Record<string, { gruppo: GruppoEffetto }>;
  effettiBelato: Record<string, { quando: MomentoBelato }>;
  trovate: Array<Omit<DefTrovata, 'famiglia' | 'gruppo'>>;
  belati: Array<Omit<DefBelato, 'famiglia' | 'quando'>>;
  guai: Array<{ id: IdTipoCarta; nome: string; tipo: TipoGuaioCarta; testo: string }>;
}

const DATI_CARTE = carteJson as unknown as DatiCarte;

function costruisciCatalogo(): { carte: Record<IdTipoCarta, DefCarta>; pecore: Record<IdPecora, DefPecora> } {
  const carte: Record<IdTipoCarta, DefCarta> = {};
  for (const t of DATI_CARTE.trovate) {
    const effetto = (t.effetto ?? null) as EffettoTrovata | null;
    const gruppo = effetto ? (DATI_CARTE.effettiTrovata[effetto]?.gruppo ?? null) : null;
    carte[t.id] = { ...t, famiglia: 'trovata', effetto, gruppo };
  }
  for (const b of DATI_CARTE.belati) {
    const quando = DATI_CARTE.effettiBelato[b.effetto]?.quando;
    if (!quando) throw new Error(`Belato senza momento: ${b.id}`);
    carte[b.id] = { ...b, effetto: b.effetto as EffettoBelato, famiglia: 'belato', quando };
  }
  for (const g of DATI_CARTE.guai) {
    const def: DefGuaio = { ...g, famiglia: 'guaio', copie: 1 };
    carte[g.id] = def;
  }
  const pecore = {} as Record<IdPecora, DefPecora>;
  for (const p of SETUP.pecore) pecore[p.id] = { ...p };
  return { carte, pecore };
}

export const CATALOGO: { carte: Record<IdTipoCarta, DefCarta>; pecore: Record<IdPecora, DefPecora> } = congela(
  costruisciCatalogo(),
);

export const TIPI_GUAIO = ['meteo', 'predatori', 'drammi'] as const;

/** "calzino-gemello#2" → "calzino-gemello". */
export function tipoDi(carta: IdCarta | IdTipoCarta): IdTipoCarta {
  const i = carta.indexOf('#');
  return i < 0 ? carta : carta.slice(0, i);
}

/** Voce del catalogo solo se è una chiave propria: "constructor", "__proto__"… non sono carte. */
function cercaCarta(carta: IdCarta | IdTipoCarta): DefCarta | undefined {
  const tipo = tipoDi(carta);
  return Object.hasOwn(CATALOGO.carte, tipo) ? CATALOGO.carte[tipo] : undefined;
}

/** Pecora del catalogo, con lo stesso controllo sulle chiavi proprie. */
export function pecoraEsiste(pecora: IdPecora): boolean {
  return typeof pecora === 'string' && Object.hasOwn(CATALOGO.pecore, pecora);
}

export function defCarta(carta: IdCarta | IdTipoCarta): DefCarta {
  const def = cercaCarta(carta);
  if (!def) throw new ErroreRegola('carta_non_valida', `Carta sconosciuta: ${carta}`);
  return def;
}

export function cartaEsiste(carta: IdCarta | IdTipoCarta): boolean {
  return cercaCarta(carta) !== undefined;
}

export function eTrovata(carta: IdCarta): boolean {
  return cercaCarta(carta)?.famiglia === 'trovata';
}

export function defTrovata(carta: IdCarta): DefTrovata {
  const def = defCarta(carta);
  if (def.famiglia !== 'trovata') throw new ErroreRegola('carta_non_valida', `Non è una Trovata: ${carta}`);
  return def;
}

export function defBelato(carta: IdCarta): DefBelato | null {
  const def = cercaCarta(carta);
  return def?.famiglia === 'belato' ? def : null;
}

export function defGuaio(carta: IdCarta): DefGuaio {
  const def = defCarta(carta);
  if (def.famiglia !== 'guaio') throw new ErroreRegola('carta_non_valida', `Non è un Guaio: ${carta}`);
  return def;
}

function istanze(id: IdTipoCarta, copie: number): IdCarta[] {
  return Array.from({ length: copie }, (_, i) => `${id}#${i + 1}`);
}

/** Istanze non mescolate in ordine di catalogo; a 2 giocatori senza le Trovate dei valori tolti. */
export function creaMazzoPrincipale(numeroGiocatori: number): IdCarta[] {
  const tolti = numeroGiocatori === 2 ? SETUP.varianteDueGiocatori.valoriTrovateTolti : [];
  const mazzo: IdCarta[] = [];
  for (const t of DATI_CARTE.trovate) {
    if (tolti.includes(t.valore)) continue;
    mazzo.push(...istanze(t.id, t.copie));
  }
  for (const b of DATI_CARTE.belati) mazzo.push(...istanze(b.id, b.copie));
  return mazzo;
}

export function creaMazzoGuai(): IdCarta[] {
  return DATI_CARTE.guai.map((g) => `${g.id}#1`);
}

export function configPer(numeroGiocatori: number): ConfigPartita {
  const numeri = SETUP.perNumeroGiocatori[String(numeroGiocatori)];
  if (!Number.isInteger(numeroGiocatori) || !numeri) {
    throw new ErroreRegola('giocatori_non_validi', `Numero di giocatori non ammesso: ${numeroGiocatori}`);
  }
  const regole = numeroGiocatori === 2 ? SETUP.eliminazione.dueGiocatori : SETUP.eliminazione.normale;
  return {
    numeroGiocatori,
    postiOvile: numeri.postiOvile,
    agnelliniTotali: numeri.agnelliniTotali,
    agnelliniIniziali: SETUP.agnelliniIniziali,
    manoIniziale: SETUP.manoIniziale,
    regoleEliminazione: regole.map((r) => ({ ...r })),
    dado: SETUP.dado.map((f) => ({ ...f })),
    esitoMassimoTestata: SETUP.testata.esitoMassimo,
  };
}
