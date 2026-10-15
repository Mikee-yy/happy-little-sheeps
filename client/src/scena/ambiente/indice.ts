// Ambiente: paesaggio, flora, particelle e cielo, messi insieme (bozza scena.src.html, righe 704–1074).
// Un solo punto d'accesso per il teatro; i moduli del meteo e dei personaggi usano `particella`, `ventoIn`, `LUCE`…
import type { Contesto } from '../contesto';
import type { Disposizione } from '../disposizioni';
import type { OraDelGiorno } from '../fotografia';
import { profondita as prospettivaDi } from '../personaggi/aree';
import { creaCielo, type Atmosfera, type Cielo } from './cielo';
import { creaFlora, type Flora } from './flora';
import { disegnaPaesaggio } from './paesaggio';
import { creaParticelle, type Particelle } from './particelle';

export { GRIGIO_FUMO, TAVOLOZZA } from './paesaggio';
export type { Atmosfera, Cielo } from './cielo';
export type { Particella, TipoParticella } from './particelle';

export interface Ambiente extends Cielo {
  /** Le piante messe a dimora (per le prove e per il meteo). */
  flora: Flora['piante'];
  particelle: Particelle['lista'];
  particella: Particelle['particella'];
  aggiornaParticelle(dt: number): void;
  decoro: Particelle['decoro'];
  fumata: Particelle['fumata'];
  zeta: Particelle['zeta'];
  vista: Particelle['vista'];
  /** Gli agnellini lontani hanno la stessa proporzione della pecora del loro giocatore (bozza, riga 1190). */
  profondita(y: number): number;
  /** Passo della scena: vento, atmosfera, sole. */
  passo(dt: number): void;
  /** Erba e nuvole, 30 volte al secondo (15 in modo leggero). */
  passo30(dt: number): void;
  ridisponiFlora(disp: Disposizione): void;
  adattaTela(): void;
  impostaOra(ora: OraDelGiorno): void;
  distruggi(): void;
}

export function creaAmbiente(ctx: Contesto, disp: Disposizione): Ambiente {
  let corrente = disp;
  // Prospettiva: DISP.prospettiva = [y della fila degli avversari, scala della loro pecora]
  const profondita = (y: number): number => prospettivaDi(y, corrente.prospettiva);

  disegnaPaesaggio(ctx.el.paesaggio);
  const cielo = creaCielo(ctx);
  const polvere = creaParticelle(ctx, cielo.ventoIn, profondita);
  const flora = creaFlora(
    ctx,
    disp,
    { ventoIn: cielo.ventoIn, raffica: () => cielo.VENTO.raffica, geloErba: () => cielo.atmosfera.geloErba },
    { particella: polvere.particella, conta: polvere.conta, limite: polvere.limite },
  );

  const distruggiCielo = cielo.distruggi;
  // Si completa lo stesso oggetto del cielo (non una copia): `suCambioLuce` assegnato da fuori arriva al cielo
  return Object.assign(cielo, {
    flora: flora.piante,
    particelle: polvere.lista,
    particella: polvere.particella,
    aggiornaParticelle: polvere.aggiorna,
    decoro: polvere.decoro,
    fumata: polvere.fumata,
    zeta: polvere.zeta,
    vista: polvere.vista,
    profondita,
    passo30(dt: number) {
      cielo.passoNuvole(dt);
      flora.passo(dt);
    },
    ridisponiFlora(d: Disposizione) {
      corrente = d;
      flora.ridisponi(d);
    },
    adattaTela: polvere.adattaTela,
    distruggi() {
      polvere.distruggi();
      flora.distruggi();
      distruggiCielo();
      ctx.el.paesaggio.innerHTML = '';
    },
  });
}
