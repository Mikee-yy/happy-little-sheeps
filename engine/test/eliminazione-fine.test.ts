// Eliminazione, modi di vincere, ultimo round, rotazione del primo giocatore e variante a 2 giocatori.
// Regole: brief sezione 3 ("Come si vince", "Svolgimento di un round" punti 10–12, "Eliminazione",
// "Variante a 2 giocatori", "Casi limite") e sezione 8 ("Test da non saltare");
// specifica docs/motore.md sezioni 2, 3, 4.1, 4.2, 4.11, 4.12, 8, 9, 11 e decisioni D19, D23, D28–D37.
import { describe, expect, it } from 'vitest';
import {
  angoloElimina,
  applica,
  azioniPossibili,
  configPer,
  creaMazzoPrincipale,
  defCarta,
  eFaseAutomatica,
  ErroreRegola,
  inAttesaDi,
  nuovaPartita,
  tipiCheEliminano,
  tipoDi,
  vistaPer,
  type Azione,
  type Evento,
  type Fase,
  type IdCarta,
  type IdGiocatore,
  type IdTipoCarta,
  type ModoVittoria,
  type NomeFase,
  type RegolaEliminazione,
  type Stato,
  type StatoGiocatore,
  type TipoGuaioCarta,
  type VoceEffetto,
} from '../src';
import {
  avanza,
  carta,
  chiudiPunteggio,
  conFaccia,
  nessunaReazione,
  prosegui,
  rinunciaTutti,
  scegli,
  scenario,
  type OpzioniScenario,
} from './aiuti';

// ─── Aiuti locali ────────────────────────────────────────────────────────────

type Scelte = Record<IdGiocatore, Array<IdTipoCarta | IdCarta>>;
type EventoDi<T extends Evento['tipo']> = Extract<Evento, { tipo: T }>;
type Lettera = 'M' | 'P' | 'D' | 'T';

/** Regole di eliminazione di setup.json (specifica 8). */
const NORMALI: RegolaEliminazione[] = [
  { regola: 'uguali', quanti: 3 },
  { regola: 'diversi', quanti: 3 },
];
const DUE_GIOCATORI: RegolaEliminazione[] = [
  { regola: 'uguali', quanti: 4 },
  { regola: 'perTipo', quanti: 2 },
];

/** Posti dell'Ovile da setup.json (specifica 3): 3 giocatori (default degli scenari) e 2 giocatori. */
const OVILE_3 = configPer(3).postiOvile;
const OVILE_2 = configPer(2).postiOvile;

const TIPO_DI_LETTERA: Record<Lettera, TipoGuaioCarta> = {
  M: 'meteo',
  P: 'predatori',
  D: 'drammi',
  T: 'tosatura',
};
const TUTTI_I_TIPI: TipoGuaioCarta[] = ['meteo', 'predatori', 'drammi', 'tosatura'];

/** Guai di cards.json per tipo. */
const GUAI: Record<Lettera, IdTipoCarta[]> = {
  M: [
    'grandine-a-sorpresa',
    'fulmine-curioso',
    'pioggia-di-traverso',
    'nebbia-fitta',
    'vento-dispettoso',
    'gelata-di-agosto',
    'pozzanghera-senza-fondo',
  ],
  P: [
    'lupo-vegetariano',
    'volpe-gentile',
    'aquila-con-il-taccuino',
    'occhi-nel-cespuglio',
    'lupo-travestito',
    'invito-nel-bosco',
    'faina-con-la-lista',
  ],
  D: [
    'figuraccia-al-pascolo',
    'specchio-impietoso',
    'crisi-esistenziale',
    'gregge-senza-di-te',
    'compleanno-dimenticato',
    'insonnia',
    'inciampo-al-ruscello',
  ],
  T: ['tosatura-a-sorpresa', 'spuntatina', 'rasatura-integrale'],
};

/** "M+P+T" senza segni: "MPT". */
function lettere(sigla: string): Lettera[] {
  return [...sigla].map((l) => {
    if (l !== 'M' && l !== 'P' && l !== 'D' && l !== 'T') throw new Error(`sigla non valida: ${sigla}`);
    return l;
  });
}

/** "MMT" → meteo, meteo, tosatura. */
const tipi = (sigla: string): TipoGuaioCarta[] => lettere(sigla).map((l) => TIPO_DI_LETTERA[l]);

/** "MMT" → "M+M+T", per i nomi dei test. */
const leggibile = (sigla: string): string => (sigla === '' ? 'Angolo vuoto' : lettere(sigla).join('+'));

/** Carte Guaio sempre diverse all'interno di uno stesso scenario, scelte per tipo. */
function nuoviGuai(): { angolo: (sigla: string) => IdTipoCarta[]; uno: (lettera: Lettera) => IdTipoCarta } {
  const usate: Record<Lettera, number> = { M: 0, P: 0, D: 0, T: 0 };
  const angolo = (sigla: string): IdTipoCarta[] =>
    lettere(sigla).map((l) => {
      const id = GUAI[l][usate[l]];
      if (id === undefined) throw new Error(`Guai di tipo ${l} esauriti`);
      usate[l] += 1;
      return id;
    });
  const uno = (lettera: Lettera): IdTipoCarta => {
    const [id] = angolo(lettera);
    if (id === undefined) throw new Error('Guaio mancante');
    return id;
  };
  return { angolo, uno };
}

const copie = (tipo: IdTipoCarta, n: number): IdTipoCarta[] => Array.from({ length: n }, () => tipo);
const ordinati = <T extends string>(a: readonly T[]): T[] => [...a].sort();

function idGiocatori(o: OpzioniScenario): IdGiocatore[] {
  const n = typeof o.giocatori === 'number' ? o.giocatori : (o.giocatori?.length ?? 3);
  return Array.from({ length: n }, (_, i) => `g${i + 1}`);
}

function gioc(s: Stato, id: IdGiocatore): StatoGiocatore {
  const g = s.giocatori.find((x) => x.id === id);
  if (!g) throw new Error(`giocatore ${id} assente`);
  return g;
}

function fase<N extends NomeFase>(s: Stato, nome: N): Extract<Fase, { nome: N }> {
  if (s.fase.nome !== nome) throw new Error(`fase '${s.fase.nome}', attesa '${nome}'`);
  return s.fase as Extract<Fase, { nome: N }>;
}

/** Eventi emessi passando da `prima` a `dopo`. */
function nuoviEventi(prima: Stato, dopo: Stato): Evento[] {
  return dopo.eventi.filter((e) => e.seq >= prima.prossimoEvento);
}

function eventiDi<T extends Evento['tipo']>(eventi: Evento[], tipo: T): EventoDi<T>[] {
  return eventi.filter((e): e is EventoDi<T> => e.tipo === tipo);
}

function voceCorrente(s: Stato): VoceEffetto {
  const f = fase(s, 'effetti');
  const voce = f.coda[f.indice];
  if (!voce) throw new Error('nessuna voce corrente');
  return voce;
}

/** Da scenario a subito dopo la rivelazione (fase 'effetti' o oltre, se nessuna carta ha effetti). */
function finoAgliEffetti(o: OpzioniScenario, scelte: Scelte): Stato {
  let s = prosegui(scenario(o));
  fase(s, 'scelta');
  s = scegli(s, scelte);
  fase(s, 'rivelazione');
  return prosegui(s);
}

/** Dalla fase 'scelta' alla finestra dei Belati di punteggio (o oltre), rinunciando a ogni effetto. */
function finoAiBelatiDiPunteggio(s: Stato, scelte: Scelte): Stato {
  s = scegli(s, scelte);
  fase(s, 'rivelazione');
  s = prosegui(s);
  if (s.fase.nome === 'effetti') s = rinunciaTutti(s);
  return s;
}

/** Dalla fase 'scelta' a punteggio chiuso (scadenza dei Belati di punteggio). */
function chiudiDaScelta(s: Stato, scelte: Scelte): Stato {
  s = finoAiBelatiDiPunteggio(s, scelte);
  if (s.fase.nome === 'belati_punteggio') s = chiudiPunteggio(s);
  return s;
}

/** Da scenario a punteggio chiuso: scelte, rivelazione, rinuncia a ogni effetto, scadenza dei Belati di punteggio. */
function finoAlDado(o: OpzioniScenario, scelte: Scelte): Stato {
  const s = prosegui(scenario(o));
  fase(s, 'scelta');
  return chiudiDaScelta(s, scelte);
}

/** Ogni lanciatore ottiene la faccia indicata e nessuno reagisce; si ferma fuori dalla fase 'dado'. */
function lanciaTutti(s: Stato, faccia = 'pascolo_piccolo'): Stato {
  while (s.fase.nome === 'dado') {
    const lanciatore = s.datiRound.lanciatori[fase(s, 'dado').indice];
    if (lanciatore === undefined) throw new Error('lanciatore mancante');
    s = nessunaReazione(applica(conFaccia(s, faccia), { tipo: 'lanciaDado', giocatore: lanciatore }));
  }
  return s;
}

/**
 * Mani e scelte di un round in cui `alto` ha il punteggio più alto (Carriola, 8) e `basso` il più basso
 * (Sasso comodo, 2; a 2 giocatori Balla di fieno, 5, perché il mazzo ridotto non ha Trovate da 1 a 3);
 * gli altri non eliminati giocano Balla di fieno (5). Con qualunque Guaio i tratti (±1) non cambiano l'ordine.
 * La carta giocata è aggiunta in testa a `o.mani`.
 */
function conRound(o: OpzioniScenario, alto: IdGiocatore, basso: IdGiocatore): { opzioni: OpzioniScenario; scelte: Scelte } {
  const ids = idGiocatori(o);
  const eliminati = o.eliminati ?? [];
  const cartaBassa: IdTipoCarta = ids.length === 2 ? 'balla-di-fieno' : 'sasso-comodo';
  const mani: Record<IdGiocatore, Array<IdTipoCarta | IdCarta>> = { ...o.mani };
  const scelte: Scelte = {};
  for (const id of ids) {
    if (eliminati.includes(id)) continue;
    const giocata = id === alto ? 'carriola' : id === basso ? cartaBassa : 'balla-di-fieno';
    mani[id] = [giocata, ...(o.mani?.[id] ?? [])];
    scelte[id] = [giocata];
  }
  return { opzioni: { ...o, mani }, scelte };
}

/** Fino a 'guaio_al_peggiore': il più alto lancia (Pascolo piccolo), il più basso è il destinatario. */
function finoAlGuaio(o: OpzioniScenario, alto: IdGiocatore, basso: IdGiocatore): Stato {
  const { opzioni, scelte } = conRound(o, alto, basso);
  const s = lanciaTutti(finoAlDado(opzioni, scelte));
  expect(fase(s, 'guaio_al_peggiore').destinatario).toBe(basso);
  return s;
}

/** Fino alla consolazione: il destinatario non gioca Belati di salvataggio e prende il Guaio. */
function finoAllaConsolazione(o: OpzioniScenario, alto: IdGiocatore, basso: IdGiocatore): Stato {
  let s = prosegui(finoAlGuaio(o, alto, basso));
  expect(fase(s, 'belati_salvataggio').destinatario).toBe(basso);
  s = applica(s, { tipo: 'passa', giocatore: basso });
  expect(fase(s, 'consolazione').destinatario).toBe(basso);
  return s;
}

function concludi(s: Stato, scarta: IdCarta | null = null): Stato {
  const { destinatario } = fase(s, 'consolazione');
  return applica(s, { tipo: 'concludiConsolazione', giocatore: destinatario, scarta });
}

/**
 * Da 'guaio' a 'fine_round' in un round in cui tutti i partecipanti giocano una carta dello stesso tipo:
 * con un Guaio Tosatura (nessun tratto) sono tutti pari, nessuno lancia e il Guaio va in fondo.
 */
function roundPari(s: Stato, tipo: IdTipoCarta): Stato {
  s = prosegui(s);
  const scelte: Scelte = {};
  for (const id of s.datiRound.partecipanti) scelte[id] = [tipo];
  s = prosegui(scegli(s, scelte));
  s = chiudiPunteggio(s);
  expect(fase(s, 'guaio_al_peggiore')).toMatchObject({ destinatario: null, spareggio: null });
  s = prosegui(s);
  fase(s, 'fine_round');
  return s;
}

/**
 * La partita è chiusa (specifica 1, 9, 11): esito, fase, pila, finestra e richiesta svuotate, un solo evento
 * `fine_partita` dopo `prima`, nessuno in attesa, nessuna azione possibile e ogni azione rifiutata.
 */
function verificaFinePartita(
  prima: Stato,
  s: Stato,
  modo: ModoVittoria,
  vincitori: IdGiocatore[],
  altreAzioni: Azione[] = [],
): void {
  expect(s.esito?.modo).toBe(modo);
  expect(ordinati(s.esito?.vincitori ?? [])).toEqual(ordinati(vincitori));
  expect(s.fase).toEqual({ nome: 'fine_partita' });
  expect(s.pila).toEqual([]);
  expect(s.finestra).toBeNull();
  expect(s.richiesta).toBeNull();
  const fine = eventiDi(nuoviEventi(prima, s), 'fine_partita');
  expect(fine).toHaveLength(1);
  expect(fine[0]?.esito).toEqual(s.esito);
  expect(inAttesaDi(s)).toEqual({ sistema: false, giocatori: [] });
  expect(azioniPossibili(s, 'sistema')).toEqual([]);
  for (const g of s.giocatori) expect(azioniPossibili(s, g.id)).toEqual([]);
  const vista = vistaPer(s, null);
  expect(vista.esito).toEqual(s.esito);
  expect(vista.fase.nome).toBe('fine_partita');
  const azioni: Azione[] = [
    { tipo: 'prosegui' },
    { tipo: 'scadenza' },
    ...s.giocatori.flatMap((g): Azione[] => [
      { tipo: 'passa', giocatore: g.id },
      { tipo: 'lanciaDado', giocatore: g.id },
      { tipo: 'concludiConsolazione', giocatore: g.id, scarta: null },
      ...g.mano.map((c): Azione => ({ tipo: 'scegliTrovata', giocatore: g.id, carte: [c] })),
    ]),
    ...altreAzioni,
  ];
  for (const azione of azioni) {
    expect(() => applica(s, azione), JSON.stringify(azione)).toThrow(ErroreRegola);
  }
}

// ─── angoloElimina ───────────────────────────────────────────────────────────

interface CasoAngolo {
  sigla: string;
  elimina: boolean;
  nota?: string;
}

const nomeCaso = (c: CasoAngolo): string =>
  `${leggibile(c.sigla)} ${c.elimina ? 'elimina' : 'non elimina'}${c.nota ? ` (${c.nota})` : ''}`;

describe('angoloElimina con le regole a 3–4 giocatori (brief 3 "Eliminazione"; specifica 8, D29)', () => {
  // Tutte le 20 combinazioni di 3 Guai tra Meteo, Predatori, Drammi e Tosatura.
  const treGuai: CasoAngolo[] = [
    { sigla: 'MMM', elimina: true, nota: 'tre uguali' },
    { sigla: 'PPP', elimina: true, nota: 'tre uguali' },
    { sigla: 'DDD', elimina: true, nota: 'tre uguali' },
    { sigla: 'MPD', elimina: true, nota: 'tre diversi' },
    { sigla: 'MMT', elimina: true, nota: 'tre uguali con la Tosatura' },
    { sigla: 'PPT', elimina: true, nota: 'tre uguali con la Tosatura' },
    { sigla: 'DDT', elimina: true, nota: 'tre uguali con la Tosatura' },
    { sigla: 'MPT', elimina: true, nota: 'tre diversi con la Tosatura' },
    { sigla: 'MDT', elimina: true, nota: 'tre diversi con la Tosatura' },
    { sigla: 'PDT', elimina: true, nota: 'tre diversi con la Tosatura' },
    { sigla: 'MTT', elimina: true, nota: 'due Tosature' },
    { sigla: 'PTT', elimina: true, nota: 'due Tosature' },
    { sigla: 'DTT', elimina: true, nota: 'due Tosature' },
    { sigla: 'TTT', elimina: true, nota: 'tre Tosature' },
    { sigla: 'MMP', elimina: false, nota: 'due uguali e uno diverso' },
    { sigla: 'MMD', elimina: false, nota: 'due uguali e uno diverso' },
    { sigla: 'PPM', elimina: false, nota: 'due uguali e uno diverso' },
    { sigla: 'PPD', elimina: false, nota: 'due uguali e uno diverso' },
    { sigla: 'DDM', elimina: false, nota: 'due uguali e uno diverso' },
    { sigla: 'DDP', elimina: false, nota: 'due uguali e uno diverso' },
  ];
  const altri: CasoAngolo[] = [
    { sigla: '', elimina: false },
    { sigla: 'M', elimina: false },
    { sigla: 'T', elimina: false },
    { sigla: 'MM', elimina: false },
    { sigla: 'MP', elimina: false },
    { sigla: 'TT', elimina: false, nota: 'due Tosature valgono due Guai, non tre' },
    { sigla: 'MMPP', elimina: false },
    { sigla: 'MMDD', elimina: false },
    { sigla: 'PPDD', elimina: false },
    { sigla: 'MMMM', elimina: true, nota: 'oltre la soglia' },
    { sigla: 'MMPPD', elimina: true, nota: 'tre tipi diversi tra cinque' },
    { sigla: 'MMPPT', elimina: true },
  ];

  for (const c of [...treGuai, ...altri]) {
    it(nomeCaso(c), () => {
      expect(angoloElimina(tipi(c.sigla), NORMALI)).toBe(c.elimina);
    });
  }

  it("l'ordine dei Guai nell'Angolo non conta", () => {
    for (const sigla of ['TMM', 'MTM', 'TPM', 'PMT', 'DTM', 'TTM']) {
      expect(angoloElimina(tipi(sigla), NORMALI), sigla).toBe(true);
    }
    for (const sigla of ['PMM', 'MPM', 'DMD', 'PMPM']) {
      expect(angoloElimina(tipi(sigla), NORMALI), sigla).toBe(false);
    }
  });
});

describe('angoloElimina con le regole a 2 giocatori (brief 3 "Variante a 2 giocatori"; specifica 8, D29)', () => {
  const casi: CasoAngolo[] = [
    { sigla: 'MMMM', elimina: true, nota: 'quattro uguali' },
    { sigla: 'PPPP', elimina: true, nota: 'quattro uguali' },
    { sigla: 'DDDD', elimina: true, nota: 'quattro uguali' },
    { sigla: 'MMMT', elimina: true, nota: 'quattro uguali con una Tosatura' },
    { sigla: 'PPTT', elimina: true, nota: 'quattro uguali con due Tosature' },
    { sigla: 'DTTT', elimina: true, nota: 'quattro uguali con tre Tosature' },
    { sigla: 'MMPPDD', elimina: true, nota: 'due per tipo' },
    { sigla: 'MMPPDT', elimina: true, nota: 'due per tipo con una Tosatura' },
    { sigla: 'MMPDTT', elimina: true, nota: 'due per tipo con due Tosature' },
    { sigla: 'MMPPDDD', elimina: true, nota: 'oltre la soglia' },
    { sigla: 'MPD', elimina: false, nota: 'tre diversi non bastano' },
    { sigla: 'MPDT', elimina: false, nota: 'tre diversi con la Tosatura non bastano' },
    { sigla: 'MMM', elimina: false, nota: 'tre uguali non bastano' },
    { sigla: 'MMT', elimina: false, nota: 'tre uguali con la Tosatura non bastano' },
    { sigla: 'TTT', elimina: false },
    { sigla: 'MMMP', elimina: false },
    { sigla: 'MMPPD', elimina: false, nota: 'manca un Drammi' },
    { sigla: 'MMPDT', elimina: false, nota: 'la Tosatura copre un solo mancante' },
    { sigla: 'MPTT', elimina: false },
    { sigla: 'MMMPPP', elimina: false, nota: 'sei Guai senza Drammi' },
  ];

  for (const c of casi) {
    it(nomeCaso(c), () => {
      expect(angoloElimina(tipi(c.sigla), DUE_GIOCATORI)).toBe(c.elimina);
    });
  }
});

describe('angoloElimina: ogni regola presa da sola (specifica 8)', () => {
  it('uguali k: esiste un tipo con c(t) + Tosature ≥ k', () => {
    const uguali3: RegolaEliminazione[] = [{ regola: 'uguali', quanti: 3 }];
    expect(angoloElimina(tipi('MMT'), uguali3)).toBe(true);
    expect(angoloElimina(tipi('TTT'), uguali3)).toBe(true);
    expect(angoloElimina(tipi('MPD'), uguali3)).toBe(false);
    expect(angoloElimina(tipi('MMPP'), uguali3)).toBe(false);
  });

  it('diversi k: tipi presenti + Tosature ≥ k', () => {
    const diversi3: RegolaEliminazione[] = [{ regola: 'diversi', quanti: 3 }];
    expect(angoloElimina(tipi('MPT'), diversi3)).toBe(true);
    expect(angoloElimina(tipi('MTT'), diversi3)).toBe(true);
    expect(angoloElimina(tipi('MMMM'), diversi3)).toBe(false);
    expect(angoloElimina(tipi('MMPP'), diversi3)).toBe(false);
  });

  it('perTipo k: le Tosature coprono tutti i mancanti a k per ogni tipo', () => {
    const perTipo2: RegolaEliminazione[] = [{ regola: 'perTipo', quanti: 2 }];
    expect(angoloElimina(tipi('MMPPDD'), perTipo2)).toBe(true);
    expect(angoloElimina(tipi('MPDTTT'), perTipo2)).toBe(true);
    expect(angoloElimina(tipi('MMMM'), perTipo2)).toBe(false);
    expect(angoloElimina(tipi('MPDTT'), perTipo2)).toBe(false);
  });

  it('nessuna regola: nessuna eliminazione', () => {
    expect(angoloElimina(tipi('MMMM'), [])).toBe(false);
  });
});

describe('regole di eliminazione nella configurazione (specifica 3, 8; setup.json)', () => {
  it('a 3 e 4 giocatori "uguali 3" o "diversi 3"; a 2 giocatori "uguali 4" o "perTipo 2"', () => {
    expect(configPer(3).regoleEliminazione).toEqual(NORMALI);
    expect(configPer(4).regoleEliminazione).toEqual(NORMALI);
    expect(configPer(2).regoleEliminazione).toEqual(DUE_GIOCATORI);
  });

  it('scenario copia le regole del numero di giocatori in stato.config', () => {
    expect(scenario({ giocatori: 3 }).config.regoleEliminazione).toEqual(NORMALI);
    expect(scenario({ giocatori: 4 }).config.regoleEliminazione).toEqual(NORMALI);
    expect(scenario({ giocatori: 2 }).config.regoleEliminazione).toEqual(DUE_GIOCATORI);
  });
});

// ─── tipiCheEliminano ────────────────────────────────────────────────────────

describe('tipiCheEliminano: tipi di Guaio che, aggiunti all\'Angolo, eliminerebbero (specifica 2, 8)', () => {
  /** L'ordine dei tipi restituiti non è specificato: si confrontano ordinati. */
  function aRischio(giocatori: number, sigla: string): TipoGuaioCarta[] {
    const s = scenario({ giocatori, angoli: { g1: nuoviGuai().angolo(sigla) } });
    expect(gioc(s, 'g1').angolo).toHaveLength(sigla.length);
    return ordinati(tipiCheEliminano(s, 'g1'));
  }

  const casi: Array<{ giocatori: number; sigla: string; attesi: TipoGuaioCarta[] }> = [
    { giocatori: 3, sigla: '', attesi: [] },
    { giocatori: 3, sigla: 'M', attesi: [] },
    { giocatori: 3, sigla: 'T', attesi: [] },
    { giocatori: 3, sigla: 'MM', attesi: ['meteo', 'tosatura'] },
    { giocatori: 3, sigla: 'MP', attesi: ['drammi', 'tosatura'] },
    { giocatori: 3, sigla: 'MT', attesi: TUTTI_I_TIPI },
    { giocatori: 3, sigla: 'TT', attesi: TUTTI_I_TIPI },
    { giocatori: 3, sigla: 'MMPP', attesi: TUTTI_I_TIPI },
    { giocatori: 4, sigla: 'DD', attesi: ['drammi', 'tosatura'] },
    { giocatori: 2, sigla: 'MM', attesi: [] },
    { giocatori: 2, sigla: 'MPD', attesi: [] },
    { giocatori: 2, sigla: 'MPT', attesi: [] },
    { giocatori: 2, sigla: 'MMM', attesi: ['meteo', 'tosatura'] },
    { giocatori: 2, sigla: 'MMT', attesi: ['meteo', 'tosatura'] },
    { giocatori: 2, sigla: 'MMPPD', attesi: ['drammi', 'tosatura'] },
    { giocatori: 2, sigla: 'MMPPT', attesi: TUTTI_I_TIPI },
  ];

  for (const c of casi) {
    it(`a ${c.giocatori} giocatori, ${leggibile(c.sigla)} → [${c.attesi.join(', ')}]`, () => {
      expect(aRischio(c.giocatori, c.sigla)).toEqual(ordinati(c.attesi));
    });
  }
});

// ─── Eliminazione nel flusso del round ───────────────────────────────────────

describe('eliminazione alla fine della consolazione, 3 giocatori (brief 3 punti 10–11; specifica 4.11, 8)', () => {
  const casi: Array<{ angolo: string; guaio: Lettera; elimina: boolean }> = [
    { angolo: 'MM', guaio: 'M', elimina: true },
    { angolo: 'PP', guaio: 'P', elimina: true },
    { angolo: 'DD', guaio: 'D', elimina: true },
    { angolo: 'MP', guaio: 'D', elimina: true },
    { angolo: 'MM', guaio: 'T', elimina: true },
    { angolo: 'MT', guaio: 'P', elimina: true },
    { angolo: 'MT', guaio: 'T', elimina: true },
    { angolo: 'TT', guaio: 'T', elimina: true },
    { angolo: 'M', guaio: 'M', elimina: false },
    { angolo: 'MM', guaio: 'P', elimina: false },
    { angolo: 'MMP', guaio: 'P', elimina: false },
    { angolo: 'PPD', guaio: 'D', elimina: false },
    { angolo: 'MMD', guaio: 'D', elimina: false },
  ];

  for (const c of casi) {
    it(`${leggibile(c.angolo + c.guaio)} (Guaio del round ${c.guaio}) ${c.elimina ? 'elimina' : 'non elimina'}`, () => {
      const g = nuoviGuai();
      let s = finoAllaConsolazione({ guaio: g.uno(c.guaio), angoli: { g3: g.angolo(c.angolo) } }, 'g1', 'g3');
      expect(gioc(s, 'g3').angolo).toHaveLength(c.angolo.length + 1);
      expect(gioc(s, 'g3').eliminato).toBe(false);
      const prima = s;
      s = concludi(s);
      expect(gioc(s, 'g3').eliminato).toBe(c.elimina);
      expect(eventiDi(nuoviEventi(prima, s), 'eliminato')).toHaveLength(c.elimina ? 1 : 0);
      expect(gioc(s, 'g3').angolo).toHaveLength(c.elimina ? 0 : c.angolo.length + 1);
      expect(s.esito).toBeNull();
      expect(s.fase.nome).toBe('fine_round');
    });
  }
});

describe("cosa succede all'eliminato (brief 3 \"Eliminazione\"; specifica 8, D28, D30)", () => {
  /** g3 (Sospirella) ha due Meteo e prende il terzo; mano di riserva: Coperta di lana e Pernacchia. */
  function eliminaG3(): { prima: Stato; dopo: Stato } {
    const g = nuoviGuai();
    const prima = finoAllaConsolazione(
      {
        guaio: g.uno('M'),
        angoli: { g3: g.angolo('MM') },
        mani: { g3: ['coperta-di-lana', 'pernacchia'] },
        mazzo: [
          'carriola',
          'carriola',
          'carriola',
          'balla-di-fieno',
          'balla-di-fieno',
          'coperta-di-lana',
          'coperta-di-lana',
          'corona-di-margherite',
          'corona-di-margherite',
          'ombrello-bucato',
          'ombrello-bucato',
        ],
      },
      'g1',
      'g3',
    );
    return { prima, dopo: concludi(prima) };
  }

  it('in consolazione il Guaio è già nell\'Angolo e l\'agnellino è arrivato, ma il controllo avviene solo alla conclusione (4.11, D30)', () => {
    const { prima } = eliminaG3();
    const g3 = gioc(prima, 'g3');
    expect(g3.angolo).toHaveLength(3);
    expect(g3.agnellini).toBe(4);
    expect(g3.eliminato).toBe(false);
    expect(prima.datiRound.presoDa).toBe('g3');
  });

  it('mano negli scarti, agnellini nel Gregge, Angolo in guaiFuoriGioco, evento eliminato (8, D28)', () => {
    const { prima, dopo } = eliminaG3();
    const mano = [...gioc(prima, 'g3').mano];
    const angolo = [...gioc(prima, 'g3').angolo];
    expect(mano).toHaveLength(2);
    expect(prima.guaiFuoriGioco).toEqual([]);

    const g3 = gioc(dopo, 'g3');
    expect(g3.eliminato).toBe(true);
    expect(g3.mano).toEqual([]);
    expect(g3.agnellini).toBe(0);
    expect(g3.angolo).toEqual([]);
    expect(dopo.gregge).toBe(prima.gregge + 4);
    expect(dopo.scarti).toEqual(expect.arrayContaining(mano));
    expect(ordinati(dopo.guaiFuoriGioco)).toEqual(ordinati(angolo));

    const eventi = nuoviEventi(prima, dopo);
    expect(eventiDi(eventi, 'eliminato')).toEqual([expect.objectContaining({ giocatore: 'g3' })]);
    expect(eventiDi(eventi, 'agnellini')).toContainEqual(expect.objectContaining({ da: 'g3', a: 'gregge', quanti: 4 }));

    // Restano in due: la partita continua.
    expect(dopo.esito).toBeNull();
    expect(dopo.fase.nome).toBe('fine_round');
    expect(gioc(dopo, 'g1').eliminato).toBe(false);
    expect(gioc(dopo, 'g2').eliminato).toBe(false);
  });

  it("l'eliminato non pesca a fine round, non partecipa più e non è più atteso nelle finestre (4.2, 4.5, 4.12)", () => {
    let s = eliminaG3().dopo;
    // Fine round: pescano solo i non eliminati, dal primo giocatore.
    expect(gioc(s, 'g1').mano).toHaveLength(5);
    expect(gioc(s, 'g2').mano).toHaveLength(5);
    expect(gioc(s, 'g3').mano).toEqual([]);

    s = prosegui(s);
    expect(s.round).toBe(2);
    fase(s, 'guaio');
    s = prosegui(s);
    expect(s.datiRound.partecipanti).toEqual(['g1', 'g2']);
    expect(ordinati(Object.keys(fase(s, 'scelta').scelte))).toEqual(['g1', 'g2']);

    s = finoAiBelatiDiPunteggio(s, { g1: ['carriola'], g2: ['coperta-di-lana'] });
    expect(ordinati(fase(s, 'belati_punteggio').inAttesa)).toEqual(['g1', 'g2']);
    expect(inAttesaDi(s).giocatori).not.toContain('g3');
    expect(azioniPossibili(s, 'g3')).toEqual([]);
    expect(() => applica(s, { tipo: 'passa', giocatore: 'g3' })).toThrow(ErroreRegola);
  });

  it('Visita di Garzina giocata in consolazione toglie un Guaio prima del controllo: niente eliminazione (D37)', () => {
    const g = nuoviGuai();
    let s = finoAllaConsolazione(
      { guaio: g.uno('D'), angoli: { g3: g.angolo('DD') }, mani: { g3: ['visita-di-garzina'] } },
      'g1',
      'g3',
    );
    expect(gioc(s, 'g3').angolo).toHaveLength(3);
    const curato = gioc(s, 'g3').angolo[0];
    if (curato === undefined) throw new Error('Angolo vuoto');
    s = nessunaReazione(
      applica(s, {
        tipo: 'giocaBelato',
        giocatore: 'g3',
        carta: carta(s, 'g3', 'visita-di-garzina'),
        guaio: curato,
      }),
    );
    expect(fase(s, 'consolazione').destinatario).toBe('g3');
    expect(gioc(s, 'g3').angolo).toHaveLength(2);
    expect(gioc(s, 'g3').angolo).not.toContain(curato);
    s = concludi(s);
    expect(gioc(s, 'g3').eliminato).toBe(false);
    expect(gioc(s, 'g3').angolo).toHaveLength(2);
    expect(s.fase.nome).toBe('fine_round');
  });

  it('il Guaio deviato con Finta svenuta elimina chi lo riceve (brief 8; 4.10, D26)', () => {
    const g = nuoviGuai();
    let s = prosegui(
      finoAlGuaio({ guaio: g.uno('P'), angoli: { g2: g.angolo('PP') }, mani: { g3: ['finta-svenuta'] } }, 'g1', 'g3'),
    );
    expect(fase(s, 'belati_salvataggio').destinatario).toBe('g3');
    s = nessunaReazione(
      applica(s, { tipo: 'giocaBelato', giocatore: 'g3', carta: carta(s, 'g3', 'finta-svenuta'), bersaglio: 'g2' }),
    );
    expect(fase(s, 'belati_salvataggio').destinatario).toBe('g2');
    s = applica(s, { tipo: 'passa', giocatore: 'g2' });
    expect(fase(s, 'consolazione').destinatario).toBe('g2');
    expect(s.datiRound.presoDa).toBe('g2');
    expect(gioc(s, 'g2').angolo).toHaveLength(3);
    expect(gioc(s, 'g3').angolo).toEqual([]);
    const prima = s;
    s = concludi(s);
    expect(gioc(s, 'g2').eliminato).toBe(true);
    expect(gioc(s, 'g3').eliminato).toBe(false);
    expect(eventiDi(nuoviEventi(prima, s), 'eliminato')).toEqual([expect.objectContaining({ giocatore: 'g2' })]);
    expect(s.fase.nome).toBe('fine_round');
  });
});

// ─── Ultima pecora ───────────────────────────────────────────────────────────

describe('vittoria per Ultima pecora (brief 3 "Come si vince" 2; specifica 8, 9.2)', () => {
  it('a 3 giocatori con uno già eliminato: eliminato il secondo, vince l\'ultimo rimasto', () => {
    const g = nuoviGuai();
    let s = finoAllaConsolazione(
      {
        eliminati: ['g2'],
        agnellini: { g2: 0 },
        guaio: g.uno('D'),
        angoli: { g3: g.angolo('MP') },
        mani: { g3: ['coperta-di-lana'] },
      },
      'g1',
      'g3',
    );
    expect(s.datiRound.partecipanti).toEqual(['g1', 'g3']);
    const prima = s;
    const gregge = s.gregge;
    s = concludi(s);
    verificaFinePartita(prima, s, 'ultima_pecora', ['g1']);
    // L'eliminazione è comunque completa, e precede la fine della partita.
    const g3 = gioc(s, 'g3');
    expect(g3.eliminato).toBe(true);
    expect(g3.mano).toEqual([]);
    expect(g3.agnellini).toBe(0);
    expect(g3.angolo).toEqual([]);
    expect(s.gregge).toBe(gregge + 4);
    expect(s.guaiFuoriGioco).toHaveLength(3);
    const eventi = nuoviEventi(prima, s);
    const eliminato = eventiDi(eventi, 'eliminato')[0];
    const fine = eventiDi(eventi, 'fine_partita')[0];
    expect(eliminato?.giocatore).toBe('g3');
    expect(eliminato!.seq).toBeLessThan(fine!.seq);
  });

  it('nell\'ultimo round l\'eliminazione chiude la partita per Ultima pecora, non per Mazzo finito (D35)', () => {
    const g = nuoviGuai();
    let s = finoAllaConsolazione(
      {
        round: 4,
        ultimoRound: 4,
        mazzo: [],
        eliminati: ['g2'],
        agnellini: { g2: 0 },
        guaio: g.uno('M'),
        angoli: { g3: g.angolo('MM') },
      },
      'g1',
      'g3',
    );
    const prima = s;
    s = concludi(s);
    verificaFinePartita(prima, s, 'ultima_pecora', ['g1']);
  });
});

// ─── Ovile pieno ─────────────────────────────────────────────────────────────

describe('vittoria per Ovile pieno, anche a metà round (brief 3 "Come si vince" 1; specifica 9.1, D19, D30, D35)', () => {
  it(`Agnellino smarrito con ${OVILE_3 - 1} agnellini su ${OVILE_3} durante gli effetti: la partita finisce subito, il resto della coda non si gioca`, () => {
    let s = finoAgliEffetti(
      {
        guaio: 'tosatura-a-sorpresa',
        agnellini: { g1: OVILE_3 - 1 },
        mani: { g1: ['agnellino-smarrito'], g2: ['pulizie-di-primavera', 'carriola'], g3: ['balla-di-fieno'] },
      },
      { g1: ['agnellino-smarrito'], g2: ['pulizie-di-primavera'], g3: ['balla-di-fieno'] },
    );
    const f = fase(s, 'effetti');
    expect(f.coda.map((v) => v.giocatore)).toEqual(['g1', 'g2']);
    const voce = voceCorrente(s);
    expect(voce.giocatore).toBe('g1');
    const pulizie = f.coda[1]!.carta;
    const gregge = s.gregge;

    const prima = s;
    s = applica(s, { tipo: 'attivaEffetto', giocatore: 'g1', carta: voce.carta });
    expect(s.finestra).not.toBeNull();
    s = nessunaReazione(s);

    expect(gioc(s, 'g1').agnellini).toBe(OVILE_3);
    expect(s.gregge).toBe(gregge - 1);
    verificaFinePartita(prima, s, 'ovile_pieno', ['g1'], [
      { tipo: 'attivaEffetto', giocatore: 'g2', carta: pulizie },
      { tipo: 'rinunciaEffetto', giocatore: 'g2', carta: pulizie },
    ]);
    // Nessuno lancia il dado né prende il Guaio.
    expect(s.datiRound.lanciatori).toEqual([]);
    expect(s.datiRound.presoDa).toBeNull();
  });

  it('due lanciatori pari: il primo (meno agnellini) riempie l\'Ovile e il secondo non lancia (D19)', () => {
    let s = finoAlDado(
      {
        guaio: 'tosatura-a-sorpresa',
        agnellini: { g1: OVILE_3 - 2, g2: OVILE_3 - 3 },
        mani: { g1: ['carriola'], g2: ['carriola'], g3: ['sasso-comodo'] },
      },
      { g1: ['carriola'], g2: ['carriola'], g3: ['sasso-comodo'] },
    );
    expect(s.datiRound.lanciatori).toEqual(['g2', 'g1']);
    expect(fase(s, 'dado').indice).toBe(0);
    const prima = s;
    s = lanciaTutti(s);
    expect(gioc(s, 'g2').agnellini).toBe(OVILE_3);
    expect(gioc(s, 'g1').agnellini).toBe(OVILE_3 - 2);
    expect(eventiDi(nuoviEventi(prima, s), 'dado_lanciato').map((e) => e.giocatore)).toEqual(['g2']);
    verificaFinePartita(prima, s, 'ovile_pieno', ['g2']);
  });

  it(`gli agnellini oltre i posti liberi non si prendono: con ${OVILE_3 - 2} il Pascolo grande ne dà 2 (brief "Il Dado del Pastore")`, () => {
    let s = finoAlDado(
      { guaio: 'tosatura-a-sorpresa', agnellini: { g1: OVILE_3 - 2 }, mani: { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['sasso-comodo'] } },
      { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['sasso-comodo'] },
    );
    const gregge = s.gregge;
    const prima = s;
    s = lanciaTutti(s, 'pascolo_grande');
    expect(gioc(s, 'g1').agnellini).toBe(OVILE_3);
    expect(s.gregge).toBe(gregge - 2);
    verificaFinePartita(prima, s, 'ovile_pieno', ['g1']);
  });

  it("l'agnellino di consolazione che riempie l'Ovile vince prima del controllo eliminazione (D30, D35)", () => {
    const g = nuoviGuai();
    let s = prosegui(finoAlGuaio({ guaio: g.uno('M'), angoli: { g3: g.angolo('MM') }, agnellini: { g3: OVILE_3 - 1 } }, 'g1', 'g3'));
    expect(fase(s, 'belati_salvataggio').destinatario).toBe('g3');
    const prima = s;
    s = applica(s, { tipo: 'passa', giocatore: 'g3' });
    const g3 = gioc(s, 'g3');
    expect(g3.angolo).toHaveLength(3);
    expect(g3.agnellini).toBe(OVILE_3);
    expect(g3.eliminato).toBe(false);
    expect(eventiDi(nuoviEventi(prima, s), 'eliminato')).toEqual([]);
    verificaFinePartita(prima, s, 'ovile_pieno', ['g3']);
  });

  // Nessuna azione del gioco dà agnellini a due giocatori insieme: il secondo Ovile pieno è costruito con scenario.
  it('due Ovili pieni dopo la stessa azione: vince solo l\'autore se è tra i pieni (brief 3 "Casi limite")', () => {
    let s = finoAgliEffetti(
      {
        guaio: 'tosatura-a-sorpresa',
        agnellini: { g1: OVILE_3 - 1, g2: OVILE_3 },
        mani: { g1: ['agnellino-smarrito'], g2: ['balla-di-fieno'], g3: ['sasso-comodo'] },
      },
      { g1: ['agnellino-smarrito'], g2: ['balla-di-fieno'], g3: ['sasso-comodo'] },
    );
    const voce = voceCorrente(s);
    expect(voce.giocatore).toBe('g1');
    const prima = s;
    s = nessunaReazione(applica(s, { tipo: 'attivaEffetto', giocatore: 'g1', carta: voce.carta }));
    expect(gioc(s, 'g1').agnellini).toBe(OVILE_3);
    expect(gioc(s, 'g2').agnellini).toBe(OVILE_3);
    verificaFinePartita(prima, s, 'ovile_pieno', ['g1']);
  });

  it('Ovili pieni dopo uno spostamento il cui autore non è pieno: vincono tutti i pieni (9.1)', () => {
    let s = finoAgliEffetti(
      {
        giocatori: 4,
        guaio: 'tosatura-a-sorpresa',
        agnellini: { g1: 12, g2: 12 },
        mani: { g1: ['balla-di-fieno'], g2: ['balla-di-fieno'], g3: ['campanaccio-stonato'], g4: ['balla-di-fieno'] },
      },
      { g1: ['balla-di-fieno'], g2: ['balla-di-fieno'], g3: ['campanaccio-stonato'], g4: ['balla-di-fieno'] },
    );
    const voce = voceCorrente(s);
    expect(voce.giocatore).toBe('g3');
    const prima = s;
    s = nessunaReazione(applica(s, { tipo: 'attivaEffetto', giocatore: 'g3', carta: voce.carta, bersaglio: 'g4' }));
    expect(gioc(s, 'g4').agnellini).toBe(2);
    verificaFinePartita(prima, s, 'ovile_pieno', ['g1', 'g2']);
  });
});

// ─── Mazzo finito e ultimo round ─────────────────────────────────────────────

describe('mazzo finito durante la pescata di fine round (brief 3 "Casi limite"; specifica 4.12, 9.3, D31, D33)', () => {
  /**
   * Round 1 a 3 giocatori: g1 Carriola, g2 Balla di fieno, g3 Sasso comodo (prende la Tosatura del round).
   * Ognuno tiene altre 3 Balle di fieno, quindi a fine round ciascuno deve pescare 2 carte.
   * Il mazzo Guai contiene solo Tosature: nei round seguenti nessun tratto.
   */
  function primoRound(mazzo: IdTipoCarta[], primoGiocatore: IdGiocatore = 'g1'): Stato {
    const riserva = copie('balla-di-fieno', 3);
    const s = finoAllaConsolazione(
      {
        guaio: 'tosatura-a-sorpresa',
        mazzoGuai: ['spuntatina', 'rasatura-integrale'],
        primoGiocatore,
        mazzo,
        mani: { g1: riserva, g2: riserva, g3: riserva },
      },
      'g1',
      'g3',
    );
    expect(s.ultimoRound).toBeNull();
    return concludi(s);
  }

  const MAZZO_CORTO: IdTipoCarta[] = ['corona-di-margherite', 'corona-di-margherite', 'ombrello-bucato'];

  it('il mazzo finisce a metà: chi non riesce a pescare resta con meno carte e ultimoRound = round + 1', () => {
    const s = primoRound(MAZZO_CORTO);
    fase(s, 'fine_round');
    expect(s.mazzo).toEqual([]);
    expect(gioc(s, 'g1').mano).toHaveLength(5);
    expect(gioc(s, 'g2').mano).toHaveLength(4);
    expect(gioc(s, 'g3').mano).toHaveLength(3);
    expect(s.ultimoRound).toBe(2);
    expect(s.esito).toBeNull();
    const eventi = s.eventi;
    expect(eventiDi(eventi, 'ultimo_round_annunciato')).toEqual([expect.objectContaining({ round: 2 })]);
    const pescate = eventiDi(eventi, 'pescate');
    expect(pescate).toContainEqual(expect.objectContaining({ giocatore: 'g1', quante: 2 }));
    expect(pescate).toContainEqual(expect.objectContaining({ giocatore: 'g2', quante: 1 }));
  });

  it('la pescata parte dal primo giocatore del round (D33): con g2 primo restano a corto g1 e g3', () => {
    const s = primoRound(MAZZO_CORTO, 'g2');
    expect(gioc(s, 'g2').mano).toHaveLength(5);
    expect(gioc(s, 'g3').mano).toHaveLength(4);
    expect(gioc(s, 'g1').mano).toHaveLength(3);
    expect(s.ultimoRound).toBe(2);
  });

  it('anche un mazzo che basta esattamente fa scattare l\'ultimo round, appena si pesca l\'ultima carta', () => {
    const s = primoRound(copie('corona-di-margherite', 6));
    expect(s.giocatori.map((g) => g.mano.length)).toEqual([5, 5, 5]);
    expect(s.mazzo).toEqual([]);
    expect(s.ultimoRound).toBe(2);
  });

  it('con una carta in avanzo l\'ultimo round non scatta', () => {
    const s = primoRound(copie('corona-di-margherite', 7));
    expect(s.mazzo).toHaveLength(1);
    expect(s.ultimoRound).toBeNull();
    expect(eventiDi(s.eventi, 'ultimo_round_annunciato')).toEqual([]);
  });

  it('prosegui ⇒ fase ultimo_round (automatica, Guaio coperto) ⇒ prosegui ⇒ guaio; alla fine del round vince chi ha più agnellini', () => {
    let s = primoRound(MAZZO_CORTO);
    // Dopo il round 1: g1 6 agnellini (Pascolo piccolo), g2 3, g3 4 (consolazione).
    expect(s.giocatori.map((g) => g.agnellini)).toEqual([6, 3, 4]);

    let prima = s;
    s = prosegui(s);
    fase(s, 'ultimo_round');
    expect(s.round).toBe(2);
    expect(s.primoGiocatore).toBe('g2');
    expect(s.datiRound.guaio).toBeNull();
    expect(eventiDi(nuoviEventi(prima, s), 'round_iniziato')).toEqual([
      expect.objectContaining({ round: 2, ultimo: true }),
    ]);
    expect(eventiDi(nuoviEventi(prima, s), 'guaio_rivelato')).toEqual([]);
    expect(eFaseAutomatica('ultimo_round')).toBe(true);
    expect(inAttesaDi(s)).toEqual({ sistema: true, giocatori: [] });
    expect(azioniPossibili(s, 'sistema')).toContainEqual({ tipo: 'prosegui' });
    expect(azioniPossibili(s, 'g1')).toEqual([]);
    expect(() =>
      applica(s, { tipo: 'scegliTrovata', giocatore: 'g1', carte: [carta(s, 'g1', 'balla-di-fieno')] }),
    ).toThrow(ErroreRegola);

    prima = s;
    s = prosegui(s);
    fase(s, 'guaio');
    expect(s.datiRound.guaio).not.toBeNull();
    expect(tipoDi(s.datiRound.guaio!)).toBe('spuntatina');
    expect(eventiDi(nuoviEventi(prima, s), 'guaio_rivelato')).toHaveLength(1);

    // Ultimo round: tutti pari, nessuno lancia; a fine round la partita finisce.
    s = prosegui(s);
    expect(s.datiRound.partecipanti).toEqual(['g1', 'g2', 'g3']);
    s = prosegui(scegli(s, { g1: ['balla-di-fieno'], g2: ['balla-di-fieno'], g3: ['balla-di-fieno'] }));
    s = chiudiPunteggio(s);
    expect(fase(s, 'guaio_al_peggiore')).toMatchObject({ destinatario: null, spareggio: null });
    prima = s;
    s = avanza(s);
    verificaFinePartita(prima, s, 'mazzo_finito', ['g1']);
    expect(s.mazzo).toEqual([]);
  });
});

describe('mazzo finito in altri momenti (specifica 9.3, D17, D31, D32)', () => {
  it("una ripescata che esaurisce il mazzo annuncia l'ultimo round: il round in corso si completa e se ne gioca un altro", () => {
    let s = scenario({
      guaio: 'tosatura-a-sorpresa',
      mani: { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['pernacchia'] },
      mazzo: ['sasso-comodo', 'coperta-di-lana'],
    });
    let prima = s;
    s = prosegui(s);
    let eventi = nuoviEventi(prima, s);
    expect(eventiDi(eventi, 'ripescata')).toEqual([
      expect.objectContaining({ giocatore: 'g3', scartate: 1, pescate: 2 }),
    ]);
    expect(eventiDi(eventi, 'ultimo_round_annunciato')).toEqual([expect.objectContaining({ round: 2 })]);
    expect(s.ultimoRound).toBe(2);
    expect(s.mazzo).toEqual([]);
    expect(s.datiRound.partecipanti).toEqual(['g1', 'g2', 'g3']);

    // Il round 1 si gioca per intero: g1 lancia (+3), g3 prende il Guaio (+1).
    s = chiudiDaScelta(s, { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['sasso-comodo'] });
    s = prosegui(lanciaTutti(s));
    s = concludi(applica(s, { tipo: 'passa', giocatore: 'g3' }));
    fase(s, 'fine_round');
    expect(s.esito).toBeNull();
    expect(s.ultimoRound).toBe(2);

    s = prosegui(s);
    fase(s, 'ultimo_round');
    s = prosegui(s);
    fase(s, 'guaio');

    // Round 2: g1 e g2 hanno la mano vuota e il mazzo è finito ⇒ fuori dal round; g3 gioca da solo e lancia (D23).
    prima = s;
    s = prosegui(s);
    eventi = nuoviEventi(prima, s);
    expect(ordinati(eventiDi(eventi, 'fuori_dal_round').map((e) => e.giocatore))).toEqual(['g1', 'g2']);
    expect(eventiDi(eventi, 'ripescata')).toEqual([]);
    expect(s.datiRound.partecipanti).toEqual(['g3']);
    s = chiudiDaScelta(s, { g3: ['coperta-di-lana'] });
    fase(s, 'dado');
    expect(s.datiRound.lanciatori).toEqual(['g3']);
    expect(s.datiRound.piuBassi).toEqual([]);
    s = lanciaTutti(s);
    expect(fase(s, 'guaio_al_peggiore')).toMatchObject({ destinatario: null, spareggio: null });
    prima = s;
    s = avanza(s);
    expect(s.giocatori.map((g) => g.agnellini)).toEqual([6, 3, 7]);
    verificaFinePartita(prima, s, 'mazzo_finito', ['g3']);
  });

  it("il Cannocchiale che prende le ultime 2 carte annuncia l'ultimo round (D17)", () => {
    let s = finoAgliEffetti(
      {
        guaio: 'tosatura-a-sorpresa',
        mani: { g1: ['cannocchiale'], g2: ['balla-di-fieno'], g3: ['sasso-comodo'] },
        mazzo: ['carriola', 'coperta-di-lana'],
      },
      { g1: ['cannocchiale'], g2: ['balla-di-fieno'], g3: ['sasso-comodo'] },
    );
    const voce = voceCorrente(s);
    expect(voce.effetto).toBe('guarda_due');
    const prima = s;
    s = nessunaReazione(applica(s, { tipo: 'attivaEffetto', giocatore: 'g1', carta: voce.carta }));
    const richiesta = s.richiesta;
    if (richiesta?.tipo !== 'guarda_due') throw new Error('richiesta guarda_due attesa');
    expect(richiesta.carte).toHaveLength(2);
    s = applica(s, { tipo: 'completaEffetto', giocatore: 'g1', carte: [richiesta.carte[0]!] });
    expect(s.mazzo).toEqual([]);
    expect(s.ultimoRound).toBe(2);
    expect(eventiDi(nuoviEventi(prima, s), 'ultimo_round_annunciato')).toEqual([
      expect.objectContaining({ round: 2 }),
    ]);
  });
});

describe("chi vince a mazzo finito (brief 3 \"Come si vince\" 3; specifica 9.3, D35)", () => {
  /** Round 4 di 4 con il mazzo vuoto: tutti i non eliminati giocano Balla di fieno, sono pari e nessuno lancia. */
  function ultimoRoundPari(o: OpzioniScenario): { prima: Stato; dopo: Stato } {
    const eliminati = o.eliminati ?? [];
    const attivi = idGiocatori(o).filter((id) => !eliminati.includes(id));
    const mani: Scelte = Object.fromEntries(attivi.map((id) => [id, ['balla-di-fieno']]));
    let s = scenario({ round: 4, ultimoRound: 4, mazzo: [], guaio: 'tosatura-a-sorpresa', mani, ...o });
    s = prosegui(s);
    fase(s, 'scelta');
    s = prosegui(scegli(s, mani));
    s = chiudiPunteggio(s);
    expect(fase(s, 'guaio_al_peggiore')).toMatchObject({ destinatario: null, spareggio: null });
    return { prima: s, dopo: avanza(s) };
  }

  it('vince il non eliminato con più agnellini', () => {
    const { prima, dopo } = ultimoRoundPari({ agnellini: { g1: 5, g2: 7, g3: 6 } });
    verificaFinePartita(prima, dopo, 'mazzo_finito', ['g2']);
    // fine_round: prima di chiudere, le carte del tavolo vanno negli scarti (4.12).
    expect(dopo.scarti.filter((c) => tipoDi(c) === 'balla-di-fieno')).toHaveLength(3);
  });

  it('a parità di agnellini vince chi ha meno Guai nell\'Angolo', () => {
    const g = nuoviGuai();
    const { prima, dopo } = ultimoRoundPari({
      agnellini: { g1: 7, g2: 7, g3: 6 },
      angoli: { g1: g.angolo('MP'), g2: g.angolo('D'), g3: [] },
    });
    verificaFinePartita(prima, dopo, 'mazzo_finito', ['g2']);
  });

  it('a ulteriore parità la vittoria è condivisa', () => {
    const g = nuoviGuai();
    const { prima, dopo } = ultimoRoundPari({
      agnellini: { g1: 7, g2: 7, g3: 5 },
      angoli: { g1: g.angolo('M'), g2: g.angolo('P'), g3: [] },
    });
    verificaFinePartita(prima, dopo, 'mazzo_finito', ['g1', 'g2']);
  });

  it('gli eliminati non contano, nemmeno per lo spareggio sui Guai (D35)', () => {
    const g = nuoviGuai();
    // g3 eliminato: 0 agnellini come gli altri e Angolo vuoto; se contasse vincerebbe lui da solo.
    const { prima, dopo } = ultimoRoundPari({
      eliminati: ['g3'],
      agnellini: { g1: 0, g2: 0, g3: 0 },
      angoli: { g1: g.angolo('M'), g2: g.angolo('P'), g3: [] },
    });
    verificaFinePartita(prima, dopo, 'mazzo_finito', ['g1', 'g2']);
  });

  it('chi non ha Trovate nell\'ultimo round non gioca: non vince il round né prende il Guaio, ma conta nella classifica (D32, D34)', () => {
    let s = scenario({
      round: 4,
      ultimoRound: 4,
      mazzo: [],
      guaio: 'tosatura-a-sorpresa',
      agnellini: { g3: 8 },
      mani: { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['faccio-finta-di-niente'] },
    });
    let prima = s;
    s = prosegui(s);
    const eventi = nuoviEventi(prima, s);
    expect(eventiDi(eventi, 'fuori_dal_round')).toEqual([expect.objectContaining({ giocatore: 'g3' })]);
    expect(eventiDi(eventi, 'ripescata')).toEqual([]);
    expect(gioc(s, 'g3').mano).toHaveLength(1);
    expect(s.datiRound.partecipanti).toEqual(['g1', 'g2']);
    expect(ordinati(Object.keys(fase(s, 'scelta').scelte))).toEqual(['g1', 'g2']);
    expect(() =>
      applica(s, { tipo: 'scegliTrovata', giocatore: 'g3', carte: [carta(s, 'g3', 'faccio-finta-di-niente')] }),
    ).toThrow(ErroreRegola);

    s = prosegui(scegli(s, { g1: ['carriola'], g2: ['balla-di-fieno'] }));
    s = chiudiPunteggio(s);
    expect(s.datiRound.piuAlti).toEqual(['g1']);
    expect(s.datiRound.piuBassi).toEqual(['g2']);
    expect(s.datiRound.lanciatori).toEqual(['g1']);
    expect(s.datiRound.punteggi['g3'] ?? []).toEqual([]);

    s = prosegui(lanciaTutti(s));
    expect(fase(s, 'belati_salvataggio').destinatario).toBe('g2');
    s = applica(s, { tipo: 'passa', giocatore: 'g2' });
    expect(s.datiRound.presoDa).toBe('g2');
    expect(gioc(s, 'g3').angolo).toEqual([]);

    prima = s;
    s = concludi(s);
    // g1 6 (Pascolo piccolo), g2 4 (consolazione), g3 8: vince g3, che non ha giocato.
    expect(s.giocatori.map((g) => g.agnellini)).toEqual([6, 4, 8]);
    verificaFinePartita(prima, s, 'mazzo_finito', ['g3']);
  });
});

// ─── Rotazione del primo giocatore ───────────────────────────────────────────

describe('rotazione del primo giocatore (specifica 4.1, D33)', () => {
  it('a ogni round il primo giocatore passa al successivo in ordine di posto, ricominciando dal primo', () => {
    const mani: Scelte = { g1: copie('trifoglio-qualunque', 5), g2: copie('trifoglio-qualunque', 5), g3: copie('trifoglio-qualunque', 5) };
    let s = scenario({
      guaio: 'tosatura-a-sorpresa',
      mazzoGuai: ['spuntatina', 'rasatura-integrale'],
      mani,
      mazzo: copie('trifoglio-qualunque', 12),
    });
    expect(s.primoGiocatore).toBe('g1');
    for (const [round, atteso] of [
      [2, 'g2'],
      [3, 'g3'],
      [4, 'g1'],
    ] as const) {
      s = roundPari(s, 'trifoglio-qualunque');
      const prima = s;
      s = prosegui(s);
      expect(s.round).toBe(round);
      expect(s.primoGiocatore).toBe(atteso);
      fase(s, 'guaio');
      expect(eventiDi(nuoviEventi(prima, s), 'round_iniziato')).toEqual([
        expect.objectContaining({ round, ultimo: false }),
      ]);
    }
  });

  const casi: Array<{ eliminati: IdGiocatore[]; primo: IdGiocatore; atteso: IdGiocatore }> = [
    { eliminati: [], primo: 'g4', atteso: 'g1' },
    { eliminati: ['g2'], primo: 'g1', atteso: 'g3' },
    { eliminati: ['g1'], primo: 'g4', atteso: 'g2' },
    { eliminati: ['g3', 'g4'], primo: 'g2', atteso: 'g1' },
  ];
  for (const c of casi) {
    it(`a 4 giocatori, eliminati [${c.eliminati.join(', ')}]: da ${c.primo} a ${c.atteso}`, () => {
      const attivi = ['g1', 'g2', 'g3', 'g4'].filter((id) => !c.eliminati.includes(id));
      let s = scenario({
        giocatori: 4,
        guaio: 'tosatura-a-sorpresa',
        mazzoGuai: ['spuntatina'],
        eliminati: c.eliminati,
        agnellini: Object.fromEntries(c.eliminati.map((id) => [id, 0])),
        primoGiocatore: c.primo,
        mani: Object.fromEntries(attivi.map((id) => [id, ['trifoglio-qualunque']])),
      });
      expect(s.primoGiocatore).toBe(c.primo);
      s = prosegui(roundPari(s, 'trifoglio-qualunque'));
      expect(s.round).toBe(2);
      expect(s.primoGiocatore).toBe(c.atteso);
    });
  }

  it('se il primo giocatore viene eliminato nel round, il successivo apre il round seguente', () => {
    const g = nuoviGuai();
    let s = finoAllaConsolazione({ guaio: g.uno('P'), angoli: { g1: g.angolo('PP') } }, 'g2', 'g1');
    expect(s.primoGiocatore).toBe('g1');
    s = concludi(s);
    expect(gioc(s, 'g1').eliminato).toBe(true);
    expect(gioc(s, 'g1').mano).toEqual([]);
    s = prosegui(s);
    expect(s.primoGiocatore).toBe('g2');
  });

  it('se viene eliminato il successivo del primo giocatore, il round seguente lo salta', () => {
    const g = nuoviGuai();
    let s = finoAllaConsolazione({ guaio: g.uno('M'), angoli: { g2: g.angolo('MM') } }, 'g1', 'g2');
    s = concludi(s);
    expect(gioc(s, 'g2').eliminato).toBe(true);
    s = prosegui(s);
    expect(s.primoGiocatore).toBe('g3');
  });
});

// ─── Variante a 2 giocatori ──────────────────────────────────────────────────

describe('variante a 2 giocatori (brief 3 "Variante a 2 giocatori"; specifica 3, 8, D36)', () => {
  /** Round con Guaio Tosatura in cui `alto` lancia il Pascolo piccolo; si ferma al Guaio o alla fine della partita. */
  function finoAlGuaioOFine(o: OpzioniScenario, alto: IdGiocatore, basso: IdGiocatore): Stato {
    const { opzioni, scelte } = conRound({ guaio: 'tosatura-a-sorpresa', ...o }, alto, basso);
    return lanciaTutti(finoAlDado(opzioni, scelte));
  }

  it('nuovaPartita a 2: Ovile da 18, 36 agnellini, mazzo di 50 carte senza Trovate da 1, 2, 3', () => {
    const s = nuovaPartita({
      giocatori: [
        { id: 'a', nome: 'Anna', pecora: 'ricciolo' },
        { id: 'b', nome: 'Bruno', pecora: 'nerina' },
      ],
      seme: 7,
    });
    expect(s.config.postiOvile).toBe(18);
    expect(s.config.agnelliniTotali).toBe(36);
    expect(s.config.regoleEliminazione).toEqual(DUE_GIOCATORI);
    expect(s.gregge).toBe(30);
    expect(s.giocatori.map((g) => g.agnellini)).toEqual([3, 3]);
    const carte = [...s.mazzo, ...s.giocatori.flatMap((g) => g.mano)];
    expect(carte).toHaveLength(50);
    expect(creaMazzoPrincipale(2)).toHaveLength(50);
    expect(creaMazzoPrincipale(3)).toHaveLength(62);
    const basse = carte.filter((c) => {
      const d = defCarta(c);
      return d.famiglia === 'trovata' && d.valore >= 1 && d.valore <= 3;
    });
    expect(basse).toEqual([]);
  });

  it("a 3 giocatori, invece, 15 agnellini riempiono l'Ovile", () => {
    const s = finoAlGuaioOFine({ agnellini: { g1: 12 } }, 'g1', 'g3');
    expect(s.config.postiOvile).toBe(15);
    expect(gioc(s, 'g1').agnellini).toBe(15);
    expect(s.esito).toEqual({ modo: 'ovile_pieno', vincitori: ['g1'] });
  });

  it('a 2 giocatori 15 agnellini non bastano: la partita continua', () => {
    const s = finoAlGuaioOFine({ giocatori: 2, agnellini: { g1: 12 } }, 'g1', 'g2');
    expect(s.config.postiOvile).toBe(18);
    expect(gioc(s, 'g1').agnellini).toBe(15);
    expect(s.esito).toBeNull();
    expect(fase(s, 'guaio_al_peggiore').destinatario).toBe('g2');
  });

  it(`a 2 giocatori vince chi arriva a ${OVILE_2}; il Pascolo grande con ${OVILE_2 - 2} ne dà solo 2`, () => {
    const { opzioni, scelte } = conRound({ giocatori: 2, guaio: 'tosatura-a-sorpresa', agnellini: { g1: OVILE_2 - 2 } }, 'g1', 'g2');
    const s = finoAlDado(opzioni, scelte);
    const gregge = s.gregge;
    const dopo = lanciaTutti(s, 'pascolo_grande');
    expect(gioc(dopo, 'g1').agnellini).toBe(OVILE_2);
    expect(dopo.gregge).toBe(gregge - 2);
    verificaFinePartita(s, dopo, 'ovile_pieno', ['g1']);
  });

  const casi: Array<{ angolo: string; guaio: Lettera; elimina: boolean; nota: string }> = [
    { angolo: 'MMM', guaio: 'M', elimina: true, nota: 'quattro uguali' },
    { angolo: 'MMT', guaio: 'M', elimina: true, nota: 'quattro uguali con la Tosatura' },
    { angolo: 'MMT', guaio: 'T', elimina: true, nota: 'quattro uguali con due Tosature' },
    { angolo: 'MMPPD', guaio: 'D', elimina: true, nota: 'due per tipo' },
    { angolo: 'MMPPT', guaio: 'D', elimina: true, nota: 'due per tipo con la Tosatura' },
    { angolo: 'MM', guaio: 'M', elimina: false, nota: 'tre uguali non bastano' },
    { angolo: 'MMM', guaio: 'P', elimina: false, nota: 'tre uguali e uno diverso' },
    { angolo: 'MP', guaio: 'D', elimina: false, nota: 'tre diversi non eliminano' },
    { angolo: 'MPT', guaio: 'D', elimina: false, nota: 'tre diversi con la Tosatura non eliminano' },
    { angolo: 'MMPT', guaio: 'D', elimina: false, nota: 'la Tosatura copre un solo mancante' },
  ];
  for (const c of casi) {
    it(`${leggibile(c.angolo + c.guaio)} ${c.elimina ? 'elimina e l\'altro vince per Ultima pecora' : 'non elimina'} (${c.nota})`, () => {
      const g = nuoviGuai();
      let s = finoAllaConsolazione(
        { giocatori: 2, guaio: g.uno(c.guaio), angoli: { g2: g.angolo(c.angolo) }, mani: { g2: ['coperta-di-lana'] } },
        'g1',
        'g2',
      );
      const prima = s;
      s = concludi(s);
      expect(gioc(s, 'g2').eliminato).toBe(c.elimina);
      if (c.elimina) {
        expect(gioc(s, 'g2').agnellini).toBe(0);
        expect(gioc(s, 'g2').mano).toEqual([]);
        expect(s.guaiFuoriGioco).toHaveLength(c.angolo.length + 1);
        verificaFinePartita(prima, s, 'ultima_pecora', ['g1']);
      } else {
        expect(s.esito).toBeNull();
        expect(s.fase.nome).toBe('fine_round');
      }
    });
  }
});
