// Regia della modalità "Passa il telefono": quale schermata, chi agisce, cosa è privato.
import { describe, expect, it } from 'vitest';
import { applica, vistaPer } from '../../../engine/src';
import type { Stato } from '../../../engine/src';
import { avanza, carta, chiudiPunteggio, conFaccia, prosegui, scegli, scenario } from '../../../engine/test/aiuti';
import { scena } from './regia';

const tavolo = (s: Stato) => vistaPer(s, null);

function alPunteggio(): Stato {
  const s = prosegui(
    scenario({
      guaio: 'tosatura-a-sorpresa',
      primoGiocatore: 'g2',
      mani: { g1: ['carriola', 'beee-no'], g2: ['balla-di-fieno'], g3: ['sasso-comodo', 'belato-di-gruppo'] },
    }),
  );
  return avanza(scegli(s, { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['sasso-comodo'] }));
}

describe('regia', () => {
  it('le fasi automatiche sono schermate pubbliche con Continua', () => {
    expect(scena(tavolo(scenario()), null)).toEqual({ tipo: 'automatica', fase: 'guaio' });
  });

  it('la scelta segreta è privata e parte dal primo giocatore del round', () => {
    const s = prosegui(scenario({ primoGiocatore: 'g2', mani: { g1: ['carriola'], g2: ['carriola'], g3: ['carriola'] } }));
    expect(scena(tavolo(s), null)).toEqual({ tipo: 'privata', giocatore: 'g2', pannello: 'scelta' });
    const s2 = applica(s, { tipo: 'scegliTrovata', giocatore: 'g2', carte: [carta(s, 'g2', 'carriola')] });
    expect(scena(tavolo(s2), null)).toEqual({ tipo: 'privata', giocatore: 'g3', pannello: 'scelta' });
  });

  it('la finestra dei Belati di punteggio è una domanda a tutti; chi tocca il suo nome passa al pannello privato', () => {
    const s = alPunteggio();
    expect(s.fase.nome).toBe('belati_punteggio');
    expect(scena(tavolo(s), null)).toEqual({ tipo: 'domanda', contesto: 'punteggio', candidati: ['g1', 'g2', 'g3'] });
    expect(scena(tavolo(s), 'g3')).toEqual({ tipo: 'privata', giocatore: 'g3', pannello: 'punteggio' });
  });

  it('una dichiarazione apre la domanda "Beee-NO!?" solo per chi può rispondere', () => {
    const s = alPunteggio();
    const s2 = applica(s, { tipo: 'giocaBelato', giocatore: 'g3', carta: carta(s, 'g3', 'belato-di-gruppo'), bersaglio: 'g3' });
    expect(scena(tavolo(s2), null)).toEqual({ tipo: 'domanda', contesto: 'reazione', candidati: ['g1', 'g2'] });
    expect(scena(tavolo(s2), 'g1')).toEqual({ tipo: 'privata', giocatore: 'g1', pannello: 'reazione' });
    // L'autore non può rispondere: resta la domanda.
    expect(scena(tavolo(s2), 'g3')).toEqual({ tipo: 'domanda', contesto: 'reazione', candidati: ['g1', 'g2'] });
  });

  it('dado e Testata si giocano sul dispositivo comune, davanti a tutti', () => {
    const s = chiudiPunteggio(alPunteggio());
    expect(scena(tavolo(s), null)).toEqual({ tipo: 'pubblica', giocatore: 'g1', pannello: 'lancio' });
    const t = applica(conFaccia(s, 'testata'), { tipo: 'lanciaDado', giocatore: 'g1' });
    expect(scena(tavolo(t), null)).toEqual({ tipo: 'pubblica', giocatore: 'g1', pannello: 'dichiarazione' });
  });

  it('salvataggio e consolazione sono privati del destinatario', () => {
    let s = chiudiPunteggio(alPunteggio());
    s = applica(conFaccia(s, 'pascolo_piccolo'), { tipo: 'lanciaDado', giocatore: 'g1' });
    s = applica(s, { tipo: 'scadenza' });
    s = prosegui(s);
    expect(scena(tavolo(s), null)).toEqual({ tipo: 'privata', giocatore: 'g3', pannello: 'salvataggio' });
    s = applica(s, { tipo: 'passa', giocatore: 'g3' });
    expect(scena(tavolo(s), null)).toEqual({ tipo: 'privata', giocatore: 'g3', pannello: 'consolazione' });
  });
});
