// Partita di prova: quale schermata vede l'umano e quale consiglio compare, momento per momento.
import { describe, expect, it } from 'vitest';
import { applica, azioniPossibili, nuovaPartita, PROVA, vistaPer } from '../../../engine/src';
import type { Stato, Vista } from '../../../engine/src';
import { avanza, carta, chiudiPunteggio, conFaccia, prosegui, scegli, scenario } from '../../../engine/test/aiuti';
import { prossimoConsiglio, provaGuidataFinita } from './guida';
import type { IdConsiglio } from './guida';
import { scenaProva } from './regiaProva';

const TUTTI: IdConsiglio[] = ['inizio', 'guaio', 'tratto', 'scelta', 'gemelle', 'rivelazione', 'belatoPunteggio', 'tuoDado', 'pascolo', 'furto', 'beeeNo', 'testata', 'guaioTuo', 'guaioBot', 'fineRound'];
const tranne = (...esclusi: IdConsiglio[]) => new Set(TUTTI.filter((c) => !esclusi.includes(c)));
const prova = (): Stato => nuovaPartita({ giocatori: PROVA.giocatori, seme: 7, preparazione: PROVA.preparazione });
const consiglio = (s: Stato, visti: ReadonlySet<IdConsiglio>, umano = 'g1') => prossimoConsiglio(vistaPer(s, umano), umano, azioniPossibili(s, umano), visti);

const giocatoriProva = PROVA.giocatori;
function alPunteggio(): Stato {
  const s = prosegui(
    scenario({
      giocatori: giocatoriProva,
      guaio: 'tosatura-a-sorpresa',
      primoGiocatore: 'g2',
      mani: { g1: ['carriola', 'beee-no'], g2: ['balla-di-fieno'], g3: ['sasso-comodo', 'belato-di-gruppo'] },
    }),
  );
  return avanza(scegli(s, { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['sasso-comodo'] }));
}

describe('guida della partita di prova', () => {
  it('all\'inizio il primo consiglio è inizio, poi guaio', () => {
    const s = prova();
    expect(consiglio(s, new Set())).toBe('inizio');
    expect(consiglio(s, new Set(['inizio']))).toBe('guaio');
  });

  it('tratto compare solo se il Guaio tocca la pecora', () => {
    expect(consiglio(prova(), new Set(['inizio', 'guaio']))).toBe('tratto'); // Lupo: Predatori, bonus di Nerina
    const drammi = scenario({ giocatori: giocatoriProva, guaio: 'crisi-esistenziale' });
    expect(consiglio(drammi, tranne('tratto'))).toBeNull();
  });

  it('due momenti insieme: esce il primo dell\'ordine, poi l\'altro', () => {
    const s = prosegui(prova());
    expect(consiglio(s, new Set(['inizio', 'guaio', 'tratto']))).toBe('scelta');
    expect(consiglio(s, new Set(['inizio', 'guaio', 'tratto', 'scelta']))).toBe('gemelle');
  });

  it('gemelle solo con due Gemelle in mano', () => {
    const s = prosegui(scenario({ giocatori: giocatoriProva, guaio: 'crisi-esistenziale', mani: { g1: ['carriola', 'calzino-gemello', 'sasso-comodo'] } }));
    expect(consiglio(s, tranne('gemelle'))).toBeNull();
  });

  it('un consiglio già visto non torna', () => {
    expect(consiglio(prosegui(prova()), new Set(TUTTI))).toBeNull();
  });

  it('beeeNo solo con un tiro di dado da annullare, non con altre carte in cima alla pila', () => {
    // Un Belato in cima: il Beee-NO! non va sprecato lì (nella prova Bea usa il Cannocchiale prima del Furto)
    const s = alPunteggio();
    const s2 = applica(s, { tipo: 'giocaBelato', giocatore: 'g3', carta: carta(s, 'g3', 'belato-di-gruppo'), bersaglio: 'g3' });
    expect(consiglio(s2, tranne('beeeNo'), 'g1')).toBeNull();
    // Il Furto di Bea in cima: è il momento giusto
    let d = prosegui(scenario({ giocatori: giocatoriProva, guaio: 'tosatura-a-sorpresa', primoGiocatore: 'g2', mani: { g1: ['sasso-comodo', 'beee-no'], g2: ['carriola'], g3: ['balla-di-fieno'] } }));
    d = chiudiPunteggio(avanza(scegli(d, { g1: ['sasso-comodo'], g2: ['carriola'], g3: ['balla-di-fieno'] })));
    d = applica(conFaccia(d, 'furto_piccolo'), { tipo: 'lanciaDado', giocatore: 'g2' });
    d = applica(d, azioniPossibili(d, 'g2').find((a) => a.tipo === 'dichiaraDado')!);
    expect(consiglio(d, tranne('beeeNo'), 'g1')).toBe('beeeNo');
    // Senza Beee-NO! in mano niente consiglio
    expect(consiglio(d, tranne('beeeNo'), 'g3')).toBeNull();
  });

  it('scenaProva: turno di un bot → attesaBot; domanda con l\'umano → suo pannello privato', () => {
    const s = prosegui(prova());
    expect(scenaProva(vistaPer(s, null), 'g1')).toEqual({ tipo: 'privata', giocatore: 'g1', pannello: 'scelta' });
    const dopo = applica(s, { tipo: 'scegliTrovata', giocatore: 'g1', carte: [carta(s, 'g1', 'carriola')] });
    expect(scenaProva(vistaPer(dopo, null), 'g1')).toEqual({ tipo: 'attesaBot', giocatore: 'g2' });
    const p = alPunteggio();
    expect(scenaProva(vistaPer(p, null), 'g1')).toEqual({ tipo: 'privata', giocatore: 'g1', pannello: 'punteggio' });
  });

  it('provaGuidataFinita: vero dal round 4, falso a partita finita', () => {
    const v = vistaPer(prova(), null);
    expect(provaGuidataFinita(v)).toBe(false);
    const quarto: Vista = { ...v, eventi: [...v.eventi, { seq: 999, tipo: 'round_iniziato', round: 4, ultimo: false }] };
    expect(provaGuidataFinita(quarto)).toBe(true);
    expect(provaGuidataFinita({ ...quarto, esito: { modo: 'ovile_pieno', vincitori: ['g2'] } as Vista['esito'] })).toBe(false);
  });
});
