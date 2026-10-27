// Revisione avversariale: effetti delle Trovate, Belati di punteggio, scambio, Dado del Pastore.
// Casi limite non coperti dalle altre suite. Regole: brief sezione 3 ("Svolgimento di un round" punti 4–7,
// "Il Dado del Pastore", "Parità", "Scambio dei punteggi") e sezione 4; specifica docs/motore.md
// sezioni 4.4–4.7, 5, 6, 7, 9.1 e decisioni D4, D10–D14, D17, D19–D22, D34.
import { describe, expect, it } from 'vitest';
import { applica, azioniPossibili, configPer, ErroreRegola, inAttesaDi, vistaPer } from '../src';
import type { Azione, DichiarazioneDado, Fase, IdCarta, IdGiocatore, IdTipoCarta, Stato, VoceEffetto, VocePila } from '../src';
import { carta, chiudiPunteggio, conFaccia, nessunaReazione, prosegui, scegli, scenario, totale } from './aiuti';
import type { OpzioniScenario } from './aiuti';

// ─── Aiuti locali ────────────────────────────────────────────────────────────

/** Tosatura a Sorpresa: nessun tratto, i totali sono i soli valori stampati. */
const NEUTRO = 'tosatura-a-sorpresa';

/** Posti dell'Ovile nella partita a 3 giocatori (quella di default degli scenari). */
const POSTI3 = configPer(3).postiOvile;

type Scelte = Record<IdGiocatore, Array<IdTipoCarta | IdCarta>>;
type FaseDi<N extends Fase['nome']> = Extract<Fase, { nome: N }>;

function inFase<N extends Fase['nome']>(s: Stato, nome: N): FaseDi<N> {
  if (s.fase.nome !== nome) throw new Error(`fase '${s.fase.nome}', attesa '${nome}'`);
  return s.fase as FaseDi<N>;
}

/** scenario → scelta → rivelazione → ingresso in 'effetti' (o oltre, se la coda si esaurisce da sola). */
function finoAgliEffetti(o: OpzioniScenario, scelte: Scelte): Stato {
  let s = prosegui(scenario({ guaio: NEUTRO, ...o }));
  expect(s.fase.nome).toBe('scelta');
  s = scegli(s, scelte);
  expect(s.fase.nome).toBe('rivelazione');
  return prosegui(s);
}

function corrente(s: Stato): VoceEffetto {
  const f = inFase(s, 'effetti');
  const v = f.coda[f.indice];
  if (!v) throw new Error('nessuna voce corrente');
  return v;
}

const ordine = (s: Stato): string[] => inFase(s, 'effetti').coda.map((v) => `${v.giocatore}:${v.effetto}`);
/** Esiti delle voci (eventi 'effetto') dal numero di sequenza indicato, come "giocatore:esito". */
const esitiDa = (s: Stato, seq: number): string[] =>
  s.eventi.filter((e) => e.seq >= seq && e.tipo === 'effetto').map((e) => (e.tipo === 'effetto' ? `${e.giocatore}:${e.esito}` : ''));

function attiva(s: Stato, bersaglio?: IdGiocatore): Stato {
  const v = corrente(s);
  const azione: Azione =
    bersaglio === undefined
      ? { tipo: 'attivaEffetto', giocatore: v.giocatore, carta: v.carta }
      : { tipo: 'attivaEffetto', giocatore: v.giocatore, carta: v.carta, bersaglio };
  return applica(s, azione);
}

const attivaERisolvi = (s: Stato, bersaglio?: IdGiocatore): Stato => nessunaReazione(attiva(s, bersaglio));

function rinuncia(s: Stato): Stato {
  const v = corrente(s);
  return applica(s, { tipo: 'rinunciaEffetto', giocatore: v.giocatore, carta: v.carta });
}

function cima(s: Stato): VocePila {
  const v = s.pila[s.pila.length - 1];
  if (!v) throw new Error('pila vuota');
  return v;
}

function beeeNo(s: Stato, g: IdGiocatore): Stato {
  return applica(s, { tipo: 'giocaBelato', giocatore: g, carta: carta(s, g, 'beee-no'), voce: cima(s).id });
}

function completa(s: Stato, carte: IdCarta[]): Stato {
  if (!s.richiesta) throw new Error('nessuna richiesta in corso');
  return applica(s, { tipo: 'completaEffetto', giocatore: s.richiesta.giocatore, carte });
}

function rifiutata(s: Stato, azione: Azione): void {
  const copia = structuredClone(s);
  expect(() => applica(s, azione), JSON.stringify(azione)).toThrow(ErroreRegola);
  expect(s).toEqual(copia);
}

function gioc(s: Stato, id: IdGiocatore) {
  const g = s.giocatori.find((x) => x.id === id);
  if (!g) throw new Error(`giocatore ${id} inesistente`);
  return g;
}
const agnellini = (s: Stato, id: IdGiocatore): number => gioc(s, id).agnellini;
const mano = (s: Stato, id: IdGiocatore): IdCarta[] => gioc(s, id).mano;
const tipo = (c: IdCarta): string => c.split('#')[0] as string;

function giocata(s: Stato, g: IdGiocatore, t: IdTipoCarta): IdCarta {
  const c = (s.datiRound.giocate[g] ?? []).find((id) => tipo(id) === t);
  if (c === undefined) throw new Error(`${g} non ha giocato ${t}`);
  return c;
}

function belato(s: Stato, g: IdGiocatore, t: IdTipoCarta, bersaglio?: IdGiocatore): Stato {
  const azione: Azione =
    bersaglio === undefined
      ? { tipo: 'giocaBelato', giocatore: g, carta: carta(s, g, t) }
      : { tipo: 'giocaBelato', giocatore: g, carta: carta(s, g, t), bersaglio };
  return nessunaReazione(applica(s, azione));
}

const totali = (s: Stato, ids: IdGiocatore[]): number[] => ids.map((id) => totale(s, id));

/** Da scenario alla fase 'dado': scelta, rivelazione, effetti rinunciati, chiusura del punteggio. */
function alDado(o: OpzioniScenario, scelte: Scelte): Stato {
  let s = finoAgliEffetti(o, scelte);
  while (s.fase.nome === 'effetti') s = rinuncia(s);
  if (s.fase.nome === 'belati_punteggio') s = chiudiPunteggio(s);
  expect(s.fase.nome).toBe('dado');
  return s;
}

function lanciatoreCorrente(s: Stato): IdGiocatore {
  const f = inFase(s, 'dado');
  const g = s.datiRound.lanciatori[f.indice];
  if (g === undefined) throw new Error('nessun lanciatore corrente');
  return g;
}

/** Forza la faccia e fa lanciare il lanciatore corrente. */
const lancia = (s: Stato, faccia: string): Stato =>
  applica(conFaccia(s, faccia), { tipo: 'lanciaDado', giocatore: lanciatoreCorrente(s) });

function dichiarazione(s: Stato): DichiarazioneDado {
  const d = inFase(s, 'risoluzione_dado').dichiarazione;
  if (!d) throw new Error('nessuna dichiarazione');
  return d;
}

const senzaZeri = (r: Record<IdGiocatore, number>): Record<IdGiocatore, number> =>
  Object.fromEntries(Object.entries(r).filter(([, n]) => n !== 0));

function ripartizioniElencate(s: Stato, chi: IdGiocatore): string[] {
  return azioniPossibili(s, chi)
    .filter((a): a is Extract<Azione, { tipo: 'dichiaraDado' }> => a.tipo === 'dichiaraDado')
    .map((a) => JSON.stringify(Object.entries(senzaZeri(a.furto ?? {})).sort()))
    .sort();
}

// ─── Attivabilità valutata quando la voce diventa corrente ───────────────────

describe('attivabilità valutata quando la voce diventa corrente (§4.4, tabella 6, D11)', () => {
  it('due Cannocchiali con 2 carte nel mazzo: il primo le prende entrambe, il secondo è saltato; scatta l\'ultimo round (D17, D31)', () => {
    let s = finoAgliEffetti(
      {
        agnellini: { g1: 2, g2: 4, g3: 3 },
        mazzo: ['beee-no', 'balla-di-fieno'],
        mani: { g1: ['cannocchiale'], g2: ['cannocchiale'], g3: ['carriola'] },
      },
      { g1: ['cannocchiale'], g2: ['cannocchiale'], g3: ['carriola'] },
    );
    expect(ordine(s)).toEqual(['g1:guarda_due', 'g2:guarda_due']);
    s = attivaERisolvi(s);
    expect(s.richiesta?.tipo).toBe('guarda_due');
    expect(s.mazzo).toEqual([]);
    expect(s.ultimoRound).toBe(2);
    const guardate = s.richiesta?.tipo === 'guarda_due' ? s.richiesta.carte : [];
    const tenuta = guardate.find((c) => tipo(c) === 'beee-no') as IdCarta;
    s = completa(s, [tenuta]);
    expect(mano(s, 'g1')).toEqual([tenuta]);
    // Il mazzo è vuoto quando la voce di g2 diventa corrente: saltata, senza chiedere nulla a g2.
    expect(s.fase.nome).toBe('belati_punteggio');
    expect(s.eventi.filter((e) => e.tipo === 'effetto').map((e) => e.tipo === 'effetto' && `${e.giocatore}:${e.esito}`)).toContain(
      'g2:saltato',
    );
  });

  it('due Campanacci: il primo toglie l\'ultimo agnellino disponibile, il secondo resta senza bersagli ed è saltato', () => {
    let s = finoAgliEffetti(
      {
        agnellini: { g1: 0, g2: 1, g3: 0 },
        mani: { g1: ['campanaccio-stonato'], g2: ['campanaccio-stonato'], g3: ['carriola'] },
      },
      { g1: ['campanaccio-stonato'], g2: ['campanaccio-stonato'], g3: ['carriola'] },
    );
    expect(ordine(s)).toEqual(['g1:sposta_agnellino', 'g2:sposta_agnellino']);
    expect(azioniPossibili(s, 'g1').filter((a) => a.tipo === 'attivaEffetto')).toEqual([
      { tipo: 'attivaEffetto', giocatore: 'g1', carta: corrente(s).carta, bersaglio: 'g2' },
    ]);
    s = attivaERisolvi(s, 'g2');
    expect(agnellini(s, 'g2')).toBe(0);
    expect(s.fase.nome).toBe('belati_punteggio');
    expect(s.eventi.some((e) => e.tipo === 'effetto' && e.giocatore === 'g2' && e.esito === 'saltato')).toBe(true);
  });

  it('Pulizie di primavera: se il proprietario ha speso l\'unica carta (un Beee-NO!) su un effetto precedente, la sua voce è saltata', () => {
    let s = finoAgliEffetti(
      { gregge: 10, mani: { g1: ['agnellino-smarrito'], g2: ['pulizie-di-primavera', 'beee-no'], g3: ['carriola'] } },
      { g1: ['agnellino-smarrito'], g2: ['pulizie-di-primavera'], g3: ['carriola'] },
    );
    expect(ordine(s)).toEqual(['g1:prendi_agnellino', 'g2:scarta_fino_a_tre']);
    expect(mano(s, 'g2')).toHaveLength(1);
    s = nessunaReazione(beeeNo(attiva(s), 'g2'));
    expect(agnellini(s, 'g1')).toBe(3);
    expect(mano(s, 'g2')).toEqual([]);
    expect(s.fase.nome).toBe('belati_punteggio');
    expect(s.richiesta).toBeNull();
    expect(s.eventi.some((e) => e.tipo === 'effetto' && e.giocatore === 'g2' && e.esito === 'saltato')).toBe(true);
  });

  it('Pulizie di primavera: il proprietario difende il proprio effetto con l\'unica carta; risolto con la mano vuota, nessuna richiesta', () => {
    let s = finoAgliEffetti(
      { mani: { g1: ['carriola', 'beee-no'], g2: ['pulizie-di-primavera', 'beee-no'], g3: ['sasso-comodo'] } },
      { g1: ['carriola'], g2: ['pulizie-di-primavera'], g3: ['sasso-comodo'] },
    );
    s = beeeNo(attiva(s), 'g1');
    s = beeeNo(s, 'g2');
    expect(s.pila).toHaveLength(3);
    s = nessunaReazione(s);
    expect(mano(s, 'g2')).toEqual([]);
    expect(s.richiesta).toBeNull();
    expect(s.fase.nome).toBe('belati_punteggio');
    expect(s.eventi.some((e) => e.tipo === 'annullata')).toBe(true);
    expect(s.eventi.some((e) => e.tipo === 'effetto' && e.giocatore === 'g2' && e.esito === 'annullato')).toBe(false);
  });
});

describe('ordine della coda a parità di gruppo e valore (brief 3 punto 4; §4.4, D10)', () => {
  it('tre Scorte nel vello con gli stessi agnellini: al variare del seme compaiono tutti e 6 gli ordini, ciascuno riproducibile', () => {
    const scelte: Scelte = { g1: ['scorta-nel-vello'], g2: ['scorta-nel-vello'], g3: ['scorta-nel-vello'], g4: ['carriola'] };
    const visti = new Set<string>();
    for (let seme = 1; seme <= 80; seme++) {
      const o: OpzioniScenario = {
        seme,
        giocatori: 4,
        mani: {
          g1: ['scorta-nel-vello', 'sasso-comodo'],
          g2: ['scorta-nel-vello', 'sasso-comodo'],
          g3: ['scorta-nel-vello', 'sasso-comodo'],
          g4: ['carriola'],
        },
      };
      const a = finoAgliEffetti(o, scelte);
      expect(finoAgliEffetti(o, scelte)).toEqual(a);
      visti.add(ordine(a).join(' '));
    }
    expect(visti.size).toBe(6);
  });

  it('a parità di valore gli agnellini non decidono (D10, 21/10/2026): con agnellini diversi compaiono tutti e 6 gli ordini', () => {
    const scelte: Scelte = { g1: ['scorta-nel-vello'], g2: ['scorta-nel-vello'], g3: ['scorta-nel-vello'] };
    const visti = new Set<string>();
    for (let seme = 1; seme <= 80; seme++) {
      const o: OpzioniScenario = {
        seme,
        agnellini: { g1: 4, g2: 4, g3: 1 },
        mani: { g1: ['scorta-nel-vello', 'sasso-comodo'], g2: ['scorta-nel-vello', 'sasso-comodo'], g3: ['scorta-nel-vello', 'sasso-comodo'] },
      };
      const a = finoAgliEffetti(o, scelte);
      expect(finoAgliEffetti(o, scelte)).toEqual(a);
      visti.add(ordine(a).join(' '));
    }
    expect(visti.size).toBe(6);
  });
});

// ─── Tappi per le orecchie ───────────────────────────────────────────────────

describe('Tappi per le orecchie: combinazioni non coperte (brief 4; §6, D12)', () => {
  it('primi Tappi rinunciati: i secondi Tappi possono ancora ignorare gli altri effetti', () => {
    let s = finoAgliEffetti(
      {
        gregge: 10,
        agnellini: { g1: 2, g2: 4, g3: 3 },
        mani: { g1: ['tappi-per-le-orecchie'], g2: ['tappi-per-le-orecchie'], g3: ['agnellino-smarrito'] },
      },
      { g1: ['tappi-per-le-orecchie'], g2: ['tappi-per-le-orecchie'], g3: ['agnellino-smarrito'] },
    );
    expect(ordine(s)).toEqual(['g1:ignora_effetti', 'g2:ignora_effetti', 'g3:prendi_agnellino']);
    s = rinuncia(s);
    expect(corrente(s).giocatore).toBe('g2');
    s = attivaERisolvi(s);
    expect(s.datiRound.ignoraEffetti).toEqual({ giocatore: 'g2', carta: giocata(s, 'g2', 'tappi-per-le-orecchie') });
    expect(agnellini(s, 'g3')).toBe(3);
    expect(s.fase.nome).toBe('belati_punteggio');
  });

  it('Tappi annullati e Beee-NO! annullato a sua volta: i Tappi valgono e gli altri effetti sono ignorati (D6, D12)', () => {
    let s = finoAgliEffetti(
      {
        gregge: 10,
        mani: { g1: ['tappi-per-le-orecchie', 'beee-no'], g2: ['agnellino-smarrito', 'beee-no'], g3: ['capriola'] },
      },
      { g1: ['tappi-per-le-orecchie'], g2: ['agnellino-smarrito'], g3: ['capriola'] },
    );
    const seq = s.prossimoEvento;
    s = beeeNo(attiva(s), 'g2');
    s = beeeNo(s, 'g1');
    s = nessunaReazione(s);
    expect(s.datiRound.ignoraEffetti?.giocatore).toBe('g1');
    expect(esitiDa(s, seq)).toEqual(['g1:attivato', 'g2:ignorato', 'g3:ignorato']);
    expect(agnellini(s, 'g2')).toBe(3);
    expect(totali(s, ['g1', 'g2', 'g3'])).toEqual([9, 1, 5]);
    expect(s.fase.nome).toBe('belati_punteggio');
  });

  it('Scorta nel vello che scarta dei Tappi dalla mano: nessun "ignora", gli effetti successivi valgono, +9 (D16)', () => {
    let s = finoAgliEffetti(
      {
        gregge: 10,
        mani: { g1: ['scorta-nel-vello', 'tappi-per-le-orecchie'], g2: ['agnellino-smarrito'], g3: ['carriola'] },
      },
      { g1: ['scorta-nel-vello'], g2: ['agnellino-smarrito'], g3: ['carriola'] },
    );
    expect(ordine(s)).toEqual(['g1:scarta_e_somma', 'g2:prendi_agnellino']);
    s = attivaERisolvi(s);
    s = completa(s, [carta(s, 'g1', 'tappi-per-le-orecchie')]);
    expect(s.datiRound.ignoraEffetti).toBeNull();
    expect(totale(s, 'g1')).toBe(9);
    expect(corrente(s).giocatore).toBe('g2');
    s = attivaERisolvi(s);
    expect(agnellini(s, 'g2')).toBe(4);
  });

  it('Tappi non toccano Mondo alla rovescia: lo scambio dei Belati vale anche con le altre Trovate ignorate', () => {
    let s = finoAgliEffetti(
      { mani: { g1: ['tappi-per-le-orecchie'], g2: ['capriola', 'mondo-alla-rovescia'], g3: ['sasso-comodo'] } },
      { g1: ['tappi-per-le-orecchie'], g2: ['capriola'], g3: ['sasso-comodo'] },
    );
    s = attivaERisolvi(s);
    expect(s.fase.nome).toBe('belati_punteggio');
    expect(totali(s, ['g1', 'g2', 'g3'])).toEqual([9, 5, 2]);
    s = belato(s, 'g2', 'mondo-alla-rovescia');
    expect(totali(s, ['g1', 'g2', 'g3'])).toEqual([2, 5, 9]);
  });
});

// ─── Richieste private ───────────────────────────────────────────────────────

describe('richieste private con mani particolari (§6, §10, D4)', () => {
  it('Cannocchiale: un Beee-NO! tenuto dalle carte guardate si può giocare subito su un effetto successivo del round', () => {
    let s = finoAgliEffetti(
      { mazzo: ['beee-no', 'sasso-comodo', 'carriola'], mani: { g1: ['cannocchiale'], g2: ['capriola'], g3: ['sasso-comodo'] } },
      { g1: ['cannocchiale'], g2: ['capriola'], g3: ['sasso-comodo'] },
    );
    expect(ordine(s)).toEqual(['g1:guarda_due', 'g2:scambia_punteggi']);
    s = attivaERisolvi(s);
    const guardate = s.richiesta?.tipo === 'guarda_due' ? s.richiesta.carte : [];
    s = completa(s, [guardate.find((c) => tipo(c) === 'beee-no') as IdCarta]);
    s = beeeNo(attiva(s), 'g1');
    s = nessunaReazione(s);
    expect(totali(s, ['g1', 'g2', 'g3'])).toEqual([7, 5, 2]);
    expect(s.fase.nome).toBe('belati_punteggio');
  });

  it('durante una richiesta: gli altri non hanno azioni, scadenza e passa sono rifiutati; la vista tavolo non mostra le carte guardate', () => {
    let s = finoAgliEffetti(
      { mani: { g1: ['cannocchiale'], g2: ['carriola', 'beee-no'], g3: ['sasso-comodo'] } },
      { g1: ['cannocchiale'], g2: ['carriola'], g3: ['sasso-comodo'] },
    );
    s = attivaERisolvi(s);
    expect(s.richiesta?.tipo).toBe('guarda_due');
    expect(inAttesaDi(s)).toEqual({ sistema: false, giocatori: ['g1'] });
    expect(azioniPossibili(s, 'g2')).toEqual([]);
    expect(azioniPossibili(s, 'sistema')).toEqual([]);
    rifiutata(s, { tipo: 'scadenza' });
    rifiutata(s, { tipo: 'passa', giocatore: 'g2' });
    rifiutata(s, { tipo: 'giocaBelato', giocatore: 'g2', carta: carta(s, 'g2', 'beee-no'), voce: s.prossimaVoce - 1 });
    const tavolo = vistaPer(s, null).richiesta;
    expect(tavolo?.tipo === 'guarda_due' ? tavolo.carte : null).toEqual([]);
  });

  it('Scorta nel vello con due Gemelle e un Belato in mano: le opzioni sono una per tipo di Trovata, la Gemella vale il suo valore', () => {
    let s = finoAgliEffetti(
      {
        mani: {
          g1: ['scorta-nel-vello', 'calzino-gemello', 'calzino-gemello', 'belato-di-gruppo'],
          g2: ['carriola'],
          g3: ['sasso-comodo'],
        },
      },
      { g1: ['scorta-nel-vello'], g2: ['carriola'], g3: ['sasso-comodo'] },
    );
    s = attivaERisolvi(s);
    const opzioni = azioniPossibili(s, 'g1');
    expect(opzioni).toHaveLength(1);
    s = applica(s, opzioni[0] as Azione);
    expect(totale(s, 'g1')).toBe(3);
    expect(mano(s, 'g1').map(tipo).sort()).toEqual(['belato-di-gruppo', 'calzino-gemello']);
  });
});

// ─── Scambio ─────────────────────────────────────────────────────────────────

describe('scambio dei punteggi: pari agli estremi e partecipanti non ovvi (brief 3 "Scambio dei punteggi"; §7)', () => {
  it('a 4 giocatori, due pari al massimo e due pari al minimo: si scambiano tutti e quattro', () => {
    let s = finoAgliEffetti(
      {
        giocatori: 4,
        mani: {
          g1: ['carriola'],
          g2: ['carriola', 'mondo-alla-rovescia'],
          g3: ['sasso-comodo'],
          g4: ['fischietto-da-richiamo'],
        },
      },
      { g1: ['carriola'], g2: ['carriola'], g3: ['sasso-comodo'], g4: ['fischietto-da-richiamo'] },
    );
    s = rinuncia(s);
    expect(totali(s, ['g1', 'g2', 'g3', 'g4'])).toEqual([8, 8, 2, 2]);
    s = belato(s, 'g2', 'mondo-alla-rovescia');
    expect(totali(s, ['g1', 'g2', 'g3', 'g4'])).toEqual([2, 2, 8, 8]);
  });

  it('chi entra nel round dopo una ripescata è partecipante: conta come minimo nello scambio', () => {
    // g3 non ha Trovate: scarta e ripesca 5 carte, la prima Trovata è un Sasso comodo (2).
    let s = prosegui(
      scenario({
        guaio: NEUTRO,
        mazzo: ['beee-no', 'beee-no', 'sasso-comodo', 'pernacchia', 'pernacchia', 'balla-di-fieno'],
        mani: { g1: ['carriola'], g2: ['capriola'], g3: ['belato-di-gruppo'] },
      }),
    );
    expect(s.datiRound.partecipanti).toEqual(['g1', 'g2', 'g3']);
    s = scegli(s, { g1: ['carriola'], g2: ['capriola'], g3: ['sasso-comodo'] });
    s = attivaERisolvi(prosegui(s));
    expect(totali(s, ['g1', 'g2', 'g3'])).toEqual([2, 5, 8]);
  });

  it('Capriola dopo un pari creato dalla Scorta nel vello: lo scambio coinvolge entrambi i pari al massimo (D13)', () => {
    let s = finoAgliEffetti(
      { mani: { g1: ['scorta-nel-vello', 'carriola'], g2: ['carriola'], g3: ['capriola'] } },
      { g1: ['scorta-nel-vello'], g2: ['carriola'], g3: ['capriola'] },
    );
    s = attivaERisolvi(s);
    s = completa(s, [carta(s, 'g1', 'carriola')]);
    expect(totali(s, ['g1', 'g2', 'g3'])).toEqual([8, 8, 5]);
    s = attivaERisolvi(s);
    expect(totali(s, ['g1', 'g2', 'g3'])).toEqual([5, 5, 8]);
  });
});

// ─── Raddoppio ───────────────────────────────────────────────────────────────

describe('raddoppio dei Belati ±2 (§6, §7, D14)', () => {
  it('primo Megafono annullato: il secondo raddoppia comunque', () => {
    let s = finoAgliEffetti(
      {
        agnellini: { g1: 2, g2: 4, g3: 3 },
        mani: { g1: ['megafono-di-latta'], g2: ['megafono-di-latta'], g3: ['sasso-comodo', 'beee-no', 'belato-di-gruppo'] },
      },
      { g1: ['megafono-di-latta'], g2: ['megafono-di-latta'], g3: ['sasso-comodo'] },
    );
    expect(ordine(s)).toEqual(['g1:raddoppia_belati', 'g2:raddoppia_belati']);
    s = nessunaReazione(beeeNo(attiva(s), 'g3'));
    expect(s.datiRound.raddoppioBelati).toBe(false);
    s = attivaERisolvi(s);
    expect(s.datiRound.raddoppioBelati).toBe(true);
    s = belato(s, 'g3', 'belato-di-gruppo', 'g3');
    expect(totale(s, 'g3')).toBe(6);
  });

  it('un Belato +2 raddoppiato porta un secondo giocatore in pari al vertice: lanciano entrambi, prima chi ha meno agnellini (4.6, D19)', () => {
    // Guaio Meteo: Ricciolo (g1) +1, Sospirella (g3) −1.
    let s = finoAgliEffetti(
      {
        guaio: 'grandine-a-sorpresa',
        agnellini: { g1: 5, g2: 2 },
        mani: { g1: ['corona-di-margherite'], g2: ['megafono-di-latta', 'belato-di-gruppo'], g3: ['sasso-comodo'] },
      },
      { g1: ['corona-di-margherite'], g2: ['megafono-di-latta'], g3: ['sasso-comodo'] },
    );
    s = attivaERisolvi(s);
    expect(totali(s, ['g1', 'g2', 'g3'])).toEqual([10, 6, 1]);
    s = belato(s, 'g2', 'belato-di-gruppo', 'g2');
    expect(totali(s, ['g1', 'g2', 'g3'])).toEqual([10, 10, 1]);
    s = chiudiPunteggio(s);
    expect(s.datiRound.piuBassi).toEqual(['g3']);
    expect(s.datiRound.lanciatori).toEqual(['g2', 'g1']);
  });

  it('il raddoppio vale anche per i Belati giocati da chi è fuori dal round (D14, D34)', () => {
    let s = finoAgliEffetti(
      { mazzo: [], mani: { g1: ['megafono-di-latta'], g2: ['carriola'], g3: ['pernacchia'] } },
      { g1: ['megafono-di-latta'], g2: ['carriola'] },
    );
    expect(s.datiRound.partecipanti).toEqual(['g1', 'g2']);
    s = attivaERisolvi(s);
    s = belato(s, 'g3', 'pernacchia', 'g2');
    expect(totale(s, 'g2')).toBe(4);
  });
});

// ─── Dado: furto ─────────────────────────────────────────────────────────────

/** g1 Carriola (8), g2 Balla di fieno (5), g3 Sasso comodo (2): lancia g1. */
function treGiocatori(o: OpzioniScenario = {}): Stato {
  const scelte: Scelte = { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['sasso-comodo'] };
  return alDado({ mani: scelte, ...o }, scelte);
}

describe('furto: limiti dei posti, ripartizioni obbligate e libere (brief "Il Dado del Pastore"; 4.7, D20)', () => {
  it('1 posto libero e due avversari con agnellini: si ruba 1 solo agnellino, ripartizione libera tra i due', () => {
    let s = lancia(treGiocatori({ agnellini: { g1: POSTI3 - 1 } }), 'furto_piccolo');
    expect(inFase(s, 'risoluzione_dado').passo).toBe('dichiarazione');
    expect(ripartizioniElencate(s, 'g1')).toEqual([JSON.stringify([['g2', 1]]), JSON.stringify([['g3', 1]])].sort());
    rifiutata(s, { tipo: 'dichiaraDado', giocatore: 'g1', furto: { g2: 1, g3: 1 } });
    rifiutata(s, { tipo: 'dichiaraDado', giocatore: 'g1', furto: { g2: 2 } });
    s = nessunaReazione(applica(s, { tipo: 'dichiaraDado', giocatore: 'g1', furto: { g3: 1 } }));
    expect(agnellini(s, 'g1')).toBe(POSTI3);
    expect(agnellini(s, 'g3')).toBe(2);
    expect(s.esito).toEqual({ modo: 'ovile_pieno', vincitori: ['g1'] });
  });

  it('2 posti liberi e due avversari con 1 agnellino ciascuno: ripartizione obbligata (tutti i loro), niente dal Gregge, vittoria', () => {
    const gregge = 20;
    let s = lancia(treGiocatori({ agnellini: { g1: POSTI3 - 2, g2: 1, g3: 1 }, gregge }), 'furto_grande');
    expect(inFase(s, 'risoluzione_dado').passo).toBe('reazione');
    const d = dichiarazione(s);
    expect(d.effetto === 'furto' && { ...d, daAvversari: senzaZeri(d.daAvversari) }).toEqual({
      effetto: 'furto',
      daAvversari: { g2: 1, g3: 1 },
      dalGregge: 0,
    });
    s = nessunaReazione(s);
    expect(agnellini(s, 'g1')).toBe(POSTI3);
    expect(s.gregge).toBe(gregge);
    expect(s.esito).toEqual({ modo: 'ovile_pieno', vincitori: ['g1'] });
  });

  it('2 posti liberi, un avversario con 1 agnellino: 1 da lui e 1 dal Gregge, non di più', () => {
    let s = lancia(treGiocatori({ agnellini: { g1: POSTI3 - 2, g2: 1, g3: 0 }, gregge: 10 }), 'furto_grande');
    const d = dichiarazione(s);
    expect(d.effetto === 'furto' && { ...d, daAvversari: senzaZeri(d.daAvversari) }).toEqual({
      effetto: 'furto',
      daAvversari: { g2: 1 },
      dalGregge: 1,
    });
    s = nessunaReazione(s);
    expect(agnellini(s, 'g1')).toBe(POSTI3);
    expect(s.gregge).toBe(9);
  });

  it('a 4 giocatori: tre avversari con 1 agnellino ⇒ furto grande obbligato su tutti e tre più 1 dal Gregge', () => {
    const scelte: Scelte = { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['trifoglio-qualunque'], g4: ['sasso-comodo'] };
    let s = lancia(
      alDado({ giocatori: 4, mani: scelte, agnellini: { g1: 3, g2: 1, g3: 1, g4: 1 }, gregge: 10 }, scelte),
      'furto_grande',
    );
    expect(inFase(s, 'risoluzione_dado').passo).toBe('reazione');
    const d = dichiarazione(s);
    expect(d.effetto === 'furto' && senzaZeri(d.daAvversari)).toEqual({ g2: 1, g3: 1, g4: 1 });
    expect(d.effetto === 'furto' && d.dalGregge).toBe(1);
    s = nessunaReazione(s);
    expect(agnellini(s, 'g1')).toBe(7);
    expect(s.gregge).toBe(9);
  });

  it('ripartizione con uno zero esplicito: accettata; un eliminato nella ripartizione, anche a zero, la fa rifiutare (4.7)', () => {
    const scelte: Scelte = { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['sasso-comodo'] };
    const s0 = lancia(
      alDado({ giocatori: 4, eliminati: ['g4'], mani: { ...scelte, g4: [] }, agnellini: { g4: 0 } }, scelte),
      'furto_piccolo',
    );
    expect(inFase(s0, 'risoluzione_dado').passo).toBe('dichiarazione');
    rifiutata(s0, { tipo: 'dichiaraDado', giocatore: 'g1', furto: { g2: 1, g3: 1, g4: 0 } });
    const s = applica(s0, { tipo: 'dichiaraDado', giocatore: 'g1', furto: { g2: 2, g3: 0 } });
    expect(senzaZeri((dichiarazione(s) as Extract<DichiarazioneDado, { effetto: 'furto' }>).daAvversari)).toEqual({ g2: 2 });
  });
});

// ─── Dado: più lanciatori, Testata, Ovile pieno a metà dado ───────────────────

/** g1 e g2 pari al massimo con 8, g3 più basso con 2. */
function pariAlVertice(o: OpzioniScenario = {}): Stato {
  const scelte: Scelte = { g1: ['carriola'], g2: ['carriola'], g3: ['sasso-comodo'] };
  return alDado({ mani: scelte, ...o }, scelte);
}

describe('più lanciatori, Testata e Ovile pieno a metà dado (brief "Parità", "Il Dado del Pastore"; 4.7, D19, D21, 9.1)', () => {
  it('tre lanciatori: il secondo riempie l\'Ovile, vince subito e il terzo non lancia', () => {
    const scelte: Scelte = { g1: ['carriola'], g2: ['carriola'], g3: ['carriola'], g4: ['sasso-comodo'] };
    let s = alDado({ giocatori: 4, mani: scelte, agnellini: { g1: 2, g2: 11, g3: 10, g4: 3 } }, scelte);
    expect(s.datiRound.lanciatori).toEqual(['g1', 'g3', 'g2']);
    s = nessunaReazione(lancia(s, 'pascolo_piccolo'));
    expect(lanciatoreCorrente(s)).toBe('g3');
    s = lancia(s, 'pascolo_grande');
    expect(dichiarazione(s)).toEqual({ effetto: 'pascolo', quantita: 2 });
    s = nessunaReazione(s);
    expect(s.esito).toEqual({ modo: 'ovile_pieno', vincitori: ['g3'] });
    expect(s.eventi.filter((e) => e.tipo === 'dado_lanciato').map((e) => e.tipo === 'dado_lanciato' && e.giocatore)).toEqual([
      'g1',
      'g3',
    ]);
  });

  it('il secondo lanciatore può colpire con la Testata il primo lanciatore', () => {
    let s = pariAlVertice({ agnellini: { g1: 5, g2: 2 } });
    expect(s.datiRound.lanciatori).toEqual(['g2', 'g1']);
    s = nessunaReazione(lancia(s, 'pascolo_piccolo'));
    s = lancia(s, 'testata');
    s = nessunaReazione(applica(s, { tipo: 'dichiaraDado', giocatore: 'g1', bersaglio: 'g2' }));
    expect(inFase(s, 'risoluzione_dado').passo).toBe('esito_testata');
    s = applica(s, { tipo: 'esitoTestata', giocatore: 'g1', esito: 3 });
    expect(agnellini(s, 'g2')).toBe(2);
    expect(s.fase).toEqual({ nome: 'guaio_al_peggiore', destinatario: 'g3', spareggio: null });
  });

  it('il Pascolo del secondo lanciatore è limitato dal Gregge svuotato dal primo', () => {
    let s = pariAlVertice({ agnellini: { g1: 3, g2: 2 }, gregge: 6 });
    s = nessunaReazione(lancia(s, 'pascolo_grande'));
    expect(s.gregge).toBe(1);
    s = lancia(s, 'pascolo_piccolo');
    expect(dichiarazione(s)).toEqual({ effetto: 'pascolo', quantita: 1 });
    s = nessunaReazione(s);
    expect(agnellini(s, 'g1')).toBe(4);
    expect(s.gregge).toBe(0);
  });

  it('una Testata che svuota l\'unico bersaglio lascia il lanciatore successivo senza bersagli: la sua Testata non ha effetto (D21, D22)', () => {
    let s = pariAlVertice({ agnellini: { g1: 1, g2: 0, g3: 0 } });
    expect(s.datiRound.lanciatori).toEqual(['g2', 'g1']);
    s = lancia(s, 'testata');
    expect(dichiarazione(s)).toEqual({ effetto: 'testata', bersaglio: 'g1' });
    s = nessunaReazione(s);
    s = applica(s, { tipo: 'esitoTestata', giocatore: 'g2', esito: 1 });
    expect(agnellini(s, 'g1')).toBe(0);
    const seq = s.prossimoEvento;
    s = lancia(s, 'testata');
    expect(s.pila).toEqual([]);
    expect(s.eventi.filter((e) => e.seq >= seq && e.tipo === 'dichiarazione')).toEqual([]);
    expect(s.fase).toEqual({ nome: 'guaio_al_peggiore', destinatario: 'g3', spareggio: null });
  });

  it('Ovile pieno a metà dado con la pila carica: Beee-NO! contro Beee-NO!, il Pascolo si applica e la partita finisce', () => {
    const scelte: Scelte = { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['sasso-comodo'] };
    let s = alDado(
      {
        agnellini: { g1: POSTI3 - 2 },
        mani: { g1: ['carriola', 'beee-no'], g2: ['balla-di-fieno', 'beee-no'], g3: ['sasso-comodo'] },
      },
      scelte,
    );
    s = lancia(s, 'pascolo_piccolo');
    s = beeeNo(s, 'g2');
    s = beeeNo(s, 'g1');
    expect(s.pila).toHaveLength(3);
    s = nessunaReazione(s);
    expect(agnellini(s, 'g1')).toBe(POSTI3);
    expect(s.esito).toEqual({ modo: 'ovile_pieno', vincitori: ['g1'] });
    expect(s.pila).toEqual([]);
    expect(s.finestra).toBeNull();
  });

  it('Testata: un esito non numerico (stringa, null) è rifiutato senza toccare lo stato; poi un esito valido si applica', () => {
    let s = nessunaReazione(applica(lancia(treGiocatori(), 'testata'), { tipo: 'dichiaraDado', giocatore: 'g1', bersaglio: 'g2' }));
    rifiutata(s, { tipo: 'esitoTestata', giocatore: 'g1', esito: '1' as unknown as number });
    rifiutata(s, { tipo: 'esitoTestata', giocatore: 'g1', esito: null as unknown as number });
    s = applica(s, { tipo: 'esitoTestata', giocatore: 'g1', esito: 2 });
    expect(agnellini(s, 'g2')).toBe(1);
  });
});
