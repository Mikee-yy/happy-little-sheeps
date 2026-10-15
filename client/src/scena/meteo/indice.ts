// Il meteo dei Guai: dall'id del Guaio al suo effetto sulla scena (bozza scena.src.html, righe 2336–2525).
// I Guai senza voce qui non hanno effetto sulla scena.
import type { Camera } from '../camera';
import type { Palco } from '../palco';
import { creaMeteo as creaMeteoCon, type EffettoGuaio, type Meteo } from './comune';
import { fulmine } from './fulmine';
import { gelata } from './gelata';
import { grandine } from './grandine';
import { lupo } from './lupo';
import { nebbia } from './nebbia';
import { pioggia } from './pioggia';
import { pozzanghera } from './pozzanghera';
import { vento } from './vento';

export type { Meteo } from './comune';
export { ELEMENTI_METEO } from './comune';

export const EFFETTI_GUAIO: Readonly<Record<string, EffettoGuaio>> = Object.freeze({
  'grandine-a-sorpresa': grandine,
  'pioggia-di-traverso': pioggia,
  'vento-dispettoso': vento,
  'nebbia-fitta': nebbia,
  'fulmine-curioso': fulmine,
  'gelata-di-agosto': gelata,
  'pozzanghera-senza-fondo': pozzanghera,
  'lupo-vegetariano': lupo,
});

/** Il meteo della scena con tutti gli effetti dei Guai. */
export function creaMeteo(palco: Palco, camera: Camera): Meteo {
  return creaMeteoCon(palco, camera, EFFETTI_GUAIO);
}
