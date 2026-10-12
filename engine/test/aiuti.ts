// Aiuti per i test del motore. Firme vincolanti: vedi docs/motore.md, sezione 14.
import type { IdCarta, IdGiocatore, IdPecora, IdTipoCarta, Stato, StatoGiocatore } from '../src';
import {
  applica,
  configPer,
  creaMazzoGuai,
  creaMazzoPrincipale,
  defCarta,
  inAttesaDi,
  punteggioTotale,
  tipoDi,
} from '../src';
import { estraiFaccia } from '../src/dado';

export interface OpzioniScenario {
  giocatori?: number | Array<{ id?: IdGiocatore; nome?: string; pecora?: IdPecora }>;
  seme?: number;
  mani?: Record<IdGiocatore, Array<IdTipoCarta | IdCarta>>;
  mazzo?: Array<IdTipoCarta | IdCarta>;
  mazzoGuai?: Array<IdTipoCarta | IdCarta>;
  guaio?: IdTipoCarta | IdCarta | null;
  agnellini?: Record<IdGiocatore, number>;
  gregge?: number;
  angoli?: Record<IdGiocatore, Array<IdTipoCarta | IdCarta>>;
  eliminati?: IdGiocatore[];
  scarti?: Array<IdTipoCarta | IdCarta>;
  guaiFuoriGioco?: Array<IdTipoCarta | IdCarta>;
  round?: number;
  ultimoRound?: number | null;
  primoGiocatore?: IdGiocatore;
}

const PECORE: IdPecora[] = ['ricciolo', 'brontolana', 'sospirella', 'nerina'];
const LIMITE_CICLI = 10_000;

const eIstanza = (x: string): boolean => x.includes('#');

/** Stato in fase 'guaio' costruito direttamente (senza nuovaPartita), con il Guaio del round già scoperto. */
export function scenario(o: OpzioniScenario = {}): Stato {
  const richiesti =
    o.giocatori === undefined || typeof o.giocatori === 'number'
      ? Array.from({ length: o.giocatori ?? 3 }, () => ({}) as { id?: IdGiocatore; nome?: string; pecora?: IdPecora })
      : o.giocatori;
  const n = richiesti.length;
  const config = configPer(n);
  const ids = richiesti.map((g, i) => g.id ?? `g${i + 1}`);

  // Prima si riservano le istanze esplicite, poi i tipi diventano le istanze successive libere.
  const usate = new Set<IdCarta>();
  const liste: Array<Array<IdTipoCarta | IdCarta> | undefined> = [
    ...ids.map((id) => o.mani?.[id]),
    ...ids.map((id) => o.angoli?.[id]),
    o.scarti,
    o.guaio ? [o.guaio] : undefined,
    o.mazzoGuai,
    o.guaiFuoriGioco,
    o.mazzo,
  ];
  for (const lista of liste) for (const x of lista ?? []) if (eIstanza(x)) usate.add(x);
  const risolvi = (x: IdTipoCarta | IdCarta): IdCarta => {
    defCarta(x);
    if (eIstanza(x)) return x;
    let k = 1;
    while (usate.has(`${x}#${k}`)) k++;
    const id = `${x}#${k}`;
    usate.add(id);
    return id;
  };
  const risolviTutte = (lista: Array<IdTipoCarta | IdCarta> | undefined): IdCarta[] => (lista ?? []).map(risolvi);

  const mani = ids.map((id) => risolviTutte(o.mani?.[id]));
  const angoli = ids.map((id) => risolviTutte(o.angoli?.[id]));
  const scarti = risolviTutte(o.scarti);
  let guaio: IdCarta | null = o.guaio ? risolvi(o.guaio) : null;
  const mazzoGuaiEsplicito = o.mazzoGuai ? risolviTutte(o.mazzoGuai) : null;
  const guaiFuoriGioco = risolviTutte(o.guaiFuoriGioco);
  const mazzoEsplicito = o.mazzo ? risolviTutte(o.mazzo) : null;

  const mazzoGuai = mazzoGuaiEsplicito ?? creaMazzoGuai().filter((c) => !usate.has(c));
  if (o.guaio === undefined) guaio = mazzoGuai.shift() ?? null;
  const mazzo = mazzoEsplicito ?? creaMazzoPrincipale(n).filter((c) => !usate.has(c));

  const eliminati = new Set(o.eliminati ?? []);
  const giocatori: StatoGiocatore[] = richiesti.map((g, i) => {
    const id = ids[i] as IdGiocatore;
    return {
      id,
      nome: g.nome ?? `Giocatore ${i + 1}`,
      pecora: g.pecora ?? (PECORE[i] as IdPecora),
      mano: mani[i] as IdCarta[],
      agnellini: o.agnellini?.[id] ?? config.agnelliniIniziali,
      angolo: angoli[i] as IdCarta[],
      eliminato: eliminati.has(id),
    };
  });
  const sommaAgnellini = giocatori.reduce((somma, g) => somma + g.agnellini, 0);
  const round = o.round ?? 1;

  return {
    config,
    rng: (o.seme ?? 1) >>> 0,
    giocatori,
    gregge: o.gregge ?? config.agnelliniTotali - sommaAgnellini,
    mazzo,
    scarti,
    mazzoGuai,
    guaiFuoriGioco,
    round,
    primoGiocatore: o.primoGiocatore ?? (ids[0] as IdGiocatore),
    ultimoRound: o.ultimoRound ?? null,
    fase: { nome: 'guaio' },
    datiRound: {
      numero: round,
      guaio,
      partecipanti: [],
      giocate: {},
      punteggi: {},
      tavolo: [],
      raddoppioBelati: false,
      ignoraEffetti: null,
      piuAlti: [],
      piuBassi: [],
      lanciatori: [],
      presoDa: null,
    },
    pila: [],
    finestra: null,
    richiesta: null,
    prossimaVoce: 1,
    esito: null,
    eventi: [],
    prossimoEvento: 1,
  };
}

export function prosegui(s: Stato): Stato {
  return applica(s, { tipo: 'prosegui' });
}

/** `prosegui` finché il motore aspetta il sistema. */
export function avanza(s: Stato): Stato {
  let stato = s;
  for (let i = 0; inAttesaDi(stato).sistema; i++) {
    if (i > LIMITE_CICLI) throw new Error('avanza: troppi passi');
    stato = prosegui(stato);
  }
  return stato;
}

function manoDi(s: Stato, giocatore: IdGiocatore): IdCarta[] {
  const g = s.giocatori.find((x) => x.id === giocatore);
  if (!g) throw new Error(`Giocatore sconosciuto: ${giocatore}`);
  return g.mano;
}

/** Prima istanza di quel tipo nella mano (un id di istanza deve essere in mano). */
export function carta(s: Stato, giocatore: IdGiocatore, tipo: IdTipoCarta): IdCarta {
  const mano = manoDi(s, giocatore);
  const trovata = eIstanza(tipo) ? mano.find((c) => c === tipo) : mano.find((c) => tipoDi(c) === tipo);
  if (!trovata) throw new Error(`${giocatore} non ha ${tipo} in mano (mano: ${mano.join(', ')})`);
  return trovata;
}

/** `scegliTrovata` per ciascuno; i tipi diventano istanze distinte della mano. */
export function scegli(s: Stato, scelte: Record<IdGiocatore, Array<IdTipoCarta | IdCarta>>): Stato {
  let stato = s;
  for (const [giocatore, lista] of Object.entries(scelte)) {
    const mano = manoDi(stato, giocatore);
    const prese: IdCarta[] = [];
    for (const x of lista) {
      const c = eIstanza(x) ? x : mano.find((m) => tipoDi(m) === x && !prese.includes(m));
      if (!c) throw new Error(`${giocatore} non ha ${x} in mano (mano: ${mano.join(', ')})`);
      prese.push(c);
    }
    stato = applica(stato, { tipo: 'scegliTrovata', giocatore, carte: prese });
  }
  return stato;
}

/** `scadenza` finché c'è una finestra aperta. */
export function nessunaReazione(s: Stato): Stato {
  let stato = s;
  for (let i = 0; stato.finestra; i++) {
    if (i > LIMITE_CICLI) throw new Error('nessunaReazione: troppi passi');
    stato = applica(stato, { tipo: 'scadenza' });
  }
  return stato;
}

export function totale(s: Stato, giocatore: IdGiocatore): number {
  return punteggioTotale(s, giocatore);
}

/** In 'effetti' rinuncia a ogni voce finché si esce dalla fase. */
export function rinunciaTutti(s: Stato): Stato {
  let stato = s;
  for (let i = 0; stato.fase.nome === 'effetti'; i++) {
    if (i > LIMITE_CICLI) throw new Error('rinunciaTutti: troppi passi');
    const f = stato.fase;
    const voce = f.coda[f.indice];
    if (!voce || stato.pila.length > 0 || stato.richiesta) break;
    stato = applica(stato, { tipo: 'rinunciaEffetto', giocatore: voce.giocatore, carta: voce.carta });
  }
  return stato;
}

/** In 'belati_punteggio' con la pila vuota: scadenza. */
export function chiudiPunteggio(s: Stato): Stato {
  return applica(s, { tipo: 'scadenza' });
}

/** Copia di `s` con un valore di rng tale che il prossimo `lanciaDado` dia quella faccia. */
export function conFaccia(s: Stato, idFaccia: string): Stato {
  if (!s.config.dado.some((f) => f.id === idFaccia)) throw new Error(`Faccia sconosciuta: ${idFaccia}`);
  for (let rng = 0; rng < 1_000_000; rng++) {
    if (estraiFaccia({ rng }, s.config.dado).id === idFaccia) {
      const copia = structuredClone(s);
      copia.rng = rng;
      return copia;
    }
  }
  throw new Error(`Nessun valore di rng produce ${idFaccia}`);
}
