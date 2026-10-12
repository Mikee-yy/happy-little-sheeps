// Revisione avversariale del flusso del round.
// Regole: brief sezione 3 ("Preparazione", "Svolgimento di un round" passi 1–12, "Come si vince", "Casi limite");
// specifica docs/motore.md sezioni 3, 4.1–4.12, 9, 11 e decisioni D1, D23, D27, D31–D34.
// Casi limite non coperti dagli altri file: distribuzione iniziale, round senza Guaio con 0 o 1 partecipanti,
// ultimo round senza partecipanti o senza Guaio, rimescolata dei Guai all'ultimo round, pescate di fine round
// con il primo giocatore eliminato, ripescate con eliminati, assenza di stalli in scenari estremi.
import { describe, expect, it } from 'vitest';
import {
  applica,
  azioniPossibili,
  creaMazzoGuai,
  creaMazzoPrincipale,
  inAttesaDi,
  nuovaPartita,
  tentaApplica,
  tipoDi,
  type Azione,
  type Evento,
  type Fase,
  type IdCarta,
  type IdGiocatore,
  type IdPecora,
  type Stato,
  type StatoGiocatore,
} from '../src';
import { eTrovata } from '../src/dati';
import { intero, mescola } from '../src/rng';
import { chiudiPunteggio, conFaccia, nessunaReazione, prosegui, scegli, scenario } from './aiuti';

// ─── Aiuti locali ────────────────────────────────────────────────────────────

type FaseDi<N extends Fase['nome']> = Extract<Fase, { nome: N }>;
type EventoDi<T extends Evento['tipo']> = Extract<Evento, { tipo: T }>;

const PECORE: IdPecora[] = ['ricciolo', 'brontolana', 'sospirella', 'nerina'];

function fase<N extends Fase['nome']>(s: Stato, nome: N): FaseDi<N> {
  expect(s.fase.nome).toBe(nome);
  return s.fase as FaseDi<N>;
}

function gioc(s: Stato, id: IdGiocatore): StatoGiocatore {
  const g = s.giocatori.find((x) => x.id === id);
  if (!g) throw new Error(`giocatore ${id} inesistente`);
  return g;
}

/** Eventi di tipo `tipo` prodotti passando da `prima` a `dopo`. */
function nuovi<T extends Evento['tipo']>(prima: Stato, dopo: Stato, tipo: T): EventoDi<T>[] {
  return dopo.eventi.filter((e): e is EventoDi<T> => e.tipo === tipo && e.seq >= prima.prossimoEvento);
}

const passa = (s: Stato, chi: IdGiocatore): Stato => applica(s, { tipo: 'passa', giocatore: chi });
const concludi = (s: Stato, chi: IdGiocatore): Stato =>
  applica(s, { tipo: 'concludiConsolazione', giocatore: chi, scarta: null });

/** Lancia il dado del lanciatore corrente con la faccia indicata e lascia passare la finestra. */
function lancia(s: Stato, idFaccia = 'pascolo_piccolo'): Stato {
  const f = fase(s, 'dado');
  const chi = s.datiRound.lanciatori[f.indice];
  if (!chi) throw new Error('nessun lanciatore');
  return nessunaReazione(applica(conFaccia(s, idFaccia), { tipo: 'lanciaDado', giocatore: chi }));
}

/** Il primo non eliminato dopo `id` in ordine di posto (specifica 4.1). */
function successivo(s: Stato, id: IdGiocatore): IdGiocatore {
  const n = s.giocatori.length;
  const i = s.giocatori.findIndex((g) => g.id === id);
  for (let k = 1; k <= n; k++) {
    const g = s.giocatori[(i + k) % n]!;
    if (!g.eliminato) return g.id;
  }
  return id;
}

// ─── Preparazione ────────────────────────────────────────────────────────────

describe('Preparazione: distribuzione delle carte (specifica 3.3–3.6, D33)', () => {
  // Specifica 3: si mescolano mazzo principale e mazzo Guai (3.3), il primo giocatore si estrae col generatore
  // prima della distribuzione (3.6), poi 5 carte a testa "una alla volta in ordine di posto partendo dal primo
  // giocatore" (3.5). Il test ricostruisce la sequenza col generatore del motore.
  const casi = [
    { n: 2, seme: 3 },
    { n: 3, seme: 17 },
    { n: 4, seme: 99 },
    { n: 4, seme: 123456 },
  ];
  it.each(casi)('$n giocatori, seme $seme: carte date una alla volta dal primo giocatore in ordine di posto', ({ n, seme }) => {
    const giocatori = Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, nome: `P${i + 1}`, pecora: PECORE[i]! }));
    const s = nuovaPartita({ giocatori, seme });

    const gen = { rng: seme >>> 0 };
    const mazzo = creaMazzoPrincipale(n);
    mescola(gen, mazzo);
    const guai = creaMazzoGuai();
    mescola(gen, guai);
    const primo = giocatori[intero(gen, n)]!.id;
    expect(s.primoGiocatore).toBe(primo);

    const inizio = giocatori.findIndex((g) => g.id === primo);
    const ordine = giocatori.map((_, k) => giocatori[(inizio + k) % n]!.id);
    const attese: Record<IdGiocatore, IdCarta[]> = Object.fromEntries(ordine.map((id) => [id, []]));
    for (let giro = 0; giro < 5; giro++) for (const id of ordine) attese[id]!.push(mazzo.shift()!);

    for (const id of ordine) expect(gioc(s, id).mano, id).toEqual(attese[id]);
    expect(s.mazzo).toEqual(mazzo);
    expect(s.datiRound.guaio).toBe(guai[0]);
    expect(s.mazzoGuai).toEqual(guai.slice(1));
  });
});

// ─── Round senza Guaio con 0 o 1 partecipanti ────────────────────────────────

describe('Round senza Guaio con pochi partecipanti (specifica 4.6, 4.8, D23, D27)', () => {
  it('nessun partecipante e nessun Guaio: dalla rivelazione si va dritti a fine_round, senza Guaio in fondo', () => {
    let s = scenario({
      guaio: null,
      mazzoGuai: [],
      mazzo: [],
      ultimoRound: 2,
      mani: { g1: ['beee-no'], g2: ['pernacchia'], g3: ['belato-di-gruppo'] },
    });
    s = prosegui(s);
    fase(s, 'rivelazione');
    expect(s.datiRound.partecipanti).toEqual([]);
    const prima = s;
    s = prosegui(s);
    fase(s, 'fine_round');
    expect(inAttesaDi(s)).toEqual({ sistema: true, giocatori: [] });
    expect(nuovi(prima, s, 'guaio_in_fondo')).toEqual([]);
    expect(nuovi(prima, s, 'dado_lanciato')).toEqual([]);
    expect(s.mazzoGuai).toEqual([]);
    expect(s.esito).toBeNull();
    // round 1 < ultimoRound 2: la partita continua con l'ultimo round
    s = prosegui(s);
    fase(s, 'ultimo_round');
    expect(s.round).toBe(2);
  });

  it('un solo partecipante e nessun Guaio: lancia il dado e poi fine_round, senza guaio_al_peggiore', () => {
    let s = scenario({
      guaio: null,
      mazzoGuai: [],
      mazzo: [],
      ultimoRound: 2,
      mani: { g1: ['carriola'], g2: ['beee-no'], g3: ['pernacchia'] },
    });
    s = prosegui(s);
    expect(s.datiRound.partecipanti).toEqual(['g1']);
    s = prosegui(scegli(s, { g1: ['carriola'] }));
    fase(s, 'dado');
    expect(s.datiRound.lanciatori).toEqual(['g1']);
    const prima = s;
    s = lancia(s);
    fase(s, 'fine_round');
    expect(gioc(s, 'g1').agnellini).toBe(6);
    expect(nuovi(prima, s, 'guaio_in_fondo')).toEqual([]);
    expect(nuovi(prima, s, 'guaio_preso')).toEqual([]);
  });
});

// ─── Partecipanti fuori dal round ────────────────────────────────────────────

describe('Due partecipanti pari con altri fuori dal round (specifica 4.6, D23, D34)', () => {
  it('a 4 giocatori, 2 partecipanti pari sono "tutti pari": niente dado, Guaio in fondo', () => {
    let s = scenario({
      giocatori: 4,
      guaio: 'tosatura-a-sorpresa',
      mazzo: [],
      ultimoRound: 2,
      agnellini: { g3: 0, g4: 1 },
      mani: { g1: ['balla-di-fieno'], g2: ['balla-di-fieno'], g3: ['beee-no'], g4: ['pernacchia'] },
    });
    s = prosegui(s);
    expect(s.datiRound.partecipanti).toEqual(['g1', 'g2']);
    s = prosegui(scegli(s, { g1: ['balla-di-fieno'], g2: ['balla-di-fieno'] }));
    // la finestra dei Belati di punteggio aspetta anche chi è fuori (D34)
    expect([...fase(s, 'belati_punteggio').inAttesa].sort()).toEqual(['g1', 'g2', 'g3', 'g4']);
    s = chiudiPunteggio(s);
    expect(s.datiRound.piuAlti).toEqual([]);
    expect(s.datiRound.piuBassi).toEqual([]);
    expect(fase(s, 'guaio_al_peggiore')).toMatchObject({ destinatario: null, spareggio: null });
    const prima = s;
    s = prosegui(s);
    fase(s, 'fine_round');
    expect(nuovi(prima, s, 'guaio_in_fondo')).toHaveLength(1);
    expect(s.mazzoGuai[s.mazzoGuai.length - 1]).toBe(prima.datiRound.guaio);
    for (const id of ['g1', 'g2', 'g3', 'g4']) expect(gioc(s, id).angolo).toEqual([]);
  });
});

// ─── Ripescate con eliminati ─────────────────────────────────────────────────

describe('Ripescate con giocatori eliminati (specifica 4.2, D32, D33)', () => {
  it('a 4 giocatori l\'ordine parte dal primo giocatore e salta gli eliminati; chi trova il mazzo vuoto resta fuori', () => {
    const perG4 = ['pernacchia', 'pernacchia', 'beee-no', 'carriola', 'mondo-alla-rovescia'];
    const perG1 = ['finta-svenuta', 'balla-di-fieno', 'beee-no', 'beee-no', 'faccio-finta-di-niente'];
    const prima = scenario({
      giocatori: 4,
      primoGiocatore: 'g4',
      eliminati: ['g2'],
      agnellini: { g2: 0 },
      guaio: 'tosatura-a-sorpresa',
      mani: { g1: ['belato-di-gruppo'], g3: ['belato-di-gruppo'], g4: ['belato-di-gruppo'] },
      mazzo: [...perG4, ...perG1],
    });
    const s = prosegui(prima);
    expect(nuovi(prima, s, 'ripescata').map((e) => e.giocatore)).toEqual(['g4', 'g1']);
    expect(nuovi(prima, s, 'fuori_dal_round').map((e) => e.giocatore)).toEqual(['g3']);
    expect(gioc(s, 'g4').mano.map(tipoDi).sort()).toEqual([...perG4].sort());
    expect(gioc(s, 'g1').mano.map(tipoDi).sort()).toEqual([...perG1].sort());
    expect(gioc(s, 'g3').mano.map(tipoDi)).toEqual(['belato-di-gruppo']);
    expect(gioc(s, 'g2').mano).toEqual([]);
    expect(s.datiRound.partecipanti).toEqual(['g1', 'g4']);
    expect(s.ultimoRound).toBe(2);
    expect(Object.keys(fase(s, 'scelta').scelte)).toEqual(['g1', 'g4']);
  });
});

// ─── Pescate di fine round ───────────────────────────────────────────────────

describe('Pescate di fine round (brief 3 passo 12; specifica 4.12, D33)', () => {
  it('chi ha già più di 5 carte non pesca; gli altri ripescano fino a 5', () => {
    let s = scenario({
      guaio: 'tosatura-a-sorpresa',
      mani: {
        g1: ['carriola', 'balla-di-fieno', 'balla-di-fieno', 'balla-di-fieno', 'coperta-di-lana', 'coperta-di-lana', 'coperta-di-lana'],
        g2: ['balla-di-fieno'],
        g3: ['sasso-comodo'],
      },
      mazzo: Array.from({ length: 11 }, () => 'corona-di-margherite'),
    });
    s = prosegui(s);
    s = prosegui(scegli(s, { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['sasso-comodo'] }));
    s = lancia(chiudiPunteggio(s));
    s = prosegui(s);
    expect(fase(s, 'belati_salvataggio').destinatario).toBe('g3');
    s = concludi(passa(s, 'g3'), 'g3');
    fase(s, 'fine_round');
    expect(gioc(s, 'g1').mano).toHaveLength(6);
    expect(gioc(s, 'g2').mano).toHaveLength(5);
    expect(gioc(s, 'g3').mano).toHaveLength(5);
    expect(s.mazzo).toHaveLength(1);
    expect(s.ultimoRound).toBeNull();
  });

  /**
   * Round 1 a 3 giocatori con g1 primo giocatore: g1 (Sasso comodo, 2) è il più basso e prende Insonnia (Drammi),
   * che con le due Drammi nell'Angolo lo elimina. g2 Carriola 8 − 1 (Brontolana, malus Drammi) = 7 lancia il dado;
   * g3 Balla di fieno 5 + 1 (Sospirella, bonus Drammi) = 6. Il mazzo ha solo 3 carte e il mazzo Guai è vuoto.
   */
  function roundConPrimoEliminato(): Stato {
    let s = scenario({
      primoGiocatore: 'g1',
      guaio: 'insonnia',
      mazzoGuai: [],
      angoli: { g1: ['crisi-esistenziale', 'specchio-impietoso'] },
      mani: { g1: ['sasso-comodo'], g2: ['carriola'], g3: ['balla-di-fieno'] },
      mazzo: ['corona-di-margherite', 'corona-di-margherite', 'ombrello-bucato'],
    });
    s = prosegui(s);
    s = prosegui(scegli(s, { g1: ['sasso-comodo'], g2: ['carriola'], g3: ['balla-di-fieno'] }));
    s = chiudiPunteggio(s);
    expect(s.datiRound.lanciatori).toEqual(['g2']);
    expect(s.datiRound.piuBassi).toEqual(['g1']);
    s = prosegui(lancia(s));
    s = concludi(passa(s, 'g1'), 'g1');
    expect(gioc(s, 'g1').eliminato).toBe(true);
    fase(s, 'fine_round');
    return s;
  }

  it('se il primo giocatore è stato eliminato nel round, pescano gli altri a partire dal successivo', () => {
    const s = roundConPrimoEliminato();
    expect(s.primoGiocatore).toBe('g1');
    // g2 pesca per primo e prende tutte e 3 le carte; g3 resta senza (brief "Casi limite")
    expect(gioc(s, 'g2').mano.map(tipoDi).sort()).toEqual(['corona-di-margherite', 'corona-di-margherite', 'ombrello-bucato']);
    expect(gioc(s, 'g3').mano).toEqual([]);
    expect(gioc(s, 'g1').mano).toEqual([]);
    expect(s.mazzo).toEqual([]);
    expect(s.ultimoRound).toBe(2);
    const pescate = s.eventi.filter((e): e is EventoDi<'pescate'> => e.tipo === 'pescate');
    expect(pescate.map((e) => e.giocatore)).toEqual(['g2']);
  });

  it('ultimo round: al prosegui da ultimo_round si rimescolano i Guai fuori gioco, poi si gioca fino al mazzo finito (4.1, 9.3, D27, D28)', () => {
    let s = roundConPrimoEliminato();
    expect(s.mazzoGuai).toEqual([]);
    const fuori = [...s.guaiFuoriGioco];
    expect(fuori).toHaveLength(3);

    let prima = s;
    s = prosegui(s);
    fase(s, 'ultimo_round');
    expect(s.round).toBe(2);
    expect(s.primoGiocatore).toBe('g2');
    expect(s.datiRound.guaio).toBeNull();
    expect(nuovi(prima, s, 'guai_rimescolati')).toEqual([]);

    prima = s;
    s = prosegui(s);
    fase(s, 'guaio');
    expect(nuovi(prima, s, 'guai_rimescolati')).toEqual([expect.objectContaining({ quanti: 3 })]);
    const guaio = s.datiRound.guaio;
    expect(guaio).not.toBeNull();
    expect(fuori).toContain(guaio);
    expect([...s.mazzoGuai, guaio].sort()).toEqual([...fuori].sort());
    expect(s.guaiFuoriGioco).toEqual([]);

    // g3 non ha carte e il mazzo è vuoto: resta fuori; g2 gioca da solo, lancia e il Guaio va in fondo (D23, D32).
    s = prosegui(s);
    expect(s.datiRound.partecipanti).toEqual(['g2']);
    s = prosegui(scegli(s, { g2: ['corona-di-margherite'] }));
    s = lancia(s);
    expect(fase(s, 'guaio_al_peggiore')).toMatchObject({ destinatario: null, spareggio: null });
    prima = s;
    s = prosegui(s);
    expect(nuovi(prima, s, 'guaio_in_fondo')).toHaveLength(1);
    expect(s.esito).toEqual({ modo: 'mazzo_finito', vincitori: ['g2'] });
    expect(s.fase).toEqual({ nome: 'fine_partita' });
    expect(inAttesaDi(s)).toEqual({ sistema: false, giocatori: [] });
  });
});

// ─── Ultimo round particolare ────────────────────────────────────────────────

describe('Ultimo round particolare (brief 3 "Come si vince" 3 e "Casi limite"; specifica 4.1, 4.8, 9.3)', () => {
  it('senza partecipanti: il Guaio va in fondo e la partita finisce subito a fine_round per mazzo finito', () => {
    let s = scenario({
      round: 3,
      ultimoRound: 3,
      mazzo: [],
      guaio: 'insonnia',
      agnellini: { g1: 4, g2: 6, g3: 5 },
      mani: { g1: ['beee-no'], g2: ['pernacchia'], g3: [] },
    });
    s = prosegui(s);
    fase(s, 'rivelazione');
    s = prosegui(s);
    expect(fase(s, 'guaio_al_peggiore')).toMatchObject({ destinatario: null, spareggio: null });
    const prima = s;
    s = prosegui(s);
    expect(nuovi(prima, s, 'guaio_in_fondo')).toHaveLength(1);
    expect(s.mazzoGuai[s.mazzoGuai.length - 1]).toBe(prima.datiRound.guaio);
    expect(s.esito).toEqual({ modo: 'mazzo_finito', vincitori: ['g2'] });
    // le carte rimaste in mano non cambiano: nessuno ha giocato
    expect(gioc(s, 'g1').mano.map(tipoDi)).toEqual(['beee-no']);
  });

  it('senza Guai disponibili: ultimo_round scopre un Guaio nullo e il round si chiude senza Guaio al peggiore', () => {
    // Round 1 senza Guaio; la pescata di fine round (1 carta a testa) esaurisce il mazzo e annuncia il round 2
    // come ultimo.
    let s = scenario({
      guaio: null,
      mazzoGuai: [],
      mani: {
        g1: ['carriola', 'pernacchia', 'pernacchia', 'pernacchia', 'mondo-alla-rovescia'],
        g2: ['balla-di-fieno', 'belato-di-gruppo', 'belato-di-gruppo', 'belato-di-gruppo', 'mondo-alla-rovescia'],
        g3: ['sasso-comodo', 'faccio-finta-di-niente', 'faccio-finta-di-niente', 'finta-svenuta', 'finta-svenuta'],
      },
      mazzo: ['corona-di-margherite', 'balla-di-fieno', 'trifoglio-qualunque'],
    });
    s = prosegui(s);
    s = prosegui(scegli(s, { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['sasso-comodo'] }));
    s = lancia(chiudiPunteggio(s));
    fase(s, 'fine_round');
    expect(s.ultimoRound).toBe(2);
    s = prosegui(s);
    fase(s, 'ultimo_round');
    let prima = s;
    s = prosegui(s);
    fase(s, 'guaio');
    expect(s.datiRound.guaio).toBeNull();
    expect(nuovi(prima, s, 'guaio_rivelato')).toEqual([expect.objectContaining({ carta: null })]);
    // Round 2: ognuno ha 1 carta (g1 Corona 9, g2 Balla 5, g3 Trifoglio 4).
    s = prosegui(s);
    expect(s.datiRound.partecipanti).toEqual(['g1', 'g2', 'g3']);
    s = prosegui(scegli(s, { g1: ['corona-di-margherite'], g2: ['balla-di-fieno'], g3: ['trifoglio-qualunque'] }));
    for (const id of ['g1', 'g2', 'g3']) expect((s.datiRound.punteggi[id] ?? []).map((r) => r.tipo)).toEqual(['valore']);
    s = chiudiPunteggio(s);
    expect(s.datiRound.piuBassi).toEqual(['g3']);
    prima = s;
    s = lancia(s);
    expect(nuovi(prima, s, 'guaio_preso')).toEqual([]);
    expect(s.esito).toEqual({ modo: 'mazzo_finito', vincitori: ['g1'] });
  });
});

// ─── Nuovo round ─────────────────────────────────────────────────────────────

describe('Inizio di un nuovo round (specifica 4.1)', () => {
  it('datiRound azzerato, pila e finestra vuote, primo giocatore ruotato, Guaio nuovo', () => {
    let s = scenario({
      guaio: 'tosatura-a-sorpresa',
      mazzoGuai: ['spuntatina', 'rasatura-integrale'],
      mani: { g1: ['carriola', 'beee-no'], g2: ['balla-di-fieno', 'belato-di-gruppo'], g3: ['sasso-comodo'] },
    });
    s = prosegui(s);
    s = prosegui(scegli(s, { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['sasso-comodo'] }));
    // un Belato di punteggio e un Beee-NO! finiscono sul tavolo
    s = applica(s, { tipo: 'giocaBelato', giocatore: 'g2', carta: 'belato-di-gruppo#1', bersaglio: 'g2' });
    s = applica(s, { tipo: 'giocaBelato', giocatore: 'g1', carta: 'beee-no#1', voce: s.pila[0]!.id });
    s = lancia(chiudiPunteggio(nessunaReazione(s)));
    s = prosegui(s);
    s = concludi(passa(s, 'g3'), 'g3');
    fase(s, 'fine_round');
    expect(s.datiRound.tavolo).toEqual([]);
    expect(s.scarti).toEqual(expect.arrayContaining(['carriola#1', 'balla-di-fieno#1', 'sasso-comodo#1', 'belato-di-gruppo#1', 'beee-no#1']));

    const prima = s;
    s = prosegui(s);
    fase(s, 'guaio');
    expect(s.round).toBe(2);
    expect(s.primoGiocatore).toBe('g2');
    expect(s.datiRound).toEqual({
      numero: 2,
      guaio: 'spuntatina#1',
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
    });
    expect(s.pila).toEqual([]);
    expect(s.finestra).toBeNull();
    expect(s.richiesta).toBeNull();
    expect(nuovi(prima, s, 'round_iniziato')).toEqual([expect.objectContaining({ round: 2, ultimo: false })]);
  });
});

// ─── Nessuno stallo in scenari estremi ───────────────────────────────────────

/** Generatore locale con seme, indipendente da quello del motore. */
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

function rimescola<T>(rnd: () => number, xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Scenario casuale "estremo": mazzo pieno di Belati, mani corte, pochi Guai, Angoli carichi, Gregge qualsiasi. */
function scenarioEstremo(rnd: () => number): Stato {
  const n = 2 + Math.floor(rnd() * 3);
  const ids = Array.from({ length: n }, (_, i) => `g${i + 1}`);
  const carte = rimescola(rnd, creaMazzoPrincipale(n));
  const belati = carte.filter((c) => !eTrovata(c));
  const trovate = carte.filter((c) => eTrovata(c));
  const quanteTrovate = Math.floor(rnd() * 12);
  const mazzo = rimescola(rnd, [...belati, ...trovate.splice(0, quanteTrovate)]);
  const mani: Record<IdGiocatore, IdCarta[]> = {};
  for (const id of ids) {
    const mano: IdCarta[] = [];
    for (let k = Math.floor(rnd() * 6); k > 0; k--) {
      const c = (rnd() < 0.5 ? mazzo : trovate).shift();
      if (c) mano.push(c);
    }
    mani[id] = mano;
  }
  const guai = rimescola(rnd, creaMazzoGuai());
  const angoli: Record<IdGiocatore, IdCarta[]> = {};
  for (const id of ids) angoli[id] = guai.splice(0, Math.floor(rnd() * 3));
  const mazzoGuai = guai.splice(0, Math.floor(rnd() * 3));
  const guaio = rnd() < 0.2 ? null : (guai.shift() ?? null);
  const guaiFuoriGioco = rnd() < 0.3 ? guai.splice(0, 2) : [];
  const agnellini: Record<IdGiocatore, number> = {};
  for (const id of ids) agnellini[id] = Math.floor(rnd() * 9);
  return scenario({
    giocatori: n,
    mani,
    mazzo,
    mazzoGuai,
    guaio,
    guaiFuoriGioco,
    angoli,
    agnellini,
    primoGiocatore: ids[Math.floor(rnd() * n)]!,
    ultimoRound: mazzo.length === 0 ? 1 : null,
  });
}

/** Controlli sul passaggio prima → dopo; restituisce i problemi trovati. */
function problemiDelPasso(prima: Stato, dopo: Stato): string[] {
  const trovati: string[] = [];
  const p = (messaggio: string): void => {
    trovati.push(messaggio);
  };
  if (dopo.esito) {
    if (dopo.esito.modo === 'mazzo_finito' && dopo.round !== dopo.ultimoRound) p('mazzo finito fuori dall\'ultimo round');
    return trovati;
  }
  // 11: c'è sempre qualcuno da aspettare
  const attesa = inAttesaDi(dopo);
  if (!attesa.sistema && attesa.giocatori.length === 0) p(`stallo in ${dopo.fase.nome}`);
  // 9.3: l'ultimo round è annunciato appena il mazzo è vuoto
  if (dopo.mazzo.length === 0 && dopo.ultimoRound === null) p('mazzo vuoto senza ultimo round');
  // 4.2: partecipa chi ha una Trovata; resta fuori solo chi non ne ha a mazzo vuoto
  if (dopo.fase.nome === 'scelta') {
    for (const g of dopo.giocatori) {
      if (g.eliminato) continue;
      const partecipa = dopo.datiRound.partecipanti.includes(g.id);
      if (partecipa !== g.mano.some(eTrovata)) p(`${g.id}: partecipante ${partecipa} incoerente con la mano`);
      if (!partecipa && dopo.mazzo.length > 0) p(`${g.id} fuori dal round con il mazzo non vuoto`);
    }
  }
  // 4.12: a fine round tutti hanno almeno 5 carte, a meno che il mazzo sia finito
  if (dopo.fase.nome === 'fine_round') {
    for (const g of dopo.giocatori) {
      if (!g.eliminato && g.mano.length < 5 && dopo.mazzo.length > 0) p(`${g.id} con ${g.mano.length} carte a fine round`);
    }
  }
  // 4.1: nuovo round, primo giocatore ruotato, ultimo_round solo per l'ultimo
  if (prima.fase.nome === 'fine_round' && dopo.round === prima.round + 1) {
    if (dopo.primoGiocatore !== successivo(prima, prima.primoGiocatore)) p('primo giocatore non ruotato');
    if ((dopo.round === dopo.ultimoRound) !== (dopo.fase.nome === 'ultimo_round')) p('fase ultimo_round incoerente');
  }
  // 4.4, D18: finestra dei Belati di punteggio solo con almeno 2 partecipanti
  if (dopo.fase.nome === 'belati_punteggio' && dopo.datiRound.partecipanti.length < 2) p('belati_punteggio con meno di 2 partecipanti');
  // 4.8, D27: niente Guaio al peggiore senza Guaio
  if (dopo.fase.nome === 'guaio_al_peggiore' && dopo.datiRound.guaio === null) p('guaio_al_peggiore senza Guaio');
  // 4.6: i lanciatori sono esattamente i più alti e nessuno è anche tra i più bassi
  if (dopo.fase.nome === 'dado') {
    const alti = [...dopo.datiRound.piuAlti].sort();
    if (JSON.stringify([...dopo.datiRound.lanciatori].sort()) !== JSON.stringify(alti)) p('lanciatori diversi dai più alti');
    if (dopo.datiRound.piuBassi.some((id) => alti.includes(id))) p('un giocatore è sia più alto sia più basso');
  }
  // D34: chi prende il Guaio è un partecipante
  if ((dopo.fase.nome === 'belati_salvataggio' || dopo.fase.nome === 'consolazione') && !dopo.datiRound.partecipanti.includes(dopo.fase.destinatario)) {
    p('il Guaio va a chi non partecipa');
  }
  return trovati;
}

describe('Nessuno stallo e fasi coerenti in scenari estremi (specifica 4, 9.3, 11; brief 8 fase 2 "nessuno stallo")', () => {
  it('300 scenari con mazzo pieno di Belati e pochi Guai arrivano alla fine; l\'ultimo round è quello dopo l\'ultima pescata', () => {
    const problemi: string[] = [];
    for (let k = 0; k < 300; k++) {
      const rnd = generatore(9000 + k);
      let s = scenarioEstremo(rnd);
      let roundMazzoFinito: number | null = s.mazzo.length === 0 ? 0 : null;
      let passi = 0;
      while (s.esito === null && passi < 8000 && problemi.length < 20) {
        const azioni: Azione[] = [...azioniPossibili(s, 'sistema')];
        const chi = rnd() < 0.1 ? s.giocatori.map((g) => g.id) : inAttesaDi(s).giocatori;
        for (const id of chi) azioni.push(...azioniPossibili(s, id));
        if (azioni.length === 0) {
          problemi.push(`scenario ${k}: nessuna azione possibile in ${s.fase.nome}`);
          break;
        }
        const azione = azioni[Math.floor(rnd() * azioni.length)]!;
        const r = tentaApplica(s, azione);
        if (!r.ok) {
          problemi.push(`scenario ${k}: azione elencata rifiutata ${JSON.stringify(azione)}: ${r.errore.message}`);
          break;
        }
        for (const m of problemiDelPasso(s, r.stato)) problemi.push(`scenario ${k}, passo ${passi} (${s.fase.nome} → ${r.stato.fase.nome}): ${m}`);
        if (roundMazzoFinito === null && r.stato.mazzo.length === 0) roundMazzoFinito = s.round;
        s = r.stato;
        passi++;
      }
      if (s.esito === null) problemi.push(`scenario ${k}: partita non finita in ${s.fase.nome}`);
      // 9.3, D31: l'ultima carta pescata nel round R ⇒ si gioca ancora il round R + 1 e poi si chiude
      if (s.esito?.modo === 'mazzo_finito' && roundMazzoFinito !== null && roundMazzoFinito > 0 && s.round !== roundMazzoFinito + 1) {
        problemi.push(`scenario ${k}: mazzo finito al round ${roundMazzoFinito}, partita chiusa al round ${s.round}`);
      }
    }
    expect(problemi).toEqual([]);
  }, 120_000);
});
