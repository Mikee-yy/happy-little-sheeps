// Pila di reazione e Beee-NO!.
// Regole: brief sezione 3 ("Beee-NO!", "Il Dado del Pastore") e sezione 4 (carte Belato);
// specifica docs/motore.md sezioni 1, 2, 4.4, 4.5, 4.7, 4.10, 4.12, 5, 10, 11 e decisioni D3–D8, D12, D21, D22, D34.
import { describe, expect, it } from 'vitest';
import { applica, azioniPossibili, defCarta, ErroreRegola, inAttesaDi, vistaPer } from '../src';
import type { Azione, Evento, Fase, IdCarta, IdGiocatore, IdVoce, Stato, StatoGiocatore, VocePila } from '../src';
import { carta, chiudiPunteggio, conFaccia, nessunaReazione, prosegui, scegli, scenario, totale } from './aiuti';
import type { OpzioniScenario } from './aiuti';

// ─── Aiuti locali ────────────────────────────────────────────────────────────

type Mani = Record<IdGiocatore, string[]>;
type FaseDi<N extends Fase['nome']> = Extract<Fase, { nome: N }>;
type GiocaBelato = Extract<Azione, { tipo: 'giocaBelato' }>;

/** Guaio senza tratti: i totali del round sono solo i valori stampati. */
const GUAIO_NEUTRO = 'tosatura-a-sorpresa';

function fase<N extends Fase['nome']>(s: Stato, nome: N): FaseDi<N> {
  expect(s.fase.nome).toBe(nome);
  return s.fase as FaseDi<N>;
}

function giocatore(s: Stato, id: IdGiocatore): StatoGiocatore {
  const g = s.giocatori.find((x) => x.id === id);
  if (!g) throw new Error(`giocatore ${id} inesistente`);
  return g;
}

function cima(s: Stato): VocePila {
  const v = s.pila[s.pila.length - 1];
  if (!v) throw new Error('pila vuota');
  return v;
}

const idPila = (s: Stato): IdVoce[] => s.pila.map((v) => v.id);
const ordinati = (ids: readonly IdGiocatore[]): IdGiocatore[] => [...ids].sort();

function attesaFinestra(s: Stato): IdGiocatore[] {
  if (!s.finestra) throw new Error('nessuna finestra aperta');
  return ordinati(s.finestra.inAttesa);
}

/** Eventi prodotti a partire dal numero di sequenza `seq`. */
const eventiDa = (s: Stato, seq: number): Evento[] => s.eventi.filter((e) => e.seq >= seq);

/** Beee-NO! di `chi` (prima istanza in mano) contro `voce`, per default la cima. */
function beeeNo(s: Stato, chi: IdGiocatore, voce: IdVoce = cima(s).id): GiocaBelato {
  return { tipo: 'giocaBelato', giocatore: chi, carta: carta(s, chi, 'beee-no'), voce };
}

const giocaBeeeNo = (s: Stato, chi: IdGiocatore, voce?: IdVoce): Stato => applica(s, beeeNo(s, chi, voce));
const passa = (s: Stato, chi: IdGiocatore): Stato => applica(s, { tipo: 'passa', giocatore: chi });
const scadenza = (s: Stato): Stato => applica(s, { tipo: 'scadenza' });

/** L'azione è rifiutata con ErroreRegola e lo stato di partenza resta intatto (specifica 1). */
function verificaRifiuto(s: Stato, azione: Azione): void {
  const copia = structuredClone(s);
  expect(() => applica(s, azione), JSON.stringify(azione)).toThrow(ErroreRegola);
  expect(s).toEqual(copia);
}

/** Dallo scenario fino a dopo la rivelazione: fase 'effetti', o 'belati_punteggio' se nessuna carta ha effetti. */
function round(o: OpzioniScenario, scelte: Mani): Stato {
  return prosegui(scegli(prosegui(scenario(o)), scelte));
}

function voceCorrente(s: Stato) {
  const f = fase(s, 'effetti');
  const v = f.coda[f.indice];
  if (!v) throw new Error('nessuna voce corrente in coda');
  return v;
}

/** Il proprietario della voce corrente attiva l'effetto. */
function attiva(s: Stato, bersaglio?: IdGiocatore): Stato {
  const v = voceCorrente(s);
  const azione: Azione = bersaglio
    ? { tipo: 'attivaEffetto', giocatore: v.giocatore, carta: v.carta, bersaglio }
    : { tipo: 'attivaEffetto', giocatore: v.giocatore, carta: v.carta };
  return applica(s, azione);
}

// g1 Agnellino smarrito (1, prendi 1 agnellino), g2 Balla di fieno (5), g3 Cannocchiale (7, guarda le prime 2).
// Il Cannocchiale è dopo in coda: risolta la voce di g1 la fase resta 'effetti' e se ne può leggere l'esito.
const MANI_EFFETTO: Mani = {
  g1: ['agnellino-smarrito', 'beee-no'],
  g2: ['balla-di-fieno', 'beee-no'],
  g3: ['cannocchiale', 'beee-no'],
};

function primaDellEffetto(mani: Mani = {}): Stato {
  return round(
    { guaio: GUAIO_NEUTRO, mani: { ...MANI_EFFETTO, ...mani } },
    { g1: ['agnellino-smarrito'], g2: ['balla-di-fieno'], g3: ['cannocchiale'] },
  );
}

/** Finestra aperta sull'effetto "prendi 1 agnellino" di g1. */
const finestraSuEffetto = (mani: Mani = {}): Stato => attiva(primaDellEffetto(mani));

// g1 Carriola (8), g2 Balla di fieno (5), g3 Coperta di lana (6): nessun effetto in coda,
// g1 è il più alto (lancia il dado), g2 il più basso (prende il Guaio).
const MANI_PUNTEGGIO: Mani = {
  g1: ['carriola', 'beee-no'],
  g2: ['balla-di-fieno', 'belato-di-gruppo', 'beee-no'],
  g3: ['coperta-di-lana', 'beee-no', 'pernacchia'],
};

function inBelatiPunteggio(o: OpzioniScenario = {}): Stato {
  const s = round(
    { guaio: GUAIO_NEUTRO, ...o, mani: { ...MANI_PUNTEGGIO, ...o.mani } },
    { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['coperta-di-lana'] },
  );
  fase(s, 'belati_punteggio');
  return s;
}

/** g1, unico lanciatore, lancia il Dado del Pastore con la faccia indicata. */
function lancio(faccia: string, o: OpzioniScenario = {}): Stato {
  const s = chiudiPunteggio(inBelatiPunteggio(o));
  expect(fase(s, 'dado').indice).toBe(0);
  expect(s.datiRound.lanciatori).toEqual(['g1']);
  return applica(conFaccia(s, faccia), { tipo: 'lanciaDado', giocatore: 'g1' });
}

// ─── Test ────────────────────────────────────────────────────────────────────

describe('Beee-NO! nel catalogo (brief sez. 4)', () => {
  it('è un Belato giocabile "sempre", in 4 copie', () => {
    expect(defCarta('beee-no')).toMatchObject({ famiglia: 'belato', effetto: 'beee_no', quando: 'sempre', copie: 4 });
  });
});

describe('Pila di reazione: voci e finestra (specifica sez. 5)', () => {
  it("attivaEffetto mette in pila una voce con id progressivo e apre la finestra per tutti tranne l'autore (sez. 4.4, 5, D5)", () => {
    const prima = primaDellEffetto();
    const v = voceCorrente(prima);
    expect(v).toMatchObject({ giocatore: 'g1', effetto: 'prendi_agnellino' });

    const s = attiva(prima);
    expect(s.pila).toHaveLength(1);
    const voce = cima(s);
    expect(voce.id).toBe(prima.prossimaVoce);
    expect(s.prossimaVoce).toBeGreaterThan(voce.id);
    expect(voce.autore).toBe('g1');
    expect(voce.dettagli).toMatchObject({ tipo: 'effetto_trovata', carta: v.carta, effetto: 'prendi_agnellino' });
    expect(s.finestra?.voce).toBe(voce.id);
    expect(attesaFinestra(s)).toEqual(['g2', 'g3']);
    expect(voceCorrente(s).esito).toBe('attivato');
    expect(eventiDa(s, prima.prossimoEvento)).toContainEqual(
      expect.objectContaining({ tipo: 'dichiarazione', voce: voce.id, autore: 'g1' }),
    );

    // Sezione 11: con la finestra aperta si aspetta finestra.inAttesa, non il sistema.
    const attesa = inAttesaDi(s);
    expect(attesa.sistema).toBe(false);
    expect(ordinati(attesa.giocatori)).toEqual(['g2', 'g3']);

    // La voce è in sospeso: l'effetto non è ancora applicato.
    expect(giocatore(s, 'g1').agnellini).toBe(3);
    expect(s.gregge).toBe(prima.gregge);
  });

  it("passa toglie dall'attesa; quando l'attesa è vuota la cima si risolve", () => {
    const s0 = finestraSuEffetto();
    const base = cima(s0).id;

    let s = passa(s0, 'g2');
    expect(attesaFinestra(s)).toEqual(['g3']);
    expect(idPila(s)).toEqual([base]);
    expect(giocatore(s, 'g1').agnellini).toBe(3);

    s = passa(s, 'g3');
    expect(s.pila).toEqual([]);
    expect(s.finestra).toBeNull();
    expect(giocatore(s, 'g1').agnellini).toBe(4);
    expect(s.gregge).toBe(s0.gregge - 1);
    expect(fase(s, 'effetti').coda[0]?.esito).toBe('attivato');
    expect(voceCorrente(s).giocatore).toBe('g3');
    expect(eventiDa(s, s0.prossimoEvento)).toContainEqual(expect.objectContaining({ tipo: 'risolta', voce: base }));
  });

  it('scadenza fa passare tutti i rimasti e risolve subito la cima', () => {
    const s0 = finestraSuEffetto();
    const s = scadenza(s0);
    expect(s.pila).toEqual([]);
    expect(s.finestra).toBeNull();
    expect(giocatore(s, 'g1').agnellini).toBe(4);
    expect(s.gregge).toBe(s0.gregge - 1);
    expect(voceCorrente(s).giocatore).toBe('g3');
  });

  it("passa è rifiutato per l'autore della cima e per chi ha già passato", () => {
    const s0 = finestraSuEffetto();
    verificaRifiuto(s0, { tipo: 'passa', giocatore: 'g1' });
    const s = passa(s0, 'g2');
    verificaRifiuto(s, { tipo: 'passa', giocatore: 'g2' });
  });

  it('con la finestra aperta su un effetto le altre azioni sono rifiutate (sez. 4: pila_non_vuota)', () => {
    const s = finestraSuEffetto({ g3: ['cannocchiale', 'beee-no', 'pernacchia'] });
    const v = voceCorrente(s);
    const vietate: Azione[] = [
      { tipo: 'prosegui' },
      { tipo: 'attivaEffetto', giocatore: 'g1', carta: v.carta },
      { tipo: 'rinunciaEffetto', giocatore: 'g1', carta: v.carta },
      { tipo: 'giocaBelato', giocatore: 'g3', carta: carta(s, 'g3', 'pernacchia'), bersaglio: 'g1' },
      { tipo: 'lanciaDado', giocatore: 'g1' },
    ];
    for (const a of vietate) verificaRifiuto(s, a);
  });

  it('con un Belato in pila non si gioca un altro Belato di punteggio né si chiude il punteggio (sez. 4, 4.5)', () => {
    const s0 = inBelatiPunteggio();
    const s = applica(s0, {
      tipo: 'giocaBelato',
      giocatore: 'g2',
      carta: carta(s0, 'g2', 'belato-di-gruppo'),
      bersaglio: 'g2',
    });
    const pernacchia = carta(s, 'g3', 'pernacchia');
    const vietate: Azione[] = [
      { tipo: 'giocaBelato', giocatore: 'g3', carta: pernacchia, bersaglio: 'g2' },
      { tipo: 'giocaBelato', giocatore: 'g3', carta: pernacchia, bersaglio: 'g2', voce: cima(s).id },
      { tipo: 'prosegui' },
    ];
    for (const a of vietate) verificaRifiuto(s, a);
  });

  it('con il risultato del dado in pila sono rifiutati lanci, dichiarazioni ed esiti (sez. 4, 4.7)', () => {
    const s = applica(lancio('testata'), { tipo: 'dichiaraDado', giocatore: 'g1', bersaglio: 'g3' });
    expect(s.finestra).not.toBeNull();
    const vietate: Azione[] = [
      { tipo: 'lanciaDado', giocatore: 'g1' },
      { tipo: 'dichiaraDado', giocatore: 'g1', bersaglio: 'g2' },
      { tipo: 'esitoTestata', giocatore: 'g1', esito: 1 },
      { tipo: 'prosegui' },
    ];
    for (const a of vietate) verificaRifiuto(s, a);
  });

  it("azioniPossibili con la finestra aperta: passa e Beee-NO! per chi è in attesa, nulla per l'autore, solo scadenza per il sistema (sez. 2)", () => {
    const s = finestraSuEffetto({ g3: ['cannocchiale', 'pernacchia'] });
    const voce = cima(s).id;

    // g1 ha un Beee-NO! in mano ma è l'autore della cima.
    expect(azioniPossibili(s, 'g1')).toEqual([]);
    expect(azioniPossibili(s, 'sistema')).toEqual([{ tipo: 'scadenza' }]);
    // g3 ha solo un Belato di punteggio: con la pila non vuota può soltanto passare.
    expect(azioniPossibili(s, 'g3')).toEqual([{ tipo: 'passa', giocatore: 'g3' }]);

    const perG2 = azioniPossibili(s, 'g2');
    expect(perG2).toHaveLength(2);
    expect(perG2).toContainEqual({ tipo: 'passa', giocatore: 'g2' });
    expect(perG2).toContainEqual({ tipo: 'giocaBelato', giocatore: 'g2', carta: carta(s, 'g2', 'beee-no'), voce });

    for (const chi of ['g1', 'g2', 'g3', 'sistema'] as const) {
      for (const a of azioniPossibili(s, chi)) expect(() => applica(s, a), JSON.stringify(a)).not.toThrow();
    }
  });

  it('pila e finestra sono pubbliche in ogni vista (sez. 10, 11)', () => {
    const s = giocaBeeeNo(finestraSuEffetto(), 'g2');
    for (const per of ['g1', 'g3', null] as const) {
      const v = vistaPer(s, per);
      expect(v.pila).toEqual(s.pila);
      expect(v.finestra).toEqual(s.finestra);
      expect(ordinati(v.attesa.giocatori)).toEqual(['g1', 'g3']);
    }
  });
});

describe("Beee-NO! sull'effetto di una Trovata (brief sez. 3 \"Beee-NO!\"; D4, D8)", () => {
  it("annulla l'effetto: niente agnellino, esito 'annullato', il valore della carta resta (sez. 4.4, 5, D8)", () => {
    const s0 = finestraSuEffetto();
    const base = cima(s0);
    const cartaEffetto = voceCorrente(s0).carta;

    let s = giocaBeeeNo(s0, 'g2');
    const no = cima(s);
    expect(no).toMatchObject({
      id: s0.prossimaVoce,
      autore: 'g2',
      dettagli: { tipo: 'belato', effetto: 'beee_no', voceBersaglio: base.id },
    });
    expect(idPila(s)).toEqual([base.id, no.id]);
    expect(s.finestra?.voce).toBe(no.id);
    expect(attesaFinestra(s)).toEqual(['g1', 'g3']);

    s = nessunaReazione(s);
    expect(s.pila).toEqual([]);
    expect(s.finestra).toBeNull();
    expect(giocatore(s, 'g1').agnellini).toBe(3);
    expect(s.gregge).toBe(s0.gregge);
    expect(fase(s, 'effetti').coda[0]).toMatchObject({ carta: cartaEffetto, esito: 'annullato' });
    expect(voceCorrente(s).giocatore).toBe('g3');

    // D8: la Trovata conta comunque con il suo valore.
    expect(s.datiRound.punteggi['g1']).toContainEqual(
      expect.objectContaining({ tipo: 'valore', delta: 1, carta: cartaEffetto }),
    );
    expect(totale(s, 'g1')).toBe(1);

    const ev = eventiDa(s, s0.prossimoEvento);
    expect(ev).toContainEqual(expect.objectContaining({ tipo: 'dichiarazione', voce: no.id, autore: 'g2' }));
    expect(ev).toContainEqual(expect.objectContaining({ tipo: 'annullata', voce: base.id, da: no.id }));
    expect(ev).toContainEqual(expect.objectContaining({ tipo: 'risolta', voce: no.id }));
    expect(ev.some((e) => e.tipo === 'risolta' && e.voce === base.id)).toBe(false);
    expect(ev.some((e) => e.tipo === 'agnellini')).toBe(false);
  });

  it('Scorta nel vello annullata: nessuna richiesta privata, la mano resta com\'è (D4, D16)', () => {
    let s = round(
      {
        guaio: GUAIO_NEUTRO,
        mani: { g1: ['scorta-nel-vello', 'carriola'], g2: ['balla-di-fieno', 'beee-no'], g3: ['coperta-di-lana'] },
      },
      { g1: ['scorta-nel-vello'], g2: ['balla-di-fieno'], g3: ['coperta-di-lana'] },
    );
    const manoG1 = giocatore(s, 'g1').mano;
    s = attiva(s);
    // D4: la scelta privata viene solo dopo la finestra.
    expect(s.richiesta).toBeNull();

    s = nessunaReazione(giocaBeeeNo(s, 'g2'));
    expect(s.richiesta).toBeNull();
    expect(giocatore(s, 'g1').mano).toEqual(manoG1);
    expect(totale(s, 'g1')).toBe(0);
    expect(s.datiRound.punteggi['g1']?.some((r) => r.tipo === 'effetto')).toBe(false);
    fase(s, 'belati_punteggio');
  });

  it('Campanaccio: il bersaglio è dichiarato prima della finestra e chi è preso di mira può annullare (D4)', () => {
    let s = round(
      {
        guaio: GUAIO_NEUTRO,
        mani: { g1: ['campanaccio-stonato'], g2: ['balla-di-fieno'], g3: ['cannocchiale', 'beee-no'] },
      },
      { g1: ['campanaccio-stonato'], g2: ['balla-di-fieno'], g3: ['cannocchiale'] },
    );
    const gregge = s.gregge;
    s = attiva(s, 'g3');
    expect(cima(s).dettagli).toMatchObject({ tipo: 'effetto_trovata', effetto: 'sposta_agnellino', bersaglio: 'g3' });

    s = nessunaReazione(giocaBeeeNo(s, 'g3'));
    expect(giocatore(s, 'g3').agnellini).toBe(3);
    expect(s.gregge).toBe(gregge);
    expect(fase(s, 'effetti').coda[0]?.esito).toBe('annullato');
    expect(totale(s, 'g1')).toBe(4);
  });

  it('Tappi per le orecchie annullati: le altre Trovate non vengono ignorate (D12)', () => {
    let s = round(
      {
        guaio: GUAIO_NEUTRO,
        mani: { g1: ['tappi-per-le-orecchie'], g2: ['agnellino-smarrito'], g3: ['carriola', 'beee-no'] },
      },
      { g1: ['tappi-per-le-orecchie'], g2: ['agnellino-smarrito'], g3: ['carriola'] },
    );
    expect(voceCorrente(s)).toMatchObject({ giocatore: 'g1', effetto: 'ignora_effetti' });

    s = nessunaReazione(giocaBeeeNo(attiva(s), 'g3'));
    expect(fase(s, 'effetti').coda[0]?.esito).toBe('annullato');
    expect(s.datiRound.ignoraEffetti).toBeNull();
    expect(voceCorrente(s)).toMatchObject({ giocatore: 'g2', effetto: 'prendi_agnellino', esito: 'attesa' });

    s = nessunaReazione(attiva(s));
    expect(giocatore(s, 'g2').agnellini).toBe(4);
  });
});

describe('Beee-NO! su un Belato (sez. 4.5, 4.10, 7)', () => {
  it('annulla un Belato +2: nessuna riga belato, totale invariato; poi tutti di nuovo in attesa (sez. 4.5)', () => {
    let s = inBelatiPunteggio();
    s = passa(s, 'g1');
    expect(ordinati(fase(s, 'belati_punteggio').inAttesa)).toEqual(['g2', 'g3']);

    const belato = carta(s, 'g2', 'belato-di-gruppo');
    s = applica(s, { tipo: 'giocaBelato', giocatore: 'g2', carta: belato, bersaglio: 'g2' });
    const voce = cima(s);
    expect(s.pila).toHaveLength(1);
    expect(voce).toMatchObject({
      autore: 'g2',
      dettagli: { tipo: 'belato', carta: belato, effetto: 'modifica_punteggio', bersaglio: 'g2' },
    });
    // g1 ha già passato nella finestra dei Belati, ma la finestra di reazione è nuova (D5).
    expect(attesaFinestra(s)).toEqual(['g1', 'g3']);
    expect(ordinati(inAttesaDi(s).giocatori)).toEqual(['g1', 'g3']);

    const seq = s.prossimoEvento;
    const no = carta(s, 'g1', 'beee-no');
    s = giocaBeeeNo(s, 'g1');
    expect(cima(s).dettagli).toMatchObject({ tipo: 'belato', carta: no, effetto: 'beee_no', voceBersaglio: voce.id });

    s = nessunaReazione(s);
    expect(s.pila).toEqual([]);
    expect(totale(s, 'g2')).toBe(5);
    expect(s.datiRound.punteggi['g2']?.some((r) => r.tipo === 'belato')).toBe(false);
    expect(eventiDa(s, seq)).toContainEqual(expect.objectContaining({ tipo: 'annullata', voce: voce.id }));
    // Annullato o no, dopo la risoluzione inAttesa torna a tutti i non eliminati.
    expect(ordinati(fase(s, 'belati_punteggio').inAttesa)).toEqual(['g1', 'g2', 'g3']);
  });

  it('controprova: scadenza su un Belato chiude solo la sua finestra, il +2 si applica e il punteggio resta aperto (sez. 5)', () => {
    let s = inBelatiPunteggio();
    const belato = carta(s, 'g2', 'belato-di-gruppo');
    s = scadenza(applica(s, { tipo: 'giocaBelato', giocatore: 'g2', carta: belato, bersaglio: 'g2' }));
    expect(s.pila).toEqual([]);
    expect(s.finestra).toBeNull();
    expect(totale(s, 'g2')).toBe(7);
    expect(s.datiRound.punteggi['g2']).toContainEqual(expect.objectContaining({ tipo: 'belato', delta: 2, carta: belato }));
    expect(ordinati(fase(s, 'belati_punteggio').inAttesa)).toEqual(['g1', 'g2', 'g3']);
  });

  it('Belato di salvataggio annullato: si resta in belati_salvataggio con lo stesso destinatario (sez. 4.10)', () => {
    let s = nessunaReazione(lancio('pascolo_piccolo', { mani: { g2: ['balla-di-fieno', 'faccio-finta-di-niente'] } }));
    expect(fase(s, 'guaio_al_peggiore').destinatario).toBe('g2');
    s = prosegui(s);
    expect(fase(s, 'belati_salvataggio').destinatario).toBe('g2');

    const guaio = s.datiRound.guaio;
    expect(guaio).not.toBeNull();
    const mazzoGuai = s.mazzoGuai;
    const finta = carta(s, 'g2', 'faccio-finta-di-niente');
    s = applica(s, { tipo: 'giocaBelato', giocatore: 'g2', carta: finta });
    expect(cima(s).dettagli).toMatchObject({ tipo: 'belato', carta: finta, effetto: 'guaio_in_fondo' });
    // Con la pila non vuota "passa" è una risposta alla finestra: il destinatario ne è l'autore.
    verificaRifiuto(s, { tipo: 'passa', giocatore: 'g2' });

    s = nessunaReazione(giocaBeeeNo(s, 'g3'));
    expect(fase(s, 'belati_salvataggio').destinatario).toBe('g2');
    expect(s.datiRound.guaio).toBe(guaio);
    expect(s.mazzoGuai).toEqual(mazzoGuai);
    expect(s.datiRound.tavolo).toContain(finta);

    s = passa(s, 'g2');
    expect(fase(s, 'consolazione').destinatario).toBe('g2');
    expect(giocatore(s, 'g2').angolo).toContain(guaio);
  });
});

describe('Beee-NO! sul risultato del Dado del Pastore (sez. 4.7; D21, D22)', () => {
  it('Pascolo annullato: nessun agnellino si muove e si passa al Guaio al peggiore', () => {
    const s0 = lancio('pascolo_piccolo');
    expect(fase(s0, 'risoluzione_dado').passo).toBe('reazione');
    expect(cima(s0)).toMatchObject({
      autore: 'g1',
      dettagli: { tipo: 'dado', faccia: 'pascolo_piccolo', dichiarazione: { effetto: 'pascolo', quantita: 3 } },
    });
    expect(attesaFinestra(s0)).toEqual(['g2', 'g3']);

    const s = nessunaReazione(giocaBeeeNo(s0, 'g2'));
    expect(giocatore(s, 'g1').agnellini).toBe(3);
    expect(s.gregge).toBe(s0.gregge);
    expect(eventiDa(s, s0.prossimoEvento).some((e) => e.tipo === 'agnellini')).toBe(false);
    expect(fase(s, 'guaio_al_peggiore').destinatario).toBe('g2');
  });

  it('Furto annullato: la ripartizione dichiarata prima della finestra non si applica (D4, D20)', () => {
    let s = lancio('furto_piccolo');
    // Due avversari con agnellini e 2 da rubare su 6: la ripartizione è libera, si dichiara prima.
    expect(fase(s, 'risoluzione_dado').passo).toBe('dichiarazione');
    expect(s.pila).toEqual([]);
    verificaRifiuto(s, beeeNo(s, 'g2', s.prossimaVoce));

    s = applica(s, { tipo: 'dichiaraDado', giocatore: 'g1', furto: { g2: 1, g3: 1 } });
    expect(fase(s, 'risoluzione_dado').passo).toBe('reazione');
    expect(cima(s).dettagli).toMatchObject({
      tipo: 'dado',
      faccia: 'furto_piccolo',
      dichiarazione: { effetto: 'furto', daAvversari: { g2: 1, g3: 1 }, dalGregge: 0 },
    });

    const gregge = s.gregge;
    s = nessunaReazione(giocaBeeeNo(s, 'g3'));
    for (const g of ['g1', 'g2', 'g3']) expect(giocatore(s, g).agnellini).toBe(3);
    expect(s.gregge).toBe(gregge);
    fase(s, 'guaio_al_peggiore');
  });

  it('Testata annullata: nessun agnellino cade e non si arriva al passo esito_testata (D21)', () => {
    let s = lancio('testata');
    expect(fase(s, 'risoluzione_dado').passo).toBe('dichiarazione');
    s = applica(s, { tipo: 'dichiaraDado', giocatore: 'g1', bersaglio: 'g3' });
    expect(cima(s).dettagli).toMatchObject({
      tipo: 'dado',
      faccia: 'testata',
      dichiarazione: { effetto: 'testata', bersaglio: 'g3' },
    });

    const seq = s.prossimoEvento;
    s = nessunaReazione(giocaBeeeNo(s, 'g3'));
    expect(s.fase.nome).not.toBe('risoluzione_dado');
    fase(s, 'guaio_al_peggiore');
    expect(giocatore(s, 'g3').agnellini).toBe(3);
    expect(eventiDa(s, seq).some((e) => e.tipo === 'testata')).toBe(false);
    verificaRifiuto(s, { tipo: 'esitoTestata', giocatore: 'g1', esito: 1 });
  });

  it('controprova: senza Beee-NO! la Testata arriva a esito_testata, dove la pila è vuota e Beee-NO! non serve più (D4, D21)', () => {
    let s = applica(lancio('testata'), { tipo: 'dichiaraDado', giocatore: 'g1', bersaglio: 'g3' });
    const voceTestata = cima(s).id;
    s = nessunaReazione(s);
    expect(fase(s, 'risoluzione_dado').passo).toBe('esito_testata');
    expect(s.pila).toEqual([]);
    expect(s.finestra).toBeNull();
    expect(inAttesaDi(s).giocatori).toEqual(['g1']);
    // La voce della Testata è già risolta: non è più in cima a nulla.
    verificaRifiuto(s, beeeNo(s, 'g3', voceTestata));
  });

  it('un Pascolo con il Gregge vuoto non va in pila: nessuna finestra, niente da annullare (sez. 5, D22)', () => {
    const s = lancio('pascolo_piccolo', { gregge: 0 });
    expect(s.pila).toEqual([]);
    expect(s.finestra).toBeNull();
    fase(s, 'guaio_al_peggiore');
    verificaRifiuto(s, beeeNo(s, 'g2', s.prossimaVoce));
  });
});

describe('Beee-NO! contro Beee-NO! (brief sez. 3; D5, D6)', () => {
  it("Beee-NO! annullato da un altro Beee-NO!: l'effetto originale si applica; l'autore dell'effetto può rispondere (D5)", () => {
    const s0 = finestraSuEffetto();
    const base = cima(s0).id;

    let s = giocaBeeeNo(s0, 'g2');
    const noG2 = cima(s).id;
    expect(attesaFinestra(s)).toEqual(['g1', 'g3']);

    s = giocaBeeeNo(s, 'g1');
    const noG1 = cima(s).id;
    expect(idPila(s)).toEqual([base, noG2, noG1]);
    expect(cima(s)).toMatchObject({ autore: 'g1', dettagli: { effetto: 'beee_no', voceBersaglio: noG2 } });
    expect(s.finestra?.voce).toBe(noG1);
    expect(attesaFinestra(s)).toEqual(['g2', 'g3']);

    s = nessunaReazione(s);
    expect(s.pila).toEqual([]);
    expect(giocatore(s, 'g1').agnellini).toBe(4);
    expect(s.gregge).toBe(s0.gregge - 1);
    expect(fase(s, 'effetti').coda[0]?.esito).toBe('attivato');

    const ev = eventiDa(s, s0.prossimoEvento);
    expect(ev).toContainEqual(expect.objectContaining({ tipo: 'annullata', voce: noG2, da: noG1 }));
    expect(ev).toContainEqual(expect.objectContaining({ tipo: 'risolta', voce: noG1 }));
    expect(ev).toContainEqual(expect.objectContaining({ tipo: 'risolta', voce: base }));
    expect(ev.some((e) => e.tipo === 'annullata' && e.voce === base)).toBe(false);
  });

  it('dopo un Beee-NO! su Beee-NO! si apre una finestra nuova sulla voce tornata in cima, con tutti di nuovo in attesa tranne il suo autore (D6)', () => {
    let s = finestraSuEffetto();
    const base = cima(s).id;
    s = passa(s, 'g3');
    expect(attesaFinestra(s)).toEqual(['g2']);

    s = giocaBeeeNo(s, 'g2');
    const noG2 = cima(s).id;
    // Finestra nuova: torna in attesa anche g3, che aveva passato sulla voce sotto.
    expect(attesaFinestra(s)).toEqual(['g1', 'g3']);

    s = giocaBeeeNo(s, 'g1');
    const noG1 = cima(s).id;
    const seq = s.prossimoEvento;

    // scadenza chiude solo la finestra corrente: il Beee-NO! di g1 annulla quello di g2.
    s = scadenza(s);
    expect(idPila(s)).toEqual([base]);
    expect(s.finestra?.voce).toBe(base);
    expect(attesaFinestra(s)).toEqual(['g2', 'g3']);
    expect(eventiDa(s, seq)).toContainEqual(expect.objectContaining({ tipo: 'annullata', voce: noG2, da: noG1 }));
    expect(giocatore(s, 'g1').agnellini).toBe(3);
    expect(fase(s, 'effetti').coda[0]?.esito).toBe('attivato');

    // g3 aveva passato su questa voce, ma la finestra è nuova: ora può annullarla.
    s = nessunaReazione(giocaBeeeNo(s, 'g3'));
    expect(s.pila).toEqual([]);
    expect(giocatore(s, 'g1').agnellini).toBe(3);
    expect(fase(s, 'effetti').coda[0]?.esito).toBe('annullato');
  });

  it("catena di tre Beee-NO!: l'effetto originale è annullato (D6)", () => {
    const s0 = finestraSuEffetto();
    const base = cima(s0).id;
    const carteNo = (['g1', 'g2', 'g3'] as const).map((g) => carta(s0, g, 'beee-no'));

    let s = giocaBeeeNo(s0, 'g2');
    const noG2 = cima(s).id;
    s = giocaBeeeNo(s, 'g1');
    const noG1 = cima(s).id;
    s = giocaBeeeNo(s, 'g3');
    const noG3 = cima(s).id;
    expect(idPila(s)).toEqual([base, noG2, noG1, noG3]);
    expect(attesaFinestra(s)).toEqual(['g1', 'g2']);

    // Il Beee-NO! di g3 annulla quello di g1: torna in cima quello di g2, con una finestra nuova.
    s = scadenza(s);
    expect(idPila(s)).toEqual([base, noG2]);
    expect(s.finestra?.voce).toBe(noG2);
    expect(attesaFinestra(s)).toEqual(['g1', 'g3']);

    s = nessunaReazione(s);
    expect(s.pila).toEqual([]);
    expect(s.finestra).toBeNull();
    expect(giocatore(s, 'g1').agnellini).toBe(3);
    expect(s.gregge).toBe(s0.gregge);
    expect(fase(s, 'effetti').coda[0]?.esito).toBe('annullato');

    const ev = eventiDa(s, s0.prossimoEvento);
    expect(ev).toContainEqual(expect.objectContaining({ tipo: 'annullata', voce: noG1, da: noG3 }));
    expect(ev).toContainEqual(expect.objectContaining({ tipo: 'annullata', voce: base, da: noG2 }));
    expect(ev.some((e) => e.tipo === 'risolta' && e.voce === base)).toBe(false);
    expect(ev.some((e) => e.tipo === 'risolta' && e.voce === noG1)).toBe(false);

    // Tutti e tre i Beee-NO!, anche quello annullato, sono sul tavolo.
    expect(s.datiRound.tavolo).toEqual(expect.arrayContaining(carteNo));
  });

  it('sul dado: il lanciatore annulla il Beee-NO! avversario e il Pascolo si applica (D5, D6)', () => {
    const s0 = lancio('pascolo_piccolo');
    let s = giocaBeeeNo(s0, 'g2');
    expect(attesaFinestra(s)).toEqual(['g1', 'g3']);
    s = nessunaReazione(giocaBeeeNo(s, 'g1'));
    expect(s.pila).toEqual([]);
    expect(giocatore(s, 'g1').agnellini).toBe(6);
    expect(s.gregge).toBe(s0.gregge - 3);
    fase(s, 'guaio_al_peggiore');
  });
});

describe('Validità di Beee-NO! (sez. 5; D3, D5, D7)', () => {
  it('con la pila vuota è rifiutato, in qualunque fase (D3)', () => {
    const inScelta = prosegui(scenario({ guaio: GUAIO_NEUTRO, mani: MANI_EFFETTO }));
    fase(inScelta, 'scelta');
    const inEffetti = primaDellEffetto();
    const inPunteggio = inBelatiPunteggio();
    const alDado = chiudiPunteggio(inBelatiPunteggio());
    fase(alDado, 'dado');

    for (const s of [inScelta, inEffetti, inPunteggio, alDado]) {
      expect(s.pila).toEqual([]);
      const no = carta(s, 'g2', 'beee-no');
      verificaRifiuto(s, { tipo: 'giocaBelato', giocatore: 'g2', carta: no });
      verificaRifiuto(s, { tipo: 'giocaBelato', giocatore: 'g2', carta: no, voce: s.prossimaVoce });
      verificaRifiuto(s, { tipo: 'giocaBelato', giocatore: 'g2', carta: no, voce: s.prossimaVoce - 1 });
    }
  });

  it('la voce indicata deve essere la cima: dei due Beee-NO! quasi simultanei il secondo è rifiutato (D7)', () => {
    const s0 = finestraSuEffetto();
    const base = cima(s0).id;
    const daG2 = beeeNo(s0, 'g2', base);
    const daG3 = beeeNo(s0, 'g3', base);

    const s = applica(s0, daG2);
    verificaRifiuto(s, daG3);
    verificaRifiuto(s0, beeeNo(s0, 'g3', base + 1000));
    verificaRifiuto(s0, beeeNo(s0, 'g3', s0.prossimaVoce));

    // Sulla cima giusta g3 può ancora rispondere.
    const s2 = applica(s, { ...daG3, voce: cima(s).id });
    expect(s2.pila).toHaveLength(3);
    expect(cima(s2)).toMatchObject({ autore: 'g3', dettagli: { voceBersaglio: cima(s).id } });
  });

  it("l'autore della cima non può giocarlo, chi ha giocato la voce sotto sì (D5)", () => {
    const s0 = finestraSuEffetto({ g2: ['balla-di-fieno', 'beee-no', 'beee-no'] });
    verificaRifiuto(s0, beeeNo(s0, 'g1'));

    const s = giocaBeeeNo(s0, 'g2');
    // g2 ha ancora un Beee-NO! in mano, ma la cima è sua.
    verificaRifiuto(s, beeeNo(s, 'g2'));
    expect(giocaBeeeNo(s, 'g1').pila).toHaveLength(3);
  });

  it('chi ha già passato su questa cima non può più giocarlo; gli altri sì', () => {
    let s = passa(finestraSuEffetto(), 'g2');
    verificaRifiuto(s, beeeNo(s, 'g2'));
    s = giocaBeeeNo(s, 'g3');
    expect(s.pila).toHaveLength(2);
    // Sulla nuova cima la finestra è nuova: g2 è di nuovo in attesa.
    expect(attesaFinestra(s)).toEqual(['g1', 'g2']);
  });

  it('un eliminato non è in attesa e non può giocarlo né passare (D5)', () => {
    let s = round(
      {
        giocatori: 4,
        guaio: GUAIO_NEUTRO,
        eliminati: ['g4'],
        agnellini: { g4: 0 },
        mani: { g1: ['agnellino-smarrito'], g2: ['balla-di-fieno'], g3: ['cannocchiale'], g4: ['beee-no#4'] },
      },
      { g1: ['agnellino-smarrito'], g2: ['balla-di-fieno'], g3: ['cannocchiale'] },
    );
    s = attiva(s);
    expect(attesaFinestra(s)).toEqual(['g2', 'g3']);
    verificaRifiuto(s, { tipo: 'giocaBelato', giocatore: 'g4', carta: 'beee-no#4', voce: cima(s).id });
    verificaRifiuto(s, { tipo: 'passa', giocatore: 'g4' });
    expect(azioniPossibili(s, 'g4')).toEqual([]);
  });

  it('la carta deve essere un Beee-NO! nella mano di chi lo gioca', () => {
    const s = finestraSuEffetto({ g3: ['cannocchiale', 'pernacchia', 'trifoglio-qualunque'] });
    const voce = cima(s).id;
    const prova = (c: IdCarta): Azione => ({ tipo: 'giocaBelato', giocatore: 'g3', carta: c, voce });

    const nelMazzo = s.mazzo.find((c) => c.startsWith('beee-no#'));
    expect(nelMazzo).toBeDefined();
    verificaRifiuto(s, prova(nelMazzo ?? 'beee-no#4'));
    verificaRifiuto(s, prova(carta(s, 'g2', 'beee-no')));
    verificaRifiuto(s, prova('beee-no#99'));
    // Un altro Belato o una Trovata non annullano nulla.
    verificaRifiuto(s, prova(carta(s, 'g3', 'pernacchia')));
    verificaRifiuto(s, prova(carta(s, 'g3', 'trifoglio-qualunque')));
  });

  it("un Beee-NO! accettato non modifica lo stato di partenza (sez. 1)", () => {
    const s = finestraSuEffetto();
    const copia = structuredClone(s);
    const dopo = giocaBeeeNo(s, 'g2');
    expect(dopo.pila).toHaveLength(2);
    expect(s).toEqual(copia);
  });
});

describe('Chi resta fuori dal round (D34)', () => {
  it('senza Trovate e con il mazzo vuoto resta fuori, ma può comunque giocare Beee-NO! (D5, D32, D34)', () => {
    let s = prosegui(
      scenario({
        guaio: GUAIO_NEUTRO,
        mazzo: [],
        mani: { g1: ['agnellino-smarrito'], g2: ['carriola'], g3: ['beee-no'] },
      }),
    );
    fase(s, 'scelta');
    expect(s.datiRound.partecipanti).toEqual(['g1', 'g2']);
    expect(s.eventi).toContainEqual(expect.objectContaining({ tipo: 'fuori_dal_round', giocatore: 'g3' }));
    const no = carta(s, 'g3', 'beee-no');

    s = attiva(prosegui(scegli(s, { g1: ['agnellino-smarrito'], g2: ['carriola'] })));
    expect(attesaFinestra(s)).toEqual(['g2', 'g3']);
    const base = cima(s).id;

    s = giocaBeeeNo(s, 'g3');
    expect(cima(s)).toMatchObject({ autore: 'g3', dettagli: { carta: no, voceBersaglio: base } });
    expect(s.datiRound.tavolo).toContain(no);

    s = nessunaReazione(s);
    expect(giocatore(s, 'g1').agnellini).toBe(3);
    expect(s.eventi).toContainEqual(expect.objectContaining({ tipo: 'annullata', voce: base }));
    fase(s, 'belati_punteggio');
  });
});

describe('Carte Beee-NO! sul tavolo e negli scarti (sez. 4.12, 5; D8)', () => {
  it('Beee-NO! e Belato annullato passano subito dalla mano al tavolo e a fine round negli scarti', () => {
    // Tutti a 8 e nessun Guaio: annullato il +2 restano pari, niente dado, si va a fine round.
    let s = round(
      {
        guaio: null,
        mani: { g1: ['carriola'], g2: ['carriola', 'belato-di-gruppo'], g3: ['carriola', 'beee-no'] },
      },
      { g1: ['carriola'], g2: ['carriola'], g3: ['carriola'] },
    );
    fase(s, 'belati_punteggio');
    const giocate = Object.values(s.datiRound.giocate).flat();
    const belato = carta(s, 'g2', 'belato-di-gruppo');
    const no = carta(s, 'g3', 'beee-no');

    s = applica(s, { tipo: 'giocaBelato', giocatore: 'g2', carta: belato, bersaglio: 'g2' });
    expect(s.datiRound.tavolo).toContain(belato);
    expect(giocatore(s, 'g2').mano).not.toContain(belato);

    s = giocaBeeeNo(s, 'g3');
    expect(s.datiRound.tavolo).toContain(no);
    expect(giocatore(s, 'g3').mano).not.toContain(no);

    s = nessunaReazione(s);
    expect(totale(s, 'g2')).toBe(8);
    // Annullati, restano sul tavolo fino a fine round: non vanno subito negli scarti.
    expect(s.datiRound.tavolo).toEqual(expect.arrayContaining([belato, no]));
    expect(s.scarti).not.toContain(belato);
    expect(s.scarti).not.toContain(no);

    s = chiudiPunteggio(s);
    fase(s, 'fine_round');
    expect(s.scarti).toEqual(expect.arrayContaining([...giocate, belato, no]));
    for (const g of ['g1', 'g2', 'g3']) {
      expect(giocatore(s, g).mano).not.toContain(belato);
      expect(giocatore(s, g).mano).not.toContain(no);
    }

    s = prosegui(s);
    expect(s.round).toBe(2);
    expect(s.datiRound.tavolo).toEqual([]);
    expect(s.scarti).toEqual(expect.arrayContaining([belato, no]));
  });
});
