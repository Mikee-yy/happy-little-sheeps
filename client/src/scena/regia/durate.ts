// Le durate normali della recita: quanto dura, a velocità 1 e senza salto, ciò che il regista recita per gli eventi di una mossa.
// Serve a chi ospita una stanza per sapere quando la scena dei telefoni è libera (progetto: bozze/scena-gioco-4-progetto.md, § 2.3).
import type { Evento, Vista } from '../../../../engine/src';
import { copione, type Battuta } from './copione';
import durate from './durate.json';

/** Durata normale di ogni tipo di battuta, in ms di tempo della scena (voci misurate nel file `durate.json`). */
export const DURATE_NORMALI: Record<Battuta['tipo'], number> = durate;

/**
 * Quanto fa aspettare la partita una battuta: niente se non si aspetta; al più il massimo se c'è, altrimenti la durata del tipo.
 * Eccezione: un Guaio con meteo o Lupo (attesa massimo) vale proprio il massimo, 5 s: la promessa dell'ordine si risolve
 * a `liberaDopoMs` dall'inizio dell'ordine, perché il meteo dura più della carta (la voce `guaio` è quella senza meteo).
 */
function durataBattuta(b: Battuta): number {
  if (b.attesa.tipo === 'niente') return 0;
  if (b.attesa.tipo === 'massimo' && b.tipo === 'guaio') return b.attesa.ms;
  const normale = DURATE_NORMALI[b.tipo];
  return b.attesa.tipo === 'massimo' ? Math.min(normale, b.attesa.ms) : normale;
}

/** Durata normale (velocità 1, senza salto) della recita degli eventi, in ms di tempo della scena. 0 se nessuna battuta. */
export function durataRecita(eventi: Evento[], vista: Vista): number {
  return copione(eventi, vista).reduce((somma, b) => somma + durataBattuta(b), 0);
}
