import { describe, expect, it } from 'vitest';
import { applica, azioniPossibili, inAttesaDi, nuovaPartita, vistaPer } from '../../../../engine/src';
import { carta, nessunaReazione, prosegui, scenario } from '../../../../engine/test/aiuti';
import type { DettagliVoce, Evento, NuovoEvento, Vista } from '../../../../engine/src';
import { ATTESA_METEO_MS, copione } from './copione';
import type { Battuta } from './copione';
import { T } from '../../testi';

const vista: Vista = vistaPer(
  nuovaPartita({
    giocatori: [
      { id: 'g1', nome: 'Anna', pecora: 'ricciolo' },
      { id: 'g2', nome: 'Bruno', pecora: 'brontolana' },
      { id: 'g3', nome: 'Carla', pecora: 'sospirella' },
    ],
    seme: 3,
  }),
  null,
);

/** Eventi senza seq: i seq crescenti li assegna la prova. */
function eventi(...nuovi: NuovoEvento[]): Evento[] {
  return nuovi.map((e, i) => ({ ...e, seq: 100 + i }) as Evento);
}
const da = (...nuovi: NuovoEvento[]): Battuta[] => copione(eventi(...nuovi), vista);
const unica = (...nuovi: NuovoEvento[]): Battuta => {
  const b = da(...nuovi);
  expect(b).toHaveLength(1);
  return b[0]!;
};
type Di<K extends Battuta['tipo']> = Extract<Battuta, { tipo: K }>;

describe('copione: round e Guai', () => {
  it('ATTESA_METEO_MS vale 5000', () => {
    expect(ATTESA_METEO_MS).toBe(5000);
  });

  it('guaio_rivelato con carta: guaioRivelato, attesa fine', () => {
    expect(unica({ tipo: 'guaio_rivelato', carta: 'insonnia#1' })).toEqual({
      tipo: 'guaioRivelato',
      carta: 'insonnia#1',
      attesa: { tipo: 'fine' },
    });
  });

  it('guaio_rivelato senza carta: nessuna battuta', () => {
    expect(da({ tipo: 'guaio_rivelato', carta: null })).toEqual([]);
  });

  it('round_iniziato con ultimo: annuncio "Ultimo round!" con attesa massimo 1200', () => {
    expect(unica({ tipo: 'round_iniziato', round: 4, ultimo: true })).toEqual({
      tipo: 'annuncio',
      testo: T.scena.annunci.ultimoRound,
      attesa: { tipo: 'massimo', ms: 1200 },
    });
    expect(T.scena.annunci.ultimoRound).toBe('Ultimo round!');
  });

  it("ultimo_round_annunciato (il mazzo è finito, anche a metà round): nessuna battuta, l'annuncio arriva all'inizio dell'ultimo round", () => {
    expect(da({ tipo: 'ultimo_round_annunciato', round: 4 })).toEqual([]);
  });

  it('"Ultimo round!" una sola volta nella partita', () => {
    const b = da({ tipo: 'ultimo_round_annunciato', round: 4 }, { tipo: 'round_iniziato', round: 4, ultimo: true });
    expect(b.filter((x) => x.tipo === 'annuncio')).toHaveLength(1);
  });

  it('round_iniziato normale: nessuna battuta', () => {
    expect(da({ tipo: 'round_iniziato', round: 2, ultimo: false })).toEqual([]);
  });
});

describe('copione: rivelazione e punteggi', () => {
  const rivelazione: NuovoEvento = {
    tipo: 'rivelazione',
    giocate: { g1: ['balla-di-fieno#1'], g2: ['sasso-comodo#1'], g3: ['carriola#1'] },
  };
  const riga = (giocatore: string, delta: number, totale: number): NuovoEvento => ({
    tipo: 'punteggio',
    giocatore,
    riga: { tipo: 'valore', delta, autore: giocatore },
    totale,
  });

  it('rivelazione con righe di punteggio: giraCarte e un solo fumetti con i totali', () => {
    const b = da(rivelazione, riga('g1', 5, 5), riga('g2', 3, 3), riga('g3', 4, 4), {
      tipo: 'punteggio',
      giocatore: 'g1',
      riga: { tipo: 'tratto', delta: 1, autore: 'g1' },
      totale: 6,
    });
    expect(b).toEqual([
      {
        tipo: 'giraCarte',
        carte: { g1: ['balla-di-fieno#1'], g2: ['sasso-comodo#1'], g3: ['carriola#1'] },
        attesa: { tipo: 'fine' },
      },
      {
        tipo: 'fumetti',
        testi: { g1: '6', g2: '3', g3: '4' },
        attesa: { tipo: 'massimo', ms: 1200 },
      },
    ]);
  });

  it('rivelazione senza righe: solo giraCarte', () => {
    expect(da(rivelazione).map((x) => x.tipo)).toEqual(['giraCarte']);
  });

  it('punteggio fuori dalla rivelazione (Belati): fumetti +2 / -2', () => {
    const belato = (delta: number): NuovoEvento => ({
      tipo: 'punteggio',
      giocatore: 'g2',
      riga: { tipo: 'belato', delta, carta: 'pernacchia#1', autore: 'g1' },
      totale: 5,
    });
    expect(unica(belato(2))).toEqual({ tipo: 'fumetti', testi: { g2: '+2' }, attesa: { tipo: 'massimo', ms: 1200 } });
    expect(unica(belato(-2))).toMatchObject({ testi: { g2: '-2' } });
    expect(T.scena.fumetti.delta(2)).toBe('+2');
    expect(T.scena.fumetti.delta(-2)).toBe('-2');
  });

  it('i punteggi separati da altri eventi non sono parte della rivelazione', () => {
    const b = da(rivelazione, riga('g1', 5, 5), { tipo: 'risolta', voce: 1 }, riga('g1', 2, 7));
    expect(b.map((x) => x.tipo)).toEqual(['giraCarte', 'fumetti', 'fumetti']);
    expect((b[1] as Di<'fumetti'>).testi).toEqual({ g1: '5' });
    expect((b[2] as Di<'fumetti'>).testi).toEqual({ g1: '+2' });
  });
});

describe('copione: dichiarazioni e Beee-NO!', () => {
  const dich = (autore: string, dettagli: DettagliVoce, voce = 1): NuovoEvento => ({
    tipo: 'dichiarazione',
    voce,
    autore,
    dettagli,
  });

  it('Trovata con effetto: volaCarta col nome della carta', () => {
    expect(unica(dich('g1', { tipo: 'effetto_trovata', carta: 'capriola#1', effetto: 'scambia_punteggi' }))).toEqual({
      tipo: 'volaCarta',
      daChi: 'g1',
      carta: 'capriola#1',
      testo: 'Capriola',
      attesa: { tipo: 'fine' },
    });
  });

  it('Belato (anche Beee-NO!): volaCarta', () => {
    const b = unica(dich('g2', { tipo: 'belato', carta: 'beee-no#1', effetto: 'beee_no', voceBersaglio: 1 }, 2));
    expect(b).toMatchObject({ tipo: 'volaCarta', daChi: 'g2', carta: 'beee-no#1', attesa: { tipo: 'fine' } });
    expect(typeof (b as Di<'volaCarta'>).testo).toBe('string');
    expect(
      unica(dich('g3', { tipo: 'belato', carta: 'pernacchia#1', effetto: 'modifica_punteggio', bersaglio: 'g1' })),
    ).toMatchObject({ tipo: 'volaCarta', daChi: 'g3' });
  });

  it('dado: fumetti sul lanciatore con la dichiarazione', () => {
    const pascolo = unica(
      dich('g1', { tipo: 'dado', faccia: 'pascolo_grande', dichiarazione: { effetto: 'pascolo', quantita: 5 } }),
    );
    expect(pascolo).toMatchObject({ tipo: 'fumetti', attesa: { tipo: 'massimo', ms: 1200 } });
    expect((pascolo as Di<'fumetti'>).testi).toEqual({ g1: T.scena.fumetti.pascolo(5) });
    const furto = unica(
      dich('g2', {
        tipo: 'dado',
        faccia: 'furto_grande',
        dichiarazione: { effetto: 'furto', daAvversari: { g1: 2, g3: 1 }, dalGregge: 1 },
      }),
    );
    expect((furto as Di<'fumetti'>).testi).toEqual({ g2: T.scena.fumetti.furto(4) });
    const testata = unica(
      dich('g3', { tipo: 'dado', faccia: 'testata', dichiarazione: { effetto: 'testata', bersaglio: 'g1' } }),
    );
    expect((testata as Di<'fumetti'>).testi).toEqual({ g3: T.scena.fumetti.testata });
  });

  it("annullata: beeeNo con chi annulla, chi è annullato e la carta annullata", () => {
    const b = da(
      dich('g1', { tipo: 'effetto_trovata', carta: 'capriola#1', effetto: 'scambia_punteggi' }, 1),
      dich('g2', { tipo: 'belato', carta: 'beee-no#1', effetto: 'beee_no', voceBersaglio: 1 }, 2),
      { tipo: 'annullata', voce: 1, da: 2 },
      { tipo: 'risolta', voce: 2 },
    );
    expect(b.map((x) => x.tipo)).toEqual(['volaCarta', 'volaCarta', 'beeeNo']);
    expect(b[2]).toEqual({ tipo: 'beeeNo', chi: 'g2', annullato: 'g1', carta: 'capriola#1', attesa: { tipo: 'fine' } });
  });

  it("annullata: cerca l'autore anche negli eventi della vista", () => {
    const conStoria: Vista = {
      ...vista,
      eventi: eventi({
        tipo: 'dichiarazione',
        voce: 7,
        autore: 'g3',
        dettagli: { tipo: 'belato', carta: 'beee-no#1', effetto: 'beee_no', voceBersaglio: 6 },
      }),
    };
    expect(copione(eventi({ tipo: 'annullata', voce: 6, da: 7 }), conStoria)).toEqual([
      { tipo: 'beeeNo', chi: 'g3', annullato: null, carta: null, attesa: { tipo: 'fine' } },
    ]);
  });

  it('annullata di un tiro di dado: nessuna carta annullata, ma chi ha tirato trasale', () => {
    const b = da(
      dich('g1', { tipo: 'dado', faccia: 'pascolo_piccolo', dichiarazione: { effetto: 'pascolo', quantita: 3 } }, 1),
      dich('g2', { tipo: 'belato', carta: 'beee-no#1', effetto: 'beee_no', voceBersaglio: 1 }, 2),
      { tipo: 'annullata', voce: 1, da: 2 },
    );
    expect(b[b.length - 1]).toEqual({ tipo: 'beeeNo', chi: 'g2', annullato: 'g1', carta: null, attesa: { tipo: 'fine' } });
  });

  it("annullata di cui non si trova l'autore: nessuna battuta", () => {
    expect(da({ tipo: 'annullata', voce: 6, da: 7 })).toEqual([]);
  });
});

describe('copione: dado, agnellini, Testata', () => {
  it('dado_lanciato: dado con la faccia', () => {
    expect(unica({ tipo: 'dado_lanciato', giocatore: 'g1', faccia: 'testata' })).toEqual({
      tipo: 'dado',
      faccia: 'testata',
      attesa: { tipo: 'fine' },
    });
  });

  const agn = (daL: string, a: string, quanti: number, causa: string): NuovoEvento => ({
    tipo: 'agnellini',
    da: daL,
    a,
    quanti,
    causa,
  });

  it('furto da due avversari più il gregge: una battuta con tre spostamenti e ladro', () => {
    const b = unica(agn('g1', 'g3', 2, 'furto'), agn('g2', 'g3', 1, 'furto'), agn('gregge', 'g3', 1, 'furto'));
    expect(b).toEqual({
      tipo: 'agnellini',
      spostamenti: [
        { da: 'g1', a: 'g3', quanti: 2 },
        { da: 'g2', a: 'g3', quanti: 1 },
        { da: 'gregge', a: 'g3', quanti: 1 },
      ],
      ladro: 'g3',
      modo: 'corre',
      attesa: { tipo: 'fine' },
    });
  });

  it('furti separati da altri eventi o con destinazioni diverse restano battute distinte', () => {
    expect(da(agn('g1', 'g3', 1, 'furto'), agn('g1', 'g2', 1, 'furto'))).toHaveLength(2);
    expect(da(agn('g1', 'g3', 1, 'furto'), { tipo: 'risolta', voce: 1 }, agn('g2', 'g3', 1, 'furto'))).toHaveLength(2);
  });

  it.each(['pascolo', 'consolazione', 'prendi_agnellino', 'sposta_agnellino', 'eliminazione'])(
    'agnellini per %s: ladro null, corre',
    (causa) => {
      expect(unica(agn('gregge', 'g1', 2, causa))).toEqual({
        tipo: 'agnellini',
        spostamenti: [{ da: 'gregge', a: 'g1', quanti: 2 }],
        ladro: null,
        modo: 'corre',
        attesa: { tipo: 'fine' },
      });
    },
  );

  it('Testata: [agnellini(testata), testata] dà una sola battuta testata', () => {
    expect(
      unica(agn('g2', 'gregge', 2, 'testata'), { tipo: 'testata', giocatore: 'g1', bersaglio: 'g2', esito: 2 }),
    ).toEqual({ tipo: 'testata', chi: 'g1', bersaglio: 'g2', quanti: 2, seq: 101, attesa: { tipo: 'fine' } });
  });

  it('Testata: la battuta porta il seq dell\'evento', () => {
    const lista: Evento[] = [{ seq: 4242, tipo: 'testata', giocatore: 'g3', bersaglio: 'g1', esito: 1 }];
    expect(copione(lista, vista)).toEqual([
      { tipo: 'testata', chi: 'g3', bersaglio: 'g1', quanti: 1, seq: 4242, attesa: { tipo: 'fine' } },
    ]);
  });

  it('Testata con esito 0 (nessun agnellino spostato): battuta testata con quanti 0', () => {
    expect(unica({ tipo: 'testata', giocatore: 'g1', bersaglio: 'g2', esito: 0 })).toMatchObject({
      tipo: 'testata',
      quanti: 0,
    });
  });

  it('agnellini per Testata senza il suo evento testata: volano, non corrono', () => {
    expect(unica(agn('g2', 'gregge', 2, 'testata'))).toMatchObject({ tipo: 'agnellini', modo: 'vola', ladro: null });
  });
});

describe('copione: Belato Finale', () => {
  it('belato_finale: giraCarte con le carte rivelate', () => {
    expect(unica({ tipo: 'belato_finale', rivelate: { g1: 'sasso-comodo#1', g2: 'carriola#1' } })).toEqual({
      tipo: 'giraCarte',
      carte: { g1: ['sasso-comodo#1'], g2: ['carriola#1'] },
      attesa: { tipo: 'fine' },
    });
  });
});

describe('copione: Guai presi, deviati, curati, eliminazione, fine', () => {
  it('Guaio meteo: guaio con attesa massimo 5000; il lupo vegetariano pure', () => {
    const carte = [
      'grandine-a-sorpresa#1',
      'pioggia-di-traverso#1',
      'vento-dispettoso#1',
      'nebbia-fitta#1',
      'fulmine-curioso#1',
      'gelata-di-agosto#1',
      'pozzanghera-senza-fondo#1',
      'lupo-vegetariano#1',
    ];
    for (const carta of carte) {
      expect(unica({ tipo: 'guaio_preso', giocatore: 'g2', carta })).toEqual({
        tipo: 'guaio',
        carta,
        chi: 'g2',
        deviatoDa: null,
        attesa: { tipo: 'massimo', ms: 5000 },
      });
    }
  });

  it('Guaio dei Drammi (e dei Predatori senza effetto): attesa fine', () => {
    expect(unica({ tipo: 'guaio_preso', giocatore: 'g1', carta: 'insonnia#1' })).toMatchObject({
      tipo: 'guaio',
      attesa: { tipo: 'fine' },
    });
    expect(unica({ tipo: 'guaio_preso', giocatore: 'g1', carta: 'volpe-gentile#1' })).toMatchObject({
      attesa: { tipo: 'fine' },
    });
  });

  it('guaio_deviato e guaio_preso in azioni diverse (motore vero): deviatoDa dallo storico della vista', () => {
    // g3 è il peggiore e devia il Guaio su g2 con la Finta svenuta; g2 lo prende solo dopo aver passato
    let s = scenario({ giocatori: 3, guaio: 'insonnia', mani: { g3: ['finta-svenuta'] } });
    s = { ...s, fase: { nome: 'guaio_al_peggiore', destinatario: 'g3', spareggio: null } };
    s.datiRound.partecipanti = ['g1', 'g2', 'g3'];
    s = prosegui(s);
    expect(s.fase.nome).toBe('belati_salvataggio');
    s = nessunaReazione(
      applica(s, { tipo: 'giocaBelato', giocatore: 'g3', carta: carta(s, 'g3', 'finta-svenuta'), bersaglio: 'g2' }),
    );
    const primaDelPasso = vistaPer(s, null);
    const lottoDeviazione = primaDelPasso.eventi.filter((e) => e.tipo !== 'guaio_rivelato');
    expect(lottoDeviazione.some((e) => e.tipo === 'guaio_deviato')).toBe(true);
    expect(lottoDeviazione.some((e) => e.tipo === 'guaio_preso')).toBe(false);
    // Primo lotto: la deviazione non dà una battuta propria
    expect(copione(lottoDeviazione, primaDelPasso).some((b) => b.tipo === 'guaio')).toBe(false);

    s = applica(s, { tipo: 'passa', giocatore: 'g2' });
    const dopo = vistaPer(s, null);
    const lottoPresa = dopo.eventi.filter((e) => e.seq > Math.max(...primaDelPasso.eventi.map((x) => x.seq)));
    expect(lottoPresa.map((e) => e.tipo)).toContain('guaio_preso');
    expect(lottoPresa.some((e) => e.tipo === 'guaio_deviato')).toBe(false);
    // Secondo lotto: guaio_preso con la vista che porta lo storico
    const guai = copione(lottoPresa, dopo).filter((b): b is Di<'guaio'> => b.tipo === 'guaio');
    expect(guai).toEqual([{ tipo: 'guaio', carta: expect.stringContaining('insonnia'), chi: 'g2', deviatoDa: 'g3', attesa: { tipo: 'fine' } }]);
  });

  it('deviatoDa non si trascina oltre un Guaio già preso', () => {
    const storia = eventi(
      { tipo: 'guaio_deviato', da: 'g1', a: 'g2' },
      { tipo: 'guaio_preso', giocatore: 'g2', carta: 'insonnia#1' },
    );
    const conStoria: Vista = { ...vista, eventi: storia };
    const dopo: Evento[] = [{ seq: 500, tipo: 'guaio_preso', giocatore: 'g2', carta: 'insonnia#2' }];
    expect((copione(dopo, conStoria)[0] as Di<'guaio'>).deviatoDa).toBeNull();
  });

  it('guaio_deviato non seguito da guaio_preso: nessuna battuta', () => {
    expect(da({ tipo: 'guaio_deviato', da: 'g1', a: 'g2' })).toEqual([]);
  });

  it('guaio_deviato verso un altro giocatore di quello che prende il Guaio: deviatoDa resta null', () => {
    const b = da(
      { tipo: 'guaio_deviato', da: 'g1', a: 'g2' },
      { tipo: 'guaio_preso', giocatore: 'g3', carta: 'insonnia#1' },
    );
    expect(b).toHaveLength(1);
    expect((b[0] as Di<'guaio'>).deviatoDa).toBeNull();
  });

  it('guaio_preso seguito dalla consolazione: guaio, poi agnellini', () => {
    const b = da(
      { tipo: 'guaio_preso', giocatore: 'g1', carta: 'insonnia#1' },
      { tipo: 'agnellini', da: 'gregge', a: 'g1', quanti: 1, causa: 'consolazione' },
    );
    expect(b.map((x) => x.tipo)).toEqual(['guaio', 'agnellini']);
    expect(b[1]!.attesa).toEqual({ tipo: 'fine' });
  });

  it('consolazione dopo un Guaio col meteo: l\'agnellino arriva senza far aspettare (la partita riparte a 5 s)', () => {
    const b = da(
      { tipo: 'guaio_preso', giocatore: 'g2', carta: 'grandine-a-sorpresa#1' },
      { tipo: 'agnellini', da: 'gregge', a: 'g2', quanti: 1, causa: 'consolazione' },
    );
    expect(b.map((x) => x.tipo)).toEqual(['guaio', 'agnellini']);
    expect(b[0]!.attesa).toEqual({ tipo: 'massimo', ms: 5000 });
    expect(b[1]).toMatchObject({ spostamenti: [{ da: 'gregge', a: 'g2', quanti: 1 }], attesa: { tipo: 'niente' } });
  });

  it('guaio_curato: fumetti "Che sollievo!" sul curato', () => {
    expect(unica({ tipo: 'guaio_curato', giocatore: 'g2', carta: 'insonnia#1' })).toEqual({
      tipo: 'fumetti',
      testi: { g2: 'Che sollievo!' },
      attesa: { tipo: 'massimo', ms: 1200 },
    });
    expect(T.scena.fumetti.curato).toBe('Che sollievo!');
  });

  it('eliminato: eliminata, poi il suo agnellini', () => {
    const b = da(
      { tipo: 'eliminato', giocatore: 'g3' },
      { tipo: 'scartate', giocatore: 'g3', carte: ['sasso-comodo#1'], causa: 'eliminazione' },
      { tipo: 'agnellini', da: 'g3', a: 'gregge', quanti: 3, causa: 'eliminazione' },
    );
    expect(b).toEqual([
      { tipo: 'eliminata', chi: 'g3', attesa: { tipo: 'fine' } },
      {
        tipo: 'agnellini',
        spostamenti: [{ da: 'g3', a: 'gregge', quanti: 3 }],
        ladro: null,
        modo: 'corre',
        attesa: { tipo: 'fine' },
      },
    ]);
  });

  it('fine_partita: festa con i vincitori', () => {
    expect(unica({ tipo: 'fine_partita', esito: { modo: 'ovile_pieno', vincitori: ['g1', 'g2'] } })).toEqual({
      tipo: 'festa',
      vincitori: ['g1', 'g2'],
      attesa: { tipo: 'fine' },
    });
  });
});

describe('copione: eventi da mettere solo in pari e riservatezza', () => {
  it('scartate, pescate, ripescata, guaio_in_fondo, guai_rimescolati, fuori_dal_round, ha_scelto, effetto, risolta: []', () => {
    expect(
      da(
        { tipo: 'scartate', giocatore: 'g1', carte: ['sasso-comodo#1'], causa: 'consolazione' },
        { tipo: 'pescate', giocatore: 'g1', quante: 2 },
        { tipo: 'ripescata', giocatore: 'g1', scartate: 2, pescate: 2 },
        { tipo: 'guaio_in_fondo', carta: 'insonnia#1' },
        { tipo: 'guai_rimescolati', quanti: 4 },
        { tipo: 'fuori_dal_round', giocatore: 'g2' },
        { tipo: 'ha_scelto', giocatore: 'g3' },
        { tipo: 'effetto', giocatore: 'g1', carta: 'capriola#1', esito: 'attivato' },
        { tipo: 'risolta', voce: 1 },
      ),
    ).toEqual([]);
  });

  it('nessun evento: nessuna battuta', () => {
    expect(copione([], vista)).toEqual([]);
  });

  it("le carte pescate (anche se l'evento le porta) non compaiono in nessuna battuta", () => {
    const b = da(
      { tipo: 'pescate', giocatore: 'g1', quante: 2, carte: ['cannocchiale#1', 'orecchino-gemello#2'] },
      { tipo: 'scartate', giocatore: 'g1', carte: ['cannocchiale#1'], causa: 'guarda_due' },
      { tipo: 'agnellini', da: 'gregge', a: 'g1', quanti: 1, causa: 'pascolo' },
    );
    const testo = JSON.stringify(b);
    expect(testo).not.toContain('cannocchiale');
    expect(testo).not.toContain('orecchino');
  });

  it('furto: il fumetto dice quanti agnellini si spostano davvero (posti pieni), non quanti ne dichiara il dado', () => {
    const dichiarato = (voce: number, autore: string): NuovoEvento => ({
      tipo: 'dichiarazione',
      voce,
      autore,
      dettagli: {
        tipo: 'dado',
        faccia: 'furto_grande',
        dichiarazione: { effetto: 'furto', daAvversari: { g1: 2, g3: 1 }, dalGregge: 1 },
      },
    });
    const b = da(
      dichiarato(1, 'g2'),
      { tipo: 'risolta', voce: 1 },
      { tipo: 'agnellini', da: 'g1', a: 'g2', quanti: 1, causa: 'furto' },
      { tipo: 'agnellini', da: 'g3', a: 'g2', quanti: 1, causa: 'furto' },
    );
    expect((b[0] as Di<'fumetti'>).testi).toEqual({ g2: T.scena.fumetti.furto(2) });
    // Due furti nello stesso lotto: ognuno conta i suoi spostamenti
    const due = da(
      dichiarato(1, 'g2'),
      { tipo: 'risolta', voce: 1 },
      { tipo: 'agnellini', da: 'g1', a: 'g2', quanti: 2, causa: 'furto' },
      dichiarato(2, 'g3'),
      { tipo: 'risolta', voce: 2 },
      { tipo: 'agnellini', da: 'g1', a: 'g3', quanti: 1, causa: 'furto' },
    );
    const fumetti = due.filter((x): x is Di<'fumetti'> => x.tipo === 'fumetti');
    expect(fumetti.map((x) => x.testi)).toEqual([{ g2: T.scena.fumetti.furto(2) }, { g3: T.scena.fumetti.furto(1) }]);
  });

  describe('furto in due lotti: il secondo fumetto quando se ne spostano meno', () => {
    // La dichiarazione è arrivata in un lotto precedente: sta nello storico della vista
    const dichiarazione: Evento = {
      seq: 50,
      tipo: 'dichiarazione',
      voce: 1,
      autore: 'g2',
      dettagli: {
        tipo: 'dado',
        faccia: 'furto_grande',
        dichiarazione: { effetto: 'furto', daAvversari: { g1: 2, g3: 1 }, dalGregge: 1 },
      },
    };
    const conStoria: Vista = { ...vista, eventi: [...vista.eventi, dichiarazione] };
    const dopo = (...nuovi: NuovoEvento[]): Battuta[] => copione(eventi(...nuovi), conStoria);

    it('ne arrivano meno dei 4 dichiarati: dopo la corsa, un fumetto sopra il ladro col numero vero', () => {
      const b = dopo(
        { tipo: 'risolta', voce: 1 },
        { tipo: 'agnellini', da: 'g1', a: 'g2', quanti: 1, causa: 'furto' },
        { tipo: 'agnellini', da: 'g3', a: 'g2', quanti: 1, causa: 'furto' },
      );
      expect(b.map((x) => x.tipo)).toEqual(['agnellini', 'fumetti']);
      expect(b[1]).toEqual({ tipo: 'fumetti', testi: { g2: T.scena.fumetti.furtoSolo(2) }, attesa: { tipo: 'massimo', ms: 1200 } });
      expect(T.scena.fumetti.furtoSolo(2)).toBe('Solo 2 agnellini!');
      expect(T.scena.fumetti.furtoSolo(1)).toBe('Solo 1 agnellino!');
    });

    it('ne arrivano quanti dichiarati: nessun fumetto in più', () => {
      const b = dopo(
        { tipo: 'risolta', voce: 1 },
        { tipo: 'agnellini', da: 'g1', a: 'g2', quanti: 2, causa: 'furto' },
        { tipo: 'agnellini', da: 'g3', a: 'g2', quanti: 1, causa: 'furto' },
        { tipo: 'agnellini', da: 'gregge', a: 'g2', quanti: 1, causa: 'furto' },
      );
      expect(b.map((x) => x.tipo)).toEqual(['agnellini']);
    });

    it('furto annullato dal Beee-NO!: nessun "Solo 0"', () => {
      const beeeNo: Evento = {
        seq: 60,
        tipo: 'dichiarazione',
        voce: 2,
        autore: 'g1',
        dettagli: { tipo: 'belato', carta: 'beee-no#1', effetto: 'beee_no', voceBersaglio: 1 } as DettagliVoce,
      };
      const b = copione(eventi({ tipo: 'annullata', voce: 1, da: 2 }, { tipo: 'risolta', voce: 2 }), {
        ...conStoria,
        eventi: [...conStoria.eventi, beeeNo],
      });
      expect(b.map((x) => x.tipo)).toEqual(['beeeNo']);
    });

    it('dichiarazione e spostamenti nello stesso lotto: il primo fumetto dice già il numero vero, niente secondo', () => {
      const b = dopo(
        { ...dichiarazione, seq: undefined } as unknown as NuovoEvento,
        { tipo: 'risolta', voce: 1 },
        { tipo: 'agnellini', da: 'g1', a: 'g2', quanti: 1, causa: 'furto' },
      );
      expect(b.map((x) => x.tipo)).toEqual(['fumetti', 'agnellini']);
      expect((b[0] as Di<'fumetti'>).testi).toEqual({ g2: T.scena.fumetti.furto(1) });
    });
  });

  it('ordine degli eventi rispettato in una serie mista', () => {
    const b = da(
      { tipo: 'dado_lanciato', giocatore: 'g1', faccia: 'furto_piccolo' },
      {
        tipo: 'dichiarazione',
        voce: 1,
        autore: 'g1',
        dettagli: {
          tipo: 'dado',
          faccia: 'furto_piccolo',
          dichiarazione: { effetto: 'furto', daAvversari: { g2: 2 }, dalGregge: 0 },
        },
      },
      { tipo: 'risolta', voce: 1 },
      { tipo: 'agnellini', da: 'g2', a: 'g1', quanti: 2, causa: 'furto' },
    );
    expect(b.map((x) => x.tipo)).toEqual(['dado', 'fumetti', 'agnellini']);
  });
});

describe('copione: partite vere', () => {
  it('su partite giocate a caso: mai errori, ogni battuta ha dati sensati, nessuna carta delle mani', () => {
    const visti = new Set<string>();
    let visteCarte = 0;
    for (const seme of [1, 2, 3, 4, 5, 6]) {
      let stato = nuovaPartita({
        giocatori: [
          { id: 'g1', nome: 'Anna', pecora: 'ricciolo' },
          { id: 'g2', nome: 'Bruno', pecora: 'brontolana' },
          { id: 'g3', nome: 'Carla', pecora: 'sospirella' },
        ],
        seme,
      });
      let x = seme * 7919;
      const caso = (n: number) => ((x = (x * 1103515245 + 12345) >>> 0) >>> 8) % n;
      let ultimo = 0;
      for (let passo = 0; passo < 3000 && stato.esito == null; passo++) {
        const attesa = inAttesaDi(stato);
        const chi = attesa.sistema ? 'sistema' : attesa.giocatori[caso(attesa.giocatori.length)]!;
        const azioni = azioniPossibili(stato, chi);
        if (azioni.length === 0) break;
        const prima = stato;
        const ultimoPrima = ultimo;
        stato = applica(stato, azioni[caso(azioni.length)]!);
        const v = vistaPer(stato, null);
        const nuovi = v.eventi.filter((e) => e.seq > ultimo);
        ultimo = Math.max(ultimo, ...nuovi.map((e) => e.seq));
        const battute = copione(nuovi, v);
        for (const b of battute) {
          visti.add(b.tipo);
          if (b.attesa.tipo === 'massimo') expect(b.attesa.ms).toBeGreaterThan(0);
          if (b.tipo === 'agnellini') expect(b.spostamenti.length).toBeGreaterThan(0);
        }
        // Riservatezza: le carte che erano in mano (o sono state pescate in questa mossa) compaiono
        // solo se sono state giocate in pubblico nella stessa mossa
        const riservate = new Set<string>([...prima.giocatori.flatMap((g) => g.mano)]);
        for (const e of stato.eventi) if (e.seq > ultimoPrima && e.tipo === 'pescate') for (const c of e.carte ?? []) riservate.add(c);
        const pubbliche = new Set<string>();
        for (const e of nuovi) {
          if (e.tipo === 'rivelazione') Object.values(e.giocate).flat().forEach((c) => pubbliche.add(c));
          if (e.tipo === 'belato_finale') Object.values(e.rivelate).forEach((c) => pubbliche.add(c));
          if (e.tipo === 'dichiarazione' && e.dettagli.tipo !== 'dado') pubbliche.add(e.dettagli.carta);
        }
        for (const c of JSON.stringify(battute).match(/[a-z-]+#\d+/g) ?? []) {
          visteCarte++;
          if (riservate.has(c)) expect(pubbliche.has(c), `${c} non doveva comparire`).toBe(true);
        }
      }
    }
    expect(visteCarte).toBeGreaterThan(0);
    for (const tipo of ['guaioRivelato', 'giraCarte', 'fumetti', 'dado', 'agnellini', 'guaio']) expect(visti.has(tipo)).toBe(true);
  }, 30_000);
});
