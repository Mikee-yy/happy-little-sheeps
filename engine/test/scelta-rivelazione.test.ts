// Scelta segreta, ripescata, Trovate Gemelle, rivelazione e tratti delle pecore.
// Regole: brief sezione 2 ("Le quattro pecore") e sezione 3 ("Svolgimento di un round", punti 1–5);
// specifica docs/motore.md sezioni 4.2–4.4, 4.6, 9.3, 10, 11 e decisioni D9, D18, D23, D31–D34, D40.
import { describe, expect, it } from 'vitest';
import { applica, azioniPossibili, ErroreRegola, inAttesaDi, punteggioTotale, vistaPer } from '../src';
import type {
  Azione,
  Evento,
  IdCarta,
  IdGiocatore,
  IdPecora,
  RigaPunteggio,
  Stato,
  TipoGuaio,
  TipoRiga,
} from '../src';
import { prosegui, scegli, scenario, totale } from './aiuti';
import type { OpzioniScenario } from './aiuti';
import setup from '../data/setup.json';

// ─── Aiuti locali ────────────────────────────────────────────────────────────

type TipoEvento = Evento['tipo'];
type EventoDi<T extends TipoEvento> = Extract<Evento, { tipo: T }>;
type AzioneScelta = Extract<Azione, { tipo: 'scegliTrovata' }>;

/** Eventi di tipo `tipo` prodotti passando da `prima` a `dopo`. */
function eventiNuovi<T extends TipoEvento>(prima: Stato, dopo: Stato, tipo: T): EventoDi<T>[] {
  return dopo.eventi.filter((e): e is EventoDi<T> => e.tipo === tipo && e.seq >= prima.prossimoEvento);
}

function scelteDi(s: Stato): Record<IdGiocatore, IdCarta[] | null> {
  if (s.fase.nome !== 'scelta') throw new Error(`fase attesa 'scelta', trovata '${s.fase.nome}'`);
  return s.fase.scelte;
}

function mano(s: Stato, g: IdGiocatore): IdCarta[] {
  const giocatore = s.giocatori.find((x) => x.id === g);
  if (!giocatore) throw new Error(`giocatore ${g} inesistente`);
  return giocatore.mano;
}

function righe(s: Stato, g: IdGiocatore, tipo?: TipoRiga): RigaPunteggio[] {
  const tutte = s.datiRound.punteggi[g] ?? [];
  return tipo ? tutte.filter((r) => r.tipo === tipo) : tutte;
}

const ordinate = (carte: readonly string[]): string[] => [...carte].sort();
const tipoLocale = (c: IdCarta): string => c.split('#')[0] ?? c;

function scegliTrovata(s: Stato, giocatore: IdGiocatore, carte: IdCarta[]): Stato {
  return applica(s, { tipo: 'scegliTrovata', giocatore, carte });
}

/** L'azione è rifiutata con ErroreRegola e lo stato di partenza resta intatto (specifica 1). */
function verificaRifiuto(s: Stato, azione: Azione): void {
  const copia = structuredClone(s);
  expect(() => applica(s, azione)).toThrow(ErroreRegola);
  expect(s).toEqual(copia);
}

/** Scenario portato in fase 'scelta' (la ripescata avviene entrando). */
function inScelta(o: OpzioniScenario): Stato {
  const s = prosegui(scenario(o));
  expect(s.fase.nome).toBe('scelta');
  return s;
}

// Un Guaio per ciascun tipo con tratti (cards.json).
const GUAIO_DEL_TIPO: Record<TipoGuaio, IdCarta> = {
  meteo: 'nebbia-fitta#1',
  predatori: 'volpe-gentile#1',
  drammi: 'insonnia#1',
};
const TIPI_GUAIO: TipoGuaio[] = ['meteo', 'predatori', 'drammi'];
const TOSATURE: IdCarta[] = ['tosatura-a-sorpresa#1', 'spuntatina#1', 'rasatura-integrale#1'];

// Le quattro pecore di setup.json, una per posto (g1…g4).
const GIOCATORI_TUTTE_LE_PECORE = setup.pecore.map((p, i) => ({ id: `g${i + 1}`, pecora: p.id as IdPecora }));

const CASI_TRATTO = setup.pecore.flatMap((p, i) =>
  TIPI_GUAIO.map((tipo) => {
    const atteso = p.bonus === tipo ? 1 : p.malus === tipo ? -1 : 0;
    return {
      pecora: p.id,
      giocatore: `g${i + 1}`,
      tipo,
      atteso,
      descrizione: atteso === 0 ? 'nessuna riga tratto' : `riga tratto ${atteso > 0 ? '+1' : '−1'}`,
    };
  }),
);

/** Quattro giocatori, una pecora ciascuno, tutti giocano una Carriola (8, senza effetto). */
function quattroCarriole(guaio: IdCarta | null): Stato {
  const s = inScelta({
    giocatori: GIOCATORI_TUTTE_LE_PECORE,
    guaio,
    mani: {
      g1: ['carriola#1'],
      g2: ['carriola#2'],
      g3: ['carriola#3'],
      g4: ['carriola#4'],
    },
  });
  const r = scegli(s, { g1: ['carriola#1'], g2: ['carriola#2'], g3: ['carriola#3'], g4: ['carriola#4'] });
  expect(r.fase.nome).toBe('rivelazione');
  return r;
}

// ─── Guaio → scelta ──────────────────────────────────────────────────────────

describe('Fase guaio → prosegui → scelta (brief 3, round punti 1–2; specifica 4.1–4.2)', () => {
  const mani = {
    g1: ['beee-no#1', 'sasso-comodo#1'],
    g2: ['carriola#1'],
    g3: ['balla-di-fieno#1', 'pernacchia#1'],
  };

  it('dopo scenario() la fase è guaio, si aspetta solo il sistema e scegliTrovata è rifiutata', () => {
    const s = scenario({ mani, guaio: 'insonnia#1' });
    expect(s.fase).toEqual({ nome: 'guaio' });
    expect(inAttesaDi(s)).toEqual({ sistema: true, giocatori: [] });
    verificaRifiuto(s, { tipo: 'scegliTrovata', giocatore: 'g2', carte: ['carriola#1'] });
  });

  it('prosegui entra in scelta: partecipanti in ordine di posto, scelte tutte null, nessuna ripescata', () => {
    const prima = scenario({ mani, mazzo: ['coperta-di-lana#1', 'carriola#2'] });
    const s = prosegui(prima);
    expect(s.fase).toEqual({ nome: 'scelta', scelte: { g1: null, g2: null, g3: null } });
    expect(s.datiRound.partecipanti).toEqual(['g1', 'g2', 'g3']);
    // chi ha almeno una Trovata (anche insieme a Belati) partecipa e tiene la mano
    expect(mano(s, 'g1')).toEqual(['beee-no#1', 'sasso-comodo#1']);
    expect(mano(s, 'g3')).toEqual(['balla-di-fieno#1', 'pernacchia#1']);
    expect(s.mazzo).toEqual(['coperta-di-lana#1', 'carriola#2']);
    expect(eventiNuovi(prima, s, 'ripescata')).toEqual([]);
    expect(eventiNuovi(prima, s, 'fuori_dal_round')).toEqual([]);
    const attesa = inAttesaDi(s);
    expect(attesa.sistema).toBe(false);
    expect(ordinate(attesa.giocatori)).toEqual(['g1', 'g2', 'g3']);
  });

  it('i partecipanti restano in ordine di posto anche se il primo giocatore è un altro (4.2, D33)', () => {
    const s = inScelta({ mani, primoGiocatore: 'g3' });
    expect(s.datiRound.partecipanti).toEqual(['g1', 'g2', 'g3']);
  });

  it('gli eliminati non partecipano e non ripescano', () => {
    const prima = scenario({
      eliminati: ['g2'],
      mani: { g1: ['carriola#1'], g3: ['balla-di-fieno#1'] },
      mazzo: ['carriola#3', 'carriola#4'],
    });
    const s = prosegui(prima);
    expect(s.datiRound.partecipanti).toEqual(['g1', 'g3']);
    expect(scelteDi(s)).toEqual({ g1: null, g3: null });
    expect(s.mazzo).toEqual(['carriola#3', 'carriola#4']);
    expect(eventiNuovi(prima, s, 'ripescata')).toEqual([]);
    expect(ordinate(inAttesaDi(s).giocatori)).toEqual(['g1', 'g3']);
  });

  it('in scelta prosegui è rifiutato e il sistema non ha prosegui tra le azioni possibili', () => {
    const s = inScelta({ mani });
    verificaRifiuto(s, { tipo: 'prosegui' });
    expect(azioniPossibili(s, 'sistema').some((a) => a.tipo === 'prosegui')).toBe(false);
  });
});

// ─── Ripescata ───────────────────────────────────────────────────────────────

describe('Ripescata (brief 3 punto 2; specifica 4.2, D32, D33)', () => {
  it('chi ha solo Belati scarta tutta la mano e pesca 5 carte; lo stato di partenza non cambia', () => {
    const prima = scenario({
      mani: {
        g1: ['beee-no#1', 'pernacchia#1', 'mondo-alla-rovescia#1'],
        g2: ['carriola#1', 'beee-no#2'],
        g3: ['balla-di-fieno#1'],
      },
      mazzo: [
        'coperta-di-lana#1',
        'belato-di-gruppo#1',
        'sasso-comodo#1',
        'pernacchia#2',
        'carriola#2',
        'carriola#3',
        'carriola#4',
      ],
    });
    const copia = structuredClone(prima);
    const s = prosegui(prima);
    expect(prima).toEqual(copia);

    expect(ordinate(mano(s, 'g1'))).toEqual(
      ordinate(['coperta-di-lana#1', 'belato-di-gruppo#1', 'sasso-comodo#1', 'pernacchia#2', 'carriola#2']),
    );
    expect(s.mazzo).toEqual(['carriola#3', 'carriola#4']);
    expect(ordinate(s.scarti)).toEqual(ordinate(['beee-no#1', 'pernacchia#1', 'mondo-alla-rovescia#1']));
    expect(eventiNuovi(prima, s, 'ripescata')).toMatchObject([{ giocatore: 'g1', scartate: 3, pescate: 5 }]);
    // la mano mista di g2 non viene toccata
    expect(mano(s, 'g2')).toEqual(['carriola#1', 'beee-no#2']);
    expect(s.datiRound.partecipanti).toEqual(['g1', 'g2', 'g3']);
    expect(s.ultimoRound).toBeNull();
    expect(eventiNuovi(prima, s, 'ultimo_round_annunciato')).toEqual([]);
  });

  it('chi ha la mano vuota non scarta nulla e pesca 5 carte', () => {
    const prima = scenario({
      mani: { g1: [], g2: ['carriola#1'], g3: ['balla-di-fieno#1'] },
      mazzo: ['beee-no#1', 'coperta-di-lana#1', 'pernacchia#1', 'sasso-comodo#1', 'carriola#2', 'carriola#3'],
    });
    const s = prosegui(prima);
    expect(ordinate(mano(s, 'g1'))).toEqual(
      ordinate(['beee-no#1', 'coperta-di-lana#1', 'pernacchia#1', 'sasso-comodo#1', 'carriola#2']),
    );
    expect(s.scarti).toEqual(prima.scarti);
    expect(s.mazzo).toEqual(['carriola#3']);
    expect(eventiNuovi(prima, s, 'ripescata')).toMatchObject([{ giocatore: 'g1', scartate: 0, pescate: 5 }]);
    expect(s.datiRound.partecipanti).toEqual(['g1', 'g2', 'g3']);
  });

  it('se dopo la ripescata non ha ancora Trovate ripete: un evento ripescata per ogni giro', () => {
    const giro1 = ['belato-di-gruppo#1', 'belato-di-gruppo#2', 'belato-di-gruppo#3', 'pernacchia#1', 'pernacchia#2'];
    const giro2 = [
      'pernacchia#3',
      'mondo-alla-rovescia#1',
      'mondo-alla-rovescia#2',
      'faccio-finta-di-niente#1',
      'faccio-finta-di-niente#2',
    ];
    const giro3 = ['finta-svenuta#1', 'finta-svenuta#2', 'beee-no#2', 'balla-di-fieno#1', 'beee-no#3'];
    const resto = ['coperta-di-lana#1', 'coperta-di-lana#2'];
    const prima = scenario({
      mani: { g1: ['beee-no#1'], g2: ['carriola#1'], g3: ['carriola#2'] },
      mazzo: [...giro1, ...giro2, ...giro3, ...resto],
    });
    const s = prosegui(prima);

    expect(ordinate(mano(s, 'g1'))).toEqual(ordinate(giro3));
    expect(s.mazzo).toEqual(resto);
    expect(ordinate(s.scarti)).toEqual(ordinate(['beee-no#1', ...giro1, ...giro2]));
    expect(eventiNuovi(prima, s, 'ripescata')).toMatchObject([
      { giocatore: 'g1', scartate: 1, pescate: 5 },
      { giocatore: 'g1', scartate: 5, pescate: 5 },
      { giocatore: 'g1', scartate: 5, pescate: 5 },
    ]);
    expect(s.datiRound.partecipanti).toEqual(['g1', 'g2', 'g3']);
    expect(scelteDi(s)).toEqual({ g1: null, g2: null, g3: null });
  });

  it('con il mazzo corto pesca quel che resta e partecipa se trova una Trovata; scatta l\'ultimo round (D32, D31)', () => {
    const prima = scenario({
      mani: { g1: ['beee-no#1', 'pernacchia#1'], g2: ['carriola#1'], g3: ['balla-di-fieno#1'] },
      mazzo: ['belato-di-gruppo#1', 'carriola#3', 'pernacchia#2'],
    });
    const s = prosegui(prima);
    expect(ordinate(mano(s, 'g1'))).toEqual(ordinate(['belato-di-gruppo#1', 'carriola#3', 'pernacchia#2']));
    expect(s.mazzo).toEqual([]);
    expect(ordinate(s.scarti)).toEqual(ordinate(['beee-no#1', 'pernacchia#1']));
    expect(eventiNuovi(prima, s, 'ripescata')).toMatchObject([{ giocatore: 'g1', scartate: 2, pescate: 3 }]);
    expect(s.datiRound.partecipanti).toEqual(['g1', 'g2', 'g3']);
    expect(s.ultimoRound).toBe(2);
    expect(eventiNuovi(prima, s, 'ultimo_round_annunciato')).toMatchObject([{ round: 2 }]);
    // il round in corso prosegue normalmente
    expect(s.fase.nome).toBe('scelta');
  });

  it('se il mazzo finisce durante le ripescate senza Trovate, resta fuori dal round con le ultime carte pescate', () => {
    const giro1 = ['belato-di-gruppo#1', 'belato-di-gruppo#2', 'belato-di-gruppo#3', 'pernacchia#1', 'pernacchia#2'];
    const prima = scenario({
      mani: { g1: ['beee-no#1'], g2: ['carriola#1'], g3: ['carriola#2'] },
      mazzo: [...giro1, 'pernacchia#3', 'mondo-alla-rovescia#1'],
    });
    const s = prosegui(prima);
    expect(eventiNuovi(prima, s, 'ripescata')).toMatchObject([
      { giocatore: 'g1', scartate: 1, pescate: 5 },
      { giocatore: 'g1', scartate: 5, pescate: 2 },
    ]);
    // l'ultima mano pescata non viene scartata: il mazzo è vuoto
    expect(ordinate(mano(s, 'g1'))).toEqual(ordinate(['pernacchia#3', 'mondo-alla-rovescia#1']));
    expect(ordinate(s.scarti)).toEqual(ordinate(['beee-no#1', ...giro1]));
    expect(s.mazzo).toEqual([]);
    expect(s.datiRound.partecipanti).toEqual(['g2', 'g3']);
    expect(scelteDi(s)).toEqual({ g2: null, g3: null });
    expect(eventiNuovi(prima, s, 'fuori_dal_round')).toMatchObject([{ giocatore: 'g1' }]);
    expect(s.ultimoRound).toBe(2);
  });

  it('con il mazzo vuoto chi non ha Trovate non scarta e resta fuori dal round (D32)', () => {
    const prima = scenario({
      mani: { g1: ['beee-no#1', 'pernacchia#1'], g2: ['carriola#1'], g3: ['balla-di-fieno#1'] },
      mazzo: [],
      scarti: ['coperta-di-lana#1'],
    });
    const s = prosegui(prima);
    expect(mano(s, 'g1')).toEqual(['beee-no#1', 'pernacchia#1']);
    expect(s.scarti).toEqual(['coperta-di-lana#1']);
    expect(eventiNuovi(prima, s, 'ripescata')).toEqual([]);
    expect(eventiNuovi(prima, s, 'fuori_dal_round')).toMatchObject([{ giocatore: 'g1' }]);
    expect(s.datiRound.partecipanti).toEqual(['g2', 'g3']);
    expect(scelteDi(s)).toEqual({ g2: null, g3: null });
  });

  it('chi resta fuori non può scegliere, non è aspettato e non ha punteggio, ma partecipa ai Belati di punteggio (D34)', () => {
    const s = inScelta({
      guaio: GUAIO_DEL_TIPO.meteo, // Ricciolo (g1) avrebbe +1: non deve comparire
      mani: { g1: ['beee-no#1', 'pernacchia#1'], g2: ['carriola#1'], g3: ['balla-di-fieno#1'] },
      mazzo: [],
    });
    verificaRifiuto(s, { tipo: 'scegliTrovata', giocatore: 'g1', carte: ['beee-no#1'] });
    expect(ordinate(inAttesaDi(s).giocatori)).toEqual(['g2', 'g3']);
    expect(azioniPossibili(s, 'g1').filter((a) => a.tipo === 'scegliTrovata')).toEqual([]);

    const r = scegli(s, { g2: ['carriola#1'], g3: ['balla-di-fieno#1'] });
    expect(r.fase.nome).toBe('rivelazione');
    expect(r.datiRound.giocate['g1'] ?? []).toEqual([]);
    expect(righe(r, 'g1')).toEqual([]);
    expect(punteggioTotale(r, 'g1')).toBe(0);
    expect(mano(r, 'g1')).toEqual(['beee-no#1', 'pernacchia#1']);

    const p = prosegui(r);
    expect(p.fase.nome).toBe('belati_punteggio');
    if (p.fase.nome !== 'belati_punteggio') return;
    expect(ordinate(p.fase.inAttesa)).toEqual(['g1', 'g2', 'g3']);
  });

  it('la ripescata che pesca l\'ultima carta fa scattare ultimoRound = round + 1 (9.3, D31)', () => {
    const ultime = ['belato-di-gruppo#1', 'balla-di-fieno#1', 'beee-no#2', 'coperta-di-lana#1', 'pernacchia#2'];
    const prima = scenario({
      round: 3,
      mani: { g1: ['pernacchia#1', 'beee-no#1'], g2: ['carriola#1'], g3: ['carriola#2'] },
      mazzo: ultime,
    });
    const s = prosegui(prima);
    expect(s.mazzo).toEqual([]);
    expect(ordinate(mano(s, 'g1'))).toEqual(ordinate(ultime));
    expect(s.ultimoRound).toBe(4);
    expect(eventiNuovi(prima, s, 'ultimo_round_annunciato')).toMatchObject([{ round: 4 }]);
    expect(s.round).toBe(3);
    expect(s.fase.nome).toBe('scelta');
    expect(s.datiRound.partecipanti).toEqual(['g1', 'g2', 'g3']);
  });

  it('le ripescate seguono l\'ordine di posto a partire dal primo giocatore (D33)', () => {
    const primaPescata = ['coperta-di-lana#1', 'belato-di-gruppo#1', 'belato-di-gruppo#2', 'belato-di-gruppo#3', 'pernacchia#2'];
    const secondaPescata = ['balla-di-fieno#1', 'beee-no#2', 'beee-no#3', 'pernacchia#3', 'mondo-alla-rovescia#1'];
    const prima = scenario({
      primoGiocatore: 'g2',
      mani: { g1: ['beee-no#1'], g2: ['pernacchia#1'], g3: ['carriola#1'] },
      mazzo: [...primaPescata, ...secondaPescata, 'carriola#2'],
    });
    const s = prosegui(prima);
    expect(eventiNuovi(prima, s, 'ripescata').map((e) => e.giocatore)).toEqual(['g2', 'g1']);
    expect(ordinate(mano(s, 'g2'))).toEqual(ordinate(primaPescata));
    expect(ordinate(mano(s, 'g1'))).toEqual(ordinate(secondaPescata));
    expect(s.mazzo).toEqual(['carriola#2']);
    expect(s.datiRound.partecipanti).toEqual(['g1', 'g2', 'g3']);
  });

  it('se la ripescata di chi viene prima esaurisce il mazzo, chi viene dopo resta fuori senza scartare', () => {
    const prima = scenario({
      mani: { g1: ['beee-no#1'], g2: ['pernacchia#1'], g3: ['carriola#1'] },
      mazzo: ['balla-di-fieno#1', 'beee-no#2'],
    });
    const s = prosegui(prima);
    expect(ordinate(mano(s, 'g1'))).toEqual(ordinate(['balla-di-fieno#1', 'beee-no#2']));
    expect(mano(s, 'g2')).toEqual(['pernacchia#1']);
    expect(s.scarti).toEqual(['beee-no#1']);
    expect(eventiNuovi(prima, s, 'ripescata')).toMatchObject([{ giocatore: 'g1', scartate: 1, pescate: 2 }]);
    expect(eventiNuovi(prima, s, 'fuori_dal_round')).toMatchObject([{ giocatore: 'g2' }]);
    expect(s.datiRound.partecipanti).toEqual(['g1', 'g3']);
    expect(s.ultimoRound).toBe(2);
  });
});

// ─── scegliTrovata: rifiuti ──────────────────────────────────────────────────

describe('scegliTrovata: scelte non valide (brief 3 punto 2; specifica 4.2, D9)', () => {
  function statoPerRifiuti(): Stato {
    return inScelta({
      mani: {
        g1: [
          'carriola#1',
          'balla-di-fieno#1',
          'calzino-gemello#1',
          'orecchino-gemello#1',
          'ciliegie-appaiate#1',
          'beee-no#1',
        ],
        g2: ['pantofola-gemella#1', 'coperta-di-lana#1'],
        g3: ['sasso-comodo#1'],
      },
      mazzo: ['carriola#2', 'coperta-di-lana#2'],
    });
  }

  const casi: Array<[string, IdCarta[]]> = [
    ['una carta che non è in mano (è nel mazzo)', ['carriola#2']],
    ['una carta nella mano di un altro giocatore', ['coperta-di-lana#1']],
    ['un Belato', ['beee-no#1']],
    ['un Belato insieme a una Trovata', ['carriola#1', 'beee-no#1']],
    ['due Trovate non Gemelle', ['carriola#1', 'balla-di-fieno#1']],
    ['una Gemella con una Trovata non Gemella', ['calzino-gemello#1', 'carriola#1']],
    ['la stessa Gemella due volte', ['calzino-gemello#1', 'calzino-gemello#1']],
    ['una Gemella propria con una Gemella altrui', ['calzino-gemello#1', 'pantofola-gemella#1']],
    ['tre Gemelle', ['calzino-gemello#1', 'orecchino-gemello#1', 'ciliegie-appaiate#1']],
    ['nessuna carta', []],
  ];

  it.each(casi)('rifiuta %s', (_descrizione, carte) => {
    const s = statoPerRifiuti();
    verificaRifiuto(s, { tipo: 'scegliTrovata', giocatore: 'g1', carte });
  });

  it('un rifiuto non cancella la scelta già fatta', () => {
    const s = scegliTrovata(statoPerRifiuti(), 'g1', ['carriola#1']);
    verificaRifiuto(s, { tipo: 'scegliTrovata', giocatore: 'g1', carte: ['beee-no#1'] });
    expect(scelteDi(s)['g1']).toEqual(['carriola#1']);
  });

  it('rifiuta un giocatore eliminato, anche con una Trovata in mano', () => {
    const s = inScelta({
      eliminati: ['g3'],
      mani: { g1: ['carriola#1'], g2: ['balla-di-fieno#1'], g3: ['coperta-di-lana#1'] },
    });
    expect(s.datiRound.partecipanti).toEqual(['g1', 'g2']);
    verificaRifiuto(s, { tipo: 'scegliTrovata', giocatore: 'g3', carte: ['coperta-di-lana#1'] });
  });

  it('rifiuta un giocatore inesistente', () => {
    const s = statoPerRifiuti();
    verificaRifiuto(s, { tipo: 'scegliTrovata', giocatore: 'g9', carte: ['carriola#1'] });
  });
});

// ─── Scelta segreta e cambio di scelta ───────────────────────────────────────

describe('Scelta segreta e cambio di scelta (specifica 4.2, 10, 11, D40)', () => {
  const mani = {
    g1: ['carriola#1', 'calzino-gemello#1', 'orecchino-gemello#1'],
    g2: ['balla-di-fieno#1'],
    g3: ['coperta-di-lana#1'],
  };

  it('scegliere non toglie la carta dalla mano; evento ha_scelto senza la carta', () => {
    const s = inScelta({ mani });
    const r = scegliTrovata(s, 'g1', ['carriola#1']);
    expect(r.fase.nome).toBe('scelta');
    expect(scelteDi(r)).toEqual({ g1: ['carriola#1'], g2: null, g3: null });
    expect(mano(r, 'g1')).toEqual(['carriola#1', 'calzino-gemello#1', 'orecchino-gemello#1']);
    expect(r.datiRound.giocate['g1'] ?? []).toEqual([]);
    const eventi = eventiNuovi(s, r, 'ha_scelto');
    expect(eventi).toMatchObject([{ giocatore: 'g1' }]);
    expect(JSON.stringify(eventi)).not.toContain('carriola#1');
  });

  it('inAttesaDi elenca solo chi non ha ancora scelto', () => {
    const s = scegli(inScelta({ mani }), { g1: ['carriola#1'], g3: ['coperta-di-lana#1'] });
    expect(inAttesaDi(s)).toEqual({ sistema: false, giocatori: ['g2'] });
  });

  it('vistaPer mostra a tutti solo chi ha scelto, e a ciascuno la propria scelta', () => {
    const s = scegliTrovata(inScelta({ mani }), 'g1', ['carriola#1']);
    const haScelto = { g1: true, g2: false, g3: false };
    expect(vistaPer(s, 'g1').fase).toEqual({ nome: 'scelta', haScelto, miaScelta: ['carriola#1'] });
    expect(vistaPer(s, 'g2').fase).toEqual({ nome: 'scelta', haScelto, miaScelta: null });
    expect(vistaPer(s, null).fase).toEqual({ nome: 'scelta', haScelto, miaScelta: null });
    expect(JSON.stringify(vistaPer(s, 'g2'))).not.toContain('carriola#1');
    expect(JSON.stringify(vistaPer(s, null))).not.toContain('carriola#1');
  });

  it('si può cambiare scelta finché non hanno scelto tutti, anche da una carta alla coppia e ritorno (D40)', () => {
    let s = inScelta({ mani });
    s = scegliTrovata(s, 'g1', ['carriola#1']);
    s = scegliTrovata(s, 'g2', ['balla-di-fieno#1']);
    s = scegliTrovata(s, 'g1', ['calzino-gemello#1', 'orecchino-gemello#1']);
    expect(s.fase.nome).toBe('scelta');
    expect(ordinate(scelteDi(s)['g1'] ?? [])).toEqual(['calzino-gemello#1', 'orecchino-gemello#1']);
    expect(scelteDi(s)['g2']).toEqual(['balla-di-fieno#1']);
    expect(inAttesaDi(s).giocatori).toEqual(['g3']);

    s = scegliTrovata(s, 'g1', ['orecchino-gemello#1']);
    expect(scelteDi(s)['g1']).toEqual(['orecchino-gemello#1']);

    s = scegliTrovata(s, 'g3', ['coperta-di-lana#1']);
    expect(s.fase.nome).toBe('rivelazione');
    expect(s.datiRound.giocate['g1']).toEqual(['orecchino-gemello#1']);
    expect(ordinate(mano(s, 'g1'))).toEqual(['calzino-gemello#1', 'carriola#1']);
  });

  it('una Gemella si può giocare da sola', () => {
    const s = scegli(inScelta({ mani, guaio: GUAIO_DEL_TIPO.drammi }), {
      g1: ['calzino-gemello#1'],
      g2: ['balla-di-fieno#1'],
      g3: ['coperta-di-lana#1'],
    });
    expect(s.datiRound.giocate['g1']).toEqual(['calzino-gemello#1']);
    expect(righe(s, 'g1')).toMatchObject([{ tipo: 'valore', delta: 3, carta: 'calzino-gemello#1' }]);
    expect(mano(s, 'g1')).toContain('orecchino-gemello#1');
  });

  it('azioniPossibili elenca ogni Trovata da sola e le coppie di Gemelle, mai i Belati; ogni azione è accettata', () => {
    const s = inScelta({
      mani: {
        g1: ['carriola#1', 'calzino-gemello#1', 'orecchino-gemello#1', 'beee-no#1'],
        g2: ['calzino-gemello#2', 'pantofola-gemella#1', 'pantofola-gemella#2', 'pernacchia#1'],
        g3: ['coperta-di-lana#1'],
      },
    });
    const chiavi = (g: IdGiocatore): Set<string> => {
      const azioni = azioniPossibili(s, g);
      expect(azioni.every((a) => a.tipo === 'scegliTrovata')).toBe(true);
      for (const a of azioni) expect(() => applica(s, a)).not.toThrow();
      return new Set(
        azioni
          .filter((a): a is AzioneScelta => a.tipo === 'scegliTrovata')
          .map((a) => {
            expect(a.giocatore).toBe(g);
            return a.carte.map(tipoLocale).sort().join('+');
          }),
      );
    };
    expect(chiavi('g1')).toEqual(
      new Set(['carriola', 'calzino-gemello', 'orecchino-gemello', 'calzino-gemello+orecchino-gemello']),
    );
    expect(chiavi('g2')).toEqual(
      new Set([
        'calzino-gemello',
        'pantofola-gemella',
        'calzino-gemello+pantofola-gemella',
        'pantofola-gemella+pantofola-gemella',
      ]),
    );
  });

  it('dopo una scelta azioniPossibili permette ancora di cambiarla', () => {
    const s = scegliTrovata(inScelta({ mani }), 'g1', ['carriola#1']);
    const scelte = azioniPossibili(s, 'g1').filter((a): a is AzioneScelta => a.tipo === 'scegliTrovata');
    expect(scelte.some((a) => a.carte.length === 1 && a.carte[0] === 'calzino-gemello#1')).toBe(true);
  });
});

// ─── Trovate Gemelle in coppia ───────────────────────────────────────────────

describe('Trovate Gemelle giocate in coppia (brief 3 punto 2 e punto 5; D9)', () => {
  it('due Gemelle di tipo diverso: due righe valore e totale = somma', () => {
    const s = scegli(
      inScelta({
        guaio: GUAIO_DEL_TIPO.drammi, // Ricciolo (g1) non ha tratti sui Drammi
        mani: {
          g1: ['ciliegie-appaiate#1', 'orecchino-gemello#1', 'carriola#1'],
          g2: ['balla-di-fieno#1'],
          g3: ['coperta-di-lana#1'],
        },
      }),
      { g1: ['ciliegie-appaiate#1', 'orecchino-gemello#1'], g2: ['balla-di-fieno#1'], g3: ['coperta-di-lana#1'] },
    );
    expect(s.fase.nome).toBe('rivelazione');
    expect(ordinate(s.datiRound.giocate['g1'] ?? [])).toEqual(['ciliegie-appaiate#1', 'orecchino-gemello#1']);
    const valori = [...righe(s, 'g1', 'valore')].sort((a, b) => (a.carta ?? '').localeCompare(b.carta ?? ''));
    expect(valori).toMatchObject([
      { tipo: 'valore', delta: 1, carta: 'ciliegie-appaiate#1' },
      { tipo: 'valore', delta: 4, carta: 'orecchino-gemello#1' },
    ]);
    expect(righe(s, 'g1')).toHaveLength(2);
    expect(punteggioTotale(s, 'g1')).toBe(5);
    expect(mano(s, 'g1')).toEqual(['carriola#1']);
  });

  it('due Gemelle dello stesso tipo: 3 + 3 = 6', () => {
    const s = scegli(
      inScelta({
        guaio: GUAIO_DEL_TIPO.drammi,
        mani: {
          g1: ['calzino-gemello#1', 'calzino-gemello#2'],
          g2: ['balla-di-fieno#1'],
          g3: ['coperta-di-lana#1'],
        },
      }),
      { g1: ['calzino-gemello#1', 'calzino-gemello#2'], g2: ['balla-di-fieno#1'], g3: ['coperta-di-lana#1'] },
    );
    expect(righe(s, 'g1', 'valore').map((r) => r.delta)).toEqual([3, 3]);
    expect(totale(s, 'g1')).toBe(6);
    expect(mano(s, 'g1')).toEqual([]);
  });

  it('la coppia riceve una sola riga tratto', () => {
    const s = scegli(
      inScelta({
        guaio: GUAIO_DEL_TIPO.drammi, // Sospirella (g3): bonus Drammi
        mani: {
          g1: ['carriola#1'],
          g2: ['balla-di-fieno#1'],
          g3: ['pantofola-gemella#1', 'calzino-gemello#1'],
        },
      }),
      { g1: ['carriola#1'], g2: ['balla-di-fieno#1'], g3: ['pantofola-gemella#1', 'calzino-gemello#1'] },
    );
    expect(righe(s, 'g3', 'valore')).toHaveLength(2);
    expect(righe(s, 'g3', 'tratto')).toMatchObject([{ tipo: 'tratto', delta: 1 }]);
    expect(righe(s, 'g3')).toHaveLength(3);
    expect(totale(s, 'g3')).toBe(2 + 3 + 1);
  });
});

// ─── Rivelazione ─────────────────────────────────────────────────────────────

describe('Rivelazione (brief 3 punto 3; specifica 4.3)', () => {
  const mani = {
    g1: ['carriola#1', 'sasso-comodo#1'],
    g2: ['calzino-gemello#1', 'orecchino-gemello#1', 'beee-no#1'],
    g3: ['balla-di-fieno#1'],
  };

  function quasiTutti(): Stato {
    return scegli(inScelta({ mani, guaio: GUAIO_DEL_TIPO.drammi }), {
      g1: ['carriola#1'],
      g2: ['calzino-gemello#1', 'orecchino-gemello#1'],
    });
  }

  it('appena l\'ultimo partecipante sceglie la fase è rivelazione e si aspetta il sistema', () => {
    const prima = quasiTutti();
    expect(prima.fase.nome).toBe('scelta');
    const s = scegliTrovata(prima, 'g3', ['balla-di-fieno#1']);
    expect(s.fase).toEqual({ nome: 'rivelazione' });
    expect(inAttesaDi(s)).toEqual({ sistema: true, giocatori: [] });
  });

  it('le carte scelte passano dalla mano a giocate e tavolo; evento rivelazione', () => {
    const prima = quasiTutti();
    const s = scegliTrovata(prima, 'g3', ['balla-di-fieno#1']);

    expect(mano(s, 'g1')).toEqual(['sasso-comodo#1']);
    expect(mano(s, 'g2')).toEqual(['beee-no#1']);
    expect(mano(s, 'g3')).toEqual([]);

    const giocate = s.datiRound.giocate;
    expect(Object.keys(giocate).sort()).toEqual(['g1', 'g2', 'g3']);
    expect(giocate['g1']).toEqual(['carriola#1']);
    expect(ordinate(giocate['g2'] ?? [])).toEqual(['calzino-gemello#1', 'orecchino-gemello#1']);
    expect(giocate['g3']).toEqual(['balla-di-fieno#1']);

    expect(ordinate(s.datiRound.tavolo)).toEqual(
      ordinate(['carriola#1', 'calzino-gemello#1', 'orecchino-gemello#1', 'balla-di-fieno#1']),
    );
    expect(s.scarti).toEqual(prima.scarti);

    const eventi = eventiNuovi(prima, s, 'rivelazione');
    expect(eventi).toHaveLength(1);
    expect(eventi[0]?.giocate).toEqual(giocate);
    expect(eventiNuovi(prima, s, 'ha_scelto')).toMatchObject([{ giocatore: 'g3' }]);
  });

  it('dopo la rivelazione le giocate sono pubbliche nella vista degli altri', () => {
    const s = scegliTrovata(quasiTutti(), 'g3', ['balla-di-fieno#1']);
    expect(vistaPer(s, 'g3').datiRound.giocate).toEqual(s.datiRound.giocate);
    expect(vistaPer(s, null).datiRound.giocate).toEqual(s.datiRound.giocate);
  });

  it('dopo la rivelazione non si può più scegliere né cambiare scelta', () => {
    const s = scegliTrovata(quasiTutti(), 'g3', ['balla-di-fieno#1']);
    verificaRifiuto(s, { tipo: 'scegliTrovata', giocatore: 'g1', carte: ['sasso-comodo#1'] });
    expect(azioniPossibili(s, 'g1').some((a) => a.tipo === 'scegliTrovata')).toBe(false);
  });

  it('senza partecipanti si entra subito in rivelazione, senza giocate (4.2)', () => {
    const prima = scenario({
      guaio: GUAIO_DEL_TIPO.meteo,
      mani: { g1: ['beee-no#1'], g2: ['pernacchia#1'], g3: ['belato-di-gruppo#1'] },
      mazzo: [],
    });
    const s = prosegui(prima);
    expect(s.fase).toEqual({ nome: 'rivelazione' });
    expect(s.datiRound.partecipanti).toEqual([]);
    expect(eventiNuovi(prima, s, 'fuori_dal_round').map((e) => e.giocatore)).toEqual(['g1', 'g2', 'g3']);
    expect(s.datiRound.giocate).toEqual({});
    expect(s.datiRound.tavolo).toEqual([]);
    expect(eventiNuovi(prima, s, 'rivelazione')).toMatchObject([{ giocate: {} }]);
    expect(mano(s, 'g1')).toEqual(['beee-no#1']);
  });
});

// ─── Tratti delle pecore ─────────────────────────────────────────────────────

describe('Tratti delle pecore (brief 2 "Le quattro pecore"; specifica 4.3; setup.json)', () => {
  it.each(CASI_TRATTO)('$pecora ($giocatore) con Guaio $tipo: $descrizione', ({ giocatore, tipo, atteso }) => {
    const s = quattroCarriole(GUAIO_DEL_TIPO[tipo]);
    expect(s.datiRound.guaio).toBe(GUAIO_DEL_TIPO[tipo]);
    expect(righe(s, giocatore, 'valore')).toMatchObject([{ tipo: 'valore', delta: 8 }]);
    const tratti = righe(s, giocatore, 'tratto');
    if (atteso === 0) {
      expect(tratti).toEqual([]);
    } else {
      expect(tratti).toMatchObject([{ tipo: 'tratto', delta: atteso }]);
    }
    expect(righe(s, giocatore)).toHaveLength(atteso === 0 ? 1 : 2);
    expect(punteggioTotale(s, giocatore)).toBe(8 + atteso);
  });

  it.each(TOSATURE)('%s (Tosatura a Sorpresa) non attiva alcun tratto', (tosatura) => {
    const s = quattroCarriole(tosatura);
    for (const g of ['g1', 'g2', 'g3', 'g4']) {
      expect(righe(s, g, 'tratto')).toEqual([]);
      expect(punteggioTotale(s, g)).toBe(8);
    }
  });

  it('round senza Guaio: nessun tratto (D27)', () => {
    const s = quattroCarriole(null);
    expect(s.datiRound.guaio).toBeNull();
    for (const g of ['g1', 'g2', 'g3', 'g4']) {
      expect(righe(s, g, 'tratto')).toEqual([]);
      expect(punteggioTotale(s, g)).toBe(8);
    }
  });
});

// ─── Punteggio di base e uscita dalla rivelazione ────────────────────────────

describe('Punteggio di base e uscita dalla rivelazione (brief 3 punti 4–6; specifica 4.3–4.4, 4.6, D18, D23)', () => {
  it('punteggioTotale = valore + tratto, anche negativo', () => {
    const s = scegli(
      inScelta({
        guaio: 'grandine-a-sorpresa#1', // Meteo: Ricciolo +1, Brontolana nulla, Sospirella −1
        mani: { g1: ['carriola#1'], g2: ['balla-di-fieno#1'], g3: ['scorta-nel-vello#1'] },
      }),
      { g1: ['carriola#1'], g2: ['balla-di-fieno#1'], g3: ['scorta-nel-vello#1'] },
    );
    expect(punteggioTotale(s, 'g1')).toBe(9);
    expect(punteggioTotale(s, 'g2')).toBe(5);
    expect(punteggioTotale(s, 'g3')).toBe(-1);
    expect(righe(s, 'g3', 'valore')).toMatchObject([{ tipo: 'valore', delta: 0, carta: 'scorta-nel-vello#1' }]);
    expect(righe(s, 'g3', 'tratto')).toMatchObject([{ tipo: 'tratto', delta: -1 }]);
    expect(righe(s, 'g3')).toHaveLength(2);
    for (const g of ['g1', 'g2', 'g3']) {
      expect(totale(s, g)).toBe(righe(s, g).reduce((somma, r) => somma + r.delta, 0));
    }
  });

  it('prosegui dalla rivelazione porta in effetti se una carta giocata ha un effetto attivabile', () => {
    const r = scegli(
      inScelta({
        mani: { g1: ['agnellino-smarrito#1'], g2: ['carriola#1'], g3: ['balla-di-fieno#1'] },
      }),
      { g1: ['agnellino-smarrito#1'], g2: ['carriola#1'], g3: ['balla-di-fieno#1'] },
    );
    expect(r.gregge).toBeGreaterThan(0);
    const s = prosegui(r);
    expect(s.fase.nome).toBe('effetti');
    if (s.fase.nome !== 'effetti') return;
    expect(s.fase.indice).toBe(0);
    expect(s.fase.coda).toMatchObject([
      {
        giocatore: 'g1',
        carta: 'agnellino-smarrito#1',
        effetto: 'prendi_agnellino',
        gruppo: 'normale',
        valore: 1,
        esito: 'attesa',
      },
    ]);
    expect(inAttesaDi(s)).toEqual({ sistema: false, giocatori: ['g1'] });
  });

  it('senza carte con effetto prosegui porta direttamente a belati_punteggio', () => {
    const r = scegli(
      inScelta({
        mani: { g1: ['carriola#1'], g2: ['calzino-gemello#1', 'orecchino-gemello#1'], g3: ['sasso-comodo#1'] },
      }),
      { g1: ['carriola#1'], g2: ['calzino-gemello#1', 'orecchino-gemello#1'], g3: ['sasso-comodo#1'] },
    );
    const s = prosegui(r);
    expect(s.fase.nome).toBe('belati_punteggio');
    if (s.fase.nome !== 'belati_punteggio') return;
    expect(ordinate(s.fase.inAttesa)).toEqual(['g1', 'g2', 'g3']);
    expect(inAttesaDi(s).sistema).toBe(false);
    expect(ordinate(inAttesaDi(s).giocatori)).toEqual(['g1', 'g2', 'g3']);
    // le righe di base non cambiano uscendo dalla rivelazione
    expect(s.datiRound.punteggi).toEqual(r.datiRound.punteggi);
  });

  it('con soli effetti non attivabili (saltati) prosegui porta direttamente a belati_punteggio (D11, tabella 6)', () => {
    const r = scegli(
      inScelta({
        giocatori: 4,
        gregge: 0, // prendi_agnellino: serve Gregge ≥ 1
        mazzo: [], // guarda_due: serve mazzo ≥ 1
        agnellini: { g1: 0, g2: 0, g3: 0, g4: 3 }, // sposta_agnellino di g4: nessun avversario con agnellini
        mani: {
          g1: ['agnellino-smarrito#1'],
          g2: ['cannocchiale#1'],
          g3: ['scorta-nel-vello#1', 'beee-no#1'], // scarta_e_somma: nessun'altra Trovata in mano
          g4: ['campanaccio-stonato#1'],
        },
      }),
      {
        g1: ['agnellino-smarrito#1'],
        g2: ['cannocchiale#1'],
        g3: ['scorta-nel-vello#1'],
        g4: ['campanaccio-stonato#1'],
      },
    );
    const s = prosegui(r);
    expect(s.fase.nome).toBe('belati_punteggio');
    if (s.fase.nome !== 'belati_punteggio') return;
    expect(ordinate(s.fase.inAttesa)).toEqual(['g1', 'g2', 'g3', 'g4']);
    expect(s.gregge).toBe(0);
    expect(s.giocatori.map((g) => g.agnellini)).toEqual([0, 0, 0, 3]);
    expect(mano(s, 'g3')).toEqual(['beee-no#1']);
    expect(s.richiesta).toBeNull();
  });

  it('con un solo partecipante si salta la finestra dei Belati di punteggio e si va al dado (D18, D23)', () => {
    const r = scegli(
      inScelta({
        mani: { g1: ['carriola#1'], g2: ['beee-no#1'], g3: ['pernacchia#1'] },
        mazzo: [],
      }),
      { g1: ['carriola#1'] },
    );
    expect(r.fase.nome).toBe('rivelazione');
    expect(r.datiRound.partecipanti).toEqual(['g1']);
    const s = prosegui(r);
    expect(s.fase).toEqual({ nome: 'dado', indice: 0 });
    expect(s.datiRound.piuAlti).toEqual(['g1']);
    expect(s.datiRound.piuBassi).toEqual([]);
    expect(s.datiRound.lanciatori).toEqual(['g1']);
  });

  it('senza partecipanti la rivelazione porta al Guaio al peggiore senza destinatario (4.6, 4.8, D23)', () => {
    const r = prosegui(
      scenario({
        guaio: GUAIO_DEL_TIPO.predatori,
        mani: { g1: ['beee-no#1'], g2: ['pernacchia#1'], g3: ['belato-di-gruppo#1'] },
        mazzo: [],
      }),
    );
    expect(r.fase.nome).toBe('rivelazione');
    const s = prosegui(r);
    expect(s.fase).toEqual({ nome: 'guaio_al_peggiore', destinatario: null, spareggio: null });
    expect(s.datiRound.piuAlti).toEqual([]);
    expect(s.datiRound.piuBassi).toEqual([]);
    expect(s.datiRound.lanciatori).toEqual([]);
  });
});
