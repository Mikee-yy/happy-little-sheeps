// Dado del Pastore: lancio, facce, dichiarazioni, Testata, più lanciatori.
// Regole: brief sezione 3 ("Svolgimento di un round" punto 7, "Il Dado del Pastore", "Parità", "Beee-NO!",
// "Come si vince") e setup.json; specifica docs/motore.md sezioni 1, 4.6, 4.7, 4.8, 5, 9.1, 11
// e decisioni D4, D19, D20, D21, D22, D23, D34.
import { describe, expect, it } from 'vitest';
import setupJson from '../data/setup.json';
import {
  applica,
  azioniPossibili,
  configPer,
  eFaseAutomatica,
  ErroreRegola,
  inAttesaDi,
  vistaPer,
  type Azione,
  type DichiarazioneDado,
  type Evento,
  type Fase,
  type IdGiocatore,
  type IdTipoCarta,
  type Luogo,
  type Stato,
  type StatoGiocatore,
  type VocePila,
} from '../src';
import { carta, chiudiPunteggio, conFaccia, nessunaReazione, prosegui, scegli, scenario, type OpzioniScenario } from './aiuti';

// ─── Aiuti locali ────────────────────────────────────────────────────────────

/** Tosatura a Sorpresa come Guaio attivo: nessun tratto, i totali sono i soli valori delle carte. */
const SENZA_TRATTI = 'tosatura-a-sorpresa';

type Scelte = Record<IdGiocatore, IdTipoCarta[]>;
type ManiExtra = Partial<Record<IdGiocatore, IdTipoCarta[]>>;
type EventoDi<T extends Evento['tipo']> = Extract<Evento, { tipo: T }>;
type FaseDi<N extends Fase['nome']> = Extract<Fase, { nome: N }>;
type AzioneDi<T extends Azione['tipo']> = Extract<Azione, { tipo: T }>;
type Furto = Record<IdGiocatore, number>;

function inFase<N extends Fase['nome']>(s: Stato, nome: N): FaseDi<N> {
  if (s.fase.nome !== nome) throw new Error(`fase '${s.fase.nome}', attesa '${nome}'`);
  return s.fase as FaseDi<N>;
}

/** Da scenario alla fase 'dado': scelta, rivelazione, nessun effetto, chiusura del punteggio. */
function alDado(o: OpzioniScenario, scelte: Scelte): Stato {
  let s = prosegui(scenario({ guaio: SENZA_TRATTI, ...o }));
  expect(s.fase.nome).toBe('scelta');
  s = scegli(s, scelte);
  expect(s.fase.nome).toBe('rivelazione');
  s = prosegui(s);
  if (s.fase.nome === 'belati_punteggio') s = chiudiPunteggio(s);
  expect(s.fase.nome).toBe('dado');
  return s;
}

/** Tre partecipanti con 8, 5 e 2 (Carriola, Balla di fieno, Sasso comodo): lancia g1, il Guaio va a g3. */
function treGiocatori(o: OpzioniScenario = {}, extra: ManiExtra = {}): Stato {
  return alDado(
    {
      ...o,
      mani: {
        g1: ['carriola', ...(extra.g1 ?? [])],
        g2: ['balla-di-fieno', ...(extra.g2 ?? [])],
        g3: ['sasso-comodo', ...(extra.g3 ?? [])],
      },
    },
    { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['sasso-comodo'] },
  );
}

/** Quattro partecipanti con 8, 5, 4 e 2: lancia g1. */
function quattroGiocatori(o: OpzioniScenario = {}): Stato {
  const scelte: Scelte = { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['trifoglio-qualunque'], g4: ['sasso-comodo'] };
  return alDado({ giocatori: 4, ...o, mani: scelte }, scelte);
}

/**
 * Quattro giocatori con g4 eliminato; `agnellini` può lasciargliene alcuni (stato artificiale) per verificare
 * che gli eliminati non contino come avversari nemmeno quando avrebbero agnellini. Lancia g1.
 */
function conEliminatoG4(agnellini: Record<IdGiocatore, number>, o: OpzioniScenario = {}): Stato {
  return alDado(
    {
      giocatori: 4,
      eliminati: ['g4'],
      ...o,
      agnellini,
      mani: { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['sasso-comodo'], g4: [] },
    },
    { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['sasso-comodo'] },
  );
}

/** Solo g1 ha una Trovata; g2 e g3 restano fuori dal round (mazzo vuoto, niente ripescata). */
function soloG1(o: OpzioniScenario = {}): Stato {
  return alDado({ mazzo: [], ...o, mani: { g1: ['carriola'], g2: [], g3: [] } }, { g1: ['carriola'] });
}

/** g1 e g2 pari al massimo con 8 (due Carriole), g3 più basso con 2. */
function pariAlVertice(o: OpzioniScenario = {}): Stato {
  const scelte: Scelte = { g1: ['carriola'], g2: ['carriola'], g3: ['sasso-comodo'] };
  return alDado({ ...o, mani: scelte }, scelte);
}

function lanciatoreCorrente(s: Stato): IdGiocatore {
  const f = inFase(s, 'dado');
  const g = s.datiRound.lanciatori[f.indice];
  if (g === undefined) throw new Error('nessun lanciatore corrente');
  return g;
}

/** Forza la faccia e fa lanciare il lanciatore corrente. */
function lancia(s: Stato, faccia: string): Stato {
  return applica(conFaccia(s, faccia), { tipo: 'lanciaDado', giocatore: lanciatoreCorrente(s) });
}

const dichiaraFurto = (s: Stato, furto: Furto, giocatore: IdGiocatore = 'g1'): Stato =>
  applica(s, { tipo: 'dichiaraDado', giocatore, furto });

const dichiaraTestata = (s: Stato, bersaglio: IdGiocatore, giocatore: IdGiocatore = 'g1'): Stato =>
  applica(s, { tipo: 'dichiaraDado', giocatore, bersaglio });

const esitoTestata = (s: Stato, esito: number, giocatore: IdGiocatore = 'g1'): Stato =>
  applica(s, { tipo: 'esitoTestata', giocatore, esito });

/** L'azione è rifiutata con ErroreRegola e lo stato di partenza resta intatto (specifica 1). */
function rifiuta(s: Stato, azione: Azione): void {
  const copia = structuredClone(s);
  expect(() => applica(s, azione), JSON.stringify(azione)).toThrow(ErroreRegola);
  expect(s).toEqual(copia);
}

function cima(s: Stato): VocePila {
  const v = s.pila[s.pila.length - 1];
  if (!v) throw new Error('pila vuota');
  return v;
}

function giocatore(s: Stato, id: IdGiocatore): StatoGiocatore {
  const g = s.giocatori.find((x) => x.id === id);
  if (!g) throw new Error(`giocatore ${id} inesistente`);
  return g;
}

const agnellini = (s: Stato, id: IdGiocatore): number => giocatore(s, id).agnellini;
const ordinati = (ids: readonly IdGiocatore[]): IdGiocatore[] => [...ids].sort();

function eventiDa<T extends Evento['tipo']>(s: Stato, tipo: T, daSeq: number): EventoDi<T>[] {
  return s.eventi.filter((e): e is EventoDi<T> => e.tipo === tipo && e.seq >= daSeq);
}

function passo(s: Stato): FaseDi<'risoluzione_dado'>['passo'] {
  return inFase(s, 'risoluzione_dado').passo;
}

function dichiarazione(s: Stato): DichiarazioneDado {
  const d = inFase(s, 'risoluzione_dado').dichiarazione;
  if (!d) throw new Error('nessuna dichiarazione');
  return d;
}

/** Ripartizione senza le voci a zero: la forma (zeri presenti o assenti) non è vincolata dalla specifica. */
function senzaZeri(r: Furto): Furto {
  return Object.fromEntries(Object.entries(r).filter(([, n]) => n !== 0));
}

function furtoDichiarato(s: Stato): { daAvversari: Furto; dalGregge: number } {
  const d = dichiarazione(s);
  if (d.effetto !== 'furto') throw new Error(`dichiarazione '${d.effetto}', attesa 'furto'`);
  return { daAvversari: senzaZeri(d.daAvversari), dalGregge: d.dalGregge };
}

/** Chiave canonica di una ripartizione, per confrontare insiemi di ripartizioni. */
function chiave(r: Furto): string {
  return Object.entries(senzaZeri(r))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([g, n]) => `${g}:${n}`)
    .join(',');
}

function dichiarazioniPossibili(s: Stato, chi: IdGiocatore = 'g1'): AzioneDi<'dichiaraDado'>[] {
  return azioniPossibili(s, chi).filter((a): a is AzioneDi<'dichiaraDado'> => a.tipo === 'dichiaraDado');
}

const ripartizioniPossibili = (s: Stato, chi: IdGiocatore = 'g1'): string[] =>
  dichiarazioniPossibili(s, chi)
    .map((a) => chiave(a.furto ?? {}))
    .sort();

/** Spostamenti di agnellini verso `a` dal numero di sequenza indicato, in ordine. */
function arrivi(s: Stato, a: Luogo, daSeq: number): Array<{ da: Luogo; quanti: number }> {
  return eventiDa(s, 'agnellini', daSeq)
    .filter((e) => e.a === a)
    .map((e) => ({ da: e.da, quanti: e.quanti }));
}

/** Somma degli spostamenti per provenienza. */
function perProvenienza(spostamenti: Array<{ da: Luogo; quanti: number }>): Record<string, number> {
  const r: Record<string, number> = {};
  for (const { da, quanti } of spostamenti) r[da] = (r[da] ?? 0) + quanti;
  return r;
}

function facceLanciate(s: Stato, daSeq: number): Array<{ giocatore: IdGiocatore; faccia: string }> {
  return eventiDa(s, 'dado_lanciato', daSeq).map((e) => ({ giocatore: e.giocatore, faccia: e.faccia }));
}

/** Nessuna voce in pila, nessuna finestra: il risultato non ha fatto nulla (D22). */
function senzaFinestra(s: Stato, daSeq: number): void {
  expect(s.pila).toEqual([]);
  expect(s.finestra).toBeNull();
  expect(eventiDa(s, 'dichiarazione', daSeq)).toEqual([]);
}

/** Posti dell'Ovile nella partita a 3 giocatori, quella degli scenari di questo file (salvo dove indicato). */
const POSTI = configPer(3).postiOvile;

const DOPO_IL_DADO_G3: Fase = { nome: 'guaio_al_peggiore', destinatario: 'g3', spareggio: null };

// ─── Dati ────────────────────────────────────────────────────────────────────

describe('Dado del Pastore: dati (brief "Il Dado del Pastore", setup.json, specifica 3)', () => {
  it('le sei facce e l\'esito massimo della Testata sono copiati in config dalla preparazione', () => {
    const s = treGiocatori();
    expect(s.config.dado).toEqual(setupJson.dado);
    expect(s.config.dado.map((f) => [f.id, f.effetto, f.quantita, f.copie])).toEqual([
      ['pascolo_piccolo', 'pascolo', 3, 1],
      ['pascolo_grande', 'pascolo', 5, 1],
      ['furto_piccolo', 'furto', 2, 1],
      ['furto_grande', 'furto', 4, 1],
      ['testata', 'testata', 3, 2],
    ]);
    expect(s.config.dado.reduce((n, f) => n + f.copie, 0)).toBe(6);
    expect(s.config.esitoMassimoTestata).toBe(setupJson.testata.esitoMassimo);
    expect(s.config.esitoMassimoTestata).toBe(3);
  });
});

// ─── Lancio ──────────────────────────────────────────────────────────────────

describe('lancio del dado (4.6, 4.7, 11)', () => {
  it('chiuso il punteggio, il più alto è l\'unico lanciatore e la fase dado aspetta lui', () => {
    const s = treGiocatori();
    expect(s.datiRound.piuAlti).toEqual(['g1']);
    expect(s.datiRound.piuBassi).toEqual(['g3']);
    expect(s.datiRound.lanciatori).toEqual(['g1']);
    expect(s.fase).toEqual({ nome: 'dado', indice: 0 });
    expect(s.pila).toEqual([]);
    expect(s.finestra).toBeNull();
    expect(inAttesaDi(s)).toEqual({ sistema: false, giocatori: ['g1'] });
    expect(vistaPer(s, 'g2').attesa.giocatori).toEqual(['g1']);
    expect(azioniPossibili(s, 'g1')).toContainEqual({ tipo: 'lanciaDado', giocatore: 'g1' });
    expect(azioniPossibili(s, 'g2').some((a) => a.tipo === 'lanciaDado')).toBe(false);
    expect(azioniPossibili(s, 'sistema')).toEqual([]);
    expect(eFaseAutomatica('dado')).toBe(false);
    expect(eFaseAutomatica('risoluzione_dado')).toBe(false);
  });

  it.each(['pascolo_piccolo', 'pascolo_grande', 'furto_piccolo', 'furto_grande', 'testata'])(
    'lanciaDado con conFaccia(%s) produce quella faccia: evento dado_lanciato e risoluzione_dado',
    (faccia) => {
      const s0 = treGiocatori();
      const s = lancia(s0, faccia);
      expect(facceLanciate(s, s0.prossimoEvento)).toEqual([{ giocatore: 'g1', faccia }]);
      // Con 3 agnellini a testa e il Gregge pieno ogni faccia ha qualcosa da fare.
      expect(inFase(s, 'risoluzione_dado')).toMatchObject({ indice: 0, lanciatore: 'g1', faccia });
    },
  );

  it('stesso stato + lanciaDado ⇒ stesso risultato; lo stato di partenza non cambia (specifica 1)', () => {
    const s = conFaccia(treGiocatori(), 'furto_piccolo');
    const copia = structuredClone(s);
    const azione: Azione = { tipo: 'lanciaDado', giocatore: 'g1' };
    const a = applica(s, azione);
    const b = applica(s, azione);
    expect(a).toEqual(b);
    expect(s).toEqual(copia);
    expect(a.fase).not.toEqual(s.fase);
  });

  it(
    'su molti valori del generatore le facce escono in proporzione alle copie: 2/6 Testata, 1/6 le altre (4.7)',
    { timeout: 120_000 },
    () => {
      const s = treGiocatori();
      const N = 6000;
      const conteggi: Record<string, number> = {};
      for (let i = 0; i < N; i++) {
        const rng = Math.imul(i + 1, 0x9e3779b1) >>> 0;
        const dopo = applica({ ...s, rng }, { tipo: 'lanciaDado', giocatore: 'g1' });
        const lanci = facceLanciate(dopo, s.prossimoEvento);
        if (lanci.length !== 1 || !lanci[0]) throw new Error(`lanci inattesi con rng ${rng}: ${JSON.stringify(lanci)}`);
        conteggi[lanci[0].faccia] = (conteggi[lanci[0].faccia] ?? 0) + 1;
      }
      expect(Object.keys(conteggi).sort()).toEqual(s.config.dado.map((f) => f.id).sort());
      for (const f of s.config.dado) {
        const attesi = (N * f.copie) / 6;
        const visti = conteggi[f.id] ?? 0;
        // Tolleranza del 12%: oltre 4 deviazioni standard per le facce da 1/6.
        expect(Math.abs(visti - attesi), `${f.id}: ${visti} su ${N}, attesi circa ${attesi}`).toBeLessThanOrEqual(attesi * 0.12);
      }
    },
  );
});

// ─── Solo il lanciatore ──────────────────────────────────────────────────────

describe('solo il lanciatore corrente lancia e dichiara (4.7, 11)', () => {
  it('nella fase dado: gli altri non lanciano; dichiarazioni, esiti e prosegui sono rifiutati', () => {
    const s = treGiocatori();
    rifiuta(s, { tipo: 'lanciaDado', giocatore: 'g2' });
    rifiuta(s, { tipo: 'lanciaDado', giocatore: 'g3' });
    rifiuta(s, { tipo: 'lanciaDado', giocatore: 'gX' });
    rifiuta(s, { tipo: 'dichiaraDado', giocatore: 'g1', bersaglio: 'g2' });
    rifiuta(s, { tipo: 'dichiaraDado', giocatore: 'g1', furto: { g2: 1, g3: 1 } });
    rifiuta(s, { tipo: 'esitoTestata', giocatore: 'g1', esito: 1 });
    rifiuta(s, { tipo: 'prosegui' });
  });

  it('lanciaDado fuori dalla fase dado è rifiutato (finestra dei Belati di punteggio)', () => {
    let s = prosegui(
      scenario({ guaio: SENZA_TRATTI, mani: { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['sasso-comodo'] } }),
    );
    s = prosegui(scegli(s, { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['sasso-comodo'] }));
    expect(s.fase.nome).toBe('belati_punteggio');
    rifiuta(s, { tipo: 'lanciaDado', giocatore: 'g1' });
  });

  it('al passo dichiarazione (furto): solo il lanciatore dichiara; niente secondo lancio né esito', () => {
    const s = lancia(treGiocatori(), 'furto_piccolo');
    expect(passo(s)).toBe('dichiarazione');
    rifiuta(s, { tipo: 'dichiaraDado', giocatore: 'g2', furto: { g1: 1, g3: 1 } });
    rifiuta(s, { tipo: 'dichiaraDado', giocatore: 'g2', furto: { g3: 2 } });
    rifiuta(s, { tipo: 'dichiaraDado', giocatore: 'g3', furto: { g2: 2 } });
    rifiuta(s, { tipo: 'lanciaDado', giocatore: 'g1' });
    rifiuta(s, { tipo: 'esitoTestata', giocatore: 'g1', esito: 1 });
    rifiuta(s, { tipo: 'prosegui' });
    expect(dichiarazioniPossibili(s, 'g2')).toEqual([]);
    expect(dichiarazioniPossibili(s, 'g3')).toEqual([]);
  });

  it('al passo dichiarazione (Testata): solo il lanciatore sceglie il bersaglio', () => {
    const s = lancia(treGiocatori(), 'testata');
    expect(passo(s)).toBe('dichiarazione');
    rifiuta(s, { tipo: 'dichiaraDado', giocatore: 'g2', bersaglio: 'g3' });
    rifiuta(s, { tipo: 'dichiaraDado', giocatore: 'g3', bersaglio: 'g2' });
    rifiuta(s, { tipo: 'esitoTestata', giocatore: 'g1', esito: 0 });
  });

  it('al passo reazione il lanciatore non può più dichiarare né dare l\'esito della Testata', () => {
    const s = dichiaraTestata(lancia(treGiocatori(), 'testata'), 'g2');
    expect(passo(s)).toBe('reazione');
    rifiuta(s, { tipo: 'dichiaraDado', giocatore: 'g1', bersaglio: 'g3' });
    rifiuta(s, { tipo: 'esitoTestata', giocatore: 'g1', esito: 1 });
    rifiuta(s, { tipo: 'lanciaDado', giocatore: 'g1' });
  });

  it('al passo esito_testata solo il lanciatore dà l\'esito', () => {
    const s = nessunaReazione(dichiaraTestata(lancia(treGiocatori(), 'testata'), 'g2'));
    expect(passo(s)).toBe('esito_testata');
    rifiuta(s, { tipo: 'esitoTestata', giocatore: 'g2', esito: 1 });
    rifiuta(s, { tipo: 'esitoTestata', giocatore: 'g3', esito: 1 });
    rifiuta(s, { tipo: 'dichiaraDado', giocatore: 'g1', bersaglio: 'g3' });
    rifiuta(s, { tipo: 'prosegui' });
  });
});

// ─── Pascolo ─────────────────────────────────────────────────────────────────

describe('Pascolo (brief "Il Dado del Pastore", 4.7, 9.1, D22)', () => {
  it('Pascolo piccolo: dichiarazione automatica, finestra agli altri, poi +3 dal Gregge e si passa al Guaio', () => {
    const s0 = treGiocatori();
    const gregge = s0.gregge;
    const seq = s0.prossimoEvento;
    let s = lancia(s0, 'pascolo_piccolo');

    const f = inFase(s, 'risoluzione_dado');
    expect(f).toMatchObject({ indice: 0, lanciatore: 'g1', faccia: 'pascolo_piccolo', passo: 'reazione' });
    expect(f.dichiarazione).toEqual({ effetto: 'pascolo', quantita: 3 });
    expect(s.pila).toHaveLength(1);
    const voce = cima(s);
    expect(voce.autore).toBe('g1');
    expect(voce.dettagli).toEqual({ tipo: 'dado', faccia: 'pascolo_piccolo', dichiarazione: { effetto: 'pascolo', quantita: 3 } });
    expect(eventiDa(s, 'dichiarazione', seq)).toEqual([
      expect.objectContaining({ voce: voce.id, autore: 'g1', dettagli: voce.dettagli }),
    ]);
    expect(s.finestra?.voce).toBe(voce.id);
    expect(ordinati(s.finestra?.inAttesa ?? [])).toEqual(['g2', 'g3']);
    expect(ordinati(inAttesaDi(s).giocatori)).toEqual(['g2', 'g3']);
    // Niente è ancora applicato finché la finestra è aperta.
    expect(agnellini(s, 'g1')).toBe(3);
    expect(s.gregge).toBe(gregge);

    s = nessunaReazione(s);
    expect(agnellini(s, 'g1')).toBe(6);
    expect(s.gregge).toBe(gregge - 3);
    expect(arrivi(s, 'g1', seq)).toEqual([{ da: 'gregge', quanti: 3 }]);
    expect(eventiDa(s, 'risolta', seq).map((e) => e.voce)).toContain(voce.id);
    expect(s.pila).toEqual([]);
    expect(s.finestra).toBeNull();
    expect(s.fase).toEqual(DOPO_IL_DADO_G3);
  });

  it('Pascolo grande: +5 dal Gregge', () => {
    const s0 = treGiocatori();
    let s = lancia(s0, 'pascolo_grande');
    expect(dichiarazione(s)).toEqual({ effetto: 'pascolo', quantita: 5 });
    s = nessunaReazione(s);
    expect(agnellini(s, 'g1')).toBe(8);
    expect(s.gregge).toBe(s0.gregge - 5);
    expect(s.fase).toEqual(DOPO_IL_DADO_G3);
  });

  it.each(['pascolo_piccolo', 'pascolo_grande'])('%s con Gregge 2 ⇒ si prendono solo 2 agnellini', (faccia) => {
    let s = lancia(treGiocatori({ gregge: 2 }), faccia);
    expect(dichiarazione(s)).toEqual({ effetto: 'pascolo', quantita: 2 });
    s = nessunaReazione(s);
    expect(agnellini(s, 'g1')).toBe(5);
    expect(s.gregge).toBe(0);
    expect(s.fase).toEqual(DOPO_IL_DADO_G3);
  });

  it(`limitato dai posti liberi: con ${POSTI - 2} agnellini su ${POSTI} il Pascolo grande ne dà 2 e l'Ovile pieno vince subito (9.1)`, () => {
    const s0 = treGiocatori({ agnellini: { g1: POSTI - 2 }, gregge: 20 });
    const seq = s0.prossimoEvento;
    let s = lancia(s0, 'pascolo_grande');
    expect(dichiarazione(s)).toEqual({ effetto: 'pascolo', quantita: 2 });
    s = nessunaReazione(s);
    expect(agnellini(s, 'g1')).toBe(POSTI);
    expect(s.gregge).toBe(18);
    expect(s.esito).toEqual({ modo: 'ovile_pieno', vincitori: ['g1'] });
    expect(s.fase).toEqual({ nome: 'fine_partita' });
    expect(s.pila).toEqual([]);
    expect(s.finestra).toBeNull();
    expect(eventiDa(s, 'fine_partita', seq)).toEqual([
      expect.objectContaining({ esito: { modo: 'ovile_pieno', vincitori: ['g1'] } }),
    ]);
    rifiuta(s, { tipo: 'prosegui' });
  });

  it(`limitato dai posti liberi anche con il Pascolo piccolo: ${POSTI - 1} agnellini su ${POSTI} ⇒ +1`, () => {
    let s = lancia(treGiocatori({ agnellini: { g1: POSTI - 1 }, gregge: 20 }), 'pascolo_piccolo');
    expect(dichiarazione(s)).toEqual({ effetto: 'pascolo', quantita: 1 });
    s = nessunaReazione(s);
    expect(agnellini(s, 'g1')).toBe(POSTI);
    expect(s.gregge).toBe(19);
    expect(s.esito).toEqual({ modo: 'ovile_pieno', vincitori: ['g1'] });
  });

  it.each(['pascolo_piccolo', 'pascolo_grande'])(
    '%s con Gregge vuoto: nessun effetto, nessuna voce, nessuna finestra, si passa oltre (D22, 5)',
    (faccia) => {
      const s0 = treGiocatori({ gregge: 0 });
      const seq = s0.prossimoEvento;
      const s = lancia(s0, faccia);
      expect(facceLanciate(s, seq)).toEqual([{ giocatore: 'g1', faccia }]);
      senzaFinestra(s, seq);
      expect(agnellini(s, 'g1')).toBe(3);
      expect(s.gregge).toBe(0);
      expect(arrivi(s, 'g1', seq)).toEqual([]);
      expect(s.fase).toEqual(DOPO_IL_DADO_G3);
    },
  );

  it('senza Guaio nel round, dopo il dado si va a fine_round (4.8)', () => {
    const s = nessunaReazione(lancia(treGiocatori({ guaio: null, mazzoGuai: [] }), 'pascolo_piccolo'));
    expect(agnellini(s, 'g1')).toBe(6);
    expect(s.fase).toEqual({ nome: 'fine_round' });
  });
});

// ─── Furto ───────────────────────────────────────────────────────────────────

describe('Furto: ripartizione libera (brief "Il Dado del Pastore", 4.7, D4, D20)', () => {
  it('Furto piccolo con due avversari che hanno agnellini: si aspetta la dichiarazione del lanciatore', () => {
    const s0 = treGiocatori();
    const seq = s0.prossimoEvento;
    const s = lancia(s0, 'furto_piccolo');
    const f = inFase(s, 'risoluzione_dado');
    expect(f).toMatchObject({ lanciatore: 'g1', faccia: 'furto_piccolo', passo: 'dichiarazione', dichiarazione: null });
    expect(s.pila).toEqual([]);
    expect(s.finestra).toBeNull();
    expect(eventiDa(s, 'dichiarazione', seq)).toEqual([]);
    expect(inAttesaDi(s)).toEqual({ sistema: false, giocatori: ['g1'] });
    const vista = vistaPer(s, 'g2');
    expect(vista.fase).toEqual(s.fase);
    expect(vista.attesa.giocatori).toEqual(['g1']);
    // Tutte le ripartizioni valide di 2 agnellini tra g2 e g3 (2).
    expect(ripartizioniPossibili(s)).toEqual(['g2:1,g3:1', 'g2:2', 'g3:2']);
    for (const a of dichiarazioniPossibili(s)) expect(() => applica(s, a), JSON.stringify(a)).not.toThrow();
  });

  it('dichiarata la ripartizione, va in pila con la finestra; risolta, gli agnellini passano al lanciatore', () => {
    const s0 = lancia(treGiocatori(), 'furto_piccolo');
    const seq = s0.prossimoEvento;
    let s = dichiaraFurto(s0, { g2: 1, g3: 1 });
    expect(passo(s)).toBe('reazione');
    expect(furtoDichiarato(s)).toEqual({ daAvversari: { g2: 1, g3: 1 }, dalGregge: 0 });
    const voce = cima(s);
    expect(s.pila).toHaveLength(1);
    expect(voce.autore).toBe('g1');
    expect(voce.dettagli.tipo).toBe('dado');
    if (voce.dettagli.tipo === 'dado' && voce.dettagli.dichiarazione.effetto === 'furto') {
      expect(voce.dettagli.faccia).toBe('furto_piccolo');
      expect(senzaZeri(voce.dettagli.dichiarazione.daAvversari)).toEqual({ g2: 1, g3: 1 });
      expect(voce.dettagli.dichiarazione.dalGregge).toBe(0);
    } else {
      throw new Error('voce di furto attesa');
    }
    expect(eventiDa(s, 'dichiarazione', seq)).toHaveLength(1);
    expect(s.finestra?.voce).toBe(voce.id);
    expect(ordinati(s.finestra?.inAttesa ?? [])).toEqual(['g2', 'g3']);
    expect(agnellini(s, 'g2')).toBe(3);

    const gregge = s.gregge;
    s = nessunaReazione(s);
    expect(agnellini(s, 'g1')).toBe(5);
    expect(agnellini(s, 'g2')).toBe(2);
    expect(agnellini(s, 'g3')).toBe(2);
    expect(s.gregge).toBe(gregge);
    expect(perProvenienza(arrivi(s, 'g1', seq))).toEqual({ g2: 1, g3: 1 });
    expect(s.fase).toEqual(DOPO_IL_DADO_G3);
  });

  it('Furto grande: la ripartizione può pesare tutta su un avversario, fino ai suoi agnellini', () => {
    let s = lancia(treGiocatori(), 'furto_grande');
    expect(passo(s)).toBe('dichiarazione');
    expect(ripartizioniPossibili(s)).toEqual(['g2:1,g3:3', 'g2:2,g3:2', 'g2:3,g3:1']);
    rifiuta(s, { tipo: 'dichiaraDado', giocatore: 'g1', furto: { g2: 4, g3: 0 } });
    s = nessunaReazione(dichiaraFurto(s, { g2: 3, g3: 1 }));
    expect(agnellini(s, 'g1')).toBe(7);
    expect(agnellini(s, 'g2')).toBe(0);
    expect(agnellini(s, 'g3')).toBe(2);
  });

  it('dichiarazioni non valide: somma sbagliata, negativi, non interi, troppi, se stessi, sconosciuti, senza ripartizione', () => {
    // g2 ha 3 agnellini, g3 solo 1: 2 da rubare, ripartizione libera.
    const s = lancia(treGiocatori({ agnellini: { g3: 1 } }), 'furto_piccolo');
    expect(passo(s)).toBe('dichiarazione');
    const furto = (r: Furto): Azione => ({ tipo: 'dichiaraDado', giocatore: 'g1', furto: r });
    rifiuta(s, furto({ g2: 1, g3: 0 }));
    rifiuta(s, furto({ g2: 2, g3: 1 }));
    rifiuta(s, furto({}));
    rifiuta(s, furto({ g2: 3, g3: -1 }));
    rifiuta(s, furto({ g2: 1.5, g3: 0.5 }));
    rifiuta(s, furto({ g2: Number.NaN, g3: 1 }));
    rifiuta(s, furto({ g2: 0, g3: 2 }));
    rifiuta(s, furto({ g1: 1, g2: 1 }));
    rifiuta(s, furto({ g1: 1, g3: 1 }));
    rifiuta(s, furto({ gX: 1, g2: 1 }));
    rifiuta(s, { tipo: 'dichiaraDado', giocatore: 'g1' });
    rifiuta(s, { tipo: 'dichiaraDado', giocatore: 'g1', bersaglio: 'g2' });
    expect(ripartizioniPossibili(s)).toEqual(['g2:1,g3:1', 'g2:2']);
    const dopo = nessunaReazione(dichiaraFurto(s, { g2: 2, g3: 0 }));
    expect(agnellini(dopo, 'g1')).toBe(5);
    expect(agnellini(dopo, 'g2')).toBe(1);
    expect(agnellini(dopo, 'g3')).toBe(1);
  });

  it('un eliminato non è una vittima, nemmeno se (artificialmente) avesse agnellini', () => {
    const s = lancia(conEliminatoG4({ g4: 2 }), 'furto_piccolo');
    expect(passo(s)).toBe('dichiarazione');
    rifiuta(s, { tipo: 'dichiaraDado', giocatore: 'g1', furto: { g2: 1, g3: 0, g4: 1 } });
    rifiuta(s, { tipo: 'dichiaraDado', giocatore: 'g1', furto: { g4: 2 } });
    expect(ripartizioniPossibili(s)).toEqual(['g2:1,g3:1', 'g2:2', 'g3:2']);
  });

  it('elenca tutte le ripartizioni valide (specifica 2): 4 agnellini da g2 (3), g3 (1), g4 (3) ⇒ 7', () => {
    const s = lancia(quattroGiocatori({ agnellini: { g3: 1 } }), 'furto_grande');
    expect(passo(s)).toBe('dichiarazione');
    const attese: string[] = [];
    for (let a = 0; a <= 3; a++) {
      for (let b = 0; b <= 1; b++) {
        for (let c = 0; c <= 3; c++) if (a + b + c === 4) attese.push(chiave({ g2: a, g3: b, g4: c }));
      }
    }
    expect(attese).toHaveLength(7);
    expect(ripartizioniPossibili(s)).toEqual(attese.sort());
    for (const a of dichiarazioniPossibili(s)) expect(() => applica(s, a), JSON.stringify(a)).not.toThrow();
  });

  it(`limitato dai posti liberi: con ${POSTI - 2} agnellini su ${POSTI} il Furto grande ruba 2 (somma 4 rifiutata) e l'Ovile pieno vince (9.1)`, () => {
    let s = lancia(treGiocatori({ agnellini: { g1: POSTI - 2 } }), 'furto_grande');
    expect(passo(s)).toBe('dichiarazione');
    rifiuta(s, { tipo: 'dichiaraDado', giocatore: 'g1', furto: { g2: 2, g3: 2 } });
    rifiuta(s, { tipo: 'dichiaraDado', giocatore: 'g1', furto: { g2: 3, g3: 0 } });
    expect(ripartizioniPossibili(s)).toEqual(['g2:1,g3:1', 'g2:2', 'g3:2']);
    const gregge = s.gregge;
    s = nessunaReazione(dichiaraFurto(s, { g2: 1, g3: 1 }));
    expect(agnellini(s, 'g1')).toBe(POSTI);
    expect(agnellini(s, 'g2')).toBe(2);
    expect(agnellini(s, 'g3')).toBe(2);
    expect(s.gregge).toBe(gregge);
    expect(s.esito).toEqual({ modo: 'ovile_pieno', vincitori: ['g1'] });
    expect(s.fase).toEqual({ nome: 'fine_partita' });
  });
});

describe('Furto: ripartizione obbligata e mancanti dal Gregge (brief "Il Dado del Pastore", 4.7, D20)', () => {
  it('un solo avversario con agnellini ⇒ dichiarazione automatica, finestra subito', () => {
    const s0 = treGiocatori({ agnellini: { g2: 0 } });
    const seq = s0.prossimoEvento;
    let s = lancia(s0, 'furto_piccolo');
    expect(passo(s)).toBe('reazione');
    expect(furtoDichiarato(s)).toEqual({ daAvversari: { g3: 2 }, dalGregge: 0 });
    expect(s.pila).toHaveLength(1);
    expect(eventiDa(s, 'dichiarazione', seq)).toHaveLength(1);
    expect(ordinati(s.finestra?.inAttesa ?? [])).toEqual(['g2', 'g3']);
    rifiuta(s, { tipo: 'dichiaraDado', giocatore: 'g1', furto: { g3: 2 } });
    s = nessunaReazione(s);
    expect(agnellini(s, 'g1')).toBe(5);
    expect(agnellini(s, 'g3')).toBe(1);
    expect(s.fase).toEqual(DOPO_IL_DADO_G3);
  });

  it('se vanno presi tutti gli agnellini degli avversari (esattamente quanti servono) la dichiarazione è automatica', () => {
    let s = lancia(treGiocatori({ agnellini: { g2: 1, g3: 1 } }), 'furto_piccolo');
    expect(passo(s)).toBe('reazione');
    expect(furtoDichiarato(s)).toEqual({ daAvversari: { g2: 1, g3: 1 }, dalGregge: 0 });
    s = nessunaReazione(s);
    expect(agnellini(s, 'g1')).toBe(5);
    expect(agnellini(s, 'g2')).toBe(0);
    expect(agnellini(s, 'g3')).toBe(0);
  });

  it('avversari senza abbastanza agnellini: si prendono tutti i loro e i mancanti dal Gregge, prima gli avversari', () => {
    const s0 = lancia(treGiocatori({ agnellini: { g2: 2, g3: 1 }, gregge: 10 }), 'furto_grande');
    expect(passo(s0)).toBe('reazione');
    expect(furtoDichiarato(s0)).toEqual({ daAvversari: { g2: 2, g3: 1 }, dalGregge: 1 });
    const seq = s0.prossimoEvento;
    const s = nessunaReazione(s0);
    expect(agnellini(s, 'g1')).toBe(7);
    expect(agnellini(s, 'g2')).toBe(0);
    expect(agnellini(s, 'g3')).toBe(0);
    expect(s.gregge).toBe(9);
    const spostamenti = arrivi(s, 'g1', seq);
    expect(perProvenienza(spostamenti)).toEqual({ g2: 2, g3: 1, gregge: 1 });
    const provenienze = spostamenti.map((e) => e.da);
    const primoGregge = provenienze.indexOf('gregge');
    expect(primoGregge).toBe(provenienze.length - 1);
  });

  it('un solo avversario con meno agnellini del furto: tutti i suoi, il resto dal Gregge', () => {
    let s = lancia(treGiocatori({ agnellini: { g2: 1, g3: 0 }, gregge: 10 }), 'furto_grande');
    expect(passo(s)).toBe('reazione');
    expect(furtoDichiarato(s)).toEqual({ daAvversari: { g2: 1 }, dalGregge: 3 });
    s = nessunaReazione(s);
    expect(agnellini(s, 'g1')).toBe(7);
    expect(agnellini(s, 'g2')).toBe(0);
    expect(s.gregge).toBe(7);
  });

  it('avversari senza agnellini: tutto dal Gregge', () => {
    let s = lancia(treGiocatori({ agnellini: { g2: 0, g3: 0 }, gregge: 10 }), 'furto_piccolo');
    expect(passo(s)).toBe('reazione');
    expect(furtoDichiarato(s)).toEqual({ daAvversari: {}, dalGregge: 2 });
    s = nessunaReazione(s);
    expect(agnellini(s, 'g1')).toBe(5);
    expect(s.gregge).toBe(8);
  });

  it('Gregge insufficiente: si prendono solo quelli che ci sono', () => {
    let s = lancia(treGiocatori({ agnellini: { g2: 1, g3: 0 }, gregge: 1 }), 'furto_grande');
    expect(furtoDichiarato(s)).toEqual({ daAvversari: { g2: 1 }, dalGregge: 1 });
    s = nessunaReazione(s);
    expect(agnellini(s, 'g1')).toBe(5);
    expect(agnellini(s, 'g2')).toBe(0);
    expect(s.gregge).toBe(0);
  });

  it(`posti liberi prima di tutto: ${POSTI - 1} agnellini su ${POSTI} ⇒ si ruba 1 solo agnellino e si vince (9.1)`, () => {
    let s = lancia(treGiocatori({ agnellini: { g1: POSTI - 1, g2: 3, g3: 0 } }), 'furto_grande');
    expect(passo(s)).toBe('reazione');
    expect(furtoDichiarato(s)).toEqual({ daAvversari: { g2: 1 }, dalGregge: 0 });
    s = nessunaReazione(s);
    expect(agnellini(s, 'g1')).toBe(POSTI);
    expect(agnellini(s, 'g2')).toBe(2);
    expect(s.esito).toEqual({ modo: 'ovile_pieno', vincitori: ['g1'] });
  });

  it('gli eliminati non contano tra gli avversari: i mancanti vengono dal Gregge', () => {
    let s = lancia(conEliminatoG4({ g2: 1, g3: 0, g4: 3 }, { gregge: 10 }), 'furto_grande');
    expect(passo(s)).toBe('reazione');
    expect(furtoDichiarato(s)).toEqual({ daAvversari: { g2: 1 }, dalGregge: 3 });
    s = nessunaReazione(s);
    expect(agnellini(s, 'g1')).toBe(7);
    expect(agnellini(s, 'g4')).toBe(3);
    expect(s.gregge).toBe(7);
  });

  it.each(['furto_piccolo', 'furto_grande'])(
    '%s senza agnellini da nessuna parte: nessun effetto, nessuna finestra (D22)',
    (faccia) => {
      const s0 = treGiocatori({ agnellini: { g2: 0, g3: 0 }, gregge: 0 });
      const seq = s0.prossimoEvento;
      const s = lancia(s0, faccia);
      expect(facceLanciate(s, seq)).toEqual([{ giocatore: 'g1', faccia }]);
      senzaFinestra(s, seq);
      expect(agnellini(s, 'g1')).toBe(3);
      expect(s.fase).toEqual(DOPO_IL_DADO_G3);
    },
  );
});

// ─── Testata ─────────────────────────────────────────────────────────────────

describe('Testata del Montone (brief "Il Dado del Pastore", 4.7, D4, D21)', () => {
  it('più bersagli validi: il lanciatore dichiara il bersaglio, poi finestra, poi l\'esito; gli agnellini tornano nel Gregge', () => {
    const s0 = treGiocatori({ agnellini: { g3: 2 } });
    const seq = s0.prossimoEvento;
    let s = lancia(s0, 'testata');
    expect(inFase(s, 'risoluzione_dado')).toMatchObject({ faccia: 'testata', passo: 'dichiarazione', dichiarazione: null });
    expect(s.pila).toEqual([]);
    expect(inAttesaDi(s)).toEqual({ sistema: false, giocatori: ['g1'] });
    expect(
      dichiarazioniPossibili(s)
        .map((a) => a.bersaglio)
        .sort(),
    ).toEqual(['g2', 'g3']);

    s = dichiaraTestata(s, 'g2');
    expect(passo(s)).toBe('reazione');
    expect(dichiarazione(s)).toEqual({ effetto: 'testata', bersaglio: 'g2' });
    const voce = cima(s);
    expect(s.pila).toHaveLength(1);
    expect(voce.autore).toBe('g1');
    expect(voce.dettagli).toEqual({ tipo: 'dado', faccia: 'testata', dichiarazione: { effetto: 'testata', bersaglio: 'g2' } });
    expect(ordinati(s.finestra?.inAttesa ?? [])).toEqual(['g2', 'g3']);

    // L'esito si gioca dopo la finestra (D21).
    s = nessunaReazione(s);
    expect(passo(s)).toBe('esito_testata');
    expect(s.pila).toEqual([]);
    expect(s.finestra).toBeNull();
    expect(inAttesaDi(s)).toEqual({ sistema: false, giocatori: ['g1'] });
    expect(agnellini(s, 'g2')).toBe(3);
    const esiti = azioniPossibili(s, 'g1')
      .filter((a): a is AzioneDi<'esitoTestata'> => a.tipo === 'esitoTestata')
      .map((a) => a.esito)
      .sort();
    expect(esiti).toEqual([0, 1, 2, 3]);

    const gregge = s.gregge;
    const seqEsito = s.prossimoEvento;
    s = esitoTestata(s, 2);
    expect(agnellini(s, 'g2')).toBe(1);
    expect(agnellini(s, 'g1')).toBe(3);
    expect(s.gregge).toBe(gregge + 2);
    expect(eventiDa(s, 'testata', seq)).toEqual([
      expect.objectContaining({ giocatore: 'g1', bersaglio: 'g2', esito: 2 }),
    ]);
    expect(perProvenienza(arrivi(s, 'gregge', seqEsito))).toEqual({ g2: 2 });
    expect(s.fase).toEqual(DOPO_IL_DADO_G3);
  });

  it('dichiarazione non valida: se stessi, sconosciuti, senza bersaglio', () => {
    const s = lancia(treGiocatori(), 'testata');
    expect(passo(s)).toBe('dichiarazione');
    rifiuta(s, { tipo: 'dichiaraDado', giocatore: 'g1', bersaglio: 'g1' });
    rifiuta(s, { tipo: 'dichiaraDado', giocatore: 'g1', bersaglio: 'gX' });
    rifiuta(s, { tipo: 'dichiaraDado', giocatore: 'g1' });
    rifiuta(s, { tipo: 'dichiaraDado', giocatore: 'g1', furto: { g2: 2 } });
  });

  it('un avversario senza agnellini non è un bersaglio valido', () => {
    const s = lancia(quattroGiocatori({ agnellini: { g4: 0 } }), 'testata');
    expect(passo(s)).toBe('dichiarazione');
    rifiuta(s, { tipo: 'dichiaraDado', giocatore: 'g1', bersaglio: 'g4' });
    expect(
      dichiarazioniPossibili(s)
        .map((a) => a.bersaglio)
        .sort(),
    ).toEqual(['g2', 'g3']);
  });

  it('un eliminato non è un bersaglio valido, nemmeno se (artificialmente) avesse agnellini', () => {
    const s = lancia(conEliminatoG4({ g4: 2 }), 'testata');
    expect(passo(s)).toBe('dichiarazione');
    rifiuta(s, { tipo: 'dichiaraDado', giocatore: 'g1', bersaglio: 'g4' });
    expect(
      dichiarazioniPossibili(s)
        .map((a) => a.bersaglio)
        .sort(),
    ).toEqual(['g2', 'g3']);
  });

  it('un solo bersaglio valido ⇒ dichiarazione automatica (anche escludendo eliminati e avversari a 0)', () => {
    const s0 = conEliminatoG4({ g3: 0, g4: 2 });
    const seq = s0.prossimoEvento;
    const s = lancia(s0, 'testata');
    expect(passo(s)).toBe('reazione');
    expect(dichiarazione(s)).toEqual({ effetto: 'testata', bersaglio: 'g2' });
    expect(cima(s).dettagli).toEqual({ tipo: 'dado', faccia: 'testata', dichiarazione: { effetto: 'testata', bersaglio: 'g2' } });
    expect(eventiDa(s, 'dichiarazione', seq)).toHaveLength(1);
    expect(ordinati(s.finestra?.inAttesa ?? [])).toEqual(['g2', 'g3']);
    rifiuta(s, { tipo: 'dichiaraDado', giocatore: 'g1', bersaglio: 'g2' });
  });

  it('nessun bersaglio valido ⇒ nessun effetto, nessuna finestra (D21, D22)', () => {
    const s0 = treGiocatori({ agnellini: { g2: 0, g3: 0 } });
    const seq = s0.prossimoEvento;
    const s = lancia(s0, 'testata');
    expect(facceLanciate(s, seq)).toEqual([{ giocatore: 'g1', faccia: 'testata' }]);
    senzaFinestra(s, seq);
    expect(eventiDa(s, 'testata', seq)).toEqual([]);
    expect(s.fase).toEqual(DOPO_IL_DADO_G3);
  });

  it('esito oltre gli agnellini del bersaglio rifiutato: con 1 agnellino solo 0 o 1', () => {
    let s = nessunaReazione(dichiaraTestata(lancia(treGiocatori({ agnellini: { g2: 1 } }), 'testata'), 'g2'));
    expect(passo(s)).toBe('esito_testata');
    const esiti = azioniPossibili(s, 'g1')
      .filter((a): a is AzioneDi<'esitoTestata'> => a.tipo === 'esitoTestata')
      .map((a) => a.esito)
      .sort();
    expect(esiti).toEqual([0, 1]);
    rifiuta(s, { tipo: 'esitoTestata', giocatore: 'g1', esito: 2 });
    rifiuta(s, { tipo: 'esitoTestata', giocatore: 'g1', esito: 3 });
    s = esitoTestata(s, 1);
    expect(agnellini(s, 'g2')).toBe(0);
    expect(s.fase).toEqual(DOPO_IL_DADO_G3);
  });

  it('esito massimo 3 anche se il bersaglio ne ha di più; 4, negativi e non interi rifiutati', () => {
    let s = lancia(treGiocatori({ agnellini: { g2: 5, g3: 0 } }), 'testata');
    s = nessunaReazione(s);
    expect(passo(s)).toBe('esito_testata');
    const esiti = azioniPossibili(s, 'g1')
      .filter((a): a is AzioneDi<'esitoTestata'> => a.tipo === 'esitoTestata')
      .map((a) => a.esito)
      .sort();
    expect(esiti).toEqual([0, 1, 2, 3]);
    for (const esito of [4, 5, -1, 0.5, 2.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      rifiuta(s, { tipo: 'esitoTestata', giocatore: 'g1', esito });
    }
    const gregge = s.gregge;
    s = esitoTestata(s, 3);
    expect(agnellini(s, 'g2')).toBe(2);
    expect(s.gregge).toBe(gregge + 3);
  });

  it('esito 0: nessun agnellino si muove, ma la Testata è registrata e si passa oltre', () => {
    let s = nessunaReazione(lancia(treGiocatori({ agnellini: { g3: 0 } }), 'testata'));
    expect(passo(s)).toBe('esito_testata');
    const gregge = s.gregge;
    const seq = s.prossimoEvento;
    s = esitoTestata(s, 0);
    expect(agnellini(s, 'g2')).toBe(3);
    expect(s.gregge).toBe(gregge);
    expect(eventiDa(s, 'testata', seq)).toEqual([expect.objectContaining({ giocatore: 'g1', bersaglio: 'g2', esito: 0 })]);
    expect(perProvenienza(arrivi(s, 'gregge', seq))).toEqual({});
    expect(s.fase).toEqual(DOPO_IL_DADO_G3);
  });
});

// ─── Beee-NO! sul dado ───────────────────────────────────────────────────────

describe('Beee-NO! sul risultato del dado (brief "Beee-NO!", 4.7, 5)', () => {
  it('un Pascolo annullato non dà agnellini e si passa oltre', () => {
    const s0 = lancia(treGiocatori({}, { g2: ['beee-no'] }), 'pascolo_piccolo');
    const voceDado = cima(s0).id;
    const gregge = s0.gregge;
    const seq = s0.prossimoEvento;
    let s = applica(s0, { tipo: 'giocaBelato', giocatore: 'g2', carta: carta(s0, 'g2', 'beee-no'), voce: voceDado });
    expect(s.pila).toHaveLength(2);
    s = nessunaReazione(s);
    expect(eventiDa(s, 'annullata', seq).map((e) => e.voce)).toEqual([voceDado]);
    expect(agnellini(s, 'g1')).toBe(3);
    expect(s.gregge).toBe(gregge);
    expect(s.pila).toEqual([]);
    expect(s.finestra).toBeNull();
    expect(s.fase).toEqual(DOPO_IL_DADO_G3);
  });

  it('una Testata annullata non arriva al minigioco', () => {
    const s0 = lancia(treGiocatori({ agnellini: { g3: 0 } }, { g3: ['beee-no'] }), 'testata');
    expect(passo(s0)).toBe('reazione');
    const seq = s0.prossimoEvento;
    let s = applica(s0, { tipo: 'giocaBelato', giocatore: 'g3', carta: carta(s0, 'g3', 'beee-no'), voce: cima(s0).id });
    s = nessunaReazione(s);
    expect(s.fase).toEqual(DOPO_IL_DADO_G3);
    expect(eventiDa(s, 'testata', seq)).toEqual([]);
    expect(agnellini(s, 'g2')).toBe(3);
    rifiuta(s, { tipo: 'esitoTestata', giocatore: 'g1', esito: 1 });
  });

  it('un Furto annullato non sposta agnellini', () => {
    const s0 = dichiaraFurto(lancia(treGiocatori({}, { g3: ['beee-no'] }), 'furto_grande'), { g2: 2, g3: 2 });
    let s = applica(s0, { tipo: 'giocaBelato', giocatore: 'g3', carta: carta(s0, 'g3', 'beee-no'), voce: cima(s0).id });
    s = nessunaReazione(s);
    expect(agnellini(s, 'g1')).toBe(3);
    expect(agnellini(s, 'g2')).toBe(3);
    expect(agnellini(s, 'g3')).toBe(3);
    expect(s.fase).toEqual(DOPO_IL_DADO_G3);
  });
});

// ─── Chi lancia ──────────────────────────────────────────────────────────────

describe('chi lancia: parità per il più alto, tutti pari, un solo partecipante (brief "Parità", 4.6, D19, D23, D34)', () => {
  it('parità per il più alto: lanciano entrambi, prima chi ha meno agnellini; l\'ordine resta fissato', () => {
    const s0 = pariAlVertice({ agnellini: { g1: 5, g2: 2 } });
    const seq = s0.prossimoEvento;
    expect(ordinati(s0.datiRound.piuAlti)).toEqual(['g1', 'g2']);
    expect(s0.datiRound.piuBassi).toEqual(['g3']);
    expect(s0.datiRound.lanciatori).toEqual(['g2', 'g1']);
    expect(s0.fase).toEqual({ nome: 'dado', indice: 0 });
    expect(inAttesaDi(s0)).toEqual({ sistema: false, giocatori: ['g2'] });
    rifiuta(s0, { tipo: 'lanciaDado', giocatore: 'g1' });

    // Il primo lancio porta g2 sopra g1: l'ordine non si ricalcola.
    let s = nessunaReazione(lancia(s0, 'pascolo_grande'));
    expect(agnellini(s, 'g2')).toBe(7);
    expect(s.fase).toEqual({ nome: 'dado', indice: 1 });
    expect(s.datiRound.lanciatori).toEqual(['g2', 'g1']);
    expect(inAttesaDi(s)).toEqual({ sistema: false, giocatori: ['g1'] });
    rifiuta(s, { tipo: 'lanciaDado', giocatore: 'g2' });

    s = nessunaReazione(lancia(s, 'pascolo_piccolo'));
    expect(agnellini(s, 'g1')).toBe(8);
    expect(facceLanciate(s, seq)).toEqual([
      { giocatore: 'g2', faccia: 'pascolo_grande' },
      { giocatore: 'g1', faccia: 'pascolo_piccolo' },
    ]);
    expect(s.fase).toEqual(DOPO_IL_DADO_G3);
  });

  it('ogni lancio ha la sua finestra: il secondo lanciatore può dichiarare un furto contro il primo', () => {
    let s = nessunaReazione(lancia(pariAlVertice({ agnellini: { g1: 5, g2: 2 } }), 'pascolo_piccolo'));
    expect(lanciatoreCorrente(s)).toBe('g1');
    s = lancia(s, 'furto_piccolo');
    expect(inFase(s, 'risoluzione_dado')).toMatchObject({ indice: 1, lanciatore: 'g1', passo: 'dichiarazione' });
    rifiuta(s, { tipo: 'dichiaraDado', giocatore: 'g2', furto: { g1: 1, g3: 1 } });
    s = dichiaraFurto(s, { g2: 2, g3: 0 });
    expect(ordinati(s.finestra?.inAttesa ?? [])).toEqual(['g2', 'g3']);
    s = nessunaReazione(s);
    expect(agnellini(s, 'g1')).toBe(7);
    expect(agnellini(s, 'g2')).toBe(3);
    expect(s.fase).toEqual(DOPO_IL_DADO_G3);
  });

  it('tre pari al vertice lanciano in ordine di agnellini crescenti', () => {
    const scelte: Scelte = { g1: ['carriola'], g2: ['carriola'], g3: ['carriola'], g4: ['sasso-comodo'] };
    const s = alDado({ giocatori: 4, mani: scelte, agnellini: { g1: 4, g2: 2, g3: 3 } }, scelte);
    expect(s.datiRound.lanciatori).toEqual(['g2', 'g3', 'g1']);
    expect(s.datiRound.piuBassi).toEqual(['g4']);
  });

  it('a parità di agnellini l\'ordine dei lanciatori è casuale col generatore (dipende dal seme, è riproducibile)', () => {
    const primi = new Set<IdGiocatore>();
    for (let seme = 1; seme <= 24; seme++) {
      const s = pariAlVertice({ seme });
      expect(ordinati(s.datiRound.lanciatori)).toEqual(['g1', 'g2']);
      const primo = s.datiRound.lanciatori[0];
      if (primo !== undefined) primi.add(primo);
    }
    expect([...primi].sort()).toEqual(['g1', 'g2']);
    expect(pariAlVertice({ seme: 7 }).datiRound.lanciatori).toEqual(pariAlVertice({ seme: 7 }).datiRound.lanciatori);
  });

  it('un primo lancio senza effetto passa subito al secondo lanciatore, senza finestra (D22)', () => {
    const s0 = pariAlVertice({ agnellini: { g1: 5, g2: 2 }, gregge: 0 });
    const seq = s0.prossimoEvento;
    const s = lancia(s0, 'pascolo_piccolo');
    senzaFinestra(s, seq);
    expect(s.fase).toEqual({ nome: 'dado', indice: 1 });
    expect(inAttesaDi(s)).toEqual({ sistema: false, giocatori: ['g1'] });
  });

  it('se il primo lancio riempie un Ovile la partita finisce e il secondo non lancia (D19, 9.1)', () => {
    const s0 = pariAlVertice({ agnellini: { g1: POSTI - 1, g2: POSTI - 2 } });
    expect(s0.datiRound.lanciatori).toEqual(['g2', 'g1']);
    const seq = s0.prossimoEvento;
    let s = lancia(s0, 'pascolo_grande');
    expect(dichiarazione(s)).toEqual({ effetto: 'pascolo', quantita: 2 });
    s = nessunaReazione(s);
    expect(agnellini(s, 'g2')).toBe(POSTI);
    expect(agnellini(s, 'g1')).toBe(POSTI - 1);
    expect(s.esito).toEqual({ modo: 'ovile_pieno', vincitori: ['g2'] });
    expect(s.fase).toEqual({ nome: 'fine_partita' });
    expect(facceLanciate(s, seq)).toEqual([{ giocatore: 'g2', faccia: 'pascolo_grande' }]);
    rifiuta(s, { tipo: 'lanciaDado', giocatore: 'g1' });
    expect(azioniPossibili(s, 'g1')).toEqual([]);
    expect(inAttesaDi(s).giocatori).toEqual([]);
  });

  it('tutti pari: nessuno lancia, si passa al Guaio senza destinatario', () => {
    const scelte: Scelte = { g1: ['balla-di-fieno'], g2: ['balla-di-fieno'], g3: ['balla-di-fieno'] };
    let s = prosegui(scenario({ guaio: SENZA_TRATTI, mani: scelte }));
    s = prosegui(scegli(s, scelte));
    expect(s.fase.nome).toBe('belati_punteggio');
    s = chiudiPunteggio(s);
    expect(s.datiRound.piuAlti).toEqual([]);
    expect(s.datiRound.piuBassi).toEqual([]);
    expect(s.datiRound.lanciatori).toEqual([]);
    expect(s.fase).toEqual({ nome: 'guaio_al_peggiore', destinatario: null, spareggio: null });
    expect(s.eventi.filter((e) => e.tipo === 'dado_lanciato')).toEqual([]);
    for (const g of ['g1', 'g2', 'g3']) rifiuta(s, { tipo: 'lanciaDado', giocatore: g });
  });

  it('un solo partecipante: lancia lui (D23) e può rubare a chi è fuori dal round (D34)', () => {
    const s0 = soloG1({ agnellini: { g3: 0 } });
    expect(s0.datiRound.partecipanti).toEqual(['g1']);
    expect(s0.datiRound.piuAlti).toEqual(['g1']);
    expect(s0.datiRound.piuBassi).toEqual([]);
    expect(s0.datiRound.lanciatori).toEqual(['g1']);
    expect(inAttesaDi(s0)).toEqual({ sistema: false, giocatori: ['g1'] });
    let s = lancia(s0, 'furto_piccolo');
    expect(furtoDichiarato(s)).toEqual({ daAvversari: { g2: 2 }, dalGregge: 0 });
    expect(ordinati(s.finestra?.inAttesa ?? [])).toEqual(['g2', 'g3']);
    s = nessunaReazione(s);
    expect(agnellini(s, 'g1')).toBe(5);
    expect(agnellini(s, 'g2')).toBe(1);
    expect(s.fase).toEqual({ nome: 'guaio_al_peggiore', destinatario: null, spareggio: null });
  });

  it('un solo partecipante: la Testata può colpire chi è fuori dal round (D34)', () => {
    let s = lancia(soloG1(), 'testata');
    expect(passo(s)).toBe('dichiarazione');
    s = nessunaReazione(dichiaraTestata(s, 'g3'));
    s = esitoTestata(s, 1);
    expect(agnellini(s, 'g3')).toBe(2);
    expect(s.fase).toEqual({ nome: 'guaio_al_peggiore', destinatario: null, spareggio: null });
  });
});
