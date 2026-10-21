// Aiuto comune alle prove delle domande (carte.test.ts, tavolo.test.ts, partite.test.ts): il momento come lo costruirà Partita.
import { azioniPossibili, vistaPer } from '../../../../engine/src';
import type { IdGiocatore, Stato } from '../../../../engine/src';
import { scena } from '../../partita/regia';
import type { Momento } from './tipi';

export interface OpzioniMomento {
  scelto?: IdGiocatore | null;
  condiviso?: boolean;
  manoScoperta?: boolean;
}

/** Il momento come lo costruirà Partita: vista di chi agisce per le schermate private, del tavolo per le altre. */
export function momentoDi(s: Stato, o: OpzioniMomento = {}): Momento {
  const tavolo = vistaPer(s, null);
  const schermo = scena(tavolo, o.scelto ?? null);
  const chi = 'giocatore' in schermo ? schermo.giocatore : null;
  const vista = schermo.tipo === 'privata' && chi ? vistaPer(s, chi) : tavolo;
  return {
    vista,
    schermo,
    azioni: chi ? azioniPossibili(s, chi) : [],
    sistema: azioniPossibili(s, 'sistema'),
    condiviso: o.condiviso ?? true,
    manoScoperta: o.manoScoperta ?? true,
  };
}
