// Il palco: ciò che camera, meteo e ordini leggono e chiedono al teatro (giocatori, aree, pecore, agnellini, fumetti).
// Il teatro lo riempie; i getter leggono sempre il tavolo di adesso, anche dopo una ricostruzione.
import type { IdCarta, IdGiocatore, IdPecora, Luogo } from '../../../engine/src';
import type { Ambiente } from './ambiente/indice';
import type { OpzioniParticella, TipoParticella } from './ambiente/particelle';
import type { Contesto } from './contesto';
import type { PostoDisp } from './disposizioni';
import type { Agnello } from './personaggi/agnello';
import type { Area } from './personaggi/aree';
import type { Branco } from './personaggi/branco';
import type { Pecora, TipoReazione } from './personaggi/pecora';
import type { Coperta } from './tavolo/coperta';

export interface Palco {
  readonly ctx: Contesto;
  /** L'ambiente (cielo, particelle), o null se il teatro è senza ambiente. */
  amb(): Ambiente | null;
  branco(): Branco | null;
  coperta: Coperta;
  /** Gli id nell'ordine dei posti: il primo sta in basso. */
  giocatori(): IdGiocatore[];
  inBasso(): IdGiocatore | null;
  area(l: Luogo): Area | undefined;
  /** Dove sta il giocatore nella disposizione (pecora, recinto, angolo dei Guai…). */
  posto(chi: IdGiocatore): PostoDisp | undefined;
  /** La pecora (razza) del giocatore. */
  razza(chi: IdGiocatore): IdPecora | undefined;
  pecora(chi: IdGiocatore): Pecora | undefined;
  agnelli(): Iterable<Agnello>;
  profondita(y: number): number;
  /** Una particella dell'ambiente; senza ambiente non fa niente. */
  particella(tipo: TipoParticella, x: number, y: number, o?: OpzioniParticella): void;
  fumetto(chi: IdGiocatore, testo: string, ms?: number): void;
  reagisci(chi: IdGiocatore, tipo: TipoReazione): void;
  /** Le carte nell'angolo dei Guai di `chi`, come le mostra la scena adesso. */
  angolo(chi: IdGiocatore): IdCarta[];
  /** Aggiunge una carta all'angolo mostrato (la fotografia successiva lo conferma). */
  aggiungiAngolo(chi: IdGiocatore, carta: IdCarta): void;
  /** Cresce a ogni ricostruzione del tavolo: chi aspettava qualcosa del tavolo di prima si ferma. */
  generazione(): number;
}
