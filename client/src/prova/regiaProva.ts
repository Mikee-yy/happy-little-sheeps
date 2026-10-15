// Regia della partita di prova: un solo umano sul dispositivo. Le sue schermate compaiono direttamente
// (niente "Passa il dispositivo"); quando tocca a un bot si aspetta; nelle domande a tutti si chiede solo a lui.
import type { IdGiocatore, Vista } from '../../../engine/src';
import { scena } from '../partita/regia';
import type { Scena } from '../partita/regia';

export type ScenaProva = Scena | { tipo: 'attesaBot'; giocatore: IdGiocatore };

export function scenaProva(v: Vista, umano: IdGiocatore): ScenaProva {
  const sc = scena(v, null);
  switch (sc.tipo) {
    case 'privata':
    case 'pubblica':
      return sc.giocatore === umano ? sc : { tipo: 'attesaBot', giocatore: sc.giocatore };
    case 'domanda':
      if (sc.candidati.includes(umano)) return { tipo: 'privata', giocatore: umano, pannello: sc.contesto === 'reazione' ? 'reazione' : 'punteggio' };
      return { tipo: 'attesaBot', giocatore: sc.candidati[0]! };
    default:
      return sc;
  }
}
