// Regia a più dispositivi: pannello giusto per chi deve agire, attesa per gli altri.
import { describe, expect, it } from 'vitest';
import { applica, azioniPossibili, vistaPer } from '../../../engine/src';
import type { IdGiocatore, Stato } from '../../../engine/src';
import { avanza, carta, chiudiPunteggio, conFaccia, prosegui, scegli, scenario } from '../../../engine/test/aiuti';
import { scenaRemota } from './regiaRemota';

const per = (s: Stato, io: IdGiocatore) => scenaRemota(vistaPer(s, io), io, azioniPossibili(s, io));

function alPunteggio(): Stato {
  const s = prosegui(
    scenario({
      guaio: 'tosatura-a-sorpresa',
      mani: { g1: ['carriola', 'beee-no'], g2: ['balla-di-fieno'], g3: ['sasso-comodo', 'belato-di-gruppo'] },
    }),
  );
  return avanza(scegli(s, { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['sasso-comodo'] }));
}

describe('regia remota', () => {
  it('fasi automatiche: tutti vedono la stessa schermata', () => {
    expect(per(scenario(), 'g2')).toEqual({ tipo: 'automatica' });
  });

  it('scelta: chi non ha ancora scelto (o vuole cambiare) ha il pannello; gli altri aspettano', () => {
    const s = prosegui(scenario({ mani: { g1: ['carriola'], g2: ['carriola'], g3: ['carriola'] } }));
    expect(per(s, 'g2')).toEqual({ tipo: 'pannello', pannello: 'scelta' });
  });

  it('Belati di punteggio: pannello per chi è in attesa, attesa con finestra per chi ha passato', () => {
    const s = alPunteggio();
    expect(per(s, 'g3')).toEqual({ tipo: 'pannello', pannello: 'punteggio' });
    const dopo = applica(s, { tipo: 'passa', giocatore: 'g3' });
    expect(per(dopo, 'g3')).toEqual({ tipo: 'attesa', di: ['g1', 'g2'], finestra: true });
  });

  it("dichiarazione: chi può reagire vede il pannello di reazione, l'autore aspetta", () => {
    const s = alPunteggio();
    const s2 = applica(s, { tipo: 'giocaBelato', giocatore: 'g3', carta: carta(s, 'g3', 'belato-di-gruppo'), bersaglio: 'g3' });
    expect(per(s2, 'g1')).toEqual({ tipo: 'pannello', pannello: 'reazione' });
    expect(per(s2, 'g3')).toEqual({ tipo: 'attesa', di: ['g1', 'g2'], finestra: true });
  });

  it('dado: il lanciatore lancia, gli altri aspettano lui', () => {
    const s = chiudiPunteggio(alPunteggio());
    expect(per(s, 'g1')).toEqual({ tipo: 'pannello', pannello: 'lancio' });
    expect(per(s, 'g2')).toEqual({ tipo: 'attesa', di: ['g1'], finestra: false });
    const t = applica(conFaccia(s, 'testata'), { tipo: 'lanciaDado', giocatore: 'g1' });
    expect(per(t, 'g1')).toEqual({ tipo: 'pannello', pannello: 'dichiarazione' });
  });
});
