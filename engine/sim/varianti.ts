// Varianti di bilanciamento con nome, usate da `npm run simula -- --variante <nome>`.
import { SETUP } from '../src';
import type { FacciaDado } from '../src';
import type { Variante } from './simulatore';

/** Dado del brief originale: due Pascoli piccoli e una sola Testata. */
const DADO_BRIEF: FacciaDado[] = SETUP.dado.map((f) =>
  f.id === 'pascolo_piccolo' ? { ...f, copie: 2 } : f.id === 'testata' ? { ...f, copie: 1 } : { ...f },
);

export const VARIANTI: Record<string, Variante> = {
  /** I numeri di partenza del brief, prima del bilanciamento della fase 2 (D45), per confronto. */
  'brief-originale': {
    nome: 'numeri del brief originale (Ovile 15 / 12 / 12, dado con una Testata)',
    postiOvile: { 2: 15, 3: 12, 4: 12 },
    agnelliniTotali: { 2: 30, 3: 36, 4: 44 },
    dado: DADO_BRIEF,
  },
};
