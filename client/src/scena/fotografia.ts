// Fotografia: dalla vista del motore a ciò che la scena mostra (funzione pura, senza DOM).
// La verità è sempre il motore: la scena si mette in pari con questa fotografia.
// Ora del giorno: bozza scena.src.html, riga 1979.
import type { IdCarta, IdGiocatore, IdPecora, Vista } from '../../../engine/src';
import { mancanti, tipiPericolosi } from '../partita/descrizioni';
import { T } from '../testi';

export type OraDelGiorno = 'giorno' | 'pomeriggio' | 'tramonto' | 'sera';

export interface PostoFoto {
  id: IdGiocatore;
  nome: string;
  pecora: IdPecora;
  agnellini: number;
  angolo: IdCarta[];
  carteInMano: number;
  eliminato: boolean;
  fuoriDalRound: boolean;
  deveAgire: boolean;
  /** Carte giocate nel round: coperta finché non c'è la rivelazione (e senza id), null se non partecipa o non ha scelto. */
  giocata: { coperta: true } | { coperta: false; carte: IdCarta[] } | null;
  unGuaioAllEliminazione: boolean;
  quasiPieno: boolean;
}

export interface Fotografia {
  /** 0 = in basso, poi gli altri nell'ordine dei posti dopo di lui. */
  posti: PostoFoto[];
  gregge: number;
  postiOvile: number;
  totaleAgnellini: number;
  /** null = coperta (si vedono solo i dorsi). */
  mano: IdCarta[] | null;
  mazzo: number;
  mazzoGuai: number;
  /** Ultimi 6, la cima per ultima. */
  scarti: IdCarta[];
  guaioRound: IdCarta | null;
  /** Id della faccia dell'ultimo lancio del round. */
  dado: string | null;
  round: number;
  ultimoRound: boolean;
  ora: OraDelGiorno;
}

const SCARTI_VISIBILI = 6;
const ORDINE_ORA: OraDelGiorno[] = ['giorno', 'pomeriggio', 'tramonto', 'sera'];

function oraDelGiorno(v: Vista, ultimoRound: boolean): OraDelGiorno {
  const vivi = v.giocatori.filter((g) => !g.eliminato);
  const rapporto = vivi.reduce((m, g) => Math.max(m, g.agnellini / v.config.postiOvile), 0);
  let ora: OraDelGiorno = rapporto >= 0.86 ? 'sera' : rapporto >= 0.7 ? 'tramonto' : rapporto >= 0.5 ? 'pomeriggio' : 'giorno';
  if (ultimoRound && ORDINE_ORA.indexOf(ora) < ORDINE_ORA.indexOf('tramonto')) ora = 'tramonto';
  return ora;
}

function ultimoDado(v: Vista): string | null {
  let faccia: string | null = null;
  for (const e of v.eventi) {
    if (e.tipo === 'round_iniziato') faccia = null;
    else if (e.tipo === 'dado_lanciato') faccia = e.faccia;
  }
  return faccia;
}

function giocata(v: Vista, id: IdGiocatore, eliminato: boolean): PostoFoto['giocata'] {
  const d = v.datiRound;
  if (eliminato || !d.partecipanti.includes(id)) return null;
  const carte = d.giocate[id];
  if (carte && carte.length > 0) return { coperta: false, carte: [...carte] };
  const f = v.fase;
  const haScelto = (f.nome === 'scelta' || f.nome === 'belato_finale') && f.haScelto[id] === true;
  if (haScelto && Object.keys(d.giocate).length === 0) return { coperta: true };
  return null;
}

export function fotografia(tavolo: Vista, inBasso: IdGiocatore, mano: IdCarta[] | null): Fotografia {
  const v = tavolo;
  const i = Math.max(0, v.giocatori.findIndex((g) => g.id === inBasso));
  const ruotati = [...v.giocatori.slice(i), ...v.giocatori.slice(0, i)];
  const partecipanti = v.datiRound.partecipanti;
  const posti: PostoFoto[] = ruotati.map((g) => ({
    id: g.id,
    nome: g.nome,
    pecora: g.pecora,
    agnellini: g.agnellini,
    angolo: [...g.angolo],
    carteInMano: g.carteInMano,
    eliminato: g.eliminato,
    fuoriDalRound: !g.eliminato && partecipanti.length > 0 && !partecipanti.includes(g.id),
    deveAgire: v.attesa.giocatori.includes(g.id),
    giocata: giocata(v, g.id, g.eliminato),
    unGuaioAllEliminazione: tipiPericolosi(v, g.id).length > 0,
    quasiPieno: !g.eliminato && mancanti(v, g.id) <= 3,
  }));
  const ultimoRound = v.ultimoRound !== null;
  return {
    posti,
    gregge: v.gregge,
    postiOvile: v.config.postiOvile,
    totaleAgnellini: v.giocatori.reduce((somma, g) => somma + g.agnellini, v.gregge),
    mano: mano ? [...mano] : null,
    mazzo: v.carteNelMazzo,
    mazzoGuai: v.carteNelMazzoGuai,
    scarti: v.scarti.slice(-SCARTI_VISIBILI),
    guaioRound: v.datiRound.guaio,
    dado: ultimoDado(v),
    round: v.round,
    ultimoRound,
    ora: oraDelGiorno(v, ultimoRound),
  };
}

/** Chi sta in basso a inizio partita: il primo in attesa, a partire dal primo giocatore; altrimenti il primo dell'elenco. */
export function inBassoIniziale(tavolo: Vista): IdGiocatore {
  const elenco = tavolo.giocatori;
  const i = Math.max(0, elenco.findIndex((g) => g.id === tavolo.primoGiocatore));
  const ordine = [...elenco.slice(i), ...elenco.slice(0, i)];
  const inAttesa = ordine.find((g) => tavolo.attesa.giocatori.includes(g.id));
  return (inAttesa ?? elenco[0]!).id;
}

/** Una riga per posto, poi il gregge: per chi non vede la scena. */
export function riassuntoTestuale(f: Fotografia): string[] {
  const r = T.scena.riassunto;
  return [
    ...f.posti.map((p) => (p.eliminato ? r.eliminata(p.nome) : r.posto(p.nome, p.agnellini, f.postiOvile, p.angolo.length))),
    r.gregge(f.gregge),
  ];
}
