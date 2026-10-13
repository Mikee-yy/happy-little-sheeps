// @vitest-environment jsdom
// Nelle domande a tutti (fuori dal proprio turno) la mano resta coperta: si vedono solo i Belati giocabili in quel momento,
// così chi tiene il dispositivo non può aprire le carte di un altro toccandone il nome.
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { applica, azioniPossibili, vistaPer } from '../../../engine/src';
import type { Stato } from '../../../engine/src';
import { avanza, carta, prosegui, scegli, scenario } from '../../../engine/test/aiuti';
import { PannelloPunteggio, PannelloReazione } from './pannelli';

afterEach(cleanup);

function alPunteggio(): Stato {
  const s = prosegui(
    scenario({
      guaio: 'tosatura-a-sorpresa',
      primoGiocatore: 'g2',
      mani: {
        g1: ['carriola', 'beee-no', 'sasso-comodo'],
        g2: ['balla-di-fieno', 'carriola'],
        g3: ['sasso-comodo', 'belato-di-gruppo', 'carriola'],
      },
    }),
  );
  return avanza(scegli(s, { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['sasso-comodo'] }));
}

const carteMostrate = () => [...document.querySelectorAll('[data-carta]')].map((e) => e.getAttribute('data-carta'));

describe('domande a tutti: la mano resta coperta', () => {
  it('Belati di punteggio: si vede solo il Belato giocabile, non le altre carte', () => {
    const s = alPunteggio();
    render(<PannelloPunteggio v={vistaPer(s, 'g3')} giocatore="g3" azioni={azioniPossibili(s, 'g3')} invia={() => {}} />);
    expect(carteMostrate()).toEqual([carta(s, 'g3', 'belato-di-gruppo')]);
  });

  it('Belati di punteggio: chi non ne ha non vede nessuna carta', () => {
    const s = alPunteggio();
    render(<PannelloPunteggio v={vistaPer(s, 'g2')} giocatore="g2" azioni={azioniPossibili(s, 'g2')} invia={() => {}} />);
    expect(carteMostrate()).toEqual([]);
  });

  it('Beee-NO!: chi ce l\'ha vede solo il Beee-NO!', () => {
    const s = alPunteggio();
    const s2 = applica(s, { tipo: 'giocaBelato', giocatore: 'g3', carta: carta(s, 'g3', 'belato-di-gruppo'), bersaglio: 'g3' });
    render(<PannelloReazione v={vistaPer(s2, 'g1')} giocatore="g1" azioni={azioniPossibili(s2, 'g1')} invia={() => {}} />);
    expect(carteMostrate()).toEqual([carta(s, 'g1', 'beee-no')]);
  });

  it('Beee-NO!: chi non ce l\'ha non vede nessuna carta', () => {
    const s = alPunteggio();
    const s2 = applica(s, { tipo: 'giocaBelato', giocatore: 'g3', carta: carta(s, 'g3', 'belato-di-gruppo'), bersaglio: 'g3' });
    render(<PannelloReazione v={vistaPer(s2, 'g2')} giocatore="g2" azioni={azioniPossibili(s2, 'g2')} invia={() => {}} />);
    expect(carteMostrate()).toEqual([]);
  });
});

describe('con un dispositivo a testa la mano resta visibile', () => {
  it('Belati di punteggio: tutta la mano, con i Belati giocabili toccabili', () => {
    const s = alPunteggio();
    render(<PannelloPunteggio v={vistaPer(s, 'g3')} giocatore="g3" azioni={azioniPossibili(s, 'g3')} invia={() => {}} manoIntera />);
    expect(carteMostrate().sort()).toEqual([carta(s, 'g3', 'belato-di-gruppo'), carta(s, 'g3', 'carriola')].sort());
    expect(document.querySelector(`[data-carta="${carta(s, 'g3', 'carriola')}"]`)?.classList.contains('spenta')).toBe(true);
  });

  it('Beee-NO!: tutta la mano', () => {
    const s = alPunteggio();
    const s2 = applica(s, { tipo: 'giocaBelato', giocatore: 'g3', carta: carta(s, 'g3', 'belato-di-gruppo'), bersaglio: 'g3' });
    render(<PannelloReazione v={vistaPer(s2, 'g2')} giocatore="g2" azioni={azioniPossibili(s2, 'g2')} invia={() => {}} manoIntera />);
    expect(carteMostrate()).toEqual([carta(s, 'g2', 'carriola')]);
  });
});
