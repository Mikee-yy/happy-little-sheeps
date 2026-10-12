// Verifiche essenziali degli aiuti di test e un round completo giocato a mano.
import { describe, expect, it } from 'vitest';
import type { Evento, Stato } from '../src';
import {
  applica,
  azioniPossibili,
  configPer,
  creaMazzoGuai,
  creaMazzoPrincipale,
  ErroreRegola,
  inAttesaDi,
  nuovaPartita,
  vistaPer,
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
  totale,
} from './aiuti';

function nuoviEventi(prima: Stato, dopo: Stato): Evento[] {
  return dopo.eventi.filter((e) => e.seq >= prima.prossimoEvento);
}

describe('scenario()', () => {
  it('con le opzioni predefinite costruisce uno stato coerente in fase guaio', () => {
    const s = scenario();
    expect(s.config).toEqual(configPer(3));
    expect(s.rng).toBe(1);
    expect(s.giocatori.map((g) => [g.id, g.pecora, g.agnellini, g.mano.length, g.eliminato])).toEqual([
      ['g1', 'ricciolo', 3, 0, false],
      ['g2', 'brontolana', 3, 0, false],
      ['g3', 'sospirella', 3, 0, false],
    ]);
    expect(s.gregge).toBe(configPer(3).agnelliniTotali - 3 * 3);
    expect(s.mazzo).toEqual(creaMazzoPrincipale(3));
    expect(s.datiRound.guaio).toBe('grandine-a-sorpresa#1');
    expect(s.mazzoGuai).toEqual(creaMazzoGuai().slice(1));
    expect(s.fase).toEqual({ nome: 'guaio' });
    expect(s.round).toBe(1);
    expect(s.datiRound.numero).toBe(1);
    expect(s.primoGiocatore).toBe('g1');
    expect(s.ultimoRound).toBeNull();
    expect(s.pila).toEqual([]);
    expect(s.finestra).toBeNull();
    expect(s.richiesta).toBeNull();
    expect(s.esito).toBeNull();
    expect(s.eventi).toEqual([]);
    expect(inAttesaDi(s)).toEqual({ sistema: true, giocatori: [] });
  });

  it('risolve i tipi nelle istanze successive libere, riservando prima quelle esplicite', () => {
    const s = scenario({
      mani: { g1: ['carriola', 'carriola'], g2: ['carriola#1', 'beee-no'] },
      scarti: ['carriola', 'carriola', 'carriola'],
    });
    expect(s.giocatori[0]!.mano).toEqual(['carriola#2', 'carriola#3']);
    expect(s.giocatori[1]!.mano).toEqual(['carriola#1', 'beee-no#1']);
    expect(s.scarti).toEqual(['carriola#4', 'carriola#5', 'carriola#6']);
    expect(s.mazzo).not.toContain('carriola#1');
    expect(s.mazzo).not.toContain('beee-no#1');
    expect(s.mazzo).toContain('beee-no#2');
    expect(s.mazzo.length).toBe(62 - 4 - 1);
  });

  it('accetta mazzi, Guai, Angoli ed eliminati espliciti', () => {
    const s = scenario({
      giocatori: [{ id: 'a', pecora: 'nerina' }, { id: 'b' }],
      mazzo: ['carriola', 'beee-no'],
      mazzoGuai: ['insonnia', 'nebbia-fitta'],
      guaio: 'lupo-vegetariano',
      angoli: { a: ['spuntatina'] },
      guaiFuoriGioco: ['volpe-gentile'],
      agnellini: { a: 7 },
      round: 4,
      ultimoRound: 5,
      primoGiocatore: 'b',
    });
    expect(s.config).toEqual(configPer(2));
    expect(s.giocatori.map((g) => [g.id, g.pecora, g.agnellini])).toEqual([
      ['a', 'nerina', 7],
      ['b', 'brontolana', 3],
    ]);
    expect(s.gregge).toBe(configPer(2).agnelliniTotali - (7 + 3));
    expect(s.mazzo).toEqual(['carriola#1', 'beee-no#1']);
    expect(s.mazzoGuai).toEqual(['insonnia#1', 'nebbia-fitta#1']);
    expect(s.datiRound.guaio).toBe('lupo-vegetariano#1');
    expect(s.giocatori[0]!.angolo).toEqual(['spuntatina#1']);
    expect(s.guaiFuoriGioco).toEqual(['volpe-gentile#1']);
    expect([s.round, s.datiRound.numero, s.ultimoRound, s.primoGiocatore]).toEqual([4, 4, 5, 'b']);

    const senzaGuaio = scenario({ guaio: null, eliminati: ['g3'] });
    expect(senzaGuaio.datiRound.guaio).toBeNull();
    expect(senzaGuaio.mazzoGuai).toEqual(creaMazzoGuai());
    expect(senzaGuaio.giocatori[2]!.eliminato).toBe(true);
  });

  it('a 2 giocatori il mazzo predefinito è quello ridotto', () => {
    const s = scenario({ giocatori: 2 });
    expect(s.mazzo).toEqual(creaMazzoPrincipale(2));
    expect(s.mazzo.length).toBe(50);
  });
});

describe('aiuti', () => {
  it('carta, scegli, prosegui, avanza e totale', () => {
    let s = scenario({
      mani: { g1: ['calzino-gemello', 'calzino-gemello', 'carriola'], g2: ['sasso-comodo'], g3: ['balla-di-fieno'] },
    });
    expect(carta(s, 'g1', 'carriola')).toBe('carriola#1');
    expect(carta(s, 'g1', 'calzino-gemello')).toBe('calzino-gemello#1');
    expect(() => carta(s, 'g2', 'carriola')).toThrow();
    s = prosegui(s);
    expect(s.fase.nome).toBe('scelta');
    s = scegli(s, { g1: ['calzino-gemello', 'calzino-gemello'], g2: ['sasso-comodo'], g3: ['balla-di-fieno'] });
    expect(s.fase.nome).toBe('rivelazione');
    expect(s.datiRound.giocate.g1).toEqual(['calzino-gemello#1', 'calzino-gemello#2']);
    // Guaio meteo: Ricciolo +1, Brontolana nulla, Sospirella −1.
    expect([totale(s, 'g1'), totale(s, 'g2'), totale(s, 'g3')]).toEqual([7, 2, 4]);
    s = avanza(s);
    expect(s.fase.nome).toBe('belati_punteggio');
    s = chiudiPunteggio(s);
    expect(s.fase).toEqual({ nome: 'dado', indice: 0 });
    expect(s.datiRound.lanciatori).toEqual(['g1']);
    expect(s.datiRound.piuBassi).toEqual(['g2']);
  });

  it('rinunciaTutti esce dalla fase effetti', () => {
    let s = scenario({ mani: { g1: ['capriola'], g2: ['agnellino-smarrito'], g3: ['campanaccio-stonato'] } });
    s = scegli(prosegui(s), { g1: ['capriola'], g2: ['agnellino-smarrito'], g3: ['campanaccio-stonato'] });
    s = prosegui(s);
    expect(s.fase.nome).toBe('effetti');
    s = rinunciaTutti(s);
    expect(s.fase.nome).toBe('belati_punteggio');
  });

  it('conFaccia fa uscire la faccia richiesta e nessunaReazione chiude le finestre', () => {
    for (const faccia of configPer(3).dado) {
      let s = scenario({ mani: { g1: ['carriola'], g2: ['sasso-comodo'], g3: ['balla-di-fieno'] } });
      s = scegli(prosegui(s), { g1: ['carriola'], g2: ['sasso-comodo'], g3: ['balla-di-fieno'] });
      s = chiudiPunteggio(avanza(s));
      s = applica(conFaccia(s, faccia.id), { tipo: 'lanciaDado', giocatore: 'g1' });
      expect(s.eventi.at(-1)?.tipo === 'dado_lanciato' || s.pila.length > 0 || s.fase.nome === 'risoluzione_dado').toBe(true);
      expect(s.eventi.find((e) => e.tipo === 'dado_lanciato')).toMatchObject({ faccia: faccia.id });
      s = nessunaReazione(s);
      expect(s.finestra).toBeNull();
    }
    expect(() => conFaccia(scenario(), 'faccia-inesistente')).toThrow();
  });
});

describe('un round completo giocato a mano', () => {
  it('dalla scelta alla fine del round, con effetti, Beee-NO!, Belati, dado e consolazione', () => {
    let s = scenario({
      mani: {
        g1: ['carriola', 'beee-no', 'pernacchia'],
        g2: ['agnellino-smarrito', 'balla-di-fieno'],
        g3: ['campanaccio-stonato', 'belato-di-gruppo', 'faccio-finta-di-niente'],
      },
      guaio: 'grandine-a-sorpresa',
    });
    const iniziale = structuredClone(s);
    const totali = configPer(3).agnelliniTotali;

    // Guaio → scelta: tutti hanno una Trovata, nessuna ripescata.
    s = prosegui(s);
    expect(s.fase.nome).toBe('scelta');
    expect(s.datiRound.partecipanti).toEqual(['g1', 'g2', 'g3']);
    expect(inAttesaDi(s).giocatori).toEqual(['g1', 'g2', 'g3']);

    // Scelta segreta, con un cambio d'idea.
    s = applica(s, { tipo: 'scegliTrovata', giocatore: 'g2', carte: ['balla-di-fieno#1'] });
    const vistaG3 = vistaPer(s, 'g3');
    expect(vistaG3.fase).toEqual({ nome: 'scelta', haScelto: { g1: false, g2: true, g3: false }, miaScelta: null });
    expect(vistaG3.giocatori[1]!.mano).toBeNull();
    s = applica(s, { tipo: 'scegliTrovata', giocatore: 'g2', carte: ['agnellino-smarrito#1'] });
    s = scegli(s, { g1: ['carriola'], g3: ['campanaccio-stonato'] });

    // Rivelazione: valore e tratto (Grandine = meteo).
    expect(s.fase.nome).toBe('rivelazione');
    expect(s.datiRound.tavolo).toEqual(['carriola#1', 'agnellino-smarrito#1', 'campanaccio-stonato#1']);
    expect(s.datiRound.punteggi.g1).toEqual([
      { tipo: 'valore', delta: 8, carta: 'carriola#1', autore: 'g1' },
      { tipo: 'tratto', delta: 1, autore: 'g1' },
    ]);
    expect(s.datiRound.punteggi.g3!.map((r) => r.delta)).toEqual([4, -1]);

    // Effetti: prima Agnellino smarrito (valore 1), poi Campanaccio (valore 4).
    s = prosegui(s);
    expect(s.fase.nome).toBe('effetti');
    if (s.fase.nome !== 'effetti') throw new Error();
    expect(s.fase.coda.map((v) => v.carta)).toEqual(['agnellino-smarrito#1', 'campanaccio-stonato#1']);
    expect(azioniPossibili(s, 'g2')).toEqual([
      { tipo: 'rinunciaEffetto', giocatore: 'g2', carta: 'agnellino-smarrito#1' },
      { tipo: 'attivaEffetto', giocatore: 'g2', carta: 'agnellino-smarrito#1' },
    ]);
    s = applica(s, { tipo: 'attivaEffetto', giocatore: 'g2', carta: 'agnellino-smarrito#1' });
    expect(s.pila).toHaveLength(1);
    expect(s.finestra).toEqual({ voce: s.pila[0]!.id, inAttesa: ['g1', 'g3'] });
    expect(() => applica(s, { tipo: 'prosegui' })).toThrow(ErroreRegola);

    // g1 risponde con Beee-NO!: nuova finestra per gli altri due, poi l'effetto è annullato.
    s = applica(s, { tipo: 'giocaBelato', giocatore: 'g1', carta: 'beee-no#1', voce: s.pila[0]!.id });
    expect(s.finestra?.inAttesa).toEqual(['g2', 'g3']);
    expect(s.datiRound.tavolo).toContain('beee-no#1');
    s = nessunaReazione(s);
    expect(s.pila).toEqual([]);
    expect(s.giocatori[1]!.agnellini).toBe(3);
    if (s.fase.nome !== 'effetti') throw new Error();
    expect(s.fase.coda[0]!.esito).toBe('annullato');

    // Campanaccio stonato su g1: un suo agnellino torna nel Gregge.
    expect(() => applica(s, { tipo: 'attivaEffetto', giocatore: 'g3', carta: 'campanaccio-stonato#1' })).toThrow(ErroreRegola);
    s = applica(s, { tipo: 'attivaEffetto', giocatore: 'g3', carta: 'campanaccio-stonato#1', bersaglio: 'g1' });
    s = nessunaReazione(s);
    expect(s.giocatori[0]!.agnellini).toBe(2);
    expect(s.gregge).toBe(totali - 9 + 1);

    // Belati di punteggio: +2 a g3, −2 a g2; poi passano tutti.
    expect(s.fase).toEqual({ nome: 'belati_punteggio', inAttesa: ['g1', 'g2', 'g3'] });
    s = applica(s, { tipo: 'passa', giocatore: 'g1' });
    s = applica(s, { tipo: 'giocaBelato', giocatore: 'g3', carta: 'belato-di-gruppo#1', bersaglio: 'g3' });
    s = nessunaReazione(s);
    expect(s.fase).toEqual({ nome: 'belati_punteggio', inAttesa: ['g1', 'g2', 'g3'] });
    s = applica(s, { tipo: 'giocaBelato', giocatore: 'g1', carta: 'pernacchia#1', bersaglio: 'g2' });
    s = nessunaReazione(s);
    for (const g of ['g1', 'g2', 'g3']) s = applica(s, { tipo: 'passa', giocatore: g });
    expect([totale(s, 'g1'), totale(s, 'g2'), totale(s, 'g3')]).toEqual([9, -1, 5]);
    expect(s.datiRound.piuAlti).toEqual(['g1']);
    expect(s.datiRound.piuBassi).toEqual(['g2']);
    expect(s.fase).toEqual({ nome: 'dado', indice: 0 });

    // Dado: Pascolo piccolo, 3 agnellini dal Gregge dopo la finestra.
    s = conFaccia(s, 'pascolo_piccolo');
    expect(azioniPossibili(s, 'g1')).toEqual([{ tipo: 'lanciaDado', giocatore: 'g1' }]);
    s = applica(s, { tipo: 'lanciaDado', giocatore: 'g1' });
    expect(s.pila[0]!.dettagli).toEqual({
      tipo: 'dado',
      faccia: 'pascolo_piccolo',
      dichiarazione: { effetto: 'pascolo', quantita: 3 },
    });
    s = nessunaReazione(s);
    expect(s.giocatori[0]!.agnellini).toBe(5);
    expect(s.gregge).toBe(totali - 9 + 1 - 3);

    // Guaio al peggiore: g2 non si salva, lo prende e riceve la consolazione.
    expect(s.fase).toEqual({ nome: 'guaio_al_peggiore', destinatario: 'g2', spareggio: null });
    s = prosegui(s);
    expect(s.fase).toEqual({ nome: 'belati_salvataggio', destinatario: 'g2' });
    s = applica(s, { tipo: 'passa', giocatore: 'g2' });
    expect(s.fase).toEqual({ nome: 'consolazione', destinatario: 'g2' });
    expect(s.giocatori[1]!.angolo).toEqual(['grandine-a-sorpresa#1']);
    expect(s.giocatori[1]!.agnellini).toBe(4);
    expect(s.datiRound.presoDa).toBe('g2');
    const primaDellaFine = s;
    s = applica(s, { tipo: 'concludiConsolazione', giocatore: 'g2', scarta: 'balla-di-fieno#1' });

    // Fine round: tavolo negli scarti, tutti ripescano fino a 5 partendo dal primo giocatore.
    expect(s.fase).toEqual({ nome: 'fine_round' });
    expect(s.datiRound.tavolo).toEqual([]);
    expect(s.scarti).toEqual([
      'balla-di-fieno#1',
      'carriola#1',
      'agnellino-smarrito#1',
      'campanaccio-stonato#1',
      'beee-no#1',
      'belato-di-gruppo#1',
      'pernacchia#1',
    ]);
    expect(s.giocatori.map((g) => g.mano.length)).toEqual([5, 5, 5]);
    expect(s.giocatori[2]!.mano[0]).toBe('faccio-finta-di-niente#1');
    const pescate = nuoviEventi(primaDellaFine, s).filter((e) => e.tipo === 'pescate');
    expect(pescate.map((e) => e.tipo === 'pescate' && [e.giocatore, e.quante])).toEqual([
      ['g1', 5],
      ['g2', 5],
      ['g3', 4],
    ]);
    expect(s.giocatori.reduce((somma, g) => somma + g.agnellini, s.gregge)).toBe(totali);

    // Round successivo: il primo giocatore ruota e si scopre un nuovo Guaio.
    s = prosegui(s);
    expect(s.round).toBe(2);
    expect(s.primoGiocatore).toBe('g2');
    expect(s.fase).toEqual({ nome: 'guaio' });
    expect(s.datiRound.guaio).toBe('fulmine-curioso#1');
    expect(s.datiRound.partecipanti).toEqual([]);

    // Gli eventi sono progressivi e lo scenario di partenza non è stato toccato.
    expect(s.eventi.map((e) => e.seq)).toEqual(s.eventi.map((_, i) => i + 1));
    expect(iniziale).toEqual(scenario({
      mani: {
        g1: ['carriola', 'beee-no', 'pernacchia'],
        g2: ['agnellino-smarrito', 'balla-di-fieno'],
        g3: ['campanaccio-stonato', 'belato-di-gruppo', 'faccio-finta-di-niente'],
      },
      guaio: 'grandine-a-sorpresa',
    }));
  });
});

describe('nuovaPartita', () => {
  it('prepara la partita e scopre il primo Guaio', () => {
    const s = nuovaPartita({
      giocatori: [
        { id: 'a', nome: 'Anna', pecora: 'ricciolo' },
        { id: 'b', nome: 'Bruno', pecora: 'nerina' },
        { id: 'c', nome: 'Carla', pecora: 'sospirella' },
      ],
      seme: 42,
    });
    expect(s.giocatori.every((g) => g.mano.length === 5 && g.agnellini === 3)).toBe(true);
    expect(s.gregge).toBe(configPer(3).agnelliniTotali - 3 * 3);
    expect(s.mazzo).toHaveLength(62 - 15);
    expect(s.mazzoGuai).toHaveLength(23);
    expect(s.datiRound.guaio).not.toBeNull();
    expect(s.fase).toEqual({ nome: 'guaio' });
    expect(s.eventi.map((e) => e.tipo)).toEqual(['round_iniziato', 'guaio_rivelato']);
    expect(nuovaPartita({ giocatori: s.giocatori.map(({ id, nome, pecora }) => ({ id, nome, pecora })), seme: 42 })).toEqual(s);
    expect(() =>
      nuovaPartita({ giocatori: [{ id: 'a', nome: 'A', pecora: 'ricciolo' }, { id: 'b', nome: 'B', pecora: 'ricciolo' }], seme: 1 }),
    ).toThrow(ErroreRegola);
  });
});
