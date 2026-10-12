// Guaio al peggiore, Belato Finale, Belati di salvataggio, consolazione, Visita di Garzina, mazzo Guai.
// Regole: brief sezione 3 ("Svolgimento di un round" passi 8–12, "Eliminazione", "Parità", "Casi limite")
// e sezione 4 (Belati); docs/motore.md sezioni 4.1, 4.6, 4.8–4.12, 5, 7, 8, 9, 10, 11
// e decisioni D1, D2, D8, D9, D23–D30, D34, D36, D37, D39, D40.
import { describe, expect, it } from 'vitest';
import {
  applica,
  azioniPossibili,
  configPer,
  defCarta,
  eFaseAutomatica,
  ErroreRegola,
  inAttesaDi,
  vistaPer,
  type Azione,
  type Evento,
  type Fase,
  type IdCarta,
  type IdGiocatore,
  type IdTipoCarta,
  type Stato,
  type StatoGiocatore,
} from '../src';
import {
  carta,
  chiudiPunteggio,
  conFaccia,
  nessunaReazione,
  prosegui,
  rinunciaTutti,
  scegli,
  scenario,
  totale,
  type OpzioniScenario,
} from './aiuti';

// ─── Aiuti locali ────────────────────────────────────────────────────────────

/** Tosatura a Sorpresa come Guaio attivo: nessun tratto, i totali sono i soli valori stampati. */
const TOSATURA = 'tosatura-a-sorpresa';

type Scelte = Record<IdGiocatore, IdTipoCarta[]>;
type FaseDi<N extends Fase['nome']> = Extract<Fase, { nome: N }>;
type EventoDi<T extends Evento['tipo']> = Extract<Evento, { tipo: T }>;

function fase<N extends Fase['nome']>(s: Stato, nome: N): FaseDi<N> {
  expect(s.fase.nome).toBe(nome);
  return s.fase as FaseDi<N>;
}

function giocatore(s: Stato, id: IdGiocatore): StatoGiocatore {
  const g = s.giocatori.find((x) => x.id === id);
  if (!g) throw new Error(`giocatore ${id} inesistente`);
  return g;
}

const ordinati = (ids: readonly string[]): string[] => [...ids].sort();

/** Eventi di un tipo prodotti a partire dal numero di sequenza `da`. */
function eventi<T extends Evento['tipo']>(s: Stato, da: number, tipo: T): EventoDi<T>[] {
  return s.eventi.filter((e): e is EventoDi<T> => e.seq >= da && e.tipo === tipo);
}

/** Prima istanza di quel tipo in una lista di carte (Angolo, mazzo Guai, mano…). */
function istanza(lista: readonly IdCarta[], tipo: IdTipoCarta): IdCarta {
  const c = lista.find((x) => x.startsWith(`${tipo}#`));
  if (!c) throw new Error(`nessuna istanza di ${tipo} in [${lista.join(', ')}]`);
  return c;
}

function guaioAttivo(s: Stato): IdCarta {
  const g = s.datiRound.guaio;
  if (g === null) throw new Error('nessun Guaio attivo');
  return g;
}

/** L'azione è rifiutata con ErroreRegola e lo stato di partenza resta intatto (specifica 1). */
function verificaRifiuto(s: Stato, azione: Azione): void {
  const copia = structuredClone(s);
  expect(() => applica(s, azione), JSON.stringify(azione)).toThrow(ErroreRegola);
  expect(s).toEqual(copia);
}

const passa = (s: Stato, chi: IdGiocatore): Stato => applica(s, { tipo: 'passa', giocatore: chi });

function giocaBelato(
  s: Stato,
  chi: IdGiocatore,
  tipo: IdTipoCarta,
  extra: { bersaglio?: IdGiocatore; guaio?: IdCarta } = {},
): Stato {
  return applica(s, { tipo: 'giocaBelato', giocatore: chi, carta: carta(s, chi, tipo), ...extra });
}

/** Beee-NO! di `chi` contro la cima della pila. */
function beeeNo(s: Stato, chi: IdGiocatore): Stato {
  const cima = s.pila[s.pila.length - 1];
  if (!cima) throw new Error('pila vuota');
  return applica(s, { tipo: 'giocaBelato', giocatore: chi, carta: carta(s, chi, 'beee-no'), voce: cima.id });
}

const sceltaFinale = (s: Stato, chi: IdGiocatore, tipo: IdTipoCarta): Stato =>
  applica(s, { tipo: 'sceltaFinale', giocatore: chi, carta: carta(s, chi, tipo) });

const concludi = (s: Stato, chi: IdGiocatore, scarta: IdCarta | null = null): Stato =>
  applica(s, { tipo: 'concludiConsolazione', giocatore: chi, scarta });

/** Dallo scenario a dopo gli effetti (rinunciando a tutti): di solito 'belati_punteggio'. */
function finoAlPunteggio(o: OpzioniScenario, scelte: Scelte): Stato {
  let s = scenario(o);
  fase(s, 'guaio');
  s = prosegui(s);
  fase(s, 'scelta');
  s = scegli(s, scelte);
  fase(s, 'rivelazione');
  s = prosegui(s);
  if (s.fase.nome === 'effetti') s = rinunciaTutti(s);
  return s;
}

/** Ogni lanciatore tira "Pascolo piccolo" (+3 dal Gregge, nessun effetto se il Gregge è vuoto) e nessuno reagisce. */
function tiraDadi(s: Stato): Stato {
  for (let giri = 0; giri < 10; giri++) {
    const f = s.fase;
    if (f.nome !== 'dado') return s;
    const chi = s.datiRound.lanciatori[f.indice];
    if (chi === undefined) throw new Error('lanciatore mancante');
    s = nessunaReazione(applica(conFaccia(s, 'pascolo_piccolo'), { tipo: 'lanciaDado', giocatore: chi }));
  }
  throw new Error('troppi lanci');
}

/** Dallo scenario a "dopo il dado" (sez. 4.8): di solito 'guaio_al_peggiore'. */
function dopoIlDado(o: OpzioniScenario, scelte: Scelte): Stato {
  let s = finoAlPunteggio(o, scelte);
  if (s.fase.nome === 'belati_punteggio') s = chiudiPunteggio(s);
  return tiraDadi(s);
}

// Round di base a 3: g1 Carriola (8) lancia il dado, g3 Coperta di lana (6), g2 Balla di fieno (5) è il più basso.
const BASE: Scelte = { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['coperta-di-lana'] };

function maniBase(extra: Scelte = {}): Scelte {
  return {
    g1: ['carriola', ...(extra['g1'] ?? [])],
    g2: ['balla-di-fieno', ...(extra['g2'] ?? [])],
    g3: ['coperta-di-lana', ...(extra['g3'] ?? [])],
  };
}

function alGuaioAlPeggiore(extra: Scelte = {}, o: OpzioniScenario = {}): Stato {
  const s = dopoIlDado({ guaio: TOSATURA, ...o, mani: maniBase(extra) }, BASE);
  expect(s.fase).toEqual({ nome: 'guaio_al_peggiore', destinatario: 'g2', spareggio: null });
  return s;
}

function alSalvataggio(extra: Scelte = {}, o: OpzioniScenario = {}): Stato {
  const s = prosegui(alGuaioAlPeggiore(extra, o));
  expect(s.fase).toEqual({ nome: 'belati_salvataggio', destinatario: 'g2' });
  return s;
}

function allaConsolazione(extra: Scelte = {}, o: OpzioniScenario = {}): Stato {
  const s = passa(alSalvataggio(extra, o), 'g2');
  expect(s.fase).toEqual({ nome: 'consolazione', destinatario: 'g2' });
  return s;
}

// Round con spareggio a 3: g1 Carriola (8) lancia il dado, g2 e g3 pari a 5 con la Balla di fieno.
const PARI: Scelte = { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['balla-di-fieno'] };

function maniPari(extra: Scelte = {}): Scelte {
  return {
    g1: ['carriola', ...(extra['g1'] ?? [])],
    g2: ['balla-di-fieno', ...(extra['g2'] ?? [])],
    g3: ['balla-di-fieno', ...(extra['g3'] ?? [])],
  };
}

/** Fase 'guaio_al_peggiore' con g2 e g3 pari al minimo. */
function alloSpareggio(extra: Scelte = {}, o: OpzioniScenario = {}): Stato {
  const s = dopoIlDado({ guaio: TOSATURA, ...o, mani: maniPari(extra) }, PARI);
  const f = fase(s, 'guaio_al_peggiore');
  expect(f.destinatario).toBeNull();
  expect(ordinati(f.spareggio ?? [])).toEqual(['g2', 'g3']);
  return s;
}

function alBelatoFinale(extra: Scelte = {}, o: OpzioniScenario = {}): Stato {
  const s = prosegui(alloSpareggio(extra, o));
  fase(s, 'belato_finale');
  return s;
}

// ─── Catalogo ────────────────────────────────────────────────────────────────

describe('Belati di salvataggio e Visita di Garzina nel catalogo (brief sez. 4; D37)', () => {
  it('Faccio finta di niente e Finta svenuta si giocano nel salvataggio, Garzina dopo aver preso il Guaio', () => {
    expect(defCarta('faccio-finta-di-niente')).toMatchObject({
      famiglia: 'belato',
      effetto: 'guaio_in_fondo',
      quando: 'salvataggio',
      copie: 2,
    });
    expect(defCarta('finta-svenuta')).toMatchObject({ famiglia: 'belato', effetto: 'devia_guaio', quando: 'salvataggio', copie: 2 });
    expect(defCarta('visita-di-garzina')).toMatchObject({ famiglia: 'belato', effetto: 'cura', quando: 'dopo_guaio', copie: 2 });
  });
});

// ─── Guaio al peggiore e consolazione ────────────────────────────────────────

describe('Il più basso prende il Guaio (brief sez. 3 passi 8–11; specifica 4.8, 4.10, 4.11)', () => {
  it('guaio_al_peggiore è automatica con un solo destinatario; prosegui apre il salvataggio al solo destinatario (4.8, 11, D1, D2)', () => {
    const s0 = alGuaioAlPeggiore();
    expect(s0.datiRound.piuAlti).toEqual(['g1']);
    expect(s0.datiRound.piuBassi).toEqual(['g2']);
    expect(s0.datiRound.lanciatori).toEqual(['g1']);
    expect(eFaseAutomatica('guaio_al_peggiore')).toBe(true);
    expect(inAttesaDi(s0)).toEqual({ sistema: true, giocatori: [] });
    expect(azioniPossibili(s0, 'sistema')).toContainEqual({ tipo: 'prosegui' });
    verificaRifiuto(s0, { tipo: 'passa', giocatore: 'g2' });

    const guaio = guaioAttivo(s0);
    const s = prosegui(s0);
    expect(s.fase).toEqual({ nome: 'belati_salvataggio', destinatario: 'g2' });
    expect(inAttesaDi(s)).toEqual({ sistema: false, giocatori: ['g2'] });
    // Il Guaio non è ancora preso.
    expect(s.datiRound.guaio).toBe(guaio);
    expect(s.datiRound.presoDa).toBeNull();
    expect(giocatore(s, 'g2').angolo).toEqual([]);
  });

  it("passa: il Guaio va in coda all'Angolo, +1 agnellino dal Gregge, eventi guaio_preso e agnellini (4.10, 4.11)", () => {
    const prima = alSalvataggio({}, { angoli: { g2: ['insonnia'] } });
    const guaio = guaioAttivo(prima);
    const seq = prima.prossimoEvento;
    const s = passa(prima, 'g2');

    expect(s.fase).toEqual({ nome: 'consolazione', destinatario: 'g2' });
    expect(giocatore(s, 'g2').angolo).toEqual([...giocatore(prima, 'g2').angolo, guaio]);
    expect(s.datiRound.presoDa).toBe('g2');
    expect(giocatore(s, 'g2').agnellini).toBe(giocatore(prima, 'g2').agnellini + 1);
    expect(s.gregge).toBe(prima.gregge - 1);
    expect(s.mazzoGuai).toEqual(prima.mazzoGuai);
    expect(eventi(s, seq, 'guaio_preso')).toEqual([expect.objectContaining({ giocatore: 'g2', carta: guaio })]);
    expect(eventi(s, seq, 'agnellini')).toContainEqual(expect.objectContaining({ da: 'gregge', a: 'g2', quanti: 1 }));
    expect(inAttesaDi(s)).toEqual({ sistema: false, giocatori: ['g2'] });
    // Gli altri non guadagnano nulla.
    expect(giocatore(s, 'g3').agnellini).toBe(giocatore(prima, 'g3').agnellini);
    expect(giocatore(s, 'g1').agnellini).toBe(giocatore(prima, 'g1').agnellini);
  });

  it('concludiConsolazione con una carta della mano: va negli scarti, nessuna eliminazione, si entra in fine_round (4.11, 4.12)', () => {
    let s = allaConsolazione({ g2: ['pernacchia', 'sasso-comodo'] });
    const scartata = carta(s, 'g2', 'pernacchia');
    const tenuta = carta(s, 'g2', 'sasso-comodo');
    const guaio = guaioAttivo(s);
    const seq = s.prossimoEvento;

    s = concludi(s, 'g2', scartata);
    expect(s.fase.nome).toBe('fine_round');
    expect(s.scarti).toContain(scartata);
    expect(giocatore(s, 'g2').mano).not.toContain(scartata);
    expect(giocatore(s, 'g2').mano).toContain(tenuta);
    expect(giocatore(s, 'g2').eliminato).toBe(false);
    expect(giocatore(s, 'g2').angolo).toEqual([guaio]);
    expect(eventi(s, seq, 'eliminato')).toEqual([]);
    expect(s.esito).toBeNull();
  });

  it('concludiConsolazione senza scarto (scarta = null) lascia la mano com\'è (4.11)', () => {
    let s = allaConsolazione({ g2: ['pernacchia'] });
    const tenuta = carta(s, 'g2', 'pernacchia');
    s = concludi(s, 'g2', null);
    expect(s.fase.nome).toBe('fine_round');
    expect(giocatore(s, 'g2').mano).toContain(tenuta);
    expect(s.scarti).not.toContain(tenuta);
  });

  it('concludiConsolazione rifiutata con una carta non in mano o se non la chiude il destinatario (4.11)', () => {
    const s = allaConsolazione({ g2: ['pernacchia'], g3: ['sasso-comodo'] });
    const guaio = guaioAttivo(s);
    verificaRifiuto(s, { tipo: 'concludiConsolazione', giocatore: 'g2', scarta: carta(s, 'g3', 'sasso-comodo') });
    verificaRifiuto(s, { tipo: 'concludiConsolazione', giocatore: 'g2', scarta: 'carriola#99' });
    verificaRifiuto(s, { tipo: 'concludiConsolazione', giocatore: 'g2', scarta: guaio });
    verificaRifiuto(s, { tipo: 'concludiConsolazione', giocatore: 'g3', scarta: null });
    verificaRifiuto(s, { tipo: 'concludiConsolazione', giocatore: 'g1', scarta: null });
    // Il destinatario invece può.
    expect(() => concludi(s, 'g2', carta(s, 'g2', 'pernacchia'))).not.toThrow();
  });

  it('Gregge vuoto: il Guaio si prende lo stesso ma senza agnellino di consolazione (D39)', () => {
    const prima = alSalvataggio({}, { gregge: 0 });
    const guaio = guaioAttivo(prima);
    const seq = prima.prossimoEvento;
    const s = passa(prima, 'g2');
    expect(s.fase).toEqual({ nome: 'consolazione', destinatario: 'g2' });
    expect(giocatore(s, 'g2').angolo).toEqual([guaio]);
    expect(giocatore(s, 'g2').agnellini).toBe(3);
    expect(s.gregge).toBe(0);
    expect(eventi(s, seq, 'agnellini').filter((e) => e.quanti > 0)).toEqual([]);
  });

  it("l'agnellino di consolazione che riempie l'Ovile fa vincere subito, anche con l'Angolo da eliminazione (D30, sez. 9)", () => {
    // g2 a un posto dall'Ovile pieno (a 3 giocatori).
    const posti = configPer(3).postiOvile;
    const prima = alSalvataggio(
      {},
      { agnellini: { g1: 3, g2: posti - 1, g3: 3 }, angoli: { g2: ['grandine-a-sorpresa', 'fulmine-curioso'] } },
    );
    expect(prima.config.postiOvile).toBe(posti);
    const guaio = guaioAttivo(prima);
    const seq = prima.prossimoEvento;

    const s = passa(prima, 'g2');
    expect(s.fase).toEqual({ nome: 'fine_partita' });
    expect(s.esito).toEqual({ modo: 'ovile_pieno', vincitori: ['g2'] });
    expect(giocatore(s, 'g2').agnellini).toBe(posti);
    expect(giocatore(s, 'g2').angolo).toContain(guaio);
    expect(giocatore(s, 'g2').eliminato).toBe(false);
    expect(eventi(s, seq, 'eliminato')).toEqual([]);
    expect(eventi(s, seq, 'fine_partita')).toEqual([
      expect.objectContaining({ esito: { modo: 'ovile_pieno', vincitori: ['g2'] } }),
    ]);
    verificaRifiuto(s, { tipo: 'concludiConsolazione', giocatore: 'g2', scarta: null });
  });

  it("controllo eliminazione alla fine della consolazione: mano negli scarti, agnellini al Gregge, Angolo fuori gioco (sez. 8)", () => {
    let s = allaConsolazione({ g2: ['pernacchia', 'sasso-comodo'] }, { angoli: { g2: ['grandine-a-sorpresa', 'fulmine-curioso'] } });
    // 2 Meteo + la Tosatura appena presa = 3 dello stesso tipo.
    const angolo = giocatore(s, 'g2').angolo;
    expect(angolo).toHaveLength(3);
    expect(giocatore(s, 'g2').agnellini).toBe(4);
    const mano = giocatore(s, 'g2').mano;
    const scartata = carta(s, 'g2', 'pernacchia');
    const gregge = s.gregge;
    const seq = s.prossimoEvento;

    s = concludi(s, 'g2', scartata);
    const g2 = giocatore(s, 'g2');
    expect(eventi(s, seq, 'eliminato')).toEqual([expect.objectContaining({ giocatore: 'g2' })]);
    expect(g2.eliminato).toBe(true);
    expect(g2.agnellini).toBe(0);
    expect(s.gregge).toBe(gregge + 4);
    expect(g2.angolo).toEqual([]);
    expect(ordinati(s.guaiFuoriGioco)).toEqual(ordinati(angolo));
    for (const c of mano) expect(s.scarti).toContain(c);
    // Restano due pecore: si prosegue, e l'eliminato non pesca a fine round.
    expect(s.esito).toBeNull();
    expect(s.fase.nome).toBe('fine_round');
    expect(g2.mano).toEqual([]);
  });
});

// ─── Tutti pari, nessun più basso ────────────────────────────────────────────

describe('Nessun più basso: Guaio in fondo al mazzo Guai (brief "Parità"; 4.6, 4.8, D23, D36)', () => {
  it('tutti pari (contando i tratti): nessun dado, il Guaio va in ultima posizione del mazzo Guai e il round finisce', () => {
    // Grandine (Meteo): Ricciolo +1, Sospirella −1. 4+1 = 5, 5, 6−1 = 5.
    let s = finoAlPunteggio(
      {
        guaio: 'grandine-a-sorpresa',
        mani: { g1: ['trifoglio-qualunque'], g2: ['balla-di-fieno'], g3: ['coperta-di-lana'] },
      },
      { g1: ['trifoglio-qualunque'], g2: ['balla-di-fieno'], g3: ['coperta-di-lana'] },
    );
    expect([totale(s, 'g1'), totale(s, 'g2'), totale(s, 'g3')]).toEqual([5, 5, 5]);
    const seq = s.prossimoEvento;

    s = chiudiPunteggio(s);
    expect(s.datiRound.piuAlti).toEqual([]);
    expect(s.datiRound.piuBassi).toEqual([]);
    expect(s.datiRound.lanciatori).toEqual([]);
    expect(s.fase).toEqual({ nome: 'guaio_al_peggiore', destinatario: null, spareggio: null });

    const prima = s;
    const guaio = guaioAttivo(s);
    s = prosegui(s);
    expect(s.fase.nome).toBe('fine_round');
    expect(s.mazzoGuai).toEqual([...prima.mazzoGuai, guaio]);
    expect(s.mazzoGuai[s.mazzoGuai.length - 1]).toBe(guaio);
    expect(eventi(s, seq, 'guaio_in_fondo')).toEqual([expect.objectContaining({ carta: guaio })]);
    expect(eventi(s, seq, 'dado_lanciato')).toEqual([]);
    expect(eventi(s, seq, 'guaio_preso')).toEqual([]);
    expect(s.datiRound.presoDa).toBeNull();
    for (const id of ['g1', 'g2', 'g3']) {
      expect(giocatore(s, id).angolo).toEqual([]);
      expect(giocatore(s, id).agnellini).toBe(3);
    }
  });

  it('a 2 giocatori una parità al minimo è "tutti pari": niente dado né Belato Finale (D36)', () => {
    let s = finoAlPunteggio(
      { giocatori: 2, guaio: TOSATURA, mani: { g1: ['balla-di-fieno', 'carriola'], g2: ['balla-di-fieno', 'carriola'] } },
      { g1: ['balla-di-fieno'], g2: ['balla-di-fieno'] },
    );
    s = chiudiPunteggio(s);
    expect(s.fase).toEqual({ nome: 'guaio_al_peggiore', destinatario: null, spareggio: null });
    const mazzoGuai = s.mazzoGuai;
    const guaio = guaioAttivo(s);
    s = prosegui(s);
    expect(s.fase.nome).toBe('fine_round');
    expect(s.mazzoGuai).toEqual([...mazzoGuai, guaio]);
  });

  it('un solo partecipante lancia il dado ma nessuno prende il Guaio, che va in fondo (D23, D34)', () => {
    let s = dopoIlDado(
      { guaio: TOSATURA, mazzo: [], mani: { g1: ['carriola'], g2: ['pernacchia'], g3: [] } },
      { g1: ['carriola'] },
    );
    expect(s.datiRound.partecipanti).toEqual(['g1']);
    expect(s.datiRound.piuAlti).toEqual(['g1']);
    expect(s.datiRound.piuBassi).toEqual([]);
    expect(s.fase).toEqual({ nome: 'guaio_al_peggiore', destinatario: null, spareggio: null });

    const mazzoGuai = s.mazzoGuai;
    const guaio = guaioAttivo(s);
    s = prosegui(s);
    expect(s.fase.nome).toBe('fine_round');
    expect(s.mazzoGuai).toEqual([...mazzoGuai, guaio]);
    for (const id of ['g1', 'g2', 'g3']) expect(giocatore(s, id).angolo).toEqual([]);
  });
});

// ─── Belato Finale ───────────────────────────────────────────────────────────

describe('Belato Finale (brief "Parità"; 4.8, 4.9, D24, D25, D40)', () => {
  it('due pari al minimo vanno al Belato Finale dopo il dado, che lancia solo il più alto (4.8, D25)', () => {
    const s0 = alloSpareggio({ g2: ['trifoglio-qualunque'], g3: ['sasso-comodo'] });
    expect(s0.datiRound.lanciatori).toEqual(['g1']);
    expect(eventi(s0, 0, 'dado_lanciato').map((e) => e.giocatore)).toEqual(['g1']);
    expect(ordinati(s0.datiRound.piuBassi)).toEqual(['g2', 'g3']);

    const s = prosegui(s0);
    const f = fase(s, 'belato_finale');
    expect(ordinati(f.partecipanti)).toEqual(['g2', 'g3']);
    expect(f.scelte).toEqual({ g2: null, g3: null });
    expect(f.storico).toEqual([]);
    expect(inAttesaDi(s).sistema).toBe(false);
    expect(ordinati(inAttesaDi(s).giocatori)).toEqual(['g2', 'g3']);
    // Il Guaio non è ancora di nessuno.
    expect(s.datiRound.presoDa).toBeNull();
  });

  it('le carte vanno dalla mano al tavolo, il valore più basso prende il Guaio e passa al salvataggio (4.9)', () => {
    let s = alBelatoFinale({ g2: ['trifoglio-qualunque'], g3: ['sasso-comodo'] });
    const trifoglio = carta(s, 'g2', 'trifoglio-qualunque');
    const sasso = carta(s, 'g3', 'sasso-comodo');
    const punteggi = s.datiRound.punteggi;
    const seq = s.prossimoEvento;

    s = sceltaFinale(s, 'g2', 'trifoglio-qualunque');
    expect(fase(s, 'belato_finale').scelte).toEqual({ g2: trifoglio, g3: null });
    expect(inAttesaDi(s).giocatori).toEqual(['g3']);
    expect(eventi(s, seq, 'belato_finale')).toEqual([]);

    s = sceltaFinale(s, 'g3', 'sasso-comodo');
    expect(s.fase).toEqual({ nome: 'belati_salvataggio', destinatario: 'g3' });
    expect(eventi(s, seq, 'belato_finale')).toEqual([expect.objectContaining({ rivelate: { g2: trifoglio, g3: sasso } })]);
    expect(s.datiRound.tavolo).toEqual(expect.arrayContaining([trifoglio, sasso]));
    expect(giocatore(s, 'g2').mano).not.toContain(trifoglio);
    expect(giocatore(s, 'g3').mano).not.toContain(sasso);
    // Il Belato Finale non tocca il punteggio del round.
    expect(s.datiRound.punteggi).toEqual(punteggi);

    s = passa(s, 'g3');
    expect(s.fase).toEqual({ nome: 'consolazione', destinatario: 'g3' });
    expect(giocatore(s, 'g3').angolo).toEqual([guaioAttivo(s)]);
    expect(giocatore(s, 'g2').angolo).toEqual([]);
  });

  it('conta solo il valore stampato: il tratto della pecora non vale (brief "Parità")', () => {
    // Grandine (Meteo): g1 Ricciolo 8+1 = 9, g2 Brontolana 5, g3 Sospirella 6−1 = 5.
    let s = dopoIlDado(
      {
        guaio: 'grandine-a-sorpresa',
        mani: {
          g1: ['carriola'],
          g2: ['balla-di-fieno', 'trifoglio-qualunque'],
          g3: ['coperta-di-lana', 'balla-di-fieno'],
        },
      },
      { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['coperta-di-lana'] },
    );
    expect([totale(s, 'g2'), totale(s, 'g3')]).toEqual([5, 5]);
    s = prosegui(s);
    fase(s, 'belato_finale');

    // Stampati: 4 contro 5. Con il malus Meteo di Sospirella sarebbe 4 contro 4.
    s = sceltaFinale(sceltaFinale(s, 'g2', 'trifoglio-qualunque'), 'g3', 'balla-di-fieno');
    expect(s.fase).toEqual({ nome: 'belati_salvataggio', destinatario: 'g2' });
  });

  it('conta solo il valore stampato: gli effetti delle Trovate non si attivano (brief "Parità")', () => {
    let s = alBelatoFinale({ g2: ['scorta-nel-vello', 'corona-di-margherite'], g3: ['agnellino-smarrito'] });
    const corona = carta(s, 'g2', 'corona-di-margherite');
    const agnellini = s.giocatori.map((g) => g.agnellini);
    const gregge = s.gregge;
    const punteggi = s.datiRound.punteggi;
    const seq = s.prossimoEvento;

    // Scorta nel vello (0, "scarta e somma") contro Agnellino smarrito (1, "prendi 1 agnellino").
    s = sceltaFinale(sceltaFinale(s, 'g2', 'scorta-nel-vello'), 'g3', 'agnellino-smarrito');
    expect(s.fase).toEqual({ nome: 'belati_salvataggio', destinatario: 'g2' });
    expect(s.richiesta).toBeNull();
    expect(s.pila).toEqual([]);
    expect(giocatore(s, 'g2').mano).toContain(corona);
    expect(s.giocatori.map((g) => g.agnellini)).toEqual(agnellini);
    expect(s.gregge).toBe(gregge);
    expect(s.datiRound.punteggi).toEqual(punteggi);
    expect(eventi(s, seq, 'effetto')).toEqual([]);
    expect(eventi(s, seq, 'dichiarazione')).toEqual([]);
  });

  it('una Gemella si gioca da sola e vale il suo valore stampato; due carte sono rifiutate (D9, D24)', () => {
    let s = alBelatoFinale({ g2: ['calzino-gemello', 'orecchino-gemello'], g3: ['trifoglio-qualunque'] });
    const calzino = carta(s, 'g2', 'calzino-gemello');
    const orecchino = carta(s, 'g2', 'orecchino-gemello');

    verificaRifiuto(s, { tipo: 'scegliTrovata', giocatore: 'g2', carte: [calzino, orecchino] });
    // sceltaFinale accetta una sola carta: un elenco di due non è una carta valida.
    verificaRifiuto(s, { tipo: 'sceltaFinale', giocatore: 'g2', carta: [calzino, orecchino] as unknown as IdCarta });

    s = applica(s, { tipo: 'sceltaFinale', giocatore: 'g2', carta: calzino });
    s = sceltaFinale(s, 'g3', 'trifoglio-qualunque');
    // 3 contro 4: le Gemelle non si sommano.
    expect(s.fase).toEqual({ nome: 'belati_salvataggio', destinatario: 'g2' });
    expect(giocatore(s, 'g2').mano).toContain(orecchino);
  });

  it('rifiuta Belati, carte non in mano e chi non è allo spareggio (4.9)', () => {
    const s = alBelatoFinale({
      g1: ['corona-di-margherite'],
      g2: ['trifoglio-qualunque', 'pernacchia'],
      g3: ['sasso-comodo'],
    });
    verificaRifiuto(s, { tipo: 'sceltaFinale', giocatore: 'g2', carta: carta(s, 'g2', 'pernacchia') });
    verificaRifiuto(s, { tipo: 'sceltaFinale', giocatore: 'g2', carta: carta(s, 'g3', 'sasso-comodo') });
    verificaRifiuto(s, { tipo: 'sceltaFinale', giocatore: 'g1', carta: carta(s, 'g1', 'corona-di-margherite') });
    verificaRifiuto(s, { tipo: 'passa', giocatore: 'g2' });
  });

  it('si può cambiare carta finché non hanno scelto tutti; la vista nasconde la scelta altrui (D40, sez. 10)', () => {
    let s = alBelatoFinale({ g2: ['trifoglio-qualunque', 'sasso-comodo'], g3: ['coperta-di-lana'] });
    const trifoglio = carta(s, 'g2', 'trifoglio-qualunque');
    const sasso = carta(s, 'g2', 'sasso-comodo');
    const coperta = carta(s, 'g3', 'coperta-di-lana');
    const seq = s.prossimoEvento;

    s = sceltaFinale(s, 'g2', 'trifoglio-qualunque');
    const vistaG3 = vistaPer(s, 'g3').fase;
    expect(vistaG3).toMatchObject({ nome: 'belato_finale', haScelto: { g2: true, g3: false }, miaScelta: null });
    expect(vistaG3).not.toHaveProperty('scelte');
    expect(JSON.stringify(vistaG3)).not.toContain(trifoglio);
    expect(vistaPer(s, 'g2').fase).toMatchObject({ nome: 'belato_finale', miaScelta: trifoglio });
    expect(vistaPer(s, null).fase).not.toHaveProperty('scelte');

    s = sceltaFinale(s, 'g2', 'sasso-comodo');
    expect(fase(s, 'belato_finale').scelte['g2']).toBe(sasso);
    s = sceltaFinale(s, 'g3', 'coperta-di-lana');
    expect(eventi(s, seq, 'belato_finale')).toEqual([expect.objectContaining({ rivelate: { g2: sasso, g3: coperta } })]);
    expect(s.fase).toEqual({ nome: 'belati_salvataggio', destinatario: 'g2' });
    expect(giocatore(s, 'g2').mano).toContain(trifoglio);
    expect(s.datiRound.tavolo).not.toContain(trifoglio);
  });

  it('nuova parità: si ripete solo tra i pari al minimo e lo storico conserva le rivelazioni (4.9; 4 giocatori)', () => {
    let s = dopoIlDado(
      {
        giocatori: 4,
        guaio: TOSATURA,
        mani: {
          g1: ['carriola'],
          g2: ['balla-di-fieno', 'sasso-comodo', 'calzino-gemello'],
          g3: ['balla-di-fieno', 'pantofola-gemella', 'ciliegie-appaiate'],
          g4: ['balla-di-fieno', 'trifoglio-qualunque', 'coperta-di-lana'],
        },
      },
      { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['balla-di-fieno'], g4: ['balla-di-fieno'] },
    );
    expect(ordinati(fase(s, 'guaio_al_peggiore').spareggio ?? [])).toEqual(['g2', 'g3', 'g4']);
    s = prosegui(s);
    expect(ordinati(fase(s, 'belato_finale').partecipanti)).toEqual(['g2', 'g3', 'g4']);

    const sasso = carta(s, 'g2', 'sasso-comodo');
    const pantofola = carta(s, 'g3', 'pantofola-gemella');
    const trifoglio = carta(s, 'g4', 'trifoglio-qualunque');
    const seq = s.prossimoEvento;
    // 2, 2 e 4: g2 e g3 di nuovo pari al minimo, g4 è fuori dallo spareggio.
    s = sceltaFinale(sceltaFinale(sceltaFinale(s, 'g2', 'sasso-comodo'), 'g3', 'pantofola-gemella'), 'g4', 'trifoglio-qualunque');
    const f = fase(s, 'belato_finale');
    expect(ordinati(f.partecipanti)).toEqual(['g2', 'g3']);
    expect(f.scelte).toEqual({ g2: null, g3: null });
    expect(f.storico).toEqual([{ g2: sasso, g3: pantofola, g4: trifoglio }]);
    expect(s.datiRound.tavolo).toEqual(expect.arrayContaining([sasso, pantofola, trifoglio]));
    expect(eventi(s, seq, 'belato_finale')).toHaveLength(1);
    expect(ordinati(inAttesaDi(s).giocatori)).toEqual(['g2', 'g3']);
    verificaRifiuto(s, { tipo: 'sceltaFinale', giocatore: 'g4', carta: carta(s, 'g4', 'coperta-di-lana') });

    // 3 contro 1: g3 prende il Guaio.
    s = sceltaFinale(sceltaFinale(s, 'g2', 'calzino-gemello'), 'g3', 'ciliegie-appaiate');
    expect(s.fase).toEqual({ nome: 'belati_salvataggio', destinatario: 'g3' });
    expect(eventi(s, seq, 'belato_finale')).toHaveLength(2);
  });

  it('un solo pari senza Trovate in mano prende subito il Guaio, senza ripescata (brief "Parità", D24)', () => {
    const s0 = alloSpareggio({ g2: ['pernacchia'], g3: ['trifoglio-qualunque'] });
    const seq = s0.prossimoEvento;
    const s = prosegui(s0);
    expect(s.fase).toEqual({ nome: 'belati_salvataggio', destinatario: 'g2' });
    expect(giocatore(s, 'g2').mano).toEqual(giocatore(s0, 'g2').mano);
    expect(giocatore(s, 'g3').mano).toEqual(giocatore(s0, 'g3').mano);
    expect(eventi(s, seq, 'ripescata')).toEqual([]);
    expect(eventi(s, seq, 'belato_finale')).toEqual([]);
  });

  it('due pari senza Trovate: il Guaio va in fondo al mazzo Guai e il round finisce (brief "Parità")', () => {
    const s0 = alloSpareggio({ g2: ['beee-no'] });
    const guaio = guaioAttivo(s0);
    const seq = s0.prossimoEvento;
    const s = prosegui(s0);
    expect(s.fase.nome).toBe('fine_round');
    expect(s.mazzoGuai).toEqual([...s0.mazzoGuai, guaio]);
    expect(eventi(s, seq, 'guaio_in_fondo')).toEqual([expect.objectContaining({ carta: guaio })]);
    expect(eventi(s, seq, 'ripescata')).toEqual([]);
    expect(eventi(s, seq, 'guaio_preso')).toEqual([]);
    expect(s.datiRound.presoDa).toBeNull();
    for (const id of ['g2', 'g3']) {
      expect(giocatore(s, id).angolo).toEqual([]);
      expect(giocatore(s, id).agnellini).toBe(3);
    }
  });

  it('alla ripetizione chi è rimasto senza Trovate prende il Guaio (D24)', () => {
    let s = alBelatoFinale({ g2: ['trifoglio-qualunque', 'beee-no'], g3: ['campanaccio-stonato', 'sasso-comodo'] });
    const sasso = carta(s, 'g3', 'sasso-comodo');
    const seq = s.prossimoEvento;
    // 4 contro 4: si ripeterebbe, ma g2 ha in mano solo un Belato.
    s = sceltaFinale(sceltaFinale(s, 'g2', 'trifoglio-qualunque'), 'g3', 'campanaccio-stonato');
    expect(s.fase).toEqual({ nome: 'belati_salvataggio', destinatario: 'g2' });
    expect(eventi(s, seq, 'belato_finale')).toHaveLength(1);
    expect(giocatore(s, 'g3').mano).toContain(sasso);
  });

  it('alla ripetizione, se restano senza Trovate in due, il Guaio va in fondo e il round finisce (D24)', () => {
    let s = alBelatoFinale({ g2: ['trifoglio-qualunque'], g3: ['campanaccio-stonato'] });
    const guaio = guaioAttivo(s);
    const mazzoGuai = s.mazzoGuai;
    const seq = s.prossimoEvento;
    s = sceltaFinale(sceltaFinale(s, 'g2', 'trifoglio-qualunque'), 'g3', 'campanaccio-stonato');
    expect(s.fase.nome).toBe('fine_round');
    expect(s.mazzoGuai).toEqual([...mazzoGuai, guaio]);
    expect(eventi(s, seq, 'guaio_in_fondo')).toEqual([expect.objectContaining({ carta: guaio })]);
    expect(giocatore(s, 'g2').angolo).toEqual([]);
    expect(giocatore(s, 'g3').angolo).toEqual([]);
  });
});

// ─── Belati di salvataggio ───────────────────────────────────────────────────

describe('Belati di salvataggio (brief sez. 3 passo 9 e "Casi limite"; 4.10, 7, D26)', () => {
  it('agisce solo il destinatario: azioniPossibili elenca passa e i Belati di salvataggio con i bersagli validi (2, 4.10)', () => {
    const s = alSalvataggio({
      g1: ['finta-svenuta'],
      g2: ['faccio-finta-di-niente', 'finta-svenuta', 'belato-di-gruppo'],
      g3: ['faccio-finta-di-niente'],
    });
    const azioni = azioniPossibili(s, 'g2');
    expect(azioni).toContainEqual({ tipo: 'passa', giocatore: 'g2' });
    expect(azioni).toContainEqual(
      expect.objectContaining({ tipo: 'giocaBelato', giocatore: 'g2', carta: carta(s, 'g2', 'faccio-finta-di-niente') }),
    );
    const bersagli = azioni.flatMap((a) =>
      a.tipo === 'giocaBelato' && a.carta.startsWith('finta-svenuta#') ? [a.bersaglio ?? '(nessuno)'] : [],
    );
    expect(ordinati(bersagli)).toEqual(['g1', 'g3']);
    expect(azioni.some((a) => a.tipo === 'giocaBelato' && a.carta.startsWith('belato-di-gruppo#'))).toBe(false);
    for (const a of azioni) expect(() => applica(s, a), JSON.stringify(a)).not.toThrow();
    expect(azioniPossibili(s, 'g1')).toEqual([]);
    expect(azioniPossibili(s, 'g3')).toEqual([]);

    verificaRifiuto(s, { tipo: 'giocaBelato', giocatore: 'g1', carta: carta(s, 'g1', 'finta-svenuta'), bersaglio: 'g3' });
    verificaRifiuto(s, { tipo: 'giocaBelato', giocatore: 'g3', carta: carta(s, 'g3', 'faccio-finta-di-niente') });
    verificaRifiuto(s, { tipo: 'passa', giocatore: 'g1' });
    verificaRifiuto(s, { tipo: 'giocaBelato', giocatore: 'g2', carta: carta(s, 'g2', 'belato-di-gruppo'), bersaglio: 'g2' });
    verificaRifiuto(s, { tipo: 'concludiConsolazione', giocatore: 'g2', scarta: null });
  });

  it('Faccio finta di niente: dopo la finestra il Guaio va in fondo al mazzo Guai e non c\'è consolazione (4.10)', () => {
    let s = alSalvataggio({ g2: ['faccio-finta-di-niente', 'sasso-comodo'] });
    const prima = s;
    const guaio = guaioAttivo(s);
    const belato = carta(s, 'g2', 'faccio-finta-di-niente');
    const seq = s.prossimoEvento;

    s = giocaBelato(s, 'g2', 'faccio-finta-di-niente');
    expect(s.pila).toHaveLength(1);
    expect(s.pila[0]).toMatchObject({ autore: 'g2', dettagli: { tipo: 'belato', carta: belato, effetto: 'guaio_in_fondo' } });
    expect(ordinati(s.finestra?.inAttesa ?? [])).toEqual(['g1', 'g3']);
    expect(s.datiRound.tavolo).toContain(belato);
    expect(giocatore(s, 'g2').mano).not.toContain(belato);
    expect(s.fase).toEqual({ nome: 'belati_salvataggio', destinatario: 'g2' });

    s = nessunaReazione(s);
    expect(s.fase.nome).toBe('fine_round');
    expect(s.mazzoGuai).toEqual([...prima.mazzoGuai, guaio]);
    expect(eventi(s, seq, 'guaio_in_fondo')).toEqual([expect.objectContaining({ carta: guaio })]);
    expect(eventi(s, seq, 'guaio_preso')).toEqual([]);
    expect(s.datiRound.presoDa).toBeNull();
    expect(giocatore(s, 'g2').angolo).toEqual([]);
    expect(giocatore(s, 'g2').agnellini).toBe(giocatore(prima, 'g2').agnellini);
    expect(s.gregge).toBe(prima.gregge);
    // A fine round il Belato giocato va negli scarti.
    expect(s.scarti).toContain(belato);
  });

  it('Finta svenuta: il nuovo destinatario può salvarsi a sua volta (brief "Casi limite")', () => {
    let s = alSalvataggio({ g2: ['finta-svenuta'], g3: ['faccio-finta-di-niente'] });
    const guaio = guaioAttivo(s);
    const mazzoGuai = s.mazzoGuai;
    const seq = s.prossimoEvento;

    s = giocaBelato(s, 'g2', 'finta-svenuta', { bersaglio: 'g3' });
    expect(s.pila[0]?.dettagli).toMatchObject({ tipo: 'belato', effetto: 'devia_guaio', bersaglio: 'g3' });
    s = nessunaReazione(s);
    expect(eventi(s, seq, 'guaio_deviato')).toEqual([expect.objectContaining({ da: 'g2', a: 'g3' })]);
    expect(s.fase).toEqual({ nome: 'belati_salvataggio', destinatario: 'g3' });
    expect(inAttesaDi(s)).toEqual({ sistema: false, giocatori: ['g3'] });
    verificaRifiuto(s, { tipo: 'passa', giocatore: 'g2' });

    s = nessunaReazione(giocaBelato(s, 'g3', 'faccio-finta-di-niente'));
    expect(s.fase.nome).toBe('fine_round');
    expect(s.mazzoGuai).toEqual([...mazzoGuai, guaio]);
    expect(giocatore(s, 'g2').angolo).toEqual([]);
    expect(giocatore(s, 'g3').angolo).toEqual([]);
  });

  it('Finta svenuta: se il nuovo destinatario passa, prende il Guaio e la consolazione (brief "Casi limite")', () => {
    let s = alSalvataggio({ g2: ['finta-svenuta'] });
    const guaio = guaioAttivo(s);
    s = nessunaReazione(giocaBelato(s, 'g2', 'finta-svenuta', { bersaglio: 'g3' }));
    const prima = s;
    s = passa(s, 'g3');
    expect(s.fase).toEqual({ nome: 'consolazione', destinatario: 'g3' });
    expect(s.datiRound.presoDa).toBe('g3');
    expect(giocatore(s, 'g3').angolo).toEqual([guaio]);
    expect(giocatore(s, 'g3').agnellini).toBe(giocatore(prima, 'g3').agnellini + 1);
    expect(giocatore(s, 'g2').angolo).toEqual([]);
    expect(giocatore(s, 'g2').agnellini).toBe(giocatore(prima, 'g2').agnellini);
    verificaRifiuto(s, { tipo: 'concludiConsolazione', giocatore: 'g2', scarta: null });
    expect(concludi(s, 'g3').fase.nome).toBe('fine_round');
  });

  it('il ritorno al mittente è ammesso (4.10, D26)', () => {
    let s = alSalvataggio({ g2: ['finta-svenuta'], g3: ['finta-svenuta'] });
    const guaio = guaioAttivo(s);
    const seq = s.prossimoEvento;
    s = nessunaReazione(giocaBelato(s, 'g2', 'finta-svenuta', { bersaglio: 'g3' }));
    s = nessunaReazione(giocaBelato(s, 'g3', 'finta-svenuta', { bersaglio: 'g2' }));
    expect(s.fase).toEqual({ nome: 'belati_salvataggio', destinatario: 'g2' });
    expect(eventi(s, seq, 'guaio_deviato').map((e) => [e.da, e.a])).toEqual([
      ['g2', 'g3'],
      ['g3', 'g2'],
    ]);
    s = passa(s, 'g2');
    expect(s.fase).toEqual({ nome: 'consolazione', destinatario: 'g2' });
    expect(giocatore(s, 'g2').angolo).toEqual([guaio]);
  });

  it('bersaglio non valido: se stessi, un eliminato, chi è fuori dal round, nessuno o inesistente (D15, D26, D34)', () => {
    // 4 giocatori: g4 eliminato, g3 senza Trovate con il mazzo vuoto resta fuori dal round.
    let s = dopoIlDado(
      {
        giocatori: 4,
        guaio: TOSATURA,
        mazzo: [],
        eliminati: ['g4'],
        mani: { g1: ['carriola'], g2: ['balla-di-fieno', 'finta-svenuta'], g3: ['pernacchia'], g4: [] },
      },
      { g1: ['carriola'], g2: ['balla-di-fieno'] },
    );
    expect(s.datiRound.partecipanti).toEqual(['g1', 'g2']);
    s = prosegui(s);
    expect(s.fase).toEqual({ nome: 'belati_salvataggio', destinatario: 'g2' });

    const finta = carta(s, 'g2', 'finta-svenuta');
    for (const bersaglio of ['g2', 'g3', 'g4', 'g9']) {
      verificaRifiuto(s, { tipo: 'giocaBelato', giocatore: 'g2', carta: finta, bersaglio });
    }
    verificaRifiuto(s, { tipo: 'giocaBelato', giocatore: 'g2', carta: finta });
    const bersagli = azioniPossibili(s, 'g2').flatMap((a) =>
      a.tipo === 'giocaBelato' && a.carta === finta ? [a.bersaglio] : [],
    );
    expect(bersagli).toEqual(['g1']);

    s = nessunaReazione(applica(s, { tipo: 'giocaBelato', giocatore: 'g2', carta: finta, bersaglio: 'g1' }));
    expect(s.fase).toEqual({ nome: 'belati_salvataggio', destinatario: 'g1' });
  });

  it('Belato di salvataggio annullato da Beee-NO!: stesso destinatario, che può giocarne un altro (4.10, D8)', () => {
    let s = alSalvataggio({ g2: ['finta-svenuta', 'faccio-finta-di-niente'], g3: ['beee-no'] });
    const guaio = guaioAttivo(s);
    const mazzoGuai = s.mazzoGuai;
    const finta = carta(s, 'g2', 'finta-svenuta');
    const seq = s.prossimoEvento;

    s = giocaBelato(s, 'g2', 'finta-svenuta', { bersaglio: 'g3' });
    const voceFinta = s.pila[0]?.id;
    s = nessunaReazione(beeeNo(s, 'g3'));
    expect(eventi(s, seq, 'annullata')).toEqual([expect.objectContaining({ voce: voceFinta })]);
    expect(eventi(s, seq, 'guaio_deviato')).toEqual([]);
    expect(s.pila).toEqual([]);
    expect(s.fase).toEqual({ nome: 'belati_salvataggio', destinatario: 'g2' });
    expect(s.datiRound.tavolo).toContain(finta);

    s = nessunaReazione(giocaBelato(s, 'g2', 'faccio-finta-di-niente'));
    expect(s.fase.nome).toBe('fine_round');
    expect(s.mazzoGuai).toEqual([...mazzoGuai, guaio]);
    expect(giocatore(s, 'g2').angolo).toEqual([]);
    expect(giocatore(s, 'g3').angolo).toEqual([]);
    expect(s.scarti).toContain(finta);
  });

  it('Guaio deviato che elimina chi lo riceve: il controllo vale per il nuovo destinatario (brief "Casi limite", sez. 8)', () => {
    let s = alSalvataggio(
      { g2: ['finta-svenuta'], g3: ['beee-no'] },
      { angoli: { g3: ['lupo-vegetariano', 'volpe-gentile'] } },
    );
    const beee = carta(s, 'g3', 'beee-no');
    s = nessunaReazione(giocaBelato(s, 'g2', 'finta-svenuta', { bersaglio: 'g3' }));
    s = passa(s, 'g3');
    expect(s.fase).toEqual({ nome: 'consolazione', destinatario: 'g3' });
    const angolo = giocatore(s, 'g3').angolo;
    expect(angolo).toHaveLength(3);
    expect(giocatore(s, 'g3').agnellini).toBe(4);
    const gregge = s.gregge;
    const seq = s.prossimoEvento;

    s = concludi(s, 'g3');
    const g3 = giocatore(s, 'g3');
    expect(eventi(s, seq, 'eliminato')).toEqual([expect.objectContaining({ giocatore: 'g3' })]);
    expect(g3.eliminato).toBe(true);
    expect(g3.agnellini).toBe(0);
    expect(s.gregge).toBe(gregge + 4);
    expect(g3.angolo).toEqual([]);
    expect(ordinati(s.guaiFuoriGioco)).toEqual(ordinati(angolo));
    expect(s.scarti).toContain(beee);
    expect(g3.mano).toEqual([]);
    expect(giocatore(s, 'g2').eliminato).toBe(false);
    expect(giocatore(s, 'g2').angolo).toEqual([]);
    expect(s.esito).toBeNull();
    expect(s.fase.nome).toBe('fine_round');
  });

  it("a 2 giocatori il Guaio deviato sul più alto lo elimina e l'altra pecora vince (D26, D36, sez. 8–9)", () => {
    let s = dopoIlDado(
      {
        giocatori: 2,
        guaio: TOSATURA,
        angoli: { g1: ['lupo-vegetariano', 'volpe-gentile', 'aquila-con-il-taccuino'] },
        mani: { g1: ['carriola'], g2: ['balla-di-fieno', 'finta-svenuta'] },
      },
      { g1: ['carriola'], g2: ['balla-di-fieno'] },
    );
    s = prosegui(s);
    expect(s.fase).toEqual({ nome: 'belati_salvataggio', destinatario: 'g2' });
    s = nessunaReazione(giocaBelato(s, 'g2', 'finta-svenuta', { bersaglio: 'g1' }));
    expect(s.fase).toEqual({ nome: 'belati_salvataggio', destinatario: 'g1' });
    s = passa(s, 'g1');
    // 3 Predatori + Tosatura = 4 dello stesso tipo (regola a 2 giocatori).
    s = concludi(s, 'g1');
    expect(giocatore(s, 'g1').eliminato).toBe(true);
    expect(s.fase).toEqual({ nome: 'fine_partita' });
    expect(s.esito).toEqual({ modo: 'ultima_pecora', vincitori: ['g2'] });
    verificaRifiuto(s, { tipo: 'prosegui' });
  });
});

// ─── Visita di Garzina ───────────────────────────────────────────────────────

describe('Visita di Garzina (D37; specifica 4.11, 7)', () => {
  // g2 ha già due Meteo: con la Tosatura del round sarebbe eliminata.
  const ANGOLI: OpzioniScenario = { angoli: { g2: ['grandine-a-sorpresa', 'fulmine-curioso'], g3: ['insonnia'] } };

  it("nella consolazione toglie il Guaio scelto dall'Angolo e lo mette in fondo al mazzo Guai", () => {
    let s = allaConsolazione({ g2: ['visita-di-garzina'] }, ANGOLI);
    const angolo = giocatore(s, 'g2').angolo;
    expect(angolo).toHaveLength(3);
    const grandine = istanza(angolo, 'grandine-a-sorpresa');
    const garzina = carta(s, 'g2', 'visita-di-garzina');
    const mazzoGuai = s.mazzoGuai;
    const seq = s.prossimoEvento;

    s = giocaBelato(s, 'g2', 'visita-di-garzina', { guaio: grandine });
    expect(s.pila).toHaveLength(1);
    expect(s.pila[0]).toMatchObject({
      autore: 'g2',
      dettagli: { tipo: 'belato', carta: garzina, effetto: 'cura', guaio: grandine },
    });
    expect(ordinati(s.finestra?.inAttesa ?? [])).toEqual(['g1', 'g3']);
    expect(s.datiRound.tavolo).toContain(garzina);
    // Con la pila piena non si conclude.
    verificaRifiuto(s, { tipo: 'concludiConsolazione', giocatore: 'g2', scarta: null });

    s = nessunaReazione(s);
    expect(giocatore(s, 'g2').angolo).toEqual(angolo.filter((c) => c !== grandine));
    expect(s.mazzoGuai).toEqual([...mazzoGuai, grandine]);
    expect(eventi(s, seq, 'guaio_curato')).toEqual([expect.objectContaining({ giocatore: 'g2', carta: grandine })]);
    expect(s.fase).toEqual({ nome: 'consolazione', destinatario: 'g2' });
  });

  it("salva dall'eliminazione: il controllo avviene dopo la cura, alla fine della consolazione", () => {
    let s = allaConsolazione({ g2: ['visita-di-garzina'] }, ANGOLI);
    const grandine = istanza(giocatore(s, 'g2').angolo, 'grandine-a-sorpresa');
    s = nessunaReazione(giocaBelato(s, 'g2', 'visita-di-garzina', { guaio: grandine }));
    const seq = s.prossimoEvento;
    s = concludi(s, 'g2');
    expect(s.fase.nome).toBe('fine_round');
    expect(giocatore(s, 'g2').eliminato).toBe(false);
    expect(giocatore(s, 'g2').angolo).toHaveLength(2);
    expect(eventi(s, seq, 'eliminato')).toEqual([]);
  });

  it("annullata da Beee-NO!: il Guaio resta nell'Angolo e l'eliminazione avviene", () => {
    let s = allaConsolazione({ g1: ['beee-no'], g2: ['visita-di-garzina'] }, ANGOLI);
    const angolo = giocatore(s, 'g2').angolo;
    const grandine = istanza(angolo, 'grandine-a-sorpresa');
    const garzina = carta(s, 'g2', 'visita-di-garzina');
    const mazzoGuai = s.mazzoGuai;
    const seq = s.prossimoEvento;

    s = nessunaReazione(beeeNo(giocaBelato(s, 'g2', 'visita-di-garzina', { guaio: grandine }), 'g1'));
    expect(s.pila).toEqual([]);
    expect(eventi(s, seq, 'annullata')).toHaveLength(1);
    expect(eventi(s, seq, 'guaio_curato')).toEqual([]);
    expect(giocatore(s, 'g2').angolo).toEqual(angolo);
    expect(s.mazzoGuai).toEqual(mazzoGuai);
    expect(s.datiRound.tavolo).toContain(garzina);
    expect(s.fase).toEqual({ nome: 'consolazione', destinatario: 'g2' });

    s = concludi(s, 'g2');
    expect(giocatore(s, 'g2').eliminato).toBe(true);
    expect(ordinati(s.guaiFuoriGioco)).toEqual(ordinati(angolo));
    expect(eventi(s, seq, 'eliminato')).toEqual([expect.objectContaining({ giocatore: 'g2' })]);
  });

  it('si può giocare più volte nella stessa consolazione, anche sul Guaio appena preso (4.11)', () => {
    let s = allaConsolazione({ g2: ['visita-di-garzina', 'visita-di-garzina'] }, ANGOLI);
    const guaio = guaioAttivo(s);
    const angolo = giocatore(s, 'g2').angolo;
    const grandine = istanza(angolo, 'grandine-a-sorpresa');
    const mazzoGuai = s.mazzoGuai;

    s = nessunaReazione(giocaBelato(s, 'g2', 'visita-di-garzina', { guaio: grandine }));
    s = nessunaReazione(giocaBelato(s, 'g2', 'visita-di-garzina', { guaio }));
    expect(giocatore(s, 'g2').angolo).toEqual([istanza(angolo, 'fulmine-curioso')]);
    expect(s.mazzoGuai).toEqual([...mazzoGuai, grandine, guaio]);
    expect(s.fase).toEqual({ nome: 'consolazione', destinatario: 'g2' });
  });

  it('azioniPossibili in consolazione: una cura per ogni Guaio del proprio Angolo e la conclusione con o senza scarto', () => {
    const s = allaConsolazione({ g2: ['visita-di-garzina', 'pernacchia'] }, ANGOLI);
    const azioni = azioniPossibili(s, 'g2');
    const curati = azioni.flatMap((a) => (a.tipo === 'giocaBelato' && a.guaio !== undefined ? [a.guaio] : []));
    expect(ordinati(curati)).toEqual(ordinati(giocatore(s, 'g2').angolo));
    expect(azioni).toContainEqual({ tipo: 'concludiConsolazione', giocatore: 'g2', scarta: null });
    expect(azioni).toContainEqual({ tipo: 'concludiConsolazione', giocatore: 'g2', scarta: carta(s, 'g2', 'pernacchia') });
    for (const a of azioni) expect(() => applica(s, a), JSON.stringify(a)).not.toThrow();
    expect(azioniPossibili(s, 'g3')).toEqual([]);
  });

  it('rifiutata fuori dalla consolazione: nei Belati di punteggio, nel salvataggio, a fine round', () => {
    const punteggio = finoAlPunteggio({ guaio: TOSATURA, ...ANGOLI, mani: maniBase({ g2: ['visita-di-garzina'] }) }, BASE);
    fase(punteggio, 'belati_punteggio');
    const grandineP = istanza(giocatore(punteggio, 'g2').angolo, 'grandine-a-sorpresa');
    verificaRifiuto(punteggio, {
      tipo: 'giocaBelato',
      giocatore: 'g2',
      carta: carta(punteggio, 'g2', 'visita-di-garzina'),
      guaio: grandineP,
    });

    const salvataggio = alSalvataggio({ g2: ['visita-di-garzina'] }, ANGOLI);
    const grandineS = istanza(giocatore(salvataggio, 'g2').angolo, 'grandine-a-sorpresa');
    verificaRifiuto(salvataggio, {
      tipo: 'giocaBelato',
      giocatore: 'g2',
      carta: carta(salvataggio, 'g2', 'visita-di-garzina'),
      guaio: grandineS,
    });

    // Angolo innocuo: g2 non viene eliminata e a fine round ha ancora Garzina in mano.
    const fine = concludi(allaConsolazione({ g2: ['visita-di-garzina'] }, { angoli: { g2: ['insonnia'] } }), 'g2');
    expect(fine.fase.nome).toBe('fine_round');
    verificaRifiuto(fine, {
      tipo: 'giocaBelato',
      giocatore: 'g2',
      carta: carta(fine, 'g2', 'visita-di-garzina'),
      guaio: istanza(giocatore(fine, 'g2').angolo, 'insonnia'),
    });
  });

  it("rifiutata se la gioca un altro o con un Guaio che non è nel proprio Angolo; i Belati di salvataggio non valgono più", () => {
    const s = allaConsolazione(
      { g2: ['visita-di-garzina', 'faccio-finta-di-niente'], g3: ['visita-di-garzina'] },
      ANGOLI,
    );
    const garzina2 = carta(s, 'g2', 'visita-di-garzina');
    const garzina3 = carta(s, 'g3', 'visita-di-garzina');
    const insonnia = istanza(giocatore(s, 'g3').angolo, 'insonnia');
    const grandine = istanza(giocatore(s, 'g2').angolo, 'grandine-a-sorpresa');
    const nelMazzo = s.mazzoGuai[0];
    expect(nelMazzo).toBeDefined();

    // Un altro giocatore, né sul proprio Angolo né su quello del destinatario.
    verificaRifiuto(s, { tipo: 'giocaBelato', giocatore: 'g3', carta: garzina3, guaio: insonnia });
    verificaRifiuto(s, { tipo: 'giocaBelato', giocatore: 'g3', carta: garzina3, guaio: grandine });
    // Il destinatario con un Guaio che non è nel suo Angolo, o senza Guaio.
    verificaRifiuto(s, { tipo: 'giocaBelato', giocatore: 'g2', carta: garzina2, guaio: insonnia });
    verificaRifiuto(s, { tipo: 'giocaBelato', giocatore: 'g2', carta: garzina2, guaio: nelMazzo as IdCarta });
    verificaRifiuto(s, { tipo: 'giocaBelato', giocatore: 'g2', carta: garzina2 });
    // Il Guaio è già preso: Faccio finta di niente non si gioca più.
    verificaRifiuto(s, { tipo: 'giocaBelato', giocatore: 'g2', carta: carta(s, 'g2', 'faccio-finta-di-niente') });
  });
});

// ─── Mazzo Guai esaurito ─────────────────────────────────────────────────────

describe('Mazzo Guai esaurito (brief "Casi limite"; 4.1, 4.8, D27, D28)', () => {
  /** Round con g2 e g3 pari al minimo, giocato fino a fine_round. */
  function roundSenzaGuaio(o: OpzioniScenario): Stato {
    const s = dopoIlDado({ ...o, guaio: null, mazzoGuai: [], mani: maniPari() }, PARI);
    expect(s.datiRound.guaio).toBeNull();
    return s;
  }

  it('round senza Guaio: nessun tratto, e dopo il dado si va a fine_round anche con una parità al minimo (D27)', () => {
    const punteggio = finoAlPunteggio({ guaio: null, mazzoGuai: [], mani: maniPari() }, PARI);
    for (const id of ['g1', 'g2', 'g3']) {
      expect((punteggio.datiRound.punteggi[id] ?? []).map((r) => r.tipo)).toEqual(['valore']);
    }
    const seq = punteggio.prossimoEvento;
    const s = tiraDadi(chiudiPunteggio(punteggio));
    expect(ordinati(s.datiRound.piuBassi)).toEqual(['g2', 'g3']);
    expect(s.fase.nome).toBe('fine_round');
    expect(eventi(s, seq, 'belato_finale')).toEqual([]);
    expect(eventi(s, seq, 'guaio_in_fondo')).toEqual([]);
    expect(eventi(s, seq, 'guaio_preso')).toEqual([]);
    expect(s.mazzoGuai).toEqual([]);
    for (const id of ['g1', 'g2', 'g3']) expect(giocatore(s, id).angolo).toEqual([]);
  });

  it('se non ci sono Guai fuori gioco anche il round successivo è senza Guaio (4.1)', () => {
    const s0 = roundSenzaGuaio({});
    const seq = s0.prossimoEvento;
    const s = prosegui(s0);
    expect(s.round).toBe(2);
    expect(s.fase).toEqual({ nome: 'guaio' });
    expect(s.datiRound.guaio).toBeNull();
    expect(eventi(s, seq, 'guaio_rivelato')).toEqual([expect.objectContaining({ carta: null })]);
    expect(eventi(s, seq, 'guai_rimescolati')).toEqual([]);
  });

  it('mazzo Guai vuoto: a inizio round si rimescolano i Guai fuori gioco e se ne scopre uno (4.1, D27)', () => {
    const s0 = roundSenzaGuaio({ guaiFuoriGioco: ['lupo-vegetariano', 'insonnia'] });
    const fuori = s0.guaiFuoriGioco;
    expect(fuori).toHaveLength(2);
    const seq = s0.prossimoEvento;

    const s = prosegui(s0);
    expect(s.round).toBe(2);
    expect(s.fase).toEqual({ nome: 'guaio' });
    const guaio = guaioAttivo(s);
    expect(fuori).toContain(guaio);
    expect(s.mazzoGuai).toEqual(fuori.filter((c) => c !== guaio));
    expect(s.guaiFuoriGioco).toEqual([]);
    const rimescolati = eventi(s, seq, 'guai_rimescolati');
    const rivelati = eventi(s, seq, 'guaio_rivelato');
    expect(rimescolati).toEqual([expect.objectContaining({ quanti: 2 })]);
    expect(rivelati).toEqual([expect.objectContaining({ carta: guaio })]);
    expect((rimescolati[0]?.seq ?? 0) < (rivelati[0]?.seq ?? 0)).toBe(true);
  });

  it('un Guaio messo in fondo resta nel mazzo e torna come Guaio del round successivo (D27)', () => {
    // Insonnia (Drammi): Brontolana −1, Sospirella +1. 5, 6−1 = 5, 4+1 = 5: tutti pari.
    let s = finoAlPunteggio(
      {
        guaio: 'insonnia',
        mazzoGuai: [],
        mani: { g1: ['balla-di-fieno'], g2: ['coperta-di-lana'], g3: ['trifoglio-qualunque'] },
      },
      { g1: ['balla-di-fieno'], g2: ['coperta-di-lana'], g3: ['trifoglio-qualunque'] },
    );
    const guaio = guaioAttivo(s);
    s = prosegui(chiudiPunteggio(s));
    expect(s.fase.nome).toBe('fine_round');
    expect(s.mazzoGuai).toEqual([guaio]);

    const seq = s.prossimoEvento;
    s = prosegui(s);
    expect(s.round).toBe(2);
    expect(s.datiRound.guaio).toBe(guaio);
    expect(s.mazzoGuai).toEqual([]);
    expect(eventi(s, seq, 'guai_rimescolati')).toEqual([]);
  });

  it("l'Angolo di un eliminato finisce fuori gioco e si rimescola quando il mazzo Guai è vuoto (D27, D28)", () => {
    let s = allaConsolazione(
      {},
      { mazzoGuai: [], angoli: { g2: ['grandine-a-sorpresa', 'fulmine-curioso'] } },
    );
    const angolo = giocatore(s, 'g2').angolo;
    s = concludi(s, 'g2');
    expect(giocatore(s, 'g2').eliminato).toBe(true);
    expect(ordinati(s.guaiFuoriGioco)).toEqual(ordinati(angolo));
    expect(s.mazzoGuai).toEqual([]);

    const seq = s.prossimoEvento;
    s = prosegui(s);
    expect(s.round).toBe(2);
    const guaio = guaioAttivo(s);
    expect(angolo).toContain(guaio);
    expect(ordinati([...s.mazzoGuai, guaio])).toEqual(ordinati(angolo));
    expect(s.guaiFuoriGioco).toEqual([]);
    expect(eventi(s, seq, 'guai_rimescolati')).toEqual([expect.objectContaining({ quanti: 3 })]);
  });
});
